import * as THREE from 'three';
import { gridGeometry, smoothstep, setShadows } from './util.js';
import { HALF, shoreX } from './island.js';

const COLS = 8; // across the harbour, from just under the sand to the far wall
const ROWS = 44; // along the shoreline

/**
 * Sea height at (x, z) and time t. Shared by the sea mesh, the swimmers and the boat so that
 * everything floating moves with the visible waves. Waves are calmer near the shore.
 */
export function waveHeight(x, z, t) {
  const d = x - shoreX(z); // distance seaward of the shoreline
  const amp = 0.04 + 0.065 * smoothstep(0.2, 1.4, d);
  const w =
    0.5 * Math.sin(1.05 * x + 0.62 * z + 1.25 * t) +
    0.28 * Math.sin(-0.71 * x + 1.38 * z + 1.8 * t + 1.3) +
    0.17 * Math.sin(2.3 * x - 1.9 * z + 2.6 * t + 4.0) +
    0.2 * Math.sin(2.2 * d + 1.5 * t); // swell rolling in towards the shore
  return amp * w;
}

export function createSea() {
  // Rectangular grid whose left edge follows the shoreline (hidden under the sand).
  const geometry = gridGeometry(COLS, ROWS, (i, j) => {
    const z = -HALF + 0.02 + ((2 * HALF - 0.04) * j) / ROWS;
    const x0 = shoreX(z) - 0.6;
    const x1 = HALF - 0.02;
    return [x0 + ((x1 - x0) * i) / COLS, 0, z];
  });
  const position = geometry.getAttribute('position');
  const count = position.count;

  // Rest positions (x, z) plus how far each vertex is from shallow towards deep water. The
  // actual colours come from the current look's palette (see recolor).
  const baseX = new Float32Array(count);
  const baseZ = new Float32Array(count);
  const toMid = new Float32Array(count);
  const toDeep = new Float32Array(count);
  const mottle = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    baseX[i] = x;
    baseZ[i] = z;
    const d = x - shoreX(z);
    toMid[i] = smoothstep(0.2, 0.7, d);
    toDeep[i] = smoothstep(0.7, 1.7, d);
    mottle[i] = 1 + 0.05 * Math.sin(x * 5.7 + z * 4.3); // facet-to-facet variation
  }
  const colors = new Float32Array(count * 3).fill(1);
  const colorAttribute = new THREE.BufferAttribute(colors, 3);
  geometry.setAttribute('color', colorAttribute);
  const c = new THREE.Color();
  let colorVersion = -1;

  function recolor(env) {
    for (let i = 0; i < count; i++) {
      c.copy(env.seaShallow).lerp(env.seaMid, toMid[i]).lerp(env.seaDeep, toDeep[i]).multiplyScalar(mottle[i]);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    colorAttribute.needsUpdate = true;
  }
  geometry.computeBoundingSphere(); // the sea never leaves this sphere noticeably

  const material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    flatShading: true,
    shininess: 60,
    specular: new THREE.Color('#4f6f80'),
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  setShadows(mesh, false, true);

  return {
    object: mesh,
    update(t, dt, env) {
      for (let i = 0; i < count; i++) position.setY(i, waveHeight(baseX[i], baseZ[i], t));
      position.needsUpdate = true;
      if (env.version !== colorVersion) {
        colorVersion = env.version;
        recolor(env);
      }
    },
  };
}

/** Strip following the shoreline, with a ragged width so it reads as foam. */
function foamStripGeometry(offset, width, phase) {
  const segments = 96;
  const positions = new Float32Array((segments + 1) * 2 * 3);
  const indices = [];
  for (let j = 0; j <= segments; j++) {
    const z = -HALF + 0.05 + ((2 * HALF - 0.1) * j) / segments;
    const xc = shoreX(z) + offset;
    const w = Math.max(0.03, width * (0.65 + 0.35 * Math.sin(3.1 * z + phase) + 0.2 * Math.sin(5.3 * z)));
    positions.set([xc - w / 2, 0, z], j * 6);
    positions.set([xc + w / 2, 0, z], j * 6 + 3);
    if (j < segments) {
      const i0 = j * 2;
      indices.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

/** White foam strips that pulse in and out along the shore (waves lapping the beach). */
export function createFoam() {
  const group = new THREE.Group();
  const strips = [
    { offset: -0.02, width: 0.3, phase: 0.0, speed: 1.5, shift: 0.0, strength: 1.0 },
    { offset: 0.26, width: 0.14, phase: 2.0, speed: 1.5, shift: 1.7, strength: 0.7 },
  ].map((cfg) => {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(foamStripGeometry(cfg.offset, cfg.width, cfg.phase), material);
    mesh.position.y = 0.075;
    group.add(mesh);
    return { cfg, mesh, material };
  });

  return {
    object: group,
    update(t, dt, env) {
      for (const { cfg, mesh, material } of strips) {
        const wave = 0.5 + 0.5 * Math.sin(t * cfg.speed + cfg.shift); // 0 = retreated, 1 = washed up
        mesh.position.x = (wave - 0.5) * 0.3; // slides about +-0.15 along the beach
        material.opacity = env.foamOpacity * cfg.strength * (0.25 + 0.75 * wave);
        material.color.copy(env.foamColor);
      }
    },
  };
}
