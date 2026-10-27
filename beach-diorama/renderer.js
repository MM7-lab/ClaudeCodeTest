import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HIT_LAYER } from './scene/util.js';
import { MODES, createLighting } from './scene/lighting.js';
import { createMiniHK } from './scene/worlds/minihk.js';

const api = window.diorama;
// ?lite=1 (set by main as a last resort): no shadows, no anti-aliasing, no Chinese sign text.
const LITE = new URLSearchParams(location.search).has('lite');
globalThis.DIORAMA_LITE = LITE;
const step = (message) => api.log?.(message); // progress goes to diorama.log, to see where a crash happens
step(`renderer start${LITE ? ' (lite)' : ''}, devicePixelRatio ${window.devicePixelRatio}`);

// The desktop window is capped at 30 fps; the web preview (see web/shim.js) may ask for more.
const FPS = window.diorama.fps ?? 30;
const FRAME_MS = 1000 / FPS;
const FOV = 32;
// Sphere around TARGET that contains the whole diorama and the tallest tower.
// Keeping the camera at least this far away (for any rotation) keeps the island fully in view.
const TARGET = new THREE.Vector3(0, 0.4, 0);
const DEFAULT_VIEW = { azimuth: 0.65, polar: 1.0, zoom: 1.04 }; // zoom is relative to the fit distance
const MAX_ZOOM_OUT = 1.7;
const MIN_ZOOM = 0.09; // closest distance, relative to the distance that fits the whole map

// ---- renderer, scene, camera ------------------------------------------------------------------

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LITE, alpha: true, powerPreference: 'low-power' });
{
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  step(`webgl ok: ${ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)}`);
}
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = !LITE;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 120); // near is small so street level can be reached

const controls = new OrbitControls(camera, canvas);
controls.target.copy(TARGET);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.rotateSpeed = 0.8;
controls.zoomSpeed = 1.1;
// Map-style zoom: the wheel zooms towards the cursor, so you can dive into any street. The point
// the camera looks at may wander only within a sphere around the map centre.
controls.zoomToCursor = true;
controls.cursor.copy(TARGET);
controls.maxTargetRadius = 4.2;
controls.minPolarAngle = 0.3; // not quite straight down
controls.maxPolarAngle = 1.5; // never below the horizon, so never under the island
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: null };

/** Distance at which a sphere of BOUNDING_RADIUS exactly fills the narrower side of the view. */
function fitDistance() {
  const v = THREE.MathUtils.degToRad(FOV) / 2;
  const h = Math.atan(Math.tan(v) * camera.aspect);
  return world.boundingRadius / Math.sin(Math.min(v, h));
}

function updateZoomLimits() {
  const fit = fitDistance();
  controls.minDistance = fit * MIN_ZOOM;
  controls.maxDistance = fit * MAX_ZOOM_OUT;
}

function setView(azimuth, polar, distance, center = TARGET) {
  controls.target.copy(center);
  camera.position.setFromSphericalCoords(distance, polar, azimuth).add(center);
  camera.lookAt(center);
  controls.update();
}

function resize() {
  // The canvas fills the Electron window, or a square on the web page: size to the canvas.
  const w = Math.max(1, canvas.clientWidth);
  const h = Math.max(1, canvas.clientHeight);
  const pixelRatio = LITE ? 1 : Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  updateZoomLimits();
}

// ---- the diorama ------------------------------------------------------------------------------

step('asking main for the state');
const state = (await api.getState()) ?? { mode: 'day', moveMode: false, map: 'hk-mini' };

step(`state ${JSON.stringify(state)}`);
const lighting = createLighting(scene);
// The realistic maps (Kowloon Bay, Central) are loaded only when chosen.
const world =
  state.map === 'kowloon-bay'
    ? (await import('./scene/worlds/realmap.js')).createKowloonBay()
    : state.map === 'central'
      ? (await import('./scene/worlds/realmap.js')).createCentral()
      : createMiniHK();
step(`world ${world.id} built`);
world.configure({ renderer, scene, lighting });
const animated = world.parts;
for (const part of world.parts) scene.add(part.object);
for (const extra of world.extras) scene.add(extra);
world.setCamera(camera);

resize();
setView(DEFAULT_VIEW.azimuth, DEFAULT_VIEW.polar, fitDistance() * DEFAULT_VIEW.zoom);
new ResizeObserver(resize).observe(canvas);

// ---- reset view (animated) --------------------------------------------------------------------

let resetAnim = null;
const sph = new THREE.Spherical();
const offset = new THREE.Vector3();

function resetView() {
  sph.setFromVector3(offset.copy(camera.position).sub(controls.target));
  const dAz = THREE.MathUtils.euclideanModulo(DEFAULT_VIEW.azimuth - sph.theta + Math.PI, Math.PI * 2) - Math.PI;
  resetAnim = {
    t: 0,
    az: sph.theta,
    dAz,
    polar: sph.phi,
    dist: sph.radius,
    toDist: fitDistance() * DEFAULT_VIEW.zoom,
    from: controls.target.clone(), // the point being looked at glides back to the map centre too
  };
}

function stepResetAnim(dt) {
  if (!resetAnim) return;
  resetAnim.t = Math.min(1, resetAnim.t + dt / 0.6);
  const k = THREE.MathUtils.smootherstep(resetAnim.t, 0, 1);
  setView(
    resetAnim.az + resetAnim.dAz * k,
    THREE.MathUtils.lerp(resetAnim.polar, DEFAULT_VIEW.polar, k),
    THREE.MathUtils.lerp(resetAnim.dist, resetAnim.toDist, k),
    new THREE.Vector3().lerpVectors(resetAnim.from, TARGET, k),
  );
  if (resetAnim.t >= 1) resetAnim = null;
}

// ---- click-through: is the cursor over the diorama? -------------------------------------------

const raycaster = new THREE.Raycaster();
raycaster.layers.set(HIT_LAYER);
const ndc = new THREE.Vector2();

function visibleChain(object) {
  for (let o = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function isOverDiorama(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(scene, true).some((hit) => visibleChain(hit.object));
}

let interactive = false; // main starts with the window ignoring the mouse
let dragging = false;
let moveMode = false;
let lastPointer = null;
let pendingTimer = 0;
let lastHitTest = 0;

function setInteractive(value) {
  if (value === interactive) return;
  interactive = value;
  api.setInteractive(value);
}

function evaluate() {
  pendingTimer = 0;
  lastHitTest = performance.now();
  if (dragging || moveMode) return setInteractive(true);
  setInteractive(lastPointer !== null && isOverDiorama(lastPointer.x, lastPointer.y));
}

/** Throttled to ~60 Hz; the final position of a burst of events is always evaluated. */
function pointerMoved(x, y) {
  lastPointer = { x, y };
  if (pendingTimer) return;
  const wait = Math.max(0, 16 - (performance.now() - lastHitTest));
  if (wait === 0) evaluate();
  else pendingTimer = setTimeout(evaluate, wait);
}

// Forwarded mouse moves (click-through) arrive as mouse events; listen to both kinds.
window.addEventListener('pointermove', (e) => pointerMoved(e.clientX, e.clientY));
window.addEventListener('mousemove', (e) => pointerMoved(e.clientX, e.clientY));
canvas.addEventListener('pointerdown', (e) => {
  if (e.button === 0) {
    dragging = true;
    resetAnim = null; // the user takes over
    setInteractive(true);
  }
});
const endDrag = () => {
  if (!dragging) return;
  dragging = false;
  evaluate();
};
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
document.addEventListener('mouseleave', () => {
  lastPointer = null;
  if (!dragging) evaluate();
});

// Poll fallback: main sends the cursor position because mouse moves aren't forwarded to us.
api.onCursor(({ x, y, inside }) => {
  if (inside) pointerMoved(x, y);
  else {
    lastPointer = null;
    if (!dragging) evaluate();
  }
});

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (isOverDiorama(e.clientX, e.clientY)) api.showContextMenu();
});

// ---- messages from the main process ----------------------------------------------------------

function setMoveMode(on) {
  moveMode = on;
  document.body.classList.toggle('move-mode', on);
  evaluate();
}

api.onMode((mode) => lighting.setMode(mode));
api.onMoveMode(setMoveMode);
api.onResetView(resetView);

// ---- main loop (capped at 30 fps) -------------------------------------------------------------

let simTime = 0;
let lastFrame = performance.now();
let nextDue = 0;

function renderFrame(dt) {
  simTime += dt;
  const env = lighting.update(dt);
  for (const part of animated) part.update?.(simTime, dt, env);
  stepResetAnim(dt);
  controls.update();
  const fit = fitDistance();
  let distance = camera.position.distanceTo(controls.target);
  // Zoomed out to the whole map, the view re-centres, so the map is always fully in frame.
  const recentre = THREE.MathUtils.smoothstep(distance, fit * 0.8, fit * 1.02);
  if (recentre > 0) controls.target.lerp(TARGET, 0.25 * recentre);
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0.1, 1.2); // zooming to the cursor must not dig into the ground
  distance = camera.position.distanceTo(controls.target);
  // Shadows and fine detail follow the zoom: the closer, the smaller and sharper the shadow area.
  lighting.focusShadows(controls.target, distance, fit);
  world.setViewDistance?.(distance, fit);
  // Keep the haze relative to the camera, so zooming does not fog the whole diorama.
  lighting.fog.near = distance + 1;
  lighting.fog.far = distance + 42;
  renderer.render(scene, camera);
}

function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) {
    lastFrame = now;
    return;
  }
  if (now < nextDue - 1.5) return;
  nextDue = Math.max(nextDue + FRAME_MS, now + FRAME_MS * 0.5);
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  renderFrame(dt);
}

moveMode = state.moveMode;
document.body.classList.toggle('move-mode', moveMode);

// Draw every look once up front so all shader programs are compiled before the first switch.
step('compiling shaders');
for (const mode of MODES) {
  lighting.setMode(mode, true);
  renderFrame(0);
}
step('shaders compiled');
lighting.setMode(state.mode, true);
renderFrame(0);
requestAnimationFrame(frame);
api.sceneReady?.(); // the first frame is drawn: tell main the scene started

if (new URLSearchParams(location.search).has('debug')) {
  // Test hooks, only present when main was started with DIORAMA_DEBUG=1.
  window.__diorama = { THREE, scene, camera, controls, renderer, lighting, isOverDiorama, resetView, fitDistance, world, parts: world.debug };
}
