import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber']
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'esnext'
  }
});
