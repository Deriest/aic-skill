import { AnimatePresence, motion } from 'framer-motion';
import { useDashboard } from '../../context/DashboardContext';
import { useElapsedTime } from '../../hooks/useElapsedTime';

export function TaskInfoPanel() {
  const { state } = useDashboard();
  const elapsed = useElapsedTime(state.taskStartTimestamp);

  return (
    <div className="panel p-3 flex-1">
      <div className="font-pixel text-px-base text-aic-accent mb-2.5 uppercase tracking-wide" style={{ textShadow: '0 0 5px rgba(0, 212, 255, 0.5)' }}>
        ▸ CURRENT TASK
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
