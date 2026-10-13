import type { LayoutDocument, LayoutOpening } from './layout-types';
import type { LayoutDocumentWallFirst } from './layout-wall-first-types';

export type LayoutPortalOpeningRef = { roomId: string; openingId: string; segmentId: string };
export type LayoutPortalRelation = { roomIds: [string, string]; openings: LayoutPortalOpeningRef[] };

export function projectLayoutPortalRelations(document: LayoutDocument): LayoutPortalRelation[] {
  const relations = new Map<string, LayoutPortalRelation>();
  for (const floor of document.floors) {
    for (const room of floor.rooms) {
      for (const opening of room.openings) {
        const relation = opening.connectsRoomIds;
        if (!relation) continue;
        const roomIds = [...relation].sort((a, b) => a.localeCompare(b)) as [string, string];
        const key = roomIds.join('|');
        const current = relations.get(key) ?? { roomIds, openings: [] };
        current.openings.push({ roomId: room.id, openingId: opening.id, segmentId: opening.segmentId });
        relations.set(key, current);
      }
    }
  }
  return [...relations.values()].sort((a, b) => a.roomIds.join('|').localeCompare(b.roomIds.join('|')));
}

export function portalOpeningHasRoomPair(opening: LayoutOpening, roomA: string, roomB: string): boolean {
  const relation = opening.connectsRoomIds;
  return Boolean(relation && relation.includes(roomA) && relation.includes(roomB));
}

// ---------------------------------------------------------------------------
// New-schema portal adjacency (P23.3 contract, P23.0 F0 stage 5 Save-blocker)
// ---------------------------------------------------------------------------

export type WallFirstPortalIssueCode = 'nonadjacent_portal_relation';

export type WallFirstPortalIssue = {
  openingId: string;
  /** Document path of the offending relation (`$.openings[<index>].connectsRoomIds`). */
  path: string;
  code: WallFirstPortalIssueCode;
  message: string;
};

/**
 * Physical rooms adjacent to a wall-first Wall: the persistent Rooms whose
 * reconciled boundary references the Wall. The relation never creates
 * adjacency by itself — this set derives purely from Room boundaries.
 */
export function wallFirstAdjacentRooms(
  document: LayoutDocumentWallFirst,
  wallId: string
): readonly string[] {
  const adjacent: string[] = [];
  for (const room of document.rooms) {
    if (room.boundary.some((ref) => ref.wallId === wallId)) adjacent.push(room.id);
  }
  return adjacent;
}

/**
 * Strict new-schema `connectsRoomIds` adjacency rule (P23.3 "Physical
 * adjacency versus semantic portal intent"): the pair must be exactly the two
 * physical Rooms adjacent to the hosting boundary Wall at the opening. Shape
 * rules (door-only, two distinct known Room IDs) already hold on every
 * validated path — the wall-first codec enforces them structurally
 * (`invalid_value` / `missing_reference`) — so this check covers precisely
 * the Save-blocker hole the codec cannot see: endpoint-valid but
 * nonadjacent relations.
 *
 * Read-path codecs intentionally do NOT run this — legacy nonadjacent
 * relations stay compatibility-readable (P23.0 portal compatibility). The
 * wall-first Save gate runs it fail-closed (P23.0 "block new-schema Save
 * until the relation is explicitly resolved/removed"), and layout migration
 * runs it for its non-blocking carried-relation diagnostic.
 */
export function validateWallFirstPortalRelations(
  document: LayoutDocumentWallFirst
): WallFirstPortalIssue[] {
  const issues: WallFirstPortalIssue[] = [];
  const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
  document.openings.forEach((opening, index) => {
    const relation = opening.connectsRoomIds;
    if (!relation || opening.kind !== 'door') return;
    const path = `$.openings[${index}].connectsRoomIds`;
    const wall = wallById.get(opening.wallId);
    const adjacent = wall ? wallFirstAdjacentRooms(document, wall.id) : [];
    const pair = [...relation].sort();
    const neighbors = [...adjacent].sort();
    const matched =
      wall !== undefined &&
      wall.role === 'boundary' &&
      neighbors.length === 2 &&
      pair[0] === neighbors[0] &&
      pair[1] === neighbors[1];
    if (!matched) {
      const expected =
        wall === undefined
          ? `unknown hosting wall '${opening.wallId}'`
          : wall.role !== 'boundary'
            ? `a ${wall.role} wall carries no two-room portal relation`
            : neighbors.length === 1
              ? `room ${neighbors[0]} references the hosting wall`
              : neighbors.length === 0
                ? 'no room references the hosting wall'
                : `rooms ${neighbors.join(', ')} reference the hosting wall`;
      issues.push({
        openingId: opening.id,
        path,
        code: 'nonadjacent_portal_relation',
        message: `Opening '${opening.id}' relates rooms ${pair.join(', ')} but the hosting wall '${opening.wallId}' is adjacent to ${expected}: resolve or remove the relation before saving`
      });
    }
  });
  return issues;
}
