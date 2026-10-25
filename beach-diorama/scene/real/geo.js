// Small 2D geometry helpers for the map builder. All functions work in world units.

/** Is (x, z) inside the polygon `poly` (array of [x, z])? */
export function inPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance from (x, z) to the segment a-b. */
export function distToSegment(x, z, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
  return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
}

/** Distance from (x, z) to a polyline (open) or polygon outline (closed). */
export function distToPolyline(x, z, pts, closed = false) {
  let best = Infinity;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    best = Math.min(best, distToSegment(x, z, a[0], a[1], b[0], b[1]));
  }
  return best;
}

/** Signed distance to a polygon: negative inside, positive outside. */
export function signedDistance(x, z, poly) {
  const d = distToPolyline(x, z, poly, true);
  return inPolygon(x, z, poly) ? -d : d;
}

/** Chaikin corner cutting: rounds a closed polyline. */
export function smoothClosed(pts, rounds = 2) {
  let p = pts;
  for (let r = 0; r < rounds; r++) {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = out;
  }
  return p;
}

/** Total length of a polyline. */
export function polylineLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return len;
}

/** Point and direction at arc length s along an open polyline (clamped). */
export function pointAlong(pts, s, out) {
  let rest = Math.max(0, s);
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dz = pts[i][1] - pts[i - 1][1];
    const len = Math.hypot(dx, dz);
    if (rest <= len || i === pts.length - 1) {
      const t = len === 0 ? 0 : Math.min(1, rest / len);
      out.x = pts[i - 1][0] + dx * t;
      out.z = pts[i - 1][1] + dz * t;
      out.dx = dx / (len || 1);
      out.dz = dz / (len || 1);
      return out;
    }
    rest -= len;
  }
  return out;
}
