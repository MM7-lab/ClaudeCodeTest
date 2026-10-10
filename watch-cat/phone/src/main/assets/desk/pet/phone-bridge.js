// Lets the desktop app's pet page (pet.js) run inside the phone app: it stands in for the
// Electron bridge (preload.js), talking to the app through window.AndroidCat.
(() => {
  const A = window.AndroidCat;
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
    ready: () => A.ready(),
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
  window.__setBackground(A.background());
})();
