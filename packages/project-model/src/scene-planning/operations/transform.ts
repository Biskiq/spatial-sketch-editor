import { type SceneEntity, type Vec3 } from '../../scene';
import { isFinitePlacementFrame } from '../frame';
import { finalize } from './finalization';
import { unsupportedTransform, invalidFrame, nonFinitePoint, invalid, refusal } from './refusals';
import { resolveSupport, readContactMinY, upright, entityScale, ownedYaw, restSupport, worldPoint, readObject } from './support';
import { type SceneOperationResult, type SceneOperationContext, CONTACT_TOLERANCE_METERS, YAW_SCOPE_FIELD, SCENE_LIFT_LIMIT_METERS } from './types';
import { type SceneSupportChoice } from '../support';
import { type LocalInputFrame } from '../types';

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
	const rest = restSupport(input.context, target.entity, contact.value, input.choice);
	if (rest.kind !== 'resolved') return rest;
	const support = resolveSupport(input.context, point, rest.lift > 0 ? null : rest.resting, input.choice);
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

	// A lifted object keeps its lift above the new support; a resting one rests.
	const rest = restSupport(input.context, target.entity, contact.value, input.choice);
	const lift = rest.kind === 'resolved' ? rest.lift : 0;
	const scale = entityScale(target.entity);
	const y = support.support.elevation + lift - scale * contact.value;
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

export function planResizeOnFloor(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly scale: number;
	readonly contactMinY: number;
	readonly choice?: SceneSupportChoice | undefined;
}): SceneOperationResult {
	const target = readObject(input.context.scene, input.entityId);
	if (target.kind !== 'object') return target;
	if (target.entity.kind === 'artwork') return unsupportedTransform(input.entityId, 'resize-on-floor');
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

	const rest = restSupport(input.context, target.entity, contact.value, input.choice);
	if (rest.kind !== 'resolved') return rest;
	const support = { support: rest.support };

	const y = support.support.elevation + rest.lift - input.scale * contact.value;
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

/**
 * `set-lift` — put the object's base `lift` meters above the support beneath it.
 *
 * Lift 0 is ordinary resting. The support is re-derived at the object's own X/Z
 * exactly as every other planner derives it; only Y changes, so X/Z, rotation,
 * scale and every other value compare exactly.
 */
export function planSetLift(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly lift: number;
	readonly contactMinY: number;
	readonly choice?: SceneSupportChoice | undefined;
}): SceneOperationResult {
	const target = readObject(input.context.scene, input.entityId);
	if (target.kind !== 'object') return target;
	const contact = readContactMinY(target.entity, input.contactMinY);
	if (contact.kind !== 'value') return contact;
	if (!upright(target.entity)) return unsupportedTransform(input.entityId, 'set-lift');
	if (!Number.isFinite(input.lift) || input.lift < 0 || input.lift > SCENE_LIFT_LIMIT_METERS) {
		return invalid(`A lift must be between 0 and ${SCENE_LIFT_LIMIT_METERS} m.`, ['lift']);
	}
	const rest = restSupport(input.context, target.entity, contact.value, input.choice);
	if (rest.kind !== 'resolved') return rest;
	const y = rest.support.elevation + input.lift - entityScale(target.entity) * contact.value;
	if (Math.abs(y - target.entity.position[1]) <= CONTACT_TOLERANCE_METERS) {
		return refusal('no_op', `Entity "${input.entityId}" is already lifted ${input.lift} m.`, ['lift']);
	}
	const next: SceneEntity = {
		...target.entity,
		position: [target.entity.position[0], y, target.entity.position[2]]
	};
	return finalize({
		context: input.context,
		operationKind: 'set-lift',
		next,
		fields: ['position'],
		scope: {
			changedEntityIds: [target.entity.id],
			changedEntityFields: ['position[1]'],
			createdEntityIds: [],
			removedEntityIds: [],
			allowClusterCleanup: false
		},
		correspondence: [{ relation: 'preserved', entityId: target.entity.id }],
		support: rest.support
	});
}
