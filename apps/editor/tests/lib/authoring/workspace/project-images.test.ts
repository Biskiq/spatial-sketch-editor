import { describe, expect, it } from 'vitest';

import { collectSceneImageRequirements } from '@portfolio/project-model/project-images';
import type { CameraFreeSceneDocument } from '@portfolio/project-model/units';

const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const PIN = {
	hash: `sha256-${'a'.repeat(64)}`,
	mime: 'image/png' as const,
	size: 68,
	locator: `/project-assets/${A}`
};

function scene(overrides: Partial<CameraFreeSceneDocument> = {}): CameraFreeSceneDocument {
	return {
		formatVersion: 13,
		textures: [],
		materials: [],
		entities: [],
		artworkLibrary: [],
		...overrides
	};
}

function texture(id = A) {
	return { id, name: 'Brick', uri: `/project-assets/${id}` };
}

function resource(pin: typeof PIN | null = PIN) {
	return { kind: 'texture' as const, id: A, contentRevision: 'rev-a', pin, unresolved: null };
}

describe('the shared project-image closure enumerator', () => {
	it('includes a Finish-only texture and its material map path', () => {
		const closure = collectSceneImageRequirements(
			scene({
				textures: [texture()],
				materials: [
					{ id: 'finish', name: 'Finish', base: { catalogue: 'plaster-warm' }, overrides: { color: '#ffffff', maps: { color: { image: { textureId: A } } } } }
				]
			}),
			'private-save',
			[resource()]
		);
		expect(closure.issues).toEqual([]);
		expect(closure.requirements).toEqual([
			{
				assetId: A,
				locator: `/project-assets/${A}`,
				expectedPin: { hash: PIN.hash, mime: PIN.mime, size: PIN.size },
				artwork: null,
				paths: [
					'$.units.scene.data.textures[0].uri',
					'$.units.scene.data.materials[0].overrides.maps.color.image.textureId'
				]
			}
		]);
	});

	it.each(['private-load', 'delivery'] as const)('requires an authored project texture pin for %s', (purpose) => {
		const closure = collectSceneImageRequirements(scene({ textures: [texture()] }), purpose, []);
		expect(closure.requirements).toEqual([]);
		expect(closure.issues).toMatchObject([{ code: 'image-pin-missing', path: '$.units.resources.data.resources' }]);
	});

	it('deduplicates an image shared by a Finish and an unplaced Artwork shelf entry', () => {
		const closure = collectSceneImageRequirements(
			scene({
				textures: [texture()],
				artworkLibrary: [{ assetId: A, name: 'Shared', pixelWidth: 1, pixelHeight: 1 }]
			}),
			'private-save',
			[resource()]
		);
		expect(closure.issues).toEqual([]);
		expect(closure.requirements).toHaveLength(1);
		expect(closure.requirements[0]).toMatchObject({
			assetId: A,
			expectedPin: { hash: PIN.hash },
			artwork: { pixelWidth: 1, pixelHeight: 1 },
			paths: ['$.units.scene.data.textures[0].uri', '$.units.scene.data.artworkLibrary[0]']
		});
	});

	it('keeps unplaced Artwork in the private closure and out of delivery', () => {
		const source = scene({
			artworkLibrary: [
				{ assetId: A, name: 'Unplaced', pixelWidth: 1, pixelHeight: 1 },
				{ assetId: B, name: 'Placed', pixelWidth: 1, pixelHeight: 1 }
			],
			entities: [{
				kind: 'artwork', id: 'artwork-b', name: 'Placed', position: [0, 1, 0],
				rotation: [0, 0, 0], widthMeters: 1,
				source: { kind: 'image', assetId: B, pixelWidth: 1, pixelHeight: 1 }
			}]
		});
		expect(collectSceneImageRequirements(source, 'private-load').requirements.map((entry) => entry.assetId))
			.toEqual([A, B]);
		expect(collectSceneImageRequirements(source, 'delivery').requirements.map((entry) => entry.assetId))
			.toEqual([B]);
	});

	it('rejects two oriented sizes for one image and an unknown static delivery texture', () => {
		const closure = collectSceneImageRequirements(
			scene({
				textures: [{ id: 'paper', name: 'Paper', uri: '/textures/not-shipped.png' }],
				artworkLibrary: [
					{ assetId: A, name: 'One', pixelWidth: 1, pixelHeight: 1 },
					{ assetId: A, name: 'Two', pixelWidth: 2, pixelHeight: 2 }
				],
				entities: [{
					kind: 'artwork', id: 'artwork-a', name: 'One', position: [0, 1, 0],
					rotation: [0, 0, 0], widthMeters: 1,
					source: { kind: 'image', assetId: A, pixelWidth: 1, pixelHeight: 1 }
				}]
			}),
			'delivery'
		);
		expect(closure.issues.map((issue) => issue.code)).toEqual(
			expect.arrayContaining(['image-dimensions-conflict', 'image-static-unknown'])
		);
	});

	it('allowlists a Finish override shipped image and refuses an arbitrary path', () => {
		const base = { id: 'finish', name: 'Finish', base: { catalogue: 'plaster-warm' as const } };
		const valid = collectSceneImageRequirements(
			scene({ materials: [{ ...base, overrides: { maps: { color: { image: { shipped: '/textures/plaster-warm/map.png' } } } } }] }),
			'private-save'
		);
		expect(valid.issues).toEqual([]);
		expect(valid.requirements).toEqual([]);

		const refused = collectSceneImageRequirements(
			scene({ materials: [{ ...base, overrides: { maps: { color: { image: { shipped: '/evil/anything.png' } } } } }] }),
			'private-save'
		);
		expect(refused.issues).toContainEqual(expect.objectContaining({
			code: 'image-static-unknown',
			path: '$.units.scene.data.materials[0].overrides.maps.color.image.shipped'
		}));
	});
});
