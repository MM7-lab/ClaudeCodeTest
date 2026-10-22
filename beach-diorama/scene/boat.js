import * as THREE from 'three';
import { lambert, setShadows } from './util.js';
import { waveHeight } from './sea.js';

// The boat sails a tall oval in the open water on the sea side of the map.
const LOOP_CX = 3.2;
const LOOP_RX = 0.55;
const LOOP_RZ = 3.0;
const LOOP_SPEED = 0.11; // rad/s, about 57 s per lap
const HALF_LENGTH = 0.8;
const HALF_WIDTH = 0.34;

function triangle(a, b, c) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
  g.computeVertexNormals();
  return g;
}

function buildBoat() {
  const boat = new THREE.Group();

  // Hull: lower half of a stretched low-poly sphere, plus a flat deck.
  const hullGeo = new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const hull = new THREE.Mesh(hullGeo, lambert('#ee5d5d', { side: THREE.DoubleSide }));
  hull.scale.set(HALF_WIDTH, 0.3, HALF_LENGTH);
  hull.position.y = 0.08;
  const deck = new THREE.Mesh(new THREE.CircleGeometry(1, 8), lambert('#f7e3b5'));
  deck.rotation.x = -Math.PI / 2;
  deck.scale.set(HALF_WIDTH * 0.97, HALF_LENGTH * 0.97, 1);
  deck.position.y = 0.081;

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 1.6, 5), lambert('#8a5a34'));
  mast.position.set(0, 0.88, 0.1);

  const sailMaterial = lambert('#ffffff', { side: THREE.DoubleSide });
  const mainSail = new THREE.Mesh(triangle([0, 0.22, 0.04], [0, 1.6, 0.06], [0, 0.22, -0.62]), sailMaterial);
  const jib = new THREE.Mesh(
    triangle([0, 0.26, 0.2], [0, 1.45, 0.14], [0, 0.26, 0.74]),
    lambert('#ffd166', { side: THREE.DoubleSide }),
  );
  const flag = new THREE.Mesh(
    triangle([0, 1.6, 0.1], [0, 1.72, 0.1], [0, 1.66, -0.12]),
    lambert('#ff5b5b', { side: THREE.DoubleSide }),
  );

  const sails = new THREE.Group();
  sails.add(mainSail, jib, flag);
  boat.add(hull, deck, mast, sails);
  setShadows(boat, true, false);
  return { boat, sails };
}

/** Sailboat drifting around the island on a slow loop, rocking with the waves. */
export function createBoat() {
  const { boat, sails } = buildBoat();
  boat.rotation.order = 'YXZ';
  boat.scale.setScalar(1.2);
  const sample = new THREE.Vector3();

  function heightAtLocal(heading, lx, lz, x, z, t) {
    // Local (lx, lz) offset rotated by the heading into world space.
    const s = Math.sin(heading);
    const c = Math.cos(heading);
    sample.set(x + lx * c + lz * s, 0, z - lx * s + lz * c);
    return waveHeight(sample.x, sample.z, t);
  }

  return {
    object: boat,
    update(t) {
      const a = t * LOOP_SPEED + 1.2;
      const x = LOOP_CX + LOOP_RX * Math.cos(a);
      const z = LOOP_RZ * Math.sin(a);
      // Moving with increasing a: velocity is (-RX sin a, RZ cos a); the boat faces +Z.
      const heading = Math.atan2(-LOOP_RX * Math.sin(a), LOOP_RZ * Math.cos(a)) + 0.08 * Math.sin(t * 0.4);

      const hBow = heightAtLocal(heading, 0, HALF_LENGTH, x, z, t);
      const hStern = heightAtLocal(heading, 0, -HALF_LENGTH, x, z, t);
      const hLeft = heightAtLocal(heading, HALF_WIDTH, 0, x, z, t);
      const hRight = heightAtLocal(heading, -HALF_WIDTH, 0, x, z, t);
      const hCentre = heightAtLocal(heading, 0, 0, x, z, t);

      boat.position.set(x, hCentre - 0.02 + 0.015 * Math.sin(t * 1.7), z);
      boat.rotation.y = heading;
      // Exaggerate the slopes a bit so the rocking is easy to see at this small size.
      boat.rotation.x = -Math.atan2(hBow - hStern, HALF_LENGTH * 2) * 2.2 + 0.03 * Math.sin(t * 1.3);
      boat.rotation.z = Math.atan2(hLeft - hRight, HALF_WIDTH * 2) * 2.2 + 0.04 * Math.sin(t * 1.1);
      sails.rotation.y = 0.05 * Math.sin(t * 0.5);
    },
  };
}
