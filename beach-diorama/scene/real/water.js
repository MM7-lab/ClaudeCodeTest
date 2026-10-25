import * as THREE from 'three';
import { gridGeometry, setShadows, smoothstep } from '../util.js';
import { HALF } from '../island.js';
import { inPolygon } from './geo.js';

/** Wave height at (x, z): layered sines, calmer near the coast and flat at the block's edges. */
function realWave(x, z, t, depth) {
  const edge = Math.min(HALF - Math.abs(x), HALF - Math.abs(z));
  const amp = (0.03 + 0.05 * smoothstep(0.15, 1.6, depth)) * smoothstep(0, 0.5, edge);
  const w =
    0.5 * Math.sin(1.05 * x + 0.62 * z + 1.25 * t) +
    0.28 * Math.sin(-0.71 * x + 1.38 * z + 1.8 * t + 1.3) +
    0.17 * Math.sin(2.3 * x - 1.9 * z + 2.6 * t + 4.0) +
    0.2 * Math.sin(2.2 * depth + 1.5 * t);
  return amp * w;
}

/**
 * Smooth, reflective water over the whole square. `depthAt(x, z)` is the distance from the
 * coast (positive over water, negative on land, where the ground hides the surface anyway).
 */
export function createRealSea(depthAt) {
  const n = 72;
  const geometry = gridGeometry(n, n, (i, j) => [-HALF + (2 * HALF * i) / n, 0, -HALF + (2 * HALF * j) / n]);
  const position = geometry.getAttribute('position');
  const count = position.count;
  const baseX = new Float32Array(count);
  const baseZ = new Float32Array(count);
  const depth = new Float32Array(count);
  const toMid = new Float32Array(count);
  const toDeep = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    baseX[i] = position.getX(i);
    baseZ[i] = position.getZ(i);
    depth[i] = depthAt(baseX[i], baseZ[i]);
    toMid[i] = smoothstep(0.1, 0.6, depth[i]);
    toDeep[i] = smoothstep(0.6, 2.4, depth[i]);
  }
  const colors = new Float32Array(count * 3).fill(1);
  const colorAttribute = new THREE.BufferAttribute(colors, 3);
  geometry.setAttribute('color', colorAttribute);
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.26, metalness: 0.05 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  setShadows(mesh, false, true);

  const c = new THREE.Color();
  let colorVersion = -1;
  return {
    object: mesh,
    update(t, dt, env) {
      for (let i = 0; i < count; i++) position.setY(i, depth[i] > -0.2 ? realWave(baseX[i], baseZ[i], t, Math.max(depth[i], 0)) : 0);
      position.needsUpdate = true;
      geometry.computeVertexNormals(); // smooth shading: the water reads as a continuous surface
      if (env.version !== colorVersion) {
        colorVersion = env.version;
        for (let i = 0; i < count; i++) {
          // darker and bluer than the cartoon palette: real harbour water is murky
          c.copy(env.seaShallow).lerp(env.seaMid, toMid[i]).lerp(env.seaDeep, toDeep[i]).multiplyScalar(0.42);
          colors[i * 3] = c.r;
          colors[i * 3 + 1] = c.g;
          colors[i * 3 + 2] = c.b;
        }
        colorAttribute.needsUpdate = true;
      }
    },
  };
}

/** Foam along the real coast: strips beside every water-polygon edge that is not the map border. */
export function createCoastFoam(waterPoly) {
  const group = new THREE.Group();
  const onBorder = (p) => Math.abs(Math.abs(p[0]) - HALF) < 1e-3 || Math.abs(Math.abs(p[1]) - HALF) < 1e-3;
  const strips = [];
  for (let i = 0; i < waterPoly.length; i++) {
    const a = waterPoly[i];
    const b = waterPoly[(i + 1) % waterPoly.length];
    if (onBorder(a) && onBorder(b) && (Math.abs(a[0] - b[0]) < 1e-3 || Math.abs(a[1] - b[1]) < 1e-3)) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.05) continue;
    const dx = (b[0] - a[0]) / len;
    const dz = (b[1] - a[1]) / len;
    let nx = -dz;
    let nz = dx;
    const mx = (a[0] + b[0]) / 2;
    const mz = (a[1] + b[1]) / 2;
    if (!inPolygon(mx + nx * 0.06, mz + nz * 0.06, waterPoly)) { nx = -nx; nz = -nz; } // point into the water
    const segs = Math.max(2, Math.round(len / 0.08));
    const positions = [];
    const indices = [];
    for (let k = 0; k <= segs; k++) {
      const u = k / segs;
      const w = 0.045 * (0.7 + 0.3 * Math.sin(u * len * 38) + 0.2 * Math.sin(u * len * 61));
      const px = a[0] + dx * len * u + nx * 0.035;
      const pz = a[1] + dz * len * u + nz * 0.035;
      positions.push(px - nx * w, 0.06, pz - nz * w, px + nx * w, 0.06, pz + nz * w);
      if (k < segs) indices.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, material);
    group.add(mesh);
    strips.push({ mesh, material, nx, nz, phase: i });
  }
  return {
    object: group,
    update(t, dt, env) {
      for (const s of strips) {
        const wave = 0.5 + 0.5 * Math.sin(t * 1.5 + s.phase * 0.9);
        s.mesh.position.set(s.nx * (wave - 0.5) * 0.06, 0, s.nz * (wave - 0.5) * 0.06);
        s.material.opacity = env.foamOpacity * (0.25 + 0.75 * wave);
        s.material.color.copy(env.foamColor);
      }
    },
  };
}
