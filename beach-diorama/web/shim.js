// Stands in for the Electron preload on the web preview page: the same renderer.js runs on
// both. State (look and map) is remembered in localStorage when the browser allows it.

const MODES = ['day', 'sunset', 'night'];
const MAPS = ['hk-mini', 'kowloon-bay'];

const read = (key, allowed, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private window or blocked storage: nothing to remember
  }
};

// The map can also be chosen with the URL hash (#kowloon-bay or #hk-mini).
const hashMap = location.hash.slice(1);
const map = MAPS.includes(hashMap) ? hashMap : read('diorama-map', MAPS, 'hk-mini');
const listeners = { mode: [], resetView: [] };

let currentMode = read('diorama-mode', MODES, 'day');

window.diorama = {
  fps: 60,
  getState: async () => ({ mode: currentMode, moveMode: false, map }),
  setInteractive() {}, // a web page has no click-through
  showContextMenu() {
    document.dispatchEvent(new CustomEvent('diorama:menu'));
  },
  onMode: (cb) => listeners.mode.push(cb),
  onMoveMode() {},
  onResetView: (cb) => listeners.resetView.push(cb),
  onCursor() {},
};

/** Called by the page's own buttons and context menu. */
window.dioramaWeb = {
  MODES,
  MAPS,
  map,
  setMode(mode) {
    currentMode = mode;
    write('diorama-mode', mode);
    for (const cb of listeners.mode) cb(mode);
  },
  resetView() {
    for (const cb of listeners.resetView) cb();
  },
  setMap(next) {
    if (!MAPS.includes(next) || next === map) return;
    write('diorama-map', next);
    location.hash = next;
    location.reload();
  },
};
