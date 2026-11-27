import type {
	CompiledEndpointBand,
	CompiledLegJoin,
	CompiledPhysicalWall,
	CompiledRoom,
	CompiledWall,
	LayoutGeometryIssue,
} from '@portfolio/layout-core/geometry';
import { LAYOUT_GEOMETRY_EPSILON } from '@portfolio/layout-core/geometry';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import { p2311Measure } from '@portfolio/layout-core/kernel';
import {
	WALL_OFFSET_FOLD_CODE,
	WALL_OFFSET_FOLD_MESSAGE,
	WALL_OFFSET_OVERLAP_CODE,
	WALL_OFFSET_OVERLAP_MESSAGE,
	wallEndsSeamFailure,
	wallOffsetClearanceFailure,
} from '@portfolio/layout-core/wall';
import type {
	BridgeFaces,
	Corner,
	CornerSide,
	Face,
	ResolvedEndClip,
	ResolvedFaceSuppression,
	ResolvedWallEnds,
	V3,
	WallMeshBuildResult,
	WallMeshOptions,
	WallMeshSectionRef,
	WallMeshSurfaceKey,
} from './wall-mesh-types';
import { DEFAULT_WELD_TOLERANCE } from './wall-mesh-types';
import {
	endpointProfileIntervals,
	profileCovers,
	segmentBands,
	wallEndTopAt,
	wallOpensAtEnd,
	wallOpensAtStart,
} from './wall-mesh-geometry';
import { assertWindingAgreesWithNormals, emitMesh, vertex } from './wall-mesh-emit';
import { pushOrientedFace } from './wall-mesh-corners';
import {
	BRIDGE_PICK,
	pushBridgeCap,
	pushBridgeSide,
	pushWedgeCaps,
	SIDE_PICK,
} from './wall-mesh-corners';
import { buildWallFaces, withSuppressionBreakpoints } from './wall-mesh-room';

/**
 * Build one standalone box mesh for a canonical physical Wall, with
 * correct Junction ends.
 *
 * **The builder consumes already-resolved endpoint geometry.** Per-Wall
 * ownership/output remains the unit; per-Wall geometry *solving* does not. The
 * Junction solve lives in `layout-core` (`resolveJunctionGeometry`), which
 * inspects every incident leg together and publishes `CompiledLegJoin`s. This
 * function never decides whether a Junction is a miter, T, X, tangent
 * continuation or terminal — it triangulates the resolved footprint plus
 * vertical bands plus Wall-hosted Opening cuts.
 *
 * End geometry resolves in three explicit branches, with no silent fallback:
 *
 * ```text
 * degree 1 / free end → square corners, closed by the resolved `terminal-cap` surface
 * connected + resolution → consume the resolved corner + seam + bands
 * connected, no resolution → blocking issue, no mesh (fail closed)
 * ```
 *
 * Sections (side/lintel), opening reveals, band splits and winding guards reuse
 * the room path verbatim by passing the Wall as its own neighbor with trivial
 * corners; Junction wedges/beams are emitted as the existing `'bridge'` surface
 * class so material grouping and the pick partition are unchanged.
 *
 * Render-only for interaction: canonical wall-first 3D picking/highlighting is
 * not provided here. Callers must NOT enter the result into
 * room-keyed pick-index maps (its refs namespace to the Wall ID, and there is
 * no Room ownership to claim).
 *
 * Vertical extent comes from `wall.height`: `floorElevation` …
 * `floorElevation + wall.height`, so a partial-height Wall ends at its authored
 * top with no fake ceiling extension.
 */
export function buildStandaloneWallMesh(
	wall: CompiledPhysicalWall,
	floorElevation: number,
	ends: ResolvedWallEnds | null = null,
	options: WallMeshOptions = {},
): WallMeshBuildResult {
	const issues: LayoutGeometryIssue[] = [];
	if (wall.samples.length < 2) {
		issues.push({
			path: `walls.${wall.wallId}`,
			code: 'wall_degenerate',
			message: 'Wall has too few samples to build a mesh.',
			targetId: wall.wallId,
		});
	}
	if (!Number.isFinite(wall.thickness) || wall.thickness <= 0) {
		issues.push({
			path: `walls.${wall.wallId}`,
			code: 'wall_thickness_invalid',
			message: 'Wall thickness must be finite and greater than zero.',
			targetId: wall.wallId,
		});
	}
	if (issues.length > 0) return { mesh: undefined, issues };

	// Fail closed, unconditionally. An end bound to a canonical
	// Junction needs its compiled resolution: degree 1 arrives as
	// `kind: 'terminal'` (the square cap), degree >= 2 as miter/bevel/trim/
	// suppressed. A missing resolution is an invariant failure, never a square
	// cap — a silent fallback would recreate the pre- geometry and make
	// the renderer an authority the compiler is not.
	for (const [end, join] of [['start', ends?.start] as const, ['end', ends?.end] as const]) {
		const junctionId = end === 'start' ? wall.startJunctionId : wall.endJunctionId;
		if (junctionId && !join)
			return { mesh: undefined, issues: [missingResolutionIssue(wall, end)] };
	}

	// Decision 15 — defense-in-depth, the same pure predicate the
	// canonical compile gate runs. The compile path is authoritative, so this
	// normally never fires; it exists so the renderer is never the first place a
	// seam failure becomes visible. Same predicate, same codes, no second rule.
	const seam = wallEndsSeamFailure(ends);
	if (seam) {
		return {
			mesh: undefined,
			issues: [
				{
					path: `walls.${wall.wallId}`,
					code: seam.code,
					message: seam.message,
					targetId: wall.wallId,
				},
			],
		};
	}

	// Issue #6 — defense-in-depth. The canonical acceptance path
	// already refuses a Wall that cannot render at its own thickness, so this
	// normally never fires; it exists so the renderer is never the first place
	// a folded solid becomes visible. Same predicate, same codes, no second rule.
	const clearance = wallOffsetClearanceFailure(wall.samples, wall.thickness);
	if (clearance) {
		return {
			mesh: undefined,
			issues: [
				{
					path: `walls.${wall.wallId}`,
					code: clearance === 'fold' ? WALL_OFFSET_FOLD_CODE : WALL_OFFSET_OVERLAP_CODE,
					message: clearance === 'fold' ? WALL_OFFSET_FOLD_MESSAGE : WALL_OFFSET_OVERLAP_MESSAGE,
					targetId: wall.wallId,
				},
			],
		};
	}

	const classify = options.classifySurface ?? ((ref: WallMeshSectionRef) => ref.kind);
	const weldTolerance = options.weldTolerance ?? DEFAULT_WELD_TOLERANCE;
	// The Wall's own authoritative height decides the mesh extent.
	// Dropping the `ceilingElevation` parameter makes a Floor-derived vertical
	// extent impossible to pass in by accident: every surface that renders
	// wall-first architecture shares this one compiled contract.
	const wallHeight = wall.height;
	const ceilingElevation = floorElevation + wallHeight;
	const half = wall.thickness / 2;
	const wallAsCompiled: CompiledWall = { ...wall, segmentId: wall.wallId };
	const roomView = {
		roomId: wall.wallId,
		floorElevation,
		ceilingElevation,
	} as CompiledRoom;
	const first = wall.samples[0]!;
	const last = wall.samples.at(-1)!;
	const length = last.distance ?? 0;
	// The resolved end clip and interfaces, straight from the compiled
	// Junction resolution. The builder does not derive either: it only clips the
	// Wall's own sections/reveals to the resolved span and omits the faces the
	// resolution reports as interior.
	const clip: ResolvedEndClip = {
		start: ends?.start?.clipDistance ?? 0,
		end: length - (ends?.end?.clipDistance ?? 0),
		freeStart: !ends?.start || ends.start.kind === 'terminal',
		freeEnd: !ends?.end || ends.end.kind === 'terminal',
	};
	const suppressions: ResolvedFaceSuppression[] = [];
	for (const [join, atEnd] of [
		[ends?.start ?? null, false] as const,
		[ends?.end ?? null, true] as const,
	]) {
		for (const entry of join?.interfaces ?? []) {
			const a = atEnd ? length - entry.toDistance : entry.fromDistance;
			const b = atEnd ? length - entry.fromDistance : entry.toDistance;
			suppressions.push({
				normal: entry.normal,
				fromDistance: Math.max(0, Math.min(a, b)),
				toDistance: Math.min(length, Math.max(a, b)),
				bands: entry.bands,
			});
		}
	}
	// Three explicit branches — terminal square corners, resolved corner, or fail
	// closed above. No silent no-resolution fallback survives.
	const cornerStart = cornerFromJoin(ends?.start, squareEndCorner(first.point, first.normal, half));
	const cornerEnd = cornerFromJoin(ends?.end, squareEndCorner(last.point, last.normal, half));
	const breakpoints = withSuppressionBreakpoints(
		standaloneHeightBreakpoints(wall, wallHeight),
		suppressions,
	);
	//  Task 7 — a measure point for the per-Wall Junction-aware build, beside
	// the compile's `junction-resolution` mark, so the perf lane can attribute the
	// cost of resolving ends to the compile and the cost of consuming them here.
	const faces = p2311Measure('standalone-wall-build', () =>
		buildWallFaces(
			roomView,
			wallAsCompiled,
			wallAsCompiled,
			wallAsCompiled,
			cornerStart,
			cornerEnd,
			wallHeight,
			breakpoints,
			classify,
			false,
			clip,
			suppressions,
			options.attribution === true,
		),
	);
	const bridges: BridgeFaces[] = [];
	for (const [join, atEnd] of [
		[ends?.start ?? null, false] as const,
		[ends?.end ?? null, true] as const,
	]) {
		if (!join) continue;
		const bridge = buildStandaloneEndBridge(
			roomView,
			wallAsCompiled,
			join,
			atEnd,
			wallHeight,
			breakpoints,
			classify,
		);
		if (bridge) bridges.push(bridge);
	}
	faces.bridges = bridges;
	// The resolved difference/trim surfaces are **compiled facts**. This
	// path only triangulates them; it never compares thicknesses, never inspects
	// a neighbour's bands and never decides whether a step exists.
	const surfaceFaces = buildStandaloneResolvedSurfaces(roomView, ends, breakpoints);
	if (surfaceFaces.length > 0) {
		const ref: WallMeshSectionRef = {
			roomId: wall.wallId,
			segmentId: wall.wallId,
			sectionIndex: -1,
			kind: 'side',
		};
		faces.sections.push({ ref, surfaceKey: classify(ref), faces: surfaceFaces });
	}
	// A resolved sector keel is *solid* resolved material (the Y / star
	// partition), so it contributes horizontal faces here; its vertical sides are
	// the resolved `junction-keel` surfaces above. Both are compiled facts: this
	// path never decides where a keel is or who owns it.
	const keelFaces = buildStandaloneKeel(roomView, ends);
	if (keelFaces.length > 0) {
		const ref: WallMeshSectionRef = {
			roomId: wall.wallId,
			segmentId: wall.wallId,
			sectionIndex: -1,
			kind: 'side',
		};
		faces.sections.push({ ref, surfaceKey: classify(ref), faces: keelFaces });
	}
	const wallsFaces = [faces];
	const mesh = emitMesh(
		wall.wallId,
		wallsFaces,
		classify,
		weldTolerance,
		options.attribution === true,
	);
	if (options.assertWinding) assertWindingAgreesWithNormals(mesh);
	return { mesh, issues: [] };
}

/** Exact square end corners for a straight canonical Wall (no neighbor corner). */
export function squareEndCorner(point: LayoutVec2, normal: LayoutVec2, half: number): Corner {
	const apex = (sign: number): LayoutVec2 => [
		point[0] + sign * half * normal[0],
		point[1] + sign * half * normal[1],
	];
	return { front: { kind: 'miter', apex: apex(1) }, back: { kind: 'miter', apex: apex(-1) } };
}

/** Vertical band breakpoints (sill/spring heights) for one canonical Wall. */
export function standaloneHeightBreakpoints(
	wall: CompiledPhysicalWall,
	wallHeight: number,
): number[] {
	const breakpoints = new Set<number>();
	for (const opening of wall.openings) {
		const springHeight = opening.profileShape
			? opening.profileShape.height - opening.profileShape.rise
			: opening.height;
		if (opening.sillHeight > LAYOUT_GEOMETRY_EPSILON) breakpoints.add(opening.sillHeight);
		const spring = opening.sillHeight + springHeight;
		if (spring > LAYOUT_GEOMETRY_EPSILON && spring < wallHeight - LAYOUT_GEOMETRY_EPSILON)
			breakpoints.add(spring);
	}
	return [...breakpoints].sort((a, b) => a - b);
}

/** A connected end with no resolved geometry fails closed. */
export function missingResolutionIssue(
	wall: CompiledPhysicalWall,
	end: 'start' | 'end',
): LayoutGeometryIssue {
	return {
		path: `walls.${wall.wallId}`,
		code: 'junction_resolution_missing',
		message: `Wall ${end} is connected to a Junction but no resolved endpoint geometry was supplied.`,
		targetId: wall.wallId,
	};
}

/** Use the resolved corner when present; otherwise the degree-1 square cap. */
export function cornerFromJoin(join: CompiledLegJoin | null | undefined, fallback: Corner): Corner {
	if (!join || !join.corner) return fallback;
	return { front: join.corner.front as CornerSide, back: join.corner.back as CornerSide };
}

/** The Wall's outward frame at one end (from the Junction into the Wall). */
export function ownOutwardFrame(
	wall: CompiledWall,
	atEnd: boolean,
): { tangent: LayoutVec2; normal: LayoutVec2 } {
	const sample = atEnd ? wall.samples.at(-1)! : wall.samples[0]!;
	const sign = atEnd ? -1 : 1;
	return {
		tangent: [sign * sample.tangent[0], sign * sample.tangent[1]],
		normal: [sign * sample.normal[0], sign * sample.normal[1]],
	};
}

export function intervalsFromBands(
	bands: readonly CompiledEndpointBand[],
): Array<[number, number]> {
	return bands
		.filter((band) => band.solid)
		.map((band) => [band.bottomY, band.topY] as [number, number]);
}

/** Unconstrained back-side miter apex from leg facts (no neighbour CompiledWall needed). */
export function legOuterApex(
	junction: LayoutVec2,
	prevTangent: LayoutVec2,
	prevNormal: LayoutVec2,
	prevHalf: number,
	curTangent: LayoutVec2,
	curNormal: LayoutVec2,
	curHalf: number,
): LayoutVec2 {
	const a0: LayoutVec2 = [
		junction[0] - prevHalf * prevNormal[0],
		junction[1] - prevHalf * prevNormal[1],
	];
	const b0: LayoutVec2 = [
		junction[0] - curHalf * curNormal[0],
		junction[1] - curHalf * curNormal[1],
	];
	const dirA: LayoutVec2 = [-prevTangent[0], -prevTangent[1]];
	const dirB = curTangent;
	const det = dirA[0] * dirB[1] - dirA[1] * dirB[0];
	if (Math.abs(det) < 1e-9) return a0;
	const dx = b0[0] - a0[0];
	const dy = b0[1] - a0[1];
	const u = (dx * dirB[1] - dy * dirB[0]) / det;
	return [a0[0] + u * dirA[0], a0[1] + u * dirA[1]];
}

/**
 * Close a resolved Junction end. Mirrors the room path's start bridge
 * but reads both legs' resolved facts (corner + endpoint profiles), so the
 * standalone Wall never needs its neighbour's mesh. Emitted only by the leg
 * that owns the seam (`ownedSeam`); pure miter corners with no endpoint void
 * need nothing because the shared apex already welds the top/front/back faces.
 */
export function buildStandaloneEndBridge(
	room: CompiledRoom,
	wall: CompiledWall,
	join: CompiledLegJoin,
	atEnd: boolean,
	wallHeight: number,
	roomBreakpoints: readonly number[],
	classify: (ref: WallMeshSectionRef) => WallMeshSurfaceKey,
): BridgeFaces | null {
	const neighbor = join.neighbor;
	const canonical = join.canonicalCorner;
	const role = join.canonicalRole;
	if (!neighbor || !canonical || !role || !join.ownedSeam) return null;
	const corner = { front: canonical.front as CornerSide, back: canonical.back as CornerSide };
	const front = corner.front;
	const back = corner.back;
	if (front.kind === 'fold' || back.kind === 'fold') return null;
	const isBevel = front.kind === 'bevel' || back.kind === 'bevel';
	const own = ownOutwardFrame(wall, atEnd);
	const ownOpens = atEnd ? wallOpensAtEnd(wall) : wallOpensAtStart(wall);
	const prevIsOwn = role === 'prev';
	const prevTangent = prevIsOwn ? own.tangent : neighbor.tangentOut;
	const prevNormal = prevIsOwn ? own.normal : neighbor.normalOut;
	const prevHalf = prevIsOwn ? wall.thickness / 2 : neighbor.halfThickness;
	const curTangent = prevIsOwn ? neighbor.tangentOut : own.tangent;
	const curNormal = prevIsOwn ? neighbor.normalOut : own.normal;
	const curHalf = prevIsOwn ? neighbor.halfThickness : wall.thickness / 2;
	const prevOpen = prevIsOwn ? ownOpens : neighbor.endpointOpen;
	const curOpen = prevIsOwn ? neighbor.endpointOpen : ownOpens;
	const bothOpen = prevOpen && curOpen;
	if (!isBevel && !bothOpen) return null;

	const junction = atEnd ? wall.samples.at(-1)!.point : wall.samples[0]!.point;
	const ownProfile = endpointProfileIntervals(wall, atEnd);
	const neighborProfile = intervalsFromBands(neighbor.endpointSolidBands);
	const prevProfile = prevIsOwn ? ownProfile : neighborProfile;
	const curProfile = prevIsOwn ? neighborProfile : ownProfile;
	const neighborTop = neighbor.endpointSolidBands.at(-1)?.topY ?? wallHeight;
	const top = Math.max(wallEndTopAt(wall, wallHeight, atEnd), neighborTop);

	const edges = new Set<number>([0, top]);
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
		bands.push({
			lo,
			hi,
			solidA: profileCovers(prevProfile, lo, hi),
			solidB: profileCovers(curProfile, lo, hi),
		});
	}
	if (bands.length === 0) return null;

	const frontA = front.kind === 'bevel' ? front.a0 : front.apex;
	const frontB = front.kind === 'bevel' ? front.b0 : front.apex;
	const backB = back.kind === 'bevel' ? back.b0 : back.apex;
	const backA = back.kind === 'bevel' ? back.a0 : back.apex;
	const outer =
		back.kind === 'bevel'
			? legOuterApex(junction, prevTangent, prevNormal, prevHalf, curTangent, curNormal, curHalf)
			: null;
	const nA: LayoutVec2 = [-prevNormal[0], -prevNormal[1]];
	const nB: LayoutVec2 = curNormal;
	const dirA: LayoutVec2 = [-prevTangent[0], -prevTangent[1]];
	const dirB: LayoutVec2 = curTangent;
	// The canonical corner's front/back belongs to `(prev, cur)`, while Finish
	// identity belongs to the emitted Wall's authored start→end orientation.
	// Match layout-core's cornerForEnd mapping before assigning either face.
	const frontPaintSide = (role === 'prev') === atEnd ? 'left' : 'right';
	const backPaintSide = frontPaintSide === 'left' ? 'right' : 'left';

	const faces: Face[] = [];
	for (const band of bands) {
		const yLo = room.floorElevation + band.lo;
		const yHi = room.floorElevation + band.hi;
		if (band.solidA && band.solidB) {
			if (front.kind === 'bevel')
				pushBridgeSide(faces, frontA, frontB, yLo, yHi, band.lo, band.hi, nA, nB, 1, {
					...BRIDGE_PICK,
					paintSide: frontPaintSide,
				});
			if (back.kind === 'bevel' && outer) {
				pushBridgeCap(faces, backA, outer, yLo, yHi, band.lo, band.hi, nA, -1, {
					...BRIDGE_PICK,
					paintSide: backPaintSide,
				});
				pushBridgeCap(faces, backB, outer, yLo, yHi, band.lo, band.hi, nB, -1, {
					...BRIDGE_PICK,
					paintSide: backPaintSide,
				});
			}
		} else if (band.solidA) {
			pushBridgeCap(faces, frontA, backA, yLo, yHi, band.lo, band.hi, dirA, 1);
		} else if (band.solidB) {
			pushBridgeCap(faces, frontB, backB, yLo, yHi, band.lo, band.hi, dirB, -1);
		}
	}
	for (let i = 0; i < bands.length; i += 1) {
		const band = bands[i]!;
		const solid = band.solidA && band.solidB;
		const belowSolid = i > 0 ? bands[i - 1]!.solidA && bands[i - 1]!.solidB : false;
		const aboveSolid = i < bands.length - 1 ? bands[i + 1]!.solidA && bands[i + 1]!.solidB : false;
		if (solid && !belowSolid)
			pushWedgeCaps(
				faces,
				frontA,
				frontB,
				backA,
				backB,
				outer,
				room.floorElevation + band.lo,
				band.lo,
				[0, -1, 0],
			);
		if (solid && !aboveSolid)
			pushWedgeCaps(
				faces,
				frontA,
				frontB,
				backA,
				backB,
				outer,
				room.floorElevation + band.hi,
				band.hi,
				[0, 1, 0],
			);
	}
	if (faces.length === 0) return null;
	const surfaceKey = classify({
		roomId: room.roomId,
		segmentId: wall.segmentId,
		sectionIndex: -1,
		kind: 'side',
	});
	return { neighborSegmentId: neighbor.wallId, surfaceKey, faces };
}

/**
 * Triangulate the **resolved** Junction surfaces this Wall owns.
 *
 * `layout-core` decides what physical surface exists, in which vertical bands,
 * and which Wall owns it (`CompiledJunctionSurface`). This function only turns
 * each resolved surface into vertical quads — it never compares thicknesses,
 * never inspects a neighbour's bands, never decides exposure or ownership and
 * never invents a step. A surface's `normal` is authoritative for winding.
 */
export function buildStandaloneResolvedSurfaces(
	room: CompiledRoom,
	ends: ResolvedWallEnds | null,
	breakpoints: readonly number[],
): Face[] {
	const faces: Face[] = [];
	for (const join of [ends?.start ?? null, ends?.end ?? null]) {
		for (const surface of join?.surfaces ?? []) {
			const spanX = surface.to[0] - surface.from[0];
			const spanZ = surface.to[1] - surface.from[1];
			const span = Math.hypot(spanX, spanZ);
			if (span <= LAYOUT_GEOMETRY_EPSILON) continue;
			const faceNormal: V3 = [surface.normal[0], 0, surface.normal[1]];
			for (const band of surface.bands) {
				// A free end's cap shares its vertical edges with the side faces, which
				// split at every band breakpoint, so it splits there too and welds.
				const heights =
					surface.kind === 'terminal-cap'
						? segmentBands(band.bottomY, band.bottomY, band.topY, breakpoints)
						: [band.bottomY, band.topY];
				for (let index = 1; index < heights.length; index += 1) {
					const bandLo = heights[index - 1]!;
					const bandHi = heights[index]!;
					const yLo = room.floorElevation + bandLo;
					const yHi = room.floorElevation + bandHi;
					if (yHi - yLo <= LAYOUT_GEOMETRY_EPSILON) continue;
					pushOrientedFace(
						faces,
						[
							vertex(surface.from[0], yHi, surface.from[1], 0, 0, 0, 0, bandHi),
							vertex(surface.to[0], yHi, surface.to[1], 0, 0, 0, span, bandHi),
							vertex(surface.to[0], yLo, surface.to[1], 0, 0, 0, span, bandLo),
							vertex(surface.from[0], yLo, surface.from[1], 0, 0, 0, 0, bandLo),
						],
						faceNormal,
						surface.kind === 'terminal-cap' ? SIDE_PICK : BRIDGE_PICK,
					);
				}
			}
		}
	}
	return faces;
}

/**
 * Extrude the **resolved** sector keels this Wall owns.
 *
 * A keel is the Junction-local plan region a degree >= 3 sector partition
 * attributes to this Wall beyond its own cap line: the piece a swept Wall strip
 * cannot express (a strip cannot narrow toward the Junction). Its polygon, its
 * vertical bands and its ownership are all compiled facts; this function only
 * fans each band into top and bottom faces, and leaves the vertical sides to the
 * resolved `junction-keel` surfaces — so a side another Wall's material abuts
 * stays interior by decision of `layout-core`, never by a builder's guess.
 */
export function buildStandaloneKeel(room: CompiledRoom, ends: ResolvedWallEnds | null): Face[] {
	const faces: Face[] = [];
	for (const join of [ends?.start ?? null, ends?.end ?? null]) {
		const keel = join?.keel;
		if (!keel) continue;
		for (const band of keel.bands) {
			const yLo = room.floorElevation + band.bottomY;
			const yHi = room.floorElevation + band.topY;
			if (yHi - yLo <= LAYOUT_GEOMETRY_EPSILON) continue;
			for (const region of keel.regions) {
				if (region.length < 3) continue;
				for (let index = 1; index + 1 < region.length; index += 1) {
					const a = region[0]!;
					const b = region[index]!;
					const c = region[index + 1]!;
					const area2 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
					if (Math.abs(area2) <= LAYOUT_GEOMETRY_EPSILON) continue;
					const span = Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]);
					pushOrientedFace(
						faces,
						[
							vertex(a[0], yHi, a[1], 0, 1, 0, 0, band.topY),
							vertex(b[0], yHi, b[1], 0, 1, 0, span / 2, band.topY),
							vertex(c[0], yHi, c[1], 0, 1, 0, span, band.topY),
						],
						[0, 1, 0],
						BRIDGE_PICK,
					);
					pushOrientedFace(
						faces,
						[
							vertex(a[0], yLo, a[1], 0, -1, 0, 0, band.bottomY),
							vertex(b[0], yLo, b[1], 0, -1, 0, span / 2, band.bottomY),
							vertex(c[0], yLo, c[1], 0, -1, 0, span, band.bottomY),
						],
						[0, -1, 0],
						BRIDGE_PICK,
					);
				}
			}
		}
	}
	return faces;
}

/** Merge the interface band edges into the Wall's height breakpoints. */
