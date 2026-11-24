/**
 * X9 hotspot ratchet. The JSON is the reviewed baseline for each module whose
 * size or reactive surface must not grow without a deliberate edit. Updating a
 * number is a review statement, not a fix: the test fails on any drift.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const BASELINE = JSON.parse(readFileSync(join(ROOT, 'tests/lib/authoring/integration-hotspots.json'), 'utf8')) as Record<
	string,
	Record<string, number>
>;

function measure(source: string) {
	return {
		lines: source.split('\n').length,
		imports: source.match(/^\s*import\b/gm)?.length ?? 0,
		state: source.match(/\$state\b/g)?.length ?? 0,
		derived: source.match(/\$derived\b/g)?.length ?? 0,
		effects: source.match(/\$effect\b/g)?.length ?? 0,
		functions: source.match(/^\s*(?:export\s+)?function\s/gm)?.length ?? 0
	};
}

describe('integration hotspot ratchet', () => {
	it('matches every reviewed baseline', () => {
		for (const [file, expected] of Object.entries(BASELINE)) {
			expect(measure(readFileSync(join(ROOT, file), 'utf8')), file).toEqual(expected);
		}
	});

	it('detects growth in a fresh module (negative control)', () => {
		expect(measure('let n = $state(0);\n')).toMatchObject({ state: 1, lines: 2 });
		expect(measure('export function make() {}\n')).toMatchObject({ functions: 1 });
	});
});
