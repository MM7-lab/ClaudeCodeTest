#!/usr/bin/env node
// Builds the self-contained web preview in a folder, ready to host or to publish:
//
//   node tools/sync-web.mjs <outDir>
//
// It copies web/ (page, shim, buttons), the shared renderer.js and scene/ modules, and a
// vendored copy of the Three.js files the page needs, so nothing loads from a CDN. Because the
// web page runs the very same renderer.js as the desktop app, the two cannot drift apart.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) {
  console.error('usage: node tools/sync-web.mjs <outDir>');
  process.exit(1);
}

const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};
const copyDir = (from, to) => {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const f = path.join(from, entry.name);
    const t = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(f, t);
    else copy(f, t);
  }
};

fs.rmSync(out, { recursive: true, force: true });
for (const name of ['index.html', 'shim.js', 'ui.js']) copy(path.join(root, 'web', name), path.join(out, name));
copy(path.join(root, 'renderer.js'), path.join(out, 'renderer.js'));
copyDir(path.join(root, 'scene'), path.join(out, 'scene'));

const three = path.join(root, 'node_modules', 'three');
for (const file of [
  'build/three.module.js',
  'build/three.core.js',
  'examples/jsm/controls/OrbitControls.js',
  'examples/jsm/utils/BufferGeometryUtils.js',
  'examples/jsm/environments/RoomEnvironment.js',
]) {
  copy(path.join(three, file), path.join(out, 'vendor', 'three', file));
}
const version = JSON.parse(fs.readFileSync(path.join(three, 'package.json'), 'utf8')).version;
console.log(`web preview written to ${out} (three ${version})`);
