const $ = (id) => document.getElementById(id);
const bridge = window.classic;
const shell = document.querySelector('.shell');
const main = $('main');
let backend = {
  session: { status: 'disconnected', sharing: false },
  models: [], selectedModel: '', accountBusy: false, busy: false, notice: '', testResult: '',
};
let chats = [];
let activeChatId = null;
let running = null;
let localError = bridge ? '' : 'Open this project through Electron (npm start) to connect your ChatGPT subscription.';

function findChat(id = activeChatId) { return chats.find((chat) => chat.id === id); }
function newChat() {
  const id = crypto.randomUUID();
  chats.unshift({ id, title: 'New chat', messages: [] });
  activeChatId = id;
  $('prompt').value = '';
  updateComposer();
  renderAll();
  $('prompt').focus();
  return chats[0];
}
function renderHistory() {
  const history = $('history');
  history.replaceChildren();
  if (!chats.length) {
    const label = document.createElement('div');
    label.className = 'history-empty'; label.textContent = 'No chats in this session';
    history.append(label);
  }
  for (const chat of chats) {
    const entry = document.createElement('button');
    entry.className = 'history-entry' + (chat.id === activeChatId ? ' active' : '');
    entry.textContent = chat.title;
    entry.title = chat.title;
    entry.addEventListener('click', () => {
      activeChatId = chat.id;
      renderAll();
      if (window.innerWidth <= 900) shell.classList.remove('show-sidebar');
    });
    history.append(entry);
  }
}
function renderMessages() {
  const chat = findChat();
  const haveMessages = Boolean(chat?.messages.length);
  main.classList.toggle('has-messages', haveMessages);
  $('empty-state').classList.toggle('hidden', haveMessages);
  $('conversation').classList.toggle('hidden', !haveMessages);
  $('suggestions').classList.toggle('hidden', haveMessages);
  const list = $('conversation');
  list.replaceChildren();
  if (!chat) return;
  for (const msg of chat.messages) {
    const row = document.createElement('div');
    row.className = `message ${msg.role}` + (msg.status === 'error' ? ' error' : '');
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = msg.content || '';
    if (msg.status === 'streaming') {
      const caret = document.createElement('span'); caret.className = 'typing';
      bubble.append(caret);
    }
    row.append(bubble);
    if (msg.status === 'error' && msg.content) {
      const meta = document.createElement('div'); meta.className = 'message-meta';
      meta.textContent = 'This response was not completed';
      row.append(meta);
    }
    list.append(row);
  }
  list.scrollTop = list.scrollHeight;
}
function renderAccount() {
  const connected = backend.session.status === 'connected' && backend.session.sharing;
  $('connection-dot').classList.toggle('connected', connected);
  $('connection-dot').classList.toggle('connecting', backend.session.status === 'connecting');
  $('account-button').textContent = connected ? (backend.session.identity?.email || backend.session.profileLabel || 'Connected') :
    (backend.session.status === 'connecting' ? 'Connecting...' : 'Connect ChatGPT');
  $('connection-detail').textContent = connected
    ? `Connected to ${backend.session.identity?.email || backend.session.profileLabel || 'your ChatGPT account'}. Plan usage authorized.`
    : backend.session.status === 'connecting'
      ? 'Complete sign-in and plan-sharing permission in your browser.'
      : backend.session.status === 'connected'
        ? 'Signed in, but plan usage was not authorized.'
        : backend.session.status === 'reauth_required' ? 'Sign in again to reconnect.'
          : 'Not connected.';
  $('models-hint').textContent = connected
    ? 'Supported models are loaded from your authorized account. Chat history stays in this local app.'
    : 'Uses official OAuth. Your password and tokens are never passed to this interface.';
  $('sign-in').classList.toggle('hidden', backend.accountBusy || connected);
  $('sign-in').textContent = backend.session.status === 'connected' ? 'Enable plan usage' : 'Continue with ChatGPT';
  $('add-account').classList.toggle('hidden', !connected || backend.accountBusy);
  $('disconnect').classList.toggle('hidden', !connected || backend.accountBusy);
  $('test-plan').classList.toggle('hidden', !connected || backend.accountBusy);
  $('cancel-sign-in').classList.toggle('hidden', !backend.accountBusy);
  $('test-plan').disabled = Boolean(backend.busy || !backend.models.length);
  $('test-result').textContent = backend.testResult || (backend.session.error?.message ?? '');
  $('notice').classList.toggle('hidden', !localError && !backend.notice);
  $('notice').textContent = localError || backend.notice || '';
}
function renderModels() {
  const picker = $('model-picker');
  const previous = picker.value;
  picker.replaceChildren();
  if (backend.models.length) {
    for (const model of backend.models) {
      const option = document.createElement('option');
      option.value = model.slug;
      option.textContent = model.displayName;
      picker.append(option);
    }
    picker.value = backend.models.some((m) => m.slug === previous) ? previous : backend.selectedModel;
    if (!picker.value) picker.selectedIndex = 0;
  } else {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = backend.modelLoading ? 'Loading...' : 'Connect first';
    picker.append(option);
  }
  picker.disabled = !backend.session.sharing || !backend.models.length || backend.busy || backend.accountBusy;
}
function updateComposer() {
  const input = $('prompt');
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
  $('send').disabled = !bridge || Boolean(running) || !input.value.trim() || !backend.session.sharing || !backend.models.length;
  $('send').classList.toggle('hidden', Boolean(running));
  $('stop').classList.toggle('hidden', !running);
}
function renderAll() { renderHistory(); renderMessages(); renderAccount(); renderModels(); updateComposer(); }

function applyStream(event) {
  if (!running || event.requestId !== running.requestId) return;
  const chat = findChat(running.chatId);
  const answer = chat?.messages.find((m) => m.id === running.answerId);
  if (!answer) return;
  if (event.type === 'delta') {
    answer.content += event.delta;
  } else if (event.type === 'error') {
    answer.status = 'error';
    if (!answer.content) answer.content = event.error || 'Request failed.';
  } else if (event.type === 'done') {
    answer.status = 'completed';
  }
  if (activeChatId === running.chatId) renderMessages();
}

async function sendMessage(event) {
  event.preventDefault();
  if (!bridge || running) return;
  const content = $('prompt').value.trim();
  if (!content) return;
  if (!backend.session.sharing || !$('model-picker').value) {
    $('login-popover').classList.remove('hidden');
    localError = 'Connect and approve your ChatGPT plan before sending.';
    renderAccount();
    return;
  }
  const chat = findChat() || newChat();
  if (chat.messages.length === 0) chat.title = content.slice(0, 48).replace(/\s+/g, ' ');
  chat.messages.push({ id: crypto.randomUUID(), role: 'user', content, status: 'completed' });
  const answer = { id: crypto.randomUUID(), role: 'assistant', content: '', status: 'streaming' };
  chat.messages.push(answer);
  const requestId = `r_${crypto.randomUUID().replaceAll('-', '')}`;
  running = { requestId, chatId: chat.id, answerId: answer.id };
  const messages = chat.messages
    .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.status === 'completed'))
    .map(({ role, content }) => ({ role, content }));
  const model = $('model-picker').value;
  $('prompt').value = '';
  localError = '';
  renderAll();
  try {
    const response = await bridge.send({ requestId, model, messages });
    if (response.ok) {
      answer.content = response.text;
      answer.status = 'completed';
    } else {
      answer.status = 'error';
      if (!answer.content) answer.content = response.error || 'Request failed.';
    }
  } catch (_) {
    answer.status = 'error';
    if (!answer.content) answer.content = 'The desktop application could not complete the request.';
  } finally {
    running = null;
    renderAll();
    $('prompt').focus();
  }
}

function setupEvents() {
  $('composer').addEventListener('submit', sendMessage);
  $('prompt').addEventListener('input', updateComposer);
  $('prompt').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('composer').requestSubmit(); }
  });
  $('stop').addEventListener('click', () => bridge?.stop());
  $('sidebar-open').addEventListener('click', () => shell.classList.toggle('show-sidebar'));
  $('sidebar-close').addEventListener('click', () => shell.classList.remove('show-sidebar'));
  $('new-chat').addEventListener('click', newChat);
  $('top-new-chat').addEventListener('click', newChat);
  $('writing-suggestion').addEventListener('click', () => {
    $('prompt').value = 'Help me write or edit this text: ';
    $('prompt').focus();
    updateComposer();
  });
  $('account-button').addEventListener('click', () => $('login-popover').classList.toggle('hidden'));
  $('close-popover').addEventListener('click', () => $('login-popover').classList.add('hidden'));
  $('sign-in').addEventListener('click', async () => { if (bridge) await bridge.signIn(); });
  $('add-account').addEventListener('click', async () => { if (bridge) await bridge.addAccount(); });
  $('cancel-sign-in').addEventListener('click', async () => { if (bridge) await bridge.cancelSignIn(); });
  $('disconnect').addEventListener('click', async () => { if (bridge) await bridge.disconnect(); });
  $('test-plan').addEventListener('click', async () => { if (bridge) await bridge.verifyPlan(); });
  $('manage-usage').addEventListener('click', () => bridge?.openUsage());
  $('manage-usage-side').addEventListener('click', () => bridge?.openUsage());
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
      e.preventDefault(); newChat();
    }
  });
}

async function init() {
  setupEvents();
  newChat();
  if (!bridge) { renderAll(); return; }
  bridge.onStatus((value) => { backend = value; renderAccount(); renderModels(); updateComposer(); });
  bridge.onStream(applyStream);
  try {
    backend = await bridge.getState();
  } catch (_) {
    localError = 'Could not reach the desktop connection. Restart the app.';
  }
  renderAll();
}
init();
