import * as THREE from 'three';
import { P, makeLoop, mergeParts, setShadows, vertexColorMaterial } from './util.js';
import { waveHeight } from './sea.js';
import { FIRE } from './layout.js';

// Figure proportions (feet at y = 0, facing +Z).
const HIP_Y = 0.4;
const SHOULDER_Y = 0.8;
const NECK_Y = 0.84;

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const head = new THREE.SphereGeometry(0.19, 8, 6);
const hairCap = new THREE.SphereGeometry(0.205, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
const hatBrim = new THREE.CylinderGeometry(0.34, 0.34, 0.025, 8);
const hatTop = new THREE.CylinderGeometry(0.15, 0.17, 0.12, 8);

/**
 * Builds one cartoon figure out of a handful of merged meshes. Limbs hang from pivot groups
 * at the hips and shoulders so they can be swung by rotating around X.
 */
function buildFigure({ skin, shirt, shorts, hair, hat, cap }) {
  const root = new THREE.Group();

  const headParts = [
    P(head, skin, { pos: [0, 0.19, 0] }),
    P(box(0.04, 0.05, 0.03), '#2b2430', { pos: [-0.07, 0.21, 0.175] }),
    P(box(0.04, 0.05, 0.03), '#2b2430', { pos: [0.07, 0.21, 0.175] }),
  ];
  if (cap) headParts.push(P(hairCap, cap, { pos: [0, 0.2, -0.005] }));
  else headParts.push(P(hairCap, hair, { pos: [0, 0.2, -0.015] }));
  if (hat) {
    headParts.push(P(hatBrim, hat, { pos: [0, 0.34, 0] }), P(hatTop, hat, { pos: [0, 0.4, 0] }));
  }
  const headPivot = new THREE.Group();
  headPivot.position.set(0, NECK_Y, 0);
  headPivot.add(new THREE.Mesh(mergeParts(headParts), vertexColorMaterial));

  const torso = new THREE.Mesh(mergeParts([P(box(0.36, 0.44, 0.22), shirt, { pos: [0, 0.62, 0] })]), vertexColorMaterial);

  const legGeo = mergeParts([
    P(box(0.155, 0.17, 0.155), shorts, { pos: [0, -0.085, 0] }),
    P(box(0.12, 0.17, 0.12), skin, { pos: [0, -0.255, 0] }),
    P(box(0.135, 0.06, 0.19), '#f4f1ea', { pos: [0, -0.37, 0.02] }),
  ]);
  const armGeo = mergeParts([
    P(box(0.125, 0.14, 0.125), shirt, { pos: [0, -0.07, 0] }),
    P(box(0.1, 0.24, 0.1), skin, { pos: [0, -0.26, 0] }),
  ]);

  const pivot = (geometry, x, y) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    g.add(new THREE.Mesh(geometry, vertexColorMaterial));
    return g;
  };
  const legL = pivot(legGeo, -0.09, HIP_Y);
  const legR = pivot(legGeo, 0.09, HIP_Y);
  const armL = pivot(armGeo, -0.245, SHOULDER_Y);
  const armR = pivot(armGeo, 0.245, SHOULDER_Y);

  root.add(torso, headPivot, legL, legR, armL, armR);
  setShadows(root, true, false);
  return { root, headPivot, legL, legR, armL, armR };
}

const WALKERS = [
  {
    look: { skin: '#f2c9a0', shirt: '#ff6b6b', shorts: '#3b5b8c', hair: '#3b2a20' },
    // Slow lap along the wet sand near the water.
    loop: (u) => {
      const a = u * Math.PI * 2;
      const r = 2.7 + 0.08 * Math.sin(3 * a);
      return [r * Math.cos(a), r * Math.sin(a)];
    },
    speed: 0.5,
    start: 0,
  },
  {
    look: { skin: '#c68b5e', shirt: '#ffd166', shorts: '#2f8f83', hair: '#1d1d1d', hat: '#f1cf7a' },
    // Wanders around the umbrella and towel.
    loop: (u) => {
      const a = u * Math.PI * 2;
      return [1.3 * Math.cos(a), 1.15 + 0.9 * Math.sin(a)];
    },
    speed: 0.42,
    start: 2.4,
  },
  {
    look: { skin: '#8d5a3b', shirt: '#8e7dff', shorts: '#f4f1ea', hair: '#e8b04a' },
    // Strolls around the campfire spot.
    loop: (u) => {
      const a = (1 - u) * Math.PI * 2;
      return [FIRE.x + 0.65 * Math.cos(a), FIRE.z + 0.65 * Math.sin(a)];
    },
    speed: 0.38,
    start: 1.0,
  },
];

const SWIMMERS = [
  { look: { skin: '#f2c9a0', shirt: '#ff7b54', shorts: '#ff7b54', cap: '#ff4d6d' }, r: 3.65, theta: 0.55, span: 0.55, rate: 0.16, phase: 0.0 },
  { look: { skin: '#c68b5e', shirt: '#4d9de0', shorts: '#4d9de0', cap: '#ffd23f' }, r: 3.95, theta: 3.7, span: 0.5, rate: 0.13, phase: 2.2 },
];

export const WALKER_LOOPS = WALKERS.map((w) => makeLoop(w.loop));

/**
 * Walkers stroll along curved sand paths with swinging limbs; swimmers bob and paddle in the
 * sea. `heightAt` is the island height function.
 */
export function createPeople(heightAt) {
  const group = new THREE.Group();

  const walkers = WALKERS.map((cfg, i) => {
    const figure = buildFigure(cfg.look);
    group.add(figure.root);
    return { figure, loop: WALKER_LOOPS[i], speed: cfg.speed, start: cfg.start };
  });

  const swimmers = SWIMMERS.map((cfg) => {
    const figure = buildFigure(cfg.look);
    const wrapper = new THREE.Group(); // positions and heads the swimmer
    const lean = new THREE.Group(); // pivots around the hips until the body is nearly horizontal
    lean.rotation.x = 1.38;
    figure.root.position.y = -HIP_Y;
    figure.headPivot.rotation.x = -1.0; // keep the face up out of the water
    lean.add(figure.root);
    wrapper.add(lean);
    group.add(wrapper);
    return { cfg, figure, wrapper };
  });

  const p0 = { x: 0, z: 0 };
  const p1 = { x: 0, z: 0 };

  return {
    object: group,
    update(t) {
      for (const w of walkers) {
        const s = w.start + t * w.speed;
        w.loop.at(s, p0);
        w.loop.at(s + 0.05, p1);
        const phase = t * w.speed * 11 + w.start;
        const swing = Math.sin(phase);
        const { root, legL, legR, armL, armR } = w.figure;
        root.position.set(p0.x, heightAt(p0.x, p0.z) - 0.02 + Math.abs(swing) * 0.025, p0.z);
        root.rotation.y = Math.atan2(p1.x - p0.x, p1.z - p0.z);
        legL.rotation.x = swing * 0.7;
        legR.rotation.x = -swing * 0.7;
        armL.rotation.x = -swing * 0.6;
        armR.rotation.x = swing * 0.6;
      }

      for (const sw of swimmers) {
        const { cfg, figure, wrapper } = sw;
        const k = t * cfg.rate + cfg.phase;
        const theta = cfg.theta + cfg.span * Math.sin(k);
        const dTheta = Math.cos(k) * cfg.span * cfg.rate; // sign of the travel direction
        const r = cfg.r + 0.12 * Math.sin(t * 0.37 + cfg.phase);
        const x = r * Math.cos(theta);
        const z = r * Math.sin(theta);
        // Tangent of increasing theta is (-sin, cos); flip it when swimming the other way.
        const dir = dTheta >= 0 ? 1 : -1;
        const heading = Math.atan2(-Math.sin(theta) * dir, Math.cos(theta) * dir);

        const bob = 0.03 * Math.sin(t * 2.1 + cfg.phase);
        wrapper.position.set(x, waveHeight(x, z, t) - 0.06 + bob, z);
        wrapper.rotation.y = heading;
        wrapper.rotation.z = 0.12 * Math.sin(t * 2.4 + cfg.phase); // body roll with each stroke

        // Front crawl: arms windmill in opposite phase, legs flutter-kick.
        const stroke = t * 3.2 + cfg.phase;
        figure.armL.rotation.x = -stroke;
        figure.armR.rotation.x = -stroke + Math.PI;
        figure.legL.rotation.x = 0.25 * Math.sin(t * 9 + cfg.phase);
        figure.legR.rotation.x = -0.25 * Math.sin(t * 9 + cfg.phase);
      }
    },
  };
}
