/**
 * R217.S07/S18 — Paper selection ink.
 *
 * Paper's selection is a filter over the drawing S04 already built. These tests
 * pin the claims a visual check cannot: the filter is by canonical subject id
 * (so a Layout selection never lights a Scene footprint and vice versa), the
 * re-stroke is an overlay pass above the sheet, and S18 fills a Scene subject
 * from the polygons its footprint projection already retained.
 */
import { describe, expect, it } from 'vitest';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { Mesh, MeshBasicMaterial, type Group } from 'three';
import type { SemanticReference } from '@portfolio/project-model';
import type { LayoutVec2 } from '@portfolio/layout-core';
import type { StageSelectionEntry } from '$lib/authoring/stage/semantic-selection';
import {
	PAPER_MARK_LAYER,
	PAPER_SELECTION_EDGE_INK,
	PAPER_SELECTION_INK,
	createPaperMarkScene,
	paperMarkSet
} from '$lib/authoring/stage/paper-marks';
import {
	PAPER_LAYER,
	STAGE_OVERLAY_LAYER,
	type PaperPlanDrawing,
	type PaperSegment
} from '$lib/authoring/stage/paper-plan';

const WALL_ID = 'wall-a';
const OTHER_WALL_ID = 'wall-b';
const OBJECT_ID = 'object-a';
const OPENING_ID = 'opening-a';
const ENTITY_ID = 'entity-a';
const CONCAVE_FORM_ID = 'entity-concave-form';
const TILTED_FORM_ID = 'entity-tilted-form';
const UNFOOTPRINTED_MODEL_ID = 'entity-model-no-footprint';
const OVERLAP_FORM_ID = 'entity-overlap-form';
const RING_FORM_ID = 'entity-ring-form';
const SLIVER_FORM_ID = 'entity-sliver-form';

/** Two triangles that overlap in (0,0)-(1,0)-(0.5,0.5), plus a reversed duplicate of
 * the first, and a zero-area sliver on the square's bottom edge. Their union is 0.75;
 * summed as drawn they cover 1.5, which is the double tint S18 fixes. */
const OVERLAP_TRIANGLES: LayoutVec2[][] = [
	[
		[0, 0],
		[1, 0],
		[1, 1]
	],
	[
		[0, 0],
		[1, 0],
		[0, 1]
	],
	[
		[0, 0],
		[1, 1],
		[1, 0]
	],
	[
		[0, 0],
		[0.5, 0],
		[1, 0]
	]
];
/** Four overlapping rectangles around an empty 1 x 1 centre: union 9 - 1 = 8. */
const RING_RECTANGLES: LayoutVec2[][] = [
	[
		[0, 0],
		[3, 0],
		[3, 1],
		[0, 1]
	],
	[
		[0, 2],
		[3, 2],
		[3, 3],
		[0, 3]
	],
	[
		[0, 0],
		[1, 0],
		[1, 3],
		[0, 3]
	],
	[
		[2, 0],
		[3, 0],
		[3, 3],
		[2, 3]
	]
];
/** Zero-area slivers only: nothing positive to union, so the raw polygons stay. */
const SLIVERS: LayoutVec2[][] = [
	[
		[0, 0],
		[1, 1],
		[2, 2]
	],
	[
		[5, 0],
		[6, 0],
		[7, 0]
	]
];

const SQUARE: LayoutVec2[] = [
	[6, 0],
	[7, 0],
	[7, 1],
	[6, 1]
];
const CONCAVE_RING: LayoutVec2[] = [
	[0, 0],
	[2, 0],
	[2, 1],
	[1, 1],
	[1, 2],
	[0, 2]
];
const TILTED_TRIANGLES: LayoutVec2[][] = [
	[
		[3, 3],
		[4, 3],
		[4, 4]
	],
	[
		[3, 3],
		[4, 4],
		[3, 4]
	]
];

function ringSegments(ring: readonly LayoutVec2[]): PaperSegment[] {
	return ring.map((point, index) => [point, ring[(index + 1) % ring.length]!]);
}

/** Unsigned shoelace area in the plan (x, z) plane. */
function ringArea(ring: readonly LayoutVec2[]): number {
	let twice = 0;
	for (let index = 0; index < ring.length; index += 1) {
		const a = ring[index]!;
		const b = ring[(index + 1) % ring.length]!;
		twice += a[0] * b[1] - b[0] * a[1];
	}
	return Math.abs(twice) / 2;
}

/** The triangles the tint mesh draws, each as three (x, z) corners. */
function tintTriangles(group: Group): LayoutVec2[][] {
	const mesh = group.children.find(
		(child): child is Mesh => child instanceof Mesh && child.material instanceof MeshBasicMaterial
	);
	if (mesh === undefined) return [];
	const position = mesh.geometry.getAttribute('position');
	const index = mesh.geometry.getIndex();
	const corner = (vertex: number): LayoutVec2 => [position.getX(vertex), position.getZ(vertex)];
	const triangles: LayoutVec2[][] = [];
	for (let first = 0; first < (index?.count ?? position.count); first += 3) {
		const ids = index
			? [index.getX(first), index.getX(first + 1), index.getX(first + 2)]
			: [first, first + 1, first + 2];
		triangles.push(ids.map(corner));
	}
	return triangles;
}

function triangleArea([a, b, c]: LayoutVec2[]): number {
	return Math.abs((b![0] - a![0]) * (c![1] - a![1]) - (c![0] - a![0]) * (b![1] - a![1])) / 2;
}

function reference(domain: 'layout' | 'scene', kind: string, id: string): SemanticReference {
	return {
		version: 1,
		domain,
		subject: { kind, id },
		revision: { kind: 'exact', contentRevision: 'revision-a' },
		instancePath: [],
		location:
			domain === 'layout'
				? { kind: 'layout-location', levelId: 'level-ground', structureInstancePath: [] }
				: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

function entry(domain: 'layout' | 'scene', kind: string, id: string): StageSelectionEntry {
	return { reference: reference(domain, kind, id) };
}

const DRAWING: PaperPlanDrawing = {
	lines: [
		{
			key: 'wall-a-cut',
			sourceId: WALL_ID,
			stream: 'cut',
			layer: 40,
			treatment: 'cut',
			elevationMeters: 0,
			segments: [
				[
					[0, 0],
					[4, 0]
				]
			]
		},
		{
			key: 'wall-b-cut',
			sourceId: OTHER_WALL_ID,
			stream: 'cut',
			layer: 40,
			treatment: 'cut',
			elevationMeters: 0,
			segments: [
				[
					[0, 3],
					[4, 3]
				]
			]
		},
		{
			key: 'opening-a-symbol',
			sourceId: OPENING_ID,
			stream: 'symbol',
			layer: 50,
			treatment: 'symbol',
			elevationMeters: 0,
			segments: [
				[
					[1.2, 0],
					[2.1, 0]
				]
			]
		}
	],
	fills: [
		{
			key: 'wall-a-band',
			sourceId: WALL_ID,
			layer: 40,
			treatment: 'cut',
			elevationMeters: 0,
			polygons: [
				[
					[0, -0.1],
					[4, -0.1],
					[4, 0.1],
					[0, 0.1]
				]
			]
		},
		{
			key: 'object-a-footprint',
			sourceId: OBJECT_ID,
			layer: 40,
			treatment: 'cut',
			elevationMeters: 0,
			polygons: [
				[
					[1, 1],
					[2, 1],
					[2, 2],
					[1, 2]
				]
			]
		}
	],
	footprints: [
		{
			key: 'footprint-entity-a',
			entityId: ENTITY_ID,
			kind: 'primitive',
			layer: 60,
			treatment: 'footprint',
			elevationMeters: 0,
			segments: ringSegments(SQUARE),
			polygons: [SQUARE]
		},
		{
			key: 'footprint-concave-form',
			entityId: CONCAVE_FORM_ID,
			kind: 'form',
			layer: 60,
			treatment: 'footprint',
			elevationMeters: 0,
			segments: ringSegments(CONCAVE_RING),
			polygons: [CONCAVE_RING]
		},
		{
			key: 'footprint-tilted-form',
			entityId: TILTED_FORM_ID,
			kind: 'form',
			layer: 60,
			treatment: 'footprint',
			elevationMeters: 0,
			segments: ringSegments([
				[3, 3],
				[4, 3],
				[4, 4],
				[3, 4]
			]),
			polygons: TILTED_TRIANGLES
		},
		{
			key: 'footprint-unfootprinted-model',
			entityId: UNFOOTPRINTED_MODEL_ID,
			kind: 'model',
			layer: 60,
			treatment: 'footprint',
			elevationMeters: 0,
			segments: [
				[
					[8, 8],
					[9, 8]
				]
			],
			polygons: []
		}
	]
};

describe('R217.S07 — Paper mark filtering', () => {
	it('re-strokes only the selected Layout subject and its tint', () => {
		const marks = paperMarkSet(DRAWING, entry('layout', 'wall', WALL_ID), null);
		expect(marks.selection.contours).toHaveLength(1);
		expect(marks.selection.contours[0]!.segments).toHaveLength(4);
		expect(marks.selection.fills).toHaveLength(1);
		expect(marks.selection.fills[0]!.polygons).toHaveLength(1);
		expect(marks.hover.contours).toEqual([]);
	});

	it('fills an Object from its own Plan polygon and union boundary', () => {
		const marks = paperMarkSet(DRAWING, entry('layout', 'object', OBJECT_ID), null);
		expect(marks.selection.fills).toHaveLength(1);
		expect(marks.selection.fills[0]!.polygons).toEqual([
			[
				[1, 1],
				[2, 1],
				[2, 2],
				[1, 2]
			]
		]);
		expect(marks.selection.contours).toHaveLength(1);
		expect(marks.selection.contours[0]!.segments).toHaveLength(4);
	});

	it('strokes a Wall as its union boundary, never one tick per compiled span', () => {
		// A Wall is emitted as one band per compiled solid span. These two quads
		// share the x = 4 edge; stroking the lines would draw that shared edge.
		const split: PaperPlanDrawing = {
			...DRAWING,
			fills: [
				{
					...DRAWING.fills[0]!,
					key: 'wall-a-band-1',
					polygons: [
						[
							[0, -0.1],
							[4, -0.1],
							[4, 0.1],
							[0, 0.1]
						]
					]
				},
				{
					...DRAWING.fills[0]!,
					key: 'wall-a-band-2',
					polygons: [
						[
							[4, -0.1],
							[7, -0.1],
							[7, 0.1],
							[4, 0.1]
						]
					]
				}
			]
		};
		const marks = paperMarkSet(split, entry('layout', 'wall', WALL_ID), null);
		expect(marks.selection.contours).toHaveLength(1);
		// Four outer edges; the shared x = 4 edge is not in the union boundary.
		expect(marks.selection.contours[0]!.segments).toHaveLength(4);
	});

	it('keeps a filled subject’s non-cut lines and drops only the duplicate cut outline', () => {
		const mixed: PaperPlanDrawing = {
			...DRAWING,
			lines: [
				...DRAWING.lines,
				{
					key: 'wall-a-projected',
					sourceId: WALL_ID,
					stream: 'projected',
					layer: 30,
					treatment: 'projected',
					elevationMeters: 0,
					segments: [
						[
							[0, 0],
							[4, 0]
						]
					]
				}
			]
		};
		const marks = paperMarkSet(mixed, entry('layout', 'wall', WALL_ID), null);
		// Four union edges plus the projected span; the cut span outline is not
		// stroked a second time.
		expect(marks.selection.contours[0]!.segments).toHaveLength(5);
	});

	it('never promotes a hover of the selected identity into a second ink', () => {
		const selected = entry('layout', 'wall', WALL_ID);
		const marks = paperMarkSet(DRAWING, selected, selected);
		expect(marks.hover.contours).toEqual([]);
		expect(marks.hover.fills).toEqual([]);
	});

	it('draws the Eraser winner as its own erase pass, even on the selection (R217.S10)', () => {
		const selected = entry('layout', 'wall', WALL_ID);
		const marks = paperMarkSet(DRAWING, selected, selected, 'erase');
		expect(marks.erase.contours).toHaveLength(1);
		expect(marks.hover.contours).toEqual([]);
		expect(paperMarkSet(DRAWING, selected, selected).erase.contours).toEqual([]);
	});

	it('keeps a different hover quiet and never gold', () => {
		const marks = paperMarkSet(DRAWING, entry('layout', 'wall', WALL_ID), entry('layout', 'wall', OTHER_WALL_ID));
		expect(marks.hover.contours).toHaveLength(1);
		expect(marks.hover.contours[0]!.segments).toHaveLength(1);
		expect(marks.hover.fills).toEqual([]);
	});

	it('addresses a Scene identity by footprint, never by a Layout source id', () => {
		const marks = paperMarkSet(DRAWING, entry('scene', 'primitive', ENTITY_ID), null);
		expect(marks.selection.contours).toHaveLength(1);
		expect(marks.selection.contours[0]!.segments).toHaveLength(4);
		expect(marks.selection.fills).toHaveLength(1);
		expect(marks.selection.fills[0]!.polygons).toEqual([SQUARE]);
	});

	it('fills a concave upright form with its own ring, not a bounding rectangle', () => {
		const marks = paperMarkSet(DRAWING, entry('scene', 'form', CONCAVE_FORM_ID), null);
		expect(marks.selection.fills).toHaveLength(1);
		expect(marks.selection.fills[0]!.polygons).toEqual([CONCAVE_RING]);
		expect(marks.selection.fills[0]!.polygons[0]).toHaveLength(6);
		expect(marks.selection.contours[0]!.segments).toHaveLength(6);
	});

	it('fills a tilted form once, as the union of its projected triangles (R217.S18)', () => {
		// The two triangles share only their diagonal, so their union is the unit square.
		const marks = paperMarkSet(DRAWING, entry('scene', 'form', TILTED_FORM_ID), null);
		expect(marks.selection.fills).toHaveLength(1);
		expect(marks.selection.fills[0]!.polygons).toHaveLength(1);
		expect(marks.selection.fills[0]!.polygons[0]).toHaveLength(4);
		expect(ringArea(marks.selection.fills[0]!.polygons[0]!)).toBeCloseTo(1, 9);
	});

	it('keeps a footprint with no retained fill polygons contour-only', () => {
		const marks = paperMarkSet(DRAWING, entry('scene', 'model', UNFOOTPRINTED_MODEL_ID), null);
		expect(marks.selection.fills).toEqual([]);
		expect(marks.selection.contours).toHaveLength(1);
		expect(marks.selection.contours[0]!.segments).toHaveLength(1);
	});

	it('never fills an Opening as its host Wall', () => {
		const marks = paperMarkSet(DRAWING, entry('layout', 'opening', OPENING_ID), null);
		expect(marks.selection.fills).toEqual([]);
		expect(marks.selection.contours).toHaveLength(1);
		expect(marks.selection.contours[0]!.segments).toEqual([
			[
				[1.2, 0],
				[2.1, 0]
			]
		]);
	});
});

const footprintOf = (entityId: string, polygons: LayoutVec2[][]): PaperPlanDrawing['footprints'][number] => ({
	key: `footprint-${entityId}`,
	entityId,
	kind: 'form',
	layer: 60,
	treatment: 'footprint',
	elevationMeters: 0,
	segments: [],
	polygons
});

const WITH_UNIONS: PaperPlanDrawing = {
	...DRAWING,
	footprints: [
		...DRAWING.footprints,
		footprintOf(OVERLAP_FORM_ID, OVERLAP_TRIANGLES),
		footprintOf(RING_FORM_ID, RING_RECTANGLES),
		footprintOf(SLIVER_FORM_ID, SLIVERS)
	]
};

describe('R217.S18 — union tint of a Scene subject', () => {
	it('tints overlapping projected triangles once, as their union', () => {
		const marks = paperMarkSet(WITH_UNIONS, entry('scene', 'form', OVERLAP_FORM_ID), null);
		expect(marks.selection.fills).toHaveLength(1);
		expect(marks.selection.fills[0]!.polygons).toHaveLength(1);
		expect(ringArea(marks.selection.fills[0]!.polygons[0]!)).toBeCloseTo(0.75, 9);
		const resources = createPaperMarkScene(marks, [800, 600]);
		try {
			const triangles = tintTriangles(resources.group);
			expect(triangles.reduce((sum, triangle) => sum + triangleArea(triangle), 0)).toBeCloseTo(0.75, 9);
		} finally {
			resources.dispose();
		}
	});

	it('tints a union with a hole once, and never the hole', () => {
		const marks = paperMarkSet(WITH_UNIONS, entry('scene', 'form', RING_FORM_ID), null);
		const fill = marks.selection.fills[0]!;
		expect(marks.selection.fills).toHaveLength(1);
		expect(fill.polygons).toHaveLength(1);
		expect(fill.holes?.[0]).toHaveLength(1);
		expect(ringArea(fill.polygons[0]!) - ringArea(fill.holes![0]![0]!)).toBeCloseTo(8, 9);
		const resources = createPaperMarkScene(marks, [800, 600]);
		try {
			const triangles = tintTriangles(resources.group);
			expect(triangles.reduce((sum, triangle) => sum + triangleArea(triangle), 0)).toBeCloseTo(8, 9);
			const centroidsInHole = triangles.filter((triangle) => {
				const x = (triangle[0]![0] + triangle[1]![0] + triangle[2]![0]) / 3;
				const z = (triangle[0]![1] + triangle[1]![1] + triangle[2]![1]) / 3;
				return x > 1 && x < 2 && z > 1 && z < 2;
			});
			expect(centroidsInHole).toHaveLength(0);
		} finally {
			resources.dispose();
		}
	});

	it('keeps the raw polygons when no positive area is left to outline', () => {
		const marks = paperMarkSet(WITH_UNIONS, entry('scene', 'form', SLIVER_FORM_ID), null);
		expect(marks.selection.fills).toEqual([{ elevationMeters: 0, polygons: SLIVERS }]);
	});
});

describe('R217.S07 — Paper mark overlay', () => {
	it('draws above the sheet on the overlay layer without depth testing', () => {
		const marks = paperMarkSet(DRAWING, entry('layout', 'wall', WALL_ID), entry('scene', 'primitive', ENTITY_ID));
		const resources = createPaperMarkScene(marks, [800, 600]);
		try {
		const lines = resources.group.children.filter((child): child is LineSegments2 => child instanceof LineSegments2);
		expect(lines).toHaveLength(4);
		const selection = lines.find((line) => line.renderOrder === PAPER_MARK_LAYER.selectionLine);
		const hover = lines.find((line) => line.renderOrder === PAPER_MARK_LAYER.hover);
		const selectionHalo = lines.find((line) => line.renderOrder === PAPER_MARK_LAYER.selectionHalo);
		const hoverHalo = lines.find((line) => line.renderOrder === PAPER_MARK_LAYER.hoverHalo);
		expect(selection).toBeDefined();
		expect(hover).toBeDefined();
		expect(selectionHalo).toBeDefined();
		expect(hoverHalo).toBeDefined();
		expect(selection!.renderOrder).toBeGreaterThan(60);
		expect((selection!.material as LineMaterial).color.getHexString()).toBe(PAPER_SELECTION_EDGE_INK.slice(1));
		expect((selection!.material as LineMaterial).depthTest).toBe(false);
		expect(selection!.layers.mask).toBe(1 << 2);
		expect((selectionHalo!.material as LineMaterial).color.getHexString()).toBe('152c26');
		expect((hover!.material as LineMaterial).color.getHexString()).toBe('f3f4ee');
		expect((hoverHalo!.material as LineMaterial).color.getHexString()).toBe('152c26');
		expect(resources.group.layers.mask).toBe(1 << 2);
		const tint = resources.group.children.find(
			(child): child is Mesh => child instanceof Mesh && child.material instanceof MeshBasicMaterial
		);
		expect(tint).toBeDefined();
		expect(tint!.renderOrder).toBe(PAPER_MARK_LAYER.selectionTint);
		// The fill sits above the cut poché and under the cut stroke.
		expect(tint!.renderOrder).toBeGreaterThan(PAPER_LAYER.cut - 1);
		expect(tint!.renderOrder).toBeLessThan(PAPER_LAYER.cut);
		expect((tint!.material as MeshBasicMaterial).opacity).toBeCloseTo(0.22);
	} finally {
		resources.dispose();
	}
});

	it('draws a Scene subject’s Paper fill from its retained polygons', () => {
		const marks = paperMarkSet(DRAWING, entry('scene', 'form', CONCAVE_FORM_ID), null);
		const resources = createPaperMarkScene(marks, [800, 600]);
		try {
			const meshes = resources.group.children.filter(
				(child): child is Mesh => child instanceof Mesh && child.material instanceof MeshBasicMaterial
			);
			expect(meshes).toHaveLength(1);
			expect(meshes[0]!.renderOrder).toBe(PAPER_MARK_LAYER.selectionTint);
			expect((meshes[0]!.material as MeshBasicMaterial).opacity).toBeCloseTo(0.22);
			// The tint is a Paper overlay, never world geometry a pick can hit.
			expect(meshes[0]!.layers.mask).toBe(1 << STAGE_OVERLAY_LAYER);
		} finally {
			resources.dispose();
		}
	});

	it('never tints hover', () => {
		const marks = paperMarkSet(DRAWING, null, entry('layout', 'wall', WALL_ID));
		const resources = createPaperMarkScene(marks, [800, 600]);
		try {
			expect(
				resources.group.children.filter(
					(child): child is Mesh => child instanceof Mesh && child.material instanceof MeshBasicMaterial
				)
			).toHaveLength(0);
			const lines = resources.group.children.filter(
				(child): child is LineSegments2 => child instanceof LineSegments2
			);
			expect(lines).toHaveLength(2);
			expect(lines.every((line) => (line.material as LineMaterial).color.getHexString() !== PAPER_SELECTION_INK.slice(1))).toBe(true);
		} finally {
			resources.dispose();
		}
	});

	it('joins the drawing fade', () => {
		const marks = paperMarkSet(DRAWING, entry('layout', 'wall', WALL_ID), null);
		const resources = createPaperMarkScene(marks, [800, 600]);
		try {
			resources.setFade(0);
			for (const child of resources.group.children) {
				const material = (child as LineSegments2).material as LineMaterial;
				expect(material.opacity).toBe(0);
			}
			resources.setFade(1);
			for (const child of resources.group.children) {
				const material = (child as LineSegments2).material as LineMaterial;
				expect(material.opacity).toBeGreaterThan(0);
			}
		} finally {
			resources.dispose();
		}
	});
});
