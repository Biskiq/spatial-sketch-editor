// RR-4 disposable probe config. Root is this directory, so no repository suite
// (apps/editor `tests/**/*.{test,spec}`, prototypes `tests/**/*.test.ts`) picks
// these `*.probe.ts` files up, and this config picks up nothing else.
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));
const editor = path.resolve(here, '../../../../../apps/editor');

export default defineConfig({
	root: here,
	// Keep Vite's cache out of the tracked research tree.
	cacheDir: path.join(tmpdir(), 'rr4-relationship-probes-vite'),
	resolve: { alias: { $lib: path.resolve(editor, 'src/lib') } },
	test: { include: ['*.probe.ts'], environment: 'node' }
});
