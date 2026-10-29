/**
 * R217.S07 — Paper selection ink.
 *
 * Paper's selection is a filter over the drawing S04 already built. These tests
 * pin the two claims a visual check cannot: the filter is by canonical subject id
 * (so a Layout selection never lights a Scene footprint and vice versa), and the
 * re-stroke is an overlay pass above the sheet, not a mesh tint or a second Plan.
 */
import { describe, expect, it } from 'vitest';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { Mesh, MeshBasicMaterial } from 'three';
import type { SemanticReference } from '@portfolio/project-model';
import type { StageSelectionEntry } from '$lib/authoring/stage/semantic-selection';
import {
	PAPER_MARK_LAYER,
	PAPER_SELECTION_INK,
	createPaperMarkScene,
	paperMarkSet
} from '$lib/authoring/stage/paper-marks';
import type { PaperPlanDrawing } from '$lib/authoring/stage/paper-plan';

const WALL_ID = 'wall-a';
const OTHER_WALL_ID = 'wall-b';
const ENTITY_ID = 'entity-a';

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
			segments: [
				[
					[6, 0],
					[7, 0]
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
		expect(marks.selection.fills.map((fill) => fill.key)).toEqual(['wall-a-band']);
		expect(marks.hover.contours).toEqual([]);
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

	it('keeps a different hover quiet and never gold', () => {
		const marks = paperMarkSet(DRAWING, entry('layout', 'wall', WALL_ID), entry('layout', 'wall', OTHER_WALL_ID));
		expect(marks.hover.contours).toHaveLength(1);
		expect(marks.hover.contours[0]!.segments).toHaveLength(1);
		expect(marks.hover.fills).toEqual([]);
	});

	it('addresses a Scene identity by footprint, never by a Layout source id', () => {
		const marks = paperMarkSet(DRAWING, entry('scene', 'primitive', ENTITY_ID), null);
		expect(marks.selection.contours).toHaveLength(1);
		expect(marks.selection.contours[0]!.segments).toHaveLength(1);
		expect(marks.selection.fills).toEqual([]);
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
		expect((selection!.material as LineMaterial).color.getHexString()).toBe(PAPER_SELECTION_INK.slice(1));
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
		expect((tint!.material as MeshBasicMaterial).opacity).toBeCloseTo(0.18);
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
