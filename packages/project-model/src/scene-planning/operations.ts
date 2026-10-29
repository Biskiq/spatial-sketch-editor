/**
 * T2.P01.S02 — the pure Scene operation set.
 *
 * One function per operation turns captured inputs into one candidate Scene or
 * one typed refusal. Nothing here allocates an id (creation ids arrive
 * captured), reads the catalogue, queries a clock or raycasts a mesh: a replay
 * of the same captured inputs produces the identical candidate, which is what
 * makes Redo restore captured identities instead of re-deciding anything.
 *
 * Operations own a narrow set of fields, and the record-scope guard enforces it:
 *
 * | Operation | Owned values |
 * | --- | --- |
 * | `place-form-copy` | one appended form entity from a saved library payload, a new id and the captured support |
 * | `move-horizontal` | world X/Z only; Y, rotation, scale, dimensions and materials are preserved |
 * | `set-yaw` | the yaw component of `rotation` only; position, pitch, roll and every other value are preserved |
 * | `place-on-floor` | contact-resolved Y and X/Z; the captured yaw component when the payload supplies one |
 * | `resize-on-floor` | uniform scale and the compensating Y; X/Z and rotation are preserved |
 * | `duplicate-one` | one appended entity at +0.5 m world X/Z, everything else copied |
 * | `delete-one` | exact removal, cluster-membership cleanup and an emptied-cluster drop |
 *
 * Support is always re-derived from the snapshot's canonical compile
 * (`./support`). Move, duplicate and resize must keep their **resting
 * elevation**; a destination that cannot support it refuses, because changing
 * the resting floor is an explicit `place-on-floor` decision. A primitive's
 * contact is analytical and a captured disagreement refuses; a model's contact
 * is host metadata captured with the intent, exactly as S01 treats verified
 * model contact.
 */
import type { LayoutVec2 } from '@portfolio/layout-core';
import {
	canonicalizeWinding,
	evaluateProfile,
	extrudeProfile,
	GeometryCoreError,
	PROFILE_LIMITS,
	validateProfile,
	type ProfileAnchor
} from '@portfolio/geometry-core';
import type { ShapeIssue } from '../strict-shape';
import type { CameraFreeSceneDocument as SceneDocument } from '../units/types';
import {
	cloneFormSource,
	type MaterialId,
	type SceneEntity,
	type SceneFormEntity,
	type SceneFormPlane,
	type ScenePrimitiveEntity,
	type Vec3
} from '../scene';
import { framePointToWorld, frameYawToWorld, isFinitePlacementFrame } from './frame';
import { evaluateSceneForm, sceneFormContactMinY } from './form';
import { readFormLibraryPayload, type FormLibraryPayload } from '../library/form-library';
import { finalizeSceneCandidate, sameSceneValues, type SceneRecordScope } from './record-scope';
import { resolveSceneSupport, type SceneSupportChoice } from './support';
import type { LocalInputFrame } from './types';

export const SCENE_OPERATION_KINDS = [
	'place-object',
	'create-form',
	'place-form-copy',
	'set-form-size',
	'move-horizontal',
	'set-yaw',
	'place-on-floor',
	'resize-on-floor',
	'duplicate-one',
	'delete-one'
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
	readonly witnesses: readonly {
		readonly floorId: string;
		readonly roomId: string;
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
	readonly layout: import('@portfolio/layout-core').LayoutDocumentWallFirst;
	readonly scene: SceneDocument;
	readonly sourceContentId: string;
};

/** Pitch/roll this close to zero is upright; the comparison never rewrites them. */
const UPRIGHT_TOLERANCE = 1e-9;

/** A captured contact may be computed by another owner; agreement is metric. */
const CONTACT_TOLERANCE_METERS = 1e-9;

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

export function planMoveHorizontal(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly worldXZ: readonly [number, number];
	readonly frame: LocalInputFrame;
	readonly contactMinY: number;
	readonly choice?: SceneSupportChoice | undefined;
}): SceneOperationResult {
	const target = readObject(input.context.scene, input.entityId);
	if (target.kind !== 'object') return target;
	const contact = readContactMinY(target.entity, input.contactMinY);
	if (contact.kind !== 'value') return contact;
	if (!upright(target.entity)) return unsupportedTransform(input.entityId, 'move-horizontal');
	if (!isFinitePlacementFrame(input.frame)) return invalidFrame();

	const point = worldPoint(input.frame, input.worldXZ);
	if (point === null) return nonFinitePoint();
	const resting = restingElevation(target.entity, contact.value);
	const support = resolveSupport(input.context, point, resting, input.choice);
	if (support.kind !== 'resolved') return support;

	const next: SceneEntity = {
		...target.entity,
		position: [point[0], target.entity.position[1], point[1]]
	};
	return finalize({
		context: input.context,
		operationKind: 'move-horizontal',
		next,
		fields: ['position'],
		scope: {
			changedEntityIds: [target.entity.id],
			changedEntityFields: ['position[0]', 'position[2]'],
			createdEntityIds: [],
			removedEntityIds: [],
			allowClusterCleanup: false
		},
		correspondence: [{ relation: 'preserved', entityId: target.entity.id }],
		support: support.support
	});
}

export function planSetYaw(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly yaw: number;
	readonly frame: LocalInputFrame;
}): SceneOperationResult {
	const target = readObject(input.context.scene, input.entityId);
	if (target.kind !== 'object') return target;
	if (!upright(target.entity)) return unsupportedTransform(input.entityId, 'set-yaw');
	if (!Number.isFinite(input.yaw) || !isFinitePlacementFrame(input.frame)) return invalidFrame();

	// Owned: yaw. Any admitted sub-tolerance pitch/roll is preserved rather than
	// rewritten, so `set-yaw` never changes a component it does not own.
	const next: SceneEntity = {
		...target.entity,
		rotation: [
			target.entity.rotation[0],
			ownedYaw(target.entity.rotation[1], input.frame, input.yaw),
			target.entity.rotation[2]
		]
	};
	return finalize({
		context: input.context,
		operationKind: 'set-yaw',
		next,
		fields: ['rotation'],
		scope: {
			changedEntityIds: [target.entity.id],
			changedEntityFields: [YAW_SCOPE_FIELD],
			createdEntityIds: [],
			removedEntityIds: [],
			allowClusterCleanup: false
		},
		correspondence: [{ relation: 'preserved', entityId: target.entity.id }]
	});
}

export function planPlaceOnFloor(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly worldXZ: readonly [number, number];
	readonly frame: LocalInputFrame;
	readonly contactMinY: number;
	readonly yaw?: number | undefined;
	readonly choice?: SceneSupportChoice | undefined;
}): SceneOperationResult {
	const target = readObject(input.context.scene, input.entityId);
	if (target.kind !== 'object') return target;
	const contact = readContactMinY(target.entity, input.contactMinY);
	if (contact.kind !== 'value') return contact;
	if (!upright(target.entity)) return unsupportedTransform(input.entityId, 'place-on-floor');
	if (!isFinitePlacementFrame(input.frame)) return invalidFrame();
	if (input.yaw !== undefined && !Number.isFinite(input.yaw)) {
		return invalid('A Place on floor yaw must be finite.', ['yaw']);
	}

	const point = worldPoint(input.frame, input.worldXZ);
	if (point === null) return nonFinitePoint();
	const support = resolveSupport(input.context, point, null, input.choice);
	if (support.kind !== 'resolved') return support;

	const scale = entityScale(target.entity);
	const y = support.support.elevation - scale * contact.value;
	const rotation: Vec3 =
		input.yaw === undefined
			? target.entity.rotation
			: [
					target.entity.rotation[0],
					ownedYaw(target.entity.rotation[1], input.frame, input.yaw),
					target.entity.rotation[2]
				];
	const next: SceneEntity = { ...target.entity, position: [point[0], y, point[1]], rotation };
	const fields = input.yaw === undefined ? ['position'] : ['position', 'rotation'];
	// The candidate reports the field it touched; the guard grants only the yaw
	// component of it, so pitch and roll still compare exactly.
	const scopeFields = input.yaw === undefined ? ['position'] : ['position', YAW_SCOPE_FIELD];
	return finalize({
		context: input.context,
		operationKind: 'place-on-floor',
		next,
		fields,
		scope: {
			changedEntityIds: [target.entity.id],
			changedEntityFields: scopeFields,
			createdEntityIds: [],
			removedEntityIds: [],
			allowClusterCleanup: false
		},
		correspondence: [{ relation: 'preserved', entityId: target.entity.id }],
		support: support.support
	});
}

/**
 * `create-form` — one native form from a drawn outline.
 *
 * The outline is validated and canonicalized before keys are assigned in ring
 * order, then recentred so its evaluated profile bounds sit at the local origin
 * (and an elevation form's lowest point rests at local Y = 0). The world base
 * origin moves by the same horizontal offset, so the body stays where it was
 * drawn while the source gains a stable local frame. Floor support is resolved
 * exactly as `place-on-floor` resolves it; no renderer hit or guessed elevation
 * enters the pose.
 */
export function planCreateForm(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly plane: SceneFormPlane;
	readonly outline: readonly { readonly u: number; readonly v: number; readonly smooth: boolean }[];
	readonly extent: number;
	readonly position: Vec3;
	readonly yaw: number;
	readonly materialId: MaterialId;
	readonly name: string;
	readonly choice?: SceneSupportChoice | undefined;
}): SceneOperationResult {
	const scene = input.context.scene;
	if (input.outline.length < PROFILE_LIMITS.minAnchors || input.outline.length > PROFILE_LIMITS.maxAnchors) {
		return invalid(
			`A form outline needs ${PROFILE_LIMITS.minAnchors}–${PROFILE_LIMITS.maxAnchors} anchors.`,
			['outline']
		);
	}
	if (
		input.position.length !== 3 ||
		input.position.some((value) => !Number.isFinite(value)) ||
		!Number.isFinite(input.yaw)
	) {
		return invalid('A form needs a finite world position and yaw.', ['position', 'yaw']);
	}
	if (!Number.isFinite(input.extent)) {
		return invalid('A form needs a finite extent.', ['extent']);
	}
	if (scene.entities.some((entity) => entity.id === input.entityId)) {
		return invalid(
			`Captured form id "${input.entityId}" is already used by the accepted source; it is never renamed.`,
			['entityId', 'duplicate-entity-id']
		);
	}

	// Provisional ids let the one profile validator report its typed reason.
	// Winding is canonicalized first: a drawn clockwise outline is a valid
	// drawing, not a refusal, and keys are then assigned in canonical ring order.
	const provisional: ProfileAnchor[] = input.outline.map((anchor, index) => ({
		key: index + 1,
		u: anchor.u,
		v: anchor.v,
		smooth: anchor.smooth
	}));
	const canonical = canonicalizeWinding(provisional).map((anchor, index) => ({
		...anchor,
		key: index + 1
	}));
	const profileIssues = validateProfile(canonical);
	if (profileIssues.length > 0) {
		const first = profileIssues[0]!;
		return invalid(`The form outline refuses: ${first.code}.`, [
			first.code,
			...first.anchorKeys.map((key) => String(key))
		]);
	}
	let evaluated;
	try {
		evaluated = evaluateProfile(canonical);
	} catch (error) {
		return invalid(
			error instanceof GeometryCoreError
				? `The form outline refuses: ${error.issues[0]?.code ?? 'invalid-profile'}.`
				: 'The form outline could not be evaluated.',
			['outline']
		);
	}

	const centreU = (evaluated.bounds.minU + evaluated.bounds.maxU) / 2;
	const centreV =
		input.plane === 'plan'
			? (evaluated.bounds.minV + evaluated.bounds.maxV) / 2
			: evaluated.bounds.minV;
	const outline = canonical.map((anchor) => ({
		...anchor,
		u: anchor.u - centreU,
		v: anchor.v - centreV
	}));
	let shifted;
	try {
		shifted = evaluateProfile(outline);
		// The same limits the renderer and every resize enforce; a form that could
		// never render must not become accepted source.
		extrudeProfile({
			profile: shifted,
			extent: input.extent,
			scale: [1, 1, 1],
			plane: input.plane
		});
	} catch (error) {
		return invalid(
			error instanceof GeometryCoreError ? error.message : 'The form body is outside the admitted limits.',
			['outline', 'extent']
		);
	}

	const cos = Math.cos(input.yaw);
	const sin = Math.sin(input.yaw);
	const offsetV = input.plane === 'plan' ? centreV : 0;
	const point: LayoutVec2 = [
		input.position[0] + centreU * cos + offsetV * sin,
		input.position[2] - centreU * sin + offsetV * cos
	];
	if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
		return invalid('The form base origin is not finite.', ['position']);
	}
	const support = resolveSupport(input.context, point, null, input.choice);
	if (support.kind !== 'resolved') return support;

	const contact = input.plane === 'plan' ? 0 : shifted.bounds.minV;
	const entity: SceneFormEntity = {
		kind: 'form',
		id: input.entityId,
		name: input.name,
		position: [point[0], support.support.elevation - contact, point[1]],
		rotation: [0, input.yaw, 0],
		form: {
			generator: {
				kind: 'extrude',
				plane: input.plane,
				outline,
				extent: input.extent
			},
			scale: [1, 1, 1],
			nextKey: outline.length + 1
		},
		materialId: input.materialId,
		castShadow: true,
		receiveShadow: true
	};
	const after: SceneDocument = { ...scene, entities: [...scene.entities, entity] };
	const finalized = finalizeSceneCandidate({
		before: scene,
		after,
		scope: {
			operationKind: 'create-form',
			changedEntityIds: [],
			changedEntityFields: [],
			createdEntityIds: [input.entityId],
			removedEntityIds: [],
			allowClusterCleanup: false
		}
	});
	if (finalized.kind === 'rejected') return fromFinalization(finalized);
	return {
		kind: 'candidate',
		operationKind: 'create-form',
		entityId: input.entityId,
		scene: finalized.scene,
		fields: ['entities'],
		correspondence: [{ relation: 'created', entityId: input.entityId }],
		support: support.support,
		worldPose: {
			position: [...entity.position] as Vec3,
			rotation: [...entity.rotation] as Vec3,
			scale: 1
		},
		diagnostics: []
	};
}

/**
 * `place-form-copy` — one detached copy of a saved My Objects form.
 *
 * The saved payload is the source: its outline, keys, per-axis scale and
 * `nextKey` are written verbatim, so the copy evaluates to the same body as the
 * item and the original. The planner re-reads the payload through the shared
 * strict codec, re-evaluates the body, and refuses a captured contact that
 * disagrees with it. A new entity id is allocated by the caller; the copy holds
 * no reference to the library item, so later edits never reach either side.
 */
export function planPlaceFormCopy(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly item: FormLibraryPayload;
	readonly worldXZ: LayoutVec2;
	readonly yaw: number;
	readonly contactMinY: number;
	readonly choice?: SceneSupportChoice | undefined;
}): SceneOperationResult {
	const scene = input.context.scene;
	if (scene.entities.some((entity) => entity.id === input.entityId)) {
		return invalid(
			`Captured copy id "${input.entityId}" is already used by the accepted source; it is never renamed.`,
			['entityId', 'duplicate-entity-id']
		);
	}
	const parsed = readFormLibraryPayload(input.item);
	if (!parsed.success) {
		return invalid(
			`The saved form copy refuses: ${parsed.issues[0]?.message ?? 'invalid library item'}.`,
			parsed.issues.map((issue) => `${issue.path}: ${issue.code}`)
		);
	}
	if (
		input.worldXZ.length !== 2 ||
		input.worldXZ.some((value) => !Number.isFinite(value)) ||
		!Number.isFinite(input.yaw) ||
		!Number.isFinite(input.contactMinY)
	) {
		return invalid('A form copy needs a finite world X/Z, yaw and captured contact.', [
			'worldXZ',
			'yaw',
			'contactMinY'
		]);
	}
	let mesh;
	try {
		mesh = evaluateSceneForm(parsed.payload.form);
	} catch (error) {
		return invalid(
			error instanceof GeometryCoreError ? error.message : 'The saved form body could not be evaluated.',
			['item']
		);
	}
	if (Math.abs(input.contactMinY - mesh.contactMinY) > CONTACT_TOLERANCE_METERS) {
		return invalid(
			`The captured contact ${input.contactMinY} disagrees with the saved form's evaluated contact ${mesh.contactMinY}.`,
			['contactMinY']
		);
	}
	const support = resolveSupport(input.context, [input.worldXZ[0], input.worldXZ[1]], null, input.choice);
	if (support.kind !== 'resolved') return support;

	const entity: SceneFormEntity = {
		kind: 'form',
		id: input.entityId,
		name: parsed.payload.name,
		position: [input.worldXZ[0], support.support.elevation - mesh.contactMinY, input.worldXZ[1]],
		rotation: [0, input.yaw, 0],
		form: cloneFormSource(parsed.payload.form),
		materialId: parsed.payload.materialId,
		castShadow: parsed.payload.castShadow,
		receiveShadow: parsed.payload.receiveShadow
	};
	const after: SceneDocument = { ...scene, entities: [...scene.entities, entity] };
	const finalized = finalizeSceneCandidate({
		before: scene,
		after,
		scope: {
			operationKind: 'place-form-copy',
			changedEntityIds: [],
			changedEntityFields: [],
			createdEntityIds: [input.entityId],
			removedEntityIds: [],
			allowClusterCleanup: false
		}
	});
	if (finalized.kind === 'rejected') return fromFinalization(finalized);
	return {
		kind: 'candidate',
		operationKind: 'place-form-copy',
		entityId: input.entityId,
		scene: finalized.scene,
		fields: ['entities'],
		correspondence: [{ relation: 'created', entityId: input.entityId }],
		support: support.support,
		worldPose: {
			position: [...entity.position] as Vec3,
			rotation: [...entity.rotation] as Vec3,
			scale: 1
		},
		diagnostics: []
	};
}

/**
 * `set-form-size` — one full per-axis scale, resting on the same support.
 *
 * It owns `form.scale` and the compensating Y only. The authored outline is
 * never rewritten, so repeated resizes cannot drift the drawn controls; the
 * captured contact and scaled dimensions are re-derived from the canonical
 * evaluation before anything is installed.
 */
export function planSetFormSize(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly scale: readonly [number, number, number];
	readonly choice?: SceneSupportChoice | undefined;
}): SceneOperationResult {
	const target = readObject(input.context.scene, input.entityId);
	if (target.kind !== 'object') return target;
	if (target.entity.kind !== 'form') {
		return refusal(
			'unsupported-transform',
			`Entity "${input.entityId}" is not a native form; only forms are sized per axis.`,
			[input.entityId]
		);
	}
	const entity = target.entity;
	const scale = input.scale;
	if (
		scale.length !== 3 ||
		scale.some(
			(value) =>
				!Number.isFinite(value) ||
				value < PROFILE_LIMITS.minScale ||
				value > PROFILE_LIMITS.maxScale
		)
	) {
		return invalid(
			`A form size needs three finite per-axis factors within [${PROFILE_LIMITS.minScale}, ${PROFILE_LIMITS.maxScale}].`,
			['scale']
		);
	}
	if (entity.form.scale.every((value, index) => value === scale[index])) {
		return refusal('no_op', `Entity "${input.entityId}" already has scale ${scale.join(', ')}.`, [
			'scale'
		]);
	}
	let profile;
	try {
		profile = evaluateProfile(entity.form.generator.outline);
		extrudeProfile({
			profile,
			extent: entity.form.generator.extent,
			scale,
			plane: entity.form.generator.plane
		});
	} catch (error) {
		return invalid(
			error instanceof GeometryCoreError ? error.message : 'The form body is outside the admitted limits.',
			['scale']
		);
	}
	const contact = entity.form.generator.plane === 'plan' ? 0 : profile.bounds.minV;
	const currentContact = contact * entity.form.scale[1];
	const nextContact = contact * scale[1];
	const resting = entity.position[1] + currentContact;
	const support = resolveSupport(
		input.context,
		[entity.position[0], entity.position[2]],
		resting,
		input.choice
	);
	if (support.kind !== 'resolved') return support;

	const next: SceneEntity = {
		...entity,
		position: [entity.position[0], support.support.elevation - nextContact, entity.position[2]],
		form: { ...entity.form, scale: [scale[0], scale[1], scale[2]] }
	};
	return finalize({
		context: input.context,
		operationKind: 'set-form-size',
		next,
		fields: ['form', 'position'],
		scope: {
			changedEntityIds: [entity.id],
			changedEntityFields: [FORM_SCALE_SCOPE_FIELD, 'position[1]'],
			createdEntityIds: [],
			removedEntityIds: [],
			allowClusterCleanup: false
		},
		correspondence: [{ relation: 'preserved', entityId: entity.id }],
		support: support.support
	});
}

export function planResizeOnFloor(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly scale: number;
	readonly contactMinY: number;
	readonly choice?: SceneSupportChoice | undefined;
}): SceneOperationResult {
	const target = readObject(input.context.scene, input.entityId);
	if (target.kind !== 'object') return target;
	if (target.entity.kind === 'form') {
		return refusal(
			'unsupported-transform',
			`Entity "${input.entityId}" is a native form; forms are sized per axis with set-form-size, never by a uniform entity scale.`,
			[input.entityId]
		);
	}
	const contact = readContactMinY(target.entity, input.contactMinY);
	if (contact.kind !== 'value') return contact;
	if (!upright(target.entity)) return unsupportedTransform(input.entityId, 'resize-on-floor');
	if (!Number.isFinite(input.scale) || input.scale <= 0) {
		return invalid('Resize needs one finite positive uniform scale.', ['scale']);
	}
	const currentScale = entityScale(target.entity);
	if (input.scale === currentScale) {
		return refusal('no_op', `Entity "${input.entityId}" already has scale ${input.scale}.`, [
			'scale'
		]);
	}

	const point: LayoutVec2 = [target.entity.position[0], target.entity.position[2]];
	const resting = restingElevation(target.entity, contact.value);
	const support = resolveSupport(input.context, point, resting, input.choice);
	if (support.kind !== 'resolved') return support;

	const y = support.support.elevation - input.scale * contact.value;
	const next: SceneEntity = {
		...target.entity,
		position: [target.entity.position[0], y, target.entity.position[2]],
		scale: input.scale
	};
	return finalize({
		context: input.context,
		operationKind: 'resize-on-floor',
		next,
		fields: ['position', 'scale'],
		scope: {
			changedEntityIds: [target.entity.id],
			changedEntityFields: ['position[1]', 'scale'],
			createdEntityIds: [],
			removedEntityIds: [],
			allowClusterCleanup: false
		},
		correspondence: [{ relation: 'preserved', entityId: target.entity.id }],
		support: support.support
	});
}

export function planDuplicateOne(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly newEntityId: string;
	readonly contactMinY: number;
	readonly choice?: SceneSupportChoice | undefined;
}): SceneOperationResult {
	const scene = input.context.scene;
	const target = readObject(scene, input.entityId);
	if (target.kind !== 'object') return target;
	const contact = readContactMinY(target.entity, input.contactMinY);
	if (contact.kind !== 'value') return contact;
	if (!upright(target.entity)) return unsupportedTransform(input.entityId, 'duplicate-one');
	if (typeof input.newEntityId !== 'string' || input.newEntityId.trim().length === 0) {
		return invalid('Duplicate needs a captured new entity id.', ['newEntityId']);
	}
	if (scene.entities.some((entity) => entity.id === input.newEntityId)) {
		return invalid(
			`Captured duplicate id "${input.newEntityId}" is already used by the accepted source; it is never renamed.`,
			['newEntityId', 'duplicate-entity-id']
		);
	}
	const cluster = (scene.clusters ?? []).find((candidate) =>
		candidate.memberIds.includes(input.entityId)
	);
	if (cluster !== undefined) {
		return refusal(
			'unsupported-set',
			`Entity "${input.entityId}" belongs to cluster "${cluster.id}". Duplicating a cluster member would silently change grouping; set duplication is not supported in this phase.`,
			[cluster.id]
		);
	}

	const resting = restingElevation(target.entity, contact.value);
	const point: LayoutVec2 = [
		target.entity.position[0] + DUPLICATE_OFFSET_METERS,
		target.entity.position[2] + DUPLICATE_OFFSET_METERS
	];
	const support = resolveSupport(input.context, point, resting, input.choice);
	if (support.kind !== 'resolved') return support;

	const duplicate: SceneEntity = {
		...cloneEntityWithId(target.entity, input.newEntityId),
		position: [
			target.entity.position[0] + DUPLICATE_OFFSET_METERS,
			target.entity.position[1],
			target.entity.position[2] + DUPLICATE_OFFSET_METERS
		]
	};
	const after: SceneDocument = { ...scene, entities: [...scene.entities, duplicate] };
	const finalized = finalizeSceneCandidate({
		before: scene,
		after,
		scope: {
			operationKind: 'duplicate-one',
			changedEntityIds: [],
			changedEntityFields: [],
			createdEntityIds: [input.newEntityId],
			removedEntityIds: [],
			allowClusterCleanup: false
		}
	});
	if (finalized.kind === 'rejected') return fromFinalization(finalized);

	return {
		kind: 'candidate',
		operationKind: 'duplicate-one',
		entityId: input.newEntityId,
		scene: finalized.scene,
		fields: ['entities'],
		correspondence: [{ relation: 'created', entityId: input.newEntityId }],
		support: support.support,
		worldPose: {
			position: [...duplicate.position],
			rotation: [...duplicate.rotation],
			scale: entityScale(duplicate)
		},
		diagnostics: [note(`duplicate-of:${input.entityId}`), note(`offset-meters:${DUPLICATE_OFFSET_METERS}`)]
	};
}

export function planDeleteOne(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
}): SceneOperationResult {
	const scene = input.context.scene;
	const target = scene.entities.find((entity) => entity.id === input.entityId);
	if (target === undefined) {
		return refusal('missing-target', `No Scene entity "${input.entityId}" exists in the accepted source.`, [
			input.entityId
		]);
	}
	const entities = scene.entities.filter((entity) => entity.id !== input.entityId);
	const clusters = cleanupClusters(scene.clusters, [input.entityId]);
	const after: SceneDocument = {
		...scene,
		entities,
		...(clusters === undefined ? { clusters: undefined } : { clusters })
	};
	if (clusters === undefined) delete after.clusters;
	const finalized = finalizeSceneCandidate({
		before: scene,
		after,
		scope: {
			operationKind: 'delete-one',
			changedEntityIds: [],
			changedEntityFields: [],
			createdEntityIds: [],
			removedEntityIds: [input.entityId],
			allowClusterCleanup: true
		}
	});
	const clustersChanged = !sameSceneValues(scene.clusters ?? [], clusters ?? []);
	const fields = clusters === undefined || scene.clusters === undefined || !clustersChanged
		? ['entities']
		: ['entities', 'clusters'];
	if (finalized.kind === 'rejected') return fromFinalization(finalized);
	return {
		kind: 'candidate',
		operationKind: 'delete-one',
		entityId: input.entityId,
		scene: finalized.scene,
		fields,
		correspondence: [{ relation: 'retired', entityId: input.entityId }],
		diagnostics: (scene.clusters ?? []).some((cluster) => cluster.memberIds.includes(input.entityId))
			? [note('cluster-membership-cleaned')]
			: []
	};
}

/**
 * `place-object` is S01's prepared candidate, wrapped here with the same
 * record-scope finalization every other operation uses. Keeping the placement
 * math in one place is what stops Plan and 3D input from diverging.
 */
export function finalizePlacedEntity(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly scene: SceneDocument;
}): SceneOperationResult {
	const finalized = finalizeSceneCandidate({
		before: input.context.scene,
		after: input.scene,
		scope: {
			operationKind: 'place-object',
			changedEntityIds: [],
			changedEntityFields: [],
			createdEntityIds: [input.entityId],
			removedEntityIds: [],
			allowClusterCleanup: false
		}
	});
	if (finalized.kind === 'rejected') return fromFinalization(finalized);
	return {
		kind: 'candidate',
		operationKind: 'place-object',
		entityId: input.entityId,
		scene: finalized.scene,
		fields: ['entities'],
		correspondence: [{ relation: 'created', entityId: input.entityId }],
		diagnostics: []
	};
}

function finalize(input: {
	readonly context: SceneOperationContext;
	readonly operationKind: SceneOperationKind;
	readonly next: SceneEntity;
	readonly fields: readonly string[];
	readonly scope: Omit<SceneRecordScope, 'operationKind'>;
	readonly correspondence: readonly SceneOperationCorrespondence[];
	readonly support?: SceneOperationSupportEvidence;
}): SceneOperationResult {
	const before = input.context.scene;
	const after: SceneDocument = {
		...before,
		entities: before.entities.map((entity) => (entity.id === input.next.id ? input.next : entity))
	};
	if (sameSceneValues(after, before)) {
		return refusal('no_op', `The ${input.operationKind} operation leaves the accepted source unchanged.`, []);
	}
	const finalized = finalizeSceneCandidate({
		before,
		after,
		scope: { operationKind: input.operationKind, ...input.scope }
	});
	if (finalized.kind === 'rejected') return fromFinalization(finalized);
	return {
		kind: 'candidate',
		operationKind: input.operationKind,
		entityId: input.next.id,
		scene: finalized.scene,
		fields: input.fields,
		correspondence: input.correspondence,
		...(input.support === undefined ? {} : { support: input.support }),
		worldPose: {
			position: [...input.next.position],
			rotation: [...input.next.rotation],
			scale: entityScale(input.next)
		},
		diagnostics: []
	};
}

function resolveSupport(
	context: SceneOperationContext,
	point: LayoutVec2,
	requiredElevation: number | null,
	choice: SceneSupportChoice | undefined
): { readonly kind: 'resolved'; readonly support: SceneOperationSupportEvidence } | SceneOperationRefusal {
	const resolution = resolveSceneSupport({
		layout: context.layout,
		sourceContentId: context.sourceContentId,
		point,
		requiredElevation,
		...(choice === undefined ? {} : { choice })
	});
	if (resolution.kind === 'resolved') {
		return {
			kind: 'resolved',
			support: {
				elevation: resolution.support.elevation,
				generationId: resolution.generationId,
				orderKey: resolution.support.orderKey,
				witnesses: resolution.support.witnesses.map((witness) => ({
					floorId: witness.floorId,
					roomId: witness.roomId,
					recordId: witness.recordId
				}))
			}
		};
	}
	return refusal(
		resolution.code,
		resolution.message,
		resolution.candidates.map(
			(candidate) => `${candidate.orderKey} · ${candidate.label} at ${candidate.elevation} m`
		)
	);
}

/**
 * Whether the floor-transform planners may own this entity at all, with the
 * exact refusal they would give.
 *
 * The editor's Compose surface reads this same predicate, so a disabled control
 * and a planner refusal cannot disagree: lights, vertical planes, tilted
 * primitives and primitives without an analytic contact are all unsupported.
 * This is not a second capability model — it is the planner's own gate, exposed
 * for the one UI that must not offer a command it cannot run.
 */
export type FloorTransformSupport =
	| { readonly supported: true }
	| {
			readonly supported: false;
			readonly code: 'unsupported-transform';
			readonly message: string;
	  };

export function floorTransformSupport(entity: SceneEntity): FloorTransformSupport {
	if (entity.kind === 'light') {
		return {
			supported: false,
			code: 'unsupported-transform',
			message: `Entity "${entity.id}" is a light; lights have no object footprint or floor placement to transform.`
		};
	}
	if (entity.kind === 'primitive' && entity.primitive === 'plane') {
		return {
			supported: false,
			code: 'unsupported-transform',
			message: `Entity "${entity.id}" is a vertical plane, which has no honest floor footprint for this operation.`
		};
	}
	if (!upright(entity)) {
		return {
			supported: false,
			code: 'unsupported-transform',
			message: `Entity "${entity.id}" is not a truthful upright floor object, so this operation cannot own its transform.`
		};
	}
	if (entity.kind === 'form') {
		if (sceneFormContactMinY(entity.form) === null) {
			return {
				supported: false,
				code: 'unsupported-transform',
				message: `Entity "${entity.id}" has no honest floor contact, so this operation cannot own its transform.`
			};
		}
		return { supported: true };
	}
	if (entity.kind === 'primitive' && analyticalContactMinY(entity) === null) {
		return {
			supported: false,
			code: 'unsupported-transform',
			message: `Entity "${entity.id}" has no honest floor footprint for this operation.`
		};
	}
	return { supported: true };
}

function readObject(
	scene: SceneDocument,
	entityId: string
): { readonly kind: 'object'; readonly entity: SceneEntity } | SceneOperationRefusal {
	const entity = scene.entities.find((candidate) => candidate.id === entityId);
	if (entity === undefined) {
		return refusal('missing-target', `No Scene entity "${entityId}" exists in the accepted source.`, [
			entityId
		]);
	}
	const support = floorTransformSupport(entity);
	if (!support.supported) return refusal(support.code, support.message, [entityId]);
	return { kind: 'object', entity };
}

function readContactMinY(
	entity: SceneEntity,
	captured: number
): { readonly kind: 'value'; readonly value: number } | SceneOperationRefusal {
	if (!Number.isFinite(captured)) {
		return refusal(
			'missing-contact-metadata',
			`Entity "${entity.id}" has no finite captured contact height.`,
			['contactMinY']
		);
	}
	if (entity.kind === 'primitive') {
		const analytical = analyticalContactMinY(entity);
		if (analytical === null) return unsupportedTransform(entity.id, 'support');
		if (Math.abs(captured - analytical) > CONTACT_TOLERANCE_METERS) {
			return refusal(
				'missing-contact-metadata',
				`Entity "${entity.id}" declares contact ${captured} m but its ${entity.primitive} dimensions give ${analytical} m.`,
				['contactMinY', 'dimensions']
			);
		}
	}
	if (entity.kind === 'form') {
		const analytical = sceneFormContactMinY(entity.form);
		if (analytical === null) return unsupportedTransform(entity.id, 'support');
		if (Math.abs(captured - analytical) > CONTACT_TOLERANCE_METERS) {
			return refusal(
				'missing-contact-metadata',
				`Entity "${entity.id}" declares contact ${captured} m but its form source gives ${analytical} m.`,
				['contactMinY', 'form']
			);
		}
	}
	return { kind: 'value', value: captured };
}

function analyticalContactMinY(entity: ScenePrimitiveEntity): number | null {
	switch (entity.primitive) {
		case 'box':
			return -entity.dimensions.height / 2;
		case 'cylinder':
			return -entity.dimensions.height / 2;
		case 'sphere':
			return -entity.dimensions.radius;
		case 'plane':
			return null;
	}
}

function upright(entity: SceneEntity): boolean {
	const rotation = entity.rotation;
	return (
		Array.isArray(rotation) &&
		rotation.length === 3 &&
		rotation.every((value) => Number.isFinite(value)) &&
		Math.abs(rotation[0]) <= UPRIGHT_TOLERANCE &&
		Math.abs(rotation[2]) <= UPRIGHT_TOLERANCE
	);
}

function entityScale(entity: SceneEntity): number {
	// Admission guarantees a finite positive scale (the codec refuses anything
	// else), so this is a defensive default for a corrupt source, not a repair.
	const scale = entity.scale ?? 1;
	return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/**
 * The stored yaw when the captured angle is the same rotation, so a
 * canonicalized equivalent (e.g. 4.0 rad stored, -2.283… composed) does not
 * install a history entry for a change nobody can see.
 */
function ownedYaw(existing: number, frame: LocalInputFrame, yaw: number): number {
	const next = frameYawToWorld(frame, yaw);
	const delta = Math.abs(Math.atan2(Math.sin(next - existing), Math.cos(next - existing)));
	return delta <= UPRIGHT_TOLERANCE ? existing : next;
}

function restingElevation(entity: SceneEntity, contactMinY: number): number {
	return entity.position[1] + entityScale(entity) * contactMinY;
}

function worldPoint(
	frame: LocalInputFrame,
	worldXZ: readonly [number, number]
): LayoutVec2 | null {
	if (!Array.isArray(worldXZ) || worldXZ.length !== 2 || !worldXZ.every(Number.isFinite)) {
		return null;
	}
	const point = framePointToWorld(frame, [worldXZ[0], 0, worldXZ[1]]);
	return Number.isFinite(point[0]) && Number.isFinite(point[2]) ? [point[0], point[2]] : null;
}

function cloneEntityWithId(entity: SceneEntity, id: string): SceneEntity {
	if (entity.kind === 'form') {
		return {
			...entity,
			id,
			position: [...entity.position] as Vec3,
			rotation: [...entity.rotation] as Vec3,
			form: cloneFormSource(entity.form)
		};
	}
	if (entity.kind === 'primitive') {
		// The spread preserves the discriminated primitive; TypeScript cannot carry
		// that correlation through a union spread, so the clone states its type.
		return {
			...entity,
			id,
			position: [...entity.position] as Vec3,
			rotation: [...entity.rotation] as Vec3,
			dimensions: { ...entity.dimensions }
		} as SceneEntity;
	}
	return {
		...entity,
		id,
		position: [...entity.position] as Vec3,
		rotation: [...entity.rotation] as Vec3
	};
}

function note(message: string): ShapeIssue {
	return { path: '$.payload', code: 'operation-note', message };
}

function cleanupClusters(
	clusters: SceneDocument['clusters'],
	removedIds: readonly string[]
): SceneDocument['clusters'] {
	if (clusters === undefined) return undefined;
	return clusters
		.map((cluster) => ({
			...cluster,
			memberIds: cluster.memberIds.filter((memberId) => !removedIds.includes(memberId))
		}))
		.filter((cluster) => cluster.memberIds.length >= 2);
}

function fromFinalization(
	finalized: Extract<ReturnType<typeof finalizeSceneCandidate>, { kind: 'rejected' }>
): SceneOperationRefusal {
	return {
		kind: 'rejected',
		code: finalized.code,
		message: finalized.message,
		diagnostics: finalized.diagnostics
	};
}

function unsupportedTransform(entityId: string, operation: string): SceneOperationRefusal {
	return refusal(
		'unsupported-transform',
		`Entity "${entityId}" is not a truthful upright floor object, so ${operation} cannot own its transform.`,
		[entityId]
	);
}

function invalidFrame(): SceneOperationRefusal {
	return refusal(
		'invalid-value',
		'The operation needs a finite yaw-only input frame and a finite yaw.',
		['frame', 'yaw']
	);
}

function nonFinitePoint(): SceneOperationRefusal {
	return refusal(
		'invalid-value',
		'The destination X/Z (or its composed world point) is not finite.',
		['worldXZ']
	);
}

function invalid(message: string, diagnostics: readonly string[]): SceneOperationRefusal {
	return refusal('invalid-value', message, diagnostics);
}

function refusal(
	code: SceneOperationRefusalCode,
	message: string,
	diagnostics: readonly string[]
): SceneOperationRefusal {
	return {
		kind: 'rejected',
		code,
		message,
		diagnostics: diagnostics.map((entry) => ({
			path: '$.payload',
			code: 'operation-refusal',
			message: entry
		}))
	};
}
