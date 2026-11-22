import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogueTile } from '$lib/render/materials/catalogue-tiles';
import { createFinishTiles, type FinishTileRender, type FinishTileSubject } from '$lib/render/materials/finish-tiles.svelte';
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
		const picture = await tiles.picture(OAK, 112, 1);
		expect(picture).toMatchObject({ key: catalogueTile('wood-oak-veneer')!.key });
		expect(fetched).toEqual([catalogueTile('wood-oak-veneer')!.uri]);
		expect(derived).toBe(1);
		expect(tiles.stats().renderer).toBe(false);
	});

	it('serves the master itself at M, by its own static URL and without decoding', async () => {
		const tiles = service();
		const picture = await tiles.picture(OAK, 128, 2);
		expect(picture!.url).toBe(catalogueTile('wood-oak-veneer')!.uri);
		expect(decoded).toBe(0);
	});

	it('derives each size once and reuses it (cache reuse)', async () => {
		const fetched: string[] = [];
		const tiles = service(fetched);
		const [a, b] = await Promise.all([tiles.picture(OAK, 32, 1), tiles.picture(OAK, 32, 1)]);
		expect(a!.url).toBe(b!.url);
		await tiles.picture(OAK, 32, 1);
		expect(fetched).toHaveLength(1);
		expect(derived).toBe(1);
		// Another size reuses the already fetched master.
		await tiles.picture(OAK, 56, 2);
		expect(fetched).toHaveLength(1);
		expect(derived).toBe(2);
	});

	it('draws a project Finish through the registered renderer, once, and isolates scopes', async () => {
		const tiles = service();
		const render = ready();
		tiles.registerRenderer(render);
		const a = await tiles.picture({ kind: 'finish', subject: finish('project-a') }, 32, 1);
		expect(a).toMatchObject({ key: 'tile-rendered' });
		await tiles.picture({ kind: 'finish', subject: finish('project-a') }, 32, 1);
		expect(render).toHaveBeenCalledTimes(1);
		await tiles.picture({ kind: 'finish', subject: finish('project-b') }, 32, 1);
		expect(render).toHaveBeenCalledTimes(2);

		tiles.forgetScope('project-a');
		expect(revoked).toContain(a!.url);
		await tiles.picture({ kind: 'finish', subject: finish('project-a') }, 32, 1);
		expect(render).toHaveBeenCalledTimes(3);
	});

	it('has no picture for a project Finish until a renderer registers, then retries', async () => {
		const tiles = service();
		const source = { kind: 'finish', subject: finish('project-a') } as const;
		expect(await tiles.picture(source, 32, 1)).toBeNull();
		const before = tiles.epoch;
		const unregister = tiles.registerRenderer(ready());
		expect(tiles.epoch).toBe(before + 1);
		expect(await tiles.picture(source, 32, 1)).not.toBeNull();
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
		expect(await tiles.picture(source, 32, 1)).toBeNull();
		expect(await tiles.picture(source, 32, 1)).toMatchObject({ key: 'tile-ok' });
		expect(attempt).toBe(2);
	});

	it('survives a failing master fetch or decode as null (the swatch stays)', async () => {
		const failing = createFinishTiles({
			fetchMaster: async () => {
				throw new Error('offline');
			}
		});
		expect(await failing.picture(OAK, 32, 1)).toBeNull();
		vi.stubGlobal('createImageBitmap', async () => {
			throw new Error('bad png');
		});
		expect(await service().picture(OAK, 32, 1)).toBeNull();
	});

	it('answers null once cancelled or disposed and revokes what it made', async () => {
		const tiles = service();
		const controller = new AbortController();
		controller.abort();
		expect(await tiles.picture(OAK, 32, 1, controller.signal)).toBeNull();
		const made = await tiles.picture(OAK, 32, 1);
		tiles.dispose();
		expect(revoked).toContain(made!.url);
		expect(await tiles.picture(OAK, 32, 1)).toBeNull();
	});

	it('names a picture by the key the host would draw, so a recipe change is a new picture', () => {
		const tiles = service();
		const a = tiles.keyOf({ kind: 'finish', subject: finish('project-a') });
		expect(a).toMatch(/^tile-/);
		expect(tiles.keyOf({ kind: 'finish', subject: finish('project-b') })).toBe(a);
	});
});
