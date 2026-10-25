import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { P, gridGeometry, makeLoop, markSolid, mergeParts, mulberry32, setShadows, smoothstep } from '../util.js';
import { HALF, createBase } from '../island.js';
import { createClockBoard } from '../clockboard.js';
import { glowTexture } from '../textures.js';
import { lightsGeometry, taxiGeometry } from '../traffic.js';
import { createCoastFoam, createRealSea } from '../real/water.js';
import { facadeBox, makeFacadeTextures } from '../real/facade.js';
import { distToPolyline, inPolygon, pointAlong, polylineLength, signedDistance, smoothClosed } from '../real/geo.js';
import data from '../real/kowloonbay.data.js';

// The second map: a realistic Kowloon Bay. Layout comes from kowloonbay.data.js (traced from a
// screenshot, storeys estimated). Buildings are generated to fill the blocks between the roads.

const K = (2 * HALF) / data.size; // reference pixels -> world units
const LAND_Y = 0.14;
const VEXAG = 1.5; // heights are exaggerated so the towers read at this tiny size
const METRES_PER_UNIT = (data.metresPerPixel * data.size) / (2 * HALF);
const STOREY = (3.3 * VEXAG) / METRES_PER_UNIT;

const toWorld = ([px, py]) => [(px - data.origin[0] - data.size / 2) * K, (py - data.origin[1] - data.size / 2) * K];
const polyWorld = (poly) => poly.map(toWorld);

// ---- the map in world units -------------------------------------------------------------------

// Optional parts of the data format default to empty, so a sparse OSM import still works.
const rail = data.rail ?? { corridor: [], tracks: [], offsets: [] };
const water = polyWorld(data.water ?? []);
const promenade = polyWorld(data.promenade ?? []);
const parks = (data.parks ?? []).map(polyWorld);
const railCorridor = polyWorld(rail.corridor);
const roads = data.roads.map((r) => ({ ...r, pts: r.pts.map(toWorld), w: r.width * K * 1.15 }));
const zones = (data.zones ?? []).map((z) => ({ ...z, poly: polyWorld(z.poly) }));
const landmarks = (data.landmarks ?? []).map((l) => {
  const [x, z] = toWorld([l.x, l.y]);
  return { ...l, wx: x, wz: z, ww: l.w * K, wd: l.d * K };
});

/** Distance from the coast: positive over land (outside the water polygon), negative in the water. */
const landDistance = (x, z) => signedDistance(x, z, water);

/** Ground height: flat land with a short slope down into the water. */
function groundHeight(x, z) {
  return -0.55 + (LAND_Y + 0.55) * smoothstep(-0.14, 0.04, landDistance(x, z));
}

const PALETTE = ['#cfc9bd', '#bdb7aa', '#aab7c2', '#d1bfa8', '#b4bcc4', '#a3a8b0', '#d6cbb6', '#9fb8cf', '#b5c8b9'];

// ---- buildings --------------------------------------------------------------------------------

function storeysAt(x, z, rng) {
  let range = data.defaultStoreys ?? [12, 26];
  for (const zone of zones) {
    if (inPolygon(x, z, zone.poly)) {
      range = zone.storeys;
      break;
    }
  }
  return Math.round(range[0] + (range[1] - range[0]) * Math.pow(rng(), 1.3));
}

/** Buildings given as footprints (an OSM import): each becomes its oriented bounding rectangle. */
function explicitBuildings() {
  const out = [];
  for (const b of data.buildings) {
    const pts = b.pts.map(toWorld);
    if (pts.length < 3) continue;
    // orient the box along the polygon's longest edge
    let best = 0;
    let angle = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const c = pts[(i + 1) % pts.length];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len > best) {
        best = len;
        angle = Math.atan2(c[1] - a[1], c[0] - a[0]);
      }
    }
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [x, z] of pts) {
      const u = x * cos + z * sin;
      const v = -x * sin + z * cos;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u);
      minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    const cu = (minU + maxU) / 2;
    const cv = (minV + maxV) / 2;
    out.push({ x: cu * cos - cv * sin, z: cu * sin + cv * cos, w: Math.max(0.05, maxU - minU), d: Math.max(0.05, maxV - minV), rot: -angle, storeys: Math.max(1, Math.round(b.storeys ?? 8)), color: PALETTE[out.length % PALETTE.length] });
  }
  // the tallest building carries the clock
  const tallest = out.reduce((a, b) => (b.storeys > (a?.storeys ?? 0) ? b : a), null);
  if (tallest) tallest.landmark = { clock: true };
  return out;
}

/** Fill the blocks between roads with buildings; landmarks go in first. */
function generateBuildings(rng) {
  const G = 96;
  const cell = (2 * HALF) / G;
  const free = new Uint8Array(G * G);
  const cx = (i) => -HALF + (i + 0.5) * cell;
  for (let j = 0; j < G; j++) {
    for (let i = 0; i < G; i++) {
      const x = cx(i);
      const z = cx(j);
      let ok = landDistance(x, z) > 0.12 && !inPolygon(x, z, promenade) && !inPolygon(x, z, railCorridor);
      if (ok) ok = !parks.some((p) => inPolygon(x, z, p));
      if (ok) ok = !roads.some((r) => distToPolyline(x, z, r.pts) < r.w / 2 + 0.02);
      free[j * G + i] = ok ? 1 : 0;
    }
  }

  const buildings = [];
  if (data.buildings?.length) return explicitBuildings();
  for (const l of landmarks) {
    buildings.push({ x: l.wx, z: l.wz, w: l.ww, d: l.wd, storeys: l.storeys, color: l.color, landmark: l });
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        if (Math.abs(cx(i) - l.wx) < l.ww / 2 + 0.03 && Math.abs(cx(j) - l.wz) < l.wd / 2 + 0.03) free[j * G + i] = 0;
      }
    }
  }

  const fits = (i, j, w, d) => {
    if (i + w > G || j + d > G) return false;
    for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) if (!free[(j + b) * G + i + a]) return false;
    return true;
  };
  for (let j = 0; j < G; j++) {
    for (let i = 0; i < G; i++) {
      if (!free[j * G + i]) continue;
      let w = 3 + Math.floor(rng() * 3);
      let d = 3 + Math.floor(rng() * 3);
      while ((w > 1 || d > 1) && !fits(i, j, w, d)) {
        if (w >= d && w > 1) w--;
        else if (d > 1) d--;
      }
      for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) free[(j + b) * G + i + a] = 0;
      if (w * d <= 2 || rng() < 0.18) continue; // leave small leftovers and some plots open (plazas, car parks)
      const x = -HALF + (i + w / 2) * cell;
      const z = -HALF + (j + d / 2) * cell;
      buildings.push({ x, z, w: w * cell - 0.03, d: d * cell - 0.03, storeys: storeysAt(x, z, rng), color: PALETTE[Math.floor(rng() * PALETTE.length)] });
      // a lane of free space beside some buildings keeps the blocks from looking solid
      if (rng() < 0.55 && i + w < G) for (let b = 0; b < d; b++) free[(j + b) * G + i + w] = 0;
      if (rng() < 0.55 && j + d < G) for (let a = 0; a < w; a++) free[(j + d) * G + i + a] = 0;
    }
  }
  return buildings;
}

function buildingGeometries(buildings, rng) {
  const geos = [];
  const footprints = [];
  let clock = null;
  for (const b of buildings) {
    const y0 = LAND_Y - 0.01;
    const h = b.storeys * STOREY;
    const offsetU = rng();
    footprints.push({ x: b.x, z: b.z, hw: b.w / 2 + 0.03, hd: b.d / 2 + 0.03 });
    let roofY = y0 + h;
    if (b.storeys >= 18 && !b.landmark && rng() < 0.55) {
      // podium-style setback: full footprint to 65%, a narrower shaft above
      const h1 = h * 0.65;
      geos.push(facadeBox({ x: b.x, z: b.z, w: b.w, d: b.d, h: h1, y0, color: b.color, offsetU, rot: b.rot }));
      geos.push(facadeBox({ x: b.x, z: b.z, w: b.w * 0.8, d: b.d * 0.8, h: h - h1, y0: y0 + h1, color: b.color, offsetU, rot: b.rot }));
    } else {
      geos.push(facadeBox({ x: b.x, z: b.z, w: b.w, d: b.d, h, y0, color: b.color, offsetU, rot: b.rot }));
    }
    // roof plant: a couple of small plain boxes
    const plants = b.storeys > 3 ? 1 + Math.floor(rng() * 2) : 0;
    for (let k = 0; k < plants; k++) {
      const pw = Math.min(0.08, b.w * 0.3);
      geos.push(
        facadeBox({
          x: b.x + (rng() - 0.5) * b.w * 0.5,
          z: b.z + (rng() - 0.5) * b.d * 0.5,
          w: pw,
          d: pw,
          h: 0.035,
          y0: roofY,
          color: '#8f959c',
          plain: true,
        }),
      );
    }
    if (b.landmark?.clock) clock = { x: b.x, z: b.z, y: roofY };
  }
  return { geos, footprints, clock };
}

// ---- roads, rail, trees -----------------------------------------------------------------------

const ROAD_COLORS = { major: '#4a4f58', street: '#555a63', minor: '#60656e' };
const ROAD_LIFT = { major: 0.004, street: 0.003, minor: 0.002 };

function segmentBox(a, b, width, color, y) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return P(new THREE.BoxGeometry(width, 0.012, len + 0.004), color, {
    pos: [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2],
    rot: [0, Math.atan2(b[0] - a[0], b[1] - a[1]), 0],
  });
}

function roadParts() {
  const parts = [];
  const joint = new THREE.CylinderGeometry(0.5, 0.5, 0.012, 10);
  for (const r of roads) {
    const y = LAND_Y + ROAD_LIFT[r.kind];
    const color = ROAD_COLORS[r.kind];
    for (let i = 1; i < r.pts.length; i++) parts.push(segmentBox(r.pts[i - 1], r.pts[i], r.w, color, y));
    for (const p of r.pts) parts.push(P(joint, color, { pos: [p[0], y, p[1]], scale: [r.w, 1, r.w] }));
    if (r.kind === 'major') {
      // dashed lane marking along the centre line
      const total = polylineLength(r.pts);
      const q = { x: 0, z: 0, dx: 0, dz: 1 };
      for (let s = 0.1; s < total - 0.1; s += 0.3) {
        pointAlong(r.pts, s, q);
        parts.push(P(new THREE.BoxGeometry(0.012, 0.014, 0.12), '#d8d4c8', { pos: [q.x, y + 0.002, q.z], rot: [0, Math.atan2(q.dx, q.dz), 0] }));
      }
    }
  }
  return parts;
}

/** Offset a polyline sideways by `off` units (used for the parallel rail tracks). */
function offsetPolyline(pts, off) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [p[0] - ((b[1] - a[1]) / len) * off, p[1] + ((b[0] - a[0]) / len) * off];
  });
}

const trackLines = rail.tracks.length ? rail.offsets.map((o) => offsetPolyline(rail.tracks.map(toWorld), o * K)) : [];

function railParts() {
  const parts = [];
  for (const line of trackLines) {
    for (let i = 1; i < line.length; i++) parts.push(segmentBox(line[i - 1], line[i], 0.014, '#9ea4ab', LAND_Y + 0.012));
  }
  return parts;
}

function treeParts(rng) {
  const parts = [];
  const tree = (x, z, s) => {
    const y = LAND_Y;
    parts.push(P(new THREE.CylinderGeometry(0.008 * s, 0.011 * s, 0.07 * s, 5), '#6e5238', { pos: [x, y + 0.035 * s, z] }));
    parts.push(P(new THREE.IcosahedronGeometry(0.05 * s, 1), rng() < 0.5 ? '#4f8f4e' : '#5fa35a', { pos: [x, y + 0.1 * s, z] }));
  };
  for (const poly of parks) {
    const xs = poly.map((p) => p[0]);
    const zs = poly.map((p) => p[1]);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const [z0, z1] = [Math.min(...zs), Math.max(...zs)];
    const area = (x1 - x0) * (z1 - z0);
    const n = Math.min(14, Math.floor(area / 0.03));
    for (let k = 0; k < n; k++) {
      const x = x0 + rng() * (x1 - x0);
      const z = z0 + rng() * (z1 - z0);
      if (inPolygon(x, z, poly)) tree(x, z, 0.8 + rng() * 0.5);
    }
  }
  // street trees along the big roads
  for (const r of roads.filter((q) => q.kind === 'major')) {
    const total = polylineLength(r.pts);
    const q = { x: 0, z: 0, dx: 0, dz: 1 };
    for (let s = 0.2, side = 1; s < total - 0.2; s += 0.45, side = -side) {
      pointAlong(r.pts, s, q);
      const x = q.x - q.dz * side * (r.w / 2 + 0.05);
      const z = q.z + q.dx * side * (r.w / 2 + 0.05);
      if (Math.abs(x) > HALF - 0.1 || Math.abs(z) > HALF - 0.1) continue;
      if (landDistance(x, z) < 0.15 || inPolygon(x, z, promenade)) continue;
      if (roads.some((o) => o !== r && distToPolyline(x, z, o.pts) < o.w / 2 + 0.03)) continue;
      if (rng() < 0.7) tree(x, z, 0.7);
    }
  }
  return parts;
}

// ---- traffic ----------------------------------------------------------------------------------

function loopFromPoints(pts) {
  const n = pts.length;
  return makeLoop((u) => {
    const f = u * n;
    const i = Math.floor(f) % n;
    const k = f - Math.floor(f);
    const a = pts[i];
    const b = pts[(i + 1) % n];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  }, 600);
}

/** Taxis circling the main blocks and MTR trains running along the rail corridor. */
function createTraffic() {
  const group = new THREE.Group();

  const taxiMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3 });
  const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const taxiGeo = taxiGeometry();
  const taxiLights = lightsGeometry(0.1, 0.19, 0.075, 0.035);
  const taxiPts = (data.taxiLoop ?? []).map(toWorld);
  const loop = taxiPts.length > 2 ? loopFromPoints(smoothClosed(taxiPts, 3)) : null;
  const taxis = [];
  for (let i = 0; loop && i < 6; i++) {
    const mesh = new THREE.Mesh(taxiGeo, taxiMat);
    mesh.add(new THREE.Mesh(taxiLights, lightMat));
    mesh.scale.setScalar(0.36);
    setShadows(mesh, true, false);
    group.add(mesh);
    taxis.push({ mesh, start: (i / 6) * loop.length });
  }

  // MTR trains: white cars with a green stripe, cut off cleanly at the edges of the map.
  const clip = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), HALF),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), HALF),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), HALF),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), HALF),
  ];
  const trainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.4, clippingPlanes: clip });
  const trainParts = [];
  for (let k = 0; k < 4; k++) {
    const z = (k - 1.5) * 0.2;
    trainParts.push(P(new THREE.BoxGeometry(0.075, 0.07, 0.19), '#e9edf1', { pos: [0, 0.055, z] }));
    trainParts.push(P(new THREE.BoxGeometry(0.078, 0.014, 0.19), '#1d9a52', { pos: [0, 0.04, z] }));
    trainParts.push(P(new THREE.BoxGeometry(0.078, 0.022, 0.17), '#26323f', { pos: [0, 0.07, z] }));
  }
  const trainGeo = mergeParts(trainParts);
  const rails = trackLines.length > 2 ? [trackLines[1], trackLines[2]] : []; // the two inner tracks
  const trains = rails.map((line, idx) => {
    const path = idx === 0 ? line : [...line].reverse(); // one runs each way
    // extend the path past both ends so the train enters and leaves outside the map
    const first = path[0];
    const second = path[1];
    const last = path[path.length - 1];
    const prev = path[path.length - 2];
    const norm = (a, b) => {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    };
    const d0 = norm(second, first);
    const d1 = norm(prev, last);
    const extended = [[first[0] + d0[0] * 1.5, first[1] + d0[1] * 1.5], ...path, [last[0] + d1[0] * 1.5, last[1] + d1[1] * 1.5]];
    const mesh = new THREE.Mesh(trainGeo, trainMat);
    setShadows(mesh, true, false);
    group.add(mesh);
    return { mesh, path: extended, length: polylineLength(extended), offset: idx * 6 };
  });

  const p = { x: 0, z: 0, dx: 0, dz: 1 };
  const q = { x: 0, z: 0 };
  return {
    object: group,
    update(t, dt, env) {
      lightMat.color.setScalar(0.3 + 0.7 * env.night);
      for (const taxi of taxis) {
        const s = taxi.start + t * 0.45;
        loop.at(s, p);
        loop.at(s + 0.05, q);
        taxi.mesh.position.set(p.x, LAND_Y + 0.012, p.z);
        taxi.mesh.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
      }
      for (const train of trains) {
        const s = ((t * 0.5 + train.offset) % (train.length + 1.2)) - 0.6;
        pointAlong(train.path, s, p);
        train.mesh.position.set(p.x, LAND_Y + 0.012, p.z);
        train.mesh.rotation.y = Math.atan2(p.dx, p.dz);
      }
    },
  };
}

// ---- the world --------------------------------------------------------------------------------

export function createKowloonBay() {
  const rng = mulberry32(1997);
  const buildings = generateBuildings(rng);
  const { geos, footprints, clock } = buildingGeometries(buildings, rng);

  // baked occlusion on the ground around buildings
  const ao = (x, z) => {
    let k = 1;
    for (const f of footprints) {
      const dx = Math.max(Math.abs(x - f.x) - f.hw, 0);
      const dz = Math.max(Math.abs(z - f.z) - f.hd, 0);
      k = Math.min(k, 0.66 + 0.34 * smoothstep(0, 0.3, Math.hypot(dx, dz)));
    }
    return k;
  };

  // ground: concrete between blocks, grass in parks, paving on the reclaimed promenade, ballast on the rail
  const ground = (() => {
    const n = 120;
    const geometry = gridGeometry(n, n, (i, j) => {
      const x = -HALF + (2 * HALF * i) / n;
      const z = -HALF + (2 * HALF * j) / n;
      return [x, groundHeight(x, z), z];
    });
    const pos = geometry.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      if (inPolygon(x, z, railCorridor)) c.set('#6d6862');
      else if (parks.some((p) => inPolygon(x, z, p))) c.set('#5e9d58');
      else if (inPolygon(x, z, promenade)) c.set('#8f8da6');
      else c.set('#a7acb3');
      if (landDistance(x, z) < 0.03) c.lerp(new THREE.Color('#8c7f6a'), 0.6); // sea wall / beach edge
      c.multiplyScalar((1 + 0.03 * Math.sin(x * 11 + z * 7)) * ao(x, z));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    setShadows(mesh, false, true);
    return { object: mesh };
  })();

  const base = createBase({ heightAt: groundHeight });
  const sea = createRealSea((x, z) => -landDistance(x, z)); // positive over water
  const foam = createCoastFoam(water);

  const textures = makeFacadeTextures();
  const buildingMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: textures.map,
    emissiveMap: textures.emissive,
    emissive: 0xffffff,
    emissiveIntensity: 0,
    roughness: 0.45,
    metalness: 0.15,
  });
  const buildingMesh = new THREE.Mesh(mergeGeometries(geos, false), buildingMaterial);
  setShadows(buildingMesh, true, true);

  const roadMesh = new THREE.Mesh(
    mergeParts([...roadParts(), ...railParts()]),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
  );
  setShadows(roadMesh, false, true);
  const treeMesh = new THREE.Mesh(mergeParts(treeParts(rng)), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  setShadows(treeMesh, true, true);

  const traffic = createTraffic();

  // street lights along the big roads: soft glows at night
  const lampPositions = [];
  for (const r of roads.filter((q) => q.kind === 'major')) {
    const total = polylineLength(r.pts);
    const q = { x: 0, z: 0, dx: 0, dz: 1 };
    for (let s = 0.15; s < total - 0.15; s += 0.42) {
      pointAlong(r.pts, s, q);
      const x = q.x - q.dz * (r.w / 2 + 0.02);
      const z = q.z + q.dx * (r.w / 2 + 0.02);
      if (Math.abs(x) < HALF - 0.1 && Math.abs(z) < HALF - 0.1 && landDistance(x, z) > 0.1) lampPositions.push(x, LAND_Y + 0.07, z);
    }
  }
  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lampPositions, 3));
  const glowMaterial = new THREE.PointsMaterial({
    size: 0.32,
    map: glowTexture(),
    color: 0xffd58a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Points(glowGeometry, glowMaterial);
  glow.frustumCulled = false;

  // rooftop digital clock on MegaBox
  const board = createClockBoard({ x: clock?.x ?? 0, y: clock?.y ?? 1, z: clock?.z ?? 0, scale: 0.5 });
  const camera = { position: new THREE.Vector3(0, 10, 10) };

  const staticParts = new THREE.Group();
  staticParts.add(buildingMesh, roadMesh, treeMesh, board.group);

  let environmentTexture = null;
  let sceneRef = null;
  let rendererRef = null;

  const atmosphere = {
    object: new THREE.Group(),
    update(t, dt, env) {
      buildingMaterial.emissiveIntensity = 0.95 * env.night; // lit windows
      glowMaterial.opacity = 0.9 * env.night;
      glow.visible = env.night > 0.01;
      board.update(env, camera.position);
      if (sceneRef) sceneRef.environmentIntensity = 0.3 - 0.2 * env.night; // reflections fade with the daylight
      if (rendererRef) rendererRef.toneMappingExposure = 0.8 + 0.1 * env.night;
    },
  };

  const solid = [ground.object, base.object, sea.object, staticParts, traffic.object];
  for (const o of solid) markSolid(o);

  return {
    id: 'kowloon-bay',
    parts: [ground, base, sea, foam, { object: staticParts }, traffic, atmosphere],
    solid,
    extras: [glow],
    boundingRadius: 6.9,
    setCamera(cam) {
      camera.position = cam.position;
    },
    /** Realistic look: filmic tone mapping, image-based reflections, clipping planes for the trains. */
    configure({ renderer, scene, lighting }) {
      lighting.sun.shadow.mapSize.set(1024, 1024); // the realistic look is heavier: keep the shadow map small
      rendererRef = renderer;
      sceneRef = scene;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.8;
      renderer.localClippingEnabled = true;
      const pmrem = new THREE.PMREMGenerator(renderer);
      environmentTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = environmentTexture;
      scene.environmentIntensity = 0.3;
      pmrem.dispose();
    },
    debug: { sea, foam, traffic, board, buildings: buildings.length, footprints },
  };
}
