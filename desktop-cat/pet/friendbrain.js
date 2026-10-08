// What a dog or cat friend (朋友) does. They share the cat's body and poses (cat.js) but have
// their own simpler life: wander, sit, nap, stretch; cats groom; dogs sniff about, pant, bark,
// play-bow and do zoomies. They visit the others, tag along after the main cat, and come and
// cheer at reminders.
//
// ctx: { S(), scale(), bounds(), lane(), others(), cat(), sound: { voice(), happy() },
//   hearts(pos), say(text, pos), zzz(on) }
// others() lists everyone it can visit: [{ x, z, size, greet(fromX) }]
const MIN = 60 * 1000;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const FRONT = -Math.PI / 2;
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class FriendBrain {
  constructor(animal, ctx) {
    this.a = animal; this.ctx = ctx;
    this.dog = animal.isDog;
    this.x = 0; this.y = 0; this.z = 25; this.vx = 0; this.vy = 0;
    this.yaw = FRONT; this.yawTarget = FRONT;
    this.mode = 'idle'; this.t = 0; this.d = {};
    this.awakeSince = Date.now() - rand(0, 3) * MIN;
    this.happy = 0; this.nextLook = 0; this.squash = 0; this.pant = 0;
  }

  go(mode, d = {}) {
    this.mode = mode; this.t = 0; this.d = d;
    const pose = { sit: 'sit', sleep: 'loaf', lie: 'loaf', groom: 'groom', stretch: 'stretch', held: 'held', fall: 'leap',
      hop: 'leap', bark: 'sit', cheer: 'sit', greet: 'sit', crouch: 'crouch' }[mode] || 'stand';
    this.a.setPose(pose);
    this.ctx.zzz(mode === 'sleep');
  }
  get busy() { return ['walk', 'run', 'sniff', 'follow', 'visit', 'held', 'fall', 'hop'].includes(this.mode); }
  get still() { return ['idle', 'sit', 'sleep', 'lie', 'groom', 'cheer', 'greet', 'bark'].includes(this.mode); }
  faceUser() { this.yawTarget = FRONT + (Math.cos(this.yaw) >= 0 ? 1 : -1) * 0.5; }

  decide() {
    const awake = (Date.now() - this.awakeSince) / MIN, dog = this.dog;
    const opts = [['idle', 10], ['walk', 26], ['sit', 12], ['stretch', 4], ['visit', 8], ['follow', dog ? 7 : 3],
      ['groom', dog ? 0 : 8], ['sniff', dog ? 12 : 0], ['run', dog ? 5 : 2], ['bark', dog ? 4 : 2], ['lie', dog ? 5 : 0],
      ['sleep', awake > 7 ? 40 : awake > 3 ? 6 : 0]];
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [n, w] of opts) if ((r -= w) < 0) return this.start(n);
    this.start('idle');
  }
  start(n) {
    const c = this.ctx, [x0, x1] = c.bounds(), [z0, z1] = c.lane();
    switch (n) {
      case 'idle': this.go('idle', { dur: rand(2, 5) }); this.faceUser(); break;
      case 'walk': {
        let tx = rand(x0, x1);
        if (Math.abs(tx - this.x) < 100) tx = clamp(this.x + (Math.random() < 0.5 ? -1 : 1) * rand(150, 400), x0, x1);
        this.go('walk', { tx, tz: rand(z0, z1), speed: this.dog ? 70 : 55 });
        break;
      }
      case 'sniff': {
        // nose down, slowly following a trail
        const tx = clamp(this.x + (Math.random() < 0.5 ? -1 : 1) * rand(80, 220), x0, x1);
        this.go('sniff', { tx, tz: rand(z0, z1), speed: 30 });
        break;
      }
      case 'run': {
        // zoomies: a few fast laps
        this.go('run', { tx: this.x > 0 ? x0 + rand(0, 120) : x1 - rand(0, 120), tz: rand(z0, z1), laps: 2 + Math.floor(rand(0, 3)) });
        break;
      }
      case 'sit': this.go('sit', { dur: rand(6, 14) }); this.faceUser(); break;
      case 'lie': this.go('lie', { dur: rand(8, 20) }); this.faceUser(); break;
      case 'groom': this.go('groom', { dur: rand(4, 7) }); this.faceUser(); break;
      case 'stretch': this.go('stretch', { dur: 2.2, then: this.dog && Math.random() < 0.5 ? 'run' : null }); break;
      case 'bark': this.go('bark', { dur: rand(1.5, 2.5), n: this.dog ? 1 + Math.floor(rand(0, 3)) : 1, next: 0.2 }); this.faceUser(); break;
      case 'visit': {
        const list = c.others().filter(o => Math.abs(o.x - this.x) > 60);
        if (!list.length) return this.start('walk');
        list.sort((a, b) => Math.abs(a.x - this.x) - Math.abs(b.x - this.x));
        this.go('visit', { who: Math.random() < 0.6 ? list[0] : pick(list) });
        break;
      }
      case 'follow': {
        if (!c.cat().onFloor) return this.start('walk');
        this.go('follow', { dur: rand(8, 15) });
        break;
      }
      case 'sleep': this.go('sleep', { dur: rand(40, 140) }); this.faceUser(); break;
      default: this.go('idle', { dur: 2 });
    }
  }
  jump(v) { this.vy = v; this.y = Math.max(this.y, 0.01); }
  voice(times) { this.ctx.sound.voice(times); this.ctx.say(this.dog ? (this.a.spec.size < 0.8 ? '汪汪！' : '汪！') : '喵～', this.headWorld()); }

  // ---------- user ----------
  petted() {
    if (this.mode === 'sleep') { this.wake(); return; }
    if (['held', 'fall'].includes(this.mode)) return;
    this.happy = 1.6;
    this.ctx.hearts(this.headWorld());
    this.ctx.sound.happy();
    if (this.dog) { this.pant = 3; if (Math.random() < 0.5) { this.go('hop', { n: 2 }); this.faceUser(); this.jump(320); return; } }
    this.go('sit', { dur: rand(4, 7) }); this.faceUser();
  }
  wake() { this.awakeSince = Date.now(); this.go('stretch', { dur: 1.8 }); }
  grab() { this.go('held'); this.voice(1); }
  release(vx, vy) { this.vx = clamp(vx, -700, 700); this.vy = clamp(vy, -500, 700); this.go('fall'); }
  // somebody came over to say hello
  greet(fromX) {
    if (this.busy || this.mode === 'sleep') return;
    this.go(this.dog ? 'greet' : 'sit', { dur: rand(3, 5) });
    this.yawTarget = fromX > this.x ? -0.2 : Math.PI + 0.2;
    this.happy = 1.2;
    if (this.dog) this.pant = 2.5;
  }
  // the reminder: come over to the main cat, sit and look at the user
  cheer() {
    if (['held', 'fall'].includes(this.mode)) return;
    if (this.mode === 'sleep') this.awakeSince = Date.now();
    const c = this.ctx, cat = c.cat(), [x0, x1] = c.bounds();
    const tx = clamp(cat.x + (Math.random() < 0.5 ? -1 : 1) * rand(120, 260) * c.scale(), x0, x1);
    this.go('walk', { tx, tz: clamp(cat.z + rand(-4, 12), ...c.lane()), speed: this.dog ? 150 : 110,
      then: () => { this.go('cheer', { dur: 6 }); this.yawTarget = FRONT; if (this.dog) this.pant = 6; this.voice(1); } });
  }
  headWorld() { const v = this.a.neck.localToWorld(this.a.neck.position.clone().set(10, 30, 0)); return { x: v.x, y: v.y, z: v.z }; }

  // ---------- per frame ----------
  walkTo(dt, tx, tz, speed) {
    const dx = tx - this.x, dz = tz - this.z, dist = Math.hypot(dx, dz);
    if (dist < 3) return true;
    this.yawTarget = Math.atan2(-dz, dx);
    const ahead = Math.max(0, Math.cos(angleDiff(this.yawTarget, this.yaw)));
    const sc = this.ctx.scale(), step = Math.min(dist, speed * sc * dt * ahead);
    this.x += dx / dist * step; this.z += dz / dist * step;
    const g = this.a.gait, amp = speed > 150 ? 1 : 0.7;
    g.amp += (amp - g.amp) * Math.min(1, dt * 6);
    // short legs take quicker steps
    g.phase += step / (9 * sc * Math.max(0.5, this.a.legK)) + dt * (1 - ahead) * 5;
    return false;
  }
  physics(dt) {
    this.vy -= 1800 * dt;
    this.y += this.vy * dt; this.x += this.vx * dt;
    const [x0, x1] = this.ctx.bounds();
    if (this.x < x0) { this.x = x0; this.vx = Math.abs(this.vx) * 0.5; }
    if (this.x > x1) { this.x = x1; this.vx = -Math.abs(this.vx) * 0.5; }
    if (Math.abs(this.vx) > 40) this.yawTarget = this.vx > 0 ? 0 : Math.PI;
    if (this.y > 0 || this.vy > 0) return -1;
    const force = Math.min(1, -this.vy / 1300);
    this.y = 0; this.vy = 0; this.vx = 0;
    this.squash = 0.08 + force * 0.25;
    return force;
  }

  update(dt) {
    this.t += dt;
    const d = this.d, a = this.a, c = this.ctx;
    const moving = ['walk', 'run', 'sniff', 'follow', 'visit'].includes(this.mode);
    if (!moving) a.gait.amp *= Math.exp(-dt * 8);
    if (this.happy > 0) { this.happy -= dt; a.target.eyeOpen = this.happy > 0 ? 0.15 : a.baseTarget.eyeOpen; }
    // a happy (or puffed-out) dog pants with its tongue out and wags
    if (this.dog) {
      this.pant = Math.max(0, this.pant - dt);
      const wag = this.pant > 0 || this.happy > 0 || ['greet', 'cheer'].includes(this.mode);
      if (this.mode !== 'bark') a.target.mouth = this.pant > 0 ? 0.45 + Math.sin(this.t * 14) * 0.08 : a.baseTarget.mouth;
      if (wag) { a.target.tailSpeed = 14; a.target.tailAmp = 0.45; }
      else if (this.mode !== 'run') { a.target.tailSpeed = a.baseTarget.tailSpeed; a.target.tailAmp = a.baseTarget.tailAmp; }
    }
    let ey = 0, ep = 0;
    switch (this.mode) {
      case 'idle':
        if (this.t > this.nextLook) { this.nextLook = this.t + rand(1, 3); d.ly = rand(-0.6, 0.6); d.lp = rand(-0.15, 0.1); }
        ey = d.ly || 0; ep = d.lp || 0;
        if (this.t > d.dur) this.decide();
        break;
      case 'walk':
        if (this.walkTo(dt, d.tx, d.tz, d.speed)) { if (d.then) d.then(); else { this.go('idle', { dur: rand(1, 3) }); this.faceUser(); } }
        break;
      case 'sniff':
        a.target.headPitch = 0.55; a.target.pitch = -0.08;
        ey = Math.sin(this.t * 3) * 0.3;
        if (this.walkTo(dt, d.tx, d.tz, d.speed)) { this.go('idle', { dur: rand(1, 2) }); this.faceUser(); }
        break;
      case 'run':
        a.target.tailSpeed = 10; a.target.tailAmp = 0.4;
        if (this.walkTo(dt, d.tx, d.tz, 280)) {
          const [x0, x1] = c.bounds();
          if (--d.laps > 0) d.tx = d.tx < 0 ? x1 - rand(0, 120) : x0 + rand(0, 120);
          else { this.go('sit', { dur: rand(4, 7) }); this.faceUser(); if (this.dog) this.pant = 6; }
        }
        break;
      case 'follow': {
        const cat = c.cat(), [x0, x1] = c.bounds();
        if (!cat.onFloor || this.t > d.dur) { this.go('sit', { dur: rand(3, 6) }); this.faceUser(); break; }
        const side = this.x < cat.x ? -1 : 1, tx = clamp(cat.x + side * 120 * c.scale(), x0, x1);
        if (Math.abs(tx - this.x) > 25) this.walkTo(dt, tx, clamp(cat.z + 8, ...c.lane()), Math.abs(tx - this.x) > 220 ? 160 : 60);
        else { this.yawTarget = side < 0 ? 0 : Math.PI; a.gait.amp *= Math.exp(-dt * 8); }
        break;
      }
      case 'visit': {
        const o = d.who, [x0, x1] = c.bounds();
        if (!o || this.t > 15) { this.go('idle', { dur: 2 }); break; }
        const side = this.x < o.x ? -1 : 1, gap = (55 * (o.size || 1) + 45 * c.scale());
        if (!this.walkTo(dt, clamp(o.x + side * gap, x0, x1), clamp(o.z + 4, ...c.lane()), this.dog ? 80 : 60)) break;
        this.go(this.dog ? 'greet' : 'sit', { dur: rand(3, 6) });
        this.yawTarget = side < 0 ? -0.2 : Math.PI + 0.2;
        o.greet && o.greet(this.x);
        c.hearts(this.headWorld());
        if (Math.random() < 0.5) this.voice(1);
        if (this.dog) this.pant = 3;
        break;
      }
      case 'sit': case 'lie': case 'greet': case 'cheer':
        if (this.t > d.dur) this.decide();
        break;
      case 'groom':
        a.extraHead.pitch = Math.sin(this.t * 7) * 0.12;
        if (this.t > d.dur) this.decide();
        break;
      case 'stretch':
        if (this.t > d.dur) d.then ? this.start(d.then) : (this.go('idle', { dur: rand(1, 2) }), this.faceUser());
        break;
      case 'bark':
        if (this.t > d.next && d.n > 0) { d.n--; d.next = this.t + 0.45; this.voice(1); d.open = this.t; }
        a.target.mouth = d.open != null && this.t - d.open < 0.18 ? 0.8 : 0;
        if (this.t > d.dur) this.decide();
        break;
      case 'sleep':
        if (this.t > d.dur) this.wake();
        break;
      case 'hop':
        if (this.physics(dt) >= 0) {
          if (--d.n > 0) this.jump(300);
          else { this.go('sit', { dur: 3 }); this.faceUser(); }
        }
        break;
      case 'held':
        a.gait.phase += dt * 9; a.gait.amp = 0.35;
        this.yawTarget = FRONT;
        break;
      case 'fall': {
        const landed = this.physics(dt);
        if (landed < 0) break;
        this.go(landed > 0.45 ? 'sit' : 'idle', { dur: rand(2, 3) });
        this.faceUser();
        if (landed > 0.45) this.voice(1);
        break;
      }
    }
    if (this.mode !== 'groom') {
      const k = 1 - Math.exp(-dt * 5);
      a.extraHead.yaw += (ey - a.extraHead.yaw) * k;
      a.extraHead.pitch += (ep - a.extraHead.pitch) * k;
    }
    if (!['hop', 'fall', 'held'].includes(this.mode)) this.y = 0;
    this.squash *= Math.exp(-dt * 7);
    this.yaw += angleDiff(this.yawTarget, this.yaw) * (1 - Math.exp(-dt * 7));
  }
}
