// @vitest-environment jsdom
/**
 * U1 follow-up — the shelf tile never shows another Finish's picture.
 *
 * A source change clears the old picture at once, answers that arrive late or out
 * of order are dropped, and every picture the tile held is released.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import FinishTileProbe from '../fixtures/FinishTileProbe.svelte';
import type {
	FinishTileLease,
	FinishTileSource,
	FinishTiles
} from '$lib/render/materials/finish-tiles.svelte';

type Deferred = { source: FinishTileSource; signal?: AbortSignal; resolve: (lease: FinishTileLease | null) => void };

function fakeTiles() {
	const asks: Deferred[] = [];
	const released: string[] = [];
	const cached = new Map<string, string>();
	const keyOf = (source: FinishTileSource) => (source.kind === 'catalogue' ? source.id : 'finish');
	const leaseOf = (url: string): FinishTileLease => ({ url, key: url, release: () => void released.push(url) });
	const tiles = {
		epoch: 0,
		leaseNow: (source: FinishTileSource) => {
			const url = cached.get(keyOf(source));
			return url === undefined ? null : leaseOf(url);
		},
		lease: (source: FinishTileSource, _px: number, _dpr: number, signal?: AbortSignal) =>
			new Promise<FinishTileLease | null>((resolve) => asks.push({ source, signal, resolve }))
	} as unknown as FinishTiles;
	return { tiles, asks, released, cached, leaseOf };
}

const OAK: FinishTileSource = { kind: 'catalogue', id: 'wood-oak-veneer' };
const BRICK: FinishTileSource = { kind: 'catalogue', id: 'masonry-brick-red' };
const CONCRETE: FinishTileSource = { kind: 'catalogue', id: 'concrete-smooth' };

let target: HTMLElement;
beforeEach(() => {
	target = document.createElement('div');
	document.body.append(target);
});
afterEach(() => {
	target.remove();
});

const shown = () => target.querySelector('img')?.getAttribute('src') ?? null;

describe('FinishTile', () => {
	it('clears the previous picture the moment its source changes', async () => {
		const fake = fakeTiles();
		const view = mount(FinishTileProbe, { target, props: { tiles: fake.tiles, first: OAK } });
		await tick();
		fake.asks[0]!.resolve(fake.leaseOf('blob:oak'));
		await tick();
		expect(shown()).toBe('blob:oak');

		view.choose(BRICK);
		flushSync();
		expect(shown()).toBeNull();
		expect(fake.released).toContain('blob:oak');
		unmount(view);
	});

	it('drops an answer for a source that was replaced, whatever order they arrive in', async () => {
		const fake = fakeTiles();
		const view = mount(FinishTileProbe, { target, props: { tiles: fake.tiles, first: OAK } });
		await tick();
		view.choose(BRICK);
		await tick();
		view.choose(CONCRETE);
		await tick();
		const [oak, brick, concrete] = fake.asks;
		expect(oak!.signal!.aborted && brick!.signal!.aborted).toBe(true);

		// Newest first, then the two stale answers.
		concrete!.resolve(fake.leaseOf('blob:concrete'));
		await tick();
		brick!.resolve(fake.leaseOf('blob:brick'));
		oak!.resolve(fake.leaseOf('blob:oak'));
		await tick();
		expect(shown()).toBe('blob:concrete');
		// The stale pictures were never held past arrival.
		expect(fake.released).toEqual(expect.arrayContaining(['blob:brick', 'blob:oak']));
		expect(fake.released).not.toContain('blob:concrete');
		unmount(view);
	});

	it('survives rapid variant switching and ends on the last choice only', async () => {
		const fake = fakeTiles();
		const view = mount(FinishTileProbe, { target, props: { tiles: fake.tiles, first: OAK } });
		const order: FinishTileSource[] = [BRICK, OAK, CONCRETE, BRICK, CONCRETE, OAK, BRICK];
		for (const next of order) {
			view.choose(next);
			flushSync();
		}
		await tick();
		// Answer every ask, oldest last.
		for (const ask of [...fake.asks].reverse()) ask.resolve(fake.leaseOf(`blob:${(ask.source as { id: string }).id}`));
		await tick();
		expect(shown()).toBe('blob:masonry-brick-red');
		unmount(view);
	});

	it('uses a picture that is already made at once, with no empty frame', async () => {
		const fake = fakeTiles();
		fake.cached.set('masonry-brick-red', 'blob:brick');
		const view = mount(FinishTileProbe, { target, props: { tiles: fake.tiles, first: OAK } });
		await tick();
		view.choose(BRICK);
		flushSync();
		expect(shown()).toBe('blob:brick');
		unmount(view);
	});

	it('releases what it holds, and cancels what it asked for, when it leaves', async () => {
		const fake = fakeTiles();
		const view = mount(FinishTileProbe, { target, props: { tiles: fake.tiles, first: OAK } });
		await tick();
		fake.asks[0]!.resolve(fake.leaseOf('blob:oak'));
		await tick();
		view.choose(BRICK);
		await tick();
		unmount(view);
		expect(fake.released).toContain('blob:oak');
		expect(fake.asks[1]!.signal!.aborted).toBe(true);
		const late = vi.fn();
		fake.asks[1]!.resolve({ url: 'blob:late', key: 'k', release: late });
		await tick();
		expect(late).toHaveBeenCalledTimes(1);
	});
});
