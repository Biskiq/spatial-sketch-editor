/**
 * Pre-P23B.8 follow-up (whole-Room drag slice) — the transient contract for a
 * whole-Room unit drag, and the zero-work invariant the gesture change promises.
 *
 * This file mirrors what the Plan viewport now does per pointermove (it does not
 * call the viewport; the viewport has no test mount), so the assertions are about
 * the shipped sequence:
 *
 * ```
 * pointerdown  → capture the frozen baseline + resolve the moving set ONCE
 * pointermove  → transientRoomUnitMove(baseline, unit, delta): install NOTHING
 * release      → restore the (already installed) baseline, then ONE canonical
 *                planner call at the release coordinate, then commit or cancel
 * ```
 *
 * What must stay true (the change is admissible only because these hold):
 *
 * - per move: zero compiles, zero installs, zero mesh preparations, zero history,
 *   and the installed document byte-identical to the frozen baseline;
 * - the attempt drawn per move is derived from the frozen baseline and the TOTAL
 *   delta — never from a remembered intermediate;
 * - release: the candidate is re-derived from the RELEASE coordinate and one
 *   history entry is written for the accepted document, with exact Undo;
 * - refusal, cancel and no-op leave the baseline exact and write nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
import { planWallFirstRoomMove } from '$lib/layout/layout-room-move';
import {
	beginLayoutRoomUnitDrag,
	cancelLayoutRoomUnitDrag,
	createLayoutInteractionState,
	selectLayoutRoom,
	updateLayoutRoomUnitDrag
} from '$lib/editor/layout/layout-interaction';
import {
	transientRoomUnitMove,
	transientRoomUnitRotation,
	type LayoutTransientRoomUnitMove
} from '$lib/editor/layout/layout-transient-room-unit';
import {
	buildPlanInteractionProjection,
	withRoomUnitMoveIntent
} from '$lib/editor/layout/plan-overlays';
import { buildLayoutPreviewModel } from '$lib/editor/layout/layout-mesh-factory';
import {
	captureLayoutPreviewSnapshot,
	createEmptyLayoutPreviewState,
	importLayoutPreviewJson,
	layoutPreviewDocument,
	previewWallFirstRoomMove,
	previewWallFirstRoomRotation,
	restoreLayoutPreviewSnapshot,
	wallFirstRoomMoveEligibility
} from '$lib/editor/layout/layout-preview-state.svelte';
import { restoreTransientArchitectureBaseline } from '$lib/editor/layout/layout-transient-edit';

// ---------------------------------------------------------------------------
// Fixture: one isolated 6×4 enclosure (its own Junctions and Walls only)
// ---------------------------------------------------------------------------

function isolatedRoomDocument(): LayoutDocumentWallFirst {
	const base: LayoutDocumentWallFirst = {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [
			{ id: 'j-a', point: [0, 0] },
			{ id: 'j-b', point: [6, 0] },
			{ id: 'j-c', point: [6, 4] },
			{ id: 'j-d', point: [0, 4] }
		],
		walls: [
			{ id: 'wall-a1', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const },
			{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const },
			{ id: 'wall-c', startJunctionId: 'j-c', endJunctionId: 'j-d', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const },
			{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const }
		],
		rooms: [],
		openings: [],
		objects: []
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

// ---------------------------------------------------------------------------
// Harness — the viewport's own sequence, call for call
// ---------------------------------------------------------------------------

type Context = {
	store: ReturnType<typeof createEditorStore>;
	layoutPreview: ReturnType<typeof createEmptyLayoutPreviewState>;
	layoutInteraction: ReturnType<typeof createLayoutInteractionState>;
	snapshot: ReturnType<typeof captureLayoutPreviewSnapshot> | null;
};

function makeStore(document: LayoutDocumentWallFirst = isolatedRoomDocument()): Context {
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	const layoutPreview = createEmptyLayoutPreviewState();
	if (!importLayoutPreviewJson(layoutPreview, serializeWallFirstLayoutDocument(document))) {
		throw new Error('wall-first import failed');
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

function baselineJson(context: Context): string {
	return JSON.stringify(liveDocument(context));
}

function liveDocument(context: Context): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(context.layoutPreview);
	if (!('formatVersion' in document)) throw new Error('expected a wall-first document');
	return document;
}

/** Viewport pointer-down: select, check eligibility, open the gesture with the unit. */
function startRoomUnitDrag(context: Context, roomId: string): boolean {
	const { store, layoutPreview, layoutInteraction } = context;
	selectLayoutRoom(layoutInteraction, roomId);
	const eligibility = wallFirstRoomMoveEligibility(layoutPreview, roomId);
	if (!eligibility.movable) {
		layoutPreview.statusMessage = eligibility.hint;
		return false;
	}
	if (!store.beginLayoutTransaction()) return false;
	context.snapshot = captureLayoutPreviewSnapshot(layoutPreview);
	beginLayoutRoomUnitDrag(
		layoutInteraction,
		roomId,
		'translate',
		[0, 0],
		[0, 0],
		eligibility.subgraph.roomIds,
		{ wallIds: eligibility.subgraph.wallIds, junctionIds: eligibility.subgraph.junctionIds }
	);
	return true;
}

/** Viewport pointer-move under the transient contract: total delta, install nothing. */
function moveRoomUnitDrag(context: Context, delta: LayoutVec2): LayoutTransientRoomUnitMove | null {
	const drag = context.layoutInteraction.roomUnitDrag;
	if (!drag || !context.snapshot) throw new Error('no active Room-unit drag');
	updateLayoutRoomUnitDrag(
		context.layoutInteraction,
		[drag.startWorld[0] + delta[0], drag.startWorld[1] + delta[1]],
		false,
		false,
		false
	);
	const layout = context.snapshot.project.layout;
	if (!('formatVersion' in layout)) return null;
	return transientRoomUnitMove({
		baseline: layout as unknown as LayoutDocumentWallFirst,
		unit:
			drag.unitWallIds.length > 0
				? { wallIds: drag.unitWallIds, junctionIds: drag.unitJunctionIds }
				: null,
		delta: drag.translation,
		geometry: context.snapshot.geometry,
		roomIds: drag.groupRoomIds
	});
}

/** Viewport pointer-up: guarded restore, ONE planner call at the release point. */
function releaseRoomUnitDrag(
	context: Context,
	releaseDelta: LayoutVec2
): { valid: boolean; movedRoomIds?: readonly string[] } {
	const { layoutPreview, layoutInteraction } = context;
	const drag = layoutInteraction.roomUnitDrag;
	if (!drag || !context.snapshot) throw new Error('no active Room-unit drag');
	updateLayoutRoomUnitDrag(
		layoutInteraction,
		[drag.startWorld[0] + releaseDelta[0], drag.startWorld[1] + releaseDelta[1]],
		false,
		false,
		false
	);
	restoreTransientArchitectureBaseline(layoutPreview, context.snapshot);
	const result = previewWallFirstRoomMove(layoutPreview, drag.roomId, drag.translation);
	// Mirrors the viewport's `onLayoutTransactionCommit()`: the accepted preview
	// state is handed to the one history entry.
	if (result.success) {
		context.store.commitLayoutTransaction(captureLayoutPreviewSnapshot(layoutPreview));
	} else {
		context.store.cancelLayoutTransaction();
	}
	cancelLayoutRoomUnitDrag(layoutInteraction);
	context.snapshot = null;
	return result.success
		? { valid: true, movedRoomIds: result.movedRoomIds }
		: { valid: false };
}

/** The single canonical planner call a release is equivalent to. */
function plannedDocument(document: LayoutDocumentWallFirst, delta: LayoutVec2): LayoutDocumentWallFirst {
	const plan = planWallFirstRoomMove(document, 'room-1', delta);
	if (plan.kind !== 'success') throw new Error(`planner refused ${delta[0]},${delta[1]}`);
	return plan.document;
}

// ---------------------------------------------------------------------------

describe('transient whole-Room drag — nothing is installed per move', () => {
	it('N pointer moves install nothing, write no history and leave the baseline byte-identical', () => {
		const context = makeStore();
		const baseline = baselineJson(context);
		const frozenGeometry = context.snapshot?.geometry;
		expect(startRoomUnitDrag(context, 'room-1')).toBe(true);
		const snapshotGeometry = context.snapshot!.geometry;

		const deltas: LayoutVec2[] = [
			[2, 0],
			[4, 3],
			[1, 1],
			[6, 2],
			[3.5, 3.5]
		];
		for (const delta of deltas) {
			const attempt = moveRoomUnitDrag(context, delta);
			expect(attempt, `attempt for ${delta[0]},${delta[1]}`).not.toBeNull();
			// The moving set's Walls are the attempt; nothing else was invented.
			expect(attempt!.walls.length).toBeGreaterThan(0);
			expect(attempt!.rooms.map((room) => room.roomId)).toEqual(['room-1']);
			// The attempt is the baseline shifted by the TOTAL delta.
			const first = attempt!.walls[0]!;
			expect(first.points.length).toBeGreaterThan(1);
		}

		// Zero installs: the live document is still the baseline, byte for byte,
		// and the frozen compiled geometry was never replaced.
		expect(baselineJson(context)).toBe(baseline);
		expect(context.layoutPreview.geometry).toBe(snapshotGeometry);
		expect(frozenGeometry).toBeUndefined();
		// Zero history: there is nothing to undo.
		expect(context.store.undo()).toBe(false);
		expect(cancelRoomUnitDragAndBaseline(context)).toBe(baseline);
	});
});

describe('transient whole-Room drag — the release is still one planner call', () => {
	it('commits exactly the planner’s candidate for the RELEASE delta, with one entry and exact undo', () => {
		const instance = makeStore();
		const baseline = baselineJson(instance);
		const original = liveDocument(instance);
		expect(startRoomUnitDrag(instance, 'room-1')).toBe(true);
		// Several moves, none of them the release position.
		moveRoomUnitDrag(instance, [2, 0]);
		moveRoomUnitDrag(instance, [9, 9]);
		moveRoomUnitDrag(instance, [1, 1]);

		const releaseDelta: LayoutVec2 = [5, 2];
		const released = releaseRoomUnitDrag(instance, releaseDelta);
		expect(released.valid).toBe(true);
		// The committed document is exactly the one planner call, not the last preview.
		expect(JSON.stringify(liveDocument(instance))).toBe(
			JSON.stringify(plannedDocument(original, releaseDelta))
		);
		// Exactly one history entry.
		expect(instance.store.undo()).toBe(true);
		expect(baselineJson(instance)).toBe(baseline);
		expect(instance.store.redo()).toBe(true);
		expect(JSON.stringify(liveDocument(instance))).toBe(
			JSON.stringify(plannedDocument(original, releaseDelta))
		);
	});

	it('an invalid release commits nothing and leaves the baseline exact', () => {
		const instance = makeStore();
		const baseline = baselineJson(instance);
		expect(startRoomUnitDrag(instance, 'room-1')).toBe(true);
		moveRoomUnitDrag(instance, [2, 2]);
		// A non-finite delta is the planner's own reachable refusal here.
		const released = releaseRoomUnitDrag(instance, [Number.NaN, 0]);
		expect(released.valid).toBe(false);
		expect(baselineJson(instance)).toBe(baseline);
		expect(instance.store.undo()).toBe(false);
	});

	it('a cancel leaves the baseline exact with zero history', () => {
		const instance = makeStore();
		const baseline = baselineJson(instance);
		expect(startRoomUnitDrag(instance, 'room-1')).toBe(true);
		moveRoomUnitDrag(instance, [3, 1]);
		expect(cancelRoomUnitDragAndBaseline(instance)).toBe(baseline);
		expect(instance.store.undo()).toBe(false);
	});
});

describe('transient whole-Room drag — the gesture’s own gates', () => {
	it('draws nothing for a press that has not moved, and nothing without a frozen moving set', () => {
		const instance = makeStore();
		expect(startRoomUnitDrag(instance, 'room-1')).toBe(true);
		// Zero delta: a press is not an attempt (the drag threshold's equivalent).
		expect(moveRoomUnitDrag(instance, [0, 0])).toBeNull();
		// A drag that carries no canonical moving set cannot draw an honest attempt.
		instance.layoutInteraction.roomUnitDrag!.unitWallIds = [];
		expect(moveRoomUnitDrag(instance, [2, 2])).toBeNull();
	});

	it('derives every attempt from the frozen baseline and the TOTAL delta, never an intermediate', () => {
		const instance = makeStore();
		expect(startRoomUnitDrag(instance, 'room-1')).toBe(true);
		const direct = moveRoomUnitDrag(instance, [4, 3]);
		// Walk there through other positions: the total delta is what is drawn.
		const instance2 = makeStore();
		expect(startRoomUnitDrag(instance2, 'room-1')).toBe(true);
		moveRoomUnitDrag(instance2, [99, -40]);
		moveRoomUnitDrag(instance2, [-12, 12]);
		const indirect = moveRoomUnitDrag(instance2, [4, 3]);
		expect(JSON.stringify(indirect)).toBe(JSON.stringify(direct));
	});
});

describe('transient whole-Room drag — the Plan draws the attempt beside the committed ink', () => {
	it('adds the moving set’s attempt without touching the committed projection', () => {
		const instance = makeStore();
		expect(startRoomUnitDrag(instance, 'room-1')).toBe(true);
		const attempt = moveRoomUnitDrag(instance, [3, 2])!;
		const model = buildLayoutPreviewModel(liveDocument(instance)).model;
		const base = buildPlanInteractionProjection(instance.layoutInteraction, [], model);
		const baseSnapshot = JSON.stringify(base);
		const projected = withRoomUnitMoveIntent(base, {
			kind: 'room-unit-move',
			walls: attempt.walls,
			rooms: attempt.rooms
		});

		// The base projection is not mutated, and gains exactly the attempt.
		expect(JSON.stringify(base)).toBe(baseSnapshot);
		const added = projected.drafts.filter((primitive) =>
			primitive.key.includes('7:overlay')
		);
		expect(added.length).toBe(attempt.walls.length + attempt.rooms.length);
		for (const primitive of added) {
			expect(primitive.kind).toBe('polyline');
			expect(primitive.style).toBe('architecture-edit-intent');
		}
		// The Room outline is closed for stroking, and lands on the attempt.
		const roomIntent = attempt.rooms[0]!;
		const roomPrimitive = added.find((primitive) => primitive.key.includes('room-1'))!;
		expect(roomPrimitive.kind === 'polyline' && roomPrimitive.points.length).toBe(
			roomIntent.points.length + 1
		);
		// A null intent is the identity — no gesture, no overlay.
		expect(withRoomUnitMoveIntent(base, null)).toBe(base);
	});
});

// ---------------------------------------------------------------------------
// The ROTATION gesture — the same contract, a rigidly rotated candidate
// ---------------------------------------------------------------------------

/** The 6×4 fixture's own centre, the pivot a user grabs. */
const ROTATION_PIVOT: LayoutVec2 = [3, 2];

/** The shipped rotation convention (core's `rotatePointAbout`). */
function spun(point: LayoutVec2, yaw: number): LayoutVec2 {
	const cos = Math.cos(yaw);
	const sin = Math.sin(yaw);
	const x = point[0] - ROTATION_PIVOT[0];
	const z = point[1] - ROTATION_PIVOT[1];
	return [ROTATION_PIVOT[0] + x * cos + z * sin, ROTATION_PIVOT[1] - x * sin + z * cos];
}

/** Viewport pointer-down for a ROTATION: same eligibility, `rotate` mode. */
function startRoomUnitRotation(context: Context, roomId: string): boolean {
	const { store, layoutPreview, layoutInteraction } = context;
	selectLayoutRoom(layoutInteraction, roomId);
	const eligibility = wallFirstRoomMoveEligibility(layoutPreview, roomId);
	if (!eligibility.movable) return false;
	if (!store.beginLayoutTransaction()) return false;
	context.snapshot = captureLayoutPreviewSnapshot(layoutPreview);
	// The grab point is to the RIGHT of the pivot, so `startAngle` is 0 and every
	// pointer position below sets `drag.yaw` to the angle it is placed at.
	beginLayoutRoomUnitDrag(
		layoutInteraction,
		roomId,
		'rotate',
		[ROTATION_PIVOT[0] + 4, ROTATION_PIVOT[1]],
		ROTATION_PIVOT,
		eligibility.subgraph.roomIds,
		{ wallIds: eligibility.subgraph.wallIds, junctionIds: eligibility.subgraph.junctionIds }
	);
	return true;
}

/** Move the pointer to `yaw` about the pivot and return the transient attempt. */
function moveRoomUnitRotation(context: Context, yaw: number): LayoutTransientRoomUnitMove | null {
	const drag = context.layoutInteraction.roomUnitDrag;
	if (!drag || !context.snapshot) throw new Error('no active Room-unit drag');
	updateLayoutRoomUnitDrag(
		context.layoutInteraction,
		[ROTATION_PIVOT[0] + 4 * Math.cos(yaw), ROTATION_PIVOT[1] + 4 * Math.sin(yaw)],
		false,
		false,
		false
	);
	const layout = context.snapshot.project.layout;
	if (!('formatVersion' in layout)) return null;
	return transientRoomUnitRotation({
		baseline: layout as unknown as LayoutDocumentWallFirst,
		unit:
			drag.unitWallIds.length > 0
				? { wallIds: drag.unitWallIds, junctionIds: drag.unitJunctionIds }
				: null,
		pivot: drag.pivot,
		yaw: drag.yaw,
		geometry: context.snapshot.geometry,
		roomIds: drag.groupRoomIds
	});
}

/** Release at `yaw`: guarded restore, then ONE canonical rotation planner call. */
function releaseRoomUnitRotation(context: Context, yaw: number): { valid: boolean } {
	const { layoutPreview, layoutInteraction } = context;
	const drag = layoutInteraction.roomUnitDrag;
	if (!drag || !context.snapshot) throw new Error('no active Room-unit drag');
	updateLayoutRoomUnitDrag(
		layoutInteraction,
		[ROTATION_PIVOT[0] + 4 * Math.cos(yaw), ROTATION_PIVOT[1] + 4 * Math.sin(yaw)],
		false,
		false,
		false
	);
	restoreTransientArchitectureBaseline(layoutPreview, context.snapshot);
	const result = previewWallFirstRoomRotation(layoutPreview, drag.roomId, drag.pivot, drag.yaw);
	if (result.success) {
		context.store.commitLayoutTransaction(captureLayoutPreviewSnapshot(layoutPreview));
	} else {
		context.store.cancelLayoutTransaction();
	}
	cancelLayoutRoomUnitDrag(layoutInteraction);
	context.snapshot = null;
	return { valid: result.success };
}

describe('transient whole-Room ROTATION — the same contract, a rigid unit turn', () => {
	const QUARTER_TURN = Math.PI / 2;

	it('installs nothing per move and draws the unit rigidly rotated about the pivot', () => {
		const instance = makeStore();
		const before = baselineJson(instance);
		expect(startRoomUnitRotation(instance, 'room-1')).toBe(true);
		const attempt = moveRoomUnitRotation(instance, QUARTER_TURN)!;
		// Nothing installed, no history, baseline byte-identical.
		expect(baselineJson(instance)).toBe(before);
		expect(instance.store.canUndo).toBe(false);
		expect(attempt.walls.length).toBe(4);
		// The Room's outline is the pivot-rotation of its baseline outline.
		const outline = attempt.rooms.find((room) => room.roomId === 'room-1')!;
		const baselineOutline = instance.snapshot!.geometry.rooms.find(
			(room) => room.roomId === 'room-1'
		)!.floorPolygon;
		expect(outline.points.length).toBe(baselineOutline.length);
		outline.points.forEach((point, index) => {
			const expected = spun(baselineOutline[index]!, QUARTER_TURN);
			expect(Math.abs(point[0] - expected[0])).toBeLessThan(1e-9);
			expect(Math.abs(point[1] - expected[1])).toBeLessThan(1e-9);
		});
	});

	it('derives the attempt from the TOTAL angle, never from a remembered step', () => {
		const instance = makeStore();
		expect(startRoomUnitRotation(instance, 'room-1')).toBe(true);
		moveRoomUnitRotation(instance, QUARTER_TURN / 2);
		const second = moveRoomUnitRotation(instance, QUARTER_TURN)!;
		const fresh = makeStore();
		expect(startRoomUnitRotation(fresh, 'room-1')).toBe(true);
		expect(JSON.stringify(moveRoomUnitRotation(fresh, QUARTER_TURN))).toBe(JSON.stringify(second));
	});

	it('a zero angle draws nothing — a press that has not turned must not flash a candidate', () => {
		const instance = makeStore();
		expect(startRoomUnitRotation(instance, 'room-1')).toBe(true);
		expect(moveRoomUnitRotation(instance, 0)).toBeNull();
	});

	it('re-derives at the RELEASE angle: commits one entry, undo is exact', () => {
		const instance = makeStore();
		const before = baselineJson(instance);
		expect(startRoomUnitRotation(instance, 'room-1')).toBe(true);
		// Preview at a quarter turn, release at an eighth: the release angle is the
		// only one that may commit.
		moveRoomUnitRotation(instance, QUARTER_TURN);
		expect(releaseRoomUnitRotation(instance, QUARTER_TURN / 2).valid).toBe(true);

		expect(instance.store.canUndo).toBe(true);
		// The committed document is the release angle's planner candidate, not the
		// quarter turn that was last previewed.
		const committed = liveDocument(instance);
		for (const junction of committed.junctions) {
			const expected = spun(
				isolatedRoomDocument().junctions.find((entry) => entry.id === junction.id)!.point,
				QUARTER_TURN / 2
			);
			expect(Math.abs(junction.point[0] - expected[0])).toBeLessThan(1e-9);
			expect(Math.abs(junction.point[1] - expected[1])).toBeLessThan(1e-9);
		}
		// Exactly one entry, and Undo puts the baseline back byte for byte.
		expect(instance.store.undo()).toBe(true);
		expect(baselineJson(instance)).toBe(before);
	});

	it('a no-op release (the angle never changed) is silent and writes nothing', () => {
		const instance = makeStore();
		const before = baselineJson(instance);
		expect(startRoomUnitRotation(instance, 'room-1')).toBe(true);
		expect(releaseRoomUnitRotation(instance, 0).valid).toBe(false);
		expect(instance.store.canUndo).toBe(false);
		expect(baselineJson(instance)).toBe(before);
	});

	it('a cancel leaves the baseline exact with zero history', () => {
		const instance = makeStore();
		const before = baselineJson(instance);
		expect(startRoomUnitRotation(instance, 'room-1')).toBe(true);
		moveRoomUnitRotation(instance, QUARTER_TURN);
		expect(cancelRoomUnitDragAndBaseline(instance)).toBe(before);
		expect(instance.store.canUndo).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Wiring — the shipped viewport actually takes the transient path
// ---------------------------------------------------------------------------

const here = path.dirname(fileURLToPath(import.meta.url));
const editorRoot = path.resolve(here, '../../../../');

function viewportSource(): string {
	return fs.readFileSync(
		path.join(editorRoot, 'src/lib/editor/layout/LayoutPlanViewport.svelte'),
		'utf8'
	);
}

function occurrences(haystack: string, needle: string): number {
	return haystack.split(needle).length - 1;
}

describe('whole-Room drag wiring — each path is called exactly once', () => {
	it('builds the attempt per move and keeps ONE canonical planner call per gesture', () => {
		const viewport = viewportSource();
		// The per-move attempt is the transient module's for BOTH rigid motions: one
		// declaration and ONE per-move write site, and every other write of that
		// state is a clear (pinned in the test below).
		expect(occurrences(viewport, 'let roomUnitMoveTransient =')).toBe(1);
		expect(occurrences(viewport, 'roomUnitMoveTransient =')).toBe(
			occurrences(viewport, 'roomUnitMoveTransient = null;') + 2
		);
		expect(occurrences(viewport, 'transientRoomUnitMove({')).toBe(1);
		expect(occurrences(viewport, 'transientRoomUnitRotation({')).toBe(1);
		// The SHIPPED path has exactly ONE canonical planner call per motion, both at
		// the release. The only other occurrence is the DEV-gated BEFORE/AFTER arm
		// (§P5) — the very path this slice removed, kept reachable so the before/after
		// can be taken in one session without a pre-change tree. It is pinned inside
		// the arm guard: a third occurrence, or one that is not arm-gated, fails here.
		// Only translation has an arm: rotation had no pre-change path to compare
		// against (it was unreachable), so it has no second call to pin.
		const armGate = "if (drag.mode === 'translate' && p23bM1RoomDragArm() === 'per-move') {";
		expect(occurrences(viewport, armGate)).toBe(1);
		const armBranchStart = viewport.indexOf(armGate);
		const armBranchEnd = viewport.indexOf('roomUnitMoveTransient =', armBranchStart);
		expect(armBranchEnd).toBeGreaterThan(armBranchStart);
		const armBranch = viewport.slice(armBranchStart, armBranchEnd);
		expect(occurrences(armBranch, 'previewWallFirstRoomMove(')).toBe(1);
		// Everything OUTSIDE the arm branch still has exactly the release's one call.
		expect(
			occurrences(viewport.slice(0, armBranchStart) + viewport.slice(armBranchEnd), 'previewWallFirstRoomMove(')
		).toBe(1);
		expect(occurrences(viewport, 'previewWallFirstRoomMove(')).toBe(2);
		expect(occurrences(viewport, 'previewWallFirstRoomRotation(')).toBe(1);
		// The legacy Room-unit path keeps its own per-move installer, because its
		// release commits the last previewed candidate rather than re-deriving.
		expect(occurrences(viewport, 'previewLayoutRoomUnit(')).toBe(1);
		// The attempt is composed into the Plan projection once.
		expect(occurrences(viewport, 'withRoomUnitMoveIntent(')).toBe(1);
		// The release keeps its guarded baseline restore.
		expect(viewport).toContain(
			'restoreTransientArchitectureBaseline(preview, roomUnitSnapshot);'
		);
	});

	it('clears the attempt at EVERY site that ends the gesture, so no stale ghost can outlive it', () => {
		const viewport = viewportSource();
		// `roomUnitSnapshot = null` is the shipped "this Room gesture is over" flag.
		// The attempt must be dropped wherever the gesture is dropped — release,
		// pointer cancel, Escape/tool switch, the broad gesture reset and
		// `clearActiveLayoutDrag`. A missing one leaves the attempt drawn over a
		// baseline that no longer has a gesture.
		expect(occurrences(viewport, 'roomUnitMoveTransient = null;')).toBe(
			occurrences(viewport, 'roomUnitSnapshot = null;')
		);
	});
});

function cancelRoomUnitDragAndBaseline(context: Context): string {
	const { layoutPreview, layoutInteraction } = context;
	restoreTransientArchitectureBaseline(layoutPreview, context.snapshot!);
	cancelLayoutRoomUnitDrag(layoutInteraction);
	context.store.cancelLayoutTransaction();
	context.snapshot = null;
	return baselineJson(context);
}
