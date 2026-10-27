// Pure document edits. Each returns a new candidate document; acceptance is decided by evaluate().
import { DEFAULT_ARRANGE, DEFAULT_BAND } from './fixture';
import { evaluate } from './evaluate';
import type { Arrangement, E0Document, Entrance, GuidePoint, Pose } from './types';

export const clone = (doc: E0Document): E0Document => structuredClone(doc);

export const GUIDE_ID = 'guide-1';
export const BAND_ID = 'band-1';
export const ARRANGEMENT_ID = 'arrangement-1';

function nextPointIds(existing: GuidePoint[], count: number): string[] {
  let max = 0;
  for (const p of existing) {
    const n = Number(p.id.replace(/^gp-/, ''));
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return Array.from({ length: count }, (_, i) => `gp-${max + i + 1}`);
}

export function guideInUse(doc: E0Document): string | null {
  const users = [doc.band ? 'the display edge' : null, doc.arrangement ? 'the arrangement' : null].filter(Boolean);
  return users.length ? users.join(' and ') : null;
}

/** New guide from floor positions. Refused while the current guide has consumers (no rebind in core). */
export function setGuide(doc: E0Document, positions: [number, number][], name: string): E0Document | { refused: string } {
  const users = guideInUse(doc);
  if (users) return { refused: `The guide is used by ${users}. Replacing an in-use guide is outside this prototype; Reset or open a saved alternative instead.` };
  const next = clone(doc);
  const ids = nextPointIds([], positions.length);
  next.guide = { id: GUIDE_ID, name, points: positions.map(([x, z], i) => ({ id: ids[i], x, z })) };
  return next;
}

export function deleteGuide(doc: E0Document): E0Document | { refused: string } {
  const users = guideInUse(doc);
  if (users) return { refused: `Can't delete the guide: ${users} ${users.includes(' and ') ? 'are' : 'is'} built from it. Nothing was removed.` };
  const next = clone(doc);
  next.guide = null;
  return next;
}

export function moveGuidePoint(doc: E0Document, pointId: string, x: number, z: number): E0Document {
  const next = clone(doc);
  const p = next.guide?.points.find((q) => q.id === pointId);
  if (p) {
    p.x = x;
    p.z = z;
  }
  return next;
}

export function insertGuidePoint(doc: E0Document, afterIndex: number, at?: [number, number]): E0Document {
  const next = clone(doc);
  const g = next.guide;
  if (!g || afterIndex < 0 || afterIndex >= g.points.length - 1) return next;
  const a = g.points[afterIndex];
  const b = g.points[afterIndex + 1];
  const [x, z] = at ?? [(a.x + b.x) / 2, (a.z + b.z) / 2];
  g.points.splice(afterIndex + 1, 0, { id: nextPointIds(g.points, 1)[0], x, z });
  return next;
}

export function removeGuidePoint(doc: E0Document, pointId: string): E0Document | { refused: string } {
  if (!doc.guide || doc.guide.points.length <= 2) return { refused: 'A guide keeps at least two points.' };
  const next = clone(doc);
  next.guide!.points = next.guide!.points.filter((p) => p.id !== pointId);
  return next;
}

export function renameGuide(doc: E0Document, name: string): E0Document {
  const next = clone(doc);
  if (next.guide) next.guide.name = name;
  return next;
}

export function createBand(doc: E0Document, width = DEFAULT_BAND.width, height = DEFAULT_BAND.height): E0Document {
  const next = clone(doc);
  if (next.guide) next.band = { id: BAND_ID, guideId: next.guide.id, width, height };
  return next;
}

export function setBandSize(doc: E0Document, size: { width?: number; height?: number }): E0Document {
  const next = clone(doc);
  if (next.band) Object.assign(next.band, size);
  return next;
}

export type ArrangeParams = Pick<Arrangement, 'startMargin' | 'endMargin' | 'sideOffset'> & {
  /** Piece IDs in slot order 0, 1, 2. */
  order: string[];
  follow: boolean;
};

export const defaultArrangeParams = (doc: E0Document, order?: string[]): ArrangeParams => ({
  ...(doc.arrangement
    ? { startMargin: doc.arrangement.startMargin, endMargin: doc.arrangement.endMargin, sideOffset: doc.arrangement.sideOffset }
    : DEFAULT_ARRANGE),
  order:
    order ??
    (doc.arrangement
      ? [...doc.arrangement.members].sort((a, b) => a.slot - b.slot).map((m) => m.pieceId)
      : doc.pieces.map((p) => p.id)),
  follow: !!doc.arrangement,
});

/**
 * Arrange all three pieces along the guide. With follow, the arrangement is stored and every member
 * follows (replacing earlier exceptions). Without follow, the evaluated poses are accepted as free poses
 * and no relationship is stored.
 */
export function arrange(doc: E0Document, params: ArrangeParams): E0Document {
  const next = clone(doc);
  if (!next.guide) return next;
  const arrangement: Arrangement = {
    id: ARRANGEMENT_ID,
    guideId: next.guide.id,
    startMargin: params.startMargin,
    endMargin: params.endMargin,
    sideOffset: params.sideOffset,
    members: params.order.map((pieceId, slot) => ({ pieceId, slot: slot as 0 | 1 | 2, following: true })),
  };
  next.arrangement = arrangement;
  if (params.follow) return next;
  const ev = evaluate(next);
  if (!ev.slots) return next; // Invalid; evaluate() reports why and the draft is refused.
  for (const piece of next.pieces) piece.pose = ev.pieces.find((p) => p.id === piece.id)!.pose;
  // Free placement replaces any earlier following relationship.
  next.arrangement = null;
  return next;
}

/** Free pose edit. A following piece first breaks following (captured), leaving other slots unchanged. */
export function setPiecePose(doc: E0Document, pieceId: string, pose: Partial<Pose>): E0Document {
  const next = detach(doc, pieceId);
  const piece = next.pieces.find((p) => p.id === pieceId)!;
  piece.pose = { ...piece.pose, ...pose };
  return next;
}

export function detach(doc: E0Document, pieceId: string): E0Document {
  const next = clone(doc);
  const member = next.arrangement?.members.find((m) => m.pieceId === pieceId);
  if (member?.following) {
    const evaluated = evaluate(doc).pieces.find((p) => p.id === pieceId)!.pose;
    next.pieces.find((p) => p.id === pieceId)!.pose = { ...evaluated };
    member.following = false;
  }
  return next;
}

export function followAgain(doc: E0Document, pieceId: string): E0Document {
  const next = clone(doc);
  const member = next.arrangement?.members.find((m) => m.pieceId === pieceId);
  if (member) member.following = true;
  return next;
}

export function setEntrance(doc: E0Document, entrance: Entrance): E0Document {
  const next = clone(doc);
  next.entrance = entrance;
  return next;
}

export function setNotes(doc: E0Document, notes: string): E0Document {
  const next = clone(doc);
  next.notes = notes;
  return next;
}

export const isFollowing = (doc: E0Document, pieceId: string) =>
  !!doc.arrangement?.members.find((m) => m.pieceId === pieceId)?.following;
