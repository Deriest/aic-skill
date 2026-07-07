import { useEffect, useRef, useCallback } from 'react';
import { drawPixelCharacter } from '../utils/pixelRenderer';
import type { WorkerDef, WorkerState } from '../types';

export function usePixelCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  worker: WorkerDef,
  status: WorkerState
) {
  const prevStatusRef = useRef<WorkerState>(status);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const isWorking = status === 'working';
    drawPixelCharacter(canvas, worker, isWorking);
  }, [canvasRef, worker, status]);

  useEffect(() => {
    // Redraw on status change
    if (prevStatusRef.current !== status) {
      prevStatusRef.current = status;
    }
    draw();
  }, [status, draw]);
}
