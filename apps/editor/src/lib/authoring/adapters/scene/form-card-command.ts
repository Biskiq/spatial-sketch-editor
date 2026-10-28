/** Shared captured intent builder; Card fields stay outside Stage first load. */
import type { AuthoringIntent } from '@portfolio/project-model';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import type { StageReadSnapshot } from '$lib/authoring/stage/accepted-read';
import { perfMark } from '$lib/platform/perf-marks';
import { sceneEntityReference } from './placement';

export function acceptFormCommand(services: StageAdapterServices, snapshot: StageReadSnapshot,
	entityId: string, kind: string, payload: AuthoringIntent['payload'], allocatedId?: string) {
	perfMark('command:scene-form', { operation: kind, entityId });
	return services.authoring.accept({
		version: 1, kind, operationId: crypto.randomUUID(), expectedRevision: snapshot.acceptedRevision,
		targets: [sceneEntityReference(entityId, snapshot.domain.unitRevisions.scene)], payload,
		capturedInputs: [], allocatedIds: allocatedId === undefined ? [] : [{ kind: 'scene-entity', id: allocatedId }]
	});
}

export async function deleteForm(services: StageAdapterServices, snapshot: StageReadSnapshot, entityId: string) {
	const result = await acceptFormCommand(services, snapshot, entityId, 'delete-one', { entityId });
	return result.kind === 'refused' ? { kind: 'refused' as const, message: result.message }
		: { kind: result.kind === 'no-op' ? 'no-op' as const : 'accepted' as const };
}
