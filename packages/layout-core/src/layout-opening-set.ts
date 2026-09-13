/**
 * `layout-opening-set.ts` — canonical wall-first Opening-set validator (P23.3).
 *
 * ONE validator owns whole-hosting-Wall opening fit for the wall-first schema,
 * consumed by both the P23.1 precise wall-edit gates and the P23.3 opening
 * create/edit/drag/resize path:
 *
 * ```text
 * canonical opening-set validator
 *         ↑
 * P23.1 wall edits
 * P23.3 opening create/edit/drag/resize
 * ```
 *
 * Scope: the hosting-geometry semantics the wall-first codec cannot see —
 * host Wall resolvability, interval fit against the canonical Wall length,
 * vertical fit against the **hosting Wall's authoritative height** (P23.6H),
 * same-Wall interval overlap, and profile/width/height compatibility. Field
 * shape (finite/non-negative/positive numbers, enum values), reference
 * existence, and door-only portal relations stay the codec's job; nothing here
 * is re-implemented twice.
 *
 * **No clamping.** This validator never repairs a candidate: an out-of-fit
 * interval, overlap, or vertical mismatch is an issue the caller must reject.
 * A clamped offset may never be laundered into validity through this module.
 */
import {
	buildArchProfile,
	LAYOUT_GEOMETRY_EPSILON
} from './layout-geometry-openings';
import type {
	LayoutDocumentWallFirst,
	LayoutWall,
	LayoutWallOpening
} from './layout-wall-first-types';
import type { LayoutVec2 } from './layout-types';

/** Fit tolerance shared with the P23.1 precision gates (unchanged semantics). */
export const OPENING_SET_EPSILON = LAYOUT_GEOMETRY_EPSILON;

export type OpeningSetIssueCode =
	| 'opening_host_wall_unresolved'
	| 'opening_offset_invalid'
	| 'opening_dimensions_invalid'
	| 'opening_exceeds_wall'
	/**
	 * P23.6H — the Opening's vertical extent exceeds its **hosting Wall's**
	 * authoritative `height`. Renamed from `opening_exceeds_floor_height`: the
	 * Floor envelope bounds Wall height, not Opening-top directly.
	 */
	| 'opening_exceeds_wall_height'
	| 'opening_overlap'
	| 'opening_profile_invalid';

export type OpeningSetIssue = {
	openingId: string;
	wallId: string;
	/** Document path of the offending record/field. */
	path: string;
	code: OpeningSetIssueCode;
	message: string;
};

/** Canonical straight Wall span in document X/Z space (meters). */
export function wallFirstWallSpan(
	document: LayoutDocumentWallFirst,
	wall: LayoutWall
): { start: LayoutVec2; end: LayoutVec2; length: number } | undefined {
	const start = document.junctions.find(
		(junction) => junction.id === wall.startJunctionId
	)?.point;
	const end = document.junctions.find(
		(junction) => junction.id === wall.endJunctionId
	)?.point;
	if (!start || !end) return undefined;
	return { start, end, length: Math.hypot(end[0] - start[0], end[1] - start[1]) };
}

/** Canonical Wall length in meters, or `undefined` when the span is unresolved. */
export function wallFirstWallLength(
	document: LayoutDocumentWallFirst,
	wallId: string
): number | undefined {
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) return undefined;
	return wallFirstWallSpan(document, wall)?.length;
}

/**
 * Validate every authored Opening in the document against its hosting Wall
 * set. Returns all issues in deterministic document order (opening order for
 * per-opening fit, then Wall groups in first-appearance order for overlap).
 */
export function validateWallFirstOpeningSet(
	document: LayoutDocumentWallFirst
): OpeningSetIssue[] {
	const issues: OpeningSetIssue[] = [];
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
	const openingsByWall = new Map<string, LayoutWallOpening[]>();

	document.openings.forEach((opening, index) => {
		const path = `$.openings[${index}]`;
		const wall = wallById.get(opening.wallId);
		const span = wall ? wallFirstWallSpan(document, wall) : undefined;
		if (!wall || !span || !(span.length > OPENING_SET_EPSILON)) {
			issues.push({
				openingId: opening.id,
				wallId: opening.wallId,
				path: `${path}.wallId`,
				code: 'opening_host_wall_unresolved',
				message: `Opening '${opening.id}' must be hosted by a Wall with a resolved non-zero span`
			});
			return;
		}
		if (!Number.isFinite(opening.offset) || opening.offset < 0) {
			issues.push({
				openingId: opening.id,
				wallId: opening.wallId,
				path: `${path}.offset`,
				code: 'opening_offset_invalid',
				message: `Opening '${opening.id}' offset must be finite and non-negative`
			});
		}
		if (
			!Number.isFinite(opening.width) ||
			opening.width <= 0 ||
			!Number.isFinite(opening.height) ||
			opening.height <= 0 ||
			!Number.isFinite(opening.sillHeight) ||
			opening.sillHeight < 0
		) {
			issues.push({
				openingId: opening.id,
				wallId: opening.wallId,
				path,
				code: 'opening_dimensions_invalid',
				message: `Opening '${opening.id}' must have a finite positive width/height and a finite non-negative sill`
			});
		}
		if (opening.offset + opening.width > span.length + OPENING_SET_EPSILON) {
			issues.push({
				openingId: opening.id,
				wallId: opening.wallId,
				path,
				code: 'opening_exceeds_wall',
				message: `Opening '${opening.id}' does not fit on Wall '${opening.wallId}'`
			});
		}
		// P23.6H — vertical fit is measured against the hosting Wall, not the
		// Floor: a partial-height Wall legitimately caps its own Openings while a
		// full-height Wall keeps the historical Floor-envelope behavior.
		if (
			opening.sillHeight + opening.height >
			wall.height + OPENING_SET_EPSILON
		) {
			issues.push({
				openingId: opening.id,
				wallId: opening.wallId,
				path,
				code: 'opening_exceeds_wall_height',
				message: `Opening '${opening.id}' (sill ${opening.sillHeight} m + height ${opening.height} m) does not fit Wall '${wall.id}' height ${wall.height} m`
			});
		}
		const profileResult = buildArchProfile(
			opening.profile,
			opening.width,
			opening.height
		);
		for (const profileIssue of profileResult.issues) {
			issues.push({
				openingId: opening.id,
				wallId: opening.wallId,
				path: `${path}.profile`,
				code: 'opening_profile_invalid',
				message: `Opening '${opening.id}' ${profileIssue.message}`
			});
		}
		const group = openingsByWall.get(opening.wallId) ?? [];
		group.push(opening);
		openingsByWall.set(opening.wallId, group);
	});

	// Same-Wall interval overlap over the complete hosting-Wall set (never the
	// edited record in isolation), stable sort by offset then ID.
	for (const [wallId, openings] of openingsByWall) {
		const sorted = [...openings].sort(
			(a, b) => a.offset - b.offset || a.id.localeCompare(b.id)
		);
		for (let index = 1; index < sorted.length; index += 1) {
			const previous = sorted[index - 1]!;
			const current = sorted[index]!;
			if (current.offset < previous.offset + previous.width - OPENING_SET_EPSILON) {
				issues.push({
					openingId: current.id,
					wallId,
					path: `$.openings`,
					code: 'opening_overlap',
					message: `Openings '${previous.id}' and '${current.id}' overlap on Wall '${wallId}'`
				});
			}
		}
	}

	return issues;
}

/** Convenience predicate: does the hosting-Wall opening set validate cleanly? */
export function wallFirstOpeningSetIsValid(
	document: LayoutDocumentWallFirst
): boolean {
	return validateWallFirstOpeningSet(document).length === 0;
}
