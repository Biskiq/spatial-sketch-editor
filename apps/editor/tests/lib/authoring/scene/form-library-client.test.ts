/**
 * T5.P01.S04 — the My Objects editor client and Save action.
 *
 * The client is transport, not an authority. These tests read what it sends and
 * what it refuses to accept:
 *
 * - Save posts the shared codec's canonical payload and its content id;
 * - List rejects an unexpected summary before it can reach the panel;
 * - Read verifies the received bytes against the pinned content id and refuses
 *   an older format number rather than misreading it;
 * - Save-to-My-Objects turns the server's typed refusals into words without
 *   touching authoring history.
 */
import { describe, expect, it, vi } from 'vitest';

import {
	canonicalFormLibraryBytes,
	canonicalFormLibraryPayload,
	formLibraryContentId,
	type FormLibraryPayload
} from '@portfolio/project-model/library';
import type { SceneFormEntity } from '@portfolio/project-model';

import {
	FormLibraryClientError,
	createFormLibraryClient
} from '$lib/authoring/adapters/scene/library/client';
import { saveFormToMyObjects } from '$lib/authoring/adapters/scene/library/save';

const SUMMARY = {
	id: '11111111-1111-4111-8111-111111111111',
	name: 'Saved plinth',
	kind: 'form',
	formatVersion: 1,
	contentId: `sha256-${'a'.repeat(64)}`,
	createdAt: '2026-10-28T12:00:00.000Z'
};

function payload(overrides: Partial<FormLibraryPayload> = {}): FormLibraryPayload {
	return canonicalFormLibraryPayload({
		formatVersion: 1,
		kind: 'form',
		name: 'Saved plinth',
		form: {
			generator: {
				kind: 'extrude',
				plane: 'plan',
				outline: [
					{ key: 1, u: 0, v: 0, smooth: false },
					{ key: 2, u: 1.2, v: 0, smooth: true },
					{ key: 3, u: 1.2, v: 0.8, smooth: false }
				],
				extent: 0.6
			},
			scale: [1, 1, 1],
			nextKey: 4
		},
		materialId: 'wood-walnut',
		castShadow: true,
		receiveShadow: true,
		...overrides
	});
}

function entity(): SceneFormEntity {
	return {
		kind: 'form',
		id: 'form-1',
		name: 'Saved plinth',
		position: [0, 0, 0],
		rotation: [0, 0, 0],
		form: payload().form,
		materialId: 'wood-walnut',
		castShadow: true,
		receiveShadow: true
	};
}

function capture() {
	const calls: Array<{ url: string; init?: RequestInit }> = [];
	const respond = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
		new Response(typeof body === 'string' ? body : JSON.stringify(body), {
			status,
			headers: { 'Content-Type': 'application/json', ...headers }
		});
	const fetchImpl = (async (input: string, init?: RequestInit) => {
		calls.push({ url: String(input), init });
		return (fetchImpl as unknown as { next: () => Response }).next();
	}) as typeof fetch & { next: () => Response };
	const client = createFormLibraryClient({ apiOrigin: 'https://api.example.test/', fetchImpl });
	return { client, calls, respond, fetchImpl };
}

describe('My Objects client', () => {
	it('lists the owner items and rejects an unexpected summary shape', async () => {
		const { client, calls, respond, fetchImpl } = capture();
		(fetchImpl as unknown as { next: () => Response }).next = () => respond({ items: [SUMMARY] });
		expect(await client.list()).toEqual([SUMMARY]);
		expect(calls[0]?.url).toBe('https://api.example.test/library/items');
		expect(calls[0]?.init?.credentials).toBe('include');

		(fetchImpl as unknown as { next: () => Response }).next = () =>
			respond({ items: [{ ...SUMMARY, kind: 'model' }] });
		await expect(client.list()).rejects.toMatchObject({ code: 'invalid-response' });
	});

	it('sends the canonical payload and content id on Save', async () => {
		const { client, calls, respond, fetchImpl } = capture();
		(fetchImpl as unknown as { next: () => Response }).next = () => respond(SUMMARY, 201);
		const item = payload();
		const summary = await client.save(item);
		expect(summary).toEqual(SUMMARY);
		const body = JSON.parse(String(calls[0]?.init?.body)) as {
			contentId: string;
			payload: unknown;
		};
		expect(body.contentId).toBe(await formLibraryContentId(item));
		expect(body.payload).toEqual(item);
		expect(calls[0]?.init?.method).toBe('POST');
	});

	it('reads and verifies bytes against the pinned content id and advertised format', async () => {
		const { client, respond, fetchImpl } = capture();
		const item = payload();
		const contentId = await formLibraryContentId(item);
		const summary = { ...SUMMARY, contentId };
		const body = canonicalFormLibraryBytes(item) as unknown as BodyInit;
		(fetchImpl as unknown as { next: () => Response }).next = () =>
			new Response(body, {
				status: 200,
				headers: {
					ETag: `"${contentId}"`,
					'X-Library-Format-Version': '1',
					'Content-Type': 'application/json'
				}
			});
		const read = await client.read(summary);
		expect(read.payload).toEqual(item);
		expect(read.contentId).toBe(contentId);

		(fetchImpl as unknown as { next: () => Response }).next = () =>
			new Response(body, {
				status: 200,
				headers: { ETag: `"sha256-${'0'.repeat(64)}"`, 'X-Library-Format-Version': '1' }
			});
		await expect(client.read(summary)).rejects.toMatchObject({ code: 'refused' });

		(fetchImpl as unknown as { next: () => Response }).next = () =>
			new Response(body, {
				status: 200,
				headers: { ETag: `"${contentId}"`, 'X-Library-Format-Version': '2' }
			});
		await expect(client.read({ ...summary, formatVersion: 2 })).rejects.toMatchObject({
			serverCode: 'unsupported_format_version'
		});
	});

	it('maps another owner to not-found and a full library to its own code', async () => {
		const { client, respond, fetchImpl } = capture();
		(fetchImpl as unknown as { next: () => Response }).next = () =>
			respond({ error: { code: 'not_found', message: 'Library item not found' } }, 404);
		await expect(client.read(SUMMARY)).rejects.toMatchObject({
			code: 'not-found',
			status: 404
		});

		(fetchImpl as unknown as { next: () => Response }).next = () =>
			respond(
				{ error: { code: 'library_full', message: 'My Objects holds at most 1000 items.' } },
				409
			);
		await expect(client.save(payload())).rejects.toMatchObject({
			code: 'library-full',
			serverCode: 'library_full'
		});
	});
});

describe('Save to My Objects', () => {
	it('saves the accepted entity and returns completion words', async () => {
		const save = vi.fn(async () => SUMMARY);
		const outcome = await saveFormToMyObjects(entity(), {
			client: { save } as never
		});
		expect(outcome).toEqual({
			kind: 'accepted',
			message: expect.stringContaining('Saved “Saved plinth” to My Objects')
		});
		expect(save).toHaveBeenCalledTimes(1);
		expect(save).toHaveBeenCalledWith(payload());
	});

	it('keeps the library-full guidance and saves nothing else', async () => {
		const save = vi.fn(async () => {
			throw new FormLibraryClientError(
				'library-full',
				'My Objects holds at most 1000 items. Remove an item to save another.',
				409,
				'library_full'
			);
		});
		const outcome = await saveFormToMyObjects(entity(), { client: { save } as never });
		expect(outcome.kind).toBe('refused');
		expect(outcome.message).toMatch(/Remove an item/);
		expect(save).toHaveBeenCalledTimes(1);
	});

	it('reports an unconfirmed save without claiming nothing was stored', async () => {
		const save = vi.fn(async () => {
			throw new Error('offline');
		});
		const outcome = await saveFormToMyObjects(entity(), { client: { save } as never });
		expect(outcome).toEqual({
			kind: 'refused',
			message: 'The save could not be confirmed; refresh My Objects before retrying.'
		});
	});
});
