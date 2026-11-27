/**
 * T1 V2a — the certified delta path reads the Wall top exactly as the cold path.
 *
 * A retained Wall evaluated by a copy-on-write delta must carry the same
 * profile, sections, bounds, cache key and top issues as
 * `compileWallFirstLayoutGeometryFresh`, for slope and gable Walls, after a
 * Junction move on the profiled Wall, a Junction move on a neighbour and a
 * height edit. Each case also proves the delta path actually ran.
 */
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometryFresh,
	createLayoutCompileSession,
	type LayoutVec2
} from '@portfolio/layout-core/geometry';
import {
	cowMoveJunctions,
	cowSetWallScalar,
	ensureLayoutWorldIndex
} from '@portfolio/layout-core/world';
import {
	createEmptyWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutWall,
	type LayoutWallOpening,
	type LayoutWallTop
} from '@portfolio/layout-core/wall';

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

function documentOf(top: LayoutWallTop, openings: readonly LayoutWallOpening[] = []): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	const points: Record<string, LayoutVec2> = { a: [0, 0], b: [10, 0], c: [10, 6], d: [0, 6] };
	for (const [id, point] of Object.entries(points)) document.junctions.push({ id, point });
	document.walls.push(
		wall('w1', 'a', 'b', { top }),
		wall('w2', 'b', 'c'),
		wall('w3', 'c', 'd', { height: 2.5 })
	);
	document.openings.push(...openings);
	return document;
}

const SLOPE: LayoutWallTop = { kind: 'slope', startRise: 0, endRise: 2 };
const GABLE: LayoutWallTop = { kind: 'gable', startRise: 0, endRise: 0, apexRise: 2, apexOffset: 5 };

function expectParity(session: ReturnType<typeof createLayoutCompileSession>, candidate: LayoutDocumentWallFirst) {
	const compiled = session.compile(candidate);
	// The delta path ran: not a cold compile, and untouched Walls were reused.
	expect(session.stats().cold).toBe(false);
	expect(session.stats().wallsReused).toBeGreaterThan(0);
	const fresh = compileWallFirstLayoutGeometryFresh(candidate);
	expect(compiled.geometry.walls).toEqual(fresh.geometry.walls);
	expect(compiled.geometry.junctions).toEqual(fresh.geometry.junctions);
	expect(compiled.issues).toEqual(fresh.issues);
	expect(compiled.geometry.bounds).toEqual(fresh.geometry.bounds);
	return { compiled, fresh };
}

describe.each([
	['slope', SLOPE],
	['gable', GABLE]
] as const)('V2a · the delta path reads a %s Wall top like the cold path', (_name, top) => {
	const fresh = (document: LayoutDocumentWallFirst) => {
		const session = createLayoutCompileSession();
		session.compile(document);
		ensureLayoutWorldIndex(document);
		return session;
	};

	it('keeps profile, sections and bounds after a Junction move on the profiled Wall', () => {
		const base = documentOf(top);
		const session = fresh(base);
		// Keep the length close so a gable apex at 5 stays inside the Wall.
		const moved = cowMoveJunctions(base, new Map([['b', [9, 0] as LayoutVec2]]), ['w1', 'w2'], ensureLayoutWorldIndex(base));
		const { compiled } = expectParity(session, moved);
		const w1 = compiled.geometry.walls.find((candidate) => candidate.wallId === 'w1')!;
		expect(w1.topProfile).toBeDefined();
		expect(w1.bounds3.max[1]).toBe(5);
		expect(Math.max(...w1.sections.map((section) => section.topY))).toBe(5);
	});

	it('keeps the profile on the retained Wall when a neighbour Junction moves', () => {
		const base = documentOf(top);
		const session = fresh(base);
		const moved = cowMoveJunctions(base, new Map([['c', [10, 7] as LayoutVec2]]), ['w2', 'w3'], ensureLayoutWorldIndex(base));
		const { compiled } = expectParity(session, moved);
		const w1 = compiled.geometry.walls.find((candidate) => candidate.wallId === 'w1')!;
		expect(w1.topProfile).toBeDefined();
		expect(w1.bounds3.max[1]).toBe(5);
	});

	it('shifts the whole top rigidly on a height edit', () => {
		const base = documentOf(top);
		const session = fresh(base);
		const edited = cowSetWallScalar(base, 'w1', { height: 2.5 }, ensureLayoutWorldIndex(base));
		const { compiled } = expectParity(session, edited);
		const w1 = compiled.geometry.walls.find((candidate) => candidate.wallId === 'w1')!;
		expect(w1.topProfile!.at(-1)!.topY).toBe(2.5 + (top.kind === 'slope' ? 2 : 0));
		expect(w1.bounds3.max[1]).toBe(4.5);
	});

	it('reports a gable apex that leaves the Wall, like the cold path', () => {
		if (top.kind !== 'gable') return;
		const base = documentOf(top);
		const session = fresh(base);
		const shrunk = cowMoveJunctions(base, new Map([['b', [4, 0] as LayoutVec2]]), ['w1', 'w2'], ensureLayoutWorldIndex(base));
		const { compiled } = expectParity(session, shrunk);
		expect(compiled.issues.map((issue) => issue.code)).toContain('wall_top_apex_outside');
	});

	it('keeps an Opening above the eave on the profiled Wall', () => {
		const base = documentOf(top, [
			{ id: 'o1', wallId: 'w1', kind: 'window', offset: 6, width: 1, height: 0.5, sillHeight: 3.2, profile: 'rectangular' } as LayoutWallOpening
		]);
		const session = fresh(base);
		const moved = cowMoveJunctions(base, new Map([['c', [10, 7] as LayoutVec2]]), ['w2', 'w3'], ensureLayoutWorldIndex(base));
		expectParity(session, moved);
	});
});
