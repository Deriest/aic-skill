# Pixel Character Animation (2026-07-17)

## Problem
Worker pixel characters (canvas-drawn) were completely static — `drawPixelCharacter()` only draws one frame. Framer Motion animates the outer `<motion.div>` wrapper (y/rotate), but the canvas content itself never changes.

## Solution
Frame-based animation in `usePixelCanvas` hook using `setInterval` + status-dependent speeds.

### Animation Speeds (ms per frame)
| Status | Speed | Behavior |
|--------|-------|----------|
| working | 150ms | Fast arm alternation + blink |
| blocked | 800ms | Arm animation + blink |
| rework | 200ms | Fast arm animation |
| error | 400ms | Arm + blink |
| waiting_pm | 1500ms | Slow blink |
| complete | 1200ms | Very slow blink (badan diam) |
| idle | 3000ms | Very slow blink (mostly static) |

### Frame System (pixelRenderer.ts)
```
frame: 0 = arms neutral, 1 = arms alternate (typing)
eyeFrame: 0 = eyes open, 1 = blink (thin horizontal line)
```

### Architecture
```
WorkerDesk.tsx
  └── <motion.div> (framer-motion: y/rotate bounce) ← DISABLED for idle
       └── <canvas> (pixel character drawn by usePixelCanvas)
            └── drawPixelCharacter(canvas, worker, isWorking, frame, eyeFrame)
```

### Key Files
- `dashboard/src/utils/pixelRenderer.ts` — pixel drawing function with frame + eyeFrame params
- `dashboard/src/hooks/usePixelCanvas.ts` — setInterval-based frame cycling per status
- `dashboard/src/components/office/WorkerDesk.tsx` — framer-motion animation variants

### Framer Motion Variants (WorkerDesk.tsx)
```typescript
const anim = {
  idle: { y: 0, rotate: 0 },  // DIAM — no motion
  working: { y: [0, -4, 0], rotate: [-3, 3, -3], transition: { y: { duration: 0.2 }, rotate: { duration: 0.25 } } },  // CEPAT
  complete: { y: 0, rotate: [0, 3, -3, 0], transition: { rotate: { duration: 2, delay: 1 } } },  // SANTAI
  // ...
};
```

### Pitfalls
- `useReducedMotion()` hook — if system has `prefers-reduced-motion: reduce`, framer-motion uses `reduced` variants (all static). The canvas animation in `usePixelCanvas` is INDEPENDENT of framer-motion and always runs regardless of reduced motion preference.
- Canvas draws once per frame tick — no double buffering needed (42×45px canvas).
- Blink timing: idle/complete blink every ~4 ticks (12s for idle). Working blink every tick (150ms).
