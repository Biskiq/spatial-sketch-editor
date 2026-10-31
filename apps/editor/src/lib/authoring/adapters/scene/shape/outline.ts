/**
 * R217.S17A — a drawn gesture becomes a native-form outline.
 *
 * This module is session work, not a format: it reads points on the horizontal
 * X/Z plane and produces the outline anchors `create-form` captures. The only
 * canonical outline is the one the Scene planner stores; a conversion here may use
 * ordinary arithmetic freely.
 *
 * - **Box** and **Round** read the rectangle two corners span, or a standard size
 *   around one point. A click and a drag therefore make the same kind of object.
 * - **Free** keeps clicked corners sharp and drawn runs smooth.
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

export type ShapeKind = 'box' | 'round' | 'free';

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
	{ id: 'box', label: 'Box', summary: 'Click for a 1 m box, or drag corner to corner.' },
	{ id: 'round', label: 'Round', summary: 'Click for a 1 m round, or drag corner to corner.' },
	{ id: 'free', label: 'Free', summary: 'Click corners or drag curves, then close on the start.' }
];

/** The size one click creates: the same native form a drag of this size would. */
export const STANDARD_SHAPE_METERS = 1;

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

/** The outline two opposite corners span. */
export function shapeOutline(
	kind: 'box' | 'round',
	first: ShapePoint,
	second: ShapePoint
): ShapeOutlineResult {
	return boundsOutline(kind, [first, second]);
}

/** The standard outline one click creates, centred on the point. */
export function standardOutline(kind: 'box' | 'round', centre: ShapePoint): ShapeOutlineResult {
	const half = STANDARD_SHAPE_METERS / 2;
	return boundsOutline(kind, [
		{ u: centre.u - half, v: centre.v - half },
		{ u: centre.u + half, v: centre.v + half }
	]);
}

function exactlyCollinear(a: ShapePoint, b: ShapePoint, c: ShapePoint): boolean {
	return Math.abs((b.u - a.u) * (c.v - a.v) - (b.v - a.v) * (c.u - a.u)) < 1e-12;
}

/** Distance from a point to the segment between two others. */
function segmentDistance(point: ShapePoint, a: ShapePoint, b: ShapePoint): number {
	const du = b.u - a.u;
	const dv = b.v - a.v;
	const span = du * du + dv * dv;
	const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((point.u - a.u) * du + (point.v - a.v) * dv) / span));
	return Math.hypot(point.u - a.u - du * t, point.v - a.v - dv * t);
}

/** Douglas–Peucker over one drawn run; both ends always stay. */
function simplifyRun(
	run: readonly ShapeOutlineAnchor[],
	toleranceMeters: number
): readonly ShapeOutlineAnchor[] {
	if (run.length < 3) return run;
	let farthest = 0;
	let index = -1;
	for (let at = 1; at < run.length - 1; at += 1) {
		const distance = segmentDistance(run[at]!, run[0]!, run[run.length - 1]!);
		if (distance > farthest) {
			farthest = distance;
			index = at;
		}
	}
	if (index === -1 || farthest <= toleranceMeters) return [run[0]!, run[run.length - 1]!];
	return [
		...simplifyRun(run.slice(0, index + 1), toleranceMeters).slice(0, -1),
		...simplifyRun(run.slice(index), toleranceMeters)
	];
}

/**
 * One Free outline from clicked corners and drawn runs.
 *
 * Snapped clicks often land three corners on one grid line, which the kernel
 * refuses as collinear though the creator meant one straight edge. Those exact
 * middle corners are dropped, across the ring seam too. A drawn run is simplified
 * at the caller's tolerance, doubling until it fits under the kernel's anchor cap.
 */
export function freeOutline(
	runs: readonly (readonly ShapeOutlineAnchor[])[],
	toleranceMeters: number
): ShapeOutlineResult {
	let tolerance = toleranceMeters;
	for (let attempt = 0; attempt < 24; attempt += 1) {
		const anchors = freeAnchors(runs, tolerance);
		if (anchors.length <= PROFILE_LIMITS.maxAnchors) {
			if (anchors.length < PROFILE_LIMITS.minAnchors) {
				return {
					kind: 'refused',
					message: `An outline needs at least ${PROFILE_LIMITS.minAnchors} points off one line.`,
					issue: null
				};
			}
			return validateConverted(anchors);
		}
		tolerance *= 2;
	}
	return {
		kind: 'refused',
		message: `An outline can hold at most ${PROFILE_LIMITS.maxAnchors} points.`,
		issue: null
	};
}

function freeAnchors(
	runs: readonly (readonly ShapeOutlineAnchor[])[],
	toleranceMeters: number
): readonly ShapeOutlineAnchor[] {
	const joined: ShapeOutlineAnchor[] = [];
	for (const run of runs) {
		for (const anchor of simplifyRun(run, toleranceMeters)) {
			if (!Number.isFinite(anchor.u) || !Number.isFinite(anchor.v)) continue;
			const previous = joined[joined.length - 1];
			if (previous !== undefined && Math.hypot(anchor.u - previous.u, anchor.v - previous.v) < MIN_SHAPE_EDGE_METERS) continue;
			joined.push(anchor);
		}
	}
	while (joined.length > 1) {
		const first = joined[0]!;
		const last = joined[joined.length - 1]!;
		if (Math.hypot(last.u - first.u, last.v - first.v) >= MIN_SHAPE_EDGE_METERS) break;
		joined.pop();
	}
	let kept: readonly ShapeOutlineAnchor[] = joined;
	let changed = true;
	while (changed && kept.length > 2) {
		changed = false;
		for (let index = 0; index < kept.length; index += 1) {
			const anchor = kept[index]!;
			if (anchor.smooth) continue;
			const before = kept[(index + kept.length - 1) % kept.length]!;
			const after = kept[(index + 1) % kept.length]!;
			if (exactlyCollinear(before, anchor, after)) {
				kept = kept.filter((_, at) => at !== index);
				changed = true;
				break;
			}
		}
	}
	return kept;
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
	// is a valid drawing, and every later session read (bounds, preview)
	// must see the same counter-clockwise profile the planner will store.
	const canonical = canonicalOutline(outline);
	const validated = validateShapeOutline(canonical);
	return validated.kind === 'valid'
		? { kind: 'outline', outline: canonical }
		: { kind: 'refused', message: validated.message, issue: validated.issue };
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
