/**
 * `plan-snap-grammar.ts` — P23.13 S5: the snap *presentation* grammar.
 *
 * Spec §7: "endpoint = square; midpoint = triangle; intersection = × inside
 * circle; perpendicular/orthogonal = right angle; Opening edge = bracket; grid =
 * small cross. Each gets a short relation label, a 2 px source accent if useful,
 * and at most one guide." A winner is presented by **shape and word**, so the
 * relation survives grayscale and doesn't lean on colour (§6's non-colour
 * identity rule).
 *
 * The spec also says: "A missing snap family is not added by this proposal;
 * omit its glyph until the owner can actually honor that relation." That cuts
 * both ways for this table — the resolver owns families the spec does not name,
 * and inventing a glyph for them would be exactly the fabrication the sentence
 * forbids. So ratified families get their glyph and word, and the rest fall
 * back to a single neutral mark with their own plain word, recorded as
 * `UNRATIFIED_SNAP_FAMILIES` so the gap is visible rather than papered over.
 *
 * §7's third item — "a 2 px source accent if useful" — is **deliberately not
 * drawn**. An accent means picking which existing geometry to highlight as the
 * relation's source, and `SnapCandidate` carries `sourceId` without the identity
 * or extent needed to paint it (`grid` has no source entity at all, and a
 * `wall-midpoint` source is a derived point, not a span). Highlighting the
 * nearest plausible entity instead would be exactly the fabrication §7 forbids
 * ("a missing snap family is not added by this proposal"), and the winner's own
 * paper stroke already separates it from the ink it sits on. Recorded as a
 * decision rather than silently skipped: the accent needs canonical source
 * extent first, and that is a resolver change, not a presentation one.
 *
 * Presentation only: no snap math, no thresholds that could change a winner,
 * and nothing here is read by the resolver.
 */
import type { SnapFeatureKind } from '@portfolio/layout-core';

/** The mark shapes §7 ratifies, plus the neutral fallback. */
export type PlanSnapGlyphShape =
	/** Endpoint. */
	| 'square'
	/** Midpoint. */
	| 'triangle'
	/** Intersection: × inside a circle. */
	| 'circle-cross'
	/** Perpendicular / orthogonal relation. */
	| 'right-angle'
	/** Opening edge. */
	| 'bracket'
	/**
	 * Grid fallback: §7's "small cross", drawn as an upright `+`. Never the
	 * diagonal `×` — that mark is the intersection glyph's inner stroke *and*
	 * the refusal mark (spec §6), and one stroke carrying two meanings would
	 * break the non-colour identity rule this table exists to serve.
	 */
	| 'plus'
	/** Neutral mark for a family §7 does not name. */
	| 'dot';

export type PlanSnapGlyph = {
	shape: PlanSnapGlyphShape;
	/** Mark half-size in CSS px. A mark, never a hit target. */
	radiusPx: number;
	/** Short relation word shown with the winner (§6: "glyph + word"). */
	label: string;
	/**
	 * How the shape is drawn, which is a property of the glyph rather than of
	 * the family: `fill` is a closed silhouette (square, disc, triangle) painted
	 * in the snap ink, `stroke` is an open path (bracket, right angle, cross)
	 * that has no area to fill and therefore needs the snap ink *as its stroke*.
	 * Carried here so the presentation picks the ink from the shape — an open
	 * path painted with the fill token renders as a paper-coloured notch in the
	 * Wall band, which is the opposite of a snap being honoured.
	 */
	ink: 'fill' | 'stroke';
};

/**
 * Ratified families (spec §7). Mark sizes are the existing P23.2 scale,
 * deliberately unchanged: §7 ratifies *shapes and words*, not new sizes, and
 * this slice adds the relation identity rather than re-tuning the winner's
 * visual weight. So `snapMarkerRadiusPx` keeps reporting exactly the numbers it
 * reported before, and the shape is what now carries the family.
 */
export const PLAN_SNAP_GLYPHS: Partial<Record<SnapFeatureKind, PlanSnapGlyph>> = {
	junction: { shape: 'square', radiusPx: 5, label: 'Endpoint', ink: 'fill' },
	'wall-intersection': { shape: 'circle-cross', radiusPx: 5, label: 'Intersection', ink: 'fill' },
	'wall-midpoint': { shape: 'triangle', radiusPx: 4, label: 'Midpoint', ink: 'fill' },
	'opening-edge': { shape: 'bracket', radiusPx: 4, label: 'Opening edge', ink: 'stroke' },
	'orthogonal-guide': { shape: 'right-angle', radiusPx: 4, label: 'Right angle', ink: 'stroke' },
	grid: { shape: 'plus', radiusPx: 3, label: 'Grid', ink: 'stroke' }
};

/**
 * Families the resolver honours but spec §7 does not name, so they get the
 * neutral mark and a plain word rather than an invented glyph. Listed rather
 * than implied: closing this gap means either a ratified glyph or removing the
 * family, and both are design calls, not presentation ones.
 */
export const UNRATIFIED_SNAP_FAMILIES: readonly SnapFeatureKind[] = [
	'wall-span',
	'object-bounds-edge',
	'object-bounds-center',
	'extension-guide'
];

const NEUTRAL_GLYPH: PlanSnapGlyph = { shape: 'dot', radiusPx: 4, label: 'Aligned', ink: 'fill' };

/**
 * Every resolver family must be *decided*, not defaulted into. If the resolver
 * gains a family, this becomes a build error until someone either ratifies a
 * glyph or records it as unratified — which is the spec's own rule ("a missing
 * snap family is not added by this proposal") applied to a table instead of to
 * a drawing.
 */
type UndecidedSnapFamily = Exclude<
	SnapFeatureKind,
	keyof typeof PLAN_SNAP_GLYPHS | (typeof UNRATIFIED_SNAP_FAMILIES)[number]
>;
const SNAP_FAMILIES_DECIDED: UndecidedSnapFamily extends never ? true : never = true;
void SNAP_FAMILIES_DECIDED;

/** Plain words for the unratified families (descriptive, never a new relation). */
const UNRATIFIED_LABELS: Partial<Record<SnapFeatureKind, string>> = {
	'wall-span': 'On wall',
	'object-bounds-edge': 'Object edge',
	'object-bounds-center': 'Object center',
	'extension-guide': 'Extension'
};

/**
 * The glyph for one winning family. Always returns something: a winner must be
 * presented, and the neutral mark is the honest presentation for a relation the
 * spec has not ratified.
 */
export function planSnapGlyph(kind: SnapFeatureKind): PlanSnapGlyph {
	const ratified = PLAN_SNAP_GLYPHS[kind];
	if (ratified) return ratified;
	return { ...NEUTRAL_GLYPH, label: UNRATIFIED_LABELS[kind] ?? NEUTRAL_GLYPH.label };
}

/**
 * Spec §7: an explicit numeric value outranks a conflicting snap — the winner
 * marker is removed and the relation is reported as `Exact value` instead. The
 * label is shared so S7's numeric editor and this presentation cannot drift.
 */
export const PLAN_SNAP_EXACT_VALUE_LABEL = 'Exact value';

/**
 * The relation word's typography, mirrored by `.snap-relation-label`. Owned here
 * for the same reason `ROOM_LABEL_TEXT_STYLES` owns the Room stack's: placement
 * needs extents, and a mark cannot be placed against a font it only guesses.
 */
export const PLAN_SNAP_LABEL_TYPOGRAPHY = {
	fontSizePx: 10,
	lineHeightPx: 12,
	weight: 600
} as const;

/** Average advance of the editor UI font at this weight (see the S3 apron). */
const SNAP_LABEL_ADVANCE_RATIO = 0.56;

/**
 * Relation-word extent in CSS px. Deliberately a stand-in rather than a call
 * into the Room label's `TextMeasure` seam: the word is placed against the
 * viewport, not against Room free space, and a 10 px label whose only job is to
 * pick a side does not need font-accurate metrics — it needs a deterministic
 * one. Same trade the S3 apron makes for non-Room text roles.
 */
export function planSnapRelationLabelExtentPx(text: string): { width: number; height: number } {
	return {
		width: text.length * PLAN_SNAP_LABEL_TYPOGRAPHY.fontSizePx * SNAP_LABEL_ADVANCE_RATIO,
		height: PLAN_SNAP_LABEL_TYPOGRAPHY.lineHeightPx
	};
}
