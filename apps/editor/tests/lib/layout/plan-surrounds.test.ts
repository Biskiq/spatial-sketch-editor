/**
 * P23.13 S9 (step 4) — seven-surround check (§9): paper and semantic palette
 * stay constant across all seven shell themes.
 *
 * Minimum review set: navy-blue (darkest default), porcelain-atelier (lightest
 * — the only light identity), electric-plum (most saturated); then all seven
 * by construction (no theme block may override any `--editor-plan-*` token).
 *
 * **T3c consolidation.** Two claims this file used to carry are now owned
 * elsewhere and were removed here:
 *
 * - *theme registry membership* — `tests/lib/editor/theme.test.ts` asserts the
 *   exact `THEME_IDS` list (an 8-id superset including `plate-light`), so a
 *   theme missing from the registry fails there; the same-id `toContain` loop
 *   here was the same defect asserted twice.
 * - *Scene-ink weight* — the per-footprint regime/zone fraction is proven
 *   behaviourally by the A6 paint owner
 *   (`plan-scene-paint`), which fails when `sceneInkFor` stops being
 *   consulted (`§K.3` mutation evidence), so the source-slice copy here was
 *   redundant.
 *
 * What stays is what nothing else asserts: the override *blocks* exist for the
 * six non-default themes, and no theme block may touch a Plan token.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

function readStyleSource(relativePath: string): string {
	return readFileSync(resolve(here, '../../../src/lib', relativePath), 'utf8');
}

const tokens = readStyleSource('editor/styles/tokens.css');
// Theme override blocks only (appended at the end per the file header).
const blocks = tokens.slice(tokens.indexOf('Theme override blocks'));

describe('P23.13 S9 seven surrounds (§9)', () => {
	it('ships an override block for every non-default shell theme', () => {
		// navy-blue is the :root default (no override block); the other six are
		// additive. Registry membership itself is pinned exactly by
		// `tests/lib/editor/theme.test.ts` (`THEME_IDS`).
		for (const id of [
			'salon-espresso',
			'electric-plum',
			'acid-moss',
			'porcelain-atelier',
			'synth-sunset',
			'velvet-kodachrome'
		]) {
			expect(blocks).toContain(`[data-theme='${id}']`);
		}
	});

	it('holds paper and selection constant (no theme block touches plan tokens)', () => {
		expect(tokens).toContain('--editor-plan-bg: #f5f7f8');
		expect(tokens).toContain('--editor-plan-selection: #2f8cff');
		expect(blocks).not.toContain('--editor-plan-');
	});
});
