// Copies the standalone toy pages from the repo into the app, so the web
// versions stay the single source of truth.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'desktop', 'app', 'toys');
mkdirSync(out, { recursive: true });
for (const toy of ['baby-bear', 'moomin', 'turbo-granny', 'plush-octopus']) {
  copyFileSync(join(root, toy, 'index.html'), join(out, `${toy}.html`));
  console.log(`synced ${toy}`);
}
