// A chunky toon-shaded cat built from primitives, plus a pose system.
// Units are screen pixels at size 1. The cat faces +x; +y is up; its right side is +z.
import * as THREE from '../node_modules/three/build/three.module.js';
import { BREEDS, CLASSIC } from './breeds.js';

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
  // breed: 'classic' (coloured by `coat`) or a key of BREEDS — cats and dogs share this model.
  constructor(breed = 'classic', coat = 'orange') {
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
    this.breed = null;
    this.setBreed(breed, coat);
  }

  makeMaterials() {
    const toon = () => new THREE.MeshToonMaterial({ gradientMap: this.ramp });
    for (const k of ['fur', 'body', 'stripe', 'belly', 'inner', 'eye', 'point', 'mask', 'saddle', 'paw']) this.mats[k] = toon();
    this.mats.pupil = new THREE.MeshBasicMaterial({ color: 0x15110f });
    this.mats.shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mats.nose = toon(); this.mats.nose.color.set(0xff8fa3);
    this.mats.tongue = toon(); this.mats.tongue.color.set(0xff7f97);
    this.mats.mouth = new THREE.MeshBasicMaterial({ color: 0x8e2f44 });
    this.mats.blush = new THREE.MeshBasicMaterial({ color: 0xff9fb0, transparent: true, opacity: 0.55, depthWrite: false });
    this.mats.outline = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
    this.mats.whisker = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 });
    this.mats.smile = new THREE.MeshBasicMaterial();
    this.mats.wing = new THREE.MeshToonMaterial({ gradientMap: this.ramp, side: THREE.DoubleSide });
  }

  get isDog() { return this.spec.kind === 'dog'; }
  get isDragon() { return this.spec.kind === 'dragon'; }

  // Rebuild the body for another breed (only when it changes), then paint it.
  setBreed(id, coat = this.coat || 'orange') {
    const key = BREEDS[id] ? id : 'classic';
    if (key !== this.breed) {
      const b = BREEDS[key] || {};
      this.breed = key;
      this.spec = { ...CLASSIC, ...b, tail: { ...CLASSIC.tail, ...(b.tail || {}) } };
      if (this.figure) this.root.remove(this.figure);
      this.build();
    }
    this.coat = coat;
    this.paint();
  }
  setCoat(name) { this.setBreed(this.breed, name); }

  paint() {
    const s = this.spec, c = this.breed === 'classic' ? (COATS[this.coat] || COATS.orange) : s;
    const m = this.mats;
    m.fur.color.set(c.fur);
    m.stripe.color.set(c.stripe ?? c.fur);
    m.belly.color.set(c.belly);
    m.inner.color.set(c.inner);
    m.eye.color.set(c.eye);
    m.outline.color.set(c.line);
    m.whisker.color.set(c.line);
    m.smile.color.set(c.line);
    m.wing.color.set(c.inner);
    m.point.color.set(c.point ?? c.fur);
    m.mask.color.set(c.mask ?? c.point ?? c.belly);
    m.saddle.color.set(c.saddle ?? c.fur);
    m.paw.color.set(c.paw ?? (s.pointLegs ? c.point : c.belly));
    m.nose.color.set(c.nose ?? (c.point ?? 0xff8fa3));
    if (m.body.map) m.body.map.dispose();
    if (c.stripe) { m.body.map = stripeTexture(c.fur, c.stripe); m.body.color.set(0xffffff); }
    else { m.body.map = null; m.body.color.set(c.fur); }
    m.body.needsUpdate = true;
    for (const st of this.foreheadStripes) st.visible = !!c.stripe;
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
    const s = this.spec, R = this.root, L = s.len, F = s.fat, K = s.legK, fl = s.fluff, dog = s.kind === 'dog', dragon = s.kind === 'dragon';
    const pointed = s.point != null;
    this.figure = new THREE.Group(); // squash & stretch lives here
    R.add(this.figure);
    // Torso pivots around the back hip so sitting tips the front up.
    this.legK = K;
    this.hipH = 30 * K;
    this.torso = new THREE.Group();
    this.torso.position.set(-20 * L, this.hipH, 0);
    this.figure.add(this.torso);
    const T = this.torso, puff = 1 + fl * 0.1;
    this.blob(T, 'body', [20 * L, 10, 0], [36 * L * (1 + fl * 0.06), 26 * F * puff, 24 * F * puff], 2);
    this.blob(T, 'belly', [33 * L, 1, 0], [19 * Math.min(L, 1.2), 19 * F, 18 * F], 0);
    // a darker saddle over the back (German Shepherd)
    if (s.saddle != null) this.blob(T, 'saddle', [18 * L, 18, 0], [36 * L * 0.8, 26 * F * 0.97, 24 * F * 0.97], 1.4);
    // long fur: a ruff on the chest
    if (fl) this.blob(T, 'belly', [40 * L + 2, 15, 0], [14 + 4 * fl, 20 + 8 * fl, 20 * F + 6 * fl], 1.4);
    // and a full mane round the neck for the fluffiest
    if (fl >= 0.9) this.blob(T, 'fur', [40 * L - 2, 24, 0], [18, 22, 27 * F], 1.6);

    // legs: front-left, front-right, back-left, back-right (right = +z)
    const hz = 11 * Math.max(0.9, F);
    const hips = [[40 * L, 2, -hz], [40 * L, 2, hz], [0, 2, -hz], [0, 2, hz]];
    this.legs = hips.map((h, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(...h);
      T.add(pivot);
      if (i >= 2) this.blob(pivot, s.saddle != null ? 'fur' : 'fur', [-1, -5 * K, 0], [13, 15 * Math.max(K, 0.6), 8], 1.6);
      this.blob(pivot, s.pointLegs ? 'point' : 'fur', [0, -15.5 * K, 0], [1, K, 1], 1.6, LEG);
      this.blob(pivot, 'paw', [2, -28.5 * K, 0], [8.5, 5, 7.5], 1.4);
      return pivot;
    });

    // tail: a chain of joints that sway in a travelling wave
    this.tail = [];
    const tl = s.tail;
    let parent = new THREE.Group();
    parent.position.set(-14, 18, 0);
    T.add(parent);
    for (let i = 0; i < tl.n; i++) {
      const joint = i === 0 ? parent : new THREE.Group();
      if (i > 0) { joint.position.y = tl.stub ? 4 : 7; parent.add(joint); }
      const r = tl.r * Math.max(0.35, 1 - i * tl.taper);
      const mat = pointed ? 'point' : s.saddle != null ? (i % 2 ? 'saddle' : 'fur') : (i % 2 ? 'stripe' : 'fur');
      this.blob(joint, mat, [0, tl.stub ? 2 : 4, 0], [r, tl.stub ? 0.6 : 1, r], 1.4, TAIL);
      this.tail.push(joint);
      parent = joint;
    }
    // a dragon's tail ends in two fins that spread sideways
    if (tl.fins) for (const side of [-1, 1]) this.blob(parent, 'inner', [0, 9, 6 * side], [1.4, 7, 6.5], 1.2);

    // a dragon's wings, folded along its back
    this.wings = s.wings ? [-1, 1].map(side => this.buildWing(T, side, L, F)) : [];

    // head
    const [hx, hy, hzs] = s.headShape, X = x => 10 + (x - 10) * hx;
    this.neck = new THREE.Group();
    this.neck.position.set(40 * L + 10, 28, 0);
    this.neck.rotation.order = 'YZX';
    this.neck.scale.setScalar(s.head);
    T.add(this.neck);
    const N = this.neck;
    this.blob(N, 'fur', [10, 10, 0], [26 * hx, 23 * hy, 27 * hzs], 2);
    this.ears = [-1, 1].map(side => this.buildEar(N, side, hx, hy, hzs));
    this.foreheadStripes = [
      this.blob(N, 'stripe', [X(30.5), 24, 0], [1.4, 4.2, 1.6], 0),
      this.blob(N, 'stripe', [X(29.6), 22.6, 5.6], [1.4, 3.6, 1.5], 0),
      this.blob(N, 'stripe', [X(29.6), 22.6, -5.6], [1.4, 3.6, 1.5], 0),
    ];
    for (const st of this.foreheadStripes) st.rotation.z = -0.55;
    if (dog) this.buildDogFace(N, X, hzs);
    else if (dragon) this.buildDragonFace(N, X, hzs);
    else this.buildCatFace(N, X, hzs, pointed);
  }

  buildEar(N, side, hx, hy, hz) {
    const s = this.spec, k = s.earK, ear = new THREE.Group(), inner = new THREE.Group();
    ear.add(inner);
    N.add(ear);
    const at = (x, y, z, rx) => { ear.position.set(10 + (x - 10) * hx, 10 + (y - 10) * hy, z * hz * side); ear.userData.rx = rx * side; ear.rotation.x = rx * side; };
    switch (s.ears) {
      case 'small':
        at(6, 25, 15, 0.62);
        this.blob(inner, 'fur', [0, 5, 0], [8.5 * k, 12 * k, 8 * k], 1.6, CONE);
        this.blob(inner, 'inner', [2.6, 4, 0], [4.6 * k, 7.5 * k, 4.4 * k], 0, CONE);
        break;
      case 'big':
        at(8, 26, 13, 0.5);
        this.blob(inner, s.point != null ? 'point' : 'fur', [0, 9 * k, 0], [12 * k, 24 * k, 9.5 * k], 1.6, CONE);
        this.blob(inner, 'inner', [3.4, 7.5 * k, 0], [6.5 * k, 15 * k, 5 * k], 0, CONE);
        break;
      case 'fold':
        // small ears folded forward and down, close to the head
        at(13, 28, 11, 0.32);
        inner.rotation.z = -1.25;
        this.blob(inner, 'fur', [0, 4, 0], [9, 10, 8], 1.6, CONE);
        break;
      case 'pointy':
        at(6, 27.5, 11, 0.26);
        this.blob(inner, s.saddle != null ? 'saddle' : 'fur', [0, 8 * k, 0], [8.5 * k, 20 * k, 7 * k], 1.6, CONE);
        this.blob(inner, 'inner', [2.6, 7 * k, 0], [4.6 * k, 12 * k, 3.6 * k], 0, CONE);
        break;
      case 'bat':
        // big rounded upright ears
        at(5, 26, 12, 0.62);
        this.blob(inner, 'fur', [0, 11 * k, 0], [11 * k, 14 * k, 3.6 * k], 1.6);
        this.blob(inner, 'inner', [1.6, 10.5 * k, 0], [8 * k, 10.5 * k, 2.6 * k], 0);
        break;
      case 'fins': {
        // a big fin swept back on top, and a smaller one lower down the side of the head
        at(4, 27, 12, 0.75);
        inner.rotation.z = 0.75;
        this.blob(inner, 'fur', [0, 13 * k, 0], [7 * k, 30 * k, 3 * k], 1.6, CONE);
        this.blob(inner, 'inner', [0.8, 12 * k, 0], [3.6 * k, 19 * k, 1.6 * k], 0, CONE);
        const low = new THREE.Group();
        low.position.set(10 + (2 - 10) * hx, 10 + (16 - 10) * hy, 22 * hz * side);
        low.rotation.set(0.9 * side, 0, 1.25);
        N.add(low);
        this.blob(low, 'fur', [0, 8, 0], [4.5, 16, 2.4], 1.4, CONE);
        break;
      }
      case 'floppy':
        // hanging down beside the head
        at(4, 24, 23, -0.32);
        this.blob(inner, 'fur', [1, -11 * k, 3.5 * side], [7.5 * k, 15 * k, 3.4], 1.6);
        break;
      default: // 'cat'
        at(8, 27, 13, 0.38);
        this.blob(inner, s.point != null ? 'point' : 'fur', [0, 7, 0], [10 * k, 18 * k, 9 * k], 1.6, CONE);
        this.blob(inner, 'inner', [3.2, 5.5, 0], [5.5 * k, 11 * k, 5 * k], 0, CONE);
    }
    return ear;
  }

  buildCatFace(N, X, hz, pointed) {
    const s = this.spec, f = s.flat, back = f * 2.5;
    this.eyes = [-1, 1].map(side => {
      const eye = new THREE.Group();
      eye.position.set(X(32.6) - f * 0.8, 13 + f * 0.5, 10 * hz * side);
      eye.rotation.y = -0.32 * side;
      N.add(eye);
      const round = f * 0.6;
      this.blob(eye, 'eye', [0, 0, 0], [3.4, 6.6 - round, 4.6 + round * 1.4], 0.8);
      this.blob(eye, 'pupil', [1.8, 0, 0], [2, 5.4 - round * 1.6, 2.4 + round], 0);
      this.blob(eye, 'shine', [3.1, 2.3, 1.2], [1, 1.5, 1.5], 0);
      this.blob(eye, 'shine', [3.1, -2.4, -1.4], [0.6, 0.8, 0.8], 0);
      return eye;
    });
    const pad = pointed ? 'point' : 'belly';
    // a colourpoint's dark mask across the muzzle
    if (pointed) this.blob(N, 'point', [X(29) - back, 3, 0], [6, 9, 12 * hz], 0);
    this.blob(N, pad, [X(32.5) - back, 2.5 + f, 4.6], [5.4, 4.6, 5.8 + f], 1);
    this.blob(N, pad, [X(32.5) - back, 2.5 + f, -4.6], [5.4, 4.6, 5.8 + f], 1);
    this.blob(N, pad, [X(31.5) - back, -2.5 + f, 0], [4, 3, 4.4], 0.8);
    this.blob(N, 'nose', [X(37.4) - back * 1.2, 5.8 + f * 1.6, 0], [1.9, 1.6, 2.6], 0.6);
    this.mouth = this.blob(N, 'mouth', [X(35.4) - back, -2.2 + f, 0], [2.4, 3.6, 3], 0.6);
    this.mouth.visible = false;
    this.tongue = null;
    for (const side of [-1, 1]) {
      const b = this.blob(N, 'blush', [X(29.2), 4.5, 15.5 * hz * side], [1.4, 2.6, 4.6], 0);
      b.rotation.y = -0.6 * side;
    }
    const w = [];
    for (const side of [-1, 1]) {
      for (const [dy, ey] of [[1.5, 5], [0, 0], [-1.5, -4.5]]) {
        w.push(X(35) - back, 3 + dy + f, 7 * side, X(37) - back, 3 + ey + f, 27 * side);
      }
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(w, 3));
    N.add(new THREE.LineSegments(wg, this.mats.whisker));
  }

  // One wing: a membrane between three long fingers, hinged at the shoulder. update() folds and flaps it.
  buildWing(T, side, L, F) {
    const pivot = new THREE.Group();
    pivot.position.set(30 * L, 30 * F, 12 * F * side);
    pivot.scale.setScalar(1.4);
    T.add(pivot);
    const fold = new THREE.Group(); // squeezes the wing in when folded
    fold.scale.z = side;
    pivot.add(fold);
    // the outline in the (forward, outward) plane, with scalloped trailing edges
    const sh = new THREE.Shape();
    sh.moveTo(6, 0);
    sh.lineTo(16, 22);
    sh.lineTo(4, 46);
    sh.quadraticCurveTo(-2, 34, -12, 38);
    sh.quadraticCurveTo(-14, 26, -24, 26);
    sh.quadraticCurveTo(-22, 14, -30, 10);
    sh.quadraticCurveTo(-18, 4, -16, 0);
    sh.lineTo(6, 0);
    const geo = new THREE.ShapeGeometry(sh, 8);
    geo.rotateX(Math.PI / 2); // (forward, outward) → (x, z)
    const skin = new THREE.Mesh(geo, this.mats.wing);
    fold.add(skin);
    const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(sh.getPoints(8).map(p => new THREE.Vector3(p.x, 0, p.y))), this.mats.whisker);
    fold.add(edge);
    // the fingers: from the wrist out to each point
    const bone = (a, b, r) => {
      const d = new THREE.Vector3().subVectors(b, a), len = d.length();
      const m = this.blob(fold, 'fur', [0, 0, 0], [r, len / 2, r], 0.9);
      m.position.copy(a).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    };
    const V = (x, z) => new THREE.Vector3(x, 0.4, z), wrist = V(16, 22);
    bone(V(4, 2), wrist, 2.4);
    for (const tip of [V(4, 46), V(-12, 38), V(-24, 26)]) bone(wrist, tip, 1.5);
    pivot.userData = { side, fold };
    return pivot;
  }

  buildDragonFace(N, X, hz) {
    this.eyes = [-1, 1].map(side => {
      const eye = new THREE.Group();
      eye.position.set(X(31.6), 13.5, 10.5 * hz * side);
      eye.rotation.y = -0.36 * side;
      N.add(eye);
      // big round green eyes with a thin slit
      this.blob(eye, 'eye', [0, 0, 0], [3.8, 8.4, 7.6], 0.9);
      this.blob(eye, 'pupil', [2.5, 0, 0], [1.8, 6.8, 1.4], 0);
      this.blob(eye, 'shine', [3.5, 3.2, 2.4], [1, 1.8, 1.8], 0);
      return eye;
    });
    // a rounded nose with two little nostrils
    this.blob(N, 'fur', [X(30), 2.5, 0], [9, 8, 12.5 * hz], 1.4);
    for (const side of [-1, 1]) this.blob(N, 'pupil', [X(38.6), 5.4, 3.2 * side], [0.6, 0.9, 1.1], 0);
    // the toothless smile
    const smile = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(X(35.5), 0.6, -9.5 * hz), new THREE.Vector3(X(41.5), -3.4, 0), new THREE.Vector3(X(35.5), 0.6, 9.5 * hz)), 16, 0.55, 6), this.mats.smile);
    N.add(smile);
    this.mouth = this.blob(N, 'mouth', [X(36.6), -2.4, 0], [2.6, 3.6, 6], 0.6);
    this.mouth.visible = false;
    this.tongue = this.blob(N, 'tongue', [X(37), -3.6, 0], [2, 1.4, 3.6], 0);
    this.tongue.visible = false;
    for (const side of [-1, 1]) {
      const b = this.blob(N, 'blush', [X(29.5), 5, 16 * hz * side], [1.4, 2.2, 4], 0);
      b.rotation.y = -0.6 * side;
    }
  }

  buildDogFace(N, X, hz) {
    const s = this.spec, sn = s.snout;
    this.eyes = [-1, 1].map(side => {
      const eye = new THREE.Group();
      eye.position.set(X(31.5), 15, 9.5 * hz * side);
      eye.rotation.y = -0.4 * side;
      N.add(eye);
      this.blob(eye, 'eye', [0, 0, 0], [3.2, 4.6, 4.4], 0.8);
      this.blob(eye, 'pupil', [1.7, 0, 0], [2, 3.2, 3.1], 0);
      this.blob(eye, 'shine', [3, 1.4, 1], [0.9, 1.2, 1.2], 0);
      return eye;
    });
    // the muzzle sticks out in front; the nose sits at its tip
    const mx = X(27) + sn * 0.5, len = 9 + sn * 0.6, tip = mx + len;
    this.blob(N, s.mask != null ? 'mask' : 'belly', [mx, 2, 0], [len, 8.5, 10.5], 1.4);
    this.blob(N, 'nose', [tip - 1.2, 5.5, 0], [3, 2.7, 4.3], 0.8);
    this.mouth = this.blob(N, 'mouth', [tip - 5, -4, 0], [4.5, 3.6, 5.5], 0.6);
    this.mouth.visible = false;
    this.tongue = this.blob(N, 'tongue', [tip - 4.5, -7.5, 0], [4.2, 1.6, 3.6], 0.6);
    this.tongue.visible = false;
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

    this.torso.position.y = this.hipH + p.lift * this.legK + bob;
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
      const tl = this.spec.tail;
      // (a dog's tail lies down behind it when it sits, rather than wrapping round its feet)
      const base = Math.min(2.3, p.tailLift + tl.lift);
      j.rotation.z = (i === 0 ? base - p.pitch : p.tailCurl + tl.curl) + wave * (i === 0 ? 0.6 : 0.35);
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
    if (this.tongue) this.tongue.visible = p.mouth > 0.05;

    this.twitch = Math.max(0, this.twitch - dt * 4);
    const tw = Math.sin(this.twitch * Math.PI) * 0.35;
    // floppy ears bounce along when walking
    const flop = this.spec.ears === 'floppy' ? Math.sin(g.phase * 2) * 0.25 * g.amp : 0;
    this.ears[0].rotation.z = -p.earBack - tw * 0.2 + flop;
    this.ears[1].rotation.z = -p.earBack + flop;
    this.ears[0].rotation.x = this.ears[0].userData.rx - tw;

    // wings: folded up along the back, breathing a little; flapping when up in the air or excited
    if (this.wings.length) {
      const busy = p.tailAmp > 0.3 || p.tailSpeed > 4.5 || g.amp > 0.9;
      const target = busy ? 1 : 0;
      this.flapK = (this.flapK ?? 0) + (target - (this.flapK ?? 0)) * Math.min(1, dt * 4);
      const k = this.flapK, beat = Math.sin(this.time * 11);
      for (const w of this.wings) {
        const lift = 0.6 - k * 0.2 + beat * 0.75 * k + Math.sin(this.time * 1.6) * 0.05;
        w.rotation.x = -w.userData.side * lift;
        w.rotation.z = -p.pitch * 0.6;
        w.userData.fold.scale.z = w.userData.side * (0.7 + 0.3 * k);
      }
    }
  }
}
