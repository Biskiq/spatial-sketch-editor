import { type Vec3 } from '../../scene';
import { type ShapeIssue } from '../../strict-shape';
import { type CameraFreeSceneDocument as SceneDocument } from '../../units/types';

export const SCENE_OPERATION_KINDS = [
	'place-object',
	'create-form',
	'place-form-copy',
	'set-form-size',
	'set-form-profile',
	'move-horizontal',
	'set-yaw',
	'place-on-floor',
	'resize-on-floor',
	'duplicate-one',
	'delete-one',
	'set-lift',
	'set-name',
	'create-light',
	'update-light',
	'duplicate-light',
] as const;

export type SceneOperationKind = (typeof SCENE_OPERATION_KINDS)[number];

export type SceneOperationRefusalCode =
	| 'no_op'
	| 'missing-target'
	| 'invalid-value'
	| 'unsupported-transform'
	| 'unsupported-frame'
	| 'unsupported-surface'
	| 'unsupported-set'
	| 'missing-footprint'
	| 'missing-contact-metadata'
	| 'no-support'
	| 'support-choice-required'
	| 'stale-generation'
	| 'stale-revision'
	| 'record-scope-violation'
	| 'missing-definition'
	| 'definition-changed';

export type SceneOperationRefusal = {
	readonly kind: 'rejected';
	readonly code: SceneOperationRefusalCode;
	readonly message: string;
	readonly diagnostics: readonly ShapeIssue[];
};

/** How one subject corresponds across the accepted change. */
export type SceneOperationCorrespondence = {
	readonly relation: 'created' | 'preserved' | 'retired';
	readonly entityId: string;
};

export type SceneOperationSupportEvidence = {
	readonly elevation: number;
	readonly generationId: string;
	readonly orderKey: string;
	/** Every equivalent compiled witness, discriminated by its source. */
	readonly witnesses: readonly {
		readonly source:
			| { readonly kind: 'room'; readonly roomId: string }
			| { readonly kind: 'region'; readonly regionId: string };
		readonly floorId: string;
		readonly recordId: string;
	}[];
};

export type SceneOperationCandidate = {
	readonly kind: 'candidate';
	readonly operationKind: SceneOperationKind;
	/** The targeted existing entity, or the created entity for a creation. */
	readonly entityId: string;
	readonly scene: SceneDocument;
	readonly fields: readonly string[];
	readonly correspondence: readonly SceneOperationCorrespondence[];
	readonly support?: SceneOperationSupportEvidence;
	readonly worldPose?: { readonly position: Vec3; readonly rotation: Vec3; readonly scale: number };
	readonly diagnostics: readonly ShapeIssue[];
};

export type SceneOperationResult = SceneOperationCandidate | SceneOperationRefusal;

/**
 * One accepted Scene read: the two unit payloads an operation may consult plus
 * the accepted content identity that qualifies its support generation.
 *
 * Layout is read-only here — a Scene operation resolves support from it and
 * never writes it, which is why it is a payload rather than a source object.
 */
export type SceneOperationContext = {
	readonly layout: import('@portfolio/layout-core/wall').LayoutDocumentWallFirst;
	readonly scene: SceneDocument;
	readonly sourceContentId: string;
};

/** Pitch/roll this close to zero is upright; the comparison never rewrites them. */
export const UPRIGHT_TOLERANCE = 1e-9;

/** A captured contact may be computed by another owner; agreement is metric. */
export const CONTACT_TOLERANCE_METERS = 1e-9;

/** `duplicate-one`'s fixed world offset, in meters. */
export const DUPLICATE_OFFSET_METERS = 0.5;

/**
 * The one `rotation` component a yaw edit owns. A Scene rotation is
 * `[pitch, yaw, roll]`, so the record-scope guard grants index `1` alone and
 * still compares the other two: an operation that rewrites the pitch it does
 * not own is refused rather than admitted as "rotation changed".
 */
export const YAW_SCOPE_FIELD = 'rotation[1]';

/**
 * A per-axis form size is form source, never the entity-level uniform scale.
 * The size planner owns exactly this nested field and the resting Y.
 */
export const FORM_SCALE_SCOPE_FIELD = 'form.scale';

/**
 * A profile revision owns the generator — its keyed outline and extent — while
 * `form.scale` and `form.nextKey` still compare exactly.
 */
export const FORM_GENERATOR_SCOPE_FIELD = 'form.generator';

/** The highest admitted lift above a support, in meters. */
export const SCENE_LIFT_LIMIT_METERS = 50;

/** The longest admitted entity name, in characters. */
export const SCENE_NAME_LIMIT = 120;
