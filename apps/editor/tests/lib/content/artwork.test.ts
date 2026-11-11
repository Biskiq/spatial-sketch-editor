import { describe, expect, it } from 'vitest';
import { artworkHeight, defaultArtworkWidth, probeArtworkImage, type SceneArtworkEntity } from '@portfolio/project-model';
import { SCENE_UNIT_FORMAT_VERSION, validateCameraFreeScenePayload } from '@portfolio/project-model/units';
import { artworkPlacement } from '$lib/authoring/artwork/artwork-placement';
import { artworkCornerPoint, resizeArtworkAtRay } from '$lib/authoring/artwork/artwork-resize';

const image = { assetId: '00000000-0000-4000-8000-000000000001', pixelWidth: 2, pixelHeight: 1 };
const artwork: SceneArtworkEntity = {
	kind: 'artwork', id: 'artwork-1', name: 'Test print', source: { kind: 'image', ...image },
	position: [0, 0, 0], rotation: [0, 0, 0], widthMeters: 1
};
const unit = {
	formatVersion: SCENE_UNIT_FORMAT_VERSION, entities: [artwork], textures: [], materials: [],
	artworkLibrary: [{ ...image, name: 'Image' }]
};

describe('Scene Artwork', () => {
	it('admits one image shared across hangings with separate IDs and derives height', () => {
		const result = validateCameraFreeScenePayload({ ...unit, entities: [artwork, { ...artwork, id: 'artwork-2' }] });
		expect(result.success).toBe(true);
		expect(artworkHeight(1, image)).toBe(0.5);
		expect(defaultArtworkWidth({ ...image, pixelWidth: 4096, pixelHeight: 1 })).toBe(4.096);
	});
	it.each([
		{ formatVersion: 5 },
		{ artworkLibrary: [] },
		{ artworkLibrary: [unit.artworkLibrary[0], unit.artworkLibrary[0]] },
		{ entities: [{ ...artwork, heightMeters: 2 }] },
		{ entities: [{ ...artwork, materialInstanceId: 'finish' }] },
		{ entities: [{ ...artwork, widthMeters: 0.001 }] },
		{ entities: [{ ...artwork, source: { ...image, kind: 'image', pixelWidth: 4097 } }] },
		{ clusters: [{ id: 'c', name: 'Group', memberIds: ['artwork-1', 'artwork-2'] }] }
	])('refuses an incompatible Scene or invalid Artwork shape %j', (patch) => {
		expect(validateCameraFreeScenePayload({ ...unit, ...patch }).success).toBe(false);
	});
	it('probes original PNG bytes before decode and reports the initial edge limit', () => {
		const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='), (c) => c.charCodeAt(0));
		expect(probeArtworkImage(bytes)).toEqual({ mime: 'image/png', pixelWidth: 1, pixelHeight: 1 });
		new DataView(bytes.buffer).setUint32(16, 4097);
		expect(() => probeArtworkImage(bytes)).toThrow('4096 px per edge');
		expect(() => probeArtworkImage(bytes.subarray(0, 34))).toThrow('valid static');
	});
	it('mounts on a visible vertical face and uses a free pose on a miss', () => {
		const ray = { origin: [0, 2, 3], direction: [0, -0.5, -1] } as const;
		const hit = { kind: 'layout', entityId: null, distanceMeters: 2, worldPoint: [0, 1, 1], wallNormal: [0, 0, 1] } as const;
		expect(artworkPlacement(ray as never, hit as never, 0, [0, 2, 3], [0, 0, -1]))
			.toEqual({ position: [0, 1, 1.002], rotation: [0, 0, 0] });
		expect(artworkPlacement(ray as never, null, 0, [0, 2, 3], [0, 0, -1]))
			.toEqual({ position: [0, 1.5, 2], rotation: [0, 0, 0] });
	});
	it('resizes on the image plane while preserving the opposite corner and aspect', () => {
		const resized = resizeArtworkAtRay(artwork, [1, 1], { origin: [1.5, 0.75, 3], direction: [0, 0, -1] });
		expect(resized?.widthMeters).toBeCloseTo(2);
		expect(artworkCornerPoint(resized!, [-1, -1]).toArray()).toEqual(artworkCornerPoint(artwork, [-1, -1]).toArray());
	});
});

it('records import, placement and size as separate reversible accepted writes', async () => {
	const { createUnitCoordinator, createUnitProject } = await import('../authoring/__fixtures__/unit-envelope-fixtures');
	const { createArtworkPlanners, ARTWORK_IMPORT, ARTWORK_PLACE, ARTWORK_TRANSFORM } = await import('@portfolio/project-model/scene-planning');
	const baseline = await createUnitProject({ id: 'project:artwork-history', name: 'Artwork history' });
	const coordinator = await createUnitCoordinator({ baseline, planners: createArtworkPlanners() });
	const scene = () => coordinator.current().source.units.scene;
	const first = await coordinator.accept({
		version: 1, kind: ARTWORK_IMPORT, operationId: 'artwork-import-op', expectedRevision: coordinator.acceptedRevision(),
		payload: { entries: [{ ...image, name: 'Image' }] }, targets: [], allocatedIds: [], capturedInputs: []
	});
	expect(first.kind).toBe('accepted');
	expect(scene().data.artworkLibrary).toHaveLength(1);
	const placed = await coordinator.accept({
		version: 1, kind: ARTWORK_PLACE, operationId: 'artwork-place-op', expectedRevision: coordinator.acceptedRevision(),
		payload: { assetId: image.assetId, position: [1, 2, 3], rotation: [0, 0.5, 0] },
		targets: [], allocatedIds: [{ kind: 'scene-entity', id: artwork.id }], capturedInputs: []
	});
	expect(placed.kind).toBe('accepted');
	const original = scene().data.entities[0];
	const sized = await coordinator.accept({
		version: 1, kind: ARTWORK_TRANSFORM, operationId: 'artwork-size-op', expectedRevision: coordinator.acceptedRevision(),
		payload: { widthMeters: 2, position: [2, 2, 3] },
		targets: [{
			version: 1, domain: 'scene', revision: { kind: 'exact', contentRevision: scene().header.contentRevision },
			subject: { kind: 'entity', id: artwork.id }, instancePath: [], location: { kind: 'project-root' },
			componentId: null, capabilityId: null
		}],
		allocatedIds: [], capturedInputs: []
	});
	expect(sized.kind).toBe('accepted');
	expect(scene().data.entities[0]).toMatchObject({ widthMeters: 2, position: [2, 2, 3] });
	expect((await coordinator.undo()).kind).toBe('restored');
	expect(scene().data.entities[0]).toEqual(original);
	expect((await coordinator.undo()).kind).toBe('restored');
	expect(scene().data.entities).toHaveLength(0);
	expect(scene().data.artworkLibrary).toHaveLength(1);
	expect((await coordinator.undo()).kind).toBe('restored');
	expect(scene().data.artworkLibrary).toBeUndefined();
	expect((await coordinator.redo()).kind).toBe('restored');
	expect(scene().data.artworkLibrary).toHaveLength(1);
});

it('reads JPEG orientation and static WebP dimensions from the original containers', () => {
	// Header fixture exercises the metadata probe. Pixel decode is a separate browser check.
	const jpeg = new Uint8Array([
		0xff, 0xd8, 0xff, 0xe1, 0, 34, 69, 120, 105, 102, 0, 0,
		73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 0x12, 1, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0,
		0xff, 0xc0, 0, 8, 8, 0, 4, 0, 8, 1, 0xff, 0xda, 0, 2, 0xff, 0xd9
	]);
	expect(probeArtworkImage(jpeg)).toEqual({ mime: 'image/jpeg', pixelWidth: 4, pixelHeight: 8 });
	const webp = Uint8Array.from(atob('UklGRk4AAABXRUJQVlA4WAoAAAAgAAAABwAAAwAAVlA4IDAAAADQAQCdASoIAAQAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA='), (c) => c.charCodeAt(0));
	expect(probeArtworkImage(webp)).toEqual({ mime: 'image/webp', pixelWidth: 8, pixelHeight: 4 });
	webp[20] |= 2;
	expect(() => probeArtworkImage(webp)).toThrow('Animated images');
});
