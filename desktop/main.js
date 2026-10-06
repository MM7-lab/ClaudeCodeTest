const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// WebGPU is on by default on Windows; this also lets it run on GPUs
// Chromium has not yet allow-listed.
app.commandLine.appendSwitch('enable-unsafe-webgpu');

const TOYS = [
  { id: 'baby-bear', label: '熊啤啤' },
  { id: 'moomin', label: '姆明' },
  { id: 'turbo-granny', label: '高速婆婆' },
  { id: 'plush-octopus', label: 'Plush Octopus' },
];
const SIZES = [
  { label: 'Small', px: 200 },
  { label: 'Medium', px: 300 },
  { label: 'Large', px: 440 },
];
const ICON = path.join(__dirname, 'app', 'icon.png');
const toyFile = (id) => path.join(__dirname, 'app', 'toys', `${id}.html`);

// ---- settings (remembered between launches)
const settings = { toy: 'baby-bear', size: 300, onTop: true, petVisible: true, seenHint: false };
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
function loadSettings() {
  try { Object.assign(settings, JSON.parse(fs.readFileSync(settingsPath(), 'utf8'))); } catch { /* first run */ }
  if (!TOYS.some((t) => t.id === settings.toy)) settings.toy = TOYS[0].id;
}
function saveSettings() {
  try { fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2)); } catch { /* not fatal */ }
}

let pet = null;   // see-through desktop-pet window
let box = null;   // the regular toy box window
let tray = null;
const petState = { interactive: false };
global.petState = petState; // read by the automated tests

// ---- desktop pet: a transparent, borderless window over the work area (screen minus taskbar)
function createPet() {
  const { workArea } = screen.getPrimaryDisplay();
  pet = new BrowserWindow({
    ...workArea,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: settings.onTop,
    title: 'Plush Toy Box',
    icon: ICON,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  pet.once('ready-to-show', () => { if (settings.petVisible) pet.showInactive(); });
  pet.on('closed', () => { pet = null; settings.petVisible = false; saveSettings(); refreshTray(); });
  guardNavigation(pet);
  loadPetToy();
}
function loadPetToy() {
  if (!pet) return;
  setInteractive(false);
  pet.loadFile(toyFile(settings.toy), { query: { pet: '1', size: String(settings.size) } });
}
function setInteractive(on) {
  petState.interactive = on;
  // ignored = clicks fall through to whatever is underneath; mouse moves are still forwarded so the page can tell when the toy is hovered
  pet?.setIgnoreMouseEvents(!on, { forward: true });
}
ipcMain.on('pet:interactive', (e, on) => {
  if (pet && e.sender === pet.webContents) setInteractive(on);
});
function fitPetToScreen() {
  if (pet) pet.setBounds(screen.getPrimaryDisplay().workArea);
}
function showPet(show) {
  settings.petVisible = show;
  saveSettings();
  if (show) { if (!pet) createPet(); else pet.showInactive(); } else pet?.hide();
  refreshTray();
}
const toyAction = (a) => pet?.webContents.executeJavaScript(`window.toyAction && window.toyAction(${JSON.stringify(a)})`);

// ---- the regular toy box window (switcher bar + toy)
function openBox() {
  if (box) { box.show(); box.focus(); return; }
  box = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: '#f3e8e2',
    title: 'Plush Toy Box',
    icon: ICON,
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  box.once('ready-to-show', () => box.show());
  box.on('closed', () => { box = null; });
  guardNavigation(box);
  box.loadFile(path.join(__dirname, 'app', 'index.html'));
}
function showInBox(id) {
  openBox();
  box.webContents.executeJavaScript(`window.showToy && window.showToy(${JSON.stringify(id)})`).catch(() => {});
}

// Keep the app self-contained: external links open in the browser, nothing else navigates.
function guardNavigation(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) e.preventDefault(); });
}

// ---- tray icon menu
function trayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Desktop toy', enabled: false },
    ...TOYS.map((t) => ({
      label: t.label, type: 'radio', checked: settings.toy === t.id,
      click: () => { settings.toy = t.id; saveSettings(); if (!pet || !settings.petVisible) showPet(true); loadPetToy(); },
    })),
    { type: 'separator' },
    { label: 'Wiggle', enabled: !!pet && settings.petVisible, click: () => toyAction('wiggle') },
    { label: 'Drop', enabled: !!pet && settings.petVisible, click: () => toyAction('drop') },
    { label: 'Reset', enabled: !!pet && settings.petVisible, click: () => toyAction('reset') },
    { type: 'separator' },
    {
      label: 'Size',
      submenu: SIZES.map((s) => ({
        label: s.label, type: 'radio', checked: settings.size === s.px,
        click: () => { settings.size = s.px; saveSettings(); loadPetToy(); },
      })),
    },
    {
      label: 'Always on top', type: 'checkbox', checked: settings.onTop,
      click: (item) => { settings.onTop = item.checked; saveSettings(); pet?.setAlwaysOnTop(item.checked); },
    },
    { label: settings.petVisible && pet ? 'Hide toy' : 'Show toy', click: () => showPet(!(settings.petVisible && pet)) },
    { type: 'separator' },
    { label: 'Open toy box window', click: () => showInBox(settings.toy) },
    { type: 'separator' },
    { label: 'Quit Plush Toy Box', click: () => app.quit() },
  ]);
}
function refreshTray() {
  if (tray) tray.setContextMenu(trayMenu());
}

// ---- app menu, used by the toy box window
function appMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Toys',
      submenu: [
        ...TOYS.map((t, i) => ({ label: t.label, accelerator: `CmdOrCtrl+${i + 1}`, click: () => showInBox(t.id) })),
        { type: 'separator' },
        { label: 'Quit Plush Toy Box', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'View',
      submenu: [{ role: 'reload', label: 'Reset toy' }, { role: 'togglefullscreen' }, { type: 'separator' }, { role: 'toggleDevTools' }],
    },
  ]));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { showPet(true); tray?.popUpContextMenu(); });
  app.whenReady().then(() => {
    loadSettings();
    appMenu();
    tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 32, height: 32 }));
    tray.setToolTip('Plush Toy Box');
    tray.on('click', () => tray.popUpContextMenu());
    if (settings.petVisible) createPet();
    refreshTray();
    if (!settings.seenHint && process.platform === 'win32') {
      tray.displayBalloon({ iconType: 'info', title: 'Plush Toy Box', content: 'Your toy is on the desktop. Click this tray icon to change toy or size, or to quit.' });
      settings.seenHint = true;
      saveSettings();
    }
    screen.on('display-metrics-changed', fitPetToScreen);
    screen.on('display-added', fitPetToScreen);
    screen.on('display-removed', fitPetToScreen);
  });
  // Closing the toy box window keeps the desktop toy and tray icon running; quit from the tray.
  app.on('window-all-closed', () => {});
}
