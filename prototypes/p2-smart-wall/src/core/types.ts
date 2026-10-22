export interface SplineControlPoint {
  id: string;
  x: number;
  z: number;
}

export interface WallSample {
  /** Cumulative arc length in meters from left edge (0 .. totalLength) */
  u: number;
  /** Normalized arc parameter (0 .. 1) */
  uNorm: number;
  /** World X coordinate */
  x: number;
  /** World Z coordinate */
  z: number;
  /** Unit tangent along increasing u */
  tx: number;
  tz: number;
  /** Unit front-facing normal (pointing toward gallery viewer, +Z general direction) */
  nx: number;
  nz: number;
  /** Signed curvature kappa (m^-1). Positive = concave toward viewer, Negative = convex toward viewer */
  curvature: number;
}

export interface WallLandmark {
  id: string;
  label: string;
  u: number;
  uNorm: number;
  kind: 'left-edge' | 'center' | 'right-edge' | 'apex' | 'inflection';
  curvature: number;
}

export type FrameStyle = 'walnut' | 'black-metal' | 'warm-oak' | 'brushed-brass' | 'floating-dibond';

export type WallAnchorMode =
  | 'proportional'   // Preserves relative % along the wall (or between landmarks)
  | 'left-measure'   // Preserves exact meter distance from left edge
  | 'right-measure'  // Preserves exact meter distance from right edge
  | 'apex-pinned';   // Pinned relative to nearest curve apex / inflection landmark

export type VerticalAlignMode =
  | 'eye-level'      // Snapped to gallery eye-level datum (default 1.52m)
  | 'free'           // Deliberate custom height
  | 'top-linked'     // Top edge aligned with neighbor
  | 'bottom-linked'; // Bottom edge aligned with neighbor

export interface ArtworkItem {
  id: string;
  title: string;
  artist: string;
  year: string;
  medium: string;
  /** Outer frame width in meters */
  width: number;
  /** Outer frame height in meters */
  height: number;
  /** Frame depth in meters */
  frameDepth: number;
  /** Mat / passepartout border width in meters (0 for borderless) */
  matWidth: number;
  frameStyle: FrameStyle;
  motif:
    | 'horizon-dusk'
    | 'monolith-i'
    | 'monolith-ii'
    | 'tidal-geometry'
    | 'desert-sine'
    | 'portrait-shadow'
    | 'brutalist-arch';
  /** Where the artwork currently resides */
  location: 'wall' | 'rack';
  /** Slot index if on the floor staging rack */
  rackIndex?: number;
  /** Arc-length coordinate along the wall in meters (center of artwork) */
  u: number;
  /** Normalized coordinate at last intentional placement (0..1) */
  uNormAnchor: number;
  /** Distance from nearest curve apex at last intentional placement */
  apexDeltaU?: number;
  /** ID of pinned landmark if apex-pinned */
  pinnedLandmarkId?: string;
  /** Elevation of artwork center from floor in meters */
  h: number;
  /** Deliberate surface stand-off distance from wall front face in meters (0.015 = flush, 0.06 = floating shadow pin, 0.14 = cantilevered) */
  standoff: number;
  /** Automatic extra clearance added when a concave curve bends tightly behind a wide rigid frame */
  autoCurveClearance: number;
  /** Deliberate vertical tilt angle in degrees (negative = salon downward tilt toward viewer) */
  pitchDeg: number;
  /** How this painting responds when the wall is reshaped */
  anchorMode: WallAnchorMode;
  /** Vertical alignment intent */
  verticalMode: VerticalAlignMode;
}

export type GapMode = 'free' | 'locked' | 'equal';

export interface PairwiseGapRelation {
  /** Key formatted as `${leftArtId}__${rightArtId}` sorted by u */
  pairKey: string;
  leftArtId: string;
  rightArtId: string;
  mode: GapMode;
  /** Target edge-to-edge arc gap in meters when mode is 'locked' (or computed equal gap) */
  targetGap: number;
  /** Live measured edge-to-edge arc gap in meters */
  currentGap: number;
}

export interface GalleryLight {
  id: string;
  name: string;
  /** If bound to an artwork, automatically tracks it across wall edits and drags */
  targetType: 'artwork' | 'wall-point';
  targetArtworkId?: string;
  /** Offset from artwork center (in meters) when targetType === 'artwork' */
  artworkOffsetU: number;
  artworkOffsetH: number;
  /** Intrinsic wall coordinates when targetType === 'wall-point' (also synced for artwork target) */
  targetU: number;
  targetH: number;
  /** Lateral offset along the overhead ceiling track relative to targetU (in meters, creates angled grazing shadow) */
  trackOffsetU: number;
  /** Setback distance of track fixture from the wall surface in meters (default ~1.35m) */
  trackDistance: number;
  /** Spotlight half-cone angle in degrees (12° tight spot .. 52° wide wash) */
  coneAngleDeg: number;
  /** Edge softness / penumbra (0.15 crisp .. 0.95 feathered) */
  penumbra: number;
  /** Luminous intensity multiplier (0.5 .. 4.0) */
  intensity: number;
  /** Color temperature in Kelvin (2700K warm .. 5500K cool daylight) */
  kelvin: number;
  enabled: boolean;
}

export interface SpatialConflict {
  id: string;
  kind: 'wall-compression' | 'frame-overlap' | 'concave-clearance';
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  /** Arc position on wall to display the in-scene conflict badge */
  u: number;
  h: number;
  affectedArtworkIds: string[];
  resolutions: {
    id: string;
    label: string;
    actionType:
      | 'compress-locked-gaps'
      | 'switch-to-proportional'
      | 'separate-overlaps'
      | 'apply-curve-standoff'
      | 'move-overflow-to-rack';
  }[];
}

export interface SnapGuide {
  id: string;
  type: 'eye-level' | 'horizontal-align' | 'equal-gap' | 'landmark' | 'edge-margin';
  label: string;
  /** For horizontal lines along the wall: h coordinate and u start/end */
  uStart: number;
  uEnd: number;
  h: number;
  /** For vertical lines on the wall: u coordinate and h start/end */
  isVertical?: boolean;
  hStart?: number;
  hEnd?: number;
}

export interface RevisionSnapshot {
  id: string;
  label: string;
  timestamp: number;
  wallPoints: SplineControlPoint[];
  artworks: ArtworkItem[];
  gapRelations: Record<string, { mode: GapMode; targetGap: number }>;
  lights: GalleryLight[];
  eyeLevelDatum: number;
}

export type AmbientPreset = 'daylight-museum' | 'opening-night' | 'dramatic-nocturne';

export type WallPresetId =
  | 'gentle-arc'
  | 'serpentine-s'
  | 'concave-rotunda'
  | 'asymmetric-wing'
  | 'flat-gallery';
