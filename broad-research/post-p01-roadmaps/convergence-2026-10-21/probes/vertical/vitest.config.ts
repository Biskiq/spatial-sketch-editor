// Disposable RR-1/RR-2 probe harness. Root is this directory and only `*.probe.ts` runs,
// so no product or prototype suite (which match `tests/**/*.test.ts`) ever picks these up.
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	root: fileURLToPath(new URL('.', import.meta.url)),
	// keep Vite's cache out of the repository
	cacheDir: `${tmpdir()}/rr12-vertical-probe-cache`,
	test: {
		include: ['*.probe.ts'],
		environment: 'node'
	}
});
