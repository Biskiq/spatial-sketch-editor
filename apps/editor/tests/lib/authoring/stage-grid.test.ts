/**
 * R217.S13 — the fixed grid's grammar.
 *
 * The grid must stay a measured drawing at every zoom: fixed 1 m and 5 m levels,
 * a fade rather than a pop, a 25 m fallback only after 5 m hides, world
 * anchoring, and no drawn level below 8 CSS px. Paper draws a bounded sheet
 * around the work; the mat keeps its real datum footprint. It is display-only:
 * the origin never moves across a zoom change, and no view state reaches the
 * source.
 */
import { describe, expect, it } from 'vitest';
import { Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { createGridScene } from '$lib/authoring/stage/shell/stage-grid-scene';
import { GRID_MAJOR_METERS, GRID_MINOR_METERS } from '$lib/authoring/stage/stage-drafting';
import {
	GRID_COARSE_METERS,
	GRID_FULL_SPACING_CSS_PX,
	GRID_SUPPRESS_SPACING_CSS_PX,
	MAT_GRID_INK,
	PAPER_GRID_INK,
	gridIsVisible,
	gridDatumFootprintFor,
	gridLevelsFor,
	gridLinesFor,
	gridPlanFor,
	gridRectFor,
	paperSheetRectFor
} from '$lib/authoring/stage/stage-grid';

const PAPER_BASE = {
	targetPlaneHeightMeters: 8,
	aspect: 1.5,
	targetXZ: [0, 0] as const,
	datumMeters: 0,
	surface: 'paper' as const
};

describe('R217.S13 — fixed grid values and thinning', () => {
	it('draws only the fixed 1 m, 5 m and 25 m values', () => {
		for (let index = 0; index < 200; index += 1) {
			// 1e-4 m/px (very close) through 1e2 m/px (far beyond the editor's range).
			const metersPerCssPixel = 10 ** (-4 + (index / 199) * 6);
			const levels = gridLevelsFor({ metersPerCssPixel, surface: 'paper' });
			if (levels === null) continue;
			for (const level of levels.levels) {
				expect([GRID_MINOR_METERS, GRID_MAJOR_METERS, GRID_COARSE_METERS]).toContain(
					level.intervalMeters
				);
			}
		}
	});

	it('fades each level from 16 to 8 px and hides it below 8', () => {
		for (let index = 0; index < 200; index += 1) {
			const metersPerCssPixel = 10 ** (-4 + (index / 199) * 6);
			const levels = gridLevelsFor({ metersPerCssPixel, surface: 'paper' });
			if (levels === null) continue;
			for (const level of levels.levels) {
				expect(level.spacingCssPx).toBeGreaterThanOrEqual(GRID_SUPPRESS_SPACING_CSS_PX - 1e-9);
				const full = level.role === 'minor'
					? PAPER_GRID_INK.minorOpacity
					: PAPER_GRID_INK.majorOpacity;
				if (level.spacingCssPx >= GRID_FULL_SPACING_CSS_PX - 1e-9) {
					expect(level.opacity).toBeCloseTo(full, 9);
				} else {
					expect(level.opacity).toBeGreaterThan(0);
					expect(level.opacity).toBeLessThan(full);
				}
			}
		}
	});

	it('thins with zoom instead of changing the values', () => {
		// 0.01 m/px: 1 m is 100 px and 5 m 500 px, both full ink.
		const close = gridLevelsFor({ metersPerCssPixel: 0.01, surface: 'paper' })!;
		expect(close.levels.map((level) => level.role)).toEqual(['minor', 'major']);
		expect(close.minorMeters).toBe(1);
		expect(close.majorMeters).toBe(5);
		expect(close.coarseMeters).toBeNull();

		// 0.1 m/px: 1 m is 10 px and fades; 5 m remains full.
		const fading = gridLevelsFor({ metersPerCssPixel: 0.1, surface: 'paper' })!;
		expect(fading.levels.map((level) => level.role)).toEqual(['minor', 'major']);
		expect(fading.levels[0]!.intervalMeters).toBe(1);
		expect(fading.levels[0]!.opacity).toBeCloseTo(PAPER_GRID_INK.minorOpacity * 0.25, 9);

		// 0.3 m/px: 1 m is 3.3 px and hidden; 5 m is 16.67 px and full.
		const sparse = gridLevelsFor({ metersPerCssPixel: 0.3, surface: 'paper' })!;
		expect(sparse.levels.map((level) => level.role)).toEqual(['major']);
		expect(sparse.minorMeters).toBe(5);
		expect(sparse.coarseMeters).toBeNull();
	});

	it('shows 25 m only after 5 m has hidden, and hides it by the same rule', () => {
		// 0.5 m/px: 5 m is exactly 10 px (fading), so 25 m is not added yet.
		const fadingMajor = gridLevelsFor({ metersPerCssPixel: 0.5, surface: 'paper' })!;
		expect(fadingMajor.levels.map((level) => level.role)).toEqual(['major']);
		expect(fadingMajor.coarseMeters).toBeNull();

		// 0.7 m/px: 5 m is below 8 px and 25 m is 35.7 px, so the fallback appears.
		const coarse = gridLevelsFor({ metersPerCssPixel: 0.7, surface: 'paper' })!;
		expect(coarse.levels.map((level) => level.role)).toEqual(['coarse']);
		expect(coarse.minorMeters).toBe(25);
		expect(coarse.coarseMeters).toBe(25);

		// 4 m/px: 25 m is 6.25 px; the ruler is now the only reference.
		expect(gridLevelsFor({ metersPerCssPixel: 4, surface: 'paper' })).toBeNull();
	});

	it('is anchored to world zero at every zoom', () => {
		const rect = { minX: -12.3, maxX: 12.3, minZ: -9.7, maxZ: 9.7 };
		for (const metersPerCssPixel of [0.001, 0.05, 0.1, 0.4, 0.7]) {
			const plan = gridPlanFor({ ...PAPER_BASE, metersPerCssPixel });
			if (plan === null) continue;
			const lines = gridLinesFor({ ...plan, rect });
			expect(lines.some((line) => line.axis === 'x' && line.atMeters === 0)).toBe(true);
			expect(lines.some((line) => line.axis === 'z' && line.atMeters === 0)).toBe(true);
			for (const line of lines) {
				const interval = plan.levels.levels.find((level) => level.role === line.role)!.intervalMeters;
				const ratio = line.atMeters / interval;
				expect(Math.abs(ratio - Math.round(ratio))).toBeLessThan(1e-9);
			}
		}
	});

	it('lets the coarser role own a coincident line', () => {
		const plan = gridPlanFor({ ...PAPER_BASE, metersPerCssPixel: 0.01 })!;
		const lines = gridLinesFor(plan);
		const majors = lines.filter((line) => line.role === 'major');
		const minors = lines.filter((line) => line.role === 'minor');
		expect(majors.length).toBeGreaterThan(0);
		for (const major of majors) {
			expect(minors.some((minor) => minor.axis === major.axis && minor.atMeters === major.atMeters)).toBe(false);
		}
	});

	it('uses PLATE’s Paper and mat inks', () => {
		expect(PAPER_GRID_INK).toEqual({
			minor: '#9FB2A2',
			major: '#809984',
			minorOpacity: 0.28,
			majorOpacity: 0.45
		});
		expect(MAT_GRID_INK).toEqual({
			minor: '#2B5147',
			major: '#3C6A5C',
			minorOpacity: 1,
			majorOpacity: 1
		});
		const paper = gridLevelsFor({ metersPerCssPixel: 0.01, surface: 'paper' })!;
		const mat = gridLevelsFor({ metersPerCssPixel: 0.01, surface: 'mat' })!;
		expect(paper.levels.find((level) => level.role === 'minor')!.color).toBe(PAPER_GRID_INK.minor);
		expect(mat.levels.find((level) => level.role === 'major')!.color).toBe(MAT_GRID_INK.major);
	});
});

describe('R217.S13 — Paper’s bounded sheet', () => {
	const content = { minX: 0, maxX: 7, minZ: -4, maxZ: 2 };

	it('contains the work plus 5 m, rounded outward to 5 m', () => {
		const sheet = paperSheetRectFor({
			...PAPER_BASE,
			targetPlaneHeightMeters: 40,
			aspect: 2,
			intervalMeters: 1,
			contentBounds: content
		})!;
		expect(sheet).toEqual({ minX: -5, maxX: 15, minZ: -10, maxZ: 10 });
		expect(sheet.minX).toBeLessThanOrEqual(content.minX - 5);
		expect(sheet.maxX).toBeGreaterThanOrEqual(content.maxX + 5);
		for (const edge of [sheet.minX, sheet.maxX, sheet.minZ, sheet.maxZ]) {
			expect(Math.abs(edge % 5)).toBe(0);
		}
	});

	it('intersects the sheet with the visible coverage so a zoomed-in view stays bounded', () => {
		const close = paperSheetRectFor({
			...PAPER_BASE,
			targetPlaneHeightMeters: 2,
			intervalMeters: 1,
			contentBounds: content
		})!;
		expect(close.maxX - close.minX).toBeLessThan(18);
		expect(close.maxZ - close.minZ).toBeLessThan(16);
		const plan = gridPlanFor({
			...PAPER_BASE,
			metersPerCssPixel: 0.0005,
			targetPlaneHeightMeters: 2,
			contentBounds: content
		})!;
		expect(gridLinesFor(plan).length).toBeLessThan(500);
	});

	it('uses a 20 × 20 m sheet around the target for an empty project', () => {
		const sheet = paperSheetRectFor({
			...PAPER_BASE,
			targetXZ: [3.4, -2.2],
			targetPlaneHeightMeters: 60,
			aspect: 2,
			intervalMeters: 1,
			contentBounds: null
		})!;
		expect(sheet).toEqual({ minX: -6.6, maxX: 13.4, minZ: -12.2, maxZ: 7.8 });
		expect(sheet.maxX - sheet.minX).toBe(20);
		expect(sheet.maxZ - sheet.minZ).toBe(20);
	});

	it('grows when content leaves the sheet, without a Camera input', () => {
		// A wide target plane keeps both sheets inside the visible coverage, so
		// the growth is observable rather than cropped to the viewport.
		const wide = { ...PAPER_BASE, targetPlaneHeightMeters: 80, aspect: 2 };
		const near = gridPlanFor({ ...wide, metersPerCssPixel: 0.01, contentBounds: content })!;
		const far = gridPlanFor({
			...wide,
			metersPerCssPixel: 0.01,
			contentBounds: { minX: 0, maxX: 40, minZ: -4, maxZ: 2 }
		})!;
		expect(far.rect.maxX).toBeGreaterThan(near.rect.maxX);
		expect(near.rect.minX).toBe(-5);
	});

	it('retains the same drawing for a pan inside the quantised rectangle', () => {
		const base = { ...PAPER_BASE, metersPerCssPixel: 0.01, contentBounds: content };
		const first = gridPlanFor({ ...base, targetXZ: [0, 0] })!;
		const nudged = gridPlanFor({ ...base, targetXZ: [0.02, -0.03] })!;
		expect(nudged.key).toBe(first.key);
	});
});

describe('R217.S14 — Paper’s sheet includes the live candidate', () => {
	const content = { minX: 0, maxX: 7, minZ: -4, maxZ: 2 };
	const wide = { ...PAPER_BASE, targetPlaneHeightMeters: 80, aspect: 2, intervalMeters: 1 };

	it('grows past the accepted work without moving the Camera inputs', () => {
		const accepted = paperSheetRectFor({ ...wide, contentBounds: content })!;
		const grown = paperSheetRectFor({
			...wide,
			contentBounds: content,
			candidateBounds: { minX: 30, maxX: 33, minZ: -4, maxZ: 2 }
		})!;
		expect(grown.maxX).toBeGreaterThan(accepted.maxX);
		expect(grown.maxX).toBeGreaterThanOrEqual(38);
		expect(grown.minX).toBe(accepted.minX);
	});

	it('frames a candidate drawn on an otherwise empty project', () => {
		const sheet = paperSheetRectFor({
			...wide,
			targetXZ: [0, 0],
			contentBounds: null,
			candidateBounds: { minX: 24, maxX: 26, minZ: 0, maxZ: 2 }
		})!;
		expect(sheet.minX).toBeLessThanOrEqual(19);
		expect(sheet.maxX).toBeGreaterThanOrEqual(31);
	});
});

describe('R217.S05 — surfaces, visibility and the mat footprint', () => {
	it('is never drawn in Shaded Plan or under Grid off, and the mat keeps it in 3D', () => {
		expect(gridIsVisible({ grid: false, appearance: 'paper', renderedReading: 'plan' })).toBe(false);
		expect(gridIsVisible({ grid: true, appearance: 'shaded', renderedReading: 'plan' })).toBe(false);
		expect(gridIsVisible({ grid: true, appearance: 'paper', renderedReading: 'plan' })).toBe(true);
		expect(gridIsVisible({ grid: true, appearance: 'shaded', renderedReading: '3d' })).toBe(true);
	});

	it('covers the tilted mat’s actual datum footprint instead of a fixed multiple', () => {
		// A normal 3D inspection pose, not a top-down one: the top-of-frame ray meets
		// the datum far beyond three target-plane heights, which is where the old
		// fixed coverage ended the grid in a visible straight cut.
		const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 2000);
		camera.position.set(0, 12, 14);
		camera.lookAt(0, 0, 0);
		camera.updateMatrixWorld();
		camera.updateProjectionMatrix();
		const inverse = new Matrix4()
			.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
			.invert().elements;
		const inverseMatrix = new Matrix4().fromArray(inverse);
		const groundAt = (ndcX: number, ndcY: number): readonly [number, number] => {
			const near = new Vector3(ndcX, ndcY, -1).applyMatrix4(inverseMatrix);
			const far = new Vector3(ndcX, ndcY, 1).applyMatrix4(inverseMatrix);
			const directionY = far.y - near.y;
			const travel = -near.y / directionY;
			return [near.x + (far.x - near.x) * travel, near.z + (far.z - near.z) * travel];
		};
		const footprint = gridDatumFootprintFor({
			inverseViewProjectionMatrix: inverse,
			rect: { width: 1600, height: 900 },
			datumMeters: 0,
			targetXZ: [0, 0],
			targetPlaneHeightMeters: 8,
			aspect: 16 / 9
		});
		expect(footprint).not.toBeNull();
		if (footprint === null) return;
		for (const ndcY of [-0.9, -0.5, 0]) {
			const [x, z] = groundAt(0, ndcY);
			expect(x).toBeGreaterThanOrEqual(footprint.minX - 1e-6);
			expect(x).toBeLessThanOrEqual(footprint.maxX + 1e-6);
			expect(z).toBeGreaterThanOrEqual(footprint.minZ - 1e-6);
			expect(z).toBeLessThanOrEqual(footprint.maxZ + 1e-6);
		}
		// More than the old 3 × 8 m fallback reaches toward the visible datum.
		const extent = Math.max(footprint.maxX - footprint.minX, footprint.maxZ - footprint.minZ);
		expect(extent).toBeGreaterThan(3 * 8);
	});

	it('draws every major line on a wide Stage and stays bounded by the viewport', () => {
		const plan = gridPlanFor({
			...PAPER_BASE,
			metersPerCssPixel: 0.01,
			targetPlaneHeightMeters: 8,
			aspect: 3840 / 2160,
			surface: 'mat'
		})!;
		const lines = gridLinesFor(plan);
		expect(lines.some((line) => line.role === 'major')).toBe(true);
		// The clamp plus the 16 px minimum spacing bounds the drawing; no silent
		// global truncation may swallow a role.
		expect(lines.length).toBeLessThan(20000);
	});

	it('keeps the geometry key stable while a fade changes only its opacity', () => {
		// 1 m is 10 px at 0.1 m/px and 11.1 px at 0.09: the same level and lattice,
		// with a different opacity.
		const fading = gridPlanFor({ ...PAPER_BASE, metersPerCssPixel: 0.1 })!;
		const moreFading = gridPlanFor({ ...PAPER_BASE, metersPerCssPixel: 0.09 })!;
		expect(moreFading.key).toBe(fading.key);
		expect(moreFading.levels.levels[0]!.role).toBe('minor');
		expect(moreFading.levels.levels[0]!.opacity).not.toBeCloseTo(fading.levels.levels[0]!.opacity, 6);
	});

	it('draws both surfaces on the Stage overlay layer', () => {
		const plan = gridPlanFor({
			...PAPER_BASE,
			metersPerCssPixel: 0.01,
			surface: 'mat'
		})!;
		const scene = createGridScene(plan);
		for (const child of scene.group.children) {
			expect(child.layers.mask).toBe(1 << 2);
		}
		scene.dispose();
	});

	it('builds a bounded visible rectangle with one interval of margin', () => {
		const rect = gridRectFor({
			targetXZ: [0, 0],
			targetPlaneHeightMeters: 8,
			aspect: 1,
			intervalMeters: 1
		});
		// 8 m tall / 8 m wide at aspect 1, plus 75% margin on each side, one more
		// interval: quantised to whole intervals, so the rectangle is stable.
		expect(rect.maxX - rect.minX).toBeGreaterThan(8);
		expect(rect.maxZ - rect.minZ).toBeGreaterThan(8);
		expect(Number.isInteger(rect.minX)).toBe(true);
		expect(Number.isInteger(rect.maxZ)).toBe(true);
	});
});
