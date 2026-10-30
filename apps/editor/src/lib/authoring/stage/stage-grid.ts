/**
 * R217.S05 — the **grid** as measured drawing.
 *
 * PLATE fixes the grid's grammar, and this module is the only implementation of
 * it:
 *
 * - minor intervals are `1, 2, 5 × 10^n` m, and major is five times minor;
 * - the chosen minor is the smallest ladder interval whose projected spacing at
 *   the target plane is at least 16 CSS pixels;
 * - the next finer interval fades linearly from 16 to 8 px and is suppressed
 *   below 8 px, so an interval change is a cross-fade rather than a jump;
 * - lines are anchored to world `(0, datum, 0)` and generated only inside the
 *   visible rectangle plus one interval of margin;
 * - Paper and the mat have their own inks from PLATE §Semantic color.
 *
 * The grid is display-only. It is never a pick source, never delays navigation
 * and never writes a pose, source, history or Save entry.
 */
import { isGridMinorMeters, type StageDraftingState } from './stage-drafting';

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
/** PLATE's reference minor interval. */
export const GRID_REFERENCE_MINOR_METERS = 1;

export type GridLevelRole = 'fade' | 'minor' | 'major';

/** One drawn interval level, with the spacing that decides its opacity. */
export type GridLevel = {
	readonly intervalMeters: number;
	readonly role: GridLevelRole;
	readonly spacingCssPx: number;
	readonly opacity: number;
	readonly color: string;
};

export type GridLevels = {
	/** The chosen minor interval (full ink). */
	readonly minorMeters: number;
	/** `5 × minor`. */
	readonly majorMeters: number;
	/** The fading finer interval, when one is still visible. */
	readonly fadingMinorMeters: number | null;
	/** In draw order: fade, minor, major. */
	readonly levels: readonly GridLevel[];
};

function clean(value: number): number {
	return Math.round(value * 1e9) / 1e9;
}

/** Every `1, 2, 5 × 10^n` value at or above `base`, ascending. */
export function gridLadderFrom(baseMinorMeters: number): readonly number[] {
	const values = new Set<number>();
	for (let exponent = -6; exponent <= 6; exponent += 1) {
		for (const mantissa of [1, 2, 5]) {
			const value = clean(mantissa * 10 ** exponent);
			if (value >= baseMinorMeters * (1 - 1e-9)) values.add(value);
		}
	}
	return [...values].sort((a, b) => a - b);
}

/**
 * The interval levels for one scale and surface.
 *
 * The chosen minor already guarantees at least 16 px. The immediately finer
 * ladder value is still drawn while it is at least 8 px, at the linear fade
 * that makes a ladder change continuous.
 */
export function gridLevelsFor(input: {
	readonly metersPerCssPixel: number;
	readonly baseMinorMeters: number;
	readonly intervalMode?: 'automatic' | 'override';
	readonly surface: GridSurface;
}): GridLevels | null {
	const { metersPerCssPixel, baseMinorMeters, surface } = input;
	const intervalMode = input.intervalMode ?? 'automatic';
	if (!Number.isFinite(metersPerCssPixel) || metersPerCssPixel <= 0) return null;
	if (!isGridMinorMeters(baseMinorMeters)) return null;
	const ink = surface === 'paper' ? PAPER_GRID_INK : MAT_GRID_INK;
	// Automatic follows scale across the full ladder. Override uses the selected
	// interval as its finest full-ink level, while scale can still coarsen it when
	// the selected lines would fall below 16 px.
	const ladder = gridLadderFrom(intervalMode === 'override' ? baseMinorMeters : 0.01);
	const primaryIndex = ladder.findIndex(
		(interval) => interval / metersPerCssPixel >= GRID_FULL_SPACING_CSS_PX - 1e-9
	);
	if (primaryIndex < 0) return null;
	const minorMeters = ladder[primaryIndex]!;
	const majorMeters = clean(minorMeters * 5);
	const levels: GridLevel[] = [];
	let fadingMinorMeters: number | null = null;

	if (primaryIndex > 0) {
		const finer = ladder[primaryIndex - 1]!;
		const spacingCssPx = finer / metersPerCssPixel;
		if (
			spacingCssPx >= GRID_SUPPRESS_SPACING_CSS_PX - 1e-9 &&
			spacingCssPx < GRID_FULL_SPACING_CSS_PX - 1e-9
		) {
			const fade = Math.min(
				1,
				Math.max(0, (spacingCssPx - GRID_SUPPRESS_SPACING_CSS_PX) / 8)
			);
			if (fade > 0) {
				fadingMinorMeters = finer;
				levels.push({
					intervalMeters: finer,
					role: 'fade',
					spacingCssPx,
					opacity: ink.minorOpacity * fade,
					color: ink.minor
				});
			}
		}
	}

	levels.push({
		intervalMeters: minorMeters,
		role: 'minor',
		spacingCssPx: minorMeters / metersPerCssPixel,
		opacity: ink.minorOpacity,
		color: ink.minor
	});
	levels.push({
		intervalMeters: majorMeters,
		role: 'major',
		spacingCssPx: majorMeters / metersPerCssPixel,
		opacity: ink.majorOpacity,
		color: ink.major
	});

	return { minorMeters, majorMeters, fadingMinorMeters, levels };
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
 * The datum-plane rectangle the mat actually shows, from the evaluation's own
 * four viewport-corner rays.
 *
 * A fixed multiple of the target plane was only correct while the Camera looked
 * straight down: a tilted 3D view sees the datum much farther than 3 target
 * heights, so the grid ended in a visible straight cut. This intersects each
 * corner ray with the datum plane and clamps the result to a bounded multiple of
 * the target-plane size. Below the horizon a corner ray has no forward hit; the
 * clamp is what keeps that case finite instead of drawing to infinity.
 *
 * Returns `null` when fewer than two corners meet the datum; the caller then
 * falls back to the symmetric rectangle. It composes no pose and reads no Camera
 * state beyond the matrices and rect the evaluation already published.
 */
export function gridDatumFootprintFor(input: {
	readonly inverseViewProjectionMatrix: readonly number[];
	readonly rect: { readonly width: number; readonly height: number };
	readonly datumMeters: number;
	readonly targetXZ: readonly [number, number];
	readonly targetPlaneHeightMeters: number;
	readonly aspect: number;
	/** Symmetric half-extent clamp, in target-plane heights. */
	readonly maxHalfExtents?: number;
}): GridRect | null {
	const matrix = input.inverseViewProjectionMatrix;
	if (!Array.isArray(matrix) || matrix.length !== 16) return null;
	if (!(input.rect.width > 0) || !(input.rect.height > 0)) return null;
	const height = Math.max(0.001, input.targetPlaneHeightMeters);
	const width = height * Math.max(0.1, input.aspect);
	const clampExtent = Math.max(2, (input.maxHalfExtents ?? 24) * Math.max(width, height));
	const points: { readonly x: number; readonly z: number }[] = [];
	for (const ndcX of [-1, 1] as const) {
		for (const ndcY of [-1, 1] as const) {
			const near = unprojectPoint(matrix, ndcX, ndcY, -1);
			const far = unprojectPoint(matrix, ndcX, ndcY, 1);
			if (near === null || far === null) continue;
			const directionY = far[1] - near[1];
			if (Math.abs(directionY) < 1e-9) continue;
			const travel = (input.datumMeters - near[1]) / directionY;
			if (!(travel > 0) || !Number.isFinite(travel)) continue;
			const x = near[0] + (far[0] - near[0]) * travel;
			const z = near[2] + (far[2] - near[2]) * travel;
			if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
			points.push({
				x: Math.min(input.targetXZ[0] + clampExtent, Math.max(input.targetXZ[0] - clampExtent, x)),
				z: Math.min(input.targetXZ[1] + clampExtent, Math.max(input.targetXZ[1] - clampExtent, z))
			});
		}
	}
	if (points.length < 2) return null;
	// The target-plane rect is always visible, so the footprint is its union with
	// the ray hits. This also covers a corner ray that lands behind a near plane.
	const nearHalfX = Math.max(2, width * 0.75);
	const nearHalfZ = Math.max(2, height * 0.75);
	let minX = input.targetXZ[0] - nearHalfX;
	let maxX = input.targetXZ[0] + nearHalfX;
	let minZ = input.targetXZ[1] - nearHalfZ;
	let maxZ = input.targetXZ[1] + nearHalfZ;
	for (const point of points) {
		minX = Math.min(minX, point.x);
		maxX = Math.max(maxX, point.x);
		minZ = Math.min(minZ, point.z);
		maxZ = Math.max(maxZ, point.z);
	}
	return { minX, maxX, minZ, maxZ };
}

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
	/** Changes only when the drawing itself changes (interval, fade, rectangle). */
	readonly key: string;
	readonly surface: GridSurface;
	readonly datumMeters: number;
	readonly levels: GridLevels;
	readonly rect: GridRect;
};

/** One complete grid drawing for one evaluation and surface. */
export function gridPlanFor(input: {
	readonly metersPerCssPixel: number;
	readonly targetPlaneHeightMeters: number;
	readonly aspect: number;
	readonly targetXZ: readonly [number, number];
	readonly datumMeters: number;
	readonly baseMinorMeters: number;
	readonly intervalMode?: 'automatic' | 'override';
	readonly surface: GridSurface;
	/** The Camera evaluation's corner-ray source, when one is available. */
	readonly inverseViewProjectionMatrix?: readonly number[];
	readonly viewport?: { readonly width: number; readonly height: number };
}): GridPlan | null {
	const levels = gridLevelsFor(input);
	if (levels === null) return null;
	const visible =
		input.surface === 'mat' &&
		input.inverseViewProjectionMatrix !== undefined &&
		input.viewport !== undefined
			? gridDatumFootprintFor({
					inverseViewProjectionMatrix: input.inverseViewProjectionMatrix,
					rect: input.viewport,
					datumMeters: input.datumMeters,
					targetXZ: input.targetXZ,
					targetPlaneHeightMeters: input.targetPlaneHeightMeters,
					aspect: input.aspect
				})
			: null;
	const rect = gridRectFor({
		targetXZ: input.targetXZ,
		targetPlaneHeightMeters: input.targetPlaneHeightMeters,
		aspect: input.aspect,
		intervalMeters: levels.minorMeters,
		// A perspective mat sees the datum far beyond the target plane; Paper is
		// exactly orthographic, so its drawing only needs the visible sheet.
		coverage: input.surface === 'mat' ? 3 : 0.75,
		visible
	});
	// Opacity is deliberately absent: the fade changes continuously while zooming,
	// but the lattice does not. A rebuild keyed on opacity would dispose and
	// regenerate every line on nearly every frame; the renderer updates the
	// existing materials instead.
	const levelKey = levels.levels
		.map((level) => `${level.role}:${level.intervalMeters}`)
		.join('|');
	return {
		key: `${input.surface}:${input.datumMeters}:${levelKey}:${rect.minX}:${rect.maxX}:${rect.minZ}:${rect.maxZ}`,
		surface: input.surface,
		datumMeters: input.datumMeters,
		levels,
		rect
	};
}

/** One grid line, still in whole-meter world coordinates. */
export type GridLine = {
	readonly axis: 'x' | 'z';
	readonly atMeters: number;
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
 * one, and a fading interval does not repaint the chosen minor. Every axis
 * includes world zero when the rectangle covers it, which is what keeps the
 * origin stable across interval changes.
 */
export function gridLinesFor(plan: GridPlan): readonly GridLine[] {
	const { rect, levels } = plan;
	const lines: GridLine[] = [];
	// No global truncation: the interval is chosen so spacing is at least 16 px and
	// the mat footprint is clamped, which bounds the count by the viewport rather
	// than by an arbitrary number. A cap here could silently omit every major line
	// on a wide Stage, which is worse than drawing the bounded patch.
	for (const level of levels.levels) {
		const exclusions: number[] = [];
		if (level.role === 'minor') exclusions.push(levels.majorMeters);
		if (level.role === 'fade') exclusions.push(levels.minorMeters, levels.majorMeters);
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

/** The Grid word's interval: the level in force at this evaluation. */
export function drawnGridMinorMeters(
	state: StageDraftingState,
	metersPerCssPixel: number | null
): number {
	const fallback = state.gridIntervalMode === 'override' ? state.gridMinorMeters : GRID_REFERENCE_MINOR_METERS;
	if (metersPerCssPixel === null) return fallback;
	const levels = gridLevelsFor({
		metersPerCssPixel,
		baseMinorMeters: state.gridMinorMeters,
		intervalMode: state.gridIntervalMode,
		surface: 'paper'
	});
	return levels?.minorMeters ?? fallback;
}
