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
 * - `planRemoveRoom` is a guard-railed intent over the P23.6c Wall pipeline:
 *   it selects exactly one **Room-exclusive** boundary Wall, refuses shared
 *   Walls (`wall_not_exclusive`), non-boundary Walls
 *   (`wall_not_in_room_boundary`) and <2-Wall faces
 *   (`ambiguous_room_removal`), then delegates to `planDeleteWall` so the
 *   Room retires through normal P23.8 reconciliation — never a record splice.
 *
 * Editor integration (`updateWallFirstRoomMetadata` / `removeWallFirstRoom`
 * through the guarded history runner): one command = exactly one history
 * entry, rejections write zero entries, and Undo/Redo restore exact
 * Wall/Junction/Opening/Room IDs. Selection policy is operation-specific:
 * metadata preserves the selected Room; removal clears it to `none`
 * (caller-owned), pinned by source contract.
 */
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractBoundaryCandidateFaces } from '$lib/layout/layout-face-extraction';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptySceneDocument } from '$lib/content/scene';
import {
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
	layoutPreviewDocument,
	removeWallFirstRoom,
	restoreLayoutPreviewSnapshot,
	updateWallFirstRoomMetadata,
	wallFirstRoomExclusiveBoundaryWallIds
} from '$lib/editor/layout/layout-preview-state.svelte';
import { layoutMutationRunnerFor, runLayoutMutation } from '$lib/editor/layout/layout-mutation-runner';
import {
	createLayoutInteractionState,
	selectLayoutRoom
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

function makeStore(seed: LayoutDocumentWallFirst = BASE) {
	const store = createEditorStore({
		document: createEmptySceneDocument(),
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
		// Explicit same-values patch is also a no-op.
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

describe('P23.6d planRemoveRoom — guard-railed intent over the Wall pipeline', () => {
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

	it('retires the Room deterministically through P23.8 reconciliation', () => {
		const plan = success(planRemoveRoom(BASE, 'room-right', 'wall-b'));
		expect(plan.document.walls.map((wall) => wall.id)).not.toContain('wall-b');
		expect(plan.document.rooms.map((room) => room.id)).toEqual(['room-left']);
		expect(plan.retiredRoomIds).toEqual(['room-right']);
		expect(validateWallFirstLayoutDocument(plan.document).success).toBe(true);
		expect(compileWallFirstLayoutGeometry(plan.document).geometry.rooms).toHaveLength(1);
		// The retired Room's other boundary Walls survive.
		expect(plan.document.walls.map((wall) => wall.id)).toEqual(
			expect.arrayContaining(['wall-a2', 'wall-c1', 'wall-e'])
		);
	});

	it('delegates to planDeleteWall rather than forking the pipeline', () => {
		const direct = success(planDeleteWall(BASE, 'wall-b'));
		const viaRoom = success(planRemoveRoom(BASE, 'room-right', 'wall-b'));
		expect(viaRoom.document).toEqual(direct.document);
		expect(viaRoom.retiredRoomIds).toEqual(direct.retiredRoomIds);
	});

	it('refuses a shared boundary Wall (wall_not_exclusive) and a foreign Wall', () => {
		expect(rejection(planRemoveRoom(BASE, 'room-left', 'wall-e')).code).toBe('wall_not_exclusive');
		// Right room's shared divider is also not exclusive to it.
		expect(rejection(planRemoveRoom(BASE, 'room-right', 'wall-e')).code).toBe('wall_not_exclusive');
		expect(rejection(planRemoveRoom(BASE, 'room-right', 'wall-a1')).code).toBe(
			'wall_not_in_room_boundary'
		);
		expect(rejection(planRemoveRoom(BASE, 'room-right', 'wall-rl')).code).toBe(
			'wall_not_in_room_boundary'
		);
	});

	it('refuses a 1-Wall face (ambiguous_room_removal) before any boundary lookup', () => {
		const oneWall: LayoutDocumentWallFirst = {
			...BASE,
			rooms: BASE.rooms.map((room) =>
				room.id === 'room-left'
					? { ...room, boundary: room.boundary.slice(0, 1) }
					: room
			)
		};
		expect(rejection(planRemoveRoom(oneWall, 'room-left', 'wall-e')).code).toBe(
			'ambiguous_room_removal'
		);
	});

	it('rejects unknown Room / unknown Wall atomically', () => {
		expect(rejection(planRemoveRoom(BASE, 'room-missing', 'wall-b')).code).toBe('unknown_room');
		expect(rejection(planRemoveRoom(BASE, 'room-right', 'wall-missing')).code).toBe('unknown_wall');
	});

	it('removes the removed Wall hosted Openings atomically', () => {
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
		const plan = success(planRemoveRoom(hosted, 'room-right', 'wall-b'));
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
		const plan = success(planRemoveRoom(withObjects, 'room-right', 'wall-b'));
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
		const plan = planRemoveRoom(related, 'room-right', 'wall-b');
		expect(plan.kind).toBe('rejected');
		if (plan.kind === 'rejected') {
			// Either the reconciliation's own code or its wrap; the command is
			// refused atomically either way.
			expect(['room_reconciliation_rejected', 'unresolved_portal_remap']).toContain(
				plan.rejection.code
			);
		}
	});

	it('never sweeps Junctions still referenced by a surviving Wall (endpoint-scoped cleanup)', () => {
		const withOrphan: LayoutDocumentWallFirst = {
			...BASE,
			junctions: [...BASE.junctions, { id: 'j-orphan', point: [20, 20] }]
		};
		const plan = success(planRemoveRoom(withOrphan, 'room-right', 'wall-b'));
		const ids = new Set(plan.document.junctions.map((junction) => junction.id));
		// Every endpoint of a boundary Wall is shared with the surviving
		// boundary chain, so Room removal must never orphan them; and the
		// unrelated pre-existing orphan is never swept.
		expect(ids.has('j-b')).toBe(true);
		expect(ids.has('j-c')).toBe(true);
		expect(ids.has('j-orphan')).toBe(true);
		// The removed Wall's own endpoints are still the only prune candidates:
		// a room-exclusive boundary Wall whose endpoint is genuinely
		// unreferenced prunes reference-only (pinned via the delegated delete).
		const orphaned = success(planDeleteWall({ ...withOrphan, rooms: [] }, 'wall-rl'));
		expect(orphaned.document.junctions.map((junction) => junction.id)).not.toContain('j-x');
		expect(orphaned.document.junctions.map((junction) => junction.id)).toContain('j-orphan');
	});

	it('is input-pure and rejects leave zero partial mutation', () => {
		const snapshot = JSON.stringify(BASE);
		success(planRemoveRoom(BASE, 'room-right', 'wall-b'));
		rejection(planRemoveRoom(BASE, 'room-left', 'wall-e'));
		rejection(planRemoveRoom(BASE, 'room-right', 'wall-a1'));
		rejection(planRemoveRoom(BASE, 'room-missing', 'wall-b'));
		expect(JSON.stringify(BASE)).toBe(snapshot);
	});
});

describe('P23.6d editor adapters — history and selection', () => {
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

	it('removes a Room in one history entry; Undo/Redo restore exact IDs', () => {
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
			() => removeWallFirstRoom(layoutPreview, 'room-right', 'wall-b'),
			(result) => result.success
		);
		if (outcome.kind !== 'committed') throw new Error(`expected commit: ${JSON.stringify(outcome)}`);
		const after = wallFirstDocument(layoutPreview);
		expect(after.rooms.map((room) => room.id)).toEqual(['room-left']);
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
			() => removeWallFirstRoom(layoutPreview, 'room-left', 'wall-e'),
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
	});

	it('refuses both adapters on a legacy document', () => {
		const layoutPreview = createEmptyLayoutPreviewState();
		// `createEmptyLayoutPreviewState()` boots the legacy compatibility
		// fixture; the wall-first adapters must refuse it rather than guess.
		expect(updateWallFirstRoomMetadata(layoutPreview, 'room-left', { name: 'X' }).success).toBe(
			false
		);
		expect(removeWallFirstRoom(layoutPreview, 'room-left', 'wall-b').success).toBe(false);
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

	it('the Inspector Remove room action uses the adapter and lists exclusive Walls', () => {
		const source = readSource('editor/EditorInspector.svelte');
		expect(source).toContain('removeWallFirstRoom(layoutPreview, room.id, wallId)');
		expect(source).toContain('wallFirstRoomExclusiveBoundaryWallIds(layoutPreview, selectedWallFirstRoom.id)');
		expect(source).toContain('>Remove room</button>');
	});

	it('metadata preserves the selection while removal clears it to none', () => {
		const source = readSource('editor/EditorInspector.svelte');
		// Removal clears the canonical selection (the Room retires).
		const removeStart = source.indexOf('function removeSelectedWallFirstRoom');
		expect(removeStart).toBeGreaterThan(-1);
		expect(source.slice(removeStart, removeStart + 900)).toContain(
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
		expect(source).toContain('removeWallFirstRoom(layoutPreview, roomId, wallId)');
		// The row binds the gated context-menu handler.
		expect(source).toContain('onWallFirstRoomRowContextMenu(event, room.roomId)');
	});

	it('Camera domain exposes no Room removal authority (review regression)', () => {
		const cameraSidebar = readSource('editor/app/CameraSidebar.svelte');
		expect(cameraSidebar).not.toContain('oncontextmenu');
		expect(cameraSidebar).not.toContain('removeWallFirstRoom');
		expect(cameraSidebar).not.toContain('buildPlanLayoutContextMenuItems');
	});
});
