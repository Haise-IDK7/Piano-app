const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pianoApp', {
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  isDesktop: true,
});
