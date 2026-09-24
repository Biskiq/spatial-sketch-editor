/**
 * Versioned benchmark report contract for the G3 performance harness.
 * Reports are serialized JSON with a provenance block; every metric has a
 * unit and (for time metrics) p50/p95 aggregates.
 */

export const BENCH_METHOD_VERSION = 4;

/** Bounded editor paths approved for P23B.0-durable interaction sampling. */
export type BenchInteractionPath =
	| 'selection'
	| 'plan-drag-edit'
	| 'bend-knot-edit'
	| 'wall-authoring'
	| 'plan-pan-zoom'
	| 'guided-3d-navigation';

/** Applicable boundaries for a sampled interaction; GPU/presentation is not implied. */
export type BenchInteractionBoundary =
	| 'input'
	| 'release'
	| 'reactive'
	| 'adapter'
	| 'svelte-flush'
	| 'browser-frame';

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
export type BenchInteractionBoundaryResult = BenchInteractionSummary | { unavailable: string };
export type BenchMarkSummary = { count: number; p50: number; p95: number };
export type BenchInteractionReport = Partial<
	Record<BenchInteractionPath, Partial<Record<BenchInteractionBoundary, BenchInteractionBoundaryResult>>>
>;
export type BenchInteractionProtocol = Partial<
	Record<BenchInteractionPath, { target: string; snapGrid: string }>
>;

/** Output from the in-browser P23B route; the CLI remains the only baseline writer. */
export type P23BBrowserRunReport = {
	methodVersion: number;
	methodVersionReason: string;
	createdAt: string;
	warmup: number;
	samples: number;
	browser: BenchProvenance;
	workloads: BenchWorkloadResult[];
	interactions: BenchInteractionReport;
	interactionSampleCounts: Partial<Record<BenchInteractionPath, number>>;
	interactionProtocol: BenchInteractionProtocol;
	/** Existing P23.11 marks observed during the same actions, kept separate from enclosing P23B marks. */
	nestedMarks: Record<string, BenchMarkSummary>;
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
	/** DEV-captured input/reactive/render-boundary samples for the six editor paths. */
	interactions?: BenchInteractionReport;
	interactionSampleCounts?: Partial<Record<BenchInteractionPath, number>>;
	/** Fixed targets and actual per-path snap/grid conditions for the owner case. */
	interactionProtocol?: BenchInteractionProtocol;
	nestedMarks?: Record<string, BenchMarkSummary>;
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
	'interaction-adapter',
	'interaction-svelte-flush',
	'interaction-browser-frame'
];
