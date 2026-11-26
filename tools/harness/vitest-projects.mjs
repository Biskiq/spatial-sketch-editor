import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * The Vitest project that owns a tracked product test file, or null when no
 * project includes it. Tooling tests have their own editor config outside the
 * root aggregate; package tests are collected from `packages/<name>/tests`.
 */
export function projectForTestFile(file) {
	if (file.startsWith('apps/editor/tests/')) return 'apps/editor';
	if (file.startsWith('apps/editor/tooling-tests/')) return 'apps/editor/vitest.tooling.config.ts';
	const packageTest = /^(packages\/[^/]+)\/tests\//.exec(file);
	if (packageTest && existsSync(path.join(ROOT, packageTest[1], 'vitest.config.ts'))) {
		return packageTest[1];
	}
	return null;
}
