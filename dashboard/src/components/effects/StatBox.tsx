import { useEffect, useRef } from 'react';
import { useSpring, useTransform, motion, useMotionValue } from 'framer-motion';

interface StatBoxProps {
  value: number;
  label: string;
  color: string;
  glowColor: string;
}

function AnimatedNumber({ value, color, glowColor }: { value: number; color: string; glowColor: string }) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 100, damping: 15 });
  const display = useTransform(spring, (v) => Math.round(v));
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      motionValue.set(value);
      prevValueRef.current = value;
    }
  }, [value, motionValue]);

  // Initialize
  useEffect(() => {
    motionValue.set(value);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.span
      className="font-pixel text-px-lg"
      style={{
        color,
        textShadow: `0 0 10px ${glowColor}`,
      }}
    >
      {display}
    </motion.span>
  );
}

export function StatBox({ value, label, color, glowColor }: StatBoxProps) {
  return (
    <div className="bg-aic-bg-floor border-2 border-aic-border p-2 text-center">
      <AnimatedNumber value={value} color={color} glowColor={glowColor} />
      <div className="font-pixel text-px-xs text-aic-text-dim mt-1">{label}</div>
    </div>
  );
}
