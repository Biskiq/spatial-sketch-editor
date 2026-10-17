/**
 * Caller retirement proof for conditional Save (T3.P01.S02).
 *
 * Source scans are reserved for ownership/caller-retirement facts that no lane
 * report can see (tests README rule 7). The behavioural proof lives in the
 * platform and state suites; this file proves the old unconditional write is
 * gone from the editor and the conditional call is the one client entry point.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { EDITOR_SRC, relativeToRepo } from '../../helpers/import-closure';

function sourceFiles(root: string): string[] {
	const files: string[] = [];
	const pending = [root];
	while (pending.length > 0) {
		const entry = pending.pop()!;
		const stat = statSync(entry);
		if (stat.isDirectory()) {
			for (const child of readdirSync(entry)) pending.push(join(entry, child));
		} else if (entry.endsWith('.ts') || entry.endsWith('.svelte')) {
			files.push(entry);
		}
	}
	return files;
}

describe('conditional Save call sites', () => {
	it('leaves no unconditional saveProject call or bare document body in the editor', () => {
		const files = sourceFiles(EDITOR_SRC);
		expect(files.length).toBeGreaterThan(50);
		const offenders: string[] = [];
		for (const file of files) {
			const source = readFileSync(file, 'utf8');
			if (/\bsaveProject\s*\(/.test(source)) offenders.push(`${relativeToRepo(file)}: saveProject call`);
			if (/JSON\.stringify\(\s*\{\s*document\s*:/.test(source)) {
				offenders.push(`${relativeToRepo(file)}: bare document body`);
			}
		}
		expect(offenders).toEqual([]);
	});

	it('exposes one conditional client entry point', () => {
		const client = relativeToRepo(join(EDITOR_SRC, 'lib', 'platform', 'project-persistence.ts'));
		const source = readFileSync(join(EDITOR_SRC, 'lib', 'platform', 'project-persistence.ts'), 'utf8');
		expect(client).toBe('apps/editor/src/lib/platform/project-persistence.ts');
		expect(source).toContain('saveAcceptedSource');
		expect(source).toContain('readSaveRequest');
		expect(source).not.toMatch(/\bsaveProject\s*\(/);
	});
});
