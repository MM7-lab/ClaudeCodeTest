// The plush toys (公仔). Each is its own WebGPU soft-body page in a full-window,
// see-through iframe, sharing the cat's floor line; they talk to us by postMessage.
export const TOY_NAMES = {
  'baby-bear': '熊啤啤', 'hello-kitty': 'Hello Kitty', moomin: '姆明', 'turbo-granny': '高速婆婆', 'plush-octopus': '八爪魚',
};

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
      const el = document.createElement('iframe');
      el.className = 'toy';
      el.title = TOY_NAMES[id];
      el.tabIndex = -1;
      el.src = `../toys/${id}.html?pet=1&embed=1&id=${id}&size=${size}&floor=${this.floorPx}`;
      this.layer.append(el);
      const t = { id, name: TOY_NAMES[id], el, size, ready: false, state: null, interactive: false };
      this.toys.set(id, t);
      this.onStatus(t, 'loading');
      // a toy that never says hello (e.g. its graphics hang) counts as failed
      setTimeout(() => { if (this.toys.get(id) === t && !t.ready) this.fail(t, '30 秒都未出到嚟'); }, 30000);
    }
  }

  onMessage(e) {
    const t = [...this.toys.values()].find(t => t.el.contentWindow === e.source);
    const m = e.data;
    if (!t || !m || typeof m !== 'object') return;
    if (m.type === 'ready') {
      t.ready = true;
      this.onStatus(t, 'ready');
      const all = [...this.toys.keys()];
      this.post(t, { type: 'place', x: this.placeX(all.indexOf(t.id), all.length) });
    } else if (m.type === 'state') {
      t.state = m;
      t.seenAt = performance.now();
    } else if (m.type === 'interactive') {
      t.interactive = !!m.on;
    } else if (m.type === 'failed') {
      this.fail(t, m.msg);
    }
  }
  fail(t, msg) {
    this.failed.add(t.id);
    t.el.remove();
    this.toys.delete(t.id);
    this.onStatus(t, 'failed', msg);
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
