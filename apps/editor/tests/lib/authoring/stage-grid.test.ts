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
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Matrix4, PerspectiveCamera, Vector3 } from 'three';
import {
	VIEWPORT_NEAR_FLOOR_METERS,
	type InspectionPose,
	type Vec3,
	type ViewportEvaluation
} from '@portfolio/camera-core';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core';
import { createCameraSession } from '$lib/authoring/stage/camera-session';
import { admitSource, type StageReadSnapshot } from '$lib/authoring/stage/source-admission';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
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
	GRID_MAT_LINE_BUDGET,
	matGroundFor,
	paperSheetRectFor,
	stageGridPlanFor,
	type GridRect
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
			datumMeters: 0
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

/**
 * R217.S19 — the §3a experimental checkpoint, kept as a test.
 *
 * The audit's sweep extended to the real Stage wiring: an admitted enclosure
 * source, the Stage's own Camera session with its datum, `stageGridPlanFor` and
 * `matGroundFor` exactly as `StageGrid.svelte` and `StageCanvas.svelte` call
 * them. Every screen sample's ground hit is classified sky, behind, near-clipped,
 * far-clipped or drawn; rows 1–6 are measured from geometry and clip range, so no
 * appearance change can make them pass.
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
			drawnOutsideGrid: 0,
			drawnOutsideMat: 0,
			worstGapPxAtLeast5m: 0,
			worstGapPxBelow5m: 0,
			worstLines: 0,
			majorsDropped: 0,
			worstDepthStepMeters: 0
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
							const plan = stageGridPlanFor(evaluation, { surface: 'mat', datumMeters: datum });
							const mat = matGroundFor(evaluation, datum);
							const matRect: GridRect = {
								minX: mat.centerXZ[0] - mat.halfExtentMeters,
								maxX: mat.centerXZ[0] + mat.halfExtentMeters,
								minZ: mat.centerXZ[1] - mat.halfExtentMeters,
								maxZ: mat.centerXZ[1] + mat.halfExtentMeters
							};
							// Rows 1: every drawn ground sample lies inside grid coverage and the mat.
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
									else {
										if (plan === null || !inside(plan.rect, sample.point!)) summary.drawnOutsideGrid += 1;
										if (!inside(matRect, sample.point!)) summary.drawnOutsideMat += 1;
									}
								}
							}
							// Rows 2 and 3: the band between clipped ground and the horizon,
							// normalised to a 900 px frame.
							const gap = (horizonGapPx(evaluation, datum) / height) * 900;
							if (zoom >= 5) summary.worstGapPxAtLeast5m = Math.max(summary.worstGapPxAtLeast5m, gap);
							else summary.worstGapPxBelow5m = Math.max(summary.worstGapPxBelow5m, gap);
							// Row 4: the line budget, with every major line kept.
							if (plan !== null) {
								const lines = gridLinesFor(plan);
								summary.worstLines = Math.max(summary.worstLines, lines.length);
								const majors = lines.filter((line) => line.role !== 'minor').length;
								const unbudgeted = gridLinesFor({ ...plan, minorRect: plan.rect }).filter(
									(line) => line.role !== 'minor'
								).length;
								if (majors !== unbudgeted) summary.majorsDropped += 1;
							}
							// Row 5: depth resolution at the target distance.
							summary.worstDepthStepMeters = Math.max(summary.worstDepthStepMeters, depthStepMeters(evaluation));
						}
					}
				}
			}
		}
		if (process.env.S19_SWEEP_OUT) writeFileSync(process.env.S19_SWEEP_OUT, `${JSON.stringify(summary, null, 2)}\n`);
		expect(summary.poses).toBe(4 * 7 * 7 * 6 * 2);
		// Every row is checked at once, so a failure reports all of them.
		expect({
			row1DrawnOutsideGrid: summary.drawnOutsideGrid,
			row1DrawnOutsideMat: summary.drawnOutsideMat,
			d28NearClippedAboveFloor: summary.nearClippedAboveFloor,
			row2GapWithin12Px: summary.worstGapPxAtLeast5m <= 12,
			row3GapWithin40Px: summary.worstGapPxBelow5m <= 40,
			row4WithinBudget: summary.worstLines <= GRID_MAT_LINE_BUDGET,
			row4MajorsDropped: summary.majorsDropped,
			row5DepthWithin1Mm: summary.worstDepthStepMeters <= 0.001
		}).toEqual({
			row1DrawnOutsideGrid: 0,
			row1DrawnOutsideMat: 0,
			d28NearClippedAboveFloor: 0,
			row2GapWithin12Px: true,
			row3GapWithin40Px: true,
			row4WithinBudget: true,
			row4MajorsDropped: 0,
			row5DepthWithin1Mm: true
		});
	});

	it('keeps the line budget at every zoom between the sweep values, never dropping a major line', async () => {
		const snapshot = await enclosureSnapshot();
		let worst = 0;
		for (const [width, height] of VIEWPORTS) {
			for (const elevation of [5, 15, 45, 89]) {
				for (let zoom = 0.05; zoom <= 2000; zoom *= 1.25) {
					const evaluation = evaluateAt(
						snapshot,
						{ target: [3.5, 0, -1], azimuthRadians: rad(30), elevationRadians: rad(elevation), targetPlaneHeightMeters: zoom },
						width,
						height
					);
					const plan = stageGridPlanFor(evaluation, { surface: 'mat', datumMeters: 0 });
					if (plan === null) continue;
					const lines = gridLinesFor(plan);
					worst = Math.max(worst, lines.length);
					expect(lines.length).toBeLessThanOrEqual(GRID_MAT_LINE_BUDGET);
					const majors = lines.filter((line) => line.role !== 'minor').length;
					const full = gridLinesFor({ ...plan, minorRect: plan.rect }).filter((line) => line.role !== 'minor').length;
					expect(majors).toBe(full);
					// The budgeted minor rectangle is always inside the covered one.
					expect(plan.minorRect.minX).toBeGreaterThanOrEqual(plan.rect.minX);
					expect(plan.minorRect.maxX).toBeLessThanOrEqual(plan.rect.maxX);
					expect(plan.minorRect.minZ).toBeGreaterThanOrEqual(plan.rect.minZ);
					expect(plan.minorRect.maxZ).toBeLessThanOrEqual(plan.rect.maxZ);
				}
			}
		}
		expect(worst).toBeGreaterThan(0);
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
					const plan = stageGridPlanFor(evaluation, { surface: 'mat', datumMeters: datum });
					expect(plan).not.toBeNull();
					for (let iy = 0; iy <= 40; iy += 1) {
						for (const ndcX of [-1, 0, 1]) {
							const sample = classify(evaluation, datum, ndcX, (iy / 40) * 2 - 1);
							expect(sample.kind).not.toBe('near');
							if (sample.kind === 'drawn') expect(inside(plan!.rect, sample.point!)).toBe(true);
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
