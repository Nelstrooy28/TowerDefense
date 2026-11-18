import { defineConfig } from 'vite';

export default defineConfig({
  base: '/TowerDefense/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
});
