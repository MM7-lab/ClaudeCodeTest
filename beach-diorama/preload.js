'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Minimal, explicit API: no raw ipcRenderer and no event objects reach the page.
const subscribe = (channel) => (callback) => {
  ipcRenderer.on(channel, (_event, payload) => callback(payload));
};

contextBridge.exposeInMainWorld('diorama', {
  getState: () => ipcRenderer.invoke('diorama:get-state'),
  setInteractive: (interactive) => ipcRenderer.send('diorama:set-interactive', Boolean(interactive)),
  sceneReady: () => ipcRenderer.send('diorama:scene-ready'),
  showContextMenu: () => ipcRenderer.send('diorama:show-context-menu'),
  onMode: subscribe('diorama:mode'),
  onMoveMode: subscribe('diorama:move-mode'),
  onResetView: subscribe('diorama:reset-view'),
  onCursor: subscribe('diorama:cursor'),
});
