'use strict';
const { app, BrowserWindow, Menu, ipcMain, screen, session } = require('electron');
const fs = require('fs');
const path = require('path');

const WIN_SIZE = 300;
const MARGIN = 20;
const MODES = ['day', 'sunset', 'night'];
const MODE_LABELS = { day: '日間 (Day)', sunset: '日落 (Sunset)', night: '夜晚 (Night)' };
const MAPS = ['hk-mini', 'kowloon-bay'];
const MAP_LABELS = { 'hk-mini': '地圖：迷你香港 (卡通)', 'kowloon-bay': '地圖：九龍灣 (寫實)' };
const DEBUG = Boolean(process.env.DIORAMA_DEBUG);

/**
 * How transparent areas let clicks through:
 *  - forward: setIgnoreMouseEvents(true, { forward: true }); the page still receives mouse
 *    moves and tells us when the cursor is over the diorama. Default on Windows and macOS.
 *  - poll:    ignore mouse events and poll the cursor position here instead. Fallback if
 *    forwarding turns out to be unreliable. Select with --click-through=poll.
 *  - off:     the whole 300x300 window always takes the mouse (default on Linux, where
 *    Electron cannot forward mouse moves).
 */
function resolveClickThrough() {
  const arg = process.argv.find((a) => a.startsWith('--click-through='));
  const wanted = (arg ? arg.split('=')[1] : process.env.DIORAMA_CLICK_THROUGH || '').toLowerCase();
  if (['forward', 'poll', 'off'].includes(wanted)) return wanted;
  return process.platform === 'win32' || process.platform === 'darwin' ? 'forward' : 'off';
}
const clickThrough = resolveClickThrough();

let win = null;
let settings = { mode: 'day', position: null, map: 'hk-mini' };
let moveMode = false;
let ignoring = false;
let saveTimer = null;
let pollTimer = null;
let cursorWasInside = false;

// ---- settings (JSON in userData) --------------------------------------------------------------

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    if (MODES.includes(raw.mode)) settings.mode = raw.mode;
    if (MAPS.includes(raw.map)) settings.map = raw.map;
    const p = raw.position;
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) settings.position = { x: Math.round(p.x), y: Math.round(p.y) };
  } catch {
    // First launch or unreadable file: keep the defaults.
  }
}

function saveSettings() {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    const tmp = `${settingsFile()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(settings, null, 2));
    fs.renameSync(tmp, settingsFile());
  } catch (err) {
    console.error('Could not save settings:', err);
  }
}

// ---- window position --------------------------------------------------------------------------

function defaultPosition() {
  const wa = screen.getPrimaryDisplay().workArea;
  return { x: wa.x + wa.width - WIN_SIZE - MARGIN, y: wa.y + wa.height - WIN_SIZE - MARGIN };
}

/** Keeps a saved position usable after monitors were unplugged or rearranged. */
function validPosition(pos) {
  if (!pos) return defaultPosition();
  const centre = { x: pos.x + WIN_SIZE / 2, y: pos.y + WIN_SIZE / 2 };
  const display = screen.getAllDisplays().find((d) => {
    const b = d.bounds;
    return centre.x >= b.x && centre.x < b.x + b.width && centre.y >= b.y && centre.y < b.y + b.height;
  });
  if (!display) return defaultPosition();
  const b = display.bounds;
  return {
    x: Math.min(Math.max(pos.x, b.x), b.x + b.width - WIN_SIZE),
    y: Math.min(Math.max(pos.y, b.y), b.y + b.height - WIN_SIZE),
  };
}

function saveWindowPosition() {
  if (!win || win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  settings.position = { x, y };
  saveSettings();
}

/** Moving between monitors with different scaling can change the size; put it back. */
function settleWindow() {
  if (!win || win.isDestroyed()) return;
  const b = win.getBounds();
  // A tolerance of 2 px ignores rounding differences at fractional display scaling (125%, 150%).
  if (Math.abs(b.width - WIN_SIZE) > 2 || Math.abs(b.height - WIN_SIZE) > 2) {
    win.setBounds({ x: b.x, y: b.y, width: WIN_SIZE, height: WIN_SIZE });
  }
  if (moveMode) saveWindowPosition();
}

function keepWindowOnScreen() {
  if (!win || win.isDestroyed()) return;
  // Without a saved position the window follows the bottom-right corner of the work area.
  const [x, y] = win.getPosition();
  const pos = settings.position ? validPosition({ x, y }) : defaultPosition();
  win.setPosition(pos.x, pos.y);
}

// ---- click-through ----------------------------------------------------------------------------

function setIgnore(ignore) {
  if (!win || win.isDestroyed() || ignore === ignoring) return;
  ignoring = ignore;
  if (ignore) win.setIgnoreMouseEvents(true, clickThrough === 'forward' ? { forward: true } : undefined);
  else win.setIgnoreMouseEvents(false);
}

function startCursorPolling() {
  pollTimer = setInterval(() => {
    if (!win || win.isDestroyed() || !win.isVisible() || moveMode) return;
    const c = screen.getCursorScreenPoint();
    const b = win.getBounds();
    const inside = c.x >= b.x && c.x < b.x + b.width && c.y >= b.y && c.y < b.y + b.height;
    if (inside || cursorWasInside) win.webContents.send('diorama:cursor', { x: c.x - b.x, y: c.y - b.y, inside });
    cursorWasInside = inside;
  }, 40);
}

// ---- state changes ----------------------------------------------------------------------------

function setMode(mode) {
  if (!MODES.includes(mode)) return;
  settings.mode = mode;
  saveSettings();
  win.webContents.send('diorama:mode', mode);
}

/** Switching map rebuilds the whole scene, so the page is simply loaded again. */
function setMap(map) {
  if (!MAPS.includes(map) || map === settings.map) return;
  settings.map = map;
  saveSettings();
  win.webContents.reload();
}

function setMoveMode(on) {
  moveMode = on;
  if (on) {
    // While repositioning, the whole window takes the mouse so the drag handle is easy to grab.
    setIgnore(false);
  } else {
    if (clickThrough !== 'off') setIgnore(true);
    saveWindowPosition(); // "Lock position" remembers wherever the window is now
  }
  win.webContents.send('diorama:move-mode', on);
}

function buildMenu() {
  return Menu.buildFromTemplate([
    ...MODES.map((m) => ({
      label: MODE_LABELS[m],
      type: 'radio',
      checked: settings.mode === m,
      click: () => setMode(m),
    })),
    { type: 'separator' },
    ...MAPS.map((m) => ({
      label: MAP_LABELS[m],
      type: 'radio',
      checked: settings.map === m,
      click: () => setMap(m),
    })),
    { type: 'separator' },
    moveMode
      ? { label: '鎖定位置 (Lock position)', click: () => setMoveMode(false) }
      : { label: '移動位置 (Move position)', click: () => setMoveMode(true) },
    { label: '重設視角 (Reset view)', click: () => win.webContents.send('diorama:reset-view') },
    { type: 'separator' },
    { label: '結束 (Quit)', click: () => app.quit() },
  ]);
}

function popupMenu() {
  if (win && !win.isDestroyed()) buildMenu().popup({ window: win });
}

// ---- window -----------------------------------------------------------------------------------

function createWindow() {
  const pos = validPosition(settings.position);
  win = new BrowserWindow({
    x: pos.x,
    y: pos.y,
    width: WIN_SIZE,
    height: WIN_SIZE,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    title: 'Beach Diorama',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: DEBUG,
    },
  });

  // 'screen-saver' is the highest level; on Windows it also sits above the taskbar.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setSkipTaskbar(true);
  win.on('always-on-top-changed', (_e, onTop) => {
    if (!onTop) win.setAlwaysOnTop(true, 'screen-saver');
  });
  win.on('blur', () => win.setAlwaysOnTop(true, 'screen-saver'));

  if (clickThrough !== 'off') setIgnore(true);
  if (clickThrough === 'poll') startCursorPolling();

  // Right-clicking the drag handle would normally open the Windows system menu.
  win.on('system-context-menu', (event) => {
    event.preventDefault();
    popupMenu();
  });

  win.on('move', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(settleWindow, 350);
  });

  // The page only ever shows our own index.html.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());

  win.once('ready-to-show', () => win.showInactive());
  win.on('closed', () => {
    win = null;
  });
  win.loadFile(path.join(__dirname, 'index.html'), DEBUG ? { query: { debug: '1' } } : undefined);
}

// ---- IPC --------------------------------------------------------------------------------------

function fromRenderer(event) {
  return win && !win.isDestroyed() && event.sender === win.webContents;
}

ipcMain.handle('diorama:get-state', (event) => {
  if (!fromRenderer(event)) return null;
  return { mode: settings.mode, moveMode, map: settings.map };
});

ipcMain.on('diorama:set-interactive', (event, interactive) => {
  if (!fromRenderer(event) || typeof interactive !== 'boolean') return;
  if (clickThrough === 'off' || moveMode) return;
  setIgnore(!interactive);
});

ipcMain.on('diorama:show-context-menu', (event) => {
  if (fromRenderer(event)) popupMenu();
});

// ---- app lifecycle ----------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId('beach-diorama');
  Menu.setApplicationMenu(null);

  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    loadSettings();
    createWindow();

    const reposition = () => keepWindowOnScreen();
    screen.on('display-removed', reposition);
    screen.on('display-metrics-changed', reposition);

    if (DEBUG) global.__dioramaDebug = { buildMenu, setMoveMode, getWin: () => win, getSettings: () => settings, clickThrough, isIgnoring: () => ignoring };
  });

  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {
    clearInterval(pollTimer);
    clearTimeout(saveTimer);
    if (moveMode) saveWindowPosition();
  });
}
