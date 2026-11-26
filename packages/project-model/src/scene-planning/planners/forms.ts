import type { PlannerOutcome, PlannerRequest } from '../../f4/types';
import { ShapeReader } from '../../strict-shape';
import type { ProjectEnvelope } from '../../units/types';
import {
	readSceneOperationAllocation,
	readSceneOperationPayload,
	readSceneOperationSubject,
} from '../intent-payload';
import type { SceneOperationResult } from '../operations';
import { planCreateForm, planPlaceFormCopy } from '../operations';
import { invalidPayload, rejected, toOutcome } from './planner';

export function planCreateFormIntent(
	request: PlannerRequest<ProjectEnvelope>,
): PlannerOutcome<ProjectEnvelope> {
	const reader = new ShapeReader();
	const payload = readSceneOperationPayload(reader, 'create-form', request.intent.payload);
	if (payload === null || payload.kind !== 'create-form') return invalidPayload(reader.issues);
	const subject = readSceneOperationSubject({
		reader,
		kind: 'create-form',
		targets: request.intent.targets,
		payload,
		sourceContentId: request.snapshot.domain.source.units.scene.header.contentRevision,
	});
	const allocation = readSceneOperationAllocation({
		reader,
		kind: 'create-form',
		allocations: request.intent.allocatedIds,
		scene: request.snapshot.domain.source.units.scene.data,
	});
	if (subject === null || allocation === null) return invalidPayload(reader.issues);
	if (reader.issues.length > 0) return invalidPayload(reader.issues);
	if (subject.kind !== 'none' || allocation.kind !== 'created') {
		return rejected(
			'invalid-value',
			'A form creation addresses no existing subject and captures one new entity id.',
			[],
		);
	}
	let result: SceneOperationResult;
	try {
		result = planCreateForm({
			context: {
				layout: request.snapshot.domain.source.units.layout.data,
				scene: request.snapshot.domain.source.units.scene.data,
				sourceContentId: request.snapshot.sourceContentId,
			},
			entityId: allocation.entityId,
			plane: payload.plane,
			outline: payload.outline,
			extent: payload.extent,
			position: payload.position,
			yaw: payload.yaw,
			materialId: payload.materialId,
			name: payload.name,
			...(payload.choice === undefined ? {} : { choice: payload.choice }),
		});
	} catch (error) {
		// Parity with every existing-object planner: an unexpected kernel failure is
		// a typed refusal, never an error escaping the coordinator.
		return rejected(
			'invalid-value',
			`The create-form planner failed: ${error instanceof Error ? error.message : 'unknown error'}`,
			[],
		);
	}
	return toOutcome(request, 'create-form', result);
}

export function planPlaceFormCopyIntent(
	request: PlannerRequest<ProjectEnvelope>,
): PlannerOutcome<ProjectEnvelope> {
	const reader = new ShapeReader();
	const payload = readSceneOperationPayload(reader, 'place-form-copy', request.intent.payload);
	if (payload === null || payload.kind !== 'place-form-copy') return invalidPayload(reader.issues);
	const subject = readSceneOperationSubject({
		reader,
		kind: 'place-form-copy',
		targets: request.intent.targets,
		payload,
		sourceContentId: request.snapshot.domain.source.units.scene.header.contentRevision,
	});
	const allocation = readSceneOperationAllocation({
		reader,
		kind: 'place-form-copy',
		allocations: request.intent.allocatedIds,
		scene: request.snapshot.domain.source.units.scene.data,
	});
	if (subject === null || allocation === null) return invalidPayload(reader.issues);
	if (reader.issues.length > 0) return invalidPayload(reader.issues);
	if (subject.kind !== 'none' || allocation.kind !== 'created') {
		return rejected(
			'invalid-value',
			'A saved form copy addresses no existing subject and captures one new entity id.',
			[],
		);
	}
	let result: SceneOperationResult;
	try {
		result = planPlaceFormCopy({
			context: {
				layout: request.snapshot.domain.source.units.layout.data,
				scene: request.snapshot.domain.source.units.scene.data,
				sourceContentId: request.snapshot.sourceContentId,
			},
			entityId: allocation.entityId,
			item: payload.item,
			worldXZ: payload.worldXZ,
			yaw: payload.yaw,
			contactMinY: payload.contactMinY,
			...(payload.choice === undefined ? {} : { choice: payload.choice }),
		});
	} catch (error) {
		return rejected(
			'invalid-value',
			`The place-form-copy planner failed: ${error instanceof Error ? error.message : 'unknown error'}`,
			[],
		);
	}
	return toOutcome(request, 'place-form-copy', result);
}
