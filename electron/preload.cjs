'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// The renderer receives no credentials, browser cookies, or generic IPC bridge.
const api = {
  getState: () => ipcRenderer.invoke('classic:get-state'),
  signIn: () => ipcRenderer.invoke('classic:sign-in'),
  addAccount: () => ipcRenderer.invoke('classic:add-account'),
  cancelSignIn: () => ipcRenderer.invoke('classic:cancel-sign-in'),
  disconnect: () => ipcRenderer.invoke('classic:disconnect'),
  selectProfile: (id) => ipcRenderer.invoke('classic:select-profile', id),
  refreshModels: () => ipcRenderer.invoke('classic:refresh-models'),
  send: (request) => ipcRenderer.invoke('classic:send', request),
  stop: () => ipcRenderer.invoke('classic:stop'),
  verifyPlan: () => ipcRenderer.invoke('classic:verify-plan'),
  openUsage: () => ipcRenderer.invoke('classic:open-usage'),
  onStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('classic:status', listener);
    return () => ipcRenderer.removeListener('classic:status', listener);
  },
  onStream: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('classic:stream', listener);
    return () => ipcRenderer.removeListener('classic:stream', listener);
  },
};
contextBridge.exposeInMainWorld('classic', Object.freeze(api));
