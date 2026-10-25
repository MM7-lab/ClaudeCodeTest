import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HIT_LAYER, markSolid } from './scene/util.js';
import { createBase, createIsland } from './scene/island.js';
import { createFoam, createSea } from './scene/sea.js';
import { createFerry } from './scene/ferry.js';
import { createCity } from './scene/city.js';
import { createTraffic } from './scene/traffic.js';
import { createHarbourLights } from './scene/harbourlights.js';
import { MODES, createLighting } from './scene/lighting.js';

const api = window.diorama;

const FPS = 30;
const FRAME_MS = 1000 / FPS;
const FOV = 32;
// Sphere around TARGET that contains the whole diorama and the tallest tower.
// Keeping the camera at least this far away (for any rotation) keeps the island fully in view.
const TARGET = new THREE.Vector3(0, 0.4, 0);
const BOUNDING_RADIUS = 7.0;
const DEFAULT_VIEW = { azimuth: 0.65, polar: 1.0, zoom: 1.04 }; // zoom is relative to the fit distance
const MAX_ZOOM_OUT = 1.7;

// ---- renderer, scene, camera ------------------------------------------------------------------

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 120);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(TARGET);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.rotateSpeed = 0.8;
controls.zoomSpeed = 0.6;
controls.minPolarAngle = 0.3; // not quite straight down
controls.maxPolarAngle = 1.5; // never below the horizon, so never under the island
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: null };

/** Distance at which a sphere of BOUNDING_RADIUS exactly fills the narrower side of the view. */
function fitDistance() {
  const v = THREE.MathUtils.degToRad(FOV) / 2;
  const h = Math.atan(Math.tan(v) * camera.aspect);
  return BOUNDING_RADIUS / Math.sin(Math.min(v, h));
}

function updateZoomLimits() {
  const fit = fitDistance();
  controls.minDistance = fit;
  controls.maxDistance = fit * MAX_ZOOM_OUT;
}

function setView(azimuth, polar, distance) {
  camera.position.setFromSphericalCoords(distance, polar, azimuth).add(TARGET);
  camera.lookAt(TARGET);
  controls.update();
}

function resize() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  updateZoomLimits();
}

// ---- the diorama ------------------------------------------------------------------------------

const lighting = createLighting(scene);
const city = createCity();
const island = createIsland({ ao: city.ao });
const base = createBase();
const sea = createSea();
const foam = createFoam();
const ferry = createFerry();
const traffic = createTraffic();
const harbourLights = createHarbourLights();

const animated = [sea, foam, city, traffic, ferry, harbourLights];
for (const part of [island, base, sea, foam, city, traffic, ferry, harbourLights]) scene.add(part.object);
scene.add(city.glow); // lamp glows are not solid: clicks pass through them

// Everything counts as "the diorama" for click-through hit testing.
for (const part of [island, base, sea, city, traffic, ferry]) markSolid(part.object);

city.setCamera(camera);
resize();
setView(DEFAULT_VIEW.azimuth, DEFAULT_VIEW.polar, fitDistance() * DEFAULT_VIEW.zoom);
window.addEventListener('resize', resize);

// ---- reset view (animated) --------------------------------------------------------------------

let resetAnim = null;
const sph = new THREE.Spherical();
const offset = new THREE.Vector3();

function resetView() {
  sph.setFromVector3(offset.copy(camera.position).sub(TARGET));
  const dAz = THREE.MathUtils.euclideanModulo(DEFAULT_VIEW.azimuth - sph.theta + Math.PI, Math.PI * 2) - Math.PI;
  resetAnim = {
    t: 0,
    az: sph.theta,
    dAz,
    polar: sph.phi,
    dist: sph.radius,
    toDist: fitDistance() * DEFAULT_VIEW.zoom,
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
  for (const part of animated) part.update(simTime, dt, env);
  stepResetAnim(dt);
  controls.update();
  // Keep the haze relative to the camera, so zooming does not fog the whole diorama.
  const distance = camera.position.distanceTo(controls.target);
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

const state = (await api.getState()) ?? { mode: 'day', moveMode: false };
moveMode = state.moveMode;
document.body.classList.toggle('move-mode', moveMode);

// Draw every look once up front so all shader programs are compiled before the first switch.
for (const mode of MODES) {
  lighting.setMode(mode, true);
  renderFrame(0);
}
lighting.setMode(state.mode, true);
renderFrame(0);
requestAnimationFrame(frame);

if (new URLSearchParams(location.search).has('debug')) {
  // Test hooks, only present when main was started with DIORAMA_DEBUG=1.
  window.__diorama = { THREE, scene, camera, controls, renderer, lighting, isOverDiorama, resetView, fitDistance, parts: { sea, foam, city, traffic, ferry, harbourLights } };
}
