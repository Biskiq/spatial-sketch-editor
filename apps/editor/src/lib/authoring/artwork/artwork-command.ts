import type { SemanticReference } from '@portfolio/project-model';
import { stageEnvelope, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';

export function artworkReference(services: StageAdapterServices, id: string): SemanticReference {
	return {
		version: 1, domain: 'scene',
		revision: { kind: 'exact', contentRevision: stageEnvelope(services.stage.snapshot()).units.scene.header.contentRevision },
		subject: { kind: 'entity', id }, instancePath: [], location: { kind: 'project-root' },
		componentId: null, capabilityId: null
	};
}

export function artworkCommand(services: StageAdapterServices, kind: string, payload: Parameters<StageAdapterServices['authoring']['accept']>[0]['payload'], options: {
	target?: string;
	create?: string;
	expectedRevision?: ReturnType<StageAdapterServices['stage']['snapshot']>['acceptedRevision'];
} = {}) {
	return services.authoring.accept({
		version: 1, kind, operationId: crypto.randomUUID(),
		expectedRevision: options.expectedRevision ?? services.stage.snapshot().acceptedRevision,
		targets: options.target === undefined ? [] : [artworkReference(services, options.target)],
		payload,
		allocatedIds: options.create === undefined ? [] : [{ kind: 'scene-entity', id: options.create }],
		capturedInputs: []
	});
}
