// What a bird does: hops, pecks, preens, sings, flutters, flies between perches (the floor, the
// cages hanging at the top of the screen, the cat tree, a toy, even the cat's or the pig's head)
// and sleeps in its own cage. It keeps an eye on the cat and flies off when the cat gets ideas.
//
// ctx gives it the world: { S(), bounds(), lane(), ceiling(), cages(), home(), slot(), treeSpots(),
//   cat(), pig(), friends(), house(), toys(), others(), sound, notes(pos), hearts(pos), zzz(on),
//   desk(), effect(kind, pos) }
// sound is this bird's own voice: { tweet(), song(), alarm() }.
const MIN = 60 * 1000;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const FRONT = -Math.PI / 2;
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const INSIDE = ['perch', 'swing']; // spots inside a cage: in and out through its door
// Only one bird fits on these at a time.
const SINGLE = ['roof', 'swing', 'cat', 'pig', 'toy', 'tree', 'friend', 'house'];
const sameSpot = (a, b) => !!a && !!b && a.kind === b.kind && a.cage === b.cage && a.side === b.side && a.id === b.id && a.name === b.name;

export class BirdBrain {
  constructor(bird, ctx) {
    this.bird = bird; this.ctx = ctx;
    this.p = { x: 0, y: 0, z: 20 };     // world position of the bird's feet
    this.yaw = FRONT + 0.6; this.yawTarget = this.yaw;
    this.mode = 'idle'; this.t = 0; this.d = {};
    this.spot = { kind: 'floor', x: 0, z: 20 };
    this.awakeSince = Date.now() - rand(0, 2) * MIN;
    this.nextLook = 0;
    this.happy = 0;
    this.breakUntil = Date.now() + rand(3, 15) * 1000; this.workUntil = 0;
  }

  // ---------- spots the bird can stand on ----------
  // Each returns its current world position (some move: a swaying cage, the cat, the pig, a toy).
  spotPos(s) {
    const c = this.ctx, cg = s.cage != null ? c.cages()[s.cage] : null;
    switch (s.kind) {
      case 'floor': return { x: s.x, y: 0, z: s.z };
      case 'perch': return cg ? cg.perchSpot(s.off || 0) : null;
      case 'swing': return cg ? cg.swingSpot() : null;
      case 'roof': return cg ? cg.roofSpot(s.side || 1) : null;
      case 'tree': { const t = c.treeSpots().find(u => u.name === s.name); return t ? { x: (t.x0 + t.x1) / 2 + (s.off || 0), y: t.y, z: t.z } : null; }
      case 'cat': { const cat = c.cat(); return cat.perchable ? cat.head : null; }
      case 'pig': { const pig = c.pig(); return pig && pig.perchable ? pig.head : null; }
      case 'friend': { const f = c.friends().find(u => u.id === s.id); return f && f.perchable ? f.head : null; }
      case 'house': return c.house();
      case 'desk': { const dk = c.desk(); return dk ? dk.keyboard() : null; }
      case 'toy': { const t = c.toys().find(u => u.id === s.id); return t && !t.moving ? t.top : null; }
    }
    return null;
  }
  // another bird is there, or on its way
  taken(spot) {
    if (!SINGLE.includes(spot.kind)) return false;
    return this.ctx.others().some(b => sameSpot(b.spot, spot) || (b.mode === 'fly' && sameSpot(b.d.spot, spot)));
  }
  homePerch() { return { kind: 'perch', cage: this.ctx.home(), off: [-22, 22, 0][this.ctx.slot()] + rand(-3, 3) }; }
  pickSpot() {
    const c = this.ctx, [x0, x1] = c.bounds(), [z0, z1] = c.lane(), cages = c.cages(), home = c.home();
    const options = [[{ kind: 'floor', x: rand(x0, x1), z: rand(z0, z1) }, 30]];
    cages.forEach((cg, i) => {
      if (!cg) return;
      options.push([{ kind: 'roof', cage: i, side: pick([-1, 1]) }, i === home ? 8 : 5]);
      if (i === home) options.push([this.homePerch(), 7], [{ kind: 'swing', cage: i }, 6]);
    });
    for (const t of c.treeSpots()) if (t.name !== 'base') options.push([{ kind: 'tree', name: t.name, off: rand(-6, 6) }, 5]);
    if (c.cat().settled) options.push([{ kind: 'cat' }, 8]);
    if (c.pig() && c.pig().settled) options.push([{ kind: 'pig' }, 7]);
    for (const f of c.friends()) if (f.settled) options.push([{ kind: 'friend', id: f.id }, 4]);
    if (c.house()) options.push([{ kind: 'house' }, 6]);
    for (const t of c.toys()) if (!t.moving) options.push([{ kind: 'toy', id: t.id }, 5]);
    const free = options.filter(o => !this.taken(o[0]));
    let r = Math.random() * free.reduce((s, o) => s + o[1], 0);
    for (const [spot, w] of free) if ((r -= w) < 0) return spot;
    return free[0][0];
  }

  // ---------- modes ----------
  go(mode, d = {}) {
    if (this.mode === 'work' && mode !== 'work') this.breakUntil = Date.now() + rand(1, 2.5) * MIN;
    this.mode = mode; this.t = 0; this.d = d;
    const pose = { fly: 'fly', held: 'held', flutter: 'flutter', peck: 'stand', sleep: 'sleep', sing: 'sing', preen: 'preen', remind: 'sing' }[mode] || 'stand';
    this.bird.setPose(pose);
    this.ctx.zzz(mode === 'sleep');
  }
  decide() {
    // office mode (main bird only): onto the desk to type
    const desk = this.ctx.desk();
    if (desk && Date.now() > this.breakUntil && !this.reminding) {
      return this.flyTo({ kind: 'desk' }, () => { this.workUntil = Date.now() + rand(4, 9) * MIN; this.go('work', { next: 0 }); this.yawTarget = desk.seatSpot().yaw; });
    }
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
        // home to its own cage, onto the perch
        const home = this.ctx.home();
        if (home != null && !(this.spot.kind === 'perch' && this.spot.cage === home)) this.flyTo(this.homePerch(), () => this.start('sleep'));
        else { this.go('sleep', { dur: rand(60, 180) }); this.yawTarget = FRONT + 0.5; }
        break;
      }
      default: this.go('idle', { dur: 2 });
    }
  }
  // Fly to a spot; into or out of a cage through its door.
  flyTo(spot, then) {
    const to = this.spotPos(spot);
    if (!to) return this.go('idle', { dur: 1 });
    const cages = this.ctx.cages(), path = [];
    const door = s => INSIDE.includes(s.kind) && cages[s.cage] ? cages[s.cage].doorFront() : null;
    const roof = s => s.kind === 'roof' && cages[s.cage] ? cages[s.cage].roofFront(s.side || 1) : null;
    const out = door(this.spot) || roof(this.spot), into = door(spot) || roof(spot);
    if (out) { path.push(out); this.nudge(this.spot, -1); }
    if (into && !(out && this.spot.cage === spot.cage && door(this.spot) && door(spot))) path.push(into);
    path.push(to);
    this.go('fly', { path, i: 0, spot, then, seg: null });
    this.ctx.sound.tweet();
  }
  nudge(spot, k) {
    const cg = spot && spot.cage != null ? this.ctx.cages()[spot.cage] : null;
    if (cg) cg.nudge(k * rand(0.06, 0.12) * (spot.side || (Math.random() < 0.5 ? -1 : 1)));
  }
  // Startled (the cat is about to pounce): somewhere high, or else far from the cat.
  flee() {
    if (this.mode === 'fly' || this.mode === 'held' || this.spot.kind !== 'floor') return;
    this.ctx.sound.alarm();
    const c = this.ctx, high = [];
    c.cages().forEach((cg, i) => { if (cg) high.push({ kind: 'roof', cage: i, side: pick([-1, 1]) }); });
    if (c.home() != null) high.push(this.homePerch());
    for (const t of c.treeSpots()) if (t.name === 'shelf' || t.name === 'bed') high.push({ kind: 'tree', name: t.name });
    const free = high.filter(s => !this.taken(s));
    if (free.length) return this.flyTo(pick(free));
    const [x0, x1] = c.bounds(), [z0, z1] = c.lane(), cat = c.cat();
    this.flyTo({ kind: 'floor', x: cat.x > (x0 + x1) / 2 ? rand(x0, x0 + 200) : rand(x1 - 200, x1), z: rand(z0, z1) });
  }
  wake() { this.awakeSince = Date.now(); this.ctx.sound.tweet(); this.go('flutter', { dur: 1 }); }

  // When this bird is the main pet it gives the reminders: it comes down to the floor and sings
  // at you until you answer (the speech bubble hangs over it).
  remind() { this.reminding = true; this.awakeSince = Date.now(); }
  nag() { if (this.mode === 'remind') { this.d.hop = this.t; this.ctx.sound.song(); } }
  endRemind(done) {
    this.reminding = false;
    if (this.mode !== 'remind') return;
    if (done) { this.go('sing', { dur: 2.5, next: 0 }); this.ctx.sound.song(); } else this.go('idle', { dur: 2 });
  }
  // called over from the menu (main pet only)
  come(x) {
    if (this.mode === 'held') return;
    this.flyTo({ kind: 'floor', x, z: this.ctx.lane()[0] + 10 }, () => this.go('sing', { dur: 2.5, next: 0 }));
  }

  // ---------- user ----------
  petted() {
    if (this.mode === 'sleep') { this.wake(); return; }
    if (this.mode === 'fly' || this.mode === 'held') return;
    this.happy = 1.2;
    this.ctx.hearts(this.headWorld());
    this.go('sing', { dur: 2.5, next: 0 });
    this.ctx.sound.song();
  }
  grab() { this.go('held'); this.nudge(this.spot, -1); this.spot = { kind: 'floor', x: this.p.x, z: this.p.z }; this.ctx.sound.alarm(); }
  release() { this.flyTo(this.pickSpot()); }
  // the cat's reminder: come over and sing along
  cheer() {
    if (this.mode === 'held') return;
    if (this.mode === 'sleep') this.awakeSince = Date.now();
    const cat = this.ctx.cat(), side = Math.random() < 0.5 ? -1 : 1;
    const [x0, x1] = this.ctx.bounds();
    this.flyTo({ kind: 'floor', x: clamp(cat.x + side * rand(60, 130), x0, x1), z: cat.z + rand(4, 14) }, () => this.start('sing'));
  }

  headWorld() {
    const v = this.bird.neck.localToWorld(this.bird.neck.position.clone().set(4, 16, 0));
    return { x: v.x, y: v.y, z: v.z };
  }

  update(dt) {
    this.t += dt;
    const d = this.d, b = this.bird, c = this.ctx;
    if (this.happy > 0) { this.happy -= dt; b.target.eyeOpen = this.happy > 0 ? 0.15 : b.base.eyeOpen; }

    // reminding: down to the floor, then sing at the user
    if (this.reminding && !['fly', 'held', 'remind'].includes(this.mode)) {
      if (this.spot.kind === 'floor') { this.go('remind', { next: 0 }); this.yawTarget = FRONT; }
      else { const [x0, x1] = c.bounds(); this.flyTo({ kind: 'floor', x: clamp(this.p.x, x0, x1), z: c.lane()[0] + 10 }); }
      return; // the new mode starts next frame
    }
    // stuck to a moving spot (a swaying cage, the cat, the pig, a toy)?
    if (this.mode !== 'fly' && this.mode !== 'held' && this.spot.kind !== 'floor') {
      const pos = this.spotPos(this.spot);
      if (!pos) { this.flyTo(this.pickSpot()); return; } // it moved away or vanished: take off
      Object.assign(this.p, pos);
    }

    switch (this.mode) {
      case 'idle':
        this.lookAround(dt);
        if (this.t > d.dur) this.decide();
        break;
      case 'hop': {
        // little two-footed hops
        if (this.spot.kind !== 'floor') { this.decide(); break; }
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
      case 'work':
        // typing by pecking the keys
        if (this.t > d.next) {
          d.next = this.t + rand(0.18, 0.4);
          b.target.pitch = 0.5; b.target.headPitch = 0.55;
          setTimeout(() => { if (this.mode === 'work') { b.target.pitch = 0.1; b.target.headPitch = 0.1; } }, 90);
          if (Math.random() < 0.08) c.effect('type', this.headWorld());
        }
        if (Date.now() > this.workUntil || !c.desk()) { this.breakUntil = Date.now() + rand(1, 2.5) * MIN; this.decide(); }
        break;
      case 'remind':
        b.target.headPitch = -0.3;
        b.target.beak = (Math.sin(this.t * 10) > 0.4) ? 0.9 : 0.1;
        b.target.spread = d.hop != null && this.t - d.hop < 0.5 ? 0.9 : 0;
        b.target.flapAmp = d.hop != null && this.t - d.hop < 0.5 ? 0.7 : 0;
        b.target.flapHz = 10;
        if (this.t > d.next) { d.next = this.t + 1.1; c.notes(this.headWorld()); }
        this.yawTarget = FRONT;
        break;
      case 'sleep':
        if (this.t > d.dur) this.wake();
        break;
      case 'fly': this.updateFly(dt); break;
      case 'held': break;
    }
    if (this.mode !== 'fly' && this.mode !== 'hop' && this.mode !== 'held' && this.spot.kind === 'floor') {
      // a little hop when nagging
      this.p.y = this.mode === 'remind' && d.hop != null && this.t - d.hop < 0.5 ? Math.sin((this.t - d.hop) / 0.5 * Math.PI) * 18 * c.S().size : 0;
    }
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
      const last = d.i === d.path.length - 1;
      const to = last ? (this.spotPos(d.spot) || d.path[d.i]) : d.path[d.i];
      const from = { ...this.p };
      const dist = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
      // arc up (less for the short hop through a cage door), but stay on the screen
      const lift = Math.max(30, Math.min(220, dist * 0.3)) * (d.path.length > 1 && (d.i > 0 || !last) ? 0.35 : 1);
      const top = Math.max(from.y, to.y);
      d.seg = { from, to, ctrl: { x: (from.x + to.x) / 2, y: Math.max(top, Math.min(top + lift, this.ctx.ceiling())), z: (from.z + to.z) / 2 },
        T: Math.max(0.5, dist / (230 * S.size)), k: 0 };
    }
    const s = d.seg;
    // the last stop may be moving (a swaying cage, a head, a toy): aim at where it is now
    if (d.i === d.path.length - 1) { const now = this.spotPos(d.spot); if (now) s.to = now; }
    s.k = Math.min(1, s.k + dt / s.T);
    const k = s.k, u = 1 - k;
    const nx = u * u * s.from.x + 2 * u * k * s.ctrl.x + k * k * s.to.x;
    const ny = u * u * s.from.y + 2 * u * k * s.ctrl.y + k * k * s.to.y;
    const nz = u * u * s.from.z + 2 * u * k * s.ctrl.z + k * k * s.to.z;
    const vx = nx - this.p.x, vy = ny - this.p.y, vz = nz - this.p.z;
    if (Math.hypot(vx, vz) > 0.3) this.yawTarget = Math.atan2(-vz, vx);
    this.bird.target.pitch = clamp(-vy / Math.max(1, Math.hypot(vx, vz) + Math.abs(vy)) * 0.8, -0.6, 0.5);
    // flap hard taking off and climbing, glide a little on the way down, flare to land
    this.bird.target.flapAmp = k > 0.85 ? 1.1 : k > 0.3 && vy < 0 ? 0.4 : 0.95;
    this.bird.target.flapHz = vy > 2 ? 16 : 13;
    this.bird.target.tuck = k > 0.8 ? 0.2 : 1;
    this.p.x = nx; this.p.y = ny; this.p.z = nz;
    if (k < 1) return;
    d.seg = null;
    if (++d.i < d.path.length) return;
    this.spot = d.spot.kind === 'floor' ? { kind: 'floor', x: this.p.x, z: this.p.z } : d.spot;
    this.nudge(this.spot, 1);
    this.bird.figure.scale.set(1.1, 0.88, 1.1);
    setTimeout(() => this.bird.figure.scale.set(1, 1, 1), 120);
    this.yawTarget = FRONT + rand(-0.7, 0.7);
    if (d.then) d.then(); else this.go('idle', { dur: rand(1.5, 3) });
  }
}
