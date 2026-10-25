import * as THREE from 'three';
import { P, mergeParts, setShadows, vertexColorMaterial } from './util.js';
import { waveHeight } from './sea.js';

// A Star Ferry style double-deck ferry shuttling up and down Victoria Harbour.
const LOOP_CX = 3.62;
const LOOP_RX = 0.32;
const LOOP_RZ = 3.15;
const LOOP_SPEED = 0.1; // rad/s, about 63 s per lap
const HALF_LENGTH = 0.78;
const HALF_WIDTH = 0.22;

const GREEN = '#1f7a4d';
const WHITE = '#f3f3ee';
const GLASS = '#25323f';

/** Hull seen from above: flat stern, pointed bow (+Z). Extruded upwards by `height`. */
function hullGeometry(height) {
  const shape = new THREE.Shape();
  shape.moveTo(-HALF_WIDTH, -HALF_LENGTH);
  shape.lineTo(HALF_WIDTH, -HALF_LENGTH);
  shape.lineTo(HALF_WIDTH + 0.01, HALF_LENGTH * 0.45);
  shape.lineTo(0, HALF_LENGTH);
  shape.lineTo(-HALF_WIDTH - 0.01, HALF_LENGTH * 0.45);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  // The shape lives in x/y with the extrusion along z: turn it so y becomes -z and z becomes up.
  g.rotateX(-Math.PI / 2);
  g.rotateY(Math.PI);
  return g;
}

function buildFerry() {
  const lowerH = 0.14;
  const parts = [
    P(hullGeometry(lowerH), GREEN, { pos: [0, -0.04, 0] }), // green hull
    P(new THREE.BoxGeometry(HALF_WIDTH * 2 + 0.03, 0.025, HALF_LENGTH * 1.5), '#e8e2cc', { pos: [0, lowerH - 0.025, -0.12] }), // deck edge
    // lower cabin: white with a ribbon of windows
    P(new THREE.BoxGeometry(0.4, 0.13, 1.1), WHITE, { pos: [0, lowerH + 0.045, -0.12] }),
    P(new THREE.BoxGeometry(0.408, 0.06, 1.0), GLASS, { pos: [0, lowerH + 0.06, -0.12] }),
    // upper cabin, a little shorter, with a green roof
    P(new THREE.BoxGeometry(0.34, 0.12, 0.85), WHITE, { pos: [0, lowerH + 0.17, -0.1] }),
    P(new THREE.BoxGeometry(0.348, 0.055, 0.76), GLASS, { pos: [0, lowerH + 0.185, -0.1] }),
    P(new THREE.BoxGeometry(0.38, 0.03, 0.92), GREEN, { pos: [0, lowerH + 0.245, -0.1] }),
    // wheelhouse, funnel and mast
    P(new THREE.BoxGeometry(0.2, 0.09, 0.26), WHITE, { pos: [0, lowerH + 0.31, 0.2] }),
    P(new THREE.BoxGeometry(0.208, 0.04, 0.268), GLASS, { pos: [0, lowerH + 0.32, 0.2] }),
    P(new THREE.CylinderGeometry(0.045, 0.055, 0.2, 8), '#f3f3ee', { pos: [0, lowerH + 0.37, -0.45] }),
    P(new THREE.CylinderGeometry(0.047, 0.047, 0.05, 8), '#20252b', { pos: [0, lowerH + 0.495, -0.45] }),
    P(new THREE.CylinderGeometry(0.01, 0.014, 0.28, 5), '#8d98a5', { pos: [0, lowerH + 0.5, 0.2] }),
    // bow rail
    P(new THREE.BoxGeometry(0.012, 0.05, 0.2), '#cfd6dd', { pos: [0, lowerH + 0.02, 0.56] }),
  ];
  const ferry = new THREE.Group();
  ferry.add(new THREE.Mesh(mergeParts(parts), vertexColorMaterial));
  setShadows(ferry, true, false);
  return ferry;
}

/** The ferry sails the harbour on a long narrow oval, rocking with the waves. */
export function createFerry() {
  const ferry = buildFerry();
  ferry.rotation.order = 'YXZ';
  const sample = new THREE.Vector3();

  function heightAtLocal(heading, lx, lz, x, z, t) {
    // Local (lx, lz) offset rotated by the heading into world space.
    const s = Math.sin(heading);
    const c = Math.cos(heading);
    sample.set(x + lx * c + lz * s, 0, z - lx * s + lz * c);
    return waveHeight(sample.x, sample.z, t);
  }

  return {
    object: ferry,
    update(t) {
      const a = t * LOOP_SPEED + 1.2;
      const x = LOOP_CX + LOOP_RX * Math.cos(a);
      const z = LOOP_RZ * Math.sin(a);
      // Moving with increasing a: velocity is (-RX sin a, RZ cos a); the ferry faces +Z.
      const heading = Math.atan2(-LOOP_RX * Math.sin(a), LOOP_RZ * Math.cos(a));

      const hBow = heightAtLocal(heading, 0, HALF_LENGTH, x, z, t);
      const hStern = heightAtLocal(heading, 0, -HALF_LENGTH, x, z, t);
      const hLeft = heightAtLocal(heading, HALF_WIDTH, 0, x, z, t);
      const hRight = heightAtLocal(heading, -HALF_WIDTH, 0, x, z, t);
      const hCentre = heightAtLocal(heading, 0, 0, x, z, t);

      ferry.position.set(x, hCentre - 0.01 + 0.01 * Math.sin(t * 1.7), z);
      ferry.rotation.y = heading;
      // A big ferry rolls less than a sailboat: keep the rocking gentle.
      ferry.rotation.x = -Math.atan2(hBow - hStern, HALF_LENGTH * 2) * 1.2;
      ferry.rotation.z = Math.atan2(hLeft - hRight, HALF_WIDTH * 2) * 1.2;
    },
  };
}
