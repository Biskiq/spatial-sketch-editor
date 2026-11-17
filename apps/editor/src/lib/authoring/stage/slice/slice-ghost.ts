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
 * the creator can see.
 *
 * The reason the same-piece rule is exact: a hidden piece is a convex half-space,
 * so a triangle (the convex hull of its vertices) lies inside one iff its vertices
 * do; a triangle with vertices in two different pieces is connected, and the
 * pieces are separated by visible space, so it necessarily crosses that space.
 *
 * **Conservative fallback.** Geometry whose CPU positions do not match what is
 * drawn (skinned, morph-targeted, instanced) cannot be tested per triangle. It is
 * decided by its world bounds, and when the bounds lie in no single piece the
 * subject is treated as **hidden**. An unneeded ghost over a visible stub is
 * cosmetic; a missing ghost leaves a selected subject invisible.
 */
import { hiddenPiecesOf, pieceContains, type HiddenPiece, type ResolvedSlice } from './slice-cut';

export type SlicePoint3 = readonly [number, number, number];

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

function pieceIdOf(y: number, pieces: readonly HiddenPiece[]): PieceId | null {
	for (const piece of pieces) if (pieceContains(piece, y, 0)) return piece.kind;
	return null;
}

/** The one hidden piece a bounds' vertical span lies inside, or `null`. */
function boundsPiece(bounds: SliceBounds, pieces: readonly HiddenPiece[]): PieceId | null {
	const above = pieces.find((piece) => piece.kind === 'above');
	if (above !== undefined && pieceContains(above, bounds.min[1], 0)) return 'above';
	const below = pieces.find((piece) => piece.kind === 'below');
	if (below !== undefined && pieceContains(below, bounds.max[1], 0)) return 'below';
	return null;
}

/** Whether the bounds lie wholly inside the visible band (shown at every point). */
function boundsFullyVisible(bounds: SliceBounds, resolved: ResolvedSlice): boolean {
	const notAbove = bounds.max[1] <= resolved.cutY;
	const notBelow = resolved.lowerY === null || bounds.min[1] >= resolved.lowerY!;
	return notAbove && notBelow;
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
			const ya = positions[a * 3 + 1]!;
			const yb = positions[b * 3 + 1]!;
			const yc = positions[c * 3 + 1]!;
			if (!Number.isFinite(ya) || !Number.isFinite(yb) || !Number.isFinite(yc)) continue;
			sawTriangle = true;
			const first = pieceIdOf(ya, pieces);
			if (first === null) return false;
			if (pieceIdOf(yb, pieces) !== first) return false;
			if (pieceIdOf(yc, pieces) !== first) return false;
		}
	}
	// No finite triangle survived: nothing provably hidden, so do not ghost it.
	return sawTriangle;
}
