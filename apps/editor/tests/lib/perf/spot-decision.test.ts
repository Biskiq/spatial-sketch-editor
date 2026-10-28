import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
	COMMIT_EDITOR_MS,
	commitPresentedLimitMs,
	FRAME_CAP,
	frameStop,
	interactionDecision,
	MOVE_EDITOR_MS,
	nextSession,
	oneShot,
	SAMPLE_CAP,
	seriesStop,
	spotExitCode,
	undoRequired,
	type InteractionInput
} from '../../../perf/lib/spot-decision';

const REFRESH_60 = 1000 / 60;

function input(overrides: Partial<InteractionInput> = {}): InteractionInput {
	return {
		tier: 'M',
		refreshMs: REFRESH_60,
		moveEditor: [2, 3, 2, 4],
		movePresented: [16.2, 16.4, 16.3, 16.5],
		panEditor: [3, 3.2, 2.8, 3.1],
		panPresented: [16.3, 16.4, 16.2, 16.5],
		frameIntervals: Array.from({ length: 8 }, () => REFRESH_60),
		commitEditorMs: 26,
		commitPresentedMs: 33,
		supersededFraction: 0,
		pickMeasured: true,
		pickResolved: true,
		undoRequired: false,
		undoEditorMs: null,
		unsplit: false,
		...overrides
	};
}

describe('series stop', () => {
	it('stops at four samples when the preserved maximum is clearly under, even if the relative spread is wide', () => {
		const stop = seriesStop([2, 3, 2, 4], MOVE_EDITOR_MS.M);
		expect(stop).toMatchObject({ action: 'stop', classification: 'under', max: 4 });
	});

	it('keeps an outlier and stops at four when that maximum is clearly over', () => {
		const stop = seriesStop([2, 2, 2, 40], MOVE_EDITOR_MS.M);
		expect(stop).toMatchObject({ action: 'stop', classification: 'over', max: 40 });
	});

	it('extends only while the maximum sits in the margin, then stops at eight on the worse side', () => {
		const early = seriesStop([7.2, 7.4, 7.6, 7.8], MOVE_EDITOR_MS.M);
		expect(early.action).toBe('extend');
		expect(early.classification).toBe('on-the-line');
		const capped = seriesStop(Array.from({ length: SAMPLE_CAP }, () => 7.5), MOVE_EDITOR_MS.M);
		expect(capped).toMatchObject({ action: 'stop', classification: 'on-the-line' });
	});

	it('does not treat a one-shot inside the margin as a clear pass', () => {
		expect(oneShot(48, COMMIT_EDITOR_MS.M)).toBe('on-the-line');
		expect(oneShot(26, COMMIT_EDITOR_MS.M)).toBe('under');
		expect(oneShot(null, COMMIT_EDITOR_MS.M)).toBe('missing');
	});
});

describe('frame period', () => {
	it('treats a tight cluster at twice the display period as half-rate', () => {
		const intervals = Array.from({ length: 8 }, () => 2 * REFRESH_60);
		expect(frameStop(intervals, REFRESH_60)).toEqual({ action: 'stop', kind: 'half-rate' });
	});

	it('treats the same cluster as on-refresh when that is the display period', () => {
		const refresh = 1000 / 30;
		const intervals = Array.from({ length: 8 }, () => refresh);
		expect(frameStop(intervals, refresh)).toEqual({ action: 'stop', kind: 'on-refresh' });
	});

	it('stops on a preserved stall and extends an interval that matches neither period', () => {
		const mixed = [...Array.from({ length: 7 }, () => REFRESH_60), REFRESH_60 + 4];
		expect(frameStop(mixed, REFRESH_60).action).toBe('extend');
		const stall = [...Array.from({ length: 7 }, () => REFRESH_60), 3 * REFRESH_60];
		expect(frameStop(stall, REFRESH_60)).toEqual({ action: 'stop', kind: 'stall' });
		const capped = Array.from({ length: FRAME_CAP }, () => REFRESH_60 + 4);
		expect(frameStop(capped, REFRESH_60)).toEqual({ action: 'stop', kind: 'off-refresh' });
	});
});

describe('interaction labels', () => {
	it('calls M smooth only when editor time, presentation and frames all match the display', () => {
		expect(interactionDecision(input()).label).toBe('smooth');
	});

	it('does not call low editor time smooth when frames are a stable half-rate', () => {
		const decision = interactionDecision(input({
			frameIntervals: Array.from({ length: 8 }, () => 2 * REFRESH_60)
		}));
		expect(decision.label).toBe('not-smooth');
	});

	it('keeps L usable at half-rate when the editor clauses are clearly under', () => {
		const decision = interactionDecision(input({
			tier: 'L',
			moveEditor: [18, 18.2, 17.8, 18.1],
			movePresented: [28, 29, 30, 31],
			panEditor: [12, 12, 11, 13],
			panPresented: [28, 29, 30, 30],
			frameIntervals: Array.from({ length: 8 }, () => 2 * REFRESH_60),
			commitEditorMs: 94,
			commitPresentedMs: 110,
			undoRequired: true,
			undoEditorMs: 22
		}));
		expect(decision.label).toBe('usable');
	});

	it('uses the 200 ms end-to-end completion allowance for L without weakening M', () => {
		// A fast L acceptance may need several frames to render. This is still
		// a completed, usable commit below the L 200 ms allowance.
		expect(commitPresentedLimitMs('L', 15.6, REFRESH_60)).toBe(200);
		expect(commitPresentedLimitMs('M', 6.3, REFRESH_60)).toBeCloseTo(6.3 + REFRESH_60 + 2);
		expect(interactionDecision(input({
			tier: 'L', commitEditorMs: 15.6, commitPresentedMs: 120,
			undoRequired: true, undoEditorMs: 6.5
		})).label).toBe('usable');
		expect(interactionDecision(input({
			tier: 'L', commitEditorMs: 15.6, commitPresentedMs: 230,
			undoRequired: true, undoEditorMs: 6.5
		})).label).toBe('not-usable');
	});

	it('classifies a missed pick, a missing mark and an unsplit window as incomplete rather than smooth', () => {
		expect(interactionDecision(input({ pickResolved: false })).label).toBe('not-usable');
		expect(interactionDecision(input({ pickMeasured: false })).label).toBe('incomplete');
		expect(interactionDecision(input({ unsplit: true })).label).toBe('incomplete');
		expect(interactionDecision(input({ commitEditorMs: null })).label).toBe('incomplete');
	});

	it('preserves a superseded gesture and an L stall as not usable', () => {
		expect(interactionDecision(input({ supersededFraction: 0.5 })).label).toBe('not-usable');
		expect(interactionDecision(input({
			tier: 'L',
			moveEditor: [18, 18, 18, 18],
			movePresented: [20, 20, 20, 20],
			panEditor: [12, 12, 12, 12],
			panPresented: [20, 20, 20, 20],
			frameIntervals: [...Array.from({ length: 7 }, () => REFRESH_60), 80],
			commitEditorMs: 94,
			commitPresentedMs: 110,
			undoRequired: true,
			undoEditorMs: 22
		})).label).toBe('not-usable');
	});
});

describe('sessions and exit', () => {
	it('requests another session only for an unresolved label or a disagreement', () => {
		expect(nextSession({ sessionsSoFar: 1, onTheLine: false, labelsDisagree: false })).toEqual({ another: false, reason: 'none' });
		expect(nextSession({ sessionsSoFar: 1, onTheLine: true, labelsDisagree: false }).reason).toBe('on-the-line');
		expect(nextSession({ sessionsSoFar: 2, onTheLine: true, labelsDisagree: false })).toEqual({ another: false, reason: 'none' });
		expect(nextSession({ sessionsSoFar: 2, onTheLine: false, labelsDisagree: true }).reason).toBe('labels-disagree');
		expect(nextSession({ sessionsSoFar: 3, onTheLine: true, labelsDisagree: true })).toEqual({ another: false, reason: 'capped' });
	});

	it('requires undo at L and at M only after a commit past the smooth line', () => {
		expect(undoRequired('M', 26)).toBe(false);
		expect(undoRequired('M', 60)).toBe(true);
		expect(undoRequired('L', 22)).toBe(true);
	});

	it('exits cleanly for a finished not-smooth label, and non-zero for incomplete or capped runs', () => {
		expect(spotExitCode(['smooth', 'usable'], false)).toBe(0);
		expect(spotExitCode(['not-smooth', 'usable'], false)).toBe(0);
		expect(spotExitCode(['incomplete', 'usable'], false)).toBe(1);
		expect(spotExitCode(['smooth'], true)).toBe(2);
	});

	it('keeps the retired suite off the npm commands', () => {
		const editor = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
		const root = JSON.parse(readFileSync(new URL('../../../../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
		expect(editor.scripts['perf:spot']).toContain('perf/spot.ts');
		expect(editor.scripts.perf).toContain('retired-suite');
		expect(editor.scripts['perf:bench']).toBeUndefined();
		expect(editor.scripts['perf:census']).toBeUndefined();
		expect(editor.scripts['perf:scale']).toBeUndefined();
		expect(root.scripts['perf:spot']).toContain('perf:spot');
		expect(root.scripts.perf).toContain('npm run perf');
	});
});
