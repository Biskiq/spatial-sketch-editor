import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BenchInteractionBoundary, BenchInteractionPath, P23BCaptureLedger } from '$lib/bench/bench-types';

/**
 * P23B interaction instrumentation — method v5 contract tests.
 *
 * These are the tests the returned review asked for. Time is fully controlled:
 * `performance.now` is driven by a numeric clock, Svelte's `tick` is a promise the
 * test releases, and `requestAnimationFrame` collects callbacks the test runs. So
 * every boundary duration below is an exact, asserted number rather than a
 * tolerance — the v4 defect this suite exists to pin produced 120/130 ms where the
 * corrected instrumentation must produce 20/30 ms for the same input.
 *
 * CALL-SITE COVERAGE. The Plan viewport's wrappers (`p23bPointerDown/Up/Move`,
 * `p23bClick`, `p23bWheel`) call exactly the sequences reproduced below — open,
 * measure, classify, resolve, schedule — with one action per interaction (a
 * wall-tool press and the click that resolves it are the SAME action). The shipped
 * handlers they wrap now *return* the outcome (`onClick` and `commitWallChainClick`
 * are declared `BenchInteractionOutcome`), so a classification branch cannot be
 * dropped without a type error. This environment is `node`, so the component
 * itself is not mounted here; the empirical proof that those call sites classify
 * correctly is the recaptured baseline (accepted releases per authored Wall, not
 * clicks).
 */

const svelte = vi.hoisted(() => {
	const state = { resolvers: [] as Array<() => void> };
	return {
		state,
		tick: () =>
			new Promise<void>((resolve) => {
				state.resolvers.push(resolve);
			}),
		flushTicks: () => {
			const pending = state.resolvers;
			state.resolvers = [];
			for (const resolve of pending) resolve();
		}
	};
});

const clock = vi.hoisted(() => ({ now: 0 }));

vi.mock('svelte', () => ({ tick: svelte.tick }));

import {
	p23bBeginInteractionCapture,
	p23bClassifyGestureOutcome,
	p23bEndInteractionCapture,
	p23bGestureForPointer,
	p23bInteractionCaptureLedger,
	p23bMeasureActiveAdapter,
	p23bMeasureActivePlanApply,
	p23bMeasureGesture,
	p23bOpenGesture,
	p23bPublishPlanView,
	p23bRecordFixtureReset,
	p23bResolveGesture,
	p23bScheduleGestureBoundaries,
	p23bSettleInteractionCapture,
	summarizeInteractionCapture,
	type P23BGesture
} from '$lib/editor/layout/p23b-interaction-measure';

type P23BGlobals = typeof globalThis & { __P2311_PERF__?: boolean };

const globals = globalThis as P23BGlobals;
const ALL_PATHS: readonly BenchInteractionPath[] = [
	'selection', 'plan-drag-edit', 'bend-knot-edit', 'wall-authoring', 'plan-pan-zoom', 'guided-3d-navigation'
];
const ALL_BOUNDARIES: readonly BenchInteractionBoundary[] = [
	'input', 'release', 'reactive', 'plan-apply', 'adapter', 'svelte-flush', 'browser-frame'
];

let frames: Array<() => void> = [];

beforeEach(() => {
	clock.now = 0;
	vi.spyOn(performance, 'now').mockImplementation(() => clock.now);
	frames = [];
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		frames.push(() => callback(clock.now));
		return frames.length;
	});
	globals.__P2311_PERF__ = true;
	p23bBeginInteractionCapture();
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	delete globals.__P2311_PERF__;
});

function drain(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Advance the clock while running one synchronous handler. */
function handle<T>(
	gesture: P23BGesture | null,
	path: BenchInteractionPath,
	boundary: BenchInteractionBoundary,
	ms: number,
	work?: () => T
): T | undefined {
	return p23bMeasureGesture(gesture, path, boundary, () => {
		clock.now += ms;
		return work?.();
	});
}

/**
 * Release every scheduled flush from where the inputs ended, then run every
 * scheduled frame from there: 20 ms flush and 10 ms frame by default, so the
 * expected durations are exact.
 */
async function runDeferred(flushMs = 20, frameMs = 10): Promise<void> {
	clock.now += flushMs;
	svelte.flushTicks();
	await drain();
	clock.now += frameMs;
	const pending = frames;
	frames = [];
	for (const run of pending) run();
	await drain();
}

function summarize(ledger: P23BCaptureLedger, warmup = 5, paths = ALL_PATHS, boundaries = ALL_BOUNDARIES) {
	return summarizeInteractionCapture(ledger, {
		warmup,
		paths,
		boundaries,
		unavailable: (path, boundary) => `no ${boundary} sample for ${path}`
	});
}

/** The exact call-site sequence of an armed direct-edit gesture (drag or bend). */
function dragOrBendRelease(pointerId: number, verdict: 'committed' | 'rejected', path: BenchInteractionPath = 'plan-drag-edit') {
	const press = p23bOpenGesture('selection', { pointerId, deferPath: true })!;
	handle(press, 'selection', 'input', 100);
	p23bScheduleGestureBoundaries(press);
	// The release rejoins the press, so one gesture carries one outcome.
	const release = p23bGestureForPointer(pointerId)!;
	handle(release, path, 'release', 40, () =>
		p23bClassifyGestureOutcome(verdict === 'committed' ? 'accepted' : 'rejected')
	);
	p23bResolveGesture(release, path, release.outcome ?? 'unclassified');
	p23bScheduleGestureBoundaries(release);
	return release;
}

/**
 * The exact call-site sequence of one wall-tool authoring action: the press and
 * the click that resolves it are one action with one outcome.
 */
function wallAction(pointerId: number, outcome: 'setup' | 'accepted' | 'rejected' | 'suppressed', ms = 90) {
	const gesture = p23bOpenGesture('wall-authoring', { pointerId, deferPath: true, deferOutcome: true })!;
	handle(gesture, 'wall-authoring', 'input', 1);
	p23bScheduleGestureBoundaries(gesture);
	handle(gesture, 'wall-authoring', 'release', ms);
	p23bResolveGesture(gesture, 'wall-authoring', outcome);
	p23bScheduleGestureBoundaries(gesture);
	return gesture;
}

describe('P23B deferred boundary origins', () => {
	it('reactivates the measured release gesture before in-handler outcome classification', () => {
		const release = p23bOpenGesture('plan-drag-edit', { pointerId: 601 })!;
		const intervening = p23bOpenGesture('plan-pan-zoom')!;

		p23bMeasureGesture(release, 'plan-drag-edit', 'release', () => {
			p23bClassifyGestureOutcome('accepted');
		});

		expect(release.outcome).toBe('accepted');
		expect(intervening.outcome).toBeNull();
	});

	it('measures press and move flush/frame from the same origin: the end of the synchronous input', async () => {
		const press = p23bOpenGesture('selection', { pointerId: 1, deferPath: true })!;
		handle(press, 'selection', 'input', 100);
		p23bResolveGesture(press, 'selection', 'accepted');
		p23bScheduleGestureBoundaries(press);
		await runDeferred(20, 10);

		const move = p23bOpenGesture('plan-drag-edit')!;
		handle(move, 'plan-drag-edit', 'input', 100);
		p23bResolveGesture(move, 'plan-drag-edit', 'accepted');
		p23bScheduleGestureBoundaries(move);
		await runDeferred(20, 10);

		const summary = summarize(p23bEndInteractionCapture()!, 0);
		// Identical 100 ms handler + 20 ms flush + 10 ms frame must give the same
		// numbers for a press-derived and a move-derived action. v4 produced 120/130
		// for the press and 20/30 for the move under this same controlled clock.
		expect(summary.interactions.selection!['input']).toMatchObject({ accepted: { count: 1, p50: 100, p95: 100 } });
		for (const path of ['selection', 'plan-drag-edit'] as const) {
			expect(summary.interactions[path]!['svelte-flush']).toMatchObject({ accepted: { count: 1, p50: 20, p95: 20 } });
			expect(summary.interactions[path]!['browser-frame']).toMatchObject({ accepted: { count: 1, p50: 30, p95: 30 } });
		}
	});

	it('keeps the frame boundary enclosing the flush of the same input rather than adding them', async () => {
		const gesture = p23bOpenGesture('plan-drag-edit')!;
		handle(gesture, 'plan-drag-edit', 'input', 5);
		p23bResolveGesture(gesture, 'plan-drag-edit', 'accepted');
		p23bScheduleGestureBoundaries(gesture);
		await runDeferred(200, 50);

		const summary = summarize(p23bEndInteractionCapture()!, 0);
		const flush = summary.interactions['plan-drag-edit']!['svelte-flush'] as { accepted: { p50: number } };
		const frame = summary.interactions['plan-drag-edit']!['browser-frame'] as { accepted: { p50: number } };
		expect(flush.accepted.p50).toBe(200);
		expect(frame.accepted.p50).toBe(250);
		expect(frame.accepted.p50).toBeGreaterThanOrEqual(flush.accepted.p50);
	});

	it('nests reactive, plan-apply and adapter inside the input that scheduled them', async () => {
		const gesture = p23bOpenGesture('plan-drag-edit')!;
		p23bMeasureGesture(gesture, 'plan-drag-edit', 'release', () => {
			clock.now += 40;
			p23bMeasureActivePlanApply(() => { clock.now += 12; });
			p23bMeasureActiveAdapter(() => { clock.now += 3; });
		});
		p23bResolveGesture(gesture, 'plan-drag-edit', 'accepted');
		p23bScheduleGestureBoundaries(gesture);
		await runDeferred();

		const summary = summarize(p23bEndInteractionCapture()!, 0);
		const release = summary.interactions['plan-drag-edit']!['release'] as { accepted: { p50: number } };
		const planApply = summary.interactions['plan-drag-edit']!['plan-apply'] as { accepted: { p50: number } };
		const adapter = summary.interactions['plan-drag-edit']!['adapter'] as { accepted: { p50: number } };
		expect(release.accepted.p50).toBe(55);
		expect(planApply.accepted.p50).toBe(12);
		expect(adapter.accepted.p50).toBe(3);
		// The nested boundaries are contained by the input, never added to it.
		expect(planApply.accepted.p50 + adapter.accepted.p50).toBeLessThan(release.accepted.p50);
	});

	it('attributes the canonical planner call to plan-apply and Three adapter work to adapter, never to one bucket', async () => {
		const gesture = p23bOpenGesture('bend-knot-edit')!;
		handle(gesture, 'bend-knot-edit', 'release', 10);
		p23bMeasureActivePlanApply(() => { clock.now += 7; });
		p23bResolveGesture(gesture, 'bend-knot-edit', 'accepted');
		p23bScheduleGestureBoundaries(gesture);
		await runDeferred();

		const summary = summarize(p23bEndInteractionCapture()!, 0);
		const planApply = summary.interactions['bend-knot-edit']!['plan-apply'] as { accepted: { p50: number } };
		expect(planApply.accepted.p50).toBe(7);
		// No Three adapter work ran for this action, so adapter coverage stays
		// explicitly unavailable instead of silently reusing the planner's number.
		expect(summary.interactions['bend-knot-edit']!['adapter']).toEqual({ unavailable: 'no adapter sample for bend-knot-edit' });
	});
});

describe('P23B accepted-release classification', () => {
	it('keeps setup, rejected and suppressed authoring clicks out of the accepted release distribution', async () => {
		wallAction(1, 'setup');
		wallAction(2, 'accepted', 90);
		wallAction(3, 'rejected', 500);
		wallAction(4, 'suppressed', 1);
		await runDeferred();

		const ledger = p23bEndInteractionCapture()!;
		const summary = summarize(ledger, 0);
		const release = summary.interactions['wall-authoring']!['release'] as {
			accepted: { count: number; p50: number };
			outcomes: Record<string, number>;
			observedCount: number;
		};
		// Four authoring actions were observed; exactly one of them committed a Wall.
		expect(release.observedCount).toBe(4);
		expect(release.accepted).toMatchObject({ count: 1, p50: 90 });
		expect(release.outcomes).toEqual({ setup: 1, accepted: 1, rejected: 1, suppressed: 1 });
		expect(ledger.actions.map((action) => action.outcome)).toEqual(['setup', 'accepted', 'rejected', 'suppressed']);
		expect(summary.capture.outcomes['wall-authoring']).toEqual({ setup: 1, accepted: 1, rejected: 1, suppressed: 1 });
		expect(summary.capture.completedActions['wall-authoring']).toBe(4);
	});

	it('splits a drag population into accepted and refused releases from the shipped verdict', async () => {
		dragOrBendRelease(11, 'committed');
		dragOrBendRelease(12, 'rejected');
		dragOrBendRelease(13, 'committed');
		await runDeferred();

		const summary = summarize(p23bEndInteractionCapture()!, 0);
		const release = summary.interactions['plan-drag-edit']!['release'] as {
			accepted: { count: number };
			outcomes: Record<string, number>;
			observedCount: number;
		};
		expect(release.observedCount).toBe(3);
		expect(release.accepted!.count).toBe(2);
		expect(release.outcomes).toEqual({ accepted: 2, rejected: 1 });
		// The refused attempt was repeated, so the accepted release that followed it is
		// recorded as a retry of the same path.
		expect(summary.capture.retries['plan-drag-edit']).toBe(1);
	});

	it('carries an accepted gesture input into the accepted population and a refused one out of it', async () => {
		dragOrBendRelease(21, 'committed');
		dragOrBendRelease(22, 'rejected');
		await runDeferred();

		const summary = summarize(p23bEndInteractionCapture()!, 0);
		const input = summary.interactions['plan-drag-edit']!['input'] as {
			accepted: { count: number; p50: number };
			outcomes: Record<string, number>;
			observedCount: number;
		};
		expect(input.observedCount).toBe(2);
		expect(input.accepted).toMatchObject({ count: 1, p50: 100 });
		expect(input.outcomes).toEqual({ accepted: 1, rejected: 1 });
	});

	it('records an action that reports no outcome as a visible unclassified gap', async () => {
		const gesture = p23bOpenGesture('selection', { pointerId: 31, deferPath: true })!;
		handle(gesture, 'selection', 'input', 15);
		p23bResolveGesture(gesture, 'selection', null);
		p23bScheduleGestureBoundaries(gesture);
		await runDeferred();

		const summary = summarize(p23bEndInteractionCapture()!, 0);
		expect((summary.interactions.selection!['input'] as { outcomes: Record<string, number> }).outcomes).toEqual({ unclassified: 1 });
		expect(summary.capture.unclassifiedActions.selection).toBe(1);
	});
});

describe('P23B interaction warm-up exclusion', () => {
	it('excludes the leading five completed actions per path before the accepted distribution', async () => {
		for (let index = 0; index < 7; index += 1) {
			const gesture = p23bOpenGesture('selection', { pointerId: 100 + index, deferPath: true })!;
			handle(gesture, 'selection', 'input', index + 1);
			p23bResolveGesture(gesture, 'selection', 'accepted');
			p23bScheduleGestureBoundaries(gesture);
			await runDeferred();
		}

		const summary = summarize(p23bEndInteractionCapture()!);
		const input = summary.interactions.selection!['input'] as {
			accepted: { count: number; p50: number; p95: number };
			observedCount: number;
			warmupExcludedActions: number;
		};
		expect(input.observedCount).toBe(7);
		expect(input.warmupExcludedActions).toBe(5);
		expect(input.accepted).toEqual({ count: 2, p50: 6, p95: 7 });
		expect(summary.capture.completedActions.selection).toBe(7);
		expect(summary.capture.warmupExcluded.selection).toBe(5);
		expect(summary.capture.warmup).toBe(5);
		expect(summary.capture.settled).toBe(true);
	});

	it('reports no accepted distribution at all when a path only ran warm-up actions', async () => {
		for (let index = 0; index < 5; index += 1) {
			const gesture = p23bOpenGesture('selection', { pointerId: 200 + index, deferPath: true })!;
			handle(gesture, 'selection', 'input', 10);
			p23bResolveGesture(gesture, 'selection', 'accepted');
			p23bScheduleGestureBoundaries(gesture);
			await runDeferred();
		}

		const summary = summarize(p23bEndInteractionCapture()!);
		const input = summary.interactions.selection!['input'] as { accepted: unknown; observedCount: number };
		expect(input.observedCount).toBe(5);
		expect(input.accepted).toBeNull();
	});

	it('records fixture resets on the capture, not in prose', async () => {
		p23bRecordFixtureReset();
		wallAction(41, 'setup');
		wallAction(42, 'accepted');
		p23bRecordFixtureReset();
		await runDeferred();

		const summary = summarize(p23bEndInteractionCapture()!);
		expect(summary.capture.fixtureResets).toBe(2);
		expect(summary.capture.outcomes['wall-authoring']).toEqual({ setup: 1, accepted: 1 });
	});
});

describe('P23B capture session lifecycle', () => {
	it('never writes a deferred boundary into a later capture session', async () => {
		const firstSession = p23bInteractionCaptureLedger()!.sessionId;
		const gesture = p23bOpenGesture('selection', { pointerId: 51, deferPath: true })!;
		handle(gesture, 'selection', 'input', 100);
		p23bResolveGesture(gesture, 'selection', 'accepted');
		p23bScheduleGestureBoundaries(gesture); // tick + frame still pending

		const closed = p23bEndInteractionCapture()!;
		expect(closed.actions[0]!.status).toBe('incomplete');
		expect(closed.settled).toBe(false);

		const secondSession = p23bBeginInteractionCapture();
		const own = p23bOpenGesture('selection', { pointerId: 52, deferPath: true })!;
		handle(own, 'selection', 'input', 5);
		p23bResolveGesture(own, 'selection', 'accepted');
		p23bScheduleGestureBoundaries(own);
		await runDeferred();

		const second = p23bInteractionCaptureLedger(secondSession)!;
		expect(second.actions).toHaveLength(1);
		expect(second.actions[0]!.samples.map((sample) => sample.boundary)).toEqual(['input', 'svelte-flush', 'browser-frame']);
		expect(second.droppedBoundaries).toBe(0);

		// The stale boundaries were discarded on the session that scheduled them.
		const first = p23bInteractionCaptureLedger(firstSession)!;
		expect(first.droppedBoundaries).toBe(2);
		expect(first.actions[0]!.samples.map((sample) => sample.boundary)).toEqual(['input']);
	});

	it('settles in-flight boundaries before the caller summarizes', async () => {
		const gesture = p23bOpenGesture('plan-drag-edit', { pointerId: 61 })!;
		handle(gesture, 'plan-drag-edit', 'input', 10);
		p23bResolveGesture(gesture, 'plan-drag-edit', 'accepted');
		p23bScheduleGestureBoundaries(gesture);

		let finished = false;
		const settling = p23bSettleInteractionCapture(50).then((value) => {
			finished = true;
			return value;
		});
		await drain();
		expect(finished).toBe(false);

		clock.now += 20;
		svelte.flushTicks();
		await drain();
		clock.now += 10;
		const pending = frames;
		frames = [];
		for (const run of pending) run();

		await expect(settling).resolves.toBe(true);
		const ledger = p23bInteractionCaptureLedger()!;
		expect(ledger.settled).toBe(true);
		expect(ledger.actions[0]!.samples.map((sample) => sample.boundary)).toEqual(['input', 'svelte-flush', 'browser-frame']);
	});

	it('rejects an action that never resolved instead of averaging it in', async () => {
		const abandoned = p23bOpenGesture('selection', { pointerId: 71, deferPath: true })!;
		handle(abandoned, 'selection', 'input', 100);
		p23bScheduleGestureBoundaries(abandoned);
		await runDeferred();

		const summary = summarize(p23bEndInteractionCapture()!, 0);
		expect(summary.capture.incompleteActions.selection).toBe(1);
		expect(summary.capture.completedActions.selection ?? 0).toBe(0);
		expect(summary.interactions.selection!['input']).toEqual({ unavailable: 'no input sample for selection' });
	});

	it('records the Plan viewport an action ran in and whether it stayed stable', async () => {
		p23bPublishPlanView({ pixelsPerMeter: 17.19, center: [-1.5, -1.5], width: 772, height: 806 });
		for (let index = 0; index < 2; index += 1) {
			const gesture = p23bOpenGesture('selection', { pointerId: 300 + index, deferPath: true })!;
			handle(gesture, 'selection', 'input', 10);
			p23bResolveGesture(gesture, 'selection', 'accepted');
			p23bScheduleGestureBoundaries(gesture);
			await runDeferred();
		}
		const summary = summarize(p23bEndInteractionCapture()!, 0);
		expect(summary.planView).toMatchObject({ pixelsPerMeter: 17.19, actions: 2, stable: true });
	});

	it('leaves results and control flow unchanged while disabled', () => {
		globals.__P2311_PERF__ = false;
		let calls = 0;
		const gesture = p23bOpenGesture('selection', { pointerId: 81, deferPath: true });
		const measured = p23bMeasureGesture(gesture, 'selection', 'input', () => ++calls);
		p23bMeasureActivePlanApply(() => ++calls);
		p23bMeasureActiveAdapter(() => ++calls);

		expect(gesture).toBeNull();
		expect([measured, calls]).toEqual([1, 3]);
		expect(p23bInteractionCaptureLedger()!.actions).toEqual([]);
	});
});

/**
 * POST-RELEASE SCHEDULING. Every release and authoring-click call site resolves
 * the outcome *before* it schedules that boundary's deferred pair, and a press
 * whose pair already settled leaves `pending` at zero. Completing on the resolve
 * therefore refused the schedule and lost the post-release flush and frame while
 * still reporting zero dropped boundaries — so the press's pair is fully drained
 * before the release in every test below, which is the case the earlier suite
 * never hit.
 */
describe('P23B post-release boundary scheduling', () => {
	it('records a release flush and frame exactly once, from the end of the release handler', async () => {
		const press = p23bOpenGesture('selection', { pointerId: 91, deferPath: true })!;
		handle(press, 'selection', 'input', 100);
		p23bScheduleGestureBoundaries(press);
		await runDeferred(20, 10); // the press pair is fully settled before the release

		const release = p23bGestureForPointer(91)!;
		handle(release, 'plan-drag-edit', 'release', 40);
		p23bResolveGesture(release, 'plan-drag-edit', 'accepted');
		// Resolving must not complete the action: its own release pair is not scheduled yet.
		expect(release.status).toBe('active');
		p23bScheduleGestureBoundaries(release);
		expect(release.status).toBe('active');
		await runDeferred(50, 25);

		const ledger = p23bEndInteractionCapture()!;
		const action = ledger.actions[0]!;
		expect(action.status).toBe('completed');
		expect(action.samples.map((sample) => sample.boundary)).toEqual([
			'input', 'svelte-flush', 'browser-frame', 'release', 'svelte-flush', 'browser-frame'
		]);
		// One pair per synchronous boundary, and the second pair is measured from the
		// release handler's completion (140) rather than reusing the press's origin.
		expect(action.samples.filter((sample) => sample.boundary === 'svelte-flush').map((sample) => sample.duration)).toEqual([20, 50]);
		expect(action.samples.filter((sample) => sample.boundary === 'browser-frame').map((sample) => sample.duration)).toEqual([30, 75]);
		expect(ledger.droppedBoundaries).toBe(0);

		const summary = summarize(ledger, 0);
		const flush = summary.interactions['plan-drag-edit']!['svelte-flush'] as { accepted: { count: number } };
		const frame = summary.interactions['plan-drag-edit']!['browser-frame'] as { accepted: { count: number } };
		expect(flush.accepted.count).toBe(2);
		expect(frame.accepted.count).toBe(2);
	});

	it('keeps an authoring commit\'s post-click pair and its classification', async () => {
		const setup = p23bOpenGesture('wall-authoring', { pointerId: 92, deferPath: true, deferOutcome: true })!;
		handle(setup, 'wall-authoring', 'input', 1);
		p23bScheduleGestureBoundaries(setup);
		await runDeferred(20, 10);
		handle(setup, 'wall-authoring', 'release', 90);
		p23bResolveGesture(setup, 'wall-authoring', 'setup');
		expect(setup.status).toBe('active');
		p23bScheduleGestureBoundaries(setup);
		await runDeferred(30, 8);

		const commit = p23bOpenGesture('wall-authoring', { pointerId: 93, deferPath: true, deferOutcome: true })!;
		handle(commit, 'wall-authoring', 'input', 1);
		p23bScheduleGestureBoundaries(commit);
		await runDeferred(20, 10);
		handle(commit, 'wall-authoring', 'release', 90);
		p23bResolveGesture(commit, 'wall-authoring', 'accepted');
		expect(commit.status).toBe('active');
		p23bScheduleGestureBoundaries(commit);
		await runDeferred(30, 8);

		const ledger = p23bEndInteractionCapture()!;
		expect(ledger.actions.map((action) => action.status)).toEqual(['completed', 'completed']);
		for (const action of ledger.actions) {
			expect(action.samples.filter((sample) => sample.boundary === 'svelte-flush').map((sample) => sample.duration)).toEqual([20, 30]);
			expect(action.samples.filter((sample) => sample.boundary === 'browser-frame').map((sample) => sample.duration)).toEqual([30, 38]);
		}

		const summary = summarize(ledger, 0);
		const release = summary.interactions['wall-authoring']!['release'] as {
			accepted: { count: number; p50: number };
			outcomes: Record<string, number>;
		};
		// The click that started the chain is still not an accepted Wall commit.
		expect(release.outcomes).toEqual({ setup: 1, accepted: 1 });
		expect(release.accepted).toMatchObject({ count: 1, p50: 90 });
	});

	it('never lets a pending release pair cross into the next capture session', async () => {
		const firstSession = p23bInteractionCaptureLedger()!.sessionId;
		const press = p23bOpenGesture('selection', { pointerId: 94, deferPath: true })!;
		handle(press, 'selection', 'input', 100);
		p23bScheduleGestureBoundaries(press);
		await runDeferred(20, 10);

		const release = p23bGestureForPointer(94)!;
		handle(release, 'plan-drag-edit', 'release', 40);
		p23bResolveGesture(release, 'plan-drag-edit', 'accepted');
		p23bScheduleGestureBoundaries(release); // the release pair is still in flight

		const closed = p23bEndInteractionCapture()!;
		expect(closed.actions[0]!.status).toBe('incomplete');
		expect(closed.settled).toBe(false);

		const secondSession = p23bBeginInteractionCapture();
		await runDeferred(5, 5);

		const second = p23bInteractionCaptureLedger(secondSession)!;
		expect(second.actions).toEqual([]);
		expect(second.droppedBoundaries).toBe(0);
		// Discarded on the session that scheduled them, where they are visible as drops.
		const first = p23bInteractionCaptureLedger(firstSession)!;
		expect(first.droppedBoundaries).toBe(2);
		// The press pair settled inside its own session and stays there; only the
		// release pair was discarded, on the session that scheduled it.
		expect(first.actions[0]!.samples.map((sample) => sample.boundary)).toEqual([
			'input', 'svelte-flush', 'browser-frame', 'release'
		]);
		expect(first.actions[0]!.samples.filter((sample) => sample.boundary === 'release')).toHaveLength(1);
	});
});
