import * as THREE from 'three';
import { P, lambert, mergeParts, mulberry32, setShadows, vertexColorMaterial } from './util.js';
import { HALF, RIDGE_X, SHORE_X, hillHeight, islandHeight } from './island.js';
import { BLOCKS, LANDMARKS, WHEEL } from './layout.js';

// A small Hong Kong: towers with ribbon windows between the roads, a forested mountain ridge
// along the left wall, neon signs and an observation wheel on the harbour promenade, and a big digital clock on the roof of the tallest tower.

const BODY_COLORS = ['#ece7dc', '#c9d4de', '#f1cdb0', '#bccbc3', '#d9d9e3', '#f4efe4', '#e2c7c0'];
const SIGN_COLORS = ['#ff3d6e', '#2ee6d6', '#ffd23f', '#ff8a2a', '#b46bff'];

function buildTowers(rng) {
  const bodies = [];
  const windows = [];
  const signs = [];

  const addTower = (x, z, w, d, h, kind) => {
    const y0 = islandHeight(x, z) - 0.02;
    const color = BODY_COLORS[Math.floor(rng() * BODY_COLORS.length)];
    bodies.push(P(new THREE.BoxGeometry(w, h, d), color, { pos: [x, y0 + h / 2, z] }));

    // Ribbon windows: a dark band every floor pair. Each band gets its own brightness, so at
    // night some floors are lit and some are dark.
    const floors = Math.floor(h / 0.2);
    for (let k = 0; k < floors; k++) {
      const shade = 0.25 + 0.75 * rng();
      const c = new THREE.Color(shade, shade, shade);
      windows.push(P(new THREE.BoxGeometry(w + 0.02, 0.085, d + 0.02), c, { pos: [x, y0 + 0.16 + k * 0.2, z] }));
    }

    if (kind === 'clock') {
      bodies.push(P(new THREE.BoxGeometry(w * 0.85, 0.12, d * 0.85), '#d4dbe3', { pos: [x, y0 + h + 0.06, z] }));
    } else if (kind === 'stepped') {
      bodies.push(P(new THREE.BoxGeometry(w * 0.75, 0.45, d * 0.75), color, { pos: [x, y0 + h + 0.22, z] }));
      bodies.push(P(new THREE.BoxGeometry(w * 0.45, 0.4, d * 0.45), '#d4dbe3', { pos: [x, y0 + h + 0.65, z] }));
    } else {
      if (rng() < 0.7) bodies.push(P(new THREE.BoxGeometry(w * 0.35, 0.16, d * 0.35), '#9aa5b1', { pos: [x + (rng() - 0.5) * w * 0.3, y0 + h + 0.08, z] }));
      if (h > 2.2) bodies.push(P(new THREE.CylinderGeometry(0.012, 0.02, 0.45, 4), '#8d98a5', { pos: [x, y0 + h + 0.35, z] }));
    }

    // A neon sign hanging off the harbour-facing side of some buildings.
    if (kind === 'plain' && h < 2.4 && rng() < 0.4) {
      const sc = SIGN_COLORS[Math.floor(rng() * SIGN_COLORS.length)];
      signs.push(P(new THREE.BoxGeometry(0.05, 0.4, 0.2), sc, { pos: [x + w / 2 + 0.04, y0 + 0.55 + rng() * 0.6, z + (rng() - 0.5) * d * 0.5] }));
    }
  };

  for (const lm of LANDMARKS) addTower(lm.x, lm.z, 0.6, 0.6, lm.h, lm.kind);

  for (const [x0, x1, z0, z1] of BLOCKS) {
    const nx = Math.max(1, Math.floor((x1 - x0) / 0.62));
    const nz = Math.max(1, Math.floor((z1 - z0) / 0.62));
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const cx = x0 + ((i + 0.5) * (x1 - x0)) / nx;
        const cz = z0 + ((j + 0.5) * (z1 - z0)) / nz;
        if (LANDMARKS.some((u) => Math.hypot(cx - u.x, cz - u.z) < 0.75)) continue; // landmark footprint
        if (rng() < 0.08) continue; // the odd gap
        const w = Math.min(0.62, ((x1 - x0) / nx) * (0.74 + rng() * 0.2));
        const d = Math.min(0.62, ((z1 - z0) / nz) * (0.74 + rng() * 0.2));
        const harbour = cx > 0.4 ? 0.8 : 0; // taller towards the water
        const centre = 0.6 * (1 - Math.abs(cz) / HALF);
        const h = 0.7 + rng() * 1.2 + harbour + centre;
        addTower(cx, cz, w, d, h, 'plain');
      }
    }
  }
  return { bodies, windows, signs };
}

function buildTrees(rng) {
  const parts = [];
  const cone = (x, z, h, r, y, c1, c2) => {
    parts.push(P(new THREE.CylinderGeometry(0.02, 0.03, 0.14, 5), '#7a5535', { pos: [x, y + 0.07, z] }));
    parts.push(P(new THREE.ConeGeometry(r, h, 6), c1, { pos: [x, y + 0.14 + h / 2, z] }));
    parts.push(P(new THREE.ConeGeometry(r * 0.7, h * 0.8, 6), c2, { pos: [x, y + 0.14 + h * 0.75, z] }));
  };
  // forest on the mountain ridge along the left wall
  for (let i = 0; i < 44; i++) {
    const x = -HALF + 0.15 + rng() * (RIDGE_X + HALF - 0.2);
    const z = -HALF + 0.2 + rng() * (2 * HALF - 0.4);
    if (hillHeight(x, z) < 0.25) continue;
    cone(x, z, 0.35 + rng() * 0.25, 0.14 + rng() * 0.06, islandHeight(x, z) - 0.02, '#3f8c4f', '#56a85d');
  }
  // street trees along the harbour promenade
  for (let z = -3.9; z <= 4.0; z += 0.85) {
    if (Math.abs(z - WHEEL.z) < 1.0) continue; // keep the observation wheel clear
    const x = SHORE_X - 0.75;
    const y = islandHeight(x, z) - 0.02;
    parts.push(P(new THREE.CylinderGeometry(0.02, 0.025, 0.16, 5), '#7a5535', { pos: [x, y + 0.08, z] }));
    parts.push(P(new THREE.IcosahedronGeometry(0.14, 0), '#5fb36a', { pos: [x, y + 0.26, z] }));
  }
  return parts;
}

/** Observation wheel on the promenade, turning slowly. Its plane faces the harbour. */
function buildWheel() {
  const group = new THREE.Group();
  const radius = 0.78;
  const x = WHEEL.x;
  const z = WHEEL.z;
  const hubY = islandHeight(x, z) + radius + 0.2;
  group.position.set(x, hubY, z);
  group.rotation.y = Math.PI / 2; // wheel plane = the y-z plane

  const legs = new THREE.Mesh(
    mergeParts([
      P(new THREE.BoxGeometry(0.05, radius + 0.22, 0.05), '#e8edf2', { pos: [0, -(radius + 0.22) / 2, 0.28], rot: [0, 0, 0.0] }),
      P(new THREE.BoxGeometry(0.05, radius + 0.22, 0.05), '#e8edf2', { pos: [0, -(radius + 0.22) / 2, -0.28] }),
    ]),
    vertexColorMaterial,
  );
  const spinner = new THREE.Group();
  const rimParts = [P(new THREE.TorusGeometry(radius, 0.03, 4, 24), '#f4f6f8')];
  for (let i = 0; i < 8; i++) {
    rimParts.push(P(new THREE.BoxGeometry(0.02, radius * 2, 0.02), '#cfd6dd', { rot: [0, 0, (i / 8) * Math.PI] }));
  }
  const rim = new THREE.Mesh(mergeParts(rimParts), vertexColorMaterial);
  spinner.add(rim);

  const cabins = [];
  const colors = ['#ff6b6b', '#ffd166', '#4dd0e1', '#ffffff'];
  const cabinGeometry = new THREE.BoxGeometry(0.12, 0.1, 0.12);
  for (let i = 0; i < 12; i++) {
    const holder = new THREE.Group();
    const a = (i / 12) * Math.PI * 2;
    holder.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    const cabin = new THREE.Mesh(cabinGeometry, lambert(colors[i % colors.length]));
    cabin.position.y = -0.07;
    holder.add(cabin);
    spinner.add(holder);
    cabins.push(holder);
  }
  group.add(legs, spinner);
  return { group, spinner, cabins };
}

const SIGN_W = 1.7;
const SIGN_H = 0.78;

/** Canvas texture with the time as big amber LED digits; the colon blinks every second. */
function makeClockTexture() {
  if (typeof document === 'undefined') return null; // no canvas outside the browser
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round((512 * SIGN_H) / SIGN_W);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return {
    texture,
    draw(now) {
      const ctx = canvas.getContext('2d');
      const { width, height } = canvas;
      ctx.fillStyle = '#120d06';
      ctx.fillRect(0, 0, width, height);
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const colon = now.getSeconds() % 2 === 0 ? ':' : ' ';
      ctx.font = '700 168px "Courier New", Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ff9a1f';
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#ffb02e';
      ctx.fillText(`${hh}${colon}${mm}`, width / 2, height / 2 + 6);
      ctx.shadowBlur = 0;
      texture.needsUpdate = true;
    },
  };
}

/**
 * A big digital clock on the roof of the tallest tower, showing the computer's local time.
 * The board turns to face the camera, so it can be read from any angle.
 */
function buildRooftopClock() {
  const lm = LANDMARKS.find((l) => l.kind === 'clock');
  const roofY = islandHeight(lm.x, lm.z) - 0.02 + lm.h + 0.12;
  const group = new THREE.Group();
  group.position.set(lm.x, roofY, lm.z);

  const frame = new THREE.Mesh(
    mergeParts([
      P(new THREE.BoxGeometry(SIGN_W + 0.1, SIGN_H + 0.1, 0.07), '#2a2f36', { pos: [0, 0.3 + SIGN_H / 2, -0.045] }),
      P(new THREE.BoxGeometry(0.06, 0.3, 0.06), '#8d98a5', { pos: [-0.35, 0.15, -0.04] }),
      P(new THREE.BoxGeometry(0.06, 0.3, 0.06), '#8d98a5', { pos: [0.35, 0.15, -0.04] }),
    ]),
    vertexColorMaterial,
  );
  const clock = makeClockTexture();
  const material = new THREE.MeshBasicMaterial({ map: clock ? clock.texture : null, color: 0xffffff, toneMapped: false });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(SIGN_W, SIGN_H), material);
  board.position.y = 0.3 + SIGN_H / 2;
  group.add(frame, board);
  setShadows(group, true, false);
  return { group, material, clock };
}

let lastSecond = -1;

const _c = new THREE.Color();
const WARM = new THREE.Color('#ffcf6e');

/** Towers, ridge and street trees, signs and the wheel. All geometry is merged into a few meshes. */
export function createCity() {
  const rng = mulberry32(2046);
  const group = new THREE.Group();

  const { bodies, windows, signs } = buildTowers(rng);
  const bodyMesh = new THREE.Mesh(mergeParts(bodies), vertexColorMaterial);
  setShadows(bodyMesh, true, true);

  // Windows and signs are unlit, so they glow at night; their colour follows the sky.
  const windowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const windowMesh = new THREE.Mesh(mergeParts(windows), windowMaterial);
  const signMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const signMesh = new THREE.Mesh(mergeParts(signs), signMaterial);

    const treeMesh = new THREE.Mesh(mergeParts(buildTrees(rng)), vertexColorMaterial);
  setShadows(treeMesh, true, true);

  const wheel = buildWheel();
  setShadows(wheel.group, true, false);
  const clock = buildRooftopClock();
  const camera = { position: new THREE.Vector3(0, 10, 10) };

  group.add(bodyMesh, windowMesh, signMesh, treeMesh, wheel.group, clock.group);

  return {
    object: group,
    /** The clock board turns towards this camera. */
    setCamera(cam) {
      camera.position = cam.position;
    },
    update(t, dt, env) {
      // Glass reflects the sky by day and glows warm yellow at night.
      _c.copy(env.skyColor).multiplyScalar(0.55).lerp(WARM, Math.pow(env.night, 0.7));
      windowMaterial.color.copy(_c);
      const dim = 0.75 + 0.25 * env.night;
      signMaterial.color.setScalar(dim);

      // The rooftop clock: redraw once a second, glow a little brighter at night, face the camera.
      const now = new Date();
      if (clock.clock && now.getSeconds() !== lastSecond) {
        lastSecond = now.getSeconds();
        clock.clock.draw(now);
      }
      clock.material.color.setScalar(0.88 + 0.12 * env.night);
      clock.group.rotation.y = Math.atan2(camera.position.x - clock.group.position.x, camera.position.z - clock.group.position.z);

      wheel.spinner.rotation.z = -t * 0.12;
      for (const holder of wheel.cabins) holder.rotation.z = t * 0.12; // cabins stay upright
    },
  };
}

