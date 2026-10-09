// 將 cat-model.js 嘅模型匯出做 lying-office-cat.glb（Blender、Windows 3D 檢視器、iPhone 都開到）。
// 用法：npm install && npm run export-glb
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

// GLTFExporter 喺 Node 冇 FileReader，補一個最簡單嘅
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.();
    });
  }
};

const require = createRequire(import.meta.url);
const buildLyingCat = require("./cat-model.js");
THREE.ColorManagement.legacyMode = false;
const { root } = buildLyingCat(THREE);
root.updateMatrixWorld(true);

new GLTFExporter().parse(
  root,
  (glb) => {
    writeFileSync(new URL("./lying-office-cat.glb", import.meta.url), Buffer.from(glb));
    console.log("written lying-office-cat.glb", glb.byteLength, "bytes");
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
  { binary: true }
);
