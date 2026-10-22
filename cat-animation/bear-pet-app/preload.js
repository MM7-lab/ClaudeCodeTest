// The only bridge between the pet page and the desktop window.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("deskApp", {
  moveBy: (dx, dy) => ipcRenderer.send("move-by", dx, dy),
  setIgnore: (ignore) => ipcRenderer.send("set-ignore", ignore),
  showMenu: (state) => ipcRenderer.send("show-menu", state),
  setWide: (wide) => ipcRenderer.send("set-wide", wide),
  on: (channel, cb) => { if (channel === "menu" || channel === "cursor") ipcRenderer.on(channel, (_e, v) => cb(v)); },
});
