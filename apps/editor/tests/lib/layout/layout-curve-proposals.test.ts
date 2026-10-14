/**
 * P23.11 follow-up proposals, fix 4 and fix 5 — the transient proposal seam.
 *
 * The properties pinned here:
 *
 * - **direct-edit geometry proposals** stay visually live for invalid geometry,
 *   carrying complete affected Wall centerlines (a translated bow keeps its
 *   curvature rather than collapsing to a two-point chord);
 * - **visible Add Bend Point** — a straight Wall converts and inserts in one
 *   atomic candidate, geometry unchanged, through the same canonical insertion
 *   authority an existing curve uses;
 * - **the proposal is separate from acceptance** — an invalid drag keeps
 *   following the raw pointer while the canonical planner refuses it, and the
 *   proposal never mutates the baseline document.
 *
 * Split by behavioural seam out of `layout-curve-regressions.test.ts`
 * (PR #115 WP3T, plan §7.6 area 2).
 */
import { describe, expect, it } from 'vitest';

import {
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	planConvertWallToCurve,
	planDeleteWallCurveKnot,
	planInsertWallCurveKnot,
	planMoveWallCurveKnot,
	proposeWallFirstArchitectureGeometry,
	proposeWallCurveShape,
	sampleSegment,
	wallCubicChain,
	wallFirstWallSpan,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCenterline,
	type LayoutWallCubicSpan,
	type LayoutWallCurveKnot
} from '@portfolio/layout-core';

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

function documentOf(centerline: LayoutWallCenterline): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
	document.junctions = [
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-b', point: [CHORD, 0] }
	];
	document.walls = [
		{
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			role: 'partition',
			thickness: 0.2,
			height: 3,
			centerline
		} as LayoutWall
	];
	return document;
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
	const start = document.junctions.find((junction) => junction.id === wall.startJunctionId)!.point;
	const end = document.junctions.find((junction) => junction.id === wall.endJunctionId)!.point;
	return { startPoint: start, endPoint: end, knots: wall.centerline.knots, spans: wall.centerline.spans };
}

function segmentOf(document: LayoutDocumentWallFirst, wallId: string) {
	const view = chainViewOf(document, wallId);
	const points: LayoutVec2[] = [view.startPoint, ...view.knots.map((knot) => knot.point), view.endPoint];
	return {
		id: wallId,
		kind: 'cubic-chain' as const,
		cubics: view.spans.map((span, index) => ({
			start: points[index]!,
			handleOut: span.handleOut,
			handleIn: span.handleIn,
			end: points[index + 1]!
		}))
	};
}

function samplePointsOf(document: LayoutDocumentWallFirst, wallId: string): LayoutVec2[] {
	return sampleSegment(segmentOf(document, wallId)).samples.map((sample) => [...sample.point] as LayoutVec2);
}

/**
 * The curved-host enclosure these proposal cases read. Duplicated from the
 * distance/crossing suite rather than shared: two callers is below the point
 * where an indirection is clearer than the fixture itself.
 */
function curvedWallDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
	document.junctions = [
		{ id: 'c-a', point: [0, 0] },
		{ id: 'c-b', point: [6, 0] }
	];
	document.walls = [
		{
			id: 'curved',
			startJunctionId: 'c-a',
			endJunctionId: 'c-b',
			role: 'partition',
			thickness: 0.2,
			height: 3,
			centerline: chainOf([0, 0], [6, 0], [3, 3])
		} as LayoutWall
	];
	return document;
}

function curvedBoundaryHostDocument(): LayoutDocumentWallFirst {
	const document = curvedWallDocument();
	document.walls[0]!.role = 'boundary';
	document.junctions.push(
		{ id: 'c-c', point: [6, 4] },
		{ id: 'c-d', point: [0, 4] }
	);
	document.walls.push(
		{ id: 'wall-right', startJunctionId: 'c-b', endJunctionId: 'c-c', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'wall-top', startJunctionId: 'c-c', endJunctionId: 'c-d', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'wall-left', startJunctionId: 'c-d', endJunctionId: 'c-a', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE }
	);
	document.rooms = [
		{
			id: 'room-curved-host',
			name: 'Curved host room',
			boundary: [
				{ wallId: 'curved', direction: 'forward' },
				{ wallId: 'wall-right', direction: 'forward' },
				{ wallId: 'wall-top', direction: 'forward' },
				{ wallId: 'wall-left', direction: 'forward' }
			],
			floorThickness: 0.1,
			ceilingThickness: 0.1
		}
	];
	return document;
}

// ===========================================================================
// Direct-edit proposal follow-up — invalid geometry stays visually live
// ===========================================================================

describe('P23.11 follow-up — direct-edit geometry proposals', () => {
	it('moves a Junction and returns complete affected Wall centerlines', () => {
		const baseline = curvedBoundaryHostDocument();
		const proposal = proposeWallFirstArchitectureGeometry(baseline, {
			kind: 'junction-move',
			junctionId: 'c-b',
			point: [6.2, 0.4]
		});
		if (!proposal) throw new Error('expected a Junction proposal');
		expect(proposal.map((wall) => wall.wallId)).toEqual(['curved', 'wall-right']);
		expect(proposal.every((wall) => wall.points.length > 2)).toBe(true);
		expect(proposal.find((wall) => wall.wallId === 'curved')!.points.at(-1)).toEqual([6.2, 0.4]);
	});

	it('translates a curved Wall as a curved chain and includes reshaped neighbours', () => {
		const baseline = curvedBoundaryHostDocument();
		const proposal = proposeWallFirstArchitectureGeometry(baseline, {
			kind: 'wall-move',
			wallId: 'curved',
			delta: [1, 1]
		});
		if (!proposal) throw new Error('expected a Wall proposal');
		expect(proposal.map((wall) => wall.wallId)).toEqual(['curved', 'wall-right', 'wall-left']);
		const curved = proposal.find((wall) => wall.wallId === 'curved')!;
		expect(curved.points.length).toBeGreaterThan(2);
		expect(curved.points[0]).toEqual([1, 1]);
		expect(curved.points.at(-1)).toEqual([7, 1]);
		// The translated bow remains visible; a two-point endpoint chord would
		// lose the very geometry this proposal exists to communicate.
		expect(curved.points.some((point) => point[1] > 1)).toBe(true);
	});
});

// ===========================================================================
// Fix 4 — visible "Add bend point here" works on a straight Wall
// ===========================================================================

describe('P23.11 fix 4 — Add Bend Point on a straight Wall', () => {
	it('converts and inserts atomically with the geometry visually unchanged', () => {
		const baseline = documentOf(LINE);
		const before = wallFirstWallSpan(baseline, wallOf(baseline, 'wall-a'))!;
		const plan = planInsertWallCurveKnot(baseline, 'wall-a', 4);
		if (plan.kind !== 'success') throw new Error('expected the insert to succeed');
		const after = wallFirstWallSpan(plan.document, wallOf(plan.document, 'wall-a'))!;
		expect(plan.operation).toBe('wall-curve-knot-insert');
		expect(after.length).toBeCloseTo(before.length, 9);
		const chain = chainViewOf(plan.document, 'wall-a');
		expect(chain.knots).toHaveLength(1);
		expect(chain.knots[0]!.point[0]).toBeCloseTo(4, 9);
		expect(chain.knots[0]!.point[1]).toBeCloseTo(0, 9);
		expect(samplePointsOf(plan.document, 'wall-a').every((point) => Math.abs(point[1]) < 1e-9)).toBe(true);
		// The baseline stays a straight line → one history entry.
		expect(wallOf(baseline, 'wall-a').centerline).toEqual({ kind: 'line' });
	});

	// PR #115 removed the editor Inspector (§5.1), so the "Add Bend Point stays
	// visible without an existing knot" source pin went with it. The kernel half
	// of the same guarantee — that a knot-less cubic chain still hosts a bend
	// point — is asserted by the case below against the plan API directly.

	it('uses the same canonical insertion authority as an existing curve', () => {
		// A knot-less cubic chain (what deleting the last bend point leaves) still
		// hosts a bend point: the chain form is the authority, not a knot count.
		const converted = planConvertWallToCurve(documentOf(LINE), 'wall-a');
		if (converted.kind !== 'success') throw new Error('expected the conversion to succeed');
		const deleted = planDeleteWallCurveKnot(converted.document, 'wall-a', 'wall-a:knot:1');
		if (deleted.kind !== 'success') throw new Error('expected the delete to succeed');
		const knotless = wallOf(deleted.document, 'wall-a').centerline;
		expect(knotless.kind).toBe('cubic-chain');
		if (knotless.kind !== 'cubic-chain') return;
		expect(knotless.knots).toEqual([]);
		const inserted = planInsertWallCurveKnot(deleted.document, 'wall-a', 5);
		expect(inserted.kind).toBe('success');
	});
});

// ===========================================================================
// Fix 5 — the pure curve proposal seam (invalid drag keeps following)
// ===========================================================================

describe('P23.11 fix 5 — the proposal is separate from acceptance', () => {
	it('proposes the attempted Wall shape while the canonical planner rejects it', () => {
		// Thick Wall whose bend would fold the offset: acceptance refuses it, but
		// the transient proposal still describes the attempted geometry so the
		// drag can keep tracking the cursor instead of snapping back.
		const document = documentOf(chainOf([0, 0], [CHORD, 0], [3, 0.5]));
		document.walls[0]!.thickness = 8;
		const rejected = planMoveWallCurveKnot(document, 'wall-a', 'wall-a:knot:1', [3, 3]);
		expect(rejected.kind).toBe('rejected');

		const proposed = proposeWallCurveShape(document, 'wall-a', {
			kind: 'knot-move',
			knotId: 'wall-a:knot:1',
			point: [3, 3]
		});
		expect(proposed).toBeDefined();
		expect(proposed!.length).toBeGreaterThan(2);
		// The attempted shape actually leaves the base line (it is not the
		// baseline), and its peak reaches the dragged bend point.
		expect(Math.max(...proposed!.map((point) => point[1]))).toBeGreaterThan(2);
	});

	it('follows the current raw pointer and never mutates the baseline', () => {
		const document = documentOf(chainOf([0, 0], [CHORD, 0], [3, 2]));
		const snapshot = JSON.stringify(document);
		const first = proposeWallCurveShape(document, 'wall-a', {
			kind: 'knot-move',
			knotId: 'wall-a:knot:1',
			point: [3, 4]
		})!;
		const second = proposeWallCurveShape(document, 'wall-a', {
			kind: 'knot-move',
			knotId: 'wall-a:knot:1',
			point: [3, -2]
		})!;
		// Each proposal describes its own pointer position.
		expect(Math.max(...first.map((point) => point[1]))).toBeGreaterThan(2);
		expect(Math.min(...second.map((point) => point[1]))).toBeLessThan(0);
		// Pure: the baseline document is untouched.
		expect(JSON.stringify(document)).toBe(snapshot);
	});

	it('proposes a bend attempt on a straight Wall without installing it', () => {
		const document = documentOf(LINE);
		const proposed = proposeWallCurveShape(document, 'wall-a', {
			kind: 'bend',
			distance: 4,
			point: [4, 2]
		});
		expect(proposed).toBeDefined();
		expect(wallOf(document, 'wall-a').centerline).toEqual({ kind: 'line' });
	});

	it('returns undefined for an unproposable intent', () => {
		const document = documentOf(chainOf([0, 0], [CHORD, 0], [3, 2]));
		expect(
			proposeWallCurveShape(document, 'wall-a', {
				kind: 'knot-move',
				knotId: 'missing',
				point: [1, 1]
			})
		).toBeUndefined();
		expect(
			proposeWallCurveShape(document, 'wall-a', {
				kind: 'knot-move',
				knotId: 'wall-a:knot:1',
				point: [Number.NaN, 1]
			})
		).toBeUndefined();
		// Out-of-range bend distance cannot even be proposed.
		expect(
			proposeWallCurveShape(document, 'wall-a', {
				kind: 'bend',
				distance: -1,
				point: [1, 1]
			})
		).toBeUndefined();
	});
});
