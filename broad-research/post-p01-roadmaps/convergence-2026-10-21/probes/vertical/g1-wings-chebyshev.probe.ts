// G1 (bounded) — #171 §7 S-B: does P3's greedy wing cover + hipLo/hipHi choice equal the equal-pitch closed form
// `k · L∞-distance-to-outline` (the harvest's Chebyshev oracle, claimed equal to the straight skeleton)?
// Reuses prototypes/p3-vellum source + tests/support/roofProbe.ts fixtures read-only. No new dependency.
//
// Oracle (independent of P3): for an outline whose edges are axis-aligned in the roof frame, the L∞ distance from a
// point to an axis-aligned segment is max(dist of the along-coordinate to the segment interval, |across offset|);
// the oracle height is k · min over edges. k = peak / (primarySpan / 2) for P3's linear gable preset, hip set to
// primarySpan / 2 so every exposed end has the side pitch.
// Tolerances (declared before running): evaluator vs oracle 1e-9 m; mesh vs oracle 1e-5 m (float mesh).
// Sampling: 0.1 m jittered grid over the whole outline, including points down to 1 mm from the boundary.
import { describe, expect, it } from 'vitest';
import { FOOTPRINTS, hitsAt } from '../../../../../prototypes/p3-vellum/tests/support/roofProbe';
import { ohH, presetProfile } from '../../../../../prototypes/p3-vellum/src/model/overheadGeom';
import { roofWingsState } from '../../../../../prototypes/p3-vellum/src/model/wings';
import { buildOverhead } from '../../../../../prototypes/p3-vellum/src/scene/build/overheads';
import { pointInPoly, distToPolyEdge, type V2 } from '../../../../../prototypes/p3-vellum/src/model/geom2d';
import type { Overhead } from '../../../../../prototypes/p3-vellum/src/model/types';
import { recorder } from './emit';

const EXTRA: Record<string, V2[]> = {
	staircase: [[0, 0], [12, 0], [12, 12], [8, 12], [8, 8], [4, 8], [4, 4], [0, 4]],
	Z: [[0, 0], [8, 0], [8, 4], [12, 4], [12, 8], [4, 8], [4, 4], [0, 4]],
	'wide-stem T': [[0, 0], [12, 0], [12, 4], [10, 4], [10, 12], [2, 12], [2, 4], [0, 4]],
	'slit courtyard': [[0, 0], [5.9, 0], [5.9, 4], [4, 4], [4, 8], [8, 8], [8, 4], [6.1, 4], [6.1, 0], [12, 0], [12, 12], [0, 12]],
	'rectangle (control)': [[0, 0], [6, 0], [6, 10], [0, 10]]
};

function makeOh(outline: V2[], dir: number, hip: number): Overhead {
	return {
		id: 'g1', kind: 'overhead', name: 'Roof', outline, baseY: 3, dir, form: 'extrude', thick: 0.25,
		restsOn: null, restOffset: 0, fit: null, hip, oneSpan: false, order: 1, profile: presetProfile('gable', 6)
	} as Overhead;
}
const toFrame = (p: V2, dir: number): V2 => { const d: V2 = [Math.cos(dir), Math.sin(dir)]; return [p[0] * d[0] + p[1] * d[1], -p[0] * d[1] + p[1] * d[0]]; };
function chebyshev(q: V2, outline: V2[], dir: number): number {
	const p = toFrame(q, dir);
	let best = Infinity;
	for (let i = 0; i < outline.length; i++) {
		const a = toFrame(outline[i]!, dir), b = toFrame(outline[(i + 1) % outline.length]!, dir);
		const horiz = Math.abs(a[1] - b[1]) < 1e-6;
		const [lo, hi] = horiz ? [Math.min(a[0], b[0]), Math.max(a[0], b[0])] : [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
		const along = horiz ? p[0] : p[1], across = horiz ? Math.abs(p[1] - a[1]) : Math.abs(p[0] - a[0]);
		best = Math.min(best, Math.max(Math.max(0, lo - along, along - hi), across));
	}
	return best;
}
// same barycentric test as roofProbe.hitsAt, but inclusive of edges (>= -1e-9): a hit here and none there means the
// sample sits on a shared triangle edge, not in a hole
function relaxedHits(pos: ArrayLike<number>, x: number, z: number): number {
	let n = 0;
	for (let i = 0; i < pos.length; i += 9) {
		const ax = pos[i]!, az = pos[i + 2]!, bx = pos[i + 3]!, bz = pos[i + 5]!, cx = pos[i + 6]!, cz = pos[i + 8]!;
		const d = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
		if (Math.abs(d) < 1e-12) continue;
		const a = ((bx - x) * (cz - z) - (cx - x) * (bz - z)) / d, b = ((cx - x) * (az - z) - (ax - x) * (cz - z)) / d, c = 1 - a - b;
		if (a >= -1e-9 && b >= -1e-9 && c >= -1e-9) n++;
	}
	return n;
}
const xform = (pts: V2[], ang: number, t: V2): V2[] => pts.map(([x, z]) => [x * Math.cos(ang) - z * Math.sin(ang) + t[0], x * Math.sin(ang) + z * Math.cos(ang) + t[1]]);

describe('G1 P3 wing envelope vs equal-pitch Chebyshev', () => {
	const rec = recorder('g1-wings-chebyshev');
	const fixtures = { ...FOOTPRINTS, ...EXTRA };
	const variants: [string, number, V2, boolean][] = [
		['as-is', 0, [0, 0], false], ['rot30°', Math.PI / 6, [0, 0], false], ['translated 1e3', 0, [1000, 1000], false], ['reversed winding', 0, [0, 0], true]
	];
	for (const [name, base] of Object.entries(fixtures)) {
		for (const [vname, ang, t, rev] of variants) {
			it(`${name} / ${vname}`, () => {
				let outline = xform(base, ang, t);
				if (rev) outline = outline.slice().reverse();
				const probe = makeOh(outline, ang, 0);
				const st0 = roofWingsState(probe);
				const refSpan = st0.kind === 'compound' ? st0.primarySpan : null;
				if (st0.kind !== 'compound' && name !== 'rectangle (control)') {
					rec.row(`G1 ${name} / ${vname}`, 'untested', 'untested', { state: st0.kind, reason: (st0 as { reason?: string }).reason ?? null });
					return;
				}
				// control: single span along the 6 m side (dir axis); P3 hips it with its one cross profile
				const span = refSpan ?? 6;
				const oh = makeOh(outline, ang, span / 2);
				const peak = Math.max(...oh.profile.map((p) => p.h));
				const k = peak / (span / 2);
				const xs = outline.map((p) => p[0]), zs = outline.map((p) => p[1]);
				let n = 0, worst = 0, worstAt: V2 = [0, 0], over = 0, nearN = 0, nearWorst = 0;
				for (let x = Math.min(...xs) + 0.0137; x < Math.max(...xs); x += 0.1)
					for (let z = Math.min(...zs) + 0.0211; z < Math.max(...zs); z += 0.1) {
						const q: V2 = [x, z];
						if (!pointInPoly(q, outline)) continue;
						n++;
						const e = Math.abs(ohH(oh, q) - k * chebyshev(q, outline, ang));
						if (e > 1e-9) over++;
						if (e > worst) { worst = e; worstAt = q; }
						if (distToPolyEdge(q, outline) < 0.05) { nearN++; nearWorst = Math.max(nearWorst, e); }
					}
				// mesh vs oracle (independent of ohH) on the same interior grid, skipping 5 cm like probeRoof
				const pos = buildOverhead(oh, []).top.pos;
				let mN = 0, mGap = 0, mDouble = 0, mWorst = 0, mEdge = 0;
				const gapAt: number[][] = [];
				for (let x = Math.min(...xs) + 0.137; x < Math.max(...xs); x += 0.43)
					for (let z = Math.min(...zs) + 0.211; z < Math.max(...zs); z += 0.47) {
						const q: V2 = [x, z];
						if (!pointInPoly(q, outline) || distToPolyEdge(q, outline) < 0.05) continue;
						mN++;
						const ys = hitsAt(pos, x, z);
						if (!ys.length) { mGap++; if (relaxedHits(pos, x, z) > 0) mEdge++; else if (gapAt.length < 5) gapAt.push([+x.toFixed(3), +z.toFixed(3)]); continue; }
						if (ys.length > 1) mDouble++;
						mWorst = Math.max(mWorst, Math.abs(Math.max(...ys) - (oh.baseY + oh.thick + k * chebyshev(q, outline, ang))));
					}
				const st = roofWingsState(oh);
				const verdict = worst <= 1e-9 && mWorst <= 1e-5 && mGap - mEdge === 0 && mDouble === 0 ? 'pass' : 'fail';
				rec.row(`G1 ${name} / ${vname}`, verdict, verdict, {
					state: st.kind, wings: st.kind === 'compound' ? st.wings.map((w) => ({ rect: w.rect.map((v) => +v.toFixed(3)), span: w.span, ends: w.ends, hipLo: +w.hipLo.toFixed(3), hipHi: +w.hipHi.toFixed(3) })) : null,
					k, samples: n, overTol: over, maxErr_m: worst, worstAt: worstAt.map((v) => +v.toFixed(3)), nearBoundarySamples: nearN, nearBoundaryMaxErr_m: nearWorst,
					mesh: { samples: mN, gaps: mGap, gapsOnTriangleEdges: mEdge, trueHoleSamples: gapAt, double: mDouble, maxErr_m: mWorst }
				});
			});
		}
	}
	it('mesh error vs translation for the single-span hipped control (diagnostic)', () => {
		const out: Record<string, unknown>[] = [];
		for (const t of [0, 10, 100, 300, 1000]) {
			const outline = xform(EXTRA['rectangle (control)']!, 0, [t, t]);
			const oh = makeOh(outline, 0, 3);
			const k = Math.max(...oh.profile.map((p) => p.h)) / 3;
			const pos = buildOverhead(oh, []).top.pos;
			let worst = 0, at: number[] = [];
			for (let x = t + 0.137; x < t + 6; x += 0.43)
				for (let z = t + 0.211; z < t + 10; z += 0.47) {
					if (distToPolyEdge([x, z], outline) < 0.05) continue;
					const ys = hitsAt(pos, x, z);
					if (!ys.length) continue;
					const e = Math.abs(Math.max(...ys) - (oh.baseY + oh.thick + k * chebyshev([x, z], outline, 0)));
					if (e > worst) { worst = e; at = [+(x - t).toFixed(3), +(z - t).toFixed(3), ys.length]; }
				}
			out.push({ translation_m: t, meshMaxErr_m: worst, localAt: at, triangles: pos.length / 9 });
		}
		const bad = out.filter((r) => (r.meshMaxErr_m as number) > 1e-5).map((r) => r.translation_m);
		rec.row('G1.T single-span hipped mesh vs translation', 'fail', bad.length ? 'fail' : 'pass', { rows: out, failingTranslations: bad });
	});

	it('flush', () => {
		rec.flush({ evaluatorTol_m: 1e-9, meshTol_m: 1e-5, source: 'prototypes/p3-vellum @ HEAD (read-only)' });
		expect(true).toBe(true);
	});
});
