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
export function wallRefusalWords(code: string): string {
	switch (code) {
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
		case 'room_identity_lost':
		case 'room_reconciliation_rejected':
		case 'ambiguous_room_correspondence':
		case 'ambiguous_room_removal':
		case 'nonadjacent_portal_relation':
		case 'portal_relation_invalid':
			return 'This would break a Room.';
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
			return 'This change cannot be applied.';
	}
}
