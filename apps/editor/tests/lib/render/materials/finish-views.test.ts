import { afterEach, describe, expect, it } from 'vitest';
import { NoColorSpace, SRGBColorSpace, Texture } from 'three';
import { rgba8MipChainBytes } from '@portfolio/project-model/materials';
import {
	acquireFinishViews,
	DEFAULT_FINISH_VIEW_BUDGET_BYTES,
	finishViewStats,
	resetFinishViewsForTests,
	setFinishViewBudget,
	setFinishViewGeneration
} from '$lib/render/resources/finish-views';
import {
	__resetDefaultSourceLoaderForTests,
	resetTextureCachesForTests,
	setDefaultTextureSourceLoader
} from '$lib/render/resources/texture-store';

const SIZE = 64;
const BYTES = rgba8MipChainBytes(SIZE, SIZE);

function imageTexture(): Texture {
	const texture = new Texture();
	(texture as unknown as { image: { width: number; height: number } }).image = {
		width: SIZE,
		height: SIZE
	};
	return texture;
}

afterEach(() => {
	resetTextureCachesForTests();
	resetFinishViewsForTests();
	__resetDefaultSourceLoaderForTests();
});

describe('finish view leases', () => {
	it('decodes colour and data roles under their own policy and uploads top-first', async () => {
		setDefaultTextureSourceLoader(async () => imageTexture());
		const lease = await acquireFinishViews(
			[
				{ view: 'colour|srgb', uri: '/shared.png', role: 'color' },
				{ view: 'rough|raw', uri: '/shared.png', role: 'roughness' }
			],
			null
		);

		expect(lease.issues).toEqual([]);
		expect(lease.views['colour|srgb'].colorSpace).toBe(SRGBColorSpace);
		expect(lease.views['rough|raw'].colorSpace).toBe(NoColorSpace);
		expect(lease.views['colour|srgb'].flipY).toBe(false);
		expect(lease.views['rough|raw'].flipY).toBe(false);
		expect(finishViewStats()).toMatchObject({ live: 2, created: 2, bytes: BYTES * 2 });

		lease.release();
		expect(finishViewStats().live).toBe(0);
	});

	it('shares one logical view between two callers and releases by reference count', async () => {
		setDefaultTextureSourceLoader(async () => imageTexture());
		const source = [{ view: 'colour', uri: '/one.png', role: 'color' as const }];
		const first = await acquireFinishViews(source, null);
		const second = await acquireFinishViews(source, null);
		expect(first.views.colour).toBe(second.views.colour);
		expect(finishViewStats()).toMatchObject({ live: 1, created: 1, bytes: BYTES });

		first.release();
		expect(finishViewStats().live).toBe(1);
		second.release();
		expect(finishViewStats().live).toBe(0);
	});

	it('joins the same view installed by a concurrent acquisition instead of replacing its lease', async () => {
		setDefaultTextureSourceLoader(async () => imageTexture());
		const source = [{ view: 'colour', uri: '/same.png', role: 'color' as const }];
		const [first, second] = await Promise.all([
			acquireFinishViews(source, null),
			acquireFinishViews(source, null)
		]);

		expect(first.views.colour).toBe(second.views.colour);
		expect(finishViewStats()).toMatchObject({ live: 1, created: 1 });
		first.release();
		expect(finishViewStats().live).toBe(1);
		second.release();
		expect(finishViewStats().live).toBe(0);
	});

	it('does not share one view key across texture scopes', async () => {
		const firstTexture = imageTexture();
		const secondTexture = imageTexture();
		const first = await acquireFinishViews(
			[{ view: 'colour', uri: '/same.png', role: 'color' }],
			{ scopeId: 'project:first', loader: async () => firstTexture }
		);
		const second = await acquireFinishViews(
			[{ view: 'colour', uri: '/same.png', role: 'color' }],
			{ scopeId: 'project:second', loader: async () => secondTexture }
		);

		expect(first.views.colour).not.toBe(second.views.colour);
		expect(finishViewStats()).toMatchObject({ live: 2, created: 2 });
		first.release();
		second.release();
	});

	it('refuses the whole set without a partial lease when the budget cannot fit it', async () => {
		setDefaultTextureSourceLoader(async () => imageTexture());
		setFinishViewBudget(BYTES * 2 - 1);
		const lease = await acquireFinishViews(
			[
				{ view: 'a', uri: '/a.png', role: 'color' },
				{ view: 'b', uri: '/b.png', role: 'color' }
			],
			null
		);

		expect(lease.views).toEqual({});
		expect(lease.issues[0]).toMatchObject({
			code: 'texture-budget',
			required: BYTES * 2,
			available: BYTES * 2 - 1
		});
		expect(finishViewStats()).toMatchObject({ live: 0, refused: 1 });
		lease.release();
	});

	it('honours an already-aborted signal without loading', async () => {
		let loads = 0;
		setDefaultTextureSourceLoader(async () => {
			loads += 1;
			return imageTexture();
		});
		const controller = new AbortController();
		controller.abort();
		const lease = await acquireFinishViews(
			[{ view: 'colour', uri: '/cancelled.png', role: 'color' }],
			null,
			controller.signal
		);
		expect(lease.views).toEqual({});
		expect(lease.issues[0]?.code).toBe('cancelled');
		expect(loads).toBe(0);
	});

	it('refuses a completion that started before a generation change', async () => {
		let resolve: ((texture: Texture) => void) | undefined;
		setDefaultTextureSourceLoader(
			() =>
				new Promise<Texture>((settle) => {
					resolve = settle;
				})
		);
		const pending = acquireFinishViews([{ view: 'colour', uri: '/slow.png', role: 'color' }], null);
		await new Promise((wait) => setTimeout(wait, 0));
		setFinishViewGeneration(finishViewStats().generation + 1);
		resolve?.(imageTexture());
		const lease = await pending;

		expect(lease.views).toEqual({});
		expect(lease.issues[0]?.code).toBe('generation-mismatch');
		expect(finishViewStats()).toMatchObject({ live: 0, generation: 1 });
	});
});

describe('the default budget', () => {
	it('is the v1 256 MiB ceiling', () => {
		expect(DEFAULT_FINISH_VIEW_BUDGET_BYTES).toBe(256 * 1024 * 1024);
	});
});
