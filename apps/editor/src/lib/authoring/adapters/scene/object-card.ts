/**
 * R217.S08 — the Card's object writer.
 *
 * The Arrange instrument's exact fields move here, where PLATE puts ordinary
 * dimensions. Every field calls the same `planSceneObjectMark` dispatch its mark
 * uses, so typing a value and dragging to it cannot install different facts or
 * report different refusals.
 *
 * Entry is deliberately not a document write: `edit` validates and previews,
 * `commit` submits one F4 intent, `cancel` restores and `blur` never commits.
 * Nothing here takes a gesture lease — an exact field has no pointer to own.
 */
import type { AuthoringIntent } from '@portfolio/project-model';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope, stageScene } from '$lib/authoring/stage/unit-stage-source';
import type { SceneOperationContext } from '@portfolio/project-model/scene-planning';

import { acceptFormCommand } from './form-card-command';
import {
	SCENE_OBJECT_CARD_FIELD_IDS,
	SCENE_OBJECT_MARK,
	isSceneObjectEntity,
	planSceneObjectMark,
	sceneObjectCardFields,
	sceneObjectScale,
	sceneYawRadians,
	type SceneObjectCardField,
	type SceneObjectCardFieldId
} from './object-marks';
import { localContactMinY, sceneEntityReference, sceneModelContactMinY } from './placement';

export type SceneObjectCardWrite =
	| { readonly kind: 'accepted' | 'no-op' }
	| { readonly kind: 'refused' | 'invalid'; readonly message: string };

export type SceneObjectCardController = {
	readonly entityId: string;
	readonly fields: () => readonly SceneObjectCardField[];
	/** Validate and hold the draft; no source is written and no history enters. */
	edit(id: SceneObjectCardFieldId, text: string): void;
	/** Submit exactly one F4 intent for the field. */
	commit(id: SceneObjectCardFieldId): Promise<SceneObjectCardWrite>;
	/** Restore the accepted text; `true` when a draft was discarded. */
	cancel(id: SceneObjectCardFieldId): boolean;
	/** Discard the draft without writing; blur never commits. */
	blur(id: SceneObjectCardFieldId): void;
};

type Parsed =
	| { readonly ok: true; readonly value: number }
	| { readonly ok: false; readonly message: string };

function parseNumber(text: string): Parsed {
	const trimmed = text.trim();
	if (trimmed.length === 0) return { ok: false, message: 'Enter a value; an empty field is not zero.' };
	const value = Number(trimmed);
	if (!Number.isFinite(value)) return { ok: false, message: 'The value must be finite.' };
	return { ok: true, value };
}

export function sceneObjectCardController(
	services: StageAdapterServices,
	entityId: string
): SceneObjectCardController | null {
	const entity = stageScene(services.stage.snapshot()).entities.find((entry) => entry.id === entityId);
	if (!isSceneObjectEntity(entity)) return null;

	const drafts = new Map<SceneObjectCardFieldId, { text: string; error: string | null }>();

	function liveEntity() {
		const next = stageScene(services.stage.snapshot()).entities.find((entry) => entry.id === entityId);
		return isSceneObjectEntity(next) ? next : null;
	}

	function contactOf(live: ReturnType<typeof liveEntity>): number | null {
		if (live === null) return null;
		return localContactMinY(
			live,
			live.kind === 'model' ? sceneModelContactMinY(stageEnvelope(services.stage.snapshot()), live) : null
		);
	}

	function contextOf(): SceneOperationContext {
		const snapshot = services.stage.snapshot();
		return {
			layout: stageEnvelope(snapshot).units.layout.data,
			scene: stageScene(snapshot),
			sourceContentId: snapshot.domain.unitRevisions.scene
		};
	}

	function acceptedText(id: SceneObjectCardFieldId): string {
		const live = liveEntity();
		if (live === null) return '';
		return sceneObjectCardFields(live).find((field) => field.id === id)?.text ?? '';
	}

	/** The planner's refusal for the current draft, or `null`. */
	function preview(id: SceneObjectCardFieldId, value: number): string | null {
		const live = liveEntity();
		if (live === null) return 'The entity no longer exists.';
		if (id === 'yaw') {
			const result = planSceneObjectMark({
				markId: SCENE_OBJECT_MARK.turn,
				context: contextOf(),
				entityId,
				yaw: sceneYawRadians(value)
			});
			return result.kind === 'rejected' ? result.message : null;
		}
		const contactMinY = contactOf(live);
		if (contactMinY === null) {
			return 'The entity has no verified floor contact for this operation.';
		}
		if (id === 'size') {
			const result = planSceneObjectMark({
				markId: SCENE_OBJECT_MARK.size,
				context: contextOf(),
				entityId,
				contactMinY,
				scale: value
			});
			return result.kind === 'rejected' ? result.message : null;
		}
		const result = planSceneObjectMark({
			markId: SCENE_OBJECT_MARK.move,
			context: contextOf(),
			entityId,
			contactMinY,
			worldXZ: id === 'position-x' ? [value, live.position[2]] : [live.position[0], value]
		});
		return result.kind === 'rejected' ? result.message : null;
	}

	function payloadFor(
		id: SceneObjectCardFieldId,
		live: NonNullable<ReturnType<typeof liveEntity>>,
		value: number,
		contactMinY: number
	): {
		readonly kind: string;
		readonly payload: AuthoringIntent['payload'];
	} {
		if (id === 'yaw') {
			return {
				kind: 'set-yaw',
				payload: {
					entityId,
					yaw: sceneYawRadians(value),
					frame: { origin: [0, 0, 0], yaw: 0 },
					frameReference: { version: 1, kind: 'project-world' }
				}
			};
		}
		if (id === 'size') {
			return {
				kind: 'resize-on-floor',
				payload: { entityId, scale: value, contactMinY }
			};
		}
		return {
			kind: 'place-on-floor',
			payload: {
				entityId,
				worldXZ: id === 'position-x' ? [value, live.position[2]] : [live.position[0], value],
				frame: { origin: [0, 0, 0], yaw: 0 },
				frameReference: { version: 1, kind: 'project-world' },
				contactMinY
			}
		};
	}

	return {
		entityId,
		fields() {
			const live = liveEntity();
			if (live === null) return [];
			return sceneObjectCardFields(live).map((field) => {
				const draft = drafts.get(field.id);
				return draft === undefined
					? { ...field, error: null }
					: { ...field, text: draft.text, error: draft.error };
			});
		},
		edit(id, text) {
			if (!SCENE_OBJECT_CARD_FIELD_IDS.includes(id)) return;
			const original = acceptedText(id);
			if (text === original) {
				drafts.delete(id);
				return;
			}
			const parsed = parseNumber(text);
			drafts.set(id, {
				text,
				error: parsed.ok ? preview(id, parsed.value) : parsed.message
			});
		},
		async commit(id) {
			const draft = drafts.get(id);
			if (draft === undefined) return { kind: 'accepted' };
			const parsed = parseNumber(draft.text);
			if (!parsed.ok) {
				drafts.set(id, { text: draft.text, error: parsed.message });
				return { kind: 'invalid', message: parsed.message };
			}
			const live = liveEntity();
			if (live === null) {
				const message = 'The entity no longer exists.';
				drafts.set(id, { text: draft.text, error: message });
				return { kind: 'refused', message };
			}
			const contactMinY = id === 'yaw' ? 0 : contactOf(live);
			if (contactMinY === null) {
				const message = 'The entity has no verified floor contact for this operation.';
				drafts.set(id, { text: draft.text, error: message });
				return { kind: 'refused', message };
			}
			const { kind, payload } = payloadFor(id, live, parsed.value, contactMinY);
			const outcome = await acceptFormCommand(
				services,
				services.stage.snapshot(),
				entityId,
				kind,
				payload
			);
			if (outcome.kind === 'refused') {
				drafts.set(id, { text: draft.text, error: outcome.message });
				return { kind: 'refused', message: outcome.message };
			}
			drafts.delete(id);
			return { kind: outcome.kind === 'no-op' ? 'no-op' : 'accepted' };
		},
		cancel(id) {
			const had = drafts.get(id);
			drafts.delete(id);
			return had !== undefined && had.text !== acceptedText(id);
		},
		blur(id) {
			drafts.delete(id);
		}
	};
}

function contactForObject(
	services: StageAdapterServices,
	entity: ReturnType<typeof stageScene>['entities'][number]
): number | null {
	return localContactMinY(
		entity,
		entity.kind === 'model'
			? sceneModelContactMinY(stageEnvelope(services.stage.snapshot()), entity)
			: null
	);
}

/**
 * Duplicate and Delete stay Card actions, not a second task or a bare overlay
 * id. Each command is the existing planner through the one F4 host, so the Card
 * and the context menu produce the same entry and the same refusal.
 */
export type SceneObjectCardCommandOutcome =
	| { readonly kind: 'accepted' | 'no-op' }
	| { readonly kind: 'refused'; readonly message: string };

export async function duplicateSceneObject(
	services: StageAdapterServices,
	snapshot: ReturnType<StageAdapterServices['stage']['snapshot']>,
	entityId: string
): Promise<SceneObjectCardCommandOutcome> {
	const entity = stageScene(snapshot).entities.find((entry) => entry.id === entityId);
	if (!isSceneObjectEntity(entity)) {
		return { kind: 'refused', message: `No object "${entityId}" exists in the accepted source.` };
	}
	const contactMinY = contactForObject(services, entity);
	if (contactMinY === null) {
		return { kind: 'refused', message: 'The object has no verified contact to duplicate on the floor.' };
	}
	const allocatedId = `entity-${crypto.randomUUID()}`;
	const outcome = await acceptFormCommand(
		services,
		snapshot,
		entityId,
		'duplicate-one',
		{ entityId, contactMinY },
		allocatedId
	);
	if (outcome.kind === 'refused') return { kind: 'refused', message: outcome.message };
	if (outcome.kind === 'installed') {
		const reference = sceneEntityReference(
			allocatedId,
			services.stage.snapshot().domain.unitRevisions.scene
		);
		services.stage.setSelection({ ordered: [{ reference }], primary: reference });
	}
	return { kind: outcome.kind === 'no-op' ? 'no-op' : 'accepted' };
}

export async function deleteSceneObject(
	services: StageAdapterServices,
	snapshot: ReturnType<StageAdapterServices['stage']['snapshot']>,
	entityId: string
): Promise<SceneObjectCardCommandOutcome> {
	const entity = stageScene(snapshot).entities.find((entry) => entry.id === entityId);
	if (!isSceneObjectEntity(entity)) {
		return { kind: 'refused', message: `No object "${entityId}" exists in the accepted source.` };
	}
	const outcome = await acceptFormCommand(services, snapshot, entityId, 'delete-one', { entityId });
	if (outcome.kind === 'refused') return { kind: 'refused', message: outcome.message };
	return { kind: outcome.kind === 'no-op' ? 'no-op' : 'accepted' };
}

/** The accepted value of one object field, for a component's restore path. */
export function sceneObjectCardAcceptedText(
	services: StageAdapterServices,
	entityId: string,
	id: SceneObjectCardFieldId
): string {
	const entity = stageScene(services.stage.snapshot()).entities.find((entry) => entry.id === entityId);
	return isSceneObjectEntity(entity)
		? sceneObjectCardFields(entity).find((field) => field.id === id)?.text ?? ''
		: '';
}

/** Re-exported so a component and its tests name the same scale rule. */
export { sceneObjectScale };
