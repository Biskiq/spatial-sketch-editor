/**
 * `layout-wall-heights.ts` — canonical per-Wall height semantics.
 *
 * `LayoutWall.height` is the **authoritative physical height** of that Wall,
 * measured upward from the Floor elevation:
 *
 * ```text
 * bottomY = floor.elevation
 * topY    = floor.elevation + wall.height
 * ```
 *
 * One rule set, consumed by every wall-first surface — the codec's current-format
 * branch, every authoring planner's final gate (through
 * `validateWallFirstLayoutDocument`), the Opening-fit validator and the compiler:
 *
 * ```text
 * Number.isFinite(wall.height) && wall.height > 0
 * ```
 *
 * **No global upper bound** (P23.6I). P23.6H capped a Wall at `floor.height`
 * because the Floor was the storey envelope; P23.6I removed the canonical Floor
 * scalar entirely, so the enclosure is defined by its Walls: a Wall may be shorter
 * or taller than its neighbours, adjacent Rooms may derive different ceilings, and
 * a Room's ceiling is the maximum of its boundary Wall heights. `floor.height` no
 * longer exists in the current schema, so there is nothing to clamp against.
 *
 * Wall height is **not** topology: face extraction reads Junction connectivity +
 * Wall X/Z geometry + `role` only, so a height change never creates, retires,
 * splits or merges Rooms.
 */
import type {
	LayoutDocumentWallFirst,
	LayoutWall
} from './layout-wall-first-types';

/**
 * Shared tolerance for Wall-height comparisons. One epsilon so the codec, the
 * Opening-set validator and the Height planner can never disagree about the
 * boundary case `opening top === wall top`.
 */
export const WALL_HEIGHT_EPSILON = 1e-9;

/**
 * The one Wall-creation default (P23.6I).
 *
 * It is a **creation default only** — not an architectural envelope, not a
 * validation cap, not a Room height, not a Floor height. It is the initial value of
 * a newly authored Wall when neither an explicit height nor a deterministic
 * topology-derived birth height applies, and it is the only Wall-birth `3` literal
 * allowed anywhere in the codebase.
 */
export const WALL_AUTHORING_DEFAULT_HEIGHT = 3;

/** Stable machine code for a Wall-height range violation. */
export type WallHeightIssueCode = 'wall_height_invalid';

export type WallHeightIssue = {
	wallId: string;
	/** Document path of the offending field. */
	path: string;
	code: WallHeightIssueCode;
	message: string;
};

/**
 * Validate one Wall's authoritative height: finite and strictly positive, with no
 * upper bound.
 *
 * `path` is the caller's document path (the codec passes `$.walls[i].height`, the
 * document-level helper below derives it from document order).
 */
export function validateWallHeight(
	wall: Pick<LayoutWall, 'id' | 'height'>,
	path: string
): WallHeightIssue | undefined {
	if (!Number.isFinite(wall.height) || wall.height <= 0) {
		return {
			wallId: wall.id,
			path,
			code: 'wall_height_invalid',
			message: `Wall '${wall.id}' height must be finite and greater than zero`
		};
	}
	return undefined;
}

/**
 * Validate every Wall in document order. Deterministic: issues follow
 * `document.walls` order, one issue per Wall.
 */
export function validateWallFirstWallHeights(
	document: Pick<LayoutDocumentWallFirst, 'walls'>
): WallHeightIssue[] {
	const issues: WallHeightIssue[] = [];
	document.walls.forEach((wall, index) => {
		const issue = validateWallHeight(wall, `$.walls[${index}].height`);
		if (issue) issues.push(issue);
	});
	return issues;
}

/**
 * The unique height among a Junction's incident Walls, or `undefined` when the
 * Junction has no incident Wall or its incident Walls disagree.
 *
 * Deterministic by construction: because it returns a value only when the incident
 * height *set* has exactly one member, document/Wall iteration order cannot change
 * the answer.
 */
export function uniqueIncidentWallHeight(
	document: Pick<LayoutDocumentWallFirst, 'walls'>,
	junctionId: string
): number | undefined {
	const heights = new Set<number>();
	for (const wall of document.walls) {
		if (wall.startJunctionId !== junctionId && wall.endJunctionId !== junctionId) continue;
		heights.add(wall.height);
		if (heights.size > 1) return undefined;
	}
	return heights.size === 1 ? [...heights][0] : undefined;
}

/**
 * Canonical Wall-birth height for the **first segment** of an authoring gesture.
 *
 * This is the durable, document-only rule, so a headless caller and the editor
 * execute the same semantics:
 *
 * ```text
 * explicitHeight                                  → explicitHeight
 * no start Junction (isolated / new start)        → WALL_AUTHORING_DEFAULT_HEIGHT
 * exactly one unique incident Wall height         → that height
 * several distinct incident Wall heights          → WALL_AUTHORING_DEFAULT_HEIGHT
 * zero incident Walls                             → WALL_AUTHORING_DEFAULT_HEIGHT
 * ```
 *
 * A Junction can legitimately carry several incident Walls with different heights;
 * the mixed case deliberately falls back to the named default rather than choosing
 * an arbitrary "incident Wall" (which would make creation depend on topology order
 * or on which Wall happened to be authored first).
 *
 * Continuation *inside one active draw run* is **not** this rule — the editor
 * carries that explicitly as run state and passes it as `explicitHeight`.
 */
export function resolveWallBirthHeight(
	document: Pick<LayoutDocumentWallFirst, 'walls'>,
	startJunctionId: string | null,
	explicitHeight?: number
): number {
	if (explicitHeight !== undefined) return explicitHeight;
	if (startJunctionId === null) return WALL_AUTHORING_DEFAULT_HEIGHT;
	return uniqueIncidentWallHeight(document, startJunctionId) ?? WALL_AUTHORING_DEFAULT_HEIGHT;
}
