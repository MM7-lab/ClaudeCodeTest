import * as THREE from 'three';
import { lambert, gridGeometry, smoothstep, setShadows, mergeParts, P, vertexColorMaterial } from './util.js';

/** Half the side of the square map: it spans x, z in [-HALF, HALF]. Land is x < 0, sea is x > 0. */
export const HALF = 4.4;
const WALL_T = 0.2;
const WALL_TOP = 0.5;
const WALL_BOTTOM = -0.6;

/** x of the shoreline at depth z: a wavy line down the middle of the map. */
export function shoreX(z) {
  return 0.15 + 0.3 * Math.sin(0.9 * z + 0.5) + 0.15 * Math.sin(2.1 * z);
}

// Sand profile across the shore: [signed distance seaward of the shoreline, height].
// y = 0 is the mean sea level.
const PROFILE = [
  [-12, 0.38],
  [-3.0, 0.38],
  [-1.6, 0.3],
  [-0.9, 0.18],
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

/** Ground height at (x, z). Used for placing trees, people and props. */
export function islandHeight(x, z) {
  const y = profileY(x - shoreX(z));
  const bumps = 0.035 * Math.sin(1.9 * x + 0.7) * Math.cos(2.3 * z - 0.4) + 0.02 * Math.sin(4.1 * x + 3.3 * z);
  return y + bumps * smoothstep(-0.1, 0.25, y);
}

const SAND_STOPS = [
  [0.35, new THREE.Color('#fbe9bd')],
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

/** Sand heightfield over the whole square; the part below the sea is hidden by the water. */
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
    sandColor(position.getY(i), c);
    c.multiplyScalar(1 + 0.04 * Math.sin(x * 7.3 + z * 5.1)); // subtle mottling
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  setShadows(mesh, true, true);
  return { object: mesh };
}

/** Four thin walls around the square map, on top of a wooden base plate. */
export function createBase() {
  const group = new THREE.Group();
  const height = WALL_TOP - WALL_BOTTOM;
  const centreY = (WALL_TOP + WALL_BOTTOM) / 2;
  const outer = HALF + WALL_T;
  const wallParts = [
    [0, -HALF - WALL_T / 2, 2 * outer, WALL_T], // back
    [0, HALF + WALL_T / 2, 2 * outer, WALL_T], // front
    [-HALF - WALL_T / 2, 0, WALL_T, 2 * HALF], // left
    [HALF + WALL_T / 2, 0, WALL_T, 2 * HALF], // right
  ].map(([x, z, w, d]) => P(new THREE.BoxGeometry(w, height, d), '#fdf1dc', { pos: [x, centreY, z] }));
  const walls = new THREE.Mesh(mergeParts(wallParts), vertexColorMaterial);
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(2 * outer + 0.8, 0.22, 2 * outer + 0.8),
    lambert('#b97b4b'),
  );
  plate.position.y = WALL_BOTTOM - 0.11;
  group.add(walls, plate);
  setShadows(group, false, true);
  return { object: group };
}
