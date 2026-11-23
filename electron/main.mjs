import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChatGPT, CHATGPT_USAGE_URL } from '@siwc/local';
import { validateRequest, safeErrorMessage } from './validation.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HOME_URL = 'https://auth.openai.com';
let window;
let client;
let activeRequest;
let accountBusy = false;
let modelLoading = false;
let models = [];
let selectedModel = '';
let session = { status: 'disconnected', sharing: false };
let notice = '';
let testResult = '';

const clean = (s, fallback = '') => typeof s === 'string' ? s.slice(0, 600) : fallback;
const snapshot = () => ({
  session: {
    status: session.status,
    sharing: session.sharing,
    profileId: session.profileId,
    profileLabel: session.profileLabel,
    identity: session.identity,
    ...(session.error ? { error: { code: clean(session.error.code), message: clean(session.error.message) } } : {}),
  },
  accountBusy,
  modelLoading,
  models: models.map(({ slug, displayName }) => ({ slug, displayName })),
  selectedModel,
  busy: Boolean(activeRequest),
  notice: clean(notice),
  testResult: clean(testResult),
});

function event(channel, value) {
  if (window && !window.isDestroyed()) window.webContents.send(channel, value);
}
function publish() { event('classic:status', snapshot()); }

function credentialEncryption() {
  const available = () => {
    if (!app.isReady() || !safeStorage.isEncryptionAvailable()) return false;
    if (process.platform !== 'linux') return true;
    return ['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'].includes(safeStorage.getSelectedStorageBackend());
  };
  const ensure = () => { if (!available()) throw new Error('OS-backed credential encryption is unavailable.'); };
  return {
    id: 'electron-safe-storage-v1',
    isAvailable: available,
    encrypt(text) { ensure(); return safeStorage.encryptString(text); },
    decrypt(ciphertext) { ensure(); return safeStorage.decryptString(Buffer.from(ciphertext)); },
  };
}

async function refreshModels() {
  models = [];
  selectedModel = '';
  if (session.status !== 'connected' || !session.sharing) { publish(); return; }
  modelLoading = true;
  publish();
  try {
    const available = await client.listModels();
    models = available;
    selectedModel = available[0]?.slug ?? '';
    if (!available.length) notice = 'No models are available for this account. Check plan access.';
  } catch (error) {
    notice = safeErrorMessage(error);
  } finally {
    modelLoading = false;
    publish();
  }
}

async function refreshState() {
  session = await client.getSession();
  await refreshModels();
}

async function accountAction(action) {
  if (accountBusy || activeRequest) return { ok: false, error: 'Finish the current action first.' };
  accountBusy = true;
  notice = '';
  testResult = '';
  publish();
  try {
    await action();
    return { ok: true };
  } catch (error) {
    notice = safeErrorMessage(error);
    return { ok: false, error: notice };
  } finally {
    await refreshState().catch(() => { notice = 'Could not read the ChatGPT connection.'; });
    accountBusy = false;
    publish();
  }
}

function validateSender(event) {
  const contents = window?.webContents;
  if (!contents || event.sender !== contents || event.senderFrame !== contents.mainFrame) {
    throw new Error('Unexpected renderer.');
  }
  const requested = new URL(event.senderFrame.url);
  if (requested.protocol !== 'file:' || decodeURIComponent(requested.pathname) !== join(ROOT, 'app', 'index.html').replace(/\\/g, '/')) {
    // Windows file URLs begin /C:/... and may differ in drive letter casing.
    const path = decodeURIComponent(requested.pathname).toLowerCase();
    const expected = '/' + join(ROOT, 'app', 'index.html').replace(/\\/g, '/').toLowerCase();
    if (requested.protocol !== 'file:' || (path !== expected && path !== expected.slice(1))) throw new Error('Unexpected renderer origin.');
  }
}
function handle(name, action) {
  ipcMain.handle(`classic:${name}`, (event, ...args) => {
    validateSender(event);
    return action(...args);
  });
}

function installHandlers() {
  handle('get-state', () => snapshot());
  handle('sign-in', () => accountAction(() => client.signIn()));
  handle('add-account', () => accountAction(() => client.signIn({ newProfile: true })));
  handle('cancel-sign-in', () => { client.cancelSignIn(); return { ok: true }; });
  handle('disconnect', () => accountAction(() => client.disconnect()));
  handle('select-profile', (id) => accountAction(async () => {
    if (typeof id !== 'string' || id.length > 100) throw new Error('Invalid profile.');
    await client.selectProfile(id);
  }));
  handle('refresh-models', async () => { await refreshModels(); return snapshot(); });
  handle('stop', () => { activeRequest?.abort(); return { ok: true }; });
  handle('open-usage', async () => {
    await shell.openExternal(CHATGPT_USAGE_URL);
    return { ok: true };
  });
  handle('verify-plan', async () => {
    if (accountBusy || activeRequest) return { ok: false, error: 'Finish the current action first.' };
    if (!session.sharing || !selectedModel) return { ok: false, error: 'Connect and enable ChatGPT plan usage first.' };
    const controller = new AbortController();
    activeRequest = controller;
    testResult = '';
    publish();
    try {
      const result = await client.streamResponse({
        model: selectedModel,
        input: 'Reply with exactly: Subscription connection works.',
        signal: controller.signal,
      });
      if (!result.text.trim()) throw new Error('Empty test response');
      testResult = `Plan request succeeded. Model: ${selectedModel}. Reply: ${result.text.trim().slice(0,120)}`;
      return { ok: true, text: result.text };
    } catch (error) {
      testResult = safeErrorMessage(error);
      return { ok: false, error: testResult };
    } finally {
      activeRequest = undefined;
      publish();
    }
  });
  handle('send', async (body) => {
    if (accountBusy || activeRequest) return { ok: false, error: 'A request is already in progress.' };
    if (session.status !== 'connected' || !session.sharing) return { ok: false, error: 'Connect and approve ChatGPT plan usage first.' };
    let req;
    try { req = validateRequest(body, models); }
    catch (error) { return { ok: false, error: error.message }; }
    const controller = new AbortController();
    activeRequest = controller;
    notice = '';
    publish();
    try {
      const result = await client.streamResponse({
        model: req.model,
        input: req.messages,
        signal: controller.signal,
        onDelta: (delta) => event('classic:stream', { type: 'delta', requestId: req.requestId, delta }),
      });
      event('classic:stream', { type: 'done', requestId: req.requestId });
      return { ok: true, text: result.text };
    } catch (error) {
      const message = controller.signal.aborted ? 'Request stopped.' : safeErrorMessage(error);
      event('classic:stream', { type: 'error', requestId: req.requestId, error: message });
      return { ok: false, error: message };
    } finally {
      activeRequest = undefined;
      publish();
    }
  });
}

async function createWindow() {
  window = new BrowserWindow({
    width: 1480, height: 980, minWidth: 790, minHeight: 560,
    title: 'Classic Chat Test', backgroundColor: '#080808',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(ROOT, 'electron', 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_web, _permission, callback) => callback(false));
  await window.loadFile(join(ROOT, 'app', 'index.html'));
  publish();
}

app.whenReady().then(async () => {
  client = createChatGPT({
    appName: 'Classic Chat Test',
    appId: 'classic-chat-test',
    redirectPort: 0,
    storageDir: join(app.getPath('userData'), 'siwc'),
    credentialEncryption: credentialEncryption(),
    sendHostId: true,
    openBrowser: async (url) => {
      const target = new URL(url);
      if (target.origin !== HOME_URL) throw new Error('Unexpected sign-in domain.');
      await shell.openExternal(target.href);
    },
  });
  client.subscribe((next) => { session = next; publish(); });
  installHandlers();
  await createWindow();
  await refreshState();
}).catch((error) => {
  // Never log full auth/library errors. Keep local diagnostics generic.
  process.stderr.write(`Classic Chat could not start: ${error?.name || 'error'}\n`);
  app.quit();
});

app.on('window-all-closed', () => {
  activeRequest?.abort();
  client?.cancelSignIn();
  app.quit();
});
