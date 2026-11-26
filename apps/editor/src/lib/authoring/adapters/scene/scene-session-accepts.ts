/**
 * The Scene session's accepted-install intents: place, creator-model place,
 * My Objects insertion, and the shared Resize/Duplicate/Delete acceptance.
 *
 * The session owns the gesture and the displayed candidate. These functions
 * only build the F4 intent from the session's accepted snapshot and report the
 * outcome; no provisional state is read or written here.
 */
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import {
	creatorModelResourcePayload,
	type SceneSupportChoice,
} from '@portfolio/project-model/scene-planning';
import {
	nativePlacementDefinition,
	type NativePlacementPrimitive,
} from '../../scene/object-definition-policy';
import type {
	ArmedFormCopy,
	ArmedModelPlacement,
	SceneEditingSnapshot,
	SceneSessionOutcome,
	SceneWritePort,
} from './placement';
import { FRAME, PROJECT_WORLD } from './scene-placement-support';

export type SceneAcceptContext = {
	readonly snapshot: SceneEditingSnapshot;
	readonly port: SceneWritePort;
	readonly mint: () => string;
	readonly placed: (entityId: string | null) => void;
	readonly notify: () => void;
};

/**
 * Accept one immediate command (duplicate/delete) without a preview or a lease.
 *
 * Duplicate reports the entity it created through the same completion listener
 * Place uses, so the adapter can select the copy exactly as it selects a placed
 * object. Delete reports nothing: the accepted correspondence retires the
 * subject, and the host's own requalification clears the selection.
 */
export async function acceptOne(
	ctx: SceneAcceptContext,
	intentToAccept: AuthoringIntent,
	createdEntityId: string | null,
): Promise<SceneSessionOutcome> {
	let outcome: Awaited<ReturnType<SceneWritePort['accept']>>;
	try {
		outcome = await ctx.port.accept(intentToAccept);
	} catch (error) {
		return {
			kind: 'failed',
			code: 'accept-failed',
			message: error instanceof Error ? error.message : 'The accepted install failed.',
		};
	}
	if (outcome.kind === 'refused') return outcome;
	if (createdEntityId !== null) {
		ctx.placed(createdEntityId);
		ctx.notify();
	}
	return { kind: 'committed' };
}

/** The one F4 placement intent, captured from an exact world X/Z and definition. */
export async function acceptPlacement(
	ctx: SceneAcceptContext,
	primitive: NativePlacementPrimitive,
	worldXZ: readonly [number, number],
	choice?: SceneSupportChoice,
): Promise<SceneSessionOutcome> {
	const definition = await nativePlacementDefinition(primitive).catch(() => null);
	if (definition === null) {
		return {
			kind: 'refused',
			code: 'missing-definition',
			message: 'That object definition is not admitted.',
		};
	}
	const allocatedId = `entity-${ctx.mint()}`;
	const intentToAccept: AuthoringIntent = {
		version: 1,
		kind: 'place-object',
		operationId: ctx.mint(),
		expectedRevision: {
			projectId: ctx.snapshot.projectId,
			revisionId: ctx.port.acceptedRevision().revisionId,
		},
		targets: [],
		payload: {
			definitionKey: definition.definitionKey,
			metadataContentId: definition.metadataContentId,
			worldXZ: [worldXZ[0], worldXZ[1]],
			yaw: 0,
			frame: FRAME,
			frameReference: PROJECT_WORLD,
			...(choice === undefined ? {} : { supportChoice: choice }),
		},
		capturedInputs: [],
		allocatedIds: [{ kind: 'scene-entity', id: allocatedId }],
	};
	let outcome: Awaited<ReturnType<SceneWritePort['accept']>>;
	try {
		outcome = await ctx.port.accept(intentToAccept);
	} catch (error) {
		return {
			kind: 'failed',
			code: 'accept-failed',
			message: error instanceof Error ? error.message : 'The accepted install failed.',
		};
	}
	if (outcome.kind === 'refused') return outcome;
	ctx.placed(allocatedId);
	return { kind: 'committed' };
}

/**
 * The one creator-model placement intent.
 *
 * The first placement carries the approved resource and its exact lock so the
 * entity, resource and pin install as one accepted result; a later placement
 * of an already-approved model omits the introduction and reuses the accepted
 * resource, adding only a distinct entity identity.
 */
export async function acceptModelPlacement(
	ctx: SceneAcceptContext,
	model: ArmedModelPlacement,
	worldXZ: readonly [number, number],
	choice?: SceneSupportChoice,
): Promise<SceneSessionOutcome> {
	const definition = model.definition;
	if (definition.creationDefaults.kind !== 'model') {
		return {
			kind: 'refused',
			code: 'missing-definition',
			message: 'That definition is not a creator model.',
		};
	}
	const allocatedId = `entity-${ctx.mint()}`;
	const intentToAccept: AuthoringIntent = {
		version: 1,
		kind: 'place-object',
		operationId: ctx.mint(),
		expectedRevision: {
			projectId: ctx.snapshot.projectId,
			revisionId: ctx.port.acceptedRevision().revisionId,
		},
		targets: [],
		payload: {
			definitionKey: definition.definitionKey,
			metadataContentId: definition.metadataContentId,
			worldXZ: [worldXZ[0], worldXZ[1]],
			yaw: 0,
			frame: FRAME,
			frameReference: PROJECT_WORLD,
			...(choice === undefined ? {} : { supportChoice: choice }),
			...(model.resource === null
				? {}
				: { modelResource: creatorModelResourcePayload(model.resource) }),
		},
		capturedInputs: [],
		allocatedIds: [{ kind: 'scene-entity', id: allocatedId }],
	};
	let outcome: Awaited<ReturnType<SceneWritePort['accept']>>;
	try {
		outcome = await ctx.port.accept(intentToAccept);
	} catch (error) {
		return {
			kind: 'failed',
			code: 'accept-failed',
			message: error instanceof Error ? error.message : 'The accepted install failed.',
		};
	}
	if (outcome.kind === 'refused') return outcome;
	ctx.placed(allocatedId);
	return { kind: 'committed' };
}

/**
 * The one My Objects insertion intent.
 *
 * The saved payload is written verbatim under a distinct allocated entity id,
 * so the copy carries no link to the source item or to another project: later
 * edits to either are independent by construction.
 */
export async function acceptFormCopyPlacement(
	ctx: SceneAcceptContext,
	copy: ArmedFormCopy,
	worldXZ: readonly [number, number],
	choice?: SceneSupportChoice,
): Promise<SceneSessionOutcome> {
	const allocatedId = copy.entityId ?? `entity-${ctx.mint()}`;
	const intentToAccept: AuthoringIntent = {
		version: 1,
		kind: 'place-form-copy',
		operationId: ctx.mint(),
		expectedRevision: {
			projectId: ctx.snapshot.projectId,
			revisionId: ctx.port.acceptedRevision().revisionId,
		},
		targets: [],
		payload: {
			item: copy.item,
			worldXZ: [worldXZ[0], worldXZ[1]],
			yaw: 0,
			contactMinY: copy.contactMinY,
			...(choice === undefined ? {} : { supportChoice: choice }),
		},
		capturedInputs: [],
		allocatedIds: [{ kind: 'scene-entity', id: allocatedId }],
	};
	let outcome: Awaited<ReturnType<SceneWritePort['accept']>>;
	try {
		outcome = await ctx.port.accept(intentToAccept);
	} catch (error) {
		return {
			kind: 'failed',
			code: 'accept-failed',
			message: error instanceof Error ? error.message : 'The accepted install failed.',
		};
	}
	if (outcome.kind === 'refused') return outcome;
	ctx.placed(allocatedId);
	return { kind: 'committed' };
}
