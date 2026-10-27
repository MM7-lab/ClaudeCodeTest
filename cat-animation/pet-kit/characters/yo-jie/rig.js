
// =====================================================================================================
// Yo 姐: built from her model sheet (source/make_character.py). Her standing figure is the body; the head
// nods and tilts, and her faces from the expression sheet are laid over it for blinking, beaming and sleep.
// Waving, drinking, the laptop, presenting the clock and the "Hooray!" jump are whole drawings from the
// sheet, faded in over her. Nothing in the engine changes for any other character.
// =====================================================================================================
const YO = JSON.parse(rig.svg.dataset.joints);          // joint positions on the canvas, written by make_character.py
Object.assign(JOINT, {
  root: [304, 586], head: YO.head, earL: YO.earL, earR: YO.earR, zipper: YO.neck, tail: YO.braid,
  pawL: YO.handL, pawR: YO.handR, footL: [280, 580], footR: [330, 580], reach: [0, 0, 0],
  gaze: [(YO.eyeL[0] + YO.eyeR[0]) / 2 / 600, (YO.eyeL[1] + YO.eyeR[1]) / 2 / 630],
});
const yo = { jumpAt: -9 };

// ---------- framing: she is tall and slim, so the picture is cropped close around her (and bigger in the window) ----------
// the clock beside her is off until it is switched on (right-click menu or the studio's Desk Clock button)
if (store.get("deskClock", null) === null) state.deskClock = false;
const VIEW = { x: 160, y: 5, w: 320, wClock: 540, h: 595 };
fitView = function () {
  const w = state.deskClock ? VIEW.wClock : VIEW.w;
  rig.svg.setAttribute("viewBox", `${VIEW.x} ${VIEW.y} ${w} ${VIEW.h}`);
  rig.svg.classList.toggle("wide", state.deskClock);
  JOINT.gaze = [((YO.eyeL[0] + YO.eyeR[0]) / 2 - VIEW.x) / w, ((YO.eyeL[1] + YO.eyeR[1]) / 2 - VIEW.y) / VIEW.h];
};
const JUMP_TIME = 1.1;
const jumpK = () => (state.t - yo.jumpAt) / JUMP_TIME;
const jumpShow = () => { const k = jumpK(); return k > 0 && k < 1 ? smooth(k * 6) * smooth((1 - k) * 6) : 0; };
function hooray(o) {
  const k = jumpK();
  if (!(k > 0 && k < 1)) return;
  const squash = k < 0.15 ? Math.sin((k / 0.15) * Math.PI) : 0;
  const air = k > 0.15 ? Math.sin(((k - 0.15) / 0.85) * Math.PI) : 0;
  o.rootY -= 40 * air; o.rootScaleX += 0.03 * squash; o.rootScaleY -= 0.05 * squash;
}

// ---------- the whole drawings, faded over her (the engine calls the sleeve updates every frame) ----------
const FIGS = ["wave", "cocoa", "code", "clock"];
const figEl = Object.fromEntries([...FIGS, "jump"].map((m) => [m, $("yo-fig-" + m)]));
const baseEl = $("yo-base");
function crossFade() {
  const w = dbg.w || {}, jmp = jumpShow();
  let sum = 0;
  for (const m of FIGS) {
    const v = smooth(((w[m] || 0) - 0.2) / 0.6) * (1 - jmp);
    sum += v;
    figEl[m].setAttribute("opacity", v.toFixed(3)); showEl(figEl[m], v > 0.001);
  }
  figEl.jump.setAttribute("opacity", jmp.toFixed(3)); showEl(figEl.jump, jmp > 0.001);
  const b = clamp(1 - sum - jmp, 0, 1);
  baseEl.setAttribute("opacity", b.toFixed(3)); showEl(baseEl, b > 0.001);
}
updateLeftSleeveGeometry = () => {};
updateRightSleeveGeometry = () => { crossFade(); placeHeldClock(); };

// ---------- props: the laptop and mug are in the drawings; the clock stands on her open palm ----------
lapBack.style.visibility = "hidden";
const SVG_NS = "http://www.w3.org/2000/svg";
function wrapChildren(el) {
  const g = document.createElementNS(SVG_NS, "g");
  while (el.firstChild) g.appendChild(el.firstChild);
  el.appendChild(g);
  return g;
}
const clockWrap = wrapChildren(heldClock);
function placeHeldClock() {
  const m = /translate\(0 (-?[\d.]+)\) translate\(300 482\) scale\(([\d.]+)\)/.exec(heldClock.getAttribute("transform") || "");
  if (!m || +m[2] < 0.001) return;
  const dy = +m[1], k = +m[2], s = (0.32 * k) / 1.2, bob = Math.sin(state.t * 2.4) * 1.2;
  clockWrap.setAttribute("transform", `translate(300 482) scale(${(1 / k).toFixed(4)}) translate(-300 ${(-482 - dy).toFixed(2)}) translate(${YO.palm[0]} ${(YO.palm[1] + bob).toFixed(1)}) scale(${s.toFixed(4)}) translate(-300 -482)`);
}
wrapChildren(deskClock).setAttribute("transform", "translate(300 482) scale(0.62) translate(-300 -482)");

// ---------- her poses: the body breathes and sways, the head nods; the drawings carry the rest ----------
const POSES = {
  idle(o, t, b) {
    const breath = Math.sin(t * 2.0), late = Math.sin(t * 2.0 - 0.45), sway = Math.sin(t * 0.9);
    o.rootScaleX = 1 - breath * 0.004 * b; o.rootScaleY = 1 + breath * 0.006 * b;
    o.headX = sway * 0.8 * b; o.headY = -late * 1.0 * b; o.headRot = Math.sin(t * 1.0) * 2.0 * b;
    o.tailRot = sway * 2 * b;
  },
  wave(o, t, b) {
    const bob = (1 - Math.cos(t * 7.6)) * 0.5;
    o.rootScaleX = 1 + bob * 0.006 * b; o.rootScaleY = 1 - bob * 0.006 * b;
  },
  cocoa(o, t, b) {
    const breath = Math.sin(t * 2.0);
    o.rootScaleX = 1 - breath * 0.004 * b; o.rootScaleY = 1 + breath * 0.006 * b;
    o.sip = 0;
  },
  vibe(o, t, b) {      // headphones on, bopping along
    const tempo = t * 5.6, groove = (1 - Math.cos(tempo)) * 0.5, hg = (1 - Math.cos(tempo - 0.55)) * 0.5, side = Math.sin(tempo * 0.5);
    o.rootScaleX = 1 + groove * 0.008 * b; o.rootScaleY = 1 - groove * 0.012 * b;
    o.headX = side * 2.5 * b; o.headY = hg * 2.5 * b; o.headRot = -hg * 3 * b + side * 3.5 * b; o.tailRot = side * 6 * b;
  },
  sleep(o, t, b) {     // dozing on her feet
    const slow = Math.sin(t * 1.25), nod = (1 - Math.cos(t * 0.85)) * 0.5;
    o.rootScaleX = 1 - slow * 0.003 * b; o.rootScaleY = 1 + slow * 0.006 * b;
    o.headX = -1.2 * b; o.headY = (1.5 + nod * 2.5) * b; o.headRot = (-5 - nod * 4) * b;
  },
  code(o, t, b) {
    const breath = Math.sin(t * 2.0);
    o.rootScaleX = 1 - breath * 0.003 * b; o.rootScaleY = 1 + breath * 0.005 * b;
  },
  clock(o, t, b) {
    const breath = Math.sin(t * 2.0);
    o.rootScaleX = 1 - breath * 0.003 * b; o.rootScaleY = 1 + breath * 0.005 * b;
  },
};
for (const [m, fn] of Object.entries(POSES)) MODES[m].pose = (o, t, b) => { fn(o, t, b); hooray(o); };
MODES.cocoa.mouth = "deadpan";                     // the drinking drawing has its own face
MODES.wave.emit = (dt) => { if (Math.random() < 2.4 * dt) spawnParticle("sparkle", YO.waveHand[0] + rand(-10, 10), YO.waveHand[1] - 30); };
MODES.cocoa.emit = () => spawnParticle("steam", YO.mug[0], YO.mug[1] - 8);
MODES.vibe.emit = () => {
  spawnParticle("note", YO.eyeL[0] - 40 + Math.random() * 110, YO.hairTop[1] - 10);
  if (Math.random() < 0.45) { sound.playChord(CHORDS[state.chordStep % CHORDS.length]); state.chordStep++; }
};
MODES.sleep.emit = () => spawnParticle("zzz", YO.eyeR[0] + 26, YO.hairTop[1]);
MODES.code.emit = () => spawnParticle("code", YO.laptop[0] - 30 + Math.random() * 60, YO.laptop[1] - 40);
MODES.clock.emit = (dt) => { if (Math.random() < 1.2 * dt) spawnParticle("sparkle", YO.palm[0] + rand(-25, 25), YO.palm[1] - 60); };

// ---------- her reactions ----------
triggerGlassesPush = function (loud = true) {     // a little toss of her loose strand
  if (state.glassesT > 0) return;
  state.glassesT = 1.0;
  if (loud) { sound.playSparkle(); spawnParticle("sparkle", YO.strand[0] + 10, YO.strand[1] - 16); }
};
twitchEar = function (side, loud = true) {        // a shake of the head and a glint at the earring
  state.springs.pat.vel = side === "L" ? -90 : 90;
  if (loud) { const e = side === "L" ? YO.earL : YO.earR; sound.playBoing(); spawnParticle("sparkle", e[0], e[1] + 4); }
};
wiggleToes = function (loud = true) {             // "Hooray!"
  if (jumpK() < 1) return;
  yo.jumpAt = state.t; state.blushPulse = 1;
  if (loud) sound.playBoing();
  spawnParticle("sparkle", 210, 80); spawnParticle("sparkle", 400, 80); spawnParticle("sparkle", 420, 170);
};
wagTail = function (loud = true) {
  state.springs.pat.vel = 70;
  if (loud) { sound.playBoing(); spawnParticle("sparkle", YO.braid[0], YO.braid[1]); }
};
winkBelly = function (loud = true) {
  state.bellyWinkT = 1.0;
  if (loud) { sound.playPop(680); spawnParticle("heart", YO.button[0], YO.button[1] - 8); }
};
headPat = function () {
  if (state.mode === "sleep") { wake(); return; }
  state.springs.pat.vel = 220; state.blushPulse = 1.4;
  sound.playPop(580); spawnParticle("heart", YO.eyeL[0] - 6, YO.hairTop[1] - 6); spawnParticle("heart", YO.eyeR[0] + 8, YO.hairTop[1] - 4);
};
fidget = function () {
  const what = weighted([["look", 2], ["ear", 1.4], ["hair", 1], ["tail", 0.6], ["belly", 0.5], ["yawn", 0.8], ["jump", 0.35]]);
  if (what === "look") { state.gaze = { x: rand(3.5, 6) * (Math.random() < 0.5 ? -1 : 1), y: rand(-2.5, 2.5), until: state.t + rand(1.2, 2.2) }; }
  else if (what === "ear") twitchEar(Math.random() < 0.5 ? "L" : "R", false);
  else if (what === "hair") triggerGlassesPush(false);
  else if (what === "tail") wagTail(false);
  else if (what === "belly") winkBelly(false);
  else if (what === "jump") wiggleToes(false);
  else state.yawnT = 1.6;
};
