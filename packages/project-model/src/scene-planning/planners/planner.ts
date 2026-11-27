import type { DomainPlanner, PlannerOutcome, PlannerRequest } from '../../f4/types';
import type { ShapeIssue } from '../../strict-shape';
import { ShapeReader } from '../../strict-shape';
import { unlinkSceneSubjects } from '../../units/experience-structure';
import type { ExperienceUnitPayload, ProjectEnvelope } from '../../units/types';
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '../../units/source';
import { framePointToWorld } from '../frame';
import { preparePlaceObjectCandidate } from '../place-object';
import type { SceneOperationPayload } from '../intent-payload';
import {
	readSceneOperationAllocation,
	readSceneOperationPayload,
	readSceneOperationSubject,
} from '../intent-payload';
import type {
	SceneOperationContext,
	SceneOperationKind,
	SceneOperationResult,
} from '../operations';
import {
	SCENE_OPERATION_KINDS,
	finalizePlacedEntity,
	planDeleteOne,
	planDuplicateOne,
	planMoveHorizontal,
	planPlaceOnFloor,
	planResizeOnFloor,
	planSetFormProfile,
	planSetFormSize,
	planSetLift,
	planSetName,
	planSetYaw,
} from '../operations';
import { resolveSceneSupport } from '../support';
import type { NormalizedPlacementDefinition } from '../types';
import type { CreatorModelResourceEntry } from '../model-resource';
import { creatorModelDefinitionKey, creatorModelResourceEntry } from '../model-resource';
import {
	grantShippedAssetResources,
	shippedModelResourceEntry,
	type ShippedAssetGrant,
} from '../shipped-asset-resource';
import type { ScenePlannerOptions } from './contracts';
import {
	SCENE_DELETE_ADMISSION,
	SCENE_PLACEMENT_ADMISSION,
	SCENE_PLANNER_ADMISSION,
} from './contracts';
import { rejected, toOutcome } from './outcome';
import { planCreateFormIntent, planPlaceFormCopyIntent } from './forms';
import { planGroupIntent } from './group';
import { planCreateLightIntent, planDuplicateLightIntent, planUpdateLightIntent } from './light';
import { SCENE_GROUP_OPERATION_KINDS, type SceneGroupOperationKind } from '../group-operations';

/**
 * The Scene planners, ready to register with the accepted F.4
 * coordinator. One operation kind has exactly one planner.
 */
export function createScenePlanners(
	options: ScenePlannerOptions = {},
): readonly DomainPlanner<ProjectEnvelope>[] {
	const definitions = options.definitions;
	const definitionsOf = (): ReadonlyMap<string, NormalizedPlacementDefinition> =>
		new Map(
			(typeof definitions === 'function' ? definitions() : (definitions ?? [])).map(
				(definition) => [definition.definitionKey, definition],
			),
		);
	return SCENE_OPERATION_KINDS.map((kind) =>
		scenePlanner(kind, (request) => {
			if (SCENE_GROUP_OPERATION_KINDS.includes(kind as SceneGroupOperationKind)) {
				return planGroupIntent(request, kind as SceneGroupOperationKind);
			}
			if (kind === 'place-object') return planPlaceObject(request, definitionsOf());
			if (kind === 'create-form') return planCreateFormIntent(request);
			if (kind === 'place-form-copy') return planPlaceFormCopyIntent(request);
			if (kind === 'create-light') return planCreateLightIntent(request);
			if (kind === 'update-light') return planUpdateLightIntent(request);
			if (kind === 'duplicate-light') return planDuplicateLightIntent(request);
			return planExistingObject(request, kind as Parameters<typeof planExistingObject>[1]);
		}),
	);
}

function scenePlanner(
	kind: SceneOperationKind,
	prepare: (request: PlannerRequest<ProjectEnvelope>) => PlannerOutcome<ProjectEnvelope>,
): DomainPlanner<ProjectEnvelope> {
	return {
		id: `scene.${kind}`,
		kind,
		admission:
			kind === 'place-object'
				? SCENE_PLACEMENT_ADMISSION
				: kind === 'delete-one' || kind === 'scene-group-erase'
					? SCENE_DELETE_ADMISSION
					: SCENE_PLANNER_ADMISSION,
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare,
	};
}

function planPlaceObject(
	request: PlannerRequest<ProjectEnvelope>,
	definitions: ReadonlyMap<string, NormalizedPlacementDefinition>,
): PlannerOutcome<ProjectEnvelope> {
	const reader = new ShapeReader();
	const payload = readSceneOperationPayload(reader, 'place-object', request.intent.payload);
	if (payload === null || payload.kind !== 'place-object') return invalidPayload(reader.issues);
	const subject = readSceneOperationSubject({
		reader,
		kind: 'place-object',
		targets: request.intent.targets,
		payload,
		sourceContentId: request.snapshot.domain.source.units.scene.header.contentRevision,
	});
	const allocation = readSceneOperationAllocation({
		reader,
		kind: 'place-object',
		allocations: request.intent.allocatedIds,
		scene: request.snapshot.domain.source.units.scene.data,
	});
	if (subject === null || allocation === null) return invalidPayload(reader.issues);
	// `ShapeReader` records a problem (an unknown key, a mismatched choice
	// variant) and still returns the readable value, so the collected issues are
	// checked here, not only when a reader gives up.
	if (reader.issues.length > 0) return invalidPayload(reader.issues);
	if (subject.kind !== 'none' || allocation.kind !== 'created') {
		return rejected(
			'invalid-value',
			'A placement addresses no existing subject and captures one new id.',
			[],
		);
	}

	const definition = definitions.get(payload.definitionKey);
	if (definition === undefined) {
		return rejected(
			'missing-definition',
			`No admitted normalized definition "${payload.definitionKey}" was captured for this session.`,
			[payload.definitionKey],
		);
	}
	if (definition.metadataContentId !== payload.metadataContentId) {
		return rejected(
			'definition-changed',
			`The captured metadata identity of "${payload.definitionKey}" no longer matches the admitted definition; re-capture the object before placing it.`,
			[definition.metadataContentId, payload.metadataContentId],
		);
	}

	// A first creator-model placement introduces its resource and exact lock in the
	// same accepted result as the entity. The definition must already name that
	// resource, so a payload can never register one model and place another.
	let resourceEntry: CreatorModelResourceEntry | null = null;
	if (payload.modelResource !== undefined) {
		if (
			definition.creationDefaults.kind !== 'model' ||
			definition.creationDefaults.assetId !== payload.modelResource.id ||
			definition.definitionKey !== creatorModelDefinitionKey(payload.modelResource.id)
		) {
			return rejected(
				'invalid-value',
				'The placement resource does not match the definition it is placed with.',
				[
					payload.modelResource.id,
					definition.creationDefaults.kind === 'model'
						? definition.creationDefaults.assetId
						: definition.definitionKey,
				],
			);
		}
		resourceEntry = creatorModelResourceEntry(payload.modelResource.id, payload.modelResource);
		if (resourceEntry === null) {
			return rejected(
				'invalid-value',
				'The approved model revision is not a well-formed creator model resource.',
				[payload.modelResource.reportDigest],
			);
		}
		// The definition and the introduced resource must describe the same object:
		// the same confirmed footprint and contact, and the same recorded report the
		// definition's provenance names. Otherwise the entity pose (computed from
		// the definition) and the stored placement would disagree from the first frame.
		const detail = resourceEntry.resource.model;
		const provenance = definition.admission.provenance;
		const extent = definitionFootprintExtent(definition);
		if (
			detail === undefined ||
			provenance.kind !== 'verified-model' ||
			provenance.verificationId !== `creator-import:${payload.modelResource.reportDigest}` ||
			!sameMeter(detail.placement.footprint.width, extent.width) ||
			!sameMeter(detail.placement.footprint.depth, extent.depth) ||
			!sameMeter(detail.placement.contactMinY, definition.contactMinY)
		) {
			return rejected(
				'invalid-value',
				'The introduced model resource and the placement definition disagree about the approved footprint or contact.',
				['model-resource-agreement'],
			);
		}
		if (
			request.snapshot.domain.source.units.resources.data.resources.some(
				(resource) => resource.id === payload.modelResource!.id,
			)
		) {
			return rejected(
				'invalid-value',
				`Model resource "${payload.modelResource.id}" is already in the accepted envelope; place another instance without introducing it again.`,
				['duplicate-resource'],
			);
		}
	}

	const point = composedPoint(payload.worldXZ, payload.frame);
	if (point === null)
		return rejected('invalid-value', 'The placement X/Z is not finite.', ['worldXZ']);
	const support = resolveSceneSupport({
		layout: request.snapshot.domain.source.units.layout.data,
		sourceContentId: request.snapshot.sourceContentId,
		point,
		requiredElevation: null,
		...(payload.choice === undefined ? {} : { choice: payload.choice }),
	});
	if (support.kind === 'refused') {
		return rejected(
			support.code,
			support.message,
			support.candidates.map((candidate) => candidate.orderKey),
		);
	}

	// A catalogue model's first placement grants its shipped asset resource and
	// exact lock in the same accepted result as the entity. The grant reuses a
	// matching held record and refuses any other one without rewriting it; a
	// creator model is introduced by its own payload instead.
	let shippedGrant: ShippedAssetGrant | null = null;
	if (definition.creationDefaults.kind === 'model') {
		const assetId = definition.creationDefaults.assetId;
		const heldModelResource = request.snapshot.domain.source.units.resources.data.resources.some(
			(resource) => resource.kind === 'model' && resource.id === assetId,
		);
		if (!heldModelResource && shippedModelResourceEntry(assetId) !== null) {
			const grant = grantShippedAssetResources(request.snapshot.domain.source, [assetId]);
			if (grant.kind === 'refused') {
				return rejected(grant.code, grant.message, grant.diagnostics);
			}
			shippedGrant = grant;
		}
	}

	const prepared = preparePlaceObjectCandidate({
		document: request.snapshot.domain.source.units.scene.data,
		snapshot: request.snapshot.domain.identity,
		supportSnapshot: request.snapshot.domain.identity,
		frameSnapshot: request.snapshot.domain.identity,
		frameReference: payload.frameReference,
		entityId: allocation.entityId,
		definition,
		worldXZ: payload.worldXZ,
		yaw: payload.yaw,
		frame: payload.frame,
		generationId: support.generationId,
		support: { kind: 'resolved', support: support.support },
	});
	if (prepared.kind === 'refusal') {
		return rejected(prepared.code, prepared.message, prepared.diagnostics);
	}

	const result = finalizePlacedEntity({
		context: {
			layout: request.snapshot.domain.source.units.layout.data,
			scene: request.snapshot.domain.source.units.scene.data,
			sourceContentId: request.snapshot.sourceContentId,
		},
		entityId: allocation.entityId,
		scene: prepared.candidate.scene,
	});
	return toOutcome(request, 'place-object', result, resourceEntry, shippedGrant);
}

/** The occupied X/Z extent of a definition's canonical footprint. */
function definitionFootprintExtent(definition: NormalizedPlacementDefinition): {
	readonly width: number;
	readonly depth: number;
} {
	let minX = Infinity;
	let maxX = -Infinity;
	let minZ = Infinity;
	let maxZ = -Infinity;
	for (const [x, z] of definition.footprintMeters) {
		minX = Math.min(minX, x);
		maxX = Math.max(maxX, x);
		minZ = Math.min(minZ, z);
		maxZ = Math.max(maxZ, z);
	}
	return { width: maxX - minX, depth: maxZ - minZ };
}

/** Confirmed metric facts compare at the precision the recipe records. */
function sameMeter(left: number, right: number): boolean {
	return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 1e-9;
}

function planExistingObject(
	request: PlannerRequest<ProjectEnvelope>,
	kind: Exclude<
		SceneOperationKind,
		| 'place-object'
		| 'create-form'
		| 'place-form-copy'
		| 'create-light'
		| 'update-light'
		| 'duplicate-light'
		| SceneGroupOperationKind
	>,
): PlannerOutcome<ProjectEnvelope> {
	const reader = new ShapeReader();
	const payload = readSceneOperationPayload(reader, kind, request.intent.payload);
	if (
		payload === null ||
		payload.kind === 'place-object' ||
		payload.kind === 'create-form' ||
		payload.kind === 'place-form-copy' ||
		payload.kind === 'create-light' ||
		payload.kind === 'update-light' ||
		payload.kind === 'duplicate-light'
	) {
		return invalidPayload(reader.issues);
	}
	const subject = readSceneOperationSubject({
		reader,
		kind,
		targets: request.intent.targets,
		payload,
		sourceContentId: request.snapshot.domain.source.units.scene.header.contentRevision,
	});
	const allocation = readSceneOperationAllocation({
		reader,
		kind,
		allocations: request.intent.allocatedIds,
		scene: request.snapshot.domain.source.units.scene.data,
	});
	if (subject === null || allocation === null) return invalidPayload(reader.issues);
	if (reader.issues.length > 0) return invalidPayload(reader.issues);
	if (subject.kind !== 'entity') {
		return rejected('invalid-value', `${kind} addresses exactly one existing Scene entity.`, []);
	}
	if (kind === 'duplicate-one' ? allocation.kind !== 'created' : allocation.kind !== 'none') {
		return rejected(
			'invalid-value',
			kind === 'duplicate-one'
				? 'Duplicate needs exactly one captured scene-entity id for the new entity.'
				: `${kind} creates no id and must not carry an allocation.`,
			[],
		);
	}

	const context: SceneOperationContext = {
		layout: request.snapshot.domain.source.units.layout.data,
		scene: request.snapshot.domain.source.units.scene.data,
		sourceContentId: request.snapshot.sourceContentId,
	};
	let result: SceneOperationResult;
	try {
		result = planOperation(kind, payload, subject.entityId, allocation, context);
	} catch (error) {
		return rejected(
			'invalid-value',
			`The ${kind} planner failed: ${error instanceof Error ? error.message : 'unknown error'}`,
			[],
		);
	}
	if (kind === 'delete-one' && result.kind === 'candidate') {
		const removed = context.scene.entities
			.filter((entity) => !result.scene.entities.some((candidate) => candidate.id === entity.id))
			.map((entity) => ({ entityId: entity.id, effectiveName: entity.name }));
		return toOutcome(
			request,
			kind,
			result,
			null,
			null,
			removed.length === 0 ? null : unlinkPresentations(request, removed),
		);
	}
	return toOutcome(request, kind, result);
}

function planOperation(
	kind: Exclude<
		SceneOperationKind,
		| 'place-object'
		| 'create-form'
		| 'place-form-copy'
		| 'create-light'
		| 'update-light'
		| 'duplicate-light'
		| SceneGroupOperationKind
	>,
	payload: Exclude<
		SceneOperationPayload,
		| { kind: 'place-object' }
		| { kind: 'create-form' }
		| { kind: 'place-form-copy' }
		| { kind: 'create-light' }
		| { kind: 'update-light' }
		| { kind: 'duplicate-light' }
	>,
	entityId: string,
	allocation: { readonly kind: 'none' } | { readonly kind: 'created'; readonly entityId: string },
	context: SceneOperationContext,
): SceneOperationResult {
	switch (kind) {
		case 'move-horizontal':
			if (payload.kind !== 'move-horizontal') return payloadMismatch(kind);
			return planMoveHorizontal({
				context,
				entityId,
				worldXZ: payload.worldXZ,
				frame: payload.frame,
				contactMinY: payload.contactMinY,
				...(payload.choice === undefined ? {} : { choice: payload.choice }),
			});
		case 'set-yaw':
			if (payload.kind !== 'set-yaw') return payloadMismatch(kind);
			return planSetYaw({ context, entityId, yaw: payload.yaw, frame: payload.frame });
		case 'place-on-floor':
			if (payload.kind !== 'place-on-floor') return payloadMismatch(kind);
			return planPlaceOnFloor({
				context,
				entityId,
				worldXZ: payload.worldXZ,
				frame: payload.frame,
				contactMinY: payload.contactMinY,
				...(payload.yaw === undefined ? {} : { yaw: payload.yaw }),
				...(payload.choice === undefined ? {} : { choice: payload.choice }),
			});
		case 'set-form-size':
			if (payload.kind !== 'set-form-size') return payloadMismatch(kind);
			return planSetFormSize({
				context,
				entityId,
				scale: payload.scale,
				...(payload.choice === undefined ? {} : { choice: payload.choice }),
			});
		case 'set-form-profile':
			if (payload.kind !== 'set-form-profile') return payloadMismatch(kind);
			return planSetFormProfile({
				context,
				entityId,
				outline: payload.outline,
				extent: payload.extent,
				...(payload.choice === undefined ? {} : { choice: payload.choice }),
			});
		case 'resize-on-floor':
			if (payload.kind !== 'resize-on-floor') return payloadMismatch(kind);
			return planResizeOnFloor({
				context,
				entityId,
				scale: payload.scale,
				contactMinY: payload.contactMinY,
				...(payload.choice === undefined ? {} : { choice: payload.choice }),
			});
		case 'duplicate-one':
			if (payload.kind !== 'duplicate-one') return payloadMismatch(kind);
			if (allocation.kind !== 'created') {
				return {
					kind: 'rejected',
					code: 'invalid-value',
					message: 'Duplicate needs a captured new id.',
					diagnostics: [],
				};
			}
			return planDuplicateOne({
				context,
				entityId,
				newEntityId: allocation.entityId,
				contactMinY: payload.contactMinY,
				...(payload.choice === undefined ? {} : { choice: payload.choice }),
			});
		case 'set-lift':
			if (payload.kind !== 'set-lift') return payloadMismatch(kind);
			return planSetLift({
				context,
				entityId,
				lift: payload.lift,
				contactMinY: payload.contactMinY,
				...(payload.choice === undefined ? {} : { choice: payload.choice }),
			});
		case 'set-name':
			if (payload.kind !== 'set-name') return payloadMismatch(kind);
			return planSetName({ context, entityId, name: payload.name });
		case 'delete-one':
			if (payload.kind !== 'delete-one') return payloadMismatch(kind);
			return planDeleteOne({ context, entityId });
	}
}

function unlinkPresentations(
	request: PlannerRequest<ProjectEnvelope>,
	removed: readonly { readonly entityId: string; readonly effectiveName: string }[],
): ExperienceUnitPayload | null {
	const data = request.snapshot.domain.source.units.experience.data;
	let changed = false;
	const experiences = data.experiences.map((experience) => {
		const next = unlinkSceneSubjects(experience, removed);
		if (next !== experience) changed = true;
		return next;
	});
	return changed ? { ...data, experiences } : null;
}

function composedPoint(
	worldXZ: readonly [number, number],
	frame: { readonly origin: readonly [number, number, number]; readonly yaw: number },
): [number, number] | null {
	const point = framePointToWorld(
		{ origin: [frame.origin[0], frame.origin[1], frame.origin[2]], yaw: frame.yaw },
		[worldXZ[0], 0, worldXZ[1]],
	);
	return Number.isFinite(point[0]) && Number.isFinite(point[2]) ? [point[0], point[2]] : null;
}

function payloadMismatch(kind: string): SceneOperationResult {
	return {
		kind: 'rejected',
		code: 'invalid-value',
		message: `The ${kind} payload does not match its operation kind.`,
		diagnostics: [],
	};
}

export function invalidPayload(issues: readonly ShapeIssue[]): PlannerOutcome<ProjectEnvelope> {
	// A structurally valid reference to a frame this reader cannot resolve is not
	// malformed intent, it is an unsupported capability, so it keeps its own code
	// instead of being flattened into `invalid-value`.
	const unsupported = issues.find((issue) => issue.code === 'unsupported-frame');
	if (unsupported !== undefined) {
		return {
			kind: 'rejected',
			code: 'unsupported-frame',
			message: unsupported.message,
			diagnostics: issues,
		};
	}
	return {
		kind: 'rejected',
		code: 'invalid-value',
		message: 'The operation intent is not valid captured data.',
		diagnostics: issues,
	};
}
