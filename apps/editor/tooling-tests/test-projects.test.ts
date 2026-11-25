import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { projectForTestFile } from '../../../tools/harness/vitest-projects.mjs';

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const tracked = execFileSync('git', ['ls-files', '-z', 'apps', 'packages'], {
	cwd: repoRoot,
	encoding: 'utf8'
})
	.split('\0')
	.filter((file) => file.endsWith('.test.ts'));

describe('tracked tests belong to a Vitest project', () => {
	it('collects every tracked product test', () => {
		const uncollected = tracked.filter((file) => projectForTestFile(file) === null);
		expect(uncollected).toEqual([]);
	});

	it('rejects a control file outside every project', () => {
		expect(projectForTestFile('apps/editor/src/loose.test.ts')).toBeNull();
		expect(projectForTestFile('packages/project-model/tests/loose.test.ts')).toBe(
			'packages/project-model'
		);
	});
});
