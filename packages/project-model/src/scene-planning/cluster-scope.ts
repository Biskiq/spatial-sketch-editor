/**
 * The exact `clusters` record grant (T2.G1a).
 *
 * A declaration names every cluster the operation creates, removes, renames or
 * prunes; an absent declaration keeps the pre-G1 whole-collection comparison.
 * Order is carried state, so the expected final order is the accepted order
 * minus declared removals plus declared creations.
 */
import type { CameraFreeSceneDocument as SceneDocument } from '../units/types';
import type { ShapeIssue } from '../strict-shape';
import { stableJson } from './value-equality';

/** One created cluster's exact, final membership. */
export type SceneCreatedCluster = {
	readonly id: string;
	readonly memberIds: readonly string[];
};

export type SceneClusterScope = {
	readonly created: readonly SceneCreatedCluster[];
	readonly removed: readonly string[];
	readonly renamed: readonly string[];
	readonly pruned: readonly string[];
};

export type ClusterScopeInput = {
	readonly createdEntities: ReadonlySet<string>;
	readonly removedEntities: ReadonlySet<string>;
	readonly scope: { readonly operationKind: string; readonly clusters?: SceneClusterScope };
};

export function checkClusterScope(
	before: SceneDocument,
	after: SceneDocument,
	input: ClusterScopeInput,
): readonly ShapeIssue[] {
	const issues: ShapeIssue[] = [];
	const declaration = input.scope.clusters;
	const beforeClusters = before.clusters ?? [];
	const afterClusters = after.clusters ?? [];
	const beforeById = new Map(beforeClusters.map((cluster) => [cluster.id, cluster]));
	const afterById = new Map(afterClusters.map((cluster) => [cluster.id, cluster]));
	// No declaration at all: the whole collection is carried state. This is the
	// pre-G1 rule, and it stays the rule for every operation that does not name a
	// cluster grant.
	if (declaration === undefined) {
		if (stableJson(beforeClusters) !== stableJson(afterClusters)) {
			issues.push({
				path: '$.scene.clusters',
				code: 'record-scope-violation',
				message: `Clusters are outside the ${input.scope.operationKind} operation's scope`,
			});
		}
		return issues;
	}
	const createdById = new Map(declaration.created.map((cluster) => [cluster.id, cluster]));
	const removed = new Set(declaration.removed);
	const renamed = new Set(declaration.renamed);
	const pruned = new Set(declaration.pruned);
	const declared = [...createdById.keys(), ...removed, ...renamed, ...pruned];
	if (new Set(declared).size !== declared.length) {
		issues.push({
			path: '$.scene.clusters',
			code: 'record-scope-violation',
			message: 'A cluster may be declared in one bucket only',
		});
	}

	const prunedMembers = (cluster: { readonly memberIds: readonly string[] }): string[] =>
		cluster.memberIds.filter((memberId) => !input.removedEntities.has(memberId));
	const prunedClusterSurvives = (cluster: { readonly memberIds: readonly string[] }): boolean =>
		prunedMembers(cluster).length >= 2;

	// Order is carried state: the accepted order minus what the declaration
	// removes or prunes away, then the created clusters in declared order.
	const expectedClusterIds = [
		...beforeClusters
			.filter((cluster) => {
				if (removed.has(cluster.id)) return false;
				if (pruned.has(cluster.id)) return prunedClusterSurvives(cluster);
				return true;
			})
			.map((cluster) => cluster.id),
		...declaration.created.map((cluster) => cluster.id),
	];
	if (stableJson(expectedClusterIds) !== stableJson(afterClusters.map((cluster) => cluster.id))) {
		issues.push({
			path: '$.scene.clusters',
			code: 'record-scope-violation',
			message: `Cluster order must be the accepted order minus declared removals plus declared creations (expected ${JSON.stringify(expectedClusterIds)})`,
		});
	}

	for (const cluster of afterClusters) {
		const previous = beforeById.get(cluster.id);
		const creation = createdById.get(cluster.id);
		if (creation !== undefined) {
			if (previous !== undefined) {
				issues.push({
					path: `$.scene.clusters.${cluster.id}`,
					code: 'record-scope-violation',
					message: `Created cluster "${cluster.id}" already exists in the accepted source`,
				});
			}
			if (stableJson(creation.memberIds) !== stableJson(cluster.memberIds)) {
				issues.push({
					path: `$.scene.clusters.${cluster.id}.memberIds`,
					code: 'record-scope-violation',
					message: `Created cluster "${cluster.id}" membership must exactly equal its declaration`,
				});
			}
			for (const memberId of cluster.memberIds) {
				if (!after.entities.some((entity) => entity.id === memberId)) {
					issues.push({
						path: `$.scene.clusters.${cluster.id}.memberIds`,
						code: 'record-scope-violation',
						message: `Created cluster "${cluster.id}" names unknown entity "${memberId}"`,
					});
				}
			}
			continue;
		}
		if (previous === undefined) {
			issues.push({
				path: `$.scene.clusters.${cluster.id}`,
				code: 'record-scope-violation',
				message: `Cluster "${cluster.id}" is new but was not declared as created`,
			});
			continue;
		}
		if (removed.has(cluster.id)) {
			issues.push({
				path: `$.scene.clusters.${cluster.id}`,
				code: 'record-scope-violation',
				message: `Cluster "${cluster.id}" is declared removed but is still present`,
			});
			continue;
		}
		const isRenamed = renamed.has(cluster.id);
		const isPruned = pruned.has(cluster.id);
		const expectedMembers = isPruned ? prunedMembers(previous) : previous.memberIds;
		if (stableJson(expectedMembers) !== stableJson(cluster.memberIds)) {
			issues.push({
				path: `$.scene.clusters.${cluster.id}.memberIds`,
				code: 'record-scope-violation',
				message: isPruned
					? `Pruned cluster "${cluster.id}" membership must be the accepted membership minus the removed entities`
					: `Cluster "${cluster.id}" membership is outside the ${input.scope.operationKind} operation's scope`,
			});
		}
		if (cluster.memberIds.length < 2) {
			issues.push({
				path: `$.scene.clusters.${cluster.id}.memberIds`,
				code: 'record-scope-violation',
				message: `Cluster "${cluster.id}" is below the Scene format's two-member minimum and must be removed, not kept`,
			});
		}
		// Derived like the top-level fields: a cluster field added to the format is
		// compared the day it lands, not the day someone extends this list. Only a
		// declared rename may change `name`; `id` and membership are handled above.
		const clusterFields = [...new Set([...Object.keys(previous), ...Object.keys(cluster)])].filter(
			(field) => field !== 'id' && field !== 'memberIds' && !(field === 'name' && isRenamed),
		);
		for (const field of clusterFields) {
			if (
				stableJson((previous as Record<string, unknown>)[field]) !==
				stableJson((cluster as Record<string, unknown>)[field])
			) {
				issues.push({
					path: `$.scene.clusters.${cluster.id}.${field}`,
					code: 'record-scope-violation',
					message: `Cluster "${cluster.id}" ${field} is outside the ${input.scope.operationKind} operation's scope`,
				});
			}
		}
		if (isPruned && !prunedClusterSurvives(previous)) {
			issues.push({
				path: `$.scene.clusters.${cluster.id}`,
				code: 'record-scope-violation',
				message: `Cluster "${cluster.id}" falls below two members after the removal and must be dropped`,
			});
		}
		for (const createdId of input.createdEntities) {
			if (cluster.memberIds.includes(createdId)) {
				issues.push({
					path: `$.scene.clusters.${cluster.id}.memberIds`,
					code: 'record-scope-violation',
					message: `Created entity "${createdId}" may join only a cluster created in the same operation`,
				});
			}
		}
	}

	for (const cluster of beforeClusters) {
		if (afterById.has(cluster.id)) continue;
		if (removed.has(cluster.id)) continue;
		if (pruned.has(cluster.id)) {
			if (prunedClusterSurvives(cluster)) {
				issues.push({
					path: `$.scene.clusters.${cluster.id}`,
					code: 'record-scope-violation',
					message: `Pruned cluster "${cluster.id}" still has at least two members and must remain`,
				});
			}
			continue;
		}
		issues.push({
			path: `$.scene.clusters.${cluster.id}`,
			code: 'record-scope-violation',
			message: `Cluster "${cluster.id}" cannot be dropped by the ${input.scope.operationKind} operation`,
		});
	}

	// Membership is one group maximum. The codec checks the final document too;
	// this reports the declaration that caused it against the operation kind.
	const membership = new Map<string, string>();
	for (const cluster of afterClusters) {
		for (const memberId of cluster.memberIds) {
			const previous = membership.get(memberId);
			if (previous !== undefined) {
				issues.push({
					path: `$.scene.clusters.${cluster.id}.memberIds`,
					code: 'record-scope-violation',
					message: `Entity "${memberId}" belongs to both cluster "${previous}" and "${cluster.id}"`,
				});
			}
			membership.set(memberId, cluster.id);
		}
	}
	return issues;
}
