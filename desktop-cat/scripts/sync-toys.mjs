// Copies the plush toy pages (the WebGPU soft-body 公仔) into the cat app and
// patches in a small bridge, so the cat can play with them.
//
//   node scripts/sync-toys.mjs [folder with baby-bear/, hello-kitty/, …]
//
// The folder defaults to the repo root, where the toy pages live as <toy>/index.html.
// The pages stay the single source of truth: re-run this after changing a toy.
//
// Inside the cat app the toys draw with WebGL (toys/webgpu-gl.js stands in for WebGPU),
// so their WGSL shaders are translated to GLSL ES 3.0 here. That needs naga:
//   cargo install naga-cli
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(process.argv[2] || join(here, '..', '..'));
const out = join(here, '..', 'toys');
const TOYS = ['baby-bear', 'hello-kitty', 'moomin', 'turbo-granny', 'plush-octopus'];

// Runs before the page's own script: stands in for the Plush Toy Box preload
// (cursor in, "hovering the toy" out), talking to the cat app via postMessage.
const HEAD = `<script>
// 桌面貓貓 (?embed): the toy lives in an iframe in the cat app's see-through window.
(() => {
  const q = new URLSearchParams(location.search);
  if (!q.has('embed')) return;
  const id = q.get('id') || '';
  if (q.get('gpu') !== 'webgpu') document.write('<script src="webgpu-gl.js"><\\/script>');
  let onCursor = null;
  window.petBridge = {
    onCursor: (cb) => { onCursor = cb; },
    setInteractive: (on) => parent.postMessage({ toy: id, type: 'interactive', on }, '*'),
  };
  addEventListener('message', (e) => { if (e.source === parent && e.data && e.data.type === 'cursor') onCursor && onCursor(e.data); });
})();
</script>
`;

// Runs inside main(), after the toy's own interaction code: lets the cat push,
// pounce on and carry the toy, and reports where the toy is on screen.
const API = `  // ---- 桌面貓貓 (?embed): the cat can push, pounce on and carry the toy
  var catSnap = null; // called after each frame is submitted (see the frame loop)
  if (params.has('embed')) {
    const TOY = params.get('id') || '';
    const send = (m) => parent.postMessage({ toy: TOY, ...m }, '*');
    const UPX = 1.9 / PET_SIZE; // world units per CSS px at the toy's depth
    let catGrab = false;
    const dropCatGrab = () => { if (catGrab) { catGrab = false; releaseGrab(); mode = null; gesture = null; } };
    // a person grabbing the toy wins over the cat
    canvas.addEventListener('pointerdown', dropCatGrab, true);
    addEventListener('message', (e) => {
      if (e.source !== parent) return;
      const m = e.data || {};
      if (m.type === 'place') {
        const dx = (m.x - canvas.clientWidth / 2) * UPX - bodyOrigin([0, 0, 0])[0];
        for (let i = 0; i < NP; i++) { P[i * 3] += dx; PP[i * 3] += dx; }
        SM.c[0] += dx;
      } else if (m.type === 'poke') {
        // a paw swipe or a pounce: shove the parts near (x, y) along (dx, dy) in screen terms
        let i0 = nearestParticle(m.x, m.y, 40);
        if (i0 < 0) i0 = 0;
        const c = [P[i0 * 3], P[i0 * 3 + 1], P[i0 * 3 + 2]], s = m.power || 4, lift = m.lift ?? 2;
        for (let i = 0; i < NP; i++) {
          const o = i * 3, d2 = (P[o] - c[0]) ** 2 + (P[o + 1] - c[1]) ** 2 + (P[o + 2] - c[2]) ** 2;
          const w = 0.35 + 0.65 * Math.exp(-d2 / 0.5);
          V[o] += (m.dx || 0) * s * w; V[o + 1] += (-(m.dy || 0) * s + lift) * w; V[o + 2] += (m.dz || 0) * s * w;
        }
        poke = 1;
      } else if (m.type === 'grab') {
        if (grab.active) return;
        const hit = pickLoose(m.x, m.y);
        if (hit) { startGrab(hit, 'cat', m.x, m.y); catGrab = true; }
      } else if (m.type === 'drag') {
        if (catGrab && gesture) { gesture.x = m.x; gesture.y = m.y; }
      } else if (m.type === 'release') {
        dropCatGrab();
      } else if (m.type === 'action') {
        window.toyAction(m.action);
      }
    });
    const pp = [0, 0, 0];
    setInterval(() => {
      if (!lastVP) return;
      let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
      for (let i = 0; i < NP; i++) {
        projectParticle(i, pp);
        l = Math.min(l, pp[0]); r = Math.max(r, pp[0]); t = Math.min(t, pp[1]); b = Math.max(b, pp[1]);
      }
      let vx = 0, vy = 0;
      for (let j = 0; j < BODY_N; j++) { vx += V[j * 3]; vy += V[j * 3 + 1]; }
      if (catGrab && !grab.active) catGrab = false;
      send({ type: 'state', l, r, t, b, z: bodyOrigin([0, 0, 0])[2] / UPX,
        held: grab.active && !catGrab, carried: catGrab, speed: Math.hypot(vx, vy) / BODY_N / UPX,
        drawn: G ? G.drawn : drawn, errors: errCount, error: firstError,
        gl: G && { started: G.started, ready: G.ready, failed: G.failed, error: G.error, frames: G.frames, compileMs: G.compileMs } });
      // a shader that won't compile or link under WebGL: give up on this way of drawing
      if (G && G.failed && !sentFail) { sentFail = true; send({ type: 'failed', msg: 'WebGL：' + G.failed }); }
    }, 100);
    const G = window.__glState; // set when drawing through the WebGL stand-in
    let sentFail = false;

    // WebGPU errors don't stop the frame loop, so count them for the diagnostics report
    let errCount = 0, firstError = '';
    device.addEventListener('uncapturederror', (e) => { errCount++; if (!firstError) firstError = String(e.error && e.error.message).slice(0, 200); });

    // Every frame, copy the toy's corner of the canvas and hand it to the cat app, which draws it
    // on its own canvas: some Windows setups never show a WebGPU canvas in a see-through window.
    // Also check now and then that the copy actually has the toy in it.
    let snapBusy = false, drawn = null, lastCheck = 0;
    const sp = [0, 0, 0];
    const checkDrawn = (bmp) => {
      const oc = new OffscreenCanvas(bmp.width, bmp.height), g = oc.getContext('2d');
      g.drawImage(bmp, 0, 0);
      const px = g.getImageData(0, 0, bmp.width, bmp.height).data;
      let n = 0;
      for (let i = 3; i < px.length; i += 16) if (px[i] > 24) n++;
      drawn = n > 20;
    };
    catSnap = () => {
      if (snapBusy || !lastVP) return;
      let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
      for (let i = 0; i < NP; i++) {
        projectParticle(i, sp);
        l = Math.min(l, sp[0]); r = Math.max(r, sp[0]); t = Math.min(t, sp[1]); b = Math.max(b, sp[1]);
      }
      const cw = canvas.clientWidth, ch = canvas.clientHeight, m = Math.max(r - l, b - t) * 0.5 + 8;
      const x0 = Math.max(0, Math.floor(l - m)), y0 = Math.max(0, Math.floor(t - m));
      const x1 = Math.min(cw, Math.ceil(r + m * 1.4)), y1 = Math.min(ch, Math.ceil(b + m * 0.5));
      if (x1 - x0 < 2 || y1 - y0 < 2) return;
      window.__toyRect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; // the WebGL stand-in draws only around here
      if (G) return; // and sends its own pixels
      const kx = canvas.width / cw, ky = canvas.height / ch;
      snapBusy = true;
      createImageBitmap(canvas, Math.round(x0 * kx), Math.round(y0 * ky), Math.round((x1 - x0) * kx), Math.round((y1 - y0) * ky),
        { resizeWidth: x1 - x0, resizeHeight: y1 - y0 })
        .then((bmp) => {
          snapBusy = false;
          const now = performance.now();
          if (now - lastCheck > 2000) { lastCheck = now; checkDrawn(bmp); }
          parent.postMessage({ toy: TOY, type: 'frame', x: x0, y: y0, w: x1 - x0, h: y1 - y0, bmp }, '*', [bmp]);
        })
        .catch((e) => { snapBusy = false; if (!firstError) firstError = 'snapshot: ' + e.message; catSnap = null; });
    };

    const ai = adapter && adapter.info;
    send({ type: 'ready', adapter: ai ? [ai.vendor, ai.architecture, ai.device, ai.description].filter(Boolean).join(' ') : '' });
  }

`;

// [what to find, what to put there]; each must match exactly once.
const EDITS = [
  ['<meta name="color-scheme" content="light">', (m) => m + '\n' + HEAD.trimEnd()],
  // the cat app uses toys about the cat's size
  ["clamp(Number(params.get('size')) || 300, 120, 900)", () => "clamp(Number(params.get('size')) || 300, 60, 900)"],
  // stand on the same floor line as the cat (?floor = px above the bottom of the window)
  ['cam.focus = [0, visH / 2 - 0.4, 0];', () => "cam.focus = [0, visH / 2 - (params.has('floor') ? Number(params.get('floor')) * unitsPerPx : 0.4), 0];"],
  // several toys share the cat's window: draw them at 1× to keep graphics memory down
  ['const dpr = Math.min(window.devicePixelRatio || 1, PET ? 1.5 : 2);', () => "const dpr = Math.min(window.devicePixelRatio || 1, params.has('embed') ? 1 : PET ? 1.5 : 2);"],
  // use the same graphics chip that shows the window: on laptops with two GPUs a toy drawn on
  // the other one can come out invisible in a see-through window
  // (?adapter=hp|lp lets the cat app try the other chip if nothing gets drawn)
  ["adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });",
    () => "adapter = await navigator.gpu.requestAdapter(!params.has('embed') ? { powerPreference: 'high-performance' } : ({ hp: { powerPreference: 'high-performance' }, lp: { powerPreference: 'low-power' } }[params.get('adapter')] || {}));"],
  // A small toy on a tall screen puts the pet camera far away (about 108 units for a 60 px toy
  // on a 1080 px screen), past the fixed far plane of 60, so nothing was drawn at all. Fit the
  // near and far planes around the camera distance instead.
  ['const proj = m4persp(cam.fovy, cam.aspect, 0.1, 60);', () => "const camDist = Math.hypot(cam.eye[0] - cam.focus[0], cam.eye[1] - cam.focus[1], cam.eye[2] - cam.focus[2]);\n    const proj = PET ? m4persp(cam.fovy, cam.aspect, Math.max(0.1, camDist - 30), camDist + 30) : m4persp(cam.fovy, cam.aspect, 0.1, 60);"],
  // smaller shadow map inside the cat app: the toys are small there, and laptops thank us
  ['const SHADOW_SIZE = 2048;', () => "const SHADOW_SIZE = params.has('embed') ? 1024 : 2048;"],
  // the cat app copies frames out of the canvas
  ["ctx.configure({ device, format, alphaMode: PET ? 'premultiplied' : 'opaque' });",
    () => "ctx.configure({ device, format, alphaMode: PET ? 'premultiplied' : 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });"],
  ['device.queue.submit([enc.finish()]);', (m) => m + '\n    if (catSnap) catSnap();'],
  // no WebGPU: tell the cat app instead of showing the English fallback card
  ['function fail(msg) {', (m) => m + "\n  if (params.has('embed')) { parent.postMessage({ toy: params.get('id'), type: 'failed', msg }, '*'); return; }"],
  ['  statParticles.textContent', (m) => API + m],
];

mkdirSync(out, { recursive: true });
// WGSL -> GLSL ES 3.0 for every entry point, keyed '<module label>:<entry point>' to match
// compile(WGSL_MAIN, 'main') / compile(WGSL_SHADOW, 'shadow') in the toy pages.
function translateShaders(html, toy) {
  const a = html.indexOf('const WGSL_COMMON'), b = html.indexOf('\n`;', html.indexOf('const WGSL_MAIN')) + 3;
  if (a < 0 || b < 3) throw new Error(`${toy}: WGSL not found`);
  const mods = new Function(html.slice(a, b) + '\nreturn { shadow: WGSL_SHADOW, main: WGSL_MAIN };')();
  const dir = mkdtempSync(join(tmpdir(), 'toy-glsl-'));
  const out = {};
  try {
    for (const [label, code] of Object.entries(mods)) {
      const wgsl = join(dir, `${label}.wgsl`);
      writeFileSync(wgsl, code);
      for (const [, stage, entry] of code.matchAll(/@(vertex|fragment)\s+fn\s+(\w+)/g)) {
        const file = join(dir, `${entry}.${stage === 'vertex' ? 'vert' : 'frag'}`);
        execFileSync('naga', [wgsl, file, '--entry-point', entry, '--profile', 'es300', '--compact'], { stdio: 'pipe' });
        out[`${label}:${entry}`] = readFileSync(file, 'utf8');
      }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
  return out;
}

for (const toy of TOYS) {
  const original = readFileSync(join(src, toy, 'index.html'), 'utf8');
  let html = original;
  for (const [find, put] of EDITS) {
    const n = html.split(find).length - 1;
    if (n !== 1) throw new Error(`${toy}: expected one "${find}", found ${n}`);
    html = html.replace(find, () => put(find));
  }
  const glsl = translateShaders(original, toy);
  // must come before the stand-in loads; '</' is escaped so the JSON can't end the script tag
  const data = `<script>window.__TOY_GLSL = ${JSON.stringify(glsl).replace(/<\//g, '<\\/')};</script>\n`;
  html = html.replace('<script>\n// 桌面貓貓 (?embed)', () => data + '<script>\n// 桌面貓貓 (?embed)');
  writeFileSync(join(out, `${toy}.html`), html);
  console.log(`synced ${toy} (${Object.keys(glsl).length} shaders)`);
}
