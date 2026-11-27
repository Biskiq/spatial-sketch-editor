/**
 * T1 V2a — operations whose exact top arithmetic arrives with V2b refuse whole.
 *
 * Split, crossing noding, subdivision, join/dissolve and the roof fit must either
 * be correct for a sloped or gabled Wall or refuse with a named code, the
 * document byte-identical. Each refusal is paired with the level-Wall behaviour
 * it must not change. Round repack and radius edits live in
 * `layout-connected-curves.test.ts` beside the Round ring fixtures; region
 * relations live here because they read the compiled top over covered stations.
 */
import { describe, expect, it } from 'vitest';

import { compileWallFirstLayoutGeometryFresh, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import {
	WALL_TOP_NOT_JOINABLE_CODE,
	WALL_TOP_PROFILE_UNSUPPORTED_CODE,
	createEmptyWallFirstLayoutDocument,
	planDissolveJunction,
	planWallChain,
	planWallCrossing,
	planWallSplit,
	planWallSubdivision,
	validateWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutWall,
	type LayoutWallTop,
	type NodingIdAllocator
} from '@portfolio/layout-core/wall';
import {
	planCreateRegion,
	planFitRegionToWalls,
	planFitWallsToRegion,
	regionWallRelations,
	regionWallTopRangeY
} from '@portfolio/layout-core/room';
import { captureFor, freshCapture } from './__fixtures__/layout-id-capture';

const SLOPE: LayoutWallTop = { kind: 'slope', startRise: 0, endRise: 2 };
const GABLE: LayoutWallTop = { kind: 'gable', startRise: 0, endRise: 0, apexRise: 2, apexOffset: 5 };

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
		top: { kind: 'level' },
		centerline: { kind: 'line' },
		...overrides
	};
}

function documentOf(points: Record<string, LayoutVec2>, walls: readonly LayoutWall[]): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	for (const [id, point] of Object.entries(points)) document.junctions.push({ id, point });
	document.walls.push(...walls);
	return document;
}

function expectUnchanged(document: LayoutDocumentWallFirst, run: () => unknown): void {
	const before = JSON.stringify(document);
	run();
	expect(JSON.stringify(document)).toBe(before);
}

describe.each([
	['slope', SLOPE],
	['gable', GABLE]
] as const)('V2a · a %s Wall refuses subdivision whole', (_name, top) => {
	const single = (wallTop: LayoutWallTop) =>
		documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b', { top: wallTop })]);

	it('planWallSplit refuses, naming the Wall, and leaves the document unchanged', () => {
		const document = single(top);
		expectUnchanged(document, () => {
			const plan = planWallSplit(document, 'w1', 4, allocator);
			expect(plan.kind).toBe('rejected');
			if (plan.kind !== 'rejected') return;
			expect(plan.rejection.code).toBe(WALL_TOP_PROFILE_UNSUPPORTED_CODE);
			expect(plan.rejection.wallId).toBe('w1');
			expect(plan.rejection.message).toContain("'w1'");
			expect(plan.rejection.message).toContain('V2b');
		});
	});

	it('planWallSubdivision refuses with the same code', () => {
		const document = single(top);
		expectUnchanged(document, () => {
			const plan = planWallSubdivision(document, 'w1', 4, allocator);
			expect(plan.kind).toBe('rejected');
			if (plan.kind !== 'rejected') return;
			expect(plan.rejection.code).toBe(WALL_TOP_PROFILE_UNSUPPORTED_CODE);
			expect(plan.rejection.targetIds).toEqual(['w1']);
		});
	});

	it('planWallCrossing refuses when either crossing Wall is profiled', () => {
		const crossing = (first: LayoutWallTop, second: LayoutWallTop) =>
			documentOf({ a: [0, 0], b: [10, 0], c: [5, -5], d: [5, 5] }, [
				wall('w1', 'a', 'b', { top: first }),
				wall('w2', 'c', 'd', { top: second })
			]);
		for (const document of [
			crossing(top, { kind: 'level' }),
			crossing({ kind: 'level' }, top)
		]) {
			expectUnchanged(document, () => {
				const plan = planWallCrossing(document, ['w1', 'w2'], [5, 0], allocator);
				expect(plan.kind).toBe('rejected');
				if (plan.kind !== 'rejected') return;
				expect(plan.rejection.code).toBe(WALL_TOP_PROFILE_UNSUPPORTED_CODE);
			});
		}
	});
});

describe('V2a · level Walls still split, subdivide and cross as before', () => {
	it('splits a level Wall into two level fragments', () => {
		const document = documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b')]);
		const plan = planWallSplit(document, 'w1', 4, allocator);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.walls.map((candidate) => candidate.top)).toEqual([{ kind: 'level' }, { kind: 'level' }]);
		expect(planWallSubdivision(document, 'w1', 4, allocator).kind).toBe('success');
	});

	it('nodes a level crossing', () => {
		const document = documentOf({ a: [0, 0], b: [10, 0], c: [5, -5], d: [5, 5] }, [
			wall('w1', 'a', 'b'),
			wall('w2', 'c', 'd')
		]);
		const plan = planWallCrossing(document, ['w1', 'w2'], [5, 0], allocator);
		expect(plan.kind).toBe('success');
	});

	it('still reports an endpoint split before the top refusal', () => {
		const document = documentOf({ a: [0, 0], b: [10, 0] }, [wall('w1', 'a', 'b', { top: SLOPE })]);
		const plan = planWallSplit(document, 'w1', 0, allocator);
		expect(plan.kind === 'rejected' && plan.rejection.code).toBe('split_at_existing_endpoint');
	});
});

describe('V2a · dissolve joins only level tops', () => {
	const joined = (first: LayoutWallTop, second: LayoutWallTop, firstHeight = 3, secondHeight = 3) =>
		documentOf({ a: [0, 0], b: [5, 0], c: [10, 0] }, [
			wall('w1', 'a', 'b', { top: first, height: firstHeight }),
			wall('w2', 'b', 'c', { top: second, height: secondHeight })
		]);
	const dissolve = (document: LayoutDocumentWallFirst) =>
		planDissolveJunction(document, 'b', freshCapture(), document.floor.id);

	it('refuses two sloped Walls of equal height instead of keeping the survivor slope', () => {
		const document = joined(
			{ kind: 'slope', startRise: 0, endRise: 1 },
			{ kind: 'slope', startRise: 1, endRise: 0 }
		);
		expectUnchanged(document, () => {
			const plan = dissolve(document);
			expect(plan.kind).toBe('rejected');
			if (plan.kind !== 'rejected') return;
			expect(plan.rejection.code).toBe(WALL_TOP_NOT_JOINABLE_CODE);
			expect(plan.rejection.message).toContain("'w1' and 'w2'");
		});
	});

	it('refuses one profiled Wall joined to a level Wall, and a gable pair', () => {
		for (const document of [joined(SLOPE, { kind: 'level' }), joined(GABLE, GABLE)]) {
			const plan = dissolve(document);
			expect(plan.kind === 'rejected' && plan.rejection.code).toBe(WALL_TOP_NOT_JOINABLE_CODE);
		}
	});

	it('still joins two level Walls into one level Wall', () => {
		const plan = dissolve(joined({ kind: 'level' }, { kind: 'level' }));
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.walls).toHaveLength(1);
		expect(plan.document.walls[0]!.top).toEqual({ kind: 'level' });
	});
});

describe('V2a · region fits and relations read the Wall top', () => {
	const RECT: LayoutVec2[] = [[0, 0], [10, 0], [10, 6], [0, 6]];
	function enclosure(): LayoutDocumentWallFirst {
		const baseline = createEmptyWallFirstLayoutDocument();
		const plan = planWallChain({
			baseline,
			points: RECT,
			close: true,
			capture: freshCapture(),
			levelId: baseline.floor.id,
			height: 3
		});
		if (plan.kind !== 'success') throw new Error(plan.rejection.message);
		return plan.document;
	}
	function southWallId(document: LayoutDocumentWallFirst): string {
		const point = (id: string) => document.junctions.find((junction) => junction.id === id)!.point;
		return document.walls.find((candidate) => {
			const a = point(candidate.startJunctionId);
			const b = point(candidate.endJunctionId);
			return a[1] === 0 && b[1] === 0;
		})!.id;
	}
	function withTop(document: LayoutDocumentWallFirst, wallId: string, top: LayoutWallTop): LayoutDocumentWallFirst {
		return { ...document, walls: document.walls.map((entry) => (entry.id === wallId ? { ...entry, top } : entry)) };
	}
	function canopy(document: LayoutDocumentWallFirst, footprint: LayoutVec2[], elevation: number) {
		const plan = planCreateRegion({
			baseline: document,
			capture: captureFor('region-a'),
			intent: { role: 'overhead', footprint, elevation, thickness: 0.2 }
		});
		if (plan.kind !== 'success') throw new Error(plan.rejection.message);
		return plan;
	}
	function readingOf(document: LayoutDocumentWallFirst, regionId: string, wallId: string) {
		const geometry = compileWallFirstLayoutGeometryFresh(document).geometry;
		const result = regionWallRelations(geometry, document.regions.find((entry) => entry.id === regionId)!);
		if (result.kind !== 'relations') throw new Error(result.message);
		return result.relations.find((entry) => entry.wallId === wallId)!;
	}

	it('evaluates the compiled top over a station interval, including an apex inside it', () => {
		const plain = enclosure();
		const wallId = southWallId(plain);
		const base = withTop(plain, wallId, GABLE);
		const compiled = compileWallFirstLayoutGeometryFresh(base).geometry.walls.find((entry) => entry.wallId === wallId)!;
		// Eave 3, apex 5 at station 5, level reading unchanged elsewhere.
		expect(regionWallTopRangeY(compiled, 0)).toEqual({ minY: 3, maxY: 5 });
		const range = (from: number, to: number) => regionWallTopRangeY(compiled, 0, from, to);
		expect(range(0, 2).minY).toBeCloseTo(3, 9);
		expect(range(0, 2).maxY).toBeCloseTo(3.8, 9);
		expect(range(8, 3).minY).toBeCloseTo(3.8, 9);
		expect(range(8, 3).maxY).toBeCloseTo(5, 9);
		expect(range(4, 6).minY).toBeCloseTo(4.6, 9);
		expect(range(4, 6).maxY).toBeCloseTo(5, 9);
		const level = compileWallFirstLayoutGeometryFresh(enclosure()).geometry.walls[0]!;
		expect(regionWallTopRangeY(level, 0.5, 1, 4)).toEqual({ minY: 3.5, maxY: 3.5 });
	});

	it('reads a gable whose apex passes through a canopy as crossing, and a level Wall as meeting', () => {
		const base = enclosure();
		const wallId = southWallId(base);
		// The canopy underside sits at 4: above the 3 m eave, below the 5 m apex.
		const { document: levelDocument, regionId } = canopy(base, [[3, -1], [7, -1], [7, 1], [3, 1]], 4);
		expect(readingOf(levelDocument, regionId, wallId)).toMatchObject({ reading: 'gap', measureAxis: 'vertical' });
		const gabled = withTop(levelDocument, wallId, GABLE);
		expect(readingOf(gabled, regionId, wallId)).toMatchObject({ planClass: 'through', reading: 'crosses' });
	});

	it('reads the top only over the covered stations', () => {
		const base = enclosure();
		const wallId = southWallId(base);
		// Canopy over stations 0.5..2.5 only: the gable top there is at most 4, below the underside at 4.5
		// even though the apex (5 m at station 5) would cross it.
		const { document: levelDocument, regionId } = canopy(base, [[0.5, -1], [2.5, -1], [2.5, 1], [0.5, 1]], 4.5);
		const gabled = withTop(levelDocument, wallId, GABLE);
		expect(readingOf(gabled, regionId, wallId)).toMatchObject({ reading: 'gap', measureAxis: 'vertical' });
		expect(readingOf(gabled, regionId, wallId).measureMeters!).toBeCloseTo(0.5, 6);
	});

	// A concave canopy covers stations 1..3 and 7..9 of the south gable, joined by a
	// bridge south of the Wall; the apex (5 m at station 5) lies outside the
	// footprint. Each covered interval peaks at 4.2 m, so reading their continuous
	// hull would wrongly reach the apex.
	const U_CANOPY: LayoutVec2[] = [[1, -3], [9, -3], [9, 1], [7, 1], [7, -2], [3, -2], [3, 1], [1, 1]];

	it('reads a concave canopy over each covered interval, never their hull through the apex', () => {
		const base = enclosure();
		const wallId = southWallId(base);
		const { document, regionId } = canopy(withTop(base, wallId, GABLE), U_CANOPY, 4.5);
		const relation = readingOf(document, regionId, wallId);
		expect(relation).toMatchObject({ planClass: 'through', reading: 'gap', measureAxis: 'vertical' });
		expect(relation.measureMeters!).toBeCloseTo(0.3, 9);
		expect(relation.measureSegment!.from[1]).toBeCloseTo(4.2, 9);
	});

	it('Fit roof over a concave canopy reaches the covered intervals, not the uncovered apex', () => {
		const base = enclosure();
		const wallId = southWallId(base);
		const { document, regionId } = canopy(withTop(base, wallId, GABLE), U_CANOPY, 6);
		const geometry = compileWallFirstLayoutGeometryFresh(document).geometry;
		const plan = planFitRegionToWalls(document, geometry, regionId, [wallId]);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.regions.find((entry) => entry.id === regionId)!.elevation).toBeCloseTo(4.2, 9);
	});

	it.each([
		['rising', SLOPE],
		['falling', { kind: 'slope', startRise: 2, endRise: 0 } as LayoutWallTop]
	] as const)('reads an edge canopy along a %s face over the whole contact, not one contact point', (_name, top) => {
		const base = enclosure();
		const wallId = southWallId(base);
		const sloped = withTop(base, wallId, top);
		const compiled = compileWallFirstLayoutGeometryFresh(sloped).geometry.walls.find((entry) => entry.wallId === wallId)!;
		const face = -compiled.thickness / 2;
		// The canopy boundary lies on the outer face over stations 1..9, where the
		// slope spans 3.2 m to 4.8 m; its underside at 5 m leaves a 0.2 m gap.
		const footprint: LayoutVec2[] = [[1, -3], [9, -3], [9, face], [1, face]];
		const { document, regionId } = canopy(sloped, footprint, 5);
		const relation = readingOf(document, regionId, wallId);
		expect(relation).toMatchObject({ planClass: 'edge', reading: 'gap', measureAxis: 'vertical' });
		expect(relation.measureMeters!).toBeCloseTo(0.2, 9);
		const geometry = compileWallFirstLayoutGeometryFresh(document).geometry;
		const plan = planFitRegionToWalls(document, geometry, regionId, [wallId]);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.regions.find((entry) => entry.id === regionId)!.elevation).toBeCloseTo(4.8, 9);
	});

	it('Fit roof reaches the apex of a covered gable', () => {
		const base = enclosure();
		const wallId = southWallId(base);
		const { document, regionId } = canopy(withTop(base, wallId, GABLE), [[3, -1], [7, -1], [7, 1], [3, 1]], 6);
		const geometry = compileWallFirstLayoutGeometryFresh(document).geometry;
		const plan = planFitRegionToWalls(document, geometry, regionId, [wallId]);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.regions.find((entry) => entry.id === regionId)!.elevation).toBeCloseTo(5, 9);
	});

	it('Fit walls to roof refuses a profiled Wall whole, naming it, and leaves the document unchanged', () => {
		const base = enclosure();
		const wallId = southWallId(base);
		const { document, regionId } = canopy(withTop(base, wallId, SLOPE), [[-1, -1], [11, -1], [11, 1], [-1, 1]], 3.5);
		const geometry = compileWallFirstLayoutGeometryFresh(document).geometry;
		expectUnchanged(document, () => {
			const plan = planFitWallsToRegion(document, geometry, regionId, [wallId]);
			expect(plan.kind).toBe('rejected');
			if (plan.kind !== 'rejected') return;
			expect(plan.rejection.code).toBe(WALL_TOP_PROFILE_UNSUPPORTED_CODE);
			expect(plan.rejection.message).toContain(`'${wallId}'`);
			expect(plan.rejection.targetIds).toContain(wallId);
		});
		expect(validateWallFirstLayoutDocument(document).success).toBe(true);
	});

	it('Fit walls to roof still fits a level Wall', () => {
		const base = enclosure();
		const wallId = southWallId(base);
		const { document, regionId } = canopy(base, [[-1, -1], [11, -1], [11, 1], [-1, 1]], 3.5);
		const geometry = compileWallFirstLayoutGeometryFresh(document).geometry;
		const plan = planFitWallsToRegion(document, geometry, regionId, [wallId]);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.walls.find((entry) => entry.id === wallId)!.height).toBeCloseTo(3.5, 9);
	});
});
