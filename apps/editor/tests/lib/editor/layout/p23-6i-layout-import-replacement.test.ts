/**
 * P23.6I review — Layout import replacement lifecycle.
 *
 * The shell-owned `requestLayoutImportReplacement()` must confirm once for
 * every recognized Layout format (including canonical wall-first v5), then on
 * success clear shared history and fire the replacement lifecycle (the shell
 * ends the in-flight Wall run there). Canceled/rejected imports must preserve
 * document, history, and active run.
 */
import { describe, expect, it, vi } from 'vitest';
import { createEmptySceneDocument } from '$lib/content/scene';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import {
	advanceWallChainContinuation,
	beginWallChain,
	cancelWallChainRun,
	captureWallChainRun,
	createLayoutInteractionState
} from '$lib/editor/layout/layout-interaction';
import { layoutMutationRunnerFor, runLayoutMutation } from '$lib/editor/layout/layout-mutation-runner';
import {
	captureLayoutPreviewSnapshot,
	commitWallSegment,
	createEmptyLayoutPreviewState,
	importLayoutPreviewJson,
	layoutPreviewDocument,
	layoutPreviewSnapshotMatchesLive,
	restoreLayoutPreviewSnapshot
} from '$lib/editor/layout/layout-preview-state.svelte';
import { requestLayoutImportReplacement } from '$lib/editor/layout/layout-import-replacement';
import { serializeWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';
import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

function tallWallDocument(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [
			{ id: 'a', point: [0, 0] },
			{ id: 'b', point: [0, 3] }
		],
		walls: [
			{
				id: 'w1',
				startJunctionId: 'a',
				endJunctionId: 'b',
				role: 'partition',
				thickness: 0.2,
				height: 4,
				centerline: { kind: 'line' } as const,
			}
		],
		rooms: [],
		openings: [],
		objects: []
	};
}

function emptyDocument(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [],
		walls: [],
		rooms: [],
		openings: [],
		objects: []
	};
}

function makeStore(document: LayoutDocumentWallFirst) {
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	const layoutPreview = createEmptyLayoutPreviewState();
	const imported = importLayoutPreviewJson(
		layoutPreview,
		serializeWallFirstLayoutDocument(document)
	);
	if (!imported) throw new Error('wall-first import failed');
	const layoutInteraction = createLayoutInteractionState();
	store.registerLayoutHistory({
		capture: () => captureLayoutPreviewSnapshot(layoutPreview),
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
	store.setLayoutFormatPolicySource(() => layoutPreview);
	return { store, layoutPreview, layoutInteraction };
}

type Store = ReturnType<typeof makeStore>;

function liveDocument(context: Store): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(context.layoutPreview);
	if (!('formatVersion' in document)) throw new Error('expected wall-first document');
	return document;
}

function junctionPoint(document: LayoutDocumentWallFirst, junctionId: string): LayoutVec2 {
	const junction = document.junctions.find((candidate) => candidate.id === junctionId);
	if (!junction) throw new Error(`missing junction ${junctionId}`);
	return [...junction.point] as LayoutVec2;
}

/** Same flow as the viewport: explicit run height in, continuation out. */
function commitRunSegment(context: Store, start: LayoutVec2, end: LayoutVec2) {
	const { store, layoutPreview, layoutInteraction } = context;
	const outcome = runLayoutMutation(
		layoutMutationRunnerFor(store, layoutPreview),
		() =>
			commitWallSegment(
				layoutPreview,
				start,
				end,
				'partition',
				layoutInteraction.wallChainRunHeight ?? undefined
			),
		(result) => result.success
	);
	if (outcome.kind !== 'committed') return outcome;
	const result = outcome.result;
	if (!result.success || result.operation !== 'wall-segment-commit') {
		throw new Error('unexpected commit result');
	}
	const document = liveDocument(context);
	advanceWallChainContinuation(layoutInteraction, {
		endPoint: junctionPoint(document, result.endJunctionId),
		endJunctionId: result.endJunctionId,
		startJunctionId: result.startJunctionId,
		...(result.wallHeight !== undefined ? { wallHeight: result.wallHeight } : {})
	});
	return outcome;
}

/** Shell wiring, exactly as `EditorApp` binds it. */
function shellOnReplaced(context: Store, spy: () => void) {
	return () => {
		cancelWallChainRun(context.layoutInteraction);
		spy();
	};
}

describe('P23.6I layout import replacement lifecycle', () => {
	it('a successful v5 import confirms, replaces, clears history and fires the replacement lifecycle', () => {
		const context = makeStore(tallWallDocument());
		beginWallChain(context.layoutInteraction, [0, 0]);
		commitRunSegment(context, [0, 0], [3, 0]);
		expect(context.layoutInteraction.wallChainRunHeight).toBe(4);
		expect(context.store.canUndo).toBe(true);

		const confirm = vi.fn(() => true);
		const onReplaced = vi.fn();
		const ok = requestLayoutImportReplacement({
			layoutPreview: context.layoutPreview,
			json: serializeWallFirstLayoutDocument(emptyDocument()),
			confirmReplacement: confirm,
			clearSharedHistory: () => context.store.clearSharedHistory(),
			onReplaced: shellOnReplaced(context, onReplaced)
		});

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(ok).toBe(true);
		// Document B installed.
		expect(liveDocument(context).walls).toEqual([]);
		// Old cross-document history cannot be reinstalled by Undo.
		expect(context.store.canUndo).toBe(false);
		// Replacement lifecycle fired and the stale 4 m run height is gone.
		expect(onReplaced).toHaveBeenCalledTimes(1);
		expect(context.layoutInteraction.wallChainRunHeight).toBeNull();
		expect(context.layoutInteraction.wallChainStart).toBeNull();
	});

	it('a canceled import preserves document, history and active run', () => {
		const context = makeStore(tallWallDocument());
		beginWallChain(context.layoutInteraction, [0, 0]);
		commitRunSegment(context, [0, 0], [3, 0]);
		const before = liveDocument(context);
		expect(context.store.canUndo).toBe(true);

		const onReplaced = vi.fn();
		const ok = requestLayoutImportReplacement({
			layoutPreview: context.layoutPreview,
			json: serializeWallFirstLayoutDocument(emptyDocument()),
			confirmReplacement: () => false,
			clearSharedHistory: () => context.store.clearSharedHistory(),
			onReplaced: shellOnReplaced(context, onReplaced)
		});

		expect(ok).toBe(false);
		expect(liveDocument(context)).toEqual(before);
		expect(context.store.canUndo).toBe(true);
		expect(onReplaced).not.toHaveBeenCalled();
		expect(context.layoutInteraction.wallChainRunHeight).toBe(4);
		expect(captureWallChainRun(context.layoutInteraction)).not.toBeNull();
	});

	it('a rejected import preserves document, history and active run without confirming', () => {
		const context = makeStore(tallWallDocument());
		beginWallChain(context.layoutInteraction, [0, 0]);
		commitRunSegment(context, [0, 0], [3, 0]);
		const before = liveDocument(context);
		expect(context.store.canUndo).toBe(true);

		const confirm = vi.fn(() => true);
		const onReplaced = vi.fn();
		const ok = requestLayoutImportReplacement({
			layoutPreview: context.layoutPreview,
			json: '{ not json',
			confirmReplacement: confirm,
			clearSharedHistory: () => context.store.clearSharedHistory(),
			onReplaced: shellOnReplaced(context, onReplaced)
		});

		expect(ok).toBe(false);
		expect(confirm).not.toHaveBeenCalled();
		expect(context.layoutPreview.importError).not.toBeNull();
		expect(liveDocument(context)).toEqual(before);
		expect(context.store.canUndo).toBe(true);
		expect(onReplaced).not.toHaveBeenCalled();
		expect(context.layoutInteraction.wallChainRunHeight).toBe(4);
	});
});
