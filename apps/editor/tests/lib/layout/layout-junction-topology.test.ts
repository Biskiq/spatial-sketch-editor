/**
 * P23.15 Task 1 — compiled canonical Junction topology.
 *
 * `CompiledLayoutGeometry` must carry the canonical Junction incidence (which
 * Walls meet where, on which end) plus the incident-leg facts a Junction-local
 * solve needs, so no renderer or visitor ever has to receive `LayoutDocument`.
 *
 * These tests pin the *contract*, not the mesh: leg counts, deterministic
 * ordering, outward frames, mixed thickness/height, endpoint Opening facts and
 * the "no invented junction" rule.
 */
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall
} from '@portfolio/layout-core';

function wall(
	id: string,
	startJunctionId: string,
	endJunctionId: string,
	options: Partial<Pick<LayoutWall, 'thickness' | 'height' | 'role'>> = {}
): LayoutWall {
	return {
		id,
		startJunctionId,
		endJunctionId,
		role: options.role ?? 'partition',
		thickness: options.thickness ?? 0.2,
		height: options.height ?? 3,
		centerline: { kind: 'line' }
	} as LayoutWall;
}

function document(
	junctions: Array<{ id: string; point: LayoutVec2 }>,
	walls: LayoutWall[],
	openings: LayoutDocumentWallFirst['openings'] = []
): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: 5,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions,
		walls,
		rooms: [],
		openings,
		objects: []
	};
}

function junctionById(geometry: ReturnType<typeof compileWallFirstLayoutGeometry>['geometry'], id: string) {
	return (geometry.junctions ?? []).find((junction) => junction.junctionId === id);
}

describe('P23.15 Task 1 — compiled Junction topology', () => {
	it('compiles one leg per Wall end and one Junction per extant point', () => {
		const compiled = compileWallFirstLayoutGeometry(
			document(
				[
					{ id: 'j1', point: [0, 0] },
					{ id: 'j2', point: [4, 0] }
				],
				[wall('w1', 'j1', 'j2')]
			)
		);
		expect(compiled.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
		expect(compiled.geometry.walls[0]!.startJunctionId).toBe('j1');
		expect(compiled.geometry.walls[0]!.endJunctionId).toBe('j2');
		expect((compiled.geometry.junctions ?? []).map((junction) => junction.junctionId).sort()).toEqual(['j1', 'j2']);
		expect(junctionById(compiled.geometry, 'j1')!.legs).toHaveLength(1);
		expect(junctionById(compiled.geometry, 'j2')!.legs).toHaveLength(1);
	});

	it('orders legs deterministically and is invariant to the authored Wall order', () => {
		const junctions = [
			{ id: 'jc', point: [0, 0] as LayoutVec2 },
			{ id: 'j0', point: [4, 0] as LayoutVec2 },
			{ id: 'j180', point: [-4, 0] as LayoutVec2 },
			{ id: 'j90', point: [0, 4] as LayoutVec2 }
		];
		const walls = [wall('w0', 'jc', 'j0'), wall('w180', 'j180', 'jc'), wall('w90', 'jc', 'j90')];
		const forward = compileWallFirstLayoutGeometry(document(junctions, walls));
		const reversed = compileWallFirstLayoutGeometry(document(junctions, [...walls].reverse()));
		const order = (compiled: typeof forward) =>
			junctionById(compiled.geometry, 'jc')!.legs.map((leg) => `${leg.wallId}:${leg.end}`);
		expect(order(forward)).toEqual(order(reversed));
		expect(order(forward)).toHaveLength(3);
		// Cyclic adjacency order: outward rays -X (w180 end), +X (w0 start), +Y (w90 start).
		expect(order(forward)).toEqual(['w180:end', 'w0:start', 'w90:start']);
	});

	it('compiles outward frames that point from the Junction into each Wall', () => {
		const compiled = compileWallFirstLayoutGeometry(
			document(
				[
					{ id: 'j1', point: [0, 0] },
					{ id: 'j2', point: [4, 0] }
				],
				[wall('w1', 'j1', 'j2')]
			)
		);
		const start = junctionById(compiled.geometry, 'j1')!.legs[0]!;
		const end = junctionById(compiled.geometry, 'j2')!.legs[0]!;
		// Both outward rays point away from their own Junction into the Wall: -X at j2, +X at j1.
		expect(start.tangentOut[0]).toBeCloseTo(1, 9);
		expect(end.tangentOut[0]).toBeCloseTo(-1, 9);
	});

	it('carries mixed thickness/height and endpoint Opening facts', () => {
		const compiled = compileWallFirstLayoutGeometry(
			document(
				[
					{ id: 'jc', point: [0, 0] },
					{ id: 'ja', point: [-4, 0] },
					{ id: 'jb', point: [0, 4] }
				],
				[wall('wa', 'ja', 'jc', { thickness: 0.3, height: 1.2 }), wall('wb', 'jc', 'jb', { thickness: 0.2, height: 3 })],
				[
					{
						id: 'door-1',
						wallId: 'wb',
						kind: 'door',
						offset: 0,
						width: 0.9,
						height: 2.1,
						sillHeight: 0,
						profile: 'rectangular'
					}
				]
			)
		);
		const legs = junctionById(compiled.geometry, 'jc')!.legs;
		const wa = legs.find((leg) => leg.wallId === 'wa')!;
		const wb = legs.find((leg) => leg.wallId === 'wb')!;
		expect(wa.halfThickness).toBeCloseTo(0.15, 9);
		expect(wa.topY).toBeCloseTo(1.2, 9);
		expect(wb.topY).toBeCloseTo(3, 9);
		expect(wb.endpointOpen).toBe(true);
		expect(wa.endpointOpen).toBe(false);
		// The door reaching offset 0 makes the lower band of wb's start non-solid.
		expect(wb.endpointSolidBands.some((band) => !band.solid && band.openingId === 'door-1')).toBe(true);
	});

	it('does not invent a Junction for a dangling Wall endpoint', () => {
		const compiled = compileWallFirstLayoutGeometry(
			document(
				[
					{ id: 'j1', point: [0, 0] },
					{ id: 'j2', point: [4, 0] }
				],
				[wall('w1', 'j1', 'j2'), wall('w2', 'j1', 'missing-junction')]
			)
		);
		const ids = (compiled.geometry.junctions ?? []).map((junction) => junction.junctionId);
		expect(ids).not.toContain('missing-junction');
		// The dangling Wall is dropped by compile; the valid Wall still compiles.
		expect(ids).toEqual(['j1', 'j2']);
		expect((compiled.geometry.junctions ?? []).every((junction) => junction.legs.length > 0)).toBe(true);
	});

	it('includes the resolved Junction region in aggregate bounds', () => {
		const compiled = compileWallFirstLayoutGeometry(
			document(
				[
					{ id: 'j1', point: [0, 0] },
					{ id: 'j2', point: [4, 0] },
					{ id: 'j3', point: [4, 4] }
				],
				[wall('w1', 'j1', 'j2'), wall('w2', 'j2', 'j3')]
			)
		);
		const junction = junctionById(compiled.geometry, 'j2')!;
		expect(junction.bounds3).toBeDefined();
		expect(compiled.geometry.bounds).not.toBeNull();
		// The corner Junction's own bounds sit inside the aggregate document bounds.
		expect(junction.bounds3.min[0]).toBeGreaterThanOrEqual(compiled.geometry.bounds!.min[0] - 1e-9);
		expect(junction.bounds3.max[0]).toBeLessThanOrEqual(compiled.geometry.bounds!.max[0] + 1e-9);
		expect(junction.bounds3.min[1]).toBeGreaterThanOrEqual(compiled.geometry.bounds!.min[1] - 1e-9);
		expect(junction.bounds3.max[1]).toBeLessThanOrEqual(compiled.geometry.bounds!.max[1] + 1e-9);
	});
});
