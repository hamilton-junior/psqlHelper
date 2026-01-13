const { contextBridge, ipcRenderer } = require('electron');

console.log("[PRELOAD] Script carregado com sucesso. Expondo API 'electron' no escopo global.");

contextBridge.exposeInMainWorld('electron', {
  getVersion: () => process.env.npm_package_version || '0.1.10',
  send: (channel, data) => {
    let validChannels = ['check-update', 'install-update', 'start-download'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel, func) => {
    let validChannels = [
      'update-available', 
      'update-not-available', 
      'update-downloading', 
      'update-ready', 
      'sync-versions', 
      'update-error',
      'update-check-result'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  removeAllListeners: (channel) => {
    let validChannels = [
      'update-available', 
      'update-not-available', 
      'update-downloading', 
      'update-ready', 
      'sync-versions', 
      'update-error',
      'update-check-result'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  }
});