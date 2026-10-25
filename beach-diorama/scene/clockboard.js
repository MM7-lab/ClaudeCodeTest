import * as THREE from 'three';
import { P, mergeParts, setShadows, vertexColorMaterial } from './util.js';

const BOARD_W = 1.7;
const BOARD_H = 0.78;

/** Canvas texture with the time as big amber LED digits; the colon blinks every second. */
function makeClockTexture() {
  if (typeof document === 'undefined') return null; // no canvas outside the browser
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round((512 * BOARD_H) / BOARD_W);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return {
    texture,
    draw(now) {
      const ctx = canvas.getContext('2d');
      const { width, height } = canvas;
      ctx.fillStyle = '#120d06';
      ctx.fillRect(0, 0, width, height);
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const colon = now.getSeconds() % 2 === 0 ? ':' : ' ';
      ctx.font = '700 168px "Courier New", Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ff9a1f';
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#ffb02e';
      ctx.fillText(`${hh}${colon}${mm}`, width / 2, height / 2 + 6);
      ctx.shadowBlur = 0;
      texture.needsUpdate = true;
    },
  };
}

/**
 * A big LED digital clock on a roof, showing the computer's local time (HH:MM, 24 hours).
 * `x, y, z` is the centre of the roof; `scale` shrinks the board for smaller buildings.
 * The board turns to face the camera, so it can be read from any angle.
 */
export function createClockBoard({ x, y, z, scale = 1, standard = false }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);

  const frame = new THREE.Mesh(
    mergeParts([
      P(new THREE.BoxGeometry(BOARD_W + 0.1, BOARD_H + 0.1, 0.07), '#2a2f36', { pos: [0, 0.3 + BOARD_H / 2, -0.045] }),
      P(new THREE.BoxGeometry(0.06, 0.3, 0.06), '#8d98a5', { pos: [-0.35, 0.15, -0.04] }),
      P(new THREE.BoxGeometry(0.06, 0.3, 0.06), '#8d98a5', { pos: [0.35, 0.15, -0.04] }),
    ]),
    vertexColorMaterial,
  );
  const clock = makeClockTexture();
  const material = new THREE.MeshBasicMaterial({ map: clock ? clock.texture : null, color: 0xffffff, toneMapped: false });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, BOARD_H), material);
  board.position.y = 0.3 + BOARD_H / 2;
  group.add(frame, board);
  setShadows(group, true, false);

  let lastSecond = -1;
  return {
    group,
    /** Redraw once a second, glow a little brighter at night, face the camera. */
    update(env, cameraPosition) {
      const now = new Date();
      if (clock && now.getSeconds() !== lastSecond) {
        lastSecond = now.getSeconds();
        clock.draw(now);
      }
      material.color.setScalar(0.88 + 0.12 * env.night);
      group.rotation.y = Math.atan2(cameraPosition.x - group.position.x, cameraPosition.z - group.position.z);
    },
  };
}
