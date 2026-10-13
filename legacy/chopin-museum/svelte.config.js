import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Frozen Chopin museum — self-contained `kit.alias` mapping of the three
 * `@portfolio/*` kernel specifiers onto the in-folder snapshot, so every
 * frozen source file stays byte-identical to the baseline.
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ runtime: 'nodejs22.x' }),
    alias: {
      '@portfolio/layout-core': path.join(here, 'kernel/layout-core/src/index.ts'),
      '@portfolio/project-model': path.join(here, 'kernel/project-model/src/index.ts'),
      '@portfolio/camera-core': path.join(here, 'kernel/camera-core/src/index.ts')
    }
  }
};

export default config;
