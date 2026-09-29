import { describe, expect, it } from 'vitest';

import {
	summarizeCpuProfile,
	summarizeCpuProfileWindows,
	P23B_M1_CPU_PROFILE_DEFINITION,
	type P23BM1CpuProfile
} from '$lib/bench/p23b-m1-cpu-profile';

/**
 * The profile's own clock convention, restated here as an executable fact: sample
 * `i` happens `timeDeltas[i]` after sample `i − 1`, and the FIRST delta is counted
 * from `startTime`. These fixtures are written in that convention so a row's
 * `selfMs` can be checked by hand.
 */
function profileOf(input: {
	startMs: number;
	frames: { id: number; name?: string; url?: string; line?: number; column?: number }[];
	/** [nodeId, deltaUs] per sample, in order. */
	samples: [number, number][];
}): P23BM1CpuProfile {
	let atUs = input.startMs * 1000;
	for (const [, delta] of input.samples) atUs += delta;
	return {
		startTime: input.startMs * 1000,
		endTime: atUs,
		nodes: input.frames.map((frame) => ({
			id: frame.id,
			callFrame: {
				functionName: frame.name ?? '',
				url: frame.url ?? '',
				lineNumber: frame.line ?? 0,
				columnNumber: frame.column ?? 0
			}
		})),
		samples: input.samples.map(([id]) => id),
		timeDeltas: input.samples.map(([, delta]) => delta)
	};
}

describe('p23b-m1-cpu-profile summary', () => {
	it('prices max concurrent with each sample\u2019s own delta, not the span that contains them', () => {
		// THE POINT OF THE INSTRUMENT. The trace row for the outer function is the
		// span it CONTAINS (40 ms); the profile row is what that function itself ran.
		const summary = summarizeCpuProfile({
			profile: profileOf({
				startMs: 1_000,
				frames: [
					{ id: 1, name: 'flush', url: 'http://x/deps/chunk-A.js', line: 10, column: 2 },
					{ id: 2, name: 'work', url: 'http://x/app/commit.ts', line: 3, column: 0 }
				],
				samples: [
					[1, 5_000],
					[2, 20_000],
					[2, 15_000]
				]
			}),
			windows: [],
			markerTraceMs: null,
			samplingIntervalUs: 1000
		});
		// Every sample carries its own delta: `flush` holds 5 ms of the 40 ms span,
		// `work` holds 35 ms of it.
		expect(summary.topSelfTime.map((row) => [row.functionName, row.selfMs])).toEqual([
			['work', 35],
			['flush', 5]
		]);
		expect(summary.totalSamples).toBe(3);
		expect(summary.profileMs).toBe(40);
	});

	it('keys rows by definition site, keeps v8\u2019s built-in frames, and names an anonymous frame', () => {
		const summary = summarizeCpuProfile({
			profile: profileOf({
				startMs: 0,
				frames: [
					{ id: 1, url: 'http://x/deps/chunk-A.js', line: 120, column: 4 },
					{ id: 2, url: 'http://x/deps/chunk-A.js', line: 900, column: 12 },
					{ id: 3, name: '(garbage collector)', url: '' },
					{ id: 4, name: '(program)', url: '' }
				],
				samples: [
					[1, 30_000],
					[2, 10_000],
					[3, 5_000],
					[4, 5_000]
				]
			}),
			windows: [],
			markerTraceMs: null,
			samplingIntervalUs: 1000
		});
		const anonymous = summary.topSelfTime.filter((row) => row.functionName === '(anonymous)');
		// Two anonymous functions in ONE chunk are two rows, because the site is part
		// of the key — without it the largest row in the run's every class would have
		// been a single merged "some anonymous function in chunk so-and-so".
		expect(anonymous.map((row) => row.lineNumber)).toEqual([120, 900]);
		expect(anonymous[0]!.script).toBe('deps/chunk-A.js');
		// The built-ins are kept as rows: native and idle time the timeline cannot see
		// is what this instrument exists to make visible.
		expect(summary.topSelfTime.map((row) => row.functionName)).toContain('(garbage collector)');
		expect(summary.topSelfTime.map((row) => row.functionName)).toContain('(program)');
	});

	it('slices samples into a class only when their instant falls inside one of its windows', () => {
		const summary = summarizeCpuProfile({
			profile: profileOf({
				startMs: 100,
				frames: [
					{ id: 1, name: 'early', url: 'http://x/a.ts', line: 1 },
					{ id: 2, name: 'inA', url: 'http://x/a.ts', line: 2 },
					{ id: 3, name: 'inB', url: 'http://x/a.ts', line: 3 },
					{ id: 4, name: 'late', url: 'http://x/a.ts', line: 4 }
				],
				// Sample instants: 110, 210, 310, 410, 510, 610 ms.
				samples: [
					[1, 10_000],
					[2, 100_000],
					[3, 100_000],
					[4, 100_000],
					[1, 100_000]
				]
			}),
			// A window on the trace clock: 300 → 500 ms holds exactly two samples
			// (the ones at 310 and 410); 210 is before it and 510 after it.
			windows: [{ key: 'f/drag', actionIndex: 0, startMs: 300, endMs: 500 }],
			markerTraceMs: null,
			samplingIntervalUs: 500
		});
		expect(summary.classes).toHaveLength(1);
		const [row] = summary.classes;
		expect(row.key).toBe('f/drag');
		expect(row.windows).toBe(1);
		// Each sample is priced by its own delta, so the two 100 ms deltas inside the
		// window are 200 ms of sampled time.
		expect(row.sampledInWindowMs).toBe(200);
		// The samples at 310 and 410 are `inB` and `late`; `inA` at 210 and `early`
		// at 510 are outside the window and appear in no class row at all.
		expect(row.topSelfTime.map((entry) => [entry.functionName, entry.selfMs])).toEqual([
			['inB', 100],
			['late', 100]
		]);
	});

	it('slices by the caller’s own bucket key, so one walk serves the class and the arm split', () => {
		// THE ARM SPLIT'S HALF OF THIS INSTRUMENT. Two arms of the same class are two
		// windows with DIFFERENT keys, and each must be its own bucket: a sample belongs
		// to exactly one, and the bucket key is the caller's — the runner passes
		// `arm::class` so the arm rows can be parsed back out of the class they came
		// from.
		const input = {
			profile: profileOf({
				startMs: 100,
				frames: [
					{ id: 1, name: 'grid', url: 'http://x/plan-room-labels.ts', line: 7 },
					{ id: 2, name: 'flush', url: 'http://x/deps/chunk-A.js', line: 40 }
				],
				samples: [
					[1, 100_000],
					[1, 100_000],
					[2, 100_000]
				]
			})
		};
		// Sample instants 200, 300, 400 ms on the trace clock: the grid's own arithmetic
		// twice, then the commit's flush. One arm's window holds the first, the other's
		// the last, and the middle sample is in neither arm's window — so a slice that
		// leaked across buckets would show up as a row where it does not belong.
		const windows = [
			{ key: 'per-cell-grid::f/drag', actionIndex: 0, startMs: 350, endMs: 450 },
			{ key: 'pruned-grid::f/drag', actionIndex: 1, startMs: 100, endMs: 250 }
		];
		const rows = summarizeCpuProfileWindows({ profile: input.profile, windows });
		expect(rows.map((row) => row.key).sort()).toEqual(['per-cell-grid::f/drag', 'pruned-grid::f/drag']);
		const before = rows.find((row) => row.key === 'per-cell-grid::f/drag')!;
		const after = rows.find((row) => row.key === 'pruned-grid::f/drag')!;
		expect(after.topSelfTime.map((row) => [row.functionName, row.selfMs])).toEqual([['grid', 100]]);
		expect(before.topSelfTime.map((row) => [row.functionName, row.selfMs])).toEqual([['flush', 100]]);
		expect(before.sampledInWindowMs).toBe(100);
		expect(before.windows).toBe(1);
		// The shared walk: the same windows through the full summary's class rows are
		// the same rows, because there is one walk and not two that could drift.
		const viaSummary = summarizeCpuProfile({
			profile: input.profile,
			windows,
			markerTraceMs: null,
			samplingIntervalUs: null
		}).classes;
		expect(viaSummary).toEqual(rows);
	});

	it('states the clock relation instead of assuming the two clocks agree', () => {
		const shared = summarizeCpuProfile({
			profile: profileOf({ startMs: 5_000, frames: [{ id: 1, name: 'f' }], samples: [[1, 1_000]] }),
			windows: [],
			// Taken one CDP round trip after `Profiler.start`.
			markerTraceMs: 4998.2,
			samplingIntervalUs: 1000
		});
		expect(shared.clockRelation.deltaMs).toBeCloseTo(1.8, 3);
		// The gap between the anchors is stated as what it is — elapsed time on ONE
		// clock, not an offset to subtract — because the run this instrument was
		// written for measured 272 ms there, which is a page's start-up work, not a
		// round trip; calling that an alignment uncertainty would have understated
		// nothing and explained nothing.
		expect(shared.clockRelation.verdict).toContain('SAME CLOCK DOMAIN');
		expect(shared.clockRelation.verdict).toContain('NOT an offset to correct for');

		const different = summarizeCpuProfile({
			profile: profileOf({ startMs: 5_000, frames: [{ id: 1, name: 'f' }], samples: [[1, 1_000]] }),
			windows: [],
			markerTraceMs: 4_000_000,
			samplingIntervalUs: 1000
		});
		expect(different.clockRelation.verdict).toContain('NOT THE SAME CLOCK');

		const unchecked = summarizeCpuProfile({
			profile: profileOf({ startMs: 5_000, frames: [{ id: 1, name: 'f' }], samples: [[1, 1_000]] }),
			windows: [],
			markerTraceMs: null,
			samplingIntervalUs: null
		});
		expect(unchecked.clockRelation.markerTraceMs).toBeNull();
		expect(unchecked.clockRelation.verdict).toContain('NOT CHECKED');
		expect(unchecked.definition).toBe(P23B_M1_CPU_PROFILE_DEFINITION);
		// Two frames that ran but were never sampled do not appear at all: a sampled
		// profile reports what it saw, never a zero it did not measure.
		expect(unchecked.topSelfTime).toHaveLength(1);
	});
});
