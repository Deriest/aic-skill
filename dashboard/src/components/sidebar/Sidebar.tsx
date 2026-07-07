import { TaskInfoPanel } from './TaskInfoPanel';
import { PipelinePanel } from './PipelinePanel';

export function Sidebar() {
  return (
    <div className="flex flex-col gap-3 h-full">
      <TaskInfoPanel />
      <PipelinePanel />
    </div>
  );
}
