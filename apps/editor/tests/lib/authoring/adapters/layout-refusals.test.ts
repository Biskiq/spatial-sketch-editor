import { describe, expect, it } from 'vitest';

import { createEmptyWallFirstLayoutDocument, type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';

import {
	refusalSubjects,
	wallJoinRefusalWords,
	wallRefusalWords,
	wallSplitRefusalWords
} from '$lib/authoring/adapters/layout/refusals';

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
		'geometry_invalid',
		'wall_top_profile_unsupported',
		'wall_top_not_joinable',
		'wall_top_below_opening',
		'closed_wall_level_only',
		'wall_top_split_degenerate',
		'room_ceiling_changed'
	])('never falls back to the generic sentence for %s', (code) => {
		expect(wallRefusalWords(code)).not.toBe('This change cannot be applied.');
	});
});

function namedDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.openings.push(
		{
			id: 'o-named',
			wallId: 'w1',
			kind: 'window',
			offset: 1,
			width: 1.2,
			height: 1.2,
			sillHeight: 1,
			profile: 'rectangular',
			name: 'Kitchen window'
		},
		{
			id: 'o-door',
			wallId: 'w1',
			kind: 'door',
			offset: 4,
			width: 0.9,
			height: 2.1,
			sillHeight: 0,
			profile: 'rectangular'
		}
	);
	document.rooms.push({
		id: 'room',
		name: 'Studio',
		boundary: [{ wallId: 'w1', direction: 'forward' }],
		virtualEdges: [],
		overhead: 'closed'
	});
	return document;
}

describe('Wall top refusals', () => {
	it('keeps the circular-Wall rule apart from the Rise and Apex words', () => {
		expect(wallRefusalWords('closed_wall_level_only')).toBe('A circular Wall keeps a level top.');
		for (const code of ['wall_top_rise_invalid', 'wall_top_apex_invalid']) {
			expect(wallRefusalWords(code)).toBe('This top does not fit the Wall. Check its Rise and Apex position.');
		}
	});

	it('names the Opening the top would cut into, from the rejection ids', () => {
		const document = namedDocument();
		expect(
			wallRefusalWords('wall_top_below_opening', '', refusalSubjects(document, ['o-named', 'w1']))
		).toBe('This top would cut into "Kitchen window". Raise the top there or lower the Opening.');
		// An unnamed Opening is named by its kind, as everywhere else.
		expect(
			wallRefusalWords('wall_top_below_opening', '', refusalSubjects(document, ['o-door', 'w1']))
		).toBe('This top would cut into "Door". Raise the top there or lower the Opening.');
		expect(wallRefusalWords('wall_top_below_opening')).toBe(
			'This top would cut into an Opening. Raise the top there or lower the Opening.'
		);
	});

	it('resolves only the first Opening and the first Room among the ids', () => {
		expect(refusalSubjects(namedDocument(), ['w1', 'room', 'o-door', 'o-named'])).toEqual({
			openingName: 'Door',
			roomName: 'Studio'
		});
		expect(refusalSubjects(namedDocument(), undefined)).toEqual({});
	});

	it('says which way Split and Join would move the Room ceiling, naming the Room', () => {
		const subjects = refusalSubjects(namedDocument(), ['room']);
		expect(wallSplitRefusalWords('room_ceiling_changed', '', subjects)).toBe(
			'Splitting here would raise the ceiling of "Studio". Split where the top is no higher than the ceiling, or make the top level first.'
		);
		expect(wallJoinRefusalWords('room_ceiling_changed', '', subjects)).toBe(
			'Joining here would lower the ceiling of "Studio". Adjust the Walls’ tops first.'
		);
		expect(wallRefusalWords('room_ceiling_changed', '', subjects)).toBe(
			'This would change the ceiling of "Studio". Adjust the Wall’s top first.'
		);
	});

	it('gives a near-degenerate cut its own words in Split', () => {
		expect(wallSplitRefusalWords('wall_top_split_degenerate')).toBe(
			'This point is too close to the top’s apex or its low end to cut exactly. Cut at the apex or a little further away.'
		);
	});
});
