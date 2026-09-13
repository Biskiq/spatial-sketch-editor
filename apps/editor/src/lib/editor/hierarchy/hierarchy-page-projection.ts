/**
 * `hierarchy-page-projection.ts` — P23.6e slices 1 (plan §Page projections,
 * §Representation, reveal, and pinned selection).
 *
 * Pure, deterministic page builders over `HierarchySourceIndex`. Every page
 * returns rows plus a representation registry, so the Navigator can answer
 * "is the selected entity represented here?" without DOM presence, viewport
 * visibility or a second selected-entity store.
 *
 * Rules owned here:
 * - ordering never depends on selection, hover, viewport, timestamps, or map
 *   insertion order derived from a query;
 * - `rowKey` includes page/context, so the same canonical Wall may have one
 *   canonical identity and several legitimate representations;
 * - `HierarchyEntityKey.id` is the collision-safe canonical key (owner + IDs);
 *   representation maps are keyed by it;
 * - a representation's `ancestorDisclosureKeys` is the exact disclosure chain
 *   the renderer must add before the row exists, excluding the row's own
 *   disclosure key;
 * - nothing here selects, mutates, navigates, writes history or touches Svelte.
 *
 * Gates pinned as facts (P23.6e §Four product gates):
 * - gate 1: labels are authored names or `formatPlacementLabel(canonicalId)`
 *   with the raw canonical ID carried alongside — never an invented ordinal;
 * - gate 2: every Room page carries `Assigned Layout Objects (n)` from explicit
 *   `object.roomId` only, including `(0)`, with the fixed tooltip;
 * - gate 3: the Openings page exposes `All Openings / Doors / Windows`;
 * - gate 4: Camera is not part of this projection (the Scene-side `Camera Flow`
 *   duplicate is removed in a later slice; `CameraSidebar` is untouched).
 */

import { formatPlacementLabel } from '../editor-outliner';
import type { LayoutSelection } from '../layout/layout-interaction';
import type { ActiveEditorSelection } from '../app/active-editor-selection.svelte';
import {
	junctionEntityKey,
	layoutObjectEntityKey,
	openingEntityKey,
	roomEntityKey,
	sceneClusterEntityKey,
	sceneEntityKey,
	wallEntityKey,
	type HierarchyEntityKey,
	type HierarchySourceIndex
} from './hierarchy-source-index';

export type HierarchyPage =
	| { kind: 'root' }
	| { kind: 'rooms' }
	| { kind: 'room'; roomId: string }
	| { kind: 'walls' }
	| { kind: 'openings' }
	| { kind: 'junctions' }
	| { kind: 'layoutObjects' }
	| { kind: 'sceneContent' };

export type WallFilter = 'all' | 'multiple-rooms' | 'one-room' | 'no-room' | 'with-openings';
export type OpeningFilter = 'all' | 'door' | 'window';

/** Transient page options. UI state only — never persisted, never selection. */
export type HierarchyPageOptions = {
	wallFilter?: WallFilter;
	openingFilter?: OpeningFilter;
};

/** One historical Navigator entry (UI-only; plan §Navigator state). */
export type HierarchyHistoryEntry = {
	page: HierarchyPage;
	query: string;
	wallFilter: WallFilter;
	openingFilter: OpeningFilter;
	/** Stable contextual row/section keys. */
	disclosure: string[];
	scrollTop: number;
};

/** The exact row a `Show in…` navigation must disclose and scroll to. */
export type HierarchyRevealTarget = {
	entity: HierarchyEntityKey;
	rowKey: string;
	ancestorDisclosureKeys: string[];
};

/**
 * A page destination. `reveal: null` is an **ordinary entry** (render at the
 * page's intended/default state and only highlight a represented selection);
 * a non-null reveal is a `Show in…` target and is the one entry that scrolls.
 */
export type HierarchyDestination = {
	page: HierarchyPage;
	reveal: HierarchyRevealTarget | null;
};

/** Navigation-only action attached to a selectable row (never a selection). */
export type HierarchyRowAction = {
	actionKey: string;
	label: string;
	destination: HierarchyDestination;
};

export type HierarchyRowKind = 'heading' | 'destination' | 'section' | 'entity' | 'relation';

export type HierarchyProjectedRow = {
	rowKey: string;
	kind: HierarchyRowKind;
	label: string;
	/** Canonical entity (entity rows). `undefined` for headings/sections/relations. */
	entity?: HierarchyEntityKey;
	/** Raw canonical ID (search, accessible name, Advanced/debug). */
	canonicalId?: string;
	/** Authoritative sub-kind text (wall role, door/window, object kind, …). */
	facet?: string;
	/** Factual secondary text (`also in …`, `Door on W1`, `1 opening`). */
	secondary?: string;
	tooltip?: string;
	count?: number;
	/** Destination rows (Navigator root inventory) only. */
	destination?: HierarchyDestination;
	/** Collapsible container key (sections and nested host rows). */
	disclosureKey?: string;
	defaultOpen?: boolean;
	children?: HierarchyProjectedRow[];
	actions?: HierarchyRowAction[];
};

/**
 * One page-context representation. `ancestorDisclosureKeys` is the exact chain
 * of `disclosureKey`s above this row, in root→leaf order.
 */
export type HierarchyRepresentation = {
	rowKey: string;
	entity: HierarchyEntityKey;
	ancestorDisclosureKeys: string[];
	primary: boolean;
};

export type HierarchyPageProjection = {
	page: HierarchyPage;
	rows: HierarchyProjectedRow[];
	/** Keyed by `entity.id`. Ordered by row order. */
	representations: Map<string, HierarchyRepresentation[]>;
	/** Entity IDs the page represents at its calm/default filters. */
	unfilteredRepresentations: Set<string>;
};

/** Wall facets (gate-3-independent): pure predicates, never a renderer switch. */
export type WallFilterInput = {
	roomIds: readonly string[];
	openingIds: readonly string[];
};
export type WallFilterPredicate = (input: WallFilterInput) => boolean;

export const WALL_FILTER_PREDICATES: Readonly<Record<WallFilter, WallFilterPredicate>> = {
	all: () => true,
	'multiple-rooms': ({ roomIds }) => roomIds.length > 1,
	'one-room': ({ roomIds }) => roomIds.length === 1,
	'no-room': ({ roomIds }) => roomIds.length === 0,
	'with-openings': ({ openingIds }) => openingIds.length > 0
};

export const WALL_FILTER_LABELS: Readonly<Record<WallFilter, string>> = {
	all: 'All Walls',
	'multiple-rooms': 'In multiple rooms',
	'one-room': 'In one room',
	'no-room': 'No room participation',
	'with-openings': 'With openings'
};

export const OPENING_FILTER_LABELS: Readonly<Record<OpeningFilter, string>> = {
	all: 'All Openings',
	door: 'Doors',
	window: 'Windows'
};

/** Pinned exclusion reason for the bottom-pinned selection strip. */
export type PinnedReason =
	| { kind: 'search'; text: 'Not in search results' }
	| { kind: 'filter'; text: 'Outside active filter' }
	| { kind: 'room'; text: string }
	| { kind: 'page'; text: 'Not on this page' };

const SEARCH_EXCLUSION: PinnedReason = { kind: 'search', text: 'Not in search results' };
const FILTER_EXCLUSION: PinnedReason = { kind: 'filter', text: 'Outside active filter' };
const PAGE_EXCLUSION: PinnedReason = { kind: 'page', text: 'Not on this page' };

/**
 * Rows under collapsed ancestors and rows outside the viewport are
 * **represented**: DOM presence is never the test.
 */
export function isHierarchyRowSelectable(row: HierarchyProjectedRow): boolean {
	return row.kind === 'entity' && row.entity !== undefined;
}

function entityRow(input: {
	rowKey: string;
	label: string;
	entity: HierarchyEntityKey;
	canonicalId: string;
	facet?: string;
	secondary?: string;
	tooltip?: string;
	disclosureKey?: string;
	defaultOpen?: boolean;
	children?: HierarchyProjectedRow[];
	actions?: HierarchyRowAction[];
}): HierarchyProjectedRow {
	return { kind: 'entity', ...input };
}

function headingRow(rowKey: string, label: string): HierarchyProjectedRow {
	// Presentational eyebrow: not focusable, not selectable, not a destination.
	return { rowKey, kind: 'heading', label };
}

function destinationRow(
	rowKey: string,
	label: string,
	count: number,
	page: HierarchyPage
): HierarchyProjectedRow {
	return {
		rowKey,
		kind: 'destination',
		label,
		count,
		destination: { page, reveal: null }
	};
}

function sectionRow(
	rowKey: string,
	label: string,
	children: HierarchyProjectedRow[],
	options: { defaultOpen: boolean; tooltip?: string }
): HierarchyProjectedRow {
	return {
		rowKey,
		kind: 'section',
		label,
		count: children.length,
		disclosureKey: rowKey,
		defaultOpen: options.defaultOpen,
		tooltip: options.tooltip,
		children
	};
}

function kindLabel(kind: string): string {
	return formatPlacementLabel(kind);
}

/** Bounded participation text: at most two names, then `+n`. */
function participationText(prefix: string, names: string[]): string {
	const shown = names.slice(0, 2).join(', ');
	const rest = names.length > 2 ? `, +${names.length - 2}` : '';
	return `${prefix} ${shown}${rest}`;
}

function roomName(index: HierarchySourceIndex, roomId: string): string {
	return index.roomById.get(roomId)?.name ?? formatPlacementLabel(roomId);
}

function nestedOpeningRow(
	index: HierarchySourceIndex,
	rowKey: string,
	openingId: string
): HierarchyProjectedRow | null {
	const opening = index.openingById.get(openingId);
	if (!opening) return null;
	return entityRow({
		rowKey,
		label: formatPlacementLabel(opening.openingId),
		entity: opening.entity,
		canonicalId: opening.openingId,
		facet: opening.openingKind,
		secondary: kindLabel(opening.openingKind)
	});
}

function junctionEntityRow(
	index: HierarchySourceIndex,
	rowKey: string,
	junctionId: string
): HierarchyProjectedRow | null {
	const junction = index.junctionById.get(junctionId);
	if (!junction) return null;
	const incident = index.incidentWallIdsByJunctionId.get(junctionId) ?? [];
	return entityRow({
		rowKey,
		label: formatPlacementLabel(junction.junctionId),
		entity: junction.entity,
		canonicalId: junction.junctionId,
		secondary: `${incident.length} wall${incident.length === 1 ? '' : 's'}`
	});
}

function layoutObjectRow(
	index: HierarchySourceIndex,
	rowKey: string,
	objectId: string,
	options: { assignmentText: boolean }
): HierarchyProjectedRow | null {
	const object = index.objectById.get(objectId);
	if (!object) return null;
	const assignedRoom = object.roomId === null ? null : index.roomById.get(object.roomId);
	return entityRow({
		rowKey,
		label: formatPlacementLabel(object.objectId),
		entity: object.entity,
		canonicalId: object.objectId,
		facet: object.objectKind,
		// Explicit `roomId` only — never coordinate/bounds inference.
		secondary:
			options.assignmentText && assignedRoom ? `assigned to ${assignedRoom.name}` : undefined
	});
}

/**
 * A Room page's boundary Junctions: each oriented boundary ref contributes its
 * **oriented start** Junction, de-duplicated by first encounter; unmatched
 * oriented ends are appended afterwards only to keep a malformed intermediate
 * projection renderable. Canonical Wall orientation is authoritative — never a
 * coordinate guess.
 */
export function boundaryJunctionIds(
	index: HierarchySourceIndex,
	boundary: readonly { wallId: string; direction: 'forward' | 'reverse' }[]
): string[] {
	const ids: string[] = [];
	for (const ref of boundary) {
		const wall = index.wallById.get(ref.wallId);
		if (!wall) continue;
		const orientedStart =
			ref.direction === 'forward' ? wall.startJunctionId : wall.endJunctionId;
		if (!ids.includes(orientedStart)) ids.push(orientedStart);
	}
	for (const ref of boundary) {
		const wall = index.wallById.get(ref.wallId);
		if (!wall) continue;
		const orientedEnd = ref.direction === 'forward' ? wall.endJunctionId : wall.startJunctionId;
		if (!ids.includes(orientedEnd)) ids.push(orientedEnd);
	}
	return ids;
}

function endsRelationRow(
	index: HierarchySourceIndex,
	rowKey: string,
	ref: { wallId: string; direction: 'forward' | 'reverse' }
): HierarchyProjectedRow | null {
	const wall = index.wallById.get(ref.wallId);
	if (!wall) return null;
	const start = ref.direction === 'forward' ? wall.startJunctionId : wall.endJunctionId;
	const end = ref.direction === 'forward' ? wall.endJunctionId : wall.startJunctionId;
	return {
		rowKey,
		kind: 'relation',
		label: `Ends ${formatPlacementLabel(start)} · ${formatPlacementLabel(end)}`
	};
}

function buildRootRows(index: HierarchySourceIndex): HierarchyProjectedRow[] {
	return [
		destinationRow('root:rooms', 'Rooms', index.orderedRooms.length, { kind: 'rooms' }),
		headingRow('root:heading:architecture', 'ARCHITECTURE'),
		destinationRow('root:walls', 'Walls', index.orderedWalls.length, { kind: 'walls' }),
		destinationRow('root:openings', 'Openings', index.orderedOpenings.length, { kind: 'openings' }),
		destinationRow('root:junctions', 'Junctions', index.orderedJunctions.length, {
			kind: 'junctions'
		}),
		headingRow('root:heading:placed-content', 'PLACED CONTENT'),
		destinationRow(
			'root:layoutObjects',
			'Layout Objects',
			index.orderedLayoutObjects.length,
			{ kind: 'layoutObjects' }
		),
		// Clusters are organizational rows and add zero: each canonical entity
		// counts exactly once, so an empty cluster never inflates the number.
		destinationRow('root:sceneContent', 'Scene Content', index.orderedSceneEntities.length, {
			kind: 'sceneContent'
		})
	];
}

function buildRoomsRows(index: HierarchySourceIndex): HierarchyProjectedRow[] {
	const rows: HierarchyProjectedRow[] = [];
	for (const room of index.orderedRooms) {
		rows.push(
			entityRow({
				rowKey: `rooms:room:${room.roomId}`,
				label: room.name,
				entity: room.entity,
				canonicalId: room.roomId,
				actions: [
					{
						actionKey: `rooms:open:${room.roomId}`,
						label: `Open ${room.name} ›`,
						// Ordinary entry: the page opens at its default state;
						// opening a Room never selects it.
						destination: { page: { kind: 'room', roomId: room.roomId }, reveal: null }
					}
				]
			})
		);
	}
	return rows;
}

function buildRoomPageRows(index: HierarchySourceIndex, roomId: string): HierarchyProjectedRow[] {
	const room = index.roomById.get(roomId);
	if (!room) return [];

	const rows: HierarchyProjectedRow[] = [
		entityRow({
			rowKey: `room:${roomId}:title`,
			label: room.name,
			entity: room.entity,
			canonicalId: room.roomId
		})
	];

	const boundaryChildren: HierarchyProjectedRow[] = [];
	for (const ref of room.boundary) {
		const wall = index.wallById.get(ref.wallId);
		if (!wall) continue;
		const wallRowKey = `room:${roomId}:wall:${ref.wallId}`;
		const openings = (index.openingsByWallId.get(ref.wallId) ?? [])
			.map((openingId) => nestedOpeningRow(index, `${wallRowKey}:opening:${openingId}`, openingId))
			.filter((row): row is HierarchyProjectedRow => row !== null);
		const ends = endsRelationRow(index, `${wallRowKey}:ends`, ref);
		const others = (index.roomIdsByWallId.get(ref.wallId) ?? []).filter((id) => id !== roomId);
		boundaryChildren.push(
			entityRow({
				rowKey: wallRowKey,
				label: formatPlacementLabel(ref.wallId),
				entity: wall.entity,
				canonicalId: ref.wallId,
				facet: wall.role,
				secondary: others.length
					? participationText('also in', others.map((id) => roomName(index, id)))
					: undefined,
				disclosureKey: wallRowKey,
				defaultOpen: false,
				children: ends ? [...openings, ends] : openings
			})
		);
	}
	rows.push(
		sectionRow(
			`room:${roomId}:section:boundary`,
			`Boundary (${boundaryChildren.length} walls)`,
			boundaryChildren,
			{ defaultOpen: true }
		)
	);

	const junctionIds = boundaryJunctionIds(index, room.boundary);
	rows.push(
		sectionRow(
			`room:${roomId}:section:junctions`,
			`Boundary Junctions (${junctionIds.length})`,
			junctionIds
				.map((junctionId) =>
					junctionEntityRow(index, `room:${roomId}:junction:${junctionId}`, junctionId)
				)
				.filter((row): row is HierarchyProjectedRow => row !== null),
			{ defaultOpen: false }
		)
	);

	// Gate 2: explicit assignment only; `(0)` stays visible.
	const objectIds = index.assignedObjectIdsByRoomId.get(roomId) ?? [];
	rows.push(
		sectionRow(
			`room:${roomId}:section:objects`,
			`Assigned Layout Objects (${objectIds.length})`,
			objectIds
				.map((objectId) =>
					layoutObjectRow(index, `room:${roomId}:object:${objectId}`, objectId, {
						assignmentText: false
					})
				)
				.filter((row): row is HierarchyProjectedRow => row !== null),
			{
				defaultOpen: false,
				tooltip: `Layout Objects explicitly assigned to ${room.name}.`
			}
		)
	);

	return rows;
}

function buildWallsRows(
	index: HierarchySourceIndex,
	filter: WallFilter
): HierarchyProjectedRow[] {
	const predicate = WALL_FILTER_PREDICATES[filter];
	const rows: HierarchyProjectedRow[] = [];
	for (const wall of index.orderedWalls) {
		const openingIds = index.openingsByWallId.get(wall.wallId) ?? [];
		const roomIds = index.roomIdsByWallId.get(wall.wallId) ?? [];
		if (!predicate({ roomIds, openingIds })) continue;
		const rowKey = `walls:wall:${wall.wallId}`;
		const secondaryParts: string[] = [];
		// The resting rows do not pay the metadata cost: room participation is
		// only spelled out for the multiple-Room facet.
		if (filter === 'multiple-rooms' && roomIds.length > 0) {
			secondaryParts.push(participationText('in', roomIds.map((id) => roomName(index, id))));
		}
		if (openingIds.length > 0) {
			secondaryParts.push(`▸ ${openingIds.length} opening${openingIds.length === 1 ? '' : 's'}`);
		}
		rows.push(
			entityRow({
				rowKey,
				label: formatPlacementLabel(wall.wallId),
				entity: wall.entity,
				canonicalId: wall.wallId,
				facet: wall.role,
				secondary: secondaryParts.length > 0 ? secondaryParts.join(' · ') : undefined,
				disclosureKey: rowKey,
				defaultOpen: false,
				children: openingIds
					.map((openingId) => nestedOpeningRow(index, `${rowKey}:opening:${openingId}`, openingId))
					.filter((row): row is HierarchyProjectedRow => row !== null)
			})
		);
	}
	return rows;
}

function buildOpeningsRows(
	index: HierarchySourceIndex,
	filter: OpeningFilter
): HierarchyProjectedRow[] {
	const rows: HierarchyProjectedRow[] = [];
	for (const opening of index.orderedOpenings) {
		// Gate 3: authoritative typed facet.
		if (filter !== 'all' && opening.openingKind !== filter) continue;
		const host = index.wallById.get(opening.wallId);
		const home = canonicalHierarchyHome(index, opening.entity);
		rows.push(
			entityRow({
				rowKey: `openings:opening:${opening.openingId}`,
				label: formatPlacementLabel(opening.openingId),
				entity: opening.entity,
				canonicalId: opening.openingId,
				facet: opening.openingKind,
				secondary: `${kindLabel(opening.openingKind)} on ${formatPlacementLabel(
					host?.wallId ?? opening.wallId
				)}`,
				actions: home
					? [
							{
								actionKey: `openings:${opening.openingId}:show-in-walls`,
								label: 'Show in Walls ›',
								destination: home
							}
						]
					: undefined
			})
		);
	}
	return rows;
}

function buildJunctionsRows(index: HierarchySourceIndex): HierarchyProjectedRow[] {
	return index.orderedJunctions
		.map((junction) =>
			junctionEntityRow(index, `junctions:junction:${junction.junctionId}`, junction.junctionId)
		)
		.filter((row): row is HierarchyProjectedRow => row !== null);
}

function buildLayoutObjectsRows(index: HierarchySourceIndex): HierarchyProjectedRow[] {
	return index.orderedLayoutObjects
		.map((object) =>
			layoutObjectRow(index, `layoutObjects:object:${object.objectId}`, object.objectId, {
				assignmentText: true
			})
		)
		.filter((row): row is HierarchyProjectedRow => row !== null);
}

function buildSceneContentRows(index: HierarchySourceIndex): HierarchyProjectedRow[] {
	const rows: HierarchyProjectedRow[] = [];
	for (const cluster of index.orderedSceneClusters) {
		const memberRows: HierarchyProjectedRow[] = cluster.memberIds.map((memberId) => {
			const entity = index.sceneEntityById.get(memberId);
			return entityRow({
				rowKey: `scene:cluster:${cluster.clusterId}:entity:${memberId}`,
				label: entity?.name ?? formatPlacementLabel(memberId),
				entity: sceneEntityKey(memberId),
				canonicalId: memberId,
				facet: 'scene-entity'
			});
		});
		rows.push(
			entityRow({
				rowKey: `scene:cluster:${cluster.clusterId}`,
				label: cluster.name,
				entity: cluster.entity,
				canonicalId: cluster.clusterId,
				facet: 'scene-cluster',
				secondary: `${memberRows.length} item${memberRows.length === 1 ? '' : 's'}`,
				disclosureKey: `scene:cluster:${cluster.clusterId}`,
				defaultOpen: true,
				children: memberRows
			})
		);
	}
	for (const entity of index.orderedSceneEntities) {
		if (index.clusterByMemberId.has(entity.entityId)) continue;
		rows.push(
			entityRow({
				rowKey: `scene:entity:${entity.entityId}`,
				label: entity.name,
				entity: entity.entity,
				canonicalId: entity.entityId,
				facet: 'scene-entity'
			})
		);
	}
	return rows;
}

function buildPageRows(
	index: HierarchySourceIndex,
	page: HierarchyPage,
	options: HierarchyPageOptions
): HierarchyProjectedRow[] {
	switch (page.kind) {
		case 'root':
			return buildRootRows(index);
		case 'rooms':
			return buildRoomsRows(index);
		case 'room':
			return buildRoomPageRows(index, page.roomId);
		case 'walls':
			return buildWallsRows(index, options.wallFilter ?? 'all');
		case 'openings':
			return buildOpeningsRows(index, options.openingFilter ?? 'all');
		case 'junctions':
			return buildJunctionsRows(index);
		case 'layoutObjects':
			return buildLayoutObjectsRows(index);
		case 'sceneContent':
			return buildSceneContentRows(index);
	}
}

function collectRepresentations(
	rows: readonly HierarchyProjectedRow[]
): Map<string, HierarchyRepresentation[]> {
	const representations = new Map<string, HierarchyRepresentation[]>();
	const visit = (row: HierarchyProjectedRow, ancestors: string[]): void => {
		if (row.entity) {
			const entry: HierarchyRepresentation = {
				rowKey: row.rowKey,
				entity: row.entity,
				// Ancestors only: the row's own disclosure key is not needed to
				// make the row itself exist.
				ancestorDisclosureKeys: [...ancestors],
				primary: false
			};
			const list = representations.get(row.entity.id);
			if (list) list.push(entry);
			else representations.set(row.entity.id, [entry]);
		}
		const childAncestors = row.disclosureKey ? [...ancestors, row.disclosureKey] : ancestors;
		for (const child of row.children ?? []) visit(child, childAncestors);
	};
	for (const row of rows) visit(row, []);
	for (const list of representations.values()) {
		const first = list[0];
		if (first) first.primary = true;
	}
	return representations;
}

/**
 * Project one page. Deterministic for deep-equal inputs and options; the source
 * index and documents are never mutated.
 */
export function buildHierarchyPageProjection(
	index: HierarchySourceIndex,
	page: HierarchyPage,
	options: HierarchyPageOptions = {}
): HierarchyPageProjection {
	const rows = buildPageRows(index, page, options);
	const representations = collectRepresentations(rows);
	const filtered =
		(options.wallFilter ?? 'all') !== 'all' || (options.openingFilter ?? 'all') !== 'all';
	const unfiltered = filtered
		? collectRepresentations(buildPageRows(index, page, {}))
		: representations;
	return {
		page,
		rows,
		representations,
		unfilteredRepresentations: new Set(unfiltered.keys())
	};
}

/** Primary representation when one exists, otherwise the first. Pure lookup. */
export function findHierarchyRepresentation(
	projection: HierarchyPageProjection,
	entity: HierarchyEntityKey
): HierarchyRepresentation | null {
	const list = projection.representations.get(entity.id);
	if (!list || list.length === 0) return null;
	return list.find((representation) => representation.primary) ?? list[0] ?? null;
}

function hierarchyHomePage(
	index: HierarchySourceIndex,
	entity: HierarchyEntityKey
): HierarchyPage | null {
	switch (entity.owner) {
		case 'layout':
			switch (entity.kind) {
				case 'room':
					return index.roomById.has(entity.roomId) ? { kind: 'rooms' } : null;
				case 'wall':
					return index.wallById.has(entity.wallId) ? { kind: 'walls' } : null;
				case 'opening':
					// Homes: Opening → Walls, with its host row in the reveal chain.
					return index.openingById.has(entity.openingId) ? { kind: 'walls' } : null;
				case 'junction':
					return index.junctionById.has(entity.junctionId) ? { kind: 'junctions' } : null;
				case 'object':
					return index.objectById.has(entity.objectId) ? { kind: 'layoutObjects' } : null;
				default:
					return null;
			}
		case 'scene':
			switch (entity.kind) {
				case 'cluster':
					return index.sceneClusterById.has(entity.clusterId) ? { kind: 'sceneContent' } : null;
				case 'entity':
					return index.sceneEntityById.has(entity.entityId) ? { kind: 'sceneContent' } : null;
				default:
					return null;
			}
		default:
			return null;
	}
}

/**
 * The canonical `Show in…` home for an entity, including the exact row and
 * ancestor disclosure chain on that page. `null` when the entity no longer
 * exists in the canonical documents.
 */
export function canonicalHierarchyHome(
	index: HierarchySourceIndex,
	entity: HierarchyEntityKey
): HierarchyDestination | null {
	const page = hierarchyHomePage(index, entity);
	if (!page) return null;
	const projection = buildHierarchyPageProjection(index, page);
	const representation = findHierarchyRepresentation(projection, entity);
	return {
		page,
		reveal: representation
			? {
					entity,
					rowKey: representation.rowKey,
					ancestorDisclosureKeys: [...representation.ancestorDisclosureKeys]
				}
			: null
	};
}

/**
 * Why a selected entity is excluded from the active projection. Priority (plan
 * §Reason priority): search → filter → Room page → generic page. Returns `null`
 * when the entity **is** represented — an off-screen or collapsed row never
 * pins.
 */
export function explainHierarchyExclusion(input: {
	page: HierarchyPage;
	current: HierarchyPageProjection;
	base: HierarchyPageProjection;
	entity: HierarchyEntityKey;
	queryActive: boolean;
	roomName?: string;
}): PinnedReason | null {
	if (input.current.representations.has(input.entity.id)) return null;
	if (input.queryActive) return SEARCH_EXCLUSION;
	if (input.base.representations.has(input.entity.id)) return FILTER_EXCLUSION;
	if (input.page.kind === 'room') {
		return { kind: 'room', text: `Not in ${input.roomName ?? input.page.roomId}` };
	}
	return PAGE_EXCLUSION;
}

/** Canonical Layout selection → Navigator entity key (legacy kinds are `null`). */
export function layoutSelectionToHierarchyEntity(
	selection: LayoutSelection
): HierarchyEntityKey | null {
	switch (selection.kind) {
		case 'room':
			return roomEntityKey(selection.roomId);
		case 'physicalWall':
			return wallEntityKey(selection.wallId);
		case 'wallOpening':
			return openingEntityKey(selection.wallId, selection.openingId);
		case 'junction':
			return junctionEntityKey(selection.junctionId);
		case 'object':
			return layoutObjectEntityKey(selection.objectId);
		default:
			return null;
	}
}

/**
 * The **one** active selection projected to a Navigator entity. Scene
 * multi-selection uses the existing primary convention (`ids.at(-1)`) for
 * reveal; Camera selections have no Scene-domain representation.
 */
export function activeSelectionToHierarchyEntity(
	active: ActiveEditorSelection
): HierarchyEntityKey | null {
	if (active.domain === 'layout') return layoutSelectionToHierarchyEntity(active.selection);
	if (active.domain !== 'scene') return null;
	const selection = active.selection;
	if (selection.kind === 'cluster') return sceneClusterEntityKey(selection.clusterId);
	if (selection.kind === 'placement') {
		const primary = selection.ids.at(-1);
		return primary ? sceneEntityKey(primary) : null;
	}
	return null;
}
