/**
 * S5b — Layout's Paint answer names every surface Scene can store.
 *
 * Face scope returns the exact Room plane or Region face; Space scope expands
 * through Layout's one membership query (Wall sides, floor, a present lid and
 * wholly-contained Region faces) without a second Wall-side filter. The 3D Room
 * lid is named from its Stage-only `room-lid` hit.
 */
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	surfaceKey,
	surfacesOfSpace,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import type { StageSourceHit } from '$lib/authoring/stage/stage-facade';
import { createLayoutContributions } from '$lib/authoring/adapters/layout/layout-contributions';
import { g1DocumentWithRooms, g1RoomPolygon } from '../layout/__fixtures__/layout-g1-fixtures';

function document(): LayoutDocumentWallFirst {
	const layout = g1DocumentWithRooms([
		g1RoomPolygon('paint-room', [[0, 0], [8, 0], [8, 6], [0, 6]]),
		g1RoomPolygon('neighbour', [[8, 0], [12, 0], [12, 6], [8, 6]])
	]);
	layout.regions.push({
		id: 'terrace',
		role: 'floor',
		footprint: { kind: 'polygon', points: [[2, 2], [6, 2], [6, 4], [2, 4]] },
		elevation: 0.2,
		thickness: 0.2,
		form: { kind: 'flat' },
		intendedGaps: []
	});
	// A slab that straddles the shared Wall's two Spaces.
	layout.regions.push({
		id: 'straddler',
		role: 'floor',
		footprint: { kind: 'polygon', points: [[7, 2], [9, 2], [9, 4], [7, 4]] },
		elevation: 0.2,
		thickness: 0.2,
		form: { kind: 'flat' },
		intendedGaps: []
	});
	return layout;
}

function contributionsFor(layout: LayoutDocumentWallFirst) {
	const geometry = compileWallFirstLayoutGeometry(layout).geometry;
	return createLayoutContributions({
		document: layout,
		levelId: layout.floor.id,
		context: { snapshot: { domain: { geometry, datumMeters: 0 } } },
		deletionDisclosures: new Map(),
		services: {},
		selectLayoutSubject: () => {},
		readActiveKnot: () => null,
		requestRoomDuplicate: () => ({ kind: 'accepted' }),
		removeSelectedKnot: () => ({ kind: 'accepted' }),
		regionEdgePick: () => null
	} as never);
}

function hit(sourceId: string, sourceKind: StageSourceHit['sourceKind'], componentId?: string): StageSourceHit {
	return {
		sourceId,
		sourceKind,
		generationId: 'generation-1',
		stream: 'projected',
		subRef: componentId === undefined ? null : { kind: 'component', componentId },
		worldPoint: [0, 0, 0]
	} as StageSourceHit;
}

describe('S5b — Layout Paint answers', () => {
	it('paints a Room floor and a 3D lid, and expands both to the one Space', () => {
		const layout = document();
		const contributions = contributionsFor(layout);
		const floor = contributions.paintAnswer(hit('paint-room', 'room-floor'), '3d');
		expect(floor).toMatchObject({
			kind: 'paintable-surface',
			surface: { kind: 'room-floor', roomId: 'paint-room' },
			space: { kind: 'unique', roomId: 'paint-room' }
		});
		if (floor.kind !== 'paintable-surface' || floor.space.kind !== 'unique') return;
		const membership = new Set(floor.space.surfaces.map(surfaceKey));
		for (const surface of surfacesOfSpace(layout, 'paint-room').surfaces) {
			expect(membership.has(surfaceKey(surface))).toBe(true);
		}
		expect(membership.has(surfaceKey({ kind: 'room-lid', roomId: 'paint-room' }))).toBe(true);
		expect(membership.has(surfaceKey({ kind: 'region-face', regionId: 'terrace', face: 'top' }))).toBe(true);
		expect(membership.has(surfaceKey({ kind: 'region-face', regionId: 'straddler', face: 'top' }))).toBe(false);

		expect(contributions.paintAnswer(hit('paint-room', 'room-lid'), '3d')).toMatchObject({
			kind: 'paintable-surface',
			surface: { kind: 'room-lid', roomId: 'paint-room' }
		});
	});

	it('paints a Region top and underside but refuses its edge', () => {
		const contributions = contributionsFor(document());
		expect(contributions.paintAnswer(hit('terrace', 'region', 'top'), '3d')).toMatchObject({
			kind: 'paintable-surface',
			surface: { kind: 'region-face', regionId: 'terrace', face: 'top' },
			space: { kind: 'unique', roomId: 'paint-room' }
		});
		expect(contributions.paintAnswer(hit('terrace', 'region', 'underside'), 'plan')).toMatchObject({
			kind: 'paintable-surface',
			surface: { kind: 'region-face', regionId: 'terrace', face: 'underside' }
		});
		expect(contributions.paintAnswer(hit('terrace', 'region', 'edge'), '3d')).toMatchObject({
			kind: 'refused',
			message: 'This part of a region can’t be painted.'
		});
	});

	it('refuses a dormant lid and gives a straddling Region no Space scope', () => {
		const layout = document();
		layout.rooms[0]!.overhead = 'open-to-sky';
		const contributions = contributionsFor(layout);
		expect(contributions.paintAnswer(hit('paint-room', 'room-lid'), '3d')).toMatchObject({
			kind: 'refused',
			message: 'That surface changed. Try again.'
		});
		expect(contributions.paintAnswer(hit('straddler', 'region', 'top'), '3d')).toMatchObject({
			kind: 'paintable-surface',
			surface: { kind: 'region-face', regionId: 'straddler', face: 'top' },
			space: { kind: 'none' }
		});
		expect(contributions.paintAnswer(hit('paint-room', 'room-floor'), '3d')).toMatchObject({
			kind: 'paintable-surface'
		});
	});

	it('still refuses a source that has no surface identity', () => {
		expect(contributionsFor(document()).paintAnswer(hit('opening:door:1', 'opening'), '3d')).toMatchObject({
			kind: 'refused'
		});
	});
});
