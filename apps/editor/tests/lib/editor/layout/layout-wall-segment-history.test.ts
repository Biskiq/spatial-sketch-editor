import { describe, expect, it } from 'vitest';
import { createEmptySceneDocument } from '$lib/content/scene';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import {
	advanceWallChainContinuation,
	beginWallChain,
	cancelWallChainRun,
	captureWallChainRun,
	createLayoutInteractionState,
	hasWallChainRun,
	restoreWallChainRun,
	updateWallChainCursor
} from '$lib/editor/layout/layout-interaction';
import { layoutMutationRunnerFor, runLayoutMutation } from '$lib/editor/layout/layout-mutation-runner';
import {
	captureLayoutPreviewSnapshot,
	commitWallChain,
	commitWallSegment,
	createEmptyLayoutPreviewState,
	importLayoutPreviewJson,
	layoutPreviewDocument,
	layoutPreviewSnapshotMatchesLive,
	restoreLayoutPreviewSnapshot
} from '$lib/editor/layout/layout-preview-state.svelte';
import {
	createEmptyWallFirstLayoutDocument,
	serializeWallFirstLayoutDocument
} from '$lib/layout/layout-wall-first-codec';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-types';
import type { LayoutVec2 } from '$lib/layout/layout-types';

function wallFirstPreviewState(): ReturnType<typeof createEmptyLayoutPreviewState> {
	const state = createEmptyLayoutPreviewState();
	const document = createEmptyWallFirstLayoutDocument();
	document.floor = { id: 'floor-1', name: 'Floor 1', elevation: 0 };
	const imported = importLayoutPreviewJson(state, serializeWallFirstLayoutDocument(document));
	if (!imported) throw new Error('wall-first import failed');
	return state;
}

function makeStore() {
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	const layoutPreview = wallFirstPreviewState();
	const layoutInteraction = createLayoutInteractionState();
	store.registerLayoutHistory({
		capture: () => captureLayoutPreviewSnapshot(layoutPreview),
		// Mirrors EditorApp/MuseumEditorApp: only a genuinely different
		// layout clears the run; successful commits re-install live state.
		replace: (snapshot) => {
			const typed = snapshot as ReturnType<typeof captureLayoutPreviewSnapshot>;
			if (!layoutPreviewSnapshotMatchesLive(layoutPreview, typed)) {
				cancelWallChainRun(layoutInteraction);
			}
			restoreLayoutPreviewSnapshot(layoutPreview, typed);
		},
		matches: (a, b) =>
			JSON.stringify((a as { project: { layout: unknown } }).project.layout) ===
			JSON.stringify((b as { project: { layout: unknown } }).project.layout)
	});
	// Point the central format-dispatch guard at the live preview (mirrors
	// EditorApp): without it the guard classifies the source as legacy and
	// the stage-6 cross-format invariant refuses every wall-first commit.
	store.setLayoutFormatPolicySource(() => layoutPreview);
	return { store, layoutPreview, layoutInteraction };
}

function wallFirstDocument(layoutPreview: ReturnType<typeof createEmptyLayoutPreviewState>): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(layoutPreview);
	if (!('formatVersion' in document)) throw new Error('expected wall-first document');
	return document;
}

function junctionPoint(document: LayoutDocumentWallFirst, junctionId: string): LayoutVec2 {
	const junction = document.junctions.find((candidate) => candidate.id === junctionId);
	if (!junction) throw new Error(`missing junction ${junctionId}`);
	return [...junction.point] as LayoutVec2;
}

/** One segment through the shared history runner (one undo entry on success). */
function commitSegment(
	context: ReturnType<typeof makeStore>,
	start: LayoutVec2,
	end: LayoutVec2,
	role: 'boundary' | 'partition' = 'boundary'
) {
	const { store, layoutPreview, layoutInteraction } = context;
	const outcome = runLayoutMutation(
		layoutMutationRunnerFor(store, layoutPreview),
		() => commitWallSegment(layoutPreview, start, end, role),
		(result) => result.success
	);
	if (outcome.kind !== 'committed') throw new Error(`segment commit failed: ${JSON.stringify(outcome)}`);
	const result = outcome.result;
	if (!result.success || result.operation !== 'wall-segment-commit') throw new Error('unexpected commit result');
	// Mirror the viewport: seed continuation from the canonical result.
	const document = wallFirstDocument(layoutPreview);
	advanceWallChainContinuation(layoutInteraction, {
		endPoint: junctionPoint(document, result.endJunctionId),
		endJunctionId: result.endJunctionId,
		startJunctionId: result.startJunctionId
	});
	return result;
}

describe('P23.9 segment history through Layout history (reviewer acceptance)', () => {
	it('AB and BC create two entries; one Undo removes BC only', () => {
		const context = makeStore();
		const { store, layoutPreview } = context;
		const ab = commitSegment(context, [0, 0], [4, 0]);
		expect(wallFirstDocument(layoutPreview).walls).toHaveLength(1);
		const bPoint = junctionPoint(wallFirstDocument(layoutPreview), ab.endJunctionId);
		commitSegment(context, bPoint, [4, 3]);
		expect(wallFirstDocument(layoutPreview).walls).toHaveLength(2);

		expect(store.canUndo).toBe(true);
		expect(store.undo()).toBe(true);
		const afterUndo = wallFirstDocument(layoutPreview);
		expect(afterUndo.walls).toHaveLength(1);
		expect(afterUndo.walls[0]!.id).toBe(ab.wallIds[0]);
		expect(store.canUndo).toBe(true);

		expect(store.undo()).toBe(true);
		expect(wallFirstDocument(layoutPreview).walls).toHaveLength(0);
		expect(store.canUndo).toBe(false);

		expect(store.redo()).toBe(true);
		expect(wallFirstDocument(layoutPreview).walls).toHaveLength(1);
		expect(store.redo()).toBe(true);
		expect(wallFirstDocument(layoutPreview).walls).toHaveLength(2);
	});

	it('closing DA plus Room birth is one entry; Undo restores open ABC without the Room', () => {
		const context = makeStore();
		const { store, layoutPreview } = context;
		const ab = commitSegment(context, [0, 0], [4, 0]);
		const bc = commitSegment(context, junctionPoint(wallFirstDocument(layoutPreview), ab.endJunctionId), [4, 3]);
		const cd = commitSegment(context, junctionPoint(wallFirstDocument(layoutPreview), bc.endJunctionId), [0, 3]);
		expect(wallFirstDocument(layoutPreview).rooms).toHaveLength(0);
		const runStart = ab.startJunctionId;
		commitSegment(
			context,
			junctionPoint(wallFirstDocument(layoutPreview), cd.endJunctionId),
			junctionPoint(wallFirstDocument(layoutPreview), runStart)
		);
		expect(wallFirstDocument(layoutPreview).rooms).toHaveLength(1);
		expect(wallFirstDocument(layoutPreview).walls).toHaveLength(4);

		expect(store.undo()).toBe(true);
		const afterUndo = wallFirstDocument(layoutPreview);
		expect(afterUndo.rooms).toHaveLength(0);
		expect(afterUndo.walls).toHaveLength(3);

		expect(store.redo()).toBe(true);
		expect(wallFirstDocument(layoutPreview).rooms).toHaveLength(1);
		expect(wallFirstDocument(layoutPreview).walls).toHaveLength(4);
	});

	it('an endpoint-on-Wall split commits once; Undo restores the exact prior topology', () => {
		const context = makeStore();
		const { store, layoutPreview } = context;
		const ab = commitSegment(context, [0, 0], [4, 0]);
		const before = serializeWallFirstLayoutDocument(wallFirstDocument(layoutPreview));
		// Spur T-ing into the wall interior: host split + spur in one entry.
		commitSegment(context, [2, -2], [2, 0]);
		expect(wallFirstDocument(layoutPreview).walls.length).toBeGreaterThan(2);

		expect(store.undo()).toBe(true);
		expect(serializeWallFirstLayoutDocument(wallFirstDocument(layoutPreview))).toBe(before);
		expect(wallFirstDocument(layoutPreview).walls.map((wall) => wall.id)).toEqual(ab.wallIds);
	});

	it('a rejected segment creates no history entry and preserves the run start', () => {
		const context = makeStore();
		const { store, layoutPreview, layoutInteraction } = context;
		commitSegment(context, [0, 0], [4, 0]);
		const before = serializeWallFirstLayoutDocument(wallFirstDocument(layoutPreview));
		beginWallChain(layoutInteraction, [0, 0]);
		// Mirror the viewport: the rejected transaction's snapshot-restore
		// clears transient state, so the caller re-installs the saved run.
		const savedRun = captureWallChainRun(layoutInteraction);
		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => commitWallSegment(layoutPreview, [0, 0], [4, 0], 'boundary'),
			(result) => result.success
		);
		expect(outcome.kind).toBe('cancelled');
		if (savedRun) restoreWallChainRun(layoutInteraction, savedRun);
		expect(store.canUndo).toBe(true); // only the AB entry exists
		expect(serializeWallFirstLayoutDocument(wallFirstDocument(layoutPreview))).toBe(before);
		// Rejection preserves the current start for correction.
		expect(hasWallChainRun(layoutInteraction)).toBe(true);
		expect(layoutInteraction.wallChainStart).toEqual([0, 0]);
		store.undo();
		expect(serializeWallFirstLayoutDocument(wallFirstDocument(layoutPreview))).not.toBe(before);
	});

	it('Undo during an active continuation clears the run, then reverts BC', () => {
		const context = makeStore();
		const { store, layoutPreview, layoutInteraction } = context;
		const ab = commitSegment(context, [0, 0], [4, 0]);
		const bc = commitSegment(context, junctionPoint(wallFirstDocument(layoutPreview), ab.endJunctionId), [4, 3]);
		// C→cursor preview active (stale C after BC reverts).
		updateWallChainCursor(layoutInteraction, [6, 3]);
		expect(hasWallChainRun(layoutInteraction)).toBe(true);

		expect(store.undo()).toBe(true);
		expect(hasWallChainRun(layoutInteraction)).toBe(false);
		const afterUndo = wallFirstDocument(layoutPreview);
		expect(afterUndo.walls).toHaveLength(1);
		expect(afterUndo.walls[0]!.id).toBe(ab.wallIds[0]);
		expect(bc.wallIds[0]).not.toBe(ab.wallIds[0]);
	});

	it('continuous AB→BC→CD→DA run survives successful history commits and closes on canonical A', () => {
		const context = makeStore();
		const { store, layoutPreview, layoutInteraction } = context;
		// Mirror the viewport: first click establishes the transient start,
		// each committed end seeds the next start via advanceWallChainContinuation.
		beginWallChain(layoutInteraction, [0, 0]);
		const legs: Array<{ end: LayoutVec2; direction: LayoutVec2 }> = [
			{ end: [4, 0], direction: [4, 0] },
			{ end: [4, 3], direction: [0, 3] },
			{ end: [0, 3], direction: [-4, 0] }
		];
		let runStart: string | null = null;
		const endJunctionIds: string[] = [];
		for (const [index, leg] of legs.entries()) {
			const expectedStart = index === 0 ? [0, 0] : legs[index - 1]!.end;
			expect(layoutInteraction.wallChainStart).toEqual(expectedStart);
			const runStartBefore = layoutInteraction.wallChainRunStartJunctionId;
			const start = [...layoutInteraction.wallChainStart!] as LayoutVec2;
			const outcome = runLayoutMutation(
				layoutMutationRunnerFor(store, layoutPreview),
				() => commitWallSegment(layoutPreview, start, leg.end, 'boundary'),
				(result) => result.success
			);
			expect(outcome.kind).toBe('committed');
			if (outcome.kind !== 'committed') throw new Error('segment commit failed');
			const result = outcome.result;
			if (!result.success || result.operation !== 'wall-segment-commit') {
				throw new Error('unexpected commit result');
			}
			if (index === 0) runStart = result.startJunctionId;
			// Mirror PlanWorkspace closure detection: run-start captured
			// before the transaction, never re-derived after it.
			const effectiveRunStart = runStartBefore ?? result.startJunctionId;
			expect(result.endJunctionId === effectiveRunStart).toBe(false);
			endJunctionIds.push(result.endJunctionId);
			const document = wallFirstDocument(layoutPreview);
			advanceWallChainContinuation(layoutInteraction, {
				endPoint: junctionPoint(document, result.endJunctionId),
				endJunctionId: result.endJunctionId,
				startJunctionId: result.startJunctionId
			});
			// The history commit's host.replace() must NOT reseed the run:
			// run-start stays the canonical A and direction survives.
			expect(layoutInteraction.wallChainRunStartJunctionId).toBe(runStart);
			expect(layoutInteraction.wallChainStart).toEqual(leg.end);
			expect(layoutInteraction.wallChainLastDirection).toEqual(leg.direction);
		}
		expect(wallFirstDocument(layoutPreview).rooms).toHaveLength(0);
		// Closing leg DA back to the canonical run-start Junction.
		const runStartBefore = layoutInteraction.wallChainRunStartJunctionId;
		expect(runStartBefore).toBe(runStart);
		const beforeClose = wallFirstDocument(layoutPreview);
		const dPoint = junctionPoint(beforeClose, endJunctionIds[2]!);
		const aPoint = junctionPoint(beforeClose, runStart!);
		const start = [...layoutInteraction.wallChainStart!] as LayoutVec2;
		expect(start).toEqual([0, 3]);
		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => commitWallSegment(layoutPreview, start, aPoint, 'boundary'),
			(result) => result.success
		);
		expect(outcome.kind).toBe('committed');
		if (outcome.kind !== 'committed') throw new Error('closing segment commit failed');
		const result = outcome.result;
		if (!result.success || result.operation !== 'wall-segment-commit') {
			throw new Error('unexpected close result');
		}
		const effectiveRunStart = runStartBefore ?? result.startJunctionId;
		expect(result.endJunctionId).toBe(effectiveRunStart);
		expect(dPoint).toEqual([0, 3]);
		expect(wallFirstDocument(layoutPreview).rooms).toHaveLength(1);
		expect(wallFirstDocument(layoutPreview).walls).toHaveLength(4);
		// Mirror the viewport: a closed boundary run ends the continuation.
		cancelWallChainRun(layoutInteraction);
		expect(hasWallChainRun(layoutInteraction)).toBe(false);
	});

	it('Rectangle commits four Walls plus Room birth as one atomic history entry', () => {		const context = makeStore();
		const { store, layoutPreview } = context;
		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => commitWallChain(layoutPreview, [[0, 0], [4, 0], [4, 3], [0, 3]], 'boundary', { close: true }),
			(result) => result.success
		);
		expect(outcome.kind).toBe('committed');
		expect(wallFirstDocument(layoutPreview).walls).toHaveLength(4);
		expect(wallFirstDocument(layoutPreview).rooms).toHaveLength(1);

		expect(store.undo()).toBe(true);
		expect(wallFirstDocument(layoutPreview).walls).toHaveLength(0);
		expect(wallFirstDocument(layoutPreview).rooms).toHaveLength(0);

		expect(store.redo()).toBe(true);
		expect(wallFirstDocument(layoutPreview).walls).toHaveLength(4);
		expect(wallFirstDocument(layoutPreview).rooms).toHaveLength(1);
	});
});
