/**
 * T1 SL1 — the cap-assembly catalogue over **real Wall-builder output**.
 *
 * This is the rendering gate: every Junction kind and degenerate cut the builder
 * produces must assemble with zero `CapAssemblyIssue`s, simple non-overlapping
 * polygons, and the union area the independent oracle measures. A failure here is
 * a defect in the assembly, never a reason to change the Wall builder.
 */
import { describe, expect, it } from 'vitest';

import {
	g1AutoBezierDocument,
	g1DocumentWithRooms,
	g1Opening,
	g1ProfileMatrixDocument,
	g1RectangleRoom
} from '../../../layout/__fixtures__/layout-g1-fixtures';
import {
	assemblyArea,
	boxInput,
	document,
	inputOf,
	loopIsSimple,
	openBoxInput,
	roomBevelInputs,
	quadInput,
	structureFixture,
	unionArea,
	wall
} from './section-fixtures';
import {
	capSectionPlane,
	sectionMeshes,
	type SectionInput,
	type SectionResult
} from '$lib/authoring/stage/slice/mesh-plane-section';

const CUT = 1.2;

function expectAssembled(
	name: string,
	inputs: readonly SectionInput[],
	cutY = CUT,
	expectedArea?: number
): SectionResult {
	const result = sectionMeshes(inputs, capSectionPlane(cutY));
	expect(result.issues, `${name}: issues`).toEqual([]);
	expect(result.openChains, `${name}: open chains`).toEqual([]);
	for (const loop of result.loops) {
		expect(loopIsSimple(loop.points), `${name}: simple loop`).toBe(true);
		expect(loop.points.length, `${name}: loop has area`).toBeGreaterThanOrEqual(3);
	}
	const expected = expectedArea ?? unionArea(inputs, capSectionPlane(cutY));
	expect(Math.abs(assemblyArea(result.loops) - expected), `${name}: area`).toBeLessThan(1e-6);
	return result;
}

function cornerDocument(degrees: number, options: { firstThickness?: number; secondThickness?: number } = {}) {
	const radians = (degrees * Math.PI) / 180;
	const second: [number, number] = [Math.cos(radians) * 4, Math.sin(radians) * 4];
	return document(
		[
			{ id: 'ja', point: [-4, 0] },
			{ id: 'j', point: [0, 0] },
			{ id: 'jb', point: second }
		],
		[
			wall('w1', 'ja', 'j', { thickness: options.firstThickness ?? 0.2 }),
			wall('w2', 'j', 'jb', { thickness: options.secondThickness ?? 0.2 })
		]
	);
}

describe('T1 SL1 — a box Wall', () => {
	it('sections one rectangle at the cut', () => {
		const fixture = structureFixture(
			document(
				[
					{ id: 'ja', point: [0, 0] },
					{ id: 'jb', point: [4, 0] }
				],
				[wall('w1', 'ja', 'jb')]
			)
		);
		const result = expectAssembled('box Wall', fixture.inputs, CUT, 4 * 0.2);
		expect(result.loops).toHaveLength(1);
		expect(result.loops[0]!.hole).toBe(false);
		// Identity survives the whole assembly.
		for (const edge of result.loops[0]!.edges) {
			expect(edge.identity).toEqual({ kind: 'wall', id: 'w1' });
		}
	});
});

describe('T1 SL1 — closed Rooms', () => {
	it('sections a closed ring into one outer and one hole', () => {
		const fixture = structureFixture(
			g1DocumentWithRooms([g1RectangleRoom('room-ring', 0, 0, 6, 4)])
		);
		// The compiled miter footprint is the analytic answer here; the oracle
		// measures it from the builder's own triangles rather than a second rule.
		const result = expectAssembled('closed ring', fixture.inputs);
		expect(result.loops.filter((loop) => loop.hole)).toHaveLength(1);
		expect(result.loops.filter((loop) => !loop.hole)).toHaveLength(1);
		const hole = result.loops.find((loop) => loop.hole)!;
		expect(hole.outerIndex).toBe(result.loops.findIndex((loop) => !loop.hole));
		for (const loop of result.loops) {
			for (const edge of loop.edges) {
				expect(edge.identity.kind).toBe('wall');
				expect(fixture.geometry.walls.some((compiled) => compiled.wallId === edge.identity.id)).toBe(true);
			}
		}
	});

	it('sections a curved Wall on its own tessellation', () => {
		const fixture = structureFixture(g1AutoBezierDocument());
		// A straight-to-curved continuation and the curve itself are one solid.
		expectAssembled('curved Room', fixture.inputs);
	});
});

describe('T1 SL1 — Junction kinds', () => {
	it('assembles an L miter', () => {
		const fixture = structureFixture(cornerDocument(90));
		expectAssembled('L miter', fixture.inputs);
	});

	it('assembles an L bevel with its bridge', () => {
		// The Stage's per-Wall builder keeps sharp bevel corners open by design
		// (`wall-mesh-solid-matrix` pins that limit). The Room-level builder's
		// bridge closes the same corner, and this is its watertight mesh.
		const inputs = roomBevelInputs(g1DocumentWithRooms([g1RectangleRoom('room-bev', 0, 0, 6, 4)]));
		const result = expectAssembled('L bevel', inputs);
		expect(result.loops.filter((loop) => loop.hole)).toHaveLength(1);
	});

	it('assembles a T Junction whose stem ends on the through face', () => {
		const fixture = structureFixture(
			document(
				[
					{ id: 'ja', point: [-4, 0] },
					{ id: 'j', point: [0, 0] },
					{ id: 'jb', point: [4, 0] },
					{ id: 'js', point: [0, 4] }
				],
				[wall('w1', 'ja', 'j'), wall('w2', 'j', 'jb'), wall('w3', 'j', 'js')]
			)
		);
		expectAssembled('T Junction', fixture.inputs);
	});

	it('assembles an X Junction', () => {
		const fixture = structureFixture(
			document(
				[
					{ id: 'a', point: [0, 0] },
					{ id: 'b', point: [4, 0] },
					{ id: 'c', point: [-4, 0] },
					{ id: 'd', point: [0, 4] },
					{ id: 'e', point: [0, -4] }
				],
				[wall('w1', 'a', 'b'), wall('w2', 'a', 'c'), wall('w3', 'a', 'd'), wall('w4', 'a', 'e')]
			)
		);
		expectAssembled('X Junction', fixture.inputs);
	});

	it('assembles a Y Junction with keels', () => {
		const radius = 4;
		const point = (degrees: number): [number, number] => [
			Math.cos((degrees * Math.PI) / 180) * radius,
			Math.sin((degrees * Math.PI) / 180) * radius
		];
		const fixture = structureFixture(
			document(
				[
					{ id: 'a', point: [0, 0] },
					{ id: 'b', point: point(90) },
					{ id: 'c', point: point(210) },
					{ id: 'd', point: point(330) }
				],
				[wall('w1', 'a', 'b'), wall('w2', 'a', 'c'), wall('w3', 'a', 'd')]
			)
		);
		expectAssembled('Y Junction', fixture.inputs);
	});
});

describe('T1 SL1 — Openings cut through a Wall', () => {
	it('reads a door at a Junction as a gap in the loop', () => {
		const fixture = structureFixture(
			g1DocumentWithRooms([
				g1RectangleRoom('room-door-junction', 0, 0, 6, 4, [
					g1Opening('door', 'room-door-junction:wall:0', 'door', 0.05, 0.9, 2.1, 0)
				])
			])
		);
		expectAssembled('door at junction', fixture.inputs);
	});

	it('reports an endpoint-open door at a Junction, which the per-Wall builder leaves open', () => {
		// Known builder limit: at offset 0 the door void reaches the Junction and
		// the standalone mesh has no cap across the lower door band, so the section
		// boundary is genuinely open. The assembly must be loud, never throw and
		// never invent a closure; the Room-level builder path is watertight.
		const fixture = structureFixture(
			g1DocumentWithRooms([
				g1RectangleRoom('room-door-open', 0, 0, 6, 4, [
					g1Opening('door', 'room-door-open:wall:0', 'door', 0, 0.9, 2.1, 0)
				])
			])
		);
		const result = sectionMeshes(fixture.inputs, capSectionPlane(CUT));
		expect(result.issues.length).toBeGreaterThan(0);
		expect(result.openChains.length).toBeGreaterThan(0);
		expect(result.loops).toEqual([]);
	});

	it('reads a door gap mid-Wall as a gap in the loop', () => {
		const fixture = structureFixture(
			g1DocumentWithRooms([
				g1RectangleRoom('room-door-mid', 0, 0, 10, 4, [
					g1Opening('door', 'room-door-mid:wall:0', 'door', 2, 1, 2.1, 0)
				])
			])
		);
		expectAssembled('door mid-Wall', fixture.inputs);
	});

	it('cuts an arch through its head', () => {
		const fixture = structureFixture(g1ProfileMatrixDocument());
		expectAssembled('arch head', fixture.inputs, 2.2);
	});
});

describe('T1 SL1 — cuts exactly on a horizontal face', () => {
	it('assembles at a sill, a head and a Wall top (the section offset)', () => {
		const fixture = structureFixture(g1ProfileMatrixDocument());
		for (const cut of [1.0, 2.8, 3.0]) {
			const result = sectionMeshes(fixture.inputs, capSectionPlane(cut));
			expect(result.issues, `cut ${cut}`).toEqual([]);
			expect(result.openChains, `cut ${cut}`).toEqual([]);
			const expected = unionArea(fixture.inputs, capSectionPlane(cut));
			expect(Math.abs(assemblyArea(result.loops) - expected), `cut ${cut}`).toBeLessThan(1e-6);
		}
	});
});

describe('T1 SL1 — overlapping and coincident surfaces', () => {
	it('unions two overlapping, not joined Walls into one boundary', () => {
		const horizontal = structureFixture(
			document(
				[
					{ id: 'a0', point: [-4, 0] },
					{ id: 'a1', point: [4, 0] }
				],
				[wall('w-horizontal', 'a0', 'a1')]
			)
		);
		const vertical = structureFixture(
			document(
				[
					{ id: 'b0', point: [0, -4] },
					{ id: 'b1', point: [0, 4] }
				],
				[wall('w-vertical', 'b0', 'b1', { thickness: 0.3 })]
			)
		);
		const result = expectAssembled('overlapping Walls', [
			...horizontal.inputs,
			...vertical.inputs
		]);
		expect(result.loops.filter((loop) => !loop.hole)).toHaveLength(1);
	});

	it('keeps a duplicated coincident Wall at net 2 as one boundary', () => {
		const fixture = structureFixture(
			document(
				[
					{ id: 'ja', point: [0, 0] },
					{ id: 'jb', point: [4, 0] }
				],
				[wall('w1', 'ja', 'jb')]
			)
		);
		const result = expectAssembled('net 2', [...fixture.inputs, ...fixture.inputs], CUT, 0.8);
		expect(result.loops).toHaveLength(1);
	});

	it('drops two coincident opposite faces at net 0', () => {
		const forward = quadInput(0.2, 2.2, { kind: 'wall', id: 'front' }, 'structure');
		const backward = quadInput(0.2, 2.2, { kind: 'wall', id: 'back' }, 'structure', true);
		const result = sectionMeshes([forward, backward], capSectionPlane(CUT));
		expect(result.issues).toEqual([]);
		expect(result.loops).toEqual([]);
		expect(assemblyArea(result.loops)).toBe(0);
	});
});

describe('T1 SL1 — groups assemble independently', () => {
	it('keeps a plinth flush against a Wall as its own boundary', () => {
		const fixture = structureFixture(
			document(
				[
					{ id: 'ja', point: [0, 0] },
					{ id: 'jb', point: [4, 0] }
				],
				[wall('w1', 'ja', 'jb')]
			)
		);
		const plinth = boxInput([0, 0, -0.2], [0.4, 2, 0.2], { kind: 'object', id: 'plinth' }, 'object:plinth');
		const result = sectionMeshes([...fixture.inputs, plinth], capSectionPlane(CUT));
		expect(result.issues).toEqual([]);
		expect(result.loops.filter((loop) => !loop.hole)).toHaveLength(2);
		expect(Math.abs(assemblyArea(result.loops) - (0.8 + 0.4 * 0.4))).toBeLessThan(1e-6);
	});
});

describe('T1 SL1 — an open input', () => {
	it('draws its edges, reports one issue and never throws', () => {
		const open = openBoxInput([0, 0, 0], [4, 3, 1], { kind: 'wall', id: 'open' }, 'structure');
		const result = sectionMeshes([open], capSectionPlane(CUT));
		expect(result.issues).toHaveLength(1);
		expect(result.issues[0]!.group).toBe('structure');
		expect(result.issues[0]!.unmatchedVertices).toBeGreaterThan(0);
		expect(result.loops).toEqual([]);
		expect(result.openChains.length).toBeGreaterThan(0);
	});
});

describe('T1 SL1 — identity through split and merge', () => {
	it('keeps every split edge’s source identity', () => {
		const fixture = structureFixture(
			document(
				[
					{ id: 'ja', point: [-4, 0] },
					{ id: 'j', point: [0, 0] },
					{ id: 'jb', point: [4, 0] },
					{ id: 'js', point: [0, 4] }
				],
				[wall('w1', 'ja', 'j'), wall('w2', 'j', 'jb'), wall('w3', 'j', 'js')]
			)
		);
		const result = sectionMeshes(fixture.inputs, capSectionPlane(CUT));
		const ids = new Set(result.loops.flatMap((loop) => loop.edges.map((edge) => edge.identity.id)));
		for (const id of ids) expect(['w1', 'w2', 'w3']).toContain(id);
		// Some edges are split at the T, and every one keeps one of those identities.
		expect(result.loops.flatMap((loop) => loop.edges).length).toBeGreaterThan(4);
	});
});
