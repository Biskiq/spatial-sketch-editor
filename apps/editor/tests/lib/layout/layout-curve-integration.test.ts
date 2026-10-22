/**
 * P23.11 Slice 8 — cross-layer closeout (kernel-level).
 *
 * The per-slice suites pin their own slice. This file pinned the seams
 * *between* slices. PR #115 (§7.2 category D extraction) removed the editor
 * shell, so the surviving half is the one that was always about the kernel:
 *
 * - **Save/Load** — the exact chain survives the real codec, so a saved
 *   project is not a lossy version of the canonical document;
 * - **one compiled sample set** — the compiled geometry really is curved and
 *   carries no per-Room duplicate to disagree with;
 * - **curved split** — with Openings, through the real planner: exact
 *   geometry, preserved identity, rebased Openings.
 *
 * The removed half drove the same planners through the deleted preview-state
 * adapter, the editor store's history entry and the museum facade copy: one
 * Undo entry, `store.canUndo/undo/redo`, "no Layout curve operation touches
 * Scene state", the `buildLayoutPreviewModel` preview projection and the
 * `src/lib/layout/*` ↔ `apps/museum` facade byte-identity walk. Those tested
 * removed behaviour. Arithmetic and expectations for every surviving assertion
 * are unchanged.
 */
import { describe, expect, it } from 'vitest';

import {
	deriveLayoutWallRole,
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	parseWallFirstLayoutDocumentJson,
	planWallSplit,
	sampleSegment,
	serializeWallFirstLayoutDocument,
	wallCubicChain,
	wallCurveChainLength,
	wallFirstWallSpan,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCenterline,
	type LayoutWallCurveKnot,
	type LayoutWallCubicSpan,
	type NodingIdAllocator,
	type NodingPlan
} from '@portfolio/layout-core';

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const LINE = { kind: 'line' } as const;
const CHORD = 12;

function knotsOf(...points: LayoutVec2[]): LayoutWallCurveKnot[] {
	return points.map((point, index) => ({
		id: `wall-a:knot:${index + 1}`,
		point: [point[0], point[1]] as LayoutVec2
	}));
}

function chainOf(start: LayoutVec2, end: LayoutVec2, ...interior: LayoutVec2[]): LayoutWallCenterline {
	return wallCubicChain(knotsOf(...interior), deriveChainSpans([start, ...interior, end]));
}

/**
 * A closed 12×4 m Room whose `wall-a` is a two-bend curve, with optional
 * Openings, so Room reconciliation and Opening rebasing run through the real
 * paths.
 */
function curvedRoomDocument(
	openings: ReadonlyArray<{ id: string; offset: number; width: number }> = []
): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions = [
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-b', point: [CHORD, 0] },
		{ id: 'j-c', point: [CHORD, 4] },
		{ id: 'j-d', point: [0, 4] }
	];
	document.walls = [
		{
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			thickness: 0.2,
			height: 3,
			centerline: chainOf([0, 0], [CHORD, 0], [3, 2], [8, -1])
		},
		{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'wall-c', startJunctionId: 'j-c', endJunctionId: 'j-d', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', thickness: 0.2, height: 3, centerline: LINE }
	];
	document.rooms = [
		{
			id: 'room-a',
			name: 'Room A',
			boundary: (['wall-a', 'wall-b', 'wall-c', 'wall-d'] as const).map((wallId) => ({
				wallId,
				direction: 'forward' as const
			})),
			floorThickness: 0.1,
			ceilingThickness: 0.1
		}
	];
	document.openings = openings.map((opening) => ({
		id: opening.id,
		wallId: 'wall-a',
		kind: 'window' as const,
		offset: opening.offset,
		width: opening.width,
		height: 1.2,
		sillHeight: 0.9,
		profile: 'rectangular' as const
	}));
	return document;
}

/** Deterministic allocator, matching the planner-level suites. */
function allocator(): NodingIdAllocator {
	return {
		nextWallId(base, seed) {
			let candidate = `${seed}-1`;
			let counter = 1;
			while (base.walls.some((wall) => wall.id === candidate)) {
				counter += 1;
				candidate = `${seed}-${counter}`;
			}
			return candidate;
		},
		nextJunctionId(base, seed) {
			let candidate = `j-${seed}-1`;
			let counter = 1;
			while (base.junctions.some((junction) => junction.id === candidate)) {
				counter += 1;
				candidate = `j-${seed}-${counter}`;
			}
			return candidate;
		}
	};
}

function expectSuccess(plan: NodingPlan): Extract<NodingPlan, { kind: 'success' }> {
	if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
	return plan;
}

function wallOf(document: LayoutDocumentWallFirst, wallId: string): LayoutWall {
	return document.walls.find((wall) => wall.id === wallId)!;
}

type ChainView = {
	startPoint: LayoutVec2;
	endPoint: LayoutVec2;
	knots: readonly LayoutWallCurveKnot[];
	spans: readonly LayoutWallCubicSpan[];
};

function chainViewOf(document: LayoutDocumentWallFirst, wallId: string): ChainView {
	const wall = wallOf(document, wallId);
	if (wall.centerline.kind !== 'cubic-chain') throw new Error(`Wall '${wallId}' is not a chain`);
	const junctionPoint = (junctionId: string): LayoutVec2 =>
		[...document.junctions.find((junction) => junction.id === junctionId)!.point] as LayoutVec2;
	return {
		startPoint: junctionPoint(wall.startJunctionId),
		endPoint: junctionPoint(wall.endJunctionId),
		knots: wall.centerline.knots,
		spans: wall.centerline.spans
	};
}

function samplePointsOf(document: LayoutDocumentWallFirst, wallId: string): LayoutVec2[] {
	const view = chainViewOf(document, wallId);
	const points: LayoutVec2[] = [view.startPoint, ...view.knots.map((knot) => knot.point), view.endPoint];
	return sampleSegment({
		id: wallId,
		kind: 'cubic-chain',
		cubics: view.spans.map((span, index) => ({
			start: points[index]!,
			handleOut: span.handleOut,
			handleIn: span.handleIn,
			end: points[index + 1]!
		}))
	}).samples.map((sample) => [...sample.point] as LayoutVec2);
}

function wallLengthOf(document: LayoutDocumentWallFirst, wallId: string): number {
	return wallFirstWallSpan(document, wallOf(document, wallId))!.length;
}

function deviationFrom(point: LayoutVec2, polyline: readonly LayoutVec2[]): number {
	let best = Number.POSITIVE_INFINITY;
	for (let index = 1; index < polyline.length; index += 1) {
		const start = polyline[index - 1]!;
		const end = polyline[index]!;
		const dx = end[0] - start[0];
		const dz = end[1] - start[1];
		const squared = dx * dx + dz * dz;
		const raw = squared > 0 ? ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / squared : 0;
		const amount = Math.min(1, Math.max(0, raw));
		const projected: LayoutVec2 = [start[0] + dx * amount, start[1] + dz * amount];
		best = Math.min(best, Math.hypot(point[0] - projected[0], point[1] - projected[1]));
	}
	return best;
}

// ---------------------------------------------------------------------------
// Save / Load
// ---------------------------------------------------------------------------

describe('P23.11 slice 8 — Save/Load preserves the chain exactly', () => {
	it('round-trips knots, spans and IDs through the real codec', () => {
		const document = curvedRoomDocument([{ id: 'door', offset: 1.5, width: 1 }]);
		const json = serializeWallFirstLayoutDocument(document);
		const parsed = parseWallFirstLayoutDocumentJson(json);
		if (!parsed.success) throw new Error(`parse failed: ${JSON.stringify(parsed)}`);

		expect(JSON.stringify(parsed.document)).toBe(JSON.stringify(document));
		const chain = wallOf(parsed.document, 'wall-a').centerline;
		if (chain.kind !== 'cubic-chain') throw new Error('expected a chain');
		// Knot identity and order, and one span per cubic — `spans.length ===
		// knots.length + 1` is a validated invariant, not a convention.
		expect(chain.knots.map((knot) => knot.id)).toEqual(['wall-a:knot:1', 'wall-a:knot:2']);
		expect(chain.spans).toHaveLength(3);
		expect(chain.spans[0]).toEqual(chainViewOf(document, 'wall-a').spans[0]);
	});

	it('reimports to identical compiled samples', () => {
		const document = curvedRoomDocument([{ id: 'door', offset: 1.5, width: 1 }]);
		const compiled = compileWallFirstLayoutGeometry(document).geometry;
		const reparsed = parseWallFirstLayoutDocumentJson(serializeWallFirstLayoutDocument(document));
		if (!reparsed.success) throw new Error('parse failed');
		const recompiled = compileWallFirstLayoutGeometry(reparsed.document).geometry;

		const samples = (geometry: typeof compiled) =>
			JSON.stringify(
				geometry.rooms.map((room) => room.walls.map((wall) => ({ id: wall.segmentId, samples: wall.samples })))
			);
		expect(samples(recompiled)).toBe(samples(compiled));
	});
});

// ---------------------------------------------------------------------------
// one compiled sample set
// ---------------------------------------------------------------------------

describe('P23.11 slice 8 — the compiled sample set is the canonical one', () => {
	it('compiles the curved Wall as one flat record whose samples really are the chain', () => {
		const document = curvedRoomDocument();
		const compiled = compileWallFirstLayoutGeometry(document).geometry;

		// One flat record per physical Wall — and the curved one really is
		// curved, so a chord-length report would show up as an exactly-12 m
		// length. Wall-first Rooms carry no per-Room duplicate to disagree with.
		const curved = compiled.walls.find((wall) => wall.wallId === 'wall-a')!;
		expect(curved.samples.length).toBeGreaterThan(2);
		expect(curved.length).toBeGreaterThan(CHORD);
		expect(compiled.rooms.every((room) => room.walls.length === 0)).toBe(true);
		// The sampled centerline IS the chain: the flat record's sample count
		// matches the chain samples the split and bend planners operate on.
		expect(curved.samples.map((sample) => sample.distance).at(-1)!).toBeCloseTo(curved.length, 6);
	});
});

// ---------------------------------------------------------------------------
// curved split
// ---------------------------------------------------------------------------

describe('P23.11 slice 8 — exact curved split through the planner', () => {
	it('splits inside a Room, preserving identity and rebasing the Openings', () => {
		const seed = curvedRoomDocument([
			{ id: 'near', offset: 1, width: 1 },
			{ id: 'far', offset: 8, width: 1.5 }
		]);
		const baselineSamples = samplePointsOf(seed, 'wall-a');
		const baselineLength = wallLengthOf(seed, 'wall-a');
		const chainLength = wallCurveChainLength(chainViewOf(seed, 'wall-a'));

		const plan = expectSuccess(planWallSplit(seed, 'wall-a', baselineLength * 0.45, allocator()));
		const next = plan.document;
		const first = wallOf(next, 'wall-a');
		// The retained ID keeps the start fragment; the created Wall carries the
		// rest, and the two share exactly one new Junction.
		const second = next.walls.find(
			(candidate) => candidate.id !== 'wall-a' && candidate.startJunctionId === first.endJunctionId
		)!;
		expect(second.endJunctionId).toBe('j-b');
		/* Format 6: role is derived, so the split fragment keeps the same derived role. */
		expect(deriveLayoutWallRole(next, second.id)).toBe(deriveLayoutWallRole(next, first.id));
		expect(second.thickness).toBe(first.thickness);
		expect(second.height).toBe(first.height);
		expect(next.junctions).toHaveLength(5);

		// Exactness in canonical space: the two fragments' true cubic arcs rejoin
		// the pre-split chain exactly.
		expect(
			wallCurveChainLength(chainViewOf(next, 'wall-a')) + wallCurveChainLength(chainViewOf(next, second.id))
		).toBeCloseTo(chainLength, 9);
		// Exactness in the read path: every sample of either fragment lies on the
		// original curve (sampled polylines agree within the evaluator's flatness
		// tolerance — the exact claim is the canonical one above).
		expect(
			Math.max(
				...[...samplePointsOf(next, 'wall-a'), ...samplePointsOf(next, second.id)].map((point) =>
					deviationFrom(point, baselineSamples)
				)
			)
		).toBeLessThan(0.01);
		expect(wallLengthOf(next, 'wall-a') + wallLengthOf(next, second.id)).toBeCloseTo(baselineLength, 2);

		// Room identity survives, with the boundary rewritten to both fragments.
		expect(next.rooms).toHaveLength(1);
		expect(next.rooms[0]!.id).toBe('room-a');
		expect(next.rooms[0]!.boundary.map((ref) => ref.wallId)).toEqual([
			'wall-a',
			second.id,
			'wall-b',
			'wall-c',
			'wall-d'
		]);

		// Openings keep their IDs and their physical placement: the one before the
		// cut stays on the first fragment, the one after moves with `offset − d`.
		const near = next.openings.find((opening) => opening.id === 'near')!;
		const far = next.openings.find((opening) => opening.id === 'far')!;
		expect(near.wallId).toBe('wall-a');
		expect(near.offset).toBeCloseTo(1, 9);
		expect(far.wallId).toBe(second.id);
		expect(far.offset).toBeCloseTo(8 - baselineLength * 0.45, 3);
		expect(far.width).toBe(1.5);
	});

	it('rejects a split through an Opening interior', () => {
		const seed = curvedRoomDocument([{ id: 'door', offset: 5, width: 2 }]);
		const plan = planWallSplit(seed, 'wall-a', 6, allocator());
		// The runner used to report this as a cancelled transaction; at the
		// planner level the same expectation is a rejection.
		expect(plan.kind).toBe('rejected');
	});
});
