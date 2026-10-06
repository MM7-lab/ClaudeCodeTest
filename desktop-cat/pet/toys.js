// The plush toys (公仔). Each is its own WebGPU soft-body page in a full-window,
// see-through iframe, sharing the cat's floor line; they talk to us by postMessage.
export const TOY_NAMES = {
  'baby-bear': '熊啤啤', 'hello-kitty': 'Hello Kitty', moomin: '姆明', 'turbo-granny': '高速婆婆', 'plush-octopus': '八爪魚',
};

// How a toy draws: WebGL first (works on almost every PC, like the cat), then real WebGPU
// on the default and the high-performance graphics chip if WebGL draws nothing.
const MODES = [
  { name: 'WebGL', query: '' },
  { name: 'WebGPU', query: '&gpu=webgpu' },
  { name: 'WebGPU（高效能顯示卡）', query: '&gpu=webgpu&adapter=hp' },
];

export class ToyBox {
  // layer: element to hold the iframes; floorPx: floor height above the window bottom;
  // placeX(i, n): screen x for the i-th of n toys; onStatus(toy, 'loading'|'ready'|'failed', msg).
  constructor(layer, floorPx, placeX, onStatus) {
    Object.assign(this, { layer, floorPx, placeX, onStatus });
    this.toys = new Map();
    this.failed = new Set(); // don't keep retrying a toy that couldn't start this run
    addEventListener('message', e => this.onMessage(e));
  }

  set(ids, size) {
    for (const [id, t] of this.toys) {
      if (!ids.includes(id) || t.size !== size) { t.el.remove(); this.toys.delete(id); }
    }
    for (const id of ids) {
      if (this.toys.has(id) || !TOY_NAMES[id] || this.failed.has(id)) continue;
      this.create(id, size, 0);
    }
  }
  create(id, size, mode) {
    const el = document.createElement('iframe');
    el.className = 'toy';
    el.title = TOY_NAMES[id];
    el.tabIndex = -1;
    el.src = `../toys/${id}.html?pet=1&embed=1&id=${id}&size=${size}&floor=${this.floorPx}${MODES[mode].query}`;
    this.layer.append(el);
    const t = { id, name: TOY_NAMES[id], el, size, mode, modeName: MODES[mode].name, ready: false, state: null, interactive: false, frame: null };
    this.toys.set(id, t);
    this.onStatus(t, 'loading', mode ? `改用 ${MODES[mode].name} 再試` : '');
    // a toy that never says hello (e.g. its graphics hang) counts as failed
    setTimeout(() => { if (this.toys.get(id) === t && !t.ready) this.fail(t, '30 秒都未出到嚟'); }, 30000);
    return t;
  }
  // Nothing has been drawn for a while: try the next graphics chip, or give up.
  retry(t) {
    this.drop(t);
    if (t.mode + 1 < MODES.length) this.create(t.id, t.size, t.mode + 1);
    else this.fail(t, '畫唔到嘢（顯示卡驅動程式可能太舊）');
  }
  drop(t) {
    t.el.remove();
    if (t.frame) t.frame.bmp.close();
    this.toys.delete(t.id);
  }

  onMessage(e) {
    const t = [...this.toys.values()].find(t => t.el.contentWindow === e.source);
    const m = e.data;
    if (!t || !m || typeof m !== 'object') return;
    if (m.type === 'ready') {
      t.ready = true;
      t.adapter = m.adapter || '';
      t.readyAt = performance.now();
      this.onStatus(t, 'ready');
      const all = [...this.toys.keys()];
      this.post(t, { type: 'place', x: this.placeX(all.indexOf(t.id), all.length) });
    } else if (m.type === 'state') {
      t.state = m;
      t.seenAt = performance.now();
      if (m.drawn !== false) t.blankSince = 0;
      else if (!t.blankSince) t.blankSince = t.seenAt;
      else if (t.seenAt - t.blankSince > 8000) this.retry(t);
    } else if (m.type === 'frame') {
      // a copy of the toy's corner of its canvas; we draw it ourselves (see draw())
      if (t.frame) t.frame.bmp.close();
      t.frame = m;
      if (t.el.style.opacity !== '0') t.el.style.opacity = '0';
    } else if (m.type === 'interactive') {
      t.interactive = !!m.on;
    } else if (m.type === 'failed') {
      this.fail(t, m.msg);
    }
  }
  fail(t, msg) {
    // couldn't start this way: try the next way before giving up
    if (t.mode + 1 < MODES.length && this.toys.get(t.id) === t) { this.retry(t); return; }
    this.failed.add(t.id);
    this.drop(t);
    this.onStatus(t, 'failed', msg);
  }
  // Draw each toy's latest frame on the layer behind or in front of the cat. The copy is a
  // rectangle cut out of the toy's canvas; its soft floor shadow would show that edge, so the
  // copy fades out towards its sides first.
  draw(back, front, inFront) {
    back.clearRect(0, 0, back.canvas.width, back.canvas.height);
    front.clearRect(0, 0, front.canvas.width, front.canvas.height);
    for (const t of this.toys.values()) {
      const f = t.frame;
      if (!f) continue;
      const c = t.fade || (t.fade = document.createElement('canvas'));
      if (c.width !== f.w || c.height !== f.h) { c.width = f.w; c.height = f.h; }
      const g = c.getContext('2d');
      g.globalCompositeOperation = 'copy';
      g.drawImage(f.bmp, 0, 0, f.w, f.h);
      g.globalCompositeOperation = 'destination-in';
      g.save();
      g.translate(f.w / 2, f.h / 2);
      g.scale(f.w / 2, f.h / 2);
      const grad = g.createRadialGradient(0, 0, 0.7, 0, 0, 1);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(-1, -1, 2, 2);
      g.restore();
      (inFront(t) ? front : back).drawImage(c, f.x, f.y);
    }
  }

  post(t, msg) { try { t.el.contentWindow.postMessage(msg, '*'); } catch {} }
  cursor(c) { for (const t of this.toys.values()) if (t.ready) this.post(t, { type: 'cursor', x: c.x, y: c.y }); }
  // Toys that are running and have told us where they are.
  live() { return [...this.toys.values()].filter(t => t.ready && t.state); }
  hovered() { return this.live().find(t => t.interactive) || null; }
  action(a) { for (const t of this.live()) this.post(t, { type: 'action', action: a }); }
}

// Screen-space helpers for a toy's last reported state.
export const toyCenter = s => ({ x: (s.l + s.r) / 2, y: (s.t + s.b) / 2, w: s.r - s.l, h: s.b - s.t });
