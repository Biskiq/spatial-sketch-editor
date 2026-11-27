/**
 * Group-first selection targets.
 *
 * A Scene group owns its members' selection: a click, an Index row or a hover
 * resolves a member to the group, and a member is only addressed once the
 * creator has drilled into the group (or the member is already the single
 * selection). These are read-only questions over the accepted Scene document, so
 * the Stage, the Index and the marks all agree on one answer. Nothing here
 * writes, plans or holds a lifetime.
 */
import type {
	SceneDocument,
	SceneEntity,
	SceneObjectCluster,
} from '@portfolio/project-model/scene';

/** The accepted Scene fields group selection reads; the unit data satisfies it. */
export type SceneGroupScope = Pick<SceneDocument, 'entities' | 'clusters'>;
import { compareReferences, type SemanticReference } from '@portfolio/project-model/references';

/** A Scene subject at the identity a tap addresses: an entity or one group. */
export type SceneSelectionTarget =
	| { readonly kind: 'entity'; readonly id: string }
	| { readonly kind: 'cluster'; readonly id: string };

/** The canonical reference for one group at one accepted Scene revision. */
export function sceneClusterReference(
	clusterId: string,
	contentRevision: string,
): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: { kind: 'exact', contentRevision },
		subject: { kind: 'cluster', id: clusterId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null,
	};
}

/** The canonical reference for one entity at one accepted Scene revision. */
export function sceneEntityTargetReference(
	entityId: string,
	contentRevision: string,
): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: { kind: 'exact', contentRevision },
		subject: { kind: 'entity', id: entityId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null,
	};
}

export function sceneClusterById(
	scene: SceneGroupScope,
	clusterId: string,
): SceneObjectCluster | null {
	return (scene.clusters ?? []).find((cluster) => cluster.id === clusterId) ?? null;
}

/** The flat group that owns an entity, or `null` when it is ungrouped. */
export function sceneClusterOf(
	scene: SceneGroupScope,
	entityId: string,
): SceneObjectCluster | null {
	return (scene.clusters ?? []).find((cluster) => cluster.memberIds.includes(entityId)) ?? null;
}

export function sceneClusterMemberIds(
	scene: SceneGroupScope,
	clusterId: string,
): readonly string[] {
	return sceneClusterById(scene, clusterId)?.memberIds ?? [];
}

/** The group's members that still exist, in the group's own order. */
export function sceneClusterMembers(
	scene: SceneGroupScope,
	clusterId: string,
): readonly SceneEntity[] {
	const ids = new Set(sceneClusterMemberIds(scene, clusterId));
	return scene.entities.filter((entity) => ids.has(entity.id));
}

/**
 * Whether a reference addresses the group or one of its members.
 *
 * A retired member is still named by the group's own id list only while the
 * group exists; the reference comparison is identity, never proximity.
 */
export function sceneReferenceInCluster(
	cluster: SceneObjectCluster,
	reference: SemanticReference,
): boolean {
	if (reference.domain !== 'scene') return false;
	if (reference.subject.kind === 'cluster') return reference.subject.id === cluster.id;
	if (reference.subject.kind !== 'entity') return false;
	return cluster.memberIds.includes(reference.subject.id);
}

/** The identity a top-level (non-drilled) selection stores for one entity. */
export function sceneTopLevelTarget(
	scene: SceneGroupScope,
	entityId: string,
): SceneSelectionTarget {
	const cluster = sceneClusterOf(scene, entityId);
	return cluster === null ? { kind: 'entity', id: entityId } : { kind: 'cluster', id: cluster.id };
}

/** A hit's entity reference normalized to the group that owns it, when any. */
export function topLevelSceneReference(
	scene: SceneGroupScope,
	reference: SemanticReference,
): SemanticReference {
	if (reference.domain !== 'scene' || reference.subject.kind !== 'entity') return reference;
	const target = sceneTopLevelTarget(scene, reference.subject.id);
	return target.kind === 'entity'
		? reference
		: sceneClusterReference(
				target.id,
				reference.revision.kind === 'exact' ? reference.revision.contentRevision : '',
			);
}

/**
 * The reference a Stage or Index hit selects.
 *
 * Group-first is the default. A treated member is an **addressed** member:
 *
 * - the single selection is its group (the creator drilled in), or
 * - the single selection is another member of the same group (a sibling tap),
 * - a set is being built (every member normalizes to its group, so a set is a
 *   set of top-level targets and never mixes a group with its own member).
 */
export function sceneSelectionTargetForHit(input: {
	readonly scene: SceneGroupScope;
	/** The entity the hit names, already resolved by the domain pick. */
	readonly entityId: string;
	readonly contentRevision: string;
	readonly selected: readonly SemanticReference[];
	/** A set is being built: always the top-level target. */
	readonly additive: boolean;
}): SemanticReference {
	const entityReference = sceneEntityTargetReference(input.entityId, input.contentRevision);
	const cluster = sceneClusterOf(input.scene, input.entityId);
	if (cluster === null) return entityReference;
	if (input.additive) return sceneClusterReference(cluster.id, input.contentRevision);
	if (input.selected.length !== 1) return sceneClusterReference(cluster.id, input.contentRevision);
	const only = input.selected[0]!;
	const addressesGroup = sceneReferenceInCluster(cluster, only);
	return addressesGroup
		? entityReference
		: sceneClusterReference(cluster.id, input.contentRevision);
}

/** Escape's member-to-group rung: the group a single selected member belongs to. */
export function sceneGroupOfSelection(
	scene: SceneGroupScope,
	selected: readonly SemanticReference[],
): SemanticReference | null {
	if (selected.length !== 1) return null;
	const only = selected[0]!;
	if (only.domain !== 'scene' || only.subject.kind !== 'entity') return null;
	const cluster = sceneClusterOf(scene, only.subject.id);
	if (cluster === null) return null;
	if (only.revision.kind !== 'exact') return null;
	return sceneClusterReference(cluster.id, only.revision.contentRevision);
}

/** A group selection's own reference, or `null` for any other selection. */
export function selectedSceneClusterId(selected: readonly SemanticReference[]): string | null {
	if (selected.length !== 1) return null;
	const only = selected[0]!;
	return only.domain === 'scene' && only.subject.kind === 'cluster' ? only.subject.id : null;
}

/** Whether every entry is a Scene entity with no group (the one Group with… case). */
export function ungroupedSceneEntityIds(
	scene: SceneGroupScope,
	selected: readonly SemanticReference[],
): readonly string[] {
	const ids: string[] = [];
	for (const reference of selected) {
		if (reference.domain !== 'scene' || reference.subject.kind !== 'entity') return [];
		if (sceneClusterOf(scene, reference.subject.id) !== null) return [];
		ids.push(reference.subject.id);
	}
	return ids;
}

/** Whether a reference is one of the selection's entries (identity, not proximity). */
export function selectionIncludes(
	selected: readonly SemanticReference[],
	reference: SemanticReference,
): boolean {
	return selected.some((entry) => referencesEqual(entry, reference));
}

/** Identity comparison across accepted revisions, without reaching into the Stage. */
function referencesEqual(a: SemanticReference, b: SemanticReference): boolean {
	return compareReferences(a, b) === 0;
}
