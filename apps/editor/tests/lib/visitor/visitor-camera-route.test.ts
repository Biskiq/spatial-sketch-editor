import { describe, expect, it } from 'vitest';
import type { CameraGraph, CameraGraphConnection, CameraGraphNode } from '@portfolio/camera-core';
import { resolveVisitorCameraRoute } from '$lib/visitor/visitor-camera-route';

const NODES: CameraGraphNode[] = [
	{
		id: 'view-a',
		label: 'A',
		position: [0, 1.6, 0],
		cameraTarget: [0, 1.6, -1],
		fov: 54,
		connectedNodeIds: ['view-b']
	},
	{
		id: 'view-b',
		label: 'B',
		position: [4, 1.6, 0],
		cameraTarget: [4, 1.6, -1],
		fov: 54,
		connectedNodeIds: ['view-a']
	}
];

function connection(id: string, fromNodeId: string, toNodeId: string): CameraGraphConnection {
	return {
		id,
		fromNodeId,
		toNodeId,
		positionPath: {
			kind: 'rounded-polyline',
			anchors: [
				{ id: `${id}-start`, position: [0, 1.6, 0] },
				{ id: `${id}-end`, position: [4, 1.6, 0] }
			]
		},
		clearance: 1.2
	};
}

function graph(): CameraGraph {
	return {
		navigationNodes: NODES,
		connections: [
			connection('connection-1', 'view-a', 'view-b'),
			connection('connection-2', 'view-a', 'view-b')
		],
		nodeById: new Map(NODES.map((node) => [node.id, node]))
	};
}

describe('visitor Camera handoff', () => {
	it('uses the Travel’s exact authored connection instead of a shortest path', () => {
		const resolved = resolveVisitorCameraRoute({
			fromViewId: 'view-a',
			toViewId: 'view-b',
			invocation: { kind: 'travel', connectionId: 'connection-2' },
			graph: graph()
		});
		expect(resolved.kind).toBe('route');
		if (resolved.kind !== 'route') return;
		expect(resolved.connectionId).toBe('connection-2');
		expect(resolved.route.edges).toEqual([
			expect.objectContaining({ connectionId: 'connection-2', direction: 'forward' })
		]);
	});

	it('reverses the same connection when the authored Travel runs B to A', () => {
		const resolved = resolveVisitorCameraRoute({
			fromViewId: 'view-b',
			toViewId: 'view-a',
			invocation: { kind: 'travel', connectionId: 'connection-2' },
			graph: graph()
		});
		expect(resolved.kind).toBe('route');
		if (resolved.kind !== 'route') return;
		expect(resolved.route.edges).toEqual([
			expect.objectContaining({ connectionId: 'connection-2', direction: 'reverse' })
		]);
	});

	it('returns a typed gap for a missing connection or a mismatched endpoint', () => {
		const missing = resolveVisitorCameraRoute({
			fromViewId: 'view-a',
			toViewId: 'view-b',
			invocation: { kind: 'travel', connectionId: 'connection-absent' },
			graph: graph()
		});
		expect(missing.kind).toBe('gap');
		if (missing.kind === 'gap') expect(missing.reason).toContain('connection-absent');

		const mismatched = resolveVisitorCameraRoute({
			fromViewId: 'view-b',
			toViewId: 'view-a',
			invocation: { kind: 'travel', connectionId: 'connection-1' },
			graph: {
				...graph(),
				connections: [connection('connection-1', 'view-a', 'view-a')]
			}
		});
		expect(mismatched.kind).toBe('gap');
		if (mismatched.kind === 'gap') expect(mismatched.reason).toContain('does not join');
	});

	it('keeps a Cut on the general route evaluator', () => {
		const resolved = resolveVisitorCameraRoute({
			fromViewId: 'view-a',
			toViewId: 'view-b',
			invocation: { kind: 'cut', viewId: 'view-b' },
			graph: graph()
		});
		expect(resolved.kind).toBe('route');
		if (resolved.kind !== 'route') return;
		expect(resolved.connectionId).toBeNull();
		expect(resolved.route.nodeIds).toEqual(['view-a', 'view-b']);
	});
});
