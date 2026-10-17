/**
 * T2.P01.S02 — the Scene record-scope guard and the one candidate finalizer.
 *
 * The landed current-source adapter already refuses a Scene change that touches
 * Layout, project identity, the Camera-bearing `navigationNodes`/`connections`,
 * `materials` or `textures`. It does **not** know *which* entities or clusters a
 * Scene operation addresses, so a defective planner could rename an untargeted
 * entity and be admitted. This guard is T2's record-level complement:
 *
 * - the entity id sequence is exactly "before, minus removals, plus captured
 *   creations" — no reordering, no renaming, no uncaptured id;
 * - an operation may only change the fields it owns on its targeted entity
 *   (move owns `position`, yaw owns `rotation`, …) — everything else compares
 *   exactly;
 * - a created entity is new, appended and unclustered;
 * - cluster membership may only lose removed ids, and only a cluster that falls
 *   below the codec's two-member minimum may disappear. No cluster is created.
 *
 * Every T2 planner returns through `finalizeSceneCandidate`, so the guard runs
 * once, before F.4 admission, on the same candidate the adapter will validate.
 * It is deliberately a **refusal**, not a repair: a planner that overreaches is
 * a defect to report, never a document to normalize.
 *
 * The guard is only as complete as its adoption, and F.4's planner contract has
 * no hook that could require it: `createScenePlanners` is the sole registered
 * producer (all seven operations funnel through `finalizeSceneCandidate`), and
 * the raw `plan*` exports are test seams. A future planner built outside that
 * registry must call this finalizer itself — the mutation-control acceptance
 * test exists because such a candidate would otherwise be admitted.
 */
import { validateSceneDocument } from '../scene-codec';
import type { ShapeIssue } from '../strict-shape';
import type { SceneDocument } from '../scene';

/**
 * The records one operation may touch. `changedEntityFields` is the field-level
 * grant for a targeted existing entity; a changed entity's every other field is
 * compared exactly.
 */
export type SceneRecordScope = {
	readonly operationKind: string;
	/** Existing entities this operation may replace in place (same id, same position). */
	readonly changedEntityIds: readonly string[];
	/** Fields the operation owns on each changed entity. */
	readonly changedEntityFields: readonly string[];
	/** Entities this operation may append; each must be new and unclustered. */
	readonly createdEntityIds: readonly string[];
	/** Entities this operation may remove. */
	readonly removedEntityIds: readonly string[];
	/**
	 * Whether cluster membership may be cleaned up for removed entities. A
	 * cluster left with fewer than the codec's two members is dropped; keeping it
	 * or dropping a still-valid one is a violation.
	 */
	readonly allowClusterCleanup: boolean;
};

export type SceneCandidateFinalization =
	| { readonly kind: 'ready'; readonly scene: SceneDocument }
	| {
			readonly kind: 'rejected';
			readonly code: 'record-scope-violation' | 'invalid-value';
			readonly message: string;
			readonly diagnostics: readonly ShapeIssue[];
	  };

/**
 * Validate one candidate Scene against its operation's record scope and the
 * current Scene format. Returns the structural candidate unchanged: the one
 * writer (F.4 admission) canonicalizes, and this function must not rebuild
 * carried-over Camera fields.
 */
export function finalizeSceneCandidate(input: {
	readonly before: SceneDocument;
	readonly after: SceneDocument;
	readonly scope: SceneRecordScope;
}): SceneCandidateFinalization {
	const issues = checkSceneRecordScope(input.before, input.after, input.scope);
	if (issues.length > 0) {
		return {
			kind: 'rejected',
			code: 'record-scope-violation',
			message: `The ${input.scope.operationKind} candidate changes records outside its scope: ${issues[0]!.message}`,
			diagnostics: issues
		};
	}
	const validation = validateSceneDocument(input.after);
	if (!validation.success) {
		return {
			kind: 'rejected',
			code: 'invalid-value',
			message: `The ${input.scope.operationKind} candidate is not a valid Scene document.`,
			diagnostics: validation.issues.map((issue) => ({
				path: issue.path,
				code: issue.code,
				message: issue.message
			}))
		};
	}
	return { kind: 'ready', scene: input.after };
}

/** Every record-scope violation, in a stable report order. */
export function checkSceneRecordScope(
	before: SceneDocument,
	after: SceneDocument,
	scope: SceneRecordScope
): readonly ShapeIssue[] {
	const issues: ShapeIssue[] = [];
	const changed = new Set(scope.changedEntityIds);
	const created = new Set(scope.createdEntityIds);
	const removed = new Set(scope.removedEntityIds);

	// Every top-level field except the two record collections is carried state and
	// compares exactly. Deriving this from the documents (rather than a list of
	// known fields) means a future Scene field is protected the day it lands
	// instead of the day someone remembers to add it here.
	const carriedFields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
		(field) => field !== 'entities' && field !== 'clusters'
	);
	for (const field of carriedFields) {
		if (
			stableJson((before as Record<string, unknown>)[field]) !==
			stableJson((after as Record<string, unknown>)[field])
		) {
			issues.push({
				path: `$.scene.${field}`,
				code: 'record-scope-violation',
				message: `${field} is outside the ${scope.operationKind} operation's record scope`
			});
		}
	}

	const expectedIds = [
		...before.entities.filter((entity) => !removed.has(entity.id)).map((entity) => entity.id),
		...scope.createdEntityIds
	];
	const actualIds = after.entities.map((entity) => entity.id);
	if (stableJson(expectedIds) !== stableJson(actualIds)) {
		issues.push({
			path: '$.scene.entities',
			code: 'record-scope-violation',
			message: `The entity sequence must be the accepted entities minus removals plus captured creations (expected ${JSON.stringify(expectedIds)}, received ${JSON.stringify(actualIds)})`
		});
	}

	const beforeById = new Map(before.entities.map((entity) => [entity.id, entity]));
	for (const entity of after.entities) {
		const previous = beforeById.get(entity.id);
		if (created.has(entity.id)) {
			if (previous !== undefined) {
				issues.push({
					path: `$.scene.entities.${entity.id}`,
					code: 'record-scope-violation',
					message: `Captured entity id "${entity.id}" already exists in the accepted source`
				});
			}
			continue;
		}
		if (previous === undefined) {
			issues.push({
				path: `$.scene.entities.${entity.id}`,
				code: 'record-scope-violation',
				message: `Entity "${entity.id}" is new but was not captured as a created record`
			});
			continue;
		}
		if (removed.has(entity.id)) {
			issues.push({
				path: `$.scene.entities.${entity.id}`,
				code: 'record-scope-violation',
				message: `Entity "${entity.id}" is marked removed but is still present`
			});
			continue;
		}
		if (!changed.has(entity.id)) {
			if (stableJson(previous) !== stableJson(entity)) {
				issues.push({
					path: `$.scene.entities.${entity.id}`,
					code: 'record-scope-violation',
					message: `Entity "${entity.id}" is untargeted by this ${scope.operationKind} operation but was modified`
				});
			}
			continue;
		}
		const beforeOutsideFields = omitFields(previous, scope.changedEntityFields);
		const afterOutsideFields = omitFields(entity, scope.changedEntityFields);
		if (stableJson(beforeOutsideFields) !== stableJson(afterOutsideFields)) {
			issues.push({
				path: `$.scene.entities.${entity.id}`,
				code: 'record-scope-violation',
				message: `Entity "${entity.id}" changed fields this ${scope.operationKind} operation does not own (allowed: ${scope.changedEntityFields.join(', ') || 'none'})`
			});
		}
	}
	for (const id of removed) {
		if (after.entities.some((entity) => entity.id === id)) continue;
		if (!beforeById.has(id)) {
			issues.push({
				path: `$.scene.entities.${id}`,
				code: 'record-scope-violation',
				message: `Removed entity "${id}" was not part of the accepted source`
			});
		}
	}

	issues.push(...checkClusterScope(before, after, { created, removed, scope }));
	return issues;
}

function checkClusterScope(
	before: SceneDocument,
	after: SceneDocument,
	input: {
		readonly created: ReadonlySet<string>;
		readonly removed: ReadonlySet<string>;
		readonly scope: SceneRecordScope;
	}
): readonly ShapeIssue[] {
	const issues: ShapeIssue[] = [];
	const beforeClusters = new Map((before.clusters ?? []).map((cluster) => [cluster.id, cluster]));
	const afterClusters = new Map((after.clusters ?? []).map((cluster) => [cluster.id, cluster]));

	// Cluster *order* is carried state too: a cleanup may drop a cluster, never
	// reorder the ones it keeps.
	const expectedClusterIds = (before.clusters ?? [])
		.filter((cluster) => {
			if (!input.scope.allowClusterCleanup) return true;
			return cluster.memberIds.filter((memberId) => !input.removed.has(memberId)).length >= 2;
		})
		.map((cluster) => cluster.id);
	if (stableJson(expectedClusterIds) !== stableJson((after.clusters ?? []).map((cluster) => cluster.id))) {
		issues.push({
			path: '$.scene.clusters',
			code: 'record-scope-violation',
			message: `Cluster order must be the accepted order minus any cluster the cleanup had to drop (expected ${JSON.stringify(expectedClusterIds)})`
		});
	}

	for (const cluster of after.clusters ?? []) {
		const previous = beforeClusters.get(cluster.id);
		if (previous === undefined) {
			issues.push({
				path: `$.scene.clusters.${cluster.id}`,
				code: 'record-scope-violation',
				message: `Cluster "${cluster.id}" is new; a Scene operation may not create grouping`
			});
			continue;
		}
		// Derived like the top-level fields: a cluster field added to the format is
		// compared the day it lands, not the day someone extends this list.
		const clusterFields = [...new Set([...Object.keys(previous), ...Object.keys(cluster)])].filter(
			(field) => field !== 'id' && field !== 'memberIds'
		);
		for (const field of clusterFields) {
			if (
				stableJson((previous as Record<string, unknown>)[field]) !==
				stableJson((cluster as Record<string, unknown>)[field])
			) {
				issues.push({
					path: `$.scene.clusters.${cluster.id}.${field}`,
					code: 'record-scope-violation',
					message: `Cluster "${cluster.id}" ${field} is outside the ${input.scope.operationKind} operation's scope`
				});
			}
		}
		const expectedMembers = input.scope.allowClusterCleanup
			? previous.memberIds.filter((memberId) => !input.removed.has(memberId))
			: previous.memberIds;
		if (stableJson(expectedMembers) !== stableJson(cluster.memberIds)) {
			issues.push({
				path: `$.scene.clusters.${cluster.id}.memberIds`,
				code: 'record-scope-violation',
				message: `Cluster "${cluster.id}" membership may only lose the operation's removed entities`
			});
		}
		if (cluster.memberIds.length < 2) {
			issues.push({
				path: `$.scene.clusters.${cluster.id}.memberIds`,
				code: 'record-scope-violation',
				message: `Cluster "${cluster.id}" is below the Scene format's two-member minimum and must be removed, not kept`
			});
		}
		for (const createdId of input.created) {
			if (cluster.memberIds.includes(createdId)) {
				issues.push({
					path: `$.scene.clusters.${cluster.id}.memberIds`,
					code: 'record-scope-violation',
					message: `Created entity "${createdId}" cannot join cluster "${cluster.id}" in the same operation`
				});
			}
		}
	}

	for (const cluster of beforeClusters.values()) {
		if (afterClusters.has(cluster.id)) continue;
		const remaining = cluster.memberIds.filter((memberId) => !input.removed.has(memberId));
		if (!input.scope.allowClusterCleanup || remaining.length >= 2) {
			issues.push({
				path: `$.scene.clusters.${cluster.id}`,
				code: 'record-scope-violation',
				message: `Cluster "${cluster.id}" cannot be dropped by the ${input.scope.operationKind} operation`
			});
		}
	}
	return issues;
}

function omitFields(entity: object, fields: readonly string[]): Record<string, unknown> {
	const copy = { ...(entity as Record<string, unknown>) };
	for (const field of fields) delete copy[field];
	return copy;
}

/**
 * Value equality for Scene data, independent of key order. The guard and the
 * no-op check share it so "unchanged" means the same thing in both places.
 */
export function sameSceneValues(left: unknown, right: unknown): boolean {
	return stableJson(left) === stableJson(right);
}

/** Key-order-independent comparison: the guard compares values, never insertion order. */
function stableJson(value: unknown): string {
	return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortValue);
	if (value === null || typeof value !== 'object') return value;
	const sorted: Record<string, unknown> = {};
	for (const key of Object.keys(value as Record<string, unknown>).sort()) {
		sorted[key] = sortValue((value as Record<string, unknown>)[key]);
	}
	return sorted;
}
