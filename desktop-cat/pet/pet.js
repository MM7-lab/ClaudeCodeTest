import * as THREE from '../node_modules/three/build/three.module.js';
import { Cat } from './cat.js';
import { makeSound } from './sound.js';

const api = window.catApi;
const $ = id => document.getElementById(id);
const canvas = $('scene'), bubble = $('bubble'), bubbleText = $('bubbleText'), bubbleActions = $('bubbleActions');
const fx = $('fx'), zzz = $('zzz');

const MIN = 60 * 1000;
const CHAT = ['你做得好好呀！加油 💪', '我喺度陪住你 🐾', '呼嚕呼嚕…', '一樣一樣嚟，唔使急 ✨', '記得深呼吸 🌿',
  '今日都好努力呀 🌼', '我信你得嘅 💛', '有咩唔開心，摸吓我啦 🐱'];
const OUCH = ['嚇死我喇！😾', '喵！好高呀 😿', '安全着陸 😼'];

let S = { name: '麻糬', coat: 'orange', size: 1, chatty: true, sound: true, volume: 0.6 };
const sound = makeSound(() => S);
const pick = a => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- scene ----------
// Orthographic camera in screen pixels, tilted down a little so the cat reads as 3D.
// The floor (y = 0) sits BOTTOM pixels above the bottom of the work area.
const TILT = 0.3, BOTTOM = 34;
let W = innerWidth, H = innerHeight;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
} catch (e) {
  bubbleText.textContent = '部電腦開唔到 3D 顯示，貓貓出唔到嚟 😿 試吓更新顯示卡驅動程式。';
  bubble.hidden = false;
  bubble.style.transform = `translate(${innerWidth / 2 - 130}px, ${innerHeight - 120}px)`;
  throw e;
}
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0xcdb8a6, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(-0.6, 1, 0.9);
scene.add(sun);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 8000);
camera.position.set(0, Math.sin(TILT) * 3000, Math.cos(TILT) * 3000);
camera.lookAt(0, 0, 0);
function resize() {
  W = innerWidth; H = innerHeight;
  Object.assign(camera, { left: -W / 2, right: W / 2, top: H - BOTTOM, bottom: -BOTTOM });
  camera.updateProjectionMatrix();
  renderer.setSize(W, H, false);
  const [x0, x1] = bounds();
  ai.x = clamp(ai.x, x0, x1);
}

const shadow = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.35)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  scene.add(m);
  return m;
})();

const cat = new Cat();
scene.add(cat.root);

// ---------- behaviour state ----------
const FRONT = -Math.PI / 2; // yaw that faces the screen
const ai = {
  mode: 'fall', t: 0, dur: 0, data: {}, x: 0, y: 0, z: 0, vx: 0, vy: 0, yaw: FRONT, yawTarget: FRONT,
  awakeSince: Date.now(), squash: 0, happy: 0, chaseCooldown: 0, chatAt: Date.now() + rand(8, 14) * MIN,
  glance: { yaw: 0, pitch: 0, t: 0 }, strokeDist: 0, strokeCooldown: 0,
};
let pending = null; // reminder waiting for an answer
let cursor = null, cursorSpeed = 0, rect = null, captured = false, drag = null;

const bounds = () => { const m = 80 * S.size; return [-W / 2 + m, W / 2 - m]; };
const facing = () => (Math.cos(ai.yaw) >= 0 ? 1 : -1);
function faceUser(side = facing()) { ai.yawTarget = FRONT + side * 0.55; }
function faceToward(dx, dz) { ai.yawTarget = Math.atan2(-dz, dx); }
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function go(mode, data = {}) {
  ai.mode = mode; ai.t = 0; ai.dur = data.dur ?? 0; ai.data = data;
  cat.swat = 0;
  const pose = { sit: 'sit', remind: 'sit', sleep: 'loaf', groom: 'groom', stretch: 'stretch', held: 'held',
                 fall: 'leap', jump: 'leap', yawn: data.pose || 'sit' }[mode] || 'stand';
  cat.setPose(pose);
  zzz.hidden = mode !== 'sleep';
}

function decide() {
  const awakeMin = (Date.now() - ai.awakeSince) / MIN;
  const options = [
    ['walk', 30], ['idle', 12], ['sit', 16], ['groom', 8], ['stretch', 5], ['run', 3], ['jump', 4], ['look', 8],
    ['sleep', awakeMin > 6 ? 40 : awakeMin > 2 ? 6 : 0],
  ];
  let r = Math.random() * options.reduce((s, o) => s + o[1], 0);
  for (const [name, w] of options) { if ((r -= w) < 0) return start(name); }
  start('idle');
}
function start(name) {
  const [x0, x1] = bounds();
  switch (name) {
    case 'walk': {
      let tx = rand(x0, x1);
      if (Math.abs(tx - ai.x) < 120) tx = clamp(ai.x + (Math.random() < 0.5 ? -1 : 1) * rand(150, 400), x0, x1);
      go('walk', { tx, tz: rand(-50, 50) });
      break;
    }
    case 'run':
      go('run', { tx: ai.x > 0 ? x0 + rand(0, 120) : x1 - rand(0, 120), tz: rand(-30, 30), laps: 2 + Math.floor(rand(0, 2)) });
      break;
    case 'idle': go('idle', { dur: rand(2, 5) }); faceUser(); break;
    case 'sit': go('sit', { dur: rand(6, 16) }); faceUser(); break;
    case 'look': go('sit', { dur: rand(4, 8) }); ai.yawTarget = FRONT; break;
    case 'groom': go('groom', { dur: rand(4, 7) }); faceUser(); break;
    case 'stretch': go('stretch', { dur: 2.4 }); break;
    case 'jump': ai.vy = rand(380, 480); ai.vx = rand(-90, 90); go('jump'); break;
    case 'sleep': go('sleep', { dur: rand(40, 150) }); faceUser(); break;
    default: go('idle', { dur: 2 });
  }
}
function wake(greet) {
  ai.awakeSince = Date.now();
  go('yawn', { pose: 'loaf', then: 'stretch' });
  if (greet) { sound.chirp(); say('喵…我醒咗喇 😺', 3000); }
}

// Walk toward (tx, tz); returns true on arrival. Turns on the spot before moving.
function walkTo(dt, tx, tz, speed) {
  const dx = tx - ai.x, dz = tz - ai.z, dist = Math.hypot(dx, dz);
  if (dist < 3) return true;
  faceToward(dx, dz);
  const ahead = Math.max(0, Math.cos(angleDiff(ai.yawTarget, ai.yaw)));
  const step = Math.min(dist, speed * S.size * dt * ahead);
  ai.x += dx / dist * step; ai.z += dz / dist * step;
  const amp = speed > 150 ? 1 : 0.7;
  cat.gait.amp += (amp - cat.gait.amp) * Math.min(1, dt * 6);
  cat.gait.phase += step / (9 * S.size) + dt * (1 - ahead) * 5;
  return false;
}
function physics(dt) {
  ai.vy -= 1800 * dt;
  ai.y += ai.vy * dt; ai.x += ai.vx * dt;
  const [x0, x1] = bounds();
  if (ai.x < x0) { ai.x = x0; ai.vx = Math.abs(ai.vx) * 0.5; }
  if (ai.x > x1) { ai.x = x1; ai.vx = -Math.abs(ai.vx) * 0.5; }
  if (Math.abs(ai.vx) > 40) faceToward(ai.vx, 0);
  if (ai.y <= 0 && ai.vy < 0) {
    const force = Math.min(1, -ai.vy / 1400);
    ai.y = 0; ai.vy = 0; ai.vx = 0;
    ai.squash = 0.08 + force * 0.25;
    return force;
  }
  return -1;
}

function update(dt) {
  ai.t += dt;
  const d = ai.data;
  cat.gait.amp *= ['walk', 'run', 'chase', 'come', 'held'].includes(ai.mode) ? 1 : Math.exp(-dt * 8);
  switch (ai.mode) {
    case 'idle': case 'sit':
      if (ai.t > ai.dur) decide();
      break;
    case 'groom':
      cat.extraHead.pitch = Math.sin(ai.t * 7) * 0.12;
      if (ai.t > ai.dur) decide();
      break;
    case 'walk':
      if (walkTo(dt, d.tx, d.tz, 60)) decide();
      break;
    case 'come':
      if (walkTo(dt, d.tx, 0, 120)) { go('sit', { dur: 8 }); ai.yawTarget = FRONT; }
      break;
    case 'run':
      if (walkTo(dt, d.tx, d.tz, 300)) {
        const [x0, x1] = bounds();
        if (--d.laps > 0) d.tx = d.tx < 0 ? x1 - rand(0, 120) : x0 + rand(0, 120);
        else { go('idle', { dur: 2 }); faceUser(); }
      }
      break;
    case 'stretch':
      if (ai.t > ai.dur) { go('idle', { dur: rand(1, 3) }); faceUser(); }
      break;
    case 'yawn': {
      const k = clamp(ai.t / 1.6, 0, 1);
      cat.target.mouth = ai.t < 1.6 ? Math.sin(k * Math.PI) : 0;
      cat.target.eyeOpen = ai.t < 1.6 ? 0.2 : 1;
      if (ai.t > 2) d.then ? start(d.then) : decide();
      break;
    }
    case 'sleep':
      if (ai.t > ai.dur) wake(false);
      break;
    case 'jump': case 'fall': {
      const landed = physics(dt);
      if (landed < 0) break;
      if (pending) { go('remind'); ai.yawTarget = FRONT; }
      else if (d.welcome) { go('sit', { dur: 5 }); ai.yawTarget = FRONT; say(`我係${S.name}，今日陪你做嘢 🐾`, 6000); sound.meow(); }
      else if (ai.mode === 'fall' && landed > 0.45) { go('sit', { dur: 3 }); faceUser(); say(pick(OUCH), 3000); }
      else { go('idle', { dur: rand(1, 2) }); faceUser(); }
      break;
    }
    case 'held':
      cat.gait.phase += dt * 9;
      cat.gait.amp = 0.35;
      ai.yawTarget = FRONT;
      break;
    case 'remind':
      if (ai.y > 0 || ai.vy > 0) physics(dt);
      ai.yawTarget = FRONT;
      cat.target.tailSpeed = 6; cat.target.tailAmp = 0.3;
      break;
    case 'chase': updateChase(dt); break;
  }
  if (ai.chaseCooldown > 0) ai.chaseCooldown -= dt;
  maybeChase();
  maybeChat();
}

// ---------- playing with the mouse ----------
const cursorWorldX = () => cursor.x - W / 2;
const cursorNearFloor = () => cursor && cursor.y > H - 240 && cursor.y < H + 20 && cursor.x > 0 && cursor.x < W;
function maybeChase() {
  if (pending || drag || ai.chaseCooldown > 0 || !['idle', 'sit', 'walk'].includes(ai.mode)) return;
  if (!cursorNearFloor() || cursorSpeed < 250 || Math.abs(cursorWorldX() - ai.x) > 500) return;
  if (Math.random() < 0.01) { go('chase', { state: 'run' }); ai.chaseCooldown = 30; }
}
function updateChase(dt) {
  const d = ai.data;
  if (!cursorNearFloor() || ai.t > 15) { go('sit', { dur: 4 }); faceUser(); return; }
  const [x0, x1] = bounds();
  const cx = clamp(cursorWorldX(), x0, x1), side = cx >= ai.x ? 1 : -1;
  const gap = Math.abs(cx - ai.x);
  if (gap > 90 * S.size) {
    if (d.state !== 'run') { cat.setPose('stand'); d.state = 'run'; }
    walkTo(dt, cx - side * 60 * S.size, 0, 170);
  } else {
    if (d.state !== 'crouch') { cat.setPose('crouch'); d.state = 'crouch'; }
    faceToward(side, 0);
    cat.swat = cursorSpeed > 120 ? cat.swat + dt : 0;
    if (cursorSpeed > 500 && Math.random() < 0.02) { ai.vy = 380; ai.vx = side * 160; go('jump'); }
  }
}
function maybeChat() {
  if (Date.now() < ai.chatAt) return;
  ai.chatAt = Date.now() + rand(10, 18) * MIN;
  if (S.chatty && !pending && ai.mode !== 'sleep' && bubble.hidden) { say(pick(CHAT), 6000); ai.happy = 1.2; }
}

// Head follows the mouse when it's close; otherwise glances around now and then.
function updateGaze(dt, headScreen) {
  let yaw = 0, pitch = 0;
  const awake = !['sleep', 'held', 'yawn', 'groom', 'stretch'].includes(ai.mode);
  if (awake && cursor && headScreen && Math.hypot(cursor.x - headScreen.x, cursor.y - headScreen.y) < 450) {
    const want = FRONT + clamp((cursor.x - headScreen.x) / 450, -1, 1) * 0.9;
    yaw = clamp(angleDiff(want, ai.yaw), -1.1, 1.1);
    pitch = -clamp((headScreen.y - cursor.y) / 400, -0.6, 0.6) * 0.5;
  } else if (awake && ['idle', 'sit', 'remind'].includes(ai.mode)) {
    const g = ai.glance;
    if ((g.t -= dt) <= 0) { g.t = rand(1.5, 4); g.yaw = rand(-0.6, 0.6); g.pitch = rand(-0.15, 0.1); if (Math.random() < 0.3) cat.twitch = 1; }
    yaw = g.yaw; pitch = g.pitch;
  }
  if (ai.mode === 'groom') return;
  const k = 1 - Math.exp(-dt * 6);
  cat.extraHead.yaw += (yaw - cat.extraHead.yaw) * k;
  cat.extraHead.pitch += (pitch - cat.extraHead.pitch) * k;
}

// ---------- speech bubble & effects ----------
let bubbleTimer = null;
function say(text, ms = 5000) {
  if (pending) return;
  clearTimeout(bubbleTimer);
  bubbleText.textContent = text;
  bubbleActions.hidden = true;
  bubble.hidden = false;
  bubbleTimer = setTimeout(() => { bubble.hidden = true; }, ms);
}
function ask(text) {
  clearTimeout(bubbleTimer);
  bubbleText.textContent = text;
  bubbleActions.hidden = false;
  bubble.hidden = false;
}
function hearts(n = 3) {
  if (!anchor) return;
  for (let i = 0; i < n; i++) {
    const h = document.createElement('span');
    h.className = 'heart';
    h.textContent = pick(['💗', '💕', '✨', '💗']);
    h.style.left = (anchor.x + rand(-25, 25)) + 'px';
    h.style.top = (anchor.y + 10) + 'px';
    h.style.animationDelay = (i * 150) + 'ms';
    fx.append(h);
    setTimeout(() => h.remove(), 2000);
  }
}
function petCat() {
  if (ai.mode === 'sleep') { wake(true); return; }
  hearts(); sound.purr(); ai.happy = 1.8;
  api.petted();
  if (['walk', 'run', 'idle'].includes(ai.mode)) { go('sit', { dur: 5 }); ai.yawTarget = FRONT; }
}

// ---------- reminders from the main process ----------
api.on('reminder', r => {
  pending = r;
  if (ai.mode === 'sleep') ai.awakeSince = Date.now();
  if (ai.mode !== 'held' && ai.mode !== 'fall') { go('remind'); ai.vy = 300; }
  ai.yawTarget = FRONT;
  ask(r.text);
  sound.meow(2);
});
api.on('nag', () => { if (ai.mode === 'remind') ai.vy = 300; sound.meow(2); });
api.on('reminder-end', r => {
  pending = null;
  if (r.done) { hearts(); sound.purr(); ai.happy = 1.8; }
  say(r.text, 4500);
  if (ai.mode === 'remind') { go('sit', { dur: 4 }); faceUser(); }
});
api.on('say', r => say(r.text, 5000));
api.on('come-here', () => {
  const [x0, x1] = bounds();
  const tx = cursor && cursor.x >= 0 && cursor.x <= W ? clamp(cursorWorldX(), x0, x1) : 0;
  if (ai.mode === 'sleep') ai.awakeSince = Date.now();
  go('come', { tx });
  say('喵？叫我呀？😺', 3000);
});
api.on('settings', s => applySettings(s));
$('btnDone').addEventListener('click', () => api.answer(true));
$('btnLater').addEventListener('click', () => api.answer(false));

function applySettings(s) {
  S = { ...S, ...s };
  cat.setCoat(S.coat);
}

// ---------- mouse: hover, pet, drag & drop ----------
// The window ignores the mouse (clicks go to whatever is underneath) except
// while the pointer is over the cat or its speech bubble.
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2(), hit = new THREE.Vector3();
function overCat(x, y) {
  if (!rect || x < rect.l - 4 || x > rect.r + 4 || y < rect.t - 4 || y > rect.b + 4) return false;
  ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(cat.root, true).length > 0;
}
function overBubble(x, y) {
  if (bubble.hidden) return false;
  const b = bubble.getBoundingClientRect();
  return x > b.left - 6 && x < b.right + 6 && y > b.top - 6 && y < b.bottom + 12;
}
function updateCapture() {
  const want = !!drag || (cursor && (overCat(cursor.x, cursor.y) || overBubble(cursor.x, cursor.y)));
  if (want !== captured) {
    captured = want;
    api.setThrough(!want);
    canvas.style.cursor = want ? 'grab' : '';
  }
}
let lastCursor = null, lastCursorT = 0;
setInterval(async () => {
  const c = await api.cursor();
  if (!c) return;
  const now = performance.now();
  if (lastCursor) {
    const moved = Math.hypot(c.x - lastCursor.x, c.y - lastCursor.y);
    cursorSpeed = cursorSpeed * 0.6 + (moved / Math.max(0.001, (now - lastCursorT) / 1000)) * 0.4;
    // Moving the pointer back and forth over the cat counts as stroking it.
    if (captured && !drag && !bubble.contains(document.elementFromPoint(c.x, c.y)) && overCat(c.x, c.y)) {
      ai.strokeDist += moved;
      if (ai.strokeDist > 300 && ai.strokeCooldown <= 0 && ai.mode !== 'sleep') {
        ai.strokeDist = 0; ai.strokeCooldown = 3; hearts(2); sound.purr(); ai.happy = 1.5;
      }
    } else ai.strokeDist = 0;
  }
  lastCursor = c; lastCursorT = now; cursor = c;
}, 33);

function pointerWorld(e) {
  ndc.set(e.clientX / W * 2 - 1, -(e.clientY / H) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -ai.z), hit);
}
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0 || !overCat(e.clientX, e.clientY)) return;
  canvas.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, moved: false, vx: 0, vy: 0, lx: 0, ly: 0, lt: performance.now(), prevMode: ai.mode };
  const p = pointerWorld(e);
  if (p) { drag.lx = p.x; drag.ly = p.y; }
});
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
  if (!drag.moved) {
    drag.moved = true;
    canvas.style.cursor = 'grabbing';
    if (ai.mode === 'sleep') ai.awakeSince = Date.now();
    go('held');
    sound.meow();
  }
  const p = pointerWorld(e);
  if (!p) return;
  const now = performance.now(), dt = Math.max(0.001, (now - drag.lt) / 1000);
  drag.vx = drag.vx * 0.5 + ((p.x - drag.lx) / dt) * 0.5;
  drag.vy = drag.vy * 0.5 + ((p.y - drag.ly) / dt) * 0.5;
  drag.lx = p.x; drag.ly = p.y; drag.lt = now;
  const [x0, x1] = bounds();
  ai.x = clamp(p.x, x0, x1);
  ai.y = Math.max(0, p.y - 62 * S.size);
});
function endDrag() {
  if (!drag) return;
  const d = drag;
  drag = null;
  canvas.style.cursor = 'grab';
  if (!d.moved) { petCat(); return; }
  ai.vx = clamp(d.vx, -900, 900);
  ai.vy = clamp(d.vy, -600, 900);
  go('fall');
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('contextmenu', e => { e.preventDefault(); if (overCat(e.clientX, e.clientY)) api.contextMenu(); });

// ---------- frame loop ----------
const box = new THREE.Box3(), v = new THREE.Vector3();
let anchor = null;
function toScreen(p) { v.copy(p).project(camera); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H }; }
function measure() {
  cat.root.updateMatrixWorld(true);
  box.setFromObject(cat.root);
  let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
  for (let i = 0; i < 8; i++) {
    const s = toScreen(v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
    l = Math.min(l, s.x); r = Math.max(r, s.x); t = Math.min(t, s.y); b = Math.max(b, s.y);
  }
  rect = { l, r, t, b, cx: (l + r) / 2 };
  // Speech bubble and Zzz hang off the ear tips rather than the loose bounding box.
  const tips = cat.ears.map(e => toScreen(e.localToWorld(v.set(0, 16, 0))));
  const head = toScreen(cat.neck.localToWorld(v.set(10, 10, 0)));
  anchor = { x: head.x, y: Math.min(tips[0].y, tips[1].y) };
}
function placeOverlays() {
  if (!bubble.hidden) {
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    const left = clamp(anchor.x - bw / 2, 8, W - bw - 8);
    const top = Math.max(8, anchor.y - bh - 16);
    bubble.style.transform = `translate(${left}px, ${top}px)`;
    bubble.style.setProperty('--arrow-x', clamp(anchor.x - left, 20, bw - 20) + 'px');
  }
  if (!zzz.hidden) zzz.style.transform = `translate(${anchor.x + 14}px, ${anchor.y + 6}px)`;
}

let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000;
  last = now;
  // Calm moments render at ~30 fps to go easy on laptops.
  acc += raw;
  const calm = ['sleep', 'sit', 'idle', 'groom', 'remind'].includes(ai.mode) && !drag;
  if (calm && acc < 1 / 30) return;
  const dt = Math.min(0.05, acc);
  acc = 0;

  update(dt);
  const headScreen = anchor ? { x: anchor.x, y: anchor.y + 30 * S.size } : null;
  updateGaze(dt, headScreen);
  if (ai.happy > 0) {
    ai.happy -= dt;
    cat.target.eyeOpen = ai.happy > 0 ? 0.12 : cat.baseTarget.eyeOpen;
  }
  if (ai.strokeCooldown > 0) ai.strokeCooldown -= dt;
  ai.yaw += angleDiff(ai.yawTarget, ai.yaw) * (1 - Math.exp(-dt * 7));

  cat.root.position.set(ai.x, ai.y, ai.z);
  cat.root.rotation.y = ai.yaw;
  cat.root.scale.setScalar(S.size);
  ai.squash *= Math.exp(-dt * 7);
  const sq = ai.squash * Math.cos(ai.t * 25);
  cat.figure.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
  cat.update(dt);

  const lift = clamp(ai.y / 500, 0, 0.7);
  const ss = 115 * S.size * (1 - lift);
  shadow.position.set(ai.x + 5 * S.size, 0.5, ai.z);
  shadow.scale.set(ss, ss * 0.55, 1);
  shadow.material.opacity = 1 - lift;

  renderer.render(scene, camera);
  measure();
  placeOverlays();
  updateCapture();
}

// ---------- start ----------
api.getState().then(state => {
  applySettings(state.settings);
  resize();
  const [x0, x1] = bounds();
  ai.x = rand(x0, x1) * 0.6;
  ai.y = H * 0.55;
  go('fall', { welcome: true });
  requestAnimationFrame(frame);
});
addEventListener('resize', resize);
if (location.search.includes('debug')) window.__debug = { start, go, ai, cat, wake };
