// Lets the desktop-pet page tell the app when the mouse is over the toy,
// so clicks everywhere else pass through to the desktop.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petBridge', {
  setInteractive: (on) => ipcRenderer.send('pet:interactive', Boolean(on)),
  // the app polls the cursor itself, so the toy knows where the mouse is even while clicks pass through
  onCursor: (cb) => ipcRenderer.on('pet:cursor', (_e, p) => cb(p)),
});
