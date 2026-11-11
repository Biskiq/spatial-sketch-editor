/**
 * T2.S7 — the pure Light it recipe geometry.
 *
 * These cases pin the two approved starting shapes: a Picture spot 1.4 m in
 * front and 30° above an Artwork, fitted to its rectangle, and a Wash fitted to
 * one evaluated bounds union. The aim is the stored rotation, so the cone
 * coverage assertion is the rendered light's own coverage, not a parallel guide
 * calculation. Every coverage assertion checks both the cone angle and the
 * radial cutoff, because fitting the direction alone can still clip a corner.
 */
import { describe, expect, it } from 'vitest';
import type { SceneArtworkEntity, Vec3 } from '@portfolio/project-model';
import {
	artworkLightRectangle,
	boundsCorners,
	LIGHT_IT_BEAM_MARGIN_RATIO,
	LIGHT_IT_PICTURE_SPOT_FRONT_METERS,
	LIGHT_IT_PICTURE_SPOT_NAME,
	LIGHT_IT_WASH_NAME,
	pictureSpotRecipe,
	unionLightItBounds,
	washRecipe,
	type LightItRecipe,
	type LightItRecipeOutcome
} from '$lib/authoring/look/light-recipes';
import { lightForward } from '$lib/authoring/look/light-aim';
import { radiansToDegrees } from '$lib/authoring/look/light-units';

const ASSET_ID = '11111111-1111-4111-8111-111111111111';

function artwork(overrides: Partial<SceneArtworkEntity> = {}): SceneArtworkEntity {
	return {
		kind: 'artwork',
		id: 'artwork-a',
		name: 'Still life',
		position: [2, 1.6, 3],
		rotation: [0, 0, 0],
		widthMeters: 1.2,
		source: { kind: 'image', assetId: ASSET_ID, pixelWidth: 1200, pixelHeight: 800 },
		...overrides
	};
}

function recipeFrom(outcome: LightItRecipeOutcome): LightItRecipe {
	if (outcome.kind === 'refused') throw new Error(outcome.message);
	return outcome.recipe;
}

function angleFromAim(origin: Vec3, direction: Vec3, point: Vec3): number {
	const offset: Vec3 = [point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]];
	const length = Math.hypot(...offset);
	const cosine = Math.max(
		-1,
		Math.min(
			1,
			(direction[0] * offset[0] + direction[1] * offset[1] + direction[2] * offset[2]) / length
		)
	);
	return Math.acos(cosine);
}

function distanceFrom(origin: Vec3, point: Vec3): number {
	return Math.hypot(point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]);
}

function expectCornersCovered(recipe: LightItRecipe, corners: readonly Vec3[]): void {
	const forward = lightForward(recipe.rotation);
	for (const corner of corners) {
		expect(angleFromAim(recipe.position, forward, corner)).toBeLessThanOrEqual(
			recipe.angle + 1e-9
		);
		expect(distanceFrom(recipe.position, corner)).toBeLessThanOrEqual(recipe.range + 1e-9);
	}
}

describe('S7 Light it recipes', () => {
	it('places a Picture spot 1.4 m in front and 30° above an upright Artwork', () => {
		const entity = artwork();
		const recipe = recipeFrom(pictureSpotRecipe(entity));
		expect(recipe.recipe).toBe('picture-spot');
		expect(recipe.name).toBe(LIGHT_IT_PICTURE_SPOT_NAME);
		expect(recipe.position[0]).toBeCloseTo(2, 9);
		expect(recipe.position[1]).toBeCloseTo(
			1.6 + LIGHT_IT_PICTURE_SPOT_FRONT_METERS * Math.tan(Math.PI / 6),
			9
		);
		expect(recipe.position[2]).toBeCloseTo(3 + LIGHT_IT_PICTURE_SPOT_FRONT_METERS, 9);
		const forward = lightForward(recipe.rotation);
		const toCentre: Vec3 = [2 - recipe.position[0], 1.6 - recipe.position[1], 3 - recipe.position[2]];
		const length = Math.hypot(...toCentre);
		expect(
			forward[0] * (toCentre[0] / length) +
				forward[1] * (toCentre[1] / length) +
				forward[2] * (toCentre[2] / length)
		).toBeGreaterThan(0.999999);
		expect(recipe.range).toBeGreaterThan(Math.hypot(...toCentre));
	});

	it('fits the Picture spot cone and cutoff to all four Artwork corners', () => {
		const entity = artwork({ rotation: [0, Math.PI / 2, 0], position: [-1, 2, 4] });
		const recipe = recipeFrom(pictureSpotRecipe(entity));
		const rectangle = artworkLightRectangle(entity);
		expectCornersCovered(recipe, rectangle.corners);
		const widest = Math.max(
			...rectangle.corners.map((corner) =>
				angleFromAim(recipe.position, lightForward(recipe.rotation), corner)
			)
		);
		expect(recipe.angle).toBeCloseTo(widest * LIGHT_IT_BEAM_MARGIN_RATIO, 9);
		// A turned artwork follows its own front, not the room's +Z.
		expect(recipe.position[0]).toBeCloseTo(-1 + LIGHT_IT_PICTURE_SPOT_FRONT_METERS, 9);
		expect(recipe.position[2]).toBeCloseTo(4, 9);
		expect(rectangle.center).toEqual(entity.position);
	});

	it('fits a Wash to all eight evaluated bounds corners within its cutoff', () => {
		const bounds = { min: [1.5, 0, 0.5] as Vec3, max: [2.5, 1, 1.5] as Vec3 };
		const recipe = recipeFrom(washRecipe({ bounds, front: [0, 0, 1] }));
		expect(recipe.recipe).toBe('wash');
		expect(recipe.name).toBe(LIGHT_IT_WASH_NAME);
		expect(recipe.position[1]).toBeGreaterThan(1);
		expectCornersCovered(recipe, boundsCorners(bounds));
	});

	it('covers one multi-selection union with a single Wash recipe', () => {
		const left = { min: [-3, 0, 0] as Vec3, max: [-2, 1, 1] as Vec3 };
		const right = { min: [3, 0, 0] as Vec3, max: [4, 2, 1] as Vec3 };
		const union = unionLightItBounds([left, right]);
		expect(union).toEqual({ min: [-3, 0, 0], max: [4, 2, 1] });
		const recipe = recipeFrom(washRecipe({ bounds: union!, front: [0, 0, 1] }));
		expectCornersCovered(recipe, boundsCorners(union!));
		expect(radiansToDegrees(recipe.angle)).toBeLessThanOrEqual(80);
	});

	it('covers a large Artwork in both cone and cutoff', () => {
		const entity = artwork({ widthMeters: 4 });
		const rectangle = artworkLightRectangle(entity);
		const recipe = recipeFrom(pictureSpotRecipe(entity));
		expectCornersCovered(recipe, rectangle.corners);
	});

	it('refuses a Picture spot when the margined cone would exceed 80°', () => {
		const outcome = pictureSpotRecipe(artwork({ widthMeters: 6 }));
		expect(outcome.kind).toBe('refused');
		if (outcome.kind === 'refused') expect(outcome.message).toContain('80°');
	});

	it('covers a very large multi-selection with one Wash without an angle cap', () => {
		const left = { min: [-701, 0, 0] as Vec3, max: [-700, 1, 1] as Vec3 };
		const right = { min: [700, 0, 0] as Vec3, max: [701, 1, 1] as Vec3 };
		const union = unionLightItBounds([left, right]);
		expect(union).not.toBeNull();
		const recipe = recipeFrom(washRecipe({ bounds: union!, front: [0, 0, 1] }));
		expect(radiansToDegrees(recipe.angle)).toBeLessThanOrEqual(80);
		expectCornersCovered(recipe, boundsCorners(union!));
	});
});
