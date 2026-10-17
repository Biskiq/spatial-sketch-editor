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
 * | `move-horizontal` | world X/Z only; Y, rotation, scale, dimensions and materials are preserved |
 * | `set-yaw` | yaw only; position and every other component are preserved |
 * | `place-on-floor` | contact-resolved Y and X/Z; captured yaw when the payload supplies one |
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
import type { ShapeIssue } from '../strict-shape';
import type { ProjectDocument } from '../project-types';
import type { SceneDocument, SceneEntity, ScenePrimitiveEntity, Vec3 } from '../scene';
import { framePointToWorld, frameYawToWorld, isFinitePlacementFrame } from './frame';
import { finalizeSceneCandidate, sameSceneValues, type SceneRecordScope } from './record-scope';
import { resolveSceneSupport, type SceneSupportChoice } from './support';
import type { LocalInputFrame } from './types';

export const SCENE_OPERATION_KINDS = [
	'place-object',
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

export type SceneOperationContext = {
	readonly project: ProjectDocument;
	readonly sourceContentId: string;
};

/** Pitch/roll this close to zero is upright; the comparison never rewrites them. */
const UPRIGHT_TOLERANCE = 1e-9;

/** A captured contact may be computed by another owner; agreement is metric. */
const CONTACT_TOLERANCE_METERS = 1e-9;

/** `duplicate-one`'s fixed world offset, in meters. */
export const DUPLICATE_OFFSET_METERS = 0.5;

export function planMoveHorizontal(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly worldXZ: readonly [number, number];
	readonly frame: LocalInputFrame;
	readonly contactMinY: number;
	readonly choice?: SceneSupportChoice | undefined;
}): SceneOperationResult {
	const target = readObject(input.context.project.scene, input.entityId);
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
			changedEntityFields: ['position'],
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
	const target = readObject(input.context.project.scene, input.entityId);
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
			changedEntityFields: ['rotation'],
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
	const target = readObject(input.context.project.scene, input.entityId);
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
		input.yaw === undefined				? target.entity.rotation
				: [
					target.entity.rotation[0],
					ownedYaw(target.entity.rotation[1], input.frame, input.yaw),
					target.entity.rotation[2]
				];
	const next: SceneEntity = { ...target.entity, position: [point[0], y, point[1]], rotation };
	const fields = input.yaw === undefined ? ['position'] : ['position', 'rotation'];
	return finalize({
		context: input.context,
		operationKind: 'place-on-floor',
		next,
		fields,
		scope: {
			changedEntityIds: [target.entity.id],
			changedEntityFields: fields,
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
	const target = readObject(input.context.project.scene, input.entityId);
	if (target.kind !== 'object') return target;
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
			changedEntityFields: ['position', 'scale'],
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
	const scene = input.context.project.scene;
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
	const scene = input.context.project.scene;
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
		before: input.context.project.scene,
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
	const before = input.context.project.scene;
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
		layout: context.project.layout,
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
	if (entity.kind === 'light') {
		return refusal(
			'unsupported-transform',
			`Entity "${entityId}" is a light; lights have no object footprint or floor placement to transform.`,
			[entityId]
		);
	}
	if (entity.kind === 'primitive' && entity.primitive === 'plane') {
		return refusal(
			'unsupported-transform',
			`Entity "${entityId}" is a vertical plane, which has no honest floor footprint for this operation.`,
			[entityId]
		);
	}
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
