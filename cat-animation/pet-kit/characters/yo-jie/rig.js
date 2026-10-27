
// =====================================================================================================
// Yo 姐: built from her model sheet (source/make_character.py). Her standing figure is the body; the head
// nods and tilts, and her faces from the expression sheet are laid over it for blinking, beaming and sleep.
// Waving, drinking, the laptop, presenting the clock and the "Hooray!" jump are whole drawings from the
// sheet, faded in over her. "返工模式" puts her at her desk, with a neon 營業中 sign hanging from it.
// Nothing in the engine changes for any other character.
// =====================================================================================================
const YO = JSON.parse(rig.svg.dataset.joints);          // joint positions on the canvas, written by make_character.py
Object.assign(JOINT, {
  root: [304, 586], head: YO.head, earL: YO.earL, earR: YO.earR, zipper: YO.neck, tail: YO.braid,
  pawL: YO.handL, pawR: YO.handR, footL: [280, 580], footR: [330, 580], reach: [0, 0, 0],
  gaze: [(YO.eyeL[0] + YO.eyeR[0]) / 2 / 600, (YO.eyeL[1] + YO.eyeR[1]) / 2 / 630],
});
const yo = { jumpAt: -9, extra: null, extraAt: -9, office: store.get("office", false), forced: store.get("forced", false),
  officeW: store.get("office", false) ? 1 : 0, celebrateUntil: -9, deskW: {}, last: performance.now() };
const SVG_NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs, parent) => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
};

// ---------- framing: cropped close around her (bigger in the window); wider at the desk ----------
// the clock beside her is off until it is switched on (right-click menu or the studio's Desk Clock button)
if (store.get("deskClock", null) === null) state.deskClock = false;
const VIEW = { x: 160, y: 5, w: 320, wClock: 540, h: 595, officeX: 110, officeW: 420 };
fitView = function () {
  const x = yo.office ? VIEW.officeX : VIEW.x, w = yo.office ? VIEW.officeW : state.deskClock ? VIEW.wClock : VIEW.w;
  rig.svg.setAttribute("viewBox", `${x} ${VIEW.y} ${w} ${VIEW.h}`);
  rig.svg.classList.toggle("wide", state.deskClock || yo.office);
  JOINT.gaze = [((YO.eyeL[0] + YO.eyeR[0]) / 2 - x) / w, ((YO.eyeL[1] + YO.eyeR[1]) / 2 - VIEW.y) / VIEW.h];
};
function setOffice(on) {
  yo.office = on; store.set("office", on); fitView();
  const b = $("btn-office"); if (b) b.setAttribute("aria-pressed", String(on));
  hooks.onChange();
}

// ---------- the "Hooray!" jump, and short standing gestures (phone, thumbs up, pondering) ----------
const JUMP_TIME = 1.1, EXTRA_TIME = 3.4;
const jumpK = () => (state.t - yo.jumpAt) / JUMP_TIME;
const envelope = (k, edge) => (k > 0 && k < 1 ? smooth(k * edge) * smooth((1 - k) * edge) : 0);
const jumpShow = () => (yo.office ? 0 : envelope(jumpK(), 6));
const extraShow = () => (yo.office || !yo.extra ? 0 : envelope((state.t - yo.extraAt) / EXTRA_TIME, 5));
function gesture(name) {
  if (yo.office || state.mode !== "idle" || extraShow() > 0) return;
  yo.extra = name; yo.extraAt = state.t;
}
function hooray(o) {
  const k = jumpK();
  if (yo.office || !(k > 0 && k < 1)) return;
  const squash = k < 0.15 ? Math.sin((k / 0.15) * Math.PI) : 0;
  const air = k > 0.15 ? Math.sin(((k - 0.15) / 0.85) * Math.PI) : 0;
  o.rootY -= 40 * air; o.rootScaleX += 0.03 * squash; o.rootScaleY -= 0.05 * squash;
}

// ---------- 返工模式: which desk drawing fits what she is doing ----------
const DESK_POSES = ["think", "write", "coffee", "stretch", "asleep", "celebrate", "call"];
const deskEl = Object.fromEntries(["empty", ...DESK_POSES].map((n) => [n, $("yo-desk-" + n)]));
const officeEl = $("yo-office");
const DESK_FOR = {
  idle: [["think", "write"], ["stretch", "coffee", "think"]],          // [營業中, 被迫營業中]
  code: [["write", "think", "write", "call"], ["think", "stretch", "write"]],
  cocoa: [["coffee"], ["coffee"]], wave: [["call"], ["call"]], vibe: [["call"], ["stretch", "call"]],
  sleep: [["asleep"], ["asleep"]], clock: [["think"], ["think"]],
};
function deskPose() {
  if (state.t < yo.celebrateUntil) return "celebrate";
  const list = DESK_FOR[state.mode][yo.forced ? 1 : 0];
  return list[Math.floor(state.t / (yo.forced ? 8 : 6)) % list.length];
}

// ---------- every frame: fade the drawings in and out (the engine calls the sleeve updates each frame) ----------
const FIGS = ["wave", "cocoa", "code", "clock"], EXTRAS = ["phone", "thumbs", "ponder"];
const figEl = Object.fromEntries([...FIGS, ...EXTRAS, "jump"].map((m) => [m, $("yo-fig-" + m)]));
const baseEl = $("yo-base");
const setFade = (el, v) => { el.setAttribute("opacity", v.toFixed(3)); showEl(el, v > 0.001); };
function crossFade() {
  const now = performance.now(), dt = Math.min(0.1, (now - yo.last) / 1000); yo.last = now;
  yo.officeW = clamp(yo.officeW + (yo.office ? 1 : -1) * dt / 0.45, 0, 1);
  const off = smooth(yo.officeW), stand = 1 - off;
  const w = dbg.w || {}, jmp = jumpShow(), ext = extraShow();
  let sum = 0;
  for (const m of FIGS) {
    const v = smooth(((w[m] || 0) - 0.2) / 0.6) * (1 - jmp) * (1 - ext);
    sum += v; setFade(figEl[m], v * stand);
  }
  for (const m of EXTRAS) setFade(figEl[m], m === yo.extra ? ext * stand : 0);
  setFade(figEl.jump, jmp * stand);
  setFade(baseEl, clamp(1 - sum - jmp - ext, 0, 1) * stand);
  // the desk: the empty desk underneath, her pose drawings eased over it (the desk itself never moves)
  setFade(officeEl, off);
  if (off > 0.001) {
    const target = deskPose();
    for (const n of DESK_POSES) {
      yo.deskW[n] = clamp((yo.deskW[n] || 0) + (n === target ? 1 : -1) * dt / 0.35, 0, 1);
      setFade(deskEl[n], smooth(yo.deskW[n]));
    }
    setFade(deskEl.empty, 1);
  }
  heldClock.style.visibility = deskClock.style.visibility = off > 0.5 ? "hidden" : "";
  updateNeon(now / 1000, off);
}
updateLeftSleeveGeometry = () => {};
updateRightSleeveGeometry = () => { crossFade(); placeHeldClock(); };

// ---------- props: the laptop and mug are in the drawings; the clock stands on her open palm ----------
lapBack.style.visibility = "hidden";
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

// ---------- at the desk: a little clock on her notebooks, and the neon sign hanging from the desk ----------
const deskClockG = svgEl("g", { class: "hidden" }, officeEl);
deskClockG.innerHTML = CLOCK_ART;
const deskClockText = deskClockG.querySelector(".clock-time");
const NEON = { on: "營業中", forced: ["被迫", "營業中"] };
// the neon sign hangs on the wall behind her, up to the left of her head
const NEON_AT = [YO.deskHead[0] - 112, YO.deskHead[1] - 58];
const neon = svgEl("g", { id: "yo-neon", class: "hotspot", transform: `translate(${NEON_AT[0].toFixed(1)} ${NEON_AT[1].toFixed(1)})` }, officeEl);
officeEl.insertBefore(neon, deskEl.empty);                            // on the wall, behind the desk and her
neon.innerHTML = `
  <defs>
    <filter id="yo-neon-glow" x="-50%" y="-120%" width="200%" height="340%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="b1"/>
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.1" result="b2"/>
      <feMerge><feMergeNode in="b1"/><feMergeNode in="b1"/><feMergeNode in="b2"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="yo-neon-wash"><stop offset="0" stop-color="#ff3f9a" stop-opacity="0.32"/><stop offset="1" stop-color="#ff3f9a" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse id="yo-neon-halo" cx="0" cy="-2" rx="78" ry="34" fill="url(#yo-neon-wash)"/>
  <rect x="-62" y="-22" width="124" height="40" rx="7" fill="#1b1824" fill-opacity="0.92" stroke="#4a4458" stroke-width="1.2"/>
  <rect x="-58" y="-18" width="116" height="32" rx="5" fill="none" stroke="#ff3f9a" stroke-opacity="0.35" stroke-width="0.8"/>
  <circle cx="-56" cy="-16" r="1.4" fill="#b9b3c4"/><circle cx="56" cy="-16" r="1.4" fill="#b9b3c4"/>
  <text id="yo-neon-text" x="0" y="8" text-anchor="middle" font-family="'Noto Sans HK','PingFang HK','Microsoft JhengHei','Heiti TC',sans-serif"
        font-weight="900" font-size="26" letter-spacing="2" fill="#fff2f8" stroke="#ff3f9a" stroke-width="1.6" stroke-linejoin="round" paint-order="stroke" filter="url(#yo-neon-glow)"></text>`;
const neonText = neon.querySelector("#yo-neon-text"), neonHalo = neon.querySelector("#yo-neon-halo");
let neonShown = null, flicker = 1, flickerNext = 0;
function updateNeon(t, off) {
  if (off < 0.001) return;
  if (neonShown !== yo.forced) {
    neonShown = yo.forced;
    neonText.innerHTML = yo.forced ? `<tspan id="yo-neon-forced">${NEON.forced[0]}</tspan>${NEON.forced[1]}` : NEON.on;
    neonText.setAttribute("font-size", yo.forced ? "19" : "26");
  }
  const hum = 0.88 + Math.sin(t * 2.2) * 0.08;                      // a slow neon breath
  neonText.setAttribute("opacity", hum.toFixed(2)); neonHalo.setAttribute("opacity", (0.55 + hum * 0.45).toFixed(3));
  if (yo.forced) {                                                    // "被迫" buzzes like a failing tube
    if (t > flickerNext) { flicker = Math.random() < 0.35 ? rand(0.05, 0.35) : 1; flickerNext = t + (flicker < 1 ? rand(0.05, 0.14) : rand(0.2, 1.4)); }
    const f = neonText.querySelector("#yo-neon-forced"); if (f) f.setAttribute("opacity", flicker.toFixed(2));
  }
  // the clock on her notebooks: shown with the desk clock setting, and when she checks the time
  const showClock = state.deskClock || state.mode === "clock";
  showEl(deskClockG, showClock);
  if (showClock) {
    const now = new Date(), txt = clockText(now);
    deskClockText.innerHTML = `${txt.slice(0, 2)}<tspan fill-opacity="${now.getMilliseconds() < 600 ? 1 : 0.15}">:</tspan>${txt.slice(3)}`;
    const shake = state.ringT > 0 ? Math.sin(t * 60) * 6 * Math.min(1, state.ringT) : 0;
    deskClockG.setAttribute("transform", `translate(${YO.deskBooks[0]} ${YO.deskBooks[1]}) rotate(${shake.toFixed(1)}) scale(0.24) translate(-300 -482)`);
  }
}
// a tap on the sign switches it. The desktop pet captures the pointer for dragging, so the sign never gets a
// click of its own there: a press on the sign that is let go without moving counts as the tap.
function toggleNeon() {
  sound.init(); yo.forced = !yo.forced; store.set("forced", yo.forced);
  sound.playSparkle(); spawnParticle("sparkle", NEON_AT[0] + 50, NEON_AT[1] - 10);
}
neon.addEventListener("pointerdown", (e) => { if (e.button === 0) yo.neonDown = [e.screenX, e.screenY]; });
addEventListener("pointerup", (e) => {
  if (yo.neonDown && Math.hypot(e.screenX - yo.neonDown[0], e.screenY - yo.neonDown[1]) < 6) toggleNeon();
  yo.neonDown = null;
}, true);
neon.addEventListener("click", (e) => e.stopPropagation());           // not a wake-up tap on her
const officeBtn = $("btn-office");
if (officeBtn) {
  officeBtn.setAttribute("aria-pressed", String(yo.office));
  officeBtn.addEventListener("click", () => { setOffice(!yo.office); sound.playPop(yo.office ? 620 : 420); });
}
// the desktop app's right-click menu: 返工模式 and the sign
if (window.deskApp) window.deskApp.on("menu", (cmd) => {
  if (cmd === "office-on" || cmd === "office-off") setOffice(cmd === "office-on");
  else if (cmd === "neon") toggleNeon();
});

// ---------- her poses: the body breathes and sways, the head nods; the drawings carry the rest ----------
const POSES = {
  idle(o, t, b) {
    const breath = Math.sin(t * 2.0), late = Math.sin(t * 2.0 - 0.45), sway = Math.sin(t * 0.9);
    o.rootScaleX = 1 - breath * 0.004 * b; o.rootScaleY = 1 + breath * 0.006 * b;
    o.headX = sway * 0.8 * b; o.headY = -late * 1.0 * b; o.headRot = Math.sin(t * 1.0) * 2.0 * b;
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
    o.headX = side * 2.5 * b; o.headY = hg * 2.5 * b; o.headRot = -hg * 3 * b + side * 3.5 * b;
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
for (const [m, fn] of Object.entries(POSES)) MODES[m].pose = (o, t, b) => {
  fn(o, t, b); hooray(o);
  if (yo.office) { o.rootY = 0; o.rootScaleX = 1; o.rootScaleY = 1; }  // the desk never bounces
};
MODES.cocoa.mouth = "deadpan";                     // the drinking drawing has its own face
// particles come from where she is: standing, or at the desk
const at = (stand, desk) => (yo.office ? YO[desk] : YO[stand]);
MODES.wave.emit = (dt) => { if (Math.random() < 2.4 * dt) { const p = at("waveHand", "deskHead"); spawnParticle("sparkle", p[0] + (yo.office ? 90 : rand(-10, 10)), p[1] - 30); } };
MODES.cocoa.emit = () => { const p = at("mug", "deskHead"); spawnParticle("steam", p[0] + (yo.office ? 10 : 0), p[1] + (yo.office ? 70 : -8)); };
MODES.vibe.emit = () => {
  const p = at("hairTop", "deskHead");
  spawnParticle("note", p[0] - 50 + Math.random() * 110, p[1] - (yo.office ? 40 : 10));
  if (Math.random() < 0.45) { sound.playChord(CHORDS[state.chordStep % CHORDS.length]); state.chordStep++; }
};
MODES.sleep.emit = () => { const p = at("eyeR", "deskHead"); spawnParticle("zzz", p[0] + (yo.office ? -40 : 26), yo.office ? p[1] + 50 : YO.hairTop[1]); };
MODES.code.emit = () => { const p = at("laptop", "deskLaptop"); spawnParticle("code", p[0] - 30 + Math.random() * 60, p[1] - 40); };
MODES.clock.emit = (dt) => { if (!yo.office && Math.random() < 1.2 * dt) spawnParticle("sparkle", YO.palm[0] + rand(-25, 25), YO.palm[1] - 60); };

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
wiggleToes = function (loud = true) {             // "Hooray!" (at the desk: fists up in her chair)
  if (yo.office) { if (state.t < yo.celebrateUntil) return; yo.celebrateUntil = state.t + 2.2; }
  else { if (jumpK() < 1) return; yo.jumpAt = state.t; }
  state.blushPulse = 1;
  if (loud) sound.playBoing();
  const p = yo.office ? YO.deskHead : [304, 120];
  spawnParticle("sparkle", p[0] - 90, p[1] - 30); spawnParticle("sparkle", p[0] + 90, p[1] - 30); spawnParticle("sparkle", p[0] + 110, p[1] + 50);
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
  const p = yo.office ? [YO.deskHead[0] - 15, YO.deskHead[1] - 40] : [YO.eyeL[0] - 6, YO.hairTop[1] - 6];
  sound.playPop(580); spawnParticle("heart", p[0], p[1]); spawnParticle("heart", p[0] + 40, p[1] + 2);
};
fidget = function () {
  const what = weighted([["look", 2], ["ear", 1.2], ["hair", 0.8], ["tail", 0.5], ["belly", 0.4], ["yawn", 0.7], ["jump", 0.3],
    ["phone", 0.7], ["thumbs", 0.5], ["ponder", 0.6]]);
  if (what === "look") { state.gaze = { x: rand(3.5, 6) * (Math.random() < 0.5 ? -1 : 1), y: rand(-2.5, 2.5), until: state.t + rand(1.2, 2.2) }; }
  else if (what === "ear") twitchEar(Math.random() < 0.5 ? "L" : "R", false);
  else if (what === "hair") triggerGlassesPush(false);
  else if (what === "tail") wagTail(false);
  else if (what === "belly") winkBelly(false);
  else if (what === "jump") wiggleToes(false);
  else if (EXTRAS.includes(what)) gesture(what);
  else state.yawnT = 1.6;
};

// ---------- desktop pet: taps on her parts ----------
// The desktop pet captures the pointer so she can be dragged, which sends the click to the whole picture instead
// of the part under the finger. A press that is let go without moving is passed on to that part as a click.
if (typeof DESK !== "undefined") {
  let down = null;
  rig.svg.addEventListener("pointerdown", (e) => { if (e.button === 0) down = { x: e.screenX, y: e.screenY, el: e.target }; }, true);
  addEventListener("pointerup", (e) => {
    const d = down; down = null;
    if (!d || Math.hypot(e.screenX - d.x, e.screenY - d.y) >= 6 || d.el === rig.svg) return;
    setTimeout(() => d.el.dispatchEvent(new MouseEvent("click", { bubbles: true })), 0);
  }, true);
}
