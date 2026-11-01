/**
 * The 3D outline draws one fat line per straight run, so no joint can show as a
 * tick, and it clears the face it sits on without leaving depth testing.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BufferAttribute, BufferGeometry, EdgesGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	legJoinsByWall,
	type LayoutDocumentWallFirst,
	type LayoutWall
} from '@portfolio/layout-core';
import { mergeStraightEdgeRuns, OUTLINE_DEPTH_BIAS } from '$lib/authoring/stage/shell/stage-outline';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';

function edgesOf(points: Record<string, [number, number]>, walls: LayoutWall[], wallId: string): Float32Array {
	const document = {
		units: 'meters',
		formatVersion: 6,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: Object.entries(points).map(([id, point]) => ({ id, point })),
		walls,
		rooms: [],
		openings: [],
		objects: []
	} as unknown as LayoutDocumentWallFirst;
	const compiled = compileWallFirstLayoutGeometry(document);
	const joins = legJoinsByWall(compiled.geometry.junctions);
	const wall = compiled.geometry.walls.find((candidate) => candidate.wallId === wallId)!;
	const mesh = buildStandaloneWallMesh(wall, 0, joins.get(wallId) ?? null).mesh!;
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new BufferAttribute(new Float32Array(mesh.positions), 3));
	geometry.setIndex(Array.from(mesh.indices));
	return new EdgesGeometry(geometry, 30).getAttribute('position').array as Float32Array;
}

function wall(id: string, start: string, end: string, centerline: unknown = { kind: 'line' }): LayoutWall {
	return { id, startJunctionId: start, endJunctionId: end, thickness: 0.2, height: 3, centerline } as LayoutWall;
}

function totalLength(positions: ArrayLike<number>): number {
	let sum = 0;
	for (let at = 0; at + 5 < positions.length; at += 6) {
		sum += Math.hypot(positions[at + 3]! - positions[at]!, positions[at + 4]! - positions[at + 1]!, positions[at + 5]! - positions[at + 2]!);
	}
	return sum;
}

describe('straight outline runs', () => {
	it('reduces a straight Wall to the twelve edges of its solid', () => {
		for (const end of [[8, 0], [5.66, 5.66], [3.3, -7.1]] as [number, number][]) {
			const edges = edgesOf({ a: [0, 0], b: end }, [wall('w', 'a', 'b')], 'w');
			expect(edges.length / 6).toBeGreaterThan(100);
			const merged = mergeStraightEdgeRuns(edges);
			expect(merged.length / 6).toBe(12);
			expect(totalLength(merged)).toBeCloseTo(totalLength(edges), 3);
		}
	});

	it('keeps a corner as separate runs on each side', () => {
		const edges = edgesOf({ a: [0, 0], b: [8, 0], c: [8, 6] }, [wall('p', 'a', 'b'), wall('q', 'b', 'c')], 'p');
		const merged = mergeStraightEdgeRuns(edges);
		expect(merged.length / 6).toBeLessThan(edges.length / 6);
		expect(totalLength(merged)).toBeCloseTo(totalLength(edges), 3);
		expect(mergeStraightEdgeRuns([0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1]).length / 6).toBe(2);
	});

	it('leaves a curved Wall curved', () => {
		const edges = edgesOf(
			{ a: [0, 0], b: [6, 0] },
			[wall('c', 'a', 'b', { kind: 'cubic-chain', knots: [], spans: [{ handleOut: [2, 3], handleIn: [4, 3] }] })],
			'c'
		);
		const merged = mergeStraightEdgeRuns(edges);
		expect(merged.length / 6).toBeGreaterThan((edges.length / 6) * 0.8);
		expect(totalLength(merged)).toBeCloseTo(totalLength(edges), 3);
	});

	it('handles a segment reversed in the list and a branch at a joint', () => {
		const merged = mergeStraightEdgeRuns([1, 0, 0, 0, 0, 0, 1, 0, 0, 2, 0, 0, 1, 0, 0, 1, 1, 0]);
		expect(merged.length / 6).toBe(2);
		expect(totalLength(merged)).toBeCloseTo(3, 5);
	});

	it('drops a zero-length segment', () => {
		expect(mergeStraightEdgeRuns([1, 1, 1, 1, 1, 1]).length).toBe(0);
	});
});

describe('the outline in the Stage', () => {
	const source = readFileSync(resolve(process.cwd(), 'src/lib/authoring/stage/shell/StageSelectionLayer.svelte'), 'utf8');

	it('draws selection, hover and erase through one merged, biased pair of lines', () => {
		expect(source).toContain('edgeGeometry.setPositions(mergeStraightEdgeRuns(positions));');
		expect(source.match(/\.\.\.OUTLINE_DEPTH_BIAS/g)).toHaveLength(2);
		expect(source.match(/new LineMaterial\(/g)).toHaveLength(2);
	});

	it('stays depth tested, so a Wall in front still hides the outline', () => {
		expect(source).not.toContain('depthTest: false');
		expect(OUTLINE_DEPTH_BIAS.polygonOffsetFactor).toBeLessThan(0);
		expect(OUTLINE_DEPTH_BIAS.polygonOffsetUnits).toBeLessThan(0);
	});
});
