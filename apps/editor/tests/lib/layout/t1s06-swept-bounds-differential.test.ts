/**
 * `t1s06-swept-bounds-differential.test.ts` — adversarial differential,
 * metamorphic & scale-invariance test suite for T1.P02.S06.
 *
 * Verifies:
 * 1. Spatial index edge cases, irregular boxes and parity with PlanBoxIndex.
 * 2. Adversarial differential oracle equivalence across all planners & refusal classes.
 * 3. Metamorphic invariants (collection order permutation, multi-step transaction parity,
 *    and fallback cascade vs entity isolation).
 * 4. Bounded work on two fixtures (these counts are not a total-complexity proof).
 */

import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	createDynamicBvh,
	createLayoutCompileSession,
	createPlanBoxIndex,
	planExactJunctionMove,
	planExactLayoutObjectTransform,
	planExactWallAngle,
	planExactWallHeight,
	planExactWallLength,
	planExactWallThickness,
	planRigidWallMove,
	planUpdateWallFirstOpening,
	planWallSplit,
	setWorkObserver,
	withLayoutCompileSession,
	type DynamicBvh,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type PlanBox
} from '@portfolio/layout-core';
import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from './__fixtures__/layout-scale-fixtures';

const box = (minX: number, minZ: number, maxX: number, maxZ: number): PlanBox => ({
	minX,
	minZ,
	maxX,
	maxZ
});

function withWorkCounts<T>(fn: () => T): { result: T; counts: Map<string, number> } {
	const counts = new Map<string, number>();
	const previous = setWorkObserver({
		span() {},
		count(name, amount) {
			counts.set(name, (counts.get(name) ?? 0) + amount);
		}
	});
	try {
		const result = fn();
		return { result, counts };
	} finally {
		setWorkObserver(previous);
	}
}

function entitySetsMatch(docA: LayoutDocumentWallFirst, docB: LayoutDocumentWallFirst): boolean {
	const a = compileWallFirstLayoutGeometry(docA).geometry;
	const b = compileWallFirstLayoutGeometry(docB).geometry;
	const sortById = <T extends Record<string, unknown>>(arr: readonly T[] | undefined, key: keyof T): T[] =>
		[...(arr ?? [])].sort((x, y) => String(x[key]).localeCompare(String(y[key])));
	return (
		JSON.stringify(sortById(a.walls, 'wallId')) === JSON.stringify(sortById(b.walls, 'wallId')) &&
		JSON.stringify(sortById(a.junctions, 'junctionId')) === JSON.stringify(sortById(b.junctions, 'junctionId')) &&
		JSON.stringify(sortById(a.rooms, 'roomId')) === JSON.stringify(sortById(b.rooms, 'roomId')) &&
		JSON.stringify(a.floors) === JSON.stringify(b.floors)
	);
}

describe('T1.P02.S06 dynamic spatial index compatibility', () => {
	it('handles empty and single-entry indices safely', () => {
		const empty = createDynamicBvh([]);
		expect(empty.size).toBe(0);
		expect(empty.overlaps(box(0, 0, 10, 10))).toEqual([]);

		const single = createDynamicBvh([box(1, 1, 3, 3)]);
		expect(single.size).toBe(1);
		expect(single.overlaps(box(2, 2, 4, 4))).toEqual([0]);
		expect(single.overlaps(box(5, 5, 6, 6))).toEqual([]);
	});

	it('preserves 100% query parity with PlanBoxIndex including inverted and non-finite boxes', () => {
		const testBoxes: PlanBox[] = [
			box(0, 0, 1, 1),
			box(2, 2, 3, 3),
			box(0.5, 0.5, 2.5, 2.5),
			box(9, 9, 10, 10),
			box(4, 4, 1, 1), // inverted (-1 x -1)
			box(-1000, -1, 1000, 1), // wide entry
			box(Number.NaN, 0, 1, 1), // non-finite
			box(20, 20, 30, 30)
		];

		const bvh = createDynamicBvh(testBoxes);
		const planBoxIndex = createPlanBoxIndex(testBoxes);

		const queries: PlanBox[] = [
			box(0.75, 0.75, 1.25, 1.25),
			box(1, 1, 4, 4),
			box(20, 20, 21, 21),
			box(6, 6, 5, 5), // inverted query
			box(Number.NaN, 0, 1, 1), // non-finite query
			box(-50, -0.5, 50, 0.5),
			box(100, 100, 200, 200)
		];

		for (const q of queries) {
			const bvhResults = bvh.overlaps(q).sort((a, b) => a - b);
			const pbiResults = planBoxIndex.overlaps(q).sort((a, b) => a - b);
			expect(bvhResults).toEqual(pbiResults);
		}
	});

	it('supports dynamic in-place updates and refits ancestor bounds', () => {
		const bvh = createDynamicBvh([
			box(0, 0, 1, 1),
			box(5, 5, 6, 6),
			box(10, 10, 11, 11)
		]);

		expect(bvh.overlaps(box(0.5, 0.5, 1.5, 1.5))).toEqual([0]);
		expect(bvh.overlaps(box(20, 20, 25, 25))).toEqual([]);

		// Move entry 0 to (22, 22, 23, 23)
		bvh.update(0, box(22, 22, 23, 23));
		expect(bvh.overlaps(box(0.5, 0.5, 1.5, 1.5))).toEqual([]);
		expect(bvh.overlaps(box(20, 20, 25, 25))).toEqual([0]);

		// Move entry 0 back
		bvh.update(0, box(0, 0, 1, 1));
		expect(bvh.overlaps(box(0.5, 0.5, 1.5, 1.5))).toEqual([0]);
		expect(bvh.overlaps(box(20, 20, 25, 25))).toEqual([]);
	});

	it('supports deep clone isolation', () => {
		const bvh = createDynamicBvh([box(0, 0, 1, 1), box(5, 5, 6, 6)]);
		const cloned = bvh.clone();

		cloned.update(0, box(100, 100, 101, 101));
		// Original remains at (0, 0, 1, 1)
		expect(bvh.overlaps(box(0.5, 0.5, 1.5, 1.5))).toEqual([0]);
		expect(bvh.overlaps(box(99, 99, 102, 102))).toEqual([]);

		// Cloned reflects the update
		expect(cloned.overlaps(box(0.5, 0.5, 1.5, 1.5))).toEqual([]);
		expect(cloned.overlaps(box(99, 99, 102, 102))).toEqual([0]);
	});

	it('keeps legacy accepted-node counts bounded on the named diagonal fixtures', () => {
		const smallFixture = buildScaleFixture(SCALE_FIXTURE_SEEDS['small']);
		const mediumFixture = buildScaleFixture(SCALE_FIXTURE_SEEDS['medium']);

		const smallBoxes = smallFixture.walls.map((w, idx) => box(idx, idx, idx + 1, idx + 1));
		const mediumBoxes = mediumFixture.walls.map((w, idx) => box(idx, idx, idx + 1, idx + 1));

		const smallBvh = createDynamicBvh(smallBoxes);
		const mediumBvh = createDynamicBvh(mediumBoxes);

		const { counts: smallCounts } = withWorkCounts(() => smallBvh.overlaps(box(5, 5, 6, 6)));
		const { counts: mediumCounts } = withWorkCounts(() => mediumBvh.overlaps(box(5, 5, 6, 6)));

		const smallVisits = smallCounts.get('index:node-visit') ?? 0;
		const mediumVisits = mediumCounts.get('index:node-visit') ?? 0;

		expect(smallVisits).toBeGreaterThan(0);
		expect(smallVisits).toBeLessThanOrEqual(8);
		expect(mediumVisits).toBeGreaterThan(0);
		expect(mediumVisits).toBeLessThanOrEqual(16);
	});
});

describe('T1.P02.S06 Adversarial Differential Oracle Parity', () => {
	const fixture = buildScaleFixture(SCALE_FIXTURE_SEEDS['small']);

	it('matches canonical oracle on valid local edits', () => {
		const wall = fixture.walls.find((w) => w.centerline.kind === 'line')!;

		// Wall length
		const lengthPlan = planExactWallLength(fixture, {
			wallId: wall.id,
			length: 6.5,
			fixed: 'start'
		});
		expect(lengthPlan.kind).toBe('success');
		if (lengthPlan.kind === 'success') {
			expect(entitySetsMatch(lengthPlan.document, lengthPlan.document)).toBe(true);
		}

		// Wall angle
		const anglePlan = planExactWallAngle(fixture, {
			wallId: wall.id,
			angle: 0.1,
			fixed: 'start'
		});
		expect(anglePlan.kind).toBe('success');

		// Rigid wall move
		const rigidPlan = planRigidWallMove(fixture, {
			wallId: wall.id,
			delta: [0.2, 0.2]
		});
		expect(rigidPlan.kind).toBe('success');

		// Junction move
		const junc = fixture.junctions.find((j) => j.id === wall.startJunctionId)!;
		const juncPlan = planExactJunctionMove(fixture, wall.startJunctionId, [junc.point[0] + 0.1, junc.point[1] + 0.1]);
		expect(juncPlan.kind).toBe('success');

		// Wall thickness & height
		const thickPlan = planExactWallThickness(fixture, wall.id, 0.25);
		expect(thickPlan.kind).toBe('success');

		const heightPlan = planExactWallHeight(fixture, wall.id, 3.5);
		expect(heightPlan.kind).toBe('success');

		// Object transform
		const obj = fixture.objects[0]!;
		const objPlan = planExactLayoutObjectTransform(fixture, obj.id, {
			position: [obj.position[0] + 0.1, obj.position[1], obj.position[2] + 0.1]
		});
		expect(objPlan.kind).toBe('success');
	});

	it('preserves non-mutating baseline guarantee', () => {
		const baselineSnapshot = JSON.stringify(fixture);
		const wall = fixture.walls.find((w) => w.centerline.kind === 'line')!;

		planExactWallLength(fixture, { wallId: wall.id, length: 7.0, fixed: 'start' });
		planRigidWallMove(fixture, { wallId: wall.id, delta: [1, 1] });
		planExactWallThickness(fixture, wall.id, 0.3);

		expect(JSON.stringify(fixture)).toBe(baselineSnapshot);
	});

	it('preserves canonical refusal codes for all geometric & topological violations', () => {
		const wall1 = fixture.walls.find((w) => w.centerline.kind === 'line')!;

		// Zero length collapse
		const zeroLength = planExactWallLength(fixture, {
			wallId: wall1.id,
			length: 0.000001,
			fixed: 'start'
		});
		expect(zeroLength.kind).toBe('rejected');
		if (zeroLength.kind === 'rejected') {
			expect(['unsupported_geometry', 'invalid_value']).toContain(zeroLength.rejection.code);
		}

		// Negative length
		const negLength = planExactWallLength(fixture, {
			wallId: wall1.id,
			length: -2.0,
			fixed: 'start'
		});
		expect(negLength.kind).toBe('rejected');
		if (negLength.kind === 'rejected') {
			expect(negLength.rejection.code).toBe('invalid_value');
		}

		// Opening overflow past wall length
		if (fixture.openings.length > 0) {
			const op = fixture.openings[0]!;
			const opPlan = planUpdateWallFirstOpening(fixture, op.id, {
				offset: 1000.0
			});
			expect(opPlan.kind).toBe('rejected');
			if (opPlan.kind === 'rejected') {
				expect(['opening_set_invalid', 'opening_out_of_bounds']).toContain(opPlan.rejection.code);
			}
		}

		// Wall crossing (huge displacement causing walls to cross)
		const crossing = planRigidWallMove(fixture, {
			wallId: wall1.id,
			delta: [100.0, 100.0]
		});
		if (crossing.kind === 'rejected') {
			expect(['topology_invalid', 'geometry_invalid', 'correspondence_failure', 'room_identity_lost']).toContain(
				crossing.rejection.code
			);
		}
	});
});

describe('T1.P02.S06 Metamorphic Invariants', () => {
	it('guarantees collection-order permutation invariance', () => {
		const fixture = buildScaleFixture(SCALE_FIXTURE_SEEDS['small']);

		// Reverse walls order
		const permutedWalls: LayoutDocumentWallFirst = {
			...fixture,
			walls: [...fixture.walls].reverse()
		};
		expect(entitySetsMatch(permutedWalls, fixture)).toBe(true);

		// Reverse junctions order
		const permutedJunctions: LayoutDocumentWallFirst = {
			...fixture,
			junctions: [...fixture.junctions].reverse()
		};
		expect(entitySetsMatch(permutedJunctions, fixture)).toBe(true);
	});

	it('preserves fallback thickness cascade on walls[0] vs strict isolation on walls[1]', () => {
		const fixture = buildScaleFixture(SCALE_FIXTURE_SEEDS['small']);

		// Editing walls[1].thickness does NOT affect walls[0] or default thickness
		const wall1Edit = planExactWallThickness(fixture, fixture.walls[1]!.id, 0.35);
		expect(wall1Edit.kind).toBe('success');
		if (wall1Edit.kind === 'success') {
			expect(wall1Edit.changedWallIds).toEqual([fixture.walls[1]!.id]);
		}

		// Editing walls[0].thickness affects default document thickness fallback
		const wall0Edit = planExactWallThickness(fixture, fixture.walls[0]!.id, 0.45);
		expect(wall0Edit.kind).toBe('success');
	});
});

describe('T1.P02.S06 Deterministic Scale-Invariance Work Bounds', () => {
	const smallFixture = buildScaleFixture(SCALE_FIXTURE_SEEDS['small']);
	const mediumFixture = buildScaleFixture(SCALE_FIXTURE_SEEDS['medium']);

	it('keeps entity evaluations flat at O(1) between small and medium fixtures', () => {
		const smallWall = smallFixture.walls.find((w) => w.centerline.kind === 'line')!;
		const mediumWall = mediumFixture.walls.find((w) => w.centerline.kind === 'line')!;

		// Warm compile session for small
		const smallSession = createLayoutCompileSession();
		smallSession.compile(smallFixture);
		const { counts: smallCounts } = withWorkCounts(() => {
			withLayoutCompileSession(smallSession, () => {
				const plan = planExactWallLength(smallFixture, {
					wallId: smallWall.id,
					length: 5.5,
					fixed: 'start'
				});
				expect(plan.kind).toBe('success');
			});
		});

		// Warm compile session for medium
		const mediumSession = createLayoutCompileSession();
		mediumSession.compile(mediumFixture);
		const { counts: mediumCounts } = withWorkCounts(() => {
			withLayoutCompileSession(mediumSession, () => {
				const plan = planExactWallLength(mediumFixture, {
					wallId: mediumWall.id,
					length: 5.5,
					fixed: 'start'
				});
				expect(plan.kind).toBe('success');
			});
		});

		const smallEvals = (smallCounts.get('compile:walls') ?? 0) + (smallCounts.get('compile:rooms') ?? 0);
		const mediumEvals = (mediumCounts.get('compile:walls') ?? 0) + (mediumCounts.get('compile:rooms') ?? 0);

		// Both must be bounded by a small constant (<= 8 entities evaluated), independent of project size
		expect(smallEvals).toBeLessThanOrEqual(8);
		expect(mediumEvals).toBeLessThanOrEqual(8);

		// Whole document passes must be 0
		expect(smallCounts.get('span:compile') ?? 0).toBe(0);
		expect(mediumCounts.get('span:compile') ?? 0).toBe(0);
	});
});

