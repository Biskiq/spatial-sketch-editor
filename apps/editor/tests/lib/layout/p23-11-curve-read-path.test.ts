/**
 * P23.11 Slice 2 — evaluator, compiler and arc-length read path.
 *
 * The wall-first compiler, the Room-boundary adapter and `wallFirstWallSpan`
 * all read Wall centerline geometry through the ONE `layout-wall-centerline`
 * seam, so a curved Wall flows through the existing curve kernel unchanged
 * (no second sampling path). Straight Walls keep byte-identical compiled
 * output: a line's sampled arc length equals its chord exactly, so every
 * length/offset decision below is a strict generalisation, not a rewrite.
 *
 * The read-path consequences pinned here:
 * - reverse-traversal Room references mirror Opening offsets by **sampled arc
 *   length**, never the Euclidean chord (chord mirroring on a bowed Wall can
 *   drive an offset negative or out of bounds);
 * - the canonical Opening set measures host fit against the sampled arc;
 * - the canonical chain and the legacy `auto-bezier` `DraftSegment` are both
 *   flattened by the same core, so a curve expressible as either produces
 *   identical samples.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	pointAlongSamples,
	sampleSegment,
	validateWallFirstOpeningSet,
	wallCenterlineSamples,
	wallCenterlineSegment,
	wallCubicChain,
	wallFirstWallSpan,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCenterline,
	type LayoutWallCurveKnot,
	type SampleableSegment
} from '@portfolio/layout-core';

const CHORD = 6;
const EPSILON = 1e-9;

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

/** One 6 m Wall from `j-a` to `j-b`; `centerline` decides straight vs curved. */
function singleWallDocument(centerline: LayoutWall['centerline']): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions = [
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-b', point: [CHORD, 0] }
	];
	document.walls = [
		{
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline
		}
	];
	return document;
}

function straightWallDocument(): LayoutDocumentWallFirst {
	return singleWallDocument({ kind: 'line' });
}

/**
 * Build a chain from an ordered point list exactly the way the planners do:
 * knots carry identity, one control pair per span comes from the canonical
 * write-path rule.
 */
function chainFromPoints(wallId: string, points: readonly LayoutVec2[]): LayoutWallCenterline {
	const knots: LayoutWallCurveKnot[] = points
		.slice(1, -1)
		.map((point, index) => ({ id: `${wallId}:knot:${index + 1}`, point: [...point] as LayoutVec2 }));
	return wallCubicChain(knots, deriveChainSpans(points));
}

/** The bowed Wall: endpoints 6 m apart on z = 0, centerline peaks at z = 2. */
function curvedChain(): LayoutWallCenterline {
	return chainFromPoints('wall-a', [
		[0, 0],
		[3, 2],
		[CHORD, 0]
	]);
}

/** Two bend points, three spans: the multi-knot case reverse mirroring needs. */
function multiKnotChain(): LayoutWallCenterline {
	return chainFromPoints('wall-a', [
		[0, 0],
		[2, 1.5],
		[4, -1.5],
		[CHORD, 0]
	]);
}

function curvedWallDocument(): LayoutDocumentWallFirst {
	return singleWallDocument(curvedChain());
}

/**
 * Closed 6×4 enclosure whose `wall-a` is curved. `direction` selects the
 * traversal orientation of every boundary reference, so the mirroring branch
 * of the compiler can be exercised without any second fixture.
 */
function enclosureDocument(
	centerline: LayoutWall['centerline'],
	direction: 'forward' | 'reverse',
	openingOffset: number,
	openingWidth: number
): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions = [
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-b', point: [CHORD, 0] },
		{ id: 'j-c', point: [CHORD, 4] },
		{ id: 'j-d', point: [0, 4] }
	];
	const straight = { kind: 'line' } as const;
	document.walls = [
		{
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline
		},
		{
			id: 'wall-b',
			startJunctionId: 'j-b',
			endJunctionId: 'j-c',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: straight
		},
		{
			id: 'wall-c',
			startJunctionId: 'j-c',
			endJunctionId: 'j-d',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: straight
		},
		{
			id: 'wall-d',
			startJunctionId: 'j-d',
			endJunctionId: 'j-a',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: straight
		}
	];
	document.rooms = [
		{
			id: 'room-a',
			name: 'Room A',
			boundary:
				direction === 'forward'
					? [
							{ wallId: 'wall-a', direction: 'forward' },
							{ wallId: 'wall-b', direction: 'forward' },
							{ wallId: 'wall-c', direction: 'forward' },
							{ wallId: 'wall-d', direction: 'forward' }
						]
					: [
							{ wallId: 'wall-d', direction: 'reverse' },
							{ wallId: 'wall-c', direction: 'reverse' },
							{ wallId: 'wall-b', direction: 'reverse' },
							{ wallId: 'wall-a', direction: 'reverse' }
						],
			floorThickness: 0.1,
			ceilingThickness: 0.1
		}
	];
	document.openings = [
		{
			id: 'opening-a',
			wallId: 'wall-a',
			kind: 'window',
			offset: openingOffset,
			width: openingWidth,
			height: 1.2,
			sillHeight: 0.9,
			profile: 'rectangular'
		}
	];
	return document;
}

function compiledWall(document: LayoutDocumentWallFirst, wallId: string) {
	const { geometry, issues } = compileWallFirstLayoutGeometry(document);
	return { wall: geometry.walls.find((candidate) => candidate.wallId === wallId)!, issues };
}

function endpointsOf(
	document: LayoutDocumentWallFirst,
	wall: LayoutWall
): { start: LayoutVec2; end: LayoutVec2 } {
	return {
		start: document.junctions.find((junction) => junction.id === wall.startJunctionId)!.point,
		end: document.junctions.find((junction) => junction.id === wall.endJunctionId)!.point
	};
}

/** Reference arc length straight from the one canonical adapter. */
function adapterLength(document: LayoutDocumentWallFirst, wall: LayoutWall): number {
	const { start, end } = endpointsOf(document, wall);
	return sampleSegment(wallCenterlineSegment(wall, start, end, 'forward')).length;
}

function blockingIssues(issues: readonly { severity?: string }[]) {
	return issues.filter((issue) => issue.severity !== 'warning');
}

// ---------------------------------------------------------------------------
// straight Walls
// ---------------------------------------------------------------------------

describe('P23.11 slice 2 — straight-Wall compilation is unchanged', () => {
	it('keeps chord length, densification and collinearity for a line Wall', () => {
		const document = straightWallDocument();
		const { wall: compiled, issues } = compiledWall(document, 'wall-a');
		expect(blockingIssues(issues)).toEqual([]);
		// A line's sampled arc length equals its chord exactly, so every
		// pre-curve length decision keeps its old value.
		expect(compiled.length).toBeCloseTo(CHORD, 9);
		// 0.25 m max sample span densifies a 6 m line into 25 samples.
		expect(compiled.samples).toHaveLength(25);
		for (const sample of compiled.samples) {
			// Every sample lies on the chord's line (z = 0).
			expect(Math.abs(sample.point[1])).toBeLessThan(EPSILON);
		}
	});

	it('compiles straight Walls through the canonical adapter output', () => {
		const document = straightWallDocument();
		const wall = document.walls[0]!;
		const { wall: compiled } = compiledWall(document, 'wall-a');
		const reference = wallCenterlineSamples(wall, [0, 0], [CHORD, 0], 'forward')!;
		// One sampling path: the compiled samples ARE the adapter's samples.
		expect(compiled.samples).toEqual(reference.samples);
		expect(compiled.length).toBe(reference.length);
	});
});

// ---------------------------------------------------------------------------
// curved Walls
// ---------------------------------------------------------------------------

describe('P23.11 slice 2 — curved Walls compile through the same kernel', () => {
	it('emits non-linear samples and reports sampled arc length over the chord', () => {
		const document = curvedWallDocument();
		const wall = document.walls[0]!;
		const { wall: compiled, issues } = compiledWall(document, 'wall-a');
		expect(blockingIssues(issues)).toEqual([]);
		// The bow pushes real arc length past the 6 m chord.
		expect(compiled.length).toBeGreaterThan(CHORD);
		expect(compiled.length).toBeCloseTo(adapterLength(document, wall), 9);
		// Samples leave the chord line: the chain reaches its z = 2 bend point.
		const peak = Math.max(...compiled.samples.map((sample) => sample.point[1]));
		expect(peak).toBeGreaterThan(1.5);
		expect(compiled.samples).toEqual(
			wallCenterlineSamples(wall, [0, 0], [CHORD, 0], 'forward')!.samples
		);
		for (let index = 1; index < compiled.samples.length; index += 1) {
			expect(compiled.samples[index]!.distance).toBeGreaterThan(
				compiled.samples[index - 1]!.distance
			);
		}
	});

	it('reports arc length over the chord through wallFirstWallSpan', () => {
		const straight = straightWallDocument();
		const curved = curvedWallDocument();
		const straightSpan = wallFirstWallSpan(straight, straight.walls[0]!)!;
		const curvedSpan = wallFirstWallSpan(curved, curved.walls[0]!)!;
		// Endpoints stay the resolved Junction coordinates in both cases.
		expect(straightSpan.start).toEqual([0, 0]);
		expect(straightSpan.end).toEqual([CHORD, 0]);
		expect(curvedSpan.start).toEqual([0, 0]);
		expect(curvedSpan.end).toEqual([CHORD, 0]);
		expect(straightSpan.length).toBeCloseTo(CHORD, 9);
		expect(curvedSpan.length).toBeGreaterThan(CHORD);
	});

	it('measures Opening fit against sampled arc length, not the chord', () => {
		// 5.5 m + 1.0 m = 6.5 m: past the 6 m chord, inside the arc.
		const document = enclosureDocument(curvedChain(), 'forward', 5.5, 1.0);
		const span = wallFirstWallSpan(document, document.walls[0]!)!;
		expect(span.length).toBeGreaterThan(6.5);
		// The chord-length rule would have rejected this Opening.
		expect(Math.hypot(span.end[0] - span.start[0], span.end[1] - span.start[1])).toBeLessThan(6.5);
		expect(validateWallFirstOpeningSet(document)).toEqual([]);
	});

	it('still rejects an Opening that exceeds the sampled arc', () => {
		const document = enclosureDocument(curvedChain(), 'forward', 6.5, 1.0);
		const span = wallFirstWallSpan(document, document.walls[0]!)!;
		expect(span.length).toBeLessThan(7.5);
		const issues = validateWallFirstOpeningSet(document);
		expect(issues.map((issue) => issue.code)).toContain('opening_exceeds_wall');
	});

	it('places the compiled Opening center by arc distance along the curve', () => {
		const document = enclosureDocument(curvedChain(), 'forward', 4.0, 1.0);
		const { wall: compiled, issues } = compiledWall(document, 'wall-a');
		expect(blockingIssues(issues)).toEqual([]);
		const opening = compiled.openings.find((candidate) => candidate.openingId === 'opening-a')!;
		expect(opening.offset).toBeCloseTo(4.0, 9);
		expect(opening.center.distance).toBeCloseTo(4.5, 9);
		// The center is the curve kernel's distance lookup at 4.5 m along the
		// sampled arc — not a lerp toward the chord midpoint.
		const expected = pointAlongSamples(compiled.samples, 4.5);
		expect(opening.center.point[0]).toBeCloseTo(expected[0], 9);
		expect(opening.center.point[1]).toBeCloseTo(expected[1], 9);
		// A chord-placed center would sit at z = 0 for this bow.
		expect(opening.center.point[1]).toBeGreaterThan(1);
	});
});

// ---------------------------------------------------------------------------
// reverse traversal
// ---------------------------------------------------------------------------

describe('P23.11 slice 2 — reverse traversal mirrors by sampled arc length', () => {
	it('mirrors a curved-Wall Opening offset using the arc, not the chord', () => {
		const forward = enclosureDocument(curvedChain(), 'forward', 5.5, 1.0);
		const arc = wallFirstWallSpan(forward, forward.walls[0]!)!.length;
		expect(arc).toBeGreaterThan(6.5);
		// The arc is the only length that keeps the mirror in bounds.
		expect(arc - 6.5).toBeGreaterThan(0);
		// Chord mirroring would place this Opening at 6 − 6.5 = −0.5 m from the
		// reversed segment start: a negative offset the compiler must reject.
		const reversed = enclosureDocument(curvedChain(), 'reverse', 5.5, 1.0);
		expect(blockingIssues(compiledWall(reversed, 'wall-a').issues)).toEqual([]);
	});

	it('lands the mirrored offset on the same physical point as the forward traversal', () => {
		// The Room frame mirrors into the reversed segment; a mirrored offset
		// measured from the reversed samples must reach the same physical place
		// the forward offset reached from the forward samples. (Wall-first
		// Rooms deliberately compile with no opening records, so the identity is
		// asserted against the one adapter instead of a Room opening.)
		for (const [label, centerline] of [
			['single-knot', curvedChain()],
			['multi-knot', multiKnotChain()]
		] as const) {
			const document = singleWallDocument(centerline);
			const wall = document.walls[0]!;
			const { start, end } = endpointsOf(document, wall);
			const forward = sampleSegment(wallCenterlineSegment(wall, start, end, 'forward'));
			// Canonical endpoints + the traversal flag: the flag alone is the
			// direction authority.
			const reverse = sampleSegment(wallCenterlineSegment(wall, start, end, 'reverse'));
			const offset = 2.0;
			const width = 1.0;
			const forwardCenter = pointAlongSamples(forward.samples, offset + width / 2);
			// What the compiler's mirror branch computes: arc − (offset + width).
			const mirrored = reverse.length - (offset + width);
			const mirroredCenter = pointAlongSamples(reverse.samples, mirrored + width / 2);
			expect(mirroredCenter[0], label).toBeCloseTo(forwardCenter[0], 9);
			expect(mirroredCenter[1], label).toBeCloseTo(forwardCenter[1], 9);
			expect(forwardCenter[1], label).toBeGreaterThan(0.5);
			// Chord mirroring would measure from the 6 m chord: a different
			// physical Opening, which is the whole reason the mirror is arc-based.
			const chordMirrored = CHORD - (offset + width);
			const chordCenter = pointAlongSamples(reverse.samples, chordMirrored + width / 2);
			expect(Math.abs(chordCenter[0] - forwardCenter[0]), label).toBeGreaterThan(0.05);
		}
	});

	it('keeps the Room identity when the same boundary is traversed either way', () => {
		const forward = compileWallFirstLayoutGeometry(enclosureDocument(curvedChain(), 'forward', 2.0, 1.0));
		const reverse = compileWallFirstLayoutGeometry(enclosureDocument(curvedChain(), 'reverse', 2.0, 1.0));
		const forwardRoom = forward.geometry.rooms.find((room) => room.roomId === 'room-a');
		const reverseRoom = reverse.geometry.rooms.find((room) => room.roomId === 'room-a');
		expect(forwardRoom).toBeDefined();
		expect(reverseRoom).toBeDefined();
		expect(blockingIssues(forward.issues)).toEqual([]);
		expect(blockingIssues(reverse.issues)).toEqual([]);
		expect(reverseRoom!.floorPolygon).toHaveLength(forwardRoom!.floorPolygon.length);
	});

	it('mirrors the canonical Wall Opening once, from the Wall start', () => {
		// Physical Walls compile once from the document Wall, in canonical
		// traversal: room orientation never moves or re-mirrors them.
		const centerline = multiKnotChain();
		const forward = compiledWall(enclosureDocument(centerline, 'forward', 2.0, 1.0), 'wall-a');
		const reverse = compiledWall(enclosureDocument(centerline, 'reverse', 2.0, 1.0), 'wall-a');
		const forwardOpening = forward.wall.openings.find(
			(candidate) => candidate.openingId === 'opening-a'
		)!;
		const reverseOpening = reverse.wall.openings.find(
			(candidate) => candidate.openingId === 'opening-a'
		)!;
		expect(reverseOpening.offset).toBeCloseTo(2.0, 9);
		expect(reverseOpening.center.distance).toBeCloseTo(forwardOpening.center.distance, 9);
		expect(reverseOpening.center.point[0]).toBeCloseTo(forwardOpening.center.point[0], 9);
		expect(reverseOpening.center.point[1]).toBeCloseTo(forwardOpening.center.point[1], 9);
	});

	it('mirrors a multi-knot chain by reversing the chain, not the sample list', () => {
		const document = multiKnotChain() as Extract<LayoutWallCenterline, { kind: 'cubic-chain' }>;
		const wall: LayoutWall = { ...singleWallDocument({ kind: 'line' }).walls[0]!, centerline: document };
		const start: LayoutVec2 = [0, 0];
		const end: LayoutVec2 = [CHORD, 0];
		const forward = sampleSegment(wallCenterlineSegment(wall, start, end, 'forward'));
		const reverse = sampleSegment(wallCenterlineSegment(wall, start, end, 'reverse'));
		expect(reverse.length).toBeCloseTo(forward.length, 9);
		expect(reverse.samples).toHaveLength(forward.samples.length);
		// The reverse walk starts where the forward walk ended, and each
		// mirrored sample sits at the same distance back along the arc.
		expect(reverse.samples[0]!.point[0]).toBeCloseTo(forward.samples.at(-1)!.point[0], 9);
		expect(reverse.samples[0]!.point[1]).toBeCloseTo(forward.samples.at(-1)!.point[1], 9);
		for (let index = 1; index < reverse.samples.length; index += 1) {
			const mirrored = forward.samples[forward.samples.length - 1 - index]!;
			expect(reverse.samples[index]!.point[0]).toBeCloseTo(mirrored.point[0], 9);
			expect(reverse.samples[index]!.point[1]).toBeCloseTo(mirrored.point[1], 9);
		}
	});
});

// ---------------------------------------------------------------------------
// one seam
// ---------------------------------------------------------------------------

describe('P23.11 slice 2 — one sampler, one adapter seam', () => {
	it('samples a curve expressed as a legacy auto-bezier segment and as a chain identically', () => {
		const points: LayoutVec2[] = [
			[0, 0],
			[3, 2],
			[CHORD, 0]
		];
		const legacy: SampleableSegment = {
			id: 'wall-a',
			kind: 'auto-bezier',
			start: [0, 0],
			end: [CHORD, 0],
			interiorAnchors: [{ id: 'wall-a:anchor:1', point: [3, 2] }]
		};
		const wall: LayoutWall = { ...singleWallDocument({ kind: 'line' }).walls[0]!, centerline: chainFromPoints('wall-a', points) };
		const legacySampled = sampleSegment(legacy);
		const chainSampled = sampleSegment(wallCenterlineSegment(wall, [0, 0], [CHORD, 0], 'forward'));
		expect(chainSampled.length).toBeCloseTo(legacySampled.length, 12);
		expect(chainSampled.samples).toEqual(legacySampled.samples);
	});

	it('keeps a single flattening core and a single Wall centerline seam', () => {
		const coreSource = readFileSync(
			fileURLToPath(new URL('../../../../../packages/layout-core/src', import.meta.url) + '/layout-geometry-curve.ts'),
			'utf8'
		);
		const geometrySource = readFileSync(
			fileURLToPath(new URL('../../../../../packages/layout-core/src', import.meta.url) + '/layout-geometry.ts'),
			'utf8'
		);
		// Exactly one adaptive flattening core, in the curve kernel.
		const kernelDir = fileURLToPath(new URL('../../../../../packages/layout-core/src', import.meta.url));
		const definingFiles = readdirSync(kernelDir)
			.filter((entry) => entry.endsWith('.ts'))
			.filter((entry) =>
				readFileSync(path.join(kernelDir, entry), 'utf8').includes('function adaptiveParameters(')
			);
		expect(definingFiles).toEqual(['layout-geometry-curve.ts']);
		expect(coreSource.match(/export function sampleSegment\(/g) ?? []).toHaveLength(1);
		// The compiler reads Wall centerline geometry through the one adapter and
		// never compiles a curve itself.
		expect(geometrySource).toContain('wallCenterlineSegment(');
		expect(geometrySource).not.toContain('compileAutoBezierAnchors');
		expect(geometrySource).not.toContain('spansToCubics');
	});
});
