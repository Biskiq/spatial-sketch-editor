/**
 * T1 V2b — the Wall-top planner contract.
 *
 * Every row of `v-plan-verticality.md` §6.3 has its core case here: the one
 * normalising writer, the rigid height shift, exact split arithmetic, exact
 * join/dissolve arithmetic with a split → join byte round trip, apex stations
 * that stay in metres under a length edit and refuse an outside apex whole,
 * duplication and Room move copying the top, bend/straighten keeping it, and
 * Round radius scaling the apex with the circumference.
 *
 * T-P2 is the split/join round trip; T-P6 is the apex boundary and the closed
 * Wall's level-only rule. T-P3–T-P5 stay in their V2a suites
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
	planWallCrossing,
	planWallSplit,
	serializeWallFirstLayoutDocument,
	sliceWallTop,
	wallFirstWallLength,
	wallTopAt,
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

	it('restores the original bytes when the split is rejoined (T-P2)', () => {
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
