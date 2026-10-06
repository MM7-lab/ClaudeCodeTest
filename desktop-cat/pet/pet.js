import * as THREE from '../node_modules/three/build/three.module.js';
import { Cat } from './cat.js';
import { CatTree } from './tree.js';
import { ToyBox, toyCenter } from './toys.js';
import { makeSound } from './sound.js';

const api = window.catApi;
const $ = id => document.getElementById(id);
const canvas = $('scene'), bubble = $('bubble'), bubbleText = $('bubbleText'), bubbleActions = $('bubbleActions');
const fx = $('fx'), zzz = $('zzz');

const MIN = 60 * 1000;
const CHAT = ['你做得好好呀！加油 💪', '我喺度陪住你 🐾', '呼嚕呼嚕…', '一樣一樣嚟，唔使急 ✨', '記得深呼吸 🌿',
  '今日都好努力呀 🌼', '我信你得嘅 💛', '有咩唔開心，摸吓我啦 🐱'];
const OUCH = ['嚇死我喇！😾', '喵！好高呀 😿', '安全着陸 😼'];

let S = { name: '麻糬', coat: 'orange', size: 1, chatty: true, sound: true, volume: 0.6, tree: 'right', toys: [], toySize: 80 };
const sound = makeSound(() => S);
const pick = a => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- scene ----------
// Orthographic camera in screen pixels, tilted down a little so the cat reads as 3D.
// The floor (y = 0) sits BOTTOM pixels above the bottom of the work area.
const TILT = 0.3, BOTTOM = 34;
const LANE = [5, 50]; // depth range the cat wanders in on the floor (the tree stands behind it)
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
// The canvas covers the whole screen: draw it at 1× and keep the frame rate modest so the
// graphics card stays cool, even on high-resolution laptop screens.
renderer.setPixelRatio(1);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0xcdb8a6, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(-0.6, 1, 0.9);
scene.add(sun);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 8000);
camera.position.set(0, Math.sin(TILT) * 3000, Math.cos(TILT) * 3000);
camera.lookAt(0, 0, 0);

const shadow = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.35)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  scene.add(m);
  return m;
})();

const cat = new Cat();
scene.add(cat.root);
const tree = new CatTree(cat.ramp);
scene.add(tree.group);
let treeOn = false;

// The toys' frames are drawn on these two 2D layers, behind and in front of the cat's canvas.
const toyBack = document.createElement('canvas'), toyFront = document.createElement('canvas');
toyBack.className = 'toy-layer'; toyFront.className = 'toy-layer front';
document.body.append(toyBack, toyFront);
const toyBackCtx = toyBack.getContext('2d'), toyFrontCtx = toyFront.getContext('2d');
const failedToys = [];
const toys = new ToyBox(document.body, BOTTOM, placeToy, (t, state, msg) => {
  api.toyStatus?.(t.id, state, msg);
  if (state !== 'failed') return;
  console.warn('toy failed', t.id, msg);
  failedToys.push(t.name);
  // wait until the cat has landed and said hello, so this isn't drawn over
  if (ai.mode !== 'fall') tellFailedToys();
});
// keep the main process up to date with where each toy is drawn (for the diagnostics report)
setInterval(() => {
  for (const t of toys.live()) {
    const s = t.state;
    const info = [`用 ${t.modeName} 畫`, t.adapter && `顯示卡：${t.adapter}`,
      s.drawn === true ? '有畫到 ✓' : s.drawn === false ? '畫唔到嘢' : '', t.frame ? '經貓貓畫布顯示' : '直接顯示',
      s.errors ? `${s.errors} 個錯誤：${s.error}` : ''].filter(Boolean).join('；');
    api.toyStatus?.(t.id, 'ready', info, { l: s.l, r: s.r, t: s.t, b: s.b });
  }
}, 5000);
function tellFailedToys() {
  if (!failedToys.length) return;
  say(`${failedToys.splice(0).join('、')}出唔到嚟 😿 右撳我揀「複製診斷資料」，貼俾幫你整貓貓嘅人`, 9000);
}
function placeToy(i, n) {
  // spread the toys out, away from the cat tree
  const [a, b] = !treeOn ? [0.2, 0.8] : S.tree === 'left' ? [0.38, 0.85] : [0.15, 0.62];
  return W * (a + (b - a) * (i + 0.5) / n);
}

// ---------- behaviour state ----------
const FRONT = -Math.PI / 2; // yaw that faces the screen
const ai = {
  mode: 'fall', t: 0, dur: 0, data: {}, x: 0, y: 0, z: 20, vx: 0, vy: 0, yaw: FRONT, yawTarget: FRONT,
  surface: null, // the tree surface the cat is on, or null for the floor
  awakeSince: Date.now(), squash: 0, happy: 0, chaseCooldown: 0, toyCooldown: 0, chatAt: Date.now() + rand(8, 14) * MIN,
  glance: { yaw: 0, pitch: 0, t: 0 }, strokeDist: 0, strokeCooldown: 0, look: null,
};
let pending = null; // reminder waiting for an answer
let cursor = null, cursorSpeed = 0, rect = null, captured = false, drag = null;

const screenBounds = () => { const m = 80 * S.size; return [-W / 2 + m, W / 2 - m]; };
const bounds = () => (ai.surface ? [ai.surface.x0, ai.surface.x1] : screenBounds());
const facing = () => (Math.cos(ai.yaw) >= 0 ? 1 : -1);
function faceUser(side = facing()) { ai.yawTarget = FRONT + side * 0.55; }
function faceToward(dx, dz) { ai.yawTarget = Math.atan2(-dz, dx); }
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const onFloor = () => !ai.surface;
const laneZ = () => rand(LANE[0], LANE[1]);

function go(mode, data = {}) {
  if (ai.mode === 'carry' && mode !== 'carry') dropCarried();
  ai.mode = mode; ai.t = 0; ai.dur = data.dur ?? 0; ai.data = data;
  cat.swat = 0;
  const pose = { sit: 'sit', remind: 'sit', sleep: 'loaf', groom: 'groom', stretch: 'stretch', held: 'held',
                 fall: 'leap', jump: 'leap', hop: 'crouch', scratch: 'scratch', pompom: 'reach',
                 toyBat: 'crouch', grabToy: 'crouch', yawn: data.pose || 'sit' }[mode] || 'stand';
  cat.setPose(pose);
  zzz.hidden = mode !== 'sleep';
}

// ---------- choosing what to do next ----------
function decide() {
  if (pending) { go('remind'); ai.yawTarget = FRONT; return; }
  const awakeMin = (Date.now() - ai.awakeSince) / MIN;
  const sleepy = awakeMin > 6 ? 40 : awakeMin > 2 ? 6 : 0;
  let options;
  if (ai.surface) {
    const bed = ai.surface.name === 'bed';
    options = [['sit', 14], ['groom', 8], ['look', 8], ['idle', 5], ['down', ai.surface.name === 'base' ? 60 : 12],
      ['sleep', bed ? sleepy + 15 : sleepy / 2]];
  } else {
    const playable = toys.live().filter(t => !t.state.held).length > 0;
    options = [
      ['walk', 26], ['idle', 10], ['sit', 12], ['groom', 7], ['stretch', 4], ['run', 3], ['jump', 3], ['look', 7],
      ['sleep', sleepy],
      ['climb', treeOn ? 10 : 0], ['scratch', treeOn ? 6 : 0], ['pompom', treeOn ? 6 : 0],
      ['toyPlay', playable ? 16 : 0], ['toyCarry', playable ? 5 : 0], ['toyGift', playable ? 2 : 0],
    ];
  }
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
      go('walk', { tx, tz: laneZ() });
      break;
    }
    case 'run':
      go('run', { tx: ai.x > 0 ? x0 + rand(0, 120) : x1 - rand(0, 120), tz: laneZ(), laps: 2 + Math.floor(rand(0, 2)) });
      break;
    case 'idle': go('idle', { dur: rand(2, 5) }); faceUser(); break;
    case 'sit': go('sit', { dur: rand(6, 16) }); faceUser(); break;
    case 'look': go('sit', { dur: rand(4, 8) }); ai.yawTarget = FRONT; break;
    case 'groom': go('groom', { dur: rand(4, 7) }); faceUser(); break;
    case 'stretch': go('stretch', { dur: 2.4 }); break;
    case 'jump': ai.vy = rand(380, 480); ai.vx = rand(-90, 90); go('jump'); break;
    case 'sleep': {
      // a sleepy cat prefers the bed at the top of the tree, or curling up with a toy
      const toy = playableToy();
      if (onFloor() && treeOn && Math.random() < 0.55) return climb('bed', () => start('sleep'));
      if (onFloor() && toy && Math.random() < 0.5) return approachToy(toy, 'cuddle');
      go('sleep', { dur: rand(40, 150) }); faceUser();
      break;
    }
    case 'climb': climb(pick(['roof', 'shelf', 'bed', 'bed']), decide); break;
    case 'down': jumpDown(decide); break;
    case 'scratch': {
      const base = tree.surface('base');
      walkThen((base.x0 + base.x1) / 2 - 30 * S.size, LANE[0], () => hopTo(base, () => go('scratch', { dur: rand(3, 5) })));
      break;
    }
    case 'pompom': {
      const p = tree.pomWorld(), side = Math.random() < 0.5 ? -1 : 1;
      walkThen(p.x - side * 30 * S.size, LANE[0], () => go('pompom', { dur: rand(5, 9), side }));
      break;
    }
    case 'toyPlay': approachToy(playableToy(), Math.random() < 0.25 ? 'pounce' : 'bat'); break;
    case 'toyCarry': approachToy(playableToy(), 'carry'); break;
    case 'toyGift': approachToy(playableToy(), 'gift'); break;
    default: go('idle', { dur: 2 });
  }
}
function wake(greet) {
  ai.awakeSince = Date.now();
  go('yawn', { pose: 'loaf', then: 'stretch' });
  if (greet) { sound.chirp(); say('喵…我醒咗喇 😺', 3000); }
}
function walkThen(tx, tz, then, speed = 60) {
  const [x0, x1] = screenBounds();
  go('walk', { tx: clamp(tx, x0, x1), tz, then, speed });
}

// ---------- the cat tree: hopping between surfaces ----------
function hopTo(surface, then) {
  const to = surface
    ? { x: clamp(ai.x, surface.x0, surface.x1), y: surface.y, z: surface.z }
    : { x: clamp(ai.x + facing() * 30 * S.size, ...screenBounds()), y: 0, z: laneZ() };
  if (surface && surface.x0 === surface.x1) to.x = surface.x0;
  go('hop', { from: { x: ai.x, y: ai.y, z: ai.z }, to, surface, then });
}
function hopToFloorAt(x, then) {
  go('hop', { from: { x: ai.x, y: ai.y, z: ai.z }, to: { x, y: 0, z: laneZ() }, surface: null, then });
}
// Climb to a named surface: walk under it, then hop up one level at a time.
function climb(name, then) {
  if (!treeOn) return then();
  const target = tree.surface(name);
  const path = name === 'bed' ? [pick([tree.surface('shelf'), tree.surface('roof')]), target] : [target];
  const first = path[0];
  if (ai.surface === target) return then();
  const step = (i) => i >= path.length ? then() : hopTo(path[i], () => step(i + 1));
  if (ai.surface) return jumpDown(() => climb(name, then));
  walkThen((first.x0 + first.x1) / 2 + (first.x0 < tree.group.position.x ? -40 : 40) * S.size, LANE[0], () => step(0));
}
function jumpDown(then) {
  const s = ai.surface;
  if (!s) return then();
  if (s.name === 'bed') return hopTo(pick([tree.surface('shelf'), tree.surface('roof')]), () => jumpDown(then));
  const out = s.name === 'shelf' || s.name === 'base' ? -1 : 1; // jump off the outer side
  hopToFloorAt(clamp(ai.x + out * rand(70, 130) * S.size, ...screenBounds()), then);
}
// Highest surface the cat can land on at x after falling from prevY (0 = the floor).
function landingSurface(x, prevY) {
  if (!treeOn) return null;
  let best = null;
  for (const s of tree.surfaces) {
    if (s.name === 'base') continue;
    if (x > s.x0 - 30 * S.size && x < s.x1 + 30 * S.size && prevY >= s.y - 1 && (!best || s.y > best.y)) best = s;
  }
  return best;
}

// ---------- toys ----------
const toyScreen = t => toyCenter(t.state);
const toyWorldX = t => toyScreen(t).x - W / 2;
const toyZ = t => clamp((t.state.z || 0) + 14, -40, 90);
function playableToy() {
  const list = toys.live().filter(t => !t.state.held && !t.state.carried);
  if (!list.length) return null;
  // the nearest one, usually
  list.sort((a, b) => Math.abs(toyWorldX(a) - ai.x) - Math.abs(toyWorldX(b) - ai.x));
  return Math.random() < 0.7 ? list[0] : pick(list);
}
function approachToy(toy, intent) {
  if (!toy) return go('idle', { dur: 2 });
  if (ai.surface) return jumpDown(() => approachToy(toy, intent));
  go('toyGo', { toy, intent });
}
// x where the cat should stand to reach the toy from its current side
function besideToy(toy, gap = 34) {
  const c = toyScreen(toy), tx = c.x - W / 2, side = ai.x <= tx ? -1 : 1;
  return { x: tx + side * (c.w / 2 + gap * S.size), side, tx };
}
function swatToy(toy, side) {
  // contact point: the toy's edge nearest the cat, a little below the middle
  const c = toyScreen(toy);
  const x = side < 0 ? toy.state.l + 6 : toy.state.r - 6;
  toys.post(toy, { type: 'poke', x, y: c.y + c.h * 0.15, dx: -side, dy: -0.35, power: rand(2.5, 4.5), lift: 1.2 });
}
function mouthScreen() {
  const p = cat.neck.localToWorld(v.set(36, -4, 0));
  return toScreen(p);
}
function dropCarried() {
  const t = ai.data && ai.data.toy;
  if (t) toys.post(t, { type: 'release' });
}

// ---------- per-frame behaviour ----------
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
  const prevY = ai.y;
  ai.vy -= 1800 * dt;
  ai.y += ai.vy * dt; ai.x += ai.vx * dt;
  const [x0, x1] = screenBounds();
  if (ai.x < x0) { ai.x = x0; ai.vx = Math.abs(ai.vx) * 0.5; }
  if (ai.x > x1) { ai.x = x1; ai.vx = -Math.abs(ai.vx) * 0.5; }
  if (Math.abs(ai.vx) > 40) faceToward(ai.vx, 0);
  if (ai.vy >= 0) return -1;
  const s = landingSurface(ai.x, prevY);
  const ground = s ? s.y : 0;
  if (ai.y > ground) return -1;
  const force = Math.min(1, -ai.vy / 1400);
  ai.y = ground; ai.vy = 0; ai.vx = 0;
  ai.surface = s;
  if (s) { ai.z = s.z; ai.x = clamp(ai.x, s.x0, s.x1); }
  ai.squash = 0.08 + force * 0.25;
  return force;
}

function update(dt) {
  ai.t += dt;
  const d = ai.data;
  cat.gait.amp *= ['walk', 'run', 'chase', 'come', 'held', 'toyGo', 'carry'].includes(ai.mode) ? 1 : Math.exp(-dt * 8);
  ai.look = null;
  switch (ai.mode) {
    case 'idle': case 'sit':
      if (ai.t > ai.dur) decide();
      break;
    case 'groom':
      cat.extraHead.pitch = Math.sin(ai.t * 7) * 0.12;
      if (ai.t > ai.dur) decide();
      break;
    case 'walk':
      if (walkTo(dt, d.tx, d.tz, d.speed || 60)) d.then ? d.then() : decide();
      break;
    case 'come':
      if (walkTo(dt, d.tx, LANE[0], 120)) { go('sit', { dur: 8 }); ai.yawTarget = FRONT; }
      break;
    case 'run':
      if (walkTo(dt, d.tx, d.tz, 300)) {
        const [x0, x1] = bounds();
        if (--d.laps > 0) d.tx = d.tx < 0 ? x1 - rand(0, 120) : x0 + rand(0, 120);
        else { go('idle', { dur: 2 }); faceUser(); }
      }
      break;
    case 'stretch':
      if (ai.t <= ai.dur) break;
      if (d.after === 'down') jumpDown(decide);
      else { go('idle', { dur: rand(1, 3) }); faceUser(); }
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
    case 'hop': updateHop(dt); break;
    case 'scratch': {
      faceToward(1, 0);
      const w = Math.sin(ai.t * 11);
      cat.target.legs[0] = 2.0 + 0.4 * w;
      cat.target.legs[1] = 2.0 - 0.4 * w;
      if (ai.t - (d.lastSound || -1) > 0.5) { d.lastSound = ai.t; sound.scratch(); }
      if (ai.t > ai.dur) go('stretch', { dur: 1.2, after: 'down' });
      break;
    }
    case 'pompom': {
      const p = tree.pomWorld();
      faceToward(p.x - ai.x, 0);
      ai.look = { x: p.x, y: p.y, z: p.z };
      d.next = d.next ?? 0.4;
      if (ai.t > d.next) {
        d.next = ai.t + rand(0.5, 1.1);
        d.swatT = ai.t;
        // reachable: the ball is roughly at paw height and in front of the cat
        if (Math.abs(p.x - ai.x) < 55 * S.size && p.y > 50 * S.size && p.y < 120 * S.size) tree.swatPom(Math.sign(p.x - ai.x) || 1);
      }
      cat.swat = d.swatT != null && ai.t - d.swatT < 0.35 ? ai.t - d.swatT : 0;
      if (ai.t > ai.dur) { go('sit', { dur: 4 }); faceUser(); }
      break;
    }
    case 'toyGo': updateToyGo(dt); break;
    case 'toyBat': updateToyBat(dt); break;
    case 'grabToy': {
      const t = d.toy;
      if (!t.state || t.state.held) { decide(); break; }
      faceToward(toyWorldX(t) - ai.x, 0);
      if (ai.t > 0.45 && !d.sent) {
        // bite the near side, so the toy is dragged along in front of the cat
        d.sent = true;
        const c = toyScreen(t), near = ai.x <= toyWorldX(t) ? -1 : 1;
        d.dir = -near;
        const x = near < 0 ? t.state.l + c.w * 0.2 : t.state.r - c.w * 0.2;
        toys.post(t, { type: 'grab', x, y: t.state.t + c.h * 0.4 });
      }
      if (ai.t > 0.9) {
        if (!t.state.carried) { go('sit', { dur: 3 }); faceUser(); break; }
        const [x0, x1] = screenBounds();
        const gift = d.intent === 'gift';
        const tx = gift && cursor ? clamp(cursor.x - W / 2, x0, x1) : clamp(ai.x + d.dir * rand(200, 450), x0, x1);
        go('carry', { toy: t, tx, gift });
      }
      break;
    }
    case 'carry': {
      const t = d.toy;
      if (!t.state || !t.state.carried) { go('sit', { dur: 3 }); faceUser(); break; }
      const m = mouthScreen();
      toys.post(t, { type: 'drag', x: m.x, y: m.y });
      if (walkTo(dt, d.tx, ai.z, 55) || ai.t > 20) {
        toys.post(t, { type: 'release' });
        ai.data.toy = null;
        if (d.gift) { go('sit', { dur: 6 }); ai.yawTarget = FRONT; say('送俾你 🎁', 4000); sound.chirp(); }
        else { go('sit', { dur: 4 }); faceUser(); }
      }
      break;
    }
    case 'jump': case 'fall': {
      const landed = physics(dt);
      if (landed < 0) break;
      if (d.pounce && d.pounce.state) {
        const t = d.pounce, c = toyScreen(t);
        if (Math.abs(c.x - W / 2 - ai.x) < c.w * 0.7) {
          toys.post(t, { type: 'poke', x: c.x, y: t.state.t + 8, dx: 0, dy: 1, power: 5, lift: -2.5 });
          if (Math.random() < 0.5) say(pick(['捉到喇！😼', '我嘅！🐾']), 2500);
        }
        go('toyBat', { toy: t, swats: 2 + Math.floor(rand(0, 2)) });
        break;
      }
      if (pending) { go('remind'); ai.yawTarget = FRONT; }
      else if (d.welcome) {
        go('sit', { dur: 5 }); ai.yawTarget = FRONT; say(`我係${S.name}，今日陪你做嘢 🐾`, 4000); sound.meow();
        setTimeout(tellFailedToys, 4500);
      }
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
      if (ai.y > (ai.surface ? ai.surface.y : 0) || ai.vy > 0) physics(dt);
      ai.yawTarget = FRONT;
      cat.target.tailSpeed = 6; cat.target.tailAmp = 0.3;
      break;
    case 'chase': updateChase(dt); break;
  }
  if (ai.chaseCooldown > 0) ai.chaseCooldown -= dt;
  if (ai.toyCooldown > 0) ai.toyCooldown -= dt;
  maybeChase();
  maybeChaseToy();
  maybeChat();
}

function updateHop(dt) {
  const d = ai.data, from = d.from, to = d.to;
  const PREP = 0.2;
  if (d.T == null) {
    const dy = to.y - from.y;
    d.T = 0.42 + Math.abs(dy) / 800 + Math.abs(to.x - from.x) / 1500;
    d.arc = dy > 0 ? dy * 0.25 + 30 * S.size : 25 * S.size;
    if (Math.abs(to.x - from.x) > 4) faceToward(to.x - from.x, 0);
  }
  if (ai.t < PREP) return; // crouch, then spring
  if (!d.flying) { d.flying = true; cat.setPose('leap'); }
  const k = clamp((ai.t - PREP) / d.T, 0, 1);
  ai.x = from.x + (to.x - from.x) * k;
  ai.z = from.z + (to.z - from.z) * k;
  ai.y = from.y + (to.y - from.y) * k + d.arc * 4 * k * (1 - k);
  if (k < 1) return;
  ai.surface = d.surface;
  ai.squash = 0.12;
  if (pending) { go('remind'); ai.yawTarget = FRONT; return; }
  d.then ? d.then() : decide();
}

function updateToyGo(dt) {
  const d = ai.data, t = d.toy;
  if (!t.state || t.state.held || t.state.carried || ai.t > 14) { decide(); return; }
  const gap = d.intent === 'cuddle' ? 8 : d.intent === 'pounce' ? 150 : 30;
  const spot = besideToy(t, gap);
  ai.look = { x: spot.tx, y: 30 * S.size, z: ai.z };
  // stand at the toy's depth, a little in front of it, so the cat isn't hidden behind it
  if (!walkTo(dt, spot.x, toyZ(t), d.intent === 'pounce' ? 120 : 80)) return;
  faceToward(spot.tx - ai.x, 0);
  if (d.intent === 'bat') go('toyBat', { toy: t, swats: 2 + Math.floor(rand(0, 4)), chases: d.chases });
  else if (d.intent === 'pounce') {
    // wiggle the bum, then leap onto it
    go('toyBat', { toy: t, swats: 0, pounce: true });
  } else if (d.intent === 'carry' || d.intent === 'gift') go('grabToy', { toy: t, intent: d.intent });
  else if (d.intent === 'cuddle') { go('sleep', { dur: rand(40, 120) }); faceToward(spot.tx - ai.x, 6); }
}

function updateToyBat(dt) {
  const d = ai.data, t = d.toy;
  if (!t.state || t.state.held || t.state.carried) { decide(); return; }
  const c = toyScreen(t), tx = c.x - W / 2, side = ai.x <= tx ? -1 : 1;
  faceToward(-side, 0);
  ai.look = { x: tx, y: 20 * S.size, z: ai.z };
  if (d.pounce) {
    cat.target.tailSpeed = 9;
    cat.figure.position.x = Math.sin(ai.t * 30) * 1.5; // bum wiggle
    if (ai.t > 1.1) {
      cat.figure.position.x = 0;
      ai.vy = 470; ai.vx = (tx - ai.x) / (2 * 470 / 1800);
      go('jump', { pounce: t });
    }
    return;
  }
  // too far now (it rolled away)? go after it
  if (Math.abs(tx - ai.x) > c.w / 2 + 90 * S.size) {
    const chases = (d.chases || 0) + 1;
    if (chases > 3) { go('sit', { dur: 4 }); faceUser(); }
    else go('toyGo', { toy: t, intent: 'bat', chases });
    return;
  }
  d.next = d.next ?? 0.5;
  if (ai.t > d.next) {
    if (d.swats <= 0) { go('sit', { dur: rand(3, 6) }); faceUser(); if (Math.random() < 0.4) say(pick(['好好玩 😸', '再嚟！', '喵嗚～']), 2500); return; }
    d.swats--;
    d.next = ai.t + rand(0.6, 1.1);
    d.swatT = ai.t;
    d.hit = false;
  }
  const since = d.swatT != null ? ai.t - d.swatT : 9;
  cat.swat = since < 0.35 ? since : 0;
  if (!d.hit && since > 0.15 && since < 0.35) { d.hit = true; swatToy(t, side); }
}

// ---------- playing with the mouse ----------
const cursorWorldX = () => cursor.x - W / 2;
const cursorNearFloor = () => cursor && cursor.y > H - 240 && cursor.y < H + 20 && cursor.x > 0 && cursor.x < W;
function maybeChase() {
  if (pending || drag || !onFloor() || ai.chaseCooldown > 0 || !['idle', 'sit', 'walk'].includes(ai.mode)) return;
  if (!cursorNearFloor() || cursorSpeed < 250 || Math.abs(cursorWorldX() - ai.x) > 500) return;
  if (Math.random() < 0.01) { go('chase', { state: 'run' }); ai.chaseCooldown = 30; }
}
function updateChase(dt) {
  const d = ai.data;
  if (!cursorNearFloor() || ai.t > 15) { go('sit', { dur: 4 }); faceUser(); return; }
  const [x0, x1] = screenBounds();
  const cx = clamp(cursorWorldX(), x0, x1), side = cx >= ai.x ? 1 : -1;
  const gap = Math.abs(cx - ai.x);
  if (gap > 90 * S.size) {
    if (d.state !== 'run') { cat.setPose('stand'); d.state = 'run'; }
    walkTo(dt, cx - side * 60 * S.size, LANE[0], 170);
  } else {
    if (d.state !== 'crouch') { cat.setPose('crouch'); d.state = 'crouch'; }
    faceToward(side, 0);
    cat.swat = cursorSpeed > 120 ? cat.swat + dt : 0;
    if (cursorSpeed > 500 && Math.random() < 0.02) { ai.vy = 380; ai.vx = side * 160; go('jump'); }
  }
}
// A toy flying past (someone threw it) is hard to ignore.
function maybeChaseToy() {
  if (pending || drag || !onFloor() || ai.toyCooldown > 0 || !['idle', 'sit', 'walk', 'groom'].includes(ai.mode)) return;
  const t = toys.live().find(t => !t.state.held && !t.state.carried && t.state.speed > 450);
  if (!t) return;
  ai.toyCooldown = 10;
  if (Math.random() < 0.5) go('toyGo', { toy: t, intent: 'bat' });
}
function maybeChat() {
  if (Date.now() < ai.chatAt) return;
  ai.chatAt = Date.now() + rand(10, 18) * MIN;
  if (S.chatty && !pending && ai.mode !== 'sleep' && bubble.hidden) { say(pick(CHAT), 6000); ai.happy = 1.2; }
}

// Head follows the mouse when it's close, or whatever the cat is busy with; otherwise glances around.
function updateGaze(dt, headScreen) {
  let yaw = 0, pitch = 0;
  const awake = !['sleep', 'held', 'yawn', 'groom', 'stretch', 'scratch', 'hop'].includes(ai.mode);
  const lookAt = (sx, sy, range) => {
    const want = FRONT + clamp((sx - headScreen.x) / range, -1, 1) * 0.9;
    yaw = clamp(angleDiff(want, ai.yaw), -1.1, 1.1);
    pitch = -clamp((headScreen.y - sy) / 400, -0.6, 0.6) * 0.5;
  };
  if (awake && headScreen && ai.look) {
    const p = toScreen(v.set(ai.look.x, ai.look.y, ai.look.z));
    lookAt(p.x, p.y, 200);
  } else if (awake && cursor && headScreen && Math.hypot(cursor.x - headScreen.x, cursor.y - headScreen.y) < 450) {
    lookAt(cursor.x, cursor.y, 450);
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
  if (['walk', 'run', 'idle', 'toyGo'].includes(ai.mode)) { go('sit', { dur: 5 }); ai.yawTarget = FRONT; }
}

// ---------- messages from the main process ----------
api.on('reminder', r => {
  pending = r;
  if (ai.mode === 'sleep') ai.awakeSince = Date.now();
  if (!['held', 'fall', 'hop'].includes(ai.mode)) { go('remind'); ai.vy = 300; }
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
  if (ai.mode === 'sleep') ai.awakeSince = Date.now();
  say('喵？叫我呀？😺', 3000);
  const comeOver = () => {
    const [x0, x1] = screenBounds();
    go('come', { tx: cursor && cursor.x >= 0 && cursor.x <= W ? clamp(cursorWorldX(), x0, x1) : 0 });
  };
  ai.surface && ai.mode !== 'hop' ? jumpDown(comeOver) : comeOver();
});
api.on('toy-action', a => toys.action(a));
api.on('settings', s => applySettings(s));
$('btnDone').addEventListener('click', () => api.answer(true));
$('btnLater').addEventListener('click', () => api.answer(false));

function applySettings(s) {
  const soundWasOn = S.sound;
  S = { ...S, ...s };
  if (S.sound && soundWasOn === false && frameStarted) sound.meow(); // let them hear it when switched on
  cat.setCoat(S.coat);
  placeTree();
  toys.set(S.toys || [], Math.round(S.toySize || 80));
}
let treeKey = '';
function placeTree() {
  const key = `${S.tree}|${W}|${S.size}`;
  if (key === treeKey) return;
  treeKey = key;
  treeOn = S.tree === 'left' || S.tree === 'right';
  tree.group.visible = treeOn;
  if (treeOn) {
    const side = S.tree === 'left' ? -1 : 1;
    tree.place(side * (W / 2 - 120 * S.size), -60, S.size);
  }
  // the tree moved or went away under the cat: drop down to the floor
  if (ai.surface) {
    ai.surface = null;
    if (!['held', 'fall'].includes(ai.mode)) { ai.vy = 0; ai.vx = 0; go('fall'); }
  }
}

// ---------- mouse: hover, pet, drag & drop ----------
// The window ignores the mouse (clicks go to whatever is underneath) except while the
// pointer is over the cat, its speech bubble, or one of the toys.
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
  const onCat = !!drag || (cursor && (overCat(cursor.x, cursor.y) || overBubble(cursor.x, cursor.y)));
  const toy = onCat ? null : toys.hovered();
  // route the mouse: the cat's canvas, or the toy's own page underneath it
  canvas.style.pointerEvents = toy ? 'none' : 'auto';
  for (const t of toys.toys.values()) t.el.style.pointerEvents = t === toy ? 'auto' : 'none';
  const want = onCat || !!toy;
  if (want !== captured) {
    captured = want;
    api.setThrough(!want);
  }
  canvas.style.cursor = onCat ? (drag && drag.moved ? 'grabbing' : 'grab') : '';
}
let lastCursor = null, lastCursorT = 0;
setInterval(async () => {
  const c = await api.cursor();
  if (!c) return;
  toys.cursor(c);
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
  drag = { x: e.clientX, y: e.clientY, moved: false, vx: 0, vy: 0, lx: 0, ly: 0, lt: performance.now() };
  const p = pointerWorld(e);
  if (p) { drag.lx = p.x; drag.ly = p.y; }
});
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
  if (!drag.moved) {
    drag.moved = true;
    if (ai.mode === 'sleep') ai.awakeSince = Date.now();
    ai.surface = null;
    go('held');
    sound.meow();
  }
  const p = pointerWorld(e);
  if (!p) return;
  const now = performance.now(), dt = Math.max(0.001, (now - drag.lt) / 1000);
  drag.vx = drag.vx * 0.5 + ((p.x - drag.lx) / dt) * 0.5;
  drag.vy = drag.vy * 0.5 + ((p.y - drag.ly) / dt) * 0.5;
  drag.lx = p.x; drag.ly = p.y; drag.lt = now;
  const [x0, x1] = screenBounds();
  ai.x = clamp(p.x, x0, x1);
  ai.y = Math.max(0, p.y - 62 * S.size);
});
function endDrag() {
  if (!drag) return;
  const d = drag;
  drag = null;
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
  // a toy closer to the screen than the cat (or in its mouth) draws in front of it
  const inFront = t => !!(t.state && (t.state.carried || t.state.z > ai.z + 10));
  for (const t of toys.toys.values()) t.el.style.zIndex = inFront(t) ? 3 : 1;
  toys.draw(toyBackCtx, toyFrontCtx, inFront);
}

let last = performance.now(), acc = 0, shownOnce = false, frameStarted = false;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000;
  last = now;
  // Calm moments render at ~30 fps to go easy on laptops.
  acc += raw;
  const calm = ['sleep', 'sit', 'idle', 'groom', 'remind'].includes(ai.mode) && !drag;
  if (acc < (calm ? 1 / 24 : 1 / 40)) return;
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
  if (treeOn) tree.update(dt);

  // the shadow sits on whatever is underneath: a tree surface or the floor
  const below = ai.mode === 'hop' ? (ai.data.surface ? ai.data.surface.y : 0) : (ai.surface ? ai.surface.y : landingSurface(ai.x, ai.y)?.y || 0);
  const lift = clamp((ai.y - below) / 500, 0, 0.7);
  const ss = 115 * S.size * (1 - lift);
  shadow.position.set(ai.x + 5 * S.size, below + 0.6, ai.mode === 'hop' ? ai.z : ai.z);
  shadow.scale.set(ss, ss * 0.55, 1);
  shadow.material.opacity = 1 - lift;

  renderer.render(scene, camera);
  if (!shownOnce) { shownOnce = true; api.ready?.(); }
  measure();
  placeOverlays();
  updateCapture();
}

function resize() {
  W = innerWidth; H = innerHeight;
  Object.assign(camera, { left: -W / 2, right: W / 2, top: H - BOTTOM, bottom: -BOTTOM });
  camera.updateProjectionMatrix();
  renderer.setSize(W, H, false);
  for (const c of [toyBack, toyFront]) { c.width = W; c.height = H; }
  placeTree();
  const [x0, x1] = screenBounds();
  if (!ai.surface) ai.x = clamp(ai.x, x0, x1);
}

// ---------- start ----------
api.getState().then(state => {
  applySettings(state.settings);
  resize();
  const [x0, x1] = screenBounds();
  ai.x = rand(x0, x1) * 0.5;
  ai.y = H * 0.55;
  go('fall', { welcome: true });
  frameStarted = true;
  requestAnimationFrame(frame);
});
addEventListener('resize', resize);
if (location.search.includes('debug')) window.__debug = { start, go, ai, cat, wake, tree, toys, climb, approachToy, decide };
