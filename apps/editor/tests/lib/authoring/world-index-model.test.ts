import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import {
	createWorldIndexModel,
	resolveWorldScope,
	worldScopeRows
} from '$lib/authoring/stage/shell/world-index-model';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

function twoRooms(): LayoutDocumentWallFirst {
	const base = createEmptyWallFirstLayoutDocument();
	const outer = planWallChain({
		baseline: base,
		points: [
			[0, 0],
			[6, 0],
			[6, 4],
			[0, 4]
		],
		close: true,
		capture: freshCapture(),
		levelId: base.floor.id
	});
	if (outer.kind !== 'success') throw new Error('enclosure refused');
	const split = planWallChain({
		baseline: outer.document,
		points: [
			[3, 0],
			[3, 4]
		],
		endpointHostSnaps: [
			{ pointIndex: 0, wallId: outer.document.walls[0]!.id },
			{ pointIndex: 1, wallId: outer.document.walls[2]!.id }
		],
		close: false,
		capture: freshCapture(),
		levelId: base.floor.id
	});
	if (split.kind !== 'success') throw new Error('divider refused');
	return split.document;
}
it('projects real Room boundaries, one shared Wall identity, loose Scene subjects and deletion fallback', () => {
	const layout = twoRooms();
	expect(layout.rooms).toHaveLength(2);
	const shared = layout.rooms[0]!.boundary.find((a) =>
		layout.rooms[1]!.boundary.some((b) => b.wallId === a.wallId)
	)!.wallId;
	const project = createWorldIndexModel();
	const sharedId = `layout:wall:${shared}`;
	const model = project(
		layout,
		[
			{
				sourceId: sharedId,
				label: 'Divider',
				authored: true,
				kind: 'Wall',
				eligible: true,
				revealed: false,
				membership: 'included',
				group: 'wall'
			},
			...layout.rooms.map((room) => ({
				sourceId: `layout:room-floor:${room.id}`,
				label: room.name,
				authored: true,
				kind: 'Floor',
				eligible: true,
				revealed: false,
				membership: 'included',
				group: 'room-floor'
			})),
			{
				sourceId: 'scene:entity:sculpture',
				label: 'Sculpture',
				authored: true,
				kind: 'Model',
				eligible: true,
				revealed: false,
				membership: 'included',
				group: 'scene'
			}
		],
		'Project'
	);
	for (const room of layout.rooms) {
		const rows = worldScopeRows(model, `room:${room.id}`, 'wall', '');
		expect(rows.rows.map((r) => r.sourceId)).toEqual([sharedId]);
	}
	expect(model.rows.find((r) => r.sourceId === 'scene:entity:sculpture')?.relations).toEqual([]);
	expect(worldScopeRows(model, 'project', 'scene', 'sculpture').rows[0]?.sourceId).toBe(
		'scene:entity:sculpture'
	);
	expect(resolveWorldScope(model, 'room:deleted')).toBe('floor');
	const empty = project(null, [], 'Replacement');
	expect(resolveWorldScope(empty, `room:${layout.rooms[0]!.id}`)).toBe('project');
});
it('caps lists without renumbering or discarding excluded/revealed identities', () => {
	const project = createWorldIndexModel();
	const model = project(
		null,
		Array.from({ length: 45 }, (_, i) => ({
			sourceId: `scene:${i}`,
			label: `Object ${i}`,
			authored: false,
			kind: 'Object',
			eligible: i !== 0,
			revealed: i === 1,
			membership: i === 0 ? 'excluded' : 'included',
			group: 'scene'
		})),
		'Project'
	);
	const first = worldScopeRows(model, 'project', 'all', '');
	expect(first.total).toBe(45);
	expect(first.rows).toHaveLength(40);
	expect(worldScopeRows(model, 'project', 'all', 'Object 44').rows[0]?.label).toBe('Object 44');
	expect(first.rows[0]?.eligible).toBe(false);
	expect(first.rows[1]?.revealed).toBe(true);
});
