import type {
	CompiledRoom,
	CompiledWall,
} from '@portfolio/layout-core/geometry';
import { LAYOUT_GEOMETRY_EPSILON } from '@portfolio/layout-core/geometry';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import type {
	BridgeFaces,
	Corner,
	Face,
	FacePick,
	V3,
	Vertex,
	WallMeshSectionRef,
	WallMeshSurfaceKey
} from './wall-mesh-types';
import {
	backMiterApex,
	endpointProfileIntervals,
	profileCovers,
	wallOpensAtEnd,
	wallOpensAtStart
} from './wall-mesh-geometry';
import { quadNormal } from './wall-mesh-geometry';
import { vertex } from './wall-mesh-emit';

/**
 * Beveled-corner bridge at this wall's START (the joint with `prevWall`).
 * Pure-miter corners emit nothing (zero-width). The bridge is a loft between
 * the two endpoint cross-sections, driven by the band state table:
 *
 *   both solid    → side quads over the beveled wedge edges
 *   previous only → cap the previous wall's end at its own offset plane
 *   current only  → cap the current wall's end at its own offset plane
 *   both open     → nothing (the corner void is part of the opening)
 *
 * plus horizontal wedge faces where the both-solid volume begins (−Y) or ends
 * (+Y), closing lintel/sill transitions without blocking doorway voids.
 * Endpoint profiles are vertical interval sets derived from the sections that
 * touch each wall's endpoint distance (arch lintels evaluate to their spring
 * height at the corner).
 */
export function buildStartBridgeFaces(
	room: CompiledRoom,
	prevWall: CompiledWall,
	wall: CompiledWall,
	corner: Corner,
	wallHeight: number,
	roomBreakpoints: readonly number[],
	classify: (ref: WallMeshSectionRef) => WallMeshSurfaceKey
): BridgeFaces | null {
	const front = corner.front;
	const back = corner.back;
	if (front.kind === 'fold' || back.kind === 'fold') return null;
	const isBevel = front.kind === 'bevel' || back.kind === 'bevel';
	// A pure-miter corner needs a bridge only when BOTH walls open at the
	// joint: the two openings merge into one corner void, so both jambs are
	// suppressed (see buildRevealFaces) and any profile mismatch is closed by
	// the band caps below. A single-sided opening is already closed by its
	// reveal jamb, and a fully solid corner welds at the shared apex — neither
	// needs a bridge here.
	const bothOpen = wallOpensAtEnd(prevWall) && wallOpensAtStart(wall);
	if (!isBevel && !bothOpen) return null;

	const prevProfile = endpointProfileIntervals(prevWall, true);
	const curProfile = endpointProfileIntervals(wall, false);

	const edges = new Set<number>([0, wallHeight]);
	for (const [lo, hi] of [...prevProfile, ...curProfile]) {
		edges.add(lo);
		edges.add(hi);
	}
	for (const y of roomBreakpoints) edges.add(y);
	const sorted = [...edges].sort((a, b) => a - b);

	const bands: Array<{ lo: number; hi: number; solidA: boolean; solidB: boolean }> = [];
	for (let i = 1; i < sorted.length; i += 1) {
		const lo = sorted[i - 1]!;
		const hi = sorted[i]!;
		if (hi - lo <= LAYOUT_GEOMETRY_EPSILON) continue;
		bands.push({ lo, hi, solidA: profileCovers(prevProfile, lo, hi), solidB: profileCovers(curProfile, lo, hi) });
	}
	if (bands.length === 0) return null;

	// Plan points per side (beveled offset points, or the shared apex for a
	// miter side). A single-sided bevel (front bevel, back miter — the common
	// convex case) degenerates the back wedge to the shared apex; a back bevel
	// (reflex corners) additionally opens an exterior void closed by `outer`.
	const frontA = front.kind === 'bevel' ? front.a0 : front.apex;
	const frontB = front.kind === 'bevel' ? front.b0 : front.apex;
	const backB = back.kind === 'bevel' ? back.b0 : back.apex;
	const backA = back.kind === 'bevel' ? back.a0 : back.apex;
	const outer = back.kind === 'bevel' ? backMiterApex(prevWall, wall) : null;

	const nA = prevWall.samples.at(-1)!.normal;
	const nB = wall.samples[0]!.normal;
	const dirA = prevWall.samples.at(-1)!.tangent;
	const dirB = wall.samples[0]!.tangent;

	const faces: Face[] = [];
	for (const band of bands) {
		const yLo = room.floorElevation + band.lo;
		const yHi = room.floorElevation + band.hi;
		if (band.solidA && band.solidB) {
			// Both walls solid: the chamfer closes the front (interior) gap; on
			// the back, the exterior void's two exposed faces (the walls' back-face
			// continuations) meet at `outer`. Never a full-height quad here: that
			// would block an endpoint doorway.
			if (front.kind === 'bevel') pushBridgeSide(faces, frontA, frontB, yLo, yHi, band.lo, band.hi, nA, nB, 1);
			if (back.kind === 'bevel' && outer) {
				pushBridgeCap(faces, backA, outer, yLo, yHi, band.lo, band.hi, nA, -1);
				pushBridgeCap(faces, backB, outer, yLo, yHi, band.lo, band.hi, nB, -1);
			}
		} else if (band.solidA) {
			// Previous wall only: cap its end plane (normal along its tangent).
			pushBridgeCap(faces, frontA, backA, yLo, yHi, band.lo, band.hi, dirA, 1);
		} else if (band.solidB) {
			// Current wall only: cap its start plane (normal opposite its tangent).
			pushBridgeCap(faces, frontB, backB, yLo, yHi, band.lo, band.hi, dirB, -1);
		}
	}

	// Horizontal wedge caps where the both-solid volume begins (−Y) or ends
	// (+Y): tri1 closes the strip-end edges (and the front chamfer), tri2 and
	// the sliver close the back void. Miter sides degenerate to zero area and
	// are skipped, so single-sided bevels emit only the triangles they need.
	for (let i = 0; i < bands.length; i += 1) {
		const band = bands[i]!;
		const solid = band.solidA && band.solidB;
		const belowSolid = i > 0 ? bands[i - 1]!.solidA && bands[i - 1]!.solidB : false;
		const aboveSolid = i < bands.length - 1 ? bands[i + 1]!.solidA && bands[i + 1]!.solidB : false;
		if (solid && !belowSolid) pushWedgeCaps(faces, frontA, frontB, backA, backB, outer, room.floorElevation + band.lo, band.lo, [0, -1, 0]);
		if (solid && !aboveSolid) pushWedgeCaps(faces, frontA, frontB, backA, backB, outer, room.floorElevation + band.hi, band.hi, [0, 1, 0]);
	}

	if (faces.length === 0) return null;
	const surfaceKey = classify({
		roomId: room.roomId,
		segmentId: wall.segmentId, // owner = current/start wall (deterministic ref)
		sectionIndex: -1,
		kind: 'side'
	});
	return { neighborSegmentId: prevWall.segmentId, surfaceKey, faces };
}


/**
 * every corner-bridge face is pick-owned by the current/start wall
 * (the wall whose START the bridge closes), `surface: 'bridge'`. The owner
 * comes from the emitting wall context; the face only needs the surface.
 */
export const BRIDGE_PICK: FacePick = { kind: 'wall', surface: 'bridge' };
export const SIDE_PICK: FacePick = { kind: 'wall', surface: 'side' };

/** Vertical bridge quad between two plan points `p` (previous wall) and `q` (current wall). */
export function pushBridgeSide(
	faces: Face[],
	p: LayoutVec2,
	q: LayoutVec2,
	yLo: number,
	yHi: number,
	bandLo: number,
	bandHi: number,
	nA: LayoutVec2,
	nB: LayoutVec2,
	sign: 1 | -1,
	pick: FacePick = BRIDGE_PICK
): void {
	const bx = nA[0] + nB[0];
	const bz = nA[1] + nB[1];
	const magnitude = Math.hypot(bx, bz) || 1;
	const span = Math.hypot(q[0] - p[0], q[1] - p[1]);
	pushOrientedFace(
		faces,
		[
			vertex(p[0], yHi, p[1], 0, 0, 0, 0, bandHi),
			vertex(q[0], yHi, q[1], 0, 0, 0, span, bandHi),
			vertex(q[0], yLo, q[1], 0, 0, 0, span, bandLo),
			vertex(p[0], yLo, p[1], 0, 0, 0, 0, bandLo)
		],
		[sign * (bx / magnitude), 0, sign * (bz / magnitude)],
		pick.paintSide === undefined
			? { ...pick, paintSide: sign > 0 ? 'left' : 'right' }
			: pick
	);
}

/** Cap face closing a wall's end at the corner plane (front point `p` → back point `q`). */
export function pushBridgeCap(
	faces: Face[],
	p: LayoutVec2,
	q: LayoutVec2,
	yLo: number,
	yHi: number,
	bandLo: number,
	bandHi: number,
	dir: LayoutVec2,
	sign: 1 | -1,
	pick: FacePick = BRIDGE_PICK
): void {
	const span = Math.hypot(q[0] - p[0], q[1] - p[1]);
	pushOrientedFace(
		faces,
		[
			vertex(p[0], yHi, p[1], 0, 0, 0, 0, bandHi),
			vertex(p[0], yLo, p[1], 0, 0, 0, 0, bandLo),
			vertex(q[0], yLo, q[1], 0, 0, 0, span, bandLo),
			vertex(q[0], yHi, q[1], 0, 0, 0, span, bandHi)
		],
		[sign * dir[0], 0, sign * dir[1]],
		pick
	);
}

/**
 * Horizontal wedge caps at height `y` (±Y normal) closing the both-solid
 * volume. Tri1 = (frontA, frontB, backA) welds the front chamfer to both
 * walls' strip-end edges; when the back is beveled, tri2 = (frontB, backB,
 * backA) closes the void's inner side and the sliver (backA, backB, outer)
 * closes its outer corner. Triangles with coincident vertices (miter side) are
 * skipped, so single-sided bevels emit only what is non-degenerate.
 */
export function pushWedgeCaps(faces: Face[], frontA: LayoutVec2, frontB: LayoutVec2, backA: LayoutVec2, backB: LayoutVec2, outer: LayoutVec2 | null, y: number, bandY: number, normalY: V3, pick: FacePick = BRIDGE_PICK): void {
	const v = (p: LayoutVec2) => vertex(p[0], y, p[1], 0, 0, 0, 0, bandY);
	const distinct = (a: LayoutVec2, b: LayoutVec2) => Math.hypot(a[0] - b[0], a[1] - b[1]) > LAYOUT_GEOMETRY_EPSILON;
	if (distinct(frontA, frontB) && distinct(frontA, backA) && distinct(frontB, backA)) {
		pushOrientedFace(faces, [v(frontA), v(frontB), v(backA)], normalY, pick);
	}
	if (outer && distinct(frontB, backB) && distinct(frontB, backA) && distinct(backB, backA)) {
		pushOrientedFace(faces, [v(frontB), v(backB), v(backA)], normalY, pick);
	}
	if (outer && distinct(backA, backB) && distinct(backA, outer) && distinct(backB, outer)) {
		pushOrientedFace(faces, [v(backA), v(backB), v(outer)], normalY, pick);
	}
}

/**
 * Emit a 3- or 4-vertex face whose geometric normal points along
 * `desiredNormal` (winding flipped if needed); the stored vertex normal is the
 * oriented geometric normal so the winding guard always agrees.
 */
export function pushOrientedFace(faces: Face[], verts: Vertex[], desiredNormal: V3, pick?: FacePick): void {
	const first = verts[0]!;
	const second = verts[1]!;
	const third = verts[2]!;
	const g = quadNormal(first.p, second.p, third.p);
	const dot = g[0] * desiredNormal[0] + g[1] * desiredNormal[1] + g[2] * desiredNormal[2];
	const oriented = dot >= 0 ? verts : flipWinding(verts);
	const n = quadNormal(oriented[0]!.p, oriented[1]!.p, oriented[2]!.p);
	faces.push({ verts: oriented.map((v) => ({ ...v, n })), ...(pick ? { pick } : {}) });
}

export function flipWinding(verts: Vertex[]): Vertex[] {
	if (verts.length === 3) return [verts[0]!, verts[2]!, verts[1]!];
	return [verts[0]!, verts[3]!, verts[2]!, verts[1]!];
}

