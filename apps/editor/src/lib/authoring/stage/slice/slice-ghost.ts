/**
 * Wholly-hidden classification for the Slice ghost.
 *
 * Pure and Three-free: buffers in, one boolean out. The rule is the plan's §2.4
 * and it is **exact**, not a heuristic:
 *
 * > A triangle is wholly hidden iff all three vertices lie in the **same** hidden
 * > piece. A subject is wholly hidden iff it has at least one drawable triangle and
 * > every drawable triangle is wholly hidden.
 *
 * "Every vertex is hidden" is wrong, and the defect it causes is visible: a Wall
 * running from below the lower bound to above the cut has all of its vertices
 * hidden yet crosses the visible band, so a per-vertex test would ghost a subject
 * the creator can see. The same defect appears on a body crossing a drawn cut: its
 * vertices may sit on the removed side and the far slab while its middle remains
 * visible.
 *
 * The reason the same-piece rule is exact: every hidden piece — Level's half-spaces
 * and both of SL2's drawn pieces — is convex, so a triangle (the convex hull of its
 * vertices) lies inside one iff its vertices do; a triangle with vertices in two
 * different pieces is connected, and the pieces are separated by visible space, so
 * it necessarily crosses that space.
 *
 * **Conservative fallback.** Geometry whose CPU positions do not match what is
 * drawn (skinned, morph-targeted, instanced) cannot be tested per triangle. It is
 * decided by its world bounds, and when the bounds lie in no single piece the
 * subject is treated as **hidden**. An unneeded ghost over a visible stub is
 * cosmetic; a missing ghost leaves a selected subject invisible.
 */
import {
	hiddenPiecesOf,
	pieceContainsPoint,
	sliceHides,
	type HiddenPiece,
	type ResolvedSlice,
	type SliceVec3
} from './slice-cut';

export type SlicePoint3 = SliceVec3;

export type SliceBounds = {
	readonly min: SlicePoint3;
	readonly max: SlicePoint3;
};

/**
 * One drawable triangle buffer in **world** space.
 *
 * The caller bakes the mesh's world matrix into `positions` (or passes an indexed
 * buffer whose vertices are already world-space), so this module needs no matrix
 * maths and no Three `Matrix4`.
 */
export type SliceTriangleBuffer = {
	readonly positions: ArrayLike<number>;
	readonly index?: ArrayLike<number> | null;
};

export type SliceGhostSubject = {
	/** Every drawable triangle of the subject, across its meshes. */
	readonly triangles: readonly SliceTriangleBuffer[];
	/** World AABB, when the caller has one: it makes the common cases exact and cheap. */
	readonly bounds?: SliceBounds | null;
	/**
	 * The CPU positions do not describe what is drawn (skinned, morph, instanced).
	 * The bounds decide, erring toward drawing the ghost.
	 */
	readonly approximate?: boolean;
};

type PieceId = HiddenPiece['kind'];

function pieceIdOf(x: number, y: number, z: number, pieces: readonly HiddenPiece[]): PieceId | null {
	for (const piece of pieces) if (pieceContainsPoint(piece, x, y, z, 0)) return piece.kind;
	return null;
}

/** Eight corners of a bounds, the points that make a convex box test exact. */
function cornersOf(bounds: SliceBounds): SliceVec3[] {
	const corners: SliceVec3[] = [];
	for (const x of [bounds.min[0], bounds.max[0]]) {
		for (const y of [bounds.min[1], bounds.max[1]]) {
			for (const z of [bounds.min[2], bounds.max[2]]) corners.push([x, y, z]);
		}
	}
	return corners;
}

/** The one hidden piece a bounds lies wholly inside, or `null`. */
function boundsPiece(bounds: SliceBounds, pieces: readonly HiddenPiece[]): PieceId | null {
	const corners = cornersOf(bounds);
	const first = pieceIdOf(corners[0]![0], corners[0]![1], corners[0]![2], pieces);
	if (first === null) return null;
	for (const corner of corners) {
		if (pieceIdOf(corner[0], corner[1], corner[2], pieces) !== first) return null;
	}
	return first;
}

/** Whether the bounds are shown at every corner and at their centre. */
function boundsFullyVisible(bounds: SliceBounds, resolved: ResolvedSlice): boolean {
	const center: SliceVec3 = [
		(bounds.min[0] + bounds.max[0]) / 2,
		(bounds.min[1] + bounds.max[1]) / 2,
		(bounds.min[2] + bounds.max[2]) / 2
	];
	for (const point of [...cornersOf(bounds), center]) {
		if (sliceHides(resolved, point[0], point[1], point[2], 0)) return false;
	}
	return true;
}

function countTriangles(subject: SliceGhostSubject): number {
	let count = 0;
	for (const buffer of subject.triangles) {
		const positions = buffer.positions;
		const vertices = Math.floor(positions.length / 3);
		count += buffer.index == null ? Math.floor(vertices / 3) : Math.floor(buffer.index.length / 3);
	}
	return count;
}

function boundsOf(subject: SliceGhostSubject): SliceBounds | null {
	if (subject.bounds != null) return subject.bounds;
	let minX = Infinity;
	let minY = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	let maxZ = -Infinity;
	for (const buffer of subject.triangles) {
		const positions = buffer.positions;
		for (let i = 0; i + 2 < positions.length; i += 3) {
			const x = positions[i]!;
			const y = positions[i + 1]!;
			const z = positions[i + 2]!;
			if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
			if (x < minX) minX = x;
			if (y < minY) minY = y;
			if (z < minZ) minZ = z;
			if (x > maxX) maxX = x;
			if (y > maxY) maxY = y;
			if (z > maxZ) maxZ = z;
		}
	}
	if (!(minX <= maxX)) return null;
	return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

/**
 * Whether every drawable triangle of `subject` is wholly hidden.
 *
 * A subject with no drawable triangle and no bounds is **not** ghosted: there is
 * nothing to ghost, and drawing an empty ghost would hide the fact that the subject
 * has no body. A subject made only of driven geometry (skinned or instanced) is
 * `approximate` with bounds, and the bounds rule decides it.
 */
export function subjectWhollyHidden(resolved: ResolvedSlice, subject: SliceGhostSubject): boolean {
	const pieces = hiddenPiecesOf(resolved);
	const triangles = countTriangles(subject);
	const bounds = boundsOf(subject);
	if (subject.approximate !== true && triangles === 0) return false;
	if (subject.approximate === true || triangles === 0) {
		// Fallback: bounds decide; anything not provably visible is hidden.
		if (bounds === null) return true;
		const piece = boundsPiece(bounds, pieces);
		if (piece !== null) return true;
		return !boundsFullyVisible(bounds, resolved);
	}
	if (bounds !== null) {
		if (boundsPiece(bounds, pieces) !== null) return true;
		if (boundsFullyVisible(bounds, resolved)) return false;
	}
	let sawTriangle = false;
	for (const buffer of subject.triangles) {
		const positions = buffer.positions;
		const index = buffer.index;
		const triangleCount = Math.floor((index == null ? positions.length / 3 : index.length) / 3);
		for (let triangle = 0; triangle < triangleCount; triangle += 1) {
			const a = index == null ? triangle * 3 : index[triangle * 3]!;
			const b = index == null ? triangle * 3 + 1 : index[triangle * 3 + 1]!;
			const c = index == null ? triangle * 3 + 2 : index[triangle * 3 + 2]!;
			const ax = positions[a * 3]!;
			const ay = positions[a * 3 + 1]!;
			const az = positions[a * 3 + 2]!;
			const bx = positions[b * 3]!;
			const by = positions[b * 3 + 1]!;
			const bz = positions[b * 3 + 2]!;
			const cx = positions[c * 3]!;
			const cy = positions[c * 3 + 1]!;
			const cz = positions[c * 3 + 2]!;
			if (![ax, ay, az, bx, by, bz, cx, cy, cz].every(Number.isFinite)) continue;
			sawTriangle = true;
			const first = pieceIdOf(ax, ay, az, pieces);
			if (first === null) return false;
			if (pieceIdOf(bx, by, bz, pieces) !== first) return false;
			if (pieceIdOf(cx, cy, cz, pieces) !== first) return false;
		}
	}
	// No finite triangle survived: nothing provably hidden, so do not ghost it.
	return sawTriangle;
}
