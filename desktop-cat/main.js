'use strict';
const { app, BrowserWindow, clipboard, globalShortcut, ipcMain, screen, Tray, Menu, Notification, nativeImage, powerMonitor } = require('electron');
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
// The plush toys (公仔) from the soft-body toy box; the cat plays with whichever are switched on.
const TOYS = [
  { id: 'baby-bear', label: '熊啤啤' },
  { id: 'plush-octopus', label: '八爪魚' },
  { id: 'hello-kitty', label: 'Hello Kitty' },
  { id: 'moomin', label: '姆明' },
  { id: 'turbo-granny', label: '高速婆婆' },
];
// Feather colours for the birds (雀仔), and the cage choices.
const BIRD_COLORS = ['yellow', 'blue', 'green', 'pink', 'white'];
const CAGES = ['both', 'left', 'right', 'off'];
const DEFAULT_BIRDS = [{ name: '檸檬', color: 'yellow' }, { name: '藍莓', color: 'blue' }, { name: '蜜桃', color: 'pink' }];
const DEFAULTS = {
  name: '麻糬', coat: 'orange', size: 1, every: 30,
  types: { water: true, rest: true, toilet: true },
  chatty: true, sound: false, volume: 0.6, autostart: false,
  tree: 'right', toys: ['baby-bear', 'plush-octopus'], toySize: 80,
  forceWebGPU: false,
  birdCount: 3, birds: DEFAULT_BIRDS, cage: 'both',
  pig: true, pigName: '布甸', pigBed: 'left',
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
// One-off changes to settings saved by older versions:
// 2: sound had been on by default; a user's PC crashed in its audio driver while the cat was
//    running, so sound starts off until switched on again.
// 3: toys now draw with WebGL, so the risky forced-WebGPU switch goes back off.
// 4: one bird became up to three, and the cages now hang at the top corners.
const SETTINGS_VERSION = 4;
function loadSettings() {
  const saved = readJson('settings.json', {});
  const s = { ...DEFAULTS, ...saved };
  s.types = { ...DEFAULTS.types, ...s.types };
  const v = saved.settingsVersion || 1;
  if (v < 2) s.sound = false;
  if (v < 3) s.forceWebGPU = false;
  if (v < 4) {
    if (saved.bird === false) s.birdCount = 0;
    if (typeof saved.birdName === 'string') s.birds = [{ ...DEFAULT_BIRDS[0], name: saved.birdName }, ...DEFAULT_BIRDS.slice(1)];
    if (saved.cage === 'off') s.cage = 'off'; else s.cage = 'both';
    delete s.bird; delete s.birdName;
  }
  s.birds = cleanBirds(s.birds);
  s.settingsVersion = SETTINGS_VERSION;
  if (v !== SETTINGS_VERSION) writeJson('settings.json', s);
  return s;
}
function loadStats() { const s = readJson('stats.json', null); return s && s.date === today() ? s : { date: today(), water: 0, rest: 0, toilet: 0, pets: 0 }; }

let S = DEFAULTS, stats = null;
const st = { running: true, nextAt: 0, remaining: 0, orderIdx: 0, pending: null, nagAt: 0, nags: 0, away: false };
let pet = null, settingsWin = null, tray = null, catHidden = false, lastNote = null, tickN = 0, petReady = false;
// What happened to each toy this run: 'loading', 'ready' or 'failed' (+ message), shown in settings.
const toyStatus = {};
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
  if (['right', 'left', 'off'].includes(p.tree)) out.tree = p.tree;
  if (CAGES.includes(p.cage)) out.cage = p.cage;
  if (Number.isInteger(p.birdCount)) out.birdCount = Math.min(3, Math.max(0, p.birdCount));
  if (Array.isArray(p.birds)) out.birds = cleanBirds(p.birds);
  if (typeof p.pig === 'boolean') out.pig = p.pig;
  if (typeof p.pigName === 'string') out.pigName = p.pigName.trim().slice(0, 20) || DEFAULTS.pigName;
  if (['left', 'right', 'off'].includes(p.pigBed)) out.pigBed = p.pigBed;
  if (Array.isArray(p.toys)) out.toys = TOYS.map(t => t.id).filter(id => p.toys.includes(id));
  if (Number.isFinite(p.toySize)) out.toySize = Math.min(200, Math.max(60, Math.round(p.toySize)));
  if (typeof p.forceWebGPU === 'boolean') out.forceWebGPU = p.forceWebGPU;
  return out;
}
// always three birds' worth of names and colours (only the first birdCount come out)
function cleanBirds(list) {
  return DEFAULT_BIRDS.map((d, i) => {
    const b = (Array.isArray(list) && list[i]) || {};
    return {
      name: typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 20) : d.name,
      color: BIRD_COLORS.includes(b.color) ? b.color : d.color,
    };
  });
}
function applyAutostart() {
  // Only the installed app should register itself; a dev run would register the bare Electron binary.
  if (!app.isPackaged) return;
  // the portable .exe unpacks itself to a temp folder each run; start the .exe itself at login
  try { app.setLoginItemSettings({ openAtLogin: S.autostart, path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath }); } catch {}
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
  pet.setAlwaysOnTop(true);
  pet.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  pet.setIgnoreMouseEvents(true, { forward: true });
  pet.loadFile(path.join(__dirname, 'pet', 'index.html'));
  // Stay hidden until the cat has drawn a frame, so a failed start can never leave an
  // invisible or black window covering the screen.
  petReady = false;
  setTimeout(() => {
    if (pet && !petReady) giveUp('貓貓開唔到（3D 顯示冇反應），已經收埋咗。');
  }, 20000);
  pet.webContents.on('render-process-gone', () => giveUp('貓貓個畫面停咗，已經收埋咗。'));
  pet.on('closed', () => { pet = null; });
}
// Something went wrong with the cat's window: hide it, say so, and don't retry in a loop.
function giveUp(msg) {
  if (!pet || pet.isDestroyed()) return;
  pet.setIgnoreMouseEvents(true);
  pet.hide();
  catHidden = true;
  notify(`${S.name}出咗事 😿`, `${msg}右下角貓貓圖示可以再試或者離開。`);
  refreshTray();
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
function saveAndApply(patch) {
  S = { ...S, ...cleanPatch(patch) };
  writeJson('settings.json', S);
  broadcast('settings', S);
  refreshTray();
}
function menuItems() {
  return [
    { label: st.running ? '暫停提醒' : '繼續提醒', click: () => setPaused(st.running) },
    { label: '即刻提醒一次（試吓）', click: testReminder },
    { label: '叫貓貓過嚟', click: () => { showCat(true); sendPet('come-here'); } },
    { label: catHidden ? '叫貓貓出返嚟' : '收埋貓貓', click: () => showCat(catHidden) },
    {
      label: '公仔',
      submenu: [
        ...TOYS.map(t => ({
          label: t.label, type: 'checkbox', checked: S.toys.includes(t.id),
          click: (item) => saveAndApply({ toys: item.checked ? [...S.toys, t.id] : S.toys.filter(id => id !== t.id) }),
        })),
        { type: 'separator' },
        { label: '全部公仔郁一郁', click: () => sendPet('toy-action', 'wiggle') },
        { label: '公仔由天跌落嚟', click: () => sendPet('toy-action', 'drop') },
        { label: '擺返好啲公仔', click: () => sendPet('toy-action', 'reset') },
      ],
    },
    {
      label: '雀仔',
      submenu: [
        ...[[0, '唔要雀仔'], [1, '1 隻雀仔'], [2, '2 隻雀仔'], [3, '3 隻雀仔']].map(([n, label]) => ({
          label, type: 'radio', checked: S.birdCount === n, click: () => saveAndApply({ birdCount: n }),
        })),
        { label: '叫雀仔唱歌', enabled: S.birdCount > 0, click: () => sendPet('bird-action', 'sing') },
        { type: 'separator' },
        ...[['both', '鳥籠吊喺左上同右上'], ['left', '鳥籠淨係吊喺左上'], ['right', '鳥籠淨係吊喺右上'], ['off', '唔要鳥籠']].map(([v, label]) => ({
          label, type: 'radio', checked: S.cage === v, click: () => saveAndApply({ cage: v }),
        })),
      ],
    },
    {
      label: '豬仔',
      submenu: [
        { label: S.pig ? `收埋${S.pigName}` : `叫${S.pigName}出嚟`, click: () => saveAndApply({ pig: !S.pig }) },
        { label: `叫${S.pigName}跳舞`, enabled: S.pig, click: () => sendPet('pig-action', 'dance') },
        { type: 'separator' },
        ...[['left', '豬仔床放喺左邊'], ['right', '豬仔床放喺右邊'], ['off', '唔要豬仔床']].map(([v, label]) => ({
          label, type: 'radio', checked: S.pigBed === v, click: () => saveAndApply({ pigBed: v }),
        })),
      ],
    },
    {
      label: '貓跳臺',
      submenu: [['right', '放喺右邊'], ['left', '放喺左邊'], ['off', '唔要']].map(([v, label]) => ({
        label, type: 'radio', checked: S.tree === v, click: () => saveAndApply({ tree: v }),
      })),
    },
    { label: '設定…', click: openSettings },
    { label: '複製診斷資料', click: async () => { clipboard.writeText(await diagnostics()); notify('已複製診斷資料', '而家可以貼俾幫你整貓貓嘅人。'); } },
    { type: 'separator' },
    { label: '離開（Ctrl+Alt+Q）', click: () => app.quit() },
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
ipcMain.on('pet-ready', () => {
  if (!pet || petReady) return;
  petReady = true;
  if (!catHidden) pet.showInactive();
});
ipcMain.handle('get-state', () => ({
  settings: S, stats, timer: timerInfo(), status: statusText(), toyList: TOYS, toyStatus,
  webgpu: app.getGPUFeatureStatus().webgpu || 'unknown',
}));
ipcMain.on('toy-status', (_e, id, state, msg, rect) => {
  if (!TOYS.some(t => t.id === id) || !['loading', 'ready', 'failed'].includes(state)) return;
  toyStatus[id] = { state, msg: msg ? String(msg).slice(0, 1500) : '' };
  if (rect && typeof rect === 'object') toyStatus[id].rect = ['l', 'r', 't', 'b'].map(k => Math.round(Number(rect[k]) || 0));
});

// A plain-text report for troubleshooting: system, graphics chips, WebGPU, and each toy.
const VENDORS = { 0x8086: 'Intel', 0x10de: 'NVIDIA', 0x1002: 'AMD', 0x1414: 'Microsoft' };
async function diagnostics() {
  const lines = [`桌面貓貓 ${app.getVersion()} 診斷資料（${new Date().toLocaleString('zh-HK')}）`];
  lines.push(`系統：${process.platform} ${require('os').release()} ${process.arch}`);
  const d = screen.getPrimaryDisplay();
  lines.push(`螢幕：${d.size.width}x${d.size.height}，縮放 ${Math.round(d.scaleFactor * 100)}%，工作區 ${d.workArea.width}x${d.workArea.height}`);
  try {
    const info = await app.getGPUInfo('basic');
    for (const g of info.gpuDevice || []) {
      const hex = n => (n >>> 0).toString(16).padStart(4, '0');
      lines.push(`顯示卡：${VENDORS[g.vendorId] || '其他'} ${hex(g.vendorId)}:${hex(g.deviceId)}${g.driverVersion ? ' 驅動 ' + g.driverVersion : ''}${g.active ? '（使用中）' : ''}`);
    }
  } catch (e) { lines.push('顯示卡：讀唔到（' + e.message + '）'); }
  const fs2 = app.getGPUFeatureStatus();
  lines.push(`WebGPU：${fs2.webgpu}；WebGL：${fs2.webgl}；硬件加速：${fs2.gpu_compositing}`);
  lines.push(`強制開 WebGPU：${S.forceWebGPU ? '有' : '冇'}（今次啟動${app.commandLine.hasSwitch('enable-unsafe-webgpu') ? '有' : '冇'}用）`);
  lines.push(`貓貓視窗：${pet ? (petReady ? '出咗嚟' : '未畫到') : '冇'}${pet ? '，位置 ' + JSON.stringify(pet.getBounds()) : ''}`);
  lines.push(`公仔（大細 ${S.toySize}）：`);
  for (const id of S.toys) {
    const t = toyStatus[id], label = TOYS.find(x => x.id === id).label;
    if (!t) { lines.push(`- ${label}：未開始`); continue; }
    const where = t.rect ? `，畫面位置 x ${t.rect[0]}–${t.rect[1]}，y ${t.rect[2]}–${t.rect[3]}` : '';
    lines.push(`- ${label}：${{ loading: '載入中', ready: '出咗嚟', failed: '出唔到' }[t.state]}${t.msg ? '（' + t.msg + '）' : ''}${where}`);
  }
  return lines.join('\n');
}
ipcMain.handle('diagnostics', () => diagnostics());
ipcMain.handle('copy-diagnostics', async () => { const t = await diagnostics(); clipboard.writeText(t); return t; });
function restartApp() {
  // the portable .exe unpacks itself to a temp folder: restart the .exe itself
  const exe = process.env.PORTABLE_EXECUTABLE_FILE;
  app.relaunch(exe ? { execPath: exe, args: [] } : undefined);
  app.exit(0);
}
ipcMain.on('restart-app', restartApp);
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
// Don't force 3D onto graphics drivers Chromium has blocklisted: those drivers can crash or
// hang the whole computer. Without 3D the cat says so and stays out of the way.
// Windows otherwise decides a see-through window is hidden and pauses it, freezing the cat.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
// Only when the user chose it (after the toys couldn't start): let WebGPU run on graphics chips
// Chromium hasn't allow-listed. Switches must be set before the app is ready.
{
  const saved = readJson('settings.json', {});
  if (saved.forceWebGPU === true && (saved.settingsVersion || 1) >= 3) app.commandLine.appendSwitch('enable-unsafe-webgpu');
}
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
    // Emergency exit that works even if the mouse is stuck: Ctrl+Alt+Q (Mac: Cmd+Alt+Q).
    globalShortcut.register('CommandOrControl+Alt+Q', () => app.quit());
    app.on('child-process-gone', (_e, d) => { if (d.type === 'GPU') giveUp('部電腦嘅顯示卡程序停咗。'); });
    powerMonitor.on('lock-screen', () => { st.away = true; });
    powerMonitor.on('suspend', () => { st.away = true; });
    setInterval(tick, 1000);
  });
  // The cat lives on after the settings window closes; quit only from the menu.
  app.on('window-all-closed', () => {});
}
