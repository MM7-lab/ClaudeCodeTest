// What the pig does: potters about, trots, sniffs the floor, plops down to sit, rolls on its back,
// does a happy dance on one leg, follows the cat around, and goes to bed in its own bed.
//
// ctx gives it the world: { S(), scale(), bounds(), lane(), bed(), cat(), sound, notes(pos),
//   hearts(pos), zzz(on), desk(), effect(kind, pos), office(), atBowl(), toy() }
import { fitSeat } from './office.js';
import * as THREE from '../node_modules/three/build/three.module.js';
const MIN = 60 * 1000;
const V = new THREE.Vector3();
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
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
    this.breakUntil = Date.now() + rand(3, 15) * 1000; this.workUntil = 0;
  }

  go(mode, d = {}) {
    if (this.mode === 'sleep' && mode !== 'sleep') this.ctx.bed()?.tuck(false);
    if (!d.keep && !['bedHop', 'work'].includes(mode)) this.ctx.office()?.release();
    if (this.mode === 'work' && mode !== 'work') this.breakUntil = Date.now() + rand(1, 2.5) * MIN;
    this.mode = mode; this.t = 0; this.d = d;
    const pose = { sit: 'sit', sleep: 'sleep', roll: 'roll', sniff: 'sniff', dance: 'dance', held: 'held', fall: 'fall', cheer: 'cheer', remind: 'cheer', work: 'sit' }[mode] || 'stand';
    this.pig.setPose(pose);
    this.ctx.zzz(mode === 'sleep');
  }
  // still enough for a bird to stand on its head
  get perchable() { return ['idle', 'sit', 'sleep', 'sniff', 'work'].includes(this.mode); }
  get settled() { return this.perchable && this.t > 1.5; }
  get busy() { return this.onSofa || ['line', 'walk', 'trot', 'dance', 'roll', 'held', 'fall', 'hop', 'bedHop', 'follow', 'work'].includes(this.mode); }

  decide() {
    const awake = (Date.now() - this.awakeSince) / MIN;
    if (this.inBed) {
      // just woke up in bed: a stretch of the legs, then out
      return this.hopOut();
    }
    if (this.onSofa) return this.offSofa();
    // office mode: back to the desk after a break
    if (this.ctx.desk() && Date.now() > this.breakUntil && !this.reminding) return this.start('work');
    const opts = [['idle', 12], ['walk', 24], ['trot', 7], ['sniff', 12], ['sit', 12], ['dance', 8], ['roll', 4], ['hop', 4],
      ['follow', 7], ['sleep', awake > 7 ? 40 : awake > 4 ? 6 : 0],
      ['sofa', this.ctx.office() ? 8 : 0], ['drink', this.ctx.office() ? 5 : 0], ['toy', this.ctx.toy() ? 6 : 0]];
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
      case 'work': {
        // round to the side of the desk, then up onto the chair
        const desk = this.ctx.desk();
        if (!desk) return this.start('idle');
        const side = desk.sideSpot(), seat = desk.seatSpot();
        this.go('trot', { tx: side.x, tz: side.z, speed: 90, then: () => this.go('bedHop', {
          from: { x: this.x, z: this.z, y: 0 }, to: { x: seat.x, z: seat.z, y: desk.top() * 0.5 },
          then: () => { this.workUntil = Date.now() + rand(4, 9) * MIN; this.go('work', { next: rand(5, 10), act: 'type' }); } }) });
        break;
      }
      case 'follow': {
        const cat = this.ctx.cat();
        if (!cat.onFloor) return this.start('walk');
        this.go('follow', { dur: rand(8, 14) });
        break;
      }
      case 'sofa': this.toSofa(Math.random() < 0.3 ? 'sleep' : 'sit'); break;
      case 'drink': {
        // a drink at the office water cooler
        const b = this.ctx.office()?.cooler();
        if (!b) return this.start('idle');
        this.go('trot', { tx: b.x, tz: b.z, speed: 80, keep: true,
          then: () => { this.go('sniff', { dur: rand(3, 5), drink: true, keep: true }); this.yawTarget = b.yaw; this.ctx.atBowl(); } });
        break;
      }
      case 'toy': {
        // hug a plush toy, or give it a little kick
        const t = this.ctx.toy();
        if (!t) return this.start('idle');
        const side = this.x < t.x ? -1 : 1, hug = Math.random() < 0.55;
        this.go('trot', { tx: t.x - side * (t.w / 2 + 30 * this.ctx.scale()), tz: t.z, speed: 85,
          then: () => {
            this.yawTarget = side < 0 ? 0 : Math.PI;
            if (hug) { this.go('cheer', { dur: 3 }); this.pig.target.arms = [1.3, 1.3]; this.happy = 2; this.ctx.hearts(this.headWorld()); this.ctx.sound.oink(1); }
            else { t.poke(side); this.jump(260); this.go('hop', { n: 1 }); this.ctx.sound.oink(2); }
          } });
        break;
      }
      case 'sleep': {
        if (this.ctx.office() && Math.random() < 0.8) return this.toSofa('sleep');
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
    if (this.mode === 'work') { this.happy = 1.5; this.ctx.hearts(this.headWorld()); this.ctx.sound.oink(1); return; }
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
  grab() { this.inBed = false; this.onSofa = false; this.go('held'); this.ctx.sound.oink(2); }
  release(vx, vy) { this.vx = clamp(vx, -700, 700); this.vy = clamp(vy, -500, 700); this.go('fall'); }
  // When the pig is the main pet, it gives the reminders: it stands facing you, waving, until
  // you answer (the speech bubble hangs over its head).
  remind() {
    this.reminding = true;
    this.awakeSince = Date.now();
  }
  nag() { if (this.mode === 'remind') { this.jump(340); this.ctx.sound.oink(2); } }
  endRemind(done) {
    this.reminding = false;
    if (this.mode !== 'remind') return;
    if (done) this.dance(3); else { this.go('sit', { dur: 3 }); this.faceUser(); }
  }
  // called over from the menu (main pet only)
  come(x) {
    const go = () => this.go('trot', { tx: x, tz: this.ctx.lane()[0], speed: 115, then: () => { this.go('sit', { dur: 6 }); this.yawTarget = FRONT; } });
    if (this.inBed) { this.hopOut(); this.d.then = go; } else if (!['held', 'fall'].includes(this.mode)) go();
  }
  // a dog came running at it: trot off the other way
  flee(fromX) {
    if (this.busy || this.inBed || this.mode === 'sleep' || this.reminding) return;
    const [x0, x1] = this.ctx.bounds();
    this.go('trot', { tx: fromX < this.x ? x1 - rand(0, 120) : x0 + rand(0, 120), tz: this.z, speed: 140 });
    this.ctx.sound.oink(2);
  }
  // a dog play-bowed at it: dance!
  play() { if (!this.busy && !this.inBed && this.mode !== 'sleep' && !this.reminding) this.dance(3); }
  // somebody else got petted: trot over for some too
  jealous(x) {
    if (this.busy || this.inBed || this.mode === 'sleep' || this.reminding) return;
    const [x0, x1] = this.ctx.bounds(), side = this.x < x ? -1 : 1;
    this.go('trot', { tx: clamp(x + side * rand(100, 150) * this.ctx.scale(), x0, x1), tz: this.z, speed: 115,
      then: () => { this.go('cheer', { dur: 3 }); this.yawTarget = FRONT; this.ctx.sound.oink(1); } });
  }
  // up onto a sofa seat to sit or nap; and back down
  toSofa(then) {
    const seat = this.ctx.office()?.sofa();
    if (!seat) return this.go('idle', { dur: 2 });
    this.go('trot', { tx: seat.side.x, tz: seat.side.z, speed: 80, keep: true, then: () => this.go('bedHop', {
      from: { x: this.x, z: this.z, y: 0 }, to: { x: seat.x, z: seat.z, y: seat.y },
      then: () => { this.onSofa = true; this.go(then, { dur: then === 'sleep' ? rand(60, 150) : rand(6, 14), keep: true }); this.yawTarget = then === 'sleep' ? 0 : seat.yaw; } }) });
  }
  offSofa(then) {
    const [x0, x1] = this.ctx.bounds();
    this.onSofa = false;
    this.go('bedHop', { from: { x: this.x, z: this.z, y: this.y }, to: { x: clamp(this.x + rand(-60, 60), x0, x1), z: rand(...this.ctx.lane()), y: 0 },
      then: then || (() => { this.go('idle', { dur: 1.5 }); this.faceUser(); }) });
  }
  // a meeting at the whiteboard: sit in the audience
  attend(spot) {
    if (['held', 'fall', 'bedHop'].includes(this.mode) || this.reminding) return;
    if (this.mode === 'work') return this.leaveDesk(() => this.attend(spot));
    if (this.onSofa) return this.offSofa(() => this.attend(spot));
    if (this.inBed) return;
    this.go('trot', { tx: spot.x, tz: spot.z, speed: 100, then: () => { this.go('sit', { dur: 40, attend: true }); this.yawTarget = spot.yaw; } });
  }
  // a parade: trot along in line (target() says where to be), or lead it
  joinLine(target) {
    if (['held', 'fall', 'bedHop'].includes(this.mode) || this.reminding) return;
    if (this.mode === 'work') return this.leaveDesk(() => this.joinLine(target));
    if (this.onSofa) return this.offSofa(() => this.joinLine(target));
    if (this.inBed) { this.hopOut(); this.d.then = () => this.joinLine(target); return; }
    this.go('line', { target, dur: 60 });
  }
  lead(points, done) {
    if (this.mode === 'work') return this.leaveDesk(() => this.lead(points, done));
    if (this.onSofa) return this.offSofa(() => this.lead(points, done));
    const step = i => (i >= points.length ? done() : this.go('walk', { tx: points[i].x, tz: points[i].z, speed: 62, then: () => step(i + 1) }));
    step(0);
  }
  party() {
    if (['held', 'fall', 'bedHop'].includes(this.mode) || this.reminding) return;
    if (this.mode === 'work') return this.leaveDesk(() => this.party());
    if (this.onSofa) return this.offSofa(() => this.party());
    if (this.inBed) return;
    this.dance(8);
  }
  eventOver() { if (this.mode === 'line') { this.go('sit', { dur: 3 }); this.faceUser(); this.ctx.hearts(this.headWorld()); } }
  meetingOver() {
    if (this.mode === 'sit' && this.d.attend) { this.ctx.effect('clap', this.headWorld()); this.happy = 1.2; this.go('sit', { dur: 2 }); }
  }
  // off the chair, down in front of the desk
  leaveDesk(then) {
    const desk = this.ctx.desk(), side = desk ? desk.sideSpot() : { x: this.x, z: 30 };
    this.breakUntil = Date.now() + rand(1, 2.5) * MIN;
    this.go('bedHop', { from: { x: this.x, z: this.z, y: this.y }, to: { x: side.x, z: clamp(side.z + 70, ...this.ctx.lane()), y: 0 },
      then: then || (() => { this.go('idle', { dur: 1.5 }); this.faceUser(); }) });
  }
  // the main pet's reminder: come over and cheer
  cheer() {
    if (['held', 'fall'].includes(this.mode)) return;
    if (this.mode === 'work') return this.leaveDesk(() => this.cheer());
    if (this.onSofa) return this.offSofa(() => this.cheer());
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
    const moving = ['walk', 'trot', 'follow', 'line'].includes(this.mode);
    if (!moving) p.gait.amp *= Math.exp(-dt * 8);
    // reminding (as the main pet): drop everything, get out of bed, and wave
    if (this.reminding && !['held', 'fall', 'bedHop', 'remind'].includes(this.mode)) {
      if (this.inBed) this.hopOut(); else if (this.mode === 'work') this.leaveDesk(); else if (this.onSofa) this.offSofa();
      else { this.go('remind'); this.yawTarget = FRONT; }
      return; // the new mode starts next frame
    }
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
        if (d.drink) { p.target.headPitch = 0.45; if (this.t > (d.say ?? 0.5)) { d.say = this.t + 1.6; c.effect('drink', this.headWorld()); } }
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
      case 'work': {
        // at the desk: arms forward on the keyboard, typing; now and then a think or a sip
        const desk = c.desk();
        if (!desk) { this.leaveDesk(); break; }
        if (this.t > d.next) {
          d.act = pick(['type', 'type', 'think', 'sip', 'type']); d.next = this.t + (d.act === 'type' ? rand(5, 10) : 2.5);
          if (d.act !== 'type') c.effect(d.act === 'think' ? 'idea' : 'coffee', this.headWorld());
        }
        const w = Math.sin(this.t * 16);
        p.target.arms = d.act === 'type' ? [1.45 + Math.max(0, w) * 0.2, 1.45 + Math.max(0, -w) * 0.2] : d.act === 'think' ? [1.45, 2.6] : [1.45, 2.4];
        p.target.armsOut = [0, 0];
        p.target.headPitch = d.act === 'think' ? -0.25 : 0.15;
        if (d.act === 'type' && this.t > (d.tick ?? 1)) { d.tick = this.t + 2.4; c.effect('type', this.headWorld()); }
        this.yawTarget = desk.seatSpot().yaw;
        this.pig.root.updateMatrixWorld(true);
        const paws = this.pig.arms.map(arm => { const q = arm.localToWorld(V.set(0.4, -11.2, 0)); return { y: q.y, z: q.z }; });
        const e = this.pig.neck.localToWorld(V.set(17, 22, 0));
        fitSeat(this, paws, { y: e.y, z: e.z }, desk, 1 - Math.exp(-dt * 6));
        desk.setSeat(this.y);
        if (Date.now() > this.workUntil) this.leaveDesk();
        break;
      }
      case 'line': {
        const q = d.target();
        if (!q || this.t > d.dur) { this.go('sit', { dur: 3 }); this.faceUser(); break; }
        const dist = Math.hypot(q.x - this.x, q.z - this.z);
        if (dist > 14) this.walkTo(dt, q.x, q.z, dist > 80 ? 140 : 62);
        if (this.t > (d.note ?? 1)) { d.note = this.t + rand(2, 4); c.effect('note', this.headWorld()); }
        break;
      }
      case 'remind':
        p.target.armsOut = [2.6 + Math.sin(this.t * 9) * 0.25, 2.6 - Math.sin(this.t * 9) * 0.25];
        if (this.y > 0 || this.vy > 0) this.physics(dt);
        this.yawTarget = FRONT;
        break;
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
    if (!['hop', 'fall', 'held', 'bedHop', 'remind', 'work'].includes(this.mode) && !this.inBed && !this.onSofa) this.y = 0;
    this.squash *= Math.exp(-dt * 7);
    this.yaw += angleDiff(this.yawTarget, this.yaw) * (1 - Math.exp(-dt * 7));
  }
}
