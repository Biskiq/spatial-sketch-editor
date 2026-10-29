/**
 * The Three resources behind `StagePaper.svelte`.
 *
 * One group on the Stage overlay layer, built only from `PaperPlanDrawing`. It is
 * editor-only and never imported by a visitor surface. Lines are batched into one
 * `LineSegments2` per treatment, so a project's plan costs a handful of draw calls
 * rather than one per fragment; fills are one mesh per drawn polygon.
 *
 * Every material is depth-test-free and ordered by the drawing's own layer rank:
 * the Plan is a measured drawing on the paper, not a second depth-sorted scene.
 */
import {
	BufferGeometry,
	Color,
	DoubleSide,
	Group,
	Mesh,
	MeshBasicMaterial,
	Shape,
	ShapeGeometry,
	type Material
} from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { LayoutVec2 } from '@portfolio/layout-core';
import {
	PAPER_FILL_INK,
	PAPER_LINE_STYLE,
	STAGE_OVERLAY_LAYER,
	type PaperFillDraw,
	type PaperLineDraw,
	type PaperPlanDrawing,
	type PaperTreatment
} from './paper-plan';

export type PaperSceneResources = {
	readonly group: Group;
	/** Fade the whole drawing, 0 → 1. Used only for the settle-in from the mat. */
	setFade(fade: number): void;
	/** CSS-pixel viewport size; fat-line widths are CSS pixels, never device pixels. */
	setResolution(widthCssPx: number, heightCssPx: number): void;
	dispose(): void;
};

type FadeEntry = { readonly material: Material & { opacity: number }; readonly baseOpacity: number };

function linePositions(lines: readonly PaperLineDraw[]): Float32Array {
	const positions: number[] = [];
	for (const line of lines) {
		for (const [start, end] of line.segments) {
			positions.push(start[0], line.elevationMeters, start[1], end[0], line.elevationMeters, end[1]);
		}
	}
	return new Float32Array(positions);
}

function shapeOf(polygon: readonly LayoutVec2[]): Shape {
	const shape = new Shape();
	shape.moveTo(polygon[0]![0], polygon[0]![1]);
	for (let index = 1; index < polygon.length; index += 1) shape.lineTo(polygon[index]![0], polygon[index]![1]);
	shape.closePath();
	return shape;
}

function fillGeometriesOf(fill: PaperFillDraw): BufferGeometry[] {
	// ShapeGeometry is authored in XY; rotating +90° about X maps (x, y) onto the
	// datum's (x, z) without changing the plan point or its winding.
	return fill.polygons
		.filter((polygon) => polygon.length >= 3)
		.map((polygon) => new ShapeGeometry(shapeOf(polygon)).rotateX(Math.PI / 2));
}

export function createPaperScene(
	drawing: PaperPlanDrawing,
	resolution: readonly [number, number]
): PaperSceneResources {
	const group = new Group();
	group.name = 'StagePaper';
	const disposables: { dispose(): void }[] = [];
	const fades: FadeEntry[] = [];

	const addFade = (material: Material & { opacity: number }, baseOpacity: number): void => {
		fades.push({ material, baseOpacity });
	};

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
		addFade(material, style.opacity);
	}

	for (const fill of drawing.fills) {
		const material = new MeshBasicMaterial({
			color: new Color(PAPER_FILL_INK[fill.treatment]).getHex(),
			side: DoubleSide,
			transparent: true,
			opacity: 1,
			depthTest: false,
			depthWrite: false,
			toneMapped: false
		});
		for (const geometry of fillGeometriesOf(fill)) {
			const mesh = new Mesh(geometry, material);
			mesh.position.y = fill.elevationMeters;
			// The poché fill sits under its own edge pass, still above projected ink.
			mesh.renderOrder = fill.treatment === 'cut' ? fill.layer - 1 : fill.layer;
			mesh.frustumCulled = false;
			mesh.layers.set(STAGE_OVERLAY_LAYER);
			group.add(mesh);
			disposables.push(geometry);
		}
		disposables.push(material);
		addFade(material, 1);
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
		addFade(material, style.opacity);
	}

	group.traverse((node) => node.layers.set(STAGE_OVERLAY_LAYER));

	return {
		group,
		setFade(fade: number): void {
			const clamped = Math.min(1, Math.max(0, fade));
			for (const entry of fades) entry.material.opacity = entry.baseOpacity * clamped;
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
