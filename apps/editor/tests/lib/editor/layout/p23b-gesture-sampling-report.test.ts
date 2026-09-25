/**
 * P23B.5 M-3 — the live gesture sampling-reuse readout (DEV only).
 *
 * The readout is DEV instrumentation, so two things must hold at once: it must be
 * completely inert unless the DEV measurement switch is on, and while it is on it
 * must report what the bounded gesture-scoped store actually did. The main case
 * therefore drives the REAL store through the REAL preflight and compares the
 * readout against the S5 measurement (40 cold misses, 4 refusals, 76 hits over a
 * three-pointermove drag), rather than against numbers the test invents.
 *
 * The readout's own fallbacks are pinned here too: a dropped report total means
 * the store was reset (so two gestures are never averaged into one), and a missed
 * `open` still reports the gesture.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	createWallSamplingDerivation,
	preflightWallFirstArchitectureCandidate,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type WallFirstArchitectureProposalIntent,
	type WallSamplingDerivation
} from '@portfolio/layout-core';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS } from '$lib/bench/p23b-fixtures';
import {
	p23bCloseGestureSampling,
	p23bGestureSamplingEnabled,
	p23bGestureSamplingHistory,
	p23bGestureSamplingLive,
	p23bGestureSamplingState,
	p23bOpenGestureSampling,
	p23bRecordGestureSampling,
	p23bResetGestureSampling,
	p23bStopGestureSampling,
	p23bSubscribeGestureSampling
} from '$lib/editor/layout/p23b-gesture-sampling-report';

type P23BGlobals = typeof globalThis & {
	__P2311_PERF__?: boolean;
	__P23B_ACTIVE_INTERACTION__?: { path: string; run: number; actionId: number | null };
	__P23B_GESTURE_SAMPLING__?: unknown;
};

const globals = globalThis as P23BGlobals;

/** The committed curved-40 fixture: 40 sampled Walls, 2 incident to junction 0. */
function curvedForty(): LayoutDocumentWallFirst {
	return buildP23BMatrixFixture(P23B_MATRIX_SPECS.find((spec) => spec.id === 'p23b-40-wall-all-curved-v1')!);
}

function junctionMoveIntent(doc: LayoutDocumentWallFirst, dx: number): WallFirstArchitectureProposalIntent {
	const junctionId = doc.junctions[0]!.id;
	const point = doc.junctions[0]!.point;
	return { kind: 'junction-move', junctionId, point: [point[0] + dx, point[1]] as LayoutVec2 };
}

/** Three pointermoves of one junction drag, recorded into the readout per move. */
function dragThreeMoves(doc: LayoutDocumentWallFirst, scope: WallSamplingDerivation): void {
	for (const dx of [0.05, 0.1, 0.15]) {
		preflightWallFirstArchitectureCandidate(doc, junctionMoveIntent(doc, dx), scope);
		p23bRecordGestureSampling(scope.stats);
	}
}

beforeEach(() => {
	globals.__P2311_PERF__ = true;
	p23bResetGestureSampling();
});

afterEach(() => {
	delete globals.__P2311_PERF__;
	delete globals.__P23B_ACTIVE_INTERACTION__;
	p23bResetGestureSampling();
	vi.restoreAllMocks();
});

describe('P23B.5 live gesture sampling readout', () => {
	it('is inert while the DEV measurement switch is off', () => {
		globals.__P2311_PERF__ = false;
		delete globals.__P23B_GESTURE_SAMPLING__;
		const scope = createWallSamplingDerivation();
		expect(p23bGestureSamplingEnabled()).toBe(false);
		p23bOpenGestureSampling();
		dragThreeMoves(curvedForty(), scope);
		p23bCloseGestureSampling();
		expect(p23bGestureSamplingLive()).toBeNull();
		expect(p23bGestureSamplingHistory()).toHaveLength(0);
		// The whole drag wrote nothing: no report and not even a global to read.
		expect(globals.__P23B_GESTURE_SAMPLING__).toBeUndefined();
	});

	it('reports the real drag split: cold misses, refusals and hits', () => {
		const doc = curvedForty();
		const scope = createWallSamplingDerivation();
		p23bOpenGestureSampling();
		dragThreeMoves(doc, scope);

		const live = p23bGestureSamplingLive();
		expect(live, 'the gesture is open while it is being dragged').not.toBeNull();
		expect(live!.phase).toBe('dragging');
		expect(live!.gesture).toBe(1);
		expect(live!.reports, 'one report per recorded pointermove').toBe(3);
		expect(live!.releasedAt).toBeNull();
		expect(live!.release).toBeNull();
		// The store's own counters, unchanged by the readout.
		expect(live!.derivations).toBe(scope.stats.derivations);
		expect(live!.hits).toBe(scope.stats.hits);
		expect(live!.requests, 'requests are derivations plus hits').toBe(
			scope.stats.derivations + scope.stats.hits
		);
		// The measured split of this fixture and gesture.
		expect(live!.coldMisses).toBe(40);
		expect(live!.refusals).toBe(4);
		expect(live!.entries).toBe(44);
		expect(live!.failedDerivations).toBe(0);
		expect(live!.cachedUndefined).toBe(0);
		expect(live!.reuseRatio).toBeCloseTo(76 / 120, 10);
		expect(
			live!.coldMisses + live!.refusals,
			'derivations are cold misses plus refusals'
		).toBe(live!.derivations);
	});

	it('attributes reuse to the interaction the viewport is measuring', () => {
		const doc = curvedForty();
		const scope = createWallSamplingDerivation();
		globals.__P23B_ACTIVE_INTERACTION__ = { path: 'plan-drag-edit', run: 1, actionId: 7 };
		p23bOpenGestureSampling();
		dragThreeMoves(doc, scope);
		expect(p23bGestureSamplingLive()!.path).toBe('plan-drag-edit');
		expect(p23bGestureSamplingLive()!.actionId).toBe(7);
		// A later report with no ambient record keeps the last known attribution
		// instead of blanking the row the operator is watching.
		delete globals.__P23B_ACTIVE_INTERACTION__;
		p23bRecordGestureSampling(scope.stats);
		expect(p23bGestureSamplingLive()!.path).toBe('plan-drag-edit');
	});

	it('keeps a released gesture and its reuse in the history', () => {
		const scope = createWallSamplingDerivation();
		p23bOpenGestureSampling();
		dragThreeMoves(curvedForty(), scope);
		p23bCloseGestureSampling();

		expect(p23bGestureSamplingLive()).toBeNull();
		const history = p23bGestureSamplingHistory();
		expect(history).toHaveLength(1);
		expect(history[0]!.gesture).toBe(1);
		expect(history[0]!.phase).toBe('released');
		expect(history[0]!.release).toBe('released');
		expect(history[0]!.releasedAt).not.toBeNull();
		expect(history[0]!.requests).toBe(120);
		expect(history[0]!.hits).toBe(76);

		// The next gesture is a new report, not a continuation of the last one.
		p23bOpenGestureSampling();
		expect(p23bGestureSamplingLive()!.gesture).toBe(2);
		expect(p23bGestureSamplingLive()!.requests).toBe(0);
	});

	it('starts a new gesture when a report total drops, instead of averaging two gestures', () => {
		const scope = createWallSamplingDerivation();
		p23bOpenGestureSampling();
		dragThreeMoves(curvedForty(), scope);
		const draggedRequests = p23bGestureSamplingLive()!.requests;
		expect(draggedRequests).toBe(120);

		// A second gesture: the viewport resets the store, and its first report is
		// therefore smaller than the total the readout was holding.
		scope.reset();
		p23bRecordGestureSampling(scope.stats);
		const history = p23bGestureSamplingHistory();
		expect(history, 'the unclosed gesture is released, not merged').toHaveLength(1);
		expect(history[0]!.requests).toBe(draggedRequests);
		expect(history[0]!.release).toBe('reset-detected');
		expect(history[0]!.phase).toBe('released');
		expect(p23bGestureSamplingLive()!.gesture).toBe(2);
		expect(p23bGestureSamplingLive()!.requests).toBe(0);
	});

	it('reports a gesture that was never explicitly opened', () => {
		const scope = createWallSamplingDerivation();
		p23bRecordGestureSampling(scope.stats);
		scope.samples(
			curvedForty().walls.find((wall) => wall.centerline.kind === 'cubic-chain')!,
			[0, 0],
			[1, 0],
			'forward'
		);
		p23bRecordGestureSampling(scope.stats);
		const live = p23bGestureSamplingLive();
		expect(live, 'a missed open loses a label, never the gesture').not.toBeNull();
		expect(live!.gesture).toBe(1);
		expect(live!.reports).toBe(2);
	});

	it('labels a switch-off as a stopped watch, not as a release', () => {
		const scope = createWallSamplingDerivation();
		p23bOpenGestureSampling();
		dragThreeMoves(curvedForty(), scope);
		globals.__P2311_PERF__ = false;
		p23bStopGestureSampling();
		const history = p23bGestureSamplingHistory();
		expect(history).toHaveLength(1);
		expect(history[0]!.release).toBe('watch-stopped');
		expect(history[0]!.requests).toBe(120);
	});

	it('hands subscribers fixed copies and never lets one break the readout', () => {
		const seen: number[] = [];
		const unsubscribe = p23bSubscribeGestureSampling((state) => {
			seen.push(state.live?.requests ?? -1);
		});
		const throwing = p23bSubscribeGestureSampling(() => {
			throw new Error('a DEV listener must not break the sampler');
		});
		const scope = createWallSamplingDerivation();
		p23bOpenGestureSampling();
		dragThreeMoves(curvedForty(), scope);
		p23bCloseGestureSampling();
		expect(seen.length, 'open + three reports + close').toBe(5);
		expect(seen.at(-1)).toBe(-1);

		// A reader cannot mutate the readout through what it was handed.
		unsubscribe();
		throwing();
		const before = p23bGestureSamplingHistory()[0]!;
		const state = p23bGestureSamplingState();
		(state.history[0] as { hits: number }).hits = 0;
		(before as { hits: number }).hits = 0;
		expect(p23bGestureSamplingHistory()[0]!.hits).toBe(76);
		expect(p23bGestureSamplingState().history[0]!.hits).toBe(76);
		// And the DEV global carries the same fixed snapshot.
		expect(globals.__P23B_GESTURE_SAMPLING__).toMatchObject({
			live: null,
			history: [expect.objectContaining({ hits: 76 })]
		});
	});

	it('keeps a bounded history', () => {
		for (let index = 0; index < 30; index += 1) {
			p23bOpenGestureSampling();
			p23bCloseGestureSampling();
		}
		const history = p23bGestureSamplingHistory();
		expect(history).toHaveLength(24);
		expect(history.at(-1)!.gesture).toBe(30);
		expect(history[0]!.gesture, 'the oldest reports are dropped first').toBe(7);
	});
});
