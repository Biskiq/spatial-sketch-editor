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
 * and the Scene adapter applies it to the session it opens for the placement
 * task — one owner per fact, and a canceled procedure leaves nothing armed.
 */
let pendingArmedModel: ArmedModelPlacement | null = null;

export function rememberArmedModel(model: ArmedModelPlacement): void {
	pendingArmedModel = model;
}

/** Take the pending model exactly once: the next placement consumes it. */
export function takeArmedModel(): ArmedModelPlacement | null {
	const model = pendingArmedModel;
	pendingArmedModel = null;
	return model;
}

export function clearArmedModel(): void {
	pendingArmedModel = null;
}
