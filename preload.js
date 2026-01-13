
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getVersion: () => process.env.npm_package_version || '0.1.10',
  send: (channel, data) => {
    let validChannels = ['check-update', 'install-update', 'start-download'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel, func) => {
    let validChannels = ['update-available', 'update-not-available', 'update-downloading', 'update-ready', 'sync-versions', 'update-error'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});
