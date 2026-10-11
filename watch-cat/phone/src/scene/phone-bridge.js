// Lets the desktop app's pet page (pet.js) run inside the phone app: it stands in for the
// Electron bridge (preload.js), talking to the app through window.AndroidCat.
(() => {
  // If something goes wrong, say so on the screen (a photo of it helps to fix it).
  let started = false;
  const problem = msg => {
    if (document.getElementById('phone-problem')) return;
    const d = document.createElement('div');
    d.id = 'phone-problem';
    d.style.cssText = 'position:fixed;left:12px;right:12px;top:45%;z-index:99;background:#fff7e6;color:#5a3a00;' +
      'padding:12px 14px;border-radius:14px;font:14px/1.5 sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25)';
    d.textContent = '場景開唔到 😿 ' + msg;
    (document.body || document.documentElement).append(d);
  };
  addEventListener('error', e => {
    const t = e.target;
    problem(t && t !== window && t.src ? '載入唔到：' + t.src.split('/').pop() : (e.message || '未知錯誤') + (e.filename ? '（' + e.filename.split('/').pop() + ':' + e.lineno + '）' : ''));
  }, true);
  addEventListener('unhandledrejection', e => problem(String((e.reason && (e.reason.stack || e.reason.message)) || e.reason)));
  setTimeout(() => { if (!started) problem('等咗 15 秒都未開到（部手機可能唔支援 WebGL）'); }, 15000);

  console.log('phone bridge: start', innerWidth + 'x' + innerHeight, 'dpr', devicePixelRatio);
  const A = window.AndroidCat;
  if (!A) { problem('同 app 嘅連接（AndroidCat）唔見咗'); return; }
  const listeners = {};
  const away = { x: -9999, y: -9999 };
  // a finger on the screen is the "mouse": the pets look at it and chase it
  let pointer = away, lift = null;
  const track = e => { pointer = { x: e.clientX, y: e.clientY }; clearTimeout(lift); };
  addEventListener('pointerdown', track, true);
  addEventListener('pointermove', track, true);
  addEventListener('pointerup', () => { clearTimeout(lift); lift = setTimeout(() => { pointer = away; }, 1500); }, true);

  window.__pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  window.__catEmit = (ch, data) => (listeners[ch] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });
  window.__setBackground = css => { document.documentElement.style.background = css; };

  const noop = () => {};
  window.catApi = {
    cursor: async () => pointer,
    setThrough: noop,
    getState: async () => JSON.parse(A.getState()),
    answer: done => A.answer(!!done),
    petted: () => A.petted(),
    ready: () => { started = true; A.ready(); },
    toyStatus: noop,
    diagnostics: async () => '',
    copyDiagnostics: async () => '',
    restart: noop,
    contextMenu: () => A.openSettings(),
    openSettings: () => A.openSettings(),
    saveSettings: async () => ({}),
    resetStats: async () => {},
    testReminder: noop,
    setPaused: noop,
    on: (ch, fn) => { (listeners[ch] ||= []).push(fn); },
  };
  try { window.__setBackground(A.background()); } catch (e) { problem('背景：' + e.message); }
})();
