/**
 * P23B.8 follow-up S6 — D5-identity falsifier + verdict parity (attempt).
 *
 * ATTEMPT (plan): store the frozen baseline under a plain (de-proxied)
 * identity so the snap merge reads plain values. Falsifier first:
 * (a) reproduce the proxy read cost on identical values (raw vs `proxy()`
 *     of the same spans — the D4/D5 record's 12.1× finding, unit-level);
 * (b) prove what the production S-R path actually hands the merge
 *     (raw — see `p23b8-d9-dormant-scan`); (c) assert verdict parity
 *     (identical snap outcomes on both identities).
 *
 * LAND only on faster + equivalent; REVERT otherwise (no tuning spiral).
 * Timings here are reported, never gated (perf lane owns timing gates).
 */
import { describe, expect, it } from 'vitest';
import { proxy } from 'svelte/internal/client';

import { buildP23BMatrixFixture, P23B_MATRIX_SPECS } from '$lib/bench/p23b-fixtures';
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

function median(values: readonly number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)] ?? NaN;
}

function digestIndex(index: ReturnType<typeof wallSnapIndex>): string {
	return JSON.stringify(index);
}

describe('p23b.8 S6 — D5-identity falsifier and verdict parity', () => {
	it('reproduces the proxy read cost on identical span values (reported, not gated)', () => {
		const base = curvedGeometry();
		const wallSpans = base.queries.spans.filter((span) => span.kind === 'wall');
		expect(wallSpans.length, 'the all-curved fixture hands wall spans to the merge').toBeGreaterThan(0);
		const rawTimes: number[] = [];
		const proxyTimes: number[] = [];
		let rawDigest = '';
		let proxyDigest = '';
		// Interleaved rounds on fresh clones (wallSnapIndex memoizes per object,
		// so every round is a miss on identical values).
		for (let round = 0; round < 7; round += 1) {
			const raw = structuredClone(base);
			const startedRaw = performance.now();
			rawDigest = digestIndex(wallSnapIndex(raw));
			rawTimes.push(performance.now() - startedRaw);

			const proxied = proxy(structuredClone(base)) as CompiledLayoutGeometry;
			const startedProxy = performance.now();
			proxyDigest = digestIndex(wallSnapIndex(proxied));
			proxyTimes.push(performance.now() - startedProxy);
		}
		// Verdict parity: identical values ⇒ identical snap outcomes, proxy or not.
		expect(proxyDigest, 'proxy-wrapped merge reaches identical snap outcomes').toBe(rawDigest);
		const rawP50 = median(rawTimes);
		const proxyP50 = median(proxyTimes);
		console.info(
			`P23B.8 S6 falsifier — wallSnapIndex on all-curved-40 (7 interleaved rounds, Node ${process.version}): ` +
				`raw p50=${rawP50.toFixed(2)}ms proxy p50=${proxyP50.toFixed(2)}ms ratio=${(proxyP50 / rawP50).toFixed(2)}x`
		);
		for (const value of [...rawTimes, ...proxyTimes]) {
			expect(Number.isFinite(value)).toBe(true);
		}
	});

	it('resolveLayoutSnap reaches identical verdicts on raw and proxy-wrapped geometry', () => {
		const base = curvedGeometry();
		const raw = structuredClone(base);
		const proxied = proxy(structuredClone(base)) as CompiledLayoutGeometry;
		const point: [number, number] = [3, 2];
		const context = { pixelsPerMeter: 100 };
		const rawVerdicts = JSON.stringify(resolveLayoutSnap(raw, point, context));
		const proxyVerdicts = JSON.stringify(resolveLayoutSnap(proxied, point, context));
		expect(proxyVerdicts, 'snap verdicts are identical on both identities').toBe(rawVerdicts);
	});
});
