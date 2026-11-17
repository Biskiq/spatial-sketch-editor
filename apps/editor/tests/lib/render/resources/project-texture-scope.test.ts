/**
 * T2.S4b — the authenticated project texture scope.
 *
 * A Finish image is creator bytes, so the scope loads it through the API,
 * verifies the Scene's pinned sha256/MIME/size before decoding, and revokes its
 * object URL. These tests pin the refusals as well as the happy path.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('three', async () => {
	const actual = await vi.importActual<typeof import('three')>('three');
	class MockTextureLoader {
		async loadAsync(url: string) {
			return {
				uuid: `texture:${url}`,
				image: { complete: true, naturalWidth: 1, naturalHeight: 1 },
				needsUpdate: false,
				colorSpace: '',
				wrapS: 0,
				wrapT: 0,
				repeat: { set() {}, x: 1, y: 1 },
				rotation: 0,
				center: { set() {} },
				dispose: vi.fn()
			};
		}
	}
	return { ...actual, TextureLoader: MockTextureLoader };
});

import { createProjectTextureScope, type ProjectTexturePin } from '$lib/render/resources/project-texture-scope';
import {
	loadSourceTexture,
	resetTextureCachesForTests
} from '$lib/render/resources/texture-store';
import { imageSha256 } from '$lib/render/artwork/image-digest';

const PNG = Uint8Array.from(
	atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='),
	(char) => char.charCodeAt(0)
);
const ASSET = '00000000-0000-4000-8000-0000000000aa';
const URI = `/project-assets/${ASSET}`;
const FAILURE_URI = '/textures/broken.png';

let digest = '';
let pins: Map<string, ProjectTexturePin>;
let loadedBytes: Uint8Array;
let loadedMime: 'image/png' | 'image/jpeg' | 'image/webp';
let onFailure: ReturnType<typeof vi.fn>;
let onSuccess: ReturnType<typeof vi.fn>;

function scope() {
	return createProjectTextureScope({
		scopeId: 'project:finish-test',
		load: async () => ({ bytes: loadedBytes, mime: loadedMime }),
		pins: () => pins,
		onFailure,
		onSuccess
	});
}

beforeEach(async () => {
	resetTextureCachesForTests();
	digest = `sha256-${await imageSha256(PNG)}`;
	pins = new Map([[ASSET, { hash: digest, mime: 'image/png', size: PNG.length }]]);
	loadedBytes = PNG;
	loadedMime = 'image/png';
	onFailure = vi.fn();
	onSuccess = vi.fn();
});

describe('project texture scope', () => {
	it('verifies the pinned bytes, records the decoded size and revokes the object URL', async () => {
		const revoke = vi.spyOn(URL, 'revokeObjectURL');
		const texture = await scope().loader(URI, 'map');
		expect(texture.uuid).toMatch(/^texture:blob:/);
		expect(onSuccess).toHaveBeenCalledWith(URI);
		expect(onFailure).not.toHaveBeenCalled();
		expect(revoke).toHaveBeenCalledTimes(1);
		expect(revoke.mock.calls[0]![0]).toMatch(/^blob:/);

		const product = scope();
		await product.loader(URI, 'map');
		expect(product.dimensionsOf(ASSET)).toEqual({ width: 1, height: 1 });
		expect(product.aspectOf(ASSET)).toBe(1);
		// CSS previews need a URL the editor origin can actually read; the
		// authenticated Scene URI itself would 404 there.
		const preview = product.previewUriOf(ASSET);
		expect(preview).toMatch(/^blob:/);
		expect(product.previewUriOf('missing')).toBeNull();
		const revokePreview = vi.spyOn(URL, 'revokeObjectURL');
		product.dispose();
		expect(revokePreview).toHaveBeenCalledWith(preview);
		expect(product.dimensionsOf('missing')).toBeNull();
		expect(product.aspectOf('missing')).toBeNull();
	});

	it('refuses changed bytes, a changed MIME and a changed size before decoding', async () => {
		const changed = scope();
		pins.set(ASSET, { hash: `sha256-${'0'.repeat(64)}`, mime: 'image/png', size: PNG.length });
		await expect(changed.loader(URI, 'map')).rejects.toThrow('do not match the saved project');
		expect(onFailure).toHaveBeenCalledWith(URI, 'The image bytes do not match the saved project.');

		loadedMime = 'image/jpeg';
		await expect(scope().loader(URI, 'map')).rejects.toThrow('do not match the saved project');

		loadedMime = 'image/png';
		pins.set(ASSET, { hash: digest, mime: 'image/png', size: PNG.length + 1 });
		await expect(scope().loader(URI, 'map')).rejects.toThrow('do not match the saved project');
	});

	it('refuses an unpinned project URI without asking the API for bytes', async () => {
		const load = vi.fn(async () => ({ bytes: PNG, mime: 'image/png' as const }));
		const unpinned = createProjectTextureScope({
			scopeId: 'project:unpinned',
			load,
			pins: () => new Map()
		});
		await expect(unpinned.loader(URI, 'map')).rejects.toThrow('not registered in this project');
		expect(load).not.toHaveBeenCalled();
	});

	it('passes catalogue URIs to the static texture loader', async () => {
		const product = scope();
		const texture = await product.loader('/textures/plaster.png', 'map');
		expect(texture.uuid).toBe('texture:/textures/plaster.png');
		expect(product.dimensionsOf(ASSET)).toBeNull();
	});

	it('retry drops the cached failure and prepares only that URI again', async () => {
		const product = scope();
		pins.set(ASSET, { hash: `sha256-${'0'.repeat(64)}`, mime: 'image/png', size: PNG.length });
		await product.prepare([URI]);
		await expect(loadSourceTexture(URI, 'map', product)).rejects.toThrow('Failed to load texture');
		expect(onFailure).toHaveBeenCalledTimes(1);

		pins.set(ASSET, { hash: digest, mime: 'image/png', size: PNG.length });
		product.retry(URI);
		await expect(loadSourceTexture(URI, 'map', product)).resolves.toBeTruthy();
		expect(product.dimensionsOf(ASSET)).toEqual({ width: 1, height: 1 });
	});

	it('re-prepares when the pin changes under the same URI', async () => {
		const product = scope();
		await product.prepare([URI]);
		expect(onSuccess).toHaveBeenCalledTimes(1);

		pins.set(ASSET, { hash: `sha256-${'0'.repeat(64)}`, mime: 'image/png', size: PNG.length });
		await product.prepare([URI]);
		expect(onFailure).toHaveBeenCalledWith(URI, 'The image bytes do not match the saved project.');
	});

	it('drops cached failures on dispose so the next scope with the same id loads again', async () => {
		let calls = 0;
		const load = vi.fn(async () => {
			calls += 1;
			return calls === 1
				? { bytes: Uint8Array.from([1, 2]), mime: 'image/png' as const }
				: { bytes: PNG, mime: 'image/png' as const };
		});
		const first = createProjectTextureScope({
			scopeId: 'project:reused-id',
			load,
			pins: () => pins,
			onFailure
		});
		await first.prepare([URI]);
		expect(onFailure).toHaveBeenCalledTimes(1);
		first.dispose();

		const second = createProjectTextureScope({
			scopeId: 'project:reused-id',
			load,
			pins: () => pins,
			onSuccess
		});
		await second.prepare([URI]);
		expect(load).toHaveBeenCalledTimes(2);
		expect(onSuccess).toHaveBeenCalledWith(URI);
		expect(second.dimensionsOf(ASSET)).toEqual({ width: 1, height: 1 });
		second.dispose();
	});

	it('does not let a late failure poison a retried load', async () => {
		let finishFirst!: (value: { bytes: Uint8Array; mime: 'image/png' }) => void;
		let calls = 0;
		const load = vi.fn(() => {
			calls += 1;
			if (calls === 1) return new Promise<{ bytes: Uint8Array; mime: 'image/png' }>((resolve) => (finishFirst = resolve));
			return Promise.resolve({ bytes: PNG, mime: 'image/png' as const });
		});
		const product = createProjectTextureScope({
			scopeId: 'project:late-failure',
			load,
			pins: () => pins,
			onFailure,
			onSuccess
		});
		const first = product.prepare([URI]);
		await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
		product.retry(URI);
		await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));

		finishFirst({ bytes: Uint8Array.from([1, 2]), mime: 'image/png' });
		await first;
		await Promise.resolve();
		expect(onFailure).not.toHaveBeenCalled();
		await expect(loadSourceTexture(URI, 'map', product)).resolves.toBeTruthy();
		expect(product.dimensionsOf(ASSET)).toEqual({ width: 1, height: 1 });
		product.dispose();
	});

	it('dispose aborts loads and drops loaded textures and dimensions', async () => {
		const product = scope();
		const texture = await loadSourceTexture(URI, 'map', product);
		const dispose = vi.spyOn(texture as unknown as { dispose: () => void }, 'dispose');
		product.dispose();
		expect(dispose).toHaveBeenCalledTimes(1);
		expect(product.dimensionsOf(ASSET)).toBeNull();
		// A disposed scope refuses to hand out a live texture.
		const late = createProjectTextureScope({
			scopeId: 'project:disposed',
			load: async () => ({ bytes: PNG, mime: 'image/png' }),
			pins: () => pins
		});
		late.dispose();
		await expect(late.loader(URI, 'map')).rejects.toThrow(/aborted|closed/);
	});
});
