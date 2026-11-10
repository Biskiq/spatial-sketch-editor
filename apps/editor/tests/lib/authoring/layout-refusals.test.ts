import { describe, expect, it } from 'vitest';

import { wallRefusalWords } from '$lib/authoring/adapters/layout/refusals';

describe('Wall bend refusals', () => {
	it('names the thickness limit when the Wall offset folds', () => {
		expect(
			wallRefusalWords(
				'geometry_invalid',
				'Wall offset folds or self-intersects (curve radius smaller than half the wall thickness).'
			)
		).toBe(
			"This bend is too tight for the Wall's thickness. Pull it further out or reduce the thickness."
		);
	});

	it.each(['room_identity_lost', 'room_reconciliation_rejected'])(
		'names the Room boundary conflict for %s without the generic sentence',
		(code) => {
			const words = wallRefusalWords(code);
			expect(words).toContain('Room');
			expect(words).not.toBe('This would break a Room.');
			expect(words).not.toBe('This change cannot be applied.');
		}
	);

	it('names a Room even when a future code is not mapped yet', () => {
		expect(wallRefusalWords('future_room_gate', "Room 'room-1' has no candidate boundary")).toBe(
			'This would change a Room boundary. Keep the moved Wall on the Room side.'
		);
	});

	it.each([
		'split_at_existing_endpoint',
		'split_distance_out_of_range',
		'split_through_opening_interior',
		'curve_knot_limit',
		'unknown_curve_anchor',
		'closed_wall_not_bendable',
		'closed_wall_isolated',
		'invalid_endpoint',
		'invalid_reference',
		'geometry_invalid'
	])('never falls back to the generic sentence for %s', (code) => {
		expect(wallRefusalWords(code)).not.toBe('This change cannot be applied.');
	});
});
