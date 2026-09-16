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
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	wallCubicChain,
	wallCenterlineSegment,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

const ANCHOR_BASELINE: LayoutVec2 = [2, -1];

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

	it('a no-op click writes no history entry — the controller already suppresses unchanged commits', () => {
		const { store, state, target } = makeLegacyStore();
		const baselineJson = layoutPreviewCanonicalJson(state);

		expect(store.beginLayoutTransaction()).toBe(true);
		// A press/release that never moved: the release re-derives the anchor at
		// its own current point, which is the identical value.
		expect(
			updateLayoutWallInteriorAnchor(
				state,
				target.roomId,
				target.segmentId,
				target.anchorId,
				anchorPoint(state, target)
			)
		).toEqual({ success: true });

		// `commitLayout` compares the committed snapshot against the begin-time
		// `before` and reports `changed: false` without pushing, so the gesture
		// writes nothing.
		expect(store.commitLayoutTransaction(captureLayoutPreviewSnapshot(state))).toBe(false);
		expect(layoutPreviewCanonicalJson(state)).toBe(baselineJson);
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
		const moveBranch = source.slice(moveStart, moveStart + 260);
		expect(moveBranch).toContain('planInteriorAnchorDrag(draggedInteriorAnchor, point);');
		expect(moveBranch).not.toContain('updateLayoutWallInteriorAnchor');
		expect(releaseBranch()).not.toContain('updateLayoutWallInteriorAnchor');
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

		// Cancel sits on the reject side of the commit, so it is reached only
		// when the release derivation failed.
		expect(branch.indexOf('onLayoutTransactionCommit()')).toBeLessThan(
			branch.indexOf('onLayoutTransactionCancel();')
		);
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
