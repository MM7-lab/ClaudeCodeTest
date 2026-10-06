'use strict';
const api = window.catApi;
const $ = id => document.getElementById(id);
const COAT_NAMES = { orange: '橙色虎斑', grey: '灰色虎斑', black: '黑貓', white: '白貓', tuxedo: '黑白貓' };
let S = null;

function render(s) {
  S = s;
  $('title').textContent = s.name;
  if (document.activeElement !== $('name')) $('name').value = s.name;
  document.querySelectorAll('#coats button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.coat === s.coat)));
  $('coatName').textContent = COAT_NAMES[s.coat] || '';
  $('size').value = s.size;
  $('every').value = String(s.every);
  document.querySelectorAll('[data-type]').forEach(c => { c.checked = !!s.types[c.dataset.type]; });
  $('chatty').checked = s.chatty;
  $('sound').checked = s.sound;
  $('volume').value = s.volume;
  $('autostart').checked = s.autostart;
  $('tree').value = s.tree;
  $('toySize').value = s.toySize;
  $('forceWebGPU').checked = !!s.forceWebGPU;
  document.querySelectorAll('[data-toy]').forEach(c => { c.checked = s.toys.includes(c.dataset.toy); });
}
function buildToyChecks(list) {
  $('toyChecks').replaceChildren(...list.map(t => {
    const label = document.createElement('label'), box = document.createElement('input');
    box.type = 'checkbox'; box.dataset.toy = t.id;
    box.addEventListener('change', () => {
      const on = [...document.querySelectorAll('[data-toy]')].filter(c => c.checked).map(c => c.dataset.toy);
      save({ toys: on });
    });
    label.append(box, ' 🧸 ' + t.label);
    return label;
  }));
}
function renderStats(st) {
  $('stWater').textContent = st.water;
  $('stRest').textContent = st.rest;
  $('stToilet').textContent = st.toilet;
  $('stPets').textContent = st.pets;
}
async function save(patch) { render(await api.saveSettings(patch)); }
let startedForced = null;
function renderToyStatus(state) {
  const names = Object.fromEntries(state.toyList.map(t => [t.id, t.label]));
  const rows = state.settings.toys.map(id => {
    const st = state.toyStatus[id] || { state: 'loading' };
    const li = document.createElement('li'), name = document.createElement('span'), v = document.createElement('span');
    name.textContent = '🧸 ' + names[id];
    v.className = st.state === 'ready' ? 'ok' : st.state === 'failed' ? 'bad' : 'wait';
    v.textContent = st.state === 'ready' ? '出咗嚟 ✓' : st.state === 'failed' ? '出唔到' : '載入中…';
    if (st.msg) v.title = st.msg;
    li.append(name, v);
    return li;
  });
  const gpu = document.createElement('li');
  gpu.innerHTML = '<span>WebGPU 技術資料</span><span></span>';
  gpu.lastChild.textContent = state.webgpu;
  gpu.className = 'wait';
  $('toyStatus').replaceChildren(...rows, gpu);
  if (startedForced === null) startedForced = !!state.settings.forceWebGPU;
  $('restartRow').hidden = startedForced === !!state.settings.forceWebGPU;
}
async function refresh() {
  const state = await api.getState();
  renderToyStatus(state);
  $('status').textContent = state.status;
  $('btnPause').textContent = state.timer.running ? '暫停提醒' : '繼續提醒';
  renderStats(state.stats);
  return state;
}

$('name').addEventListener('change', () => save({ name: $('name').value }));
$('coats').addEventListener('click', e => { const b = e.target.closest('[data-coat]'); if (b) save({ coat: b.dataset.coat }); });
$('size').addEventListener('change', () => save({ size: Number($('size').value) }));
$('every').addEventListener('change', () => save({ every: Number($('every').value) }));
document.querySelectorAll('[data-type]').forEach(c => c.addEventListener('change', () => save({ types: { [c.dataset.type]: c.checked } })));
$('chatty').addEventListener('change', () => save({ chatty: $('chatty').checked }));
$('sound').addEventListener('change', () => save({ sound: $('sound').checked }));
$('volume').addEventListener('change', () => save({ volume: Number($('volume').value) }));
$('autostart').addEventListener('change', () => save({ autostart: $('autostart').checked }));
$('tree').addEventListener('change', () => save({ tree: $('tree').value }));
$('toySize').addEventListener('change', () => save({ toySize: Number($('toySize').value) }));
$('forceWebGPU').addEventListener('change', () => save({ forceWebGPU: $('forceWebGPU').checked }));
$('btnRestart').addEventListener('click', () => api.restart());
$('btnCopyDiag').addEventListener('click', async () => {
  $('diag').textContent = await api.copyDiagnostics();
  $('btnCopyDiag').textContent = '複製咗 ✓';
  setTimeout(() => { $('btnCopyDiag').textContent = '複製診斷資料'; }, 2000);
});
const showDiag = async () => { $('diag').textContent = await api.diagnostics(); };
showDiag();
setInterval(showDiag, 5000);
$('btnPause').addEventListener('click', async () => { const s = await api.getState(); api.setPaused(s.timer.running); setTimeout(refresh, 100); });
$('btnTest').addEventListener('click', () => { api.testReminder(); setTimeout(refresh, 100); });
$('btnReset').addEventListener('click', async () => renderStats(await api.resetStats()));
api.on('settings', render);
api.on('stats', renderStats);

refresh().then(state => { buildToyChecks(state.toyList); render(state.settings); });
setInterval(refresh, 1000);
