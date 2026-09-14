/**
 * `hierarchy-search.ts` — P23.6e slice 2 (plan §Search results projection).
 *
 * Global, bounded retrieval over the canonical documents. It replaces
 * rendered-string pruning (`filterUnifiedProjectTreeModel`, kept only for the
 * quarantined legacy tree) with the settled shape:
 *
 * ```text
 * direct match (name / authored label / display reference / raw canonical id)
 * → directly related entities (explicit refs only, one hop, never expanded)
 * → dependents nested only (hosted Openings + `Ends` beneath a Wall row)
 * → topology summarized (a Room's `Boundary Junctions (n)` count row)
 * → STOP
 * ```
 *
 * Bounded means: a related Wall never opens its other Rooms as new results, a
 * related Room never expands into its other Walls, and a Junction is never
 * expanded into its neighbours' neighbours. Every displayed relationship has a
 * reverse lookup in `HierarchySourceIndex`, so each edge is retrievable from
 * both ends.
 *
 * Search is a projection over the current documents — it is **not** a page, does
 * not push Navigator history, and does not cache: it rebuilds from the source
 * index on every query/document change. Selecting a row still goes through the
 * existing canonical selection writers; this module never selects.
 */

import { formatPlacementLabel } from '../editor-outliner';
import {
	boundaryJunctionIds,
	canonicalHierarchyHome,
	collectHierarchyRepresentations,
	hierarchyClusterRow,
	hierarchyEndsRow,
	hierarchyJunctionRow,
	hierarchyObjectRow,
	hierarchyOpeningRow,
	hierarchyParticipationText,
	hierarchyRoomName,
	hierarchyRoomRow,
	hierarchySceneEntityRow,
	hierarchyWallRow,
	type HierarchyDestination,
	type HierarchyProjectedRow,
	type HierarchyRepresentation
} from './hierarchy-page-projection';
import {
	roomEntityKey,
	type HierarchySourceIndex
} from './hierarchy-source-index';

export type HierarchySearchCategory =
	| 'rooms'
	| 'walls'
	| 'openings'
	| 'junctions'
	| 'layoutObjects'
	| 'scene';

export type HierarchySearchGroupKind = 'direct' | 'related' | 'topology';

export type HierarchySearchGroup = {
	kind: HierarchySearchGroupKind;
	label: string;
	rows: HierarchyProjectedRow[];
};

export type HierarchySearchBlock = {
	category: HierarchySearchCategory;
	label: string;
	groups: HierarchySearchGroup[];
};

export type HierarchySearchProjection = {
	query: string;
	normalizedQuery: string;
	blocks: HierarchySearchBlock[];
	/** Keyed by `entity.id`; shared with the page projections' lookup helpers. */
	representations: Map<string, HierarchyRepresentation[]>;
	/** True when the query is empty or matches nothing. */
	empty: boolean;
};

export const HIERARCHY_SEARCH_BLOCK_LABELS: Readonly<Record<HierarchySearchCategory, string>> = {
	rooms: 'Rooms',
	walls: 'Walls',
	openings: 'Openings',
	junctions: 'Junctions',
	layoutObjects: 'Layout Objects',
	scene: 'Scene Content'
};

export const HIERARCHY_SEARCH_GROUP_LABELS: Readonly<Record<HierarchySearchGroupKind, string>> = {
	direct: 'Direct matches',
	related: 'Related',
	topology: 'Topology'
};

/** Case/whitespace-insensitive query normalization; the only match input. */
export function normalizeHierarchyQuery(query: string): string {
	return query.trim().toLowerCase();
}

/** Substring match over any candidate text (raw id, label, name, facet). */
export function hierarchySearchMatches(
	normalizedQuery: string,
	...texts: (string | undefined)[]
): boolean {
	if (!normalizedQuery) return false;
	return texts.some((text) => text !== undefined && text.toLowerCase().includes(normalizedQuery));
}

function pushUniqueRow(rows: HierarchyProjectedRow[], row: HierarchyProjectedRow | null): void {
	if (!row) return;
	if (rows.some((candidate) => candidate.rowKey === row.rowKey)) return;
	rows.push(row);
}

/** A Wall row as it appears in search: hosted Openings + `Ends` nested only. */
function searchWallRow(
	index: HierarchySourceIndex,
	wallId: string,
	options: {
		related: boolean;
		direction: 'forward' | 'reverse';
		excludeOpeningIds?: ReadonlySet<string>;
	}
): HierarchyProjectedRow | null {
	if (!index.wallById.has(wallId)) return null;
	const rowKey = `search:walls:wall:${wallId}`;
	const children: HierarchyProjectedRow[] = [];
	for (const openingId of index.openingsByWallId.get(wallId) ?? []) {
		// A direct Opening result owns its exact search occurrence. Do not repeat
		// it under the related host Wall, where the Wall block is ordered first
		// and would otherwise steal the primary representation/reveal target.
		if (options.excludeOpeningIds?.has(openingId)) continue;
		const opening = hierarchyOpeningRow(index, `${rowKey}:opening:${openingId}`, openingId);
		if (opening) children.push(opening);
	}
	const ends = hierarchyEndsRow(index, `${rowKey}:ends`, {
		wallId,
		direction: options.direction
	});
	if (ends) children.push(ends);
	const roomIds = index.roomIdsByWallId.get(wallId) ?? [];
	return hierarchyWallRow(index, rowKey, wallId, {
		// Participation text explains why a related Wall is present; a directly
		// matching Wall does not repeat it (its Rooms are their own results).
		secondary:
			options.related && roomIds.length > 0
				? hierarchyParticipationText('in', roomIds.map((id) => hierarchyRoomName(index, id)))
				: undefined,
		disclosureKey: children.length > 0 ? rowKey : undefined,
		defaultOpen: false,
		children
	});
}

function openingActions(
	index: HierarchySourceIndex,
	openingId: string
): { actionKey: string; label: string; destination: HierarchyDestination }[] | undefined {
	const opening = index.openingById.get(openingId);
	if (!opening) return undefined;
	// The canonical home already carries the exact page rowKey + host chain, so
	// search never invents a second reveal path into the Walls page.
	const home = canonicalHierarchyHome(index, opening.entity);
	if (!home) return undefined;
	return [
		{
			actionKey: `search:${openingId}:show-in-walls`,
			label: 'Show in Walls ›',
			destination: home
		}
	];
}

/**
 * Bounded relationship retrieval. Rebuilds from the index on every call, so a
 * rename, split, Opening rebase or Undo-shaped document replacement is visible
 * immediately and no stale hit can survive.
 */
export function buildHierarchySearchProjection(
	index: HierarchySourceIndex,
	query: string
): HierarchySearchProjection {
	const normalizedQuery = normalizeHierarchyQuery(query);
	const emptyProjection: HierarchySearchProjection = {
		query,
		normalizedQuery,
		blocks: [],
		representations: new Map(),
		empty: true
	};
	if (!normalizedQuery) return emptyProjection;

	const directRoomIds = index.orderedRooms
		.filter((room) =>
			hierarchySearchMatches(normalizedQuery, room.name, room.roomId, formatPlacementLabel(room.roomId))
		)
		.map((room) => room.roomId);
	const directWallIds = index.orderedWalls
		.filter((wall) =>
			hierarchySearchMatches(normalizedQuery, wall.wallId, formatPlacementLabel(wall.wallId), wall.role)
		)
		.map((wall) => wall.wallId);
	const directOpeningIds = index.orderedOpenings
		.filter((opening) =>
			hierarchySearchMatches(
				normalizedQuery,
				opening.openingId,
				formatPlacementLabel(opening.openingId),
				opening.openingKind
			)
		)
		.map((opening) => opening.openingId);
	const directJunctionIds = index.orderedJunctions
		.filter((junction) =>
			hierarchySearchMatches(
				normalizedQuery,
				junction.junctionId,
				formatPlacementLabel(junction.junctionId)
			)
		)
		.map((junction) => junction.junctionId);
	const directObjectIds = index.orderedLayoutObjects
		.filter((object) =>
			hierarchySearchMatches(
				normalizedQuery,
				object.objectId,
				formatPlacementLabel(object.objectId),
				object.objectKind
			)
		)
		.map((object) => object.objectId);
	const directClusterIds = index.orderedSceneClusters
		.filter((cluster) => hierarchySearchMatches(normalizedQuery, cluster.name, cluster.clusterId))
		.map((cluster) => cluster.clusterId);
	const directEntityIds = index.orderedSceneEntities
		.filter((entity) => hierarchySearchMatches(normalizedQuery, entity.name, entity.entityId))
		.map((entity) => entity.entityId);

	const directRooms = new Set(directRoomIds);
	const directWalls = new Set(directWallIds);
	const directOpenings = new Set(directOpeningIds);
	const directJunctions = new Set(directJunctionIds);
	const directObjects = new Set(directObjectIds);
	const directClusters = new Set(directClusterIds);
	const directEntities = new Set(directEntityIds);

	// ---- direct → related (one explicit hop, in authoritative order) ----
	const relatedWallIds = new Set<string>();
	const relatedRoomIds = new Set<string>();
	const relatedObjectIds = new Set<string>();
	const relatedClusterIds = new Set<string>();
	const relatedEntityIds = new Set<string>();
	/** Oriented boundary direction for a Wall reached from a Room boundary. */
	const wallDirectionFromRoom = new Map<string, 'forward' | 'reverse'>();

	for (const roomId of directRoomIds) {
		const room = index.roomById.get(roomId)!;
		for (const ref of room.boundary) {
			relatedWallIds.add(ref.wallId);
			if (!wallDirectionFromRoom.has(ref.wallId)) {
				wallDirectionFromRoom.set(ref.wallId, ref.direction);
			}
		}
		for (const objectId of index.assignedObjectIdsByRoomId.get(roomId) ?? []) {
			relatedObjectIds.add(objectId);
		}
	}
	for (const wallId of directWallIds) {
		for (const roomId of index.roomIdsByWallId.get(wallId) ?? []) relatedRoomIds.add(roomId);
	}
	for (const openingId of directOpeningIds) {
		const opening = index.openingById.get(openingId)!;
		relatedWallIds.add(opening.wallId);
	}
	for (const junctionId of directJunctionIds) {
		for (const wallId of index.incidentWallIdsByJunctionId.get(junctionId) ?? []) {
			relatedWallIds.add(wallId);
		}
		for (const roomId of index.boundaryRoomIdsByJunctionId.get(junctionId) ?? []) {
			relatedRoomIds.add(roomId);
		}
	}
	for (const objectId of directObjectIds) {
		const object = index.objectById.get(objectId)!;
		if (object.roomId !== null) relatedRoomIds.add(object.roomId);
	}
	for (const clusterId of directClusterIds) {
		for (const memberId of index.sceneClusterById.get(clusterId)!.memberIds) {
			relatedEntityIds.add(memberId);
		}
	}
	for (const entityId of directEntityIds) {
		const clusterId = index.clusterByMemberId.get(entityId);
		if (clusterId) relatedClusterIds.add(clusterId);
	}

	// Direct results are never repeated in a related group.
	for (const wallId of directWallIds) relatedWallIds.delete(wallId);
	for (const roomId of directRoomIds) relatedRoomIds.delete(roomId);
	for (const objectId of directObjectIds) relatedObjectIds.delete(objectId);
	for (const clusterId of directClusterIds) relatedClusterIds.delete(clusterId);
	for (const entityId of directEntityIds) relatedEntityIds.delete(entityId);

	const blocks: HierarchySearchBlock[] = [];

	// ---- Rooms ----
	{
		const directRows: HierarchyProjectedRow[] = [];
		for (const roomId of directRoomIds) {
			pushUniqueRow(
				directRows,
				hierarchyRoomRow(index, `search:rooms:room:${roomId}`, roomId, {
					actions: [
						{
							actionKey: `search:rooms:${roomId}:open`,
							label: 'Open ›',
							destination: { page: { kind: 'room', roomId }, reveal: null }
						}
					]
				})
			);
		}
		const relatedRows: HierarchyProjectedRow[] = [];
		for (const room of index.orderedRooms) {
			if (!relatedRoomIds.has(room.roomId)) continue;
			pushUniqueRow(
				relatedRows,
				hierarchyRoomRow(index, `search:rooms:room:${room.roomId}`, room.roomId)
			);
		}
		// Topology summarized: a Room's boundary Junctions are a count row, not
		// a Junction inventory expansion.
		const topologyRows: HierarchyProjectedRow[] = [];
		for (const roomId of directRoomIds) {
			const room = index.roomById.get(roomId)!;
			const junctionIds = boundaryJunctionIds(index, room.boundary);
			topologyRows.push({
				rowKey: `search:rooms:room:${roomId}:topology`,
				kind: 'relation',
				label: `Boundary Junctions (${junctionIds.length})`,
				actions: [
					{
						actionKey: `search:rooms:${roomId}:topology-show`,
						label: 'Show ›',
						destination: {
							page: { kind: 'room', roomId },
							reveal: {
								entity: roomEntityKey(roomId),
								rowKey: `room:${roomId}:section:junctions`,
								ancestorDisclosureKeys: []
							}
						}
					}
				]
			});
		}
		const groups = searchGroups(directRows, relatedRows, topologyRows);
		if (groups.length > 0) {
			blocks.push({ category: 'rooms', label: HIERARCHY_SEARCH_BLOCK_LABELS.rooms, groups });
		}
	}

	// ---- Walls ----
	{
		const directRows: HierarchyProjectedRow[] = [];
		for (const wall of index.orderedWalls) {
			if (!directWalls.has(wall.wallId)) continue;
			pushUniqueRow(
				directRows,
				searchWallRow(index, wall.wallId, {
					related: false,
					direction: 'forward',
					excludeOpeningIds: directOpenings
				})
			);
		}
		const relatedRows: HierarchyProjectedRow[] = [];
		for (const wall of index.orderedWalls) {
			if (!relatedWallIds.has(wall.wallId)) continue;
			pushUniqueRow(
				relatedRows,
				searchWallRow(index, wall.wallId, {
					related: true,
					direction: wallDirectionFromRoom.get(wall.wallId) ?? 'forward',
					excludeOpeningIds: directOpenings
				})
			);
		}
		const groups = searchGroups(directRows, relatedRows, []);
		if (groups.length > 0) {
			blocks.push({ category: 'walls', label: HIERARCHY_SEARCH_BLOCK_LABELS.walls, groups });
		}
	}

	// ---- Openings ----
	{
		const directRows: HierarchyProjectedRow[] = [];
		for (const opening of index.orderedOpenings) {
			if (!directOpenings.has(opening.openingId)) continue;
			const host = index.wallById.get(opening.wallId);
			pushUniqueRow(
				directRows,
				hierarchyOpeningRow(index, `search:openings:opening:${opening.openingId}`, opening.openingId, {
					secondary: `on ${formatPlacementLabel(host?.wallId ?? opening.wallId)}`,
					actions: openingActions(index, opening.openingId)
				})
			);
		}
		const groups = searchGroups(directRows, [], []);
		if (groups.length > 0) {
			blocks.push({ category: 'openings', label: HIERARCHY_SEARCH_BLOCK_LABELS.openings, groups });
		}
	}

	// ---- Junctions ----
	{
		const directRows: HierarchyProjectedRow[] = [];
		for (const junction of index.orderedJunctions) {
			if (!directJunctions.has(junction.junctionId)) continue;
			pushUniqueRow(
				directRows,
				hierarchyJunctionRow(
					index,
					`search:junctions:junction:${junction.junctionId}`,
					junction.junctionId
				)
			);
		}
		const groups = searchGroups(directRows, [], []);
		if (groups.length > 0) {
			blocks.push({ category: 'junctions', label: HIERARCHY_SEARCH_BLOCK_LABELS.junctions, groups });
		}
	}

	// ---- Layout Objects ----
	{
		const directRows: HierarchyProjectedRow[] = [];
		const relatedRows: HierarchyProjectedRow[] = [];
		for (const object of index.orderedLayoutObjects) {
			const row = hierarchyObjectRow(
				index,
				`search:layoutObjects:object:${object.objectId}`,
				object.objectId,
				{ assignmentText: true }
			);
			if (!row) continue;
			if (directObjects.has(object.objectId)) pushUniqueRow(directRows, row);
			else if (relatedObjectIds.has(object.objectId)) pushUniqueRow(relatedRows, row);
		}
		const groups = searchGroups(directRows, relatedRows, []);
		if (groups.length > 0) {
			blocks.push({
				category: 'layoutObjects',
				label: HIERARCHY_SEARCH_BLOCK_LABELS.layoutObjects,
				groups
			});
		}
	}

	// ---- Scene Content ----
	{
		const clusterRow = (clusterId: string): HierarchyProjectedRow | null => {
			if (!index.sceneClusterById.has(clusterId)) return null;
			const rowKey = `search:scene:cluster:${clusterId}`;
			// Search relations stay flat. The page projection owns nested Scene
			// clusters; putting members here would expose siblings through a
			// second hop from a member query.
			return hierarchyClusterRow(index, rowKey, clusterId);
		};

		const directRows: HierarchyProjectedRow[] = [];
		for (const cluster of index.orderedSceneClusters) {
			if (!directClusters.has(cluster.clusterId)) continue;
			pushUniqueRow(directRows, clusterRow(cluster.clusterId));
		}
		for (const entity of index.orderedSceneEntities) {
			if (!directEntities.has(entity.entityId)) continue;
			pushUniqueRow(
				directRows,
				hierarchySceneEntityRow(index, `search:scene:entity:${entity.entityId}`, entity.entityId)
			);
		}
		const relatedRows: HierarchyProjectedRow[] = [];
		for (const cluster of index.orderedSceneClusters) {
			if (!relatedClusterIds.has(cluster.clusterId)) continue;
			pushUniqueRow(relatedRows, clusterRow(cluster.clusterId));
		}
		for (const entity of index.orderedSceneEntities) {
			if (!relatedEntityIds.has(entity.entityId)) continue;
			pushUniqueRow(
				relatedRows,
				hierarchySceneEntityRow(index, `search:scene:entity:${entity.entityId}`, entity.entityId)
			);
		}
		const groups = searchGroups(directRows, relatedRows, []);
		if (groups.length > 0) {
			blocks.push({ category: 'scene', label: HIERARCHY_SEARCH_BLOCK_LABELS.scene, groups });
		}
	}

	const allRows = blocks.flatMap((block) => block.groups.flatMap((group) => group.rows));
	return {
		query,
		normalizedQuery,
		blocks,
		representations: collectHierarchyRepresentations(allRows),
		empty: blocks.length === 0
	};
}

function searchGroups(
	directRows: HierarchyProjectedRow[],
	relatedRows: HierarchyProjectedRow[],
	topologyRows: HierarchyProjectedRow[]
): HierarchySearchGroup[] {
	const groups: HierarchySearchGroup[] = [];
	if (directRows.length > 0) {
		groups.push({ kind: 'direct', label: HIERARCHY_SEARCH_GROUP_LABELS.direct, rows: directRows });
	}
	if (relatedRows.length > 0) {
		groups.push({ kind: 'related', label: HIERARCHY_SEARCH_GROUP_LABELS.related, rows: relatedRows });
	}
	if (topologyRows.length > 0) {
		groups.push({ kind: 'topology', label: HIERARCHY_SEARCH_GROUP_LABELS.topology, rows: topologyRows });
	}
	return groups;
}
