/**
 * The Three resources behind `StagePaper.svelte`.
 *
 * One group on the Stage overlay layer, built only from `PaperPlanDrawing`. It is
 * editor-only and never imported by a visitor surface. Lines are batched into one
 * `LineSegments2` per treatment, so a project's plan costs a handful of draw calls
 * rather than one per fragment; fills are batched by ink and draw order.
 *
 * Every material is depth-test-free and ordered by the drawing's own layer rank:
 * the Plan is a measured drawing on the paper, not a second depth-sorted scene.
 */
import {
	AlwaysStencilFunc,
	Color,
	DoubleSide,
	Group,
	Mesh,
	MeshBasicMaterial,
	NotEqualStencilFunc,
	PlaneGeometry,
	ReplaceStencilOp,
	type Material
} from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { createPaperFillGeometry } from './paper-fill-geometry';
import {
	PAPER_FILL_INK,
	PAPER_GROUND_INK,
	PAPER_LINE_STYLE,
	STAGE_OVERLAY_LAYER,
	type PaperFillDraw,
	type PaperLineDraw,
	type PaperPlanDrawing,
	type PaperReveal,
	type PaperTreatment
} from './paper-plan';

export type PaperSceneResources = {
	readonly group: Group;
	/** Paper's arrival over the shaded frame; see `paperRevealFor`. */
	setReveal(reveal: PaperReveal): void;
	/** CSS-pixel viewport size; fat-line widths are CSS pixels, never device pixels. */
	setResolution(widthCssPx: number, heightCssPx: number): void;
	dispose(): void;
};

/** Beyond any reach of the Camera, and beneath Paper's room-floor tint (10). */
const PAPER_SHEET_METERS = 100_000;
const PAPER_SHEET_RENDER_ORDER = 5;
const PAPER_SHEET_STENCIL = 1;
export const PAPER_SHEET_NAME = 'StagePaperSheet';
export const PAPER_SHEET_HOLE_NAME = 'StagePaperSheetHole';

type FadeEntry = {
	readonly material: Material & { opacity: number };
	readonly baseOpacity: number;
	readonly part: keyof PaperReveal;
};

function linePositions(lines: readonly PaperLineDraw[]): Float32Array {
	const positions: number[] = [];
	for (const line of lines) {
		for (const [start, end] of line.segments) {
			positions.push(start[0], line.elevationMeters, start[1], end[0], line.elevationMeters, end[1]);
		}
	}
	return new Float32Array(positions);
}

export function createPaperScene(
	drawing: PaperPlanDrawing,
	resolution: readonly [number, number],
	datumMeters = 0
): PaperSceneResources {
	const group = new Group();
	group.name = 'StagePaper';
	const disposables: { dispose(): void }[] = [];
	const fades: FadeEntry[] = [];

	const addFade = (material: Material & { opacity: number }, baseOpacity: number, part: keyof PaperReveal): void => {
		fades.push({ material, baseOpacity, part });
	};

	// The sheet itself, under every ink. It veils the shaded frame without touching
	// any authored material, and once settled it matches the surface it covers.
	// The cut bands are stenciled out of it, so a Wall of any material goes straight
	// to poché instead of through the sheet's light colour first.
	const sheetGeometry = new PlaneGeometry(PAPER_SHEET_METERS, PAPER_SHEET_METERS);
	sheetGeometry.rotateX(-Math.PI / 2);
	const sheetMaterial = new MeshBasicMaterial({
		color: new Color(PAPER_GROUND_INK).getHex(),
		side: DoubleSide, transparent: true, opacity: 1,
		depthTest: false, depthWrite: false, toneMapped: false,
		stencilWrite: true, stencilRef: PAPER_SHEET_STENCIL, stencilFunc: NotEqualStencilFunc
	});
	const sheet = new Mesh(sheetGeometry, sheetMaterial);
	sheet.name = PAPER_SHEET_NAME;
	sheet.position.y = datumMeters;
	sheet.renderOrder = PAPER_SHEET_RENDER_ORDER;
	sheet.frustumCulled = false;
	group.add(sheet);
	disposables.push(sheetGeometry, sheetMaterial);
	addFade(sheetMaterial, 1, 'sheet');

	// One fat-line batch per treatment: lines of the same ink and dash pattern share a
	// draw call, and renderOrder decides where that treatment sits in the sheet.
	const treatments = new Map<PaperTreatment, PaperLineDraw[]>();
	for (const line of drawing.lines) {
		const list = treatments.get(line.treatment) ?? [];
		list.push(line);
		treatments.set(line.treatment, list);
	}
	for (const [treatment, lines] of treatments) {
		const style = PAPER_LINE_STYLE[treatment as Exclude<PaperTreatment, 'room-floor' | 'footprint'>];
		const positions = linePositions(lines);
		if (positions.length === 0) continue;
		const geometry = new LineSegmentsGeometry();
		geometry.setPositions(positions);
		const material = new LineMaterial({
			color: new Color(style.ink).getHex(),
			linewidth: style.widthCssPx,
			transparent: true,
			opacity: style.opacity,
			depthTest: false,
			depthWrite: false,
			// PLATE inks are semantic colors: the renderer's tone mapping would shift
			// the vellum and the ink away from the shell's own values.
			toneMapped: false,
			dashed: style.dashed,
			dashSize: style.dashSizeMeters,
			gapSize: style.gapSizeMeters
		});
		material.resolution.set(resolution[0], resolution[1]);
		const object = new LineSegments2(geometry, material);
		object.computeLineDistances();
		object.renderOrder = lines[0]!.layer;
		object.frustumCulled = false;
		object.layers.set(STAGE_OVERLAY_LAYER);
		group.add(object);
		disposables.push(geometry, material);
		addFade(material, style.opacity, 'lines');
	}

	// One batch per ink/order preserves the exact polygon triangles while keeping
	// a long sampled Wall from issuing thousands of material/draw commands.
	const fillBatches = new Map<PaperFillDraw['treatment'], PaperFillDraw[]>();
	for (const fill of drawing.fills) {
		const batch = fillBatches.get(fill.treatment) ?? [];
		batch.push(fill);
		fillBatches.set(fill.treatment, batch);
	}
	for (const [treatment, fills] of fillBatches) {
		const geometry = createPaperFillGeometry(fills);
		if (geometry === null) continue;
		const material = new MeshBasicMaterial({
			color: new Color(PAPER_FILL_INK[treatment]).getHex(),
			side: DoubleSide, transparent: true, opacity: 1,
			depthTest: false, depthWrite: false, toneMapped: false
		});
		const mesh = new Mesh(geometry, material);
		mesh.renderOrder = treatment === 'cut' ? fills[0]!.layer - 1 : fills[0]!.layer;
		mesh.frustumCulled = false;
		mesh.layers.set(STAGE_OVERLAY_LAYER);
		group.add(mesh);
		disposables.push(geometry, material);
		addFade(material, 1, treatment === 'cut' ? 'poche' : 'sheet');
		if (treatment !== 'cut') continue;
		const holeMaterial = new MeshBasicMaterial({
			side: DoubleSide, transparent: true, colorWrite: false,
			depthTest: false, depthWrite: false,
			stencilWrite: true, stencilRef: PAPER_SHEET_STENCIL,
			stencilFunc: AlwaysStencilFunc, stencilZPass: ReplaceStencilOp
		});
		const sheetHole = new Mesh(geometry, holeMaterial);
		sheetHole.name = PAPER_SHEET_HOLE_NAME;
		sheetHole.renderOrder = PAPER_SHEET_RENDER_ORDER - 1;
		sheetHole.frustumCulled = false;
		group.add(sheetHole);
		disposables.push(holeMaterial);
	}

	for (const footprint of drawing.footprints) {
		if (footprint.segments.length === 0) continue;
		const positions: number[] = [];
		for (const [start, end] of footprint.segments) {
			positions.push(
				start[0],
				footprint.elevationMeters,
				start[1],
				end[0],
				footprint.elevationMeters,
				end[1]
			);
		}
		const geometry = new LineSegmentsGeometry();
		geometry.setPositions(new Float32Array(positions));
		const style = PAPER_LINE_STYLE.footprint;
		const material = new LineMaterial({
			color: new Color(style.ink).getHex(),
			linewidth: style.widthCssPx,
			transparent: true,
			opacity: style.opacity,
			depthTest: false,
			depthWrite: false,
			toneMapped: false,
			dashed: false
		});
		material.resolution.set(resolution[0], resolution[1]);
		const object = new LineSegments2(geometry, material);
		object.renderOrder = footprint.layer;
		object.frustumCulled = false;
		object.layers.set(STAGE_OVERLAY_LAYER);
		group.add(object);
		disposables.push(geometry, material);
		addFade(material, style.opacity, 'lines');
	}

	group.traverse((node) => node.layers.set(STAGE_OVERLAY_LAYER));

	return {
		group,
		setReveal(reveal: PaperReveal): void {
			for (const entry of fades) entry.material.opacity = entry.baseOpacity * reveal[entry.part];
		},
		setResolution(widthCssPx: number, heightCssPx: number): void {
		group.traverse((node) => {
			if (node instanceof LineSegments2) (node.material as LineMaterial).resolution.set(widthCssPx, heightCssPx);
		});
		},
		dispose(): void {
			group.clear();
			for (const disposable of disposables) disposable.dispose();
			fades.length = 0;
			disposables.length = 0;
		}
	};
}
