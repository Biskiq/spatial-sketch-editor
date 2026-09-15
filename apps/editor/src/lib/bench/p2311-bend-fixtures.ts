import {
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	wallCubicChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

export type BendFixtureSpec = {
	id: string;
	walls: number;
	rooms: number;
	knots: number;
	openings: number;
	kind: 'bend' | 'rigid';
};

export const P2311_FIXTURES: BendFixtureSpec[] = [
	{ id: 'rigid-1-wall', walls: 1, rooms: 0, knots: 0, openings: 0, kind: 'rigid' },
	{ id: 'bend-1-wall', walls: 1, rooms: 0, knots: 0, openings: 0, kind: 'bend' },
	{ id: 'bend-3-room', walls: 12, rooms: 3, knots: 0, openings: 0, kind: 'bend' },
	{ id: 'bend-10-wall', walls: 10, rooms: 0, knots: 0, openings: 0, kind: 'bend' },
	{ id: 'bend-50-wall', walls: 50, rooms: 0, knots: 0, openings: 0, kind: 'bend' },
	{ id: 'bend-1-knot', walls: 1, rooms: 0, knots: 1, openings: 0, kind: 'bend' },
	{ id: 'bend-3-knot', walls: 1, rooms: 0, knots: 3, openings: 0, kind: 'bend' },
	{ id: 'bend-10-knot', walls: 1, rooms: 0, knots: 10, openings: 0, kind: 'bend' },
	{ id: 'bend-10-wall-openings', walls: 10, rooms: 0, knots: 0, openings: 10, kind: 'bend' },
	{ id: 'bend-3-room-openings', walls: 12, rooms: 3, knots: 0, openings: 10, kind: 'bend' },
	{ id: 'bend-10-room', walls: 40, rooms: 10, knots: 0, openings: 0, kind: 'bend' }
];

export function p2311Fixture(spec: BendFixtureSpec): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	const makeWall = (index: number, a: LayoutVec2, b: LayoutVec2, role: 'boundary' | 'partition') => {
		const startJunctionId = `j${index}a`;
		const endJunctionId = `j${index}b`;
		document.junctions.push({ id: startJunctionId, point: a }, { id: endJunctionId, point: b });
		const id = `w${index}`;
		document.walls.push({
			id, startJunctionId, endJunctionId, role, thickness: 0.2, height: 3,
			centerline: { kind: 'line' }
		});
		return id;
	};
	// The target is always w0, from [0,0] to [12,0]. Isolated rectangles are
	// spaced so the moving first boundary cannot touch another Room.
	if (spec.rooms > 0) {
		for (let roomIndex = 0; roomIndex < spec.rooms; roomIndex += 1) {
			const z = roomIndex * 20;
			const base = document.walls.length;
			const vertices: LayoutVec2[] = [[0, z], [12, z], [12, z + 10], [0, z + 10]];
			const ids: string[] = [];
			for (let edge = 0; edge < 4; edge += 1) {
				// Reuse the preceding edge's end Junction to preserve explicit connectivity.
				const aId = edge === 0 ? `r${roomIndex}j0` : `r${roomIndex}j${edge}`;
				const bId = `r${roomIndex}j${(edge + 1) % 4}`;
				if (edge === 0) document.junctions.push({ id: aId, point: vertices[0]! });
				if (edge < 3) document.junctions.push({ id: bId, point: vertices[edge + 1]! });
				const id = `w${base + edge}`;
				ids.push(id);
				document.walls.push({ id, startJunctionId: aId, endJunctionId: bId, role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } });
			}
			document.rooms.push({ id: `room${roomIndex}`, name: `Room ${roomIndex}`, boundary: ids.map((wallId) => ({ wallId, direction: 'forward' })), floorThickness: 0.1, ceilingThickness: 0.1 });
		}
	} else {
		makeWall(0, [0, 0], [12, 0], 'partition');
	}
	while (document.walls.length < spec.walls) {
		const index = document.walls.length;
		const z = spec.rooms * 20 + 20 + index * 5;
		makeWall(index, [0, z], [12, z], 'partition');
	}
	if (spec.knots > 0) {
		const points: LayoutVec2[] = [[0, 0]];
		const knots = Array.from({ length: spec.knots }, (_, index) => {
			const point: LayoutVec2 = [12 * (index + 1) / (spec.knots + 1), index % 2 === 0 ? 0.03 : -0.03];
			points.push(point);
			return { id: `w0:knot:${index + 1}`, point };
		});
		points.push([12, 0]);
		document.walls[0]!.centerline = wallCubicChain(knots, deriveChainSpans(points));
	}
	for (let index = 0; index < spec.openings; index += 1) {
		const wallId = document.walls[index % document.walls.length]!.id;
		document.openings.push({ id: `opening${index}`, wallId, kind: 'door', offset: 6, width: 1, height: 2, sillHeight: 0, profile: 'rectangular' });
	}
	return document;
}
