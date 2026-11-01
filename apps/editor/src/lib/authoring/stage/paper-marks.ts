/**
 * R217.S07/S18 — **selection and hover ink on Paper**.
 *
 * Paper already owns the Plan drawing (`buildPaperPlan`). This module does not
 * evaluate, project or regroup anything: it filters that drawing's own entries by
 * the selected identity and re-strokes exactly those entries above the sheet.
 *
 * The result is deliberately two small structures rather than a second drawing
 * system:
 *
 * - a **gold** pass for the primary selection: a translucent fill under a solid
 *   contour, so a selected Room, Opening or Scene footprint reads as one identity.
 *   R217.S18 reads a Scene fill from the polygons `buildPaperPlan` already retained,
 *   and keeps the fill under cut ink. A cut Wall's poché keeps its black ink with no
 *   tint, since gold over black is brown, and takes a two-tone gold contour instead;
 * - a **quiet neutral** contour for hover, never gold (gold means selected);
 * - R217.S10's **erase** treatment: the armed Eraser's winner in red dashes, drawn
 *   above the selection so it reads even on the selected subject.
 *
 * Every mark is depth-test-free. Contours are ordered above
 * `PAPER_LAYER.sceneFootprint` as S04's handoff requires; the selection fill sits
 * above the cut poché and under the cut stroke. Nothing writes `Object3D.visible`;
 * the Paper layer is mounted only when Paper is the visible reading, and the
 * mat's mesh ink is a separate component that is unmounted instead.
 */
import {
	Color,
	DoubleSide,
	Group,
	Mesh,
	MeshBasicMaterial,
	type Material
} from 'three';
import {
	createPaperFillGeometry,
	unionPaperFillPolygons,
	type PaperFillPolygons
} from './paper-fill-geometry';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { LayoutVec2 } from '@portfolio/layout-core';
import { sameReference, type StageSelectionEntry } from './semantic-selection';
import { STAGE_ERASE_INK } from './stage-eraser';
import {
	PAPER_LAYER,
	STAGE_OVERLAY_LAYER,
	unionOutline,
	type PaperPlanDrawing,
	type PaperSegment
} from './paper-plan';

/** PLATE's selection gold: the translucent fill under a selected subject. */
export const PAPER_SELECTION_INK = '#d4ad45';
/** Owner ruling O1's dark-gold Paper edge, the wireframe's own value. */
export const PAPER_SELECTION_EDGE_INK = '#74560c';
/** The same quiet neutral as the mat's ink: never gold, and legible on a halo. */
export const PAPER_HOVER_INK = '#f3f4ee';
/** The dark halo the mark vocabulary uses to hold a light line over any sheet. */
export const PAPER_MARK_HALO_INK = '#152c26';
/** A cut contour's widths: dark gold holds on Paper, bright gold on the black poché. */
export const PAPER_CUT_SELECTION_EDGE_WIDTH_CSS = 5;
export const PAPER_CUT_SELECTION_CORE_WIDTH_CSS = 2.5;

/** Contours sit above the drawing; the selection fill sits under cut ink. */
export const PAPER_MARK_LAYER = {
	hoverHalo: PAPER_LAYER.sceneFootprint + 8,
	hover: PAPER_LAYER.sceneFootprint + 9,
	// A fill sits under the cut poché (39), so a Room's tint stops at its Walls'
	// faces and never browns the ink or reveals the per-span strokes on it.
	selectionTint: PAPER_LAYER.cut - 1.5,
	// A Room's boundary is its Walls' centreline, so its contour sits under their
	// poché too, and shows only where no Wall stands.
	roomContourHalo: PAPER_LAYER.cut - 1.4,
	roomContour: PAPER_LAYER.cut - 1.3,
	selectionHalo: PAPER_LAYER.sceneFootprint + 11,
	selectionLine: PAPER_LAYER.sceneFootprint + 12,
	eraseHalo: PAPER_LAYER.sceneFootprint + 13,
	erase: PAPER_LAYER.sceneFootprint + 14
} as const;

export type PaperMarkTone = 'selection' | 'hover' | 'erase';

/** One elevation's contour; the union of a filled subject has no internal edges. */
export type PaperMarkContour = {
	readonly elevationMeters: number;
	readonly segments: readonly PaperSegment[];
	/** The boundary of cut poché, stroked two-tone when selected. */
	readonly cut?: boolean;
	/** A Room floor's boundary, which runs inside its Walls' poché. */
	readonly roomFloor?: boolean;
};

export type PaperMarkGeometry = {
	/** Filled polygons the selection tints; the contour below is their boundary. */
	readonly fills: readonly PaperFillPolygons[];
	readonly contours: readonly PaperMarkContour[];
};

export type PaperMarkSet = {
	readonly selection: PaperMarkGeometry;
	readonly hover: PaperMarkGeometry;
	/** The armed Eraser's winner; empty unless the hover tone is `erase`. */
	readonly erase: PaperMarkGeometry;
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
		const contours: PaperMarkContour[] = [];
		for (const cut of [true, false]) {
			const group = fills.filter((fill) => (fill.treatment === 'cut') === cut);
			for (const [elevationMeters, level] of groupByElevation(group, (fill) => fill.elevationMeters)) {
				const segments = unionOutline(level.flatMap((fill) => fill.polygons));
				const roomFloor = !cut && level.some((fill) => fill.treatment === 'room-floor');
				contours.push({ elevationMeters, segments, ...(cut ? { cut } : {}), ...(roomFloor ? { roomFloor } : {}) });
			}
		}
		// A cut line duplicates the fill boundary (and would draw one tick per
		// compiled Wall span); projected, hidden and symbol lines are extra geometry
		// the subject still owns, so they remain part of its identity.
		const extra = fills.length > 0 ? lines.filter((candidate) => candidate.stream !== 'cut') : lines;
		for (const [elevationMeters, level] of groupByElevation(extra, (line) => line.elevationMeters)) {
			contours.push({ elevationMeters, segments: level.flatMap((line) => line.segments) });
		}
		return { fills: fills.filter((fill) => fill.treatment !== 'cut'), contours };
	}
	if (entry.reference.domain === 'scene') {
		const footprints = drawing.footprints.filter((footprint) => footprint.entityId === id);
		// Paper already retained the projection's own polygons: a primitive or an
		// approved model's ring, a tilted form's triangles. The mark overlay tints
		// exactly those, and never fabricates a bounding box when a footprint retains
		// no fillable ring. A tilted form's triangles overlap in plan, so an elevation
		// with several polygons tints their union: no part of the subject is tinted
		// twice, and a single retained ring is drawn exactly as Paper kept it.
		const fillable = footprints.filter((footprint) => footprint.polygons.length > 0);
		const fills: PaperFillPolygons[] = [
			...groupByElevation(fillable, (footprint) => footprint.elevationMeters)
		].map(([elevationMeters, group]) => {
			const polygons = group.flatMap((footprint) => footprint.polygons);
			if (polygons.length === 1) return { elevationMeters, polygons };
			const union = unionPaperFillPolygons(polygons);
			return union === null ? { elevationMeters, polygons } : { elevationMeters, ...union };
		});
		const contours = [...groupByElevation(footprints, (footprint) => footprint.elevationMeters)].map(
			([elevationMeters, group]) => ({
				elevationMeters,
				segments: group.flatMap((footprint) => footprint.segments)
			})
		);
		return { fills, contours };
	}
	return EMPTY_GEOMETRY;
}

/** The selected identity, plus hover only when it is a different subject. */
export function paperMarkSet(
	drawing: PaperPlanDrawing,
	selection: StageSelectionEntry | null,
	hover: StageSelectionEntry | null,
	hoverTone: 'hover' | 'erase' = 'hover'
): PaperMarkSet {
	const selected = selection === null ? EMPTY_GEOMETRY : geometryOf(drawing, selection);
	if (hoverTone === 'erase') {
		return { selection: selected, hover: EMPTY_GEOMETRY, erase: hover === null ? EMPTY_GEOMETRY : geometryOf(drawing, hover) };
	}
	const hovered =
		hover === null || (selection !== null && sameReference(hover.reference, selection.reference))
			? EMPTY_GEOMETRY
			: geometryOf(drawing, hover);
	return { selection: selected, hover: hovered, erase: EMPTY_GEOMETRY };
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
 * Lines are one fat-line batch per tone, fills one batch at their original elevations. Every object
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
		renderOrder: number,
		dashed = false
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
			dashed,
			// Dash lengths are world meters on the sheet.
			...(dashed ? { dashSize: 0.12, gapSize: 0.08 } : {})
		});
		material.resolution.set(resolution[0], resolution[1]);
		const object = new LineSegments2(lineGeometry, material);
		if (dashed) object.computeLineDistances();
		object.renderOrder = renderOrder;
		object.frustumCulled = false;
		object.layers.set(STAGE_OVERLAY_LAYER);
		group.add(object);
		disposables.push(lineGeometry, material);
		fades.push({ material, baseOpacity: material.opacity });
	};

	// Hover: a restrained light contour held by the vocabulary's dark halo, so it
	// reads over vellum and over a cut band without ever borrowing selection gold.
	const hoveredRoom = { fills: [], contours: marks.hover.contours.filter((contour) => contour.roomFloor) };
	const hoverLines = { fills: [], contours: marks.hover.contours.filter((contour) => !contour.roomFloor) };
	addLine(hoverLines, PAPER_MARK_HALO_INK, 4, 0.4, PAPER_MARK_LAYER.hoverHalo);
	addLine(hoverLines, PAPER_HOVER_INK, 2, 0.75, PAPER_MARK_LAYER.hover);
	addLine(hoveredRoom, PAPER_MARK_HALO_INK, 2, 0.5, PAPER_MARK_LAYER.roomContour);
	// A Room's contour is under its Walls, so a faint tint is what shows the hover.
	const roomHoverGeometry = hoveredRoom.contours.length > 0 ? createPaperFillGeometry(marks.hover.fills) : null;
	if (roomHoverGeometry !== null) {
		const material = new MeshBasicMaterial({
			color: new Color(PAPER_MARK_HALO_INK).getHex(),
			side: DoubleSide, transparent: true, opacity: 0.08,
			depthTest: false, depthWrite: false, toneMapped: false
		});
		const mesh = new Mesh(roomHoverGeometry, material);
		mesh.renderOrder = PAPER_MARK_LAYER.selectionTint;
		mesh.frustumCulled = false;
		mesh.layers.set(STAGE_OVERLAY_LAYER);
		group.add(mesh);
		disposables.push(roomHoverGeometry, material);
		fades.push({ material, baseOpacity: material.opacity });
	}

	const tintGeometry = createPaperFillGeometry(marks.selection.fills);
	if (tintGeometry !== null) {
		const material = new MeshBasicMaterial({
			color: new Color(PAPER_SELECTION_INK).getHex(),
			side: DoubleSide, transparent: true, opacity: 0.22,
			depthTest: false, depthWrite: false, toneMapped: false
		});
		const mesh = new Mesh(tintGeometry, material);
		mesh.renderOrder = PAPER_MARK_LAYER.selectionTint;
		mesh.frustumCulled = false;
		mesh.layers.set(STAGE_OVERLAY_LAYER);
		group.add(mesh);
		disposables.push(tintGeometry, material);
		fades.push({ material, baseOpacity: material.opacity });
	}

	// Selection: the dark-gold edge (owner ruling O1) over the same dark halo as
	// hover. The tint above sits under the cut poché, so a subject's identity reads
	// without hiding the Plan.
	const room = { fills: [], contours: marks.selection.contours.filter((contour) => contour.roomFloor) };
	addLine(room, PAPER_MARK_HALO_INK, 4.5, 0.9, PAPER_MARK_LAYER.roomContourHalo);
	addLine(room, PAPER_SELECTION_EDGE_INK, 2.5, 1, PAPER_MARK_LAYER.roomContour);
	const plain = { fills: [], contours: marks.selection.contours.filter((contour) => !contour.cut && !contour.roomFloor) };
	addLine(plain, PAPER_MARK_HALO_INK, 4.5, 0.9, PAPER_MARK_LAYER.selectionHalo);
	addLine(plain, PAPER_SELECTION_EDGE_INK, 2.5, 1, PAPER_MARK_LAYER.selectionLine);
	// A cut Wall: no tint, so its poché stays crisp black. Neither gold holds on both
	// Paper and ink, so the contour is both.
	const cut = { fills: [], contours: marks.selection.contours.filter((contour) => contour.cut) };
	addLine(cut, PAPER_SELECTION_EDGE_INK, PAPER_CUT_SELECTION_EDGE_WIDTH_CSS, 1, PAPER_MARK_LAYER.selectionHalo);
	addLine(cut, PAPER_SELECTION_INK, PAPER_CUT_SELECTION_CORE_WIDTH_CSS, 1, PAPER_MARK_LAYER.selectionLine);

	// Erase: red dashes over a dark halo, above the selection it may be naming.
	addLine(marks.erase, PAPER_MARK_HALO_INK, 4, 0.7, PAPER_MARK_LAYER.eraseHalo);
	addLine(marks.erase, STAGE_ERASE_INK, 2.2, 1, PAPER_MARK_LAYER.erase, true);

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
