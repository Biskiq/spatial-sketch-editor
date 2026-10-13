import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [svelte({ hot: false })],
	resolve: {
		alias: {
			$lib: path.resolve(here, 'src/lib'),
			'@portfolio/layout-core': path.resolve(here, 'kernel/layout-core/src/index.ts'),
			'@portfolio/project-model': path.resolve(here, 'kernel/project-model/src/index.ts'),
			'@portfolio/camera-core': path.resolve(here, 'kernel/camera-core/src/index.ts')
		}
	},
	test: {
		include: ['tests/**/*.{test,spec}.{js,ts}'],
		environment: 'node'
	}
});
