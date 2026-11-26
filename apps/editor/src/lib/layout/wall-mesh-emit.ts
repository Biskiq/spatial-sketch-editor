import type { LayoutWallSide } from '@portfolio/layout-core/plan';
import { LAYOUT_GEOMETRY_EPSILON } from '@portfolio/layout-core/geometry';
import type {
	Face,
	FacePick,
	IndexedWallMesh,
	IndexedWallMeshGroup,
	Layout3dPickRange,
	Layout3dTriangleRef,
	V3,
	Vertex,
	WallFaces,
	WallMeshSectionRef,
	WallMeshSurfaceKey,
} from './wall-mesh-types';
import { NORMAL_GRID, UV_GRID, WINDING_DEGENERATE_AREA } from './wall-mesh-types';

export function vertex(
	x: number,
	y: number,
	z: number,
	nx: number,
	ny: number,
	nz: number,
	u: number,
	v: number,
): Vertex {
	return { p: [x, y, z], n: [nx, ny, nz], u, v };
}

/**
 * The builder's explicit development attribution. A vertex
 * is projected onto the source centerline segment it was emitted from; the
 * station is the true sample distance, the offset is signed along the
 * canonical left normal, and the height is above the floor. This is the
 * per-vertex `(s, w, y)` the development consumes, not a guess from UVs.
 */
export function attributeWallVertex(
	development: NonNullable<WallFaces['development']>,
	point: V3,
): [number, number, number] {
	const samples = development.samples;
	let bestDistance = Infinity;
	let bestStation = 0;
	let bestOffset = 0;
	for (let index = 1; index < samples.length; index += 1) {
		const start = samples[index - 1]!;
		const end = samples[index]!;
		const dx = end.point[0] - start.point[0];
		const dz = end.point[1] - start.point[1];
		const squared = dx * dx + dz * dz;
		const raw =
			squared > 0
				? ((point[0] - start.point[0]) * dx + (point[2] - start.point[1]) * dz) / squared
				: 0;
		const amount = Math.min(1, Math.max(0, raw));
		const px = start.point[0] + dx * amount;
		const pz = start.point[1] + dz * amount;
		const distanceSquared = (point[0] - px) ** 2 + (point[2] - pz) ** 2;
		if (distanceSquared >= bestDistance) continue;
		bestDistance = distanceSquared;
		bestStation = start.distance + (end.distance - start.distance) * amount;
		const nx = start.normal[0] + (end.normal[0] - start.normal[0]) * amount;
		const nz = start.normal[1] + (end.normal[1] - start.normal[1]) * amount;
		const magnitude = Math.hypot(nx, nz) || 1;
		bestOffset = ((point[0] - px) * nx + (point[2] - pz) * nz) / magnitude;
	}
	return [bestStation, bestOffset, point[1] - development.floorElevation];
}

export function quad(a: Vertex, b: Vertex, c: Vertex, d: Vertex, pick?: FacePick): Face {
	return { verts: [a, b, c, d], ...(pick ? { pick } : {}) };
}

/**
 * Emit a vertical band face with `a`/`d` as top corners and `b`/`c` as bottom
 * corners. When a sloped arch bottom meets the band top at one end, that end's
 * bottom corner coincides with its top corner — collapse the quad to a triangle
 * (preserving winding) instead of emitting a zero-area second triangle.
 */
export function pushBandFace(
	faces: Face[],
	a: Vertex,
	b: Vertex,
	c: Vertex,
	d: Vertex,
	pick?: FacePick,
): void {
	const same = (p: Vertex, q: Vertex) =>
		Math.hypot(p.p[0] - q.p[0], p.p[1] - q.p[1], p.p[2] - q.p[2]) <= LAYOUT_GEOMETRY_EPSILON;
	if (same(b, a)) {
		faces.push({ verts: [a, c, d], ...(pick ? { pick } : {}) });
		return;
	}
	if (same(c, d)) {
		faces.push({ verts: [a, b, d], ...(pick ? { pick } : {}) });
		return;
	}
	faces.push(quad(a, b, c, d, pick));
}

export function emitMesh(
	roomId: string,
	wallsFaces: WallFaces[],
	_classify: (ref: WallMeshSectionRef) => WallMeshSurfaceKey,
	weldTolerance: number,
	attributionEnabled = false,
): IndexedWallMesh {
	const positions: number[] = [];
	const normals: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];
	const attributions: number[] = [];
	const exactAttributions: number[] = [];
	let activeDevelopment: WallFaces['development'] | undefined;
	const weld = new Map<string, number>();
	const materialGroups: IndexedWallMeshGroup[] = [];
	const sectionToRange: IndexedWallMesh['sectionToRange'] = [];
	const wallRanges: IndexedWallMesh['wallRanges'] = [];
	const pickRanges: Layout3dPickRange[] = [];
	let min: V3 = [Infinity, Infinity, Infinity];
	let max: V3 = [-Infinity, -Infinity, -Infinity];

	// contiguous runs of identical (kind, roomId, segmentId, openingId,
	// surface) across the whole emission order. Faces are emitted in index
	// order, so the accumulated runs are sorted, non-overlapping, and partition
	// the index buffer — every triangle gets exactly one pick owner.
	let pickRun: Layout3dTriangleRef | null = null;
	let pickRunStart = 0;

	function samePickRef(a: Layout3dTriangleRef, b: Layout3dTriangleRef): boolean {
		return (
			a.kind === b.kind &&
			a.roomId === b.roomId &&
			a.segmentId === b.segmentId &&
			a.surface === b.surface &&
			(a.kind !== 'opening' || b.kind !== 'opening' || a.openingId === b.openingId) &&
			a.paintSide === b.paintSide
		);
	}

	function notePick(ref: Layout3dTriangleRef, faceStart: number): void {
		if (pickRun && samePickRef(pickRun, ref)) return;
		if (pickRun) pickRanges.push(toPickRange(pickRun, pickRunStart, faceStart - pickRunStart));
		pickRun = ref;
		pickRunStart = faceStart;
	}

	function emitFaceWithPick(face: Face, roomId: string, segmentId: string): void {
		// fail closed on an untagged face instead of silently folding it
		// into the previous pick run (the partition guard cannot see a wrong
		// owner — only a missing one). Every emitted face today carries a pick;
		// this guard turns a future dropped tag into a loud build failure.
		if (!face.pick) {
			throw new Error(
				`wall mesh ${roomId}: emitted an untagged face (${face.verts.length} vertices) — every face must carry a pick tag`,
			);
		}
		const start = indices.length;
		notePick(
			face.pick.kind === 'wall'
				? {
						kind: 'wall',
						roomId,
						segmentId,
						surface: face.pick.surface,
						...(face.pick.paintSide === undefined ? {} : { paintSide: face.pick.paintSide }),
					}
				: {
						kind: 'opening',
						roomId,
						segmentId,
						openingId: face.pick.openingId,
						surface: face.pick.surface,
						...(face.pick.paintSide === undefined ? {} : { paintSide: face.pick.paintSide }),
					},
			start,
		);
		emitFace(face);
	}

	function vertexIndex(vertex: Vertex): number {
		const attribution =
			attributionEnabled && activeDevelopment
				? (vertex.a ?? attributeWallVertex(activeDevelopment, vertex.p))
				: null;
		const attributionKey = attribution
			? `|${Math.round(attribution[0] / 1e-6)},${Math.round(attribution[1] / 1e-6)},${Math.round(attribution[2] / 1e-6)}`
			: '';
		const key = `${Math.round(vertex.p[0] / weldTolerance)},${Math.round(vertex.p[1] / weldTolerance)},${Math.round(vertex.p[2] / weldTolerance)}|${Math.round(vertex.n[0] / NORMAL_GRID)},${Math.round(vertex.n[1] / NORMAL_GRID)},${Math.round(vertex.n[2] / NORMAL_GRID)}|${Math.round(vertex.u / UV_GRID)},${Math.round(vertex.v / UV_GRID)}${attributionKey}`;
		const existing = weld.get(key);
		if (existing !== undefined) return existing;
		const index = positions.length / 3;
		positions.push(vertex.p[0], vertex.p[1], vertex.p[2]);
		normals.push(vertex.n[0], vertex.n[1], vertex.n[2]);
		uvs.push(vertex.u, vertex.v);
		if (attribution) {
			attributions.push(attribution[0], attribution[1], attribution[2]);
			exactAttributions.push(attribution[0], attribution[1], attribution[2]);
		}
		min[0] = Math.min(min[0], vertex.p[0]);
		min[1] = Math.min(min[1], vertex.p[1]);
		min[2] = Math.min(min[2], vertex.p[2]);
		max[0] = Math.max(max[0], vertex.p[0]);
		max[1] = Math.max(max[1], vertex.p[1]);
		max[2] = Math.max(max[2], vertex.p[2]);
		weld.set(key, index);
		return index;
	}

	function emitFace(face: Face): void {
		if (face.verts.length === 3) {
			const [a, b, c] = face.verts;
			indices.push(vertexIndex(a), vertexIndex(b), vertexIndex(c));
			return;
		}
		const [a, b, c, d] = face.verts;
		const ia = vertexIndex(a);
		const ib = vertexIndex(b);
		const ic = vertexIndex(c);
		const id = vertexIndex(d);
		indices.push(ia, ib, ic, ia, ic, id);
	}

	// Deterministic surface order: 'side' first, then 'lintel', then any other keys alphabetically.
	const keyOrder = collectSurfaceKeys(wallsFaces);
	const paintSideOrder: readonly (LayoutWallSide | undefined)[] = [undefined, 'left', 'right'];
	// All wall range entries exist up front so a bridge emitted with one wall can
	// be referenced by BOTH adjacent walls' `wallRanges` (metadata-only).
	const wallRangeBySegment = new Map<string, IndexedWallMesh['wallRanges'][number]>();
	for (const wall of wallsFaces) {
		const entry = {
			segmentId: wall.segmentId,
			ranges: [] as Array<{ start: number; count: number }>,
		};
		wallRangeBySegment.set(wall.segmentId, entry);
		wallRanges.push(entry);
	}
	for (const surfaceKey of keyOrder) {
		for (const paintSide of paintSideOrder) {
			const groupStart = indices.length;
			for (const wall of wallsFaces) {
				activeDevelopment = wall.development;
				const wallRange = wallRangeBySegment.get(wall.segmentId)!;
				for (const section of wall.sections) {
					if (section.surfaceKey !== surfaceKey) continue;
					const matchingFaces = section.faces.filter((face) => face.pick?.paintSide === paintSide);
					if (matchingFaces.length === 0) continue;
					const start = indices.length;
					for (const face of matchingFaces) emitFaceWithPick(face, roomId, wall.segmentId);
					const count = indices.length - start;
					if (count > 0) {
						sectionToRange.push({
							...section.ref,
							surfaceKey,
							...(paintSide === undefined ? {} : { paintSide }),
							start,
							count,
						});
						wallRange.ranges.push({ start, count });
					}
				}
				for (const reveal of wall.reveals) {
					if (reveal.surfaceKey !== surfaceKey) continue;
					const matchingFaces = reveal.faces.filter((face) => face.pick?.paintSide === paintSide);
					if (matchingFaces.length === 0) continue;
					const start = indices.length;
					for (const face of matchingFaces) emitFaceWithPick(face, roomId, wall.segmentId);
					const count = indices.length - start;
					if (count > 0) wallRange.ranges.push({ start, count });
				}
				for (const bridge of wall.bridges) {
					if (bridge.surfaceKey !== surfaceKey) continue;
					const matchingFaces = bridge.faces.filter((face) => face.pick?.paintSide === paintSide);
					if (matchingFaces.length === 0) continue;
					const start = indices.length;
					for (const face of matchingFaces) emitFaceWithPick(face, roomId, wall.segmentId);
					const count = indices.length - start;
					if (count > 0) {
						wallRange.ranges.push({ start, count });
						wallRangeBySegment.get(bridge.neighborSegmentId)?.ranges.push({ start, count });
					}
				}
			}
			const groupCount = indices.length - groupStart;
			if (groupCount > 0)
				materialGroups.push({
					surfaceKey,
					...(paintSide === undefined ? {} : { paintSide }),
					start: groupStart,
					count: groupCount,
				});
		}
	}

	// Close the last pick run: from its start to the end of the index buffer.
	if (pickRun) pickRanges.push(toPickRange(pickRun, pickRunStart, indices.length - pickRunStart));

	return {
		roomId,
		positions: new Float32Array(positions),
		normals: new Float32Array(normals),
		uvs: new Float32Array(uvs),
		indices: new Uint32Array(indices),
		materialGroups,
		sectionToRange,
		wallRanges,
		pickRanges,
		...(attributionEnabled
			? {
					attribution: new Float32Array(attributions),
					attributionExact: new Float64Array(exactAttributions),
					attributionSourcePositions: new Float64Array(positions),
				}
			: {}),
		bounds: { min: [...min] as V3, max: [...max] as V3 },
	};
}

/**
 * Assert every emitted triangle's geometric normal (right-hand cross product
 * of its winding) agrees with its stored vertex normal. Zero-area triangles
 * are skipped (they carry no meaningful normal); the first mismatch throws.
 * Wired via `WallMeshOptions.assertWinding` as a development guard.
 */
export function assertWindingAgreesWithNormals(mesh: IndexedWallMesh): void {
	const { positions, normals, indices } = mesh;
	for (let t = 0; t < indices.length; t += 3) {
		const ia = indices[t]!;
		const ib = indices[t + 1]!;
		const ic = indices[t + 2]!;
		const ax = positions[ia * 3]!;
		const ay = positions[ia * 3 + 1]!;
		const az = positions[ia * 3 + 2]!;
		const bx = positions[ib * 3]!;
		const by = positions[ib * 3 + 1]!;
		const bz = positions[ib * 3 + 2]!;
		const cx = positions[ic * 3]!;
		const cy = positions[ic * 3 + 1]!;
		const cz = positions[ic * 3 + 2]!;
		const ux = bx - ax;
		const uy = by - ay;
		const uz = bz - az;
		const vx = cx - ax;
		const vy = cy - ay;
		const vz = cz - az;
		const gx = uy * vz - uz * vy;
		const gy = uz * vx - ux * vz;
		const gz = ux * vy - uy * vx;
		if (Math.hypot(gx, gy, gz) <= WINDING_DEGENERATE_AREA) continue;
		const nx = normals[ia * 3]!;
		const ny = normals[ia * 3 + 1]!;
		const nz = normals[ia * 3 + 2]!;
		const dot = gx * nx + gy * ny + gz * nz;
		if (dot <= 0) {
			throw new Error(
				`wall mesh ${mesh.roomId}: triangle ${t / 3} winds opposite its stored normal`,
			);
		}
	}
}

export function collectSurfaceKeys(wallsFaces: WallFaces[]): WallMeshSurfaceKey[] {
	const keys = new Set<WallMeshSurfaceKey>();
	for (const wall of wallsFaces) {
		for (const section of wall.sections) keys.add(section.surfaceKey);
		for (const reveal of wall.reveals) keys.add(reveal.surfaceKey);
		for (const bridge of wall.bridges) keys.add(bridge.surfaceKey);
	}
	return [...keys].sort((a, b) => {
		const rank = (key: string) => (key === 'side' ? 0 : key === 'lintel' ? 1 : 2);
		const ra = rank(a);
		const rb = rank(b);
		return ra === rb ? a.localeCompare(b) : ra - rb;
	});
}

/**
 * spread `Layout3dTriangleRef` into a pick range. Extracted because TS
 * rejects spreading a variable whose *declared* type includes `null` even when
 * the caller has narrowed it (TS2698); a non-nullable parameter sidesteps it.
 */
export function toPickRange(
	ref: Layout3dTriangleRef,
	start: number,
	count: number,
): Layout3dPickRange {
	return { ...ref, start, count };
}
