import type { ArtworkFrame } from '../artwork-frame';
import type { LayoutSurfaceRef } from '@portfolio/layout-core/plan';

export type Vec3 = [number, number, number];

export type AssetId = string;

export type MaterialId =
  | 'wood-oak-veneer'
  | 'wood-walnut-veneer'
  | 'wood-oak-planks'
  | 'wood-herringbone-parquet'
  | 'stone-travertine'
  | 'stone-terrazzo'
  | 'masonry-brick-red'
  | 'plaster-painted'
  | 'concrete-smooth'
  | 'concrete-polished'
  | 'tile-ceramic-white'
  | 'metal-stainless-satin'
  | 'metal-brass-satin'
  | 'metal-copper-satin'
  | 'metal-gold-satin'
  | 'metal-stainless-brushed'
  | 'metal-aluminium-brushed'
  | 'textile-linen'
  | 'textile-carpet-loop'
  | 'leather-cognac'
  | 'synthetic-plastic-matte'
  /** Legacy placeholder bases (pre-S8 F): resolvable, not creator-facing. */
  | 'plaster-warm'
  | 'wood-walnut'
  | 'brass-aged'
  | 'marble-light'
  | 'velvet-dark'
  | 'paper-aged'
  /**
   * The frozen technical, untextured catalogue base. A resource-backed Finish
   * names it as its catalogue fallback while its material definition supplies
   * the authored signals.
   */
  | 'pbr-neutral-v1';


/** Surface Finish assignments: every canonical Layout surface identity. */
export type SceneSurfaceRef = LayoutSurfaceRef;

export type SceneSurfaceFinish = {
  readonly surface: SceneSurfaceRef;
  readonly finish: { readonly materialId: MaterialId } | { readonly materialInstanceId: string };
};


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


/**
 * A finish colour: a lowercase `#rrggbb` literal or a follower of one palette
 * slot. A follower moves when its slot's colour changes; a literal never moves.
 */
export type SceneColor = string | { readonly slot: string };


/**
 * A project Finish: a named look over one catalogue base or one immutable
 * material definition, plus sparse role-typed overrides.
 *
 * Scene 12 stores the portable v1 Finish grammar directly. Display names remain
 * outside recipe identity.
 */
export type SceneMaterialInstance = import('../materials/types').Finish;


/** The most palette slots one World may carry. */
export const SCENE_PALETTE_MAX_SLOTS = 8 as const;


/**
 * One ordered palette slot. The `id` is the follower's stable reference and is
 * never shown or changed; `name` is the creator-facing label and may repeat.
 */
export type ScenePaletteSlot = {
	readonly id: string;
	readonly name: string;
	readonly color: string;
};


/** The six Sky presets. A preset is provenance, never the stored look. */
export const SCENE_SKY_PRESETS = ['studio', 'daylight', 'golden-hour', 'dusk', 'overcast', 'moonlit'] as const;

export type SceneSkyPreset = (typeof SCENE_SKY_PRESETS)[number];


/** The two Look treatments. `natural` is the absence of a treatment, never a tag. */
export const SCENE_TREATMENTS = ['flat-colour', 'clay'] as const;

export type SceneTreatment = (typeof SCENE_TREATMENTS)[number];


/** Authored Sky settings. The Sun and Moon positions and lighting are derived. */
export type SceneSky = {
	/** Provenance and Reset target. */
	readonly preset: SceneSkyPreset;
	/** Solar hours in [0, 24). */
	readonly time: number;
	/** Noon bearing in degrees, clockwise from world −Z. */
	readonly heading: number;
	/** Noon elevation in degrees. */
	readonly arcHeight: number;
	readonly haze: number;
	readonly exposure: number;
	readonly softness: number;
	readonly sunShadows: boolean;
	readonly moon: { readonly color: string; readonly strength: number };
	readonly skyColor: string;
	readonly groundColor: string;
};


/** Authored world presentation: the Sky and the resolve-time Treatment. */
export type SceneEnvironment = {
	readonly sky?: SceneSky;
	readonly treatment?: SceneTreatment;
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
  source: import('../artwork').ArtworkImageSource;
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
 * The Scene document format discriminator. `1` is the one supported format:
 * physical values are project/world coordinates and no record
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
