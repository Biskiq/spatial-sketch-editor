import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InspectionThumbnail } from '$lib/render/materials/inspection-host';
import { catalogueTile } from '$lib/render/materials/catalogue-tiles';
import { FINISH_TILE_RENDER_CONCURRENCY, createFinishTiles, type FinishTileRender, type FinishTileSubject } from '$lib/render/materials/finish-tiles.svelte';
import { draftLookSource } from '$lib/render/materials/inspection-subject';
import { inspectionDraft } from './__helpers__/inspection-draft';

const PNG = new Uint8Array([137, 80, 78, 71]);
const OAK = { kind: 'catalogue', id: 'wood-oak-veneer' } as const;

function finish(scopeId: string, finishId = 'inspection-draft'): FinishTileSubject {
	return {
		kind: 'finish',
		document: draftLookSource(inspectionDraft()),
		finishId,
		revision: '1',
		scope: { scopeId } as never
	};
}

const created: string[] = [];
const revoked: string[] = [];
let derived = 0;
let decoded = 0;

beforeEach(() => {
	created.length = 0;
	revoked.length = 0;
	derived = 0;
	decoded = 0;
	let serial = 0;
	vi.stubGlobal('URL', {
		createObjectURL: () => {
			const url = `blob:${(serial += 1)}`;
			created.push(url);
			return url;
		},
		revokeObjectURL: (url: string) => revoked.push(url)
	});
	vi.stubGlobal('createImageBitmap', async () => {
		decoded += 1;
		return { width: 256, height: 256, close: () => undefined };
	});
	vi.stubGlobal(
		'OffscreenCanvas',
		class {
			getContext() {
				return { drawImage: () => (derived += 1), imageSmoothingEnabled: true, imageSmoothingQuality: 'low' };
			}
			async convertToBlob() {
				return new Blob([PNG], { type: 'image/png' });
			}
		}
	);
});
afterEach(() => vi.unstubAllGlobals());

function service(fetched: string[] = []) {
	return createFinishTiles({
		fetchMaster: async (uri) => {
			fetched.push(uri);
			return new Blob([PNG], { type: 'image/png' });
		}
	});
}

const ready = (key = 'tile-rendered'): FinishTileRender =>
	vi.fn(async () => ({ status: 'ready' as const, key, recipeKey: 'r', frame: {} as never, png: PNG }));

describe('the Finish picture service', () => {
	it('serves a catalogue entry from its committed master and never needs a renderer', async () => {
		const fetched: string[] = [];
		const tiles = service(fetched);
		const picture = await tiles.lease(OAK, 112, 1);
		expect(picture).toMatchObject({ key: catalogueTile('wood-oak-veneer')!.key });
		expect(fetched).toEqual([catalogueTile('wood-oak-veneer')!.uri]);
		expect(derived).toBe(1);
		expect(tiles.stats().renderer).toBe(false);
	});

	it('serves the master itself at M, by its own static URL and without decoding', async () => {
		const tiles = service();
		const picture = await tiles.lease(OAK, 128, 2);
		expect(picture!.url).toBe(catalogueTile('wood-oak-veneer')!.uri);
		expect(decoded).toBe(0);
	});

	it('derives each size once and reuses it (cache reuse)', async () => {
		const fetched: string[] = [];
		const tiles = service(fetched);
		const [a, b] = await Promise.all([tiles.lease(OAK, 32, 1), tiles.lease(OAK, 32, 1)]);
		expect(a!.url).toBe(b!.url);
		await tiles.lease(OAK, 32, 1);
		expect(fetched).toHaveLength(1);
		expect(derived).toBe(1);
		// Another size reuses the already fetched master.
		await tiles.lease(OAK, 56, 2);
		expect(fetched).toHaveLength(1);
		expect(derived).toBe(2);
	});

	it('draws a project Finish through the registered renderer, once, and isolates scopes', async () => {
		const tiles = service();
		const render = ready();
		tiles.registerRenderer(render);
		const a = await tiles.lease({ kind: 'finish', subject: finish('project-a') }, 32, 1);
		expect(a).toMatchObject({ key: 'tile-rendered' });
		const a2 = await tiles.lease({ kind: 'finish', subject: finish('project-a') }, 32, 1);
		expect(render).toHaveBeenCalledTimes(1);
		await tiles.lease({ kind: 'finish', subject: finish('project-b') }, 32, 1);
		expect(render).toHaveBeenCalledTimes(2);

		tiles.forgetScope('project-a');
		// Held by a tile: the URL outlives the forget until the tile lets go.
		expect(revoked).not.toContain(a!.url);
		a!.release();
		expect(revoked).not.toContain(a!.url);
		a2!.release();
		expect(revoked).toContain(a!.url);
		await tiles.lease({ kind: 'finish', subject: finish('project-a') }, 32, 1);
		expect(render).toHaveBeenCalledTimes(3);
	});

	it('has no picture for a project Finish until a renderer registers, then retries', async () => {
		const tiles = service();
		const source = { kind: 'finish', subject: finish('project-a') } as const;
		expect(await tiles.lease(source, 32, 1)).toBeNull();
		const before = tiles.epoch;
		const unregister = tiles.registerRenderer(ready());
		expect(tiles.epoch).toBe(before + 1);
		expect(await tiles.lease(source, 32, 1)).not.toBeNull();
		unregister();
		expect(tiles.epoch).toBe(before + 2);
		expect(tiles.stats().renderer).toBe(false);
	});

	it('keeps only successes: a refusal is null and asked again', async () => {
		const tiles = service();
		let attempt = 0;
		tiles.registerRenderer(async () => {
			attempt += 1;
			return attempt === 1
				? { status: 'refused', issues: [{ code: 'image-load-failed' }] }
				: { status: 'ready', key: 'tile-ok', recipeKey: 'r', frame: {} as never, png: PNG };
		});
		const source = { kind: 'finish', subject: finish('project-a') } as const;
		expect(await tiles.lease(source, 32, 1)).toBeNull();
		expect(await tiles.lease(source, 32, 1)).toMatchObject({ key: 'tile-ok' });
		expect(attempt).toBe(2);
	});

	it('survives a failing master fetch or decode as null (the swatch stays)', async () => {
		const failing = createFinishTiles({
			fetchMaster: async () => {
				throw new Error('offline');
			}
		});
		expect(await failing.lease(OAK, 32, 1)).toBeNull();
		vi.stubGlobal('createImageBitmap', async () => {
			throw new Error('bad png');
		});
		expect(await service().lease(OAK, 32, 1)).toBeNull();
	});

	it('answers null once cancelled or disposed and revokes what it made', async () => {
		const tiles = service();
		const controller = new AbortController();
		controller.abort();
		expect(await tiles.lease(OAK, 32, 1, controller.signal)).toBeNull();
		const made = await tiles.lease(OAK, 32, 1);
		tiles.dispose();
		expect(revoked).toContain(made!.url);
		expect(await tiles.lease(OAK, 32, 1)).toBeNull();
	});

	it('names a picture by the key the host would draw, so a recipe change is a new picture', () => {
		const tiles = service();
		const a = tiles.keyOf({ kind: 'finish', subject: finish('project-a') });
		expect(a).toMatch(/^tile-/);
		expect(tiles.keyOf({ kind: 'finish', subject: finish('project-b') })).toBe(a);
	});

	describe('lifecycle (U1 follow-up)', () => {
		/** A host whose draws finish when the test says so. */
		function manual() {
			const pending: Array<{ resolve: () => void; signal?: AbortSignal; scope: string }> = [];
			let active = 0;
			let peak = 0;
			const render: FinishTileRender = vi.fn((request, signal) => {
				active += 1;
				peak = Math.max(peak, active);
				return new Promise<InspectionThumbnail>((resolve) => {
					pending.push({
						scope: (request.subject as FinishTileSubject).scope.scopeId,
						signal,
						resolve: () => {
							active -= 1;
							resolve({ status: 'ready' as const, key: 'tile-rendered', recipeKey: 'r', frame: {} as never, png: PNG });
						}
					});
				});
			});
			return { render, pending, peak: () => peak };
		}
		const settle = () => new Promise((r) => setTimeout(r, 0));
		const project = (scope: string) => ({ kind: 'finish', subject: finish(scope) }) as const;

		it('revokes an evicted picture nobody holds, and keeps one a tile still shows', async () => {
			const tiles = service();
			tiles.registerRenderer(ready());
			const shown = await tiles.lease(project('s0'), 32, 1);
			const dropped = await tiles.lease(project('s1'), 32, 1);
			dropped!.release();
			for (let i = 2; i < 200; i += 1) (await tiles.lease(project(`s${i}`), 32, 1))!.release();
			expect(tiles.stats().pictures).toBeLessThanOrEqual(192);
			expect(revoked).toContain(dropped!.url);
			// s0 was evicted first but is still shown: its URL stays valid.
			expect(revoked).not.toContain(shown!.url);
			shown!.release();
			expect(revoked).toContain(shown!.url);
			shown!.release();
			expect(revoked.filter((url) => url === shown!.url)).toHaveLength(1);
		});

		it('ends with every object URL it made revoked or held (no leak)', async () => {
			const tiles = service();
			tiles.registerRenderer(ready());
			const held = [];
			for (let i = 0; i < 230; i += 1) held.push((await tiles.lease(project(`s${i}`), 32, 1))!);
			for (const lease of held) lease.release();
			tiles.dispose();
			expect(new Set(revoked).size).toBe(created.length);
		});

		it('makes no URL when the picture is forgotten or disposed while it is being drawn', async () => {
			const host = manual();
			const tiles = service();
			tiles.registerRenderer(host.render);
			const forgotten = tiles.lease(project('p'), 32, 1);
			await settle();
			tiles.forgetScope('p');
			host.pending[0]!.resolve();
			expect(await forgotten).toBeNull();

			const disposing = tiles.lease(project('q'), 32, 1);
			await settle();
			tiles.dispose();
			host.pending[1]!.resolve();
			expect(await disposing).toBeNull();
			expect(created).toHaveLength(0);
			expect(tiles.stats().urls).toBe(0);
		});

		it('lets one cancelled tile leave without cancelling the draw another still wants', async () => {
			const host = manual();
			const tiles = service();
			tiles.registerRenderer(host.render);
			const first = new AbortController();
			const a = tiles.lease(project('p'), 32, 1, first.signal);
			const b = tiles.lease(project('p'), 32, 1);
			await settle();
			first.abort();
			expect(await a).toBeNull();
			expect(host.pending[0]!.signal!.aborted).toBe(false);
			host.pending[0]!.resolve();
			expect(await b).toMatchObject({ key: 'tile-rendered' });
		});

		it('cancels the draw when its last tile leaves, and asks again later', async () => {
			const host = manual();
			const tiles = service();
			tiles.registerRenderer(host.render);
			const only = new AbortController();
			const a = tiles.lease(project('p'), 32, 1, only.signal);
			await settle();
			only.abort();
			expect(await a).toBeNull();
			expect(host.pending[0]!.signal!.aborted).toBe(true);
			const again = tiles.lease(project('p'), 32, 1);
			await settle();
			expect(host.render).toHaveBeenCalledTimes(2);
			host.pending[1]!.resolve();
			expect(await again).not.toBeNull();
		});

		it('hands a cached picture out synchronously (leaseNow) and never one that is not made', async () => {
			const tiles = service();
			tiles.registerRenderer(ready());
			expect(tiles.leaseNow(project('p'), 32, 1)).toBeNull();
			const made = await tiles.lease(project('p'), 32, 1);
			const now = tiles.leaseNow(project('p'), 32, 1);
			expect(now?.url).toBe(made!.url);
		});

		it('draws a large shelf through a bounded lane, whatever its size', async () => {
			const host = manual();
			const tiles = service();
			tiles.registerRenderer(host.render);
			const all = Array.from({ length: 60 }, (_, i) => tiles.lease(project(`s${i}`), 32, 1));
			await settle();
			expect(host.render).toHaveBeenCalledTimes(FINISH_TILE_RENDER_CONCURRENCY);
			expect(tiles.stats().drawQueued).toBe(60 - FINISH_TILE_RENDER_CONCURRENCY);
			let done = 0;
			while (done < 60) {
				const next = host.pending[done]!;
				next.resolve();
				done += 1;
				await settle();
			}
			expect((await Promise.all(all)).every((lease) => lease !== null)).toBe(true);
			expect(host.peak()).toBeLessThanOrEqual(FINISH_TILE_RENDER_CONCURRENCY);
			expect(tiles.stats()).toMatchObject({ drawing: 0, drawQueued: 0 });
		});

		it('never draws a queued tile that left the shelf before its turn', async () => {
			const host = manual();
			const tiles = service();
			tiles.registerRenderer(host.render);
			const gone = new AbortController();
			const lanes = Array.from({ length: FINISH_TILE_RENDER_CONCURRENCY }, (_, i) => tiles.lease(project(`lane${i}`), 32, 1));
			const queued = tiles.lease(project('queued'), 32, 1, gone.signal);
			await settle();
			gone.abort();
			expect(await queued).toBeNull();
			for (const draw of [...host.pending]) draw.resolve();
			await Promise.all(lanes);
			await settle();
			expect(host.pending.map((draw) => draw.scope)).not.toContain('queued');
			expect(tiles.stats().drawQueued).toBe(0);
		});
	});
});
