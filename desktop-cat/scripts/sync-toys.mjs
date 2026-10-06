// Copies the plush toy pages (the WebGPU soft-body 公仔) into the cat app and
// patches in a small bridge, so the cat can play with them.
//
//   node scripts/sync-toys.mjs [folder with baby-bear/, hello-kitty/, …]
//
// The folder defaults to the repo root, where the toy pages live as <toy>/index.html.
// The pages stay the single source of truth: re-run this after changing a toy.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
        held: grab.active && !catGrab, carried: catGrab, speed: Math.hypot(vx, vy) / BODY_N / UPX });
    }, 100);
    send({ type: 'ready' });
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
  // no WebGPU: tell the cat app instead of showing the English fallback card
  ['function fail(msg) {', (m) => m + "\n  if (params.has('embed')) { parent.postMessage({ toy: params.get('id'), type: 'failed', msg }, '*'); return; }"],
  ['  statParticles.textContent', (m) => API + m],
];

mkdirSync(out, { recursive: true });
for (const toy of TOYS) {
  let html = readFileSync(join(src, toy, 'index.html'), 'utf8');
  for (const [find, put] of EDITS) {
    const n = html.split(find).length - 1;
    if (n !== 1) throw new Error(`${toy}: expected one "${find}", found ${n}`);
    html = html.replace(find, () => put(find));
  }
  writeFileSync(join(out, `${toy}.html`), html);
  console.log(`synced ${toy}`);
}
