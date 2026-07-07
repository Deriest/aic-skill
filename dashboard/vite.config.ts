import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 6969,
    proxy: {
      '/api': {
        target: 'http://localhost:6868',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:6868',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'framer': ['framer-motion'],
          'recharts': ['recharts'],
          'markdown': ['react-markdown', 'react-syntax-highlighter'],
          'router': ['react-router-dom'],
        },
      },
    },
  },
});
