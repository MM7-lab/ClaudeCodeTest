import * as THREE from 'three';
import { lambert, setShadows, vertexColorMaterial, vertexColorMaterialDS } from './util.js';

/**
 * One wing along +X (mirrored when `side` is -1): a swept planform with a dark tip.
 * Pivot at the shoulder, so rotating around Z flaps it.
 */
function wingGeometry(side) {
  const white = new THREE.Color('#ffffff');
  const tip = new THREE.Color('#47525e');
  const v = [
    [0, 0, 0.18, white], // root, front
    [0.5, 0.03, 0.12, white], // mid, front
    [1.0, 0.07, -0.3, tip], // tip
    [0.5, 0.03, -0.2, white], // mid, back
    [0, 0, -0.16, white], // root, back
  ];
  const tris = [
    [0, 1, 3],
    [0, 3, 4],
    [1, 2, 3],
  ];
  const positions = [];
  const colors = [];
  for (const tri of tris) {
    for (const idx of (side > 0 ? tri : [tri[0], tri[2], tri[1]])) {
      const [x, y, z, c] = v[idx];
      positions.push(x * side, y, z);
      colors.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

const wingRight = wingGeometry(1);
const wingLeft = wingGeometry(-1);

function buildGull() {
  const gull = new THREE.Group();
  const white = lambert('#ffffff');

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 6, 5), white);
  body.scale.set(0.8, 0.75, 1.9);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), white);
  headMesh.position.set(0, 0.08, 0.32);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.13, 4), lambert('#ffb020'));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.06, 0.45);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.2), lambert('#e9eef2'));
  tail.position.set(0, 0.02, -0.38);

  const wingR = new THREE.Group();
  wingR.position.set(0.1, 0.06, 0.02);
  wingR.add(new THREE.Mesh(wingRight, vertexColorMaterialDS));
  const wingL = new THREE.Group();
  wingL.position.set(-0.1, 0.06, 0.02);
  wingL.add(new THREE.Mesh(wingLeft, vertexColorMaterialDS));

  gull.add(body, headMesh, beak, tail, wingR, wingL);
  setShadows(gull, true, false);
  return { gull, wingR, wingL };
}

const GULLS = [
  { radius: 3.9, height: 3.6, speed: 0.46, phase: 0.0, flap: 7.5, bob: 0.0 },
  { radius: 3.2, height: 4.2, speed: -0.38, phase: 2.1, flap: 6.4, bob: 1.7 },
  { radius: 4.2, height: 3.3, speed: 0.31, phase: 4.2, flap: 8.2, bob: 3.1 },
];

/** Seagulls circling above the island with flapping wings, banking into their turns. */
export function createBirds() {
  const group = new THREE.Group();
  const birds = GULLS.map((cfg) => {
    const { gull, wingR, wingL } = buildGull();
    group.add(gull);
    return { cfg, gull, wingR, wingL };
  });

  return {
    object: group,
    update(t) {
      for (const { cfg, gull, wingR, wingL } of birds) {
        const dir = Math.sign(cfg.speed);
        const a = cfg.phase + t * cfg.speed;
        const y = cfg.height + 0.2 * Math.sin(t * 0.8 + cfg.bob);
        gull.position.set(cfg.radius * Math.cos(a), y, cfg.radius * Math.sin(a));
        // Heading follows the tangent of the circle; banking leans into the turn.
        gull.rotation.y = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir);
        gull.rotation.z = 0.32 * dir;
        // Strong flaps with the occasional glide.
        const amp = 0.55 + 0.35 * Math.sin(t * 0.35 + cfg.bob);
        const flap = Math.sin(t * cfg.flap + cfg.phase) * amp;
        wingR.rotation.z = flap + 0.1;
        wingL.rotation.z = -flap - 0.1;
      }
    },
  };
}
