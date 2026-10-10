/* ============================================================================
   Rigid body for the whole figure (figure + glued acrylic base). Collision hull
   is a cloud of extreme points; contacts are resolved with sequential impulses
   (restitution + Coulomb friction) against the floor and the studio walls.
   Units: cm, s. Never deforms.
   ========================================================================== */
const GRAVITY = 981;
const PLANES = [
  { n: [0, 1, 0], d: 0 },        // floor
  { n: [0, 0, 1], d: -32 },      // invisible bounds keep a thrown figure in the field
  { n: [0, 0, -1], d: -32 },
  { n: [1, 0, 0], d: -32 },
  { n: [-1, 0, 0], d: -32 },
];

class FigureBody {
  constructor() {
    this.x = [0, 0, 0]; this.q = [0, 0, 0, 1]; this.v = [0, 0, 0]; this.w = [0, 0, 0];
    this.mass = 1; this.com = [0, 0, 0]; this.Ib = [1, 1, 1]; this.points = [];
    this.restY = 0.6; this.stillTime = 0; this.asleep = true; this.grab = null; this.contact = false;
  }
  // shape: com (figure-local), diagonal inertia about com, hull points (figure-local)
  setShape(com, Ib, points) { this.com = com; this.Ib = Ib; this.points = points; }
  R() { return quat.toM3(this.q); }
  matrix() { return m4.mul(m4.fromQuat(this.q, this.x), m4.translate(v3.mul(this.com, -1))); }
  toWorld(p) { return v3.add(this.x, quat.rotate(this.q, v3.sub(p, this.com))); }
  toLocal(p) { return v3.add(quat.rotate(quat.conj(this.q), v3.sub(p, this.x)), this.com); }
  Iinv(vec) { // world-space inverse inertia applied to vec
    const R = this.R(), l = m3.mulV(m3.T(R), vec);
    return m3.mulV(R, [l[0] / this.Ib[0], l[1] / this.Ib[1], l[2] / this.Ib[2]]);
  }
  // Upright rest pose with a given yaw.
  restPose(yaw = 0) {
    const q = quat.axisAngle([0, 1, 0], yaw);
    return { q, x: v3.add([0, this.restY, 0], quat.rotate(q, this.com)) };
  }
  setPose(x, q) { this.x = x.slice(); this.q = q.slice(); }
  wake() { this.asleep = false; this.stillTime = 0; }
  stop() { this.v = [0, 0, 0]; this.w = [0, 0, 0]; }

  step(dt) {
    if (this.asleep && !this.grab) return;
    const g = this.grab;
    if (g) {
      const pa = this.toWorld(g.local), r = v3.sub(pa, this.x);
      const va = v3.add(this.v, v3.cross(this.w, r));
      let F = v3.sub(v3.mul(v3.sub(g.target, pa), 520), v3.mul(va, 38));
      const Fl = v3.len(F); if (Fl > 6000) F = v3.mul(F, 6000 / Fl);
      this.v = v3.madd(this.v, F, dt / this.mass);
      this.w = v3.add(this.w, v3.mul(this.Iinv(v3.cross(r, F)), dt));
      this.w = v3.mul(this.w, 1 - Math.min(0.9, 5 * dt));
      this.v = v3.mul(this.v, 1 - Math.min(0.9, 1.2 * dt));
    }
    this.v[1] -= GRAVITY * dt;
    this.v = v3.mul(this.v, 1 / (1 + 0.04 * dt));
    this.w = v3.mul(this.w, 1 / (1 + 0.25 * dt));
    // integrate
    this.x = v3.madd(this.x, this.v, dt);
    const [wx, wy, wz] = this.w, q = this.q;
    this.q = quat.norm([
      q[0] + 0.5 * dt * (wx * q[3] + wy * q[2] - wz * q[1]),
      q[1] + 0.5 * dt * (wy * q[3] + wz * q[0] - wx * q[2]),
      q[2] + 0.5 * dt * (wz * q[3] + wx * q[1] - wy * q[0]),
      q[3] + 0.5 * dt * (-wx * q[0] - wy * q[1] - wz * q[2]),
    ]);
    this.collide(dt);
    // sleep when resting
    const still = this.contact && v3.len(this.v) < 1.2 && v3.len(this.w) < 0.12 && !g;
    this.stillTime = still ? this.stillTime + dt : 0;
    if (this.stillTime > 0.5) { this.stop(); this.asleep = true; }
  }

  collide(dt) {
    const contacts = [], invM = 1 / this.mass;
    const maxPen = new Array(PLANES.length).fill(0);
    for (const p of this.points) {
      const pw = this.toWorld(p);
      PLANES.forEach((pl, k) => {
        const pen = pl.d - v3.dot(pl.n, pw);
        if (pen > 0) {
          const r = v3.sub(pw, this.x);
          const vrel = v3.add(this.v, v3.cross(this.w, r));
          contacts.push({ n: pl.n, r, vn0: v3.dot(vrel, pl.n), jn: 0, jt: [0, 0, 0] });
          if (pen > maxPen[k]) maxPen[k] = pen;
        }
      });
    }
    this.contact = contacts.length > 0;
    if (!contacts.length) return;
    const eff = (r, n) => invM + v3.dot(n, v3.cross(this.Iinv(v3.cross(r, n)), r));
    for (const c of contacts) c.kn = eff(c.r, c.n);
    const MU = 0.45;
    for (let it = 0; it < 12; it++) {
      for (const c of contacts) {
        const vrel = v3.add(this.v, v3.cross(this.w, c.r));
        const vn = v3.dot(vrel, c.n);
        const e = c.vn0 < -45 ? 0.32 : 0;     // small, hard bounce only for real impacts
        const target = -e * c.vn0;
        let j = (target - vn) / c.kn;
        const acc = Math.max(c.jn + j, 0); j = acc - c.jn; c.jn = acc;
        this.apply(v3.mul(c.n, j), c.r);
        // friction
        const vr2 = v3.add(this.v, v3.cross(this.w, c.r));
        const vt = v3.madd(vr2, c.n, -v3.dot(vr2, c.n)), vtl = v3.len(vt);
        if (vtl > 1e-6) {
          const t = v3.mul(vt, 1 / vtl);
          let jt = -vtl / eff(c.r, t);
          let newJt = v3.madd(c.jt, t, jt);
          const lim = MU * c.jn, nl = v3.len(newJt);
          if (nl > lim) newJt = v3.mul(newJt, lim / nl);
          const dj = v3.sub(newJt, c.jt); c.jt = newJt;
          this.apply(dj, c.r);
        }
      }
    }
    // rolling resistance and positional correction
    this.w = v3.mul(this.w, 1 - Math.min(0.5, 2.2 * dt));
    PLANES.forEach((pl, k) => { if (maxPen[k] > 0.002) this.x = v3.madd(this.x, pl.n, (maxPen[k] - 0.002) * 0.85); });
  }
  apply(J, r) {
    this.v = v3.madd(this.v, J, 1 / this.mass);
    this.w = v3.add(this.w, this.Iinv(v3.cross(r, J)));
  }
}

// Inertia for a heavy acrylic disc plus a box-ish figure; returns { com, Ib }.
function figureInertia(baseR, figBox) {
  const mb = 0.42, mf = 0.58, H = 0.6;
  const cb = [0, -H / 2, 0];
  const cf = [(figBox[0] + figBox[3]) / 2, figBox[1] + (figBox[4] - figBox[1]) * 0.42, (figBox[2] + figBox[5]) / 2];
  const com = v3.add(v3.mul(cb, mb), v3.mul(cf, mf));
  const bx = figBox[3] - figBox[0], by = figBox[4] - figBox[1], bz = figBox[5] - figBox[2];
  const Ib = [0, 0, 0];
  const Idisc = [mb * (3 * baseR * baseR + H * H) / 12, mb * baseR * baseR / 2, mb * (3 * baseR * baseR + H * H) / 12];
  const Ibox = [mf * (by * by + bz * bz) / 12 * 0.6, mf * (bx * bx + bz * bz) / 12 * 0.6, mf * (bx * bx + by * by) / 12 * 0.6];
  for (const [I, m, c] of [[Idisc, mb, cb], [Ibox, mf, cf]]) {
    const d = v3.sub(c, com);
    Ib[0] += I[0] + m * (d[1] * d[1] + d[2] * d[2]);
    Ib[1] += I[1] + m * (d[0] * d[0] + d[2] * d[2]);
    Ib[2] += I[2] + m * (d[0] * d[0] + d[1] * d[1]);
  }
  return { com, Ib };
}

// Extreme points of a point cloud in many directions + the base rim.
function hullPoints(clouds, baseR) {
  const dirs = [], N = 160, ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) { const y = 1 - (i + 0.5) / N * 2, r = Math.sqrt(1 - y * y); dirs.push([Math.cos(ga * i) * r, y, Math.sin(ga * i) * r]); }
  const best = dirs.map(() => ({ s: -1e9, p: null }));
  for (const pos of clouds) {
    const step = Math.max(3, Math.floor(pos.length / 3 / 40000)) * 3;
    for (let i = 0; i < pos.length; i += step) {
      const x = pos[i], y = pos[i + 1], z = pos[i + 2];
      for (let k = 0; k < N; k++) { const d = dirs[k], s = d[0] * x + d[1] * y + d[2] * z; if (s > best[k].s) { best[k].s = s; best[k].p = [x, y, z]; } }
    }
  }
  const pts = best.filter(b => b.p).map(b => b.p);
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    pts.push([Math.cos(a) * baseR, -0.6, Math.sin(a) * baseR], [Math.cos(a) * baseR, 0, Math.sin(a) * baseR]);
  }
  // remove duplicates
  const seen = new Set();
  return pts.filter(p => { const k = p.map(v => v.toFixed(3)).join(','); if (seen.has(k)) return false; seen.add(k); return true; });
}
