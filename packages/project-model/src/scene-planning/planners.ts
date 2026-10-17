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
import { CURRENT_SOURCE_KIND, CURRENT_SOURCE_VERSION } from '../f4/admission';
import type {
	DomainPlanner,
	PlannerAdmission,
	PlannerOutcome,
	PlannerRequest,
	PreparedCandidate
} from '../f4';
import { ShapeReader, type ShapeIssue } from '../strict-shape';
import type { ProjectDocument } from '../project-types';
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
	planDeleteOne,
	planDuplicateOne,
	planMoveHorizontal,
	planPlaceOnFloor,
	planResizeOnFloor,
	planSetYaw,
	finalizePlacedEntity,
	SCENE_OPERATION_KINDS,
	type SceneOperationContext,
	type SceneOperationKind,
	type SceneOperationResult
} from './operations';
import { resolveSceneSupport } from './support';
import type { NormalizedPlacementDefinition } from './types';

const SCENE_PLANNER_ADMISSION: PlannerAdmission = Object.freeze({
	domain: 'scene',
	compound: false,
	units: false,
	resources: false
});

export type ScenePlannerOptions = {
	/**
	 * The host's admitted normalized definitions, captured before planning. An
	 * empty list admits no new placement; existing-object operations still work.
	 */
	readonly definitions?: readonly NormalizedPlacementDefinition[];
};

/**
 * The seven Scene planners, ready to register with the accepted F.4
 * coordinator. One operation kind has exactly one planner.
 */
export function createScenePlanners(
	options: ScenePlannerOptions = {}
): readonly DomainPlanner<ProjectDocument>[] {
	const definitions = new Map(
		(options.definitions ?? []).map((definition) => [definition.definitionKey, definition])
	);
	return SCENE_OPERATION_KINDS.map((kind) =>
		scenePlanner(kind, (request) =>
			kind === 'place-object'
				? planPlaceObject(request, definitions)
				: planExistingObject(request, kind)
		)
	);
}

function scenePlanner(
	kind: SceneOperationKind,
	prepare: (request: PlannerRequest<ProjectDocument>) => PlannerOutcome<ProjectDocument>
): DomainPlanner<ProjectDocument> {
	return {
		id: `scene.${kind}`,
		kind,
		admission: SCENE_PLANNER_ADMISSION,
		sourceKinds: [CURRENT_SOURCE_KIND],
		sourceVersions: [CURRENT_SOURCE_VERSION],
		prepare
	};
}

function planPlaceObject(
	request: PlannerRequest<ProjectDocument>,
	definitions: ReadonlyMap<string, NormalizedPlacementDefinition>
): PlannerOutcome<ProjectDocument> {
	const reader = new ShapeReader();
	const payload = readSceneOperationPayload(reader, 'place-object', request.intent.payload);
	if (payload === null || payload.kind !== 'place-object') return invalidPayload(reader.issues);
	const subject = readSceneOperationSubject({
		reader,
		kind: 'place-object',
		targets: request.intent.targets,
		payload,
		sourceContentId: request.snapshot.sourceContentId
	});
	const allocation = readSceneOperationAllocation({
		reader,
		kind: 'place-object',
		allocations: request.intent.allocatedIds,
		scene: request.snapshot.domain.source.scene
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

	const point = composedPoint(payload.worldXZ, payload.frame);
	if (point === null) return rejected('invalid-value', 'The placement X/Z is not finite.', ['worldXZ']);
	const support = resolveSceneSupport({
		layout: request.snapshot.domain.source.layout,
		sourceContentId: request.snapshot.sourceContentId,
		point,
		requiredElevation: null,
		...(payload.choice === undefined ? {} : { choice: payload.choice })
	});
	if (support.kind === 'refused') {
		return rejected(support.code, support.message, support.candidates.map((candidate) => candidate.orderKey));
	}

	const prepared = preparePlaceObjectCandidate({
		document: request.snapshot.domain.source.scene,
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
			project: request.snapshot.domain.source,
			sourceContentId: request.snapshot.sourceContentId
		},
		entityId: allocation.entityId,
		scene: prepared.candidate.scene
	});
	return toOutcome(request, 'place-object', result);
}

function planExistingObject(
	request: PlannerRequest<ProjectDocument>,
	kind: Exclude<SceneOperationKind, 'place-object'>
): PlannerOutcome<ProjectDocument> {
	const reader = new ShapeReader();
	const payload = readSceneOperationPayload(reader, kind, request.intent.payload);
	if (payload === null || payload.kind === 'place-object') return invalidPayload(reader.issues);
	const subject = readSceneOperationSubject({
		reader,
		kind,
		targets: request.intent.targets,
		payload,
		sourceContentId: request.snapshot.sourceContentId
	});
	const allocation = readSceneOperationAllocation({
		reader,
		kind,
		allocations: request.intent.allocatedIds,
		scene: request.snapshot.domain.source.scene
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
		project: request.snapshot.domain.source,
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
	return toOutcome(request, kind, result);
}

function planOperation(
	kind: Exclude<SceneOperationKind, 'place-object'>,
	payload: Exclude<SceneOperationPayload, { kind: 'place-object' }>,
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
		case 'delete-one':
			if (payload.kind !== 'delete-one') return payloadMismatch(kind);
			return planDeleteOne({ context, entityId });
	}
}

function toOutcome(
	request: PlannerRequest<ProjectDocument>,
	kind: SceneOperationKind,
	result: SceneOperationResult
): PlannerOutcome<ProjectDocument> {
	if (result.kind === 'rejected') {
		return rejected(result.code, result.message, result.diagnostics.map((issue) => issue.message));
	}
	const candidate: PreparedCandidate<ProjectDocument> = {
		operationId: request.intent.operationId,
		sourceKind: request.snapshot.sourceKind,
		sourceVersion: request.snapshot.sourceVersion,
		source: { ...request.snapshot.domain.source, scene: result.scene },
		changes: [
			{
				kind: `scene-${kind}`,
				subjectIds: [result.entityId],
				fields: [...result.fields]
			}
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
	request: PlannerRequest<ProjectDocument>,
	entityId: string
): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: { kind: 'exact', contentRevision: request.snapshot.sourceContentId },
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

function invalidPayload(issues: readonly ShapeIssue[]): PlannerOutcome<ProjectDocument> {
	return { kind: 'rejected', code: 'invalid-value', message: 'The operation intent is not valid captured data.', diagnostics: issues };
}

function rejected(
	code: string,
	message: string,
	diagnostics: readonly string[]
): PlannerOutcome<ProjectDocument> {
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
