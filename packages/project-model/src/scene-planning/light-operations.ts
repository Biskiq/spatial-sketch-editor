/**
 * T2.S3 — the pure light operation set.
 *
 * A light is a Scene entity with no floor contact, so it cannot reuse the
 * object-transform planners. These three operations own exactly the light
 * fields: creation writes one captured entity, update writes named light
 * fields on one existing entity, and duplicate appends one copy at the shared
 * +0.5 m X/Z offset with a captured id. Aim is carried as the stored Euler
 * rotation, so the editor's aim module and the planner cannot disagree about
 * where a light points.
 *
 * No operation invents a shadow budget, a range maximum, an intensity range or
 * a unit conversion. Gate A owns the reference exposure and Gate C owns the
 * unresolved shadow budget; the editor supplies the values and the planner
 * validates only the current Scene codec contract.
 */
import type { CameraFreeSceneDocument as SceneDocument } from '../units/types';
import type { SceneLightEntity, Vec3 } from '../scene';
import { finalizeSceneCandidate, sameSceneValues, type SceneRecordScope } from './record-scope';
import { DUPLICATE_OFFSET_METERS, SCENE_NAME_LIMIT } from './operations';
import type {
	SceneOperationCandidate,
	SceneOperationContext,
	SceneOperationResult
} from './operations';

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export type SceneLightKind = SceneLightEntity['light'];

export function planCreateLight(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly light: SceneLightKind;
	readonly name: string;
	readonly color: string;
	readonly intensity: number;
	readonly castShadow: boolean;
	readonly position: Vec3;
	readonly rotation: Vec3;
	readonly range?: number;
	readonly angle?: number;
	readonly penumbra?: number;
}): SceneOperationResult {
	const scene = input.context.scene;
	if (scene.entities.some((entity) => entity.id === input.entityId)) {
		return invalid(`Captured light id "${input.entityId}" is already used by the accepted source.`, [
			'entityId',
			'duplicate-entity-id'
		]);
	}
	const name = readLightName(input.name);
	if (name.kind === 'rejected') return name;
	if (!HEX_COLOR_PATTERN.test(input.color)) {
		return invalid('A light colour must be a #rrggbb string.', ['color']);
	}
	if (!Number.isFinite(input.intensity) || input.intensity < 0) {
		return invalid('A light intensity must be a finite number ≥ 0.', ['intensity']);
	}
	if (!finiteVec3(input.position)) return invalid('A light needs a finite world position.', ['position']);
	if (!finiteVec3(input.rotation)) return invalid('A light needs a finite rotation.', ['rotation']);

	if (input.light === 'directional') {
		if (input.range !== undefined || input.angle !== undefined || input.penumbra !== undefined) {
			return invalid('Directional lights do not use range, angle or penumbra.', [
				'range',
				'angle',
				'penumbra'
			]);
		}
	}
	if (input.light === 'point') {
		if (input.angle !== undefined || input.penumbra !== undefined) {
			return invalid('Point lights do not use angle or penumbra.', ['angle', 'penumbra']);
		}
		if (input.range !== undefined && !(Number.isFinite(input.range) && input.range > 0)) {
			return invalid('A point light range must be a finite number greater than zero.', ['range']);
		}
	}
	if (input.light === 'spot') {
		if (input.angle === undefined) return invalid('Spot lights require an angle.', ['angle']);
		if (!(Number.isFinite(input.angle) && input.angle > 0 && input.angle <= Math.PI)) {
			return invalid('A spot angle must be in (0, π] radians.', ['angle']);
		}
		if (input.range !== undefined && !(Number.isFinite(input.range) && input.range > 0)) {
			return invalid('A spot range must be a finite number greater than zero.', ['range']);
		}
		if (
			input.penumbra !== undefined &&
			!(Number.isFinite(input.penumbra) && input.penumbra >= 0 && input.penumbra <= 1)
		) {
			return invalid('A spot penumbra must be in [0, 1].', ['penumbra']);
		}
	}

	const base = {
		kind: 'light' as const,
		id: input.entityId,
		name: name.value,
		color: input.color,
		intensity: input.intensity,
		castShadow: input.castShadow,
		position: [...input.position] as Vec3,
		rotation: [...input.rotation] as Vec3
	};
	const entity: SceneLightEntity =
		input.light === 'spot'
			? {
					...base,
					light: 'spot',
					angle: input.angle!,
					...(input.range === undefined ? {} : { range: input.range }),
					...(input.penumbra === undefined ? {} : { penumbra: input.penumbra })
				}
			: input.light === 'point'
				? {
						...base,
						light: 'point',
						...(input.range === undefined ? {} : { range: input.range })
					}
				: { ...base, light: 'directional' };

	return finalizeCreatedLight({
		context: input.context,
		operationKind: 'create-light',
		entity
	});
}

export type LightUpdate = {
	readonly position?: Vec3;
	readonly rotation?: Vec3;
	readonly color?: string;
	readonly intensity?: number;
	/** `null` removes an authored range; omitted leaves it unchanged. */
	readonly range?: number | null;
	readonly angle?: number;
	/** `null` removes an authored penumbra; omitted leaves it unchanged. */
	readonly penumbra?: number | null;
	readonly castShadow?: boolean;
};

export function planUpdateLight(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly update: LightUpdate;
}): SceneOperationResult {
	const existing = input.context.scene.entities.find((entity) => entity.id === input.entityId);
	if (existing === undefined) {
		return refusal('missing-target', `No Scene entity "${input.entityId}" exists in the accepted source.`, [
			input.entityId
		]);
	}
	if (existing.kind !== 'light') {
		return refusal(
			'unsupported-transform',
			`Entity "${input.entityId}" is not a light; only lights are updated by this operation.`,
			[input.entityId]
		);
	}
	const update = input.update;
	const hasRange = Object.prototype.hasOwnProperty.call(update, 'range');
	const hasAngle = Object.prototype.hasOwnProperty.call(update, 'angle');
	const hasPenumbra = Object.prototype.hasOwnProperty.call(update, 'penumbra');
	if (existing.light === 'directional' && (hasRange || hasAngle || hasPenumbra)) {
		return invalid('Directional lights do not use range, angle or penumbra.', ['range', 'angle', 'penumbra']);
	}
	if (existing.light === 'point' && (hasAngle || hasPenumbra)) {
		return invalid('Point lights do not use angle or penumbra.', ['angle', 'penumbra']);
	}
	if (update.position !== undefined && !finiteVec3(update.position)) {
		return invalid('A light needs a finite world position.', ['position']);
	}
	if (update.rotation !== undefined && !finiteVec3(update.rotation)) {
		return invalid('A light needs a finite rotation.', ['rotation']);
	}
	if (update.color !== undefined && !HEX_COLOR_PATTERN.test(update.color)) {
		return invalid('A light colour must be a #rrggbb string.', ['color']);
	}
	if (update.intensity !== undefined && (!Number.isFinite(update.intensity) || update.intensity < 0)) {
		return invalid('A light intensity must be a finite number ≥ 0.', ['intensity']);
	}
	if (hasRange && update.range !== null && !(Number.isFinite(update.range) && update.range! > 0)) {
		return invalid('A light range must be a finite number greater than zero.', ['range']);
	}
	if (hasAngle && !(Number.isFinite(update.angle) && update.angle! > 0 && update.angle! <= Math.PI)) {
		return invalid('A spot angle must be in (0, π] radians.', ['angle']);
	}
	if (
		hasPenumbra &&
		update.penumbra !== null &&
		!(Number.isFinite(update.penumbra) && update.penumbra! >= 0 && update.penumbra! <= 1)
	) {
		return invalid('A spot penumbra must be in [0, 1].', ['penumbra']);
	}
	if (existing.light === 'spot' && hasAngle && update.angle === undefined) {
		return invalid('Spot lights require an angle.', ['angle']);
	}

	const next = { ...existing } as SceneLightEntity;
	const fields: string[] = [];
	if (update.position !== undefined) {
		next.position = [...update.position] as Vec3;
		fields.push('position');
	}
	if (update.rotation !== undefined) {
		next.rotation = [...update.rotation] as Vec3;
		fields.push('rotation');
	}
	if (update.color !== undefined) {
		next.color = update.color;
		fields.push('color');
	}
	if (update.intensity !== undefined) {
		next.intensity = update.intensity;
		fields.push('intensity');
	}
	if (update.castShadow !== undefined) {
		next.castShadow = update.castShadow;
		fields.push('castShadow');
	}
	if (hasRange) {
		if (update.range === null) {
			delete (next as { range?: number }).range;
		} else {
			(next as { range?: number }).range = update.range!;
		}
		fields.push('range');
	}
	if (hasAngle) {
		if (existing.light !== 'spot') return invalid('Only spot lights use an angle.', ['angle']);
		(next as Extract<SceneLightEntity, { light: 'spot' }>).angle = update.angle!;
		fields.push('angle');
	}
	if (hasPenumbra) {
		if (existing.light !== 'spot') return invalid('Only spot lights use a penumbra.', ['penumbra']);
		if (update.penumbra === null) {
			delete (next as { penumbra?: number }).penumbra;
		} else {
			(next as { penumbra?: number }).penumbra = update.penumbra!;
		}
		fields.push('penumbra');
	}

	if (sameSceneValues(existing, next)) {
		return refusal('no_op', `Entity "${input.entityId}" already has those light values.`, fields);
	}
	return finalizeUpdatedLight({
		context: input.context,
		operationKind: 'update-light',
		entity: next,
		fields
	});
}

export function planDuplicateLight(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly newEntityId: string;
}): SceneOperationResult {
	const scene = input.context.scene;
	const existing = scene.entities.find((entity) => entity.id === input.entityId);
	if (existing === undefined) {
		return refusal('missing-target', `No Scene entity "${input.entityId}" exists in the accepted source.`, [
			input.entityId
		]);
	}
	if (existing.kind !== 'light') {
		return refusal(
			'unsupported-transform',
			`Entity "${input.entityId}" is not a light; only lights are duplicated by this operation.`,
			[input.entityId]
		);
	}
	if (typeof input.newEntityId !== 'string' || input.newEntityId.trim().length === 0) {
		return invalid('Duplicate needs a captured new entity id.', ['newEntityId']);
	}
	if (scene.entities.some((entity) => entity.id === input.newEntityId)) {
		return invalid(`Captured duplicate id "${input.newEntityId}" is already used by the accepted source.`, [
			'newEntityId',
			'duplicate-entity-id'
		]);
	}
	const cluster = (scene.clusters ?? []).find((candidate) =>
		candidate.memberIds.includes(input.entityId)
	);
	if (cluster !== undefined) {
		return refusal(
			'unsupported-set',
			`Light "${input.entityId}" belongs to cluster "${cluster.id}". Grouping owns duplication; this operation will not silently change cluster membership.`,
			[cluster.id]
		);
	}
	const copy = {
		...existing,
		id: input.newEntityId,
		position: [
			existing.position[0] + DUPLICATE_OFFSET_METERS,
			existing.position[1],
			existing.position[2] + DUPLICATE_OFFSET_METERS
		] as Vec3,
		rotation: [...existing.rotation] as Vec3
	} as SceneLightEntity;
	return finalizeCreatedLight({
		context: input.context,
		operationKind: 'duplicate-light',
		entity: copy
	});
}

function finalizeCreatedLight(input: {
	readonly context: SceneOperationContext;
	readonly operationKind: 'create-light' | 'duplicate-light';
	readonly entity: SceneLightEntity;
}): SceneOperationResult {
	const before = input.context.scene;
	const after: SceneDocument = { ...before, entities: [...before.entities, input.entity] };
	const scope: SceneRecordScope = {
		operationKind: input.operationKind,
		changedEntityIds: [],
		changedEntityFields: [],
		createdEntityIds: [input.entity.id],
		removedEntityIds: [],
		allowClusterCleanup: false
	};
	const finalized = finalizeSceneCandidate({ before, after, scope });
	if (finalized.kind === 'rejected') {
		return {
			kind: 'rejected',
			code: finalized.code,
			message: finalized.message,
			diagnostics: finalized.diagnostics
		};
	}
	const candidate: SceneOperationCandidate = {
		kind: 'candidate',
		operationKind: input.operationKind,
		entityId: input.entity.id,
		scene: finalized.scene,
		fields: ['entities'],
		correspondence: [{ relation: 'created', entityId: input.entity.id }],
		worldPose: {
			position: [...input.entity.position],
			rotation: [...input.entity.rotation],
			scale: input.entity.scale ?? 1
		},
		diagnostics: []
	};
	return candidate;
}

function finalizeUpdatedLight(input: {
	readonly context: SceneOperationContext;
	readonly operationKind: 'update-light';
	readonly entity: SceneLightEntity;
	readonly fields: readonly string[];
}): SceneOperationResult {
	const before = input.context.scene;
	const after: SceneDocument = {
		...before,
		entities: before.entities.map((entity) =>
			entity.id === input.entity.id ? input.entity : entity
		)
	};
	const scope: SceneRecordScope = {
		operationKind: input.operationKind,
		changedEntityIds: [input.entity.id],
		changedEntityFields: input.fields,
		createdEntityIds: [],
		removedEntityIds: [],
		allowClusterCleanup: false
	};
	const finalized = finalizeSceneCandidate({ before, after, scope });
	if (finalized.kind === 'rejected') {
		return {
			kind: 'rejected',
			code: finalized.code,
			message: finalized.message,
			diagnostics: finalized.diagnostics
		};
	}
	return {
		kind: 'candidate',
		operationKind: input.operationKind,
		entityId: input.entity.id,
		scene: finalized.scene,
		fields: input.fields,
		correspondence: [{ relation: 'preserved', entityId: input.entity.id }],
		worldPose: {
			position: [...input.entity.position],
			rotation: [...input.entity.rotation],
			scale: input.entity.scale ?? 1
		},
		diagnostics: []
	};
}

function readLightName(
	name: string
): { readonly kind: 'value'; readonly value: string } | ReturnType<typeof invalid> {
	const trimmed = typeof name === 'string' ? name.trim() : '';
	if (trimmed.length === 0) return invalid('A name can’t be empty.', ['name']);
	if (trimmed.length > SCENE_NAME_LIMIT) {
		return invalid(`A name can have at most ${SCENE_NAME_LIMIT} characters.`, ['name']);
	}
	return { kind: 'value', value: trimmed };
}

function finiteVec3(value: Vec3): boolean {
	return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

function invalid(
	message: string,
	diagnostics: readonly string[]
): Extract<SceneOperationResult, { kind: 'rejected' }> {
	return refusal('invalid-value', message, diagnostics);
}

function refusal(
	code: Extract<SceneOperationResult, { kind: 'rejected' }>['code'],
	message: string,
	diagnostics: readonly string[]
): Extract<SceneOperationResult, { kind: 'rejected' }> {
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
