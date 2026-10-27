#!/usr/bin/env node
// Copies the Three.js files the page imports into vendor/three (the import map in index.html points
// there). The packaged app cannot load them from node_modules: electron-builder leaves every
// "examples" folder inside node_modules out of the app, and the add-ons live in three/examples/jsm.
// Runs automatically before `npm start` and `npm run dist`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const three = path.join(root, 'node_modules', 'three');
const out = path.join(root, 'vendor', 'three');
const files = {
  'three.module.js': 'build/three.module.js',
  'three.core.js': 'build/three.core.js',
  'addons/controls/OrbitControls.js': 'examples/jsm/controls/OrbitControls.js',
  'addons/utils/BufferGeometryUtils.js': 'examples/jsm/utils/BufferGeometryUtils.js',
  'addons/environments/RoomEnvironment.js': 'examples/jsm/environments/RoomEnvironment.js',
};
fs.rmSync(out, { recursive: true, force: true });
for (const [to, from] of Object.entries(files)) {
  fs.mkdirSync(path.dirname(path.join(out, to)), { recursive: true });
  fs.copyFileSync(path.join(three, from), path.join(out, to));
}
fs.copyFileSync(path.join(three, 'LICENSE'), path.join(out, 'LICENSE'));
console.log(`vendored ${Object.keys(files).length} Three.js files into vendor/three`);
