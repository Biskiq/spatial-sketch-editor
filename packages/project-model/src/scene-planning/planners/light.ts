import type { PlannerOutcome, PlannerRequest } from '../../f4/types';
import { ShapeReader } from '../../strict-shape';
import type { ProjectEnvelope } from '../../units/types';
import {
	readSceneOperationAllocation,
	readSceneOperationPayload,
	readSceneOperationSubject,
} from '../intent-payload';
import type { SceneOperationResult } from '../operations';
import type { LightUpdate } from '../light-operations';
import { planCreateLight, planDuplicateLight, planUpdateLight } from '../light-operations';
import { invalidPayload } from './planner';
import { rejected, toOutcome } from './outcome';

export function planCreateLightIntent(
	request: PlannerRequest<ProjectEnvelope>,
): PlannerOutcome<ProjectEnvelope> {
	const reader = new ShapeReader();
	const payload = readSceneOperationPayload(reader, 'create-light', request.intent.payload);
	if (payload === null || payload.kind !== 'create-light') return invalidPayload(reader.issues);
	const subject = readSceneOperationSubject({
		reader,
		kind: 'create-light',
		targets: request.intent.targets,
		payload,
		sourceContentId: request.snapshot.domain.source.units.scene.header.contentRevision,
	});
	const allocation = readSceneOperationAllocation({
		reader,
		kind: 'create-light',
		allocations: request.intent.allocatedIds,
		scene: request.snapshot.domain.source.units.scene.data,
	});
	if (subject === null || allocation === null) return invalidPayload(reader.issues);
	if (reader.issues.length > 0) return invalidPayload(reader.issues);
	if (subject.kind !== 'none' || allocation.kind !== 'created') {
		return rejected(
			'invalid-value',
			'A light creation addresses no existing subject and captures one new entity id.',
			[],
		);
	}
	let result: SceneOperationResult;
	try {
		result = planCreateLight({
			context: {
				layout: request.snapshot.domain.source.units.layout.data,
				scene: request.snapshot.domain.source.units.scene.data,
				sourceContentId: request.snapshot.sourceContentId,
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
			...(payload.penumbra === undefined ? {} : { penumbra: payload.penumbra }),
		});
	} catch (error) {
		return rejected(
			'invalid-value',
			`The create-light planner failed: ${error instanceof Error ? error.message : 'unknown error'}`,
			[],
		);
	}
	return toOutcome(request, 'create-light', result);
}

export function planUpdateLightIntent(
	request: PlannerRequest<ProjectEnvelope>,
): PlannerOutcome<ProjectEnvelope> {
	const reader = new ShapeReader();
	const payload = readSceneOperationPayload(reader, 'update-light', request.intent.payload);
	if (payload === null || payload.kind !== 'update-light') return invalidPayload(reader.issues);
	const subject = readSceneOperationSubject({
		reader,
		kind: 'update-light',
		targets: request.intent.targets,
		payload,
		sourceContentId: request.snapshot.domain.source.units.scene.header.contentRevision,
	});
	const allocation = readSceneOperationAllocation({
		reader,
		kind: 'update-light',
		allocations: request.intent.allocatedIds,
		scene: request.snapshot.domain.source.units.scene.data,
	});
	if (subject === null || allocation === null) return invalidPayload(reader.issues);
	if (reader.issues.length > 0) return invalidPayload(reader.issues);
	if (subject.kind !== 'entity' || allocation.kind !== 'none') {
		return rejected(
			'invalid-value',
			'A light update addresses one existing Scene entity and creates no id.',
			[],
		);
	}
	const update: LightUpdate = {
		...(payload.position === undefined ? {} : { position: payload.position }),
		...(payload.rotation === undefined ? {} : { rotation: payload.rotation }),
		...(payload.color === undefined ? {} : { color: payload.color }),
		...(payload.intensity === undefined ? {} : { intensity: payload.intensity }),
		...(payload.range === undefined ? {} : { range: payload.range }),
		...(payload.angle === undefined ? {} : { angle: payload.angle }),
		...(payload.penumbra === undefined ? {} : { penumbra: payload.penumbra }),
		...(payload.castShadow === undefined ? {} : { castShadow: payload.castShadow }),
	};
	let result: SceneOperationResult;
	try {
		result = planUpdateLight({
			context: {
				layout: request.snapshot.domain.source.units.layout.data,
				scene: request.snapshot.domain.source.units.scene.data,
				sourceContentId: request.snapshot.sourceContentId,
			},
			entityId: subject.entityId,
			update,
		});
	} catch (error) {
		return rejected(
			'invalid-value',
			`The update-light planner failed: ${error instanceof Error ? error.message : 'unknown error'}`,
			[],
		);
	}
	return toOutcome(request, 'update-light', result);
}

export function planDuplicateLightIntent(
	request: PlannerRequest<ProjectEnvelope>,
): PlannerOutcome<ProjectEnvelope> {
	const reader = new ShapeReader();
	const payload = readSceneOperationPayload(reader, 'duplicate-light', request.intent.payload);
	if (payload === null || payload.kind !== 'duplicate-light') return invalidPayload(reader.issues);
	const subject = readSceneOperationSubject({
		reader,
		kind: 'duplicate-light',
		targets: request.intent.targets,
		payload,
		sourceContentId: request.snapshot.domain.source.units.scene.header.contentRevision,
	});
	const allocation = readSceneOperationAllocation({
		reader,
		kind: 'duplicate-light',
		allocations: request.intent.allocatedIds,
		scene: request.snapshot.domain.source.units.scene.data,
	});
	if (subject === null || allocation === null) return invalidPayload(reader.issues);
	if (reader.issues.length > 0) return invalidPayload(reader.issues);
	if (subject.kind !== 'entity' || allocation.kind !== 'created') {
		return rejected(
			'invalid-value',
			'A light duplicate addresses one existing Scene entity and captures one new id.',
			[],
		);
	}
	let result: SceneOperationResult;
	try {
		result = planDuplicateLight({
			context: {
				layout: request.snapshot.domain.source.units.layout.data,
				scene: request.snapshot.domain.source.units.scene.data,
				sourceContentId: request.snapshot.sourceContentId,
			},
			entityId: subject.entityId,
			newEntityId: allocation.entityId,
		});
	} catch (error) {
		return rejected(
			'invalid-value',
			`The duplicate-light planner failed: ${error instanceof Error ? error.message : 'unknown error'}`,
			[],
		);
	}
	return toOutcome(request, 'duplicate-light', result);
}
