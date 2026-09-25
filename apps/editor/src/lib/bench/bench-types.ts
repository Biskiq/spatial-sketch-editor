/**
 * Versioned benchmark report contract for the G3 performance harness.
 * Reports are serialized JSON with a provenance block; every metric has a
 * unit and (for time metrics) p50/p95 aggregates.
 */

export const BENCH_METHOD_VERSION = 5;

/** Bounded editor paths approved for P23B.0-durable interaction sampling. */
export type BenchInteractionPath =
	| 'selection'
	| 'plan-drag-edit'
	| 'bend-knot-edit'
	| 'wall-authoring'
	| 'plan-pan-zoom'
	| 'guided-3d-navigation';

/**
 * Applicable boundaries for a sampled interaction. Two origin rules apply, and
 * both are stated here because the previous method version pooled them:
 *
 * - `input`, `release`, `reactive`, `plan-apply` and `adapter` are SYNCHRONOUS
 *   boundaries measured `[call start, call end]`. `reactive`, `plan-apply` and
 *   `adapter` nest inside the synchronous `input`/`release` call that scheduled
 *   them, so their durations are contained by it, never added to it.
 * - `svelte-flush` and `browser-frame` are DEFERRED boundaries and always start
 *   at the completion of that same synchronous call — never at its start. So
 *   `svelte-flush` = `[input end, tick resolution]` and `browser-frame` =
 *   `[input end, next requestAnimationFrame callback]`, which encloses the
 *   flush. GPU upload and painted presentation are not implied by either.
 */
export type BenchInteractionBoundary =
	| 'input'
	| 'release'
	| 'reactive'
	| 'plan-apply'
	| 'adapter'
	| 'svelte-flush'
	| 'browser-frame';

/**
 * The outcome an action actually reached. Samples are classified by it so an
 * accepted-release distribution can never be inflated by the setup, refused or
 * suppressed actions that share the same boundary.
 *
 * - `accepted` — the action ran to its own completion and was neither refused
 *   nor suppressed (a committed edit, a completed selection, pan or hover).
 * - `setup` — the action only opened a transient run; it committed no geometry.
 * - `rejected` — the canonical planner or validator refused the action.
 * - `suppressed` — the action was consumed before its handler could run.
 * - `unclassified` — no outcome was reported; recorded as a gap, never assumed.
 */
export type BenchInteractionOutcome =
	| 'accepted'
	| 'setup'
	| 'rejected'
	| 'suppressed'
	| 'unclassified';

export type BenchInteractionOutcomeCounts = Partial<Record<BenchInteractionOutcome, number>>;

export type BenchMetricName =
	| 'layout-compile'
	| 'plan-render-build'
	| 'plan-render-initial'
	| 'plan-render-work-pan-zoom'
	| 'plan-render-work-edit'
	| 'hit-test'
	| 'snap-query'
	| 'svg-node-count'
	| 'three-object-estimate'
	| 'three-material-estimate'
	| 'three-draw-call-estimate'
	| 'three-triangle-estimate'
	| 'gpu-frame'
	| 'memory-heap'
	| 'compiled-memory'
	| 'cache-key-code-units'
	| 'wall-mesh-build'
	| 'interaction-input'
	| 'interaction-release'
	| 'interaction-reactive'
	| 'interaction-plan-apply'
	| 'interaction-adapter'
	| 'interaction-svelte-flush'
	| 'interaction-browser-frame';

export type BenchUnit = 'ms' | 'count' | 'bytes' | 'nodes';

export type BenchTier = 'chopin' | 'small' | 'medium' | 'large';

export type BenchProvenance = {
	commitSha: string;
	/** Commit that landed the required P23B.3a post-policy validator. */
	policyCommitSha?: string;
	date: string;
	browser?: { name: string; version: string; userAgent?: string };
	deviceProfile: string;
	/** Observed browser output scale; omitted when no live editor browser was measured. */
	devicePixelRatio?: number;
	/** Graphics details visible from the active browser canvas, not inferred GPU work. */
	graphics?: {
		api: 'WebGL' | 'WebGL2' | 'WebGPU' | 'unknown';
		vendor?: string;
		renderer?: string;
		version?: string;
		source: 'active-editor-canvas' | 'diagnostic-canvas';
	};
	/** Node version used by the existing recorder tier, when applicable. */
	nodeVersion?: string;
	/** Reference host machine and operating-system details observed at run time. */
	machine?: string;
	operatingSystem?: string;
	/** One run/session identifier shared by the measured fixture matrix. */
	sessionId?: string;
	warmup: number;
	samples: number;
	methodVersion: number;
	/** True when the working tree was dirty at record time (baseline not reproducible from HEAD alone). */
	treeDirty?: boolean;
	/** Deterministic content hash of the relevant sources, so a dirty-tree baseline stays reproducible. */
	contentHash?: string;
};

export type BenchSample = {
	metric: BenchMetricName;
	unit: BenchUnit;
	/** Present only for the bounded P23B editor interaction metrics. */
	path?: BenchInteractionPath;
	/** Present only for the bounded P23B editor interaction metrics. */
	boundary?: BenchInteractionBoundary;
	/** Runtime that observed this sample; existing legacy metrics may omit it. */
	runtime?: 'node' | 'browser';
	/** Representative value: p50 for time metrics, exact count/size otherwise. */
	value: number;
	p50?: number;
	p95?: number;
};

export type BenchTierResult = {
	tier: BenchTier;
	seed?: number;
	roomCount?: number;
	provenance: BenchProvenance;
	samples: BenchSample[];
};

/** A CLASS 5 fixture measured within the existing baseline envelope. */
export type BenchWorkloadResult = {
	fixtureId: string;
	semanticClass: 5;
	role: 'control' | 'timing-target' | 'owner-responsiveness';
	canonicalLayoutSha256: string;
	rawPayloadSha256?: string;
	roomCount: number;
	provenance: BenchProvenance;
	samples: BenchSample[];
};

export type BenchInteractionSummary = { count: number; p50: number; p95: number };
export type BenchMarkSummary = { count: number; p50: number; p95: number };

/**
 * One boundary's evidence for one path in one hosted fixture. `accepted` is the
 * reported distribution: warm-up actions excluded, accepted samples only, so it
 * is the accepted-release latency when the boundary is `release`. `outcomes`
 * counts every recorded sample by outcome, and `observedCount` is the raw
 * recorded count including warm-up, so a gap can never hide behind an average.
 */
export type BenchInteractionBoundaryResult =
	| {
			accepted: BenchInteractionSummary | null;
			outcomes: BenchInteractionOutcomeCounts;
			observedCount: number;
			warmupExcludedActions: number;
		}
	| { unavailable: string };

export type BenchInteractionReport = Partial<
	Record<BenchInteractionPath, Partial<Record<BenchInteractionBoundary, BenchInteractionBoundaryResult>>>
>;
export type BenchInteractionProtocol = Partial<
	Record<BenchInteractionPath, { target: string; snapGrid: string }>
>;

/**
 * Paths whose owner-deferred capture has no input/release sample, with the
 * recorded decision text that authorizes the gap. An unavailable boundary is
 * only admissible when its path appears here.
 */
export type BenchDeferredInteractionPaths = Partial<Record<BenchInteractionPath, string>>;

/**
 * A path that cannot exist on a hosted fixture's geometry, with the reason (for
 * example a bend/knot path on the all-straight control fixture, which has no
 * knots at all). Recorded instead of silently omitted, and never used to excuse
 * a path that only failed to be captured.
 */
export type BenchNotApplicableInteractionPaths = Partial<Record<BenchInteractionPath, string>>;

/** The Plan viewport the hosted fixture's actions were performed in. */
export type P23BCapturePlanViewEvidence = {
	pixelsPerMeter: number;
	center: [number, number];
	width: number;
	height: number;
	/** Measured actions that published a view snapshot. */
	actions: number;
	/**
	 * True when the first and last published snapshots agree, so the capture both
	 * started and ended in one viewport. The pan/zoom path deliberately moves the
	 * view while it is measured and restores it, so requiring every action to share
	 * one snapshot would be false for that path by construction.
	 */
	stable: boolean;
};

/** One measured action (a whole press→release gesture, click or pointer move). */
export type P23BActionLedger = {
	index: number;
	/** The path the action opened with; a select-tool press may open as `selection` and end as a drag. */
	intent: BenchInteractionPath;
	/** The path the action actually took; `null` only while unresolved. */
	path: BenchInteractionPath | null;
	outcome: BenchInteractionOutcome | null;
	status: 'completed' | 'incomplete';
	samples: { boundary: BenchInteractionBoundary; duration: number }[];
	/** Plan viewport observed when this action ran; `null` when none was published. */
	planView: P23BCapturePlanViewEvidence | null;
};

/**
 * What one capture session recorded, before warm-up exclusion and aggregation.
 * `fixtureResets` are operator-declared re-seeds of the ratified fixture
 * document; `droppedBoundaries` are deferred boundaries that arrived after
 * their session closed and were discarded rather than written into a later one.
 */
export type P23BCaptureLedger = {
	sessionId: string;
	startedAt: number;
	endedAt: number | null;
	fixtureResets: number;
	droppedBoundaries: number;
	settled: boolean;
	actions: P23BActionLedger[];
};

/** Warm-up, completion, retry and reset evidence for one hosted fixture. */
export type BenchInteractionCaptureSummary = {
	/** Leading completed actions per path excluded before the accepted distribution. */
	warmup: number;
	warmupExcluded: Partial<Record<BenchInteractionPath, number>>;
	completedActions: Partial<Record<BenchInteractionPath, number>>;
	incompleteActions: Partial<Record<BenchInteractionPath, number>>;
	/** Completed actions that never reported an outcome — a visible evidence gap. */
	unclassifiedActions: Partial<Record<BenchInteractionPath, number>>;
	/** Completed actions repeated after a non-accepted attempt on the same path. */
	retries: Partial<Record<BenchInteractionPath, number>>;
	outcomes: Partial<Record<BenchInteractionPath, BenchInteractionOutcomeCounts>>;
	fixtureResets: number;
	droppedBoundaries: number;
	settled: boolean;
};

/** One hosted fixture's interaction capture, recorded in one browser session. */
export type BenchInteractionFixtureCapture = {
	/** Hosted fixture id: the owner workload or one of the size-40 matrix cells. */
	fixtureId: string;
	semanticClass: 5;
	role: BenchWorkloadResult['role'];
	canonicalLayoutSha256: string;
	rawPayloadSha256?: string;
	/** Session this fixture's actions were recorded in. */
	sessionId: string;
	startedAt: string;
	endedAt: string;
	/** Fixed targets and snap/grid settings, stated per hosted fixture. */
	protocol: BenchInteractionProtocol;
	/** Paths this fixture's geometry cannot host, with the reason. */
	notApplicableInteractionPaths: BenchNotApplicableInteractionPaths;
	/** The Plan viewport observed while the actions ran, or `null` if unpublished. */
	planView: P23BCapturePlanViewEvidence | null;
	interactions: BenchInteractionReport;
	interactionSampleCounts: Partial<Record<BenchInteractionPath, number>>;
	capture: BenchInteractionCaptureSummary;
	/** Existing P23.11 marks observed during the same actions, kept separate and never summed. */
	nestedMarks: Record<string, BenchMarkSummary>;
};

/** Aggregated result of one capture ledger: the report, its raw counts, and its evidence. */
export type P23BCaptureSummary = {
	interactions: BenchInteractionReport;
	interactionSampleCounts: Partial<Record<BenchInteractionPath, number>>;
	capture: BenchInteractionCaptureSummary;
	planView: P23BCapturePlanViewEvidence | null;
};

/** Output from the in-browser P23B route; the CLI remains the only baseline writer. */
export type P23BBrowserRunReport = {
	methodVersion: number;
	methodVersionReason: string;
	createdAt: string;
	warmup: number;
	samples: number;
	browser: BenchProvenance;
	workloads: BenchWorkloadResult[];
	/** Every hosted fixture's interaction capture, in capture order, in one browser session. */
	interactionFixtures: BenchInteractionFixtureCapture[];
	/** Owner decisions that defer a bounded path's capture; empty when none is deferred. */
	deferredInteractionPaths?: BenchDeferredInteractionPaths;
	markNestingNote: string;
	measurementLimitations: string[];
};

export type Budget = {
	/** Budget that must hold at the golden-fixture scale. */
	target: number;
	/** Hard regression bound: exceeding this fails the budget check (when enforced). */
	fail: number;
	/** Recorded measurement reason for this budget. */
	reason: string;
};

export type BudgetBaseline = {
	methodVersion: number;
	/** Records why timing semantics changed when the version was bumped. */
	methodVersionReason?: string;
	/** Budgets apply to the `chopin` frozen golden-fixture tier only. */
	budgets: Partial<Record<BenchMetricName, Budget>>;
	/** Comparison tiers; recorded, never enforced. */
	tiers: BenchTierResult[];
	/** Ratified P23B.0 six-cell matrix plus its separate owner responsiveness fixture. */
	workloads?: BenchWorkloadResult[];
	/** DEV-captured interaction samples for each hosted fixture, each in its own session. */
	interactionFixtures?: BenchInteractionFixtureCapture[];
	/** Paths the owner explicitly deferred, so their gap stays auditable. */
	deferredInteractionPaths?: BenchDeferredInteractionPaths;
	markNestingNote?: string;
	/** Measurement limits retained explicitly in the baseline evidence. */
	measurementLimitations?: string[];
};

/**
 * Metrics the budget check enforces against the frozen Chopin golden fixture.
 * Every metric here must be present in the measured result, budgeted in the
 * baseline, and under its `fail` bound — otherwise the check fails closed.
 * These are all deterministic (exact counts/sizes), so they assert that the
 * compile/mesh pipeline produces the same output for the same input rather
 * than measuring wall-clock speed.
 */
export const ENFORCED_BUDGET_METRICS: readonly BenchMetricName[] = [
	'compiled-memory',
	'cache-key-code-units',
	'svg-node-count',
	'three-object-estimate',
	'three-material-estimate',
	'three-draw-call-estimate',
	'three-triangle-estimate'
];

/**
 * Wall-clock timing metrics. Recorded and budgeted for reference but not
 * enforced: they depend on machine load, and the product scale is now
 * greenfield editor projects rather than Chopin. Re-enable once a representative
 * editor fixture and stable CI hardware exist.
 */
export const ADVISORY_BUDGET_METRICS: readonly BenchMetricName[] = [
	'layout-compile',
	'plan-render-build',
	'wall-mesh-build',
	'hit-test',
	'snap-query'
];

/** New P23B interaction timings are advisory samples without numeric budgets. */
export const ADVISORY_INTERACTION_METRICS: readonly BenchMetricName[] = [
	'interaction-input',
	'interaction-release',
	'interaction-reactive',
	'interaction-plan-apply',
	'interaction-adapter',
	'interaction-svelte-flush',
	'interaction-browser-frame'
];
