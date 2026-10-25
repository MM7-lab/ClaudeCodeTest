import * as THREE from 'three';
import { P, makeLoop, mergeParts, setShadows, vertexColorMaterial } from './util.js';
import { CROSS_STREETS, INNER_RING, OUTER_RING } from './layout.js';
import { GROUND_Y } from './island.js';

// Roads, tram rails, double-decker trams and red taxis driving round the ring roads.

export const ROAD_Y = GROUND_Y + 0.006;
const ASPHALT = '#5d636d';

/** Closed rounded-rectangle outline, offset outwards by `off` (negative = inwards). */
export function ringPoints(ring, off = 0, arcSteps = 8) {
  const x0 = ring.x0 - off;
  const x1 = ring.x1 + off;
  const z0 = ring.z0 - off;
  const z1 = ring.z1 + off;
  const r = Math.max(0.02, ring.r + off);
  // Corner centres, walked in the order: back edge (+x), harbour side (+z), front (-x), left (-z).
  const corners = [
    [x1 - r, z0 + r, -Math.PI / 2],
    [x1 - r, z1 - r, 0],
    [x0 + r, z1 - r, Math.PI / 2],
    [x0 + r, z0 + r, Math.PI],
  ];
  const pts = [];
  for (const [cx, cz, start] of corners) {
    for (let i = 0; i <= arcSteps; i++) {
      const a = start + (i / arcSteps) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  }
  return pts;
}

/** Flat strip along a closed or open polyline, as one box per segment. */
function stripParts(points, width, color, y, closed = true) {
  const parts = [];
  const n = points.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[(i + 1) % n];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-4) continue;
    parts.push(
      P(new THREE.BoxGeometry(width, 0.02, len + 0.012), color, {
        pos: [(ax + bx) / 2, y, (az + bz) / 2],
        rot: [0, Math.atan2(bx - ax, bz - az), 0],
      }),
    );
  }
  return parts;
}

function buildRoads() {
  const parts = [];
  // pavements: a slightly wider, lighter strip under every road
  parts.push(...stripParts(ringPoints(OUTER_RING), OUTER_RING.width + 0.07, '#b9bcc2', ROAD_Y - 0.005));
  parts.push(...stripParts(ringPoints(INNER_RING), INNER_RING.width + 0.07, '#b9bcc2', ROAD_Y - 0.005));
  for (const s of CROSS_STREETS) parts.push(...stripParts([[s.x0, s.z0], [s.x1, s.z1]], s.width + 0.07, '#b9bcc2', ROAD_Y - 0.005, false));
  parts.push(...stripParts(ringPoints(OUTER_RING), OUTER_RING.width, '#555b65', ROAD_Y));
  parts.push(...stripParts(ringPoints(INNER_RING), INNER_RING.width, ASPHALT, ROAD_Y));
  // tram rails on both sides of the outer ring's centre line
  for (const off of [-0.07, 0.07]) {
    parts.push(...stripParts(ringPoints(OUTER_RING, off), 0.016, '#b4bbc4', ROAD_Y + 0.014));
  }
  for (const s of CROSS_STREETS) {
    parts.push(...stripParts([[s.x0, s.z0], [s.x1, s.z1]], s.width, ASPHALT, ROAD_Y, false));
  }
  // dashed white centre line on the inner ring and the cross streets
  const dashes = (pts, closed) => {
    const n = pts.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[(i + 1) % n];
      const len = Math.hypot(bx - ax, bz - az);
      const count = Math.floor(len / 0.2);
      for (let k = 0; k < count; k++) {
        const f = (k + 0.5) / count;
        parts.push(P(new THREE.BoxGeometry(0.012, 0.004, 0.09), '#e6e3d8', {
          pos: [ax + (bx - ax) * f, ROAD_Y + 0.012, az + (bz - az) * f],
          rot: [0, Math.atan2(bx - ax, bz - az), 0],
        }));
      }
    }
  };
  dashes(ringPoints(INNER_RING), true);
  for (const s of CROSS_STREETS) dashes([[s.x0, s.z0], [s.x1, s.z1]], false);
  return parts;
}

/** Double-decker tram ("ding ding"): green lower deck, cream upper deck, ribbon windows. */
function tramGeometry() {
  const glass = '#26323f';
  return mergeParts([
    P(new THREE.BoxGeometry(0.22, 0.03, 0.66), '#3a3f47', { pos: [0, 0.03, 0] }), // bogies
    P(new THREE.BoxGeometry(0.26, 0.17, 0.72), '#2f7d52', { pos: [0, 0.14, 0] }), // lower deck
    P(new THREE.BoxGeometry(0.268, 0.07, 0.6), glass, { pos: [0, 0.155, 0] }),
    P(new THREE.BoxGeometry(0.262, 0.04, 0.26), '#ffd23f', { pos: [0, 0.095, 0.12] }), // advert panel
    P(new THREE.BoxGeometry(0.27, 0.02, 0.73), '#f1e6a8', { pos: [0, 0.235, 0] }), // ledge
    P(new THREE.BoxGeometry(0.24, 0.15, 0.68), '#efe9d2', { pos: [0, 0.32, 0] }), // upper deck
    P(new THREE.BoxGeometry(0.248, 0.07, 0.58), glass, { pos: [0, 0.335, 0] }),
    P(new THREE.BoxGeometry(0.22, 0.025, 0.66), '#d9dde2', { pos: [0, 0.41, 0] }), // roof
    P(new THREE.BoxGeometry(0.012, 0.1, 0.012), '#555b65', { pos: [0, 0.47, -0.05], rot: [0.5, 0, 0] }), // trolley pole
  ]);
}

/** Double-decker bus: red lower deck, cream band, upper deck with a window ribbon. */
export function busGeometry() {
  const glass = '#26323f';
  const wheel = new THREE.CylinderGeometry(0.036, 0.036, 0.03, 8);
  const parts = [
    P(new THREE.BoxGeometry(0.2, 0.15, 0.5), '#c8242b', { pos: [0, 0.11, 0] }),
    P(new THREE.BoxGeometry(0.206, 0.05, 0.42), glass, { pos: [0, 0.13, -0.01] }),
    P(new THREE.BoxGeometry(0.204, 0.018, 0.5), '#f0e8d0', { pos: [0, 0.195, 0] }),
    P(new THREE.BoxGeometry(0.196, 0.11, 0.48), '#c8242b', { pos: [0, 0.255, 0] }),
    P(new THREE.BoxGeometry(0.202, 0.05, 0.42), glass, { pos: [0, 0.265, -0.01] }),
    P(new THREE.BoxGeometry(0.19, 0.012, 0.47), '#dfe3e7', { pos: [0, 0.316, 0] }),
  ];
  for (const sx of [-0.1, 0.1]) {
    for (const sz of [-0.16, 0.16]) parts.push(P(wheel, '#22262b', { pos: [sx, 0.036, sz], rot: [0, 0, Math.PI / 2] }));
  }
  return mergeParts(parts);
}

const CAR_COLORS = ['#f2f2f2', '#2b3a55', '#b0b5bb', '#1c1f24', '#9a2a2a', '#3f6f9a', '#d8c27a', '#4f7a5a'];

function wheelsFor(parts, halfWidth, zs, radius = 0.036) {
  const wheel = new THREE.CylinderGeometry(radius, radius, 0.03, 8);
  for (const sx of [-halfWidth, halfWidth]) for (const sz of zs) parts.push(P(wheel, '#22262b', { pos: [sx, radius, sz], rot: [0, 0, Math.PI / 2] }));
}

/** Private car: coloured body, glass cabin. */
export function carGeometry(color) {
  const parts = [
    P(new THREE.BoxGeometry(0.19, 0.07, 0.4), color, { pos: [0, 0.07, 0] }),
    P(new THREE.BoxGeometry(0.17, 0.065, 0.2), color, { pos: [0, 0.14, -0.03] }),
    P(new THREE.BoxGeometry(0.176, 0.045, 0.206), '#2b3946', { pos: [0, 0.143, -0.03] }),
  ];
  wheelsFor(parts, 0.095, [-0.125, 0.125]);
  return mergeParts(parts);
}

/** Lorry: cab at the front (+z) and a cargo box behind it. */
export function truckGeometry(color) {
  const parts = [
    P(new THREE.BoxGeometry(0.2, 0.12, 0.15), color, { pos: [0, 0.11, 0.2] }),
    P(new THREE.BoxGeometry(0.202, 0.05, 0.1), '#2b3946', { pos: [0, 0.14, 0.215] }),
    P(new THREE.BoxGeometry(0.22, 0.17, 0.36), '#e9ecef', { pos: [0, 0.15, -0.08] }),
    P(new THREE.BoxGeometry(0.222, 0.02, 0.36), color, { pos: [0, 0.07, -0.08] }),
    P(new THREE.BoxGeometry(0.2, 0.03, 0.54), '#3a3f47', { pos: [0, 0.045, 0] }),
  ];
  wheelsFor(parts, 0.105, [-0.2, -0.04, 0.2], 0.04);
  return mergeParts(parts);
}

/** Public light bus (minibus): cream body, red or green roof band. */
export function minibusGeometry(roof) {
  const parts = [
    P(new THREE.BoxGeometry(0.19, 0.15, 0.42), '#f1ead2', { pos: [0, 0.115, 0] }),
    P(new THREE.BoxGeometry(0.196, 0.05, 0.36), '#2b3946', { pos: [0, 0.14, -0.01] }),
    P(new THREE.BoxGeometry(0.195, 0.025, 0.42), roof, { pos: [0, 0.2, 0] }),
    P(new THREE.BoxGeometry(0.194, 0.02, 0.42), roof, { pos: [0, 0.07, 0] }),
  ];
  wheelsFor(parts, 0.095, [-0.13, 0.13]);
  return mergeParts(parts);
}

/**
 * The road vehicles: kind is 'taxi' | 'car' | 'truck' | 'bus' | 'minibus'; `i` picks a colour.
 * Returns { geometry, lights }; geometries are cached, so equal vehicles share them.
 */
const vehicleCache = new Map();
export function vehicleSpec(kind, i = 0) {
  const variant = kind === 'taxi' || kind === 'bus' ? 0 : i;
  const key = `${kind}:${kind === 'minibus' ? variant % 2 : variant % CAR_COLORS.length}`;
  let spec = vehicleCache.get(key);
  if (!spec) {
    const color = CAR_COLORS[variant % CAR_COLORS.length];
    spec =
      kind === 'taxi' ? { geometry: taxiGeometry(), lights: lightsGeometry(0.1, 0.19, 0.075, 0.035) }
      : kind === 'bus' ? { geometry: busGeometry(), lights: lightsGeometry(0.1, 0.25, 0.09, 0.04) }
      : kind === 'truck' ? { geometry: truckGeometry(['#2f5f9a', '#c8242b', '#e0a526', '#2f7d52'][variant % 4]), lights: lightsGeometry(0.1, 0.27, 0.09, 0.04) }
      : kind === 'minibus' ? { geometry: minibusGeometry(variant % 2 ? '#2f8f4e' : '#d1262b'), lights: lightsGeometry(0.09, 0.21, 0.09, 0.04) }
      : { geometry: carGeometry(color), lights: lightsGeometry(0.095, 0.2, 0.075, 0.035) };
    vehicleCache.set(key, spec);
  }
  return spec;
}

/** Red taxi: red body, silver roof, roof sign, four wheels. */
export function taxiGeometry() {
  const wheel = new THREE.CylinderGeometry(0.036, 0.036, 0.03, 8);
  const parts = [
    P(new THREE.BoxGeometry(0.2, 0.075, 0.38), '#e0312c', { pos: [0, 0.07, 0] }),
    P(new THREE.BoxGeometry(0.18, 0.07, 0.2), '#e0312c', { pos: [0, 0.14, -0.02] }),
    P(new THREE.BoxGeometry(0.186, 0.045, 0.206), '#2b3946', { pos: [0, 0.145, -0.02] }),
    P(new THREE.BoxGeometry(0.17, 0.014, 0.19), '#cfd5db', { pos: [0, 0.18, -0.02] }),
    P(new THREE.BoxGeometry(0.05, 0.022, 0.07), '#fff2a8', { pos: [0, 0.2, -0.02] }),
  ];
  for (const sx of [-0.1, 0.1]) {
    for (const sz of [-0.12, 0.12]) parts.push(P(wheel, '#22262b', { pos: [sx, 0.036, sz], rot: [0, 0, Math.PI / 2] }));
  }
  return mergeParts(parts);
}

/** Head and tail lights for a vehicle of the given half width and half length (unlit, glow at night). */
export function lightsGeometry(halfWidth, halfLength, y, size) {
  const parts = [];
  for (const sx of [-1, 1]) {
    parts.push(P(new THREE.BoxGeometry(size, size, 0.012), '#fff3c4', { pos: [sx * halfWidth * 0.62, y, halfLength + 0.004] })); // headlights
    parts.push(P(new THREE.BoxGeometry(size, size, 0.012), '#ff3030', { pos: [sx * halfWidth * 0.62, y, -halfLength - 0.004] })); // tail lights
  }
  return mergeParts(parts);
}

/** Vehicles keep driving round their ring at a constant speed. */
export function createTraffic() {
  const group = new THREE.Group();

  const roads = new THREE.Mesh(mergeParts(buildRoads()), vertexColorMaterial);
  setShadows(roads, false, true);
  group.add(roads);

  const loopFor = (ring, reverse) => {
    const pts = ringPoints(ring);
    if (reverse) pts.reverse();
    const n = pts.length;
    return makeLoop((u) => {
      const f = u * n;
      const i = Math.floor(f) % n;
      const k = f - Math.floor(f);
      const a = pts[i];
      const b = pts[(i + 1) % n];
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    });
  };

  const outerLoop = loopFor(OUTER_RING, false);
  const innerLoop = loopFor(INNER_RING, true);
  const tram = { geometry: tramGeometry(), lights: lightsGeometry(0.13, 0.36, 0.1, 0.05) };
  const lightMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });

  const vehicles = [];
  const add = (spec, loop, fraction, speed) => {
    const mesh = new THREE.Mesh(spec.geometry, vertexColorMaterial);
    mesh.add(new THREE.Mesh(spec.lights, lightMaterial));
    setShadows(mesh, true, false);
    group.add(mesh);
    vehicles.push({ mesh, loop, start: fraction * loop.length, speed });
  };
  // Everything on a ring moves at the same speed, so the gaps between vehicles never change and
  // nothing ever drives through anything else.
  const SPEED = 0.45;
  for (const f of [0, 0.5]) add(tram, outerLoop, f, SPEED);
  const outer = [[0.12, 'taxi'], [0.18, 'bus'], [0.24, 'car'], [0.34, 'taxi'], [0.45, 'truck'], [0.56, 'taxi'], [0.62, 'car'], [0.68, 'minibus'], [0.78, 'taxi'], [0.9, 'car'], [0.95, 'car']];
  outer.forEach(([f, kind], i) => add(vehicleSpec(kind, i), outerLoop, f, SPEED));
  const inner = [[0.1, 'taxi'], [0.22, 'car'], [0.35, 'bus'], [0.47, 'truck'], [0.6, 'taxi'], [0.72, 'minibus'], [0.85, 'bus'], [0.97, 'car']];
  inner.forEach(([f, kind], i) => add(vehicleSpec(kind, i + 3), innerLoop, f, 0.55));

  const p0 = { x: 0, z: 0 };
  const p1 = { x: 0, z: 0 };
  return {
    object: group,
    update(t, dt, env) {
      lightMaterial.color.setScalar(0.3 + 0.7 * env.night); // dim by day, bright at night
      for (const v of vehicles) {
        const s = v.start + t * v.speed;
        v.loop.at(s, p0);
        v.loop.at(s + 0.05, p1);
        v.mesh.position.set(p0.x, ROAD_Y + 0.01, p0.z);
        v.mesh.rotation.y = Math.atan2(p1.x - p0.x, p1.z - p0.z);
      }
    },
  };
}
