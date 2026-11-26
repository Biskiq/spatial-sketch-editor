/**
 * `cloneResolvedCameraRoute` — deep-clone a resolved camera route so the
 * editor never mutates the checked-in graph / motion capture.
 *
 * `cloneRoutePoint` copies one route point, tuple or object form, into a fresh
 * tuple.
 */
import type { Vector3Like } from '@portfolio/camera-core/camera';
import type { ResolvedCameraRoute } from '@portfolio/camera-core/camera';
import type { Vec3 } from '$lib/types/scene';

/** Tuple check — `Vector3Like` is either `{x,y,z}` or `[x,y,z]`. */
export function isRoutePointTuple(point: Vector3Like): point is readonly [number, number, number] {
	return Array.isArray(point);
}

/** Materialize any `Vector3Like` into a 3-tuple (deep-clone safe). */
export function cloneRoutePoint(point: Vector3Like): Vec3 {
	return isRoutePointTuple(point) ? [point[0], point[1], point[2]] : [point.x, point.y, point.z];
}

export function cloneResolvedCameraRoute(route: ResolvedCameraRoute): ResolvedCameraRoute {
	return {
		positionParts: route.positionParts.map((part) =>
			part.kind === 'rounded-polyline'
				? {
						kind: part.kind,
						points: part.points.map(cloneRoutePoint),
						...(part.clearance === undefined ? {} : { clearance: part.clearance }),
					}
				: {
						kind: part.kind,
						anchors: part.anchors.map(cloneRoutePoint),
					},
		),
		targetPoints: route.targetPoints.map(cloneRoutePoint),
		...(route.startFov === undefined ? {} : { startFov: route.startFov }),
		...(route.endFov === undefined ? {} : { endFov: route.endFov }),
		nodeIds: [...route.nodeIds],
		edges: route.edges.map((edge) => ({
			connectionId: edge.connectionId,
			direction: edge.direction,
			fromNodeId: edge.fromNodeId,
			toNodeId: edge.toNodeId,
			positionSpan: {
				start: { ...edge.positionSpan.start },
				end: { ...edge.positionSpan.end },
			},
			...(edge.viewTrack === undefined
				? {}
				: {
						viewTrack: {
							start: {
								cameraTarget: cloneRoutePoint(edge.viewTrack.start.cameraTarget),
								fov: edge.viewTrack.start.fov,
							},
							keyframes: edge.viewTrack.keyframes.map((keyframe) => ({
								id: keyframe.id,
								progress: keyframe.progress,
								cameraTarget: cloneRoutePoint(keyframe.cameraTarget),
								fov: keyframe.fov,
							})),
							end: {
								cameraTarget: cloneRoutePoint(edge.viewTrack.end.cameraTarget),
								fov: edge.viewTrack.end.fov,
							},
							...(edge.viewTrack.framingEnvelope === undefined
								? {}
								: { framingEnvelope: { ...edge.viewTrack.framingEnvelope } }),
						},
					}),
			...(edge.automaticTargetPoints === undefined
				? {}
				: {
						automaticTargetPoints: edge.automaticTargetPoints.map(cloneRoutePoint),
					}),
		})),
	};
}
