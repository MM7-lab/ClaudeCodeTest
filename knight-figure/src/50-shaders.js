/* ============================================================================
   WGSL. Lights and figure constants are injected from JS so the decal code and
   the sculpt share one source of truth.
   ========================================================================== */
const LIGHTS = {
  key: v3.norm([0.42, 0.92, 0.5]), fill: v3.norm([-0.85, 0.3, 0.55]),
  rimL: v3.norm([-0.82, 0.36, -0.6]), rimR: v3.norm([0.8, 0.42, -0.62]), top: v3.norm([0.0, 1.0, 0.12]),
};
const wv = a => `vec3f(${a.map(x => x.toFixed(5)).join(', ')})`;
const wf = x => x.toFixed(5);

const WGSL_COMMON = /* wgsl */`
struct Frame { vp: mat4x4f, lvp: mat4x4f, cam: vec4f, res: vec4f, base: vec4f, baseUp: vec4f, misc: vec4f };
struct Draw { model: mat4x4f, nmat: mat4x4f, p0: vec4f, tint: vec4f, p1: vec4f };
const KEY = ${wv(LIGHTS.key)};
const FILL = ${wv(LIGHTS.fill)};
const RIML = ${wv(LIGHTS.rimL)};
const RIMR = ${wv(LIGHTS.rimR)};
const TOP = ${wv(LIGHTS.top)};
const KEYC = vec3f(1.0, 0.95, 0.88);
const FILLC = vec3f(0.85, 0.9, 1.0);
const RIMC = vec3f(0.9, 0.95, 1.0);

fn boxLight(d: vec3f, c: vec3f, up: vec3f, hs: vec2f, soft: f32) -> f32 {
  let ca = dot(d, c);
  let r = normalize(cross(up, c));
  let u = cross(c, r);
  let x = dot(d, r) / max(ca, 1e-3);
  let y = dot(d, u) / max(ca, 1e-3);
  let ex = 1.0 - smoothstep(hs.x - soft, hs.x + soft, abs(x));
  let ey = 1.0 - smoothstep(hs.y - soft, hs.y + soft, abs(y));
  return select(0.0, ex * ey, ca > 0.0) * (hs.x * hs.y) / ((hs.x + soft) * (hs.y + soft));
}
struct Env { key: vec3f, rest: vec3f };
// Procedural photo studio: key softbox, fill, two tall rim strips, overhead panel, dark cyclorama.
fn studio(d: vec3f, rough: f32) -> Env {
  let soft = 0.012 + rough * rough * 1.35;
  var e: Env;
  e.key = KEYC * 10.0 * boxLight(d, KEY, vec3f(0.0, 1.0, 0.0), vec2f(0.42, 0.3), soft);
  let fill = FILLC * 1.5 * boxLight(d, FILL, vec3f(0.0, 1.0, 0.0), vec2f(0.6, 0.45), soft);
  let rims = RIMC * 14.0 * (boxLight(d, RIML, vec3f(0.0, 1.0, 0.0), vec2f(0.045, 0.8), soft) + boxLight(d, RIMR, vec3f(0.0, 1.0, 0.0), vec2f(0.045, 0.8), soft));
  let top = vec3f(3.2) * boxLight(d, TOP, vec3f(0.0, 0.0, 1.0), vec2f(0.5, 0.5), soft);
  let bg = mix(vec3f(0.03, 0.04, 0.022), mix(vec3f(0.1, 0.115, 0.11), vec3f(0.03, 0.036, 0.046), smoothstep(0.02, 0.6, d.y)), smoothstep(-0.12, 0.04, d.y));
  e.rest = fill + rims + top + bg;
  return e;
}
fn envBRDF(f0: vec3f, r: f32, nv: f32) -> vec3f {
  let c0 = vec4f(-1.0, -0.0275, -0.572, 0.022);
  let c1 = vec4f(1.0, 0.0425, 1.04, -0.04);
  let rr = r * c0 + c1;
  let a004 = min(rr.x * rr.x, exp2(-9.28 * nv)) * rr.x + rr.y;
  let ab = vec2f(-1.04, 1.04) * a004 + rr.zw;
  return f0 * ab.x + ab.y;
}
fn wrapL(n: vec3f, l: vec3f, w: f32) -> f32 { return clamp((dot(n, l) + w) / (1.0 + w), 0.0, 1.0); }
fn cover(d: f32, w: f32) -> f32 { return clamp(0.5 - d / max(w, 1e-5), 0.0, 1.0); }
fn sdSeg(p: vec2f, a: vec2f, b: vec2f, ra: f32, rb: f32) -> f32 {
  let pa = p - a; let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}
// Reversible tone curve around the MSAA resolve: bright highlights no longer alias on edges.
fn compress(c: vec3f) -> vec3f { return c / (1.0 + max(c.r, max(c.g, c.b))); }
fn hash2(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453); }
fn acesFit(x: vec3f) -> vec3f {
  let a = mat3x3f(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  let b = mat3x3f(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  let v = a * x;
  let r = (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081);
  return clamp(b * r, vec3f(0.0), vec3f(1.0));
}
`;

const WGSL_FRAME_BINDINGS = /* wgsl */`
@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var shadowTex: texture_depth_2d;
@group(0) @binding(2) var shadowSmp: sampler_comparison;
@group(0) @binding(3) var<uniform> MT: array<vec4f, 120>;
@group(1) @binding(0) var<uniform> D: Draw;
@group(1) @binding(1) var colTex: texture_2d<f32>;
@group(1) @binding(2) var colSmp: sampler;

var<private> TAPS: array<vec2f, 12> = array<vec2f, 12>(vec2f(-0.326, -0.406), vec2f(-0.840, -0.074), vec2f(-0.696, 0.457), vec2f(-0.203, 0.621),
  vec2f(0.962, -0.195), vec2f(0.473, -0.480), vec2f(0.519, 0.767), vec2f(0.185, -0.893), vec2f(0.507, 0.064),
  vec2f(0.896, 0.412), vec2f(-0.322, -0.933), vec2f(-0.792, -0.598));
fn shadowAt(wp: vec3f, n: vec3f) -> f32 {
  let lp = F.lvp * vec4f(wp + n * 0.05, 1.0);
  let uv = lp.xy * vec2f(0.5, -0.5) + 0.5;
  let z = lp.z - 0.0015;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 || z > 1.0) { return 1.0; }
  // fixed Poisson disc over a bilinear compare: smooth penumbra, no per-pixel grain
  var s = 0.0;
  for (var i = 0; i < 12; i++) {
    s += textureSampleCompareLevel(shadowTex, shadowSmp, uv + TAPS[i] * F.misc.y * F.misc.z, z);
  }
  return s / 12.0;
}

struct VI { @location(0) pos: vec3f, @location(1) nrm: vec3f, @location(2) uv: vec2f, @location(3) col: vec4f, @location(4) mat: f32, @location(5) ao: f32 };
struct VO {
  @builtin(position) clip: vec4f,
  @location(0) wpos: vec3f, @location(1) wn: vec3f, @location(2) opos: vec3f, @location(3) uv: vec2f,
  @location(4) col: vec4f, @location(5) @interpolate(flat) mat: u32, @location(6) ao: f32, @location(7) on: vec3f,
};
@vertex fn vsMain(v: VI) -> VO {
  var o: VO;
  let w = D.model * vec4f(v.pos, 1.0);
  o.clip = F.vp * w;
  o.wpos = w.xyz;
  o.wn = (D.nmat * vec4f(v.nrm, 0.0)).xyz;
  o.opos = v.pos; o.on = v.nrm; o.uv = v.uv; o.col = v.col; o.mat = u32(v.mat + 0.5); o.ao = v.ao;
  return o;
}
`;

function wgslMain() {
  const E = FIG.eye, P = FIG.paw, g = FIG.grip, C = FIG.cup;
  const G = v3.madd(P, g, 0.95), Rg = rotAlign(g), xAx = [Rg[0], Rg[3], Rg[6]];
  return WGSL_COMMON + WGSL_FRAME_BINDINGS + /* wgsl */`
struct Surf { albedo: vec3f, rough: f32, metal: f32, cc: f32, ccr: f32, sss: f32 };
const EYE_X = ${wf(E.x)}; const EYE_Y = ${wf(E.y)}; const EYE_R = vec2f(${wf(E.rx)}, ${wf(E.ry)});
const LID_OFF = ${wf(E.lidOff)}; const LID_RISE = ${wf(E.lidRise)};
const MOUTH_Y = ${wf(FIG.mouth[1])};
const BLADE_G = ${wv(G)}; const BLADE_DIR = ${wv(g)}; const BLADE_X = ${wv(xAx)};
const CUP_C = ${wv(C)};
const DARK = vec3f(0.07, 0.05, 0.045);

fn paint(mid: u32, p: vec3f, n: vec3f, fw: f32, dset: f32, s0: Surf) -> Surf {
  var s = s0;
  let side = select(-1.0, 1.0, p.x >= 0.0);
  if (mid == 0u) {                                    // tabby fur
    var stripe = 0.0;
    if (dset == 1.0) {
      if (n.z > 0.25) {
        let q = p.xy;
        stripe = max(stripe, cover(sdSeg(q, vec2f(-0.45, 11.25), vec2f(-0.33, 10.86), 0.09, 0.045), fw));
        stripe = max(stripe, cover(sdSeg(q, vec2f(0.0, 11.42), vec2f(0.0, 10.95), 0.1, 0.045), fw));
        stripe = max(stripe, cover(sdSeg(q, vec2f(0.45, 11.25), vec2f(0.33, 10.86), 0.09, 0.045), fw));
        // eyebrows: inner end lower, painted dark
        let bro = sdSeg(q, vec2f(side * 0.6, 10.2), vec2f(side * 1.8, 10.62), 0.12, 0.045);
        s.albedo = mix(s.albedo, vec3f(0.2, 0.14, 0.11), cover(bro, fw));
        // painted cream muzzle mask with the mouth and whisker dots on it
        var md = (length((q - vec2f(0.43, 8.12)) / vec2f(0.6, 0.5)) - 1.0) * 0.5;
        md = min(md, (length((q - vec2f(-0.43, 8.12)) / vec2f(0.6, 0.5)) - 1.0) * 0.5);
        md = min(md, (length((q - vec2f(0.0, 7.6)) / vec2f(0.55, 0.38)) - 1.0) * 0.38);
        let cream = cover(md, fw) * step(1.9, p.z);
        s.albedo = mix(s.albedo, vec3f(0.86, 0.79, 0.7), cream);
        var ink = cover(sdSeg(q, vec2f(0.0, 8.45), vec2f(0.0, MOUTH_Y + 0.05), 0.022, 0.022), fw);
        for (var k = 0; k < 2; k++) {
          let sx = select(-1.0, 1.0, k == 1);
          let c = vec2f(sx * 0.16, MOUTH_Y - 0.1);
          let dq = q - c;
          let arc = select(length(q - vec2f(sx * 0.32, MOUTH_Y - 0.1)) - 0.024, abs(length(dq) - 0.16) - 0.024, dq.y > -0.04);
          ink = max(ink, cover(arc, fw));
          for (var j = 0; j < 3; j++) {
            let dp = q - vec2f(sx * (0.3 + 0.15 * f32(j)), 8.22 - 0.08 * f32(j));
            ink = max(ink, cover(length(dp) - 0.034, fw));
          }
        }
        s.albedo = mix(s.albedo, vec3f(0.26, 0.15, 0.13), ink * step(1.9, p.z));
        // airbrushed blush
        let e = (q - vec2f(side * 1.86, 8.38)) / vec2f(0.6, 0.34);
        s.albedo = mix(s.albedo, vec3f(0.98, 0.56, 0.6), (1.0 - smoothstep(0.15, 1.0, length(e))) * 0.42);
      }
      if (abs(p.x) > 1.95 && n.z > -0.3) {
        let q = vec2f(abs(p.x), p.y);
        stripe = max(stripe, cover(sdSeg(q, vec2f(2.3, 9.02), vec2f(2.98, 8.9), 0.07, 0.03), fw));
        stripe = max(stripe, cover(sdSeg(q, vec2f(2.24, 8.64), vec2f(2.88, 8.44), 0.065, 0.03), fw));
      }
      if (p.z < 0.3 && n.z < 0.1) {
        let v = p.y * 2.1 + sin(p.x * 1.3) * 0.35;
        stripe = max(stripe, cover((abs(fract(v) - 0.5) - 0.14) / 2.1, fw));
      }
    }
    if (dset == 2.0 && p.x > 0.2 && p.z < -1.1 && p.y < 2.6) {   // tail rings
      let v = (p.x * 0.85 + p.y * 1.05) * 1.6;
      stripe = cover((abs(fract(v) - 0.5) - 0.15) / 1.6, fw);
    }
    s.albedo = mix(s.albedo, s.albedo * vec3f(0.5, 0.47, 0.45), stripe);
  } else if (mid == 1u) {                             // cream fur: mouth, whisker dots
    if (dset == 1.0 && n.z > 0.2) {
      let q = p.xy;
      var ink = cover(sdSeg(q, vec2f(0.0, 8.45), vec2f(0.0, MOUTH_Y + 0.05), 0.022, 0.022), fw);
      for (var k = 0; k < 2; k++) {
        let sx = select(-1.0, 1.0, k == 1);
        let c = vec2f(sx * 0.16, MOUTH_Y - 0.1);
        let dq = q - c;
        let arc = select(length(q - vec2f(sx * 0.32, MOUTH_Y - 0.1)) - 0.024, abs(length(dq) - 0.16) - 0.024, dq.y > -0.04);
        ink = max(ink, cover(arc, fw));
        for (var j = 0; j < 3; j++) {
          let dp = q - vec2f(sx * (0.3 + 0.15 * f32(j)), 8.22 - 0.08 * f32(j));
          ink = max(ink, cover(length(dp) - 0.034, fw));
        }
      }
      s.albedo = mix(s.albedo, vec3f(0.26, 0.15, 0.13), ink);
    }
  } else if (mid == 2u) {                             // eyelid with a painted lash line
    let lidLine = EYE_Y + LID_OFF + side * LID_RISE * (p.x - side * EYE_X);
    let lash = cover(p.y - lidLine - 0.075, fw);
    s.albedo = mix(s.albedo * 0.92, DARK, lash);
    s.rough = mix(s.rough, 0.2, lash);
  } else if (mid == 3u) {                             // nose gradient
    s.albedo = mix(s.albedo, s.albedo * vec3f(0.78, 0.62, 0.66), smoothstep(8.7, 8.45, p.y));
  } else if (mid == 4u) {                             // airbrushed inner ear
    s.albedo = mix(vec3f(0.98, 0.78, 0.8), vec3f(0.86, 0.48, 0.55), smoothstep(12.4, 11.2, p.y));
  } else if (mid == 6u) {                             // silver paint: soft top-lit gradient
    s.albedo = s.albedo * (0.82 + 0.18 * (n.y * 0.5 + 0.5));
  } else if (mid == 7u) {                             // chainmail rings
    let a = atan2(p.x, p.z / 0.86) * 2.2;
    let row = floor(p.y * 6.5);
    let uv = vec2f(a * 5.2 + fract(row * 0.5) * 1.0, p.y * 6.5);
    let cell = fract(uv) - 0.5;
    let rd = abs(length(cell) - 0.3) - 0.11;
    let ring = cover(rd / 6.0, fw);
    s.albedo = mix(s.albedo * 0.35, s.albedo * 1.15, ring);
    s.rough = mix(0.7, s.rough, ring);
  } else if (mid == 10u || mid == 11u) {              // cape: gold hem band and a paw emblem on the back
    let sweep = -0.45 * smoothstep(5.8, 1.2, p.y);
    let px = p.x - sweep; let pz = p.z + 0.25;
    let th = atan2(px, -pz);
    let hem = 1.05 + 0.15 * sin(th * 6.5 + 2.0);
    let band = cover(abs(p.y - hem - 0.2) - 0.06, fw);
    var gold = band;
    if (mid == 10u && pz < -1.6) {
      let q = vec2f(-px, p.y);
      var em = cover((length((q - vec2f(0.0, 3.65)) / vec2f(0.52, 0.42)) - 1.0) * 0.42, fw);
      em = max(em, cover(length(q - vec2f(-0.52, 4.24)) - 0.17, fw));
      em = max(em, cover(length(q - vec2f(0.52, 4.24)) - 0.17, fw));
      em = max(em, cover(length(q - vec2f(-0.19, 4.52)) - 0.17, fw));
      em = max(em, cover(length(q - vec2f(0.19, 4.52)) - 0.17, fw));
      gold = max(gold, em);
    }
    s.albedo = mix(s.albedo, vec3f(0.85, 0.62, 0.28), gold);
    s.metal = mix(s.metal, 0.75, gold);
    s.rough = mix(s.rough, 0.32, gold);
    s.cc = mix(s.cc, 0.4, gold);
  } else if (mid == 12u) {                            // blade: darker fuller, bright bevelled edges
    let r = p - BLADE_G;
    let u = abs(dot(r, BLADE_X));
    let t = dot(r, BLADE_DIR);
    let fuller = cover(u - 0.055, fw) * step(0.35, t) * step(t, 5.2);
    s.albedo = mix(s.albedo, s.albedo * 0.55, fuller);
    s.rough = mix(s.rough, 0.32, fuller);
    let w = 0.34 * (1.0 - 0.22 * t / 7.5);
    s.albedo = mix(s.albedo, vec3f(1.0), smoothstep(w - 0.09, w - 0.02, u) * 0.35);
  } else if (mid == 14u) {                            // cup: thin green line under the rim
    let r = length(p.xz - CUP_C.xz);
    let line = cover(abs(p.y - (CUP_C.y + 0.42)) - 0.025, fw) * step(0.78, r);
    s.albedo = mix(s.albedo, vec3f(0.18, 0.5, 0.38), line);
  } else if (mid == 15u) {                            // milk tea
    let r = length(p.xz - CUP_C.xz);
    s.albedo = mix(s.albedo, vec3f(0.78, 0.6, 0.42), smoothstep(0.45, 0.66, r));
  } else if (mid == 17u) {                            // painted glossy eye
    let ec = vec2f(side * EYE_X, EYE_Y);
    let q = p.xy - ec;
    let u = q / EYE_R;
    let rr = length(u);
    let m = min(EYE_R.x, EYE_R.y);
    var col = DARK;
    let t = clamp(u.y * 0.5 + 0.55, 0.0, 1.0);
    var iris = mix(vec3f(1.0, 0.7, 0.22), vec3f(0.45, 0.2, 0.04), t);
    iris = mix(iris, iris * 0.4, smoothstep(0.55, 0.86, rr));
    col = mix(col, iris, cover((rr - 0.86) * m, fw));
    let pu = (q - vec2f(0.0, 0.05)) / (EYE_R * vec2f(0.52, 0.64));
    col = mix(col, vec3f(0.025, 0.018, 0.018), cover((length(pu) - 1.0) * m * 0.52, fw));
    // lower reflected light
    let cres = (rr - 0.7) * m;
    col = mix(col, col + vec3f(0.35, 0.22, 0.08), cover(abs(cres) - 0.05, fw) * smoothstep(-0.2, -0.75, u.y) * 0.8);
    col = mix(col, vec3f(1.0), cover(length(q - vec2f(-0.24, 0.02)) - 0.16, fw));
    col = mix(col, vec3f(1.0), cover(length(q - vec2f(0.22, -0.36)) - 0.07, fw));
    s.albedo = col;
  }
  return s;
}

@fragment fn fsMain(i: VO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  // derivatives first (uniform control flow)
  let fw = max(length(dpdx(i.opos)), length(dpdy(i.opos))) * 1.2;
  let texc = textureSample(colTex, colSmp, i.uv);
  let dnx = dpdx(i.wn); let dny = dpdy(i.wn);
  let nvar = dot(dnx, dnx) + dot(dny, dny);
  let cg = cross(dpdx(i.wpos), dpdy(i.wpos));

  var N = normalize(i.wn);
  if (!ff) { N = -N; }
  // true facet normal: shadow lookups use it so low-poly models with smooth normals don't self-shadow at the terminator
  let Ng = select(N, normalize(cg) * select(-1.0, 1.0, dot(cg, N) >= 0.0), dot(cg, cg) > 1e-14);
  let mid = i.mat;
  let m0 = MT[mid * 3u]; let m1 = MT[mid * 3u + 1u]; let m2 = MT[mid * 3u + 2u];
  var s = Surf(m0.rgb, m1.x, m1.y, m1.z, m1.w, m0.a);
  if (mid >= 24u) {
    let vc = pow(i.col.rgb, vec3f(2.2));
    let tinted = D.tint.rgb * vc;
    let tex = m0.rgb * texc.rgb * vc;
    s.albedo = select(tex, tinted, D.p0.w > 0.5 && m2.y < 0.5);
    if (texc.a * i.col.a < D.p1.z) { discard; }
    let fin = D.p0.z;
    if (fin == 1.0) { s.rough = 0.2; s.cc = 1.0; s.ccr = 0.05; }
    if (fin == 2.0) { s.rough = 0.4; s.cc = 0.45; s.ccr = 0.2; }
    if (fin == 3.0) { s.rough = 0.78; s.cc = 0.0; s.ccr = 0.5; s.metal = 0.0; }
    s.sss = 0.15;
  } else if (D.p0.x == 1.0 && (mid == 0u || mid == 17u) && i.opos.z > 1.0) {
    // eye vs fur decided per pixel from the eye outline, so the painted rim stays crisp on the bevel
    let side = select(-1.0, 1.0, i.opos.x >= 0.0);
    let ed = (length((i.opos.xy - vec2f(side * EYE_X, EYE_Y)) / EYE_R) - 1.0) * min(EYE_R.x, EYE_R.y);
    let mask = cover(ed + 0.01, fw);
    let f0 = MT[0]; let f1 = MT[1]; let e0 = MT[51]; let e1 = MT[52];
    let sf = paint(0u, i.opos, normalize(i.on), fw, 1.0, Surf(f0.rgb, f1.x, f1.y, f1.z, f1.w, f0.a));
    let se = paint(17u, i.opos, normalize(i.on), fw, 1.0, Surf(e0.rgb, e1.x, e1.y, e1.z, e1.w, e0.a));
    s = Surf(mix(sf.albedo, se.albedo, mask), mix(sf.rough, se.rough, mask), mix(sf.metal, se.metal, mask), mix(sf.cc, se.cc, mask), mix(sf.ccr, se.ccr, mask), mix(sf.sss, se.sss, mask));
  } else {
    s = paint(mid, i.opos, normalize(i.on), fw, D.p0.x, s);
  }
  // geometric specular anti-aliasing
  let kAA = min(nvar * 2.0, 0.2);
  let rough = sqrt(clamp(s.rough * s.rough + kAA, 0.0, 1.0));
  let ccr = sqrt(clamp(s.ccr * s.ccr + kAA, 0.0, 1.0));

  let V = normalize(F.cam.xyz - i.wpos);
  let NoV = max(dot(N, V), 1e-3);
  let w = s.sss * 0.55;
  // surfaces turned away from the key are self-shadowed; this also hides depth-map acne past the terminator
  // loaded meshes can be low-poly with smooth normals: test shadows against the facet; the dense sculpt keeps its smooth normal
  let loaded = mid >= 24u;
  let Nsh = select(N, Ng, loaded);
  let sh = shadowAt(i.wpos, Nsh) * select(1.0, smoothstep(-0.1, 0.06, dot(Ng, KEY)), loaded);
  let ao = i.ao;
  var diff = KEYC * 2.5 * wrapL(N, KEY, w) * sh * mix(1.0, ao, 0.35)
    + FILLC * 0.55 * wrapL(N, FILL, w) * ao
    + RIMC * 0.85 * (wrapL(N, RIML, w) + wrapL(N, RIMR, w)) * mix(1.0, ao, 0.5)
    + vec3f(0.7) * wrapL(N, TOP, w) * ao
    + mix(vec3f(0.025), vec3f(0.075), N.y * 0.5 + 0.5) * ao;
  // subsurface glow: light bleeding through thin plastic at the silhouette
  let back = pow(clamp(dot(V, -RIML), 0.0, 1.0), 3.0) + pow(clamp(dot(V, -RIMR), 0.0, 1.0), 3.0) + 0.35 * pow(clamp(dot(V, -KEY), 0.0, 1.0), 2.0);
  let glow = s.sss * s.albedo * (0.25 + s.albedo) * back * pow(1.0 - NoV, 2.0) * 2.2 * ao;

  let R = reflect(-V, N);
  let specOcc = clamp(pow(NoV + ao, exp2(-16.0 * rough - 1.0)) - 1.0 + ao, 0.0, 1.0);
  let env = studio(R, rough);
  let f0 = mix(vec3f(0.04), s.albedo, s.metal);
  let spec = (env.key * mix(0.15, 1.0, sh) + env.rest) * envBRDF(f0, rough, NoV) * specOcc;
  var col = s.albedo * (1.0 - s.metal) * diff + glow + spec;
  // clear coat
  let fc = (0.04 + 0.96 * pow(1.0 - NoV, 5.0)) * s.cc;
  let envc = studio(R, ccr);
  col = col * (1.0 - fc) + (envc.key * mix(0.15, 1.0, sh) + envc.rest) * fc * specOcc;
  return vec4f(compress(col), 1.0);
}
`;
}

// Grass field at dusk: misty sky dome, ground that fades into mist, swaying grass that parts around the base.
function wgslFloor() {
  return WGSL_COMMON + WGSL_FRAME_BINDINGS + /* wgsl */`
const MIST = vec3f(0.115, 0.135, 0.13);
fn vhash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(vhash(i), vhash(i + vec2f(1.0, 0.0)), u.x), mix(vhash(i + vec2f(0.0, 1.0)), vhash(i + vec2f(1.0, 1.0)), u.x), u.y);
}
fn skyCol(d: vec3f) -> vec3f {
  let h = d.y;
  let top = vec3f(0.028, 0.034, 0.045);
  var c = mix(MIST, top, smoothstep(0.02, 0.55, h));
  c = mix(c, MIST * 0.92, smoothstep(0.0, -0.08, h));
  return c;
}
fn fogged(c: vec3f, wp: vec3f) -> vec3f {
  let dist = length(wp - F.cam.xyz);
  return mix(c, MIST, 1.0 - exp(-max(dist - 22.0, 0.0) * 0.022));
}
fn contactOcc(wp: vec3f) -> f32 {
  let c = F.base.xyz; let R = F.base.w; let hgt = F.baseUp.w;
  let dxz = length(wp.xz - c.xz);
  let k = clamp(1.0 - hgt / 7.0, 0.0, 1.0);
  return clamp((1.0 - smoothstep(R * 0.4, R * 1.3 + hgt * 0.8, dxz)) * 0.6 * k * k
       + (1.0 - smoothstep(0.0, 0.35 + hgt, abs(dxz - R * 0.98))) * 0.3 * k * k * k, 0.0, 0.85);
}
@fragment fn fsFloor(i: VO) -> @location(0) vec4f {
  if (D.p0.x > 10.5) { return vec4f(compress(skyCol(normalize(i.wpos - F.cam.xyz))), 1.0); }
  let N = vec3f(0.0, 1.0, 0.0);
  let sh = shadowAt(i.wpos, N);
  let p = i.wpos.xz;
  let n1 = vnoise(p * 0.12); let n2 = vnoise(p * 0.9); let n3 = vnoise(p * 3.1);
  let albedo = mix(vec3f(0.035, 0.05, 0.022), vec3f(0.075, 0.1, 0.045), n1) * (0.75 + 0.35 * n2 + 0.15 * n3);
  var diff = KEYC * 2.2 * max(dot(N, KEY), 0.0) * sh + FILLC * 0.4 * max(dot(N, FILL), 0.0) + vec3f(0.55) * max(dot(N, TOP), 0.0) + vec3f(0.06);
  diff *= 1.0 - contactOcc(i.wpos);
  return vec4f(compress(fogged(albedo * diff, i.wpos)), 1.0);
}

struct GO { @builtin(position) clip: vec4f, @location(0) wpos: vec3f, @location(1) wn: vec3f, @location(2) col: vec3f, @location(3) h: f32 };
@vertex fn vsGrass(v: VI) -> GO {
  var o: GO;
  var p = v.pos;
  let h = v.uv.x; let ph = v.uv.y;
  // part around the acrylic base while it rests on the ground
  let d = length(p.xz - F.base.xz);
  var k = smoothstep(F.base.w * 0.97, F.base.w + 3.2, d);
  k = mix(k, 1.0, smoothstep(0.6, 2.5, F.baseUp.w));
  let away = normalize(p.xz - F.base.xz + vec2f(1e-4, 0.0));
  p.y *= mix(0.1, 1.0, k * k);
  p.x += away.x * (1.0 - k) * h * 0.9; p.z += away.y * (1.0 - k) * h * 0.9;
  // wind
  let t = F.cam.w;
  let sway = sin(t * 1.4 + ph * 6.283 + p.x * 0.12) * 0.32 + sin(t * 2.6 + ph * 11.0 + p.z * 0.2) * 0.1;
  p.x += sway * h * h; p.z += sway * 0.45 * h * h;
  o.clip = F.vp * vec4f(p, 1.0);
  o.wpos = p; o.wn = v.nrm; o.col = pow(v.col.rgb, vec3f(2.2)); o.h = h;
  return o;
}
@fragment fn fsGrass(i: GO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  var N = normalize(i.wn);
  if (!ff) { N = vec3f(-N.x, N.y, -N.z); }
  let sh = shadowAt(i.wpos, vec3f(0.0, 1.0, 0.0));
  let ao = mix(0.35, 1.0, i.h);
  let trans = max(dot(-N, KEY), 0.0) * 0.6;
  let diff = KEYC * 2.0 * (max(dot(N, KEY), 0.0) + trans) * sh + FILLC * 0.45 * max(dot(N, FILL), 0.0) * ao + vec3f(0.5) * max(dot(N, TOP), 0.0) * ao + vec3f(0.05) * ao;
  var c = i.col * diff * (1.0 - contactOcc(i.wpos) * 0.6);
  let V = normalize(F.cam.xyz - i.wpos);
  c += RIMC * 0.35 * pow(1.0 - abs(dot(N, V)), 3.0) * i.h * sh;
  return vec4f(compress(fogged(c, i.wpos)), 1.0);
}
`;
}

// Clear acrylic base: Fresnel reflections, refraction-like see-through highlights, etched rings.
function wgslBase() {
  return WGSL_COMMON + WGSL_FRAME_BINDINGS + /* wgsl */`
@fragment fn fsBase(i: VO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let fw = max(length(dpdx(i.opos)), length(dpdy(i.opos))) * 1.2;
  var N = normalize(i.wn);
  if (!ff) { N = -N; }
  let V = normalize(F.cam.xyz - i.wpos);
  let NoV = abs(dot(N, V));
  let fr = 0.04 + 0.96 * pow(1.0 - NoV, 5.0);
  let sh = shadowAt(i.wpos, N);
  let er = studio(reflect(-V, N), 0.03);
  var T = refract(-V, N, 1.0 / 1.49);
  if (dot(T, T) < 0.5) { T = reflect(-V, N); }
  let et = studio(T, 0.1);
  let R = D.p1.y;
  let on = normalize(i.on);
  var etch = 0.0;
  if (on.y > 0.9) {
    let r = length(i.opos.xz);
    etch = max(cover(abs(r - R * 0.9) - 0.012, fw), cover(abs(r - R * 0.86) - 0.005, fw));
    etch = max(etch, cover(abs(r - R * 0.94) - 0.004, fw));
  }
  let edge = 1.0 - abs(on.y);
  var col = (er.key * sh + er.rest) * fr + (et.key * sh + et.rest) * 0.22 * (1.0 - fr) * vec3f(0.9, 0.95, 1.0);
  col += vec3f(0.45, 0.47, 0.5) * etch * (0.4 + 0.6 * sh);
  col += (et.key + et.rest) * edge * 0.18;
  let a = clamp(fr * 1.1 + 0.06 + etch * 0.55 + edge * 0.12, 0.0, 1.0);
  return vec4f(compress(col), a);
}
`;
}

// Clear PVC (steam piece, breath puff): mostly Fresnel, a faint milky core.
function wgslClear() {
  return WGSL_COMMON + WGSL_FRAME_BINDINGS + /* wgsl */`
@fragment fn fsClear(i: VO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  var N = normalize(i.wn);
  if (!ff) { N = -N; }
  let V = normalize(F.cam.xyz - i.wpos);
  let NoV = abs(dot(N, V));
  let fr = 0.04 + 0.96 * pow(1.0 - NoV, 5.0);
  let e = studio(reflect(-V, N), 0.06);
  let rim = pow(1.0 - NoV, 2.2);
  let milky = vec3f(0.92, 0.95, 1.0) * (0.1 + 0.16 * max(dot(N, KEY), 0.0) + 0.1 * max(dot(N, TOP), 0.0));
  let fade = D.p1.x;
  let col = ((e.key + e.rest) * (fr * 1.4 + 0.02) + milky + vec3f(0.6, 0.65, 0.7) * rim * 0.12) * fade;
  let a = clamp(0.1 + rim * 0.6 + fr * 0.3, 0.0, 1.0) * fade;
  return vec4f(compress(col), a);
}
`;
}

function wgslShadow() {
  return WGSL_COMMON + /* wgsl */`
@group(0) @binding(0) var<uniform> F: Frame;
@group(1) @binding(0) var<uniform> D: Draw;
@vertex fn vsShadow(@location(0) pos: vec3f) -> @builtin(position) vec4f { return F.lvp * D.model * vec4f(pos, 1.0); }
`;
}

function wgslPick() {
  return WGSL_COMMON + /* wgsl */`
@group(0) @binding(0) var<uniform> F: Frame;
@group(1) @binding(0) var<uniform> D: Draw;
struct PO { @builtin(position) clip: vec4f, @location(0) wpos: vec3f };
@vertex fn vsPick(@location(0) pos: vec3f) -> PO {
  var o: PO; let w = D.model * vec4f(pos, 1.0); o.clip = F.vp * w; o.wpos = w.xyz; return o;
}
@fragment fn fsPick(i: PO) -> @location(0) vec4f { return vec4f(i.wpos, D.p0.y); }
`;
}

const WGSL_TONEMAP = /* wgsl */`
@group(0) @binding(0) var hdr: texture_2d<f32>;
@group(0) @binding(1) var<uniform> P: vec4f;
@vertex fn vsFull(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
fn toSRGB(c: vec3f) -> vec3f {
  return select(1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055, c * 12.92, c <= vec3f(0.0031308));
}
@fragment fn fsTone(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let cc = textureLoad(hdr, vec2i(pos.xy), 0).rgb;
  let c = cc / max(1.0 - max(cc.r, max(cc.g, cc.b)), 1e-3) * P.x;
  let q = pos.xy / P.yz - 0.5;
  let vig = 1.0 - dot(q, q) * 0.35;
  var o = toSRGB(acesFit(c * vig));
  let n = fract(sin(dot(pos.xy, vec2f(12.9898, 78.233))) * 43758.5453) - 0.5;
  o += n / 255.0;
  return vec4f(o, 1.0);
}
`;

const WGSL_MIP = /* wgsl */`
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var smp: sampler;
struct MO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vsMip(@builtin(vertex_index) i: u32) -> MO {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: MO; o.p = vec4f(p * 2.0 - 1.0, 0.0, 1.0); o.uv = vec2f(p.x, 1.0 - p.y); return o;
}
@fragment fn fsMip(i: MO) -> @location(0) vec4f { return textureSample(src, smp, i.uv); }
`;

const WGSL_AO = /* wgsl */`
struct BakeU { m: mat4x4f, dir: vec4f, params: vec4f };
@group(0) @binding(0) var<storage, read> verts: array<f32>;
@group(0) @binding(1) var<storage, read_write> acc: array<vec2f>;
@group(0) @binding(2) var depthTex: texture_depth_2d;
@group(0) @binding(3) var<uniform> U: BakeU;
@compute @workgroup_size(64) fn accum(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x + id.y * 4194240u;
  if (i >= u32(U.params.x)) { return; }
  let b = i * 10u;
  let p = vec3f(verts[b], verts[b + 1u], verts[b + 2u]);
  let n = normalize(vec3f(verts[b + 3u], verts[b + 4u], verts[b + 5u]) + vec3f(1e-6));
  let w = max(dot(n, U.dir.xyz), 0.0);
  if (w <= 0.0) { return; }
  // normal offset plus slope-scaled depth bias (dir.w = one texel in depth units)
  let c = U.m * vec4f(p + n * U.params.z, 1.0);
  let bias = U.params.w + U.dir.w * 1.6 * min(sqrt(max(1.0 - w * w, 0.0)) / max(w, 1e-3), 6.0);
  let uv = c.xy * vec2f(0.5, -0.5) + 0.5;
  let dim = vec2f(textureDimensions(depthTex));
  let px = vec2i(clamp(uv * dim, vec2f(0.0), dim - 1.0));
  var vis = 0.0;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let q = clamp(px + vec2i(dx, dy), vec2i(0), vec2i(dim) - 1);
      vis += select(0.0, 1.0, c.z <= textureLoad(depthTex, q, 0) + bias);
    }
  }
  acc[i] += vec2f(vis / 9.0 * w, w);
}
@group(0) @binding(4) var<storage, read_write> aoOut: array<f32>;
@compute @workgroup_size(64) fn finish(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x + id.y * 4194240u;
  if (i >= u32(U.params.x)) { return; }
  let a = acc[i];
  let v = select(1.0, a.x / a.y, a.y > 1e-4);
  aoOut[i] = clamp(0.2 + 0.8 * pow(v, 0.85), 0.0, 1.0);
}
`;
