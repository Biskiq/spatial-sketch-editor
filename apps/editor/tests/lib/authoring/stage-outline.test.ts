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
	type LayoutWall, type LayoutWallOpening
} from '@portfolio/layout-core';
import {
	contourPolylines,
	mergeStraightEdgeRuns,
	visibleIdentityContour,
	visibleRimContour,
	wallSilhouetteHullScale,
	WALL_SILHOUETTE_METRES,
	OUTLINE_DEPTH_BIAS
} from '$lib/authoring/stage/shell/stage-outline';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';

function bodyOf(points: Record<string, [number, number]>, walls: LayoutWall[], wallId: string, openings: LayoutWallOpening[] = []): BufferGeometry {
	const document = {
		units: 'meters',
		formatVersion: 7,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: Object.entries(points).map(([id, point]) => ({ id, point })),
		walls,
		rooms: [],
		openings,
		objects: []
	} as unknown as LayoutDocumentWallFirst;
	const compiled = compileWallFirstLayoutGeometry(document);
	const joins = legJoinsByWall(compiled.geometry.junctions);
	const wall = compiled.geometry.walls.find((candidate) => candidate.wallId === wallId)!;
	const mesh = buildStandaloneWallMesh(wall, 0, joins.get(wallId) ?? null).mesh!;
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new BufferAttribute(new Float32Array(mesh.positions), 3));
	geometry.setIndex(Array.from(mesh.indices));
	return geometry;
}
function edgesOf(points: Record<string, [number, number]>, walls: LayoutWall[], wallId: string): Float32Array {
	const body = bodyOf(points, walls, wallId);
	const edges = new EdgesGeometry(body, 30);
	const positions = new Float32Array(edges.getAttribute('position').array);
	edges.dispose(); body.dispose();
	return positions;
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

	it('joins a curved silhouette into continuous polylines with no span-end caps', () => {
		const geometry = bodyOf(
			{ a: [0, 0], b: [6, 0] },
			[wall('c', 'a', 'b', { kind: 'cubic-chain', knots: [], spans: [{ handleOut: [2, 3], handleIn: [4, 3] }] })],
			'c'
		);
		const triangles = geometry.toNonIndexed();
		try {
			const contour = visibleIdentityContour(triangles.getAttribute('position').array, [9, 8, 12]);
			const chains = contourPolylines(contour);
			expect(chains.length).toBeGreaterThan(0);
			expect(chains.length).toBeLessThan(contour.length / 6);
			expect(Math.max(...chains.map((chain) => chain.length / 3))).toBeGreaterThan(8);
		} finally {
			triangles.dispose();
			geometry.dispose();
		}
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
		expect(source).toContain('visibleIdentityContour(positions, eye)');
		expect(source.match(/\.\.\.OUTLINE_DEPTH_BIAS/g)).toHaveLength(1);
		expect(source.match(/new LineMaterial\(/g)).toHaveLength(1);
	});

	it('keeps hover depth tested and lifts only the selected identity above the Room ceiling', () => {
		expect(source).toContain("depthTest: tone !== 'selection'");
		expect(OUTLINE_DEPTH_BIAS.polygonOffsetFactor).toBeLessThan(0);
		expect(OUTLINE_DEPTH_BIAS.polygonOffsetUnits).toBeLessThan(0);
	});

	it('prototypes a stencil silhouette behind a dev-only switch', () => {
		expect(source).toContain("get('wallOutline') === 'stencil'");
		expect(source).toContain('wallSilhouetteHullScale');
		expect(source).toContain('AlwaysStencilFunc');
		expect(source).toContain('NotEqualStencilFunc');
		expect(source).toContain('visibleRimContour');
		expect(source).toContain("'rim'");
		expect(source).toContain("(tone === 'selection' || tone === 'hover')");
		expect(source).toContain('addStencilSilhouette(meshes[0]!, tone)');
		expect(source).toContain("tone === 'selection' ? GOLD : NEUTRAL");
	});

	it('tests the shell against the mask instead of painting over it', () => {
		const shell = source.slice(source.indexOf('const outlineMaterial'), source.indexOf('const scaleGroup'));
		expect(shell).toContain('stencilWrite: true');
		expect(shell).toContain('stencilFunc: NotEqualStencilFunc');
	});
});

describe('stencil silhouette expansion', () => {
	it('expands each axis by the same outline width around the Wall centre', () => {
		const extent = [2.6, 3, 0.2] as const;
		const scale = wallSilhouetteHullScale(extent);
		for (let axis = 0; axis < 3; axis += 1) {
			expect((extent[axis]! / 2) * (scale[axis]! - 1)).toBeCloseTo(WALL_SILHOUETTE_METRES, 9);
		}
	});

	it('leaves a zero-extent axis finite', () => {
		for (const value of wallSilhouetteHullScale([0, 0, 0])) expect(Number.isFinite(value)).toBe(true);
	});

	it('keeps the camera-facing top rim while dropping smooth side seams', async () => {
		const { CylinderGeometry } = await import('three');
		const body = new CylinderGeometry(1, 1, 2, 48).toNonIndexed();
		try {
			const rim = visibleRimContour(body.getAttribute('position').array, [4, 5, 6]);
			expect(rim.length).toBeGreaterThan(0);
			let top = 0;
			for (let at = 0; at + 5 < rim.length; at += 6) {
				expect(Math.abs(rim[at + 1]! - rim[at + 4]!)).toBeLessThan(1e-6);
				if (Math.abs(rim[at + 1]! - 1) < 1e-6) top += 1;
			}
			expect(top).toBeGreaterThan(0);
		} finally { body.dispose(); }
	});
});

it('draws a single outer identity on a thick triangulated solid, without face diagonals or visible-face creases', async () => {
	const { BoxGeometry } = await import('three');
	const body = new BoxGeometry(8, 3, .4).toNonIndexed();
	try {
		const triangles = body.getAttribute('position').array;
		const contour = visibleIdentityContour(triangles, [10, 8, 12]);
		expect(contour.length / 6).toBe(6);
		// Every retained segment is a true box edge, never a triangulation diagonal.
		for (let i = 0; i < contour.length; i += 6) {
			const changed = [0, 1, 2].filter(axis => contour[i + axis] !== contour[i + axis + 3]);
			expect(changed).toHaveLength(1);
		}
	} finally { body.dispose(); }
});

it('cancels coincident internal span caps and merges their exterior runs', async () => {
	const { BoxGeometry } = await import('three');
	const first = new BoxGeometry(2, 3, .4).translate(-1, 0, 0).toNonIndexed();
	const second = new BoxGeometry(2, 3, .4).translate(1, 0, 0).toNonIndexed();
	try {
		const positions = [...first.getAttribute('position').array, ...second.getAttribute('position').array];
		const contour = visibleIdentityContour(positions, [10, 8, 12]);
		expect(contour.length / 6).toBe(6);
		for (let i = 0; i < contour.length; i += 6) expect(contour[i] === 0 && contour[i + 3] === 0).toBe(false);
	} finally { first.dispose(); second.dispose(); }
});


it('retains the compiler-rendered aperture rims for front, oblique and edge-on views of a joined thick Wall', () => {
	const geometry = bodyOf({ a: [0,0], b: [8,0], c: [8,6] }, [wall('w','a','b'), wall('q','b','c')], 'w', [{ id:'door', wallId:'w', kind:'door', offset:2, width:1, height:2, sillHeight:0, profile:'rectangular' }]);
	const triangles = geometry.toNonIndexed();
	try {
		for (const eye of [[4,4,10], [12,5,6], [12,3,.2]] as const) {
			const contour = visibleIdentityContour(triangles.getAttribute('position').array, eye);
			expect(contour.length).toBeGreaterThan(0);
			const aperture = [];
			for (let i = 0; i < contour.length; i += 3) if (Math.abs(contour[i + 1]! - 2) < 1e-4 && contour[i]! >= 1.99 && contour[i]! <= 3.01) aperture.push(i);
			expect(aperture.length).toBeGreaterThan(0);
		}
	} finally { triangles.dispose(); geometry.dispose(); }
});
