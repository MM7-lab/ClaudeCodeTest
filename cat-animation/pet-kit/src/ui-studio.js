// ---------- the studio page's controls ----------
let shownMouth = "";
hooks.onChange = () => {
  $("btn-auto").setAttribute("aria-pressed", String(autopilot.on));
  $("btn-deskclock").setAttribute("aria-pressed", String(state.deskClock));
  $("status-text").textContent = MODES[state.mode].label + (autopilot.on ? " · Auto" : "");
  $("status-dot").classList.toggle("manual", !autopilot.on);
  document.querySelectorAll(".mode").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.anim === state.mode)));
};
// the expression buttons show the mouth he is actually making
setInterval(() => {
  if (state.mouth === shownMouth) return;
  shownMouth = state.mouth;
  document.querySelectorAll(".expr").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.expr === shownMouth)));
}, 100);
fitView();
$("btn-deskclock").addEventListener("click", () => { setDeskClock(!state.deskClock); sound.playPop(state.deskClock ? 620 : 420); });
$("btn-push-glasses").addEventListener("click", () => triggerGlassesPush());
$("btn-happy-jump").addEventListener("click", () => wiggleToes());
$("btn-pet").addEventListener("click", headPat);
document.querySelectorAll(".mode").forEach((b) => b.addEventListener("click", () => {
  sound.init();
  if (b.dataset.anim === state.mode && state.mode !== "sleep") return;
  if (state.mode === "sleep" && b.dataset.anim !== "sleep") { setAuto(false); wake(); if (b.dataset.anim !== "idle") setMode(b.dataset.anim, { quietButton: true }); return; }
  setMode(b.dataset.anim, { manual: true });
}));
document.querySelectorAll(".expr").forEach((b) => b.addEventListener("click", () => { sound.playPop(500); state.exprOverride = b.dataset.expr; }));
$("btn-auto").addEventListener("click", () => { setAuto(!autopilot.on); sound.playPop(autopilot.on ? 620 : 420); });

function setSound(on) {
  sound.enabled = on; store.set("sound", on);
  $("btn-sound").setAttribute("aria-pressed", String(on));
  $("label-sound").textContent = on ? "SFX On" : "Muted";
}
$("btn-sound").addEventListener("click", () => { setSound(!sound.enabled); if (sound.enabled) sound.playPop(600); });
setSound(store.get("sound", true));
function setEyes(on) { state.eyeTracking = on; store.set("eyes", on); $("btn-eyetrack").setAttribute("aria-pressed", String(on)); }
$("btn-eyetrack").addEventListener("click", () => { setEyes(!state.eyeTracking); sound.playPop(480); });
setEyes(state.eyeTracking);

const speed = $("slider-speed"), bounce = $("slider-bounce");
const showSpeed = () => { state.speed = parseFloat(speed.value); $("val-speed").textContent = state.speed.toFixed(1) + "x"; };
const showBounce = () => { state.bounceScale = parseInt(bounce.value, 10) / 100; $("val-bounce").textContent = bounce.value + "%"; };
speed.addEventListener("input", showSpeed); bounce.addEventListener("input", showBounce);
$("btn-reset-sliders").addEventListener("click", () => { speed.value = 1; bounce.value = reduceMotion ? 60 : 100; showSpeed(); showBounce(); sound.playPop(520); });
if (reduceMotion) { bounce.value = 60; showBounce(); }

const SCENES = { sketch: ["#f8f6f1", "#dfdbd0"], snow: ["#e6f0f7", "#c9dce8"], night: ["#272430", "#191720"], matcha: ["#e6ede3", "#cbd6c6"] };
function setScene(name) {
  if (!SCENES[name]) name = "sketch";
  $("stage-container").style.backgroundColor = SCENES[name][0];
  $("stage-container").classList.toggle("night", name === "night");
  rig.shadow.setAttribute("fill", SCENES[name][1]);
  document.querySelectorAll(".scene-btn").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.scene === name)));
  store.set("scene", name);
}
document.querySelectorAll(".scene-btn").forEach((b) => b.addEventListener("click", () => { sound.playPop(460); setScene(b.dataset.scene); }));
setScene(store.get("scene", "sketch"));

setAuto(autopilot.on);
updateStatus();
window.__studio = { state, autopilot, setMode, tick, dbg, MODES };
requestAnimationFrame(frame);
