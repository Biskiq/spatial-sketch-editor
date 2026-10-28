import { execFileSync } from 'node:child_process';
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    version: { name: (() => {
      try {
        const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
        const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8' }).trim();
        return revision + (dirty ? '-dirty' : '');
      } catch { return 'unverified'; }
    })() },
    adapter: adapter({ runtime: 'nodejs22.x' })
  }
};

export default config;