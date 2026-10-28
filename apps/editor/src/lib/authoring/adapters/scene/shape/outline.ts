/**
 * T5.P01.S02 — a drawn stroke becomes a native-form outline.
 *
 * This module is session work, not a format: it reads the points a creator
 * named in one working plane and produces the outline anchors `create-form`
 * captures. The only canonical outline is the one the Scene planner stores; a
 * conversion here may use ordinary arithmetic freely.
 *
 * The four Shape kinds are conversions of one gesture, never four tools:
 *
 * - **Line** keeps each named point as a straight anchor.
 * - **Sketch** keeps each named point as a smooth anchor.
 * - **Box** reads the stroke's bounding rectangle.
 * - **Round** reads the stroke's bounding ellipse.
 *
 * Winding is canonicalized before validation because a clockwise drawing is a
 * valid drawing, not a refusal; every remaining issue is reported with the same
 * `validateProfile` code the planner would give, in words a creator can act on.
 */
import {
	PROFILE_LIMITS,
	canonicalizeWinding,
	validateProfile,
	type ProfileAnchor,
	type ProfileIssue
} from '@portfolio/geometry-core';

export type ShapeKind = 'line' | 'box' | 'round' | 'sketch';

export type ShapeOutlineAnchor = {
	readonly u: number;
	readonly v: number;
	readonly smooth: boolean;
};

export type ShapePoint = { readonly u: number; readonly v: number };

export const SHAPE_KINDS: readonly {
	readonly id: ShapeKind;
	readonly label: string;
	readonly summary: string;
}[] = [
	{ id: 'line', label: 'Line', summary: 'Straight edges through the points you name.' },
	{ id: 'box', label: 'Box', summary: 'The rectangle that bounds the stroke.' },
	{ id: 'round', label: 'Round', summary: 'The ellipse that bounds the stroke.' },
	{ id: 'sketch', label: 'Sketch', summary: 'A smooth outline through the points you name.' }
];

/** Minimum edge a conversion may produce, matching the kernel's own control edge. */
export const MIN_SHAPE_EDGE_METERS = PROFILE_LIMITS.minControlEdgeMeters;

/** A round outline needs enough controls for the kernel's curves to read as an ellipse. */
const ROUND_ANCHORS = 16;

export type ShapeOutlineResult =
	| { readonly kind: 'outline'; readonly outline: readonly ShapeOutlineAnchor[] }
	| { readonly kind: 'refused'; readonly message: string; readonly issue: ProfileIssue | null };

/** Winding-canonical anchors, re-keyed in ring order. */
function canonicalOutline(outline: readonly ShapeOutlineAnchor[]): readonly ShapeOutlineAnchor[] {
	return canonicalizeWinding(
		outline.map((anchor, index) => ({
			key: index + 1,
			u: anchor.u,
			v: anchor.v,
			smooth: anchor.smooth
		}))
	).map((anchor) => ({ u: anchor.u, v: anchor.v, smooth: anchor.smooth }));
}

/** One typed outline validation answer, ready for the palette. */
export function validateShapeOutline(
	outline: readonly ShapeOutlineAnchor[]
): { readonly kind: 'valid' } | { readonly kind: 'refused'; readonly message: string; readonly issue: ProfileIssue } {
	const issues = validateProfile(
		outline.map((anchor, index) => ({
			key: index + 1,
			u: anchor.u,
			v: anchor.v,
			smooth: anchor.smooth
		}))
	);
	if (issues.length === 0) return { kind: 'valid' };
	const issue = issues[0]!;
	return { kind: 'refused', message: outlineIssueWords(issue), issue };
}

/** Convert named plane points into one outline, or refuse in words. */
export function shapeOutline(
	kind: ShapeKind,
	points: readonly ShapePoint[]
): ShapeOutlineResult {
	const unique = dedupe(points);
	if (kind === 'box' || kind === 'round') {
		if (unique.length < 2) {
			return {
				kind: 'refused',
				message: `${kind === 'box' ? 'Box' : 'Round'} needs two points; click opposite corners or draw a stroke.`,
				issue: null
			};
		}
		return boundsOutline(kind, unique);
	}
	if (unique.length < PROFILE_LIMITS.minAnchors) {
		return {
			kind: 'refused',
			message: `An outline needs at least ${PROFILE_LIMITS.minAnchors} points; name ${PROFILE_LIMITS.minAnchors - unique.length} more.`,
			issue: null
		};
	}
	if (unique.length > PROFILE_LIMITS.maxAnchors) {
		return {
			kind: 'refused',
			message: `An outline can hold at most ${PROFILE_LIMITS.maxAnchors} points.`,
			issue: null
		};
	}
	const outline = unique.map((point) => ({
		u: point.u,
		v: point.v,
		smooth: kind === 'sketch'
	}));
	return validateConverted(outline);
}

function boundsOutline(kind: 'box' | 'round', points: readonly ShapePoint[]): ShapeOutlineResult {
	let minU = Infinity;
	let maxU = -Infinity;
	let minV = Infinity;
	let maxV = -Infinity;
	for (const point of points) {
		if (point.u < minU) minU = point.u;
		if (point.u > maxU) maxU = point.u;
		if (point.v < minV) minV = point.v;
		if (point.v > maxV) maxV = point.v;
	}
	const width = maxU - minU;
	const height = maxV - minV;
	if (width < MIN_SHAPE_EDGE_METERS || height < MIN_SHAPE_EDGE_METERS) {
		return {
			kind: 'refused',
			message: `${kind === 'box' ? 'A Box' : 'A Round'} needs at least ${MIN_SHAPE_EDGE_METERS * 1000} mm in both directions.`,
			issue: null
		};
	}
	if (kind === 'box') {
		return validateConverted([
			{ u: minU, v: minV, smooth: false },
			{ u: maxU, v: minV, smooth: false },
			{ u: maxU, v: maxV, smooth: false },
			{ u: minU, v: maxV, smooth: false }
		]);
	}
	const centreU = (minU + maxU) / 2;
	const centreV = (minV + maxV) / 2;
	const radiusU = width / 2;
	const radiusV = height / 2;
	const outline: ShapeOutlineAnchor[] = [];
	for (let index = 0; index < ROUND_ANCHORS; index += 1) {
		const angle = (Math.PI * 2 * index) / ROUND_ANCHORS;
		outline.push({
			u: centreU + Math.cos(angle) * radiusU,
			v: centreV + Math.sin(angle) * radiusV,
			smooth: true
		});
	}
	return validateConverted(outline);
}

function validateConverted(
	outline: readonly ShapeOutlineAnchor[]
): ShapeOutlineResult {
	// The returned outline is canonical, not the drawn order: a clockwise stroke
	// is a valid drawing, and every later session read (bounds, depth, preview)
	// must see the same counter-clockwise profile the planner will store.
	const canonical = canonicalOutline(outline);
	const validated = validateShapeOutline(canonical);
	return validated.kind === 'valid'
		? { kind: 'outline', outline: canonical }
		: { kind: 'refused', message: validated.message, issue: validated.issue };
}

/** Drop consecutive duplicates and a repeated closing point, inside 1 mm. */
function dedupe(points: readonly ShapePoint[]): readonly ShapePoint[] {
	const result: ShapePoint[] = [];
	for (const point of points) {
		if (!Number.isFinite(point.u) || !Number.isFinite(point.v)) continue;
		const previous = result[result.length - 1];
		if (
			previous !== undefined &&
			Math.hypot(point.u - previous.u, point.v - previous.v) < MIN_SHAPE_EDGE_METERS
		) {
			continue;
		}
		result.push({ u: point.u, v: point.v });
	}
	if (result.length > 1) {
		const first = result[0]!;
		const last = result[result.length - 1]!;
		if (Math.hypot(last.u - first.u, last.v - first.v) < MIN_SHAPE_EDGE_METERS) result.pop();
	}
	return result;
}

/** The creator-facing words for one kernel issue. */
export function outlineIssueWords(issue: ProfileIssue): string {
	switch (issue.code) {
		case 'too-few-anchors':
			return `An outline needs at least ${PROFILE_LIMITS.minAnchors} anchors.`;
		case 'too-many-anchors':
			return `An outline can hold at most ${PROFILE_LIMITS.maxAnchors} anchors.`;
		case 'non-finite':
			return 'The outline has a point that is not a finite coordinate.';
		case 'out-of-range':
			return `Every outline coordinate must sit within ±${PROFILE_LIMITS.maxCoordinateMeters} m of the sheet origin.`;
		case 'duplicate-key':
			return 'Two outline anchors share a key.';
		case 'edge-too-short':
			return `Two outline points are closer than ${MIN_SHAPE_EDGE_METERS * 1000} mm.`;
		case 'collinear':
			return 'Three outline points lie on one line; move one of them.';
		case 'self-intersecting':
			return 'The outline crosses itself; redraw it without crossing.';
		case 'clockwise':
			return 'The outline is wound the wrong way; redraw it in the other direction.';
	}
}

/**
 * Mirror an outline across the profile plane's local Y axis.
 *
 * `Flip side` on an upright outline keeps the drawn profile where it is and
 * turns the extrusion to the other side of the sheet: the frame yaw rotates by
 * π and local U is mirrored, so every world point is unchanged while local +Z
 * (the extrusion) points the other way. Winding is canonicalized again by the
 * planner after this, so the mirror needs no order surgery here.
 */
export function flipUprightOutline(
	outline: readonly ShapeOutlineAnchor[]
): readonly ShapeOutlineAnchor[] {
	return outline.map((anchor) => ({ ...anchor, u: -anchor.u }));
}
