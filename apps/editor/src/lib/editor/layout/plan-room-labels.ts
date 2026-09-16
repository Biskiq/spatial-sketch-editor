/**
 * `plan-room-labels.ts` — P23.13 S3: the Room label free-space placer (spec §4).
 *
 * Room text is a **free-space layout problem, not a point-anchor problem**. This
 * module owns the whole presentation-side answer for one Plan frame:
 *
 * 1. project the canonical Room polygon to screen space,
 * 2. build a *label eligibility mask only* — core wall/opening bands (8 px),
 *    acquisition/handle zones (12 px) and active text (24 px) are subtracted from
 *    the eligible area; geometry, Room boundaries and topology are untouched,
 * 3. derive up to eight large free-space candidates, ranked by clearance then
 *    proximity to the Room's semantic center (canonical ID breaks ties),
 * 4. fit the **complete text rectangle** (concave-aware, not just its center),
 * 5. reduce tiers in the ratified drop order — area → reference → whole label —
 *    at the *existing* candidate before relocating to a distant pocket,
 * 6. keep the accepted candidate sticky through gestures and small pan/zoom,
 *    with a 12 px displacement cap, a reappearance gate and no animation.
 *
 * Nothing here is document truth: placement never writes the document, history
 * or the compile result, and a suppressed label is an honest absence — never a
 * forced overlap. Text extents come from an injected `TextMeasure`, so placement
 * is unit-testable on deterministic fixture metrics and never depends on host
 * fonts; the browser adapter supplies real metrics.
 */
import type { LayoutVec2 } from '$lib/layout/layout-types';
import {
	planScreenToWorld,
	worldToPlanScreen,
	type PlanViewportState
} from './layout-plan-transform';

/** The three text roles of a Room label stack, in display order. */
export type TextMeasureStyle = 'room-name' | 'room-reference' | 'room-area';

/** A measured text extent in CSS px (the adapter's only input to placement). */
export type TextExtent = { width: number; height: number };

/**
 * The ONE text-measurement seam. Production implements it with real browser
 * font metrics; placement tests inject deterministic fixtures. Placement never
 * reads a font itself.
 */
export type TextMeasure = (text: string, style: TextMeasureStyle) => TextExtent;

/** Per-style typography owned here and mirrored by the paint layer. */
export const ROOM_LABEL_TEXT_STYLES: Record<
	TextMeasureStyle,
	{ fontSizePx: number; lineHeightPx: number; weight: number }
> = {
	'room-name': { fontSizePx: 11, lineHeightPx: 13, weight: 600 },
	'room-reference': { fontSizePx: 10, lineHeightPx: 12, weight: 500 },
	'room-area': { fontSizePx: 10, lineHeightPx: 12, weight: 500 }
};

/**
 * Deterministic stand-in metrics (average advance ratio of the editor UI font).
 * Used only when no host measure is injected — e.g. a legacy/room-owned
 * document projected by a unit test — so placement stays pure and stable. The
 * viewport always injects the real browser measure.
 */
const APPROXIMATE_ADVANCE_RATIO = 0.56;
export const APPROXIMATE_TEXT_MEASURE: TextMeasure = (text, style) => ({
	width: text.length * ROOM_LABEL_TEXT_STYLES[style].fontSizePx * APPROXIMATE_ADVANCE_RATIO,
	height: ROOM_LABEL_TEXT_STYLES[style].lineHeightPx
});

/** Ratified §4 reserves, per obstacle class. */
export const ROOM_LABEL_CORE_GEOMETRY_RESERVE_PX = 8;
export const ROOM_LABEL_ACQUISITION_RESERVE_PX = 12;
export const ROOM_LABEL_ACTIVE_TEXT_RESERVE_PX = 24;
/** Names occupy at most two lines and never exceed this width. */
export const ROOM_LABEL_MAX_NAME_LINES = 2;
export const ROOM_LABEL_MAX_NAME_WIDTH_PX = 160;
/** Up to eight large free-space candidates per Room. */
export const ROOM_LABEL_MAX_CANDIDATES = 8;
/** A relocated label may not shift further than this before a tier is dropped. */
export const ROOM_LABEL_DISPLACEMENT_CAP_PX = 12;
/** Reappearance needs 8 px *additional* slack beyond a plain fit. */
export const ROOM_LABEL_REAPPEAR_CLEARANCE_PX = 8;
/** The settle delay is expressed as a settle *generation* (see the viewport). */
export const ROOM_LABEL_SETTLE_DELAY_MS = 150;
/** The fixed canvas readout is inset 12 px and bounded at 280 px. */
export const ROOM_LABEL_READOUT_INSET_PX = 12;
export const ROOM_LABEL_READOUT_MAX_WIDTH_PX = 280;
const ROOM_LABEL_MASK_CELL_PX = 8;
/** Cell-count budget; a huge Room coarsens the mask grid instead of exploding. */
const ROOM_LABEL_MASK_MAX_CELLS = 24_000;

export type RoomLabelTier = 'full' | 'name-reference' | 'name';
export type RoomLabelLineStyle = TextMeasureStyle;
export type RoomLabelLine = { text: string; style: RoomLabelLineStyle };

/** One Room's label input: compiled geometry + resolved display identity. */
export type RoomLabelFacts = {
	roomId: string;
	/** Canonical compiled floor polygon (world meters). */
	polygon: readonly LayoutVec2[];
	/** Authored name, or `null` when the Room has none. */
	name: string | null;
	/** Compact `R-XXXX` reference, or `null` when the ledger has none. */
	reference: string | null;
	/** Derived floor area in m², or `null` when unavailable. */
	areaM2: number | null;
};

/** A protected world edge (wall/opening band) with its screen reserve. */
export type RoomLabelProtectedEdge = {
	points: readonly LayoutVec2[];
	clearancePx: number;
};
/** A world polygon the text may not enter (authored object / control bounds). */
export type RoomLabelObstacle = {
	polygon: readonly LayoutVec2[];
	clearancePx: number;
};
/** A screen-constant acquisition zone (handle) as a world center + radius. */
export type RoomLabelAcquisitionZone = {
	center: LayoutVec2;
	radiusPx: number;
	clearancePx: number;
};
/** Active text (dimension/selection/feedback) already reserved in screen px. */
export type RoomLabelActiveText = {
	rect: ScreenRect;
	clearancePx: number;
};

export type ScreenRect = { minX: number; minY: number; maxX: number; maxY: number };

export type RoomLabelMask = {
	protectedEdges?: readonly RoomLabelProtectedEdge[];
	obstacles?: readonly RoomLabelObstacle[];
	acquisitionZones?: readonly RoomLabelAcquisitionZone[];
	activeText?: readonly RoomLabelActiveText[];
};

/** Why this resolution is happening. Only `geometry` permits free relocation. */
export type RoomLabelReconsiderReason = 'geometry' | 'lod' | 'frozen';

/** One resolved resting label, in screen space, ready for the paint adapter. */
export type PlacedRoomLabel = {
	roomId: string;
	tier: RoomLabelTier;
	/** Screen-space anchor: the center of the accepted text rectangle. */
	anchorScreen: LayoutVec2;
	/** World-space anchor (the same point), so pan/zoom moves it with the Room. */
	anchorWorld: LayoutVec2;
	lines: (RoomLabelLine & { baselineOffsetPx: number })[];
	/** Width of the accepted text rectangle (max line width). */
	widthPx: number;
	heightPx: number;
};

/** The fixed canvas readout payload for a selected Room (spec §4, A4). */
export type RoomLabelReadout = {
	roomId: string;
	primary: string;
	reference: string | null;
	area: string | null;
};

export type RoomLabelMemoryEntry = {
	tier: RoomLabelTier;
	anchorWorld: LayoutVec2;
	suppressed: boolean;
	/** Settle generation at which the label went absent (reappearance gate). */
	suppressedSettleGeneration: number;
};

/**
 * Sticky placement memory, keyed by compiled `roomId`. A memo of presentation
 * decisions — never document state, never persisted, never in history.
 */
export type RoomLabelMemory = Map<string, RoomLabelMemoryEntry>;

export type RoomLabelPlacementInput = {
	rooms: readonly RoomLabelFacts[];
	planView: PlanViewportState;
	measure?: TextMeasure;
	mask?: RoomLabelMask;
	/** The selected Room, when the selection is a Room (never a placement bias). */
	selectedRoomId?: string | null;
	reason?: RoomLabelReconsiderReason;
	/**
	 * Monotonic settle generation: the viewport advances it once after zoom and
	 * gesture activity has been quiet for 150 ms. Reappearance requires the
	 * generation to have advanced past the suppression.
	 */
	settleGeneration?: number;
	/** Sticky memory (mutated in place as a memo; pass the same instance back). */
	memory?: RoomLabelMemory;
};

export type RoomLabelPlacementResult = {
	labels: PlacedRoomLabel[];
	readout: RoomLabelReadout | null;
	memory: RoomLabelMemory;
};

/* ------------------------------------------------------------------ *
 * Area + identity text
 * ------------------------------------------------------------------ */

/**
 * The canonical area source for a Room label: the compiled floor polygon.
 * Display rounding never changes precision or dimensional input — this is a
 * presentation string only.
 */
export function roomFloorAreaM2(polygon: readonly LayoutVec2[]): number | null {
	if (polygon.length < 3) return null;
	let twiceArea = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const current = polygon[index]!;
		const next = polygon[(index + 1) % polygon.length]!;
		twiceArea += current[0] * next[1] - next[0] * current[1];
	}
	const area = Math.abs(twiceArea) / 2;
	return Number.isFinite(area) ? area : null;
}

/**
 * One decimal, and a positive value that rounds to zero reads `<0.1 m²` rather
 * than `0.0 m²` — a Room is never presented as empty by rounding.
 */
export function formatRoomArea(areaM2: number | null | undefined): string | null {
	if (areaM2 === null || areaM2 === undefined || !Number.isFinite(areaM2)) return null;
	if (areaM2 <= 0) return null;
	if (areaM2 < 0.05) return '<0.1 m²';
	return `${areaM2.toFixed(1)} m²`;
}

/* ------------------------------------------------------------------ *
 * Semantic center (carried over from the P23.6 point-anchor path)
 * ------------------------------------------------------------------ */

/**
 * The Room's **semantic center**: exact area centroid for convex faces, and for
 * a concave face whose centroid lands in a notch or outside, the largest ear
 * triangle's centroid (ear clipping over the simple polygon — always strictly
 * inside). Deterministic: ties keep the lowest vertex order. Used for candidate
 * *ranking* only; it is never a placement anchor any more.
 */
export function interiorLabelPoint(polygon: readonly LayoutVec2[]): LayoutVec2 {
	const mean: LayoutVec2 = [
		polygon.reduce((sum, point) => sum + point[0], 0) / polygon.length,
		polygon.reduce((sum, point) => sum + point[1], 0) / polygon.length
	];
	let twiceArea = 0;
	let cx = 0;
	let cz = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const current = polygon[index]!;
		const next = polygon[(index + 1) % polygon.length]!;
		const cross = current[0] * next[1] - next[0] * current[1];
		twiceArea += cross;
		cx += (current[0] + next[0]) * cross;
		cz += (current[1] + next[1]) * cross;
	}
	const centroid: LayoutVec2 =
		Math.abs(twiceArea) > 1e-12 ? [cx / (3 * twiceArea), cz / (3 * twiceArea)] : mean;
	if (pointStrictlyInside(polygon, centroid)) return centroid;
	// Concave face with an exterior centroid: largest ear wins.
	const orient = twiceArea >= 0 ? 1 : -1;
	const remaining = polygon.map((_, index) => index);
	let best: { area: number; point: LayoutVec2 } | null = null;
	const triArea2 = (a: LayoutVec2, b: LayoutVec2, c: LayoutVec2): number =>
		(b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
	const triCentroid = (a: LayoutVec2, b: LayoutVec2, c: LayoutVec2): LayoutVec2 => [
		(a[0] + b[0] + c[0]) / 3,
		(a[1] + b[1] + c[1]) / 3
	];
	for (let guard = 0; guard < polygon.length * polygon.length && remaining.length > 3; guard += 1) {
		let clipAt = -1;
		let clipArea = Number.POSITIVE_INFINITY;
		for (let slot = 0; slot < remaining.length; slot += 1) {
			const a = polygon[remaining[(slot + remaining.length - 1) % remaining.length]!]!;
			const b = polygon[remaining[slot]!]!;
			const c = polygon[remaining[(slot + 1) % remaining.length]!]!;
			// Convex under the face orientation?
			if (triArea2(a, b, c) * orient <= 0) continue;
			// Ear: no other vertex strictly inside the candidate triangle.
			let blocked = false;
			for (const other of remaining) {
				const p = polygon[other]!;
				if (p === a || p === b || p === c) continue;
				const s1 = triArea2(a, b, p) * orient;
				const s2 = triArea2(b, c, p) * orient;
				const s3 = triArea2(c, a, p) * orient;
				if (s1 > 0 && s2 > 0 && s3 > 0) {
					blocked = true;
					break;
				}
			}
			if (blocked) continue;
			const area = Math.abs(triArea2(a, b, c)) / 2;
			if (!best || area > best.area) best = { area, point: triCentroid(a, b, c) };
			if (area < clipArea) {
				clipArea = area;
				clipAt = slot;
			}
		}
		if (clipAt < 0) break;
		remaining.splice(clipAt, 1);
	}
	if (remaining.length === 3) {
		const [a, b, c] = remaining.map((index) => polygon[index]!) as [
			LayoutVec2,
			LayoutVec2,
			LayoutVec2
		];
		const area = Math.abs(triArea2(a, b, c)) / 2;
		if (!best || area > best.area) best = { area, point: triCentroid(a, b, c) };
	}
	return best?.point ?? mean;
}

/* ------------------------------------------------------------------ *
 * Stack + tiers
 * ------------------------------------------------------------------ */

/**
 * Wrap an authored name into at most two lines of at most 160 px. `null` when
 * the name cannot be carried at rest (an unbreakable token wider than the
 * budget) — the caller suppresses honestly and the selected readout shows the
 * full identity instead of every Room label expanding.
 */
export function wrapRoomName(
	name: string,
	measure: TextMeasure,
	maxWidthPx = ROOM_LABEL_MAX_NAME_WIDTH_PX
): string[] | null {
	const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
	if (words.length === 0) return null;
	const width = (text: string): number => measure(text, 'room-name').width;
	if (width(name) <= maxWidthPx) return [name];
	// An unbreakable token wider than the whole budget cannot be carried without
	// changing the authored name: the resting label suppresses instead.
	for (const word of words) {
		if (width(word) > maxWidthPx) return null;
	}
	const lines: string[] = [];
	let current = words[0]!;
	for (let index = 1; index < words.length; index += 1) {
		const word = words[index]!;
		if (width(`${current} ${word}`) <= maxWidthPx) {
			current = `${current} ${word}`;
			continue;
		}
		lines.push(current);
		// A third line is never permitted.
		if (lines.length === ROOM_LABEL_MAX_NAME_LINES) return null;
		current = word;
	}
	lines.push(current);
	return lines.length <= ROOM_LABEL_MAX_NAME_LINES ? lines : null;
}

/**
 * Every stack this Room may rest as, in the ratified drop order: area first,
 * then the reference, then the whole label. Duplicate stacks collapse, so an
 * unnamed Room never has a phantom "reference" tier.
 */
function stacksForRoom(facts: RoomLabelFacts, measure: TextMeasure): RoomLabelLine[][] {
	const nameLines = facts.name === null ? null : wrapRoomName(facts.name, measure);
	if (nameLines === null) return [];
	const name: RoomLabelLine[] = nameLines.map((text) => ({ text, style: 'room-name' as const }));
	const areaText = formatRoomArea(facts.areaM2);
	const reference: RoomLabelLine[] = facts.reference === null ? [] : [{ text: facts.reference, style: 'room-reference' }];
	const area: RoomLabelLine[] = areaText === null ? [] : [{ text: areaText, style: 'room-area' }];
	const candidates: RoomLabelLine[][] = [
		[...name, ...reference, ...area],
		[...name, ...reference],
		[...name]
	];
	const unique: RoomLabelLine[][] = [];
	for (const stack of candidates) {
		const key = stack.map((line) => `${line.style}:${line.text}`).join('|');
		if (unique.some((existing) => existing.map((line) => `${line.style}:${line.text}`).join('|') === key)) continue;
		unique.push(stack);
	}
	return unique;
}

function tierOfStack(stack: readonly RoomLabelLine[]): RoomLabelTier {
	if (stack.some((line) => line.style === 'room-area')) return 'full';
	if (stack.some((line) => line.style === 'room-reference')) return 'name-reference';
	return 'name';
}

/* ------------------------------------------------------------------ *
 * Geometry helpers (screen space)
 * ------------------------------------------------------------------ */

function pointStrictlyInside(polygon: readonly LayoutVec2[], point: LayoutVec2): boolean {
	let inside = false;
	for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
		const a = polygon[index]!;
		const b = polygon[previous]!;
		if (a[1] > point[1] !== b[1] > point[1]) {
			const x = ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];
			if (point[0] < x) inside = !inside;
		}
	}
	return inside;
}

function edgeDistance(point: LayoutVec2, a: LayoutVec2, b: LayoutVec2): number {
	const dx = b[0] - a[0];
	const dz = b[1] - a[1];
	const lengthSquared = dx * dx + dz * dz;
	if (lengthSquared <= 1e-12) return Math.hypot(point[0] - a[0], point[1] - a[1]);
	let t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / lengthSquared;
	t = Math.min(1, Math.max(0, t));
	return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dz));
}

function polygonEdges(polygon: readonly LayoutVec2[]): [LayoutVec2, LayoutVec2][] {
	const edges: [LayoutVec2, LayoutVec2][] = [];
	for (let index = 0; index < polygon.length; index += 1) {
		edges.push([polygon[index]!, polygon[(index + 1) % polygon.length]!]);
	}
	return edges;
}

function polylineDistance(point: LayoutVec2, points: readonly LayoutVec2[]): number {
	if (points.length === 0) return Number.POSITIVE_INFINITY;
	if (points.length === 1) return Math.hypot(point[0] - points[0]![0], point[1] - points[0]![1]);
	let best = Number.POSITIVE_INFINITY;
	for (let index = 1; index < points.length; index += 1) {
		best = Math.min(best, edgeDistance(point, points[index - 1]!, points[index]!));
	}
	return best;
}

function polygonBoundaryDistance(point: LayoutVec2, polygon: readonly LayoutVec2[]): number {
	return polylineDistance(point, [...polygon, polygon[0]!]);
}

function segmentsIntersect(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2, d: LayoutVec2): boolean {
	const orient = (p: LayoutVec2, q: LayoutVec2, r: LayoutVec2): number =>
		(q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
	const o1 = orient(a, b, c);
	const o2 = orient(a, b, d);
	const o3 = orient(c, d, a);
	const o4 = orient(c, d, b);
	return o1 * o2 < 0 && o3 * o4 < 0;
}

function rectCorners(rect: ScreenRect): LayoutVec2[] {
	return [
		[rect.minX, rect.minY],
		[rect.maxX, rect.minY],
		[rect.maxX, rect.maxY],
		[rect.minX, rect.maxY]
	];
}

/** Distance from a point to a rect (0 when inside). */
function rectPointDistance(rect: ScreenRect, point: LayoutVec2): number {
	const dx = Math.max(rect.minX - point[0], 0, point[0] - rect.maxX);
	const dy = Math.max(rect.minY - point[1], 0, point[1] - rect.maxY);
	return Math.hypot(dx, dy);
}

/**
 * `true` when the rect is clear of a polygon by `clearancePx`. Corner/vertex/edge
 * sampling — an honest apron test for a readability mask, never offered as exact
 * Minkowski distance.
 */
function rectClearsPolygon(rect: ScreenRect, polygon: readonly LayoutVec2[], clearancePx: number): boolean {
	if (polygon.length === 0) return true;
	const corners = rectCorners(rect);
	for (const corner of corners) {
		if (pointStrictlyInside(polygon, corner)) return false;
		if (polygonBoundaryDistance(corner, polygon) < clearancePx - 1e-9) return false;
	}
	for (const vertex of polygon) {
		if (
			vertex[0] >= rect.minX &&
			vertex[0] <= rect.maxX &&
			vertex[1] >= rect.minY &&
			vertex[1] <= rect.maxY
		) {
			return false;
		}
		if (rectPointDistance(rect, vertex) < clearancePx - 1e-9) return false;
	}
	for (const [a, b] of polygonEdges(polygon)) {
		for (let index = 0; index < corners.length; index += 1) {
			if (segmentsIntersect(a, b, corners[index]!, corners[(index + 1) % corners.length]!)) {
				return false;
			}
		}
	}
	return true;
}

function rectClearsEdge(rect: ScreenRect, points: readonly LayoutVec2[], clearancePx: number): boolean {
	if (points.length === 0) return true;
	for (const corner of rectCorners(rect)) {
		if (polylineDistance(corner, points) < clearancePx - 1e-9) return false;
	}
	for (const point of points) {
		if (rectPointDistance(rect, point) < clearancePx - 1e-9) return false;
	}
	const corners = rectCorners(rect);
	for (let index = 1; index < points.length; index += 1) {
		const a = points[index - 1]!;
		const b = points[index]!;
		for (let slot = 0; slot < corners.length; slot += 1) {
			if (segmentsIntersect(a, b, corners[slot]!, corners[(slot + 1) % corners.length]!)) {
				return false;
			}
		}
	}
	return true;
}

/** Signed slack of the rect against one screen-space obstacle set: ≥0 is a fit. */
function rectSlack(
	rect: ScreenRect,
	polygonScreen: readonly LayoutVec2[],
	mask: {
		protectedEdges: { points: LayoutVec2[]; clearancePx: number }[];
		obstacles: { polygon: LayoutVec2[]; clearancePx: number }[];
		acquisition: { center: LayoutVec2; radiusPx: number; clearancePx: number }[];
		activeText: RoomLabelActiveText[];
	}
): number {
	let slack = Number.POSITIVE_INFINITY;
	const corners = rectCorners(rect);
	// Core geometry: the Room polygon itself is the wall interior face.
	for (const corner of corners) {
		if (!pointStrictlyInside(polygonScreen, corner)) return Number.NEGATIVE_INFINITY;
		slack = Math.min(slack, polygonBoundaryDistance(corner, polygonScreen));
	}
	for (const [a, b] of polygonEdges(polygonScreen)) {
		for (let index = 0; index < corners.length; index += 1) {
			if (segmentsIntersect(a, b, corners[index]!, corners[(index + 1) % corners.length]!)) {
				return Number.NEGATIVE_INFINITY;
			}
		}
	}
	slack -= ROOM_LABEL_CORE_GEOMETRY_RESERVE_PX;
	if (slack < 0) return slack;
	for (const edge of mask.protectedEdges) {
		if (!rectClearsEdge(rect, edge.points, edge.clearancePx)) return Number.NEGATIVE_INFINITY;
		let best = Number.POSITIVE_INFINITY;
		for (const corner of corners) best = Math.min(best, polylineDistance(corner, edge.points));
		slack = Math.min(slack, best - edge.clearancePx);
	}
	for (const obstacle of mask.obstacles) {
		if (!rectClearsPolygon(rect, obstacle.polygon, obstacle.clearancePx)) return Number.NEGATIVE_INFINITY;
		let best = Number.POSITIVE_INFINITY;
		for (const corner of corners) best = Math.min(best, polygonBoundaryDistance(corner, obstacle.polygon));
		slack = Math.min(slack, best - obstacle.clearancePx);
	}
	for (const zone of mask.acquisition) {
		for (const corner of corners) {
			const distance = Math.hypot(corner[0] - zone.center[0], corner[1] - zone.center[1]);
			slack = Math.min(slack, distance - zone.radiusPx - zone.clearancePx);
		}
	}
	for (const text of mask.activeText) {
		const inflated: ScreenRect = {
			minX: text.rect.minX - text.clearancePx,
			minY: text.rect.minY - text.clearancePx,
			maxX: text.rect.maxX + text.clearancePx,
			maxY: text.rect.maxY + text.clearancePx
		};
		const overlapping =
			rect.minX < inflated.maxX &&
			rect.maxX > inflated.minX &&
			rect.minY < inflated.maxY &&
			rect.maxY > inflated.minY;
		if (overlapping) return Number.NEGATIVE_INFINITY;
		slack = Math.min(
			slack,
			Math.min(
				rectPointDistance(inflated, [rect.minX, rect.minY]),
				rectPointDistance(inflated, [rect.maxX, rect.minY]),
				rectPointDistance(inflated, [rect.minX, rect.maxY]),
				rectPointDistance(inflated, [rect.maxX, rect.maxY])
			)
		);
	}
	return slack;
}

/* ------------------------------------------------------------------ *
 * The placer
 * ------------------------------------------------------------------ */

type ScreenMask = {
	protectedEdges: { points: LayoutVec2[]; clearancePx: number }[];
	obstacles: { polygon: LayoutVec2[]; clearancePx: number }[];
	acquisition: { center: LayoutVec2; radiusPx: number; clearancePx: number }[];
	activeText: RoomLabelActiveText[];
};

function projectMask(mask: RoomLabelMask | undefined, planView: PlanViewportState): ScreenMask {
	return {
		protectedEdges: (mask?.protectedEdges ?? []).map((edge) => ({
			points: edge.points.map((point) => worldToPlanScreen(planView, point)),
			clearancePx: edge.clearancePx
		})),
		obstacles: (mask?.obstacles ?? []).map((obstacle) => ({
			polygon: obstacle.polygon.map((point) => worldToPlanScreen(planView, point)),
			clearancePx: obstacle.clearancePx
		})),
		acquisition: (mask?.acquisitionZones ?? []).map((zone) => ({
			center: worldToPlanScreen(planView, zone.center),
			radiusPx: zone.radiusPx,
			clearancePx: zone.clearancePx
		})),
		activeText: [...(mask?.activeText ?? [])]
	};
}

/** Screen-space slack at one point (≥0 eligible), used by the mask grid. */
function pointSlack(
	point: LayoutVec2,
	polygonScreen: readonly LayoutVec2[],
	mask: ScreenMask
): number {
	if (!pointStrictlyInside(polygonScreen, point)) return Number.NEGATIVE_INFINITY;
	let slack = polygonBoundaryDistance(point, polygonScreen) - ROOM_LABEL_CORE_GEOMETRY_RESERVE_PX;
	if (slack < 0) return slack;
	for (const edge of mask.protectedEdges) {
		slack = Math.min(slack, polylineDistance(point, edge.points) - edge.clearancePx);
	}
	for (const obstacle of mask.obstacles) {
		slack = Math.min(slack, polygonBoundaryDistance(point, obstacle.polygon) - obstacle.clearancePx);
	}
	for (const zone of mask.acquisition) {
		slack = Math.min(
			slack,
			Math.hypot(point[0] - zone.center[0], point[1] - zone.center[1]) -
				zone.radiusPx -
				zone.clearancePx
		);
	}
	for (const text of mask.activeText) {
		const inflated: ScreenRect = {
			minX: text.rect.minX - text.clearancePx,
			minY: text.rect.minY - text.clearancePx,
			maxX: text.rect.maxX + text.clearancePx,
			maxY: text.rect.maxY + text.clearancePx
		};
		slack = Math.min(slack, rectPointDistance(inflated, point));
	}
	return slack;
}

type FreeCandidate = { point: LayoutVec2; clearance: number };

/**
 * Derive up to eight large free-space candidates from the Room's projected
 * polygon minus the eligibility mask. Connected components of eligible cells
 * give the *free-space components*; each component contributes the cell with the
 * greatest clearance, and the largest components are kept. Ranked by clearance,
 * then proximity to the semantic center — invariant to Room document order.
 */
function freeSpaceCandidates(
	polygonScreen: readonly LayoutVec2[],
	mask: ScreenMask,
	measure: TextMeasure,
	centerScreen: LayoutVec2
): FreeCandidate[] {
	const minX = Math.min(...polygonScreen.map(([x]) => x));
	const maxX = Math.max(...polygonScreen.map(([x]) => x));
	const minZ = Math.min(...polygonScreen.map(([, z]) => z));
	const maxZ = Math.max(...polygonScreen.map(([, z]) => z));
	const widthPx = maxX - minX;
	const heightPx = maxZ - minZ;
	if (!(widthPx > 0) || !(heightPx > 0)) return [];
	const cell = Math.max(
		ROOM_LABEL_MASK_CELL_PX,
		Math.ceil(Math.sqrt((widthPx * heightPx) / ROOM_LABEL_MASK_MAX_CELLS))
	);
	const columns = Math.max(1, Math.ceil(widthPx / cell));
	const rows = Math.max(1, Math.ceil(heightPx / cell));
	const slack = new Float64Array(columns * rows).fill(Number.NEGATIVE_INFINITY);
	for (let column = 0; column < columns; column += 1) {
		for (let row = 0; row < rows; row += 1) {
			const point: LayoutVec2 = [minX + (column + 0.5) * cell, minZ + (row + 0.5) * cell];
			slack[row * columns + column] = pointSlack(point, polygonScreen, mask);
		}
	}
	const visited = new Uint8Array(columns * rows);
	const components: { best: FreeCandidate; size: number }[] = [];
	for (let start = 0; start < slack.length; start += 1) {
		if (visited[start] === 1 || slack[start]! < 0) continue;
		visited[start] = 1;
		const queue = [start];
		let size = 0;
		let bestValue = Number.NEGATIVE_INFINITY;
		let bestCenterDistance = Number.POSITIVE_INFINITY;
		let bestPoint: LayoutVec2 = [0, 0];
		while (queue.length > 0) {
			const index = queue.pop()!;
			size += 1;
			const column = index % columns;
			const row = Math.floor(index / columns);
			const point: LayoutVec2 = [minX + (column + 0.5) * cell, minZ + (row + 0.5) * cell];
			const value = slack[index]!;
			// A component's representative point is its greatest-clearance cell,
			// and among equal clearance the one nearest the semantic center — never
			// the arbitrary first cell a traversal happens to visit. A symmetric
			// Room ties along its bottleneck axis, so without this the label could
			// sit a half-cell to one side for no visible reason.
			const centerDistance = Math.hypot(point[0] - centerScreen[0], point[1] - centerScreen[1]);
			if (
				value > bestValue + 1e-9 ||
				(Math.abs(value - bestValue) <= 1e-9 && centerDistance < bestCenterDistance - 1e-9)
			) {
				bestValue = value;
				bestCenterDistance = centerDistance;
				bestPoint = point;
			}
			const neighbours = [
				column > 0 ? index - 1 : -1,
				column < columns - 1 ? index + 1 : -1,
				row > 0 ? index - columns : -1,
				row < rows - 1 ? index + columns : -1
			];
			for (const neighbour of neighbours) {
				if (neighbour < 0 || visited[neighbour] === 1 || slack[neighbour]! < 0) continue;
				visited[neighbour] = 1;
				queue.push(neighbour);
			}
		}
		components.push({ best: { point: bestPoint, clearance: bestValue }, size });
	}
	// "Large free-space": the biggest components first, then clearance, then the
	// semantic center. Ties resolve on the candidate point, so the ranking is a
	// pure function of the geometry (no document-order dependence).
	components.sort((a, b) => b.size - a.size || b.best.clearance - a.best.clearance);
	const ranked = components
		.slice(0, ROOM_LABEL_MAX_CANDIDATES)
		.sort(
			(a, b) =>
				b.best.clearance - a.best.clearance ||
				Math.hypot(a.best.point[0] - centerScreen[0], a.best.point[1] - centerScreen[1]) -
					Math.hypot(b.best.point[0] - centerScreen[0], b.best.point[1] - centerScreen[1]) ||
				a.best.point[0] - b.best.point[0] ||
				a.best.point[1] - b.best.point[1]
		);
	return ranked.map((component) => component.best);
}

/** Screen-space text rectangle for a stack, centered on a candidate point. */
function stackRect(
	lines: readonly RoomLabelLine[],
	measure: TextMeasure,
	point: LayoutVec2
): { rect: ScreenRect; widthPx: number; heightPx: number; baselines: number[] } {
	let widthPx = 0;
	let heightPx = 0;
	const heights: number[] = [];
	for (const line of lines) {
		const extent = measure(line.text, line.style);
		const lineHeightPx = Math.max(extent.height, ROOM_LABEL_TEXT_STYLES[line.style].lineHeightPx);
		widthPx = Math.max(widthPx, extent.width);
		heights.push(lineHeightPx);
		heightPx += lineHeightPx;
	}
	const rect: ScreenRect = {
		minX: point[0] - widthPx / 2,
		maxX: point[0] + widthPx / 2,
		minY: point[1] - heightPx / 2,
		maxY: point[1] + heightPx / 2
	};
	const baselines: number[] = [];
	let cursor = rect.minY;
	for (let index = 0; index < lines.length; index += 1) {
		const lineHeightPx = heights[index]!;
		// Baseline sits on the text's own baseline inside its line box; ~0.8em of
		// the box is above the baseline for the editor UI font.
		const ascent = ROOM_LABEL_TEXT_STYLES[lines[index]!.style].fontSizePx * 0.8;
		baselines.push(cursor + (lineHeightPx + ascent) / 2 - point[1]);
		cursor += lineHeightPx;
	}
	return { rect, widthPx, heightPx, baselines };
}

function duplicateProtected(facts: RoomLabelFacts, all: readonly RoomLabelFacts[]): boolean {
	if (facts.name === null || facts.reference === null) return false;
	return all.some(
		(other) => other.roomId !== facts.roomId && other.name === facts.name && other.reference !== null
	);
}

/**
 * Resolve every resting Room label + the optional selected-Room readout for one
 * Plan frame. Pure apart from the sticky `memory` memo it is handed.
 */
export function placeRoomLabels(input: RoomLabelPlacementInput): RoomLabelPlacementResult {
	const measure = input.measure ?? APPROXIMATE_TEXT_MEASURE;
	const planView = input.planView;
	const mask = projectMask(input.mask, planView);
	const reason = input.reason ?? 'lod';
	const settleGeneration = input.settleGeneration ?? 0;
	const memory = input.memory ?? new Map<string, RoomLabelMemoryEntry>();
	const selectedRoomId = input.selectedRoomId ?? null;
	const labels: PlacedRoomLabel[] = [];
	let readout: RoomLabelReadout | null = null;
	const liveRoomIds = new Set<string>();

	for (const facts of input.rooms) {
		liveRoomIds.add(facts.roomId);
		const stacks = stacksForRoom(facts, measure);
		const suppressedSince = memory.get(facts.roomId)?.suppressedSettleGeneration ?? settleGeneration;
		if (stacks.length === 0) {
			// No name at rest (or a name no two-line budget can carry): honest absence.
			// A selected Room still gets its full identity, in the fixed readout.
			memory.set(facts.roomId, {
				tier: 'name',
				anchorWorld: facts.polygon[0] ? [...facts.polygon[0]] : [0, 0],
				suppressed: true,
				suppressedSettleGeneration: suppressedSince
			});
			if (selectedRoomId === facts.roomId) {
				readout = {
					roomId: facts.roomId,
					primary: facts.name ?? facts.reference ?? facts.roomId,
					reference: facts.reference,
					area: formatRoomArea(facts.areaM2)
				};
			}
			continue;
		}
		const duplicate = duplicateProtected(facts, input.rooms);
		// Duplicates protect name + reference as a pair, and a selected Room must keep
		// its complete identity at rest: in both cases the reference is never the line
		// that gets dropped. Anything the resting stack still cannot carry is the fixed
		// readout's job — never a forced overlap, never a centroid override.
		const requireReference = duplicate || selectedRoomId === facts.roomId;
		const eligible = requireReference
			? stacks.filter((stack) => stack.some((line) => line.style === 'room-reference'))
			: stacks;
		if (eligible.length === 0) eligible.push(stacks[0]!);
		const polygonScreen = facts.polygon.map((point) => worldToPlanScreen(planView, point));
		if (polygonScreen.length < 3) continue;
		const centerScreen = worldToPlanScreen(planView, interiorLabelPoint(facts.polygon));
		const accepted = memory.get(facts.roomId);

		const resolve = (
			point: LayoutVec2,
			candidateStackList: readonly RoomLabelLine[][]
		): { stack: RoomLabelLine[]; fit: ReturnType<typeof stackRect>; slack: number } | null => {
			for (const stack of candidateStackList) {
				const fit = stackRect(stack, measure, point);
				const slack = rectSlack(fit.rect, polygonScreen, mask);
				if (slack >= 0) return { stack, fit, slack };
			}
			return null;
		};

		const relocated = reason === 'geometry' ? null : accepted;
		let resolved: { stack: RoomLabelLine[]; fit: ReturnType<typeof stackRect>; slack: number } | null = null;
		let anchorScreen: LayoutVec2 | null = null;

		if (reason === 'frozen' && accepted) {
			// During a live gesture the accepted candidate is preserved exactly:
			// geometry keeps being judged, the text vocabulary does not shift under
			// the pointer and no pointermove re-optimizes the layout.
			if (!accepted.suppressed) {
				const anchor = worldToPlanScreen(planView, accepted.anchorWorld);
				resolved = resolve(anchor, stacks.filter((stack) => tierOfStack(stack) === accepted.tier));
				anchorScreen = anchor;
			}
		} else {
			const candidates: FreeCandidate[] = freeSpaceCandidates(
				polygonScreen,
				mask,
				measure,
				centerScreen
			);
			// 1) the sticky candidate first — tier reduction at the existing
			// candidate is preferred over relocating to a distant pocket.
			if (relocated) {
				const anchor = worldToPlanScreen(planView, relocated.anchorWorld);
				resolved = resolve(anchor, eligible);
				anchorScreen = anchor;
			}
			// 2) then the full stack at any candidate ("a candidate that fits the
			// full stack first"), then tier reduction in candidate rank order.
			if (!resolved) {
				const full = eligible[0]!;
				for (const candidate of candidates) {
					const fit = stackRect(full, measure, candidate.point);
					const slack = rectSlack(fit.rect, polygonScreen, mask);
					if (slack >= 0) {
						resolved = { stack: full, fit, slack };
						anchorScreen = candidate.point;
						break;
					}
				}
			}
			if (!resolved) {
				for (const candidate of candidates) {
					const result = resolve(candidate.point, eligible.slice(1));
					if (result) {
						resolved = result;
						anchorScreen = candidate.point;
						break;
					}
				}
			}
			// 3) a relocation further than the displacement cap forces one tier drop
			// at the accepted candidate first.
			if (resolved && relocated && anchorScreen) {
				const acceptedScreen = worldToPlanScreen(planView, relocated.anchorWorld);
				const displacement = Math.hypot(
					anchorScreen[0] - acceptedScreen[0],
					anchorScreen[1] - acceptedScreen[1]
				);
				if (displacement > ROOM_LABEL_DISPLACEMENT_CAP_PX) {
					const acceptedIndex = eligible.findIndex(
						(stack) => tierOfStack(stack) === relocated.tier
					);
					const reduced = eligible.slice(Math.max(acceptedIndex, 0) + 1);
					const atAccepted = reduced.length > 0 ? resolve(acceptedScreen, reduced) : null;
					if (atAccepted) {
						resolved = atAccepted;
						anchorScreen = acceptedScreen;
					} else if (reduced.length > 0) {
						const atCandidate = resolve(anchorScreen, reduced);
						if (!atCandidate) resolved = null;
						else resolved = atCandidate;
					}
				}
			}
		}

		const suppressedAt =
			accepted?.suppressed === true ? accepted.suppressedSettleGeneration : null;
		if (resolved && anchorScreen && suppressedAt !== null) {
			// Reappearance gate: 8 px of extra slack, and only after the settle
			// generation has advanced past the suppression (the viewport advances it
			// 150 ms after zoom/gesture activity stops).
			if (
				resolved.slack < ROOM_LABEL_REAPPEAR_CLEARANCE_PX ||
				settleGeneration <= suppressedAt
			) {
				resolved = null;
			}
		}

		if (resolved && anchorScreen) {
			const anchorWorld = planScreenToWorld(planView, anchorScreen);
			memory.set(facts.roomId, {
				tier: tierOfStack(resolved.stack),
				anchorWorld,
				suppressed: false,
				suppressedSettleGeneration: 0
			});
			labels.push({
				roomId: facts.roomId,
				tier: tierOfStack(resolved.stack),
				anchorScreen,
				anchorWorld,
				lines: resolved.stack.map((line, index) => ({
					...line,
					baselineOffsetPx: resolved!.fit.baselines[index] ?? 0
				})),
				widthPx: resolved.fit.widthPx,
				heightPx: resolved.fit.heightPx
			});
		} else {
			memory.set(facts.roomId, {
				tier: accepted?.tier ?? 'name',
				anchorWorld: accepted
					? [...accepted.anchorWorld]
					: polygonScreen[0]
						? planScreenToWorld(planView, polygonScreen[0])
						: [0, 0],
				suppressed: true,
				// The generation the label went absent in: reappearance waits for the
				// next settle generation (150 ms of quiet) *and* 8 px of extra slack.
				suppressedSettleGeneration: suppressedAt ?? settleGeneration
			});
			if (selectedRoomId === facts.roomId) {
				readout = {
					roomId: facts.roomId,
					primary: facts.name ?? facts.reference ?? facts.roomId,
					reference: facts.reference,
					area: formatRoomArea(facts.areaM2)
				};
			}
		}
		// A selected Room whose resting stack cannot carry the reference (or its
		// area) gets the fixed readout as the honest completion, never a forced
		// overlap and never a centroid override.
		if (selectedRoomId === facts.roomId && readout === null && resolved) {
			const carried = new Set(resolved.stack.map((line) => line.style));
			if (facts.reference !== null && !carried.has('room-reference')) {
				readout = {
					roomId: facts.roomId,
					primary: facts.name ?? facts.reference,
					reference: facts.reference,
					area: formatRoomArea(facts.areaM2)
				};
			}
		}
	}

	for (const roomId of [...memory.keys()]) {
		if (!liveRoomIds.has(roomId)) memory.delete(roomId);
	}
	return { labels, readout, memory };
}

/**
 * Ordered label lines as paint-ready text primitives: a screen-constant stacked
 * stack (name / reference / area) sharing one world anchor.
 */
export function roomLabelLinesToPrimitives(
	label: PlacedRoomLabel,
	keyFor: (lineIndex: number) => string
): { key: string; anchor: LayoutVec2; text: string; style: RoomLabelLineStyle; offsetPx: [number, number] }[] {
	return label.lines.map((line, index) => ({
		key: keyFor(index),
		anchor: label.anchorWorld,
		text: line.text,
		style: line.style,
		offsetPx: [0, line.baselineOffsetPx] as [number, number]
	}));
}
