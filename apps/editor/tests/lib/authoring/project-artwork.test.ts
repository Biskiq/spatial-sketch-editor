import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/render/artwork/artwork-decode', () => ({ verifyArtworkDecode: vi.fn(async () => {}) }));

import {
	FINISH_IMAGE_POLICY,
	importProjectImage,
	verifyArtworkLibrary
} from '$lib/authoring/artwork/project-artwork';
import { finishImageLabel, finishImageWarning } from '$lib/authoring/look/finish-image.svelte';
import { verifyArtworkDecode } from '$lib/render/artwork/artwork-decode';
import { imageSha256 } from '$lib/render/artwork/image-digest';
import type { ProjectApi, ProjectAssetMetadata } from '$lib/platform/project-persistence';
import type { CameraFreeSceneDocument } from '@portfolio/project-model/units';

const PNG = Uint8Array.from(
	atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='),
	(char) => char.charCodeAt(0)
);
const PLACED = '00000000-0000-4000-8000-000000000001';
const UNPLACED = '00000000-0000-4000-8000-000000000002';
const image = { pixelWidth: 1, pixelHeight: 1 };

function row(assetId: string, sha256: string): ProjectAssetMetadata {
	return {
		id: assetId,
		projectId: 'project',
		name: assetId,
		kind: 'texture',
		storageKind: 'r2',
		sourceKind: 'upload',
		sourceRef: null,
		mime: 'image/png',
		byteSize: PNG.length,
		sha256,
		importState: 'ready',
		createdAt: '2026-11-11T00:00:00.000Z',
		updatedAt: '2026-11-11T00:00:00.000Z'
	};
}

function scene(): CameraFreeSceneDocument {
	return {
		formatVersion: 9,
		textures: [],
		materials: [],
		artworkLibrary: [
			{ assetId: PLACED, name: 'Placed', ...image },
			{ assetId: UNPLACED, name: 'Shelf only', ...image }
		],
		entities: [{
			kind: 'artwork', id: 'artwork-1', name: 'Placed', position: [0, 1, 0],
			rotation: [0, 0, 0], widthMeters: 1, source: { kind: 'image', assetId: PLACED, ...image }
		}]
	};
}

function api(rows: ProjectAssetMetadata[]) {
	const loadAssetContent = vi.fn(async (_projectId: string, _assetId: string) => ({
		bytes: PNG,
		mime: 'image/png' as const
	}));
	const listAssets = vi.fn(async () => rows);
	return {
		api: { listAssets, loadAssetContent } as unknown as ProjectApi,
		listAssets,
		loadAssetContent
	};
}

describe('Artwork reopen verification', () => {
	beforeEach(() => vi.clearAllMocks());

	it('hashes every shelf entry and decodes only a placed image', async () => {
		const digest = `sha256-${await imageSha256(PNG)}`;
		const harness = api([row(PLACED, digest), row(UNPLACED, digest)]);
		const signal = new AbortController().signal;
		await verifyArtworkLibrary(harness.api, 'project', scene(), signal);
		expect(harness.listAssets).toHaveBeenCalledTimes(1);
		expect(harness.loadAssetContent).toHaveBeenCalledTimes(2);
		expect(vi.mocked(verifyArtworkDecode)).toHaveBeenCalledTimes(1);
		expect(vi.mocked(verifyArtworkDecode)).toHaveBeenCalledWith(
			PNG,
			'image/png',
			expect.objectContaining({ assetId: PLACED, ...image })
		);
	});

	it('refuses changed unplaced bytes without decoding them', async () => {
		const digest = `sha256-${await imageSha256(PNG)}`;
		const harness = api([row(PLACED, `sha256-${'0'.repeat(64)}`), row(UNPLACED, digest)]);
		await expect(
			verifyArtworkLibrary(harness.api, 'project', { ...scene(), entities: [] }, new AbortController().signal)
		).rejects.toThrow('do not match the saved project');
		expect(harness.loadAssetContent).toHaveBeenCalledTimes(1);
		expect(vi.mocked(verifyArtworkDecode)).not.toHaveBeenCalled();
	});
});

describe('Finish images through the shared project importer (D3)', () => {
	const digest = async () => `sha256-${await imageSha256(PNG)}`;

	function importHarness() {
		let rows: ProjectAssetMetadata[] = [];
		const listAssets = vi.fn(async () => rows);
		const registerAsset = vi.fn(async (_projectId: string, _name: string, _signal?: AbortSignal) => row('imported-finish', await digest()));
		const uploadAsset = vi.fn(async (_projectId: string, assetId: string, _bytes: Uint8Array, _signal?: AbortSignal) => {
			const uploaded = { ...row(assetId, await digest()), name: 'Brick wall.png' };
			rows = [uploaded];
			return uploaded;
		});
		const api = {
			listAssets,
			registerAsset,
			uploadAsset,
			loadAssetContent: vi.fn(async () => ({ bytes: PNG, mime: 'image/png' as const }))
		} as unknown as ProjectApi;
		return { api, listAssets, registerAsset, uploadAsset };
	}

	function file(name = 'Brick wall.png'): File {
		return new File([PNG], name, { type: 'image/png' });
	}

	it('imports once, then reuses the same bytes without a second upload', async () => {
		const harness = importHarness();
		const signal = new AbortController().signal;
		const first = await importProjectImage(harness.api, 'project', file(), signal, FINISH_IMAGE_POLICY);
		expect(first).toMatchObject({
			assetId: 'imported-finish',
			name: 'Brick wall.png',
			pixelWidth: 1,
			pixelHeight: 1,
			mime: 'image/png',
			byteSize: PNG.length
		});
		expect(harness.registerAsset).toHaveBeenCalledTimes(1);
		expect(harness.uploadAsset).toHaveBeenCalledTimes(1);

		const second = await importProjectImage(harness.api, 'project', file(), signal, FINISH_IMAGE_POLICY);
		expect(second.assetId).toBe(first.assetId);
		expect(second.sha256).toBe(first.sha256);
		expect(harness.registerAsset).toHaveBeenCalledTimes(1);
		expect(harness.uploadAsset).toHaveBeenCalledTimes(1);
		expect(vi.mocked(verifyArtworkDecode)).toHaveBeenCalledTimes(2);
	});

	it('refuses past the Artwork byte cap before reading the file', async () => {
		const harness = importHarness();
		const oversized = {
			name: 'Huge.png',
			size: FINISH_IMAGE_POLICY.maxBytes + 1,
			arrayBuffer: vi.fn(async () => PNG.buffer)
		} as unknown as File;
		await expect(
			importProjectImage(harness.api, 'project', oversized, new AbortController().signal, FINISH_IMAGE_POLICY)
		).rejects.toThrow('Finish images must be 25 MiB or smaller.');
		expect(oversized.arrayBuffer).not.toHaveBeenCalled();
		expect(harness.listAssets).not.toHaveBeenCalled();
	});

	it('names the policy in a probe refusal and never downscales', async () => {
		const harness = importHarness();
		const notAnImage = new File([new Uint8Array([1, 2, 3])], 'notes.png', { type: 'image/png' });
		await expect(
			importProjectImage(harness.api, 'project', notAnImage, new AbortController().signal, FINISH_IMAGE_POLICY)
		).rejects.toThrow('Finish requires');
		// The successful import above already proved 1 × 1 stays 1 × 1; the
		// warning states the consequence rather than resizing.
		expect(finishImageWarning(1, 1)).toContain('Low resolution');
		expect(finishImageWarning(256, 256)).toBeNull();
		expect(finishImageLabel('Brick wall.png')).toBe('Brick wall');
		expect(finishImageLabel('.png')).toBe('Image');
	});
});
