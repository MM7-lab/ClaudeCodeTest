// 匯出 3D 打印用 STL（實心零件，唔包鬚）同埋有顏色嘅 GLB。
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

function scaled(opts) {
  const kitten = buildKnightKitten(THREE, opts);
  const size = new THREE.Box3().setFromObject(kitten).getSize(new THREE.Vector3());
  return { kitten, size };
}

// STL：單位 mm，底部貼地
const { kitten: printModel, size } = scaled({ forPrint: true });
const mm = heightMm / size.y;
printModel.scale.setScalar(mm);
printModel.updateMatrixWorld(true);
printModel.position.y = -new THREE.Box3().setFromObject(printModel).min.y;
printModel.updateMatrixWorld(true);
fs.writeFileSync('knight-kitten.stl', Buffer.from(new STLExporter().parse(printModel, { binary: true }).buffer));
console.log(`knight-kitten.stl  高 ${heightMm} mm，闊 ${(size.x * mm).toFixed(1)} mm，深 ${(size.z * mm).toFixed(1)} mm`);

// GLB：單位 m（glTF 標準），1 單位 = 1 cm
const { kitten: colourModel } = scaled({});
colourModel.scale.setScalar(0.01);
const glb = await new Promise((res, rej) => new GLTFExporter().parse(colourModel, res, rej, { binary: true }));
fs.writeFileSync('knight-kitten.glb', Buffer.from(glb));
console.log('knight-kitten.glb  有顏色，可放入 Blender／PowerPoint／手機 AR 檢視器');
