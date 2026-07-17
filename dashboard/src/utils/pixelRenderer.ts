import type { WorkerDef } from '../types';

/**
 * Draw a pixel character on a 42×45 canvas.
 * frame: 0 = neutral, 1 = arms up (working A), 2 = arms mid (working B)
 * eyeFrame: 0 = open, 1 = blink
 */
export function drawPixelCharacter(
  canvas: HTMLCanvasElement,
  worker: WorkerDef,
  isWorking: boolean,
  frame: number = 0,
  eyeFrame: number = 0
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const s = 3;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Hair
  ctx.fillStyle = worker.hairColor;
  ctx.fillRect(5 * s, 0, 4 * s, 2 * s);
  ctx.fillRect(4 * s, 1 * s, 6 * s, 2 * s);

  // Head/skin
  ctx.fillStyle = worker.skinColor;
  ctx.fillRect(5 * s, 2 * s, 4 * s, 4 * s);

  // Eyes
  ctx.fillStyle = '#000';
  if (eyeFrame === 1) {
    // Blink — horizontal line
    ctx.fillRect(6 * s, 3 * s, s, Math.max(1, Math.floor(s / 3)));
    ctx.fillRect(8 * s, 3 * s, s, Math.max(1, Math.floor(s / 3)));
  } else {
    ctx.fillRect(6 * s, 3 * s, s, s);
    ctx.fillRect(8 * s, 3 * s, s, s);
  }

  // Mouth
  if (isWorking) {
    ctx.fillStyle = '#ff6666';
    ctx.fillRect(7 * s, 5 * s, s, s);
  }

  // Shirt
  ctx.fillStyle = worker.shirtColor;
  ctx.fillRect(4 * s, 6 * s, 6 * s, 4 * s);
  ctx.fillRect(3 * s, 7 * s, 2 * s, 3 * s);
  ctx.fillRect(9 * s, 7 * s, 2 * s, 3 * s);

  // Pants
  ctx.fillStyle = worker.pantsColor;
  ctx.fillRect(4 * s, 10 * s, 3 * s, 3 * s);
  ctx.fillRect(7 * s, 10 * s, 3 * s, 3 * s);

  // Arms — different positions per frame
  ctx.fillStyle = worker.skinColor;
  if (isWorking) {
    // Typing animation: alternate arm positions
    if (frame === 0) {
      // Arms forward mid
      ctx.fillRect(2 * s, 8 * s, 2 * s, 2 * s);
      ctx.fillRect(10 * s, 8 * s, 2 * s, 2 * s);
    } else {
      // Arms forward alternate (slightly different)
      ctx.fillRect(2 * s, 7 * s, 2 * s, 2 * s);
      ctx.fillRect(10 * s, 9 * s, 2 * s, 2 * s);
    }
  } else {
    // Arms down (idle & complete)
    ctx.fillRect(2 * s, 9 * s, 2 * s, 2 * s);
    ctx.fillRect(10 * s, 9 * s, 2 * s, 2 * s);
  }
}
