import { describe, expect, it } from 'vitest';

import {
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	computeEnvelopeSourceContentId,
	serializeProjectEnvelope
} from '@portfolio/project-model/units';
import { createUnitProject } from '../authoring/__fixtures__/unit-envelope-fixtures';
import {
	SAVE_CONTENT_IDENTITY_SCHEME,
	type SaveAcknowledgement,
	type SaveRequest
} from '@portfolio/project-model/save';

import {
	LEGACY_PENDING_CLOUD_SAVE_KEY,
	PENDING_CLOUD_SAVE_KEY,
	ProjectPersistenceError,
	clearPendingCloudSave,
	createProjectApi,
	readPendingCloudSave,
	writePendingCloudSave,
	type SessionStorageLike
} from '$lib/platform/project-persistence';

const PROJECT_ID = 'project:client-test';
const TOKEN = 'saved-base:11111111-1111-4111-8111-111111111111';

async function fixture() {
	const project = await createUnitProject({ id: PROJECT_ID, name: 'Client project' });
	const canonicalJson = serializeProjectEnvelope(project);
	const sourceContentId = await computeEnvelopeSourceContentId(project);
	const request: SaveRequest = {
		contentIdentityScheme: SAVE_CONTENT_IDENTITY_SCHEME,
		capture: {
			protocol: 'SaveAcceptedSource@1',
			projectId: PROJECT_ID,
			operationId: 'operation-1',
			precondition: { kind: 'create-only' },
			sourceKind: UNIT_SOURCE_KIND,
			sourceVersion: UNIT_SOURCE_VERSION,
			acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-1' },
			sourceContentId,
			canonicalJson
		}
	};
	return { project, canonicalJson, sourceContentId, request };
}

function acknowledgement(sourceContentId: string): SaveAcknowledgement {
	return {
		projectId: PROJECT_ID,
		name: 'Client project',
		version: 1,
		updatedAt: '2026-10-16T00:00:00.000Z',
		savedBaseToken: TOKEN,
		savedRevision: { projectId: PROJECT_ID, revisionId: 'revision-1' },
		sourceContentId
	};
}

function memoryStorage(): SessionStorageLike & { values: Map<string, string> } {
	const values = new Map<string, string>();
	return {
		values,
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => void values.set(key, value),
		removeItem: (key) => void values.delete(key)
	};
}

describe('client Save transport', () => {
	it('sends one conditional capture and reads the acknowledgement', async () => {
		const { sourceContentId, request } = await fixture();
		const calls: { url: string; init: RequestInit }[] = [];
		const api = createProjectApi({
			apiOrigin: 'https://api.example',
			fetch: async (url, init) => {
				calls.push({ url, init: init ?? {} });
				return new Response(JSON.stringify(acknowledgement(sourceContentId)), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}
		});
		if (!api) throw new Error('api was not created');

		const saved = await api.saveAcceptedSource(request);
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe(`https://api.example/projects/${encodeURIComponent(PROJECT_ID)}`);
		expect(calls[0].init.method).toBe('PUT');
		expect(JSON.parse(String(calls[0].init.body))).toEqual(request);
		expect(saved.savedBaseToken).toBe(TOKEN);
		expect(saved.savedRevision).toEqual({ projectId: PROJECT_ID, revisionId: 'revision-1' });
		expect(saved.sourceContentId).toBe(sourceContentId);
	});

	it('maps conflict, collision and auth without inventing a resolution', async () => {
		const cases = [
			{ status: 409, body: { error: { code: 'conflict', message: 'changed' } }, code: 'conflict' },
			{ status: 409, body: { error: { code: 'save_collision', message: 'exists' } }, code: 'collision' },
			{ status: 401, body: { error: { code: 'unauthorized', message: 'no' } }, code: 'auth' }
		] as const;

		for (const entry of cases) {
			const { request } = await fixture();
			const api = createProjectApi({
				apiOrigin: 'https://api.example',
				fetch: async () =>
					new Response(JSON.stringify(entry.body), {
						status: entry.status,
						headers: { 'content-type': 'application/json' }
					})
			});
			if (!api) throw new Error('api was not created');
			await expect(api.saveAcceptedSource(request)).rejects.toMatchObject({
				name: 'ProjectPersistenceError',
				code: entry.code
			});
		}
	});

	it('treats a gateway timeout and a throttle as retryable transport failures', async () => {
		for (const status of [408, 429]) {
			const { request } = await fixture();
			const api = createProjectApi({
				apiOrigin: 'https://api.example',
				fetch: async () =>
					new Response(JSON.stringify({ error: { code: 'upstream', message: 'later' } }), {
						status,
						headers: { 'content-type': 'application/json' }
					})
			});
			if (!api) throw new Error('api was not created');
			// `network` is what keeps the capture so the retry replays the same
			// operation and resolves through its receipt.
			await expect(api.saveAcceptedSource(request)).rejects.toMatchObject({
				name: 'ProjectPersistenceError',
				code: 'network',
				status
			});
		}
	});

	it('reads saved-base metadata beside the document, including a legacy null', async () => {
		const { project, sourceContentId } = await fixture();
		const responses = [
			{
				projectId: PROJECT_ID,
				name: 'Client project',
				version: 2,
				updatedAt: '2026-10-16T00:00:00.000Z',
				document: project,
				savedBaseToken: TOKEN,
				savedRevision: { projectId: PROJECT_ID, revisionId: 'revision-2' },
				savedSourceContentId: sourceContentId
			},
			{
				projectId: PROJECT_ID,
				name: 'Client project',
				version: 2,
				updatedAt: '2026-10-16T00:00:00.000Z',
				document: project,
				savedBaseToken: TOKEN,
				savedRevision: null,
				savedSourceContentId: null
			}
		];

		for (const body of responses) {
			const api = createProjectApi({
				apiOrigin: 'https://api.example',
				fetch: async () =>
					new Response(JSON.stringify(body), {
						status: 200,
						headers: { 'content-type': 'application/json' }
					})
			});
			if (!api) throw new Error('api was not created');
			const loaded = await api.loadProject(PROJECT_ID);
			expect(loaded.savedBaseToken).toBe(TOKEN);
			expect(loaded.savedRevision).toEqual(body.savedRevision);
			expect(loaded.savedSourceContentId).toBe(body.savedSourceContentId);
		}
	});
});

describe('project lifecycle transport', () => {
	const precondition = { kind: 'expected-saved-base' as const, token: TOKEN };

	it('sends a conditional PATCH and returns the refreshed rename acknowledgement', async () => {
		const { sourceContentId } = await fixture();
		const calls: { url: string; init: RequestInit }[] = [];
		const api = createProjectApi({
			apiOrigin: 'https://api.example',
			fetch: async (url, init) => {
				calls.push({ url, init: init ?? {} });
				return new Response(
					JSON.stringify({ ...acknowledgement(sourceContentId), name: 'Renamed project', version: 4 }),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				);
			}
		});
		if (!api) throw new Error('api was not created');

		const renamed = await api.renameProject(PROJECT_ID, { name: 'Renamed project', precondition });
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe(`https://api.example/projects/${encodeURIComponent(PROJECT_ID)}`);
		expect(calls[0].init.method).toBe('PATCH');
		expect(calls[0].init.credentials).toBe('include');
		expect(JSON.parse(String(calls[0].init.body))).toEqual({ name: 'Renamed project', precondition });
		expect(renamed).toMatchObject({
			projectId: PROJECT_ID,
			name: 'Renamed project',
			version: 4,
			savedBaseToken: TOKEN,
			sourceContentId
		});
	});

	it('sends the expected base on DELETE and preserves pending cleanup as a successful result', async () => {
		const calls: { url: string; init: RequestInit }[] = [];
		const api = createProjectApi({
			apiOrigin: 'https://api.example',
			fetch: async (url, init) => {
				calls.push({ url, init: init ?? {} });
				return new Response(JSON.stringify({ projectId: PROJECT_ID, cleanup: 'pending' }), {
					status: 202,
					headers: { 'content-type': 'application/json' }
				});
			}
		});
		if (!api) throw new Error('api was not created');

		await expect(api.deleteProject(PROJECT_ID, { precondition })).resolves.toEqual({
			projectId: PROJECT_ID,
			cleanup: 'pending'
		});
		expect(calls).toHaveLength(1);
		expect(calls[0].init.method).toBe('DELETE');
		expect(JSON.parse(String(calls[0].init.body))).toEqual({ precondition });
	});

	it('keeps stale lifecycle writes as conflicts and types a project-busy refusal for retry', async () => {
		const failures = [
			{
				status: 409,
				body: { error: { code: 'conflict', message: 'The saved base changed' } },
				code: 'conflict'
			},
			{
				status: 409,
				body: { error: { code: 'project_busy', message: 'An upload is still active' } },
				code: 'project-busy'
			}
		] as const;

		for (const failure of failures) {
			const api = createProjectApi({
				apiOrigin: 'https://api.example',
				fetch: async () =>
					new Response(JSON.stringify(failure.body), {
						status: failure.status,
						headers: { 'content-type': 'application/json' }
					})
			});
			if (!api) throw new Error('api was not created');
			await expect(api.deleteProject(PROJECT_ID, { precondition })).rejects.toMatchObject({
				name: 'ProjectPersistenceError',
				code: failure.code,
				status: failure.status
			});
		}
	});

	it('refuses a lifecycle acknowledgement for a different project', async () => {
		const api = createProjectApi({
			apiOrigin: 'https://api.example',
			fetch: async () =>
				new Response(JSON.stringify({ projectId: 'project:other', cleanup: 'complete' }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
		});
		if (!api) throw new Error('api was not created');
		await expect(api.deleteProject(PROJECT_ID, { precondition })).rejects.toMatchObject({
			name: 'ProjectPersistenceError',
			code: 'server'
		});
	});
});

describe('pending cloud Save draft', () => {
	it('carries the whole capture and keeps the ready reader shape', async () => {
		const { request, project } = await fixture();
		const storage = memoryStorage();
		expect(writePendingCloudSave(request, storage, 1000)).toBe(true);
		const pending = readPendingCloudSave(storage, 2000);
		expect(pending.status).toBe('ready');
		if (pending.status !== 'ready') throw new Error('expected ready');
		expect(pending.project.id).toBe(PROJECT_ID);
		expect(pending.project).toEqual(project);
		expect(pending.save).toEqual(request);
	});

	it('reads a legacy v1 document entry as invalid and clears it', () => {
		const storage = memoryStorage();
		storage.setItem(
			LEGACY_PENDING_CLOUD_SAVE_KEY,
			JSON.stringify({ createdAt: 1000, project: { id: PROJECT_ID } })
		);
		expect(readPendingCloudSave(storage, 2000)).toEqual({ status: 'invalid' });
		expect(storage.getItem(LEGACY_PENDING_CLOUD_SAVE_KEY)).toBeNull();
	});

	it('keeps a shape-valid capture for the server to recompute, and expires old drafts', async () => {
		const { request } = await fixture();
		const storage = memoryStorage();
		const tampered = {
			...request,
			capture: { ...request.capture, sourceContentId: `sha256-${'0'.repeat(64)}` }
		};
		// The draft is a capture, not an acceptance: the server still recomputes
		// the digest and refuses a mismatch when the draft is resumed.
		expect(writePendingCloudSave(tampered, storage, 1000)).toBe(true);
		expect(readPendingCloudSave(storage, 2000).status).toBe('ready');
		const expired = memoryStorage();
		expect(writePendingCloudSave(request, expired, 1000)).toBe(true);
		expect(readPendingCloudSave(expired, 1000 + 16 * 60 * 1000)).toEqual({ status: 'expired' });
		expect(expired.getItem(PENDING_CLOUD_SAVE_KEY)).toBeNull();
	});

	it('refuses a draft whose capture names a different project than its bytes', async () => {
		const { request } = await fixture();
		// Shape-valid (the capture and revision agree with each other) but the
		// canonical bytes belong to another project: resuming it would save one
		// project while the reader shows another.
		const mismatched = {
			...request,
			capture: {
				...request.capture,
				projectId: 'project:other',
				acceptedRevision: { projectId: 'project:other', revisionId: 'revision-1' }
			}
		};
		const storage = memoryStorage();
		expect(writePendingCloudSave(mismatched, storage, 1000)).toBe(false);
		expect(storage.getItem(PENDING_CLOUD_SAVE_KEY)).toBeNull();

		// The same entry written by an older build is invalid on read and cleared.
		storage.setItem(PENDING_CLOUD_SAVE_KEY, JSON.stringify({ createdAt: 1000, save: mismatched }));
		expect(readPendingCloudSave(storage, 2000)).toEqual({ status: 'invalid' });
		expect(storage.getItem(PENDING_CLOUD_SAVE_KEY)).toBeNull();
	});

	it('clears both the current and legacy slots', async () => {
		const { request } = await fixture();
		const storage = memoryStorage();
		writePendingCloudSave(request, storage, 1000);
		storage.setItem(LEGACY_PENDING_CLOUD_SAVE_KEY, '{}');
		clearPendingCloudSave(storage);
		expect(storage.getItem(PENDING_CLOUD_SAVE_KEY)).toBeNull();
		expect(storage.getItem(LEGACY_PENDING_CLOUD_SAVE_KEY)).toBeNull();
	});

	it('does not write a bare document', () => {
		const storage = memoryStorage();
		expect(writePendingCloudSave({ project: {}, createdAt: 1 } as unknown as SaveRequest, storage)).toBe(false);
		expect(storage.getItem(PENDING_CLOUD_SAVE_KEY)).toBeNull();
	});
});

describe('ProjectPersistenceError', () => {
	it('keeps the server refusal code and issues for the Save state', () => {
		const failure = new ProjectPersistenceError('invalid', 'refused', 400, 'identity-scheme-mismatch', [
			{ path: '$.capture', code: 'x', message: 'y' }
		]);
		expect(failure.code).toBe('invalid');
		expect(failure.serverCode).toBe('identity-scheme-mismatch');
		expect(failure.issues).toHaveLength(1);
	});
});
