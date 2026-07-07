import type { WorkerState } from '../../types';

interface DeskComputerProps {
  status: WorkerState;
}

export function DeskComputer({ status }: DeskComputerProps) {
  const isWorking = status === 'working';

  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 w-10 h-[30px] bg-[#1a1a1a] border-3 border-[#333] flex items-center justify-center"
      style={{ imageRendering: 'pixelated', marginBottom: '0px' }}
    >
      {/* Screen */}
      <div
        className={`w-[28px] h-[18px] border-2 border-[#222] relative overflow-hidden ${
          isWorking ? 'bg-[#002244]' : 'bg-[#001122]'
        } ${status !== 'idle' ? 'animate-screen-glow' : ''}`}
      >
        {/* Code scroll effect when working */}
        {isWorking && (
          <div
            className="absolute top-[2px] left-[2px] right-[2px] bottom-[2px] animate-code-scroll"
            style={{
              background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0, 255, 136, 0.3) 2px, rgba(0, 255, 136, 0.3) 4px)',
            }}
          />
        )}
        {/* Green flash when complete */}
        {status === 'complete' && (
          <div className="absolute inset-0 bg-[#00ff88] opacity-30" />
        )}
        {/* Red flash when error */}
        {status === 'error' && (
          <div className="absolute inset-0 bg-[#ff4444] opacity-40 animate-pulse" />
        )}
      </div>
    </div>
  );
}
