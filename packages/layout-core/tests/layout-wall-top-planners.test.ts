/**
 * T1 V2b — the Wall-top planner contract.
 *
 * Every row of `v-plan-verticality.md` §6.3 has its core case here: the one
 * normalising writer, the rigid height shift, exact split arithmetic, exact
 * join/dissolve arithmetic, apex stations that stay in metres under a length
 * edit and refuse an outside apex whole, duplication and Room move copying the
 * top, bend/straighten keeping it, Round radius scaling the apex with the
 * circumference, Split and Join keeping every Room's ceiling, and one station
 * rule plus a whole refusal for near-degenerate fragments.
 *
 * T-P2 is the split/join round trip: geometric equivalence within a stated
 * tolerance, canonical and deterministic bytes, and authored values kept
 * wherever re-basing does not round. Exact historical bytes are Undo's job.
 * T-P6 is the apex boundary and the closed Wall's level-only rule. T-P3–T-P5 stay in their V2a suites
 * (`junction-matrix`, `wall-mesh-solid-matrix`, `layout-wall-top`,
 * `wall-unfold-top`), which this change must keep green.
 */
import { describe, expect, it } from 'vitest';

import { compileWallFirstLayoutGeometry, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import {
	createClosedWallCircleDocument,
	createEmptyWallFirstLayoutDocument,
	planConvertWallToCurve,
	planConvertWallToLine,
	planDissolveJunction,
	planExactJunctionMove,
	planExactWallHeight,
	planExactWallLength,
	planSetWallTop,
	planWallChain,
	planWallCrossing,
	planWallSubdivision,
	planWallSplit,
	planWallSplitAtPoint,
	reverseWallTop,
	roomCeilingHeight,
	serializeWallFirstLayoutDocument,
	sliceWallTop,
	validateWallFirstLayoutDocument,
	wallFirstWallLength,
	wallTopAt,
	wallTopRiseAt,
	WALL_HEIGHT_EPSILON,
	WALL_TOP_STATION_EPSILON,
	type LayoutDocumentWallFirst,
	type LayoutWall,
	type LayoutWallTop,
	type NodingIdAllocator
} from '@portfolio/layout-core/wall';
import { planDuplicateIsolatedRoom } from '@portfolio/layout-core/plan';
import { planWallFirstRoomMove } from '@portfolio/layout-core/room';
import { freshCapture } from './__fixtures__/layout-id-capture';

const LEVEL: LayoutWallTop = { kind: 'level' };
const GABLE: LayoutWallTop = { kind: 'gable', startRise: 0, endRise: 1, apexRise: 4, apexOffset: 4 };

const allocator: NodingIdAllocator = {
	nextWallId: (_document, seed) => `${seed}-frag`,
	nextJunctionId: (_document, seed) => `${seed}-j`
};

function wall(id: string, start: string, end: string, overrides: Partial<LayoutWall> = {}): LayoutWall {
	return {
		id,
		startJunctionId: start,
		endJunctionId: end,
		thickness: 0.2,
		height: 3,
		top: LEVEL,
		centerline: { kind: 'line' },
		...overrides
	};
}

function documentOf(
	points: Record<string, LayoutVec2>,
	walls: readonly LayoutWall[],
	rooms: LayoutDocumentWallFirst['rooms'] = []
): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	for (const [id, point] of Object.entries(points)) document.junctions.push({ id, point });
	document.walls.push(...walls);
	document.rooms.push(...rooms);
	return document;
}

function enclosedRoom(document: LayoutDocumentWallFirst, wallIds: readonly string[]): LayoutDocumentWallFirst {
	document.rooms.push({
		id: 'room',
		name: 'Room',
		boundary: wallIds.map((wallId) => ({ wallId, direction: 'forward' as const })),
		virtualEdges: [],
		overhead: 'closed'
	});
	return document;
}

function rectangleRoom(top: LayoutWallTop): LayoutDocumentWallFirst {
	return enclosedRoom(
		documentOf({ a: [0, 0], b: [10, 0], c: [10, 6], d: [0, 6] }, [
			wall('w1', 'a', 'b', { top }),
			wall('w2', 'b', 'c'),
			wall('w3', 'c', 'd'),
			wall('w4', 'd', 'a')
		]),
		['w1', 'w2', 'w3', 'w4']
	);
}

function wallById(document: LayoutDocumentWallFirst, wallId: string): LayoutWall {
	const found = document.walls.find((candidate) => candidate.id === wallId);
	if (!found) throw new Error(`missing wall '${wallId}'`);
	return found;
}

function unchanged(document: LayoutDocumentWallFirst, run: () => unknown): void {
	const before = JSON.stringify(document);
	run();
	expect(JSON.stringify(document)).toBe(before);
}

describe('§6.3 · planSetWallTop normalises to P1', () => {
	it('moves the lowest stated rise into height and keeps the shape', () => {
		const document = documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b')]);
		const slope = planSetWallTop(document, 'w1', { kind: 'slope', startRise: 1, endRise: 3 });
		expect(slope.kind).toBe('success');
		if (slope.kind !== 'success') return;
		const sloped = wallById(slope.document, 'w1');
		expect(sloped.height).toBe(4);
		expect(sloped.top).toEqual({ kind: 'slope', startRise: 0, endRise: 2 });

		const gable = planSetWallTop(slope.document, 'w1', {
			kind: 'gable',
			startRise: 2,
			endRise: 1,
			apexRise: 5,
			apexOffset: 4
		});
		expect(gable.kind).toBe('success');
		if (gable.kind !== 'success') return;
		const gabled = wallById(gable.document, 'w1');
		expect(gabled.height).toBe(5);
		expect(gabled.top).toEqual({
			kind: 'gable',
			startRise: 1,
			endRise: 0,
			apexRise: 4,
			apexOffset: 4
		});
	});

	it('flattens to level at the current eave and reports a no-op', () => {
		const document = documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b', { top: GABLE })]);
		const level = planSetWallTop(document, 'w1', LEVEL);
		expect(level.kind).toBe('success');
		if (level.kind !== 'success') return;
		expect(wallById(level.document, 'w1')).toMatchObject({ height: 3, top: { kind: 'level' } });
		expect(planSetWallTop(level.document, 'w1', LEVEL)).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'no_op' }
		});
	});

	it('refuses a negative or non-finite rise without touching the document', () => {
		const document = documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b')]);
		unchanged(document, () => {
			expect(planSetWallTop(document, 'w1', { kind: 'slope', startRise: -1, endRise: 2 })).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'wall_top_rise_invalid' }
			});
		});
	});

	it('refuses P3 values and an apex outside the derived length, naming the Wall', () => {
		const values = planSetWallTop(
			documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b')]),
			'w1',
			{ kind: 'gable', startRise: 0, endRise: 2, apexRise: 2, apexOffset: 4 }
		);
		expect(values).toMatchObject({ kind: 'rejected', rejection: { code: 'wall_top_apex_invalid' } });

		const document = documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b')]);
		unchanged(document, () => {
			const outside = planSetWallTop(document, 'w1', {
				kind: 'gable',
				startRise: 0,
				endRise: 0,
				apexRise: 2,
				apexOffset: 12
			});
			expect(outside).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'wall_top_apex_outside', targetIds: ['w1'] }
			});
		});
	});

	it('refuses a non-level top on a closed Wall (P5)', () => {
		const closed = createClosedWallCircleDocument({
			center: [0, 0],
			rim: [0, 5],
			junctionId: 'seam',
			wallId: 'circle',
			thickness: 0.2,
			height: 3
		});
		expect(closed.kind).toBe('success');
		if (closed.kind !== 'success') return;
		const plan = planSetWallTop(closed.document, 'circle', { kind: 'slope', startRise: 0, endRise: 1 });
		expect(plan).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'closed_wall_level_only', targetIds: ['circle'] }
		});
	});

	it('refuses a peak outside the 1,000 m envelope (P6)', () => {
		const document = documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b', { height: 999 })]);
		const plan = planSetWallTop(document, 'w1', { kind: 'slope', startRise: 0, endRise: 2 });
		expect(plan).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'dimension_out_of_range', targetIds: ['w1'] }
		});
	});

	it('refuses a top that leaves a hosted Opening above it, naming the Opening (P7)', () => {
		const base = documentOf({ a: [0, 0], b: [10, 0] }, [
			wall('w1', 'a', 'b', { top: { kind: 'slope', startRise: 0, endRise: 2 } })
		]);
		base.openings.push({
			id: 'window',
			wallId: 'w1',
			kind: 'window',
			offset: 8,
			width: 1,
			height: 0.5,
			sillHeight: 3,
			profile: 'rectangular'
		});
		// Rising toward the Opening: its head at 3.5 m fits under 4.6 m.
		expect(compileWallFirstLayoutGeometry(base).issues).toEqual([]);
		unchanged(base, () => {
			const plan = planSetWallTop(base, 'w1', { kind: 'slope', startRise: 2, endRise: 0 });
			expect(plan.kind).toBe('rejected');
			if (plan.kind !== 'rejected') return;
			expect(plan.rejection.code).toBe('wall_top_below_opening');
			expect(plan.rejection.targetIds).toContain('window');
			expect(plan.rejection.message).toContain("Opening 'window'");
		});
	});

	it('applies a requested eave and keeps every other breakpoint', () => {
		const document = documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b', { top: GABLE })]);
		const before = wallById(document, 'w1');
		if (before.top.kind !== 'gable') throw new Error('the fixture is not a gable');
		// The eave drops to 0.25 m while the end (4 m) and apex (7 m) stay put.
		const plan = planSetWallTop(
			document,
			'w1',
			{
				kind: 'gable',
				startRise: 0,
				endRise: before.height - 0.25 + before.top.endRise,
				apexRise: before.height - 0.25 + before.top.apexRise,
				apexOffset: before.top.apexOffset
			},
			0.25
		);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const after = wallById(plan.document, 'w1');
		expect(after.height).toBeCloseTo(0.25, 12);
		expect(after.top).toEqual({
			kind: 'gable',
			startRise: 0,
			endRise: 3.75,
			apexRise: 6.75,
			apexOffset: 4
		});
	});

	it('refuses a requested eave that leaves a hosted Opening above it, naming the Opening', () => {
		const base = documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b', { top: GABLE })]);
		base.openings.push({
			id: 'window',
			wallId: 'w1',
			kind: 'window',
			offset: 0.1,
			width: 0.8,
			height: 0.8,
			sillHeight: 1,
			profile: 'rectangular'
		});
		// The gable at 3 m clears the window; lowering the start eave cuts it.
		expect(compileWallFirstLayoutGeometry(base).issues).toEqual([]);
		unchanged(base, () => {
			const plan = planSetWallTop(
				base,
				'w1',
				{
					kind: 'gable',
					startRise: 0,
					endRise: 3.75,
					apexRise: 6.75,
					apexOffset: 4
				},
				0.25
			);
			expect(plan.kind).toBe('rejected');
			if (plan.kind !== 'rejected') return;
			expect(plan.rejection.code).toBe('wall_top_below_opening');
			expect(plan.rejection.targetIds).toContain('window');
			expect(plan.rejection.message).toContain("Opening 'window'");
		});
	});
});

describe('§6.3 · planExactWallHeight shifts the whole top rigidly', () => {
	it('keeps the shape, apex station and rises while moving every point up', () => {
		const document = documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b', { top: GABLE })]);
		const plan = planExactWallHeight(document, 'w1', 4.5);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const raised = wallById(plan.document, 'w1');
		expect(raised.height).toBe(4.5);
		expect(raised.top).toEqual(GABLE);
		for (const station of [0, 4, 10]) {
			expect(wallTopAt(raised, station, 10)).toBeCloseTo(wallTopAt(document.walls[0]!, station, 10) + 1.5, 12);
		}
	});
});

describe('§6.3 · split is exact at the cut (T-P2)', () => {
	it('splits a gable off its apex into one gable and one slope', () => {
		const document = documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b', { top: GABLE })]);
		const plan = planWallSplit(document, 'w1', 7, allocator);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const [first, second] = plan.document.walls as [LayoutWall, LayoutWall];
		expect(first.height).toBe(3);
		expect(first.top).toEqual({ kind: 'gable', startRise: 0, endRise: 2.5, apexRise: 4, apexOffset: 4 });
		expect(second.height).toBe(4);
		expect(second.top).toEqual({ kind: 'slope', startRise: 1.5, endRise: 0 });
		// Both fragment ends are exactly the source top at the cut.
		expect(wallTopAt(first, 7, 7)).toBe(wallTopAt(document.walls[0]!, 7, 10));
		expect(wallTopAt(second, 0, 3)).toBe(wallTopAt(document.walls[0]!, 7, 10));
	});

	it('splits a gable at its apex into two slopes', () => {
		const document = documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b', { top: GABLE })]);
		const plan = planWallSplit(document, 'w1', 4, allocator);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const [first, second] = plan.document.walls as [LayoutWall, LayoutWall];
		expect(first.top.kind).toBe('slope');
		expect(second.top.kind).toBe('slope');
		expect(wallTopAt(first, 4, 4)).toBe(7);
		expect(wallTopAt(second, 0, 6)).toBe(7);
		expect(wallTopAt(second, 6, 6)).toBe(4);
	});

	it('keeps the authored values byte-exact when no re-basing rounds (T-P2)', () => {
		// Every value here is exact in binary, so each re-basing subtraction is
		// exact and the rejoined Wall is the source Wall. Decimal values are held
		// to geometric equivalence instead (the T-P2 block below).
		for (const cut of [7, 4, 1.5]) {
			const document = documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b', { top: GABLE })]);
			const plan = planWallSplit(document, 'w1', cut, allocator);
			expect(plan.kind, `cut ${cut}`).toBe('success');
			if (plan.kind !== 'success') continue;
			const joined = planDissolveJunction(plan.document, plan.junctionId, freshCapture(), document.floor.id);
			expect(joined.kind, `cut ${cut}`).toBe('success');
			if (joined.kind !== 'success') continue;
			expect(joined.document.walls[0], `cut ${cut}`).toEqual(document.walls[0]);
			expect(serializeWallFirstLayoutDocument(joined.document)).toBe(
				serializeWallFirstLayoutDocument(document)
			);
		}
	});

	it('slices a curved Wall by canonical station, not by chord', () => {
		const document = documentOf({ a: [0, 0], b: [10, 0] }, [
			wall('w1', 'a', 'b', {
				top: { kind: 'slope', startRise: 0, endRise: 2 },
				centerline: {
					kind: 'cubic-chain',
					knots: [{ id: 'k1', point: [5, 3] }],
					spans: [
						{ handleOut: [2, 0], handleIn: [3, 3] },
						{ handleOut: [7, 3], handleIn: [8, 0] }
					]
				}
			})
		]);
		const length = wallFirstWallLength(document, 'w1')!;
		expect(length).toBeGreaterThan(10);
		const plan = planWallSplit(document, 'w1', length / 2, allocator);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const [first, second] = plan.document.walls as [LayoutWall, LayoutWall];
		const firstLength = wallFirstWallLength(plan.document, first.id)!;
		const secondLength = wallFirstWallLength(plan.document, second.id)!;
		expect(firstLength + secondLength).toBeCloseTo(length, 9);
		expect(wallTopAt(first, firstLength, firstLength)).toBe(
			wallTopAt(document.walls[0]!, firstLength, length)
		);
		expect(wallTopAt(second, 0, secondLength)).toBe(
			wallTopAt(document.walls[0]!, firstLength, length)
		);
		// The slice itself is the same arithmetic the split used.
		expect(sliceWallTop(document.walls[0]!, 0, firstLength, length).height).toBe(first.height);
	});

	it('crosses two profiled Walls exactly as the single split does', () => {
		// A crossing is two splits against one shared Junction, so the apex
		// arithmetic must not be a second implementation.
		const document = documentOf({ a: [0, 0], b: [10, 0], c: [5, -5], d: [5, 5] }, [
			wall('w1', 'a', 'b', { top: GABLE }),
			wall('w2', 'c', 'd')
		]);
		const plan = planWallCrossing(document, ['w1', 'w2'], [5, 0], allocator);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		// The crossing splits w1 first (stable Wall-ID order), so its two
		// fragments are w1 itself and the first created fragment.
		const fragments = plan.document.walls.filter(
			(candidate) => candidate.id === 'w1' || candidate.id === plan.createdWallIds[0]
		);
		expect(fragments).toHaveLength(2);
		for (const fragment of fragments) {
			const length = wallFirstWallLength(plan.document, fragment.id)!;
			const atJoint =
				fragment.startJunctionId === plan.junctionId
					? wallTopAt(fragment, 0, length)
					: wallTopAt(fragment, length, length);
			expect(atJoint).toBe(wallTopAt(document.walls[0]!, 5, 10));
		}
	});
});

describe('§6.3 · join and dissolve merge tops exactly', () => {
	it('joins two continuous slopes into one slope', () => {
		const document = documentOf({ a: [0, 0], b: [5, 0], c: [10, 0] }, [
			wall('w1', 'a', 'b', { top: { kind: 'slope', startRise: 0, endRise: 1 } }),
			wall('w2', 'b', 'c', { top: { kind: 'slope', startRise: 1, endRise: 2 } })
		]);
		// w2 starts at 4 m: continuity needs its start top to equal w1's end top.
		document.walls[1] = { ...document.walls[1]!, height: 4, top: { kind: 'slope', startRise: 0, endRise: 1 } };
		const plan = planDissolveJunction(document, 'b', freshCapture(), document.floor.id);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.walls[0]).toMatchObject({
			height: 3,
			top: { kind: 'slope', startRise: 0, endRise: 2 }
		});
	});

	it('refuses a valley, a kink that is not the peak, and two gables', () => {
		const dissolve = (first: LayoutWallTop, second: LayoutWallTop, secondHeight: number) => {
			const document = documentOf({ a: [0, 0], b: [5, 0], c: [10, 0] }, [
				wall('w1', 'a', 'b', { top: first }),
				wall('w2', 'b', 'c', { top: second, height: secondHeight })
			]);
			return planDissolveJunction(document, 'b', freshCapture(), document.floor.id);
		};

		// Down then up: the joint is a valley, which has no level/slope/gable encoding.
		const valley = dissolve({ kind: 'slope', startRise: 2, endRise: 0 }, { kind: 'slope', startRise: 0, endRise: 2 }, 3);
		expect(valley).toMatchObject({ kind: 'rejected', rejection: { code: 'wall_top_not_joinable' } });

		// Up then up, at different gradients: a kink below the far end is not the peak.
		const kink = dissolve({ kind: 'slope', startRise: 0, endRise: 2 }, { kind: 'slope', startRise: 0, endRise: 1 }, 5);
		expect(kink).toMatchObject({ kind: 'rejected', rejection: { code: 'wall_top_not_joinable' } });

		// Two peaks cannot become one gable.
		const twoPeaks = dissolve(
			{ kind: 'gable', startRise: 0, endRise: 1, apexRise: 2, apexOffset: 2 },
			{ kind: 'gable', startRise: 0, endRise: 1, apexRise: 2, apexOffset: 2 },
			4
		);
		expect(twoPeaks).toMatchObject({ kind: 'rejected', rejection: { code: 'wall_top_not_joinable' } });
	});

	it('refuses a slope joined to a level Wall at a kink that is not the peak', () => {
		// The joint is continuous at 4 m, but the level side neither continues the
		// slope nor rises above it: start 3 → joint 4 → end 4 has no encoding.
		const document = documentOf({ a: [0, 0], b: [5, 0], c: [10, 0] }, [
			wall('w1', 'a', 'b', { top: { kind: 'slope', startRise: 0, endRise: 1 } }),
			wall('w2', 'b', 'c', { height: 4 })
		]);
		const plan = planDissolveJunction(document, 'b', freshCapture(), document.floor.id);
		expect(plan).toMatchObject({ kind: 'rejected', rejection: { code: 'wall_top_not_joinable' } });
	});
});

describe('§6.3 · length and Junction edits keep apexOffset in metres (T-P6)', () => {
	it('keeps the apex station when a Wall gets longer', () => {
		const document = documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b', { top: GABLE })]);
		const plan = planExactWallLength(document, 'w1', 12);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(wallById(plan.document, 'w1').top).toEqual(GABLE);
	});

	it('refuses a Junction move that puts the apex outside the Wall, whole', () => {
		const document = documentOf({ a: [0, 0], b: [10, 0] }, [
			wall('w1', 'a', 'b', { top: { kind: 'gable', startRise: 0, endRise: 0, apexRise: 2, apexOffset: 8 } })
		]);
		unchanged(document, () => {
			const plan = planExactJunctionMove(document, 'b', [6, 0]);
			expect(plan).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'wall_top_apex_outside', targetIds: ['w1'] }
			});
		});
	});

	it('refuses a length edit that puts the apex outside the Wall, whole', () => {
		const document = documentOf({ a: [0, 0], b: [10, 0] }, [
			wall('w1', 'a', 'b', { top: { kind: 'gable', startRise: 0, endRise: 0, apexRise: 2, apexOffset: 8 } })
		]);
		unchanged(document, () => {
			const plan = planExactWallLength(document, 'w1', 6);
			expect(plan).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'wall_top_apex_outside', targetIds: ['w1'] }
			});
		});
	});
});

describe('§6.3 · duplicate, Room move, bend and straighten keep the top', () => {
	it('copies the top unchanged through an isolated Room duplicate', () => {
		const document = rectangleRoom(GABLE);
		const plan = planDuplicateIsolatedRoom(
			document,
			{ roomId: 'room', delta: [10, 0] },
			freshCapture(),
			document.floor.id
		);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const copies = plan.document.walls.filter((candidate) => candidate.id !== 'w1' && candidate.top.kind === 'gable');
		expect(copies).toHaveLength(1);
		expect(copies[0]!.top).toEqual(GABLE);
		expect(copies[0]!.height).toBe(3);
	});

	it('keeps the top through a rigid Room move', () => {
		const document = rectangleRoom(GABLE);
		const plan = planWallFirstRoomMove(document, 'room', [0, 10]);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(wallById(plan.document, 'w1').top).toEqual(GABLE);
	});

	it('keeps the top through bend and straighten, P4 reading it on the new centerline', () => {
		const document = documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b', { top: GABLE })]);
		const curved = planConvertWallToCurve(document, 'w1');
		expect(curved.kind).toBe('success');
		if (curved.kind !== 'success') return;
		expect(wallById(curved.document, 'w1').top).toEqual(GABLE);
		const straight = planConvertWallToLine(curved.document, 'w1');
		expect(straight.kind).toBe('success');
		if (straight.kind !== 'success') return;
		expect(wallById(straight.document, 'w1').top).toEqual(GABLE);
	});
});

const CURVED_CENTERLINE: LayoutWall['centerline'] = {
	kind: 'cubic-chain',
	knots: [{ id: 'k1', point: [5, 3] }],
	spans: [
		{ handleOut: [2, 0], handleIn: [3, 3] },
		{ handleOut: [7, 3], handleIn: [8, 0] }
	]
};

describe('§3.3 · exact breakpoints and decimal apex cuts', () => {
	it('evaluates a gable at its apex station as exactly apexRise over a decimal grid', () => {
		for (let k = 0; k <= 9; k += 1) {
			for (let j = 1; j <= 9; j += 1) {
				for (let i = 1; i <= 9; i += 1) {
					const startRise = k / 10;
					const top: LayoutWallTop = {
						kind: 'gable',
						startRise,
						endRise: 0,
						apexRise: startRise + j / 10,
						apexOffset: i / 10 + 0.05
					};
					expect(wallTopRiseAt(top, i / 10 + 0.05, 20)).toBe(top.apexRise);
				}
			}
		}
		const hard: LayoutWallTop = {
			kind: 'gable',
			startRise: 0.1,
			endRise: 0,
			apexRise: 1,
			apexOffset: 0.15000000000000002
		};
		expect(wallTopRiseAt(hard, 0.15000000000000002, 5)).toBe(1);
	});

	it('keeps the authored decimal values of a symmetric gable split at its apex and rejoined', () => {
		// Both fragments keep the source's lowest end, so neither is re-based and
		// the authored decimals survive exactly.
		const top: LayoutWallTop = { kind: 'gable', startRise: 0, endRise: 0, apexRise: 0.7, apexOffset: 2.3 };
		const document = documentOf({ a: [0, 0], b: [5.3, 0] }, [
			wall('w1', 'a', 'b', { height: 3.1, top })
		]);
		const plan = planWallSplit(document, 'w1', 2.3, allocator);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const joined = planDissolveJunction(plan.document, plan.junctionId, freshCapture(), document.floor.id);
		expect(joined.kind).toBe('success');
		if (joined.kind !== 'success') return;
		expect(serializeWallFirstLayoutDocument(joined.document)).toBe(
			serializeWallFirstLayoutDocument(document)
		);
	});

	it('merges two slopes that both start at the joint into a gable with the authored rise', () => {
		const slope: LayoutWallTop = { kind: 'slope', startRise: 0.4, endRise: 0 };
		const document = documentOf({ a: [0, 0], b: [4, 0], c: [10, 0] }, [
			wall('w1', 'b', 'a', { top: slope }),
			wall('w2', 'b', 'c', { top: slope })
		]);
		const joined = planDissolveJunction(document, 'b', freshCapture(), document.floor.id);
		expect(joined.kind).toBe('success');
		if (joined.kind !== 'success') return;
		expect(joined.document.walls).toHaveLength(1);
		expect(joined.document.walls[0]!.top).toEqual({
			kind: 'gable',
			startRise: 0,
			endRise: 0,
			apexRise: 0.4,
			apexOffset: 4
		});
	});

	it('keeps the validated peak when a continuous pair differs within the height epsilon', () => {
		const peakRise = 1.5 * WALL_HEIGHT_EPSILON;
		const document = documentOf({ a: [0, 0], b: [4, 0], c: [10, 0] }, [
			wall('w1', 'a', 'b', { height: 4, top: { kind: 'slope', startRise: 0, endRise: peakRise } }),
			wall('w2', 'b', 'c', { top: { kind: 'slope', startRise: 1 + peakRise / 2, endRise: 0 } })
		]);
		const joined = planDissolveJunction(document, 'b', freshCapture(), document.floor.id);
		expect(joined.kind).toBe('success');
		if (joined.kind !== 'success') return;
		const merged = joined.document.walls[0]!;
		expect(merged.top.kind).toBe('gable');
		expect(wallTopAt(merged, 4, 10)).toBe(4 + peakRise);
	});

	it('splits a curved gable at an off-knot apex station into two slopes meeting at apexRise', () => {
		for (const apexOffset of [4.1, 3.3, 7.77]) {
			const document = documentOf({ a: [0, 0], b: [10, 0] }, [
				wall('w1', 'a', 'b', {
					top: { kind: 'gable', startRise: 0, endRise: 0, apexRise: 1.3, apexOffset },
					centerline: CURVED_CENTERLINE
				})
			]);
			const plan = planWallSubdivision(document, 'w1', apexOffset, allocator);
			expect(plan.kind, `apex ${apexOffset}`).toBe('success');
			if (plan.kind !== 'success') continue;
			const [first, second] = plan.document.walls as [LayoutWall, LayoutWall];
			expect(first.top.kind).toBe('slope');
			expect(second.top.kind).toBe('slope');
			if (first.top.kind !== 'slope' || second.top.kind !== 'slope') continue;
			expect(first.height + first.top.endRise).toBe(3 + 1.3);
			expect(second.height + second.top.startRise).toBe(3 + 1.3);
		}
	});

	it('splits a straight gable within a picometre of its apex into two slopes', () => {
		for (const delta of [-1e-12, 0, 1e-12]) {
			const document = documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b', { top: GABLE })]);
			const plan = planWallSplit(document, 'w1', 4 + delta, allocator);
			expect(plan.kind, `delta ${delta}`).toBe('success');
			if (plan.kind !== 'success') continue;
			const [first, second] = plan.document.walls as [LayoutWall, LayoutWall];
			expect(first.top.kind).toBe('slope');
			expect(second.top.kind).toBe('slope');
			expect(validateWallFirstLayoutDocument(plan.document).success).toBe(true);
		}
	});
});

/** Independent piecewise-linear rise of a parent top, written without the evaluator. */
function oracleTop(height: number, top: LayoutWallTop, length: number, station: number): number {
	if (top.kind === 'level') return height;
	const points: Array<[number, number]> = [[0, top.startRise]];
	if (top.kind === 'gable') points.push([top.apexOffset, top.apexRise]);
	points.push([length, top.endRise]);
	const s = Math.min(length, Math.max(0, station));
	for (let index = 1; index < points.length; index += 1) {
		const [x0, y0] = points[index - 1]!;
		const [x1, y1] = points[index]!;
		if (s <= x1) return height + y0 + (y1 - y0) * ((s - x0) / (x1 - x0));
	}
	return height + points.at(-1)![1];
}

describe('§6.3 · split then join preserves the geometry (oracle property)', () => {
	it('keeps every fragment and the rejoined Wall on the parent top for decimal tops', () => {
		const tops: Array<{ length: number; height: number; top: LayoutWallTop }> = [];
		for (const length of [5.3, 10]) {
			for (const height of [2.7, 4.2]) {
				for (const [startRise, endRise] of [
					[0, 0],
					[0, 0.3],
					[0.4, 0]
				] as const) {
					for (const apexOffset of length === 10 ? [0.7, 4, 7.7] : [1.1, 2.3, 4.9]) {
						for (const lift of [0.1, 0.7, 1.3]) {
							tops.push({
								length,
								height,
								top: {
									kind: 'gable',
									startRise,
									endRise,
									apexRise: Math.max(startRise, endRise) + lift,
									apexOffset
								}
							});
						}
					}
				}
				for (const [startRise, endRise] of [
					[0, 0.5],
					[0.9, 0],
					[0, 1.3]
				] as const) {
					tops.push({ length, height, top: { kind: 'slope', startRise, endRise } });
				}
			}
		}
		expect(tops.length).toBe(120);
		const cutsOf = (length: number, top: LayoutWallTop): number[] => {
			const cuts = length === 10 ? [0.5, 3.7, 5, 8.9] : [1.1, 2.3, 4.8];
			if (top.kind === 'gable') cuts.push(top.apexOffset);
			return cuts;
		};
		let checked = 0;
		for (const { length, height, top } of tops) {
			for (const cut of cutsOf(length, top)) {
				const label = `${JSON.stringify(top)} h ${height} L ${length} cut ${cut}`;
				const document = documentOf({ a: [0, 0], b: [length, 0] }, [
					wall('w1', 'a', 'b', { height, top })
				]);
				const plan = planWallSplit(document, 'w1', cut, allocator);
				expect(plan.kind, label).toBe('success');
				if (plan.kind !== 'success') continue;
				expect(validateWallFirstLayoutDocument(plan.document).success, label).toBe(true);
				const fragments = plan.document.walls as [LayoutWall, LayoutWall];
				const offsets = [0, cut];
				for (const [index, fragment] of fragments.entries()) {
					const fragmentLength = wallFirstWallLength(plan.document, fragment.id)!;
					for (let step = 0; step <= 20; step += 1) {
						const u = (fragmentLength * step) / 20;
						expect(wallTopAt(fragment, u, fragmentLength), `${label} fragment ${index} u ${u}`).toBeCloseTo(
							oracleTop(height, top, length, offsets[index]! + u),
							12
						);
					}
				}
				const joined = planDissolveJunction(plan.document, plan.junctionId, freshCapture(), document.floor.id);
				expect(joined.kind, label).toBe('success');
				if (joined.kind !== 'success') continue;
				expect(validateWallFirstLayoutDocument(joined.document).success, label).toBe(true);
				const merged = joined.document.walls[0]!;
				const mergedLength = wallFirstWallLength(joined.document, merged.id)!;
				if (merged.top.kind !== 'level') {
					expect(Math.min(merged.top.startRise, merged.top.endRise), label).toBe(0);
					const lowestEnd = Math.min(
						oracleTop(height, top, length, 0),
						oracleTop(height, top, length, length)
					);
					expect(merged.height, label).toBeCloseTo(lowestEnd, 12);
				}
				for (let step = 0; step <= 20; step += 1) {
					const s = (mergedLength * step) / 20;
					expect(wallTopAt(merged, s, mergedLength), `${label} merged s ${s}`).toBeCloseTo(
						oracleTop(height, top, length, s),
						12
					);
				}
				checked += 1;
			}
		}
		expect(checked).toBeGreaterThan(400);
	}, 30_000);
});

/**
 * T-P2's tolerance. The contract bound is `WALL_HEIGHT_EPSILON`, the continuity
 * tolerance Join already uses to accept a joint; re-basing at the cut and the
 * join actually lands within a few ulps (≈1e-15 m), so these tests hold a far
 * tighter bound that a re-interpolation regression could not hide under.
 */
const ROUND_TRIP_TOLERANCE = 1e-12;

/** Largest top-height difference between `candidate` and `reference` read at `map(station)`. */
function topDeviation(
	reference: LayoutWall,
	referenceLength: number,
	candidate: LayoutWall,
	candidateLength: number,
	map: (station: number) => number = (station) => station
): number {
	let worst = 0;
	for (let step = 0; step <= 40; step += 1) {
		const station = (candidateLength * step) / 40;
		const delta = Math.abs(
			wallTopAt(candidate, station, candidateLength) - wallTopAt(reference, map(station), referenceLength)
		);
		worst = Math.max(worst, delta);
	}
	return worst;
}

function roundTrip(document: LayoutDocumentWallFirst, cut: number): LayoutDocumentWallFirst {
	const split = planWallSplit(document, 'w1', cut, allocator);
	if (split.kind !== 'success') throw new Error(split.rejection.message);
	const joined = planDissolveJunction(split.document, split.junctionId, freshCapture(), document.floor.id);
	if (joined.kind !== 'success') throw new Error(joined.rejection.message);
	return joined.document;
}

function ceilingOf(document: LayoutDocumentWallFirst, roomId = 'room'): number | undefined {
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (!room) throw new Error(`missing room '${roomId}'`);
	return roomCeilingHeight(room.boundary, new Map(document.walls.map((entry) => [entry.id, entry])));
}

describe('T-P2 · split then join is geometrically equivalent and canonical', () => {
	const DECIMAL_GABLE: LayoutWallTop = { kind: 'gable', startRise: 0, endRise: 0.3, apexRise: 1.1, apexOffset: 4.7 };
	const DECIMAL_SLOPE: LayoutWallTop = { kind: 'slope', startRise: 0.4, endRise: 0 };

	it('rejoins decimal tops on diagonal and curved Walls within the tolerance, apex in place', () => {
		const shapes: Array<{ label: string; end: LayoutVec2; centerline?: LayoutWall['centerline'] }> = [
			{ label: 'diagonal', end: [7.1, 4.9] },
			{ label: 'curved', end: [10, 0], centerline: CURVED_CENTERLINE }
		];
		let checked = 0;
		for (const shape of shapes) {
			for (const [top, height] of [
				[DECIMAL_GABLE, 3.1],
				[DECIMAL_SLOPE, 2.7]
			] as const) {
				for (const cut of [1.3, 4.7, 6.1]) {
					const label = `${shape.label} ${top.kind} cut ${cut}`;
					const document = documentOf({ a: [0.3, 0.1], b: shape.end }, [
						wall('w1', 'a', 'b', { height, top, ...(shape.centerline ? { centerline: shape.centerline } : {}) })
					]);
					if (shape.label === 'curved') document.junctions[0]!.point = [0, 0];
					const source = document.walls[0]!;
					const length = wallFirstWallLength(document, 'w1')!;
					const joined = roundTrip(document, cut);
					expect(validateWallFirstLayoutDocument(joined).success, label).toBe(true);
					const merged = joined.walls[0]!;
					const mergedLength = wallFirstWallLength(joined, 'w1')!;
					expect(merged.top.kind, label).toBe(top.kind);
					expect(topDeviation(source, length, merged, mergedLength), label).toBeLessThanOrEqual(
						ROUND_TRIP_TOLERANCE
					);
					if (merged.top.kind === 'gable' && top.kind === 'gable') {
						// A curved fragment's length is re-measured along its own arc, so the
						// rejoined apex station is held to the station tolerance there.
						const stationBound = shape.centerline ? WALL_TOP_STATION_EPSILON : ROUND_TRIP_TOLERANCE;
						expect(Math.abs(merged.top.apexOffset - top.apexOffset), label).toBeLessThanOrEqual(
							stationBound
						);
					}
					checked += 1;
				}
			}
		}
		expect(checked).toBe(12);
		// The bound the contract states is the joint tolerance itself.
		expect(ROUND_TRIP_TOLERANCE).toBeLessThan(WALL_HEIGHT_EPSILON);
	});

	it('produces the same canonical bytes on every run, even where re-basing rounds', () => {
		const make = () =>
			documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b', { height: 3.1, top: DECIMAL_GABLE })]);
		const first = roundTrip(make(), 1.3);
		const second = roundTrip(make(), 1.3);
		expect(serializeWallFirstLayoutDocument(first)).toBe(serializeWallFirstLayoutDocument(second));
		// Re-basing 3.1 + 0.3 − 3.1 rounds, so the bytes are canonical, not historical.
		const merged = first.walls[0]!;
		expect(merged.height).toBe(3.1);
		expect(merged.top.kind).toBe('gable');
		if (merged.top.kind !== 'gable') return;
		expect(Math.min(merged.top.startRise, merged.top.endRise)).toBe(0);
		expect(merged.top.apexRise).toBe(1.1);
		expect(merged.top.apexOffset).toBe(4.7);
		expect(Math.abs(merged.top.endRise - 0.3)).toBeLessThanOrEqual(ROUND_TRIP_TOLERANCE);
		// A second round trip stays on the parent top: no drift accumulates.
		const again = roundTrip(first, 1.3);
		expect(topDeviation(make().walls[0]!, 10, again.walls[0]!, 10)).toBeLessThanOrEqual(ROUND_TRIP_TOLERANCE);
	});

	it('joins a fragment pair traversed in opposite directions onto the parent top', () => {
		const document = documentOf({ a: [0, 0], b: [10, 0] }, [
			wall('w1', 'a', 'b', { height: 3.1, top: DECIMAL_GABLE })
		]);
		const split = planWallSplit(document, 'w1', 6.1, allocator);
		expect(split.kind).toBe('success');
		if (split.kind !== 'success') return;
		// Reverse the second fragment so the join reads it against its own direction.
		const walls = split.document.walls.map((entry) =>
			entry.id === 'w1'
				? entry
				: {
						...entry,
						startJunctionId: entry.endJunctionId,
						endJunctionId: entry.startJunctionId,
						top: reverseWallTop(entry.top, 10 - 6.1)
					}
		);
		const joined = planDissolveJunction({ ...split.document, walls }, split.junctionId, freshCapture(), document.floor.id);
		expect(joined.kind).toBe('success');
		if (joined.kind !== 'success') return;
		const merged = joined.document.walls[0]!;
		const mergedLength = wallFirstWallLength(joined.document, merged.id)!;
		const forward = merged.startJunctionId === 'a';
		expect(
			topDeviation(document.walls[0]!, 10, merged, mergedLength, (station) =>
				forward ? station : mergedLength - station
			)
		).toBeLessThanOrEqual(ROUND_TRIP_TOLERANCE);
	});
});

describe('§6.3 · Split and Join keep the ceiling of every unchanged Room', () => {
	const RISING: LayoutWallTop = { kind: 'slope', startRise: 0, endRise: 1 };

	it('refuses an explicit Split that would raise the ceiling, naming the Wall and the Room', () => {
		const document = rectangleRoom(RISING);
		expect(ceilingOf(document)).toBe(3);
		unchanged(document, () => {
			const plan = planWallSubdivision(document, 'w1', 5, allocator);
			expect(plan).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'room_ceiling_changed', targetIds: ['w1', 'room'] }
			});
		});
		unchanged(document, () => {
			const plan = planWallSplitAtPoint(document, 'w1', 5, [5, 0], allocator, { keepRoomCeilings: true });
			expect(plan).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'room_ceiling_changed', wallId: 'w1', roomId: 'room' }
			});
		});
	});

	it('splits where every fragment stays at or below the ceiling', () => {
		// A symmetric gable cut at its apex: both slopes keep the 3 m eave.
		const symmetric = rectangleRoom({ kind: 'gable', startRise: 0, endRise: 0, apexRise: 1, apexOffset: 5 });
		const apex = planWallSubdivision(symmetric, 'w1', 5, allocator);
		expect(apex.kind).toBe('success');
		if (apex.kind === 'success') expect(ceilingOf(apex.document)).toBe(3);

		// A shed Room whose tall Wall already sets the ceiling above the cut.
		const shed = rectangleRoom(RISING);
		shed.walls[2] = { ...shed.walls[2]!, height: 5 };
		const plan = planWallSubdivision(shed, 'w1', 5, allocator);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(ceilingOf(plan.document)).toBe(5);
		const created = plan.document.walls.find((entry) => !shed.walls.some((old) => old.id === entry.id))!;
		expect(created.height).toBe(3.5);
		// And Join restores the one Wall without moving the ceiling.
		const cutJunction = plan.document.junctions.find(
			(entry) => !shed.junctions.some((old) => old.id === entry.id)
		)!;
		const joined = planDissolveJunction(plan.document, cutJunction.id, freshCapture(), shed.floor.id);
		expect(joined.kind).toBe('success');
		if (joined.kind === 'success') expect(ceilingOf(joined.document)).toBe(5);
	});

	it('leaves noding inside drawing, claims and open-side slides unguarded (known limitation, V3/R)', () => {
		// Those operations may redefine the Room itself, so only explicit Split opts in.
		const document = rectangleRoom(RISING);
		const plan = planWallSplit(document, 'w1', 5, allocator);
		expect(plan.kind).toBe('success');
		if (plan.kind === 'success') expect(ceilingOf(plan.document)).toBe(3.5);
	});

	it('refuses a Join that would lower the ceiling, naming the Room', () => {
		// Up 3 → 4 then down 4 → 3.5 joins into one gable on a 3 m eave, which
		// would drop the Room's ceiling from 3.5 m to 3 m.
		const document = enclosedRoom(
			documentOf({ a: [0, 0], b: [5, 0], c: [10, 0], d: [10, 6], e: [0, 6] }, [
				wall('w1', 'a', 'b', { top: RISING }),
				wall('w2', 'b', 'c', { height: 3.5, top: { kind: 'slope', startRise: 0.5, endRise: 0 } }),
				wall('w3', 'c', 'd'),
				wall('w4', 'd', 'e'),
				wall('w5', 'e', 'a')
			]),
			['w1', 'w2', 'w3', 'w4', 'w5']
		);
		expect(ceilingOf(document)).toBe(3.5);
		unchanged(document, () => {
			const plan = planDissolveJunction(document, 'b', freshCapture(), document.floor.id);
			expect(plan).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'room_ceiling_changed', roomIds: ['room'] }
			});
		});
		// Outside a Room the same join is an ordinary gable.
		const free = documentOf({ a: [0, 0], b: [5, 0], c: [10, 0] }, [document.walls[0]!, document.walls[1]!]);
		const plan = planDissolveJunction(free, 'b', freshCapture(), free.floor.id);
		expect(plan.kind).toBe('success');
		if (plan.kind === 'success') {
			expect(plan.document.walls[0]!.top).toEqual({
				kind: 'gable',
				startRise: 0,
				endRise: 0.5,
				apexRise: 1,
				apexOffset: 5
			});
		}
	});
});

describe('§6.3 · near-degenerate fragments: one station rule, whole refusal', () => {
	const SHALLOW: LayoutWallTop = { kind: 'gable', startRise: 0, endRise: 0, apexRise: 0.1, apexOffset: 5 };
	const shallow = () => documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b', { top: SHALLOW })]);

	it('snaps a cut within the station tolerance to the apex', () => {
		for (const delta of [-WALL_TOP_STATION_EPSILON / 2, WALL_TOP_STATION_EPSILON / 2]) {
			const plan = planWallSplit(shallow(), 'w1', 5 + delta, allocator);
			expect(plan.kind, `delta ${delta}`).toBe('success');
			if (plan.kind !== 'success') continue;
			const [first, second] = plan.document.walls as [LayoutWall, LayoutWall];
			expect(first.top).toEqual({ kind: 'slope', startRise: 0, endRise: 0.1 });
			expect(second.top).toEqual({ kind: 'slope', startRise: 0.1, endRise: 0 });
		}
	});

	it('refuses a cut that leaves a gable whose apex no longer clears its end, whole', () => {
		// 0.02 m/m: 2 nm or 30 nm off the apex leaves an apex < 1 nm above the cut.
		for (const delta of [-3e-8, -2e-9, 2e-9, 3e-8]) {
			const document = shallow();
			unchanged(document, () => {
				expect(planWallSplit(document, 'w1', 5 + delta, allocator), `delta ${delta}`).toMatchObject({
					kind: 'rejected',
					rejection: { code: 'wall_top_split_degenerate', wallId: 'w1' }
				});
				expect(planWallSubdivision(document, 'w1', 5 + delta, allocator), `delta ${delta}`).toMatchObject({
					kind: 'rejected',
					rejection: { code: 'wall_top_split_degenerate', targetIds: ['w1'] }
				});
			});
		}
		// A micrometre away the gable is a real gable again.
		const plan = planWallSplit(shallow(), 'w1', 5 + 1e-6, allocator);
		expect(plan.kind).toBe('success');
		if (plan.kind === 'success') expect(plan.document.walls[0]!.top.kind).toBe('gable');
	});

	it('refuses a cut that leaves a slope below the rise tolerance', () => {
		const document = documentOf({ a: [0, 0], b: [10, 0] }, [
			wall('w1', 'a', 'b', { top: { kind: 'slope', startRise: 0, endRise: 1.5e-9 } })
		]);
		unchanged(document, () => {
			expect(planWallSplit(document, 'w1', 5, allocator)).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'wall_top_split_degenerate' }
			});
		});
	});

	it('keeps the parent peak or refuses whole across the station-tolerance boundary', () => {
		// The one station rule: a cut within WALL_TOP_STATION_EPSILON of the apex
		// moves the apex onto the cut (at most 1 nm along the Wall); any other cut
		// keeps the apex inside one fragment. Either way no fragment loses the peak.
		let snapped = 0;
		let kept = 0;
		let refused = 0;
		for (const apexOffset of [4, 3.3, 7.77, 0.15000000000000002, 2.3]) {
			const top: LayoutWallTop = { kind: 'gable', startRise: 0, endRise: 0.2, apexRise: 1.3, apexOffset };
			const parent = wall('w1', 'a', 'b', { top });
			// 0.75 ε to 1.25 ε, including ε itself.
			for (let k = -64; k <= 64; k += 1) {
				const delta = WALL_TOP_STATION_EPSILON * (1 + k / 256);
				for (const cut of [apexOffset - delta, apexOffset + delta]) {
					const label = `apex ${apexOffset} cut ${cut}`;
					const document = documentOf({ a: [0, 0], b: [10, 0] }, [parent]);
					const plan = planWallSplit(document, 'w1', cut, allocator);
					if (plan.kind === 'rejected') {
						expect(plan.rejection.code, label).toBe('wall_top_split_degenerate');
						refused += 1;
						continue;
					}
					expect(validateWallFirstLayoutDocument(plan.document).success, label).toBe(true);
					const onCut = Math.abs(apexOffset - cut) <= WALL_TOP_STATION_EPSILON;
					const reference = onCut ? wall('w1', 'a', 'b', { top: { ...top, apexOffset: cut } }) : parent;
					const [first, second] = plan.document.walls as [LayoutWall, LayoutWall];
					const firstLength = wallFirstWallLength(plan.document, first.id)!;
					const secondLength = wallFirstWallLength(plan.document, second.id)!;
					expect(topDeviation(reference, 10, first, firstLength), label).toBeLessThanOrEqual(
						ROUND_TRIP_TOLERANCE
					);
					expect(
						topDeviation(reference, 10, second, secondLength, (station) => firstLength + station),
						label
					).toBeLessThanOrEqual(ROUND_TRIP_TOLERANCE);
					const peak = Math.max(
						...[first, second].map((entry) =>
							entry.top.kind === 'gable'
								? entry.height + entry.top.apexRise
								: entry.top.kind === 'slope'
									? entry.height + Math.max(entry.top.startRise, entry.top.endRise)
									: entry.height
						)
					);
					expect(Math.abs(peak - (3 + 1.3)), label).toBeLessThanOrEqual(ROUND_TRIP_TOLERANCE);
					if (onCut) snapped += 1;
					else kept += 1;
				}
			}
		}
		// Every outcome on both sides of the boundary is exercised.
		expect(snapped).toBeGreaterThan(0);
		expect(kept).toBeGreaterThan(0);
		expect(refused).toBeGreaterThan(0);
	});

	it('refuses a drawn T that would node a degenerate fragment, with the same code', () => {
		const document = shallow();
		unchanged(document, () => {
			const plan = planWallChain({
				baseline: document,
				points: [
					[5 + 2e-8, -2],
					[5 + 2e-8, 0]
				],
				close: false,
				endpointHostSnaps: [{ pointIndex: 1, wallId: 'w1' }],
				capture: freshCapture(),
				levelId: document.floor.id
			});
			expect(plan).toMatchObject({ kind: 'rejected', rejection: { code: 'wall_top_split_degenerate' } });
		});
	});
});

describe('§3.3 · every slope breakpoint returns its authored rise', () => {
	it('reads a slope at its far end as exactly endRise for decimal values and lengths', () => {
		for (const length of [0.3, 5.3, 7.1, 11.990547441393634]) {
			for (let start = 0; start <= 9; start += 1) {
				for (let end = 0; end <= 9; end += 1) {
					if (start === end) continue;
					const top: LayoutWallTop = { kind: 'slope', startRise: start / 10, endRise: end / 10 };
					expect(wallTopRiseAt(top, 0, length)).toBe(top.startRise);
					expect(wallTopRiseAt(top, length, length)).toBe(top.endRise);
				}
			}
		}
	});
});
