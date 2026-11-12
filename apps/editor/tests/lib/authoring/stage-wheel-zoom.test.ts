import { describe, expect, it, vi } from 'vitest';
import { createViewportCameraState, evaluateViewport } from '@portfolio/camera-core';
import type { RuntimeScene } from '@portfolio/project-model';
import type { SceneRenderedHit } from '$lib/authoring/scene/scene-pick-source';
import { stageWheelZoom } from '$lib/authoring/stage/stage-wheel-zoom';

const rect = { left: 0, top: 0, width: 800, height: 600, devicePixelRatio: 1 };
const css = [400, 300] as const;
const scene = { entities: [{ id: 'print', kind: 'artwork' }, { id: 'plinth', kind: 'box' }] } as RuntimeScene;
const zoom = { kind: 'zoom', scale: 0.8 };
const wall: SceneRenderedHit = { entityId: null, kind: 'layout', wallId: 'wall', worldPoint: [0, 1.5, -2], distanceMeters: 4 };

function evaluation(reading: '3d' | 'plan') {
	const state = createViewportCameraState({
		outputId: 'stage', sessionEpoch: 'session', sourceRevision: 'revision', reading,
		sceneRadiusMeters: 10,
		pose: { target: [0, 1.5, 0], azimuthRadians: 0, elevationRadians: 0, targetPlaneHeightMeters: 2 }
	});
	const result = evaluateViewport(state, rect, 0, 1);
	if (result.kind !== 'evaluated') throw new Error('Stage viewport did not evaluate');
	return result.evaluation;
}

describe('Stage wheel zoom', () => {
	it('uses the nearest drawn Artwork or Wall and respects ineligible occluders', () => {
		const view = evaluation('3d');
		const artwork: SceneRenderedHit = {
			kind: 'entity', entityId: 'print', worldPoint: [0, 1.5, -1.998], distanceMeters: 3.998
		};
		expect(stageWheelZoom(0.8, css, view, scene, () => wall)).toEqual({ ...zoom, anchor: wall.worldPoint });
		expect(stageWheelZoom(0.8, css, view, scene, () => artwork)).toEqual({ ...zoom, anchor: artwork.worldPoint });
		const pick = vi.fn(() => ({ ...artwork, entityId: 'plinth', distanceMeters: 3 }));
		expect(stageWheelZoom(0.8, css, view, scene, pick)).toEqual(zoom);
		expect(pick).toHaveBeenCalledOnce();
	});

	it('uses ordinary zoom for Plan, absent evaluations and missed surfaces', () => {
		const pick = vi.fn(() => null);
		expect(stageWheelZoom(0.8, css, evaluation('plan'), scene, pick)).toEqual(zoom);
		expect(stageWheelZoom(0.8, css, null, scene, pick)).toEqual(zoom);
		expect(pick).not.toHaveBeenCalled();
		expect(stageWheelZoom(0.8, css, evaluation('3d'), scene, pick)).toEqual(zoom);
		expect(pick).toHaveBeenCalledOnce();
	});
});
