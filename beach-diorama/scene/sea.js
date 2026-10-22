import * as THREE from 'three';
import { polarGrid, smoothstep, setShadows } from './util.js';
import { shoreRadius, TRAY_R } from './island.js';

const SEA_INNER = 2.45; // hidden under the sand
const RINGS = 12;
const SEGMENTS = 56;

/**
 * Sea height at (x, z) and time t. Shared by the sea mesh, the swimmers and the boat so that
 * everything floating moves with the visible waves. Waves are calmer near the shore.
 */
export function waveHeight(x, z, t) {
  const r = Math.hypot(x, z);
  const amp = 0.04 + 0.065 * smoothstep(3.2, 5.0, r);
  const w =
    0.5 * Math.sin(1.05 * x + 0.62 * z + 1.25 * t) +
    0.28 * Math.sin(-0.71 * x + 1.38 * z + 1.8 * t + 1.3) +
    0.17 * Math.sin(2.3 * x - 1.9 * z + 2.6 * t + 4.0) +
    0.2 * Math.sin(2.2 * r + 1.5 * t); // swell rolling in towards the shore
  return amp * w;
}

export function createSea() {
  const geometry = polarGrid({ rInner: SEA_INNER, rOuter: TRAY_R - 0.02, rings: RINGS, segments: SEGMENTS });
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
    const r = Math.hypot(x, z);
    toMid[i] = smoothstep(3.1, 4.0, r);
    toDeep[i] = smoothstep(4.0, 5.5, r);
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
    shininess: 80,
    specular: new THREE.Color('#9fc4d8'),
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

/** Closed ring following the irregular shoreline, with a ragged width so it reads as foam. */
function foamRingGeometry(offset, width, phase) {
  const segments = 96;
  const positions = new Float32Array(segments * 2 * 3);
  const indices = [];
  for (let j = 0; j < segments; j++) {
    const theta = (j / segments) * Math.PI * 2;
    const r = shoreRadius(theta) + offset;
    const w = Math.max(0.03, width * (0.65 + 0.35 * Math.sin(11 * theta + phase) + 0.2 * Math.sin(17 * theta)));
    positions.set([(r - w / 2) * Math.cos(theta), 0, (r - w / 2) * Math.sin(theta)], j * 6);
    positions.set([(r + w / 2) * Math.cos(theta), 0, (r + w / 2) * Math.sin(theta)], j * 6 + 3);
    const i0 = j * 2;
    const i1 = ((j + 1) % segments) * 2;
    indices.push(i0, i0 + 1, i1, i0 + 1, i1 + 1, i1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

/** White foam rings that pulse in and out around the island (waves lapping the shore). */
export function createFoam() {
  const group = new THREE.Group();
  const rings = [
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
    const mesh = new THREE.Mesh(foamRingGeometry(cfg.offset, cfg.width, cfg.phase), material);
    mesh.position.y = 0.075;
    group.add(mesh);
    return { cfg, mesh, material };
  });

  return {
    object: group,
    update(t, dt, env) {
      for (const { cfg, mesh, material } of rings) {
        const wave = 0.5 + 0.5 * Math.sin(t * cfg.speed + cfg.shift); // 0 = retreated, 1 = washed up
        mesh.scale.setScalar(1 - 0.05 + 0.075 * wave); // radius pulses by about +-0.15 at the shore
        material.opacity = env.foamOpacity * cfg.strength * (0.25 + 0.75 * wave);
        material.color.copy(env.foamColor);
      }
    },
  };
}
