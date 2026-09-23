/**
 * `layout-topology-components.ts` — the GENERAL Wall/Junction connectivity test
 * (P23B.3a M-3a-1, decision record §2.11.3 GAP 1).
 *
 * Connectivity is **explicit graph identity**: two Walls belong to the same
 * component when they reference the same authored Junction id. Coordinates are
 * never consulted, so two Walls whose endpoints sit at exactly the same point
 * are INDEPENDENT unless an explicit Junction id joins them (the D-9 rule).
 *
 * Why this exists beside `connectedRoomIds`: that helper is **Room-only** — it
 * walks Room boundaries, so a standalone Wall, a partition stub or an unenclosed
 * chain is invisible to it. It is correct for its own consumer (the rigid
 * Room-group move, which depends on its output order) and is deliberately left
 * unchanged. The validity gates need the general form, and Room grouping is
 * DERIVED from it here rather than re-derived per consumer.
 *
 * No schema, persisted field or identifier is introduced: components are a pure
 * function of the document.
 */
import type { LayoutDocumentWallFirst } from './layout-wall-first-types';

/** One connected component of the authored Wall graph. */
export type LayoutTopologyComponent = {
	/**
	 * Deterministic label: the first member Wall id in document order. Stable for
	 * a given document and never persisted.
	 */
	key: string;
	/** Member Wall ids, in document order. */
	wallIds: readonly string[];
	/** Authored Junction ids incident to member Walls, in document order. */
	junctionIds: readonly string[];
	/** Rooms whose boundary references a member Wall, in document order. */
	roomIds: readonly string[];
};

/**
 * Component label per Wall id. Walls that reference a Junction id nobody else
 * references form a component of exactly themselves.
 */
export function topologyComponentKeyByWallId(
	document: Pick<LayoutDocumentWallFirst, 'walls'>
): Map<string, string> {
	const parent = new Map<string, string>();
	const find = (value: string): string => {
		let root = value;
		while (parent.get(root) !== root) root = parent.get(root)!;
		while (parent.get(value) !== root) {
			const next = parent.get(value)!;
			parent.set(value, root);
			value = next;
		}
		return root;
	};
	const union = (first: string, second: string): void => {
		const rootFirst = find(first);
		const rootSecond = find(second);
		if (rootFirst !== rootSecond) parent.set(rootSecond, rootFirst);
	};

	for (const wall of document.walls) parent.set(wall.id, wall.id);
	// Junction identity is the ONLY edge: authored ids, never coordinates and
	// never mere proximity.
	const wallsByJunctionId = new Map<string, string[]>();
	for (const wall of document.walls) {
		for (const junctionId of [wall.startJunctionId, wall.endJunctionId]) {
			const members = wallsByJunctionId.get(junctionId);
			if (members) members.push(wall.id);
			else wallsByJunctionId.set(junctionId, [wall.id]);
		}
	}
	for (const members of wallsByJunctionId.values()) {
		const first = members[0]!;
		for (const member of members.slice(1)) union(first, member);
	}

	// Label each component by its first member in document order, so the label is
	// independent of the union order above.
	const keyByWallId = new Map<string, string>();
	const labelByRoot = new Map<string, string>();
	for (const wall of document.walls) {
		const root = find(wall.id);
		const label = labelByRoot.get(root) ?? wall.id;
		if (!labelByRoot.has(root)) labelByRoot.set(root, label);
		keyByWallId.set(wall.id, label);
	}
	return keyByWallId;
}

/** All components of the document's Wall graph, in first-member document order. */
export function wallJunctionComponents(
	document: LayoutDocumentWallFirst
): LayoutTopologyComponent[] {
	const keyByWallId = topologyComponentKeyByWallId(document);
	const wallIdsByKey = new Map<string, string[]>();
	const junctionIdsByKey = new Map<string, string[]>();
	const seenJunctionIds = new Map<string, Set<string>>();
	for (const wall of document.walls) {
		const key = keyByWallId.get(wall.id)!;
		const walls = wallIdsByKey.get(key);
		if (walls) walls.push(wall.id);
		else wallIdsByKey.set(key, [wall.id]);

		let junctions = junctionIdsByKey.get(key);
		let seen = seenJunctionIds.get(key);
		if (!junctions || !seen) {
			junctions = [];
			seen = new Set<string>();
			junctionIdsByKey.set(key, junctions);
			seenJunctionIds.set(key, seen);
		}
		for (const junctionId of [wall.startJunctionId, wall.endJunctionId]) {
			if (seen.has(junctionId)) continue;
			seen.add(junctionId);
			junctions.push(junctionId);
		}
	}

	const keyByRoomId = topologyComponentKeyByRoomId(document, keyByWallId);
	const roomIdsByKey = new Map<string, string[]>();
	for (const room of document.rooms) {
		const key = keyByRoomId.get(room.id);
		if (!key) continue;
		const rooms = roomIdsByKey.get(key);
		if (rooms) rooms.push(room.id);
		else roomIdsByKey.set(key, [room.id]);
	}

	return [...wallIdsByKey.entries()].map(([key, wallIds]) => ({
		key,
		wallIds,
		junctionIds: junctionIdsByKey.get(key) ?? [],
		roomIds: roomIdsByKey.get(key) ?? []
	}));
}

/**
 * Component label per Room id, derived from the Wall graph: a Room belongs to
 * the component of its first resolvable boundary Wall. A Room whose boundary
 * straddles two components is malformed topology (its own gate rejects it), and
 * this helper does not silently repair it.
 */
export function topologyComponentKeyByRoomId(
	document: LayoutDocumentWallFirst,
	keyByWallId: Map<string, string> = topologyComponentKeyByWallId(document)
): Map<string, string> {
	const keyByRoomId = new Map<string, string>();
	for (const room of document.rooms) {
		for (const ref of room.boundary) {
			const key = keyByWallId.get(ref.wallId);
			if (key !== undefined) {
				keyByRoomId.set(room.id, key);
				break;
			}
		}
	}
	return keyByRoomId;
}

/**
 * Label used for authored Junctions that NO Wall references.
 *
 * Deliberately NOT a graph component: an unattached Junction is not connected to
 * anything, yet a component-scoped coincidence rule must still answer for it. All
 * unattached Junctions share this one label so that two coincident unattached
 * Junctions stay INVALID — the rule keeps the check that exists today instead of
 * silently dropping it for the case it cannot classify. The consequence the other
 * way is explicit and intended (D-9): an unattached Junction and a Junction that
 * belongs to a Wall component are never in the same component, so their coincidence
 * is permitted geometry, exactly like two coincident independent Wall groups.
 */
export const UNATTACHED_JUNCTION_COMPONENT = 'unattached-junctions';

/**
 * Component label per authored Junction id.
 *
 * A Junction referenced by at least one Wall takes the component key of the first
 * Wall (in document order) that references it. A Junction referenced by no Wall
 * takes {@link UNATTACHED_JUNCTION_COMPONENT}.
 */
export function topologyComponentKeyByJunctionId(
	document: LayoutDocumentWallFirst,
	keyByWallId: Map<string, string> = topologyComponentKeyByWallId(document)
): Map<string, string> {
	const keyByJunctionId = new Map<string, string>();
	for (const wall of document.walls) {
		const key = keyByWallId.get(wall.id);
		if (key === undefined) continue;
		for (const junctionId of [wall.startJunctionId, wall.endJunctionId]) {
			if (!keyByJunctionId.has(junctionId)) keyByJunctionId.set(junctionId, key);
		}
	}
	for (const junction of document.junctions) {
		if (!keyByJunctionId.has(junction.id)) {
			keyByJunctionId.set(junction.id, UNATTACHED_JUNCTION_COMPONENT);
		}
	}
	return keyByJunctionId;
}

/** Do these two Junctions belong to the same connected component (or are both unattached)? */
export function junctionsShareTopologyComponent(
	document: LayoutDocumentWallFirst,
	firstJunctionId: string,
	secondJunctionId: string
): boolean {
	if (firstJunctionId === secondJunctionId) return true;
	const keyByJunctionId = topologyComponentKeyByJunctionId(document);
	const key = keyByJunctionId.get(firstJunctionId);
	return key !== undefined && key === keyByJunctionId.get(secondJunctionId);
}

/** Do these two Walls belong to the same connected component? */
export function wallsShareTopologyComponent(
	document: LayoutDocumentWallFirst,
	firstWallId: string,
	secondWallId: string
): boolean {
	if (firstWallId === secondWallId) return true;
	const keyByWallId = topologyComponentKeyByWallId(document);
	const key = keyByWallId.get(firstWallId);
	return key !== undefined && key === keyByWallId.get(secondWallId);
}

/** Every Wall id in the same component as `wallId` (the Wall itself included). */
export function wallIdsConnectedTo(
	document: LayoutDocumentWallFirst,
	wallId: string
): readonly string[] {
	const keyByWallId = topologyComponentKeyByWallId(document);
	const key = keyByWallId.get(wallId);
	if (key === undefined) return [];
	return document.walls.filter((wall) => keyByWallId.get(wall.id) === key).map((wall) => wall.id);
}

/**
 * Rooms transitively connected to `roomId` through shared boundary Junction
 * ids, derived from the general test — the anchor Room first, then members in
 * document order. This is the Room-grouping form of the general test; it agrees
 * with `connectedRoomIds` on Room-only input and additionally sees standalone
 * Walls that no Room boundary references.
 */
export function roomIdsConnectedByTopology(
	document: LayoutDocumentWallFirst,
	roomId: string
): readonly string[] {
	const keyByRoomId = topologyComponentKeyByRoomId(document);
	const key = keyByRoomId.get(roomId);
	if (key === undefined) return [];
	const members = document.rooms
		.filter((room) => room.id !== roomId && keyByRoomId.get(room.id) === key)
		.map((room) => room.id);
	return [roomId, ...members];
}
