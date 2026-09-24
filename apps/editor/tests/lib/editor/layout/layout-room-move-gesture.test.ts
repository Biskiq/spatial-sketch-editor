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
import { buildLayoutPreviewModel } from '$lib/editor/layout/layout-mesh-factory';
import { buildPlanInteractionProjection } from '$lib/editor/layout/plan-overlays';
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
			{ id: 'wall-a1', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
			{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', role: 'boundary', thickness: 0.2, height: 4.5, centerline: { kind: 'line' } as const},
			{ id: 'wall-c', startJunctionId: 'j-c', endJunctionId: 'j-d', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
			{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
			{ id: 'wall-rl', startJunctionId: 'j-x', endJunctionId: 'j-y', role: 'partition', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const}
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
			{ id: 'wall-a', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
			{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
			{ id: 'wall-c', startJunctionId: 'j-c', endJunctionId: 'j-d', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
			{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
			{ id: 'wall-e', startJunctionId: 'j-b', endJunctionId: 'j-e1', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
			{ id: 'wall-f', startJunctionId: 'j-e1', endJunctionId: 'j-e2', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
			{ id: 'wall-g', startJunctionId: 'j-e2', endJunctionId: 'j-c', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const}
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

/**
 * Room whose corner Junction carries a stationary partition stub: the Room has
 * no connected peer, but the stub would be torn off by a move — the surviving
 * `room_not_isolated` case under group semantics.
 */
function roomWithPartitionStubDocument(): LayoutDocumentWallFirst {
	const base = isolatedRoomDocument();
	return {
		...base,
		junctions: [...base.junctions, { id: 'j-t', point: [0, -3] }],
		walls: [
			...base.walls,
			{
				id: 'wall-stub',
				startJunctionId: 'j-a',
				endJunctionId: 'j-t',
				role: 'partition',
				thickness: 0.2,
				height: 3,
				centerline: { kind: 'line' } as const,
			}
		]
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
	// Mirrors the viewport: the eligible unit is the connected Room group.
	beginLayoutRoomUnitDrag(
		layoutInteraction,
		roomId,
		'translate',
		[0, 0],
		[0, 0],
		eligibility.subgraph.roomIds
	);
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
		if (changed) {
			// Mirrors the viewport's status line.
			layoutPreview.statusMessage =
				result.movedRoomIds.length > 1
					? `Moved ${result.movedRoomIds.length} rooms`
					: 'Moved room';
		}
		if (!changed) restoreLayoutPreviewSnapshot(layoutPreview, context.snapshot);
	} else {
		store.cancelLayoutTransaction();
		restoreLayoutPreviewSnapshot(layoutPreview, context.snapshot);
		// Mirrors the viewport: cancel/restore replaces `statusMessage`, so the
		// reason is re-applied afterwards. A `no_op` release asked for no
		// movement — it stays silent like any other select-only click.
		if (result.code !== 'no_op') layoutPreview.statusMessage = result.message;
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
		const single = wallFirstRoomMoveEligibility(context.layoutPreview, 'room-1');
		expect(single.movable).toBe(true);
		if (single.movable) expect(single.subgraph.roomIds).toEqual(['room-1']);

		// Amendment A — a Room sharing a Wall with another Room is movable as the
		// connected group, and eligibility names every member.
		const shared = makeStore(twoRoomDocument());
		const eligibility = wallFirstRoomMoveEligibility(shared.layoutPreview, 'room-left');
		expect(eligibility.movable).toBe(true);
		if (eligibility.movable) {
			expect(eligibility.subgraph.roomIds).toEqual(['room-left', 'room-right']);
		}

		// A stationary Wall at a group Junction is still not movable.
		const stubbed = makeStore(roomWithPartitionStubDocument());
		const blocked = wallFirstRoomMoveEligibility(stubbed.layoutPreview, 'room-1');
		expect(blocked.movable).toBe(false);
		if (!blocked.movable) expect(blocked.rejection.code).toBe('room_not_isolated');
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

	it('commits a release onto an INDEPENDENT Junction’s coincident point (P23B.3a S5 / D-9)', () => {
		// The pre-policy verdict for THIS destination was a rejection: [20, 0] lands
		// j-a exactly on j-x and j-d exactly on j-y, and the coincidence rule compared
		// every Junction pair in the document. S5 scoped that rule to the connected
		// component, so the coincident destination is permitted geometry — and the
		// gesture commits it like any other move, joining nothing.
		const context = makeStore();
		const { store } = context;
		const before = JSON.stringify(live(context));

		expect(startRoomUnitDrag(context, 'room-1')).toBe(true);
		expect(moveRoomUnitDrag(context, [20, 0]).success).toBe(true);
		const released = releaseRoomUnitDrag(context, [20, 0]);
		expect(released.kind).toBe('committed');

		expect(point(context, 'j-a')).toEqual([20, 0]);
		// The unrelated coincident node is still its OWN Junction: no adopt, no split.
		expect(point(context, 'j-x')).toEqual([20, 0]);
		expect(live(context).junctions.map((junction) => junction.id)).toEqual([
			'j-a',
			'j-b',
			'j-c',
			'j-d',
			'j-x',
			'j-y'
		]);
		expect(live(context).walls.map((wall) => wall.id)).toEqual([
			'wall-a1',
			'wall-b',
			'wall-c',
			'wall-d',
			'wall-rl'
		]);
		// One committed entry, exactly like the valid-destination case above.
		expect(store.canUndo).toBe(true);
		expect(store.undo()).toBe(true);
		expect(JSON.stringify(live(context))).toBe(before);
	});

	it('an invalid final release after a valid preview commits nothing', () => {
		// SINCE S5 the refusal cannot be a GEOMETRIC destination: a rigid move preserves
		// its own group's geometry exactly, every relation between independent structures
		// is permitted (the coincident destination above is the extreme case), and a
		// structure sharing a Junction with the group makes the Room ineligible before a
		// drag ever opens (the ineligible case below). The reachable non-`no_op` refusal
		// while a drag is live is the planner's intent guard, so this lifecycle case —
		// cancel, restore, keep the reason on screen, write no history — exercises it. The
		// same-component direction of S5's scoping is pinned by the S5 oracle.
		const context = makeStore();
		const { store } = context;
		const before = JSON.stringify(live(context));

		expect(startRoomUnitDrag(context, 'room-1')).toBe(true);
		// A valid intermediate candidate…
		expect(moveRoomUnitDrag(context, [12, 0]).success).toBe(true);
		// …and a release the planner refuses (a non-finite translation).
		const released = releaseRoomUnitDrag(context, [Number.NaN, 0]);
		expect(released.kind).toBe('cancelled');
		expect(released.message).toBeTruthy();

		expect(JSON.stringify(live(context))).toBe(before);
		expect(store.canUndo).toBe(false);
		// The Room snapped back with its reason still on screen: the cancel +
		// snapshot restore must not erase the rejection the user needs to see.
		expect(context.layoutPreview.statusMessage).toBe(released.message);
	});

	it('a no-op release writes zero history', () => {
		const context = makeStore();
		const { store } = context;
		expect(startRoomUnitDrag(context, 'room-1')).toBe(true);
		const released = releaseRoomUnitDrag(context, [0, 0]);
		expect(released.kind).toBe('cancelled');
		expect(store.canUndo).toBe(false);
	});

	it('a no-op release reports nothing — a click is not a rejection', () => {
		const context = makeStore();
		const { store } = context;
		const baseline = context.layoutPreview.statusMessage;
		expect(startRoomUnitDrag(context, 'room-1')).toBe(true);

		const released = releaseRoomUnitDrag(context, [0, 0]);

		// The planner rejects a zero delta with `no_op`; that is the gesture
		// asking for nothing, so the status line is left exactly as it was (a
		// press and release inside a Room selects it, like the legacy path).
		expect(released.kind).toBe('cancelled');
		expect(released.message).toContain('non-zero');
		expect(context.layoutPreview.statusMessage).toBe(baseline);
		expect(store.canUndo).toBe(false);
	});

	it('clears the live rejection message when a pointer move resolves valid again', () => {
		// The live-preview path sets its own message per pointer move; the release
		// path must not depend on it, because the release restores first. The refusal
		// is the reachable one for a live drag since S5 — see the invalid-release case
		// above — and the message it leaves behind must not survive a valid move.
		const context = makeStore();
		expect(startRoomUnitDrag(context, 'room-1')).toBe(true);
		const refused = moveRoomUnitDrag(context, [Number.NaN, 0]);
		expect(refused.success).toBe(false);
		// The viewport writes the refusal to the status line after the restore-then-
		// resolve, so the test does the same before checking it is cleared.
		context.layoutPreview.statusMessage = refused.message!;
		const rejection = context.layoutPreview.statusMessage;
		expect(rejection).toBeTruthy();

		expect(moveRoomUnitDrag(context, [12, 0]).success).toBe(true);
		// A valid candidate clears the stale rejection (restore-then-resolve).
		expect(context.layoutPreview.statusMessage).not.toBe(rejection);
	});

	it('reports the planner code so a no-op release is distinguishable from a rejection', () => {
		// This is the contract the viewport's release branch reads: without the
		// code, "the gesture asked for nothing" and "the gesture was rejected"
		// are the same shape and a click would print a rejection reason.
		const context = makeStore();

		const noOp = previewWallFirstRoomMove(context.layoutPreview, 'room-1', [0, 0]);
		if (noOp.success) throw new Error('expected the zero delta to reject');
		expect(noOp.code).toBe('no_op');

		// A REAL refusal, on the fixture whose Room cannot move at all: a corner
		// Junction carries a stationary partition stub, so the rigid unit would be torn
		// off. (The coincident destination this case used before S5 — j-a landing exactly
		// on j-x — is permitted geometry now; D-9 scopes the coincidence rule to the
		// component, and the destination suite asserts that successor.)
		const blocked = makeStore(roomWithPartitionStubDocument());
		const rejected = previewWallFirstRoomMove(blocked.layoutPreview, 'room-1', [20, 0]);
		if (rejected.success) throw new Error('expected the attached stub to reject the move');
		expect(rejected.code).toBe('room_not_isolated');
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
		const context = makeStore(roomWithPartitionStubDocument());
		const { store, layoutInteraction } = context;
		const before = JSON.stringify(live(context));
		expect(startRoomUnitDrag(context, 'room-1')).toBe(false);
		expect(layoutInteraction.selection).toEqual({ kind: 'room', roomId: 'room-1' });
		expect(layoutInteraction.roomUnitDrag).toBeNull();
		expect(store.canUndo).toBe(false);
		expect(JSON.stringify(live(context))).toBe(before);
		expect(context.layoutPreview.statusMessage).toContain('Move its Walls individually');
	});

	it('moves a connected Room pair as one unit with one history entry', () => {
		const context = makeStore(twoRoomDocument());
		const { store, layoutInteraction } = context;
		const before = JSON.stringify(live(context));

		expect(startRoomUnitDrag(context, 'room-left')).toBe(true);
		// The session carries the whole moving unit for the overlay highlight.
		expect(layoutInteraction.roomUnitDrag?.groupRoomIds).toEqual([
			'room-left',
			'room-right'
		]);
		expect(moveRoomUnitDrag(context, [0, 20]).success).toBe(true);
		expect(releaseRoomUnitDrag(context, [0, 20]).kind).toBe('committed');

		// Both Rooms moved; identities, names and the shared Wall are intact.
		expect(live(context).rooms.map((room) => room.id).sort()).toEqual([
			'room-left',
			'room-right'
		]);
		expect(point(context, 'j-a')).toEqual([0, 20]);
		expect(point(context, 'j-e1')).toEqual([8, 20]);
		expect(live(context).walls.filter((wall) => wall.id === 'wall-b')).toHaveLength(1);
		expect(context.layoutPreview.statusMessage).toBe('Moved 2 rooms');

		// Exactly one entry restores and re-applies the whole group.
		expect(store.undo()).toBe(true);
		expect(JSON.stringify(live(context))).toBe(before);
		expect(store.redo()).toBe(true);
		expect(point(context, 'j-a')).toEqual([0, 20]);
		expect(point(context, 'j-e1')).toEqual([8, 20]);
	});

	it('tracks candidate validity on the transient drag session only', () => {
		const context = makeStore();
		const { layoutInteraction } = context;
		expect(startRoomUnitDrag(context, 'room-1')).toBe(true);
		const drag = layoutInteraction.roomUnitDrag!;
		expect(drag.candidateValid).toBe(false);

		expect(moveRoomUnitDrag(context, [12, 0]).success).toBe(true);
		expect(drag.candidateValid).toBe(true);

		// Any later update resets validity before the adapter re-resolves it. (The
		// refusal is the reachable one for a live drag since S5; see the invalid-release
		// case above.)
		expect(moveRoomUnitDrag(context, [Number.NaN, 0]).success).toBe(false);
		expect(drag.candidateValid).toBe(false);
		cancelRoomUnitDrag(context);
		// The transient flag never leaks into the undo snapshot.
		expect(JSON.stringify(live(context))).not.toContain('candidateValid');
	});
});

// ---------------------------------------------------------------------------
// Presentation — the moving unit is visible, not inferred
// ---------------------------------------------------------------------------

describe('P23.6a amendment A — group move presentation', () => {
	it('highlights every member Room while a group drag is live', () => {
		const context = makeStore(twoRoomDocument());
		expect(startRoomUnitDrag(context, 'room-left')).toBe(true);

		const model = buildLayoutPreviewModel(live(context)).model;
		const projection = buildPlanInteractionProjection(
			context.layoutInteraction,
			[],
			model
		);
		const groupBounds = projection.selection.filter(
			(primitive) => primitive.style === 'selection-bounds'
		);
		expect(groupBounds).toHaveLength(2);
		const polygons = groupBounds.flatMap((primitive) =>
			primitive.kind === 'polygon' ? [primitive.points] : []
		);
		expect(polygons).toHaveLength(2);
		// Both 4×4 enclosures are highlighted, not just the dragged one.
		for (const points of polygons) expect(points).toHaveLength(4);
		cancelRoomUnitDrag(context);
	});
});
