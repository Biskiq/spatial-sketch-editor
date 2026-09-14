/**
 * P23.11 Slice 2 — canonical Wall-centerline adapter and compiler read path.
 *
 * The wall-first compiler, the Room-boundary adapter and `wallFirstWallSpan`
 * all read Wall centerline geometry through the ONE `layout-wall-centerline`
 * seam, so a curved Wall flows through the existing curve kernel unchanged
 * (no second sampling path). Straight Walls keep byte-identical compiled
 * output: a line's sampled arc length equals its chord exactly, so every
 * length/offset decision below is a strict generalization, not a rewrite.
 *
 * The read-path consequences pinned here:
 * - reverse-traversal Room references mirror Opening offsets by **sampled arc
 *   length**, never the Euclidean chord (chord mirroring on a bowed Wall can
 *   drive an offset negative or out of bounds);
 * - the canonical Opening set measures host fit against the sampled arc.
 */
import { describe, expect, it } from 'vitest';

import {
	pointAlongSamples,
	sampleSegment,
	wallCenterlineSegment,
	wallCenterlineSamples
} from '@portfolio/layout-core';
import {
	compileWallFirstLayoutGeometry,
	validateWallFirstOpeningSet,
	wallFirstWallSpan
} from '@portfolio/layout-core';
import {
	createEmptyWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutWall
} from '$lib/layout/layout-wall-first-codec';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-compat';

const CHORD = 6;

/** One 6 m Wall from `j-a` to `j-b`; `centerline` decides straight vs curved. */
function singleWallDocument(centerline: LayoutWall['centerline']): LayoutDocumentWallFirst {
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

/** The bowed Wall: endpoints 6 m apart on z = 0, centerline peaks at z = 2. */
function curvedWallDocument(): LayoutDocumentWallFirst {
	return singleWallDocument({
		kind: 'auto-bezier',
		interiorAnchors: [{ id: 'wall-a:anchor:1', point: [3, 2] }]
	});
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
	document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
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

/** Reference arc length straight from the one canonical adapter. */
function adapterLength(document: LayoutDocumentWallFirst, wall: LayoutWall): number {
	const start = document.junctions.find((junction) => junction.id === wall.startJunctionId)!.point;
	const end = document.junctions.find((junction) => junction.id === wall.endJunctionId)!.point;
	return sampleSegment(wallCenterlineSegment(wall, start, end)).length;
}

describe('P23.11 slice 2 — straight-Wall compilation is unchanged', () => {
	it('keeps chord length, densification and collinearity for a line Wall', () => {
		const document = straightWallDocument();
		const wall = document.walls[0]!;
		const { wall: compiled, issues } = compiledWall(document, 'wall-a');
		expect(issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
		// A line's sampled arc length equals its chord exactly, so every
		// pre-curve length decision keeps its old value.
		expect(compiled.length).toBeCloseTo(CHORD, 9);
		expect(adapterLength(document, wall)).toBeCloseTo(CHORD, 9);
		// 0.25 m max sample span densifies a 6 m line into 25 samples.
		expect(compiled.samples).toHaveLength(25);
		for (const sample of compiled.samples) {
			// Every sample lies on the chord's line (z = 0).
			expect(Math.abs(sample.point[1])).toBeLessThan(1e-9);
		}
	});

	it('compiles straight Walls through the canonical adapter output', () => {
		const document = straightWallDocument();
		const wall = document.walls[0]!;
		const { wall: compiled } = compiledWall(document, 'wall-a');
		const reference = wallCenterlineSamples(wall, [0, 0], [CHORD, 0])!;
		// One sampling path: the compiled samples ARE the adapter's samples.
		expect(compiled.samples).toEqual(reference.samples);
		expect(compiled.length).toBe(reference.length);
	});
});

describe('P23.11 slice 2 — curved Walls compile through the same kernel', () => {
	it('emits non-linear samples and reports sampled arc length over the chord', () => {
		const document = curvedWallDocument();
		const wall = document.walls[0]!;
		const { wall: compiled, issues } = compiledWall(document, 'wall-a');
		expect(issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
		// The bow pushes real arc length past the 6 m chord.
		expect(compiled.length).toBeGreaterThan(CHORD);
		expect(compiled.length).toBeCloseTo(adapterLength(document, wall), 9);
		// Samples leave the chord line: the curve reaches its z = 2 peak.
		const peak = Math.max(...compiled.samples.map((sample) => sample.point[1]));
		expect(peak).toBeGreaterThan(1.5);
		expect(compiled.samples).toEqual(wallCenterlineSamples(wall, [0, 0], [CHORD, 0])!.samples);
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
		const document = enclosureDocument(curvedWallDocument().walls[0]!.centerline, 'forward', 5.5, 1.0);
		const span = wallFirstWallSpan(document, document.walls[0]!)!;
		expect(span.length).toBeGreaterThan(6.5);
		// The chord-length rule would have rejected this Opening.
		expect(Math.hypot(span.end[0] - span.start[0], span.end[1] - span.start[1])).toBeLessThan(6.5);
		expect(validateWallFirstOpeningSet(document)).toEqual([]);
	});

	it('still rejects an Opening that exceeds the sampled arc', () => {
		const document = enclosureDocument(curvedWallDocument().walls[0]!.centerline, 'forward', 6.5, 1.0);
		const span = wallFirstWallSpan(document, document.walls[0]!)!;
		expect(span.length).toBeLessThan(7.5);
		const issues = validateWallFirstOpeningSet(document);
		expect(issues.map((issue) => issue.code)).toContain('opening_exceeds_wall');
	});

	it('places the compiled Opening center by arc distance along the curve', () => {
		const document = enclosureDocument(curvedWallDocument().walls[0]!.centerline, 'forward', 4.0, 1.0);
		const { wall: compiled, issues } = compiledWall(document, 'wall-a');
		expect(issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
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

describe('P23.11 slice 2 — reverse traversal mirrors by sampled arc length', () => {
	it('mirrors a curved-Wall Opening offset using the arc, not the chord', () => {
		const centerline = curvedWallDocument().walls[0]!.centerline;
		const arc = wallFirstWallSpan(
			enclosureDocument(centerline, 'forward', 5.5, 1.0),
			enclosureDocument(centerline, 'forward', 5.5, 1.0).walls[0]!
		)!.length;
		expect(arc).toBeGreaterThan(6.5);
		// Chord mirroring would place this Opening at 6 − 6.5 = −0.5 m from the
		// reversed segment start: a negative offset the compiler must reject.
		const reversed = enclosureDocument(centerline, 'reverse', 5.5, 1.0);
		const { issues } = compiledWall(reversed, 'wall-a');
		expect(issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
	});

	it('produces the same physical Opening position from either traversal', () => {
		const centerline = curvedWallDocument().walls[0]!.centerline;
		const forward = compiledWall(
			enclosureDocument(centerline, 'forward', 2.0, 1.0),
			'wall-a'
		);
		const reverse = compiledWall(
			enclosureDocument(centerline, 'reverse', 2.0, 1.0),
			'wall-a'
		);
		const forwardOpening = forward.wall.openings.find(
			(candidate) => candidate.openingId === 'opening-a'
		)!;
		const reverseOpening = reverse.wall.openings.find(
			(candidate) => candidate.openingId === 'opening-a'
		)!;
		// Canonical physical Walls are compiled once from the document Wall, so
		// traversal orientation never moves the physical opening.
		expect(reverseOpening.offset).toBeCloseTo(2.0, 9);
		expect(reverseOpening.center.point[0]).toBeCloseTo(forwardOpening.center.point[0], 9);
		expect(reverseOpening.center.point[1]).toBeCloseTo(forwardOpening.center.point[1], 9);
	});
});

describe('P23.11 slice 2 — the adapter is the only Wall curve seam', () => {
	it('keeps a curved Wall’s compiled samples identical to the adapter output', () => {
		const straight = straightWallDocument();
		const curved = curvedWallDocument();
		for (const document of [straight, curved]) {
			const wall = document.walls[0]!;
			const start = document.junctions.find((j) => j.id === wall.startJunctionId)!.point;
			const end = document.junctions.find((j) => j.id === wall.endJunctionId)!.point;
			const { wall: compiled } = compiledWall(document, 'wall-a');
			const sampled = sampleSegment(wallCenterlineSegment(wall, start, end));
			expect(compiled.length).toBe(sampled.length);
			expect(compiled.samples).toEqual(sampled.samples);
		}
	});
});
