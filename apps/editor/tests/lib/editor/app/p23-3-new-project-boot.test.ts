import path from 'node:path';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { chopinRuntime } from '$lib/content/chopin-project';
import { cloneFixtureDocument } from '../../content/__fixtures__/load-fixture-scene';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
/**
 * P23.3 — a new project boots a wall-first Layout, and that boot is saveable.
 *
 * The canonical Junction/Wall/Room/Opening authoring path only applies to a
 * wall-first Layout document (current wall-first format), so before this change the
 * canonical Opening flow was unreachable without importing a wall-first Layout
 * JSON. The editor's boot now composes the canonical pair.
 *
 * The pairing rule is the load-bearing part: `validateProject` rejects a
 * wall-first Layout that carries the recognized legacy room-local Scene
 * (`scene_not_world_local`), so the Layout and the Scene discriminators must
 * move together. The editor's Save payload is composed from the layout preview
 * document plus the scene store document, so both halves are asserted here —
 * a boot that validated in isolation but composed an invalid Save payload
 * would be worse than the legacy boot it replaced.
 */
import { describe, expect, it } from 'vitest';

import { createEmptyWorldLocalSceneDocument } from '$lib/content/scene';
import { createEmptyLayoutDocument, createEmptyWallFirstLayoutDocument } from '$lib/layout/layout-codec';
import {
	createEmptyProject,
	createEmptyWallFirstProject,
	validateProject
} from '$lib/project/project-codec';
import {
	createEmptyLayoutPreviewState,
	createEmptyWallFirstLayoutPreviewState,
	layoutPreviewDocument,
	resetLayoutPreview
} from '$lib/editor/layout/layout-preview-state.svelte';

/** The wall-first Layout discriminator (P23.0a; bumped to 5 by P23.6H). */
const WALL_FIRST_LAYOUT_FORMAT_VERSION = 5;
/** The world-local Scene discriminator (P23.0b). */
const WORLD_LOCAL_SCENE_FORMAT_VERSION = 1;

function formatVersionOf(value: unknown): number | undefined {
	if (typeof value !== 'object' || value === null) return undefined;
	const version = (value as { formatVersion?: unknown }).formatVersion;
	return typeof version === 'number' ? version : undefined;
}

describe('P23.3 new-project boot is wall-first', () => {
	it('composes a wall-first Layout with a world-local Scene that validates', () => {
		const project = createEmptyWallFirstProject({ id: 'project:boot', name: 'Untitled project' });

		expect(formatVersionOf(project.layout)).toBe(WALL_FIRST_LAYOUT_FORMAT_VERSION);
		expect(formatVersionOf(project.scene)).toBe(WORLD_LOCAL_SCENE_FORMAT_VERSION);

		const validation = validateProject(project);
		expect(validation.success).toBe(true);
	});

	it('boots an empty wall-first layout preview with no issues', () => {
		const preview = createEmptyWallFirstLayoutPreviewState();

		expect(preview.source).toBe('empty');
		expect(formatVersionOf(layoutPreviewDocument(preview))).toBe(WALL_FIRST_LAYOUT_FORMAT_VERSION);
		expect(preview.model.rooms).toEqual([]);
		expect(preview.issues).toEqual([]);
		expect(preview.bounds).toBeNull();
	});

	it('validates the composed Save payload for both scene sources', () => {
		const bootProject = createEmptyWallFirstProject({ id: 'project:boot', name: 'Untitled project' });
		const preview = createEmptyWallFirstLayoutPreviewState();

		// EditorApp composes Save from the layout preview document + the scene
		// store document (seeded from the boot project's scene).
		const fromBootScene = validateProject({
			id: bootProject.id,
			name: bootProject.name,
			layout: preview.project.layout,
			scene: bootProject.scene
		});
		expect(fromBootScene.success).toBe(true);

		const fromPreviewScene = validateProject({
			id: bootProject.id,
			name: bootProject.name,
			layout: preview.project.layout,
			scene: preview.project.scene
		});
		expect(fromPreviewScene.success).toBe(true);
	});

	it('keeps a wall-first boot saveable after Reset, and preserves the scene', () => {
		const preview = createEmptyWallFirstLayoutPreviewState();
		const sceneBefore = JSON.stringify(preview.project.scene);

		expect(resetLayoutPreview(preview)).toBe(true);

		expect(formatVersionOf(layoutPreviewDocument(preview))).toBe(WALL_FIRST_LAYOUT_FORMAT_VERSION);
		expect(preview.model.rooms).toEqual([]);
		// Reset is layout-only: the scene survives untouched.
		expect(JSON.stringify(preview.project.scene)).toBe(sceneBefore);

		const validation = validateProject({
			id: 'project:boot',
			name: 'Untitled project',
			layout: preview.project.layout,
			scene: preview.project.scene
		});
		expect(validation.success).toBe(true);
	});

	it('keeps a legacy layout imported into a wall-first session saveable', () => {
		// The Format pairing rule is ONE-directional: a wall-first Layout
		// requires a world-local Scene, while a legacy Layout accepts either.
		// Importing a legacy Layout JSON into a session whose scene is now
		// world-local therefore stays saveable — the legacy read/edit path
		// behind it is what keeps legacy documents loadable.
		const validation = validateProject({
			id: 'project:mixed',
			name: 'Mixed',
			layout: createEmptyLayoutDocument(),
			scene: createEmptyWorldLocalSceneDocument()
		});
		expect(validation.success).toBe(true);

		// The guarded direction still rejects, which is what the boot fixed for
		// the default path.
		const reversed = validateProject({
			id: 'project:mixed',
			name: 'Mixed',
			layout: createEmptyWallFirstLayoutDocument(),
			scene: createEmptyProject({ id: 'x', name: 'x' }).scene
		});
		expect(reversed.success).toBe(false);
	});

	it('leaves the legacy boot and the legacy blank preview untouched', () => {
		const legacyProject = createEmptyProject({ id: 'project:legacy', name: 'Legacy' });
		expect(formatVersionOf(legacyProject.layout)).toBeUndefined();
		expect(formatVersionOf(legacyProject.scene)).toBeUndefined();
		expect(validateProject(legacyProject).success).toBe(true);

		const legacyPreview = createEmptyLayoutPreviewState();
		resetLayoutPreview(legacyPreview);
		expect(formatVersionOf(layoutPreviewDocument(legacyPreview))).toBeUndefined();
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('boot into an empty project', () => {
	it('boots blank: zero navigation nodes, no persisted node, no tour preview', () => {
		const project = createEmptyProject({ id: 'project:blank', name: 'Blank' });
		const store = createEditorStore({
			document: project.scene,
			rooms: createLayoutRoomRegistry(project.layout)
		});

		expect(store.document.navigationNodes).toEqual([]);
		expect(store.document.connections).toEqual([]);
		expect(store.document.entities).toEqual([]);
		expect(store.scene.navigationNodes).toEqual([]);
		expect(store.state.activeNodeId).toBe('');
		expect(store.canStartTourPreview).toBe(false);
	});
	it('locks tour preview until a guided chain exists (zero nodes, lone node, guided)', () => {
		// Zero nodes.
		const empty = createEditorStore({
			document: createEmptyProject({ id: 'p0', name: 'Empty' }).scene,
			rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
		});
		expect(empty.canStartTourPreview).toBe(false);

		// One node that is not part of a guided chain (no next/previous link).
		const lone = cloneFixtureDocument();
		const node = lone.navigationNodes[0]!;
		lone.navigationNodes = [node];
		lone.connections = [];
		node.nextNodeId = undefined;
		node.previousNodeId = undefined;
		node.connectedNodeIds = [];
		expect(createEditorStore({ document: lone, rooms: chopinRuntime.rooms }).canStartTourPreview).toBe(false);

		// A guided chain exists.
		expect(
			createEditorStore({ document: cloneFixtureDocument(), rooms: chopinRuntime.rooms }).canStartTourPreview
		).toBe(true);
	});
	it('reset restores the boot document (not Chopin) and clears history', () => {
		const store = createEditorStore({ document: cloneFixtureDocument(), rooms: chopinRuntime.rooms });
		const bootCanonical = store.canonicalJson;

		expect(store.beginDocumentTransaction()).toBe(true);
		const first = store.document.entities[0]!;
		first.rotation = [
			first.rotation[0],
			first.rotation[1] + 0.001,
			first.rotation[2]
		] as typeof first.rotation;
		expect(store.commitDocumentTransaction()).toBe(true);
		expect(store.canUndo).toBe(true);
		expect(store.isDirty).toBe(true);

		expect(store.resetToCheckedInDocument()).toBe(true);
		expect(store.canonicalJson).toBe(bootCanonical);
		expect(store.canUndo).toBe(false);
		expect(store.isDirty).toBe(false);
	});
	it('authors every node standalone, then unlocks preview once the two-node pair is connected', () => {
		const fixture = cloneFixtureDocument();
		fixture.navigationNodes = [];
		fixture.connections = [];
		const store = createEditorStore({ document: fixture, rooms: chopinRuntime.rooms });

		const roomId = store.rooms.entries[0]!.id;
		const floorWorld = store.rooms.point(roomId, [0, 0, 0]);

		// First node commits standalone as a free node (not in order yet).
		expect(store.beginCameraPlacement()).toBe(true);
		const firstNodeId = store.createPendingNavigationNodeAt(roomId, floorWorld, [0, 0, -1]);

		expect(firstNodeId).not.toBeNull();
		expect(store.document.navigationNodes).toHaveLength(1);
		expect(store.document.connections).toHaveLength(0);
		expect(store.pendingNavigationCommand).toBeNull();
		expect(store.canStartTourPreview).toBe(false); // lone node, no flow

		// Second node also commits standalone — no pending connect step (B0).
		expect(store.beginCameraPlacement()).toBe(true);
		const secondNodeId = store.createPendingNavigationNodeAt(
			roomId,
			store.rooms.point(roomId, [1, 0, 1]),
			[0, 0, -1]
		);
		expect(secondNodeId).not.toBeNull();
		expect(store.document.navigationNodes).toHaveLength(2);
		expect(store.document.connections).toHaveLength(0);
		expect(store.pendingNavigationCommand).toBeNull();

		// Connecting the only two free nodes seeds the open pair first → second
		// in the same transaction, so preview is immediately ready.
		expect(store.selectionActions.selectNavigationNode(firstNodeId!)).toBe(true);
		expect(store.beginConnectExistingNodes()).toBe(true);
		expect(store.selectionActions.selectNavigationNode(secondNodeId!)).toBe(true);
		expect(store.document.connections).toHaveLength(1);
		expect(store.guidedTourNodeIds).toEqual([firstNodeId!, secondNodeId!]);
		expect(store.canStartTourPreview).toBe(true);
	});
});
