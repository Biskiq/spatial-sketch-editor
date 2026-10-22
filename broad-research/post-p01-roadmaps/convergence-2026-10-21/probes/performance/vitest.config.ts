// Disposable performance probe config (convergence 2026-10-21). Root is this
// directory and only `*.probe.ts` runs, so no product or prototype suite
// (`tests/**/*.{test,spec}.{js,ts}`) picks these up, and this config picks up
// nothing else. One forked process with `--expose-gc` so heap deltas can be
// taken after a forced collection; files run sequentially so timings never
// contend with another probe.
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));
const editor = path.resolve(here, '../../../../../apps/editor');

export default defineConfig({
	root: here,
	// Keep Vite's cache out of the tracked research tree.
	cacheDir: path.join(tmpdir(), 'convergence-performance-probes-vite'),
	resolve: { alias: { $lib: path.resolve(editor, 'src/lib') } },
	test: {
		include: ['*.probe.ts'],
		environment: 'node',
		pool: 'forks',
		poolOptions: { forks: { singleFork: true, execArgv: ['--expose-gc'] } },
		fileParallelism: false,
		testTimeout: 600_000,
		hookTimeout: 600_000
	}
});
