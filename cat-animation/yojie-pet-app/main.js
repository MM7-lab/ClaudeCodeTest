// Yo Jie desk pet: a transparent, borderless, always-on-top window that shows only Yo Jie at her desk.
// Clicks go through everywhere except on her. Drag her to move her, right-click for the menu.
const { app, BrowserWindow, ipcMain, Menu, screen, session } = require("electron");
const path = require("path");
const fs = require("fs");

// her picture is 835 × 1177
const SIZES = { small: [170, 240], medium: [230, 324], large: [310, 437] };
const winSize = (name) => SIZES[name];
const statePath = () => path.join(app.getPath("userData"), "pet-state.json");
let state = { size: "medium", top: true, x: null, y: null };
let win = null, cursorTimer = null, lastCursor = "";

function loadState() {
  try {
    const saved = JSON.parse(fs.readFileSync(statePath(), "utf8"));
    // take only the settings we know, with the right types
    if (SIZES[saved.size]) state.size = saved.size;
    if (typeof saved.top === "boolean") state.top = saved.top;
    if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) { state.x = Math.round(saved.x); state.y = Math.round(saved.y); }
  } catch (e) { /* first run */ }
}
let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(statePath(), JSON.stringify(state, null, 2)); } catch (e) { /* read-only profile */ }
  }, 300);
}

function createWindow() {
  const [w, h] = winSize(state.size);
  const area = screen.getPrimaryDisplay().workArea;
  let x = state.x, y = state.y;
  const onScreen = x !== null && screen.getAllDisplays().some((d) => {
    const b = d.workArea;
    return x + w / 2 >= b.x && x + w / 2 <= b.x + b.width && y + h / 2 >= b.y && y + h / 2 <= b.y + b.height;
  });
  if (!onScreen) { x = area.x + area.width - w - 40; y = area.y + area.height - h; }   // sitting on the taskbar, bottom right

  win = new BrowserWindow({
    x, y, width: w, height: h,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: state.top,
    backgroundColor: "#00000000",
    title: "Yo Jie",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,                      // the page runs with no access to files or the system
      webSecurity: true,
      spellcheck: false,
      devTools: !app.isPackaged,
      backgroundThrottling: false,
    },
  });
  // the window only ever shows the bundled pet page: no links, no new windows, no other pages
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, "pet.html"));
  win.on("moved", () => { [state.x, state.y] = win.getPosition(); saveState(); });

  // his eyes follow the cursor anywhere on the screen, not only over his window
  cursorTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return;
    const p = screen.getCursorScreenPoint(), b = win.getContentBounds();
    const key = p.x + "," + p.y;
    if (key === lastCursor) return;                     // only when it moves, so he looks around when it rests
    lastCursor = key;
    win.webContents.send("cursor", { x: p.x - b.x, y: p.y - b.y });
  }, 50);

  // automated check (development builds only): PET_SNAPSHOT=out.png saves one frame and quits
  if (!app.isPackaged && process.env.PET_SNAPSHOT) {
    win.webContents.once("did-finish-load", () => setTimeout(async () => {
      const img = await win.webContents.capturePage();
      fs.writeFileSync(process.env.PET_SNAPSHOT, img.toPNG());
      app.quit();
    }, Number(process.env.PET_SNAPSHOT_DELAY || 4000)));
  }
}

const send = (cmd) => () => win && win.webContents.send("menu", cmd);

// messages are only accepted from our own page, and their values are checked before use
function fromPet(e) {
  if (!win || e.sender !== win.webContents || !e.senderFrame) return false;
  try { const u = new URL(e.senderFrame.url); return u.protocol === "file:" && decodeURIComponent(u.pathname).toLowerCase().endsWith("/pet.html"); }
  catch { return false; }
}
const num = (v, lim) => (typeof v === "number" && Number.isFinite(v) ? Math.max(-lim, Math.min(lim, v)) : 0);

ipcMain.on("move-by", (e, dx, dy) => {
  if (!fromPet(e)) return;
  const [x, y] = win.getPosition();
  win.setPosition(Math.round(x + num(dx, 2000)), Math.round(y + num(dy, 2000)));
});
ipcMain.on("set-ignore", (e, ignore) => {
  if (fromPet(e)) win.setIgnoreMouseEvents(!!ignore, { forward: true });
});
ipcMain.on("show-menu", (e, raw) => {
  if (!fromPet(e) || !raw || typeof raw !== "object") return;
  const s = { act: String(raw.act), auto: !!raw.auto, sign: !!raw.sign };
  const size = (name) => () => {
    state.size = name; saveState();
    const [w, h] = winSize(name);
    const [x, y] = win.getPosition(), [, oh] = win.getSize();
    win.setBounds({ x: x + Math.round((win.getSize()[0] - w) / 2), y: y + oh - h, width: w, height: h });   // keeps her desk on the same spot
  };
  const act = (id, label) => ({ label, type: "radio", checked: s.act === id, click: send(id) });
  const template = [
    { label: "自動（自己決定做乜）", type: "checkbox", checked: s.auto, click: send("auto") },
    { type: "separator" },
    act("typing", "💻 打字"),
    act("glance", "😊 望吓你"),
    act("think", "🤔 諗嘢"),
    act("stretch", "🙆 伸懶腰"),
    act("doze", "😴 瞇一陣"),
    { type: "separator" },
    { label: "牌仔顯示時間", type: "checkbox", checked: s.sign, click: send("sign") },
    { label: "大細", submenu: [["small", "細"], ["medium", "中"], ["large", "大"]].map(([n, l]) => ({ label: l, type: "radio", checked: state.size === n, click: size(n) })) },
    { label: "永遠喺最頂", type: "checkbox", checked: win.isAlwaysOnTop(), click: (item) => { win.setAlwaysOnTop(item.checked); state.top = item.checked; saveState(); } },
    { type: "separator" },
    { label: "離開", role: "quit" },
  ];
  Menu.buildFromTemplate(template).popup({ window: win });
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(() => {
    // no camera, microphone, location, notifications or anything else a page could ask for
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    loadState(); createWindow();
  });
  app.on("window-all-closed", () => { clearInterval(cursorTimer); app.quit(); });
}
