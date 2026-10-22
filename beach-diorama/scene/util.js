import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Layer used by the hit-test raycaster that decides whether the cursor is over the diorama. */
export const HIT_LAYER = 1;

export const clamp = THREE.MathUtils.clamp;
export const lerp = THREE.MathUtils.lerp;
export const smoothstep = (edge0, edge1, x) => THREE.MathUtils.smoothstep(x, edge0, edge1);

/** Small deterministic PRNG so the scene looks the same on every launch. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Make every mesh below `object` count as part of the diorama for click-through hit testing. */
export function markSolid(object) {
  object.traverse((o) => {
    if (o.isMesh) o.layers.enable(HIT_LAYER);
  });
}

export function setShadows(object, cast, receive) {
  object.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
}

// ---- materials -------------------------------------------------------------------------------

/** One material shared by everything that bakes its colours into vertex colours. */
export const vertexColorMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
export const vertexColorMaterialDS = new THREE.MeshLambertMaterial({
  vertexColors: true,
  flatShading: true,
  side: THREE.DoubleSide,
});

const lambertCache = new Map();

/** Cached flat-shaded Lambert material, so equal colours share one material. */
export function lambert(color, params = {}) {
  const key = color + JSON.stringify(params);
  let material = lambertCache.get(key);
  if (!material) {
    material = new THREE.MeshLambertMaterial({ color, flatShading: true, ...params });
    lambertCache.set(key, material);
  }
  return material;
}

// ---- geometry helpers ------------------------------------------------------------------------

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Returns a transformed clone of `geometry`. */
export function xform(geometry, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  _q.setFromEuler(_e.set(rot[0], rot[1], rot[2]));
  _m.compose(_p.set(pos[0], pos[1], pos[2]), _q, _s.set(scale[0], scale[1], scale[2]));
  return geometry.clone().applyMatrix4(_m);
}

/** A coloured, optionally transformed piece for `mergeParts`. */
export const P = (geometry, color, t) => ({ geometry: t ? xform(geometry, t) : geometry, color });

/** Merge pieces into one geometry with baked vertex colours (draw with `vertexColorMaterial`). */
export function mergeParts(parts) {
  const prepared = parts.map(({ geometry, color }) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.deleteAttribute('uv');
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const c = new THREE.Color(color);
    const count = g.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  });
  return mergeGeometries(prepared, false);
}

/**
 * Polar grid (rings x segments) used for the island and the sea.
 * `heightFn(x, z, r, theta)` returns the y of each vertex.
 */
export function polarGrid({ rInner, rOuter, rings, segments, heightFn = () => 0 }) {
  const positions = new Float32Array((rings + 1) * segments * 3);
  const indices = [];
  for (let i = 0; i <= rings; i++) {
    const r = rInner + ((rOuter - rInner) * i) / rings;
    for (let j = 0; j < segments; j++) {
      const theta = (j / segments) * Math.PI * 2;
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      positions.set([x, heightFn(x, z, r, theta), z], (i * segments + j) * 3);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * segments + j;
      const b = i * segments + ((j + 1) % segments);
      const c = (i + 1) * segments + j;
      const d = (i + 1) * segments + ((j + 1) % segments);
      indices.push(a, b, c, b, d, c); // counter-clockwise seen from above
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Closed loop given as a function of u in [0, 1), re-parameterised by arc length so that
 * walkers move at a constant speed.
 */
export function makeLoop(fn, samples = 240) {
  const pts = [];
  const cum = [0];
  for (let i = 0; i <= samples; i++) {
    pts.push(fn((i % samples) / samples));
    if (i > 0) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const length = cum[samples];
  return {
    length,
    /** Writes the point at arc length `s` (wrapping) into `out`. */
    at(s, out) {
      s = ((s % length) + length) % length;
      let lo = 0;
      let hi = samples;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= s) lo = mid;
        else hi = mid;
      }
      const f = (s - cum[lo]) / (cum[lo + 1] - cum[lo] || 1);
      out.x = pts[lo][0] + (pts[lo + 1][0] - pts[lo][0]) * f;
      out.z = pts[lo][1] + (pts[lo + 1][1] - pts[lo][1]) * f;
      return out;
    },
  };
}
