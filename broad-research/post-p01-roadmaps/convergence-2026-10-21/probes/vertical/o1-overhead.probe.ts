// O1 — overhead ownership and closure coverage. Hand-constructed data + evaluator, no editor.
// Rooms are given as the derived faces the canonical compiler would produce (rectangles here); overheads are
// independent Layout-owned elements that never store Room ownership unless a probe alternative says so.
//
// Areas: every fixture coordinate is a multiple of 0.5 m; the evaluator counts 0.5 m cells by centre test, and each
// expected area is a hand-computed rectangle sum (independent of the cell evaluator). Tolerance |Δ| <= 1e-9 m².
import { describe, expect, it } from 'vitest';
import { recorder } from './emit';

type Rect = [number, number, number, number]; // x0, z0, x1, z1
type Region = { add: Rect[]; holes?: Rect[] };
type Overhead = { id: string; role: 'roof' | 'canopy' | 'ceiling' | 'slab'; intent?: 'closure' | 'suspended'; region: Region; y: number; fitRooms?: string[]; gapsIntentional?: boolean };
type Room = { id: string; rect: Rect };
const CELL = 0.5, TOL = 1e-9;

const inRect = (r: Rect, x: number, z: number) => x > r[0] && x < r[2] && z > r[1] && z < r[3];
const inRegion = (g: Region, x: number, z: number) => g.add.some((r) => inRect(r, x, z)) && !(g.holes ?? []).some((r) => inRect(r, x, z));
function cells(fn: (x: number, z: number) => boolean, box: Rect = [-5, -5, 25, 15]) {
	let n = 0;
	for (let x = box[0] + CELL / 2; x < box[2]; x += CELL) for (let z = box[1] + CELL / 2; z < box[3]; z += CELL) if (fn(x, z)) n++;
	return n * CELL * CELL;
}
const union = (rooms: Room[], pad: number): Region => {
	const xs = rooms.flatMap((r) => [r.rect[0], r.rect[2]]), zs = rooms.flatMap((r) => [r.rect[1], r.rect[3]]);
	// rectangular-union fixtures only: the bounding box is the union for the cases used here
	return { add: [[Math.min(...xs) - pad, Math.min(...zs) - pad, Math.max(...xs) + pad, Math.max(...zs) + pad]] };
};

type Policy = 'room-switch' | 'per-area';
// Generated fallback closure: derived, unpersisted, only for enclosure not covered by authored closure.
//   room-switch: any authored closure meeting a Room disables that Room's fallback (remainder = explicit warning)
//   per-area:    fallback fills every uncovered cell of the Room (an un-marked hole is silently capped)
function evaluate(rooms: Room[], ohs: Overhead[], policy: Policy) {
	const closures = ohs.filter((o) => o.role === 'ceiling' && o.intent === 'closure');
	// ambiguous authored closure overlap refuses (pending a joint rule) rather than double-rendering
	for (let i = 0; i < closures.length; i++) for (let j = i + 1; j < closures.length; j++) {
		const a = closures[i]!, b = closures[j]!;
		const ov = cells((x, z) => inRegion(a.region, x, z) && inRegion(b.region, x, z));
		if (ov > TOL) return { refused: 'ambiguous-closure-overlap', subjects: [a.id, b.id], area: ov };
	}
	const covered = (x: number, z: number) => closures.some((c) => inRegion(c.region, x, z) || (c.gapsIntentional && c.region.add.some((r) => inRect(r, x, z))));
	const out = rooms.map((room) => {
		const inside = (x: number, z: number) => inRect(room.rect, x, z);
		const touched = cells((x, z) => inside(x, z) && covered(x, z)) > TOL;
		const fallback = policy === 'room-switch' && touched ? 0 : cells((x, z) => inside(x, z) && !covered(x, z));
		const openAbove = policy === 'room-switch' && touched ? cells((x, z) => inside(x, z) && !closures.some((c) => inRegion(c.region, x, z))) : 0;
		return { room: room.id, fallback, openAbove };
	});
	// roofs/canopies: coverage shortfall over enclosure is a WARNING with a one-step refit, not invalid topology
	const roofShort = ohs.filter((o) => o.role === 'roof').map((r) => ({ roof: r.id, uncoveredEnclosure: cells((x, z) => rooms.some((q) => inRect(q.rect, x, z)) && !inRegion(r.region, x, z)) }));
	return { rooms: out, roofShort, ids: ohs.map((o) => o.id).sort() };
}

const roomsBase = (): Room[] => [{ id: 'A', rect: [0, 0, 6, 8] }, { id: 'B', rect: [6, 0, 12, 8] }];
const ohBase = (): Overhead[] => [
	{ id: 'R1', role: 'roof', region: union(roomsBase(), 0.5), y: 3.4, fitRooms: ['A', 'B'] },
	{ id: 'C1', role: 'ceiling', intent: 'suspended', region: { add: [[1, 1, 5, 7]] }, y: 2.7 },
	{ id: 'K1', role: 'ceiling', intent: 'closure', region: { add: [[6, 0, 12, 8]] }, y: 3.0 },
	{ id: 'N1', role: 'canopy', region: { add: [[12.5, 0, 16, 4]] }, y: 2.6 },
	{ id: 'M1', role: 'slab', region: { add: [[0, 0, 3, 8]] }, y: 2.8 }
];
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const fb = (r: ReturnType<typeof evaluate>) => ('rooms' in r ? Object.fromEntries(r.rooms.map((q) => [q.room, q.fallback])) : r);

describe('O1 overhead ownership / coverage', () => {
	const rec = recorder('o1-overhead');

	it('rest state: suspended ceiling does not erase enclosure; authored closure suppresses fallback', () => {
		for (const policy of ['room-switch', 'per-area'] as const) {
			const r = evaluate(roomsBase(), ohBase(), policy);
			rec.row(`O1.0 ${policy} fallback A=48 B=0`, 'pass', JSON.stringify(fb(r)) === JSON.stringify({ A: 48, B: 0 }) ? 'pass' : 'fail', { fallback: fb(r), roofShort: 'roofShort' in r ? r.roofShort : null });
		}
	});

	it('Room split / merge / opening keeps every overhead identity and geometry; fallback follows derived Rooms', () => {
		const split: Room[] = [{ id: 'A', rect: [0, 0, 3, 8] }, { id: 'A2', rect: [3, 0, 6, 8] }, { id: 'B', rect: [6, 0, 12, 8] }];
		const merged: Room[] = [{ id: 'A', rect: [0, 0, 12, 8] }];
		const opened: Room[] = [{ id: 'A', rect: [0, 0, 6, 8] }];
		const want = { split: { A: 24, A2: 24, B: 0 }, merged: { A: 48 }, opened: { A: 48 } };
		const sameOh = JSON.stringify(ohBase());
		for (const [name, rooms] of Object.entries({ split, merged, opened })) {
			const r = evaluate(rooms, ohBase(), 'per-area');
			rec.row(`O1.1 ${name}`, 'pass',
				JSON.stringify(fb(r)) === JSON.stringify((want as Record<string, unknown>)[name]) && JSON.stringify(ohBase()) === sameOh ? 'pass' : 'fail',
				{ fallback: fb(r), overheadIds: 'ids' in r ? r.ids : null });
		}
		// merge: under room-switch the merged Room meets K1 -> no fallback over old A, 48 m² reported open above
		const ms = evaluate(merged, ohBase(), 'room-switch');
		rec.row('O1.1b merged under room-switch: A loses fallback, 48 m² open-above warning', 'pass',
			'rooms' in ms && ms.rooms[0]!.fallback === 0 && ms.rooms[0]!.openAbove === 48 ? 'pass' : 'fail', { result: ms });
	});

	it('overlapping authored closures refuse; intentional lightwell gap vs silent cap', () => {
		const ov = clone(ohBase());
		ov.push({ id: 'K2', role: 'ceiling', intent: 'closure', region: { add: [[9, 0, 14, 8]] }, y: 3.0 });
		const r = evaluate(roomsBase(), ov, 'per-area');
		rec.row('O1.2 overlapping closures', 'refuse', 'refused' in r && Math.abs(r.area - 24) <= TOL ? 'refuse' : 'fail', { result: r, handOracle_m2: 24 });
		const holed = clone(ohBase());
		holed.find((o) => o.id === 'K1')!.region.holes = [[8, 3, 10, 5]];
		const capped = fb(evaluate(roomsBase(), holed, 'per-area'));
		rec.row('O1.3 un-marked lightwell hole is silently capped by per-area fallback (4 m²)', 'fail',
			(capped as Record<string, number>).B === 0 ? 'pass' : 'fail', { fallback: capped, handOracle_m2: 4 });
		const switchR = evaluate(roomsBase(), holed, 'room-switch');
		rec.row('O1.3b room-switch leaves the hole open and reports it', 'pass',
			'rooms' in switchR && switchR.rooms[1]!.fallback === 0 && switchR.rooms[1]!.openAbove === 4 ? 'pass' : 'fail', { result: switchR });
		holed.find((o) => o.id === 'K1')!.gapsIntentional = true;
		const marked = fb(evaluate(roomsBase(), holed, 'per-area'));
		rec.row('O1.3c per-area with explicit intentional gap leaves hole open', 'pass', (marked as Record<string, number>).B === 0 ? 'pass' : 'fail', { fallback: marked });
	});

	it('Wall moves outward 1 m (B -> x 6..13): one-shot fit vs Room-keyed following', () => {
		const grown: Room[] = [{ id: 'A', rect: [0, 0, 6, 8] }, { id: 'B', rect: [6, 0, 13, 8] }];
		const oneShot = evaluate(grown, ohBase(), 'room-switch');
		rec.row('O1.4 one-shot: roof short 4 m² + B open-above 8 m² as warnings; nothing moved', 'pass',
			'rooms' in oneShot && oneShot.roofShort[0]!.uncoveredEnclosure === 4 && oneShot.rooms[1]!.openAbove === 8 ? 'pass' : 'fail', { result: oneShot });
		const perArea = evaluate(grown, ohBase(), 'per-area');
		rec.row('O1.4b per-area mixes authored K1 (3.0 m) and an 8 m² generated strip in one Room', 'fail',
			'rooms' in perArea && perArea.rooms[1]!.fallback === 0 ? 'pass' : 'fail', { fallback: fb(perArea) });
		// following: roof outline = union(fitRooms) + 0.5 resolved by Room id at every evaluation
		const follow = (rooms: Room[]) => {
			const fit = rooms.filter((q) => ohBase()[0]!.fitRooms!.includes(q.id));
			const roof = { ...ohBase()[0]!, region: union(fit, 0.5) };
			return evaluate(rooms, [roof], 'per-area');
		};
		const fGrown = follow(grown);
		rec.row('O1.5 following covers the grown Room', 'pass', 'roofShort' in fGrown && fGrown.roofShort[0]!.uncoveredEnclosure === 0 ? 'pass' : 'fail', {});
		// split where the SURVIVOR is the far piece: A (survivor) = [3,6], A2 (born) = [0,3]. union() is a bbox, so
		// use a split that changes the bbox: remove B, split A; the born piece is not in fitRooms.
		const splitFar: Room[] = [{ id: 'A2', rect: [0, 0, 3, 8] }, { id: 'A', rect: [3, 0, 6, 8] }];
		const fSplit = follow(splitFar);
		rec.row('O1.6 Room-keyed following after split + B removal drops the born Room (20 m² unroofed)', 'fail',
			'roofShort' in fSplit && fSplit.roofShort[0]!.uncoveredEnclosure === 0 ? 'pass' : 'fail',
			{ uncovered: 'roofShort' in fSplit ? fSplit.roofShort[0]!.uncoveredEnclosure : null, handOracle_m2: 20, note: 'needs an explicit membership/correspondence policy for births' });
	});

	it('canopy and partial slab are independent of Rooms', () => {
		const none = evaluate([], ohBase(), 'per-area');
		rec.row('O1.7 no Rooms at all: every overhead still evaluates', 'pass', 'ids' in none && none.ids.length === 5 ? 'pass' : 'fail', { result: none });
	});

	it('flush', () => {
		expect(rec.flush({ cell_m: CELL, tolerance_m2: TOL })).toEqual([]);
	});
});
