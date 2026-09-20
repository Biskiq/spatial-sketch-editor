// Shared vitest settings for every lane config.
//
// The Svelte plugin and `$lib` alias must be identical across the default
// `npm test` config and the lane configs, or a lane would silently run a
// different module graph. Keep this the single source of truth.
//
// Why the alias exists at all: Vitest does NOT inherit SvelteKit's `$lib`
// alias from vite.config.ts automatically (SvelteKit 2.x registers it for
// `vite dev`/`vite build` but vitest's Vite instance does not pick it up).
// Why the plugin exists: `.svelte.ts` files using Svelte 5 runes need the
// `svelte()` compile step inside vitest's transform.
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const svelteTestSetup = {
	plugins: [
		// Hot-reload off during test so EditorSessionState's statusMessage
		// auto-clear setTimeout doesn't fire twice in vitest's tick loop.
		svelte({ hot: false })
	],
	resolve: {
		alias: {
			$lib: path.resolve(here, 'src/lib')
		}
	}
};

/** The complete default test population — every lane is a subset of this. */
export const ALL_TESTS_INCLUDE = ['tests/**/*.{test,spec}.{js,ts}'];
