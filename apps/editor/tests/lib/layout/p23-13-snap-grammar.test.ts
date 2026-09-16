import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SnapFeatureKind } from '@portfolio/layout-core';
import {
	PLAN_SNAP_EXACT_VALUE_LABEL,
	PLAN_SNAP_GLYPHS,
	UNRATIFIED_SNAP_FAMILIES,
	planSnapGlyph
} from '$lib/editor/layout/plan-snap-grammar';
import {
	SNAP_RELATION_LABEL_INSET_PX,
	planSnapRelationLabelOffsetPx,
	snapMarkerRadiusPx,
	withLayoutSnapFeedback
} from '$lib/editor/layout/plan-overlays';
import { PLAN_SNAP_LABEL_TYPOGRAPHY, planSnapRelationLabelExtentPx } from '$lib/editor/layout/plan-snap-grammar';

/**
 * P23.13 S5 — snap/guide presentation (spec §7).
 *
 * §7 asks for exactly: one winner glyph (endpoint square / midpoint triangle /
 * intersection ×-in-circle / orthogonal right angle / Opening-edge bracket /
 * grid cross), a short relation word, a source accent, and at most one guide.
 * Everything asserted here is presentation: the winner itself is computed by the
 * unchanged P23.2 resolver and is passed in as data.
 */

const RATIFIED: readonly SnapFeatureKind[] = [
	'junction',
	'wall-intersection',
	'wall-midpoint',
	'opening-edge',
	'orthogonal-guide',
	'grid'
];

/** Every family the resolver can hand to presentation. */
const ALL_FAMILIES: readonly SnapFeatureKind[] = [
	...RATIFIED,
	...UNRATIFIED_SNAP_FAMILIES
];

function resolution(kind: SnapFeatureKind, guides: { start: [number, number]; end: [number, number] }[] = []) {
	return {
		kind: 'snap' as const,
		candidate: { point: [1, 1] as [number, number], kind, sourceId: 'src', distance: 0 },
		guides: guides.map((guide) => ({
			kind: 'orthogonal-x' as const,
			start: guide.start,
			end: guide.end
		}))
	};
}

/** A 320x90 canvas whose world origin sits at the view center, 26 px per meter. */
const VIEW = {
	width: 320,
	height: 90,
	center: [6, 4] as [number, number],
	pixelsPerMeter: 26,
	initialized: true,
	gridEnabled: false,
	snapEnabled: true,
	angleSnapEnabled: true,
	showTourOverlay: false
};

/** Screen point → world point under `VIEW`. */
function worldAt(screenX: number, screenY: number): [number, number] {
	return [
		VIEW.center[0] + (screenX - VIEW.width / 2) / VIEW.pixelsPerMeter,
		VIEW.center[1] + (screenY - VIEW.height / 2) / VIEW.pixelsPerMeter
	];
}

function feedbackOf(
	kind: SnapFeatureKind,
	options?: { explicitValue?: boolean },
	guides?: { start: [number, number]; end: [number, number] }[]
) {
	const base = {
		selected: undefined,
		selection: [],
		handles: [],
		drafts: [],
		labels: []
	} as never;
	return withLayoutSnapFeedback(base, resolution(kind, guides), options ?? {});
}

/** Both snap-glyph ink tokens: filled silhouettes and stroked open paths. */
const SNAP_MARK_STYLES = new Set(['snap-marker', 'snap-glyph-stroke']);

function marksOf(projection: ReturnType<typeof withLayoutSnapFeedback>) {
	return projection.drafts.filter(
		(primitive) => primitive.kind === 'circle' && SNAP_MARK_STYLES.has(primitive.style.toString())
	);
}

function guidesOf(projection: ReturnType<typeof withLayoutSnapFeedback>) {
	return projection.drafts.filter((primitive) => primitive.style === 'snap-guide');
}

function wordsOf(projection: ReturnType<typeof withLayoutSnapFeedback>) {
	return projection.drafts.filter(
		(primitive) => primitive.kind === 'text' && primitive.style === 'snap-relation-label'
	);
}

describe('P23.13 S5 snap glyph map — shape and word, not colour', () => {
	it('gives every ratified family its §7 shape and a relation word', () => {
		const expected: Record<string, string> = {
			junction: 'square',
			'wall-intersection': 'circle-cross',
			'wall-midpoint': 'triangle',
			'opening-edge': 'bracket',
			'orthogonal-guide': 'right-angle',
			grid: 'plus'
		};
		for (const [kind, shape] of Object.entries(expected)) {
			expect(planSnapGlyph(kind as SnapFeatureKind).shape).toBe(shape);
		}
		// The words are what makes the shape readable without a legend.
		expect(planSnapGlyph('junction').label).toBe('Endpoint');
		expect(planSnapGlyph('wall-midpoint').label).toBe('Midpoint');
		expect(planSnapGlyph('wall-intersection').label).toBe('Intersection');
		expect(planSnapGlyph('opening-edge').label).toBe('Opening edge');
		expect(planSnapGlyph('orthogonal-guide').label).toBe('Right angle');
		expect(planSnapGlyph('grid').label).toBe('Grid');
	});

	it('never invents a glyph for a family §7 does not name', () => {
		for (const kind of UNRATIFIED_SNAP_FAMILIES) {
			expect(PLAN_SNAP_GLYPHS[kind]).toBeUndefined();
			const glyph = planSnapGlyph(kind);
			expect(glyph.shape).toBe('dot');
			expect(glyph.label).not.toBe('Aligned');
		}
		expect(planSnapGlyph('object-bounds-center').label).toBe('Object center');
	});

	it('decides every resolver family exactly once', () => {
		// A family in the resolver but in neither table would silently fall
		// through; a family in both would be two answers. The grammar module also
		// enforces this at the type level.
		expect(new Set(ALL_FAMILIES).size).toBe(ALL_FAMILIES.length);
		for (const kind of RATIFIED) {
			expect(UNRATIFIED_SNAP_FAMILIES).not.toContain(kind);
		}
		// The six ratified glyphs are distinct shapes, so no two relations are
		// presented identically.
		const shapes = RATIFIED.map((kind) => planSnapGlyph(kind).shape);
		expect(new Set(shapes).size).toBe(shapes.length);
	});

	it('never gives a snap winner the refusal mark', () => {
		// `cross` is spec §6's refusal × — the diagonal stroke of a refused
		// proposal. The grid fallback used it briefly, which meant one stroke
		// meant "grid honoured" and "proposal refused" at the same time. §7's
		// "small cross" is the upright `+`.
		expect(planSnapGlyph('grid').shape).toBe('plus');
		for (const kind of RATIFIED) {
			expect(planSnapGlyph(kind).shape).not.toBe('cross');
		}
		// The intersection's inner stroke keeps the diagonal (its own §7 glyph),
		// so the refusal path is shared only by marks that are not snap winners.
		expect(planSnapGlyph('wall-intersection').shape).toBe('circle-cross');
	});

	it('keeps the P23.2 marker weights, so §7 adds identity without re-tuning weight', () => {
		expect(snapMarkerRadiusPx('junction')).toBe(5);
		expect(snapMarkerRadiusPx('wall-intersection')).toBe(5);
		expect(snapMarkerRadiusPx('wall-midpoint')).toBe(4);
		expect(snapMarkerRadiusPx('opening-edge')).toBe(4);
		expect(snapMarkerRadiusPx('wall-span')).toBe(4);
		expect(snapMarkerRadiusPx('grid')).toBe(3);
	});
});

describe('P23.13 S5 snap presentation — one winner, one guide, one word', () => {
	it('draws exactly one mark and one relation word for a winner', () => {
		for (const kind of ALL_FAMILIES) {
			const projection = feedbackOf(kind);
			expect(marksOf(projection)).toHaveLength(1);
			expect(wordsOf(projection)).toHaveLength(1);
			expect(marksOf(projection)[0]).toMatchObject({
				center: [1, 1],
				shape: planSnapGlyph(kind).shape === 'dot' ? 'circle' : planSnapGlyph(kind).shape
			});
		}
	});

	it('claims no hit target: a snap mark is a relation, not an affordance', () => {
		// §7 — "the handle is stationary and actionable while the winner has a
		// relation label and no independent hit target".
		for (const kind of ALL_FAMILIES) {
			for (const primitive of feedbackOf(kind).drafts) {
				expect(primitive).not.toHaveProperty('hit');
			}
		}
	});

	it('caps guides at one even when a caller hands over several', () => {
		// The resolver emits at most one today; this makes the cap a presentation
		// guarantee rather than a property the overlay merely inherits, so a
		// hand-built resolution cannot become a candidate cloud.
		const projection = feedbackOf('orthogonal-guide', undefined, [
			{ start: [0, 0], end: [1, 0] },
			{ start: [0, 0], end: [0, 1] },
			{ start: [0, 0], end: [1, 1] }
		]);
		expect(guidesOf(projection)).toHaveLength(1);
		expect(guidesOf(projection)[0]).toMatchObject({ kind: 'polyline', points: [[0, 0], [1, 0]] });
		// One guide does not cost the winner its mark or its word.
		expect(marksOf(projection)).toHaveLength(1);
		expect(wordsOf(projection)).toHaveLength(1);
	});

	it('adds nothing at all when the resolver reports no winner', () => {
		const base = {
			selected: undefined,
			selection: [],
			handles: [],
			drafts: [],
			labels: []
		} as never;
		expect(withLayoutSnapFeedback(base, { kind: 'none' }).drafts).toEqual([]);
		expect(withLayoutSnapFeedback(base, null).drafts).toEqual([]);
	});

	it('derives the whole presentation from the resolution it is given', () => {
		// Release truth (PR #56) depends on this: whatever the release re-derive
		// resolves is what gets painted, with no state carried between frames.
		const first = feedbackOf('junction');
		const second = feedbackOf('junction');
		expect(first.drafts).toEqual(second.drafts);
		expect(feedbackOf('grid').drafts).not.toEqual(first.drafts);
	});
});

describe('P23.13 S5 explicit value — the claim is withdrawn, the reason is kept', () => {
	it('removes the winner mark and the guide, and reports Exact value', () => {
		const projection = feedbackOf('junction', { explicitValue: true }, [
			{ start: [0, 0], end: [1, 0] }
		]);
		expect(marksOf(projection)).toHaveLength(0);
		expect(guidesOf(projection)).toHaveLength(0);
		expect(wordsOf(projection)).toHaveLength(1);
		expect(wordsOf(projection)[0]).toMatchObject({ text: PLAN_SNAP_EXACT_VALUE_LABEL });
	});

	it('still names where the suppressed relation was, so the report is local', () => {
		const projection = feedbackOf('wall-midpoint', { explicitValue: true });
		expect(wordsOf(projection)[0]).toMatchObject({ anchor: [1, 1] });
	});

	it('does not suppress anything by default', () => {
		expect(marksOf(feedbackOf('junction'))).toHaveLength(1);
		expect(marksOf(feedbackOf('junction', {}))).toHaveLength(1);
	});
});

describe('P23.13 S5 relation word placement — the side that has room', () => {
	const OFFSET = 10;

	function labelBox(text: string, screenX: number, screenY: number) {
		const [dx, dy] = planSnapRelationLabelOffsetPx(text, worldAt(screenX, screenY), VIEW);
		const extent = planSnapRelationLabelExtentPx(text);
		// The paint layer lays the word out from its anchor: anchor x is the box's
		// left edge, anchor y its baseline.
		const left = screenX + dx;
		const above =
			-dy >= extent.height;
		return {
			left,
			right: left + extent.width,
			top: above ? screenY - extent.height : screenY,
			bottom: above ? screenY : screenY + extent.height
		};
	}

	it('prefers up and to the right, where there is room', () => {
		const offset = planSnapRelationLabelOffsetPx('Intersection', worldAt(160, 45), VIEW);
		expect(offset).toEqual([OFFSET, -OFFSET]);
	});

	it('keeps its preferred side when no view is given', () => {
		// Placement is an added rule, not a new requirement on callers.
		expect(planSnapRelationLabelOffsetPx('Endpoint', [6, 3], undefined)).toEqual([OFFSET, -OFFSET]);
	});

	it('flips below a corner winner so the word is not cut by the top edge', () => {
		// Seen in the S5 plate: a winner at the canvas corner drew "Endpoint"
		// with its top half outside the frame.
		const corner = planSnapRelationLabelOffsetPx('Endpoint', worldAt(14, 12), VIEW);
		expect(corner[1]).toBeGreaterThan(0);
		// There is room to the right of a left-hand winner, so only y flips.
		expect(corner[0]).toBe(OFFSET);
	});

	it('flips left of a winner that has no room to its right', () => {
		const rightEdge = planSnapRelationLabelOffsetPx('Intersection', worldAt(300, 45), VIEW);
		expect(rightEdge[0]).toBeLessThan(0);
		// Vertically there is room, so the preferred side is kept.
		expect(rightEdge[1]).toBe(-OFFSET);
	});

	it('never leaves a relation word outside the canvas, in any corner', () => {
		const words = ['Endpoint', 'Midpoint', 'Intersection', 'Right angle', 'Opening edge', 'Exact value'];
		const corners: [number, number][] = [
			[6, 6],
			[VIEW.width - 6, 6],
			[6, VIEW.height - 6],
			[VIEW.width - 6, VIEW.height - 6],
			[VIEW.width / 2, 6],
			[VIEW.width - 6, VIEW.height / 2]
		];
		for (const text of words) {
			for (const [screenX, screenY] of corners) {
				const box = labelBox(text, screenX, screenY);
				expect(box.left).toBeGreaterThanOrEqual(SNAP_RELATION_LABEL_INSET_PX - 1);
				expect(box.right).toBeLessThanOrEqual(VIEW.width - SNAP_RELATION_LABEL_INSET_PX + 1);
				expect(box.top).toBeGreaterThanOrEqual(SNAP_RELATION_LABEL_INSET_PX - 1);
			}
		}
	});

	it('places the word with the typography the label is painted in', () => {
		expect(PLAN_SNAP_LABEL_TYPOGRAPHY.fontSizePx).toBe(10);
		expect(planSnapRelationLabelExtentPx('').width).toBe(0);
		expect(planSnapRelationLabelExtentPx('Grid').width).toBeGreaterThan(15);
		expect(planSnapRelationLabelExtentPx('Grid').height).toBe(PLAN_SNAP_LABEL_TYPOGRAPHY.lineHeightPx);
	});

	it('carries the chosen offset onto the primitive, mark unchanged', () => {
		const base = {
			selected: undefined,
			selection: [],
			handles: [],
			drafts: [],
			labels: []
		} as never;
		const projection = withLayoutSnapFeedback(
			base,
			{
				kind: 'snap',
				candidate: { point: worldAt(14, 12), kind: 'junction', sourceId: 'src', distance: 0 },
				guides: []
			},
			{ view: VIEW }
		);
		const word = wordsOf(projection)[0];
		if (word?.kind !== 'text') throw new Error('expected a relation word');
		expect(word.style).toBe('snap-relation-label');
		expect(word.offsetPx?.[1]).toBeGreaterThan(0);
		// The mark is still on the winner: only the word moves.
		expect(marksOf(projection)[0]).toMatchObject({ center: worldAt(14, 12) });
	});
});

describe('P23.13 S5 snap ink — its own colour, the adapters own it', () => {
	const svgSource = readFileSync(
		resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/lib/editor/layout/PlanSvg.svelte'),
		'utf8'
	);
	const tokensSource = readFileSync(
		resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/lib/editor/styles/tokens.css'),
		'utf8'
	);

	it('paints the winner and the relation word in the ratified snap ink', () => {
		// §2: "Snap | #146D68 | Winning marker plus relation shape/text". Presenting
		// a snap in the selection blue made "aligned" read as "selected".
		expect(tokensSource).toContain('--editor-plan-snap: #146d68;');
		const snapMarker = /\.snap-marker \{([^}]*)\}/u.exec(svgSource)?.[1] ?? '';
		expect(snapMarker).toContain('fill: var(--editor-plan-snap)');
		expect(snapMarker).not.toContain('selection');
		const label = /\.snap-relation-label \{([^}]*)\}/u.exec(svgSource)?.[1] ?? '';
		expect(label).toContain('fill: var(--editor-plan-snap)');
		const guide = /\.snap-guide \{([^}]*)\}/u.exec(svgSource)?.[1] ?? '';
		expect(guide).toContain('stroke: var(--editor-plan-snap)');
		// §7's 2 px source accent: the paper stroke separates the winner from the
		// geometry it sits on. The grid fallback keeps the same ink and is
		// distinguished by its glyph (§7), not by going quieter.
		expect(snapMarker).toContain('stroke-width: 2');
		// An open-path glyph (bracket, right angle, cross) has no area, so it needs
		// the snap ink as its stroke; painting it with the fill token renders as a
		// paper-coloured notch in the Wall band — i.e. "a snap was honoured" drawn
		// as "a hole was cut here".
		const stroked = /\.snap-glyph-stroke \{([^}]*)\}/u.exec(svgSource)?.[1] ?? '';
		expect(stroked).toContain('fill: none');
		expect(stroked).toContain('stroke: var(--editor-plan-snap)');
		expect(stroked).toContain('stroke-width: 1.5');
	});

	it('gives every stroke-drawn glyph the stroke ink and every closed glyph the fill ink', () => {
		// The ink is a property of the shape, so the table decides it and the
		// presentation layer never guesses: this is the fix for open paths painted
		// with the filled marker token.
		for (const kind of RATIFIED) {
			const glyph = planSnapGlyph(kind);
			const open = glyph.shape === 'bracket' || glyph.shape === 'right-angle' || glyph.shape === 'plus';
			expect(glyph.ink).toBe(open ? 'stroke' : 'fill');
			const mark = marksOf(feedbackOf(kind))[0];
			expect(mark).toMatchObject({ style: open ? 'snap-glyph-stroke' : 'snap-marker' });
		}
		// The neutral fallback is a filled dot, so an unratified family still
		// paints in the snap ink rather than as a hole.
		expect(planSnapGlyph('extension-guide').ink).toBe('fill');
	});

	it('generates every glyph mark in screen space, so a snap never scales with zoom', () => {
		// The marks are derived from the projected winner rather than from world
		// points, which is what keeps them screen-constant.
		expect(svgSource).toContain('function snapGlyphPath(');
		for (const glyph of ['triangle', 'right-angle', 'bracket', 'circle-cross', 'plus']) {
			expect(svgSource).toContain(`case '${glyph}':`);
		}
		// The stroke-ink glyphs share one branch keyed on the token the grammar
		// chose, so the paint layer never re-derives ink from the shape.
		expect(svgSource).toContain("primitive.style === 'snap-glyph-stroke'");
		expect(svgSource).toContain("snapGlyphPath(primitive.shape ?? '', screen, primitive.radiusPx)");
	});

	it('separates an open-path glyph from the Wall mass with a paper halo', () => {
		// A 1.5 px stroke sitting directly on a graphite band is not a state mark —
		// §6/S4 separate every other state mark with paper, and the filled snap
		// markers get theirs as their own paper stroke.
		const halo = /\.snap-glyph-halo \{([^}]*)\}/u.exec(svgSource)?.[1] ?? '';
		expect(halo).toContain('fill: none');
		expect(halo).toContain('stroke: var(--editor-plan-canvas-bg)');
		// Wider than the ink it sits under, or it would be invisible.
		const haloWidth = Number(/stroke-width: ([\d.]+)/u.exec(halo)?.[1] ?? '0');
		const inkWidth = Number(
			/stroke-width: ([\d.]+)/u.exec(/\.snap-glyph-stroke \{([^}]*)\}/u.exec(svgSource)?.[1] ?? '')?.[1] ?? '0'
		);
		expect(haloWidth).toBeGreaterThan(inkWidth);
	});

	it('draws the grid cross as two orthogonal strokes, not the refusal diagonal', () => {
		// The stroke geometry is what carries the distinction, so assert the path
		// itself: a grid mark that reuses `crossPath` (or any diagonal) would put
		// the refusal × on the canvas under a teal fill.
		const plus = /case 'plus':\s*\n\s*return `([^`]*)`/u.exec(svgSource)?.[1] ?? '';
		expect(plus).toContain('${cy} L ${cx + radius} ${cy}');
		expect(plus).toContain('M ${cx} ${cy - radius}');
		expect(plus).not.toContain('crossPath');
	});
});
