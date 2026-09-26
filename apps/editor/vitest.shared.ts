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
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'svelte/compiler';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sveltePackageRoot = path.dirname(require.resolve('svelte/package.json'));
const clientMountedSvelte = new Set([
	path.resolve(here, 'src/lib/editor/layout/LayoutPreviewScene.svelte'),
	path.resolve(here, 'tests/lib/editor/layout/p23b6-layout-preview-scene-mount-harness.svelte')
]);

const clientMountTestCompiler = {
	name: 'p23b6-client-mount-test-compiler',
	enforce: 'post' as const,
	transform(_code: string, id: string) {
		const filename = path.resolve(id.split('?')[0] ?? id);
		if (!clientMountedSvelte.has(filename)) return;
		const source = fs.readFileSync(filename, 'utf8');
		const result = compile(source, { filename, generate: 'client' });
		// This test observes adapter ownership only; keep the optional PERF marks off.
		return { code: result.js.code.replaceAll('import.meta.env.DEV &&', 'false &&'), map: null };
	}
};

export const svelteTestSetup = {
	plugins: [
		// Hot-reload off during test so EditorSessionState's statusMessage
		// auto-clear setTimeout doesn't fire twice in vitest's tick loop.
		svelte({ hot: false }),
		clientMountTestCompiler
	],
	resolve: {
		alias: {
			$lib: path.resolve(here, 'src/lib'),
			// One integration test mounts a real Svelte scene in Node. Keep the
			// client entry opt-in through a test-only alias; ordinary node tests
			// continue resolving `svelte` to its server entry.
			'svelte-client-runtime': path.join(sveltePackageRoot, 'src/index-client.js')
		}
	}
};

/** The complete default test population — every lane is a subset of this. */
export const ALL_TESTS_INCLUDE = ['tests/**/*.{test,spec}.{js,ts}'];
