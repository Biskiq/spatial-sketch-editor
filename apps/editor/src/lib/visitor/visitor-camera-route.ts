/**
 * Visitor Camera handoff — the Experience interpreter chooses the invocation,
 * the Camera authority evaluates it (AM-9).
 *
 * A Travel names one authored connection. This resolver uses that connection and
 * its direction; it never substitutes `getCameraRoute`'s shortest graph path,
 * which could pick a different connection between the same two Views. A missing
 * or mismatched connection is a typed gap the caller can surface, not a silent
 * re-route.
 */
import {
	getCameraConnectionRoute,
	getCameraRoute,
	type CameraConnectionDirection,
	type CameraGraph,
	type ResolvedCameraRoute
} from '@portfolio/camera-core';
import type { ProgramInvocation } from '@portfolio/project-model/units';

export type VisitorCameraRoute =
	| {
			readonly kind: 'route';
			readonly route: ResolvedCameraRoute;
			/** The exact connection a Travel realized, or `null` for a Cut/route fallback. */
			readonly connectionId: string | null;
	  }
	| { readonly kind: 'gap'; readonly reason: string };

export function resolveVisitorCameraRoute({
	fromViewId,
	toViewId,
	invocation,
	graph
}: {
	readonly fromViewId: string;
	readonly toViewId: string;
	readonly invocation: ProgramInvocation;
	readonly graph: CameraGraph;
}): VisitorCameraRoute {
	try {
		if (invocation.kind === 'travel') {
			const connection = graph.connections.find((candidate) => candidate.id === invocation.connectionId);
			if (!connection) {
				return {
					kind: 'gap',
					reason: `The program requested Camera connection "${invocation.connectionId}", which this graph does not carry.`
				};
			}
			let direction: CameraConnectionDirection;
			if (connection.fromNodeId === fromViewId && connection.toNodeId === toViewId) {
				direction = 'forward';
			} else if (connection.fromNodeId === toViewId && connection.toNodeId === fromViewId) {
				direction = 'reverse';
			} else {
				return {
					kind: 'gap',
					reason: `Camera connection "${connection.id}" does not join "${fromViewId}" to "${toViewId}".`
				};
			}
			return {
				kind: 'route',
				route: getCameraConnectionRoute(connection.id, direction, graph),
				connectionId: connection.id
			};
		}
		return {
			kind: 'route',
			route: getCameraRoute(fromViewId, toViewId, graph),
			connectionId: null
		};
	} catch (error) {
		return {
			kind: 'gap',
			reason: error instanceof Error ? error.message : 'The Camera route is unavailable.'
		};
	}
}
