// What a dog or cat friend (朋友) does. They share the cat's body and poses (cat.js) but have
// their own life: wander, sit, nap and stretch; cats groom and stalk birds; dogs sniff about,
// pant, bark, play-bow and do zoomies, chase the cats, bark at birds, push the plush toys around
// and sleep in the dog house. Everyone eats and drinks at the bowls, visits the others, cuddles
// up to whoever is asleep, gets jealous when someone else is petted, follows the main pet and
// comes over at reminders.
//
// ctx: { S(), scale(), bounds(), lane(), main(), others(), sound: { voice(n), happy() },
//   hearts(pos), say(text, pos), zzz(on), house(), slot(), freeSlot(), bowl(k), freeBowl(k),
//   bird(), toy(), petted(x), desk(), effect(kind, pos), office(), atBowl(k), cursorX() }
// toy(): the nearest free plush toy { id, x, z, w, poke(side), grab(), drag(pos), release(), carried() }
// office(): null at home; in office mode { sofa(), shelf(), printer(), desks(), greetWorker(k), release() }
// others(): [{ id, kind ('cat'|'dog'|'pig'|'main'), x, z, size, still, asleep, greet(x), flee(x), play(x) }]
import { Worker, fitSeat, catPoints } from './office.js';
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
    this.lastMeal = Date.now() - rand(0, 6) * MIN;
    this.slot = null; this.bowlK = null;
    this.breakUntil = Date.now() + rand(2, 12) * 1000; this.workUntil = 0;
    this.worker = new Worker(animal, kind => this.ctx.effect(kind, this.headWorld()));
  }

  go(mode, d = {}) {
    if (this.slot != null && mode !== 'sleep' && mode !== 'enter') { this.ctx.freeSlot(); this.slot = null; }
    // a bowl stays ours on the way there and while eating
    if (this.bowlK != null && mode !== 'eat' && !(mode === 'walk' && d.toBowl)) { this.ctx.freeBowl(this.bowlK); this.bowlK = null; }
    this.mode = mode; this.t = 0; this.d = d;
    const pose = { sit: 'sit', sleep: 'loaf', lie: 'loaf', groom: 'groom', stretch: 'stretch', held: 'held', fall: 'leap',
      hop: 'leap', jump: 'leap', bark: 'sit', cheer: 'sit', greet: 'sit', crouch: 'crouch', stalk: 'stand', bow: 'stretch',
      eat: 'crouch', enter: 'loaf', beg: 'sit', leap: 'leap', attend: 'sit', present: 'sit', fetch: 'stand', shake: 'stand',
      grabToy: 'crouch' }[mode] || 'stand';
    // dropping whatever toy it was carrying
    if (this.carrying && !['fetch', 'shake', 'grabToy'].includes(mode)) { this.carrying.release(); this.carrying = null; }
    // let go of a sofa seat or the shelf top (but not on the way up, or to the water cooler)
    if (!d.up && !d.toBowl && !['leap', 'work', 'eat'].includes(mode)) this.ctx.office()?.release();
    if (this.mode === 'work' && mode !== 'work') this.breakUntil = Date.now() + rand(1, 2.5) * MIN;
    this.a.setPose(pose);
    if (mode === 'work') this.worker.begin();
    this.ctx.zzz(mode === 'sleep');
  }
  // up on the sofa or the bookshelf
  get up() { return this.y > 1 && !!this.d.up; }
  get busy() { return this.up || ['walk', 'run', 'sniff', 'follow', 'visit', 'held', 'fall', 'hop', 'jump', 'chase', 'flee', 'stalk', 'toy', 'enter', 'leap', 'work',
    'line', 'fetch', 'shake', 'grabToy', 'pounce'].includes(this.mode); }
  get still() { return ['idle', 'sit', 'sleep', 'lie', 'groom', 'cheer', 'greet', 'bark', 'eat', 'beg'].includes(this.mode); }
  get working() { return this.mode === 'work' || (this.mode === 'leap' && this.d.toDesk); }
  get asleep() { return this.mode === 'sleep'; }
  faceUser() { this.yawTarget = FRONT + (Math.cos(this.yaw) >= 0 ? 1 : -1) * 0.5; }
  // how far its head reaches in front of its feet (to lie in the dog house doorway)
  reach() { const s = this.a.spec; return (20 * s.len + 10 + 30 * s.head) * this.ctx.scale(); }

  decide() {
    const c = this.ctx, awake = (Date.now() - this.awakeSince) / MIN, dog = this.dog;
    // up on the furniture: jump down first
    if (this.y > 1 && this.mode !== 'work') return this.hopDown(() => this.decide());
    // office mode: back to the desk after a break
    if (c.desk() && Date.now() > this.breakUntil) return this.start('work');
    const off = c.office();
    const hungry = c.house() && Date.now() - this.lastMeal > 4 * MIN;
    const others = c.others(), cats = others.filter(o => (o.kind === 'cat' || o.kind === 'main') && !o.asleep);
    const dogs = others.filter(o => o.kind === 'dog' && !o.asleep), bird = c.bird();
    const opts = [['idle', 10], ['walk', 24], ['sit', 12], ['stretch', 4], ['visit', 8], ['follow', dog ? 6 : 3],
      ['groom', dog ? 0 : 8], ['sniff', dog ? 11 : 0], ['run', dog ? 4 : 2], ['bark', dog ? 3 : 2], ['lie', dog ? 5 : 0],
      ['eat', hungry ? 14 : 0],
      ['chase', dog && cats.length ? 5 : 0], ['bow', dog && (dogs.length || others.some(o => o.kind === 'pig')) ? 5 : 0],
      ['stalk', !dog && bird ? 8 : 0], ['barkAt', dog && bird ? 6 : 0],
      // the plush toys: dogs nudge them, fetch them and give them a good shake; cats bat and pounce
      ['toy', c.toy() ? 7 : 0], ['fetch', dog && c.toy() ? 5 : 0],
      // cats groom each other
      ['groomBuddy', !dog && others.some(o => (o.kind === 'cat' || o.kind === 'main') && !o.asleep) ? 5 : 0],
      // office mode: a sit on the sofa, a cat up on the bookshelf, a look at the printer, a visit to a worker
      ['sofa', off ? 9 : 0], ['shelf', off && !dog ? 6 : 0], ['printer', off && off.printer() ? 3 : 0],
      ['visitDesk', off && off.desks().length ? 6 : 0],
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
      case 'run': this.zoom(2 + Math.floor(rand(0, 3))); break;
      case 'sit': this.go('sit', { dur: rand(6, 14) }); this.faceUser(); break;
      case 'lie': this.go('lie', { dur: rand(8, 20) }); this.faceUser(); break;
      case 'groom': this.go('groom', { dur: rand(4, 7) }); this.faceUser(); break;
      case 'stretch': this.go('stretch', { dur: 2.2, then: this.dog && Math.random() < 0.5 ? 'run' : null }); break;
      case 'bark': this.go('bark', { dur: rand(1.5, 2.5), n: this.dog ? 1 + Math.floor(rand(0, 3)) : 1, next: 0.2 }); this.faceUser(); break;
      case 'visit': {
        const list = c.others().filter(o => Math.abs(o.x - this.x) > 60 && !o.asleep);
        if (!list.length) return this.start('walk');
        list.sort((a, b) => Math.abs(a.x - this.x) - Math.abs(b.x - this.x));
        this.go('visit', { who: Math.random() < 0.6 ? list[0] : pick(list) });
        break;
      }
      case 'follow': {
        if (!c.main().onFloor) return this.start('walk');
        this.go('follow', { dur: rand(8, 15) });
        break;
      }
      case 'eat': {
        const k = Math.random() < 0.5 ? 0 : 1, b = c.bowl(k);
        if (!b) return this.start('idle');
        this.bowlK = k;
        const side = this.x < b.x ? -1 : 1;
        this.go('walk', { tx: b.x + side * 42 * c.scale(), tz: b.z, speed: this.dog ? 80 : 60, toBowl: true,
          then: () => { const kk = b.k ?? k; this.go('eat', { dur: rand(4, 7), k: kk }); this.yawTarget = b.yaw ?? (side < 0 ? 0 : Math.PI); c.atBowl?.(kk); } });
        break;
      }
      case 'chase': {
        // a dog chases a cat round the room; the cat runs off
        const cats = c.others().filter(o => (o.kind === 'cat' || o.kind === 'main') && !o.asleep && o.still);
        if (!cats.length) return this.start('walk');
        const o = pick(cats);
        this.go('chase', { who: o });
        this.voice(1);
        o.flee(this.x);
        break;
      }
      case 'bow': {
        // play bow to another dog (or the pig): bum up, tail going; then zoomies together
        const list = c.others().filter(o => (o.kind === 'dog' || o.kind === 'pig') && !o.asleep);
        if (!list.length) return this.start('walk');
        const o = pick(list), side = this.x < o.x ? -1 : 1;
        this.go('visit', { who: o, then: () => { this.go('bow', { dur: 1.4, who: o }); this.yawTarget = side < 0 ? 0 : Math.PI; o.play(this.x); } });
        break;
      }
      case 'stalk': {
        const b = c.bird();
        if (!b) return this.start('idle');
        this.go('stalk', { bird: b });
        break;
      }
      case 'barkAt': {
        const b = c.bird();
        if (!b) return this.start('idle');
        this.go('chase', { bird: b });
        break;
      }
      case 'toy': {
        const t = c.toy();
        if (!t) return this.start('idle');
        // a cat sometimes stalks it and pounces
        if (!this.dog && Math.random() < 0.4) { this.go('pounce', { toy: t }); break; }
        this.go('toy', { toy: t, pokes: 2 + Math.floor(rand(0, 4)) });
        break;
      }
      case 'fetch': {
        // pick a toy up in the mouth, trot off with it (sometimes to you), shake it, drop it
        const t = c.toy();
        if (!t) return this.start('idle');
        const side = this.x < t.x ? -1 : 1;
        this.go('walk', { tx: t.x - side * (t.w / 2 + 22 * c.scale()), tz: t.z, speed: 110,
          then: () => { this.yawTarget = side < 0 ? 0 : Math.PI; this.go('grabToy', { toy: t, side }); } });
        break;
      }
      case 'groomBuddy': {
        const list = c.others().filter(o => (o.kind === 'cat' || o.kind === 'main') && !o.asleep);
        if (!list.length) return this.start('idle');
        const o = pick(list);
        this.go('visit', { who: o, close: true, then: () => {
          const now = c.others().find(u => u.id === o.id);
          this.go('groom', { dur: rand(3, 5), buddy: true });
          if (now) { this.yawTarget = this.x < now.x ? -0.2 : Math.PI + 0.2; now.greet(this.x); }
          c.hearts(this.headWorld());
        } });
        break;
      }
      case 'sleep': this.sleep(); break;
      case 'sofa': this.upTo(c.office()?.sofa(), Math.random() < 0.3 ? 'sleep' : 'sit'); break;
      case 'shelf': this.upTo(c.office()?.shelf(), Math.random() < 0.4 ? 'sleep' : 'sit'); break;
      case 'printer': {
        const p = c.office()?.printer();
        if (!p) return this.start('idle');
        this.go('walk', { tx: p.x + rand(-20, 20), tz: p.z, speed: this.dog ? 90 : 65,
          then: () => { this.go('sit', { dur: rand(3, 6) }); this.yawTarget = p.yaw; if (this.dog && Math.random() < 0.5) this.voice(1); } });
        break;
      }
      case 'visitDesk': {
        // 探班: sit in front of a worker's desk and say hello
        const list = c.office()?.desks() || [];
        if (!list.length) return this.start('idle');
        const v = pick(list);
        this.go('walk', { tx: v.spot.x + rand(-25, 25), tz: v.spot.z, speed: this.dog ? 85 : 65,
          then: () => { this.go('sit', { dur: rand(4, 7) }); this.yawTarget = Math.PI / 2; c.office()?.greetWorker(v.k); c.hearts(this.headWorld()); if (this.dog) this.pant = 3; } });
        break;
      }
      case 'work': {
        // walk round to the side of the desk, then jump up onto the chair
        const desk = c.desk();
        if (!desk) return this.start('idle');
        const side = desk.sideSpot(), seat = desk.seatSpot();
        this.go('walk', { tx: side.x, tz: side.z, speed: this.dog ? 90 : 70,
          then: () => this.go('leap', { to: { x: seat.x, y: desk.top() * 0.6, z: seat.z }, toDesk: true,
            then: () => { this.workUntil = Date.now() + rand(4, 9) * MIN; this.go('work', { seat }); } }) });
        break;
      }
      default: this.go('idle', { dur: 2 });
    }
  }
  zoom(laps) {
    const [x0, x1] = this.ctx.bounds();
    this.go('run', { tx: this.x > 0 ? x0 + rand(0, 120) : x1 - rand(0, 120), tz: rand(...this.ctx.lane()), laps });
  }
  // up onto a seat or a shelf top (spot: { x, y, z, yaw, side }), then sit or sleep there
  upTo(spot, then) {
    if (!spot) return this.start('idle');
    this.go('walk', { tx: spot.side.x, tz: spot.side.z, speed: this.dog ? 85 : 65, up: true,
      then: () => this.go('leap', { to: { x: spot.x, y: spot.y, z: spot.z }, up: true,
        then: () => { this.go(then, { dur: then === 'sleep' ? rand(40, 120) : rand(6, 14), up: true }); this.yawTarget = spot.yaw; } }) });
  }
  hopDown(then) {
    const [x0, x1] = this.ctx.bounds();
    this.go('leap', { to: { x: clamp(this.x + rand(-60, 60), x0, x1), y: 0, z: rand(...this.ctx.lane()) }, then });
  }
  // a meeting at the whiteboard: sit in the audience, or present
  attend(spot) {
    if (['held', 'fall'].includes(this.mode)) return;
    if (this.mode === 'work') return this.leaveDesk(() => this.attend(spot));
    if (this.y > 1) return this.hopDown(() => this.attend(spot));
    this.go('walk', { tx: spot.x, tz: spot.z, speed: this.dog ? 110 : 90,
      then: () => { this.go('attend', { dur: 40 }); this.yawTarget = spot.yaw; } });
  }
  present(spot) {
    if (['held', 'fall'].includes(this.mode)) return;
    if (this.mode === 'work') return this.leaveDesk(() => this.present(spot));
    if (this.y > 1) return this.hopDown(() => this.present(spot));
    this.go('walk', { tx: spot.x, tz: spot.z, speed: this.dog ? 110 : 90,
      then: () => { this.go('present', { dur: 40 }); this.yawTarget = spot.yaw; } });
  }
  // the meeting is over: a clap (or a bow for the presenter), then carry on
  meetingOver() {
    if (this.mode === 'present') { this.go('stretch', { dur: 1.8 }); }
    else if (this.mode === 'attend') { this.ctx.effect('clap', this.headWorld()); this.happy = 1.2; this.go('sit', { dur: rand(2, 4) }); }
  }
  // dogs go home to the dog house; anyone may cuddle up next to someone already asleep
  sleep() {
    const c = this.ctx, house = c.house();
    // in the office, a nap on the sofa
    if (c.office() && Math.random() < 0.8) {
      const seat = c.office().sofa();
      if (seat) return this.upTo(seat, 'sleep');
    }
    if (this.dog && house) {
      const i = c.slot();
      if (i != null) {
        const sp = house.slot(i, this.reach());
        this.go('walk', { tx: sp.x, tz: sp.door ? house.front() + 40 * house.s : sp.z, speed: 70,
          then: () => { this.slot = i; this.go('enter', { sp }); } });
        this.slot = i;
        return;
      }
    }
    const buddy = c.others().find(o => o.asleep && o.kind !== 'main' && Math.abs(o.x - this.x) < 500);
    if (buddy && Math.random() < 0.6) {
      const side = this.x < buddy.x ? -1 : 1, [x0, x1] = c.bounds();
      // (or next to a plush toy, see below)
      this.go('walk', { tx: clamp(buddy.x + side * (40 + 45 * buddy.size), x0, x1), tz: clamp(buddy.z + 3, ...c.lane()), speed: 50,
        then: () => { this.go('sleep', { dur: rand(40, 140) }); this.yawTarget = side < 0 ? -0.3 : Math.PI + 0.3; } });
      return;
    }
    // curl up next to a plush toy
    const t = c.toy();
    if (t && Math.random() < 0.4) {
      const side = this.x < t.x ? -1 : 1;
      this.go('walk', { tx: t.x - side * (t.w / 2 + 12 * c.scale()), tz: t.z, speed: 50,
        then: () => { this.go('sleep', { dur: rand(40, 120) }); this.yawTarget = side < 0 ? -0.3 : Math.PI + 0.3; } });
      return;
    }
    this.go('sleep', { dur: rand(40, 140) }); this.faceUser();
  }
  // ---------- group events ----------
  // a parade: walk in line behind the leader (target() says where to be)
  joinLine(target) {
    if (['held', 'fall'].includes(this.mode)) return;
    if (this.mode === 'work') return this.leaveDesk(() => this.joinLine(target));
    if (this.y > 1) return this.hopDown(() => this.joinLine(target));
    this.go('line', { target, dur: 60 });
  }
  // lead the parade along the points, then done()
  lead(points, done) {
    if (this.mode === 'work') return this.leaveDesk(() => this.lead(points, done));
    if (this.y > 1) return this.hopDown(() => this.lead(points, done));
    const step = i => (i >= points.length ? done() : this.go('walk', { tx: points[i].x, tz: points[i].z, speed: 75, then: () => step(i + 1) }));
    step(0);
  }
  // a party: dogs zoom about, cats jump for joy
  party() {
    if (['held', 'fall'].includes(this.mode)) return;
    if (this.mode === 'work') return this.leaveDesk(() => this.party());
    if (this.y > 1) return this.hopDown(() => this.party());
    this.happy = 3;
    if (this.dog) { this.pant = 8; this.zoom(2); } else { this.go('hop', { n: 3 }); this.jump(330); }
  }
  // the parade or party is over
  eventOver() {
    if (this.mode === 'line') { this.go('sit', { dur: rand(3, 5) }); this.faceUser(); this.ctx.hearts(this.headWorld()); }
  }
  jump(v) { this.vy = v; this.y = Math.max(this.y, 0.01); }
  voice(times) {
    this.ctx.sound.voice(times);
    this.ctx.say(this.dog ? (this.a.spec.size < 0.8 ? '汪汪！' : '汪！') : this.a.isDragon ? '嗚～' : '喵～', this.headWorld());
  }

  // ---------- from the user and the others ----------
  petted() {
    if (this.mode === 'sleep') { this.wake(); return; }
    if (['held', 'fall', 'leap'].includes(this.mode)) return;
    // at work (or up on the furniture): a happy wriggle, but stays put
    if (this.mode === 'work' || this.up) { this.happy = 1.6; this.ctx.hearts(this.headWorld()); this.ctx.sound.happy(); this.ctx.petted(this.x); return; }
    this.happy = 1.6;
    this.ctx.hearts(this.headWorld());
    this.ctx.sound.happy();
    this.ctx.petted(this.x);
    if (this.dog) { this.pant = 3; if (Math.random() < 0.5) { this.go('hop', { n: 2 }); this.faceUser(); this.jump(320); return; } }
    this.go('sit', { dur: rand(4, 7) }); this.faceUser();
  }
  wake() { this.awakeSince = Date.now(); this.y = 0; this.go('stretch', { dur: 1.8 }); }
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
  // a dog is chasing it: run off to the far side (a cat might hiss first)
  flee(fromX) {
    if (this.busy && this.mode !== 'walk' || this.mode === 'sleep') return;
    const [x0, x1] = this.ctx.bounds();
    if (!this.dog && Math.random() < 0.5) this.ctx.say('嘶～', this.headWorld());
    this.go('flee', { tx: fromX < this.x ? x1 - rand(0, 100) : x0 + rand(0, 100), tz: rand(...this.ctx.lane()) });
  }
  // invited to play: bow back, then zoomies
  play(fromX) {
    if (this.busy || this.mode === 'sleep') return;
    this.go(this.dog ? 'bow' : 'sit', { dur: 1.4, then: 'run' });
    this.yawTarget = fromX > this.x ? 0 : Math.PI;
  }
  // someone else got petted nearby: come and ask for some too
  jealous(x) {
    if (this.busy || this.mode === 'sleep' || ['eat', 'cheer'].includes(this.mode)) return;
    const [x0, x1] = this.ctx.bounds(), side = this.x < x ? -1 : 1;
    this.go('walk', { tx: clamp(x + side * rand(90, 140) * this.ctx.scale(), x0, x1), tz: rand(...this.ctx.lane()), speed: this.dog ? 120 : 80,
      then: () => { this.go('beg', { dur: rand(3, 5) }); this.yawTarget = FRONT; this.ctx.say(pick(['我都要摸摸！', '仲有我呀～', '摸埋我啦 🥺']), this.headWorld()); if (this.dog) this.pant = 3; } });
  }
  // off the chair, down to the floor in front of the desk
  leaveDesk(then) {
    const desk = this.ctx.desk(), side = desk ? desk.sideSpot() : { x: this.x, z: 30 };
    this.breakUntil = Date.now() + rand(1, 2.5) * MIN;
    this.go('leap', { to: { x: side.x, y: 0, z: clamp(side.z + 70, ...this.ctx.lane()) }, then: then || (() => { this.go('stretch', { dur: 2 }); }) });
  }
  // the reminder: come over to the main pet, sit and look at the user
  cheer() {
    if (['held', 'fall'].includes(this.mode)) return;
    if (this.mode === 'work') return this.leaveDesk(() => this.cheer());
    if (this.y > 1) return this.hopDown(() => this.cheer());
    if (this.mode === 'sleep') this.awakeSince = Date.now();
    this.y = 0;
    const c = this.ctx, m = c.main(), [x0, x1] = c.bounds();
    const tx = clamp(m.x + (Math.random() < 0.5 ? -1 : 1) * rand(120, 260) * c.scale(), x0, x1);
    this.go('walk', { tx, tz: clamp(m.z + rand(-4, 12), ...c.lane()), speed: this.dog ? 150 : 110,
      then: () => { this.go('cheer', { dur: 6 }); this.yawTarget = FRONT; if (this.dog) this.pant = 6; this.voice(1); } });
  }
  mouthWorld() { const v = this.a.neck.localToWorld(this.a.neck.position.clone().set(this.dog ? 40 : 36, -4, 0)); return { x: v.x, y: v.y, z: v.z }; }
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
    const moving = ['walk', 'run', 'sniff', 'follow', 'visit', 'chase', 'flee', 'stalk', 'toy'].includes(this.mode);
    if (!moving) a.gait.amp *= Math.exp(-dt * 8);
    if (this.happy > 0) { this.happy -= dt; a.target.eyeOpen = this.happy > 0 ? 0.15 : a.baseTarget.eyeOpen; }
    // a happy (or puffed-out) dog pants with its tongue out and wags
    if (this.dog) {
      this.pant = Math.max(0, this.pant - dt);
      const wag = this.pant > 0 || this.happy > 0 || ['greet', 'cheer', 'bow', 'beg'].includes(this.mode);
      if (this.mode !== 'bark' && this.mode !== 'eat') a.target.mouth = this.pant > 0 ? 0.45 + Math.sin(this.t * 14) * 0.08 : a.baseTarget.mouth;
      if (wag) { a.target.tailSpeed = 14; a.target.tailAmp = 0.45; }
      else if (!['run', 'chase'].includes(this.mode)) { a.target.tailSpeed = a.baseTarget.tailSpeed; a.target.tailAmp = a.baseTarget.tailAmp; }
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
      case 'flee':
        if (this.walkTo(dt, d.tx, d.tz, 300) || this.t > 6) { this.go('sit', { dur: rand(3, 5) }); this.faceUser(); }
        break;
      case 'chase': {
        // after a cat (who runs off), or at a bird on the floor (which flies off)
        const tgt = d.who ? c.others().find(o => o.id === d.who.id) : d.bird && c.bird();
        if (d.bird && (!tgt || tgt.id !== d.bird.id)) { this.go('bark', { dur: 1.6, n: 2, next: 0 }); break; }
        if (!tgt || this.t > 7) { this.go('sit', { dur: rand(3, 5) }); this.faceUser(); this.pant = 5; break; }
        const side = this.x < tgt.x ? -1 : 1;
        if (this.walkTo(dt, tgt.x + side * 60 * c.scale(), clamp(tgt.z, ...c.lane()), d.bird ? 200 : 260) || Math.abs(tgt.x - this.x) < 90 * c.scale()) {
          if (d.bird) { tgt.flee(); this.go('bark', { dur: 1.6, n: 2, next: 0 }); this.yawTarget = side < 0 ? 0 : Math.PI; }
          else if (this.t > 2.5) { this.go('sit', { dur: rand(3, 5) }); this.faceUser(); this.pant = 5; }
        }
        break;
      }
      case 'stalk': {
        // a cat creeps up on a bird, wiggles, pounces; the bird always gets away
        const b = c.bird();
        if (!b || b.id !== d.bird.id || this.t > 14) { this.go('sit', { dur: 3 }); this.faceUser(); break; }
        const side = this.x < b.x ? -1 : 1;
        if (!d.crouch) {
          ey = 0; ep = 0.1;
          if (!this.walkTo(dt, b.x - side * 120 * c.scale(), clamp(b.z, ...c.lane()), 40)) break;
          d.crouch = true; d.t0 = this.t;
          a.setPose('crouch');
          this.yawTarget = side > 0 ? 0 : Math.PI;
        }
        a.figure.position.x = Math.sin(this.t * 30) * 1.5;
        if (this.t - d.t0 > 1.1) {
          a.figure.position.x = 0;
          b.flee();
          this.vx = (b.x - this.x) / (2 * 470 / 1800); this.vy = 470;
          this.go('jump');
        }
        break;
      }
      case 'jump': {
        const landed = this.physics(dt);
        if (landed < 0) break;
        this.go('sit', { dur: rand(3, 5) }); this.faceUser();
        if (Math.random() < 0.5) this.ctx.say(pick(['飛咗喇…', '下次啦 😼']), this.headWorld());
        break;
      }
      case 'toy': {
        // nudge a plush toy along with the nose and paws
        const t = c.toy();
        if (!t || t.id !== d.toy.id || this.t > 15) { this.go('sit', { dur: 3 }); this.faceUser(); break; }
        const side = this.x < t.x ? -1 : 1;
        if (!this.walkTo(dt, t.x - side * (t.w / 2 + 30 * c.scale()), clamp(t.z, ...c.lane()), 90)) break;
        this.yawTarget = side > 0 ? 0 : Math.PI;
        d.next = d.next ?? this.t + 0.4;
        if (this.t > d.next) {
          if (d.pokes-- <= 0) { this.go('sit', { dur: 3 }); this.faceUser(); this.pant = 3; break; }
          d.next = this.t + rand(0.7, 1.2);
          t.poke(side);
          a.swat = 0.01;
          setTimeout(() => { a.swat = 0; }, 300);
          if (Math.random() < 0.3) this.voice(1);
        }
        if (a.swat > 0) a.swat += dt;
        break;
      }
      case 'follow': {
        const m = c.main(), [x0, x1] = c.bounds();
        if (!m.onFloor || this.t > d.dur) { this.go('sit', { dur: rand(3, 6) }); this.faceUser(); break; }
        const side = this.x < m.x ? -1 : 1, tx = clamp(m.x + side * 120 * c.scale(), x0, x1);
        if (Math.abs(tx - this.x) > 25) this.walkTo(dt, tx, clamp(m.z + 8, ...c.lane()), Math.abs(tx - this.x) > 220 ? 160 : 60);
        else { this.yawTarget = side < 0 ? 0 : Math.PI; a.gait.amp *= Math.exp(-dt * 8); }
        break;
      }
      case 'visit': {
        const o = d.who, [x0, x1] = c.bounds();
        const now = o && c.others().find(u => u.id === o.id);
        if (!now || this.t > 15) { this.go('idle', { dur: 2 }); break; }
        const side = this.x < now.x ? -1 : 1, gap = (55 * (now.size || 1) + 45 * c.scale()) * (d.close ? 0.65 : 1);
        if (!this.walkTo(dt, clamp(now.x + side * gap, x0, x1), clamp(now.z + 4, ...c.lane()), this.dog ? 80 : 60)) break;
        if (d.then) { d.then(); break; }
        this.go(this.dog ? 'greet' : 'sit', { dur: rand(3, 6) });
        this.yawTarget = side < 0 ? -0.2 : Math.PI + 0.2;
        now.greet(this.x);
        c.hearts(this.headWorld());
        if (Math.random() < 0.5) this.voice(1);
        if (this.dog) this.pant = 3;
        break;
      }
      case 'bow':
        a.target.tailSpeed = 16; a.target.tailAmp = 0.5;
        if (this.t > 0.5 && !d.barked) { d.barked = true; if (this.dog) this.voice(1); }
        if (this.t > d.dur) this.zoom(2);
        break;
      case 'eat':
        // head down in the bowl, bobbing
        a.target.headPitch = 0.75 + Math.sin(this.t * (d.k ? 9 : 6)) * 0.12;
        if (this.t > (d.say ?? 0.6)) { d.say = this.t + 1.6; c.say(d.k ? '咕嚕咕嚕' : '嚼嚼', this.headWorld()); }
        if (this.t > d.dur) { this.lastMeal = Date.now(); this.go('sit', { dur: rand(3, 6) }); this.faceUser(); if (!this.dog) a.setPose('groom'); }
        break;
      case 'enter': {
        // back into the dog house doorway (or settle on the mat), then sleep
        const sp = d.sp, k = clamp(this.t / 0.8, 0, 1);
        if (d.from == null) d.from = { x: this.x, z: this.z };
        this.x = d.from.x + (sp.x - d.from.x) * k; this.z = d.from.z + (sp.z - d.from.z) * k;
        this.yawTarget = sp.yaw;
        if (k >= 1) { const s = this.slot; this.go('sleep', { dur: rand(60, 160), kennel: true }); this.slot = s; this.yaw = sp.yaw; }
        break;
      }
      case 'leap': {
        // a hop along an arc (onto the office chair, or down from it)
        if (!d.from) { d.from = { x: this.x, y: this.y, z: this.z }; d.T = 0.5 + Math.abs(d.to.y - d.from.y) / 900; }
        const k = clamp(this.t / d.T, 0, 1);
        this.x = d.from.x + (d.to.x - d.from.x) * k; this.z = d.from.z + (d.to.z - d.from.z) * k;
        this.y = d.from.y + (d.to.y - d.from.y) * k + (40 + Math.abs(d.to.y - d.from.y) * 0.3) * c.scale() * 4 * k * (1 - k);
        if (Math.abs(d.to.x - d.from.x) > 4) this.yawTarget = d.to.x > d.from.x ? 0 : Math.PI;
        if (k >= 1) { this.squash = 0.12; d.then ? d.then() : this.decide(); }
        break;
      }
      case 'work': {
        // at the desk: typing away; then a break
        const desk = c.desk();
        if (!desk) { this.leaveDesk(); break; }
        this.worker.update(dt);
        this.yawTarget = desk.seatSpot().yaw;
        const pts = catPoints(a);
        fitSeat(this, pts.paws, pts.eye, desk, 1 - Math.exp(-dt * 6));
        desk.setSeat(this.y);
        c.zzz(this.worker.dozing);
        if (Date.now() > this.workUntil) { c.zzz(false); this.leaveDesk(); }
        break;
      }
      case 'line': {
        const p = d.target();
        if (!p || this.t > d.dur) { this.go('sit', { dur: 3 }); this.faceUser(); break; }
        const dist = Math.hypot(p.x - this.x, p.z - this.z);
        if (dist > 14) this.walkTo(dt, p.x, p.z, dist > 80 ? 170 : 78);
        if (this.t > (d.note ?? 1)) { d.note = this.t + rand(2, 4); c.effect('note', this.headWorld()); }
        break;
      }
      case 'pounce': {
        // creep up on a toy, wiggle, leap onto it
        const t = c.toy();
        if (!t || t.id !== d.toy.id || this.t > 12) { this.go('sit', { dur: 3 }); this.faceUser(); break; }
        const side = this.x < t.x ? -1 : 1;
        if (!d.crouch) {
          if (!this.walkTo(dt, t.x - side * (t.w / 2 + 110 * c.scale()), t.z, 45)) break;
          d.crouch = true; d.t0 = this.t; a.setPose('crouch'); this.yawTarget = side > 0 ? 0 : Math.PI;
        }
        a.figure.position.x = Math.sin(this.t * 30) * 1.5;
        if (this.t - d.t0 > 1.1) {
          a.figure.position.x = 0;
          this.vx = (t.x - this.x) / (2 * 470 / 1800); this.vy = 470;
          setTimeout(() => t.poke(0), 450);
          this.go('jump');
        }
        break;
      }
      case 'grabToy': {
        // bite the near edge, then carry it off
        const t = d.toy;
        if (this.t > 0.4 && !d.sent) { d.sent = true; t.grab(d.side); }
        if (this.t > 0.9) {
          if (!t.carried()) { this.go('sit', { dur: 3 }); this.faceUser(); break; }
          this.carrying = t;
          const [x0, x1] = c.bounds(), toYou = Math.random() < 0.4 && c.cursorX() != null;
          const tx = toYou ? clamp(c.cursorX(), x0, x1) : clamp(this.x + (Math.random() < 0.5 ? -1 : 1) * rand(200, 420), x0, x1);
          const keep = t;
          this.go('fetch', { tx, gift: toYou });
          this.carrying = keep;
        }
        break;
      }
      case 'fetch': {
        const t = this.carrying;
        if (!t || !t.carried()) { this.carrying = null; this.go('sit', { dur: 3 }); this.faceUser(); break; }
        t.drag(this.mouthWorld());
        if (this.walkTo(dt, d.tx, this.z, 45 / Math.max(1, this.ctx.scale())) || this.t > 18) {
          if (d.gift) { this.yawTarget = FRONT; c.say('拎嚟俾你 🎁', this.headWorld()); this.pant = 4; }
          const keep = this.carrying;
          this.go('shake', { dur: d.gift ? 0.6 : rand(1, 1.6) });
          this.carrying = keep;
        }
        break;
      }
      case 'shake': {
        // a good shake, then let go
        const t = this.carrying;
        if (!t || !t.carried()) { this.carrying = null; this.go('sit', { dur: 3 }); break; }
        a.extraHead.yaw = Math.sin(this.t * 22) * 0.6;
        t.drag(this.mouthWorld());
        if (this.t > d.dur) { this.go('sit', { dur: rand(3, 5) }); this.faceUser(); this.pant = 4; }
        break;
      }
      case 'attend':
        // listening: a nod now and then
        a.target.headPitch = Math.sin(this.t * 1.3) > 0.85 ? 0.3 : 0;
        if (this.t > d.dur) this.decide();
        break;
      case 'present':
        // pointing at the board with a paw, talking
        a.target.legs = [0, 2.3 + Math.sin(this.t * 3) * 0.2, -1.2, -1.2];
        a.target.mouth = Math.sin(this.t * 11) > 0.3 ? 0.4 : 0;
        if (this.t > (d.say ?? 1)) { d.say = this.t + rand(1.8, 3); c.effect(pick(['talk', 'talk', 'idea']), this.headWorld()); }
        if (this.t > d.dur) this.decide();
        break;
      case 'sit': case 'lie': case 'greet': case 'cheer': case 'beg':
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
    if (!['groom', 'eat', 'work', 'shake'].includes(this.mode)) {
      const k = 1 - Math.exp(-dt * 5);
      a.extraHead.yaw += (ey - a.extraHead.yaw) * k;
      a.extraHead.pitch += (ep - a.extraHead.pitch) * k;
    }
    if (!['hop', 'fall', 'held', 'jump', 'leap', 'work'].includes(this.mode) && !d.up) this.y = 0;
    this.squash *= Math.exp(-dt * 7);
    this.yaw += angleDiff(this.yawTarget, this.yaw) * (1 - Math.exp(-dt * 7));
  }
}
