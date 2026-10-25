import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { P, mergeParts, setShadows } from './util.js';

// Street-level detail shared by both maps. It is only shown when the camera has zoomed in
// (see `setViewDistance`), and it is split into spatial tiles so that frustum culling can skip
// every tile outside the picture.

const _m = new THREE.Matrix4();
const WHITE = new THREE.Color(1, 1, 1);
const GLASS_DAY = new THREE.Color(0.1, 0.13, 0.18);

/** Box piece for mergeParts, positioned by its centre. */
export const box = (w, h, d, color, x, y, z, ry = 0) => P(new THREE.BoxGeometry(w, h, d), color, { pos: [x, y, z], rot: [0, ry, 0] });
export const post = (r, h, color, x, y, z) => P(new THREE.CylinderGeometry(r * 0.8, r, h, 5), color, { pos: [x, y + h / 2, z] });

/**
 * A layer of detail meshes. `lit` pieces use `material` (the map's own lit material); `glow`
 * pieces (shop windows) use an unlit material that is dark by day and bright at night.
 */
export function createDetailLayer({ material, cell = 2.2, onAt = 0.5, offAt = 0.58 }) {
  const buckets = new Map();
  const bucket = (x, z) => {
    const key = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { lit: [], glow: [] }));
    return b;
  };
  const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, color: GLASS_DAY });
  const group = new THREE.Group();
  group.visible = false;

  const placed = (parts, x, z, rot) => {
    if (!parts.length) return null;
    const g = mergeParts(parts);
    if (rot || x || z) g.applyMatrix4(_m.makeRotationY(rot).setPosition(x, 0, z));
    return g;
  };

  return {
    group,
    /** Pieces in the local frame of a building at (x, z) turned by `rot` (y is absolute). */
    local(x, z, rot, lit, glow = []) {
      const b = bucket(x, z);
      const gl = placed(lit, x, z, rot);
      const gg = placed(glow, x, z, rot);
      if (gl) b.lit.push(gl);
      if (gg) b.glow.push(gg);
    },
    /** Pieces already in world coordinates; `x`, `z` only choose the tile. */
    world(x, z, lit, glow = []) {
      const b = bucket(x, z);
      const gl = placed(lit, 0, 0, 0);
      const gg = placed(glow, 0, 0, 0);
      if (gl) b.lit.push(gl);
      if (gg) b.glow.push(gg);
    },
    /** Merge each tile into one mesh per material. Call once, after everything was added. */
    build() {
      for (const b of buckets.values()) {
        if (b.lit.length) {
          const mesh = new THREE.Mesh(mergeGeometries(b.lit, false), material);
          setShadows(mesh, false, true);
          group.add(mesh);
        }
        if (b.glow.length) group.add(new THREE.Mesh(mergeGeometries(b.glow, false), glowMaterial));
      }
      for (const b of buckets.values()) for (const g of [...b.lit, ...b.glow]) g.dispose();
      buckets.clear();
    },
    /** Show the layer only while zoomed in (with some hysteresis, so it does not flicker). */
    setViewDistance(distance, fit) {
      const k = distance / fit;
      if (group.visible ? k > offAt : k < onAt) group.visible = !group.visible;
    },
    update(env) {
      glowMaterial.color.lerpColors(GLASS_DAY, WHITE, Math.pow(env.night, 0.8));
    },
  };
}

const AWNING = ['#d94b3f', '#2f8f6b', '#e0a526', '#3b6fb5', '#8a4fb0', '#e07a2a'];
const WARM = ['#ffd890', '#ffe8b0', '#cfe6ff'];

/**
 * Detail for one building, in its local frame (centred on x = z = 0, y absolute): ground-floor
 * shops with awnings, air-conditioners, balconies, and rooftop tank and aerial.
 *   w, d, h: size of the main shaft; y0: ground; floorH: height of one storey in world units;
 *   size: scale of the small features (defaults to floorH; larger makes them readable on tiny maps);
 *   skin: how far the existing windows already stand proud of the walls.
 */
export function buildingDetails({ w, d, h, y0, floorH, size = floorH, skin = 0, rng, shops = true, roof = true, upper = 'all' }) {
  const sz = size; // how big the little things are; floorH only spaces the storeys
  const lit = [];
  const glow = [];
  const storeys = Math.max(1, Math.round(h / floorH));
  const faces = [
    { nx: 1, nz: 0, width: d, half: w / 2 + skin },
    { nx: -1, nz: 0, width: d, half: w / 2 + skin },
    { nx: 0, nz: 1, width: w, half: d / 2 + skin },
    { nx: 0, nz: -1, width: w, half: d / 2 + skin },
  ];
  /** A box on a face: `u` along the wall, `y` height, `out` how far it sticks out. */
  const onFace = (f, u, y, along, tall, out, color, target = lit, lift = 0) => {
    const o = f.half + lift + out / 2;
    if (f.nx) target.push(box(out, tall, along, color, f.nx * o, y, u));
    else target.push(box(along, tall, out, color, u, y, f.nz * o));
  };

  if (shops && storeys >= 2) {
    for (const f of faces) {
      if (f.width < sz * 1.6) continue;
      const span = f.width * 0.86;
      onFace(f, 0, y0 + sz * 0.5, span, sz * 0.8, sz * 0.05, '#39434f'); // frame / wall below
      onFace(f, 0, y0 + sz * 0.46, span * 0.92, sz * 0.6, sz * 0.07, WARM[Math.floor(rng() * WARM.length)], glow);
      // awning, in two or three coloured pieces, like separate shops
      const pieces = f.width > sz * 4 ? 3 : f.width > sz * 2.4 ? 2 : 1;
      for (let k = 0; k < pieces; k++) {
        const len = span / pieces;
        const u = -span / 2 + len * (k + 0.5);
        onFace(f, u, y0 + sz * 0.88, len * 0.94, sz * 0.07, sz * 0.34, AWNING[Math.floor(rng() * AWNING.length)]);
      }
    }
  }

  // air-conditioners and balconies on the upper floors
  const units = upper === 'none' ? 0 : Math.min(12, Math.round(storeys * 0.5));
  for (let k = 0; k < units; k++) {
    const f = faces[Math.floor(rng() * 4)];
    const floor = 1 + Math.floor(rng() * Math.max(1, storeys - 1));
    const u = (rng() - 0.5) * f.width * 0.8;
    onFace(f, u, y0 + (floor + 0.4) * floorH, sz * 0.34, sz * 0.24, sz * 0.22, '#c9ced3', lit, 0.003);
  }
  if (storeys >= 4 && upper === 'all') {
    const f = faces[Math.floor(rng() * 4)];
    if (f.width > sz * 2) {
      const start = 1 + Math.floor(rng() * 2);
      for (let floor = start; floor < storeys - 1; floor += 2) {
        const y = y0 + floor * floorH + sz * 0.04;
        onFace(f, 0, y, f.width * 0.5, sz * 0.07, sz * 0.38, '#d3d6da');
        onFace(f, 0, y + sz * 0.13, f.width * 0.5, sz * 0.2, sz * 0.03, '#69727b', lit, sz * 0.35);
      }
    }
  }

  if (!roof) return { lit, glow };
  // roof: water tank, an aerial, maybe an extra plant box
  const top = y0 + h;
  const tx = (rng() - 0.5) * w * 0.4;
  const tz = (rng() - 0.5) * d * 0.4;
  const tankR = Math.min(w, d) * 0.12;
  lit.push(P(new THREE.CylinderGeometry(tankR, tankR, sz * 0.5, 8), '#8d9aa6', { pos: [tx, top + sz * 0.25, tz] }));
  lit.push(post(0.003 + sz * 0.01, sz * 1.4, '#59616b', -tx * 0.6, top, -tz * 0.6));
  if (rng() < 0.6) lit.push(box(w * 0.25, sz * 0.35, d * 0.2, '#a8aeb5', (rng() - 0.5) * w * 0.4, top + sz * 0.175, (rng() - 0.5) * d * 0.4));
  return { lit, glow };
}

/** Lamp post with an arm and a lamp head; `y` is the ground. */
export function lampPost(x, y, z, scale = 1, ry = 0) {
  const s = scale;
  return [
    post(0.005 * s, 0.34 * s, '#59616b', x, y, z),
    box(0.1 * s, 0.014 * s, 0.014 * s, '#59616b', x + Math.sin(ry + Math.PI / 2) * 0.04 * s, y + 0.34 * s, z + Math.cos(ry + Math.PI / 2) * 0.04 * s, ry),
    box(0.04 * s, 0.014 * s, 0.03 * s, '#fff1c4', x + Math.sin(ry + Math.PI / 2) * 0.085 * s, y + 0.335 * s, z + Math.cos(ry + Math.PI / 2) * 0.085 * s, ry),
  ];
}

/** Traffic light on a post. */
export function trafficLight(x, y, z, scale = 1) {
  return [
    post(0.004 * scale, 0.22 * scale, '#3d4650', x, y, z),
    box(0.03 * scale, 0.07 * scale, 0.03 * scale, '#262c33', x, y + 0.23 * scale, z),
    box(0.016 * scale, 0.016 * scale, 0.008 * scale, '#ff4b3a', x, y + 0.25 * scale, z + 0.017 * scale),
    box(0.016 * scale, 0.016 * scale, 0.008 * scale, '#4be08a', x, y + 0.21 * scale, z + 0.017 * scale),
  ];
}

/** Bus stop shelter: roof, back glass, two legs and a sign pole. `ry` turns it. */
export function busStop(x, y, z, ry, scale = 1) {
  const s = scale;
  const c = Math.cos(ry);
  const sn = Math.sin(ry);
  const at = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
  const parts = [];
  const [rx, rz] = at(0, 0);
  parts.push(box(0.2 * s, 0.012 * s, 0.09 * s, '#3b6fb5', rx, y + 0.17 * s, rz, ry));
  const [bx, bz] = at(0, -0.04 * s);
  parts.push(box(0.2 * s, 0.15 * s, 0.006 * s, '#a9c6d6', bx, y + 0.09 * s, bz, ry));
  for (const lx of [-0.095, 0.095]) {
    const [px, pz] = at(lx * s, 0.035 * s);
    parts.push(post(0.004 * s, 0.17 * s, '#59616b', px, y, pz));
  }
  const [sx, sz] = at(0.14 * s, 0.04 * s);
  parts.push(post(0.003 * s, 0.26 * s, '#8a919a', sx, y, sz), box(0.05 * s, 0.05 * s, 0.006 * s, '#d93a3a', sx, y + 0.27 * s, sz, ry));
  return parts;
}

export function bench(x, y, z, ry, scale = 1) {
  const s = scale;
  return [
    box(0.12 * s, 0.012 * s, 0.04 * s, '#7a5535', x, y + 0.045 * s, z, ry),
    box(0.12 * s, 0.03 * s, 0.01 * s, '#7a5535', x - Math.sin(ry) * 0.02 * s, y + 0.075 * s, z - Math.cos(ry) * 0.02 * s, ry),
    box(0.01 * s, 0.045 * s, 0.035 * s, '#3d4650', x + Math.cos(ry) * 0.05 * s, y + 0.022 * s, z - Math.sin(ry) * 0.05 * s, ry),
    box(0.01 * s, 0.045 * s, 0.035 * s, '#3d4650', x - Math.cos(ry) * 0.05 * s, y + 0.022 * s, z + Math.sin(ry) * 0.05 * s, ry),
  ];
}

/** Zebra crossing: stripes across a road. (cx, cz) is the centre, (dx, dz) the direction of travel. */
export function crosswalk(cx, y, cz, dx, dz, roadWidth, scale = 1, color = '#ebe8df') {
  const parts = [];
  const ry = Math.atan2(dx, dz);
  const n = Math.max(3, Math.round(roadWidth / (0.03 * scale)));
  const step = roadWidth / n;
  for (let i = 0; i < n; i++) {
    const off = -roadWidth / 2 + step * (i + 0.5);
    parts.push(box(step * 0.52, 0.004 * scale, 0.06 * scale, color, cx - dz * off, y, cz + dx * off, ry));
  }
  return parts;
}
