/**
 * Align chart (T2.S8 U6): the exact renderer sampling, inverted for the overlay.
 *
 * The renderer samples a Finish at
 *  t = diag(repeat) · R(−θ) · (uv − ½) + ½ + offset
 * (`render/resources/finish-sampling.ts` `sampleUv`), where `uv` is the
 * surface's native chart and `repeat = uvMeters / tileMeters` for a metric
 * mapping (`project-model/materials/bind.ts`). A `legacy` origin then reads row
 * `1 − t_y`, which maps integers to integers, so tile boundaries (`t_x ∈ ℤ`,
 * `t_y ∈ ℤ`) are unaffected by it.
 *
 * Layout surfaces are metre charts (`uvMeters` [1, 1]):
 * - a wall side's `u` is arc length from the wall's start on both sides and `v`
 *  is height above the wall's floor (the Layout wall mesh);
 * - a room floor's `u` is world `x` and `v` is world `−z`
 *  (`render/layout-room-representation.ts` `polygonShape`).
 *
 * Everything here is pure: no Camera, no DOM, no authored writes.
 */
import type { Mapping } from '@portfolio/project-model/materials';

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

/** A surface's native UV chart embedded in world space (a plane). */
export type AlignSurfaceChart = {
	/** World point at uv (0, 0). */
	readonly origin: Vec3;
	/** World unit vector along +u (one uv unit is `uvMeters[0]` metres). */
	readonly uAxis: Vec3;
	/** World unit vector along +v. */
	readonly vAxis: Vec3;
	readonly uvMeters: Vec2;
	/** The surface's uv extent. */
	readonly uMin: number;
	readonly uMax: number;
	readonly vMin: number;
	readonly vMax: number;
};

/** The sampling parameters the renderer uses for one mapping on one chart. */
export type AlignSampling = {
	readonly repeat: Vec2;
	/** Radians. */
	readonly rotation: number;
	/** Tile fractions. */
	readonly offset: Vec2;
	/** Metres per tile along each pattern axis. */
	readonly tileMeters: Vec2;
};

const MIN_REPEAT = 0.01;

/** The renderer's sampling for a mapping on a chart (`bind.ts` + `materialMetricRepeat`). */
export function samplingOf(mapping: Mapping, uvMeters: Vec2): AlignSampling {
	if (mapping.kind === 'uv') {
		const repeat: Vec2 = [
			Math.max(MIN_REPEAT, mapping.repeat[0]),
			Math.max(MIN_REPEAT, mapping.repeat[1]),
		];
		return {
			repeat,
			rotation: mapping.rotation,
			offset: [mapping.offset[0], mapping.offset[1]],
			tileMeters: [uvMeters[0] / repeat[0], uvMeters[1] / repeat[1]],
		};
	}
	const tile: Vec2 = [
		Math.max(0.01, mapping.metric.tileMeters[0]),
		Math.max(0.01, mapping.metric.tileMeters[1]),
	];
	const repeat: Vec2 = [
		Math.max(MIN_REPEAT, uvMeters[0] / tile[0]),
		Math.max(MIN_REPEAT, uvMeters[1] / tile[1]),
	];
	return {
		repeat,
		rotation: mapping.metric.rotation,
		offset: [mapping.metric.offset[0], mapping.metric.offset[1]],
		tileMeters: [uvMeters[0] / repeat[0], uvMeters[1] / repeat[1]],
	};
}

/** uv → tile coordinate, exactly as the sampling graph computes it (before the origin flip). */
export function uvToTile(uv: Vec2, s: AlignSampling): [number, number] {
	const cx = uv[0] - 0.5;
	const cy = uv[1] - 0.5;
	const c = Math.cos(s.rotation);
	const n = Math.sin(s.rotation);
	const rx = cx * c + cy * n;
	const ry = -cx * n + cy * c;
	return [rx * s.repeat[0] + 0.5 + s.offset[0], ry * s.repeat[1] + 0.5 + s.offset[1]];
}

/** tile coordinate → uv (the exact inverse of `uvToTile`). */
export function tileToUv(t: Vec2, s: AlignSampling): [number, number] {
	const sx = (t[0] - 0.5 - s.offset[0]) / s.repeat[0];
	const sy = (t[1] - 0.5 - s.offset[1]) / s.repeat[1];
	const c = Math.cos(s.rotation);
	const n = Math.sin(s.rotation);
	return [sx * c - sy * n + 0.5, sx * n + sy * c + 0.5];
}

/** The offset that puts lattice point `k` at `uv` under rotation `rotation` (repeat unchanged). */
export function offsetPlacing(
	k: Vec2,
	uv: Vec2,
	s: Pick<AlignSampling, 'repeat'>,
	rotation: number,
): [number, number] {
	const cx = uv[0] - 0.5;
	const cy = uv[1] - 0.5;
	const c = Math.cos(rotation);
	const n = Math.sin(rotation);
	const rx = cx * c + cy * n;
	const ry = -cx * n + cy * c;
	return [k[0] - 0.5 - rx * s.repeat[0], k[1] - 0.5 - ry * s.repeat[1]];
}

export function chartToWorld(chart: AlignSurfaceChart, uv: Vec2): [number, number, number] {
	const mu = uv[0] * chart.uvMeters[0];
	const mv = uv[1] * chart.uvMeters[1];
	return [
		chart.origin[0] + chart.uAxis[0] * mu + chart.vAxis[0] * mv,
		chart.origin[1] + chart.uAxis[1] * mu + chart.vAxis[1] * mv,
		chart.origin[2] + chart.uAxis[2] * mu + chart.vAxis[2] * mv,
	];
}

/** The chart's four uv corners, counter-clockwise in uv: (uMin,vMin) (uMax,vMin) (uMax,vMax) (uMin,vMax). */
export function chartCorners(chart: AlignSurfaceChart): [Vec2, Vec2, Vec2, Vec2] {
	return [
		[chart.uMin, chart.vMin],
		[chart.uMax, chart.vMin],
		[chart.uMax, chart.vMax],
		[chart.uMin, chart.vMax],
	];
}

function insideChart(chart: AlignSurfaceChart, uv: Vec2, eps = 1e-9): boolean {
	return (
		uv[0] >= chart.uMin - eps &&
		uv[0] <= chart.uMax + eps &&
		uv[1] >= chart.vMin - eps &&
		uv[1] <= chart.vMax + eps
	);
}

/**
 * Clip the line {uv: a·uv = d} to the chart rectangle. Returns the segment's
 * two endpoints, or null when the line misses the rectangle.
 */
function clipLine(chart: AlignSurfaceChart, a: Vec2, d: number): [Vec2, Vec2] | null {
	const hits: Vec2[] = [];
	const push = (p: Vec2) => {
		if (!insideChart(chart, p, 1e-7)) return;
		if (hits.some((h) => Math.abs(h[0] - p[0]) < 1e-9 && Math.abs(h[1] - p[1]) < 1e-9)) return;
		hits.push(p);
	};
	if (Math.abs(a[1]) > 1e-12) {
		push([chart.uMin, (d - a[0] * chart.uMin) / a[1]]);
		push([chart.uMax, (d - a[0] * chart.uMax) / a[1]]);
	}
	if (Math.abs(a[0]) > 1e-12) {
		push([(d - a[1] * chart.vMin) / a[0], chart.vMin]);
		push([(d - a[1] * chart.vMax) / a[0], chart.vMax]);
	}
	if (hits.length < 2) return null;
	// Keep the two farthest-apart hits (a corner may register twice).
	let best: [Vec2, Vec2] = [hits[0]!, hits[1]!];
	let bestD = -1;
	for (let i = 0; i < hits.length; i += 1) {
		for (let j = i + 1; j < hits.length; j += 1) {
			const dd = (hits[i]![0] - hits[j]![0]) ** 2 + (hits[i]![1] - hits[j]![1]) ** 2;
			if (dd > bestD) {
				bestD = dd;
				best = [hits[i]!, hits[j]!];
			}
		}
	}
	return bestD > 1e-12 ? best : null;
}

export type AlignGridLine = {
	readonly axis: 'x' | 'y';
	readonly k: number;
	readonly from: Vec2;
	readonly to: Vec2;
};

/**
 * Tile boundary segments in uv: every `t_x = k` and `t_y = k` clipped to the
 * chart. `null` when more than `maxPerAxis` boundaries would cross the surface
 * (a tile far smaller than the surface draws no legible grid).
 */
export function tileGridLines(
	chart: AlignSurfaceChart,
	s: AlignSampling,
	maxPerAxis = 240,
): AlignGridLine[] | null {
	const corners = chartCorners(chart).map((c) => uvToTile(c, s));
	const out: AlignGridLine[] = [];
	const c = Math.cos(s.rotation);
	const n = Math.sin(s.rotation);
	// t_x = repeat_x·(c·(u−½) + n·(v−½) ) + ½ + off_x → a·uv = d
	const axes: { axis: 'x' | 'y'; a: Vec2; base: number; rep: number; off: number }[] = [
		{ axis: 'x', a: [c, n], base: 0.5 * (c + n), rep: s.repeat[0], off: s.offset[0] },
		{ axis: 'y', a: [-n, c], base: 0.5 * (-n + c), rep: s.repeat[1], off: s.offset[1] },
	];
	for (const [index, ax] of axes.entries()) {
		const values = corners.map((t) => t[index]!);
		const lo = Math.ceil(Math.min(...values) - 1e-9);
		const hi = Math.floor(Math.max(...values) + 1e-9);
		if (hi - lo + 1 > maxPerAxis) return null;
		for (let k = lo; k <= hi; k += 1) {
			const d = (k - 0.5 - ax.off) / ax.rep + ax.base;
			const seg = clipLine(chart, ax.a, d);
			if (seg !== null) out.push({ axis: ax.axis, k, from: seg[0], to: seg[1] });
		}
	}
	return out;
}

/**
 * The lattice point (integer tile corner) the square handle sits on: the one
 * inside the chart nearest `near` (uv). Falls back to the nearest lattice point
 * to the chart centre, clamped into the chart, when none lies inside.
 */
export function handleLattice(
	chart: AlignSurfaceChart,
	s: AlignSampling,
	near: Vec2,
): { k: [number, number]; uv: [number, number] } {
	const t = uvToTile(near, s);
	let best: { k: [number, number]; uv: [number, number]; d: number } | null = null;
	const span = 3;
	for (let i = Math.floor(t[0]) - span; i <= Math.ceil(t[0]) + span; i += 1) {
		for (let j = Math.floor(t[1]) - span; j <= Math.ceil(t[1]) + span; j += 1) {
			const uv = tileToUv([i, j], s);
			if (!insideChart(chart, uv, 1e-7)) continue;
			const d = (uv[0] - near[0]) ** 2 + (uv[1] - near[1]) ** 2;
			if (best === null || d < best.d) best = { k: [i, j], uv, d };
		}
	}
	if (best !== null) return { k: best.k, uv: best.uv };
	const centre: Vec2 = [(chart.uMin + chart.uMax) / 2, (chart.vMin + chart.vMax) / 2];
	const tc = uvToTile(centre, s);
	const k: [number, number] = [Math.round(tc[0]), Math.round(tc[1])];
	return { k, uv: tileToUv(k, s) };
}

/** Offset in metres along the pattern axes, wrapped into one tile, for display and snapping. */
export function offsetMetersOf(s: AlignSampling): [number, number] {
	const wrap = (v: number) => ((v % 1) + 1) % 1;
	return [wrap(s.offset[0]) * s.tileMeters[0], wrap(s.offset[1]) * s.tileMeters[1]];
}

/**
 * Where the square handle sits as the readout states it (the prototype's
 * `mod(offset, tile)`): metres right and up from the surface's bottom-left
 * corner **as seen**, wrapped into one tile per axis. `origin`, `right` and
 * `up` are the uv of the seen bottom-left corner and its neighbours along the
 * seen bottom and left edges, so a wall side whose `u` runs leftward still
 * reads → as screen-right.
 */
export function handleMetersOf(
	handleUv: Vec2,
	corner: { readonly origin: Vec2; readonly right: Vec2; readonly up: Vec2 },
	uvMeters: Vec2,
	tileMeters: Vec2,
): [number, number] {
	const metres = (uv: Vec2): [number, number] => [
		(uv[0] - corner.origin[0]) * uvMeters[0],
		(uv[1] - corner.origin[1]) * uvMeters[1],
	];
	const unit = (v: [number, number]): [number, number] => {
		const len = Math.hypot(v[0], v[1]);
		return len > 1e-12 ? [v[0] / len, v[1] / len] : [0, 0];
	};
	const r = unit(metres(corner.right));
	const u = unit(metres(corner.up));
	const d = metres(handleUv);
	const wrap = (v: number, tile: number) => {
		const w = ((v % tile) + tile) % tile;
		return w > tile - 5e-7 ? 0 : w;
	};
	return [
		wrap(d[0] * r[0] + d[1] * r[1], tileMeters[0]),
		wrap(d[0] * u[0] + d[1] * u[1], tileMeters[1]),
	];
}

/** Snap a tile-fraction offset to 1 cm (1 mm with Shift) in pattern metres, wrapped into [0, 1). */
export function snapOffset(offset: Vec2, tileMeters: Vec2, fine: boolean): [number, number] {
	const step = fine ? 0.001 : 0.01;
	const snap = (o: number, tile: number) => {
		const metres = Math.round((o * tile) / step) * step;
		const wrapped = (((metres / tile) % 1) + 1) % 1;
		return Number(wrapped.toFixed(6)) % 1;
	};
	return [snap(offset[0], tileMeters[0]), snap(offset[1], tileMeters[1])];
}

/** 2 × 2 screen Jacobian (px per uv unit) and its inverse. */
export type AlignJacobian = {
	readonly du: Vec2;
	readonly dv: Vec2;
};

/** Screen delta (px) → uv delta, by inverting the local Jacobian. Null when degenerate. */
export function screenToUvDelta(j: AlignJacobian, delta: Vec2): [number, number] | null {
	const det = j.du[0] * j.dv[1] - j.dv[0] * j.du[1];
	if (!(Math.abs(det) > 1e-9)) return null;
	return [
		(delta[0] * j.dv[1] - delta[1] * j.dv[0]) / det,
		(j.du[0] * delta[1] - j.du[1] * delta[0]) / det,
	];
}

/**
 * Drag the square handle: lattice point `k`, which sat at `startUv`, follows a
 * uv delta. Returns the snapped offset that keeps rotation and repeat.
 */
export function dragOffset(
	s: AlignSampling,
	k: Vec2,
	startUv: Vec2,
	deltaUv: Vec2,
	fine: boolean,
): [number, number] {
	const raw = offsetPlacing(k, [startUv[0] + deltaUv[0], startUv[1] + deltaUv[1]], s, s.rotation);
	return snapOffset(raw, s.tileMeters, fine);
}

/**
 * Turn the pattern about the square handle: a uv direction becomes the pattern's
 * +x axis (snapped to 15°, free with Alt), and the offset is solved so lattice
 * point `k` stays at `handleUv`. One mapping patch carries both.
 */
export function turnAbout(
	s: AlignSampling,
	k: Vec2,
	handleUv: Vec2,
	directionUv: Vec2,
	free: boolean,
): { rotation: number; offset: [number, number] } {
	const raw = Math.atan2(directionUv[1], directionUv[0]);
	const step = Math.PI / 12;
	const snapped = free ? raw : Math.round(raw / step) * step;
	const rotation = wrapRotation(snapped);
	return { rotation, offset: wrapOffset(offsetPlacing(k, handleUv, s, rotation)) };
}

/** Rotate by `deltaRad` about the square handle (keyboard ±15°). */
export function turnBy(
	s: AlignSampling,
	k: Vec2,
	handleUv: Vec2,
	deltaRad: number,
): { rotation: number; offset: [number, number] } {
	const rotation = wrapRotation(
		Math.round((s.rotation + deltaRad) / (Math.PI / 12)) * (Math.PI / 12),
	);
	return { rotation, offset: wrapOffset(offsetPlacing(k, handleUv, s, rotation)) };
}

export function wrapRotation(rad: number): number {
	const two = Math.PI * 2;
	const w = ((rad % two) + two) % two;
	return Math.abs(w - two) < 1e-9 ? 0 : Number(w.toFixed(9));
}

function wrapOffset(o: Vec2): [number, number] {
	const w = (v: number) => {
		const r = ((v % 1) + 1) % 1;
		return Number(r.toFixed(6)) % 1;
	};
	return [w(o[0]), w(o[1])];
}

/** The mapping with a new rotation and offset (repeat or tile size unchanged). */
export function withPlacement(mapping: Mapping, rotation: number, offset: Vec2): Mapping {
	if (mapping.kind === 'uv') {
		return { ...mapping, rotation, offset: [offset[0], offset[1]] };
	}
	return {
		kind: mapping.kind,
		metric: {
			tileMeters: [mapping.metric.tileMeters[0], mapping.metric.tileMeters[1]],
			rotation,
			offset: [offset[0], offset[1]],
		},
	} as Mapping;
}

/** Wall side chart: u = arc length from the start, v = height above the wall's floor. */
export function wallSideChart(input: {
	readonly start: Vec2;
	readonly startDistance: number;
	readonly tangent: Vec2;
	readonly normal: Vec2;
	readonly side: 'left' | 'right';
	readonly thickness: number;
	readonly length: number;
	readonly floorY: number;
	readonly topY: number;
}): AlignSurfaceChart {
	const tl = Math.hypot(input.tangent[0], input.tangent[1]) || 1;
	const tx = input.tangent[0] / tl;
	const tz = input.tangent[1] / tl;
	const nl = Math.hypot(input.normal[0], input.normal[1]) || 1;
	const sign = input.side === 'left' ? 1 : -1;
	const ox = (input.normal[0] / nl) * (input.thickness / 2) * sign;
	const oz = (input.normal[1] / nl) * (input.thickness / 2) * sign;
	// uv (0, 0) sits at distance 0 along the centreline, moved to this side, on the floor.
	const origin: Vec3 = [
		input.start[0] - tx * input.startDistance + ox,
		input.floorY,
		input.start[1] - tz * input.startDistance + oz,
	];
	return {
		origin,
		uAxis: [tx, 0, tz],
		vAxis: [0, 1, 0],
		uvMeters: [1, 1],
		uMin: input.startDistance,
		uMax: input.startDistance + input.length,
		vMin: 0,
		vMax: Math.max(0.01, input.topY - input.floorY),
	};
}

/** Room floor chart: u = world x, v = world −z, at the floor elevation. */
export function floorChart(input: {
	readonly floorY: number;
	readonly minX: number;
	readonly maxX: number;
	readonly minZ: number;
	readonly maxZ: number;
}): AlignSurfaceChart {
	return {
		origin: [0, input.floorY, 0],
		uAxis: [1, 0, 0],
		vAxis: [0, 0, -1],
		uvMeters: [1, 1],
		uMin: input.minX,
		uMax: input.maxX,
		vMin: -input.maxZ,
		vMax: -input.minZ,
	};
}

/**
 * Region-aware framing for camera-core `face` / `fit`, so a surface of
 * `surfaceMeters` lands centred in a chrome-free canvas region rather than in
 * the whole canvas.
 *
 * Both endpoints frame an AABB about its centre and size the target plane so
 * the AABB's screen extent fills the usable canvas. Choosing the scale `s`
 * (px per metre) that fits the surface into the region, then an AABB whose
 * screen extent is the whole canvas at that scale (`halfW`, `halfH` metres),
 * centred at `target` so the surface centre falls on the region centre, gives
 * the wanted view with `paddingFraction: 0`. Callers build the AABB for their
 * endpoint (a wall face spreads `halfW` over x and z; Plan `fit` reads x as
 * width and z as depth).
 */
export function regionFraming(input: {
	/** Surface centre, world. */
	readonly center: Vec3;
	/** Screen-right of the framed view in world (unit). */
	readonly right: Vec3;
	/** Screen-up of the framed view in world (unit). */
	readonly up: Vec3;
	readonly surfaceMeters: Vec2;
	readonly canvas: { readonly width: number; readonly height: number };
	readonly region: {
		readonly x: number;
		readonly y: number;
		readonly width: number;
		readonly height: number;
	};
}): {
	readonly target: Vec3;
	readonly scale: number;
	readonly halfW: number;
	readonly halfH: number;
} | null {
	const { canvas, region } = input;
	const sw = Math.max(0.01, input.surfaceMeters[0]);
	const sh = Math.max(0.01, input.surfaceMeters[1]);
	if (!(canvas.width > 0 && canvas.height > 0 && region.width > 1 && region.height > 1))
		return null;
	const s = Math.min(region.width / sw, region.height / sh);
	if (!(s > 0) || !Number.isFinite(s)) return null;
	// Screen offset of the region centre from the canvas centre, in metres on the surface plane.
	const dx = (region.x + region.width / 2 - canvas.width / 2) / s;
	const dy = (region.y + region.height / 2 - canvas.height / 2) / s;
	// A point P draws at x = W/2 + s·(P−T)·right and y = H/2 − s·(P−T)·up, so
	// putting the surface centre on the region centre needs this target:
	const target: Vec3 = [
		input.center[0] - input.right[0] * dx + input.up[0] * dy,
		input.center[1] - input.right[1] * dx + input.up[1] * dy,
		input.center[2] - input.right[2] * dx + input.up[2] * dy,
	];
	return { target, scale: s, halfW: canvas.width / (2 * s), halfH: canvas.height / (2 * s) };
}

/** AABB for a wall `face`: `halfW` spread so its projection on `right` is exactly `halfW`. */
export function faceBoundsOf(
	f: { readonly target: Vec3; readonly halfW: number; readonly halfH: number },
	right: Vec3,
): { min: [number, number, number]; max: [number, number, number] } {
	const horizontal = Math.max(1e-6, Math.abs(right[0]) + Math.abs(right[2]));
	const h = f.halfW / horizontal;
	return {
		min: [f.target[0] - h, f.target[1] - f.halfH, f.target[2] - h],
		max: [f.target[0] + h, f.target[1] + f.halfH, f.target[2] + h],
	};
}

/** AABB for a Plan `fit`: x is width and z is depth; the extents are symmetric in the fit's max. */
export function planFitBoundsOf(f: {
	readonly target: Vec3;
	readonly halfW: number;
	readonly halfH: number;
}): { min: [number, number, number]; max: [number, number, number] } {
	return {
		min: [f.target[0] - f.halfW, f.target[1] - 0.01, f.target[2] - f.halfH],
		max: [f.target[0] + f.halfW, f.target[1] + 0.01, f.target[2] + f.halfH],
	};
}

/** Screen axes of the Plan reading at a (quarter-snapped) azimuth: camera-core `upForReading('plan')`. */
export function planScreenAxes(azimuthRadians: number): { right: Vec3; up: Vec3 } {
	const a = Math.round(azimuthRadians / (Math.PI / 2)) * (Math.PI / 2);
	const up: Vec3 = [-Math.sin(a), 0, -Math.cos(a)];
	// three.js lookAt: right = up × backward, backward = +Y for a top-down eye.
	const right: Vec3 = [Math.cos(a), 0, -Math.sin(a)];
	return { right, up };
}

/** Screen axes of a horizontal wall face looking along `look`: camera-core `facePoseFromBounds`. */
export function faceScreenAxes(look: Vec3): { right: Vec3; up: Vec3 } {
	// right = Y × backward, backward = −look.
	const bx = -look[0];
	const bz = -look[2];
	const l = Math.hypot(bx, bz) || 1;
	return { right: [bz / l, 0, -bx / l], up: [0, 1, 0] };
}

/** `--shell-index-width`: the Index lane the Align region keeps clear of (pinned by a token test). */
export const ALIGN_INDEX_LANE_PX = 256;
/** `--shell-card-width` + the Card's 10 px inset (living-draft `--card-cover`; pinned by a token test). */
export const ALIGN_CARD_COVER_PX = 298;
