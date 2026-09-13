import {
  SceneDocumentValidationError,
  validateSceneDocument
} from './scene-codec';
import type { SceneValidationOptions } from './scene-validation';

export type Vec3 = [number, number, number];
export type RoomId = string;
export type AssetId = string;
export type MaterialId =
  | 'plaster-warm'
  | 'wood-walnut'
  | 'brass-aged'
  | 'marble-light'
  | 'velvet-dark'
  | 'paper-aged';
export type SceneObjectFallback =
  | 'piano'
  | 'chair'
  | 'sofa'
  | 'table'
  | 'chandelier'
  | 'desk'
  | 'lamp'
  | 'frame'
  | 'books'
  | 'clock'
  | 'rug';

export type CameraConnectionDirection = 'forward' | 'reverse';
export type CameraEasing =
  | 'linear'
  | 'smoothstep'
  | 'smootherstep'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out';

export const CAMERA_FOV = { min: 10, max: 120, default: 54 } as const;
export const CAMERA_EASING: readonly CameraEasing[] = [
  'linear',
  'smoothstep',
  'smootherstep',
  'ease-in',
  'ease-out',
  'ease-in-out'
] as const;

export type NavigationNodeData = {
  id: string;
  /**
   * Room ownership is legacy-room-local machinery. World-local (P23.0b
   * migrated) documents leave it absent; absent means `position` and
   * `cameraTarget` are already project/world coordinates and must never be
   * resolved through a Room frame again.
   */
  roomId?: string;
  label: string;
  position: Vec3;
  cameraTarget: Vec3;
  fov: number;
  connectedNodeIds: string[];
  nextNodeId?: string;
  previousNodeId?: string;
  detourOfNodeId?: string;
  lockInteraction?: boolean;
  holdSeconds?: number;
};

export type RuntimeCameraViewKeyframe = {
  id: string;
  progress: number;
  cameraTarget: Vec3;
  fov: number;
  holdSeconds?: number;
  easing?: CameraEasing;
};

export type RuntimeCameraFramingEnvelope = {
  enterStart: number;
  enterEnd: number;
  exitStart: number;
  exitEnd: number;
};

export type RuntimeConnectionViewTracks = Record<
  CameraConnectionDirection,
  RuntimeCameraViewKeyframe[]
> & {
  framingEnvelope?: Partial<
    Record<CameraConnectionDirection, RuntimeCameraFramingEnvelope>
  >;
};

export type RuntimePathAnchor = { id: string; position: Vec3 };

export type RuntimePositionPath =
  | { kind: 'rounded-polyline'; anchors: RuntimePathAnchor[] }
  | { kind: 'auto-bezier'; anchors: RuntimePathAnchor[] };

export type SceneConnectionTiming = {
  durationSeconds?: number;
  easing?: CameraEasing;
};

export type SceneViewKeyframeTiming = {
  holdSeconds?: number;
  easing?: CameraEasing;
};

export type RuntimeConnection = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  positionPath: RuntimePositionPath;
  viewTracks?: RuntimeConnectionViewTracks;
  targetWaypoints?: Vec3[];
  clearance: number;
  timing?: {
    forward?: SceneConnectionTiming;
    reverse?: SceneConnectionTiming;
  };
};

export type NavigationGraph = {
  navigationNodes: readonly NavigationNodeData[];
  connections: readonly RuntimeConnection[];
  nodeById: ReadonlyMap<string, NavigationNodeData>;
};

/** Runtime / editor projection of a model entity (no kind/name). */
export type SceneObjectPlacement = {
  id: string;
  assetId: AssetId;
  fallback: SceneObjectFallback;
  position: Vec3;
  rotation: Vec3;
  scale?: number;
  roomId?: RoomId;
};

export type SceneObjectCluster = {
  id: string;
  name: string;
  /** Absent in world-local documents (cluster carries no spatial frame). */
  roomId?: RoomId;
  memberIds: string[];
};

export type SceneTextureAsset = {
  id: string;
  name: string;
  uri: string;
};

export type SceneMaterialInstance = {
  id: string;
  name: string;
  baseMaterialId: MaterialId;
  baseTextureId?: string;
  roughness?: number;
  metalness?: number;
};

export type ScenePrimitiveKind = 'box' | 'plane' | 'cylinder' | 'sphere';
export type SceneLightKind = 'point' | 'spot' | 'directional';

export type SceneEntityTransform = {
  position: Vec3;
  rotation: Vec3;
  scale?: number;
};

export type SceneEntityBase = SceneEntityTransform & {
  id: string;
  name: string;
  /**
   * Room ownership is legacy-room-local machinery. World-local (P23.0b
   * migrated) documents leave it absent; absent means `position` and
   * `rotation` are already project/world coordinates and must never be
   * resolved through a Room frame again.
   */
  roomId?: RoomId;
};

export type SceneRenderableEntityBase = SceneEntityBase & {
  materialInstanceId?: string;
};

export type SceneModelEntity = SceneRenderableEntityBase & {
  kind: 'model';
  assetId: AssetId;
  fallback: SceneObjectFallback;
};

export type SceneBoxDimensions = {
  width: number;
  height: number;
  depth: number;
};

export type ScenePlaneDimensions = {
  width: number;
  height: number;
};

export type SceneCylinderDimensions = {
  radius: number;
  height: number;
};

export type SceneSphereDimensions = {
  radius: number;
};

export type ScenePrimitiveDimensions =
  | SceneBoxDimensions
  | ScenePlaneDimensions
  | SceneCylinderDimensions
  | SceneSphereDimensions;

export type ScenePrimitiveEntity =
	| (SceneRenderableEntityBase & {
			kind: 'primitive';
			primitive: 'box';
			dimensions: SceneBoxDimensions;
			materialId: MaterialId;
			castShadow: boolean;
			receiveShadow: boolean;
	  })
	| (SceneRenderableEntityBase & {
			kind: 'primitive';
			primitive: 'plane';
			dimensions: ScenePlaneDimensions;
			materialId: MaterialId;
			castShadow: boolean;
			receiveShadow: boolean;
	  })
	| (SceneRenderableEntityBase & {
			kind: 'primitive';
			primitive: 'cylinder';
			dimensions: SceneCylinderDimensions;
			materialId: MaterialId;
			castShadow: boolean;
			receiveShadow: boolean;
	  })
	| (SceneRenderableEntityBase & {
			kind: 'primitive';
			primitive: 'sphere';
			dimensions: SceneSphereDimensions;
			materialId: MaterialId;
			castShadow: boolean;
			receiveShadow: boolean;
	  });

export type SceneLightEntity =
	| (SceneEntityBase & {
			kind: 'light';
			light: 'point';
			color: string;
			intensity: number;
			range?: number;
			castShadow: boolean;
	  })
	| (SceneEntityBase & {
			kind: 'light';
			light: 'spot';
			color: string;
			intensity: number;
			range?: number;
			angle: number;
			penumbra?: number;
			castShadow: boolean;
	  })
	| (SceneEntityBase & {
			kind: 'light';
			light: 'directional';
			color: string;
			intensity: number;
			castShadow: boolean;
	  });

export type SceneEntity = SceneModelEntity | ScenePrimitiveEntity | SceneLightEntity;

export type SceneNavigationNode = Omit<
  NavigationNodeData,
  'position' | 'cameraTarget'
> & {
  /** Room-local eye position (legacy) or world position (absent roomId). */
  position: Vec3;
  /** Room-local look target (legacy) or world target (absent roomId). */
  cameraTarget: Vec3;
};

/**
 * S10.2 — shared on-flow predicate. A node is on a Camera Flow when it
 * carries at least one order link: chain heads/tails have exactly one,
 * interior nodes both. Redefined once here so the codec, route, timeline,
 * and mutator never diverge on "what counts as ordered".
 */
export function isFlowNode(
	node: Readonly<Pick<NavigationNodeData, 'nextNodeId' | 'previousNodeId'>>
) {
	return node.nextNodeId !== undefined || node.previousNodeId !== undefined;
}

export type SceneCameraViewKeyframe = {
  /** Stable within both directional tracks of this connection. */
  id: string;
  /** Exact-edge arc-length progress in this track's travel direction. */
  progress: number;
  /** Room-local when roomId is present, otherwise world-space. */
  cameraTarget: Vec3;
  roomId?: RoomId;
  /** Vertical PerspectiveCamera field of view in degrees. */
  fov: number;
  /** Phase 3.7 authored post-key timing. */
  holdSeconds?: number;
  /** Phase 3.7 authored easing to the next framing sample. */
  easing?: CameraEasing;
};

export type CameraFramingEnvelope = {
  enterStart: number;
  enterEnd: number;
  exitStart: number;
  exitEnd: number;
};

export type SceneConnectionViewTracks = {
  forward: SceneCameraViewKeyframe[];
  reverse: SceneCameraViewKeyframe[];
  framingEnvelope?: Partial<
    Record<CameraConnectionDirection, CameraFramingEnvelope>
  >;
};

export type SceneConnectionTimingPair = {
  forward?: SceneConnectionTiming;
  reverse?: SceneConnectionTiming;
};

export type SceneWaypoint = {
  /** Room-local when roomId is present, otherwise world-space. */
  position: Vec3;
  roomId?: RoomId;
};

export type ScenePathAnchor = SceneWaypoint & {
  /** Stable within this connection and across serialization/history. */
  id: string;
};

export type ScenePositionPath =
  | {
      kind: 'rounded-polyline';
      anchors: ScenePathAnchor[];
    }
  | {
      kind: 'auto-bezier';
      anchors: ScenePathAnchor[];
    };

export type SceneConnection = Omit<
  RuntimeConnection,
  'positionPath' | 'viewTracks' | 'targetWaypoints' | 'timing'
> & {
  /** Interior anchors only; the resolver inserts fresh node endpoints. */
  positionPath: ScenePositionPath;
  /** Direction-specific interior view keys. Node views supply generated endpoints. */
  viewTracks?: SceneConnectionViewTracks;
  /** Interior look waypoints only; currently unused by camera-route. */
  targetWaypoints?: SceneWaypoint[];
  /** Phase 3.7 authored connection timing, applied per direction. */
  timing?: SceneConnectionTimingPair;
};

/**
 * P23.0b world-local Scene format discriminator. Present (value `1`) only on
 * Scene documents whose physical values are project/world coordinates;
 * recognized legacy documents carry no `formatVersion` at all.
 */
export const SCENE_WORLD_LOCAL_FORMAT_VERSION = 1 as const;

/** Authoring-empty scene document: the editor boots into this state before the
 * first entity, navigation node, or connection is authored. It is a valid
 * document — the runtime tour/preview guards a blank project separately, so a
 * project with no navigation graph cannot start a broken tour.
 */
export function createEmptySceneDocument(): SceneDocument {
	return {
		textures: [],
		materials: [],
		entities: [],
		navigationNodes: [],
		connections: []
	};
}

/**
 * Authoring-empty WORLD-LOCAL scene document (`formatVersion: 1`) — the Scene
 * half of the canonical new-project boot.
 *
 * P23.0 moves the two discriminators together: `validateProject` rejects a
 * wall-first Layout (any explicit `formatVersion`) that carries the recognized legacy
 * room-local Scene (`scene_not_world_local`), so a project cannot adopt the
 * wall-first Layout and keep the legacy Scene. `createEmptySceneDocument`
 * keeps returning the legacy shape — it stays the compatibility/legacy-
 * fixture constructor, not the new-project boot.
 */
export function createEmptyWorldLocalSceneDocument(): SceneDocument {
	return {
		formatVersion: SCENE_WORLD_LOCAL_FORMAT_VERSION,
		...createEmptySceneDocument()
	};
}

export type SceneDocument = {
  /**
   * P23.0b format discriminator. Absent on recognized legacy (room-local)
   * documents; `1` on world-local documents whose physical values must never
   * be resolved through Room frames again.
   */
  formatVersion?: typeof SCENE_WORLD_LOCAL_FORMAT_VERSION;
  textures: SceneTextureAsset[];
  materials: SceneMaterialInstance[];
  entities: SceneEntity[];
  /** Editor-only hierarchy metadata. Visitor rendering intentionally stays flat. */
  clusters?: SceneObjectCluster[];
  navigationNodes: SceneNavigationNode[];
  connections: SceneConnection[];
};

/** Runtime type that the document parser canonicalises into. */
export type CanonicalSceneDocument = SceneDocument;

export type RuntimeScene = {
  /** Registered texture assets; rendering support lands in Phase 5.3. */
  textures: SceneTextureAsset[];
  /** Material instances; rendering support lands in Phase 5.3. */
  materials: SceneMaterialInstance[];
  /**
   * All scene entities with room-local transforms (cloned from the document).
   * MuseumEntities dispatches by `kind` for shared visitor/editor rendering.
   */
  entities: SceneEntity[];
  /**
   * Model placements only, projected from `kind: 'model'` entities.
   * Kept for Paris activation and legacy callers that still key off `objects`.
   */
  objects: SceneObjectPlacement[];
  /** World-space camera poses. */
  navigationNodes: NavigationNodeData[];
  /** World-space waypoints, including fresh node endpoints. */
  connections: RuntimeConnection[];
};

export function isSceneModelEntity(entity: SceneEntity): entity is SceneModelEntity {
  return entity.kind === 'model';
}

export function isScenePrimitiveEntity(
  entity: SceneEntity
): entity is ScenePrimitiveEntity {
  return entity.kind === 'primitive';
}

export function isSceneLightEntity(entity: SceneEntity): entity is SceneLightEntity {
  return entity.kind === 'light';
}

export function listSceneModelEntities(
  document: SceneDocument
): SceneModelEntity[] {
  return document.entities.filter(isSceneModelEntity);
}

export function modelEntityToPlacement(entity: SceneModelEntity): SceneObjectPlacement {
  return {
    id: entity.id,
    roomId: entity.roomId,
    assetId: entity.assetId,
    fallback: entity.fallback,
    position: entity.position,
    rotation: entity.rotation,
    ...(entity.scale === undefined ? {} : { scale: entity.scale })
  };
}

/** Deep-clone one entity for runtime resolution (room-local poses preserved). */
export function cloneSceneEntity(entity: SceneEntity): SceneEntity {
  const transform = {
    id: entity.id,
    name: entity.name,
    roomId: entity.roomId,
    position: cloneVec3(entity.position),
    rotation: cloneVec3(entity.rotation),
    ...(entity.scale === undefined ? {} : { scale: entity.scale })
  };

  if (entity.kind === 'model') {
    return {
      ...transform,
      kind: 'model',
      assetId: entity.assetId,
      fallback: entity.fallback,
      ...(entity.materialInstanceId === undefined
        ? {}
        : { materialInstanceId: entity.materialInstanceId })
    };
  }

  if (entity.kind === 'primitive') {
    return {
      ...transform,
      kind: 'primitive',
      primitive: entity.primitive,
      dimensions: { ...entity.dimensions },
      materialId: entity.materialId,
      castShadow: entity.castShadow,
      receiveShadow: entity.receiveShadow,
      ...(entity.materialInstanceId === undefined
        ? {}
        : { materialInstanceId: entity.materialInstanceId })
    } as ScenePrimitiveEntity;
  }

  if (entity.light === 'point') {
    return {
      ...transform,
      kind: 'light',
      light: 'point',
      color: entity.color,
      intensity: entity.intensity,
      castShadow: entity.castShadow,
      ...(entity.range === undefined ? {} : { range: entity.range })
    };
  }

  if (entity.light === 'spot') {
    return {
      ...transform,
      kind: 'light',
      light: 'spot',
      color: entity.color,
      intensity: entity.intensity,
      angle: entity.angle,
      castShadow: entity.castShadow,
      ...(entity.range === undefined ? {} : { range: entity.range }),
      ...(entity.penumbra === undefined ? {} : { penumbra: entity.penumbra })
    };
  }

  return {
    ...transform,
    kind: 'light',
    light: 'directional',
    color: entity.color,
    intensity: entity.intensity,
    castShadow: entity.castShadow
  };
}

export type SceneRoomResolver = {
  has(roomId: string): boolean;
  point(roomId: string, localPoint: Vec3): Vec3;
};

function cloneVec3(point: Vec3): Vec3 {
  return [...point];
}

function resolveWaypoint(waypoint: SceneWaypoint, rooms: SceneRoomResolver): Vec3 {
  return waypoint.roomId
    ? rooms.point(waypoint.roomId, waypoint.position)
    : cloneVec3(waypoint.position);
}
function resolveViewKeyframe(
  keyframe: SceneCameraViewKeyframe,
  rooms: SceneRoomResolver
): RuntimeCameraViewKeyframe {
  return {
    id: keyframe.id,
    progress: keyframe.progress,
    cameraTarget: keyframe.roomId
      ? rooms.point(keyframe.roomId, keyframe.cameraTarget)
      : cloneVec3(keyframe.cameraTarget),
    fov: keyframe.fov,
    ...(keyframe.holdSeconds === undefined ? {} : { holdSeconds: keyframe.holdSeconds }),
    ...(keyframe.easing === undefined ? {} : { easing: keyframe.easing })
  };
}

export function resolveSceneDocument(
  input: unknown,
  rooms: SceneRoomResolver,
  options: SceneValidationOptions = {}
): RuntimeScene {
  const validation = validateSceneDocument(input, options);
  if (!validation.success) throw new SceneDocumentValidationError(validation.issues[0]!);
  const document = validation.document;

  const navigationNodes = document.navigationNodes.map((node): NavigationNodeData => ({
    ...node,
    // P23.0b: room-owned records resolve through the legacy Room frame;
    // records without roomId are already world-local and pass through
    // unchanged (never a second Room transform).
    position: node.roomId ? rooms.point(node.roomId, node.position) : cloneVec3(node.position),
    cameraTarget: node.roomId
      ? rooms.point(node.roomId, node.cameraTarget)
      : cloneVec3(node.cameraTarget),
    connectedNodeIds: [...node.connectedNodeIds],
    ...(node.holdSeconds === undefined ? {} : { holdSeconds: node.holdSeconds })
  }));
  const resolvedNodeById = new Map(navigationNodes.map((node) => [node.id, node]));

  const getResolvedNode = (id: string) => {
    const node = resolvedNodeById.get(id);
    if (!node) throw new Error(`Unknown navigation node in scene connection: ${id}`);
    return node;
  };

  const connections = document.connections.map((connection): RuntimeConnection => {
    const fromNode = getResolvedNode(connection.fromNodeId);
    const toNode = getResolvedNode(connection.toNodeId);
    const interiorAnchors = connection.positionPath.anchors.map(
      (anchor): RuntimePathAnchor => ({
        id: anchor.id,
        position: resolveWaypoint(anchor, rooms)
      })
    );
    const resolved: RuntimeConnection = {
      id: connection.id,
      fromNodeId: connection.fromNodeId,
      toNodeId: connection.toNodeId,
      clearance: connection.clearance,
      positionPath: {
        kind: connection.positionPath.kind,
        anchors: [
          { id: `node:${fromNode.id}:position`, position: cloneVec3(fromNode.position) },
          ...interiorAnchors,
          { id: `node:${toNode.id}:position`, position: cloneVec3(toNode.position) }
        ]
      }
    };

    if (connection.targetWaypoints) {
      resolved.targetWaypoints = [
        cloneVec3(fromNode.cameraTarget),
        ...connection.targetWaypoints.map((waypoint) => resolveWaypoint(waypoint, rooms)),
        cloneVec3(toNode.cameraTarget)
      ];
    }

    if (connection.viewTracks) {
      resolved.viewTracks = {
        forward: connection.viewTracks.forward.map((keyframe) => resolveViewKeyframe(keyframe, rooms)),
        reverse: connection.viewTracks.reverse.map((keyframe) => resolveViewKeyframe(keyframe, rooms)),
        ...(connection.viewTracks.framingEnvelope?.forward === undefined &&
          connection.viewTracks.framingEnvelope?.reverse === undefined
          ? {}
          : {
              framingEnvelope: {
                ...(connection.viewTracks.framingEnvelope.forward === undefined
                  ? {}
                  : { forward: { ...connection.viewTracks.framingEnvelope.forward } }),
                ...(connection.viewTracks.framingEnvelope.reverse === undefined
                  ? {}
                  : { reverse: { ...connection.viewTracks.framingEnvelope.reverse } })
              }
            })
      };
    }

    const timing = connection.timing;
    if (
      (timing?.forward !== undefined) ||
      (timing?.reverse !== undefined)
    ) {
      resolved.timing = {
        ...(timing?.forward === undefined ? {} : { forward: { ...timing.forward } }),
        ...(timing?.reverse === undefined ? {} : { reverse: { ...timing.reverse } })
      };
    }

    return resolved;
  });

  const entities = document.entities.map(cloneSceneEntity);
  const textures = document.textures.map((texture) => ({ ...texture }));
  const materials = document.materials.map((material) => ({ ...material }));
  const objects = listSceneModelEntities(document).map(
    (entity): SceneObjectPlacement => ({
      ...modelEntityToPlacement(entity),
      position: cloneVec3(entity.position),
      rotation: cloneVec3(entity.rotation)
    })
  );

  return { textures, materials, entities, objects, navigationNodes, connections };
}

export function createNavigationGraph<
  T extends Pick<RuntimeScene, 'navigationNodes' | 'connections'>
>(
  scene: T
): NavigationGraph {
  return {
    navigationNodes: scene.navigationNodes,
    connections: scene.connections,
    nodeById: new Map(scene.navigationNodes.map((node) => [node.id, node]))
  };
}

export function assertNavigationGraphMatchesScene(
  graph: NavigationGraph,
  scene: RuntimeScene
) {
  if (
    graph.navigationNodes !== scene.navigationNodes ||
    graph.connections !== scene.connections
  ) {
    throw new Error('Navigation state must use the same resolved scene instance');
  }
}
