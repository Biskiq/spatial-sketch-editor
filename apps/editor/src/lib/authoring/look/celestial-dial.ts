import { projectWorld, type ViewportEvaluation } from '@portfolio/camera-core/viewport';
import type { Vec3 } from '@portfolio/camera-core/camera';
import type { SceneSky } from '@portfolio/project-model/units';
import { hhmm, skyBodyAt, skyDirection, snapTime, wrap24, DAWN_START, NIGHT_START, SUNRISE, SUNSET } from '$lib/render/sky-time';

export type DialPlacement = { anchor: Vec3; origin: Vec3; scale: number };
type Point = readonly [number, number];
type Segment = readonly [Vec3, Vec3];
type Rect = Pick<DOMRectReadOnly, 'left' | 'top' | 'right' | 'bottom'>;
export type DialGrip = 'glyph' | 'tip' | 'noon';

export function dialProject(point: Vec3, camera: ViewportEvaluation): Point | null {
	const projected = projectWorld(point, camera, camera.token);
	return projected.kind === 'projected' && projected.visibility !== 'behind' && projected.visibility !== 'clipped'
		? projected.css : null;
}

/**
 * The point in the Stage overlay's own frame: the overlay and the Stage's pointer
 * intents are both stage-local, while `dialProject` is in the viewport frame that
 * placement shares with the shell rectangles.
 */
export function dialStagePoint(point: Vec3, camera: ViewportEvaluation): Point | null {
	const projected = dialProject(point, camera);
	return projected === null ? null : [projected[0] - camera.rect.left, projected[1] - camera.rect.top];
}

export function dialRing(placement: DialPlacement, bearing: number, radius = 72): Vec3 {
	const [x, , z] = skyDirection(bearing, 0);
	const [a, y, b] = placement.anchor;
	return [a + x * radius * placement.scale, y, b + z * radius * placement.scale];
}

function scaleAt(anchor: Vec3, camera: ViewportEvaluation): number | null {
	const start = dialProject(anchor, camera);
	const right = camera.inverseViewMatrix;
	const nearby = dialProject([anchor[0] + right[0]!, anchor[1] + right[1]!, anchor[2] + right[2]!], camera);
	if (!start || !nearby) return null;
	const pixels = Math.hypot(nearby[0] - start[0], nearby[1] - start[1]);
	return pixels > 0 ? 1 / pixels : null;
}

const offsets = Array.from({ length: 17 ** 2 }, (_, index): Point => [
	(index % 17 - 8) * 0.3, (Math.floor(index / 17) - 8) * 0.3
]).sort((a, b) => Math.hypot(...a) - Math.hypot(...b));

export function placeCelestialDial(
	origin: Vec3,
	camera: ViewportEvaluation,
	shell: readonly Rect[],
	blocked: (position: Vec3) => boolean,
	onFloor: (position: Vec3) => boolean,
	floorBounds?: { min: Vec3; max: Vec3 } | null
): DialPlacement | null {
	const projected = projectWorld(origin, camera, camera.token);
	if (projected.kind !== 'projected' || projected.visibility !== 'visible') return null;
	const nearest = offsets.find(([x, z]) => Math.hypot(x, z) <= 2 &&
		!blocked([origin[0] + x, origin[1], origin[2] + z]));
	if (!nearest) return null;
	const furnitureClear: Vec3 = [origin[0] + nearest[0], origin[1], origin[2] + nearest[1]];
	const within = offsets.filter(([x, z]) => Math.hypot(x, z) <= 2);
	const roomGrid: Point[] = [];
	if (floorBounds) {
		const { min, max } = floorBounds;
		const step = Math.max(0.3, Math.max(max[0] - min[0], max[2] - min[2]) / 12);
		for (let x = min[0] + step / 2; x < max[0]; x += step) {
			for (let z = min[2] + step / 2; z < max[2]; z += step) {
				roomGrid.push([x - origin[0], z - origin[2]]);
			}
		}
	}
	const candidates = [
		nearest,
		...within.filter(([x, z]) => x !== nearest[0] || z !== nearest[1]),
		...roomGrid
	].sort(([ax, az], [bx, bz]) =>
		Math.hypot(origin[0] + ax - furnitureClear[0], origin[2] + az - furnitureClear[2]) -
		Math.hypot(origin[0] + bx - furnitureClear[0], origin[2] + bz - furnitureClear[2]));
	for (const [x, z] of candidates) {
		const distance = Math.hypot(x, z);
		const anchor: Vec3 = [origin[0] + x, origin[1], origin[2] + z];
		if (blocked(anchor) || (distance > 0 && !onFloor(anchor))) continue;
		const scale = scaleAt(anchor, camera);
		if (scale === null) continue;
		const placement = { anchor, origin, scale };
		const samples: Point[] = [];
		for (let index = 0; index < 48; index++) {
			const point = dialProject(dialRing(placement, index * 7.5, 72 * 1.2), camera);
			if (point) samples.push(point);
		}
		if (samples.length !== 48) continue;
		const padding = camera.rect.width < 360 ? 36 : 84;
		const left = Math.min(...samples.map(([a]) => a)) - padding;
		const right = Math.max(...samples.map(([a]) => a)) + padding;
		const top = Math.min(...samples.map(([, b]) => b)) - 22;
		const bottom = Math.max(...samples.map(([, b]) => b)) + 8;
		const viewport = camera.rect;
		if (left < viewport.left || right > viewport.left + viewport.width ||
			top < viewport.top || bottom > viewport.top + viewport.height) continue;
		if (shell.some((rect) => left < rect.right + 8 && right > rect.left - 8 &&
			top < rect.bottom + 8 && bottom > rect.top - 8)) continue;
		return placement;
	}
	return null;
}

function tip(placement: DialPlacement, az: number, el: number): Vec3 {
	return dialRing(placement, az + 180, Math.min(64, 20 / Math.tan(el * Math.PI / 180)));
}

export function nearestT(
	point: Point, previous: number, phase: 'day' | 'night', grip: 'glyph' | 'tip',
	placement: DialPlacement, camera: ViewportEvaluation, sky: SceneSky
): number {
	const start = phase === 'day' ? SUNRISE : NIGHT_START;
	const end = phase === 'day' ? SUNSET : 24 + DAWN_START;
	const previousOnArc = previous < start && phase === 'night' ? previous + 24 : previous;
	let best = previousOnArc;
	let bestDistance = Infinity;
	for (let step = 0; step <= (end - start) * 30; step++) {
		const time = start + step / 30;
		const body = skyBodyAt(Math.min(time, end - 1e-6), sky.heading, sky.arcHeight);
		const target = dialStagePoint(grip === 'glyph' ? dialRing(placement, body.az)
			: tip(placement, body.az, body.el), camera);
		if (!target) continue;
		const distance = (point[0] - target[0]) ** 2 + (point[1] - target[1]) ** 2;
		if (distance < bestDistance - 1e-8 ||
			(Math.abs(distance - bestDistance) <= 1e-8 && Math.abs(time - previousOnArc) < Math.abs(best - previousOnArc))) {
			bestDistance = distance;
			best = time;
		}
	}
	return wrap24(Math.min(phase === 'night' ? end - 1 / 12 : end, start + wrap24(snapTime(best) - start)));
}

function arc(placement: DialPlacement, start: number, extent: number, count: number, dotted = false): Segment[] {
	const points = Array.from({ length: count + 1 }, (_, i) => dialRing(placement, start + extent * i / count));
	return points.slice(1).flatMap((point, index) => dotted && index % 2 ? [] : [[points[index]!, point]]);
}

function dashedLine(from: Vec3, to: Vec3, count: number): Segment[] {
	const at = (fraction: number): Vec3 => [
		from[0] + (to[0] - from[0]) * fraction,
		from[1] + (to[1] - from[1]) * fraction,
		from[2] + (to[2] - from[2]) * fraction
	];
	return Array.from({ length: count }, (_, i) => [at(i / count), at((i + 0.55) / count)]);
}

export function celestialDialModel(sky: SceneSky, placement: DialPlacement) {
	const body = skyBodyAt(sky.time, sky.heading, sky.arcHeight);
	const ring = arc(placement, 0, 360, 96);
	const noon = dialRing(placement, sky.heading + 180, 79.2);
	const glyph = dialRing(placement, body.az);
	const active = body.body !== 'none';
	const shadow = active ? tip(placement, body.az, body.el) : null;
	const top: Vec3 = [placement.anchor[0], placement.anchor[1] + 20 * placement.scale, placement.anchor[2]];
	const ink = body.phase === 'day' ? '#364d40' : '#e8eeff';
	const color = body.phase === 'day' ? '#f5b400' : body.phase === 'night' ? '#c9d6ff'
		: body.phase === 'dusk' ? '#e9a77a' : '#d8b0c8';
	const ticks: Segment[] = Array.from({ length: 24 }, (_, i) => {
		const az = sky.heading + i * 15;
		return [dialRing(placement, az, i % 6 === 0 ? 64.8 : 68.4), dialRing(placement, az)];
	});
	const boundaries = active ? [sky.heading - 90, sky.heading + 90] : [];
	const ends: Segment[] = boundaries.map((bearing) => [
		dialRing(placement, bearing), dialRing(placement, bearing, 83.52)
	]);
	const labels = boundaries.map((bearing, i) => ({
		point: dialRing(placement, bearing, 86.4),
		text: body.phase === 'day' ? (i === 0 ? '06:30 sunrise' : '19:30 sunset')
			: (i === 0 ? '21:00 rise' : '04:30 set')
	}));
	if (!active) labels.push({
		point: dialRing(placement, body.az, 95.04),
		text: body.phase === 'dusk' ? 'Dusk · use the Time dial in Sky' : 'Dawn · use the Time dial in Sky'
	});
	const trajectory = active ? Array.from({ length: 61 }, (_, index) => {
		const time = body.phase === 'day' ? SUNRISE + index * 13 / 60 : NIGHT_START + index * 7.499 / 60;
		const sample = skyBodyAt(time, sky.heading, sky.arcHeight);
		return tip(placement, sample.az, sample.el);
	}) : [];
	const hourDots = (body.phase === 'day' ? [9, 11, 15, 17] : body.phase === 'night' ? [23, 2] : [])
		.map((hour) => {
			const sample = skyBodyAt(hour, sky.heading, sky.arcHeight);
			return tip(placement, sample.az, sample.el);
		});
	const dots = hourDots.flatMap(([x, y, z]) => {
		const r = 1.5 * placement.scale;
		return [[[x - r, y, z], [x + r, y, z]], [[x, y, z - r], [x, y, z + r]]] as Segment[];
	});
	const lines = [
		{ color: ink, opacity: 0.35, segments: [...ring, ...ticks] },
		{ color, opacity: 0.85, segments: [...ends, ...arc(placement, active ? sky.heading - 90 : body.az - 25, active ? 180 : 50, 48)] },
		{ color, opacity: 0.95, segments: active ? arc(placement, sky.heading - 90, 180 * body.u, 24, true) : [] },
		{ color: ink, opacity: 0.7, segments: [[placement.anchor, top] as Segment, ...dashedLine(placement.anchor, noon, 10),
			...(shadow ? [[placement.anchor, shadow] as Segment, ...dashedLine(glyph, top, 10)] : [])] },
		{ color: ink, opacity: 0.45, segments: [...trajectory.slice(1).flatMap((p, i): Segment[] => i % 2 ? [] : [[trajectory[i]!, p]]), ...dots] }
	];
	return { placement, body, ink, color, lines, labels, glyph, shadow, noon,
		tag: `${hhmm(sky.time)} · ${Math.round(body.el)}° high`,
		noonTag: `Noon bearing ${Math.round(sky.heading)}°` };
}

export type CelestialDialModel = ReturnType<typeof celestialDialModel>;
