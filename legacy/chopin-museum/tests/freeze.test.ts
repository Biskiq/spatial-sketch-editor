import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

type FreezeRecord = {
	sourceBaseline: string;
	files: { baselinePath: string; frozenPath: string; sha256: string }[];
	adaptedOrNew: { frozenPath: string; reason: string }[];
};

const freeze: FreezeRecord = JSON.parse(readFileSync(path.join(root, 'FREEZE.json'), 'utf8'));

describe('freeze contract', () => {
	it('records an immutable baseline commit', () => {
		expect(freeze.sourceBaseline).toMatch(/^[0-9a-f]{40}$/);
	});

	it('keeps every frozen source file byte-identical to the baseline', () => {
		const drifted: string[] = [];
		for (const file of freeze.files) {
			const target = path.join(root, file.frozenPath);
			if (!existsSync(target)) {
				drifted.push(`${file.frozenPath} (missing)`);
				continue;
			}
			const actual = createHash('sha256').update(new Uint8Array(readFileSync(target))).digest('hex');
			if (actual !== file.sha256) drifted.push(`${file.frozenPath} (sha256 ${actual} != ${file.sha256})`);
		}
		expect(drifted).toEqual([]);
	});

	it('lists a reason for every adapted or new file', () => {
		expect(freeze.adaptedOrNew.length).toBeGreaterThan(0);
		for (const entry of freeze.adaptedOrNew) expect(entry.reason.length).toBeGreaterThan(0);
	});
});
