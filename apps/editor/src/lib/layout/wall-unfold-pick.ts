/**
 * C3 checkpoint 5 — inverse picking on the developed sheet.
 *
 * The display strip is built once from checkpoint 4's development mesh. Every
 * vertex already carries its canonical `(station, lateral, height)`, so a
 * pointer ray interpolates those three values barycentrically across the hit
 * triangle: the map is piecewise affine, unique wherever the sheet does not
 * overlap, and matches the canonical piecewise-linear stations exactly at
 * `u = 0` and `u = 1`. No second Wall model and no screen-space 5 cm scan.
 *
 * Picking returns a canonical station, span/knot attribution, the Wall face and
 * (when the point lies in an Opening band) that Opening's identity. The result
 * is the input the existing canonical planners take; unfolding adds no writer.
 */
import {
	buildDevelopedWallMesh,
	createWallDevelopmentBuffers,
	developmentInversePoint,
	developmentOpeningFragments,
	developmentOpeningIdentity,
	evaluateWallDevelopment,
	developmentPointAtStationFromBuffers,
	isWallDevelopmentRefusal,
	prepareWallDevelopment,
	type CompiledPhysicalWall,
	type LayoutVec2,
	type WallDevelopment,
	type WallDevelopmentBuffers,
	type WallDevelopmentMesh,
	type WallDevelopmentMeshHole,
	type WallDevelopmentOpeningBand,
	type WallDevelopmentSourceSpan
} from '@portfolio/layout-core';

import { prepareWallUnfoldDevelopment, type WallUnfoldState } from './wall-unfold';

export type WallUnfoldRay = {
	readonly origin: readonly [number, number, number];
	readonly direction: readonly [number, number, number];
};

/** One developed strip in world space, with its canonical attribution intact. */
export type WallUnfoldDisplay = {
	readonly wallId: string;
	readonly u: number;
	readonly floorY: number;
	readonly height: number;
	readonly development: WallDevelopment;
	readonly buffers: WallDevelopmentBuffers;
	readonly mesh: WallDevelopmentMesh;
	readonly spans: readonly WallDevelopmentSourceSpan[];
	readonly positions: Float32Array;
	readonly normals: Float32Array;
	readonly openingBands: readonly WallDevelopmentOpeningBand[];
	readonly openingHoles: readonly WallDevelopmentMeshHole[];
};

export type WallUnfoldPick = {
	/** Canonical station, modulo L for a closed Wall. */
	readonly station: number;
	readonly lateral: number;
	/** Height above the floor, in metres. */
	readonly height: number;
	readonly face: 'left' | 'right' | 'top' | 'bottom';
	readonly spanIndex: number;
	readonly startKnotId: string;
	readonly endKnotId: string;
	/** The Opening under the pick, or `null` for solid Wall. */
	readonly openingId: string | null;
	readonly distanceMeters: number;
};

/**
 * Build the developed strip for one scrub state. Built once per entry, cut
 * change or accepted edit; scrubbing only re-evaluates the shared buffers (the
 * caller maps vertices from this display without rebuilding the mesh).
 */
export function buildWallUnfoldDisplay(
	wall: CompiledPhysicalWall,
	state: WallUnfoldState,
	options: { readonly floorY?: number; readonly spans?: readonly WallDevelopmentSourceSpan[] } = {}
): WallUnfoldDisplay | null {
	const prepared = prepareWallUnfoldDevelopment(state, wall);
	if (isWallDevelopmentRefusal(prepared)) return null;
	const development = prepared;
	const buffers = createWallDevelopmentBuffers(development);
	evaluateWallDevelopment(development, state.u, buffers);
	const spans = options.spans ?? [];
	const openingBands: WallDevelopmentOpeningBand[] = wall.openings.map((opening) => ({
		openingId: opening.openingId,
		stationStart: opening.offset,
		stationEnd: opening.offset + opening.width,
		sillHeight: opening.sillHeight,
		headHeight: opening.sillHeight + opening.height,
		kind: opening.kind
	}));
	const openingHoles: WallDevelopmentMeshHole[] = openingBands.flatMap((band) => {
		const developmentOpening = developmentOpeningFragments(
			development,
			{ openingId: band.openingId, offset: band.stationStart, width: band.stationEnd - band.stationStart },
			spans
		);
		return developmentOpening.fragments.map((fragment) => ({
			openingId: band.openingId,
			sheetStart: fragment.sheetStart,
			sheetEnd: fragment.sheetEnd,
			sillHeight: band.sillHeight,
			headHeight: band.headHeight
		}));
	});
	const mesh = buildDevelopedWallMesh(development, {
		thickness: wall.thickness,
		height: wall.height,
		spans,
		openings: openingHoles
	});
	const floorY = options.floorY ?? 0;
	const positions = new Float32Array(mesh.vertices.length * 3);
	const normals = new Float32Array(mesh.vertices.length * 3);
	for (let index = 0; index < mesh.vertices.length; index += 1) {
		const vertex = mesh.vertices[index]!;
		const mapped = developmentPointAtStationFromBuffers(development, buffers, vertex.station);
		positions[index * 3] = mapped.point[0] + mapped.normal[0] * vertex.lateral;
		positions[index * 3 + 1] = floorY + vertex.height;
		positions[index * 3 + 2] = mapped.point[1] + mapped.normal[1] * vertex.lateral;
		normals[index * 3] = mapped.normal[0];
		normals[index * 3 + 1] = 0;
		normals[index * 3 + 2] = mapped.normal[1];
	}
	return {
		wallId: wall.wallId,
		u: state.u,
		floorY,
		height: wall.height,
		development,
		buffers,
		mesh,
		spans,
		positions,
		normals,
		openingBands,
		openingHoles
	};
}

/** Re-map the existing strip at a new `u` without rebuilding its topology. */
export function evaluateWallUnfoldDisplay(
	display: WallUnfoldDisplay,
	state: WallUnfoldState
): { readonly positions: Float32Array; readonly normals: Float32Array } {
	evaluateWallDevelopment(display.development, state.u, display.buffers);
	const positions = new Float32Array(display.mesh.vertices.length * 3);
	const normals = new Float32Array(display.mesh.vertices.length * 3);
	for (let index = 0; index < display.mesh.vertices.length; index += 1) {
		const vertex = display.mesh.vertices[index]!;
		const mapped = developmentPointAtStationFromBuffers(display.development, display.buffers, vertex.station);
		positions[index * 3] = mapped.point[0] + mapped.normal[0] * vertex.lateral;
		positions[index * 3 + 1] = display.floorY + vertex.height;
		positions[index * 3 + 2] = mapped.point[1] + mapped.normal[1] * vertex.lateral;
		normals[index * 3] = mapped.normal[0];
		normals[index * 3 + 1] = 0;
		normals[index * 3 + 2] = mapped.normal[1];
	}
	return { positions, normals };
}

/**
 * Pick the developed strip. The ray is tested against every display triangle
 * (a few thousand for a long Wall) and the nearest positive hit is
 * interpolated; a miss is `null`, never a guessed station.
 */
export function pickWallUnfold(
	display: WallUnfoldDisplay,
	ray: WallUnfoldRay
): WallUnfoldPick | null {
	const origin = ray.origin;
	const direction = ray.direction;
	if (![...origin, ...direction].every(Number.isFinite)) return null;
	const directionLength = Math.hypot(direction[0], direction[1], direction[2]);
	if (!(directionLength > 0)) return null;
	let nearest: WallUnfoldPick | null = null;
	for (const triangle of display.mesh.triangles) {
		const [a, b, c] = triangle.indices;
		const hit = rayTriangle(
			origin,
			direction,
			display.positions[a * 3]!, display.positions[a * 3 + 1]!, display.positions[a * 3 + 2]!,
			display.positions[b * 3]!, display.positions[b * 3 + 1]!, display.positions[b * 3 + 2]!,
			display.positions[c * 3]!, display.positions[c * 3 + 1]!, display.positions[c * 3 + 2]!
		);
		if (hit === null) continue;
		// Determinism rule: the nearest positive hit wins, and an equal-distance
		// tie keeps the earlier triangle in mesh order. Mesh order is the stable
		// display order (side quads per sample segment), so a ray that lands
		// exactly on a cusp or display-cut seam gets one answer rather than a
		// floating-point/array-order answer. Closed stations wrap modulo L below.
		if (nearest !== null && hit.distance >= nearest.distanceMeters) continue;
		const va = display.mesh.vertices[a]!;
		const vb = display.mesh.vertices[b]!;
		const vc = display.mesh.vertices[c]!;
		const wa = 1 - hit.u - hit.v;
		const station = va.station * wa + vb.station * hit.u + vc.station * hit.v;
		const lateral = va.lateral * wa + vb.lateral * hit.u + vc.lateral * hit.v;
		const height = va.height * wa + vb.height * hit.u + vc.height * hit.v;
		const canonicalStation = display.development.closed
			? wrap(station, display.development.length)
			: Math.min(display.development.length, Math.max(0, station));
		nearest = {
			station: canonicalStation,
			lateral,
			height,
			// The display strip's own `left`/`right` labels are its two side
			// quads, not the canonical `w` sign. Picking reports the Wall face by
			// the canonical lateral sign so it agrees with attribution and the
			// existing Opening planners; top/bottom keep their strip label.
			face:
				triangle.face === 'top' || triangle.face === 'bottom'
					? triangle.face
					: lateral >= 0
						? 'left'
						: 'right',
			spanIndex: triangle.spanIndex,
			startKnotId: triangle.startKnotId,
			endKnotId: triangle.endKnotId,
			openingId: developmentOpeningIdentity(display.development, display.openingBands, canonicalStation, height),
			distanceMeters: hit.distance
		};
	}
	// A real Opening void has no rendered triangle to hit. Address the band
	// analytically at the current development `u` so the same canonical Opening
	// remains selectable at either side of a closed Wall's seam.
	for (const band of display.openingBands) {
		const width = band.stationEnd - band.stationStart;
		if (!(width > 0)) continue;
		// Keep the centre on the displayed side of the canonical seam. Wrapping
		// a seam-crossing centre to 0 would address the sheet's far start rather
		// than the seam end where the void actually is.
		const centerStation = Math.min(
			display.development.length,
			Math.max(0, band.stationStart + width / 2)
		);
		const center = developmentPointAtStationFromBuffers(
			display.development,
			display.buffers,
			centerStation
		);
		const centerWorld = [center.point[0], display.floorY + (band.sillHeight + band.headHeight) / 2, center.point[1]] as const;
		const lengthSquared = direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2];
		if (!(lengthSquared > 0)) continue;
		const toCenter = [centerWorld[0] - origin[0], centerWorld[1] - origin[1], centerWorld[2] - origin[2]] as const;
		const distanceAlong = (toCenter[0] * direction[0] + toCenter[1] * direction[1] + toCenter[2] * direction[2]) / lengthSquared;
		if (!(distanceAlong > 0)) continue;
		const closest = [
			origin[0] + direction[0] * distanceAlong,
			origin[1] + direction[1] * distanceAlong,
			origin[2] + direction[2] * distanceAlong
		] as const;
		const perpendicular = Math.hypot(closest[0] - centerWorld[0], closest[1] - centerWorld[1], closest[2] - centerWorld[2]);
		if (perpendicular > width / 2 + 0.05) continue;
		const candidate: WallUnfoldPick = {
			station: centerStation,
			lateral: 0,
			height: band.sillHeight + (band.headHeight - band.sillHeight) / 2,
			face: 'left',
			spanIndex: 0,
			startKnotId: '',
			endKnotId: '',
			openingId: band.openingId,
			distanceMeters: Math.sqrt(distanceAlong * lengthSquared)
		};
		// A jamb beside the void can be a few centimetres nearer than the band
		// centre. The void is still the intended address for any ray inside its
		// width, so let the band win within the same claim neighbourhood.
		if (nearest === null || candidate.distanceMeters <= nearest.distanceMeters + 0.5) nearest = candidate;
	}
	return nearest;
}

/**
 * 2D sibling used by along-wall drags that leave the sheet: project the
 * pointer onto the displayed face polyline and interpolate its station. This
 * is the exact segment projection the plan specifies, never a proximity scan.
 */
export function pickWallUnfoldSheetPoint(
	display: WallUnfoldDisplay,
	point: LayoutVec2
): WallUnfoldPick | null {
	const inverse = developmentInversePoint(
		display.development,
		display.buffers,
		point,
		display.spans
	);
	if (inverse === null) return null;
	return {
		station: inverse.station,
		lateral: inverse.lateral,
		height: 0,
		face: inverse.face,
		spanIndex: inverse.spanIndex,
		startKnotId: inverse.startKnotId,
		endKnotId: inverse.endKnotId,
		openingId: developmentOpeningIdentity(
			display.development,
			display.openingBands,
			inverse.station,
			0
		),
		distanceMeters: 0
	};
}

function wrap(value: number, length: number): number {
	if (!(length > 0)) return 0;
	const result = value % length;
	return result < 0 ? result + length : result;
}

function rayTriangle(
	origin: readonly [number, number, number],
	direction: readonly [number, number, number],
	ax: number,
	ay: number,
	az: number,
	bx: number,
	by: number,
	bz: number,
	cx: number,
	cy: number,
	cz: number
): { readonly distance: number; readonly u: number; readonly v: number } | null {
	const edge1x = bx - ax;
	const edge1y = by - ay;
	const edge1z = bz - az;
	const edge2x = cx - ax;
	const edge2y = cy - ay;
	const edge2z = cz - az;
	const px = direction[1] * edge2z - direction[2] * edge2y;
	const py = direction[2] * edge2x - direction[0] * edge2z;
	const pz = direction[0] * edge2y - direction[1] * edge2x;
	const determinant = edge1x * px + edge1y * py + edge1z * pz;
	if (Math.abs(determinant) < 1e-12) return null;
	const inverse = 1 / determinant;
	const tx = origin[0] - ax;
	const ty = origin[1] - ay;
	const tz = origin[2] - az;
	const u = (tx * px + ty * py + tz * pz) * inverse;
	if (u < -1e-9 || u > 1 + 1e-9) return null;
	const qx = ty * edge1z - tz * edge1y;
	const qy = tz * edge1x - tx * edge1z;
	const qz = tx * edge1y - ty * edge1x;
	const v = (direction[0] * qx + direction[1] * qy + direction[2] * qz) * inverse;
	if (v < -1e-9 || u + v > 1 + 1e-9) return null;
	const distance = (edge2x * qx + edge2y * qy + edge2z * qz) * inverse;
	if (!(distance > 1e-9)) return null;
	return { distance, u, v };
}
