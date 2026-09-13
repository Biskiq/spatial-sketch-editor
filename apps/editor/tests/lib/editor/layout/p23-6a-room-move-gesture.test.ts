/**
 * P23.6a — Wall-first Room unit move (editor adapter + gesture lifecycle).
 *
 * The Plan viewport drives the gesture with the same primitives asserted here:
 * one transaction at pointer down, every candidate derived from the immutable
 * `roomUnitSnapshot` baseline, a re-derived candidate at release, and
 * commit-only-when-the-final-derivation-succeeded. Invalid, cancelled, no-op
 * and ineligible gestures write zero history and leave the baseline.
 */
import { describe, expect, it } from 'vitest';

import { createEmptySceneDocument } from '$lib/content/scene';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import { extractBoundaryCandidateFaces } from '$lib/layout/layout-face-extraction';
import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst,
	type LayoutWallFirstRoom,
	type LayoutVec2
} from '$lib/layout/layout-wall-first-types';
import { serializeWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';
import {
	beginLayoutRoomUnitDrag,
	cancelLayoutRoomUnitDrag,
	createLayoutInteractionState,
	selectLayoutRoom,
	setLayoutDraftTool,
	updateLayoutRoomUnitDrag
} from '$lib/editor/layout/layout-interaction';
import {
	captureLayoutPreviewSnapshot,
	createEmptyLayoutPreviewState,
	importLayoutPreviewJson,
	layoutPreviewDocument,
	previewWallFirstRoomMove,
	restoreLayoutPreviewSnapshot,
	wallFirstRoomMoveEligibility
} from '$lib/editor/layout/layout-preview-state.svelte';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Isolated 6×4 enclosure (`room-1`) with one associated object, one
 * unassociated object, and a roomless partition Wall far to the right.
 */
function isolatedRoomDocument(): LayoutDocumentWallFirst {
	const base: LayoutDocumentWallFirst = {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [
			{ id: 'j-a', point: [0, 0] },
			{ id: 'j-b', point: [6, 0] },
			{ id: 'j-c', point: [6, 4] },
			{ id: 'j-d', point: [0, 4] },
			{ id: 'j-x', point: [20, 0] },
			{ id: 'j-y', point: [20, 4] }
		],
		walls: [
			{ id: 'wall-a1', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'boundary', thickness: 0.2, height: 3 },
			{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', role: 'boundary', thickness: 0.2, height: 4.5 },
			{ id: 'wall-c', startJunctionId: 'j-c', endJunctionId: 'j-d', role: 'boundary', thickness: 0.2, height: 3 },
			{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', role: 'boundary', thickness: 0.2, height: 3 },
			{ id: 'wall-rl', startJunctionId: 'j-x', endJunctionId: 'j-y', role: 'partition', thickness: 0.2, height: 3 }
		],
		rooms: [],
		openings: [],
		objects: [
			{
				id: 'obj-1',
				kind: 'box',
				position: [1, 0.5, 1],
				rotation: [0, 0, 0],
				dimensions: [1, 1, 1],
				roomId: 'room-1'
			},
			{
				id: 'obj-free',
				kind: 'box',
				position: [2, 0.5, 2],
				rotation: [0, 0, 0],
				dimensions: [1, 1, 1]
			}
		]
	};
	const face = extractBoundaryCandidateFaces(base).faces[0]!;
	const room: LayoutWallFirstRoom = {
		id: 'room-1',
		name: 'Alone',
		boundary: face.boundary.map((ref) => ({ ...ref })),
		floorThickness: 0.1,
		ceilingThickness: 0.1
	};
	return { ...base, rooms: [room] };
}

/** Shared-wall fixture: two adjacent Rooms sharing `wall-e`. */
function twoRoomDocument(): LayoutDocumentWallFirst {
	const base: LayoutDocumentWallFirst = {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [
			{ id: 'j-a', point: [0, 0] },
			{ id: 'j-b', point: [4, 0] },
			{ id: 'j-e1', point: [8, 0] },
			{ id: 'j-e2', point: [8, 4] },
			{ id: 'j-c', point: [4, 4] },
			{ id: 'j-d', point: [0, 4] }
		],
		walls: [
			{ id: 'wall-a', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'boundary', thickness: 0.2, height: 3 },
			{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', role: 'boundary', thickness: 0.2, height: 3 },
			{ id: 'wall-c', startJunctionId: 'j-c', endJunctionId: 'j-d', role: 'boundary', thickness: 0.2, height: 3 },
			{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', role: 'boundary', thickness: 0.2, height: 3 },
			{ id: 'wall-e', startJunctionId: 'j-b', endJunctionId: 'j-e1', role: 'boundary', thickness: 0.2, height: 3 },
			{ id: 'wall-f', startJunctionId: 'j-e1', endJunctionId: 'j-e2', role: 'boundary', thickness: 0.2, height: 3 },
			{ id: 'wall-g', startJunctionId: 'j-e2', endJunctionId: 'j-c', role: 'boundary', thickness: 0.2, height: 3 }
		],
		rooms: [],
		openings: [],
		objects: []
	};
	const faces = extractBoundaryCandidateFaces(base).faces;
	return {
		...base,
		rooms: faces.map((face, index) => ({
			id: index === 0 ? 'room-left' : 'room-right',
			name: index === 0 ? 'Left' : 'Right',
			boundary: face.boundary.map((ref) => ({ ...ref })),
			floorThickness: 0.1,
			ceilingThickness: 0.1
		}))
	};
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type GestureContext = {
	store: ReturnType<typeof createEditorStore>;
	layoutPreview: ReturnType<typeof createEmptyLayoutPreviewState>;
	layoutInteraction: ReturnType<typeof createLayoutInteractionState>;
	snapshot: ReturnType<typeof captureLayoutPreviewSnapshot> | null;
};

function makeStore(document: LayoutDocumentWallFirst | null = isolatedRoomDocument()): GestureContext {
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	const layoutPreview = createEmptyLayoutPreviewState();
	if (document) {
		const imported = importLayoutPreviewJson(
			layoutPreview,
			serializeWallFirstLayoutDocument(document)
		);
		if (!imported) throw new Error('wall-first import failed');
	}
	const layoutInteraction = createLayoutInteractionState();
	store.registerLayoutHistory({
		capture: () => captureLayoutPreviewSnapshot(layoutPreview),
		replace: (snapshot) =>
			restoreLayoutPreviewSnapshot(
				layoutPreview,
				snapshot as ReturnType<typeof captureLayoutPreviewSnapshot>
			),
		matches: (a, b) =>
			JSON.stringify((a as { project: { layout: unknown } }).project.layout) ===
			JSON.stringify((b as { project: { layout: unknown } }).project.layout)
	});
	store.setLayoutFormatPolicySource(() => layoutPreview);
	return { store, layoutPreview, layoutInteraction, snapshot: null };
}

function live(context: GestureContext): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(context.layoutPreview);
	if (!('formatVersion' in document)) throw new Error('expected wall-first document');
	return document;
}

function point(context: GestureContext, junctionId: string): LayoutVec2 {
	const junction = live(context).junctions.find((entry) => entry.id === junctionId);
	if (!junction) throw new Error(`missing junction ${junctionId}`);
	return [...junction.point] as LayoutVec2;
}

/** Viewport pointer-down: select, check eligibility, then open the gesture. */
function startRoomUnitDrag(context: GestureContext, roomId: string): boolean {
	const { store, layoutPreview, layoutInteraction } = context;
	selectLayoutRoom(layoutInteraction, roomId);
	const eligibility = wallFirstRoomMoveEligibility(layoutPreview, roomId);
	if (!eligibility.movable) {
		layoutPreview.statusMessage = eligibility.hint;
		return false;
	}
	if (!store.beginLayoutTransaction()) return false;
	context.snapshot = captureLayoutPreviewSnapshot(layoutPreview);
	beginLayoutRoomUnitDrag(layoutInteraction, roomId, 'translate', [0, 0], [0, 0]);
	return true;
}

/** Viewport pointer-move: total delta from the baseline, never accumulated. */
function moveRoomUnitDrag(
	context: GestureContext,
	delta: LayoutVec2
): { success: boolean; message?: string } {
	const { layoutPreview, layoutInteraction } = context;
	const drag = layoutInteraction.roomUnitDrag;
	if (!drag || !context.snapshot) throw new Error('no active Room-unit drag');
	updateLayoutRoomUnitDrag(
		layoutInteraction,
		[drag.startWorld[0] + delta[0], drag.startWorld[1] + delta[1]],
		false,
		false,
		false
	);
	restoreLayoutPreviewSnapshot(layoutPreview, context.snapshot);
	const result = previewWallFirstRoomMove(layoutPreview, drag.roomId, drag.translation);
	drag.candidateValid = result.success;
	return result;
}

/** Viewport pointer-up: re-derive once from the release point, then commit. */
function releaseRoomUnitDrag(
	context: GestureContext,
	delta: LayoutVec2
): { kind: 'committed' | 'cancelled' | 'none'; message?: string } {
	const { store, layoutPreview, layoutInteraction } = context;
	const drag = layoutInteraction.roomUnitDrag;
	if (!drag || !context.snapshot) return { kind: 'none' };
	updateLayoutRoomUnitDrag(
		layoutInteraction,
		[drag.startWorld[0] + delta[0], drag.startWorld[1] + delta[1]],
		false,
		false,
		false
	);
	restoreLayoutPreviewSnapshot(layoutPreview, context.snapshot);
	const result = previewWallFirstRoomMove(layoutPreview, drag.roomId, drag.translation);
	drag.candidateValid = result.success;
	let kind: 'committed' | 'cancelled' = 'cancelled';
	if (result.success) {
		const changed = store.commitLayoutTransaction(captureLayoutPreviewSnapshot(layoutPreview));
		kind = changed ? 'committed' : 'cancelled';
		if (!changed) restoreLayoutPreviewSnapshot(layoutPreview, context.snapshot);
	} else {
		store.cancelLayoutTransaction();
		restoreLayoutPreviewSnapshot(layoutPreview, context.snapshot);
	}
	cancelLayoutRoomUnitDrag(layoutInteraction);
	context.snapshot = null;
	return { kind, ...(result.success ? {} : { message: result.message }) };
}

/** Viewport Escape / pointer-cancel / tool switch: baseline, zero history. */
function cancelRoomUnitDrag(context: GestureContext): void {
	const { store, layoutPreview, layoutInteraction } = context;
	if (context.snapshot) restoreLayoutPreviewSnapshot(layoutPreview, context.snapshot);
	store.cancelLayoutTransaction();
	cancelLayoutRoomUnitDrag(layoutInteraction);
	context.snapshot = null;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

describe('P23.6a adapter — previewWallFirstRoomMove', () => {
	it('refuses a legacy document (mirrors previewLayoutRoomUnit)', () => {
		const context = makeStore(null);
		const document = layoutPreviewDocument(context.layoutPreview);
		expect('formatVersion' in document).toBe(false);
		const result = previewWallFirstRoomMove(context.layoutPreview, 'room-1', [1, 0]);
		expect(result.success).toBe(false);
		if (!result.success) expect(result.message.length).toBeGreaterThan(0);
		// Nothing was written: the legacy document is untouched.
		expect(JSON.stringify(layoutPreviewDocument(context.layoutPreview))).toBe(
			JSON.stringify(document)
		);
	});

	it('installs a movable candidate and reports the shared rejection otherwise', () => {
		const context = makeStore();
		const moved = previewWallFirstRoomMove(context.layoutPreview, 'room-1', [12, 0]);
		expect(moved.success).toBe(true);
		expect(point(context, 'j-a')).toEqual([12, 0]);

		const ineligible = previewWallFirstRoomMove(context.layoutPreview, 'room-none', [1, 0]);
		expect(ineligible.success).toBe(false);
		if (!ineligible.success) expect(ineligible.message).toContain('room-none');
	});

	it('reports eligibility through the shared isolation policy', () => {
		const context = makeStore();
		expect(wallFirstRoomMoveEligibility(context.layoutPreview, 'room-1').movable).toBe(true);

		const shared = makeStore(twoRoomDocument());
		const eligibility = wallFirstRoomMoveEligibility(shared.layoutPreview, 'room-left');
		expect(eligibility.movable).toBe(false);
		if (!eligibility.movable) expect(eligibility.rejection.code).toBe('room_not_isolated');
	});

	it('leaves SceneDocument byte-equivalent through a committed move', () => {
		const context = makeStore();
		const sceneBefore = JSON.stringify(context.layoutPreview.project.scene);
		expect(startRoomUnitDrag(context, 'room-1')).toBe(true);
		expect(releaseRoomUnitDrag(context, [12, 0]).kind).toBe('committed');
		expect(JSON.stringify(context.layoutPreview.project.scene)).toBe(sceneBefore);
	});
});

// ---------------------------------------------------------------------------
// Gesture lifecycle + history
// ---------------------------------------------------------------------------

describe('P23.6a gesture — history, cancel and release semantics', () => {
	it('one valid drag = exactly one history entry with exact Undo/Redo', () => {
		const context = makeStore();
		const { store, layoutInteraction } = context;
		const before = JSON.stringify(live(context));

		expect(startRoomUnitDrag(context, 'room-1')).toBe(true);
		expect(moveRoomUnitDrag(context, [12, -3]).success).toBe(true);
		expect(releaseRoomUnitDrag(context, [12, -3]).kind).toBe('committed');

		expect(point(context, 'j-a')).toEqual([12, -3]);
		expect(point(context, 'j-x')).toEqual([20, 0]);
		expect(live(context).objects.find((object) => object.id === 'obj-1')!.position).toEqual([
			13, 0.5, -2
		]);
		// Selection survives the commit on the same canonical Room identity.
		expect(layoutInteraction.selection).toEqual({ kind: 'room', roomId: 'room-1' });

		expect(store.undo()).toBe(true);
		expect(JSON.stringify(live(context))).toBe(before);
		expect(store.canUndo).toBe(false);

		expect(store.redo()).toBe(true);
		expect(point(context, 'j-a')).toEqual([12, -3]);
		expect(live(context).rooms.map((room) => room.id)).toEqual(['room-1']);
	});

	it('an invalid final release after a valid preview commits nothing', () => {
		const context = makeStore();
		const { store } = context;
		const before = JSON.stringify(live(context));

		expect(startRoomUnitDrag(context, 'room-1')).toBe(true);
		// A valid intermediate candidate…
		expect(moveRoomUnitDrag(context, [12, 0]).success).toBe(true);
		// …and an invalid release (j-a would land exactly on j-x).
		const released = releaseRoomUnitDrag(context, [20, 0]);
		expect(released.kind).toBe('cancelled');
		expect(released.message).toBeTruthy();

		expect(JSON.stringify(live(context))).toBe(before);
		expect(store.canUndo).toBe(false);
	});

	it('a no-op release writes zero history', () => {
		const context = makeStore();
		const { store } = context;
		expect(startRoomUnitDrag(context, 'room-1')).toBe(true);
		const released = releaseRoomUnitDrag(context, [0, 0]);
		expect(released.kind).toBe('cancelled');
		expect(store.canUndo).toBe(false);
	});

	it('Escape cancels to the exact baseline with zero history', () => {
		const context = makeStore();
		const { store } = context;
		const before = JSON.stringify(live(context));
		expect(startRoomUnitDrag(context, 'room-1')).toBe(true);
		expect(moveRoomUnitDrag(context, [12, 2]).success).toBe(true);
		cancelRoomUnitDrag(context);
		expect(JSON.stringify(live(context))).toBe(before);
		expect(store.canUndo).toBe(false);
	});

	it('a tool switch during the drag cancels the session safely', () => {
		const context = makeStore();
		const { store, layoutInteraction } = context;
		const before = JSON.stringify(live(context));
		expect(startRoomUnitDrag(context, 'room-1')).toBe(true);
		expect(moveRoomUnitDrag(context, [10, 0]).success).toBe(true);

		// P23.9 toolbar path: the armed tool clears the transient drag…
		setLayoutDraftTool(layoutInteraction, 'rectangle');
		expect(layoutInteraction.roomUnitDrag).toBeNull();
		// …and the viewport's cancel closes the one open transaction.
		context.store.cancelLayoutTransaction();
		restoreLayoutPreviewSnapshot(context.layoutPreview, context.snapshot!);

		expect(JSON.stringify(live(context))).toBe(before);
		expect(store.canUndo).toBe(false);
	});

	it('an ineligible Room selects only — no transaction, no history', () => {
		const context = makeStore(twoRoomDocument());
		const { store, layoutInteraction } = context;
		const before = JSON.stringify(live(context));
		expect(startRoomUnitDrag(context, 'room-left')).toBe(false);
		expect(layoutInteraction.selection).toEqual({ kind: 'room', roomId: 'room-left' });
		expect(layoutInteraction.roomUnitDrag).toBeNull();
		expect(store.canUndo).toBe(false);
		expect(JSON.stringify(live(context))).toBe(before);
		expect(context.layoutPreview.statusMessage).toContain('Move its Walls individually');
	});

	it('tracks candidate validity on the transient drag session only', () => {
		const context = makeStore();
		const { layoutInteraction } = context;
		expect(startRoomUnitDrag(context, 'room-1')).toBe(true);
		const drag = layoutInteraction.roomUnitDrag!;
		expect(drag.candidateValid).toBe(false);

		expect(moveRoomUnitDrag(context, [12, 0]).success).toBe(true);
		expect(drag.candidateValid).toBe(true);

		// Any later update resets validity before the adapter re-resolves it.
		expect(moveRoomUnitDrag(context, [20, 0]).success).toBe(false);
		expect(drag.candidateValid).toBe(false);
		cancelRoomUnitDrag(context);
		// The transient flag never leaks into the undo snapshot.
		expect(JSON.stringify(live(context))).not.toContain('candidateValid');
	});
});
