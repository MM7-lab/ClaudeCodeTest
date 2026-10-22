// 熊仔桌面寵物: a transparent, borderless, always-on-top window that shows only the bear.
// Clicks go through everywhere except on him. Drag him to move him, right-click for the menu.
const { app, BrowserWindow, ipcMain, Menu, screen } = require("electron");
const path = require("path");
const fs = require("fs");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");   // his sound effects

// the character's drawing is 600 × 630
const SIZES = { small: [200, 210], medium: [280, 294], large: [380, 399] };
const statePath = () => path.join(app.getPath("userData"), "pet-state.json");
let state = { size: "medium", top: true, x: null, y: null };
let win = null, cursorTimer = null, lastCursor = "";

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
    title: "熊仔",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
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

  // automated check: PET_SNAPSHOT=out.png saves one frame and quits
  if (process.env.PET_SNAPSHOT) {
    win.webContents.once("did-finish-load", () => setTimeout(async () => {
      const img = await win.webContents.capturePage();
      fs.writeFileSync(process.env.PET_SNAPSHOT, img.toPNG());
      app.quit();
    }, Number(process.env.PET_SNAPSHOT_DELAY || 4000)));
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
  const size = (name) => () => {
    state.size = name; saveState();
    const [w, h] = SIZES[name];
    const [x, y] = win.getPosition(), [ow, oh] = win.getSize();
    win.setBounds({ x: x + Math.round((ow - w) / 2), y: y + oh - h, width: w, height: h });   // keeps him sitting on the same spot
  };
  const mode = (id, label) => ({ label, type: "radio", checked: s.mode === id, click: send(id) });
  const startup = app.getLoginItemSettings().openAtLogin;
  const template = [
    { label: "自動（自己決定做乜）", type: "checkbox", checked: s.auto, click: send("auto") },
    { type: "separator" },
    mode("idle", "😌 坐定定"),
    mode("wave", "👋 揮手"),
    mode("cocoa", "☕ 飲熱朱古力"),
    mode("vibe", "🎧 聽歌"),
    mode("code", "💻 做嘢"),
    mode("sleep", "💤 瞓覺"),
    mode("clock", "⏰ 睇鐘（話你知幾點）"),
    { type: "separator" },
    { label: "摸頭", click: send("pat") },
    { label: "推眼鏡", click: send("glasses") },
    { label: "郁腳趾", click: send("toes") },
    { label: "身邊擺個鐘", type: "checkbox", checked: s.deskClock, click: send("deskclock") },
    { type: "separator" },
    { label: "大細", submenu: [["small", "細"], ["medium", "中"], ["large", "大"]].map(([n, l]) => ({ label: l, type: "radio", checked: state.size === n, click: size(n) })) },
    { label: "聲效", type: "checkbox", checked: s.sound, click: send("sound") },
    { label: "眼跟住滑鼠", type: "checkbox", checked: s.eyes, click: send("eyes") },
    { label: "永遠喺最頂", type: "checkbox", checked: win.isAlwaysOnTop(), click: (item) => { win.setAlwaysOnTop(item.checked); state.top = item.checked; saveState(); } },
    { label: "開機自動開", type: "checkbox", checked: startup, click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { type: "separator" },
    { label: "離開", role: "quit" },
  ];
  Menu.buildFromTemplate(template).popup({ window: win });
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(() => { loadState(); createWindow(); });
  app.on("window-all-closed", () => { clearInterval(cursorTimer); app.quit(); });
}
