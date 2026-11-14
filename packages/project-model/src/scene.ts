import {
  SceneDocumentValidationError,
  validateSceneDocument
} from './scene-codec';
import type { SceneValidationOptions } from './scene-validation';
import type { ArtworkFrame } from './artwork-frame';

export type Vec3 = [number, number, number];
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
  | 'rug'
  /** A creator model's approved footprint box; never a catalogue object shape. */
  | 'generic';

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
  label: string;
  position: Vec3;
  cameraTarget: Vec3;
  fov: number;
  connectedNodeIds: string[];
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
};

export type SceneObjectCluster = {
  id: string;
  name: string;
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
export type SceneLightKind = 'point' | 'spot';

export type SceneEntityTransform = {
  position: Vec3;
  rotation: Vec3;
  scale?: number;
};

export type SceneEntityBase = SceneEntityTransform & {
  id: string;
  name: string;
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

export type SceneFormPlane = 'plan' | 'elevation';

/** One keyed outline anchor, in the form's local profile plane. */
export type SceneFormAnchor = {
	key: number;
	u: number;
	v: number;
	smooth: boolean;
};

/**
 * The authored source of one native form. The generator is the only admitted
 * kind; `scale` is per-axis source scale about the local origin, and `nextKey`
 * is the monotonic outline-key allocator. No generated geometry is stored.
 */
export type SceneFormSource = {
	generator: {
		kind: 'extrude';
		plane: SceneFormPlane;
		outline: SceneFormAnchor[];
		extent: number;
	};
	scale: Vec3;
	nextKey: number;
};

/**
 * A native form is a Scene renderable whose shape is authored source. The
 * shared entity shape still declares an optional `scale`, but a form never
 * writes or accepts it: per-axis size is form source, so size has one writer.
 */
export type SceneFormEntity = SceneRenderableEntityBase & {
	kind: 'form';
	form: SceneFormSource;
	materialId: MaterialId;
	castShadow: boolean;
	receiveShadow: boolean;
};

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
	  });

export type SceneArtworkEntity = Omit<SceneEntityBase, 'scale'> & {
  kind: 'artwork';
  source: import('./artwork').ArtworkImageSource;
  widthMeters: number;
  /** Optional generated framing presentation; absent means no frame and no Mat. */
  frame?: ArtworkFrame;
  scale?: never;
};

export type SceneEntity =
	| SceneArtworkEntity
	| SceneModelEntity
	| ScenePrimitiveEntity
	| SceneFormEntity
	| SceneLightEntity;

export type SceneNavigationNode = Omit<
  NavigationNodeData,
  'position' | 'cameraTarget'
> & {
  /** World-space eye position. */
  position: Vec3;
  /** World-space look target. */
  cameraTarget: Vec3;
};

export type SceneCameraViewKeyframe = {
  /** Stable within both directional tracks of this connection. */
  id: string;
  /** Exact-edge arc-length progress in this track's travel direction. */
  progress: number;
  /** World-space look target. */
  cameraTarget: Vec3;
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
  /** World-space position. */
  position: Vec3;
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
 * The Scene document format discriminator. `1` is the one supported format
 * (PR #115 / WP3): physical values are project/world coordinates and no record
 * carries `roomId`, so a parsed document is runtime-final and is never resolved
 * through Room frames. Native forms are admitted through the F.2 Scene unit
 * format 4 that wraps this record grammar.
 */
export const SCENE_WORLD_LOCAL_FORMAT_VERSION = 1 as const;

/**
 * Authoring-empty Scene document — the Scene half of the canonical
 * new-project boot. The editor boots into this state before the first entity,
 * navigation node or connection is authored. It is a valid document: the
 * runtime tour/preview guards a blank project separately, so a project with no
 * navigation graph cannot start a broken tour.
 */
export function createEmptyWorldLocalSceneDocument(): SceneDocument {
	return {
		formatVersion: SCENE_WORLD_LOCAL_FORMAT_VERSION,
		textures: [],
		materials: [],
		entities: [],
		navigationNodes: [],
		connections: []
	};
}

export type SceneDocument = {
  /**
   * Current-format discriminator, required: `1`. Its presence is what the
   * reader checks, so a document without it is not a Scene document at all.
   */
  formatVersion: typeof SCENE_WORLD_LOCAL_FORMAT_VERSION;
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

/**
 * The Camera-owned runtime navigation value.
 *
 * Hard rule 2: Camera owns views, routes, framing and projection. The runtime
 * Scene resolves object composition and world presentation only, so a Camera
 * edit cannot change a Scene-keyed input, and a Scene edit cannot change
 * navigation. The two values are prepared from their own authored units and
 * retained separately.
 */
export type RuntimeNavigation = {
  /** World-space camera poses, one per Camera view. */
  navigationNodes: NavigationNodeData[];
  /** World-space waypoints, including fresh node endpoints. */
  connections: RuntimeConnection[];
};

/** The resolved Scene: object composition and world presentation, Camera-free. */
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
  /**
   * Approved creator-model footprints (metres), keyed by `model` resource id.
   * Read-projection data supplied by the unit runtime; never authored.
   */
  modelFootprints?: ReadonlyMap<string, { width: number; depth: number }>;
};

export function isSceneModelEntity(entity: SceneEntity): entity is SceneModelEntity {
  return entity.kind === 'model';
}

export function isScenePrimitiveEntity(
  entity: SceneEntity
): entity is ScenePrimitiveEntity {
  return entity.kind === 'primitive';
}

export function isSceneFormEntity(entity: SceneEntity): entity is SceneFormEntity {
  return entity.kind === 'form';
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
    position: cloneVec3(entity.position),
    rotation: cloneVec3(entity.rotation),
    ...(entity.scale === undefined ? {} : { scale: entity.scale })
  };

  if (entity.kind === 'artwork') {
    return {
      kind: 'artwork', id: entity.id, name: entity.name,
      position: cloneVec3(entity.position), rotation: cloneVec3(entity.rotation),
      source: { ...entity.source }, widthMeters: entity.widthMeters,
      ...(entity.frame === undefined ? {} : { frame: { ...entity.frame } })
    };
  }

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

	if (entity.kind === 'form') {
		return {
			...transform,
			kind: 'form',
			form: cloneFormSource(entity.form),
			materialId: entity.materialId,
			castShadow: entity.castShadow,
			receiveShadow: entity.receiveShadow,
			...(entity.materialInstanceId === undefined
				? {}
				: { materialInstanceId: entity.materialInstanceId })
		};
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

function cloneVec3(point: Vec3): Vec3 {
	return [...point];
}

/** Deep-clone a form source so duplicate and runtime resolution share nothing. */
export function cloneFormSource(source: SceneFormSource): SceneFormSource {
	return {
		generator: {
			kind: source.generator.kind,
			plane: source.generator.plane,
			outline: source.generator.outline.map((anchor) => ({
				key: anchor.key,
				u: anchor.u,
				v: anchor.v,
				smooth: anchor.smooth
			})),
			extent: source.generator.extent
		},
		scale: [...source.scale],
		nextKey: source.nextKey
	};
}

function resolveWaypoint(waypoint: SceneWaypoint): Vec3 {
  return cloneVec3(waypoint.position);
}
function resolveViewKeyframe(
  keyframe: SceneCameraViewKeyframe
): RuntimeCameraViewKeyframe {
  return {
    id: keyframe.id,
    progress: keyframe.progress,
    cameraTarget: cloneVec3(keyframe.cameraTarget),
    fov: keyframe.fov,
    ...(keyframe.holdSeconds === undefined ? {} : { holdSeconds: keyframe.holdSeconds }),
    ...(keyframe.easing === undefined ? {} : { easing: keyframe.easing })
  };
}

/**
 * Resolve a Scene document into the runtime Scene.
 *
 * PR #115 (WP3) — the current format is the only accepted one, and its
 * physical values are already project/world coordinates, so there is no Room
 * registry and no Room-frame resolution: every value is cloned once, exactly,
 * with no transform and no second pass.
 *
 * The returned value is Camera-free. A document that also carries navigation is
 * still validated as one document (so an invalid endpoint is still refused), but
 * its Camera half resolves through {@link resolveNavigationDocument} into its own
 * value rather than into this one.
 */
export function resolveSceneDocument(
  input: unknown,
  options: SceneValidationOptions = {}
): RuntimeScene {
  const validation = validateSceneDocument(input, options);
  if (!validation.success) throw new SceneDocumentValidationError(validation.issues[0]!);
  const document = validation.document;

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

  return { textures, materials, entities, objects };
}

/**
 * Resolve one Camera unit's navigation records into the runtime navigation value.
 *
 * The records are validated through the same Scene document validator the Camera
 * unit is admitted through, with the unit's connectivity policy supplied by the
 * caller, so the runtime cannot accept a navigation graph the authored unit could
 * not carry. Only the navigation half is resolved: no entity, material or texture
 * value is read here.
 */
export function resolveNavigationDocument(
  input: Pick<SceneDocument, 'navigationNodes' | 'connections'>,
  options: SceneValidationOptions = {}
): RuntimeNavigation {
  const validation = validateSceneDocument(
    {
      formatVersion: SCENE_WORLD_LOCAL_FORMAT_VERSION,
      textures: [],
      materials: [],
      entities: [],
      navigationNodes: [...input.navigationNodes],
      connections: [...input.connections]
    },
    options
  );
  if (!validation.success) throw new SceneDocumentValidationError(validation.issues[0]!);
  return resolveNavigation(validation.document);
}

function resolveNavigation(document: SceneDocument): RuntimeNavigation {
  const navigationNodes = document.navigationNodes.map((node): NavigationNodeData => ({
    ...node,
    position: cloneVec3(node.position),
    cameraTarget: cloneVec3(node.cameraTarget),
    connectedNodeIds: [...node.connectedNodeIds]
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
        position: resolveWaypoint(anchor)
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
        ...connection.targetWaypoints.map((waypoint) => resolveWaypoint(waypoint)),
        cloneVec3(toNode.cameraTarget)
      ];
    }

    if (connection.viewTracks) {
      resolved.viewTracks = {
        forward: connection.viewTracks.forward.map((keyframe) => resolveViewKeyframe(keyframe)),
        reverse: connection.viewTracks.reverse.map((keyframe) => resolveViewKeyframe(keyframe)),
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

  return { navigationNodes, connections };
}

/** Index one resolved navigation value for the one Camera evaluator. */
export function createNavigationGraph(
  navigation: Pick<RuntimeNavigation, 'navigationNodes' | 'connections'>
): NavigationGraph {
  return {
    navigationNodes: navigation.navigationNodes,
    connections: navigation.connections,
    nodeById: new Map(navigation.navigationNodes.map((node) => [node.id, node]))
  };
}

export function assertNavigationGraphMatchesNavigation(
  graph: NavigationGraph,
  navigation: RuntimeNavigation
) {
  if (
    graph.navigationNodes !== navigation.navigationNodes ||
    graph.connections !== navigation.connections
  ) {
    throw new Error('Navigation state must use the same resolved navigation value');
  }
}
