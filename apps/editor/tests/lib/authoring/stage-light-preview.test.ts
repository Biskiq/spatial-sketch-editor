/**
 * T2 gallery UX recovery — the session-only light preview primitive.
 *
 * The preview is a render input, never a document: merging replaces an accepted
 * light and appends one candidate under a reserved id without mutating the
 * accepted Scene, and clearing returns the exact accepted object.
 */
import { describe, expect, it } from 'vitest';
import type { RuntimeScene, SceneLightEntity } from '@portfolio/project-model';
import {
	createStageLightPreview,
	LIGHT_PREVIEW_CANDIDATE_ID,
	mergeLightPreview
} from '$lib/authoring/stage/stage-light-preview.svelte';

function light(id: string, intensity = Math.PI): SceneLightEntity {
	return {
		kind: 'light',
		light: 'point',
		id,
		name: id,
		color: '#ffffff',
		intensity,
		castShadow: false,
		position: [0, 2, 0],
		rotation: [0, 0, 0]
	};
}

function sceneOf(entities: SceneLightEntity[]): RuntimeScene {
	return {
		textures: [],
		materials: [],
		entities,
		objects: []
	} as unknown as RuntimeScene;
}

describe('StageLightPreview', () => {
	it('returns the accepted Scene when nothing is previewed', () => {
		const scene = sceneOf([light('a')]);
		const preview = createStageLightPreview();
		expect(mergeLightPreview(scene, preview)).toBe(scene);
	});

	it('replaces an overridden light without mutating the accepted Scene', () => {
		const original = light('a');
		const scene = sceneOf([original]);
		const preview = createStageLightPreview();
		const brighter = { ...original, intensity: 4 };
		preview.setOverride('a', brighter);
		const merged = mergeLightPreview(scene, preview);
		expect(merged).not.toBe(scene);
		expect(merged.entities[0]).toEqual(brighter);
		expect(scene.entities[0]).toBe(original);
	});

	it('appends a candidate under one reserved session id', () => {
		const preview = createStageLightPreview();
		preview.setCandidate(light('candidate'));
		const merged = mergeLightPreview(sceneOf([light('a')]), preview);
		expect(merged.entities).toHaveLength(2);
		expect(merged.entities[1]!.id).toBe(LIGHT_PREVIEW_CANDIDATE_ID);
	});

	it('clears overrides and candidate on clear', () => {
		const preview = createStageLightPreview();
		preview.setOverride('a', light('a', 2));
		preview.setCandidate(light('candidate'));
		preview.clear();
		expect(preview.overrides.size).toBe(0);
		expect(preview.candidate).toBeNull();
	});
});
