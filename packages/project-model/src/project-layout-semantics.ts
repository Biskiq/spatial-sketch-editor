/**
 * `project-layout-semantics.ts` — project-level Scene semantics.
 *
 * PR #115 (WP3) — current-format-only. There is exactly one supported document
 * pair (wall-first Layout + world-local Scene), so there is no Room registry to
 * build and no cross-document room-reference gate to run: the Scene reader
 * already rejects any `roomId`, which is what made a registry necessary.
 *
 * What remains is the one project-level rule the codec cannot express on its
 * own: an authored camera view keyframe must not sit on top of the eye position
 * the connection's own path produces for it.
 */
import { createCameraPositionPath } from '@portfolio/camera-core';
import type { SceneDocument, Vec3 } from './scene';
import type { ProjectIssue } from './project-types';

const CAMERA_EPSILON = 1e-6;

/**
 * Reject a camera view keyframe whose authored target coincides with the eye
 * position its own connection path produces at that progress. Runs on an
 * already-validated current-format document; positions are project/world space.
 */
export function validateProjectSceneCameraPoses(scene: SceneDocument): ProjectIssue[] {
	const issues: ProjectIssue[] = [];
	const nodeById = new Map(scene.navigationNodes.map((node) => [node.id, node]));
	for (const [connectionIndex, connection] of scene.connections.entries()) {
		if (!connection.viewTracks) continue;
		const fromNode = nodeById.get(connection.fromNodeId);
		const toNode = nodeById.get(connection.toNodeId);
		if (!fromNode || !toNode) continue;
		const anchors: Vec3[] = [
			[...fromNode.position] as Vec3,
			...connection.positionPath.anchors.map((anchor) => [...anchor.position] as Vec3),
			[...toNode.position] as Vec3
		];
		const positionPath = createCameraPositionPath([
			connection.positionPath.kind === 'rounded-polyline'
				? { kind: 'rounded-polyline', points: anchors, clearance: connection.clearance }
				: { kind: 'auto-bezier', anchors }
		]);
		for (const direction of ['forward', 'reverse'] as const) {
			for (const [keyframeIndex, keyframe] of connection.viewTracks[direction].entries()) {
				const eye = positionPath.getPointAt(
					direction === 'forward' ? keyframe.progress : 1 - keyframe.progress
				);
				const target = keyframe.cameraTarget;
				if (
					Math.hypot(eye.x - target[0], eye.y - target[1], eye.z - target[2]) <=
					CAMERA_EPSILON
				) {
					issues.push({
						path: `$.scene.connections[${connectionIndex}].viewTracks.${direction}[${keyframeIndex}].cameraTarget`,
						code: 'camera_target_too_close',
						message: `Camera eye and target must be farther than ${CAMERA_EPSILON}`
					});
				}
			}
		}
	}
	return issues;
}
