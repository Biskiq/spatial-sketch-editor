/**
 * Legacy interior-anchor drag — release correctness (P23.2 gesture path).
 *
 * The Plan viewport resolved this gesture as: `pointerdown` captures a
 * snapshot, `pointermove` calls `updateLayoutWallInteriorAnchor()`, and
 * `pointerup` committed the transaction UNCONDITIONALLY — without ever
 * consuming the release coordinate and without any failure path. So a release
 * that landed somewhere else committed whatever the last `pointermove` had
 * previewed, and a release the legacy planner rejected was committed anyway.
 *
 * Two contracts are pinned here:
 *
 * 1. **Release semantics** (real state + real history controller): the release
 *    re-runs the same resolver, so the committed document is the one derived
 *    from the release coordinate; a rejected release restores the exact
 *    pointer-down baseline with zero history; a valid drag writes exactly one
 *    entry.
 * 2. **Viewport wiring** (source contract): this suite runs in a `node`
 *    environment (`vitest.config.ts`) with no DOM and no component-mount
 *    harness, so the pointer-lifecycle wiring is asserted against the component
 *    source — the same convention the P23.10 gesture suite uses. The one thing
 *    that makes the fix structural is here: there is exactly ONE
 *    `updateLayoutWallInteriorAnchor()` call site, shared by `pointermove` and
 *    `pointerup` (no second planner, no re-implementation).
 *
 * Scope: `interiorAnchorPointerId` / `draggedInteriorAnchor` only. This gesture
 * is legacy-only by construction (see the reachability suite below): the
 * interior-anchor hit exists only while the compiler emits `interior-anchor`
 * query points, which it does solely for an `auto-bezier` room-boundary
 * segment, and the mutation itself refuses wall-first documents.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { chopinProject, chopinRuntime, sceneDocument } from '$lib/content/chopin-project';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { serializeWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import {
	captureLayoutPreviewSnapshot,
	commitLayoutPathRoom,
	createLayoutPreviewState,
	importLayoutPreviewJson,
	layoutPreviewCanonicalJson,
	resetLayoutPreview,
	restoreLayoutPreviewSnapshot,
	updateLayoutWallInteriorAnchor
} from '$lib/editor/layout/layout-preview-state.svelte';
import {
	LAYOUT_PLAN_GRID_STEP,
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	resolveLayoutSnap,
	wallCubicChain,
	wallCenterlineSegment,
	wallOwnerKey,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
import {
	LAYOUT_WALL_BEND_DRAG_THRESHOLD_PX,
	shouldBeginWallBend
} from '$lib/editor/layout/layout-interaction';
import { LAYOUT_PLAN_HIT_RADIUS_PX } from '$lib/editor/layout/layout-opening-editing';
import {
	createPlanViewportState,
	planScreenToWorld
} from '$lib/editor/layout/layout-plan-transform';

const ANCHOR_BASELINE: LayoutVec2 = [2, -1];

/** The real plan viewport state (snap on, real scale): the release pipeline's input. */
const PLAN_VIEW = createPlanViewportState();

/**
 * The canvas screen position of a world point — the inverse of the viewport's
 * `worldPoint()` conversion (`planScreenToWorld`), so a screen displacement here
 * is the same displacement a real pointer would produce.
 */
function screenPointOf(world: LayoutVec2): LayoutVec2 {
	const { center, width, height, pixelsPerMeter } = PLAN_VIEW;
	return [
		(world[0] - center[0]) * pixelsPerMeter + width / 2,
		(world[1] - center[1]) * pixelsPerMeter + height / 2
	];
}

/** The legacy curved room both suites target: one `auto-bezier` boundary segment. */
const LEGACY_SEGMENTS = [
	{
		id: 'curve-a',
		kind: 'auto-bezier' as const,
		start: [0, 0] as LayoutVec2,
		end: [4, 0] as LayoutVec2,
		interiorAnchors: [{ id: 'curve-a:anchor:1', point: [...ANCHOR_BASELINE] as LayoutVec2 }]
	},
	{ id: 'curve-b', kind: 'line' as const, start: [4, 0] as LayoutVec2, end: [4, 4] as LayoutVec2 },
	{ id: 'curve-c', kind: 'line' as const, start: [4, 4] as LayoutVec2, end: [0, 4] as LayoutVec2 },
	{ id: 'curve-d', kind: 'line' as const, start: [0, 4] as LayoutVec2, end: [0, 0] as LayoutVec2 }
];

type Target = { roomId: string; segmentId: string; anchorId: string };

/** A legacy preview holding one curved Room, resolved ids read back from state. */
function legacyCurvedState() {
	const state = createLayoutPreviewState(chopinProject.layout, sceneDocument);
	resetLayoutPreview(state);
	const created = commitLayoutPathRoom(state, LEGACY_SEGMENTS);
	if (!created.success) throw new Error('legacy curved-room fixture failed');
	const room = state.project.layout.floors[0]!.rooms.find(
		(candidate) => candidate.id === created.roomId
	)!;
	const segment = room.boundary.segments.find((candidate) => candidate.kind === 'auto-bezier')!;
	if (segment.kind !== 'auto-bezier') throw new Error('fixture segment is not curved');
	const target: Target = {
		roomId: room.id,
		segmentId: segment.id,
		anchorId: segment.interiorAnchors[0]!.id
	};
	return { state, target };
}

/** The anchor's authored point in the live document. */
function anchorPoint(state: ReturnType<typeof legacyCurvedState>['state'], target: Target): LayoutVec2 {
	const room = state.project.layout.floors[0]!.rooms.find(
		(candidate) => candidate.id === target.roomId
	)!;
	const segment = room.boundary.segments.find((candidate) => candidate.id === target.segmentId)!;
	if (segment.kind !== 'auto-bezier') throw new Error('segment is no longer curved');
	return [...segment.interiorAnchors.find((anchor) => anchor.id === target.anchorId)!.point] as LayoutVec2;
}

/**
 * The viewport's RELEASE snap, called exactly as `applyLayoutSnap()` calls it: the
 * compiled geometry, the real scale and grid step, the moving anchor's own
 * room-qualified segment excluded, and the anchor's own point excluded. The grid
 * fallback is unconditional, which is why an unguarded release could nudge an
 * off-grid anchor merely by clicking it.
 */
function snapRelease(
	state: ReturnType<typeof legacyCurvedState>['state'],
	target: Target,
	raw: LayoutVec2
): LayoutVec2 {
	const resolution = resolveLayoutSnap(
		state.geometry,
		raw,
		{ pixelsPerMeter: PLAN_VIEW.pixelsPerMeter, gridStep: LAYOUT_PLAN_GRID_STEP },
		{
			excludeOwners: new Set([wallOwnerKey(state.geometry, target.roomId, target.segmentId)]),
			excludePoints: [anchorPoint(state, target)]
		}
	);
	return resolution.kind === 'snap' ? ([...resolution.candidate.point] as LayoutVec2) : raw;
}

/** Legacy preview + a store wired to it exactly as `EditorApp` wires the host. */
function makeLegacyStore() {	// The Scene document references the Chopin fixture's Rooms, so the runtime
	// registry must be the fixture's own.
	const store = createEditorStore({
		document: sceneDocument,
		rooms: chopinRuntime.rooms
	});
	const { state, target } = legacyCurvedState();
	store.registerLayoutHistory({
		capture: () => captureLayoutPreviewSnapshot(state),
		replace: (snapshot) =>
			restoreLayoutPreviewSnapshot(
				state,
				snapshot as ReturnType<typeof captureLayoutPreviewSnapshot>
			),
		matches: (a, b) =>
			JSON.stringify((a as { project: { layout: unknown } }).project.layout) ===
			JSON.stringify((b as { project: { layout: unknown } }).project.layout)
	});
	return { store, state, target };
}

/** A closed 6×4 canonical enclosure whose `wall-a` is a bowed (cubic) Wall. */
function curvedEnclosure(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions = [
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-b', point: [6, 0] },
		{ id: 'j-c', point: [6, 4] },
		{ id: 'j-d', point: [0, 4] }
	];
	const straight = { kind: 'line' } as const;
	document.walls = [
		{
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: wallCubicChain(
				[{ id: 'wall-a:knot:1', point: [3, 2] }],
				deriveChainSpans([
					[0, 0],
					[3, 2],
					[6, 0]
				])
			)
		},
		{
			id: 'wall-b',
			startJunctionId: 'j-b',
			endJunctionId: 'j-c',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: straight
		},
		{
			id: 'wall-c',
			startJunctionId: 'j-c',
			endJunctionId: 'j-d',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: straight
		},
		{
			id: 'wall-d',
			startJunctionId: 'j-d',
			endJunctionId: 'j-a',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: straight
		}
	];		document.rooms = [
			{
				id: 'room-a',
				name: 'Room A',
				boundary: [
				{ wallId: 'wall-a', direction: 'forward' },
				{ wallId: 'wall-b', direction: 'forward' },
				{ wallId: 'wall-c', direction: 'forward' },
				{ wallId: 'wall-d', direction: 'forward' }
			],
			floorThickness: 0.1,
			ceilingThickness: 0.1
		}
	];
	document.openings = [];
	return document;
}

function interiorAnchorPoints(document: LayoutDocumentWallFirst) {
	return compileWallFirstLayoutGeometry(document).geometry.queries.points.filter(
		(point) => point.kind === 'interior-anchor'
	);
}

// ---------------------------------------------------------------------------
// Legacy scope — the gesture cannot reach a canonical curved Wall
// ---------------------------------------------------------------------------

describe('legacy interior-anchor scope', () => {
	it('compiles a canonical curved Wall to a cubic-chain segment, never auto-bezier', () => {
		const document = curvedEnclosure();
		const wall = document.walls.find((candidate) => candidate.id === 'wall-a')!;
		const start = document.junctions.find((junction) => junction.id === wall.startJunctionId)!.point;
		const end = document.junctions.find((junction) => junction.id === wall.endJunctionId)!.point;

		// The centerline adapter is the only segment source for canonical Walls.
		expect(wallCenterlineSegment(wall, start, end, 'forward').kind).toBe('cubic-chain');
	});

	it('emits no interior-anchor query point for a canonical curved Wall, so no hit or handle can exist', () => {
		const document = curvedEnclosure();
		const { geometry } = compileWallFirstLayoutGeometry(document);

		// The Room really did compile through the curved Wall — the absence below
		// is not an empty-fixture artifact.
		expect(geometry.rooms).toHaveLength(1);
		expect(interiorAnchorPoints(document)).toEqual([]);
		// No room-scoped point either: the plan hit and the Plan overlay handle
		// both require `record.roomId !== undefined`.
		expect(geometry.queries.points.filter((point) => point.roomId !== undefined)).toEqual([]);
	});

	it('does emit an interior-anchor query point for a legacy auto-bezier segment (non-vacuous)', () => {
		const { state, target } = legacyCurvedState();
		const points = state.geometry.queries.points.filter(
			(point) => point.kind === 'interior-anchor'
		);
		expect(points).toHaveLength(1);
		expect(points[0]).toMatchObject({
			roomId: target.roomId,
			segmentId: target.segmentId,
			sourceId: target.anchorId
		});
	});

	it('refuses a wall-first document through the legacy mutation itself', () => {
		const document = curvedEnclosure();
		const state = createLayoutPreviewState(chopinProject.layout, sceneDocument);
		resetLayoutPreview(state);
		expect(importLayoutPreviewJson(state, serializeWallFirstLayoutDocument(document))).toBe(true);
		const before = layoutPreviewCanonicalJson(state);

		// The curved Wall plus its curve knot are offered as the legacy target;
		// the canonical pair can never be authored through this path.
		const result = updateLayoutWallInteriorAnchor(state, 'room-a', 'wall-a', 'wall-a:knot:1', [
			3, 3
		]);
		expect(result.success).toBe(false);
		if (!result.success) expect(result.message).toContain('wall-first layouts');
		expect(layoutPreviewCanonicalJson(state)).toBe(before);
	});
});

// ---------------------------------------------------------------------------
// Release semantics — the release coordinate decides the outcome
// ---------------------------------------------------------------------------

describe('interior-anchor release semantics', () => {
	it('commits the RELEASE coordinate when no final pointermove landed there', () => {
		const { store, state, target } = makeLegacyStore();
		const release: LayoutVec2 = [3, -2];

		expect(store.beginLayoutTransaction()).toBe(true);
		// The last `pointermove` previewed a different coordinate…
		expect(
			updateLayoutWallInteriorAnchor(state, target.roomId, target.segmentId, target.anchorId, [
				3, 1
			])
		).toEqual({ success: true });
		// …and the release re-runs the same resolver with the release coordinate.
		expect(
			updateLayoutWallInteriorAnchor(
				state,
				target.roomId,
				target.segmentId,
				target.anchorId,
				release
			)
		).toEqual({ success: true });
		expect(store.commitLayoutTransaction(captureLayoutPreviewSnapshot(state))).toBe(true);

		expect(anchorPoint(state, target)).toEqual(release);
		// One entry, and it carries the release coordinate, not the preview.
		expect(store.canUndo).toBe(true);
		expect(store.undo()).toBe(true);
		expect(anchorPoint(state, target)).toEqual(ANCHOR_BASELINE);
		expect(store.canUndo).toBe(false);
	});

	it('a rejected release restores the exact baseline and writes no history', () => {
		const { store, state, target } = makeLegacyStore();
		const baselineJson = layoutPreviewCanonicalJson(state);

		expect(store.beginLayoutTransaction()).toBe(true);
		const snapshot = captureLayoutPreviewSnapshot(state);
		// A valid preview landed first: the rejected release must supersede it,
		// not preserve it.
		expect(
			updateLayoutWallInteriorAnchor(state, target.roomId, target.segmentId, target.anchorId, [
				3, -2
			])
		).toEqual({ success: true });

		const rejected = updateLayoutWallInteriorAnchor(
			state,
			target.roomId,
			target.segmentId,
			`${target.anchorId}:retired`,
			[3, -3]
		);
		expect(rejected.success).toBe(false);
		if (!rejected.success) expect(rejected.message).toContain('no longer exists');

		// The viewport's reject path: cancel the transaction, restore the
		// pointer-down baseline, then re-apply the reason.
		expect(store.cancelLayoutTransaction()).toBe(true);
		restoreLayoutPreviewSnapshot(state, snapshot);

		expect(layoutPreviewCanonicalJson(state)).toBe(baselineJson);
		expect(anchorPoint(state, target)).toEqual(ANCHOR_BASELINE);
		expect(store.canUndo).toBe(false);
	});

	it('a rejected release on a vanished curved segment restores the baseline too', () => {
		const { store, state, target } = makeLegacyStore();
		const baselineJson = layoutPreviewCanonicalJson(state);

		expect(store.beginLayoutTransaction()).toBe(true);
		const snapshot = captureLayoutPreviewSnapshot(state);
		expect(
			updateLayoutWallInteriorAnchor(state, target.roomId, target.segmentId, target.anchorId, [
				1, -2
			])
		).toEqual({ success: true });

		const rejected = updateLayoutWallInteriorAnchor(
			state,
			target.roomId,
			'curve-gone',
			target.anchorId,
			[1, -3]
		);
		expect(rejected.success).toBe(false);
		if (!rejected.success) expect(rejected.message).toContain('Curved wall no longer exists');

		expect(store.cancelLayoutTransaction()).toBe(true);
		restoreLayoutPreviewSnapshot(state, snapshot);
		expect(layoutPreviewCanonicalJson(state)).toBe(baselineJson);
		expect(store.canUndo).toBe(false);
	});

	it('a cancelled or lost-capture gesture restores the exact baseline with no history', () => {
		const { store, state, target } = makeLegacyStore();
		const baselineJson = layoutPreviewCanonicalJson(state);

		expect(store.beginLayoutTransaction()).toBe(true);
		const snapshot = captureLayoutPreviewSnapshot(state);
		expect(
			updateLayoutWallInteriorAnchor(state, target.roomId, target.segmentId, target.anchorId, [
				3, -2
			])
		).toEqual({ success: true });
		expect(layoutPreviewCanonicalJson(state)).not.toBe(baselineJson);

		// `cancelActiveLayoutDrag()` — the one cleanup shared by Escape, pointer
		// cancel and (now) lost capture.
		restoreLayoutPreviewSnapshot(state, snapshot);
		expect(store.cancelLayoutTransaction()).toBe(true);

		expect(layoutPreviewCanonicalJson(state)).toBe(baselineJson);
		expect(anchorPoint(state, target)).toEqual(ANCHOR_BASELINE);
		expect(store.canUndo).toBe(false);
	});

	it('a valid ordinary drag writes exactly one history entry', () => {
		const { store, state, target } = makeLegacyStore();
		const baselineJson = layoutPreviewCanonicalJson(state);

		expect(store.beginLayoutTransaction()).toBe(true);
		expect(
			updateLayoutWallInteriorAnchor(state, target.roomId, target.segmentId, target.anchorId, [
				2, -2
			])
		).toEqual({ success: true });
		// One commit for the whole gesture.
		expect(store.commitLayoutTransaction(captureLayoutPreviewSnapshot(state))).toBe(true);
		expect(store.canUndo).toBe(true);

		// Exactly one entry: one undo returns the baseline and exhausts history.
		expect(store.undo()).toBe(true);
		expect(layoutPreviewCanonicalJson(state)).toBe(baselineJson);
		expect(store.canUndo).toBe(false);
		expect(store.redo()).toBe(true);
		expect(anchorPoint(state, target)).toEqual([2, -2]);
	});

	it('writes no history entry for an unchanged commit — the controller suppresses it', () => {
		const { store, state, target } = makeLegacyStore();
		const baselineJson = layoutPreviewCanonicalJson(state);

		expect(store.beginLayoutTransaction()).toBe(true);
		// The anchor re-derived at its own point is the identical value. This is a
		// CONTRACT ON THE CONTROLLER, not the gesture's gate (the gate is below):
		// `commitLayout` compares the committed snapshot against the begin-time
		// `before` and reports `changed: false` without pushing.
		expect(
			updateLayoutWallInteriorAnchor(
				state,
				target.roomId,
				target.segmentId,
				target.anchorId,
				anchorPoint(state, target)
			)
		).toEqual({ success: true });
		expect(store.commitLayoutTransaction(captureLayoutPreviewSnapshot(state))).toBe(false);
		expect(layoutPreviewCanonicalJson(state)).toBe(baselineJson);
		expect(store.canUndo).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// The click-vs-drag gate — a press is not a drag
//
// The gesture used to treat EVERY release as a drag, so a plain click could move
// the anchor: the interior-anchor *hit* has a radius (the pointer never has to be
// on the anchor's exact centre) and the release resolver snaps, with the grid as
// an unconditional fallback candidate. These tests drive the REAL pipeline —
// `planScreenToWorld` → `resolveLayoutSnap` (self-exclusion included) →
// `updateLayoutWallInteriorAnchor()` — rather than feeding the anchor's own
// coordinate, which is what the first revision of this suite did.
// ---------------------------------------------------------------------------

describe('interior-anchor release gate — real release pipeline', () => {
	it('does not treat a click beside the anchor as a drag (the raw release would move it)', () => {
		const { store, state, target } = makeLegacyStore();
		const baseline = anchorPoint(state, target);
		const baselineJson = layoutPreviewCanonicalJson(state);
		// The Band: the anchor's acquisition radius is LARGER than the drag
		// threshold, so a press inside the radius is a valid hit that is not a
		// drag — which is how the unconditional release moved anchors.
		expect(LAYOUT_PLAN_HIT_RADIUS_PX).toBeGreaterThan(LAYOUT_WALL_BEND_DRAG_THRESHOLD_PX);

		// The press: one transaction, one frozen origin, one snapshot.
		expect(store.beginLayoutTransaction()).toBe(true);
		const snapshot = captureLayoutPreviewSnapshot(state);
		const origin = screenPointOf(baseline);
		// A CLICK 3 px off the anchor's centre — a valid hit, not a drag — with no
		// `pointermove` at all, so the release IS the whole gesture.
		const releaseScreen: LayoutVec2 = [origin[0] + 3, origin[1]];
		const rawRelease = planScreenToWorld(PLAN_VIEW, releaseScreen);
		expect(shouldBeginWallBend(origin, releaseScreen)).toBe(false);
		expect(rawRelease).not.toEqual(baseline);

		// The hazard is real: with snapping off the release resolver applies the
		// raw release point, so the old unconditional release moved the anchor by
		// the full 3 px of world distance.
		const hazard = makeLegacyStore();
		expect(
			updateLayoutWallInteriorAnchor(
				hazard.state,
				target.roomId,
				target.segmentId,
				target.anchorId,
				rawRelease
			)
		).toEqual({ success: true });
		expect(anchorPoint(hazard.state, target)).toEqual(rawRelease);

		// The gate is what prevents it: below the threshold the release is a
		// click, so the viewport cancels the transaction and restores the baseline
		// instead of calling the resolver at all.
		expect(store.cancelLayoutTransaction()).toBe(true);
		restoreLayoutPreviewSnapshot(state, snapshot);

		expect(anchorPoint(state, target)).toEqual(baseline);
		expect(layoutPreviewCanonicalJson(state)).toBe(baselineJson);
		expect(store.canUndo).toBe(false);
	});

	it('does not nudge an off-grid anchor onto the grid fallback by clicking it', () => {
		const { store, state, target } = makeLegacyStore();
		// An authored anchor is rarely grid-aligned: put it off-grid first.
		expect(
			updateLayoutWallInteriorAnchor(state, target.roomId, target.segmentId, target.anchorId, [
				2.1, -1.1
			])
		).toEqual({ success: true });
		const baseline = anchorPoint(state, target);
		expect(baseline).toEqual([2.1, -1.1]);

		expect(store.beginLayoutTransaction()).toBe(true);
		const snapshot = captureLayoutPreviewSnapshot(state);
		const origin = screenPointOf(baseline);
		const releaseScreen: LayoutVec2 = [origin[0] + 3, origin[1]];
		const rawRelease = planScreenToWorld(PLAN_VIEW, releaseScreen);
		expect(shouldBeginWallBend(origin, releaseScreen)).toBe(false);

		// The grid is an unconditional fallback candidate inside the acquisition
		// radius, so the same pipeline that serves a real drag would pull the
		// off-grid anchor onto the grid — from a click that never moved.
		const snapped = snapRelease(state, target, rawRelease);
		expect(snapped).not.toEqual(baseline);
		const hazard = makeLegacyStore();
		expect(
			updateLayoutWallInteriorAnchor(hazard.state, target.roomId, target.segmentId, target.anchorId, [
				2.1, -1.1
			])
		).toEqual({ success: true });
		expect(
			updateLayoutWallInteriorAnchor(
				hazard.state,
				target.roomId,
				target.segmentId,
				target.anchorId,
				snapped
			)
		).toEqual({ success: true });
		expect(anchorPoint(hazard.state, target)).toEqual(snapped);

		// Gated: the release is a click, so the baseline stands.
		expect(store.cancelLayoutTransaction()).toBe(true);
		restoreLayoutPreviewSnapshot(state, snapshot);
		expect(anchorPoint(state, target)).toEqual(baseline);
		expect(store.canUndo).toBe(false);
	});

	it('commits the snapped release point exactly once for a real drag', () => {
		const { store, state, target } = makeLegacyStore();
		expect(store.beginLayoutTransaction()).toBe(true);

		const origin = screenPointOf(anchorPoint(state, target));
		// Beyond the shared drag threshold: a drag, so the release is authoritative.
		const releaseScreen: LayoutVec2 = [origin[0] + 12, origin[1] + 12];
		expect(shouldBeginWallBend(origin, releaseScreen)).toBe(true);

		const snapped = snapRelease(state, target, planScreenToWorld(PLAN_VIEW, releaseScreen));
		expect(snapped).not.toEqual(ANCHOR_BASELINE);
		expect(
			updateLayoutWallInteriorAnchor(
				state,
				target.roomId,
				target.segmentId,
				target.anchorId,
				snapped
			)
		).toEqual({ success: true });
		expect(store.commitLayoutTransaction(captureLayoutPreviewSnapshot(state))).toBe(true);

		expect(anchorPoint(state, target)).toEqual(snapped);
		// One entry for the whole gesture.
		expect(store.undo()).toBe(true);
		expect(anchorPoint(state, target)).toEqual(ANCHOR_BASELINE);
		expect(store.canUndo).toBe(false);
	});

	it('ends the gesture on window blur on the same baseline-restore path', () => {
		const { store, state, target } = makeLegacyStore();
		const baselineJson = layoutPreviewCanonicalJson(state);

		expect(store.beginLayoutTransaction()).toBe(true);
		const snapshot = captureLayoutPreviewSnapshot(state);
		expect(
			updateLayoutWallInteriorAnchor(state, target.roomId, target.segmentId, target.anchorId, [
				3, -2
			])
		).toEqual({ success: true });
		expect(layoutPreviewCanonicalJson(state)).not.toBe(baselineJson);

		// `onWindowBlur()` → `cancelActiveLayoutDrag()`: restore, then cancel.
		restoreLayoutPreviewSnapshot(state, snapshot);
		expect(store.cancelLayoutTransaction()).toBe(true);

		expect(layoutPreviewCanonicalJson(state)).toBe(baselineJson);
		expect(anchorPoint(state, target)).toEqual(ANCHOR_BASELINE);
		expect(store.canUndo).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Viewport wiring contract
// ---------------------------------------------------------------------------

const LIB_DIR = fileURLToPath(new URL('../../../../src/lib', import.meta.url));

function readLibSource(relativePath: string): string {
	return fs.readFileSync(path.join(LIB_DIR, relativePath), 'utf8');
}

/** Code only: comments stripped, so these contracts count CODE, not prose. */
function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('interior-anchor drag — viewport pointer-lifecycle wiring', () => {
	const viewport = readLibSource('editor/layout/LayoutPlanViewport.svelte');
	const source = stripComments(viewport);

	/** The `pointerup` branch for this gesture, bounded by the next handler branch. */
	function releaseBranch(): string {
		const start = source.indexOf('const drag = draggedInteriorAnchor;');
		expect(start).toBeGreaterThan(-1);
		const end = source.indexOf(
			'if (interaction.architectureEdit?.pointerId === event.pointerId) {',
			start
		);
		expect(end).toBeGreaterThan(start);
		return source.slice(start, end);
	}

	it('routes preview AND release through one resolver (no second planner)', () => {
		// Exactly one code call site: the shared resolver. Never a second planner
		// and never a re-implementation.
		expect(source.split('updateLayoutWallInteriorAnchor(').length - 1).toBe(1);
		expect(source).toContain('planInteriorAnchorDrag(draggedInteriorAnchor, point);');
		expect(source).toContain('planInteriorAnchorDrag(drag, point)');
		expect(source.split('planInteriorAnchorDrag(').length - 1).toBe(3);

		// Neither pointer handler may reach the mutation directly.
		const moveStart = source.indexOf(
			'interiorAnchorPointerId === event.pointerId && draggedInteriorAnchor'
		);
		const moveBranch = source.slice(moveStart, moveStart + 480);
		expect(moveBranch).toContain('planInteriorAnchorDrag(draggedInteriorAnchor, point);');
		expect(moveBranch).not.toContain('updateLayoutWallInteriorAnchor');
		expect(releaseBranch()).not.toContain('updateLayoutWallInteriorAnchor');
	});

	it('gates the press on the shared drag threshold before proposing anything', () => {
		// The gesture-agnostic rule the direct architecture edits use: below the
		// threshold the press is a plain click, so nothing is proposed.
		const moveStart = source.indexOf(
			'interiorAnchorPointerId === event.pointerId && draggedInteriorAnchor'
		);
		const moveBranch = source.slice(moveStart, moveStart + 480);
		const gate = moveBranch.indexOf(
			'shouldBeginWallBend(interiorAnchorStartScreen ?? screen, screen)'
		);
		expect(gate).toBeGreaterThan(-1);
		expect(gate).toBeLessThan(
			moveBranch.indexOf('planInteriorAnchorDrag(draggedInteriorAnchor, point);')
		);
		expect(moveBranch).toContain('return;');

		// The pointer-down origin is frozen where the anchor is acquired, and the
		// moved flag starts false on every press.
		const beginStart = source.indexOf('function beginInteriorAnchorDrag(');
		const begin = source.slice(beginStart, beginStart + 700);
		expect(begin).toContain('interiorAnchorStartScreen = screenPoint(event);');
		expect(begin).toContain('interiorAnchorMoved = false;');

		// Both halves of the drag state are cleared on every exit.
		const clearStart = source.indexOf('function clearActiveLayoutDrag()');
		const clear = source.slice(clearStart, source.indexOf('function cancelActiveLayoutDrag()'));
		expect(clear).toContain('interiorAnchorStartScreen = null;');
		expect(clear).toContain('interiorAnchorMoved = false;');
	});

	it('applies the click-vs-drag gate to the release BEFORE the resolver', () => {
		const branch = releaseBranch();

		// `moved` is the same shared-threshold rule: a `pointermove` already
		// crossed it, or the release displacement from the pointer-down origin
		// does. The release screen point is read while the gesture state is still
		// live.
		const gate = branch.indexOf('shouldBeginWallBend(startScreen, releaseScreen)');
		expect(gate).toBeGreaterThan(-1);
		expect(branch).toContain('const startScreen = interiorAnchorStartScreen;');
		expect(branch).toContain('const releaseScreen = screenPoint(event);');
		expect(branch).toContain('interiorAnchorMoved ||');

		// A click returns from the `!moved` block — cancel plus baseline restore —
		// so the resolver is unreachable for it.
		const clickReturn = branch.indexOf('if (!moved) {');
		const resolver = branch.indexOf('planInteriorAnchorDrag(drag, point)');
		expect(clickReturn).toBeGreaterThan(gate);
		expect(resolver).toBeGreaterThan(clickReturn);
		const blocked = branch.slice(clickReturn, resolver);
		expect(blocked).toContain('onLayoutTransactionCancel();');
		expect(blocked).toContain('if (snapshot) restoreLayoutPreviewSnapshot(preview, snapshot);');
	});

	it('re-derives the release coordinate BEFORE deciding the transaction outcome', () => {
		const branch = releaseBranch();

		const derive = branch.indexOf('planInteriorAnchorDrag(drag, point)');
		const outcome = branch.indexOf('applied?.success');
		const commit = branch.indexOf('onLayoutTransactionCommit()');
		expect(derive).toBeGreaterThan(-1);
		expect(outcome).toBeGreaterThan(derive);
		expect(commit).toBeGreaterThan(outcome);
	});

	it('no longer commits unconditionally', () => {
		expect(viewport).not.toContain('dragSnapshot = null;\n\t\t\tonLayoutTransactionCommit();');
	});

	it('cancels and restores the baseline when the release is rejected', () => {
		const branch = releaseBranch();

		// The reject side of the commit: the cancel that follows it is reached
		// only when the release derivation failed. (The click gate cancels BEFORE
		// the commit, which the gate test above covers.)
		const commit = branch.indexOf('onLayoutTransactionCommit()');
		const rejectCancel = branch.indexOf('onLayoutTransactionCancel();', commit);
		expect(commit).toBeGreaterThan(-1);
		expect(rejectCancel).toBeGreaterThan(commit);
		expect(branch).toContain('if (snapshot) restoreLayoutPreviewSnapshot(preview, snapshot);');
		// The rejection reason is re-applied after the restore, because both the
		// cancel and the restore replace `statusMessage`.
		expect(branch.indexOf('preview.statusMessage = applied.message')).toBeGreaterThan(
			branch.indexOf('if (snapshot) restoreLayoutPreviewSnapshot(preview, snapshot);')
		);
		// The gesture is cleared before the capture is released, so the
		// `lostpointercapture` that follows our own release cannot re-cancel.
		expect(branch.indexOf('interiorAnchorPointerId = null;')).toBeLessThan(
			branch.indexOf('releasePointerCapture(event.pointerId)')
		);
	});

	it('ends the gesture on lost pointer capture with the exact baseline', () => {
		const start = viewport.indexOf('function onLostPointerCapture(event: PointerEvent)');
		expect(start).toBeGreaterThan(-1);
		const handler = viewport.slice(start, viewport.indexOf('function onWindowBlur()'));
		expect(handler).toContain('interiorAnchorPointerId === event.pointerId');
		expect(handler).toContain('cancelActiveLayoutDrag();');
	});

	it('ends the gesture on window blur through the same cancel path', () => {
		// Blur is the browser-cancellation fallback the editor cannot rely on
		// implicitly (`pointercancel` is not guaranteed). The gesture owns an open
		// Layout transaction, so a blur closes it the same way a lost capture
		// does.
		const start = viewport.indexOf('function onWindowBlur(): void {');
		expect(start).toBeGreaterThan(-1);
		const handler = viewport.slice(start, viewport.indexOf('let previousPlanViewMode'));
		expect(handler).toContain('interiorAnchorPointerId !== null');
		expect(handler).toContain('cancelActiveLayoutDrag();');
		// The architecture-edit cancel stays first and untouched.
		expect(handler.indexOf('cancelArchitectureEditGesture();')).toBeGreaterThan(-1);
		// Blur is actually wired to the window.
		expect(viewport).toContain("window.addEventListener('blur', onWindowBlur);");
	});

	it('keeps the shared cancel path restoring the snapshot and closing the transaction', () => {
		const start = viewport.indexOf('function cancelActiveLayoutDrag()');
		expect(start).toBeGreaterThan(-1);
		const cancel = viewport.slice(start, viewport.indexOf('function beginRoomUnitDrag'));
		expect(cancel).toContain('if (dragSnapshot) restoreLayoutPreviewSnapshot(preview, dragSnapshot);');
		expect(cancel).toContain('onLayoutTransactionCancel();');
	});

	it('keeps pointer cancel on the same cancel path', () => {
		const start = viewport.indexOf('function onPointerCancel(event: PointerEvent)');
		expect(start).toBeGreaterThan(-1);
		const handler = viewport.slice(start, viewport.indexOf('function onClick(event: MouseEvent)'));
		expect(handler).toContain('interiorAnchorPointerId === event.pointerId');
		expect(handler).toContain('cancelActiveLayoutDrag();');
	});

	it('does not migrate this legacy gesture onto the P23.11 transient architecture path', () => {
		const branch = releaseBranch();
		expect(branch).not.toContain('architectureEdit');
		expect(branch).not.toContain('architectureEditTransient');
		expect(branch).not.toContain('beginArchitectureEditGesture');
	});
});
