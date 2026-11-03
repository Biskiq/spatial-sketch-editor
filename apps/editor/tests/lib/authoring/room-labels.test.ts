import { expect, it } from 'vitest';
import { pointInPolygon, type CompiledLayoutGeometry } from '@portfolio/layout-core';
import { roomLabelFacts, projectRoomLabels } from '$lib/authoring/stage/room-labels';

it('uses usable compiled area and a strict interior position on a concave floor, then declutters labels', () => {
	const polygon: [number, number][] = [[0,0],[3,0],[3,1],[1,1],[1,3],[0,3]];
	const geometry = { rooms: [{ roomId: 'r', floorPolygon: polygon, floorElevation: 2 }] } as unknown as CompiledLayoutGeometry;
	const facts = roomLabelFacts(geometry, [{ id: 'r', name: 'Gallery' }]);
	expect(facts[0]?.area).toBe(5);
	expect(facts[0]?.world[1]).toBe(2);
	expect(pointInPolygon([facts[0]!.world[0], facts[0]!.world[2]], polygon)).toBe(true);
	expect(projectRoomLabels(facts, point => [point[0] * 100, point[2] * 100], .01)).toMatchObject([{ name: 'Gallery', area: 5 }]);
	expect(projectRoomLabels(facts, point => [point[0], point[2]], 1)).toEqual([]);
	expect(projectRoomLabels([...facts, { ...facts[0]!, id: 'overlap' }], () => [100,100], .01)).toHaveLength(1);
	expect(roomLabelFacts({ rooms: [] } as unknown as CompiledLayoutGeometry, [{ id: 'draft', name: 'Draft' }])).toEqual([]);
	const renamed = roomLabelFacts(geometry, [{ id: 'r', name: 'East wing' }]);
	expect(renamed[0]?.name).toBe('East wing');
});
