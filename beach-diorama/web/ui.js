// Buttons and the right-click menu of the web preview. All behaviour lives in renderer.js;
// this only talks to the shim (web/shim.js).
const web = window.dioramaWeb;

const modeButtons = [...document.querySelectorAll('.bar [data-mode]')];
const mapButtons = [...document.querySelectorAll('.bar [data-map]')];

function showMode(mode) {
  document.documentElement.dataset.look = mode;
  for (const b of modeButtons) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
}
function chooseMode(mode) {
  web.setMode(mode);
  showMode(mode);
}

for (const b of mapButtons) b.setAttribute('aria-pressed', String(b.dataset.map === web.map));
for (const b of mapButtons) b.addEventListener('click', () => web.setMap(b.dataset.map));
for (const b of modeButtons) b.addEventListener('click', () => chooseMode(b.dataset.mode));
document.getElementById('reset').addEventListener('click', () => web.resetView());

// the renderer applies the remembered look on start; mirror it in the page
window.diorama.getState().then((s) => showMode(s.mode));

// right-click menu (opened by the renderer when the cursor is over the diorama)
const menu = document.getElementById('menu');
let lastPointer = { x: 0, y: 0 };
window.addEventListener('contextmenu', (e) => {
  lastPointer = { x: e.clientX, y: e.clientY };
});
document.addEventListener('diorama:menu', () => {
  const r = menu.parentElement.getBoundingClientRect();
  menu.style.left = Math.max(0, Math.min(lastPointer.x - r.left, r.width - 190)) + 'px';
  menu.style.top = Math.max(0, Math.min(lastPointer.y - r.top, r.height - 220)) + 'px';
  menu.hidden = false;
});
menu.addEventListener('click', (e) => {
  const item = e.target.closest('button');
  if (!item) return;
  if (item.dataset.mode) chooseMode(item.dataset.mode);
  if (item.dataset.map) web.setMap(item.dataset.map);
  if (item.dataset.action === 'reset') web.resetView();
  menu.hidden = true;
});
window.addEventListener('pointerdown', (e) => {
  if (!menu.contains(e.target)) menu.hidden = true;
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') menu.hidden = true;
});
