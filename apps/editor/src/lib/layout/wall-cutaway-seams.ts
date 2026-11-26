/**
 * X2's seam faces: the vertical paper that closes a cut Wall where it met a Wall
 * that was **not** cut.
 *
 * A compiled per-Wall mesh is deliberately open at a Junction interface: the
 * neighbour's material rests there, so the face is interior and the builder omits
 * it (`F11`). Cutting one leg of the Junction removes that neighbour material
 * above the stub, but the omitted face is still missing — so without a seam face
 * the creator would look through the open end into the neighbour's hollow body.
 *
 * The seam faces are derived **only** from compiled Junction facts, never from a
 * builder and never from the drawn meshes:
 *
 * 1. **Interfaces.** Each `U.join.interfaces` entry whose `wallId` is the cut leg
 *    names the region of `U`'s own face the cut leg rested on. The face's plan
 *    line is `U`'s centreline at `[fromDistance, toDistance]` offset by half its
 *    thickness along the entry's own outward normal, over the entry's bands.
 * 2. **Shared boundary edges.** Where the two legs' end-region boundaries
 *    (`endBoundary`, `ownedSeam.polygon`, `keel.regions`) coincide — a mitered L,
 *    a tangent continuation, a keel partition — the overlap is the exposure.
 *
 * Two cut legs never get a seam and two uncut legs never get one. Each quad is
 * wound **outward from the cut Wall's remaining material**, which is what lets the
 * horizontal cap section close; it is drawn double-sided paper, so the visual face
 * is unaffected by that winding.
 */
import type {
	CompiledJunction,
	CompiledLegJoin,
	CompiledPhysicalWall,
	LayoutVec2,
} from '@portfolio/layout-core/geometry';

/** One vertical seam face, one per vertical band. */
export type CutawaySeam = {
	/** `seam:<uncutWallId>:<cutWallId>`, stable across rebuilds. */
	readonly identity: string;
	/** The cut leg the face belongs to. */
	readonly wallId: string;
	/** The uncut neighbour it closes against. */
	readonly otherWallId: string;
	/** The face's plan line, already on the neighbour's offset face. */
	readonly from: LayoutVec2;
	readonly to: LayoutVec2;
	readonly bottomY: number;
	readonly topY: number;
	/**
	 * Whether this face closes the cut Wall's own stub in the horizontal section.
	 *
	 * A face that runs along the cut Wall's side (parallel to its tangent) is an
	 * exposed neighbour end, drawn as paper but not part of the cut body's
	 * cross-section: feeding it to `sectionMeshes` would add an interior edge and
	 * leave the chain open. Faces across the end (a butt, a thickness step, a
	 * miter) do close it.
	 */
	readonly closesStub: boolean;
};

export type CutawaySeamResult = {
	readonly seams: readonly CutawaySeam[];
	/** Interfaces a rule could not build (a missing wall or degenerate face). */
	readonly unmatched: readonly { readonly wallId: string; readonly otherWallId: string }[];
};

/** The clearance below the stub the seam starts at, so the cap section crosses it. */
export const SEAM_EMBED_METERS = 0.01;

/** Collinearity and overlap tolerances from the plan (§3.5). */

type Band = { readonly bottomY: number; readonly topY: number };

function pointAtDistance(wall: CompiledPhysicalWall, distance: number): LayoutVec2 | null {
	const samples = wall.samples;
	if (samples.length === 0) return null;
	const first = samples[0]!;
	const last = samples.at(-1)!;
	if (distance <= first.distance + 1e-9) return first.point;
	if (distance >= last.distance - 1e-9) return last.point;
	for (let index = 1; index < samples.length; index += 1) {
		const end = samples[index]!;
		if (distance > end.distance + 1e-9) continue;
		const start = samples[index - 1]!;
		const span = end.distance - start.distance;
		if (!(span > 1e-9)) return end.point;
		const t = Math.min(1, Math.max(0, (distance - start.distance) / span));
		return [
			start.point[0] + (end.point[0] - start.point[0]) * t,
			start.point[1] + (end.point[1] - start.point[1]) * t,
		];
	}
	return last.point;
}

function wallTop(wall: CompiledPhysicalWall, elevation: number): number {
	return elevation + wall.height;
}

function intersectBands(
	left: readonly Band[],
	right: readonly Band[],
	minY: number,
	maxY: number,
): Band[] {
	const out: Band[] = [];
	for (const a of left) {
		for (const b of right) {
			const bottom = Math.max(a.bottomY, b.bottomY, minY);
			const top = Math.min(a.topY, b.topY, maxY);
			if (top > bottom + 1e-6) out.push({ bottomY: bottom, topY: top });
		}
	}
	return mergeBands(out);
}

function mergeBands(bands: readonly Band[]): Band[] {
	const sorted = [...bands].sort((left, right) => left.bottomY - right.bottomY);
	const merged: { bottomY: number; topY: number }[] = [];
	for (const band of sorted) {
		const last = merged.at(-1);
		if (last !== undefined && band.bottomY <= last.topY + 1e-6) {
			last.topY = Math.max(last.topY, band.topY);
			continue;
		}
		merged.push({ bottomY: band.bottomY, topY: band.topY });
	}
	return merged;
}

function quantize(value: number): number {
	return Math.round(value / 1e-5) / 1e-5;
}

function seamKey(from: LayoutVec2, to: LayoutVec2, bottomY: number, topY: number): string {
	const forward = from[0] < to[0] || (from[0] === to[0] && from[1] <= to[1]);
	const a = forward ? from : to;
	const b = forward ? to : from;
	return `${quantize(a[0])},${quantize(a[1])}|${quantize(b[0])},${quantize(b[1])}|${quantize(bottomY)}|${quantize(topY)}`;
}

/**
 * The uncut leg's own end cross-section: its end point and the line across its
 * thickness, perpendicular to the Wall there.
 *
 * A tangent/butt Join compiles with no `endBoundary` and no `ownedSeam`, yet both
 * leg meshes are open at the shared face. The face the cut exposes is the uncut
 * leg's end cross-section, and it is always derivable from the Wall's own
 * samples — including a thickness step, where the wider neighbour's face is the
 * one the eye would otherwise look through.
 */
/** The Wall's plan tangent at the joined end, pointing along increasing station. */
function tangentAt(wall: CompiledPhysicalWall, join: CompiledLegJoin): LayoutVec2 | null {
	const sample = join.end === 'start' ? wall.samples[0] : wall.samples.at(-1);
	if (sample === undefined) return null;
	const length = Math.hypot(sample.tangent[0], sample.tangent[1]);
	return length > 1e-9 ? [sample.tangent[0] / length, sample.tangent[1] / length] : null;
}

/** A plan-line intersection, or null when the lines are parallel. */
function intersectLines(
	a: { readonly point: LayoutVec2; readonly direction: LayoutVec2 },
	b: { readonly point: LayoutVec2; readonly direction: LayoutVec2 },
): LayoutVec2 | null {
	const cross = a.direction[0] * b.direction[1] - a.direction[1] * b.direction[0];
	if (Math.abs(cross) < 1e-9) return null;
	const dx = b.point[0] - a.point[0];
	const dz = b.point[1] - a.point[1];
	const t = (dx * b.direction[1] - dz * b.direction[0]) / cross;
	return [a.point[0] + a.direction[0] * t, a.point[1] + a.direction[1] * t];
}

/** The two side faces of a Wall at one of its ends, as infinite plan lines. */
function sideLines(
	wall: CompiledPhysicalWall,
	join: CompiledLegJoin,
): readonly { point: LayoutVec2; direction: LayoutVec2 }[] {
	const sample = join.end === 'start' ? wall.samples[0] : wall.samples.at(-1);
	const tangent = tangentAt(wall, join);
	if (sample === undefined || tangent === null) return [];
	const half = wall.thickness / 2;
	const nx = -tangent[1];
	const nz = tangent[0];
	return [
		{ point: [sample.point[0] + nx * half, sample.point[1] + nz * half], direction: tangent },
		{ point: [sample.point[0] - nx * half, sample.point[1] - nz * half], direction: tangent },
	];
}

/**
 * The miter face of a two-leg Junction, derived from the two Wall bodies.
 *
 * It is the line through the intersections of corresponding side faces whose
 * normal is the angle bisector of the two legs' inward directions — the plane both
 * meshes were clipped at. `ownedSeam` is a miter **allowance** wedge, not the face
 * itself, so deriving it from the two Wall bodies is what matches the drawn ends.
 */
function miterFace(
	cutWall: CompiledPhysicalWall,
	cutJoin: CompiledLegJoin,
	otherWall: CompiledPhysicalWall,
	otherJoin: CompiledLegJoin,
): { from: LayoutVec2; to: LayoutVec2 } | null {
	const cutTangent = tangentAt(cutWall, cutJoin);
	const otherTangent = tangentAt(otherWall, otherJoin);
	if (cutTangent === null || otherTangent === null) return null;
	const inward = (tangent: LayoutVec2, join: CompiledLegJoin): LayoutVec2 =>
		join.end === 'start' ? [-tangent[0], -tangent[1]] : tangent;
	const a = inward(cutTangent, cutJoin);
	const b = inward(otherTangent, otherJoin);
	const bisector: LayoutVec2 = [a[0] + b[0], a[1] + b[1]];
	const bisectorLength = Math.hypot(bisector[0], bisector[1]);
	if (!(bisectorLength > 1e-6)) return null;

	const points: LayoutVec2[] = [];
	for (const cutSide of sideLines(cutWall, cutJoin)) {
		for (const otherSide of sideLines(otherWall, otherJoin)) {
			const point = intersectLines(cutSide, otherSide);
			if (point !== null) points.push(point);
		}
	}
	let best: { from: LayoutVec2; to: LayoutVec2 } | null = null;
	let bestScore = Number.NEGATIVE_INFINITY;
	for (let i = 0; i < points.length; i += 1) {
		for (let j = i + 1; j < points.length; j += 1) {
			const from = points[i]!;
			const to = points[j]!;
			const dx = to[0] - from[0];
			const dz = to[1] - from[1];
			const length = Math.hypot(dx, dz);
			if (!(length > 1e-9)) continue;
			// The miter face runs along the bisector of the two inward material
			// directions (from the outside corner to the inside one).
			const score = Math.abs((dx * bisector[0] + dz * bisector[1]) / (length * bisectorLength));
			if (score > bestScore + 1e-9) {
				best = { from, to };
				bestScore = score;
			}
		}
	}
	return bestScore > 0.999 ? best : null;
}

function endCrossSection(
	wall: CompiledPhysicalWall,
	join: CompiledLegJoin,
): { from: LayoutVec2; to: LayoutVec2 } | null {
	const sample = join.end === 'start' ? wall.samples[0] : wall.samples.at(-1);
	if (sample === undefined) return null;
	const half = wall.thickness / 2;
	const tangent = sample.tangent;
	const length = Math.hypot(tangent[0], tangent[1]);
	if (!(length > 1e-9) || !(half > 0)) return null;
	const nx = -tangent[1] / length;
	const nz = tangent[0] / length;
	return {
		from: [sample.point[0] + nx * half, sample.point[1] + nz * half],
		to: [sample.point[0] - nx * half, sample.point[1] - nz * half],
	};
}

/**
 * Clip a plan segment to a Wall's body: within its half-thickness of the
 * centreline, from its joined end into its length. A seam only exists where the
 * saved Wall actually rests on the neighbour's end face.
 */
function clipToWallBand(
	from: LayoutVec2,
	to: LayoutVec2,
	wall: CompiledPhysicalWall,
	join: CompiledLegJoin,
): { from: LayoutVec2; to: LayoutVec2 } | null {
	const sample = join.end === 'start' ? wall.samples[0] : wall.samples.at(-1);
	if (sample === undefined) return null;
	const tangentLength = Math.hypot(sample.tangent[0], sample.tangent[1]);
	if (!(tangentLength > 1e-9)) return null;
	const sign = join.end === 'start' ? 1 : -1;
	const tx = (sample.tangent[0] / tangentLength) * sign;
	const tz = (sample.tangent[1] / tangentLength) * sign;
	const nx = -sample.tangent[1] / tangentLength;
	const nz = sample.tangent[0] / tangentLength;
	const half = wall.thickness / 2 + 1e-9;
	const offset = (point: LayoutVec2): number =>
		(point[0] - sample.point[0]) * nx + (point[1] - sample.point[1]) * nz;
	const along = (point: LayoutVec2): number =>
		(point[0] - sample.point[0]) * tx + (point[1] - sample.point[1]) * tz;

	const o0 = offset(from);
	const o1 = offset(to);
	const a0 = along(from);
	const a1 = along(to);
	let lo = 0;
	let hi = 1;
	const clip = (p0: number, p1: number, min: number, max: number): boolean => {
		const delta = p1 - p0;
		if (Math.abs(delta) < 1e-12) return p0 >= min - 1e-9 && p0 <= max + 1e-9;
		let t0 = (min - p0) / delta;
		let t1 = (max - p0) / delta;
		if (t0 > t1) [t0, t1] = [t1, t0];
		lo = Math.max(lo, t0);
		hi = Math.min(hi, t1);
		return lo <= hi + 1e-9;
	};
	if (!clip(o0, o1, -half, half)) return null;
	// A branch leg is trimmed at `clipDistance`; the band before that is the
	// neighbour's core material, not this Wall's body, so a seam may not live there.
	const bodyStart = Math.max(0, join.clipDistance ?? 0);
	if (!clip(a0, a1, bodyStart - 1e-9, wall.length + 1e-3)) return null;
	if (hi - lo < 1e-6) return null;
	const at = (t: number): LayoutVec2 => [
		from[0] + (to[0] - from[0]) * t,
		from[1] + (to[1] - from[1]) * t,
	];
	return { from: at(lo), to: at(hi) };
}

/**
 * Wind the plan line so the face's geometric normal points away from the cut
 * Wall's material. That outward normal is what `sectionMeshes` needs to close the
 * horizontal cap with consistent winding.
 */
function oriented(
	from: LayoutVec2,
	to: LayoutVec2,
	cutWall: CompiledPhysicalWall,
	cutJoin: CompiledLegJoin,
	elevation: number,
): readonly [LayoutVec2, LayoutVec2] {
	// The probe must be inside the Wall's **body**: a trimmed branch leg starts at
	// `clipDistance`, so the naive 5 cm from the nominal end can sit in the
	// neighbour's core material and point the normal the wrong way.
	const trim = Math.max(0, cutJoin.clipDistance ?? 0);
	const bodyLength = Math.max(0, cutWall.length - trim);
	const inset = Math.min(0.05, bodyLength / 2);
	const probe = pointAtDistance(
		cutWall,
		cutJoin.end === 'start' ? trim + inset : cutWall.length - trim - inset,
	);
	if (probe === null) return [from, to];
	// Outward is from the cut Wall's own material (the probe just inside its end)
	// toward the seam's centre. The seam line can be perpendicular to the Wall, so
	// orienting by a point on the line's side is degenerate; the material-to-seam
	// direction is not.
	const midpoint: LayoutVec2 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
	const outwardX = midpoint[0] - probe[0];
	const outwardZ = midpoint[1] - probe[1];
	const dx = to[0] - from[0];
	const dz = to[1] - from[1];
	// Plan normal of (from, to, to+up): (-dz, dx).
	const dot = -dz * outwardX + dx * outwardZ;
	void elevation;
	return dot < 0 ? [to, from] : [from, to];
}

export function cutawaySeams(input: {
	readonly junctions: readonly CompiledJunction[];
	readonly walls: readonly CompiledPhysicalWall[];
	readonly cut: ReadonlySet<string>;
	readonly stubTopY: number;
	readonly elevationOfWall: (wallId: string) => number;
}): CutawaySeamResult {
	const wallById = new Map(input.walls.map((wall) => [wall.wallId, wall] as const));
	const seams: CutawaySeam[] = [];
	const seen = new Set<string>();
	const unmatched: { wallId: string; otherWallId: string }[] = [];

	function add(
		from: LayoutVec2,
		to: LayoutVec2,
		bands: readonly Band[],
		cutJoin: CompiledLegJoin,
		otherWallId: string,
		cutWall: CompiledPhysicalWall,
		elevation: number,
		closesStub: boolean,
	): boolean {
		const [a, b] = oriented(from, to, cutWall, cutJoin, elevation);
		let added = false;
		for (const band of bands) {
			const key = `${cutJoin.wallId}|${seamKey(a, b, band.bottomY, band.topY)}`;
			if (seen.has(key)) continue;
			seen.add(key);
			seams.push({
				identity: `seam:${otherWallId}:${cutJoin.wallId}`,
				wallId: cutJoin.wallId,
				otherWallId,
				from: a,
				to: b,
				bottomY: band.bottomY,
				topY: band.topY,
				closesStub,
			});
			added = true;
		}
		return added;
	}

	/**
	 * An end face as a plan line, plus whether it must be clipped to the other
	 * Wall's body. A miter face is shared by both bodies exactly, so it is never
	 * clipped; an `endBoundary` or a plain cross-section is only exposed where the
	 * neighbour actually rests on it.
	 */
	type EndFace = { readonly from: LayoutVec2; readonly to: LayoutVec2; readonly clip: boolean };

	/** The cut Wall's own end face at this Junction. */
	function cutEndFace(
		cutWall: CompiledPhysicalWall,
		cutJoin: CompiledLegJoin,
		otherWall: CompiledPhysicalWall,
		otherJoin: CompiledLegJoin,
		degree: number,
	): EndFace | null {
		if (cutJoin.endBoundary.length >= 2) {
			return { from: cutJoin.endBoundary[0]!, to: cutJoin.endBoundary[1]!, clip: true };
		}
		if (degree === 2) {
			const miter = miterFace(cutWall, cutJoin, otherWall, otherJoin);
			if (miter !== null) return { ...miter, clip: false };
		}
		const cross = endCrossSection(cutWall, cutJoin);
		return cross === null ? null : { ...cross, clip: true };
	}

	/** The uncut neighbour's own end face at this Junction (paper, not the cap). */
	function otherEndFace(
		otherWall: CompiledPhysicalWall,
		otherJoin: CompiledLegJoin,
		cutWall: CompiledPhysicalWall,
		cutJoin: CompiledLegJoin,
		degree: number,
	): EndFace | null {
		if (otherJoin.endBoundary.length >= 2) {
			return { from: otherJoin.endBoundary[0]!, to: otherJoin.endBoundary[1]!, clip: true };
		}
		if (degree === 2) {
			const miter = miterFace(otherWall, otherJoin, cutWall, cutJoin);
			if (miter !== null) return { ...miter, clip: false };
		}
		const cross = endCrossSection(otherWall, otherJoin);
		return cross === null ? null : { ...cross, clip: true };
	}

	for (const junction of input.junctions) {
		const joins = junction.resolution.joins;
		if (joins.length < 2) continue;
		for (const cutJoin of joins) {
			if (!input.cut.has(cutJoin.wallId)) continue;
			const cutWall = wallById.get(cutJoin.wallId);
			if (cutWall === undefined) continue;
			const cutElevation = input.elevationOfWall(cutWall.wallId);
			const cutTop = wallTop(cutWall, cutElevation);

			// Pass 1 — the cut Wall's own end face, where a neighbour's **end** meets
			// it. That is the face the horizontal cap section must meet to close. A
			// neighbour resting its side against the cut end already seals it (its
			// side is a closed face), so it gets no cap seam.
			for (const otherJoin of joins) {
				if (otherJoin.wallId === cutJoin.wallId) continue;
				if (input.cut.has(otherJoin.wallId)) continue;
				const otherWall = wallById.get(otherJoin.wallId);
				if (otherWall === undefined) continue;
				const otherElevation = input.elevationOfWall(otherWall.wallId);
				const maxY = Math.min(cutTop, wallTop(otherWall, otherElevation));
				const minY = input.stubTopY - SEAM_EMBED_METERS;
				if (!(maxY > minY + 1e-6)) continue;
				const bands = intersectBands(otherJoin.bands, cutJoin.bands, minY, maxY);
				if (bands.length === 0) continue;
				const face = cutEndFace(cutWall, cutJoin, otherWall, otherJoin, joins.length);
				if (face === null) continue;
				const clipped = face.clip
					? clipToWallBand(face.from, face.to, otherWall, otherJoin)
					: { from: face.from, to: face.to };
				if (clipped === null) continue;
				add(
					clipped.from,
					clipped.to,
					bands,
					cutJoin,
					otherJoin.wallId,
					cutWall,
					cutElevation,
					true,
				);
			}
		}

		// Pass 2 — an uncut neighbour's own exposed end, where the cut Wall used to
		// cover it. Paper only: it is not part of the cut body's cross-section.
		for (const cutJoin of joins) {
			if (!input.cut.has(cutJoin.wallId)) continue;
			const cutWall = wallById.get(cutJoin.wallId);
			if (cutWall === undefined) continue;
			const cutElevation = input.elevationOfWall(cutWall.wallId);
			const cutTop = wallTop(cutWall, cutElevation);
			for (const otherJoin of joins) {
				if (otherJoin.wallId === cutJoin.wallId) continue;
				if (input.cut.has(otherJoin.wallId)) continue;
				const otherWall = wallById.get(otherJoin.wallId);
				if (otherWall === undefined) continue;
				const otherElevation = input.elevationOfWall(otherWall.wallId);
				const maxY = Math.min(cutTop, wallTop(otherWall, otherElevation));
				const minY = input.stubTopY - SEAM_EMBED_METERS;
				if (!(maxY > minY + 1e-6)) continue;
				const bands = intersectBands(otherJoin.bands, cutJoin.bands, minY, maxY);
				if (bands.length === 0) continue;
				const face = otherEndFace(otherWall, otherJoin, cutWall, cutJoin, joins.length);
				const clipped =
					face === null
						? null
						: face.clip
							? clipToWallBand(face.from, face.to, cutWall, cutJoin)
							: { from: face.from, to: face.to };
				if (clipped === null) continue;
				add(
					clipped.from,
					clipped.to,
					bands,
					cutJoin,
					otherJoin.wallId,
					cutWall,
					cutElevation,
					false,
				);
			}
		}
	}
	return { seams, unmatched };
}
