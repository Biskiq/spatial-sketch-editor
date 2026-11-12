/**
 * R217.S15 — the Wall planner's refusals in human words.
 *
 * The planner's own message names ids and operation codes; those are diagnostics,
 * not something a creator should read on the Stage or in the Card. This map
 * covers the Wall operations this slice exposes and falls back to one neutral
 * sentence for a future code, so a raw message can never leak through an
 * unhandled branch. Both surfaces import this one map: the Stage's tag and the
 * Card's field error must say the same thing.
 */
import {
	LAYOUT_DIMENSION_LIMIT_MESSAGE,
	wallFirstWallLength,
	type LayoutDocumentWallFirst,
	type LayoutWallOpening,
	type WallOpeningRejection
} from '@portfolio/layout-core';

export function wallRefusalWords(code: string, message = ''): string {
	switch (code) {
		case 'dimension_out_of_range':
			return LAYOUT_DIMENSION_LIMIT_MESSAGE;
		case 'opening_exceeds_wall':
		case 'opening_out_of_bounds':
		case 'opening_overlap':
		case 'opening_exceeds_wall_height':
		case 'opening_height_invalid':
		case 'opening_width_invalid':
		case 'opening_offset_invalid':
		case 'opening_sill_invalid':
		case 'opening_profile_invalid':
		case 'opening_segment_invalid':
		case 'opening_host_wall_unresolved':
		case 'opening_set_invalid':
		case 'opening_over_height':
		case 'wall_height_below_opening':
		case 'opening_dimensions_invalid':
		case 'arch_profile_width_invalid':
		case 'arch_profile_height_invalid':
			return 'An Opening would no longer fit this Wall.';
		case 'duplicate_junction_point':
		case 'duplicate_joined_wall':
		case 'junction_point_mismatch':
		case 'unconnected_interior_contact':
		case 'unconnected_crossing':
		case 'collinear_overlap':
		case 'self_intersection':
		case 'self_intersecting_chain':
		case 'noding_rejected':
		case 'incompatible_wall_pair':
		case 'topology_invalid':
			return 'This would cross or meet another Wall.';
		case 'geometry_invalid':
			return /offset folds|self-intersect/i.test(message)
				? "This bend is too tight for the Wall's thickness. Pull it further out or reduce the thickness."
				: 'This shape is not a valid Wall layout.';
		case 'split_at_existing_endpoint':
			return "Bend between the Wall's endpoints, not on one.";
		case 'split_distance_out_of_range':
			return 'Bend somewhere along the open Wall.';
		case 'split_through_opening_interior':
			return 'A bend cannot pass through an Opening.';
		case 'curve_knot_limit':
			return 'This Wall already has the most bend points it supports. Remove one first.';
		case 'unknown_curve_anchor':
			return 'That bend point is gone. Start the bend again.';
		case 'closed_wall_not_bendable':
		case 'closed_wall_isolated':
			return 'A circular Wall is resized by its radius; it cannot be bent.';
		case 'invalid_endpoint':
		case 'invalid_reference':
			return 'This shape is not a valid Wall layout.';
		case 'room_identity_lost':
		case 'room_reconciliation_rejected':
		case 'correspondence_failure':
			return 'This would move a Room across its own boundary. Keep the corner on the Room side.';
		case 'ambiguous_room_correspondence':
		case 'ambiguous_room_removal':
			return 'This would make it unclear which Room boundary moved. Move one boundary at a time.';
		case 'nonadjacent_portal_relation':
		case 'portal_relation_invalid':
			return 'This would break the connection between Rooms.';
		case 'zero_length_wall':
		case 'zero_length_segment':
		case 'zero_length_leg':
			return 'A Wall cannot be zero length.';
		case 'no_op':
			return "That is already the Wall's position.";
		case 'unsupported_wall_topology':
		case 'invalid_candidate_document':
		case 'candidate_does_not_compile':
		case 'junction_degree_not_two':
		case 'curved_wall_unsupported':
		case 'unsupported_geometry':
			return 'This shape is not a valid Wall layout.';
		case 'invalid_value':
		case 'invalid_point':
		case 'non_finite_point':
		case 'non_finite_endpoint':
		case 'unknown_wall':
		case 'unknown_junction':
			return 'The Wall cannot be placed there.';
		default:
			// A future Room gate must not fall back to the opaque generic line. The
			// planner's diagnostic is internal, but its subject is safe to name.
			return /room/i.test(message)
				? 'This would change a Room boundary. Keep the moved Wall on the Room side.'
				: 'This change cannot be applied.';
	}
}

/**
 * T1 A1 — the split's own words.
 *
 * A split is not a bend: sharing `closed_wall_isolated`'s bend wording would
 * offer Radius for a Wall the creator is trying to divide. These two refusals
 * are the slice's promised clear feedback; everything else falls back to the
 * shared Wall map.
 */
export function wallSplitRefusalWords(code: string, message = ''): string {
	switch (code) {
		case 'split_through_opening_interior':
			return 'A split cannot pass through an Opening. Choose a clear point on the Wall.';
		case 'closed_wall_isolated':
			return 'A circular Wall is one closed loop and cannot be split. Change its Radius instead.';
		case 'split_at_existing_endpoint':
			return "Choose a point between the Wall's ends.";
		case 'split_distance_out_of_range':
			return 'Choose a point along the open Wall.';
		default:
			return wallRefusalWords(code, message);
	}
}

/** The attempted metrics an Opening refusal may quote. */
export type OpeningRefusalAttempt = {
	readonly openingId?: string;
	readonly wallId?: string;
	readonly kind?: LayoutWallOpening['kind'];
	readonly offset?: number;
	readonly width?: number;
	readonly height?: number;
	readonly sillHeight?: number;
};

function kindWords(kind: LayoutWallOpening['kind']): string {
	return kind === 'door' ? 'door' : 'window';
}

function meters(value: number): string {
	return `${value.toFixed(2)} m`;
}

/**
 * The creator-facing refusal and repair for one rejected Opening operation.
 *
 * Composed from the canonical rejection (code, target ids and the planner's own
 * issue) plus the exact attempted metrics; it never re-derives whether the
 * Opening fits. Preview, palette and acceptance all call this, so the words the
 * creator reads before the gesture are the words acceptance would return.
 */
export function openingRefusalWords(
	document: LayoutDocumentWallFirst,
	rejection: WallOpeningRejection,
	attempt: OpeningRefusalAttempt = {}
): string {
	const wallId = attempt.wallId ?? rejection.targetIds?.[0];
	const wall = wallId === undefined ? undefined : document.walls.find((entry) => entry.id === wallId);
	const length = wallId === undefined ? undefined : wallFirstWallLength(document, wallId);
	const kind = attempt.kind === undefined ? 'Opening' : kindWords(attempt.kind);
	const issue = rejection.issues?.[0]?.code;
	if (rejection.code === 'dimension_out_of_range') return LAYOUT_DIMENSION_LIMIT_MESSAGE;

	if (attempt.offset !== undefined && attempt.offset < 0) {
		return `This ${kind} would start before the Wall. Move it onto the Wall.`;
	}
	if (rejection.code === 'unknown_wall') return 'That Wall is gone. Aim at a Wall that is still there.';
	if (rejection.code === 'unknown_opening') return 'That Opening is gone. Select its Wall and try again.';
	if (rejection.code === 'no_op') return 'That Opening already has those values.';
	if (rejection.code === 'captured_id_in_use') return 'That identity is already taken. Start again.';
	if (issue === 'opening_exceeds_wall') {
		if (length !== undefined && attempt.offset !== undefined && attempt.width !== undefined) {
			const overrun = attempt.offset + attempt.width - length;
			return `This ${kind} would end ${meters(overrun)} past the end of the ${meters(length)} Wall. Move it ${meters(overrun)} earlier or narrow it.`;
		}
		return `This ${kind} does not fit its Wall. Move it earlier or narrow it.`;
	}
	if (issue === 'opening_exceeds_wall_height') {
		return wall !== undefined && attempt.height !== undefined && attempt.sillHeight !== undefined
			? `This ${meters(attempt.height)} ${kind} with a ${meters(attempt.sillHeight)} sill exceeds the ${meters(wall.height)} Wall. Shorten it or raise the Wall.`
			: `This ${kind} is taller than its Wall. Shorten it or raise the Wall.`;
	}
	if (issue === 'opening_overlap') return `This ${kind} overlaps another Opening. Aim clear or narrow it.`;
	if (issue === 'opening_host_wall_unresolved') return 'That Wall has no resolvable span. Repair it or pick another Wall.';
	if (rejection.code === 'invalid_value') return 'Check the Offset and size: offset and sill non-negative, width and height positive.';
	if (rejection.code === 'candidate_does_not_compile' || rejection.code === 'invalid_candidate_document') {
		return `That Wall cannot carry this ${kind}. Pick another Wall or adjust its size.`;
	}
	return `That ${kind} was refused. Adjust its host or size and try again.`;
}

/** The one coincident-copy refusal sentence: preview, pointer and acceptance share it. */
export const ROOM_DUPLICATE_COINCIDENT_MESSAGE =
	'Move the copy clear of its source before placing it.';

/** The planner/refusal shape the Room duplicate seam accepts. */
export type RoomDuplicateRejection = {
	readonly code: string;
	readonly message?: string;
	readonly targetIds?: readonly string[];
};

/**
 * T1 A4 — duplicate's own words.
 *
 * The planner's diagnostic names ids. The creator needs the same facts in the
 * Room's vocabulary, and a non-isolated Room must **name the shared Wall** rather
 * than ask them to read a planner message. `targetIds` carries the involved
 * Rooms and Walls; every id that resolves to a Wall is named here, with its
 * authored name when it has one.
 */
export function roomDuplicateRefusalWords(
	document: LayoutDocumentWallFirst,
	rejection: RoomDuplicateRejection
): string {
	switch (rejection.code) {
		case 'coincident_with_source':
			return ROOM_DUPLICATE_COINCIDENT_MESSAGE;
		case 'room_not_isolated': {
			const walls = (rejection.targetIds ?? [])
				.map((id) => document.walls.find((wall) => wall.id === id))
				.filter((wall): wall is LayoutDocumentWallFirst['walls'][number] => wall !== undefined)
				.map((wall) => wall.name ?? wall.id);
			if (walls.length > 0) {
				const named = walls.map((wall) => `"${wall}"`).join(', ');
				return `This Room is not isolated: Wall ${named} is shared with other architecture. A Room can be duplicated only with its own Walls.`;
			}
			return 'This Room is not isolated: one of its Walls is shared with other architecture. A Room can be duplicated only with its own Walls.';
		}
		case 'external_portal_relation':
			return 'An Opening in this Room is connected to another Room. Remove that door relation before duplicating.';
		case 'profile_object_read_only':
			return 'This Room contains a read-only profile object. Remove it before duplicating.';
		case 'unknown_room':
			return 'That Room is gone. Select the Room again.';
		case 'unresolvable_floor':
			return 'This Room has no resolvable floor to place a copy.';
		case 'captured_id_in_use':
			return 'That identity is already taken. Start the duplicate again.';
		case 'invalid-value':
		case 'invalid_value':
			return 'This Room cannot be placed there. Move the copy and try again.';
		default:
			return 'This Room cannot be duplicated as it stands.';
	}
}

/** Drawing diagnostics stay in tooling; the local problem marker offers a remedy. */
export function drawingRefusalWords(code: string): string {
	// A chain refusal is about the outline being drawn, not about editing an
	// existing Room. Name the attempted closure and the smallest repair instead
	// of the Card's "Room moved across its boundary" words.
	switch (code) {
		case 'arc_rise_out_of_range':
			return 'An Arc bulge can be no more than half its chord. Pull the bulge closer to the line.';
		case 'invalid_candidate_document':
		case 'candidate_does_not_compile':
		case 'room_reconciliation_rejected':
			return 'This outline would not enclose a valid Room. Check that both ends meet the same Wall junctions and that the new Wall does not cross another Wall.';
		case 'unconnected_interior_contact':
		case 'unconnected_crossing':
			return 'This outline would touch or cross a Wall without naming a connection. End on a Wall span or a Junction, or move the leg clear.';
		case 'collinear_overlap':
		case 'self_intersecting_chain':
			return 'This outline overlaps itself or an existing Wall. Move the leg clear of the Wall it runs along.';
		default:
			return drawingRefusalFallback(code);
	}
}

function drawingRefusalFallback(code: string): string {
	switch (code) {
		case 'unconnected_crossing':
		case 'unconnected_interior_contact': return 'End this line on the wall.';
		case 'nested_room':
		case 'unconnected_nested_ring': return 'Connect this outline to the room boundary.';
		case 'insufficient_chain': return 'Add another point.';
		default: return wallRefusalWords(code);
	}
}
