import { afterEach, describe, expect, it } from 'vitest';
import { Texture } from 'three';
import { acquireFinishViews, releaseFinishViewsForScope, resetFinishViewsForTests } from '$lib/render/resources/finish-views';
import {
	acquireEffectiveVariant,
	decodedImageStats,
	invalidateTextureSource,
	loadEffectiveTextures,
	loadFinishTexture,
	releaseTextureScope,
	resetTextureCachesForTests,
	retainDecodedImage
} from '$lib/render/resources/texture-store';

/** A stand-in for a decoded `ImageBitmap`: closable, sized, counts closes. */
function bitmap(size = 64): { width: number; height: number; closes: number; close(): void } {
	return {
		width: size,
		height: size,
		closes: 0,
		close() {
			this.closes += 1;
		}
	};
}

function bitmapTexture(image = bitmap()): Texture {
	return new Texture(image as unknown as ImageBitmap);
}

function imageOf(texture: Texture): ReturnType<typeof bitmap> {
	return texture.image as unknown as ReturnType<typeof bitmap>;
}

afterEach(() => {
	resetTextureCachesForTests();
	resetFinishViewsForTests();
});

describe('decoded bitmaps close after their final owner', () => {
	it('closes once, on the last owning texture, however often each is disposed', () => {
		const source = bitmapTexture();
		const clone = source.clone();
		retainDecodedImage(source);
		retainDecodedImage(clone);
		retainDecodedImage(clone);
		expect(decodedImageStats()).toEqual({ open: 1, closed: 0 });

		source.dispose();
		source.dispose();
		expect(imageOf(source).closes).toBe(0);
		clone.dispose();
		clone.dispose();
		expect(imageOf(source).closes).toBe(1);
		expect(decodedImageStats()).toEqual({ open: 0, closed: 1 });
	});

	it('leaves a non-closable image (legacy <img>) alone', () => {
		const texture = new Texture({ width: 4, height: 4 } as unknown as HTMLImageElement);
		retainDecodedImage(texture);
		texture.dispose();
		expect(decodedImageStats()).toEqual({ open: 0, closed: 0 });
	});

	it('keeps the bitmap open for a live variant after its source is invalidated', async () => {
		const scope = { scopeId: 'project:variants', loader: async () => bitmapTexture() };
		const effective = { variantSeed: 'seed', slotUris: { map: '/colour.png' } } as const;
		const loaded = await loadEffectiveTextures(effective as never, scope);
		expect(loaded.status).toBe('ready');
		const maps = acquireEffectiveVariant(effective as never, 2, 2, 0, scope);
		const image = imageOf(maps.map!);
		expect(decodedImageStats().open).toBe(1);

		// The source is dropped (Retry / replaced pin); the variant still draws and
		// may still need to upload, so its bitmap must stay open.
		invalidateTextureSource(scope.scopeId, '/colour.png');
		expect(image.closes).toBe(0);

		// Scope teardown disposes the variant: now the final owner is gone.
		releaseTextureScope(scope.scopeId);
		expect(image.closes).toBe(1);
		expect(decodedImageStats().open).toBe(0);
	});

	it('closes the bitmap of a load that completes after its scope tore down', async () => {
		let resolve!: (texture: Texture) => void;
		const late = bitmapTexture();
		const scope = {
			scopeId: 'project:late',
			loader: () => new Promise<Texture>((done) => (resolve = done))
		};
		const pending = loadFinishTexture('/late.png', 'color', scope).catch(() => null);
		releaseTextureScope(scope.scopeId);
		resolve(late);
		expect(await pending).toBeNull();
		expect(imageOf(late).closes).toBe(1);
		expect(decodedImageStats().open).toBe(0);
	});

	it('closes a leased Finish view bitmap only at its final release after product teardown', async () => {
		const leased = bitmapTexture();
		const idle = bitmapTexture();
		const scope = {
			scopeId: 'project:teardown',
			loader: async (uri: string) => (uri === '/leased.png' ? leased : idle)
		};
		const lease = await acquireFinishViews([{ view: 'colour', uri: '/leased.png', role: 'color' }], scope);
		const other = await acquireFinishViews([{ view: 'rough', uri: '/idle.png', role: 'roughness' }], scope);
		other.release();
		expect(decodedImageStats().open).toBe(2);

		releaseFinishViewsForScope(scope.scopeId);
		releaseTextureScope(scope.scopeId);
		expect(imageOf(idle).closes).toBe(1);
		expect(imageOf(leased).closes).toBe(0);
		expect(decodedImageStats().open).toBe(1);

		lease.release();
		lease.release();
		expect(imageOf(leased).closes).toBe(1);
		expect(decodedImageStats()).toEqual({ open: 0, closed: 2 });
	});
});
