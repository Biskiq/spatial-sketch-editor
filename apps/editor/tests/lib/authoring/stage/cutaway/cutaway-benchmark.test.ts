/**
 * X2 §11 — a retained, reproducible CPU benchmark.
 *
 * The acceptance measurement was a temporary harness. This keeps the same shape
 * in one small test: eleven isolated L-shaped Rooms / 66 Walls, 200
 * classification poses, and one 7-Wall and one 8-Wall cap assembly. It prints
 * p50/p95 instead of asserting a clock, because the budget was established on an
 * idle M2 and a shared CI runner is not a timing oracle. The correctness gates
 * (zero issues, one component per cut set) still fail the test if the assembly
 * breaks.
 *
 * Run: `npx vitest run tests/lib/authoring/stage/cutaway/cutaway-benchmark.test.ts`
 */
import { describe, expect, it } from 'vitest';
import { compileWallFirstLayoutGeometry, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import { createEmptyWallFirstLayoutDocument, legJoinsByWall, type LayoutDocumentWallFirst, type LayoutWall } from '@portfolio/layout-core/wall';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-standalone';
import { classifyNearWalls } from '$lib/authoring/stage/cutaway/near-wall-classify';
import { assembleCutawayCaps } from '$lib/authoring/stage/cutaway/cutaway-caps';

const ROOMS = 11;
const PITCH = 10;

/** An L-shaped 6-Wall Room, repeated along X with no shared Junctions. */
function document(): LayoutDocumentWallFirst {
	const layout = createEmptyWallFirstLayoutDocument();
	for (let room = 0; room < ROOMS; room += 1) {
		const x = room * PITCH;
		const corners: Array<readonly [string, LayoutVec2]> = [
			[`r${room}-a`, [x, 0]],
			[`r${room}-b`, [x + 6, 0]],
			[`r${room}-c`, [x + 6, 3]],
			[`r${room}-d`, [x + 3, 3]],
			[`r${room}-e`, [x + 3, 6]],
			[`r${room}-f`, [x, 6]]
		];
		for (const [id, point] of corners) layout.junctions.push({ id, point });
		for (let index = 0; index < corners.length; index += 1) {
			layout.walls.push({
				id: `r${room}-w${index}`,
				startJunctionId: corners[index]![0],
				endJunctionId: corners[(index + 1) % corners.length]![0],
				thickness: 0.2,
				height: 3,
				centerline: { kind: 'line' }
			} as LayoutWall);
		}
		layout.rooms.push({
			id: `r${room}-room`,
			name: `Room ${room}`,
			boundary: corners.map((_, index) => ({ wallId: `r${room}-w${index}`, direction: 'forward' as const })),
			virtualEdges: [],
			overhead: 'closed',
		});
	}
	return layout;
}

function percentile(samples: readonly number[], fraction: number): number {
	const sorted = [...samples].sort((left, right) => left - right);
	return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]!;
}

describe('X2 reproducible benchmark', () => {
	it('reports classification and 7/8-Wall cap p95 over 11 Rooms / 66 Walls', () => {
		const layout = document();
		const compilation = compileWallFirstLayoutGeometry(layout);
		expect(compilation.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
		const geometry = compilation.geometry;
		expect(geometry.walls).toHaveLength(ROOMS * 6);

		const ends = legJoinsByWall(geometry.junctions ?? []);
		const sources = geometry.walls.map((wall) => {
			const built = buildStandaloneWallMesh(
				wall,
				layout.floor.elevation,
				ends.get(wall.wallId) ?? { start: null, end: null }
			);
			expect(built.issues, wall.wallId).toEqual([]);
			expect(built.mesh, wall.wallId).toBeDefined();
			return {
				identity: `wall:${wall.wallId}`,
				group: 'structure',
				positions: built.mesh!.positions,
				index: built.mesh!.indices
			};
		});

		// 200 poses spread over the eleven Rooms, all viewing from outside the L.
		const classifyOnce = (pose: number) => {
			const room = pose % ROOMS;
			const angle = (pose / 200) * Math.PI * 2;
			const centre = [room * PITCH + 2.25, 2.25] as const;
			return classifyNearWalls({
				eye: [centre[0] + Math.cos(angle) * 11, 2.6, centre[1] + Math.sin(angle) * 11],
				target: [centre[0], 1.2, centre[1]],
				rooms: geometry.rooms,
				walls: geometry.walls,
				floors: [{ floorId: layout.floor.id, elevation: layout.floor.elevation }],
				previousSpaceId: null,
				previousCut: new Set()
			});
		};
		// Warm the classifier's weld/sight paths; a cold first call is JIT, not the cost.
		for (let pose = 0; pose < 20; pose += 1) classifyOnce(pose);
		const classification: number[] = [];
		let cutPoses = 0;
		for (let pose = 0; pose < 200; pose += 1) {
			const started = performance.now();
			const result = classifyOnce(pose);
			classification.push(performance.now() - started);
			if (result.cut.size > 0) cutPoses += 1;
		}
		expect(cutPoses).toBeGreaterThan(0);

		const cap = (size: 7 | 8): { p50: number; p95: number; n: number; samples: number[] } => {
			const cut = new Set(sources.slice(0, size).map((source) => source.identity.slice('wall:'.length)));
			const run = () =>
				assembleCutawayCaps({
					cut,
					stubTopY: 1,
					junctions: geometry.junctions ?? [],
					walls: geometry.walls,
					floors: geometry.floors,
					sources
				});
			const warm = run();
			expect(warm.issues).toEqual([]);
			expect(warm.failedWallIds.size).toBe(0);
			expect(warm.components.length).toBeGreaterThan(0);
			const samples: number[] = [];
			for (let index = 0; index < 40; index += 1) {
				const started = performance.now();
				run();
				samples.push(performance.now() - started);
			}
			return { p50: percentile(samples, 0.5), p95: percentile(samples, 0.95), n: samples.length, samples };
		};
		const seven = cap(7);
		const eight = cap(8);

		console.info(
			`X2 benchmark ${JSON.stringify({
				rooms: ROOMS,
				walls: geometry.walls.length,
				classification: {
					n: classification.length,
					p50: percentile(classification, 0.5),
					p95: percentile(classification, 0.95)
				},
				cap7: { n: seven.n, p50: seven.p50, p95: seven.p95 },
				cap8: { n: eight.n, p50: eight.p50, p95: eight.p95 }
			})}`
		);
	});
});
