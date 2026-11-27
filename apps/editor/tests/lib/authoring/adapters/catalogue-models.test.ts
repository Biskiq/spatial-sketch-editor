/**
 * Catalogue visibility follows admission, not held resources.
 *
 * A blank project must be offered the salon chair even though it holds no asset
 * resource, because placement grants that resource atomically. A model with no
 * verified contact (the grandfather clock) is not offered, and Object Studio
 * offers no catalogue at all.
 */
import { describe, expect, it } from 'vitest';
import { visibleCatalogueModels } from '$lib/authoring/adapters/scene/catalogue-models';
import { catalogueModelDefinition } from '$lib/authoring/scene/object-definition-policy';

describe('visible catalogue models', () => {
	it('lists the admitted salon chair even when no resource is held', () => {
		expect(visibleCatalogueModels(false).map(({ id, name }) => ({ id, name }))).toContainEqual({
			id: 'paris-salon-chair',
			name: 'Upholstered Paris Salon Chair',
		});
	});

	it('omits models without verified contact metadata', async () => {
		const ids = visibleCatalogueModels(false).map((model) => model.id);
		expect(ids).not.toContain('paris-grandfather-clock');
		expect(await catalogueModelDefinition('paris-grandfather-clock')).toBeNull();
	});

	it('lists each admitted catalogue model once and nothing in Object Studio', () => {
		const listed = visibleCatalogueModels(false);
		expect(new Set(listed.map((model) => model.id)).size).toBe(listed.length);
		expect(visibleCatalogueModels(true)).toEqual([]);
	});
});
