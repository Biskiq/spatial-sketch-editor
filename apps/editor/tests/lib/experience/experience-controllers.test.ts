/**
 * Guided, free and reduced-motion controllers (T3.P01.S06).
 *
 * The controllers emit Camera intents only: travel geometry and directed timing
 * come from camera-core's route/motion authority, a missing connection is a
 * reported gap, free rejoin evaluates from the actual pose with autoplay paused,
 * and reduced motion reaches the same View without accelerated travel.
 */
import { describe, expect, it } from 'vitest';

import {
	createFreeController,
	createGuidedController,
	createReducedMotionController,
	type CameraGraph,
	type ExperienceControlProgram
} from '@portfolio/camera-core';
import { CONNECTIONS, VIEWS } from './fixtures';

const NODES = VIEWS.map((view) => ({
	id: view.id,
	label: view.label,
	position: [...view.eye] as [number, number, number],
	cameraTarget: [...view.target] as [number, number, number],
	fov: view.fov,
	connectedNodeIds: [...view.connectedViewIds]
}));

const GRAPH: CameraGraph = {
	navigationNodes: NODES,
	// The F.2 Camera payload and camera-core's structural graph describe the same
	// connection; the fixture's arrays are widened F.2 arrays, and this test proves
	// controller behavior rather than re-typing that shared encoding.
	connections: CONNECTIONS as unknown as CameraGraph['connections'],
	nodeById: new Map(NODES.map((node) => [node.id, node]))
};

const PROGRAM: ExperienceControlProgram = {
	stops: [
		{ stopId: 'stop-1', viewId: 'view-1', invocation: { kind: 'cut', viewId: 'view-1' }, holdSeconds: 0.5 },
		{ stopId: 'stop-2', viewId: 'view-2', invocation: { kind: 'travel', connectionId: 'connection-1' }, holdSeconds: null }
	]
};

describe('guided controller', () => {
	it('realizes a supported Travel through the Camera route and directed timing', () => {
		const guided = createGuidedController(PROGRAM, GRAPH);
		const intent = guided.intentFor('stop-2');
		expect(intent.kind).toBe('travel');
		if (intent.kind !== 'travel') return;
		expect(intent.direction).toBe('forward');
		expect(intent.route.nodeIds).toEqual(['view-1', 'view-2']);
		expect(intent.motionOptions).toEqual({ durationSeconds: 4, easing: 'smoothstep' });
	});

	it('reports a gap instead of cutting when the required connection is absent', () => {
		const broken: ExperienceControlProgram = {
			stops: PROGRAM.stops.map((stop) =>
				stop.stopId === 'stop-2'
					? { ...stop, invocation: { kind: 'travel' as const, connectionId: 'connection-absent' } }
					: stop
			)
		};
		const intent = createGuidedController(broken, GRAPH).intentFor('stop-2');
		expect(intent).toMatchObject({ kind: 'gap', stopId: 'stop-2', fromViewId: 'view-1', toViewId: 'view-2' });
	});

	it('realizes a Cut without a route', () => {
		const intent = createGuidedController(PROGRAM, GRAPH).intentFor('stop-1');
		expect(intent).toMatchObject({ kind: 'cut', viewId: 'view-1', route: null, motionOptions: null });
	});
});

describe('free and reduced-motion controllers', () => {
	it('rejoins from the actual pose with autoplay paused', () => {
		const free = createFreeController(PROGRAM);
		const pose = { position: [1, 1.7, 3] as [number, number, number], target: [1, 1.4, 0] as [number, number, number], fov: 54 };
		expect(free.rejoin('stop-2', pose)).toMatchObject({
			kind: 'cut',
			viewId: 'view-2',
			fromPose: pose,
			autoplay: 'paused',
			ownership: 'free-navigation'
		});
		expect(free.rejoin('stop-absent', pose)).toBeNull();
	});

	it('reaches the same destination by Cut without accelerated travel', () => {
		const reduced = createReducedMotionController(PROGRAM);
		expect(reduced.travel).toBe('disabled');
		expect(reduced.intentFor('stop-2')).toEqual({
			kind: 'cut',
			stopId: 'stop-2',
			viewId: 'view-2',
			reducedMotion: true
		});
	});
});
