import { memo } from 'react';
import { FloatingParticles } from './FloatingParticles';

export const CRTOverlay = memo(function CRTOverlay() {
  return (
    <>
      <FloatingParticles />
      {/* Scanlines are handled by body::before in index.css */}
    </>
  );
});
