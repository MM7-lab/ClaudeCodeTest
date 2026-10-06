// Builds dist/Plush Toy Box-win32-x64: the self-contained Windows app (Electron).
import { packager } from '@electron/packager';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const [appPath] = await packager({
  dir: here,
  name: 'Plush Toy Box',
  platform: 'win32',
  arch: 'x64',
  out: join(here, 'dist'),
  overwrite: true,
  asar: true,
  appCopyright: 'Plush Toy Box',
  ignore: [/^\/dist/, /^\/scripts/, /^\/node_modules/, /^\/launcher/, /^\/\.gitignore$/],
  // optional: a folder holding a pre-downloaded electron-v<version>-win32-x64.zip
  ...(process.env.ELECTRON_ZIP_DIR ? { electronZipDir: process.env.ELECTRON_ZIP_DIR } : {}),
});
console.log(`wrote ${appPath}`);
