/**
 * P23B.8 pre-work — the DEV input probe on the Wall snap derivation.
 *
 * The probe is the instrument that made the slice's D5 result measurable, so the
 * contract to pin is exact and small:
 *
 * - it is INERT unless `globalThis.__P2311_SNAP_INPUT_PROBE__` is set — and,
 *   critically, it is NOT enabled by `__P2311_PERF__`, so a recorded capture can
 *   never switch it on;
 * - one entry per CACHE MISS, never per call: the memoized index means a
 *   repeated `wallSnapIndex` on the same geometry records nothing more;
 * - the entry states the input shape (spans, walls, endpoints per wall) and both
 *   durations on identical data, and the derivation's own RESULT is unaffected.
 *
 * Timing is asserted only for finiteness and sign. A duration is never compared
 * to a threshold here: this suite pins what the probe REPORTS, not how fast any
 * machine ran.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { compileWallFirstLayoutGeometry, wallSnapIndex } from '@portfolio/layout-core';
import { P23B_MATRIX_SPECS, buildP23BMatrixFixture } from '$lib/bench/p23b-fixtures';

type ProbeGlobal = {
	__P2311_PERF__?: boolean;
	__P2311_SNAP_INPUT_PROBE__?: boolean;
	__P2311_SNAP_INPUT_LOG__?: unknown[];
};

const gate = globalThis as ProbeGlobal;

function curvedGeometry() {
	const spec = P23B_MATRIX_SPECS.find((entry) => entry.id === 'p23b-12-wall-all-curved-v1');
	if (!spec) throw new Error('the 12-wall all-curved matrix fixture is missing');
	const result = compileWallFirstLayoutGeometry(buildP23BMatrixFixture(spec));
	if (result.issues.length > 0) throw new Error('the all-curved fixture did not compile');
	return result.geometry;
}

beforeEach(() => {
	delete gate.__P2311_PERF__;
	delete gate.__P2311_SNAP_INPUT_PROBE__;
	delete gate.__P2311_SNAP_INPUT_LOG__;
});

afterEach(() => {
	delete gate.__P2311_PERF__;
	delete gate.__P2311_SNAP_INPUT_PROBE__;
	delete gate.__P2311_SNAP_INPUT_LOG__;
});

describe('P23B snap-input probe', () => {
	it('is inert by default, even with the perf gate on', () => {
		gate.__P2311_PERF__ = true;
		const geometry = curvedGeometry();
		wallSnapIndex(geometry);
		wallSnapIndex(geometry);
		expect(gate.__P2311_SNAP_INPUT_LOG__).toBeUndefined();
	});

	it('records one entry per cache miss, with the input shape and both arms', () => {
		gate.__P2311_SNAP_INPUT_PROBE__ = true;
		const geometry = curvedGeometry();
		const before = gate.__P2311_SNAP_INPUT_LOG__ === undefined;

		const derived = wallSnapIndex(geometry);
		// The memo is the reason a capture reports one derivation per gesture: the
		// second call on the same identity must add no second entry.
		wallSnapIndex(geometry);

		const log = gate.__P2311_SNAP_INPUT_LOG__ as {
			spans: number;
			walls: number;
			maxEndpointsPerWall: number;
			endpointsP50: number;
			givenMs: number;
			plainMs: number | null;
		}[];
		expect(before).toBe(true);
		expect(log).toHaveLength(1);
		const entry = log[0]!;
		// The same wall spans the derivation was handed, counted the way the probe
		// counts them: one entry per span, two endpoints per entry.
		expect(entry.spans).toBe(geometry.queries.spans.filter((span) => span.kind === 'wall').length);
		expect(entry.walls).toBeGreaterThan(0);
		expect(entry.spans).toBeGreaterThan(entry.walls);
		expect(entry.maxEndpointsPerWall).toBeGreaterThanOrEqual(entry.endpointsP50);
		expect(entry.endpointsP50).toBeGreaterThan(0);
		expect(entry.givenMs).toBeGreaterThanOrEqual(0);
		// The plain arm is the same values in a JSON copy: either a finite duration
		// or `null` when that arm could not be built. Never a negative number.
		expect(entry.plainMs === null || entry.plainMs >= 0).toBe(true);
		// The probe observes; it must not change what the derivation returns.
		expect(derived.walls.length).toBe(entry.walls);
	});
});
