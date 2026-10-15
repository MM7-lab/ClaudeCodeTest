// Overtime Kitten desk toy: a transparent, borderless, always-on-top window
// that shows only the figure. Drag the figure to turn it, drag the base to move
// it around the desktop, right-click for options.
const { app, BrowserWindow, ipcMain, Menu, dialog, screen } = require("electron");
const path = require("path");
const fs = require("fs");

app.commandLine.appendSwitch("enable-unsafe-webgpu");

const SIZES = { small: [300, 400], medium: [420, 560], large: [560, 750] };
const statePath = () => path.join(app.getPath("userData"), "desk-state.json");
let state = { size: "medium", top: true, edition: "smoke", x: null, y: null };
let win = null;

function loadState() {
  try { state = { ...state, ...JSON.parse(fs.readFileSync(statePath(), "utf8")) }; } catch (e) { /* first run */ }
  if (!SIZES[state.size]) state.size = "medium";
}
let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(statePath(), JSON.stringify(state, null, 2)); } catch (e) { /* read-only profile */ }
  }, 300);
}

function createWindow() {
  const [w, h] = SIZES[state.size];
  const area = screen.getPrimaryDisplay().workArea;
  let x = state.x, y = state.y;
  const onScreen = x !== null && screen.getAllDisplays().some((d) => {
    const b = d.workArea;
    return x + w / 2 >= b.x && x + w / 2 <= b.x + b.width && y + h / 2 >= b.y && y + h / 2 <= b.y + b.height;
  });
  if (!onScreen) { x = area.x + area.width - w - 40; y = area.y + area.height - h - 20; }

  win = new BrowserWindow({
    x, y, width: w, height: h,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: state.top,
    backgroundColor: "#00000000",
    title: "Overtime Kitten",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.loadFile(path.join(__dirname, "figure.html"), { query: { desk: "1", edition: state.edition } });
  win.on("moved", () => { [state.x, state.y] = win.getPosition(); saveState(); });

  // automated check: DESK_SNAPSHOT=out.png saves one frame and quits
  if (process.env.DESK_SNAPSHOT) {
    win.webContents.once("did-finish-load", () => setTimeout(async () => {
      const img = await win.webContents.capturePage();
      fs.writeFileSync(process.env.DESK_SNAPSHOT, img.toPNG());
      app.quit();
    }, Number(process.env.DESK_SNAPSHOT_DELAY || 15000)));
  }
}

const send = (cmd) => () => win && win.webContents.send("menu", cmd);

ipcMain.on("move-by", (_e, dx, dy) => {
  if (!win) return;
  const [x, y] = win.getPosition();
  win.setPosition(Math.round(x + dx), Math.round(y + dy));
});
ipcMain.on("set-ignore", (_e, ignore) => {
  if (win) win.setIgnoreMouseEvents(!!ignore, { forward: true });
});
ipcMain.on("show-menu", (_e, s) => {
  const edition = (name) => () => { state.edition = name; saveState(); send(name)(); };
  const size = (name) => () => {
    state.size = name; saveState();
    const [w, h] = SIZES[name];
    const [x, y] = win.getPosition(), [ow, oh] = win.getSize();
    win.setBounds({ x: x + Math.round((ow - w) / 2), y: y + oh - h, width: w, height: h });
  };
  const template = [
    { label: "Smoke break", type: "radio", checked: !s.custom && s.variant === "smoke", click: edition("smoke") },
    { label: "Night shift (coffee)", type: "radio", checked: !s.custom && s.variant === "coffee", click: edition("coffee") },
    { type: "separator" },
    { label: s.variant === "coffee" ? "Sipping animation" : "Smoking animation", type: "checkbox", checked: s.action, enabled: !s.custom, click: send("action") },
    { label: "Turntable spin", type: "checkbox", checked: s.spin, click: send("spin") },
    { label: "Reset view", click: send("reset") },
    { type: "separator" },
    { label: "Size", submenu: Object.keys(SIZES).map((n) => ({ label: n[0].toUpperCase() + n.slice(1), type: "radio", checked: state.size === n, click: size(n) })) },
    { label: "Always on top", type: "checkbox", checked: win.isAlwaysOnTop(), click: (item) => { win.setAlwaysOnTop(item.checked); state.top = item.checked; saveState(); } },
    { type: "separator" },
    { label: "Load model…", click: openModel },
  ];
  if (s.custom) {
    template.push(
      { label: "PVC finish", submenu: ["gloss", "satin", "matte"].map((f) => ({ label: f[0].toUpperCase() + f.slice(1), click: send("finish-" + f) })) },
      { label: "Back to kitten", click: send("kitten") },
    );
  }
  template.push({ type: "separator" }, { label: "Quit", role: "quit" });
  Menu.buildFromTemplate(template).popup({ window: win });
});

async function openModel() {
  const res = await dialog.showOpenDialog(win, {
    title: "Load a 3D model",
    properties: ["openFile"],
    filters: [{ name: "3D models", extensions: ["glb", "gltf", "obj", "stl"] }],
  });
  if (res.canceled || !res.filePaths.length) return;
  const main = res.filePaths[0];
  const files = [main];
  // a .gltf usually points at a .bin and textures next to it: send those along
  if (/\.gltf$/i.test(main)) {
    const dir = path.dirname(main);
    for (const f of fs.readdirSync(dir)) if (/\.(bin|png|jpe?g|webp)$/i.test(f)) files.push(path.join(dir, f));
  }
  const payload = files.map((f) => ({ name: path.basename(f), data: fs.readFileSync(f) }));
  win.webContents.send("model-files", payload);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(() => { loadState(); createWindow(); });
  app.on("window-all-closed", () => app.quit());
}
