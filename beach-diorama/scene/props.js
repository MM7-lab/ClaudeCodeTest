import * as THREE from 'three';
import { P, lambert, mergeParts, mulberry32, setShadows, vertexColorMaterial, vertexColorMaterialDS } from './util.js';

function buildUmbrella() {
  const group = new THREE.Group();

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.95, 6), lambert('#f3efe6'));
  pole.position.y = 0.975;

  // Striped canopy: one colour per triangle of an open 8-sided cone.
  const cone = new THREE.ConeGeometry(0.9, 0.42, 8, 1, true).toNonIndexed();
  const tris = cone.getAttribute('position').count / 3;
  const colors = new Float32Array(tris * 9);
  const red = new THREE.Color('#ff5b5b');
  const white = new THREE.Color('#fffaf0');
  for (let i = 0; i < tris; i++) {
    const c = i % 2 === 0 ? red : white;
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], i * 9 + k * 3);
  }
  cone.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  cone.deleteAttribute('uv');
  const canopy = new THREE.Mesh(cone, vertexColorMaterialDS);
  canopy.position.y = 1.88;
  const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), lambert('#ffd166'));
  knob.position.y = 2.12;

  group.add(pole, canopy, knob);
  group.rotation.z = 0.1; // tilted a little, like it was stuck in the sand in a hurry
  setShadows(group, true, false);
  return group;
}

function buildTowel() {
  const base = new THREE.BoxGeometry(1.0, 0.03, 0.62);
  const stripe = new THREE.BoxGeometry(1.0, 0.034, 0.1);
  const mesh = new THREE.Mesh(
    mergeParts([
      P(base, '#ffd166'),
      P(stripe, '#ff7b8a', { pos: [0, 0.002, -0.17] }),
      P(stripe, '#ff7b8a', { pos: [0, 0.002, 0.17] }),
    ]),
    vertexColorMaterial,
  );
  setShadows(mesh, false, true);
  return mesh;
}

function buildRocks(heightAt, specs) {
  const rng = mulberry32(21);
  const greys = ['#a3adb8', '#8d99a6', '#b9c1ca'];
  const parts = specs.map((s, i) => {
    const g = new THREE.IcosahedronGeometry(s.size, 0);
    return P(g, greys[i % greys.length], {
      pos: [s.x, heightAt(s.x, s.z) + s.size * 0.15, s.z],
      rot: [rng() * 0.6, rng() * Math.PI * 2, rng() * 0.6],
      scale: [1.15, 0.75, 1],
    });
  });
  const mesh = new THREE.Mesh(mergeParts(parts), vertexColorMaterial);
  setShadows(mesh, true, true);
  return mesh;
}

/**
 * Beach umbrella, towel and rocks. `layout` gives the x/z of each prop; heights come from
 * the island so everything sits on the sand.
 */
export function createProps(heightAt, layout) {
  const group = new THREE.Group();

  const umbrella = buildUmbrella();
  umbrella.position.set(layout.umbrella.x, heightAt(layout.umbrella.x, layout.umbrella.z) - 0.05, layout.umbrella.z);

  const towel = buildTowel();
  towel.position.set(layout.towel.x, heightAt(layout.towel.x, layout.towel.z) + 0.02, layout.towel.z);
  towel.rotation.y = layout.towel.rot;

  group.add(umbrella, towel, buildRocks(heightAt, layout.rocks));
  return { object: group };
}
