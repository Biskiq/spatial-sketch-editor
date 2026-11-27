/**
 * T1 V2a — the Unroll sheet reads the Wall's top.
 *
 * The developed strip is the as-built Wall laid out on its stations, so a
 * profiled top must ride the sheet: the strip's top edge is the compiled top at
 * every station (not the eave), the gable apex is a real vertex, and an Opening
 * above the eave keeps its void. The pin and the fit bounds follow the same top.
 */
import { describe, expect, it } from 'vitest';
import type { InspectionPose } from '@portfolio/camera-core/viewport';
import { compileWallFirstLayoutGeometry, type CompiledPhysicalWall } from '@portfolio/layout-core/geometry';
import {
	compiledWallTopAt,
	createEmptyWallFirstLayoutDocument,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutWall,
	type LayoutWallTop
} from '@portfolio/layout-core/wall';
import { createWallUnfoldState, wallUnfoldFitBounds, wallUnfoldTopPoint } from '$lib/layout/wall-unfold';
import { buildWallUnfoldDisplay } from '$lib/layout/wall-unfold-pick';

const ENTRY = {
	pose: { target: [0, 1.5, 0], azimuthRadians: 0.4, elevationRadians: 0.3, targetPlaneHeightMeters: 12 } satisfies InspectionPose,
	reading: '3d' as const
};

function compiled(top: LayoutWallTop, openings: unknown[] = []): CompiledPhysicalWall {
	const document = createEmptyWallFirstLayoutDocument();
	document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
	document.junctions = [
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-b', point: [5, 0] }
	];
	document.walls = [
		{ id: 'wall-a', startJunctionId: 'j-a', endJunctionId: 'j-b', thickness: 0.2, height: 3, top, centerline: { kind: 'line' } } as LayoutWall
	];
	document.openings = openings as typeof document.openings;
	const result = compileWallFirstLayoutGeometry(document);
	expect(result.issues ?? []).toEqual([]);
	return result.geometry.walls[0]!;
}

const GABLE: LayoutWallTop = { kind: 'gable', startRise: 0, endRise: 0, apexRise: 2, apexOffset: 2.5 };
const SLOPE: LayoutWallTop = { kind: 'slope', startRise: 0, endRise: 2 };
const window = { id: 'o1', wallId: 'wall-a', kind: 'window', offset: 3.5, width: 1, height: 1, sillHeight: 3.2, profile: 'rectangular' };

function displayOf(wall: CompiledPhysicalWall) {
	const state = createWallUnfoldState({ wall, anchorStation: 1, entry: ENTRY, u: 1 });
	const display = buildWallUnfoldDisplay(wall, state);
	expect(display).not.toBeNull();
	return display!;
}

describe('the developed Wall strip follows a profiled top', () => {
	it.each([
		['slope', SLOPE],
		['gable', GABLE]
	] as Array<[string, LayoutWallTop]>)('%s: every top-face vertex is at the compiled top for its station', (_name, top) => {
		const wall = compiled(top);
		const display = displayOf(wall);
		const topFace = new Set<number>();
		for (const triangle of display.mesh.triangles) {
			if (triangle.face === 'top') for (const index of triangle.indices) topFace.add(index);
		}
		expect(topFace.size).toBeGreaterThan(0);
		for (const index of topFace) {
			const vertex = display.mesh.vertices[index]!;
			expect(vertex.height).toBeCloseTo(compiledWallTopAt(wall.topProfile!, vertex.station), 9);
		}
		// Not flat at the eave, and framed to the peak.
		expect(Math.max(...display.mesh.vertices.map((vertex) => vertex.height))).toBeCloseTo(5, 9);
		expect(display.mesh.bounds.max[2]).toBeCloseTo(5, 9);
		expect(display.height).toBeCloseTo(5, 9);
	});

	it('a gable apex is a real vertex of the strip', () => {
		const display = displayOf(compiled(GABLE));
		expect(display.mesh.vertices.some((vertex) => Math.abs(vertex.station - 2.5) < 1e-9 && Math.abs(vertex.height - 5) < 1e-9)).toBe(true);
	});

	it('a window above the eave stays a void under the sloped top', () => {
		const display = displayOf(compiled(SLOPE, [window]));
		const hole = display.openingHoles[0]!;
		expect(hole.sillHeight).toBeCloseTo(3.2, 9);
		// Side-face triangles over the hole's span never cover its interior.
		const mid = (hole.sheetStart + hole.sheetEnd) / 2;
		const interior = display.mesh.triangles.filter(
			(triangle) =>
				(triangle.face === 'left' || triangle.face === 'right') &&
				triangle.sheetStart < mid &&
				triangle.sheetEnd > mid &&
				triangle.indices.every((index) => {
					const vertex = display.mesh.vertices[index]!;
					return vertex.height > hole.sillHeight + 1e-9 && vertex.height < hole.headHeight - 1e-9;
				})
		);
		expect(interior).toEqual([]);
		// Above the head the strip continues up to the sloped top (4.4 at x = 3.5 is above the 4.2 head).
		expect(display.mesh.vertices.some((vertex) => vertex.height > hole.headHeight + 0.1 && vertex.sheet > hole.sheetStart && vertex.sheet < hole.sheetEnd + 1e-9)).toBe(true);
	});

	it('a level Wall is unchanged: its strip is `height` tall and carries no profile', () => {
		const wall = compiled({ kind: 'level' });
		const display = displayOf(wall);
		expect(Math.max(...display.mesh.vertices.map((vertex) => vertex.height))).toBe(3);
		expect(display.height).toBe(3);
	});
});

describe('the pin and the fit follow the profiled top', () => {
	it('places the pin on the top at its station and the fit bounds reach the peak', () => {
		const wall = compiled(SLOPE);
		const point = wallUnfoldTopPoint(wall, 2.5, 0.4)!;
		expect(point[1]).toBeCloseTo(0.4 + 4 + 0.09, 9);
		const state = createWallUnfoldState({ wall, anchorStation: 1, entry: ENTRY, u: 0 });
		expect(wallUnfoldFitBounds({ wall, state, floorY: 0 }).max[1]).toBeCloseTo(5 + 0.2, 9);
	});
});
