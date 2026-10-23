import * as THREE from 'three';
import { P, lambert, mergeParts, mulberry32, setShadows, vertexColorMaterial } from './util.js';
import { GROUND_Y, HALF, HILL, islandHeight } from './island.js';

// A small Hong Kong on the land half: a harbour-front avenue, towers with ribbon windows,
// a hill behind (Victoria Peak), neon signs and a waterfront observation wheel.

const BODY_COLORS = ['#ece7dc', '#c9d4de', '#f1cdb0', '#bccbc3', '#d9d9e3', '#f4efe4', '#e2c7c0'];
const SIGN_COLORS = ['#ff3d6e', '#2ee6d6', '#ffd23f', '#ff8a2a', '#b46bff'];

// Streets: one avenue along the harbour and cross streets between the blocks.
const AVENUE_X = -1.5;
const INNER_X = -3.1;
const CROSS_Z = [-2.05, 0.1, 2.25];
const BLOCK_X = [
  [-4.3, -3.2],
  [-3.0, -1.65],
];
const BLOCK_Z = [
  [-4.3, -2.2],
  [-1.9, -0.05],
  [0.25, 2.1],
  [2.4, 4.3],
];
const LANDMARKS = [
  { x: -2.2, z: 1.15, h: 4.3, kind: 'spire' }, // the tall harbour-front tower
  { x: -2.2, z: -1.0, h: 3.3, kind: 'stepped' },
];

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

    if (kind === 'spire') {
      bodies.push(P(new THREE.BoxGeometry(w * 0.7, 0.5, d * 0.7), '#d4dbe3', { pos: [x, y0 + h + 0.25, z] }));
      bodies.push(P(new THREE.CylinderGeometry(0.015, 0.03, 0.9, 5), '#9aa5b1', { pos: [x, y0 + h + 0.95, z] }));
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

  const used = [];
  for (const lm of LANDMARKS) {
    addTower(lm.x, lm.z, 0.7, 0.7, lm.h, lm.kind);
    used.push(lm);
  }

  for (const [x0, x1] of BLOCK_X) {
    for (const [z0, z1] of BLOCK_Z) {
      const nx = Math.max(1, Math.floor((x1 - x0) / 0.65));
      const nz = Math.max(1, Math.floor((z1 - z0) / 0.65));
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          const cx = x0 + ((i + 0.5) * (x1 - x0)) / nx;
          const cz = z0 + ((j + 0.5) * (z1 - z0)) / nz;
          if (Math.hypot(cx - HILL.x, cz - HILL.z) < 1.5) continue; // the hill
          if (used.some((u) => Math.hypot(cx - u.x, cz - u.z) < 0.75)) continue; // landmark footprint
          if (rng() < 0.1) continue; // the odd gap
          const w = ((x1 - x0) / nx) * (0.72 + rng() * 0.2);
          const d = ((z1 - z0) / nz) * (0.72 + rng() * 0.2);
          const harbour = cx > -2.3 ? 0.7 : 0; // taller towards the water
          const centre = 0.5 * (1 - Math.abs(cz) / HALF);
          const h = 0.8 + rng() * 1.3 + harbour + centre;
          addTower(cx, cz, w, d, h, 'plain');
        }
      }
    }
  }
  return { bodies, windows, signs };
}

function buildRoads() {
  const y = GROUND_Y + 0.006;
  const parts = [];
  const asphalt = '#5d636d';
  parts.push(P(new THREE.BoxGeometry(0.26, 0.02, 2 * HALF - 0.1), asphalt, { pos: [AVENUE_X, y, 0] }));
  parts.push(P(new THREE.BoxGeometry(0.22, 0.02, 2 * HALF - 0.1), asphalt, { pos: [INNER_X, y, 0] }));
  for (const z of CROSS_Z) {
    parts.push(P(new THREE.BoxGeometry(AVENUE_X + HALF - 0.05, 0.02, 0.2), asphalt, { pos: [(-HALF + 0.05 + AVENUE_X) / 2, y, z] }));
  }
  // dashed centre line on the avenue
  for (let z = -HALF + 0.3; z < HALF - 0.2; z += 0.5) {
    parts.push(P(new THREE.BoxGeometry(0.02, 0.022, 0.22), '#f2efe6', { pos: [AVENUE_X, y, z] }));
  }
  return parts;
}

function buildTrees(rng) {
  const parts = [];
  const cone = (x, z, h, r, y, c1, c2) => {
    parts.push(P(new THREE.CylinderGeometry(0.02, 0.03, 0.14, 5), '#7a5535', { pos: [x, y + 0.07, z] }));
    parts.push(P(new THREE.ConeGeometry(r, h, 6), c1, { pos: [x, y + 0.14 + h / 2, z] }));
    parts.push(P(new THREE.ConeGeometry(r * 0.7, h * 0.8, 6), c2, { pos: [x, y + 0.14 + h * 0.75, z] }));
  };
  // forest on the hill
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2;
    const rr = 0.2 + rng() * 1.5;
    const x = HILL.x + Math.cos(a) * rr;
    const z = HILL.z + Math.sin(a) * rr;
    if (x < -HALF + 0.15 || z < -HALF + 0.15 || x > -2.2 || z > -1.9) continue;
    cone(x, z, 0.35 + rng() * 0.25, 0.14 + rng() * 0.06, islandHeight(x, z) - 0.02, '#3f8c4f', '#56a85d');
  }
  // street trees along the harbour promenade
  for (let z = -3.9; z <= 4.0; z += 0.85) {
    if (Math.abs(z + 2.6) < 1.0) continue; // keep the observation wheel clear
    const x = -1.15;
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
  const x = -0.6;
  const z = -2.6;
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

const _c = new THREE.Color();
const WARM = new THREE.Color('#ffcf6e');

/** Towers, streets, hill trees, signs and the wheel. All geometry is merged into a few meshes. */
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

  const roadMesh = new THREE.Mesh(mergeParts(buildRoads()), vertexColorMaterial);
  setShadows(roadMesh, false, true);
  const treeMesh = new THREE.Mesh(mergeParts(buildTrees(rng)), vertexColorMaterial);
  setShadows(treeMesh, true, true);

  const wheel = buildWheel();
  setShadows(wheel.group, true, false);

  group.add(bodyMesh, windowMesh, signMesh, roadMesh, treeMesh, wheel.group);

  return {
    object: group,
    update(t, dt, env) {
      // Glass reflects the sky by day and glows warm yellow at night.
      _c.copy(env.skyColor).multiplyScalar(0.55).lerp(WARM, Math.pow(env.night, 0.7));
      windowMaterial.color.copy(_c);
      const dim = 0.75 + 0.25 * env.night;
      signMaterial.color.setScalar(dim);

      wheel.spinner.rotation.z = -t * 0.12;
      for (const holder of wheel.cabins) holder.rotation.z = t * 0.12; // cabins stay upright
    },
  };
}

