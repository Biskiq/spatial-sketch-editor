import { describe, expect, it } from 'vitest';
import fixtureLedger from '../../../../../docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/fixture-ledger.json';
import { validateP23BBrowserReport } from '$lib/bench/record-baseline';
import { validateBaseline } from '$lib/bench/bench-report';
import {
	ADVISORY_INTERACTION_METRICS,
	ENFORCED_BUDGET_METRICS,
	type BenchInteractionPath,
	type BenchWorkloadResult,
	type BudgetBaseline,
	type P23BBrowserRunReport
} from '$lib/bench/bench-types';
import { BUDGETS } from '$lib/bench/record-baseline';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS, P23B_OWNER_FIXTURE_ID, P23B_OWNER_LAYOUT } from '$lib/bench/p23b-fixtures';
import { measureBrowserTier } from '$lib/bench/browser-bench';
import { measureNodeTier } from '$lib/bench/plan-bench';

const DEFERRAL = 'Owner decision: the guided 3D navigation capture is deferred for this contract test.';

const provenance: P23BBrowserRunReport['browser'] = {
	commitSha: '0123456789abcdef0123456789abcdef01234567',
	policyCommitSha: 'c11938fe0d5c721a896bb92dcb722f2273480feb',
	date: '2026-09-24T12:00:00.000Z',
	browser: { name: 'Chrome', version: '153.0.8010.54', userAgent: 'Chrome/153.0.8010.54' },
	deviceProfile: 'test browser; DPR 2',
	devicePixelRatio: 2,
	graphics: { api: 'WebGL2', vendor: 'GPU vendor', renderer: 'GPU renderer', version: 'WebGL 2', source: 'diagnostic-canvas' },
	nodeVersion: 'v24.0.0',
	machine: 'test CPU / 8 logical CPUs / 16 GB RAM',
	operatingSystem: 'macOS test',
	sessionId: 'session-test',
	warmup: 5,
	samples: 20,
	methodVersion: 4,
	treeDirty: false
};

/** The smallest baseline envelope that only fails on missing P23B interaction paths. */
function baselineStub(): BudgetBaseline {
	return {
		methodVersion: 4,
		methodVersionReason: 'test',
		budgets: BUDGETS,
		tiers: [],
		workloads: fixtureLedger.fixtures.filter((fixture) => fixture.semanticClass === 5).map((fixture) => ({
			fixtureId: fixture.id,
			semanticClass: 5 as const,
			role: fixture.role as BenchWorkloadResult['role'],
			canonicalLayoutSha256: fixture.canonicalLayoutSha256,
			roomCount: fixture.documentShape.rooms,
			provenance,
			samples: []
		})),
		interactions: validReport().interactions,
		interactionSampleCounts: validReport().interactionSampleCounts,
		interactionProtocol: validReport().interactionProtocol,
		markNestingNote: 'test',
		measurementLimitations: ['test']
	};
}

function validReport(): P23BBrowserRunReport {
	const workloads: BenchWorkloadResult[] = fixtureLedger.fixtures
		.filter((fixture) => fixture.semanticClass === 5)
		.map((fixture) => ({
			fixtureId: fixture.id,
			semanticClass: 5,
			role: fixture.role as BenchWorkloadResult['role'],
			canonicalLayoutSha256: fixture.canonicalLayoutSha256,
			...(fixture.rawPayloadSha256 ? { rawPayloadSha256: fixture.rawPayloadSha256 } : {}),
			roomCount: fixture.documentShape.rooms,
			provenance,
			samples: [{ metric: 'layout-compile', unit: 'ms', value: 1, p50: 1, p95: 2, runtime: 'browser' }]
		}));
	const paths: BenchInteractionPath[] = ['selection', 'plan-drag-edit', 'bend-knot-edit', 'wall-authoring', 'plan-pan-zoom', 'guided-3d-navigation'];
	const boundaries = ['input', 'release', 'reactive', 'adapter', 'svelte-flush', 'browser-frame'] as const;
	const interactions: NonNullable<P23BBrowserRunReport['interactions']> = {};
	const interactionProtocol: NonNullable<P23BBrowserRunReport['interactionProtocol']> = {};
	const interactionSampleCounts: NonNullable<P23BBrowserRunReport['interactionSampleCounts']> = {};
	for (const path of paths) {
		const deferred = path === 'guided-3d-navigation';
		interactions[path] = Object.fromEntries(boundaries.map((boundary) => [
			boundary,
			(boundary === 'input' || boundary === 'release') && !deferred
				? { count: 1, p50: 0.2, p95: 0.3 }
				: { unavailable: deferred ? DEFERRAL : 'not applicable in the narrow contract test' }
		])) as NonNullable<P23BBrowserRunReport['interactions'][BenchInteractionPath]>;
		interactionProtocol[path] = { target: `fixed ${path} target`, snapGrid: 'test-only' };
		if (!deferred) interactionSampleCounts[path] = 1;
	}
	return {
		methodVersion: 4,
		methodVersionReason: 'v4 separates the six bounded editor interaction timing boundaries.',
		createdAt: provenance.date,
		warmup: 5,
		samples: 20,
		browser: provenance,
		workloads,
		interactions,
		interactionProtocol,
		interactionSampleCounts,
		deferredInteractionPaths: { 'guided-3d-navigation': DEFERRAL },
		nestedMarks: { 'p2311:pointermove-bend': { count: 1, p50: 0.2, p95: 0.3 } },
		markNestingNote: 'Existing marks may be nested inside P23B boundaries; do not sum them.',
		measurementLimitations: ['test only']
	};
}

describe('P23B browser baseline contract', () => {
	it('accepts the exact six-cell matrix and separate owner fixture with browser provenance', () => {
		expect(() => validateP23BBrowserReport(validReport())).not.toThrow();
	});

	it('runs every wall-first timing fixture through the existing Node and browser benchmark tiers', () => {
		const provenance = {
			commitSha: '0123456789abcdef0123456789abcdef01234567',
			date: '2026-09-24T12:00:00.000Z',
			deviceProfile: 'fixture test',
			warmup: 1,
			samples: 2,
			methodVersion: 4
		};
		const fixtures = [
			...P23B_MATRIX_SPECS.map((spec) => ({ id: spec.id, document: buildP23BMatrixFixture(spec) })),
			{ id: P23B_OWNER_FIXTURE_ID, document: P23B_OWNER_LAYOUT }
		];
		for (const fixture of fixtures) {
			const node = measureNodeTier(fixture.document, 'small', provenance, { warmup: 1, samples: 2, hitPoints: 10, tolerance: 0.2 });
			const browser = measureBrowserTier(fixture.document, 'small', provenance, { warmup: 1, samples: 2 });
			expect(node.roomCount, fixture.id).toBe(fixture.document.rooms.length);
			expect(node.samples.some((sample) => sample.metric === 'layout-compile' && Number.isFinite(sample.p50)), fixture.id).toBe(true);
			expect(node.samples.some((sample) => sample.metric === 'wall-mesh-build' && Number.isFinite(sample.p50)), fixture.id).toBe(true);
			expect(browser.samples.some((sample) => sample.metric === 'plan-render-initial' && Number.isFinite(sample.p50)), fixture.id).toBe(true);
			expect(browser.samples.some((sample) => sample.metric === 'three-object-estimate' && sample.value > 0), fixture.id).toBe(true);
		}
	});

	it('requires a recorded owner deferral before a path may omit its input samples', () => {
		const undeferred = validReport();
		delete undeferred.deferredInteractionPaths;
		expect(() => validateP23BBrowserReport(undeferred)).toThrow(/no owner input samples for guided-3d-navigation/);
		const blank = validReport();
		blank.deferredInteractionPaths = { 'guided-3d-navigation': '   ' };
		expect(() => validateP23BBrowserReport(blank)).toThrow(/deferred path lacks its owner decision/);
		expect(validateBaseline({ ...baselineStub(), deferredInteractionPaths: { 'guided-3d-navigation': DEFERRAL } })).toEqual([]);
		expect(validateBaseline(baselineStub())).toContain('P23B baseline is missing input samples for guided-3d-navigation');
	});

	it('rejects changed fixture identities or missing browser provenance', () => {
		const report = validReport();
		report.workloads[0]!.canonicalLayoutSha256 = '0'.repeat(64);
		expect(() => validateP23BBrowserReport(report)).toThrow(/identity does not match the ledger/);
		const missingBrowser = validReport();
		missingBrowser.browser.browser = undefined;
		expect(() => validateP23BBrowserReport(missingBrowser)).toThrow(/browser\/session\/DPR\/machine\/OS\/Node provenance/);
	});

	it('keeps timing advisory and preserves the enforced deterministic budget set', () => {
		expect(ENFORCED_BUDGET_METRICS).toEqual([
			'compiled-memory', 'cache-key-code-units', 'svg-node-count', 'three-object-estimate',
			'three-material-estimate', 'three-draw-call-estimate', 'three-triangle-estimate'
		]);
		expect(ADVISORY_INTERACTION_METRICS.every((metric) => BUDGETS[metric] === undefined)).toBe(true);
	});
});
