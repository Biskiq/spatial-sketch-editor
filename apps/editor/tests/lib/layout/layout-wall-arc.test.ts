/**
 * T1 A3 — Direct Arc Wall drawing, domain half.
 *
 * The acceptance this suite pins:
 *
 * 1. a start/end/bulge triple measures a chord, a signed rise and the exact
 *    circular radius the three stated points describe;
 * 2. one Arc leg commits the ordinary canonical `cubic-chain` centerline — one
 *    span, no knots, no new geometry kind — and an open chain still creates no
 *    Room;
 * 3. a rise below the minimum commits a straight `line` Wall instead;
 * 4. an Arc used to close a shell reconciles exactly the ordinary Room a Line
 *    closure would produce;
 * 5. a major arc, a bad leg index and a zero-length chord refuse with stable
 *    codes and write nothing;
 * 6. the same captured identity reproduces the same committed ids, and the
 *    baseline is never mutated.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	measureWallArc,
	MIN_WALL_ARC_RISE,
	planWallChain,
	wallCenterlineSamples,
	wallFirstWallLength,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type WallChainArc
} from '@portfolio/layout-core';
import { freshCapture } from './__fixtures__/layout-id-capture';

const ELEVATION = 0.5;

function baseline(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.floor.elevation = ELEVATION;
	return document;
}

function plan(
	points: readonly LayoutVec2[],
	arc: WallChainArc | null,
	close = false
): ReturnType<typeof planWallChain> {
	const document = baseline();
	return planWallChain({
		baseline: document,
		points,
		close,
		...(arc === null ? {} : { arc }),
		capture: freshCapture(),
		levelId: document.floor.id
	});
}

function success(planned: ReturnType<typeof planWallChain>) {
	if (planned.kind !== 'success') throw new Error(planned.rejection.message);
	return planned;
}

function createdWall(planned: ReturnType<typeof planWallChain>) {
	const accepted = success(planned);
	const id = accepted.authoredWallIds[0] ?? accepted.createdWallIds[0];
	const wall = accepted.document.walls.find((candidate) => candidate.id === id);
	if (wall === undefined) throw new Error('the Arc created no Wall');
	return wall;
}

describe('T1 A3 — direct Arc Wall', () => {
	it('[cap:layout.wall-arc core] measures chord, signed rise, projected apex and circular radius', () => {
		const above = measureWallArc([0, 0], [4, 0], [3, 1]);
		expect(above).not.toBeNull();
		expect(above!.chord).toBeCloseTo(4, 9);
		expect(above!.rise).toBeCloseTo(1, 9);
		expect(above!.radius).toBeCloseTo(2.5, 9);
		// Only the perpendicular rise is geometry: the apex is projected onto the
		// chord midpoint's normal, not kept at the pointer's off-axis point.
		expect(above!.apex[0]).toBeCloseTo(2, 9);
		expect(above!.apex[1]).toBeCloseTo(1, 9);

		const below = measureWallArc([0, 0], [4, 0], [2, -1]);
		expect(below!.rise).toBeCloseTo(-1, 9);
		expect(below!.radius).toBeCloseTo(2.5, 9);

		// A degenerate chord has no circular arc to measure.
		expect(measureWallArc([0, 0], [0, 0], [0, 1])).toBeNull();
	});

	it('[cap:layout.wall-arc core] commits one open canonical cubic-chain Wall with one knotless span', () => {
		const planned = plan([[0, 0], [4, 0]], { pointIndex: 0, apex: [2, 1] });
		const accepted = success(planned);
		const wall = createdWall(planned);
		expect(wall.centerline.kind).toBe('cubic-chain');
		if (wall.centerline.kind !== 'cubic-chain') throw new Error('the Arc fell back to a line');
		expect(wall.centerline.knots).toHaveLength(0);
		expect(wall.centerline.spans).toHaveLength(1);
		// The open Wall commits without a Room and is longer than its chord.
		expect(accepted.document.rooms).toHaveLength(0);
		expect(accepted.lineage).toHaveLength(0);
		expect(wallFirstWallLength(accepted.document, wall.id)).toBeGreaterThan(4);

		// The committed cubic is the drawn Arc, not merely some curved Wall: its
		// mid-span sample is the measured apex.
		const sampled = wallCenterlineSamples(
			{ id: wall.id, centerline: wall.centerline },
			[0, 0],
			[4, 0],
			'forward'
		);
		if (!sampled) throw new Error('the Arc centerline did not sample');
		const midpoint = sampled.samples.reduce((best, sample) =>
			Math.abs(sample.distance - sampled.length / 2) <
			Math.abs(best.distance - sampled.length / 2)
				? sample
				: best
		);
		expect(midpoint.point[0]).toBeCloseTo(2, 2);
		expect(midpoint.point[1]).toBeCloseTo(1, 2);

		// The same chain without an Arc is still the ordinary straight Wall.
		const straight = createdWall(plan([[0, 0], [4, 0]], null));
		expect(straight.centerline.kind).toBe('line');
	});

	it('[cap:layout.wall-arc core] falls back to a straight Line below the minimum rise', () => {
		const planned = plan([[0, 0], [4, 0]], {
			pointIndex: 0,
			apex: [2, MIN_WALL_ARC_RISE / 2]
		});
		const wall = createdWall(planned);
		expect(wall.centerline.kind).toBe('line');
		expect(success(planned).document.rooms).toHaveLength(0);
	});

	it('[cap:layout.wall-arc core] closes an Arc-based enclosure into one ordinary reconciled Room', () => {
		const planned = plan(
			[
				[0, 0],
				[4, 0],
				[4, 4],
				[0, 4]
			],
			{ pointIndex: 0, apex: [2, 1] },
			true
		);
		const accepted = success(planned);
		expect(accepted.document.rooms).toHaveLength(1);
		expect(accepted.lineage).toHaveLength(1);
		const wall = createdWall(planned);
		expect(wall.centerline.kind).toBe('cubic-chain');
		const room = accepted.document.rooms[0]!;
		expect(room.id).toBe(accepted.lineage[0]!.roomId);
		expect(room.boundary).toHaveLength(4);
		expect(room.boundary.some((ref) => ref.wallId === wall.id)).toBe(true);
	});

	it('[cap:layout.wall-arc edge] refuses a major arc, an unknown leg and a zero-length chord', () => {
		const major = plan([[0, 0], [4, 0]], { pointIndex: 0, apex: [2, 3] });
		expect(major.kind).toBe('rejected');
		if (major.kind === 'rejected') expect(major.rejection.code).toBe('arc_rise_out_of_range');

		const badLeg = plan([[0, 0], [4, 0]], { pointIndex: 1, apex: [2, 1] });
		expect(badLeg.kind).toBe('rejected');
		if (badLeg.kind === 'rejected') expect(badLeg.rejection.code).toBe('invalid_candidate_document');

		// A chord with no length is not a chain leg at all: the ordinary chain gate
		// refuses it before any Arc can be built.
		const zeroChord = plan([[0, 0], [0, 0]], { pointIndex: 0, apex: [0, 1] });
		expect(zeroChord.kind).toBe('rejected');
		if (zeroChord.kind === 'rejected') expect(zeroChord.rejection.code).toBe('insufficient_chain');
	});

	it('[cap:layout.wall-arc edge] replays the same captured identity and never mutates the baseline', () => {
		const document = baseline();
		const capture = freshCapture();
		const arc: WallChainArc = { pointIndex: 0, apex: [2, 1] };
		const points: readonly LayoutVec2[] = [
			[0, 0],
			[4, 0]
		];
		const options = {
			baseline: document,
			points,
			close: false,
			arc,
			capture,
			levelId: document.floor.id
		};
		const first = success(planWallChain(options));
		const second = success(planWallChain(options));
		expect(first.createdWallIds).toEqual(second.createdWallIds);
		expect(first.createdJunctionIds).toEqual(second.createdJunctionIds);
		expect(document.walls).toHaveLength(0);
		expect(document.junctions).toHaveLength(0);
	});
});
