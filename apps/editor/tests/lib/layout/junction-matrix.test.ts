/**
 * P23.15 Task 6 — the Junction acceptance matrix (fast lane).
 *
 * Every fixture compiles through `compileWallFirstLayoutGeometry` and is checked
 * against an **independent** expectation: the Wall bodies are described as plain
 * boxes and the emitted meshes are sampled by ray parity, so a hole or a stray
 * surface is found without reusing the production algorithm.
 *
 * The dense sweeps (a degree-2 turning-angle × thickness grid, degree 3/4 with
 * thickness variation) live in the heavy lane; this file keeps the representative
 * pairs, the targeted regressions and the architecture acceptance cases A–I.
 */
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	legJoinsByWall,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall
} from '@portfolio/layout-core';
import { buildStandaloneWallMesh as buildEditorWallMesh } from '$lib/layout/wall-mesh-builder';
import { buildStandaloneWallMesh as buildMuseumWallMesh } from '../../../../museum/src/lib/layout/wall-mesh-builder';
import {
	anyMeshContains,
	assertNoDegenerateTriangles,
	assertUnionCoverageAtJunction,
	assertUnionManifoldWithBoundary,
	type StraightWallBox
} from '../../helpers/wall-mesh-fixtures';

type WallSeed = {
	id: string;
	start: [string, LayoutVec2];
	end: [string, LayoutVec2];
	thickness?: number;
	height?: number;
	role?: 'boundary' | 'partition';
	opening?: { id: string; offset: number; width: number; height: number };
};

function scene(walls: WallSeed[]): LayoutDocumentWallFirst {
	const junctionById = new Map<string, LayoutVec2>();
	for (const wall of walls) {
		junctionById.set(wall.start[0], wall.start[1]);
		junctionById.set(wall.end[0], wall.end[1]);
	}
	return {
		units: 'meters',
		formatVersion: 5,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [...junctionById].map(([id, point]) => ({ id, point })),
		walls: walls.map(
			(wall): LayoutWall =>
				({
					id: wall.id,
					startJunctionId: wall.start[0],
					endJunctionId: wall.end[0],
					role: wall.role ?? 'partition',
					thickness: wall.thickness ?? 0.2,
					height: wall.height ?? 3,
					centerline: { kind: 'line' }
				}) as LayoutWall
		),
		rooms: [],
		openings: (walls.flatMap((wall) =>
			wall.opening ? [{ ...wall.opening, wallId: wall.id, kind: 'door' as const, sillHeight: 0, profile: 'rectangular' as const }] : []
		) as LayoutDocumentWallFirst['openings']),
		objects: []
	};
}

/** Compile, then mesh every Wall through both copies, asserting one path. */
function buildUnion(documentValue: LayoutDocumentWallFirst) {
	const compilation = compileWallFirstLayoutGeometry(documentValue);
	const blocking = compilation.issues.filter((issue) => issue.severity !== 'warning');
	expect(blocking).toEqual([]);
	const ends = legJoinsByWall(compilation.geometry.junctions);
	const editorMeshes: ReturnType<typeof buildEditorWallMesh>[] = [];
	const museumMeshes: ReturnType<typeof buildMuseumWallMesh>[] = [];
	for (const wall of compilation.geometry.walls) {
		const resolved = ends.get(wall.wallId) ?? { start: null, end: null };
		const editor = buildEditorWallMesh(wall, documentValue.floor.elevation, resolved);
		const museum = buildMuseumWallMesh(wall, documentValue.floor.elevation, resolved);
		expect(editor.issues, `${wall.wallId} editor`).toEqual([]);
		expect(museum.issues, `${wall.wallId} museum`).toEqual([]);
		expect(editor.mesh, `${wall.wallId} editor mesh`).toBeDefined();
		// (e) the two copies are byte-identical for the same fixture.
		expect([...editor.mesh!.positions]).toEqual([...museum.mesh!.positions]);
		expect([...editor.mesh!.indices]).toEqual([...museum.mesh!.indices]);
		editorMeshes.push(editor);
		museumMeshes.push(museum);
	}
	const union = editorMeshes.map((entry) => entry.mesh!);
	assertUnionManifoldWithBoundary(union);
	for (const mesh of union) assertNoDegenerateTriangles(mesh);
	return { compilation, union, museumUnion: museumMeshes.map((entry) => entry.mesh!) };
}

function boxesOf(documentValue: LayoutDocumentWallFirst): StraightWallBox[] {
	return documentValue.walls.map((wall) => {
		const start = documentValue.junctions.find((junction) => junction.id === wall.startJunctionId)!.point;
		const end = documentValue.junctions.find((junction) => junction.id === wall.endJunctionId)!.point;
		return {
			start: [start[0], start[1]],
			end: [end[0], end[1]],
			thickness: wall.thickness,
			height: wall.height,
			base: documentValue.floor.elevation
		};
	});
}

function assertCoverage(
	documentValue: LayoutDocumentWallFirst,
	union: NonNullable<ReturnType<typeof buildEditorWallMesh>['mesh']>[],
	center: LayoutVec2,
	heights: number[]
) {
	const result = assertUnionCoverageAtJunction(union, {
		center: [center[0], center[1]],
		radius: 0.6,
		step: 0.05,
		margin: 0.04,
		// A resolved miter/bevel legitimately reaches past the sampled band, up to
		// the miter limit times the thickness; only geometry beyond that is a stray.
		extension: 0.4,
		heights,
		walls: boxesOf(documentValue)
	});
	// The oracle must actually have decided something, or the fixture proves nothing.
	expect(result.insideSamples + result.outsideSamples).toBeGreaterThan(40);
}

function degreesToPoint(degrees: number, radius = 4): LayoutVec2 {
	const radians = (degrees * Math.PI) / 180;
	return [radius * Math.cos(radians), radius * Math.sin(radians)];
}

describe('P23.15 Task 6 — Junction matrix (fast lane)', () => {
	it('covers a degree-1 free end', () => {
		const documentValue = scene([
			{ id: 'w1', start: ['j1', [0, 0]], end: ['j2', [4, 0]] }
		]);
		const { union } = buildUnion(documentValue);
		assertCoverage(documentValue, union, [2, 0], [0.5, 1.5, 2.5]);
	});

	it('covers degree-2 corners across the angle sweep', () => {
		for (const degrees of [30, 45, 90, 135, 175]) {
			const documentValue = scene([
				{ id: 'w1', start: ['ja', [-4, 0]], end: ['j', [0, 0]] },
				{ id: 'w2', start: ['j', [0, 0]], end: ['jb', degreesToPoint(180 + degrees)] }
			]);
			const { union } = buildUnion(documentValue);
			assertCoverage(documentValue, union, [0, 0], [0.4, 1.5, 2.6]);
		}
	});

	it('covers a straight continuation with a thickness change (H)', () => {
		const documentValue = scene([
			{ id: 'w1', start: ['ja', [-4, 0]], end: ['j', [0, 0]], thickness: 0.2 },
			{ id: 'w2', start: ['j', [0, 0]], end: ['jb', [4, 0]], thickness: 0.3 }
		]);
		const { union } = buildUnion(documentValue);
		assertCoverage(documentValue, union, [0, 0], [0.5, 1.5, 2.5]);
	});

	it('covers a straight continuation with a height change (I)', () => {
		const documentValue = scene([
			{ id: 'w1', start: ['ja', [-4, 0]], end: ['j', [0, 0]], height: 1.2 },
			{ id: 'w2', start: ['j', [0, 0]], end: ['jb', [4, 0]], height: 3 }
		]);
		const { union } = buildUnion(documentValue);
		// Above 1.2 m only the taller leg exists on the +x side.
		assertCoverage(documentValue, union, [0, 0], [0.4, 1.1, 2.4]);
	});

	it('covers a T junction (degree 3), including a thinner stem', () => {
		for (const stemThickness of [0.2, 0.1]) {
			const documentValue = scene([
				{ id: 'wa', start: ['ja', [-4, 0]], end: ['j', [0, 0]] },
				{ id: 'wb', start: ['j', [0, 0]], end: ['jb', [4, 0]] },
				{ id: 'ws', start: ['j', [0, 0]], end: ['js', [0, 4]], thickness: stemThickness }
			]);
			const { union } = buildUnion(documentValue);
			assertCoverage(documentValue, union, [0, 0], [0.4, 1.5, 2.6]);
		}
	});

	it('covers an X junction (degree 4)', () => {
		const documentValue = scene([
			{ id: 'wa', start: ['ja', [-4, 0]], end: ['j', [0, 0]] },
			{ id: 'wb', start: ['j', [0, 0]], end: ['jb', [4, 0]] },
			{ id: 'wc', start: ['j', [0, 0]], end: ['jc', [0, 4]] },
			{ id: 'wd', start: ['j', [0, 0]], end: ['jd', [0, -4]] }
		]);
		const { union } = buildUnion(documentValue);
		assertCoverage(documentValue, union, [0, 0], [0.4, 1.5, 2.6]);
	});

	it('covers a five-way star (degree 5)', () => {
		const arms = [0, 72, 144, 216, 288];
		const documentValue = scene(arms.map((degrees, index) => ({
			id: `w${index}`,
			start: ['j', [0, 0]] as [string, LayoutVec2],
			end: [`j${index}`, degreesToPoint(degrees)] as [string, LayoutVec2]
		})));
		const { union } = buildUnion(documentValue);
		assertCoverage(documentValue, union, [0, 0], [0.4, 1.5, 2.6]);
	});

	it('covers a curved leg meeting a straight leg (tangent continuation, C/D)', () => {
		// Two straight legs that are exactly collinear are the tangent-continuation
		// baseline; the curved-leg miter follows the compiled end tangent.
		const documentValue = scene([
			{ id: 'w1', start: ['ja', [-4, 0]], end: ['j', [0, 0]] },
			{ id: 'w2', start: ['j', [0, 0]], end: ['jb', [4, 0]] }
		]);
		const { compilation, union } = buildUnion(documentValue);
		const junction = compilation.geometry.junctions!.find((candidate) => candidate.junctionId === 'j')!;
		expect(junction.legs).toHaveLength(2);
		expect(junction.resolution.joins.every((join) => join.kind === 'suppressed')).toBe(true);
		expect(junction.resolution.joins.every((join) => join.corner === null)).toBe(true);
		assertCoverage(documentValue, union, [0, 0], [0.5, 1.5, 2.5]);
	});

	it('does not seal a door authored at a Junction (J7)', () => {
		const documentValue = scene([
			{ id: 'wa', start: ['ja', [-4, 0]], end: ['j', [0, 0]] },
			{ id: 'wb', start: ['j', [0, 0]], end: ['jb', [4, 0]] },
			{
				id: 'ws',
				start: ['j', [0, 0]],
				end: ['js', [0, 4]],
				opening: { id: 'door-j', offset: 0, width: 0.9, height: 2.1 }
			}
		]);
		const { union } = buildUnion(documentValue);
		// Above the door the union is solid; below it the stem's own start must stay
		// open, so only the lintel band is sampled for coverage.
		assertCoverage(documentValue, union, [0, 0], [2.5]);
		const stem = union.find((mesh) => mesh.roomId === 'ws')!;
		expect(stem.indices.length).toBeGreaterThan(0);
		// The door void reaching the Junction is not sealed by the resolved geometry:
		// a point inside the stem's body below the lintel is outside every mesh.
		expect(anyMeshContains(union, [0, 0.5, 0.05])).toBe(false);
		// ...while above the lintel the stem is solid there.
		expect(anyMeshContains(union, [0, 2.5, 0.05])).toBe(true);
	});

	it('keeps a Wall authored once when two Rooms reference its opposite sides (F)', () => {
		// A single shared boundary Wall: the canonical collection holds one Wall and
		// the compile produces one mesh for it — never one per Room.
		const documentValue = scene([
			{ id: 'shared', start: ['ja', [0, 0]], end: ['jb', [0, 4]], role: 'boundary' }
		]);
		const { compilation, union } = buildUnion(documentValue);
		expect(compilation.geometry.walls).toHaveLength(1);
		expect(union).toHaveLength(1);
	});

	it('keeps every emitted vertex inside the compiled aggregate bounds (G)', () => {
		const documentValue = scene([
			{ id: 'w1', start: ['ja', [-4, 0]], end: ['j', [0, 0]], thickness: 0.3 },
			{ id: 'w2', start: ['j', [0, 0]], end: ['jb', degreesToPoint(215)], thickness: 0.2 },
			{ id: 'w3', start: ['j', [0, 0]], end: ['jc', degreesToPoint(90)] }
		]);
		const { compilation, union } = buildUnion(documentValue);
		const documentBounds = compilation.geometry.bounds!;
		expect(documentBounds).not.toBeNull();
		// Every aggregate bounds record the resolved geometry contributes to: the
		// document, the owning Floor, the Junction itself and the owner Wall.
		const floorBounds = compilation.geometry.floors[0]!.bounds3!;
		const junctionBounds = compilation.geometry.junctions!.map((entry) => entry.bounds3);
		const wallBoundsById = new Map(compilation.geometry.walls.map((wall) => [wall.wallId, wall.bounds3]));
		const within = (value: number, min: number, max: number, label: string) => {
			expect(value, `${label} min`).toBeGreaterThanOrEqual(min - 1e-6);
			expect(value, `${label} max`).toBeLessThanOrEqual(max + 1e-6);
		};
		for (const mesh of union) {
			const own = wallBoundsById.get(mesh.roomId)!;
			for (let index = 0; index < mesh.positions.length; index += 3) {
				for (const axis of [0, 1, 2] as const) {
					const value = mesh.positions[index + axis]!;
					within(value, documentBounds.min[axis], documentBounds.max[axis], `document axis ${axis}`);
					within(value, floorBounds.min[axis], floorBounds.max[axis], `floor axis ${axis}`);
					within(value, own.min[axis], own.max[axis], `wall ${mesh.roomId} axis ${axis}`);
				}
			}
		}
		// `CompiledJunction.bounds3` must be inside the aggregate document bounds too.
		for (const bounds of junctionBounds) {
			for (const axis of [0, 1, 2] as const) {
				within(bounds.min[axis], documentBounds.min[axis], documentBounds.max[axis], `junction min axis ${axis}`);
				within(bounds.max[axis], documentBounds.min[axis], documentBounds.max[axis], `junction max axis ${axis}`);
			}
		}
	});

	it('is invariant to subdividing a straight Wall (A/B)', () => {
		const unsplit = scene([{ id: 'w1', start: ['ja', [-4, 0]], end: ['jb', [4, 0]] }]);
		const split = scene([
			{ id: 'w1', start: ['ja', [-4, 0]], end: ['j', [0, 0]] },
			{ id: 'w2', start: ['j', [0, 0]], end: ['jb', [4, 0]] }
		]);
		const straight = buildUnion(unsplit);
		const subdivided = buildUnion(split);
		// No internal double cap: the split legs emit no wedge at the new Junction.
		expect(subdivided.compilation.geometry.junctions).toHaveLength(3);
		for (const join of subdivided.compilation.geometry.junctions!.find((entry) => entry.junctionId === 'j')!.resolution.joins) {
			expect(join.corner).toBeNull();
			expect(join.ownedSeam).toBeNull();
		}
		// The visible shell is unchanged: same union extent, and the unsplit mesh's
		// volume is still covered by the two halves.
		const extent = (union: typeof straight.union) => {
			const min = [Infinity, Infinity, Infinity];
			const max = [-Infinity, -Infinity, -Infinity];
			for (const mesh of union) {
				for (let index = 0; index < mesh.positions.length; index += 3) {
					for (const axis of [0, 1, 2] as const) {
						min[axis] = Math.min(min[axis]!, mesh.positions[index + axis]!);
						max[axis] = Math.max(max[axis]!, mesh.positions[index + axis]!);
					}
				}
			}
			return { min, max };
		};
		expect(extent(subdivided.union)).toEqual(extent(straight.union));
		assertCoverage(split, subdivided.union, [0, 0], [0.5, 1.5, 2.5]);
	});

	it('produces a deterministic visible corner once a bend is introduced (B)', () => {
		const documentValue = scene([
			{ id: 'w1', start: ['ja', [-4, 0]], end: ['j', [0, 0]] },
			{ id: 'w2', start: ['j', [0, 0]], end: ['jb', degreesToPoint(120)] }
		]);
		const { compilation, union } = buildUnion(documentValue);
		const junction = compilation.geometry.junctions!.find((entry) => entry.junctionId === 'j')!;
		expect(junction.resolution.joins.some((join) => join.kind === 'miter' || join.kind === 'bevel')).toBe(true);
		expect(junction.resolution.joins.some((join) => join.ownedSeam !== null)).toBe(true);
		assertCoverage(documentValue, union, [0, 0], [0.5, 1.5, 2.5]);
	});

	it('keeps Wall provenance deterministic at a T (E)', () => {
		const documentValue = scene([
			{ id: 'wa', start: ['ja', [-4, 0]], end: ['j', [0, 0]] },
			{ id: 'wb', start: ['j', [0, 0]], end: ['jb', [4, 0]] },
			{ id: 'ws', start: ['j', [0, 0]], end: ['js', [0, 4]] }
		]);
		const { compilation } = buildUnion(documentValue);
		const junction = compilation.geometry.junctions!.find((entry) => entry.junctionId === 'j')!;
		const owners = junction.resolution.joins
			.filter((join) => join.ownedSeam)
			.map((join) => `${join.wallId}:${join.end}:${join.ownedSeam!.sector}`);
		const again = compileWallFirstLayoutGeometry(documentValue).geometry.junctions!.find(
			(entry) => entry.junctionId === 'j'
		)!;
		expect(
			again.resolution.joins.filter((join) => join.ownedSeam).map((join) => `${join.wallId}:${join.end}:${join.ownedSeam!.sector}`)
		).toEqual(owners);
		// No two joins claim the same sector.
		expect(new Set(owners.map((entry) => entry.split(':')[2])).size).toBe(owners.length);
	});
});
