import { memo } from 'react';

interface DeskComputerProps {
  status: string;
}

export const DeskComputer = memo(function DeskComputer({ status }: DeskComputerProps) {
  const isWorking = status === 'working';
  
  return (
    <div className="absolute -top-12 right-2 flex flex-col items-center">
      {/* Monitor */}
      <div className={`
        w-8 h-6 rounded-sm border-2 z-10 transition-colors
        ${isWorking ? 'bg-aic-bg-dark border-aic-accent shadow-[0_0_10px_rgba(0,255,255,0.4)]' : 'bg-aic-bg-floor border-aic-border/50'}
      `}>
        {/* Screen Content */}
        {isWorking && (
          <div className="w-full h-full flex flex-col justify-evenly p-1 overflow-hidden opacity-80">
            <div className="w-full h-0.5 bg-aic-accent animate-pulse"></div>
            <div className="w-2/3 h-0.5 bg-aic-green"></div>
            <div className="w-1/2 h-0.5 bg-aic-accent"></div>
          </div>
        )}
      </div>
      
      {/* Stand */}
      <div className="w-2 h-2 bg-aic-border/80 z-0"></div>
      
      {/* Keyboard */}
      <div className={`
        w-10 h-1.5 rounded-sm transition-colors
        ${status === 'working' ? 'bg-aic-accent/50' : 'bg-aic-border/50'}
        ${status === 'complete' ? 'bg-aic-green/50' : ''}
      `}></div>
    </div>
  );
});