// More office furniture (辦公室家俬) for office mode: a water cooler, a sofa, a bookshelf, a
// whiteboard, a printer and a big plant. Each knows the spots where the pets use it.
// Units are screen pixels at size 1; each piece's origin is on the floor at its middle, front +z.
import * as THREE from '../node_modules/three/build/three.module.js';

const CYL = new THREE.CylinderGeometry(1, 1, 1, 24);
const SPHERE = new THREE.SphereGeometry(1, 16, 12);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const FRONT = -Math.PI / 2;

class Piece {
  constructor(ramp, colors) {
    this.mats = { outline: new THREE.MeshBasicMaterial({ color: 0x4a3a30, side: THREE.BackSide }) };
    for (const [k, c] of Object.entries(colors)) this.mats[k] = new THREE.MeshToonMaterial({ color: c, gradientMap: ramp });
    this.group = new THREE.Group();
    this.x = 0; this.z = 0; this.s = 1;
  }
  part(geo, mat, pos, scale = [1, 1, 1], px = 1.2, parent = this.group) {
    const m = new THREE.Mesh(geo, this.mats[mat] || mat);
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
  place(x, z, s) {
    this.group.position.set(x, 0, z);
    this.group.scale.setScalar(s);
    this.x = x; this.z = z; this.s = s;
    this.group.updateMatrixWorld(true);
  }
  w(x, y, z) { return { x: this.x + x * this.s, y: y * this.s, z: this.z + z * this.s }; }
  // the floor spot just in front, for walking up to it
  front(dz = 40, dx = 0) { return this.w(dx, 0, this.D / 2 + dz); }
  update() {}
}

// 飲水機: a water cooler with a big blue bottle that glugs when someone drinks
export class WaterCooler extends Piece {
  constructor(ramp) {
    super(ramp, { body: 0xf4f6f8, trim: 0xc9d2dc, bottle: 0x8fcaf2, water: 0x5fa8e6, tap: 0x4f8fd6, cup: 0xffffff });
    this.WIDTH = 44; this.D = 32;
    this.part(box(36, 66, 30), 'body', [0, 33, 0]);
    this.part(box(38, 4, 32), 'trim', [0, 67, 0]);
    this.part(new THREE.CylinderGeometry(15, 15, 34, 24), 'bottle', [0, 87, 0]);
    this.part(new THREE.CylinderGeometry(13, 13, 26, 24), 'water', [0, 85, 0], [1, 1, 1], 0);
    this.part(new THREE.CylinderGeometry(6, 15, 6, 24), 'bottle', [0, 107, 0], [1, 1, 1], 1);
    for (const x of [-7, 7]) this.part(box(5, 6, 6), 'tap', [x, 50, 16], [1, 1, 1], 0.8);
    this.part(box(28, 3, 10), 'trim', [0, 34, 17], [1, 1, 1], 0.8);
    this.part(new THREE.CylinderGeometry(4, 3, 10, 12), 'cup', [26, 30, 0], [1, 1, 1], 0.8);
    // bubbles inside the bottle
    this.bubbles = [0, 1, 2, 3].map(i => {
      const b = new THREE.Mesh(SPHERE, this.mats.cup);
      b.scale.setScalar(2 + i * 0.4);
      b.visible = false;
      this.group.add(b);
      return b;
    });
    this.glug = 0;
  }
  drink() { this.glug = 2; }
  // stand here (facing the taps) to drink
  spot() { return { ...this.front(28), yaw: Math.PI / 2 }; }
  top() { return this.w(0, 112, 0); }
  update(dt) {
    this.glug = Math.max(0, this.glug - dt);
    this.bubbles.forEach((b, i) => {
      b.visible = this.glug > 0;
      const k = ((this.glug * 1.3 + i * 0.27) % 1);
      b.position.set(Math.sin(i * 2.1) * 6, 74 + (1 - k) * 24, Math.cos(i * 1.7) * 6);
    });
  }
}

// 梳化: a three-seat sofa for breaks and naps
export class Sofa extends Piece {
  constructor(ramp) {
    super(ramp, { frame: 0x5aa8a0, cushion: 0x7cc7bd, pillow: 0xffd28a, leg: 0x6b4c36 });
    this.WIDTH = 170; this.D = 60; this.SEAT = 34;
    for (const x of [-72, 72]) for (const z of [-22, 22]) this.part(box(6, 8, 6), 'leg', [x, 4, z], [1, 1, 1], 0.8);
    this.part(box(160, 18, 58), 'frame', [0, 17, 0]);
    this.part(box(160, 46, 16), 'frame', [0, 44, -22]);
    for (const x of [-80, 80]) this.part(box(14, 36, 58), 'frame', [x, 28, 0], [1, 1, 1], 1.2);
    for (const x of [-48, 0, 48]) this.part(box(46, 8, 44), 'cushion', [x, 30, 5], [1, 1, 1], 1);
    this.part(SPHERE, 'pillow', [-58, 44, -10], [12, 11, 5], 1).rotation.z = 0.3;
    this.part(SPHERE, 'pillow', [58, 44, -10], [12, 11, 5], 1).rotation.z = -0.3;
  }
  // three seats, left to right
  seat(i) { return { ...this.w([-48, 0, 48][i], this.SEAT, 6), yaw: FRONT + [0.35, 0, -0.35][i] }; }
  side(dir) { return this.w(dir * 115, 0, 20); }
  back() { return this.w(pick([-50, 0, 50]), 68, -22); }
}

// 書櫃: a bookshelf; a cat can sit on top
export class Bookshelf extends Piece {
  constructor(ramp) {
    super(ramp, { wood: 0xc99a66, dark: 0xa77a4b, b1: 0xe25b5b, b2: 0x5c9be0, b3: 0xf2c94c, b4: 0x6cbf5a, b5: 0xb38be0 });
    this.WIDTH = 96; this.D = 36; this.TOP = 140;
    // an open frame: sides, top, bottom and a darker back
    for (const x of [-44, 44]) this.part(box(5, 140, 34), 'wood', [x, 70, 0]);
    this.part(box(93, 5, 34), 'wood', [0, 137.5, 0]);
    this.part(box(93, 6, 34), 'wood', [0, 3, 0]);
    this.part(box(84, 132, 2), 'dark', [0, 70, -16], [1, 1, 1], 0);
    const books = ['b1', 'b2', 'b3', 'b4', 'b5'];
    for (const [y, n] of [[6, 9], [50, 7], [94, 8]]) {
      if (y > 10) this.part(box(84, 4, 30), 'wood', [0, y, 1], [1, 1, 1], 0.6);
      let x = -38;
      for (let i = 0; i < n && x < 36; i++) {
        const w = 6 + (i * 7 % 5), h = 26 + (i * 13 % 12);
        const b = this.part(box(w, h, 22), books[(i + y) % 5], [x + w / 2, y + 2 + h / 2, 4], [1, 1, 1], 0.6);
        if (i === n - 1) b.rotation.z = -0.25;
        x += w + 1;
      }
    }
  }
  topSpot() { return { ...this.w(10, this.TOP, 0), yaw: FRONT + 0.3 }; }
  side(dir) { return this.w(dir * 75, 0, 24); }
}

// 白板: a whiteboard on a stand; meetings draw on it
export class Whiteboard extends Piece {
  constructor(ramp) {
    super(ramp, { frame: 0xb8c0ca, leg: 0x7d8794, tray: 0x9aa4b0, pen1: 0xe25b5b, pen2: 0x5c9be0 });
    this.WIDTH = 140; this.D = 24;
    const c = document.createElement('canvas');
    c.width = 256; c.height = 160;
    this.canvas = c;
    this.tex = new THREE.CanvasTexture(c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mats.board = new THREE.MeshToonMaterial({ color: 0xffffff, map: this.tex, gradientMap: ramp });
    // tall, so the board shows above the heads of a seated audience
    const Y = 152;
    for (const x of [-58, 58]) {
      this.part(box(4, Y + 38, 4), 'leg', [x, (Y + 38) / 2, 0], [1, 1, 1], 0.8);
      this.part(box(4, 4, 30), 'leg', [x, 4, 0], [1, 1, 1], 0.8);
    }
    this.part(box(128, 82, 3), 'frame', [0, Y, 1]);
    this.part(box(122, 76, 1), 'board', [0, Y, 3], [1, 1, 1], 0);
    this.part(box(110, 3, 6), 'tray', [0, Y - 42, 5], [1, 1, 1], 0.6);
    this.part(new THREE.CylinderGeometry(1.2, 1.2, 12, 8), 'pen1', [-20, Y - 39.5, 6], [1, 1, 1], 0).rotation.z = Math.PI / 2;
    this.part(new THREE.CylinderGeometry(1.2, 1.2, 12, 8), 'pen2', [0, Y - 39.5, 6], [1, 1, 1], 0).rotation.z = Math.PI / 2;
    this.strokes = []; this.drawn = 0;
    this.write(null);
  }
  // a new meeting topic, drawn bit by bit as the presenter talks
  write(topic) {
    const T = [
      { title: '今日目標', lines: ['💧 飲 8 杯水', '🙆 每個鐘伸展', '😺 多啲笑'] },
      { title: '本週進度', chart: [3, 5, 4, 7] },
      { title: '新點子 💡', lines: ['更多零食', '午睡時間', '摸摸時間 ×2'] },
      { title: '眾心行善 🤝', lines: ['一齊做義工', '一齊加油！'] },
      { title: '開心指數', chart: [6, 8, 9, 10] },
    ];
    this.topic = topic === null ? { title: '', lines: [] } : (topic || pick(T));
    this.drawn = topic === null ? 1 : 0;
    this.render();
  }
  progress(k) { const d = Math.min(1, k); if (Math.abs(d - this.drawn) > 0.04 || d === 1) { this.drawn = d; this.render(); } }
  render() {
    const g = this.canvas.getContext('2d'), t = this.topic, k = this.drawn;
    g.fillStyle = '#fbfdff'; g.fillRect(0, 0, 256, 160);
    g.font = '700 22px "Microsoft JhengHei", "PingFang HK", "Noto Sans CJK TC", sans-serif';
    g.fillStyle = '#2f5fa8'; g.textBaseline = 'top';
    if (t.title) g.fillText(t.title.slice(0, Math.ceil(t.title.length * Math.min(1, k * 3))), 14, 10);
    if (t.lines) {
      g.font = '500 18px "Microsoft JhengHei", "PingFang HK", "Noto Sans CJK TC", sans-serif';
      g.fillStyle = '#c0392b';
      t.lines.forEach((line, i) => { const p = clampK(k * 3 - 1 - i * 0.6); if (p > 0) g.fillText(line.slice(0, Math.ceil(line.length * p)), 22, 46 + i * 34); });
    }
    if (t.chart) {
      const p = clampK(k * 2 - 0.4);
      g.strokeStyle = '#555'; g.lineWidth = 2; g.beginPath(); g.moveTo(24, 146); g.lineTo(240, 146); g.stroke();
      t.chart.forEach((v, i) => {
        g.fillStyle = ['#5c9be0', '#6cbf5a', '#f2c94c', '#e25b5b'][i];
        const h = v * 9 * clampK(p * 4 - i);
        g.fillRect(40 + i * 50, 146 - h, 32, h);
      });
    }
    this.tex.needsUpdate = true;
  }
  // where the presenter stands (beside the board, facing us) and where the audience sits
  presenter() { return { ...this.w(92, 0, 30), yaw: FRONT - 0.5 }; }
  // the audience sits in an arc in front, turned towards the board
  seat(i) {
    const x = [-70, 0, -135, 50][i % 4], z = [70, 92, 48, 108][i % 4];
    return { ...this.w(x, 0, z), yaw: Math.atan2(z, -x * 0.6) };
  }
  topSpot() { return this.w(34, 193, 1); }
}
const clampK = v => Math.max(0, Math.min(1, v));

// 打印機: a printer on a cabinet that prints now and then
export class Printer extends Piece {
  constructor(ramp) {
    super(ramp, { cab: 0x8da2b8, body: 0xe8ebef, dark: 0x5a6470, paper: 0xffffff, light: 0x6cdc7a });
    this.WIDTH = 64; this.D = 44;
    this.part(box(60, 48, 42), 'cab', [0, 24, 0]);
    this.part(box(54, 22, 38), 'body', [0, 59, 0]);
    this.part(box(40, 4, 26), 'dark', [0, 71.5, -2], [1, 1, 1], 0.6);
    this.part(box(36, 2, 12), 'dark', [0, 52, 24], [1, 1, 1], 0.6);
    this.part(SPHERE, 'light', [20, 64, 19.5], [1.6, 1.6, 0.8], 0);
    this.sheet = this.part(box(30, 0.8, 26), 'paper', [0, 54, 10], [1, 1, 1], 0.5);
    this.sheet.visible = false;
    this.t = -1;
  }
  print() { this.t = 0; }
  get printing() { return this.t >= 0 && this.t < 2.4; }
  spot() { return { ...this.front(34), yaw: Math.PI / 2 }; }
  top() { return this.w(-10, 74, -2); }
  update(dt) {
    if (this.t < 0) return;
    this.t += dt;
    const k = Math.min(1, this.t / 2.4);
    this.sheet.visible = this.t < 9;
    this.sheet.position.z = 4 + k * 22;
    this.sheet.position.y = 54 - k * 1.2;
    if (this.t > 9) this.t = -1;
  }
}

// 大盆栽: a big leafy plant in a pot
export class BigPlant extends Piece {
  constructor(ramp) {
    super(ramp, { pot: 0xe9e2d6, rim: 0xcfc6b6, stem: 0x4f8f3a, leaf: 0x5fbf5a, leaf2: 0x46a84a });
    this.WIDTH = 60; this.D = 40;
    this.part(new THREE.CylinderGeometry(17, 13, 34, 20), 'pot', [0, 17, 0]);
    this.part(new THREE.CylinderGeometry(18, 18, 4, 20), 'rim', [0, 34, 0], [1, 1, 1], 0.8);
    const leaves = [[0, 92, 0, 0], [-22, 76, 6, 0.7], [22, 80, -4, -0.7], [-14, 108, -6, 0.4], [16, 104, 8, -0.4], [0, 62, 14, 0]];
    leaves.forEach(([x, y, z, r], i) => {
      this.part(new THREE.CylinderGeometry(1.4, 1.8, y - 30, 6), 'stem', [x * 0.4, 30 + (y - 30) / 2, z * 0.4], [1, 1, 1], 0).rotation.z = r * 0.4;
      const l = this.part(SPHERE, i % 2 ? 'leaf' : 'leaf2', [x, y, z], [16, 7, 11], 1);
      l.rotation.z = r; l.rotation.y = i;
    });
    this.sway = Math.random() * 10;
  }
  topSpot() { return this.w(0, 100, 0); }
  update(dt) { this.sway += dt; this.group.rotation.z = Math.sin(this.sway * 0.7) * 0.01; }
}
