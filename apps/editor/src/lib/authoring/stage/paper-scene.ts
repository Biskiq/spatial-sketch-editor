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
	InstancedInterleavedBuffer,
	InterleavedBufferAttribute,
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
import { paperSourceRuns, type PaperSourceRun } from './paper-selection';
import { countWork } from '@portfolio/layout-core';
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
	/**
	 * Draw every line batch except one source's own instance runs, without
	 * rebuilding any geometry. The selection names the source; `null` restores the
	 * full batches. A source the drawing does not contain leaves every batch drawn.
	 */
	setHiddenSource(sourceId: string | null): void;
	dispose(): void;
};

/**
 * One built line batch, retained so a selection can draw a range of its
 * instances without rebuilding it.
 *
 * `positions` and `distances` are the batch's own buffers; a hidden source is
 * omitted by drawing the complement of its runs from views that borrow them.
 * Nothing is re-triangulated, re-ordered or re-computed.
 */
type PaperLineBatch = {
	readonly object: LineSegments2;
	readonly material: LineMaterial;
	readonly renderOrder: number;
	readonly total: number;
	readonly runs: readonly PaperSourceRun[];
	readonly positions: Float32Array;
	/** Per-instance dash distances; only a dashed batch has them. */
	readonly distances: Float32Array | null;
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
	countWork('paper:scene-build');
	const group = new Group();
	group.name = 'StagePaper';
	const disposables: { dispose(): void }[] = [];
	const fades: FadeEntry[] = [];
	const batches: PaperLineBatch[] = [];
	/** Instances a hidden source leaves visible, borrowing each batch's own buffers. */
	const views: LineSegments2[] = [];
	let hiddenSource: string | null = null;

	const addFade = (material: Material & { opacity: number }, baseOpacity: number, part: keyof PaperReveal): void => {
		fades.push({ material, baseOpacity, part });
	};

	// `LineSegmentsGeometry` is instanced and has no per-object draw range, so a
	// visibility range is another object over the same instance buffers: the
	// draw-range equivalent for a line batch, with no vertex built or copied.
	const addView = (batch: PaperLineBatch, start: number, count: number): void => {
		const geometry = new LineSegmentsGeometry();
		const positions = new InstancedInterleavedBuffer(
			batch.positions.subarray(start * 6, (start + count) * 6),
			6,
			1
		);
		geometry.setAttribute('instanceStart', new InterleavedBufferAttribute(positions, 3, 0));
		geometry.setAttribute('instanceEnd', new InterleavedBufferAttribute(positions, 3, 3));
		if (batch.distances !== null) {
			const distances = new InstancedInterleavedBuffer(
				batch.distances.subarray(start * 2, (start + count) * 2),
				2,
				1
			);
			geometry.setAttribute('instanceDistanceStart', new InterleavedBufferAttribute(distances, 1, 0));
			geometry.setAttribute('instanceDistanceEnd', new InterleavedBufferAttribute(distances, 1, 1));
		}
		geometry.instanceCount = count;
		const object = new LineSegments2(geometry, batch.material);
		object.renderOrder = batch.renderOrder;
		object.frustumCulled = false;
		object.layers.set(STAGE_OVERLAY_LAYER);
		group.add(object);
		views.push(object);
	};

	const clearViews = (): void => {
		for (const view of views) {
			group.remove(view);
			view.geometry.dispose();
		}
		views.length = 0;
	};

	// The complement of one source's runs: every instance the batch keeps drawing.
	const visibleRanges = (batch: PaperLineBatch, sourceId: string): { start: number; count: number }[] => {
		const ranges: { start: number; count: number }[] = [];
		let cursor = 0;
		for (const run of batch.runs) {
			if (run.sourceId !== sourceId) continue;
			if (run.start > cursor) ranges.push({ start: cursor, count: run.start - cursor });
			cursor = run.start + run.count;
		}
		if (cursor < batch.total) ranges.push({ start: cursor, count: batch.total - cursor });
		return ranges;
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
		const dashGroups = new Map<boolean, PaperLineDraw[]>();
		for (const line of lines) {
			const dashed = line.dashed ?? style.dashed;
			const batch = dashGroups.get(dashed) ?? [];
			batch.push(line);
			dashGroups.set(dashed, batch);
		}
		for (const [dashed, batch] of dashGroups) {
			const positions = linePositions(batch);
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
				dashed,
				dashSize: style.dashSizeMeters,
				gapSize: style.gapSizeMeters
			});
			material.resolution.set(resolution[0], resolution[1]);
			const object = new LineSegments2(geometry, material);
			if (dashed) object.computeLineDistances();
			object.renderOrder = batch[0]!.layer;
			object.frustumCulled = false;
			object.layers.set(STAGE_OVERLAY_LAYER);
			group.add(object);
			disposables.push(geometry, material);
			addFade(material, style.opacity, 'lines');
			batches.push({
				object,
				material,
				renderOrder: object.renderOrder,
				total: geometry.instanceCount,
				runs: paperSourceRuns(batch),
				positions,
				distances: dashed
					? (
							(geometry.getAttribute('instanceDistanceStart') as InterleavedBufferAttribute)
								.data.array as Float32Array
						)
					: null
			});
		}
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
		setHiddenSource(sourceId: string | null): void {
			if (sourceId === hiddenSource) return;
			clearViews();
			for (const batch of batches) batch.object.geometry.instanceCount = batch.total;
			hiddenSource = sourceId;
			if (sourceId === null) return;
			for (const batch of batches) {
				if (!batch.runs.some((run) => run.sourceId === sourceId)) continue;
				batch.object.geometry.instanceCount = 0;
				for (const range of visibleRanges(batch, sourceId)) addView(batch, range.start, range.count);
			}
		},
		dispose(): void {
			clearViews();
			group.clear();
			for (const disposable of disposables) disposable.dispose();
			fades.length = 0;
			disposables.length = 0;
			hiddenSource = null;
		}
	};
}
