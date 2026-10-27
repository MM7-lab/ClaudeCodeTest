import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { P, bottomShade, lambert, mergeParts, mulberry32, setShadows, smoothstep, vertexColorMaterial } from './util.js';
import { HALF, RIDGE_X, SHORE_X, hillHeight, islandHeight } from './island.js';
import { BLOCKS, LANDMARKS, OUTER_RING, WHEEL } from './layout.js';
import { glowTexture } from './textures.js';
import { createClockBoard } from './clockboard.js';

// A small Hong Kong: towers on small plinths with ribbon windows between the roads, a forested
// mountain ridge along the left wall, vertical shop signs, street lamps, an observation wheel on
// the harbour promenade, and a big digital clock on the roof of the tallest tower.

const BODY_COLORS = ['#ece7dc', '#c9d4de', '#f1cdb0', '#bccbc3', '#d9d9e3', '#f4efe4', '#e2c7c0'];
const SIGN_COLORS = ['#ff3d6e', '#2ee6d6', '#ffd23f', '#ff8a2a', '#b46bff'];

// Vertical shop signs: each column of the atlas is one two-character sign.
const SIGN_TEXTS = ['酒樓', '茶餐廳', '金舖', '藥房', '火鍋', '麵家', '旅舍', '大押'];
const SIGN_PANELS = ['#c8102e', '#0a8f5a', '#f2b705', '#1f5fbf', '#c8102e', '#7a2fb5', '#0a8f5a', '#e0701a'];
const SIGN_W_UNITS = 0.17;
const SIGN_H_UNITS = 0.62;

/** Atlas texture with the sign text drawn top to bottom, one sign per column. */
function makeSignAtlas() {
  if (typeof document === 'undefined' || globalThis.DIORAMA_LITE) return null; // no canvas outside the browser, and no text in lite mode
  const colW = 64;
  const canvas = document.createElement('canvas');
  canvas.width = colW * SIGN_TEXTS.length;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  SIGN_TEXTS.forEach((text, i) => {
    ctx.fillStyle = SIGN_PANELS[i];
    ctx.fillRect(i * colW, 0, colW, 256);
    ctx.strokeStyle = '#fff6d0';
    ctx.lineWidth = 4;
    ctx.strokeRect(i * colW + 3, 3, colW - 6, 250);
    const chars = [...text];
    const size = Math.min(48, Math.floor(230 / chars.length));
    ctx.font = `700 ${size}px "Microsoft JhengHei", "PingFang HK", "Noto Sans CJK TC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff6d0';
    chars.forEach((ch, k) => ctx.fillText(ch, i * colW + colW / 2, 128 + (k - (chars.length - 1) / 2) * (size + 6)));
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** One sign plane that shows column `col` of the atlas. */
function signPlane(col) {
  const g = new THREE.PlaneGeometry(SIGN_W_UNITS, SIGN_H_UNITS);
  const uv = g.getAttribute('uv');
  const n = SIGN_TEXTS.length;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (col + uv.getX(i)) / n);
  return g;
}

const footprints = [];

/** Baked ambient occlusion on the ground: 1 = open, lower = close to a building. */
function ao(x, z) {
  let k = 1;
  for (const f of footprints) {
    const dx = Math.max(Math.abs(x - f.x) - f.hw, 0);
    const dz = Math.max(Math.abs(z - f.z) - f.hd, 0);
    k = Math.min(k, 0.62 + 0.38 * smoothstep(0, 0.34, Math.hypot(dx, dz)));
  }
  return k;
}

function buildTowers(rng) {
  const bodies = [];
  const windows = [];
  const signs = [];
  const vSigns = []; // [x, y, z, column]
  footprints.length = 0;
  const list = []; // every tower, for the street-level detail layer

  /** One shaft: body, ribbon windows and a bottom-darkened base. Returns the roof height. */
  const column = (x, z, w, d, h, color, y0, ribbons = true) => {
    const body = bottomShade(new THREE.BoxGeometry(w, h, d), -h / 2, h / 2, 0.7, 0.45);
    bodies.push(P(body, color, { pos: [x, y0 + h / 2, z] }));
    // Ribbon windows: a dark band every floor pair. Each band gets its own brightness, so at
    // night some floors are lit and some are dark.
    const floors = ribbons ? Math.floor(h / 0.2) : 0;
    for (let k = 0; k < floors; k++) {
      const shade = 0.25 + 0.75 * rng();
      const c = new THREE.Color(shade, shade, shade);
      windows.push(P(new THREE.BoxGeometry(w + 0.02, 0.085, d + 0.02), c, { pos: [x, y0 + 0.16 + k * 0.2, z] }));
    }
    return y0 + h;
  };

  const addTower = (x, z, w, d, h, kind) => {
    const y0 = islandHeight(x, z) - 0.02;
    const color = BODY_COLORS[Math.floor(rng() * BODY_COLORS.length)];
    footprints.push({ x, z, hw: w / 2 + 0.04, hd: d / 2 + 0.04 });
    list.push({ x, z, w, d, h, y0, kind });
    bodies.push(P(new THREE.BoxGeometry(w + 0.08, 0.1, d + 0.08), '#aeb4bc', { pos: [x, y0 + 0.05, z] })); // plinth

    if (kind === 'prism') {
      // Faceted prism tower: four shafts of different heights with pyramid tops.
      const glass = '#cfd9e2';
      const cols = [
        [-1, -1, 1.0],
        [1, -1, 0.78],
        [1, 1, 0.58],
        [-1, 1, 0.38],
      ];
      for (const [sx, sz, f] of cols) {
        const cx = x + (sx * w) / 4;
        const cz = z + (sz * d) / 4;
        const top = column(cx, cz, w / 2, d / 2, h * f, glass, y0);
        bodies.push(P(new THREE.ConeGeometry(w * 0.36, 0.28, 4), '#b3c0cc', { pos: [cx, top + 0.14, cz], rot: [0, Math.PI / 4, 0] }));
      }
      bodies.push(P(new THREE.CylinderGeometry(0.012, 0.02, 0.55, 4), '#8d98a5', { pos: [x - w / 4, y0 + h + 0.55, z - d / 4] }));
      return;
    }

    if (kind === 'jardine') {
      // white shaft with a grid of round windows on every face
      const top = column(x, z, w, d, h, '#eceff2', y0, false);
      const dot = new THREE.CylinderGeometry(0.035, 0.035, 0.02, 8);
      for (let k = 0; k < Math.floor(h / 0.2) - 1; k++) {
        for (let c = -2; c <= 2; c++) {
          const u = c * (w / 5.5);
          const yy = y0 + 0.2 + k * 0.2;
          windows.push(P(dot, '#4a5b6c', { pos: [x + u, yy, z + d / 2 + 0.005], rot: [Math.PI / 2, 0, 0] }));
          windows.push(P(dot, '#4a5b6c', { pos: [x + u, yy, z - d / 2 - 0.005], rot: [Math.PI / 2, 0, 0] }));
          windows.push(P(dot, '#4a5b6c', { pos: [x + w / 2 + 0.005, yy, z + u], rot: [0, 0, Math.PI / 2] }));
          windows.push(P(dot, '#4a5b6c', { pos: [x - w / 2 - 0.005, yy, z + u], rot: [0, 0, Math.PI / 2] }));
        }
      }
      bodies.push(P(new THREE.BoxGeometry(w * 0.5, 0.1, d * 0.5), '#9aa5b1', { pos: [x, top + 0.05, z] }));
      return;
    }
    const top = column(x, z, w, d, h, color, y0);
    if (kind === 'clock') {
      bodies.push(P(new THREE.BoxGeometry(w * 0.85, 0.12, d * 0.85), '#d4dbe3', { pos: [x, top + 0.06, z] }));
    } else if (kind === 'crown') {
      // Tapered crown and a thin spire.
      bodies.push(P(new THREE.CylinderGeometry(0.05, w * 0.72, 0.6, 4), '#d4dbe3', { pos: [x, top + 0.3, z], rot: [0, Math.PI / 4, 0] }));
      bodies.push(P(new THREE.CylinderGeometry(0.01, 0.02, 0.6, 4), '#9aa5b1', { pos: [x, top + 0.85, z] }));
    } else {
      if (rng() < 0.7) bodies.push(P(new THREE.BoxGeometry(w * 0.35, 0.16, d * 0.35), '#9aa5b1', { pos: [x + (rng() - 0.5) * w * 0.3, top + 0.08, z] }));
      if (h > 2.2) bodies.push(P(new THREE.CylinderGeometry(0.012, 0.02, 0.45, 4), '#8d98a5', { pos: [x, top + 0.35, z] }));
    }

    if (kind === 'plain' && h < 2.6) {
      // A neon bar and, on lower buildings, a vertical Chinese shop sign hanging off the wall.
      if (rng() < 0.4) {
        const sc = SIGN_COLORS[Math.floor(rng() * SIGN_COLORS.length)];
        signs.push(P(new THREE.BoxGeometry(0.05, 0.4, 0.2), sc, { pos: [x + w / 2 + 0.04, y0 + 0.55 + rng() * 0.6, z + (rng() - 0.5) * d * 0.5] }));
      } else if (h > 1.2 && rng() < 0.5) {
        const sy = y0 + 0.5 + SIGN_H_UNITS / 2 + rng() * 0.3;
        const sz = z + (rng() - 0.5) * d * 0.5;
        vSigns.push([x + w / 2 + SIGN_W_UNITS / 2 + 0.01, sy, sz, Math.floor(rng() * SIGN_TEXTS.length)]);
        bodies.push(P(new THREE.BoxGeometry(SIGN_W_UNITS + 0.02, 0.02, 0.02), '#6b7480', { pos: [x + w / 2 + SIGN_W_UNITS / 2, sy + SIGN_H_UNITS / 2 + 0.01, sz] }));
      }
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
  return { bodies, windows, signs, vSigns, list };
}

/** Street lamps along the promenade and the front and back roads. */
function buildLamps() {
  const spots = [];
  for (let z = -3.9 + 0.425; z <= 4.0; z += 0.85) {
    if (Math.abs(z - WHEEL.z) < 0.9) continue;
    spots.push([SHORE_X - 0.95, z]);
  }
  for (const zz of [-1, 1]) {
    for (let x = -2.6; x <= 1.2; x += 0.95) spots.push([x, zz * (OUTER_RING.z1 + 0.3)]);
  }
  const posts = [];
  const heads = [];
  const positions = [];
  for (const [x, z] of spots) {
    const y = islandHeight(x, z) - 0.02;
    posts.push(P(new THREE.CylinderGeometry(0.01, 0.014, 0.4, 5), '#59616b', { pos: [x, y + 0.2, z] }));
    heads.push(P(new THREE.BoxGeometry(0.07, 0.025, 0.07), '#fff1c4', { pos: [x, y + 0.41, z] }));
    positions.push(x, y + 0.43, z);
  }
  return { posts, heads, positions };
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
export function buildWheel(x = WHEEL.x, z = WHEEL.z, baseY = islandHeight(x, z), radius = 0.78) {
  const group = new THREE.Group();
  const hubY = baseY + radius + 0.2;
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

const _c = new THREE.Color();
const WARM = new THREE.Color('#ffcf6e');

/** Towers, ridge and street trees, signs, lamps and the wheel. Geometry is merged into a few meshes. */
export function createCity() {
  const rng = mulberry32(2046);
  const group = new THREE.Group();

  const { bodies, windows, signs, vSigns, list: towers } = buildTowers(rng);
  const bodyMesh = new THREE.Mesh(mergeParts(bodies), vertexColorMaterial);
  setShadows(bodyMesh, true, true);

  // Windows and signs are unlit, so they glow at night; their colour follows the sky.
  const windowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const windowMesh = new THREE.Mesh(mergeParts(windows), windowMaterial);
  const signMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const signMesh = new THREE.Mesh(mergeParts(signs), signMaterial);

  // Vertical Chinese shop signs: one merged mesh using the text atlas.
  const atlas = makeSignAtlas();
  const vSignMaterial = new THREE.MeshBasicMaterial({ map: atlas, color: 0xffffff, side: THREE.DoubleSide });
  const vSignGeometries = vSigns.map(([x, y, z, col]) => signPlane(col).translate(x, y, z));
  const vSignMesh = vSignGeometries.length ? new THREE.Mesh(mergeGeometries(vSignGeometries, false), vSignMaterial) : null;

  const treeMesh = new THREE.Mesh(mergeParts(buildTrees(rng)), vertexColorMaterial);
  setShadows(treeMesh, true, true);

  // Street lamps: lit heads plus a soft glow at night.
  const lamps = buildLamps();
  const lampPostMesh = new THREE.Mesh(mergeParts(lamps.posts), vertexColorMaterial);
  const lampHeadMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const lampHeadMesh = new THREE.Mesh(mergeParts(lamps.heads), lampHeadMaterial);
  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lamps.positions, 3));
  const glowMaterial = new THREE.PointsMaterial({
    size: 0.42,
    map: glowTexture(),
    color: 0xffd58a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glowPoints = new THREE.Points(glowGeometry, glowMaterial);
  glowPoints.frustumCulled = false;

  const wheel = buildWheel();
  setShadows(wheel.group, true, false);
  const lm = LANDMARKS.find((l) => l.kind === 'clock');
  const clock = createClockBoard({ x: lm.x, y: islandHeight(lm.x, lm.z) - 0.02 + lm.h + 0.12, z: lm.z });
  const camera = { position: new THREE.Vector3(0, 10, 10) };

  group.add(bodyMesh, windowMesh, signMesh, treeMesh, lampPostMesh, lampHeadMesh, wheel.group, clock.group);
  if (vSignMesh) group.add(vSignMesh);
  const glowHolder = glowPoints; // not solid for click-through, so it is added separately

  return {
    object: group,
    towers,
    /** Glow sprites around the lamps; added to the scene separately so clicks pass through them. */
    glow: glowHolder,
    /** Baked ambient occlusion for the ground: pass to createIsland. */
    ao,
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
      vSignMaterial.color.setScalar(0.72 + 0.28 * env.night);
      lampHeadMaterial.color.setScalar(0.45 + 0.55 * env.night);
      glowMaterial.opacity = 0.95 * env.night;
      glowPoints.visible = env.night > 0.01;

      clock.update(env, camera.position);

      wheel.spinner.rotation.z = -t * 0.12;
      for (const holder of wheel.cabins) holder.rotation.z = t * 0.12; // cabins stay upright
    },
  };
}
