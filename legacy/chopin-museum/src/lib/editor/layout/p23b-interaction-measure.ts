import { tick } from 'svelte';
import type {
	BenchInteractionBoundary,
	BenchInteractionOutcome,
	BenchInteractionOutcomeCounts,
	BenchInteractionPath,
	BenchInteractionReport,
	BenchInteractionSummary,
	P23BActionLedger,
	P23BCaptureLedger,
	P23BCapturePlanViewEvidence,
	P23BCaptureSummary
} from '$lib/bench/bench-types';

/**
 * P23B interaction instrumentation (method v5).
 *
 * THREE CONTRACTS, each one a correction of a v4 defect:
 *
 * 1. ORIGIN. `input`, `release`, `reactive`, `plan-apply` and `adapter` are
 *    synchronous `[call start, call end]` boundaries. `svelte-flush` and
 *    `browser-frame` are deferred and always start at the **completion of the
 *    synchronous input that scheduled them** — never at its start. v4 measured
 *    a press's flush from the press's own start (so the handler's duration was
 *    inside it) and a move's flush from the move's end (so it was not), then
 *    pooled both under one metric. Deferred boundaries therefore enclose the
 *    flush (a frame is at or after the flush of the same input), and no
 *    synchronous boundary is ever added to a deferred one.
 *
 *    SCHEDULING. An action also completes only once its own last `input`/`release`
 *    boundary has had that pair scheduled. Resolving a release (or an authoring
 *    click) and scheduling its boundaries are separate call-site steps in that
 *    order, so a press whose pair already settled used to complete the action at
 *    the resolve and have the schedule refused — silently losing every
 *    post-release flush and frame while still reporting zero dropped boundaries.
 *
 * 2. ATTRIBUTION. `plan-apply` is the canonical planner/apply call the Plan
 *    viewport makes for an edit; `adapter` is the Three geometry adapter work
 *    that rebuilds render geometry. v4 filed the planner call under `adapter`,
 *    which made "the cost is outside the canonical planner" unverifiable. A
 *    path with no Three adapter work keeps `adapter` unavailable.
 *
 * 3. OUTCOME. Every action is classified by what it actually did — accepted,
 *    setup, rejected, suppressed or unclassified — and every sample carries its
 *    action's outcome, so an accepted-release distribution can never be
 *    inflated by the clicks that only started a chain, were suppressed, or were
 *    refused. v4 recorded every authoring click as `release`, which is how one
 *    baseline came to hold 40 releases for 20 authored Walls.
 *
 * CAPTURE LIFECYCLE. Samples are only recorded inside an open capture session
 * (`p23bBeginInteractionCapture`). Deferred callbacks carry their session id and
 * are discarded — and counted — when that session has closed, so a boundary can
 * never cross into a later session. `p23bSettleInteractionCapture` drains
 * in-flight boundaries before the caller summarizes, and an action that never
 * resolved is reported as incomplete rather than being averaged in.
 */

type P23BPerfGlobals = typeof globalThis & {
	__P2311_PERF__?: boolean;
	__P23B_ACTIVE_INTERACTION__?: { path: BenchInteractionPath; run: number; actionId: number | null };
};

type SampleEntry = { boundary: BenchInteractionBoundary; start: number; end: number };

/** One measured action: a press→release gesture, a click, a move or a wheel burst. */
export type P23BGesture = {
	id: number;
	sessionId: string;
	/** The path the action opened with. */
	intent: BenchInteractionPath;
	/** The path the action actually took; `null` while a deferred press is unresolved. */
	path: BenchInteractionPath | null;
	outcome: BenchInteractionOutcome | null;
	/** Boundary intervals are kept with their clock bounds so the containment record can bind nested marks to them. */
	samples: { boundary: BenchInteractionBoundary; duration: number; start: number; end: number }[];
	planView: P23BCapturePlanViewEvidence | null;
	pending: number;
	/** Awaiting an explicit path/outcome from a later event (a release or a click). */
	awaiting: boolean;
	scheduled: boolean;
	status: 'active' | 'completed' | 'incomplete';
	syncEnd: number;
	/**
	 * Synchronous `input`/`release` boundaries recorded so far. Ambient boundaries
	 * (`reactive`, `plan-apply`, `adapter`) are nested inside one of those and are
	 * deliberately not counted: they arrive *after* their enclosing input scheduled
	 * its pair, so counting them would make an action impossible to complete.
	 */
	syncCount: number;
	/**
	 * The `syncCount` whose deferred flush/frame pair has been scheduled. An action
	 * cannot complete while this trails `syncCount`: the release is resolved before
	 * its boundaries are scheduled, so completing on the resolution would refuse the
	 * schedule that follows and silently drop the post-release flush and frame.
	 */
	scheduledThrough: number;
	/** Measures buffered until the path is resolved, so none is ever misnamed. */
	measures: SampleEntry[];
};

type P23BSession = {
	id: string;
	startedAt: number;
	endedAt: number | null;
	open: boolean;
	sequence: number;
	actions: P23BGesture[];
	byId: Map<number, P23BGesture>;
	byPointer: Map<number, P23BGesture>;
	fixtureResets: number;
	droppedBoundaries: number;
	settled: boolean;
};

/** Closed sessions stay readable so a caller can summarize after ending them. */
const sessions = new Map<string, P23BSession>();
const SESSION_HISTORY = 4;

let openSession: P23BSession | null = null;
let latestSessionId: string | null = null;
let activeGesture: P23BGesture | null = null;
let publishedPlanView: Omit<P23BCapturePlanViewEvidence, 'actions' | 'stable'> | null = null;
let sequence = 0;

/** P23B marks share the existing DEV + `__P2311_PERF__` switch. */
export function p23bInteractionPerfEnabled(): boolean {
	return import.meta.env.DEV && Boolean((globalThis as P23BPerfGlobals).__P2311_PERF__);
}

// ---------------------------------------------------------------------------
// capture session lifecycle
// ---------------------------------------------------------------------------

/** Open one isolated capture session. Samples recorded outside a session are dropped. */
export function p23bBeginInteractionCapture(): string {
	const id = crypto.randomUUID();
	const session: P23BSession = {
		id,
		startedAt: performance.now(),
		endedAt: null,
		open: true,
		sequence: 0,
		actions: [],
		byId: new Map(),
		byPointer: new Map(),
		fixtureResets: 0,
		droppedBoundaries: 0,
		settled: true
	};
	openSession = session;
	latestSessionId = id;
	activeGesture = null;
	sessions.set(id, session);
	while (sessions.size > SESSION_HISTORY) {
		const oldest = sessions.keys().next().value;
		if (oldest === undefined || oldest === id) break;
		sessions.delete(oldest);
	}
	return id;
}

export function p23bInteractionCaptureOpen(): boolean {
	return openSession !== null;
}

/** The session actions are currently recorded into, or `null`. */
export function p23bActiveInteractionSessionId(): string | null {
	return openSession?.id ?? null;
}

/**
 * Drain in-flight deferred boundaries so a summary can never be taken over a
 * half-written action. Returns false when the budget expires with boundaries
 * still pending; the caller then records an unsettled capture instead of
 * pretending it settled.
 */
export async function p23bSettleInteractionCapture(maxWaitMs = 1000): Promise<boolean> {
	const session = openSession;
	if (!session) return true;
	const deadline = performance.now() + maxWaitMs;
	for (;;) {
		const pending = session.actions.some((action) => action.status === 'active' && action.pending > 0);
		if (!pending) {
			session.settled = true;
			return true;
		}
		if (performance.now() >= deadline) {
			session.settled = false;
			return false;
		}
		await tick();
		await nextFrame();
	}
}

/**
 * Close the session. Actions still awaiting their outcome are marked incomplete
 * — reported, and excluded from every distribution — instead of being silently
 * treated as measured. Deferred callbacks that arrive after this point are
 * discarded and counted, never written into a later session.
 */
export function p23bEndInteractionCapture(): P23BCaptureLedger | null {
	const session = openSession;
	if (!session) return p23bInteractionCaptureLedger();
	for (const action of session.actions) {
		if (action.status === 'active') action.status = 'incomplete';
	}
	session.endedAt = performance.now();
	session.open = false;
	session.settled = session.actions.every((action) => action.pending === 0);
	openSession = null;
	activeGesture = null;
	latestSessionId = session.id;
	return p23bInteractionCaptureLedger();
}

/** Snapshot one session's ledger (the latest by default). */
export function p23bInteractionCaptureLedger(sessionId: string | null = latestSessionId): P23BCaptureLedger | null {
	const session = sessionId === null ? null : sessions.get(sessionId) ?? null;
	if (!session) return null;
	return {
		sessionId: session.id,
		startedAt: session.startedAt,
		endedAt: session.endedAt,
		fixtureResets: session.fixtureResets,
		droppedBoundaries: session.droppedBoundaries,
		settled: session.settled,
		actions: session.actions.map((action, index) => ({
			index,
			intent: action.intent,
			path: action.path,
			outcome: action.outcome,
			status: action.status === 'completed' ? 'completed' : 'incomplete',
			samples: action.samples.map((sample) => ({ ...sample })),
			planView: action.planView
		}))
	};
}

/**
 * Record one fixture reset — an operator action that puts the hosted fixture
 * back to its ratified document after an editing action. Declared because the
 * harness cannot see the editor's private layout state; the count travels with
 * the capture so reset discipline is auditable next to the accepted-action
 * count.
 */
export function p23bRecordFixtureReset(): void {
	if (openSession) openSession.fixtureResets += 1;
}

/**
 * Publish the live Plan viewport (DEV capture evidence for viewport equivalence).
 * The value is mirrored on a DEV global so the capture driver can zoom every
 * hosted fixture to the same px/m before recording instead of assuming it.
 */
export function p23bPublishPlanView(view: Omit<P23BCapturePlanViewEvidence, 'actions' | 'stable'> | null): void {
	if (!import.meta.env.DEV) return;
	publishedPlanView = view;
	(globalThis as typeof globalThis & { __P23B_PLAN_VIEW__?: unknown }).__P23B_PLAN_VIEW__ = view;
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

/**
 * Open an action. `deferPath` holds the press open until a later event names the
 * interaction (a select-tool press on a Wall both selects it and arms a move);
 * `deferOutcome` keeps a known path open until its outcome is reported (the
 * wall-tool press whose click decides setup/commit/refusal).
 */
export function p23bOpenGesture(
	intent: BenchInteractionPath,
	options: { pointerId?: number; deferPath?: boolean; deferOutcome?: boolean } = {}
): P23BGesture | null {
	if (!p23bInteractionPerfEnabled() || !openSession) return null;
	const session = openSession;
	const gesture: P23BGesture = {
		id: (session.sequence += 1),
		sessionId: session.id,
		intent,
		path: options.deferPath ? null : intent,
		outcome: null,
		samples: [],
		planView: null,
		pending: 0,
		awaiting: Boolean(options.deferPath || options.deferOutcome),
		scheduled: false,
		status: 'active',
		syncEnd: performance.now(),
		syncCount: 0,
		scheduledThrough: 0,
		measures: []
	};
	session.actions.push(gesture);
	session.byId.set(gesture.id, gesture);
	if (options.pointerId !== undefined) session.byPointer.set(options.pointerId, gesture);
	activeGesture = gesture;
	publishActive(gesture);
	return gesture;
}

/**
 * The interaction the ambient DEV records currently belong to, or `null`. The
 * live gesture-sampling readout reads it to attribute reuse to a path without
 * product code having to carry a second label (see
 * `p23b-gesture-sampling-report.ts`).
 */
export function p23bActiveInteraction(): {
	path: BenchInteractionPath;
	actionId: number | null;
} | null {
	const active = (globalThis as P23BPerfGlobals).__P23B_ACTIVE_INTERACTION__;
	if (!active) return null;
	return { path: active.path, actionId: active.actionId ?? null };
}

/** The open press action for one pointer, so its moves join the same gesture. */
export function p23bGestureForPointer(pointerId: number): P23BGesture | null {
	const gesture = openSession?.byPointer.get(pointerId) ?? null;
	return gesture && gesture.status === 'active' ? gesture : null;
}

/** True while an action is still waiting for a release or click to name it. */
export function p23bGestureAwaitingRelease(gesture: P23BGesture | null): boolean {
	return Boolean(gesture && gesture.status === 'active' && gesture.awaiting);
}

/** Measure one synchronous boundary of an action without changing its result. */
export function p23bMeasureGesture<T>(
	gesture: P23BGesture | null,
	path: BenchInteractionPath,
	boundary: BenchInteractionBoundary,
	work: () => T
): T {
	if (!gesture || !writable(gesture)) return work();
	const start = performance.now();
	activeGesture = gesture;
	publishActive(gesture);
	try {
		return work();
	} finally {
		const end = performance.now();
		gesture.syncEnd = end;
		gesture.planView ??= publishedPlanView ? { ...publishedPlanView, actions: 1, stable: true } : null;
		record(gesture, { boundary, start, end });
		activeGesture = gesture;
		publishActive(gesture);
	}
}

/**
 * Schedule an action's deferred boundaries. Both start where the synchronous
 * input ended (`gesture.syncEnd`), which is the origin rule this method version
 * exists to enforce, and both are now required: scheduling records that the
 * action's latest synchronous boundary is covered, so its outcome can be resolved
 * first and the pair can no longer be dropped by an early completion.
 */
export function p23bScheduleGestureBoundaries(gesture: P23BGesture | null): void {
	if (!gesture || !writable(gesture)) return;
	const origin = gesture.syncEnd;
	gesture.scheduled = true;
	gesture.scheduledThrough = gesture.syncCount;
	gesture.pending += 2;
	void tick().then(() => settleDeferred(gesture, 'svelte-flush', origin));
	scheduleFrame(() => settleDeferred(gesture, 'browser-frame', origin));
	completeIfSettled(gesture);
}

/**
 * Name an action's path and outcome. Completion still waits for the boundaries
 * the action's own last synchronous boundary requires, so a caller that resolves
 * before scheduling (every release and authoring-click call site does) keeps its
 * post-release flush and frame.
 */
export function p23bResolveGesture(
	gesture: P23BGesture | null,
	path: BenchInteractionPath,
	outcome: BenchInteractionOutcome | null
): void {
	if (!gesture) return;
	if (gesture.path === null) {
		gesture.path = path;
		flushBufferedMeasures(gesture);
	}
	if (outcome !== null) gesture.outcome = outcome;
	gesture.awaiting = false;
	completeIfSettled(gesture);
}

/**
 * Classify the action currently being measured. Used where the outcome is only
 * known inside the shipped handler (a direct edit's release verdict), so the
 * classification never has to move product logic into the instrumentation.
 */
export function p23bClassifyGestureOutcome(outcome: BenchInteractionOutcome): void {
	if (activeGesture && activeGesture.status === 'active') activeGesture.outcome = outcome;
}

// ---------------------------------------------------------------------------
// ambient attribution (nested measures, Svelte effects and adapter work)
// ---------------------------------------------------------------------------

/** Record the interaction the ambient effects belong to, opening a transient action if none is active. */
export function p23bActivateInteraction(path: BenchInteractionPath): void {
	if (!p23bInteractionPerfEnabled() || !openSession) return;
	const current = activeGesture;
	if (current && current.status === 'active' && (current.path === path || current.path === null)) {
		publishActive(current);
		return;
	}
	p23bOpenGesture(path);
}

/**
 * Measure one boundary into the action it belongs to. Nested boundaries
 * (`reactive`, `plan-apply`, `adapter`) stay inside the `input`/`release` call
 * that scheduled them, so their durations are contained by it, never added.
 */
export function p23bMeasureInteraction<T>(
	path: BenchInteractionPath,
	boundary: BenchInteractionBoundary,
	work: () => T
): T {
	const gesture = attachedGesture(path) ?? p23bOpenGesture(path);
	return p23bMeasureGesture(gesture, path, boundary, work);
}

/** Schedule the deferred boundaries of the action this input belongs to. */
export function p23bAfterInteraction(path: BenchInteractionPath): void {
	const gesture = activeGesture;
	if (!gesture || gesture.path !== path) return;
	p23bScheduleGestureBoundaries(gesture);
}

/** Attribute Three adapter CPU work to the input that scheduled it. */
export function p23bMeasureActiveAdapter<T>(work: () => T): T {
	return p23bMeasureAmbient('adapter', work);
}

/** Attribute a preview derive/install effect to the input that scheduled it. */
export function p23bMeasureActiveReactive<T>(work: () => T): T {
	return p23bMeasureAmbient('reactive', work);
}

/** Attribute the canonical planner/apply call to the input that scheduled it. */
export function p23bMeasureActivePlanApply<T>(work: () => T): T {
	return p23bMeasureAmbient('plan-apply', work);
}

function p23bMeasureAmbient<T>(boundary: BenchInteractionBoundary, work: () => T): T {
	const gesture = effectGesture();
	if (!gesture) return work();
	return p23bMeasureGesture(gesture, gesture.path ?? gesture.intent, boundary, work);
}

// ---------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------

/**
 * Aggregate one ledger: exclude the leading warm-up actions per path, keep
 * setup/rejected/suppressed/suppressed actions out of the accepted distribution,
 * and report the observed counts, outcomes, retries and lifecycle evidence
 * beside it. Pure — the harness records what this returns, nothing else.
 */
export function summarizeInteractionCapture(
	ledger: P23BCaptureLedger,
	options: {
		warmup: number;
		paths: readonly BenchInteractionPath[];
		boundaries: readonly BenchInteractionBoundary[];
		unavailable: (path: BenchInteractionPath, boundary: BenchInteractionBoundary) => string;
	}
): P23BCaptureSummary {
	const completed = ledger.actions.filter(
		(action): action is P23BActionLedger & { path: BenchInteractionPath } =>
			action.status === 'completed' && action.path !== null
	);
	const byPath = new Map<BenchInteractionPath, typeof completed>();
	for (const action of completed) {
		const list = byPath.get(action.path) ?? [];
		list.push(action);
		byPath.set(action.path, list);
	}
	const interactions: BenchInteractionReport = {};
	const interactionSampleCounts: Partial<Record<BenchInteractionPath, number>> = {};
	const warmupExcluded: Partial<Record<BenchInteractionPath, number>> = {};
	const completedActions: Partial<Record<BenchInteractionPath, number>> = {};
	const incompleteActions: Partial<Record<BenchInteractionPath, number>> = {};
	const unclassifiedActions: Partial<Record<BenchInteractionPath, number>> = {};
	const retries: Partial<Record<BenchInteractionPath, number>> = {};
	const outcomes: Partial<Record<BenchInteractionPath, BenchInteractionOutcomeCounts>> = {};

	for (const action of ledger.actions) {
		if (action.status !== 'incomplete') continue;
		const key = action.path ?? action.intent;
		incompleteActions[key] = (incompleteActions[key] ?? 0) + 1;
	}

	for (const path of options.paths) {
		const actions = byPath.get(path) ?? [];
		const warmupActions = actions.slice(0, Math.max(0, options.warmup));
		const measured = actions.slice(warmupActions.length);
		warmupExcluded[path] = warmupActions.length;
		completedActions[path] = actions.length;
		unclassifiedActions[path] = actions.filter((action) => action.outcome === null || action.outcome === 'unclassified').length;
		// Retries are walked over every action of the path, incomplete ones included:
		// an action that never resolved and had to be repeated is exactly the repeat
		// this count exists to make visible.
		retries[path] = countRetries(
			ledger.actions.filter((action) => (action.path ?? action.intent) === path)
		);
		outcomes[path] = countActionOutcomes(actions);
		const pathReport: NonNullable<BenchInteractionReport[BenchInteractionPath]> = {};
		for (const boundary of options.boundaries) {
			const observed = samplesOf(actions, boundary);
			if (observed.length === 0) {
				pathReport[boundary] = { unavailable: options.unavailable(path, boundary) };
				continue;
			}
			const accepted = samplesOf(
				measured.filter((action) => action.outcome === 'accepted'),
				boundary
			);
			pathReport[boundary] = {
				accepted: accepted.length > 0 ? summarize(accepted) : null,
				outcomes: countSampleOutcomes(actions, boundary),
				observedCount: observed.length,
				warmupExcludedActions: warmupActions.length
			};
		}
		interactions[path] = pathReport;
		const input = pathReport.input;
		interactionSampleCounts[path] = input && 'observedCount' in input ? input.observedCount : 0;
	}

	return {
		interactions,
		interactionSampleCounts,
		capture: {
			warmup: options.warmup,
			warmupExcluded,
			completedActions,
			incompleteActions,
			unclassifiedActions,
			retries,
			outcomes,
			fixtureResets: ledger.fixtureResets,
			droppedBoundaries: ledger.droppedBoundaries,
			settled: ledger.settled
		},
		planView: planViewEvidence(completed)
	};
}

/** Percentile used for every reported distribution (nearest-rank, upper). */
export function percentile(values: readonly number[], pct: number): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * pct) - 1)] ?? 0;
}

function summarize(values: readonly number[]): BenchInteractionSummary {
	return { count: values.length, p50: percentile(values, 0.5), p95: percentile(values, 0.95) };
}

function samplesOf(actions: readonly P23BActionLedger[], boundary: BenchInteractionBoundary): number[] {
	const values: number[] = [];
	for (const action of actions) {
		for (const sample of action.samples) if (sample.boundary === boundary) values.push(sample.duration);
	}
	return values;
}

function countSampleOutcomes(
	actions: readonly P23BActionLedger[],
	boundary: BenchInteractionBoundary
): BenchInteractionOutcomeCounts {
	const counts: BenchInteractionOutcomeCounts = {};
	for (const action of actions) {
		const outcome: BenchInteractionOutcome = action.outcome ?? 'unclassified';
		for (const sample of action.samples) {
			if (sample.boundary !== boundary) continue;
			counts[outcome] = (counts[outcome] ?? 0) + 1;
		}
	}
	return counts;
}

function countActionOutcomes(actions: readonly P23BActionLedger[]): BenchInteractionOutcomeCounts {
	const counts: BenchInteractionOutcomeCounts = {};
	for (const action of actions) {
		const outcome: BenchInteractionOutcome = action.outcome ?? 'unclassified';
		counts[outcome] = (counts[outcome] ?? 0) + 1;
	}
	return counts;
}

/**
 * A retry is an accepted action on a path that follows one or more non-accepted
 * or unresolved attempts on the same path. Warm-up actions count, because a
 * refused attempt during warm-up is still an attempt the operator repeated.
 */
function countRetries(actions: readonly P23BActionLedger[]): number {
	let retries = 0;
	let pendingAttempt = false;
	for (const action of actions) {
		if (action.outcome === 'accepted') {
			if (pendingAttempt) retries += 1;
			pendingAttempt = false;
		} else {
			pendingAttempt = true;
		}
	}
	return retries;
}

function planViewEvidence(actions: readonly P23BActionLedger[]): P23BCapturePlanViewEvidence | null {
	const views = actions.map((action) => action.planView).filter((view): view is P23BCapturePlanViewEvidence => view !== null);
	if (views.length === 0) return null;
	const first = views[0]!;
	const last = views[views.length - 1]!;
	// `stable` means the capture both started and ended in the same viewport: the
	// pan/zoom path deliberately moves the view mid-capture and restores it, so
	// requiring every action to share one snapshot would be false for that path.
	// The comparison is relative, because a restored view comes back through the
	// same float operations that moved it (a zoom pair multiplies by 1.12 and then
	// by 1/1.12), and last-bit noise is not a viewport change.
	const same = (a: number, b: number): boolean => Math.abs(a - b) <= Math.max(1, Math.abs(a)) * 1e-9;
	const stable =
		same(last.pixelsPerMeter, first.pixelsPerMeter) &&
		same(last.center[0], first.center[0]) &&
		same(last.center[1], first.center[1]);
	return {
		pixelsPerMeter: first.pixelsPerMeter,
		center: first.center,
		width: first.width,
		height: first.height,
		actions: views.length,
		stable
	};
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

function writable(gesture: P23BGesture): boolean {
	if (gesture.status !== 'active' || !p23bInteractionPerfEnabled()) return false;
	const session = sessions.get(gesture.sessionId);
	return Boolean(session && session.open && session === openSession);
}

function attachedGesture(path: BenchInteractionPath): P23BGesture | null {
	const gesture = activeGesture;
	if (!gesture || !writable(gesture)) return null;
	if (gesture.path === path) return gesture;
	if (gesture.path === null) return gesture;
	return null;
}

/** The action an effect belongs to, resolved from the ambient interaction record. */
function effectGesture(): P23BGesture | null {
	const actionId = (globalThis as P23BPerfGlobals).__P23B_ACTIVE_INTERACTION__?.actionId ?? null;
	if (actionId === null) return null;
	const gesture = openSession?.byId.get(actionId) ?? null;
	return gesture && writable(gesture) ? gesture : null;
}

function publishActive(gesture: P23BGesture): void {
	(globalThis as P23BPerfGlobals).__P23B_ACTIVE_INTERACTION__ = {
		path: gesture.path ?? gesture.intent,
		run: ++sequence,
		actionId: gesture.id
	};
}

function record(gesture: P23BGesture, entry: SampleEntry): void {
	gesture.samples.push({
		boundary: entry.boundary,
		duration: Math.max(0, entry.end - entry.start),
		start: entry.start,
		end: entry.end
	});
	if (entry.boundary === 'input' || entry.boundary === 'release') gesture.syncCount += 1;
	if (gesture.path === null) {
		gesture.measures.push(entry);
		return;
	}
	writeMeasure(gesture.path, entry);
}

function flushBufferedMeasures(gesture: P23BGesture): void {
	if (gesture.path === null) return;
	const buffered = gesture.measures.splice(0, gesture.measures.length);
	for (const entry of buffered) writeMeasure(gesture.path, entry);
}

function writeMeasure(path: BenchInteractionPath, entry: SampleEntry): void {
	performance.measure(`p2311:p23b:${path}:${entry.boundary}`, { start: entry.start, end: entry.end });
}

/**
 * One deferred boundary. Deferred callbacks carry the session they were
 * scheduled in: when that session has closed (or a later one is open) the
 * boundary is discarded and counted on its own session, so it can never appear
 * in another session's distributions.
 */
function settleDeferred(gesture: P23BGesture, boundary: BenchInteractionBoundary, origin: number): void {
	if (gesture.pending > 0) gesture.pending -= 1;
	const session = sessions.get(gesture.sessionId) ?? null;
	if (!session || !session.open || session !== openSession || gesture.status !== 'active') {
		if (session) session.droppedBoundaries += 1;
		return;
	}
	record(gesture, { boundary, start: origin, end: performance.now() });
	completeIfSettled(gesture);
}

function completeIfSettled(gesture: P23BGesture): void {
	if (gesture.status !== 'active' || gesture.awaiting || !gesture.scheduled) return;
	// The action's own last input/release must have its deferred pair scheduled
	// first. Without this, a press whose pair already settled (so `pending` is 0)
	// would complete the moment its release resolved the outcome, and the schedule
	// call right after it would be refused as not-writable — the post-release flush
	// and frame would never be recorded, and nothing would be counted as dropped.
	if (gesture.scheduledThrough < gesture.syncCount) return;
	if (gesture.pending > 0 || gesture.path === null) return;
	gesture.outcome ??= 'unclassified';
	gesture.status = 'completed';
	// DEV capture evidence: the last completed action, so an operator (or a capture
	// driver) can see what one action actually did and repeat a refused one, which is
	// then recorded as a retry instead of being silently averaged in.
	if (import.meta.env.DEV && openSession) {
		(globalThis as typeof globalThis & { __P23B_LAST_ACTION__?: unknown }).__P23B_LAST_ACTION__ = {
			index: gesture.id,
			path: gesture.path,
			outcome: gesture.outcome
		};
	}
	if (activeGesture === gesture) activeGesture = null;
}

function scheduleFrame(callback: () => void): void {
	if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => callback());
	else setTimeout(callback, 0);
}

function nextFrame(): Promise<void> {
	return new Promise((resolve) => scheduleFrame(resolve));
}
