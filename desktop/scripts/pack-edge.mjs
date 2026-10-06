// Builds dist/Plush-Toy-Box-Edge.zip: the toy box plus a launcher that opens it
// in its own Microsoft Edge app window. No Electron runtime, so it stays tiny.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(here, 'dist');
const out = join(dist, 'Plush Toy Box');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
cpSync(join(here, 'launcher'), out, { recursive: true });
rmSync(join(dist, 'Plush-Toy-Box-Edge.zip'), { force: true });
execFileSync('zip', ['-qr', '-9', 'Plush-Toy-Box-Edge.zip', 'Plush Toy Box'], { cwd: dist, stdio: 'inherit' });
console.log('wrote dist/Plush-Toy-Box-Edge.zip');
