'use strict';
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, Notification, nativeImage, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');

const MIN = 60 * 1000;
// No keyboard or mouse for this long counts as "away": the timer waits, and
// coming back starts a fresh interval (you already had a break).
const AWAY_SEC = 5 * 60;

const TYPES = {
  water: { emoji: '💧', name: '飲水', title: '飲水時間！' },
  rest: { emoji: '🙆', name: '休息', title: '休息吓啦！' },
  toilet: { emoji: '🚽', name: '去廁所', title: '去個廁所啦！' },
};
const ORDER = ['water', 'rest', 'water', 'toilet'];
const MSGS = {
  water: ['喵～夠鐘飲啖水啦 💧', '飲杯水先，我陪你 🥛', '口渴未呀？去斟杯水啦 💧'],
  rest: ['起身伸個懶腰啦 🙆', '望吓遠處，俾對眼休息 20 秒 👀', '企起身行兩步啦 🚶', '轉吓膊頭，深呼吸一下 🌿'],
  toilet: ['去個廁所先啦，唔好忍呀 🚽', '去完廁所返嚟，我幫你睇住張枱 🐱'],
};
const THANKS = {
  water: n => `好叻！今日飲咗 ${n} 杯水 💧`,
  rest: () => '舒服啲未呀？😸',
  toilet: () => '歡迎返嚟！我幫你暖住張櫈 🐾',
};
const COATS = ['orange', 'grey', 'black', 'white', 'tuxedo'];
const DEFAULTS = {
  name: '麻糬', coat: 'orange', size: 1, every: 30,
  types: { water: true, rest: true, toilet: true },
  chatty: true, sound: true, volume: 0.6, autostart: false,
};

const pick = a => a[Math.floor(Math.random() * a.length)];
const file = n => path.join(app.getPath('userData'), n);
function readJson(n, fallback) { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch { return fallback; } }
function writeJson(n, v) {
  try { fs.mkdirSync(app.getPath('userData'), { recursive: true }); fs.writeFileSync(file(n), JSON.stringify(v, null, 2)); }
  catch (e) { console.error('save failed', n, e); }
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function loadSettings() { const s = { ...DEFAULTS, ...readJson('settings.json', {}) }; s.types = { ...DEFAULTS.types, ...s.types }; return s; }
function loadStats() { const s = readJson('stats.json', null); return s && s.date === today() ? s : { date: today(), water: 0, rest: 0, toilet: 0, pets: 0 }; }

let S = DEFAULTS, stats = null;
const st = { running: true, nextAt: 0, remaining: 0, orderIdx: 0, pending: null, nagAt: 0, nags: 0, away: false };
let pet = null, settingsWin = null, tray = null, catHidden = false, lastNote = null, tickN = 0;
const iconPath = path.join(__dirname, 'assets', 'icon.png');
const preload = path.join(__dirname, 'preload.js');

// ---------- reminders ----------
function upcoming() {
  for (let i = 0; i < ORDER.length; i++) {
    const idx = (st.orderIdx + i) % ORDER.length;
    if (S.types[ORDER[idx]]) return { type: ORDER[idx], idx };
  }
  return null;
}
function timerInfo() {
  const u = st.pending || upcoming();
  return {
    running: st.running, away: st.away, pending: st.pending ? st.pending.type : null,
    next: u ? u.type : null, msLeft: st.running ? Math.max(0, st.nextAt - Date.now()) : st.remaining,
  };
}
function statusText() {
  const t = timerInfo();
  if (t.pending) return `${TYPES[t.pending].emoji} 等緊你${TYPES[t.pending].name}`;
  if (!t.next) return '冇開任何提醒';
  if (!t.running) return '提醒暫停咗';
  if (t.away) return '你離開咗，暫停計時';
  return `下次：${TYPES[t.next].emoji} ${TYPES[t.next].name}（${Math.max(1, Math.ceil(t.msLeft / MIN))} 分鐘後）`;
}
function fire() {
  const u = upcoming();
  if (!u) { st.nextAt = Date.now() + S.every * MIN; return; }
  st.pending = u; st.nags = 0; st.nagAt = Date.now() + 5 * MIN;
  const T = TYPES[u.type], text = pick(MSGS[u.type]);
  if (catHidden) showCat(true);
  sendPet('reminder', { type: u.type, emoji: T.emoji, text });
  notify(`${T.emoji} ${S.name}：${T.title}`, text);
  refreshTray();
}
function answer(done) {
  const u = st.pending;
  if (!u) return;
  st.pending = null;
  let text;
  if (done) {
    stats[u.type]++; saveStats();
    st.orderIdx = (u.idx + 1) % ORDER.length;
    st.nextAt = Date.now() + S.every * MIN;
    text = THANKS[u.type](stats[u.type]);
  } else {
    st.nextAt = Date.now() + 5 * MIN;
    text = '好啦，5 分鐘之後再提你 ⏰';
  }
  if (!st.running) st.remaining = st.nextAt - Date.now();
  sendPet('reminder-end', { done, text });
  refreshTray();
}
function testReminder() { if (!st.pending) fire(); }
function setPaused(paused) {
  if (paused && st.running) { st.remaining = Math.max(0, st.nextAt - Date.now()); st.running = false; sendPet('say', { text: '暫停一陣，我喺度等你 😺' }); }
  else if (!paused && !st.running) { st.nextAt = Date.now() + Math.max(st.remaining, 5000); st.running = true; sendPet('say', { text: '繼續努力！🐾' }); }
  refreshTray();
}
function tick() {
  const now = Date.now();
  if (stats.date !== today()) { stats = loadStats(); broadcast('stats', stats); }
  let idle = 0;
  try { idle = powerMonitor.getSystemIdleTime(); } catch {}
  if (idle >= AWAY_SEC) st.away = true;
  else if (st.away) {
    st.away = false;
    if (st.running && !st.pending) {
      st.nextAt = now + S.every * MIN;
      sendPet('say', { text: '你返嚟啦！頭先離開咗一陣，當休息咗啦 😺' });
    }
  }
  if (st.running && !st.away) {
    if (!st.pending && now >= st.nextAt) fire();
    else if (st.pending && now >= st.nagAt && st.nags < 3) { st.nags++; st.nagAt = now + 5 * MIN; sendPet('nag'); }
  }
  if (++tickN % 20 === 0) refreshTray();
}

// ---------- persistence ----------
function saveStats() { writeJson('stats.json', stats); broadcast('stats', stats); }
function cleanPatch(p) {
  const out = {};
  if (typeof p.name === 'string') out.name = p.name.trim().slice(0, 20) || DEFAULTS.name;
  if (COATS.includes(p.coat)) out.coat = p.coat;
  if (Number.isFinite(p.size)) out.size = Math.min(1.8, Math.max(0.5, p.size));
  if ([15, 20, 30, 45, 60, 90].includes(p.every)) out.every = p.every;
  if (p.types && typeof p.types === 'object') out.types = { ...S.types, ...Object.fromEntries(Object.keys(TYPES).filter(k => k in p.types).map(k => [k, !!p.types[k]])) };
  for (const k of ['chatty', 'sound', 'autostart']) if (typeof p[k] === 'boolean') out[k] = p[k];
  if (Number.isFinite(p.volume)) out.volume = Math.min(1, Math.max(0, p.volume));
  return out;
}
function applyAutostart() {
  // Only the installed app should register itself; a dev run would register the bare Electron binary.
  if (!app.isPackaged) return;
  try { app.setLoginItemSettings({ openAtLogin: S.autostart }); } catch {}
}

// ---------- windows ----------
function sendPet(ch, data) { if (pet && !pet.isDestroyed()) pet.webContents.send(ch, data); }
function broadcast(ch, data) {
  for (const w of [pet, settingsWin]) if (w && !w.isDestroyed()) w.webContents.send(ch, data);
}
function fitPet() {
  if (!pet) return;
  const { workArea } = screen.getPrimaryDisplay();
  pet.setBounds(workArea);
}
function createPet() {
  const { workArea } = screen.getPrimaryDisplay();
  pet = new BrowserWindow({
    ...workArea,
    transparent: true, frame: false, resizable: false, movable: false, minimizable: false, maximizable: false,
    fullscreenable: false, skipTaskbar: true, hasShadow: false, alwaysOnTop: true, show: false,
    backgroundColor: '#00000000', title: '桌面貓貓',
    webPreferences: { preload, autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false },
  });
  pet.setAlwaysOnTop(true, 'screen-saver');
  pet.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  pet.setIgnoreMouseEvents(true, { forward: true });
  pet.loadFile(path.join(__dirname, 'pet', 'index.html'));
  pet.once('ready-to-show', () => pet.showInactive());
  pet.on('closed', () => { pet = null; });
}
function showCat(on) {
  if (!pet) return;
  catHidden = !on;
  if (on) pet.showInactive(); else pet.hide();
  refreshTray();
}
function openSettings() {
  if (settingsWin) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 460, height: 760, minWidth: 380, minHeight: 500, title: `${S.name}設定`, icon: iconPath,
    autoHideMenuBar: true, show: false, backgroundColor: '#fbf6ef',
    webPreferences: { preload },
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, 'settings', 'index.html'));
  settingsWin.once('ready-to-show', () => settingsWin.show());
  settingsWin.on('closed', () => { settingsWin = null; });
}
function notify(title, body) {
  try {
    if (!Notification.isSupported()) return;
    lastNote = new Notification({ title, body, icon: iconPath, silent: true });
    lastNote.on('click', () => showCat(true));
    lastNote.show();
  } catch {}
}

// ---------- tray ----------
function menuItems() {
  return [
    { label: st.running ? '暫停提醒' : '繼續提醒', click: () => setPaused(st.running) },
    { label: '即刻提醒一次（試吓）', click: testReminder },
    { label: '叫貓貓過嚟', click: () => { showCat(true); sendPet('come-here'); } },
    { label: catHidden ? '叫貓貓出返嚟' : '收埋貓貓', click: () => showCat(catHidden) },
    { label: '設定…', click: openSettings },
    { type: 'separator' },
    { label: '離開', click: () => app.quit() },
  ];
}
function refreshTray() {
  if (!tray) return;
  const status = statusText();
  tray.setToolTip(`${S.name}｜${status}`);
  tray.setContextMenu(Menu.buildFromTemplate([{ label: `${S.name}｜${status}`, enabled: false }, { type: 'separator' }, ...menuItems()]));
}
function createTray() {
  let img = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
  if (process.platform === 'darwin') img = img.resize({ width: 18, height: 18 });
  tray = new Tray(img);
  if (process.platform === 'win32') tray.on('click', openSettings);
  refreshTray();
}

// ---------- IPC ----------
ipcMain.handle('cursor', () => {
  if (!pet) return null;
  const p = screen.getCursorScreenPoint(), b = pet.getBounds();
  return { x: p.x - b.x, y: p.y - b.y };
});
ipcMain.on('mouse-through', (_e, on) => { if (pet) pet.setIgnoreMouseEvents(!!on, { forward: true }); });
ipcMain.handle('get-state', () => ({ settings: S, stats, timer: timerInfo(), status: statusText() }));
ipcMain.on('reminder-answer', (_e, done) => answer(!!done));
ipcMain.on('petted', () => { stats.pets++; saveStats(); });
ipcMain.on('context-menu', () => { if (pet) Menu.buildFromTemplate(menuItems()).popup({ window: pet }); });
ipcMain.on('open-settings', openSettings);
ipcMain.on('test-reminder', testReminder);
ipcMain.on('set-paused', (_e, p) => setPaused(!!p));
ipcMain.handle('reset-stats', () => { stats = { date: today(), water: 0, rest: 0, toilet: 0, pets: 0 }; saveStats(); return stats; });
ipcMain.handle('save-settings', (_e, patch) => {
  const clean = cleanPatch(patch || {});
  const everyChanged = clean.every && clean.every !== S.every;
  S = { ...S, ...clean };
  writeJson('settings.json', S);
  if ('autostart' in clean) applyAutostart();
  if (everyChanged && !st.pending) {
    if (st.running) st.nextAt = Date.now() + S.every * MIN; else st.remaining = S.every * MIN;
  }
  if (settingsWin) settingsWin.setTitle(`${S.name}設定`);
  broadcast('settings', S);
  refreshTray();
  return S;
});

// ---------- app ----------
// Let WebGL run on older or blocklisted graphics drivers (falls back to software rendering).
app.commandLine.appendSwitch('ignore-gpu-blocklist');
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId('hk.mm7lab.desktopcat');
  app.on('second-instance', openSettings);
  app.whenReady().then(() => {
    if (process.platform === 'darwin' && app.dock) app.dock.hide();
    S = loadSettings();
    stats = loadStats();
    st.nextAt = Date.now() + S.every * MIN;
    createPet();
    createTray();
    screen.on('display-metrics-changed', fitPet);
    screen.on('display-added', fitPet);
    screen.on('display-removed', fitPet);
    powerMonitor.on('lock-screen', () => { st.away = true; });
    powerMonitor.on('suspend', () => { st.away = true; });
    setInterval(tick, 1000);
  });
  // The cat lives on after the settings window closes; quit only from the menu.
  app.on('window-all-closed', () => {});
}
