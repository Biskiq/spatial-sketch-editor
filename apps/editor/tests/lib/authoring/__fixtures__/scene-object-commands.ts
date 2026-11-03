/**
 * Test verbs for a selected Scene object, run through the shared object paths.
 *
 * Forms and catalogue objects share one Card and one set of planners, so these
 * verbs submit exactly the intents the shared Card and marks build: Position and
 * Yaw through `place-on-floor`/`set-yaw`, a form's per-axis size through
 * `set-form-size`, and Duplicate, Delete and Save through the shared commands.
 * Each verb is one intent, so a test can count history entries.
 */
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageScene } from '$lib/authoring/stage/unit-stage-source';
import { acceptFormCommand } from '$lib/authoring/adapters/scene/form-card-command';
import {
	deleteSceneObject,
	duplicateSceneObject,
	saveSceneObjectToMyObjects,
	sceneObjectCardController
} from '$lib/authoring/adapters/scene/object-card';
import { localContactMinY } from '$lib/authoring/adapters/scene/placement';
import type { FormLibraryClient } from '$lib/authoring/adapters/scene/library/client';

const FRAME = { origin: [0, 0, 0], yaw: 0 };
const PROJECT_WORLD = { version: 1, kind: 'project-world' };

export function sceneObjectCommands(services: StageAdapterServices, entityId: string) {
	const controller = sceneObjectCardController(services, entityId);
	if (controller === null) return null;
	const live = () => stageScene(services.stage.snapshot()).entities.find((entry) => entry.id === entityId);
	const installed = (kind: string) => (kind === 'accepted' ? ('installed' as const) : kind);
	/** The form's Width, Height and Depth as the shared Card shows them. */
	const dimensions = (['width', 'height', 'depth'] as const).map((id) =>
		Number(controller.fields().find((field) => field.id === id)?.text ?? NaN)
	);
	const run = (kind: string, payload: Record<string, unknown>) =>
		acceptFormCommand(services, services.stage.snapshot(), entityId, kind, payload as never);
	const place = (x: number, z: number) => {
		const entity = live();
		return run('place-on-floor', {
			entityId,
			worldXZ: [x, z],
			frame: FRAME,
			frameReference: PROJECT_WORLD,
			contactMinY: entity === undefined ? 0 : localContactMinY(entity)
		});
	};
	return {
		controller,
		dimensions,
		move: place,
		place,
		turn: (yaw: number) => run('set-yaw', { entityId, yaw, frame: FRAME, frameReference: PROJECT_WORLD }),
		/** All three dimensions in one `set-form-size`, as one drag or Card commit would. */
		size: (values: readonly [number, number, number]) => {
			const entity = live();
			const scale =
				entity?.kind === 'form'
					? values.map((value, axis) => (value / dimensions[axis]!) * entity.form.scale[axis]!)
					: values;
			return run('set-form-size', { entityId, scale });
		},
		duplicate: async () => {
			const outcome = await duplicateSceneObject(services, services.stage.snapshot(), entityId);
			return { ...outcome, kind: installed(outcome.kind) };
		},
		delete: async () => {
			const outcome = await deleteSceneObject(services, services.stage.snapshot(), entityId);
			return { ...outcome, kind: installed(outcome.kind) };
		},
		save: (client?: FormLibraryClient) => saveSceneObjectToMyObjects(services, entityId, client)
	};
}
