import { CurvePath, Vector3 } from 'three';
import type { CameraConnectionDirection, CameraEasing, CameraFramingEnvelope } from '../scene-types';

export type Vector3Like =
  | readonly [number, number, number]
  | Readonly<{ x: number; y: number; z: number }>;


export type CameraPositionPathPart =
  | {
      kind: 'rounded-polyline';
      points: readonly Vector3Like[];
      clearance?: number;
    }
  | {
      kind: 'auto-bezier';
      anchors: readonly Vector3Like[];
    };


export type CameraPositionPathLocation = {
  partIndex: number;
  pointIndex: number;
};


export type CameraPositionPathSpan = {
  start: CameraPositionPathLocation;
  end: CameraPositionPathLocation;
};


export type CameraRouteView = {
  cameraTarget: Vector3Like;
  /** Vertical PerspectiveCamera field of view in degrees. */
  fov: number;
};


export type CameraRouteViewKeyframe = CameraRouteView & {
  id: string;
  /** Exact-edge arc-length progress in this track's travel direction. */
  progress: number;
};


export type CameraRouteViewTrack = {
  /** Generated from the oriented source node; never persisted. */
  start: CameraRouteView;
  /** Authored interior keys from this direction only. */
  keyframes: readonly CameraRouteViewKeyframe[];
  /** Generated from the oriented destination node; never persisted. */
  end: CameraRouteView;
  /** Direction-owned travel-relative automatic/authored framing blend bounds. */
  framingEnvelope?: CameraFramingEnvelope;
};


export type CameraRouteEdge = {
  connectionId: string;
  direction: CameraConnectionDirection;
  fromNodeId: string;
  toNodeId: string;
  /** Locations in the coalesced position parts for this oriented edge. */
  positionSpan: CameraPositionPathSpan;
  /** Present on resolved graph routes; optional for low-level motion callers. */
  viewTrack?: CameraRouteViewTrack;
  /** Existing synthesized target data scoped to this exact oriented edge. */
  automaticTargetPoints?: readonly Vector3Like[];
};


export type CameraRoute = {
  positionParts: readonly CameraPositionPathPart[];
  targetPoints: readonly Vector3Like[];
  /** Generated endpoint FOV values; defaults to 54 for low-level callers. */
  startFov?: number;
  endFov?: number;
  /** Required on resolved graph routes; optional for low-level motion callers. */
  edges?: readonly CameraRouteEdge[];
};


export type CameraPose = {
  position: Vector3Like;
  target: Vector3Like;
  fov: number;
};


export type CameraMotionSample = {
  position: Vector3;
  target: Vector3;
  fov: number;
};


export type CameraMotion = {
  readonly positionPath: CurvePath<Vector3>;
  readonly targetPath: CurvePath<Vector3>;
  readonly positionEdgeSpans: readonly CameraPositionEdgeDistanceSpan[];
  readonly edgeViews: readonly (CameraMotionEdgeView | null)[];
  readonly totalPositionDistance: number;
  readonly usesLegacyTargetPath: boolean;
  readonly startFov: number;
  readonly endFov: number;
  readonly durationSeconds: number;
  /** Phase 3.7 authored easing applied across the motion span. */
  readonly easing: CameraEasing;
};


/** Phase 3.7 authored overrides for one direction of a connection. */
export type CameraMotionOptions = {
  /** Exactly replace the formula-derived motion duration (no clamp). */
  durationSeconds?: number;
  /** Override the default easing applied to the motion span. */
  easing?: CameraEasing;
};


export type CameraPositionDistanceSpan = {
  readonly startDistance: number;
  readonly endDistance: number;
  readonly length: number;
};


export type CameraPositionEdgeDistanceSpan = CameraRouteEdge &
  CameraPositionDistanceSpan;


export type CompiledCameraPositionPath = {
  readonly positionPath: CurvePath<Vector3>;
  /** Same order as the requested path spans. */
  readonly spans: readonly CameraPositionDistanceSpan[];
  readonly totalDistance: number;
};


/**
 * F3 — Public, readonly guard-status accessor. Derived from the private compiled
 * guard; no sampler or runtime behaviour change. The single permitted
 * `camera-motion.ts` type/API addition for P1.6.
 */
export type CameraFramingGuardStatus = {
  readonly limitsAngularRate: boolean;
  readonly hasBypass: boolean;
  readonly hasStandoff: boolean;
};


export type PreparedPositionPathPart =
  | {
      kind: 'rounded-polyline';
      points: Vector3[];
      clearance?: number;
    }
  | {
      kind: 'auto-bezier';
      anchors: Vector3[];
    };


export type PreparedCameraRouteView = {
  cameraTarget: Vector3;
  fov: number;
};


type PreparedCameraRouteViewKeyframe = PreparedCameraRouteView & {
  id: string;
  progress: number;
};


export type PreparedCameraRouteViewTrack = {
  start: PreparedCameraRouteView;
  keyframes: PreparedCameraRouteViewKeyframe[];
  end: PreparedCameraRouteView;
  framingEnvelope?: CameraFramingEnvelope;
};


export type PreparedCameraRouteEdge = Omit<
  CameraRouteEdge,
  'viewTrack' | 'automaticTargetPoints'
> & {
  viewTrack?: PreparedCameraRouteViewTrack;
  automaticTargetPoints?: Vector3[];
};


export type CameraMotionViewPoint = {
  progress: number;
  cameraTarget: Vector3;
  fov: number;
};


export type CameraMotionEdgeView = {
  points: CameraMotionViewPoint[];
  automaticTargetPath: CurvePath<Vector3> | null;
  hasAuthoredKeyframes: boolean;
  framingEnvelope?: CameraFramingEnvelope;
  guard: CameraFramingGuard | null;
};


type CameraFramingDirectionSample = {
  readonly progress: number;
  readonly directionX: number;
  readonly directionY: number;
  readonly directionZ: number;
};


export type CameraFramingBypass = {
  readonly startProgress: number;
  readonly startTarget: Vector3;
  readonly endTarget: Vector3;
};


export type CameraFramingGuard = {
  readonly directions: readonly CameraFramingDirectionSample[];
  readonly limitsAngularRate: boolean;
  /** True when any sampled target distance fell below the standoff shoulder. */
  readonly hasStandoffDanger: boolean;
  readonly bypass: CameraFramingBypass | null;
};


/** P3B.4 — one sample of the editor cardinal snap flight. */
export type CardinalSnapMotionSample = {
  position: Vector3;
  target: Vector3;
  up: Vector3;
};


/** Pure, stateless sampler contract consumed by the orientation widget driver. */
export type CardinalSnapMotion = {
  readonly durationMs: number;
  readonly easing: CameraEasing;
  sample: (progress: number) => CardinalSnapMotionSample;
};


export type CameraFramingGuardCompileContext = {
  edgeView: CameraMotionEdgeView;
  edgeSpan: CameraPositionEdgeDistanceSpan;
  positionPath: CurvePath<Vector3>;
  targetPath: CurvePath<Vector3>;
  totalPositionDistance: number;
  durationSeconds: number;
  easing: CameraEasing;
};


export type RawCameraFramingGuardSample = {
  progress: number;
  timeSeconds: number;
  position: Vector3;
  target: Vector3;
  distance: number;
  direction: Vector3;
};
