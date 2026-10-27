// =====================================================================================================
// Cozy Bear rig engine. The character drawing is untouched; this script only moves its named groups.
//  - time-based: the same speed at 60, 120 or 144 Hz, and a hiccup never makes him jump
//  - every mode is a pose function; switching modes cross-fades the poses with an eased weight,
//    so arms travel, props grow in and out, and fast rhythms (typing, waving) stay crisp
//  - an autopilot ("Auto") picks what he does next, with small idle fidgets in between
// =====================================================================================================
const $ = (id) => document.getElementById(id);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const rand = (a, b) => a + Math.random() * (b - a);
const weighted = (pairs) => { let s = 0; for (const [, w] of pairs) s += w; let r = Math.random() * s; for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; } return pairs[0][0]; };
const store = {
  get(k, d) { try { const v = localStorage.getItem("cozybear." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("cozybear." + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
// front ends (the studio page, the desktop pet) plug in here
const hooks = { onChange() {} };

// ---------- sound: synthesised, no files ----------
class CozyAudioEngine {
  constructor() { this.ctx = null; this.enabled = true; }
  init() {
    if (!this.ctx) { const A = window.AudioContext || window.webkitAudioContext; if (A) this.ctx = new A(); }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    return !!this.ctx;
  }
  tone(type, freq, gain, dur, at = 0, glide) {
    if (!this.enabled || !this.init()) return;
    const now = this.ctx.currentTime + at, osc = this.ctx.createOscillator(), g = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, now);
    if (glide) glide(osc.frequency, now);
    g.gain.setValueAtTime(gain, now); g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    osc.connect(g); g.connect(this.ctx.destination); osc.start(now); osc.stop(now + dur + 0.01);
  }
  playPop(f = 520) { this.tone("sine", f, 0.14, 0.1, 0, (p, n) => p.exponentialRampToValueAtTime(f * 1.6, n + 0.09)); }
  playBoing() { this.tone("triangle", 280, 0.15, 0.24, 0, (p, n) => { p.exponentialRampToValueAtTime(480, n + 0.08); p.exponentialRampToValueAtTime(340, n + 0.22); }); }
  playSparkle() { [880, 1174.66, 1396.91, 1760].forEach((n, i) => this.tone("sine", n, 0.08, 0.18, i * 0.045)); }
  playChord(freqs) { freqs.forEach((f) => this.tone("triangle", f, 0.035, 1.4)); }
  playChime() { this.tone("sine", 1318.5, 0.09, 0.9); this.tone("sine", 987.8, 0.09, 1.2, 0.32); }
}
const sound = new CozyAudioEngine();

// ---------- the rig's parts ----------
const rig = {
  svg: $("character-svg"), shadow: $("rig-shadow"), root: $("rig-root"), tail: $("rig-tail"),
  bellyContent: $("rig-belly-content"), zipper: $("rig-zipper"), bellyBear: $("rig-belly-bear"),
  bellyEyesOpen: $("belly-eyes-open"), bellyEyesWink: $("belly-eyes-wink"),
  legLeft: $("rig-leg-left"), footLeft: $("rig-foot-left"), legRight: $("rig-leg-right"), footRight: $("rig-foot-right"),
  sleeveLeftFill: $("sleeve-left-fill"), sleeveLeftOuter: $("sleeve-left-outer"), sleeveLeftInner: $("sleeve-left-inner"), sleeveLeftCrease: $("sleeve-left-crease"),
  pawLeft: $("rig-paw-left"),
  sleeveRightFill: $("sleeve-right-fill"), sleeveRightShadow: $("sleeve-right-shadow"), sleeveRightUpper: $("sleeve-right-upper"), sleeveRightLower: $("sleeve-right-lower"), sleeveRightCrease: $("sleeve-right-crease"),
  pawRight: $("rig-paw-right"), head: $("rig-head"), earLeft: $("rig-ear-left"), earRight: $("rig-ear-right"),
  eyes: $("rig-eyes"), eyesOpen: $("eyes-open"), eyesClosed: $("eyes-closed"), eyesHappy: $("eyes-happy"),
  faceBlush: $("face-blush"), glasses: $("rig-glasses"), glassesShine: $("glasses-shine"),
  propLaptop: $("prop-laptop"), propMug: $("prop-mug"), propHeadphones: $("prop-headphones"), particles: $("particles-layer"),
};
const showEl = (el, on) => el.classList.toggle("hidden", !on);

// The laptop sits on his lap facing him: we see the back of the lid, and his paws type behind it.
// It is drawn above both arms (the sheet's own laptop sits under them, beside him, so it stays hidden).
const lapBack = document.createElementNS("http://www.w3.org/2000/svg", "g");
lapBack.id = "prop-laptop-back";
lapBack.setAttribute("class", "hidden");
lapBack.innerHTML = `
  <ellipse cx="266" cy="420" rx="84" ry="10" fill="#bae6fd" opacity="0.55"/>
  <path d="M 184 424 C 184 418, 188 414, 194 414 L 338 414 C 344 414, 348 418, 348 424 L 358 516 L 174 516 Z"
        fill="#d4d4d8" stroke="#141210" stroke-width="5.5" stroke-linejoin="round"/>
  <path d="M 196 426 L 260 426" fill="none" stroke="#f4f4f5" stroke-width="5" stroke-linecap="round"/>
  <path d="M 340 432 L 348 512 L 334 512 Z" fill="#a1a1aa" opacity="0.55"/>
  <path d="M 162 514 L 370 514 L 376 530 C 376 534, 372 536, 368 536 L 164 536 C 160 536, 156 534, 156 530 Z"
        fill="#a1a1aa" stroke="#141210" stroke-width="5" stroke-linejoin="round"/>
  <g transform="translate(266, 466)">
    <circle cx="-11" cy="-11" r="6" fill="#ffffff" stroke="#141210" stroke-width="3.4"/>
    <circle cx="11" cy="-11" r="6" fill="#ffffff" stroke="#141210" stroke-width="3.4"/>
    <circle cx="0" cy="3" r="14" fill="#ffffff" stroke="#141210" stroke-width="3.6"/>
    <circle cx="-5" cy="0" r="1.8" fill="#141210"/><circle cx="5" cy="0" r="1.8" fill="#141210"/>
    <ellipse cx="0" cy="6" rx="3" ry="2.2" fill="#141210"/>
  </g>
  <g id="lap-tap-l" fill="none" stroke="#141210" stroke-width="3.6" stroke-linecap="round"><path d="M 214 404 l -6 -12 M 228 400 l 0 -13 M 200 410 l -12 -6"/></g>
  <g id="lap-tap-r" fill="none" stroke="#141210" stroke-width="3.6" stroke-linecap="round"><path d="M 300 402 l 4 -12 M 314 406 l 10 -9 M 286 400 l 0 -13"/></g>`;
rig.particles.before(lapBack);
const lapTapL = lapBack.querySelector("#lap-tap-l"), lapTapR = lapBack.querySelector("#lap-tap-r");

// A little alarm clock showing the current time. One copy he holds up in front of him (in front of his arms,
// his paws holding it from underneath), and a small one that can sit on the floor beside him all the time.
const CLOCK_ART = `
  <g fill="#f4be96" stroke="#141210" stroke-width="5">
    <circle cx="232" cy="364" r="17"/><circle cx="368" cy="364" r="17"/>
  </g>
  <path d="M 300 368 L 300 352 M 286 350 L 314 350" fill="none" stroke="#141210" stroke-width="5" stroke-linecap="round"/>
  <path d="M 236 466 L 226 482 M 364 466 L 374 482" fill="none" stroke="#141210" stroke-width="6" stroke-linecap="round"/>
  <rect x="212" y="368" width="176" height="100" rx="26" fill="#e07a5f" stroke="#141210" stroke-width="6"/>
  <path d="M 222 392 C 222 380, 230 376, 240 376" fill="none" stroke="#f2a48f" stroke-width="5" stroke-linecap="round"/>
  <rect x="228" y="386" width="144" height="66" rx="12" fill="#fbfaf6" stroke="#141210" stroke-width="4.5"/>
  <text class="clock-time" x="300" y="436" text-anchor="middle" font-family="Fredoka, 'Segoe UI', Arial, sans-serif" font-weight="700" font-size="46" fill="#141210" letter-spacing="1">00:00</text>`;
function makeClock(id) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.id = id; g.setAttribute("class", "hidden"); g.innerHTML = CLOCK_ART;
  return g;
}
const heldClock = makeClock("prop-clock-held");
rig.particles.before(heldClock);                          // in front of his arms, so nothing crosses the time
const deskClock = makeClock("prop-clock-desk");
rig.root.before(deskClock);                               // on the floor, outside the rig so it does not squash with him
const clockTexts = [heldClock, deskClock].map((g) => g.querySelector(".clock-time"));
let shownTime = "";
function clockText(now) {
  return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
}

// the sleeves are re-skinned every frame from the paw offsets (same geometry as the character sheet)
function updateLeftSleeveGeometry(lx, ly) {
  const wx1 = (166 + lx * 0.85).toFixed(1), wy1 = (472 + ly * 0.85).toFixed(1), wx2 = (230 + lx * 0.9).toFixed(1), wy2 = (478 + ly * 0.9).toFixed(1);
  const c1x = (198 + lx * 0.3).toFixed(1), c1y = (328 + ly * 0.3).toFixed(1), c2x = (174 + lx * 0.65).toFixed(1), c2y = (390 + ly * 0.65).toFixed(1);
  const ic1x = (240 + lx * 0.35).toFixed(1), ic1y = (404 + ly * 0.35).toFixed(1), ic2x = (236 + lx * 0.7).toFixed(1), ic2y = (442 + ly * 0.7).toFixed(1);
  rig.sleeveLeftFill.setAttribute("d", `M 238 298 C ${c1x} ${c1y}, ${c2x} ${c2y}, ${wx1} ${wy1} L ${wx2} ${wy2} C ${ic2x} ${ic2y}, ${ic1x} ${ic1y}, 242 362 Z`);
  rig.sleeveLeftOuter.setAttribute("d", `M 238 298 C ${c1x} ${c1y}, ${c2x} ${c2y}, ${wx1} ${wy1}`);
  rig.sleeveLeftInner.setAttribute("d", `M 242 362 C ${ic1x} ${ic1y}, ${ic2x} ${ic2y}, ${wx2} ${wy2}`);
  rig.sleeveLeftCrease.setAttribute("d", `M ${(214 + lx * 0.7).toFixed(1)} ${(426 + ly * 0.7).toFixed(1)} Q ${(225 + lx * 0.75).toFixed(1)} ${(430 + ly * 0.75).toFixed(1)} ${(235 + lx * 0.8).toFixed(1)} ${(436 + ly * 0.8).toFixed(1)}`);
}
function updateRightSleeveGeometry(rx, ry) {
  const lift = clamp(-ry / 220, 0, 1), px = 318 + rx, py = 496 + ry;
  const sx1 = 386 - lift * 6, sy1 = 362 - lift * 16, sx2 = 432 + lift * 10, sy2 = 414 - lift * 26;
  const ux = px + (-6 * (1 - lift) + -22 * lift), uy = py + (-28 * (1 - lift) + 8 * lift);
  const lx = px + (30 * (1 - lift) + 22 * lift), ly = py + (14 * (1 - lift) + 18 * lift);
  const uc1x = sx1 + (ux - sx1) * 0.35 + lift * 6, uc1y = sy1 + (uy - sy1) * 0.35 + (1 - lift) * 6;
  const uc2x = sx1 + (ux - sx1) * 0.7 + lift * 4, uc2y = sy1 + (uy - sy1) * 0.7 + (1 - lift) * 4;
  const lc1x = sx2 + (lx - sx2) * 0.35 + 18, lc1y = sy2 + (ly - sy2) * 0.35 + (1 - lift) * 16 + lift * 6;
  const lc2x = sx2 + (lx - sx2) * 0.7 + (1 - lift) * 14 + lift * 12, lc2y = sy2 + (ly - sy2) * 0.7 + (1 - lift) * 12 + lift * 4;
  const f = (v) => v.toFixed(1);
  rig.sleeveRightFill.setAttribute("d", `M ${f(sx1)} ${f(sy1)} C ${f(uc1x)} ${f(uc1y)}, ${f(uc2x)} ${f(uc2y)}, ${f(ux)} ${f(uy)} L ${f(lx)} ${f(ly)} C ${f(lc2x)} ${f(lc2y)}, ${f(lc1x)} ${f(lc1y)}, ${f(sx2)} ${f(sy2)} L 414 364 Z`);
  rig.sleeveRightShadow.setAttribute("d", `M ${f(lx - 6)} ${f(ly - 14)} C ${f(lc2x - 8)} ${f(lc2y - 10)}, ${f(lc1x - 8)} ${f(lc1y - 8)}, ${f(sx2 - 8)} ${f(sy2 + 2)} L ${f(sx2)} ${f(sy2)} C ${f(lc1x)} ${f(lc1y)}, ${f(lc2x)} ${f(lc2y)}, ${f(lx)} ${f(ly)} Z`);
  rig.sleeveRightUpper.setAttribute("d", `M ${f(sx1)} ${f(sy1)} C ${f(uc1x)} ${f(uc1y)}, ${f(uc2x)} ${f(uc2y)}, ${f(ux)} ${f(uy)}`);
  rig.sleeveRightLower.setAttribute("d", `M ${f(sx2)} ${f(sy2)} C ${f(lc1x)} ${f(lc1y)}, ${f(lc2x)} ${f(lc2y)}, ${f(lx)} ${f(ly)}`);
  const crX1 = sx1 + (ux - sx1) * 0.45 + 6, crY1 = sy1 + (uy - sy1) * 0.45 + 18 * (1 - lift);
  rig.sleeveRightCrease.setAttribute("d", `M ${f(crX1)} ${f(crY1)} Q ${f(crX1 + 14)} ${f(crY1 - 2)} ${f(crX1 + 24)} ${f(crY1 + 4)}`);
}

// ---------- poses ----------
const REST = { rootY: 0, rootScaleX: 1, rootScaleY: 1, bellyY: 0, headX: 0, headY: 0, headRot: 0, earLRot: 0, earRRot: 0,
  pawLX: 0, pawLY: 0, pawLRot: 0, pawRX: 0, pawRY: 0, pawRRot: 0, mugRot: -6, footLRot: 0, footRRot: 0, tailRot: 0 };
const KEYS = Object.keys(REST);

// each mode: a pose for time t (b = bounce intensity), its mouth, blush and label, and what it gives off
const MODES = {
  idle: {
    label: "Idle & Chilling", mouth: "deadpan", blush: 0,
    pose(o, t, b) {
      const breath = Math.sin(t * 2.0), late = Math.sin(t * 2.0 - 0.45);
      o.rootScaleX = 1 - breath * 0.006 * b; o.rootScaleY = 1 + breath * 0.01 * b; o.bellyY = -breath * 2.2 * b;
      o.headY = -late * 2.6 * b; o.headRot = Math.sin(t * 1.0) * 1.2 * b;
      o.earLRot = -late * 2.2 * b; o.earRRot = late * 2.2 * b;
      o.pawLY = -breath * 1.2 * b; o.pawRY = -breath * 1.2 * b; o.footRRot = Math.sin(t * 1.5) * 1.8 * b;
    },
  },
  wave: {
    label: "Waving Hello! 👋", mouth: "smile", blush: 0.8,
    pose(o, t, b) {
      const sway = Math.sin(t * 3.6), wave = Math.sin(t * 7.6), bob = (1 - Math.cos(t * 7.6)) * 0.5;
      o.rootScaleX = 1 + bob * 0.009 * b; o.rootScaleY = 1 - bob * 0.009 * b; o.bellyY = -bob * 2.2 * b;
      o.headX = sway * 2.5 * b; o.headY = -bob * 3.2 * b; o.headRot = -2.0 + sway * 3.0 * b;
      o.pawRX = 88 + wave * 22 * b; o.pawRY = -258 + Math.abs(wave) * 7 * b; o.pawRRot = 128 + wave * 22 * b;   // paw up beside the hood
      o.earLRot = sway * 5.0 * b; o.earRRot = sway * 5.0 * b; o.tailRot = wave * 11 * b;
    },
    emit(dt, pose) { if (Math.random() < 2.4 * dt) spawnParticle("sparkle", 410 + (pose.pawRX - 88), 195); },
  },
  cocoa: {
    label: "Sipping Warm Cocoa ☕", mouth: "cat", blush: 1,
    pose(o, t, b) {
      const raw = clamp((Math.sin(t * 1.6) + 0.25) / 1.25, 0, 1), sip = raw * raw * (3 - 2 * raw);   // 0 at the chest .. 1 at his mouth
      const breath = Math.sin(t * 2.0);
      o.bellyY = -breath * 1.8 * b; o.headY = sip * 5.5 * b - breath * 1.5; o.headRot = -sip * 5.0 * b;
      o.pawRX = -18 - sip * 6 * b; o.pawRY = -68 - sip * 124 * b; o.pawRRot = 36 + sip * 38 * b;
      o.mugRot = -o.pawRRot - 4 - sip * 16;                                                  // keeps the mug upright
      o.earLRot = -sip * 3.5 * b; o.earRRot = sip * 3.5 * b; o.footRRot = Math.sin(t * 2.8) * 3.0 * b; o.tailRot = Math.sin(t * 3.2) * 6 * b;
      o.sip = sip;
    },
    every: 0.55, emit(dt, pose) { spawnParticle("steam", 318 + pose.pawRX - 22, 496 + pose.pawRY - 44); },
  },
  vibe: {
    label: "Vibing to Lo-Fi Beats 🎧", mouth: "deadpan", blush: 0,
    pose(o, t, b) {
      const tempo = t * 5.6, groove = (1 - Math.cos(tempo)) * 0.5, headGroove = (1 - Math.cos(tempo - 0.55)) * 0.5;
      const earGroove = (1 - Math.cos(tempo - 1.1)) * 0.5, side = Math.sin(tempo * 0.5);
      o.rootScaleX = 1 + groove * 0.014 * b; o.rootScaleY = 1 - groove * 0.014 * b; o.bellyY = groove * 3.0 * b;
      o.headX = side * 3.5 * b; o.headY = headGroove * 7.5 * b; o.headRot = -headGroove * 5.5 * b + side * 2.5 * b;
      o.earLRot = -earGroove * 7.5 * b; o.earRRot = earGroove * 7.5 * b; o.pawLY = groove * 3.5 * b; o.pawRY = groove * 3.5 * b;
      o.footRRot = -groove * 9.5 * b; o.footLRot = (1 - groove) * 5.0 * b; o.tailRot = side * 12 * b;
    },
    every: 0.65,
    emit() {
      spawnParticle("note", 195 + Math.random() * 210, 160);
      if (Math.random() < 0.45) { sound.playChord(CHORDS[state.chordStep % CHORDS.length]); state.chordStep++; }
    },
  },
  sleep: {
    label: "Dozing Off... Zzz 💤", mouth: "o", blush: 0.4,
    pose(o, t, b) {
      const slow = Math.sin(t * 1.25), nod = (1 - Math.cos(t * 0.85)) * 0.5;
      o.rootScaleX = 1 - slow * 0.008 * b; o.rootScaleY = 1 + slow * 0.012 * b; o.bellyY = -slow * 2.5 * b;
      o.headX = -2.5 * b; o.headY = (5.0 + nod * 6.5 - slow * 1.8) * b; o.headRot = (-4.5 - nod * 4.5) * b;
      o.earLRot = (-3 - nod * 4) * b; o.earRRot = (2 + nod * 3) * b; o.pawLY = 3; o.pawRY = 3; o.tailRot = Math.sin(t * 0.8) * 1.5;
    },
    every: 1.25, emit() { spawnParticle("zzz", 225, 165); },
  },
  code: {
    label: "In the Coding Zone 💻", mouth: "deadpan", blush: 0,
    pose(o, t, b) {
      const typeL = Math.sin(t * 19) * 0.5 + Math.sin(t * 11) * 0.5, typeR = Math.cos(t * 19) * 0.5 + Math.sin(t * 13) * 0.5;
      o.headY = 3.5 * b; o.headRot = -3.0 + Math.sin(t * 2.2) * 1.2 * b;
      o.pawLX = 24 + typeL * 2.0 * b; o.pawLY = -2 + Math.abs(typeL) * 5.5 * b; o.pawLRot = -18 + typeL * 6 * b;   // on the keys
      o.pawRX = -34 + typeR * 2.0 * b; o.pawRY = 2 + Math.abs(typeR) * 5.5 * b; o.pawRRot = 18 + typeR * 6 * b;
      o.earLRot = Math.sin(t * 3.6) * 2 * b; o.earRRot = -Math.sin(t * 3.6) * 2 * b;
      o.shine = 0.45 + Math.sin(t * 4.5) * 0.2;
    },
    every: 0.52, emit() { spawnParticle("code", 190 + Math.random() * 130, 398); },   // rising from behind the screen
  },
  clock: {
    label: "Checking the Time ⏰", mouth: "smile", blush: 0.3,
    pose(o, t, b) {
      const breath = Math.sin(t * 2.0), bob = Math.sin(t * 2.4) * 2.5 * b;
      o.bellyY = -breath * 1.5 * b; o.headY = 3 + Math.sin(t * 2.0 - 0.45) * 1.5 * b; o.headRot = -2.5 + Math.sin(t * 1.2) * 1.5 * b;
      o.pawLX = 20; o.pawLY = -34 + bob; o.pawLRot = -16;               // holding the clock up from underneath to show you
      o.pawRX = 50; o.pawRY = -36 + bob; o.pawRRot = 28;
      o.earLRot = Math.sin(t * 2.4) * 2 * b; o.earRRot = -Math.sin(t * 2.4) * 2 * b; o.tailRot = Math.sin(t * 3) * 6 * b;
    },
  },
};
const MODE_NAMES = Object.keys(MODES);
const CHORDS = [[261.63, 329.63, 392.0, 493.88], [220.0, 261.63, 329.63, 392.0], [174.61, 220.0, 261.63, 349.23], [196.0, 246.94, 293.66, 349.23]];

// ---------- state ----------
const state = {
  mode: "idle", exprOverride: null, speed: 1, bounceScale: reduceMotion ? 0.6 : 1, eyeTracking: store.get("eyes", true),
  t: 0, chordStep: 0,
  fade: Object.fromEntries(MODE_NAMES.map((m) => [m, m === "idle" ? 1 : 0])),      // 0..1 progress of each mode's cross-fade
  emitAt: Object.fromEntries(MODE_NAMES.map((m) => [m, 0])),
  springs: { earL: { pos: 0, vel: 0 }, earR: { pos: 0, vel: 0 }, tail: { pos: 0, vel: 0 }, foot: { pos: 0, vel: 0 }, pat: { pos: 0, vel: 0 } },
  glassesT: 0, bellyWinkT: 0, blushPulse: 0, blush: 0, surpriseT: 0, yawnT: 0,
  blink: { next: 2.5, until: 0 },
  eye: { x: 0, y: 0, tx: 0, ty: 0, lastPointer: -99 }, gaze: { x: 0, y: 0, until: 0 },
  nextFidget: 4,
  deskClock: store.get("deskClock", true), ringT: 0, chimeHour: new Date().getHours(),
};
const FADE_TIME = 0.6;
   // seconds for one mode to hand over to the next

// critically damped-ish spring on an impulse (ears, tail, feet, head pat); sub-stepped so it is stable at any frame rate
function stepSpring(s, k, c, dt) {
  const n = Math.ceil(dt / (1 / 120));
  for (let i = 0; i < n; i++) { const h = dt / n; s.vel += (-k * s.pos - c * s.vel) * h; s.pos += s.vel * h; }
}

// ---------- particles (time-based) ----------
const particles = [];
function spawnParticle(type, x, y) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  let c = "";
  if (type === "heart") c = '<path d="M 0 6 C -8 -2, -16 4, -8 14 L 0 22 L 8 14 C 16 4, 8 -2, 0 6 Z" fill="#f43f5e" stroke="#141210" stroke-width="2.5"/>';
  else if (type === "zzz") c = '<text x="0" y="0" font-family="Fredoka, sans-serif" font-weight="700" font-size="24" fill="#141210">Zzz</text>';
  else if (type === "note") {
    const sym = ["♪", "♫", "♬"][Math.floor(Math.random() * 3)], col = ["#e07a5f", "#3d405b", "#81b29a", "#f2cc8f"][Math.floor(Math.random() * 4)];
    c = `<text x="0" y="0" font-family="Fredoka, sans-serif" font-weight="700" font-size="28" fill="${col}" stroke="#141210" stroke-width="1.2">${sym}</text>`;
  } else if (type === "steam") c = '<path d="M 0 0 Q -6 -10 0 -20 Q 6 -30 0 -40" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.75"/>';
  else if (type === "code") c = `<text x="0" y="0" font-family="monospace" font-weight="700" font-size="18" fill="#0284c7">${["{ }", "&lt;/&gt;", "01", "★"][Math.floor(Math.random() * 4)]}</text>`;
  else if (type === "sparkle") c = '<path d="M 0 -10 Q 0 0 10 0 Q 0 0 0 10 Q 0 0 -10 0 Q 0 0 0 -10 Z" fill="#fbbf24" stroke="#141210" stroke-width="2"/>';
  g.innerHTML = c;
  rig.particles.appendChild(g);
  particles.push({ el: g, x: x + rand(-13, 13), y, vx: rand(-21, 21), vy: -rand(60, 108), scale: 0.4, life: 0, max: rand(1.25, 1.65) });
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt; p.x += p.vx * dt + Math.sin(p.life * 4.8) * 21 * dt; p.y += p.vy * dt;
    p.scale = Math.min(1.05, p.scale + 2.4 * dt);
    const a = p.life > p.max * 0.6 ? Math.max(0, 1 - (p.life - p.max * 0.6) / (p.max * 0.4)) : 1;
    p.el.setAttribute("transform", `translate(${p.x.toFixed(1)}, ${p.y.toFixed(1)}) scale(${p.scale.toFixed(2)})`);
    p.el.setAttribute("opacity", a.toFixed(2));
    if (p.life >= p.max) { p.el.remove(); particles.splice(i, 1); }
  }
}

// ---------- one-shot reactions ----------
function triggerGlassesPush(loud = true) {
  if (state.glassesT > 0) return;
  state.glassesT = 1.0;
  if (loud) { sound.playSparkle(); spawnParticle("sparkle", 240, 195); spawnParticle("sparkle", 345, 195); }
}
function twitchEar(side, loud = true) {
  state.springs[side === "L" ? "earL" : "earR"].vel = side === "L" ? -260 : 260;
  if (loud) { sound.playBoing(); spawnParticle("sparkle", side === "L" ? 210 : 430, 95); }
}
function wiggleToes(loud = true) {
  state.springs.foot.vel = -280;
  if (loud) { sound.playBoing(); spawnParticle("heart", 215, 540); spawnParticle("sparkle", 150, 550); }
}
function wagTail(loud = true) {
  state.springs.tail.vel = 320;
  if (loud) { sound.playBoing(); spawnParticle("sparkle", 495, 500); }
}
function winkBelly(loud = true) {
  state.bellyWinkT = 1.0;
  if (loud) { sound.playPop(680); spawnParticle("heart", 306, 395); }
}
function headPat() {
  if (state.mode === "sleep") { wake(); return; }
  state.springs.pat.vel = 220; state.blushPulse = 1.4;
  sound.playPop(580); spawnParticle("heart", 280, 110); spawnParticle("heart", 340, 115);
}
function wake() {
  setMode("idle", { quietButton: true });
  state.surpriseT = 0.9; state.springs.earL.vel = -300; state.springs.earR.vel = 300;
  sound.playBoing(); spawnParticle("sparkle", 230, 120); spawnParticle("sparkle", 380, 120);
  autopilot.until = state.t + rand(4, 7);
}

// ---------- autopilot: he decides what to do next ----------
const autopilot = {
  on: store.get("auto", true), until: rand(6, 9), acts: 0,
  LEN: { idle: [7, 12], wave: [2.8, 3.6], cocoa: [10, 15], code: [12, 18], vibe: [9, 14], sleep: [14, 22], clock: [5, 7] },
  step() {
    if (!this.on || state.t < this.until) return;
    let next = "idle";
    if (state.mode === "idle") {
      next = weighted([["cocoa", 3], ["code", 3], ["vibe", 2], ["wave", 1.2], ["clock", 0.8], ["sleep", this.acts >= 3 ? 3 : 0.3]]);
      this.acts = next === "sleep" ? 0 : this.acts + 1;
    }
    if (state.mode === "sleep") wake(); else setMode(next, { quietButton: true });
    const [a, b] = this.LEN[state.mode];
    this.until = state.t + rand(a, b);
  },
};

// on the hour: the desk clock rings, and (in Auto, when he is awake) he holds the clock up to show you the time
function chimeCheck() {
  const now = new Date(), h = now.getHours();
  if (now.getMinutes() !== 0 || h === state.chimeHour) return;
  state.chimeHour = h;
  state.ringT = 1.6;
  sound.playChime();
  if (autopilot.on && state.mode !== "sleep") {
    setMode("clock", { quietButton: true });
    autopilot.until = state.t + 7;
    spawnParticle("sparkle", 220, 350); spawnParticle("sparkle", 385, 350);
  }
}
// the desk clock needs room beside him: the picture widens to the right while it is out (he stays where he is)
const VIEW_W = 600, VIEW_W_CLOCK = 740;
function fitView() { rig.svg.setAttribute("viewBox", `0 0 ${state.deskClock ? VIEW_W_CLOCK : VIEW_W} 630`); rig.svg.classList.toggle("wide", state.deskClock); }
function setDeskClock(on) { state.deskClock = on; store.set("deskClock", on); fitView(); hooks.onChange(); }

// small fidgets while idling, so he never stands frozen
function fidget() {
  const what = weighted([["look", 3], ["ear", 2], ["toes", 1.2], ["tail", 1.2], ["glasses", 1], ["belly", 0.8], ["yawn", 0.7]]);
  if (what === "look") { state.gaze = { x: rand(3.5, 6) * (Math.random() < 0.5 ? -1 : 1), y: rand(-2.5, 2.5), until: state.t + rand(1.2, 2.2) }; }
  else if (what === "ear") twitchEar(Math.random() < 0.5 ? "L" : "R", false);
  else if (what === "toes") wiggleToes(false);
  else if (what === "tail") wagTail(false);
  else if (what === "glasses") triggerGlassesPush(false);
  else if (what === "belly") winkBelly(false);
  else state.yawnT = 1.6;
}

// ---------- mode switching ----------
function setMode(mode, opts = {}) {
  if (!MODES[mode]) return;
  if (!opts.quietButton) sound.playPop(440);
  if (opts.manual) setAuto(false);
  state.mode = mode; state.exprOverride = null;
  updateStatus();
}
function setAuto(on) {
  autopilot.on = on; store.set("auto", on);
  if (on) autopilot.until = state.t + 2;
  updateStatus();
}
function updateStatus() { hooks.onChange(); }

// ---------- one frame ----------
let lastNow = null;
const dbg = { paused: false };
function frame(now) {
  const real = lastNow === null ? 1 / 60 : clamp((now - lastNow) / 1000, 0, 1 / 15);   // a long pause never becomes a jump
  lastNow = now;
  if (!dbg.paused) tick(real);
  requestAnimationFrame(frame);
}
document.addEventListener("visibilitychange", () => { lastNow = null; });

function tick(real) {
  const dt = real * state.speed;
  state.t += dt;
  const t = state.t, b = state.bounceScale;

  autopilot.step();
  chimeCheck();
  if (state.mode === "idle" && state.fade.idle > 0.98 && t > state.nextFidget) { fidget(); state.nextFidget = t + rand(2.8, 5.5); }
  else if (state.mode !== "idle") state.nextFidget = Math.max(state.nextFidget, t + 2.5);

  // cross-fade weights: each mode eases in or out over FADE_TIME
  let sum = 0;
  const w = {};
  for (const m of MODE_NAMES) {
    state.fade[m] = clamp(state.fade[m] + (m === state.mode ? 1 : -1) * dt / FADE_TIME, 0, 1);
    w[m] = smooth(state.fade[m]); sum += w[m];
  }
  for (const m of MODE_NAMES) w[m] = sum > 0 ? w[m] / sum : (m === state.mode ? 1 : 0);
  let lead = state.mode;
  for (const m of MODE_NAMES) if (w[m] > w[lead]) lead = m;

  // blend the poses of every mode that is still showing
  const pose = Object.assign({}, REST, { sip: 0, shine: 0 });
  for (const k of KEYS) pose[k] = 0;
  pose.sip = 0; pose.shine = 0;
  for (const m of MODE_NAMES) {
    if (w[m] < 1e-4) continue;
    const o = Object.assign({}, REST, { tailRot: Math.sin(t * 2.2) * 3.5 * b, sip: 0, shine: 0 });
    MODES[m].pose(o, t, b);
    for (const k of KEYS) pose[k] += o[k] * w[m];
    pose.sip += o.sip * w[m]; pose.shine += o.shine * w[m];
  }

  // things each mode gives off, only once it is mostly in
  for (const m of MODE_NAMES) {
    const M = MODES[m];
    if (!M.emit || w[m] < 0.6) continue;
    if (M.every) { if (t >= state.emitAt[m]) { state.emitAt[m] = t + M.every; M.emit(dt, pose); } }
    else M.emit(dt, pose);
  }

  // springs: impulses from taps and fidgets
  const S = state.springs;
  stepSpring(S.earL, 180, 10, real); stepSpring(S.earR, 180, 10, real); stepSpring(S.tail, 210, 9, real);
  stepSpring(S.foot, 190, 9, real); stepSpring(S.pat, 150, 11, real);
  pose.earLRot += S.earL.pos; pose.earRRot += S.earR.pos; pose.tailRot += S.tail.pos;
  pose.footRRot += S.foot.pos; pose.footLRot -= S.foot.pos * 0.8; pose.rootY -= Math.abs(S.foot.pos) * 0.25;
  const pat = S.pat.pos;
  pose.headY += Math.abs(pat) * 0.45; pose.headRot += pat * 0.35; pose.earLRot -= Math.abs(pat) * 0.8; pose.earRRot += Math.abs(pat) * 0.8;
  pose.rootScaleX += Math.abs(pat) * 0.0012; pose.rootScaleY -= Math.abs(pat) * 0.0012;

  // glasses push: the right paw goes up to the frame and nudges it, then returns to whatever it was doing
  let push = 0;
  if (state.glassesT > 0) {
    state.glassesT = Math.max(0, state.glassesT - real * 1.6);
    const p = smooth(Math.sin(state.glassesT * Math.PI));
    push = p;
    pose.pawRX = lerp(pose.pawRX, 16, p); pose.pawRY = lerp(pose.pawRY, -262, p); pose.pawRRot = lerp(pose.pawRRot, 96, p);
    pose.headRot -= 3.5 * p; pose.headY += 2.5 * p;
  }
  rig.glasses.setAttribute("transform", `translate(0, ${(-3.5 * push).toFixed(1)})`);
  rig.glassesShine.setAttribute("opacity", Math.max(push, pose.shine).toFixed(2));

  // a yawn: head back, mouth open, eyes squeezed shut in the middle
  let yawnK = 0;
  if (state.yawnT > 0) { state.yawnT = Math.max(0, state.yawnT - real); yawnK = Math.sin((1 - state.yawnT / 1.6) * Math.PI); pose.headRot += 3 * yawnK; pose.headY -= 3 * yawnK; }
  if (state.surpriseT > 0) state.surpriseT = Math.max(0, state.surpriseT - real);

  // eyes: smooth follow of the cursor, or a look around when the cursor is idle
  const E = state.eye, recentPointer = state.eyeTracking && t - E.lastPointer < 4;
  const gazeOn = t < state.gaze.until;
  const gx = recentPointer ? E.tx : gazeOn ? state.gaze.x : 0, gy = recentPointer ? E.ty : gazeOn ? state.gaze.y : 0;
  const k = 1 - Math.exp(-real * 7.5);
  E.x += (gx - E.x) * k; E.y += (gy - E.y) * k;
  rig.eyes.setAttribute("transform", `translate(${E.x.toFixed(2)}, ${E.y.toFixed(2)})`);
  const awake = 1 - w.sleep;
  pose.headX += E.x * 0.4 * awake; pose.headY += E.y * 0.3 * awake; pose.headRot += E.x * 0.25 * awake;

  // blinking on its own clock, now and then twice
  if (t > state.blink.next) { state.blink.until = t + 0.13; state.blink.next = t + (Math.random() < 0.15 ? 0.3 : rand(2.8, 5.8)); }
  const blinking = t < state.blink.until;
  const sipping = w.cocoa > 0.5 && pose.sip > 0.55;
  const closed = w.sleep > 0.5 || sipping || (yawnK > 0.35);
  const happy = Math.abs(S.pat.pos) > 2.5;
  showEl(rig.eyesClosed, closed || (blinking && !happy));
  showEl(rig.eyesHappy, !closed && happy);
  showEl(rig.eyesOpen, !closed && !happy && !blinking);

  // mouth: a chosen expression wins; otherwise the leading mode's, with a little "o" for yawns and surprises
  let mouth = state.exprOverride || MODES[lead].mouth;
  if (yawnK > 0.2 || state.surpriseT > 0) mouth = "o";
  for (const id of ["deadpan", "smile", "cat", "o"]) showEl($("mouth-" + id), id === mouth);
  state.mouth = mouth;

  // blush: eases toward the modes' blush, flushes on a head pat
  state.blushPulse = Math.max(0, state.blushPulse - real);
  let blushTarget = 0;
  for (const m of MODE_NAMES) blushTarget += MODES[m].blush * w[m];
  if (state.blushPulse > 0) blushTarget = 1;
  state.blush += (blushTarget - state.blush) * (1 - Math.exp(-real * 6));
  rig.faceBlush.setAttribute("opacity", state.blush.toFixed(2));

  // belly bear: winks when tapped, sleeps when he does
  if (state.bellyWinkT > 0) state.bellyWinkT = Math.max(0, state.bellyWinkT - real * 2.0);
  const bellyShut = state.bellyWinkT > 0 || w.sleep > 0.5;
  showEl(rig.bellyEyesOpen, !bellyShut); showEl(rig.bellyEyesWink, bellyShut);

  // props grow in and out with their mode instead of popping
  const pop = (x) => { x = clamp(x, 0, 1); const s = 1.70158; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
  const lap = w.code, mug = w.cocoa, hp = w.vibe;
  showEl(rig.propLaptop, false);
  showEl(lapBack, lap > 0.01);
  if (lap > 0.01) {
    lapBack.setAttribute("transform", `translate(266 530) scale(${pop(lap).toFixed(3)}) translate(-266 -530)`);
    lapBack.setAttribute("opacity", Math.min(1, lap * 2).toFixed(2));
    // little tap marks pop up over the lid in time with each paw's keystrokes
    const typing = lap > 0.6;
    showEl(lapTapL, typing && Math.sin(t * 19) > 0.5); showEl(lapTapR, typing && Math.cos(t * 19) > 0.5);
  }
  // the clocks: the held one grows in with its mode and rides on his paws; the desk one rings on the hour
  const now = new Date(), txt = clockText(now);
  if (txt !== shownTime) {
    shownTime = txt;
    for (const el of clockTexts) el.innerHTML = `${txt.slice(0, 2)}<tspan class="colon">:</tspan>${txt.slice(3)}`;
  }
  const colonOn = now.getMilliseconds() < 600;                     // the colon blinks once a second
  for (const el of clockTexts) el.firstElementChild.setAttribute("fill-opacity", colonOn ? "1" : "0.15");
  const ck = w.clock;
  showEl(heldClock, ck > 0.01);
  if (ck > 0.01) {
    const dy = ((pose.pawLY + pose.pawRY) / 2 + 35) * ck - 6;       // resting on his paws
    heldClock.setAttribute("transform", `translate(0 ${dy.toFixed(1)}) translate(300 482) scale(${(1.2 * pop(ck)).toFixed(3)}) translate(-300 -482)`);   // 1.2×, so the time reads at a glance
    heldClock.setAttribute("opacity", Math.min(1, ck * 2).toFixed(2));
  }
  state.ringT = Math.max(0, state.ringT - real);
  showEl(deskClock, state.deskClock);
  if (state.deskClock) {
    const shake = state.ringT > 0 ? Math.sin(t * 60) * 6 * Math.min(1, state.ringT) : 0;
    deskClock.setAttribute("transform", `translate(640 584) rotate(${shake.toFixed(1)}) scale(0.8) translate(-300 -482)`);
  }
  showEl(rig.propMug, mug > 0.01);
  rig.propMug.setAttribute("transform", `translate(-22, -18) rotate(${pose.mugRot.toFixed(2)}) scale(${pop(mug).toFixed(3)})`);
  showEl(rig.propHeadphones, hp > 0.01);
  if (hp > 0.01) { rig.propHeadphones.setAttribute("transform", `translate(0 ${(-(1 - smooth(hp)) * 60).toFixed(1)})`); rig.propHeadphones.setAttribute("opacity", Math.min(1, hp * 2).toFixed(2)); }

  // apply
  rig.root.setAttribute("transform", `translate(304, ${(586 + pose.rootY).toFixed(2)}) scale(${pose.rootScaleX.toFixed(4)}, ${pose.rootScaleY.toFixed(4)})`);
  rig.shadow.setAttribute("rx", (186 * pose.rootScaleX - pose.rootY * 0.8).toFixed(1));
  rig.bellyContent.setAttribute("transform", `translate(0, ${pose.bellyY.toFixed(2)})`);
  rig.zipper.setAttribute("transform", `translate(301, 322) rotate(${(pose.headRot * 1.2).toFixed(2)})`);
  rig.head.setAttribute("transform", `translate(${(308 + pose.headX).toFixed(2)}, ${(298 + pose.headY).toFixed(2)}) rotate(${pose.headRot.toFixed(2)})`);
  rig.earLeft.setAttribute("transform", `translate(248, 134) rotate(${pose.earLRot.toFixed(2)})`);
  rig.earRight.setAttribute("transform", `translate(390, 136) rotate(${pose.earRRot.toFixed(2)})`);
  updateLeftSleeveGeometry(pose.pawLX, pose.pawLY);
  rig.pawLeft.setAttribute("transform", `translate(${(208 + pose.pawLX).toFixed(2)}, ${(492 + pose.pawLY).toFixed(2)}) rotate(${pose.pawLRot.toFixed(2)})`);
  updateRightSleeveGeometry(pose.pawRX, pose.pawRY);
  rig.pawRight.setAttribute("transform", `translate(${(318 + pose.pawRX).toFixed(2)}, ${(496 + pose.pawRY).toFixed(2)}) rotate(${pose.pawRRot.toFixed(2)})`);
  rig.footLeft.setAttribute("transform", `translate(176, 566) rotate(${pose.footLRot.toFixed(2)})`);
  rig.footRight.setAttribute("transform", `translate(242, 560) rotate(${pose.footRRot.toFixed(2)})`);
  rig.tail.setAttribute("transform", `translate(452, 512) rotate(${pose.tailRot.toFixed(2)})`);

  updateParticles(real);
  dbg.w = w; dbg.pose = pose;
}

