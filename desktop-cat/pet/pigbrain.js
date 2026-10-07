// What the pig does: potters about, trots, sniffs the floor, plops down to sit, rolls on its back,
// does a happy dance on one leg, follows the cat around, and goes to bed in its own bed.
//
// ctx gives it the world: { S(), scale(), bounds(), lane(), bed(), cat(), sound, notes(pos),
//   hearts(pos), zzz(on) }
const MIN = 60 * 1000;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const FRONT = -Math.PI / 2;
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class PigBrain {
  constructor(pig, ctx) {
    this.pig = pig; this.ctx = ctx;
    this.x = 0; this.y = 0; this.z = 30; this.vx = 0; this.vy = 0;
    this.yaw = FRONT; this.yawTarget = FRONT;
    this.mode = 'idle'; this.t = 0; this.d = {};
    this.inBed = false;
    this.awakeSince = Date.now() - rand(0, 2) * MIN;
    this.happy = 0; this.nextLook = 0; this.squash = 0;
  }

  go(mode, d = {}) {
    if (this.mode === 'sleep' && mode !== 'sleep') this.ctx.bed()?.tuck(false);
    this.mode = mode; this.t = 0; this.d = d;
    const pose = { sit: 'sit', sleep: 'sleep', roll: 'roll', sniff: 'sniff', dance: 'dance', held: 'held', fall: 'fall', cheer: 'cheer' }[mode] || 'stand';
    this.pig.setPose(pose);
    this.ctx.zzz(mode === 'sleep');
  }
  // still enough for a bird to stand on its head
  get perchable() { return ['idle', 'sit', 'sleep', 'sniff'].includes(this.mode); }
  get settled() { return this.perchable && this.t > 1.5; }
  get busy() { return ['walk', 'trot', 'dance', 'roll', 'held', 'fall', 'hop', 'bedHop', 'follow'].includes(this.mode); }

  decide() {
    const awake = (Date.now() - this.awakeSince) / MIN;
    if (this.inBed) {
      // just woke up in bed: a stretch of the legs, then out
      return this.hopOut();
    }
    const opts = [['idle', 12], ['walk', 24], ['trot', 7], ['sniff', 12], ['sit', 12], ['dance', 8], ['roll', 4], ['hop', 4],
      ['follow', 7], ['sleep', awake > 7 ? 40 : awake > 4 ? 6 : 0]];
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [n, w] of opts) if ((r -= w) < 0) return this.start(n);
    this.start('idle');
  }
  start(n) {
    const [x0, x1] = this.ctx.bounds(), [z0, z1] = this.ctx.lane();
    switch (n) {
      case 'idle': this.go('idle', { dur: rand(2, 5) }); this.faceUser(); break;
      case 'walk': case 'trot': {
        let tx = rand(x0, x1);
        if (Math.abs(tx - this.x) < 100) tx = clamp(this.x + (Math.random() < 0.5 ? -1 : 1) * rand(140, 380), x0, x1);
        this.go(n, { tx, tz: rand(z0, z1), speed: n === 'trot' ? 115 : 48 });
        break;
      }
      case 'sniff': this.go('sniff', { dur: rand(2, 4) }); this.yawTarget = Math.random() < 0.5 ? -0.3 : Math.PI + 0.3; break;
      case 'sit': this.go('sit', { dur: rand(6, 14) }); this.faceUser(); break;
      case 'dance': this.dance(); break;
      case 'roll': this.go('roll', { dur: 2.6 }); this.yawTarget = Math.random() < 0.5 ? 0 : Math.PI; this.ctx.sound.oink(1); break;
      case 'hop': this.go('hop', { n: 3 }); this.faceUser(); this.jump(330); break;
      case 'follow': {
        const cat = this.ctx.cat();
        if (!cat.onFloor) return this.start('walk');
        this.go('follow', { dur: rand(8, 14) });
        break;
      }
      case 'sleep': {
        const bed = this.ctx.bed();
        if (!bed) { this.go('sleep', { dur: rand(60, 150) }); this.faceUser(); break; }
        // walk to the front of the bed, hop in, lie down
        this.go('walk', { tx: bed.x + rand(-10, 10) * bed.s, tz: bed.z + 58 * bed.s, speed: 70, then: () => this.hopIn() });
        break;
      }
      default: this.go('idle', { dur: 2 });
    }
  }
  faceUser() { this.yawTarget = FRONT + (Math.cos(this.yaw) >= 0 ? 1 : -1) * 0.45; }
  dance(dur = rand(3.5, 6)) {
    this.go('dance', { dur, next: 0 });
    this.faceUser();
    this.ctx.sound.oink(2);
  }
  jump(v) { this.vy = v; this.y = Math.max(this.y, 0.01); }
  hopIn() {
    const bed = this.ctx.bed();
    if (!bed) return this.go('sleep', { dur: rand(60, 150) });
    this.go('bedHop', { from: { x: this.x, z: this.z, y: 0 }, to: { x: bed.x, z: bed.z, y: bed.SURFACE * bed.s }, into: true });
  }
  hopOut() {
    const bed = this.ctx.bed();
    this.inBed = false;
    if (!bed) return this.go('idle', { dur: 2 });
    const [x0, x1] = this.ctx.bounds();
    this.go('bedHop', { from: { x: this.x, z: this.z, y: this.y }, to: { x: clamp(bed.x + rand(-40, 40) * bed.s, x0, x1), z: bed.z + 64 * bed.s, y: 0 } });
  }

  // ---------- user ----------
  petted() {
    if (this.mode === 'sleep') { this.wake(); return; }
    if (['held', 'fall', 'bedHop'].includes(this.mode)) return;
    this.happy = 1.5;
    this.ctx.hearts(this.headWorld());
    this.dance(3);
  }
  wake() {
    this.awakeSince = Date.now();
    this.ctx.sound.oink(1);
    if (this.inBed) this.hopOut(); else this.go('sit', { dur: 2.5 });
  }
  // the cat came over to say hello
  greet(catX) {
    if (this.busy || this.mode === 'sleep') return;
    this.go('idle', { dur: rand(3, 5) });
    this.yawTarget = catX > this.x ? -0.25 : Math.PI + 0.25;
    this.happy = 1.5;
    this.ctx.sound.oink(2);
    this.ctx.hearts(this.headWorld());
  }
  grab() { this.inBed = false; this.go('held'); this.ctx.sound.oink(2); }
  release(vx, vy) { this.vx = clamp(vx, -700, 700); this.vy = clamp(vy, -500, 700); this.go('fall'); }
  // the cat's reminder: come over and cheer
  cheer() {
    if (['held', 'fall'].includes(this.mode)) return;
    if (this.mode === 'sleep') this.awakeSince = Date.now();
    const cat = this.ctx.cat(), [x0, x1] = this.ctx.bounds(), side = cat.x > 0 ? -1 : 1;
    const go = () => this.go('trot', { tx: clamp(cat.x + side * rand(110, 150) * this.ctx.scale(), x0, x1), tz: cat.z + 6, speed: 115,
      then: () => { this.go('cheer', { dur: 5 }); this.yawTarget = FRONT; this.ctx.sound.oink(2); } });
    this.inBed ? (this.hopOut(), this.d.then = go) : go();
  }
  headWorld() { const v = this.pig.headTop(); return { x: v.x, y: v.y, z: v.z }; }

  // ---------- per frame ----------
  walkTo(dt, tx, tz, speed) {
    const dx = tx - this.x, dz = tz - this.z, dist = Math.hypot(dx, dz);
    if (dist < 3) return true;
    this.yawTarget = Math.atan2(-dz, dx);
    const ahead = Math.max(0, Math.cos(angleDiff(this.yawTarget, this.yaw)));
    const step = Math.min(dist, speed * this.ctx.scale() * dt * ahead);
    this.x += dx / dist * step; this.z += dz / dist * step;
    const g = this.pig.gait, amp = speed > 90 ? 1 : 0.7;
    g.amp += (amp - g.amp) * Math.min(1, dt * 6);
    g.phase += step / (6 * this.ctx.scale()) + dt * (1 - ahead) * 4;
    return false;
  }
  physics(dt) {
    this.vy -= 1600 * dt;
    this.y += this.vy * dt; this.x += this.vx * dt;
    const [x0, x1] = this.ctx.bounds();
    if (this.x < x0) { this.x = x0; this.vx = Math.abs(this.vx) * 0.5; }
    if (this.x > x1) { this.x = x1; this.vx = -Math.abs(this.vx) * 0.5; }
    if (this.y > 0 || this.vy > 0) return -1;
    const force = Math.min(1, -this.vy / 1200);
    this.y = 0; this.vy = 0; this.vx = 0;
    this.squash = 0.1 + force * 0.25;
    return force;
  }

  update(dt) {
    this.t += dt;
    const d = this.d, p = this.pig, c = this.ctx;
    const moving = ['walk', 'trot', 'follow'].includes(this.mode);
    if (!moving) p.gait.amp *= Math.exp(-dt * 8);
    p.look.yaw *= Math.exp(-dt * 3); p.look.pitch *= Math.exp(-dt * 3);
    if (this.happy > 0) { this.happy -= dt; p.target.eyeOpen = this.happy > 0 ? 0.15 : p.base.eyeOpen; }
    switch (this.mode) {
      case 'idle':
        if (this.t > this.nextLook) {
          this.nextLook = this.t + rand(0.8, 2.5);
          p.look.yaw = rand(-0.6, 0.6); p.look.pitch = rand(-0.15, 0.1);
        }
        if (this.t > d.dur) this.decide();
        break;
      case 'walk': case 'trot':
        if (this.walkTo(dt, d.tx, d.tz, d.speed)) { if (d.then) d.then(); else { this.go('idle', { dur: rand(1, 3) }); this.faceUser(); } }
        break;
      case 'follow': {
        // tag along a little behind the cat
        const cat = c.cat(), [x0, x1] = c.bounds();
        if (!cat.onFloor || this.t > d.dur) { this.go('sit', { dur: rand(3, 6) }); this.faceUser(); break; }
        const side = this.x < cat.x ? -1 : 1, tx = clamp(cat.x + side * 105 * c.scale(), x0, x1);
        if (Math.abs(tx - this.x) > 25) this.walkTo(dt, tx, clamp(cat.z + 10, ...c.lane()), Math.abs(tx - this.x) > 200 ? 115 : 55);
        else { this.yawTarget = side < 0 ? 0 : Math.PI; p.gait.amp *= Math.exp(-dt * 8); }
        break;
      }
      case 'sniff':
        p.wiggle = 1;
        p.look.yaw = Math.sin(this.t * 1.7) * 0.4;
        if (this.t > d.dur) { if (Math.random() < 0.4) this.ctx.sound.oink(1); this.decide(); }
        break;
      case 'sit':
        if (this.t > d.dur) this.decide();
        break;
      case 'roll':
        // on its back, legs kicking, then back up
        p.target.legs = [0.6 + Math.sin(this.t * 14) * 0.5, 0.6 - Math.sin(this.t * 14) * 0.5];
        p.target.sway = Math.sin(this.t * 5) * 0.25;
        if (this.t > d.dur) { this.go('idle', { dur: 1.5 }); this.faceUser(); }
        break;
      case 'dance': {
        // on one leg, arms waving, swaying and turning round
        const k = this.t;
        p.target.armsOut = [2.2 + Math.sin(k * 8) * 0.35, 2.2 - Math.sin(k * 8) * 0.35];
        p.target.sway = Math.sin(k * 5) * 0.14;
        p.target.lift = Math.abs(Math.sin(k * 5)) * 3;
        this.yawTarget = this.yaw + dt * 2.2;
        if (k > d.next) { d.next = k + 0.55; c.notes(this.headWorld()); }
        if (k > d.dur) { this.go('idle', { dur: 1.5 }); this.faceUser(); if (Math.random() < 0.5) c.hearts(this.headWorld()); }
        break;
      }
      case 'cheer':
        p.target.armsOut = [2.6 + Math.sin(this.t * 9) * 0.25, 2.6 - Math.sin(this.t * 9) * 0.25];
        p.target.lift = Math.abs(Math.sin(this.t * 6)) * 5;
        if (this.t > d.dur) { this.go('sit', { dur: 4 }); this.faceUser(); }
        break;
      case 'hop':
        if (this.physics(dt) >= 0) {
          if (--d.n > 0) this.jump(300);
          else { this.go('idle', { dur: 1.5 }); if (Math.random() < 0.5) this.ctx.sound.oink(1); }
        }
        break;
      case 'bedHop': {
        const T = 0.55, k = clamp(this.t / T, 0, 1);
        this.x = d.from.x + (d.to.x - d.from.x) * k;
        this.z = d.from.z + (d.to.z - d.from.z) * k;
        this.y = d.from.y + (d.to.y - d.from.y) * k + 28 * c.scale() * 4 * k * (1 - k);
        if (Math.abs(d.to.x - d.from.x) > 4) this.yawTarget = Math.atan2(-(d.to.z - d.from.z), d.to.x - d.from.x);
        if (k < 1) break;
        this.squash = 0.12;
        if (d.into) {
          this.inBed = true;
          this.go('sleep', { dur: rand(60, 180) });
          this.yawTarget = 0;  // lie along the bed, head on the pillow
          c.bed().tuck(true);
        } else if (d.then) d.then();
        else { this.go('idle', { dur: 1.5 }); this.faceUser(); }
        break;
      }
      case 'sleep':
        if (this.t > d.dur) { this.awakeSince = Date.now(); this.ctx.sound.oink(1); this.inBed ? this.hopOut() : this.decide(); }
        break;
      case 'held':
        p.target.legs = [0.3 + Math.sin(this.t * 13) * 0.5, -0.3 - Math.sin(this.t * 13) * 0.5];
        this.yawTarget = FRONT;
        break;
      case 'fall': {
        const landed = this.physics(dt);
        if (landed < 0) break;
        if (landed > 0.4) { this.go('sit', { dur: 2.5 }); this.ctx.sound.oink(1); }
        else { this.go('idle', { dur: 1.5 }); }
        this.faceUser();
        break;
      }
    }
    if (!['hop', 'fall', 'held', 'bedHop'].includes(this.mode) && !this.inBed) this.y = 0;
    this.squash *= Math.exp(-dt * 7);
    this.yaw += angleDiff(this.yawTarget, this.yaw) * (1 - Math.exp(-dt * 7));
  }
}
