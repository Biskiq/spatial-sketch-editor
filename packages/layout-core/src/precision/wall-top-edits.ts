/**
 * `planSetWallTop` — the one Wall-top writer.
 *
 * A caller states a shape and its rises; the planner normalises it to P1 by
 * moving the lowest end rise into `height`, so `height` stays the lowest point of
 * the top and each shape keeps one encoding. The planner owns nothing else: the
 * canonical codec and compiler remain the authorities for the source rules, the
 * derived-length rule and the Opening fit.
 *
 * Refusals are atomic and named:
 * - P2/P3 values (`wall_top_rise_invalid`, `wall_top_apex_invalid`);
 * - P3's derived apex station (`wall_top_apex_outside`, naming the Wall);
 * - P5's closed-Wall level rule (`closed_wall_level_only`, naming the Wall);
 * - P6's envelope (`dimension_out_of_range`, naming the Wall);
 * - P7's Opening fit (`wall_top_below_opening`, naming the Opening and Wall).
 *
 * A caller may also state the requested eave in the same intent. Direct
 * manipulation uses that to move one breakpoint while keeping every breakpoint
 * that did not move exactly where it was; the requested eave is normalised with
 * the profile (P1) and the candidate is validated as one Wall, Openings included.
 * The Card's Height edit (`planExactWallHeight`) remains the rigid shift of this
 * top and keeps its existing signature; it does not pass through here.
 */
import { ensureLayoutWorldIndex } from '../world/lookups';
import { LAYOUT_DIMENSION_LIMIT_MESSAGE, exceedsLayoutDimension } from '../geometry/limits';
import type { LayoutDocumentWallFirst, LayoutWall, LayoutWallTop } from '../wall/types';
import {
	WALL_TOP_APEX_INVALID_CODE,
	WALL_TOP_APEX_OUTSIDE_CODE,
	WALL_TOP_RISE_INVALID_CODE,
	CLOSED_WALL_LEVEL_ONLY_CODE,
	normalizeWallTop,
	wallTopIssues,
} from '../wall/wall-top';
import { wallFirstWallLength, validateWallFirstOpeningSet } from '../wall/opening-set';
import type { PrecisionPlan, PrecisionRejection } from './types';
import { finalizeCandidate } from './finalization';
import { finitePositive, reject } from './rejections';

/** The first value-layer problem with an intent, if any. */
function topValueIssue(
	top: LayoutWallTop,
): 'wall_top_rise_invalid' | 'wall_top_apex_invalid' | null {
	if (top.kind === 'level') return null;
	if (
		!Number.isFinite(top.startRise) ||
		!Number.isFinite(top.endRise) ||
		top.startRise < 0 ||
		top.endRise < 0
	)
		return 'wall_top_rise_invalid';
	if (top.kind === 'slope') return null;
	return !Number.isFinite(top.apexRise) || top.apexRise < 0 || !Number.isFinite(top.apexOffset)
		? 'wall_top_apex_invalid'
		: null;
}

/** The precision code that carries one Wall-top issue. */
function rejectionCode(issueCode: string): PrecisionRejection['code'] {
	switch (issueCode) {
		case WALL_TOP_RISE_INVALID_CODE:
			return 'wall_top_rise_invalid';
		case WALL_TOP_APEX_INVALID_CODE:
			return 'wall_top_apex_invalid';
		case WALL_TOP_APEX_OUTSIDE_CODE:
			return 'wall_top_apex_outside';
		case CLOSED_WALL_LEVEL_ONLY_CODE:
			return 'closed_wall_level_only';
		case 'dimension_out_of_range':
			return 'dimension_out_of_range';
		default:
			return 'geometry_invalid';
	}
}

function sameTop(first: LayoutWallTop, second: LayoutWallTop): boolean {
	if (first.kind !== second.kind) return false;
	if (first.kind === 'level') return true;
	if (first.kind === 'slope') {
		return (
			second.kind === 'slope' &&
			first.startRise === second.startRise &&
			first.endRise === second.endRise
		);
	}
	return (
		second.kind === 'gable' &&
		first.startRise === second.startRise &&
		first.endRise === second.endRise &&
		first.apexRise === second.apexRise &&
		first.apexOffset === second.apexOffset
	);
}

/**
 * Set one Wall's authored top, normalising it to P1.
 *
 * The intent may state both ends above the eave (rises measured from a
 * neighbour); the lowest rise moves into `height`. A direct-manipulation intent
 * also states the requested eave; the rises are measured from that, so every
 * breakpoint the caller did not move keeps its absolute top. A `level` intent
 * flattens the top at the requested eave (or the current one).
 *
 * The candidate Wall and all of its Openings are validated together before the
 * plan is returned.
 */
export function planSetWallTop(
	document: LayoutDocumentWallFirst,
	wallId: string,
	top: LayoutWallTop,
	/** The requested eave above the floor; absent keeps the Wall's current one. */
	height?: number,
): PrecisionPlan {
	const worldIndex = ensureLayoutWorldIndex(document);
	const wall: LayoutWall | undefined = worldIndex
		? worldIndex.wallById.get(wallId)
		: document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) return reject('unknown_wall', `Unknown wall '${wallId}'`, [wallId]);
	const valueIssue = topValueIssue(top);
	if (valueIssue !== null) {
		return reject(valueIssue, `Wall '${wallId}' top values must be finite and non-negative`, [
			wallId,
		]);
	}
	if (height !== undefined && !finitePositive(height)) {
		return reject('invalid_value', 'Wall height must be finite and greater than zero', [wallId]);
	}
	if (height !== undefined && exceedsLayoutDimension(height)) {
		return reject('dimension_out_of_range', LAYOUT_DIMENSION_LIMIT_MESSAGE, [wallId]);
	}

	const normalized = normalizeWallTop(height ?? wall.height, top);
	const candidate: LayoutDocumentWallFirst = {
		...document,
		walls: document.walls.map((candidateWall) =>
			candidateWall.id === wallId
				? { ...candidateWall, height: normalized.height, top: normalized.top }
				: candidateWall,
		),
	};
	if (wall.height === normalized.height && sameTop(wall.top, normalized.top)) {
		return reject('no_op', `Wall '${wallId}' already has that top`, [wallId]);
	}

	const length = wallFirstWallLength(candidate, wallId);
	if (length === undefined) {
		return reject('unsupported_geometry', `Wall '${wallId}' has no resolvable span`, [wallId]);
	}
	const issues = wallTopIssues({ ...wall, height: normalized.height, top: normalized.top }, length);
	if (issues.length > 0) {
		const first = issues[0]!;
		return reject(rejectionCode(first.code), first.message, [wallId]);
	}

	const openingIssues = validateWallFirstOpeningSet(candidate);
	if (openingIssues.length > 0) {
		const first = openingIssues[0]!;
		return reject('wall_top_below_opening', first.message, [first.openingId, first.wallId]);
	}

	return finalizeCandidate(candidate, 'wall-top', [], [wallId]);
}
