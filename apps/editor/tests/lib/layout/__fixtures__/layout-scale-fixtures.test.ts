import { describe, expect, it } from 'vitest';
import { validateWallFirstLayoutDocument } from '@portfolio/layout-core';
import {
	buildScaleFixture,
	SCALE_FIXTURE_SEEDS,
	type ScaleFixtureTier
} from './layout-scale-fixtures';

describe('layout-scale-fixtures', () => {
	it('is byte-deterministic for a given seed', () => {
		const first = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const second = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		expect(JSON.stringify(first)).toBe(JSON.stringify(second));
	});

	it('differs across seeds', () => {
		const small = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const medium = buildScaleFixture(SCALE_FIXTURE_SEEDS.medium);
		expect(JSON.stringify(small)).not.toBe(JSON.stringify(medium));
	});

	it.each<[ScaleFixtureTier, number]>(Object.entries(SCALE_FIXTURE_SEEDS).map(([tier, spec]) => [tier as ScaleFixtureTier, spec.roomCount]))(
		'emits the requested room and object counts for %s (%i rooms)',
		(_tier, roomCount) => {
			const tier = _tier as ScaleFixtureTier;
			const spec = SCALE_FIXTURE_SEEDS[tier];
			const document = buildScaleFixture(spec);
			expect(document.rooms).toHaveLength(roomCount);
			expect(document.walls).toHaveLength(roomCount * 4);
			expect(document.junctions).toHaveLength(roomCount * 4);
			expect(document.objects).toHaveLength(roomCount * spec.objectsPerRoom);
		}
	);

	it('reflects the pinned mix at every scale', () => {
		for (const tier of ['small', 'medium', 'large'] as const) {
			const spec = SCALE_FIXTURE_SEEDS[tier];
			const document = buildScaleFixture(spec);
			const curvedWallIds = new Set(
				document.walls.filter((wall) => wall.centerline.kind === 'cubic-chain').map((wall) => wall.id)
			);
			const curvedRooms = document.rooms.filter((room) =>
				room.boundary.some((ref) => curvedWallIds.has(ref.wallId))
			);
			const bezierFraction = curvedRooms.length / document.rooms.length;
			expect(bezierFraction).toBeGreaterThan(0.1);
			expect(bezierFraction).toBeLessThan(0.6);

			const openings = document.openings;
			expect(openings).toHaveLength(roomCountFor(tier) * spec.openingsPerRoom);
			expect(openings.every((opening) => ['rectangular', 'rounded', 'pointed'].includes(opening.profile))).toBe(true);
			expect(openings.some((opening) => opening.kind === 'door')).toBe(true);
			expect(openings.some((opening) => opening.kind === 'window')).toBe(true);

			const kinds = new Set(document.objects.map((object) => object.kind));
			expect(kinds.size).toBeGreaterThan(2);
		}
	});

	it('passes the strict wall-first codec at the small and medium scales', () => {
		for (const tier of ['small', 'medium'] as const) {
			const document = buildScaleFixture(SCALE_FIXTURE_SEEDS[tier]);
			const validated = validateWallFirstLayoutDocument(document);
			expect(
				validated.success,
				`codec rejected ${tier}: ${JSON.stringify(validated.success ? [] : validated.issues)}`
			).toBe(true);
		}
	}, 30000);
});

function roomCountFor(tier: ScaleFixtureTier): number {
	return SCALE_FIXTURE_SEEDS[tier].roomCount;
}
