/* ============================================================================
   Knight Kitten sculpt. Figure space: centimetres, origin at the centre of the
   base top, +Y up, figure faces +Z. Rigid parts: body, head, accessory arm
   (one per edition) and a clear-PVC steam piece for the Tea Break edition.
   ========================================================================== */
const MAT = {
  FUR: 0, FUR_LIGHT: 1, LID: 2, NOSE: 3, EAR_IN: 4, BOW: 5, ARMOR: 6, ARMOR_DARK: 7, GOLD: 8, LEATHER: 9,
  CAPE: 10, CAPE_IN: 11, BLADE: 12, GRIP: 13, CUP: 14, TEA: 15, CLEAR: 16, EYE: 17, LOADED: 24,
};
// Shared constants (also mirrored in the WGSL decal code).
const FIG = {
  headPivot: [0, 6.85, 0.1],
  armPivot: [-1.98, 5.32, 0.12],
  eye: { x: 1.18, y: 9.12, rx: 0.74, ry: 0.86, lidRise: 0.36, lidOff: 0.1 },
  mouth: [0, 7.9, 2.62],
  paw: [-1.05, 4.6, 3.75],
  grip: v3.norm([-0.18, 1, 0.06]),
  cup: [-0.05, 4.72, 3.9],
};

function sculptKnightKitten() {
  const S = SDF, M = MAT;
  const sides = [-1, 1];

  /* ---------------- BODY ---------------- */
  const body = [], groups = [];
  const close = () => { if (body.length) groups.push(S.union(...body.splice(0))); };
  // Sabatons: ellipsoid feet cut flat on the base, with two plate seams across the toes.
  for (const s of sides) {
    let foot = S.inter(S.ellipsoid([s * 1.0, 0.38, 0.6], [0.68, 0.52, 1.12], M.ARMOR), S.halfspace([0, -1, 0], 0));
    for (const z of [0.85, 1.25]) foot = S.groove(foot, S.halfspace([0, -0.25, 1], z), 0.022, 0.05);
    body.push(foot);
    body.push(S.roundCone([s * 0.92, 1.98, 0.0], [s * 0.98, 0.7, 0.2], 0.66, 0.54, M.ARMOR));           // greave
    body.push(S.ellipsoid([s * 0.96, 1.58, 0.58], [0.47, 0.43, 0.27], M.ARMOR));                        // knee cop
  }
  // Chainmail skirt with a rolled hem.
  const skirtC = [0, 2.25, 0];
  body.push(S.squash(S.frame(S.coneY(0.9, 2.3, 2.08, M.ARMOR_DARK), skirtC), skirtC, [1, 1, 0.86]));
  body.push(S.squash(S.frame(S.torusY(2.27, 0.08, M.ARMOR_DARK), [0, 1.4, 0]), [0, 1.4, 0], [1, 1, 0.86]));
  // Tassets: curved plates following the skirt, crisp edges, gold rivets.
  for (const s of sides) {
    const a1 = s > 0 ? 0.16 : -0.98, a2 = s > 0 ? 0.98 : -0.16;
    let plate = S.sub(S.frame(S.coneY(0.72, 2.43, 2.21, M.ARMOR), [0, 2.4, 0]), S.frame(S.coneY(0.9, 2.31, 2.09), [0, 2.4, 0]));
    plate = S.inter(plate, S.halfspace([-Math.cos(a1), 0, Math.sin(a1)], 0));
    plate = S.inter(plate, S.halfspace([Math.cos(a2), 0, -Math.sin(a2)], 0));
    body.push(S.squash(plate, skirtC, [1, 1, 0.86]));
    for (const ang of [a1 + 0.13, a2 - 0.13]) {
      const r = 2.43 - (2.95 - 1.68) / 1.44 * 0.22 + 0.01;
      body.push(S.sphere([Math.sin(ang) * r, 2.95, Math.cos(ang) * r * 0.86], 0.075, M.GOLD));
    }
  }
  close();
  // Belt and buckle.
  const beltC = [0, 3.18, 0];
  body.push(S.squash(S.frame(S.cylY(2.3, 0.25, 0.07, M.LEATHER), beltC), beltC, [1, 1, 0.86]));
  const buckleP = [0, 3.18, 2.3 * 0.86 + 0.02];
  let buckle = S.frame(S.roundBox([0.42, 0.32, 0.1], 0.06, M.GOLD), buckleP);
  buckle = S.sub(buckle, S.frame(S.roundBox([0.25, 0.15, 0.3], 0.03), buckleP), M.LEATHER);
  body.push(buckle, S.capsule([0, 3.18, buckleP[2] + 0.06], [0.24, 3.18, buckleP[2] + 0.06], 0.035, M.GOLD));
  // Cuirass: crisp lower edge resting on the belt, centre ridge, a plackart seam across the belly.
  let cuirass = S.inter(S.ellipsoid([0, 4.45, 0.05], [2.22, 1.95, 1.82], M.ARMOR), S.halfspace([0, -1, 0], -3.27));
  cuirass = S.inter(cuirass, S.halfspace([0, 1, 0], 6.15));
  cuirass = S.smooth(0.12, cuirass, S.capsule([0, 3.45, 1.78], [0, 5.75, 1.5], 0.07, M.ARMOR));
  cuirass = S.groove(cuirass, S.sphere([0, 1.6, 0.6], 3.05), 0.024, 0.06);
  body.push(cuirass);
  close();
  // Pauldrons: two lames each, crisp sloping lower edges, three gold rivets.
  for (const s of sides) {
    const lame = (c, r, y0) => S.inter(S.ellipsoid(c, r, M.ARMOR), S.halfspace([-s * 0.45, -1, 0], -s * 0.45 * c[0] - y0));
    body.push(lame([s * 2.0, 5.74, 0.02], [1.28, 1.0, 1.32], 5.28));
    body.push(lame([s * 2.24, 5.3, 0.02], [1.12, 0.84, 1.16], 4.86));
    for (const t of [-0.55, 0, 0.55]) {
      const d = v3.norm([s * 0.5, 0.62, t]);
      body.push(S.sphere([s * 2.0 + 1.28 * d[0], 5.74 + 1.0 * d[1], 0.02 + 1.32 * d[2]], 0.08, M.GOLD));
    }
  }
  close();
  // Gorget rings, neck and a ruff of layered cream locks.
  body.push(S.squash(S.frame(S.torusY(1.22, 0.3, M.ARMOR), [0, 6.1, 0.05]), [0, 6.1, 0.05], [1, 1, 0.9]));
  body.push(S.squash(S.frame(S.torusY(1.05, 0.22, M.ARMOR), [0, 6.42, 0.07]), [0, 6.42, 0.07], [1, 1, 0.9]));
  body.push(S.capsule([0, 6.0, 0.05], [0, 7.3, 0.15], 0.92, M.FUR));
  // Soft cream fur collar with a scalloped lower edge.
  const ruffC = [0, 6.62, 0.1];
  const ruff = S.displace(S.squash(S.frame(S.torusY(0.98, 0.33, M.FUR_LIGHT), ruffC), ruffC, [1, 0.85, 0.92]), 0.05,
    (x, y, z) => Math.sin(Math.atan2(x, z - 0.1) * 9) * smoothstep(6.7, 6.35, y));
  body.push(ruff);
  close();
  // Free arm (kitten's left, +x): paw resting on the belt.
  {
    const Sh = [1.95, 5.3, 0.1], E = [2.55, 4.05, 0.6], W = [1.75, 3.5, 1.6], P = [1.45, 3.45, 1.92];
    let upper = S.roundCone(Sh, E, 0.58, 0.5, M.ARMOR);
    const ax = v3.norm(v3.sub(E, Sh));
    for (const t of [0.4, 0.7]) { const q = v3.lerp(Sh, E, t); upper = S.groove(upper, S.halfspace(ax, v3.dot(ax, q)), 0.022, 0.06); }
    body.push(upper, S.ellipsoid(E, [0.44, 0.44, 0.44], M.ARMOR));
    body.push(S.frame(S.cylY(0.34, 0.04, 0.02, M.ARMOR), v3.add(E, [0.38, 0, 0.05]), rotAlign([1, 0, 0.15])));
    body.push(S.roundCone(E, W, 0.5, 0.43, M.ARMOR));
    const d = v3.norm(v3.sub(W, E));
    body.push(S.roundCone(v3.madd(W, d, -0.14), v3.madd(W, d, 0.1), 0.44, 0.56, M.ARMOR));
    const paw = [S.sphere(P, 0.5, M.FUR)];
    for (let k = 0; k < 4; k++) paw.push(S.sphere(v3.add(P, [-0.24 + k * 0.16, -0.32 + Math.abs(k - 1.5) * 0.05, 0.36]), 0.17, M.FUR));
    body.push(S.smooth(0.12, ...paw));
  }
  close();
  // Cape: thin shell behind the body with sculpted folds, crisp wavy hem and side edges; outer white, lining cream.
  const capeTop = 6.25;
  const capeR = (y, th) => 1.95 + (capeTop - y) * 0.24 + 0.17 * Math.sin(th * 6.5 + 0.8) * smoothstep(5.7, 3.0, y);
  const capeHem = th => 1.05 + 0.15 * Math.sin(th * 6.5 + 2.0);
  const capeSweep = y => -0.45 * smoothstep(5.8, 1.2, y);
  const capeF = (x, y, z) => {
    const px = x - capeSweep(y), pz = z + 0.25, r = Math.hypot(px, pz), th = Math.atan2(px, -pz);
    const thMax = 1.42 + 0.12 * (capeTop - y) / 5;
    const shell = Math.abs(r - capeR(y, th)) - 0.085;
    return Math.max(shell * 0.88, y - capeTop, capeHem(th) - y, (Math.abs(th) - thMax) * r);
  };
  body.push({
    f: capeF,
    m: (x, y, z) => { const px = x - capeSweep(y), pz = z + 0.25; return Math.hypot(px, pz) > capeR(y, Math.atan2(px, -pz)) ? M.CAPE : M.CAPE_IN; },
    bb: [-3.9, 0.7, -3.9, 3.9, 6.4, 1.6],
  });
  for (const s of sides) body.push(S.ellipsoid([s * 1.3, 6.02, 0.98], [0.24, 0.24, 0.12], M.GOLD));
  // Striped tail curling out from under the cape.
  body.push(S.tube([[0.5, 1.25, -1.45], [1.25, 0.75, -2.15], [2.25, 0.62, -2.42], [3.0, 1.1, -2.05], [3.25, 1.95, -1.5]],
    [0.36, 0.4, 0.4, 0.36, 0.27], 0.1, M.FUR));

  close();
  const bodySDF = S.union(...groups);

  /* ---------------- HEAD ---------------- */
  const skullBase = S.smooth(0.6,
    S.ellipsoid([0, 9.2, 0.15], [3.05, 2.72, 2.6], M.FUR),
    S.ellipsoid([0, 8.45, 0.45], [3.2, 1.8, 2.25], M.FUR));
  const head = [skullBase];
  // Layered cheek locks and a forehead tuft.
  const locks = [];
  for (const s of sides) {
    locks.push(S.roundCone([s * 2.65, 8.65, 0.85], [s * 3.6, 8.15, 0.95], 0.46, 0.06, M.FUR));
    locks.push(S.roundCone([s * 2.7, 8.0, 0.75], [s * 3.4, 7.42, 0.9], 0.4, 0.05, M.FUR));
    locks.push(S.roundCone([s * 2.45, 7.55, 0.95], [s * 2.85, 7.0, 1.15], 0.34, 0.05, M.FUR));
  }
  locks.push(S.roundCone([-0.25, 11.6, 0.95], [-0.5, 12.3, 1.3], 0.3, 0.05, M.FUR));
  locks.push(S.roundCone([0.2, 11.7, 0.75], [0.38, 12.32, 1.0], 0.28, 0.05, M.FUR));
  // Ears with a recessed pink inner ear and a cream tuft.
  for (const s of sides) {
    const Bc = [s * 1.9, 11.05, -0.15], T = [s * 2.75, 12.85, -0.25];
    let ear = S.squash(S.roundCone(Bc, T, 0.95, 0.14, M.FUR), Bc, [1, 1, 0.5]);
    const inner = S.squash(S.roundCone(v3.add(Bc, [0, 0.2, 0.47]), v3.add(T, [-s * 0.06, -0.3, 0.42]), 0.6, 0.05), v3.add(Bc, [0, 0, 0.47]), [1, 1, 0.5]);
    ear = S.sub(ear, inner, M.EAR_IN);
    head.push(ear);
    head.push(S.roundCone(v3.add(Bc, [-s * 0.05, 0.15, 0.2]), v3.add(Bc, [s * 0.22, 0.85, 0.24]), 0.2, 0.04, M.FUR_LIGHT));
  }
  // Muzzle pads, chin and nose.
  const muzzle = [];
  // muzzle is sculpted in the fur colour; the cream is a painted mask (crisp edge, see the shader)
  for (const s of sides) muzzle.push(S.ellipsoid([s * 0.43, 8.12, 2.6], [0.56, 0.46, 0.42], M.FUR));
  muzzle.push(S.ellipsoid([0, 7.58, 2.38], [0.5, 0.34, 0.36], M.FUR));
  const nose = S.ellipsoid([0, 8.62, 2.9], [0.3, 0.19, 0.2], M.NOSE);
  // Painted glossy eye plates and sharp, slanted upper lids (inner corner lower = stern look).
  const E = FIG.eye;
  for (const s of sides) {
    const ex = s * E.x;
    const ell = (x, y, k) => (Math.hypot((x - ex) / (E.rx * k), (y - E.y) / (E.ry * k)) - 1) * Math.min(E.rx, E.ry) * k;
    const plate = S.custom((x, y, z) => Math.max(ell(x, y, 1), 0.8 - z), [ex - 0.8, E.y - 0.9, 0.8, ex + 0.8, E.y + 0.9, 3.4]);
    head.push(S.sinter(0.05, S.offset(skullBase, 0.07), plate, M.EYE));
    const lidLine = x => E.y + E.lidOff + s * E.lidRise * (x - ex);
    const lidR = S.custom((x, y, z) => Math.max(ell(x, y, 1.12), lidLine(x) - y, 0.8 - z), [ex - 0.9, E.y - 1.0, 0.8, ex + 0.9, E.y + 1.0, 3.4]);
    head.push(S.inter(S.offset(skullBase, 0.14), lidR, M.LID));
  }
  // Pink bow on the left side of the head.
  {
    const bc = [1.05, 11.72, 0.95], R = rotM(-0.55, 0.25, -0.35);
    const parts = [];
    for (const s of sides) {
      let loop = S.frame(S.ellipsoid([0, 0, 0], [0.5, 0.33, 0.2], M.BOW), [s * 0.48, 0.02, 0], rotM(0, 0, s * 0.3));
      loop = S.groove(loop, S.frame(S.halfspace([0, 1, 0], 0), [s * 0.48, 0.02, 0], rotM(0, 0, s * 0.3)), 0.02, 0.05);
      parts.push(loop);
      parts.push(S.roundCone([s * 0.12, -0.1, 0.05], [s * 0.34, -0.56, 0.08], 0.12, 0.07, M.BOW));
    }
    parts.push(S.sphere([0, 0, 0.04], 0.2, M.BOW));
    head.push(S.frame(S.smooth(0.06, ...parts), bc, R));
  }
  head.push(S.capsule([0, 6.65, 0.1], [0, 7.6, 0.2], 0.9, M.FUR));
  const skullMuzzle = S.smooth(0.22, skullBase, ...muzzle);
  const headSDF = S.union(S.smooth(0.14, skullMuzzle, ...locks), ...head.slice(1), S.smooth(0.06, nose, muzzle[0], muzzle[1]));

  /* ---------------- ACCESSORY ARM (kitten's right, -x) ---------------- */
  const Sh = FIG.armPivot, EL = [-2.6, 4.3, 1.2], WR = [-1.35, 4.5, 3.4], P = FIG.paw;
  const armParts = [];
  {
    let upper = S.roundCone(Sh, EL, 0.58, 0.5, M.ARMOR);
    const ax = v3.norm(v3.sub(EL, Sh));
    for (const t of [0.4, 0.7]) { const q = v3.lerp(Sh, EL, t); upper = S.groove(upper, S.halfspace(ax, v3.dot(ax, q)), 0.022, 0.06); }
    armParts.push(upper, S.ellipsoid(EL, [0.44, 0.44, 0.44], M.ARMOR));
    armParts.push(S.frame(S.cylY(0.34, 0.04, 0.02, M.ARMOR), v3.add(EL, [-0.38, 0, 0.05]), rotAlign([-1, 0, 0.15])));
    armParts.push(S.roundCone(EL, WR, 0.5, 0.43, M.ARMOR));
    const d = v3.norm(v3.sub(WR, EL));
    armParts.push(S.roundCone(v3.madd(WR, d, -0.14), v3.madd(WR, d, 0.1), 0.44, 0.56, M.ARMOR));
    armParts.push(S.sphere(P, 0.52, M.FUR));
  }
  const armBare = S.union(...armParts);

  // Edition A: longsword.
  const g = FIG.grip, Rg = rotAlign(g);
  const sword = [];
  {
    const toes = [];
    for (let k = 0; k < 4; k++) toes.push(S.sphere(v3.add(v3.madd(P, g, (k - 1.5) * 0.26), [0.18, 0, 0.42]), 0.18, M.FUR));
    sword.push(S.smooth(0.1, S.sphere(P, 0.52, M.FUR), ...toes));
    const gripF = S.capsule(v3.madd(P, g, -0.85), v3.madd(P, g, 0.78), 0.17, M.GRIP);
    sword.push(S.displace(gripF, 0.022, (x, y, z) => Math.sin(((x - P[0]) * g[0] + (y - P[1]) * g[1] + (z - P[2]) * g[2]) * 26)));
    for (const t of [-0.86, 0.8]) sword.push(S.frame(S.torusY(0.19, 0.065, M.GOLD), v3.madd(P, g, t), Rg));
    sword.push(S.sphere(v3.madd(P, g, -1.1), 0.27, M.GOLD), S.sphere(v3.madd(P, g, -1.38), 0.09, M.GOLD));
    const G = v3.madd(P, g, 0.95);
    sword.push(S.frame(S.roundBox([1.15, 0.12, 0.15], 0.06, M.GOLD), G, Rg));
    sword.push(S.frame(S.roundBox([0.26, 0.22, 0.2], 0.07, M.GOLD), G, Rg));
    const xAx = [Rg[0], Rg[3], Rg[6]];
    for (const s of sides) sword.push(S.sphere(v3.madd(v3.madd(G, xAx, s * 1.17), g, -0.1), 0.17, M.GOLD));
    const L = 7.5;
    const blade = S.custom((x, y, z) => {
      // local coords: u across (xAx), t along g, v thickness
      const px = x - G[0], py = y - G[1], pz = z - G[2];
      const u = Rg[0] * px + Rg[3] * py + Rg[6] * pz, t = Rg[1] * px + Rg[4] * py + Rg[7] * pz - 0.12, v = Rg[2] * px + Rg[5] * py + Rg[8] * pz;
      const tt = clamp(t, 0, L);
      const w = 0.34 * (1 - 0.22 * tt / L) * (tt > L * 0.84 ? (L - tt) / (L * 0.16) : 1) + 1e-3;
      const th = 0.12 * Math.max(w / 0.34, 0.45);
      const dia = (Math.abs(u) * th + Math.abs(v) * w - w * th) / Math.hypot(w, th);
      // bevelled (blunt) cutting edge, ~0.7 mm thick, like a real PVC accessory
      return Math.max(dia, Math.abs(u) - Math.max(w - 0.1, w * 0.55), -t, t - L);
    }, [G[0] - 2.4, G[1] - 0.3, G[2] - 1, G[0] + 1, G[1] + 7.8, G[2] + 1.2], M.BLADE);
    sword.push(blade);
  }
  // Edition B: Hong Kong milk-tea cup.
  const cup = [];
  const C = FIG.cup;
  {
    const toes = [];
    for (let k = 0; k < 4; k++) toes.push(S.sphere(v3.add(P, [0.22, 0.32 - k * 0.2, 0.36 - Math.abs(k - 1.5) * 0.05]), 0.17, M.FUR));
    cup.push(S.smooth(0.1, S.sphere(P, 0.52, M.FUR), ...toes));
    let body = S.frame(S.cylY(0.82, 0.62, 0.14, M.CUP), C);
    body = S.sub(body, S.frame(S.cylY(0.66, 0.6, 0.1), v3.add(C, [0, 0.3, 0])), M.CUP);
    cup.push(S.smooth(0.05, body, S.frame(S.torusY(0.74, 0.085, M.CUP), v3.add(C, [0, 0.6, 0]))));
    cup.push(S.frame(S.cylY(0.672, 0.06, 0.02, M.TEA), v3.add(C, [0, 0.36, 0])));
    const handle = S.inter(S.frame(S.torusY(0.36, 0.1, M.CUP), v3.add(C, [-0.95, 0.05, 0]), rotM(Math.PI / 2, 0, 0)), S.halfspace([1, 0, 0], C[0] - 0.74));
    cup.push(handle);
  }
  const accSword = S.union(...sword);
  const accCup = S.union(...cup);

  // Clear-PVC steam: two twisting wisps rising from the tea, joined by a thin disc.
  const wisps = [S.frame(S.cylY(0.45, 0.03, 0.02, M.CLEAR), v3.add(C, [0, 0.45, 0]))];
  for (const [ph, H, dx] of [[0.4, 2.5, 0], [2.9, 1.8, 0.18]]) {
    const pts = [], rad = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, sp = 0.4 + t;
      pts.push([C[0] + dx + 0.24 * Math.sin(t * 6 + ph) * sp, C[1] + 0.47 + t * H, C[2] + 0.16 * Math.cos(t * 6 + ph) * sp]);
      rad.push(Math.max(0.035, 0.17 * (1 - t * 0.75) + 0.035 * Math.sin(t * 19 + ph)));
    }
    wisps.push(S.tube(pts, rad, 0.08, M.CLEAR));
  }
  const steam = S.smooth(0.1, ...wisps);

  const aoSDF = S.union(bodySDF, headSDF, armBare);
  return {
    parts: {
      body: { sdf: bodySDF, bounds: [[-4.0, -0.06, -3.95], [3.95, 7.9, 2.75]], h: 0.062 },
      head: { sdf: headSDF, bounds: [[-3.95, 6.4, -2.75], [3.95, 13.25, 3.35]], h: 0.046 },
      arm: { sdf: armBare, bounds: [[-3.4, 3.4, -0.65], [0.0, 6.15, 4.45]], h: 0.046 },
      accSword: { sdf: accSword, bounds: [[-3.8, 2.9, 2.75], [0.6, 13.4, 4.85]], h: 0.04 },
      accCup: { sdf: accCup, bounds: [[-1.8, 3.75, 2.85], [1.2, 6.1, 4.95]], h: 0.04 },
      steam: { sdf: steam, bounds: [[-1.15, 4.95, 3.0], [1.3, 7.95, 4.85]], h: 0.04 },
    },
    aoSDF,
  };
}
