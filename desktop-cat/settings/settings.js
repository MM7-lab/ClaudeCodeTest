'use strict';
const api = window.catApi;
const $ = id => document.getElementById(id);
const COAT_NAMES = { orange: '橙色虎斑', grey: '灰色虎斑', black: '黑貓', white: '白貓', tuxedo: '黑白貓' };
const BIRD_COLORS = [['yellow', '#ffd84a', '黃色'], ['blue', '#86c9f4', '藍色'], ['green', '#9fdc6c', '綠色'], ['pink', '#ffb6cb', '粉紅色'], ['white', '#fbfaf6', '白色']];
let S = null;

function render(s) {
  S = s;
  $('title').textContent = s.name;
  if (document.activeElement !== $('name')) $('name').value = s.name;
  document.querySelectorAll('#coats button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.coat === s.coat)));
  $('coatName').textContent = COAT_NAMES[s.coat] || '';
  $('size').value = s.size;
  const kind = s.mainPet || 'cat';
  $('mainPet').value = kind;
  $('mainHint').textContent = { cat: '', dog: '', bird: '主角就係第 1 隻雀仔，佢嘅顏色喺下面「雀仔」度揀。', pig: '主角就係豬仔，佢嘅床喺下面「豬仔」度揀。' }[kind];
  $('mainHint').hidden = !$('mainHint').textContent;
  $('breed').value = s.breed || 'classic';
  if ($('dogBreed').options.length) $('dogBreed').value = s.dogBreed || 'golden';
  $('breedRow').hidden = kind !== 'cat';
  $('dogBreedRow').hidden = kind !== 'dog';
  $('coatRow').hidden = $('coatName').hidden = kind !== 'cat' || (s.breed || 'classic') !== 'classic';
  $('dogHouse').value = s.dogHouse || 'right';
  $('office').checked = !!s.office;
  const furn = s.officeFurn || ['sofa', 'cooler', 'shelf', 'board', 'printer', 'plant'];
  document.querySelectorAll('[data-furn]').forEach(c => { c.checked = furn.includes(c.dataset.furn); c.disabled = !s.office; });
  renderWorkers(s);
  document.querySelectorAll('[data-friend]').forEach(c => { c.checked = (s.friends || []).includes(c.dataset.friend); });
  if ($('screen').options.length) $('screen').value = [...$('screen').options].some(o => o.value === s.screen) ? s.screen : 'primary';
  $('every').value = String(s.every);
  document.querySelectorAll('[data-type]').forEach(c => { c.checked = !!s.types[c.dataset.type]; });
  $('chatty').checked = s.chatty;
  $('sound').checked = s.sound;
  $('volume').value = s.volume;
  $('autostart').checked = s.autostart;
  $('tree').value = s.tree;
  $('birdCount').value = String(s.birdCount);
  renderBirds(s);
  $('cage').value = s.cage;
  $('pig').checked = !!s.pig;
  if (document.activeElement !== $('pigName')) $('pigName').value = s.pigName || '';
  $('pigBed').value = s.pigBed;
  $('toySize').value = s.toySize;
  $('forceWebGPU').checked = !!s.forceWebGPU;
  document.querySelectorAll('[data-toy]').forEach(c => { c.checked = s.toys.includes(c.dataset.toy); });
}
// one row per bird: its name and its colour
function renderBirds(s) {
  const rows = $('birdRows');
  if (rows.children.length !== 3) {
    rows.replaceChildren(...[0, 1, 2].map(i => {
      const row = document.createElement('div'), name = document.createElement('input'), colors = document.createElement('div');
      row.className = 'bird-row'; row.dataset.i = i;
      name.type = 'text'; name.maxLength = 20; name.autocomplete = 'off'; name.setAttribute('aria-label', `第 ${i + 1} 隻雀仔個名`);
      name.addEventListener('change', () => saveBird(i, { name: name.value }));
      colors.className = 'coats small'; colors.setAttribute('role', 'radiogroup'); colors.setAttribute('aria-label', `第 ${i + 1} 隻雀仔嘅顏色`);
      for (const [id, css, label] of BIRD_COLORS) {
        const b = document.createElement('button');
        b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.color = id; b.title = label; b.style.setProperty('--c', css);
        b.addEventListener('click', () => saveBird(i, { color: id }));
        colors.append(b);
      }
      row.append('🐤', name, colors);
      return row;
    }));
  }
  [...rows.children].forEach((row, i) => {
    const b = s.birds[i];
    row.hidden = i >= s.birdCount;
    const name = row.querySelector('input');
    if (document.activeElement !== name) name.value = b.name;
    row.querySelectorAll('[data-color]').forEach(x => x.setAttribute('aria-checked', String(x.dataset.color === b.color)));
  });
}
function saveBird(i, patch) {
  const birds = S.birds.map((b, k) => (k === i ? { ...b, ...patch } : b));
  save({ birds });
}
// office mode: who sits at each desk (the main pet, the pig, any friend that's out)
let breedList = [];
function renderWorkers(s) {
  const main = { cat: '貓貓', dog: '狗狗', bird: '雀仔', pig: '豬仔' }[s.mainPet || 'cat'];
  const opts = [['auto', '自動揀'], ['main', `主角（${main}：${s.name}）`]];
  if (s.pig && s.mainPet !== 'pig') opts.push(['pig', `豬仔（${s.pigName}）`]);
  for (const id of s.friends || []) { const b = breedList.find(x => x.id === id); if (b) opts.push([id, b.label]); }
  ['worker0', 'worker1'].forEach((sel, i) => {
    const el = $(sel), want = (s.workers || [])[i] || 'auto';
    if (document.activeElement !== el) el.replaceChildren(...opts.map(([v, t]) => new Option(t, v)));
    el.value = opts.some(o => o[0] === want) ? want : 'auto';
    el.disabled = !s.office;
  });
}
// breeds: the main cat's choices, and the friend checkboxes
function buildBreeds(list) {
  breedList = list;
  for (const b of list.filter(b => b.kind === 'cat')) $('breed').append(new Option(b.label, b.id));
  for (const b of list.filter(b => b.kind === 'dog')) $('dogBreed').append(new Option(b.label, b.id));
  for (const kind of ['dog', 'cat']) {
    $(kind + 'Checks').replaceChildren(...list.filter(b => b.kind === kind).map(b => {
      const label = document.createElement('label'), box = document.createElement('input');
      box.type = 'checkbox'; box.dataset.friend = b.id;
      box.addEventListener('change', () => save({ friends: [...document.querySelectorAll('[data-friend]')].filter(c => c.checked).map(c => c.dataset.friend) }));
      label.append(box, ' ' + b.label);
      return label;
    }));
  }
}
// screens can come and go: rebuild the list when it changes
let screensKey = '';
function buildScreens(state) {
  const key = JSON.stringify(state.screens);
  if (key === screensKey) return;
  screensKey = key;
  const sel = $('screen');
  sel.replaceChildren(new Option('主螢幕', 'primary'),
    ...state.screens.filter(d => !d.primary).map(d => new Option(d.label, d.id)),
    new Option('跟住滑鼠', 'follow'));
  if (state.screens.length < 2) sel.lastChild.disabled = true;
  if (S) render(S);
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
  buildScreens(state);
  $('status').textContent = state.status;
  $('btnPause').textContent = state.timer.running ? '暫停提醒' : '繼續提醒';
  renderStats(state.stats);
  return state;
}

$('name').addEventListener('change', () => save({ name: $('name').value }));
$('coats').addEventListener('click', e => { const b = e.target.closest('[data-coat]'); if (b) save({ coat: b.dataset.coat }); });
$('size').addEventListener('change', () => save({ size: Number($('size').value) }));
$('breed').addEventListener('change', () => save({ breed: $('breed').value }));
$('mainPet').addEventListener('change', () => save({ mainPet: $('mainPet').value }));
$('dogBreed').addEventListener('change', () => save({ dogBreed: $('dogBreed').value }));
$('dogHouse').addEventListener('change', () => save({ dogHouse: $('dogHouse').value }));
$('office').addEventListener('change', () => save({ office: $('office').checked }));
document.querySelectorAll('[data-furn]').forEach(c => c.addEventListener('change', () =>
  save({ officeFurn: [...document.querySelectorAll('[data-furn]')].filter(x => x.checked).map(x => x.dataset.furn) })));
for (const sel of ['worker0', 'worker1']) $(sel).addEventListener('change', () => save({ workers: [$('worker0').value, $('worker1').value] }));
$('screen').addEventListener('change', () => save({ screen: $('screen').value }));
$('every').addEventListener('change', () => save({ every: Number($('every').value) }));
document.querySelectorAll('[data-type]').forEach(c => c.addEventListener('change', () => save({ types: { [c.dataset.type]: c.checked } })));
$('chatty').addEventListener('change', () => save({ chatty: $('chatty').checked }));
$('sound').addEventListener('change', () => save({ sound: $('sound').checked }));
$('volume').addEventListener('change', () => save({ volume: Number($('volume').value) }));
$('autostart').addEventListener('change', () => save({ autostart: $('autostart').checked }));
$('tree').addEventListener('change', () => save({ tree: $('tree').value }));
$('birdCount').addEventListener('change', () => save({ birdCount: Number($('birdCount').value) }));
$('cage').addEventListener('change', () => save({ cage: $('cage').value }));
$('pig').addEventListener('change', () => save({ pig: $('pig').checked }));
$('pigName').addEventListener('change', () => save({ pigName: $('pigName').value }));
$('pigBed').addEventListener('change', () => save({ pigBed: $('pigBed').value }));
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

refresh().then(state => { buildToyChecks(state.toyList); buildBreeds(state.breeds); render(state.settings); });
setInterval(refresh, 1000);
