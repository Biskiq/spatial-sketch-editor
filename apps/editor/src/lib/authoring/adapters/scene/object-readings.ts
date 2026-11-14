/**
 * X7 — read-only facts about the selected Scene object.
 *
 * The selected entity, its verified contact, drawn or analytic bounds, the
 * admitted-model footprint proxy and the accepted payload the size planners read.
 * The object-mark session (press capture) and the contribution projections
 * (mark descriptors, ghosts) both ask these questions; neither may answer them
 * differently, so there is one reading and neither owns it. Nothing here holds
 * gesture state, and a model without a verified contact or admitted footprint
 * yields `null` rather than a guess (the missing-model fallback is "withhold").
 */

import type { SceneEntity } from '@portfolio/project-model';
import type { StageAdapterContext, StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope, stageScene } from '$lib/authoring/stage/stage-adapter-host';
import { getAssetById } from '$lib/content/assets';
import { catalogueModelContactMinY } from '$lib/authoring/scene/object-definition-policy';
import {
	type SceneObjectEditMarkId,
	boundsFootprint,
	isSceneObjectEntity,
	primitiveBounds,
	type SceneObjectBounds,
	type SceneObjectFootprint
} from './object-marks';
import { localContactMinY, sceneModelContactMinY, type SceneCandidate } from './placement';

/** The live accepted project identity (never the bind-time one). */
export function liveProjectId(services: StageAdapterServices): string {
	return services.stage.snapshot().acceptedRevision.projectId;
}

export function selectedObjectEntity(adapterContext: StageAdapterContext): SceneEntity | null {
	const primary = adapterContext.selectionState().primary;
	if (primary === null || primary.domain !== 'scene' || primary.subject.kind !== 'entity') {
		return null;
	}
	const entity = stageScene(adapterContext.snapshot).entities.find(
		(entry) => entry.id === primary.subject.id
	);
	return isSceneObjectEntity(entity) ? entity : null;
}

/** The entity's local contact, read from the live accepted snapshot. */
export function objectContact(services: StageAdapterServices, entity: SceneEntity): number | null {
	return localContactMinY(
		entity,
		entity.kind === 'model'
			? sceneModelContactMinY(stageEnvelope(services.stage.snapshot()), entity)
			: null
	);
}

/**
 * Drawn bounds when the pick source has them; an analytic primitive derives
 * the same box. A model without a mounted body has no honest extent here,
 * so the Scale point and Size ray are withheld rather than guessed.
 */
export function objectBounds(
	adapterContext: StageAdapterContext,
	entity: SceneEntity
): SceneObjectBounds | null {
	const rendered = adapterContext.sceneBounds(entity.id);
	if (rendered !== null) return rendered;
	return entity.kind === 'primitive' ? primitiveBounds(entity) : null;
}

export function objectFootprint(
	services: StageAdapterServices,
	entity: SceneEntity,
	bounds: SceneObjectBounds | null
): SceneObjectFootprint | null {
	if (bounds !== null) return boundsFootprint(bounds);
	if (entity.kind !== 'model') return null;
	return admittedModelFootprint(services.stage.snapshot(), entity.assetId);
}

/** A model proxy comes only from its captured creator metadata or verified catalogue record. */
export function admittedModelFootprint(
	snapshot: StageAdapterContext['snapshot'],
	assetId: string
): SceneObjectFootprint | null {
	for (const resource of stageEnvelope(snapshot).units.resources.data.resources) {
		if (resource.kind === 'model' && resource.id === assetId && resource.model !== undefined) {
			return {
				width: resource.model.placement.footprint.width,
				depth: resource.model.placement.footprint.depth
			};
		}
	}
	const asset = getAssetById(assetId);
	if (catalogueModelContactMinY(assetId) !== null && asset?.footprint !== undefined) {
		return { width: asset.footprint.width, depth: asset.footprint.depth };
	}
	return null;
}

/** The accepted Scene payload the size planner reads, never the runtime projection. */
export function sizePlannerContext(adapterContext: StageAdapterContext) {
	const snapshot = adapterContext.snapshot;
	const envelope = stageEnvelope(snapshot);
	return {
		layout: envelope.units.layout.data,
		scene: envelope.units.scene.data,
		sourceContentId: snapshot.sourceContentId
	};
}

/** What the contribution projections and the presenter may read of the live mark gesture. */
export type ObjectMarkGestureReading = {
	readonly entityId: string;
	readonly markId: SceneObjectEditMarkId;
	readonly candidate: SceneCandidate | null;
	readonly refusal: string | null;
};

/** The refusal keyed to the subject it came from; a new subject replaces it. */
export type ObjectMarkRefusalReading = {
	readonly entityId: string;
	readonly markId: SceneObjectEditMarkId;
	readonly message: string;
};
