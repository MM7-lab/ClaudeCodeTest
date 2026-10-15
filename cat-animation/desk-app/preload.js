// The only bridge between the figure page and the desktop window.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("deskApp", {
  moveBy: (dx, dy) => ipcRenderer.send("move-by", dx, dy),
  setIgnore: (ignore) => ipcRenderer.send("set-ignore", ignore),
  showMenu: (state) => ipcRenderer.send("show-menu", state),
  onMenu: (cb) => ipcRenderer.on("menu", (_e, cmd) => cb(cmd)),
  onModelFiles: (cb) => ipcRenderer.on("model-files", (_e, files) => cb(files)),
});
