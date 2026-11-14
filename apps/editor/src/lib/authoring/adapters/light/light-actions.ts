/**
 * X8 — the Light Card's commands.
 *
 * The named actions a Light contributes to the Card and the Eraser: Duplicate,
 * Delete, the name writer, and S7's "Light it" selection recipe for Artwork and
 * objects. Each runs through the registered `create-light`, `duplicate-light`,
 * `delete-one` and `set-name` planners via the shared Form command path; none
 * opens a lease, holds a gesture or edits the Scene itself, so a command cannot
 * strand a capture. The recipes themselves stay in `look/light-recipes`.
 */
import type { SceneEntity } from '@portfolio/project-model';
import type {
	StageAdapterBinding,
	StageAdapterServices,
	StageCardAction,
	StageCardSubject
} from '$lib/authoring/stage/stage-adapter-host';
import { sceneEntityReference } from '../scene/placement';
import { acceptFormCommand } from '../scene/form-card-command';
import {
	artworkLightBounds,
	horizontalFront,
	pictureSpotRecipe,
	unionLightItBounds,
	washRecipe,
	type LightItBounds,
	type LightItRecipeOutcome
} from '../../look/light-recipes';
import { entityById, lightById, nextEntityName, type Light } from './light-subjects';


type LightItSelectionRecipe = LightItRecipeOutcome;

/**
 * S7's selection recipe: one Picture spot for one Artwork, otherwise one Wash
 * over the union of every selected subject's evaluated bounds. A multi-selection
 * never produces one light per object, and a light in the selection is refused
 * rather than silently ignored.
 */
function lightItSelectionRecipe(services: StageAdapterServices): LightItSelectionRecipe {
	const snapshot = services.stage.snapshot();
	const selection = services.stage.selectionState();
	if (selection.ordered.length === 0) {
		return { kind: 'refused', message: 'Select Artwork or an object before using Light it.' };
	}
	const targets: { readonly entity: SceneEntity; readonly bounds: LightItBounds }[] = [];
	for (const entry of selection.ordered) {
		if (entry.reference.domain !== 'scene' || entry.reference.subject.kind !== 'entity') {
			return {
				kind: 'refused',
				message: 'Light it works on Scene Artwork and objects, not on that selection.'
			};
		}
		const entity = entityById(snapshot, entry.reference.subject.id);
		if (entity === null) {
			return { kind: 'refused', message: 'A selected subject is no longer in this Scene.' };
		}
		if (entity.kind === 'light') {
			return { kind: 'refused', message: 'A light cannot be lit; select Artwork or an object.' };
		}
		const bounds =
			entity.kind === 'artwork'
				? artworkLightBounds(entity)
				: services.stage.sceneBounds(entity.id);
		if (bounds === null) {
			return { kind: 'refused', message: `${entity.name} has no evaluated bounds yet.` };
		}
		targets.push({ entity, bounds });
	}
	const primaryId = selection.primary?.subject.id;
	const primary = targets.find((target) => target.entity.id === primaryId) ?? targets[0]!;
	if (targets.length === 1 && primary.entity.kind === 'artwork') {
		return pictureSpotRecipe(primary.entity);
	}
	const bounds = unionLightItBounds(targets.map((target) => target.bounds));
	if (bounds === null) {
		return { kind: 'refused', message: 'The selection has no bounds to light.' };
	}
	return washRecipe({ bounds, front: horizontalFront(primary.entity.rotation) });
}

function lightItDetail(entity: SceneEntity, selectedCount: number): string {
	if (selectedCount > 1) {
		return 'Places one Wash covering every selected subject. It is not grouped. One undo.';
	}
	return entity.kind === 'artwork'
		? 'Places a Picture spot 1.4 m in front and 30° above, fitted to the Artwork. It is not grouped. One undo.'
		: 'Places a Wash fitted to the object’s evaluated bounds. It is not grouped. One undo.';
}

export function lightItAction(
	services: StageAdapterServices,
	subject: StageCardSubject
): StageCardAction | null {
	if (subject.reference?.domain !== 'scene') return null;
	const snapshot = services.stage.snapshot();
	const entity = entityById(snapshot, subject.sourceId);
	if (entity === null || entity.kind === 'light') return null;
	const selectedCount = services.stage.selectionState().ordered.length;
	return {
		id: 'light-it',
		label: 'Light it',
		detail: lightItDetail(entity, selectedCount),
		async run() {
			const prepared = lightItSelectionRecipe(services);
			if (prepared.kind === 'refused') return { kind: 'refused', message: prepared.message };
			const live = services.stage.snapshot();
			const allocatedId = `light-${crypto.randomUUID()}`;
			const { recipe } = prepared;
			let outcome: Awaited<ReturnType<typeof services.authoring.accept>>;
			try {
				outcome = await services.authoring.accept({
					version: 1,
					kind: 'create-light',
					operationId: crypto.randomUUID(),
					expectedRevision: live.acceptedRevision,
					targets: [],
					payload: {
						light: 'spot',
						name: nextEntityName(live, recipe.name),
						color: recipe.color,
						intensity: recipe.intensity,
						castShadow: recipe.castShadow,
						position: [...recipe.position],
						rotation: [...recipe.rotation],
						angle: recipe.angle,
						range: recipe.range
					} as never,
					capturedInputs: [],
					allocatedIds: [{ kind: 'scene-entity', id: allocatedId }]
				});
			} finally {
				services.stage.notifySurfaceChange();
			}
			if (outcome.kind === 'installed') {
				const reference = sceneEntityReference(
					allocatedId,
					services.stage.snapshot().domain.unitRevisions.scene
				);
				services.stage.setSelection({ ordered: [{ reference }], primary: reference });
				return { kind: 'accepted' };
			}
			return outcome.kind === 'refused'
				? { kind: 'refused', message: outcome.message }
				: { kind: 'no-op' };
		}
	};
}

export function duplicateLightAction(
	services: StageAdapterServices,
	light: Light
): StageCardAction {
	return {
		id: 'light-duplicate',
		label: 'Duplicate light',
		compactLabel: 'Duplicate',
		group: 'primary',
		detail: `Add one copy of ${light.name} at +0.5 m X/Z. Undo removes it.`,
		async run() {
			const allocatedId = `light-${crypto.randomUUID()}`;
			const outcome = await acceptFormCommand(
				services,
				services.stage.snapshot(),
				light.id,
				'duplicate-light',
				{ entityId: light.id },
				allocatedId
			);
			if (outcome.kind === 'installed') {
				const reference = sceneEntityReference(
					allocatedId,
					services.stage.snapshot().domain.unitRevisions.scene
				);
				services.stage.setSelection({ ordered: [{ reference }], primary: reference });
			}
			return outcome.kind === 'refused'
				? { kind: 'refused', message: outcome.message }
				: outcome.kind === 'no-op'
					? { kind: 'no-op' }
					: { kind: 'accepted' };
		}
	};
}

export function deleteLightAction(
	services: StageAdapterServices,
	light: Light
): StageCardAction {
	return {
		id: 'light-delete',
		label: 'Delete light',
		compactLabel: 'Delete',
		destructive: true,
		detail: `Remove ${light.name}. Undo restores it.`,
		async run() {
			const outcome = await acceptFormCommand(
				services,
				services.stage.snapshot(),
				light.id,
				'delete-one',
				{ entityId: light.id }
			);
			return outcome.kind === 'refused'
				? { kind: 'refused', message: outcome.message }
				: outcome.kind === 'no-op'
					? { kind: 'no-op' }
					: { kind: 'accepted' };
		}
	};
}

/** The Card's actions for a light (Duplicate, Delete) or an object ("Light it"). */
export function lightCardActions(
	services: StageAdapterServices,
	subject: StageCardSubject
): readonly StageCardAction[] {
	if (subject.reference?.domain !== 'scene') return [];
	const snapshot = services.stage.snapshot();
	const light = lightById(snapshot, subject.sourceId);
	if (light !== null) return [duplicateLightAction(services, light), deleteLightAction(services, light)];
	const lightIt = lightItAction(services, subject);
	return lightIt === null ? [] : [lightIt];
}

/** The light's Card name writer, or `null` when the subject is not a light. */
export function lightNameWriter(
	services: StageAdapterServices,
	subject: StageCardSubject
): ReturnType<NonNullable<StageAdapterBinding['cardName']>> {
	if (subject.reference?.domain !== 'scene') return null;
	const light = lightById(services.stage.snapshot(), subject.sourceId);
	if (light === null) return null;
	return {
		value: light.name,
		async commit(name: string) {
			const outcome = await acceptFormCommand(
				services,
				services.stage.snapshot(),
				light.id,
				'set-name',
				{ entityId: light.id, name }
			);
			return outcome.kind === 'refused'
				? { kind: 'refused', code: 'refused', message: outcome.message }
				: { kind: 'accepted' };
		}
	};
}
