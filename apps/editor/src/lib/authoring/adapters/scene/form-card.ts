/** Card commands capture one accepted source and use the existing Scene planners/F4 host. */
import type { AuthoringIntent } from '@portfolio/project-model';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageScene } from '$lib/authoring/stage/unit-stage-source';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import { sceneEntityReference } from './placement';

export function formCardController(services: StageAdapterServices, entityId: string) {
	const snapshot = services.stage.snapshot();
	const entity = stageScene(snapshot).entities.find((entry) => entry.id === entityId);
	if (entity?.kind !== 'form') return null;
	const mesh = evaluateFormMesh(entity.form);
	if (mesh === null) return null;
	const reference = sceneEntityReference(entityId, snapshot.domain.unitRevisions.scene);
	const dimensions = mesh.bounds.max.map((value, axis) => value - mesh.bounds.min[axis]!);
	async function run(kind: string, payload: AuthoringIntent['payload'], newId?: string) {
		const outcome = await services.authoring.accept({
			version: 1, kind, operationId: crypto.randomUUID(),
			expectedRevision: snapshot.acceptedRevision, targets: [reference], payload,
			capturedInputs: [], allocatedIds: newId === undefined ? [] : [{ kind: 'scene-entity', id: newId }]
		});
		if (outcome.kind === 'installed' && newId !== undefined) {
			const next = sceneEntityReference(newId, services.stage.snapshot().domain.unitRevisions.scene);
			services.stage.setSelection({ ordered: [{ reference: next }], primary: next });
		}
		return outcome;
	}
	const frame = { version: 1, kind: 'project-world' };
	const localFrame = { origin: [0, 0, 0], yaw: 0 };
	const transformPayload = (x: number, z: number) => ({
		entityId, worldXZ: [x, z], frame: localFrame, frameReference: frame, contactMinY: mesh.contactMinY
	});
	return {
		entity, dimensions,
		move: (x: number, z: number) => run('move-horizontal', transformPayload(x, z)),
		turn: (yaw: number) => run('set-yaw', { entityId, yaw, frame: localFrame, frameReference: frame }),
		place: (x: number, z: number) => run('place-on-floor', transformPayload(x, z)),
		size: (values: readonly [number, number, number]) => run('set-form-size', {
			entityId, scale: values.map((value, axis) => value / dimensions[axis]! * entity.form.scale[axis]!)
		}),
		duplicate: () => run('duplicate-one', { entityId, contactMinY: mesh.contactMinY }, crypto.randomUUID()),
		delete: () => run('delete-one', { entityId })
	};
}
