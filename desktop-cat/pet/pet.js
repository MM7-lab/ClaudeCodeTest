import * as THREE from '../node_modules/three/build/three.module.js';
import { Cat } from './cat.js';
import { CatTree } from './tree.js';
import { ToyBox, toyCenter } from './toys.js';
import { Bird, BirdCage } from './bird.js';
import { BirdBrain } from './birdbrain.js';
import { Pig, PigBed } from './pig.js';
import { PigBrain } from './pigbrain.js';
import { FriendBrain } from './friendbrain.js';
import { BREEDS } from './breeds.js';
import { DogHouse } from './doghouse.js';
import { Desk, Worker, fitSeat, catPoints } from './office.js';
import { WaterCooler, Sofa, Bookshelf, Whiteboard, Printer, BigPlant } from './officefurniture.js';
import { makeSound } from './sound.js';

const api = window.catApi;
const $ = id => document.getElementById(id);
const canvas = $('scene'), bubble = $('bubble'), bubbleText = $('bubbleText'), bubbleActions = $('bubbleActions');
const fx = $('fx'), zzz = $('zzz');

const MIN = 60 * 1000;
const CHAT = () => ['你做得好好呀！加油 💪', '我喺度陪住你 🐾', `${word()}${word()}～`, '一樣一樣嚟，唔使急 ✨', '記得深呼吸 🌿',
  '今日都好努力呀 🌼', '我信你得嘅 💛', `有咩唔開心，摸吓我啦 ${face()}`];
const OUCH = () => ['嚇死我喇！', `${word()}！好高呀`, '安全着陸'].map(t => t + ' ' + face());

let S = { name: '麻糬', mainPet: 'cat', office: false, workers: ['main', 'auto'], officeFurn: ['sofa', 'cooler', 'shelf', 'board', 'printer', 'plant'], breed: 'classic', dogBreed: 'golden', dogHouse: 'right', coat: 'orange', size: 1, friends: [], chatty: true, sound: true, volume: 0.6, tree: 'right', toys: [], toySize: 80,
  birdCount: 1, birds: [{ name: '檸檬', color: 'yellow' }], cage: 'both', pig: true, pigName: '布甸', pigBed: 'left' };
const sound = makeSound(() => S);

// ---------- the main pet (主角): a cat, a dog, a bird or the pig ----------
// A cat or a dog is the animal below with the full set of behaviours (ai, cat). A bird or the
// pig takes over the reminders, the speech bubble and being called over; the cat then stays away.
const mainKind = () => (['cat', 'dog', 'bird', 'pig'].includes(S.mainPet) ? S.mainPet : 'cat');
const catMain = () => mainKind() === 'cat' || mainKind() === 'dog';
const dogMain = () => mainKind() === 'dog';
const pigOn = () => !!S.pig || mainKind() === 'pig';
const birdCount = () => (mainKind() === 'bird' ? Math.max(1, S.birdCount) : S.birdCount);
const pigName = () => (mainKind() === 'pig' ? S.name : S.pigName);
const birdName = i => (mainKind() === 'bird' && i === 0 ? S.name : S.birds[i]?.name || '雀仔');
const word = () => ({ cat: '喵', dog: '汪', bird: '啾', pig: '噗' })[mainKind()];
const face = () => ({ cat: '🐱', dog: '🐶', bird: '🐤', pig: '🐷' })[mainKind()];
const dogPitch = () => clamp(1.25 / (BREEDS[S.dogBreed]?.size || 1), 0.75, 2.4);
// the main pet's own voice, and its happy noise
function voice(n = 1) {
  const k = mainKind();
  if (k === 'dog') sound.bark(n, dogPitch());
  else if (k === 'bird') sound.song(PITCH[0]);
  else if (k === 'pig') sound.oink(n);
  else sound.meow(n);
}
function purr() {
  const k = mainKind();
  if (k === 'dog') sound.bark(1, dogPitch());
  else if (k === 'bird') sound.tweet(PITCH[0]);
  else if (k === 'pig') sound.oink(1);
  else sound.purr();
}
// where the main pet is, for the others to follow and gather round
function mainSpot() {
  const k = mainKind();
  if (k === 'pig') return { x: pigBrain.x, z: pigBrain.z, onFloor: !pigBrain.inBed && pigBrain.y < 1 && !pigDrag };
  if (k === 'bird') { const b = flock[0].brain; return { x: b.p.x, z: clamp(b.p.z, ...LANE), onFloor: false }; }
  return { x: ai.x, z: ai.z, onFloor: !ai.surface && ai.y < 1 && !drag };
}
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

// ---------- the birds (雀仔) and their cages, hanging at the top corners ----------
const cages = [new BirdCage(cat.ramp), new BirdCage(cat.ramp)]; // left, right
for (const c of cages) scene.add(c.group);
let cagesOn = [false, false];
const liveCages = () => cages.map((c, i) => (cagesOn[i] ? c : null));
// world height that is still on screen, near the top
const ceiling = () => (H - 50 - BOTTOM) / Math.cos(TILT);
const PITCH = [1, 1.13, 0.9]; // each bird's voice
const flock = [0, 1, 2].map(i => {
  const bird = new Bird(cat.ramp);
  scene.add(bird.root);
  const shade = shadow.clone();
  shade.material = shadow.material.clone();
  scene.add(shade);
  const z = zzz.cloneNode(true);
  z.removeAttribute('id');
  document.body.append(z);
  const f = { i, bird, shadow: shade, zzz: z };
  // which cage is home: with both up, birds take turns left and right
  const home = () => {
    const on = [0, 1].filter(k => cagesOn[k]);
    return on.length ? on[i % on.length] : null;
  };
  f.home = home;
  f.brain = new BirdBrain(bird, {
    S: () => S,
    bounds: () => screenBounds(),
    lane: () => LANE,
    ceiling,
    cages: liveCages,
    home,
    slot: () => liveBirds().filter(o => o.i < i && o.home() === home()).length,
    treeSpots: () => (treeOn ? tree.surfaces : []),
    cat: () => {
      // stays put while the cat keeps still; only lands once the cat has settled
      const still = catMain() && ['sit', 'sleep', 'idle', 'groom', 'remind', 'yawn', 'look', 'visitPig'].includes(ai.mode) && !drag && !(ai.mode === 'visitPig' && !ai.data.arrived);
      const head = cat.neck.localToWorld(v.set(10, 33, 0));
      return { ...mainSpot(), perchable: still, settled: still && ai.t > 1.5, head: { x: head.x, y: head.y, z: head.z } };
    },
    pig: () => (pigOn() && !pigDrag ? { perchable: pigBrain.perchable, settled: pigBrain.settled, head: pigBrain.headWorld() } : null),
    friends: () => [...friends.values()].filter(o => !friendGone(o) || (o.brain.asleep && o.brain.slot == null)).map(o => {
      const still = o.brain.still && o.brain.slot == null;
      return { id: o.id, perchable: still, settled: still && o.brain.t > 1.5, head: o.brain.headWorld() };
    }),
    house: () => (houseOn ? house.roof() : null),
    desk: () => (i === 0 && mainKind() === 'bird' ? deskFor('main') : null),
    furn: () => furnSpots(),
    effect: (kind, p) => effect(kind, p),
    toys: () => toys.live().map(t => {
      const st = t.state, z = clamp(st.z || 0, -60, 90);
      return { id: t.id, moving: st.held || st.carried || st.speed > 60,
        top: { x: (st.l + st.r) / 2 - W / 2, y: (H - st.t - BOTTOM + z * Math.sin(TILT)) / Math.cos(TILT) - 4 * S.size, z } };
    }),
    others: () => liveBirds().filter(o => o !== f).map(o => o.brain),
    sound: { tweet: () => sound.tweet(PITCH[i]), song: () => sound.song(PITCH[i]), alarm: () => sound.alarm(PITCH[i]) },
    notes: p => notes(toScreen(v.set(p.x, p.y, p.z))),
    hearts: p => hearts(3, toScreen(v.set(p.x, p.y, p.z))),
    zzz: on => { z.hidden = !on; },
  });
  return f;
});
const liveBirds = () => flock.slice(0, birdCount());
const birdFlying = () => liveBirds().some(f => f.brain.mode === 'fly' || f.brain.mode === 'held');
const birdIsDown = f => f.brain.spot.kind === 'floor' && !['fly', 'held'].includes(f.brain.mode);
// the floor bird nearest the cat, for stalking
function birdOnFloor() {
  const down = liveBirds().filter(o => birdIsDown(o) && !o.brain.reminding);
  down.sort((a, b) => Math.abs(a.brain.p.x - ai.x) - Math.abs(b.brain.p.x - ai.x));
  return down[0] || null;
}

// ---------- the pig (豬仔) and its bed ----------
const pig = new Pig(cat.ramp);
scene.add(pig.root);
const pigBed = new PigBed(cat.ramp);
scene.add(pigBed.group);
let bedOn = false;
const pigShadow = shadow.clone();
pigShadow.material = shadow.material.clone();
scene.add(pigShadow);
const pigZzz = zzz.cloneNode(true);
pigZzz.removeAttribute('id');
document.body.append(pigZzz);
const pigScale = () => S.size * 1.2;
const pigBrain = new PigBrain(pig, {
  S: () => S,
  scale: pigScale,
  bounds: () => screenBounds(),
  lane: () => LANE,
  bed: () => (bedOn ? pigBed : null),
  cat: () => (mainKind() === 'pig' ? { x: 0, z: 25, onFloor: false } : mainSpot()),
  desk: () => deskFor(mainKind() === 'pig' ? 'main' : 'pig'),
  effect: (kind, p) => effect(kind, p),
  office: () => officeApi('pig'),
  atBowl: () => atBowl(),
  toy: () => nearToy(pigBrain.x),
  sound,
  notes: p => notes(toScreen(v.set(p.x, p.y, p.z))),
  hearts: p => hearts(3, toScreen(v.set(p.x, p.y, p.z))),
  zzz: on => { pigZzz.hidden = !on; },
});
let pigDrag = null;
const pigAround = () => pigOn() && !pigDrag && !pigBrain.inBed && !['held', 'fall', 'bedHop', 'sleep'].includes(pigBrain.mode);

// ---------- dog and cat friends (朋友) ----------
// One per chosen breed, made when switched on and thrown away when switched off.
const friends = new Map();
let friendDrag = null;
const friendScale = f => S.size * (BREEDS[f.id].size || 1);
const friendGone = f => (friendDrag && friendDrag.f === f) || ['held', 'fall', 'sleep'].includes(f.brain.mode);
// something a friend (or the main cat) can walk over to and greet
const friendTarget = f => ({
  ok: () => friends.get(f.id) === f && !friendGone(f), x: () => f.brain.x, z: () => f.brain.z,
  h: () => 50 * friendScale(f), gap: () => (45 + 50 * BREEDS[f.id].size) * S.size,
  greet: x => f.brain.greet(x), line: () => `${BREEDS[f.id].label}好得意 🐾`,
  kind: BREEDS[f.id].kind, play: x => f.brain.play(x),
});
function makeFriend(id) {
  const b = BREEDS[id], animal = new Cat(id);
  scene.add(animal.root);
  const shade = shadow.clone();
  shade.material = shadow.material.clone();
  scene.add(shade);
  const z = zzz.cloneNode(true);
  z.removeAttribute('id');
  z.hidden = true;
  document.body.append(z);
  const dog = b.kind === 'dog';
  const pitch = dog ? clamp(1.25 / b.size, 0.75, 2.4) : clamp(1 / Math.sqrt(b.size), 0.85, 1.2);
  const f = { id, animal, shadow: shade, zzz: z };
  f.brain = new FriendBrain(animal, {
    S: () => S,
    scale: () => friendScale(f),
    bounds: () => screenBounds(),
    lane: () => LANE,
    main: mainSpot,
    others: () => actors(f),
    house: () => (houseOn ? house : null),
    slot: () => claimSlot(f.id),
    freeSlot: () => freeSlot(f.id),
    bowl: k => claimBowl(k, f.id),
    freeBowl: k => freeBowl(k, f.id),
    bird: () => nearBird(f.brain.x),
    toy: () => nearToy(f.brain.x),
    petted: x => jealousy(x, f),
    desk: () => deskFor(f.id),
    effect: (kind, p) => effect(kind, p),
    office: () => officeApi(f.id),
    atBowl: () => atBowl(),
    cursorX: () => (cursor && cursor.x >= 0 && cursor.x <= W ? cursorWorldX() : null),
    sound: {
      voice: n => (dog ? sound.bark(n, pitch) : sound.meow(n, pitch)),
      happy: () => (dog ? sound.bark(1, pitch) : sound.purr()),
    },
    hearts: p => hearts(3, toScreen(v.set(p.x, p.y, p.z))),
    say: (text, p) => floaters(toScreen(v.set(p.x, p.y, p.z)), 1, [text], 'heart woof'),
    zzz: on => { z.hidden = !on; },
  });
  friends.set(id, f);
  return f;
}
// Everyone a friend can visit, chase or play with: the main cat or dog, the pig, the other friends.
function actors(except) {
  const list = [];
  if (catMain() && !ai.surface && !drag && !['held', 'fall', 'hop', 'jump', 'remind'].includes(ai.mode)) {
    list.push({ id: 'main', kind: dogMain() ? 'dog' : 'main', x: ai.x, z: ai.z, size: S.size,
      still: ['idle', 'sit', 'look', 'groom', 'walk'].includes(ai.mode), asleep: ai.mode === 'sleep',
      greet: x => { if (['idle', 'sit', 'look'].includes(ai.mode)) { faceToward(x - ai.x, 0); ai.happy = 1.2; } },
      flee: x => mainChased(x), play: x => mainChased(x, true) });
  }
  if (pigOn() && !pigDrag && !pigBrain.inBed && !['held', 'fall', 'bedHop', 'remind'].includes(pigBrain.mode)) {
    list.push({ id: 'pig', kind: 'pig', x: pigBrain.x, z: pigBrain.z, size: pigScale(), still: pigBrain.perchable,
      asleep: pigBrain.mode === 'sleep', greet: x => pigBrain.greet(x), flee: x => pigBrain.flee(x), play: () => pigBrain.play() });
  }
  for (const o of friends.values()) {
    if (o === except || (friendDrag && friendDrag.f === o) || o.brain.slot != null || ['held', 'fall', 'enter'].includes(o.brain.mode)) continue;
    list.push({ id: o.id, kind: BREEDS[o.id].kind, x: o.brain.x, z: o.brain.z, size: friendScale(o), still: o.brain.still,
      asleep: o.brain.asleep, greet: x => o.brain.greet(x), flee: x => o.brain.flee(x), play: x => o.brain.play(x) });
  }
  return list;
}
// a dog ran at the main cat (it bolts) or the main dog (it plays along)
function mainChased(fromX, play) {
  if (pending || drag || ai.surface || !['idle', 'sit', 'look', 'groom', 'walk'].includes(ai.mode)) return;
  const [x0, x1] = screenBounds();
  if (!dogMain() && !play && Math.random() < 0.6) say(pick(['嘶～ 😾', '唔好追我呀！🙀']), 2000);
  if (play && !dogMain()) { go('sit', { dur: 4 }); faceToward(fromX - ai.x, 0); return; }
  go('run', { tx: fromX < ai.x ? x1 - rand(0, 100) : x0 + rand(0, 100), tz: laneZ(), laps: dogMain() ? 2 : 1 });
}
// the floor bird nearest x (not the main bird while it's reminding)
function nearBird(x) {
  const down = liveBirds().filter(o => birdIsDown(o) && !o.brain.reminding && Math.abs(o.brain.p.x - x) < 650);
  down.sort((a, b) => Math.abs(a.brain.p.x - x) - Math.abs(b.brain.p.x - x));
  const o = down[0];
  return o ? { id: o.i, x: o.brain.p.x, z: o.brain.p.z, flee: () => o.brain.flee() } : null;
}
// the plush toy nearest x that nobody is holding
function nearToy(x) {
  const list = toys.live().filter(t => !t.state.held && !t.state.carried && Math.abs(toyWorldX(t) - x) < 700);
  list.sort((a, b) => Math.abs(toyWorldX(a) - x) - Math.abs(toyWorldX(b) - x));
  const t = list[0];
  if (!t) return null;
  return {
    id: t.id, x: toyWorldX(t), z: toyZ(t), w: toyScreen(t).w, poke: side => swatToy(t, side),
    // carrying it in the mouth: bite the near side, then drag it along with the mouth
    grab: side => { const c = toyScreen(t); toys.post(t, { type: 'grab', x: side < 0 ? t.state.l + c.w * 0.2 : t.state.r - c.w * 0.2, y: t.state.t + c.h * 0.4 }); },
    drag: p => { const m = toScreen(v.set(p.x, p.y, p.z)); toys.post(t, { type: 'drag', x: m.x, y: m.y }); },
    release: () => toys.post(t, { type: 'release' }),
    carried: () => !!(t.state && t.state.carried),
  };
}
// someone got petted: friends (and the pig) nearby may come over wanting some too
function jealousy(x, except) {
  for (const o of friends.values()) {
    if (o !== except && Math.abs(o.brain.x - x) < 500 && Math.random() < 0.35) o.brain.jealous(x);
  }
  if (pigOn() && mainKind() !== 'pig' && except !== 'pig' && Math.abs(pigBrain.x - x) < 500 && Math.random() < 0.25) pigBrain.jealous(x);
}

// ---------- office mode (辦公室模式): two desks, two pets at work ----------
const desks = [new Desk(cat.ramp), new Desk(cat.ramp)]; // left, right
for (const d of desks) { d.group.visible = false; scene.add(d.group); }
let officeOn = false, officeKey = '';
// who works at each desk: 'main', 'pig', or a friend's breed; 'auto' picks someone free
function workers() {
  if (!officeOn) return [null, null];
  const cand = ['main', ...[...friends.keys()], ...(pigOn() && mainKind() !== 'pig' ? ['pig'] : [])];
  const out = [null, null], used = new Set();
  (S.workers || []).slice(0, 2).forEach((w, k) => { if (cand.includes(w) && !used.has(w)) { out[k] = w; used.add(w); } });
  // 'auto': a friend first, then the pig, then the main pet
  const order = [...cand.slice(1), 'main'];
  for (let k = 0; k < 2; k++) if (!out[k]) { const w = order.find(c => !used.has(c)); if (w) { out[k] = w; used.add(w); } }
  return out;
}
const deskFor = key => { const w = workers(), k = w.indexOf(key); return k >= 0 ? desks[k] : null; };
const workerName = key => (key === 'main' ? S.name : key === 'pig' ? pigName() : BREEDS[key]?.label || '');
function placeDesks() {
  officeOn = !!S.office;
  const key = `${officeOn}|${W}|${S.size}|${(S.officeFurn || []).join(',')}`;
  if (key !== officeKey) {
    officeKey = key;
    desks.forEach((d, k) => {
      d.group.visible = officeOn;
      d.place((k ? 1 : -1) * (W / 2 - 185 * S.size), -40, S.size * 1.25, k ? 1 : -1);
    });
    placeFurniture();
  }
  const w = workers();
  desks.forEach((d, k) => d.setName(w[k] ? workerName(w[k]) : ''));
}
// ---------- office furniture (辦公室家俬) ----------
const furn = { sofa: new Sofa(cat.ramp), cooler: new WaterCooler(cat.ramp), shelf: new Bookshelf(cat.ramp),
  board: new Whiteboard(cat.ramp), printer: new Printer(cat.ramp), plant: new BigPlant(cat.ramp) };
const furnOn = {};
for (const p of Object.values(furn)) { p.group.visible = false; scene.add(p.group); }
// Between the two desks: the sofa in the middle, then the rest alternately left and right while
// there's room (a narrow screen gets fewer pieces).
function placeFurniture() {
  const fs = S.size * 1.15, free = W / 2 - 300 * S.size, gap = 30 * fs;
  for (const k in furn) { furnOn[k] = false; furn[k].group.visible = false; }
  if (!officeOn) return;
  let left = 0, right = 0;
  const put = (k, side, z) => {
    const w = furn[k].WIDTH * fs;
    if (side === 0) { if (w / 2 > free) return; furn[k].place(0, z, fs); left = -w / 2 - gap; right = w / 2 + gap; }
    else {
      const edge = side < 0 ? left : right, x = edge + side * w / 2;
      if (Math.abs(x) + w / 2 > free) return;
      furn[k].place(x, z, fs);
      if (side < 0) left = x - w / 2 - gap; else right = x + w / 2 + gap;
    }
    furnOn[k] = true; furn[k].group.visible = true;
  };
  // only the pieces switched on in the settings; the first in the middle, the rest alternately left and right
  const Z = { sofa: -70, cooler: -80, shelf: -85, board: -95, printer: -80, plant: -80 };
  const chosen = ['sofa', 'cooler', 'shelf', 'board', 'printer', 'plant'].filter(k => (S.officeFurn || Object.keys(Z)).includes(k));
  chosen.forEach((k, i) => put(k, i === 0 ? 0 : i % 2 ? -1 : 1, Z[k]));
  usage.clear();
  // a piece that went away: whoever was up on it or using it gets down
  for (const f of friends.values()) if (f.brain.up) f.brain.hopDown(() => f.brain.decide());
  if (pigBrain.onSofa && !furnOn.sofa) pigBrain.offSofa();
  if (ai.surface && ['sofa', 'bookshelf'].includes(ai.surface.name) && ai.mode !== 'hop') jumpDown(decide);
  if (event && event.kind === 'meeting' && !furnOn.board) endEvent();
}
// where a bird can perch on the office furniture
function furnSpots() {
  if (!officeOn) return [];
  const out = [];
  if (furnOn.shelf && !usage.get('shelf')) out.push({ name: 'shelf', pos: furn.shelf.topSpot() });
  if (furnOn.plant) out.push({ name: 'plant', pos: furn.plant.topSpot() });
  if (furnOn.board) out.push({ name: 'board', pos: furn.board.topSpot() });
  if (furnOn.cooler) out.push({ name: 'cooler', pos: furn.cooler.top() });
  if (furnOn.printer) out.push({ name: 'printer', pos: furn.printer.top() });
  return out;
}
// who is using which seat or spot ('sofa0'..'sofa2', 'shelf', 'cooler')
const usage = new Map();
function claim(what, who) { const o = usage.get(what); if (o && o !== who) return false; usage.set(what, who); return true; }
function releaseAll(who) { for (const [k, v] of [...usage]) if (v === who) usage.delete(k); }
// what a pet can do with the office furniture (null at home)
function officeApi(who) {
  if (!officeOn) return null;
  return {
    sofa: () => {
      if (!furnOn.sofa) return null;
      for (const i of [1, 0, 2]) if (claim('sofa' + i, who)) return { ...furn.sofa.seat(i), side: furn.sofa.side(i < 1 ? -1 : i > 1 ? 1 : pick([-1, 1])) };
      return null;
    },
    shelf: () => (furnOn.shelf && claim('shelf', who) ? { ...furn.shelf.topSpot(), side: furn.shelf.side(furn.shelf.x < 0 ? 1 : -1) } : null),
    printer: () => (furnOn.printer ? furn.printer.spot() : null),
    // desks with someone at work, and where to sit in front of them
    desks: () => desks.map((d, k) => ({ k, spot: d.w(0, 0, d.D / 2 + 46), busy: workingAt(k) })).filter(v => v.busy && v.busy !== who),
    greetWorker: k => greetWorker(k),
    cooler: () => officeBowl(who),
    release: () => releaseAll(who),
  };
}
// who is sitting at desk k right now
function workingAt(k) {
  const key = workers()[k];
  if (!key) return null;
  if (key === 'main') return (catMain() && ai.mode === 'work') || (mainKind() === 'pig' && pigBrain.mode === 'work') || (mainKind() === 'bird' && flock[0].brain.mode === 'work') ? 'main' : null;
  if (key === 'pig') return pigBrain.mode === 'work' ? 'pig' : null;
  return friends.get(key)?.brain.mode === 'work' ? key : null;
}
function greetWorker(k) {
  const key = workingAt(k);
  if (key === 'main' && catMain()) mainWorker.wave();
  else if (key && friends.has(key)) friends.get(key).brain.worker.wave();
  else if (key) effect('wave', mainKind() === 'pig' || key === 'pig' ? pigBrain.headWorld() : flock[0].brain.headWorld());
}
// in the office the "bowl" is the water cooler (drinks only)
function officeBowl(key) {
  if (!furnOn.cooler || !claim('cooler', key)) return null;
  const sp = furn.cooler.spot();
  return { x: sp.x, z: sp.z, k: 1, yaw: sp.yaw };
}

// ---------- group events: meetings (office), parades and parties ----------
let event = null;
let nextMeeting = Date.now() + rand(3, 6) * MIN, nextPrint = Date.now() + rand(1, 3) * MIN, nextParade = Date.now() + rand(12, 25) * MIN;
// everyone who can join in: { key, join(kind, arg), over() } for the main cat/dog, the pig and the friends
function members() {
  const list = [];
  if (catMain() && !drag && !['held', 'fall'].includes(ai.mode)) list.push({ key: 'main', x: () => ai.x, z: () => ai.z });
  if (pigOn() && !pigDrag && !['held', 'fall'].includes(pigBrain.mode) && !pigBrain.reminding) list.push({ key: 'pig', x: () => pigBrain.x, z: () => pigBrain.z });
  for (const f of friends.values()) if (!(friendDrag && friendDrag.f === f) && !['held', 'fall'].includes(f.brain.mode)) list.push({ key: f.id, x: () => f.brain.x, z: () => f.brain.z });
  return list;
}
// send a member off to do its part
function act(key, what, ...args) {
  if (key === 'main') return mainAct(what, ...args);
  const b = key === 'pig' ? pigBrain : friends.get(key)?.brain;
  if (!b) return;
  if (what === 'attend') b.attend(args[0]);
  else if (what === 'present') b.present ? b.present(args[0]) : b.attend(args[0]);
  else if (what === 'line') b.joinLine(args[0]);
  else if (what === 'lead') b.lead(args[0], args[1]);
  else if (what === 'party') b.party();
  else if (what === 'over') { b.meetingOver?.(); b.eventOver?.(); }
}
function startMeeting() {
  nextMeeting = Date.now() + rand(7, 12) * MIN;
  if (!officeOn || !furnOn.board || pending || event) return false;
  const all = members().filter(m => m.key === 'main' || m.key === 'pig' || BREEDS[m.key]);
  if (all.length < 2) return false;
  // the main cat or dog presents if it can, otherwise one of the friends
  const presenter = all.find(m => m.key === 'main') || all.find(m => m.key !== 'pig');
  if (!presenter) return false;
  const audience = all.filter(m => m !== presenter).slice(0, 4);
  furn.board.write();
  event = { kind: 'meeting', t: 0, talk: 0, dur: 30, presenter: presenter.key, audience: audience.map(m => m.key) };
  act(presenter.key, 'present', furn.board.presenter());
  audience.forEach((m, i) => act(m.key, 'attend', furn.board.seat(i)));
  return true;
}
// a parade: the leader walks across the screen and back; everyone else follows in a line
function startParade() {
  nextParade = Date.now() + rand(15, 30) * MIN;
  if (pending || event) return false;
  const all = members();
  if (all.length < 2) return false;
  const lead = all[0], [x0, x1] = screenBounds();
  const fromLeft = lead.x() < 0, z = LANE[0] + 10;
  const points = [{ x: fromLeft ? x1 - 60 : x0 + 60, z }, { x: fromLeft ? x0 + 120 : x1 - 120, z }];
  event = { kind: 'parade', t: 0, dur: 70, lead: lead.key, trail: [{ x: lead.x(), z: lead.z() }], members: all.map(m => m.key) };
  act(lead.key, 'lead', points, () => endEvent());
  // keep a gap that suits each animal's size
  const size = k => (k === 'main' ? 1 : k === 'pig' ? 1.2 : BREEDS[k]?.size || 1);
  let gap = 0;
  all.slice(1).forEach((m, i) => { gap += (40 + 45 * (size(all[i].key) + size(m.key)) / 2) * S.size; const at = gap; act(m.key, 'line', () => trailPoint(at)); });
  for (const f of liveBirds()) if (!f.brain.reminding) f.brain.start('sing');
  say(pick([`排隊行喇！跟住我 ${face()}`, '大家一齊行 🎵', '出發！🐾']), 3000);
  return true;
}
// where `dist` back along the leader's path is
function trailPoint(dist) {
  const tr = event && event.kind === 'parade' ? event.trail : null;
  if (!tr) return null;
  let left = dist;
  for (let i = tr.length - 1; i > 0; i--) {
    const a = tr[i], b = tr[i - 1], seg = Math.hypot(a.x - b.x, a.z - b.z);
    if (seg >= left) { const k = left / seg; return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k }; }
    left -= seg;
  }
  return tr[0];
}
function startParty() {
  if (pending || event) return false;
  event = { kind: 'party', t: 0, dur: 10, members: members().map(m => m.key) };
  event.members.forEach(k => act(k, 'party'));
  for (const f of liveBirds()) f.brain.petted();
  if (mainKind() === 'pig' && !pigBrain.reminding) pigBrain.dance(8);
  say(pick(['派對時間！🎉', '一齊跳舞 🥳', '開心晒 🎊']), 3000);
  return true;
}
function endEvent() {
  if (!event) return;
  const e = event;
  event = null;
  if (e.kind === 'meeting') { act(e.presenter, 'over'); e.audience.forEach(k => act(k, 'over')); }
  if (e.kind === 'parade') { e.members.forEach(k => act(k, 'over')); hearts(3); }
}
function updateEvents(dt) {
  if (officeOn) for (const k of ['cooler', 'printer', 'plant']) if (furnOn[k]) furn[k].update(dt);
  // the printer prints now and then; someone comes over to look
  if (officeOn && furnOn.printer && Date.now() > nextPrint) {
    nextPrint = Date.now() + rand(2, 5) * MIN;
    furn.printer.print();
    effect('print', furn.printer.top());
    const idle = [...friends.values()].filter(f => !f.brain.busy && !f.brain.asleep && !f.brain.working);
    if (idle.length && !event) pick(idle).brain.start('printer');
  }
  if (!event && !pending) {
    if (officeOn && Date.now() > nextMeeting) startMeeting();
    else if (Date.now() > nextParade && (friends.size || pigOn())) startParade();
  }
  if (!event) return;
  const e = event;
  e.t += dt;
  if (pending || e.t > e.dur) { endEvent(); return; }
  if (e.kind === 'meeting') {
    // the board fills in while the presenter talks
    const presenting = e.presenter === 'main' ? ai.mode === 'present' : friends.get(e.presenter)?.brain.mode === 'present';
    if (presenting) { e.talk += dt; furn.board.progress(e.talk / 16); if (e.talk > 20) endEvent(); }
  } else if (e.kind === 'parade') {
    const lx = e.lead === 'main' ? ai.x : e.lead === 'pig' ? pigBrain.x : friends.get(e.lead)?.brain.x;
    const lz = e.lead === 'main' ? ai.z : e.lead === 'pig' ? pigBrain.z : friends.get(e.lead)?.brain.z;
    if (lx == null) { endEvent(); return; }
    const last = e.trail[e.trail.length - 1];
    if (Math.hypot(lx - last.x, lz - last.z) > 6) { e.trail.push({ x: lx, z: lz }); if (e.trail.length > 400) e.trail.shift(); }
  } else if (e.kind === 'party') {
    if (Math.random() < dt * 6) {
      const at = { x: rand(40, W - 40), y: H - rand(120, 260) };
      floaters(at, 1, ['🎉', '🎊', '✨', '🥳', '🎈', '💖'], 'heart');
    }
  }
}
// the main cat or dog joining in
function mainAct(what, arg, done) {
  const getDown = then => {
    if (ai.mode === 'work') { leaveDesk(then); return true; }
    if (ai.surface && ai.mode !== 'hop') { jumpDown(then); return true; }
    return false;
  };
  if (what === 'present' || what === 'attend') {
    if (getDown(() => mainAct(what, arg))) return;
    walkThen(arg.x, arg.z, () => { go(what, { dur: 40 }); ai.yawTarget = arg.yaw; }, 95);
  } else if (what === 'line') {
    if (getDown(() => mainAct(what, arg))) return;
    go('line', { target: arg, dur: 60 });
  } else if (what === 'lead') {
    if (getDown(() => mainAct(what, arg, done))) return;
    const step = i => (i >= arg.length ? done() : walkThen(arg[i].x, arg[i].z, () => step(i + 1), 70));
    step(0);
  } else if (what === 'party') {
    if (getDown(() => mainAct(what))) return;
    ai.happy = 3;
    if (dogMain()) start('run');
    else { ai.vy = 420; ai.vx = rand(-60, 60); go('jump', { party: 3 }); }
  } else if (what === 'over') {
    if (ai.mode === 'present') go('stretch', { dur: 1.8 });
    else if (ai.mode === 'attend') { effect('clap', cat.neck.localToWorld(v.set(10, 34, 0))); ai.happy = 1.2; go('sit', { dur: 3 }); }
    else if (ai.mode === 'line') { go('sit', { dur: 3 }); faceUser(); hearts(2); }
  }
}

// little effects over whoever is working
function effect(kind, p) {
  const at = toScreen(v.set(p.x, p.y, p.z));
  const text = { type: pick(['噠噠噠', '噠噠', '嗒嗒嗒']), idea: '💡', coffee: '☕', zzz: 'z', stretch: '～', talk: '💬', clap: '👏', wave: '👋',
    note: pick(['♪', '♫']), party: pick(['🎉', '🎊', '✨', '🥳']), drink: '咕嚕咕嚕', munch: '嚼嚼', print: '嗞嗞嗞' }[kind];
  if (text) floaters(at, 1, [text], ['type', 'drink', 'munch', 'print'].includes(kind) ? 'heart woof' : 'heart');
}

// ---------- the dogs' home (狗屋) ----------
const house = new DogHouse(cat.ramp);
scene.add(house.group);
let houseOn = false, houseKey = '';
const anyDog = () => dogMain() || [...friends.keys()].some(id => BREEDS[id].kind === 'dog');
// who sleeps where (0 = the doorway), and who is at which bowl
const slots = new Map(), bowls = [null, null];
function claimSlot(key) {
  if (slots.has(key)) return slots.get(key);
  const used = new Set(slots.values());
  for (let i = 0; i < 8; i++) if (!used.has(i)) { slots.set(key, i); return i; }
  return null;
}
function freeSlot(key) { slots.delete(key); }
function claimBowl(k, key) {
  if (officeOn) return officeBowl(key);
  if (!houseOn || (bowls[k] && bowls[k] !== key)) return null;
  bowls[k] = key;
  return house.bowl(k);
}
function freeBowl(k, key) {
  if (bowls[k] === key) bowls[k] = null;
  if (usage.get('cooler') === key) usage.delete('cooler');
}
// someone started eating or drinking: the water cooler glugs
function atBowl() { if (officeOn && furnOn.cooler) furn.cooler.drink(); }
function placeHouse() {
  const on = !S.office && S.dogHouse !== 'off' && anyDog();
  const key = `${on}|${S.dogHouse}|${S.tree}|${S.pigBed}|${pigOn()}|${W}|${S.size}`;
  if (key === houseKey) return;
  houseKey = key;
  houseOn = on;
  house.group.visible = on;
  if (on) {
    const side = S.dogHouse === 'left' ? -1 : 1;
    // further in when the cat tree or the pig's bed is already on that side
    let inset = 150;
    if (treeOn && S.tree === S.dogHouse) inset += 250;
    if (bedOn && S.pigBed === S.dogHouse) inset += 240;
    house.place(side * (W / 2 - inset * S.size), -75, S.size * 1.35, -side);
  }
  // the house moved or went away: everyone sleeping in it wakes up
  for (const o of friends.values()) if (o.brain.slot != null || o.brain.mode === 'enter') o.brain.wake();
  if (slots.has('main') && ['sleep', 'enter'].includes(ai.mode)) wake(false);
  slots.clear(); bowls[0] = bowls[1] = null;
}

function dropFriend(f) {
  scene.remove(f.animal.root, f.shadow);
  f.zzz.remove();
  freeSlot(f.id); freeBowl(0, f.id); freeBowl(1, f.id);
  if (friendDrag && friendDrag.f === f) friendDrag = null;
  friends.delete(f.id);
}
// new friends drop in from above, a little apart
function syncFriends() {
  const want = (S.friends || []).filter(id => BREEDS[id]);
  for (const f of [...friends.values()]) if (!want.includes(f.id)) dropFriend(f);
  const [x0, x1] = screenBounds();
  want.forEach((id, i) => {
    if (friends.has(id)) return;
    const f = makeFriend(id);
    Object.assign(f.brain, { x: rand(x0, x1) * 0.8, y: H * 0.55 + 300 + i * 140, z: rand(...LANE), vx: 0, vy: 0 });
    f.brain.go('fall');
  });
  placeHouse();
  placeDesks();
}
function updateFriend(f, dt) {
  const b = f.brain, a = f.animal, held = friendDrag && friendDrag.f === f && friendDrag.moved;
  if (held) { b.t += dt; a.gait.phase += dt * 9; a.gait.amp = 0.35; } else b.update(dt);
  const sc = friendScale(f), sq = b.squash * Math.cos(b.t * 25);
  a.root.position.set(b.x, b.y, b.z);
  a.root.rotation.y = b.yaw;
  a.root.scale.setScalar(sc);
  a.figure.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
  a.update(dt);
  const up = clamp(b.y / 500, 0, 0.7), ss = 110 * sc * (BREEDS[f.id].len || 1) * (1 - up);
  f.shadow.position.set(b.x + 4 * sc, 0.55, b.z);
  f.shadow.scale.set(ss, ss * 0.55, 1);
  f.shadow.material.opacity = 1 - up;
}

// The toys' frames are drawn on these two 2D layers, behind and in front of the cat's canvas.
const toyBack = document.createElement('canvas'), toyFront = document.createElement('canvas');
toyBack.className = 'toy-layer'; toyFront.className = 'toy-layer front';
document.body.append(toyBack, toyFront);
const toyBackCtx = toyBack.getContext('2d'), toyFrontCtx = toyFront.getContext('2d');
const failedToys = [];
const toys = new ToyBox(document.body, BOTTOM, placeToy, (t, state, msg) => {
  api.toyStatus?.(t.id, state, state === 'failed' ? [msg, history(t.id)].filter(Boolean).join('；') : msg);
  if (state !== 'failed') return;
  console.warn('toy failed', t.id, msg);
  failedToys.push(t.name);
  // wait until the cat has landed and said hello, so this isn't drawn over
  if (ai.mode !== 'fall') tellFailedToys();
});
// keep the main process up to date with where each toy is drawn (for the diagnostics report)
setInterval(() => {
  for (const t of toys.live()) {
    const s = t.state, g = s.gl;
    const info = [`用 ${t.modeName} 畫`, t.adapter && `顯示卡：${t.adapter}`,
      g && `材質程式 ${g.ready}/${g.started} 編譯好`, g && g.error,
      s.drawn === true ? '有畫到 ✓' : s.drawn === false ? '畫唔到嘢' : '未有畫面',
      t.frames ? `經貓貓畫布顯示（收到 ${t.frames} 次）` : '未收到畫面',
      s.errors ? `${s.errors} 個錯誤：${s.error}` : '', history(t.id)].filter(Boolean).join('；');
    api.toyStatus?.(t.id, 'ready', info, { l: s.l, r: s.r, t: s.t, b: s.b });
  }
}, 5000);
const history = id => (toys.history[id] || []).length ? '之前：' + toys.history[id].join(' → ') : '';
function tellFailedToys() {
  if (!failedToys.length) return;
  say(`${failedToys.splice(0).join('、')}出唔到嚟 😿 右撳我揀「複製診斷資料」，貼俾幫你整貓貓嘅人`, 9000);
}
function placeToy(i, n) {
  // spread the toys out, away from the cat tree and the pig's bed
  const left = officeOn || (treeOn && S.tree === 'left') || (bedOn && S.pigBed === 'left') || (houseOn && S.dogHouse === 'left');
  const right = officeOn || (treeOn && S.tree === 'right') || (bedOn && S.pigBed === 'right') || (houseOn && S.dogHouse === 'right');
  const a = left ? 0.3 : 0.15, b = right ? 0.68 : 0.85;
  return W * (a + (b - a) * (i + 0.5) / n);
}

// ---------- behaviour state ----------
const FRONT = -Math.PI / 2; // yaw that faces the screen
const ai = {
  mode: 'fall', t: 0, dur: 0, data: {}, x: 0, y: 0, z: 20, vx: 0, vy: 0, yaw: FRONT, yawTarget: FRONT,
  surface: null, // the tree surface the cat is on, or null for the floor
  awakeSince: Date.now(), lastMeal: Date.now() - rand(0, 5) * MIN, breakUntil: Date.now() + 8000, workUntil: 0, squash: 0, happy: 0, chaseCooldown: 0, toyCooldown: 0, chatAt: Date.now() + rand(8, 14) * MIN,
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
  // leaving the dog house, or a bowl
  if (!['sleep', 'enter'].includes(mode) && !(mode === 'walk' && data.toSlot)) freeSlot('main');
  if (mode !== 'eat' && !(mode === 'walk' && data.toBowl)) { freeBowl(0, 'main'); freeBowl(1, 'main'); }
  if (ai.mode === 'work' && mode !== 'work') ai.breakUntil = Date.now() + rand(1, 2.5) * MIN;
  ai.mode = mode; ai.t = 0; ai.dur = data.dur ?? 0; ai.data = data;
  cat.swat = 0;
  const pose = { sit: 'sit', remind: 'sit', sleep: 'loaf', groom: 'groom', stretch: 'stretch', held: 'held',
                 fall: 'leap', jump: 'leap', hop: 'crouch', scratch: 'scratch', pompom: 'reach',
                 toyBat: 'crouch', grabToy: 'crouch', eat: 'crouch', enter: 'loaf', bark: 'sit', work: 'sit', attend: 'sit', present: 'sit', yawn: data.pose || 'sit' }[mode] || 'stand';
  cat.setPose(pose);
  if (mode === 'work') mainWorker.begin();
  zzz.hidden = mode !== 'sleep';
}

// ---------- choosing what to do next ----------
// the main cat or dog at its desk
const mainWorker = new Worker(cat, kind => effect(kind, cat.neck.localToWorld(v.set(10, 34, 0))));
function leaveDesk(then) {
  const desk = deskFor('main'), side = desk ? desk.sideSpot() : { x: ai.x };
  ai.breakUntil = Date.now() + rand(1, 2.5) * MIN;
  zzz.hidden = true;
  go('hop', { from: { x: ai.x, y: ai.y, z: ai.z }, to: { x: clamp(side.x, ...screenBounds()), y: 0, z: laneZ() }, surface: null, then: then || (() => go('stretch', { dur: 2 })) });
}
function decide() {
  if (pending) { go('remind'); ai.yawTarget = FRONT; return; }
  // office mode: back to the desk after a break
  if (deskFor('main') && onFloor() && Date.now() > ai.breakUntil) return start('work');
  const awakeMin = (Date.now() - ai.awakeSince) / MIN;
  const sleepy = awakeMin > 6 ? 40 : awakeMin > 2 ? 6 : 0;
  let options;
  if (ai.surface) {
    const bed = ai.surface.name === 'bed' || ai.surface.name === 'sofa';
    options = [['sit', 14], ['groom', 8], ['look', 8], ['idle', 5], ['down', ai.surface.name === 'base' ? 60 : 12],
      ['sleep', bed ? sleepy + 15 : sleepy / 2]];
  } else {
    const playable = toys.live().filter(t => !t.state.held).length > 0;
    const dog = dogMain(), hungry = houseOn && Date.now() - ai.lastMeal > 4 * MIN;
    options = [
      ['walk', 26], ['idle', 10], ['sit', 12], ['groom', dog ? 0 : 7], ['stretch', 4], ['run', dog ? 6 : 3], ['jump', 3], ['look', 7],
      ['sleep', sleepy], ['eat', hungry || (officeOn && furnOn.cooler && Date.now() - ai.lastMeal > 4 * MIN) ? 12 : 0], ['bark', dog ? 4 : 0],
      // office mode on a break
      ['sofa', officeOn && furnOn.sofa ? 8 : 0], ['bookshelf', officeOn && furnOn.shelf && !dog ? 5 : 0],
      ['printer', officeOn && furnOn.printer ? 3 : 0], ['visitDesk', officeOn && officeApi('main').desks().length ? 5 : 0],
      // dogs don't climb the cat tree or scratch it, but they do like the pom-pom
      ['climb', treeOn && !dog ? 10 : 0], ['scratch', treeOn && !dog ? 6 : 0], ['pompom', treeOn ? 6 : 0],
      ['toyPlay', playable ? 16 : 0], ['toyCarry', playable ? 5 : 0], ['toyGift', playable ? 2 : 0],
      ['stalkBird', birdOnFloor() && Math.abs(birdOnFloor().brain.p.x - ai.x) < 600 ? 12 : 0],
      ['visitPig', pigAround() ? 7 : 0],
      ['visitFriend', friends.size ? 8 : 0],
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
      // in the office, a nap on the sofa
      if (officeOn && furnOn.sofa && onFloor() && Math.random() < 0.8) return start('sofa');
      // a sleepy dog goes home to the dog house
      if (dogMain() && onFloor() && houseOn) {
        const i = claimSlot('main');
        if (i != null) {
          const sp = house.slot(i, (20 * cat.spec.len + 10 + 30 * cat.spec.head) * S.size);
          return go('walk', { tx: clamp(sp.x, ...screenBounds()), tz: sp.door ? house.front() + 40 * house.s : sp.z, toSlot: true,
            then: () => go('enter', { sp }) });
        }
      }
      // a sleepy cat prefers the bed at the top of the tree, or curling up with a toy
      const toy = playableToy();
      if (onFloor() && treeOn && !dogMain() && Math.random() < 0.55) return climb('bed', () => start('sleep'));
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
    case 'stalkBird': go('stalk', { target: birdOnFloor() }); break;
    case 'visitPig': go('visitPig', { who: pigTarget }); break;
    case 'visitFriend': {
      const list = [...friends.values()].filter(f => !friendGone(f));
      if (!list.length) return start('idle');
      go('visitPig', { who: friendTarget(pick(list)) });
      break;
    }
    case 'toyCarry': approachToy(playableToy(), 'carry'); break;
    case 'eat': {
      const k = drinkNext || Math.random() < 0.5 ? 1 : 0, b = claimBowl(k, 'main');
      drinkNext = false;
      if (!b) return start('idle');
      const side = ai.x < b.x ? -1 : 1;
      go('walk', { tx: b.x + (b.yaw != null ? 0 : side * 45 * S.size), tz: b.z, toBowl: true,
        then: () => { go('eat', { dur: rand(4, 7), k: b.k ?? k }); if (b.yaw != null) ai.yawTarget = b.yaw; else faceToward(-side, 0); atBowl(); } });
      break;
    }
    case 'sofa': case 'bookshelf': {
      // office: up onto the sofa (to sit or nap) or, for a cat, the top of the bookshelf
      const o = officeApi('main'), spot = name === 'sofa' ? o?.sofa() : o?.shelf();
      if (!spot) return start('idle');
      const surf = { name, y: spot.y, x0: spot.x, x1: spot.x, z: spot.z };
      walkThen(spot.side.x, spot.side.z, () => hopTo(surf, () => {
        if (name === 'sofa' && (Date.now() - ai.awakeSince) / MIN > 3) { go('sleep', { dur: rand(40, 120) }); } else go('sit', { dur: rand(6, 14) });
        ai.yawTarget = spot.yaw;
      }), 70);
      break;
    }
    case 'printer': {
      const p = officeApi('main')?.printer();
      if (!p) return start('idle');
      walkThen(p.x, p.z, () => { go('sit', { dur: rand(3, 6) }); ai.yawTarget = p.yaw; }, 70);
      break;
    }
    case 'visitDesk': {
      const list = officeApi('main')?.desks() || [];
      if (!list.length) return start('idle');
      const v = pick(list);
      walkThen(v.spot.x, v.spot.z, () => { go('sit', { dur: rand(4, 7) }); ai.yawTarget = Math.PI / 2; greetWorker(v.k); hearts(2); }, 70);
      break;
    }
    case 'bark': go('bark', { dur: rand(1.5, 2.5), n: 1 + Math.floor(rand(0, 3)), next: 0.2 }); faceUser(); break;
    case 'work': {
      // round to the side of the desk, then up onto the chair
      const desk = deskFor('main');
      if (!desk) return start('idle');
      const side = desk.sideSpot(), seat = desk.seatSpot();
      walkThen(side.x, side.z, () => go('hop', { from: { x: ai.x, y: ai.y, z: ai.z }, to: { x: seat.x, y: desk.top() * 0.6, z: seat.z }, surface: null,
        then: () => { ai.workUntil = Date.now() + rand(4, 9) * MIN; go('work'); } }), 75);
      break;
    }
    case 'toyGift': approachToy(playableToy(), 'gift'); break;
    default: go('idle', { dur: 2 });
  }
}
function wake(greet) {
  ai.awakeSince = Date.now();
  go('yawn', { pose: 'loaf', then: 'stretch' });
  if (greet) { purr(); say(`${word()}…我醒咗喇 ${face()}`, 3000); }
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
  if (!ai.surface && !['walk', 'hop', 'eat'].includes(ai.mode) && [...usage.values()].includes('main')) releaseAll('main');
  const d = ai.data;
  cat.gait.amp *= ['walk', 'run', 'chase', 'come', 'held', 'toyGo', 'carry', 'stalk', 'enter', 'line'].includes(ai.mode) || (ai.mode === 'visitPig' && !d.arrived) ? 1 : Math.exp(-dt * 8);
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
      if (d.party > 1) { ai.vy = 420; ai.vx = rand(-60, 60); go('jump', { party: d.party - 1 }); break; }
      if (d.pounceBird) {
        go('sit', { dur: 4 }); faceUser();
        if (Math.random() < 0.6) say(pick([`飛咗咩 ${face()}`, `${birdName(d.pounceBird.i)}好快呀！`, `下次一定捉到 ${face()}`]), 2500);
        break;
      }
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
        go('sit', { dur: 5 }); ai.yawTarget = FRONT; say(`我係${S.name}，今日陪你做嘢 🐾`, 4000); voice();
        setTimeout(tellFailedToys, 4500);
      }
      else if (ai.mode === 'fall' && landed > 0.45) { go('sit', { dur: 3 }); faceUser(); say(pick(OUCH()), 3000); }
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
    case 'stalk': updateStalk(dt); break;
    case 'enter': {
      // back into the dog house doorway (or onto the mat), then sleep
      const sp = d.sp, k = clamp(ai.t / 0.8, 0, 1);
      if (!d.from) d.from = { x: ai.x, z: ai.z };
      ai.x = d.from.x + (sp.x - d.from.x) * k; ai.z = d.from.z + (sp.z - d.from.z) * k;
      ai.yawTarget = sp.yaw;
      if (k >= 1) { go('sleep', { dur: rand(60, 160) }); ai.yaw = sp.yaw; }
      break;
    }
    case 'work': {
      // at the desk: typing away; then a break
      const desk = deskFor('main');
      if (!desk || pending) { leaveDesk(); break; }
      mainWorker.update(dt);
      ai.yawTarget = desk.seatSpot().yaw;
      const pts = catPoints(cat);
      fitSeat(ai, pts.paws, pts.eye, desk, 1 - Math.exp(-dt * 6));
      desk.setSeat(ai.y);
      zzz.hidden = !mainWorker.dozing;
      if (Date.now() > ai.workUntil) leaveDesk();
      break;
    }
    case 'line': {
      const p = d.target();
      if (!p || ai.t > d.dur) { go('sit', { dur: 3 }); faceUser(); break; }
      const dist = Math.hypot(p.x - ai.x, p.z - ai.z);
      if (dist > 14) walkTo(dt, p.x, p.z, dist > 80 ? 170 : 75);
      if (ai.t > (d.note ?? 1)) { d.note = ai.t + rand(2, 4); effect('note', cat.neck.localToWorld(v.set(10, 34, 0))); }
      break;
    }
    case 'attend':
      cat.target.headPitch = Math.sin(ai.t * 1.3) > 0.85 ? 0.3 : 0;
      if (ai.t > ai.dur) decide();
      break;
    case 'present':
      cat.target.legs = [0, 2.3 + Math.sin(ai.t * 3) * 0.2, -1.2, -1.2];
      cat.target.mouth = Math.sin(ai.t * 11) > 0.3 ? 0.4 : 0;
      if (ai.t > (d.say ?? 1)) { d.say = ai.t + rand(1.8, 3); effect(pick(['talk', 'talk', 'idea']), cat.neck.localToWorld(v.set(10, 34, 0))); }
      if (ai.t > ai.dur) decide();
      break;
    case 'eat':
      cat.target.headPitch = 0.75 + Math.sin(ai.t * (d.k ? 9 : 6)) * 0.12;
      if (ai.t > (d.say ?? 0.6)) { d.say = ai.t + 1.6; floaters(toScreen(cat.neck.localToWorld(v.set(30, 20, 0))), 1, [d.k ? '咕嚕咕嚕' : '嚼嚼'], 'heart woof'); }
      if (ai.t > ai.dur) { ai.lastMeal = Date.now(); go('sit', { dur: rand(3, 6) }); faceUser(); }
      break;
    case 'bark':
      if (ai.t > d.next && d.n > 0) { d.n--; d.next = ai.t + 0.45; voice(1); d.open = ai.t; floaters(anchor, 1, ['汪！'], 'heart woof'); }
      cat.target.mouth = d.open != null && ai.t - d.open < 0.18 ? 0.8 : 0;
      if (ai.t > ai.dur) decide();
      break;
    case 'visitPig': updateVisitPig(dt); break;
  }
  // a bird flying about is hard not to watch
  if (!ai.look && ['idle', 'sit', 'walk', 'look', 'groom'].includes(ai.mode)) {
    const f = liveBirds().find(f => f.brain.mode === 'fly' && Math.hypot(f.brain.p.x - ai.x, f.brain.p.y - ai.y) < 600);
    if (f) ai.look = { ...f.brain.p };
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
    if (d.swats <= 0) { go('sit', { dur: rand(3, 6) }); faceUser(); if (Math.random() < 0.4) say(pick([`好好玩 ${face()}`, '再嚟！', `${word()}${word()}～`]), 2500); return; }
    d.swats--;
    d.next = ai.t + rand(0.6, 1.1);
    d.swatT = ai.t;
    d.hit = false;
  }
  const since = d.swatT != null ? ai.t - d.swatT : 9;
  cat.swat = since < 0.35 ? since : 0;
  if (!d.hit && since > 0.15 && since < 0.35) { d.hit = true; swatToy(t, side); }
}

// Creep up on a bird, wiggle, pounce. The birds always get away.
function updateStalk(dt) {
  const d = ai.data, f = d.target;
  if (!f || f.i >= birdCount() || !birdIsDown(f) || ai.t > 15) { go('sit', { dur: 3 }); faceUser(); return; }
  const b = f.brain, bx = b.p.x, side = bx >= ai.x ? 1 : -1;
  ai.look = { ...b.p };
  if (!d.crouching) {
    if (!walkTo(dt, bx - side * 140 * S.size, b.p.z, 45)) return;
    d.crouching = true; d.t0 = ai.t;
    cat.setPose('crouch');
    if (Math.random() < 0.4) setTimeout(() => b.flee(), rand(300, 900)); // sometimes it notices early
    return;
  }
  faceToward(side, 0);
  cat.target.tailSpeed = 9;
  cat.figure.position.x = Math.sin(ai.t * 30) * 1.5;
  if (ai.t - d.t0 > 1.1) {
    cat.figure.position.x = 0;
    // every bird nearby scatters
    for (const o of liveBirds()) if (birdIsDown(o) && Math.abs(o.brain.p.x - ai.x) < 400) o.brain.flee();
    ai.vy = 470; ai.vx = (bx - ai.x) / (2 * 470 / 1800);
    go('jump', { pounceBird: f });
  }
}

// Go and say hello to the pig or a friend: walk up, sit facing it, nose to nose.
// `who` is { ok(), x(), z(), h, gap, greet(fromX), line }
const pigTarget = {
  ok: () => pigAround(), x: () => pigBrain.x, z: () => pigBrain.z, h: () => 50 * pigScale(), gap: () => 95 * S.size,
  greet: x => pigBrain.greet(x), line: () => `${pigName()}好可愛 🐷`,
};
function updateVisitPig(dt) {
  const d = ai.data, w = d.who;
  if (!w.ok() || ai.t > 20) { go('sit', { dur: 3 }); faceUser(); return; }
  const px = w.x(), side = px >= ai.x ? 1 : -1;
  ai.look = { x: px, y: w.h(), z: w.z() };
  if (!d.arrived) {
    if (!walkTo(dt, px - side * w.gap(), clamp(w.z(), ...LANE), 70)) return;
    d.arrived = true; d.t0 = ai.t; d.stay = rand(4, 7);
    cat.setPose('sit');
    faceToward(side, 0);
    w.greet(ai.x);
    // a cat licks a cat friend's head; with a dog, a game
    if (!dogMain() && w.kind === 'cat') cat.setPose('groom');
    else if (w.kind === 'dog' && Math.random() < 0.6) { w.play(ai.x); if (dogMain()) { hearts(2); start('run'); return; } }
    hearts(2);
    purr();
    return;
  }
  faceToward(side, 0);
  if (ai.t - d.t0 > d.stay) { go('sit', { dur: rand(3, 6) }); faceUser(); if (Math.random() < 0.4) say(pick([w.line(), '我哋係好朋友 🐾']), 3000); }
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
  if (S.chatty && !pending && ai.mode !== 'sleep' && bubble.hidden) { say(pick(CHAT()), 6000); ai.happy = 1.2; }
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
// floating effects: hearts over the cat (or a given screen point), music notes for the bird
function floaters(at, n, chars, cls) {
  for (let i = 0; i < n; i++) {
    const h = document.createElement('span');
    h.className = cls;
    h.textContent = pick(chars);
    h.style.left = (at.x + rand(-20, 20)) + 'px';
    h.style.top = (at.y + 6) + 'px';
    h.style.animationDelay = (i * 150) + 'ms';
    fx.append(h);
    setTimeout(() => h.remove(), 2200);
  }
}
function hearts(n = 3, at = anchor) { if (at) floaters(at, n, ['💗', '💕', '✨', '💗'], 'heart'); }
function notes(at) { floaters(at, 1, ['♪', '♫', '♬'], 'heart note'); }
function petCat() {
  if (ai.mode === 'sleep') { wake(true); return; }
  hearts(); purr(); ai.happy = 1.8;
  api.petted();
  jealousy(ai.x, 'main');
  if (['walk', 'run', 'idle', 'toyGo'].includes(ai.mode)) { go('sit', { dur: 5 }); ai.yawTarget = FRONT; }
}

// ---------- messages from the main process ----------
let lastRemind = null, drinkNext = false;
// The main pet gives the reminder; everyone else gathers round.
function startRemind() {
  const k = mainKind();
  if (catMain()) {
    if (ai.mode === 'sleep') ai.awakeSince = Date.now();
    if (ai.mode === 'work') leaveDesk(); // the hop down ends in the reminder
    else if (!['held', 'fall', 'hop'].includes(ai.mode)) { go('remind'); ai.vy = 300; }
    ai.yawTarget = FRONT;
  } else if (k === 'pig') pigBrain.remind();
  else flock[0].brain.remind();
}
api.on('reminder', r => {
  pending = r;
  lastRemind = r.type;
  startRemind();
  ask(r.text);
  voice(2);
  // the birds come over and sing along; the pig comes to cheer; the friends gather round
  for (const f of liveBirds()) if (!(mainKind() === 'bird' && f.i === 0)) f.brain.cheer();
  if (pigOn() && mainKind() !== 'pig' && !pigDrag) pigBrain.cheer();
  for (const f of friends.values()) if (friendDrag?.f !== f) f.brain.cheer();
});
api.on('nag', () => {
  const k = mainKind();
  if (catMain()) { if (ai.mode === 'remind') ai.vy = 300; }
  else if (k === 'pig') pigBrain.nag();
  else flock[0].brain.nag();
  voice(2);
});
api.on('reminder-end', r => {
  pending = null;
  if (r.done) { hearts(); purr(); ai.happy = 1.8; }
  say(r.text, 4500);
  const k = mainKind();
  if (k === 'pig') pigBrain.endRemind(r.done);
  else if (k === 'bird') flock[0].brain.endRemind(r.done);
  else if (ai.mode === 'remind') { go('sit', { dur: 4 }); faceUser(); }
  // after "drink some water", the main cat or dog goes for a drink too
  if (r.done && lastRemind === 'water' && catMain() && (houseOn || (officeOn && furnOn.cooler))) {
    setTimeout(() => {
      if (pending || !['sit', 'idle'].includes(ai.mode) || ai.surface) return;
      say('我都去飲啖水 💧', 2500);
      drinkNext = true;
      start('eat');
    }, 2600);
  }
});
api.on('say', r => say(r.text, 5000));
api.on('come-here', () => {
  say(`${word()}？叫我呀？${face()}`, 3000);
  const [x0, x1] = screenBounds();
  const x = cursor && cursor.x >= 0 && cursor.x <= W ? clamp(cursorWorldX(), x0, x1) : 0;
  if (mainKind() === 'pig') pigBrain.come(x);
  else if (mainKind() === 'bird') flock[0].brain.come(x);
  else {
    if (ai.mode === 'sleep') ai.awakeSince = Date.now();
    const comeOver = () => go('come', { tx: x });
    ai.surface && ai.mode !== 'hop' ? jumpDown(comeOver) : comeOver();
  }
  for (const f of friends.values()) if (friendDrag?.f !== f) f.brain.cheer();
});
api.on('toy-action', a => toys.action(a));
api.on('bird-action', a => { if (a === 'sing') for (const f of liveBirds()) f.brain.petted(); });
api.on('group-action', a => {
  const ok = a === 'parade' ? startParade() : a === 'party' ? startParty() : a === 'meeting' ? startMeeting() : false;
  if (!ok) say(a === 'meeting' && !officeOn ? '開咗辦公室模式先可以開會 💼' : pending ? '等我提完你先 😺' : '而家做唔到，遲啲再試 🐾', 3000);
});
api.on('pig-action', a => { if (a === 'dance' && pigOn() && !pigDrag) pigBrain.petted(); });
api.on('settings', s => applySettings(s));
$('btnDone').addEventListener('click', () => api.answer(true));
$('btnLater').addEventListener('click', () => api.answer(false));

function applySettings(s) {
  const soundWasOn = S.sound;
  S = { ...S, ...s };
  if (S.sound && soundWasOn === false && frameStarted) voice(); // let them hear it when switched on
  // the main pet: which animal, and if it's the cat or a dog, which breed
  const kind = mainKind(), wasCat = cat.root.visible;
  if (catMain()) cat.setBreed(kind === 'dog' ? (BREEDS[S.dogBreed]?.kind === 'dog' ? S.dogBreed : 'golden') : S.breed, S.coat);
  cat.root.visible = shadow.visible = catMain();
  if (!catMain()) { zzz.hidden = true; drag = null; freeSlot('main'); }
  else if (!wasCat && frameStarted) { const [x0, x1] = screenBounds(); ai.x = rand(x0, x1) * 0.5; ai.y = H * 0.55; ai.surface = null; go('fall', { welcome: true }); }
  if (kind !== lastKind && frameStarted) {
    // the old main pet stops reminding; the new one takes over
    pigBrain.reminding = false; flock[0].brain.reminding = false;
    if (pending) startRemind();
    if (!catMain()) setTimeout(() => say(`我係${S.name}，今日陪你做嘢 🐾`, 4000), 2500);
  }
  lastKind = kind;
  placeTree();
  placeCages();
  placeBed();
  flock.forEach((f, i) => {
    const on = i < birdCount();
    if (on && !f.bird.root.visible && frameStarted) birdArrives(f);
    f.bird.root.visible = f.shadow.visible = on;
    if (!on) f.zzz.hidden = true;
    f.bird.setColor(S.birds[i]?.color || 'yellow');
  });
  if (pigOn() && !pig.root.visible && frameStarted) pigArrives();
  pig.root.visible = pigShadow.visible = pigOn();
  if (!pigOn()) { pigZzz.hidden = true; pigBed.tuck(false); }
  toys.set(S.toys || [], Math.round(S.toySize || 80));
  if (frameStarted) syncFriends();
  placeHouse();
  placeDesks();
}
let lastKind = null;
// a bird (newly switched on, or at the start) flies in from the top of the screen
function birdArrives(f, above = 60) {
  const [x0, x1] = screenBounds(), b = f.brain;
  b.spot = { kind: 'floor', x: 0, z: 25 };
  Object.assign(b.p, { x: rand(x0, x1), y: ceiling() + above, z: 25 });
  // to its own cage: a free side of the roof, or else inside on the perch
  const home = f.home(), roof = side => ({ kind: 'roof', cage: home, side });
  if (home == null) b.flyTo({ kind: 'floor', x: rand(x0, x1), z: rand(...LANE) });
  else b.flyTo([roof(1), roof(-1)].find(r => !b.taken(r)) || b.homePerch());
}
// the pig drops in, like the cat
function pigArrives(y = H * 0.5) {
  const [x0, x1] = screenBounds();
  pigBrain.inBed = false;
  Object.assign(pigBrain, { x: clamp(-ai.x * 0.6 + rand(-80, 80), x0, x1), y, z: 28, vx: 0, vy: 0 });
  pigBrain.go('fall');
}
let cageKey = '';
function placeCages() {
  const key = `${S.cage}|${W}|${H}|${S.size}`;
  if (key === cageKey) return;
  cageKey = key;
  cagesOn = [S.cage === 'both' || S.cage === 'left', S.cage === 'both' || S.cage === 'right'];
  // hang from the top of the screen, a little in from each corner
  const z = -20, y = (H - 64 - BOTTOM + z * Math.sin(TILT)) / Math.cos(TILT);
  cages.forEach((c, i) => {
    c.group.visible = cagesOn[i];
    c.place((i ? 1 : -1) * (W / 2 - 150 * S.size), y, z, S.size);
  });
}
let bedKey = '';
function placeBed() {
  const key = `${S.office}|${pigOn()}|${S.pigBed}|${S.tree}|${W}|${S.size}`;
  if (key === bedKey) return;
  bedKey = key;
  bedOn = !S.office && pigOn() && (S.pigBed === 'left' || S.pigBed === 'right');
  pigBed.group.visible = bedOn;
  if (bedOn) {
    const side = S.pigBed === 'left' ? -1 : 1;
    // move inwards if the cat tree already stands on that side
    const inset = treeOn && S.tree === S.pigBed ? 360 : 140;
    pigBed.place(side * (W / 2 - inset * S.size), -50, S.size * 1.25);
  }
  // the bed moved or went away under the pig: get up
  if (pigBrain.inBed) {
    pigBrain.inBed = false; pigBed.tuck(false);
    if (!['held', 'fall'].includes(pigBrain.mode)) { pigBrain.vx = 0; pigBrain.vy = 0; pigBrain.go('fall'); }
  }
}
let treeKey = '';
function placeTree() {
  const key = `${S.office}|${S.tree}|${W}|${S.size}`;
  if (key === treeKey) return;
  treeKey = key;
  treeOn = !S.office && (S.tree === 'left' || S.tree === 'right');
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
  if (!catMain() || !rect || x < rect.l - 4 || x > rect.r + 4 || y < rect.t - 4 || y > rect.b + 4) return false;
  ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(cat.root, true).length > 0;
}
// the bird under the pointer, if any
function overBird(x, y) {
  const live = liveBirds();
  if (!live.length) return null;
  ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return live.find(f => raycaster.intersectObject(f.bird.root, true).length > 0) || null;
}
function overFriend(x, y) {
  if (!friends.size) return null;
  ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return [...friends.values()].find(f => raycaster.intersectObject(f.animal.root, true).length > 0) || null;
}
function overPig(x, y) {
  if (!pigOn()) return false;
  ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(pig.root, true).length > 0;
}
function overBubble(x, y) {
  if (bubble.hidden) return false;
  const b = bubble.getBoundingClientRect();
  return x > b.left - 6 && x < b.right + 6 && y > b.top - 6 && y < b.bottom + 12;
}
function updateCapture() {
  const onCat = !!drag || !!birdDrag || !!pigDrag || !!friendDrag || (cursor && (overCat(cursor.x, cursor.y) || overBird(cursor.x, cursor.y)
    || overPig(cursor.x, cursor.y) || overFriend(cursor.x, cursor.y) || overBubble(cursor.x, cursor.y)));
  const toy = onCat ? null : toys.hovered();
  // route the mouse: the cat's canvas, or the toy's own page underneath it
  canvas.style.pointerEvents = toy ? 'none' : 'auto';
  for (const t of toys.toys.values()) t.el.style.pointerEvents = t === toy ? 'auto' : 'none';
  const want = onCat || !!toy;
  if (want !== captured) {
    captured = want;
    api.setThrough(!want);
  }
  canvas.style.cursor = onCat ? ([drag, birdDrag, pigDrag, friendDrag].some(g => g && g.moved) ? 'grabbing' : 'grab') : '';
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
        ai.strokeDist = 0; ai.strokeCooldown = 3; hearts(2); purr(); ai.happy = 1.5;
      }
    } else ai.strokeDist = 0;
  }
  lastCursor = c; lastCursorT = now; cursor = c;
}, 33);

function pointerWorld(e, z = ai.z) {
  ndc.set(e.clientX / W * 2 - 1, -(e.clientY / H) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -z), hit);
}
// a bird: click to make it sing, drag to hold it (it flaps), let go and it flies off
let birdDrag = null;
canvas.addEventListener('pointerdown', e => {
  const f = e.button === 0 && overBird(e.clientX, e.clientY);
  if (!f) return;
  e.stopImmediatePropagation();
  canvas.setPointerCapture(e.pointerId);
  birdDrag = { f, x: e.clientX, y: e.clientY, moved: false };
});
canvas.addEventListener('pointermove', e => {
  if (!birdDrag) return;
  e.stopImmediatePropagation();
  const b = birdDrag.f.brain;
  if (!birdDrag.moved && Math.hypot(e.clientX - birdDrag.x, e.clientY - birdDrag.y) < 6) return;
  if (!birdDrag.moved) { birdDrag.moved = true; b.grab(); }
  const p = pointerWorld(e, b.p.z);
  if (p) { b.p.x = clamp(p.x, ...screenBounds()); b.p.y = Math.max(0, p.y - 22 * S.size); }
});
const endBirdDrag = e => {
  if (!birdDrag) return;
  e.stopImmediatePropagation();
  const d = birdDrag;
  birdDrag = null;
  if (d.moved) d.f.brain.release();
  else { d.f.brain.petted(); if (mainKind() === 'bird' && d.f.i === 0) api.petted(); }
};
canvas.addEventListener('pointerup', endBirdDrag);
canvas.addEventListener('pointercancel', endBirdDrag);
// the pig: click and it dances, drag to pick it up (legs kicking), let go and it drops
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0 || birdDrag || !overPig(e.clientX, e.clientY)) return;
  e.stopImmediatePropagation();
  canvas.setPointerCapture(e.pointerId);
  pigDrag = { x: e.clientX, y: e.clientY, moved: false, vx: 0, vy: 0, lx: 0, ly: 0, lt: performance.now() };
});
canvas.addEventListener('pointermove', e => {
  if (!pigDrag) return;
  e.stopImmediatePropagation();
  const g = pigDrag;
  if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 6) return;
  const p = pointerWorld(e, pigBrain.z);
  if (!p) return;
  if (!g.moved) { g.moved = true; pigBed.tuck(false); pigBrain.grab(); g.lx = p.x; g.ly = p.y; }
  const now = performance.now(), dt = Math.max(0.001, (now - g.lt) / 1000);
  g.vx = g.vx * 0.5 + ((p.x - g.lx) / dt) * 0.5;
  g.vy = g.vy * 0.5 + ((p.y - g.ly) / dt) * 0.5;
  g.lx = p.x; g.ly = p.y; g.lt = now;
  pigBrain.x = clamp(p.x, ...screenBounds());
  pigBrain.y = Math.max(0, p.y - 50 * pigScale());
});
const endPigDrag = e => {
  if (!pigDrag) return;
  e.stopImmediatePropagation();
  const g = pigDrag;
  pigDrag = null;
  if (g.moved) pigBrain.release(g.vx, g.vy);
  else { pigBrain.petted(); if (mainKind() === 'pig') api.petted(); jealousy(pigBrain.x, 'pig'); }
};
canvas.addEventListener('pointerup', endPigDrag);
canvas.addEventListener('pointercancel', endPigDrag);
// a dog or cat friend: click to pet it, drag to pick it up, let go and it drops
canvas.addEventListener('pointerdown', e => {
  const f = e.button === 0 && !birdDrag && !pigDrag && !overCat(e.clientX, e.clientY) && overFriend(e.clientX, e.clientY);
  if (!f) return;
  e.stopImmediatePropagation();
  canvas.setPointerCapture(e.pointerId);
  friendDrag = { f, x: e.clientX, y: e.clientY, moved: false, vx: 0, vy: 0, lx: 0, ly: 0, lt: performance.now() };
});
canvas.addEventListener('pointermove', e => {
  if (!friendDrag) return;
  e.stopImmediatePropagation();
  const g = friendDrag, b = g.f.brain;
  if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 6) return;
  const p = pointerWorld(e, b.z);
  if (!p) return;
  if (!g.moved) { g.moved = true; b.grab(); g.lx = p.x; g.ly = p.y; }
  const now = performance.now(), dt = Math.max(0.001, (now - g.lt) / 1000);
  g.vx = g.vx * 0.5 + ((p.x - g.lx) / dt) * 0.5;
  g.vy = g.vy * 0.5 + ((p.y - g.ly) / dt) * 0.5;
  g.lx = p.x; g.ly = p.y; g.lt = now;
  b.x = clamp(p.x, ...screenBounds());
  b.y = Math.max(0, p.y - 55 * friendScale(g.f));
});
const endFriendDrag = e => {
  if (!friendDrag) return;
  e.stopImmediatePropagation();
  const g = friendDrag;
  friendDrag = null;
  if (g.moved) g.f.brain.release(g.vx, g.vy); else g.f.brain.petted();
};
canvas.addEventListener('pointerup', endFriendDrag);
canvas.addEventListener('pointercancel', endFriendDrag);
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
    voice();
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
canvas.addEventListener('contextmenu', e => { e.preventDefault(); if (overCat(e.clientX, e.clientY) || overBird(e.clientX, e.clientY) || overPig(e.clientX, e.clientY) || overFriend(e.clientX, e.clientY)) api.contextMenu(); });

// ---------- frame loop ----------
const box = new THREE.Box3(), v = new THREE.Vector3();
let anchor = null;
function toScreen(p) { v.copy(p).project(camera); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H }; }
function measure() {
  if (!catMain()) {
    // the bubble hangs over the bird's or the pig's head
    rect = null;
    const h = mainKind() === 'pig' ? pigBrain.headWorld() : flock[0].brain.headWorld();
    const p = toScreen(v.set(h.x, h.y + 6, h.z));
    anchor = { x: p.x, y: p.y };
    return;
  }
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
  for (const f of liveBirds()) {
    if (f.zzz.hidden) continue;
    const h = toScreen(v.set(f.brain.p.x, f.brain.p.y + 38 * S.size, f.brain.p.z));
    f.zzz.style.transform = `translate(${h.x + 6}px, ${h.y}px) scale(0.75)`;
  }
  for (const f of friends.values()) {
    if (f.zzz.hidden) continue;
    const h = toScreen(f.brain.headWorld());
    f.zzz.style.transform = `translate(${h.x + 10}px, ${h.y}px) scale(0.85)`;
  }
  if (!pigZzz.hidden) {
    const h = toScreen(v.set(pigBrain.x - (pigBrain.inBed ? 22 : 0) * pigScale(), pigBrain.y + (pigBrain.inBed ? 52 : 80) * pigScale(), pigBrain.z));
    pigZzz.style.transform = `translate(${h.x}px, ${h.y}px) scale(0.9)`;
  }
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
  const calm = (!catMain() || ['sleep', 'sit', 'idle', 'groom', 'remind', 'work'].includes(ai.mode)) && !drag && !birdFlying() && !birdDrag
    && !(pigOn() && ((pigBrain.busy && pigBrain.mode !== 'work') || pigDrag)) && !friendDrag && ![...friends.values()].some(f => f.brain.busy && f.brain.mode !== 'work');
  if (acc < (calm ? 1 / 24 : 1 / 40)) return;
  const dt = Math.min(0.05, acc);
  acc = 0;

  if (catMain()) updateMain(dt);
  else maybeChat();
  if (treeOn) tree.update(dt);
  cages.forEach((c, i) => { if (cagesOn[i]) c.update(dt); });
  for (const f of liveBirds()) updateBird(f, dt);
  if (pigOn()) updatePig(dt);
  for (const f of friends.values()) updateFriend(f, dt);
  if (bedOn) pigBed.update(dt);
  updateEvents(dt);

  renderer.render(scene, camera);
  if (!shownOnce) { shownOnce = true; api.ready?.(); }
  measure();
  placeOverlays();
  updateCapture();
}

// the main cat or dog, each frame
function updateMain(dt) {
  update(dt);
  const headScreen = anchor ? { x: anchor.x, y: anchor.y + 30 * S.size } : null;
  updateGaze(dt, headScreen);
  if (ai.happy > 0) {
    ai.happy -= dt;
    cat.target.eyeOpen = ai.happy > 0 ? 0.12 : cat.baseTarget.eyeOpen;
  }
  // a happy dog pants and wags
  if (dogMain() && (ai.happy > 0 || ['remind', 'come'].includes(ai.mode))) {
    cat.target.mouth = 0.45 + Math.sin(ai.t * 14) * 0.08;
    cat.target.tailSpeed = 14; cat.target.tailAmp = 0.45;
  }
  if (ai.strokeCooldown > 0) ai.strokeCooldown -= dt;
  ai.yaw += angleDiff(ai.yawTarget, ai.yaw) * (1 - Math.exp(-dt * 7));

  cat.root.position.set(ai.x, ai.y, ai.z);
  cat.root.rotation.y = ai.yaw;
  cat.root.scale.setScalar(S.size * (dogMain() ? BREEDS[cat.breed]?.size || 1 : 1));
  ai.squash *= Math.exp(-dt * 7);
  const sq = ai.squash * Math.cos(ai.t * 25);
  cat.figure.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
  cat.update(dt);

  // the shadow sits on whatever is underneath: a tree surface or the floor
  const below = ai.mode === 'hop' ? (ai.data.surface ? ai.data.surface.y : 0) : (ai.surface ? ai.surface.y : landingSurface(ai.x, ai.y)?.y || 0);
  const lift = clamp((ai.y - below) / 500, 0, 0.7);
  const ss = 115 * S.size * (1 - lift);
  shadow.position.set(ai.x + 5 * S.size, below + 0.6, ai.z);
  shadow.scale.set(ss, ss * 0.55, 1);
  shadow.material.opacity = 1 - lift;
}
function updateBird(f, dt) {
  const { brain: b, bird } = f;
  b.update(dt);
  bird.root.position.set(b.p.x, b.p.y, b.p.z);
  bird.root.rotation.y = b.yaw;
  bird.root.scale.setScalar(S.size);
  bird.update(dt);
  // its shadow: on whatever it stands on (the cage floor when inside), or on the floor below while flying
  const flying = b.mode === 'fly' || b.mode === 'held', k = b.spot.kind;
  const cg = b.spot.cage != null ? cages[b.spot.cage] : null;
  let gy = 0, show = true;
  if (!flying && (k === 'perch' || k === 'swing') && cg) gy = cg.floorY();
  else if (!flying && k === 'roof') show = false;
  else if (!flying && k !== 'floor') gy = b.spotPos(b.spot)?.y ?? 0;
  const up = clamp((b.p.y - gy) / 300, 0, 0.8);
  const bs = 40 * S.size * (1 - up);
  f.shadow.position.set(b.p.x, gy + 0.7, b.p.z);
  f.shadow.scale.set(bs, bs * 0.55, 1);
  f.shadow.material.opacity = show ? 0.9 * (1 - up) : 0;
}
function updatePig(dt) {
  const b = pigBrain;
  if (!pigDrag || !pigDrag.moved) b.update(dt);
  else { b.t += dt; b.update(0); pig.gait.phase += dt * 6; }
  const s = pigScale(), sq = b.squash * Math.cos(b.t * 25);
  pig.root.position.set(b.x, b.y, b.z);
  pig.root.rotation.y = b.yaw;
  pig.root.scale.set(s * (1 + sq * 0.5), s * (1 - sq), s * (1 + sq * 0.5));
  pig.update(dt);
  const gy = b.inBed ? pigBed.SURFACE * pigBed.s : 0;
  const up = clamp((b.y - gy) / 400, 0, 0.7), ps = 70 * s * (1 - up);
  pigShadow.position.set(b.x + (b.inBed ? 6 * s : 0), gy + 0.65, b.z);
  pigShadow.scale.set(ps * (b.inBed ? 1.4 : 1), ps * 0.55, 1);
  pigShadow.material.opacity = (b.inBed ? 0.5 : 1) * (1 - up);
}

function resize() {
  W = innerWidth; H = innerHeight;
  Object.assign(camera, { left: -W / 2, right: W / 2, top: H - BOTTOM, bottom: -BOTTOM });
  camera.updateProjectionMatrix();
  renderer.setSize(W, H, false);
  for (const c of [toyBack, toyFront]) { c.width = W; c.height = H; }
  placeTree();
  placeCages();
  placeBed();
  placeHouse();
  placeDesks();
  const [x0, x1] = screenBounds();
  if (!ai.surface) ai.x = clamp(ai.x, x0, x1);
  pigBrain.x = clamp(pigBrain.x, x0, x1);
  for (const f of friends.values()) f.brain.x = clamp(f.brain.x, x0, x1);
}

// ---------- start ----------
api.getState().then(state => {
  applySettings(state.settings);
  resize();
  const [x0, x1] = screenBounds();
  ai.x = rand(x0, x1) * 0.5;
  ai.y = H * 0.55;
  if (catMain()) go('fall', { welcome: true });
  else setTimeout(() => { say(`我係${S.name}，今日陪你做嘢 🐾`, 4000); voice(); setTimeout(tellFailedToys, 4500); }, 3000);
  // the birds fly in from above to their cages; the pig drops in a moment later
  liveBirds().forEach((f, i) => birdArrives(f, 80 + i * 160));
  if (pigOn()) pigArrives(H * 0.55 + 500);
  frameStarted = true;
  syncFriends();
  requestAnimationFrame(frame);
});
addEventListener('resize', resize);
if (location.search.includes('debug')) window.__debug = { start, go, ai, cat, wake, tree, toys, climb, approachToy, decide, flock, cages, pig, pigBrain, pigBed, friends, house, slots, bowls, actors, desks, workers,
  furn, furnOn, usage, startMeeting, startParade, startParty, get event() { return event; } };
