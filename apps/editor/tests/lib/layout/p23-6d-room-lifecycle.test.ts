/**
 * P23.6d — canonical Room lifecycle completion.
 *
 * Planner contract:
 *
 * - `planRoomMetadataUpdate` edits `name` / `floorThickness` /
 *   `ceilingThickness` on a canonical Room **without** topology
 *   reconciliation (metadata is not topology), rejects `boundary`/legacy
 *   patches (`invalid_patch`), empty names and non-positive/non-finite
 *   thicknesses (`invalid_value`), and no-op patches (`no_op`) so callers
 *   write zero history. Room identity and boundary are preserved.
 * - `planRemoveRoom` removes the Room and its exclusive enclosure Walls in
 *   one atomic operation so a Room delete leaves no open shell of leftover
 *   Walls, while a Wall shared with a neighbouring Room is kept (one physical
 *   Wall the neighbour still needs). It rides the shared Wall-removal pipeline
 *   (`planDeleteWall`'s authority), so the Room retires through normal P23.8
 *   reconciliation — never a record splice. A Room whose every boundary Wall
 *   is shared rejects atomically.
 *
 * Editor integration (`updateWallFirstRoomMetadata` / `removeWallFirstRoom`
 * through the guarded history runner): one command = exactly one history
 * entry, rejections write zero entries, and Undo/Redo restore exact
 * Wall/Junction/Opening/Room IDs. Selection policy is operation-specific:
 * metadata preserves the selected Room; removal clears it to `none`
 * (caller-owned), pinned by source contract. `removeWallFirstRoom` enforces
 * the legacy reject-when-referenced Scene policy against the authoritative
 * scene document for EVERY retiring Room (selected or collateral), so a
 * referenced Room blocks the whole operation atomically.
 */
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractBoundaryCandidateFaces } from '$lib/layout/layout-face-extraction';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import {
	createEmptySceneDocument,
	serializeSceneDocument,
	type SceneDocument
} from '$lib/content/scene';
import { sceneDocument as chopinSceneDocument } from '$lib/content/chopin-project';import {
	serializeWallFirstLayoutDocument,
	validateWallFirstLayoutDocument
} from '$lib/layout/layout-wall-first-codec';
import { compileWallFirstLayoutGeometry } from '$lib/layout/layout-geometry';
import type {
	LayoutDocumentWallFirst,
	LayoutWallFirstRoom
} from '$lib/layout/layout-wall-first-types';
import type { LayoutVec2 } from '$lib/layout/layout-types';
import {
	planDeleteWall,
	planRemoveRoom,
	planRoomMetadataUpdate,
	roomExclusiveBoundaryWallIds,
	type WallFirstOpPlan
} from '@portfolio/layout-core';
import {
	captureLayoutPreviewSnapshot,
	createEmptyLayoutPreviewState,
	importLayoutPreviewJson,
	layoutPreviewCanonicalJson,
	layoutPreviewDocument,
	removeWallFirstRoom,
	restoreLayoutPreviewSnapshot,
	updateWallFirstRoomMetadata,
	wallFirstRoomExclusiveBoundaryWallIds,
	wallFirstRoomSceneBlockedRoomIds
} from '$lib/editor/layout/layout-preview-state.svelte';
import { layoutMutationRunnerFor, runLayoutMutation } from '$lib/editor/layout/layout-mutation-runner';
import {
	createLayoutInteractionState,
	selectLayoutRoom,
	setPlanViewMode
} from '$lib/editor/layout/layout-interaction';
import { buildPlanLayoutContextMenuItems } from '$lib/editor/context-menu/plan-menu-items';

type WallSeed = {
	id: string;
	start: string;
	end: string;
	role?: 'boundary' | 'partition';
};

/**
 * Two-room wall-first fixture: a 6×4 enclosure split at x=3 by the shared
 * boundary Wall `wall-e` (bounds BOTH rooms), plus a disconnected roomless
 * partition Wall `wall-rl`. Rooms come from real face extraction so
 * boundaries are genuine reconciled cycles. `wall-e` is shared; `wall-a1`,
 * `wall-c2`, `wall-d` are exclusive to `room-left`; `wall-a2`, `wall-b`,
 * `wall-c1` are exclusive to `room-right`.
 */
function twoRoomDocument(): LayoutDocumentWallFirst {
	const junctions: Array<[string, number, number]> = [
		['j-a', 0, 0],
		['j-m', 3, 0],
		['j-b', 6, 0],
		['j-c', 6, 4],
		['j-n', 3, 4],
		['j-d', 0, 4],
		['j-x', 10, 0],
		['j-y', 10, 4]
	];
	const walls: WallSeed[] = [
		{ id: 'wall-a1', start: 'j-a', end: 'j-m' },
		{ id: 'wall-a2', start: 'j-m', end: 'j-b' },
		{ id: 'wall-b', start: 'j-b', end: 'j-c' },
		{ id: 'wall-c1', start: 'j-c', end: 'j-n' },
		{ id: 'wall-c2', start: 'j-n', end: 'j-d' },
		{ id: 'wall-d', start: 'j-d', end: 'j-a' },
		{ id: 'wall-e', start: 'j-m', end: 'j-n' },
		{ id: 'wall-rl', start: 'j-x', end: 'j-y', role: 'partition' }
	];
	const shell = {
		units: 'meters' as const,
		formatVersion: 5 as const,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: junctions.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 })),
		walls: walls.map((wall) => ({
			id: wall.id,
			startJunctionId: wall.start,
			endJunctionId: wall.end,
			role: wall.role ?? ('boundary' as const),
			thickness: 0.2,
			height: 3
		})),
		openings: [] as LayoutDocumentWallFirst['openings'],
		objects: [] as LayoutDocumentWallFirst['objects']
	};
	const extraction = extractBoundaryCandidateFaces({ ...shell, rooms: [] });
	const leftFace = extraction.faces.find((face) =>
		face.boundary.some((ref) => ref.wallId === 'wall-a1')
	)!;
	const rightFace = extraction.faces.find((face) =>
		face.boundary.some((ref) => ref.wallId === 'wall-a2')
	)!;
	const room = (
		id: string,
		name: string,
		boundary: typeof leftFace.boundary
	): LayoutWallFirstRoom => ({
		id,
		name,
		boundary: boundary.map((ref) => ({ ...ref })),
		floorThickness: 0.1,
		ceilingThickness: 0.1
	});
	return {
		...shell,
		rooms: [
			room('room-left', 'Left', leftFace.boundary),
			room('room-right', 'Right', rightFace.boundary)
		]
	};
}

const BASE = twoRoomDocument();

/**
 * A real scene entity repointed at a wall-first Room — the same
 * `listLayoutRoomSceneReferences` count the legacy policy uses. Entities are
 * never resolved through the room registry, so this is safe to boot into a
 * store whose registry is the empty wall-first one.
 */
function sceneReferencingRoom(roomId: string): SceneDocument {
	const scene = createEmptySceneDocument();
	scene.entities.push({ ...structuredClone(chopinSceneDocument.entities[0]!), roomId });
	return scene;
}

/**
 * P23.6d review blocker fixture — a topology that reconciles a retirement the
 * selected Room does NOT own: a 10×8 outer enclosure with a 4×4 inner Room
 * fully inside it (roomless walls between them, so neither boundary references
 * the other's Walls). Removing the OUTER room's exclusive Walls (the only
 * intent) dissolves both rings into exactly the inner room's face, so
 * reconciliation MERGES outer→inner-face: the surviving face is fully inside
 * BOTH predecessor polygons (an overlap tie), the winner is the lexical ID
 * (`room-a` — the selected outer room) and `room-z` (the inner room) retires
 * as collateral. Pinned at the top of the Scene-safety tests so the
 * retirement is proven, not assumed.
 */
function nestedOuterInnerDocument(): LayoutDocumentWallFirst {
	const junctions: Array<[string, number, number]> = [
		['j-oo1', 0, 0],
		['j-oo2', 10, 0],
		['j-oo3', 10, 8],
		['j-oo4', 0, 8],
		['j-i1', 3, 2],
		['j-i2', 7, 2],
		['j-i3', 7, 6],
		['j-i4', 3, 6]
	];
	const walls: WallSeed[] = [
		{ id: 'wall-o1', start: 'j-oo1', end: 'j-oo2' },
		{ id: 'wall-o2', start: 'j-oo2', end: 'j-oo3' },
		{ id: 'wall-o3', start: 'j-oo3', end: 'j-oo4' },
		{ id: 'wall-o4', start: 'j-oo4', end: 'j-oo1' },
		{ id: 'wall-i1', start: 'j-i1', end: 'j-i2' },
		{ id: 'wall-i2', start: 'j-i2', end: 'j-i3' },
		{ id: 'wall-i3', start: 'j-i3', end: 'j-i4' },
		{ id: 'wall-i4', start: 'j-i4', end: 'j-i1' }
	];
	const shell = {
		units: 'meters' as const,
		formatVersion: 5 as const,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: junctions.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 })),
		walls: walls.map((wall) => ({
			id: wall.id,
			startJunctionId: wall.start,
			endJunctionId: wall.end,
			role: 'boundary' as const,
			thickness: 0.2,
			height: 3
		})),
		openings: [] as LayoutDocumentWallFirst['openings'],
		objects: [] as LayoutDocumentWallFirst['objects']
	};
	const extraction = extractBoundaryCandidateFaces({ ...shell, rooms: [] });
	const outerFace = extraction.faces.find((face) =>
		face.boundary.some((ref) => ref.wallId === 'wall-o1')
	)!;
	const innerFace = extraction.faces.find((face) =>
		face.boundary.some((ref) => ref.wallId === 'wall-i1')
	)!;
	const room = (
		id: string,
		name: string,
		boundary: typeof outerFace.boundary
	): LayoutWallFirstRoom => ({
		id,
		name,
		boundary: boundary.map((ref) => ({ ...ref })),
		floorThickness: 0.1,
		ceilingThickness: 0.1
	});
	return {
		...shell,
		rooms: [room('room-a', 'Outer', outerFace.boundary), room('room-z', 'Inner', innerFace.boundary)]
	};
}

function success(plan: WallFirstOpPlan): Extract<WallFirstOpPlan, { kind: 'success' }> {
	if (plan.kind !== 'success') {
		throw new Error(`expected success, got ${JSON.stringify(plan.rejection)}`);
	}
	return plan;
}

function rejection(plan: WallFirstOpPlan) {
	if (plan.kind !== 'rejected') throw new Error('expected rejection');
	return plan.rejection;
}

function wallFirstDocument(
	layoutPreview: ReturnType<typeof createEmptyLayoutPreviewState>
): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(layoutPreview);
	if (!('formatVersion' in document)) throw new Error('expected wall-first document');
	return document;
}

function makeStore(
	seed: LayoutDocumentWallFirst = BASE,
	scene: SceneDocument = createEmptySceneDocument()
) {
	const store = createEditorStore({
		document: scene,
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	const layoutPreview = createEmptyLayoutPreviewState();
	if (!importLayoutPreviewJson(layoutPreview, serializeWallFirstLayoutDocument(seed))) {
		throw new Error('wall-first import failed');
	}
	store.registerLayoutHistory({
		capture: () => captureLayoutPreviewSnapshot(layoutPreview),
		replace: (snapshot) => restoreLayoutPreviewSnapshot(layoutPreview, snapshot as never),
		matches: (a, b) =>
			JSON.stringify((a as { project: { layout: unknown } }).project.layout) ===
			JSON.stringify((b as { project: { layout: unknown } }).project.layout)
	});
	// Mirrors EditorApp: the format-dispatch guard must see the live preview or
	// the stage-6 cross-format invariant refuses every wall-first commit.
	store.setLayoutFormatPolicySource(() => layoutPreview);
	return { store, layoutPreview };
}

describe('P23.6d planRoomMetadataUpdate — metadata is not topology', () => {
	it('validates the fixture document before any operation', () => {
		expect(validateWallFirstLayoutDocument(BASE).success).toBe(true);
	});

	it('renames a Room preserving identity and boundary, with no reconciliation', () => {
		const plan = success(planRoomMetadataUpdate(BASE, 'room-left', { name: '  Lobby  ' }));
		const room = plan.document.rooms.find((candidate) => candidate.id === 'room-left')!;
		expect(room.name).toBe('Lobby');
		expect(room.boundary).toEqual(
			BASE.rooms.find((candidate) => candidate.id === 'room-left')!.boundary
		);
		// Metadata-only: no births, no retirements, no topology change.
		expect(plan.lineage).toEqual([]);
		expect(plan.retiredRoomIds).toEqual([]);
		expect(plan.document.walls).toEqual(BASE.walls);
		expect(plan.document.junctions).toEqual(BASE.junctions);
		expect(validateWallFirstLayoutDocument(plan.document).success).toBe(true);
	});

	it('updates floor/ceiling thickness through the canonical numeric rule only', () => {
		const plan = success(
			planRoomMetadataUpdate(BASE, 'room-left', { floorThickness: 0.25, ceilingThickness: 0.3 })
		);
		const room = plan.document.rooms.find((candidate) => candidate.id === 'room-left')!;
		expect(room.floorThickness).toBe(0.25);
		expect(room.ceilingThickness).toBe(0.3);
		// The unrelated room is untouched.
		expect(plan.document.rooms.find((candidate) => candidate.id === 'room-right')).toEqual(
			BASE.rooms.find((candidate) => candidate.id === 'room-right')
		);
	});

	it('allows duplicate names (id is identity, mirroring legacy behavior)', () => {
		const plan = success(planRoomMetadataUpdate(BASE, 'room-right', { name: 'Left' }));
		expect(plan.document.rooms.map((room) => room.name).sort()).toEqual(['Left', 'Left']);
	});

	it('rejects an empty/blank/non-string name and non-positive thicknesses', () => {
		expect(rejection(planRoomMetadataUpdate(BASE, 'room-left', { name: '   ' })).code).toBe(
			'invalid_value'
		);
		expect(
			rejection(planRoomMetadataUpdate(BASE, 'room-left', { name: 5 as unknown as string })).code
		).toBe('invalid_value');
		for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(
				rejection(planRoomMetadataUpdate(BASE, 'room-left', { floorThickness: value })).code
			).toBe('invalid_value');
			expect(
				rejection(planRoomMetadataUpdate(BASE, 'room-left', { ceilingThickness: value })).code
			).toBe('invalid_value');
		}
	});

	it('rejects boundary and legacy patches with invalid_patch', () => {
		expect(
			rejection(
				planRoomMetadataUpdate(BASE, 'room-left', {
					boundary: []
				} as unknown as Parameters<typeof planRoomMetadataUpdate>[2])
			).code
		).toBe('invalid_patch');
		expect(
			rejection(
				planRoomMetadataUpdate(BASE, 'room-left', {
					wallThickness: 0.3
				} as unknown as Parameters<typeof planRoomMetadataUpdate>[2])
			).code
		).toBe('invalid_patch');
		expect(
			rejection(
				planRoomMetadataUpdate(BASE, 'room-left', {
					floorHeight: 3
				} as unknown as Parameters<typeof planRoomMetadataUpdate>[2])
			).code
		).toBe('invalid_patch');
	});

	it('rejects a no-op patch (same values or empty) so callers write zero history', () => {
		expect(rejection(planRoomMetadataUpdate(BASE, 'room-left', { name: 'Left' })).code).toBe(
			'no_op'
		);
		expect(rejection(planRoomMetadataUpdate(BASE, 'room-left', {})).code).toBe('no_op');
		expect(
			rejection(planRoomMetadataUpdate(BASE, 'room-left', { floorThickness: 0.1, name: 'Left' })).code
		).toBe('no_op');
	});

	it('rejects an unknown Room atomically', () => {
		expect(rejection(planRoomMetadataUpdate(BASE, 'room-missing', { name: 'X' })).code).toBe(
			'unknown_room'
		);
	});

	it('is input-pure: the baseline document is never mutated', () => {
		const snapshot = JSON.stringify(BASE);
		success(planRoomMetadataUpdate(BASE, 'room-left', { name: 'Lobby' }));
		rejection(planRoomMetadataUpdate(BASE, 'room-left', { boundary: [] } as never));
		expect(JSON.stringify(BASE)).toBe(snapshot);
	});
});

describe('P23.6d planRemoveRoom — Room removal over the Wall pipeline', () => {
	it('reports exactly the Room-exclusive boundary Walls (never geometry)', () => {
		expect(roomExclusiveBoundaryWallIds(BASE, 'room-left').sort()).toEqual([
			'wall-a1',
			'wall-c2',
			'wall-d'
		]);
		expect(roomExclusiveBoundaryWallIds(BASE, 'room-right').sort()).toEqual([
			'wall-a2',
			'wall-b',
			'wall-c1'
		]);
		// Shared divider and roomless partition are never eligible.
		expect(roomExclusiveBoundaryWallIds(BASE, 'room-left')).not.toContain('wall-e');
		expect(roomExclusiveBoundaryWallIds(BASE, 'room-missing')).toEqual([]);
	});

	it('removes the whole Room and all its own Walls in one operation (no leftover shell)', () => {
		const plan = success(planRemoveRoom(BASE, 'room-right'));
		// The Room and every Wall it owns alone are gone.
		expect(plan.document.rooms.map((room) => room.id)).toEqual(['room-left']);
		expect(plan.retiredRoomIds).toEqual(['room-right']);
		expect(plan.document.walls.map((wall) => wall.id)).toEqual([
			'wall-a1',
			'wall-c2',
			'wall-d',
			'wall-e',
			'wall-rl'
		]);
		// No dangling shell: nothing from room-right survives except the shared
		// divider (still needed by room-left).
		expect(plan.document.walls.map((wall) => wall.id)).not.toContain('wall-a2');
		expect(plan.document.walls.map((wall) => wall.id)).not.toContain('wall-b');
		expect(plan.document.walls.map((wall) => wall.id)).not.toContain('wall-c1');
		expect(validateWallFirstLayoutDocument(plan.document).success).toBe(true);
		expect(compileWallFirstLayoutGeometry(plan.document).geometry.rooms).toHaveLength(1);
	});

	it('keeps a Wall shared with a neighbour (one physical Wall the neighbour needs)', () => {
		const plan = success(planRemoveRoom(BASE, 'room-right'));
		expect(plan.document.walls.map((wall) => wall.id)).toContain('wall-e');
		// room-left is completely untouched.
		expect(plan.document.rooms.find((room) => room.id === 'room-left')!.boundary).toEqual(
			BASE.rooms.find((room) => room.id === 'room-left')!.boundary
		);
	});

	it('removes a standalone Room completely (the drawn 4-wall flow)', () => {
		// A genuinely standalone single-room document (only the left enclosure's
		// own Walls): every boundary Wall is exclusive, so the whole enclosure
		// disappears with the Room.
		const ownedWallIds = new Set(['wall-a1', 'wall-e', 'wall-c2', 'wall-d']);
		const ownedJunctionIds = new Set(['j-a', 'j-m', 'j-n', 'j-d']);
		const single: LayoutDocumentWallFirst = {
			...BASE,
			walls: BASE.walls.filter((wall) => ownedWallIds.has(wall.id)),
			junctions: BASE.junctions.filter((junction) => ownedJunctionIds.has(junction.id)),
			rooms: [{ ...BASE.rooms.find((room) => room.id === 'room-left')! }]
		};
		expect(roomExclusiveBoundaryWallIds(single, 'room-left').sort()).toEqual(
			['wall-a1', 'wall-c2', 'wall-d', 'wall-e'].sort()
		);
		const plan = success(planRemoveRoom(single, 'room-left'));
		expect(plan.document.rooms).toEqual([]);
		expect(plan.document.walls).toEqual([]);
		expect(plan.document.junctions).toEqual([]);
		expect(plan.retiredRoomIds).toEqual(['room-left']);
		expect(compileWallFirstLayoutGeometry(plan.document).geometry.walls).toEqual([]);
	});

	it('delegates to the shared planDeleteWall pipeline (never a forked path)', () => {
		// Removing the Room's exclusive Walls is exactly the same candidate as
		// deleting those Walls: pinned through the single-Wall planner below.
		const viaRoom = success(planRemoveRoom(BASE, 'room-right'));
		expect(viaRoom.document.walls.map((wall) => wall.id)).not.toContain('wall-b');
		expect(validateWallFirstLayoutDocument(viaRoom.document).success).toBe(true);
	});

	it('rejects atomically when every boundary Wall is shared (fully interior Room)', () => {
		// Synthetic guard fixture: make every one of room-right's boundary Walls
		// also referenced by room-left, so room-right owns nothing alone. The
		// planner must refuse rather than demolish a neighbour's Walls.
		const rightBoundary = BASE.rooms.find((room) => room.id === 'room-right')!.boundary;
		const allShared: LayoutDocumentWallFirst = {
			...BASE,
			rooms: BASE.rooms.map((room) =>
				room.id === 'room-left' ? { ...room, boundary: [...room.boundary, ...rightBoundary] } : room
			)
		};
		expect(roomExclusiveBoundaryWallIds(allShared, 'room-right')).toEqual([]);
		expect(rejection(planRemoveRoom(allShared, 'room-right')).code).toBe('ambiguous_room_removal');
	});

	it('rejects an unknown Room and a boundary referencing a missing Wall', () => {
		expect(rejection(planRemoveRoom(BASE, 'room-missing')).code).toBe('unknown_room');
		const missingWall: LayoutDocumentWallFirst = {
			...BASE,
			walls: BASE.walls.filter((wall) => wall.id !== 'wall-b')
		};
		expect(rejection(planRemoveRoom(missingWall, 'room-right')).code).toBe(
			'wall_not_in_room_boundary'
		);
	});

	it('removes the removed Walls hosted Openings atomically', () => {
		const hosted: LayoutDocumentWallFirst = {
			...BASE,
			openings: [
				{
					id: 'opening:window:1',
					wallId: 'wall-b',
					kind: 'window',
					offset: 1,
					width: 1.2,
					height: 1.2,
					sillHeight: 1,
					profile: 'rectangular'
				},
				{
					id: 'opening:door:2',
					wallId: 'wall-d',
					kind: 'door',
					offset: 1,
					width: 0.9,
					height: 2.1,
					sillHeight: 0,
					profile: 'rectangular'
				}
			]
		};
		const plan = success(planRemoveRoom(hosted, 'room-right'));
		expect(plan.document.openings.map((opening) => opening.id)).toEqual(['opening:door:2']);
	});

	it('clears document-level object associations on retirement (no survivor)', () => {
		const withObjects: LayoutDocumentWallFirst = {
			...BASE,
			objects: [
				{
					id: 'obj-1',
					kind: 'box',
					position: [4, 0, 2],
					dimensions: [1, 1, 1],
					rotation: [0, 0, 0],
					roomId: 'room-right'
				},
				{
					id: 'obj-2',
					kind: 'box',
					position: [1, 0, 2],
					dimensions: [1, 1, 1],
					rotation: [0, 0, 0],
					roomId: 'room-left'
				}
			]
		};
		const plan = success(planRemoveRoom(withObjects, 'room-right'));
		const byId = new Map(plan.document.objects.map((object) => [object.id, object]));
		expect(byId.get('obj-1')!.roomId).toBeUndefined();
		expect(byId.get('obj-2')!.roomId).toBe('room-left');
	});

	it('refuses atomically when a surviving portal relation cannot be remapped', () => {
		// The door lives on the surviving shared Wall and names the retiring
		// Room: one endpoint resolves, the other disappeared → the P23.8
		// contract rejects rather than guessing.
		const related: LayoutDocumentWallFirst = {
			...BASE,
			openings: [
				{
					id: 'opening:door:1',
					wallId: 'wall-e',
					kind: 'door',
					offset: 1,
					width: 0.9,
					height: 2.1,
					sillHeight: 0,
					profile: 'rectangular',
					connectsRoomIds: ['room-left', 'room-right']
				}
			]
		};
		const plan = planRemoveRoom(related, 'room-right');
		expect(plan.kind).toBe('rejected');
		if (plan.kind === 'rejected') {
			expect(['room_reconciliation_rejected', 'unresolved_portal_remap']).toContain(
				plan.rejection.code
			);
		}
	});

	it('prunes only the removed Walls endpoints; unrelated orphan Junctions survive', () => {
		const withOrphan: LayoutDocumentWallFirst = {
			...BASE,
			junctions: [...BASE.junctions, { id: 'j-orphan', point: [20, 20] }]
		};
		const plan = success(planRemoveRoom(withOrphan, 'room-right'));
		const ids = new Set(plan.document.junctions.map((junction) => junction.id));
		// j-b / j-c belonged only to room-right's Walls → pruned; j-m / j-n are
		// shared with surviving Walls → kept; the unrelated orphan is never swept.
		expect(ids.has('j-b')).toBe(false);
		expect(ids.has('j-c')).toBe(false);
		expect(ids.has('j-m')).toBe(true);
		expect(ids.has('j-n')).toBe(true);
		expect(ids.has('j-orphan')).toBe(true);
	});

	it('is input-pure and rejects leave zero partial mutation', () => {
		const snapshot = JSON.stringify(BASE);
		success(planRemoveRoom(BASE, 'room-right'));
		success(planRemoveRoom(BASE, 'room-left'));
		rejection(planRemoveRoom(BASE, 'room-missing'));
		expect(JSON.stringify(BASE)).toBe(snapshot);
	});
});

describe('P23.6d editor adapters — history and selection', () => {
	const EMPTY_SCENE = createEmptySceneDocument();

	it('updates metadata in exactly one history entry; Undo/Redo restore exact state', () => {
		const { store, layoutPreview } = makeStore();
		expect(store.canUndo).toBe(false);

		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => updateWallFirstRoomMetadata(layoutPreview, 'room-left', { name: 'Lobby', floorThickness: 0.25 }),
			(result) => result.success
		);
		if (outcome.kind !== 'committed') throw new Error(`expected commit: ${JSON.stringify(outcome)}`);
		expect(store.canUndo).toBe(true);
		const after = wallFirstDocument(layoutPreview).rooms.find((room) => room.id === 'room-left')!;
		expect(after.name).toBe('Lobby');
		expect(after.floorThickness).toBe(0.25);

		expect(store.undo()).toBe(true);
		const restored = wallFirstDocument(layoutPreview).rooms.find((room) => room.id === 'room-left')!;
		expect(restored.name).toBe('Left');
		expect(restored.floorThickness).toBe(0.1);

		expect(store.redo()).toBe(true);
		expect(
			wallFirstDocument(layoutPreview).rooms.find((room) => room.id === 'room-left')!.name
		).toBe('Lobby');
	});

	it('writes zero history entries when the metadata planner rejects', () => {
		const { store, layoutPreview } = makeStore();
		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => updateWallFirstRoomMetadata(layoutPreview, 'room-left', { name: 'Left' }),
			(result) => result.success
		);
		expect(outcome.kind).toBe('cancelled');
		expect(store.canUndo).toBe(false);
	});

	it('preserves the selected Room across a metadata update (Inspector stay)', () => {
		const { store, layoutPreview } = makeStore();
		const layoutInteraction = createLayoutInteractionState();
		selectLayoutRoom(layoutInteraction, 'room-left');
		runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => updateWallFirstRoomMetadata(layoutPreview, 'room-left', { name: 'Lobby' }),
			(result) => result.success
		);
		expect(layoutInteraction.selection).toEqual({ kind: 'room', roomId: 'room-left' });
	});

	it('removes the whole Room in one history entry; Undo/Redo restore exact IDs', () => {
		const seeded: LayoutDocumentWallFirst = {
			...BASE,
			openings: [
				{
					id: 'opening:window:1',
					wallId: 'wall-b',
					kind: 'window',
					offset: 1,
					width: 1.2,
					height: 1.2,
					sillHeight: 1,
					profile: 'rectangular'
				}
			]
		};
		const { store, layoutPreview } = makeStore(seeded);
		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => removeWallFirstRoom(layoutPreview, 'room-right', store.document),
			(result) => result.success
		);
		if (outcome.kind !== 'committed') throw new Error(`expected commit: ${JSON.stringify(outcome)}`);
		const after = wallFirstDocument(layoutPreview);
		expect(after.rooms.map((room) => room.id)).toEqual(['room-left']);
		expect(after.walls.map((wall) => wall.id)).toEqual([
			'wall-a1',
			'wall-c2',
			'wall-d',
			'wall-e',
			'wall-rl'
		]);
		expect(after.openings).toEqual([]);

		expect(store.undo()).toBe(true);
		const restored = wallFirstDocument(layoutPreview);
		expect(restored.rooms.map((room) => room.id)).toEqual(['room-left', 'room-right']);
		expect(restored.walls.map((wall) => wall.id)).toEqual([
			'wall-a1',
			'wall-a2',
			'wall-b',
			'wall-c1',
			'wall-c2',
			'wall-d',
			'wall-e',
			'wall-rl'
		]);
		expect(restored.openings.map((opening) => opening.id)).toEqual(['opening:window:1']);

		expect(store.redo()).toBe(true);
		expect(wallFirstDocument(layoutPreview).rooms.map((room) => room.id)).toEqual(['room-left']);
	});

	it('writes zero history entries when the removal planner rejects', () => {
		const { store, layoutPreview } = makeStore();
		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => removeWallFirstRoom(layoutPreview, 'room-missing', store.document),
			(result) => result.success
		);
		expect(outcome.kind).toBe('cancelled');
		expect(store.canUndo).toBe(false);
		expect(wallFirstDocument(layoutPreview).walls).toHaveLength(8);
	});

	it('exposes exclusive boundary Walls through the read-only adapter', () => {
		const { layoutPreview } = makeStore();
		expect(wallFirstRoomExclusiveBoundaryWallIds(layoutPreview, 'room-left').sort()).toEqual([
			'wall-a1',
			'wall-c2',
			'wall-d'
		]);
		expect(wallFirstRoomExclusiveBoundaryWallIds(layoutPreview, 'room-missing')).toEqual([]);
	});	it('refuses both adapters on a legacy document', () => {
		const layoutPreview = createEmptyLayoutPreviewState();
		// `createEmptyLayoutPreviewState()` boots the legacy compatibility
		// fixture; the wall-first adapters must refuse it rather than guess.
		expect(updateWallFirstRoomMetadata(layoutPreview, 'room-left', { name: 'X' }).success).toBe(
			false
		);
		expect(removeWallFirstRoom(layoutPreview, 'room-left', EMPTY_SCENE).success).toBe(
			false
		);
	});

	it('commits when no retiring Room is scene-referenced (scene untouched)', () => {
		const { store, layoutPreview } = makeStore();
		const sceneJson = serializeSceneDocument(store.document);
		const before = layoutPreviewCanonicalJson(layoutPreview);
		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => removeWallFirstRoom(layoutPreview, 'room-right', store.document),
			(result) => result.success
		);
		expect(outcome.kind).toBe('committed');
		expect(store.canUndo).toBe(true);
		expect(wallFirstDocument(layoutPreview).rooms.map((room) => room.id)).toEqual(['room-left']);
		// The layout candidate installed; the authoritative scene never changed.
		expect(layoutPreviewCanonicalJson(layoutPreview)).not.toBe(before);
		expect(serializeSceneDocument(store.document)).toBe(sceneJson);
	});

	it('rejects atomically when the selected Room is scene-referenced (zero history)', () => {
		const { store, layoutPreview } = makeStore(BASE, sceneReferencingRoom('room-right'));
		const layoutBefore = serializeWallFirstLayoutDocument(wallFirstDocument(layoutPreview));
		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => removeWallFirstRoom(layoutPreview, 'room-right', store.document),
			(result) => result.success
		);
		expect(outcome.kind).toBe('cancelled');
		if (outcome.kind !== 'cancelled') throw new Error('expected cancellation');
		const failure = outcome.result;
		expect(failure.success).toBe(false);
		if (failure.success) throw new Error('expected failure');
		expect(failure.message).toContain('referenced by scene content');
		expect(failure.message).toContain('room-right');
		expect(store.canUndo).toBe(false);
		// Exact preservation: the layout document is byte-identical and the
		// selection is unchanged (nothing installed, nothing retired).
		expect(serializeWallFirstLayoutDocument(wallFirstDocument(layoutPreview))).toBe(layoutBefore);
		// The authoritative scene is never mutated by a blocked removal.
		expect(serializeSceneDocument(store.document)).toBe(
			serializeSceneDocument(sceneReferencingRoom('room-right'))
		);
	});

	it('rejects when a COLLATERAL retirement is scene-referenced even though the selected Room is clean', () => {
		// The selected outer room survives (deterministic merge-winner tie-break);
		// reconciliation still retires the inner room — checking only the
		// selected `roomId` would miss it.
		const nested = nestedOuterInnerDocument();
		expect(roomExclusiveBoundaryWallIds(nested, 'room-a')).toEqual(['wall-o1', 'wall-o2', 'wall-o3', 'wall-o4']);
		const plan = success(planRemoveRoom(nested, 'room-a'));
		expect(plan.retiredRoomIds).toEqual(['room-z']);
		expect(plan.document.rooms.map((room) => room.id)).toEqual(['room-a']);

		const scene = sceneReferencingRoom('room-z');
		const { store, layoutPreview } = makeStore(nested, scene);
		const layoutBefore = serializeWallFirstLayoutDocument(wallFirstDocument(layoutPreview));
		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => removeWallFirstRoom(layoutPreview, 'room-a', store.document),
			(result) => result.success
		);
		expect(outcome.kind).toBe('cancelled');
		if (outcome.kind !== 'cancelled') throw new Error('expected cancellation');
		const failure = outcome.result;
		expect(failure.success).toBe(false);
		if (failure.success) throw new Error('expected failure');
		expect(store.canUndo).toBe(false);
		expect(serializeWallFirstLayoutDocument(wallFirstDocument(layoutPreview))).toBe(layoutBefore);
		// The blocked reason names the collateral Room, not the selected one.
		expect(failure.message).toContain('room-z');
		expect(failure.message).not.toContain('room-a');
		// Read-only preview agrees with the executor's policy (no second rule).
		expect(wallFirstRoomSceneBlockedRoomIds(layoutPreview, 'room-a', store.document)).toEqual([
			'room-z'
		]);
		expect(wallFirstRoomSceneBlockedRoomIds(layoutPreview, 'room-missing', store.document)).toEqual([]);
	});

	it('wallFirstRoomSceneBlockedRoomIds reports [] for a clean removal', () => {
		const { store, layoutPreview } = makeStore();
		expect(wallFirstRoomSceneBlockedRoomIds(layoutPreview, 'room-right', store.document)).toEqual([]);
	});
});

describe('P23.6d plan menu — canonical Room removal item', () => {
	it('exposes exactly the Remove room item when the action is provided', () => {
		const removeRoom = vi.fn();
		const items = buildPlanLayoutContextMenuItems({
			target: { kind: 'room', roomId: 'room-left' },
			mutationBlockedReason: null,
			actions: { removeRoom, deleteOpening: vi.fn(), deleteObject: vi.fn() }
		});
		expect(items.map((item) => item.id)).toEqual(['remove-room']);
		expect(items[0]!.label).toBe('Remove room…');
		items[0]!.run();
		expect(removeRoom).toHaveBeenCalledWith('room-left');
	});

	it('omits the item entirely when no canonical action exists (omit-don’t-dummy)', () => {
		const items = buildPlanLayoutContextMenuItems({
			target: { kind: 'room', roomId: 'room-left' },
			mutationBlockedReason: null,
			actions: { deleteOpening: vi.fn(), deleteObject: vi.fn() }
		});
		expect(items).toEqual([]);
	});
});

describe('P23.6d caller wiring — row authority and selection policy', () => {
	const LIB_DIR = fileURLToPath(new URL('../../../src/lib', import.meta.url));

	function readSource(relativePath: string): string {
		return fs.readFileSync(path.join(LIB_DIR, relativePath), 'utf8');
	}

	it('the Inspector Room panel edits metadata through the canonical adapter', () => {
		const source = readSource('editor/EditorInspector.svelte');
		expect(source).toContain('updateWallFirstRoomMetadata(layoutPreview, room.id');
		expect(source).toContain('function updateWallFirstRoomName');
		expect(source).toContain('function updateWallFirstRoomThickness');
	});

	it('the Inspector Remove room action deletes the whole Room', () => {
		const source = readSource('editor/EditorInspector.svelte');
		expect(source).toContain('removeWallFirstRoom(layoutPreview, room.id, store.document)');
		expect(source).toContain('wallFirstRoomExclusiveBoundaryWallIds(layoutPreview, selectedWallFirstRoom.id)');
		expect(source).toContain('>Remove room</button>');
	});

	it('metadata preserves the selection while removal clears it to none', () => {
		const source = readSource('editor/EditorInspector.svelte');
		// Removal clears the canonical selection (the Room retires).
		const removeStart = source.indexOf('function removeSelectedWallFirstRoom');
		expect(removeStart).toBeGreaterThan(-1);
		expect(source.slice(removeStart, removeStart + 1200)).toContain(
			"layoutInteraction.selection = { kind: 'none' }"
		);
		// The metadata handlers never touch selection.
		const nameStart = source.indexOf('function updateWallFirstRoomName');
		const nameEnd = source.indexOf('function removeSelectedWallFirstRoom');
		const nameBody = source.slice(nameStart, nameEnd);
		expect(nameBody).not.toContain('selection =');
	});

	it('the hierarchy wall-first Room row exposes removal under the row-authority gate', () => {
		const source = readSource('editor/UnifiedProjectTree.svelte');
		expect(source).toContain('function onWallFirstRoomRowContextMenu');
		const handlerStart = source.indexOf('function onWallFirstRoomRowContextMenu');
		const openCall = source.indexOf('openTreeContextMenu(', handlerStart);
		const handlerBody = source.slice(handlerStart, openCall);
		expect(handlerBody).toContain("if (!roomRowInteractive({ kind: 'room', roomId })) return;");
		expect(handlerBody).toContain('removeRoom:');
		expect(source).toContain('removeWallFirstRoom(layoutPreview, roomId, store.document)');
		// The row binds the gated context-menu handler.
		expect(source).toContain('onWallFirstRoomRowContextMenu(event, room.roomId)');
	});

	it('the Plan viewport routes wall-first Room removal through the canonical adapter (never the legacy commands)', () => {
		const source = readSource('editor/layout/LayoutPlanViewport.svelte');
		// The Layout-mode room context menu is format-aware: wall-first Rooms get
		// ONLY the canonical removal, because the legacy `renameRoom`/`deleteRoom`
		// commands reject wall-first documents (dead menu items).
		expect(source).toContain('onRoomRemove?: (roomId: string) => boolean;');
		const actionsStart = source.indexOf('actions: wallFirstLayoutDocument()');
		expect(actionsStart).toBeGreaterThan(-1);
		const actionsBlock = source.slice(
			actionsStart,
			source.indexOf('deleteLayoutObjectViaTransaction', actionsStart)
		);
		expect(actionsBlock).toContain('removeRoom:');
		expect(actionsBlock).toContain('onRoomRemove?.(roomId)');
		expect(actionsBlock).not.toContain('renameRoom');
		expect(actionsBlock).not.toContain('onRoomDelete');
	});

	it('the Delete/Backspace Room branch is format-aware (canonical wall-first removal)', () => {
		const source = readSource('editor/layout/LayoutPlanViewport.svelte');
		const branchStart = source.indexOf(
			"interaction.selection.kind === 'room'",
			source.indexOf('function onKeyDown')
		);
		expect(branchStart).toBeGreaterThan(-1);
		const branch = source.slice(branchStart, branchStart + 1600);
		expect(branch).toContain('wallFirstLayoutDocument()');
		expect(branch).toContain('onRoomRemove?.');
		expect(branch).toContain('onRoomDelete(');
	});

	it('a remembered Room selection survives the switch to Arrange and Delete cannot reach it from there (review regression)', () => {
		// Premise (real behavior): `setPlanViewMode` deliberately keeps the
		// committed Layout selection as memory when switching to Arrange —
		// so the Room selection is still present in an authority-inert mode.
		const layoutInteraction = createLayoutInteractionState();
		selectLayoutRoom(layoutInteraction, 'room-right');
		setPlanViewMode(layoutInteraction, 'staging');
		expect(layoutInteraction.selection).toEqual({ kind: 'room', roomId: 'room-right' });
		// Authority: the viewport's wall-first Room Delete branch requires
		// Layout mode. Without the gate, the Arrange owner-delete branch (Scene
		// delete needs an active Scene target; the Layout-object branch needs an
		// active Layout object) falls through into the remembered Room selection
		// and dispatches canonical `onRoomRemove` from Arrange.
		const source = readSource('editor/layout/LayoutPlanViewport.svelte');
		const dispatch = source.indexOf('onRoomRemove?.(interaction.selection.roomId)');
		expect(dispatch).toBeGreaterThan(-1);
		// The dispatch is guarded by the Layout-authority condition inside the
		// wall-first branch (between the wallFirst guard and the dispatch).
		const branchStart = source.lastIndexOf('wallFirstLayoutDocument()', dispatch);
		expect(branchStart).toBeGreaterThan(-1);
		const guard = source.slice(branchStart, dispatch);
		expect(guard).toContain("interaction.planViewMode === 'layout'");
		// Legacy behavior is unchanged: the legacy `onRoomDelete` path stays
		// ungated by planViewMode (its own guarded legacy delete).
		const legacyDispatch = source.indexOf('onRoomDelete(interaction.selection.roomId)');
		expect(legacyDispatch).toBeGreaterThan(-1);
	});

	it('both viewport mount sites wire the canonical removeRoom handler with the authoritative scene', () => {
		for (const relativePath of [
			'editor/EditorViewport.svelte',
			'editor/app/PlanWorkspace.svelte'
		]) {
			const source = readSource(relativePath);
			expect(source).toContain('removeWallFirstRoom(layoutPreview, roomId, store.document)');
			expect(source).toContain('wallFirstRoomExclusiveBoundaryWallIds(layoutPreview, roomId)');
			expect(source).toContain('onRoomRemove={removeRoom}');
		}
	});

	it('Camera domain exposes no Room removal authority (review regression)', () => {
		const cameraSidebar = readSource('editor/app/CameraSidebar.svelte');
		expect(cameraSidebar).not.toContain('oncontextmenu');
		expect(cameraSidebar).not.toContain('removeWallFirstRoom');
		expect(cameraSidebar).not.toContain('buildPlanLayoutContextMenuItems');
	});
});

describe('P23.6d legacy single-Wall delete stays intact', () => {
	it('planDeleteWall still deletes exactly one Wall', () => {
		const plan = success(planDeleteWall(BASE, 'wall-e'));
		expect(plan.document.walls.map((wall) => wall.id)).not.toContain('wall-e');
		expect(plan.document.rooms).toHaveLength(1);
	});
});
