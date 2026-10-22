// V2 — split-level vertical topology of ONE physical façade line. Hand-constructed data + evaluator, no editor.
//
// Fixture: a 10 m south façade (u = 0..10 m along the Wall from its canonical start). West floor datum Dw = 0,
// east floor datum De = 1.2 (open split-level step at u = 5, NO dividing Wall). Ground G = 0. Slabs are 0.2 m
// thick, top on their datum. West top Tw = Dw + 3.0, east top Te = De + 3.0. A creator's façade closes to ground.
//
// Alternatives for the façade:
//   S  segment the Wall at the base step; each segment's base/top references its zone datum (format-5 rule
//      "bottomY = floor datum" generalised per segment). Needs a degree-2 Junction at u = 5.
//   I  one Wall, addressed vertical intervals (stable interval ids, stations from canonical start), each with
//      its own base/top reference.
//   U  one Wall with ONE base reference (G) and an authored top profile (stepped here); floor steps live in slabs.
//
// Tolerances: all coordinates are multiples of 0.1 m; areas compared with |Δ| <= 1e-9 m²; exact interval sweeps.
import { describe, expect, it } from 'vitest';
import { recorder } from './emit';

type Datums = Record<string, number>;
type Ref = { datum: string; off: number };
type Span = { id: string; u0: number; u1: number; base: Ref; top: Ref };
type Facade = { alt: 'S' | 'I' | 'U'; walls: { id: string; spans: Span[] }[]; extraJunctions: number };
type Slab = { id: string; u0: number; u1: number; top: Ref; thick: number };
type Opening = { id: string; host: string; u0: number; u1: number; sill: Ref | { hostBase: number }; h: number };

const TOL = 1e-9;
const y = (d: Datums, r: Ref): number | null => (r.datum in d ? d[r.datum]! + r.off : null);

const slabs: Slab[] = [
	{ id: 'slab.w', u0: 0, u1: 5, top: { datum: 'Dw', off: 0 }, thick: 0.2 },
	{ id: 'slab.e', u0: 5, u1: 10, top: { datum: 'De', off: 0 }, thick: 0.2 }
];
const zones = [{ u0: 0, u1: 5, top: { datum: 'Dw', off: 3 } }, { u0: 5, u1: 10, top: { datum: 'De', off: 3 } }];

function facade(alt: 'S' | 'I' | 'U'): Facade {
	if (alt === 'S')
		return { alt, extraJunctions: 1, walls: [
			{ id: 'south.w', spans: [{ id: 'all', u0: 0, u1: 5, base: { datum: 'Dw', off: 0 }, top: { datum: 'Dw', off: 3 } }] },
			{ id: 'south.e', spans: [{ id: 'all', u0: 5, u1: 10, base: { datum: 'De', off: 0 }, top: { datum: 'De', off: 3 } }] }
		] };
	if (alt === 'I')
		return { alt, extraJunctions: 0, walls: [{ id: 'south', spans: [
			{ id: 'iw', u0: 0, u1: 5, base: { datum: 'Dw', off: 0 }, top: { datum: 'Dw', off: 3 } },
			{ id: 'ie', u0: 5, u1: 10, base: { datum: 'De', off: 0 }, top: { datum: 'De', off: 3 } }
		] }] };
	return { alt, extraJunctions: 0, walls: [{ id: 'south', spans: [
		{ id: 'tw', u0: 0, u1: 5, base: { datum: 'G', off: 0 }, top: { datum: 'Dw', off: 3 } },
		{ id: 'te', u0: 5, u1: 10, base: { datum: 'G', off: 0 }, top: { datum: 'De', off: 3 } }
	] }] };
}

// Unrolled section: per elementary u-interval, the union of solid y-intervals from Wall spans and slab edges.
function sectionGapAndOverlap(f: Facade, d: Datums) {
	const cuts = new Set<number>([0, 10]);
	for (const w of f.walls) for (const s of w.spans) { cuts.add(s.u0); cuts.add(s.u1); }
	for (const s of slabs) { cuts.add(s.u0); cuts.add(s.u1); }
	const us = [...cuts].sort((a, b) => a - b);
	let gap = 0, overlap = 0, unresolved: string[] = [];
	for (let k = 0; k + 1 < us.length; k++) {
		const [a, b] = [us[k]!, us[k + 1]!];
		const mid = (a + b) / 2, len = b - a;
		const wallIv: [number, number][] = [];
		for (const w of f.walls) for (const s of w.spans) if (s.u0 <= mid && mid <= s.u1) {
			const y0 = y(d, s.base), y1 = y(d, s.top);
			if (y0 === null || y1 === null) { unresolved.push(`${w.id}/${s.id}`); continue; }
			wallIv.push([y0, y1]);
		}
		// overlapping Wall solids at the same u (duplicate physical solid)
		for (let i = 0; i < wallIv.length; i++) for (let j = i + 1; j < wallIv.length; j++)
			overlap += Math.max(0, Math.min(wallIv[i]![1], wallIv[j]![1]) - Math.max(wallIv[i]![0], wallIv[j]![0])) * len;
		const iv = [...wallIv];
		for (const s of slabs) if (s.u0 <= mid && mid <= s.u1) { const t = y(d, s.top); if (t !== null) iv.push([t - s.thick, t]); }
		const z = zones.find((q) => q.u0 <= mid && mid <= q.u1)!;
		const need: [number, number] = [d.G!, y(d, z.top) ?? d.G!];
		// covered length of `need` by the union of iv
		const clipped = iv.map(([p, q]) => [Math.max(p, need[0]), Math.min(q, need[1])] as [number, number]).filter(([p, q]) => q > p).sort((x, w) => x[0] - w[0]);
		let covered = 0, cur = -Infinity;
		for (const [p, q] of clipped) { const s = Math.max(p, cur); if (q > s) { covered += q - s; cur = q; } }
		gap += (need[1] - need[0] - covered) * len;
	}
	return { gap, overlap, unresolved: [...new Set(unresolved)] };
}

// Opening qualification: one host, one unambiguous vertical reference, fits inside solid everywhere along its span.
function qualifyOpening(f: Facade, d: Datums, o: Opening): { ok: true } | { refused: string } {
	const hosts = f.walls.filter((w) => w.spans.some((s) => s.u0 < o.u1 - TOL && s.u1 > o.u0 + TOL));
	if (hosts.length !== 1) return { refused: 'opening-spans-several-walls' };
	const spans = hosts[0]!.spans.filter((s) => s.u0 < o.u1 - TOL && s.u1 > o.u0 + TOL);
	let sill: number | null;
	if ('hostBase' in o.sill) {
		const bases = new Set(spans.map((s) => y(d, s.base)));
		if (bases.size !== 1) return { refused: 'ambiguous-sill-reference' };
		sill = [...bases][0]! === null ? null : [...bases][0]! + o.sill.hostBase;
	} else sill = y(d, o.sill);
	if (sill === null) return { refused: 'unresolved-reference' };
	for (const s of spans) {
		const b = y(d, s.base), t = y(d, s.top);
		if (b === null || t === null) return { refused: 'unresolved-reference' };
		if (sill < b - TOL || sill + o.h > t + TOL) return { refused: 'opening-outside-solid' };
	}
	for (const s of slabs) if (s.u0 < o.u1 - TOL && s.u1 > o.u0 + TOL) {
		const t = y(d, s.top);
		if (t !== null && sill < t - TOL && sill + o.h > t - s.thick + TOL) return { refused: 'opening-intersects-slab' };
	}
	return { ok: true };
}

const D0: Datums = { G: 0, Dw: 0, De: 1.2 };

describe('V2 shared-Wall vertical topology', () => {
	const rec = recorder('v2-shared-wall');

	it('closure, overlap and fragment count at rest and after moving the east datum to 1.5 m', () => {
		for (const alt of ['S', 'I', 'U'] as const) {
			const f = facade(alt);
			const r0 = sectionGapAndOverlap(f, D0);
			const r1 = sectionGapAndOverlap(f, { ...D0, De: 1.5 });
			// hand oracle: S/I leave the east façade open below the east slab underside: 5 m × 1.0 m, then × 1.3 m
			const want = alt === 'U' ? [0, 0] : [5.0, 6.5];
			rec.row(`V2.1${alt} façade gap m² (rest, De=1.5)`, alt === 'U' ? 'pass' : 'fail',
				Math.abs(r0.gap - 0) <= TOL && Math.abs(r1.gap - 0) <= TOL ? 'pass' : 'fail',
				{ gap0: r0.gap, gap1: r1.gap, handOracle: want, overlap: [r0.overlap, r1.overlap], extraJunctions: f.extraJunctions, wallIds: f.walls.map((w) => w.id) });
			expect(Math.abs(r0.gap - want[0]!) <= TOL && Math.abs(r1.gap - want[1]!) <= TOL).toBe(true);
		}
		// S/I can close to ground only with base = De − 1.2 (a negative offset): the next De move reopens the gap.
		const patched = facade('I');
		patched.walls[0]!.spans[1]!.base = { datum: 'De', off: -1.2 };
		const p0 = sectionGapAndOverlap(patched, D0), p1 = sectionGapAndOverlap(patched, { ...D0, De: 1.5 });
		rec.row('V2.1I-patched base De−1.2 closes at rest, reopens 1.5 m² after De move', 'fail', p1.gap <= TOL ? 'pass' : 'fail', { gap0: p0.gap, gap1: p1.gap });
	});

	it('an Opening crossing the floor step (window u 4..6, sill 2.0 m world, 0.8 m high)', () => {
		const byDatum: Opening = { id: 'win', host: 'south', u0: 4, u1: 6, sill: { datum: 'Dw', off: 2.0 }, h: 0.8 };
		const byBase: Opening = { ...byDatum, sill: { hostBase: 2.0 } };
		const out: Record<string, unknown> = {};
		for (const alt of ['S', 'I', 'U'] as const) {
			out[`${alt}.datumSill`] = qualifyOpening(facade(alt), D0, byDatum);
			out[`${alt}.hostBaseSill`] = qualifyOpening(facade(alt), D0, byBase);
		}
		const okU = 'ok' in (out['U.datumSill'] as object) && 'ok' in (out['U.hostBaseSill'] as object);
		rec.row('V2.2 window across step', 'pass', okU ? 'pass' : 'fail', out);
		// a door at the step intersects the east slab edge under every alternative: an honest refusal, not a fragment
		const door: Opening = { id: 'door', host: 'south', u0: 4.5, u1: 5.5, sill: { datum: 'Dw', off: 0 }, h: 2.1 };
		rec.row('V2.3 door across the step refuses (slab edge)', 'refuse',
			(qualifyOpening(facade('U'), D0, door) as { refused?: string }).refused === 'opening-intersects-slab' ? 'refuse' : 'fail',
			{ U: qualifyOpening(facade('U'), D0, door), I: qualifyOpening(facade('I'), D0, door), S: qualifyOpening(facade('S'), D0, door) });
		// datum-referenced sill follows its datum; host-base sill stays with the wall base
		const moved = qualifyOpening(facade('U'), { ...D0, Dw: 0.6 }, byDatum);
		rec.row('V2.4 Dw raised 0.6: datum-sill window still valid under U', 'pass', 'ok' in moved ? 'pass' : 'fail', { moved });
	});

	it('delete one datum: exactly its references become unresolved, no retarget', () => {
		const out: Record<string, string[]> = {};
		for (const alt of ['S', 'I', 'U'] as const) out[alt] = sectionGapAndOverlap(facade(alt), { G: 0, Dw: 0 }).unresolved;
		rec.row('V2.5 delete De', 'pass',
			JSON.stringify(out) === JSON.stringify({ S: ['south.e/all'], I: ['south/ie'], U: ['south/te'] }) ? 'pass' : 'fail', out);
	});

	it('equal-XZ stacked Walls on different datums and partial plan overlap', () => {
		// two physical Walls on the same line: ground Wall u 0..5, base G, top Tg; upper Wall u 2..8 base Dm=2.0, top Dm+3
		const stack = (tg: number, u0Upper: number): Facade => ({ alt: 'U', extraJunctions: 0, walls: [
			{ id: 'ground', spans: [{ id: 's', u0: 0, u1: 5, base: { datum: 'G', off: 0 }, top: { datum: 'G', off: tg } }] },
			{ id: 'upper', spans: [{ id: 's', u0: u0Upper, u1: 8, base: { datum: 'Dm', off: 0 }, top: { datum: 'Dm', off: 3 } }] }
		] });
		const d = { ...D0, Dm: 2.0 };
		const abut = sectionGapAndOverlap(stack(2.0, 2), d).overlap;
		const clash = sectionGapAndOverlap(stack(3.0, 2), d).overlap; // 1.0 m vertical × 3 m shared run
		rec.row('V2.6 stacked abutting Walls: no duplicate solid', 'pass', abut <= TOL ? 'pass' : 'fail', { overlap: abut });
		rec.row('V2.7 stacked clashing Walls: duplicate solid detected (must refuse or be one Wall)', 'refuse',
			Math.abs(clash - 3.0) <= TOL ? 'refuse' : 'fail', { overlap_m2: clash, handOracle: 3.0 });
	});

	it('reversing the canonical Wall direction remaps interval / profile stations and keeps their ids', () => {
		for (const alt of ['I', 'U'] as const) {
			const f = facade(alt);
			const L = 10;
			const rev: Facade = { ...f, walls: f.walls.map((w) => ({ ...w, spans: w.spans.map((s) => ({ ...s, u0: L - s.u1, u1: L - s.u0 })).reverse() })) };
			// mirrored section must have the same gap/overlap totals; zones and slabs are mirrored for the check
			const mirror = (fn: () => ReturnType<typeof sectionGapAndOverlap>) => fn();
			const a = sectionGapAndOverlap(f, D0);
			const savedZ = zones.map((z) => ({ ...z })), savedS = slabs.map((s) => ({ ...s }));
			zones.forEach((z) => { const u0 = L - z.u1; z.u1 = L - z.u0; z.u0 = u0; });
			slabs.forEach((s) => { const u0 = L - s.u1; s.u1 = L - s.u0; s.u0 = u0; });
			const b = mirror(() => sectionGapAndOverlap(rev, D0));
			savedZ.forEach((z, i) => Object.assign(zones[i]!, z));
			savedS.forEach((s, i) => Object.assign(slabs[i]!, s));
			const ids = (x: Facade) => x.walls.flatMap((w) => w.spans.map((s) => s.id)).sort();
			rec.row(`V2.8${alt} reverse: same section totals, same span ids`, 'pass',
				Math.abs(a.gap - b.gap) <= TOL && JSON.stringify(ids(f)) === JSON.stringify(ids(rev)) ? 'pass' : 'fail', { a, b });
		}
	});

	it('flush', () => {
		expect(rec.flush({ tolerance_m2: TOL })).toEqual([]);
	});
});
