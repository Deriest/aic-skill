import { useEffect, MutableRefObject } from 'react';
import type { WorkerDef } from '../types';
import { drawPixelCharacter } from '../utils/pixelRenderer';

export function usePixelCanvas(
  canvasRef: MutableRefObject<HTMLCanvasElement | null>,
  worker: WorkerDef,
  status: string
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPixelCharacter(canvas, worker, status === 'working');
  }, [canvasRef, worker, status]);
}