/**
 * `hierarchy-source-index.ts` — P23.6e slice 1 (plan §Pure relationship index).
 *
 * One **ephemeral read model** built fresh from the authoritative documents for
 * the Scene Navigator. It is not persisted topology, not a second graph and not
 * a mutation API: every relation is a one-pass inverse of an explicit
 * authoritative field (`room.boundary[]`, `opening.wallId`, Wall endpoint IDs,
 * `object.roomId`, `cluster.memberIds`). No relation is ever inferred from
 * coordinates, bounds, proximity, point-in-polygon or render geometry.
 *
 * This module is deliberately renderer-neutral and framework-free: **no Svelte,
 * DOM, Three, codec, mutation-planner, history or visitor imports**. It exists
 * so the page projection (`hierarchy-page-projection.ts`) can answer
 * relationship queries without each page rebuilding its own lookup maps.
 *
 * Canonical-only: Rooms/Walls/Junctions/Openings are wall-first records. A
 * legacy Room-owned document keeps its quarantined tree
 * (`unified-project-tree-model.ts`) — this index reports `format: 'legacy'`
 * with empty canonical collections while still indexing the format-independent
 * Layout Objects and Scene Content.
 */

import type { LayoutDocument, LayoutObject, LayoutVec2 } from '$lib/layout/layout-types';
import type {
  LayoutDocumentWallFirst,
  LayoutWallOpening,
  LayoutWallRole,
  OrientedWallRef
} from '$lib/layout/layout-wall-first-types';
// P23.12 D5 — identity is resolved by the shared display-identity layer, never
// by this module asking the ledger directly. The index only carries the result.
import {
	junctionIdentity,
	openingIdentity,
	roomIdentity,
	wallIdentity
} from '../identity/layout-identity-view';
import type { SceneDocument } from '$lib/content/scene';

/**
 * Canonical Navigator identity for one entity. It **includes the owner** so
 * `layout:object:x` and `scene:entity:x` can never collide, and it carries the
 * canonical IDs verbatim — never a derived ordinal (P23.6e gate 1: no invented
 * `W044` numbering).
 *
 * This is a row/representation **key**, not a selection type: canonical
 * selection stays in `LayoutInteractionState.selection` /
 * `EditorSelectionStore`. Nothing here selects, edits or persists.
 */
export type HierarchyEntityKey =
	| { id: string; owner: 'layout'; kind: 'room'; roomId: string }
	| { id: string; owner: 'layout'; kind: 'wall'; wallId: string }
	| { id: string; owner: 'layout'; kind: 'opening'; wallId: string; openingId: string }
	| { id: string; owner: 'layout'; kind: 'junction'; junctionId: string }
	| { id: string; owner: 'layout'; kind: 'object'; objectId: string }
	| { id: string; owner: 'scene'; kind: 'cluster'; clusterId: string }
	| { id: string; owner: 'scene'; kind: 'entity'; entityId: string };

/**
 * Collision-safe canonical id for a key. Every segment is percent-encoded
 * before joining, so an imported id that itself contains `:` (canonical
 * Opening allocators produce ids such as `opening:door:1`) can never forge a
 * different entity's key.
 */
function composeEntityId(...segments: string[]): string {
	return segments.map((segment) => encodeURIComponent(segment)).join(':');
}

export function roomEntityKey(roomId: string): HierarchyEntityKey {
	return { id: composeEntityId('layout', 'room', roomId), owner: 'layout', kind: 'room', roomId };
}

export function wallEntityKey(wallId: string): HierarchyEntityKey {
	return { id: composeEntityId('layout', 'wall', wallId), owner: 'layout', kind: 'wall', wallId };
}

export function openingEntityKey(wallId: string, openingId: string): HierarchyEntityKey {
	return {
		id: composeEntityId('layout', 'opening', wallId, openingId),
		owner: 'layout',
		kind: 'opening',
		wallId,
		openingId
	};
}

export function junctionEntityKey(junctionId: string): HierarchyEntityKey {
	return {
		id: composeEntityId('layout', 'junction', junctionId),
		owner: 'layout',
		kind: 'junction',
		junctionId
	};
}

export function layoutObjectEntityKey(objectId: string): HierarchyEntityKey {
	return {
		id: composeEntityId('layout', 'object', objectId),
		owner: 'layout',
		kind: 'object',
		objectId
	};
}

export function sceneClusterEntityKey(clusterId: string): HierarchyEntityKey {
	return {
		id: composeEntityId('scene', 'cluster', clusterId),
		owner: 'scene',
		kind: 'cluster',
		clusterId
	};
}

export function sceneEntityKey(entityId: string): HierarchyEntityKey {
	return { id: composeEntityId('scene', 'entity', entityId), owner: 'scene', kind: 'entity', entityId };
}

/** Key equality is canonical-id equality; the key carries no other state. */
export function hierarchyEntityKeyEquals(a: HierarchyEntityKey, b: HierarchyEntityKey): boolean {
	return a.id === b.id;
}

/** One canonical Room, with its boundary resolved to existing Walls. */
export type HierarchyRoomSource = {
	entity: HierarchyEntityKey;
	roomId: string;
	name: string;
	/**
	 * P23.12 — the compact reference from the document's identity ledger, or
	 * `null` when the document carries no ledger (legacy / pre-normalization).
	 */
	reference: string | null;
	/**
	 * `room.boundary[]` in its exact authoritative order and direction. Refs
	 * that name a missing Wall are dropped: a dangling ref cannot be rendered
	 * or selected, and the Navigator never fabricates a row for it.
	 */
	boundary: OrientedWallRef[];
	floorThickness: number;
	ceilingThickness: number;
};

/** One document-global physical Wall (`startJunctionId` is its canonical start). */
export type HierarchyWallSource = {
	entity: HierarchyEntityKey;
	wallId: string;
	role: LayoutWallRole;
	height: number;
	startJunctionId: string;
	endJunctionId: string;
	/** P23.12 — compact reference, or `null` without a ledger. */
	reference: string | null;
	/** P23.12 — optional authored name; absence is the only unnamed state. */
	name: string | null;
};

/** One canonical Opening, hosted by exactly one Wall. */
export type HierarchyOpeningSource = {
	entity: HierarchyEntityKey;
	openingId: string;
	wallId: string;
	openingKind: LayoutWallOpening['kind'];
	/** P23.12 — compact reference, or `null` without a ledger. */
	reference: string | null;
	/** P23.12 — optional authored name; absence is the only unnamed state. */
	name: string | null;
};

export type HierarchyJunctionSource = {
	entity: HierarchyEntityKey;
	junctionId: string;
	point: LayoutVec2;
	/** P23.12 — compact reference, or `null` without a ledger. */
	reference: string | null;
};

/** One document-level Layout Object; `roomId` is the explicit semantic assignment only. */
export type HierarchyLayoutObjectSource = {
	entity: HierarchyEntityKey;
	objectId: string;
	objectKind: LayoutObject['kind'];
	roomId: string | null;
};

export type HierarchySceneClusterSource = {
	entity: HierarchyEntityKey;
	clusterId: string;
	name: string;
	memberIds: string[];
};

export type HierarchySceneEntitySource = {
	entity: HierarchyEntityKey;
	entityId: string;
	name: string;
};

/**
 * Read-only relationship index. Every `Map` is keyed by the canonical raw ID
 * of the left-hand entity; every array preserves authoritative document order.
 */
export type HierarchySourceIndex = {
	format: 'wall-first' | 'legacy';
	orderedRooms: HierarchyRoomSource[];
	orderedWalls: HierarchyWallSource[];
	orderedOpenings: HierarchyOpeningSource[];
	orderedJunctions: HierarchyJunctionSource[];
	orderedLayoutObjects: HierarchyLayoutObjectSource[];
	orderedSceneClusters: HierarchySceneClusterSource[];
	orderedSceneEntities: HierarchySceneEntitySource[];
	roomById: Map<string, HierarchyRoomSource>;
	wallById: Map<string, HierarchyWallSource>;
	openingById: Map<string, HierarchyOpeningSource>;
	junctionById: Map<string, HierarchyJunctionSource>;
	objectById: Map<string, HierarchyLayoutObjectSource>;
	sceneClusterById: Map<string, HierarchySceneClusterSource>;
	sceneEntityById: Map<string, HierarchySceneEntitySource>;
	/** Wall → hosted Opening IDs, in `layout.openings` order. */
	openingsByWallId: Map<string, string[]>;
	/** Wall → Rooms whose explicit boundary references it, in `layout.rooms` order. */
	roomIdsByWallId: Map<string, string[]>;
	/** Junction → incident Wall IDs, in `layout.walls` order. */
	incidentWallIdsByJunctionId: Map<string, string[]>;
	/**
	 * Junction → Rooms whose explicit boundary Walls have this Junction as an
	 * endpoint, in `layout.rooms` order (strictly topological identity).
	 */
	boundaryRoomIdsByJunctionId: Map<string, string[]>;
	/** Room → explicitly assigned Layout Object IDs, in `layout.objects` order. */
	assignedObjectIdsByRoomId: Map<string, string[]>;
	/** Scene member entity → the first cluster that claims it. */
	clusterByMemberId: Map<string, string>;
};

function pushUnique(map: Map<string, string[]>, key: string, value: string): void {
	const list = map.get(key);
	if (!list) {
		map.set(key, [value]);
		return;
	}
	if (!list.includes(value)) list.push(value);
}

function indexBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T> {
	const map = new Map<K, T>();
	for (const item of items) map.set(key(item), item);
	return map;
}

/**
 * Build the index fresh from the current documents. Pure: the input documents
 * are only read (points and member lists are copied), and repeated builds over
 * deep-equal inputs are deep-equal.
 */
export function buildHierarchySourceIndex(input: {
	layout: LayoutDocument | LayoutDocumentWallFirst;
	scene: SceneDocument;
}): HierarchySourceIndex {
	const { layout, scene } = input;

	const orderedSceneClusters: HierarchySceneClusterSource[] = (scene.clusters ?? []).map(
		(cluster) => ({
			entity: sceneClusterEntityKey(cluster.id),
			clusterId: cluster.id,
			name: cluster.name,
			memberIds: [...cluster.memberIds]
		})
	);
	const orderedSceneEntities: HierarchySceneEntitySource[] = scene.entities.map((entity) => ({
		entity: sceneEntityKey(entity.id),
		entityId: entity.id,
		name: entity.name
	}));
	const orderedLayoutObjects: HierarchyLayoutObjectSource[] = layout.objects.map((object) => ({
		entity: layoutObjectEntityKey(object.id),
		objectId: object.id,
		objectKind: object.kind,
		roomId: object.roomId ?? null
	}));

	const orderedRooms: HierarchyRoomSource[] = [];
	const orderedWalls: HierarchyWallSource[] = [];
	const orderedOpenings: HierarchyOpeningSource[] = [];
	const orderedJunctions: HierarchyJunctionSource[] = [];
	const openingsByWallId = new Map<string, string[]>();
	const roomIdsByWallId = new Map<string, string[]>();
	const incidentWallIdsByJunctionId = new Map<string, string[]>();
	const boundaryRoomIdsByJunctionId = new Map<string, string[]>();

	if ('formatVersion' in layout) {
		const wallIdsInDocument = new Set(layout.walls.map((wall) => wall.id));
		for (const wall of layout.walls) {
			const identity = wallIdentity(layout, wall.id);
			orderedWalls.push({
				entity: wallEntityKey(wall.id),
				wallId: wall.id,
				role: wall.role,
				height: wall.height,
				startJunctionId: wall.startJunctionId,
				endJunctionId: wall.endJunctionId,
				reference: identity.reference,
				name: identity.name
			});
		}
		for (const junction of layout.junctions) {
			orderedJunctions.push({
				entity: junctionEntityKey(junction.id),
				junctionId: junction.id,
				point: [junction.point[0], junction.point[1]] as LayoutVec2,
				reference: junctionIdentity(layout, junction.id).reference
			});
		}
		for (const opening of layout.openings) {
			const identity = openingIdentity(layout, opening.id);
			orderedOpenings.push({
				entity: openingEntityKey(opening.wallId, opening.id),
				openingId: opening.id,
				wallId: opening.wallId,
				openingKind: opening.kind,
				reference: identity.reference,
				name: identity.name
			});
		}
		for (const room of layout.rooms) {
			const identity = roomIdentity(layout, room.id);
			orderedRooms.push({
				entity: roomEntityKey(room.id),
				roomId: room.id,
				name: identity.name ?? room.name,
				reference: identity.reference,
				boundary: room.boundary
					.filter((ref) => wallIdsInDocument.has(ref.wallId))
					.map((ref) => ({ wallId: ref.wallId, direction: ref.direction })),
				floorThickness: room.floorThickness,
				ceilingThickness: room.ceilingThickness
			});
		}

		// Wall → Rooms and Wall → Openings are inverses of explicit refs.
		for (const opening of orderedOpenings) {
			pushUnique(openingsByWallId, opening.wallId, opening.openingId);
		}
		for (const room of orderedRooms) {
			for (const ref of room.boundary) pushUnique(roomIdsByWallId, ref.wallId, room.roomId);
		}

		const wallById = indexBy(orderedWalls, (wall) => wall.wallId);
		for (const wall of orderedWalls) {
			pushUnique(incidentWallIdsByJunctionId, wall.startJunctionId, wall.wallId);
			pushUnique(incidentWallIdsByJunctionId, wall.endJunctionId, wall.wallId);
		}
		// Junction → boundary Rooms: walk explicit Room boundary refs and add the
		// Room once per endpoint it meets, in `layout.rooms` order.
		for (const room of orderedRooms) {
			for (const ref of room.boundary) {
				const wall = wallById.get(ref.wallId);
				if (!wall) continue;
				pushUnique(boundaryRoomIdsByJunctionId, wall.startJunctionId, room.roomId);
				pushUnique(boundaryRoomIdsByJunctionId, wall.endJunctionId, room.roomId);
			}
		}
	}

	const assignedObjectIdsByRoomId = new Map<string, string[]>();
	for (const object of orderedLayoutObjects) {
		if (object.roomId !== null) pushUnique(assignedObjectIdsByRoomId, object.roomId, object.objectId);
	}
	const clusterByMemberId = new Map<string, string>();
	for (const cluster of orderedSceneClusters) {
		for (const memberId of cluster.memberIds) {
			if (!clusterByMemberId.has(memberId)) clusterByMemberId.set(memberId, cluster.clusterId);
		}
	}

	return {
		format: 'formatVersion' in layout ? 'wall-first' : 'legacy',
		orderedRooms,
		orderedWalls,
		orderedOpenings,
		orderedJunctions,
		orderedLayoutObjects,
		orderedSceneClusters,
		orderedSceneEntities,
		roomById: indexBy(orderedRooms, (room) => room.roomId),
		wallById: indexBy(orderedWalls, (wall) => wall.wallId),
		openingById: indexBy(orderedOpenings, (opening) => opening.openingId),
		junctionById: indexBy(orderedJunctions, (junction) => junction.junctionId),
		objectById: indexBy(orderedLayoutObjects, (object) => object.objectId),
		sceneClusterById: indexBy(orderedSceneClusters, (cluster) => cluster.clusterId),
		sceneEntityById: indexBy(orderedSceneEntities, (entity) => entity.entityId),
		openingsByWallId,
		roomIdsByWallId,
		incidentWallIdsByJunctionId,
		boundaryRoomIdsByJunctionId,
		assignedObjectIdsByRoomId,
		clusterByMemberId
	};
}
