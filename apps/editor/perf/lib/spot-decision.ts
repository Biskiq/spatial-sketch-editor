/**
 * Decision rules for the M/L spot check.
 *
 * A series stops from the preserved maximum against a threshold margin. A
 * whole-series range is reported and never decides whether to continue: adding
 * a sample cannot shrink that range. Four samples decide a clear result. A
 * maximum still inside the margin extends one sample at a time, to eight, and
 * then takes the worse label. Outliers stay in the series.
 *
 * Feel labels stay distinct. M is smooth only when editor time, handler-to-
 * presentation delay and frame intervals all match the measured display period.
 * L may run at half that period and still be usable. Low editor time alone
 * does not establish either label.
 */

export const SAMPLE_FLOOR = 4;
export const SAMPLE_CAP = 8;
export const FRAME_FLOOR = 8;
export const FRAME_CAP = 16;
export const SESSION_CAP = 3;
export const WALL_CAP_MS = 10 * 60 * 1000;
export const PRESENTATION_TOLERANCE_MS = 2;
export const SUPERSEDED_LIMIT = 0.25;

export const MOVE_EDITOR_MS = { M: 8, L: 33 } as const;
export const COMMIT_EDITOR_MS = { M: 50, L: 200 } as const;

export type SpotTier = 'M' | 'L';
export type SeriesClass = 'under' | 'over' | 'on-the-line';
export type FrameKind = 'on-refresh' | 'half-rate' | 'stall' | 'off-refresh' | 'ambiguous';
export type SpotLabel = 'smooth' | 'usable' | 'not-smooth' | 'not-usable' | 'incomplete';

export type SeriesStop = {
	readonly action: 'stop' | 'extend';
	readonly classification: SeriesClass;
	readonly max: number;
	readonly min: number;
	readonly median: number;
};

export function marginMs(thresholdMs: number): number {
	return Math.max(1, thresholdMs * 0.1);
}

export function spread(samples: readonly number[]): { min: number; median: number; max: number } {
	const sorted = [...samples].filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
	if (sorted.length === 0) return { min: Number.NaN, median: Number.NaN, max: Number.NaN };
	const mid = Math.floor(sorted.length / 2);
	const median = sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
	return { min: sorted[0]!, median, max: sorted[sorted.length - 1]! };
}

/** Classify the preserved maximum. Fewer than four samples always extends. */
export function seriesStop(samples: readonly number[], thresholdMs: number): SeriesStop {
	const { min, median, max } = spread(samples);
	if (samples.length < SAMPLE_FLOOR || !Number.isFinite(max)) {
		return { action: 'extend', classification: 'on-the-line', max, min, median };
	}
	const margin = marginMs(thresholdMs);
	const classification: SeriesClass = max <= thresholdMs - margin ? 'under' : max >= thresholdMs + margin ? 'over' : 'on-the-line';
	const action = classification === 'on-the-line' && samples.length < SAMPLE_CAP ? 'extend' : 'stop';
	return { action, classification, max, min, median };
}

export function presentedLimitMs(tier: SpotTier, refreshMs: number): number {
	return tier === 'M' ? refreshMs + PRESENTATION_TOLERANCE_MS : 2 * refreshMs + PRESENTATION_TOLERANCE_MS;
}

/** M requires a near-immediate response; L permits a slower complete commit.
 * The two-frame L budget applies to continuous input, not one-shot commit completion.
 */
export function commitPresentedLimitMs(tier: SpotTier, editorMs: number, refreshMs: number): number {
	if (tier === 'L') return COMMIT_EDITOR_MS.L;
	return Math.min(COMMIT_EDITOR_MS.M, editorMs + refreshMs + PRESENTATION_TOLERANCE_MS);
}

export type FrameStop = {
	readonly action: 'stop' | 'extend';
	readonly kind: FrameKind;
};

/**
 * Compare intervals with the display period `refreshMs`, not with each other.
 * A 1 ms cluster at twice the display period is half-rate.
 */
export function frameStop(intervals: readonly number[], refreshMs: number): FrameStop {
	if (intervals.length < FRAME_FLOOR || !Number.isFinite(refreshMs) || refreshMs <= 0) {
		return { action: 'extend', kind: 'ambiguous' };
	}
	const on = (value: number, period: number) => Math.abs(value - period) <= 1;
	const kinds = intervals.map((interval) => {
		if (interval > 2 * refreshMs + 1) return 'stall' as const;
		if (on(interval, refreshMs)) return 'on-refresh' as const;
		if (on(interval, 2 * refreshMs)) return 'half-rate' as const;
		return 'between' as const;
	});
	if (kinds.includes('stall')) return { action: 'stop', kind: 'stall' };
	if (kinds.every((kind) => kind === 'on-refresh')) return { action: 'stop', kind: 'on-refresh' };
	if (kinds.every((kind) => kind === 'on-refresh' || kind === 'half-rate') && kinds.includes('half-rate')) {
		return { action: 'stop', kind: 'half-rate' };
	}
	if (intervals.length >= FRAME_CAP) {
		const worst = kinds.includes('stall') ? 'stall' : kinds.includes('half-rate') ? 'half-rate' : 'off-refresh';
		return { action: 'stop', kind: worst };
	}
	return { action: 'extend', kind: 'ambiguous' };
}

export type InteractionInput = {
	readonly tier: SpotTier;
	readonly refreshMs: number;
	readonly moveEditor: readonly number[];
	readonly movePresented: readonly number[];
	readonly panEditor: readonly number[];
	readonly panPresented: readonly number[];
	readonly frameIntervals: readonly number[];
	readonly commitEditorMs: number | null;
	readonly commitPresentedMs: number | null;
	readonly supersededFraction: number | null;
	readonly pickMeasured: boolean;
	readonly pickResolved: boolean | null;
	readonly undoRequired: boolean;
	readonly undoEditorMs: number | null;
	readonly unsplit: boolean;
};

export type OneShotClass = SeriesClass | 'missing';

/** One commit, undo or pick: the same margin as a series, without a four-sample floor. */
export function oneShot(value: number | null, thresholdMs: number): OneShotClass {
	if (value === null || !Number.isFinite(value)) return 'missing';
	const margin = marginMs(thresholdMs);
	if (value <= thresholdMs - margin) return 'under';
	if (value >= thresholdMs + margin) return 'over';
	return 'on-the-line';
}

export type InteractionDecision = {
	readonly label: SpotLabel;
	readonly moveEditor: SeriesStop;
	readonly movePresented: SeriesStop;
	readonly panEditor: SeriesStop;
	readonly panPresented: SeriesStop;
	readonly frames: FrameStop;
	/** True when a stopped series or one-shot still sits in a threshold margin. */
	readonly onTheLine: boolean;
};

function failed(stop: SeriesStop): boolean {
	return stop.classification !== 'under';
}

export function interactionDecision(input: InteractionInput): InteractionDecision {
	const moveEditor = seriesStop(input.moveEditor, MOVE_EDITOR_MS[input.tier]);
	const movePresented = seriesStop(input.movePresented, presentedLimitMs(input.tier, input.refreshMs));
	const panEditor = seriesStop(input.panEditor, MOVE_EDITOR_MS[input.tier]);
	const panPresented = seriesStop(input.panPresented, presentedLimitMs(input.tier, input.refreshMs));
	const frames = frameStop(input.frameIntervals, input.refreshMs);
	const commitEditor = oneShot(input.commitEditorMs, COMMIT_EDITOR_MS[input.tier]);
	const commitPresentedLimit = input.commitEditorMs === null ? null : commitPresentedLimitMs(input.tier, input.commitEditorMs, input.refreshMs);
	const commitPresented = oneShot(input.commitPresentedMs, commitPresentedLimit ?? Number.NaN);
	const undo = input.undoRequired ? oneShot(input.undoEditorMs, COMMIT_EDITOR_MS[input.tier]) : 'under';
	const onTheLine = [moveEditor, movePresented, panEditor, panPresented].some((stop) => stop.action === 'stop' && stop.classification === 'on-the-line')
		|| commitEditor === 'on-the-line'
		|| commitPresented === 'on-the-line'
		|| undo === 'on-the-line';
	const clearSeriesMiss = [moveEditor, movePresented, panEditor, panPresented].some((stop) => stop.classification === 'over');
	const missing =
		input.unsplit ||
		input.moveEditor.length < SAMPLE_FLOOR ||
		input.movePresented.length < SAMPLE_FLOOR ||
		input.panEditor.length < SAMPLE_FLOOR ||
		input.panPresented.length < SAMPLE_FLOOR ||
		input.frameIntervals.length < FRAME_FLOOR ||
		commitEditor === 'missing' ||
		commitPresented === 'missing' ||
		undo === 'missing' ||
		input.supersededFraction === null ||
		!input.pickMeasured ||
		input.pickResolved === null ||
		(!clearSeriesMiss && (moveEditor.action === 'extend' || movePresented.action === 'extend' || panEditor.action === 'extend' || panPresented.action === 'extend')) ||
		frames.action === 'extend';
	if (missing) return { label: 'incomplete', moveEditor, movePresented, panEditor, panPresented, frames, onTheLine };

	const superseded = input.supersededFraction! > SUPERSEDED_LIMIT;
	const pickFailed = input.pickResolved === false;
	const stall = frames.kind === 'stall';
	const halfRate = frames.kind === 'half-rate';
	const moveBeyondUsable = [...input.moveEditor, ...input.panEditor].some((value) => value > MOVE_EDITOR_MS.L);
	const presentedBeyondUsable = [...input.movePresented, ...input.panPresented].some((value) => value > presentedLimitMs('L', input.refreshMs));
	const commitBeyondUsable = (input.commitEditorMs ?? 0) > COMMIT_EDITOR_MS.L || (input.undoRequired && (input.undoEditorMs ?? 0) > COMMIT_EDITOR_MS.L);

	const unusable = pickFailed || superseded || stall || moveBeyondUsable || presentedBeyondUsable || commitBeyondUsable;
	if (unusable) return { label: 'not-usable', moveEditor, movePresented, panEditor, panPresented, frames, onTheLine };

	const clauseFailed = failed(moveEditor) || failed(movePresented) || failed(panEditor) || failed(panPresented) || commitEditor !== 'under' || commitPresented !== 'under' || undo !== 'under';
	if (input.tier === 'L') {
		const usable = !clauseFailed && (frames.kind === 'on-refresh' || halfRate);
		return { label: usable ? 'usable' : 'not-usable', moveEditor, movePresented, panEditor, panPresented, frames, onTheLine };
	}
	const smooth = !clauseFailed && frames.kind === 'on-refresh';
	return { label: smooth ? 'smooth' : 'not-smooth', moveEditor, movePresented, panEditor, panPresented, frames, onTheLine };
}

export type SessionRequest = {
	readonly another: boolean;
	readonly reason: 'none' | 'on-the-line' | 'labels-disagree' | 'capped';
};

/**
 * A further session is spent only when it could change the label.
 * Automation time larger than editor time does not qualify: that is the usual
 * shape of a millisecond-scale editor sample. A missing split is `unsplit` on
 * the row and is not rerun.
 */
export function nextSession(input: {
	readonly sessionsSoFar: number;
	readonly onTheLine: boolean;
	readonly labelsDisagree: boolean;
}): SessionRequest {
	if (input.sessionsSoFar >= SESSION_CAP) return { another: false, reason: 'capped' };
	if (input.sessionsSoFar >= 2 && input.labelsDisagree && input.sessionsSoFar < SESSION_CAP) {
		return { another: true, reason: 'labels-disagree' };
	}
	if (input.sessionsSoFar >= 2) return { another: false, reason: 'none' };
	if (input.onTheLine) return { another: true, reason: 'on-the-line' };
	return { another: false, reason: 'none' };
}

export function spotExitCode(labels: readonly SpotLabel[], capped: boolean): number {
	if (capped) return 2;
	if (labels.some((label) => label === 'incomplete')) return 1;
	return 0;
}

export function undoRequired(tier: SpotTier, commitEditorMs: number | null): boolean {
	if (tier === 'L') return true;
	return commitEditorMs !== null && commitEditorMs > COMMIT_EDITOR_MS.M;
}
