// Renders the watch's 3D pet sprite sheets from the desktop app's model.
//   1. serve the repository root:   python3 -m http.server 8765   (from the repo root)
//   2. node watch-cat/tools/sprites/render.mjs [look ids...]
// Writes shared/src/main/assets/pets/<look>_<POSE>.webp and pets/meta.json.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../shared/src/main/assets/pets');
fs.mkdirSync(out, { recursive: true });

// watch look id → desktop breed (and coat, for the plain cats)
const COATS = ['orange', 'grey', 'black', 'white', 'tuxedo'];
const LOOKS = [...COATS, 'persian', 'british', 'american', 'ragdoll', 'siamese', 'fold',
  'golden', 'labrador', 'frenchie', 'shepherd', 'dachshund', 'pomeranian', 'chihuahua', 'nightdragon'];
const want = process.argv.slice(2).length ? process.argv.slice(2) : LOOKS;

const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', e => console.error('page error:', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto('http://localhost:8765/watch-cat/tools/sprites/index.html');
await page.waitForFunction(() => window.ready === true);
const info = await page.evaluate(() => window.spriteInfo);

const metaFile = path.join(out, 'meta.json');
const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : { looks: {} };
Object.assign(meta, { cell: info.CELL, frames: info.N, cols: info.COLS, fps: 8 });
for (const id of want) {
  const job = COATS.includes(id) ? { breed: 'classic', coat: id } : { breed: id };
  const t0 = Date.now();
  const res = await page.evaluate(j => window.renderLook(j), job);
  meta.looks[id] = {};
  for (const [pose, r] of Object.entries(res)) {
    fs.writeFileSync(path.join(out, `${id}_${pose}.webp`), Buffer.from(r.webp.split(',')[1], 'base64'));
    meta.looks[id][pose] = r.anchors;
  }
  console.log(id, `${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
fs.writeFileSync(metaFile, JSON.stringify(meta));
await browser.close();
