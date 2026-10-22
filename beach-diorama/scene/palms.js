import * as THREE from 'three';
import { P, lambert, mergeParts, mulberry32, setShadows, vertexColorMaterial } from './util.js';

const FROND_COUNT = 7;
const TRUNK_SEGMENTS = 6;

/**
 * One palm frond: a folded, arching leaf along +X, built from a few stations so it stays low-poly.
 */
function buildFrondGeometry() {
  const length = 1.45;
  const stations = 5;
  const positions = [];
  for (let i = 0; i < stations; i++) {
    const t = i / (stations - 1);
    const x = length * t;
    const y = 0.28 * t - 0.78 * t * t; // arch up, then droop
    const w = 0.26 * Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.08)) * (1 - 0.25 * t);
    positions.push(x, y - 0.025, -w, x, y + 0.04, 0, x, y - 0.025, w); // left, ridge, right
  }
  const indices = [];
  for (let i = 0; i < stations - 1; i++) {
    const l0 = i * 3;
    const l1 = (i + 1) * 3;
    indices.push(l0, l0 + 1, l1 + 1, l0, l1 + 1, l1); // left half
    indices.push(l0 + 1, l0 + 2, l1 + 2, l0 + 1, l1 + 2, l1 + 1); // right half
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const frondGeometry = buildFrondGeometry();
const frondMaterials = [
  lambert('#52c76d', { side: THREE.DoubleSide }),
  lambert('#3aa95b', { side: THREE.DoubleSide }),
];

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();

/** Segmented, slightly curved trunk merged into one geometry; returns it and the crown position. */
function buildTrunk(height, bend, leanAngle) {
  const parts = [];
  const spine = [];
  for (let i = 0; i <= TRUNK_SEGMENTS; i++) {
    const s = i / TRUNK_SEGMENTS;
    const off = bend * s * s;
    spine.push(new THREE.Vector3(Math.cos(leanAngle) * off, height * s, Math.sin(leanAngle) * off));
  }
  for (let i = 0; i < TRUNK_SEGMENTS; i++) {
    const a = spine[i];
    const b = spine[i + 1];
    _dir.subVectors(b, a);
    const len = _dir.length();
    const rBottom = 0.17 - 0.07 * (i / TRUNK_SEGMENTS);
    const rTop = 0.17 - 0.07 * ((i + 1) / TRUNK_SEGMENTS);
    const q = new THREE.Quaternion().setFromUnitVectors(_up, _dir.normalize());
    const seg = new THREE.CylinderGeometry(rTop * 1.04, rBottom * 1.04, len * 1.02, 6, 1);
    seg.applyQuaternion(q);
    seg.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    parts.push(P(seg, i % 2 === 0 ? '#b57a43' : '#9c6535'));
  }
  return { geometry: mergeParts(parts), crown: spine[TRUNK_SEGMENTS] };
}

/**
 * Creates the palm trees. `spec` entries: x, z, height, bend (how far the crown leans, in
 * units), lean (direction of that lean, in radians) and phase (offset of the wind sway).
 */
export function createPalms(heightAt, specs) {
  const group = new THREE.Group();
  const rng = mulberry32(7);
  const palms = [];

  for (const spec of specs) {
    const palm = new THREE.Group();
    palm.position.set(spec.x, heightAt(spec.x, spec.z) - 0.06, spec.z);

    const { geometry, crown } = buildTrunk(spec.height, spec.bend, spec.lean);
    palm.add(new THREE.Mesh(geometry, vertexColorMaterial));

    const crownGroup = new THREE.Group();
    crownGroup.position.copy(crown);
    palm.add(crownGroup);

    const nutParts = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      nutParts.push(P(new THREE.IcosahedronGeometry(0.09, 0), '#6a4527', { pos: [0.14 * Math.cos(a), -0.1, 0.14 * Math.sin(a)] }));
    }
    crownGroup.add(new THREE.Mesh(mergeParts(nutParts), vertexColorMaterial));

    const fronds = [];
    for (let i = 0; i < FROND_COUNT; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (i / FROND_COUNT) * Math.PI * 2 + rng() * 0.4;
      const tilt = 0.32 + rng() * 0.2;
      const leaf = new THREE.Mesh(frondGeometry, frondMaterials[i % 2]);
      leaf.rotation.z = tilt;
      leaf.scale.setScalar(0.9 + rng() * 0.25);
      pivot.add(leaf);
      crownGroup.add(pivot);
      fronds.push({ pivot, leaf, tilt, phase: rng() * Math.PI * 2 });
    }

    group.add(palm);
    palms.push({ crownGroup, fronds, phase: spec.phase });
  }
  setShadows(group, true, true);

  return {
    object: group,
    update(t) {
      for (const { crownGroup, fronds, phase } of palms) {
        // Whole crown sways with the wind, each frond adds its own flutter.
        crownGroup.rotation.z = Math.sin(t * 0.9 + phase) * 0.03;
        crownGroup.rotation.x = Math.sin(t * 0.7 + phase * 1.3) * 0.025;
        for (const f of fronds) {
          f.leaf.rotation.z = f.tilt + Math.sin(t * 1.5 + phase + f.phase) * 0.09;
          f.pivot.rotation.x = Math.sin(t * 1.1 + phase + f.phase * 0.7) * 0.05;
        }
      }
    },
  };
}
