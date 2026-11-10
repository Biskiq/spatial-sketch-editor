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
	spanForStation,
	createWallDevelopmentSheetBuffers,
	developmentInversePoint,
	developmentOpeningFragments,
	developmentOpeningIdentity,
	developmentPointAtSheetFromBuffers,
	developmentPointAtStationFromBuffers,
	developmentSheetCoordinate,
	evaluateWallDevelopment,
	evaluateWallDevelopmentSheet,
	isWallDevelopmentRefusal,
	prepareWallDevelopment,
	type CompiledPhysicalWall,
	type LayoutVec2,
	type WallDevelopment,
	type WallDevelopmentBuffers,
	type WallDevelopmentMesh,
	type WallDevelopmentMeshHole,
	type WallDevelopmentOpeningBand,
	type WallDevelopmentSheetBuffers,
	type WallDevelopmentSourceSpan
} from '@portfolio/layout-core';

import {
	prepareWallUnfoldDevelopment,
	wallUnfoldSideAngle,
	type WallUnfoldState
} from './wall-unfold';

export type WallUnfoldRay = {
	readonly origin: readonly [number, number, number];
	readonly direction: readonly [number, number, number];
};

/**
 * The identity of one built developed display. A cache may reuse a display
 * only while the Wall, cut, Opening preview and canonical layout revision all
 * match; a source edit during an active reading therefore rebuilds the sheet.
 */
export function wallUnfoldDisplayKey(input: {
	readonly wallId: string;
	readonly cutStation: number | null;
	readonly previewKey: string;
	readonly sourceRevision: string;
}): string {
	return JSON.stringify([input.wallId, input.cutStation, input.previewKey, input.sourceRevision]);
}

/** One developed strip in world space, with its canonical attribution intact. */
export type WallUnfoldDisplay = {
	readonly wallId: string;
	readonly u: number;
	/** World-Y presentation angle around the fixed anchor. */
	readonly sideAngle: number;
	readonly floorY: number;
	readonly height: number;
	readonly development: WallDevelopment;
	readonly buffers: WallDevelopmentBuffers;
	/** Closed Walls evaluate a cut-to-cut sheet; open Walls keep canonical buffers. */
	readonly sheetBuffers: WallDevelopmentSheetBuffers | null;
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

/** The fixed-pin anchor in displayed sheet coordinates. */
export function unfoldDisplayAnchor(display: WallUnfoldDisplay): LayoutVec2 {
	if (display.sheetBuffers === null) {
		return developmentPointAtStationFromBuffers(
			display.development,
			display.buffers,
			display.development.anchorStation
		).point;
	}
	const sheet = developmentSheetCoordinate(display.development, display.development.anchorStation);
	return developmentPointAtSheetFromBuffers(display.sheetBuffers, sheet).point;
}

function rotateUnfoldPoint(point: LayoutVec2, anchor: LayoutVec2, angle: number): LayoutVec2 {
	if (!Number.isFinite(angle) || Math.abs(angle) < 1e-12) return point;
	const cosine = Math.cos(angle);
	const sine = Math.sin(angle);
	const x = point[0] - anchor[0];
	const z = point[1] - anchor[1];
	return [anchor[0] + cosine * x + sine * z, anchor[1] - sine * x + cosine * z];
}

function rotateUnfoldVector(vector: LayoutVec2, angle: number): LayoutVec2 {
	if (!Number.isFinite(angle) || Math.abs(angle) < 1e-12) return vector;
	const cosine = Math.cos(angle);
	const sine = Math.sin(angle);
	return [cosine * vector[0] + sine * vector[1], -sine * vector[0] + cosine * vector[1]];
}

function profileTopAt(points: readonly LayoutVec2[], width: number, local: number): number {
	const target = Math.min(width, Math.max(0, local));
	if (points.length === 0) return 0;
	if (target <= points[0]![0]! + 1e-9) return points[0]![1]!;
	for (let index = 1; index < points.length; index += 1) {
		const previous = points[index - 1]!;
		const current = points[index]!;
		if (target > current[0]! + 1e-9) continue;
		const span = current[0]! - previous[0]!;
		const amount = span > 1e-9 ? (target - previous[0]!) / span : 0;
		return previous[1]! + (current[1]! - previous[1]!) * amount;
	}
	return points.at(-1)![1]!;
}

/** Clip a compiled profile to one displayed fragment, in hole-local metres. */
function sliceProfile(
	points: readonly LayoutVec2[],
	width: number,
	from: number,
	to: number
): LayoutVec2[] {
	const start = Math.min(width, Math.max(0, from));
	const end = Math.min(width, Math.max(start, to));
	if (!(end > start)) return [];
	const sliced: LayoutVec2[] = [[0, profileTopAt(points, width, start)]];
	for (const point of points) {
		if (point[0]! > start + 1e-9 && point[0]! < end - 1e-9) {
			sliced.push([point[0]! - start, point[1]!]);
		}
	}
	sliced.push([end - start, profileTopAt(points, width, end)]);
	return sliced;
}

/**
 * Build the developed strip for one scrub state. Built once per entry, cut
 * change or accepted edit; scrubbing only re-evaluates the shared buffers (the
 * caller maps vertices from this display without rebuilding the mesh).
 */
export function buildWallUnfoldDisplay(
	wall: CompiledPhysicalWall,
	state: WallUnfoldState,
	options: {
		readonly floorY?: number;
		readonly spans?: readonly WallDevelopmentSourceSpan[];
		readonly sideAngle?: number;
	} = {}
): WallUnfoldDisplay | null {
	const prepared = prepareWallUnfoldDevelopment(state, wall);
	if (isWallDevelopmentRefusal(prepared)) return null;
	const development = prepared;
	const buffers = createWallDevelopmentBuffers(development);
	const sheetBuffers = development.closed && development.cutStation !== null
		? createWallDevelopmentSheetBuffers(development)
		: null;
	if (sheetBuffers === null) evaluateWallDevelopment(development, state.u, buffers);
	else evaluateWallDevelopmentSheet(development, state.u, sheetBuffers);
	const spans = options.spans ?? [];
	const openingBands: WallDevelopmentOpeningBand[] = wall.openings.map((opening) => ({
		openingId: opening.openingId,
		stationStart: opening.offset,
		stationEnd: opening.offset + opening.width,
		sillHeight: opening.sillHeight,
		headHeight: opening.sillHeight + opening.height,
		topBoundary: opening.profileShape?.topBoundary,
		kind: opening.kind
	}));
	const openingHoles: WallDevelopmentMeshHole[] = openingBands.flatMap((band) => {
		const source = wall.openings.find((opening) => opening.openingId === band.openingId)!;
		const profile = source.profileShape?.topBoundary;
		const developmentOpening = developmentOpeningFragments(
			development,
			{ openingId: band.openingId, offset: band.stationStart, width: band.stationEnd - band.stationStart },
			spans
		);
		return developmentOpening.fragments.map((fragment) => {
			let topBoundary: LayoutVec2[] | undefined;
			if (profile !== undefined) {
				const width = band.stationEnd - band.stationStart;
				const localStart = development.closed
					? wrap(fragment.stationStart - band.stationStart, development.length)
					: fragment.stationStart - band.stationStart;
				const localEnd = localStart + (fragment.sheetEnd - fragment.sheetStart);
				topBoundary = sliceProfile(profile, width, localStart, localEnd);
			}
			return {
				openingId: band.openingId,
				sheetStart: fragment.sheetStart,
				sheetEnd: fragment.sheetEnd,
				sillHeight: band.sillHeight,
				headHeight: band.headHeight,
				...(topBoundary === undefined ? {} : { topBoundary })
			};
		});
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
		const mapped = sheetBuffers === null
			? developmentPointAtStationFromBuffers(development, buffers, vertex.station)
			: developmentPointAtSheetFromBuffers(sheetBuffers, vertex.sheet);
		positions[index * 3] = mapped.point[0] + mapped.normal[0] * vertex.lateral;
		positions[index * 3 + 1] = floorY + vertex.height;
		positions[index * 3 + 2] = mapped.point[1] + mapped.normal[1] * vertex.lateral;
		normals[index * 3] = mapped.normal[0];
		normals[index * 3 + 1] = 0;
		normals[index * 3 + 2] = mapped.normal[1];
	}
	const sideAngle = options.sideAngle ?? wallUnfoldSideAngle(state.side);
	const display: WallUnfoldDisplay = {
		wallId: wall.wallId,
		u: state.u,
		sideAngle,
		floorY,
		height: wall.height,
		development,
		buffers,
		sheetBuffers,
		mesh,
		spans,
		positions,
		normals,
		openingBands,
		openingHoles
	};
	const oriented = evaluateWallUnfoldDisplay(display, state, sideAngle);
	return { ...display, positions: oriented.positions, normals: oriented.normals };
}

/** Re-map the existing strip at a new `u` without rebuilding its topology. */
export function evaluateWallUnfoldDisplay(
	display: WallUnfoldDisplay,
	state: WallUnfoldState,
	sideAngle = display.sideAngle
): { readonly positions: Float32Array; readonly normals: Float32Array } {
	if (display.sheetBuffers === null) evaluateWallDevelopment(display.development, state.u, display.buffers);
	else evaluateWallDevelopmentSheet(display.development, state.u, display.sheetBuffers);
	const positions = new Float32Array(display.mesh.vertices.length * 3);
	const normals = new Float32Array(display.mesh.vertices.length * 3);
	for (let index = 0; index < display.mesh.vertices.length; index += 1) {
		const vertex = display.mesh.vertices[index]!;
		const mapped = display.sheetBuffers === null
			? developmentPointAtStationFromBuffers(display.development, display.buffers, vertex.station)
			: developmentPointAtSheetFromBuffers(display.sheetBuffers, vertex.sheet);
		const point = rotateUnfoldPoint(
			[mapped.point[0] + mapped.normal[0] * vertex.lateral, mapped.point[1] + mapped.normal[1] * vertex.lateral],
			unfoldDisplayAnchor(display),
			sideAngle
		);
		const normal = rotateUnfoldVector(mapped.normal, sideAngle);
		positions[index * 3] = point[0];
		positions[index * 3 + 1] = display.floorY + vertex.height;
		positions[index * 3 + 2] = point[1];
		normals[index * 3] = normal[0];
		normals[index * 3 + 1] = 0;
		normals[index * 3 + 2] = normal[1];
	}
	return { positions, normals };
}

/** One canonical station on the displayed strip, cut-aware for closed Walls. */
export function unfoldDisplayPointAtStation(
	display: WallUnfoldDisplay,
	station: number,
	sideAngle = display.sideAngle
): { point: LayoutVec2; normal: LayoutVec2 } {
	if (display.sheetBuffers === null) {
		const mapped = developmentPointAtStationFromBuffers(display.development, display.buffers, station);
		return {
			point: rotateUnfoldPoint(mapped.point, unfoldDisplayAnchor(display), sideAngle),
			normal: rotateUnfoldVector(mapped.normal, sideAngle)
		};
	}
	const sheet = display.development.closed
		? developmentSheetCoordinate(display.development, station)
		: station - display.development.anchorStation;
	const mapped = developmentPointAtSheetFromBuffers(display.sheetBuffers, sheet);
	return {
		point: rotateUnfoldPoint(mapped.point, unfoldDisplayAnchor(display), sideAngle),
		normal: rotateUnfoldVector(mapped.normal, sideAngle)
	};
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
		const center = unfoldDisplayPointAtStation(display, centerStation);
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
	point: LayoutVec2,
	sideAngle = display.sideAngle
): WallUnfoldPick | null {
	const localPoint = rotateUnfoldPoint(point, unfoldDisplayAnchor(display), -sideAngle);
	if (display.sheetBuffers === null) {
		const inverse = developmentInversePoint(
			display.development,
			display.buffers,
			localPoint,
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

	// Closed Walls display cut-to-cut, so canonical development buffers cannot
	// answer a 2D pointer. Project onto the displayed sheet polyline instead;
	// its sheet coordinate maps back through the cut to a canonical station.
	const development = display.development;
	const cut = development.cutStation ?? development.anchorStation;
	let nearest: { distance: number; station: number; lateral: number; sheet: number } | null = null;
	for (let index = 1; index < display.mesh.stations.length; index += 1) {
		const start = display.mesh.stations[index - 1]!;
		const end = display.mesh.stations[index]!;
		if (end.sheet - start.sheet <= 1e-9) continue;
		const a = developmentPointAtSheetFromBuffers(display.sheetBuffers, start.sheet).point;
		const b = developmentPointAtSheetFromBuffers(display.sheetBuffers, end.sheet).point;
		const dx = b[0] - a[0];
		const dz = b[1] - a[1];
		const lengthSquared = dx * dx + dz * dz;
		if (!(lengthSquared > 0)) continue;
		const amount = Math.min(1, Math.max(0, ((localPoint[0] - a[0]) * dx + (localPoint[1] - a[1]) * dz) / lengthSquared));
		const closest: LayoutVec2 = [a[0] + dx * amount, a[1] + dz * amount];
		const distance = Math.hypot(localPoint[0] - closest[0], localPoint[1] - closest[1]);
		if (nearest !== null && distance >= nearest.distance) continue;
		const sheet = start.sheet + (end.sheet - start.sheet) * amount;
		nearest = {
			distance,
			station: development.closed ? wrap(cut + sheet, development.length) : sheet + development.anchorStation,
			lateral: (dx * (localPoint[1] - a[1]) - dz * (localPoint[0] - a[0])) / Math.sqrt(lengthSquared),
			sheet
		};
	}
	if (nearest === null) return null;
	const span = spanForStation(display.spans, nearest.station, development.length, development.closed);
	return {
		station: nearest.station,
		lateral: nearest.lateral,
		height: 0,
		face: nearest.lateral >= 0 ? 'left' : 'right',
		spanIndex: span?.index ?? 0,
		startKnotId: span?.startKnotId ?? '',
		endKnotId: span?.endKnotId ?? '',
		openingId: developmentOpeningIdentity(development, display.openingBands, nearest.station, 0),
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
