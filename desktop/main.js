const { app, BrowserWindow, Menu, shell } = require('electron');
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: '#f3e8e2',
    title: 'Plush Toy Box',
    icon: path.join(__dirname, 'app', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  // Keep the app self-contained: external links open in the browser, nothing else navigates.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) e.preventDefault();
  });

  const show = (id) => win.webContents.executeJavaScript(`window.showToy(${JSON.stringify(id)})`);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Toys',
      submenu: [
        ...TOYS.map((t, i) => ({ label: t.label, accelerator: `CmdOrCtrl+${i + 1}`, click: () => show(t.id) })),
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [{ role: 'reload', label: 'Reset toy' }, { role: 'togglefullscreen' }, { type: 'separator' }, { role: 'toggleDevTools' }],
    },
  ]));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
