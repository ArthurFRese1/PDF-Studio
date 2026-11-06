import { defineConfig } from 'vite';

// base './' faz o build funcionar em qualquer subcaminho (ex.: GitHub Pages de projeto).
export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 2500,
  },
  optimizeDeps: {
    esbuildOptions: { target: 'esnext' },
  },
  worker: { format: 'es' },
});
