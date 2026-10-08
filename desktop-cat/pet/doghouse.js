// The dogs' home (狗屋): a wooden kennel with a red gable roof and an arched door, a mat in front
// for more sleeping spots, and a food bowl and a water bowl for everyone. Same toon look as the cat.
// Units are screen pixels at size 1; the origin is on the floor at the middle of the kennel, the
// door faces the screen (+z).
import * as THREE from '../node_modules/three/build/three.module.js';

const SPHERE = new THREE.SphereGeometry(1, 20, 14);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 32);

function plankTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#dca46a'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#b97d45'; g.lineWidth = 2;
  for (let y = 8; y < 64; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); }
  g.fillStyle = '#c88d55';
  for (const [x, y] of [[12, 3], [44, 19], [26, 35], [52, 51]]) { g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function signTexture() {
  const c = document.createElement('canvas');
  c.width = 192; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff4dc'; g.fillRect(0, 0, 192, 64);
  // a little bone
  g.fillStyle = '#e2c290';
  g.fillRect(14, 27, 28, 10);
  for (const [x, y] of [[14, 26], [14, 38], [42, 26], [42, 38]]) { g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#6b4424';
  g.font = '700 30px "Microsoft JhengHei", "PingFang HK", "Noto Sans CJK TC", sans-serif';
  g.textBaseline = 'middle';
  g.fillText('狗狗屋', 62, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class DogHouse {
  constructor(ramp) {
    const toon = (color, map) => new THREE.MeshToonMaterial({ color, gradientMap: ramp, map: map || null });
    this.mats = {
      wood: toon(0xffffff, plankTexture()), trim: toon(0xb97d45), roof: toon(0xe0645a), roofEdge: toon(0xc24a42),
      door: new THREE.MeshBasicMaterial({ color: 0x3a2a22 }), sign: toon(0xffffff, signTexture()),
      mat: toon(0x8fb6dc), matEdge: toon(0x6f97c2), food: toon(0xe25b5b), water: toon(0x5c9be0),
      kibble: toon(0xa86a35), drink: toon(0x9fd6ff),
      outline: new THREE.MeshBasicMaterial({ color: 0x4a3426, side: THREE.BackSide }),
    };
    this.group = new THREE.Group();
    this.W = 100; this.D = 80; this.WALL = 62; this.APEX = 98;
    this.build();
    this.x = 0; this.z = 0; this.s = 1; this.inner = 1;
  }

  // a mesh plus an outline shell
  part(geo, mat, pos, scale = [1, 1, 1], px = 1.4, parent = this.group) {
    const m = new THREE.Mesh(geo, this.mats[mat]);
    m.position.set(...pos);
    m.scale.set(...scale);
    parent.add(m);
    if (px) {
      geo.computeBoundingBox();
      const b = geo.boundingBox, ext = [0, 1, 2].map(i => Math.max(0.5, (b.max.getComponent(i) - b.min.getComponent(i)) / 2));
      const o = new THREE.Mesh(geo, this.mats.outline);
      o.scale.set(...ext.map((e, i) => 1 + px / (e * scale[i])));
      m.add(o);
    }
    return m;
  }

  build() {
    const { W, D, WALL, APEX } = this, G = this.group;
    // floor slab and walls
    this.part(new THREE.BoxGeometry(W + 10, 5, D + 10), 'trim', [0, 2.5, 0]);
    const walls = this.part(new THREE.BoxGeometry(W, WALL, D), 'wood', [0, 5 + WALL / 2, 0]);
    walls.material.map.repeat.set(2, 2);
    // the front and back gables: a triangle prism filling the space under the roof
    const tri = new THREE.Shape();
    tri.moveTo(-W / 2, 0); tri.lineTo(W / 2, 0); tri.lineTo(0, APEX - WALL - 5); tri.closePath();
    const gable = new THREE.ExtrudeGeometry(tri, { depth: D, bevelEnabled: false });
    gable.translate(0, 0, -D / 2);
    this.part(gable, 'wood', [0, 5 + WALL, 0], [1, 1, 1], 1.2);
    // roof: two panels meeting at the ridge, overhanging all round
    const half = W / 2 + 10, rise = APEX - WALL - 5 + 8, len = Math.hypot(half, rise), ang = Math.atan2(rise, half);
    for (const side of [-1, 1]) {
      const p = this.part(new THREE.BoxGeometry(len, 7, D + 18), 'roof', [side * half / 2, 5 + WALL - 4 + rise / 2 + 3, 0], [1, 1, 1], 1.6);
      p.rotation.z = -side * ang;
    }
    this.part(new THREE.CylinderGeometry(4, 4, D + 20, 10), 'roofEdge', [0, APEX + 4, 0], [1, 1, 1], 1.2).rotation.x = Math.PI / 2;
    // arched door, with a trim round it
    const arch = (w, h) => {
      const s = new THREE.Shape(), r = w / 2;
      s.moveTo(-r, 0); s.lineTo(-r, h - r); s.absarc(0, h - r, r, Math.PI, 0, true); s.lineTo(r, 0); s.closePath();
      return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
    };
    this.part(arch(50, 58), 'trim', [0, 5, D / 2 + 0.2], [1, 1, 1], 0);
    this.part(arch(40, 52), 'door', [0, 5, D / 2 + 0.6], [1, 1, 1], 0);
    // name plate on the gable
    this.part(new THREE.BoxGeometry(48, 16, 2), 'sign', [0, 5 + WALL + 13, D / 2 + 1], [1, 1, 1], 1);
    // the mat in front of the door
    this.matZ = D / 2 + 24;
    this.part(CYL, 'matEdge', [0, 2, this.matZ], [92, 4, 30], 1.4);
    this.part(CYL, 'mat', [0, 4.2, this.matZ], [84, 1.2, 25], 0);
    // bowls, placed on the side towards the middle of the screen by place()
    this.bowls = new THREE.Group();
    G.add(this.bowls);
    const bowl = (x, mat, fill) => {
      this.part(new THREE.CylinderGeometry(12, 9, 8, 24, 1, true), mat, [x, 4, 0], [1, 1, 1], 1.2, this.bowls);
      this.part(CYL, mat, [x, 0.6, 0], [9, 1.2, 9], 0, this.bowls);
      this.part(CYL, fill, [x, 5.5, 0], [10.6, 1, 10.6], 0, this.bowls);
      if (fill === 'kibble') for (let i = 0; i < 7; i++) {
        const a = i * 2.3, r = i ? 5.5 : 0;
        this.part(SPHERE, 'kibble', [x + Math.cos(a) * r, 6.6, Math.sin(a) * r], [2.4, 1.6, 2.4], 0, this.bowls);
      }
    };
    bowl(-17, 'food', 'kibble');
    bowl(17, 'water', 'drink');
  }

  // x, z: where the kennel stands; inner: +1 or -1, the side towards the middle of the screen
  place(x, z, s, inner) {
    this.group.position.set(x, 0, z);
    this.group.scale.setScalar(s);
    this.x = x; this.z = z; this.s = s; this.inner = inner;
    this.bowls.position.set(inner * (this.W / 2 + 72), 0, this.D / 2 + 6);
    this.group.updateMatrixWorld(true);
  }
  at(x, z) { return { x: this.x + x * this.s, z: this.z + z * this.s }; }
  front() { return this.z + (this.D / 2) * this.s; }
  // Sleeping places: 0 is the doorway (lying inside, head out); the rest are on and beside the mat.
  // `reach` is how far in front of its feet an animal's head sticks out.
  slot(i, reach) {
    if (i === 0) return { ...this.at(0, 0), z: this.front() + 12 * this.s - reach, yaw: -Math.PI / 2, door: true };
    const spots = [[-50, 0], [50, 0], [-14, 10], [14, 10], [-90, 6], [90, 6], [0, 16]];
    const [x, dz] = spots[(i - 1) % spots.length];
    const p = this.at(x, this.matZ + dz);
    return { ...p, yaw: -Math.PI / 2 + (x < 0 ? 0.6 : -0.6) };
  }
  // where to stand to eat (k = 0) or drink (k = 1), and which way to face
  bowl(k) {
    const bx = this.bowls.position.x + (k ? 17 : -17), p = this.at(bx, this.bowls.position.z);
    return { x: p.x, z: p.z };
  }
  roof() { return { x: this.x, y: (this.APEX + 8) * this.s, z: this.z }; }
}
