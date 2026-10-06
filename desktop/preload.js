// Lets the desktop-pet page tell the app when the mouse is over the toy,
// so clicks everywhere else pass through to the desktop.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petBridge', {
  setInteractive: (on) => ipcRenderer.send('pet:interactive', Boolean(on)),
});
