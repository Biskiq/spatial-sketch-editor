import type {
	CompiledRoom,
	CompiledWall,
	CompiledWallSection,
	CurveSample,
	LayoutGeometryIssue,
} from '@portfolio/layout-core/geometry';
import { archProfileTopAt, LAYOUT_GEOMETRY_EPSILON } from '@portfolio/layout-core/geometry';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import { resolveSharedCornerSide } from '@portfolio/layout-core/wall';
import type { ClipSample, Corner, CornerSide, V3 } from './wall-mesh-types';
import { WINDING_DEGENERATE_AREA } from './wall-mesh-types';

export function sectionBottomAt(section: CompiledWallSection, distance: number): number {
	if (section.kind !== 'lintel' || !section.profile || section.profile.kind === 'rectangular')
		return section.bottomY;
	const local = clamp(distance - section.startDistance, 0, section.profile.width);
	const top = archProfileTopAt(section.profile, local);
	return Math.min(section.topY, (section.profileBaseY ?? 0) + top);
}

/** True when a wall carries an opening that starts exactly at its first sample (offset 0). */
export function wallOpensAtStart(wall: CompiledWall): boolean {
	return wall.openings.some((opening) => opening.offset <= LAYOUT_GEOMETRY_EPSILON);
}

/** True when a wall carries an opening that ends exactly at its last sample (offset + width === length). */
export function wallOpensAtEnd(wall: CompiledWall): boolean {
	const length = wall.samples.at(-1)?.distance ?? 0;
	return wall.openings.some(
		(opening) => opening.offset + opening.width >= length - LAYOUT_GEOMETRY_EPSILON,
	);
}

/**
 * Room-wide set of vertical breakpoints (y above the floor) at which every wall
 * face must split: the sill and spring heights of every opening. Splitting all
 * faces at the same union of heights keeps coincident vertical edges — across
 * sections, reveals, lintels, and room corners — welded without T-junctions.
 */
export function roomHeightBreakpoints(room: CompiledRoom): number[] {
	const wallHeight = room.ceilingElevation - room.floorElevation;
	const breakpoints = new Set<number>();
	for (const wall of room.walls) {
		for (const opening of wall.openings) {
			const springHeight = opening.profileShape
				? opening.profileShape.height - opening.profileShape.rise
				: opening.height;
			if (opening.sillHeight > LAYOUT_GEOMETRY_EPSILON) breakpoints.add(opening.sillHeight);
			const spring = opening.sillHeight + springHeight;
			if (spring > LAYOUT_GEOMETRY_EPSILON && spring < wallHeight - LAYOUT_GEOMETRY_EPSILON)
				breakpoints.add(spring);
		}
	}
	return [...breakpoints].sort((a, b) => a - b);
}

/**
 * Sorted band boundaries (y above the floor) splitting one segment's vertical
 * span [min(bottomA, bottomB), top] at every room breakpoint inside it. The
 * returned list always includes the span's own minimum and top.
 */
export function segmentBands(
	bottomA: number,
	bottomB: number,
	top: number,
	roomBreakpoints: readonly number[],
): number[] {
	const min = Math.min(bottomA, bottomB);
	const candidates = [min, top];
	for (const y of roomBreakpoints) {
		if (y > min + LAYOUT_GEOMETRY_EPSILON && y < top - LAYOUT_GEOMETRY_EPSILON) candidates.push(y);
	}
	candidates.sort((a, b) => a - b);
	const bands: number[] = [];
	let previous = -Infinity;
	for (const y of candidates) {
		if (y - previous > LAYOUT_GEOMETRY_EPSILON) {
			bands.push(y);
			previous = y;
		}
	}
	return bands;
}

export function computeCorners(
	walls: readonly CompiledWall[],
	miterLimit: number,
	room: CompiledRoom,
): { corners: Corner[]; issues: LayoutGeometryIssue[] } {
	const count = walls.length;
	const corners: Corner[] = [];
	const issues: LayoutGeometryIssue[] = [];
	for (let i = 0; i < count; i += 1) {
		const prev = walls[(i - 1 + count) % count]!;
		const cur = walls[i]!;
		const junction = cur.samples[0]!.point;
		const half = cur.thickness / 2;
		const dirA = prev.samples.at(-1)!.tangent;
		const nA = prev.samples.at(-1)!.normal;
		const dirB = cur.samples[0]!.tangent;
		const nB = cur.samples[0]!.normal;
		const front = cornerSide(junction, dirA, nA, dirB, nB, half, miterLimit);
		const back = cornerSide(junction, dirA, nA, dirB, nB, -half, miterLimit);
		if (front.kind === 'fold' || back.kind === 'fold') {
			issues.push({
				path: `rooms.${room.roomId}.walls.${cur.segmentId}`,
				code: 'wall_corner_fold',
				message: 'Wall junction folds back on itself (180° turn); offset regions would overlap.',
				targetId: cur.segmentId,
			});
		}
		corners.push({ front, back });
	}
	return { corners, issues };
}

/**
 * Resolve one side of a junction. Intersects the two `sign`-sided offset lines
 * into a miter apex; past the miter limit the corner is a `bevel` keeping both
 * offset points (`a0` = previous wall, `b0` = current wall). Collinear
 * continuations (`det ≈ 0`, same direction) stay miter; 180° folds (opposite
 * direction) are rejected with a `fold` so the build fails closed.
 */
export function cornerSide(
	junction: LayoutVec2,
	dirA: LayoutVec2,
	nA: LayoutVec2,
	dirB: LayoutVec2,
	nB: LayoutVec2,
	signHalf: number,
	miterLimit: number,
): CornerSide {
	// One rule, two callers. The offset-line intersection, the miter
	// limit and the fold refusal live in `layout-core`
	// (`resolveSharedCornerSide`); this room-loop path and the standalone
	// Junction solve share them instead of keeping a second copy of the
	// arithmetic. Mixed thickness is generalised there via per-side halves; the
	// room loop passes the same half for both sides.
	const half = Math.abs(signHalf);
	const sign: 1 | -1 = signHalf >= 0 ? 1 : -1;
	const resolved = resolveSharedCornerSide(
		junction,
		dirA,
		nA,
		half,
		dirB,
		nB,
		half,
		sign,
		miterLimit,
	);
	if (resolved.kind === 'side') return resolved.side;
	const a0: LayoutVec2 = [junction[0] + sign * half * nA[0], junction[1] + sign * half * nA[1]];
	const b0: LayoutVec2 = [junction[0] + sign * half * nB[0], junction[1] + sign * half * nB[1]];
	return { kind: 'fold', a0, b0 };
}

export function cornerPoint(
	sample: ClipSample,
	half: number,
	cornerStart: Corner,
	cornerEnd: Corner,
): LayoutVec2 {
	if (sample.corner === 'start')
		return sidePoint(cornerStart, half >= 0 ? 'front' : 'back', 'current');
	if (sample.corner === 'end')
		return sidePoint(cornerEnd, half >= 0 ? 'front' : 'back', 'previous');
	return [sample.point[0] + half * sample.normal[0], sample.point[1] + half * sample.normal[1]];
}

/**
 * Resolve a wall-end sample to its own corner coordinate: the shared miter
 * apex, or — for a bevel — the wall's own offset point (`b0` at the current
 * wall's start, `a0` at the previous wall's end). Keeping each wall on its own
 * offset line is what lets the bevel bridge weld without dragging a wall off
 * its line.
 */
export function sidePoint(
	corner: Corner,
	side: 'front' | 'back',
	wall: 'previous' | 'current',
): LayoutVec2 {
	const s = corner[side];
	if (s.kind === 'miter') return s.apex;
	return wall === 'previous' ? s.a0 : s.b0;
}

/** Unconstrained back-side miter apex: the corner of the exterior void. */
export function backMiterApex(prevWall: CompiledWall, wall: CompiledWall): LayoutVec2 {
	const junction = wall.samples[0]!.point;
	const half = wall.thickness / 2;
	const dirA = prevWall.samples.at(-1)!.tangent;
	const nA = prevWall.samples.at(-1)!.normal;
	const dirB = wall.samples[0]!.tangent;
	const nB = wall.samples[0]!.normal;
	const a0: LayoutVec2 = [junction[0] - half * nA[0], junction[1] - half * nA[1]];
	const b0: LayoutVec2 = [junction[0] - half * nB[0], junction[1] - half * nB[1]];
	const det = dirA[0] * dirB[1] - dirA[1] * dirB[0];
	if (Math.abs(det) < 1e-9) return a0;
	const dx = b0[0] - a0[0];
	const dy = b0[1] - a0[1];
	const u = (dx * dirB[1] - dy * dirB[0]) / det;
	return [a0[0] + u * dirA[0], a0[1] + u * dirA[1]];
}

/**
 * Vertical interval set of a wall's endpoint cross-section: the union of all
 * sections whose interval includes the endpoint distance. Lintel bottoms
 * evaluate at the endpoint (arch spring height at the corner), so no 2D arch
 * polygon is needed.
 */
export function endpointProfileIntervals(
	wall: CompiledWall,
	atEnd: boolean,
): Array<[number, number]> {
	const distance = atEnd ? (wall.samples.at(-1)?.distance ?? 0) : 0;
	const intervals: Array<[number, number]> = [];
	for (const section of wall.sections) {
		if (
			distance < section.startDistance - LAYOUT_GEOMETRY_EPSILON ||
			distance > section.endDistance + LAYOUT_GEOMETRY_EPSILON
		)
			continue;
		if (section.kind === 'lintel')
			intervals.push([sectionBottomAt(section, distance), section.topY]);
		else intervals.push([section.bottomY, section.topY]);
	}
	intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const merged: Array<[number, number]> = [];
	for (const [lo, hi] of intervals) {
		if (hi <= lo + LAYOUT_GEOMETRY_EPSILON) continue;
		const last = merged.at(-1);
		if (last && lo <= last[1] + LAYOUT_GEOMETRY_EPSILON) last[1] = Math.max(last[1], hi);
		else merged.push([lo, hi]);
	}
	return merged;
}

export function profileCovers(
	profile: ReadonlyArray<[number, number]>,
	lo: number,
	hi: number,
): boolean {
	return profile.some(
		([pLo, pHi]) => lo >= pLo - LAYOUT_GEOMETRY_EPSILON && hi <= pHi + LAYOUT_GEOMETRY_EPSILON,
	);
}

export function clipSectionSamples(
	samples: readonly CurveSample[],
	start: number,
	end: number,
	extraDistances: readonly number[] = [],
): ClipSample[] {
	const length = samples.at(-1)!.distance;
	const interior: number[] = [];
	for (const sample of samples) {
		if (
			sample.distance > start + LAYOUT_GEOMETRY_EPSILON &&
			sample.distance < end - LAYOUT_GEOMETRY_EPSILON
		) {
			interior.push(sample.distance);
		}
	}
	for (const distance of extraDistances) {
		if (distance > start + LAYOUT_GEOMETRY_EPSILON && distance < end - LAYOUT_GEOMETRY_EPSILON) {
			interior.push(distance);
		}
	}
	interior.sort((a, b) => a - b);

	const clip: ClipSample[] = [makeClipSample(samples, start, length)];
	let previous = start;
	for (const distance of interior) {
		if (distance - previous <= LAYOUT_GEOMETRY_EPSILON) continue; // dedupe coincident samples/knots
		clip.push(makeClipSample(samples, distance, length));
		previous = distance;
	}
	clip.push(makeClipSample(samples, end, length));
	return clip;
}

/** Arch-profile topBoundary x-coordinates mapped onto wall centerline distances. */
export function lintelProfileKnotDistances(section: CompiledWallSection): number[] {
	if (section.kind !== 'lintel' || !section.profile) return [];
	return section.profile.topBoundary.map(([x]) => section.startDistance + x);
}

/**
 * Centerline distances where a lintel's piecewise-linear arch underside crosses
 * a room-wide vertical band breakpoint. The front/back faces are split into
 * bands at those heights; without splitting the arch at the exact crossing,
 * `clamp(bottomA/bottomB, lo, hi)` stair-steps the underside and leaves
 * singly-owned (gap) edges beside the slope.
 */
export function lintelBandIntersectionDistances(
	section: CompiledWallSection,
	roomBreakpoints: readonly number[],
): number[] {
	if (section.kind !== 'lintel' || !section.profile || section.profile.kind === 'rectangular')
		return [];
	const span = [section.startDistance];
	for (const distance of lintelProfileKnotDistances(section)) {
		if (
			distance > section.startDistance + LAYOUT_GEOMETRY_EPSILON &&
			distance < section.endDistance - LAYOUT_GEOMETRY_EPSILON
		) {
			span.push(distance);
		}
	}
	span.push(section.endDistance);
	const result: number[] = [];
	for (let i = 1; i < span.length; i += 1) {
		const d0 = span[i - 1]!;
		const d1 = span[i]!;
		const h0 = sectionBottomAt(section, d0);
		const h1 = sectionBottomAt(section, d1);
		if (Math.abs(h1 - h0) <= LAYOUT_GEOMETRY_EPSILON) continue;
		const lo = Math.min(h0, h1);
		const hi = Math.max(h0, h1);
		for (const y of roomBreakpoints) {
			if (y <= lo + LAYOUT_GEOMETRY_EPSILON || y >= hi - LAYOUT_GEOMETRY_EPSILON) continue;
			const t = (y - h0) / (h1 - h0);
			result.push(d0 + t * (d1 - d0));
		}
	}
	return result;
}

export function makeClipSample(
	samples: readonly CurveSample[],
	distance: number,
	length: number,
): ClipSample {
	const sample = sampleAt(samples, distance);
	return {
		...sample,
		corner:
			distance <= LAYOUT_GEOMETRY_EPSILON
				? 'start'
				: distance >= length - LAYOUT_GEOMETRY_EPSILON
					? 'end'
					: null,
	};
}

export function sampleAt(
	samples: readonly CurveSample[],
	distance: number,
): { point: LayoutVec2; tangent: LayoutVec2; normal: LayoutVec2; distance: number } {
	if (samples.length === 0) return { point: [0, 0], tangent: [1, 0], normal: [0, 1], distance: 0 };
	if (samples.length === 1) {
		const s = samples[0]!;
		return {
			point: [...s.point] as LayoutVec2,
			tangent: s.tangent,
			normal: s.normal,
			distance: s.distance,
		};
	}
	const last = samples.at(-1)!;
	const target = Math.min(last.distance, Math.max(0, distance));
	for (let index = 1; index < samples.length; index += 1) {
		const start = samples[index - 1]!;
		const end = samples[index]!;
		if (target <= end.distance + 1e-9) {
			const span = end.distance - start.distance;
			const amount = span > 1e-9 ? (target - start.distance) / span : 0;
			const tx = start.tangent[0] + (end.tangent[0] - start.tangent[0]) * amount;
			const tz = start.tangent[1] + (end.tangent[1] - start.tangent[1]) * amount;
			const magnitude = Math.hypot(tx, tz) || 1;
			return {
				point: [
					start.point[0] + (end.point[0] - start.point[0]) * amount,
					start.point[1] + (end.point[1] - start.point[1]) * amount,
				],
				tangent: [tx / magnitude, tz / magnitude],
				normal: [-tz / magnitude, tx / magnitude],
				distance: target,
			};
		}
	}
	return {
		point: [...last.point] as LayoutVec2,
		tangent: last.tangent,
		normal: last.normal,
		distance: last.distance,
	};
}

/** Unit geometric normal of a quad's first triangle (right-hand rule), matching its winding. */
export function quadNormal(a: V3, b: V3, c: V3): V3 {
	const ux = b[0] - a[0];
	const uy = b[1] - a[1];
	const uz = b[2] - a[2];
	const vx = c[0] - a[0];
	const vy = c[1] - a[1];
	const vz = c[2] - a[2];
	const nx = uy * vz - uz * vy;
	const ny = uz * vx - ux * vz;
	const nz = ux * vy - uy * vx;
	const magnitude = Math.hypot(nx, ny, nz);
	if (magnitude <= WINDING_DEGENERATE_AREA) return [0, -1, 0]; // degenerate: fall back to −Y
	return [nx / magnitude, ny / magnitude, nz / magnitude];
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
