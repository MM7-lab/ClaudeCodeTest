import * as THREE from 'three';
import { P, mergeParts, setShadows, smoothstep, vertexColorMaterial } from './util.js';
import { waveHeight } from './sea.js';

// A Star Ferry style double-ended ferry shuttling between two piers on Victoria Harbour:
// dock, pause, depart, cross, dock again. Being double-ended, it never turns round; it just
// sets off the other way.
const BERTH_X = 3.5; // the ferry lies alongside the pier tips here
const PIER_Z = 2.75; // the two piers are at z = -PIER_Z and +PIER_Z
const DOCK_SECONDS = 6;
const TRAVEL_SECONDS = 14;
const CYCLE = 2 * (DOCK_SECONDS + TRAVEL_SECONDS);
const HALF_LENGTH = 0.78;
const HALF_WIDTH = 0.22;

const GREEN = '#1f7a4d';
const WHITE = '#f3f3ee';
const GLASS = '#25323f';

/** Hull seen from above: pointed at both ends. Extruded upwards by `height`. */
function hullGeometry(height) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -HALF_LENGTH);
  shape.lineTo(HALF_WIDTH + 0.01, -HALF_LENGTH * 0.45);
  shape.lineTo(HALF_WIDTH + 0.01, HALF_LENGTH * 0.45);
  shape.lineTo(0, HALF_LENGTH);
  shape.lineTo(-HALF_WIDTH - 0.01, HALF_LENGTH * 0.45);
  shape.lineTo(-HALF_WIDTH - 0.01, -HALF_LENGTH * 0.45);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); // the extrusion becomes "up"
  return g;
}

function buildFerry() {
  const lowerH = 0.14;
  const body = [
    P(hullGeometry(lowerH), GREEN, { pos: [0, -0.04, 0] }),
    P(new THREE.BoxGeometry(HALF_WIDTH * 2 + 0.03, 0.025, HALF_LENGTH * 1.5), '#e8e2cc', { pos: [0, lowerH - 0.025, 0] }), // deck edge
    P(new THREE.BoxGeometry(0.4, 0.13, 1.1), WHITE, { pos: [0, lowerH + 0.045, 0] }), // lower cabin
    P(new THREE.BoxGeometry(0.34, 0.12, 0.85), WHITE, { pos: [0, lowerH + 0.17, 0] }), // upper cabin
    P(new THREE.BoxGeometry(0.38, 0.03, 0.92), GREEN, { pos: [0, lowerH + 0.245, 0] }), // green roof
    P(new THREE.CylinderGeometry(0.045, 0.055, 0.2, 8), WHITE, { pos: [0, lowerH + 0.37, 0] }), // funnel
    P(new THREE.CylinderGeometry(0.047, 0.047, 0.05, 8), '#20252b', { pos: [0, lowerH + 0.495, 0] }),
    P(new THREE.CylinderGeometry(0.01, 0.014, 0.22, 5), '#8d98a5', { pos: [0, lowerH + 0.5, 0.3] }),
    P(new THREE.CylinderGeometry(0.01, 0.014, 0.22, 5), '#8d98a5', { pos: [0, lowerH + 0.5, -0.3] }),
  ];
  const wheelhouses = [-0.33, 0.33].flatMap((z) => [
    P(new THREE.BoxGeometry(0.2, 0.09, 0.2), WHITE, { pos: [0, lowerH + 0.31, z] }),
  ]);
  // Window ribbons are unlit, so they can glow at night.
  const windows = [
    P(new THREE.BoxGeometry(0.408, 0.06, 1.0), GLASS, { pos: [0, lowerH + 0.06, 0] }),
    P(new THREE.BoxGeometry(0.348, 0.055, 0.76), GLASS, { pos: [0, lowerH + 0.185, 0] }),
    ...[-0.33, 0.33].map((z) => P(new THREE.BoxGeometry(0.208, 0.04, 0.208), GLASS, { pos: [0, lowerH + 0.32, z] })),
  ];

  const ferry = new THREE.Group();
  ferry.add(new THREE.Mesh(mergeParts([...body, ...wheelhouses]), vertexColorMaterial));
  const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x25323f });
  ferry.add(new THREE.Mesh(mergeParts(windows), windowMaterial));
  setShadows(ferry, true, false);
  return { ferry, windowMaterial };
}

/** Two thin white trails diverging behind the stern (local -z) plus a centre trail. */
function buildWake() {
  const y = 0.03;
  const quad = (x0, z0, x1, z1, w) => [
    x0 - w, y, z0, x0 + w, y, z0, x1 + w, y, z1,
    x0 - w, y, z0, x1 + w, y, z1, x1 - w, y, z1,
  ];
  const back = -HALF_LENGTH * 0.9;
  const positions = [
    ...quad(0, back, 0, back - 1.1, 0.07),
    ...quad(0.12, back, 0.55, back - 1.0, 0.03),
    ...quad(-0.12, back, -0.55, back - 1.0, 0.03),
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  return new THREE.Mesh(g, material);
}

/** A small pier: deck, posts, a shed and a gangway towards the berth. */
function buildPier(z) {
  const x0 = 2.5;
  const x1 = 3.12;
  const cx = (x0 + x1) / 2;
  const deckY = 0.13;
  const parts = [
    P(new THREE.BoxGeometry(x1 - x0, 0.05, 0.3), '#8a8f96', { pos: [cx, deckY, z] }),
    P(new THREE.BoxGeometry(0.3, 0.17, 0.26), '#f1ece0', { pos: [x0 + 0.17, deckY + 0.11, z] }), // shed
    P(new THREE.BoxGeometry(0.34, 0.03, 0.3), '#1f7a4d', { pos: [x0 + 0.17, deckY + 0.205, z] }), // green roof
    P(new THREE.BoxGeometry(0.2, 0.025, 0.14), '#6b7480', { pos: [x1 + 0.1, deckY - 0.01, z] }), // gangway
  ];
  for (const px of [x0 + 0.2, x1 - 0.05]) {
    for (const pz of [-0.12, 0.12]) parts.push(P(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 5), '#59616b', { pos: [px, deckY - 0.2, z + pz] }));
  }
  return new THREE.Mesh(mergeParts(parts), vertexColorMaterial);
}

const _c = new THREE.Color();
const WARM = new THREE.Color('#ffcf6e');

/** Extra finger piers with teal-roofed terminals, like the Central ferry piers (no ferry berths here). */
function buildDecorPiers() {
  const parts = [];
  const deckY = 0.13;
  for (const z of [-1.7, -0.6, 0.55, 1.5]) {
    const x0 = 2.55;
    const x1 = 3.08;
    parts.push(P(new THREE.BoxGeometry(x1 - x0, 0.05, 0.24), '#b98a6c', { pos: [(x0 + x1) / 2, deckY, z] }));
    parts.push(P(new THREE.BoxGeometry(0.34, 0.12, 0.22), '#eef1f2', { pos: [x0 + 0.2, deckY + 0.085, z] }));
    parts.push(P(new THREE.BoxGeometry(0.38, 0.025, 0.26), '#3aa7a3', { pos: [x0 + 0.2, deckY + 0.16, z] })); // teal roof
    for (const px of [x0 + 0.3, x1 - 0.04]) for (const pz of [-0.1, 0.1]) parts.push(P(new THREE.CylinderGeometry(0.018, 0.018, 0.45, 5), '#59616b', { pos: [px, deckY - 0.2, z + pz] }));
  }
  return new THREE.Mesh(mergeParts(parts), vertexColorMaterial);
}

/** Ferry plus its two piers. Timeline: dock, depart, cross, dock, depart back, ... */
export function createFerry() {
  const group = new THREE.Group();
  const { ferry, windowMaterial } = buildFerry();
  ferry.rotation.order = 'YXZ';
  const wake = buildWake();
  ferry.add(wake);
  group.add(buildPier(-PIER_Z), buildPier(PIER_Z), buildDecorPiers(), ferry);
  setShadows(group, true, true);
  const sample = new THREE.Vector3();

  function heightAtLocal(heading, lx, lz, x, z, t) {
    // Local (lx, lz) offset rotated by the heading into world space.
    const s = Math.sin(heading);
    const c = Math.cos(heading);
    sample.set(x + lx * c + lz * s, 0, z - lx * s + lz * c);
    return waveHeight(sample.x, sample.z, t);
  }

  return {
    object: group,
    /** The ferry itself (for tests and for the camera look-at). */
    ferry,
    update(t, dt, env) {
      // Where are we in the cycle? Two legs, each preceded by a pause at the pier.
      const p = ((t + 3) % CYCLE + CYCLE) % CYCLE;
      const leg = Math.floor(p / (DOCK_SECONDS + TRAVEL_SECONDS)); // 0: north -> south, 1: back
      const q = p - leg * (DOCK_SECONDS + TRAVEL_SECONDS);
      const dir = leg === 0 ? 1 : -1; // +z first
      const u = Math.min(1, Math.max(0, (q - DOCK_SECONDS) / TRAVEL_SECONDS));
      const eased = smoothstep(0, 1, u);
      const z = dir * (-PIER_Z + 2 * PIER_Z * eased);
      const speed = Math.min(1, ((2 * PIER_Z * 6 * u * (1 - u)) / TRAVEL_SECONDS) / 0.55);
      const x = BERTH_X + 0.03 * Math.sin(t * 0.3) * speed;
      const heading = dir > 0 ? 0 : Math.PI;

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

      wake.material.opacity = 0.55 * speed;
      // Windows reflect the sky by day and glow at night.
      _c.copy(env.skyColor).multiplyScalar(0.4).lerp(WARM, Math.pow(env.night, 0.7));
      windowMaterial.color.copy(_c);
    },
  };
}
