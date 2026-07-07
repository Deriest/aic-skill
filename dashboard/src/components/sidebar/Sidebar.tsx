import { TaskInfoPanel } from './TaskInfoPanel';
import { PipelinePanel } from './PipelinePanel';

export function Sidebar() {
  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex-1 min-h-0 relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-b from-aic-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded" />
        <TaskInfoPanel />
      </div>
      <div className="flex-[2] min-h-0 relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-b from-aic-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded" />
        <PipelinePanel />
      </div>
    </div>
  );
}
