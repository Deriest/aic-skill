interface ConnectionIndicatorProps {
  connected: boolean;
}

export function ConnectionIndicator({ connected }: ConnectionIndicatorProps) {
  return (
    <div className="flex items-center gap-3 font-pixel text-px-md">
      <div
        className="w-3 h-3 animate-blink-pixel"
        style={{
          background: connected ? '#00ff88' : '#ff4444',
          boxShadow: `0 0 8px ${connected ? '#00ff88' : '#ff4444'}`,
          imageRendering: 'pixelated',
        }}
      />
      <span style={{ color: connected ? '#00ff88' : '#ff4444' }}>
        {connected ? 'ONLINE' : 'OFFLINE'}
      </span>
    </div>
  );
}
