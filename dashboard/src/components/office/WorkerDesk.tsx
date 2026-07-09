import { memo, useRef } from 'react';
import { motion } from 'framer-motion';
import type { WorkerDef } from '../../types';
import { usePixelCanvas } from '../../hooks/usePixelCanvas';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { DeskComputer } from './DeskComputer';
import { StatusBubble } from './StatusBubble';

interface WorkerDeskProps {
  worker: WorkerDef;
  status: string;
  engine?: string | null;
  subWorkerCount?: number;
  subWorkerTotal?: number;
}

const anim: Record<string, any> = {
  idle: { y: [0, -3, 0], rotate: 0, transition: { y: { repeat: Infinity, duration: 1, ease: 'easeInOut' } } },
  working: { y: [0, -2, 0], rotate: [-2, 2, -2], transition: { y: { repeat: Infinity, duration: 0.3 }, rotate: { repeat: Infinity, duration: 0.4 } } },
  complete: { y: 0, rotate: [0, 5, -5, 0], transition: { rotate: { repeat: Infinity, duration: 1.5, delay: 1 } } },
  waiting_pm: { y: [0, -1, 0], rotate: 0, transition: { y: { repeat: Infinity, duration: 2 } } },
  error: { x: [-2, 2, -2, 2, 0], transition: { repeat: Infinity, duration: 0.5 } },
  blocked: { opacity: [1, 0.7, 1], transition: { repeat: Infinity, duration: 1.5 } },
  rework: { x: [-1, 1, -1, 1, 0], transition: { repeat: Infinity, duration: 0.3 } },
};
const reduced: Record<string, any> = {
  idle: { y: 0 }, working: { y: 0 }, complete: { y: 0 }, waiting_pm: { y: 0 }, error: { x: 0 }, blocked: { opacity: 1 }, rework: { x: 0 },
};

const statusConfig: Record<string, { bg: string, text: string, label: string }> = {
  idle: { bg: 'bg-aic-bg-floor', text: 'text-gray-500', label: 'IDLE' },
  working: { bg: 'bg-aic-accent/20', text: 'text-aic-yellow', label: 'WORKING' },
  blocked: { bg: 'bg-aic-bg-floor', text: 'text-red-500', label: 'BLOCKED' },
  error: { bg: 'bg-red-900/30', text: 'text-red-500', label: 'ERROR' },
  complete: { bg: 'bg-aic-green/20', text: 'text-aic-green', label: 'COMPLETE' },
  waiting_pm: { bg: 'bg-purple-900/30', text: 'text-purple-400', label: 'WAITING PM' },
  rework: { bg: 'bg-red-900/30', text: 'text-red-400', label: 'REWORK' },
};

export const WorkerDesk = memo(function WorkerDesk({ worker, status, engine, subWorkerCount, subWorkerTotal }: WorkerDeskProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReduced = useReducedMotion();
  usePixelCanvas(canvasRef, worker, status);

  const cardStyle = status === 'working' ? 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)] bg-amber-900/10'
    : status === 'complete' ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)] bg-green-900/10'
    : status === 'waiting_pm' ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)] bg-purple-900/10'
    : status === 'rework' ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] bg-red-900/10'
    : 'border-blue-400/30 shadow-[0_0_15px_rgba(96,165,250,0.15)] bg-blue-900/5'; // idle (soft blue pulse)

  const showDelegate = worker.id === 'dispatcher' && status === 'working';
  const showOpenCode = worker.id !== 'dispatcher' && status === 'working';
  const conf = statusConfig[status] || statusConfig.idle;

  return (
    <div className={`w-[175px] h-[160px] relative rounded-lg border-2 flex flex-col items-center pt-3 pb-2 transition-all duration-1000 animate-pulse-slow ${cardStyle}`}>
      
      {/* 1. Character + Computer Area (Fixed Height) */}
      <div className="w-full h-[60px] flex flex-col items-center justify-end relative z-10">
        {/* Computer Screen */}
        <DeskComputer status={status} />
        
        {/* Character */}
        <div className="relative">
          {engine && status === 'working' && (
            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
              className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 font-pixel text-[8px] border-2 rounded whitespace-nowrap z-20 ${engine === 'opencode' ? 'bg-[#1a0033] text-[#aa66ff] border-[#aa66ff]' : 'bg-[#001a1a] text-[#00d4ff] border-[#00d4ff]'}`}
              style={{ boxShadow: engine === 'opencode' ? '0 0 8px rgba(170,102,255,0.6)' : '0 0 8px rgba(0,212,255,0.6)' }}>
              {engine === 'opencode' ? '⚡ OPENCODE' : '🧠 DELEGATE'}
            </motion.div>
          )}
          <motion.div className="relative z-10" animate={status} variants={prefersReduced ? reduced : anim} style={{ imageRendering: 'pixelated' }}>
            <canvas ref={canvasRef} width={42} height={45} className="block" />
          </motion.div>
        </div>
      </div>

      {/* 2. Desk Surface (Fixed Height) */}
      {/* 2. Desk Surface (Fixed Height) */}
      <div className="w-[150px] h-[36px] bg-gradient-to-b from-[#4a3728] to-[#3d2d1f] border-3 border-[#2a1f15] relative shrink-0 z-0" style={{ imageRendering: 'pixelated' }}>
        <div className="absolute top-[3px] left-[5px] right-[5px] h-[3px] bg-[#5a4a38]" />
        <StatusBubble status={status} />
      </div>

      {/* 3. Worker Info (Fixed Height) */}
      <div className="h-[28px] w-full flex flex-col items-center justify-center shrink-0">
        <div className="font-pixel text-[11px] text-white tracking-wider leading-none text-center w-full truncate px-1">
          {worker.displayName}
        </div>
        <div className="font-pixel text-[8px] text-gray-400 mt-1 text-center w-full truncate px-1">
          {worker.role}
        </div>
        {subWorkerTotal && subWorkerTotal > 0 && (
           <div className="font-pixel text-[8px] text-aic-accent mt-0.5">{subWorkerCount}/{subWorkerTotal} SUB</div>
        )}
      </div>

      {/* 5. Action Area (Fixed Height) */}
      <div className="h-[20px] w-full flex items-center justify-center gap-1 shrink-0 mt-1">
        {showDelegate && <button className="font-pixel text-[8px] px-2 py-1 rounded border border-aic-yellow shadow-[0_0_5px_rgba(255,204,0,0.5)] text-white bg-black hover:bg-gray-900 w-[80px] transition-colors">DELEGATE</button>}
        {showOpenCode && <button className="font-pixel text-[8px] px-2 py-1 rounded border border-aic-yellow shadow-[0_0_5px_rgba(255,204,0,0.5)] text-white bg-black hover:bg-gray-900 w-[80px] transition-colors">OPENCODE</button>}
      </div>

    </div>
  );
});
