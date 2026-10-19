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
// `svelte()` compile step inside vitest's transform. After PR #115 the only
// surviving rune module the suite reaches is
// `src/lib/visitor/visitor-runtime-state.svelte.ts`.
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const svelteTestSetup = {
	plugins: [
		// Hot-reload off during test so a store's statusMessage auto-clear
		// setTimeout doesn't fire twice in vitest's tick loop.
		svelte({ hot: false })
	],
	resolve: {
		// A component test mounts the browser build of Svelte; without this the
		// SSR entry is resolved and `mount(...)` is unavailable. Node-only modules
		// keep working because `browser` is additive to the default conditions.
		conditions: ['browser'],
		alias: {
			$lib: path.resolve(here, 'src/lib'),
			// Route components import SvelteKit's virtual modules, which plain Vitest
			// does not provide. The mounted-route harness (`spatial-route-source-
			// replacement.test.ts`) needs the real route graph, so these three ids
			// resolve to explicit test doubles instead of failing to resolve. No
			// non-test module imports them.
			'$app/navigation': path.resolve(here, 'tests/lib/authoring/fixtures/app-navigation.ts'),
			'$app/state': path.resolve(here, 'tests/lib/authoring/fixtures/app-state.ts'),
			'$env/dynamic/public': path.resolve(here, 'tests/lib/authoring/fixtures/env-public.ts')
		}
	}
};

/** The complete default test population — every lane is a subset of this. */
export const ALL_TESTS_INCLUDE = ['tests/**/*.{test,spec}.{js,ts}'];
