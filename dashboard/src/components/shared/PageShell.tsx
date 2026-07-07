import { motion } from 'framer-motion';

interface PageShellProps {
  title: string;
  children: React.ReactNode;
}

export function PageShell({ title, children }: PageShellProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col h-full"
    >
      <div className="font-pixel text-px-lg text-aic-accent mb-4 tracking-wider" style={{ textShadow: '0 0 10px rgba(0, 212, 255, 0.5)' }}>
        ▸ {title}
      </div>
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </motion.div>
  );
}
