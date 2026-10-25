import * as THREE from 'three';
import { P, mulberry32, vertexColorMaterial } from './util.js';
import { CROSS_STREETS, INNER_RING, OUTER_RING, WHEEL } from './layout.js';
import { SHORE_X, islandHeight } from './island.js';
import { ROAD_Y, ringPoints } from './traffic.js';
import { bench, buildingDetails, busStop, createDetailLayer, crosswalk, lampPost, post, trafficLight } from './details.js';

// Street-level detail for the cartoon city: shops, air-conditioners and balconies on every tower,
// plus lamp posts, zebra crossings, traffic lights, bus stops, benches and extra trees.

const FLOOR_H = 0.2; // the ribbon windows of the towers repeat every 0.2

function walk(pts, closed, step, fn) {
  const n = pts.length;
  let carry = 0;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    const dx = (b[0] - a[0]) / len;
    const dz = (b[1] - a[1]) / len;
    for (let s = step - carry; s <= len; s += step) fn(a[0] + dx * s, a[1] + dz * s, dx, dz);
    carry = (carry + len) % step;
  }
}

export function createCityStreetscape(towers) {
  const rng = mulberry32(4242);
  const layer = createDetailLayer({ material: vertexColorMaterial, cell: 2.4 });
  const y = ROAD_Y + 0.01;
  const ground = (x, z) => islandHeight(x, z) - 0.02;

  for (const t of towers) {
    if (t.kind === 'prism') continue; // the faceted tower has its own shape
    const { lit, glow } = buildingDetails({ w: t.w, d: t.d, h: t.h, y0: t.y0, floorH: FLOOR_H, skin: 0.012, rng });
    layer.local(t.x, t.z, 0, lit, glow);
  }

  // ---- roads ----
  const addFurniture = (x, z, parts) => layer.world(x, z, parts);
  const side = (ring, off) => ringPoints(ring, off);

  // lamp posts, bus stops and benches along the outer (tram) ring, on the outside pavement
  let k = 0;
  walk(side(OUTER_RING, OUTER_RING.width / 2 + 0.018), true, 0.55, (x, z, dx, dz) => {
    k++;
    if (k % 7 === 3) addFurniture(x, z, busStop(x, y, z, Math.atan2(dx, dz) + Math.PI / 2, 1));
    else if (k % 3 === 0) addFurniture(x, z, lampPost(x, y, z, 1, Math.atan2(dx, dz) - Math.PI / 2));
  });
  // inner ring: lamp posts and street trees on the inside pavement
  k = 0;
  walk(side(INNER_RING, -(INNER_RING.width / 2 + 0.012)), true, 0.5, (x, z, dx, dz) => {
    k++;
    if (k % 3 === 0) addFurniture(x, z, lampPost(x, y, z, 0.9, Math.atan2(dx, dz) + Math.PI / 2));
  });

  // ---- crossings: where a cross street meets the inner ring ----
  for (const s of CROSS_STREETS) {
    const horizontal = s.z0 === s.z1;
    const ends = horizontal ? [[s.x0 + 0.26, s.z0, 1, 0], [s.x1 - 0.26, s.z0, -1, 0]] : [[s.x0, s.z0 + 0.26, 0, 1], [s.x0, s.z1 - 0.26, 0, -1]];
    for (const [cx, cz, dx, dz] of ends) {
      addFurniture(cx, cz, crosswalk(cx, y + 0.002, cz, dx, dz, s.width));
      // a traffic light on each kerb, facing the approaching cars
      const px = -dz * (s.width / 2 + 0.03);
      const pz = dx * (s.width / 2 + 0.03);
      addFurniture(cx, cz, trafficLight(cx + px, y, cz + pz, 1));
      addFurniture(cx, cz, trafficLight(cx - px, y, cz - pz, 1));
    }
  }
  // zebra crossings on the inner ring at its four sides
  for (const [cx, cz, dx, dz] of [
    [-1.4, INNER_RING.z0, 1, 0],
    [-1.4, INNER_RING.z1, 1, 0],
    [INNER_RING.x0, 1.4, 0, 1],
    [INNER_RING.x1, -1.4, 0, 1],
  ]) {
    addFurniture(cx, cz, crosswalk(cx, y + 0.002, cz, dx, dz, INNER_RING.width));
  }

  // ---- harbour promenade: benches, extra lamps and planters ----
  for (let z = -3.9 + 0.2; z <= 4.0; z += 0.85) {
    if (Math.abs(z - WHEEL.z) < 1.0) continue;
    const x = SHORE_X - 0.5;
    addFurniture(x, z, bench(x, ground(x, z), z, Math.PI / 2, 1.2));
  }
  // small trees along the sidewalks of the ring roads
  const tree = (x, z) => {
    const g = ground(x, z);
    addFurniture(x, z, [
      post(0.01, 0.09, '#7a5535', x, g, z),
      P(new THREE.IcosahedronGeometry(0.06, 0), rng() < 0.5 ? '#4f9d5a' : '#63b36b', { pos: [x, g + 0.15, z] }),
    ]);
  };
  k = 0;
  walk(side(INNER_RING, -(INNER_RING.width / 2 + 0.01)), true, 0.5, (x, z) => {
    if (++k % 3 === 1) tree(x, z);
  });

  layer.build();
  return layer;
}
