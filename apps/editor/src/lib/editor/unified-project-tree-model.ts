/**
 * pure unified-project-tree model + selection matchers.
 *
 * One hierarchy over both documents, never a merged identity type. This module
 * is deliberately renderer-neutral: **no Three/DOM/Svelte imports** (same rule
 * as `$lib/layout/**`). The tree component renders the model; the matchers
 * decide row highlight/interactivity.
 *
 * Row identity is **exactly** the identity the selection types use
 * (`LayoutSelection`, `WorkspaceSelection`, `NavigationSelection`) so
 * selection matching is exact, never coordinate- or index-guessed.
 *
 * Camera connection/direction rows are not modeled here: the tree embeds the
 * existing `CameraFlowPanel` (P1.9 — row expansion is a flat neighbor list
 * derived from `getNodeConnections`; connection detail lives in the
 * Connections section / Inspector / Timeline). The matcher still pins the
 * camera row contract (and the discovery-driven direction-row rule) for tests.
 */

import type { LayoutDocument, LayoutVec2 } from '$lib/layout/layout-types';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-types';
import type { SceneDocument } from '$lib/content/scene';
import type { CameraConnectionDirection } from '$lib/types/scene';
import type { LayoutSelection, PlanViewMode } from './layout/layout-interaction';
import type { WorkspaceSelection, NavigationSelection } from './editor-types';
import type { ActiveEditorSelection } from './app/active-editor-selection.svelte';
import type { EditorDomain } from './app/editor-view-state.svelte';
import type { EditorViewMode } from './app/editor-view-mode';

export type UnifiedTreeRow =
	| { kind: 'room'; roomId: string }
	| { kind: 'wall'; roomId: string; segmentId: string }
	| { kind: 'opening'; roomId: string; segmentId: string; openingId: string }
	| { kind: 'interiorAnchor'; roomId: string; segmentId: string; anchorId: string }
	| { kind: 'object'; objectId: string }
	| { kind: 'cluster'; clusterId: string }
	| { kind: 'entity'; entityId: string }
	/**
	 * P23.6b — canonical wall-first rows. Row identity is **exactly** the
	 * identity the canonical selection slots use (`physicalWall` /
	 * `wallOpening` / `junction`), so a tree row selects through the one
	 * selection authority and never fabricates a room-qualified identity.
	 */
	| { kind: 'physicalWall'; wallId: string }
	| { kind: 'wallOpening'; wallId: string; openingId: string }
	| { kind: 'junction'; junctionId: string }
	| { kind: 'camera-node'; nodeId: string }
	| { kind: 'camera-connection'; connectionId: string }
	| { kind: 'camera-direction'; connectionId: string; direction: CameraConnectionDirection }
	| { kind: 'camera-keyframe'; connectionId: string; direction: CameraConnectionDirection; keyframeId: string };

/**
 * Camera **discovery** slots (`store.activeCameraConnectionId` /
 * `activeCameraDirection` = the reducer's `discoveryConnectionId` /
 * `discoveryDirection`). The camera selection type's public surface omits
 * direction — "discovery owns it" — so direction rows are discovery-driven.
 * Discovery can be set with **no** navigation selection at all (timeline
 * scrubbing), hence the explicit slot.
 */
export type UnifiedTreeDiscovery = {
	connectionId: string | null;
	direction: CameraConnectionDirection;
};

export type UnifiedTreeWall = {
	roomId: string;
	segmentId: string;
	kind: 'line' | 'auto-bezier';
	anchors: { roomId: string; segmentId: string; anchorId: string }[];
};

export type UnifiedTreeOpening = {
	roomId: string;
	segmentId: string;
	openingId: string;
	kind: 'door' | 'window';
};

export type UnifiedTreeObject = {
	objectId: string;
	kind: 'box' | 'plane' | 'cylinder' | 'sphere' | 'profile';
};

export type UnifiedTreeCluster = {
	clusterId: string;
	name: string;
	memberIds: string[];
};

export type UnifiedTreeEntity = {
	entityId: string;
	name: string;
};

export type UnifiedTreeRoom = {
	roomId: string;
	name: string;
	walls: UnifiedTreeWall[];
	openings: UnifiedTreeOpening[];
	objects: UnifiedTreeObject[];
	clusters: UnifiedTreeCluster[];
	entities: UnifiedTreeEntity[];
};

export type UnifiedTreeCameraTour = {
	guidedNodeIds: string[];
	freeNodeIds: string[];
};

/**
 * P23.3 — one canonical wall-first Room.
 *
 * Deliberately NOT a `UnifiedTreeRoom`: those rows carry the legacy
 * `(roomId, segmentId)` identity, and a wall-first Room's boundary references
 * document-global Walls by `wallId`. Reusing the legacy rows would have
 * fabricated a segment id for a canonical Wall, which is exactly the fake
 * identity the wall-first schema removes.
 *
 * P23.6b — the bucket is no longer read-only-only: its `roomId` **is** the
 * canonical `{ kind: 'room', roomId }` selection identity, so wall-first Room
 * rows are interactive tree rows that select through `selectLayoutRoom`.
 */
export type UnifiedWallFirstRoom = {
	roomId: string;
	name: string;
	/** Document-global Wall IDs on this Room's boundary, in boundary order. */
	wallIds: string[];
	/** Canonical Openings hosted by those Walls. */
	openingIds: string[];
};

/**
 * P23.6b — one canonical Architecture row per **document-global** Wall
 * (`layout.walls` order, never per Room). Openings nest under their single
 * host Wall; boundary participation is a relation (`boundedRoomIds`), never
 * ownership. Walls carry the authoritative P23.6H/P23.6I per-Wall `height`.
 */
export type UnifiedTreeWallRow = {
	wallId: string;
	role: 'boundary' | 'partition';
	height: number;
	/** Host-nested canonical Openings in `layout.openings` document order. */
	openings: { openingId: string; kind: 'door' | 'window' }[];
	/** Rooms whose boundary references this Wall (relation only). */
	boundedRoomIds: string[];
};

/**
 * P23.6b — canonical Junction row for the disclosed `Topology…` surface.
 * Junctions are never resting clutter: they live behind the disclosure and
 * stay reachable through canvas, search and selected-Wall endpoint relations.
 */
export type UnifiedTreeJunctionRow = {
	junctionId: string;
	point: LayoutVec2;
};

/**
 * P23.6b — Scene-owned content in the shared hierarchy (D6). One hierarchy
 * over two documents is not one document: Scene rows route to the Scene
 * (workspace) selection slot, never `LayoutSelection`.
 */
export type UnifiedTreeSceneContent = {
	clusters: UnifiedTreeCluster[];
	/** Standalone entities (cluster members render inside their cluster). */
	entities: UnifiedTreeEntity[];
};

export type UnifiedProjectTreeModel = {
	rooms: UnifiedTreeRoom[];
	wallFirstRooms: UnifiedWallFirstRoom[];
	/**
	 * P23.6b — canonical document-level roots. Populated for wall-first
	 * documents only; the legacy compatibility branch returns empty roots and
	 * the component renders no empty groups (§Format-gated legacy policy —
	 * legacy objects/entities already nest under their Rooms, and populating
	 * the roots for legacy documents would render them twice).
	 */
	architecture: {
		walls: UnifiedTreeWallRow[];
		junctions: UnifiedTreeJunctionRow[];
	};
	layoutObjects: UnifiedTreeObject[];
	sceneContent: UnifiedTreeSceneContent;
	cameraTour: UnifiedTreeCameraTour;
};

/**
 * Build the tree model. Rooms come from the layout in **document order**
 * (floors flatMap rooms for legacy; top-level `rooms` for wall-first). Scene
 * clusters/entities nest under the room whose explicit `roomId` matches;
 * content whose `roomId` names no layout room is left out of every room —
 * never silently attached (the umbrella's "geometry never guesses
 * ownership"). Layout objects nest under their explicit `roomId`; unowned
 * objects are not shown in the tree (the inspector's object list still reaches
 * them). Camera nodes stay under the Camera Tour root (guided chain in order +
 * free nodes) — never nested under rooms.
 *
 * Wall-first documents fill `wallFirstRooms` instead of `rooms`: the sidebar
 * must count and list canonical Rooms (a new project boots wall-first, so
 * reporting zero Rooms for a document that has them is simply wrong), while
 * the canonical Walls/Openings keep their `wallId` identity rather than being
 * squeezed into the legacy `segmentId` rows.
 */
export function buildUnifiedProjectTreeModel(input: {
		// Both document formats reach this pure builder; `'formatVersion' in
		// layout` is the discriminator (same rule the codecs dispatch on).
		layout: LayoutDocument | LayoutDocumentWallFirst;
		scene: SceneDocument;
		guidedTourNodeIds: string[];
	}): UnifiedProjectTreeModel {
		const { layout, scene } = input;
		const guided = new Set(input.guidedTourNodeIds);
		const cameraTour: UnifiedTreeCameraTour = {
			guidedNodeIds: [...input.guidedTourNodeIds],
			freeNodeIds: scene.navigationNodes
				.map((node) => node.id)
				.filter((nodeId) => !guided.has(nodeId))
		};
		// P23.3 — canonical wall-first Rooms, keyed by document-global Wall/
		// Opening ids. Read-only rows until the canonical tree cutover.
		if ('formatVersion' in layout) {
			const openingIdsByWall = new Map<string, string[]>();
			for (const opening of layout.openings) {
				const hosted = openingIdsByWall.get(opening.wallId);
				if (hosted) hosted.push(opening.id);
				else openingIdsByWall.set(opening.wallId, [opening.id]);
			}
			const wallIdsInDocument = new Set(layout.walls.map((wall) => wall.id));
			const wallFirstRooms: UnifiedWallFirstRoom[] = layout.rooms.map((room) => {
				// `boundary` is a flat list of directed Wall refs (no Path wrapper);
				// a ref may dangle while a topology edit is mid-flight, so surface
				// only Walls that still exist.
				const wallIds = room.boundary
					.map((ref) => ref.wallId)
					.filter((wallId) => wallIdsInDocument.has(wallId));
			return {
				roomId: room.id,
				name: room.name,
				wallIds,
				openingIds: wallIds.flatMap((wallId) => openingIdsByWall.get(wallId) ?? [])
			};
		});
		// P23.6b — canonical document-level roots (D1/D2/D3/D5/D6). Walls come
		// from `layout.walls` (one row per physical Wall, document order), never
		// from `wallFirstRooms[].wallIds`; Openings group by host in
		// `layout.openings` order; boundary participation is collected as a
		// relation. All orderings are deterministic document order (D9).
		const openingsByWall = new Map<string, { openingId: string; kind: 'door' | 'window' }[]>();
		for (const opening of layout.openings) {
			const hosted = openingsByWall.get(opening.wallId);
			const row = { openingId: opening.id, kind: opening.kind };
			if (hosted) hosted.push(row);
			else openingsByWall.set(opening.wallId, [row]);
		}
		const boundedRoomIdsByWall = new Map<string, string[]>();
		for (const room of layout.rooms) {
			for (const ref of room.boundary) {
				if (!wallIdsInDocument.has(ref.wallId)) continue;
				const bounded = boundedRoomIdsByWall.get(ref.wallId);
				if (bounded) {
					if (!bounded.includes(room.id)) bounded.push(room.id);
				} else {
					boundedRoomIdsByWall.set(ref.wallId, [room.id]);
				}
			}
		}
		const architecture = {
			walls: layout.walls.map((wall) => ({
				wallId: wall.id,
				role: wall.role,
				height: wall.height,
				openings: openingsByWall.get(wall.id) ?? [],
				boundedRoomIds: boundedRoomIdsByWall.get(wall.id) ?? []
			})),
			junctions: layout.junctions.map((junction) => ({
				junctionId: junction.id,
				point: [...junction.point] as LayoutVec2
			}))
		};
		const layoutObjects: UnifiedTreeObject[] = layout.objects.map((object) => ({
			objectId: object.id,
			kind: object.kind
		}));
		const clusteredMemberIds = new Set(
			(scene.clusters ?? []).flatMap((cluster) => cluster.memberIds)
		);
		const sceneContent: UnifiedTreeSceneContent = {
			clusters: (scene.clusters ?? []).map((cluster) => ({
				clusterId: cluster.id,
				name: cluster.name,
				memberIds: [...cluster.memberIds]
			})),
			entities: scene.entities
				.filter((entity) => !clusteredMemberIds.has(entity.id))
				.map((entity) => ({ entityId: entity.id, name: entity.name }))
		};
		return { rooms: [], wallFirstRooms, architecture, layoutObjects, sceneContent, cameraTour };
	}

		const rooms: UnifiedTreeRoom[] = layout.floors.flatMap((floor) =>
		floor.rooms.map((room): UnifiedTreeRoom => ({
			roomId: room.id,
			name: room.name,
			walls: room.boundary.segments.map((segment) => ({
				roomId: room.id,
				segmentId: segment.id,
				kind: segment.kind,
				anchors:
					segment.kind === 'auto-bezier'
						? segment.interiorAnchors.map((anchor) => ({
								roomId: room.id,
								segmentId: segment.id,
								anchorId: anchor.id
							}))
						: []
			})),
			openings: room.openings.map((opening) => ({
				roomId: room.id,
				segmentId: opening.segmentId,
				openingId: opening.id,
				kind: opening.kind
			})),
			objects: layout.objects
				.filter((object) => object.roomId === room.id)
				.map((object) => ({ objectId: object.id, kind: object.kind })),
			clusters: (scene.clusters ?? [])
				.filter((cluster) => cluster.roomId === room.id)
				.map((cluster) => ({
					clusterId: cluster.id,
					name: cluster.name,
					memberIds: [...cluster.memberIds]
				})),
			entities: scene.entities
				.filter((entity) => entity.roomId === room.id)
				.map((entity) => ({ entityId: entity.id, name: entity.name }))
		}))
	);

	// P23.6b — legacy compatibility projection: the Room-nested shape stays
	// exactly as today (objects/clusters/entities nest inside `UnifiedTreeRoom`)
	// and the canonical document-level roots stay **empty** so nothing renders
	// twice. Legacy hierarchy retirement is tracked post-P23 by Issue #26.
	return {
		rooms,
		wallFirstRooms: [],
		architecture: { walls: [], junctions: [] },
		layoutObjects: [],
		sceneContent: { clusters: [], entities: [] },
		cameraTour
	};
}

/**
 * Narrow a tree model by a case-insensitive substring query. A row is kept
 * when its own searchable text matches, **or** when any descendant matches —
 * so a matched wall/opening/entity stays reachable under its surviving room
 * (and matched cluster members keep their cluster). Cluster members are
 * matched by their entity name (resolved from the room's own entity list) or
 * id; standalone entities match name + id. An empty/whitespace query returns
 * the model untouched. Camera rows are intentionally not modeled here (the
 * tree embeds `CameraFlowPanel`), so the camera-tour slot is carried through
 * unchanged.
 *
 * `resolveEntityName` is an optional pure lookup for Scene cluster members:
 * the wall-first projection deliberately removes cluster members from
 * `sceneContent.entities` (no double render), so without a resolver their
 * display names are unreachable and a search for "Grand Piano" would miss a
 * clustered member that shows exactly that label. The component passes its
 * own `sceneEntitiesById` read; tests that build models standalone keep the
 * id-only fallback.
 */
export function filterUnifiedProjectTreeModel(
	model: UnifiedProjectTreeModel,
	query: string,
	resolveEntityName: (entityId: string) => string | undefined = () => undefined
): UnifiedProjectTreeModel {
	const needle = query.trim().toLowerCase();
	if (!needle) return model;
	const matches = (...texts: (string | undefined)[]) =>
		texts.some((text) => text !== undefined && text.toLowerCase().includes(needle));

	const rooms = model.rooms
		.map((room) => {
			const memberName = (memberId: string) =>
				room.entities.find((entity) => entity.entityId === memberId)?.name;

			const walls = room.walls.filter(
				(wall) =>
					matches(`wall · ${wall.segmentId}`, wall.segmentId) ||
					wall.anchors.some((anchor) =>
						matches(`bend anchor · ${anchor.anchorId}`, anchor.anchorId)
					)
			);
			const openings = room.openings.filter((opening) =>
				matches(opening.kind, opening.openingId)
			);
			const objects = room.objects.filter((object) =>
				matches(object.kind, object.objectId)
			);
			const clusters = room.clusters
				.map((cluster) => ({
					...cluster,
					memberIds: cluster.memberIds.filter((memberId) =>
						matches(memberName(memberId), memberId)
					)
				}))
				.filter(
					(cluster) =>
						matches(cluster.name, cluster.clusterId) || cluster.memberIds.length > 0
				);
			const entities = room.entities.filter((entity) =>
				matches(entity.name, entity.entityId)
			);
			const selfMatches = matches(room.name, room.roomId);
			const hasSurvivingChildren =
				walls.length > 0 ||
				openings.length > 0 ||
				objects.length > 0 ||
				clusters.length > 0 ||
				entities.length > 0;
			if (!selfMatches && !hasSurvivingChildren) return null;
			return { ...room, walls, openings, objects, clusters, entities };
		})
		.filter((room): room is UnifiedTreeRoom => room !== null);

	// Canonical Rooms match on their own name/id, or on any boundary Wall or
	// hosted Opening they own — so a Wall/Opening hit keeps them reachable.
	const wallFirstRooms = model.wallFirstRooms.filter(
		(room) =>
			matches(room.name, room.roomId) ||
			room.wallIds.some((wallId) => matches(wallId)) ||
			room.openingIds.some((openingId) => matches(openingId))
	);

	// P23.6b — canonical Architecture rows survive a matching self or
	// descendant term: a matched Opening keeps its host Wall, a matched Wall
	// keeps the Architecture group reachable. Junctions match id + label.
	const architecture = {
		walls: model.architecture.walls
			.map((wall) => ({
				...wall,
				openings: wall.openings.filter((opening) =>
					matches(opening.kind, opening.openingId)
				)
			}))
			.filter(
				(wall) =>
					matches('wall', wall.wallId) ||
					matches(wall.role) ||
					wall.openings.length > 0
			),
		junctions: model.architecture.junctions.filter(
			(junction) => matches('junction', junction.junctionId)
		)
	};

	const layoutObjects = model.layoutObjects.filter((object) =>
		matches(object.kind, object.objectId)
	);

	// Scene rows match name + id; a matched cluster keeps its matching members.
	// Cluster members resolve their display label through `resolveEntityName`
	// (see above) — the projection excludes them from `sceneContent.entities`.
	const sceneClusters = model.sceneContent.clusters
		.map((cluster) => ({
			...cluster,
			memberIds: cluster.memberIds.filter((memberId) =>
				matches(
					resolveEntityName(memberId),
					memberId
				)
			)
		}))
		.filter(
			(cluster) => matches(cluster.name, cluster.clusterId) || cluster.memberIds.length > 0
		);
	const sceneEntities = model.sceneContent.entities.filter((entity) =>
		matches(entity.name, entity.entityId)
	);

	// The Walls/Topology subgroup split is presentation IA (D1): the model
	// carries the two row collections; the component renders the `Walls`
	// disclosure and keeps `Topology…` as its sibling under Architecture.
	return {
		rooms,
		wallFirstRooms,
		architecture,
		layoutObjects,
		sceneContent: { clusters: sceneClusters, entities: sceneEntities },
		cameraTour: model.cameraTour
	};
}

/**
 * Does the active selection highlight this row? Domain-first: layout rows
 * match `active.selection` exactly; scene rows match the workspace slot;
 * camera rows match `navigation`. The **room row** additionally highlights on
 * room-only *latent* context — but that derives to `active.domain === 'none'`
 * (S3: room-only placement is context, never actionable), so the pure matcher
 * cannot see it. The tree component therefore ORs `store.selectedRoomId ===
 * row.roomId` onto the room-row result (the same read the relic scene tree
 * uses) — documented here so the split stays intentional.
 *
 * **Direction rows are discovery-driven, gated to camera-or-none domain.**
 * `active.domain === 'camera'` highlights the selected direction; with
 * `active.domain === 'none'` a discovery match still highlights (scrub
 * highlight preserved). A layout/scene selection never co-highlights a camera
 * row — one highlighted domain per view, even though discovery itself may
 * persist per the S3 invariant.
 */
export function isUnifiedTreeRowSelected(
	active: ActiveEditorSelection,
	discovery: UnifiedTreeDiscovery | null,
	row: UnifiedTreeRow
): boolean {
	switch (row.kind) {
		case 'room': {
			if (active.domain === 'layout' && active.selection.kind === 'room') {
				return active.selection.roomId === row.roomId;
			}
			if (active.domain === 'scene') {
				const selection = active.selection;
				return (
					(selection.kind === 'placement' || selection.kind === 'cluster') &&
					selection.roomId === row.roomId
				);
			}
			return false;
		}
		case 'wall':
			return (
				active.domain === 'layout' &&
				active.selection.kind === 'wall' &&
				active.selection.roomId === row.roomId &&
				active.selection.segmentId === row.segmentId
			);
		case 'opening':
			return (
				active.domain === 'layout' &&
				active.selection.kind === 'opening' &&
				active.selection.roomId === row.roomId &&
				active.selection.segmentId === row.segmentId &&
				active.selection.openingId === row.openingId
			);
		case 'interiorAnchor':
			return (
				active.domain === 'layout' &&
				active.selection.kind === 'interiorAnchor' &&
				active.selection.roomId === row.roomId &&
				active.selection.segmentId === row.segmentId &&
				active.selection.anchorId === row.anchorId
			);
		case 'object':
			return (
				active.domain === 'layout' &&
				active.selection.kind === 'object' &&
				active.selection.objectId === row.objectId
			);
		case 'cluster':
			return (
				active.domain === 'scene' &&
				active.selection.kind === 'cluster' &&
				active.selection.clusterId === row.clusterId
			);
		case 'entity':
			return (
				active.domain === 'scene' &&
				active.selection.kind === 'placement' &&
				active.selection.ids.includes(row.entityId)
			);
		case 'camera-node':
			return (
				active.domain === 'camera' &&
				active.selection.kind === 'node' &&
				active.selection.nodeId === row.nodeId
			);
		case 'camera-connection': {
			if (active.domain !== 'camera') return false;
			const selection = active.selection;
			return (
				selection.kind === 'connection' ||
				selection.kind === 'anchor' ||
				selection.kind === 'view-keyframe'
			) && selection.connectionId === row.connectionId;
		}
		case 'camera-direction': {
			if (active.domain === 'camera') {
				const selection = active.selection;
				if (selection.kind === 'connection') {
					return (
						selection.connectionId === row.connectionId &&
						selection.direction === row.direction
					);
				}
				if (selection.kind === 'view-keyframe') {
					return (
						selection.connectionId === row.connectionId &&
						selection.direction === row.direction
					);
				}
				if (selection.kind === 'anchor') {
					// Direction rows are discovery-driven: the anchor selection
					// pins the connection, but the direction (and its connection)
					// must agree with discovery — otherwise a scrubbed direction
					// on a different connection would co-highlight this row.
					return (
						selection.connectionId === row.connectionId &&
						discovery?.connectionId === row.connectionId &&
						discovery?.direction === row.direction
					);
				}
				return false;
			}
			if (active.domain === 'none') {
				return (
					discovery !== null &&
					discovery.connectionId === row.connectionId &&
					discovery.direction === row.direction
				);
			}
			return false;
		}
		case 'camera-keyframe':
			return (
				active.domain === 'camera' &&
				active.selection.kind === 'view-keyframe' &&
				active.selection.connectionId === row.connectionId &&
				active.selection.direction === row.direction &&
				active.selection.keyframeId === row.keyframeId
			);
		case 'physicalWall':
			return (
				active.domain === 'layout' &&
				active.selection.kind === 'physicalWall' &&
				active.selection.wallId === row.wallId
			);
		case 'wallOpening':
			return (
				active.domain === 'layout' &&
				active.selection.kind === 'wallOpening' &&
				active.selection.wallId === row.wallId &&
				active.selection.openingId === row.openingId
			);
		case 'junction':
			return (
				active.domain === 'layout' &&
				active.selection.kind === 'junction' &&
				active.selection.junctionId === row.junctionId
			);
	}
}

/**
 * Domain×view-aware pick gating (P1.1, G1). One predicate over the shell's
 * two axes:
 *
 * - **layout rows** (room/wall/opening/anchor/object) are interactive in Scene
 *   3D and Scene Plan Layout mode. Staging keeps them visible but inert.
 * - **scene rows** (cluster/entity) are interactive in Scene 3D and Scene Plan
 *   Staging mode. Layout mode keeps them visible but inert.
 * - **camera rows** are interactive in the Camera domain, both views (the
 *   tree embeds the live `CameraFlowPanel`; its own `interactive` prop keys
 *   off the camera-domain rule).
 *
 * Read-only rows stay `aria-disabled` no-ops; they never activate a domain
 * outside their own.
 */
export function isUnifiedTreeRowInteractive(
	row: UnifiedTreeRow,
	domain: EditorDomain,
	view: EditorViewMode,
	planViewMode: PlanViewMode = 'layout'
): boolean {
	const scene3d = domain === 'scene' && view === '3d';
	const scenePlanLayout = domain === 'scene' && view === 'plan' && planViewMode === 'layout';
	const scenePlanStaging = domain === 'scene' && view === 'plan' && planViewMode === 'staging';
	switch (row.kind) {
		case 'camera-node':
		case 'camera-connection':
		case 'camera-direction':
		case 'camera-keyframe':
			return domain === 'camera';
		case 'room':
		case 'wall':
		case 'opening':
		case 'interiorAnchor':
		// P23.6b — canonical Wall/Opening/Junction rows follow the existing
		// structural gating: interactive in Scene 3D and Scene Plan Layout,
		// inert in Staging (structural selections stay memory there) and never
		// active in the Camera domain.
		case 'physicalWall':
		case 'wallOpening':
		case 'junction':
			return scene3d || scenePlanLayout;
		case 'object':
			// P10 — Arrange (staging) makes Layout-object rows interactive too;
			// structural rows stay inert (read-only Arrange context).
			return scene3d || scenePlanLayout || scenePlanStaging;
		default:
			return scene3d || scenePlanStaging;
	}
}

/**
 * The layout room an active layout selection lives in — the ancestor chain the
 * tree must expand to reveal the picked row. Room/wall/opening/anchor
 * selections carry `roomId`; an object selection is the one qualified identity
 * without a room, so it resolves through the layout document (unowned objects
 * resolve to `null` and are not shown in the tree anyway).
 */
export function layoutSelectionAncestorRoomId(
	selection: LayoutSelection,
	layout: LayoutDocument
): string | null {
	switch (selection.kind) {
		case 'room':
		case 'wall':
		case 'opening':
		case 'interiorAnchor':
			return selection.roomId;
		case 'object':
			return (
				layout.objects.find((object) => object.id === selection.objectId)?.roomId ?? null
			);
		// P23.3 canonical wall-first Opening selection has no Room ancestor.
		// P23.6 canonical Wall/Junction selections have none either. The
		// behavior is itself a pinned contract (P23.6b): canonical reveal is
		// `layoutSelectionRevealTarget`'s job, not this helper's.
		case 'wallOpening':
		case 'physicalWall':
		case 'junction':
		case 'none':
			return null;
	}
}

/**
 * P23.6b — the tree reveal target for a canonical wall-first selection: a
 * pure **presentation projection** naming the ancestors to expand and the row
 * to scroll to. It is **not** a second selected-entity authority: it never
 * selects, never edits and never persists. Junction selections reveal through
 * the disclosed Topology surface **without** expanding the whole inventory.
 */
export type LayoutTreeRevealTarget =
	| { group: 'rooms'; roomId: string }
	| { group: 'architecture'; wallId: string }
	| { group: 'architecture'; wallId: string; openingId: string }
	| { group: 'topology'; junctionId: string }
	| { group: 'layoutObjects'; objectId: string }
	| { group: 'scene' }
	| { group: 'camera' };

export function layoutSelectionRevealTarget(
	selection: LayoutSelection,
	layout: LayoutDocument | LayoutDocumentWallFirst
): LayoutTreeRevealTarget | null {
	switch (selection.kind) {
		case 'room':
			return { group: 'rooms', roomId: selection.roomId };
		case 'physicalWall':
			return { group: 'architecture', wallId: selection.wallId };
		case 'wallOpening':
			return { group: 'architecture', wallId: selection.wallId, openingId: selection.openingId };
		case 'junction':
			return { group: 'topology', junctionId: selection.junctionId };
		case 'object': {
			// A wall-first document has no `floors`; object reveal targets the
			// document-level Layout Objects root. A legacy object with an
			// explicit `roomId` still reveals through its Room (the legacy
			// projection nests it there) — resolve through whichever branch owns
			// it, never from coordinates.
			if ('formatVersion' in layout) {
				return layout.objects.some((object) => object.id === selection.objectId)
					? { group: 'layoutObjects', objectId: selection.objectId }
					: null;
			}
			const legacyRoomId = layoutSelectionAncestorRoomId(selection, layout);
			return legacyRoomId ? { group: 'rooms', roomId: legacyRoomId } : null;
		}
		// Legacy Room-qualified selections keep `layoutSelectionAncestorRoomId`
		// as their reveal path (the component already handles them); this helper
		// adds no parallel meaning for them.
		case 'wall':
		case 'opening':
		case 'interiorAnchor':
		case 'none':
			return null;
	}
}

/** Qualified-identity helper for tests (row ↔ LayoutSelection). */
export function layoutRowToSelection(row: UnifiedTreeRow): LayoutSelection | null {
	switch (row.kind) {
		case 'room':
			return { kind: 'room', roomId: row.roomId };
		case 'wall':
			return { kind: 'wall', roomId: row.roomId, segmentId: row.segmentId };
		case 'opening':
			return {
				kind: 'opening',
				roomId: row.roomId,
				segmentId: row.segmentId,
				openingId: row.openingId
			};
		case 'interiorAnchor':
			return {
				kind: 'interiorAnchor',
				roomId: row.roomId,
				segmentId: row.segmentId,
				anchorId: row.anchorId
			};
		case 'object':
			return { kind: 'object', objectId: row.objectId };
		// P23.6b — canonical wall-first rows qualify through the canonical
		// selection slots; row identity IS selection identity.
		case 'physicalWall':
			return { kind: 'physicalWall', wallId: row.wallId };
		case 'wallOpening':
			return { kind: 'wallOpening', wallId: row.wallId, openingId: row.openingId };
		case 'junction':
			return { kind: 'junction', junctionId: row.junctionId };
		default:
			return null;
	}
}

/** Qualified-identity helpers for tests (scene/camera rows). */
export function sceneRowToWorkspaceSelection(
	row: UnifiedTreeRow,
	roomId: string
): WorkspaceSelection | null {
	switch (row.kind) {
		case 'cluster':
			return { kind: 'cluster', clusterId: row.clusterId, roomId };
		case 'entity':
			return { kind: 'placement', ids: [row.entityId], clusterId: null, roomId };
		default:
			return null;
	}
}

export function cameraRowToNavigationSelection(
	row: UnifiedTreeRow
): NavigationSelection | null {
	switch (row.kind) {
		case 'camera-node':
			return { kind: 'node', nodeId: row.nodeId, handle: 'position' };
		case 'camera-connection':
			return { kind: 'connection', connectionId: row.connectionId, direction: 'forward' };
		case 'camera-direction':
			return {
				kind: 'connection',
				connectionId: row.connectionId,
				direction: row.direction
			};
		case 'camera-keyframe':
			return {
				kind: 'view-keyframe',
				connectionId: row.connectionId,
				direction: row.direction,
				keyframeId: row.keyframeId
			};
		default:
			return null;
	}
}
