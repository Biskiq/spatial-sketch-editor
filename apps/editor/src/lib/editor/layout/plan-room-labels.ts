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
import {
	p23bM1BeginRoomLabelValueDigest,
	p23bM1DigestNumber,
	p23bM1DigestString,
	p23bM1EndRoomLabelCall,
	p23bM1EndRoomLabelValueDigest,
	p23bM1MemoizedGridCandidates,
	p23bM1RecordRoomLabelCall,
	p23bM1RoomLabelArm
} from './p23b-m1-room-label-arm';

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

/** Screen-space instrument zone plus the tier ceiling it imposes (S8 / §1.12). */
export type RoomLabelTierDropZone = {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	ceiling: RoomLabelTier;
};

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
	/**
	 * P23.13 S8 / §1.12 — the instrument zone (see `plan-attention.ts`): inside
	 * these screen bounds a label may not rest at a tier above `ceiling`.
	 *
	 * The test is on the *accepted anchor*, so the rule is region-scoped on its
	 * own terms: a label outside the zone keeps its full stack, and the zone
	 * cannot quietly re-tier the whole plan. The ceiling is a preference, not a
	 * truth — if the reduced stack does not fit the anchor that the fuller one
	 * fits, the fuller one stays, because a label that fits beats a label that is
	 * merely quieter.
	 */
	tierDropZone?: RoomLabelTierDropZone;
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

/** Drop order, richest first: a higher rank is *less* identity, not more. */
const TIER_RANK: Readonly<Record<RoomLabelTier, number>> = {
	full: 0,
	'name-reference': 1,
	name: 2
};

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

/**
 * A lower bound on `edgeDistance(point, a, b)`, from the segment's own bounding
 * box — cheap, exact and never an overestimate, so a segment it prunes can never
 * have held the minimum.
 *
 * WHY IT EXISTS (measured, not guessed). The post-release window of the M1
 * protocol is dominated by this module's eligibility grid, and a V8 CPU profile
 * puts 39.5 % of that window's sampled time in `edgeDistance` itself on the
 * all-curved fixture (`p23b-40-wall-all-curved-v1`, `rigid-wall-drag`). A curved
 * Room's boundary is a long polyline, so the grid was asking for the exact
 * distance to every one of its vertices from every cell: the cell count is capped
 * (24 000) but the vertex count is not. A point's distance to a polyline is set by
 * the few segments next to it, and the box test is what says so before the two
 * `Math.hypot`s are paid.
 */
function segmentLowerBound(point: LayoutVec2, a: LayoutVec2, b: LayoutVec2): number {
	// Distance from the point to the segment's own bounding box, per axis: zero
	// inside the interval, and the gap to the NEAR edge outside it. The near edge is
	// why both terms are needed — `lo − point` and `point − hi`, never `point − lo`,
	// which is the distance to the far edge and would prune segments that hold the
	// minimum. (That exact slip cost this change 16 failing placement tests before
	// the term was rewritten.)
	const dx = Math.max(0, Math.min(a[0], b[0]) - point[0], point[0] - Math.max(a[0], b[0]));
	const dz = Math.max(0, Math.min(a[1], b[1]) - point[1], point[1] - Math.max(a[1], b[1]));
	return Math.max(dx, dz);
}

function polylineDistance(point: LayoutVec2, points: readonly LayoutVec2[]): number {
	if (points.length === 0) return Number.POSITIVE_INFINITY;
	if (points.length === 1) return Math.hypot(point[0] - points[0]![0], point[1] - points[0]![1]);
	let best = Number.POSITIVE_INFINITY;
	for (let index = 1; index < points.length; index += 1) {
		const a = points[index - 1]!;
		const b = points[index]!;
		if (segmentLowerBound(point, a, b) >= best) continue;
		best = Math.min(best, edgeDistance(point, a, b));
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

/**
 * Screen-space slack at one point (≥0 eligible), used by the mask grid.
 *
 * WHAT A NEGATIVE RETURN MEANS, stated precisely because it is what makes the early
 * exits below decision-neutral. The grid stores this value per cell and its
 * readers are: `slack[i] < 0` (eligible or not) and, for cells that passed that
 * test, the value itself as a clearance to rank with. A cell that failed any one
 * obstacle is ineligible, and its magnitude is never read — so the first failing
 * term may end the walk and answer, which is what the measurement wanted: on the
 * all-curved fixture most cells are near a wall or an edge band and were paying
 * for every later obstacle's exact distance before being discarded, and a V8 CPU
 * profile puts 39.5 % of the post-release window in that discarded arithmetic.
 * Eligible cells are unaffected: for them every term still runs and the same
 * minimum comes back, bit for bit.
 */
function pointSlack(
	point: LayoutVec2,
	polygonScreen: readonly LayoutVec2[],
	mask: ScreenMask,
	/** Active-text rects already inflated by their clearance, once per placement. */
	inflatedText: readonly ScreenRect[],
	/** Whether this cell is inside the face — computed per ROW, see `insideFlags`. */
	inside: boolean
): number {
	if (!inside) return Number.NEGATIVE_INFINITY;
	let slack = polygonBoundaryDistance(point, polygonScreen) - ROOM_LABEL_CORE_GEOMETRY_RESERVE_PX;
	if (slack < 0) return slack;
	for (const edge of mask.protectedEdges) {
		slack = Math.min(slack, polylineDistance(point, edge.points) - edge.clearancePx);
		if (slack < 0) return slack;
	}
	for (const obstacle of mask.obstacles) {
		slack = Math.min(slack, polygonBoundaryDistance(point, obstacle.polygon) - obstacle.clearancePx);
		if (slack < 0) return slack;
	}
	for (const zone of mask.acquisition) {
		slack = Math.min(
			slack,
			Math.hypot(point[0] - zone.center[0], point[1] - zone.center[1]) -
				zone.radiusPx -
				zone.clearancePx
		);
		if (slack < 0) return slack;
	}
	for (const inflated of inflatedText) {
		slack = Math.min(slack, rectPointDistance(inflated, point));
		if (slack < 0) return slack;
	}
	return slack;
}

/**
 * The even-odd crossing table for ONE grid row, in the order the per-point test
 * visits the edges — which is what makes the row computation decision-neutral: the
 * inside/outside answer is the parity of the edges whose crossing lies to the RIGHT
 * of the point, and parity does not care in what order the edges were toggled, so
 * collecting them per row and counting is the same boolean as toggling per point.
 * The crossing is computed with the same orientation and the same expression as
 * `pointStrictlyInside`, so the two agree bit for bit rather than approximately.
 *
 * WHY (measured). After the distance loop was pruned, the point-in-polygon test was
 * what remained: a V8 CPU profile of the M1 protocol puts it at 5.7 % of the whole
 * run and 13 % of the post-release window on the all-curved fixture, because a
 * curved face is a long polyline and the test was walking all of it for every one of
 * up to 24 000 cells. Per row, each edge is crossed at most once: the walk becomes
 * one pass over the boundary per row plus a walk over the sorted crossings.
 */
function rowCrossings(polygonScreen: readonly LayoutVec2[], y: number): number[] {
	const crossings: number[] = [];
	for (let index = 0, previous = polygonScreen.length - 1; index < polygonScreen.length; previous = index++) {
		const a = polygonScreen[index]!;
		const b = polygonScreen[previous]!;
		if (a[1] > y !== b[1] > y) {
			const x = ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0];
			// A non-finite crossing never toggled in the per-point test either.
			if (!Number.isNaN(x)) crossings.push(x);
		}
	}
	crossings.sort((left, right) => left - right);
	return crossings;
}

type FreeCandidate = { point: LayoutVec2; clearance: number };

/**
 * THE ARM DISPATCH — the one read of the DEV switch in this product module (pinned by
 * the wiring test), and the only thing the arms change here. The three GRIDS are the
 * shipped seeded walk, the walk shipped before it (`pruned`) and the pre-change grid
 * (`perCellGridCandidates`, kept whole below). Choosing between them cannot reach a
 * placement decision: all three visit the same cells, keep the same eligible set, pick
 * the same representative point per component and rank the same candidates — the
 * placement suite requires identical labels from all of them. The fourth arm,
 * `memo-grid`, is not a grid at all: it is the SHIPPED walk behind a cache, so it can
 * only change how MANY times a grid is built, never which one — which is why its parity
 * with `seeded-grid` is by construction rather than by agreement.
 *
 * THE SAME CALL CARRIES THE GRID'S INPUTS, because this is the only place that has them
 * and the only call this module is allowed to make into the instrument. They are passed
 * by reference (nothing is copied, allocated or hashed unless the gate is on), and the
 * instrument uses them to key one build — its own concern, in its own module. Reading them
 * is not a decision: the arm is chosen here exactly as it was before they were passed.
 */
function freeSpaceCandidates(
	polygonScreen: readonly LayoutVec2[],
	mask: ScreenMask,
	centerScreen: LayoutVec2
): FreeCandidate[] {
	const arm = p23bM1RoomLabelArm(polygonScreen, mask, centerScreen);
	if (arm === 'per-cell-grid') return perCellGridCandidates(polygonScreen, mask, centerScreen);
	// The memo arm builds the SHIPPED grid and only decides whether to build it at all: the
	// thunk runs on a miss, so its candidates are `seeded-grid`'s by construction and a hit
	// skips the whole walk. Returning the cached array means the caller must not mutate it,
	// and `placeRoomLabels` only reads the candidates it is handed.
	if (arm === 'memo-grid')
		return p23bM1MemoizedGridCandidates(() =>
			gridCandidates(polygonScreen, mask, centerScreen, 'seeded')
		);
	return gridCandidates(polygonScreen, mask, centerScreen, arm === 'pruned-grid' ? 'pruned' : 'seeded');
}

/**
 * Derive up to eight large free-space candidates from the Room's projected
 * polygon minus the eligibility mask. Connected components of eligible cells
 * give the *free-space components*; each component contributes the cell with the
 * greatest clearance, and the largest components are kept. Ranked by clearance,
 * then proximity to the semantic center — invariant to Room document order.
 *
 * THE GRID AND THE SLACK ENGINE ARE SEPARATE ON PURPOSE. Everything above the slack
 * call is the same work in both of this pass's arms — the bounding box, the cell
 * budget, the row-wise inside flags, the connected-component walk and the ranking — so
 * it is written once and cannot drift between them; the arms differ exactly where the
 * change is, in how one cell's slack is measured (the engine closure below). That is
 * the same rule the runner applies to its rows: a per-arm cell is produced by the same
 * function that produces the class row, so the difference between arms is the change
 * and not a second copy of the measurement.
 */
function gridCandidates(
	polygonScreen: readonly LayoutVec2[],
	mask: ScreenMask,
	centerScreen: LayoutVec2,
	/** Which distance engine measures a cell: the shipped seeded walk or the one before it. */
	engine: 'seeded' | 'pruned'
): FreeCandidate[] {
	// One pass, not four mapped arrays: this is per Room per placement, and the four
	// spreads each allocated a copy of the projected polygon.
	let minX = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let minZ = Number.POSITIVE_INFINITY;
	let maxZ = Number.NEGATIVE_INFINITY;
	for (const [x, z] of polygonScreen) {
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (z < minZ) minZ = z;
		if (z > maxZ) maxZ = z;
	}
	const widthPx = maxX - minX;
	const heightPx = maxZ - minZ;
	if (!(widthPx > 0) || !(heightPx > 0)) return [];
	const cell = Math.max(
		ROOM_LABEL_MASK_CELL_PX,
		Math.ceil(Math.sqrt((widthPx * heightPx) / ROOM_LABEL_MASK_MAX_CELLS))
	);
	const columns = Math.max(1, Math.ceil(widthPx / cell));
	const rows = Math.max(1, Math.ceil(heightPx / cell));
	// Inflated once, not once per cell: the grid asks the same question up to 24 000
	// times, and the inflation depends only on the mask.
	const inflatedText: ScreenRect[] = mask.activeText.map((text) => ({
		minX: text.rect.minX - text.clearancePx,
		minY: text.rect.minY - text.clearancePx,
		maxX: text.rect.maxX + text.clearancePx,
		maxY: text.rect.maxY + text.clearancePx
	}));
	// Inside/outside is a property of the ROW, not of the cell: every cell in a row
	// shares its z, so the boundary crossings are the same set and only the comparison
	// against the cell's x differs. Computed once per row, walked left to right.
	const insideFlags = new Uint8Array(columns * rows);
	for (let row = 0; row < rows; row += 1) {
		const y = minZ + (row + 0.5) * cell;
		const crossings = rowCrossings(polygonScreen, y);
		let crossing = 0;
		for (let column = 0; column < columns; column += 1) {
			const x = minX + (column + 0.5) * cell;
			// A crossing exactly at the point does not count: the per-point test asked
			// `point[0] < x`, which is false when they are equal.
			while (crossing < crossings.length && crossings[crossing]! <= x) crossing += 1;
			insideFlags[row * columns + column] = (crossings.length - crossing) % 2 === 1 ? 1 : 0;
		}
	}
	const slackOf: (point: LayoutVec2, inside: boolean) => number =
		engine === 'seeded'
			? seededSlackEngine(polygonScreen, mask, inflatedText)
			: (point, inside) => pointSlack(point, polygonScreen, mask, inflatedText, inside);
	const slack = new Float64Array(columns * rows).fill(Number.NEGATIVE_INFINITY);
	for (let column = 0; column < columns; column += 1) {
		for (let row = 0; row < rows; row += 1) {
			const index = row * columns + column;
			const point: LayoutVec2 = [minX + (column + 0.5) * cell, minZ + (row + 0.5) * cell];
			slack[index] = slackOf(point, insideFlags[index] === 1);
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
		/** Enqueue an eligible, unvisited neighbour; a boundary or ineligible cell is not one. */
		const visit = (neighbour: number): void => {
			if (visited[neighbour] === 1 || slack[neighbour]! < 0) return;
			visited[neighbour] = 1;
			queue.push(neighbour);
		};
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
			// Four tests written out rather than collected into an array: this runs once
			// per cell of the grid, so the array was one allocation per cell (up to
			// 24 000 per Room) for a traversal that can only ever have four neighbours.
			if (column > 0) visit(index - 1);
			if (column < columns - 1) visit(index + 1);
			if (row > 0) visit(index - columns);
			if (row < rows - 1) visit(index + columns);
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

/* ------------------------------------------------------------------ *
 * THE SHIPPED SLACK ENGINE — every distance walk seeded with the slack found so far
 * ------------------------------------------------------------------ */

/**
 * WHAT THIS ENGINE CHANGES, and why the seed is the whole of it. A cell's slack is the
 * minimum over a list of terms: the Room's own boundary minus a reserve, each protected
 * edge, each obstacle, each acquisition zone, each active text rect. The engine shipped
 * before this one walked every term from `+Infinity`, so each term paid its own pass
 * over its own segments and could only skip the segments inside its own bounding box;
 * measured on the 2026-09-28 all-curved post-release window, that walk is the grid's
 * dominant cost (`segmentLowerBound` 12.3 % of the window, `edgeDistance` 12.0 % — the
 * two halves of one loop).
 *
 * Two changes, and neither is a constant factor:
 *
 *   1. THE WALK IS SEEDED with `slackSoFar + clearance`, so a segment that cannot beat
 *      what is already known is skipped without being measured, and a whole GROUP of
 *      segments is skipped when its bounding box cannot beat it either.
 *   2. THE CHEAP TERMS RUN FIRST, and "cheap" is counted in SEGMENTS, not assumed. Zones
 *      and text rects are a handful of arithmetic operations and always lead; among the
 *      polylines the shortest is visited first, so the expensive walks get a finite seed
 *      and a cell deep inside the face — where the boundary is not what stops the label
 *      — walks as little as possible. That is what puts a curved 256-vertex boundary
 *      LAST (it is the longest polyline in the grid) and a four-segment rectangle Room
 *      FIRST (it is the shortest, and the most selective). See `seededSlackEngine` for
 *      the measurement behind the ranking, and `seedTerm` for the index gate.
 *
 * IT DECIDES NOTHING DIFFERENTLY, and that is provable rather than hoped for: pruning on
 * `lowerBound >= best` can only skip a segment whose exact distance is at least `best`,
 * which is at or above the seeded threshold, so the walk still returns the true minimum
 * whenever that minimum is below the seed. Seeding also changes the ORDER in which terms
 * are evaluated and therefore which negative value an ineligible cell returns — and the
 * magnitude of a discarded cell is read by nothing (the grid only ever asks whether a
 * cell is eligible, and ranks cells that are), so the eligible set and every eligible
 * cell's value are unchanged.
 *
 * THE 1e-12 GUARD is what keeps "nothing below the seed" a statement about the geometry.
 * Without it a term that exactly equals the slack would have to come back through
 * `(slack + clearance) − clearance`, which can land one ulp below the slack and would
 * change a value that the ranking reads.
 */
const SEED_GUARD = 1e-12;

/**
 * The fewest segments a polyline must have before a per-group box index earns its keep.
 * MEASURED, not guessed. At the scale the M1 leg reports — ≈0.06 ms per grid build on the
 * straight fixture, ≈0.6 ms on the all-curved one — an index built for a one-segment
 * polyline is pure overhead: three typed arrays and a box test per group, to skip a walk
 * that is one segment long. For a flattened 256-vertex ring it is the entire win. The grid
 * is built between 20 and 72 times per accepted action, so whatever this costs is paid on
 * every one of those builds.
 */
const GRID_INDEX_MIN_SEGMENTS = 8;

/**
 * One polyline term of the seeded engine: the polyline, the distance it must keep, and the
 * group index it EARNED — or `null`, which is walked the same seeded way with nothing but
 * the seed to prune against. Ranking the terms and deciding which of them get an index are
 * both presentation-only decisions: neither changes a distance, a threshold or an eligible
 * cell's value, which is why the arm's parity test still holds across them.
 */
type SeedTerm = {
	points: readonly LayoutVec2[];
	closed: boolean;
	clearancePx: number;
	segments: number;
	index: PolylineIndex | null;
};

function seedTerm(
	points: readonly LayoutVec2[],
	closed: boolean,
	clearancePx: number
): SeedTerm {
	const segments = closed ? points.length : Math.max(0, points.length - 1);
	return {
		points,
		closed,
		clearancePx,
		segments,
		index: segments >= GRID_INDEX_MIN_SEGMENTS ? buildPolylineIndex(points, closed) : null
	};
}

/**
 * A polyline's segments grouped, with each group's own bounding box: the bulk prune.
 * A group's box contains every segment box in the group, so its distance is a lower
 * bound on every segment's distance in it — the same safe direction as the per-segment
 * box, one level up. `round(sqrt(segments))` segments per group balances the number of
 * group tests against the segments a surviving group still walks.
 */
type PolylineIndex = {
	/** Segments per group. */
	group: number;
	groups: number;
	/** Closed rings have one segment per point; open polylines have one fewer. */
	segments: number;
	minX: Float64Array;
	minZ: Float64Array;
	maxX: Float64Array;
	maxZ: Float64Array;
};

function buildPolylineIndex(polygon: readonly LayoutVec2[], closed: boolean): PolylineIndex {
	const segments = closed ? polygon.length : Math.max(0, polygon.length - 1);
	const group = Math.max(2, Math.min(32, Math.round(Math.sqrt(Math.max(segments, 4)))));
	const groups = segments === 0 ? 0 : Math.max(1, Math.ceil(segments / group));
	const index: PolylineIndex = {
		group,
		groups,
		segments,
		minX: new Float64Array(groups),
		minZ: new Float64Array(groups),
		maxX: new Float64Array(groups),
		maxZ: new Float64Array(groups)
	};
	for (let groupIndex = 0; groupIndex < groups; groupIndex += 1) {
		let loX = Number.POSITIVE_INFINITY;
		let loZ = Number.POSITIVE_INFINITY;
		let hiX = Number.NEGATIVE_INFINITY;
		let hiZ = Number.NEGATIVE_INFINITY;
		const from = groupIndex * group;
		const to = Math.min(from + group, segments);
		// `to` is inclusive here: group g covers segments [from, to) — `to` segments means
		// `to + 1` points, and a closed ring's last point wraps to its first.
		for (let i = from; i <= to; i += 1) {
			const point = polygon[closed && i === segments ? 0 : i]!;
			if (point[0] < loX) loX = point[0];
			if (point[0] > hiX) hiX = point[0];
			if (point[1] < loZ) loZ = point[1];
			if (point[1] > hiZ) hiZ = point[1];
		}
		index.minX[groupIndex] = loX;
		index.minZ[groupIndex] = loZ;
		index.maxX[groupIndex] = hiX;
		index.maxZ[groupIndex] = hiZ;
	}
	return index;
}

/**
 * The exact distance from `point` to the polyline, or `null` when it is NOT below
 * `threshold`. The sentinel is what keeps a "cannot bind" answer out of the arithmetic:
 * the caller then leaves its slack untouched instead of re-deriving it from a seeded
 * value. Callers pass `+Infinity` when they have nothing to prune against yet, which is
 * the walk the previous engine always ran.
 */
function seededPolylineDistance(
	point: LayoutVec2,
	polygon: readonly LayoutVec2[],
	closed: boolean,
	threshold: number,
	/** `null` for a polyline too short to earn an index: the same walk, same seed. */
	index: PolylineIndex | null
): number | null {
	if (polygon.length === 0) return null;
	const limit = Number.isFinite(threshold) ? threshold * (1 + SEED_GUARD) : threshold;
	if (polygon.length === 1) {
		// One point is one degenerate segment in both readings: today's closed walk puts
		// the point next to itself and the segment distance collapses to the point's.
		const only = polygon[0]!;
		const distance = Math.hypot(point[0] - only[0], point[1] - only[1]);
		return distance >= limit ? null : distance;
	}
	const px = point[0];
	const pz = point[1];
	let best = limit;
	if (index === null) {
		const last = closed ? polygon.length : polygon.length - 1;
		for (let i = 0; i < last; i += 1) {
			const a = polygon[i]!;
			const b = polygon[closed && i + 1 === last ? 0 : i + 1]!;
			if (segmentLowerBound(point, a, b) >= best) continue;
			best = Math.min(best, edgeDistance(point, a, b));
		}
		return best >= limit ? null : best;
	}
	const { group, groups, segments, minX, minZ, maxX, maxZ } = index;
	for (let groupIndex = 0; groupIndex < groups; groupIndex += 1) {
		const groupDx = Math.max(0, minX[groupIndex]! - px, px - maxX[groupIndex]!);
		if (groupDx >= best) continue;
		const groupDz = Math.max(0, minZ[groupIndex]! - pz, pz - maxZ[groupIndex]!);
		if (Math.max(groupDx, groupDz) >= best) continue;
		const from = groupIndex * group;
		const to = Math.min(from + group, segments);
		for (let i = from; i < to; i += 1) {
			const a = polygon[i]!;
			const b = polygon[closed && i + 1 === segments ? 0 : i + 1]!;
			if (segmentLowerBound(point, a, b) >= best) continue;
			best = Math.min(best, edgeDistance(point, a, b));
		}
	}
	return best >= limit ? null : best;
}

/**
 * The shipped engine, bound once per grid: the polylines' terms — order and indexes —
 * are settled here, and the per-cell work is a closure over them.
 *
 * THE TERMS ARE VISITED CHEAPEST-SEGMENTS-FIRST, AND THAT ORDER IS MEASURED. The walk's
 * cost is the segments it visits, and a term that runs first ends the walk for every cell
 * it rejects. On the all-curved fixture the Room's own ring is the longest polyline in the
 * grid (a flattened 256-vertex curve), so it belongs last — which is what the first
 * version of this engine hardcoded. On the straight fixture the same ring is a four-segment
 * rectangle: the cheapest AND most selective term in the grid, and running it last made the
 * engine slower than the pruned walk it replaces (0.61–0.95× on the shapes the leg reports,
 * vs 1.47–2.35× when the terms are ranked). Ranking by segment count is right in both cases
 * and costs one sort of a handful of terms per grid build; `sort` is stable, so terms of
 * equal length keep the order they were added in. The zones and the text rects stay ahead of
 * every polyline term: they are a hypot and a rect clamp against a cached array, cheaper
 * than any one segment. `slackSoFar + clearance` is still each term's seed.
 */
function seededSlackEngine(
	polygonScreen: readonly LayoutVec2[],
	mask: ScreenMask,
	inflatedText: readonly ScreenRect[]
): (point: LayoutVec2, inside: boolean) => number {
	const terms: SeedTerm[] = [
		...mask.protectedEdges.map((edge) => seedTerm(edge.points, false, edge.clearancePx)),
		...mask.obstacles.map((obstacle) => seedTerm(obstacle.polygon, true, obstacle.clearancePx)),
		seedTerm(polygonScreen, true, ROOM_LABEL_CORE_GEOMETRY_RESERVE_PX)
	];
	terms.sort((left, right) => left.segments - right.segments);
	return (point, inside) => {
		if (!inside) return Number.NEGATIVE_INFINITY;
		let slack = Number.POSITIVE_INFINITY;
		for (const zone of mask.acquisition) {
			slack = Math.min(
				slack,
				Math.hypot(point[0] - zone.center[0], point[1] - zone.center[1]) -
					zone.radiusPx -
					zone.clearancePx
			);
			if (slack < 0) return slack;
		}
		for (const inflated of inflatedText) {
			slack = Math.min(slack, rectPointDistance(inflated, point));
			if (slack < 0) return slack;
		}
		for (const term of terms) {
			const distance = seededPolylineDistance(
				point,
				term.points,
				term.closed,
				slack + term.clearancePx,
				term.index
			);
			if (distance === null) continue;
			slack = Math.min(slack, distance - term.clearancePx);
			if (slack < 0) return slack;
		}
		return slack;
	};
}

/* ------------------------------------------------------------------ *
 * The arm's BEFORE path — the pre-change grid, kept verbatim
 * ------------------------------------------------------------------ */

/**
 * EVERYTHING BELOW THIS LINE IS THE PRE-CHANGE IMPLEMENTATION, not a variant of
 * the shipped one. It is here so the BEFORE/AFTER arm can run it on demand in the
 * same session as the shipped path, because every M1 absolute is
 * session-conditioned and a cross-session before/after measures the machine. The
 * four functions are the ones the 2026-09-28 record measured: `edgeDistance` per
 * boundary vertex per cell with no bbox prune, the inside test walked per cell, the
 * active-text rect inflated per cell, the Room bbox in four mapped arrays and a
 * neighbour array allocated per BFS cell — 17.11 % of a whole M1 run in one of them.
 *
 * IT DECIDES NOTHING DIFFERENTLY. Both arms visit the same cells, keep the same
 * eligible set, pick the same representative point per component and rank the same
 * candidates; the placement suite runs both and requires identical labels
 * (`placeRoomLabels` under each arm), which is what makes the arm a measurement of
 * COST rather than of behaviour. Nothing here may be optimised: a "small fix" would
 * quietly turn the BEFORE arm into a second AFTER arm and the comparison into a
 * comparison of two similar things.
 */
function perCellPolylineDistance(point: LayoutVec2, points: readonly LayoutVec2[]): number {
	if (points.length === 0) return Number.POSITIVE_INFINITY;
	if (points.length === 1) return Math.hypot(point[0] - points[0]![0], point[1] - points[0]![1]);
	let best = Number.POSITIVE_INFINITY;
	for (let index = 1; index < points.length; index += 1) {
		best = Math.min(best, edgeDistance(point, points[index - 1]!, points[index]!));
	}
	return best;
}

function perCellPolygonBoundaryDistance(point: LayoutVec2, polygon: readonly LayoutVec2[]): number {
	return perCellPolylineDistance(point, [...polygon, polygon[0]!]);
}

function perCellPointSlack(
	point: LayoutVec2,
	polygonScreen: readonly LayoutVec2[],
	mask: ScreenMask
): number {
	if (!pointStrictlyInside(polygonScreen, point)) return Number.NEGATIVE_INFINITY;
	let slack = perCellPolygonBoundaryDistance(point, polygonScreen) - ROOM_LABEL_CORE_GEOMETRY_RESERVE_PX;
	if (slack < 0) return slack;
	for (const edge of mask.protectedEdges) {
		slack = Math.min(slack, perCellPolylineDistance(point, edge.points) - edge.clearancePx);
	}
	for (const obstacle of mask.obstacles) {
		slack = Math.min(slack, perCellPolygonBoundaryDistance(point, obstacle.polygon) - obstacle.clearancePx);
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

function perCellGridCandidates(
	polygonScreen: readonly LayoutVec2[],
	mask: ScreenMask,
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
			slack[row * columns + column] = perCellPointSlack(point, polygonScreen, mask);
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
	// WHAT THIS CALL WAS HANDED, recorded before any Room is visited: the grid key says how
	// much of it recomputes, and this says which pass does the recomputing. It is the same
	// DEV-only instrument the whole module reads through, it returns nothing, and with the
	// gate off the shipped path pays one boolean.
	p23bM1RecordRoomLabelCall({
		rooms: input.rooms.length,
		reason,
		settleGeneration,
		hasMemory: input.memory !== undefined,
		at: typeof performance === 'undefined' ? 0 : performance.now()
	});
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
			const candidates: FreeCandidate[] = freeSpaceCandidates(polygonScreen, mask, centerScreen);
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

		// P23.13 S8 / §1.12 — the instrument zone's tier ceiling. Applied to the
		// accepted anchor and only when it would actually lower the tier, so a
		// label already below the ceiling is untouched and a label outside the
		// zone never notices the zone exists.
		const zone = input.tierDropZone;
		if (resolved && anchorScreen && zone) {
			const inZone =
				anchorScreen[0] >= zone.minX &&
				anchorScreen[0] <= zone.maxX &&
				anchorScreen[1] >= zone.minY &&
				anchorScreen[1] <= zone.maxY;
			const acceptedStack = resolved;
			if (inZone && TIER_RANK[tierOfStack(acceptedStack.stack)] < TIER_RANK[zone.ceiling]) {
				const capped = eligible.filter(
					(stack) => TIER_RANK[tierOfStack(stack)] >= TIER_RANK[zone.ceiling]
				);
				const atAnchor = capped.length > 0 ? resolve(anchorScreen, capped) : null;
				// The reduced stack has to fit where the fuller one fits; a zone is a
				// quieting preference and never a licence to drop a Room's label.
				if (atAnchor) resolved = atAnchor;
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
		// A selected Room whose resting stack cannot carry its **complete identity**
		// gets the fixed readout as the honest completion, never a forced overlap
		// and never a centroid override. Complete identity is the authored name
		// plus the reference (§4): area is supplementary, so losing it never
		// summons the readout by itself.
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
	// The other half of this call's recording, taken here because this is the pass's ONE
	// exit: it prices the whole pass — its grid builds and the placement work around them —
	// which is what a fix has to beat. Returns nothing, same as the entry.
	p23bM1EndRoomLabelCall();
	// …and WHAT THE PASS PRODUCED, to the last bit. Identical inputs prove two passes built
	// the same grids; only this can say whether they also PLACED the same labels, which is
	// the difference between a redundant pass and a pass that merely looks redundant. Two
	// digests, because they answer different questions: the labels + readout are what a
	// render paints, the memory is what the next pass inherits. DEV-only and allocation-free.
	p23bM1BeginRoomLabelValueDigest();
	p23bM1DigestNumber(labels.length);
	for (const label of labels) {
		p23bM1DigestString(label.roomId);
		p23bM1DigestString(label.tier);
		p23bM1DigestNumber(label.anchorScreen[0]);
		p23bM1DigestNumber(label.anchorScreen[1]);
		p23bM1DigestNumber(label.anchorWorld[0]);
		p23bM1DigestNumber(label.anchorWorld[1]);
		p23bM1DigestNumber(label.widthPx);
		p23bM1DigestNumber(label.heightPx);
		p23bM1DigestNumber(label.lines.length);
		for (const line of label.lines) {
			p23bM1DigestString(line.text);
			p23bM1DigestString(line.style);
			p23bM1DigestNumber(line.baselineOffsetPx);
		}
	}
	p23bM1DigestNumber(readout === null ? 0 : 1);
	if (readout) {
		p23bM1DigestString(readout.roomId);
		p23bM1DigestString(readout.primary);
		p23bM1DigestString(readout.reference ?? '');
		p23bM1DigestString(readout.area ?? '');
	}
	p23bM1EndRoomLabelValueDigest('labels');
	p23bM1BeginRoomLabelValueDigest();
	p23bM1DigestNumber(memory.size);
	for (const [roomId, entry] of memory) {
		p23bM1DigestString(roomId);
		p23bM1DigestString(entry.tier);
		p23bM1DigestNumber(entry.anchorWorld[0]);
		p23bM1DigestNumber(entry.anchorWorld[1]);
		p23bM1DigestNumber(entry.suppressed ? 1 : 0);
		p23bM1DigestNumber(entry.suppressedSettleGeneration);
	}
	p23bM1EndRoomLabelValueDigest('memory');
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
