import { useMemo } from 'react';

interface Particle {
  id: number;
  left: string;
  duration: string;
  delay: string;
}

export function FloatingParticles() {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: 15 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      duration: `${8 + Math.random() * 4}s`,
      delay: `${Math.random() * 10}s`,
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-1 h-1 bg-aic-accent opacity-30 animate-float"
          style={{
            left: p.left,
            width: '4px',
            height: '4px',
            animationDuration: p.duration,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}
