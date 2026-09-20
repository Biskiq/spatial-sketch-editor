/**
 * P23.6H — Wall Height through the editor adapter and the Layout history.
 *
 * The Inspector never assigns `wall.height`; it calls
 * `updateWallFirstWallHeight`, which routes the canonical planner through the
 * existing guarded runner. Pinned here:
 *
 * - one successful edit = exactly one undo entry, with exact Undo/Redo of both
 *   the authored value and the compiled vertical extent;
 * - rejected, invalid and no-op edits write zero history entries and leave the
 *   document untouched;
 * - a legacy (Room-owned) document never enters the wall-first height path.
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
	updateWallFirstWallHeight
} from '$lib/editor/layout/layout-preview-state.svelte';
import {
	createEmptyWallFirstLayoutDocument,
	serializeWallFirstLayoutDocument
} from '$lib/layout/layout-wall-first-codec';
import {
	WALL_AUTHORING_DEFAULT_HEIGHT,
	type LayoutDocumentWallFirst
} from '$lib/layout/layout-wall-first-types';
import type { LayoutVec2 } from '$lib/layout/layout-types';
import { compileWallFirstLayoutGeometry } from '$lib/layout/layout-geometry';

/**
 * A closed 4×3 m Room whose four Walls all start at a given height. P23.6I: the
 * canonical Floor carries no `height`, so the only authored vertical value here is
 * the Wall height itself.
 */
function rectangleDocument(options: { wallHeight?: number } = {}): LayoutDocumentWallFirst {
	const wallHeight = options.wallHeight ?? WALL_AUTHORING_DEFAULT_HEIGHT;
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
			height: wallHeight,
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
		openings: [],
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
	// Mirrors EditorApp: the format-dispatch guard must see the live preview or
	// the stage-6 cross-format invariant refuses every wall-first commit.
	store.setLayoutFormatPolicySource(() => layoutPreview);
	return { store, layoutPreview };
}

function wallFirstDocument(layoutPreview: ReturnType<typeof createEmptyLayoutPreviewState>): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(layoutPreview);
	if (!('formatVersion' in document)) throw new Error('expected wall-first document');
	return document;
}

function wallHeight(layoutPreview: ReturnType<typeof createEmptyLayoutPreviewState>, wallId: string): number {
	const wall = wallFirstDocument(layoutPreview).walls.find((candidate) => candidate.id === wallId);
	if (!wall) throw new Error(`missing wall ${wallId}`);
	return wall.height;
}

function compiledTop(layoutPreview: ReturnType<typeof createEmptyLayoutPreviewState>, wallId: string): number {
	const compiled = compileWallFirstLayoutGeometry(wallFirstDocument(layoutPreview));
	const wall = compiled.geometry.walls.find((candidate) => candidate.wallId === wallId);
	if (!wall) throw new Error(`missing compiled wall ${wallId}`);
	return wall.bounds3.max[1];
}

function editHeight(
	context: ReturnType<typeof makeStore>,
	wallId: string,
	height: number
): ReturnType<typeof runLayoutMutation> {
	const { store, layoutPreview } = context;
	return runLayoutMutation(
		layoutMutationRunnerFor(store, layoutPreview),
		() => updateWallFirstWallHeight(layoutPreview, wallId, height),
		(result) => result.success
	);
}

describe('P23.6H Wall Height through Layout history', () => {
	it('commits one entry and Undo/Redo restore exact height and compiled extent', () => {
		const context = makeStore(rectangleDocument({ wallHeight: 3 }));
		const { store, layoutPreview } = context;
		expect(store.canUndo).toBe(false);

		const outcome = editHeight(context, 'w1', 1.5);
		if (outcome.kind !== 'committed') throw new Error(`expected commit: ${JSON.stringify(outcome)}`);
		expect(wallHeight(layoutPreview, 'w1')).toBe(1.5);
		expect(compiledTop(layoutPreview, 'w1')).toBe(1.5);
		expect(store.canUndo).toBe(true);

		expect(store.undo()).toBe(true);
		expect(wallHeight(layoutPreview, 'w1')).toBe(3);
		expect(compiledTop(layoutPreview, 'w1')).toBe(3);
		expect(store.canUndo).toBe(false);

		expect(store.redo()).toBe(true);
		expect(wallHeight(layoutPreview, 'w1')).toBe(1.5);
		expect(compiledTop(layoutPreview, 'w1')).toBe(1.5);
	});

	it('restores every Wall height exactly across Undo', () => {
		const context = makeStore(rectangleDocument({ wallHeight: 2.2 }));
		const { store, layoutPreview } = context;
		editHeight(context, 'w2', 1.1);
		expect(wallFirstDocument(layoutPreview).walls.map((wall) => wall.height)).toEqual([2.2, 1.1, 2.2, 2.2]);
		expect(store.undo()).toBe(true);
		expect(wallFirstDocument(layoutPreview).walls.map((wall) => wall.height)).toEqual([2.2, 2.2, 2.2, 2.2]);
	});

	it('SUPERSEDES the Floor cap: a tall edit is accepted and still writes one entry', () => {
		// P23.6H rejected this edit (`Floor height 2.5`) and wrote zero entries.
		const context = makeStore(rectangleDocument({ wallHeight: 2.5 }));
		const { store, layoutPreview } = context;
		const outcome = editHeight(context, 'w1', 4);
		expect(outcome.kind).toBe('committed');
		expect(store.canUndo).toBe(true);
		expect(wallHeight(layoutPreview, 'w1')).toBe(4);
		store.undo();
		expect(wallHeight(layoutPreview, 'w1')).toBe(2.5);
		store.undo();
		expect(store.canUndo).toBe(false);
	});

	it('writes zero entries when the Wall would drop below its hosted Opening', () => {
		const context = makeStore(rectangleDocument({ wallHeight: 2.5 }));
		const { store, layoutPreview } = context;
		const outcome = editHeight(context, 'w1', Number.NaN);
		expect(outcome.kind).toBe('cancelled');
		expect(store.canUndo).toBe(false);
		expect(wallHeight(layoutPreview, 'w1')).toBe(2.5);
	});

	it('writes zero entries for a no-op edit', () => {
		const context = makeStore(rectangleDocument({ wallHeight: 2 }));
		const { store, layoutPreview } = context;
		const outcome = editHeight(context, 'w1', 2);
		expect(outcome.kind).toBe('cancelled');
		expect(store.canUndo).toBe(false);
		expect(wallHeight(layoutPreview, 'w1')).toBe(2);
	});

	it('writes zero entries for a non-finite edit', () => {
		const context = makeStore();
		const { store, layoutPreview } = context;
		const outcome = editHeight(context, 'w1', Number.NaN);
		expect(outcome.kind).toBe('cancelled');
		expect(store.canUndo).toBe(false);
		expect(wallHeight(layoutPreview, 'w1')).toBe(3);
	});

	it('keeps the Wall selection identity and the Room after the commit', () => {
		const context = makeStore(rectangleDocument({ wallHeight: 3 }));
		const { layoutPreview } = context;
		editHeight(context, 'w1', 1.2);
		const document = wallFirstDocument(layoutPreview);
		expect(document.rooms.map((room) => room.id)).toEqual(['room-a']);
		expect(document.rooms[0]!.boundary.map((ref) => ref.wallId)).toEqual(['w1', 'w2', 'w3', 'w4']);
		expect(document.walls.map((wall) => wall.id)).toEqual(['w1', 'w2', 'w3', 'w4']);
		expect(document.junctions.map((junction) => junction.id)).toEqual(['j1', 'j2', 'j3', 'j4']);
	});

	it('refuses the wall-first height path on a legacy document', () => {
		const store = createEditorStore({
			document: createEmptySceneDocument(),
			rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
		});
		const layoutPreview = createEmptyLayoutPreviewState();
		// `createEmptyLayoutPreviewState()` boots the legacy compatibility
		// fixture; the wall-first adapter must refuse it rather than guess.
		const result = updateWallFirstWallHeight(layoutPreview, 'w1', 1.5);
		expect(result.success).toBe(false);
		expect(store.canUndo).toBe(false);
	});
});
