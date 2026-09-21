/**
 * P23.15 correction pass — Junction partition, ownership and curved-Junction
 * regressions.
 *
 * These tests pin the corrected contract:
 *
 * ```text
 * layout-core solves the Junction (partition, difference surfaces, interfaces)
 * builders only triangulate what was resolved
 * no Wall-owned body overlaps another at the Junction
 * ```
 *
 * Every fixture compiles through `compileWallFirstLayoutGeometry` and is checked
 * against independent oracles (authored boxes + per-mesh ray parity), never by
 * re-reading the production partition.
 */
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	deriveChainSpans,
	legJoinsByWall,
	type CompiledJunctionSurface,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall
} from '@portfolio/layout-core';
import { buildStandaloneWallMesh as buildEditorWallMesh } from '$lib/layout/wall-mesh-builder';
import { buildStandaloneWallMesh as buildMuseumWallMesh } from '../../../../museum/src/lib/layout/wall-mesh-builder';
import {
	assertUnionCoverageAtJunction,
	assertUnionManifoldWithBoundary,
	assertVerticesWithinBounds,
	assertWallOwnershipAtJunction,
	type StraightWallBox
} from '../../helpers/wall-mesh-fixtures';

type WallSeed = {
	id: string;
	start: [string, LayoutVec2];
	end: [string, LayoutVec2];
	thickness?: number;
	height?: number;
	role?: 'boundary' | 'partition';
	/** Cubic-chain interior knots; the endpoints come from the junction points. */
	knots?: LayoutVec2[];
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
		walls: walls.map((wall): LayoutWall => {
			const start = junctionById.get(wall.start[0])!;
			const end = junctionById.get(wall.end[0])!;
			const centerline =
				wall.knots && wall.knots.length > 0
					? {
							kind: 'cubic-chain' as const,
							knots: wall.knots.map((point, index) => ({ id: `${wall.id}-k${index}`, point })),
							spans: deriveChainSpans([start, ...wall.knots, end])
						}
					: ({ kind: 'line' } as const);
			return {
				id: wall.id,
				startJunctionId: wall.start[0],
				endJunctionId: wall.end[0],
				role: wall.role ?? 'partition',
				thickness: wall.thickness ?? 0.2,
				height: wall.height ?? 3,
				centerline
			} as LayoutWall;
		}),
		rooms: [],
		openings: (walls.flatMap((wall) =>
			wall.opening
				? [
						{
							...wall.opening,
							wallId: wall.id,
							kind: 'door' as const,
							sillHeight: 0,
							profile: 'rectangular' as const
						}
					]
				: []
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
	const meshes: ReturnType<typeof buildEditorWallMesh>[] = [];
	for (const wall of compilation.geometry.walls) {
		const resolved = ends.get(wall.wallId) ?? { start: null, end: null };
		const editor = buildEditorWallMesh(wall, documentValue.floor.elevation, resolved);
		const museum = buildMuseumWallMesh(wall, documentValue.floor.elevation, resolved);
		expect(editor.issues, `${wall.wallId} editor`).toEqual([]);
		expect(museum.issues, `${wall.wallId} museum`).toEqual([]);
		// (e) the two copies are byte-identical for the same fixture.
		expect([...editor.mesh!.positions]).toEqual([...museum.mesh!.positions]);
		expect([...editor.mesh!.indices]).toEqual([...museum.mesh!.indices]);
		meshes.push(editor);
	}
	const union = meshes.map((entry) => entry.mesh!);
	assertUnionManifoldWithBoundary(union);
	return { compilation, meshes, union };
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

function junctionOf(compilation: ReturnType<typeof compileWallFirstLayoutGeometry>, junctionId: string) {
	return compilation.geometry.junctions!.find((entry) => entry.junctionId === junctionId)!;
}

function surfacesOf(compilation: ReturnType<typeof compileWallFirstLayoutGeometry>): Map<string, CompiledJunctionSurface[]> {
	const map = new Map<string, CompiledJunctionSurface[]>();
	for (const wall of compilation.geometry.walls) {
		const ends = legJoinsByWall(compilation.geometry.junctions).get(wall.wallId);
		const surfaces = [...(ends?.start?.surfaces ?? []), ...(ends?.end?.surfaces ?? [])];
		if (surfaces.length > 0) map.set(wall.wallId, surfaces);
	}
	return map;
}

describe('P23.15 correction — Junction partition and curved Junctions', () => {
	it('keeps a cubic/cubic tangent continuation as one suppressed Junction (C)', () => {
		// One chain, split at J into two canonical Walls: the compiled end
		// tangents match exactly, so this must resolve as a continuation with no
		// seam, no difference surface and no internal cap.
		const chain: LayoutVec2[] = [
			[-4, 0],
			[-2, 0.6],
			[0, 0],
			[2, -0.6],
			[4, 0]
		];
		const spans = deriveChainSpans(chain);
		const junctionById = new Map<string, LayoutVec2>([
			['ja', chain[0]!],
			['j', chain[2]!],
			['jb', chain[4]!]
		]);
		const documentValue: LayoutDocumentWallFirst = {
			units: 'meters',
			formatVersion: 5,
			floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
			junctions: [...junctionById].map(([id, point]) => ({ id, point })),
			walls: [
				{
					id: 'w1',
					startJunctionId: 'ja',
					endJunctionId: 'j',
					role: 'partition',
					thickness: 0.2,
					height: 3,
					centerline: {
						kind: 'cubic-chain',
						knots: [{ id: 'k1', point: chain[1]! }],
						spans: [spans[0]!, spans[1]!]
					}
				},
				{
					id: 'w2',
					startJunctionId: 'j',
					endJunctionId: 'jb',
					role: 'partition',
					thickness: 0.2,
					height: 3,
					centerline: {
						kind: 'cubic-chain',
						knots: [{ id: 'k2', point: chain[3]! }],
						spans: [spans[2]!, spans[3]!]
					}
				}
			],
			rooms: [],
			openings: [],
			objects: []
		} as LayoutDocumentWallFirst;
		const { compilation, union } = buildUnion(documentValue);
		const junction = junctionOf(compilation, 'j');
		expect(junction.legs).toHaveLength(2);
		expect(junction.resolution.joins.every((join) => join.kind === 'suppressed')).toBe(true);
		expect(junction.resolution.joins.every((join) => join.corner === null)).toBe(true);
		expect(junction.resolution.joins.every((join) => (join.surfaces ?? []).length === 0)).toBe(true);
		for (const mesh of union) {
			expect(mesh.pickRanges.some((range) => range.kind === 'wall' && range.surface === 'bridge')).toBe(false);
		}
	});

	it('keeps a straight/cubic tangent continuation (D)', () => {
		const documentValue = scene([
			{ id: 'w1', start: ['ja', [-4, 0]], end: ['j', [0, 0]] },
			// Start tangent along +X (the straight leg's direction), then curving.
			{ id: 'w2', start: ['j', [0, 0]], end: ['jb', [4, 1]], knots: [[2, 0]] }
		]);
		const { compilation } = buildUnion(documentValue);
		const junction = junctionOf(compilation, 'j');
		expect(junction.resolution.joins.every((join) => join.kind === 'suppressed')).toBe(true);
		expect(junction.resolution.joins.every((join) => join.corner === null)).toBe(true);
	});

	it('resolves a curved hard turn from the compiled end tangent', () => {
		const documentValue = scene([
			{ id: 'w1', start: ['ja', [-4, 0]], end: ['j', [0, 0]] },
			// Start tangent leaves at a real angle: a visible bend, not a continuation.
			{ id: 'w2', start: ['j', [0, 0]], end: ['jb', [4, 2]], knots: [[0.5, 2]] }
		]);
		const { compilation, union, meshes } = buildUnion(documentValue);
		const junction = junctionOf(compilation, 'j');
		expect(junction.resolution.joins.some((join) => join.kind === 'miter' || join.kind === 'bevel')).toBe(true);
		expect(junction.resolution.joins.some((join) => join.ownedSeam !== null)).toBe(true);
		const bounds = compilation.geometry.bounds!;
		for (const mesh of union) assertVerticesWithinBounds(mesh, bounds);
		for (const entry of meshes) {
			const wall = compilation.geometry.walls.find((candidate) => candidate.wallId === entry.mesh!.roomId)!;
			assertVerticesWithinBounds(entry.mesh!, wall.bounds3);
		}
	});

	it('trims a curved branch against the resolved through material (T + curve)', () => {
		const documentValue = scene([
			{ id: 'wa', start: ['ja', [-4, 0]], end: ['j', [0, 0]] },
			{ id: 'wb', start: ['j', [0, 0]], end: ['jb', [4, 0]] },
			{ id: 'ws', start: ['j', [0, 0]], end: ['js', [0.8, 4]], knots: [[0.2, 2]] }
		]);
		const { compilation, union } = buildUnion(documentValue);
		const junction = junctionOf(compilation, 'j');
		const through = junction.resolution.joins.filter((join) => join.kind === 'suppressed');
		const branch = junction.resolution.joins.find((join) => join.wallId === 'ws')!;
		expect(through.map((join) => join.wallId).sort()).toEqual(['wa', 'wb']);
		// The branch's own material starts where the through strip ends.
		expect(branch.interfaceSuppressed).toBe(true);
		expect(branch.clipDistance!).toBeGreaterThan(0.05);
		expect(branch.clipDistance!).toBeLessThan(0.2);
		// No Wall-owned body occupies the through Wall's volume.
		const boxes = boxesOf(documentValue);
		const result = assertWallOwnershipAtJunction(union, {
			center: [0, 0],
			radius: 0.5,
			step: 0.05,
			margin: 0.04,
			heights: [0.5, 1.5, 2.6],
			walls: [boxes[0]!, boxes[1]!]
		});
		expect(result.samples).toBeGreaterThan(20);
	});

	it('partitions a T so no Wall-owned body interpenetrates another', () => {
		for (const stemThickness of [0.1, 0.2, 0.35]) {
			const documentValue = scene([
				{ id: 'wa', start: ['ja', [-4, 0]], end: ['j', [0, 0]] },
				{ id: 'wb', start: ['j', [0, 0]], end: ['jb', [4, 0]] },
				{ id: 'ws', start: ['j', [0, 0]], end: ['js', [0, 4]], thickness: stemThickness }
			]);
			const { compilation, union } = buildUnion(documentValue);
			const junction = junctionOf(compilation, 'j');
			const branch = junction.resolution.joins.find((join) => join.wallId === 'ws')!;
			expect(branch.clipDistance, `stem ${stemThickness}`).toBeCloseTo(0.1, 6);
			assertWallOwnershipAtJunction(union, {
				center: [0, 0],
				radius: 0.5,
				step: 0.05,
				margin: 0.04,
				heights: [0.5, 1.5, 2.6],
				walls: boxesOf(documentValue)
			});
			assertUnionCoverageAtJunction(union, {
				center: [0, 0],
				radius: 0.6,
				step: 0.05,
				margin: 0.04,
				extension: 0.4,
				heights: [0.4, 1.5, 2.6],
				walls: boxesOf(documentValue)
			});
		}
	});

	it('partitions an X junction so each Wall owns its own material', () => {
		const documentValue = scene([
			{ id: 'wa', start: ['ja', [-4, 0]], end: ['j', [0, 0]] },
			{ id: 'wb', start: ['j', [0, 0]], end: ['jb', [4, 0]] },
			{ id: 'wc', start: ['j', [0, 0]], end: ['jc', [0, 4]] },
			{ id: 'wd', start: ['j', [0, 0]], end: ['jd', [0, -4]] }
		]);
		const { compilation, union } = buildUnion(documentValue);
		const junction = junctionOf(compilation, 'j');
		const trims = junction.resolution.joins.filter((join) => join.kind === 'trim');
		expect(trims).toHaveLength(2);
		for (const trim of trims) expect(trim.clipDistance).toBeCloseTo(0.1, 6);
		assertWallOwnershipAtJunction(union, {
			center: [0, 0],
			radius: 0.5,
			step: 0.05,
			margin: 0.04,
			heights: [0.5, 1.5, 2.6],
			walls: boxesOf(documentValue)
		});
	});

	it('buries a continuation thickness step in the bands a covering branch lacks', () => {
		// through A: height 3 — through B: same height, thicker — branch: height 1.
		// The step exists in the branch's vertical range too (the branch does not
		// reach it) but is *exposed* above the branch's top, so the step must be
		// split per band rather than decided from the plan footprint alone.
		const documentValue = scene([
			{ id: 'wa', start: ['ja', [-4, 0]], end: ['j', [0, 0]] },
			{ id: 'wb', start: ['j', [0, 0]], end: ['jb', [4, 0]], thickness: 0.3 },
			{ id: 'ws', start: ['j', [0, 0]], end: ['js', [0, 4]], thickness: 0.5, height: 1 }
		]);
		const { compilation } = buildUnion(documentValue);
		const junction = junctionOf(compilation, 'j');
		const step = (surfacesOf(compilation).get('wb') ?? []).filter(
			(surface) => surface.kind === 'continuation-thickness-step'
		);
		expect(step.length).toBeGreaterThan(0);
		// Above the branch's top the step is exposed even though the branch covers
		// its plan footprint below 1 m.
		expect(step.some((surface) => surface.bands.some((band) => band.topY > 1))).toBe(true);
	});

	it('changes the Junction cache key when an endpoint Opening profile changes', () => {
		const baseline = scene([
			{ id: 'wa', start: ['ja', [-4, 0]], end: ['j', [0, 0]] },
			{ id: 'wb', start: ['j', [0, 0]], end: ['jb', [4, 0]] },
			{ id: 'ws', start: ['j', [0, 0]], end: ['js', [0, 4]], opening: { id: 'door', offset: 0, width: 0.9, height: 2.1 } }
		]);
		const taller = structuredClone(baseline);
		taller.openings[0]!.height = 2.4;
		const first = compileWallFirstLayoutGeometry(baseline).geometry.junctions!.find((entry) => entry.junctionId === 'j')!;
		const second = compileWallFirstLayoutGeometry(taller).geometry.junctions!.find((entry) => entry.junctionId === 'j')!;
		// Stable logical identity, changed relevant-input identity.
		expect(second.id).toBe(first.id);
		expect(second.cacheKey).not.toBe(first.cacheKey);
		// The endpoint Opening band really did change.
		const legOf = (junction: typeof first) => junction.legs.find((leg) => leg.wallId === 'ws')!;
		expect(legOf(second).endpointOpen).toBe(true);
		expect(JSON.stringify(legOf(second).endpointSolidBands)).not.toBe(
			JSON.stringify(legOf(first).endpointSolidBands)
		);
	});

	it('keeps Wall attribution identical when the canonical Wall array is reordered', () => {
		for (const startHeight of [1.2, 3]) {
			const endHeight = startHeight === 1.2 ? 3 : 1.2;
			const walls: WallSeed[] = [
				{ id: 'w1', start: ['ja', [-4, 0]], end: ['j', [0, 0]], height: startHeight, thickness: 0.2 },
				{ id: 'w2', start: ['j', [0, 0]], end: ['jb', [4, 0]], height: endHeight, thickness: 0.3 }
			];
			const forward = surfacesOf(compileWallFirstLayoutGeometry(scene(walls)));
			const reversed = surfacesOf(compileWallFirstLayoutGeometry(scene([...walls].reverse())));
			for (const [wallId, surfaces] of forward) {
				expect(JSON.stringify(reversed.get(wallId)), `${wallId} ${startHeight}`).toBe(JSON.stringify(surfaces));
			}
			// The thickness step is always owned by the thicker leg, whichever side
			// it starts on, and a sole-solid band cap by the leg solid in that band.
			const allSurfaces = [...forward.values()].flat();
			for (const surface of allSurfaces.filter((entry) => entry.kind === 'continuation-thickness-step')) {
				expect(surface.ownerWallId, `${startHeight} thickness step`).toBe('w2');
			}
			const caps = allSurfaces.filter((entry) => entry.kind === 'continuation-height-step');
			for (const cap of caps) {
				const owner = walls.find((wall) => wall.id === cap.ownerWallId)!;
				for (const band of cap.bands) {
					expect(band.topY, `${startHeight} cap band`).toBeLessThanOrEqual(owner.height! + 1e-9);
				}
			}
		}
	});

	it('keeps every emitted vertex inside the owner Wall, Floor and document bounds', () => {
		// Acute-angle, mixed-thickness fixture: the resolved miter genuinely reaches
		// beyond the sampled centerline ± half-thickness box.
		const documentValue = scene([
			{ id: 'w1', start: ['ja', [-4, 0]], end: ['j', [0, 0]], thickness: 0.3 },
			{ id: 'w2', start: ['j', [0, 0]], end: ['jb', [3.6, 1.2]], thickness: 0.2 },
			{ id: 'w3', start: ['j', [0, 0]], end: ['jc', [0, 4]] }
		]);
		const { compilation, meshes } = buildUnion(documentValue);
		const documentBounds = compilation.geometry.bounds!;
		const floorBounds = compilation.geometry.floors[0]!.bounds3!;
		expect(documentBounds).not.toBeNull();
		for (const entry of meshes) {
			const wall = compilation.geometry.walls.find((candidate) => candidate.wallId === entry.mesh!.roomId)!;
			assertVerticesWithinBounds(entry.mesh!, wall.bounds3);
			assertVerticesWithinBounds(entry.mesh!, floorBounds);
			assertVerticesWithinBounds(entry.mesh!, documentBounds);
		}
		// The wall query AABB is reconciled with the final bounds, not the stale
		// pre-resolution record.
		for (const wall of compilation.geometry.walls) {
			const record = compilation.geometry.queries.aabbs.find(
				(candidate) => candidate.kind === 'wall' && candidate.sourceId === wall.wallId
			)!;
			expect(record.aabb.min[0]).toBeCloseTo(wall.bounds3.min[0], 9);
			expect(record.aabb.min[1]).toBeCloseTo(wall.bounds3.min[2], 9);
			expect(record.aabb.max[0]).toBeCloseTo(wall.bounds3.max[0], 9);
			expect(record.aabb.max[1]).toBeCloseTo(wall.bounds3.max[2], 9);
		}
	});
});
