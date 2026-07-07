/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'aic': {
          'bg-dark':     '#0f0f23',
          'bg-floor':    '#0a0a1a',
          'bg-panel':    '#1a1a2e',
          'bg-panel-dark': '#0f0f1a',
          'border':      '#2a2a4a',
          'accent':      '#00d4ff',
          'accent2':     '#7c3aed',
          'green':       '#00ff88',
          'yellow':      '#ffcc00',
          'red':         '#ff4444',
          'orange':      '#ff8800',
          'purple':      '#aa66ff',
          'text':        '#e0e0e0',
          'text-dim':    '#6b7280',
          'text-muted':  '#4b5563',
        },
        'status': {
          'idle-bg':     '#1f2937',
          'idle-text':   '#6b7280',
          'idle-border': '#374151',
          'work-bg':     '#1a1a00',
          'work-border': '#ffcc00',
          'done-bg':     '#001a00',
          'done-border': '#00ff88',
          'err-bg':      '#1a0000',
          'err-border':  '#ff4444',
        },
      },
      fontFamily: {
        'pixel': ['"Press Start 2P"', 'monospace'],
      },
      fontSize: {
        'px-xs':    ['6px',  { lineHeight: '10px' }],
        'px-sm':    ['7px',  { lineHeight: '11px' }],
        'px-base':  ['8px',  { lineHeight: '14px' }],
        'px-md':    ['10px', { lineHeight: '16px' }],
        'px-lg':    ['14px', { lineHeight: '20px' }],
        'px-xl':    ['18px', { lineHeight: '24px' }],
      },
      borderWidth: {
        '3': '3px',
        '4': '4px',
      },
      keyframes: {
        'scroll-border': {
          'from': { transform: 'translateX(0)' },
          'to':   { transform: 'translateX(-100px)' },
        },
        'blink-pixel': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
        'screen-glow': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0, 212, 255, 0.3)' },
          '50%':      { boxShadow: '0 0 15px rgba(0, 212, 255, 0.6)' },
        },
        'code-scroll': {
          from: { transform: 'translateY(0)' },
          to:   { transform: 'translateY(-4px)' },
        },
        'bubble-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 204, 0, 0.5)' },
          '50%':      { boxShadow: '0 0 15px rgba(255, 204, 0, 0.8)' },
        },
        'icon-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 204, 0, 0.3)' },
          '50%':      { boxShadow: '0 0 15px rgba(255, 204, 0, 0.6)' },
        },
        'float-particle': {
          '0%':   { transform: 'translateY(100vh) rotate(0deg)', opacity: '0' },
          '10%':  { opacity: '0.3' },
          '90%':  { opacity: '0.3' },
          '100%': { transform: 'translateY(-100vh) rotate(720deg)', opacity: '0' },
        },
      },
      animation: {
        'scroll-border': 'scroll-border 20s linear infinite',
        'blink-pixel':   'blink-pixel 1s infinite',
        'screen-glow':   'screen-glow 2s ease-in-out infinite',
        'code-scroll':   'code-scroll 0.5s linear infinite',
        'bubble-pulse':  'bubble-pulse 0.5s ease-in-out infinite',
        'icon-pulse':    'icon-pulse 1s infinite',
        'float':         'float-particle var(--float-duration, 10s) linear infinite',
      },
      boxShadow: {
        'neon-accent': '0 0 10px rgba(0, 212, 255, 0.5), 0 0 20px rgba(0, 212, 255, 0.3)',
        'neon-green':  '0 0 8px rgba(0, 255, 136, 0.6)',
        'neon-yellow': '0 0 10px rgba(255, 204, 0, 0.5), 0 0 20px rgba(255, 204, 0, 0.3)',
        'neon-red':    '0 0 8px rgba(255, 68, 68, 0.6)',
        'neon-purple': '0 0 10px rgba(124, 58, 237, 0.5)',
      },
      gridTemplateColumns: {
        'office':    'repeat(5, 1fr)',
        'office-md': 'repeat(3, 1fr)',
        'office-sm': 'repeat(2, 1fr)',
      },
    },
  },
  plugins: [],
};
