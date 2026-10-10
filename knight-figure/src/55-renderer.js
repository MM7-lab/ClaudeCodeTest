/* ============================================================================
   WebGPU renderer: shadow map → 4× MSAA HDR scene (opaque, then premultiplied
   transparent) → ACES tone map to the canvas. Also picking and GPU AO baking.
   ========================================================================== */
const srgbToLin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexLin = hex => { const n = parseInt(hex.slice(1), 16); return [srgbToLin(((n >> 16) & 255) / 255), srgbToLin(((n >> 8) & 255) / 255), srgbToLin((n & 255) / 255)]; };

// Sculpt materials: paint colour, subsurface, roughness, metalness, clear coat, clear-coat roughness.
const MATERIAL_DEFS = {
  [MAT.FUR]:        { c: '#b6a48d', sss: 0.38, r: 0.42, m: 0, cc: 0.22, ccr: 0.3 },
  [MAT.FUR_LIGHT]:  { c: '#efe5d6', sss: 0.4, r: 0.45, m: 0, cc: 0.2, ccr: 0.3 },
  [MAT.LID]:        { c: '#b6a48d', sss: 0.3, r: 0.4, m: 0, cc: 0.25, ccr: 0.3 },
  [MAT.NOSE]:       { c: '#e88f9c', sss: 0.3, r: 0.28, m: 0, cc: 0.7, ccr: 0.1 },
  [MAT.EAR_IN]:     { c: '#f2b3bb', sss: 0.45, r: 0.42, m: 0, cc: 0.2, ccr: 0.3 },
  [MAT.BOW]:        { c: '#f39bb6', sss: 0.25, r: 0.22, m: 0, cc: 1.0, ccr: 0.07 },
  [MAT.ARMOR]:      { c: '#c3c8d0', sss: 0, r: 0.34, m: 0.5, cc: 0.6, ccr: 0.12 },
  [MAT.ARMOR_DARK]: { c: '#80868f', sss: 0, r: 0.45, m: 0.45, cc: 0.3, ccr: 0.2 },
  [MAT.GOLD]:       { c: '#e3b259', sss: 0, r: 0.3, m: 0.6, cc: 0.55, ccr: 0.12 },
  [MAT.LEATHER]:    { c: '#6a432a', sss: 0.05, r: 0.55, m: 0, cc: 0.15, ccr: 0.35 },
  [MAT.CAPE]:       { c: '#f2efe8', sss: 0.15, r: 0.82, m: 0, cc: 0.0, ccr: 0.5 },
  [MAT.CAPE_IN]:    { c: '#e3dccf', sss: 0.12, r: 0.86, m: 0, cc: 0.0, ccr: 0.5 },
  [MAT.BLADE]:      { c: '#d8dde4', sss: 0, r: 0.24, m: 0.55, cc: 0.7, ccr: 0.05 },
  [MAT.GRIP]:       { c: '#4a2f1e', sss: 0.05, r: 0.6, m: 0, cc: 0.1, ccr: 0.4 },
  [MAT.CUP]:        { c: '#f6f5f1', sss: 0.25, r: 0.18, m: 0, cc: 1.0, ccr: 0.05 },
  [MAT.TEA]:        { c: '#9a6a43', sss: 0.2, r: 0.1, m: 0, cc: 1.0, ccr: 0.03 },
  [MAT.CLEAR]:      { c: '#ffffff', sss: 0, r: 0.08, m: 0, cc: 1.0, ccr: 0.05 },
  [MAT.EYE]:        { c: '#f4efe6', sss: 0, r: 0.08, m: 0, cc: 1.0, ccr: 0.02 },
};
const MAX_MATS = 40;

// Open grass field: a flat ground disc (fades into mist) and a sky dome.
function groundGeometry() {
  const pos = [], nrm = [], idx = [], rings = [0, 6, 12, 20, 30, 45, 65, 90, 130, 180], seg = 64;
  for (const r of rings) for (let j = 0; j <= seg; j++) { const a = (j / seg) * Math.PI * 2; pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); nrm.push(0, 1, 0); }
  const W = seg + 1;
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++) { const a = i * W + j, b = a + 1, c = a + W + 1, d = a + W; idx.push(a, c, b, a, d, c); }
  return { positions: new Float32Array(pos), normals: new Float32Array(nrm), indices: new Uint32Array(idx) };
}
function skyGeometry() {
  const g = icosphere(3);
  for (let i = 0; i < g.positions.length; i++) g.positions[i] *= 260;
  for (let i = 0; i < g.normals.length; i++) g.normals[i] = -g.normals[i];
  for (let i = 0; i < g.indices.length; i += 3) { const t = g.indices[i + 1]; g.indices[i + 1] = g.indices[i + 2]; g.indices[i + 2] = t; }
  return g;
}
// Grass blades: three tapered segments each. uv = (height fraction, sway phase); colour = sRGB green.
function grassGeometry(count = 9000, seed = 7) {
  let st = seed;
  const rnd = () => (st = (st * 16807) % 2147483647) / 2147483647;
  const pos = [], nrm = [], uv = [], col = [], idx = [];
  for (let i = 0; i < count; i++) {
    const r = 1.0 + 44 * Math.pow(rnd(), 1.7), a = rnd() * Math.PI * 2;
    const rx = Math.cos(a) * r, rz = Math.sin(a) * r;
    const h = (0.8 + rnd() * 1.5) * (1 - 0.2 * r / 45), w = 0.06 + rnd() * 0.06;
    const face = rnd() * Math.PI * 2, fx = Math.cos(face), fz = Math.sin(face);
    const lean = (rnd() - 0.3) * 0.9, lx = -fz * 0 + fx * lean, lz = fz * lean;
    const ph = rnd();
    const hue = 0.21 + rnd() * 0.08, sat = 0.32 + rnd() * 0.22, lit = 0.2 + rnd() * 0.14;
    const c = hslToRgb(hue, sat, lit);
    const base = pos.length / 3;
    for (let k = 0; k <= 3; k++) {
      const s = k / 3, ww = k === 3 ? 0 : w * (1 - s * 0.82);
      const cx = rx + lx * s * s * h * 0.45, cy = s * h, cz = rz + lz * s * s * h * 0.45;
      const px = -fz, pz = fx;   // across the blade
      const nx = fx * 0.9, ny = 0.42, nz = fz * 0.9;
      if (k < 3) { pos.push(cx - px * ww, cy, cz - pz * ww, cx + px * ww, cy, cz + pz * ww); nrm.push(nx, ny, nz, nx, ny, nz); uv.push(s, ph, s, ph); col.push(...c, 1, ...c, 1); }
      else { pos.push(cx, cy, cz); nrm.push(nx, ny, nz); uv.push(1, ph); col.push(...c, 1); }
    }
    for (let k = 0; k < 2; k++) { const l = base + k * 2; idx.push(l, l + 1, l + 3, l, l + 3, l + 2); }
    idx.push(base + 4, base + 5, base + 6);
  }
  return { positions: new Float32Array(pos), normals: new Float32Array(nrm), uvs: new Float32Array(uv), colors: new Float32Array(col), indices: new Uint32Array(idx) };
}
function hslToRgb(h, s, l) {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

// Bevelled acrylic disc, lathe-generated with smooth normals. Top face at y = 0.
function baseGeometry(R, H = 0.6, b = 0.11, seg = 160) {
  const prof = [[0, 0, 0, 1], [R - b, 0, 0, 1]];
  for (let i = 1; i <= 8; i++) { const t = (i / 8) * Math.PI / 2; prof.push([R - b + b * Math.sin(t), -b + b * Math.cos(t), Math.sin(t), Math.cos(t)]); }
  prof.push([R, -H + b, 1, 0]);
  for (let i = 1; i <= 8; i++) { const t = (i / 8) * Math.PI / 2; prof.push([R - b + b * Math.cos(t), -H + b - b * Math.sin(t), Math.cos(t), -Math.sin(t)]); }
  prof.push([0, -H, 0, -1]);
  const pos = [], nrm = [], idx = [];
  for (const [r, y, nr, ny] of prof) for (let j = 0; j <= seg; j++) {
    const f = (j / seg) * Math.PI * 2, c = Math.cos(f), s = Math.sin(f);
    pos.push(r * c, y, r * s); nrm.push(nr * c, ny, nr * s);
  }
  const W = seg + 1;
  for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * W + j, d = a + 1, c = a + W, bb = a + W + 1;
    idx.push(a, d, bb, a, bb, c);
  }
  return { positions: new Float32Array(pos), normals: new Float32Array(nrm), indices: new Uint32Array(idx) };
}

function icosphere(sub = 2) {
  const t = (1 + Math.sqrt(5)) / 2;
  let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v3.norm);
  let Fc = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < sub; s++) {
    const cache = new Map(), nf = [];
    const midp = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (!cache.has(k)) { cache.set(k, V.length); V.push(v3.norm(v3.lerp(V[a], V[b], 0.5))); } return cache.get(k); };
    for (const [a, b, c] of Fc) { const ab = midp(a, b), bc = midp(b, c), ca = midp(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    Fc = nf;
  }
  const p = new Float32Array(V.flat());
  return { positions: p, normals: p.slice(), indices: new Uint32Array(Fc.flat()) };
}

class Renderer {
  // offscreen: render into a texture instead of the canvas (used by automated checks in headless browsers).
  async init(canvas, offscreen = false) {
    this.offscreen = offscreen;
    if (!navigator.gpu) throw new Error('no-webgpu');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('no-adapter');
    this.adapter = adapter;   // keep the adapter (and its instance) alive for the device's lifetime
    this.gpu = navigator.gpu;
    const d = this.device = await adapter.requestDevice();
    this.errors = [];
    d.addEventListener('uncapturederror', e => { this.errors.push(e.error.message); console.error('WebGPU:', e.error.message); });
    d.lost.then(info => { if (this.onLost) this.onLost(info); });
    this.canvas = canvas;
    if (offscreen) this.format = 'rgba8unorm';
    else {
      this.ctx = canvas.getContext('webgpu');
      this.format = navigator.gpu.getPreferredCanvasFormat();
      this.ctx.configure({ device: d, format: this.format, alphaMode: 'opaque' });
    }
    const GS = GPUShaderStage;

    this.frameLayout = d.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GS.VERTEX | GS.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GS.FRAGMENT, texture: { sampleType: 'depth' } },
      { binding: 2, visibility: GS.FRAGMENT, sampler: { type: 'comparison' } },
      { binding: 3, visibility: GS.FRAGMENT, buffer: { type: 'uniform' } },
    ] });
    this.frameOnlyLayout = d.createBindGroupLayout({ entries: [{ binding: 0, visibility: GS.VERTEX | GS.FRAGMENT, buffer: { type: 'uniform' } }] });
    this.drawLayout = d.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GS.VERTEX | GS.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GS.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 2, visibility: GS.FRAGMENT, sampler: { type: 'filtering' } },
    ] });
    this.toneLayout = d.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GS.FRAGMENT, texture: { sampleType: 'unfilterable-float' } },
      { binding: 1, visibility: GS.FRAGMENT, buffer: { type: 'uniform' } },
    ] });

    this.linearSampler = d.createSampler({ addressModeU: 'repeat', addressModeV: 'repeat', magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', maxAnisotropy: 8 });
    this.clampSampler = d.createSampler({ magFilter: 'linear', minFilter: 'linear' });
    this.cmpSampler = d.createSampler({ compare: 'less', magFilter: 'linear', minFilter: 'linear' });
    const white = d.createTexture({ size: [1, 1], format: 'rgba8unorm-srgb', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    d.queue.writeTexture({ texture: white }, new Uint8Array([255, 255, 255, 255]), { bytesPerRow: 4 }, [1, 1]);
    this.whiteView = white.createView();

    this.SHADOW = 2048;
    this.shadowTex = d.createTexture({ size: [this.SHADOW, this.SHADOW], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    this.shadowView = this.shadowTex.createView();
    this.frameBuf = d.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.pickFrameBuf = d.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.matBuf = d.createBuffer({ size: MAX_MATS * 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.matData = new Float32Array(MAX_MATS * 12);
    for (const [id, m] of Object.entries(MATERIAL_DEFS)) this.setMaterial(+id, hexLin(m.c), m);
    this.frameBG = d.createBindGroup({ layout: this.frameLayout, entries: [
      { binding: 0, resource: { buffer: this.frameBuf } }, { binding: 1, resource: this.shadowView },
      { binding: 2, resource: this.cmpSampler }, { binding: 3, resource: { buffer: this.matBuf } },
    ] });
    this.shadowFrameBG = d.createBindGroup({ layout: this.frameOnlyLayout, entries: [{ binding: 0, resource: { buffer: this.frameBuf } }] });
    this.pickFrameBG = d.createBindGroup({ layout: this.frameOnlyLayout, entries: [{ binding: 0, resource: { buffer: this.pickFrameBuf } }] });
    this.toneBuf = d.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    // pick target
    this.pickTex = d.createTexture({ size: [1, 1], format: 'rgba32float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    this.pickDepth = d.createTexture({ size: [1, 1], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT });
    this.pickRead = d.createBuffer({ size: 256, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    this.pickBusy = false;

    await this.buildPipelines();
    const gg = groundGeometry(), sk = skyGeometry(), gr = grassGeometry();
    this.ground = this.makeMesh(packVertices(gg.positions, gg.normals), gg.indices, null);
    this.sky = this.makeMesh(packVertices(sk.positions, sk.normals), sk.indices, null);
    this.grass = this.makeMesh(packVertices(gr.positions, gr.normals, { uvs: gr.uvs, colors: gr.colors }), gr.indices, null);
    this.groundDraw = this.makeDraw(); this.writeDraw(this.groundDraw, m4.ident(), [10, 0, 0, 0]);
    this.skyDraw = this.makeDraw(); this.writeDraw(this.skyDraw, m4.ident(), [11, 0, 0, 0]);
    this.grassDraw = this.makeDraw();
    this.sphere = (() => { const g = icosphere(2); return this.makeMesh(packVertices(g.positions, g.normals, { mat: MAT.CLEAR }), g.indices, null); })();
  }

  setMaterial(id, lin, m, hasTex = 0) {
    const o = id * 12, D = this.matData;
    D[o] = lin[0]; D[o + 1] = lin[1]; D[o + 2] = lin[2]; D[o + 3] = m.sss ?? 0;
    D[o + 4] = m.r; D[o + 5] = m.m ?? 0; D[o + 6] = m.cc ?? 0; D[o + 7] = m.ccr ?? 0.2;
    D[o + 8] = 0; D[o + 9] = hasTex; D[o + 10] = 0; D[o + 11] = 0;
    this.matDirty = true;
  }

  async buildPipelines() {
    const d = this.device;
    const VB_FULL = [
      { arrayStride: 40, attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' },
        { shaderLocation: 2, offset: 24, format: 'float32x2' }, { shaderLocation: 3, offset: 32, format: 'unorm8x4' },
        { shaderLocation: 4, offset: 36, format: 'float32' } ] },
      { arrayStride: 4, attributes: [{ shaderLocation: 5, offset: 0, format: 'float32' }] },
    ];
    const VB_POS = [{ arrayStride: 40, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }];
    const mod = code => d.createShaderModule({ code });
    const check = async (m, name) => {
      const info = await m.getCompilationInfo();
      for (const msg of info.messages) if (msg.type === 'error') { const e = `${name}:${msg.lineNum}:${msg.linePos} ${msg.message}`; this.errors.push(e); console.error(e); }
    };
    const mMain = mod(wgslMain()), mFloor = mod(wgslFloor()), mBase = mod(wgslBase()), mClear = mod(wgslClear());
    const mShadow = mod(wgslShadow()), mPick = mod(wgslPick()), mTone = mod(WGSL_COMMON + WGSL_TONEMAP), mMip = mod(WGSL_MIP), mAO = mod(WGSL_AO);
    await Promise.all([[mMain, 'main'], [mFloor, 'floor'], [mBase, 'base'], [mClear, 'clear'], [mShadow, 'shadow'], [mPick, 'pick'], [mTone, 'tone'], [mMip, 'mip'], [mAO, 'ao']].map(([m, n]) => check(m, n)));

    const sceneLayout = d.createPipelineLayout({ bindGroupLayouts: [this.frameLayout, this.drawLayout] });
    const onlyLayout = d.createPipelineLayout({ bindGroupLayouts: [this.frameOnlyLayout, this.drawLayout] });
    const PREMUL = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } };
    const scene = (module, fs, cull, transparent) => d.createRenderPipelineAsync({
      layout: sceneLayout,
      vertex: { module, entryPoint: 'vsMain', buffers: VB_FULL },
      fragment: { module, entryPoint: fs, targets: [transparent ? { format: 'rgba16float', blend: PREMUL } : { format: 'rgba16float' }] },
      primitive: { topology: 'triangle-list', cullMode: cull, frontFace: 'ccw' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: !transparent, depthCompare: 'less' },
      multisample: { count: 4 },
    });
    const grassPipe = d.createRenderPipelineAsync({
      layout: sceneLayout,
      vertex: { module: mFloor, entryPoint: 'vsGrass', buffers: VB_FULL },
      fragment: { module: mFloor, entryPoint: 'fsGrass', targets: [{ format: 'rgba16float' }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
      multisample: { count: 4, alphaToCoverageEnabled: false },
    });
    [this.pPbr, this.pPbr2, this.pFloor, this.pBaseBack, this.pBaseFront, this.pClearBack, this.pClearFront, this.pGrass] = await Promise.all([
      scene(mMain, 'fsMain', 'back', false), scene(mMain, 'fsMain', 'none', false), scene(mFloor, 'fsFloor', 'none', false),
      scene(mBase, 'fsBase', 'front', true), scene(mBase, 'fsBase', 'back', true),
      scene(mClear, 'fsClear', 'front', true), scene(mClear, 'fsClear', 'back', true), grassPipe,
    ]);
    this.pShadow = await d.createRenderPipelineAsync({
      layout: onlyLayout, vertex: { module: mShadow, entryPoint: 'vsShadow', buffers: VB_POS },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less', depthBias: 2, depthBiasSlopeScale: 2.0 },
    });
    this.pPick = await d.createRenderPipelineAsync({
      layout: onlyLayout, vertex: { module: mPick, entryPoint: 'vsPick', buffers: VB_POS },
      fragment: { module: mPick, entryPoint: 'fsPick', targets: [{ format: 'rgba32float' }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' },
    });
    this.pTone = await d.createRenderPipelineAsync({
      layout: d.createPipelineLayout({ bindGroupLayouts: [this.toneLayout] }),
      vertex: { module: mTone, entryPoint: 'vsFull' }, fragment: { module: mTone, entryPoint: 'fsTone', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' },
    });
    this.pMip = await d.createRenderPipelineAsync({
      layout: 'auto', vertex: { module: mMip, entryPoint: 'vsMip' },
      fragment: { module: mMip, entryPoint: 'fsMip', targets: [{ format: 'rgba8unorm-srgb' }] }, primitive: { topology: 'triangle-list' },
    });
    this.pAoAccum = await d.createComputePipelineAsync({ layout: 'auto', compute: { module: mAO, entryPoint: 'accum' } });
    this.pAoFinish = await d.createComputePipelineAsync({ layout: 'auto', compute: { module: mAO, entryPoint: 'finish' } });
  }

  resize(w, h) {
    if (this.w === w && this.h === h) return;
    this.w = w; this.h = h;
    const d = this.device;
    for (const t of [this.msaaTex, this.msaaDepth, this.resolveTex]) if (t) t.destroy();
    this.msaaTex = d.createTexture({ size: [w, h], format: 'rgba16float', sampleCount: 4, usage: GPUTextureUsage.RENDER_ATTACHMENT });
    this.msaaDepth = d.createTexture({ size: [w, h], format: 'depth24plus', sampleCount: 4, usage: GPUTextureUsage.RENDER_ATTACHMENT });
    this.resolveTex = d.createTexture({ size: [w, h], format: 'rgba16float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    if (this.offscreen) {
      if (this.offTex) this.offTex.destroy();
      this.offTex = d.createTexture({ size: [w, h], format: 'rgba8unorm', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    }
    this.toneBG = d.createBindGroup({ layout: this.toneLayout, entries: [{ binding: 0, resource: this.resolveTex.createView() }, { binding: 1, resource: { buffer: this.toneBuf } }] });
  }

  makeMesh(vb, indices, ao) {
    const d = this.device, vcount = vb.byteLength / 40;
    const vbuf = d.createBuffer({ size: Math.max(64, vb.byteLength), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    d.queue.writeBuffer(vbuf, 0, vb);
    const ibuf = d.createBuffer({ size: Math.max(16, indices.byteLength), usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    d.queue.writeBuffer(ibuf, 0, indices);
    const aobuf = d.createBuffer({ size: Math.max(16, vcount * 4), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    d.queue.writeBuffer(aobuf, 0, ao || new Float32Array(vcount).fill(1));
    return { vbuf, ibuf, aobuf, count: indices.length, vcount };
  }
  destroyMesh(m) { if (!m) return; m.vbuf.destroy(); m.ibuf.destroy(); m.aobuf.destroy(); }

  makeDraw(texView) {
    const ubuf = this.device.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const dr = { ubuf, data: new Float32Array(44), tex: texView || this.whiteView };
    dr.bg = this.device.createBindGroup({ layout: this.drawLayout, entries: [
      { binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: dr.tex }, { binding: 2, resource: this.linearSampler } ] });
    this.writeDraw(dr, m4.ident());
    return dr;
  }
  writeDraw(dr, model, p0 = [0, 0, 0, 0], tint = [1, 1, 1, 1], p1 = [1, 0, 0, 0]) {
    const D = dr.data;
    D.set(model, 0); D.set(m4.normalMat(model), 16); D.set(p0, 32); D.set(tint, 36); D.set(p1, 40);
    this.device.queue.writeBuffer(dr.ubuf, 0, D);
  }

  async makeTexture(bitmap) {
    const d = this.device, w = bitmap.width, h = bitmap.height;
    const levels = Math.floor(Math.log2(Math.max(w, h))) + 1;
    const tex = d.createTexture({ size: [w, h], format: 'rgba8unorm-srgb', mipLevelCount: levels,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
    d.queue.copyExternalImageToTexture({ source: bitmap }, { texture: tex }, [w, h]);
    const enc = d.createCommandEncoder();
    for (let l = 1; l < levels; l++) {
      const bg = d.createBindGroup({ layout: this.pMip.getBindGroupLayout(0), entries: [
        { binding: 0, resource: tex.createView({ baseMipLevel: l - 1, mipLevelCount: 1 }) }, { binding: 1, resource: this.clampSampler } ] });
      const pass = enc.beginRenderPass({ colorAttachments: [{ view: tex.createView({ baseMipLevel: l, mipLevelCount: 1 }), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }] });
      pass.setPipeline(this.pMip); pass.setBindGroup(0, bg); pass.draw(3); pass.end();
    }
    d.queue.submit([enc.finish()]);
    return { tex, view: tex.createView() };
  }

  writeFrame(buf, f) {
    const a = new Float32Array(64);
    a.set(f.vp, 0); a.set(f.lvp || m4.ident(), 16);
    a.set([...f.camPos, f.time || 0], 32);
    a.set([this.w, this.h, 1 / this.w, 1 / this.h], 36);
    a.set([...(f.baseC || [0, 0, 0]), f.baseR || 4], 40);
    a.set([...(f.baseUp || [0, 1, 0]), f.baseH || 0], 44);
    a.set([f.exposure || 1, 1 / this.SHADOW, f.shadowSoft || 6, 0], 48);
    this.device.queue.writeBuffer(buf, 0, a);
  }

  drawList(pass, list) {
    for (const it of list) {
      if (!it.mesh || !it.mesh.count) continue;
      pass.setBindGroup(1, it.draw.bg);
      pass.setVertexBuffer(0, it.mesh.vbuf);
      pass.setVertexBuffer(1, it.mesh.aobuf);
      pass.setIndexBuffer(it.mesh.ibuf, 'uint32');
      pass.drawIndexed(it.mesh.count);
    }
  }

  render(f) {
    const d = this.device;
    if (this.matDirty) { d.queue.writeBuffer(this.matBuf, 0, this.matData); this.matDirty = false; }
    this.writeFrame(this.frameBuf, f);
    d.queue.writeBuffer(this.toneBuf, 0, new Float32Array([f.exposure || 1, this.w, this.h, 0]));
    const enc = d.createCommandEncoder();
    // shadow map
    let pass = enc.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: this.shadowView, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
    pass.setPipeline(this.pShadow); pass.setBindGroup(0, this.shadowFrameBG);
    for (const it of f.casters) { pass.setBindGroup(1, it.draw.bg); pass.setVertexBuffer(0, it.mesh.vbuf); pass.setIndexBuffer(it.mesh.ibuf, 'uint32'); pass.drawIndexed(it.mesh.count); }
    pass.end();
    // scene
    pass = enc.beginRenderPass({
      colorAttachments: [{ view: this.msaaTex.createView(), resolveTarget: this.resolveTex.createView(), clearValue: { r: 0.004, g: 0.004, b: 0.005, a: 1 }, loadOp: 'clear', storeOp: 'discard' }],
      depthStencilAttachment: { view: this.msaaDepth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' },
    });
    pass.setBindGroup(0, this.frameBG);
    pass.setPipeline(this.pFloor); this.drawList(pass, [{ mesh: this.sky, draw: this.skyDraw }, { mesh: this.ground, draw: this.groundDraw }]);
    pass.setPipeline(this.pGrass); this.drawList(pass, [{ mesh: this.grass, draw: this.grassDraw }]);
    pass.setPipeline(this.pPbr); this.drawList(pass, f.opaque.filter(o => !o.twoSided));
    pass.setPipeline(this.pPbr2); this.drawList(pass, f.opaque.filter(o => o.twoSided));
    for (const t of f.transparent) {
      const [back, front] = t.kind === 'base' ? [this.pBaseBack, this.pBaseFront] : [this.pClearBack, this.pClearFront];
      pass.setPipeline(back); this.drawList(pass, [t]);
      pass.setPipeline(front); this.drawList(pass, [t]);
    }
    pass.end();
    // tone map
    const outView = this.offscreen ? this.offTex.createView() : this.ctx.getCurrentTexture().createView();
    pass = enc.beginRenderPass({ colorAttachments: [{ view: outView, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }] });
    pass.setPipeline(this.pTone); pass.setBindGroup(0, this.toneBG); pass.draw(3); pass.end();
    d.queue.submit([enc.finish()]);
  }

  // Lightweight pick: render the pickable parts into a 1×1 target at the cursor and read back
  // the world position and part id there. Resolves to null when nothing is hit.
  pick(f, px, py) {
    if (this.pickBusy) return Promise.resolve(null);
    this.pickBusy = true;
    const d = this.device, W = this.w, H = this.h;
    const cx = ((px + 0.5) / W) * 2 - 1, cy = 1 - ((py + 0.5) / H) * 2;
    const T = m4.ident(); T[0] = W; T[5] = H; T[12] = -W * cx; T[13] = -H * cy;
    this.writeFrame(this.pickFrameBuf, { ...f, vp: m4.mul(T, f.vp) });
    const enc = d.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: this.pickTex.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, -1] }],
      depthStencilAttachment: { view: this.pickDepth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' },
    });
    pass.setPipeline(this.pPick); pass.setBindGroup(0, this.pickFrameBG);
    for (const it of f.pickables) { pass.setBindGroup(1, it.draw.bg); pass.setVertexBuffer(0, it.mesh.vbuf); pass.setIndexBuffer(it.mesh.ibuf, 'uint32'); pass.drawIndexed(it.mesh.count); }
    pass.end();
    enc.copyTextureToBuffer({ texture: this.pickTex }, { buffer: this.pickRead, bytesPerRow: 256 }, [1, 1]);
    d.queue.submit([enc.finish()]);
    return this.pickRead.mapAsync(GPUMapMode.READ).then(() => {
      const r = new Float32Array(this.pickRead.getMappedRange().slice(0, 16));
      this.pickRead.unmap();
      this.pickBusy = false;
      return r[3] < 0 ? null : { point: [r[0], r[1], r[2]], part: Math.round(r[3]) };
    }).catch(() => { this.pickBusy = false; return null; });
  }

  async readPixels() {
    const d = this.device, w = this.w, h = this.h, bpr = Math.ceil(w * 4 / 256) * 256;
    const buf = d.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const enc = d.createCommandEncoder();
    enc.copyTextureToBuffer({ texture: this.offTex }, { buffer: buf, bytesPerRow: bpr }, [w, h]);
    d.queue.submit([enc.finish()]);
    await buf.mapAsync(GPUMapMode.READ);
    const src = new Uint8Array(buf.getMappedRange()), out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) out.set(src.subarray(y * bpr, y * bpr + w * 4), y * w * 4);
    buf.unmap(); buf.destroy();
    return { w, h, data: out };
  }

  // Bake per-vertex ambient occlusion: depth maps from ~40 directions, visibility accumulated in a compute shader.
  async bakeAO(meshes, center, radius, dirs = 40) {
    const d = this.device, SIZE = 512;
    const depth = d.createTexture({ size: [SIZE, SIZE], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    const depthView = depth.createView();
    const accs = meshes.map(m => d.createBuffer({ size: Math.max(16, m.vcount * 8), usage: GPUBufferUsage.STORAGE }));
    const identDraw = this.makeDraw();
    const enc = d.createCommandEncoder();
    const temp = [depth, identDraw.ubuf, ...accs];
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let k = 0; k < dirs; k++) {
      // Fibonacci directions, biased away from straight below
      const y = 1 - (k + 0.5) / dirs * 1.7, r = Math.sqrt(Math.max(0, 1 - y * y)), th = ga * k;
      const dir = v3.norm([Math.cos(th) * r, y, Math.sin(th) * r]);
      const eye = v3.madd(center, dir, radius * 3);
      const up = Math.abs(dir[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
      const lvp = m4.mul(m4.ortho(-radius, radius, -radius, radius, radius * 0.5, radius * 5.5), m4.lookAt(eye, center, up));
      const fb = d.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const fa = new Float32Array(64); fa.set(lvp, 0); fa.set(lvp, 16); d.queue.writeBuffer(fb, 0, fa);
      temp.push(fb);
      const fbg = d.createBindGroup({ layout: this.frameOnlyLayout, entries: [{ binding: 0, resource: { buffer: fb } }] });
      const pass = enc.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: depthView, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
      pass.setPipeline(this.pShadow); pass.setBindGroup(0, fbg); pass.setBindGroup(1, identDraw.bg);
      for (const m of meshes) { pass.setVertexBuffer(0, m.vbuf); pass.setIndexBuffer(m.ibuf, 'uint32'); pass.drawIndexed(m.count); }
      pass.end();
      const cp = enc.beginComputePass();
      cp.setPipeline(this.pAoAccum);
      meshes.forEach((m, i) => {
        const ub = d.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        const ua = new Float32Array(24); ua.set(lvp, 0); ua.set([...dir, 2 / (SIZE * 5)], 16); ua.set([m.vcount, 0, radius * 0.008, 0.0015], 20);
        d.queue.writeBuffer(ub, 0, ua);
        temp.push(ub);
        m._lastU = ub;
        cp.setBindGroup(0, d.createBindGroup({ layout: this.pAoAccum.getBindGroupLayout(0), entries: [
          { binding: 0, resource: { buffer: m.vbuf } }, { binding: 1, resource: { buffer: accs[i] } },
          { binding: 2, resource: depthView }, { binding: 3, resource: { buffer: ub } } ] }));
        const groups = Math.ceil(m.vcount / 64);
        cp.dispatchWorkgroups(Math.min(groups, 65535), Math.ceil(groups / 65535));
      });
      cp.end();
    }
    const cp = enc.beginComputePass();
    cp.setPipeline(this.pAoFinish);
    meshes.forEach((m, i) => {
      cp.setBindGroup(0, d.createBindGroup({ layout: this.pAoFinish.getBindGroupLayout(0), entries: [
        { binding: 1, resource: { buffer: accs[i] } }, { binding: 3, resource: { buffer: m._lastU } }, { binding: 4, resource: { buffer: m.aobuf } } ] }));
      const groups = Math.ceil(m.vcount / 64);
      cp.dispatchWorkgroups(Math.min(groups, 65535), Math.ceil(groups / 65535));
    });
    cp.end();
    d.queue.submit([enc.finish()]);
    await d.queue.onSubmittedWorkDone();
    for (const t of temp) t.destroy();
  }
}
