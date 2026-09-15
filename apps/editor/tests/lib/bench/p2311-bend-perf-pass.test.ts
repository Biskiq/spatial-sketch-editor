/**
 * P23.11 Bend performance pass — the regressions that keep the three changes
 * this pass made honest.
 *
 * The investigation proved three things were paid for twice (or quadratically)
 * on every accepted Bend move:
 *
 * 1. the **frozen baseline's meshes/pick index** were rebuilt on every restore
 *    even though the baseline geometry never changed;
 * 2. the accepted candidate was **compiled a second time** for the preview
 *    install, immediately after acceptance had compiled it;
 * 3. the curve-level crossing gate enumerated **every** sampled segment pair,
 *    which is quadratic in sample count and dominated a deep-bow drag.
 *
 * Each change is a pure reuse or a conservative broad phase, so every test here
 * is an *equivalence* test first (same result) and a cost test second:
 *
 * - the shipped crossing predicates are compared, case by case, against the
 *   literal every-pair loop they replaced (real curve samples, random polylines,
 *   aliased input, shared-endpoint suppression, the tolerance band);
 * - the reused render data is compared against a from-scratch derive of the same
 *   document (geometry, model, issues, bounds) and against the baseline's own
 *   mesh objects;
 * - the reuse guard is proven to *refuse* reuse for a document acceptance did
 *   not prove.
 *
 * Timings ride the shipped `p2311Measure` marks (`__P2311_PERF__ = true`) and
 * are reported, never asserted against a wall-clock budget: the one timing
 * assertion is relative — the broad phase must beat the quadratic loop on the
 * same input by a wide margin.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	CURVE_SELF_INTERSECTION_TOLERANCE,
	deriveChainSpans,
	p2311Measure,
	planBendWallCurveKnot,
	sampleSegment,
	sampledPolylineIntersects,
	sampledPolylineSelfIntersects,
	serializeWallFirstLayoutDocument,
	wallCenterlineSamples,
	wallCubicChain,
	type CurveSample,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import { P2311_FIXTURES, p2311Fixture, type BendFixtureSpec } from '$lib/bench/p2311-bend-fixtures';
import {
	captureLayoutPreviewSnapshot,
	createEmptyLayoutPreviewState,
	derivePreviewBundle,
	importLayoutPreviewJson,
	restoreLayoutPreviewSnapshot,
	updateWallFirstWallBend,
	type LayoutPreviewState
} from '$lib/editor/layout/layout-preview-state.svelte';
import { buildPlanRenderModel } from '$lib/layout/plan-render-model';

const PREFIX = 'p2311:';
const TARGET_WALL = 'w0';

// ---------------------------------------------------------------------------
// measurement plumbing (the same marks the browser harness reads)
// ---------------------------------------------------------------------------

function round(value: number): number {
	return Math.round(value * 1000) / 1000;
}

type Stats = { count: number; p50: number; p95: number; max: number };

function stats(values: readonly number[]): Stats | null {
	if (values.length === 0) return null;
	const ordered = [...values].sort((a, b) => a - b);
	const at = (fraction: number): number =>
		ordered[Math.min(ordered.length - 1, Math.ceil(fraction * ordered.length) - 1)]!;
	return { count: ordered.length, p50: round(at(0.5)), p95: round(at(0.95)), max: round(ordered.at(-1)!) };
}

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

function stageCount(name: string): number {
	return recordedStages().get(name)?.length ?? 0;
}

function stageStats(name: string): Stats | null {
	return stats(recordedStages().get(name) ?? []);
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
	(globalThis as { __P2311_PERF_PASS__?: unknown }).__P2311_PERF_PASS__ = report;
	console.log(`\nP23.11 Bend performance pass\n${JSON.stringify(report, null, 2)}\n`);
});

// ---------------------------------------------------------------------------
// 1. the shipped crossing predicates vs the literal loops they replaced
// ---------------------------------------------------------------------------

/**
 * The **reference** predicate: a verbatim copy of the pre-pass
 * `polylineSegmentsIntersect` (tolerance-scaled orientation band plus
 * axis-aligned containment for the touch branches). Comparing against an
 * independent implementation of the semantics — rather than a golden file —
 * is what makes the sweep's pruning auditable.
 */
function referenceSegmentsIntersect(
	a0: LayoutVec2,
	a1: LayoutVec2,
	b0: LayoutVec2,
	b1: LayoutVec2,
	distanceTolerance: number
): boolean {
	const lenA = Math.max(Math.hypot(a1[0] - a0[0], a1[1] - a0[1]), 1e-6);
	const lenB = Math.max(Math.hypot(b1[0] - b0[0], b1[1] - b0[1]), 1e-6);
	const orientTolA = distanceTolerance * lenA;
	const orientTolB = distanceTolerance * lenB;
	const firstStart = orientation(a0, a1, b0);
	const firstEnd = orientation(a0, a1, b1);
	const secondStart = orientation(b0, b1, a0);
	const secondEnd = orientation(b0, b1, a1);
	const crosses =
		((firstStart > orientTolA && firstEnd < -orientTolA) || (firstStart < -orientTolA && firstEnd > orientTolA)) &&
		((secondStart > orientTolB && secondEnd < -orientTolB) || (secondStart < -orientTolB && secondEnd > orientTolB));
	if (crosses) return true;
	return (
		(Math.abs(firstStart) <= orientTolA && withinBounds(a0, a1, b0, distanceTolerance)) ||
		(Math.abs(firstEnd) <= orientTolA && withinBounds(a0, a1, b1, distanceTolerance)) ||
		(Math.abs(secondStart) <= orientTolB && withinBounds(b0, b1, a0, distanceTolerance)) ||
		(Math.abs(secondEnd) <= orientTolB && withinBounds(b0, b1, a1, distanceTolerance))
	);
}

function orientation(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2): number {
	return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function withinBounds(a: LayoutVec2, b: LayoutVec2, point: LayoutVec2, tolerance: number): boolean {
	return (
		point[0] >= Math.min(a[0], b[0]) - tolerance &&
		point[0] <= Math.max(a[0], b[0]) + tolerance &&
		point[1] >= Math.min(a[1], b[1]) - tolerance &&
		point[1] <= Math.max(a[1], b[1]) + tolerance
	);
}

function referenceSelfIntersects(samples: readonly CurveSample[], tolerance: number): boolean {
	for (let firstIndex = 0; firstIndex < samples.length - 1; firstIndex += 1) {
		for (let secondIndex = firstIndex + 2; secondIndex < samples.length - 1; secondIndex += 1) {
			if (firstIndex === 0 && secondIndex === samples.length - 2) continue;
			if (
				referenceSegmentsIntersect(
					samples[firstIndex]!.point,
					samples[firstIndex + 1]!.point,
					samples[secondIndex]!.point,
					samples[secondIndex + 1]!.point,
					tolerance
				)
			) {
				return true;
			}
		}
	}
	return false;
}

function referenceIntersects(
	first: readonly CurveSample[],
	second: readonly CurveSample[],
	tolerance: number,
	ignoreSharedEndpoint?: LayoutVec2
): boolean {
	for (let firstIndex = 1; firstIndex < first.length; firstIndex += 1) {
		for (let secondIndex = 1; secondIndex < second.length; secondIndex += 1) {
			const firstStart = first[firstIndex - 1]!.point;
			const firstEnd = first[firstIndex]!.point;
			const secondStart = second[secondIndex - 1]!.point;
			const secondEnd = second[secondIndex]!.point;
			if (
				ignoreSharedEndpoint &&
				((near(firstEnd, ignoreSharedEndpoint, tolerance) && near(secondStart, ignoreSharedEndpoint, tolerance)) ||
					(near(firstStart, ignoreSharedEndpoint, tolerance) && near(secondEnd, ignoreSharedEndpoint, tolerance)))
			) {
				continue;
			}
			if (referenceSegmentsIntersect(firstStart, firstEnd, secondStart, secondEnd, tolerance)) return true;
		}
	}
	return false;
}

function near(a: LayoutVec2, b: LayoutVec2, tolerance: number): boolean {
	return Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance;
}

// ---------------------------------------------------------------------------
// 2. polylines: real canonical curve samples plus deterministic random ones
// ---------------------------------------------------------------------------

/**
 * The real hot input: a Wall bent far across its neighbours. A deep bow is where
 * the sample count explodes (the adaptive sampler subdivides on flatness and
 * chord, so a 60 m bow on a 12 m Wall produces thousands of samples) — which is
 * exactly why the quadratic predicate dominated the crossing drag.
 */
function bowSamples(height: number): CurveSample[] {
	const start: LayoutVec2 = [0, 0];
	const end: LayoutVec2 = [12, 0];
	const knot: LayoutVec2 = [3, height];
	const centerline = wallCubicChain([{ id: 'w0:knot:1', point: knot }], deriveChainSpans([start, knot, end]));
	const sampled = wallCenterlineSamples({ id: 'w0', centerline }, start, end, 'forward');
	if (!sampled) throw new Error('P23.11 perf pass: bow samples unavailable');
	return [...sampled.samples];
}

function straightSamples(length = 12): CurveSample[] {
	return [...sampleSegment({ id: 's', kind: 'line', start: [0, 0], end: [length, 0] }).samples];
}

/** Deterministic 32-bit LCG — stable random polygons per seed. */
function randomPolyline(seed: number, count: number): CurveSample[] {
	let state = seed >>> 0;
	const next = (): number => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 0x100000000;
	};
	const samples: CurveSample[] = [];
	for (let index = 0; index < count; index += 1) {
		const point: LayoutVec2 = [Math.round(next() * 800) / 100 - 4, Math.round(next() * 800) / 100 - 4];
		samples.push({ point, distance: index, tangent: [1, 0], normal: [0, 1], t: index / count });
	}
	return samples;
}

type PredicateCase = { label: string; samples: readonly CurveSample[]; tolerance: number };

function predicateCases(): PredicateCase[] {
	const cases: PredicateCase[] = [
		{ label: 'deep bow (crossing shape)', samples: bowSamples(60), tolerance: CURVE_SELF_INTERSECTION_TOLERANCE },
		{ label: 'shallow bow', samples: bowSamples(0.3), tolerance: CURVE_SELF_INTERSECTION_TOLERANCE },
		{ label: 'straight chord', samples: straightSamples(), tolerance: CURVE_SELF_INTERSECTION_TOLERANCE },
		{ label: 'dense straight', samples: straightSamples(200), tolerance: CURVE_SELF_INTERSECTION_TOLERANCE },
		{ label: 'zero tolerance', samples: bowSamples(0.3), tolerance: 0 },
		{ label: 'wide tolerance', samples: bowSamples(0.3), tolerance: 0.5 },
		{ label: 'two samples', samples: [straightSamples()[0]!, straightSamples().at(-1)!], tolerance: CURVE_SELF_INTERSECTION_TOLERANCE }
	];
	for (let seed = 1; seed <= 12; seed += 1) {
		cases.push({
			label: `random polyline #${seed}`,
			samples: randomPolyline(seed, 8 + seed * 3),
			tolerance: seed % 3 === 0 ? CURVE_SELF_INTERSECTION_TOLERANCE * 10 : CURVE_SELF_INTERSECTION_TOLERANCE
		});
	}
	return cases;
}

describe('P23.11 pass — the crossing predicates keep their exact answer', () => {
	it('self-intersection agrees with the literal every-pair loop, case by case', () => {
		const cases = predicateCases();
		const mismatches: string[] = [];
		for (const entry of cases) {
			const shipped = sampledPolylineSelfIntersects(entry.samples, entry.tolerance);
			const reference = referenceSelfIntersects(entry.samples, entry.tolerance);
			if (shipped !== reference) mismatches.push(`${entry.label}: shipped ${shipped} vs reference ${reference}`);
		}
		report['self-intersection-parity'] = { cases: cases.length, mismatches };
		expect(mismatches).toEqual([]);
	});

	it('pair intersection agrees with the literal every-pair loop, including the shared-endpoint suppression', () => {
		const bow = bowSamples(60);
		const shallow = bowSamples(0.3);
		const straight = straightSamples();
		const lifted = straight.map((sample) => ({ ...sample, point: [sample.point[0], 25] as LayoutVec2 }));
		const chord: CurveSample[] = [
			{ ...straight[0]!, point: [0, 0] },
			{ ...straight.at(-1)!, point: [12, 0] }
		];
		const pairs: { label: string; first: readonly CurveSample[]; second: readonly CurveSample[]; ignore?: LayoutVec2 }[] = [
			{ label: 'bow vs straight below', first: bow, second: lifted },
			{ label: 'bow vs itself reversed', first: bow, second: [...bow].reverse() },
			{ label: 'shallow bow vs straight', first: shallow, second: straight },
			{ label: 'dense bow vs straight', first: bowSamples(25), second: straight },
			{ label: 'aliased input (same array)', first: shallow, second: shallow },
			{ label: 'aliased dense input', first: bowSamples(25), second: bowSamples(25) },
			{ label: 'chord vs bow crossing it', first: bow, second: chord },
			{ label: 'shared endpoint suppressed', first: bow, second: chord, ignore: [0, 0] },
			{ label: 'shared endpoint not suppressed (other point)', first: bow, second: chord, ignore: [99, 99] }
		];
		for (let seed = 1; seed <= 8; seed += 1) {
			pairs.push({
				label: `random pair #${seed}`,
				first: randomPolyline(seed * 7, 10 + seed * 2),
				second: randomPolyline(seed * 13 + 1, 10 + seed * 2)
			});
			const first = randomPolyline(seed * 3, 12);
			pairs.push({
				label: `random pair shared endpoint #${seed}`,
				first,
				second: randomPolyline(seed * 3, 12),
				ignore: [...first[0]!.point] as LayoutVec2
			});
		}

		const mismatches: string[] = [];
		for (const entry of pairs) {
			const shipped = sampledPolylineIntersects(
				entry.first,
				entry.second,
				CURVE_SELF_INTERSECTION_TOLERANCE,
				entry.ignore
			);
			const reference = referenceIntersects(
				entry.first,
				entry.second,
				CURVE_SELF_INTERSECTION_TOLERANCE,
				entry.ignore
			);
			if (shipped !== reference) mismatches.push(`${entry.label}: shipped ${shipped} vs reference ${reference}`);
		}
		report['pair-intersection-parity'] = { cases: pairs.length, mismatches };
		expect(mismatches).toEqual([]);
	});

	it('still rejects a bow that crosses another Wall and accepts a clear one (end to end)', () => {
		// The gate's own contract, through the shipped planner, on the fixture the
		// investigation measured.
		const crossing = stateFor('bend-10-wall');
		const crossingResult = updateWallFirstWallBend(crossing, TARGET_WALL, { distance: 3, point: [3, 60] });
		expect(crossingResult.success).toBe(false);
		expect(crossingResult.success ? null : crossingResult.code).toBe('topology_invalid');

		const clear = stateFor('bend-10-wall');
		expect(updateWallFirstWallBend(clear, TARGET_WALL, { distance: 3, point: [3, 0.28] }).success).toBe(true);
		expect(liveDocument(clear).walls[0]!.centerline.kind).toBe('cubic-chain');
	});
});

describe('P23.11 pass — the deep-bow crossing case is no longer quadratic', () => {
	it('beats the literal every-pair loop on the same input, with the same answer', () => {
		const bow = bowSamples(60);
		const runs = 5;
		sampledPolylineSelfIntersects(bow, CURVE_SELF_INTERSECTION_TOLERANCE);
		referenceSelfIntersects(bow.slice(0, 64), CURVE_SELF_INTERSECTION_TOLERANCE);

		const shipped: number[] = [];
		for (let index = 0; index < runs; index += 1) {
			const start = performance.now();
			sampledPolylineSelfIntersects(bow, CURVE_SELF_INTERSECTION_TOLERANCE);
			shipped.push(performance.now() - start);
		}
		const reference: number[] = [];
		for (let index = 0; index < runs; index += 1) {
			const start = performance.now();
			referenceSelfIntersects(bow, CURVE_SELF_INTERSECTION_TOLERANCE);
			reference.push(performance.now() - start);
		}
		const shippedStats = stats(shipped)!;
		const referenceStats = stats(reference)!;
		report['deep-bow-self-intersection'] = {
			samples: bow.length,
			everyPairCount: Math.round((bow.length * bow.length) / 2),
			shipped: shippedStats,
			referenceEveryPair: referenceStats,
			speedupP50: round(referenceStats.p50 / shippedStats.p50)
		};
		expect(sampledPolylineSelfIntersects(bow, CURVE_SELF_INTERSECTION_TOLERANCE)).toBe(
			referenceSelfIntersects(bow, CURVE_SELF_INTERSECTION_TOLERANCE)
		);
		// A 4x margin is far below the measured gap and still immune to noise.
		expect(referenceStats.p50).toBeGreaterThan(shippedStats.p50 * 4);
	});
});

// ---------------------------------------------------------------------------
// 3. the shipped preview paths (mirrors the browser fixture harness)
// ---------------------------------------------------------------------------

function fixtureSpec(specId: string): BendFixtureSpec {
	const spec = P2311_FIXTURES.find((candidate) => candidate.id === specId);
	if (!spec) throw new Error(`P23.11 perf pass: unknown fixture ${specId}`);
	return spec;
}

function stateFor(specId: string, edit?: (document: LayoutDocumentWallFirst) => void): LayoutPreviewState {
	const document = p2311Fixture(fixtureSpec(specId));
	edit?.(document);
	const state = createEmptyLayoutPreviewState();
	if (!importLayoutPreviewJson(state, serializeWallFirstLayoutDocument(document))) {
		throw new Error(`P23.11 perf pass: ${specId} import failed — ${state.importError ?? 'unknown'}`);
	}
	return state;
}

function liveDocument(state: LayoutPreviewState): LayoutDocumentWallFirst {
	const layout = state.project.layout;
	if (!('formatVersion' in layout)) throw new Error('P23.11 perf pass: expected a wall-first document');
	return layout as unknown as LayoutDocumentWallFirst;
}

/** The document argument `derivePreviewBundle` accepts, without a cast at every call site. */
function asDeriveDocument(document: LayoutDocumentWallFirst): Parameters<typeof derivePreviewBundle>[2] {
	return document as unknown as Parameters<typeof derivePreviewBundle>[2];
}

function cloneDocument(document: LayoutDocumentWallFirst): LayoutDocumentWallFirst {
	return JSON.parse(JSON.stringify(document)) as LayoutDocumentWallFirst;
}

/** Bend intent mirroring the browser harness: grab 3 m in, place the knot near it. */
function bendIntent(z: number): { distance: number; point: LayoutVec2 } {
	return { distance: 3, point: [3, z] };
}

function meshSignature(state: LayoutPreviewState): Record<string, unknown> {
	return {
		rooms: [...state.wallMeshesByRoom.keys()].sort(),
		walls: [...state.wallMeshesByWall.keys()].sort(),
		picks: [...state.layout3dPickIndexByRoom.keys()].sort(),
		issues: state.issues.map((issue) => `${issue.code}:${issue.targetId ?? ''}`)
	};
}

/** Content checksum per mesh, so "same meshes" is proven rather than assumed. */
function meshChecksums(state: LayoutPreviewState): Map<string, string> {
	const checksum = (value: ArrayLike<number>): string => {
		let sum = 0;
		for (let index = 0; index < value.length; index += 1) sum = (sum * 31 + value[index]!) % 2147483647;
		return `${value.length}:${sum}`;
	};
	const out = new Map<string, string>();
	for (const [wallId, mesh] of state.wallMeshesByWall) {
		out.set(wallId, `${checksum(mesh.positions)}/${checksum(mesh.indices)}`);
	}
	return out;
}

describe('P23.11 pass — the frozen baseline is derived once per gesture', () => {
	it('restores the baseline without rebuilding meshes, while still installing fresh containers', () => {
		for (const specId of ['bend-3-room', 'bend-10-wall', 'bend-50-wall', 'bend-10-room']) {
			const state = stateFor(specId);
			const snapshot = captureLayoutPreviewSnapshot(state);
			const baselineModel = JSON.stringify(state.model);
			const baselineSignature = meshSignature(state);
			const baselineWallMeshes = state.wallMeshesByWall;
			const baselineRoomMeshes = state.wallMeshesByRoom;

			resetWindow();
			restoreLayoutPreviewSnapshot(state, snapshot);
			restoreLayoutPreviewSnapshot(state, snapshot);
			restoreLayoutPreviewSnapshot(state, snapshot);

			// No rebuild: this geometry was already derived when it was installed.
			expect(stageCount('mesh-prebuild'), `${specId} rebuilt baseline meshes`).toBe(0);
			// New containers, so reactive consumers still update...
			expect(state.wallMeshesByWall, `${specId} wall container`).not.toBe(baselineWallMeshes);
			expect(state.wallMeshesByRoom, `${specId} room container`).not.toBe(baselineRoomMeshes);
			// ...wrapping the very same derived meshes and pick index.
			for (const [wallId, mesh] of baselineWallMeshes) {
				expect(state.wallMeshesByWall.get(wallId), `${specId} wall ${wallId}`).toBe(mesh);
			}
			for (const [roomId, mesh] of baselineRoomMeshes) {
				expect(state.wallMeshesByRoom.get(roomId), `${specId} room ${roomId}`).toBe(mesh);
			}
			expect(meshSignature(state)).toEqual(baselineSignature);
			// The model is re-projected rather than JSON-cloned: same content.
			expect(JSON.stringify(state.model)).toBe(baselineModel);
			expect(state.geometry).toBe(snapshot.geometry);
		}
	});

	it('keeps the baseline entry and the candidate entry apart across a gesture', () => {
		const state = stateFor('bend-10-wall');
		const snapshot = captureLayoutPreviewSnapshot(state);
		const baselineWallMeshes = state.wallMeshesByWall;
		const baselineGeometry = snapshot.geometry;

		expect(updateWallFirstWallBend(state, TARGET_WALL, bendIntent(0.28)).success).toBe(true);
		expect(state.geometry).not.toBe(baselineGeometry);
		const candidateMeshes = [...state.wallMeshesByWall.entries()];

		resetWindow();
		restoreLayoutPreviewSnapshot(state, snapshot);
		expect(stageCount('mesh-prebuild')).toBe(0);
		for (const [wallId, mesh] of baselineWallMeshes) {
			expect(state.wallMeshesByWall.get(wallId), wallId).toBe(mesh);
		}
		// The bent Wall's candidate mesh is never recycled as the baseline's.
		const candidateTarget = candidateMeshes.find(([wallId]) => wallId === TARGET_WALL)?.[1];
		expect(candidateTarget).toBeDefined();
		expect(state.wallMeshesByWall.get(TARGET_WALL)).not.toBe(candidateTarget);
	});

	it('derives the same mesh content an independent import derives', () => {
		const restored = stateFor('bend-10-wall');
		restoreLayoutPreviewSnapshot(restored, captureLayoutPreviewSnapshot(restored));
		const fresh = stateFor('bend-10-wall');
		expect([...meshChecksums(restored)]).toEqual([...meshChecksums(fresh)]);
	});
});

describe('P23.11 pass — the accepted compile is installed, not recompiled', () => {
	it('reuses the acceptance result and installs exactly what a fresh compile produces', () => {
		for (const specId of [
			'bend-1-wall',
			'bend-3-room',
			'bend-10-wall',
			'bend-50-wall',
			'bend-10-room',
			'bend-3-room-openings'
		]) {
			const state = stateFor(specId);
			restoreLayoutPreviewSnapshot(state, captureLayoutPreviewSnapshot(state));
			resetWindow();

			const result = updateWallFirstWallBend(state, TARGET_WALL, bendIntent(0.28));
			if (!result.success) throw new Error(`${specId}: bend rejected — ${result.message}`);

			// One install: the accepted compile was consumed, not repeated.
			expect(stageCount('preview-compile'), `${specId} recompiled the accepted document`).toBe(0);
			expect(stageCount('preview-compile-reused'), `${specId} did not reuse`).toBe(1);
			expect(stageStats('preview-compile-reused')!.p95, `${specId} reuse cost`).toBeLessThan(2);

			// The installed state is identical to a from-scratch derive of the same
			// accepted document: geometry, model, issues and bounds.
			const control = derivePreviewBundle(
				state.project.id,
				state.project.name,
				asDeriveDocument(liveDocument(state)),
				state.project.scene
			);
			expect(JSON.stringify(state.geometry), `${specId} geometry`).toBe(JSON.stringify(control.geometry));
			expect(JSON.stringify(state.model), `${specId} model`).toBe(JSON.stringify(control.model));
			expect(JSON.stringify(state.issues), `${specId} issues`).toBe(JSON.stringify(control.issues));
			expect(state.bounds, `${specId} bounds`).toEqual(control.bounds);
		}
	});

	it('refuses to reuse when the accepted document is not the one being installed', () => {
		const state = stateFor('bend-10-wall');
		const plan = planBendWallCurveKnot(cloneDocument(liveDocument(state)), TARGET_WALL, bendIntent(0.28));
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success' || !plan.acceptance) throw new Error('P23.11 perf pass: no acceptance payload');
		const acceptance = plan.acceptance;

		// A *different* document (the same bend, 22 cm further out) must not accept
		// the first document's compile, even though the payload is a real one.
		const other = cloneDocument(liveDocument(state));
		other.walls = other.walls.map((wall) =>
			wall.id === TARGET_WALL
				? {
						...wall,
						centerline: wallCubicChain(
							[{ id: 'w0:knot:1', point: [3, 0.5] as LayoutVec2 }],
							deriveChainSpans([[0, 0], [3, 0.5], [12, 0]] as LayoutVec2[])
						)
					}
				: wall
		);

		resetWindow();
		const mismatched = derivePreviewBundle(
			state.project.id,
			state.project.name,
			asDeriveDocument(other),
			state.project.scene,
			acceptance
		);
		expect(stageCount('preview-compile-reused')).toBe(0);
		expect(stageCount('preview-compile')).toBe(1);

		// ...and it installed the *other* document's geometry, not the payload's.
		const control = derivePreviewBundle(
			state.project.id,
			state.project.name,
			asDeriveDocument(other),
			state.project.scene
		);
		expect(JSON.stringify(mismatched.geometry)).toBe(JSON.stringify(control.geometry));
		expect(JSON.stringify(mismatched.geometry)).not.toBe(JSON.stringify(acceptance.geometry));

		// The document the payload was accepted for still reuses its exact compile.
		resetWindow();
		const matched = derivePreviewBundle(
			state.project.id,
			state.project.name,
			asDeriveDocument(plan.document),
			state.project.scene,
			acceptance
		);
		expect(stageCount('preview-compile-reused')).toBe(1);
		expect(stageCount('preview-compile')).toBe(0);
		expect(matched.geometry).toBe(acceptance.geometry);
	});

	it('reports the per-move cost of a representative multi-Room Bend', () => {
		const probeReport: Record<string, unknown> = {};
		for (const specId of ['bend-1-wall', 'bend-3-room', 'bend-10-wall', 'bend-50-wall', 'bend-10-room']) {
			const spec = fixtureSpec(specId);
			const state = stateFor(specId);
			const snapshot = captureLayoutPreviewSnapshot(state);
			resetWindow();
			const moves = 24;
			let valid = 0;
			for (let index = 0; index < moves; index += 1) {
				const z = 0.28 + 0.045 * Math.sin(index * 0.3);
				const distance = spec.knots === 3 ? 4.5 : 3;
				// `pointer-cpu` is the whole pointermove: one move of a drag (the frozen
				// baseline restored first, exactly as the viewport and the fixture
				// harness do) plus the viewport's own Plan derived.
				const result = p2311Measure('pointer-cpu', () => {
					const move = p2311Measure('bend-move-total', () => {
						restoreLayoutPreviewSnapshot(state, snapshot);
						return updateWallFirstWallBend(state, TARGET_WALL, { distance, point: [distance, z] });
					});
					p2311Measure('plan-render-model', () => buildPlanRenderModel(state.geometry));
					return move;
				});
				if (result.success) valid += 1;
			}
			probeReport[specId] = {
				fixture: { walls: spec.walls, rooms: spec.rooms, knots: spec.knots, openings: spec.openings },
				valid,
				moves,
				pointerCpu: stageStats('pointer-cpu'),
				moveTotal: stageStats('bend-move-total'),
				stages: Object.fromEntries([...recordedStages()].map(([name, values]) => [name, stats(values)]))
			};
			expect(valid, `${specId}: every move of the probe must accept`).toBe(moves);
		}
		report['per-move-cost'] = probeReport;
		expect(Object.keys(probeReport).length).toBe(5);
	}, 120_000);
});
