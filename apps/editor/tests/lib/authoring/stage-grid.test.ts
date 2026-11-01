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
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LineSegments, ShaderMaterial } from 'three';
import {
	VIEWPORT_NEAR_FLOOR_METERS,
	type InspectionPose,
	type Vec3,
	type ViewportEvaluation
} from '@portfolio/camera-core';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core';
import { createCameraSession, sceneRadiusOf } from '$lib/authoring/stage/camera-session';
import { admitSource, type StageReadSnapshot } from '$lib/authoring/stage/source-admission';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { PAPER_GROUND_INK } from '$lib/authoring/stage/paper-plan';
import { createGridScene } from '$lib/authoring/stage/shell/stage-grid-scene';
import {
	createMatGridMaterial,
	createMatGroundMaterial,
	MAT_GRID_RENDER_ORDER,
	MAT_GROUND_POLYGON_OFFSET_UNITS,
	updateMatGridMaterial
} from '$lib/authoring/stage/shell/stage-mat-grid';
import { GRID_MAJOR_METERS, GRID_MINOR_METERS } from '$lib/authoring/stage/stage-drafting';
import {
	GRID_COARSE_METERS,
	GRID_FULL_SPACING_CSS_PX,
	GRID_SUPPRESS_SPACING_CSS_PX,
	MAT_GRID_INK,
	PAPER_GRID_INK,
	gridIsVisible,
	gridLevelsFor,
	gridLinesFor,
	gridPlanFor,
	gridRectFor,
	matGridLevelWeights,
	matGroundFor,
	paperSheetRectFor,
	workspaceRectFor,
	type GridRect
} from '$lib/authoring/stage/stage-grid';

const PAPER_BASE = {
	targetPlaneHeightMeters: 8,
	aspect: 1.5,
	targetXZ: [0, 0] as const,
	datumMeters: 0,
	surface: 'paper' as const
};

describe('the mat keeps its depth away from a floor on the datum', () => {
	it('subdivides the mat and pushes it back in depth steps', () => {
		const source = readFileSync(resolve(process.cwd(), 'src/lib/authoring/stage/shell/StageMatGround.svelte'), 'utf8');
		const mat = source.slice(source.indexOf('<T.Mesh'), source.indexOf('{#if gridVisible}'));
		expect(mat).toContain('args={[1, 1, MAT_GRID_SEGMENTS, MAT_GRID_SEGMENTS]}');
		const material = createMatGroundMaterial();
		expect(material.polygonOffset).toBe(true);
		expect(material.polygonOffsetUnits).toBe(MAT_GROUND_POLYGON_OFFSET_UNITS);
		expect(material.depthWrite).toBe(true);
		material.dispose();
		expect(MAT_GROUND_POLYGON_OFFSET_UNITS).toBeGreaterThan(0);
	});
});

describe('the Paper plate around the work', () => {
	const DEFAULT = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };

	it('keeps its default size for no work and for any work that fits', () => {
		expect(workspaceRectFor(null)).toEqual(DEFAULT);
		for (const contentBounds of [
			{ minX: 0, maxX: 1, minZ: 0, maxZ: 1 },
			{ minX: 0, maxX: 6, minZ: -5, maxZ: 0 },
			{ minX: -10, maxX: 10, minZ: -10, maxZ: 10 }
		]) {
			expect(workspaceRectFor(contentBounds)).toEqual(DEFAULT);
		}
	});

	it('widens only the side the work and its margin pass, in whole steps', () => {
		expect(workspaceRectFor({ minX: 0, maxX: 10.5, minZ: -5, maxZ: 0 })).toEqual({ ...DEFAULT, maxX: 30 });
		expect(workspaceRectFor({ minX: 0, maxX: 19, minZ: -5, maxZ: 0 })).toEqual({ ...DEFAULT, maxX: 30 });
	});

	it('always keeps the margin clear around the work', () => {
		const contentBounds = { minX: -33, maxX: 47, minZ: -61, maxZ: 12 };
		const plate = workspaceRectFor(contentBounds);
		expect(contentBounds.minX - plate.minX).toBeGreaterThanOrEqual(10);
		expect(plate.maxX - contentBounds.maxX).toBeGreaterThanOrEqual(10);
		expect(contentBounds.minZ - plate.minZ).toBeGreaterThanOrEqual(10);
		expect(plate.maxZ - contentBounds.maxZ).toBeGreaterThanOrEqual(10);
	});

	it('draws lines only on the plate, leaving plain forest beyond it', () => {
		const material = createMatGridMaterial();
		expect(material.fragmentShader).toContain('minorLine * uPlateMinorOpacity * plate');
		expect(material.fragmentShader).toContain('majorLine * uPlateMajorOpacity * plate');
		expect(material.uniforms.uMatMinorInk).toBeUndefined();
		material.dispose();
		const stage = readFileSync(resolve(process.cwd(), 'src/lib/authoring/stage/shell/stage-mat-grid.ts'), 'utf8');
		expect(stage).toContain('uMatInk: { value: new Color(MAT_BACKGROUND_INK) }');
	});

	it('takes its bounds from the work alone, never the Camera', () => {
		const source = readFileSync(resolve(process.cwd(), 'src/lib/authoring/stage/shell/StageMatGround.svelte'), 'utf8');
		expect(source).toContain('workspaceRectFor(contentBounds)');
		expect(workspaceRectFor.length).toBe(1);
	});

	it('leaves the lines world-anchored across the plate edge', () => {
		const material = createMatGridMaterial();
		const plate = { minX: -5, maxX: 15, minZ: -10, maxZ: 5 };
		for (const ground of [
			{ centerXZ: [0, 0] as [number, number], halfExtentMeters: 64, latticeOffsetXZ: [0, 0] as [number, number] },
			{ centerXZ: [32, -16] as [number, number], halfExtentMeters: 256, latticeOffsetXZ: [7, 9] as [number, number] }
		]) {
			updateMatGridMaterial(material, ground, 1, plate);
			const [minX, minZ] = material.uniforms.uPlate!.value as number[];
			// World −5, −10 in the same coordinates the shader's lines use.
			expect(minX).toBe(plate.minX - (ground.centerXZ[0] - ground.latticeOffsetXZ[0]));
			expect(minZ).toBe(plate.minZ - (ground.centerXZ[1] - ground.latticeOffsetXZ[1]));
		}
		material.dispose();
	});

	it('draws the ground in one unlit draw, so its edge cannot fight anything', () => {
		const material = createMatGroundMaterial();
		expect(material.fragmentShader).toContain('mix(uMatInk, uPlateInk, plateCoverage(vLattice))');
		expect(material.toneMapped).toBe(false);
		material.dispose();
		const source = readFileSync(resolve(process.cwd(), 'src/lib/authoring/stage/shell/StageMatGround.svelte'), 'utf8');
		expect(source).not.toContain('MeshStandardMaterial');
		expect(source).toContain('workspaceRectFor(contentBounds)');
	});

	it('is Paper: the same ground token and the same grid inks and opacities', () => {
		const ground = createMatGroundMaterial();
		expect(`#${ground.uniforms.uPlateInk!.value.getHexString()}`).toBe(PAPER_GROUND_INK);
		ground.dispose();
		const grid = createMatGridMaterial();
		expect(`#${grid.uniforms.uPlateMinorInk!.value.getHexString()}`).toBe(PAPER_GRID_INK.minor.toLowerCase());
		expect(`#${grid.uniforms.uPlateMajorInk!.value.getHexString()}`).toBe(PAPER_GRID_INK.major.toLowerCase());
		expect(grid.uniforms.uPlateMinorOpacity!.value).toBe(PAPER_GRID_INK.minorOpacity);
		expect(grid.uniforms.uPlateMajorOpacity!.value).toBe(PAPER_GRID_INK.majorOpacity);
		grid.dispose();
	});
});

describe('the depth range knows Scene content', () => {
	it('keeps a Scene object in front of the near plane, with no Layout bounds', async () => {
		const envelope = await createUnitProject({ id: 'depth-scene', name: 'Depth', layout: createEmptyWallFirstLayoutDocument() });
		const admission = await admitSource(envelope, {
				sessionEpoch: 'session-s19',
				acceptedRevision: { projectId: 'depth-scene', revisionId: 'revision-s19' }
			});
		if (admission.kind !== 'admitted') throw new Error('not admitted');
		const snapshot = admission.snapshot;
		const pose = { target: [0, 0, 0] as [number, number, number], azimuthRadians: 0, elevationRadians: Math.PI / 4, targetPlaneHeightMeters: 4 };
		const camera = createCameraSession({ snapshot, viewportId: 'stage', outputId: 'output:depth', pose });
		const near = (): number => {
			const result = camera.evaluate({ left: 0, top: 0, width: 1000, height: 600, devicePixelRatio: 1 }, 0);
			if (result.kind !== 'evaluated') throw new Error('not evaluated');
			return result.evaluation.near;
		};
		const compiledOnly = near();
		expect(camera.state().sceneRadiusMeters).toBe(1);
		camera.setContentBounds({ min: [-0.5, 0, -0.5], max: [0.5, 3, 0.5] });
		const withShape = near();
		expect(camera.state().sceneRadiusMeters).toBeCloseTo(Math.hypot(0.5, 3, 0.5), 6);
		expect(withShape).toBeLessThan(compiledOnly);
	});
});

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

	it('draws the same workspace as the 3D ground', () => {
		const sheet = paperSheetRectFor({
			...PAPER_BASE,
			targetPlaneHeightMeters: 200,
			aspect: 2,
			intervalMeters: 1,
			contentBounds: content
		})!;
		expect(sheet).toEqual(workspaceRectFor(content));
		expect(sheet).toEqual({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 });
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

	it('keeps an empty project on the default workspace wherever the Camera looks', () => {
		for (const targetXZ of [[0, 0], [15, -10]] as [number, number][]) {
			const sheet = paperSheetRectFor({
				...PAPER_BASE,
				targetXZ,
				targetPlaneHeightMeters: 400,
				aspect: 2,
				intervalMeters: 1,
				contentBounds: null
			})!;
			expect(sheet).toEqual({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 });
		}
		expect(
			paperSheetRectFor({
				...PAPER_BASE,
				targetXZ: [500, 500],
				targetPlaneHeightMeters: 20,
				aspect: 2,
				intervalMeters: 1,
				contentBounds: null
			})
		).toBeNull();
	});

	it('grows when content leaves the sheet, without a Camera input', () => {
		// A wide target plane keeps both sheets inside the visible coverage, so
		// the growth is observable rather than cropped to the viewport.
		const wide = { ...PAPER_BASE, targetPlaneHeightMeters: 200, aspect: 2 };
		const near = gridPlanFor({ ...wide, metersPerCssPixel: 0.01, contentBounds: content })!;
		const far = gridPlanFor({
			...wide,
			metersPerCssPixel: 0.01,
			contentBounds: { minX: 0, maxX: 40, minZ: -4, maxZ: 2 }
		})!;
		expect(far.rect.maxX).toBeGreaterThan(near.rect.maxX);
		expect(near.rect.minX).toBe(-20);
	});

	it('retains the same drawing for a pan inside the quantised rectangle', () => {
		const base = { ...PAPER_BASE, metersPerCssPixel: 0.01, contentBounds: content };
		const first = gridPlanFor({ ...base, targetXZ: [0, 0] })!;
		const nudged = gridPlanFor({ ...base, targetXZ: [0.02, -0.03] })!;
		expect(nudged.key).toBe(first.key);
	});
});

describe('the workspace reads committed geometry only', () => {
	it('takes no candidate input on either surface', () => {
		for (const file of ['StageMatGround.svelte', 'StageGrid.svelte', 'StageCanvas.svelte']) {
			const source = readFileSync(resolve(process.cwd(), `src/lib/authoring/stage/shell/${file}`), 'utf8');
			expect(source).not.toContain('candidateBounds');
		}
		const route = readFileSync(resolve(process.cwd(), 'src/routes/project/[projectId]/spatial/+page.svelte'), 'utf8');
		expect(route).not.toContain('candidateBounds');
		expect(route).toContain('contentBounds={paperContentBounds}');
	});

	it('changes once when work is committed and restores on Undo', () => {
		const before = { minX: 0, maxX: 5, minZ: 0, maxZ: 1 };
		const committed = { minX: 0, maxX: 60, minZ: 0, maxZ: 1 };
		expect(workspaceRectFor(before)).toEqual({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 });
		expect(workspaceRectFor(committed)).toEqual({ minX: -20, maxX: 70, minZ: -20, maxZ: 20 });
		expect(workspaceRectFor(before)).toEqual({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 });
	});
});

describe('R217.S05 — surfaces, visibility and the mat footprint', () => {
	it('is never drawn in Shaded Plan or under Grid off, and the mat keeps it in 3D', () => {
		expect(gridIsVisible({ grid: false, appearance: 'paper', renderedReading: 'plan' })).toBe(false);
		expect(gridIsVisible({ grid: true, appearance: 'shaded', renderedReading: 'plan' })).toBe(false);
		expect(gridIsVisible({ grid: true, appearance: 'paper', renderedReading: 'plan' })).toBe(true);
		expect(gridIsVisible({ grid: true, appearance: 'shaded', renderedReading: '3d' })).toBe(true);
	});

	it('draws the mat grid per pixel on one quad, never as line geometry', () => {
		const material = createMatGridMaterial();
		expect(material).toBeInstanceOf(ShaderMaterial);
		expect(material).not.toBeInstanceOf(LineSegments);
		// Walls occlude it; it writes no depth, and its depth-step offset keeps it
		// ahead of the mat 6 mm below at every distance.
		expect(material.depthTest).toBe(true);
		expect(material.depthWrite).toBe(false);
		expect(material.polygonOffset).toBe(true);
		expect(material.polygonOffsetUnits).toBeLessThan(0);
		// Depth steps only: a slope factor would draw it over thin floor geometry.
		expect(material.polygonOffsetFactor).toBe(0);
		expect(material.transparent).toBe(true);
		// Under the height plane's tint (order 1) and every other Stage mark.
		expect(MAT_GRID_RENDER_ORDER).toBeLessThan(1);
		// The grammar's thresholds and the fixed levels are the shader's own.
		for (const literal of ['8.0', '16.0', '/ 1.0', '/ 5.0', '/ 25.0']) {
			expect(material.fragmentShader).toContain(literal);
		}
		// One weight per level from the denser direction, outside the per-axis loop.
		const fragment = material.fragmentShader;
		expect(fragment).toContain('min(metreSpacingCssPx(vLattice.x), metreSpacingCssPx(vLattice.y))');
		expect(fragment.indexOf('levelFade(metre')).toBeLessThan(fragment.indexOf('for (int axis'));
		expect(fragment.slice(fragment.indexOf('for (int axis'))).not.toContain('levelFade');
		updateMatGridMaterial(material, { centerXZ: [512, -256], halfExtentMeters: 1024, latticeOffsetXZ: [12, -6] }, 1.5, { minX: 500, maxX: 520, minZ: -260, maxZ: -240 });
		expect(material.uniforms.uSize!.value).toBe(2048);
		expect(material.uniforms.uLatticeOffset!.value).toEqual([12, -6]);
		expect(material.uniforms.uPixelRatio!.value).toBe(1.5);
		// The plate shares `vLattice`'s origin, so float32 never carries world values.
		expect(material.uniforms.uPlate!.value).toEqual([0, -10, 20, 10]);
		material.dispose();
	});

	it('draws every major line on a wide Stage and stays bounded by the viewport', () => {
		const plan = gridPlanFor({
			...PAPER_BASE,
			metersPerCssPixel: 0.01,
			targetPlaneHeightMeters: 8,
			aspect: 3840 / 2160
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

	it('draws Paper’s grid on the Stage overlay layer', () => {
		const plan = gridPlanFor({
			...PAPER_BASE,
			metersPerCssPixel: 0.01
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

/**
 * R217.S19 — the §3a experimental checkpoint, kept as a test.
 *
 * The audit's sweep extended to the real Stage wiring: an admitted enclosure
 * source, the Stage's own Camera session with its datum, and `matGroundFor`
 * exactly as `StageMatGround.svelte` calls it. The mat's grid is drawn per pixel
 * on the mat's own quad, so grid coverage *is* the mat's extent. Every screen
 * sample's ground hit is classified sky, near-clipped, far-clipped or drawn;
 * rows 1, 2, 3 and 5 are measured from geometry and clip range, so no appearance
 * change can make them pass. Row 4 (the line budget) no longer applies: the mat
 * grid is one quad at constant cost, whatever the pose.
 */
describe('R217.S19 — 3D ground clipping checkpoint', () => {
	const VIEWPORTS = [
		[1088, 814],
		[1440, 900],
		[820, 1180],
		[1280, 577]
	] as const;
	const ELEVATIONS = [5, 10, 15, 30, 45, 75, 89];
	const AZIMUTHS = [0, 30, 45, 90, 135, 225, 315];
	const ZOOMS = [0.05, 1, 5, 15.2, 60, 1000];
	const TARGETS: readonly Vec3[] = [
		[3.5, 1.5, -1],
		[500, 0, -400]
	];
	const DEPTH_BITS = 2 ** 24;
	const rad = (degrees: number): number => (degrees * Math.PI) / 180;

	async function enclosureSnapshot(datumMeters = 0): Promise<StageReadSnapshot> {
		const plan = planWallChain({
			baseline: createEmptyWallFirstLayoutDocument(),
			points: [
				[0, -4],
				[7, -4],
				[7, 2],
				[0, 2]
			],
			close: true,
			capture: freshCapture(),
			levelId: createEmptyWallFirstLayoutDocument().floor.id
		});
		if (plan.kind !== 'success') throw new Error(`the enclosure no longer plans: ${plan.rejection.code}`);
		const envelope = await createUnitProject({ id: 'project-s19', name: 'S19', layout: plan.document });
		const admitted = await admitSource(envelope, {
			sessionEpoch: 'session-s19',
			acceptedRevision: { projectId: 'project-s19', revisionId: 'revision-s19' }
		});
		if (admitted.kind !== 'admitted') throw new Error(`fixture not admitted: ${admitted.kind}`);
		// The level datum is the session input the Stage supplies; a datum change is
		// a different snapshot of the same source.
		return datumMeters === admitted.snapshot.domain.datumMeters
			? admitted.snapshot
			: { ...admitted.snapshot, domain: { ...admitted.snapshot.domain, datumMeters } };
	}

	function unproject(inverse: readonly number[], x: number, y: number, z: number): Vec3 {
		const w = inverse[3]! * x + inverse[7]! * y + inverse[11]! * z + inverse[15]!;
		return [
			(inverse[0]! * x + inverse[4]! * y + inverse[8]! * z + inverse[12]!) / w,
			(inverse[1]! * x + inverse[5]! * y + inverse[9]! * z + inverse[13]!) / w,
			(inverse[2]! * x + inverse[6]! * y + inverse[10]! * z + inverse[14]!) / w
		];
	}

	type GroundClass = 'sky' | 'near' | 'far' | 'drawn';

	/** One screen point's ground hit from the eye, against the realized clip planes. */
	function classify(evaluation: ViewportEvaluation, datum: number, ndcX: number, ndcY: number): {
		readonly kind: GroundClass;
		readonly point?: readonly [number, number];
	} {
		const inverse = evaluation.inverseViewProjectionMatrix as readonly number[];
		const nearPoint = unproject(inverse, ndcX, ndcY, -1);
		const eye = evaluation.eye;
		const direction: Vec3 = [nearPoint[0] - eye[0], nearPoint[1] - eye[1], nearPoint[2] - eye[2]];
		if (!(direction[1] < 0) || !(eye[1] > datum)) return { kind: 'sky' };
		const travel = (datum - eye[1]) / direction[1];
		const hit: Vec3 = [eye[0] + direction[0] * travel, datum, eye[2] + direction[2] * travel];
		// View depth along the Camera's forward axis, against the realized clip planes.
		const forward: Vec3 = [evaluation.target[0] - eye[0], evaluation.target[1] - eye[1], evaluation.target[2] - eye[2]];
		const length = Math.hypot(...forward);
		const depth =
			((hit[0] - eye[0]) * forward[0] + (hit[1] - eye[1]) * forward[1] + (hit[2] - eye[2]) * forward[2]) / length;
		if (depth < evaluation.near * (1 - 1e-9)) return { kind: 'near', point: [hit[0], hit[2]] };
		if (depth > evaluation.far * (1 + 1e-9)) return { kind: 'far', point: [hit[0], hit[2]] };
		return { kind: 'drawn', point: [hit[0], hit[2]] };
	}

	function inside(rect: GridRect, point: readonly [number, number], slack = 1e-6): boolean {
		return (
			point[0] >= rect.minX - slack &&
			point[0] <= rect.maxX + slack &&
			point[1] >= rect.minZ - slack &&
			point[1] <= rect.maxZ + slack
		);
	}

	/** CSS px between the last drawn ground row and the horizon (or frame top), centre column. */
	function horizonGapPx(evaluation: ViewportEvaluation, datum: number): number {
		const rows = 1800;
		let lastDrawn = -1;
		let lastGround = -1;
		for (let row = 0; row <= rows; row += 1) {
			const ndcY = (row / rows) * 2 - 1;
			const sample = classify(evaluation, datum, 0, ndcY);
			if (sample.kind === 'sky') continue;
			lastGround = row;
			if (sample.kind === 'drawn') lastDrawn = row;
		}
		if (lastGround < 0) return 0;
		return ((lastGround - lastDrawn) / rows) * evaluation.rect.height;
	}

	/** 24-bit depth step at the target distance for the realized range. */
	function depthStepMeters(evaluation: ViewportEvaluation): number {
		const distance = Math.hypot(
			evaluation.eye[0] - evaluation.target[0],
			evaluation.eye[1] - evaluation.target[1],
			evaluation.eye[2] - evaluation.target[2]
		);
		const { near, far } = evaluation;
		return (distance * distance * (far - near)) / (far * near * DEPTH_BITS);
	}

	function evaluateAt(
		snapshot: StageReadSnapshot,
		pose: InspectionPose,
		width: number,
		height: number
	): ViewportEvaluation {
		const camera = createCameraSession({ snapshot, viewportId: 'stage', outputId: 'output:s19', pose });
		const result = camera.evaluate({ left: 0, top: 0, width, height, devicePixelRatio: 1 }, 0);
		if (result.kind !== 'evaluated') throw new Error(`pose not evaluated: ${result.reason}`);
		return result.evaluation;
	}

	it('meets rows 1–5 across the whole sweep through the Stage wiring', async () => {
		const snapshot = await enclosureSnapshot();
		const datum = snapshot.domain.datumMeters;
		const summary = {
			poses: 0,
			samples: 0,
			sky: 0,
			nearClipped: 0,
			nearClippedAboveFloor: 0,
			farClipped: 0,
			drawnOutsideMat: 0,
			worstGapPxAtLeast5m: 0,
			worstGapPxBelow5m: 0,
			worstDepthStepMeters: 0,
			worstSceneLocalDepthStepMeters: 0
		};
		for (const [width, height] of VIEWPORTS) {
			for (const elevation of ELEVATIONS) {
				for (const azimuth of AZIMUTHS) {
					for (const zoom of ZOOMS) {
						for (const target of TARGETS) {
							const evaluation = evaluateAt(
								snapshot,
								{
									target,
									azimuthRadians: rad(azimuth),
									elevationRadians: rad(elevation),
									targetPlaneHeightMeters: zoom
								},
								width,
								height
							);
							summary.poses += 1;
							const mat = matGroundFor(evaluation, datum);
							const matRect: GridRect = {
								minX: mat.centerXZ[0] - mat.halfExtentMeters,
								maxX: mat.centerXZ[0] + mat.halfExtentMeters,
								minZ: mat.centerXZ[1] - mat.halfExtentMeters,
								maxZ: mat.centerXZ[1] + mat.halfExtentMeters
							};
							// Row 1: every drawn ground sample lies on the mat, which carries the grid.
							for (let iy = 0; iy <= 24; iy += 1) {
								for (let ix = 0; ix <= 8; ix += 1) {
									const sample = classify(evaluation, datum, (ix / 8) * 2 - 1, (iy / 24) * 2 - 1);
									summary.samples += 1;
									if (sample.kind === 'sky') summary.sky += 1;
									else if (sample.kind === 'near') {
										summary.nearClipped += 1;
										// Below the near floor nothing is left to give: only a cut
										// with a near plane above the floor is a D28 defect.
										if (evaluation.near > VIEWPORT_NEAR_FLOOR_METERS) summary.nearClippedAboveFloor += 1;
									}
									else if (sample.kind === 'far') summary.farClipped += 1;
									else if (!inside(matRect, sample.point!)) summary.drawnOutsideMat += 1;
								}
							}
							// Rows 2 and 3: the band between clipped ground and the horizon,
							// normalised to a 900 px frame.
							const gap = (horizonGapPx(evaluation, datum) / height) * 900;
							if (zoom >= 5) summary.worstGapPxAtLeast5m = Math.max(summary.worstGapPxAtLeast5m, gap);
							else summary.worstGapPxBelow5m = Math.max(summary.worstGapPxBelow5m, gap);
							// Row 5: depth resolution at the target distance.
							const step = depthStepMeters(evaluation);
							summary.worstDepthStepMeters = Math.max(summary.worstDepthStepMeters, step);
							// The scene sphere reaching the eye floors the near plane by
							// design (the amended row 5 residual); every other pose is held
							// to 1 mm.
							const distance = Math.hypot(
								evaluation.eye[0] - evaluation.target[0],
								evaluation.eye[1] - evaluation.target[1],
								evaluation.eye[2] - evaluation.target[2]
							);
							if (distance > sceneRadiusOf(snapshot.domain.geometry.bounds ?? null, target)) {
								summary.worstSceneLocalDepthStepMeters = Math.max(summary.worstSceneLocalDepthStepMeters, step);
							}
						}
					}
				}
			}
		}
		if (process.env.S19_SWEEP_OUT) writeFileSync(process.env.S19_SWEEP_OUT, `${JSON.stringify(summary, null, 2)}\n`);
		expect(summary.poses).toBe(4 * 7 * 7 * 6 * 2);
		// Every row is checked at once, so a failure reports all of them.
		expect({
			row1DrawnOutsideMat: summary.drawnOutsideMat,
			d28NearClippedAboveFloor: summary.nearClippedAboveFloor,
			row2GapWithin12Px: summary.worstGapPxAtLeast5m <= 12,
			row3GapWithin40Px: summary.worstGapPxBelow5m <= 40,
			row5SceneLocalDepthWithin1Mm: summary.worstSceneLocalDepthStepMeters <= 0.001
		}).toEqual({
			row1DrawnOutsideMat: 0,
			d28NearClippedAboveFloor: 0,
			row2GapWithin12Px: true,
			row3GapWithin40Px: true,
			row5SceneLocalDepthWithin1Mm: true
		});
	});

	it('always inks a reference: 25 m cross-fades in as 5 m fades out, per pixel', () => {
		// The old zoom-wide rule drew 25 m only after 5 m had fully hidden, so a
		// zoom passed through a band where the only lines were a fading 5 m level.
		let worstReference = 1;
		for (let spacing = 0.64; spacing <= 200; spacing *= 1.01) {
			const weights = matGridLevelWeights(spacing);
			// 5 m and 25 m lines together never drop below half strength while the
			// 25 m level is itself at full spacing (≥ 16 px).
			worstReference = Math.min(worstReference, Math.max(weights.major, weights.coarse));
			for (const weight of [weights.minor, weights.major, weights.coarse]) {
				expect(weight).toBeGreaterThanOrEqual(0);
				expect(weight).toBeLessThanOrEqual(1);
			}
		}
		expect(worstReference).toBeGreaterThanOrEqual(0.5);
		// Near the eye (1 m at 40 px), 1 m and 5 m are fully inked and 25 m is absent.
		expect(matGridLevelWeights(40)).toEqual({ minor: 1, major: 1, coarse: 0 });
		// Mid-distance (1 m at 2 px): 1 m hidden, 5 m fading, 25 m fading in.
		const mid = matGridLevelWeights(2);
		expect(mid.minor).toBe(0);
		expect(mid.major).toBeGreaterThan(0);
		expect(mid.coarse).toBeGreaterThan(0);
		expect(mid.major + mid.coarse).toBeCloseTo(1, 9);
		// Toward the horizon (1 m at 0.2 px): every level is denser than 8 px.
		expect(matGridLevelWeights(0.2)).toEqual({ minor: 0, major: 0, coarse: 0 });
	});

	it('follows a datum change and keeps covering ground across the horizon crossing', async () => {
		for (const datum of [0, 3, -2.5]) {
			const snapshot = await enclosureSnapshot(datum);
			for (const [width, height] of VIEWPORTS) {
				// Orbit from just above the horizon down through it to overhead.
				for (let elevation = 1; elevation <= 89; elevation += 2) {
					const evaluation = evaluateAt(
						snapshot,
						{ target: [3.5, datum + 1.5, -1], azimuthRadians: rad(45), elevationRadians: rad(elevation), targetPlaneHeightMeters: 12 },
						width,
						height
					);
					const mat = matGroundFor(evaluation, datum);
					const matRect: GridRect = {
						minX: mat.centerXZ[0] - mat.halfExtentMeters,
						maxX: mat.centerXZ[0] + mat.halfExtentMeters,
						minZ: mat.centerXZ[1] - mat.halfExtentMeters,
						maxZ: mat.centerXZ[1] + mat.halfExtentMeters
					};
					// The lattice stays anchored to world zero through the offset.
					for (const axis of [0, 1] as const) {
						const anchored = (mat.centerXZ[axis] - mat.latticeOffsetXZ[axis]) / 25;
						expect(Math.abs(anchored - Math.round(anchored))).toBeLessThan(1e-9);
					}
					for (let iy = 0; iy <= 40; iy += 1) {
						for (const ndcX of [-1, 0, 1]) {
							const sample = classify(evaluation, datum, ndcX, (iy / 40) * 2 - 1);
							expect(sample.kind).not.toBe('near');
							if (sample.kind === 'drawn') expect(inside(matRect, sample.point!)).toBe(true);
						}
					}
				}
			}
		}
	});

	it('rebases the session datum with the source, never refitting the pose', async () => {
		const snapshot = await enclosureSnapshot();
		const pose: InspectionPose = {
			target: [3.5, 1.5, -1],
			azimuthRadians: rad(30),
			elevationRadians: rad(10),
			targetPlaneHeightMeters: 12
		};
		const camera = createCameraSession({ snapshot, viewportId: 'stage', outputId: 'output:s19', pose });
		const rect = { left: 0, top: 0, width: 1440, height: 900, devicePixelRatio: 1 };
		const before = camera.evaluate(rect, 0);
		camera.rebaseSource('revision-s19-raised', snapshot.domain.geometry.bounds ?? null, 1);
		const after = camera.evaluate(rect, 0);
		if (before.kind !== 'evaluated' || after.kind !== 'evaluated') throw new Error('not evaluated');
		expect(camera.state().displayGroundYMeters).toBe(1);
		expect(after.evaluation.pose).toEqual(before.evaluation.pose);
		// A higher ground is nearer the eye, so the near plane comes in to keep it.
		expect(after.evaluation.near).toBeLessThan(before.evaluation.near);
		expect(classify(after.evaluation, 1, 0, -1).kind).toBe('drawn');
	});
});
