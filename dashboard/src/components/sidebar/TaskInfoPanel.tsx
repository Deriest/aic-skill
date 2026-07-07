import { AnimatePresence, motion } from 'framer-motion';
import { useDashboard } from '../../context/DashboardContext';
import { useElapsedTime } from '../../hooks/useElapsedTime';

export function TaskInfoPanel() {
  const { state } = useDashboard();
  const elapsed = useElapsedTime(state.taskStartTimestamp);

  return (
    <div className="panel p-4 flex-1 h-full border border-aic-border/50 bg-black/40 backdrop-blur-sm relative z-10">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-aic-accent/50 to-transparent opacity-50" />
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-aic-accent/20 to-transparent opacity-30" />
      <div className="font-pixel text-px-base text-aic-accent mb-4 uppercase tracking-wider flex items-center gap-2" style={{ textShadow: '0 0 8px rgba(0, 212, 255, 0.6)' }}>
        <span className="animate-pulse">▶</span> CURRENT TASK
      </div>
      <AnimatePresence mode="wait">
        {state.currentTask ? (
          <motion.div
            key={state.currentTask.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="font-pixel text-px-base leading-loose"
          >
            <div>
              <span className="text-aic-accent">TASK: </span>
              <span className="text-white">{state.currentTask.title}</span>
            </div>
            <div>
              <span className="text-aic-accent">TYPE: </span>
              <span className="text-white">{state.currentTask.type}</span>
            </div>
            <div>
              <span className="text-aic-accent">ID: </span>
              <span className="text-white">{state.currentTask.id}</span>
            </div>
            <div>
              <span className="text-aic-accent">TIME: </span>
              <span className="text-white">{elapsed}</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="font-pixel text-px-sm text-aic-text-muted"
          >
            NO ACTIVE TASK
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
