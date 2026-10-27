// Yo 姐桌面寵物: a transparent, borderless, always-on-top window that shows only Yo 姐.
// Clicks go through everywhere except on her. Drag her to move her, right-click for the menu.
const { app, BrowserWindow, ipcMain, Menu, screen, session } = require("electron");
const path = require("path");
const fs = require("fs");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");   // her sound effects

// the character's drawing is 600 × 630; with the desk clock beside her it is 740 wide
const SIZES = { small: [200, 210], medium: [280, 294], large: [380, 399] };
const WIDE = 740 / 600;
const winSize = (name) => { const [w, h] = SIZES[name]; return [Math.round(w * (state.wide ? WIDE : 1)), h]; };
const statePath = () => path.join(app.getPath("userData"), "pet-state.json");
let state = { size: "medium", top: true, wide: true, x: null, y: null };
let win = null, cursorTimer = null, lastCursor = "";

function loadState() {
  try {
    const saved = JSON.parse(fs.readFileSync(statePath(), "utf8"));
    // take only the settings we know, with the right types
    if (SIZES[saved.size]) state.size = saved.size;
    if (typeof saved.top === "boolean") state.top = saved.top;
    if (typeof saved.wide === "boolean") state.wide = saved.wide;
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
  if (!onScreen) { x = area.x + area.width - w - 40; y = area.y + area.height - h; }   // standing on the taskbar, bottom right

  win = new BrowserWindow({
    x, y, width: w, height: h,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: state.top,
    backgroundColor: "#00000000",
    title: "Yo 姐",
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

  // her eyes follow the cursor anywhere on the screen, not only over her window
  cursorTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return;
    const p = screen.getCursorScreenPoint(), b = win.getContentBounds();
    const key = p.x + "," + p.y;
    if (key === lastCursor) return;                     // only when it moves, so she looks around when it rests
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
ipcMain.on("set-wide", (e, wide) => {
  if (!fromPet(e) || state.wide === !!wide) return;
  state.wide = !!wide; saveState();
  const [x, y] = win.getPosition(), [w, h] = winSize(state.size);
  win.setBounds({ x, y, width: w, height: h });                      // grows to the right, so she does not move
});
ipcMain.on("set-ignore", (e, ignore) => {
  if (fromPet(e)) win.setIgnoreMouseEvents(!!ignore, { forward: true });
});
ipcMain.on("show-menu", (e, raw) => {
  if (!fromPet(e) || !raw || typeof raw !== "object") return;
  const s = { mode: String(raw.mode), auto: !!raw.auto, sound: !!raw.sound, eyes: !!raw.eyes, deskClock: !!raw.deskClock };
  const size = (name) => () => {
    state.size = name; saveState();
    const [w, h] = winSize(name);
    const [x, y] = win.getPosition(), [, oh] = win.getSize();
    const scale = h / oh;
    win.setBounds({ x: x + Math.round((300 / 630) * oh * (1 - scale)), y: y + oh - h, width: w, height: h });   // keeps her standing on the same spot
  };
  const mode = (id, label) => ({ label, type: "radio", checked: s.mode === id, click: send(id) });
  const template = [
    { label: "自動（自己決定做乜）", type: "checkbox", checked: s.auto, click: send("auto") },
    { type: "separator" },
    mode("idle", "😌 坐定定"),
    mode("wave", "👋 揮手"),
    mode("cocoa", "☕ 飲杯嘢"),
    mode("vibe", "🎧 聽歌"),
    mode("code", "💻 做嘢"),
    mode("sleep", "💤 瞓覺"),
    mode("clock", "⏰ 介紹時間（話你知幾點）"),
    { type: "separator" },
    { label: "摸頭", click: send("pat") },
    { label: "撥頭髮", click: send("glasses") },
    { label: "🙌 Hooray 跳", click: send("toes") },
    { label: "身邊擺個鐘", type: "checkbox", checked: s.deskClock, click: send("deskclock") },
    { type: "separator" },
    { label: "大細", submenu: [["small", "細"], ["medium", "中"], ["large", "大"]].map(([n, l]) => ({ label: l, type: "radio", checked: state.size === n, click: size(n) })) },
    { label: "聲效", type: "checkbox", checked: s.sound, click: send("sound") },
    { label: "眼跟住滑鼠", type: "checkbox", checked: s.eyes, click: send("eyes") },
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
