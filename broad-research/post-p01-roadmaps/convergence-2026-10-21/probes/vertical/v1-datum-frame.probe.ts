// V1 — datum / frame semantics under alternatives A (global storeys), B (local datums in structure frames) and
// C (per-element elevations, levels inferred by 0.05 m bins as P3 `settle.ts:levelArrangements` does).
// Hand-constructed data + evaluators; NOT a production schema. Names are probe-local.
//
// Tolerances (declared before running): world coordinates |Δ| <= 1e-9 m over a local range of ±100 m;
// "moved" means any evaluated coordinate changed by > 1e-9 m. Identity comparisons are exact strings.
// Expected world points are hand-calculated literals, not produced by the evaluator under test.
import { describe, expect, it } from 'vitest';
import { recorder } from './emit';

const TOL = 1e-9;
type V3 = [number, number, number];
type XZ = [number, number];

// ---------------------------------------------------------------- B: frames + datums + element refs
type Frame = { id: string; parent: string | null; t: V3; yawDeg: number; scale?: number; tiltDeg?: number; mirror?: boolean };
type Datum = { id: string; frame: string; y: number };
type VRef = { datum: string; off: number };
type Top = { kind: 'height'; h: number } | { kind: 'datum'; ref: VRef } | { kind: 'roof-eave'; roof: string };
type Wall = { id: string; frame: string; a: XZ; b: XZ; base: VRef; top: Top };
type Slab = { id: string; frame: string; outline: XZ[]; top: VRef };
type Roof = { id: string; frame: string; outline: XZ[]; eave: VRef | { wallTop: string } };
// Isolated organization: a cross-structure relation is a declared record, evaluated as validity, never a shared Junction.
type Connection = { id: string; element: string; end: 'a' | 'b'; anchor: { wall: string; end: 'a' | 'b' }; meetsDatum: string };
type ModelB = { frames: Frame[]; datums: Datum[]; walls: Wall[]; slabs: Slab[]; roofs: Roof[]; connections: Connection[] };

type Refusal = { refused: string; subject: string };
const isRefusal = (x: unknown): x is Refusal => typeof x === 'object' && x !== null && 'refused' in x;

function frameChain(m: ModelB, id: string): Frame[] | Refusal {
	const byId = new Map(m.frames.map((f) => [f.id, f]));
	const out: Frame[] = [];
	const seen = new Set<string>();
	let cur: string | null = id;
	while (cur !== null) {
		if (seen.has(cur)) return { refused: 'cyclic-frame', subject: id };
		seen.add(cur);
		const f = byId.get(cur);
		if (!f) return { refused: 'missing-frame', subject: cur };
		if (![...f.t, f.yawDeg].every(Number.isFinite)) return { refused: 'non-finite-frame', subject: f.id };
		if (f.scale !== undefined && f.scale === 0) return { refused: 'noninvertible-frame', subject: f.id };
		if ((f.scale ?? 1) !== 1 || (f.tiltDeg ?? 0) !== 0 || f.mirror)
			return { refused: 'unsupported-frame-transform', subject: f.id }; // declared unsupported, never flattened
		out.push(f);
		cur = f.parent;
	}
	return out;
}
function toWorld(m: ModelB, frame: string, p: V3): V3 | Refusal {
	const chain = frameChain(m, frame);
	if (isRefusal(chain)) return chain;
	let [x, y, z] = p;
	for (const f of chain) {
		const r = (f.yawDeg * Math.PI) / 180;
		// exact quarter turns keep the hand-calculated oracle exact (cos/sin of 90° are not exactly 0/1 in floats)
		const q = ((f.yawDeg % 360) + 360) % 360;
		const [c, s] = q === 0 ? [1, 0] : q === 90 ? [0, 1] : q === 180 ? [-1, 0] : q === 270 ? [0, -1] : [Math.cos(r), Math.sin(r)];
		[x, y, z] = [x * c + z * s + f.t[0], y + f.t[1], -x * s + z * c + f.t[2]];
	}
	return [x, y, z];
}
function datumY(m: ModelB, ref: VRef): number | Refusal {
	const d = m.datums.find((q) => q.id === ref.datum);
	if (!d) return { refused: 'unresolved-datum', subject: ref.datum };
	const w = toWorld(m, d.frame, [0, d.y + ref.off, 0]);
	return isRefusal(w) ? w : w[1];
}
// Evaluate every element to world coordinates, or a typed refusal per element. No proximity, no bins.
function evaluateB(m: ModelB, depth = 0): Map<string, number[] | Refusal> {
	const out = new Map<string, number[] | Refusal>();
	const wallTop = (w: Wall, seen: Set<string>): number | Refusal => {
		if (w.top.kind === 'height') {
			const b = datumY(m, w.base);
			return isRefusal(b) ? b : b + w.top.h;
		}
		if (w.top.kind === 'datum') return datumY(m, w.top.ref);
		const roof = m.roofs.find((r) => r.id === (w.top as { roof: string }).roof);
		if (!roof) return { refused: 'unresolved-roof', subject: w.id };
		if ('wallTop' in roof.eave) {
			if (seen.has(roof.id)) return { refused: 'cyclic-dependency', subject: w.id };
			const other = m.walls.find((q) => q.id === (roof.eave as { wallTop: string }).wallTop);
			if (!other) return { refused: 'unresolved-wall', subject: roof.id };
			return wallTop(other, new Set([...seen, roof.id]));
		}
		return datumY(m, roof.eave);
	};
	for (const w of m.walls) {
		const base = datumY(m, w.base);
		const top = wallTop(w, new Set());
		const a = toWorld(m, w.frame, [w.a[0], 0, w.a[1]]);
		const b = toWorld(m, w.frame, [w.b[0], 0, w.b[1]]);
		const bad = [base, top, a, b].find(isRefusal);
		out.set(w.id, bad ? (bad as Refusal) : [(a as V3)[0], (a as V3)[2], (b as V3)[0], (b as V3)[2], base as number, top as number]);
	}
	for (const s of m.slabs) {
		const y = datumY(m, s.top);
		const pts = s.outline.map((p) => toWorld(m, s.frame, [p[0], 0, p[1]]));
		const bad = [y, ...pts].find(isRefusal);
		out.set(s.id, bad ? (bad as Refusal) : [...pts.flatMap((p) => [(p as V3)[0], (p as V3)[2]]), y as number]);
	}
	for (const r of m.roofs) {
		let y: number | Refusal;
		if ('wallTop' in r.eave) {
			const w = m.walls.find((q) => q.id === (r.eave as { wallTop: string }).wallTop);
			const ev = w ? out.get(w.id) : { refused: 'unresolved-wall', subject: r.id };
			y = !ev ? { refused: 'unresolved-wall', subject: r.id } : isRefusal(ev) ? ev : ev[5]!;
		} else y = datumY(m, r.eave);
		const pts = r.outline.map((p) => toWorld(m, r.frame, [p[0], 0, p[1]]));
		const bad = [y, ...pts].find(isRefusal);
		out.set(r.id, bad ? (bad as Refusal) : [...pts.flatMap((p) => [(p as V3)[0], (p as V3)[2]]), y as number]);
	}
	void depth;
	return out;
}
// Declared connections are validity, not motion: report the gap; never move either side.
function connectionGaps(m: ModelB, ev: Map<string, number[] | Refusal>) {
	return m.connections.map((c) => {
		const el = ev.get(c.element), an = ev.get(c.anchor.wall);
		if (!el || !an || isRefusal(el) || isRefusal(an)) return { id: c.id, state: 'unresolved' as const, gap: NaN };
		const p = c.end === 'a' ? [el[0], el[1]] : [el[2], el[3]];
		const q = c.anchor.end === 'a' ? [an[0], an[1]] : [an[2], an[3]];
		const gap = Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!);
		// vertical: the element's base must meet the declared datum on the other structure
		const meet = datumY(m, { datum: c.meetsDatum, off: 0 });
		const dy = isRefusal(meet) ? NaN : Math.abs(el[4]! - meet);
		return { id: c.id, state: gap <= 1e-6 && dy <= 1e-6 ? ('joined' as const) : ('broken' as const), gap, dy };
	});
}
function movedSet(before: Map<string, number[] | Refusal>, after: Map<string, number[] | Refusal>): string[] {
	const ids = new Set([...before.keys(), ...after.keys()]);
	const moved: string[] = [];
	for (const id of ids) {
		const a = before.get(id), b = after.get(id);
		if (!a || !b || isRefusal(a) || isRefusal(b)) { if (JSON.stringify(a) !== JSON.stringify(b)) moved.push(id); continue; }
		if (a.length !== b.length || a.some((v, i) => Math.abs(v - b[i]!) > TOL)) moved.push(id);
	}
	return moved.sort();
}
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------- the first-consumer pavilion fixture
// S1 west pavilion (frame F1 at origin): ground D1g 0, mezzanine D1m 3.024, basement D1b -3.0.
// S2 east pavilion (frame F2 at (20,0,5), yaw 90°): ground D2g 0, upper D2u 3.024 (equal height, unrelated).
// Bridge B (project frame F0) spans from S1 mezzanine edge wall to S2 upper edge wall at 3.024.
function fixtureB(): ModelB {
	return {
		frames: [
			{ id: 'F0', parent: null, t: [0, 0, 0], yawDeg: 0 },
			{ id: 'F1', parent: 'F0', t: [0, 0, 0], yawDeg: 0 },
			{ id: 'F2', parent: 'F0', t: [20, 0, 5], yawDeg: 90 }
		],
		datums: [
			{ id: 'D1g', frame: 'F1', y: 0 }, { id: 'D1m', frame: 'F1', y: 3.024 }, { id: 'D1b', frame: 'F1', y: -3.0 },
			{ id: 'D2g', frame: 'F2', y: 0 }, { id: 'D2u', frame: 'F2', y: 3.024 }
		],
		walls: [
			{ id: 'S1.w.south', frame: 'F1', a: [0, 0], b: [10, 0], base: { datum: 'D1g', off: 0 }, top: { kind: 'height', h: 6 } },
			{ id: 'S1.w.guard', frame: 'F1', a: [6, 4], b: [10, 4], base: { datum: 'D1m', off: 0 }, top: { kind: 'height', h: 1.1 } },
			{ id: 'S1.w.shelf', frame: 'F1', a: [6, 2], b: [8, 2], base: { datum: 'D1m', off: 0.002 }, top: { kind: 'height', h: 0.9 } },
			{ id: 'S1.w.east', frame: 'F1', a: [10, 0], b: [10, 6], base: { datum: 'D1g', off: 0 }, top: { kind: 'roof-eave', roof: 'S1.roof' } },
			{ id: 'S2.w.west', frame: 'F2', a: [2, 1], b: [2, 7], base: { datum: 'D2g', off: 0 }, top: { kind: 'datum', ref: { datum: 'D2u', off: 3 } } },
			{ id: 'S2.w.rail', frame: 'F2', a: [3, 1], b: [3, 7], base: { datum: 'D2u', off: 0 }, top: { kind: 'height', h: 1.0 } },
			{ id: 'BR.w.rail', frame: 'F0', a: [10, 3], b: [21, 3], base: { datum: 'D1m', off: 0 }, top: { kind: 'height', h: 1.0 } }
		],
		slabs: [
			{ id: 'S1.slab.mezz', frame: 'F1', outline: [[6, 0], [10, 0], [10, 4], [6, 4]], top: { datum: 'D1m', off: 0 } },
			{ id: 'S1.slab.base', frame: 'F1', outline: [[0, 0], [10, 0], [10, 6], [0, 6]], top: { datum: 'D1b', off: 0 } },
			{ id: 'S2.slab.upper', frame: 'F2', outline: [[0, 0], [8, 0], [8, 8], [0, 8]], top: { datum: 'D2u', off: 0 } }
		],
		roofs: [{ id: 'S1.roof', frame: 'F1', outline: [[-0.45, -0.45], [10.45, -0.45], [10.45, 6.45], [-0.45, 6.45]], eave: { datum: 'D1g', off: 6 } }],
		connections: [{ id: 'BR.to.S2', element: 'BR.w.rail', end: 'b', anchor: { wall: 'S2.w.west', end: 'a' }, meetsDatum: 'D2u' }]
	};
}

// ---------------------------------------------------------------- A and C encodings of the same fixture (world coordinates)
type ElemAC = { id: string; structure: string /* for the oracle only; A/C models cannot see it */; y: number; storey?: string };
const elementsAC = (): ElemAC[] => [
	{ id: 'S1.w.south', structure: 'S1', y: 0 }, { id: 'S1.w.guard', structure: 'S1', y: 3.024 },
	{ id: 'S1.w.shelf', structure: 'S1', y: 3.026 }, { id: 'S1.slab.mezz', structure: 'S1', y: 3.024 },
	{ id: 'S1.slab.base', structure: 'S1', y: -3.0 }, { id: 'S2.w.west', structure: 'S2', y: 0 },
	{ id: 'S2.w.rail', structure: 'S2', y: 3.024 }, { id: 'S2.slab.upper', structure: 'S2', y: 3.024 },
	{ id: 'BR.w.rail', structure: 'BR', y: 3.024 }
];
const bin = (y: number) => Math.round(y / 0.05); // P3 settle.ts levelArrangements-style banding

describe('V1 datum/frame semantics', () => {
	const rec = recorder('v1-datum-frame');

	it('hand-calculated world points (B)', () => {
		const ev = evaluateB(fixtureB());
		const w = ev.get('S2.w.west') as number[];
		// F2: yaw 90° maps local (x,z) -> (z, -x); a=(2,1) -> (1,-2) + (20,5) = (21,3); b=(2,7) -> (7,-2)+(20,5) = (27,3)
		const want = [21, 3, 27, 3, 0, 6.024];
		const ok = w.every((v, i) => Math.abs(v - want[i]!) <= TOL);
		rec.row('V1.0 world points match hand calculation', 'pass', ok ? 'pass' : 'fail', { got: w, want });
		const gaps = connectionGaps(fixtureB(), ev);
		rec.row('V1.0b bridge declared connection joined at rest', 'pass', gaps[0]!.state === 'joined' ? 'pass' : 'fail', { gaps });
	});

	it('raise S1 mezzanine datum by +0.3 m: moved sets under A / B / C', () => {
		const expected = ['BR.w.rail', 'S1.slab.mezz', 'S1.w.guard', 'S1.w.shelf'];
		// B: explicit references decide membership
		const m = fixtureB();
		const before = evaluateB(m);
		const m2 = clone(m);
		m2.datums.find((d) => d.id === 'D1m')!.y = 3.324;
		const movedB = movedSet(before, evaluateB(m2));
		rec.row('V1.1B raise datum (explicit refs)', 'pass', JSON.stringify(movedB) === JSON.stringify(expected) ? 'pass' : 'fail', { movedB, expected });
		// A: one global storey at 3.024 owns S1 mezzanine, S2 upper and the bridge; shelf at +0.002 is an offset on it
		const movedA = elementsAC().filter((e) => Math.abs(e.y - 3.024) < 0.01).map((e) => e.id).sort();
		rec.row('V1.1A raise global storey moves unrelated S2', 'fail', JSON.stringify(movedA) === JSON.stringify(expected) ? 'pass' : 'fail', {
			movedA, unrelatedMoved: movedA.filter((id) => id.startsWith('S2'))
		});
		// C: membership by 0.05 m bin of the edited element's height
		const movedC = elementsAC().filter((e) => bin(e.y) === bin(3.024)).map((e) => e.id).sort();
		rec.row('V1.1C bin inference splits 3.024/3.026 and captures S2', 'fail', JSON.stringify(movedC) === JSON.stringify(expected) ? 'pass' : 'fail', {
			movedC, bins: { '3.024': bin(3.024), '3.026': bin(3.026) },
			missed: expected.filter((id) => !movedC.includes(id)), unrelatedMoved: movedC.filter((id) => id.startsWith('S2'))
		});
		const gaps = connectionGaps(m2, evaluateB(m2));
		// the bridge references S1's datum; its S2 end now misses D2u by 0.3 m and is REPORTED, not silently followed
		rec.row('V1.1B bridge reported broken (vertical) after S1 datum raise', 'pass', gaps[0]!.state === 'broken' && Math.abs(gaps[0]!.dy - 0.3) <= 1e-9 ? 'pass' : 'fail', { gaps });
	});

	it('rotate S2 by a further 90°: rigid in B-isolated; host expansion deforms', () => {
		const m = fixtureB();
		const before = evaluateB(m);
		const m2 = clone(m);
		m2.frames.find((f) => f.id === 'F2')!.yawDeg = 180;
		const after = evaluateB(m2);
		const moved = movedSet(before, after);
		const expected = ['S2.slab.upper', 'S2.w.rail', 'S2.w.west'];
		// rigidity: pairwise distances inside S2 unchanged
		const pts = (ev: Map<string, number[] | Refusal>) => ['S2.w.west', 'S2.w.rail'].flatMap((id) => { const v = ev.get(id) as number[]; return [[v[0]!, v[1]!], [v[2]!, v[3]!]]; });
		const d = (p: number[][]) => p.flatMap((a, i) => p.slice(i + 1).map((b) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!)));
		const rigid = d(pts(before)).every((v, i) => Math.abs(v - d(pts(after))[i]!) <= TOL);
		const gaps = connectionGaps(m2, after);
		rec.row('V1.2B-isolated rotate moves exactly S2, rigidly; bridge reported broken, not moved', 'pass',
			JSON.stringify(moved) === JSON.stringify(expected) && rigid && gaps[0]!.state === 'broken' ? 'pass' : 'fail',
			{ moved, expected, rigid, gaps });
		// Host expansion with a Junction shared across frames: the shared Junction lives in ONE frame (F0 here).
		// S2.w.west.a is bound to it, so after the S2 rotation the end bound to the F0 Junction stays put.
		const sharedJ: V3 = [21, 0, 3];
		const w = after.get('S2.w.west') as number[];
		const freeEnd = [w[2]!, w[3]!];
		const lenBefore = 6, lenAfter = Math.hypot(freeEnd[0]! - sharedJ[0], freeEnd[1]! - sharedJ[2]);
		rec.row('V1.2H host expansion with cross-frame shared Junction deforms S2', 'fail', Math.abs(lenAfter - lenBefore) <= TOL ? 'pass' : 'fail', {
			wallLengthBefore: lenBefore, wallLengthAfter: lenAfter, note: 'a whole-structure rigid transform is not rigid when one Junction belongs to another frame'
		});
	});

	it('edit eave, Wall-top follows roof, and cycle refusal', () => {
		const m = fixtureB();
		const before = evaluateB(m);
		const m2 = clone(m);
		(m2.roofs[0]!.eave as VRef).off = 5.5;
		const moved = movedSet(before, evaluateB(m2));
		rec.row('V1.3 eave edit moves roof and the one Wall whose top is declared roof-eave', 'pass',
			JSON.stringify(moved) === JSON.stringify(['S1.roof', 'S1.w.east']) ? 'pass' : 'fail', { moved });
		const m3 = clone(m);
		m3.roofs[0]!.eave = { wallTop: 'S1.w.east' }; // eave follows wall top while wall top follows eave
		const ev3 = evaluateB(m3);
		const r = ev3.get('S1.w.east');
		rec.row('V1.4 roof↔Wall-top cycle refuses', 'refuse', isRefusal(r) && r.refused === 'cyclic-dependency' ? 'refuse' : 'fail', { result: r });
	});

	it('frame refusals and unsupported transforms', () => {
		const cases: [string, (m: ModelB) => void, string][] = [
			['missing parent', (m) => { m.frames[2]!.parent = 'F9'; }, 'missing-frame'],
			['cycle', (m) => { m.frames[0]!.parent = 'F2'; }, 'cyclic-frame'],
			['scale 0', (m) => { m.frames[2]!.scale = 0; }, 'noninvertible-frame'],
			['tilt', (m) => { m.frames[2]!.tiltDeg = 5; }, 'unsupported-frame-transform'],
			['mirror', (m) => { m.frames[2]!.mirror = true; }, 'unsupported-frame-transform'],
			['delete datum D2u', (m) => { m.datums = m.datums.filter((d) => d.id !== 'D2u'); }, 'unresolved-datum']
		];
		for (const [name, mut, code] of cases) {
			const m = fixtureB();
			mut(m);
			const r = evaluateB(m).get('S2.w.rail');
			rec.row(`V1.5 ${name}`, 'refuse', isRefusal(r) && r.refused === code ? 'refuse' : 'fail', { result: r });
		}
		// A deleted datum leaves the referencing element unresolved: no retarget to the nearest datum at 3.024.
		const m = fixtureB();
		m.datums = m.datums.filter((d) => d.id !== 'D2u');
		const ev = evaluateB(m);
		const unresolved = [...ev.entries()].filter(([, v]) => isRefusal(v)).map(([k]) => k).sort();
		rec.row('V1.5b delete datum: exactly its dependants unresolved', 'pass',
			JSON.stringify(unresolved) === JSON.stringify(['S2.slab.upper', 'S2.w.rail', 'S2.w.west']) ? 'pass' : 'fail', { unresolved });
	});

	it('nested repeated definitions: qualified identity, transforms, serialize/reload, undo/redo', () => {
		type Def = { id: string; walls: { id: string; a: XZ; b: XZ }[]; instances: { id: string; def: string; t: V3; yawDeg: number }[] };
		const defs: Record<string, Def> = {
			bay: { id: 'bay', walls: [{ id: 'w', a: [0, 0], b: [3, 0] }], instances: [] },
			pav: { id: 'pav', walls: [{ id: 'core', a: [0, 0], b: [0, 6] }], instances: [{ id: 'b1', def: 'bay', t: [0, 0, 0], yawDeg: 0 }, { id: 'b2', def: 'bay', t: [0, 0, 6], yawDeg: 0 }] }
		};
		type Proj = { defs: Record<string, Def>; roots: { id: string; def: string; t: V3; yawDeg: number }[] };
		const proj: Proj = { defs, roots: [{ id: 'P1', def: 'pav', t: [0, 0, 40], yawDeg: 0 }, { id: 'P2', def: 'pav', t: [30, 0, 40], yawDeg: 90 }] };
		const expand = (p: Proj) => {
			const out = new Map<string, number[]>();
			const walk = (defId: string, path: string[], frames: Frame[]) => {
				const d = p.defs[defId]!;
				const model: ModelB = { frames, datums: [], walls: [], slabs: [], roofs: [], connections: [] };
				for (const w of d.walls) {
					const a = toWorld(model, frames[frames.length - 1]!.id, [w.a[0], 0, w.a[1]]) as V3;
					const b = toWorld(model, frames[frames.length - 1]!.id, [w.b[0], 0, w.b[1]]) as V3;
					out.set([...path, w.id].join('/'), [a[0], a[2], b[0], b[2]]);
				}
				for (const i of d.instances) {
					const fid = [...path, i.id].join('/');
					walk(i.def, [...path, i.id], [...frames, { id: fid, parent: frames[frames.length - 1]!.id, t: i.t, yawDeg: i.yawDeg }]);
				}
			};
			for (const r of p.roots) walk(r.def, [r.id], [{ id: r.id, parent: null, t: r.t, yawDeg: r.yawDeg }]);
			return out;
		};
		const e0 = expand(proj);
		// P2/b2/w: local (0,0)-(3,0) in b2 at (0,0,6) -> pav (0,6)-(3,6); yaw 90 (x,z)->(z,-x): (6,0)-(6,-3); + (30,40)
		const want = [36, 40, 36, 37];
		const got = e0.get('P2/b2/w')!;
		rec.row('V1.6 nested instance world point', 'pass', got.every((v, i) => Math.abs(v - want[i]!) <= TOL) ? 'pass' : 'fail', { got, want, ids: [...e0.keys()] });
		const reloaded = expand(JSON.parse(JSON.stringify(proj)));
		rec.row('V1.7 serialize/reload: identical qualified ids and coordinates', 'pass',
			JSON.stringify([...reloaded]) === JSON.stringify([...e0]) ? 'pass' : 'fail', { count: reloaded.size });
		// edit the bay definition: every instance path that expands it moves; edit one root transform: only its subtree
		const p1 = clone(proj); p1.defs.bay!.walls[0]!.b = [4, 0];
		const movedDef = [...expand(p1)].filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(e0.get(k))).map(([k]) => k).sort();
		const p2 = clone(proj); p2.roots[1]!.t = [31, 0, 40];
		const movedInst = [...expand(p2)].filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(e0.get(k))).map(([k]) => k).sort();
		rec.row('V1.8 definition edit vs instance edit moved sets', 'pass',
			JSON.stringify(movedDef) === JSON.stringify(['P1/b1/w', 'P1/b2/w', 'P2/b1/w', 'P2/b2/w']) &&
				JSON.stringify(movedInst) === JSON.stringify(['P2/b1/w', 'P2/b2/w', 'P2/core']) ? 'pass' : 'fail', { movedDef, movedInst });
		// undo/redo as snapshot restore of authored source; derived expansion is recomputed, never stored
		const history = [clone(proj), p2];
		const undone = expand(history[0]!), redone = expand(history[1]!);
		rec.row('V1.9 undo/redo restores identical expansion', 'pass',
			JSON.stringify([...undone]) === JSON.stringify([...e0]) && JSON.stringify([...redone]) === JSON.stringify([...expand(p2)]) ? 'pass' : 'fail', {});
	});

	it('flush', () => {
		expect(rec.flush({ tolerance_m: TOL })).toEqual([]);
	});
});
