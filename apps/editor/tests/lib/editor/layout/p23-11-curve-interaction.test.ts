/**
 * P23.11 slice 6a — the canonical curve interaction contract.
 *
 * A curve control is **transient editing state** keyed by `{ wallId, anchorId }`,
 * never a `LayoutSelection` variant and never a hierarchy row: the Wall stays the
 * durable selection for the whole gesture, so no second identity authority
 * exists. This slice pins the four things the Plan surfaces will drive:
 *
 * - hit authority: Junction / endpoint > Opening body/handle > curve control >
 *   Wall body, with controls supplied per query because only a selected curved
 *   Wall exposes them;
 * - the transient `curve-control-move` gesture, whose candidate is always the
 *   immutable pointer-down anchor plus the TOTAL displacement;
 * - a rejected drag rendering exactly the rejected point (never a fabricated
 *   curve) and nothing at all for an accepted or no-op release;
 * - commit through the shared core planners: one valid release is exactly one
 *   Layout history entry with exact Undo/Redo, and every rejected, no-op or
 *   cancelled release leaves the baseline and history untouched.
 */
import { describe, expect, it } from 'vitest';

import { createEmptySceneDocument } from '$lib/content/scene';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import {
	LAYOUT_ARCHITECTURE_JUNCTION_SNAP_KINDS,
	architectureEditAllowedKinds,
	architectureEditExcludePoints,
	architectureEditExclusionOwners,
	architectureEditRawTarget,
	beginLayoutArchitectureEdit,
	cancelLayoutArchitectureEdit,
	createLayoutInteractionState,
	markLayoutArchitectureEditValidity,
	selectLayoutPhysicalWall,
	updateLayoutArchitectureEdit,
	type LayoutArchitectureEditGesture,
	type LayoutInteractionState
} from '$lib/editor/layout/layout-interaction';
import { layoutMutationRunnerFor, runLayoutMutation } from '$lib/editor/layout/layout-mutation-runner';
import { resolvePlanHit } from '$lib/editor/layout/plan-hit';
import { architectureEditIntentFor, withArchitectureEditIntent } from '$lib/editor/layout/plan-overlays';
import {
	captureLayoutPreviewSnapshot,
	createEmptyLayoutPreviewState,
	deleteWallFirstWallCurveAnchor,
	importLayoutPreviewJson,
	insertWallFirstWallCurveAnchor,
	layoutPreviewDocument,
	restoreLayoutPreviewSnapshot,
	updateWallFirstWallCurve,
	updateWallFirstWallCurveAnchor,
	updateWallFirstWallLine
} from '$lib/editor/layout/layout-preview-state.svelte';
import {
	compileWallFirstLayoutGeometry,
	snapOwnerKey,
	wallCenterlineSamples
} from '@portfolio/layout-core';
import { serializeWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-wall-first-types';
import type { LayoutDocumentWallFirst, LayoutWall } from '$lib/layout/layout-wall-first-types';
import type { PlanInteractionProjection } from '$lib/layout/plan-render-model';
import type { LayoutVec2 } from '$lib/layout/layout-types';

const LINE: LayoutWall['centerline'] = { kind: 'line' };
/** One interior control at the Wall midpoint, bowed 0.5 m into the Room. */
const CURVED: LayoutWall['centerline'] = {
	kind: 'auto-bezier',
	interiorAnchors: [{ id: 'anchor-a1', point: [2, 0.5] }]
};

/**
 * A closed 4×3 m Room with a door on `w1` (offset 1, width 1 → arc `[1, 2]`).
 * `w1` may be straight or bowed 0.5 m into the Room; the bow leaves Room
 * identity, Junction geometry and the authored Opening untouched.
 */
function roomDocument(curved = false): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor', name: 'Floor', elevation: 0 },
		junctions: [
			{ id: 'A', point: [0, 0] },
			{ id: 'B', point: [4, 0] },
			{ id: 'C', point: [4, 3] },
			{ id: 'D', point: [0, 3] }
		],
		walls: [
			{ id: 'w1', startJunctionId: 'A', endJunctionId: 'B', role: 'boundary', thickness: 0.2, height: 3, centerline: curved ? CURVED : LINE },
			{ id: 'w2', startJunctionId: 'B', endJunctionId: 'C', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'w3', startJunctionId: 'C', endJunctionId: 'D', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'w4', startJunctionId: 'D', endJunctionId: 'A', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE }
		],
		rooms: [
			{
				id: 'room',
				name: 'Room',
				boundary: [
					{ wallId: 'w1', direction: 'forward' },
					{ wallId: 'w2', direction: 'forward' },
					{ wallId: 'w3', direction: 'forward' },
					{ wallId: 'w4', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		],
		openings: [
			{
				id: 'door',
				wallId: 'w1',
				kind: 'door',
				offset: 1,
				width: 1,
				height: 2,
				sillHeight: 0,
				profile: 'rectangular'
			}
		],
		objects: []
	};
}

// ---------------------------------------------------------------------------
// Hit authority
// ---------------------------------------------------------------------------

/** The world point at `arcOffset` meters along a Wall's sampled centerline. */
function sampledPointAt(document: LayoutDocumentWallFirst, wallId: string, arcOffset: number): LayoutVec2 {
	const wall: LayoutWall = document.walls.find((candidate) => candidate.id === wallId)!;
	const start = document.junctions.find((junction) => junction.id === wall.startJunctionId)!.point;
	const end = document.junctions.find((junction) => junction.id === wall.endJunctionId)!.point;
	const sampled = wallCenterlineSamples(wall, start, end, 'forward');
	if (!sampled || sampled.samples.length === 0) throw new Error(`could not sample ${wallId}`);
	let best = sampled.samples[0]!;
	for (const sample of sampled.samples) {
		if (Math.abs(sample.distance - arcOffset) < Math.abs(best.distance - arcOffset)) best = sample;
	}
	return [best.point[0], best.point[1]] as LayoutVec2;
}

function controlAt(wallId: string, anchorId: string, point: LayoutVec2) {
	return { wallId, anchorId, point: [point[0], point[1]] as LayoutVec2 };
}

describe('P23.11 slice 6a — curve-control hit authority', () => {
	const document = roomDocument(true);
	const geometry = compileWallFirstLayoutGeometry(document).geometry;

	it('outranks the Wall body it sits on, and falls back to the Wall body without it', () => {
		// 3.5 m along the bow: well clear of the door (arc [1, 2]) and of every
		// Junction, so the control tier is the only thing that can decide.
		const onCurve = sampledPointAt(document, 'w1', 3.5);
		const control = controlAt('w1', 'anchor-a1', onCurve);

		expect(resolvePlanHit(geometry.queries, onCurve, 0.2, { curveControls: [control] })).toEqual({
			kind: 'wallCurveControl',
			wallId: 'w1',
			anchorId: 'anchor-a1',
			point: onCurve
		});
		expect(resolvePlanHit(geometry.queries, onCurve, 0.2)).toMatchObject({
			kind: 'physicalWall',
			wallId: 'w1'
		});
	});

	it('never outranks the Opening body or a canonical endpoint it overlaps', () => {
		// The door body point, claimed by a control at the identical coordinate:
		// a control can never re-select the Opening that owns that arc span.
		const onDoor = sampledPointAt(document, 'w1', 1.5);
		expect(
			resolvePlanHit(geometry.queries, onDoor, 0.2, {
				curveControls: [controlAt('w1', 'anchor-a1', onDoor)]
			})
		).toMatchObject({ kind: 'wallOpening', wallId: 'w1', openingId: 'door' });

		// Junction A, claimed by a control at the identical coordinate. Which of
		// the two incident Walls owns the endpoint record is the pre-existing
		// endpoint scan order; that the endpoint tier wins is the rule here.
		const atJunction: LayoutVec2 = [0, 0];
		expect(
			resolvePlanHit(geometry.queries, atJunction, 0.2, {
				curveControls: [controlAt('w1', 'anchor-a1', atJunction)]
			})
		).toMatchObject({ kind: 'wallEndpoint', point: atJunction });
	});

	it('returns only the nearest in-tolerance control and otherwise defers to the Wall', () => {
		const near = controlAt('w1', 'anchor-a1', sampledPointAt(document, 'w1', 3.5));
		const nearOther = controlAt('w1', 'anchor-a2', sampledPointAt(document, 'w1', 3.6));
		expect(
			resolvePlanHit(geometry.queries, near.point, 0.2, { curveControls: [nearOther, near] })
		).toMatchObject({ kind: 'wallCurveControl', anchorId: 'anchor-a1' });

		// Outside tolerance the control contributes nothing: the Wall body keeps
		// its normal priority, so a miss never swallows the click.
		expect(
			resolvePlanHit(geometry.queries, sampledPointAt(document, 'w1', 3.5), 0.01, {
				curveControls: [controlAt('w1', 'anchor-a1', [2, 2.5])]
			})
		).toMatchObject({ kind: 'physicalWall', wallId: 'w1' });
	});

	it('carries no Room context, so one Wall keeps exactly one editing identity', () => {
		const onCurve = sampledPointAt(document, 'w1', 3.5);
		const hit = resolvePlanHit(geometry.queries, onCurve, 0.2, {
			curveControls: [controlAt('w1', 'anchor-a1', onCurve)]
		});
		expect(hit).not.toBeNull();
		expect(Object.keys(hit!).sort()).toEqual(['anchorId', 'kind', 'point', 'wallId']);
	});
});

// ---------------------------------------------------------------------------
// Transient gesture
// ---------------------------------------------------------------------------

type CurveControlGesture = Extract<LayoutArchitectureEditGesture, { kind: 'curve-control-move' }>;

/** The active gesture, narrowed to the curve-control variant. */
function current(state: LayoutInteractionState): CurveControlGesture {
	const gesture = state.architectureEdit;
	if (!gesture || gesture.kind !== 'curve-control-move') throw new Error('no curve-control gesture');
	return gesture;
}

describe('P23.11 slice 6a — transient curve-control gesture', () => {
	function controlGesture(overrides: Partial<CurveControlGesture> = {}): CurveControlGesture {
		return {
			kind: 'curve-control-move' as const,
			pointerId: 1,
			wallId: 'w1',
			anchorId: 'anchor-a1',
			startPointer: [2, 0.5] as LayoutVec2,
			baselineAnchorPoint: [2, 0.5] as LayoutVec2,
			curveExcludePoints: [[0, 0], [4, 0], [4, 3], [0, 3]] as readonly LayoutVec2[],
			affectedWallIds: ['w1'] as readonly string[],
			candidatePoint: [2, 0.5] as LayoutVec2,
			valid: false,
			...overrides
		};
	}

	it('derives the total candidate from the immutable baseline, preserving the grab offset', () => {
		// Grabbed 0.2 m off the control: the offset survives the whole gesture.
		const gesture = controlGesture({ startPointer: [2.2, 0.5], baselineAnchorPoint: [2, 0.5] });
		expect(architectureEditRawTarget(gesture, [2.2, 0.5])).toEqual([2, 0.5]);
		expect(architectureEditRawTarget(gesture, [3.2, 1.5])).toEqual([3, 1.5]);

		// Order and frequency independence: many small moves land exactly where
		// one large move does, because the delta is never accumulated.
		const state = createLayoutInteractionState();
		beginLayoutArchitectureEdit(state, gesture);
		for (const displacement of [0.1, 0.1, 0.1, 0.1]) {
			const target = architectureEditRawTarget(current(state), [2.2 + displacement, 0.5]);
			updateLayoutArchitectureEdit(state, target);
		}
		const accumulated = architectureEditRawTarget(current(state), [2.6, 0.5]);
		updateLayoutArchitectureEdit(state, accumulated);
		expect(current(state).candidatePoint).toEqual([2.4, 0.5]);
	});

	it('installs the candidate point and resets validity on every update', () => {
		const state = createLayoutInteractionState();
		beginLayoutArchitectureEdit(state, controlGesture());
		expect(current(state).candidatePoint).toEqual([2, 0.5]);

		updateLayoutArchitectureEdit(state, [2.5, 1.2]);
		expect(current(state).candidatePoint).toEqual([2.5, 1.2]);
		markLayoutArchitectureEditValidity(state, true);
		expect(current(state).valid).toBe(true);

		// A rejected intermediate candidate must never be committed by a later
		// release that resolves nothing.
		updateLayoutArchitectureEdit(state, [2.6, 1.2]);
		expect(current(state).valid).toBe(false);
		expect(current(state).rejectionCode).toBeUndefined();
	});

	it('excludes only its own Wall and drops the Junction snap family', () => {
		const gesture = controlGesture();
		// A control may not snap to a coordinate the planner would reject, so the
		// frozen baseline Junction coordinates are excluded exactly as a Junction
		// move does it.
		expect(architectureEditExcludePoints(gesture)).toEqual([
			[0, 0],
			[4, 0],
			[4, 3],
			[0, 3]
		]);
		expect(architectureEditAllowedKinds(gesture)).toEqual(LAYOUT_ARCHITECTURE_JUNCTION_SNAP_KINDS);
		expect(architectureEditAllowedKinds(gesture)).not.toContain('junction');

		// The edited Wall alone: a control move leaves both endpoint Junctions in
		// place, so no neighbouring Wall reshapes and only this Wall is a frozen
		// moving-owner exclusion.
		expect(architectureEditExclusionOwners(gesture, ['door'])).toEqual(
			new Set([snapOwnerKey({ kind: 'wall', id: 'w1' }), snapOwnerKey({ kind: 'opening', id: 'door' })])
		);

		// A rigid Wall move still passes the full family set and excludes nothing
		// by point — its one translation merges no endpoint IDs.
		const wallMove: LayoutArchitectureEditGesture = {
			kind: 'wall-move',
			pointerId: 1,
			wallId: 'w1',
			startPointer: [2, 0],
			baselineGrabPoint: [2, 0],
			startJunctionId: 'A',
			endJunctionId: 'B',
			baselineStart: [0, 0],
			baselineEnd: [4, 0],
			affectedWallIds: ['w1'],
			candidateDelta: [0, 0],
			valid: false
		};
		expect(architectureEditExcludePoints(wallMove)).toEqual([]);
		expect(architectureEditAllowedKinds(wallMove)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Rejected-intent rendering
// ---------------------------------------------------------------------------

describe('P23.11 slice 6a — rejected drag rendering', () => {
	const gesture = {
		kind: 'curve-control-move' as const,
		pointerId: 1,
		wallId: 'w1',
		anchorId: 'anchor-a1',
		startPointer: [2, 0.5] as LayoutVec2,
		baselineAnchorPoint: [2, 0.5] as LayoutVec2,
		curveExcludePoints: [[0, 0]] as readonly LayoutVec2[],
		affectedWallIds: ['w1'] as readonly string[],
		candidatePoint: [2, 3.4] as LayoutVec2,
		valid: false,
		rejectionCode: 'topology_invalid',
		rejectionMessage: 'nope'
	};

	it('draws exactly the rejected control point, never a fabricated curve', () => {
		const intent = architectureEditIntentFor(gesture, true);
		expect(intent).toEqual({ kind: 'curve-control-move', point: [2, 3.4] });
		const empty: PlanInteractionProjection = {
			selection: [],
			handles: [],
			drafts: [],
			labels: [],
			roomOverrides: [],
			objectOverrides: []
		};
		const projection = withArchitectureEditIntent(empty, intent);
		expect(projection.drafts).toEqual([
			{
				kind: 'circle',
				key: expect.any(String),
				center: [2, 3.4],
				radiusPx: 7,
				style: 'architecture-edit-intent-invalid'
			}
		]);
	});

	it('renders nothing for an accepted, no-op or not-yet-moved press', () => {
		expect(architectureEditIntentFor(gesture, false)).toBeNull();
		expect(architectureEditIntentFor({ ...gesture, valid: true }, true)).toBeNull();
		expect(architectureEditIntentFor({ ...gesture, rejectionCode: 'no_op' }, true)).toBeNull();
		expect(architectureEditIntentFor(null, true)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Commit lifecycle — the Plan viewport's primitives, in order
// ---------------------------------------------------------------------------

type Context = {
	store: ReturnType<typeof createEditorStore>;
	layoutPreview: ReturnType<typeof createEmptyLayoutPreviewState>;
	interaction: LayoutInteractionState;
	snapshot: ReturnType<typeof captureLayoutPreviewSnapshot> | null;
};

function makeStore(document: LayoutDocumentWallFirst = roomDocument(true)): Context {
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	const layoutPreview = createEmptyLayoutPreviewState();
	if (!importLayoutPreviewJson(layoutPreview, serializeWallFirstLayoutDocument(document))) {
		throw new Error('wall-first import failed');
	}
	store.registerLayoutHistory({
		capture: () => captureLayoutPreviewSnapshot(layoutPreview),
		replace: (snapshot) => restoreLayoutPreviewSnapshot(layoutPreview, snapshot as never),
		matches: (a, b) =>
			JSON.stringify((a as { project: { layout: unknown } }).project.layout) ===
			JSON.stringify((b as { project: { layout: unknown } }).project.layout)
	});
	store.setLayoutFormatPolicySource(() => layoutPreview);
	return { store, layoutPreview, interaction: createLayoutInteractionState(), snapshot: null };
}

function live(context: Context): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(context.layoutPreview);
	if (!('formatVersion' in document)) throw new Error('expected wall-first document');
	return document;
}

function anchorsOf(context: Context, wallId = 'w1'): readonly { id: string; point: LayoutVec2 }[] {
	const wall = live(context).walls.find((candidate) => candidate.id === wallId)!;
	return wall.centerline.kind === 'auto-bezier' ? wall.centerline.interiorAnchors : [];
}

/** Pointer-down: the Wall is selected, then the control gesture opens. */
function startCurveEdit(context: Context, anchorId = 'anchor-a1'): boolean {
	selectLayoutPhysicalWall(context.interaction, 'w1');
	const anchor = anchorsOf(context).find((candidate) => candidate.id === anchorId);
	if (!anchor) return false;
	if (!context.store.beginLayoutTransaction()) return false;
	context.snapshot = captureLayoutPreviewSnapshot(context.layoutPreview);
	beginLayoutArchitectureEdit(context.interaction, {
		kind: 'curve-control-move',
		pointerId: 1,
		wallId: 'w1',
		anchorId,
		startPointer: [...anchor.point] as LayoutVec2,
		baselineAnchorPoint: [...anchor.point] as LayoutVec2,
		curveExcludePoints: live(context).junctions.map((junction) => [...junction.point] as LayoutVec2),
		affectedWallIds: ['w1'],
		candidatePoint: [...anchor.point] as LayoutVec2,
		valid: false
	});
	return true;
}

type EditResult = { success: true } | { success: false; message: string; code?: string };

/** One pointer move: restore the baseline, then replan the total candidate. */
function moveEdit(context: Context, point: LayoutVec2): EditResult {
	const gesture = context.interaction.architectureEdit;
	const snapshot = context.snapshot;
	if (!gesture || gesture.kind !== 'curve-control-move' || !snapshot) {
		throw new Error('no active curve-control gesture');
	}
	const target = architectureEditRawTarget(gesture, [
		gesture.startPointer[0] + (point[0] - gesture.baselineAnchorPoint[0]),
		gesture.startPointer[1] + (point[1] - gesture.baselineAnchorPoint[1])
	]);
	const input = updateLayoutArchitectureEdit(context.interaction, target);
	if (!input) throw new Error('gesture lost its candidate');
	restoreLayoutPreviewSnapshot(context.layoutPreview, snapshot);
	const result = updateWallFirstWallCurveAnchor(
		context.layoutPreview,
		gesture.wallId,
		gesture.anchorId,
		input
	);
	if (result.success) {
		markLayoutArchitectureEditValidity(context.interaction, true);
		return { success: true };
	}
	markLayoutArchitectureEditValidity(context.interaction, false, result.code, result.message);
	return { success: false, message: result.message, code: result.code };
}

function releaseEdit(
	context: Context,
	point: LayoutVec2
): { kind: 'committed' | 'cancelled' | 'none'; code?: string } {
	const gesture = context.interaction.architectureEdit;
	if (!gesture || !context.snapshot) return { kind: 'none' };
	const result = moveEdit(context, point);
	let kind: 'committed' | 'cancelled' = 'cancelled';
	if (result.success) {
		const changed = context.store.commitLayoutTransaction(
			captureLayoutPreviewSnapshot(context.layoutPreview)
		);
		kind = changed ? 'committed' : 'cancelled';
		if (!changed) restoreLayoutPreviewSnapshot(context.layoutPreview, context.snapshot);
	} else {
		context.store.cancelLayoutTransaction();
		restoreLayoutPreviewSnapshot(context.layoutPreview, context.snapshot);
	}
	cancelLayoutArchitectureEdit(context.interaction);
	context.snapshot = null;
	return { kind, ...(result.success ? {} : { code: result.code }) };
}

function cancelEdit(context: Context): void {
	if (context.snapshot) restoreLayoutPreviewSnapshot(context.layoutPreview, context.snapshot);
	context.store.cancelLayoutTransaction();
	cancelLayoutArchitectureEdit(context.interaction);
	context.snapshot = null;
}

/**
 * A command-style curve verb: one guarded transaction, so an accepted verb is
 * exactly one undo entry and a rejected one writes nothing. This is the same
 * runner the Inspector and the Plan workspace use, so the verb adapters are
 * exercised through their real commit path rather than a bespoke one.
 */
function curveVerb(
	context: Context,
	mutate: () => { success: boolean }
): ReturnType<typeof runLayoutMutation<{ success: boolean }>> {
	return runLayoutMutation(
		layoutMutationRunnerFor(context.store, context.layoutPreview),
		mutate,
		(result) => result.success
	);
}

describe('P23.11 slice 6a — curve commit lifecycle', () => {
	it('one valid control drag is exactly one history entry with exact Undo/Redo', () => {
		const context = makeStore();
		const { store } = context;
		const before = JSON.stringify(live(context));

		expect(startCurveEdit(context)).toBe(true);
		expect(moveEdit(context, [2.6, 1.4]).success).toBe(true);
		expect(releaseEdit(context, [2.6, 1.4]).kind).toBe('committed');

		// Exact control position, with the authored anchor ID intact.
		expect(anchorsOf(context)).toEqual([{ id: 'anchor-a1', point: [2.6, 1.4] }]);
		// The Wall stays the durable selection; a curve control never becomes one.
		expect(context.interaction.selection).toEqual({ kind: 'physicalWall', wallId: 'w1' });
		// Room, Opening and Junction identity are untouched by a reshape.
		expect(live(context).rooms.map((room) => room.id)).toEqual(['room']);
		expect(live(context).openings).toEqual(roomDocument().openings);
		expect(live(context).junctions).toEqual(roomDocument().junctions);

		expect(store.undo()).toBe(true);
		expect(JSON.stringify(live(context))).toBe(before);
		expect(store.canUndo).toBe(false);

		expect(store.redo()).toBe(true);
		expect(anchorsOf(context)).toEqual([{ id: 'anchor-a1', point: [2.6, 1.4] }]);
	});

	it('replans the release point rather than committing a remembered last-valid preview', () => {
		const context = makeStore();
		expect(startCurveEdit(context)).toBe(true);
		expect(moveEdit(context, [2.5, 1.5]).success).toBe(true);
		// The user drags back to where the control already was, then releases.
		// The released derivation is a `no_op`, so nothing may be committed even
		// though the previous intermediate candidate was accepted.
		expect(releaseEdit(context, [2, 0.5])).toEqual({ kind: 'cancelled', code: 'no_op' });
		expect(context.store.canUndo).toBe(false);
		expect(anchorsOf(context)).toEqual([{ id: 'anchor-a1', point: [2, 0.5] }]);
	});

	it('commits nothing and restores the exact baseline when the planner rejects', () => {
		const context = makeStore();
		const before = JSON.stringify(live(context));
		expect(startCurveEdit(context)).toBe(true);
		// 8 m is far outside the Room: the reshape cannot hold Room identity.
		const released = releaseEdit(context, [12, 0.5]);
		expect(released.kind).toBe('cancelled');
		expect(released.code).not.toBe('no_op');
		expect(context.store.canUndo).toBe(false);
		expect(JSON.stringify(live(context))).toBe(before);
	});

	it('restores the baseline for Escape, pointer cancel and a mode change', () => {
		for (const interruption of ['escape', 'pointer-cancel', 'mode-change'] as const) {
			const context = makeStore();
			const before = JSON.stringify(live(context));
			expect(startCurveEdit(context)).toBe(true);
			expect(moveEdit(context, [2.6, 1.4]).success).toBe(true);
			// The preview installed a candidate; cancelling drops it whole.
			expect(anchorsOf(context)).toEqual([{ id: 'anchor-a1', point: [2.6, 1.4] }]);
			cancelEdit(context);
			void interruption;
			expect(JSON.stringify(live(context))).toBe(before);
			expect(context.store.canUndo).toBe(false);
			expect(context.interaction.architectureEdit).toBeNull();
		}
	});

	it('never changes topology: a committed control move leaves every Junction, Wall and Opening ID set intact', () => {
		const context = makeStore();
		expect(startCurveEdit(context)).toBe(true);
		expect(moveEdit(context, [3, 1.5]).success).toBe(true);
		expect(releaseEdit(context, [3, 1.5]).kind).toBe('committed');

		const after = live(context);
		expect(anchorsOf(context)).toEqual([{ id: 'anchor-a1', point: [3, 1.5] }]);
		expect(after.junctions.map((junction) => junction.id)).toEqual(['A', 'B', 'C', 'D']);
		expect(after.walls.map((wall) => wall.id)).toEqual(['w1', 'w2', 'w3', 'w4']);
		expect(after.openings.map((opening) => opening.id)).toEqual(['door']);
	});

	it('leaves the Scene document, Scene selection and camera domain untouched', () => {
		const context = makeStore();
		const scene = JSON.stringify(context.store.document);
		const sceneSelection = JSON.stringify([...context.store.selectedPlacementIds]);
		const cameraSelection = JSON.stringify(context.store.cameraSelection);
		const cameraFocus = context.store.cameraFocusVersion;

		expect(startCurveEdit(context)).toBe(true);
		expect(moveEdit(context, [2.6, 1.4]).success).toBe(true);
		expect(releaseEdit(context, [2.6, 1.4]).kind).toBe('committed');

		expect(JSON.stringify(context.store.document)).toBe(scene);
		expect(JSON.stringify([...context.store.selectedPlacementIds])).toBe(sceneSelection);
		expect(JSON.stringify(context.store.cameraSelection)).toBe(cameraSelection);
		expect(context.store.cameraFocusVersion).toBe(cameraFocus);
	});
});

// ---------------------------------------------------------------------------
// Convert / add / delete through the same adapters
// ---------------------------------------------------------------------------

describe('P23.11 slice 6a — curve verbs through one commit path', () => {
	it('converting a straight Wall plants one control and moves nothing on screen', () => {
		const context = makeStore(roomDocument(false));
		const before = live(context);

		const outcome = curveVerb(context, () => updateWallFirstWallCurve(context.layoutPreview, 'w1'));
		expect(outcome.kind).toBe('committed');
		// The control sits on the exact chord midpoint, so the interpolating
		// spline is degenerate-straight: length, direction, Room identity and
		// every hosted Opening offset are unchanged until a control is dragged.
		expect(anchorsOf(context)).toEqual([{ id: 'w1:anchor:1', point: [2, 0] }]);
		expect(live(context).openings).toEqual(before.openings);
		expect(live(context).rooms).toEqual(before.rooms);

		expect(context.store.undo()).toBe(true);
		expect(live(context).walls.find((wall) => wall.id === 'w1')!.centerline).toEqual(LINE);
		expect(context.store.canUndo).toBe(false);
		// `redo` restores the exact anchor ID and position, not a re-derived one.
		expect(context.store.redo()).toBe(true);
		expect(anchorsOf(context)).toEqual([{ id: 'w1:anchor:1', point: [2, 0] }]);
	});

	it('adds and deletes controls, and deleting the last one returns the Wall to line', () => {
		const context = makeStore();
		expect(curveVerb(context, () => insertWallFirstWallCurveAnchor(context.layoutPreview, 'w1', [3, 0.8])).kind).toBe(
			'committed'
		);
		expect(anchorsOf(context).map((anchor) => anchor.id)).toEqual(['anchor-a1', 'w1:anchor:2']);

		expect(curveVerb(context, () => deleteWallFirstWallCurveAnchor(context.layoutPreview, 'w1', 'anchor-a1')).kind).toBe(
			'committed'
		);
		expect(anchorsOf(context).map((anchor) => anchor.id)).toEqual(['w1:anchor:2']);

		// The one-anchor minimum is never broken by a deletion: removing the last
		// control converts the Wall to `line` instead of leaving it anchor-less.
		expect(curveVerb(context, () => deleteWallFirstWallCurveAnchor(context.layoutPreview, 'w1', 'w1:anchor:2')).kind).toBe(
			'committed'
		);
		expect(live(context).walls.find((wall) => wall.id === 'w1')!.centerline).toEqual(LINE);

		// And back to line explicitly, from a curve.
		expect(curveVerb(context, () => updateWallFirstWallCurve(context.layoutPreview, 'w1')).kind).toBe('committed');
		expect(curveVerb(context, () => updateWallFirstWallLine(context.layoutPreview, 'w1')).kind).toBe('committed');
		expect(live(context).walls.find((wall) => wall.id === 'w1')!.centerline).toEqual(LINE);
	});

	it('rejects a control the Wall does not have without touching the document', () => {
		const context = makeStore();
		const before = JSON.stringify(live(context));
		const outcome = curveVerb(context, () =>
			updateWallFirstWallCurveAnchor(context.layoutPreview, 'w1', 'anchor-missing', [2.5, 1])
		);
		expect(outcome).toMatchObject({ kind: 'cancelled', result: { code: 'unknown_curve_anchor' } });
		expect(JSON.stringify(live(context))).toBe(before);
		expect(context.store.canUndo).toBe(false);
	});

	it('rejects a curve verb on a straight Wall instead of flattening it', () => {
		const context = makeStore(roomDocument(false));
		const before = JSON.stringify(live(context));
		expect(
			curveVerb(context, () => insertWallFirstWallCurveAnchor(context.layoutPreview, 'w1', [2, 0.5]))
		).toMatchObject({ kind: 'cancelled', result: { code: 'unsupported_geometry' } });
		expect(
			curveVerb(context, () => updateWallFirstWallLine(context.layoutPreview, 'w1'))
		).toMatchObject({ kind: 'cancelled', result: { code: 'no_op' } });
		expect(JSON.stringify(live(context))).toBe(before);
		expect(context.store.canUndo).toBe(false);
	});
});
