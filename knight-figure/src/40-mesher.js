/* ============================================================================
   Narrow-band surface nets. Only blocks near the zero set are evaluated; each
   cell vertex is projected onto the exact surface with Newton steps, its normal
   comes from the SDF gradient (tetrahedral differences), material from the
   nearest primitive, and ambient occlusion from the combined SDF.
   ========================================================================== */
class GrowF32 {
  constructor(n) { this.a = new Float32Array(n); this.n = 0; }
  push3(x, y, z) { if (this.n + 3 > this.a.length) this.grow(); this.a[this.n++] = x; this.a[this.n++] = y; this.a[this.n++] = z; }
  push1(x) { if (this.n + 1 > this.a.length) this.grow(); this.a[this.n++] = x; }
  grow() { const b = new Float32Array(this.a.length * 2); b.set(this.a); this.a = b; }
  out() { return this.a.slice(0, this.n); }
}
class GrowU32 {
  constructor(n) { this.a = new Uint32Array(n); this.n = 0; }
  push3(x, y, z) { if (this.n + 3 > this.a.length) { const b = new Uint32Array(this.a.length * 2); b.set(this.a); this.a = b; } this.a[this.n++] = x; this.a[this.n++] = y; this.a[this.n++] = z; }
  out() { return this.a.slice(0, this.n); }
}
const nextFrame = () => new Promise(r => setTimeout(r, 0));

async function meshSDF(node, bmin, bmax, h, opts = {}) {
  const progress = opts.progress || (() => {});
  const aoNode = opts.ao || null;
  const f = node.f;
  const ox = bmin[0], oy = bmin[1], oz = bmin[2];
  const nx = Math.ceil((bmax[0] - ox) / h), ny = Math.ceil((bmax[1] - oy) / h), nz = Math.ceil((bmax[2] - oz) / h);
  const cx = nx + 1, cy = ny + 1, cxy = cx * cy;
  const vals = new Float32Array(cx * cy * (nz + 1)).fill(NaN);
  const B = 4, nbx = Math.ceil(nx / B), nby = Math.ceil(ny / B), nbz = Math.ceil(nz / B);
  const state = new Int8Array(nbx * nby * nbz);
  const lim = B * h * 0.5 * Math.sqrt(3) * 1.35 + h;
  let tick = performance.now();
  const maybeYield = async (frac) => { const t = performance.now(); if (t - tick > 30) { progress(frac); await nextFrame(); tick = performance.now(); } };

  // 1. classify blocks
  for (let bz = 0; bz < nbz; bz++) {
    for (let by = 0; by < nby; by++) for (let bx = 0; bx < nbx; bx++) {
      const d = f(ox + (bx * B + B / 2) * h, oy + (by * B + B / 2) * h, oz + (bz * B + B / 2) * h);
      state[(bz * nby + by) * nbx + bx] = Math.abs(d) > lim ? (d > 0 ? 1 : -1) : 0;
    }
    await maybeYield(0.05 * bz / nbz);
  }
  // 2. evaluate corners of near blocks
  for (let bz = 0; bz < nbz; bz++) {
    for (let by = 0; by < nby; by++) for (let bx = 0; bx < nbx; bx++) {
      if (state[(bz * nby + by) * nbx + bx] !== 0) continue;
      const i1 = Math.min(bx * B + B, nx), j1 = Math.min(by * B + B, ny), k1 = Math.min(bz * B + B, nz);
      for (let k = bz * B; k <= k1; k++) for (let j = by * B; j <= j1; j++) {
        let idx = k * cxy + j * cx + bx * B;
        for (let i = bx * B; i <= i1; i++, idx++) if (vals[idx] !== vals[idx]) vals[idx] = f(ox + i * h, oy + j * h, oz + k * h);
      }
    }
    await maybeYield(0.05 + 0.45 * bz / nbz);
  }
  // 3. far blocks: fill untouched corners with the block's sign
  for (let bz = 0; bz < nbz; bz++) for (let by = 0; by < nby; by++) for (let bx = 0; bx < nbx; bx++) {
    const st = state[(bz * nby + by) * nbx + bx];
    if (st === 0) continue;
    const i1 = Math.min(bx * B + B, nx), j1 = Math.min(by * B + B, ny), k1 = Math.min(bz * B + B, nz);
    for (let k = bz * B; k <= k1; k++) for (let j = by * B; j <= j1; j++) {
      let idx = k * cxy + j * cx + bx * B;
      for (let i = bx * B; i <= i1; i++, idx++) if (vals[idx] !== vals[idx]) vals[idx] = st * 1e3;
    }
  }

  // 4. one vertex per sign-changing cell
  const cellVert = new Int32Array(nx * ny * nz).fill(-1);
  const P = new GrowF32(1 << 18), N = new GrowF32(1 << 18), MT = new GrowF32(1 << 16), AO = new GrowF32(1 << 16);
  const e = h * 0.3, g = [0, 0, 0];
  const tet = (x, y, z) => {
    const a = f(x + e, y - e, z - e), b = f(x - e, y - e, z + e), c = f(x - e, y + e, z - e), d = f(x + e, y + e, z + e);
    g[0] = a - b - c + d; g[1] = -a - b + c + d; g[2] = -a + b - c + d;
    return (a + b + c + d) * 0.25;
  };
  const en = h * 0.01;   // narrow stencil for crossing normals so creases are not averaged away
  const tetN = (x, y, z) => {
    const a = f(x + en, y - en, z - en), b = f(x - en, y - en, z + en), c = f(x - en, y + en, z - en), d = f(x + en, y + en, z + en);
    g[0] = a - b - c + d; g[1] = -a - b + c + d; g[2] = -a + b - c + d;
  };
  const off = [0, 1, cx, cx + 1, cxy, cxy + 1, cxy + cx, cxy + cx + 1];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float64Array(8);
  let nv = 0;
  for (let bz = 0; bz < nbz; bz++) {
    for (let by = 0; by < nby; by++) for (let bx = 0; bx < nbx; bx++) {
      if (state[(bz * nby + by) * nbx + bx] !== 0) continue;
      const i1 = Math.min(bx * B + B, nx), j1 = Math.min(by * B + B, ny), k1 = Math.min(bz * B + B, nz);
      for (let k = bz * B; k < k1; k++) for (let j = by * B; j < j1; j++) for (let i = bx * B; i < i1; i++) {
        const base = k * cxy + j * cx + i;
        let mask = 0;
        for (let q = 0; q < 8; q++) { cv[q] = vals[base + off[q]]; if (cv[q] < 0) mask |= 1 << q; }
        if (mask === 0 || mask === 255) continue;
        // Dual contouring: refine each edge crossing, take its surface normal, and place the
        // vertex where those tangent planes meet (sharp creases stay straight, flat areas
        // fall back to the mass point through a small regulariser).
        const x0 = ox + i * h, y0 = oy + j * h, z0 = oz + k * h;
        let mxs = 0, mys = 0, mzs = 0, cnt = 0;
        let A00 = 0, A01 = 0, A02 = 0, A11 = 0, A12 = 0, A22 = 0, B0 = 0, B1 = 0, B2 = 0;
        for (const [a, b] of EDGES) {
          const va = cv[a], vb = cv[b];
          if ((va < 0) === (vb < 0)) continue;
          const ax = x0 + (a & 1) * h, ay = y0 + ((a >> 1) & 1) * h, az = z0 + ((a >> 2) & 1) * h;
          const dx = ((b & 1) - (a & 1)) * h, dy = (((b >> 1) & 1) - ((a >> 1) & 1)) * h, dz = (((b >> 2) & 1) - ((a >> 2) & 1)) * h;
          let t = va / (va - vb);
          const fq = f(ax + dx * t, ay + dy * t, az + dz * t);
          if ((fq < 0) === (va < 0)) t = t + (1 - t) * fq / (fq - vb); else t = t * va / (va - fq);
          t = clamp(t, 0, 1);
          const qx = ax + dx * t, qy = ay + dy * t, qz = az + dz * t;
          tetN(qx, qy, qz);
          const gl = Math.hypot(g[0], g[1], g[2]) || 1, nx0 = g[0] / gl, ny0 = g[1] / gl, nz0 = g[2] / gl;
          const dq = nx0 * qx + ny0 * qy + nz0 * qz;
          A00 += nx0 * nx0; A01 += nx0 * ny0; A02 += nx0 * nz0; A11 += ny0 * ny0; A12 += ny0 * nz0; A22 += nz0 * nz0;
          B0 += nx0 * dq; B1 += ny0 * dq; B2 += nz0 * dq;
          mxs += qx; mys += qy; mzs += qz; cnt++;
        }
        const cxm = mxs / cnt, cym = mys / cnt, czm = mzs / cnt, lam = 0.05;
        const a00 = A00 + lam, a11 = A11 + lam, a22 = A22 + lam;
        const r0 = B0 + lam * cxm, r1 = B1 + lam * cym, r2 = B2 + lam * czm;
        const c00 = a11 * a22 - A12 * A12, c01 = A02 * A12 - A01 * a22, c02 = A01 * A12 - a11 * A02;
        const det = a00 * c00 + A01 * c01 + A02 * c02;
        let px = cxm, py = cym, pz = czm;
        if (Math.abs(det) > 1e-12) {
          const c11 = a00 * a22 - A02 * A02, c12 = A01 * A02 - a00 * A12, c22 = a00 * a11 - A01 * A01;
          const qx = (c00 * r0 + c01 * r1 + c02 * r2) / det, qy = (c01 * r0 + c11 * r1 + c12 * r2) / det, qz = (c02 * r0 + c12 * r1 + c22 * r2) / det;
          const m = 0.5 * h;
          if (qx > x0 - m && qx < x0 + h + m && qy > y0 - m && qy < y0 + h + m && qz > z0 - m && qz < z0 + h + m) { px = qx; py = qy; pz = qz; }
          else {
            for (let it = 0; it < 2; it++) {   // outside the cell: snap the mass point onto the surface instead
              const d = tet(px, py, pz), gl2 = (g[0] * g[0] + g[1] * g[1] + g[2] * g[2]) || 1e-12, s = d / gl2 * (4 * e);
              px -= g[0] * s; py -= g[1] * s; pz -= g[2] * s;
            }
            px = clamp(px, x0 - m, x0 + h + m); py = clamp(py, y0 - m, y0 + h + m); pz = clamp(pz, z0 - m, z0 + h + m);
          }
        }
        tet(px, py, pz);
        const gl = Math.hypot(g[0], g[1], g[2]) || 1;
        const nxv = g[0] / gl, nyv = g[1] / gl, nzv = g[2] / gl;
        P.push3(px, py, pz); N.push3(nxv, nyv, nzv);
        MT.push1(node.m(px, py, pz));
        let ao = 1;
        if (aoNode) {
          let occ = 0, w = 0.5;
          const dl = 0.14;
          for (let s = 1; s <= 4; s++) {
            const dd = dl * s * 1.2, v = aoNode.f(px + nxv * dd, py + nyv * dd, pz + nzv * dd);
            occ += w * Math.max(0, dd - v) / dd;
            w *= 0.6;
          }
          ao = clamp(1 - occ * 1.25, 0.18, 1);
        }
        AO.push1(ao);
        cellVert[(k * ny + j) * nx + i] = nv++;
      }
    }
    await maybeYield(0.5 + 0.42 * bz / nbz);
  }

  // 5. faces: one quad per sign-changing grid edge
  const I = new GrowU32(1 << 19), pa = P.a;
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) { const t = b; b = d; d = t; }
    const d02 = (pa[a * 3] - pa[c * 3]) ** 2 + (pa[a * 3 + 1] - pa[c * 3 + 1]) ** 2 + (pa[a * 3 + 2] - pa[c * 3 + 2]) ** 2;
    const d13 = (pa[b * 3] - pa[d * 3]) ** 2 + (pa[b * 3 + 1] - pa[d * 3 + 1]) ** 2 + (pa[b * 3 + 2] - pa[d * 3 + 2]) ** 2;
    if (d02 <= d13) { I.push3(a, b, c); I.push3(a, c, d); } else { I.push3(a, b, d); I.push3(b, c, d); }
  };
  const CV = (i, j, k) => cellVert[(k * ny + j) * nx + i];
  for (let bz = 0; bz < nbz; bz++) {
    for (let by = 0; by < nby; by++) for (let bx = 0; bx < nbx; bx++) {
      if (state[(bz * nby + by) * nbx + bx] !== 0) continue;
      const i1 = Math.min(bx * B + B, nx), j1 = Math.min(by * B + B, ny), k1 = Math.min(bz * B + B, nz);
      for (let k = bz * B; k < k1; k++) for (let j = by * B; j < j1; j++) for (let i = bx * B; i < i1; i++) {
        const idx = k * cxy + j * cx + i, v0 = vals[idx], in0 = v0 < 0;
        if (j > 0 && k > 0 && (vals[idx + 1] < 0) !== in0) quad(CV(i, j - 1, k - 1), CV(i, j, k - 1), CV(i, j, k), CV(i, j - 1, k), !in0);
        if (i > 0 && k > 0 && (vals[idx + cx] < 0) !== in0) quad(CV(i - 1, j, k - 1), CV(i - 1, j, k), CV(i, j, k), CV(i, j, k - 1), !in0);
        if (i > 0 && j > 0 && (vals[idx + cxy] < 0) !== in0) quad(CV(i - 1, j - 1, k), CV(i, j - 1, k), CV(i, j, k), CV(i - 1, j, k), !in0);
      }
    }
    await maybeYield(0.92 + 0.08 * bz / nbz);
  }
  progress(1);
  return { positions: P.out(), normals: N.out(), mats: MT.out(), ao: AO.out(), indices: I.out(), vertexCount: nv };
}

// Interleave into the renderer's vertex layout: pos3 nrm3 uv2 colour(unorm8x4) mat(f32) = 40 bytes.
function packVertices(positions, normals, opts = {}) {
  const n = positions.length / 3, buf = new ArrayBuffer(n * 40), F = new Float32Array(buf), U = new Uint32Array(buf);
  const { uvs, colors, mats, mat = 0 } = opts;
  for (let i = 0; i < n; i++) {
    const o = i * 10;
    F[o] = positions[i * 3]; F[o + 1] = positions[i * 3 + 1]; F[o + 2] = positions[i * 3 + 2];
    F[o + 3] = normals[i * 3]; F[o + 4] = normals[i * 3 + 1]; F[o + 5] = normals[i * 3 + 2];
    F[o + 6] = uvs ? uvs[i * 2] : 0; F[o + 7] = uvs ? uvs[i * 2 + 1] : 0;
    if (colors) {
      const r = Math.round(clamp(colors[i * 4], 0, 1) * 255), g = Math.round(clamp(colors[i * 4 + 1], 0, 1) * 255);
      const b = Math.round(clamp(colors[i * 4 + 2], 0, 1) * 255), a = Math.round(clamp(colors[i * 4 + 3], 0, 1) * 255);
      U[o + 8] = (r | (g << 8) | (b << 16) | (a << 24)) >>> 0;
    } else U[o + 8] = 0xffffffff;
    F[o + 9] = mats ? mats[i] : mat;
  }
  return buf;
}
