// A little pink pig (豬仔) in a light-blue cape with a gold coin medal, and its bed.
// Same toon look as the cat. Units are screen pixels at size 1. The pig faces +x, +y is up,
// its right side is +z. It walks on two legs.
import * as THREE from '../node_modules/three/build/three.module.js';

const SPHERE = new THREE.SphereGeometry(1, 28, 18);
const CONE = new THREE.ConeGeometry(1, 1, 16);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 28);
const LEG = new THREE.CapsuleGeometry(4.6, 6, 5, 12);
const ARM = new THREE.CapsuleGeometry(3.4, 6.5, 5, 10);
SPHERE.userData.ext = [1, 1, 1];
CONE.userData.ext = [1, 0.5, 1];
CYL.userData.ext = [1, 0.5, 1];
LEG.userData.ext = [4.6, 7.6, 4.6];
ARM.userData.ext = [3.4, 6.65, 3.4];

// A mesh plus an inverted-hull outline about `px` thick (`ext` = the geometry's half-size).
function part(parent, geo, mat, outline, pos, scale, px = 1.3) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  parent.add(m);
  if (px && outline) {
    const ext = geo.userData.ext || [1, 1, 1];
    const o = new THREE.Mesh(geo, outline);
    o.scale.set(...scale.map((v, i) => 1 + px / (v * ext[i])));
    m.add(o);
  }
  return m;
}

const BASE = {
  lift: 0, pitch: 0, sway: 0, lie: 0, sit: 0,
  headPitch: 0, headRoll: 0,
  legs: [0, 0], legsOut: [0, 0], arms: [0.1, 0.1], armsOut: [0.25, 0.25],
  eyeOpen: 1, cape: 0, ears: 0, tailSpeed: 3,
};
export const PIG_POSES = {
  stand: {},
  sit: { sit: 1, legs: [1.45, 1.45], arms: [0.5, 0.5], armsOut: [0.15, 0.15], headPitch: -0.05, cape: -0.1 },
  sleep: { lie: 1, legs: [0.35, 0.5], arms: [1.2, 1.3], armsOut: [-0.25, -0.25], eyeOpen: 0, headRoll: 0.1, tailSpeed: 0.6, ears: 0.4 },
  roll: { lie: 1, legs: [0.6, 0.6], arms: [1.6, 1.6], armsOut: [0.9, 0.9], tailSpeed: 9 },
  sniff: { pitch: 0.28, headPitch: 0.35, arms: [0.3, 0.3], tailSpeed: 6 },
  held: { legs: [0.3, -0.3], arms: [0.4, 0.4], armsOut: [1.2, 1.2], headPitch: -0.1, cape: 0.5, tailSpeed: 10, ears: 0.5 },
  fall: { legs: [0.4, -0.2], armsOut: [1.6, 1.6], cape: 1, ears: 0.8 },
  // standing on one leg, arms up
  dance: { legsOut: [1.0, 0], legs: [0.3, 0], arms: [0.6, 0.6], armsOut: [2.2, 2.2], headPitch: -0.12, tailSpeed: 10, cape: 0.25 },
  cheer: { arms: [0.3, 0.3], armsOut: [2.7, 2.7], headPitch: -0.2, tailSpeed: 10 },
};

export class Pig {
  constructor(ramp) {
    const toon = c => new THREE.MeshToonMaterial({ color: c, gradientMap: ramp });
    this.mats = {
      skin: toon(0xffbfd0), belly: toon(0xffdbe5), snout: toon(0xff9fba), hoof: toon(0xec8aa6), inner: toon(0xff8fae),
      cape: toon(0x9fd8f5), capeIn: new THREE.MeshToonMaterial({ color: 0x6db5e0, gradientMap: ramp, side: THREE.BackSide }),
      gold: toon(0xf6c544), goldDark: toon(0xd99a1f),
      cheek: new THREE.MeshBasicMaterial({ color: 0xff6f92, transparent: true, opacity: 0.6, depthWrite: false }),
      dark: new THREE.MeshBasicMaterial({ color: 0x3a1f2a }), shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      mouth: new THREE.MeshBasicMaterial({ color: 0x8e2f44 }),
      outline: new THREE.MeshBasicMaterial({ color: 0x8a3d55, side: THREE.BackSide }),
    };
    this.pose = structuredClone(BASE);
    this.target = structuredClone(BASE);
    this.base = structuredClone(BASE);
    this.gait = { phase: 0, amp: 0 };
    this.time = 0; this.blink = 1; this.nextBlink = 2;
    this.look = { yaw: 0, pitch: 0 }; // gaze, set by the brain
    this.wiggle = 0; // snout wiggle while sniffing
    this.build();
  }

  build() {
    const M = this.mats, O = M.outline;
    this.root = new THREE.Group();
    this.figure = new THREE.Group();
    this.root.add(this.figure);
    // legs hang from the hips; feet on the ground
    this.legs = [-1, 1].map(side => {
      const g = new THREE.Group();
      g.position.set(0, 15, 7.6 * side);
      this.figure.add(g);
      part(g, LEG, M.skin, O, [0, -7.6, 0], [1, 1, 1]);
      part(g, SPHERE, M.hoof, null, [0.6, -12.6, 0], [4.9, 2.6, 4.9]);
      return g;
    });
    this.hip = new THREE.Group();
    this.hip.position.set(0, 15, 0);
    this.figure.add(this.hip);
    const B = this.hip;
    part(B, SPHERE, M.skin, O, [0, 11, 0], [15, 16, 14.5], 1.6);
    part(B, SPHERE, M.belly, null, [5.5, 9.5, 0], [10.5, 11.5, 11]);
    // curly tail
    this.tail = new THREE.Group();
    this.tail.position.set(-14.5, 9, 0);
    B.add(this.tail);
    const curl = new THREE.Mesh(new THREE.TorusGeometry(3.6, 1.3, 6, 18, Math.PI * 1.7), M.skin);
    curl.position.set(-3.2, 1, 0);
    this.tail.add(curl);
    // arms at the shoulders
    this.arms = [-1, 1].map(side => {
      const g = new THREE.Group();
      g.position.set(1, 20, 13 * side);
      g.userData.side = side;
      B.add(g);
      part(g, ARM, M.skin, O, [0, -6.4, 0], [1, 1, 1]);
      part(g, SPHERE, M.hoof, null, [0.4, -11.2, 0], [3.3, 2, 3.3]);
      return g;
    });
    // the cape, from the shoulders down the back, light blue outside and a deeper blue inside
    this.capePivot = new THREE.Group();
    this.capePivot.position.set(-1.5, 25.5, 0);
    B.add(this.capePivot);
    const capeGeo = new THREE.CylinderGeometry(11.5, 21, 27, 18, 1, true, Math.PI - 0.15, Math.PI + 0.3);
    const capeOut = new THREE.Mesh(capeGeo, M.cape);
    capeOut.position.y = -13.5;
    this.capePivot.add(capeOut);
    const capeIn = new THREE.Mesh(capeGeo, M.capeIn);
    capeIn.position.y = -13.5;
    capeIn.scale.setScalar(0.985);
    this.capePivot.add(capeIn);
    // collar, and the gold coin medal on the chest
    const collar = new THREE.Mesh(new THREE.TorusGeometry(10.5, 2.4, 8, 30), M.cape);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0.5, 25.5, 0);
    B.add(collar);
    const medal = new THREE.Group();
    medal.position.set(13.8, 18.5, 0);
    medal.rotation.z = -0.2;
    B.add(medal);
    const coin = part(medal, CYL, M.gold, O, [0, 0, 0], [6.2, 2, 6.2], 0.9);
    coin.rotation.z = Math.PI / 2;
    const face = new THREE.Mesh(CYL, M.goldDark);
    face.scale.set(4.2, 2.4, 4.2);
    face.rotation.z = Math.PI / 2;
    face.position.x = 0.15;
    medal.add(face);
    const sq = new THREE.Mesh(new THREE.BoxGeometry(1, 3.2, 3.2), M.gold); // a square hole, like an old coin
    sq.position.x = 1.35;
    medal.add(sq);
    part(medal, new THREE.BoxGeometry(1, 6, 3), M.cape, null, [-0.6, 5.6, 0], [1, 1, 1], 0);
    // the head: big and round
    this.neck = new THREE.Group();
    this.neck.position.set(1, 27, 0);
    this.neck.rotation.order = 'YZX';
    B.add(this.neck);
    const N = this.neck;
    part(N, SPHERE, M.skin, O, [1.5, 17, 0], [19, 18, 20], 1.7);
    // snout with two nostrils
    this.snout = new THREE.Group();
    this.snout.position.set(21, 13.5, 0);
    N.add(this.snout);
    const sn = part(this.snout, CYL, M.snout, O, [0, 0, 0], [6.2, 6.5, 8.4], 1.1);
    sn.rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) part(this.snout, SPHERE, M.dark, null, [3.3, 0.3, 3.1 * side], [0.6, 2.1, 1.3]);
    // eyes: small dots, a little apart
    this.eyes = [-1, 1].map(side => {
      const e = new THREE.Group();
      e.position.set(17.3, 22, 8.6 * side);
      e.rotation.y = -0.45 * side;
      N.add(e);
      part(e, SPHERE, M.dark, null, [0, 0, 0], [1.6, 2.5, 1.9]);
      part(e, SPHERE, M.shine, null, [1.2, 0.9, 0.25 * side], [0.5, 0.7, 0.6]);
      return e;
    });
    // big rosy cheeks
    for (const side of [-1, 1]) part(N, SPHERE, M.cheek, null, [13.8, 11, 13.6 * side], [2.2, 4.2, 5.2], 0).rotation.y = -0.75 * side;
    // smile under the snout
    const smileG = new THREE.Group();
    smileG.position.set(17.6, 6.4, 0);
    smileG.rotation.y = Math.PI / 2;
    N.add(smileG);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.65, 5, 12, Math.PI), M.mouth);
    smile.rotation.z = Math.PI;
    smileG.add(smile);
    // little pointed ears
    this.ears = [-1, 1].map(side => {
      const g = new THREE.Group();
      g.position.set(-1, 31, 11 * side);
      g.rotation.x = -0.55 * side;
      g.rotation.z = 0.2;
      g.userData.side = side;
      N.add(g);
      part(g, CONE, M.skin, O, [0, 4.5, 0], [6, 9, 3.2], 1.1);
      part(g, CONE, M.inner, null, [0.9, 4.2, 0], [3.8, 6.5, 1.6], 0);
      return g;
    });
  }

  setPose(name, over = {}) {
    this.target = structuredClone({ ...BASE, ...PIG_POSES[name], ...over });
    this.base = structuredClone(this.target);
  }

  // Top of the head in world space (a bird can stand there).
  headTop(v = new THREE.Vector3()) { return this.neck.localToWorld(v.set(0, 35, 0)); }

  update(dt) {
    this.time += dt;
    const p = this.pose, t = this.target, k = 1 - Math.exp(-dt * 10);
    for (const key in p) {
      if (Array.isArray(p[key])) for (let i = 0; i < p[key].length; i++) p[key][i] += (t[key][i] - p[key][i]) * k;
      else p[key] += (t[key] - p[key]) * k;
    }
    const g = this.gait, swing = Math.sin(g.phase) * g.amp;
    const bob = Math.abs(Math.cos(g.phase)) * g.amp * 2.2;

    // lying down rolls the whole figure back onto its bum and shoulders
    this.figure.rotation.z = p.lie * 1.42;
    this.figure.rotation.x = p.sway;
    this.figure.position.set(p.lie * 36, p.lift + bob + p.lie * 13 - p.sit * 9, 0);
    const breathe = 1 + Math.sin(this.time * (p.lie > 0.5 ? 1.6 : 2.6)) * 0.018;
    this.hip.scale.set(1, breathe, 1);
    this.hip.rotation.z = -p.pitch + p.sit * 0.12 + swing * 0.05;
    this.legs.forEach((l, i) => {
      const s = i ? 1 : -1;
      l.rotation.z = p.legs[i] + swing * s * 0.9;
      l.rotation.x = -(i ? 1 : -1) * p.legsOut[i];
    });
    this.arms.forEach((a, i) => {
      const s = i ? 1 : -1;
      a.rotation.z = p.arms[i] - swing * s * 0.8;
      a.rotation.x = -a.userData.side * p.armsOut[i];
    });
    this.neck.rotation.z = p.pitch * 0.6 - p.headPitch - this.look.pitch;
    this.neck.rotation.y = this.look.yaw;
    this.neck.rotation.x = p.headRoll;
    // the cape streams out behind when moving, and flaps a little
    const flutter = Math.sin(this.time * 11) * 0.06 * (g.amp + p.cape);
    this.capePivot.rotation.z = -(p.cape * 0.6 + g.amp * 0.45) + flutter;
    this.tail.rotation.z = Math.sin(this.time * p.tailSpeed) * 0.35;
    for (const e of this.ears) e.rotation.z = 0.2 - p.ears * 0.6 + Math.sin(this.time * 3 + e.userData.side) * 0.04;
    this.wiggle *= Math.exp(-dt * 3);
    this.snout.position.y = 13.5 + Math.sin(this.time * 30) * this.wiggle * 0.8;

    this.nextBlink -= dt;
    if (this.nextBlink <= 0) { this.blink = 0; this.nextBlink = 2 + Math.random() * 4; }
    this.blink = Math.min(1, this.blink + dt * 8);
    const open = Math.max(0.1, p.eyeOpen * (this.blink < 0.5 ? 0.1 : 1));
    for (const e of this.eyes) e.scale.y = open;
  }
}

// ---------------------------------------------------------------------------
// The pig's bed: an oval cushion bed with a pillow, and a blanket that comes out at bedtime.
// Its origin is on the floor at its centre; the pig lies along x with its head toward -x.
export class PigBed {
  constructor(ramp) {
    const toon = c => new THREE.MeshToonMaterial({ color: c, gradientMap: ramp });
    this.mats = { rim: toon(0x9fd8f5), base: toon(0x7fc3ea), cushion: toon(0xfff3dc), pillow: toon(0xffd6e2),
      blanket: toon(0xffe39a), dot: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      outline: new THREE.MeshBasicMaterial({ color: 0x4a6a86, side: THREE.BackSide }) };
    this.group = new THREE.Group();
    this.SURFACE = 9; // where the pig lies
    this.build();
    this.x = 0; this.z = 0; this.s = 1;
  }
  build() {
    const G = this.group, M = this.mats, O = M.outline;
    part(G, CYL, M.base, O, [0, 3.5, 0], [62, 7, 38], 1.4);
    part(G, CYL, M.cushion, null, [0, 7.5, 0], [52, 3, 29]);
    const rimGeo = new THREE.TorusGeometry(1, 0.2, 12, 56);
    rimGeo.userData.ext = [1.2, 1.2, 0.2];
    const rim = part(G, rimGeo, M.rim, O, [0, 11, 0], [60, 37, 42], 1.4);
    rim.rotation.x = Math.PI / 2;
    // pillow at the head end
    part(G, SPHERE, M.pillow, O, [-36, 13, 0], [11, 5.5, 17], 1.2).rotation.z = 0.25;
    // blanket, shown while the pig sleeps
    this.blanket = new THREE.Group();
    G.add(this.blanket);
    part(this.blanket, SPHERE, M.blanket, O, [14, 26, 0], [26, 10, 24], 1.3);
    for (const [x, z] of [[-6, 10], [10, -6], [18, 12], [2, -16], [-12, -4], [22, -1]]) {
      const d = new THREE.Mesh(SPHERE, M.dot);
      d.scale.set(3, 1, 3);
      d.position.set(14 + x * 0.9, 26 + 9.4 * Math.sqrt(Math.max(0, 1 - (x / 26) ** 2 - (z / 24) ** 2)), z);
      this.blanket.add(d);
    }
    this.blanket.visible = false;
    this.cover = 0;
  }
  place(x, z, s) {
    this.group.position.set(x, 0, z);
    this.group.scale.setScalar(s);
    this.x = x; this.z = z; this.s = s;
  }
  // pull the blanket up (or away)
  tuck(on) { this.blanketOn = on; }
  update(dt) {
    this.cover += ((this.blanketOn ? 1 : 0) - this.cover) * (1 - Math.exp(-dt * 4));
    this.blanket.visible = this.cover > 0.02;
    this.blanket.scale.set(1, this.cover, this.cover);
  }
}
