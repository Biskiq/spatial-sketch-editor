/**
 * Whether a subject is **wholly hidden** by the Slice, and so must be drawn as a
 * ghost when it is selected.
 *
 * "Every vertex is hidden" is the wrong rule: a Wall running from below the
 * lower bound to above the cut has all of its vertices hidden (some above, some
 * below) yet crosses the visible band. The exact rule is defined on the hidden
 * *pieces* of `slice-cut.ts`, which are convex and pairwise separated by visible
 * space:
 *
 * > A **triangle** is wholly hidden iff all three vertices lie in the same
 * > hidden piece. A **subject** is wholly hidden iff it has at least one
 * > drawable triangle and every drawable triangle is wholly hidden.
 *
 * A triangle is the convex hull of its vertices, so it lies inside a convex
 * piece iff its vertices do. A triangle whose vertices sit in two different
 * pieces is connected and the pieces are separated by visible space, so it
 * visibly crosses that space.
 *
 * Broad phase: a subject AABB wholly inside one piece is hidden (exact); an AABB
 * wholly inside the visible band is visible (exact); anything else runs the
 * triangle test. Geometry whose CPU positions do not match what is drawn
 * (skinned, morph-targeted or instanced meshes) uses the AABB fallback and, when
 * the AABB is in no single piece, errs toward **hidden**: an unneeded ghost over
 * a visible stub is cosmetic, while a missing ghost would leave a selected
 * subject invisible.
 *
 * Pure and editor-only — no Svelte, no Three. Callers pass world-space or
 * model-space positions with an optional matrix; nothing here reads the scene.
 */
import { hiddenPieceIndexAt, type ResolvedSlice } from './slice-cut';

export type GhostBox = {
	readonly min: readonly [number, number, number];
	readonly max: readonly [number, number, number];
};

/** One drawable mesh's geometry, as the ghost test reads it. */
export type GhostMeshInput = {
	/** Model-space XYZ positions. */
	readonly positions: ArrayLike<number>;
	/** Triangle indices; absent means consecutive triples are triangles. */
	readonly index?: ArrayLike<number> | null;
	/** Column-major 4×4 world matrix; absent means identity. */
	readonly matrixWorld?: ArrayLike<number> | null;
	/** A precomputed world box, when the caller already has one. */
	readonly bounds?: GhostBox | null;
	/**
	 * The CPU positions do not match what is drawn (skinned, morph-targeted or
	 * instanced): use the box fallback and err toward hidden.
	 */
	readonly conservative?: boolean;
};

export type GhostSubjectInput = {
	readonly meshes: readonly GhostMeshInput[];
	/** A precomputed subject box, when the caller already has one. */
	readonly bounds?: GhostBox | null;
};

export type GhostReason =
	| 'no-drawable-triangle'
	| 'bounds-hidden'
	| 'bounds-visible'
	| 'triangles-hidden'
	| 'triangles-visible'
	| 'conservative-hidden'
	| 'conservative-visible';

export type GhostClassification = {
	readonly ghost: boolean;
	readonly reason: GhostReason;
	/** Drawable triangles examined (a conservative mesh counts as one surface). */
	readonly triangleCount: number;
};

const IDENTITY_MATRIX: readonly number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function worldPointAt(
	mesh: GhostMeshInput,
	vertex: number,
	out: [number, number, number]
): boolean {
	const positions = mesh.positions;
	if (vertex * 3 + 2 >= positions.length) return false;
	const x = positions[vertex * 3]!;
	const y = positions[vertex * 3 + 1]!;
	const z = positions[vertex * 3 + 2]!;
	if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false;
	const m = mesh.matrixWorld ?? IDENTITY_MATRIX;
	if (m.length < 16) {
		out[0] = x;
		out[1] = y;
		out[2] = z;
		return true;
	}
	out[0] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
	out[1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
	out[2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
	return true;
}

/** The world box of one mesh's drawable vertices. */
export function meshBoundsOf(mesh: GhostMeshInput): GhostBox | null {
	if (mesh.bounds !== undefined && mesh.bounds !== null) return mesh.bounds;
	const positions = mesh.positions;
	let minX = Infinity;
	let minY = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	let maxZ = -Infinity;
	const point: [number, number, number] = [0, 0, 0];
	const count = Math.floor(positions.length / 3);
	for (let vertex = 0; vertex < count; vertex += 1) {
		if (!worldPointAt(mesh, vertex, point)) continue;
		minX = Math.min(minX, point[0]);
		minY = Math.min(minY, point[1]);
		minZ = Math.min(minZ, point[2]);
		maxX = Math.max(maxX, point[0]);
		maxY = Math.max(maxY, point[1]);
		maxZ = Math.max(maxZ, point[2]);
	}
	if (!(minX <= maxX && minY <= maxY && minZ <= maxZ)) return null;
	return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

/** Whether a mesh can contribute a drawable triangle at all. */
function hasDrawableTriangle(mesh: GhostMeshInput): boolean {
	if (mesh.conservative === true && mesh.bounds !== undefined && mesh.bounds !== null) return true;
	if (mesh.positions.length < 9) return false;
	const index = mesh.index;
	return index === null || index === undefined || index.length >= 3;
}

/** The union box of a subject's meshes. */
export function subjectBoundsOf(subject: GhostSubjectInput): GhostBox | null {
	if (subject.bounds !== undefined && subject.bounds !== null) return subject.bounds;
	let bounds: GhostBox | null = null;
	for (const mesh of subject.meshes) {
		const box = meshBoundsOf(mesh);
		if (box === null) continue;
		if (bounds === null) {
			bounds = { min: [...box.min], max: [...box.max] };
			continue;
		}
		bounds = {
			min: [
				Math.min(bounds.min[0], box.min[0]),
				Math.min(bounds.min[1], box.min[1]),
				Math.min(bounds.min[2], box.min[2])
			],
			max: [
				Math.max(bounds.max[0], box.max[0]),
				Math.max(bounds.max[1], box.max[1]),
				Math.max(bounds.max[2], box.max[2])
			]
		};
	}
	return bounds;
}

/** The one hidden piece that wholly contains this box, or `null`. */
function hiddenPieceOfBox(resolved: ResolvedSlice, box: GhostBox): number | null {
	if (box.min[1] > resolved.cutY) return 0;
	if (resolved.lowerY !== null && box.max[1] < resolved.lowerY) return 1;
	return null;
}

/** Whether the box lies wholly inside the visible band. */
function boxIsVisible(resolved: ResolvedSlice, box: GhostBox): boolean {
	if (box.max[1] > resolved.cutY) return false;
	if (resolved.lowerY !== null && box.min[1] < resolved.lowerY) return false;
	return true;
}

/**
 * Classify one selected subject.
 *
 * `ghost: true` means: draw the subject's meshes as a ghost and leave its gold
 * contour unclipped. `ghost: false` means the usual clipped ink.
 */
export function classifySliceGhost(
	resolved: ResolvedSlice,
	subject: GhostSubjectInput
): GhostClassification {
	if (subject.meshes.length === 0 || !subject.meshes.some(hasDrawableTriangle)) {
		return { ghost: false, reason: 'no-drawable-triangle', triangleCount: 0 };
	}
	const subjectBox = subjectBoundsOf(subject);
	if (subjectBox !== null) {
		if (hiddenPieceOfBox(resolved, subjectBox) !== null) {
			return { ghost: true, reason: 'bounds-hidden', triangleCount: 0 };
		}
		if (boxIsVisible(resolved, subjectBox)) {
			return { ghost: false, reason: 'bounds-visible', triangleCount: 0 };
		}
	}

	let triangleCount = 0;
	const points: [number, number, number][] = [
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0]
	];
	let conservativeVisible = false;
	let conservativeHidden = false;

	for (const mesh of subject.meshes) {
		if (mesh.conservative === true) {
			const box = meshBoundsOf(mesh);
			if (box === null) continue;
			triangleCount += 1;
			if (hiddenPieceOfBox(resolved, box) !== null) {
				conservativeHidden = true;
				continue;
			}
			if (boxIsVisible(resolved, box)) {
				conservativeVisible = true;
				continue;
			}
			// The box straddles a boundary and the CPU geometry cannot be trusted:
			// draw the ghost rather than leave a selected subject invisible.
			return { ghost: true, reason: 'conservative-hidden', triangleCount };
		}

		const index = mesh.index;
		const total = index !== null && index !== undefined ? index.length : Math.floor(mesh.positions.length / 3);
		for (let offset = 0; offset + 2 < total; offset += 3) {
			const a = index !== null && index !== undefined ? Number(index[offset]) : offset;
			const b = index !== null && index !== undefined ? Number(index[offset + 1]) : offset + 1;
			const c = index !== null && index !== undefined ? Number(index[offset + 2]) : offset + 2;
			if (!worldPointAt(mesh, a, points[0]!)) continue;
			if (!worldPointAt(mesh, b, points[1]!)) continue;
			if (!worldPointAt(mesh, c, points[2]!)) continue;
			triangleCount += 1;
			const pieceA = hiddenPieceIndexAt(resolved, points[0]![1], 0);
			const pieceB = hiddenPieceIndexAt(resolved, points[1]![1], 0);
			const pieceC = hiddenPieceIndexAt(resolved, points[2]![1], 0);
			if (pieceA === null || pieceA !== pieceB || pieceA !== pieceC) {
				return { ghost: false, reason: 'triangles-visible', triangleCount };
			}
		}
	}

	if (triangleCount === 0) {
		return { ghost: false, reason: 'no-drawable-triangle', triangleCount: 0 };
	}
	if (conservativeVisible) {
		return { ghost: false, reason: 'conservative-visible', triangleCount };
	}
	if (conservativeHidden) {
		return { ghost: true, reason: 'conservative-hidden', triangleCount };
	}
	return { ghost: true, reason: 'triangles-hidden', triangleCount };
}
