
const { contextBridge, ipcRenderer } = require('electron');

// Expondo métodos específicos para o renderizador (React) de forma segura
contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => {
    // Lista de canais permitidos (whitelist) para envio
    let validChannels = ['check-update', 'install-update'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel, func) => {
    // Lista de canais permitidos para recebimento
    let validChannels = ['update-available', 'update-downloading', 'update-ready'];
    if (validChannels.includes(channel)) {
      // Deliberadamente retiramos o evento para não expor o objeto ipcRenderer completo
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});
