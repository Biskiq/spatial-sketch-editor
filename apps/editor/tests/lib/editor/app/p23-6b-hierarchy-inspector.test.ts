import { describe, expect, it } from 'vitest';
import type { LayoutDocument } from '$lib/layout/layout-types';
import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst
} from '$lib/layout/layout-wall-first-types';
import type { SceneDocument } from '$lib/content/scene';
import type { MaterialId } from '$lib/content/scene';
import {
	buildUnifiedProjectTreeModel,
	filterUnifiedProjectTreeModel,
	isUnifiedTreeRowInteractive,
	isUnifiedTreeRowSelected,
	layoutRowToSelection,
	layoutSelectionAncestorRoomId,
	layoutSelectionRevealTarget,
	type UnifiedProjectTreeModel,
	type UnifiedTreeRow
} from '$lib/editor/unified-project-tree-model';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB_DIR = fileURLToPath(new URL('../../../../src/lib', import.meta.url));

function readLibSource(relativePath: string): string {
	return fs.readFileSync(path.join(LIB_DIR, relativePath), 'utf8');
}

function makeEntity(id: string, roomId: string, name = id) {
	return {
		kind: 'primitive' as const,
		primitive: 'box' as const,
		id,
		name,
		roomId,
		position: [0, 0, 0] as [number, number, number],
		rotation: [0, 0, 0] as [number, number, number],
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId: 'plaster-warm' as MaterialId,
		castShadow: true,
		receiveShadow: true
	};
}

/** Legacy compatibility document: two rooms, Room-associated objects, scene content. */
function makeLegacyLayout(): LayoutDocument {
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
							segments: [{ id: 'wall-a', kind: 'line', start: [0, 0], end: [4, 0] }]
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
			}
		]
	};
}

/**
 * P23.6b wall-first document with a **shared Wall**: `w2` bounds both rooms,
 * so the Architecture group must show it exactly once (D2).
 */
function makeWallFirstLayout(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [
			{ id: 'j1', point: [0, 0] },
			{ id: 'j2', point: [5, 0] },
			{ id: 'j3', point: [5, 4] },
			{ id: 'j4', point: [0, 4] },
			{ id: 'j5', point: [10, 4] }
		],
		walls: [
			{ id: 'w1', startJunctionId: 'j1', endJunctionId: 'j2', role: 'boundary', thickness: 0.15, height: 2.8 },
			// Shared by both rooms.
			{ id: 'w2', startJunctionId: 'j2', endJunctionId: 'j3', role: 'boundary', thickness: 0.15, height: 3.4 },
			{ id: 'w3', startJunctionId: 'j3', endJunctionId: 'j4', role: 'boundary', thickness: 0.15, height: 2.8 },
			{ id: 'w4', startJunctionId: 'j4', endJunctionId: 'j1', role: 'boundary', thickness: 0.15, height: 2.8 },
			{ id: 'w5', startJunctionId: 'j3', endJunctionId: 'j5', role: 'boundary', thickness: 0.15, height: 2.8 },
			// Partition: bounds no room, hosts an opening.
			{ id: 'w6', startJunctionId: 'j1', endJunctionId: 'j3', role: 'partition', thickness: 0.1, height: 2.2 }
		],
		rooms: [
			{
				id: 'room-left',
				name: 'Left Room',
				boundary: [
					{ wallId: 'w1', direction: 'forward' },
					{ wallId: 'w2', direction: 'forward' },
					{ wallId: 'w3', direction: 'forward' },
					{ wallId: 'w4', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			},
			{
				id: 'room-right',
				name: 'Right Room',
				boundary: [
					{ wallId: 'w2', direction: 'reverse' },
					{ wallId: 'w5', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		],
		openings: [
			{ id: 'op-1', wallId: 'w1', kind: 'door', offset: 1, width: 0.9, height: 2.1, sillHeight: 0, profile: 'rectangular' },
			{ id: 'op-2', wallId: 'w2', kind: 'window', offset: 0.5, width: 0.9, height: 1.2, sillHeight: 0.9, profile: 'rectangular' },
			{ id: 'op-3', wallId: 'w6', kind: 'door', offset: 0.3, width: 0.9, height: 2.1, sillHeight: 0, profile: 'rectangular' }
		],
		objects: [
			{
				id: 'object-wf',
				kind: 'cylinder',
				position: [1, 0, 1],
				rotation: [0, 0, 0],
				dimensions: [1, 1, 1],
				roomId: 'room-left'
			}
		]
	};
}

function makeScene(): SceneDocument {
	return {
		textures: [],
		materials: [],
		entities: [makeEntity('entity-1', 'room-left')],
		clusters: [{ id: 'cluster-1', name: 'Statue', roomId: 'room-left', memberIds: ['entity-1'] }],
		navigationNodes: [],
		connections: []
	};
}

function buildWallFirstModel(): UnifiedProjectTreeModel {
	return buildUnifiedProjectTreeModel({
		layout: makeWallFirstLayout(),
		scene: makeScene(),
		guidedTourNodeIds: []
	});
}

function buildLegacyModel(): UnifiedProjectTreeModel {
	return buildUnifiedProjectTreeModel({
		layout: makeLegacyLayout(),
		scene: { textures: [], materials: [], entities: [], navigationNodes: [], connections: [] },
		guidedTourNodeIds: []
	});
}

describe('P23.6b ownership projection', () => {
	it('renders every physical Wall exactly once; a shared Wall never duplicates', () => {
		const model = buildWallFirstModel();
		const wallIds = model.architecture.walls.map((wall) => wall.wallId);
		// Document order (D9), one row per layout.walls entry.
		expect(wallIds).toEqual(['w1', 'w2', 'w3', 'w4', 'w5', 'w6']);
		expect(new Set(wallIds).size).toBe(wallIds.length);
	});

	it('records boundary participation as a relation, not ownership', () => {
		const model = buildWallFirstModel();
		const shared = model.architecture.walls.find((wall) => wall.wallId === 'w2')!;
		expect(shared.boundedRoomIds).toEqual(['room-left', 'room-right']);
		// Rooms never list boundary Walls as owned children — the Room row is
		// a leaf keyed by roomId only.
		for (const room of model.wallFirstRooms) {
			expect(Object.keys(room)).toEqual(['roomId', 'name', 'wallIds', 'openingIds']);
		}
	});

	it('nests each Opening under exactly its single host Wall', () => {
		const model = buildWallFirstModel();
		const w1 = model.architecture.walls.find((wall) => wall.wallId === 'w1')!;
		const w2 = model.architecture.walls.find((wall) => wall.wallId === 'w2')!;
		const w6 = model.architecture.walls.find((wall) => wall.wallId === 'w6')!;
		expect(w1.openings.map((opening) => opening.openingId)).toEqual(['op-1']);
		expect(w2.openings.map((opening) => opening.openingId)).toEqual(['op-2']);
		expect(w6.openings.map((opening) => opening.openingId)).toEqual(['op-3']);
	});

	it('carries the authoritative per-Wall height (P23.6H/P23.6I, no Floor cap)', () => {
		const model = buildWallFirstModel();
		const w2 = model.architecture.walls.find((wall) => wall.wallId === 'w2')!;
		const w6 = model.architecture.walls.find((wall) => wall.wallId === 'w6')!;
		expect(w2.height).toBe(3.4);
		expect(w2.role).toBe('boundary');
		expect(w6.role).toBe('partition');
	});

	it('keeps Junctions out of the resting rows but available for the Topology disclosure', () => {
		const model = buildWallFirstModel();
		expect(model.architecture.junctions.map((junction) => junction.junctionId)).toEqual([
			'j1', 'j2', 'j3', 'j4', 'j5'
		]);
	});

	it('shows LayoutObjects under the document-level group, not under Rooms', () => {
		const model = buildWallFirstModel();
		expect(model.layoutObjects.map((object) => object.objectId)).toEqual(['object-wf']);
		// The wall-first branch has no legacy Room-nested objects.
		expect(model.rooms).toEqual([]);
	});

	it('routes scene rows to the scene projection; membership resolved, not guessed', () => {
		const model = buildWallFirstModel();
		expect(model.sceneContent.clusters).toEqual([
			{ clusterId: 'cluster-1', name: 'Statue', memberIds: ['entity-1'] }
		]);
		// entity-1 is a cluster member → not also a standalone row.
		expect(model.sceneContent.entities).toEqual([]);
	});

	it('matches clustered Scene members by their display name via the resolver', () => {
		// Review fix: members are excluded from sceneContent.entities (no
		// double render), so without a resolver their visible label is
		// unreachable and "Piano" would find nothing.
		const model = buildWallFirstModel();
		const named = (id: string) => (id === 'entity-1' ? 'Grand Piano' : undefined);

		const byDisplayName = filterUnifiedProjectTreeModel(model, 'grand piano', named);
		expect(byDisplayName.sceneContent.clusters).toEqual([
			{ clusterId: 'cluster-1', name: 'Statue', memberIds: ['entity-1'] }
		]);
		// Without a resolver the id-only fallback still applies.
		expect(filterUnifiedProjectTreeModel(model, 'entity-1').sceneContent.clusters).toHaveLength(1);
		// A non-matching query prunes the member and then the cluster.
		expect(filterUnifiedProjectTreeModel(model, 'zzz', named).sceneContent.clusters).toEqual([]);
	});

	it('survives filtering through self or descendant terms', () => {
		const model = buildWallFirstModel();
		const byOpening = filterUnifiedProjectTreeModel(model, 'op-2');
		expect(byOpening.architecture.walls.map((wall) => wall.wallId)).toEqual(['w2']);
		expect(byOpening.architecture.walls[0]!.openings).toHaveLength(1);

		const byWall = filterUnifiedProjectTreeModel(model, 'w3');
		expect(byWall.architecture.walls.map((wall) => wall.wallId)).toEqual(['w3']);

		const byObject = filterUnifiedProjectTreeModel(model, 'object-wf');
		expect(byObject.layoutObjects).toHaveLength(1);

		const byJunction = filterUnifiedProjectTreeModel(model, 'j4');
		expect(byJunction.architecture.junctions.map((junction) => junction.junctionId)).toEqual(['j4']);

		const empty = filterUnifiedProjectTreeModel(model, 'zzz-no-match');
		expect(empty.architecture.walls).toEqual([]);
		expect(empty.layoutObjects).toEqual([]);
	});
});

describe('P23.6b format-gated legacy policy', () => {
	it('a legacy document populates no canonical top-level roots', () => {
		const model = buildLegacyModel();
		expect(model.architecture.walls).toEqual([]);
		expect(model.architecture.junctions).toEqual([]);
		expect(model.layoutObjects).toEqual([]);
		expect(model.sceneContent).toEqual({ clusters: [], entities: [] });
		// Legacy projection unchanged: the Room-associated object stays nested.
		expect(model.rooms[0]!.objects.map((object) => object.objectId)).toEqual(['object-1']);
	});

	it('a wall-first document does not double-render objects or scene entities', () => {
		const model = buildWallFirstModel();
		const objectRows = model.layoutObjects.map((object) => object.objectId);
		expect(objectRows).toEqual(['object-wf']);
		const entityIds = [
			...model.sceneContent.entities.map((entity) => entity.entityId),
			...model.sceneContent.clusters.flatMap((cluster) => cluster.memberIds)
		];
		expect(entityIds).toEqual(['entity-1']);
	});
});

describe('P23.6b selection round-trips', () => {
	it('qualifies canonical rows through the exact canonical selection identities', () => {
		const rows: UnifiedTreeRow[] = [
			{ kind: 'physicalWall', wallId: 'w2' },
			{ kind: 'wallOpening', wallId: 'w2', openingId: 'op-2' },
			{ kind: 'junction', junctionId: 'j3' }
		];
		expect(rows.map((row) => layoutRowToSelection(row))).toEqual([
			{ kind: 'physicalWall', wallId: 'w2' },
			{ kind: 'wallOpening', wallId: 'w2', openingId: 'op-2' },
			{ kind: 'junction', junctionId: 'j3' }
		]);
	});

	it('highlights exactly the canonical row for the active canonical selection', () => {
		const layout = makeWallFirstLayout();
		const wallRow: UnifiedTreeRow = { kind: 'physicalWall', wallId: 'w2' };
		const otherWall: UnifiedTreeRow = { kind: 'physicalWall', wallId: 'w1' };
		const openingRow: UnifiedTreeRow = { kind: 'wallOpening', wallId: 'w2', openingId: 'op-2' };
		const junctionRow: UnifiedTreeRow = { kind: 'junction', junctionId: 'j3' };

		expect(
			isUnifiedTreeRowSelected({ domain: 'layout', selection: { kind: 'physicalWall', wallId: 'w2' } }, null, wallRow)
		).toBe(true);
		expect(
			isUnifiedTreeRowSelected({ domain: 'layout', selection: { kind: 'physicalWall', wallId: 'w2' } }, null, otherWall)
		).toBe(false);
		expect(
			isUnifiedTreeRowSelected({ domain: 'layout', selection: { kind: 'wallOpening', wallId: 'w2', openingId: 'op-2' } }, null, openingRow)
		).toBe(true);
		expect(
			isUnifiedTreeRowSelected({ domain: 'layout', selection: { kind: 'junction', junctionId: 'j3' } }, null, junctionRow)
		).toBe(true);
		// A scene selection never co-highlights a canonical layout row.
		expect(
			isUnifiedTreeRowSelected({ domain: 'scene', selection: { kind: 'placement', ids: ['entity-1'], clusterId: null, roomId: 'room-left' } }, null, wallRow)
		).toBe(false);
		void layout;
	});

	it('gates structural canonical rows like legacy structural rows; object rows stay Arrange-interactive', () => {
		const wall: UnifiedTreeRow = { kind: 'physicalWall', wallId: 'w2' };
		const opening: UnifiedTreeRow = { kind: 'wallOpening', wallId: 'w2', openingId: 'op-2' };
		const junction: UnifiedTreeRow = { kind: 'junction', junctionId: 'j3' };
		const object: UnifiedTreeRow = { kind: 'object', objectId: 'object-wf' };
		for (const row of [wall, opening, junction]) {
			expect(isUnifiedTreeRowInteractive(row, 'scene', 'plan', 'layout')).toBe(true);
			expect(isUnifiedTreeRowInteractive(row, 'scene', 'plan', 'staging')).toBe(false);
			expect(isUnifiedTreeRowInteractive(row, 'scene', '3d')).toBe(true);
			expect(isUnifiedTreeRowInteractive(row, 'camera', '3d')).toBe(false);
		}
		expect(isUnifiedTreeRowInteractive(object, 'scene', 'plan', 'staging')).toBe(true);
	});
});

describe('P23.6b reveal target helper', () => {
	const layout = makeWallFirstLayout();

	it('returns the Architecture target for a canonical Wall selection', () => {
		expect(layoutSelectionRevealTarget({ kind: 'physicalWall', wallId: 'w2' }, layout)).toEqual({
			group: 'architecture',
			wallId: 'w2'
		});
	});

	it('returns the host-Wall + Opening target for a canonical Opening selection', () => {
		expect(layoutSelectionRevealTarget({ kind: 'wallOpening', wallId: 'w2', openingId: 'op-2' }, layout)).toEqual({
			group: 'architecture',
			wallId: 'w2',
			openingId: 'op-2'
		});
	});

	it('returns the Topology target for a Junction selection (no inventory explosion)', () => {
		expect(layoutSelectionRevealTarget({ kind: 'junction', junctionId: 'j3' }, layout)).toEqual({
			group: 'topology',
			junctionId: 'j3'
		});
	});

	it('routes wall-first LayoutObject selections to the Layout Objects root', () => {
		expect(layoutSelectionRevealTarget({ kind: 'object', objectId: 'object-wf' }, layout)).toEqual({
			group: 'layoutObjects',
			objectId: 'object-wf'
		});
		expect(layoutSelectionRevealTarget({ kind: 'object', objectId: 'object-missing' }, layout)).toBeNull();
	});

	it('keeps room selections on the Rooms root and legacy selections on the legacy helper', () => {
		expect(layoutSelectionRevealTarget({ kind: 'room', roomId: 'room-left' }, layout)).toEqual({
			group: 'rooms',
			roomId: 'room-left'
		});
		// Legacy Room-qualified kinds keep layoutSelectionAncestorRoomId as
		// their reveal path; this helper adds no parallel meaning.
		expect(layoutSelectionRevealTarget({ kind: 'wall', roomId: 'room-a', segmentId: 'wall-a' }, makeLegacyLayout())).toBeNull();
		expect(layoutSelectionAncestorRoomId({ kind: 'wall', roomId: 'room-a', segmentId: 'wall-a' }, makeLegacyLayout())).toBe('room-a');
		// Legacy object with an explicit roomId still resolves through its Room.
		expect(layoutSelectionRevealTarget({ kind: 'object', objectId: 'object-1' }, makeLegacyLayout())).toEqual({
			group: 'rooms',
			roomId: 'room-a'
		});
	});

	it('never selects: the helper is a pure projection over the document', () => {
		const target = layoutSelectionRevealTarget({ kind: 'physicalWall', wallId: 'w2' }, layout);
		expect(target).toEqual({ group: 'architecture', wallId: 'w2' });
		// Calling it twice is pure; no state, no selection writes.
		expect(layoutSelectionRevealTarget({ kind: 'physicalWall', wallId: 'w2' }, layout)).toEqual(target);
	});
});

describe('P23.6b source contracts', () => {
	it('the tree component exposes no legacy rename on the wall-first Room path', () => {
		const tree = readLibSource('editor/UnifiedProjectTree.svelte');
		// The dedicated wall-first Room context-menu handler must not route a
		// canonical roomId into `updateLayoutRoomFields` (floors-only legacy).
		expect(tree).toContain('onWallFirstRoomRowContextMenu');
		const start = tree.indexOf('function onWallFirstRoomRowContextMenu');
		const end = tree.indexOf('function ', start + 10);
		const block = tree.slice(start, end);
		// No invocation of the legacy floors-only renamer, and no reuse of the
		// legacy Room context-menu action bundle that carries it.
		expect(block).not.toContain('updateLayoutRoomFields(layoutPreview');
		expect(block).not.toContain('renameRoomViaPrompt(roomId');
		// Review fix: the menu builder receives NO renameRoom action — a no-op
		// dummy would still expose a dead Rename… command, which the plan
		// forbids ("no legacy renameRoom action / context-menu command").
		expect(block).not.toContain('renameRoom:');
	});

	it('omits the Rename item when the menu builder gets no renameRoom action', () => {
		const menu = readLibSource('editor/context-menu/plan-menu-items.ts');
		// The builder skips the item entirely (never a disabled no-op) when the
		// caller cannot honor it — pinned behaviorally in context-menu.test.ts.
		expect(menu).toContain('if (input.actions.renameRoom) {');
	});

	it('the Inspector presents no document-wide inventory (busy right rail retired)', () => {
		const inspector = readLibSource('editor/EditorInspector.svelte');
		// The old "Architecture · exact" accordion enumerated every
		// Junction/Wall/Room in the document — the Inspector's competing
		// inventory. P23.6b moves document navigation to the Hierarchy's
		// Architecture / Topology… groups; the Inspector presents exactly the
		// one selected entity (§Inspector structure).
		expect(inspector).not.toContain('Wall-first exact authoring');
		expect(inspector).not.toContain('aria-label="Wall-first Junctions"');
		expect(inspector).not.toContain('aria-label="Wall-first Walls"');
		expect(inspector).not.toContain('aria-label="Wall-first Rooms"');
		// Its duplicated exact editors go with it (the canonical Selection
		// panels already carry the same operations).
		expect(inspector).not.toContain('aria-label="Exact Junction editor"');
		expect(inspector).not.toContain('aria-label="Exact Wall editor"');
		expect(inspector).not.toContain('updatePrecisionWallLength');
		expect(inspector).not.toContain('updatePrecisionWallAngle');
		expect(inspector).not.toContain('updatePrecisionWallThickness');
		expect(inspector).not.toContain('addPrecisionVertex');
		// Issue-driven topology diagnostics remain (a disclosure, not an
		// inventory of healthy geometry).
		expect(inspector).toContain('Wall-first topology diagnostics');
		// The rectangle Width/Depth capability is re-homed onto the canonical
		// Room panel with its anchor / width-Wall parameters + Duplicate.
		expect(inspector).toContain('updatePrecisionRectangle');
		expect(inspector).toContain('duplicateSelectedPrecisionRoom');
	});

	it('the Inspector has no Inspector-local selected-entity target', () => {
		const inspector = readLibSource('editor/EditorInspector.svelte');
		expect(inspector).not.toContain('let precisionTarget');
		expect(inspector).not.toContain('precisionTargetKind');
		expect(inspector).not.toContain('precisionTargetId');
		expect(inspector).not.toContain('selectPrecisionTarget({');
		// Operation parameters survive as ephemeral state (D8).
		expect(inspector).toContain('let precisionFixedEndpoint');
		expect(inspector).toContain('let precisionRectangleAnchor');
		expect(inspector).toContain('let precisionRectangleWidthWall');
	});

	it('every capability row keeps a reachable handler bound to its destination', () => {
		const inspector = readLibSource('editor/EditorInspector.svelte');
		// Wall Length/Angle/thickness/height/role + add-vertex (canonical panel).
		for (const handler of [
			'updateSelectedWallLength',
			'updateSelectedWallAngle',
			'updateSelectedWallThickness',
			'updateSelectedWallHeight',
			'updateSelectedWallRole',
			'addSelectedWallVertex',
			'updateSelectedJunction',
			'updatePrecisionRectangle',
			'duplicateSelectedPrecisionRoom',
			'duplicateSelectedLayoutObject',
			'repeatSelectedLayoutObject',
			'updateWallFirstOpeningField',
			'selectDiagnosticTarget'
		]) {
			expect(inspector, `missing capability handler ${handler}`).toContain(handler);
		}
	});

	it('renders the Walls subgroup and Topology sibling under Architecture (D1)', () => {
		const tree = readLibSource('editor/UnifiedProjectTree.svelte');
		for (const fragment of [
			'Architecture',
			'Walls</span>',
			'Topology…',
			'Layout Objects',
			'Scene Content',
			'layoutSelectionRevealTarget',
			'tree-reveal-hint'
		]) {
			expect(tree, `tree misses ${fragment}`).toContain(fragment);
		}
		// The reveal effect opens the Walls subgroup with the Architecture root.
		expect(tree).toContain('wallsOpen = true');
	});

	it('anchors reveal targets on unique per-row keys', () => {
		const tree = readLibSource('editor/UnifiedProjectTree.svelte');
		// Review fix: wall-first Room rows carry their own rooms: anchor, and
		// Opening rows are keyed wall:opening so an Opening reveal scrolls to
		// the Opening row, not its host Wall.
		expect(tree).toContain('data-reveal-id={`rooms:${room.roomId}`}');
		expect(tree).toContain("data-reveal-id={`architecture:${wall.wallId}:${opening.openingId}`}");
		expect(tree).toContain("data-reveal-id={`architecture:${wall.wallId}`}");
		expect(tree).toContain("data-reveal-id={`topology:${junction.junctionId}`}");
		// The selector builder maps targets to exactly these keys.
		expect(tree).toContain("return `rooms:${target.roomId}`;");
		expect(tree).toContain("`architecture:${target.wallId}:${target.openingId}`");
	});

	it('reveals wall-first Scene selections through the Scene Content root', () => {
		const tree = readLibSource('editor/UnifiedProjectTree.svelte');
		// Review fix: wall-first Scene rows moved from Room-nested to the
		// document-level Scene Content root, so their reveal must open that
		// root (the legacy branch keeps its Room expansion).
		expect(tree).toContain('sceneContentOpen = true;');
		expect(tree).toContain('if (model.wallFirstRooms.length > 0 || model.rooms.length === 0) {');
	});
});
