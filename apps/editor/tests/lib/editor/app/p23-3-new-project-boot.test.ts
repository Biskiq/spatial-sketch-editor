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
