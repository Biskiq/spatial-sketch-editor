/**
 * The pure material delivery contribution.
 *
 * One definition and one pin set are shared by two subjects; uses remain one per
 * admitted subject. A project texture without a verified manifest pin is a
 * refusal even when a local image index can resolve it.
 */
import { describe, expect, it } from 'vitest';
import {
	createImageIndex,
	materialDeliveryContribution,
	shippedImageIndex,
	type Finish,
	type MaterialDeliveryImagePin
} from '@portfolio/project-model/materials';
import {
	FORM_FACTS,
	IMAGE_HASH,
	IMAGE_SOURCE,
	MODEL_FACTS,
	fixtureImageIndex,
	fullRecipe
} from './fixtures';

const DEFINITION = 'sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const FINISH: Finish = {
	id: 'finish-brushed',
	name: 'Brushed',
	base: { material: DEFINITION }
};

function ownDefinitionImages() {
	return (['color', 'normal', 'orm', 'roughness'] as const).map((role) => ({
		hash: IMAGE_HASH[role],
		source: IMAGE_SOURCE[role]
	}));
}

function subjects() {
	return [
		{ subject: 'form:1', finish: FINISH, targetFacts: FORM_FACTS },
		{ subject: 'model:1', finish: FINISH, targetFacts: MODEL_FACTS }
	];
}

function pins(): ReadonlyMap<string, { mime: string; size: number; locator?: string }> {
	return new Map(
		Object.entries(IMAGE_HASH).map(([key, hash]) => [
			hash,
			{ mime: 'image/png', size: 100 + key.length, locator: `/project-assets/${key}` }
		])
	);
}

describe('material delivery projection', () => {
	it('deduplicates one shared definition and pin set while retaining one use per subject', () => {
		const delivery = materialDeliveryContribution({
			definitions: new Map([[DEFINITION, fullRecipe()]]),
			definitionImages: new Map([[DEFINITION, ownDefinitionImages()]]),
			imageIndex: fixtureImageIndex(),
			projectImagePins: pins(),
			subjects: subjects()
		});
		expect(delivery.issues).toEqual([]);
		expect(delivery.profiles).toEqual([{ id: 'pbr-metallic-roughness', version: '1' }]);
		expect(delivery.definitions).toEqual([{ hash: DEFINITION, recipe: fullRecipe() }]);
		expect(delivery.uses.map((use) => use.subject)).toEqual(['form:1', 'model:1']);
		expect(delivery.uses.every((use) => use.finishId === 'finish-brushed')).toBe(true);
		expect(new Set(delivery.imagePins.map((pin) => pin.hash)).size).toBe(delivery.imagePins.length);
		const hashes = delivery.imagePins.map((pin) => pin.hash);
		expect(hashes).toEqual([...hashes].sort());
		expect(delivery.uses[0]?.mappingRequirements.map((requirement) => requirement.role)).toEqual([
			'color',
			'normal',
			'roughness',
			'metalness',
			'occlusion'
		]);
	});

	it('refuses a project image with no verified manifest pin even when it resolves locally', () => {
		const withoutNormal = pins();
		(withoutNormal as Map<string, { mime: string; size: number; locator?: string }>).delete(IMAGE_HASH.normal);
		const delivery = materialDeliveryContribution({
			definitions: new Map([[DEFINITION, fullRecipe()]]),
			definitionImages: new Map([[DEFINITION, ownDefinitionImages()]]),
			imageIndex: fixtureImageIndex(),
			projectImagePins: withoutNormal,
			subjects: subjects()
		});
		expect(delivery.uses).toEqual([]);
		expect(delivery.definitions).toEqual([]);
		expect(delivery.issues).toContainEqual(expect.objectContaining({ code: 'missing-pin' }));
	});

	it('refuses an image outside the frozen shipped manifest', () => {
		const delivery = materialDeliveryContribution({
			definitions: new Map([[DEFINITION, fullRecipe()]]),
			definitionImages: new Map([[DEFINITION, ownDefinitionImages()]]),
			imageIndex: createImageIndex([
				{ hash: IMAGE_HASH.color, source: IMAGE_SOURCE.color },
				{ hash: IMAGE_HASH.normal, source: IMAGE_SOURCE.normal },
				{ hash: IMAGE_HASH.orm, source: IMAGE_SOURCE.orm },
				{ hash: IMAGE_HASH.roughness, source: IMAGE_SOURCE.roughness },
				{ hash: IMAGE_HASH.alternate, source: IMAGE_SOURCE.alternate }
			]),
			projectImagePins: pins(),
			subjects: [{
				subject: 'shipped',
				finish: {
					id: 'alternate',
					name: 'Alternate',
					base: { material: DEFINITION },
					overrides: { maps: { color: { image: IMAGE_SOURCE.alternate } } }
				}
			}]
		});
		expect(delivery.issues).toContainEqual(expect.objectContaining({ code: 'missing-image' }));
	});

	it('names a missing definition instead of blaming the catalogue', () => {
		const delivery = materialDeliveryContribution({
			definitions: new Map(),
			definitionImages: new Map(),
			imageIndex: fixtureImageIndex(),
			subjects: [{ subject: 'form:1', finish: FINISH }]
		});
		expect(delivery.issues).toContainEqual(expect.objectContaining({ code: 'missing-definition' }));
	});

	it('resolves a definition through its own images, not an earlier same-hash texture', () => {
		const ownImages = Object.entries(IMAGE_HASH).map(([role, hash]) => ({
			hash,
			source: IMAGE_SOURCE[role as keyof typeof IMAGE_SOURCE]
		}));
		const delivery = materialDeliveryContribution({
			definitions: new Map([[DEFINITION, fullRecipe()]]),
			definitionImages: new Map([[DEFINITION, ownImages]]),
			imageIndex: createImageIndex([
				{ hash: IMAGE_HASH.color, source: { textureId: 'unrelated-earlier-texture' } }
			]),
			projectImagePins: pins(),
			subjects: [{ subject: 'form:1', finish: FINISH }]
		});
		expect(delivery.issues).toEqual([]);
		expect(delivery.imagePins.find((pin) => pin.hash === IMAGE_HASH.color)?.source).toEqual(
			IMAGE_SOURCE.color
		);
	});

	it('keeps a static pin exact and reports its shipped locator, MIME and size', () => {
		const delivery = materialDeliveryContribution({
			definitions: new Map(),
			definitionImages: new Map(),
			imageIndex: shippedImageIndex(),
			subjects: [{
				subject: 'curated',
				finish: { id: 'curated', name: 'Curated', base: { catalogue: 'brass-aged' } }
			}]
		});
		expect(delivery.issues).toEqual([]);
		const pin = delivery.imagePins[0] as MaterialDeliveryImagePin | undefined;
		expect(pin).toMatchObject({
			hash: 'sha256-ad73e7b0fec069675ce71f8c0a63734c597d51b6a81d00fa1755dec00c86f271',
			mime: 'image/png',
			size: 76488,
			locator: '/textures/brass-aged/map.png'
		});
	});

	it('carries a direct catalogue subject without inventing a Finish id', () => {
		const delivery = materialDeliveryContribution({
			definitions: new Map(),
			definitionImages: new Map(),
			imageIndex: shippedImageIndex(),
			subjects: [{ subject: 'entity:wall-plinth', catalogue: 'brass-aged' }]
		});
		expect(delivery.issues).toEqual([]);
		expect(delivery.uses).toHaveLength(1);
		expect(delivery.uses[0]).toMatchObject({ subject: 'entity:wall-plinth', finishId: null });
		expect(delivery.imagePins).toHaveLength(1);
	});
});
