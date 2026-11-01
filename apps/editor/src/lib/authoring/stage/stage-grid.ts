/**
 * R217.S13 — the **grid** as measured drawing at fixed values.
 *
 * PLATE fixes the grid's grammar, and this module is the only implementation of
 * it:
 *
 * - every surface draws only the fixed 1 m minor and 5 m major levels;
 * - each level fades from 16 to 8 CSS px projected spacing and hides below 8,
 *   so a zoom change only thins the drawing and never changes a value;
 * - a 25 m level appears only while the 5 m level is hidden, so a large site
 *   keeps one reference before the ruler becomes the only one;
 * - lines are anchored to world `(0, datum, 0)` and generated only inside the
 *   drawn rectangle;
 * - Paper's rectangle is a bounded sheet around the work, while the mat keeps
 *   the exact datum footprint inside the Camera's clipped frustum (R217.S19);
 * - the mat draws at most 6,000 lines: over budget, the minor rectangle shrinks
 *   around the target and the major lines still cover the whole footprint;
 * - Paper and the mat have their own inks from PLATE §Semantic color.
 *
 * The grid is display-only. It is never a pick source, never delays navigation
 * and never writes a pose, source, history or Save entry.
 */
import { viewportGroundReachMeters, type ViewportEvaluation } from '@portfolio/camera-core';
import { GRID_MAJOR_METERS, GRID_MINOR_METERS } from './stage-drafting';

/** PLATE's grid inks. Opacity is part of the role, not a renderer default. */
export type GridInk = {
	readonly minor: string;
	readonly major: string;
	readonly minorOpacity: number;
	readonly majorOpacity: number;
};

export const PAPER_GRID_INK: GridInk = {
	minor: '#9FB2A2',
	major: '#809984',
	minorOpacity: 0.28,
	majorOpacity: 0.45
};

export const MAT_GRID_INK: GridInk = {
	minor: '#2B5147',
	major: '#3C6A5C',
	minorOpacity: 1,
	majorOpacity: 1
};

export type GridSurface = 'paper' | 'mat';

/** At least this projected spacing is fully inked. */
export const GRID_FULL_SPACING_CSS_PX = 16;
/** Below this projected spacing, an interval is not drawn at all. */
export const GRID_SUPPRESS_SPACING_CSS_PX = 8;
/** The coarser reference that appears only while the 5 m level is hidden. */
export const GRID_COARSE_METERS = 25;

export type GridLevelRole = 'minor' | 'major' | 'coarse';

/** One drawn interval level, with the spacing that decides its opacity. */
export type GridLevel = {
	readonly intervalMeters: number;
	readonly role: GridLevelRole;
	readonly spacingCssPx: number;
	readonly opacity: number;
	readonly color: string;
};

export type GridLevels = {
	/** The finest visible interval, used to quantise the drawing rectangle. */
	readonly minorMeters: number;
	/** The fixed 5 m level when it is visible. */
	readonly majorMeters: number | null;
	/** The 25 m level, present only while the 5 m level is hidden. */
	readonly coarseMeters: number | null;
	/** In draw order: minor, major, coarse. */
	readonly levels: readonly GridLevel[];
};

function clean(value: number): number {
	return Math.round(value * 1e9) / 1e9;
}

/**
 * The opacity a fixed level draws at: full at 16 px and above, a linear fade
 * from 16 to 8 px, and absent below 8 px.
 */
function levelOpacity(
	intervalMeters: number,
	metersPerCssPixel: number,
	fullOpacity: number
): { readonly spacingCssPx: number; readonly opacity: number } | null {
	const spacingCssPx = intervalMeters / metersPerCssPixel;
	if (spacingCssPx < GRID_SUPPRESS_SPACING_CSS_PX - 1e-9) return null;
	const fade = Math.min(
		1,
		Math.max(
			0,
			(spacingCssPx - GRID_SUPPRESS_SPACING_CSS_PX) /
				(GRID_FULL_SPACING_CSS_PX - GRID_SUPPRESS_SPACING_CSS_PX)
		)
	);
	if (fade <= 0) return null;
	return { spacingCssPx, opacity: fullOpacity * fade };
}

/**
 * The fixed interval levels for one scale and surface.
 *
 * The values never depend on zoom: the 1 m and 5 m levels simply fade and hide
 * as the drawing gets denser. The 25 m reference exists only while 5 m is
 * hidden, and obeys the same rule itself.
 */
export function gridLevelsFor(input: {
	readonly metersPerCssPixel: number;
	readonly surface: GridSurface;
}): GridLevels | null {
	const { metersPerCssPixel, surface } = input;
	if (!Number.isFinite(metersPerCssPixel) || metersPerCssPixel <= 0) return null;
	const ink = surface === 'paper' ? PAPER_GRID_INK : MAT_GRID_INK;
	const levels: GridLevel[] = [];
	const minor = levelOpacity(GRID_MINOR_METERS, metersPerCssPixel, ink.minorOpacity);
	if (minor !== null) {
		levels.push({
			intervalMeters: GRID_MINOR_METERS,
			role: 'minor',
			spacingCssPx: minor.spacingCssPx,
			opacity: minor.opacity,
			color: ink.minor
		});
	}
	const major = levelOpacity(GRID_MAJOR_METERS, metersPerCssPixel, ink.majorOpacity);
	if (major !== null) {
		levels.push({
			intervalMeters: GRID_MAJOR_METERS,
			role: 'major',
			spacingCssPx: major.spacingCssPx,
			opacity: major.opacity,
			color: ink.major
		});
	}
	// The coarse level is a fallback reference, never a third simultaneous
	// lattice: it appears only after the 5 m level has hidden.
	const coarse =
		major === null
			? levelOpacity(GRID_COARSE_METERS, metersPerCssPixel, ink.majorOpacity)
			: null;
	if (coarse !== null) {
		levels.push({
			intervalMeters: GRID_COARSE_METERS,
			role: 'coarse',
			spacingCssPx: coarse.spacingCssPx,
			opacity: coarse.opacity,
			color: ink.major
		});
	}
	if (levels.length === 0) return null;
	const finest = levels[0]!.intervalMeters;
	return {
		minorMeters: finest,
		majorMeters: major === null ? null : GRID_MAJOR_METERS,
		coarseMeters: coarse === null ? null : GRID_COARSE_METERS,
		levels
	};
}

/** A world-axis-aligned rectangle on the datum plane. */
export type GridRect = {
	readonly minX: number;
	readonly maxX: number;
	readonly minZ: number;
	readonly maxZ: number;
};

/**
 * The visible rectangle plus one interval of margin, quantised to the chosen
 * interval so a small pan does not rebuild the drawing every frame. Lines stay
 * anchored to world zero, so shifting the rectangle by whole intervals is
 * seamless.
 */
export function gridRectFor(input: {
	readonly targetXZ: readonly [number, number];
	readonly targetPlaneHeightMeters: number;
	readonly aspect: number;
	readonly intervalMeters: number;
	readonly marginIntervals?: number;
	/** Half-extent as a multiple of the target-plane size; fallback only. */
	readonly coverage?: number;
	/** The actual visible datum rectangle, when the Camera's rays can supply it. */
	readonly visible?: GridRect | null;
}): GridRect {
	const height = Math.max(0.001, input.targetPlaneHeightMeters);
	const width = height * Math.max(0.1, input.aspect);
	const coverage = Math.max(0.25, input.coverage ?? 0.75);
	const interval = Math.max(1e-6, input.intervalMeters);
	const margin = (input.marginIntervals ?? 1) * interval;
	// The fallback rectangle follows the **quantised centre**, so a pan smaller
	// than half an interval cannot move an edge across a boundary. A real visible
	// footprint already has exact edges from the Camera's rays.
	const centerX = input.visible
		? input.targetXZ[0]
		: Math.round(input.targetXZ[0] / interval) * interval;
	const centerZ = input.visible
		? input.targetXZ[1]
		: Math.round(input.targetXZ[1] / interval) * interval;
	const fallbackMinX = centerX - Math.max(2, width * coverage);
	const fallbackMaxX = centerX + Math.max(2, width * coverage);
	const fallbackMinZ = centerZ - Math.max(2, height * coverage);
	const fallbackMaxZ = centerZ + Math.max(2, height * coverage);
	const minX = input.visible?.minX ?? fallbackMinX;
	const maxX = input.visible?.maxX ?? fallbackMaxX;
	const minZ = input.visible?.minZ ?? fallbackMinZ;
	const maxZ = input.visible?.maxZ ?? fallbackMaxZ;
	// The rectangle's edges are quantised so a small pan does not rebuild the
	// drawing. Lines stay anchored to world zero because only the rectangle's
	// edges are quantised, never the lattice. A visible rectangle is quantised
	// outward, which keeps the drawn patch a superset of what the Camera sees.
	const quantisedMinX = Math.floor((minX - margin) / interval) * interval;
	const quantisedMaxX = Math.ceil((maxX + margin) / interval) * interval;
	const quantisedMinZ = Math.floor((minZ - margin) / interval) * interval;
	const quantisedMaxZ = Math.ceil((maxZ + margin) / interval) * interval;
	return {
		minX: clean(quantisedMinX),
		maxX: clean(quantisedMaxX),
		minZ: clean(quantisedMinZ),
		maxZ: clean(quantisedMaxZ)
	};
}

/**
 * The bounded Paper sheet: the work's datum bounds expanded by 5 m and rounded
 * outward to 5 m, or a 20 × 20 m default around the target for an empty
 * project.
 *
 * A live candidate is part of "the work": while a gesture proposes geometry
 * outside the accepted bounds, the sheet grows to include it. It never moves the
 * Camera, so the sheet can grow without the drawing shifting under the pointer.
 *
 * The sheet is intersected with the visible coverage, so a zoomed-in view
 * generates only the lines it can see. The intersection never moves the Camera
 * and never changes the lattice; it only bounds the drawing.
 */
export function paperSheetRectFor(input: {
	readonly targetXZ: readonly [number, number];
	readonly targetPlaneHeightMeters: number;
	readonly aspect: number;
	readonly intervalMeters: number;
	readonly contentBounds?: GridRect | null;
	/** R217.S14 — the live candidate's world extent, never an accepted bound. */
	readonly candidateBounds?: GridRect | null;
}): GridRect | null {
	const work =
		input.contentBounds === null || input.contentBounds === undefined
			? input.candidateBounds ?? null
			: input.candidateBounds === null || input.candidateBounds === undefined
				? input.contentBounds
				: {
						minX: Math.min(input.contentBounds.minX, input.candidateBounds.minX),
						maxX: Math.max(input.contentBounds.maxX, input.candidateBounds.maxX),
						minZ: Math.min(input.contentBounds.minZ, input.candidateBounds.minZ),
						maxZ: Math.max(input.contentBounds.maxZ, input.candidateBounds.maxZ)
					};
	const sheet =
		work === null
			? {
					minX: input.targetXZ[0] - 10,
					maxX: input.targetXZ[0] + 10,
					minZ: input.targetXZ[1] - 10,
					maxZ: input.targetXZ[1] + 10
				}
			: {
					minX: Math.floor((work.minX - 5) / GRID_MAJOR_METERS) * GRID_MAJOR_METERS,
					maxX: Math.ceil((work.maxX + 5) / GRID_MAJOR_METERS) * GRID_MAJOR_METERS,
					minZ: Math.floor((work.minZ - 5) / GRID_MAJOR_METERS) * GRID_MAJOR_METERS,
					maxZ: Math.ceil((work.maxZ + 5) / GRID_MAJOR_METERS) * GRID_MAJOR_METERS
				};
	const visible = gridRectFor({
		targetXZ: input.targetXZ,
		targetPlaneHeightMeters: input.targetPlaneHeightMeters,
		aspect: input.aspect,
		intervalMeters: input.intervalMeters,
		coverage: 0.75
	});
	const minX = Math.max(sheet.minX, visible.minX);
	const maxX = Math.min(sheet.maxX, visible.maxX);
	const minZ = Math.max(sheet.minZ, visible.minZ);
	const maxZ = Math.min(sheet.maxZ, visible.maxZ);
	if (minX >= maxX || minZ >= maxZ) return null;
	// Both inputs are already quantised (the sheet to 5 m, the visible coverage
	// to the finest interval), so their intersection is stable without a second
	// rounding pass. An empty project keeps its exact 20 × 20 m sheet.
	return { minX: clean(minX), maxX: clean(maxX), minZ: clean(minZ), maxZ: clean(maxZ) };
}

/**
 * R217.S19 — the datum-plane rectangle the mat actually shows: the bounds of the
 * exact intersection of the evaluation's clipped frustum with the datum plane.
 *
 * Four corner rays lost coverage two ways: a ray could hit the datum beyond the
 * far plane, and near the horizon the visible ground is not described by its
 * corners at all. Intersecting all twelve frustum edges with the datum gives
 * every vertex of the visible ground polygon, so the grid's coverage and the
 * Camera's clip range come from the same frustum and cannot disagree. The far
 * plane is what keeps a horizon view finite.
 *
 * Returns `null` when the clipped frustum does not meet the datum (the view sees
 * no ground). It composes no pose and reads no Camera state beyond the matrix and
 * rect the evaluation already published.
 */
export function gridDatumFootprintFor(input: {
	readonly inverseViewProjectionMatrix: readonly number[];
	readonly rect: { readonly width: number; readonly height: number };
	readonly datumMeters: number;
}): GridRect | null {
	const matrix = input.inverseViewProjectionMatrix;
	if (!Array.isArray(matrix) || matrix.length !== 16) return null;
	if (!(input.rect.width > 0) || !(input.rect.height > 0)) return null;
	// Corner index bits: x = bit 0, y = bit 1, z (near/far) = bit 2.
	const corners: (readonly [number, number, number] | null)[] = [];
	for (const ndcZ of [-1, 1] as const) {
		for (const ndcY of [-1, 1] as const) {
			for (const ndcX of [-1, 1] as const) corners.push(unprojectPoint(matrix, ndcX, ndcY, ndcZ));
		}
	}
	let minX = Infinity;
	let maxX = -Infinity;
	let minZ = Infinity;
	let maxZ = -Infinity;
	let hits = 0;
	for (const [from, to] of FRUSTUM_EDGES) {
		const a = corners[from];
		const b = corners[to];
		if (a === null || a === undefined || b === null || b === undefined) continue;
		const aboveA = a[1] - input.datumMeters;
		const aboveB = b[1] - input.datumMeters;
		if (aboveA === aboveB || aboveA * aboveB > 0) continue;
		const travel = aboveA / (aboveA - aboveB);
		const x = a[0] + (b[0] - a[0]) * travel;
		const z = a[2] + (b[2] - a[2]) * travel;
		if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
		minX = Math.min(minX, x);
		maxX = Math.max(maxX, x);
		minZ = Math.min(minZ, z);
		maxZ = Math.max(maxZ, z);
		hits += 1;
	}
	if (hits < 3 || !(maxX > minX) || !(maxZ > minZ)) return null;
	return { minX, maxX, minZ, maxZ };
}

/** The twelve edges of a frustum whose corners are indexed x | y << 1 | z << 2. */
const FRUSTUM_EDGES: readonly (readonly [number, number])[] = [
	[0, 1], [2, 3], [4, 5], [6, 7],
	[0, 2], [1, 3], [4, 6], [5, 7],
	[0, 4], [1, 5], [2, 6], [3, 7]
];

function unprojectPoint(
	inverseViewProjection: readonly number[],
	ndcX: number,
	ndcY: number,
	ndcZ: number
): readonly [number, number, number] | null {
	// Column-major 4×4 multiply, matching the realized Three matrices.
	const x = ndcX;
	const y = ndcY;
	const z = ndcZ;
	const w = 1;
	const outX = inverseViewProjection[0]! * x + inverseViewProjection[4]! * y + inverseViewProjection[8]! * z + inverseViewProjection[12]! * w;
	const outY = inverseViewProjection[1]! * x + inverseViewProjection[5]! * y + inverseViewProjection[9]! * z + inverseViewProjection[13]! * w;
	const outZ = inverseViewProjection[2]! * x + inverseViewProjection[6]! * y + inverseViewProjection[10]! * z + inverseViewProjection[14]! * w;
	const outW = inverseViewProjection[3]! * x + inverseViewProjection[7]! * y + inverseViewProjection[11]! * z + inverseViewProjection[15]! * w;
	if (outW === 0 || !Number.isFinite(outW)) return null;
	const point: [number, number, number] = [outX / outW, outY / outW, outZ / outW];
	return point.every(Number.isFinite) ? point : null;
}

export type GridPlan = {
	/** Changes only when the drawing itself changes (levels or rectangle). */
	readonly key: string;
	readonly surface: GridSurface;
	readonly datumMeters: number;
	readonly levels: GridLevels;
	/** The covered rectangle: every level except the minor one spans all of it. */
	readonly rect: GridRect;
	/**
	 * R217.S19 — the minor level's rectangle. It equals `rect` unless the mat's
	 * line budget shrank it around the target; it is always inside `rect`.
	 */
	readonly minorRect: GridRect;
};

/** R217.S19 — the most lines one mat drawing may hold. Major lines are never dropped. */
export const GRID_MAT_LINE_BUDGET = 6000;

/** The coincident intervals a coarser drawn role owns instead of this level. */
function exclusionsFor(level: GridLevel, levels: GridLevels): number[] {
	const exclusions: number[] = [];
	if (level.role === 'minor') exclusions.push(GRID_MAJOR_METERS);
	// A coarser role owns a coincident line only while that role is actually
	// drawn; otherwise the visible level must still draw world zero.
	if (level.role === 'minor' && levels.coarseMeters !== null) {
		exclusions.push(GRID_COARSE_METERS);
	}
	if (level.role === 'major' && levels.coarseMeters !== null) {
		exclusions.push(GRID_COARSE_METERS);
	}
	return exclusions;
}

/** Whole multiples of `interval` in `[minimum, maximum]`, matching `gridLinesFor`. */
function multiplesIn(minimum: number, maximum: number, interval: number): number {
	const first = Math.ceil((minimum - 1e-9) / interval);
	const last = Math.floor((maximum + 1e-9) / interval);
	return Math.max(0, last - first + 1);
}

/**
 * The number of lines one level draws over a rectangle. The excluded intervals
 * are nested multiples of each other (25 m lines are 5 m lines), so the smallest
 * one alone removes every coincident line.
 */
function levelLineCount(level: GridLevel, levels: GridLevels, rect: GridRect): number {
	const exclusions = exclusionsFor(level, levels);
	const excluded = exclusions.length === 0 ? null : Math.min(...exclusions);
	let count = 0;
	for (const [minimum, maximum] of [
		[rect.minX, rect.maxX],
		[rect.minZ, rect.maxZ]
	] as const) {
		count += multiplesIn(minimum, maximum, level.intervalMeters);
		if (excluded !== null) count -= multiplesIn(minimum, maximum, excluded);
	}
	return count;
}

/**
 * R217.S19 — the mat's minor rectangle under the line budget.
 *
 * Every non-minor level keeps the whole rectangle, so a major line is never
 * dropped. Over budget, the minor level keeps only the largest square around
 * the quantised target that fits what the other levels leave. The square's edges
 * are whole minor intervals, so a small pan does not rebuild the drawing.
 */
function budgetedMinorRect(
	levels: GridLevels,
	rect: GridRect,
	targetXZ: readonly [number, number],
	budget: number
): GridRect {
	const minor = levels.levels.find((level) => level.role === 'minor');
	if (minor === undefined) return rect;
	let others = 0;
	for (const level of levels.levels) {
		if (level.role !== 'minor') others += levelLineCount(level, levels, rect);
	}
	if (others + levelLineCount(minor, levels, rect) <= budget) return rect;
	const interval = minor.intervalMeters;
	const centerX = Math.round(targetXZ[0] / interval) * interval;
	const centerZ = Math.round(targetXZ[1] / interval) * interval;
	const square = (steps: number): GridRect => {
		const half = steps * interval;
		return {
			minX: clean(Math.max(rect.minX, centerX - half)),
			maxX: clean(Math.min(rect.maxX, centerX + half)),
			minZ: clean(Math.max(rect.minZ, centerZ - half)),
			maxZ: clean(Math.min(rect.maxZ, centerZ + half))
		};
	};
	const fits = (steps: number): boolean => {
		const candidate = square(steps);
		if (candidate.minX > candidate.maxX || candidate.minZ > candidate.maxZ) return true;
		return others + levelLineCount(minor, levels, candidate) <= budget;
	};
	let low = 0;
	let high = Math.ceil(
		Math.max(rect.maxX - centerX, centerX - rect.minX, rect.maxZ - centerZ, centerZ - rect.minZ) / interval
	);
	while (low < high) {
		const middle = Math.ceil((low + high) / 2);
		if (fits(middle)) low = middle;
		else high = middle - 1;
	}
	return square(low);
}

/** One complete grid drawing for one evaluation and surface. */
export function gridPlanFor(input: {
	readonly metersPerCssPixel: number;
	readonly targetPlaneHeightMeters: number;
	readonly aspect: number;
	readonly targetXZ: readonly [number, number];
	readonly datumMeters: number;
	readonly surface: GridSurface;
	/** The Camera evaluation's corner-ray source, when one is available. */
	readonly inverseViewProjectionMatrix?: readonly number[];
	readonly viewport?: { readonly width: number; readonly height: number };
	/** Layout ∪ Scene datum bounds; Paper draws a bounded sheet around them. */
	readonly contentBounds?: GridRect | null;
	/** The live candidate's world extent; Paper's sheet grows to include it. */
	readonly candidateBounds?: GridRect | null;
}): GridPlan | null {
	const levels = gridLevelsFor(input);
	if (levels === null) return null;
	let rect: GridRect | null;
	if (input.surface === 'paper') {
		rect = paperSheetRectFor({
			targetXZ: input.targetXZ,
			targetPlaneHeightMeters: input.targetPlaneHeightMeters,
			aspect: input.aspect,
			intervalMeters: levels.minorMeters,
			contentBounds: input.contentBounds ?? null,
			candidateBounds: input.candidateBounds ?? null
		});
	} else {
		const visible =
			input.inverseViewProjectionMatrix !== undefined && input.viewport !== undefined
				? gridDatumFootprintFor({
						inverseViewProjectionMatrix: input.inverseViewProjectionMatrix,
						rect: input.viewport,
						datumMeters: input.datumMeters
					})
				: null;
		rect = gridRectFor({
			targetXZ: input.targetXZ,
			targetPlaneHeightMeters: input.targetPlaneHeightMeters,
			aspect: input.aspect,
			intervalMeters: levels.minorMeters,
			// A perspective mat sees the datum far beyond the target plane.
			coverage: 3,
			visible
		});
	}
	if (rect === null) return null;
	const minorRect =
		input.surface === 'mat'
			? budgetedMinorRect(levels, rect, input.targetXZ, GRID_MAT_LINE_BUDGET)
			: rect;
	// Opacity is deliberately absent: the fade changes continuously while zooming,
	// but the lattice does not. A rebuild keyed on opacity would dispose and
	// regenerate every line on nearly every frame; the renderer updates the
	// existing materials instead.
	const levelKey = levels.levels
		.map((level) => `${level.role}:${level.intervalMeters}`)
		.join('|');
	return {
		key: `${input.surface}:${input.datumMeters}:${levelKey}:${rect.minX}:${rect.maxX}:${rect.minZ}:${rect.maxZ}:${minorRect.minX}:${minorRect.maxX}:${minorRect.minZ}:${minorRect.maxZ}`,
		surface: input.surface,
		datumMeters: input.datumMeters,
		levels,
		rect,
		minorRect
	};
}

/**
 * The Stage's grid plan for one evaluation: the exact wiring `StageGrid.svelte`
 * draws, kept here so the checkpoint sweep exercises the same path.
 */
export function stageGridPlanFor(
	evaluation: ViewportEvaluation,
	input: {
		readonly surface: GridSurface;
		readonly datumMeters: number;
		readonly contentBounds?: GridRect | null;
		readonly candidateBounds?: GridRect | null;
	}
): GridPlan | null {
	const aspect = evaluation.rect.height > 0 ? evaluation.rect.width / evaluation.rect.height : 1;
	return gridPlanFor({
		metersPerCssPixel: evaluation.targetPlaneMetersPerCssPixel,
		targetPlaneHeightMeters: evaluation.pose.targetPlaneHeightMeters,
		aspect,
		targetXZ: [evaluation.target[0], evaluation.target[2]],
		datumMeters: input.datumMeters,
		contentBounds: input.contentBounds ?? null,
		candidateBounds: input.candidateBounds ?? null,
		surface: input.surface,
		// The mat's patch is the datum inside the evaluation's own clipped frustum,
		// never a fixed multiple of the target plane that ends inside the frame.
		inverseViewProjectionMatrix: evaluation.inverseViewProjectionMatrix,
		viewport: { width: evaluation.rect.width, height: evaluation.rect.height }
	});
}

/** The finite mat ground: a square on the datum, as a centre and a half-extent. */
export type MatGround = {
	readonly centerXZ: readonly [number, number];
	readonly halfExtentMeters: number;
};

/**
 * R217.S19 — the finite mat follows the Camera's own ground reach.
 *
 * The half-extent is at least 1.5 × the reach the evaluator clips the ground at,
 * rounded up to a power of two so a zoom rarely changes it. The centre is the
 * target quantised to an eighth of that half-extent, so a pan never moves the mat
 * by more than its spare margin. It never enters scene bounds or Fit.
 */
export function matGroundFor(evaluation: ViewportEvaluation, datumMeters: number): MatGround {
	const reach = viewportGroundReachMeters({
		targetPlaneHeightMeters: evaluation.pose.targetPlaneHeightMeters,
		aspect: evaluation.rect.width / evaluation.rect.height,
		eyeHeightMeters: evaluation.eye[1] - datumMeters
	});
	const halfExtentMeters = 2 ** Math.ceil(Math.log2(Math.max(1, 1.5 * reach)));
	const step = halfExtentMeters / 8;
	return {
		centerXZ: [
			Math.round(evaluation.target[0] / step) * step,
			Math.round(evaluation.target[2] / step) * step
		],
		halfExtentMeters
	};
}

/** One grid line, still in whole-meter world coordinates. */
export type GridLine = {
	readonly axis: 'x' | 'z';
	readonly atMeters: number;
	/** The line's span along the other axis: its level's rectangle edges. */
	readonly fromMeters: number;
	readonly toMeters: number;
	readonly role: GridLevelRole;
	readonly color: string;
	readonly opacity: number;
};

function isMultiple(value: number, interval: number): boolean {
	const quotient = value / interval;
	return Math.abs(quotient - Math.round(quotient)) < 1e-9;
}

/**
 * The lines of one plan.
 *
 * Coarser roles own coincident lines: a major line is not also drawn as a minor
 * one, and the coarse fallback owns its own lattice. Every axis includes world
 * zero when the rectangle covers it, which is what keeps the origin stable
 * across a zoom change.
 */
export function gridLinesFor(plan: GridPlan): readonly GridLine[] {
	const { levels } = plan;
	const lines: GridLine[] = [];
	// No truncation here: the plan already bounded the minor rectangle, and a cap
	// at this point could silently omit every major line on a wide Stage.
	for (const level of levels.levels) {
		const exclusions = exclusionsFor(level, levels);
		const rect = level.role === 'minor' ? plan.minorRect : plan.rect;
		for (const axis of ['x', 'z'] as const) {
			const minimum = axis === 'x' ? rect.minX : rect.minZ;
			const maximum = axis === 'x' ? rect.maxX : rect.maxZ;
			const first = Math.ceil((minimum - 1e-9) / level.intervalMeters);
			const last = Math.floor((maximum + 1e-9) / level.intervalMeters);
			for (let index = first; index <= last; index += 1) {
				const atMeters = clean(index * level.intervalMeters);
				if (exclusions.some((excluded) => isMultiple(atMeters, excluded))) continue;
				lines.push({
					axis,
					atMeters,
					fromMeters: axis === 'x' ? rect.minZ : rect.minX,
					toMeters: axis === 'x' ? rect.maxZ : rect.maxX,
					role: level.role,
					color: level.color,
					opacity: level.opacity
				});
			}
		}
	}
	return lines;
}

/**
 * PLATE draws no grid in Shaded Plan. The preference applies to the Plan reading
 * only; the mat in 3D keeps its grid when that preference is set.
 */
export function gridIsVisible(input: {
	readonly grid: boolean;
	readonly appearance: 'paper' | 'shaded';
	readonly renderedReading: string | null;
}): boolean {
	if (!input.grid) return false;
	return !(input.appearance === 'shaded' && input.renderedReading === 'plan');
}
