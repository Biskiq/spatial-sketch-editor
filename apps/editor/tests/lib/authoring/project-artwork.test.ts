import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/render/artwork/artwork-decode', () => ({ verifyArtworkDecode: vi.fn(async () => {}) }));

import { verifyArtworkLibrary } from '$lib/authoring/artwork/project-artwork';
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
		formatVersion: 7,
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
