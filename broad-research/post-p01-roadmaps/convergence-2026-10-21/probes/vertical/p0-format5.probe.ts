// P0 — what current production format 5 already does with "vertical" intent, read-only.
// Imports the real `@portfolio/layout-core` source; no production code is changed.
//
// Question for C1: native Wall creation draws into ONE Floor datum with datum-blind plan topology.
// Which vertical/closure situations can a creator already produce in format 5, and how does the canonical
// compiler answer them? Tolerances: elevations compared exactly (authored doubles, no arithmetic beyond +).
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	extractBoundaryCandidateFaces,
	floorSupportSnapshotOf,
	queryFloorSupports,
	validateWallFirstLayoutDocument,
	validateWallFirstTopology,
	topologyComponentKeyByWallId,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst,
	type LayoutWall
} from '@portfolio/layout-core';
import { recorder } from './emit';

type Pt = [number, number];
function ring(prefix: string, pts: Pt[], height: number) {
	const junctions = pts.map((point, i) => ({ id: `${prefix}j${i}`, point }));
	const walls: LayoutWall[] = pts.map((_, i) => ({
		id: `${prefix}w${i}`,
		startJunctionId: `${prefix}j${i}`,
		endJunctionId: `${prefix}j${(i + 1) % pts.length}`,
		role: 'boundary',
		thickness: 0.2,
		height,
		centerline: { kind: 'line' }
	}));
	const room = {
		id: `${prefix}room`,
		name: prefix,
		boundary: walls.map((w) => ({ wallId: w.id, direction: 'forward' as const })),
		floorThickness: 0.2,
		ceilingThickness: 0.2
	};
	return { junctions, walls, room };
}
function doc(parts: ReturnType<typeof ring>[], elevation = 0, floorId = 'floor'): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: floorId, name: 'Floor', elevation },
		junctions: parts.flatMap((p) => p.junctions),
		walls: parts.flatMap((p) => p.walls),
		rooms: parts.map((p) => p.room),
		openings: [],
		objects: []
	};
}
const sq = (x0: number, z0: number, x1: number, z1: number): Pt[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

function read(d: LayoutDocumentWallFirst) {
	const codec = validateWallFirstLayoutDocument(d);
	const topology = validateWallFirstTopology(d);
	const faces = extractBoundaryCandidateFaces(d);
	const compiled = compileWallFirstLayoutGeometry(d);
	const components = new Set(topologyComponentKeyByWallId(d).values()).size;
	return { codec, topology, faces, compiled, components };
}

describe('P0 format-5 behaviour that constrains C1', () => {
	const rec = recorder('p0-format5');

	it('a low closed ring inside a hall (planter / lightwell guard) becomes a second Room with a ceiling inside the hall', () => {
		const d = doc([ring('hall-', sq(0, 0, 10, 10), 4), ring('ring-', sq(3, 3, 5, 5), 1)]);
		const r = read(d);
		const rooms = r.compiled.geometry.rooms.map((room) => ({
			roomId: room.roomId,
			floor: room.floorElevation,
			ceiling: room.ceilingElevation
		}));
		const support = queryFloorSupports(floorSupportSnapshotOf(r.compiled.geometry), { generationId: 'g1', x: 4, z: 4 });
		const supportSummary =
			support.kind === 'candidates'
				? support.candidates.map((c) => ({ elevation: c.elevation, witnesses: c.witnesses.map((w) => w.roomId) }))
				: support.kind;
		const blocking = r.compiled.issues.filter((i) => i.severity !== 'warning').map((i) => i.code);
		// Observed answer, recorded rather than asserted as desirable.
		rec.row('P0.1 low ring inside hall accepted', 'pass', r.codec.success && !r.topology ? 'pass' : 'refuse', {
			components: r.components,
			faces: r.faces.faces.length,
			rooms,
			blockingIssues: blocking,
			floorSupportAt_4_4: supportSummary
		});
		expect(r.codec.success).toBe(true);
	});

	it('two independent enclosures overlapping in plan at the one datum', () => {
		const d = doc([ring('a-', sq(0, 0, 6, 6), 3), ring('b-', sq(4, 0, 10, 6), 3)]);
		const r = read(d);
		const support = queryFloorSupports(floorSupportSnapshotOf(r.compiled.geometry), { generationId: 'g1', x: 5, z: 3 });
		rec.row('P0.2 overlapping independent enclosures accepted', 'pass', r.codec.success && !r.topology ? 'pass' : 'refuse', {
			components: r.components,
			faces: r.faces.faces.length,
			rooms: r.compiled.geometry.rooms.map((room) => [room.roomId, room.floorElevation, room.ceilingElevation]),
			blockingIssues: r.compiled.issues.map((i) => i.code),
			floorSupportAt_5_3:
				support.kind === 'candidates'
					? support.candidates.map((c) => ({ elevation: c.elevation, witnesses: c.witnesses.map((w) => w.roomId) }))
					: support.kind
		});
	});

	it('raising the one datum moves every Wall; compiled ids are floor-scoped', () => {
		const base = doc([ring('a-', sq(0, 0, 6, 6), 3)]);
		const raised = doc([ring('a-', sq(0, 0, 6, 6), 3)], 1.2);
		const renamed = doc([ring('a-', sq(0, 0, 6, 6), 3)], 0, 'level-ground');
		const c0 = compileWallFirstLayoutGeometry(base).geometry;
		const c1 = compileWallFirstLayoutGeometry(raised).geometry;
		const c2 = compileWallFirstLayoutGeometry(renamed).geometry;
		const bottoms = (c: typeof c0) => c.walls.map((w) => w.bounds3.min[1]);
		const movedAll = bottoms(c1).every((y, i) => y === bottoms(c0)[i] + 1.2);
		const idsStableUnderRaise = c0.walls.every((w, i) => w.id === c1.walls[i]!.id);
		const idsStableUnderFloorId = c0.walls.every((w, i) => w.id === c2.walls[i]!.id);
		rec.row('P0.3 one datum raise moves all walls', 'pass', movedAll ? 'pass' : 'fail', {
			bottoms0: bottoms(c0),
			bottoms1: bottoms(c1),
			compiledIdsStableUnderRaise: idsStableUnderRaise,
			compiledIdsStableUnderFloorIdChange: idsStableUnderFloorId,
			sampleCompiledId: c0.walls[0]!.id
		});
	});

	it('two collinear overlapping Walls in independent components (duplicate physical solid at one datum)', () => {
		const wall = (id: string, a: string, b: string): LayoutWall => ({ id, startJunctionId: a, endJunctionId: b, role: 'partition', thickness: 0.2, height: 3, centerline: { kind: 'line' } });
		const d: LayoutDocumentWallFirst = {
			units: 'meters', formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION, floor: { id: 'floor', name: 'Floor', elevation: 0 },
			junctions: [{ id: 'a0', point: [0, 0] }, { id: 'a1', point: [6, 0] }, { id: 'b0', point: [3, 0] }, { id: 'b1', point: [9, 0] }],
			walls: [wall('wa', 'a0', 'a1'), wall('wb', 'b0', 'b1')], rooms: [], openings: [], objects: []
		};
		const r = read(d);
		const ws = r.compiled.geometry.walls.map((w) => ({ id: w.wallId, x: [w.bounds3.min[0], w.bounds3.max[0]], y: [w.bounds3.min[1], w.bounds3.max[1]] }));
		rec.row('P0.4 collinear overlap across components accepted (3 m shared run, two solids)', 'pass', r.codec.success && !r.topology ? 'pass' : 'refuse', {
			components: r.components, topologyIssue: r.topology ?? null, compiledWalls: ws, blockingIssues: r.compiled.issues.map((i) => i.code)
		});
	});

	it('flush', () => {
		const mismatches = rec.flush({ source: 'packages/layout-core @ HEAD' });
		expect(mismatches).toEqual([]);
	});
});
