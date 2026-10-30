/**
 * R217.S05 — the adaptive grid's grammar.
 *
 * The grid must stay a measured drawing at every zoom: an interval from the
 * approved `1, 2, 5 × 10^n` ladder, a fade rather than a pop, world anchoring,
 * and no drawn level below 8 CSS px. It is display-only: the origin never moves
 * across an interval change, and no view state reaches the source.
 */
import { describe, expect, it } from 'vitest';
import { Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { createGridScene } from '$lib/authoring/stage/shell/stage-grid-scene';
import {
	GRID_FULL_SPACING_CSS_PX,
	GRID_SUPPRESS_SPACING_CSS_PX,
	MAT_GRID_INK,
	PAPER_GRID_INK,
	drawnGridMinorMeters,
	gridIsVisible,
	gridDatumFootprintFor,
	gridLadderFrom,
	gridLevelsFor,
	gridLinesFor,
	gridPlanFor,
	gridRectFor
} from '$lib/authoring/stage/stage-grid';
import { STAGE_DRAFTING_DEFAULTS, snapWord } from '$lib/authoring/stage/stage-drafting';

describe('R217.S05 — grid interval decimation', () => {
	it('uses the 1, 2, 5 × 10^n ladder at or above the configured minor', () => {
		expect(gridLadderFrom(1).slice(0, 6)).toEqual([1, 2, 5, 10, 20, 50]);
		expect(gridLadderFrom(0.5).slice(0, 4)).toEqual([0.5, 1, 2, 5]);
		for (const interval of gridLadderFrom(0.01)) {
			const mantissa = interval / 10 ** Math.floor(Math.log10(interval) + 1e-9);
			expect([1, 2, 5].some((value) => Math.abs(value - mantissa) < 1e-9)).toBe(true);
		}
	});

	it('never draws a level below 8 px and keeps the chosen level at least 16 px', () => {
		for (let index = 0; index < 200; index += 1) {
			// 1e-4 m/px (very close) through 1e2 m/px (far beyond the editor's range).
			const metersPerCssPixel = 10 ** (-4 + (index / 199) * 6);
			const levels = gridLevelsFor({
				metersPerCssPixel,
				baseMinorMeters: 1,
				surface: 'paper'
			});
			expect(levels).not.toBeNull();
			if (levels === null) continue;
			for (const level of levels.levels) {
				expect(level.spacingCssPx).toBeGreaterThanOrEqual(GRID_SUPPRESS_SPACING_CSS_PX - 1e-9);
				if (level.role === 'fade') {
					expect(level.spacingCssPx).toBeLessThan(GRID_FULL_SPACING_CSS_PX);
				} else {
					expect(level.spacingCssPx).toBeGreaterThanOrEqual(GRID_FULL_SPACING_CSS_PX - 1e-9);
				}
			}
			// Major is five times the chosen minor, and the fade is the next finer
			// ladder value than the chosen level.
			expect(levels.majorMeters).toBeCloseTo(levels.minorMeters * 5, 9);
			const ladder = gridLadderFrom(0.01);
			const chosen = ladder.indexOf(levels.minorMeters);
			expect(chosen).toBeGreaterThanOrEqual(0);
			if (levels.fadingMinorMeters !== null) {
				expect(levels.fadingMinorMeters).toBe(ladder[chosen - 1]);
			}
		}
	});

	it('chooses exactly the smallest interval that reaches 16 px', () => {
		// At 0.1 m/px the 2 m line is 20 px, so 1 m (10 px) fades rather than being
		// chosen. At 0.06 m/px 1 m is 16.67 px and is chosen with no fade below it.
		const fading = gridLevelsFor({ metersPerCssPixel: 0.1, baseMinorMeters: 1, surface: 'paper' })!;
		expect(fading.minorMeters).toBe(2);
		expect(fading.fadingMinorMeters).toBe(1);
		expect(fading.levels[0]!.role).toBe('fade');
		expect(fading.levels[0]!.opacity).toBeCloseTo(PAPER_GRID_INK.minorOpacity * 0.25, 9);

		const full = gridLevelsFor({ metersPerCssPixel: 0.06, baseMinorMeters: 1, surface: 'paper' })!;
		expect(full.minorMeters).toBe(1);
		expect(full.fadingMinorMeters).toBe(0.5);
		expect(full.levels.map((level) => level.role)).toEqual(['fade', 'minor', 'major']);
	});

	it('suppresses the finer level below 8 px rather than drawing it faintly', () => {
		// 2 m at 0.3 m/px is 6.67 px: suppressed, and 5 m is the chosen minor.
		const levels = gridLevelsFor({
			metersPerCssPixel: 0.3,
			baseMinorMeters: 1,
			surface: 'paper'
		})!;
		expect(levels.minorMeters).toBe(5);
		expect(levels.fadingMinorMeters).toBeNull();
	});

	it('is anchored to world zero across interval changes', () => {
		const rect = { minX: -12.3, maxX: 12.3, minZ: -9.7, maxZ: 9.7 };
		const intervals = [0.5, 1, 2, 5, 10];
		for (const interval of intervals) {
			const plan = gridPlanFor({
				metersPerCssPixel: 0.01,
				targetPlaneHeightMeters: 8,
				aspect: 1.5,
				targetXZ: [0, 0],
				datumMeters: 0,
				baseMinorMeters: interval,
				surface: 'paper'
			})!;
			const lines = gridLinesFor({ ...plan, rect });
			expect(lines.some((line) => line.axis === 'x' && line.atMeters === 0)).toBe(true);
			expect(lines.some((line) => line.axis === 'z' && line.atMeters === 0)).toBe(true);
			// No line sits off the chosen interval's lattice; the configured value is
			// the reference, while close zoom may refine below it.
			for (const line of lines) {
				const interval = plan.levels.levels.find((level) => level.role === line.role)!.intervalMeters;
				const ratio = line.atMeters / interval;
				expect(Math.abs(ratio - Math.round(ratio))).toBeLessThan(1e-9);
			}
		}
	});

	it('lets the coarser role own a coincident line', () => {
		const plan = gridPlanFor({
			metersPerCssPixel: 0.01,
			targetPlaneHeightMeters: 8,
			aspect: 1.5,
			targetXZ: [0, 0],
			datumMeters: 0,
			baseMinorMeters: 1,
			surface: 'paper'
		})!;
		const lines = gridLinesFor(plan);
		const majors = lines.filter((line) => line.role === 'major');
		const minors = lines.filter((line) => line.role === 'minor');
		expect(majors.length).toBeGreaterThan(0);
		for (const major of majors) {
			expect(minors.some((minor) => minor.axis === major.axis && minor.atMeters === major.atMeters)).toBe(false);
		}
	});

	it('retains the same drawing for a pan inside the quantised rectangle', () => {
		const base = {
			metersPerCssPixel: 0.01,
			targetPlaneHeightMeters: 8,
			aspect: 1.5,
			datumMeters: 0,
			baseMinorMeters: 1,
			surface: 'paper' as const
		};
		const first = gridPlanFor({ ...base, targetXZ: [0, 0] })!;
		const nudged = gridPlanFor({ ...base, targetXZ: [0.02, -0.03] })!;
		expect(nudged.key).toBe(first.key);
		const moved = gridPlanFor({ ...base, targetXZ: [2, 0] })!;
		expect(moved.key).not.toBe(first.key);
	});
});

describe('R217.S05 — grid surfaces, visibility and the Grid word', () => {
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
		const paper = gridLevelsFor({ metersPerCssPixel: 0.01, baseMinorMeters: 1, surface: 'paper' })!;
		const mat = gridLevelsFor({ metersPerCssPixel: 0.01, baseMinorMeters: 1, surface: 'mat' })!;
		expect(paper.levels.find((level) => level.role === 'minor')!.color).toBe(PAPER_GRID_INK.minor);
		expect(mat.levels.find((level) => level.role === 'major')!.color).toBe(MAT_GRID_INK.major);
	});

	it('is never drawn in Shaded Plan or under Grid off, and the mat keeps it in 3D', () => {
		expect(gridIsVisible({ grid: false, appearance: 'paper', renderedReading: 'plan' })).toBe(false);
		expect(gridIsVisible({ grid: true, appearance: 'shaded', renderedReading: 'plan' })).toBe(false);
		expect(gridIsVisible({ grid: true, appearance: 'paper', renderedReading: 'plan' })).toBe(true);
		expect(gridIsVisible({ grid: true, appearance: 'shaded', renderedReading: '3d' })).toBe(true);
	});

	it('names the interval the evaluation actually draws', () => {
		expect(drawnGridMinorMeters(STAGE_DRAFTING_DEFAULTS, 0.01)).toBe(0.2);
		// At 0.1 m/px the 1 m line is below 16 px, so the Grid word reads 2 m.
		expect(drawnGridMinorMeters(STAGE_DRAFTING_DEFAULTS, 0.1)).toBe(2);
		// The configured 1 m reference is not a lower bound: close zoom refines.
		expect(snapWord(STAGE_DRAFTING_DEFAULTS, drawnGridMinorMeters(STAGE_DRAFTING_DEFAULTS, 0.01))).toBe('Snap 0.2 m');
		expect(drawnGridMinorMeters(STAGE_DRAFTING_DEFAULTS, null)).toBe(1);
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
			metersPerCssPixel: 0.01,
			targetPlaneHeightMeters: 8,
			aspect: 3840 / 2160,
			targetXZ: [0, 0],
			datumMeters: 0,
			baseMinorMeters: 1,
			surface: 'mat'
		})!;
		const lines = gridLinesFor(plan);
		expect(lines.some((line) => line.role === 'major')).toBe(true);
		// The clamp plus the 16 px minimum spacing bounds the drawing; no silent
		// global truncation may swallow a role.
		expect(lines.length).toBeLessThan(20000);
	});

	it('keeps the geometry key stable while a fade changes only its opacity', () => {
		const base = {
			targetPlaneHeightMeters: 8,
			aspect: 1.5,
			targetXZ: [0, 0] as const,
			datumMeters: 0,
			baseMinorMeters: 1,
			surface: 'paper' as const
		};
		// 1 m is 10 px at 0.1 m/px and 11.1 px at 0.09: the same fade role and
		// lattice, with a different opacity.
		const fading = gridPlanFor({ ...base, metersPerCssPixel: 0.1 })!;
		const moreFading = gridPlanFor({ ...base, metersPerCssPixel: 0.09 })!;
		expect(moreFading.key).toBe(fading.key);
		expect(moreFading.levels.levels[0]!.role).toBe('fade');
		expect(moreFading.levels.levels[0]!.opacity).not.toBeCloseTo(fading.levels.levels[0]!.opacity, 6);
	});

	it('draws both surfaces on the Stage overlay layer', () => {
		const plan = gridPlanFor({
			metersPerCssPixel: 0.01,
			targetPlaneHeightMeters: 8,
			aspect: 1.5,
			targetXZ: [0, 0],
			datumMeters: 0,
			baseMinorMeters: 1,
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
