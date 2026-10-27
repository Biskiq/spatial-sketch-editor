/**
 * T2.P02.S02 — the definitions one import procedure captured.
 *
 * A creator model's next placement resolves its definition from the accepted
 * envelope's `model` resource. The **first** placement happens before that
 * resource exists, so the procedure's captured definition (with its metadata
 * identity) is remembered here for as long as the adapter lives. The intent
 * still carries `metadataContentId`, so a stale entry refuses rather than
 * placing a different object; the registry only makes the freshly captured
 * definition reachable at the moment it is used.
 *
 * After an install the Scene adapter rebinds on the new accepted source and
 * repopulates this registry from the envelope, so the accepted resource — not
 * procedure state — is the authority for every later placement.
 *
 * This is editor procedure state, never authored data: it holds no project
 * content and is cleared when the Scene adapter is disposed.
 */
import type { NormalizedPlacementDefinition } from '@portfolio/project-model/scene-planning';

import type { NativePlacementPrimitive } from '../../../scene/object-definition-policy';
import type { ArmedModelPlacement } from '../placement';

const provisional = new Map<string, NormalizedPlacementDefinition>();

export function rememberCreatorDefinition(definition: NormalizedPlacementDefinition): void {
	provisional.set(definition.definitionKey, definition);
}

export function creatorDefinitions(): readonly NormalizedPlacementDefinition[] {
	return [...provisional.values()];
}

export function creatorDefinition(definitionKey: string): NormalizedPlacementDefinition | null {
	return provisional.get(definitionKey) ?? null;
}

export function forgetCreatorDefinition(definitionKey: string): void {
	provisional.delete(definitionKey);
}

export function clearCreatorDefinitions(): void {
	provisional.clear();
}

/**
 * The model one Import approved and has not yet placed.
 *
 * The Import instrument is a procedure, not a placement tool: it cannot arm a
 * Scene session directly without owning one. It leaves the approved model here,
 * and every Place task for that project applies it to its session. The arm is
 * **not** consumed by opening Place: approval precedes the resource install, so
 * a creator may approve, draw the missing floor, and then place. It is cleared
 * by the placement's own commit, by a failed task open, or by replacing the arm
 * with a newer approval.
 *
 * The project id is part of the value: a Stage that switches projects must never
 * resume another project's approved model.
 */
type PendingArmedModel = { readonly projectId: string; readonly model: ArmedModelPlacement };

let pendingArmedModel: PendingArmedModel | null = null;

export function rememberArmedModel(projectId: string, model: ArmedModelPlacement): void {
	pendingArmedModel = { projectId, model };
}

/** The arm that belongs to this project, without consuming it. */
export function peekArmedModel(projectId: string): ArmedModelPlacement | null {
	return pendingArmedModel?.projectId === projectId ? pendingArmedModel.model : null;
}

/**
 * The armed model's definition, as an admitted definition for this project.
 *
 * The approval's definition is remembered while the procedure is mounted, but a
 * rebind clears the provisional registry. The arm outlives that rebind — the
 * creator may draw the missing floor before placing — so it is also a source of
 * the one definition its placement intent names.
 */
export function armedModelDefinition(projectId: string): NormalizedPlacementDefinition | null {
	return pendingArmedModel?.projectId === projectId ? pendingArmedModel.model.definition : null;
}

/** Placement committed, or the procedure refused: this project has no arm. */
export function clearArmedModel(projectId: string): void {
	if (pendingArmedModel?.projectId === projectId) pendingArmedModel = null;
}

/**
 * An explicit native primitive replaces the project's approved model.
 *
 * The session clears its own arm when the primitive changes, but the project arm
 * outlives the session so a creator can draw a missing floor between approval and
 * placement. Choosing a primitive must consume that arm too; otherwise reopening
 * Place re-applies a model the creator already replaced.
 */
export function choosePrimitive(
	projectId: string,
	session: { setPlacePrimitive(primitive: NativePlacementPrimitive): void },
	primitive: NativePlacementPrimitive
): void {
	clearArmedModel(projectId);
	session.setPlacePrimitive(primitive);
}
