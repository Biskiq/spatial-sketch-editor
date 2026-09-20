/**
 * P23.10 — the app-level rigid Wall move adapter and numeric/direct
 * convergence.
 *
 * The viewport never writes Junction coordinates itself: it calls
 * `updateWallFirstWallMove`, which is a thin adapter over the shared core
 * planner. Pinned here:
 *
 * - one valid move = exactly one Layout history entry, with exact Undo/Redo of
 *   both endpoint Junctions and the Wall's own identity;
 * - a rigid move and the equivalent pair of exact Junction moves produce the
 *   identical canonical document (one acceptance path, not two);
 * - rejected, no-op and non-finite commands write zero history entries;
 * - a legacy (Room-owned) document never enters the wall-first path.
 */
import { describe, expect, it } from 'vitest';
import { createEmptySceneDocument } from '$lib/content/scene';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import { layoutMutationRunnerFor, runLayoutMutation } from '$lib/editor/layout/layout-mutation-runner';
import {
	captureLayoutPreviewSnapshot,
	createEmptyLayoutPreviewState,
	importLayoutPreviewJson,
	layoutPreviewDocument,
	restoreLayoutPreviewSnapshot,
	updateWallFirstJunction,
	updateWallFirstWallMove
} from '$lib/editor/layout/layout-preview-state.svelte';
import {
	createEmptyWallFirstLayoutDocument,
	serializeWallFirstLayoutDocument
} from '$lib/layout/layout-wall-first-codec';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-types';
import type { LayoutVec2 } from '$lib/layout/layout-types';

/** A closed 4×3 m Room with a door on `w1`. */
function rectangleDocument(): LayoutDocumentWallFirst {
	const corners: Array<[string, number, number]> = [
		['j1', 0, 0],
		['j2', 4, 0],
		['j3', 4, 3],
		['j4', 0, 3]
	];
	return {
		units: 'meters',
		formatVersion: createEmptyWallFirstLayoutDocument().formatVersion,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: corners.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 })),
		walls: [
			['w1', 'j1', 'j2'],
			['w2', 'j2', 'j3'],
			['w3', 'j3', 'j4'],
			['w4', 'j4', 'j1']
		].map(([id, startJunctionId, endJunctionId]) => ({
			id,
			startJunctionId,
			endJunctionId,
			role: 'boundary' as const,
			thickness: 0.2,
			height: 3,
			centerline: { kind: 'line' } as const
		})),
		rooms: [
			{
				id: 'room-a',
				name: 'Room A',
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

function makeStore(seed: LayoutDocumentWallFirst = rectangleDocument()) {
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
	store.setLayoutFormatPolicySource(() => layoutPreview);
	return { store, layoutPreview };
}

function wallFirstDocument(
	layoutPreview: ReturnType<typeof createEmptyLayoutPreviewState>
): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(layoutPreview);
	if (!('formatVersion' in document)) throw new Error('expected wall-first document');
	return document;
}

describe('P23.10 rigid Wall move adapter', () => {
	it('commits one entry and Undo/Redo restore the exact endpoints', () => {
		const { store, layoutPreview } = makeStore();
		const before = JSON.stringify(layoutPreviewDocument(layoutPreview));
		expect(store.canUndo).toBe(false);

		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => updateWallFirstWallMove(layoutPreview, 'w1', [1, 1]),
			(result) => result.success
		);
		if (outcome.kind !== 'committed') throw new Error(`expected commit: ${JSON.stringify(outcome)}`);
		expect(outcome.result).toMatchObject({ success: true, operation: 'wall-move' });

		const moved = wallFirstDocument(layoutPreview);
		expect(moved.junctions.find((junction) => junction.id === 'j1')?.point).toEqual([1, 1]);
		expect(moved.junctions.find((junction) => junction.id === 'j2')?.point).toEqual([5, 1]);
		// Rigid: the hosted Opening and the Wall's own fields are untouched.
		expect(moved.openings).toEqual(rectangleDocument().openings);
		expect(store.canUndo).toBe(true);

		expect(store.undo()).toBe(true);
		expect(JSON.stringify(layoutPreviewDocument(layoutPreview))).toBe(before);
		expect(store.canUndo).toBe(false);

		expect(store.redo()).toBe(true);
		expect(JSON.stringify(layoutPreviewDocument(layoutPreview))).toBe(JSON.stringify(moved));
	});

	it('produces the identical document as the equivalent exact Junction moves', () => {
		const rigid = makeStore();
		runLayoutMutation(
			layoutMutationRunnerFor(rigid.store, rigid.layoutPreview),
			() => updateWallFirstWallMove(rigid.layoutPreview, 'w1', [1, 1]),
			(result) => result.success
		);

		const numeric = makeStore();
		// Same two endpoint translations through the Junction command, run in
		// the canonical endpoint order.
		expect(updateWallFirstJunction(numeric.layoutPreview, 'j1', [1, 1]).success).toBe(true);
		expect(updateWallFirstJunction(numeric.layoutPreview, 'j2', [5, 1]).success).toBe(true);

		expect(JSON.stringify(layoutPreviewDocument(rigid.layoutPreview))).toBe(
			JSON.stringify(layoutPreviewDocument(numeric.layoutPreview))
		);
	});

	it('writes zero entries for a rejected, no-op or non-finite move', () => {
		const { store, layoutPreview } = makeStore();
		const before = JSON.stringify(layoutPreviewDocument(layoutPreview));

		for (const delta of [[0, 0], [Number.NaN, 0]] as LayoutVec2[]) {
			const outcome = runLayoutMutation(
				layoutMutationRunnerFor(store, layoutPreview),
				() => updateWallFirstWallMove(layoutPreview, 'w1', delta),
				(result) => result.success
			);
			expect(outcome.kind).toBe('cancelled');
		}
		expect(store.canUndo).toBe(false);

		// A move that breaks a neighbouring Wall's topology rejects atomically.
		const crossed = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => updateWallFirstWallMove(layoutPreview, 'w3', [0, -3]),
			(result) => result.success
		);
		expect(crossed.kind).toBe('cancelled');
		expect(store.canUndo).toBe(false);
		expect(JSON.stringify(layoutPreviewDocument(layoutPreview))).toBe(before);
	});

	it('refuses the wall-first move path on a legacy document', () => {
		const layoutPreview = createEmptyLayoutPreviewState();
		const result = updateWallFirstWallMove(layoutPreview, 'w1', [1, 0]);
		expect(result.success).toBe(false);
	});
});
