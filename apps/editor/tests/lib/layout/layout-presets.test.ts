import { describe, expect, it } from 'vitest';

import { compileWallFirstLayoutGeometry } from '$lib/layout/layout-geometry';
import {
	LAYOUT_ARCHITECTURAL_PRESETS,
	layoutArchitecturalPreset,
	layoutPresetPlacement,
	planCommitLayoutObjectPreset,
	planDeleteLayoutObject,
	planExactLayoutObjectTransform,
	type LayoutArchitecturalPresetId,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import {
	parseWallFirstLayoutDocumentJson,
	serializeWallFirstLayoutDocument
} from '$lib/layout/layout-wall-first-codec';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-wall-first-types';
import { buildPlanRenderModel } from '$lib/layout/plan-render-model';
import {
	beginLayoutPresetDraft,
	cancelLayoutPresetDraft,
	createLayoutInteractionState,
	hasLayoutTransientInteraction,
	isLayoutPresetTool,
	setLayoutDraftTool
} from '$lib/editor/layout/layout-interaction';
import { presetIdForTool } from '$lib/editor/layout/plan-overlays';
import {
	captureLayoutPreviewSnapshot,
	commitLayoutObjectPreset,
	createEmptyWallFirstLayoutPreviewState,
	layoutPreviewDocument,
	restoreLayoutPreviewSnapshot,
	type LayoutPreviewState
} from '$lib/editor/layout/layout-preview-state.svelte';
import { layoutMutationRunnerFor, runLayoutMutation } from '$lib/editor/layout/layout-mutation-runner';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptySceneDocument } from '$lib/content/scene';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import type { LayoutObject, LayoutVec2 } from '$lib/layout/layout-types';

function emptyDocument(elevation = 0): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor', name: 'Floor', elevation },
		junctions: [],
		walls: [],
		rooms: [],
		openings: [],
		objects: []
	};
}

function committedObject(
	presetId: LayoutArchitecturalPresetId,
	point: LayoutVec2,
	elevation = 0
): LayoutDocumentWallFirst {
	const plan = planCommitLayoutObjectPreset(emptyDocument(elevation), presetId, point, elevation);
	if (plan.kind !== 'success') throw new Error(`preset commit rejected: ${plan.rejection.message}`);
	return plan.document;
}

describe('P23.5 small architectural preset set', () => {
	it('ships exactly Column, Platform and Plinth over existing primitive kinds', () => {
		expect(LAYOUT_ARCHITECTURAL_PRESETS.map((preset) => preset.id).sort()).toEqual([
			'column',
			'platform',
			'plinth'
		]);
		expect(layoutArchitecturalPreset('column')).toMatchObject({ kind: 'cylinder' });
		expect(layoutArchitecturalPreset('platform')).toMatchObject({ kind: 'box' });
		expect(layoutArchitecturalPreset('plinth')).toMatchObject({ kind: 'box' });
		for (const preset of LAYOUT_ARCHITECTURAL_PRESETS) {
			expect(preset.label.trim().length).toBeGreaterThan(0);
			expect(preset.dimensions.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
		}
	});

	it('ships no Partition preset: partitions are first-class Walls, not boxes', () => {
		expect(layoutArchitecturalPreset('partition')).toBeUndefined();
		expect(layoutArchitecturalPreset('wall')).toBeUndefined();
		expect(layoutArchitecturalPreset('nope')).toBeUndefined();
	});

	it('maps each preset tool to its preset id', () => {
		expect(presetIdForTool('preset-column')).toBe('column');
		expect(presetIdForTool('preset-platform')).toBe('platform');
		expect(presetIdForTool('preset-plinth')).toBe('plinth');
		expect(isLayoutPresetTool('preset-column')).toBe(true);
		expect(isLayoutPresetTool('box')).toBe(false);
		expect(isLayoutPresetTool('door')).toBe(false);
	});

	it('commits a Column as one ordinary document-level cylinder object', () => {
		const plan = planCommitLayoutObjectPreset(emptyDocument(), 'column', [5, 6], 0);
		if (plan.kind !== 'success') throw new Error(`rejected: ${plan.rejection.message}`);
		expect(plan.operation).toBe('layout-object-preset-create');
		expect(plan.document.objects).toHaveLength(1);
		const object = plan.document.objects[0]!;
		expect(object).toMatchObject({
			id: 'layout-object-1',
			kind: 'cylinder',
			position: [5, 1.5, 6],
			rotation: [0, 0, 0],
			dimensions: [0.4, 3, 0.4]
		});
		expect(object).not.toHaveProperty('roomId');
		expect(plan.createdObjectId).toBe('layout-object-1');
	});

	it('commits Platform and Plinth as ordinary box objects', () => {
		expect(committedObject('platform', [0, 0]).objects[0]).toMatchObject({
			kind: 'box',
			dimensions: [3, 0.2, 3],
			position: [0, 0.1, 0]
		});
		expect(committedObject('plinth', [1, 2]).objects[0]).toMatchObject({
			kind: 'box',
			dimensions: [0.8, 1, 0.8],
			position: [1, 0.5, 2]
		});
	});

	it('respects floor elevation without introducing Floor ownership', () => {
		const document = committedObject('plinth', [1, 2], 2.5);
		expect(document.objects[0]!.position).toEqual([1, 3, 2]);
		expect(document.objects[0]).not.toHaveProperty('roomId');
		expect(document.objects[0]).not.toHaveProperty('floorId');
		expect('preset' in document.objects[0]!).toBe(false);
		expect(serializeWallFirstLayoutDocument(document)).not.toContain('preset');
	});

	it('allocates deterministic object ids and never mutates the input', () => {
		const baseline = emptyDocument();
		const first = planCommitLayoutObjectPreset(baseline, 'column', [0, 0], 0);
		if (first.kind !== 'success') throw new Error('first commit rejected');
		expect(baseline.objects).toHaveLength(0);
		const second = planCommitLayoutObjectPreset(first.document, 'column', [1, 1], 0);
		if (second.kind !== 'success') throw new Error('second commit rejected');
		expect(second.document.objects.map((object) => object.id)).toEqual([
			'layout-object-1',
			'layout-object-2'
		]);
		expect(second.createdObjectId).toBe('layout-object-2');
	});

	it('rejects unknown presets, non-finite points and non-finite elevations', () => {
		const unknown = planCommitLayoutObjectPreset(
			emptyDocument(),
			'partition' as LayoutArchitecturalPresetId,
			[0, 0],
			0
		);
		expect(unknown.kind).toBe('rejected');
		const nanPoint = planCommitLayoutObjectPreset(emptyDocument(), 'column', [NaN, 0], 0);
		expect(nanPoint.kind).toBe('rejected');
		const nanElevation = planCommitLayoutObjectPreset(emptyDocument(), 'column', [0, 0], NaN);
		expect(nanElevation.kind).toBe('rejected');
		expect(layoutPresetPlacement(layoutArchitecturalPreset('column')!, [0, 0], NaN)).toBeUndefined();
	});

	it('edits and deletes preset objects through the existing P23.1 object semantics', () => {
		const document = committedObject('platform', [0, 0]);
		const edited = planExactLayoutObjectTransform(document, 'layout-object-1', {
			dimensions: [4, 0.2, 4]
		});
		if (edited.kind !== 'success') throw new Error(`edit rejected: ${edited.rejection.message}`);
		expect(edited.document.objects[0]!.dimensions).toEqual([4, 0.2, 4]);
		const deleted = planDeleteLayoutObject(edited.document, 'layout-object-1');
		if (deleted.kind !== 'success') throw new Error(`delete rejected: ${deleted.rejection.message}`);
		expect(deleted.document.objects).toHaveLength(0);
	});

	it('compiles and renders exactly like an equivalent manually created primitive', () => {
		const presetDocument = committedObject('column', [5, 6]);
		const manualDocument: LayoutDocumentWallFirst = {
			...emptyDocument(),
			objects: [
				{
					id: 'layout-object-1',
					kind: 'cylinder',
					position: [5, 1.5, 6],
					rotation: [0, 0, 0],
					dimensions: [0.4, 3, 0.4]
				}
			]
		};
		const presetCompiled = compileWallFirstLayoutGeometry(presetDocument);
		const manualCompiled = compileWallFirstLayoutGeometry(manualDocument);
		expect(presetCompiled.issues).toEqual([]);
		expect(presetCompiled.geometry.objects).toEqual(manualCompiled.geometry.objects);
		expect(buildPlanRenderModel(presetCompiled.geometry)).toEqual(
			buildPlanRenderModel(manualCompiled.geometry)
		);
	});

	it('round-trips through Save with no preset-only durable metadata', () => {
		const document = committedObject('plinth', [1, 2]);
		const parsed = parseWallFirstLayoutDocumentJson(serializeWallFirstLayoutDocument(document));
		if (!parsed.success) throw new Error(`round-trip failed: ${parsed.issues[0]?.message}`);
		expect(parsed.document.objects).toHaveLength(1);
		expect(parsed.document.objects[0]).toMatchObject({ kind: 'box', dimensions: [0.8, 1, 0.8] });
		expect(JSON.stringify(parsed.document)).not.toContain('preset');
	});

	it('treats the preset draft as hover-only: it never blocks other mutations', () => {
		const interaction = createLayoutInteractionState();
		beginLayoutPresetDraft(interaction, 'preset-column', [1, 2]);
		expect(interaction.presetDraft).toMatchObject({ tool: 'preset-column', point: [1, 2], valid: true });
		expect(hasLayoutTransientInteraction(interaction)).toBe(false);
		beginLayoutPresetDraft(interaction, 'preset-plinth', [NaN, 0]);
		expect(interaction.presetDraft?.valid).toBe(false);
		cancelLayoutPresetDraft(interaction);
		expect(interaction.presetDraft).toBeNull();
	});

	it('commits presets through the preview state as ordinary objects', () => {
		const preview = createEmptyWallFirstLayoutPreviewState();
		const result = commitLayoutObjectPreset(preview, 'plinth', [1, 2]);
		if (!result.success) throw new Error(`preview commit rejected: ${result.message}`);
		const layout = preview.project.layout;
		if (!('formatVersion' in layout)) throw new Error('expected a wall-first layout');
		expect(layout.objects).toHaveLength(1);
		expect(layout.objects[0]).toMatchObject({ id: result.objectId, kind: 'box' });
		expect(layout.objects[0]).not.toHaveProperty('roomId');
		expect(preview.lastMutationMessage).toBeNull();
	});

	it('leaves the preview untouched when a preset commit rejects', () => {
		const preview = createEmptyWallFirstLayoutPreviewState();
		const result = commitLayoutObjectPreset(preview, 'column', [NaN, 0]);
		expect(result.success).toBe(false);
		const layout = preview.project.layout;
		if (!('formatVersion' in layout)) throw new Error('expected a wall-first layout');
		expect(layout.objects).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// P23.5 history acceptance — one click is one Layout history entry through
// the same transaction path the viewport drives (begin → commit → commit,
// reject → cancel). Undo/Redo preserve exact object identity.
// ---------------------------------------------------------------------------

function presetStore() {
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	const preview = createEmptyWallFirstLayoutPreviewState();
	store.registerLayoutHistory({
		capture: () => captureLayoutPreviewSnapshot(preview),
		replace: (snapshot) =>
			restoreLayoutPreviewSnapshot(
				preview,
				snapshot as ReturnType<typeof captureLayoutPreviewSnapshot>
			),
		matches: (a, b) =>
			JSON.stringify((a as { project: { layout: unknown } }).project.layout) ===
			JSON.stringify((b as { project: { layout: unknown } }).project.layout)
	});
	store.setLayoutFormatPolicySource(() => preview);
	return { store, preview };
}

function liveObjects(preview: LayoutPreviewState): LayoutObject[] {
	const layout = layoutPreviewDocument(preview);
	if (!('formatVersion' in layout)) throw new Error('expected a wall-first layout');
	return (layout as LayoutDocumentWallFirst).objects;
}

describe('P23.5 preset placement history', () => {
	it('commits one click as exactly one history entry with exact Undo/Redo identity', () => {
		const { store, preview } = presetStore();
		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, preview),
			() => commitLayoutObjectPreset(preview, 'plinth', [1, 2]),
			(result) => result.success
		);
		expect(outcome.kind).toBe('committed');
		if (outcome.kind !== 'committed' || !outcome.result.success) {
			throw new Error(`expected a committed preset, got ${JSON.stringify(outcome)}`);
		}
		const objectId = outcome.result.objectId;
		expect(objectId).toBe('layout-object-1');
		expect(liveObjects(preview)).toHaveLength(1);

		// Undo removes the exact object and exhausts the single entry.
		expect(store.canUndo).toBe(true);
		expect(store.undo()).toBe(true);
		expect(liveObjects(preview)).toHaveLength(0);
		expect(store.canUndo).toBe(false);

		// Redo restores the same ID — never a fresh allocation.
		expect(store.redo()).toBe(true);
		const restored = liveObjects(preview);
		expect(restored).toHaveLength(1);
		expect(restored[0]!.id).toBe(objectId);
		expect(restored[0]).toMatchObject({ kind: 'box', dimensions: [0.8, 1, 0.8] });
	});

	it('writes zero history entries when a preset click rejects', () => {
		const { store, preview } = presetStore();
		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, preview),
			() => commitLayoutObjectPreset(preview, 'column', [NaN, 0]),
			(result) => result.success
		);
		expect(outcome.kind).toBe('cancelled');
		expect(liveObjects(preview)).toHaveLength(0);
		expect(store.canUndo).toBe(false);
	});

	it('writes zero history entries when Escape cancels before placement', () => {
		const { store, preview } = presetStore();
		const interaction = createLayoutInteractionState();
		setLayoutDraftTool(interaction, 'preset-column');
		beginLayoutPresetDraft(interaction, 'preset-column', [3, 4]);
		// Escape: clear the hover footprint and disarm — no transaction ever
		// opened, so there is nothing to commit or cancel.
		cancelLayoutPresetDraft(interaction);
		setLayoutDraftTool(interaction, 'select');
		expect(interaction.presetDraft).toBeNull();
		expect(liveObjects(preview)).toHaveLength(0);
		expect(store.canUndo).toBe(false);
	});
});
