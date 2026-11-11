/**
 * T2.P01.S02 — the Scene `DomainPlanner` set over F.4's landed contracts.
 *
 * This module registers **planners**, not a history, an installer or an adapter:
 * a candidate is admitted by the current-source adapter and installed by the
 * editor coordinator, exactly as `T1.P01.S03` landed them. Live registration in
 * a host belongs to the host↔F4 wiring and `T2.P01.S03`; nothing here is
 * reachable from a route.
 *
 * The normalized-definition policy is **injected** (`options.definitions`,
 * captured from S01's editor object-definition policy). Planning never reads the
 * application catalogue, and the intent carries the captured
 * `metadataContentId`, so a policy that changed underneath an intent refuses
 * (`definition-changed`) instead of silently placing a different object.
 *
 * Every admitted operation is single-domain Scene with `compound`, `units` and
 * `resources` false; the landed registry refuses anything wider.
 */
import type {
	DomainPlanner,
	PlannerAdmission,
	PlannerOutcome,
	PlannerRequest,
	PreparedCandidate
} from '../f4';
import { ShapeReader, type ShapeIssue } from '../strict-shape';
import { replaceUnitData } from '../units/envelope';
import { unlinkSceneSubjects } from '../units/experience-structure';
import type { ExperienceUnitPayload } from '../units/types';
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '../units/source';
import type { ProjectEnvelope } from '../units/types';
import type { SemanticReference } from '../references/types';
import { framePointToWorld } from './frame';
import { preparePlaceObjectCandidate } from './place-object';
import {
	readSceneOperationAllocation,
	readSceneOperationPayload,
	readSceneOperationSubject,
	type SceneOperationPayload
} from './intent-payload';
import {
	planCreateForm,
	planPlaceFormCopy,
	planDeleteOne,
	planDuplicateOne,
	planMoveHorizontal,
	planPlaceOnFloor,
	planResizeOnFloor,
	planSetFormSize,
	planSetLift,
	planSetName,
	planSetYaw,
	finalizePlacedEntity,
	SCENE_OPERATION_KINDS,
	type SceneOperationContext,
	type SceneOperationKind,
	type SceneOperationResult
} from './operations';
import {
	planCreateLight,
	planUpdateLight,
	planDuplicateLight,
	type LightUpdate
} from './light-operations';
import { resolveSceneSupport } from './support';
import type { NormalizedPlacementDefinition } from './types';
import {
	creatorModelDefinitionKey,
	creatorModelResourceEntry,
	withCreatorModelResource,
	type CreatorModelResourceEntry
} from './model-resource';

/**
 * Every Scene planner except `place-object` changes Scene only.
 *
 * `place-object` is the **single** planner granted typed-resource staging: a
 * creator model's first placement installs its `model` resource, exact lock and
 * entity in one accepted result. No other Scene operation may write resources,
 * and the host's own admission must grant staging independently.
 */
const SCENE_PLANNER_ADMISSION: PlannerAdmission = Object.freeze({
	domain: 'scene',
	compound: false,
	units: false,
	resources: false
});

/** A-3: `delete-one` is the only Scene operation that also writes Experience. */
const SCENE_DELETE_ADMISSION: PlannerAdmission = Object.freeze({
	domain: 'scene',
	compound: true,
	writes: ['experience'] as const,
	units: false,
	resources: false
});

const SCENE_PLACEMENT_ADMISSION: PlannerAdmission = Object.freeze({
	domain: 'scene',
	compound: false,
	units: false,
	resources: true
});

export type ScenePlannerOptions = {
	/**
	 * The host's admitted normalized definitions, captured before planning. An
	 * empty list admits no new placement; existing-object operations still work.
	 *
	 * A provider is re-read for every preparation: a creator model's definitions
	 * come from the currently accepted envelope and are only known after an
	 * import, while the planner registration outlives it. The intent still carries
	 * the captured `metadataContentId`, so a changed set refuses
	 * (`definition-changed`) instead of placing a different object.
	 */
	readonly definitions?:
		| readonly NormalizedPlacementDefinition[]
		| (() => readonly NormalizedPlacementDefinition[]);
};

/**
 * The Scene planners, ready to register with the accepted F.4
 * coordinator. One operation kind has exactly one planner.
 */
export function createScenePlanners(
	options: ScenePlannerOptions = {}
): readonly DomainPlanner<ProjectEnvelope>[] {
	const definitions = options.definitions;
	const definitionsOf = (): ReadonlyMap<string, NormalizedPlacementDefinition> =>
		new Map(
			(typeof definitions === 'function' ? definitions() : (definitions ?? [])).map((definition) => [
				definition.definitionKey,
				definition
			])
		);
	return SCENE_OPERATION_KINDS.map((kind) =>
		scenePlanner(kind, (request) => {
			if (kind === 'place-object') return planPlaceObject(request, definitionsOf());
			if (kind === 'create-form') return planCreateFormIntent(request);
			if (kind === 'place-form-copy') return planPlaceFormCopyIntent(request);
			if (kind === 'create-light') return planCreateLightIntent(request);
			if (kind === 'update-light') return planUpdateLightIntent(request);
			if (kind === 'duplicate-light') return planDuplicateLightIntent(request);
			return planExistingObject(request, kind);
		})
	);
}

function planCreateLightIntent(
	request: PlannerRequest<ProjectEnvelope>
): PlannerOutcome<ProjectEnvelope> {
	const reader = new ShapeReader();
	const payload = readSceneOperationPayload(reader, 'create-light', request.intent.payload);
	if (payload === null || payload.kind !== 'create-light') return invalidPayload(reader.issues);
	const subject = readSceneOperationSubject({
		reader,
		kind: 'create-light',
		targets: request.intent.targets,
		payload,
		sourceContentId: request.snapshot.domain.source.units.scene.header.contentRevision
	});
	const allocation = readSceneOperationAllocation({
		reader,
		kind: 'create-light',
		allocations: request.intent.allocatedIds,
		scene: request.snapshot.domain.source.units.scene.data
	});
	if (subject === null || allocation === null) return invalidPayload(reader.issues);
	if (reader.issues.length > 0) return invalidPayload(reader.issues);
	if (subject.kind !== 'none' || allocation.kind !== 'created') {
		return rejected(
			'invalid-value',
			'A light creation addresses no existing subject and captures one new entity id.',
			[]
		);
	}
	let result: SceneOperationResult;
	try {
		result = planCreateLight({
			context: {
				layout: request.snapshot.domain.source.units.layout.data,
				scene: request.snapshot.domain.source.units.scene.data,
				sourceContentId: request.snapshot.sourceContentId
			},
			entityId: allocation.entityId,
			light: payload.light,
			name: payload.name,
			color: payload.color,
			intensity: payload.intensity,
			castShadow: payload.castShadow,
			position: payload.position,
			rotation: payload.rotation,
			...(payload.range === undefined ? {} : { range: payload.range }),
			...(payload.angle === undefined ? {} : { angle: payload.angle }),
			...(payload.penumbra === undefined ? {} : { penumbra: payload.penumbra })
		});
	} catch (error) {
		return rejected(
			'invalid-value',
			`The create-light planner failed: ${error instanceof Error ? error.message : 'unknown error'}`,
			[]
		);
	}
	return toOutcome(request, 'create-light', result);
}

function planUpdateLightIntent(
	request: PlannerRequest<ProjectEnvelope>
): PlannerOutcome<ProjectEnvelope> {
	const reader = new ShapeReader();
	const payload = readSceneOperationPayload(reader, 'update-light', request.intent.payload);
	if (payload === null || payload.kind !== 'update-light') return invalidPayload(reader.issues);
	const subject = readSceneOperationSubject({
		reader,
		kind: 'update-light',
		targets: request.intent.targets,
		payload,
		sourceContentId: request.snapshot.domain.source.units.scene.header.contentRevision
	});
	const allocation = readSceneOperationAllocation({
		reader,
		kind: 'update-light',
		allocations: request.intent.allocatedIds,
		scene: request.snapshot.domain.source.units.scene.data
	});
	if (subject === null || allocation === null) return invalidPayload(reader.issues);
	if (reader.issues.length > 0) return invalidPayload(reader.issues);
	if (subject.kind !== 'entity' || allocation.kind !== 'none') {
		return rejected('invalid-value', 'A light update addresses one existing Scene entity and creates no id.', []);
	}
	const update: LightUpdate = {
		...(payload.position === undefined ? {} : { position: payload.position }),
		...(payload.rotation === undefined ? {} : { rotation: payload.rotation }),
		...(payload.color === undefined ? {} : { color: payload.color }),
		...(payload.intensity === undefined ? {} : { intensity: payload.intensity }),
		...(payload.range === undefined ? {} : { range: payload.range }),
		...(payload.angle === undefined ? {} : { angle: payload.angle }),
		...(payload.penumbra === undefined ? {} : { penumbra: payload.penumbra }),
		...(payload.castShadow === undefined ? {} : { castShadow: payload.castShadow })
	};
	let result: SceneOperationResult;
	try {
		result = planUpdateLight({
			context: {
				layout: request.snapshot.domain.source.units.layout.data,
				scene: request.snapshot.domain.source.units.scene.data,
				sourceContentId: request.snapshot.sourceContentId
			},
			entityId: subject.entityId,
			update
		});
	} catch (error) {
		return rejected(
			'invalid-value',
			`The update-light planner failed: ${error instanceof Error ? error.message : 'unknown error'}`,
			[]
		);
	}
	return toOutcome(request, 'update-light', result);
}

function planDuplicateLightIntent(
	request: PlannerRequest<ProjectEnvelope>
): PlannerOutcome<ProjectEnvelope> {
	const reader = new ShapeReader();
	const payload = readSceneOperationPayload(reader, 'duplicate-light', request.intent.payload);
	if (payload === null || payload.kind !== 'duplicate-light') return invalidPayload(reader.issues);
	const subject = readSceneOperationSubject({
		reader,
		kind: 'duplicate-light',
		targets: request.intent.targets,
		payload,
		sourceContentId: request.snapshot.domain.source.units.scene.header.contentRevision
	});
	const allocation = readSceneOperationAllocation({
		reader,
		kind: 'duplicate-light',
		allocations: request.intent.allocatedIds,
		scene: request.snapshot.domain.source.units.scene.data
	});
	if (subject === null || allocation === null) return invalidPayload(reader.issues);
	if (reader.issues.length > 0) return invalidPayload(reader.issues);
	if (subject.kind !== 'entity' || allocation.kind !== 'created') {
		return rejected(
			'invalid-value',
			'A light duplicate addresses one existing Scene entity and captures one new id.',
			[]
		);
	}
	let result: SceneOperationResult;
	try {
		result = planDuplicateLight({
			context: {
				layout: request.snapshot.domain.source.units.layout.data,
				scene: request.snapshot.domain.source.units.scene.data,
				sourceContentId: request.snapshot.sourceContentId
			},
			entityId: subject.entityId,
			newEntityId: allocation.entityId
		});
	} catch (error) {
		return rejected(
			'invalid-value',
			`The duplicate-light planner failed: ${error instanceof Error ? error.message : 'unknown error'}`,
			[]
		);
	}
	return toOutcome(request, 'duplicate-light', result);
}

function planCreateFormIntent(
	request: PlannerRequest<ProjectEnvelope>
): PlannerOutcome<ProjectEnvelope> {
	const reader = new ShapeReader();
	const payload = readSceneOperationPayload(reader, 'create-form', request.intent.payload);
	if (payload === null || payload.kind !== 'create-form') return invalidPayload(reader.issues);
	const subject = readSceneOperationSubject({
		reader,
		kind: 'create-form',
		targets: request.intent.targets,
		payload,
		sourceContentId: request.snapshot.domain.source.units.scene.header.contentRevision
	});
	const allocation = readSceneOperationAllocation({
		reader,
		kind: 'create-form',
		allocations: request.intent.allocatedIds,
		scene: request.snapshot.domain.source.units.scene.data
	});
	if (subject === null || allocation === null) return invalidPayload(reader.issues);
	if (reader.issues.length > 0) return invalidPayload(reader.issues);
	if (subject.kind !== 'none' || allocation.kind !== 'created') {
		return rejected(
			'invalid-value',
			'A form creation addresses no existing subject and captures one new entity id.',
			[]
		);
	}
	let result: SceneOperationResult;
	try {
		result = planCreateForm({
			context: {
				layout: request.snapshot.domain.source.units.layout.data,
				scene: request.snapshot.domain.source.units.scene.data,
				sourceContentId: request.snapshot.sourceContentId
			},
			entityId: allocation.entityId,
			plane: payload.plane,
			outline: payload.outline,
			extent: payload.extent,
			position: payload.position,
			yaw: payload.yaw,
			materialId: payload.materialId,
			name: payload.name,
			...(payload.choice === undefined ? {} : { choice: payload.choice })
		});
	} catch (error) {
		// Parity with every existing-object planner: an unexpected kernel failure is
		// a typed refusal, never an error escaping the coordinator.
		return rejected(
			'invalid-value',
			`The create-form planner failed: ${error instanceof Error ? error.message : 'unknown error'}`,
			[]
		);
	}
	return toOutcome(request, 'create-form', result);
}

function planPlaceFormCopyIntent(
	request: PlannerRequest<ProjectEnvelope>
): PlannerOutcome<ProjectEnvelope> {
	const reader = new ShapeReader();
	const payload = readSceneOperationPayload(reader, 'place-form-copy', request.intent.payload);
	if (payload === null || payload.kind !== 'place-form-copy') return invalidPayload(reader.issues);
	const subject = readSceneOperationSubject({
		reader,
		kind: 'place-form-copy',
		targets: request.intent.targets,
		payload,
		sourceContentId: request.snapshot.domain.source.units.scene.header.contentRevision
	});
	const allocation = readSceneOperationAllocation({
		reader,
		kind: 'place-form-copy',
		allocations: request.intent.allocatedIds,
		scene: request.snapshot.domain.source.units.scene.data
	});
	if (subject === null || allocation === null) return invalidPayload(reader.issues);
	if (reader.issues.length > 0) return invalidPayload(reader.issues);
	if (subject.kind !== 'none' || allocation.kind !== 'created') {
		return rejected(
			'invalid-value',
			'A saved form copy addresses no existing subject and captures one new entity id.',
			[]
		);
	}
	let result: SceneOperationResult;
	try {
		result = planPlaceFormCopy({
			context: {
				layout: request.snapshot.domain.source.units.layout.data,
				scene: request.snapshot.domain.source.units.scene.data,
				sourceContentId: request.snapshot.sourceContentId
			},
			entityId: allocation.entityId,
			item: payload.item,
			worldXZ: payload.worldXZ,
			yaw: payload.yaw,
			contactMinY: payload.contactMinY,
			...(payload.choice === undefined ? {} : { choice: payload.choice })
		});
	} catch (error) {
		return rejected(
			'invalid-value',
			`The place-form-copy planner failed: ${error instanceof Error ? error.message : 'unknown error'}`,
			[]
		);
	}
	return toOutcome(request, 'place-form-copy', result);
}

function scenePlanner(
	kind: SceneOperationKind,
	prepare: (request: PlannerRequest<ProjectEnvelope>) => PlannerOutcome<ProjectEnvelope>
): DomainPlanner<ProjectEnvelope> {
	return {
		id: `scene.${kind}`,
		kind,
		admission:
			kind === 'place-object'
				? SCENE_PLACEMENT_ADMISSION
				: kind === 'delete-one'
					? SCENE_DELETE_ADMISSION
					: SCENE_PLANNER_ADMISSION,
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare
	};
}

function planPlaceObject(
	request: PlannerRequest<ProjectEnvelope>,
	definitions: ReadonlyMap<string, NormalizedPlacementDefinition>
): PlannerOutcome<ProjectEnvelope> {
	const reader = new ShapeReader();
	const payload = readSceneOperationPayload(reader, 'place-object', request.intent.payload);
	if (payload === null || payload.kind !== 'place-object') return invalidPayload(reader.issues);
	const subject = readSceneOperationSubject({
		reader,
		kind: 'place-object',
		targets: request.intent.targets,
		payload,
		sourceContentId: request.snapshot.domain.source.units.scene.header.contentRevision
	});
	const allocation = readSceneOperationAllocation({
		reader,
		kind: 'place-object',
		allocations: request.intent.allocatedIds,
		scene: request.snapshot.domain.source.units.scene.data
	});
	if (subject === null || allocation === null) return invalidPayload(reader.issues);
	// `ShapeReader` records a problem (an unknown key, a mismatched choice
	// variant) and still returns the readable value, so the collected issues are
	// checked here, not only when a reader gives up.
	if (reader.issues.length > 0) return invalidPayload(reader.issues);
	if (subject.kind !== 'none' || allocation.kind !== 'created') {
		return rejected('invalid-value', 'A placement addresses no existing subject and captures one new id.', []);
	}

	const definition = definitions.get(payload.definitionKey);
	if (definition === undefined) {
		return rejected(
			'missing-definition',
			`No admitted normalized definition "${payload.definitionKey}" was captured for this session.`,
			[payload.definitionKey]
		);
	}
	if (definition.metadataContentId !== payload.metadataContentId) {
		return rejected(
			'definition-changed',
			`The captured metadata identity of "${payload.definitionKey}" no longer matches the admitted definition; re-capture the object before placing it.`,
			[definition.metadataContentId, payload.metadataContentId]
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
				[payload.modelResource.id, definition.creationDefaults.kind === 'model' ? definition.creationDefaults.assetId : definition.definitionKey]
			);
		}
		resourceEntry = creatorModelResourceEntry(payload.modelResource.id, payload.modelResource);
		if (resourceEntry === null) {
			return rejected(
				'invalid-value',
				'The approved model revision is not a well-formed creator model resource.',
				[payload.modelResource.reportDigest]
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
				['model-resource-agreement']
			);
		}
		if (request.snapshot.domain.source.units.resources.data.resources.some((resource) => resource.id === payload.modelResource!.id)) {
			return rejected(
				'invalid-value',
				`Model resource "${payload.modelResource.id}" is already in the accepted envelope; place another instance without introducing it again.`,
				['duplicate-resource']
			);
		}
	}

	const point = composedPoint(payload.worldXZ, payload.frame);
	if (point === null) return rejected('invalid-value', 'The placement X/Z is not finite.', ['worldXZ']);
	const support = resolveSceneSupport({
		layout: request.snapshot.domain.source.units.layout.data,
		sourceContentId: request.snapshot.sourceContentId,
		point,
		requiredElevation: null,
		...(payload.choice === undefined ? {} : { choice: payload.choice })
	});
	if (support.kind === 'refused') {
		return rejected(support.code, support.message, support.candidates.map((candidate) => candidate.orderKey));
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
		support: { kind: 'resolved', support: support.support }
	});
	if (prepared.kind === 'refusal') {
		return rejected(prepared.code, prepared.message, prepared.diagnostics);
	}

	const result = finalizePlacedEntity({
		context: {
			layout: request.snapshot.domain.source.units.layout.data,
			scene: request.snapshot.domain.source.units.scene.data,
			sourceContentId: request.snapshot.sourceContentId
		},
		entityId: allocation.entityId,
		scene: prepared.candidate.scene
	});
	return toOutcome(request, 'place-object', result, resourceEntry);
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
		'place-object' | 'create-form' | 'place-form-copy' | 'create-light' | 'update-light' | 'duplicate-light'
	>
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
		sourceContentId: request.snapshot.domain.source.units.scene.header.contentRevision
	});
	const allocation = readSceneOperationAllocation({
		reader,
		kind,
		allocations: request.intent.allocatedIds,
		scene: request.snapshot.domain.source.units.scene.data
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
			[]
		);
	}

	const context: SceneOperationContext = {
		layout: request.snapshot.domain.source.units.layout.data,
		scene: request.snapshot.domain.source.units.scene.data,
		sourceContentId: request.snapshot.sourceContentId
	};
	let result: SceneOperationResult;
	try {
		result = planOperation(kind, payload, subject.entityId, allocation, context);
	} catch (error) {
		return rejected(
			'invalid-value',
			`The ${kind} planner failed: ${error instanceof Error ? error.message : 'unknown error'}`,
			[]
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
			removed.length === 0 ? null : unlinkPresentations(request, removed)
		);
	}
	return toOutcome(request, kind, result);
}

function planOperation(
	kind: Exclude<
		SceneOperationKind,
		'place-object' | 'create-form' | 'place-form-copy' | 'create-light' | 'update-light' | 'duplicate-light'
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
	context: SceneOperationContext
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
				...(payload.choice === undefined ? {} : { choice: payload.choice })
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
				...(payload.choice === undefined ? {} : { choice: payload.choice })
			});
		case 'set-form-size':
			if (payload.kind !== 'set-form-size') return payloadMismatch(kind);
			return planSetFormSize({
				context,
				entityId,
				scale: payload.scale,
				...(payload.choice === undefined ? {} : { choice: payload.choice })
			});
		case 'resize-on-floor':
			if (payload.kind !== 'resize-on-floor') return payloadMismatch(kind);
			return planResizeOnFloor({
				context,
				entityId,
				scale: payload.scale,
				contactMinY: payload.contactMinY,
				...(payload.choice === undefined ? {} : { choice: payload.choice })
			});
		case 'duplicate-one':
			if (payload.kind !== 'duplicate-one') return payloadMismatch(kind);
			if (allocation.kind !== 'created') {
				return { kind: 'rejected', code: 'invalid-value', message: 'Duplicate needs a captured new id.', diagnostics: [] };
			}
			return planDuplicateOne({
				context,
				entityId,
				newEntityId: allocation.entityId,
				contactMinY: payload.contactMinY,
				...(payload.choice === undefined ? {} : { choice: payload.choice })
			});
		case 'set-lift':
			if (payload.kind !== 'set-lift') return payloadMismatch(kind);
			return planSetLift({
				context,
				entityId,
				lift: payload.lift,
				contactMinY: payload.contactMinY,
				...(payload.choice === undefined ? {} : { choice: payload.choice })
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
	removed: readonly { readonly entityId: string; readonly effectiveName: string }[]
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

function toOutcome(
	request: PlannerRequest<ProjectEnvelope>,
	kind: SceneOperationKind,
	result: SceneOperationResult,
	resourceEntry: CreatorModelResourceEntry | null = null,
	unlinkedExperience: ExperienceUnitPayload | null = null
): PlannerOutcome<ProjectEnvelope> {
	if (result.kind === 'rejected') {
		return rejected(result.code, result.message, result.diagnostics.map((issue) => issue.message));
	}
	const sceneSource = replaceUnitData(request.snapshot.domain.source, 'scene', result.scene);
	const experiencedSource = unlinkedExperience === null
		? sceneSource
		: replaceUnitData(sceneSource, 'experience', unlinkedExperience);
	const source = resourceEntry === null ? experiencedSource : withCreatorModelResource(experiencedSource, resourceEntry);
	if (source === null) {
		return rejected(
			'invalid-value',
			'The model resource could not be added to the candidate envelope.',
			[resourceEntry?.resource.id ?? 'model-resource']
		);
	}
	const candidate: PreparedCandidate<ProjectEnvelope> = {
		operationId: request.intent.operationId,
		sourceKind: request.snapshot.sourceKind,
		sourceVersion: request.snapshot.sourceVersion,
		source,
		changes: [
			{
				kind: `scene-${kind}`,
				subjectIds: [result.entityId],
				fields: [...result.fields]
			},
			...(unlinkedExperience === null
				? []
				: [
						{
							kind: 'experience-presentations-unlinked',
							subjectIds: [result.entityId],
							fields: ['presentations']
						}
					]),
			...(resourceEntry === null
				? []
				: [
						{
							kind: 'resource-model-created',
							subjectIds: [resourceEntry.resource.id],
							fields: ['pin', 'model', 'lock']
						}
					])
		],
		correspondence: result.correspondence.map((entry) => ({
			relation: entry.relation,
			before: entry.relation === 'created' ? null : entityReference(request, entry.entityId),
			after: entry.relation === 'retired' ? null : entityReference(request, entry.entityId)
		})),
		diagnostics: result.diagnostics
	};
	return { kind: 'prepared', candidate };
}

function entityReference(
	request: PlannerRequest<ProjectEnvelope>,
	entityId: string
): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: { kind: 'exact', contentRevision: request.snapshot.domain.source.units.scene.header.contentRevision },
		subject: { kind: 'entity', id: entityId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

function composedPoint(
	worldXZ: readonly [number, number],
	frame: { readonly origin: readonly [number, number, number]; readonly yaw: number }
): [number, number] | null {
	const point = framePointToWorld(
		{ origin: [frame.origin[0], frame.origin[1], frame.origin[2]], yaw: frame.yaw },
		[worldXZ[0], 0, worldXZ[1]]
	);
	return Number.isFinite(point[0]) && Number.isFinite(point[2]) ? [point[0], point[2]] : null;
}

function payloadMismatch(kind: string): SceneOperationResult {
	return {
		kind: 'rejected',
		code: 'invalid-value',
		message: `The ${kind} payload does not match its operation kind.`,
		diagnostics: []
	};
}

function invalidPayload(issues: readonly ShapeIssue[]): PlannerOutcome<ProjectEnvelope> {
	// A structurally valid reference to a frame this reader cannot resolve is not
	// malformed intent, it is an unsupported capability, so it keeps its own code
	// instead of being flattened into `invalid-value`.
	const unsupported = issues.find((issue) => issue.code === 'unsupported-frame');
	if (unsupported !== undefined) {
		return {
			kind: 'rejected',
			code: 'unsupported-frame',
			message: unsupported.message,
			diagnostics: issues
		};
	}
	return { kind: 'rejected', code: 'invalid-value', message: 'The operation intent is not valid captured data.', diagnostics: issues };
}

function rejected(
	code: string,
	message: string,
	diagnostics: readonly string[]
): PlannerOutcome<ProjectEnvelope> {
	return {
		kind: 'rejected',
		code,
		message,
		diagnostics: diagnostics.map((entry) => ({
			path: '$.payload',
			code: 'planner-refusal',
			message: entry
		}))
	};
}
