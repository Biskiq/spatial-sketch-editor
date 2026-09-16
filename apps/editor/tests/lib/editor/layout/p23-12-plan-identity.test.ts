/**
 * P23.12 S7 — Plan and status surfaces (bounded).
 *
 * - Plan Room labels are unchanged (still authored names, still gated by
 *   area/scale/suppression — `p23-6-drafting-pass.test.ts` stays untouched);
 * - the selected-target label consumes the identity contract (name/reference
 *   tier first, kind + metrics separate) and disambiguates duplicates;
 * - no permanent reference label field appears on the canvas;
 * - `.plan-meta` / status lines print no internal selection terminology;
 * - no P23.13 surface is touched (no line weights, symbols, dimension or
 *   collision code changed).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VIEWPORT = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'../../../../src/lib/editor/layout/LayoutPlanViewport.svelte'
);
const PROJECTION = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'../../../../src/lib/editor/layout/plan-overlays.ts'
);

function viewportSource(): string {
	return readFileSync(VIEWPORT, 'utf8');
}

function overlaySource(): string {
	return readFileSync(PROJECTION, 'utf8');
}

describe('P23.12 plan — selected-target identity', () => {
	it('the selection label consumes the identity contract, not internal terms', () => {
		const text = viewportSource();
		// The label leads with the compact reference (ledger documents) and
		// keeps kind + metrics as separate facts.
		expect(text).toContain('{selectedOpeningReference ?? selectedOpening.kind}');
		expect(text).not.toContain('internal');
	});

	it('no permanent reference label field is added to the canvas', () => {
		const text = viewportSource();
		// The only identity text on the canvas is the selection label; there is
		// no per-wall / per-junction reference rendering.
		const matches = text.match(/selection-label|room-name/g) ?? [];
		expect(matches.length).toBeGreaterThan(0);
		expect(text).not.toMatch(/wallReferenceLabel|junctionLabel|permanent.*reference/i);
	});

	it('Room labels stay name-driven in the overlay projection', () => {
		const text = overlaySource();
		expect(text).toContain('room-name');
		expect(text).not.toMatch(/referenceFor|layout-identity/);
	});

	it('no P23.13 surface is touched', () => {
		const text = viewportSource();
		// No new line-weight/symbol/dimension constants or collision code.
		expect(text).not.toMatch(/lineWeight|collisionMargin|dimensionOffset/);
		// The identity import is the only new layout-identity dependency.
		const imports = text.match(/from '\$lib\/layout\/layout-identity';/g) ?? [];
		expect(imports.length).toBe(1);
	});
});
