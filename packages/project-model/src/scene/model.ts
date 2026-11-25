import type { NavigationNodeData, RuntimeCameraViewKeyframe, RuntimeConnection, SceneCameraViewKeyframe, SceneDocument, SceneEntity, SceneEnvironment, SceneFormEntity, SceneFormSource, SceneLightEntity, SceneMaterialInstance, SceneModelEntity, SceneObjectPlacement, ScenePaletteSlot, ScenePrimitiveEntity, SceneSurfaceFinish, SceneTextureAsset, SceneWaypoint, Vec3 } from './contracts';

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
   * Read-only material definitions and verified image identities from the
   * resources unit. Derived beside `modelFootprints`, never authored into the
   * Scene; a renderer resolves a resource-backed Finish through this index.
   */
  materialIndex?: import('../materials/types').MaterialRuntimeIndex;
	/** Scene-owned shared Finish assignments for Layout-authored faces. */
	readonly surfaceFinishes?: readonly SceneSurfaceFinish[];
	/** The World's ordered palette, when it has one. */
	readonly palette?: readonly ScenePaletteSlot[];
	/** The World's authored Sky and Treatment, when it has any. */
	readonly environment?: SceneEnvironment;
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


export function cloneVec3(point: Vec3): Vec3 {
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


export function resolveWaypoint(waypoint: SceneWaypoint): Vec3 {
  return cloneVec3(waypoint.position);
}

export function resolveViewKeyframe(
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
