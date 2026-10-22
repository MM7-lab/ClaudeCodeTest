// Where everything stands on the island (x/z in scene units, y comes from the island height).

// Land is the left half (x < 0), the sea the right half. Palms lean towards the sea.
export const PALMS = [
  { x: -3.6, z: -3.5, height: 3.1, bend: 0.7, lean: 0.5, phase: 0.0 },
  { x: -1.6, z: -3.7, height: 2.7, bend: 0.6, lean: 0.2, phase: 2.1 },
  { x: -3.7, z: 3.6, height: 2.9, bend: 0.65, lean: -0.3, phase: 4.3 },
];

export const PROPS = {
  umbrella: { x: -3.15, z: 1.8 },
  towel: { x: -2.5, z: 1.9, rot: 0.3 },
  rocks: [
    { x: 0.6, z: -3.0, size: 0.3 },
    { x: 0.55, z: 3.2, size: 0.24 },
    { x: 0.5, z: 0.9, size: 0.3 },
    { x: 0.0, z: -0.3, size: 0.22 },
  ],
};

export const FIRE = { x: -2.8, z: -1.2 };
