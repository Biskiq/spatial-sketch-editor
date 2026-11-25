import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { facePoseFromBounds } from '@portfolio/camera-core/viewport';
import {
	ALIGN_CARD_COVER_PX,
	ALIGN_INDEX_LANE_PX,
	chartToWorld,
	dragOffset,
	faceBoundsOf,
	faceScreenAxes,
	floorChart,
	handleLattice,
	handleMetersOf,
	offsetMetersOf,
	planFitBoundsOf,
	planScreenAxes,
	regionFraming,
	samplingOf,
	screenToUvDelta,
	snapOffset,
	tileGridLines,
	tileToUv,
	turnAbout,
	turnBy,
	uvToTile,
	wallSideChart,
	type AlignSampling
} from '$lib/authoring/look/align-chart';

/** The sampling graph's own arithmetic (`finish-sampling.ts` `sampleUv`), transcribed. */
function referenceSample(uv: readonly [number, number], s: AlignSampling): [number, number] {
	const cos = Math.cos(s.rotation);
	const sin = Math.sin(s.rotation);
	const cx = uv[0] - 0.5;
	const cy = uv[1] - 0.5;
	const rx = cx * cos + cy * sin;
	const ry = cx * -sin + cy * cos;
	return [rx * s.repeat[0] + 0.5 + s.offset[0], ry * s.repeat[1] + 0.5 + s.offset[1]];
}

const metric = (tile: [number, number], rotation = 0, offset: [number, number] = [0, 0]) =>
	samplingOf({ kind: 'target', metric: { tileMeters: tile, rotation, offset } }, [1, 1]);

describe('Align chart: the renderer sampling and its inverse', () => {
	it('matches the sampling graph and inverts exactly', () => {
		const s = metric([0.6, 0.4], 0.7, [0.25, 0.8]);
		expect(s.repeat[0]).toBeCloseTo(1 / 0.6, 12);
		expect(s.repeat[1]).toBeCloseTo(1 / 0.4, 12);
		for (const uv of [[0, 0], [3.2, 1.1], [-0.4, 2.5], [0.5, 0.5]] as const) {
			const t = uvToTile(uv, s);
			const ref = referenceSample(uv, s);
			expect(t[0]).toBeCloseTo(ref[0], 12);
			expect(t[1]).toBeCloseTo(ref[1], 12);
			const back = tileToUv(t, s);
			expect(back[0]).toBeCloseTo(uv[0], 10);
			expect(back[1]).toBeCloseTo(uv[1], 10);
		}
	});

	it('reads a uv mapping as tile fractions of native uv', () => {
		const s = samplingOf({ kind: 'uv', set: 0, repeat: [4, 2], rotation: 0, offset: [0.1, 0] }, [1, 1]);
		expect(s.tileMeters).toEqual([0.25, 0.5]);
		expect(s.offset).toEqual([0.1, 0]);
	});

	it('draws tile boundaries where t_x or t_y is an integer, clipped to the surface', () => {
		const chart = wallSideChart({
			start: [0, 0], startDistance: 0, tangent: [1, 0], normal: [0, 1], side: 'left',
			thickness: 0.2, length: 2, floorY: 0, topY: 1
		});
		const lines = tileGridLines(chart, metric([0.5, 0.5]))!;
		// t = 2·(uv − ½) + ½ → integers at uv ≡ 0.25 (mod 0.5)
		const xs = lines.filter((l) => l.axis === 'x').map((l) => l.from[0]).sort((a, b) => a - b);
		const ys = lines.filter((l) => l.axis === 'y').map((l) => l.from[1]).sort((a, b) => a - b);
		expect(xs.map((v) => Number(v.toFixed(6)))).toEqual([0.25, 0.75, 1.25, 1.75]);
		expect(ys.map((v) => Number(v.toFixed(6)))).toEqual([0.25, 0.75]);
		for (const line of lines) {
			for (const p of [line.from, line.to]) {
				const t = uvToTile(p, metric([0.5, 0.5]));
				expect(Math.abs(t[line.axis === 'x' ? 0 : 1] - line.k)).toBeLessThan(1e-9);
			}
		}
	});

	it('refuses an illegible grid instead of drawing thousands of lines', () => {
		const chart = floorChart({ floorY: 0, minX: 0, maxX: 50, minZ: 0, maxZ: 50 });
		expect(tileGridLines(chart, metric([0.02, 0.02]))).toBeNull();
	});

	it('places the square handle on a tile corner inside the surface', () => {
		const chart = floorChart({ floorY: 0, minX: 1, maxX: 4, minZ: 0, maxZ: 3 });
		const s = metric([0.8, 0.8], 0.4, [0.3, 0.6]);
		const { k, uv } = handleLattice(chart, s, [chart.uMin, chart.vMin]);
		const t = uvToTile(uv, s);
		expect(t[0]).toBeCloseTo(k[0], 9);
		expect(t[1]).toBeCloseTo(k[1], 9);
		expect(uv[0]).toBeGreaterThanOrEqual(chart.uMin - 1e-9);
		expect(uv[1]).toBeGreaterThanOrEqual(chart.vMin - 1e-9);
	});

	it('drags the held tile corner by the uv delta, snapped to 1 cm / 1 mm along the pattern', () => {
		const s = metric([0.5, 0.5], Math.PI / 6, [0.1, 0.2]);
		const k: [number, number] = [2, 3];
		const start = tileToUv(k, s);
		const offset = dragOffset(s, k, start, [0.3, -0.2], false);
		const moved = tileToUv(k, { ...s, offset });
		// The corner follows the pointer to within the snap; any whole-tile wrap is a lattice shift.
		const t = uvToTile([start[0] + 0.3, start[1] - 0.2], { ...s, offset });
		expect(Math.abs(t[0] - Math.round(t[0]))).toBeLessThan(0.01 / 0.5 + 1e-9);
		expect(Math.abs(t[1] - Math.round(t[1]))).toBeLessThan(0.01 / 0.5 + 1e-9);
		expect(Number.isFinite(moved[0])).toBe(true);
		const metres = offsetMetersOf({ ...s, offset });
		expect(Math.abs(metres[0] * 100 - Math.round(metres[0] * 100))).toBeLessThan(1e-6);
		expect(snapOffset([0.1234, 0.5], [1, 1], true)).toEqual([0.123, 0.5]);
		expect(snapOffset([0.1234, 0.5], [1, 1], false)).toEqual([0.12, 0.5]);
	});

	it('turns about the square handle: the held corner stays put', () => {
		const s = metric([0.6, 0.6], 0, [0.4, 0.1]);
		const k: [number, number] = [1, 1];
		const at = tileToUv(k, s);
		const turned = turnAbout(s, k, at, [1, 1], false);
		expect(turned.rotation).toBeCloseTo(Math.PI / 4, 9);
		const after = tileToUv(k, { ...s, ...turned });
		const t = uvToTile(at, { ...s, ...turned });
		expect(Math.abs(t[0] - Math.round(t[0]))).toBeLessThan(1e-5);
		expect(Math.abs(t[1] - Math.round(t[1]))).toBeLessThan(1e-5);
		expect(Number.isFinite(after[0])).toBe(true);
		expect(turnAbout(s, k, at, [Math.cos(0.3), Math.sin(0.3)], false).rotation).toBeCloseTo(Math.PI / 12, 9);
		expect(turnAbout(s, k, at, [Math.cos(0.3), Math.sin(0.3)], true).rotation).toBeCloseTo(0.3, 6);
		expect(turnBy(s, k, at, -Math.PI / 12).rotation).toBeCloseTo((23 * Math.PI) / 12, 9);
	});

	it('inverts the screen Jacobian, including a mirrored (back-side) chart', () => {
		const front = { du: [80, 0] as const, dv: [0, -80] as const };
		expect(screenToUvDelta(front, [40, -20])).toEqual([0.5, 0.25]);
		const back = { du: [-80, 0] as const, dv: [0, -80] as const };
		expect(screenToUvDelta(back, [40, 0])).toEqual([-0.5, -0]);
		expect(screenToUvDelta({ du: [1, 1], dv: [2, 2] }, [1, 0])).toBeNull();
	});

	it('charts a wall side on its own face: u along the centreline from the start, v up', () => {
		const left = wallSideChart({
			start: [1, 2], startDistance: 0, tangent: [0, 1], normal: [-1, 0], side: 'left',
			thickness: 0.2, length: 3, floorY: 0.5, topY: 3.5
		});
		const right = wallSideChart({
			start: [1, 2], startDistance: 0, tangent: [0, 1], normal: [-1, 0], side: 'right',
			thickness: 0.2, length: 3, floorY: 0.5, topY: 3.5
		});
		expect(chartToWorld(left, [0, 0])).toEqual([0.9, 0.5, 2]);
		expect(chartToWorld(right, [0, 0])).toEqual([1.1, 0.5, 2]);
		expect(chartToWorld(left, [3, 3])).toEqual([0.9, 3.5, 5]);
		expect(left.vMax).toBe(3);
	});

	it('charts a floor as u = x, v = −z', () => {
		const chart = floorChart({ floorY: 0.1, minX: -1, maxX: 2, minZ: 0, maxZ: 4 });
		expect([chart.uMin, chart.uMax, chart.vMin, chart.vMax]).toEqual([-1, 2, -4, -0]);
		expect(chartToWorld(chart, [2, -4])).toEqual([2, 0.1, 4]);
	});
});

describe('Align framing inside the chrome-free region', () => {
	const canvas = { width: 1440, height: 836 };
	const region = { x: 320, y: 71, width: 760, height: 520 };

	function projectOrtho(target: readonly number[], right: readonly number[], up: readonly number[], scale: number, p: readonly number[]) {
		const d = [p[0]! - target[0]!, p[1]! - target[1]!, p[2]! - target[2]!];
		return [
			canvas.width / 2 + scale * (d[0]! * right[0]! + d[1]! * right[1]! + d[2]! * right[2]!),
			canvas.height / 2 - scale * (d[0]! * up[0]! + d[1]! * up[1]! + d[2]! * up[2]!)
		];
	}

	it('centres an angled wall in the region at the fitting scale through camera-core face', () => {
		const look: [number, number, number] = [-Math.SQRT1_2, 0, -Math.SQRT1_2];
		const axes = faceScreenAxes(look);
		const center: [number, number, number] = [3, 1.4, 2];
		const f = regionFraming({ center, ...axes, surfaceMeters: [5, 2.8], canvas, region })!;
		expect(f.scale).toBeCloseTo(Math.min(760 / 5, 520 / 2.8), 9);
		const c = projectOrtho(f.target, axes.right, axes.up, f.scale, center);
		expect(c[0]).toBeCloseTo(region.x + region.width / 2, 6);
		expect(c[1]).toBeCloseTo(region.y + region.height / 2, 6);
		const pose = facePoseFromBounds({ bounds: faceBoundsOf(f, axes.right), look, rect: { left: 0, top: 0, devicePixelRatio: 1, ...canvas }, paddingFraction: 0 })!;
		expect(pose.targetPlaneHeightMeters).toBeCloseTo(canvas.height / f.scale, 6);
		expect(pose.target[0]).toBeCloseTo(f.target[0], 9);
		expect(pose.target[1]).toBeCloseTo(f.target[1], 9);
		expect(pose.target[2]).toBeCloseTo(f.target[2], 9);
	});

	it('uses the Plan reading axes at a quarter-snapped azimuth', () => {
		expect(planScreenAxes(0).right).toEqual([1, 0, -0]);
		expect(planScreenAxes(0).up).toEqual([-0, 0, -1]);
		const quarter = planScreenAxes(Math.PI / 2 + 0.2);
		expect(quarter.right[2]).toBeCloseTo(-1, 9);
		expect(quarter.up[0]).toBeCloseTo(-1, 9);
		const f = regionFraming({ center: [2, 0, 3], ...planScreenAxes(0), surfaceMeters: [4, 3], canvas, region })!;
		const b = planFitBoundsOf(f);
		// camera-core Plan fit: height = max(depth, width / aspect) with padding 0.
		const width = b.max[0] - b.min[0];
		const depth = b.max[2] - b.min[2];
		expect(Math.max(depth, width / (canvas.width / canvas.height))).toBeCloseTo(canvas.height / f.scale, 9);
	});

	it('pins the lane constants to the shell tokens', () => {
		const css = readFileSync(resolve(__dirname, '../../../../src/lib/design/presentation-tokens.css'), 'utf8');
		expect(css).toContain(`--shell-index-width: ${ALIGN_INDEX_LANE_PX}px;`);
		expect(css).toContain(`--shell-card-width: ${ALIGN_CARD_COVER_PX - 10}px;`);
	});
});

describe('Align readout', () => {
	const tile: [number, number] = [1, 1];
	it('reads the handle in metres right and up from the seen bottom-left, wrapped into one tile', () => {
		// A wall side whose u runs left to right: bottom-left (0,0), right (5.5,0), up (0,3).
		const seen = { origin: [0, 0] as const, right: [5.5, 0] as const, up: [0, 3] as const };
		// Pattern moved 0.5 m right and 0.25 m up: the readout is that move, not the raw offset (0.5, 0.75).
		const s = samplingOf({ kind: 'target', metric: { tileMeters: [1, 1], rotation: 0, offset: [0.5, 0.75] } } as never, [1, 1]);
		const corner = handleLattice({ origin: [0, 0, 0], uAxis: [1, 0, 0], vAxis: [0, 1, 0], uvMeters: [1, 1], uMin: 0, uMax: 5.5, vMin: 0, vMax: 3 }, s, [0, 0]);
		const read = handleMetersOf(corner.uv, seen, [1, 1], tile);
		expect(read[0]).toBeCloseTo(0.5, 9);
		expect(read[1]).toBeCloseTo(0.25, 9);
	});

	it('reads → as screen-right when u runs leftward on the seen side', () => {
		const seen = { origin: [5.5, 0] as const, right: [0, 0] as const, up: [5.5, 3] as const };
		expect(handleMetersOf([5.2, 0.4], seen, [1, 1], tile).map((v) => Number(v.toFixed(9)))).toEqual([0.3, 0.4]);
		expect(handleMetersOf([5.5, 1], seen, [1, 1], tile)).toEqual([0, 0]);
	});
});
