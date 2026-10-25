import * as THREE from 'three';
import { smoothstep } from '../util.js';
import { mulberry32 } from '../util.js';

// Facade textures and box geometry for the realistic map. One tile is 4 bays x 4 floors; the
// geometry repeats it over each wall. Roofs sample a plain corner of the tile.

/** World size of one tile: ~14 m wide, 4 floors tall (floors are stretched with the buildings). */
export const TILE_W = 0.089;
export const TILE_H = 0.151;

function canvasTexture(draw, colorSpace = THREE.SRGBColorSpace) {
  if (typeof document === 'undefined') return null; // no canvas outside the browser
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256; // drawn in a 128 x 128 design space, so close-ups stay crisp
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  draw(ctx);
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = colorSpace;
  t.anisotropy = 8;
  return t;
}

/** Colour tile (white walls, glass windows) and a matching emissive tile (some windows lit). */
export function makeFacadeTextures() {
  const rng = mulberry32(77);
  const cells = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) cells.push({ r, c, lit: rng() < 0.3, warm: rng() });
  const win = (ctx, c, r) => ctx.rect(c * 32 + 6, r * 32 + 8, 20, 16);
  const map = canvasTexture((ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 128);
    for (const { r, c } of cells) {
      const g = ctx.createLinearGradient(0, r * 32 + 8, 0, r * 32 + 24);
      g.addColorStop(0, '#2c4258');
      g.addColorStop(1, '#6f8aa6');
      ctx.fillStyle = g;
      ctx.beginPath();
      win(ctx, c, r);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; // glint along the top edge
      ctx.fillRect(c * 32 + 6, r * 32 + 8, 20, 2);
      ctx.fillStyle = 'rgba(235,240,245,0.9)'; // frame, mullion and sill
      ctx.fillRect(c * 32 + 15, r * 32 + 8, 1.5, 16);
      ctx.fillRect(c * 32 + 4, r * 32 + 24, 24, 2.5);
      ctx.strokeStyle = 'rgba(235,240,245,0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(c * 32 + 6, r * 32 + 8, 20, 16);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; // floor slab lines
    for (let r = 0; r < 4; r++) ctx.fillRect(0, r * 32 + 28, 128, 2);
  });
  const emissive = canvasTexture((ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 128, 128);
    for (const { r, c, lit, warm } of cells) {
      if (!lit) continue;
      ctx.fillStyle = warm < 0.7 ? '#ffd68a' : '#cfe6ff';
      ctx.beginPath();
      win(ctx, c, r);
      ctx.fill();
    }
  });
  return { map, emissive };
}

/**
 * A box standing on the ground at (x, z), with facade UVs and a baked darker base.
 * `plain` boxes (roof plant, sheds) use the plain tile corner everywhere.
 */
export function facadeBox({ x, z, w, d, h, y0, color, offsetU = 0, plain = false, rot = 0 }) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rot) g.rotateY(rot);
  g.translate(x, y0 + h / 2, z);
  const uv = g.getAttribute('uv');
  const pos = g.getAttribute('position');
  const faceWidth = [d, d, 0, 0, w, w]; // +x, -x, +y, -y, +z, -z
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      if (plain || f === 2 || f === 3) uv.setXY(i, 0.02, 0.02);
      else uv.setXY(i, (uv.getX(i) * faceWidth[f]) / TILE_W + offsetU, (uv.getY(i) * h) / TILE_H);
    }
  }
  const c = new THREE.Color(color);
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = 0.72 + 0.28 * smoothstep(y0, y0 + 0.16, pos.getY(i)); // baked contact shadow at the base
    colors.set([c.r * k, c.g * k, c.b * k], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}
