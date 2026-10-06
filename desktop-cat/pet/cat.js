// A chunky toon-shaded cat built from primitives, plus a pose system.
// Units are screen pixels at size 1. The cat faces +x; +y is up; its right side is +z.
import * as THREE from '../node_modules/three/build/three.module.js';

export const COATS = {
  orange: { fur: 0xf3a35c, stripe: 0xd8772f, belly: 0xfff4e4, inner: 0xffaead, eye: 0x3a2a20, line: 0x3d2a1f },
  grey: { fur: 0xaab4bf, stripe: 0x7a8592, belly: 0xf3f5f7, inner: 0xf7b3bd, eye: 0x2b2f36, line: 0x2f343b },
  black: { fur: 0x3a3942, stripe: null, belly: 0x3a3942, inner: 0xd88a98, eye: 0xf2c94c, line: 0x0f0e12 },
  white: { fur: 0xfbf8f3, stripe: null, belly: 0xffffff, inner: 0xffc0c6, eye: 0x5aa0d8, line: 0x5a4b43 },
  tuxedo: { fur: 0x34333b, stripe: null, belly: 0xfbf8f3, inner: 0xd88a98, eye: 0x9fd36a, line: 0x0f0e12 },
};

// Target values for each pose; the cat eases toward them every frame.
// Leg angles are relative to the ground (the torso's pitch is compensated).
const BASE = {
  lift: 0, pitch: 0, legs: [0, 0, 0, 0], scales: [1, 1, 1, 1], headPitch: 0, headRoll: 0,
  tailLift: 0.55, tailCurl: 0.18, tailSide: 0, tailAmp: 0.22, tailSpeed: 2.2, eyeOpen: 1, mouth: 0, earBack: 0,
};
export const POSES = {
  stand: {},
  sit: { lift: -18, pitch: 0.75, legs: [0, 0, -1.2, -1.2], scales: [1.28, 1.28, 0.75, 0.75], headPitch: 0.05,
         tailLift: 2.05, tailCurl: -0.12, tailSide: 0.22, tailAmp: 0.06, tailSpeed: 1.2 },
  loaf: { lift: -17, legs: [-1.45, -1.45, -1.3, -1.3], scales: [0.55, 0.55, 0.55, 0.55], headPitch: 0.28,
          tailLift: 2.0, tailCurl: -0.05, tailSide: 0.28, tailAmp: 0.03, tailSpeed: 0.7, eyeOpen: 0 },
  stretch: { pitch: -0.32, legs: [0.9, 0.9, -0.1, -0.1], scales: [0.97, 0.97, 1, 1], headPitch: -0.25,
             tailLift: 0.25, tailCurl: 0.06, tailAmp: 0.08 },
  crouch: { lift: -9, pitch: -0.06, scales: [0.75, 0.75, 0.72, 0.72], legs: [0.25, 0.25, -0.3, -0.3], headPitch: 0.1,
            tailLift: 1.1, tailCurl: 0.1, tailAmp: 0.35, tailSpeed: 6, earBack: 0.2 },
  groom: { lift: -18, pitch: 0.75, legs: [0, 2.25, -1.2, -1.2], scales: [1.28, 0.8, 0.75, 0.75], headPitch: 0.45, headRoll: -0.2,
           tailLift: 2.05, tailCurl: -0.12, tailSide: 0.22, tailAmp: 0.05, tailSpeed: 1, eyeOpen: 0.15 },
  held: { legs: [0.25, 0.25, 0.15, 0.15], scales: [1.25, 1.25, 1.25, 1.25], headPitch: 0.1,
          tailLift: 2.9, tailCurl: 0.04, tailAmp: 0.35, tailSpeed: 3, earBack: 0.35 },
  leap: { legs: [0.7, 0.7, -0.8, -0.8], scales: [1.1, 1.1, 1.1, 1.1], headPitch: -0.1, tailLift: 1.3, tailCurl: 0.05, tailAmp: 0.1 },
  // up on the hind legs with both front paws on the scratching post
  scratch: { pitch: 1.0, legs: [2.0, 2.0, -0.05, -0.05], scales: [1, 1, 0.95, 0.95], headPitch: -0.1,
             tailLift: 1.7, tailCurl: 0.12, tailAmp: 0.18, tailSpeed: 3, earBack: 0.15 },
  // standing up to bat at something dangling
  reach: { pitch: 0.9, legs: [0.6, 2.3, -0.05, -0.05], scales: [0.8, 1.05, 0.95, 0.95], headPitch: -0.25,
           tailLift: 1.4, tailCurl: 0.1, tailAmp: 0.35, tailSpeed: 5 },
};

const SPHERE = new THREE.SphereGeometry(1, 32, 20);
const CONE = new THREE.ConeGeometry(1, 1, 20);
const LEG = new THREE.CapsuleGeometry(6.5, 19, 6, 14);
const TAIL = new THREE.CapsuleGeometry(1, 6, 4, 10);
// Half-extents of each unscaled geometry, so outlines get an even thickness.
SPHERE.userData.ext = [1, 1, 1];
CONE.userData.ext = [1, 0.5, 1];
LEG.userData.ext = [6.5, 16, 6.5];
TAIL.userData.ext = [1, 4, 1];

function toonRamp() {
  const t = new THREE.DataTexture(new Uint8Array([160, 160, 160, 255, 222, 222, 222, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
function stripeTexture(fur, stripe) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#' + fur.toString(16).padStart(6, '0');
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#' + stripe.toString(16).padStart(6, '0');
  // Bands across the back (sphere meridians), fading out toward the belly.
  for (let i = 0; i < 12; i++) {
    const x = i * 256 / 12 + 4;
    g.beginPath();
    g.moveTo(x, 0); g.lineTo(x + 9, 0);
    g.quadraticCurveTo(x + 13, 30, x + 6, 62); g.lineTo(x + 3, 62);
    g.quadraticCurveTo(x + 6, 30, x, 0);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Cat {
  constructor() {
    this.ramp = toonRamp();
    this.mats = {};
    this.root = new THREE.Group();
    this.pose = structuredClone({ ...BASE });
    this.target = structuredClone({ ...BASE });
    this.baseTarget = structuredClone({ ...BASE });
    this.gait = { phase: 0, amp: 0 };
    this.blink = 1; this.nextBlink = 2; this.twitch = 0; this.time = 0;
    this.extraHead = { yaw: 0, pitch: 0 }; // gaze, set by the behaviour code
    this.swat = 0; // >0 while batting with the right front paw
    this.makeMaterials();
    this.build();
    this.setCoat('orange');
  }

  makeMaterials() {
    const toon = () => new THREE.MeshToonMaterial({ gradientMap: this.ramp });
    for (const k of ['fur', 'body', 'stripe', 'belly', 'inner', 'eye']) this.mats[k] = toon();
    this.mats.pupil = new THREE.MeshBasicMaterial({ color: 0x15110f });
    this.mats.shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mats.nose = toon(); this.mats.nose.color.set(0xff8fa3);
    this.mats.mouth = new THREE.MeshBasicMaterial({ color: 0x8e2f44 });
    this.mats.blush = new THREE.MeshBasicMaterial({ color: 0xff9fb0, transparent: true, opacity: 0.55, depthWrite: false });
    this.mats.outline = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
    this.mats.whisker = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 });
  }

  setCoat(name) {
    const c = COATS[name] || COATS.orange;
    const m = this.mats;
    m.fur.color.set(c.fur);
    m.stripe.color.set(c.stripe ?? c.fur);
    m.belly.color.set(c.belly);
    m.inner.color.set(c.inner);
    m.eye.color.set(c.eye);
    m.outline.color.set(c.line);
    m.whisker.color.set(c.line);
    if (m.body.map) m.body.map.dispose();
    if (c.stripe) { m.body.map = stripeTexture(c.fur, c.stripe); m.body.color.set(0xffffff); }
    else { m.body.map = null; m.body.color.set(c.fur); }
    m.body.needsUpdate = true;
    for (const s of this.foreheadStripes) s.visible = !!c.stripe;
  }

  // A mesh with an inverted-hull outline roughly `px` pixels thick.
  blob(parent, mat, pos, scale, px = 1.6, geo = SPHERE) {
    const mesh = new THREE.Mesh(geo, this.mats[mat]);
    mesh.position.set(...pos);
    mesh.scale.set(...scale);
    parent.add(mesh);
    if (px) {
      const o = new THREE.Mesh(geo, this.mats.outline);
      const ext = geo.userData.ext;
      o.scale.set(...scale.map((v, i) => 1 + px / (v * ext[i])));
      mesh.add(o);
    }
    return mesh;
  }

  build() {
    const R = this.root;
    this.figure = new THREE.Group(); // squash & stretch lives here
    R.add(this.figure);
    // Torso pivots around the back hip so sitting tips the front up.
    this.torso = new THREE.Group();
    this.torso.position.set(-20, 30, 0);
    this.figure.add(this.torso);
    const T = this.torso;
    this.blob(T, 'body', [20, 10, 0], [36, 26, 24], 2);
    this.blob(T, 'belly', [33, 1, 0], [19, 19, 18], 0);

    // legs: front-left, front-right, back-left, back-right (right = +z)
    const hips = [[40, 2, -11], [40, 2, 11], [0, 2, -11], [0, 2, 11]];
    this.legs = hips.map((h, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(...h);
      T.add(pivot);
      if (i >= 2) this.blob(pivot, 'fur', [-1, -5, 0], [13, 15, 8], 1.6);
      this.blob(pivot, 'fur', [0, -15.5, 0], [1, 1, 1], 1.6, LEG);
      this.blob(pivot, 'belly', [2, -28.5, 0], [8.5, 5, 7.5], 1.4);
      return pivot;
    });

    // tail: a chain of joints that sway in a travelling wave
    this.tail = [];
    let parent = new THREE.Group();
    parent.position.set(-14, 18, 0);
    T.add(parent);
    for (let i = 0; i < 9; i++) {
      const joint = i === 0 ? parent : new THREE.Group();
      if (i > 0) { joint.position.y = 7; parent.add(joint); }
      const r = 5.6 - i * 0.18;
      this.blob(joint, i % 2 ? 'stripe' : 'fur', [0, 4, 0], [r, 1, r], 1.4, TAIL);
      this.tail.push(joint);
      parent = joint;
    }

    // head
    this.neck = new THREE.Group();
    this.neck.position.set(50, 28, 0);
    this.neck.rotation.order = 'YZX';
    T.add(this.neck);
    const N = this.neck;
    this.blob(N, 'fur', [10, 10, 0], [26, 23, 27], 2);
    this.ears = [-1, 1].map(side => {
      const ear = new THREE.Group();
      ear.position.set(8, 27, 13 * side);
      ear.rotation.x = 0.38 * side;
      N.add(ear);
      this.blob(ear, 'fur', [0, 7, 0], [10, 18, 9], 1.6, CONE);
      this.blob(ear, 'inner', [3.2, 5.5, 0], [5.5, 11, 5], 0, CONE);
      return ear;
    });
    this.foreheadStripes = [
      this.blob(N, 'stripe', [30.5, 24, 0], [1.4, 4.2, 1.6], 0),
      this.blob(N, 'stripe', [29.6, 22.6, 5.6], [1.4, 3.6, 1.5], 0),
      this.blob(N, 'stripe', [29.6, 22.6, -5.6], [1.4, 3.6, 1.5], 0),
    ];
    for (const s of this.foreheadStripes) s.rotation.z = -0.55;
    this.eyes = [-1, 1].map(side => {
      const eye = new THREE.Group();
      eye.position.set(32.6, 13, 10 * side);
      eye.rotation.y = -0.32 * side;
      N.add(eye);
      this.blob(eye, 'eye', [0, 0, 0], [3.4, 6.6, 4.6], 0.8);
      this.blob(eye, 'pupil', [1.8, 0, 0], [2, 5.4, 2.4], 0);
      this.blob(eye, 'shine', [3.1, 2.3, 1.2], [1, 1.5, 1.5], 0);
      this.blob(eye, 'shine', [3.1, -2.4, -1.4], [0.6, 0.8, 0.8], 0);
      return eye;
    });
    this.blob(N, 'belly', [32.5, 2.5, 4.6], [5.4, 4.6, 5.8], 1);
    this.blob(N, 'belly', [32.5, 2.5, -4.6], [5.4, 4.6, 5.8], 1);
    this.blob(N, 'belly', [31.5, -2.5, 0], [4, 3, 4.4], 0.8);
    this.blob(N, 'nose', [37.4, 5.8, 0], [1.9, 1.6, 2.6], 0.6);
    this.mouth = this.blob(N, 'mouth', [35.4, -2.2, 0], [2.4, 3.6, 3], 0.6);
    this.mouth.visible = false;
    for (const side of [-1, 1]) {
      const b = this.blob(N, 'blush', [29.2, 4.5, 15.5 * side], [1.4, 2.6, 4.6], 0);
      b.rotation.y = -0.6 * side;
    }
    const w = [];
    for (const side of [-1, 1]) {
      for (const [dy, ey] of [[1.5, 5], [0, 0], [-1.5, -4.5]]) {
        w.push(35, 3 + dy, 7 * side, 37, 3 + ey, 27 * side);
      }
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(w, 3));
    N.add(new THREE.LineSegments(wg, this.mats.whisker));
  }

  setPose(name, overrides = {}) {
    this.target = structuredClone({ ...BASE, ...POSES[name], ...overrides });
    this.baseTarget = structuredClone(this.target);
  }

  // Head-top point in root space (for speech bubbles and Zzz).
  headTop() { return new THREE.Vector3(30, 100, 0); }

  update(dt) {
    this.time += dt;
    const p = this.pose, t = this.target;
    const k = 1 - Math.exp(-dt * 9);
    for (const key of Object.keys(p)) {
      if (Array.isArray(p[key])) p[key] = p[key].map((v, i) => v + (t[key][i] - v) * k);
      else p[key] += (t[key] - p[key]) * k;
    }
    const g = this.gait, s = Math.sin(g.phase);
    const bob = g.amp ? Math.abs(Math.sin(g.phase)) * 2.5 * g.amp : Math.sin(this.time * 2) * 0.6;

    this.torso.position.y = 30 + p.lift + bob;
    this.torso.rotation.z = p.pitch + (g.amp ? Math.sin(g.phase * 2) * 0.03 * g.amp : 0);
    // trot: diagonal legs move together
    const swing = [s, -s, -s, s].map(v => v * 0.55 * g.amp);
    this.legs.forEach((leg, i) => {
      let a = p.legs[i] + swing[i];
      if (i === 1 && this.swat > 0) a += 1.4 * Math.abs(Math.sin(this.swat * 9));
      leg.rotation.z = a - p.pitch;
      leg.scale.y = p.scales[i];
    });
    this.neck.rotation.y = this.extraHead.yaw;
    this.neck.rotation.z = -p.pitch * 0.85 - p.headPitch - this.extraHead.pitch;
    this.neck.rotation.x = p.headRoll;

    const amp = p.tailAmp + g.amp * 0.15, spd = p.tailSpeed + g.amp * 2;
    this.tail.forEach((j, i) => {
      const wave = Math.sin(this.time * spd - i * 0.55) * amp;
      j.rotation.z = (i === 0 ? p.tailLift - p.pitch : p.tailCurl) + wave * (i === 0 ? 0.6 : 0.35);
      j.rotation.x = (i === 0 ? 0 : p.tailSide) + Math.sin(this.time * spd * 0.7 - i * 0.5) * amp * 0.5;
    });

    // blink
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) { this.blink = 0; this.nextBlink = 2.5 + Math.random() * 4; }
    this.blink = Math.min(1, this.blink + dt * 8);
    const open = Math.max(0.1, p.eyeOpen * (this.blink < 0.5 ? 0.1 : 1));
    for (const e of this.eyes) e.scale.y = open;

    this.mouth.visible = p.mouth > 0.05;
    this.mouth.scale.y = 3.6 * Math.max(0.05, p.mouth);

    this.twitch = Math.max(0, this.twitch - dt * 4);
    const tw = Math.sin(this.twitch * Math.PI) * 0.35;
    this.ears[0].rotation.z = -p.earBack - tw * 0.2;
    this.ears[1].rotation.z = -p.earBack;
    this.ears[0].rotation.x = -0.38 - tw;
  }
}
