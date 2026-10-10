/* ============================================================================
   App: sculpting, scene, camera, input, physics loop, editions & actions, UI,
   and loading your own model.
   ========================================================================== */
const $ = id => document.getElementById(id);
const PART = { BODY: 1, HEAD: 2, ARM: 3, BASE: 4, MODEL: 5, ACC: 6, STEAM: 7 };
const HEAD_LIM = { p: [-28 * DEG, 24 * DEG], y: [-48 * DEG, 48 * DEG], r: [-20 * DEG, 20 * DEG] };
const ARM_LIM = { p: [-75 * DEG, 30 * DEG], y: [-45 * DEG, 45 * DEG], r: [-35 * DEG, 35 * DEG] };
const SCULPT_BASE_R = 4.4;
const EDITIONS = {
  A: { label: 'Knight Edition · longsword', action: 'Salute' },
  B: { label: 'Tea Break Edition · milk tea with clear steam', action: 'Sip' },
};

function eulerFromQuat(q) { // inverse of quat.euler (q = Ry * Rx * Rz)
  const m = quat.toM3(q);
  return { p: Math.asin(clamp(-m[5], -1, 1)), y: Math.atan2(m[2], m[8]), r: Math.atan2(m[3], m[4]) };
}
function arcQuat(a, b) { // shortest rotation taking direction a to direction b
  const u = v3.norm(a), v = v3.norm(b), d = v3.dot(u, v);
  if (d < -0.9999) return quat.axisAngle(Math.abs(u[0]) < 0.9 ? v3.cross(u, [1, 0, 0]) : v3.cross(u, [0, 1, 0]), Math.PI);
  const c = v3.cross(u, v);
  return quat.norm([c[0], c[1], c[2], 1 + d]);
}
const ease = t => t * t * (3 - 2 * t);

const App = {
  R: null, body: new FigureBody(),
  mode: 'sculpt', edition: 'A', fixed: true, spin: false, pose: false,
  action: { on: false, t: 0 }, puffTimer: 0,
  head: { p: 0, y: 0, r: 0 }, arm: { p: 0, y: 0, r: 0 }, wrist: quat.ident(),
  cam: { yaw: 0.42, pitch: 0.2, dist: 46, fov: 28 * DEG, target: [0, 6.6, 0], dist0: 46, ty0: 6.6 },
  spinYaw: 0, blend: null, puffs: [], sculpt: null, model: null, baseR: SCULPT_BASE_R,
  ptr: new Map(), drag: null, keyFrames: null, time: 0,
};
window.__fig = App; // debugging / automated checks

/* ---------------- boot ---------------- */
(async function boot() {
  const canvas = $('gfx');
  const R = App.R = new Renderer();
  try { await R.init(canvas, !!window.__FIG_OFFSCREEN); } catch (e) {
    $('loading').hidden = true; $('nogpu').hidden = false;
    if (e.message === 'no-adapter') $('nogpuText').textContent = 'Your browser supports WebGPU but no compatible graphics adapter was found. Try another browser or device, or enable hardware acceleration.';
    console.error(e); return;
  }
  R.onLost = info => { $('nogpu').hidden = false; $('nogpuText').textContent = 'The graphics device was lost (' + (info.message || info.reason) + '). Reload the page to continue.'; };
  resize();
  new ResizeObserver(resize).observe(document.body);
  App.baseMesh = makeBase(SCULPT_BASE_R);
  App.baseDraw = R.makeDraw();
  App.puffDraws = Array.from({ length: 18 }, () => R.makeDraw());
  wireUI();
  requestAnimationFrame(frame);
  await sculpt();
})();

function resize() {
  const c = $('gfx'), dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
  const maxPix = 3.2e6;
  if (w * h > maxPix) { const k = Math.sqrt(maxPix / (w * h)); w = Math.round(w * k); h = Math.round(h * k); }
  c.width = w; c.height = h;
  App.R.resize(w, h);
}

function makeBase(R) {
  const g = baseGeometry(R);
  return App.R.makeMesh(packVertices(g.positions, g.normals, { mat: MAT.CLEAR }), g.indices, null);
}

/* ---------------- sculpt ---------------- */
// Mesh the sculpt parts in parallel Web Workers (fallback: main thread).
const PART_ORDER = [['body', 0.42], ['head', 0.3], ['arm', 0.06], ['accSword', 0.1], ['accCup', 0.07], ['steam', 0.05]];
const WORKER_TAIL = `
self.onmessage = async e => {
  const name = e.data.name;
  const { parts, aoSDF } = sculptKnightKitten();
  const p = parts[name];
  const ao = name === 'steam' ? null : (name.startsWith('acc') ? SDF.union(aoSDF, p.sdf) : aoSDF);
  const r = await meshSDF(p.sdf, p.bounds[0], p.bounds[1], p.h, { ao, progress: f => self.postMessage({ name, progress: f }) });
  self.postMessage({ name, result: r }, [r.positions.buffer, r.normals.buffer, r.mats.buffer, r.ao.buffer, r.indices.buffer]);
};`;
async function meshAllParts(onProgress) {
  const prog = Object.fromEntries(PART_ORDER.map(([n]) => [n, 0]));
  const report = () => onProgress(PART_ORDER.reduce((a, [n, w]) => a + prog[n] * w, 0));
  const src = document.getElementById('coreSrc')?.textContent;
  if (src && window.Worker && !window.__FIG_NOWORKERS) {
    try {
      const url = URL.createObjectURL(new Blob([src, WORKER_TAIL], { type: 'text/javascript' }));
      const n = clamp((navigator.hardwareConcurrency || 4) - 1, 1, PART_ORDER.length);
      const queue = PART_ORDER.map(([name]) => name), out = {};
      await Promise.all(Array.from({ length: n }, () => new Promise((resolve, reject) => {
        const w = new Worker(url);
        const next = () => { const name = queue.shift(); if (!name) { w.terminate(); resolve(); return; } w.postMessage({ name }); };
        w.onmessage = e => {
          const m = e.data;
          if (m.result) { out[m.name] = m.result; prog[m.name] = 1; report(); next(); }
          else { prog[m.name] = m.progress; report(); }
        };
        w.onerror = ev => { w.terminate(); reject(ev.message || 'worker failed'); };
        next();
      })));
      URL.revokeObjectURL(url);
      return out;
    } catch (e) { console.warn('Workers unavailable, sculpting on the main thread:', e); }
  }
  const { parts, aoSDF } = sculptKnightKitten(), out = {};
  for (const [name] of PART_ORDER) {
    const p = parts[name];
    const ao = name === 'steam' ? null : (name.startsWith('acc') ? SDF.union(aoSDF, p.sdf) : aoSDF);
    out[name] = await meshSDF(p.sdf, p.bounds[0], p.bounds[1], p.h, { ao, progress: f => { prog[name] = f; report(); } });
    prog[name] = 1; report();
  }
  return out;
}

async function sculpt() {
  const t0 = performance.now();
  const meshes = await meshAllParts(f => setLoading(f, 'Sculpting'));
  const R = App.R;
  const gpu = {};
  for (const [name, m] of Object.entries(meshes)) gpu[name] = R.makeMesh(packVertices(m.positions, m.normals, { mats: m.mats }), m.indices, m.ao);
  const draws = {};
  for (const k of Object.keys(gpu)) draws[k] = R.makeDraw();
  // physics shape from the rest pose
  const clouds = ['body', 'head', 'arm', 'accSword'].map(k => meshes[k].positions);
  const box = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (const k of ['body', 'head']) { const P = meshes[k].positions; for (let i = 0; i < P.length; i += 3) for (let c = 0; c < 3; c++) { box[c] = Math.min(box[c], P[i + c]); box[c + 3] = Math.max(box[c + 3], P[i + c]); } }
  App.sculpt = {
    gpu, draws, box,
    hull: { A: hullPoints(clouds, SCULPT_BASE_R), B: hullPoints(['body', 'head', 'arm', 'accCup'].map(k => meshes[k].positions), SCULPT_BASE_R) },
    stats: Object.fromEntries(Object.entries(meshes).map(([k, m]) => [k, { verts: m.vertexCount, tris: m.indices.length / 3 }])),
    ms: Math.round(performance.now() - t0),
  };
  App.keyFrames = buildKeyframes();
  App.probes = buildPoseProbes(meshes);
  useSculptShape();
  resetFigure();
  $('loading').hidden = true;
  App.ready = true;
}

function useSculptShape() {
  App.baseR = SCULPT_BASE_R;
  App.R.destroyMesh(App.baseMesh); App.baseMesh = makeBase(SCULPT_BASE_R);
  const { com, Ib } = figureInertia(SCULPT_BASE_R, App.sculpt.box);
  App.body.setShape(com, Ib, App.sculpt.hull[App.edition]);
  App.body.restY = 0.6;
  App.cam.dist0 = 46; App.cam.ty0 = 6.6;
}

function setLoading(f, label) {
  $('loadingBar').style.width = (clamp(f, 0, 1) * 100).toFixed(1) + '%';
  $('loadingText').textContent = `${label} · ${Math.round(clamp(f, 0, 1) * 100)}%`;
}

/* ---------------- joints & actions ---------------- */
const qHead = () => quat.euler(App.head.p, App.head.y, App.head.r);
const qArm = () => quat.euler(App.arm.p, App.arm.y, App.arm.r);
function clampJoint(j, L) { j.p = clamp(j.p, L.p[0], L.p[1]); j.y = clamp(j.y, L.y[0], L.y[1]); j.r = clamp(j.r, L.r[0], L.r[1]); }
// Pose mode keeps the held prop level (sword mostly upright, tea fully level) as the arm swings.
function autoWrist() { return quat.slerp(quat.ident(), quat.conj(qArm()), App.edition === 'B' ? 1 : 0.85); }

// Collision probes: surface points of the forearm, paw and held prop that are clear of the body and head at
// rest. A pose drag that would push any of them inside the body or the (posed) head is refused, so posing
// never makes parts pass through each other.
function buildPoseProbes(meshes) {
  const { parts } = sculptKnightKitten();
  const bf = parts.body.sdf.f, hf = parts.head.sdf.f, ap = FIG.armPivot;
  const body = p => bf(p[0], p[1], p[2]), head = p => hf(p[0], p[1], p[2]);
  const sample = (P, n, keep) => {
    const out = [], cnt = P.length / 3, step = Math.max(1, Math.floor(cnt / (n * 4)));
    for (let i = 0; i < cnt; i += step) {
      const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
      if (keep(p) && Math.min(body(p), head(p)) > 0.04) out.push(p);
    }
    const stride = Math.max(1, out.length / n);
    return Array.from({ length: Math.min(n, out.length) }, (_, k) => out[Math.floor(k * stride)]);
  };
  const farFromShoulder = p => v3.len(v3.sub(p, ap)) > 2.1; // the upper arm turns inside the pauldron
  return {
    body, head,
    arm: sample(meshes.arm.positions, 90, farFromShoulder),
    A: sample(meshes.accSword.positions, 360, () => true),
    B: [...sample(meshes.accCup.positions, 160, () => true), ...sample(meshes.steam.positions, 90, () => true)],
  };
}
function posePenetrates() {
  const P = App.probes;
  if (!P || App.mode !== 'sculpt') return false;
  const hp = FIG.headPivot, ap = FIG.armPivot, pw = FIG.paw, qh = quat.conj(qHead()), qa = qArm(), qw = App.wrist;
  const hit = w => P.body(w) < -0.02 || P.head(v3.add(hp, quat.rotate(qh, v3.sub(w, hp)))) < -0.02;
  const armX = p => v3.add(ap, quat.rotate(qa, v3.sub(p, ap)));
  for (const p of P.arm) if (hit(armX(p))) return true;
  for (const p of P[App.edition]) if (hit(armX(v3.add(pw, quat.rotate(qw, v3.sub(p, pw)))))) return true;
  return false;
}

function mouthAt(headQ) { const hp = FIG.headPivot; return v3.add(hp, quat.rotate(headQ, v3.sub([0, 7.92, 2.95], hp))); }

// Joint targets for the key poses of each action.
function buildKeyframes() {
  const S = FIG.armPivot, P = FIG.paw, a = v3.sub(P, S), la = v3.len(a);
  // Salute: hilt in front of the chin, blade upright and tilted slightly forward.
  const pawUp = v3.add(S, v3.mul(v3.norm(v3.sub([-0.45, 6.35, 3.6], S)), la));
  const sQ = arcQuat(a, v3.sub(pawUp, S));
  const bladeQ = arcQuat(FIG.grip, [0.02, 1, 0.16]);
  const salute = { arm: eulerFromQuat(sQ), wrist: quat.mul(quat.conj(sQ), bladeQ), head: { p: 0.1, y: 0, r: 0 } };
  // Sip: search the cup tilt that lets the rim reach the mouth with this arm length.
  const headSip = { p: -0.16, y: 0, r: 0 };
  const mouth = mouthAt(quat.euler(headSip.p, headSip.y, headSip.r));
  const rimNear = v3.add(FIG.cup, [0, 0.62, -0.6]), r = v3.sub(rimNear, P);
  let best = null;
  for (let lean = 15; lean <= 65; lean += 2.5) for (let yaw = -70; yaw <= 70; yaw += 5) {
    const L = quat.mul(quat.axisAngle([0, 1, 0], yaw * DEG), quat.axisAngle([1, 0, 0], -lean * DEG));
    const b = v3.sub(v3.sub(mouth, S), quat.rotate(L, r));
    const err = Math.abs(v3.len(b) - la) + Math.abs(lean - 40) * 0.004 + Math.abs(yaw) * 0.002;
    if (!best || err < best.err) best = { err, L, b };
  }
  const sipQ = arcQuat(a, best.b);
  const sip = { arm: eulerFromQuat(sipQ), wrist: quat.mul(quat.conj(sipQ), best.L), head: headSip };
  return { salute, sip, sipErr: best.err };
}

const REST = { arm: { p: 0, y: 0, r: 0 }, wrist: quat.ident(), head: { p: 0, y: 0, r: 0 } };
function lerpPose(A, B, t) {
  const L = (x, y) => ({ p: mix(x.p, y.p, t), y: mix(x.y, y.y, t), r: mix(x.r, y.r, t) });
  return { arm: L(A.arm, B.arm), wrist: quat.slerp(A.wrist, B.wrist, t), head: L(A.head, B.head) };
}
// Piecewise timeline: [time, pose] keys, eased between.
function samplePose(keys, t) {
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, p0] = keys[i], [t1, p1] = keys[i + 1];
    if (t >= t0 && t <= t1) return lerpPose(p0, p1, ease((t - t0) / Math.max(t1 - t0, 1e-6)));
  }
  return keys[keys.length - 1][1];
}
function actionTimeline() {
  const K = App.keyFrames;
  if (App.edition === 'A') {
    const up = K.salute, nod = { ...up, head: { p: 0.3, y: 0, r: 0 } };
    return { len: 4.8, keys: [[0, REST], [0.9, up], [1.3, up], [1.65, nod], [2.0, up], [2.7, up], [3.6, REST], [4.8, REST]] };
  }
  const sip = K.sip, sipMore = { ...sip, head: { p: sip.head.p - 0.06, y: 0, r: 0 } };
  const sigh = { ...REST, head: { p: -0.38, y: 0, r: 0.04 } };
  return { len: 6.6, keys: [[0, REST], [1.1, sip], [1.5, sipMore], [2.3, sipMore], [3.1, REST], [3.6, sigh], [4.9, sigh], [5.7, REST], [6.6, REST]], puffAt: 3.75 };
}
function applyPose(p) { Object.assign(App.arm, p.arm); App.wrist = p.wrist; Object.assign(App.head, p.head); }

function spawnPuff() {
  const m = mouthAt(qHead()), base = v3.add(App.body.toWorld(m), [0, 0.1, 0.25]);
  const R3 = App.body.R();
  const fwd = v3.norm(m3.mulV(R3, [0, 0.55, 1]));
  const blobs = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 2.39996;
    blobs.push({ off: [Math.cos(a) * 0.35 * (i ? 1 : 0), Math.sin(a * 1.3) * 0.25 * (i ? 1 : 0), Math.sin(a) * 0.35 * (i ? 1 : 0)], r: i ? 0.42 + 0.12 * Math.sin(i * 3.1) : 0.6, ph: i * 0.7 });
  }
  App.puffs.push({ p: base, v: v3.mul(fwd, 2.2), age: 0, life: 3.2, blobs });
  if (App.puffs.length > 2) App.puffs.shift();
}

/* ---------------- figure state ---------------- */
function resetFigure() {
  const b = App.body, rp = b.restPose(App.fixed ? App.spinYaw : 0);
  b.setPose(rp.x, rp.q); b.stop(); b.grab = null; b.asleep = true; App.blend = null;
  if (!App.action.on) { App.head = { p: 0, y: 0, r: 0 }; App.arm = { p: 0, y: 0, r: 0 }; App.wrist = quat.ident(); }
}
function dropFigure() {
  if (App.fixed) return;
  const b = App.body, yaw = Math.random() * 6.28;
  let q = quat.mul(quat.axisAngle([0, 1, 0], yaw), quat.axisAngle(v3.norm([Math.random() - 0.5, 0, Math.random() - 0.5]), (8 + Math.random() * 22) * DEG));
  b.setPose(v3.add([b.x[0] * 0.3, 16 + b.com[1], b.x[2] * 0.3], [0, 0, 0]), q);
  b.v = [0, 0, 0]; b.w = [(Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.2];
  b.wake();
}
function setFixed(on) {
  App.fixed = on;
  $('fixedBtn').setAttribute('aria-pressed', String(on));
  $('dropBtn').disabled = on;
  App.body.grab = null;
  if (on) {
    // glide back to the planted pose
    const b = App.body, yaw = eulerFromQuat(b.q).y;
    App.spinYaw = Math.abs(eulerFromQuat(b.q).p) < 0.3 ? yaw : 0;
    const rp = b.restPose(App.spinYaw);
    App.blend = { x0: b.x.slice(), q0: b.q.slice(), x1: rp.x, q1: rp.q, t: 0 };
    b.stop(); b.asleep = true;
  } else {
    App.blend = null; App.body.wake();
  }
  updateHint();
}

// Automated checks: render the current state and show it in a 2D overlay so page screenshots work headless.
App.snapshot = async () => {
  render();
  const { w, h, data } = await App.R.readPixels();
  let c = document.getElementById('snap');
  if (!c) { c = document.createElement('canvas'); c.id = 'snap'; c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none'; document.body.insertBefore(c, document.querySelector('.ui')); }
  c.width = w; c.height = h;
  c.getContext('2d').putImageData(new ImageData(data, w, h), 0, 0);
};

/* ---------------- frame loop ---------------- */
let lastT = 0, acc = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min((ts - lastT) / 1000 || 0, 0.05);
  lastT = ts;
  App.time += dt;
  if (App.ready) update(dt);
  if (!window.__FIG_OFFSCREEN) render();   // automated checks render explicitly via App.snapshot()
}

function update(dt) {
  const b = App.body;
  if (App.spin) {
    if (App.fixed) App.spinYaw += dt * 0.45;
    else App.cam.yaw -= dt * 0.35;
  }
  if (App.fixed) {
    if (App.blend) {
      const B = App.blend; B.t += dt / 0.6;
      const k = ease(Math.min(B.t, 1));
      b.setPose(v3.lerp(B.x0, B.x1, k), quat.slerp(B.q0, B.q1, k));
      if (B.t >= 1) App.blend = null;
    } else {
      const rp = b.restPose(App.spinYaw);
      b.setPose(rp.x, rp.q);
    }
  } else {
    acc += dt;
    const h = 1 / 240;
    let n = 0;
    while (acc >= h && n < 24) { b.step(h); acc -= h; n++; }
    if (n === 24) acc = 0;
  }
  // actions (sculpt only)
  if (App.mode === 'sculpt' && App.action.on && !App.pose) {
    const tl = actionTimeline();
    const prev = App.action.t;
    App.action.t = (App.action.t + dt) % tl.len;
    applyPose(samplePose(tl.keys, App.action.t));
    if (tl.puffAt !== undefined && prev < tl.puffAt && App.action.t >= tl.puffAt) spawnPuff();
  }
  for (const p of App.puffs) {
    p.age += dt;
    p.v = v3.mul(p.v, 1 - 0.6 * dt);
    p.v[1] += 0.9 * dt;
    p.p = v3.madd(p.p, p.v, dt);
  }
  App.puffs = App.puffs.filter(p => p.age < p.life);
  // camera follows the figure
  const c = App.cam, fx = b.x[0], fz = b.x[2];
  const ty = clamp(b.x[1] + 2.5, App.cam.ty0 - 1, App.cam.ty0 + 22);
  const k = 1 - Math.exp(-dt * 4);
  c.target = App.camLock ? App.camLock.slice() : v3.lerp(c.target, [fx, App.fixed ? App.cam.ty0 : ty, fz], k);
}

function cameraMatrices() {
  const c = App.cam, R = App.R;
  const eye = [c.target[0] + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist, c.target[1] + Math.sin(c.pitch) * c.dist, c.target[2] + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist];
  const proj = m4.perspective(c.fov, R.w / R.h, 1, 400);
  const view = m4.lookAt(eye, c.target, [0, 1, 0]);
  return { eye, view, proj, vp: m4.mul(proj, view) };
}

function partMatrices() {
  const root = App.body.matrix();
  const around = (pivot, q) => m4.mul(m4.translate(pivot), m4.mul(m4.fromQuat(q), m4.translate(v3.mul(pivot, -1))));
  const head = m4.mul(root, around(FIG.headPivot, qHead()));
  const arm = m4.mul(root, around(FIG.armPivot, qArm()));
  const acc = m4.mul(arm, around(FIG.paw, App.wrist));
  return { root, head, arm, acc };
}

function render() {
  const f = prepareScene();
  if (f) App.R.render(f);
}
// Write every draw's uniforms for the current state and collect the draw lists.
function prepareScene() {
  const R = App.R;
  if (!R.w) return null;
  const cam = cameraMatrices();
  App.lastCam = cam;
  const opaque = [], transparent = [], casters = [], pickables = [];
  const b = App.body;
  const finish = App.finish || 1;
  if (App.ready) {
    const M = partMatrices();
    App.lastMats = M;
    if (App.mode === 'sculpt') {
      const S = App.sculpt, accKey = App.edition === 'A' ? 'accSword' : 'accCup';
      const items = [['body', M.root, 2, PART.BODY], ['head', M.head, 1, PART.HEAD], ['arm', M.arm, 3, PART.ARM], [accKey, M.acc, 3, PART.ACC]];
      for (const [k, m, set, id] of items) {
        R.writeDraw(S.draws[k], m, [set, id, 0, 0]);
        const it = { mesh: S.gpu[k], draw: S.draws[k] };
        opaque.push(it); casters.push(it); pickables.push(it);
      }
      if (App.edition === 'B') {
        R.writeDraw(S.draws.steam, M.acc, [0, PART.STEAM, 0, 0], [1, 1, 1, 1], [1, 0, 0, 0]);
        transparent.push({ mesh: S.gpu.steam, draw: S.draws.steam, kind: 'clear', z: 0 });
      }
    } else if (App.model) {
      for (const sm of App.model.gpu) {
        R.writeDraw(sm.draw, M.root, [0, PART.MODEL, finish, sm.useTint ? 1 : 0], App.paintLin || [0.7, 0.62, 0.52, 1], [1, 0, sm.alphaCutoff || 0, 0]);
        const it = { mesh: sm.mesh, draw: sm.draw, twoSided: true };
        opaque.push(it); casters.push(it); pickables.push(it);
      }
    }
    R.writeDraw(App.baseDraw, M.root, [0, PART.BASE, 0, 0], [1, 1, 1, 1], [1, App.baseR, 0, 0]);
    const baseIt = { mesh: App.baseMesh, draw: App.baseDraw, kind: 'base' };
    transparent.unshift(baseIt); pickables.push(baseIt);
    // puffs
    let pi = 0;
    for (const p of App.puffs) {
      const t = p.age / p.life, grow = 0.55 + 1.25 * Math.pow(t, 0.5), fade = Math.min(1, p.age / 0.18) * Math.pow(1 - t, 1.4);
      for (const bl of p.blobs) {
        if (pi >= App.puffDraws.length) break;
        const wob = Math.sin(App.time * 1.7 + bl.ph) * 0.08;
        const pos = v3.add(p.p, v3.mul(v3.add(bl.off, [wob, wob * 0.5, -wob]), grow * 1.6));
        const s = bl.r * grow;
        const m = m4.mul(m4.translate(pos), m4.scale([s, s * 0.92, s]));
        R.writeDraw(App.puffDraws[pi], m, [0, 0, 0, 0], [1, 1, 1, 1], [fade, 0, 0, 0]);
        transparent.push({ mesh: R.sphere, draw: App.puffDraws[pi], kind: 'clear' });
        pi++;
      }
    }
  }
  // light frustum follows the figure
  const c = [b.x[0], Math.max(b.x[1], 4), b.x[2]];
  const lv = m4.lookAt(v3.madd(c, LIGHTS.key, 45), c, [0, 1, 0]);
  const S = App.mode === 'model' && App.model ? App.model.shadowSize : 16;
  const lvp = m4.mul(m4.ortho(-S, S, -S, S, 5, 100), lv);
  const up = quat.rotate(b.q, [0, 1, 0]);
  const baseC = b.toWorld([0, -0.6, 0]);
  return {
    vp: cam.vp, lvp, camPos: cam.eye, time: App.time, exposure: 1.0,
    baseC, baseR: App.baseR, baseUp: up, baseH: Math.max(0, Math.min(baseC[1], b.toWorld([App.baseR * 0.7, -0.6, 0])[1], b.toWorld([-App.baseR * 0.7, -0.6, 0])[1])),
    casters, opaque, transparent, pickables,
  };
}

/* ---------------- input ---------------- */
function rayAt(px, py) {
  const cam = App.lastCam, R = App.R, inv = m4.invert(cam.vp);
  const x = (px / R.w) * 2 - 1, y = 1 - (py / R.h) * 2;
  const a = m4.point(inv, [x, y, 0]), b = m4.point(inv, [x, y, 1]);
  return { o: a, d: v3.norm(v3.sub(b, a)) };
}
function pickAt(px, py) { const f = prepareScene(); return f ? App.R.pick(f, Math.floor(px), Math.floor(py)) : Promise.resolve(null); }
function canvasXY(e) { const r = $('gfx').getBoundingClientRect(); return [(e.clientX - r.left) * App.R.w / r.width, (e.clientY - r.top) * App.R.h / r.height]; }

function wireInput() {
  const cv = $('gfx');
  cv.addEventListener('pointerdown', async e => {
    cv.setPointerCapture(e.pointerId);
    App.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (App.ptr.size === 2) { App.drag = { mode: 'pinch', span: pinchSpan() }; return; }
    const id = Symbol('drag');
    App.drag = { id, mode: 'pending', adx: 0, ady: 0, last: null };
    if (!App.ready) { App.drag.mode = 'orbit'; return; }
    const [px, py] = canvasXY(e);
    const hit = await pickAt(px, py);
    if (!App.drag || App.drag.id !== id) return;
    const d = App.drag;
    if (hit && App.pose && App.mode === 'sculpt' && [PART.HEAD, PART.ARM, PART.ACC].includes(hit.part)) {
      d.mode = 'pose'; d.joint = hit.part === PART.HEAD ? 'head' : 'arm';
      if (App.action.on) toggleAction(false);
    } else if (hit && !App.fixed && hit.part) {
      d.mode = 'grab';
      const cam = App.lastCam;
      const fwd = v3.norm(v3.sub(App.cam.target, cam.eye));
      d.plane = { n: fwd, p: hit.point };
      App.body.grab = { local: App.body.toLocal(hit.point), target: hit.point.slice() };
      App.body.wake();
      cv.classList.add('grabbing');
    } else d.mode = 'orbit';
    if (d.last) dragDelta(d, d.adx, d.ady, d.last);
  });
  const onMove = e => {
    const prev = App.ptr.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    App.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = App.drag;
    if (!d) return;
    if (d.mode === 'pending') { d.adx += dx; d.ady += dy; d.last = { clientX: e.clientX, clientY: e.clientY }; return; }
    dragDelta(d, dx, dy, e);
  };
  const dragDelta = (d, ddx, ddy, e) => {
    if (d.mode === 'pinch') { const s = pinchSpan(); App.cam.dist = clamp(App.cam.dist * d.span / Math.max(s, 1), 18, 90); d.span = s; return; }
    if (d.mode === 'orbit') {
      App.cam.yaw -= ddx * 0.0065;
      App.cam.pitch = clamp(App.cam.pitch + ddy * 0.005, 0.03, 1.15);
    } else if (d.mode === 'grab') {
      const [px, py] = canvasXY(e), r = rayAt(px, py), pl = d.plane;
      const den = v3.dot(r.d, pl.n);
      if (Math.abs(den) > 1e-4) {
        const t = v3.dot(v3.sub(pl.p, r.o), pl.n) / den;
        const p = v3.madd(r.o, r.d, t);
        p[1] = Math.max(p[1], 0.2);
        App.body.grab.target = p;
      }
    } else if (d.mode === 'pose') {
      const j = d.joint === 'head' ? App.head : App.arm, L = d.joint === 'head' ? HEAD_LIM : ARM_LIM;
      const flip = Math.cos(App.cam.yaw - eulerFromQuat(App.body.q).y) < 0 ? -1 : 1;
      const dy = ddx * 0.006 * flip, dp = ddy * (d.joint === 'head' ? 0.006 : 0.007);
      const prev = { ...j }, wrist0 = App.wrist, stuck = posePenetrates();
      // full move, else slide along whichever axis stays clear, else hold
      for (const [a, b] of [[dy, dp], [dy, 0], [0, dp]]) {
        Object.assign(j, prev); j.y += a; j.p += b; clampJoint(j, L);
        if (d.joint === 'arm') App.wrist = autoWrist();
        if (stuck || !posePenetrates()) return;
      }
      Object.assign(j, prev); App.wrist = wrist0;
    }
  };
  cv.addEventListener('pointermove', onMove);
  const end = e => {
    App.ptr.delete(e.pointerId);
    const d = App.drag;
    if (d && d.mode === 'grab') {
      App.body.grab = null;
      const v = App.body.v, l = v3.len(v);
      if (l > 420) App.body.v = v3.mul(v, 420 / l);
      App.body.wake();
    }
    cv.classList.remove('grabbing');
    App.drag = App.ptr.size ? { mode: 'orbit' } : null;
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', e => { e.preventDefault(); App.cam.dist = clamp(App.cam.dist * Math.exp(e.deltaY * 0.0012), 18, 90); }, { passive: false });
  cv.addEventListener('keydown', e => {
    const k = e.key;
    if (k === 'ArrowLeft') App.cam.yaw += 0.08; else if (k === 'ArrowRight') App.cam.yaw -= 0.08;
    else if (k === 'ArrowUp') App.cam.pitch = clamp(App.cam.pitch + 0.05, 0.03, 1.15); else if (k === 'ArrowDown') App.cam.pitch = clamp(App.cam.pitch - 0.05, 0.03, 1.15);
    else if (k === '+' || k === '=') App.cam.dist = clamp(App.cam.dist * 0.9, 18, 90); else if (k === '-') App.cam.dist = clamp(App.cam.dist * 1.1, 18, 90);
    else return;
    e.preventDefault();
  });
}
function pinchSpan() { const p = [...App.ptr.values()]; return p.length < 2 ? 1 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); }

/* ---------------- UI ---------------- */
function toast(msg) { $('toastText').textContent = msg; $('toast').hidden = false; }
function updateHint() {
  const h = App.pose ? 'Drag the head or the arm to pose' : App.fixed ? 'Drag to orbit · scroll to zoom' : 'Drag the figure to lift and throw it · drag the backdrop to orbit';
  $('hint').textContent = h;
}
function setPressed(id, on) { $(id).setAttribute('aria-pressed', String(on)); }
function toggleAction(on = !App.action.on) {
  App.action.on = on;
  if (on) App.action.t = 0;
  else { applyPose(REST); }
  if (on && App.pose) { App.pose = false; setPressed('poseBtn', false); }
  $('actBtn').textContent = on ? '■ Stop' : '▶ ' + EDITIONS[App.edition].action;
  updateHint();
}
function setEdition(e) {
  App.edition = e;
  setPressed('edA', e === 'A'); setPressed('edB', e === 'B');
  $('specEd').textContent = EDITIONS[e].label;
  App.puffs = [];
  if (App.sculpt) App.body.setShape(App.body.com, App.body.Ib, App.sculpt.hull[e]);
  toggleAction(App.action.on);
  if (App.action.on) App.action.t = 0;
}
function wireUI() {
  wireInput();
  $('edA').onclick = () => setEdition('A');
  $('edB').onclick = () => setEdition('B');
  $('actBtn').onclick = () => toggleAction();
  $('resetBtn').onclick = () => { App.spinYaw = 0; resetFigure(); App.cam.dist = App.cam.dist0; App.cam.pitch = 0.2; };
  $('spinBtn').onclick = () => { App.spin = !App.spin; setPressed('spinBtn', App.spin); };
  $('dropBtn').onclick = dropFigure;
  $('dropBtn').disabled = true;
  $('poseBtn').onclick = () => {
    App.pose = !App.pose; setPressed('poseBtn', App.pose);
    if (App.pose && App.action.on) { App.action.on = false; $('actBtn').textContent = '▶ ' + EDITIONS[App.edition].action; }
    updateHint();
  };
  $('fixedBtn').onclick = () => setFixed(!App.fixed);
  $('loadBtn').onclick = () => $('fileInput').click();
  $('fileInput').onchange = e => { if (e.target.files.length) loadUserModel([...e.target.files]); e.target.value = ''; };
  $('toastClose').onclick = () => { $('toast').hidden = true; };
  $('backBtn').onclick = backToSculpt;
  $('standBtn').onclick = () => reorient(quat.axisAngle([1, 0, 0], -Math.PI / 2));
  $('turnBtn').onclick = () => reorient(quat.axisAngle([0, 1, 0], Math.PI / 2));
  const fin = { fGloss: 1, fSatin: 2, fMatte: 3 };
  for (const [id, v] of Object.entries(fin)) $(id).onclick = () => { App.finish = v; for (const k of Object.keys(fin)) setPressed(k, k === id); };
  $('paint').oninput = e => { App.paintLin = [...hexLin(e.target.value), 1]; App.paintTouched = true; if (App.model) for (const sm of App.model.gpu) if (!sm.hasTex) sm.useTint = true; };
  // drag and drop
  let depth = 0;
  window.addEventListener('dragenter', e => { e.preventDefault(); depth++; $('dropzone').hidden = false; });
  window.addEventListener('dragleave', e => { e.preventDefault(); if (--depth <= 0) { depth = 0; $('dropzone').hidden = true; } });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => {
    e.preventDefault(); depth = 0; $('dropzone').hidden = true;
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) loadUserModel(files);
  });
  updateHint();
}

/* ---------------- your own model ---------------- */
async function loadUserModel(files) {
  if (!App.ready) return;
  $('loading').hidden = false; setLoading(0.05, 'Loading');
  try {
    const model = await loadModelFiles(files);
    setLoading(0.5, 'Preparing');
    App.modelSrc = model;
    App.modelOrient = quat.ident();
    await buildUserModel();
    App.mode = 'model';
    if (App.action.on) toggleAction(false);
    App.pose = false; setPressed('poseBtn', false);
    $('editionRow').hidden = true; $('modelRow').hidden = false; $('poseBtn').disabled = true;
    $('figName').textContent = model.name || 'Your model';
    $('figSub').textContent = 'Your model, finished like a PVC figure.';
    $('specEd').textContent = 'Custom · ' + model.submeshes.length + (model.submeshes.length === 1 ? ' part' : ' parts');
    $('eyebrow').textContent = 'Collectible figure · Custom';
    if (model.messages.length) toast([...new Set(model.messages)].join(' '));
    else $('toast').hidden = true;
  } catch (e) {
    if (!(e instanceof FriendlyError)) console.error(e);
    toast(e instanceof FriendlyError ? e.message : 'That file couldn’t be read (' + (e.message || e) + '). Try exporting it again as .glb, .obj or .stl.');
  } finally { $('loading').hidden = true; }
}

// Orient, fit to figure size, upload, bake AO, size the base and the physics hull.
async function buildUserModel() {
  const src = App.modelSrc, R = App.R, q = App.modelOrient;
  if (App.model) for (const sm of App.model.gpu) R.destroyMesh(sm.mesh);
  const parts = src.submeshes.map(sm => {
    const n = sm.positions.length / 3, P = new Float32Array(n * 3), N = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      P.set(quat.rotate(q, [sm.positions[i * 3], sm.positions[i * 3 + 1], sm.positions[i * 3 + 2]]), i * 3);
      N.set(quat.rotate(q, [sm.normals[i * 3], sm.normals[i * 3 + 1], sm.normals[i * 3 + 2]]), i * 3);
    }
    return { sm, P, N };
  });
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const { P } of parts) for (let i = 0; i < P.length; i += 3) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], P[i + c]); mx[c] = Math.max(mx[c], P[i + c]); }
  const size = v3.sub(mx, mn);
  const s = Math.min(12.5 / Math.max(size[1], 1e-6), 10 / Math.max(size[0], size[2], 1e-6));
  const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2;
  // footprint radius from the lowest 12% of the model
  let foot = 0;
  for (const { P } of parts) for (let i = 0; i < P.length; i += 3) {
    const x = (P[i] - cx) * s, y = (P[i + 1] - mn[1]) * s, z = (P[i + 2] - cz) * s;
    P[i] = x; P[i + 1] = y; P[i + 2] = z;
    if (y < size[1] * s * 0.12) foot = Math.max(foot, Math.hypot(x, z));
  }
  const baseR = clamp(foot * 1.12 + 0.6, 2.6, 7.5);
  // materials (slots 24..39)
  const matSlots = new Map();
  const gpu = [];
  let anyTex = false;
  for (const { sm, P, N } of parts) {
    const m = sm.material;
    if (!matSlots.has(m)) matSlots.set(m, MAT.LOADED + (matSlots.size % (MAX_MATS - MAT.LOADED)));
    const slot = matSlots.get(m);
    const hasTex = !!m.texture;
    anyTex = anyTex || hasTex;
    const col = m.color || [1, 1, 1, 1];
    R.setMaterial(slot, [col[0], col[1], col[2]], { sss: 0.15, r: 0.3, m: 0, cc: 0.8, ccr: 0.1 }, hasTex ? 1 : 0);
    let tex = null;
    if (hasTex) { if (!m._gpu) m._gpu = await R.makeTexture(m.texture); tex = m._gpu.view; }
    const vb = packVertices(P, N, { uvs: sm.uvs, colors: sm.colors, mat: slot });
    const mesh = R.makeMesh(vb, sm.indices, null);
    const draw = R.makeDraw(tex);
    const plain = !hasTex && !m.named && !sm.colors;
    gpu.push({ mesh, draw, hasTex, useTint: plain || !!App.paintTouched, alphaCutoff: m.alphaCutoff || 0, positions: P });
  }
  setLoading(0.75, 'Baking shadows');
  await R.bakeAO(gpu.map(g => g.mesh), [0, size[1] * s * 0.5, 0], Math.max(size[1] * s * 0.62, baseR * 1.1, 6));
  App.model = { gpu, baseR, height: size[1] * s, shadowSize: Math.max(12, size[1] * s * 0.75 + 4), anyTex };
  // physics + base + camera
  App.baseR = baseR;
  R.destroyMesh(App.baseMesh); App.baseMesh = makeBase(baseR);
  const box = [-size[0] * s / 2, 0, -size[2] * s / 2, size[0] * s / 2, size[1] * s, size[2] * s / 2];
  const { com, Ib } = figureInertia(baseR, box);
  App.body.setShape(com, Ib, hullPoints(gpu.map(g => g.positions), baseR));
  App.body.restY = 0.6;
  App.cam.dist0 = clamp(App.model.height * 3.2 + 8, 26, 80);
  App.cam.ty0 = App.model.height * 0.48;
  App.cam.dist = App.cam.dist0;
  App.spinYaw = 0;
  resetFigure();
  $('paintWrap').hidden = anyTex && gpu.every(g => g.hasTex);
}
async function reorient(dq) {
  if (!App.modelSrc) return;
  App.modelOrient = quat.norm(quat.mul(dq, App.modelOrient));
  $('loading').hidden = false; setLoading(0.6, 'Preparing');
  try { await buildUserModel(); } finally { $('loading').hidden = true; }
}
function backToSculpt() {
  if (App.model) { for (const sm of App.model.gpu) App.R.destroyMesh(sm.mesh); }
  App.model = null; App.modelSrc = null; App.mode = 'sculpt';
  $('editionRow').hidden = false; $('modelRow').hidden = true; $('poseBtn').disabled = false;
  $('figName').textContent = 'Knight Kitten';
  $('figSub').textContent = '小貓騎士 — small, stressed, still standing.';
  $('eyebrow').textContent = 'Collectible figure · No. 007';
  setEdition(App.edition);
  useSculptShape();
  App.cam.dist = App.cam.dist0;
  App.spinYaw = 0;
  resetFigure();
  $('toast').hidden = true;
}
