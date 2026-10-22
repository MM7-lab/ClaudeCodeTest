// Where everything stands on the island (x/z in scene units, y comes from the island height).
// Kept in one place so the walking paths in people.js can be checked against the obstacles.

const lean = (x, z) => Math.atan2(z, x); // palms lean outwards, away from the island centre

export const PALMS = [
  { x: -1.3, z: -1.4, height: 3.1, bend: 0.7, lean: lean(-1.3, -1.4), phase: 0.0 },
  { x: 1.5, z: -1.0, height: 2.7, bend: 0.6, lean: lean(1.5, -1.0), phase: 2.1 },
  { x: -1.85, z: 0.5, height: 2.9, bend: 0.65, lean: lean(-1.85, 0.5), phase: 4.3 },
];

export const PROPS = {
  umbrella: { x: -0.35, z: 1.05 },
  towel: { x: 0.4, z: 1.15, rot: 0.3 },
  rocks: [
    { x: 2.9, z: 1.95, size: 0.3 },
    { x: -3.3, z: 1.15, size: 0.24 },
    { x: 0.95, z: -3.4, size: 0.32 },
    { x: -2.3, z: -2.7, size: 0.22 },
  ],
};

export const FIRE = { x: 0.1, z: -0.9 };

/** Circles walkers must keep clear of: trunks, umbrella pole, towel, fire pit. */
export const OBSTACLES = [
  ...PALMS.map((p) => ({ x: p.x, z: p.z, r: 0.2 })),
  { x: PROPS.umbrella.x, z: PROPS.umbrella.z, r: 0.1 },
  { x: PROPS.towel.x, z: PROPS.towel.z, r: 0.5 },
  { x: FIRE.x, z: FIRE.z, r: 0.35 },
  ...PROPS.rocks.map((r) => ({ x: r.x, z: r.z, r: r.size * 1.15 })),
];
