import { describe, expect, it } from 'vitest';
import fixtureLedger from '../../../../../docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/fixture-ledger.json';
import { validateP23BBrowserReport } from '$lib/bench/record-baseline';
import { validateBaseline } from '$lib/bench/bench-report';
import {
	ADVISORY_INTERACTION_METRICS,
	ENFORCED_BUDGET_METRICS,
	type BenchInteractionBoundaryResult,
	type BenchInteractionFixtureCapture,
	type BenchInteractionOutcome,
	type BenchInteractionPath,
	type BenchInteractionReport,
	type BenchNotApplicableInteractionPaths,
	type BenchWorkloadResult,
	type BudgetBaseline,
	type P23BBrowserRunReport
} from '$lib/bench/bench-types';
import { BUDGETS } from '$lib/bench/record-baseline';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS, P23B_OWNER_FIXTURE_ID, P23B_OWNER_LAYOUT } from '$lib/bench/p23b-fixtures';
import { measureBrowserTier } from '$lib/bench/browser-bench';
import { measureNodeTier } from '$lib/bench/plan-bench';

const DEFERRAL = 'Owner decision: the guided 3D navigation capture is deferred for this contract test.';
const BEND_NOT_APPLICABLE =
	'p23b-40-wall-straight-v1 has no knots: every centerline in the all-straight control fixture is a straight segment, so the bend/knot path cannot be recorded on it.';
const HOSTED_IDS = [P23B_OWNER_FIXTURE_ID, 'p23b-40-wall-straight-v1', 'p23b-40-wall-all-curved-v1'] as const;
const WARMUP = 5;

const provenance: P23BBrowserRunReport['browser'] = {
	commitSha: '0123456789abcdef0123456789abcdef01234567',
	policyCommitSha: 'c11938fe0d5c721a896bb92dcb722f2273480feb',
	date: '2026-09-24T12:00:00.000Z',
	browser: { name: 'Chromium', version: '130.0.6723.191', userAgent: 'Chromium/130.0.6723.191' },
	deviceProfile: 'test browser; DPR 1',
	devicePixelRatio: 1,
	graphics: { api: 'WebGL2', vendor: 'GPU vendor', renderer: 'GPU renderer', version: 'WebGL 2', source: 'diagnostic-canvas' },
	nodeVersion: 'v26.0.0',
	machine: 'test CPU / 8 logical CPUs / 16 GB RAM',
	operatingSystem: 'macOS test',
	sessionId: 'browser-session',
	warmup: 5,
	samples: 20,
	methodVersion: 5,
	treeDirty: false
};

const PATHS: BenchInteractionPath[] = [
	'selection', 'plan-drag-edit', 'bend-knot-edit', 'wall-authoring', 'plan-pan-zoom', 'guided-3d-navigation'
];
const BOUNDARIES = ['input', 'release', 'reactive', 'plan-apply', 'adapter', 'svelte-flush', 'browser-frame'] as const;

function ledgerEntry(id: string) {
	const entry = fixtureLedger.fixtures.find((fixture) => fixture.id === id);
	if (!entry) throw new Error(`Missing ledger entry ${id}`);
	return entry;
}

function acceptedResult(count: number, outcomes: Partial<Record<BenchInteractionOutcome, number>>): BenchInteractionBoundaryResult {
	const observed = Object.values(outcomes).reduce((total, value) => total + (value ?? 0), 0);
	return { accepted: { count, p50: 1, p95: 2 }, outcomes, observedCount: observed, warmupExcludedActions: WARMUP };
}

function captureFor(id: string, index: number): BenchInteractionFixtureCapture {
	const entry = ledgerEntry(id);
	const notApplicable: BenchNotApplicableInteractionPaths =
		id === 'p23b-40-wall-straight-v1' ? { 'bend-knot-edit': BEND_NOT_APPLICABLE } : {};
	const interactions: BenchInteractionReport = {};
	const interactionSampleCounts: Partial<Record<BenchInteractionPath, number>> = {};
	for (const path of PATHS) {
		const report: NonNullable<BenchInteractionReport[BenchInteractionPath]> = {};
		const unavailable = path === 'guided-3d-navigation' || Boolean(notApplicable[path]);
		for (const boundary of BOUNDARIES) {
			if (unavailable) {
				report[boundary] = { unavailable: path === 'guided-3d-navigation' ? DEFERRAL : BEND_NOT_APPLICABLE };
				continue;
			}
			report[boundary] =
				boundary === 'input' || boundary === 'release'
					? acceptedResult(20, { accepted: 20, setup: 25, rejected: 3 })
					: boundary === 'adapter' || boundary === 'reactive' || boundary === 'plan-apply'
						? boundary === 'plan-apply' || boundary === 'reactive'
							? acceptedResult(20, { accepted: 20, unclassified: 40 })
							: { unavailable: `${path} does not rebuild render geometry.` }
						: acceptedResult(20, { accepted: 20, unclassified: 20 });
		}
		interactions[path] = report;
		if (!unavailable) interactionSampleCounts[path] = 45;
	}
	return {
		fixtureId: id,
		semanticClass: 5,
		role: entry.role as BenchWorkloadResult['role'],
		canonicalLayoutSha256: entry.canonicalLayoutSha256,
		...(entry.rawPayloadSha256 ? { rawPayloadSha256: entry.rawPayloadSha256 } : {}),
		sessionId: `interaction-session-${index}`,
		startedAt: provenance.date,
		endedAt: provenance.date,
		protocol: Object.fromEntries(PATHS.map((path) => [path, { target: `fixed ${path} target`, snapGrid: 'test-only' }])) as NonNullable<P23BBrowserRunReport['interactionFixtures'][number]['protocol']>,
		notApplicableInteractionPaths: notApplicable,
		planView: { pixelsPerMeter: 17.19, center: [-1.5, -1.5], width: 772, height: 806, actions: 60, stable: true },
		interactions,
		interactionSampleCounts,
		capture: {
			warmup: WARMUP,
			warmupExcluded: Object.fromEntries(PATHS.filter((path) => !notApplicable[path] && path !== 'guided-3d-navigation').map((path) => [path, WARMUP])),
			completedActions: Object.fromEntries(PATHS.filter((path) => !notApplicable[path] && path !== 'guided-3d-navigation').map((path) => [path, 25])),
			incompleteActions: {},
			unclassifiedActions: { selection: 0 },
			retries: { 'wall-authoring': 3 },
			outcomes: { 'wall-authoring': { accepted: 25, setup: 25, rejected: 3 } },
			fixtureResets: 25,
			droppedBoundaries: 0,
			settled: true
		},
		nestedMarks: { 'p2311:pointermove-bend': { count: 1, p50: 0.2, p95: 0.3 } }
	};
}

function workloads(): BenchWorkloadResult[] {
	return fixtureLedger.fixtures
		.filter((fixture) => fixture.semanticClass === 5)
		.map((fixture) => ({
			fixtureId: fixture.id,
			semanticClass: 5 as const,
			role: fixture.role as BenchWorkloadResult['role'],
			canonicalLayoutSha256: fixture.canonicalLayoutSha256,
			...(fixture.rawPayloadSha256 ? { rawPayloadSha256: fixture.rawPayloadSha256 } : {}),
			roomCount: fixture.documentShape.rooms,
			// Cloned per report: a test that mutates one report's provenance must never
			// leak into the next report built from this shared fixture.
			provenance: structuredClone(provenance),
			samples: [{ metric: 'layout-compile', unit: 'ms', value: 1, p50: 1, p95: 2, runtime: 'browser' }]
		}));
}

function validReport(): P23BBrowserRunReport {
	return {
		methodVersion: 5,
		methodVersionReason: 'v5 separates deferred-boundary origins, plan-apply from adapter, and classifies every interaction action by outcome.',
		createdAt: provenance.date,
		warmup: 5,
		samples: 20,
		browser: structuredClone(provenance),
		workloads: workloads(),
		interactionFixtures: HOSTED_IDS.map((id, index) => captureFor(id, index)),
		deferredInteractionPaths: { 'guided-3d-navigation': DEFERRAL },
		markNestingNote: 'Existing marks nest inside P23B boundaries and the frame encloses its own flush; do not sum them.',
		measurementLimitations: ['test only']
	};
}

/** The smallest baseline envelope that still exercises the baseline-level P23B checks. */
function baselineStub(): BudgetBaseline {
	const report = validReport();
	return {
		methodVersion: 5,
		methodVersionReason: 'test',
		budgets: BUDGETS,
		tiers: [],
		workloads: report.workloads,
		interactionFixtures: report.interactionFixtures,
		deferredInteractionPaths: report.deferredInteractionPaths,
		markNestingNote: report.markNestingNote,
		measurementLimitations: report.measurementLimitations
	};
}

describe('P23B browser baseline contract (method v5)', () => {
	it('accepts the owner workload plus both size-40 matrix cells with isolated sessions', () => {
		expect(() => validateP23BBrowserReport(validReport())).not.toThrow();
	});

	it('requires every hosted fixture to be captured in its own isolated session', () => {
		const report = validReport();
		report.interactionFixtures[1]!.sessionId = report.interactionFixtures[0]!.sessionId;
		expect(() => validateP23BBrowserReport(report)).toThrow(/distinct isolated sessions/);
		const shortened = validReport();
		shortened.interactionFixtures = shortened.interactionFixtures.slice(0, 2);
		expect(() => validateP23BBrowserReport(shortened)).toThrow(/exactly 3 hosted fixtures/);
	});

	it('rejects a capture that did not settle, dropped a boundary, or skipped the warm-up exclusion', () => {
		const unsettled = validReport();
		unsettled.interactionFixtures[0]!.capture.settled = false;
		expect(() => validateP23BBrowserReport(unsettled)).toThrow(/did not settle/);

		const dropped = validReport();
		dropped.interactionFixtures[0]!.capture.droppedBoundaries = 1;
		expect(() => validateP23BBrowserReport(dropped)).toThrow(/dropped deferred boundaries/);

		const notExcluded = validReport();
		notExcluded.interactionFixtures[0]!.capture.warmupExcluded = {};
		expect(() => validateP23BBrowserReport(notExcluded)).toThrow(/warm-up exclusion was not applied/);
	});

	it('requires an accepted release distribution for every applicable path', () => {
		const report = validReport();
		const release = report.interactionFixtures[0]!.interactions['wall-authoring']!.release as Exclude<BenchInteractionBoundaryResult, { unavailable: string }>;
		release.accepted = null;
		expect(() => validateP23BBrowserReport(report)).toThrow(/accepted sample|accepted release distribution/);
	});

	it('never lets a setup or refused action be counted as an accepted commit', () => {
		const report = validReport();
		const capture = report.interactionFixtures[0]!;
		capture.capture.outcomes['wall-authoring'] = { accepted: 25, setup: 25, rejected: 3 };
		capture.capture.fixtureResets = 24; // one accepted commit without a recorded reset
		expect(() => validateP23BBrowserReport(report)).toThrow(/fixture reset for every accepted authoring action/);
	});

	it('keeps the all-straight control straight: the bend path is not applicable, never converted or sampled', () => {
		const okay = validReport();
		expect(okay.interactionFixtures[1]!.notApplicableInteractionPaths['bend-knot-edit']).toContain('no knots');
		expect(okay.interactionFixtures[1]!.interactionSampleCounts['bend-knot-edit']).toBeUndefined();
		expect(() => validateP23BBrowserReport(okay)).not.toThrow();

		const converted = validReport();
		converted.interactionFixtures[1]!.interactionSampleCounts['bend-knot-edit'] = 25;
		expect(() => validateP23BBrowserReport(converted)).toThrow(/must carry no samples for bend-knot-edit/);
	});

	it('requires the same viewport within 2% across hosted fixtures', () => {
		const report = validReport();
		report.interactionFixtures[2]!.planView = { ...report.interactionFixtures[2]!.planView!, pixelsPerMeter: 24 };
		expect(() => validateP23BBrowserReport(report)).toThrow(/same px\/m/);
	});

	it('rejects changed fixture identities and missing browser provenance', () => {
		const report = validReport();
		report.interactionFixtures[0]!.canonicalLayoutSha256 = '0'.repeat(64);
		expect(() => validateP23BBrowserReport(report)).toThrow(/identity changed/);
		const missingBrowser = validReport();
		missingBrowser.browser.browser = undefined;
		expect(() => validateP23BBrowserReport(missingBrowser)).toThrow(/browser\/session\/DPR\/machine\/OS\/Node provenance/);
	});

	it('requires a recorded owner deferral before a path may omit its samples', () => {
		const undeferred = validReport();
		delete undeferred.deferredInteractionPaths;
		expect(() => validateP23BBrowserReport(undeferred)).toThrow(/no observed input samples for guided-3d-navigation/);
		const blank = validReport();
		blank.deferredInteractionPaths = { 'guided-3d-navigation': '   ' };
		expect(() => validateP23BBrowserReport(blank)).toThrow(/deferred path lacks its owner decision/);
	});

	it('accepts the baseline document and reports the flattened interaction evidence', () => {
		expect(validateBaseline(baselineStub())).toEqual([]);
		const missingFixture = { ...baselineStub() };
		delete missingFixture.interactionFixtures;
		expect(validateBaseline(missingFixture)).toContain(
			'P23B baseline must carry the three hosted interaction fixtures (owner + size-40 straight/all-curved)'
		);
		const noWarmup = structuredClone(baselineStub());
		noWarmup.interactionFixtures![0]!.capture.warmup = 0;
		expect(validateBaseline(noWarmup).some((problem) => problem.includes('five-action interaction warm-up'))).toBe(true);
	});

	it('keeps interaction timing advisory and preserves the enforced deterministic budget set', () => {
		expect(ENFORCED_BUDGET_METRICS).toEqual([
			'compiled-memory', 'cache-key-code-units', 'svg-node-count', 'three-object-estimate',
			'three-material-estimate', 'three-draw-call-estimate', 'three-triangle-estimate'
		]);
		expect(ADVISORY_INTERACTION_METRICS).toContain('interaction-plan-apply');
		expect(ADVISORY_INTERACTION_METRICS.every((metric) => BUDGETS[metric] === undefined)).toBe(true);
	});

	it('runs every wall-first timing fixture through the existing Node and browser benchmark tiers', () => {
		const benchProvenance = {
			commitSha: '0123456789abcdef0123456789abcdef01234567',
			date: '2026-09-24T12:00:00.000Z',
			deviceProfile: 'fixture test',
			warmup: 1,
			samples: 2,
			methodVersion: 5
		};
		const fixtures = [
			...P23B_MATRIX_SPECS.map((spec) => ({ id: spec.id, document: buildP23BMatrixFixture(spec) })),
			{ id: P23B_OWNER_FIXTURE_ID, document: P23B_OWNER_LAYOUT }
		];
		for (const fixture of fixtures) {
			const node = measureNodeTier(fixture.document, 'small', benchProvenance, { warmup: 1, samples: 2, hitPoints: 10, tolerance: 0.2 });
			const browser = measureBrowserTier(fixture.document, 'small', benchProvenance, { warmup: 1, samples: 2 });
			expect(node.roomCount, fixture.id).toBe(fixture.document.rooms.length);
			expect(node.samples.some((sample) => sample.metric === 'layout-compile' && Number.isFinite(sample.p50)), fixture.id).toBe(true);
			expect(node.samples.some((sample) => sample.metric === 'wall-mesh-build' && Number.isFinite(sample.p50)), fixture.id).toBe(true);
			expect(browser.samples.some((sample) => sample.metric === 'plan-render-initial' && Number.isFinite(sample.p50)), fixture.id).toBe(true);
			expect(browser.samples.some((sample) => sample.metric === 'three-object-estimate' && sample.value > 0), fixture.id).toBe(true);
		}
	});
});
