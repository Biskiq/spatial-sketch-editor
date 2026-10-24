/**
 * T2.P02.S02 — the model-import client's wire contract.
 *
 * S01's routes are strict: staging requires `files` **and** `recipe` and rejects
 * any undeclared field, and it refuses a repeated declared path. A stub that
 * accepts anything proves only that the client can serialize; these tests read
 * the body the way the server does. The first browser run failed at exactly this
 * seam (a missing `recipe`), which is why the shape is pinned here.
 */
import { describe, expect, it } from 'vitest';

import { createModelImportClient, ModelImportClientError } from '$lib/platform/model-import-client';

const HASH = `sha256-${'a'.repeat(64)}`;
const RECIPE = { id: 'creator-import@1', version: 1 };
const STAGING = {
	importId: 'import-1',
	projectId: 'project:one',
	state: 'staging',
	files: [
		{ fileId: 'file-src', role: 'source', path: 'chair.glb', size: 10, hash: HASH },
		{ fileId: 'file-der', role: 'derivative', path: 'chair.derived.glb', size: 8, hash: HASH }
	]
};

type Captured = { path: string; body: unknown };

function clientWith(responses: readonly unknown[]): { client: NonNullable<ReturnType<typeof createModelImportClient>>; captured: Captured[] } {
	const captured: Captured[] = [];
	const fetchImpl = (async (input: string, init?: RequestInit) => {
		captured.push({ path: String(input), body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) });
		const body = responses[captured.length - 1] ?? {};
		return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
	}) as typeof fetch;
	const client = createModelImportClient('https://api.example.test', fetchImpl);
	if (client === null) throw new Error('client expected');
	return { client, captured };
}

describe('model-import client — staging declaration', () => {
	it('sends the recipe beside the file set and nothing else', async () => {
		const { client, captured } = clientWith([STAGING]);
		await client.createImport({
			projectId: 'project:one',
			recipe: RECIPE,
			source: [{ path: 'chair.glb', size: 10, hash: HASH }],
			derivative: { path: 'chair.derived.glb', size: 8, hash: HASH }
		});

		const body = captured[0]!.body as Record<string, unknown>;
		expect(Object.keys(body).sort()).toEqual(['files', 'recipe']);
		expect(body.recipe).toEqual(RECIPE);
		expect(body.files).toEqual([
			{ role: 'source', path: 'chair.glb', size: 10, hash: HASH },
			{ role: 'derivative', path: 'chair.derived.glb', size: 8, hash: HASH }
		]);
	});

	it('returns the staging record the server declared', async () => {
		const { client } = clientWith([STAGING]);
		const staged = await client.createImport({
			projectId: 'project:one',
			recipe: RECIPE,
			source: [{ path: 'chair.glb', size: 10, hash: HASH }],
			derivative: { path: 'chair.derived.glb', size: 8, hash: HASH }
		});
		expect(staged.importId).toBe('import-1');
		expect(staged.files.map((file) => file.path)).toEqual(['chair.glb', 'chair.derived.glb']);
	});

	it('maps a refusing server answer to a typed error, keeping its own message', async () => {
		const fetchImpl = (async () =>
			new Response(JSON.stringify({ error: { code: 'invalid_model_import', message: 'A declared model file path repeats' } }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			})) as typeof fetch;
		const client = createModelImportClient('https://api.example.test', fetchImpl);
		const failure = client!.createImport({
			projectId: 'project:one',
			recipe: RECIPE,
			source: [{ path: 'chair.glb', size: 10, hash: HASH }],
			derivative: { path: 'chair.glb', size: 8, hash: HASH }
		});
		await expect(failure).rejects.toBeInstanceOf(ModelImportClientError);
		await expect(failure).rejects.toMatchObject({ code: 'refused', status: 400 });
	});
});
