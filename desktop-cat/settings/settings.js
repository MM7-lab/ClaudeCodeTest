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
}
function renderStats(st) {
  $('stWater').textContent = st.water;
  $('stRest').textContent = st.rest;
  $('stToilet').textContent = st.toilet;
  $('stPets').textContent = st.pets;
}
async function save(patch) { render(await api.saveSettings(patch)); }
async function refresh() {
  const state = await api.getState();
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
$('btnPause').addEventListener('click', async () => { const s = await api.getState(); api.setPaused(s.timer.running); setTimeout(refresh, 100); });
$('btnTest').addEventListener('click', () => { api.testReminder(); setTimeout(refresh, 100); });
$('btnReset').addEventListener('click', async () => renderStats(await api.resetStats()));
api.on('settings', render);
api.on('stats', renderStats);

refresh().then(state => render(state.settings));
setInterval(refresh, 1000);
