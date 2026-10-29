/**
 * R217.S07 — **selection and hover ink on Paper**.
 *
 * Paper already owns the Plan drawing (`buildPaperPlan`). This module does not
 * evaluate, project or regroup anything: it filters that drawing's own entries by
 * the selected identity and re-strokes exactly those entries above the sheet.
 *
 * The result is deliberately two small structures rather than a second drawing
 * system:
 *
 * - a **gold** pass for the primary selection: a translucent tint under a solid
 *   contour, so a selected Room, Wall, Opening or Scene footprint reads as one
 *   identity;
 * - a **quiet neutral** contour for hover, never gold (gold means selected).
 *
 * Every mark is depth-test-free and ordered above `PAPER_LAYER.sceneFootprint`,
 * as S04's handoff requires. Nothing writes `Object3D.visible`; the Paper layer is
 * mounted only when Paper is the visible reading, and the mat's mesh ink is a
 * separate component that is unmounted instead.
 */
import {
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
import { sameReference, type StageSelectionEntry } from './semantic-selection';
import {
	PAPER_LAYER,
	STAGE_OVERLAY_LAYER,
	unionOutline,
	type PaperFillDraw,
	type PaperPlanDrawing,
	type PaperSegment
} from './paper-plan';

/** PLATE's selection gold, shared with the Stage's mesh ink and marks. */
export const PAPER_SELECTION_INK = '#d4ad45';
/** The same quiet neutral as the mat's ink: never gold, and legible on a halo. */
export const PAPER_HOVER_INK = '#f3f4ee';
/** The dark halo the mark vocabulary uses to hold a light line over any sheet. */
export const PAPER_MARK_HALO_INK = '#152c26';

/** Marks sit above the drawing; hover below the selected identity it previews. */
export const PAPER_MARK_LAYER = {
	hoverHalo: PAPER_LAYER.sceneFootprint + 8,
	hover: PAPER_LAYER.sceneFootprint + 9,
	selectionTint: PAPER_LAYER.sceneFootprint + 10,
	selectionHalo: PAPER_LAYER.sceneFootprint + 11,
	selectionLine: PAPER_LAYER.sceneFootprint + 12
} as const;

export type PaperMarkTone = 'selection' | 'hover';

/** One elevation's contour; the union of a filled subject has no internal edges. */
export type PaperMarkContour = {
	readonly elevationMeters: number;
	readonly segments: readonly PaperSegment[];
};

export type PaperMarkGeometry = {
	/** Filled polygons the selection tints; the contour below is their boundary. */
	readonly fills: readonly PaperFillDraw[];
	readonly contours: readonly PaperMarkContour[];
};

export type PaperMarkSet = {
	readonly selection: PaperMarkGeometry;
	readonly hover: PaperMarkGeometry;
};

const EMPTY_GEOMETRY: PaperMarkGeometry = { fills: [], contours: [] };

function groupByElevation<T>(
	entries: readonly T[],
	elevationOf: (entry: T) => number
): Map<number, T[]> {
	const groups = new Map<number, T[]>();
	for (const entry of entries) {
		const elevation = elevationOf(entry);
		const group = groups.get(elevation) ?? [];
		group.push(entry);
		groups.set(elevation, group);
	}
	return groups;
}

/**
 * The drawing entries one selection identity owns.
 *
 * A Layout subject is addressed by its canonical subject id, which is exactly the
 * `sourceId` the Plan representation already publishes for Walls, Openings,
 * Objects and Room floors. A Scene identity is a footprint's `entityId`. No other
 * identity is forced into this vocabulary.
 *
 * A filled subject is stroked from the **union** of its fills. A Wall is emitted as
 * one band per compiled solid span, so stroking the per-span lines would draw a
 * tick at every shared span boundary; `unionOutline` leaves only the real edge.
 */
function geometryOf(drawing: PaperPlanDrawing, entry: StageSelectionEntry): PaperMarkGeometry {
	const id = entry.reference.subject.id;
	if (entry.reference.domain === 'layout') {
		const fills = drawing.fills.filter((fill) => fill.sourceId === id);
		const lines = drawing.lines.filter((line) => line.sourceId === id);
		const byElevation = new Map<number, PaperSegment[]>();
		const addSegments = (elevationMeters: number, segments: readonly PaperSegment[]): void => {
			const existing = byElevation.get(elevationMeters) ?? [];
			existing.push(...segments);
			byElevation.set(elevationMeters, existing);
		};
		for (const [elevationMeters, group] of groupByElevation(fills, (fill) => fill.elevationMeters)) {
			addSegments(elevationMeters, unionOutline(group.flatMap((fill) => fill.polygons)));
		}
		// A cut line duplicates the fill boundary (and would draw one tick per
		// compiled Wall span); projected, hidden and symbol lines are extra geometry
		// the subject still owns, so they remain part of its identity.
		for (const line of fills.length > 0 ? lines.filter((candidate) => candidate.stream !== 'cut') : lines) {
			addSegments(line.elevationMeters, line.segments);
		}
		const contours = [...byElevation].map(([elevationMeters, segments]) => ({ elevationMeters, segments }));
		return { fills, contours };
	}
	if (entry.reference.domain === 'scene') {
		const footprints = drawing.footprints.filter((footprint) => footprint.entityId === id);
		const contours = [...groupByElevation(footprints, (footprint) => footprint.elevationMeters)].map(
			([elevationMeters, group]) => ({
				elevationMeters,
				segments: group.flatMap((footprint) => footprint.segments)
			})
		);
		return { fills: [], contours };
	}
	return EMPTY_GEOMETRY;
}

/** The selected identity, plus hover only when it is a different subject. */
export function paperMarkSet(
	drawing: PaperPlanDrawing,
	selection: StageSelectionEntry | null,
	hover: StageSelectionEntry | null
): PaperMarkSet {
	const selected = selection === null ? EMPTY_GEOMETRY : geometryOf(drawing, selection);
	const hovered =
		hover === null || (selection !== null && sameReference(hover.reference, selection.reference))
			? EMPTY_GEOMETRY
			: geometryOf(drawing, hover);
	return { selection: selected, hover: hovered };
}

export type PaperMarkSceneResources = {
	readonly group: Group;
	/** CSS-pixel viewport size; fat-line widths are CSS pixels, never device pixels. */
	setResolution(widthCssPx: number, heightCssPx: number): void;
	/** Follow the Paper drawing's settle-in; 0 → 1. */
	setFade(fade: number): void;
	dispose(): void;
};

type FadeEntry = { readonly material: Material & { opacity: number }; readonly baseOpacity: number };

function shapeOf(polygon: readonly LayoutVec2[]): Shape {
	const shape = new Shape();
	shape.moveTo(polygon[0]![0], polygon[0]![1]);
	for (let index = 1; index < polygon.length; index += 1) shape.lineTo(polygon[index]![0], polygon[index]![1]);
	shape.closePath();
	return shape;
}

function linePositions(geometry: PaperMarkGeometry): Float32Array {
	const positions: number[] = [];
	for (const contour of geometry.contours) {
		for (const [start, end] of contour.segments) {
			positions.push(
				start[0],
				contour.elevationMeters,
				start[1],
				end[0],
				contour.elevationMeters,
				end[1]
			);
		}
	}
	return new Float32Array(positions);
}

/**
 * Build the overlay group for one mark set.
 *
 * Lines are one fat-line batch per tone, fills one mesh per polygon. Every object
 * is on `STAGE_OVERLAY_LAYER`, has `depthTest: false`, and is ordered above the
 * Paper sheet, so the re-stroke can never be hidden by the drawing it annotates.
 */
export function createPaperMarkScene(
	marks: PaperMarkSet,
	resolution: readonly [number, number]
): PaperMarkSceneResources {
	const group = new Group();
	group.name = 'StagePaperMarks';
	group.layers.set(STAGE_OVERLAY_LAYER);
	const disposables: { dispose(): void }[] = [];
	const fades: FadeEntry[] = [];

	const addLine = (
		geometry: PaperMarkGeometry,
		ink: string,
		widthCssPx: number,
		opacity: number,
		renderOrder: number
	): void => {
		const positions = linePositions(geometry);
		if (positions.length === 0) return;
		const lineGeometry = new LineSegmentsGeometry();
		lineGeometry.setPositions(positions);
		const material = new LineMaterial({
			color: new Color(ink).getHex(),
			linewidth: widthCssPx,
			transparent: true,
			opacity,
			depthTest: false,
			depthWrite: false,
			// PLATE inks are semantic colors; tone mapping would shift the gold.
			toneMapped: false,
			dashed: false
		});
		material.resolution.set(resolution[0], resolution[1]);
		const object = new LineSegments2(lineGeometry, material);
		object.renderOrder = renderOrder;
		object.frustumCulled = false;
		object.layers.set(STAGE_OVERLAY_LAYER);
		group.add(object);
		disposables.push(lineGeometry, material);
		fades.push({ material, baseOpacity: material.opacity });
	};

	// Hover: a restrained light contour held by the vocabulary's dark halo, so it
	// reads over vellum and over a cut band without ever borrowing selection gold.
	addLine(marks.hover, PAPER_MARK_HALO_INK, 4, 0.4, PAPER_MARK_LAYER.hoverHalo);
	addLine(marks.hover, PAPER_HOVER_INK, 2, 0.75, PAPER_MARK_LAYER.hover);

	const tint = marks.selection.fills;
	for (const fill of tint) {
		for (const polygon of fill.polygons) {
			if (polygon.length < 3) continue;
			const geometry = new ShapeGeometry(shapeOf(polygon)).rotateX(Math.PI / 2);
			const material = new MeshBasicMaterial({
				color: new Color(PAPER_SELECTION_INK).getHex(),
				side: DoubleSide,
				transparent: true,
				opacity: 0.18,
				depthTest: false,
				depthWrite: false,
				toneMapped: false
			});
			const mesh = new Mesh(geometry, material);
			mesh.position.y = fill.elevationMeters;
			mesh.renderOrder = PAPER_MARK_LAYER.selectionTint;
			mesh.frustumCulled = false;
			mesh.layers.set(STAGE_OVERLAY_LAYER);
			group.add(mesh);
			disposables.push(geometry, material);
			fades.push({ material, baseOpacity: material.opacity });
		}
	}

	// Selection: the same dark halo, with PLATE gold over it. The tint sits under
	// the contour and above the sheet, so identity reads without hiding the Plan.
	addLine(marks.selection, PAPER_MARK_HALO_INK, 4.5, 0.9, PAPER_MARK_LAYER.selectionHalo);
	addLine(marks.selection, PAPER_SELECTION_INK, 2.5, 1, PAPER_MARK_LAYER.selectionLine);

	return {
		group,
		setResolution(widthCssPx: number, heightCssPx: number): void {
			group.traverse((node) => {
				if (node instanceof LineSegments2) {
					(node.material as LineMaterial).resolution.set(widthCssPx, heightCssPx);
				}
			});
		},
		setFade(fade: number): void {
			const clamped = Math.min(1, Math.max(0, fade));
			for (const entry of fades) entry.material.opacity = entry.baseOpacity * clamped;
		},
		dispose(): void {
			group.clear();
			for (const disposable of disposables) disposable.dispose();
			fades.length = 0;
			disposables.length = 0;
		}
	};
}
