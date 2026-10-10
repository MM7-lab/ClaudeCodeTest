/* ============================================================================
   Signed distance fields. A node is { f(x,y,z) -> distance, m(x,y,z) -> material, bb }.
   bb = [minx,miny,minz,maxx,maxy,maxz] (conservative) lets unions skip far children.
   ========================================================================== */
const INF_BB = [-1e9, -1e9, -1e9, 1e9, 1e9, 1e9];
function bbDist(b, x, y, z) {
  const dx = Math.max(b[0] - x, 0, x - b[3]), dy = Math.max(b[1] - y, 0, y - b[4]), dz = Math.max(b[2] - z, 0, z - b[5]);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function bbGrow(b, r) { return [b[0] - r, b[1] - r, b[2] - r, b[3] + r, b[4] + r, b[5] + r]; }
function bbUnion(list) {
  const o = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (const b of list) for (let i = 0; i < 3; i++) { o[i] = Math.min(o[i], b[i]); o[i + 3] = Math.max(o[i + 3], b[i + 3]); }
  return o;
}
function bbInter(a, b) { return [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2]), Math.min(a[3], b[3]), Math.min(a[4], b[4]), Math.min(a[5], b[5])]; }
function leaf(f, bb, mat) { return { f, m: () => mat, bb, mat }; }

const SDF = {
  sphere(c, r, mat) {
    const [cx, cy, cz] = c;
    return leaf((x, y, z) => Math.hypot(x - cx, y - cy, z - cz) - r, [cx - r, cy - r, cz - r, cx + r, cy + r, cz + r], mat);
  },
  ellipsoid(c, rr, mat) {
    const [cx, cy, cz] = c, [a, b, d] = rr;
    return leaf((x, y, z) => {
      const px = (x - cx) / a, py = (y - cy) / b, pz = (z - cz) / d;
      const k0 = Math.sqrt(px * px + py * py + pz * pz);
      const qx = px / a, qy = py / b, qz = pz / d;
      const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1e-9;
      return k0 * (k0 - 1) / k1;
    }, [cx - a, cy - b, cz - d, cx + a, cy + b, cz + d], mat);
  },
  capsule(a, b, r, mat) {
    const [ax, ay, az] = a, bx = b[0] - ax, by = b[1] - ay, bz = b[2] - az, bb2 = bx * bx + by * by + bz * bz;
    return leaf((x, y, z) => {
      const px = x - ax, py = y - ay, pz = z - az;
      const h = Math.min(1, Math.max(0, (px * bx + py * by + pz * bz) / bb2));
      return Math.hypot(px - bx * h, py - by * h, pz - bz * h) - r;
    }, bbGrow(bbUnion([[...a, ...a], [...b, ...b]]), r), mat);
  },
  // Cone with rounded ends: radius r1 at a, r2 at b (iq).
  roundCone(a, b, r1, r2, mat) {
    const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
    const l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
    return leaf((x, y, z) => {
      const pax = x - a[0], pay = y - a[1], paz = z - a[2];
      const yy = pax * bax + pay * bay + paz * baz, zz = yy - l2;
      const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy;
      const x2 = qx * qx + qy * qy + qz * qz, y2 = yy * yy * l2, z2 = zz * zz * l2;
      const k = Math.sign(rr) * rr * rr * x2;
      if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
      if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
      return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
    }, bbGrow(bbUnion([[...a, ...a], [...b, ...b]]), Math.max(r1, r2)), mat);
  },
  // Local-frame shapes (centred at origin); place them with SDF.frame.
  roundBox(half, rad, mat) {
    const [hx, hy, hz] = half;
    return leaf((x, y, z) => {
      const qx = Math.abs(x) - hx + rad, qy = Math.abs(y) - hy + rad, qz = Math.abs(z) - hz + rad;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - rad;
    }, [-hx, -hy, -hz, hx, hy, hz], mat);
  },
  cylY(r, h, rad, mat) { // capped cylinder along y, half-height h, edge rounding rad
    return leaf((x, y, z) => {
      const dx = Math.hypot(x, z) - r + rad, dy = Math.abs(y) - h + rad;
      return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - rad;
    }, [-r, -h, -r, r, h, r], mat);
  },
  coneY(h, r1, r2, mat) { // capped cone from y=-h (radius r1) to y=+h (radius r2), iq
    const k2x = r2 - r1, k2y = 2 * h, k2l = k2x * k2x + k2y * k2y, R = Math.max(r1, r2);
    return leaf((x, y, z) => {
      const qx = Math.hypot(x, z), qy = y;
      const cax = qx - Math.min(qx, qy < 0 ? r1 : r2), cay = Math.abs(qy) - h;
      const t = Math.min(1, Math.max(0, ((r2 - qx) * k2x + (h - qy) * k2y) / k2l));
      const cbx = qx - r2 + k2x * t, cby = qy - h + k2y * t;
      const s = (cbx < 0 && cay < 0) ? -1 : 1;
      return s * Math.sqrt(Math.min(cax * cax + cay * cay, cbx * cbx + cby * cby));
    }, [-R, -h, -R, R, h, R], mat);
  },
  torusY(R, r, mat) {
    return leaf((x, y, z) => Math.hypot(Math.hypot(x, z) - R, y) - r, [-R - r, -r, -R - r, R + r, r, R + r], mat);
  },
  halfspace(n, d, mat) { // inside where dot(n,p) < d
    const [a, b, c] = v3.norm(n);
    return leaf((x, y, z) => a * x + b * y + c * z - d, INF_BB, mat);
  },
  // Polyline tube with radius varying per point (smooth-unioned capsules / round cones).
  tube(pts, radii, k, mat) {
    const parts = [];
    for (let i = 0; i < pts.length - 1; i++) parts.push(SDF.roundCone(pts[i], pts[i + 1], radii[i], radii[i + 1], mat));
    return k > 0 ? SDF.smooth(k, ...parts) : SDF.union(...parts);
  },
  custom(f, bb, mat) { return leaf(f, bb, mat); },

  /* ---------- transforms ---------- */
  frame(node, t, R) { // R: row-major local->world rotation, t: translation
    const [r0, r1, r2, r3, r4, r5, r6, r7, r8] = R || [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const [tx, ty, tz] = t;
    const toL = (x, y, z, fn) => { const px = x - tx, py = y - ty, pz = z - tz; return fn(r0 * px + r3 * py + r6 * pz, r1 * px + r4 * py + r7 * pz, r2 * px + r5 * py + r8 * pz); };
    const b = node.bb, cs = [];
    for (let i = 0; i < 8; i++) {
      const p = [i & 1 ? b[3] : b[0], i & 2 ? b[4] : b[1], i & 4 ? b[5] : b[2]];
      cs.push([r0 * p[0] + r1 * p[1] + r2 * p[2] + tx, r3 * p[0] + r4 * p[1] + r5 * p[2] + ty, r6 * p[0] + r7 * p[1] + r8 * p[2] + tz]);
    }
    const nb = bbUnion(cs.map(p => [...p, ...p]));
    return { f: (x, y, z) => toL(x, y, z, node.f), m: (x, y, z) => toL(x, y, z, node.m), bb: nb, mat: node.mat };
  },
  // Non-uniform squash about a centre (distance scaled by the smallest factor to stay a lower bound).
  squash(node, c, s) {
    const [cx, cy, cz] = c, [sx, sy, sz] = s, k = Math.min(sx, sy, sz);
    const b = node.bb;
    const nb = [cx + (b[0] - cx) * sx, cy + (b[1] - cy) * sy, cz + (b[2] - cz) * sz, cx + (b[3] - cx) * sx, cy + (b[4] - cy) * sy, cz + (b[5] - cz) * sz];
    return {
      f: (x, y, z) => node.f(cx + (x - cx) / sx, cy + (y - cy) / sy, cz + (z - cz) / sz) * k,
      m: (x, y, z) => node.m(cx + (x - cx) / sx, cy + (y - cy) / sy, cz + (z - cz) / sz),
      bb: nb, mat: node.mat,
    };
  },
  offset(node, r) { return { f: (x, y, z) => node.f(x, y, z) - r, m: node.m, bb: bbGrow(node.bb, Math.max(r, 0)), mat: node.mat }; },
  withMat(node, mat) { return { f: node.f, m: () => mat, bb: node.bb, mat }; },
  // Displace the surface (small amplitude); bound grows by amp.
  displace(node, amp, fn) { return { f: (x, y, z) => node.f(x, y, z) + amp * fn(x, y, z), m: node.m, bb: bbGrow(node.bb, amp), mat: node.mat }; },

  /* ---------- combinators ---------- */
  // Unions keep a coarse grid of candidate children per cell: a child is listed only if
  // it can come within (upper bound of the union distance in that cell + blend width).
  union(...cs) { return unionNode(cs, 0); },
  smooth(k, ...cs) { return unionNode(cs, k); },
  // a minus b. Cut faces take cutMat when given (e.g. an inner-ear recess painted pink).
  sub(a, b, cutMat) {
    return {
      f: (x, y, z) => { const da = a.f(x, y, z); if (bbDist(b.bb, x, y, z) > -da + 1e-3 && bbDist(b.bb, x, y, z) > 0.05) return da; return Math.max(da, -b.f(x, y, z)); },
      m: (x, y, z) => { if (cutMat === undefined) return a.m(x, y, z); const da = a.f(x, y, z), db = -b.f(x, y, z); return db > da ? cutMat : a.m(x, y, z); },
      bb: a.bb,
    };
  },
  ssub(k, a, b, cutMat) {
    return {
      f: (x, y, z) => {
        const da = a.f(x, y, z);
        if (bbDist(b.bb, x, y, z) > k + Math.abs(da)) return da;
        const db = -b.f(x, y, z), h = Math.max(k - Math.abs(da - db), 0) / k;
        return Math.max(da, db) + h * h * k * 0.25;
      },
      m: (x, y, z) => { if (cutMat === undefined) return a.m(x, y, z); const da = a.f(x, y, z), db = -b.f(x, y, z); return db > da ? cutMat : a.m(x, y, z); },
      bb: a.bb,
    };
  },
  inter(a, b, mat) {
    const bb = bbInter(a.bb, b.bb);
    return {
      f: (x, y, z) => Math.max(a.f(x, y, z), b.f(x, y, z)),
      m: mat !== undefined ? () => mat : a.m,
      bb, mat,
    };
  },
  // Intersection with a small fillet (keeps sub-cell steps from tearing when meshed).
  sinter(k, a, b, mat) {
    const bb = bbInter(a.bb, b.bb);
    return {
      f: (x, y, z) => { const da = a.f(x, y, z), db = b.f(x, y, z), h = Math.max(k - Math.abs(da - db), 0) / k; return Math.max(da, db) + h * h * k * 0.25; },
      m: mat !== undefined ? () => mat : a.m, bb, mat,
    };
  },
  // Thin groove (part line) cut into a: a band of half-width w around surface g, only where mask < 0.
  groove(a, g, w, depth) {
    return {
      f: (x, y, z) => {
        const da = a.f(x, y, z);
        if (da > depth + w * 2 || bbDist(g.bb, x, y, z) > w * 2 + 0.02) return da;
        const band = Math.abs(g.f(x, y, z)) - w;
        // only carve near the outer skin of a
        return Math.max(da, Math.min(-band, da + depth));
      },
      m: a.m, bb: a.bb,
    };
  },
};

function boxBoxDist(a, b) {
  const dx = Math.max(0, a[0] - b[3], b[0] - a[3]), dy = Math.max(0, a[1] - b[4], b[1] - a[4]), dz = Math.max(0, a[2] - b[5], b[2] - a[5]);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function unionNode(cs, k) {
  const bb = bbGrow(bbUnion(cs.map(c => c.bb)), k * 0.25);
  const all = cs.map((_, i) => i);
  const noGrid = !!globalThis.SDF_NOGRID;
  let grid = null;
  const build = () => {
    const sz = [bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]];
    if (noGrid || cs.length < 4 || sz.some(v => !(v < 1e5))) { grid = { none: true }; return; }
    const cell = Math.max(0.3, Math.cbrt(sz[0] * sz[1] * sz[2] / 3000));
    const n = sz.map(v => Math.max(1, Math.ceil(v / cell)));
    const half = Math.sqrt(3) * cell / 2, lists = new Array(n[0] * n[1] * n[2]);
    for (let k3 = 0; k3 < n[2]; k3++) for (let j = 0; j < n[1]; j++) for (let i = 0; i < n[0]; i++) {
      const cb = [bb[0] + i * cell, bb[1] + j * cell, bb[2] + k3 * cell, bb[0] + (i + 1) * cell, bb[1] + (j + 1) * cell, bb[2] + (k3 + 1) * cell];
      const cx = (cb[0] + cb[3]) / 2, cy = (cb[1] + cb[4]) / 2, cz = (cb[2] + cb[5]) / 2;
      let U = 1e9;
      for (const c of cs) if (bbDist(c.bb, cx, cy, cz) < U) U = Math.min(U, c.f(cx, cy, cz));
      const lim = Math.max(U + half + k + 0.12, 0);   // inside cells keep every child that overlaps them
      lists[(k3 * n[1] + j) * n[0] + i] = all.filter(i2 => boxBoxDist(cs[i2].bb, cb) <= lim);
    }
    grid = { o: bb, cell, n, lists };
  };
  const cand = (x, y, z) => {
    if (!grid) build();
    if (grid.none) return all;
    const i = Math.floor((x - grid.o[0]) / grid.cell), j = Math.floor((y - grid.o[1]) / grid.cell), l = Math.floor((z - grid.o[2]) / grid.cell);
    if (i < 0 || j < 0 || l < 0 || i >= grid.n[0] || j >= grid.n[1] || l >= grid.n[2]) return all;
    return grid.lists[(l * grid.n[1] + j) * grid.n[0] + i];
  };
  return {
    f(x, y, z) {
      const L = cand(x, y, z);
      let d = 1e9;
      for (let q = 0; q < L.length; q++) {
        const c = cs[L[q]];
        if (bbDist(c.bb, x, y, z) < d + k) {
          const v = c.f(x, y, z);
          if (k > 0) { const h = Math.max(k - Math.abs(d - v), 0) / k; d = Math.min(d, v) - h * h * k * 0.25; }
          else if (v < d) d = v;
        }
      }
      return d;
    },
    m(x, y, z) {
      const L = cand(x, y, z);
      let d = 1e9, mm = cs[L[0] ?? 0].m(x, y, z);
      for (let q = 0; q < L.length; q++) { const c = cs[L[q]]; if (bbDist(c.bb, x, y, z) < d) { const v = c.f(x, y, z); if (v < d) { d = v; mm = c.m(x, y, z); } } }
      return mm;
    },
    bb,
  };
}
