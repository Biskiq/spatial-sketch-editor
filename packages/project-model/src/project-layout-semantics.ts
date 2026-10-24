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
 *
 * `LayoutRoomRegistry` survives as the *type* the retained visitor renderer and
 * the retained Camera authoring math take, and
 * `createEmptyLayoutRoomRegistry()` is its current-format value: an empty
 * registry whose room lookups throw. A record that still names a room is
 * therefore a defect rather than a silent second transform.
 *
 * T1.P02.S05 (reader/Camera-reviewed) removed the legacy `LayoutFloor`/`LayoutRoom`
 * references from `LayoutRoomRegistryEntry`. Every behaviour is preserved: the
 * registry is constructed empty, room-keyed lookups refuse, `has`/`get` report
 * absence, and the `undefined`-frame conversions are identity.
 */
import { createCameraPositionPath } from '@portfolio/camera-core';
import type { SceneDocument, Vec3 } from './scene';
import type { ProjectIssue } from './project-types';

const CAMERA_EPSILON = 1e-6;

/**
 * One resolved Room placement.
 *
 * T1.P02.S05 removed the legacy `floor`/`room` document references this entry
 * carried: a wall-first Layout owns no Room frame, so there is nothing to
 * resolve a point through. What survives is exactly what a consumer can read —
 * identity, display name and the world position/rotation the entry would place.
 * The current-format registry is always empty (`createEmptyLayoutRoomRegistry`),
 * so no caller ever observes an entry; the minimal shape keeps the facade's
 * contract without keeping a retired document type alive.
 */
export type LayoutRoomRegistryEntry = {
	id: string;
	name: string;
	position: Vec3;
	rotation: Vec3;
};

export type LayoutRoomRegistry = {
	has(roomId: string): boolean;
	point(roomId: string, localPoint: Vec3): Vec3;
	readonly entries: readonly LayoutRoomRegistryEntry[];
	readonly byId: ReadonlyMap<string, LayoutRoomRegistryEntry>;
	get(roomId: string): LayoutRoomRegistryEntry | undefined;
	getRequired(roomId: string): LayoutRoomRegistryEntry;
	localPoint(roomId: string, worldPoint: Vec3): Vec3;
	/** Present `roomId` is unresolvable; absent `roomId` is the identity frame. */
	pointInFrame(roomId: string | undefined, localPoint: Vec3): Vec3;
	/** Inverse of {@link LayoutRoomRegistry.pointInFrame}. */
	localPointInFrame(roomId: string | undefined, worldPoint: Vec3): Vec3;
};

/**
 * The registry value every current-format document resolves against.
 *
 * A wall-first Layout carries no Room frames, and a world-local Scene carries no
 * `roomId` (reader-enforced), so resolution never consults a frame: room-keyed
 * lookups throw, while the `undefined`-frame helpers stay identity — points are
 * already project/world space and must never be transformed again.
 */
export function createEmptyLayoutRoomRegistry(): LayoutRoomRegistry {
	const byId = new Map<string, LayoutRoomRegistryEntry>();
	const unknownRoom = (roomId: string): never => {
		throw new Error(`Unknown project layout room: ${roomId}`);
	};
	return {
		entries: [],
		byId,
		has: () => false,
		get: () => undefined,
		getRequired: unknownRoom,
		point: (roomId: string): Vec3 => unknownRoom(roomId),
		localPoint: (roomId: string): Vec3 => unknownRoom(roomId),
		pointInFrame: (roomId: string | undefined, localPoint: Vec3): Vec3 => {
			if (roomId !== undefined) unknownRoom(roomId);
			return [...localPoint] as Vec3;
		},
		localPointInFrame: (roomId: string | undefined, worldPoint: Vec3): Vec3 => {
			if (roomId !== undefined) unknownRoom(roomId);
			return [...worldPoint] as Vec3;
		}
	};
}

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
