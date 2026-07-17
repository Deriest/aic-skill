import { useEffect, useRef, MutableRefObject } from 'react';
import type { WorkerDef } from '../types';
import { drawPixelCharacter } from '../utils/pixelRenderer';

// Animation speeds per status (ms between frames)
const TICK: Record<string, number> = {
  working: 150,   // fast typing animation
  complete: 1200, // slow blink
  idle: 3000,     // very slow blink (mostly static)
  blocked: 800,
  error: 400,
  rework: 200,
  waiting_pm: 1500,
};

export function usePixelCanvas(
  canvasRef: MutableRefObject<HTMLCanvasElement | null>,
  worker: WorkerDef,
  status: string
) {
  const frameRef = useRef(0);
  const eyeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Clear any previous interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const isWorking = status === 'working';
    const tick = TICK[status] || TICK.idle;

    // Initial draw
    frameRef.current = 0;
    eyeRef.current = 0;
    drawPixelCharacter(canvas, worker, isWorking, frameRef.current, eyeRef.current);

    // Idle/complete: only blink occasionally, no arm movement
    if (status === 'idle' || status === 'complete') {
      let blinkCounter = 0;
      intervalRef.current = setInterval(() => {
        blinkCounter++;
        // Blink every ~4 ticks
        if (blinkCounter % 4 === 0) {
          eyeRef.current = 1;
          drawPixelCharacter(canvas, worker, false, 0, 1);
          // Eyes open again after short delay
          setTimeout(() => {
            eyeRef.current = 0;
            drawPixelCharacter(canvas, worker, false, 0, 0);
          }, 100);
        }
      }, tick);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }

    // Working/blocked/rework/error: animate arms + blink
    intervalRef.current = setInterval(() => {
      // Alternate arm frames for working
      if (isWorking) {
        frameRef.current = frameRef.current === 0 ? 1 : 0;
      }
      // Blink cycle
      eyeRef.current = eyeRef.current === 0 ? 1 : 0;
      drawPixelCharacter(canvas, worker, isWorking, frameRef.current, eyeRef.current);
    }, tick);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [canvasRef, worker, status]);
}
