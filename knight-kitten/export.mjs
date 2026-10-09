// 匯出三個版本（小貓、小狗、小雀）嘅 3D 打印用 STL（實心零件，唔包鬚同披風）同有顏色嘅 GLB。
// 用法：npm install && node export.mjs [高度mm，預設 100]
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const buildKnightKitten = createRequire(import.meta.url)('./model.js');
THREE.ColorManagement.legacyMode = false;   // 色碼當 sRGB，GLB 顏色先會同網頁一樣
const heightMm = Number(process.argv[2]) || 100;

// GLTFExporter 喺 Node 要用 FileReader
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(b => { this.result = b; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(b => { this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(b).toString('base64'); this.onloadend?.(); }); }
};

const FILES = { cat: 'knight-kitten', dog: 'knight-puppy', bird: 'knight-birdie' };

for (const [species, file] of Object.entries(FILES)) {
  // STL：單位 mm，底部貼地
  const printModel = buildKnightKitten(THREE, { species, forPrint: true });
  const size = new THREE.Box3().setFromObject(printModel).getSize(new THREE.Vector3());
  const mm = heightMm / size.y;
  printModel.scale.setScalar(mm);
  printModel.updateMatrixWorld(true);
  printModel.position.y = -new THREE.Box3().setFromObject(printModel).min.y;
  printModel.updateMatrixWorld(true);
  fs.writeFileSync(`${file}.stl`, Buffer.from(new STLExporter().parse(printModel, { binary: true }).buffer));
  console.log(`${file}.stl  高 ${heightMm} mm，闊 ${(size.x * mm).toFixed(1)} mm，深 ${(size.z * mm).toFixed(1)} mm`);

  // GLB：單位 m（glTF 標準），1 單位 = 1 cm
  const colourModel = buildKnightKitten(THREE, { species });
  colourModel.scale.setScalar(0.01);
  const glb = await new Promise((res, rej) => new GLTFExporter().parse(colourModel, res, rej, { binary: true }));
  fs.writeFileSync(`${file}.glb`, Buffer.from(glb));
  console.log(`${file}.glb  有顏色`);
}
