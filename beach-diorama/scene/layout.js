// Street plan of the little city (x/z in scene units). The harbour is the strip on the right
// (x > about 2.6); everything to its left is city, with a mountain ridge along the left wall.

/**
 * Rounded-rectangle ring roads. The outer one is the tram line, shared with taxis (as in Hong
 * Kong); the inner one carries a few more taxis.
 */
export const OUTER_RING = { x0: -3.0, x1: 1.4, z0: -3.4, z1: 3.4, r: 0.28, width: 0.32 };
export const INNER_RING = { x0: -2.2, x1: 0.4, z0: -2.4, z1: 2.4, r: 0.22, width: 0.24 };

/** Cross streets inside the inner ring. */
export const CROSS_STREETS = [
  { x0: -2.2, x1: 0.4, z0: 0.1, z1: 0.1, width: 0.17 },
  { x0: -0.9, x1: -0.9, z0: -2.4, z1: 2.4, width: 0.17 },
];

/** Rectangles (x0, x1, z0, z1) that hold buildings; they sit between the roads. */
export const BLOCKS = [
  // inside the tram ring: four quadrants
  [-2.05, -1.0, -2.25, 0.0],
  [-0.8, 0.28, -2.25, 0.0],
  [-2.05, -1.0, 0.2, 2.25],
  [-0.8, 0.28, 0.2, 2.25],
  // between the rings
  [-2.85, -2.4, -2.5, 2.5], // left
  [0.55, 1.25, -2.5, 2.5], // harbour side
  [-2.85, 1.25, -3.25, -2.55], // back
  [-2.85, 1.25, 2.55, 3.25], // front
];

export const LANDMARKS = [
  { x: 0.9, z: 0.7, h: 4.3, kind: 'spire' }, // the tall harbour-front tower
  { x: 0.9, z: -1.3, h: 3.3, kind: 'stepped' },
];

/** The clock tower and the observation wheel stand on the harbour promenade. */
export const CLOCK_TOWER = { x: 2.2, z: 1.65 };
export const WHEEL = { x: 2.0, z: -2.5 };
