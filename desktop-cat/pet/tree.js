// A cat tree (貓跳臺): carpeted base, a little house, sisal posts, a shelf, a round
// bed on top and a pom-pom on a string. Same toon look as the cat.
// Units are screen pixels at size 1; the tree's origin is on the floor at its centre.
import * as THREE from '../node_modules/three/build/three.module.js';

// Where the cat can stand, in tree space. x0..x1 is the range for the cat's centre.
const SURFACES = [
  { name: 'base', y: 14, x0: -80, x1: -74, z: 30 }, // in front of the scratching post
  { name: 'roof', y: 84, x0: 12, x1: 30, z: 6 },
  { name: 'shelf', y: 152, x0: -50, x1: -20, z: 0 },
  { name: 'bed', y: 238, x0: 30, x1: 42, z: 0 },
];
const POM = { x: -66, y: 146, z: 32, len: 62 };

function ropeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#d6b27a'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#b08850'; g.lineWidth = 3;
  for (let y = -64; y < 128; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y + 10); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export class CatTree {
  constructor(ramp) {
    const toon = (color, map) => new THREE.MeshToonMaterial({ color, gradientMap: ramp, map: map || null });
    const rope = ropeTexture();
    this.mats = {
      carpet: toon(0xf2dcc6), trim: toon(0xe7c3a6), cushion: toon(0xffe2a8), rope: toon(0xffffff, rope),
      hole: new THREE.MeshBasicMaterial({ color: 0x4b3a30 }), pom: toon(0xff8fb1),
      outline: new THREE.MeshBasicMaterial({ color: 0x5a4636, side: THREE.BackSide }),
      string: new THREE.LineBasicMaterial({ color: 0x8a6d5a }),
    };
    this.group = new THREE.Group();
    this.surfaces = [];
    this.pom = { angle: 0.2, vel: 0, x: 0, y: 0 }; // pendulum, swinging in the screen plane
    this.build(rope);
  }

  // A mesh plus an inverted-hull outline about `px` thick; `ext` is the geometry's half-size.
  part(geo, mat, pos, ext, px = 1.6, parent = this.group) {
    const m = new THREE.Mesh(geo, this.mats[mat]);
    m.position.set(...pos);
    parent.add(m);
    if (px) {
      const o = new THREE.Mesh(geo, this.mats.outline);
      o.scale.set(...ext.map(e => 1 + px / e));
      m.add(o);
    }
    return m;
  }

  build(rope) {
    const box = (w, h, d) => [new THREE.BoxGeometry(w, h, d), [w / 2, h / 2, d / 2]];
    const disc = (r, h) => [new THREE.CylinderGeometry(r, r, h, 40), [r, h / 2, r]];
    const post = (h) => {
      const g = new THREE.CylinderGeometry(10, 10, h, 18);
      return [g, [10, h / 2, 10]];
    };
    const add = (shape, mat, pos, px) => this.part(shape[0], mat, pos, shape[1], px);

    add(box(170, 14, 92), 'carpet', [0, 7, 0]);
    // house with a round door
    add(box(78, 62, 72), 'trim', [40, 45, 0]);
    add(box(84, 8, 78), 'carpet', [40, 80, 0]);
    const door = new THREE.Mesh(new THREE.CircleGeometry(21, 32), this.mats.hole);
    door.position.set(40, 40, 36.2);
    this.group.add(door);
    // sisal posts (rope texture repeats along the height)
    const p1 = add(post(134), 'rope', [-45, 14 + 67, 12]);
    const p2 = add(post(150), 'rope', [70, 84 + 75, -22]);
    for (const p of [p1, p2]) { p.material = p.material.clone(); p.material.map = rope.clone(); p.material.map.repeat.set(1, p.geometry.parameters.height / 24); }
    // shelf and the bed on top
    add(disc(48, 10), 'carpet', [-35, 147, 0]);
    add(disc(52, 10), 'carpet', [36, 233, 0]);
    add(disc(42, 4), 'cushion', [36, 239, 0], 0);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(46, 8, 12, 40), this.mats.trim);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(36, 242, 0);
    this.group.add(rim);
    // pom-pom on a string under the shelf
    this.pomBall = this.part(new THREE.IcosahedronGeometry(10, 2), 'pom', [0, 0, 0], [10, 10, 10], 1.4);
    const sg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.pomString = new THREE.Line(sg, this.mats.string);
    this.group.add(this.pomString);
  }

  // Put the tree at floor position (x, z) with scale s; surfaces are kept in world space.
  place(x, z, s) {
    this.group.position.set(x, 0, z);
    this.group.scale.setScalar(s);
    this.s = s;
    this.surfaces = SURFACES.map(u => ({ name: u.name, y: u.y * s, x0: x + u.x0 * s, x1: x + u.x1 * s, z: z + u.z * s }));
    this.left = x - 85 * s; this.right = x + 85 * s;
    this.post = { x: x - 45 * s };
    this.update(0);
  }
  surface(name) { return this.surfaces.find(u => u.name === name); }

  // World position of the pom-pom ball.
  pomWorld() {
    const s = this.s, g = this.group.position;
    return { x: g.x + this.pom.x * s, y: this.pom.y * s, z: g.z + POM.z * s };
  }
  swatPom(dir) { this.pom.vel += dir * (2.5 + Math.random() * 1.5); }

  update(dt) {
    const p = this.pom;
    // damped pendulum (g / length ≈ 30, so a swing takes about a second)
    p.vel += (-30 * Math.sin(p.angle) - 0.8 * p.vel) * dt;
    p.angle += p.vel * dt;
    p.x = POM.x + Math.sin(p.angle) * POM.len;
    p.y = POM.y - Math.cos(p.angle) * POM.len;
    this.pomBall.position.set(p.x, p.y, POM.z);
    const pos = this.pomString.geometry.attributes.position;
    pos.setXYZ(0, POM.x, POM.y, POM.z);
    pos.setXYZ(1, p.x, p.y + 9, POM.z);
    pos.needsUpdate = true;
  }
}
