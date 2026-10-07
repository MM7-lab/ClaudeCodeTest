// What the bird does: hops, pecks, preens, sings, flutters, flies between perches (the floor,
// its cage, the cat tree, a toy, even the cat's head) and sleeps in its cage. It keeps an eye on
// the cat and flies off when the cat gets ideas.
//
// ctx gives it the world: { S(), bounds(), lane(), cage(), treeSpots(), cat(), toys(), sound,
//   notes(pos), hearts(pos), say(text) }
const MIN = 60 * 1000;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const FRONT = -Math.PI / 2;
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class BirdBrain {
  constructor(bird, ctx) {
    this.bird = bird; this.ctx = ctx;
    this.p = { x: 0, y: 0, z: 20 };     // world position of the bird's feet
    this.yaw = FRONT + 0.6; this.yawTarget = this.yaw;
    this.mode = 'idle'; this.t = 0; this.d = {};
    this.spot = { kind: 'floor', x: 0, z: 20 };
    this.awakeSince = Date.now();
    this.nextLook = 0;
    this.happy = 0;
  }

  // ---------- spots the bird can stand on ----------
  // Each returns its current world position (some move: the cat, a toy).
  spotPos(s) {
    const c = this.ctx;
    switch (s.kind) {
      case 'floor': return { x: s.x, y: 0, z: s.z };
      case 'perch': { const cg = c.cage(); return cg ? cg.perchSpot(s.off || 0) : null; }
      case 'roof': { const cg = c.cage(); return cg ? cg.roofSpot() : null; }
      case 'tree': { const t = c.treeSpots().find(u => u.name === s.name); return t ? { x: (t.x0 + t.x1) / 2 + (s.off || 0), y: t.y, z: t.z } : null; }
      case 'cat': { const cat = c.cat(); return cat.perchable ? cat.head : null; }
      case 'toy': { const t = c.toys().find(u => u.id === s.id); return t && !t.moving ? t.top : null; }
    }
    return null;
  }
  pickSpot() {
    const c = this.ctx, S = c.S(), [x0, x1] = c.bounds(), [z0, z1] = c.lane();
    const options = [[{ kind: 'floor', x: rand(x0, x1), z: rand(z0, z1) }, 30]];
    if (c.cage()) options.push([{ kind: 'roof' }, 10], [{ kind: 'perch', off: rand(-18, 18) }, 8]);
    for (const t of c.treeSpots()) if (t.name !== 'base') options.push([{ kind: 'tree', name: t.name, off: rand(-6, 6) }, 5]);
    if (c.cat().settled) options.push([{ kind: 'cat' }, 9]);
    for (const t of c.toys()) if (!t.moving) options.push([{ kind: 'toy', id: t.id }, 6]);
    let r = Math.random() * options.reduce((s, o) => s + o[1], 0);
    for (const [spot, w] of options) if ((r -= w) < 0) return spot;
    return options[0][0];
  }

  // ---------- modes ----------
  go(mode, d = {}) {
    this.mode = mode; this.t = 0; this.d = d;
    const pose = { fly: 'fly', held: 'held', flutter: 'flutter', peck: 'stand', sleep: 'sleep', sing: 'sing', preen: 'preen' }[mode] || 'stand';
    this.bird.setPose(pose);
    this.ctx.zzz(mode === 'sleep');
  }
  decide() {
    const awake = (Date.now() - this.awakeSince) / MIN, onFloor = this.spot.kind === 'floor';
    const opts = [['idle', 14], ['hop', onFloor ? 16 : 0], ['peck', onFloor ? 14 : 3], ['preen', 9], ['sing', 9], ['flutter', 5],
      ['fly', 22], ['sleep', awake > 6 ? 40 : awake > 3 ? 6 : 0]];
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [n, w] of opts) if ((r -= w) < 0) return this.start(n);
    this.start('idle');
  }
  start(n) {
    switch (n) {
      case 'idle': this.go('idle', { dur: rand(2, 5) }); break;
      case 'hop': {
        const [x0, x1] = this.ctx.bounds();
        this.go('hop', { tx: clamp(this.p.x + rand(-140, 140), x0, x1), next: 0 });
        break;
      }
      case 'peck': this.go('peck', { n: 2 + Math.floor(rand(0, 4)), next: 0.2 }); break;
      case 'preen': this.go('preen', { dur: rand(2, 4) }); break;
      case 'sing': this.go('sing', { dur: rand(2.5, 5), next: 0 }); this.ctx.sound.song(); break;
      case 'flutter': this.go('flutter', { dur: 1.2 }); break;
      case 'fly': this.flyTo(this.pickSpot()); break;
      case 'sleep': {
        const cg = this.ctx.cage();
        if (cg && this.spot.kind !== 'perch') this.flyTo({ kind: 'perch', off: rand(-10, 10) }, () => this.start('sleep'));
        else { this.go('sleep', { dur: rand(60, 180) }); this.yawTarget = FRONT + 0.5; }
        break;
      }
      default: this.go('idle', { dur: 2 });
    }
  }
  // Fly to a spot; into or out of the cage through its door.
  flyTo(spot, then) {
    const to = this.spotPos(spot);
    if (!to) return this.go('idle', { dur: 1 });
    const cg = this.ctx.cage(), path = [];
    if (this.spot.kind === 'perch' && cg) path.push(cg.doorFront());
    if (spot.kind === 'perch' && cg) path.push(cg.doorFront());
    path.push(to);
    this.go('fly', { path, i: 0, from: { ...this.p }, spot, then, seg: null });
    this.ctx.sound.tweet();
  }
  // Startled (the cat is about to pounce): somewhere high, or else far from the cat.
  flee() {
    if (this.mode === 'fly' || this.mode === 'held') return;
    this.ctx.sound.alarm();
    const c = this.ctx, high = [];
    if (c.cage()) high.push({ kind: 'roof' }, { kind: 'perch', off: 0 });
    for (const t of c.treeSpots()) if (t.name === 'shelf' || t.name === 'bed') high.push({ kind: 'tree', name: t.name });
    if (high.length) return this.flyTo(pick(high));
    const [x0, x1] = c.bounds(), [z0, z1] = c.lane(), cat = c.cat();
    this.flyTo({ kind: 'floor', x: cat.x > (x0 + x1) / 2 ? rand(x0, x0 + 200) : rand(x1 - 200, x1), z: rand(z0, z1) });
  }
  wake() { this.awakeSince = Date.now(); this.ctx.sound.tweet(); this.go('flutter', { dur: 1 }); }

  // ---------- user ----------
  petted() {
    if (this.mode === 'sleep') { this.wake(); return; }
    this.happy = 1.2;
    this.ctx.hearts(this.headWorld());
    this.go('sing', { dur: 2.5, next: 0 });
    this.ctx.sound.song();
  }
  grab() { this.go('held'); this.spot = { kind: 'floor', x: this.p.x, z: this.p.z }; this.ctx.sound.alarm(); }
  release() { this.flyTo(this.pickSpot()); }
  // the cat's reminder: come over and sing along
  cheer() {
    if (this.mode === 'held') return;
    const cat = this.ctx.cat();
    this.flyTo({ kind: 'floor', x: cat.x + rand(60, 90) * (Math.random() < 0.5 ? -1 : 1), z: cat.z + 8 }, () => this.start('sing'));
  }

  headWorld() {
    const v = this.bird.neck.localToWorld(this.bird.neck.position.clone().set(4, 16, 0));
    return { x: v.x, y: v.y, z: v.z };
  }

  update(dt) {
    this.t += dt;
    const d = this.d, b = this.bird, c = this.ctx;
    if (this.happy > 0) { this.happy -= dt; b.target.eyeOpen = this.happy > 0 ? 0.15 : b.base.eyeOpen; }

    // stuck to a moving spot (the cat, a toy)?
    if (this.mode !== 'fly' && this.mode !== 'held') {
      const pos = this.spotPos(this.spot);
      if (!pos) {                       // it moved away or vanished: take off
        if (this.spot.kind === 'floor') { /* never */ } else { this.flyTo(this.pickSpot()); return; }
      } else if (this.spot.kind !== 'floor') Object.assign(this.p, pos);
    }

    switch (this.mode) {
      case 'idle':
        this.lookAround(dt);
        if (this.t > d.dur) this.decide();
        break;
      case 'hop': {
        // little two-footed hops
        if (this.t > d.next) {
          d.next = this.t + 0.32;
          const dx = d.tx - this.p.x;
          if (Math.abs(dx) < 6) { this.decide(); break; }
          d.hopFrom = this.p.x; d.hopTo = this.p.x + Math.sign(dx) * Math.min(Math.abs(dx), 22 * c.S().size);
          d.hopT = 0;
          this.yawTarget = Math.sign(dx) > 0 ? -0.35 : Math.PI + 0.35;
        }
        if (d.hopTo != null) {
          d.hopT = Math.min(1, d.hopT + dt / 0.22);
          this.p.x = d.hopFrom + (d.hopTo - d.hopFrom) * d.hopT;
          this.p.y = Math.sin(d.hopT * Math.PI) * 7 * c.S().size;
          this.spot.x = this.p.x;
        }
        break;
      }
      case 'peck': {
        if (this.t > d.next) {
          d.next = this.t + rand(0.35, 0.7);
          if (d.n-- <= 0) { this.decide(); break; }
          b.target.pitch = 0.55; b.target.headPitch = 0.6;
          setTimeout(() => { if (this.mode === 'peck') { b.target.pitch = 0; b.target.headPitch = 0; } }, 140);
        }
        break;
      }
      case 'preen':
        b.look.yaw = Math.sin(this.t * 2) * 0.3 + 1.1;
        b.look.roll = Math.sin(this.t * 9) * 0.15;
        if (this.t > d.dur) { b.look.yaw = 0; b.look.roll = 0; this.decide(); }
        break;
      case 'sing':
        b.target.beak = (Math.sin(this.t * 14) > 0.2) ? 1 : 0.1;
        if (this.t > d.next) { d.next = this.t + 0.6; c.notes(this.headWorld()); }
        if (this.t > d.dur) { b.target.beak = 0; this.decide(); }
        break;
      case 'flutter':
        if (this.t > d.dur) this.decide();
        break;
      case 'sleep':
        if (this.t > d.dur) this.wake();
        break;
      case 'fly': this.updateFly(dt); break;
      case 'held': break;
    }
    if (this.mode !== 'fly' && this.mode !== 'hop' && this.mode !== 'held' && this.spot.kind === 'floor') this.p.y = 0;
    this.yaw += angleDiff(this.yawTarget, this.yaw) * (1 - Math.exp(-dt * 10));
  }

  lookAround(dt) {
    const b = this.bird;
    if (this.t > this.nextLook) {
      this.nextLook = this.t + rand(0.4, 1.6);
      b.look.yaw = rand(-0.9, 0.9);
      b.look.roll = Math.random() < 0.3 ? rand(-0.5, 0.5) : 0;
      if (Math.random() < 0.15) this.yawTarget = FRONT + rand(-0.9, 0.9);
    }
  }

  updateFly(dt) {
    const d = this.d, S = this.ctx.S();
    if (!d.seg) {
      const to = d.i === d.path.length - 1 ? (this.spotPos(d.spot) || d.path[d.i]) : d.path[d.i];
      const from = { ...this.p };
      const dist = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
      const lift = Math.max(30, dist * 0.3) * (d.path.length > 1 && d.i > 0 ? 0.3 : 1);
      d.seg = { from, to, ctrl: { x: (from.x + to.x) / 2, y: Math.max(from.y, to.y) + lift, z: (from.z + to.z) / 2 },
        T: Math.max(0.5, dist / (230 * S.size)), k: 0 };
    }
    const s = d.seg;
    // the last stop may be moving (the cat's head, a toy): aim at where it is now
    if (d.i === d.path.length - 1) { const now = this.spotPos(d.spot); if (now) s.to = now; }
    s.k = Math.min(1, s.k + dt / s.T);
    const k = s.k, u = 1 - k;
    const nx = u * u * s.from.x + 2 * u * k * s.ctrl.x + k * k * s.to.x;
    const ny = u * u * s.from.y + 2 * u * k * s.ctrl.y + k * k * s.to.y;
    const nz = u * u * s.from.z + 2 * u * k * s.ctrl.z + k * k * s.to.z;
    const vx = nx - this.p.x, vy = ny - this.p.y, vz = nz - this.p.z;
    if (Math.hypot(vx, vz) > 0.3) this.yawTarget = Math.atan2(-vz, vx);
    this.bird.target.pitch = clamp(-vy / Math.max(1, Math.hypot(vx, vz) + Math.abs(vy)) * 0.8, -0.6, 0.5);
    // flap hard taking off, glide a little, flare to land
    this.bird.target.flapAmp = k > 0.85 ? 1.1 : k > 0.3 && vy < 0 ? 0.4 : 0.95;
    this.bird.target.tuck = k > 0.8 ? 0.2 : 1;
    this.p.x = nx; this.p.y = ny; this.p.z = nz;
    if (k < 1) return;
    d.seg = null;
    if (++d.i < d.path.length) return;
    this.spot = d.spot.kind === 'floor' ? { kind: 'floor', x: this.p.x, z: this.p.z } : d.spot;
    this.bird.figure.scale.set(1.1, 0.88, 1.1);
    setTimeout(() => this.bird.figure.scale.set(1, 1, 1), 120);
    this.yawTarget = FRONT + rand(-0.7, 0.7);
    if (d.then) d.then(); else this.go('idle', { dur: rand(1.5, 3) });
  }
}
