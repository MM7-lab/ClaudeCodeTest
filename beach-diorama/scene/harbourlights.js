import * as THREE from 'three';
import { HALF, shoreX } from './island.js';
import { streakTexture } from './textures.js';

// Reflections of the city lights on the harbour at night: soft amber streaks that start at the
// harbour front and fade out over the water, shimmering gently.

const COUNT = 26;

export function createHarbourLights() {
  const texture = streakTexture();
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2); // lie flat on the water
  geometry.translate(0.5, 0, 0); // x runs from 0 (at the shore) to 1 (out to sea)

  const group = new THREE.Group();
  const streaks = [];
  for (let i = 0; i < COUNT; i++) {
    const z = -HALF + 0.35 + ((i + 0.5) / COUNT) * (2 * HALF - 0.7);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: i % 5 === 0 ? 0xff9a6b : 0xffcf7a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const length = 0.55 + 0.5 * ((i * 37) % 10) / 10;
    mesh.scale.set(length, 1, 0.055);
    mesh.position.set(shoreX(z) + 0.18, 0.115, z);
    group.add(mesh);
    streaks.push({ mesh, material, phase: i * 1.7, base: 0.35 + 0.35 * (((i * 53) % 10) / 10) });
  }

  return {
    object: group,
    update(t, dt, env) {
      group.visible = env.night > 0.02;
      for (const s of streaks) {
        const shimmer = 0.75 + 0.25 * Math.sin(t * 1.8 + s.phase) * Math.sin(t * 0.7 + s.phase * 0.5);
        s.material.opacity = env.night * s.base * shimmer;
        s.mesh.scale.z = 0.05 + 0.02 * Math.sin(t * 2.3 + s.phase);
      }
    },
  };
}
