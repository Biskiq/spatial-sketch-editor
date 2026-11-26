import {
	canonicalizeWinding,
	evaluateProfile,
	extrudeProfile,
	GeometryCoreError,
	PROFILE_LIMITS,
	validateProfile,
	type ProfileAnchor,
} from '@portfolio/geometry-core';
import { type LayoutVec2 } from '@portfolio/layout-core/geometry';
import { evaluateSceneForm, sceneFormContactMinY } from '../../form';
import { readFormLibraryPayload, type FormLibraryPayload } from '../../library/form-library';
import {
	cloneFormSource,
	type MaterialId,
	type SceneEntity,
	type SceneFormEntity,
	type SceneFormPlane,
	type Vec3,
} from '../../scene';
import { finalize, fromFinalization } from './finalization';
import { invalid, refusal } from './refusals';
import { resolveSupport, restSupport, readObject } from './support';
import {
	type SceneOperationResult,
	type SceneOperationContext,
	CONTACT_TOLERANCE_METERS,
	FORM_SCALE_SCOPE_FIELD,
	FORM_GENERATOR_SCOPE_FIELD,
} from './types';
import { finalizeSceneCandidate } from '../record-scope';
import { type SceneSupportChoice } from '../support';
import { type CameraFreeSceneDocument as SceneDocument } from '../../units/types';

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
	if (
		input.outline.length < PROFILE_LIMITS.minAnchors ||
		input.outline.length > PROFILE_LIMITS.maxAnchors
	) {
		return invalid(
			`A form outline needs ${PROFILE_LIMITS.minAnchors}–${PROFILE_LIMITS.maxAnchors} anchors.`,
			['outline'],
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
			['entityId', 'duplicate-entity-id'],
		);
	}

	// Provisional ids let the one profile validator report its typed reason.
	// Winding is canonicalized first: a drawn clockwise outline is a valid
	// drawing, not a refusal, and keys are then assigned in canonical ring order.
	const provisional: ProfileAnchor[] = input.outline.map((anchor, index) => ({
		key: index + 1,
		u: anchor.u,
		v: anchor.v,
		smooth: anchor.smooth,
	}));
	const canonical = canonicalizeWinding(provisional).map((anchor, index) => ({
		...anchor,
		key: index + 1,
	}));
	const profileIssues = validateProfile(canonical);
	if (profileIssues.length > 0) {
		const first = profileIssues[0]!;
		return invalid(`The form outline refuses: ${first.code}.`, [
			first.code,
			...first.anchorKeys.map((key) => String(key)),
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
			['outline'],
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
		v: anchor.v - centreV,
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
			plane: input.plane,
		});
	} catch (error) {
		return invalid(
			error instanceof GeometryCoreError
				? error.message
				: 'The form body is outside the admitted limits.',
			['outline', 'extent'],
		);
	}

	const cos = Math.cos(input.yaw);
	const sin = Math.sin(input.yaw);
	const offsetV = input.plane === 'plan' ? centreV : 0;
	const point: LayoutVec2 = [
		input.position[0] + centreU * cos + offsetV * sin,
		input.position[2] - centreU * sin + offsetV * cos,
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
				extent: input.extent,
			},
			scale: [1, 1, 1],
			nextKey: outline.length + 1,
		},
		materialId: input.materialId,
		castShadow: true,
		receiveShadow: true,
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
			allowClusterCleanup: false,
		},
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
			scale: 1,
		},
		diagnostics: [],
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
			['entityId', 'duplicate-entity-id'],
		);
	}
	const parsed = readFormLibraryPayload(input.item);
	if (!parsed.success) {
		return invalid(
			`The saved form copy refuses: ${parsed.issues[0]?.message ?? 'invalid library item'}.`,
			parsed.issues.map((issue) => `${issue.path}: ${issue.code}`),
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
			'contactMinY',
		]);
	}
	let mesh;
	try {
		mesh = evaluateSceneForm(parsed.payload.form);
	} catch (error) {
		return invalid(
			error instanceof GeometryCoreError
				? error.message
				: 'The saved form body could not be evaluated.',
			['item'],
		);
	}
	if (Math.abs(input.contactMinY - mesh.contactMinY) > CONTACT_TOLERANCE_METERS) {
		return invalid(
			`The captured contact ${input.contactMinY} disagrees with the saved form's evaluated contact ${mesh.contactMinY}.`,
			['contactMinY'],
		);
	}
	const support = resolveSupport(
		input.context,
		[input.worldXZ[0], input.worldXZ[1]],
		null,
		input.choice,
	);
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
		receiveShadow: parsed.payload.receiveShadow,
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
			allowClusterCleanup: false,
		},
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
			scale: 1,
		},
		diagnostics: [],
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
			[input.entityId],
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
				value > PROFILE_LIMITS.maxScale,
		)
	) {
		return invalid(
			`A form size needs three finite per-axis factors within [${PROFILE_LIMITS.minScale}, ${PROFILE_LIMITS.maxScale}].`,
			['scale'],
		);
	}
	if (entity.form.scale.every((value, index) => value === scale[index])) {
		return refusal('no_op', `Entity "${input.entityId}" already has scale ${scale.join(', ')}.`, [
			'scale',
		]);
	}
	let profile;
	try {
		profile = evaluateProfile(entity.form.generator.outline);
		extrudeProfile({
			profile,
			extent: entity.form.generator.extent,
			scale,
			plane: entity.form.generator.plane,
		});
	} catch (error) {
		return invalid(
			error instanceof GeometryCoreError
				? error.message
				: 'The form body is outside the admitted limits.',
			['scale'],
		);
	}
	const contact = entity.form.generator.plane === 'plan' ? 0 : profile.bounds.minV;
	const currentContact = contact * entity.form.scale[1];
	const nextContact = contact * scale[1];
	const rest = restSupport(input.context, entity, currentContact, input.choice);
	if (rest.kind !== 'resolved') return rest;
	const support = { support: rest.support };

	const next: SceneEntity = {
		...entity,
		position: [
			entity.position[0],
			support.support.elevation + rest.lift - nextContact,
			entity.position[2],
		],
		form: { ...entity.form, scale: [scale[0], scale[1], scale[2]] },
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
			allowClusterCleanup: false,
		},
		correspondence: [{ relation: 'preserved', entityId: entity.id }],
		support: support.support,
	});
}

/**
 * `set-form-profile` — revise the existing outline and extrusion extent.
 *
 * The generator is edited in place: every captured anchor keeps the key and the
 * ring position the accepted source already gave it, and the extent stays a
 * positive source value. The planner validates the whole candidate with the one
 * profile/extrusion evaluator at the current per-axis scale, then preserves the
 * resting elevation exactly as `set-form-size` does: an elevation form's
 * evaluated contact is reapplied, a plan form rests at its local zero, and a
 * lifted form keeps its declared lift above the support beneath it. Plane,
 * rotation, whole-form scale, `nextKey` and the entity identity are untouched.
 *
 * Adding, removing or reordering anchors and changing the generator's plane are
 * later capabilities; a payload that tries either refuses instead of allocating
 * a key or inventing a new source.
 */
export function planSetFormProfile(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly outline: readonly {
		readonly key: number;
		readonly u: number;
		readonly v: number;
		readonly smooth: boolean;
	}[];
	readonly extent: number;
	readonly choice?: SceneSupportChoice | undefined;
}): SceneOperationResult {
	const target = readObject(input.context.scene, input.entityId);
	if (target.kind !== 'object') return target;
	if (target.entity.kind !== 'form') {
		return refusal(
			'unsupported-transform',
			`Entity "${input.entityId}" is not a native form; only a form has an editable outline.`,
			[input.entityId],
		);
	}
	const entity = target.entity;
	const existingOutline = entity.form.generator.outline;
	if (!Array.isArray(input.outline) || input.outline.length !== existingOutline.length) {
		return invalid(
			`A profile revision keeps the form's ${existingOutline.length} existing anchors; adding or removing anchors is later work.`,
			['outline', 'anchor-count'],
		);
	}
	for (let index = 0; index < input.outline.length; index += 1) {
		const anchor = input.outline[index];
		const existing = existingOutline[index]!;
		if (anchor === null || typeof anchor !== 'object' || anchor.key !== existing.key) {
			return invalid(
				'A profile revision keeps every existing outline key in its existing ring order; keys are never added, removed or reordered.',
				['outline', 'keys'],
			);
		}
	}
	if (
		!Number.isFinite(input.extent) ||
		input.extent < PROFILE_LIMITS.minExtentMeters ||
		input.extent > PROFILE_LIMITS.maxExtentMeters
	) {
		return invalid(
			`A form extent must be finite and within [${PROFILE_LIMITS.minExtentMeters}, ${PROFILE_LIMITS.maxExtentMeters}] m.`,
			['extent'],
		);
	}

	const outline: ProfileAnchor[] = input.outline.map((anchor) => ({
		key: anchor.key,
		u: anchor.u,
		v: anchor.v,
		smooth: anchor.smooth,
	}));
	if (
		input.extent === entity.form.generator.extent &&
		outline.every((anchor, index) => {
			const existing = existingOutline[index]!;
			return (
				anchor.u === existing.u && anchor.v === existing.v && anchor.smooth === existing.smooth
			);
		})
	) {
		return refusal('no_op', `Entity "${entity.id}" already has this outline and extent.`, [
			'outline',
			'extent',
		]);
	}

	const issues = validateProfile(outline);
	if (issues.length > 0) {
		const first = issues[0]!;
		return invalid(`The form outline refuses: ${first.code}.`, [
			first.code,
			...first.anchorKeys.map((key) => String(key)),
		]);
	}
	let profile;
	try {
		profile = evaluateProfile(outline);
		extrudeProfile({
			profile,
			extent: input.extent,
			scale: entity.form.scale,
			plane: entity.form.generator.plane,
		});
	} catch (error) {
		return invalid(
			error instanceof GeometryCoreError
				? error.message
				: 'The revised form body is outside the admitted limits.',
			['outline', 'extent'],
		);
	}

	const plane = entity.form.generator.plane;
	const currentContact = sceneFormContactMinY(entity.form);
	if (currentContact === null) {
		return refusal(
			'unsupported-transform',
			`Entity "${entity.id}" has no honest floor contact, so a profile revision cannot own its placement.`,
			[entity.id],
		);
	}
	const nextContact = plane === 'plan' ? 0 : profile.bounds.minV * entity.form.scale[1];
	const rest = restSupport(input.context, entity, currentContact, input.choice);
	if (rest.kind !== 'resolved') return rest;

	const next: SceneEntity = {
		...entity,
		position: [
			entity.position[0],
			rest.support.elevation + rest.lift - nextContact,
			entity.position[2],
		],
		form: {
			...entity.form,
			generator: {
				...entity.form.generator,
				outline: outline.map((anchor) => ({ ...anchor })),
				extent: input.extent,
			},
		},
	};
	return finalize({
		context: input.context,
		operationKind: 'set-form-profile',
		next,
		fields: ['form', 'position'],
		scope: {
			changedEntityIds: [entity.id],
			changedEntityFields: [FORM_GENERATOR_SCOPE_FIELD, 'position[1]'],
			createdEntityIds: [],
			removedEntityIds: [],
			allowClusterCleanup: false,
		},
		correspondence: [{ relation: 'preserved', entityId: entity.id }],
		support: rest.support,
	});
}
