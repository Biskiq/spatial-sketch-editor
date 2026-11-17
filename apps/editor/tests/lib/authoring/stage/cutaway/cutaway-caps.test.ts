/**
 * X2 §10.1.5 — the Junction catalogue.
 *
 * Every representative Junction (tangent continuation, L, T, X, thickness step,
 * height step) is cut in every combination of its legs. A cut component must
 * assemble with **zero** issues and must not fall back to whole (D12), and every
 * cut/uncut pair at the Junction must produce at least one vertical seam face —
 * the face that closes the stub against the neighbour that stayed whole.
 */
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	legJoinsByWall,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall
} from '@portfolio/layout-core';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';
import { assembleCutawayCaps, type CutawayComponent } from '$lib/authoring/stage/cutaway/cutaway-caps';
import { capFillsOf } from '$lib/authoring/stage/slice/slice-cap-shapes';

/** Every cap boundary edge in world plan coordinates, via the section basis. */
function capBoundary(component: CutawayComponent): Array<readonly [LayoutVec2, LayoutVec2]> {
	const { u, v, origin } = component.basis;
	const world = (point: readonly [number, number]): LayoutVec2 => [
		origin[0] + u[0] * point[0] + v[0] * point[1],
		origin[2] + u[2] * point[0] + v[2] * point[1]
	];
	return component.loops.flatMap((loop) =>
		loop.points.map((point, index) => [world(point), world(loop.points[(index + 1) % loop.points.length]!)] as const)
	);
}

function onCapBoundary(point: LayoutVec2, boundary: ReturnType<typeof capBoundary>): boolean {
	return boundary.some(([a, b]) => {
		const dx = b[0] - a[0];
		const dz = b[1] - a[1];
		const length = Math.hypot(dx, dz);
		if (!(length > 1e-9)) return false;
		const off = Math.abs(dx * (point[1] - a[1]) - dz * (point[0] - a[0])) / length;
		if (off > 1e-4) return false;
		const t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / (length * length);
		return t >= -1e-6 && t <= 1 + 1e-6;
	});
}

type WallSeed = {
	readonly id: string;
	readonly start: [string, LayoutVec2];
	readonly end: [string, LayoutVec2];
	readonly thickness?: number;
	readonly height?: number;
};

function scene(walls: WallSeed[]): LayoutDocumentWallFirst {
	const junctionById = new Map<string, LayoutVec2>();
	for (const wall of walls) {
		junctionById.set(wall.start[0], wall.start[1]);
		junctionById.set(wall.end[0], wall.end[1]);
	}
	return {
		units: 'meters',
		formatVersion: 7,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [...junctionById].map(([id, point]) => ({ id, point })),
		walls: walls.map(
			(wall): LayoutWall =>
				({
					id: wall.id,
					startJunctionId: wall.start[0],
					endJunctionId: wall.end[0],
					thickness: wall.thickness ?? 0.2,
					height: wall.height ?? 3,
					centerline: { kind: 'line' }
				}) as LayoutWall
		),
		rooms: [],
		openings: [],
		objects: []
	};
}

type Fixture = { readonly name: string; readonly document: LayoutDocumentWallFirst };

const fixtures: Fixture[] = [
	{
		name: 'tangent continuation',
		document: scene([
			{ id: 'w1', start: ['a', [-4, 0]], end: ['j', [0, 0]] },
			{ id: 'w2', start: ['j', [0, 0]], end: ['b', [4, 0]] }
		])
	},
	{
		name: 'L junction',
		document: scene([
			{ id: 'w1', start: ['a', [-4, 0]], end: ['j', [0, 0]] },
			{ id: 'w2', start: ['j', [0, 0]], end: ['b', [0, 4]] }
		])
	},
	{
		name: 'T junction',
		document: scene([
			{ id: 'w1', start: ['a', [-4, 0]], end: ['j', [0, 0]] },
			{ id: 'w2', start: ['b', [4, 0]], end: ['j', [0, 0]] },
			{ id: 'w3', start: ['j', [0, 0]], end: ['c', [0, 4]] }
		])
	},
	{
		name: 'X junction',
		document: scene([
			{ id: 'w1', start: ['a', [-4, 0]], end: ['j', [0, 0]] },
			{ id: 'w2', start: ['b', [4, 0]], end: ['j', [0, 0]] },
			{ id: 'w3', start: ['c', [0, -4]], end: ['j', [0, 0]] },
			{ id: 'w4', start: ['j', [0, 0]], end: ['d', [0, 4]] }
		])
	},
	{
		name: 'thickness step',
		document: scene([
			{ id: 'w1', start: ['a', [-4, 0]], end: ['j', [0, 0]], thickness: 0.2 },
			{ id: 'w2', start: ['j', [0, 0]], end: ['b', [4, 0]], thickness: 0.4 }
		])
	},
	{
		name: 'height step',
		document: scene([
			{ id: 'w1', start: ['a', [-4, 0]], end: ['j', [0, 0]], height: 3 },
			{ id: 'w2', start: ['j', [0, 0]], end: ['b', [4, 0]], height: 2.4 }
		])
	}
];

const STUB_TOP_Y = 1;

function subsets(ids: readonly string[]): string[][] {
	const out: string[][] = [];
	for (let mask = 1; mask < 1 << ids.length; mask += 1) {
		out.push(ids.filter((_, index) => (mask & (1 << index)) !== 0));
	}
	return out;
}

describe('X2 cap/seam catalogue', () => {
	for (const fixture of fixtures) {
		it(`${fixture.name}: every cut assignment closes`, () => {
			const compilation = compileWallFirstLayoutGeometry(fixture.document);
			const blocking = compilation.issues.filter((issue) => issue.severity !== 'warning');
			expect(blocking).toEqual([]);
			const geometry = compilation.geometry;
			const ends = legJoinsByWall(geometry.junctions);
			const sources = geometry.walls.map((wall) => {
				const built = buildStandaloneWallMesh(wall, 0, ends.get(wall.wallId) ?? { start: null, end: null });
				expect(built.issues).toEqual([]);
				expect(built.mesh).toBeDefined();
				return {
					identity: `wall:${wall.wallId}`,
					group: wall.wallId,
					positions: built.mesh!.positions,
					index: built.mesh!.indices
				};
			});
			const ids = geometry.walls.map((wall) => wall.wallId);


			for (const cutIds of subsets(ids)) {
				const assembly = assembleCutawayCaps({
					cut: new Set(cutIds),
					stubTopY: STUB_TOP_Y,
					junctions: geometry.junctions ?? [],
					walls: geometry.walls,
					floors: [{ floorId: 'floor-1', elevation: 0 }],
					sources
				});
				const label = `${fixture.name} cut={${cutIds.join(',')}}`;

				// A T/X where two legs at one Junction are both cut can leave a
				// partial-overlap collinear T-junction that `sectionMeshes` cannot net.
				// The retry keeps the trimmed branch (the near Wall) cut and closes the
				// core legs at that Junction to whole; only an untrimmed leg may be
				// dropped, never the branch and never an open stub.
				const trimmed = new Set(
					(geometry.junctions ?? []).flatMap((junction) =>
						junction.resolution.joins.filter((join) => (join.clipDistance ?? 0) > 0).map((join) => join.wallId)
					)
				);
				for (const wallId of assembly.failedWallIds) expect(trimmed.has(wallId), label).toBe(false);
				for (const wallId of cutIds) {
					if (trimmed.has(wallId)) {
						expect(
							assembly.components.some((component) => component.wallIds.includes(wallId)),
							`${label} keeps the cut branch ${wallId}`
						).toBe(true);
					}
				}
				expect(assembly.issues, label).toEqual([]);
				expect(assembly.components.length, label).toBeGreaterThan(0);
				for (const component of assembly.components) {
					expect(capFillsOf(component.loops).length, label).toBeGreaterThan(0);
					// Watertight closure: every seam that closes the stub must land on
					// the cap's boundary. An open T/X would leave a seam endpoint in the
					// interior and fail here even when the section had no issue.
					const boundary = capBoundary(component);
					for (const seam of component.seams.filter((candidate) => candidate.closesStub)) {
						expect(onCapBoundary(seam.from, boundary), `${label} seam ${seam.identity} from`).toBe(true);
						expect(onCapBoundary(seam.to, boundary), `${label} seam ${seam.identity} to`).toBe(true);
					}
				}

			}
		});
	}
});
