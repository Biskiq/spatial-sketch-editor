import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoColorSpace, SRGBColorSpace, Texture } from 'three';
import { rgba8MipChainBytes } from '@portfolio/project-model/materials';
import {
	acquireFinishViews,
	DEFAULT_FINISH_VIEW_BUDGET_BYTES,
	finishViewStats,
	releaseFinishViewsForScope,
	resetFinishViewsForTests,
	setFinishViewBudget,
	setFinishViewGeneration,
	type FinishViewGeneration
} from '$lib/render/resources/finish-views';
import {
	__resetDefaultSourceLoaderForTests,
	releaseTextureScope,
	resetTextureCachesForTests,
	setDefaultTextureSourceLoader,
	textureSourceMemoryStats
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
		// The upload stays charged until eviction, so a released working set cannot
		// quietly stop counting while its texture is still resident.
		expect(finishViewStats().bytes).toBe(BYTES * 2);
	});

	it('reuses a released view without a second upload', async () => {
		setDefaultTextureSourceLoader(async () => imageTexture());
		const source = [{ view: 'colour', uri: '/one.png', role: 'color' as const }];
		const first = await acquireFinishViews(source, null);
		const texture = first.views.colour;
		first.release();
		const second = await acquireFinishViews(source, null);
		expect(second.views.colour).toBe(texture);
		expect(finishViewStats()).toMatchObject({ live: 1, created: 1 });
		second.release();
	});

	it('evicts the oldest unleased view and disposes its upload under budget pressure', async () => {
		let call = 0;
		const textures: Texture[] = [];
		setDefaultTextureSourceLoader(async () => {
			call += 1;
			const texture = imageTexture();
			textures.push(texture);
			return texture;
		});
		setFinishViewBudget(BYTES + 1);
		const first = await acquireFinishViews([{ view: 'a', uri: '/a.png', role: 'color' }], null);
		const firstTexture = first.views.a;
		const dispose = vi.spyOn(firstTexture, 'dispose');
		first.release();

		const second = await acquireFinishViews([{ view: 'b', uri: '/b.png', role: 'color' }], null);
		expect(second.issues).toEqual([]);
		expect(dispose).toHaveBeenCalledTimes(1);
		expect(finishViewStats()).toMatchObject({ live: 1, created: 2, bytes: BYTES });
		expect(call).toBe(2);
		second.release();
	});

	it('keeps an old generation release from touching a new generation entry', async () => {
		setDefaultTextureSourceLoader(async () => imageTexture());
		const source = [{ view: 'colour', uri: '/one.png', role: 'color' as const }];
		const oldToken: FinishViewGeneration = { owner: 'canvas-a', generation: 0 };
		const old = await acquireFinishViews(source, null, undefined, oldToken);
		setFinishViewGeneration('canvas-a', 1);
		const next = await acquireFinishViews(source, null, undefined, { owner: 'canvas-a', generation: 1 });
		// The source cache may hand back the same decoded texture under a new
		// generation entry; the lease counts are what must stay isolated.
		expect(next.views.colour).toBeTruthy();
		expect(finishViewStats().live).toBe(2);

		old.release();
		// The old lease releases its own entry; the new generation stays leased.
		expect(finishViewStats().live).toBe(1);
		next.release();
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
		const textures: { texture: Texture; dispose: ReturnType<typeof vi.spyOn> }[] = [];
		setDefaultTextureSourceLoader(async () => {
			const texture = imageTexture();
			textures.push({ texture, dispose: vi.spyOn(texture, 'dispose') });
			return texture;
		});
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
		// A refused set must not leave its decoded uploads behind: neither in the
		// source cache nor on the GPU.
		expect(textures).toHaveLength(2);
		for (const { dispose } of textures) expect(dispose).toHaveBeenCalledTimes(1);
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
		const token: FinishViewGeneration = { owner: 'canvas-a', generation: 0 };
		const pending = acquireFinishViews(
			[{ view: 'colour', uri: '/slow.png', role: 'color' }],
			null,
			undefined,
			token
		);
		await new Promise((wait) => setTimeout(wait, 0));
		setFinishViewGeneration('canvas-a', 1);
		resolve?.(imageTexture());
		const lease = await pending;

		expect(lease.views).toEqual({});
		expect(lease.issues[0]?.code).toBe('generation-mismatch');
		expect(finishViewStats()).toMatchObject({ live: 0, generations: { 'canvas-a': 1 } });
	});

	it('rejects a stale token before loading or leasing anything', async () => {
		let loads = 0;
		setDefaultTextureSourceLoader(async () => {
			loads += 1;
			return imageTexture();
		});
		setFinishViewGeneration('canvas-a', 1);
		const lease = await acquireFinishViews(
			[{ view: 'colour', uri: '/stale.png', role: 'color' }],
			null,
			undefined,
			{ owner: 'canvas-a', generation: 0 }
		);

		expect(lease.views).toEqual({});
		expect(lease.issues[0]).toMatchObject({ code: 'generation-mismatch' });
		expect(loads).toBe(0);
		expect(finishViewStats()).toMatchObject({
			live: 0,
			created: 0,
			generations: { 'canvas-a': 1 }
		});
	});

	it('does not refuse one Canvas when another Canvas recovers', async () => {
		let resolve: ((texture: Texture) => void) | undefined;
		setDefaultTextureSourceLoader(
			() =>
				new Promise<Texture>((settle) => {
					resolve = settle;
				})
		);
		const pending = acquireFinishViews(
			[{ view: 'colour', uri: '/canvas-a.png', role: 'color' }],
			null,
			undefined,
			{ owner: 'canvas-a', generation: 0 }
		);
		await new Promise((wait) => setTimeout(wait, 0));
		setFinishViewGeneration('canvas-b', 7);
		resolve?.(imageTexture());
		const lease = await pending;

		expect(lease.issues).toEqual([]);
		expect(lease.views.colour).toBeTruthy();
		lease.release();
	});

	it('releases a scope teardown immediately once no lease remains', async () => {
		const texture = imageTexture();
		const dispose = vi.spyOn(texture, 'dispose');
		const scope = { scopeId: 'project:teardown', loader: async () => texture };
		const lease = await acquireFinishViews(
			[{ view: 'colour', uri: '/teardown.png', role: 'color' }],
			scope
		);
		expect(finishViewStats().bytes).toBe(BYTES);
		lease.release();
		releaseFinishViewsForScope(scope.scopeId);
		expect(dispose).toHaveBeenCalledTimes(1);
		expect(finishViewStats()).toMatchObject({ live: 0, bytes: 0 });
	});

	it('retires a still-leased view at teardown and disposes it on release', async () => {
		const texture = imageTexture();
		const dispose = vi.spyOn(texture, 'dispose');
		const scope = { scopeId: 'project:teardown-leased', loader: async () => texture };
		const lease = await acquireFinishViews(
			[{ view: 'colour', uri: '/leased.png', role: 'color' }],
			scope
		);
		releaseFinishViewsForScope(scope.scopeId);
		expect(dispose).not.toHaveBeenCalled();
		expect(finishViewStats()).toMatchObject({ live: 1, bytes: BYTES });
		lease.release();
		expect(dispose).toHaveBeenCalledTimes(1);
		expect(finishViewStats()).toMatchObject({ live: 0, bytes: 0 });
	});

	it('evicts an unscoped view through the source cache, so a re-acquire never gets a disposed texture', async () => {
		// An editor-global (null-scope) acquisition is keyed without a scope prefix
		// in the source cache. Eviction must remove that exact key: disposing the
		// texture while the cache still holds it would hand the disposed texture
		// back to the next acquisition of the same image.
		const made: Texture[] = [];
		setDefaultTextureSourceLoader(async () => {
			const texture = imageTexture();
			made.push(texture);
			return texture;
		});
		setFinishViewBudget(BYTES);
		const first = await acquireFinishViews([{ view: 'a', uri: '/a.png', role: 'color' }], null);
		first.release();
		const other = await acquireFinishViews([{ view: 'b', uri: '/b.png', role: 'color' }], null);
		other.release();
		// `a` was evicted for `b`: its source key is gone with it.
		expect(textureSourceMemoryStats().liveSources).toBe(1);

		const again = await acquireFinishViews([{ view: 'a', uri: '/a.png', role: 'color' }], null);
		expect(again.views.a).not.toBe(made[0]);
		expect(made).toHaveLength(3);
		again.release();
	});

	it('keeps a leased view alive through the full product teardown (views, then source scope)', async () => {
		// Both product teardowns (project route, cold release) call
		// `releaseFinishViewsForScope` and then `releaseTextureScope`. The second
		// call disposes every cached source in the scope; a still-leased Finish
		// view must not lose its texture there, and must be disposed exactly once
		// by its own final release.
		const leased = imageTexture();
		const idle = imageTexture();
		const leasedDispose = vi.spyOn(leased, 'dispose');
		const idleDispose = vi.spyOn(idle, 'dispose');
		const scope = {
			scopeId: 'project:full-teardown',
			loader: async (uri: string) => (uri === '/leased.png' ? leased : idle)
		};
		const lease = await acquireFinishViews(
			[{ view: 'colour', uri: '/leased.png', role: 'color' }],
			scope
		);
		const other = await acquireFinishViews(
			[{ view: 'rough', uri: '/idle.png', role: 'roughness' }],
			scope
		);
		other.release();
		expect(textureSourceMemoryStats().liveSources).toBe(2);

		releaseFinishViewsForScope(scope.scopeId);
		releaseTextureScope(scope.scopeId);

		expect(idleDispose).toHaveBeenCalledTimes(1);
		expect(leasedDispose).not.toHaveBeenCalled();
		// The source cache forgot both keys at teardown; the leased bytes stay
		// charged to the view budget until the lease goes.
		expect(textureSourceMemoryStats().liveSources).toBe(0);
		expect(finishViewStats()).toMatchObject({ live: 1, bytes: BYTES });

		lease.release();
		expect(leasedDispose).toHaveBeenCalledTimes(1);
		expect(finishViewStats()).toMatchObject({ live: 0, bytes: 0 });
	});
});

describe('the default budget', () => {
	it('is the v1 256 MiB ceiling', () => {
		expect(DEFAULT_FINISH_VIEW_BUDGET_BYTES).toBe(256 * 1024 * 1024);
	});
});
