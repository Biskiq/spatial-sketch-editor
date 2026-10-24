/**
 * `layout-wall-portals.ts` — wall-first Opening portal relations.
 *
 * T1.P02.S05 moved these live functions here from `layout-portals.ts`, whose
 * other half (`projectLayoutPortalRelations`, `portalOpeningHasRoomPair`)
 * projected the retired legacy Room-owned document, had no callers, and is
 * deleted with it. Everything below reads only the canonical wall-first
 * document, so the portal contract survives the retirement unchanged.
 */
import type { LayoutDocumentWallFirst, LayoutWallOpening } from './layout-wall-first-types';

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
 * Read-path codecs intentionally do NOT run this: a document with a
 * nonadjacent relation stays readable, and the wall-first Save gate runs the
 * rule fail-closed (P23.0 "block new-schema Save until the relation is
 * explicitly resolved/removed").
 */
export function validateWallFirstPortalRelations(
  document: LayoutDocumentWallFirst
): WallFirstPortalIssue[] {
  const issues: WallFirstPortalIssue[] = [];
  const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
  document.openings.forEach((opening: LayoutWallOpening, index: number) => {
    const relation = opening.connectsRoomIds;
    if (!relation || opening.kind !== 'door') return;
    const path = `$.openings[${index}].connectsRoomIds`;
    const wall = wallById.get(opening.wallId);
    const adjacent = wall ? wallFirstAdjacentRooms(document, wall.id) : [];
    const pair = [...relation].sort();
    const neighbors = [...adjacent].sort();
    // Format 6 — adjacency is boundary membership on both sides, never an
    // authored role: a Wall referenced by exactly two Rooms is a dividing Wall.
    const matched =
      wall !== undefined &&
      neighbors.length === 2 &&
      pair[0] === neighbors[0] &&
      pair[1] === neighbors[1];
    if (!matched) {
      const expected =
        wall === undefined
          ? `unknown hosting wall '${opening.wallId}'`
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
