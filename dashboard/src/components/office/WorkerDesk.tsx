import { memo, useRef } from 'react';
import { motion } from 'framer-motion';
import type { WorkerDef, WorkerState } from '../../types';
import { usePixelCanvas } from '../../hooks/usePixelCanvas';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { StatusBubble } from './StatusBubble';
import { DeskComputer } from './DeskComputer';

interface WorkerDeskProps {
  worker: WorkerDef;
  status: WorkerState['status'];
  engine?: string | null;
}

const characterAnimations = {
  idle: {
    y: [0, -3, 0],
    rotate: 0,
    transition: { y: { repeat: Infinity, duration: 1, ease: 'easeInOut' as const } },
  },
  working: {
    y: [0, -2, 0],
    rotate: [-2, 2, -2],
    transition: {
      y: { repeat: Infinity, duration: 0.3, ease: 'easeInOut' as const },
      rotate: { repeat: Infinity, duration: 0.3, ease: 'easeInOut' as const },
    },
  },
  complete: {
    y: [0, -10, 0],
    scale: [1, 1.15, 1],
    rotate: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
  error: {
    x: [0, -4, 4, -4, 0],
    rotate: 0,
    transition: { duration: 0.2 },
  },
};

const reducedMotion = {
  idle: { y: 0, rotate: 0 },
  working: { y: 0, rotate: 0 },
  complete: { y: 0, scale: 1, rotate: 0 },
  error: { x: 0, rotate: 0 },
};

export const WorkerDesk = memo(function WorkerDesk({ worker, status, engine }: WorkerDeskProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReduced = useReducedMotion();

  usePixelCanvas(canvasRef, worker, status);

  const handleClick = () => {};

  return (
    <div
      className={`pixel-desk flex flex-col items-center p-2 rounded-lg border transition-all duration-300 ${
        status === 'working'
          ? 'border-aic-yellow shadow-[0_0_15px_rgba(255,255,0,0.15)] bg-aic-bg-panel/40 animate-pulse'
          : status === 'complete'
          ? 'border-aic-green shadow-[0_0_15px_rgba(0,255,136,0.15)] bg-aic-bg-panel/40 animate-pulse'
          : 'border-gray-500/30 shadow-[0_0_10px_rgba(128,128,128,0.1)] bg-aic-bg-panel/20 animate-pulse opacity-80 hover:opacity-100'
      }`}
      onClick={handleClick}
    >
      {/* Desk Computer */}
      <DeskComputer status={status} />

      {/* Pixel Character */}
      <div className="relative">
        {engine && status === 'working' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 font-pixel text-[8px] border-2 rounded whitespace-nowrap z-10 ${
              engine === 'opencode'
                ? 'bg-[#1a0033] text-[#aa66ff] border-[#aa66ff]'
                : 'bg-[#001a1a] text-[#00d4ff] border-[#00d4ff]'
            }`}
            style={{
              boxShadow: engine === 'opencode'
                ? '0 0 8px rgba(170, 102, 255, 0.6)'
                : '0 0 8px rgba(0, 212, 255, 0.6)',
            }}
          >
            {engine === 'opencode' ? '⚡ OPENCODE' : '🧠 DELEGATE'}
          </motion.div>
        )}

        <motion.div
          className="relative"
          animate={status}
          variants={prefersReduced ? reducedMotion : characterAnimations}
          style={{ imageRendering: 'pixelated' }}
        >
          <canvas ref={canvasRef} width={42} height={45} className="block" />
        </motion.div>
      </div>

      {/* Desk Surface — also hosts the on-desk StatusBubble */}
      <div className="w-full h-[40px] bg-gradient-to-b from-[#4a3728] to-[#3d2d1f] border-3 border-[#2a1f15] relative" style={{ imageRendering: 'pixelated' }}>
        <div className="absolute top-[3px] left-[5px] right-[5px] h-[3px] bg-[#5a4a38]" />
        <StatusBubble status={status} />
      </div>

      {/* Chair */}
      <div className="w-6 h-4 bg-[#2a2a3a] border-2 border-[#1a1a2a] rounded-t-[3px]" />

      {/* Label */}
      <div className="text-center mt-2 font-pixel text-px-base text-[#ccc]">
        {worker.displayName ?? worker.name}
        <div className="text-px-sm text-[#888] mt-1">{worker.role}</div>
        <div className="text-px-sm text-aic-accent mt-0.5 font-bold">{worker.model}</div>
      </div>
    </div>
  );
});
