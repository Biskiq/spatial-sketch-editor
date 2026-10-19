/**
 * Visitor Camera handoff — the Experience interpreter chooses the invocation,
 * the Camera authority evaluates it (AM-9).
 *
 * A Travel names one authored connection. This resolver uses that connection and
 * its direction; it never substitutes `getCameraRoute`'s shortest graph path,
 * which could pick a different connection between the same two Views. A missing
 * or mismatched connection is a typed gap the caller can surface, not a silent
 * re-route.
 *
 * A Travel can also overtake the motion that is still realizing the previous
 * Stop: an authored hold is editorial time and may expire before the Camera has
 * physically reached that Stop's View. The Experience has then left the View it
 * was travelling to, so the next connection's declared origin is authoritative.
 * The caller names that in-flight View explicitly (`handoffFromViewId`); this
 * resolver accepts the connection only when it joins **that** View to the
 * requested destination, and reports the origin it actually used. It never
 * accepts an arbitrary endpoint, finishes the stale Travel first, or pathfinds.
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
			/**
			 * The View the route actually starts from: the settled View, or the
			 * in-flight View a declared handoff overtook.
			 */
			readonly originViewId: string;
	  }
	| { readonly kind: 'gap'; readonly reason: string };

export function resolveVisitorCameraRoute({
	fromViewId,
	toViewId,
	invocation,
	graph,
	handoffFromViewId = null
}: {
	readonly fromViewId: string;
	readonly toViewId: string;
	readonly invocation: ProgramInvocation;
	readonly graph: CameraGraph;
	/** The View a still-in-flight Travel was realizing, when one is in flight. */
	readonly handoffFromViewId?: string | null;
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
			// The normal case: the authored connection leaves the Camera's settled
			// View. The handoff case: the Experience has already left that View and
			// declared the View its unfinished Travel was realizing as the
			// predecessor, so only that declared origin is admissible. A connection
			// that still leaves the earlier settled View is not the declared
			// handoff: accepting it would realize an editorial transition the
			// Experience never requested. Any other endpoint pairing is a genuine
			// gap.
			const origins = handoffFromViewId !== null && handoffFromViewId !== fromViewId
				? [handoffFromViewId]
				: [fromViewId];
			for (const origin of origins) {
				let direction: CameraConnectionDirection;
				if (connection.fromNodeId === origin && connection.toNodeId === toViewId) {
					direction = 'forward';
				} else if (connection.fromNodeId === toViewId && connection.toNodeId === origin) {
					direction = 'reverse';
				} else {
					continue;
				}
				return {
					kind: 'route',
					route: getCameraConnectionRoute(connection.id, direction, graph),
					connectionId: connection.id,
					originViewId: origin
				};
			}
			const expectedOrigin = origins[0];
			return {
				kind: 'gap',
				reason: `Camera connection "${connection.id}" does not join "${expectedOrigin}" to "${toViewId}".`
			};
		}
		return {
			kind: 'route',
			route: getCameraRoute(fromViewId, toViewId, graph),
			connectionId: null,
			originViewId: fromViewId
		};
	} catch (error) {
		return {
			kind: 'gap',
			reason: error instanceof Error ? error.message : 'The Camera route is unavailable.'
		};
	}
}
