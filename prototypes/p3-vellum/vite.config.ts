import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  base: './',
  build: { chunkSizeWarningLimit: 1500, target: 'es2022' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as any);
