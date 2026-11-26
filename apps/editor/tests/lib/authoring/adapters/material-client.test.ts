/** The HTTP client's verification, not just its fetch calls. */
import { describe, expect, test } from 'vitest';
import {
	canonicalMaterialLibraryBytes,
	materialLibraryContentId,
	type MaterialLibraryPayload
} from '@portfolio/project-model/library';
import { recipeHash } from '@portfolio/project-model/materials';
import { createMaterialLibraryClient } from '$lib/authoring/adapters/scene/library/material-client';

const recipe = {
	profile: 'pbr-metallic-roughness/v1' as const,
	color: '#c8a078',
	roughness: 0.55,
	metalness: 0.1,
	occlusionStrength: 0.9,
	normalScale: 1,
	mapping: { kind: 'uv' as const, set: 0 as const, repeat: [1, 1] as const, rotation: 0, offset: [0, 0] as const },
	maps: {}
};

const payload: MaterialLibraryPayload = {
	formatVersion: 1,
	kind: 'material',
	name: 'Oak',
	recipe
};

describe('material library client', () => {
	test('lists material summaries only through the explicit kind filter', async () => {
		let url = '';
		const client = createMaterialLibraryClient({
			apiOrigin: 'https://api.example/',
			fetchImpl: (async (input: RequestInfo | URL) => {
				url = String(input);
				return new Response(
					JSON.stringify({
						items: [
							{
								id: 'item-1',
								name: 'Oak',
								kind: 'material',
								formatVersion: 1,
								contentId: `sha256-${'a'.repeat(64)}`,
								createdAt: '2026-11-21T00:00:00.000Z',
								recipeHash: `sha256-${'b'.repeat(64)}`,
								imageCount: 3,
								hasThumbnail: true
							}
						]
					}),
					{ headers: { 'content-type': 'application/json' } }
				);
			}) as typeof fetch
		});
		const items = await client.list();
		expect(url).toBe('https://api.example/library/items?kind=material');
		expect(items[0]!.imageCount).toBe(3);
		expect(items[0]!.hasThumbnail).toBe(true);
	});

	test('reads canonical bytes and refuses a format the editor cannot insert', async () => {
		const contentId = await materialLibraryContentId(payload);
		const bytes = canonicalMaterialLibraryBytes(payload);
		const response = (format: string) =>
			new Response(bytes as unknown as BodyInit, {
				headers: {
					etag: `"${contentId}"`,
					'x-library-kind': 'material',
					'x-library-format-version': format
				}
			});
		const item = { id: 'item-1', contentId, formatVersion: 1 };
		const good = createMaterialLibraryClient({
			apiOrigin: 'https://api.example',
			fetchImpl: (async () => response('1')) as typeof fetch
		});
		const read = await good.read(item);
		expect(read.payload.name).toBe('Oak');
		expect(read.contentId).toBe(contentId);

		const future = createMaterialLibraryClient({
			apiOrigin: 'https://api.example',
			fetchImpl: (async () => response('2')) as typeof fetch
		});
		await expect(future.read(item)).rejects.toMatchObject({
			code: 'refused'
		});
	});

	test('sends exactly the transfer triple and revalidates the returned recipe revision', async () => {
		let body: unknown = null;
		const contentId = await materialLibraryContentId(payload);
		const pinned = await recipeHash(recipe);
		const item = { id: 'item-1', contentId, recipeHash: pinned };
		const client = createMaterialLibraryClient({
			apiOrigin: 'https://api.example',
			fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
				body = JSON.parse(String(init?.body));
				return new Response(
					JSON.stringify({
						itemId: 'item-1',
						contentId,
						finishId: 'finish-insert-1',
						name: 'Oak',
						recipe,
						recipeHash: pinned,
						images: [],
						savedBase: null
					}),
					{ headers: { 'content-type': 'application/json' } }
				);
			}) as typeof fetch
		});
		const transfer = await client.transfer(item, 'destination-project', 'insert-1');
		expect(body).toEqual({
			destinationProjectId: 'destination-project',
			contentId,
			operationId: 'insert-1'
		});
		expect(transfer.finishId).toBe('finish-insert-1');
	});

	test('putThumbnail and thumbnail handle bytes and map 409 stale_thumbnail / stale_revision to stale', async () => {
		const contentId = await materialLibraryContentId(payload);
		const pinned = await recipeHash(recipe);
		const item = { id: 'item-1', contentId, recipeHash: pinned };
		const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

		const okClient = createMaterialLibraryClient({
			apiOrigin: 'https://api.example',
			fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
				if (init?.method === 'PUT') return new Response(null, { status: 204 });
				return new Response(png, { status: 200 });
			}) as typeof fetch
		});
		await expect(okClient.putThumbnail(item, png)).resolves.toBeUndefined();
		await expect(okClient.thumbnail(item.id)).resolves.toEqual(png);

		const staleThumbnailClient = createMaterialLibraryClient({
			apiOrigin: 'https://api.example',
			fetchImpl: (async () =>
				new Response(
					JSON.stringify({ error: { code: 'stale_thumbnail', message: 'Thumbnail upload expired.' } }),
					{ status: 409, headers: { 'content-type': 'application/json' } }
				)) as typeof fetch
		});
		await expect(staleThumbnailClient.putThumbnail(item, png)).rejects.toMatchObject({
			code: 'stale',
			status: 409,
			serverCode: 'stale_thumbnail'
		});

		const staleRevisionClient = createMaterialLibraryClient({
			apiOrigin: 'https://api.example',
			fetchImpl: (async () =>
				new Response(
					JSON.stringify({ error: { code: 'stale_revision', message: 'Project revision changed.' } }),
					{ status: 409, headers: { 'content-type': 'application/json' } }
				)) as typeof fetch
		});
		await expect(staleRevisionClient.transfer(item, 'destination-project', 'insert-1')).rejects.toMatchObject({
			code: 'stale',
			status: 409,
			serverCode: 'stale_revision'
		});
	});
});
