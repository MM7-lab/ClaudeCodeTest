// Office mode (辦公室模式): a work desk with a laptop, a mug, a plant, papers, a name plate and an
// office chair, and the "working at the desk" animation shared by the cats and dogs.
// Units are screen pixels at size 1. The desk's origin is on the floor at its middle; whoever
// works at it sits behind it (-z) facing the screen (+z), with the laptop's lid towards us.
import * as THREE from '../node_modules/three/build/three.module.js';

const CYL = new THREE.CylinderGeometry(1, 1, 1, 24);
const SPHERE = new THREE.SphereGeometry(1, 16, 12);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

function nameTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.canvas = c;
  return t;
}

export class Desk {
  constructor(ramp) {
    const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra });
    this.plate = nameTexture();
    this.mats = {
      wood: toon(0xe8c79a), panel: toon(0xd9b383), leg: toon(0x8d7a6a), lid: toon(0xd9dee6), logo: toon(0x9aa6b6),
      keys: toon(0x59616d), mug: toon(0xfff4e8), coffee: toon(0x6b4226), pot: toon(0xd9825b), leaf: toon(0x6cbf5a),
      paper: toon(0xffffff), plate: toon(0xffffff, { map: this.plate }), chair: toon(0x5b6f8c), chairDark: toon(0x3e4a5e),
      outline: new THREE.MeshBasicMaterial({ color: 0x4a3a30, side: THREE.BackSide }),
    };
    this.group = new THREE.Group();
    this.TOP = 54; this.Wd = 140; this.D = 64;
    this.build();
    this.x = 0; this.z = 0; this.s = 1; this.side = 1;
    this.setName('');
  }
  part(geo, mat, pos, scale = [1, 1, 1], px = 1.3, parent = this.group) {
    const m = new THREE.Mesh(geo, this.mats[mat]);
    m.position.set(...pos);
    m.scale.set(...scale);
    parent.add(m);
    if (px) {
      geo.computeBoundingBox();
      const b = geo.boundingBox, ext = [0, 1, 2].map(i => Math.max(0.5, (b.max.getComponent(i) - b.min.getComponent(i)) / 2));
      const o = new THREE.Mesh(geo, this.mats.outline);
      o.scale.set(...ext.map((e, i) => 1 + px / (e * Math.abs(scale[i]))));
      m.add(o);
    }
    return m;
  }
  build() {
    const { TOP, Wd, D } = this, box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    // top, a modesty panel at the front, two side panels
    this.part(box(Wd, 5, D), 'wood', [0, TOP - 2.5, 0]);
    this.part(box(Wd - 10, TOP - 12, 3), 'panel', [0, (TOP - 5) / 2 + 3, D / 2 - 6]);
    for (const sx of [-1, 1]) this.part(box(4, TOP - 5, D - 6), 'leg', [sx * (Wd / 2 - 6), (TOP - 5) / 2, 0]);
    // laptop: the base in front of the worker, the lid standing up with its back to us
    this.part(box(42, 2.4, 28), 'keys', [0, TOP + 1.2, -8], [1, 1, 1], 1);
    this.lid = new THREE.Group();
    this.lid.position.set(0, TOP + 2.4, 6);
    this.lid.rotation.x = 0.22;
    this.group.add(this.lid);
    this.part(box(42, 28, 1.8), 'lid', [0, 14, 0], [1, 1, 1], 1.1, this.lid);
    // a paw print on the back of the lid
    this.part(CYL, 'logo', [0, 12, 1], [4.2, 0.6, 3.6], 0, this.lid).rotation.x = Math.PI / 2;
    for (const [x, y] of [[-4.6, 17.4], [-1.6, 19.4], [1.6, 19.4], [4.6, 17.4]]) this.part(CYL, 'logo', [x, y, 1], [1.6, 0.6, 1.8], 0, this.lid).rotation.x = Math.PI / 2;
    // mug with coffee, a plant, a stack of papers
    this.mugPos = new THREE.Vector3(48, TOP, 8);
    this.part(CYL, 'mug', [48, TOP + 6, 8], [6.5, 12, 6.5], 1);
    this.part(CYL, 'coffee', [48, TOP + 11.6, 8], [5.6, 0.8, 5.6], 0);
    const handle = this.part(new THREE.TorusGeometry(3.6, 1.2, 6, 12, Math.PI), 'mug', [54.5, TOP + 6, 8], [1, 1, 1], 0);
    handle.rotation.z = -Math.PI / 2;
    this.part(new THREE.CylinderGeometry(9, 7, 13, 16), 'pot', [-54, TOP + 6.5, -12], [1, 1, 1], 1.1);
    for (const [x, y, z, r] of [[-54, TOP + 20, -12, 9], [-60, TOP + 16, -8, 6], [-48, TOP + 17, -16, 6.5], [-56, TOP + 26, -14, 5.5]]) {
      this.part(SPHERE, 'leaf', [x, y, z], [r, r * 1.1, r], 1);
    }
    this.part(box(26, 5, 20), 'paper', [-30, TOP + 2.5, 12], [1, 1, 1], 0.9).rotation.y = 0.15;
    // name plate at the front edge
    const np = this.part(box(52, 13, 2.4), 'plate', [12, TOP + 7, D / 2 - 5], [1, 1, 1], 1);
    np.rotation.x = -0.3;
    // office chair behind; its seat height is set for whoever sits on it
    this.chair = new THREE.Group();
    this.chair.position.set(0, 0, -D / 2 - 16);
    this.group.add(this.chair);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2, leg = this.part(box(26, 3, 4), 'chairDark', [Math.cos(a) * 12, 4, Math.sin(a) * 12], [1, 1, 1], 0.8, this.chair);
      leg.rotation.y = -a;
    }
    this.post = this.part(CYL, 'chairDark', [0, 15, 0], [3, 22, 3], 0.8, this.chair);
    this.seat = this.part(CYL, 'chair', [0, 28, 0], [22, 6, 20], 1.2, this.chair);
    this.back = this.part(box(40, 40, 5), 'chair', [0, 52, -18], [1, 1, 1], 1.2, this.chair);
    this.back.rotation.x = -0.12;
  }
  setName(text) {
    if (text === this.name) return;
    this.name = text;
    const c = this.plate.userData.canvas, g = c.getContext('2d');
    g.fillStyle = '#fbf3e4'; g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#c9a46a'; g.fillRect(0, 54, 256, 10);
    g.fillStyle = '#4a3420';
    g.font = '700 30px "Microsoft JhengHei", "PingFang HK", "Noto Sans CJK TC", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text || '', 128, 28);
    this.plate.needsUpdate = true;
  }
  // x, z: the desk; side: -1 on the left of the screen, +1 on the right (the worker turns a little inwards)
  place(x, z, s, side) {
    this.group.position.set(x, 0, z);
    this.group.scale.setScalar(s);
    this.group.rotation.y = side * 0.18;
    this.x = x; this.z = z; this.s = s; this.side = side;
    this.group.updateMatrixWorld(true);
  }
  // seat height (world), set to fit the worker
  setSeat(y) {
    const h = Math.max(10, y / this.s);
    this.seat.position.y = h - 3;
    this.post.scale.y = Math.max(4, h - 6); this.post.position.y = (h - 6) / 2 + 3;
    this.back.position.y = h + 20;
  }
  w(x, y, z) { const v = this.group.localToWorld(new THREE.Vector3(x, y, z)); return { x: v.x, y: v.y, z: v.z }; }
  top() { return this.TOP * this.s; }
  // where the worker sits (before fitting), which way it faces, and where to climb up from
  seatSpot() { const p = this.w(0, 0, -this.D / 2 - 16); return { ...p, yaw: -Math.PI / 2 - this.side * 0.18 }; }
  sideSpot() { return this.w(-this.side * (this.Wd / 2 + 40), 0, -this.D / 2 - 16); }
  // the keyboard (a bird types by pecking it), the mug (for steam)
  keyboard() { return this.w(10, this.TOP + 2.4, -10); }
  mug() { return this.w(48, this.TOP + 14, 8); }
  // how far the paws should reach: the near half of the keyboard
  pawTarget() { return this.w(0, this.TOP + 3, -14); }
}

// Working at a desk, for anything built on the cat model (cats and dogs): sit, front paws on the
// keyboard, typing; now and then think, sip coffee, stretch, glance at you, or doze off.
// emit(kind) shows a little effect: 'type' | 'idea' | 'coffee' | 'zzz' | 'stretch'
export class Worker {
  constructor(animal, emit) {
    this.a = animal; this.emit = emit;
    this.state = 'type'; this.t = 0; this.next = rand(6, 14); this.lastEmit = 0;
  }
  begin() {
    this.a.setPose('sit', { legs: [1.35, 1.35, -1.2, -1.2], scales: [1, 1, 0.75, 0.75], headPitch: 0.25, tailAmp: 0.08 });
    this.state = 'type'; this.t = 0; this.next = rand(6, 14);
  }
  pick() {
    const s = pick(['type', 'type', 'type', 'think', 'sip', 'stretch', 'look', 'doze']);
    this.state = s; this.t = 0;
    this.next = { type: rand(6, 14), think: rand(2.5, 4), sip: 2.4, stretch: 2.2, look: rand(2, 4), doze: rand(5, 10) }[s];
    if (s === 'think') this.emit('idea');
    if (s === 'sip') this.emit('coffee');
    if (s === 'stretch') this.emit('stretch');
  }
  get dozing() { return this.state === 'doze'; }
  // someone came to say hello: look up and wave
  wave() { this.state = 'look'; this.t = 0; this.next = 3; this.emit('wave'); }
  update(dt) {
    const tg = this.a.target, b = this.a.baseTarget;
    this.t += dt;
    if (this.t > this.next) this.pick();
    tg.legs = [...b.legs]; tg.headPitch = b.headPitch; tg.headRoll = 0; tg.eyeOpen = 1; tg.mouth = 0;
    switch (this.state) {
      case 'type': {
        const w = Math.sin(this.t * 17);
        tg.legs[0] = 1.35 + Math.max(0, w) * 0.22;
        tg.legs[1] = 1.35 + Math.max(0, -w) * 0.22;
        if (this.t - this.lastEmit > 2.2) { this.lastEmit = this.t; this.emit('type'); }
        break;
      }
      case 'think': tg.headPitch = -0.25; tg.headRoll = 0.25; tg.legs[1] = 2.2; break;
      case 'sip': tg.legs[1] = 2.5; tg.headPitch = -0.1; break;
      case 'stretch': tg.legs[0] = tg.legs[1] = 2.7; tg.headPitch = -0.3; tg.mouth = Math.sin(Math.min(1, this.t / 2) * Math.PI); tg.eyeOpen = 0.2; break;
      case 'look': tg.headPitch = 0; break;
      case 'doze': tg.headPitch = 0.6; tg.eyeOpen = 0; if (this.t - this.lastEmit > 3) { this.lastEmit = this.t; this.emit('zzz'); } break;
    }
  }
}

// Sit `pos` (the animal's feet, world) so its paws rest on the keyboard and its eyes clear the
// laptop: nudge it towards that a little each frame (k = 0..1).
const V = new THREE.Vector3();
export function fitSeat(pos, paws, eye, desk, k) {
  const tgt = desk.pawTarget(), lidTop = desk.top() + 31 * desk.s;
  const paw = paws.reduce((a, p) => ({ y: a.y + p.y / paws.length, z: a.z + p.z / paws.length }), { y: 0, z: 0 });
  const dy = Math.max(tgt.y - paw.y, lidTop - eye.y);
  pos.y = Math.max(0, pos.y + dy * k);
  pos.z += (tgt.z - paw.z) * k;
}
// world points for a cat-model animal: front paws and eyes
export function catPoints(a) {
  a.root.updateMatrixWorld(true);
  const paws = [0, 1].map(i => { const p = a.legs[i].localToWorld(V.set(2, -28.5 * a.legK - 4, 0)); return { y: p.y, z: p.z }; });
  const e = a.neck.localToWorld(V.set(30, 14, 0));
  return { paws, eye: { y: e.y, z: e.z } };
}
