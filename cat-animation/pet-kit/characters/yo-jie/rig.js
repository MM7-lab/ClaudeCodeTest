
// =====================================================================================================
// Yo 姐: her joints, arms and poses on top of the shared engine. The bear sits; she stands, so the
// seated poses are replaced here. Nothing in the engine changes for any other character.
// =====================================================================================================
Object.assign(JOINT, {
  root: [304, 586], head: [304, 174], earL: [260, 133], earR: [348, 133], zipper: [304, 178], tail: [292, 150],
  pawL: [224, 354], pawR: [384, 354], footL: [262, 562], footR: [348, 562],
  reach: [-20, -206, 0],          // tucking the loose strand behind her right ear
  gaze: [0.507, 0.19],
});

// extra pose keys, blended like the others: how much more (or less) each elbow bends
REST.elbowL = 0; REST.elbowR = 0; KEYS.push("elbowL", "elbowR");
const yo = { jumpAt: -9, smiled: false };

// ---------- the "Hooray!" jump (feet tap, the toes button, now and then on her own) ----------
const JUMP_TIME = 0.95;
const jumpK = () => (state.t - yo.jumpAt) / JUMP_TIME;
const jumpArms = () => { const k = jumpK(); return k > 0 && k < 1 ? smooth(k * 4) * smooth((1 - k) * 4) : 0; };
function hooray(o) {
  const k = jumpK();
  if (!(k > 0 && k < 1)) return;
  const squash = k < 0.14 ? Math.sin((k / 0.14) * Math.PI) : 0;              // crouch before take-off
  const air = k > 0.14 ? Math.sin(((k - 0.14) / 0.86) * Math.PI) : 0, arms = jumpArms();
  o.rootY -= 48 * air;
  o.rootScaleX += 0.03 * squash - 0.01 * air; o.rootScaleY += -0.05 * squash + 0.02 * air;
  o.pawLX = lerp(o.pawLX, -26, arms); o.pawLY = lerp(o.pawLY, -284, arms); o.pawLRot = lerp(o.pawLRot, 0, arms);
  o.pawRX = lerp(o.pawRX, 26, arms); o.pawRY = lerp(o.pawRY, -284, arms); o.pawRRot = lerp(o.pawRRot, 0, arms);
  o.elbowL = lerp(o.elbowL, 0, arms); o.elbowR = lerp(o.elbowR, 0, arms);
  o.footLRot -= 18 * air; o.footRRot += 18 * air;                               // toes point down in the air
  o.tailRot -= 45 * arms;                                                       // the braid flies out
  o.headRot -= 3 * air; o.earLRot -= 12 * air; o.earRRot -= 12 * air;
}

// ---------- arms: drawn from shoulder to hand, with a short striped sleeve and a turned-up cuff ----------
const ARM = { L: { s: [250, 196], out: -1 }, R: { s: [358, 196], out: 1 }, half: 81 };
const armEls = {
  L: { outline: rig.sleeveLeftOuter, skin: rig.sleeveLeftInner, sleeveLine: rig.sleeveLeftCrease, sleeve: rig.sleeveLeftFill, cuff: $("yo-cuff-left"),
       hand: $("yo-hand-l"), pick: { relaxed: $("yo-hand-l-relaxed"), fist: $("yo-hand-l-fist") } },
  R: { outline: rig.sleeveRightUpper, skin: rig.sleeveRightLower, sleeveLine: rig.sleeveRightCrease, sleeve: rig.sleeveRightFill, cuff: rig.sleeveRightShadow,
       hand: $("yo-hand-r"), pick: { relaxed: $("yo-hand-r-relaxed"), open: $("yo-hand-r-open"), fist: $("yo-hand-r-fist") } },
};
function drawArm(side, hx, hy, bendMore) {
  const A = ARM[side], E = armEls[side], [sx, sy] = A.s, f = (v) => v.toFixed(1);
  const dx = hx - sx, dy = hy - sy, d = Math.hypot(dx, dy) || 1;
  let nx = -dy / d, ny = dx / d;
  if (nx * A.out + ny < 0) { nx = -nx; ny = -ny; }                             // the elbow bends outward and down
  const bend = Math.sqrt(Math.max(0, ARM.half * ARM.half - (d * d) / 4)) + bendMore;
  const ex = (sx + hx) / 2 + nx * bend, ey = (sy + hy) / 2 + ny * bend;
  const arm = `M ${f(sx)} ${f(sy)} L ${f(ex)} ${f(ey)} L ${f(hx)} ${f(hy)}`;
  E.outline.setAttribute("d", arm); E.skin.setAttribute("d", arm);
  const ul = Math.hypot(ex - sx, ey - sy) || 1, vx = (ex - sx) / ul, vy = (ey - sy) / ul, len = Math.min(54, ul * 0.7);
  const s0x = sx - vx * 8, s0y = sy - vy * 8, cx = sx + vx * len, cy = sy + vy * len, kx = cx - vx * 8, ky = cy - vy * 8;
  E.sleeve.setAttribute("d", `M ${f(s0x)} ${f(s0y)} L ${f(cx)} ${f(cy)}`);
  E.sleeveLine.setAttribute("d", `M ${f(s0x)} ${f(s0y)} L ${f(cx + vx * 2.6)} ${f(cy + vy * 2.6)}`);
  E.cuff.setAttribute("d", `M ${f(kx - vy * 14)} ${f(ky + vx * 14)} L ${f(kx + vy * 14)} ${f(ky - vx * 14)}`);
  E.hand.setAttribute("transform", `rotate(${f((Math.atan2(hy - ey, hx - ex) * 180) / Math.PI - 90)}) scale(1.3)`);   // the hand follows the forearm
  const which = jumpArms() > 0.3 ? "fist" : E.pick.open && hy < sy - 30 ? "open" : "relaxed";
  for (const [k, el] of Object.entries(E.pick)) showEl(el, k === which);
}
// the engine calls these every frame with the hands' offsets (the elbows' extra bend is last frame's pose)
updateLeftSleeveGeometry = (lx, ly) => drawArm("L", JOINT.pawL[0] + lx, JOINT.pawL[1] + ly, dbg.pose ? dbg.pose.elbowL : 0);
updateRightSleeveGeometry = (rx, ry) => {
  const hx = JOINT.pawR[0] + rx, hy = JOINT.pawR[1] + ry;
  drawArm("R", hx, hy, dbg.pose ? dbg.pose.elbowR : 0);
  placeHeldClock(hx, hy);
};

// ---------- props: the held clock sits on her palm, the laptop is held in front of her ----------
const SVG_NS = "http://www.w3.org/2000/svg";
function wrapChildren(el) {
  const g = document.createElementNS(SVG_NS, "g");
  while (el.firstChild) g.appendChild(el.firstChild);
  el.appendChild(g);
  return g;
}
const clockWrap = wrapChildren(heldClock);
// undo the engine's placement (made for the bear's paws) and stand the clock on her hand, small, still popping in
function placeHeldClock(hx, hy) {
  const m = /translate\(0 (-?[\d.]+)\) translate\(300 482\) scale\(([\d.]+)\)/.exec(heldClock.getAttribute("transform") || "");
  if (!m || +m[2] < 0.001) return;
  const dy = +m[1], k = +m[2], s = (0.4 * k) / 1.2;
  clockWrap.setAttribute("transform", `translate(300 482) scale(${(1 / k).toFixed(4)}) translate(-300 ${(-482 - dy).toFixed(2)}) translate(${(hx - 4).toFixed(1)} ${(hy - 6).toFixed(1)}) scale(${s.toFixed(4)}) translate(-300 -482)`);
}
// the clock on the floor beside her: smaller than the bear's, still standing on the floor
wrapChildren(deskClock).setAttribute("transform", "translate(300 482) scale(0.62) translate(-300 -482)");
const lapWrap = wrapChildren(lapBack);
lapWrap.setAttribute("transform", "translate(304 266) scale(0.5) translate(-266 -470)");
const emblem = lapWrap.querySelector('g[transform="translate(266, 466)"]');
if (emblem) emblem.innerHTML = '<path d="M 0 -16 L 4.8 -5.5 L 16 -4.5 L 7.6 3.4 L 10 15 L 0 9 L -10 15 L -7.6 3.4 L -16 -4.5 L -4.8 -5.5 Z" fill="#f4d35e" stroke="#141210" stroke-width="3.6" stroke-linejoin="round"/>';

// ---------- her poses (standing) ----------
const POSES = {
  idle(o, t, b) {
    const breath = Math.sin(t * 2.0), late = Math.sin(t * 2.0 - 0.45), sway = Math.sin(t * 0.9);
    o.rootScaleX = 1 - breath * 0.004 * b; o.rootScaleY = 1 + breath * 0.006 * b; o.bellyY = -breath * 1.2 * b;
    o.headX = sway * 1.2 * b; o.headY = -late * 1.4 * b; o.headRot = Math.sin(t * 1.0) * 1.6 * b;
    o.earLRot = Math.sin(t * 1.7) * 6 * b; o.earRRot = Math.sin(t * 1.7 + 0.6) * 6 * b;
    o.pawLX = -2 + sway * 1.5 * b; o.pawLY = -breath * 1.2 * b; o.pawRX = 2 + sway * 1.5 * b; o.pawRY = -breath * 1.2 * b;
    o.footRRot = -Math.max(0, Math.sin(t * 1.3)) * 3 * b; o.tailRot = sway * 2 * b;
  },
  wave(o, t, b) {      // like the "waving" sketch: right hand up by her head, left hand loose at her side
    const sway = Math.sin(t * 3.6), wave = Math.sin(t * 7.6), bob = (1 - Math.cos(t * 7.6)) * 0.5;
    o.rootScaleX = 1 + bob * 0.006 * b; o.rootScaleY = 1 - bob * 0.006 * b; o.bellyY = -bob * 1.2 * b;
    o.headX = sway * 1.5 * b; o.headY = -bob * 1.5 * b; o.headRot = -3 + sway * 3 * b;
    o.pawRX = 18 + wave * 8 * b; o.pawRY = -256 + Math.abs(wave) * 3 * b; o.pawRRot = wave * 14 * b;
    o.pawLX = -16; o.pawLY = -10;
    o.earLRot = sway * 10 * b; o.earRRot = sway * 10 * b; o.tailRot = wave * 6 * b;
  },
  cocoa(o, t, b) {
    const raw = clamp((Math.sin(t * 1.6) + 0.25) / 1.25, 0, 1), sip = raw * raw * (3 - 2 * raw), breath = Math.sin(t * 2.0);
    o.bellyY = -breath * 1.0 * b; o.headY = sip * 2 * b - breath * 0.8; o.headRot = -sip * 4 * b;
    o.pawRX = -62 - sip * 18 * b; o.pawRY = -118 - sip * 74 * b; o.mugRot = -sip * 22;
    o.pawLX = 30; o.pawLY = -40;                                                  // left hand at her waist
    o.earLRot = -sip * 5 * b; o.earRRot = -sip * 5 * b; o.footRRot = -Math.max(0, Math.sin(t * 2.8)) * 3 * b; o.tailRot = Math.sin(t * 3.2) * 3 * b;
    o.sip = sip;
  },
  vibe(o, t, b) {
    const tempo = t * 5.6, groove = (1 - Math.cos(tempo)) * 0.5, hg = (1 - Math.cos(tempo - 0.55)) * 0.5, side = Math.sin(tempo * 0.5);
    o.rootScaleX = 1 + groove * 0.008 * b; o.rootScaleY = 1 - groove * 0.012 * b; o.bellyY = groove * 1.5 * b;
    o.headX = side * 3 * b; o.headY = hg * 4 * b; o.headRot = -hg * 4 * b + side * 3 * b;
    o.earLRot = side * 14 * b; o.earRRot = side * 14 * b;
    o.pawLX = -8 + side * 6 * b; o.pawLY = -40 - groove * 6 * b; o.pawRX = 8 + side * 6 * b; o.pawRY = -40 - groove * 6 * b;   // snapping along at her hips
    o.footRRot = -groove * 10 * b; o.tailRot = side * 8 * b;
  },
  sleep(o, t, b) {     // dozing on her feet
    const slow = Math.sin(t * 1.25), nod = (1 - Math.cos(t * 0.85)) * 0.5;
    o.rootScaleX = 1 - slow * 0.003 * b; o.rootScaleY = 1 + slow * 0.006 * b; o.bellyY = -slow * 1.4 * b;
    o.headX = -1.5 * b; o.headY = (3 + nod * 3) * b; o.headRot = (-6 - nod * 5) * b;
    o.pawLX = 2; o.pawLY = 4; o.pawRX = -2; o.pawRY = 4; o.earLRot = -6; o.earRRot = -6; o.tailRot = slow * 1.5;
  },
  code(o, t, b) {      // laptop held open in front of her: left hand under it, right hand typing behind the lid
    const typeR = Math.cos(t * 19) * 0.5 + Math.sin(t * 13) * 0.5;
    o.headY = 3 * b; o.headRot = -2.5 + Math.sin(t * 2.2) * 1 * b;
    o.pawLX = 38; o.pawLY = -56;
    o.pawRX = -60 + typeR * 3 * b; o.pawRY = -84 + Math.abs(typeR) * 4 * b;
    o.earLRot = Math.sin(t * 3.6) * 3 * b; o.earRRot = -Math.sin(t * 3.6) * 3 * b;
  },
  clock(o, t, b) {     // like the "presenting" sketch: one hand on her chest, the clock held out on the other
    const breath = Math.sin(t * 2.0), bob = Math.sin(t * 2.4) * 2 * b;
    o.bellyY = -breath * b; o.headY = 1.5 + Math.sin(t * 2.0 - 0.45) * b; o.headRot = 4 + Math.sin(t * 1.2) * 1.5 * b;
    o.pawLX = 74; o.pawLY = -126;
    o.pawRX = 52; o.pawRY = -96 + bob; o.elbowR = -40;
    o.earLRot = Math.sin(t * 2.4) * 4 * b; o.earRRot = Math.sin(t * 2.4) * 4 * b; o.tailRot = Math.sin(t * 3) * 3 * b;
  },
};
for (const [m, fn] of Object.entries(POSES)) MODES[m].pose = (o, t, b) => { fn(o, t, b); hooray(o); };
MODES.wave.emit = (dt, pose) => { if (Math.random() < 2.4 * dt) spawnParticle("sparkle", JOINT.pawR[0] + pose.pawRX + 14, JOINT.pawR[1] + pose.pawRY - 26); };
MODES.cocoa.emit = (dt, pose) => spawnParticle("steam", JOINT.pawR[0] + pose.pawRX, JOINT.pawR[1] + pose.pawRY - 26);
MODES.vibe.emit = () => {
  spawnParticle("note", 240 + Math.random() * 130, 60);
  if (Math.random() < 0.45) { sound.playChord(CHORDS[state.chordStep % CHORDS.length]); state.chordStep++; }
};
MODES.sleep.emit = () => spawnParticle("zzz", 334, 62);
MODES.code.emit = () => spawnParticle("code", 266 + Math.random() * 70, 232);

// ---------- her reactions ----------
triggerGlassesPush = function (loud = true) {     // tucks the loose strand behind her ear
  if (state.glassesT > 0) return;
  state.glassesT = 1.0;
  if (loud) { sound.playSparkle(); spawnParticle("sparkle", 358, 100); }
};
twitchEar = function (side, loud = true) {        // earrings swing
  state.springs[side === "L" ? "earL" : "earR"].vel = side === "L" ? -320 : 320;
  if (loud) { sound.playBoing(); spawnParticle("sparkle", side === "L" ? 248 : 360, 150); }
};
wiggleToes = function (loud = true) {             // "Hooray!": a happy jump, fists up, braid flying
  if (jumpK() < 1) return;
  yo.jumpAt = state.t; state.springs.pat.vel = 160; state.blushPulse = 1;
  if (loud) sound.playBoing();
  spawnParticle("sparkle", 210, 70); spawnParticle("sparkle", 398, 70);
  if (!state.exprOverride) {
    state.exprOverride = "smile"; yo.smiled = true;
    setTimeout(() => { if (yo.smiled && state.exprOverride === "smile") state.exprOverride = null; yo.smiled = false; }, JUMP_TIME * 1000);
  }
};
wagTail = function (loud = true) {
  state.springs.tail.vel = 260;
  if (loud) { sound.playBoing(); spawnParticle("sparkle", 266, 180); }
};
winkBelly = function (loud = true) {
  state.bellyWinkT = 1.0;
  if (loud) { sound.playPop(680); spawnParticle("heart", 304, 276); }
};
headPat = function () {
  if (state.mode === "sleep") { wake(); return; }
  state.springs.pat.vel = 220; state.blushPulse = 1.4;
  sound.playPop(580); spawnParticle("heart", 286, 50); spawnParticle("heart", 324, 52);
};
fidget = function () {
  const what = weighted([["look", 3], ["ear", 2], ["hair", 1.2], ["tail", 1], ["belly", 0.6], ["yawn", 0.7], ["jump", 0.35]]);
  if (what === "look") { state.gaze = { x: rand(3.5, 6) * (Math.random() < 0.5 ? -1 : 1), y: rand(-2.5, 2.5), until: state.t + rand(1.2, 2.2) }; }
  else if (what === "ear") twitchEar(Math.random() < 0.5 ? "L" : "R", false);
  else if (what === "hair") triggerGlassesPush(false);
  else if (what === "tail") wagTail(false);
  else if (what === "belly") winkBelly(false);
  else if (what === "jump") wiggleToes(false);
  else state.yawnT = 1.6;
};
