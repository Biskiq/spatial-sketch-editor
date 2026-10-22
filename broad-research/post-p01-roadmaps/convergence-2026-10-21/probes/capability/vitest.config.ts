// Disposable RR-3/RR-5/RR-6 probe harness. Root is this directory and only `*.probe.ts` runs,
// so no product or prototype suite (which match `tests/**/*.{test,spec}.{js,ts}`) picks these up.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	root: fileURLToPath(new URL('.', import.meta.url)),
	// Keep Vite's cache out of the tracked research tree.
	cacheDir: join(tmpdir(), 'rr3-capability-probes-vite'),
	test: {
		include: ['*.probe.ts'],
		environment: 'node'
	}
});
