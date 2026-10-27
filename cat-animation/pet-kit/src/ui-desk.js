// ---------- desktop pet front end ----------
// The window is transparent and lets clicks through everywhere except on him. Drag him to move the window,
// right-click for the menu. The main process sends the cursor position (so his eyes follow it across the
// whole screen) and the menu choices.
const desk = window.deskApp || { moveBy() {}, setIgnore() {}, showMenu() {}, setWide() {}, on() {} };

// clicks pass through the empty parts of the window
let ignoring = null;
const overHim = (x, y) => { const el = document.elementFromPoint(x, y); return !!el && el !== rig.svg && rig.svg.contains(el) && el.closest("#rig-root") !== null && el.closest("#particles-layer") === null; };
function setIgnore(v) { if (v !== ignoring) { ignoring = v; desk.setIgnore(v); } }
addEventListener("mousemove", (e) => { if (!drag) setIgnore(!overHim(e.clientX, e.clientY)); });
addEventListener("mouseleave", () => { if (!drag) setIgnore(true); });

// drag to move; a press without moving is a tap
let drag = null, dragged = false;
rig.svg.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  drag = { x: e.screenX, y: e.screenY, moved: 0 }; dragged = false;
  rig.svg.setPointerCapture(e.pointerId);
});
rig.svg.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dx = e.screenX - drag.x, dy = e.screenY - drag.y;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.moved > 5) {
    if (!dragged) { dragged = true; rig.svg.classList.add("grabbing"); state.springs.earL.vel = -220; state.springs.earR.vel = 220; }
    desk.moveBy(dx, dy); drag.x = e.screenX; drag.y = e.screenY;
    state.surpriseT = 0.25;                                   // "whoa" while he is carried
    state.springs.foot.vel += clamp(dx, -40, 40) * 3;         // feet dangle as he swings
  }
});
const endDrag = () => { drag = null; rig.svg.classList.remove("grabbing"); };
rig.svg.addEventListener("pointerup", endDrag);
rig.svg.addEventListener("pointercancel", endDrag);
// a drag is not a tap
addEventListener("click", (e) => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } }, true);

// right-click: the menu (built by the main process, in Cantonese)
addEventListener("contextmenu", (e) => {
  e.preventDefault();
  desk.showMenu({ mode: state.mode, auto: autopilot.on, sound: sound.enabled, eyes: state.eyeTracking, deskClock: state.deskClock });
});
desk.on("menu", (cmd) => {
  sound.init();
  if (MODES[cmd]) {
    if (state.mode === "sleep" && cmd !== "sleep") { setAuto(false); wake(); if (cmd !== "idle") setMode(cmd, { quietButton: true }); }
    else setMode(cmd, { manual: true });
  } else if (cmd === "auto") setAuto(!autopilot.on);
  else if (cmd === "pat") headPat();
  else if (cmd === "glasses") triggerGlassesPush();
  else if (cmd === "toes") wiggleToes();
  else if (cmd === "deskclock") { setDeskClock(!state.deskClock); desk.setWide?.(state.deskClock); }
  else if (cmd === "sound") { sound.enabled = !sound.enabled; store.set("sound", sound.enabled); if (sound.enabled) sound.playPop(600); }
  else if (cmd === "eyes") { state.eyeTracking = !state.eyeTracking; store.set("eyes", state.eyeTracking); }
});
// the cursor anywhere on screen, in this window's coordinates
desk.on("cursor", (p) => onPointer(p.x, p.y));

// sound starts off on the desktop (the lo-fi chords would play by themselves)
sound.enabled = store.get("sound", false);
setIgnore(true);
fitView(); desk.setWide?.(state.deskClock);
setAuto(autopilot.on);
window.__studio = { state, autopilot, setMode, tick, dbg, MODES };
requestAnimationFrame(frame);
