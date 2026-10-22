import * as THREE from 'three';
import { lambert, polarGrid, smoothstep, setShadows } from './util.js';

/** Mean radius of the waterline (where the sand meets the sea). */
export const SHORE_R = 3.15;
/** Inner radius of the cylindrical diorama wall. */
export const TRAY_R = 5.5;

/** Radius multiplier that makes the shoreline irregular instead of a perfect circle. */
function shoreScale(theta) {
  return 1 + 0.045 * Math.sin(3 * theta + 0.8) + 0.03 * Math.sin(5 * theta + 2.1);
}

export function shoreRadius(theta) {
  return SHORE_R * shoreScale(theta);
}

// Sand profile: [normalised radius, height]. y = 0 is the mean sea level.
const PROFILE = [
  [0, 0.52],
  [1.0, 0.5],
  [1.9, 0.4],
  [2.5, 0.2],
  [SHORE_R, 0.0],
  [3.5, -0.28],
  [4.0, -0.55],
];

function profileY(r) {
  if (r >= PROFILE[PROFILE.length - 1][0]) return PROFILE[PROFILE.length - 1][1];
  for (let i = 1; i < PROFILE.length; i++) {
    if (r <= PROFILE[i][0]) {
      const [r0, y0] = PROFILE[i - 1];
      const [r1, y1] = PROFILE[i];
      return y0 + ((y1 - y0) * (r - r0)) / (r1 - r0);
    }
  }
  return PROFILE[0][1];
}

/** Ground height of the island at (x, z). Used for placing trees, people and props. */
export function islandHeight(x, z) {
  const theta = Math.atan2(z, x);
  const y = profileY(Math.hypot(x, z) / shoreScale(theta));
  const bumps = 0.035 * Math.sin(1.9 * x + 0.7) * Math.cos(2.3 * z - 0.4) + 0.02 * Math.sin(4.1 * x + 3.3 * z);
  return y + bumps * smoothstep(-0.1, 0.25, y);
}

const SAND_STOPS = [
  [0.45, new THREE.Color('#fbe9bd')],
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

export function createIsland() {
  const geometry = polarGrid({
    rInner: 0,
    rOuter: 4.6,
    rings: 20,
    segments: 40,
    heightFn: (x, z) => islandHeight(x, z),
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

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  );
  setShadows(mesh, true, true);
  return { object: mesh };
}

const WALL_H = 0.92; // wall spans y = -0.6 .. 0.32
const WALL_Y = -0.14;

/** The thin cylindrical "diorama" tray the sea sits in, on top of a wooden base plate. */
export function createBase() {
  const group = new THREE.Group();
  const wallOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(TRAY_R + 0.15, TRAY_R + 0.15, WALL_H, 48, 1, true),
    lambert('#fdf1dc'),
  );
  wallOuter.position.y = WALL_Y;
  const wallInner = new THREE.Mesh(
    new THREE.CylinderGeometry(TRAY_R, TRAY_R, WALL_H, 48, 1, true),
    lambert('#e7d3ae', { side: THREE.BackSide }),
  );
  wallInner.position.y = WALL_Y;
  const lip = new THREE.Mesh(new THREE.RingGeometry(TRAY_R, TRAY_R + 0.15, 48), lambert('#fffaf0'));
  lip.rotation.x = -Math.PI / 2;
  lip.position.y = 0.32;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(TRAY_R + 0.5, TRAY_R + 0.42, 0.22, 48), lambert('#b97b4b'));
  plate.position.y = WALL_Y - WALL_H / 2 - 0.11;
  group.add(wallOuter, wallInner, lip, plate);
  setShadows(group, false, true);
  return { object: group };
}
