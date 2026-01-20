const { contextBridge, ipcRenderer } = require('electron');

console.log("[PRELOAD] Sistema de IPC Inicializado.");

contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => {
    let validChannels = [
      "check-update",
      "install-update",
      "start-download",
      "refresh-remote-versions",
    ];
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
      'app-version'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});