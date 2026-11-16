import { expect, it } from 'vitest';
import { createViewportCameraState, evaluateViewport, type Vec3 } from '@portfolio/camera-core';
import { skyFromPreset } from '@portfolio/project-model/units';
import { celestialDialModel, dialProject, dialRing, dialStagePoint, nearestT, placeCelestialDial } from '$lib/authoring/look/celestial-dial';
import { skyBodyAt } from '$lib/render/sky-time';

const rect = { left: 0, top: 0, width: 1440, height: 900, devicePixelRatio: 1 };
const origin: Vec3 = [0, 0, 0];
const clear = () => false;
const onFloor = () => true;

function camera(radius = 10) {
	const state = createViewportCameraState({
		outputId: 'stage', sessionEpoch: 'session', sourceRevision: 'revision', reading: '3d',
		sceneRadiusMeters: radius,
		pose: { target: origin, azimuthRadians: 0, elevationRadians: Math.PI / 3, targetPlaneHeightMeters: radius }
	});
	const result = evaluateViewport(state, rect, 0, 1);
	if (result.kind !== 'evaluated') throw new Error('Expected a viewport evaluation');
	return result.evaluation;
}

it('keeps its screen radius across camera distances and relocates a blocked anchor', () => {
	for (const view of [camera(10), camera(20)]) {
		const dial = placeCelestialDial(origin, view, [], clear, onFloor)!;
		const center = dialProject(dial.anchor, view)!;
		const east = dialProject(dialRing(dial, 90), view)!;
		expect(Math.abs(east[0] - center[0])).toBeCloseTo(72, 1);
	}
	const moved = placeCelestialDial(origin, camera(), [], ([x, , z]) => Math.hypot(x, z) < 0.31, onFloor)!;
	expect(Math.hypot(moved.anchor[0], moved.anchor[2])).toBeCloseTo(Math.hypot(0.3, 0.3));
	expect(placeCelestialDial(origin, camera(), [{ left: 0, top: 0, right: 1440, bottom: 900 }], clear, onFloor)).toBeNull();
	expect(placeCelestialDial([999, 0, 999], camera(), [], clear, onFloor)).toBeNull();
});

it('places the shadow opposite the body, clamps its length, and follows the held phase', () => {
	const view = camera();
	const placement = placeCelestialDial(origin, view, [], clear, onFloor)!;
	const sky = { ...skyFromPreset('daylight', 140), time: 6.5 };
	const dial = celestialDialModel(sky, placement);
	expect(dial.glyph).toEqual(dialRing(placement, 50));
	expect(dial.shadow).toEqual(dialRing(placement, 230, 64));
	const sunset = dialProject(dialRing(placement, 230), view)!;
	expect(nearestT(sunset, 12, 'day', 'glyph', placement, view, sky)).toBe(19.5);
	const midMoon = skyBodyAt(0.75, sky.heading, sky.arcHeight);
	const moonPoint = dialProject(dialRing(placement, midMoon.az), view)!;
	expect(nearestT(moonPoint, 23.75, 'night', 'glyph', placement, view, sky)).toBe(0.75);
	expect(celestialDialModel({ ...sky, time: 20 }, placement).shadow).toBeNull();
});

it('draws and maps the dial in the stage-local frame of the overlay and pointer intents', () => {
	const state = createViewportCameraState({
		outputId: 'stage', sessionEpoch: 'session', sourceRevision: 'revision', reading: '3d', sceneRadiusMeters: 10,
		pose: { target: origin, azimuthRadians: 0, elevationRadians: Math.PI / 3, targetPlaneHeightMeters: 10 }
	});
	const result = evaluateViewport(state, { left: 12, top: 44, width: 1440, height: 856, devicePixelRatio: 1 }, 0, 1);
	if (result.kind !== 'evaluated') throw new Error('Expected a viewport evaluation');
	const point: Vec3 = [0.5, 0, -0.25];
	const viewport = dialProject(point, result.evaluation)!;
	expect(dialStagePoint(point, result.evaluation)).toEqual([viewport[0] - 12, viewport[1] - 44]);
	// The time grip resolves a stage-local pointer against the stage-local arc.
	const sky = skyFromPreset('daylight', 0);
	const placement = placeCelestialDial(origin, result.evaluation, [], clear, onFloor)!;
	const sunset = dialStagePoint(dialRing(placement, skyBodyAt(19.5, sky.heading, sky.arcHeight).az), result.evaluation)!;
	expect(nearestT(sunset, 12, 'day', 'glyph', placement, result.evaluation, sky)).toBe(19.5);
});

it('tests shell obstacles in the client frame of the dial projection', () => {
	// The route passes client rects; a stage-local obstacle would sit one header
	// height above the dial it should block (independent review, 2026-11-16).
	const state = createViewportCameraState({
		outputId: 'stage', sessionEpoch: 'session', sourceRevision: 'revision', reading: '3d', sceneRadiusMeters: 10,
		pose: { target: origin, azimuthRadians: 0, elevationRadians: Math.PI / 3, targetPlaneHeightMeters: 10 }
	});
	const result = evaluateViewport(state, { left: 12, top: 44, width: 1440, height: 856, devicePixelRatio: 1 }, 0, 1);
	if (result.kind !== 'evaluated') throw new Error('Expected a viewport evaluation');
	const free = placeCelestialDial(origin, result.evaluation, [], clear, onFloor)!;
	const ring = Array.from({ length: 48 }, (_, index) => dialProject(dialRing(free, index * 7.5, 72 * 1.2), result.evaluation)!);
	const box = {
		left: Math.min(...ring.map(([x]) => x)), right: Math.max(...ring.map(([x]) => x)),
		top: Math.min(...ring.map(([, y]) => y)), bottom: Math.max(...ring.map(([, y]) => y))
	};
	const blocked = placeCelestialDial(origin, result.evaluation, [box], clear, onFloor);
	expect(blocked?.anchor).not.toEqual(free.anchor);
});
