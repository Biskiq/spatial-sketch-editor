import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { chopinProject } from '$lib/content/chopin-project';
import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from '../../../tests/lib/layout/__fixtures__/layout-scale-fixtures';
import fixtureLedger from '../../../../../docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/fixture-ledger.json';
import {
	buildP23BCorrectnessFixture,
	buildP23BMatrixFixture,
	P23B_CORRECTNESS_SPECS,
	P23B_MATRIX_SPECS,
	P23B_OWNER_FIXTURE_ID,
	P23B_OWNER_LAYOUT
} from './p23b-fixtures';
import { measureNodeTier, makeNodeProvenance, DEFAULT_NODE_OPTIONS, type NodeTierOptions } from './plan-bench';
import { chopinWallMeshRenderPolicyFactory, measureBrowserTier, type BrowserTierOptions } from './browser-bench';
import {
	compileWallFirstLayoutGeometry,
	serializeWallFirstLayoutDocument,
	validateWallFirstLayoutDocument,
	validateWallFirstTopology
} from '$lib/layout/layout-geometry';
import {
	BENCH_METHOD_VERSION,
	type BenchMetricName,
	type BenchProvenance,
	type BenchTier,
	type BenchTierResult,
	type Budget,
	type BudgetBaseline,
	type P23BBrowserRunReport
} from './bench-types';

/**
 * Executable version-5 baseline recorder. Invoked via the `bench:record` npm
 * script (never a default-suite test, so `npm test` cannot rewrite the checked-in
 * baseline). Measures the Node + browser tiers for Chopin and the generated
 * scale fixtures, stamps version-5 provenance (HEAD SHA + `treeDirty` flag +
 * deterministic `contentHash` of the relevant sources), and writes
 * `g3-baseline.json`.
 */

const APPS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const REPO_ROOT = resolve(APPS_ROOT, '../..');
/** Output path for the recorded baseline (used by the `bench:record` CLI runner). */
export const BASELINE_PATH = resolve(APPS_ROOT, 'src/lib/bench/baselines/g3-baseline.json');

/** Reduced sampling for the slow 1,000-room tier (same config for both tiers). */
const LARGE_OPTIONS: NodeTierOptions = { warmup: 1, samples: 3, hitPoints: 40, tolerance: 0.2 };

const TIER_ORDER: readonly BenchTier[] = ['chopin', 'small', 'medium', 'large'];

/**
 * The Chopin golden-fixture budget policy. Every metric is declared here with
 * a recorded reason; `recordBaseline()` persists this table alongside the
 * fresh tier measurements. Only the deterministic metrics (see
 * `ENFORCED_BUDGET_METRICS`) are enforced against live measurements; the
 * wall-clock metrics remain recorded but advisory until the product has a
 * representative fixture and stable CI. The three `three-*-estimate` bounds
 * and the `wall-mesh-build` metric reflect the G4 indexed-mesh topology (one
 * watertight mesh per room) rather than the retired one-box-per-span chord
 * boxes.
 */
export const BUDGETS: Partial<Record<BenchMetricName, Budget>> = {
	'layout-compile': {
		target: 30,
		fail: 60,
		reason:
			'Measured 2026-08-13 p50 ~10 ms on the Chopin layout (node tier); target = 2x headroom, fail = 4x regression bound.'
	},
	'plan-render-build': {
		target: 1,
		fail: 5,
		reason:
			'Measured 2026-08-13 p50 ~0.08 ms on the Chopin layout (node tier); near-noise floor with generous headroom.'
	},
	'wall-mesh-build': {
		target: 30,
		fail: 60,
		reason:
			'G4 deterministic metric: one watertight indexed wall mesh per room (7 rooms, ~14.3k triangles — the bevel bridge + reveal geometry added over the original 9.4k). Measured 2026-08-14 p50 ~19 ms on quiet runs, ~30–41 ms on loaded runs (5-sample median is noisy); fail = 2x of the target so only a real topology regression trips.'
	},
	'hit-test': {
		target: 0.5,
		fail: 2,
		reason:
			'Measured 2026-08-13 p50 ~0.10 ms per point on the Chopin layout; fail allows ~20x before tripping so only a real O(n) regression fails.'
	},
	'snap-query': {
		target: 0.01,
		fail: 0.05,
		reason:
			'Measured 2026-08-13 p50 ~0.0005 ms per point on the Chopin layout; near-noise floor with generous headroom.'
	},
	'compiled-memory': {
		target: 4000000,
		fail: 8000000,
		reason:
			'Measured 2026-08-13 2,201,474 bytes serialized compiled geometry for Chopin; target/fail bound a 2x/4x footprint regression.'
	},
	'cache-key-code-units': {
		target: 700000,
		fail: 1300000,
		reason:
			'Measured 2026-08-13 620,268 UTF-16 code units of stored cacheKey strings for Chopin; the deterministic allocation backlog #10 targets, with fail = 2x regression bound.'
	},
	'svg-node-count': {
		target: 100,
		fail: 150,
		reason: 'Measured 2026-08-13 71 SVG nodes for the Chopin Plan model; fail = ~2x catches SVG node bloat.'
	},
	'three-object-estimate': {
		target: 20,
		fail: 60,
		reason:
			'G4 before→after: 1,166 one-box-per-span objects → 6 (one watertight indexed mesh per visitor room; the bespoke music-chamber shell is excluded exactly as the live LayoutMuseumShell does). Re-measured on re-record = 6; fail = ~10x catches a return to per-span object proliferation.'
	},
	'three-material-estimate': {
		target: 20,
		fail: 60,
		reason:
			'G4 before→after: 28 chord-box material groups → 6 (one shared presentation tint per visitor room). Re-measured on re-record = 6; fail = ~10x catches material proliferation.'
	},
	'three-draw-call-estimate': {
		target: 20,
		fail: 60,
		reason:
			'G4 before→after: 1,166 per-span draw calls → 6 (one surface-class group per visitor room). Re-measured on re-record = 6; fail = ~10x catches draw-call collapse regressions.'
	},
	'three-triangle-estimate': {
		target: 19000,
		fail: 38000,
		reason:
			'G4 before→after: 13,992 chord-box triangles → 12,876 real indexed wall-mesh triangles across the 6 visitor rooms (bespoke shell excluded; the G4 bevel/jamb work adds real corner-bridge and reveal geometry over the old 7-room 9,388). Re-measured on re-record = 12,876; target ≈ 1.5x, fail ≈ 3x catches triangle bloat.'
	}
};

function gitHeadSha(): string {
	try {
		return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: APPS_ROOT, encoding: 'utf8' }).trim();
	} catch {
		return 'local';
	}
}

function gitTreeDirty(): boolean {
	try {
		return execFileSync('git', ['status', '--porcelain'], { cwd: APPS_ROOT, encoding: 'utf8' }).trim().length > 0;
	} catch {
		return false;
	}
}

/**
 * Roots of the sources whose content determines the measured results: recorder
 * + harness + policy + hit path + curve/validation code + project data +
 * fixtures. Each root is expanded to its full transitive import closure before
 * hashing, so a change to a dependency (e.g. the project/layout codecs that
 * normalize the Chopin document) also changes the hash without being listed
 * here by hand. The generated `g3-baseline.json` itself is deliberately
 * excluded — hashing the recorder's own output would create an unstable
 * self-reference. Files are hashed in sorted order so the hash is
 * order-independent.
 */
const CONTENT_SOURCES = [
	'../../packages/layout-core/src/index.ts',
	'../../packages/project-model/src/index.ts',
	'../../packages/camera-core/src/index.ts',
	'src/lib/bench/bench-harness.ts',
	'src/lib/bench/bench-report.ts',
	'src/lib/bench/bench-types.ts',
	'src/lib/bench/browser-bench.ts',
	'src/lib/bench/plan-bench.ts',
	'src/lib/bench/p23b-fixtures.ts',
	'src/lib/bench/record-baseline.ts',
	'src/lib/editor/layout/p23b-interaction-measure.ts',
	'src/lib/editor/layout/LayoutPlanViewport.svelte',
	'src/lib/editor/layout/LayoutPreviewScene.svelte',
	'src/lib/editor/layout/layout-preview-state.svelte.ts',
	'src/lib/editor/camera/EditorCameraPreviewControls.svelte',
	'src/lib/editor/camera/EditorCameraTimelineFrame.svelte',
	'src/lib/editor/camera/EditorCameraRig.svelte',
	'src/lib/editor/app/EditorApp.svelte',
	'src/routes/dev/perf/p23b/+page.svelte',
	'src/routes/dev/perf/p23b/+page.server.ts',
	'src/lib/bench/three-stats.ts',
	'src/lib/content/chopin-project.json',
	'src/lib/content/chopin-project.ts',
	'src/lib/content/chopin-room-presentation.ts',
	'src/lib/content/materials.ts',
	'src/lib/editor/layout/plan-hit.ts',
	'src/lib/layout/layout-geometry-curve.ts',
	'src/lib/layout/layout-geometry-objects.ts',
	'src/lib/layout/layout-geometry-openings.ts',
	'src/lib/layout/layout-geometry-queries.ts',
	'src/lib/layout/layout-geometry-types.ts',
	'src/lib/layout/layout-geometry-validation.ts',
	'src/lib/layout/layout-geometry.ts',
	'src/lib/layout/plan-render-model.ts',
	'src/lib/layout/wall-mesh-builder.ts',
	'src/lib/museum/layout/wall-material-factory.ts',
	'src/lib/render/wall-geometry-adapter.ts',
	'tests/lib/layout/__fixtures__/layout-scale-fixtures.ts'
];

/**
 * Module specifiers from `import`/`export … from` statements. Bare and
 * type-only imports are captured too — the resolver skips bare packages and
 * over-including a type-only file is harmless for a reproducibility hash.
 */
function importSpecifiers(source: string): string[] {
	const specifiers: string[] = [];
	const pattern = /\b(?:import|export)\b[^'"]*?['"]([^'"]+)['"]/g;
	for (const match of source.matchAll(pattern)) specifiers.push(match[1]!);
	return specifiers;
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.json', '.svelte'] as const;

/** Resolve a `$lib/…` or relative specifier to an existing project source file, else null. */
function resolveSourceSpecifier(specifier: string, importer: string): string | null {
	// Bare package specifiers (node_modules) are pinned by the lockfile, not by
	// project source content, so they are not part of the content hash.
	if (!specifier.startsWith('.') && !specifier.startsWith('$lib')) return null;

	const base = specifier.startsWith('$lib')
		? resolve(APPS_ROOT, 'src/lib', specifier.slice('$lib'.length).replace(/^\/+/, ''))
		: resolve(dirname(importer), specifier);

	const candidates =
		extname(base) === ''
			? [
					base,
					...SOURCE_EXTENSIONS.map((extension) => base + extension),
					...SOURCE_EXTENSIONS.map((extension) => resolve(base, `index${extension}`))
				]
			: [base];

	for (const candidate of candidates) {
		try {
			if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
		} catch {
			// fall through to the next candidate
		}
	}
	return null;
}

/** Expand the declared source roots to every project file they transitively import. */
function sourceClosure(entries: readonly string[]): string[] {
	const seen = new Set<string>();
	const queue = entries.map((entry) => resolve(APPS_ROOT, entry));
	const sources: string[] = [];

	while (queue.length > 0) {
		const absolute = queue.pop()!;
		if (seen.has(absolute)) continue;
		seen.add(absolute);
		sources.push(absolute);

		let text: string;
		try {
			text = readFileSync(absolute, 'utf8');
		} catch {
			continue; // non-file root — nothing to import
		}
		for (const specifier of importSpecifiers(text)) {
			const resolved = resolveSourceSpecifier(specifier, absolute);
			if (resolved && !seen.has(resolved)) queue.push(resolved);
		}
	}

	return sources.sort();
}

function contentHash(): string {
	const hash = createHash('sha256');
	for (const absolute of sourceClosure(CONTENT_SOURCES)) {
		hash.update(relative(APPS_ROOT, absolute));
		hash.update('\0');
		try {
			hash.update(readFileSync(absolute, 'utf8'));
		} catch {
			hash.update('<missing>');
		}
		hash.update('\0');
	}
	return hash.digest('hex').slice(0, 16);
}

function provenancePartial(): Partial<BenchProvenance> {
	return {
		commitSha: gitHeadSha(),
		treeDirty: gitTreeDirty(),
		contentHash: contentHash()
	};
}

function fixtureFor(tier: BenchTier) {
	if (tier === 'chopin') return chopinProject.layout;
	return buildScaleFixture(SCALE_FIXTURE_SEEDS[tier]);
}

function seedFor(tier: BenchTier): number | undefined {
	return tier === 'chopin' ? undefined : SCALE_FIXTURE_SEEDS[tier].seed;
}

function recordTier(tier: BenchTier): BenchTierResult {
	const fixture = fixtureFor(tier);
	const baseProvenance = makeNodeProvenance(provenancePartial());
	// One sampling config per tier, shared by the Node and browser runs so the
	// merged provenance block truthfully describes every sample it carries.
	const nodeOptions: NodeTierOptions = tier === 'large' ? LARGE_OPTIONS : DEFAULT_NODE_OPTIONS;
	const browserOptions: BrowserTierOptions = { warmup: nodeOptions.warmup, samples: nodeOptions.samples };
	// Visitor topology for the Chopin tier reflects the live scene: production
	// presentation tints + bespoke-room exclusion (6 rooms). Scale tiers stay on
	// the default visitor policy (no exclusions apply there).
	if (tier === 'chopin') browserOptions.policyFactory = chopinWallMeshRenderPolicyFactory();

	const node = measureNodeTier(fixture, tier, baseProvenance, nodeOptions, seedFor(tier));
	const browser = measureBrowserTier(fixture, tier, baseProvenance, browserOptions, seedFor(tier));

	return {
		tier,
		...(node.seed === undefined ? {} : { seed: node.seed }),
		roomCount: node.roomCount,
		provenance: node.provenance,
		samples: [...node.samples, ...browser.samples]
	};
}

/**
 * Record the Node + browser tiers. `full` (default false) includes the slow
 * 1,000-room `large` tier; the checked-in baseline is recorded with `--full`.
 */
export function recordBaseline(options: { full?: boolean; p23bBrowserReport?: P23BBrowserRunReport; requireCleanHead?: boolean } = {}): BudgetBaseline {
	const full = options.full ?? false;
	const tiers = full ? [...TIER_ORDER] : TIER_ORDER.filter((tier) => tier !== 'large');
	const browserReport = options.p23bBrowserReport;
	if (browserReport) validateP23BBrowserReport(browserReport, { requireCleanHead: options.requireCleanHead });
	const p23bContentHash = browserReport ? contentHash() : undefined;
	return {
		methodVersion: BENCH_METHOD_VERSION,
		...(browserReport ? { methodVersionReason: browserReport.methodVersionReason } : {}),
		budgets: BUDGETS,
		tiers: tiers.map(recordTier),
		...(browserReport ? {
			workloads: browserReport.workloads.map((workload) => ({
				...workload,
				provenance: { ...workload.provenance, contentHash: p23bContentHash }
			})),
			interactionFixtures: browserReport.interactionFixtures,
			...(browserReport.deferredInteractionPaths ? { deferredInteractionPaths: browserReport.deferredInteractionPaths } : {}),
			markNestingNote: browserReport.markNestingNote,
			measurementLimitations: browserReport.measurementLimitations
		} : {})
	};
}

/**
 * Interaction evidence gates (method v5). These are the checks that make the
 * earlier interaction baseline inadmissible, so they fail closed:
 *
 * - the capture must cover the owner workload AND the two size-40 matrix cells,
 *   each in its own isolated session, in one browser session;
 * - the warm-up exclusion is enforced (a path need not be accepted at all only
 *   when its own reason says it is deferred or not applicable);
 * - setup/rejected/suppressed actions are recorded as counts and can never sit
 *   inside an accepted distribution;
 * - `plan-apply` and `adapter` are separate boundaries, so planner cost is never
 *   reported as adapter CPU work;
 * - a capture that dropped a boundary or failed to settle is rejected outright.
 */
function validateP23BInteractionCapture(report: P23BBrowserRunReport): void {
	const paths = ['selection', 'plan-drag-edit', 'bend-knot-edit', 'wall-authoring', 'plan-pan-zoom', 'guided-3d-navigation'] as const;
	const boundaries = ['input', 'release', 'reactive', 'plan-apply', 'adapter', 'svelte-flush', 'browser-frame'] as const;
	const outcomes = ['accepted', 'setup', 'rejected', 'suppressed', 'unclassified'] as const;
	const required = [P23B_OWNER_FIXTURE_ID, 'p23b-40-wall-straight-v1', 'p23b-40-wall-all-curved-v1'];
	if (report.interactionFixtures.length !== required.length) {
		throw new Error(`P23B interaction capture must cover exactly ${required.length} hosted fixtures`);
	}
	const seenFixtures = new Set<string>();
	const seenSessions = new Set<string>();
	for (const capture of report.interactionFixtures) {
		if (!required.includes(capture.fixtureId)) throw new Error(`Unexpected P23B interaction fixture ${capture.fixtureId}`);
		if (seenFixtures.has(capture.fixtureId)) throw new Error(`Duplicate P23B interaction fixture ${capture.fixtureId}`);
		seenFixtures.add(capture.fixtureId);
		const entry = fixtureLedger.fixtures.find((fixture) => fixture.id === capture.fixtureId);
		if (!entry) throw new Error(`P23B interaction fixture is not in the ledger: ${capture.fixtureId}`);
		if (capture.semanticClass !== 5 || capture.role !== entry.role || capture.canonicalLayoutSha256 !== entry.canonicalLayoutSha256) {
			throw new Error(`P23B interaction fixture identity changed: ${capture.fixtureId}`);
		}
		if ((capture.rawPayloadSha256 ?? null) !== (entry.rawPayloadSha256 ?? null)) throw new Error(`P23B interaction fixture raw identity changed: ${capture.fixtureId}`);
		// One isolated session per hosted fixture: a deferred boundary scheduled in one
		// fixture's capture can never be written into another's.
		if (!capture.sessionId || capture.sessionId === report.browser.sessionId || seenSessions.has(capture.sessionId)) {
			throw new Error(`P23B interaction captures must use distinct isolated sessions: ${capture.fixtureId}`);
		}
		seenSessions.add(capture.sessionId);
		if (capture.capture.warmup !== 5) throw new Error(`P23B interaction warm-up exclusion must be five actions per path: ${capture.fixtureId}`);
		if (!capture.capture.settled) throw new Error(`P23B interaction capture did not settle before it was summarized: ${capture.fixtureId}`);
		if (capture.capture.droppedBoundaries !== 0) throw new Error(`P23B interaction capture dropped deferred boundaries: ${capture.fixtureId}`);
		if (!capture.planView || !(capture.planView.actions > 0)) throw new Error(`P23B interaction capture is missing the Plan viewport it ran in: ${capture.fixtureId}`);
		if (!capture.planView.stable) throw new Error(`P23B interaction capture changed viewport mid-capture: ${capture.fixtureId}`);
		// Every hosted fixture must be measured in the same view, within 2%, or a size
		// or curvature comparison would silently also be a zoom comparison.
		const reference = report.interactionFixtures[0]!.planView!;
		if (Math.abs(capture.planView.pixelsPerMeter - reference.pixelsPerMeter) / reference.pixelsPerMeter > 0.02) {
			throw new Error(`P23B hosted fixtures must be measured at the same px/m (within 2%): ${capture.fixtureId}`);
		}
		const acceptedAuthoring = capture.capture.outcomes['wall-authoring']?.accepted ?? 0;
		if (capture.capture.fixtureResets < acceptedAuthoring) {
			throw new Error(`P23B interaction capture does not record a fixture reset for every accepted authoring action: ${capture.fixtureId}`);
		}
		for (const path of paths) {
			if (!capture.protocol[path]?.target || !capture.protocol[path]?.snapGrid) {
				throw new Error(`P23B interaction fixture is missing the fixed target/settings for ${path}: ${capture.fixtureId}`);
			}
			const deferral = report.deferredInteractionPaths?.[path];
			if (deferral !== undefined && !deferral.trim()) throw new Error(`P23B deferred path lacks its owner decision: ${path}`);
			const notApplicable = capture.notApplicableInteractionPaths[path];
			if (notApplicable !== undefined && !notApplicable.trim()) throw new Error(`P23B not-applicable path lacks its reason: ${capture.fixtureId}/${path}`);
			if (deferral && notApplicable) throw new Error(`P23B path is both owner-deferred and fixture-not-applicable: ${capture.fixtureId}/${path}`);
			const unavailable = Boolean(deferral) || Boolean(notApplicable);
			const inputCount = capture.interactionSampleCounts[path] ?? 0;
			if (!unavailable && !(inputCount > 0)) {
				throw new Error(`P23B interaction capture has no observed input samples for ${path}: ${capture.fixtureId}`);
			}
			if (unavailable && inputCount > 0) {
				throw new Error(`P23B deferred or not-applicable path must carry no samples for ${path}: ${capture.fixtureId}`);
			}
			if (!unavailable) {
				if ((capture.capture.completedActions[path] ?? 0) < capture.capture.warmup + 1) {
					throw new Error(`P23B interaction capture has too few completed ${path} actions to exclude warm-up: ${capture.fixtureId}`);
				}
				if (!((capture.capture.warmupExcluded[path] ?? 0) >= capture.capture.warmup)) {
					throw new Error(`P23B interaction warm-up exclusion was not applied to ${path}: ${capture.fixtureId}`);
				}
			}
			const pathReport = capture.interactions[path];
			if (!pathReport) throw new Error(`P23B interaction capture has no results for ${path}: ${capture.fixtureId}`);
			for (const boundary of boundaries) {
				const value = pathReport[boundary];
				if (!value) throw new Error(`P23B interaction capture must record a sample or explicit unavailable reason for ${capture.fixtureId}/${path}/${boundary}`);
				if ('unavailable' in value) {
					if (!value.unavailable.trim()) throw new Error(`P23B unavailable boundary lacks a reason for ${capture.fixtureId}/${path}/${boundary}`);
					continue;
				}
				if (!(value.observedCount > 0) || !Number.isFinite(value.warmupExcludedActions)) {
					throw new Error(`P23B interaction boundary has invalid samples for ${capture.fixtureId}/${path}/${boundary}`);
				}
				for (const [outcome, count] of Object.entries(value.outcomes)) {
					if (!outcomes.includes(outcome as (typeof outcomes)[number]) || !(count! > 0)) {
						throw new Error(`P23B interaction boundary has an invalid outcome tally for ${capture.fixtureId}/${path}/${boundary}`);
					}
				}
				if (value.accepted && (!(value.accepted.count > 0) || !Number.isFinite(value.accepted.p50) || !Number.isFinite(value.accepted.p95))) {
					throw new Error(`P23B accepted distribution is invalid for ${capture.fixtureId}/${path}/${boundary}`);
				}
				// The latency boundaries must show accepted evidence for an applicable path:
				// an accepted input or release can never be absent. Internal pipeline
				// boundaries may legitimately be entirely unclassified (a hover derives
				// geometry without committing anything), which stays visible as counts.
				if ((boundary === 'input' || boundary === 'release') && !value.accepted && !unavailable) {
					throw new Error(`P23B interaction boundary has observed samples but no accepted sample for ${capture.fixtureId}/${path}/${boundary}`);
				}
			}
			// The accepted-release distribution is the correction this gate exists for: an
			// applicable path must show accepted releases, and a warm-up-excluded one.
			const release = pathReport.release;
			if (release && 'observedCount' in release && !unavailable) {
				if (!release.accepted || !(release.accepted.count > 0)) {
					throw new Error(`P23B accepted release distribution is missing for ${path}: ${capture.fixtureId}`);
				}
				if (release.warmupExcludedActions !== capture.capture.warmup) {
					throw new Error(`P23B accepted release distribution was not warm-up excluded for ${path}: ${capture.fixtureId}`);
				}
			}
		}
	}
}

function sha256(value: string | Buffer): string {
	const hash = createHash('sha256');
	if (typeof value === 'string') hash.update(value, 'utf8');
	else hash.update(value.toString('latin1'), 'latin1');
	return hash.digest('hex');
}

function p23bDocumentShape(document: typeof P23B_OWNER_LAYOUT) {
	const centerlineKinds = document.walls.reduce<Record<string, number>>((counts, wall) => {
		counts[wall.centerline.kind] = (counts[wall.centerline.kind] ?? 0) + 1;
		return counts;
	}, {});
	return {
		rooms: document.rooms.length,
		walls: document.walls.length,
		junctions: document.junctions.length,
		openings: document.openings.length,
		curvedWalls: document.walls.filter((wall) => wall.centerline.kind === 'cubic-chain').length,
		centerlineKinds
	};
}

/** Re-run the exact W2 identity, shape and shipped-gate checks before baseline writes. */
function assertP23BFixtureContracts(): void {
	const expectedIds = new Set<string>();
	const verify = (
		id: string,
		document: typeof P23B_OWNER_LAYOUT,
		semanticClass: number,
		role: string
	): void => {
		const entry = fixtureLedger.fixtures.find((fixture) => fixture.id === id);
		if (!entry) throw new Error(`P23B fixture ledger is missing ${id}`);
		expectedIds.add(id);
		const canonical = serializeWallFirstLayoutDocument(document);
		const layoutValidation = validateWallFirstLayoutDocument(document);
		const topology = validateWallFirstTopology(document);
		const compiled = compileWallFirstLayoutGeometry(document);
		const actualVerdict = {
			codec: layoutValidation.success ? 'accepted' : 'rejected',
			topology: topology?.code ?? 'admitted',
			compilerIssues: compiled.issues.map((issue) => issue.code)
		};
		if (entry.semanticClass !== semanticClass || entry.role !== role) {
			throw new Error(`P23B class/role identity changed for ${id}`);
		}
		if (sha256(canonical) !== entry.canonicalLayoutSha256) throw new Error(`P23B canonical identity changed for ${id}`);
		if (!isDeepStrictEqual(p23bDocumentShape(document), entry.documentShape)) throw new Error(`P23B geometry shape changed for ${id}`);
		if (!isDeepStrictEqual(actualVerdict, entry.shippedVerdict)) throw new Error(`P23B shipped-validator verdict changed for ${id}`);
	};

	for (const spec of P23B_MATRIX_SPECS) verify(spec.id, buildP23BMatrixFixture(spec), 5, spec.role);
	verify(P23B_OWNER_FIXTURE_ID, P23B_OWNER_LAYOUT, 5, 'owner-responsiveness');
	for (const spec of P23B_CORRECTNESS_SPECS) verify(spec.id, buildP23BCorrectnessFixture(spec), spec.semanticClass, spec.role);
	if (expectedIds.size !== fixtureLedger.fixtures.length) throw new Error('P23B fixture ledger has missing or unexpected entries');

	const owner = fixtureLedger.fixtures.find((fixture) => fixture.id === P23B_OWNER_FIXTURE_ID);
	if (!owner || owner.source.kind !== 'exact-owner-payload') throw new Error('P23B owner fixture source contract is invalid');
	const rawOwner = readFileSync(resolve(REPO_ROOT, owner.source.path));
	const canonicalOwner = Buffer.from(serializeWallFirstLayoutDocument(P23B_OWNER_LAYOUT), 'utf8');
	if (
		rawOwner.byteLength !== owner.source.bytes ||
		sha256(rawOwner) !== owner.rawPayloadSha256 ||
		rawOwner.toString('hex') !== canonicalOwner.toString('hex')
	) {
		throw new Error('P23B owner payload does not match its exact-byte ledger identity');
	}
}

/** Validate imported browser measurements against the immutable fixture ledger. */
export function validateP23BBrowserReport(
	report: P23BBrowserRunReport,
	options: { requireCleanHead?: boolean } = {}
): void {
	if (report.methodVersion !== BENCH_METHOD_VERSION) throw new Error(`P23B browser report method ${report.methodVersion} != ${BENCH_METHOD_VERSION}`);
	if (!report.methodVersionReason.trim()) throw new Error('P23B browser report is missing the method-version reason');
	if (!report.markNestingNote.trim()) throw new Error('P23B browser report is missing the mark-nesting note');
	assertP23BFixtureContracts();
	if (
		!report.browser.sessionId ||
		!report.browser.browser?.name ||
		!report.browser.browser.version ||
		!report.browser.browser.userAgent ||
		!Number.isFinite(report.browser.devicePixelRatio) ||
		!report.browser.machine ||
		!report.browser.operatingSystem ||
		!report.browser.nodeVersion
	) {
		throw new Error('P23B browser report is missing browser/session/DPR/machine/OS/Node provenance');
	}
	if (report.browser.treeDirty !== false) throw new Error('P23B baseline requires a clean recorded source tree');
	if (report.browser.policyCommitSha !== 'c11938fe0d5c721a896bb92dcb722f2273480feb') {
		throw new Error('P23B baseline does not name the shipped P23B.3a policy commit');
	}
	if (!report.browser.graphics?.source || !report.browser.graphics.api) throw new Error('P23B browser report is missing graphics provenance');
	if (options.requireCleanHead && (report.browser.commitSha !== gitHeadSha() || gitTreeDirty())) {
		throw new Error('P23B baseline report must match the current clean HEAD');
	}
	if (report.warmup !== 5 || report.samples !== 20) throw new Error('P23B baseline must use 5 warm-up and 20 measured samples');
	if (!report.measurementLimitations.length) throw new Error('P23B browser report must record measurement limits');
	validateP23BInteractionCapture(report);
	const expected = new Map<string, { role: string; hash: string; raw: string | null }>();
	for (const spec of P23B_MATRIX_SPECS) {
		const ledger = fixtureLedger.fixtures.find((item) => item.id === spec.id);
		if (!ledger) throw new Error(`Missing ledger entry for ${spec.id}`);
		expected.set(spec.id, { role: spec.role, hash: ledger.canonicalLayoutSha256, raw: null });
	}
	const owner = fixtureLedger.fixtures.find((item) => item.id === P23B_OWNER_FIXTURE_ID);
	if (!owner) throw new Error(`Missing ledger entry for ${P23B_OWNER_FIXTURE_ID}`);
	expected.set(P23B_OWNER_FIXTURE_ID, { role: 'owner-responsiveness', hash: owner.canonicalLayoutSha256, raw: owner.rawPayloadSha256 });
	if (report.workloads.length !== expected.size) throw new Error(`P23B baseline requires exactly ${expected.size} workloads`);
	const seen = new Set<string>();
	for (const workload of report.workloads) {
		const identity = expected.get(workload.fixtureId);
		if (!identity || seen.has(workload.fixtureId)) throw new Error(`Unexpected or duplicate P23B workload ${workload.fixtureId}`);
		seen.add(workload.fixtureId);
		if (workload.semanticClass !== 5 || workload.role !== identity.role || workload.canonicalLayoutSha256 !== identity.hash || (workload.rawPayloadSha256 ?? null) !== identity.raw) {
			throw new Error(`P23B workload identity does not match the ledger: ${workload.fixtureId}`);
		}
		if (workload.provenance.sessionId !== report.browser.sessionId || workload.provenance.methodVersion !== BENCH_METHOD_VERSION) {
			throw new Error(`P23B workload provenance is inconsistent: ${workload.fixtureId}`);
		}
		if (workload.provenance.warmup !== report.warmup || workload.provenance.samples !== report.samples) {
			throw new Error(`P23B sampling provenance is inconsistent: ${workload.fixtureId}`);
		}
		const { date: _baseDate, ...baseProvenance } = report.browser;
		const { date: _workloadDate, ...workloadProvenance } = workload.provenance;
		if (!isDeepStrictEqual(workloadProvenance, baseProvenance)) {
			throw new Error(`P23B workload environment provenance is inconsistent: ${workload.fixtureId}`);
		}
		if (workload.samples.length === 0) throw new Error(`P23B workload has no samples: ${workload.fixtureId}`);
		for (const sample of workload.samples) {
			if (sample.unit === 'ms' && (!Number.isFinite(sample.p50) || !Number.isFinite(sample.p95))) {
				throw new Error(`P23B timing sample lacks p50/p95: ${workload.fixtureId}/${sample.metric}`);
			}
		}
	}
}
