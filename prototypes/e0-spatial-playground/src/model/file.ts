// JSON save/open. Only accepted authored values are written; parsing never touches current state.
import { evaluate } from './evaluate';
import { DOC_VERSION, type ArrangementMember, type E0Document, type GuidePoint, type Piece } from './types';

export function serialize(doc: E0Document): string {
  const out: E0Document = {
    version: DOC_VERSION,
    entrance: doc.entrance,
    notes: doc.notes,
    guide: doc.guide && { id: doc.guide.id, name: doc.guide.name, points: doc.guide.points.map(({ id, x, z }) => ({ id, x, z })) },
    band: doc.band && { id: doc.band.id, guideId: doc.band.guideId, width: doc.band.width, height: doc.band.height },
    arrangement: doc.arrangement && {
      id: doc.arrangement.id,
      guideId: doc.arrangement.guideId,
      startMargin: doc.arrangement.startMargin,
      endMargin: doc.arrangement.endMargin,
      sideOffset: doc.arrangement.sideOffset,
      members: doc.arrangement.members.map(({ pieceId, slot, following }) => ({ pieceId, slot, following })),
    },
    pieces: doc.pieces.map(({ id, name, main, width, depth, height, pose }) => ({
      id, name, main, width, depth, height, pose: { x: pose.x, z: pose.z, yaw: pose.yaw },
    })),
  };
  return JSON.stringify(out, null, 2);
}

class Invalid extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function str(o: Record<string, unknown>, k: string, where: string): string {
  if (typeof o[k] !== 'string' || !(o[k] as string).length) throw new Invalid(`${where}: missing or empty "${k}".`);
  return o[k] as string;
}
function num(o: Record<string, unknown>, k: string, where: string, positive = false): number {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Invalid(`${where}: "${k}" must be a finite number.`);
  if (positive && v <= 0) throw new Invalid(`${where}: "${k}" must be positive.`);
  return v;
}

export function parse(text: string): { doc: E0Document } | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'This file is not valid JSON. Current work is unchanged.' };
  }
  try {
    if (!isObj(raw)) throw new Invalid('The file does not contain a playground document.');
    if (raw.version !== DOC_VERSION) throw new Invalid(`Unknown document version ${JSON.stringify(raw.version)} (expected "${DOC_VERSION}").`);
    if (raw.entrance !== 'south' && raw.entrance !== 'east') throw new Invalid('Entrance must be "south" or "east".');
    const notes = typeof raw.notes === 'string' ? raw.notes : '';

    if (!Array.isArray(raw.pieces) || raw.pieces.length !== 3) throw new Invalid('Expected exactly three pieces.');
    const pieces: Piece[] = raw.pieces.map((p, i) => {
      const where = `Piece ${i + 1}`;
      if (!isObj(p) || !isObj(p.pose)) throw new Invalid(`${where}: malformed record.`);
      return {
        id: str(p, 'id', where),
        name: str(p, 'name', where),
        main: p.main === true,
        width: num(p, 'width', where, true),
        depth: num(p, 'depth', where, true),
        height: num(p, 'height', where, true),
        pose: { x: num(p.pose, 'x', where), z: num(p.pose, 'z', where), yaw: num(p.pose, 'yaw', where) },
      };
    });
    if (new Set(pieces.map((p) => p.id)).size !== 3) throw new Invalid('Piece IDs must be unique.');
    if (pieces.filter((p) => p.main).length !== 1) throw new Invalid('Exactly one piece must be the main piece.');

    let guide: E0Document['guide'] = null;
    if (raw.guide !== null && raw.guide !== undefined) {
      const g = raw.guide;
      if (!isObj(g) || !Array.isArray(g.points)) throw new Invalid('Guide: malformed record.');
      const points: GuidePoint[] = g.points.map((p, i) => {
        if (!isObj(p)) throw new Invalid(`Guide point ${i + 1}: malformed.`);
        return { id: str(p, 'id', `Guide point ${i + 1}`), x: num(p, 'x', `Guide point ${i + 1}`), z: num(p, 'z', `Guide point ${i + 1}`) };
      });
      if (new Set(points.map((p) => p.id)).size !== points.length) throw new Invalid('Guide point IDs must be unique.');
      guide = { id: str(g, 'id', 'Guide'), name: typeof g.name === 'string' ? g.name : 'Guide', points };
    }

    let band: E0Document['band'] = null;
    if (raw.band !== null && raw.band !== undefined) {
      const b = raw.band;
      if (!isObj(b)) throw new Invalid('Display edge: malformed record.');
      band = { id: str(b, 'id', 'Display edge'), guideId: str(b, 'guideId', 'Display edge'), width: num(b, 'width', 'Display edge', true), height: num(b, 'height', 'Display edge', true) };
      if (!guide || band.guideId !== guide.id) throw new Invalid(`Display edge refers to missing guide "${band.guideId}".`);
    }

    let arrangement: E0Document['arrangement'] = null;
    if (raw.arrangement !== null && raw.arrangement !== undefined) {
      const a = raw.arrangement;
      if (!isObj(a) || !Array.isArray(a.members) || a.members.length !== 3) throw new Invalid('Arrangement: expected three members.');
      const members: ArrangementMember[] = a.members.map((m, i) => {
        if (!isObj(m) || (m.slot !== 0 && m.slot !== 1 && m.slot !== 2) || typeof m.following !== 'boolean') throw new Invalid(`Arrangement member ${i + 1}: malformed.`);
        const pieceId = str(m, 'pieceId', `Arrangement member ${i + 1}`);
        if (!pieces.some((p) => p.id === pieceId)) throw new Invalid(`Arrangement refers to missing piece "${pieceId}".`);
        return { pieceId, slot: m.slot, following: m.following };
      });
      if (new Set(members.map((m) => m.pieceId)).size !== 3 || new Set(members.map((m) => m.slot)).size !== 3) throw new Invalid('Arrangement members and slots must be distinct.');
      arrangement = {
        id: str(a, 'id', 'Arrangement'),
        guideId: str(a, 'guideId', 'Arrangement'),
        startMargin: num(a, 'startMargin', 'Arrangement'),
        endMargin: num(a, 'endMargin', 'Arrangement'),
        sideOffset: num(a, 'sideOffset', 'Arrangement'),
        members,
      };
      if (!guide || arrangement.guideId !== guide.id) throw new Invalid(`Arrangement refers to missing guide "${arrangement.guideId}".`);
    }

    const doc: E0Document = { version: DOC_VERSION, entrance: raw.entrance, notes, guide, band, arrangement, pieces };
    const ev = evaluate(doc);
    if (ev.errors.length) throw new Invalid(`Invalid geometry: ${ev.errors[0].message}`);
    return { doc };
  } catch (e) {
    if (e instanceof Invalid) return { error: `${e.message} Current work is unchanged.` };
    throw e;
  }
}
