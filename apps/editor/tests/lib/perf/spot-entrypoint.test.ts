import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('executes the actual vite-node entry point and fails closed without a preview', () => {
	const result = spawnSync(process.execPath, ['../../node_modules/vite-node/vite-node.mjs', 'perf/spot.ts'], {
		cwd: fileURLToPath(new URL('../../../', import.meta.url)),
		env: { ...process.env, PERF_BASE_URL: 'http://127.0.0.1:1' }, encoding: 'utf8', timeout: 15_000
	});
	expect(result.error).toBeUndefined();
	expect(result.status).toBe(1);
	expect(result.stderr).toContain('No preview at http://127.0.0.1:1');
}, 20_000);
