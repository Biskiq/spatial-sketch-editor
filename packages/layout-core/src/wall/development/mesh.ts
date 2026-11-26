import { DEVELOPMENT_EPSILON, orderedDevelopmentSamples, spanForStation, wrap } from './shared';
import type {
	WallDevelopment,
	WallDevelopmentFace,
	WallDevelopmentMesh,
	WallDevelopmentMeshHole,
	WallDevelopmentMeshOptions,
	WallDevelopmentMeshTriangle,
	WallDevelopmentMeshVertex,
} from './types';

/**
 * Build the flat displayed strip. `u = 1` is the proof state; the mesh's
 * vertices are attributed to canonical stations and source spans, and every
 * triangle carries its Wall face. The strip is deliberately a display mesh,
 * not a claim that either Wall face is isometric.
 */
export function buildDevelopedWallMesh(
	development: WallDevelopment,
	options: WallDevelopmentMeshOptions,
): WallDevelopmentMesh {
	const half = options.thickness / 2;
	const vertices: WallDevelopmentMeshVertex[] = [];
	const triangles: WallDevelopmentMeshTriangle[] = [];
	const stations: Array<{ station: number; sheet: number; spanIndex: number }> = [];
	const trianglesByFace: Record<WallDevelopmentFace, number> = {
		left: 0,
		right: 0,
		top: 0,
		bottom: 0,
	};
	const ordered = orderedDevelopmentSamples(development);
	const bounds = {
		min: [Infinity, Infinity, Infinity] as [number, number, number],
		max: [-Infinity, -Infinity, -Infinity] as [number, number, number],
	};

	const pushVertex = (station: number, sheet: number, lateral: number, height: number): number => {
		const span = spanForStation(options.spans, station, development.length, development.closed);
		const index = vertices.length;
		vertices.push({
			station,
			sheet,
			lateral,
			height,
			spanIndex: span?.index ?? 0,
		});
		bounds.min[0] = Math.min(bounds.min[0], sheet);
		bounds.max[0] = Math.max(bounds.max[0], sheet);
		bounds.min[1] = Math.min(bounds.min[1], -half);
		bounds.max[1] = Math.max(bounds.max[1], half);
		bounds.min[2] = Math.min(bounds.min[2], 0);
		bounds.max[2] = Math.max(bounds.max[2], options.height);
		return index;
	};

	const pushTriangle = (
		a: number,
		b: number,
		c: number,
		face: WallDevelopmentFace,
		stationStart: number,
		stationEnd: number,
		sheetStart: number,
		sheetEnd: number,
		voidFill = false,
	): void => {
		const span = spanForStation(
			options.spans,
			development.closed
				? wrap((stationStart + stationEnd) / 2, development.length)
				: (stationStart + stationEnd) / 2,
			development.length,
			development.closed,
		);
		const expected = FACE_NORMALS[face];
		const oriented = orientTriangle(vertices, a, b, c, expected);
		triangles.push({
			indices: oriented,
			face,
			stationStart,
			stationEnd,
			sheetStart,
			sheetEnd,
			spanIndex: span?.index ?? 0,
			startKnotId: span?.startKnotId ?? '',
			endKnotId: span?.endKnotId ?? '',
			...(voidFill ? { void: true } : {}),
		});
		if (!voidFill) trianglesByFace[face] += 1;
	};

	for (const entry of ordered) {
		stations.push({
			station: entry.station,
			sheet: entry.sheet,
			spanIndex:
				spanForStation(options.spans, entry.station, development.length, development.closed)
					?.index ?? 0,
		});
	}
	const openings = options.openings ?? [];
	const topAt = (hole: WallDevelopmentMeshHole, sheet: number): number => {
		if (hole.topBoundary === undefined || hole.topBoundary.length === 0) return hole.headHeight;
		const width = hole.sheetEnd - hole.sheetStart;
		const local = Math.min(width, Math.max(0, sheet - hole.sheetStart));
		const points = hole.topBoundary;
		if (local <= points[0]![0]! + DEVELOPMENT_EPSILON) return hole.sillHeight + points[0]![1]!;
		for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
			const previous = points[pointIndex - 1]!;
			const current = points[pointIndex]!;
			if (local > current[0]! + DEVELOPMENT_EPSILON) continue;
			const span = current[0]! - previous[0]!;
			const amount = span > DEVELOPMENT_EPSILON ? (local - previous[0]!) / span : 0;
			return hole.sillHeight + previous[1]! + (current[1]! - previous[1]!) * amount;
		}
		return hole.sillHeight + points.at(-1)![1]!;
	};

	for (let index = 1; index < ordered.length; index += 1) {
		const previous = ordered[index - 1]!;
		if (ordered[index]!.sheet - previous.sheet <= DEVELOPMENT_EPSILON) continue;
		const start = previous;
		const end = ordered[index]!;
		const stationAt = (sheet: number): number =>
			start.station +
			((sheet - start.sheet) / (end.sheet - start.sheet)) * (end.station - start.station);
		// Cut at every Opening edge and every compiled arch-profile knot. A void is
		// a real absence of triangles, and the arch boundary is carried by the same
		// sampled top boundary the canonical renderer uses.
		const sheetCuts = new Set<number>([start.sheet, end.sheet]);
		for (const hole of openings) {
			if (hole.sheetEnd <= start.sheet + DEVELOPMENT_EPSILON) continue;
			if (hole.sheetStart >= end.sheet - DEVELOPMENT_EPSILON) continue;
			for (const sheet of [hole.sheetStart, hole.sheetEnd]) {
				if (sheet > start.sheet + DEVELOPMENT_EPSILON && sheet < end.sheet - DEVELOPMENT_EPSILON) {
					sheetCuts.add(sheet);
				}
			}
			for (const point of hole.topBoundary ?? []) {
				const sheet = hole.sheetStart + point[0]!;
				if (sheet > start.sheet + DEVELOPMENT_EPSILON && sheet < end.sheet - DEVELOPMENT_EPSILON) {
					sheetCuts.add(sheet);
				}
			}
		}
		const sheets = [...sheetCuts].sort((a, b) => a - b);
		for (let sheetIndex = 1; sheetIndex < sheets.length; sheetIndex += 1) {
			const sheet0 = sheets[sheetIndex - 1]!;
			const sheet1 = sheets[sheetIndex]!;
			if (sheet1 - sheet0 <= DEVELOPMENT_EPSILON) continue;
			const station0 = stationAt(sheet0);
			const station1 = stationAt(sheet1);
			const sheetMid = (sheet0 + sheet1) / 2;
			const active = openings.filter(
				(hole) =>
					hole.sheetStart < sheet1 - DEVELOPMENT_EPSILON &&
					hole.sheetEnd > sheet0 + DEVELOPMENT_EPSILON,
			);
			const addSideBand = (bottom0: number, bottom1: number, top0: number, top1: number): void => {
				const low0 = Math.max(0, Math.min(options.height, bottom0));
				const low1 = Math.max(0, Math.min(options.height, bottom1));
				const high0 = Math.max(0, Math.min(options.height, top0));
				const high1 = Math.max(0, Math.min(options.height, top1));
				if (high0 - low0 <= DEVELOPMENT_EPSILON && high1 - low1 <= DEVELOPMENT_EPSILON) return;
				for (const [lateral, face] of [
					[-half, 'left'],
					[half, 'right'],
				] as const) {
					const a = pushVertex(station0, sheet0, lateral, low0);
					const b = pushVertex(station1, sheet1, lateral, low1);
					const c = pushVertex(station1, sheet1, lateral, high1);
					const d = pushVertex(station0, sheet0, lateral, high0);
					if (high0 - low0 <= DEVELOPMENT_EPSILON) {
						pushTriangle(a, b, c, face, station0, station1, sheet0, sheet1);
					} else if (high1 - low1 <= DEVELOPMENT_EPSILON) {
						pushTriangle(a, b, d, face, station0, station1, sheet0, sheet1);
					} else {
						pushTriangle(a, b, c, face, station0, station1, sheet0, sheet1);
						pushTriangle(a, c, d, face, station0, station1, sheet0, sheet1);
					}
				}
			};
			if (active.length === 0) {
				addSideBand(0, 0, options.height, options.height);
			} else {
				for (const hole of active) {
					if (hole.sillHeight > DEVELOPMENT_EPSILON)
						addSideBand(0, 0, hole.sillHeight, hole.sillHeight);
					const top0 = topAt(hole, sheet0);
					const top1 = topAt(hole, sheet1);
					addSideBand(top0, top1, options.height, options.height);
				}
			}
			const topSolid = active.every(
				(hole) => topAt(hole, sheetMid) < options.height - DEVELOPMENT_EPSILON,
			);
			const bottomSolid = active.every((hole) => hole.sillHeight > DEVELOPMENT_EPSILON);
			if (topSolid) {
				const lt0 = pushVertex(station0, sheet0, -half, options.height);
				const rt0 = pushVertex(station0, sheet0, half, options.height);
				const lt1 = pushVertex(station1, sheet1, -half, options.height);
				const rt1 = pushVertex(station1, sheet1, half, options.height);
				pushTriangle(lt0, rt0, rt1, 'top', station0, station1, sheet0, sheet1);
				pushTriangle(lt0, rt1, lt1, 'top', station0, station1, sheet0, sheet1);
			}
			if (bottomSolid) {
				const lb0 = pushVertex(station0, sheet0, -half, 0);
				const rb0 = pushVertex(station0, sheet0, half, 0);
				const lb1 = pushVertex(station1, sheet1, -half, 0);
				const rb1 = pushVertex(station1, sheet1, half, 0);
				pushTriangle(lb0, lb1, rb1, 'bottom', station0, station1, sheet0, sheet1);
				pushTriangle(lb0, rb1, rb0, 'bottom', station0, station1, sheet0, sheet1);
			}
		}
	}

	// A void is a real hole in the rendered strip, but it remains addressable:
	// one pick-only centre quad per hole keeps the inverse map and Opening
	// identity working without drawing a second contour or a false surface.
	return { vertices, triangles, stations, trianglesByFace, bounds };
}

export const FACE_NORMALS: Record<WallDevelopmentFace, [number, number, number]> = {
	left: [0, -1, 0],
	right: [0, 1, 0],
	top: [0, 0, 1],
	bottom: [0, 0, -1],
};

function orientTriangle(
	vertices: readonly WallDevelopmentMeshVertex[],
	a: number,
	b: number,
	c: number,
	expected: readonly [number, number, number],
): [number, number, number] {
	const va = vertices[a]!;
	const vb = vertices[b]!;
	const vc = vertices[c]!;
	const normal = cross(
		[vb.sheet - va.sheet, vb.lateral - va.lateral, vb.height - va.height],
		[vc.sheet - va.sheet, vc.lateral - va.lateral, vc.height - va.height],
	);
	const dot = normal[0] * expected[0] + normal[1] * expected[1] + normal[2] * expected[2];
	return dot >= 0 ? [a, b, c] : [a, c, b];
}

export function cross(
	a: readonly [number, number, number],
	b: readonly [number, number, number],
): [number, number, number] {
	return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
