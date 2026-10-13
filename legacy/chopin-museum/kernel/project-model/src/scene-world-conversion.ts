/**
 * `scene-world-conversion.ts` — P23.0b legacy Scene → world-local conversion.
 *
 * Resolves every room-local physical value through the **trusted legacy Room
 * frames** (H5 provenance contract) and returns the new world-local Scene
 * document shape: entities/nodes/clusters/waypoints/keyframes lose `roomId`,
 * positions/targets become world coordinates, and rotations compose through
 * the actual legacy room-frame matrix (`M = R_room · R_local`) decomposed
 * back to XYZ Euler — never an assumed `yaw += roomYaw` (the pure-yaw
 * identity that shortcut relies on is proven in the migration-math tests).
 *
 * Records already stored without `roomId` remain byte-equivalent in spatial
 * meaning (they were already world-local; no second Room transform is
 * applied).
 *
 * The caller MUST pass the registry built from the *same decoded legacy
 * Project snapshot* as the scene (H5 provenance rule 1). A library seam
 * cannot prove cross-project frame trust; `decodeProjectCompatible` enforces
 * the pairing by construction.
 */
import type {
	SceneCameraViewKeyframe,
	SceneConnection,
	SceneDocument,
	SceneEntity,
	SceneNavigationNode,
	SceneObjectCluster,
	ScenePositionPath,
	SceneWaypoint
} from './scene';
import type { LayoutRoomRegistry } from './project-layout-semantics';
import { migrateEntityTransform } from '@portfolio/layout-core';

/** Non-spatial cluster fields preserved verbatim; `roomId` dropped. */
function stripClusterRoom(cluster: SceneObjectCluster): SceneObjectCluster {
	const next: SceneObjectCluster = { ...cluster };
	delete (next as Partial<SceneObjectCluster>).roomId;
	return next;
}

function convertEntity(entity: SceneEntity, registry: LayoutRoomRegistry): SceneEntity {
	if (!entity.roomId) {
		// Already world-local spatially; absence of roomId *is* the world-local
		// marker in the new shape, so the key is removed, not kept undefined.
		const next = { ...entity } as SceneEntity;
		delete (next as Partial<SceneEntity>).roomId;
		return next;
	}
	const entry = registry.getRequired(entity.roomId);
	const { position, rotation } = migrateEntityTransform(
		{ position: entity.position, rotation: entity.rotation },
		{
			origin: [entry.room.frame.origin[0], entry.room.frame.origin[1]] as const,
			yaw: entry.room.frame.yaw,
			floorElevation: entry.floor.elevation
		}
	);
	const next = { ...entity, position, rotation } as SceneEntity;
	delete (next as Partial<SceneEntity>).roomId;
	return next;
}

function convertWaypoint(waypoint: SceneWaypoint, registry: LayoutRoomRegistry): SceneWaypoint {
	if (!waypoint.roomId) return { position: [...waypoint.position] };
	return { position: registry.point(waypoint.roomId, waypoint.position) };
}

function convertNode(node: SceneNavigationNode, registry: LayoutRoomRegistry): SceneNavigationNode {
	if (!node.roomId) {
		const next = { ...node };
		delete (next as Partial<SceneNavigationNode>).roomId;
		return next;
	}
	const next = {
		...node,
		position: registry.point(node.roomId, node.position),
		cameraTarget: registry.point(node.roomId, node.cameraTarget)
	};
	delete (next as Partial<SceneNavigationNode>).roomId;
	return next;
}

function convertKeyframe(
	keyframe: SceneCameraViewKeyframe,
	registry: LayoutRoomRegistry
): SceneCameraViewKeyframe {
	if (!keyframe.roomId) {
		return { ...keyframe, cameraTarget: [...keyframe.cameraTarget] };
	}
	const next = {
		...keyframe,
		cameraTarget: registry.point(keyframe.roomId, keyframe.cameraTarget)
	};
	delete (next as Partial<SceneCameraViewKeyframe>).roomId;
	return next;
}

function convertPositionPath(path: ScenePositionPath, registry: LayoutRoomRegistry): ScenePositionPath {
	return {
		kind: path.kind,
		anchors: path.anchors.map((anchor) => ({
			id: anchor.id,
			...convertWaypoint(anchor, registry)
		}))
	};
}

function convertConnection(connection: SceneConnection, registry: LayoutRoomRegistry): SceneConnection {
	const next: SceneConnection = {
		...connection,
		positionPath: convertPositionPath(connection.positionPath, registry)
	};
	if (connection.targetWaypoints) {
		next.targetWaypoints = connection.targetWaypoints.map((waypoint) =>
			convertWaypoint(waypoint, registry)
		);
	}
	if (connection.viewTracks) {
		next.viewTracks = {
			forward: connection.viewTracks.forward.map((keyframe) => convertKeyframe(keyframe, registry)),
			reverse: connection.viewTracks.reverse.map((keyframe) => convertKeyframe(keyframe, registry)),
			...(connection.viewTracks.framingEnvelope
				? { framingEnvelope: { ...connection.viewTracks.framingEnvelope } }
				: {})
		};
	}
	return next;
}

/**
 * Convert a recognized-legacy Scene document to the world-local shape.
 *
 * Physical values resolve exactly once through the trusted legacy Room
 * frames; identity/asset/material/light semantics are preserved verbatim;
 * the output carries `formatVersion: 1`.
 */
export function convertSceneDocumentToWorldLocal(
	document: SceneDocument,
	registry: LayoutRoomRegistry
): SceneDocument {
	return {
		formatVersion: 1,
		textures: document.textures.map((texture) => ({ ...texture })),
		materials: document.materials.map((material) => ({ ...material })),
		entities: document.entities.map((entity) => convertEntity(entity, registry)),
		...(document.clusters
			? { clusters: document.clusters.map((cluster) => stripClusterRoom(cluster)) }
			: {}),
		navigationNodes: document.navigationNodes.map((node) => convertNode(node, registry)),
		connections: document.connections.map((connection) => convertConnection(connection, registry))
	};
}
