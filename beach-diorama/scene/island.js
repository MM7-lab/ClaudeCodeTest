import * as THREE from 'three';
import { lambert, gridGeometry, smoothstep, setShadows } from './util.js';

/**
 * Half the side of the square map: it spans x, z in [-HALF, HALF]. The harbour is the strip
 * x > SHORE_X (20% of the width); the other 80% is the city.
 */
export const HALF = 4.4;
/** Underside of the block; the wooden base plate sits below it. */
const BLOCK_BOTTOM = -0.6;

/** Mean x of the harbour front: 80% land to its left, 20% sea to its right. */
export const SHORE_X = -HALF + 2 * HALF * 0.8;

/** x of the shoreline at depth z: a gently wavy harbour front. */
export function shoreX(z) {
  return SHORE_X + 0.12 * Math.sin(0.9 * z + 0.5) + 0.06 * Math.sin(2.1 * z);
}

// Sand profile across the shore: [signed distance seaward of the shoreline, height].
// y = 0 is the mean sea level.
const PROFILE = [
  [-12, 0.38],
  [-0.95, 0.38], // flat city ground right up to a narrow beach
  [-0.45, 0.22],
  [0, 0.0],
  [0.4, -0.28],
  [1.0, -0.55],
];

function profileY(d) {
  if (d <= PROFILE[0][0]) return PROFILE[0][1];
  if (d >= PROFILE[PROFILE.length - 1][0]) return PROFILE[PROFILE.length - 1][1];
  for (let i = 1; i < PROFILE.length; i++) {
    if (d <= PROFILE[i][0]) {
      const [d0, y0] = PROFILE[i - 1];
      const [d1, y1] = PROFILE[i];
      return y0 + ((y1 - y0) * (d - d0)) / (d1 - d0);
    }
  }
  return PROFILE[PROFILE.length - 1][1];
}

/** Where the mountain ridge (Victoria Peak and friends) starts, along the left wall. */
export const RIDGE_X = -3.15;

/** Height of the ridge: zero on the flat city ground, rising smoothly towards the left wall. */
export function hillHeight(x, z) {
  const t = Math.min(1, Math.max(0, (RIDGE_X - x) / (RIDGE_X + HALF)));
  const peak = 1.25 + 0.35 * Math.sin(1.1 * z + 0.4) + 0.25 * Math.sin(2.3 * z + 1.0);
  return peak * t * t * (3 - 2 * t);
}

/** Height of the city ground (the flat plateau). */
export const GROUND_Y = 0.38;

/** Ground height at (x, z). Used for placing buildings and trees. */
export function islandHeight(x, z) {
  const y = profileY(x - shoreX(z));
  // Gentle ripples only on the beach strip; the city ground stays flat.
  const ripples = 0.03 * Math.sin(1.9 * x + 0.7) * Math.cos(2.3 * z - 0.4) * smoothstep(-0.1, 0.1, y) * (1 - smoothstep(0.2, 0.34, y));
  return y + ripples + hillHeight(x, z);
}

const PAVEMENT = new THREE.Color('#c3c8cf');
const GRASS_LOW = new THREE.Color('#79bd6c');
const GRASS_HIGH = new THREE.Color('#4f9a58');

const SAND_STOPS = [
  [0.2, new THREE.Color('#f4d9a0')],
  [0.0, new THREE.Color('#e9c88c')],
  [-0.3, new THREE.Color('#d6b178')],
  [-0.6, new THREE.Color('#c29d66')],
];

function sandColor(y, out) {
  if (y >= SAND_STOPS[0][0]) return out.copy(SAND_STOPS[0][1]);
  for (let i = 1; i < SAND_STOPS.length; i++) {
    if (y >= SAND_STOPS[i][0]) {
      const [y0, c0] = SAND_STOPS[i - 1];
      const [y1, c1] = SAND_STOPS[i];
      return out.copy(c1).lerp(c0, (y - y1) / (y0 - y1));
    }
  }
  return out.copy(SAND_STOPS[SAND_STOPS.length - 1][1]);
}

/** Vertex colour: sand on the beach strip, pavement on the city ground, grass on the hill. */
function groundColor(x, y, z, out) {
  sandColor(y, out).lerp(PAVEMENT, smoothstep(0.16, 0.34, y));
  const hill = hillHeight(x, z);
  if (hill > 0.04) out.lerp(GRASS_LOW, smoothstep(0.04, 0.3, hill)).lerp(GRASS_HIGH, smoothstep(0.5, 1.5, hill));
  return out;
}

/** Ground heightfield over the whole square; the part below the sea is hidden by the water. */
export function createIsland() {
  const n = 44;
  const geometry = gridGeometry(n, n, (i, j) => {
    const x = -HALF + (2 * HALF * i) / n;
    const z = -HALF + (2 * HALF * j) / n;
    return [x, islandHeight(x, z), z];
  });
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    groundColor(x, position.getY(i), z, c);
    c.multiplyScalar(1 + 0.04 * Math.sin(x * 7.3 + z * 5.1)); // subtle mottling
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  setShadows(mesh, true, true);
  return { object: mesh };
}

const EARTH_TOP = new THREE.Color('#b08c60');
const EARTH_BOTTOM = new THREE.Color('#6d5036');
const WATER_TOP = new THREE.Color('#58b9dc');
const WATER_BOTTOM = new THREE.Color('#1d628f');

/**
 * No walls: the map is a cut-away block. Its four sides show layers of earth under the city
 * and a slab of water under the harbour, standing on a wooden base plate.
 */
export function createBase() {
  const group = new THREE.Group();

  // Perimeter, walked round once, sampled finely enough to follow the ground profile.
  const n = 44;
  const ring = [];
  for (let i = 0; i < n; i++) ring.push([-HALF + (2 * HALF * i) / n, -HALF]); // back edge
  for (let i = 0; i < n; i++) ring.push([HALF, -HALF + (2 * HALF * i) / n]); // right (harbour)
  for (let i = 0; i < n; i++) ring.push([HALF - (2 * HALF * i) / n, HALF]); // front edge
  for (let i = 0; i < n; i++) ring.push([-HALF, HALF - (2 * HALF * i) / n]); // left (ridge)

  const positions = new Float32Array(ring.length * 2 * 6);
  const colors = new Float32Array(ring.length * 2 * 6);
  const c = new THREE.Color();
  ring.forEach(([x, z], i) => {
    const ground = islandHeight(x, z);
    const top = Math.max(ground, 0); // water surface is y = 0
    const land = smoothstep(-0.02, 0.12, ground);
    positions.set([x, top, z, x, BLOCK_BOTTOM, z], i * 6);
    c.copy(WATER_TOP).lerp(EARTH_TOP, land);
    colors.set([c.r, c.g, c.b], i * 6);
    c.copy(WATER_BOTTOM).lerp(EARTH_BOTTOM, land);
    colors.set([c.r, c.g, c.b], i * 6 + 3);
  });
  const indices = [];
  const count = ring.length;
  for (let i = 0; i < count; i++) {
    const a = i * 2;
    const b = ((i + 1) % count) * 2;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const skirt = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }),
  );

  const plate = new THREE.Mesh(new THREE.BoxGeometry(2 * HALF + 0.8, 0.22, 2 * HALF + 0.8), lambert('#b97b4b'));
  plate.position.y = BLOCK_BOTTOM - 0.11;
  group.add(skirt, plate);
  setShadows(group, false, true);
  return { object: group };
}
