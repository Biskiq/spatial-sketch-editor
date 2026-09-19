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
// P23.12 D5 — identity *composition* is the shared layer's job too: every row
// label and secondary reference below comes from these three functions, so the
// tier order (name → reference → raw-ID fallback) exists in exactly one place.
import {
	identityLabelPair,
	identityPrimaryLabel,
	type IdentityView
} from '../identity/layout-identity-view';
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
	/** Stable contextual row/section keys explicitly opened by the user/reveal. */
	disclosure: string[];
	/** Explicitly collapsed overrides for rows whose default is open. */
	collapsed?: string[];
	/** The underlying page offset while `query` renders the search surface. */
	pageScrollTop?: number;
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

/**
 * P23.14 §12.3 — the six visually distinct row species. Each one has a
 * different visual job, so a group can never masquerade as a domain entity:
 *
 * - `heading`     — presentational eyebrow inside a page (never focusable);
 * - `destination` — spatial/container entity row (a page destination: Rooms,
 *                   Walls, Openings, Junctions, …) with its inventory count;
 * - `section`     — typed group heading inside an entity page (Boundary,
 *                   Boundary Junctions, Wall-hosted Openings, …);
 * - `entity`      — ordinary canonical entity at its own home;
 * - `occurrence`  — contextual projection of a canonical entity shown through
 *                   another context (a shared Wall inside a Room's Boundary, an
 *                   Opening inside its host Wall, a Boundary Junction, an
 *                   assigned object). Nesting never establishes ownership
 *                   (§12.2): an occurrence resolves to the same canonical
 *                   entity, reference, name and selection as its home row;
 * - `relation`    — relation metadata / non-selectable inventory count row;
 * - `empty`       — authored empty/teaching state for a page with no rows.
 */
export type HierarchyRowKind =
	| 'heading'
	| 'destination'
	| 'section'
	| 'entity'
	| 'occurrence'
	| 'relation'
	| 'empty';

/** Which field of an entity a search query hit, strongest first. */
export type HierarchyMatchField = 'name' | 'reference' | 'id' | 'role' | 'kind' | 'label';

/** The explanation carried by a direct search result row. */
export type HierarchyRowMatch = {
	field: HierarchyMatchField;
	/** The normalized query text that produced the hit. */
	query: string;
	/** Short human explanation rendered beside the row (`Matched ID w1`). */
	text: string;
	/**
	 * True when the query equals this entity's reference exactly: the reference
	 * is the identity the user typed, so the renderer emphasises it rather than
	 * presenting the authored name as a coincidence.
	 */
	exactReference: boolean;
};

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
	/**
	 * P23.12 — the **protected** secondary identity span: the compact reference
	 * beside a primary authored name. Never truncated, never overridden by
	 * relationship context (that is `secondary`), and absent when the reference
	 * already is the label or the document carries no ledger.
	 */
	reference?: string;
	/**
	 * P23.12 — `true` when `label` **is** the compact reference: an unnamed Wall
	 * or Opening, or a Junction (reference-only). A reference is six characters
	 * and always fits, so the renderer protects it from shrinking or ellipsising;
	 * a truncating reference is worse than a truncating name, because the token
	 * is the entity's only identity. `undefined` for named entities and for the
	 * raw-ID fallback label of a document without a ledger.
	 */
	referenceLed?: boolean;
	/**
	 * Relationship context (`also in …`, `Door · on W-7K3M`, `3 walls`).
	 * This is the tier that shortens or ellipsises under width pressure.
	 */
	secondary?: string;
	/**
	 * P23.12 — why a *search* row is present. A raw-ID query can surface a row
	 * whose authored name looks unrelated, so the row must say what matched
	 * instead of leaving the user to guess. Page rows never carry this.
	 */
	match?: HierarchyRowMatch;
	tooltip?: string;
	count?: number;
	/** Destination rows (Navigator root inventory) only. */
	destination?: HierarchyDestination;
	/** Collapsible container key (sections and nested host rows). */
	disclosureKey?: string;
	/** A default-open row may be collapsed by a user; this flag is absolute. */
	alwaysOpen?: boolean;
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
	// A contextual occurrence is the SAME canonical entity as its home row
	// (§12.2), so it stays selectable: nesting is presentation, not ownership.
	return (row.kind === 'entity' || row.kind === 'occurrence') && row.entity !== undefined;
}

/** Authored empty/teaching state for a page that projects no rows (§12.3). */
export function hierarchyEmptyRow(rowKey: string, label: string): HierarchyProjectedRow {
	return { rowKey, kind: 'empty', label };
}

/** The authored empty/teaching copy for each page (§12.3 species 6, §19). */
function pageEmptyLabel(page: HierarchyPage): string {
	switch (page.kind) {
		case 'rooms':
			return 'No rooms yet · draw a Wall run or use Rect Room in the Tool Tray';
		case 'room':
			return 'This room projects no rows yet';
		case 'walls':
			return 'No walls yet · use Draw Wall in the Tool Tray';
		case 'openings':
			return 'No openings yet · use Door or Window on a Wall';
		case 'junctions':
			return 'No junctions yet · junctions appear where walls meet';
		case 'layoutObjects':
			return 'No layout objects yet · place a Column, Platform or Plinth';
		case 'sceneContent':
			return 'No scene content yet · use Place in the Tool Tray';
		default:
			return 'Nothing to show yet';
	}
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
	/** True when this row is a contextual projection of the canonical entity. */
	occurrence?: boolean;
}): HierarchyProjectedRow {
	const { occurrence = false, ...rest } = input;
	return { kind: occurrence ? 'occurrence' : 'entity', ...rest };
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
	options: { defaultOpen: boolean; alwaysOpen?: boolean; tooltip?: string }
): HierarchyProjectedRow {
	return {
		rowKey,
		kind: 'section',
		label,
	count: children.length,
		disclosureKey: rowKey,
		...(options.alwaysOpen === true ? { alwaysOpen: true } : {}),
		defaultOpen: options.defaultOpen,
		tooltip: options.tooltip,
		children
	};
}

/** Authoritative sub-kind label (`door` → `Door`, `box` → `Box`). */
export function hierarchyKindLabel(kind: string): string {
	return formatPlacementLabel(kind);
}

/** Bounded participation text: at most two names, then `+n`. */
export function hierarchyParticipationText(prefix: string, names: string[]): string {
	const shown = names.slice(0, 2).join(', ');
	const rest = names.length > 2 ? `, +${names.length - 2}` : '';
	return `${prefix} ${shown}${rest}`;
}

/** Authored Room name, falling back to the raw canonical ID's display label. */
export function hierarchyRoomName(index: HierarchySourceIndex, roomId: string): string {
	return index.roomById.get(roomId)?.name ?? formatPlacementLabel(roomId);
}

/**
 * An index row's identity, in the shape the shared display-identity layer
 * composes from. The index already resolved name + reference through that same
 * layer, so this is a view of the resolved result — never a second lookup.
 */
function sourceIdentity(row: { reference: string | null; name: string | null }): IdentityView {
	return { reference: row.reference, name: row.name, nameEditable: true };
}

/**
 * The host Wall's identity text, for an Opening's context (`on <host>`).
 * Name first, else the compact reference, else the raw-ID display label — the
 * same tiers every other surface uses, so a context line never leaks a raw ID.
 */
export function hierarchyWallIdentityLabel(index: HierarchySourceIndex, wallId: string): string {
	const wall = index.wallById.get(wallId);
	if (!wall) return formatPlacementLabel(wallId);
	return identityPrimaryLabel(sourceIdentity(wall), formatPlacementLabel(wallId));
}

/**
 * An Opening's distinguishing context: **kind + host**, never a bare kind
 * restatement (P23.12 D8). `undefined` when the host cannot be resolved — with
 * nothing distinguishing to say, the row stays one line.
 */
export function hierarchyOpeningContext(
	index: HierarchySourceIndex,
	openingId: string
): string | undefined {
	const opening = index.openingById.get(openingId);
	if (!opening) return undefined;
	if (!index.wallById.has(opening.wallId)) return undefined;
	return `${hierarchyKindLabel(opening.openingKind)} · on ${hierarchyWallIdentityLabel(
		index,
		opening.wallId
	)}`;
}

/**
 * Shared row options for the canonical entity-row builders. Page builders and
 * the relationship search both compose rows through these builders, so one
 * entity has exactly one label/facet/secondary presentation everywhere.
 */
export type HierarchyEntityRowOptions = {
	/** Overrides the per-kind default secondary text. */
	secondary?: string;
	children?: HierarchyProjectedRow[];
	actions?: HierarchyRowAction[];
	disclosureKey?: string;
	defaultOpen?: boolean;
	tooltip?: string;
	/** P23.14 §12.2 — render as a contextual occurrence of the canonical entity. */
	occurrence?: boolean;
};

export function hierarchyRoomRow(
	index: HierarchySourceIndex,
	rowKey: string,
	roomId: string,
	options: HierarchyEntityRowOptions = {}
): HierarchyProjectedRow | null {
	const room = index.roomById.get(roomId);
	if (!room) return null;
	// P23.12 — the authored Room name stays primary; its reference is the
	// protected secondary identity span (never replaces the name), and the
	// shared pair drops that span when the name already IS the reference.
	const { label, reference } = identityLabelPair(
		sourceIdentity(room),
		formatPlacementLabel(room.roomId)
	);
	return entityRow({
		rowKey,
		label,
		entity: room.entity,
		canonicalId: room.roomId,
		occurrence: options.occurrence,
		...(reference ? { reference } : {}),
		secondary: options.secondary,
		children: options.children,
		actions: options.actions,
		disclosureKey: options.disclosureKey,
		defaultOpen: options.defaultOpen,
		tooltip: options.tooltip
	});
}

export function hierarchyWallRow(
	index: HierarchySourceIndex,
	rowKey: string,
	wallId: string,
	options: HierarchyEntityRowOptions = {}
): HierarchyProjectedRow | null {
	const wall = index.wallById.get(wallId);
	if (!wall) return null;
	// P23.12 identity: authored name leads; an unnamed Wall is reference-led.
	// The reference is the protected tier (its own span, no truncation), while
	// relationship context keeps its own slot — context never hides identity.
	// A name that already *is* the reference renders once (D8 duplicate-collapse),
	// so the protected span only appears when it adds a second token — the shared
	// pair owns that rule for every surface.
	const { label, reference, referenceLed } = identityLabelPair(
		sourceIdentity(wall),
		formatPlacementLabel(wall.wallId)
	);
	return entityRow({
		rowKey,
		label,
		entity: wall.entity,
		canonicalId: wall.wallId,
		facet: wall.role,
		occurrence: options.occurrence,
		...(reference ? { reference } : {}),
		...(referenceLed ? { referenceLed: true } : {}),
		secondary: options.secondary,
		children: options.children,
		actions: options.actions,
		disclosureKey: options.disclosureKey,
		defaultOpen: options.defaultOpen,
		tooltip: options.tooltip
	});
}

export function hierarchyOpeningRow(
	index: HierarchySourceIndex,
	rowKey: string,
	openingId: string,
	options: HierarchyEntityRowOptions = {}
): HierarchyProjectedRow | null {
	const opening = index.openingById.get(openingId);
	if (!opening) return null;
	// P23.12 identity: authored name leads; an unnamed Opening is reference-led.
	const { label, reference, referenceLed } = identityLabelPair(
		sourceIdentity(opening),
		formatPlacementLabel(opening.openingId)
	);
	return entityRow({
		rowKey,
		label,
		entity: opening.entity,
		canonicalId: opening.openingId,
		facet: opening.openingKind,
		occurrence: options.occurrence,
		...(reference ? { reference } : {}),
		...(referenceLed ? { referenceLed: true } : {}),
		// D8 — kind + host, never a bare kind restatement.
		secondary: options.secondary ?? hierarchyOpeningContext(index, openingId),
		children: options.children,
		actions: options.actions,
		disclosureKey: options.disclosureKey,
		defaultOpen: options.defaultOpen,
		tooltip: options.tooltip
	});
}

export function hierarchyJunctionRow(
	index: HierarchySourceIndex,
	rowKey: string,
	junctionId: string,
	options: HierarchyEntityRowOptions = {}
): HierarchyProjectedRow | null {
	const junction = index.junctionById.get(junctionId);
	if (!junction) return null;
	const incident = index.incidentWallIdsByJunctionId.get(junctionId) ?? [];
	// P23.12 — Junctions are reference-only: the compact reference is the
	// primary label (never a name). D8: the routine inline count is inventory,
	// not disambiguation, so `2 walls` is gone. A branch (3+ Walls) or a
	// dangling end (1) still states its count — that *is* distinguishing, and
	// this row owns no disclosure that would show it instead.
	const routineCount = incident.length === 2;
	return entityRow({
		rowKey,
		label: junction.reference ?? formatPlacementLabel(junction.junctionId),
		entity: junction.entity,
		canonicalId: junction.junctionId,
		occurrence: options.occurrence,
		// Reference-only rows are always reference-led when the token resolved.
		...(junction.reference !== null ? { referenceLed: true } : {}),
		secondary:
			options.secondary ??
			(routineCount ? undefined : `${incident.length} wall${incident.length === 1 ? '' : 's'}`),
		children: options.children,
		actions: options.actions,
		disclosureKey: options.disclosureKey,
		defaultOpen: options.defaultOpen,
		tooltip: options.tooltip
	});
}

/** One document-level Layout Object; `assignmentText` appends the explicit assignment. */
export function hierarchyObjectRow(
	index: HierarchySourceIndex,
	rowKey: string,
	objectId: string,
	options: HierarchyEntityRowOptions & { assignmentText?: boolean } = {}
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
		occurrence: options.occurrence,
		// Explicit `roomId` only — never coordinate/bounds inference.
		secondary:
			options.secondary ??
			(options.assignmentText && assignedRoom ? `assigned to ${assignedRoom.name}` : undefined),
		children: options.children,
		actions: options.actions,
		disclosureKey: options.disclosureKey,
		defaultOpen: options.defaultOpen,
		tooltip: options.tooltip
	});
}

export function hierarchyClusterRow(
	index: HierarchySourceIndex,
	rowKey: string,
	clusterId: string,
	options: HierarchyEntityRowOptions = {}
): HierarchyProjectedRow | null {
	const cluster = index.sceneClusterById.get(clusterId);
	if (!cluster) return null;
	const memberCount = cluster.memberIds.length;
	return entityRow({
		rowKey,
		label: cluster.name,
		entity: cluster.entity,
		canonicalId: cluster.clusterId,
		facet: 'scene-cluster',
		secondary:
			options.secondary ?? `${memberCount} item${memberCount === 1 ? '' : 's'}`,
		children: options.children,
		actions: options.actions,
		disclosureKey: options.disclosureKey,
		defaultOpen: options.defaultOpen,
		tooltip: options.tooltip
	});
}

/**
 * One Scene entity row. A cluster may reference a member the Scene document no
 * longer contains; `options.label` keeps that row renderable rather than
 * silently dropping a membership the cluster still claims.
 */
export function hierarchySceneEntityRow(
	index: HierarchySourceIndex,
	rowKey: string,
	entityId: string,
	options: HierarchyEntityRowOptions & { label?: string } = {}
): HierarchyProjectedRow | null {
	const entity = index.sceneEntityById.get(entityId);
	if (!entity && options.label === undefined) return null;
	return entityRow({
		rowKey,
		label: options.label ?? entity!.name,
		entity: sceneEntityKey(entityId),
		canonicalId: entityId,
		facet: 'scene-entity',
		secondary: options.secondary,
		children: options.children,
		actions: options.actions,
		disclosureKey: options.disclosureKey,
		defaultOpen: options.defaultOpen,
		tooltip: options.tooltip
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

/*
 * P23.14 Decision 4 (owner-ruled) — the per-Wall oriented `Ends <start> · <end>`
 * relation row is REMOVED. Endpoint identity duplicated what the Wall's own
 * disclosure and the `Boundary Junctions (n)` inventory already answer, and a
 * non-selectable relation row sitting under every Wall was the densest noise in
 * the Navigator. The inventories of record are `Boundary Junctions (n)` on the
 * Room page plus the global Junctions page; the `relation` species stays for
 * count/summary rows that carry no entity.
 */
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

	const title = hierarchyRoomRow(index, `room:${roomId}:title`, roomId);
	if (!title) return [];
	const rows: HierarchyProjectedRow[] = [title];

	const boundaryChildren: HierarchyProjectedRow[] = [];
	for (const ref of room.boundary) {
		if (!index.wallById.has(ref.wallId)) continue;
		const wallRowKey = `room:${roomId}:wall:${ref.wallId}`;
		const openings = (index.openingsByWallId.get(ref.wallId) ?? [])
			.map((openingId) =>
				hierarchyOpeningRow(index, `${wallRowKey}:opening:${openingId}`, openingId, {
					occurrence: true
				})
			)
			.filter((row): row is HierarchyProjectedRow => row !== null);
		const others = (index.roomIdsByWallId.get(ref.wallId) ?? []).filter((id) => id !== roomId);
		boundaryChildren.push(
			hierarchyWallRow(index, wallRowKey, ref.wallId, {
				secondary: others.length
					? hierarchyParticipationText(
							'also in',
							others.map((id) => hierarchyRoomName(index, id))
						)
					: undefined,
				disclosureKey: wallRowKey,
				defaultOpen: false,
				// A Wall reached through a Room's Boundary is a contextual
				// occurrence of the canonical Wall (§12.2), and its hosted
				// Openings live in its own disclosure (§11/Decision 4).
				occurrence: true,
				children: openings
			})!
		);
	}
	rows.push(
		sectionRow(
			`room:${roomId}:section:boundary`,
			`Boundary (${boundaryChildren.length} walls)`,
			boundaryChildren,
			{ defaultOpen: true, alwaysOpen: true }
		)
	);

	const junctionIds = boundaryJunctionIds(index, room.boundary);
	rows.push(
		sectionRow(
			`room:${roomId}:section:junctions`,
			`Boundary Junctions (${junctionIds.length})`,
			junctionIds
				.map((junctionId) =>
					hierarchyJunctionRow(index, `room:${roomId}:junction:${junctionId}`, junctionId, {
						occurrence: true
					})
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
					hierarchyObjectRow(index, `room:${roomId}:object:${objectId}`, objectId, {
						occurrence: true
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
			secondaryParts.push(
				hierarchyParticipationText('in', roomIds.map((id) => hierarchyRoomName(index, id)))
			);
		}
		// D8 — the `▸ N openings` inventory count is gone: it is a count, not
		// disambiguation, and the row's disclosure already lists the openings.
		rows.push(
			hierarchyWallRow(index, rowKey, wall.wallId, {
				secondary: secondaryParts.length > 0 ? secondaryParts.join(' · ') : undefined,
				disclosureKey: rowKey,
				defaultOpen: false,
				// Wall-hosted Openings: the Wall is the canonical home for a wall-first
				// Opening, so these rows are occurrences of the Openings-page entities.
				children: openingIds
					.map((openingId) =>
						hierarchyOpeningRow(index, `${rowKey}:opening:${openingId}`, openingId, {
							occurrence: true
						})
					)
					.filter((row): row is HierarchyProjectedRow => row !== null)
			})!
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
		const home = canonicalHierarchyHome(index, opening.entity);
		rows.push(
			hierarchyOpeningRow(index, `openings:opening:${opening.openingId}`, opening.openingId, {
				// Kind + host identity (never the host's raw canonical ID).
				secondary: hierarchyOpeningContext(index, opening.openingId),
				actions: home
					? [
							{
								actionKey: `openings:${opening.openingId}:show-in-walls`,
								label: 'Show in Walls ›',
								destination: home
							}
						]
					: undefined
			})!
		);
	}
	return rows;
}

function buildJunctionsRows(index: HierarchySourceIndex): HierarchyProjectedRow[] {
	return index.orderedJunctions
		.map((junction) =>
			hierarchyJunctionRow(index, `junctions:junction:${junction.junctionId}`, junction.junctionId)
		)
		.filter((row): row is HierarchyProjectedRow => row !== null);
}

function buildLayoutObjectsRows(index: HierarchySourceIndex): HierarchyProjectedRow[] {
	return index.orderedLayoutObjects
		.map((object) =>
			hierarchyObjectRow(index, `layoutObjects:object:${object.objectId}`, object.objectId, {
				assignmentText: true
			})
		)
		.filter((row): row is HierarchyProjectedRow => row !== null);
}

function buildSceneContentRows(index: HierarchySourceIndex): HierarchyProjectedRow[] {
	const rows: HierarchyProjectedRow[] = [];
	for (const cluster of index.orderedSceneClusters) {
		const memberRows: HierarchyProjectedRow[] = cluster.memberIds
			.map((memberId) =>
				hierarchySceneEntityRow(
					index,
					`scene:cluster:${cluster.clusterId}:entity:${memberId}`,
					memberId,
					// A member the Scene document no longer contains stays renderable
					// with its raw id label rather than silently disappearing.
					index.sceneEntityById.has(memberId)
						? undefined
						: { label: formatPlacementLabel(memberId) }
				)
			)
			.filter((row): row is HierarchyProjectedRow => row !== null);
		rows.push(
			hierarchyClusterRow(index, `scene:cluster:${cluster.clusterId}`, cluster.clusterId, {
				disclosureKey: `scene:cluster:${cluster.clusterId}`,
				defaultOpen: true,
				children: memberRows
			})!
		);
	}
	for (const entity of index.orderedSceneEntities) {
		if (index.clusterByMemberId.has(entity.entityId)) continue;
		rows.push(
			hierarchySceneEntityRow(index, `scene:entity:${entity.entityId}`, entity.entityId)!
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

/**
 * Build the representation registry for any row forest (page or search). Keyed
 * by `entity.id`; the first occurrence per entity is `primary`.
 */
export function collectHierarchyRepresentations(
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
	const projected = buildPageRows(index, page, options);
	// P23.14 §12.3 — an empty page states its authored empty/teaching case
	// instead of rendering as a blank column.
	const rows =
		projected.length > 0 ? projected : [hierarchyEmptyRow(`${page.kind}:empty`, pageEmptyLabel(page))];
	const representations = collectHierarchyRepresentations(rows);
	const filtered =
		(options.wallFilter ?? 'all') !== 'all' || (options.openingFilter ?? 'all') !== 'all';
	const unfiltered = filtered
		? collectHierarchyRepresentations(buildPageRows(index, page, {}))
		: representations;
	return {
		page,
		rows,
		representations,
		unfilteredRepresentations: new Set(unfiltered.keys())
	};
}

/**
 * Minimal shape any projection (page or relationship search) shares: the
 * representation registry keyed by `entity.id`.
 */
export type HierarchyRepresentationSet = {
	representations: Map<string, HierarchyRepresentation[]>;
};

/** Primary representation when one exists, otherwise the first. Pure lookup. */
export function findHierarchyRepresentation(
	projection: HierarchyRepresentationSet,
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
	current: HierarchyRepresentationSet;
	base: HierarchyRepresentationSet;
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

/**
 * Display reference for one entity, byte-identical to the label its canonical row
 * uses (`formatPlacementLabel(id)`, or the authored Room/cluster/entity name).
 * Never an invented ordinal (gate 1).
 */
export function hierarchyEntityLabel(
	index: HierarchySourceIndex,
	entity: HierarchyEntityKey
): string {
	return hierarchyEntityPresentation(index, entity).label;
}

/**
 * The pin's two fields, taken from the one shared pair (the row-only
 * `referenceLed` flag stays out of this shape).
 */
function presentationPair(
	identity: IdentityView,
	fallback: string
): { label: string; reference: string | null } {
	const { label, reference } = identityLabelPair(identity, fallback);
	return { label, reference };
}

/**
 * P23.12 D5 — the ONE identity presentation for an entity key: the same
 * `identityLabelPair` composition the row builders use, so a pinned selection
 * and its row can never disagree about the tier order or about the
 * duplicate-collapse rule. A row and the pin previously re-derived the tiers
 * separately, which is how a Wall/Opening/Room whose name equals its own
 * reference rendered the token twice in the pin while the row was correct.
 */
export function hierarchyEntityPresentation(
	index: HierarchySourceIndex,
	entity: HierarchyEntityKey
): { label: string; reference: string | null } {
	switch (entity.kind) {
		case 'room': {
			const room = index.roomById.get(entity.roomId);
			if (!room) return { label: formatPlacementLabel(entity.roomId), reference: null };
			return presentationPair(sourceIdentity(room), formatPlacementLabel(room.roomId));
		}
		case 'wall': {
			// Authored name leads; an unnamed Wall is reference-led.
			const wall = index.wallById.get(entity.wallId);
			if (!wall) return { label: formatPlacementLabel(entity.wallId), reference: null };
			return presentationPair(sourceIdentity(wall), formatPlacementLabel(wall.wallId));
		}
		case 'opening': {
			const opening = index.openingById.get(entity.openingId);
			if (!opening) {
				return { label: formatPlacementLabel(entity.openingId), reference: null };
			}
			return presentationPair(sourceIdentity(opening), formatPlacementLabel(opening.openingId));
		}
		case 'junction': {
			// Reference-only: the label already IS the reference.
			const junction = index.junctionById.get(entity.junctionId);
			return {
				label: junction?.reference ?? formatPlacementLabel(entity.junctionId),
				reference: null
			};
		}
		case 'object':
			return { label: formatPlacementLabel(entity.objectId), reference: null };
		case 'cluster': {
			const cluster = index.sceneClusterById.get(entity.clusterId);
			return { label: cluster?.name ?? formatPlacementLabel(entity.clusterId), reference: null };
		}
		case 'entity': {
			const sceneEntity = index.sceneEntityById.get(entity.entityId);
			return {
				label: sceneEntity?.name ?? formatPlacementLabel(entity.entityId),
				reference: null
			};
		}
	}
}

/**
 * P23.12 — the protected reference span for a pinned selection: the same
 * compact token a row shows beside a primary authored name. `null` when the
 * label already *is* the reference (unnamed Wall/Opening, Junction) or when
 * the document carries no ledger, so the pin never repeats itself.
 */
export function hierarchyEntityReference(
	index: HierarchySourceIndex,
	entity: HierarchyEntityKey
): string | null {
	return hierarchyEntityPresentation(index, entity).reference;
}

/** The human name of a canonical `Show in…` home (`Walls`, `Junctions`, …). */
export function hierarchyHomeLabel(home: HierarchyDestination): string {
	switch (home.page.kind) {
		case 'rooms':
			return 'Rooms';
		case 'walls':
			return 'Walls';
		case 'junctions':
			return 'Junctions';
		case 'layoutObjects':
			return 'Layout Objects';
		case 'sceneContent':
			return 'Scene Content';
		default:
			return 'Hierarchy';
	}
}

/** Page entries the renderer distinguishes for reveal purposes (plan §History). */
export type HierarchyTransitionKind = 'ordinary-entry' | 'history-restore' | 'show-in';

/**
 * One render cycle's reveal inputs, in the exact order selection, page and
 * disclosure last changed. The renderer keeps the previous observation and asks
 * `evaluateHierarchyReveal` what (if anything) this cycle owes the user.
 *
 * `userDisclosureRevision` counts **user** disclosure gestures only; automatic
 * `revealDisclosure` writes must not bump it, or the reveal would re-trigger
 * itself.
 */
export type HierarchyRevealObservation = {
	transitionRevision: number;
	transitionKind: HierarchyTransitionKind;
	/** Exact canonical row of an explicit `Show in…`, else null. */
	targetRowKey: string | null;
	/** Ancestors an explicit `Show in…` target needs, in root→leaf order. */
	targetAncestorDisclosureKeys: readonly string[];
	/** Canonical selected entity id, or null when nothing is selected. */
	selectionId: string | null;
	/** Exact active-page representation row key, or null when excluded. */
	representedRowKey: string | null;
	/** Ancestors the *selection's* representation needs before its row exists. */
	ancestorDisclosureKeys: readonly string[];
	/** Monotonic count of user disclosure gestures. */
	userDisclosureRevision: number;
};

/**
 * What one reveal cycle should do. `restore-scroll` is deliberately distinct
 * from `none`: ordinary page entry and history restore put the viewport back to
 * the entry's own saved scroll and never chase the pre-existing selection.
 */
export type HierarchyRevealDecision =
	| { kind: 'none' }
	| { kind: 'restore-scroll' }
	| { kind: 'reveal'; disclose: string[]; scrollTo: string }
	| { kind: 'scroll'; scrollTo: string };

/**
 * Pure, event/cause-aware reveal decision (plan §Representation, reveal, and
 * pinned selection). Rows under collapsed ancestors and rows outside the
 * viewport still count as represented, so only the projection decides.
 *
 * Reveal is scheduled for exactly four causes:
 * 1. an explicit `show-in` transition carrying a canonical target;
 * 2. a genuine canonical selection identity change that is represented;
 * 3. a same-page excluded → represented transition for the unchanged selection;
 * 4. a canonical edit that moved the selection to a different primary row.
 *
 * `show-in` reveals the target it carries — its row and its own ancestor chain —
 * and is therefore **independent of the active selection**: an explicit action
 * must work with nothing selected and must never disclose another entity's
 * ancestors.
 *
 * A user disclosure expansion scrolls only — it never re-expands anything — and
 * ordinary page entry / history restore restore their own scroll instead.
 */
export function evaluateHierarchyReveal(
	previous: HierarchyRevealObservation,
	current: HierarchyRevealObservation
): HierarchyRevealDecision {
	// Page-entry event: the only reveal is an explicit Show in… target.
	if (current.transitionRevision !== previous.transitionRevision) {
		if (current.transitionKind === 'show-in' && current.targetRowKey !== null) {
			// The target's own chain, never the selection's: the user asked for
			// this row, and the selection may be absent or unrelated.
			return {
				kind: 'reveal',
				disclose: [...current.targetAncestorDisclosureKeys],
				scrollTo: current.targetRowKey
			};
		}
		return { kind: 'restore-scroll' };
	}

	// Manual disclosure gesture: scroll to the selection the user just rendered,
	// and never auto-expand a sibling or an inventory.
	if (
		current.userDisclosureRevision !== previous.userDisclosureRevision &&
		current.selectionId === previous.selectionId &&
		current.representedRowKey !== null
	) {
		return { kind: 'scroll', scrollTo: current.representedRowKey };
	}

	if (current.selectionId === null) return { kind: 'none' };
	if (current.representedRowKey === null) return { kind: 'none' };

	// Genuine selection change that is represented on the active page.
	if (current.selectionId !== previous.selectionId) {
		return {
			kind: 'reveal',
			disclose: [...current.ancestorDisclosureKeys],
			scrollTo: current.representedRowKey
		};
	}

	// Same selection, newly (or differently) represented: Clear search/filter, or
	// a canonical edit that changed its primary representation row.
	if (
		previous.representedRowKey === null ||
		previous.representedRowKey !== current.representedRowKey
	) {
		return {
			kind: 'reveal',
			disclose: [...current.ancestorDisclosureKeys],
			scrollTo: current.representedRowKey
		};
	}

	return { kind: 'none' };
}
