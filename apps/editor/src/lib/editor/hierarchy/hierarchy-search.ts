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

	hierarchyJunctionRow,
	hierarchyObjectRow,
	hierarchyOpeningRow,
	hierarchyParticipationText,
	hierarchyRoomName,
	hierarchyRoomRow,
	hierarchySceneEntityRow,
	hierarchyWallIdentityLabel,
	hierarchyWallRow,
	type HierarchyDestination,
	type HierarchyMatchField,
	type HierarchyProjectedRow,
	type HierarchyRepresentation,
	type HierarchyRowMatch
} from './hierarchy-page-projection';
import {
	roomEntityKey,
	type HierarchyEntityKey,
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

/**
 * P23.12 — why a direct result is present.
 *
 * The index now retrieves authored names and compact references alongside raw
 * canonical IDs, so a hit can look arbitrary: typing `w1` surfaces a row
 * labelled `North Gallery Wall`. Rows therefore carry the field they matched
 * and a short explanation the renderer shows. Priority mirrors the retrieval
 * order — authored name, reference, raw ID, role, then kind — so the strongest
 * identity claim is the one explained.
 */
export function explainHierarchySearchMatch(
	index: HierarchySourceIndex,
	entity: HierarchyEntityKey,
	normalizedQuery: string
): HierarchyRowMatch | null {
	if (!normalizedQuery) return null;
	const candidates: { field: HierarchyMatchField; value: string | null; term?: string }[] = [];
	switch (entity.kind) {
		case 'room': {
			const room = index.roomById.get(entity.roomId);
			if (!room) return null;
			candidates.push(
				{ field: 'name', value: room.name },
				{ field: 'reference', value: room.reference },
				{ field: 'id', value: room.roomId },
				{ field: 'kind', value: 'room' }
			);
			break;
		}
		case 'wall': {
			const wall = index.wallById.get(entity.wallId);
			if (!wall) return null;
			candidates.push(
				{ field: 'name', value: wall.name },
				{ field: 'reference', value: wall.reference },
				{ field: 'id', value: wall.wallId },
				{ field: 'role', value: wall.role },
				{ field: 'kind', value: 'wall' }
			);
			break;
		}
		case 'opening': {
			const opening = index.openingById.get(entity.openingId);
			if (!opening) return null;
			candidates.push(
				{ field: 'name', value: opening.name },
				{ field: 'reference', value: opening.reference },
				{ field: 'id', value: opening.openingId },
				{ field: 'kind', value: opening.openingKind }
			);
			break;
		}
		case 'junction': {
			const junction = index.junctionById.get(entity.junctionId);
			if (!junction) return null;
			candidates.push(
				{ field: 'reference', value: junction.reference },
				{ field: 'id', value: junction.junctionId },
				{ field: 'kind', value: 'junction' }
			);
			break;
		}
		case 'object': {
			const object = index.objectById.get(entity.objectId);
			if (!object) return null;
			candidates.push(
				{ field: 'id', value: object.objectId },
				{ field: 'kind', value: object.objectKind }
			);
			break;
		}
		case 'cluster': {
			const cluster = index.sceneClusterById.get(entity.clusterId);
			if (!cluster) return null;
			candidates.push(
				{ field: 'name', value: cluster.name },
				{ field: 'id', value: cluster.clusterId }
			);
			break;
		}
		case 'entity': {
			const sceneEntity = index.sceneEntityById.get(entity.entityId);
			if (!sceneEntity) return null;
			candidates.push(
				{ field: 'name', value: sceneEntity.name },
				{ field: 'id', value: sceneEntity.entityId }
			);
			break;
		}
	}
	for (const candidate of candidates) {
		if (candidate.value === null || candidate.value === undefined) continue;
		const value = candidate.value;
		const label = formatPlacementLabel(value);
		const hit =
			value.toLowerCase().includes(normalizedQuery) ||
			label.toLowerCase().includes(normalizedQuery);
		if (!hit) continue;
		return {
			field: candidate.field,
			query: normalizedQuery,
			text: searchMatchText(candidate.field, candidate.term ?? value),
			exactReference: candidate.field === 'reference' && value.toLowerCase() === normalizedQuery
		};
	}
	return null;
}

function searchMatchText(field: HierarchyMatchField, term: string): string {
	switch (field) {
		case 'name':
			return 'Matched name';
		case 'reference':
			return `Matched reference ${term}`;
		case 'id':
			return `Matched ID ${term}`;
		case 'role':
			return `Matched role “${term}”`;
		case 'kind':
			return `Matched kind “${term}”`;
		case 'label':
			return 'Matched label';
	}
}

/**
 * Annotate the top-level rows of every `direct` group. Nested children (an
 * Opening hosted by a matched Wall, `Ends`) inherit their parent's presence and
 * must not claim a hit of their own.
 */
function applySearchMatchExplanations(
	index: HierarchySourceIndex,
	blocks: HierarchySearchBlock[],
	normalizedQuery: string
): void {
	for (const block of blocks) {
		for (const group of block.groups) {
			if (group.kind !== 'direct') continue;
			for (const row of group.rows) {
				if (!row.entity || row.match) continue;
				const match = explainHierarchySearchMatch(index, row.entity, normalizedQuery);
				if (match) row.match = match;
			}
		}
	}
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
		const opening = hierarchyOpeningRow(index, `${rowKey}:opening:${openingId}`, openingId, {
			occurrence: true
		});
		if (opening) children.push(opening);
	}
	// P23.14 Decision 4 — no `Ends …` relation row: host Openings are the whole
	// wall disclosure, and endpoint identity lives on the Wall row itself.
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
			hierarchySearchMatches(
				normalizedQuery,
				room.name,
				room.roomId,
				formatPlacementLabel(room.roomId),
				room.reference ?? undefined
			)
		)
		.map((room) => room.roomId);
	const directWallIds = index.orderedWalls
		.filter((wall) =>
			hierarchySearchMatches(
				normalizedQuery,
				wall.wallId,
				formatPlacementLabel(wall.wallId),
				wall.role,
				// P23.12 — authored names and compact references are first-class
				// search fields alongside the raw ID and kind/role terms.
				wall.name ?? undefined,
				wall.reference ?? undefined
			)
		)
		.map((wall) => wall.wallId);
	const directOpeningIds = index.orderedOpenings
		.filter((opening) =>
			hierarchySearchMatches(
				normalizedQuery,
				opening.openingId,
				formatPlacementLabel(opening.openingId),
				opening.openingKind,
				opening.name ?? undefined,
				opening.reference ?? undefined
			)
		)
		.map((opening) => opening.openingId);
	const directJunctionIds = index.orderedJunctions
		.filter((junction) =>
			hierarchySearchMatches(
				normalizedQuery,
				junction.junctionId,
				formatPlacementLabel(junction.junctionId),
				junction.reference ?? undefined
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
					// The host's *identity*, not its raw canonical ID.
					secondary: `on ${hierarchyWallIdentityLabel(index, opening.wallId)}`,
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

	applySearchMatchExplanations(index, blocks, normalizedQuery);

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
