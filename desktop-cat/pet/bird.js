// A little yellow bird (雀仔) and its cage (鳥籠): same toon look as the cat.
// Units are screen pixels at size 1. Like the cat, the bird faces +x, +y is up, its right is +z.
import * as THREE from '../node_modules/three/build/three.module.js';

const SPHERE = new THREE.SphereGeometry(1, 24, 16);
const CONE = new THREE.ConeGeometry(1, 1, 16);
SPHERE.userData.ext = [1, 1, 1];
CONE.userData.ext = [1, 0.5, 1];

// A mesh plus an inverted-hull outline about `px` thick (`ext` = the geometry's half-size).
function part(parent, geo, mat, outline, pos, scale, px = 1.2) {
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

const BASE = { pitch: 0, headPitch: 0, headRoll: 0, spread: 0, flapBase: 0.1, flapAmp: 0, flapHz: 0, tail: 0,
  beak: 0, eyeOpen: 1, fluff: 0, tuck: 0, crouch: 0 };
export const BIRD_POSES = {
  stand: {},
  fly: { pitch: -0.15, spread: 1, flapBase: 0.4, flapAmp: 0.95, flapHz: 13, tail: 0.15, tuck: 1 },
  glide: { pitch: -0.05, spread: 1, flapBase: 0.35, flapAmp: 0.35, flapHz: 6, tail: 0.25, tuck: 0.6 },
  held: { spread: 0.9, flapBase: 0.5, flapAmp: 0.8, flapHz: 11, tuck: 0.3, beak: 0.4 },
  flutter: { spread: 0.85, flapBase: 0.6, flapAmp: 0.6, flapHz: 9, tail: 0.3 },
  peck: { pitch: 0.55, headPitch: 0.5 },
  sleep: { fluff: 1, eyeOpen: 0, headPitch: 0.35, headRoll: 0.25, tail: -0.1, crouch: 1 },
  sing: { headPitch: -0.35, tail: 0.15 },
  preen: { headPitch: 0.4, headRoll: 0.5 },
};

export class Bird {
  constructor(ramp) {
    const toon = c => new THREE.MeshToonMaterial({ color: c, gradientMap: ramp });
    this.mats = {
      body: toon(0xffd84a), belly: toon(0xfff2a8), wing: toon(0xf2c02c), tip: toon(0xd99a1a), beak: toon(0xff9a3c),
      leg: toon(0xf0883c), crest: toon(0xf5c62e),
      cheek: new THREE.MeshBasicMaterial({ color: 0xff8a66, transparent: true, opacity: 0.8, depthWrite: false }),
      eye: new THREE.MeshBasicMaterial({ color: 0x1b1410 }), shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      outline: new THREE.MeshBasicMaterial({ color: 0x5a3d12, side: THREE.BackSide }),
    };
    this.pose = { ...BASE };
    this.target = { ...BASE };
    this.base = { ...BASE };
    this.phase = 0; this.time = 0; this.blink = 1; this.nextBlink = 2;
    this.look = { yaw: 0, roll: 0 }; // quick head turns, set by the brain
    this.build();
  }

  build() {
    const M = this.mats, O = M.outline;
    this.root = new THREE.Group();
    this.figure = new THREE.Group();
    this.root.add(this.figure);
    // legs stand on the root; the body pivots at the hip above them
    this.legs = [-1, 1].map(side => {
      const g = new THREE.Group();
      g.position.set(1, 6, 3.6 * side);
      this.figure.add(g);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 6.5, 8), M.leg);
      leg.position.set(0, -3.2, 0);
      g.add(leg);
      for (const a of [-0.5, 0, 0.5]) part(g, SPHERE, M.leg, null, [2.2 * Math.cos(a), -6.4, 2.2 * Math.sin(a)], [2.2, 0.8, 0.9], 0).rotation.y = -a;
      return g;
    });
    this.hip = new THREE.Group();
    this.hip.position.set(0, 6, 0);
    this.figure.add(this.hip);
    const B = this.hip;
    this.bodyMesh = part(B, SPHERE, M.body, O, [0, 10, 0], [15, 12.5, 12], 1.6);
    part(B, SPHERE, M.belly, null, [4, 7, 0], [11, 8.5, 10]);
    // tail
    this.tailPivot = new THREE.Group();
    this.tailPivot.position.set(-12, 11, 0);
    B.add(this.tailPivot);
    part(this.tailPivot, SPHERE, M.wing, O, [-7.5, -1, 0], [10, 1.8, 5.2], 1.1).rotation.z = 0.3;
    part(this.tailPivot, SPHERE, M.tip, null, [-13, -3, 0], [4.5, 1.2, 4], 0).rotation.z = 0.3;
    // wings: folded along the body; spread swings them out sideways, flap raises them
    this.wings = [-1, 1].map(side => {
      const w = new THREE.Group();
      w.position.set(3, 15, 10.2 * side);
      w.userData.side = side;
      B.add(w);
      part(w, SPHERE, M.wing, O, [-6, -2, 0], [11, 3, 6.5], 1.1).rotation.z = 0.25;
      part(w, SPHERE, M.tip, null, [-13.5, -4.2, 0], [6.5, 2.2, 4.4], 0).rotation.z = 0.25;
      return w;
    });
    // head
    this.neck = new THREE.Group();
    this.neck.position.set(9, 19, 0);
    this.neck.rotation.order = 'YZX';
    B.add(this.neck);
    const N = this.neck;
    part(N, SPHERE, M.body, O, [2, 5, 0], [10, 9.5, 9.5], 1.5);
    part(N, SPHERE, M.crest, O, [0.5, 14.5, 0], [2.2, 4.8, 1.6], 0.8).rotation.z = 0.35;
    part(N, SPHERE, M.crest, O, [-2.6, 13.2, 0], [1.8, 3.6, 1.4], 0.8).rotation.z = 0.7;
    const beakTop = part(N, CONE, M.beak, O, [12.6, 4.6, 0], [3.1, 6, 3.1], 0.7);
    beakTop.rotation.z = -Math.PI / 2;
    this.beakLow = new THREE.Group();
    this.beakLow.position.set(10, 3.4, 0);
    N.add(this.beakLow);
    const low = part(this.beakLow, CONE, M.beak, O, [2.2, -0.2, 0], [2.3, 4.4, 2.3], 0.6);
    low.rotation.z = -Math.PI / 2 - 0.15;
    this.eyes = [-1, 1].map(side => {
      const e = new THREE.Group();
      e.position.set(8.6, 7, 5.4 * side);
      e.rotation.y = -0.5 * side;
      N.add(e);
      part(e, SPHERE, M.eye, null, [0, 0, 0], [1.7, 2.3, 1.5]);
      part(e, SPHERE, M.shine, null, [1.1, 0.9, 0.2 * side], [0.6, 0.6, 0.6]);
      return e;
    });
    for (const side of [-1, 1]) part(N, SPHERE, M.cheek, null, [7.4, 2.6, 7.6 * side], [1.2, 2.2, 3], 0).rotation.y = -0.7 * side;
  }

  setPose(name, over = {}) {
    this.target = { ...BASE, ...BIRD_POSES[name], ...over };
    this.base = { ...this.target };
  }

  // Head top in root space (for notes and Zzz).
  update(dt) {
    this.time += dt;
    const p = this.pose, t = this.target, k = 1 - Math.exp(-dt * 12);
    for (const key in p) p[key] += (t[key] - p[key]) * k;
    this.phase += dt * p.flapHz * Math.PI * 2;

    const breathe = 1 + Math.sin(this.time * 3) * 0.015;
    const fluff = 1 + p.fluff * 0.14;
    this.hip.scale.set(fluff, breathe * fluff, fluff);
    this.hip.rotation.z = -p.pitch;
    this.hip.position.y = 6 - p.crouch * 3;
    this.neck.rotation.z = p.pitch * 0.7 - p.headPitch;
    const hk = 1 - Math.exp(-dt * 25); // birds snap their heads around
    this.neck.rotation.y += (this.look.yaw - this.neck.rotation.y) * hk;
    this.neck.rotation.x += (p.headRoll + this.look.roll - this.neck.rotation.x) * hk;
    this.tailPivot.rotation.z = p.tail + Math.sin(this.time * 2.3) * 0.04;
    const flap = p.flapBase + p.flapAmp * Math.sin(this.phase);
    for (const w of this.wings) {
      const side = w.userData.side;
      w.rotation.y = side * p.spread * Math.PI / 2 * 0.85;
      w.rotation.x = -side * flap * p.spread;
    }
    this.beakLow.rotation.z = -p.beak * 0.5;
    for (const l of this.legs) l.scale.y = 1 - p.tuck * 0.7;

    this.nextBlink -= dt;
    if (this.nextBlink <= 0) { this.blink = 0; this.nextBlink = 1.5 + Math.random() * 3.5; }
    this.blink = Math.min(1, this.blink + dt * 9);
    const open = Math.max(0.08, p.eyeOpen * (this.blink < 0.5 ? 0.1 : 1));
    for (const e of this.eyes) e.scale.y = open;
  }
}

// ---------------------------------------------------------------------------
// The cage: round base, gold bars with a domed top, an open door, a perch and a swing.

export class BirdCage {
  constructor(ramp) {
    const toon = c => new THREE.MeshToonMaterial({ color: c, gradientMap: ramp });
    this.mats = { base: toon(0xf4e7cf), trim: toon(0xe3c48e), bar: toon(0xd9a935), wood: toon(0xb07a45), seed: toon(0x8a5a2b),
      outline: new THREE.MeshBasicMaterial({ color: 0x5a4636, side: THREE.BackSide }) };
    this.group = new THREE.Group();
    this.R = 48; this.TOP = 112; this.APEX = 154; this.PERCH = 58;
    this.build();
    this.swing = 0;
  }
  build() {
    const G = this.group, M = this.mats, R = this.R;
    const disc = (r, h, y, mat) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40), mat);
      m.position.y = y;
      G.add(m);
      const o = new THREE.Mesh(m.geometry, M.outline);
      o.scale.set(1 + 1.6 / r, 1 + 1.6 / (h / 2), 1 + 1.6 / r);
      m.add(o);
      return m;
    };
    disc(R + 6, 8, 4, M.base);
    disc(R + 2, 3, 9.5, M.trim);
    const ring = (y, tube) => {
      const t = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 6, 48), M.bar);
      t.rotation.x = Math.PI / 2;
      t.position.y = y;
      G.add(t);
    };
    ring(11, 1.8); ring(62, 1.1); ring(this.TOP, 1.8);
    // bars, leaving a gap at the front (+z) for the door
    const N = 20, barGeo = new THREE.CylinderGeometry(1.2, 1.2, this.TOP - 11, 6);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      const front = Math.abs(a - Math.PI / 2) < 0.2;
      if (!front) {
        const b = new THREE.Mesh(barGeo, M.bar);
        b.position.set(x, (11 + this.TOP) / 2, z);
        G.add(b);
      }
      // dome: each bar curves up to the top
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(x, this.TOP, z), new THREE.Vector3(x * 0.95, this.APEX + 2, z * 0.95), new THREE.Vector3(0, this.APEX, 0));
      G.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 1.1, 5), M.bar));
    }
    // knob and hanging ring on top
    const knob = new THREE.Mesh(SPHERE, M.bar);
    knob.scale.setScalar(5);
    knob.position.y = this.APEX + 2;
    G.add(knob);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(7, 1.6, 6, 24), M.bar);
    hook.position.y = this.APEX + 13;
    G.add(hook);
    // the door, swung open to the side
    const door = new THREE.Group();
    door.position.set(Math.cos(Math.PI / 2 + 0.25) * R, 11, Math.sin(Math.PI / 2 + 0.25) * R);
    door.rotation.y = -1.1;
    G.add(door);
    const dw = 26, dh = 46;
    const rod = (len, x, y, rotZ) => {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, len, 5), M.bar);
      r.position.set(x, y, 0); r.rotation.z = rotZ;
      door.add(r);
    };
    rod(dh, 0, dh / 2, 0); rod(dh, dw, dh / 2, 0); rod(dw, dw / 2, dh, Math.PI / 2); rod(dh, dw / 2, dh / 2, 0);
    // perch across the middle, a swing near the top, a seed cup on the floor
    const perch = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, R * 1.6, 10), M.wood);
    perch.rotation.z = Math.PI / 2;
    perch.position.set(0, this.PERCH - 2.4, -4);
    G.add(perch);
    this.swingG = new THREE.Group();
    this.swingG.position.set(0, this.TOP + 8, -6);
    G.add(this.swingG);
    const sw = new THREE.Mesh(new THREE.TorusGeometry(12, 1, 6, 28), M.bar);
    sw.position.y = -14;
    this.swingG.add(sw);
    const swBar = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 22, 8), M.wood);
    swBar.rotation.z = Math.PI / 2;
    swBar.position.y = -25;
    this.swingG.add(swBar);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(8, 6.5, 8, 16, 1, true), M.trim);
    cup.position.set(24, 15, 18);
    G.add(cup);
    const seeds = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.4, 1.5, 16), M.seed);
    seeds.position.set(24, 17.5, 18);
    G.add(seeds);
  }
  place(x, z, s) {
    this.group.position.set(x, 0, z);
    this.group.scale.setScalar(s);
    this.x = x; this.z = z; this.s = s;
  }
  // Where the bird can be, in world space.
  perchSpot(off = 0) { return { x: this.x + off * this.s, y: this.PERCH * this.s, z: this.z - 4 * this.s }; }
  roofSpot() { return { x: this.x, y: (this.APEX + 6) * this.s, z: this.z }; }
  doorFront() { return { x: this.x - 4 * this.s, y: (this.PERCH + 6) * this.s, z: this.z + (this.R + 34) * this.s }; }
  update(dt) {
    this.swing += dt;
    this.swingG.rotation.x = Math.sin(this.swing * 1.3) * 0.12;
  }
}
