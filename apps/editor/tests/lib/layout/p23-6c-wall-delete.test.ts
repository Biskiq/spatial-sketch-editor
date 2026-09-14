/**
 * P23.6c — canonical Wall deletion.
 *
 * Planner contract (`planDeleteWall`, the `planWallRoleChange` architecture):
 * topology-changing Wall operations go through candidate graph → face
 * extraction → P23.8 Room reconciliation → canonical validation/compiler,
 * never direct `walls` mutation. Pinned here:
 *
 * - shared boundary Wall between two Rooms reconciles 2→1 through the normal
 *   path when one valid face remains;
 * - an outer boundary Wall opens the enclosure → the affected Room retires
 *   deterministically;
 * - a roomless/partition Wall removes cleanly with existing Room topology
 *   and identities unchanged;
 * - hosted Openings go away atomically in every successful case;
 * - endpoint Junctions are pruned reference-only (no spatial healing);
 * - portal relations remap/clear per the existing P23.8 contract;
 * - ambiguous/unsupported input rejects atomically (zero history);
 * - document-level object associations remap through reconciliation.
 *
 * Editor integration (`deleteWallFirstWall` through the guarded history
 * runner): one delete = exactly one history entry, exact Undo/Redo of Wall/
 * Junction/Opening/Room IDs, rejections write zero entries, and the callers'
 * fixed post-delete policy clears the canonical Wall selection to `none`
 * (pinned by source contract across the viewport/Inspector/hierarchy callers).
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
	planWallRoleChange,
	type WallFirstOpPlan
} from '@portfolio/layout-core';
import {
	captureLayoutPreviewSnapshot,
	createEmptyLayoutPreviewState,
	deleteWallFirstWall,
	importLayoutPreviewJson,
	layoutPreviewDocument,
	restoreLayoutPreviewSnapshot
} from '$lib/editor/layout/layout-preview-state.svelte';
import { layoutMutationRunnerFor, runLayoutMutation } from '$lib/editor/layout/layout-mutation-runner';
import {
	createLayoutInteractionState,
	selectLayoutPhysicalWall,
	setPlanViewMode
} from '$lib/editor/layout/layout-interaction';
import { isUnifiedTreeRowInteractive, type UnifiedTreeRow } from '$lib/editor/unified-project-tree-model';
import { buildPlanLayoutContextMenuItems } from '$lib/editor/context-menu/plan-menu-items';

type WallSeed = {
	id: string;
	start: string;
	end: string;
	role?: 'boundary' | 'partition';
};

/**
 * Two-room wall-first fixture: a 6×4 enclosure split at x=3 by the shared
 * boundary Wall `wall-e` (bounds BOTH rooms — one physical Wall), plus a
 * disconnected roomless partition Wall `wall-rl`. Rooms come from real face
 * extraction so boundaries are genuine reconciled cycles.
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

describe('P23.6c planDeleteWall — planner contract', () => {
	it('validates the fixture document before any operation', () => {
		expect(validateWallFirstLayoutDocument(BASE).success).toBe(true);
	});

	it('deletes a shared boundary Wall and reconciles 2 Rooms → 1 through the normal path', () => {
		const plan = success(planDeleteWall(BASE, 'wall-e'));
		// One physical Wall gone; both predecessor rooms replaced by exactly
		// one survivor (the merge-survivor keeps the deterministic winner's ID).
		expect(plan.document.walls.map((wall) => wall.id)).not.toContain('wall-e');
		expect(plan.document.rooms).toHaveLength(1);
		expect(plan.retiredRoomIds).toHaveLength(1);
		expect(plan.document.rooms[0]!.boundary.map((ref) => ref.wallId)).toEqual([
			'wall-a1',
			'wall-a2',
			'wall-b',
			'wall-c1',
			'wall-c2',
			'wall-d'
		]);
		// The merged face validates and compiles canonically.
		expect(validateWallFirstLayoutDocument(plan.document).success).toBe(true);
		expect(compileWallFirstLayoutGeometry(plan.document).geometry.rooms).toHaveLength(1);
		// Shared endpoint Junctions survive: j-m and j-n are still referenced
		// by wall-a1/wall-a2 and wall-c1/wall-c2 respectively.
		const junctionIds = plan.document.junctions.map((junction) => junction.id);
		expect(junctionIds).toContain('j-m');
		expect(junctionIds).toContain('j-n');
	});

	it('deletes an outer boundary Wall and retires the opened Room deterministically', () => {
		const plan = success(planDeleteWall(BASE, 'wall-b'));
		expect(plan.document.walls.map((wall) => wall.id)).not.toContain('wall-b');
		// The right enclosure opened: room-right retired, room-left untouched.
		expect(plan.document.rooms.map((room) => room.id)).toEqual(['room-left']);
		expect(plan.retiredRoomIds).toEqual(['room-right']);
		expect(plan.document.rooms[0]!.boundary.map((ref) => ref.wallId)).toEqual([
			'wall-a1',
			'wall-e',
			'wall-c2',
			'wall-d'
		]);
		expect(validateWallFirstLayoutDocument(plan.document).success).toBe(true);
	});

	it('deletes a roomless partition Wall with existing Room topology and identities unchanged', () => {
		const plan = success(planDeleteWall(BASE, 'wall-rl'));
		expect(plan.document.walls.map((wall) => wall.id)).not.toContain('wall-rl');
		expect(plan.document.rooms.map((room) => room.id)).toEqual(['room-left', 'room-right']);
		expect(plan.retiredRoomIds).toEqual([]);
		expect(plan.lineage).toEqual([]);
		// Reference-only pruning: j-x and j-y are now unreferenced endpoints.
		const junctionIds = new Set(plan.document.junctions.map((junction) => junction.id));
		expect(junctionIds.has('j-x')).toBe(false);
		expect(junctionIds.has('j-y')).toBe(false);
		expect(junctionIds.has('j-a')).toBe(true);
		expect(junctionIds.has('j-c')).toBe(true);
	});

	it('removes hosted Openings atomically in every successful case', () => {
		const hosted: LayoutDocumentWallFirst = {
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
					profile: 'rectangular'
				},
				{
					id: 'opening:window:1',
					wallId: 'wall-rl',
					kind: 'window',
					offset: 0.5,
					width: 1.2,
					height: 1.2,
					sillHeight: 1,
					profile: 'rectangular'
				}
			]
		};
		const sharedDelete = success(planDeleteWall(hosted, 'wall-e'));
		expect(sharedDelete.document.openings.map((opening) => opening.id)).toEqual([
			'opening:window:1'
		]);
		const partitionDelete = success(planDeleteWall(hosted, 'wall-rl'));
		expect(partitionDelete.document.openings.map((opening) => opening.id)).toEqual([
			'opening:door:1'
		]);
	});

	it('prunes Junctions reference-only: shared endpoints never vanish, orphans do', () => {
		// Deleting the roomless partition orphans exactly its two endpoints.
		const orphanPlan = success(planDeleteWall(BASE, 'wall-rl'));
		expect(orphanPlan.document.junctions.map((junction) => junction.id)).toEqual([
			'j-a',
			'j-m',
			'j-b',
			'j-c',
			'j-n',
			'j-d'
		]);
		// Deleting one segment of the left room's outer boundary keeps j-a:
		// wall-d still references it (no spatial healing, no merging).
		const outerPlan = success(planDeleteWall(BASE, 'wall-a1'));
		const junctionIds = new Set(outerPlan.document.junctions.map((junction) => junction.id));
		expect(junctionIds.has('j-a')).toBe(true);
		expect(junctionIds.has('j-m')).toBe(true);
	});

	it('never sweeps pre-existing orphan Junctions unrelated to the deleted Wall (review regression)', () => {
		// An orphan Junction parked far from both rooms, authored before the
		// delete and referenced by no Wall. It belongs to no Wall's endpoints,
		// so deleting ANY Wall must leave it alone — cleanup is scoped to the
		// deleted Wall's own startJunctionId/endJunctionId, never a
		// document-wide unreferenced-Junction sweep.
		const withUnrelatedOrphan: LayoutDocumentWallFirst = {
			...BASE,
			junctions: [...BASE.junctions, { id: 'j-orphan', point: [20, 20] }]
		};
		// The orphan is valid input: walls resolve, rooms are untouched.
		expect(validateWallFirstLayoutDocument(withUnrelatedOrphan).success).toBe(true);
		for (const wallId of ['wall-rl', 'wall-e', 'wall-b']) {
			const plan = success(planDeleteWall(withUnrelatedOrphan, wallId));
			expect(plan.document.junctions.map((junction) => junction.id)).toContain('j-orphan');
			expect(validateWallFirstLayoutDocument(plan.document).success).toBe(true);
		}
		// The deleted Wall's own endpoints still prune under the same rule:
		// wall-rl's j-x/j-y go, but the unrelated orphan survives.
		const partitionPlan = success(planDeleteWall(withUnrelatedOrphan, 'wall-rl'));
		const ids = new Set(partitionPlan.document.junctions.map((junction) => junction.id));
		expect(ids.has('j-x')).toBe(false);
		expect(ids.has('j-y')).toBe(false);
		expect(ids.has('j-orphan')).toBe(true);
		// And when one endpoint IS shared with a surviving Wall, it survives
		// while the other endpoint goes — per-endpoint reference check.
		const outerPlan = success(planDeleteWall(withUnrelatedOrphan, 'wall-a1'));
		const outerIds = new Set(outerPlan.document.junctions.map((junction) => junction.id));
		expect(outerIds.has('j-a')).toBe(true);
		expect(outerIds.has('j-m')).toBe(true);
		expect(outerIds.has('j-orphan')).toBe(true);
	});

	it('remaps a surviving-wall portal relation through the 2→1 merge', () => {
		const related: LayoutDocumentWallFirst = {
			...BASE,
			openings: [
				{
					id: 'opening:door:2',
					wallId: 'wall-d',
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
		const plan = success(planDeleteWall(related, 'wall-e'));
		expect(plan.document.openings).toHaveLength(1);
		// Both endpoints resolve to the deterministic merge survivor; the
		// collapsed tuple clears per the P23.8 semantic-collapse rule only
		// when both sides resolve to one room — here the survivor is one
		// room, so the relation clears rather than pointing [x, x] twice.
		const relation = plan.document.openings[0]!.connectsRoomIds;
		if (relation) {
			for (const roomId of relation) {
				expect(plan.document.rooms.map((room) => room.id)).toContain(roomId);
			}
		}
	});

	it('deletes the deleted Wall hosted Opening (and its relation) wholesale', () => {
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
		const plan = success(planDeleteWall(related, 'wall-e'));
		expect(plan.document.openings).toEqual([]);
	});

	it('remaps document-level object associations through the reconciliation', () => {
		const withObjects: LayoutDocumentWallFirst = {
			...BASE,
			objects: [
				{
					id: 'obj-1',
					kind: 'box',
					position: [1, 0, 2],
					dimensions: [1, 1, 1],
					rotation: [0, 0, 0],
					roomId: 'room-left'
				},
				{
					id: 'obj-2',
					kind: 'box',
					position: [4, 0, 2],
					dimensions: [1, 1, 1],
					rotation: [0, 0, 0],
					roomId: 'room-right'
				}
			]
		};
		const plan = success(planDeleteWall(withObjects, 'wall-e'));
		const byId = new Map(plan.document.objects.map((object) => [object.id, object]));
		const survivorId = plan.document.rooms[0]!.id;
		expect(byId.get('obj-1')!.roomId).toBe(survivorId);
		expect(byId.get('obj-2')!.roomId).toBe(survivorId);
	});

	it('rejects an unknown Wall atomically', () => {
		expect(rejection(planDeleteWall(BASE, 'wall-missing'))).toMatchObject({
			code: 'unknown_wall'
		});
	});

	it('is input-pure: the baseline document is never mutated', () => {
		const snapshot = JSON.stringify(BASE);
		success(planDeleteWall(BASE, 'wall-e'));
		success(planDeleteWall(BASE, 'wall-b'));
		success(planDeleteWall(BASE, 'wall-rl'));
		expect(JSON.stringify(BASE)).toBe(snapshot);
	});

	it('demolishes every Wall one deletion at a time to an empty document', () => {
		let document: LayoutDocumentWallFirst = BASE;
		for (const wallId of ['wall-e', 'wall-b', 'wall-d', 'wall-a1', 'wall-a2', 'wall-c1', 'wall-c2', 'wall-rl']) {
			document = success(planDeleteWall(document, wallId)).document;
			expect(validateWallFirstLayoutDocument(document).success).toBe(true);
		}
		expect(document.walls).toEqual([]);
		expect(document.junctions).toEqual([]);
		expect(document.rooms).toEqual([]);
		expect(compileWallFirstLayoutGeometry(document).geometry.walls).toEqual([]);
	});

	it('keeps the role-change planner independent of the delete path', () => {
		// The partition flip and the delete disagree on the same input without
		// one leaking into the other: flipping wall-rl to boundary creates no
		// closed face, so the role change is a canonical success with no Room
		// change — while the delete of the same wall also succeeds cleanly.
		const flipped = planWallRoleChange(BASE, 'wall-rl', 'boundary');
		expect(flipped.kind).toBe('success');
		expect(success(planDeleteWall(BASE, 'wall-rl')).kind).toBe('success');
	});
});

describe('P23.6c deleteWallFirstWall — editor history integration', () => {
	it('commits exactly one history entry and Undo/Redo restore exact IDs', () => {
		const seeded: LayoutDocumentWallFirst = {
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
					profile: 'rectangular'
				}
			]
		};
		const context = makeStore(seeded);
		const { store, layoutPreview } = context;
		expect(store.canUndo).toBe(false);

		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => deleteWallFirstWall(layoutPreview, 'wall-e'),
			(result) => result.success
		);
		if (outcome.kind !== 'committed') throw new Error(`expected commit: ${JSON.stringify(outcome)}`);
		expect(store.canUndo).toBe(true);
		const after = wallFirstDocument(layoutPreview);
		expect(after.walls.map((wall) => wall.id)).toEqual([
			'wall-a1',
			'wall-a2',
			'wall-b',
			'wall-c1',
			'wall-c2',
			'wall-d',
			'wall-rl'
		]);
		expect(after.openings).toEqual([]);
		expect(after.rooms).toHaveLength(1);

		expect(store.undo()).toBe(true);
		const restored = wallFirstDocument(layoutPreview);
		// Exact snapshot identity: every Wall/Junction/Opening/Room ID returns.
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
		expect(restored.openings.map((opening) => opening.id)).toEqual(['opening:door:1']);
		expect(restored.rooms.map((room) => room.id)).toEqual(['room-left', 'room-right']);
		expect(store.canUndo).toBe(false);

		expect(store.redo()).toBe(true);
		const redone = wallFirstDocument(layoutPreview);
		expect(redone.walls.map((wall) => wall.id)).not.toContain('wall-e');
		expect(redone.rooms).toHaveLength(1);
	});

	it('writes zero history entries when the planner rejects', () => {
		const context = makeStore();
		const { store, layoutPreview } = context;
		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => deleteWallFirstWall(layoutPreview, 'wall-missing'),
			(result) => result.success
		);
		expect(outcome.kind).toBe('cancelled');
		expect(store.canUndo).toBe(false);
		expect(wallFirstDocument(layoutPreview).walls).toHaveLength(8);
	});

	it('refuses the wall-first delete path on a legacy document', () => {
		const store = createEditorStore({
			document: createEmptySceneDocument(),
			rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
		});
		const layoutPreview = createEmptyLayoutPreviewState();
		// `createEmptyLayoutPreviewState()` boots the legacy compatibility
		// fixture; the wall-first adapter must refuse it rather than guess.
		const result = deleteWallFirstWall(layoutPreview, 'wall-e');
		expect(result.success).toBe(false);
		expect(store.canUndo).toBe(false);
	});

	it('the plan context menu exposes exactly the canonical Wall delete', () => {
		const deleteWall = vi.fn();
		const items = buildPlanLayoutContextMenuItems({
			target: { kind: 'wall', wallId: 'wall-e' },
			mutationBlockedReason: null,
			actions: {
				deleteOpening: vi.fn(),
				deleteObject: vi.fn(),
				deleteWall
			}
		});
		expect(items.map((item) => item.id)).toEqual(['delete-wall']);
		items[0]!.run();
		expect(deleteWall).toHaveBeenCalledWith('wall-e');
	});

	it('the plan context menu omits the Wall item when no deleteWall action exists', () => {
		const items = buildPlanLayoutContextMenuItems({
			target: { kind: 'wall', wallId: 'wall-e' },
			mutationBlockedReason: null,
			actions: {
				deleteOpening: vi.fn(),
				deleteObject: vi.fn()
			}
		});
		expect(items).toEqual([]);
	});
});

describe('P23.6c caller wiring — one planner, fixed post-delete selection', () => {
	const LIB_DIR = fileURLToPath(new URL('../../../src/lib', import.meta.url));

	function readSource(relativePath: string): string {
		return fs.readFileSync(path.join(LIB_DIR, relativePath), 'utf8');
	}

	it('Delete/Backspace dispatches the canonical physicalWall selection to the shared handler', () => {
		const source = readSource('editor/layout/LayoutPlanViewport.svelte');
		expect(source).toContain("interaction.selection.kind === 'physicalWall'");
		expect(source).toContain('onWallDelete?.(interaction.selection.wallId)');
	});

	it('viewport callers route the shared adapter and clear the selection to none', () => {
		for (const relativePath of [
			'editor/EditorViewport.svelte',
			'editor/app/PlanWorkspace.svelte'
		]) {
			const source = readSource(relativePath);
			expect(source).toContain('deleteWallFirstWall(layoutPreview, wallId)');
			expect(source).toContain("layoutInteraction.selection = { kind: 'none' }");
		}
	});

	it('the Inspector Delete button calls the same adapter through the guarded runner', () => {
		const source = readSource('editor/EditorInspector.svelte');
		expect(source).toContain('deleteWallFirstWall(layoutPreview, wall.id)');
		expect(source).toContain('deleteSelectedWallFirstWall');
		expect(source).toContain('>Delete wall</button>');
	});

	it('the hierarchy wall row exposes the context-menu delete through the same builder', () => {
		const source = readSource('editor/UnifiedProjectTree.svelte');
		expect(source).toContain('deleteWallFirstWall(layoutPreview, wallId)');
		expect(source).toContain("target: { kind: 'wall', wallId }");
	});

	it('an inert physicalWall row never opens its context menu — the menu obeys the same row-authority gate as activation (review regression)', () => {
		const source = readSource('editor/UnifiedProjectTree.svelte');
		// The handler builds its row and consults the SAME predicate the
		// left-click activation binding uses.
		const handlerStart = source.indexOf('function onWallRowContextMenu');
		expect(handlerStart).toBeGreaterThan(-1);
		const openCall = source.indexOf('openTreeContextMenu(', handlerStart);
		const handlerBody = source.slice(handlerStart, openCall);
		expect(handlerBody).toContain("{ kind: 'physicalWall', wallId }");
		expect(handlerBody).toContain('roomRowInteractive(row)');
		// Gate BEFORE the menu: an authority-refused row returns before any
		// menu can be built, so an inert row can never expose — let alone
		// execute — the canonical Delete command.
		expect(handlerBody).toContain('if (!roomRowInteractive(row)) return;');
		// Activation keeps its own gate (unchanged contract): a row binds
		// selection only when the row is interactive. P23.6e moved canonical Wall
		// activation to the page Navigator, which consults the same authority
		// predicate before it reaches the canonical writer.
		// (The binding also forwards the originating event so Scene modifier-click
		// semantics survive; the interactivity gate is what this asserts.)
		expect(readSource('editor/hierarchy/HierarchyRow.svelte')).toContain(
			'onclick={interactive ? (event) => onSelect(row, event) : undefined}'
		);
		const navigator = readSource('editor/hierarchy/HierarchyNavigator.svelte');
		expect(navigator).toContain('isUnifiedTreeRowInteractive(');
		expect(navigator).toContain('selectLayoutPhysicalWall(layoutInteraction, entity.wallId)');
		// The legacy accordion keeps only the canonical Wall context-menu route.
		expect(source).toContain('function selectPhysicalWall(wallId: string)');
	});

	it('Camera domain exposes no Wall context menu at all — CameraSidebar wires no delete authority (review regression)', () => {
		// The Camera domain renders the Environment projection from the same
		// tree model, but it never mounts the context-menu surface: no
		// oncontextmenu, no menu builder, no deleteWall adapter.
		const cameraSidebar = readSource('editor/app/CameraSidebar.svelte');
		expect(cameraSidebar).not.toContain('oncontextmenu');
		expect(cameraSidebar).not.toContain('buildPlanLayoutContextMenuItems');
		expect(cameraSidebar).not.toContain('deleteWall');
		expect(cameraSidebar).not.toContain('deleteWallFirstWall');
	});

	it('physicalWall row authority: Camera domain and Plan Arrange are inert, Scene layout/3D are authoritative (review regression)', () => {
		const row: UnifiedTreeRow = { kind: 'physicalWall', wallId: 'wall-e' };
		// Inert: no activation, and through the gated handler no context menu.
		expect(isUnifiedTreeRowInteractive(row, 'camera', 'plan')).toBe(false);
		expect(isUnifiedTreeRowInteractive(row, 'camera', '3d')).toBe(false);
		expect(isUnifiedTreeRowInteractive(row, 'scene', 'plan', 'staging')).toBe(false);
		// Authority: the only surfaces whose context menu may offer Delete.
		expect(isUnifiedTreeRowInteractive(row, 'scene', 'plan', 'layout')).toBe(true);
		expect(isUnifiedTreeRowInteractive(row, 'scene', '3d')).toBe(true);
	});

	it('a remembered physicalWall selection survives the switch to Arrange and Delete cannot reach it from there (review regression)', () => {
		// Premise (real behavior): `setPlanViewMode` deliberately keeps the
		// committed Layout selection as memory when switching to Arrange —
		// so the Wall selection is still present in an authority-inert mode.
		const layoutInteraction = createLayoutInteractionState();
		selectLayoutPhysicalWall(layoutInteraction, 'wall-e');
		setPlanViewMode(layoutInteraction, 'staging');
		expect(layoutInteraction.selection).toEqual({ kind: 'physicalWall', wallId: 'wall-e' });
		// Authority: the viewport's Wall Delete branch requires Layout mode.
		// Without the gate, the Arrange owner-delete branch (Scene delete
		// needs an active Scene target; the Layout-object branch needs an
		// active Layout object) falls through into the remembered-Wall
		// selection and deletes a canonical Wall from Arrange.
		const source = readSource('editor/layout/LayoutPlanViewport.svelte');
		const dispatch = source.indexOf('onWallDelete?.(interaction.selection.wallId)');
		expect(dispatch).toBeGreaterThan(-1);
		const condition = source.slice(source.lastIndexOf('if (', dispatch), dispatch);
		expect(condition).toContain("interaction.selection.kind === 'physicalWall'");
		expect(condition).toContain("interaction.planViewMode === 'layout'");
		// The Arrange Scene-delete branch above keeps its active-owner
		// requirement (unchanged contract).
		const keyDownStart = source.indexOf('function onKeyDown');
		expect(keyDownStart).toBeGreaterThan(-1);
		const sceneDispatch = source.indexOf('onSceneDelete?.();', keyDownStart);
		expect(sceneDispatch).toBeGreaterThan(-1);
		expect(source.slice(keyDownStart, sceneDispatch)).toContain('arrangeActiveScene !== null');
	});
});
