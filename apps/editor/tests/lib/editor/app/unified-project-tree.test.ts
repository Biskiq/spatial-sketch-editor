import { describe, expect, it } from 'vitest';
import type { LayoutDocument } from '$lib/layout/layout-types';
import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst
} from '$lib/layout/layout-wall-first-types';
import type { SceneDocument, SceneEntity } from '$lib/content/scene';
import type { ActiveEditorSelection } from '$lib/editor/app/active-editor-selection.svelte';
import {
		buildUnifiedProjectTreeModel,
		filterUnifiedProjectTreeModel,
		isUnifiedTreeRowInteractive,
		isUnifiedTreeRowSelected,
		layoutRowToSelection,
		layoutSelectionAncestorRoomId,
		type UnifiedProjectTreeModel,
		type UnifiedTreeDiscovery,
		type UnifiedTreeRow
	} from '$lib/editor/unified-project-tree-model';
import { existsLibSource, readLibSource } from '../../../helpers/lib-source';
import type { LayoutSelection } from '$lib/editor/layout/layout-interaction';

function makeLayout(): LayoutDocument {
	return {
		units: 'meters',
		floors: [
			{
				id: 'floor-1',
				name: 'Floor 1',
				elevation: 0,
				height: 3,
				rooms: [
					{
						id: 'room-a',
						name: 'Atrium',
						frame: { origin: [0, 0], yaw: 0 },
						boundary: {
							closed: true,
							segments: [
								{ id: 'wall-a', kind: 'line', start: [0, 0], end: [4, 0] },
								{
									id: 'wall-b',
									kind: 'auto-bezier',
									start: [4, 0],
									end: [4, 3],
									interiorAnchors: [{ id: 'anchor-1', point: [4, 1.5] }]
								}
							]
						},
						wallThickness: 0.2,
						floorThickness: 0.1,
						ceilingThickness: 0.1,
						openings: [
							{
								id: 'opening-1',
								segmentId: 'wall-a',
								kind: 'door',
								offset: 1,
								width: 1,
								height: 2.1,
								sillHeight: 0,
								profile: 'rectangular'
							}
						]
					},
					{
						id: 'room-b',
						name: 'Gallery',
						frame: { origin: [6, 0], yaw: 0 },
						boundary: {
							closed: true,
							segments: [{ id: 'wall-c', kind: 'line', start: [6, 0], end: [10, 0] }]
						},
						wallThickness: 0.2,
						floorThickness: 0.1,
						ceilingThickness: 0.1,
						openings: []
					}
				]
			}
		],
		objects: [
			{
				id: 'object-1',
				kind: 'box',
				position: [1, 0, 1],
				rotation: [0, 0, 0],
				dimensions: [1, 1, 1],
				roomId: 'room-a'
			},
			{
				id: 'object-2',
				kind: 'sphere',
				position: [7, 0, 1],
				rotation: [0, 0, 0],
				dimensions: [1, 1, 1],
				roomId: 'room-b'
			},
			// Unowned object: must not nest under any room.
			{
				id: 'object-unowned',
				kind: 'box',
				position: [50, 0, 50],
				rotation: [0, 0, 0],
				dimensions: [1, 1, 1]
			}
		]
	};
}

function makeEntity(
	id: string,
	roomId: string,
	name = id
): SceneEntity {
	return {
		kind: 'primitive',
		primitive: 'box',
		id,
		name,
		roomId,
		position: [0, 0, 0],
		rotation: [0, 0, 0],
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true
	};
}

function makeScene(): SceneDocument {
	return {
		textures: [],
		materials: [],
		entities: [
			makeEntity('entity-a1', 'room-a'),
			makeEntity('entity-a2', 'room-a'),
			makeEntity('entity-b1', 'room-b')
		],
		clusters: [
			{ id: 'cluster-a', name: 'Sculpture', roomId: 'room-a', memberIds: ['entity-a1'] }
		],
		navigationNodes: [
			{
				id: 'node-1',
				roomId: 'room-a',
				label: 'Entrance',
				position: [0, 0, 0],
				cameraTarget: [1, 0, 1],
				fov: 60,
				connectedNodeIds: ['node-2'],
				nextNodeId: 'node-2'
			},
			{
				id: 'node-2',
				roomId: 'room-b',
				label: 'Exit',
				position: [1, 0, 1],
				cameraTarget: [0, 0, 0],
				fov: 60,
				connectedNodeIds: ['node-1'],
				previousNodeId: 'node-1'
			}
		],
		connections: [
			{
				id: 'connection-1',
				fromNodeId: 'node-1',
				toNodeId: 'node-2',
				clearance: 0.4,
				positionPath: { kind: 'rounded-polyline', anchors: [] }
			}
		]
	};
}

function buildModel(guidedTourNodeIds: string[] = ['node-1', 'node-2']): UnifiedProjectTreeModel {
	return buildUnifiedProjectTreeModel({
		layout: makeLayout(),
		scene: makeScene(),
		guidedTourNodeIds
	});
}

const discovery: UnifiedTreeDiscovery = { connectionId: 'connection-1', direction: 'forward' };

function layoutActive(
	selection: Extract<ActiveEditorSelection, { domain: 'layout' }>['selection']
): ActiveEditorSelection {
	return { domain: 'layout', selection } as ActiveEditorSelection;
}

describe('unified tree model', () => {
	it('orders rooms from the layout (floors flatMap) with qualified architecture children', () => {
		const model = buildModel();
		expect(model.rooms.map((room) => room.roomId)).toEqual(['room-a', 'room-b']);

		const atrium = model.rooms[0]!;
		expect(atrium.name).toBe('Atrium');
		expect(atrium.walls).toEqual([
			{ roomId: 'room-a', segmentId: 'wall-a', kind: 'line', anchors: [] },
			{
				roomId: 'room-a',
				segmentId: 'wall-b',
				kind: 'auto-bezier',
				anchors: [{ roomId: 'room-a', segmentId: 'wall-b', anchorId: 'anchor-1' }]
			}
		]);
		expect(atrium.openings).toEqual([
			{ roomId: 'room-a', segmentId: 'wall-a', openingId: 'opening-1', kind: 'door' }
		]);
		expect(atrium.objects).toEqual([{ objectId: 'object-1', kind: 'box' }]);
	});

	it('nests clusters and entities under their explicit roomId and drops unowned content', () => {
		const model = buildModel();
		const atrium = model.rooms[0]!;
		expect(atrium.clusters).toEqual([
			{ clusterId: 'cluster-a', name: 'Sculpture', memberIds: ['entity-a1'] }
		]);
		expect(atrium.entities.map((entity) => entity.entityId)).toEqual(['entity-a1', 'entity-a2']);

		const gallery = model.rooms[1]!;
		expect(gallery.entities.map((entity) => entity.entityId)).toEqual(['entity-b1']);
		expect(gallery.clusters).toEqual([]);

		// Unowned layout object and no dangling entities anywhere.
		const allObjectIds = model.rooms.flatMap((room) => room.objects.map((object) => object.objectId));
		expect(allObjectIds).not.toContain('object-unowned');
		const allEntityIds = model.rooms.flatMap((room) => room.entities.map((entity) => entity.entityId));
		expect(allEntityIds).not.toContain('entity-roomless');
	});

	it('keeps the camera tour root flat: guided chain in order + free nodes', () => {
		const model = buildModel(['node-2', 'node-1']);
		expect(model.cameraTour.guidedNodeIds).toEqual(['node-2', 'node-1']);
		expect(model.cameraTour.freeNodeIds).toEqual([]);

		const partial = buildModel(['node-1']);
		expect(partial.cameraTour.guidedNodeIds).toEqual(['node-1']);
		expect(partial.cameraTour.freeNodeIds).toEqual(['node-2']);
	});

	it('carries the exact LayoutSelection identity for every layout row', () => {
		const model = buildModel();
		const rows: UnifiedTreeRow[] = [
			{ kind: 'room', roomId: 'room-a' },
			{ kind: 'wall', roomId: 'room-a', segmentId: 'wall-b' },
			{ kind: 'opening', roomId: 'room-a', segmentId: 'wall-a', openingId: 'opening-1' },
			{ kind: 'interiorAnchor', roomId: 'room-a', segmentId: 'wall-b', anchorId: 'anchor-1' },
			{ kind: 'object', objectId: 'object-1' }
		];
		expect(rows.map((row) => layoutRowToSelection(row))).toEqual([
			{ kind: 'room', roomId: 'room-a' },
			{ kind: 'wall', roomId: 'room-a', segmentId: 'wall-b' },
			{ kind: 'opening', roomId: 'room-a', segmentId: 'wall-a', openingId: 'opening-1' },
			{ kind: 'interiorAnchor', roomId: 'room-a', segmentId: 'wall-b', anchorId: 'anchor-1' },
			{ kind: 'object', objectId: 'object-1' }
		]);
	});
});

describe('row selection matching', () => {
	it('highlights exactly the selected layout row for every layout kind', () => {
		const room: UnifiedTreeRow = { kind: 'room', roomId: 'room-a' };
		const wall: UnifiedTreeRow = { kind: 'wall', roomId: 'room-a', segmentId: 'wall-b' };
		const opening: UnifiedTreeRow = { kind: 'opening', roomId: 'room-a', segmentId: 'wall-a', openingId: 'opening-1' };
		const anchor: UnifiedTreeRow = { kind: 'interiorAnchor', roomId: 'room-a', segmentId: 'wall-b', anchorId: 'anchor-1' };
		const object: UnifiedTreeRow = { kind: 'object', objectId: 'object-1' };

		expect(isUnifiedTreeRowSelected(layoutActive({ kind: 'room', roomId: 'room-a' }), discovery, room)).toBe(true);
		expect(isUnifiedTreeRowSelected(layoutActive({ kind: 'room', roomId: 'room-a' }), discovery, wall)).toBe(false);
		expect(isUnifiedTreeRowSelected(layoutActive({ kind: 'wall', roomId: 'room-a', segmentId: 'wall-b' }), discovery, wall)).toBe(true);
		expect(isUnifiedTreeRowSelected(layoutActive({ kind: 'wall', roomId: 'room-a', segmentId: 'wall-b' }), discovery, opening)).toBe(false);
		expect(isUnifiedTreeRowSelected(layoutActive({ kind: 'opening', roomId: 'room-a', segmentId: 'wall-a', openingId: 'opening-1' }), discovery, opening)).toBe(true);
		expect(isUnifiedTreeRowSelected(layoutActive({ kind: 'interiorAnchor', roomId: 'room-a', segmentId: 'wall-b', anchorId: 'anchor-1' }), discovery, anchor)).toBe(true);
		expect(isUnifiedTreeRowSelected(layoutActive({ kind: 'object', objectId: 'object-1' }), discovery, object)).toBe(true);
		expect(isUnifiedTreeRowSelected(layoutActive({ kind: 'object', objectId: 'object-1' }), discovery, room)).toBe(false);
	});

	it('highlights a demoted selection (opening → wall) on the wall row', () => {
		const wall: UnifiedTreeRow = { kind: 'wall', roomId: 'room-a', segmentId: 'wall-a' };
		expect(
			isUnifiedTreeRowSelected(layoutActive({ kind: 'wall', roomId: 'room-a', segmentId: 'wall-a' }), discovery, wall)
		).toBe(true);
	});

	it('highlights scene rows from the workspace slot; room-only context stays out of the pure matcher', () => {
		const entity: UnifiedTreeRow = { kind: 'entity', entityId: 'entity-a2' };
		const cluster: UnifiedTreeRow = { kind: 'cluster', clusterId: 'cluster-a' };
		const room: UnifiedTreeRow = { kind: 'room', roomId: 'room-a' };

		const placement: ActiveEditorSelection = {
			domain: 'scene',
			selection: { kind: 'placement', ids: ['entity-a2'], clusterId: null, roomId: 'room-a' }
		};
		expect(isUnifiedTreeRowSelected(placement, discovery, entity)).toBe(true);
		expect(isUnifiedTreeRowSelected(placement, discovery, cluster)).toBe(false);
		// Multi-select: all selected ids highlight.
		const multi: ActiveEditorSelection = {
			domain: 'scene',
			selection: { kind: 'placement', ids: ['entity-a1', 'entity-a2'], clusterId: null, roomId: 'room-a' }
		};
		expect(isUnifiedTreeRowSelected(multi, discovery, { kind: 'entity', entityId: 'entity-a1' })).toBe(true);
		expect(isUnifiedTreeRowSelected(multi, discovery, { kind: 'entity', entityId: 'entity-a2' })).toBe(true);

		const clusterActive: ActiveEditorSelection = {
			domain: 'scene',
			selection: { kind: 'cluster', clusterId: 'cluster-a', roomId: 'room-a' }
		};
		expect(isUnifiedTreeRowSelected(clusterActive, discovery, cluster)).toBe(true);
		expect(isUnifiedTreeRowSelected(clusterActive, discovery, entity)).toBe(false);

		// Room-only latent context derives to domain 'none' (S3: context, never
		// actionable), so the pure matcher alone cannot see it — the component
		// adds the latent room-row highlight via `store.selectedRoomId` (the
		// same read the relic scene tree uses). The matcher stays `active`-only.
		const roomOnly: ActiveEditorSelection = { domain: 'none' };
		expect(isUnifiedTreeRowSelected(roomOnly, discovery, room)).toBe(false);
		expect(isUnifiedTreeRowSelected(roomOnly, discovery, entity)).toBe(false);
	});

	it('highlights camera rows from navigation; connection header covers anchor + keyframe children', () => {
		const node: UnifiedTreeRow = { kind: 'camera-node', nodeId: 'node-1' };
		const connection: UnifiedTreeRow = { kind: 'camera-connection', connectionId: 'connection-1' };
		const direction: UnifiedTreeRow = { kind: 'camera-direction', connectionId: 'connection-1', direction: 'forward' };
		const keyframe: UnifiedTreeRow = { kind: 'camera-keyframe', connectionId: 'connection-1', direction: 'forward', keyframeId: 'key-1' };

		const nodeActive: ActiveEditorSelection = {
			domain: 'camera',
			selection: { kind: 'node', nodeId: 'node-1', handle: 'position' }
		};
		expect(isUnifiedTreeRowSelected(nodeActive, discovery, node)).toBe(true);
		expect(isUnifiedTreeRowSelected(nodeActive, discovery, connection)).toBe(false);

		const connectionActive: ActiveEditorSelection = {
			domain: 'camera',
			selection: { kind: 'connection', connectionId: 'connection-1', direction: 'forward' }
		};
		expect(isUnifiedTreeRowSelected(connectionActive, discovery, connection)).toBe(true);
		expect(isUnifiedTreeRowSelected(connectionActive, discovery, direction)).toBe(true);
		expect(isUnifiedTreeRowSelected(connectionActive, discovery, keyframe)).toBe(false);

		const keyframeActive: ActiveEditorSelection = {
			domain: 'camera',
			selection: { kind: 'view-keyframe', connectionId: 'connection-1', direction: 'forward', keyframeId: 'key-1' }
		};
		expect(isUnifiedTreeRowSelected(keyframeActive, discovery, keyframe)).toBe(true);
		expect(isUnifiedTreeRowSelected(keyframeActive, discovery, connection)).toBe(true);
	});

	it('highlights direction rows from discovery with no navigation selection (scrubbing), gated to camera-or-none', () => {
		const direction: UnifiedTreeRow = { kind: 'camera-direction', connectionId: 'connection-1', direction: 'forward' };

		// No selection at all, discovery set → scrub highlight preserved.
		expect(isUnifiedTreeRowSelected({ domain: 'none' }, discovery, direction)).toBe(true);
		expect(isUnifiedTreeRowSelected({ domain: 'none' }, { connectionId: null, direction: 'forward' }, direction)).toBe(false);

		// A layout selection never co-highlights a camera row.
		expect(
			isUnifiedTreeRowSelected(layoutActive({ kind: 'room', roomId: 'room-a' }), discovery, direction)
		).toBe(false);
		// A scene selection never co-highlights a camera row.
		const scene: ActiveEditorSelection = {
			domain: 'scene',
			selection: { kind: 'placement', ids: ['entity-a1'], clusterId: null, roomId: 'room-a' }
		};
		expect(isUnifiedTreeRowSelected(scene, discovery, direction)).toBe(false);
	});

	it('highlights an anchor direction row only when selection and discovery agree on the connection', () => {
		const direction: UnifiedTreeRow = { kind: 'camera-direction', connectionId: 'connection-1', direction: 'forward' };
		const anchorActive: ActiveEditorSelection = {
			domain: 'camera',
			selection: { kind: 'anchor', connectionId: 'connection-1', anchorId: 'anchor-1' }
		};

		// Selection and discovery both on connection-1 forward → highlight.
		expect(isUnifiedTreeRowSelected(anchorActive, discovery, direction)).toBe(true);
		// Discovery direction differs on the same connection → no highlight.
		expect(
			isUnifiedTreeRowSelected(
				anchorActive,
				{ connectionId: 'connection-1', direction: 'reverse' },
				direction
			)
		).toBe(false);
		// Discovery moved to another connection while the anchor selection
		// persists → no highlight (direction rows are discovery-owned, so the
		// discovery connection must match the row too).
		expect(
			isUnifiedTreeRowSelected(
				anchorActive,
				{ connectionId: 'connection-2', direction: 'forward' },
				direction
			)
		).toBe(false);
		// No discovery at all → no highlight.
		expect(isUnifiedTreeRowSelected(anchorActive, null, direction)).toBe(false);
	});

	it('never highlights across domains: layout active hides scene rows and vice versa', () => {
		const entity: UnifiedTreeRow = { kind: 'entity', entityId: 'entity-a1' };
		const layout: ActiveEditorSelection = { domain: 'layout', selection: { kind: 'room', roomId: 'room-a' } };
		expect(isUnifiedTreeRowSelected(layout, discovery, entity)).toBe(false);
		expect(isUnifiedTreeRowSelected(layout, discovery, { kind: 'cluster', clusterId: 'cluster-a' })).toBe(false);
		expect(isUnifiedTreeRowSelected(layout, discovery, { kind: 'camera-node', nodeId: 'node-1' })).toBe(false);

		const scene: ActiveEditorSelection = {
			domain: 'scene',
			selection: { kind: 'placement', ids: ['entity-a1'], clusterId: null, roomId: 'room-a' }
		};
		expect(isUnifiedTreeRowSelected(scene, discovery, { kind: 'wall', roomId: 'room-a', segmentId: 'wall-a' })).toBe(false);
	});
});	describe('domain×view×mode-aware interactivity (P2.2 + P10)', () => {
	it('gates structural layout rows to Scene 3D or Scene Plan Layout mode', () => {
		const room: UnifiedTreeRow = { kind: 'room', roomId: 'room-a' };
		const wall: UnifiedTreeRow = { kind: 'wall', roomId: 'room-a', segmentId: 'wall-a' };
		const opening: UnifiedTreeRow = { kind: 'opening', roomId: 'room-a', segmentId: 'wall-a', openingId: 'opening-1' };
		const anchor: UnifiedTreeRow = { kind: 'interiorAnchor', roomId: 'room-a', segmentId: 'wall-b', anchorId: 'anchor-1' };
		for (const row of [room, wall, opening, anchor]) {
			expect(isUnifiedTreeRowInteractive(row, 'scene', 'plan', 'layout')).toBe(true);
			expect(isUnifiedTreeRowInteractive(row, 'scene', 'plan', 'staging')).toBe(false);
			expect(isUnifiedTreeRowInteractive(row, 'scene', '3d')).toBe(true);
			// Camera domain: the scene plan is read-only spatial context (§C §4.6).
			expect(isUnifiedTreeRowInteractive(row, 'camera', 'plan')).toBe(false);
			expect(isUnifiedTreeRowInteractive(row, 'camera', '3d')).toBe(false);
		}
	});

	it('gates Layout-object rows to Scene 3D, Layout mode, and Arrange (P10)', () => {
		const object: UnifiedTreeRow = { kind: 'object', objectId: 'object-1' };
		expect(isUnifiedTreeRowInteractive(object, 'scene', 'plan', 'layout')).toBe(true);
		expect(isUnifiedTreeRowInteractive(object, 'scene', 'plan', 'staging')).toBe(true);
		expect(isUnifiedTreeRowInteractive(object, 'scene', '3d')).toBe(true);
		expect(isUnifiedTreeRowInteractive(object, 'camera', 'plan')).toBe(false);
		expect(isUnifiedTreeRowInteractive(object, 'camera', '3d')).toBe(false);
	});

	it('gates scene rows to Scene 3D or Scene Plan Staging mode', () => {
		const entity: UnifiedTreeRow = { kind: 'entity', entityId: 'entity-a1' };
		const cluster: UnifiedTreeRow = { kind: 'cluster', clusterId: 'cluster-a' };
		for (const row of [entity, cluster]) {
			expect(isUnifiedTreeRowInteractive(row, 'scene', '3d')).toBe(true);
			expect(isUnifiedTreeRowInteractive(row, 'scene', 'plan', 'layout')).toBe(false);
			expect(isUnifiedTreeRowInteractive(row, 'scene', 'plan', 'staging')).toBe(true);
			expect(isUnifiedTreeRowInteractive(row, 'camera', '3d')).toBe(false);
		}
	});

	it('gates camera rows to the Camera domain, both views', () => {
		const node: UnifiedTreeRow = { kind: 'camera-node', nodeId: 'node-1' };
		const connection: UnifiedTreeRow = { kind: 'camera-connection', connectionId: 'conn-a' };
		const direction: UnifiedTreeRow = { kind: 'camera-direction', connectionId: 'conn-a', direction: 'forward' };
		const keyframe: UnifiedTreeRow = { kind: 'camera-keyframe', connectionId: 'conn-a', direction: 'forward', keyframeId: 'kf-1' };
		for (const row of [node, connection, direction, keyframe]) {
			expect(isUnifiedTreeRowInteractive(row, 'camera', 'plan')).toBe(true);
			expect(isUnifiedTreeRowInteractive(row, 'camera', '3d')).toBe(true);
			expect(isUnifiedTreeRowInteractive(row, 'scene', '3d')).toBe(false);
		}
	});
});

describe('pick-expand ancestor resolution', () => {
	const layout = makeLayout();

	it('returns the carrying roomId for room/wall/opening/anchor selections', () => {
		expect(layoutSelectionAncestorRoomId({ kind: 'room', roomId: 'room-a' }, layout)).toBe('room-a');
		expect(
			layoutSelectionAncestorRoomId({ kind: 'wall', roomId: 'room-a', segmentId: 'wall-a' }, layout)
		).toBe('room-a');
		expect(
			layoutSelectionAncestorRoomId(
				{ kind: 'opening', roomId: 'room-a', segmentId: 'wall-a', openingId: 'opening-1' },
				layout
			)
		).toBe('room-a');
		expect(
			layoutSelectionAncestorRoomId(
				{ kind: 'interiorAnchor', roomId: 'room-a', segmentId: 'wall-b', anchorId: 'anchor-1' },
				layout
			)
		).toBe('room-a');
	});

	it('resolves an object selection through the layout document', () => {
		expect(layoutSelectionAncestorRoomId({ kind: 'object', objectId: 'object-1' }, layout)).toBe('room-a');
		expect(layoutSelectionAncestorRoomId({ kind: 'object', objectId: 'object-2' }, layout)).toBe('room-b');
	});

	it('returns null for none / missing / unowned object selections', () => {
		expect(layoutSelectionAncestorRoomId({ kind: 'none' }, layout)).toBeNull();
		expect(
			layoutSelectionAncestorRoomId({ kind: 'object', objectId: 'object-missing' }, layout)
		).toBeNull();
		expect(
			layoutSelectionAncestorRoomId({ kind: 'object', objectId: 'object-unowned' }, layout)
		).toBeNull();
	});
});

describe('hierarchy filter', () => {
	it('returns the model untouched for an empty or whitespace query', () => {
		const model = buildModel();
		expect(filterUnifiedProjectTreeModel(model, '')).toBe(model);
		expect(filterUnifiedProjectTreeModel(model, '   ')).toBe(model);
	});

	it('narrows rooms by name and prunes non-matching rooms', () => {
		const filtered = filterUnifiedProjectTreeModel(buildModel(), 'Atrium');
		expect(filtered.rooms.map((room) => room.roomId)).toEqual(['room-a']);
	});

	it('keeps the ancestor room when only a descendant matches', () => {
		const filtered = filterUnifiedProjectTreeModel(buildModel(), 'wall-b');
		expect(filtered.rooms.map((room) => room.roomId)).toEqual(['room-a']);
		expect(filtered.rooms[0]!.walls.map((wall) => wall.segmentId)).toEqual(['wall-b']);
	});

	it('matches a wall through its bend anchor and keeps the wall', () => {
		const filtered = filterUnifiedProjectTreeModel(buildModel(), 'anchor-1');
		expect(filtered.rooms[0]!.walls.map((wall) => wall.segmentId)).toEqual(['wall-b']);
	});

	it('matches openings and objects by kind or id', () => {
		const byKind = filterUnifiedProjectTreeModel(buildModel(), 'door');
		expect(byKind.rooms[0]!.openings.map((opening) => opening.openingId)).toEqual(['opening-1']);

		const byObjectId = filterUnifiedProjectTreeModel(buildModel(), 'object-2');
		expect(byObjectId.rooms.map((room) => room.roomId)).toEqual(['room-b']);
		expect(byObjectId.rooms[0]!.objects.map((object) => object.objectId)).toEqual(['object-2']);
	});

	it('matches cluster members by entity name and prunes non-matching members', () => {
		const filtered = filterUnifiedProjectTreeModel(buildModel(), 'entity-a1');
		const room = filtered.rooms[0]!;
		expect(room.clusters).toEqual([
			{ clusterId: 'cluster-a', name: 'Sculpture', memberIds: ['entity-a1'] }
		]);
		expect(room.entities.map((entity) => entity.entityId)).toContain('entity-a1');
	});

	it('matches standalone entities by name or id', () => {
		const filtered = filterUnifiedProjectTreeModel(buildModel(), 'entity-b1');
		expect(filtered.rooms.map((room) => room.roomId)).toEqual(['room-b']);
		expect(filtered.rooms[0]!.entities.map((entity) => entity.entityId)).toEqual(['entity-b1']);
	});

	it('is case-insensitive and carries the camera tour through unchanged', () => {
		const model = buildModel();
		const filtered = filterUnifiedProjectTreeModel(model, 'ATRIUM');
		expect(filtered.rooms.map((room) => room.roomId)).toEqual(['room-a']);
		expect(filtered.cameraTour).toBe(model.cameraTour);
	});

	it('yields an empty room list when nothing matches', () => {
		const filtered = filterUnifiedProjectTreeModel(buildModel(), 'zzz-no-match');
		expect(filtered.rooms).toEqual([]);
	});
});

/**
 * P23.3 — canonical wall-first documents. A new project boots wall-first, so
 * the sidebar must count and list their Rooms; before this the tree reported
 * zero Rooms for a document that had them. Canonical Rooms are keyed by
 * document-global `wallId`, never squeezed into the legacy `segmentId` rows.
 */
describe('unified project tree — wall-first documents', () => {
	function makeWallFirstLayout(): LayoutDocumentWallFirst {
		return {
			units: 'meters',
			// Canonical-current fixture (P23.6H bumped the format 4 → 5).
			formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
			floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
			junctions: [
				{ id: 'j1', point: [0, 0] },
				{ id: 'j2', point: [5, 0] },
				{ id: 'j3', point: [5, 4] },
				{ id: 'j4', point: [0, 4] }
			],
			walls: [
				{ id: 'w1', startJunctionId: 'j1', endJunctionId: 'j2', role: 'boundary', thickness: 0.15, height: 2.8, centerline: { kind: 'line' } as const},
				{ id: 'w2', startJunctionId: 'j2', endJunctionId: 'j3', role: 'boundary', thickness: 0.15, height: 2.8, centerline: { kind: 'line' } as const},
				{ id: 'w3', startJunctionId: 'j3', endJunctionId: 'j4', role: 'boundary', thickness: 0.15, height: 2.8, centerline: { kind: 'line' } as const},
				{ id: 'w4', startJunctionId: 'j4', endJunctionId: 'j1', role: 'boundary', thickness: 0.15, height: 2.8, centerline: { kind: 'line' } as const},
				// Partition that bounds no Room; its Opening is not the Room's.
				{ id: 'w5', startJunctionId: 'j1', endJunctionId: 'j3', role: 'partition', thickness: 0.1, height: 2.8, centerline: { kind: 'line' } as const}
			],
			rooms: [
				{
					id: 'room-wf',
					name: 'Canonical Room',
					boundary: [
						{ wallId: 'w1', direction: 'forward' },
						{ wallId: 'w2', direction: 'forward' },
						{ wallId: 'w3', direction: 'forward' },
						{ wallId: 'w4', direction: 'forward' },
						// Dangling ref (mid-flight topology edit) must not surface.
						{ wallId: 'w-gone', direction: 'forward' }
					],
					floorThickness: 0.1,
					ceilingThickness: 0.1
				}
			],
			openings: [
				{ id: 'op-1', wallId: 'w1', kind: 'door', offset: 1, width: 0.9, height: 2.1, sillHeight: 0, profile: 'rectangular' },
				{ id: 'op-2', wallId: 'w5', kind: 'window', offset: 0.5, width: 0.9, height: 1.2, sillHeight: 0.9, profile: 'rectangular' }
			],
			objects: []
		};
	}

	function buildWallFirstModel() {
		return buildUnifiedProjectTreeModel({
			layout: makeWallFirstLayout(),
			scene: { textures: [], materials: [], entities: [], navigationNodes: [], connections: [] },
			guidedTourNodeIds: []
		});
	}

	it('counts canonical Rooms and lists each with its own boundary Walls', () => {
		const model = buildWallFirstModel();

		// The legacy bucket stays empty: canonical Rooms never reuse the
		// (roomId, segmentId) row identity.
		expect(model.rooms).toEqual([]);
		expect(model.wallFirstRooms).toHaveLength(1);

		const room = model.wallFirstRooms[0]!;
		expect(room.roomId).toBe('room-wf');
		expect(room.name).toBe('Canonical Room');
		// Dangling boundary ref dropped; document order preserved.
		expect(room.wallIds).toEqual(['w1', 'w2', 'w3', 'w4']);
		// Only Openings hosted by THIS Room's Walls — the partition's is not.
		expect(room.openingIds).toEqual(['op-1']);
	});

	it('keeps the legacy bucket empty of canonical rooms and vice versa', () => {
		const legacy = buildUnifiedProjectTreeModel({
			layout: makeLayout(),
			scene: { textures: [], materials: [], entities: [], navigationNodes: [], connections: [] },
			guidedTourNodeIds: []
		});
		expect(legacy.wallFirstRooms).toEqual([]);
		expect(legacy.rooms).toHaveLength(2);
	});

	it('filters canonical Rooms by room, Wall and Opening identity', () => {
		const model = buildWallFirstModel();

		expect(filterUnifiedProjectTreeModel(model, 'canonical').wallFirstRooms).toHaveLength(1);
		expect(filterUnifiedProjectTreeModel(model, 'w3').wallFirstRooms).toHaveLength(1);
		expect(filterUnifiedProjectTreeModel(model, 'op-1').wallFirstRooms).toHaveLength(1);
		expect(filterUnifiedProjectTreeModel(model, 'zzz-no-match').wallFirstRooms).toEqual([]);
		// A partition's Wall is not any Room's, so its id matches nothing here.
		expect(filterUnifiedProjectTreeModel(model, 'w5').wallFirstRooms).toEqual([]);
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('unified hierarchy contracts', () => {
	it('keeps the camera tree internals reusable behind optional props (relic default behavior)', () => {
		const guided = readLibSource('editor/CameraFlowPanel.svelte');
		// The optional gate prop defaults to true when absent (the relic never
		// passes it and keeps its legacy behavior).
		expect(guided).toMatch(/interactive\??:/);
	});
	it('gates every guided/free node-row pick in CameraFlowPanel behind interactive (Plan gate)', () => {
		// The Plan gate is behavioral, not just prop presence: the node-row
		// select click (and the neighbors chevron) must be no-ops when
		// interactive is false — a plain `onclick={() => selectNode(node.id)}`
		// would leak the camera domain into Plan (the plan's locked
		// "scene/camera rows aria-disabled no-ops" decision).
		const guided = readLibSource('editor/CameraFlowPanel.svelte');
		// Row select is gated and carries aria-disabled on guided + free rows;
		// P1.9 neighbor rows are gated identically (select = partner row).
		expect(guided).not.toContain('onclick={() => selectNode(node.id)}');
		expect(guided.match(/onclick=\{interactive \? \(\) => selectNode\(node\.id\) : undefined\}/g)).toHaveLength(3);
		expect(guided.match(/onclick=\{interactive \? \(\) => selectNode\(partner\.id\) : undefined\}/g)).toHaveLength(2);
		expect(guided.match(/onclick=\{interactive \? \(\) => toggleNodeNeighbors\(node\.id\) : undefined\}/g)).toHaveLength(2);
		// aria-disabled appears on every gated surface: guided li + chevron +
		// row, free li + chevron + row, detour row, both neighbor rows.
		expect(guided.match(/aria-disabled=\{interactive \? undefined : true\}/g)).toHaveLength(9);
	});
	it('routes the Camera domain to the four-section Camera Sidebar and keeps Scene on the unified tree', () => {
		const sidebar = readLibSource('editor/app/EditorSidebar.svelte');
		// Camera domain renders the dedicated sidebar; the unified tree (with
		// the Assets sibling) stays the Scene-domain panel.
		expect(sidebar).toContain('CameraSidebar');
		expect(sidebar).toContain("domain === 'camera'");
		expect(sidebar).toContain('<UnifiedProjectTree');

		const cameraSidebar = readLibSource('editor/app/CameraSidebar.svelte');
		// Canonical four sections: Environment header + the panel's three.
		expect(cameraSidebar).toContain('<h2>Environment</h2>');
		expect(cameraSidebar).toContain('CameraFlowPanel');
		// Environment is read-only context: rows carry aria-disabled and no
		// select/mutation handlers.
		expect(cameraSidebar.match(/aria-disabled="true"/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
		expect(cameraSidebar).not.toContain('onclick={() => store');
		expect(cameraSidebar).not.toContain('deleteLayout');

		const panel = readLibSource('editor/CameraFlowPanel.svelte');
		// Amended terminology: Sequence Inspector / Unsequenced / Connections.
		expect(panel).toContain('<h2>Sequence Inspector</h2>');
		expect(panel).toContain('<h2>Unsequenced</h2>');
		expect(panel).toContain('<h2>Connections</h2>');
		expect(panel).not.toContain('Not in order yet');
		expect(panel).not.toContain('Free navigation nodes');
		expect(panel).not.toContain('Connections / Advanced');
		expect(panel).not.toContain('↔');
		// Undirected topology labels only (chain records + retained tray).
		expect(panel).toContain('chainConnectionRows');
		expect(panel).toContain('connectionRows');
		// P1.9 — drag-only reorder (no per-row order arrows), tail-row
		// "Set as First" hidden, Branches terminology, flat neighbor list.
		expect(panel).not.toContain('ArrowUp');
		expect(panel).not.toContain('ArrowDown');
		expect(panel).not.toContain('moveGuidedNode');
		expect(panel).toContain('index > 0 && index < guidedTourChain.length - 1');
		expect(panel).toContain('<h3 class="sub-section-header">Branches ·');
		expect(panel).not.toContain('kept as free');
		expect(panel).toContain('neighborRowsOf');
	});
	it('keeps the unified tree mounted across Hierarchy|Assets tabs and hides the boot header correctly', () => {
		const sidebar = readLibSource('editor/app/EditorSidebar.svelte');
		// The tree must not unmount when the Assets tab is active (its
		// component-local expansion state would be lost) — it renders
		// unconditionally and the inactive panel is hidden by class, with the
		// Assets library as a 3D-only sibling.
		expect(sidebar).toContain('<UnifiedProjectTree');
		expect(sidebar.match(/class:panel-content--hidden/g)?.length).toBe(2);
		// importError is `string | null`, so the boot-empty header check must
		// be `!== null` — `!== undefined` is always true and would show the
		// header strip on every blank boot.
		expect(sidebar).toContain('layoutPreview.importError !== null');
	});
	it('owns neighbor expansion in the sidebar and leaves the discovery direction highlight to the Inspector', () => {
		// P1.9 — NodeConnectionsPanel is deleted: row expansion is a flat
		// neighbor list (graph truth) owned by CameraFlowPanel, and the
		// discovery-driven direction highlight left the sidebar with it
		// (a node list has no direction). Connection detail stays available
		// via the Connections section / Inspector / Plan edges / Timeline.
		expect(existsLibSource('editor/NodeConnectionsPanel.svelte')).toBe(false);
		const guided = readLibSource('editor/CameraFlowPanel.svelte');
		expect(guided).not.toContain('activeDomain');
		expect(guided).toContain('neighborRowsOf');
		// The accordion is sidequest-only: ordered Sequence neighbors are already
		// represented by the list and must not be repeated in its sub-list.
		expect(guided).toContain('!guidedTourChain.includes(row.partnerId)');
		expect(guided).toContain('sidequest list');
		// No store toggle API for the deleted per-connection tree.
		const facade = readLibSource('editor/editor-store.svelte.ts');
		expect(facade).not.toContain('toggleCameraConnectionTreeExpansion');
		expect(facade).not.toContain('toggleCameraDirectionTreeExpansion');
	});
	it('seeds the empty chain only through the manual Start Sequence affordance', () => {
		const guided = readLibSource('editor/CameraFlowPanel.svelte');
		// P1.9 — empty-chain promotion is manual (connecting 3+ cameras never
		// auto-promotes): eligible unsequenced rows carry Start Sequence,
		// isolated rows show nothing, one transaction per seed.
		expect(guided).toContain('startSequenceEligible');
		expect(guided).toContain('store.startSequenceFromNode(nodeId)');
		expect(guided).toContain('title="Start Sequence"');
		// Empty Sequence has a real drop target; dropping a row uses the same
		// manual pair-promotion command instead of the strict insertion validator.
		expect(guided).toContain('guided-gap--empty');
		expect(guided).toContain('guidedTourChain.length === 0');
		expect(guided).toContain('startSequence(nodeId);');
		const facade = readLibSource('editor/editor-store.svelte.ts');
		expect(facade).toContain('startSequenceFromNode(nodeId)');
	});
	it('expands the ancestor chain for every active layout/scene selection, not just rooms', () => {
		const tree = readLibSource('editor/UnifiedProjectTree.svelte');
		const model = readLibSource('editor/unified-project-tree-model.ts');
		// Viewport picks don't route through the tree's select* helpers (which
		// already expand), so the tree must reveal the picked row for any active
		// layout/scene selection — including cluster ancestors.
		expect(tree).toContain('ensureClusterTreeExpanded');
		expect(model).toContain('export function layoutSelectionAncestorRoomId');
	});
	it('pins the P23.6b canonical reveal helper beside the legacy ancestor helper', () => {
		const tree = readLibSource('editor/UnifiedProjectTree.svelte');
		const model = readLibSource('editor/unified-project-tree-model.ts');
		const navigator = readLibSource('editor/hierarchy/HierarchyNavigator.svelte');
		// Both pure helpers stay exported and covered (their behavior is pinned
		// above). P23.6e moved canonical reveal off the accordion: the tree keeps
		// only the legacy Room-qualified ancestor helper, and the Navigator owns
		// canonical reveal through the pure page/search representation model.
		expect(model).toContain('export function layoutSelectionRevealTarget');
		expect(model).toContain("export function layoutSelectionAncestorRoomId");
		expect(tree).not.toContain('layoutSelectionRevealTarget');
		expect(navigator).toContain('evaluateHierarchyReveal');
	});
	it('keeps the P23.6b format-gated roots empty for legacy documents', () => {
		const model = readLibSource('editor/unified-project-tree-model.ts');
		// The legacy branch must return empty canonical roots so legacy
		// Room-nested objects/entities never render twice.
		expect(model).toContain("architecture: { walls: [], junctions: [] }");
		expect(model).toContain("layoutObjects: []");
		expect(model).toContain("sceneContent: { clusters: [], entities: [] }");
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('camera context contracts', () => {
	it('renders the Sequence Inspector loop row as a derived readout, never a Close-loop mutation', () => {
		const panel = readLibSource('editor/CameraFlowPanel.svelte');
		expect(panel).toContain('Loops via:');
		expect(panel).toContain('Disconnect Loop');
		expect(panel).toContain('Stops at');
		expect(panel).toContain('+ Connect to');
		// The loop row only renders for N ≥ 3 (a two-node pair never loops and
		// never shows a loop row).
		expect(panel).toContain('showLoopRow = $derived(guidedTourChain.length >= 3)');
		// [Disconnect Loop] is a plain connection deletion; connecting is the
		// ordinary connect-existing flow. No Close-loop mutation anywhere.
		expect(panel).toContain('store.deleteConnection(flowLoopConnectionId)');
		expect(panel).toContain('store.beginConnectExistingNodes()');
		expect(panel).not.toContain('closeGuidedTourLoop');
		expect(panel).not.toContain('findClosableGuidedChain');
	});
	it('renders the detour groups and the undirected Connections list in the Sequence Inspector', () => {
		const panel = readLibSource('editor/CameraFlowPanel.svelte');
		expect(panel).toContain('store.flowDetourGroups');
		expect(panel).toContain('store.flowLoopConnectionId');
		expect(panel).toContain('Branch at');
		expect(panel).toContain('store.removeDetour(');
		expect(panel).toContain('store.removeDetourNode(');
		expect(panel).toContain('<h2>Unsequenced</h2>');
		expect(panel).toContain('<h2>Connections</h2>');
		expect(panel).toContain('chainConnectionRows');
		expect(panel).toContain('store.appendDetourNode(');
		expect(panel).toContain('finalPairConnectionIds');
		expect(panel).toContain('both cameras return to Unsequenced');
	});
	it('adds per-row visibility and kebab actions to the Rooms tree, plus a Rooms add button', () => {
		const tree = readLibSource('editor/UnifiedProjectTree.svelte');
		expect(tree).toContain('EllipsisVertical');
		expect(tree).toContain('<Eye size={14}');
		expect(tree).toContain('<EyeOff size={14}');
		expect(tree).toContain('<Plus size={14}');
		expect(tree).toContain('onAddRoom');
		expect(tree).toContain('store.toggleEntityVisibility(');
		expect(tree).toContain('store.focusRoom(');
		expect(tree).toContain('store.focusPlacement(');
		expect(tree).toContain('store.deletePlacements(');
		expect(tree).toContain('deleteLayoutRoom(');
		expect(tree).toContain('deleteLayoutObject(');
		expect(tree).toContain('deleteLayoutOpening(');
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('asset library selection contracts', () => {
	it('an explicit Models-tab click deselects the active selection so the asset panel shows; filters never do', () => {
		const library = readLibSource('editor/EditorAssetLibrary.svelte');
		const sidebar = readLibSource('editor/app/EditorSidebar.svelte');
		const app = readLibSource('editor/app/EditorApp.svelte');
		// The explicit-click channel is distinct from `onselectionchange` (which
		// also fires on filter-driven list changes and must never deselect a
		// scene pick).
		expect(library).toContain('onSelectAsset');
		expect(library).toContain('onSelectAsset?.(asset)');
		expect(library).toContain('onselectionchange');
		expect(sidebar).toContain('onSelectAsset');
		expect(app).toContain('onSelectAsset');
		expect(app).toContain('activeSelection.deselectActive()');
		// The relic keeps frozen behavior: no deselect-on-asset-click wiring.
		expect(readLibSource('editor/EditorLeftSidebar.svelte')).not.toContain('onSelectAsset');
	});
});
