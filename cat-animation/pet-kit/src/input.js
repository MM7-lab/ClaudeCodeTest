// ---------- input ----------
function onPointer(x, y) {
  const r = rig.svg.getBoundingClientRect();
  const dx = (x - (r.left + r.width * JOINT.gaze[0])) / (r.width * 0.5), dy = (y - (r.top + r.height * JOINT.gaze[1])) / (r.height * 0.5);
  state.eye.tx = clamp(dx * 6, -6.5, 6.5); state.eye.ty = clamp(dy * 4.5, -4.5, 4.5);
  state.eye.lastPointer = state.t;
}
addEventListener("pointermove", (e) => onPointer(e.clientX, e.clientY), { passive: true });

// any tap on him while he sleeps wakes him first; otherwise each part has its own reaction
const tap = (el, fn) => el.addEventListener("click", (e) => { e.stopPropagation(); sound.init(); if (state.mode === "sleep") wake(); else fn(); });
tap(rig.earLeft, () => twitchEar("L"));
tap(rig.earRight, () => twitchEar("R"));
tap(rig.glasses, () => triggerGlassesPush());
tap(rig.bellyBear, () => winkBelly());
tap(rig.tail, () => wagTail());
tap(rig.legRight, () => wiggleToes());
tap(rig.legLeft, () => wiggleToes());
tap(rig.head, headPat);                                                   // the face or hood: a pat
rig.svg.addEventListener("click", () => { if (state.mode === "sleep") wake(); });   // anywhere else on him wakes him up

