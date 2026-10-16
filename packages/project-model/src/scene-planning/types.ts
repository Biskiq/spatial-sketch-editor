/**
 * T2.P01.S01 — the normalized object-definition input.
 *
 * The pure Scene planner cannot read the app catalogue or create a renderer
 * object, so a host policy adapter on the editor side supplies this shape. It
 * carries exactly what a deterministic placement needs — identity of the
 * captured definition metadata, its admitted operations, the canonical
 * footprint and contact, the creation defaults and the identity of the
 * renderer's own source correction.
 *
 * Two separations are structural here, not conventions:
 *
 * - `renderNormalization` is the *renderer's* scale/orientation correction. It is
 *   carried for parity verification and is never copied into authored instance
 *   scale/rotation (a piano with `defaultScale: 0.032` and instance scale 2
 *   yields 2 x canonical footprint, never an authored root scale of 0.064).
 * - `contactMinY` and `footprintMeters` are declared metadata, verified once by
 *   the host. Asynchronously loaded mesh bounds are never an unrecorded
 *   placement input, so nothing here is derived from a live bounding box.
 */
import type { LayoutVec2 } from '@portfolio/layout-core';
import type {
	AssetId,
	MaterialId,
	SceneBoxDimensions,
	SceneCylinderDimensions,
	SceneObjectFallback,
	SceneSphereDimensions,
	Vec3
} from '../scene';

/** A yaw-only local input frame, supplied explicitly by the caller. */
export type LocalInputFrame = {
	/** Frame origin in project-world meters. */
	origin: Vec3;
	/** Frame yaw in radians (`+Y` rotation, the renderer's convention). */
	yaw: number;
};

/**
 * The semantic surface an admission is authored for. Only `floor` is admitted
 * in this phase; the wider vocabulary exists so a refusal can name what was
 * offered instead of being unreachable by construction.
 */
export type PlacementSurface = 'floor' | 'wall' | 'ceiling' | 'surface';

/** One refused capability, with its reason, for creator disclosure. */
export type ObjectDefinitionExclusion = {
	code: string;
	reason: string;
};

/** How the declared contact was established. */
export type ObjectContactProvenance =
	| { kind: 'analytical'; detail: string }
	| { kind: 'verified-model'; verificationId: string };

/**
 * What one normalized definition is admitted for.
 *
 * `operations` is pinned to `place-object`: this slice prepares one placement
 * and registers no other operation kind. `supportedSurfaces` and `uprightOnly`
 * are checked by the planner, so a policy that admits anything else gets a
 * typed `unsupported-surface` refusal rather than an upright assumption.
 */
export type ObjectDefinitionAdmission = {
	operations: readonly ['place-object'];
	supportedSurfaces: readonly PlacementSurface[];
	uprightOnly: boolean;
	provenance: ObjectContactProvenance;
	exclusions: readonly ObjectDefinitionExclusion[];
};

/** The renderer's own source correction — never an authored instance transform. */
export type RenderNormalizationIdentity = {
	defaultScale: number;
	defaultRotation?: Vec3;
};

/**
 * Creation defaults for a native upright primitive. Only the three primitives
 * with an analytical floor contact are admitted: a plane is a vertical surface,
 * so it has no honest floor footprint.
 */
export type NativeObjectCreationDefaults =
	| {
			kind: 'primitive';
			primitive: 'box';
			name: string;
			dimensions: SceneBoxDimensions;
			materialId: MaterialId;
			materialInstanceId?: string;
			castShadow: boolean;
			receiveShadow: boolean;
	  }
	| {
			kind: 'primitive';
			primitive: 'cylinder';
			name: string;
			dimensions: SceneCylinderDimensions;
			materialId: MaterialId;
			materialInstanceId?: string;
			castShadow: boolean;
			receiveShadow: boolean;
	  }
	| {
			kind: 'primitive';
			primitive: 'sphere';
			name: string;
			dimensions: SceneSphereDimensions;
			materialId: MaterialId;
			materialInstanceId?: string;
			castShadow: boolean;
			receiveShadow: boolean;
	  };

export type ModelObjectCreationDefaults = {
	kind: 'model';
	name: string;
	assetId: AssetId;
	fallback: SceneObjectFallback;
	materialInstanceId?: string;
};

export type ObjectCreationDefaults = NativeObjectCreationDefaults | ModelObjectCreationDefaults;

/**
 * One normalized, source-independent definition the planner can place.
 *
 * `metadataContentId` is captured once by the host before preparation
 * (`definitionMetadataContentId`), so a replayed preparation allocates nothing
 * and compares contents instead of re-reading the catalogue.
 */
export type NormalizedPlacementDefinition = {
	definitionKey: string;
	metadataContentId: string;
	admission: ObjectDefinitionAdmission;
	/**
	 * Valid simple canonical local X/Z polygon in meters around the placement
	 * pivot, already source-normalized. Multiply by authored instance scale only;
	 * renderer normalization never re-enters it.
	 */
	footprintMeters: readonly LayoutVec2[];
	/** Finite minimum/support contact height in normalized placement-local meters. */
	contactMinY: number;
	creationDefaults: ObjectCreationDefaults;
	renderNormalization: RenderNormalizationIdentity;
};
