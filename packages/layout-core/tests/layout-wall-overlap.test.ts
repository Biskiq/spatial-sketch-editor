/**
 * T1 A5 — the derived independent-Wall overlap query.
 *
 * This is the data behind the **overlaps, not joined** cue. It is display state
 * only: it reports positive-length collinear stretches between Walls of
 * different connected components, excludes same-component pairs (their overlap
 * already refuses in the canonical topology gate), and never touches the
 * document.
 */
import { describe, expect, it } from 'vitest';

import { independentWallOverlaps, LAYOUT_WALL_FIRST_FORMAT_VERSION, type LayoutDocumentWallFirst, type LayoutWall, type LayoutWallOverlapObservation } from '@portfolio/layout-core/wall';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';

function documentWith(
	junctions: Record<string, LayoutVec2>,
	walls: LayoutWall[]
): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: Object.entries(junctions).map(([id, point]) => ({ id, point })),
		walls,
		rooms: [],
		openings: [],
		objects: [],
		regions: []
	};
}

function wall(id: string, startJunctionId: string, endJunctionId: string): LayoutWall {
	return {
		id,
		startJunctionId,
		endJunctionId,
		thickness: 0.2,
		height: 3,
		top: { kind: 'level' },
		centerline: { kind: 'line' }
	};
}

/** A diagonal row of detached 4×4 squares: X overlaps neighbours, Z never does. */
function detachedSquareRow(components: number): LayoutDocumentWallFirst {
	const junctions: Record<string, LayoutVec2> = {};
	const walls: LayoutWall[] = [];
	for (let index = 0; index < components; index += 1) {
		const x = index * 5;
		const z = index * 10;
		const corners = [0, 1, 2, 3].map((corner) => `s${index}-${corner}`);
		junctions[corners[0]!] = [x, z];
		junctions[corners[1]!] = [x + 6, z];
		junctions[corners[2]!] = [x + 6, z + 4];
		junctions[corners[3]!] = [x, z + 4];
		walls.push(
			wall(`s${index}-top`, corners[0]!, corners[1]!),
			wall(`s${index}-right`, corners[1]!, corners[2]!),
			wall(`s${index}-bottom`, corners[2]!, corners[3]!),
			wall(`s${index}-left`, corners[3]!, corners[0]!)
		);
	}
	return documentWith(junctions, walls);
}

/** Two 4×4 squares side by side, joining only at coordinate `(4, 0)`/`(4, 4)`. */
function abuttingSquares(shift: LayoutVec2 = [0, 0]): LayoutDocumentWallFirst {
	const x = (value: number) => value + shift[0];
	const z = (value: number) => value + shift[1];
	return documentWith(
		{
			'a-0': [0, 0],
			'a-1': [4, 0],
			'a-2': [4, 4],
			'a-3': [0, 4],
			'b-0': [x(4), z(0)],
			'b-1': [x(8), z(0)],
			'b-2': [x(8), z(4)],
			'b-3': [x(4), z(4)]
		},
		[
			wall('a-top', 'a-0', 'a-1'),
			wall('a-right', 'a-1', 'a-2'),
			wall('a-bottom', 'a-2', 'a-3'),
			wall('a-left', 'a-3', 'a-0'),
			wall('b-top', 'b-0', 'b-1'),
			wall('b-right', 'b-1', 'b-2'),
			wall('b-bottom', 'b-2', 'b-3'),
			// Deliberately anti-parallel to `a-right`: the shared line is the
			// same either way round.
			wall('b-left', 'b-3', 'b-0')
		]
	);
}

describe('T1 A5 — independent Wall overlap (derived cue)', () => {
	it('reports one positive-length stretch between two coincident Walls of different components', () => {
		let observed: LayoutWallOverlapObservation | undefined;
		const overlaps = independentWallOverlaps(abuttingSquares(), (observation) => {
			observed = observation;
		});
		// Three Walls on each side of the shared boundary meet in X; only the
		// coincident a-right/b-left pair survives the Z and centerline tests.
		expect(observed).toEqual({ wallCount: 8, candidatePairs: 9 });
		expect(overlaps).toHaveLength(1);
		expect(overlaps[0]).toMatchObject({
			firstWallId: 'a-right',
			secondWallId: 'b-left',
			labelAt: [4, 2]
		});
		expect(overlaps[0]!.length).toBeCloseTo(4, 9);
		expect(overlaps[0]!.stretches).toHaveLength(1);
		expect(overlaps[0]!.stretches[0]).toEqual([
			[4, 0],
			[4, 4]
		]);
	});

	it('does not report a same-component pair, even when the two Walls coincide', () => {
		const doubled = documentWith({ 'j-0': [0, 0], 'j-1': [4, 0] }, [
			wall('w-1', 'j-0', 'j-1'),
			wall('w-2', 'j-0', 'j-1')
		]);
		expect(independentWallOverlaps(doubled)).toEqual([]);
	});

	it('does not report touching-only, crossing, near-parallel or disjoint Walls', () => {
		// A 1 cm normal offset is outside the display tolerance.
		expect(independentWallOverlaps(abuttingSquares([0.01, 0]))).toEqual([]);
		// The same fixture crossed at perpendicular Walls has no shared stretch.
		const crossing = documentWith({ 'j-0': [2, 0], 'j-1': [2, 4], 'j-2': [0, 2], 'j-3': [4, 2] }, [
			wall('horizontal', 'j-2', 'j-3'),
			wall('vertical', 'j-0', 'j-1')
		]);
		expect(independentWallOverlaps(crossing)).toEqual([]);
		// Moving one square clear removes the shared line entirely.
		const detached = abuttingSquares();
		const shifted: LayoutDocumentWallFirst = {
			...detached,
			junctions: detached.junctions.map((junction) =>
				junction.id.startsWith('b-')
					? { ...junction, point: [junction.point[0] + 1, junction.point[1]] as LayoutVec2 }
					: junction
			)
		};
		expect(independentWallOverlaps(shifted)).toEqual([]);
	});

	it('samples a collinear cubic span and reports it against a straight Wall', () => {
		const base = abuttingSquares();
		const curved: LayoutDocumentWallFirst = {
			...base,
			walls: base.walls.map((candidate) =>
				candidate.id === 'b-left'
					? {
							...candidate,
							centerline: {
								kind: 'cubic-chain',
								knots: [{ id: 'b-left:knot:1', point: [4, 2] as LayoutVec2 }],
								spans: [
									{
										handleOut: [4, 3.3333333333333335] as LayoutVec2,
										handleIn: [4, 2.6666666666666665] as LayoutVec2
									},
									{
										handleOut: [4, 1.3333333333333333] as LayoutVec2,
										handleIn: [4, 0.6666666666666666] as LayoutVec2
									}
								]
							}
						}
					: candidate
			)
		};
		const overlaps = independentWallOverlaps(curved);
		expect(overlaps).toHaveLength(1);
		expect(overlaps[0]!.firstWallId).toBe('a-right');
		expect(overlaps[0]!.secondWallId).toBe('b-left');
		expect(overlaps[0]!.length).toBeCloseTo(4, 6);
	});

	it('is deterministic and never mutates the document', () => {
		const document = abuttingSquares();
		const before = JSON.stringify(document);
		const first = independentWallOverlaps(document);
		const second = independentWallOverlaps(document);
		expect(second).toEqual(first);
		expect(JSON.stringify(document)).toBe(before);
	});

	it('keeps broad-phase candidates linear at M and L rather than scanning every pair', () => {
		const observations: LayoutWallOverlapObservation[] = [];
		for (const components of [100, 400]) {
			const overlaps = independentWallOverlaps(detachedSquareRow(components), (observation) => {
				observations.push(observation);
			});
			expect(overlaps).toEqual([]);
		}
		expect(observations).toHaveLength(2);
		const medium = observations[0]!;
		const large = observations[1]!;
		expect(medium.wallCount).toBe(100 * 4);
		expect(large.wallCount).toBe(400 * 4);
		// Each square's X interval meets only its immediate neighbour, and its Z
		// extents are disjoint, so the detailed pass rejects every admitted pair.
		// A full cross-component scan would admit ~8N² pairs; the sweep admits
		// ~9N. This is a deterministic structural bound, not a timing gate.
		expect(medium.candidatePairs).toBeLessThanOrEqual(100 * 20);
		expect(large.candidatePairs).toBeLessThanOrEqual(400 * 20);
		expect(large.candidatePairs).toBeLessThanOrEqual(medium.candidatePairs * 5);
	});
});
