import { memo } from 'react';
import type { WorkerDef } from '../../types';

interface WorkerDeskProps {
  worker: WorkerDef;
  status: 'idle' | 'working' | 'blocked' | 'error';
  engine?: string | null;
}

export const WorkerDesk = memo(function WorkerDesk({ worker, status, engine }: WorkerDeskProps) {
  const isWorking = status === 'working';
  
  return (
    <div className={`relative flex flex-col items-center justify-end p-2 rounded-lg border-2 transition-colors
      ${isWorking ? 'bg-aic-bg-dark border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'bg-aic-bg-dark/50 border-aic-border/30'}
    `}>
      
      {/* Status indicator */}
      <div className={`absolute top-2 right-2 w-3 h-3 rounded-full 
        ${status === 'working' ? 'bg-green-500 shadow-[0_0_8px_#22c55e] animate-pulse' : 
          status === 'idle' ? 'bg-slate-500' : 'bg-red-500'}`} 
      />

      {/* Avatar Box */}
      <div className="w-16 h-16 rounded overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center text-4xl mb-2">
        <span className={isWorking ? 'animate-bounce' : ''}>
          {worker.spriteId === 'pm' ? '📋' : 
           worker.spriteId === 'researcher' ? '🔍' :
           worker.spriteId === 'designer' ? '🎨' :
           worker.spriteId === 'architect' ? '📐' :
           worker.spriteId === 'frontend' ? '🖥️' :
           worker.spriteId === 'backend' ? '⚙️' :
           worker.spriteId === 'infra' ? '☁️' :
           worker.spriteId === 'qa' ? '🧪' :
           worker.spriteId === 'governor' ? '⚖️' :
           worker.spriteId === 'dispatcher' ? '🎛️' : '👤'}
        </span>
      </div>

      {/* Info */}
      <div className="text-center w-full">
        <div className="font-pixel text-px-sm text-aic-text-bright truncate">
          {worker.name}
        </div>
        <div className="font-pixel text-[10px] text-aic-text-muted mt-1 truncate">
          {engine || worker.role}
        </div>
      </div>
    </div>
  );
});