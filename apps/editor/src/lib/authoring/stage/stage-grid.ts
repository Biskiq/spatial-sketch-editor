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
 * - Paper's rectangle is a bounded sheet around the work, drawn as lines;
 * - the mat's grid is drawn per pixel on the finite mat (R217.S19): each pixel
 *   fades each level by its own projected spacing, so a perspective view keeps
 *   1 m near the eye, 5 m further out and 25 m toward the horizon;
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
	/** Half-extent as a multiple of the target-plane size. */
	readonly coverage?: number;
}): GridRect {
	const height = Math.max(0.001, input.targetPlaneHeightMeters);
	const width = height * Math.max(0.1, input.aspect);
	const coverage = Math.max(0.25, input.coverage ?? 0.75);
	const interval = Math.max(1e-6, input.intervalMeters);
	const margin = (input.marginIntervals ?? 1) * interval;
	// The rectangle follows the **quantised centre**, so a pan smaller than half
	// an interval cannot move an edge across a boundary.
	const centerX = Math.round(input.targetXZ[0] / interval) * interval;
	const centerZ = Math.round(input.targetXZ[1] / interval) * interval;
	const minX = centerX - Math.max(2, width * coverage);
	const maxX = centerX + Math.max(2, width * coverage);
	const minZ = centerZ - Math.max(2, height * coverage);
	const maxZ = centerZ + Math.max(2, height * coverage);
	// The rectangle's edges are quantised so a small pan does not rebuild the
	// drawing. Lines stay anchored to world zero because only the rectangle's
	// edges are quantised, never the lattice.
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

export type GridPlan = {
	/** Changes only when the drawing itself changes (levels or rectangle). */
	readonly key: string;
	/** Paper only; the mat's grid is drawn per pixel (`shell/stage-mat-grid.ts`). */
	readonly surface: 'paper';
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
	/** Paper only: the mat's grid is drawn per pixel by `stage-mat-grid`. */
	readonly surface: 'paper';
	/** Layout ∪ Scene datum bounds; Paper draws a bounded sheet around them. */
	readonly contentBounds?: GridRect | null;
	/** The live candidate's world extent; Paper's sheet grows to include it. */
	readonly candidateBounds?: GridRect | null;
}): GridPlan | null {
	const levels = gridLevelsFor(input);
	if (levels === null) return null;
	const rect = paperSheetRectFor({
		targetXZ: input.targetXZ,
		targetPlaneHeightMeters: input.targetPlaneHeightMeters,
		aspect: input.aspect,
		intervalMeters: levels.minorMeters,
		contentBounds: input.contentBounds ?? null,
		candidateBounds: input.candidateBounds ?? null
	});
	if (rect === null) return null;
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
 * one, and the coarse fallback owns its own lattice. Every axis includes world
 * zero when the rectangle covers it, which is what keeps the origin stable
 * across a zoom change.
 */
export function gridLinesFor(plan: GridPlan): readonly GridLine[] {
	const { rect, levels } = plan;
	const lines: GridLine[] = [];
	// No global truncation: the fixed levels and the bounded rectangles already
	// bound the count by the viewport. A cap here could silently omit every major
	// line on a wide Stage, which is worse than drawing the bounded patch.
	for (const level of levels.levels) {
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
 * R217.S19 — the mat grid's per-pixel level weights.
 *
 * The mat is a perspective surface, so one zoom-wide fade could never suit both
 * the ground at the eye and the ground at the horizon: the whole lattice faded
 * together, and while the 5 m level faded out nothing replaced it until it was
 * gone. The mat applies the grammar's 16 → 8 px fade **per pixel**, from that
 * pixel's own projected spacing, and the 25 m level cross-fades in as the 5 m
 * level fades out, so some reference is always inked. The shader in
 * `shell/stage-mat-grid.ts` computes exactly these weights; this function is
 * their testable twin.
 *
 * `minorSpacingCssPx` is the projected spacing of 1 m lines at the pixel.
 */
export function matGridLevelWeights(minorSpacingCssPx: number): {
	readonly minor: number;
	readonly major: number;
	readonly coarse: number;
} {
	const fade = (spacing: number): number =>
		Math.min(
			1,
			Math.max(
				0,
				(spacing - GRID_SUPPRESS_SPACING_CSS_PX) /
					(GRID_FULL_SPACING_CSS_PX - GRID_SUPPRESS_SPACING_CSS_PX)
			)
		);
	const minor = fade(minorSpacingCssPx * GRID_MINOR_METERS);
	const major = fade(minorSpacingCssPx * GRID_MAJOR_METERS);
	const coarse = fade(minorSpacingCssPx * GRID_COARSE_METERS) * (1 - major);
	return { minor, major, coarse };
}

/** The finite mat ground: a square on the datum, as a centre and a half-extent. */
export type MatGround = {
	readonly centerXZ: readonly [number, number];
	readonly halfExtentMeters: number;
	/**
	 * The centre's offset from the nearest 25 m lattice point. The grid shader
	 * adds it to the quad's local coordinates, so every level stays anchored to
	 * world zero without carrying large world coordinates into float32.
	 */
	readonly latticeOffsetXZ: readonly [number, number];
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
	const centerXZ: [number, number] = [
		Math.round(evaluation.target[0] / step) * step,
		Math.round(evaluation.target[2] / step) * step
	];
	return {
		centerXZ,
		halfExtentMeters,
		latticeOffsetXZ: [
			centerXZ[0] - Math.round(centerXZ[0] / GRID_COARSE_METERS) * GRID_COARSE_METERS,
			centerXZ[1] - Math.round(centerXZ[1] / GRID_COARSE_METERS) * GRID_COARSE_METERS
		]
	};
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
