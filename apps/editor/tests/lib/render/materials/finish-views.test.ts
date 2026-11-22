import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoColorSpace, SRGBColorSpace, Texture } from 'three';
import { rgba8MipChainBytes } from '@portfolio/project-model/materials';
import {
	acquireFinishViews,
	DEFAULT_FINISH_VIEW_BUDGET_BYTES,
	finishViewStats,
	invalidateFinishViewsForSource,
	releaseFinishViewsForScope,
	resetFinishViewsForTests,
	setFinishViewBudget,
	setFinishViewGeneration,
	type FinishViewGeneration
} from '$lib/render/resources/finish-views';
import {
	__resetDefaultSourceLoaderForTests,
	invalidateTextureSource,
	loadFinishTexture,
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

describe('a source shared by unfinished acquisitions', () => {
	const view = (name: string, uri: string) => ({ view: name, uri, role: 'color' as const });
	const shared = view('0-shared', '/shared.png');
	const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

	let scopes = 0;
	/** A scope whose named images wait to be settled; every load gets its own texture. */
	function scopeWaitingOn(...uris: string[]) {
		const waiting = new Map<string, { resolve(): void; reject(error: Error): void }>();
		const loads: { uri: string; dispose: ReturnType<typeof vi.spyOn> }[] = [];
		const scope = {
			// Decode slots are per scope, so an unsettled case cannot stall the next one.
			scopeId: `project:shared-${++scopes}`,
			loader: (uri: string) => {
				const texture = imageTexture();
				loads.push({ uri, dispose: vi.spyOn(texture, 'dispose') });
				if (!uris.includes(uri)) return Promise.resolve(texture);
				return new Promise<Texture>((resolve, reject) => {
					waiting.set(uri, { resolve: () => resolve(texture), reject });
				});
			}
		};
		const disposals = (uri = shared.uri) =>
			loads.filter((load) => load.uri === uri).map((load) => load.dispose.mock.calls.length);
		return { scope, disposals, settle: (uri: string) => waiting.get(uri)! };
	}

	it('survives a cancelled holder, and the other commits it', async () => {
		const { scope, disposals, settle } = scopeWaitingOn('/a.png', '/b.png');
		const controller = new AbortController();
		const first = acquireFinishViews([shared, view('a', '/a.png')], scope, controller.signal);
		const second = acquireFinishViews([shared, view('b', '/b.png')], scope);
		await tick();
		controller.abort();
		expect((await first).issues[0]?.code).toBe('cancelled');
		expect(disposals()).toEqual([0]);

		settle('/b.png').resolve();
		const lease = await second;
		expect(lease.issues).toEqual([]);
		expect(disposals()).toEqual([0]);
		lease.release();
		releaseFinishViewsForScope(scope.scopeId);
		expect(disposals()).toEqual([1]);
	});

	it('survives a holder whose sibling image failed', async () => {
		vi.spyOn(console, 'warn').mockImplementationOnce(() => {});
		const { scope, disposals, settle } = scopeWaitingOn('/a.png', '/b.png');
		const first = acquireFinishViews([shared, view('a', '/a.png')], scope);
		const second = acquireFinishViews([shared, view('b', '/b.png')], scope);
		await tick();
		settle('/a.png').reject(new Error('blocked'));
		expect((await first).issues[0]?.code).toBe('image-load-failed');
		expect(disposals()).toEqual([0]);
		settle('/b.png').resolve();
		(await second).release();
		expect(disposals()).toEqual([0]);
	});

	it('survives a budget refusal in the tick the shared load resolves', async () => {
		const { scope, disposals, settle } = scopeWaitingOn('/shared.png');
		setFinishViewBudget(BYTES);
		const first = acquireFinishViews([view('a', '/a.png'), view('z', '/shared.png')], scope);
		await tick();
		const second = acquireFinishViews([shared], scope);
		await tick();
		settle('/shared.png').resolve();
		expect((await first).issues[0]?.code).toBe('texture-budget');
		const lease = await second;
		expect(lease.issues).toEqual([]);
		expect(disposals()).toEqual([0]);
		lease.release();
	});

	it('survives a generation refusal on another Canvas', async () => {
		const { scope, disposals, settle } = scopeWaitingOn('/a.png', '/b.png');
		const first = acquireFinishViews([shared, view('a', '/a.png')], scope, undefined, { owner: 'a', generation: 0 });
		const second = acquireFinishViews([shared, view('b', '/b.png')], scope, undefined, { owner: 'b', generation: 0 });
		await tick();
		setFinishViewGeneration('a', 1);
		settle('/a.png').resolve();
		expect((await first).issues[0]?.code).toBe('generation-mismatch');
		expect(disposals()).toEqual([0]);
		settle('/b.png').resolve();
		(await second).release();
		expect(disposals()).toEqual([0]);
	});

	it('survives eviction of the view another caller committed', async () => {
		const { scope, disposals, settle } = scopeWaitingOn('/b.png');
		const pending = acquireFinishViews([shared, view('b', '/b.png')], scope);
		await tick();
		(await acquireFinishViews([shared], scope)).release();
		setFinishViewBudget(BYTES);
		(await acquireFinishViews([view('c', '/c.png')], scope)).release();
		expect(disposals()).toEqual([0]);

		setFinishViewBudget(BYTES * 3);
		settle('/b.png').resolve();
		const lease = await pending;
		expect(lease.issues).toEqual([]);
		expect(disposals()).toEqual([0]);
		lease.release();
	});

	it('survives retirement of another Canvas generation', async () => {
		const { scope, disposals, settle } = scopeWaitingOn('/b.png');
		(await acquireFinishViews([shared], scope, undefined, { owner: 'a', generation: 0 })).release();
		const pending = acquireFinishViews([shared, view('b', '/b.png')], scope, undefined, { owner: 'b', generation: 0 });
		await tick();
		setFinishViewGeneration('a', 1);
		expect(disposals()).toEqual([0]);
		settle('/b.png').resolve();
		(await pending).release();
		expect(disposals()).toEqual([0]);
	});

	it('is never evicted by the acquisition about to join it', async () => {
		const { scope, disposals, settle } = scopeWaitingOn('/b.png');
		const pending = acquireFinishViews([shared, view('b', '/b.png')], scope);
		await tick();
		(await acquireFinishViews([shared], scope)).release();
		setFinishViewBudget(BYTES);
		settle('/b.png').resolve();
		expect((await pending).issues[0]?.code).toBe('texture-budget');
		expect(disposals()).toEqual([0]);
		expect(finishViewStats().bytes).toBe(BYTES);
	});

	it.each([
		['holds the decoded texture', '0-shared'],
		['has not reached the shared image yet', 'z-shared']
	])('is disposed once by a last holder that %s', async (_, name) => {
		const { scope, disposals } = scopeWaitingOn('/a.png', '/b.png');
		const [one, two] = [new AbortController(), new AbortController()];
		const first = acquireFinishViews([shared, view('a', '/a.png')], scope, one.signal);
		const second = acquireFinishViews([view(name, shared.uri), view('b', '/b.png')], scope, two.signal);
		await tick();
		one.abort();
		await first;
		expect(disposals()).toEqual([0]);
		two.abort();
		await second;
		expect(disposals()).toEqual([1]);
		expect(textureSourceMemoryStats().liveSources).toBe(0);
	});

	it('is not disposed again after its scope tore down', async () => {
		vi.spyOn(console, 'warn').mockImplementationOnce(() => {});
		const { scope, disposals, settle } = scopeWaitingOn('/a.png');
		const pending = acquireFinishViews([shared, view('a', '/a.png')], scope);
		await tick();
		releaseFinishViewsForScope(scope.scopeId);
		releaseTextureScope(scope.scopeId);
		settle('/a.png').resolve();
		expect((await pending).views).toEqual({});
		expect(disposals()).toEqual([1]);
	});

	it('is released by identity, never as the texture that replaced it', async () => {
		const { scope, disposals } = scopeWaitingOn();
		const old = await acquireFinishViews([shared], scope);
		releaseFinishViewsForScope(scope.scopeId);
		releaseTextureScope(scope.scopeId);
		// The scope id mounts again while a material still leases the old texture.
		const next = await acquireFinishViews([view('remounted', shared.uri)], scope);
		old.release();
		expect(disposals()).toEqual([1, 0]);
		next.release();
	});
});

describe('a source invalidated under its views', () => {
	const colour = { view: 'colour', uri: '/colour.png', role: 'color' as const };
	const other = { view: 'other', uri: '/other.png', role: 'color' as const };
	const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
	/** Enough microtasks to cross every await between a decode and its commit. */
	const TICKS = Array.from({ length: 16 }, (_, index) => index);

	let scopes = 0;
	function countingScope(...slow: string[]) {
		const settle = new Map<string, () => void>();
		const loads: { uri: string; texture: Texture; disposed: number }[] = [];
		const scope = {
			scopeId: `project:invalidated-${++scopes}`,
			loader: (uri: string) => {
				const texture = imageTexture();
				const load = { uri, texture, disposed: 0 };
				texture.addEventListener('dispose', () => (load.disposed += 1));
				const first = !loads.some((earlier) => earlier.uri === uri);
				loads.push(load);
				if (!first || !slow.includes(uri)) return Promise.resolve(texture);
				return new Promise<Texture>((resolve) => settle.set(uri, () => resolve(texture)));
			}
		};
		const disposals = (uri?: string) =>
			loads.filter((load) => uri === undefined || load.uri === uri).map((load) => load.disposed);
		const retry = (uri: string) => {
			invalidateFinishViewsForSource(scope.scopeId, uri);
			invalidateTextureSource(scope.scopeId, uri);
		};
		const teardown = () => {
			releaseFinishViewsForScope(scope.scopeId);
			releaseTextureScope(scope.scopeId);
		};
		const disposedOf = (texture: Texture) => loads.find((load) => load.texture === texture)?.disposed;
		return { scope, loads, disposals, disposedOf, retry, teardown, settle };
	}

	it.each(TICKS)('never commits a disposed texture when torn down %i microtasks in', async (ticks) => {
		const { scope, disposals, disposedOf, teardown } = countingScope();
		const pending = acquireFinishViews([colour], scope);
		for (let i = 0; i < ticks; i += 1) await Promise.resolve();
		teardown();
		const lease = await pending;
		if (lease.views.colour === undefined) expect(lease.issues[0]?.code).toBe('cancelled');
		else expect(disposedOf(lease.views.colour)).toBe(0);
		lease.release();
		expect(disposals().filter((count) => count !== 1)).toEqual([]);
		expect(finishViewStats().bytes).toBe(0);
	});

	it.each(TICKS)('commits live bytes when retried %i microtasks in', async (ticks) => {
		const { scope, disposals, disposedOf, retry, teardown } = countingScope();
		const pending = acquireFinishViews([colour], scope);
		for (let i = 0; i < ticks; i += 1) await Promise.resolve();
		retry(colour.uri);
		const lease = await pending;
		expect(lease.issues).toEqual([]);
		expect(disposedOf(lease.views.colour!)).toBe(0);
		lease.release();
		teardown();
		expect(disposals().filter((count) => count !== 1)).toEqual([]);
		expect(finishViewStats().bytes).toBe(0);
	});

	it('keeps a leased texture until its release and gives the next lease new bytes', async () => {
		const { scope, disposals, retry, teardown } = countingScope();
		const old = await acquireFinishViews([colour], scope);
		retry(colour.uri);
		expect(disposals()).toEqual([0]);
		const next = await acquireFinishViews([colour], scope);
		expect(next.views.colour).not.toBe(old.views.colour);
		expect(finishViewStats()).toMatchObject({ live: 2, bytes: BYTES * 2 });
		old.release();
		expect(disposals()).toEqual([1, 0]);
		expect(finishViewStats().bytes).toBe(BYTES);
		next.release();
		teardown();
		expect(disposals()).toEqual([1, 1]);
	});

	it('disposes an unleased view at once', async () => {
		const { scope, disposals, retry } = countingScope();
		(await acquireFinishViews([colour], scope)).release();
		retry(colour.uri);
		expect(disposals()).toEqual([1]);
		expect(finishViewStats().bytes).toBe(0);
	});

	it('keeps one texture that two views share until the last lease is gone', async () => {
		const { scope, disposals, retry } = countingScope();
		(await acquireFinishViews([colour], scope)).release();
		const leased = await acquireFinishViews([{ ...colour, view: 'same image' }], scope);
		retry(colour.uri);
		expect(disposals()).toEqual([0]);
		leased.release();
		expect(disposals()).toEqual([1]);
	});

	it('reloads a view the waiting acquisition had already joined, and only that one', async () => {
		const { scope, disposals, retry, settle } = countingScope(other.uri);
		const old = await acquireFinishViews([colour], scope);
		const pending = acquireFinishViews([colour, other], scope);
		await tick();
		retry(colour.uri);
		settle.get(other.uri)!();
		const lease = await pending;
		expect(lease.issues).toEqual([]);
		expect(lease.views.colour).not.toBe(old.views.colour);
		expect(disposals(colour.uri)).toEqual([0, 0]);
		expect(disposals(other.uri)).toEqual([0]);
		old.release();
		expect(disposals(colour.uri)).toEqual([1, 0]);
		lease.release();
	});

	it('reloads a decoded texture without loading its unchanged sibling again', async () => {
		const { scope, disposals, retry, settle } = countingScope(other.uri);
		const pending = acquireFinishViews([colour, other], scope);
		await tick();
		retry(colour.uri);
		settle.get(other.uri)!();
		const lease = await pending;
		expect(lease.issues).toEqual([]);
		expect(disposals(colour.uri)).toEqual([1, 0]);
		expect(disposals(other.uri)).toEqual([0]);
		lease.release();
	});

	it('lets teardown win over an earlier retry and starts no load afterwards', async () => {
		const { scope, loads, retry, teardown, settle } = countingScope(other.uri);
		const pending = acquireFinishViews([other, { ...colour, view: 'z-colour' }], scope);
		await tick();
		retry(other.uri);
		teardown();
		settle.get(other.uri)!();
		expect((await pending).issues[0]?.code).toBe('cancelled');
		expect(loads.map((load) => load.uri)).toEqual([other.uri]);
	});

	it('stays closed when its scope id mounts again and retries the image', async () => {
		const { scope, loads, retry, teardown, settle } = countingScope(colour.uri);
		const pending = acquireFinishViews([colour], scope);
		await tick();
		teardown();
		retry(colour.uri);
		settle.get(colour.uri)!();
		expect((await pending).issues[0]?.code).toBe('cancelled');
		expect(loads).toHaveLength(1);
	});

	it('starts no load for an acquisition still queued at teardown', async () => {
		const { scope, loads, teardown, settle } = countingScope('/one.png', '/two.png');
		const first = acquireFinishViews([{ ...colour, uri: '/one.png' }], scope);
		const second = acquireFinishViews([{ ...colour, view: 'two', uri: '/two.png' }], scope);
		const queued = acquireFinishViews([other], scope);
		await tick();
		teardown();
		for (const resolve of settle.values()) resolve();
		await Promise.all([first, second]);
		expect((await queued).issues[0]?.code).toBe('cancelled');
		expect(loads.map((load) => load.uri)).toEqual(['/one.png', '/two.png']);
	});

	it('detaches by identity, so teardown still disposes the replacement source', async () => {
		const { scope, disposals, retry, teardown } = countingScope();
		const old = await acquireFinishViews([colour], scope);
		retry(colour.uri);
		await loadFinishTexture(colour.uri, colour.role, scope);
		teardown();
		expect(disposals()).toEqual([0, 1]);
		old.release();
		expect(disposals()).toEqual([1, 1]);
	});
});

describe('the default budget', () => {
	it('is the v1 256 MiB ceiling', () => {
		expect(DEFAULT_FINISH_VIEW_BUDGET_BYTES).toBe(256 * 1024 * 1024);
	});
});
