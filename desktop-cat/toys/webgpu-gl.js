// WebGPU on WebGL2, just enough for the plush toys inside 桌面貓貓 (?embed).
//
// The toys were written for WebGPU, which many PCs can't run (older graphics drivers are
// blocklisted). The cat itself is drawn with WebGL, which works almost everywhere, so inside
// the cat app the toys draw with WebGL too: this file stands in for navigator.gpu, and their
// WGSL shaders are translated to GLSL ES 3.0 ahead of time by scripts/sync-toys.mjs (naga),
// arriving here as window.__TOY_GLSL['<module label>:<entry point>'].
//
// Like wgpu's GL backend, everything renders upside down (naga flips clip-space y and remaps
// z to GL's range), which keeps shadow-map lookups right; the final blit to the canvas flips
// the picture back. window.__toyRect (set by the toy each frame) limits drawing to the area
// around the toy, which matters with several full-screen toys on a laptop GPU.
(() => {
  const q = new URLSearchParams(location.search);
  if (!q.has('embed') || q.get('gpu') === 'webgpu') return;
  const SHADERS = window.__TOY_GLSL || {};

  const BU = { MAP_READ: 1, MAP_WRITE: 2, COPY_SRC: 4, COPY_DST: 8, INDEX: 16, VERTEX: 32, UNIFORM: 64, STORAGE: 128, INDIRECT: 256, QUERY_RESOLVE: 512 };
  const TU = { COPY_SRC: 1, COPY_DST: 2, TEXTURE_BINDING: 4, STORAGE_BINDING: 8, RENDER_ATTACHMENT: 16 };
  const SS = { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 };
  for (const [k, v] of Object.entries({ GPUBufferUsage: BU, GPUTextureUsage: TU, GPUShaderStage: SS })) {
    Object.defineProperty(window, k, { value: v, configurable: true, writable: true });
  }

  let gl = null, glCanvas = null, device = null;

  const COMPARE = g => ({ never: g.NEVER, less: g.LESS, equal: g.EQUAL, 'less-equal': g.LEQUAL, greater: g.GREATER,
    'not-equal': g.NOTEQUAL, 'greater-equal': g.GEQUAL, always: g.ALWAYS });
  const COMPONENTS = { float32: 1, float32x2: 2, float32x3: 3, float32x4: 4 };
  const isDepth = f => f.startsWith('depth');

  class Buf {
    constructor(d) {
      this.size = d.size;
      this.target = d.usage & BU.UNIFORM ? gl.UNIFORM_BUFFER : d.usage & BU.INDEX ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;
      this.b = gl.createBuffer();
      gl.bindBuffer(this.target, this.b);
      gl.bufferData(this.target, d.size, gl.DYNAMIC_DRAW);
    }
    destroy() { gl.deleteBuffer(this.b); }
  }

  class Tex {
    constructor(d) {
      const size = Array.isArray(d.size) ? d.size : [d.size.width, d.size.height];
      [this.w, this.h] = size;
      this.format = d.format;
      this.samples = d.sampleCount || 1;
      if (this.samples > 1) {
        this.rb = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.rb);
        const n = Math.min(this.samples, gl.getParameter(gl.MAX_SAMPLES));
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, n, isDepth(this.format) ? gl.DEPTH_COMPONENT24 : gl.RGBA8, this.w, this.h);
      } else {
        this.t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.t);
        if (this.format === 'depth32float') gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT32F, this.w, this.h, 0, gl.DEPTH_COMPONENT, gl.FLOAT, null);
        else if (isDepth(this.format)) gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, this.w, this.h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.w, this.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      }
    }
    createView() { return { tex: this }; }
    destroy() { if (this.rb) gl.deleteRenderbuffer(this.rb); if (this.t) gl.deleteTexture(this.t); device.dropFbos(this); }
  }

  // The canvas's "current texture": rendering resolves into it via resolveFrame().
  const canvasTex = { isCanvas: true, createView() { return { tex: canvasTex }; } };

  class Smp {
    constructor(d) {
      this.s = gl.createSampler();
      const wrap = m => ({ repeat: gl.REPEAT, 'mirror-repeat': gl.MIRRORED_REPEAT })[m] || gl.CLAMP_TO_EDGE;
      gl.samplerParameteri(this.s, gl.TEXTURE_WRAP_S, wrap(d.addressModeU));
      gl.samplerParameteri(this.s, gl.TEXTURE_WRAP_T, wrap(d.addressModeV));
      gl.samplerParameteri(this.s, gl.TEXTURE_MIN_FILTER, d.minFilter === 'linear' ? gl.LINEAR : gl.NEAREST);
      gl.samplerParameteri(this.s, gl.TEXTURE_MAG_FILTER, d.magFilter === 'linear' ? gl.LINEAR : gl.NEAREST);
      if (d.compare) {
        gl.samplerParameteri(this.s, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
        gl.samplerParameteri(this.s, gl.TEXTURE_COMPARE_FUNC, COMPARE(gl)[d.compare]);
      }
    }
  }

  function compile(type, src, name) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`GLSL ${name}: ${gl.getShaderInfoLog(s)}`);
    return s;
  }
  const EMPTY_FS = '#version 300 es\nprecision highp float;\nvoid main() {}\n';

  class Pipe {
    constructor(d) {
      const vk = `${d.vertex.module.label}:${d.vertex.entryPoint}`;
      const fk = d.fragment ? `${d.fragment.module.label}:${d.fragment.entryPoint}` : null;
      const vsrc = SHADERS[vk], fsrc = fk ? SHADERS[fk] : EMPTY_FS;
      if (!vsrc || !fsrc) throw new Error(`no GLSL for ${vsrc ? fk : vk}`);
      const p = this.prog = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, vsrc, vk));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsrc, fk || 'empty'));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`GLSL link ${vk}: ${gl.getProgramInfoLog(p)}`);
      gl.useProgram(p);
      // naga names bindings _group_<g>_binding_<b>_<stage>: uniform blocks bind to slot <b>,
      // combined texture-samplers to texture unit <b>
      const both = vsrc + fsrc;
      for (const m of both.matchAll(/uniform (\w+) \{ \w+ _group_\d+_binding_(\d+)_\w+; \}/g)) {
        const idx = gl.getUniformBlockIndex(p, m[1]);
        if (idx !== gl.INVALID_INDEX) gl.uniformBlockBinding(p, idx, Number(m[2]));
      }
      for (const m of both.matchAll(/uniform \w+ sampler\w+ (_group_\d+_binding_(\d+)_\w+);/g)) {
        const loc = gl.getUniformLocation(p, m[1]);
        if (loc) gl.uniform1i(loc, Number(m[2]));
      }
      const fi = gl.getUniformLocation(p, 'naga_vs_first_instance');
      if (fi) gl.uniform1ui(fi, 0);
      this.buffers = d.vertex.buffers || [];
      this.depth = d.depthStencil || null;
    }
  }

  class Pass {
    constructor(d) {
      const col = d.colorAttachments && d.colorAttachments[0];
      const dep = d.depthStencilAttachment;
      this.colTex = col ? col.view.tex : null;
      this.resolve = !!(col && col.resolveTarget && col.resolveTarget.tex.isCanvas);
      const size = this.colTex || dep.view.tex;
      this.w = size.w; this.h = size.h;
      gl.bindFramebuffer(gl.FRAMEBUFFER, device.fbo(this.colTex, dep ? dep.view.tex : null));
      gl.viewport(0, 0, this.w, this.h);
      // drawing near the toy only: the frame is upside down, so screen rows map straight to rows here
      this.rect = null;
      const r = window.__toyRect;
      if (this.resolve && r) {
        const m = 80, x0 = Math.max(0, Math.floor(r.x - m)), y0 = Math.max(0, Math.floor(r.y - m));
        const x1 = Math.min(this.w, Math.ceil(r.x + r.w + m)), y1 = Math.min(this.h, Math.ceil(r.y + r.h + m));
        if (x1 > x0 && y1 > y0) this.rect = [x0, y0, x1 - x0, y1 - y0];
      }
      if (this.rect) { gl.enable(gl.SCISSOR_TEST); gl.scissor(...this.rect); } else gl.disable(gl.SCISSOR_TEST);
      let mask = 0;
      if (col && col.loadOp === 'clear') {
        const c = col.clearValue || { r: 0, g: 0, b: 0, a: 0 };
        gl.colorMask(true, true, true, true);
        gl.clearColor(c.r, c.g, c.b, c.a);
        mask |= gl.COLOR_BUFFER_BIT;
      }
      if (dep && dep.depthLoadOp === 'clear') {
        gl.depthMask(true);
        gl.clearDepth(dep.depthClearValue ?? 1);
        mask |= gl.DEPTH_BUFFER_BIT;
      }
      if (mask) gl.clear(mask);
      this.vb = [];
      this.enabled = new Set();
    }
    setPipeline(p) {
      this.p = p;
      gl.useProgram(p.prog);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      if (p.depth) {
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(COMPARE(gl)[p.depth.depthCompare || 'always']);
        gl.depthMask(!!p.depth.depthWriteEnabled);
        if (p.depth.depthBias || p.depth.depthBiasSlopeScale) {
          gl.enable(gl.POLYGON_OFFSET_FILL);
          gl.polygonOffset(p.depth.depthBiasSlopeScale || 0, p.depth.depthBias || 0);
        } else gl.disable(gl.POLYGON_OFFSET_FILL);
      } else { gl.disable(gl.DEPTH_TEST); gl.disable(gl.POLYGON_OFFSET_FILL); }
    }
    setBindGroup(_i, g) {
      const units = [], samplers = [];
      for (const e of g.entries) {
        const r = e.resource;
        if (r.buffer) gl.bindBufferBase(gl.UNIFORM_BUFFER, e.binding, r.buffer.b);
        else if (r.tex) { gl.activeTexture(gl.TEXTURE0 + e.binding); gl.bindTexture(gl.TEXTURE_2D, r.tex.t); units.push(e.binding); }
        else if (r instanceof Smp) samplers.push(r);
      }
      // naga folds each sampler into the texture it is used with, on the texture's unit
      for (const u of units) for (const s of samplers) gl.bindSampler(u, s.s);
    }
    setVertexBuffer(slot, buf) { this.vb[slot] = buf; }
    setIndexBuffer(buf, fmt) { this.ib = buf; this.itype = fmt === 'uint16' ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT; this.isize = fmt === 'uint16' ? 2 : 4; }
    attribs() {
      for (const loc of this.enabled) gl.disableVertexAttribArray(loc);
      this.enabled.clear();
      this.p.buffers.forEach((layout, slot) => {
        const buf = this.vb[slot];
        if (!buf) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.b);
        for (const a of layout.attributes) {
          gl.enableVertexAttribArray(a.shaderLocation);
          this.enabled.add(a.shaderLocation);
          gl.vertexAttribPointer(a.shaderLocation, COMPONENTS[a.format], gl.FLOAT, false, layout.arrayStride, a.offset);
          gl.vertexAttribDivisor(a.shaderLocation, layout.stepMode === 'instance' ? 1 : 0);
        }
      });
    }
    draw(n, inst = 1, first = 0) { this.attribs(); gl.drawArraysInstanced(gl.TRIANGLES, first, n, inst); }
    drawIndexed(n, inst = 1, firstIndex = 0) {
      this.attribs();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib.b);
      gl.drawElementsInstanced(gl.TRIANGLES, n, this.itype, firstIndex * this.isize, inst);
    }
    end() {
      for (const loc of this.enabled) gl.disableVertexAttribArray(loc);
      if (this.resolve) device.resolveFrame(this.colTex, this.rect);
    }
  }

  class Device extends EventTarget {
    constructor() {
      super();
      this.limits = { maxTextureDimension2D: gl.getParameter(gl.MAX_TEXTURE_SIZE) };
      this.features = new Set();
      this.lost = new Promise(res => glCanvas.addEventListener('webglcontextlost', () => res({ reason: 'unknown', message: 'WebGL context lost' })));
      this.fbos = new Map();
      gl.bindVertexArray(gl.createVertexArray());
      this.queue = {
        writeBuffer(buf, offset, data, dataOffset = 0, size) {
          gl.bindBuffer(buf.target, buf.b);
          const src = ArrayBuffer.isView(data) ? data : new Uint8Array(data);
          gl.bufferSubData(buf.target, offset, src, dataOffset, size ?? 0);
        },
        submit() {},
        onSubmittedWorkDone: () => Promise.resolve(),
      };
    }
    createBuffer(d) { return new Buf(d); }
    createTexture(d) { return new Tex(d); }
    createSampler(d = {}) { return new Smp(d); }
    createShaderModule(d) { return { label: d.label, getCompilationInfo: async () => ({ messages: [] }) }; }
    createBindGroupLayout(d) { return d; }
    createPipelineLayout(d) { return d; }
    createBindGroup(d) { return d; }
    createRenderPipeline(d) { return new Pipe(d); }
    createCommandEncoder() { return { beginRenderPass: d => new Pass(d), finish: () => ({}) }; }
    destroy() {}
    fbo(col, dep) {
      const key = col, sub = dep;
      let byCol = this.fbos.get(key);
      if (!byCol) this.fbos.set(key, byCol = new Map());
      let f = byCol.get(sub);
      if (f) return f;
      f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      if (col) {
        if (col.rb) gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, col.rb);
        else gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, col.t, 0);
      } else { gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); }
      if (dep) {
        if (dep.rb) gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, dep.rb);
        else gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, dep.t, 0);
      }
      const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('WebGL framebuffer incomplete: 0x' + st.toString(16));
      byCol.set(sub, f);
      return f;
    }
    dropFbos(tex) {
      for (const [col, byCol] of this.fbos) {
        for (const [dep, f] of byCol) if (col === tex || dep === tex) { gl.deleteFramebuffer(f); byCol.delete(dep); }
        if (!byCol.size) this.fbos.delete(col);
      }
    }
    // multisampled frame -> plain texture (same rows) -> canvas (flipped the right way up)
    resolveFrame(src, rect) {
      const W = glCanvas.width, H = glCanvas.height;
      if (!this.mid || this.mid.w !== src.w || this.mid.h !== src.h) {
        if (this.mid) this.mid.destroy();
        this.mid = new Tex({ size: [src.w, src.h], format: 'rgba8unorm' });
      }
      const [x, y, w, h] = rect || [0, 0, src.w, src.h];
      gl.disable(gl.SCISSOR_TEST);
      // look both up first: creating a framebuffer rebinds both read and draw targets
      const from = this.fbo(src, null), mid = this.fbo(this.mid, null);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, from);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, mid);
      gl.blitFramebuffer(x, y, x + w, y + h, x, y, x + w, y + h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, mid);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      gl.blitFramebuffer(x, y, x + w, y + h, x, H - y, x + w, H - y - h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    }
  }

  const gpu = {
    async requestAdapter() {
      glCanvas = glCanvas || document.getElementById('gl');
      if (!gl) {
        gl = glCanvas && glCanvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
      }
      if (!gl) return null;
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      return {
        info: { vendor: 'WebGL2', architecture: '', device: '', description: String(renderer) },
        features: new Set(), limits: { maxTextureDimension2D: gl.getParameter(gl.MAX_TEXTURE_SIZE) }, isFallbackAdapter: false,
        async requestDevice() { device = device || new Device(); return device; },
      };
    },
    getPreferredCanvasFormat: () => 'rgba8unorm',
    wgslLanguageFeatures: new Set(),
  };
  Object.defineProperty(navigator, 'gpu', { value: gpu, configurable: true });

  // canvas.getContext('webgpu') on the toy's canvas returns this stand-in
  const ctx = {
    configure() {},
    unconfigure() {},
    getCurrentTexture() { canvasTex.w = glCanvas.width; canvasTex.h = glCanvas.height; return canvasTex; },
  };
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, opts) {
    if (type === 'webgpu' && this === glCanvas) return ctx;
    return getContext.call(this, type, opts);
  };
})();
