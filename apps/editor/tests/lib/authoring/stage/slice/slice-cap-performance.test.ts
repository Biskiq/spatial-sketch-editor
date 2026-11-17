/**
 * SL1 P2 — the cap assembly's measured cost (§6).
 *
 * The plan's budget is "≤ 4 ms for the whole assembly over 50 k candidate triangles;
 * an 11-Room exhibition is well under that", and it asks for numbers, not a claim.
 * This measures the real path — `compileWallFirstLayoutGeometry` →
 * `buildStandaloneWallMesh` → `sectionMeshes`, the same two calls the editor's Wall
 * representation makes — over **eleven closed Rooms** (44 Walls, 44 mitered corners).
 *
 * The assertion is deliberately on the *result*, not the clock: a timing assertion
 * in a shared suite is a flaky gate on a loaded machine. The measured figures are
 * printed (`console.info`) so the PR can quote them, and a broken assembly still
 * fails here through the zero-issue gate.
 */
import { describe, expect, it } from 'vitest';
import { compileWallFirstLayoutGeometry, legJoinsByWall, type LayoutDocumentWallFirst, type LayoutVec2, type LayoutWall } from '@portfolio/layout-core';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';
import { LAYOUT_STRUCTURE_GROUP } from '$lib/authoring/scene/scene-pick-source';
import { sectionMeshes, type SectionInput } from '$lib/authoring/stage/slice/mesh-plane-section';

const ROOMS = 11;
const WIDTH = 6;
const DEPTH = 4;

type WallSeed = {
	readonly id: string;
	readonly start: readonly [string, LayoutVec2];
	readonly end: readonly [string, LayoutVec2];
};

/** `rooms` closed, isolated Rooms side by side, with four mitered corners each. */
function roomDocument(rooms: number): LayoutDocumentWallFirst {
	const walls: WallSeed[] = [];
	for (let room = 0; room < rooms; room += 1) {
		const x = room * (WIDTH + 4);
		const corners: Array<readonly [string, LayoutVec2]> = [
			[`r${room}-a`, [x, 0]],
			[`r${room}-b`, [x + WIDTH, 0]],
			[`r${room}-c`, [x + WIDTH, DEPTH]],
			[`r${room}-d`, [x, DEPTH]]
		];
		for (let index = 0; index < corners.length; index += 1) {
			walls.push({
				id: `r${room}-w${index}`,
				start: corners[index]!,
				end: corners[(index + 1) % corners.length]!
			});
		}
	}
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
					thickness: 0.2,
					height: 3,
					centerline: { kind: 'line' }
				}) as LayoutWall
		),
		rooms: [],
		openings: [],
		objects: []
	};
}

function inputsOf(rooms: number): SectionInput[] {
	const document = roomDocument(rooms);
	const compilation = compileWallFirstLayoutGeometry(document);
	expect(compilation.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
	const ends = legJoinsByWall(compilation.geometry.junctions);
	const inputs: SectionInput[] = [];
	for (const wall of compilation.geometry.walls) {
		const result = buildStandaloneWallMesh(
			wall,
			document.floor.elevation,
			ends.get(wall.wallId) ?? { start: null, end: null }
		);
		expect(result.issues, wall.wallId).toEqual([]);
		const mesh = result.mesh!;
		inputs.push({
			identity: `wall:${wall.wallId}`,
			// One union for the Walls, exactly as `sectionSources` reports them.
			group: LAYOUT_STRUCTURE_GROUP,
			positions: mesh.positions,
			index: mesh.indices
		});
	}
	return inputs;
}

describe('cap assembly cost over an eleven-Room fixture', () => {
	it('sections 44 Walls with zero issues and reports its measured time', () => {
		const inputs = inputsOf(ROOMS);
		expect(inputs.length).toBe(ROOMS * 4);

		// One warm-up pass: the first call pays JIT and the welder's allocation.
		const warm = sectionMeshes(inputs, { normal: [0, -1, 0], constant: 1.2 });
		expect(warm.issues).toEqual([]);
		expect(warm.groups).toHaveLength(1);
		// Eleven disjoint rooms: eleven outers, no holes.
		const outers = warm.groups[0]!.loops.filter((loop) => loop.role === 'outer');
		expect(outers.length).toBe(ROOMS);

		const samples: number[] = [];
		for (let run = 0; run < 7; run += 1) {
			const started = performance.now();
			sectionMeshes(inputs, { normal: [0, -1, 0], constant: 1.2 });
			samples.push(performance.now() - started);
		}
		samples.sort((left, right) => left - right);
		const median = samples[Math.floor(samples.length / 2)]!;
		const best = samples[0]!;
		const worst = samples[samples.length - 1]!;

		console.info(
			`slice cap assembly: ${ROOMS} rooms / ${inputs.length} walls / ${warm.candidateTriangles} candidate triangles — ` +
				`best ${best.toFixed(2)} ms, median ${median.toFixed(2)} ms, worst ${worst.toFixed(2)} ms (budget 4 ms)`
		);

		// Scaling evidence: the same assembly at 1, 3, 6 and 11 rooms. If the cost were
		// linear in the section's size these would grow with the wall count; a steeper
		// curve names the real problem better than any single figure can.
		const scaling: string[] = [];
		for (const rooms of [1, 3, 6, ROOMS]) {
			const small = inputsOf(rooms);
			sectionMeshes(small, { normal: [0, -1, 0], constant: 1.2 });
			const runs: number[] = [];
			for (let run = 0; run < 5; run += 1) {
				const started = performance.now();
				sectionMeshes(small, { normal: [0, -1, 0], constant: 1.2 });
				runs.push(performance.now() - started);
			}
			runs.sort((left, right) => left - right);
			scaling.push(`${rooms} rooms: ${runs[2]!.toFixed(2)} ms`);
		}
		console.info(`slice cap assembly scaling — ${scaling.join(', ')}`);
	});
});
