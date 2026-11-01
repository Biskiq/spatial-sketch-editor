/**
 * R217.S04 — the **Paper Plan drawing set**.
 *
 * Paper is a *drawing* of data the Stage already computes: Layout's ordinary
 * `PlanEvaluation` (cut, projected, hidden and symbol streams, already filtered by
 * eligibility) and Scene's existing footprint projection. Nothing here evaluates a
 * second Plan, projects a body, or reads a Camera matrix. The module only decides
 * how an already-placed fragment is inked and in what order, so the layer that
 * draws and the resolver that picks cannot disagree about a source, a stream or a
 * layer rank.
 *
 * **Layer ranks are the pick ranks.** `createPlanPickProvider` reports the same
 * `fragmentLayer` this module draws with, and the Scene adapter reports
 * `PAPER_LAYER.sceneFootprint`; `resolveStagePick` therefore arbitrates with the
 * drawing's own order.
 */
import {
	eligiblePlanFragments,
	createPlanBoxIndex,
	indexedCompiledWall,
	type CompiledLayoutGeometry,
	type LayoutVec2,
	type PlanBox,
	type PlanEvaluation,
	type PlanFragment,
	type PlanStream
} from '@portfolio/layout-core';
import type { PlanSceneProjection } from '$lib/authoring/scene/plan-scene-footprint';

/**
 * Stage render layers.
 *
 * World geometry stays on the default layer. Every Canvas-drawn Stage overlay
 * (Paper now; the selection, hover, grid and Sheet layers that follow) is on the
 * dedicated overlay layer, and the camera's layer mask decides which are shown.
 * Appearance never writes `Object3D.visible`, which stays the pick source's
 * "mounted and eligible to be hit" flag.
 */
export const STAGE_WORLD_LAYER = 0;
export const STAGE_OVERLAY_LAYER = 2;

/** PLATE §Semantic color / §Material and working surfaces reference calibrations. */
export const PAPER_INK = '#1b201c';
export const PAPER_GROUND_INK = '#e9ebe6';
export const MAT_BACKGROUND_INK = '#152c26';
export const MAT_GROUND_INK = '#1d3a33';
/** The 3D ground inside the work's bounds; outside it stays the forest mat. */
export const GROUND_PLATE_INK = '#efe8d8';

/**
 * Plan draw order, low to high. The numbers are the resolver's Plan ranks too.
 *
 * `room-floor` is a projected stream in the representation (a floor is the surface
 * the Plan looks at, never overhead geometry hidden below the cut), but it is
 * paper tint under everything, so its rank is by source kind first.
 */
export const PAPER_LAYER = {
	roomFloor: 10,
	hidden: 20,
	projected: 30,
	cut: 40,
	symbol: 50,
	sceneFootprint: 60
} as const;

export type PaperLayer = (typeof PAPER_LAYER)[keyof typeof PAPER_LAYER];

export type PaperTreatment = 'room-floor' | 'hidden' | 'projected' | 'cut' | 'symbol' | 'footprint';

export type PaperLineStyle = {
	readonly ink: string;
	/** CSS pixels at the current viewport, never world metres. */
	readonly widthCssPx: number;
	readonly opacity: number;
	readonly dashed: boolean;
	/** Dash pattern in world metres; only read when `dashed`. */
	readonly dashSizeMeters: number;
	readonly gapSizeMeters: number;
};

/** Treatments in PLATE §Semantic color. Same values the acceptance record claims. */
export const PAPER_LINE_STYLE: {
	readonly [Treatment in Exclude<PaperTreatment, 'room-floor'>]: PaperLineStyle;
} = {
	cut: { ink: PAPER_INK, widthCssPx: 1.5, opacity: 1, dashed: false, dashSizeMeters: 0.12, gapSizeMeters: 0.08 },
	projected: { ink: PAPER_INK, widthCssPx: 1, opacity: 0.7, dashed: false, dashSizeMeters: 0.12, gapSizeMeters: 0.08 },
	hidden: { ink: PAPER_INK, widthCssPx: 1, opacity: 0.45, dashed: true, dashSizeMeters: 0.12, gapSizeMeters: 0.08 },
	symbol: { ink: PAPER_INK, widthCssPx: 1, opacity: 1, dashed: false, dashSizeMeters: 0.12, gapSizeMeters: 0.08 },
	footprint: { ink: PAPER_INK, widthCssPx: 1.25, opacity: 1, dashed: false, dashSizeMeters: 0.12, gapSizeMeters: 0.08 }
};

export const PAPER_FILL_INK: { readonly cut: string; readonly 'room-floor': string } = {
	cut: PAPER_INK,
	'room-floor': PAPER_GROUND_INK
};

export type PaperSegment = readonly [LayoutVec2, LayoutVec2];

export type PaperLineDraw = {
	readonly key: string;
	readonly sourceId: string;
	readonly stream: PlanStream;
	readonly layer: PaperLayer;
	readonly treatment: Exclude<PaperTreatment, 'room-floor' | 'footprint'>;
	readonly elevationMeters: number;
	readonly segments: readonly PaperSegment[];
};

export type PaperFillDraw = {
	readonly key: string;
	readonly sourceId: string;
	readonly layer: typeof PAPER_LAYER.roomFloor | typeof PAPER_LAYER.cut;
	readonly treatment: 'room-floor' | 'cut';
	readonly elevationMeters: number;
	readonly polygons: readonly (readonly LayoutVec2[])[];
};

export type PaperFootprintDraw = {
	readonly key: string;
	readonly entityId: string;
	readonly kind: 'model' | 'primitive' | 'form';
	readonly layer: typeof PAPER_LAYER.sceneFootprint;
	readonly treatment: 'footprint';
	readonly elevationMeters: number;
	readonly segments: readonly PaperSegment[];
	/** The source ring(s) the outline was derived from; tests compare these. */
	readonly polygons: readonly (readonly LayoutVec2[])[];
};

export type PaperPlanDrawing = {
	readonly lines: readonly PaperLineDraw[];
	readonly fills: readonly PaperFillDraw[];
	readonly footprints: readonly PaperFootprintDraw[];
};

/**
 * The Plan layer rank of one fragment.
 *
 * Source kind decides the paper tint before the stream does: a Room floor is
 * always the surface under the drawing even though the representation files it
 * under `projected`.
 */
export function fragmentLayer(fragment: PlanFragment): PaperLayer {
	if (fragment.ref.sourceKind === 'room-floor') return PAPER_LAYER.roomFloor;
	switch (fragment.ref.stream) {
		case 'symbol':
			return PAPER_LAYER.symbol;
		case 'cut':
			return PAPER_LAYER.cut;
		case 'projected':
			return PAPER_LAYER.projected;
		case 'hidden':
			return PAPER_LAYER.hidden;
	}
}

/** The inked treatment of one fragment, from the stream the evaluator placed it in. */
export function fragmentTreatment(fragment: PlanFragment): Exclude<PaperTreatment, 'footprint'> {
	if (fragment.ref.sourceKind === 'room-floor') return 'room-floor';
	switch (fragment.ref.stream) {
		case 'symbol':
			return 'symbol';
		case 'cut':
			return 'cut';
		case 'projected':
			return 'projected';
		case 'hidden':
			return 'hidden';
	}
}

/** Closed edges of one ring. */
function ringSegments(polygon: readonly LayoutVec2[]): PaperSegment[] {
	if (polygon.length < 2) return [];
	const segments: PaperSegment[] = [];
	for (let index = 0; index < polygon.length; index += 1) {
		segments.push([polygon[index]!, polygon[(index + 1) % polygon.length]!]);
	}
	return segments;
}

/** Edges of one fragment geometry; a polygon closes, a polyline does not. */
export function fragmentSegments(fragment: PlanFragment): PaperSegment[] {
	const geometry = fragment.geometry;
	if (geometry.kind === 'span') return [[geometry.start, geometry.end]];
	if (geometry.kind === 'polyline') {
		const segments: PaperSegment[] = [];
		for (let index = 1; index < geometry.polyline.length; index += 1) {
			segments.push([geometry.polyline[index - 1]!, geometry.polyline[index]!]);
		}
		return segments;
	}
	return ringSegments(geometry.polygon);
}

function polygonOfFragment(fragment: PlanFragment): readonly LayoutVec2[] | null {
	return fragment.geometry.kind === 'polygon' ? fragment.geometry.polygon : null;
}

/**
 * The Wall's cut band: its drawn span offset to both faces by the compiled Wall's
 * own thickness.
 *
 * The Plan representation deliberately carries a centre-line span, not a second
 * copy of Wall thickness; the compiler is the thickness authority and the pick
 * provider already reads the same compiled record for a Wall's drawn extents.
 * Ends that meet a Junction are extended by half the thickness so neighbouring
 * bands close the corner instead of leaving a notch; an end at an Opening stays
 * on its jamb.
 */
export function cutWallBandOf(
	fragment: PlanFragment,
	compiled: CompiledLayoutGeometry
): readonly LayoutVec2[] | null {
	if (fragment.ref.sourceKind !== 'wall' || fragment.geometry.kind !== 'span') return null;
	const wall = indexedCompiledWall(compiled, fragment.ref.sourceId);
	if (wall === undefined || !(wall.thickness > 0) || !Number.isFinite(wall.thickness)) return null;
	const interval = fragment.ref.subRef?.kind === 'interval' ? fragment.ref.subRef : null;
	if (interval === null) return null;
	const matching = wall.solidSpans.find(
		(candidate) =>
			Math.abs(candidate.startDistance - interval.start) < 1e-6 &&
			Math.abs(candidate.endDistance - interval.end) < 1e-6
	);
	if (matching === undefined) return null;

	const { start, end } = fragment.geometry;
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const length = Math.hypot(dx, dz);
	if (!(length > 0) || !Number.isFinite(length)) return null;
	const half = wall.thickness / 2;
	const ux = dx / length;
	const uz = dz / length;
	// Square caps only at a Junction end. An Opening jamb is an interior distance and
	// keeps its exact edge, so a door never gains half a Wall of poché.
	const total = wall.samples.at(-1)?.distance ?? length;
	const startCap = matching.startDistance <= 1e-6 ? half : 0;
	const endCap = Math.abs(matching.endDistance - total) <= 1e-6 ? half : 0;
	const sx = start[0] - ux * startCap;
	const sz = start[1] - uz * startCap;
	const ex = end[0] + ux * endCap;
	const ez = end[1] + uz * endCap;
	const nx = -uz * half;
	const nz = ux * half;
	return [
		[sx + nx, sz + nz],
		[ex + nx, ez + nz],
		[ex - nx, ez - nz],
		[sx - nx, sz - nz]
	];
}

type UnionPolygon = readonly LayoutVec2[];

type UnionPolygonBounds = PlanBox & { readonly candidate: PlanBox };

/** Conservative bounds for one polygon and its edge-tolerance expansion. */
function unionPolygonBounds(polygon: UnionPolygon): UnionPolygonBounds {
	let minX = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxZ = -Infinity;
	let longestEdge = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const point = polygon[index]!;
		const next = polygon[(index + 1) % polygon.length]!;
		minX = Math.min(minX, point[0]);
		minZ = Math.min(minZ, point[1]);
		maxX = Math.max(maxX, point[0]);
		maxZ = Math.max(maxZ, point[1]);
		longestEdge = Math.max(longestEdge, Math.hypot(next[0] - point[0], next[1] - point[1]));
	}
	const padding = UNION_ON_EDGE_EPSILON + longestEdge * UNION_SPLIT_EPSILON;
	return {
		minX,
		minZ,
		maxX,
		maxZ,
		candidate: { minX: minX - padding, minZ: minZ - padding, maxX: maxX + padding, maxZ: maxZ + padding }
	};
}

/** Spatial broad phase for the exact edge and containment predicates below. */
function unionPolygonIndex(polygons: readonly UnionPolygon[]): {
	readonly bounds: readonly UnionPolygonBounds[];
	overlaps(box: PlanBox): number[];
} {
	const bounds = polygons.map(unionPolygonBounds);
	const index = createPlanBoxIndex(bounds.map((entry) => entry.candidate));
	return { bounds, overlaps: (box) => index.overlaps(box) };
}

function paddedEdgeBounds(a: LayoutVec2, b: LayoutVec2): PlanBox {
	const padding = UNION_ON_EDGE_EPSILON + Math.hypot(b[0] - a[0], b[1] - a[1]) * UNION_SPLIT_EPSILON;
	return {
		minX: Math.min(a[0], b[0]) - padding,
		minZ: Math.min(a[1], b[1]) - padding,
		maxX: Math.max(a[0], b[0]) + padding,
		maxZ: Math.max(a[1], b[1]) + padding
	};
}

function pointInTriangle(point: LayoutVec2, a: LayoutVec2, b: LayoutVec2, c: LayoutVec2): boolean {
	const cross = (p: LayoutVec2, q: LayoutVec2, r: LayoutVec2): number =>
		(q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
	const d1 = cross(a, b, point);
	const d2 = cross(b, c, point);
	const d3 = cross(c, a, point);
	const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
	const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
	return !(hasNegative && hasPositive);
}

function pointInUnion(
	point: LayoutVec2,
	polygons: readonly UnionPolygon[],
	index: ReturnType<typeof unionPolygonIndex>
): boolean {
	const candidates = index.overlaps({
		minX: point[0] - 1e-9,
		minZ: point[1] - 1e-9,
		maxX: point[0] + 1e-9,
		maxZ: point[1] + 1e-9
	});
	for (const polygonIndex of candidates) {
		const polygon = polygons[polygonIndex]!;
		if (polygon.length < 3) continue;
		if (polygon.length === 3) {
			if (pointInTriangle(point, polygon[0]!, polygon[1]!, polygon[2]!)) return true;
			continue;
		}
		// A triangulated projection is what the footprint carries; a longer ring is
		// still a valid polygon, so use the same even-odd rule the Scene hit uses.
		let inside = false;
		for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
			const current = polygon[index]!;
			const prior = polygon[previous]!;
			const onEdge = (point[0] - prior[0]) * (current[1] - prior[1]) - (point[1] - prior[1]) * (current[0] - prior[0]);
			const within =
				Math.min(prior[0], current[0]) - 1e-9 <= point[0] &&
				point[0] <= Math.max(prior[0], current[0]) + 1e-9 &&
				Math.min(prior[1], current[1]) - 1e-9 <= point[1] &&
				point[1] <= Math.max(prior[1], current[1]) + 1e-9;
			if (Math.abs(onEdge) <= 1e-9 && within) return true;
			const crosses =
				(current[1] > point[1]) !== (prior[1] > point[1]) &&
				point[0] < ((prior[0] - current[0]) * (point[1] - current[1])) / (prior[1] - current[1]) + current[0];
			if (crosses) inside = !inside;
		}
		if (inside) return true;
	}
	return false;
}

function edgeKey(a: LayoutVec2, b: LayoutVec2): string {
	const round = (value: number): number => Math.round(value * 1e6) / 1e6;
	const forward = `${round(a[0])},${round(a[1])}|${round(b[0])},${round(b[1])}`;
	const reverse = `${round(b[0])},${round(b[1])}|${round(a[0])},${round(a[1])}`;
	return forward < reverse ? forward : reverse;
}

/**
 * The boundary of a projected triangle union.
 *
 * A tilted form's Plan extent is the union of its projected triangles, including
 * overlapping faces. Edge parity cancels a box's top and bottom rings even though
 * both are its silhouette, so membership is tested directly: an edge is on the
 * boundary when exactly one side of it lies inside the union. Coincident boundary
 * edges from two faces are emitted once.
 */
/**
 * Merge overlapping collinear boundary pieces into one segment.
 *
 * Coincident faces of a projected solid contribute the same silhouette edge more
 * than once (a box's front and side faces both bound the left side), and a
 * triangulated face splits a straight silhouette into several edges. Drawing the
 * raw edge set would over-stroke the same line; merging keeps the outline a clean
 * closed boundary for the drawing and for S07's later re-stroke.
 */
function mergeCollinear(segments: readonly PaperSegment[]): PaperSegment[] {
	type Group = { readonly reference: LayoutVec2; readonly direction: LayoutVec2; readonly intervals: Array<[number, number]> };
	const groups = new Map<string, Group>();
	const round = (value: number): number => Math.round(value * 1e6) / 1e6;
	for (const [start, end] of segments) {
		const dx = end[0] - start[0];
		const dz = end[1] - start[1];
		const length = Math.hypot(dx, dz);
		if (!(length > 1e-9)) continue;
		let direction: LayoutVec2 = [dx / length, dz / length];
		if (direction[0] < -1e-9 || (Math.abs(direction[0]) <= 1e-9 && direction[1] < 0)) {
			direction = [-direction[0], -direction[1]];
		}
		const offset = start[0] * direction[1] - start[1] * direction[0];
		const key = `${round(direction[0])},${round(direction[1])}|${round(offset)}`;
		const group = groups.get(key) ?? { reference: start, direction, intervals: [] };
		const t0 = (start[0] - group.reference[0]) * direction[0] + (start[1] - group.reference[1]) * direction[1];
		const t1 = (end[0] - group.reference[0]) * direction[0] + (end[1] - group.reference[1]) * direction[1];
		group.intervals.push([Math.min(t0, t1), Math.max(t0, t1)]);
		groups.set(key, group);
	}
	const merged: PaperSegment[] = [];
	for (const group of groups.values()) {
		group.intervals.sort((left, right) => left[0] - right[0]);
		let [currentStart, currentEnd] = group.intervals[0]!;
		const emit = (): void => {
			merged.push([
				[group.reference[0] + group.direction[0] * currentStart, group.reference[1] + group.direction[1] * currentStart],
				[group.reference[0] + group.direction[0] * currentEnd, group.reference[1] + group.direction[1] * currentEnd]
			]);
		};
		for (const [start, end] of group.intervals.slice(1)) {
			if (start <= currentEnd + 1e-6) {
				currentEnd = Math.max(currentEnd, end);
			} else {
				emit();
				currentStart = start;
				currentEnd = end;
			}
		}
		emit();
	}
	return merged;
}

const UNION_EPSILON = 1e-9;
const UNION_ON_EDGE_EPSILON = 1e-6;
const UNION_SPLIT_EPSILON = 1e-7;

function clampParameter(value: number): number {
	if (value <= UNION_EPSILON) return 0;
	if (value >= 1 - UNION_EPSILON) return 1;
	return value;
}

/** The parameter on `a → b` where it crosses `c → d`, or null when it does not. */
function crossParameter(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2, d: LayoutVec2): number | null {
	const rx = b[0] - a[0];
	const rz = b[1] - a[1];
	const sx = d[0] - c[0];
	const sz = d[1] - c[1];
	const denominator = rx * sz - rz * sx;
	if (!(Math.abs(denominator) > UNION_EPSILON)) return null;
	const qx = c[0] - a[0];
	const qz = c[1] - a[1];
	const t = (qx * sz - qz * sx) / denominator;
	const u = (qx * rz - qz * rx) / denominator;
	if (t < -UNION_SPLIT_EPSILON || t > 1 + UNION_SPLIT_EPSILON) return null;
	if (u < -UNION_SPLIT_EPSILON || u > 1 + UNION_SPLIT_EPSILON) return null;
	return clampParameter(t);
}

/** Where a point lands on `a → b`, when it lies on that segment. */
function pointParameter(point: LayoutVec2, a: LayoutVec2, b: LayoutVec2): number | null {
	const dx = b[0] - a[0];
	const dz = b[1] - a[1];
	const lengthSquared = dx * dx + dz * dz;
	if (!(lengthSquared > UNION_EPSILON)) return null;
	const t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / lengthSquared;
	if (t < -UNION_SPLIT_EPSILON || t > 1 + UNION_SPLIT_EPSILON) return null;
	const px = a[0] + dx * t;
	const pz = a[1] + dz * t;
	if (Math.hypot(point[0] - px, point[1] - pz) > UNION_ON_EDGE_EPSILON) return null;
	return clampParameter(t);
}

function pointOnEdge(a: LayoutVec2, b: LayoutVec2, t: number): LayoutVec2 {
	if (t === 0) return a;
	if (t === 1) return b;
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Split an edge wherever another polygon crosses, touches or overlaps it. */
function splitParametersOfEdge(
	a: LayoutVec2,
	b: LayoutVec2,
	polygons: readonly UnionPolygon[],
	index: ReturnType<typeof unionPolygonIndex>
): number[] {
	const parameters = [0, 1];
	for (const polygonIndex of index.overlaps(paddedEdgeBounds(a, b))) {
		const polygon = polygons[polygonIndex]!;
		if (polygon.length < 3) continue;
		for (let index = 0; index < polygon.length; index += 1) {
			const c = polygon[index]!;
			const d = polygon[(index + 1) % polygon.length]!;
			const cross = crossParameter(a, b, c, d);
			if (cross !== null) parameters.push(cross);
		}
		// A T-junction or a collinear overlap has no strict crossing: its split is
		// the other polygon's vertex lying on this edge.
		for (const point of polygon) {
			const touched = pointParameter(point, a, b);
			if (touched !== null) parameters.push(touched);
		}
	}
	parameters.sort((left, right) => left - right);
	const unique: number[] = [];
	for (const parameter of parameters) {
		if (unique.length === 0 || parameter - unique[unique.length - 1]! > UNION_SPLIT_EPSILON) unique.push(parameter);
	}
	return unique;
}

export function unionOutline(polygons: readonly UnionPolygon[]): PaperSegment[] {
	const segments: PaperSegment[] = [];
	const seen = new Set<string>();
	const polygonIndex = unionPolygonIndex(polygons);
	for (const polygon of polygons) {
		if (polygon.length < 3) continue;
		for (let edgeIndex = 0; edgeIndex < polygon.length; edgeIndex += 1) {
			const a = polygon[edgeIndex]!;
			const b = polygon[(edgeIndex + 1) % polygon.length]!;
			const parameters = splitParametersOfEdge(a, b, polygons, polygonIndex);
			for (let split = 1; split < parameters.length; split += 1) {
				const start = pointOnEdge(a, b, parameters[split - 1]!);
				const end = pointOnEdge(a, b, parameters[split]!);
				const dx = end[0] - start[0];
				const dz = end[1] - start[1];
				const length = Math.hypot(dx, dz);
				if (!(length > UNION_SPLIT_EPSILON)) continue;
				const nx = -dz / length;
				const nz = dx / length;
				const probe = Math.min(0.001, Math.max(1e-7, length * 1e-4));
				const middle: LayoutVec2 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
				const left = pointInUnion([middle[0] + nx * probe, middle[1] + nz * probe], polygons, polygonIndex);
				const right = pointInUnion([middle[0] - nx * probe, middle[1] - nz * probe], polygons, polygonIndex);
				if (left === right) continue;
				const key = edgeKey(start, end);
				if (seen.has(key)) continue;
				seen.add(key);
				segments.push([start, end]);
			}
		}
	}
	return mergeCollinear(segments);
}

/**
 * Build the complete Paper drawing from one Plan evaluation, the compiled Layout
 * it was evaluated from, and Scene's existing footprint projection.
 *
 * `eligiblePlanFragments` is the same projection the Layout pick provider indexes,
 * so an excluded or unrevealed source contributes nothing to either. A revealed
 * source draws with its own stream treatment, exactly as it picks.
 */
export function buildPaperPlan(
	plan: PlanEvaluation,
	compiled: CompiledLayoutGeometry,
	projection: PlanSceneProjection,
	options: {
		readonly isFootprintMounted?: (entityId: string) => boolean;
		readonly datumMeters?: number;
	} = {}
): PaperPlanDrawing {
	const lines: PaperLineDraw[] = [];
	const fills: PaperFillDraw[] = [];

	eligiblePlanFragments(plan).forEach((fragment, index) => {
		const layer = fragmentLayer(fragment);
		const treatment = fragmentTreatment(fragment);
		const key = `paper:${fragment.ref.sourceId}:${index}`;
		if (treatment === 'room-floor') {
			const polygon = polygonOfFragment(fragment);
			if (polygon !== null && polygon.length >= 3) {
				fills.push({
					key,
					sourceId: fragment.ref.sourceId,
					layer: PAPER_LAYER.roomFloor,
					treatment: 'room-floor',
					elevationMeters: fragment.elevationMeters,
					polygons: [polygon]
				});
			}
			return;
		}
		if (treatment === 'cut') {
			const band = cutWallBandOf(fragment, compiled);
			if (band !== null) {
				fills.push({
					key,
					sourceId: fragment.ref.sourceId,
					layer: PAPER_LAYER.cut,
					treatment: 'cut',
					elevationMeters: fragment.elevationMeters,
					polygons: [band]
				});
				lines.push({
					key,
					sourceId: fragment.ref.sourceId,
					stream: fragment.ref.stream,
					layer,
					treatment,
					elevationMeters: fragment.elevationMeters,
					segments: ringSegments(band)
				});
				return;
			}
			const polygon = polygonOfFragment(fragment);
			if (polygon !== null && polygon.length >= 3) {
				fills.push({
					key,
					sourceId: fragment.ref.sourceId,
					layer: PAPER_LAYER.cut,
					treatment: 'cut',
					elevationMeters: fragment.elevationMeters,
					polygons: [polygon]
				});
			}
		}
		lines.push({
			key,
			sourceId: fragment.ref.sourceId,
			stream: fragment.ref.stream,
			layer,
			treatment,
			elevationMeters: fragment.elevationMeters,
			segments: fragmentSegments(fragment)
		});
	});

	const footprints: PaperFootprintDraw[] = projection.footprints
		.filter((footprint) => options.isFootprintMounted?.(footprint.entityId) ?? true)
		.map((footprint) => {
		const polygons =
			footprint.polygons !== undefined && footprint.polygons.length > 0
				? footprint.polygons
				: footprint.points.length >= 2
					? [footprint.points]
					: [];
		const segments =
			footprint.polygons !== undefined && footprint.polygons.length > 0
				? unionOutline(footprint.polygons)
				: ringSegments(footprint.points);
		return {
			key: `paper:footprint:${footprint.entityId}`,
			entityId: footprint.entityId,
			kind: footprint.kind,
			layer: PAPER_LAYER.sceneFootprint,
			treatment: 'footprint',
			elevationMeters: options.datumMeters ?? 0,
			segments,
			polygons
		};
	});

	return { lines, fills, footprints };
}

/**
 * The camera's layer mask for one Stage appearance.
 *
 * World geometry is layer 0 and every Canvas-drawn Stage overlay is layer 2.
 * Paper shows only its drawing; 3D and Shaded Plan show the world plus the
 * overlays that belong to them. Enabling both in the world case is deliberate:
 * later Stage overlays (S07's selection and hover) live on layer 2 and must be
 * visible on the mat without another mask decision here.
 */
export function stageCameraLayerMask(paperVisible: boolean): readonly number[] {
	return paperVisible ? [STAGE_OVERLAY_LAYER] : [STAGE_WORLD_LAYER, STAGE_OVERLAY_LAYER];
}

/** Whether the Paper layer is the visible Plan drawing. */
export function isPaperPlanVisible(
	evaluation: { readonly renderedReading: string; readonly orthographicWeight: number } | null,
	appearance: 'paper' | 'shaded'
): boolean {
	return appearance === 'paper' && evaluation !== null && evaluation.renderedReading === 'plan' && evaluation.orthographicWeight === 1;
}
