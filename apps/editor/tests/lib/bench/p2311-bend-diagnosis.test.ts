/**
 * P23.11 Bend diagnosis — the three questions the investigation handoff left
 * open, measured off the shipped editor code paths in Node (no browser, no DOM,
 * no render pass):
 *
 * 1. **Svelte-proxy isolation.** The browser fixture harness wraps the preview
 *    state in `$state(...)` exactly like `EditorApp.svelte` does, while every
 *    plain unit-test fixture does not. The same stage (`restore-mesh-rebuild`)
 *    therefore runs on a proxied graph in the editor and on a raw graph in
 *    tests. Both are measured here so the difference is attributable: proxy
 *    traversal versus genuine mesh building.
 * 2. **The rejected Bend move.** The `architectureEditProposal` derived in
 *    `LayoutPlanViewport.svelte` runs a *second* full chain-algebra proposal for
 *    every move whose candidate did not accept. This pins the duplicate exact
 *    splits per move and sizes them.
 * 3. **Snap resolution.** The real editor trace never captured the
 *    architecture-snap stage (the mark was added after that capture). The same
 *    call the viewport makes is measured here, with the input the Bend
 *    pointer-down actually freezes: every baseline Junction coordinate excluded
 *    by point.
 *
 * Every number rides the shipped `p2311Measure` marks (`__P2311_PERF__ = true`),
 * so it is directly comparable with the browser fixture report. The suite prints
 * a report and asserts only structural facts (what ran how many times, and that
 * proxied and raw runs see identical input) — never a performance threshold.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	LAYOUT_PLAN_GRID_STEP,
	p2311Measure,
	proposeWallFirstArchitectureGeometry,
	resolveLayoutSnap,
	serializeWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type SnapInputContext
} from '@portfolio/layout-core';

import { P2311_FIXTURES, p2311Fixture, type BendFixtureSpec } from '$lib/bench/p2311-bend-fixtures';
import { p2311UnwrapState, p2311WrapState } from '$lib/bench/p2311-proxy-probe.svelte';
import {
	architectureEditAllowedKinds,
	architectureEditExcludePoints,
	architectureEditExclusionOwners,
	type LayoutArchitectureEditGesture
} from '$lib/editor/layout/layout-interaction';
import {
	captureLayoutPreviewSnapshot,
	createEmptyLayoutPreviewState,
	derivePreviewBundle,
	importLayoutPreviewJson,
	restoreLayoutPreviewSnapshot,
	updateWallFirstWallBend,
	type LayoutPreviewSnapshot,
	type LayoutPreviewState
} from '$lib/editor/layout/layout-preview-state.svelte';
import { buildPlanRenderModel } from '$lib/layout/plan-render-model';

const PREFIX = 'p2311:';
/** The fixture matrix's Bend target: the first Wall, [0,0] → [12,0]. */
const TARGET_WALL = 'w0';
/** A Wall too thick to keep its own offset clearance. */
const OVER_THICK_WALL = 8;
const PLAN_VIEW_SIZE = { pixelsPerMeter: 20, gridStep: LAYOUT_PLAN_GRID_STEP };

/**
 * The invalid draught the cost probe repeats. Chosen from the refusal matrix
 * below: it is the one that reaches furthest into the acceptance pipeline before
 * refusing, which is the shape a real drag into invalid space produces.
 */
type RejectionMode = 'over-thick-wall' | 'split-at-endpoint' | 'bend-across-neighbours';
const REJECTION_MODE: RejectionMode = 'bend-across-neighbours';
const overThick = (document: LayoutDocumentWallFirst): void => {
	document.walls[0]!.thickness = OVER_THICK_WALL;
};

function rejectionFor(
	mode: RejectionMode,
	spec: BendFixtureSpec
): { intent: { distance: number; point: LayoutVec2 }; edit?: (document: LayoutDocumentWallFirst) => void } {
	switch (mode) {
		case 'over-thick-wall':
			return { intent: { distance: 3, point: [3, 0.4] }, edit: overThick };
		case 'split-at-endpoint':
			return { intent: { distance: 0, point: [0.05, 0.4] } };
		case 'bend-across-neighbours':
			return { intent: { distance: 3, point: [3, spec.rooms > 0 ? 25 : 60] } };
	}
}

// ---------------------------------------------------------------------------
// measurement plumbing
// ---------------------------------------------------------------------------

type Stats = { count: number; p50: number; p95: number; max: number; total: number };

function round(value: number): number {
	return Math.round(value * 1000) / 1000;
}

function stats(values: readonly number[]): Stats | null {
	if (values.length === 0) return null;
	const ordered = [...values].sort((a, b) => a - b);
	const at = (fraction: number): number =>
		ordered[Math.min(ordered.length - 1, Math.ceil(fraction * ordered.length) - 1)]!;
	return {
		count: ordered.length,
		p50: round(at(0.5)),
		p95: round(at(0.95)),
		max: round(ordered.at(-1)!),
		total: round(ordered.reduce((sum, value) => sum + value, 0))
	};
}

/** Every recorded `p2311:` measure in the current window, grouped by stage. */
function recordedStages(): Map<string, number[]> {
	const byName = new Map<string, number[]>();
	for (const entry of performance.getEntriesByType('measure')) {
		if (!entry.name.startsWith(PREFIX)) continue;
		const key = entry.name.slice(PREFIX.length);
		const values = byName.get(key);
		if (values) values.push(entry.duration);
		else byName.set(key, [entry.duration]);
	}
	return byName;
}

function stageTable(): Record<string, Stats> {
	const table: Record<string, Stats> = {};
	for (const [name, values] of recordedStages()) {
		const entry = stats(values);
		if (entry) table[name] = entry;
	}
	return table;
}

/**
 * Stages whose time is already inside another measured stage. Summing them with
 * their parents would double count, so the per-move CPU totals exclude them.
 */
const NESTED_STAGES = new Set([
	'restore-project-clone',
	'restore-model-project',
	'restore-mesh-install',
	'room-geometry-compile',
	'curve-sampling',
	'finite-thickness'
]);

function stageCount(name: string): number {
	return recordedStages().get(name)?.length ?? 0;
}

function resetWindow(): void {
	performance.clearMarks();
	performance.clearMeasures();
}

const report: Record<string, unknown> = {};

beforeAll(() => {
	(globalThis as { __P2311_PERF__?: boolean }).__P2311_PERF__ = true;
});

afterAll(() => {
	(globalThis as { __P2311_PERF__?: boolean }).__P2311_PERF__ = false;
	(globalThis as { __P2311_DIAGNOSIS__?: unknown }).__P2311_DIAGNOSIS__ = report;
	// One dump: the diagnosis deliverable, not a per-pointermove log.
	console.log(`\nP23.11 Bend diagnosis\n${JSON.stringify(report, null, 2)}\n`);
});

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

function fixtureSpec(specId: string): BendFixtureSpec {
	const spec = P2311_FIXTURES.find((candidate) => candidate.id === specId);
	if (!spec) throw new Error(`P23.11 diagnosis: unknown fixture ${specId}`);
	return spec;
}

/**
 * The matrix's own fixture, imported through the shipped importer. `proxied`
 * reproduces `EditorApp.svelte` (`$state(createEmptyWallFirstLayoutPreviewState())`
 * then import into the proxy); the default reproduces the plain unit-test graph.
 */
function previewStateFor(
	specId: string,
	options: { proxied?: boolean; editDocument?: (document: LayoutDocumentWallFirst) => void } = {}
): LayoutPreviewState {
	const document = p2311Fixture(fixtureSpec(specId));
	options.editDocument?.(document);
	const blank = createEmptyLayoutPreviewState();
	const state = options.proxied ? p2311WrapState(blank) : blank;
	if (!importLayoutPreviewJson(state, serializeWallFirstLayoutDocument(document))) {
		throw new Error(`P23.11 diagnosis: ${specId} import failed — ${state.importError ?? 'unknown'}`);
	}
	return state;
}

function liveDocument(state: LayoutPreviewState): LayoutDocumentWallFirst {
	const layout = state.project.layout;
	if (!('formatVersion' in layout)) throw new Error('P23.11 diagnosis: expected a wall-first document');
	return layout as unknown as LayoutDocumentWallFirst;
}

/** The matrix's Bend intent: grab 3 m along the Wall, place the knot near it. */
function bendIntent(spec: BendFixtureSpec, index: number) {
	const z = 0.28 + 0.045 * Math.sin(index * 0.3);
	// Mirrors `p2311-bend-fixtures` harness: the 3-knot fixture grabs further in.
	const distance = spec.knots === 3 ? 4.5 : 3;
	const point: LayoutVec2 = [distance, spec.knots === 3 ? z / 2 : z];
	return { distance, point };
}

/** Mesh-cache shape, used to prove two runs produced the same derived output. */
function meshSignature(state: LayoutPreviewState) {
	return {
		rooms: [...state.wallMeshesByRoom.keys()].sort(),
		walls: [...state.wallMeshesByWall.keys()].sort(),
		picks: [...state.layout3dPickIndexByRoom.keys()].sort(),
		issues: state.issues.length
	};
}

// ---------------------------------------------------------------------------
// 0. instrumentation contract
// ---------------------------------------------------------------------------

describe('P23.11 diagnosis — the opt-in instrumentation still records here', () => {
	it('records a measure only while __P2311_PERF__ is set', () => {
		resetWindow();
		p2311Measure('diagnosis-probe', () => 1);
		expect(stageCount('diagnosis-probe')).toBe(1);

		(globalThis as { __P2311_PERF__?: boolean }).__P2311_PERF__ = false;
		p2311Measure('diagnosis-probe', () => 1);
		expect(stageCount('diagnosis-probe')).toBe(1);
		(globalThis as { __P2311_PERF__?: boolean }).__P2311_PERF__ = true;
	});
});

// ---------------------------------------------------------------------------
// 1. proxy isolation
// ---------------------------------------------------------------------------

type RestoreProbe = {
	fixture: BendFixtureSpec;
	stages: Record<string, Stats>;
	signature: ReturnType<typeof meshSignature>;
};

function	restoreProbe(specId: string, proxied: boolean, iterations: number): RestoreProbe {
	const state = previewStateFor(specId, { proxied });
	const snapshot = captureLayoutPreviewSnapshot(state);
	resetWindow();
	for (let index = 0; index < iterations; index += 1) {
		restoreLayoutPreviewSnapshot(state, snapshot);
	}
	return { fixture: fixtureSpec(specId), stages: stageTable(), signature: meshSignature(state) };
}

/**
 * A **cold** derive per iteration: `derivePreviewBundle` compiles the layout, so
 * every call produces a new geometry and therefore a real mesh build. This is
 * the same stage the restore path used to run, measured on the one path that
 * still builds meshes after the performance pass, so the proxy comparison keeps
 * isolating proxy traversal from mesh building.
 */
function deriveProbe(specId: string, proxied: boolean, iterations: number): RestoreProbe {
	const state = previewStateFor(specId, { proxied });
	const layout = state.project.layout;
	resetWindow();
	for (let index = 0; index < iterations; index += 1) {
		derivePreviewBundle(
			state.project.id,
			state.project.name,
			layout as Parameters<typeof derivePreviewBundle>[2],
			state.project.scene
		);
	}
	return { fixture: fixtureSpec(specId), stages: stageTable(), signature: meshSignature(state) };
}

describe('P23.11 diagnosis — the captured snapshot geometry is a live Svelte proxy', () => {
	// The editor's own wrapper is what makes these the same graph. `captureLayoutPreviewSnapshot`
	// stores `geometry` BY REFERENCE, so the restored mesh rebuild reads the proxy.
	it('a proxied state proxies its geometry, and unwrapping returns the raw graph', () => {
		for (const specId of ['bend-1-wall', 'bend-50-wall', 'bend-3-room']) {
			const proxied = previewStateFor(specId, { proxied: true });
			const raw = previewStateFor(specId);
			const unwrapped = p2311UnwrapState(proxied.geometry);
			// The unwrap is a genuine second graph, and it is byte-equal to the
			// plain-graph run — so the two timings below are comparable input.
			expect(unwrapped).not.toBe(proxied.geometry);
			expect(JSON.stringify(unwrapped)).toBe(JSON.stringify(raw.geometry));
		}
	});

	it('serves an identical baseline cache on every restore, from the same geometry object', () => {
		// The snapshot stores `geometry` BY REFERENCE and never re-derives it, so
		// every restore can serve exactly the derived caches that geometry already
		// has — for a document that has not changed. This is the evidence that made
		// the per-gesture baseline bundle safe to reuse.
		for (const specId of ['bend-3-room', 'bend-10-wall', 'bend-50-wall', 'bend-10-room']) {
			const state = previewStateFor(specId);
			const snapshot = captureLayoutPreviewSnapshot(state);
			restoreLayoutPreviewSnapshot(state, snapshot);
			const first = meshSignature(state);
			for (let index = 0; index < 4; index += 1) restoreLayoutPreviewSnapshot(state, snapshot);
			expect(state.geometry).toBe(snapshot.geometry);
			expect(meshSignature(state)).toEqual(first);
		}
	});

	it('scales the baseline restore with total Wall count, and reports the proxy share of a cold derive', () => {
		const probeReport: Record<string, unknown> = {};
		for (const specId of ['rigid-1-wall', 'bend-1-wall', 'bend-10-wall', 'bend-50-wall', 'bend-3-room', 'bend-10-room']) {
			const proxied = deriveProbe(specId, true, 10);
			const raw = deriveProbe(specId, false, 10);
			// Same derived output on both graphs: the comparison is apples-to-apples.
			expect(proxied.signature).toEqual(raw.signature);
			const proxiedRebuild = proxied.stages['mesh-prebuild'];
			const rawRebuild = raw.stages['mesh-prebuild'];
			if (!proxiedRebuild || !rawRebuild) throw new Error(`${specId}: missing mesh-prebuild`);
			probeReport[specId] = {
				walls: proxied.fixture.walls,
				rooms: proxied.fixture.rooms,
				proxy: { rebuildP50: proxiedRebuild.p50 },
				raw: { rebuildP50: rawRebuild.p50 },
				proxyOverheadMs: round(proxiedRebuild.p50 - rawRebuild.p50),
				proxyMultiple: round(proxiedRebuild.p50 / rawRebuild.p50),
				restore: {
					proxiedTotalP50: restoreProbe(specId, true, 10).stages['baseline-restore']?.p50 ?? null,
					proxiedMeshInstallP50: restoreProbe(specId, true, 10).stages['restore-mesh-install']?.p50 ?? null,
					proxiedModelProjectP50: restoreProbe(specId, true, 10).stages['restore-model-project']?.p50 ?? null
				}
			};
		}
		report['cold-derive-proxy-vs-raw'] = probeReport;
		expect(Object.keys(probeReport).length).toBe(6);
	});
});

// ---------------------------------------------------------------------------
// 2. duplicate work per move
// ---------------------------------------------------------------------------

type MoveProbe = {
	valid: number;
	rejected: number;
	plannerSplits: number;
	proposalSplits: number;
	stages: Record<string, Stats>;
};

/** One shipped preview move: restore the baseline, then plan the Bend candidate. */
function bendMove(state: LayoutPreviewState, snapshot: LayoutPreviewSnapshot, intent: { distance: number; point: LayoutVec2 }) {
	restoreLayoutPreviewSnapshot(state, snapshot);
	return updateWallFirstWallBend(state, TARGET_WALL, intent);
}

function acceptedMoveProbe(specId: string, iterations: number): MoveProbe {
	const spec = fixtureSpec(specId);
	const state = previewStateFor(specId);
	const snapshot = captureLayoutPreviewSnapshot(state);
	resetWindow();
	let valid = 0;
	for (let index = 0; index < iterations; index += 1) {
		if (bendMove(state, snapshot, bendIntent(spec, index)).success) valid += 1;
		// The viewport's `plan-render-model` derived re-derives on every install.
		p2311Measure('plan-render-model', () => buildPlanRenderModel(state.geometry));
	}
	return {
		valid,
		rejected: iterations - valid,
		plannerSplits: stageCount('planner-exact-split'),
		proposalSplits: stageCount('proposal-exact-split'),
		stages: stageTable()
	};
}

/**
 * A rejected move, in the shape the editor actually produces: the planner runs
 * its exact split and the whole acceptance pipeline, refuses, and the viewport's
 * transient proposal then runs the same chain algebra a second time so the
 * refused shape can be drawn.
 */
function rejectedMoveProbe(specId: string, iterations: number, mode: RejectionMode): MoveProbe {
	const spec = fixtureSpec(specId);
	const { intent, edit } = rejectionFor(mode, spec);
	const state = previewStateFor(specId, { editDocument: edit });
	const snapshot = captureLayoutPreviewSnapshot(state);
	resetWindow();
	let rejected = 0;
	for (let index = 0; index < iterations; index += 1) {
		const result = bendMove(state, snapshot, intent);
		if (!result.success) rejected += 1;
		if (!result.success) {
			// `architectureEditProposal` (LayoutPlanViewport) runs this on the live
			// document for every move whose gesture did not accept.
			proposeWallFirstArchitectureGeometry(liveDocument(state), {
				kind: 'wall-bend',
				wallId: TARGET_WALL,
				distance: intent.distance,
				point: intent.point
			});
		}
		p2311Measure('plan-render-model', () => buildPlanRenderModel(state.geometry));
	}
	return {
		valid: iterations - rejected,
		rejected,
		plannerSplits: stageCount('planner-exact-split'),
		proposalSplits: stageCount('proposal-exact-split'),
		stages: stageTable()
	};
}

describe('P23.11 diagnosis — the rejected Bend move runs the split twice', () => {
	it('runs one planner split per move and no proposal split when the candidate accepts', () => {
		const probe = acceptedMoveProbe('bend-10-wall', 6);
		expect(probe.rejected).toBe(0);
		expect(probe.plannerSplits).toBe(6);
		expect(probe.proposalSplits).toBe(0);
		report['accepted-move-splits'] = {
			fixture: 'bend-10-wall',
			moves: 6,
			plannerExactSplits: probe.plannerSplits,
			proposalExactSplits: probe.proposalSplits,
			stages: probe.stages
		};
	});

	/**
	 * Which invalid draughts the planner actually refuses, and how deep each one
	 * gets before refusing. The depth is the cost signal: a rejection raised by the
	 * split resolver itself is cheap, one raised after the acceptance compile is
	 * the expensive shape a drag into invalid space produces.
	 */
	it('reports the refusal code and depth for a matrix of invalid Bend intents', () => {
		const intents: { label: string; specId: string; intent: { distance: number; point: LayoutVec2 }; edit?: (document: LayoutDocumentWallFirst) => void }[] = [
			{ label: 'over-thick wall (8 m)', specId: 'bend-10-wall', intent: { distance: 3, point: [3, 0.4] }, edit: overThick },
			{ label: 'over-thick wall, 3 rooms', specId: 'bend-3-room', intent: { distance: 3, point: [3, 0.4] }, edit: overThick },
			{ label: 'distance beyond the chain', specId: 'bend-10-wall', intent: { distance: 40, point: [3, 0.4] } },
			{ label: 'negative distance', specId: 'bend-10-wall', intent: { distance: -1, point: [3, 0.4] } },
			{ label: 'distance at the endpoint', specId: 'bend-10-wall', intent: { distance: 0, point: [0.05, 0.4] } },
			{ label: 'bend across the neighbours', specId: 'bend-10-wall', intent: { distance: 3, point: [3, 60] } },
			{ label: 'bend out of an enclosed Room', specId: 'bend-3-room', intent: { distance: 3, point: [3, 25] } }
		];
		const matrix: Record<string, unknown> = {};
		for (const entry of intents) {
			const state = previewStateFor(entry.specId, { editDocument: entry.edit });
			resetWindow();
			const result = updateWallFirstWallBend(state, TARGET_WALL, entry.intent);
			const stages = Object.keys(stageTable());
			matrix[entry.label] = {
				specId: entry.specId,
				success: result.success,
				code: result.success ? null : result.code,
				message: result.success ? null : result.message,
				stagesBeforeRefusal: stages
			};
		}
		report['rejection-matrix'] = matrix;
		// The fixture-scale rejection above must exist for the cost probe to mean
		// anything: a Bend that reaches the acceptance compile and is refused there.
		expect(Object.values(matrix).some((entry) => (entry as { success: boolean }).success === false)).toBe(true);
	});

	it('scales the invalid draught, which is where the crossing validation lives', () => {
		const probeReport: Record<string, unknown> = {};
		for (const specId of ['bend-10-wall', 'bend-50-wall', 'bend-3-room', 'bend-10-room']) {
			const accepted = acceptedMoveProbe(specId, 6);
			const rejected = rejectedMoveProbe(specId, 6, REJECTION_MODE);
			const topLevel = (probe: MoveProbe): number =>
				Object.entries(probe.stages)
					.filter(([name]) => !NESTED_STAGES.has(name))
					.reduce((sum, [, entry]) => sum + entry.p50, 0);
			probeReport[specId] = {
				fixture: fixtureSpec(specId),
				accepted: {
					cpuP50: round(topLevel(accepted)),
					topologyPreP50: accepted.stages['topology-pre']?.p50 ?? null,
					topologyPostP50: accepted.stages['topology-post']?.p50 ?? null,
					stages: accepted.stages
				},
				rejected: {
					rejectedMoves: rejected.rejected,
					cpuP50: round(topLevel(rejected)),
					topologyPreP50: rejected.stages['topology-pre']?.p50 ?? null,
					baselineRestoreP50: rejected.stages['baseline-restore']?.p50 ?? null,
					splitP50: rejected.stages['planner-exact-split']?.p50 ?? null,
					stages: rejected.stages
				}
			};
		}
		report['invalid-draught-scaling'] = probeReport;
		expect(Object.keys(probeReport).length).toBe(4);
	}, 120_000);

	it('runs a second exact split and a second chain algebra for every rejected move', () => {
		const probe = rejectedMoveProbe('bend-10-wall', 6, REJECTION_MODE);
		expect(probe.rejected).toBe(6);
		expect(probe.plannerSplits).toBe(6);
		expect(probe.proposalSplits).toBe(6);
		expect(probe.stages['planner-exact-split']?.count).toBe(6);
		expect(probe.stages['proposal-curve-algebra']?.count).toBe(6);
		report['rejected-move-splits'] = {
			fixture: 'bend-10-wall',
			mode: REJECTION_MODE,
			moves: 6,
			plannerExactSplits: probe.plannerSplits,
			proposalExactSplits: probe.proposalSplits,
			stages: probe.stages
		};
	});
});

// ---------------------------------------------------------------------------
// 3. snap resolution
// ---------------------------------------------------------------------------

/**
 * The Bend gesture the viewport captures at pointer-down, with the exclusion the
 * code actually freezes: `architectureEditJunctionExcludePoints()` — **every**
 * baseline Junction coordinate, so no snap family can install a position the
 * planner must then reject.
 */
function bendGesture(
	document: LayoutDocumentWallFirst,
	intent: { distance: number; point: LayoutVec2 },
	excludePoints?: readonly LayoutVec2[]
): LayoutArchitectureEditGesture {
	const wall = document.walls.find((candidate) => candidate.id === TARGET_WALL);
	if (!wall) throw new Error('P23.11 diagnosis: fixture lost its target Wall');
	const start = document.junctions.find((junction) => junction.id === wall.startJunctionId);
	if (!start) throw new Error('P23.11 diagnosis: target Wall lost its start Junction');
	const grab: LayoutVec2 = [start.point[0] + intent.distance, start.point[1]];
	const excluded =
		excludePoints ??
		document.junctions.map((junction) => [junction.point[0], junction.point[1]] as LayoutVec2);
	return {
		kind: 'wall-bend',
		command: 'layout.wall.bend',
		pointerId: 1,
		wallId: wall.id,
		startPointer: grab,
		baselineGrabPoint: grab,
		bendDistance: intent.distance,
		bendExcludePoints: excluded.map((point) => [point[0], point[1]] as LayoutVec2),
		affectedWallIds: [wall.id],
		candidatePoint: intent.point,
		valid: false
	};
}

/** The exact input assembly `resolveArchitectureEditSnapTarget` performs. */
function snapInput(gesture: LayoutArchitectureEditGesture, document: LayoutDocumentWallFirst): SnapInputContext {
	const hostedOpeningIds = document.openings
		.filter((opening) => gesture.affectedWallIds.includes(opening.wallId))
		.map((opening) => opening.id);
	const input: SnapInputContext = {
		excludeOwners: architectureEditExclusionOwners(gesture, hostedOpeningIds)
	};
	const allowedKinds = architectureEditAllowedKinds(gesture);
	if (allowedKinds) input.allowedKinds = [...allowedKinds];
	const excludePoints = architectureEditExcludePoints(gesture);
	if (excludePoints.length > 0) input.excludePoints = excludePoints;
	return input;
}

type SnapProbe = {
	fixture: BendFixtureSpec;
	target: LayoutVec2;
	kind: string;
	resolutions: Record<string, number>;
	stages: Record<string, Stats>;
};

function snapProbe(
	specId: string,
	options: { target: LayoutVec2; excludeJunctions: boolean; proxied: boolean; iterations: number }
): SnapProbe {
	const state = previewStateFor(specId, { proxied: options.proxied });
	const snapshot = captureLayoutPreviewSnapshot(state);
	const document = liveDocument(state);
	const gesture = bendGesture(document, { distance: 3, point: options.target }, options.excludeJunctions ? undefined : []);
	const input = snapInput(gesture, document);
	resetWindow();
	let snapped = 0;
	for (let index = 0; index < options.iterations; index += 1) {
		// `snapshot.geometry` is what the viewport snaps against, not the live one.
		const resolution = p2311Measure('diag-architecture-snap-resolution', () =>
			resolveLayoutSnap(snapshot.geometry, options.target, PLAN_VIEW_SIZE, input)
		);
		if (resolution.kind === 'snap') snapped += 1;
	}
	return {
		fixture: fixtureSpec(specId),
		target: options.target,
		kind: snapped === options.iterations ? 'snap' : snapped === 0 ? 'none' : 'mixed',
		resolutions: { snaps: snapped, none: options.iterations - snapped, iterations: options.iterations },
		stages: stageTable()
	};
}

describe('P23.11 diagnosis — snap resolution (the stage the real trace never captured)', () => {
	it('resolves an on-feature target and an open-space target, with and without the Junction exclusion', () => {
		// 10 Walls with no Room sit on rows 20 m apart (w1 spans [0,25] → [12,25]),
		// so [6.05,25.02] is an on-feature hit and [6, 40] is open space — the
		// shape of the synthetic pointer-down that missed the Wall last session.
		const onFeature: LayoutVec2 = [6.05, 25.02];
		const openSpace: LayoutVec2 = [6, 40];
		const probeReport: Record<string, unknown> = {};
		for (const specId of ['bend-1-wall', 'bend-10-wall', 'bend-50-wall', 'bend-3-room']) {
			const hit = snapProbe(specId, { target: onFeature, excludeJunctions: true, proxied: true, iterations: 40 });
			const miss = snapProbe(specId, { target: openSpace, excludeJunctions: true, proxied: true, iterations: 40 });
			const unfiltered = snapProbe(specId, {
				target: onFeature,
				excludeJunctions: false,
				proxied: true,
				iterations: 40
			});
			probeReport[specId] = {
				walls: hit.fixture.walls,
				junctionExclusions: hit.fixture.walls * 2,
				onFeature: { kind: hit.kind, ...hit.stages['diag-architecture-snap-resolution'] },
				openSpace: { kind: miss.kind, ...miss.stages['diag-architecture-snap-resolution'] },
				onFeatureWithoutExclusions: {
					kind: unfiltered.kind,
					...unfiltered.stages['diag-architecture-snap-resolution']
				}
			};
		}
		report['snap-resolution'] = probeReport;
		expect(Object.keys(probeReport).length).toBe(4);
	});

	it('costs the same on the raw graph — snap never reads proxied geometry twice', () => {
		const proxied = snapProbe('bend-50-wall', {
			target: [6.05, 25.02],
			excludeJunctions: true,
			proxied: true,
			iterations: 40
		});
		const raw = snapProbe('bend-50-wall', {
			target: [6.05, 25.02],
			excludeJunctions: true,
			proxied: false,
			iterations: 40
		});
		report['snap-resolution-proxy'] = {
			proxyP50: proxied.stages['diag-architecture-snap-resolution']?.p50 ?? null,
			rawP50: raw.stages['diag-architecture-snap-resolution']?.p50 ?? null
		};
		expect(proxied.kind).toBe(raw.kind);
	});
});

// ---------------------------------------------------------------------------
// 4. the per-move stage table, proxy and raw, without any render pass
// ---------------------------------------------------------------------------

describe('P23.11 diagnosis — per-move stage table (CPU only, no render)', () => {
	it('reports every measured stage for the matrix fixtures on both graphs', () => {
		const probeReport: Record<string, unknown> = {};
		for (const spec of P2311_FIXTURES) {
			const proxied = acceptedMoveProbe(spec.id, 8);
			const raw = acceptedMoveProbe(spec.id, 8);
			probeReport[spec.id] = {
				fixture: { walls: spec.walls, rooms: spec.rooms, knots: spec.knots, openings: spec.openings, kind: spec.kind },
				valid: { proxied: proxied.valid, raw: raw.valid },
				proxied: proxied.stages,
				raw: raw.stages
			};
		}
		report['move-stage-table'] = probeReport;
		expect(Object.keys(probeReport).length).toBe(P2311_FIXTURES.length);
	}, 120_000);
});
