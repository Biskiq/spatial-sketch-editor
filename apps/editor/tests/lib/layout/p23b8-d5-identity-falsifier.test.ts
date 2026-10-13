/**
 * P23B.8 follow-up S6 — D5-identity falsifier + verdict parity (attempt).
 *
 * ATTEMPT (plan): store the frozen baseline under a plain (de-proxied)
 * identity so the snap merge reads plain values. The surviving guarantee is
 * verdict parity: identical snap outcomes (and identical `resolveLayoutSnap`
 * verdicts) on both identities.
 *
 * PR #115 (§7.2 category A″) deleted the measurement apparatus this file used
 * to report proxy read cost: timing and observation-count assertions are gone
 * with the PERF lane. What remains is the identity half — identical snap
 * outcomes and identical snap verdicts on raw and proxy-wrapped geometry.
 */
import { describe, expect, it } from 'vitest';
import { proxy } from 'svelte/internal/client';

import { buildP23BMatrixFixture, P23B_MATRIX_SPECS } from './__fixtures__/p23b-fixtures';
import {
	compileWallFirstLayoutGeometry,
	resolveLayoutSnap,
	wallSnapIndex,
	type CompiledLayoutGeometry
} from '@portfolio/layout-core';

function curvedGeometry(): CompiledLayoutGeometry {
	const spec = P23B_MATRIX_SPECS.find((entry) => entry.id === 'p23b-40-wall-all-curved-v1');
	if (!spec) throw new Error('all-curved fixture spec missing');
	const result = compileWallFirstLayoutGeometry(buildP23BMatrixFixture(spec));
	return result.geometry;
}

function digestIndex(index: ReturnType<typeof wallSnapIndex>): string {
	return JSON.stringify(index);
}

describe('p23b.8 S6 — D5-identity falsifier and verdict parity', () => {
	it('reaches identical snap outcomes on identical span values (raw and proxy-wrapped)', () => {
		const base = curvedGeometry();
		const wallSpans = base.queries.spans.filter((span) => span.kind === 'wall');
		expect(wallSpans.length, 'the all-curved fixture hands wall spans to the merge').toBeGreaterThan(0);
		// Verdict parity: identical values ⇒ identical snap outcomes, proxy or not.
		// `wallSnapIndex` memoizes per object, so both reads are cold on fresh clones.
		const rawDigest = digestIndex(wallSnapIndex(structuredClone(base)));
		const proxyDigest = digestIndex(
			wallSnapIndex(proxy(structuredClone(base)) as CompiledLayoutGeometry)
		);
		expect(proxyDigest, 'proxy-wrapped merge reaches identical snap outcomes').toBe(rawDigest);
	});

	it(
		'resolveLayoutSnap reaches identical verdicts on raw and proxy-wrapped geometry',
		() => {
			const base = curvedGeometry();
			const raw = structuredClone(base);
			const proxied = proxy(structuredClone(base)) as CompiledLayoutGeometry;
			const point: [number, number] = [3, 2];
			const context = { pixelsPerMeter: 100 };
			const rawVerdicts = JSON.stringify(resolveLayoutSnap(raw, point, context));
			const proxyVerdicts = JSON.stringify(resolveLayoutSnap(proxied, point, context));
			expect(proxyVerdicts, 'snap verdicts are identical on both identities').toBe(rawVerdicts);
		},
		120_000
	);
});
