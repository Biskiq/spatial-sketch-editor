import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
	ARTWORK_FLOAT_BACKING_COLOR, ARTWORK_MAT_COLOR, artworkFrameLayout,
	type ArtworkFrame, type SceneArtworkEntity, type Vec3
} from '@portfolio/project-model';
import { SCENE_UNIT_FORMAT_VERSION, validateCameraFreeScenePayload, type CameraFreeSceneDocument } from '@portfolio/project-model/units';
import { artworkHandlePoint, artworkCornerPoint, resizeArtworkAtRay } from '$lib/authoring/artwork/artwork-resize';
import {
	activeArtworkHangGuide, artworkHangingGuides, snapArtworkHeight
} from '$lib/authoring/artwork/artwork-hanging';

const OLD_IMAGE = { assetId: '00000000-0000-4000-8000-000000000001', pixelWidth: 2, pixelHeight: 1 };
const NEW_IMAGE = { assetId: '00000000-0000-4000-8000-000000000002', pixelWidth: 2, pixelHeight: 2 };
const OLD_ENTRY = { ...OLD_IMAGE, name: 'Old image' };
const NEW_ENTRY = { ...NEW_IMAGE, name: 'New image' };
const GALLERY: ArtworkFrame = { style: 'gallery', mat: true, color: 'walnut' };

function artwork(overrides: Partial<SceneArtworkEntity> = {}): SceneArtworkEntity {
	return {
		kind: 'artwork', id: 'artwork-1', name: 'My print',
		position: [0, 1, 0] as Vec3, rotation: [0, 0, 0] as Vec3, widthMeters: 1,
		source: { kind: 'image', ...OLD_IMAGE }, frame: { ...GALLERY }, ...overrides
	};
}

function scene(entities: SceneArtworkEntity[], shelf = [OLD_ENTRY]): CameraFreeSceneDocument {
	return {
		formatVersion: SCENE_UNIT_FORMAT_VERSION, textures: [], materials: [],
		entities, artworkLibrary: shelf
	};
}

describe('Artwork frame contract and layout', () => {
	it('persists one closed frame record and keeps the canonical default absent', () => {
		const framed = validateCameraFreeScenePayload(scene([artwork()]));
		if (!framed.success) throw new Error('framed document refused');
		const framedEntity = framed.value.entities[0]!;
		expect(framedEntity.kind === 'artwork' ? framedEntity.frame : undefined).toEqual(GALLERY);

		const plain = artwork({ frame: { style: 'none', mat: false, color: 'black' } });
		const result = validateCameraFreeScenePayload(scene([plain]));
		if (!result.success) throw new Error('default frame refused');
		const entity = result.value.entities[0]!;
		expect(entity.kind === 'artwork' && 'frame' in entity).toBe(false);
		expect(JSON.stringify(result.value)).not.toContain('"frame"');
	});

	it.each([
		{ style: 'ornate', mat: false, color: 'black' },
		{ style: 'thin', mat: 'yes', color: 'black' },
		{ style: 'thin', mat: false, color: 'gold' },
		{ style: 'thin', mat: false, color: 'black', depth: 1 }
	])('refuses an invalid persisted frame %j', (frame) => {
		expect(validateCameraFreeScenePayload(scene([artwork({ frame: frame as never })])).success).toBe(false);
	});

	it('generates gallery, float, Mat-only and unframed geometry with one border table', () => {
		const plain = artworkFrameLayout(1, 0.5, undefined);
		expect(plain).toMatchObject({ outerWidth: 1, outerHeight: 0.5, depth: 0, borderMeters: 0 });
		expect(plain.rails).toHaveLength(0);
		expect(plain.mat).toBeNull();
		expect(plain.backing).toBeNull();

		const gallery = artworkFrameLayout(1, 0.5, GALLERY);
		expect(gallery.outerWidth).toBeCloseTo(1.24);
		expect(gallery.outerHeight).toBeCloseTo(0.74);
		expect(gallery.rails).toHaveLength(4);
		expect(gallery.rails[0]!.size).toEqual([1.24, 0.06, 0.04]);
		expect(gallery.mat?.width).toBeCloseTo(1.12);
		expect(gallery.backing?.width).toBeCloseTo(1.12);
		expect(gallery.frameColor).toBe('#8a6238');
		expect(gallery.matColor).toBe(ARTWORK_MAT_COLOR);

		const float = artworkFrameLayout(1, 0.5, { style: 'float', mat: false, color: 'ivory' });
		expect(float.outerWidth).toBeCloseTo(1.054);
		expect(float.mat).toBeNull();
		expect(float.backing?.width).toBeCloseTo(1.024);
		expect(float.backingColor).toBe(ARTWORK_FLOAT_BACKING_COLOR);

		const matOnly = artworkFrameLayout(1, 0.5, { style: 'none', mat: true, color: 'black' });
		expect(matOnly.outerWidth).toBeCloseTo(1.12);
		expect(matOnly.rails).toHaveLength(0);
		expect(matOnly.mat?.width).toBeCloseTo(1.12);
		expect(matOnly.backing?.width).toBeCloseTo(1.12);
		expect(matOnly.backingColor).toBe(ARTWORK_MAT_COLOR);
		expect(matOnly.frameColor).toBeNull();

		const second = artworkFrameLayout(2, 1, GALLERY);
		expect(second.outerWidth - second.imageWidth).toBeCloseTo(gallery.outerWidth - gallery.imageWidth);
	});

	it('puts resize grips on the outer edge and keeps the opposite image corner fixed', () => {
		const framed = artwork();
		const handle = artworkHandlePoint(framed, [1, 1]);
		const imageCorner = artworkCornerPoint(framed, [1, 1]);
		expect(handle.x - imageCorner.x).toBeCloseTo(0.12);
		expect(handle.y - imageCorner.y).toBeCloseTo(0.12);
		const target = handle.clone().add(new Vector3(0.2, 0.1, 0));
		const resized = resizeArtworkAtRay(framed, [1, 1], {
			origin: [target.x, target.y, 3], direction: [0, 0, -1]
		});
		expect(resized).not.toBeNull();
		expect(artworkHandlePoint(resized!, [1, 1]).distanceTo(target)).toBeLessThan(1e-6);
		expect(artworkCornerPoint(resized!, [-1, -1]).distanceTo(artworkCornerPoint(framed, [-1, -1]))).toBeLessThan(1e-6);
	});
});

describe('Artwork hanging guides', () => {
	it('offers the 1.50 m eye line, nearby parallel centres and a nearest-guide snap', () => {
		const candidate = artwork({ position: [0, 1.53, 0] });
		const neighbour = artwork({ id: 'artwork-2', name: 'Next print', position: [1.2, 1.8, 0] });
		const rotated = artwork({ id: 'artwork-3', position: [0.5, 1.8, 0], rotation: [0, Math.PI / 2, 0] });
		const guides = artworkHangingGuides({ entities: [candidate, neighbour, rotated] }, candidate, 0);
		expect(guides[0]).toMatchObject({ kind: 'eye', y: 1.5 });
		expect(guides.some((guide) => guide.subjectId === 'artwork-2')).toBe(true);
		expect(guides.some((guide) => guide.subjectId === 'artwork-3')).toBe(false);
		const snap = snapArtworkHeight(candidate.position, guides);
		expect(snap.position[1]).toBeCloseTo(1.5);
		expect(activeArtworkHangGuide(guides, snap.position[1])).toBe('artwork-eye-line');

		const neighbourOnly = guides.filter((guide) => guide.kind === 'neighbour');
		const snapped = snapArtworkHeight([0, 1.798, 0], neighbourOnly);
		expect(snapped.position[1]).toBeCloseTo(1.8);
		expect(snapped.guideId).toContain('artwork-neighbour-artwork-2');
	});

	it('excludes far and non-coplanar neighbours', () => {
		const candidate = artwork();
		const far = artwork({ id: 'artwork-far', position: [6, 1, 0] });
		const behind = artwork({ id: 'artwork-behind', position: [1, 1, 1] });
		const guides = artworkHangingGuides({ entities: [candidate, far, behind] }, candidate, 0);
		expect(guides).toHaveLength(1);
		expect(guides[0]!.kind).toBe('eye');
	});
});

async function acceptedCoordinator(entity: SceneArtworkEntity, shelf = [OLD_ENTRY]) {
	const { createUnitCoordinator, createUnitProject } = await import('../authoring/__fixtures__/unit-envelope-fixtures');
	const { createArtworkPlanners } = await import('@portfolio/project-model/scene-planning');
	const baseline = await createUnitProject({
		id: 'project:artwork-framing', name: 'Artwork framing', scene: scene([entity], shelf)
	});
	return createUnitCoordinator({ baseline, planners: createArtworkPlanners() });
}

describe('Artwork framing history and Replace image', () => {
	it('writes a frame as one reversible transform and duplicates it', async () => {
		const { ARTWORK_DUPLICATE, ARTWORK_TRANSFORM } = await import('@portfolio/project-model/scene-planning');
		const coordinator = await acceptedCoordinator(artwork());
		const sceneData = () => coordinator.current().source.units.scene;
		const target = () => ({
			version: 1 as const, domain: 'scene' as const,
			revision: { kind: 'exact' as const, contentRevision: sceneData().header.contentRevision },
			subject: { kind: 'entity' as const, id: 'artwork-1' }, instancePath: [],
			location: { kind: 'project-root' as const }, componentId: null, capabilityId: null
		});
		const changed = await coordinator.accept({
			version: 1, kind: ARTWORK_TRANSFORM, operationId: 'frame-op',
			expectedRevision: coordinator.acceptedRevision(),
			payload: { frame: { style: 'float', mat: false, color: 'ivory' } },
			targets: [target()], allocatedIds: [], capturedInputs: []
		});
		expect(changed.kind).toBe('accepted');
		const framed = sceneData().data.entities[0]!;
		expect(framed.kind === 'artwork' ? framed.frame : undefined).toEqual({ style: 'float', mat: false, color: 'ivory' });
		expect((await coordinator.undo()).kind).toBe('restored');
		expect(sceneData().data.entities[0]).toEqual(artwork());
		expect((await coordinator.redo()).kind).toBe('restored');

		const duplicate = await coordinator.accept({
			version: 1, kind: ARTWORK_DUPLICATE, operationId: 'frame-copy',
			expectedRevision: coordinator.acceptedRevision(), payload: {},
			targets: [target()], allocatedIds: [{ kind: 'scene-entity', id: 'artwork-copy' }], capturedInputs: []
		});
		expect(duplicate.kind).toBe('accepted');
		const copy = sceneData().data.entities.find((entity) => entity.id === 'artwork-copy')!;
		expect(copy.kind === 'artwork' ? copy.frame : undefined).toEqual({ style: 'float', mat: false, color: 'ivory' });
	});

	it('replaces the source in one reversible write, keeps identity/pose/frame and preserves a custom name', async () => {
		const { ARTWORK_REPLACE } = await import('@portfolio/project-model/scene-planning');
		const coordinator = await acceptedCoordinator(artwork());
		const sceneData = () => coordinator.current().source.units.scene;
		const result = await coordinator.accept({
			version: 1, kind: ARTWORK_REPLACE, operationId: 'replace-op',
			expectedRevision: coordinator.acceptedRevision(),
			payload: { entry: NEW_ENTRY },
			targets: [{
				version: 1, domain: 'scene',
				revision: { kind: 'exact', contentRevision: sceneData().header.contentRevision },
				subject: { kind: 'entity', id: 'artwork-1' }, instancePath: [],
				location: { kind: 'project-root' }, componentId: null, capabilityId: null
			}], allocatedIds: [], capturedInputs: []
		});
		expect(result.kind).toBe('accepted');
		const replaced = sceneData().data.entities[0]!;
		if (replaced.kind !== 'artwork') throw new Error('Expected Artwork');
		expect(replaced).toMatchObject({
			id: 'artwork-1', name: 'My print', position: [0, 1, 0], rotation: [0, 0, 0],
			widthMeters: 1, frame: GALLERY, source: { kind: 'image', ...NEW_IMAGE }
		});
		expect(sceneData().data.artworkLibrary).toEqual([OLD_ENTRY, NEW_ENTRY]);
		expect((await coordinator.undo()).kind).toBe('restored');
		expect(sceneData().data.entities[0]).toEqual(artwork());
		expect(sceneData().data.artworkLibrary).toEqual([OLD_ENTRY]);
		expect((await coordinator.redo()).kind).toBe('restored');
		const redone = sceneData().data.entities[0]!;
		expect(redone.kind === 'artwork' ? redone.source : null).toEqual({ kind: 'image', ...NEW_IMAGE });
	});

	it('refuses a same-image replacement as a no-change write', async () => {
		const { ARTWORK_REPLACE } = await import('@portfolio/project-model/scene-planning');
		const coordinator = await acceptedCoordinator(artwork());
		const sceneData = () => coordinator.current().source.units.scene;
		const result = await coordinator.accept({
			version: 1, kind: ARTWORK_REPLACE, operationId: 'replace-same',
			expectedRevision: coordinator.acceptedRevision(), payload: { entry: OLD_ENTRY },
			targets: [{
				version: 1, domain: 'scene',
				revision: { kind: 'exact', contentRevision: sceneData().header.contentRevision },
				subject: { kind: 'entity', id: 'artwork-1' }, instancePath: [],
				location: { kind: 'project-root' }, componentId: null, capabilityId: null
			}], allocatedIds: [], capturedInputs: []
		});
		expect(result.kind).toBe('rejected');
		expect(result.kind === 'rejected' ? result.reason : null).toBe('no-change');
	});

	it('adopts the new shelf name only when the old name was not custom, and clamps an illegal width', async () => {
		const { ARTWORK_REPLACE } = await import('@portfolio/project-model/scene-planning');
		const tall = { assetId: '00000000-0000-4000-8000-000000000003', pixelWidth: 1, pixelHeight: 2000, name: 'Tall image' };
		const coordinator = await acceptedCoordinator(artwork({ name: 'Old image' }));
		const sceneData = () => coordinator.current().source.units.scene;
		const result = await coordinator.accept({
			version: 1, kind: ARTWORK_REPLACE, operationId: 'replace-tall',
			expectedRevision: coordinator.acceptedRevision(), payload: { entry: tall },
			targets: [{
				version: 1, domain: 'scene',
				revision: { kind: 'exact', contentRevision: sceneData().header.contentRevision },
				subject: { kind: 'entity', id: 'artwork-1' }, instancePath: [],
				location: { kind: 'project-root' }, componentId: null, capabilityId: null
			}], allocatedIds: [], capturedInputs: []
		});
		expect(result.kind).toBe('accepted');
		const replaced = sceneData().data.entities[0]!;
		if (replaced.kind !== 'artwork') throw new Error('Expected Artwork');
		expect(replaced.name).toBe('Tall image');
		expect(replaced.widthMeters).toBeCloseTo(0.5);
		expect(replaced.frame).toEqual(GALLERY);
	});

	it('refuses a stale target and a mismatched existing shelf record', async () => {
		const { ARTWORK_REPLACE, ARTWORK_TRANSFORM } = await import('@portfolio/project-model/scene-planning');
		const coordinator = await acceptedCoordinator(artwork());
		const sceneData = () => coordinator.current().source.units.scene;
		const target = () => ({
			version: 1 as const, domain: 'scene' as const,
			revision: { kind: 'exact' as const, contentRevision: sceneData().header.contentRevision },
			subject: { kind: 'entity' as const, id: 'artwork-1' }, instancePath: [],
			location: { kind: 'project-root' as const }, componentId: null, capabilityId: null
		});
		const stale = target();
		const framed = await coordinator.accept({
			version: 1, kind: ARTWORK_TRANSFORM, operationId: 'advance-revision',
			expectedRevision: coordinator.acceptedRevision(),
			payload: { frame: { style: 'thin', mat: false, color: 'black' } },
			targets: [stale], allocatedIds: [], capturedInputs: []
		});
		expect(framed.kind).toBe('accepted');
		const refusedStale = await coordinator.accept({
			version: 1, kind: ARTWORK_REPLACE, operationId: 'replace-stale',
			expectedRevision: coordinator.acceptedRevision(), payload: { entry: NEW_ENTRY },
			targets: [stale], allocatedIds: [], capturedInputs: []
		});
		expect(refusedStale.kind).toBe('rejected');
		const mismatchedEntry = { ...OLD_IMAGE, pixelWidth: 3, pixelHeight: 1, name: 'Mismatched record' };
		const refusedMismatch = await coordinator.accept({
			version: 1, kind: ARTWORK_REPLACE, operationId: 'replace-mismatch',
			expectedRevision: coordinator.acceptedRevision(), payload: { entry: mismatchedEntry },
			targets: [target()], allocatedIds: [], capturedInputs: []
		});
		expect(refusedMismatch.kind).toBe('rejected');
		expect(sceneData().data.artworkLibrary).toEqual([OLD_ENTRY]);
	});
});
