/** Independent domain consumer: public facade + public authoring port only. */
import type { StageAdapterFactory } from '$lib/authoring/stage/stage-adapter-host';
import { createProofLayoutPlanner, createProofSceneScalarPlanner, proofIntent,
	PROOF_LAYOUT_TRANSFORM_KIND, layoutObjectReference } from './f4-current-source-fixtures';

export function createDomainConsumer(objectId: string, disposals: string[]): StageAdapterFactory {
	return ({ stage, authoring }) => {
		for (const planner of [createProofLayoutPlanner(objectId), createProofSceneScalarPlanner()]) {
			const registration = authoring.registerPlanner(planner);
			if (registration.kind !== 'registered') throw new Error('planner registration failed');
		}
		return {
			id: 'domain-consumer',
			requiredCapabilities: ['stage-instrument-v1'],
			bind(context) {
				return {
					tasks: [{ id: 'consumer-move', taskKind: 'consumer-move', label: 'Move probe' }],
					findEntries: [{ id: 'consumer-move', taskKind: 'consumer-move', label: 'Move probe', railFamily: 'place', capability: 'layout' }],
					cardFacts: () => [{ label: 'Bound content', value: context.snapshot.sourceContentId }],
					instrument: () => ({ summary: context.snapshot.sourceContentId }),
					dispose: () => disposals.push(context.snapshot.sourceContentId),
					overlay: () => []
				};
			}
		};
	};
}

export function consumerMove(services: Parameters<StageAdapterFactory>[0], objectId: string) {
	const snapshot = services.stage.snapshot();
	return services.authoring.accept(proofIntent({
		kind: PROOF_LAYOUT_TRANSFORM_KIND, operationId: 'consumer-operation',
		expectedRevision: services.authoring.acceptedRevision().revisionId,
		projectId: snapshot.acceptedRevision.projectId, contentRevision: snapshot.sourceContentId,
		targets: [layoutObjectReference(snapshot.sourceContentId, objectId)], payload: { objectId, position: [4, 0, 2] }
	}));
}

export function consumerSceneEdit(services: Parameters<StageAdapterFactory>[0]) {
	const snapshot = services.stage.snapshot();
	const entity = snapshot.domain.project.scene.entities[0]!;
	return services.authoring.accept(proofIntent({ kind: 'conformance-scene-entity-scalar',
		operationId: 'consumer-scene-operation', expectedRevision: services.authoring.acceptedRevision().revisionId,
		projectId: snapshot.acceptedRevision.projectId, contentRevision: snapshot.sourceContentId,
		targets: [{ version: 1, domain: 'scene', revision: { kind: 'exact', contentRevision: snapshot.sourceContentId },
			subject: { kind: 'entity', id: entity.id }, instancePath: [], location: { kind: 'project-root' }, componentId: null, capabilityId: null }],
		payload: { entityId: entity.id, receiveShadow: true }
	}));
}
