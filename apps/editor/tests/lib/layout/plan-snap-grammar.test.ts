import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SnapFeatureKind } from '@portfolio/layout-core';
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument
} from '@portfolio/layout-core';
import { buildPlanRenderModel } from '$lib/layout/plan-render-model';
import { planSvgRule, planViewFixture, renderPlanSvg } from '../../helpers/plan-render-harness';
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

	it('hands the word to the roomier side when neither side fits at all', () => {
		// The corner the S6 review asked to pin twice: on a shallow canvas *both*
		// sides of the mark are too small for the word, so "preferred unless it
		// clips" has no answer at all. The rule is then the roomier side — never the
		// shorter one — and an exact tie keeps the preference rather than pivoting on
		// a difference of zero.
		const view = { ...VIEW, height: 40 };
		const extent = planSnapRelationLabelExtentPx('Endpoint');
		const needed = OFFSET + extent.height;
		const worldIn = (screenY: number): [number, number] => [
			view.center[0] + (160 - view.width / 2) / view.pixelsPerMeter,
			view.center[1] + (screenY - view.height / 2) / view.pixelsPerMeter
		];
		// 16 px above the mark, 24 below; the word needs its own height plus the
		// offset, so *neither* side clears it and the flip can only be the rule.
		expect(16 - needed).toBeLessThan(SNAP_RELATION_LABEL_INSET_PX);
		expect(40 - 16 - needed).toBeLessThan(SNAP_RELATION_LABEL_INSET_PX);
		const roomier = planSnapRelationLabelOffsetPx('Endpoint', worldIn(16), view);
		expect(roomier[1]).toBe(OFFSET + extent.height);

		// The *box* is what gets measured (above is counted from the word's own top
		// edge), so the two sides are equal exactly when that box splits the canvas
		// evenly — and there the preferred side survives a case it does not fit
		// either, rather than pivoting on a difference of zero.
		const tiedScreenY = (view.height + extent.height) / 2;
		const tie = planSnapRelationLabelOffsetPx('Endpoint', worldIn(tiedScreenY), view);
		expect(tie[1]).toBe(-OFFSET);
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
	const tokensSource = readFileSync(
		resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/lib/editor/styles/tokens.css'),
		'utf8'
	);
	const grammarSource = readFileSync(
		resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/lib/editor/layout/plan-snap-grammar.ts'),
		'utf8'
	);

	it('paints the winner and the relation word in the ratified snap ink', () => {
		// §2: "Snap | #146D68 | Winning marker plus relation shape/text". Presenting
		// a snap in the selection blue made "aligned" read as "selected".
		//
		// The token's value is a plain-CSS ownership fact, so that line stays a
		// static read of the file that owns it; the *rules* come from the Svelte
		// compiler's stylesheet, so a dropped or renamed declaration cannot pass.
		expect(tokensSource).toContain('--editor-plan-snap: #146d68;');
		const snapMarker = planSvgRule('.snap-marker');
		expect(snapMarker.fill).toBe('var(--editor-plan-snap)');
		expect(JSON.stringify(snapMarker)).not.toContain('selection');
		expect(planSvgRule('.snap-relation-label').fill).toBe('var(--editor-plan-snap)');
		expect(planSvgRule('.snap-guide').stroke).toBe('var(--editor-plan-snap)');
		// §7's 2 px source accent: the paper stroke separates the winner from the
		// geometry it sits on. The grid fallback keeps the same ink and is
		// distinguished by its glyph (§7), not by going quieter.
		expect(snapMarker['stroke-width']).toBe('2');
		// An open-path glyph (bracket, right angle, plus) has no area, so it needs
		// the snap ink as its stroke; painting it with the fill token renders as a
		// paper-coloured notch in the Wall band — i.e. "a snap was honoured" drawn
		// as "a hole was cut here".
		const stroked = planSvgRule('.snap-glyph-stroke');
		expect(stroked.fill).toBe('none');
		expect(stroked.stroke).toBe('var(--editor-plan-snap)');
		expect(stroked['stroke-width']).toBe('1.5');
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

	it('names layout-core as the extension-guide predicate owner, deferred post-P23.13', () => {
		// D5 (ruled 2026-09-17) closes the ownerless predicate by explicit
		// record: the geometry producer is layout-core's to build (no predicate
		// there expresses "you are extending this wall's line"), and P23.13
		// ships guide-less — the neutral presentation above is the whole claim
		// — with the owner named and the deferral ruled.
		expect(grammarSource).toContain('Owner (D5, ruled 2026-09-17): `layout-core`');
		expect(grammarSource).toContain('UNRATIFIED_SNAP_FAMILIES');
	});

	it('generates every glyph mark in screen space, so a snap never scales with zoom', () => {
		// The marks are derived from the projected winner plus a screen-space
		// radius rather than from world points, which is what keeps them
		// screen-constant. Rendered, not sliced: the geometry below is read off
		// the `d` the shipped component emits for each shape.
		const GLYPHS = ['triangle', 'right-angle', 'bracket', 'circle-cross', 'plus'] as const;
		const paths = new Map<string, string>();
		for (const shape of GLYPHS) {
			const mark = glyphMark(shape);
			expect(mark?.tag, shape).toBe('path');
			expect(mark?.attrs.d, shape).toBeTruthy();
			paths.set(shape, mark!.attrs.d);
		}
		// Distinct shapes are distinct marks: a renamed or aliased glyph cannot
		// silently collapse two families onto one symbol.
		expect(new Set(paths.values()).size).toBe(GLYPHS.length);
		// Screen-constant: the same shape at the same radius draws the same path
		// at 8 px/m and at 100 px/m, because the mark is generated around the
		// projected center in CSS px and never scaled by zoom.
		for (const shape of GLYPHS) {
			expect(glyphMark(shape, 7, 100)?.attrs.d, shape).toBe(paths.get(shape));
		}
		// The stroke-ink glyphs take the halo + stroke treatment keyed on the
		// token the grammar chose, so the paint layer is never asked to re-derive
		// ink from the shape.
		for (const shape of ['right-angle', 'bracket', 'plus'] as const) {
			const classes = glyphMarkClasses(shape);
			expect(classes).toContain('snap-glyph-halo');
			expect(classes).toContain('snap-glyph-stroke');
		}
	});

	it('separates an open-path glyph from the Wall mass with a paper halo', () => {
		// A 1.5 px stroke sitting directly on a graphite band is not a state mark —
		// §6/S4 separate every other state mark with paper, and the filled snap
		// markers get theirs as their own paper stroke.
		const halo = planSvgRule('.snap-glyph-halo');
		expect(halo.fill).toBe('none');
		expect(halo.stroke).toBe('var(--editor-plan-canvas-bg)');
		// Wider than the ink it sits under, or it would be invisible.
		expect(Number(halo['stroke-width'])).toBeGreaterThan(
			Number(planSvgRule('.snap-glyph-stroke')['stroke-width'])
		);
		// …and the halo is drawn *under* the glyph it separates: the emitted pair
		// shares one path, with the paper stroke first.
		const haloPath = glyphMark('plus', 7, 8, 'snap-glyph-halo');
		const inkPath = glyphMark('plus', 7, 8, 'snap-glyph-stroke');
		expect(haloPath?.attrs.d).toBe(inkPath?.attrs.d);
		expect(haloPath!.index).toBeLessThan(inkPath!.index);
	});

	it('draws the grid cross as two orthogonal strokes, not the refusal diagonal', () => {
		// The stroke geometry is what carries the distinction, so assert the path
		// the renderer actually emits: a grid mark that reused `crossPath` (or any
		// diagonal) would put the refusal × on the canvas under a teal fill.
		const plus = glyphMark('plus')!;
		const points = pathPoints(plus.attrs.d);
		expect(points.length).toBe(4);
		const [startX, startY] = points[0];
		const [endX, endY] = points[1];
		expect(endX === startX || endY === startY).toBe(true);
		const [thirdX, thirdY] = points[2];
		const [fourthX, fourthY] = points[3];
		expect(fourthX === thirdX || fourthY === thirdY).toBe(true);
		// Two arms of the same length crossing at the center: an orthogonal `+`.
		expect(spanOf(points)).toEqual({ x: 2 * 7, y: 2 * 7 });
		expect(plus.attrs.d).not.toContain('a ');
	});
});

/** The `<path>` a glyph shape renders, optionally at another zoom or class. */
function glyphMark(
	shape: 'triangle' | 'right-angle' | 'bracket' | 'circle-cross' | 'plus',
	radiusPx = 7,
	pixelsPerMeter = 8,
	className?: string
): ReturnType<typeof renderPlanSvg>[number] | undefined {
	const paths = renderPlanSvg({
		model: glyphPlan(shape, radiusPx),
		planView: planViewFixture({ pixelsPerMeter })
	}).filter((element) => element.tag === 'path');
	return className ? paths.find((element) => element.classes.includes(className)) : paths[0];
}

/** Every class emitted for a glyph shape's mark and its halo. */
function glyphMarkClasses(shape: 'right-angle' | 'bracket' | 'plus'): string[] {
	return renderPlanSvg({ model: glyphPlan(shape, 7) })
		.filter((element) => element.tag === 'path')
		.flatMap((element) => element.classes);
}

/** One screen-space snap mark at the world origin, as the adapters build it. */
function glyphPlan(shape: string, radiusPx: number) {
	const { geometry } = compileWallFirstLayoutGeometry(createEmptyWallFirstLayoutDocument());
	return buildPlanRenderModel(geometry, undefined, {
		selection: [],
		handles: [
			{
				kind: 'circle',
				key: 'snap-mark',
				center: [0, 0],
				radiusPx,
				shape: shape as 'triangle',
				style: shape === 'plus' || shape === 'bracket' || shape === 'right-angle' ? 'snap-glyph-stroke' : 'snap-marker'
			}
		],
		drafts: [],
		labels: []
	});
}

/** The absolute coordinates of a `d` made of `M`/`L` commands, in order. */
function pathPoints(d: string): [number, number][] {
	const numbers = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/gu)].map(
		(match) => [Number(match[1]), Number(match[2])] as [number, number]
	);
	return numbers;
}

/** The bounding box of a glyph's own points, in the path's own units (CSS px). */
function spanOf(points: [number, number][]): { x: number; y: number } {
	const xs = points.map(([x]) => x);
	const ys = points.map(([, y]) => y);
	return { x: Math.max(...xs) - Math.min(...xs), y: Math.max(...ys) - Math.min(...ys) };
}
