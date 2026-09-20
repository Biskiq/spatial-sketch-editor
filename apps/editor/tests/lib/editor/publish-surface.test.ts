import { describe, expect, it, vi } from 'vitest';

import {
	createPublicationApi,
	derivePublicPath,
	derivePublicUrl,
	PublicationClientError
} from '$lib/editor/publication-client';
import { publicationPresentation } from '$lib/editor/app/publication-presentation';

const PUB_ID = '11111111-1111-4111-8111-111111111111';

function statusResponse(overrides: Record<string, unknown> = {}) {
	return {
		publicationId: null,
		activeVersion: null,
		revision: 0,
		currentVersion: 1,
		createdAt: null,
		updatedAt: null,
		...overrides
	};
}

function jsonResponse(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

const publishedStatus = () =>
	statusResponse({
		publicationId: PUB_ID,
		activeVersion: 2,
		revision: 1,
		currentVersion: 2,
		createdAt: '2026-09-08T00:00:00.000Z',
		updatedAt: '2026-09-08T00:00:00.000Z'
	});

describe('P22.4 publication client', () => {
	it('uses secure cookie credentials and exact owner routes', async () => {
		const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
			expect(init?.credentials).toBe('include');
			expect(init?.headers).toMatchObject({ Accept: 'application/json' });
			expect(init?.headers).not.toHaveProperty('Authorization');
			if (input.endsWith('/projects/project%3Aone/publication') && init?.method === 'GET') {
				return jsonResponse(statusResponse());
			}
			if (input.endsWith('/projects/project%3Aone/publication') && init?.method === 'PUT') {
				expect(JSON.parse(String(init.body))).toEqual({ version: 1, expectedPublicationRevision: 0 });
				return jsonResponse(statusResponse({ publicationId: PUB_ID, activeVersion: 1, revision: 1 }));
			}
			if (input.endsWith('/projects/project%3Aone/publication') && init?.method === 'DELETE') {
				expect(JSON.parse(String(init.body))).toEqual({ expectedPublicationRevision: 1 });
				return jsonResponse(statusResponse({ publicationId: PUB_ID, activeVersion: null, revision: 2 }));
			}
			throw new Error(`Unexpected request: ${input} ${init?.method}`);
		});
		const api = createPublicationApi({ apiOrigin: 'https://api.example.test/' }, fetchImpl)!;

		await expect(api.getStatus('project:one')).resolves.toMatchObject({ revision: 0 });
		await expect(api.publishVersion('project:one', 1, 0)).resolves.toMatchObject({
			publicationId: PUB_ID,
			activeVersion: 1,
			revision: 1
		});
		await expect(api.unpublishVersion('project:one', 1)).resolves.toMatchObject({
			activeVersion: null,
			revision: 2
		});
		expect(fetchImpl).toHaveBeenCalledTimes(3);
	});

	it('returns null without an API origin and throws without fetch', () => {
		expect(createPublicationApi({ apiOrigin: '' })).toBeNull();
		expect(createPublicationApi({})).toBeNull();
	});

	it('rejects leaking or malformed status shapes', async () => {
		const leaking = vi.fn(async () => jsonResponse({ ...statusResponse(), objectKey: 'private/key' }));
		await expect(
			createPublicationApi({ apiOrigin: 'https://api.test' }, leaking)!.getStatus('project:one')
		).rejects.toMatchObject({ code: 'server' });

		const badId = vi.fn(async () => jsonResponse(statusResponse({ publicationId: 'not-a-uuid' })));
		await expect(
			createPublicationApi({ apiOrigin: 'https://api.test' }, badId)!.getStatus('project:one')
		).rejects.toMatchObject({ code: 'server' });

		const missing = vi.fn(async () => jsonResponse({ revision: 0 }));
		await expect(
			createPublicationApi({ apiOrigin: 'https://api.test' }, missing)!.getStatus('project:one')
		).rejects.toMatchObject({ code: 'server' });
	});

	it('maps auth, non-disclosing 404, revision conflicts, validation and server errors', async () => {
		const apiFor = (response: Response) =>
			createPublicationApi({ apiOrigin: 'https://api.test' }, vi.fn(async () => response))!;

		await expect(apiFor(new Response(JSON.stringify({ error: { message: 'x' } }), { status: 401 })).getStatus('p')).rejects.toMatchObject({
			code: 'auth',
			status: 401
		});
		await expect(apiFor(new Response(null, { status: 404 })).getStatus('p')).rejects.toMatchObject({
			code: 'not-found',
			status: 404
		});

		const conflictBody = { error: { code: 'revision_conflict', message: 'changed' }, revision: 2 };
		const conflict = await apiFor(jsonResponse(conflictBody, 409))
			.publishVersion('p', 1, 1)
			.catch((error: unknown) => error);
		expect(conflict).toBeInstanceOf(PublicationClientError);
		expect(conflict).toMatchObject({ code: 'conflict', status: 409, revision: 2 });

		await expect(
			apiFor(jsonResponse({ error: { code: 'invalid_publication', message: 'Unknown saved version 9' } }, 400)).publishVersion('p', 9, 0)
		).rejects.toMatchObject({ code: 'invalid', status: 400 });
		await expect(apiFor(new Response(null, { status: 503 })).getStatus('p')).rejects.toMatchObject({
			code: 'server'
		});
	});

	it('maps network failures and preserves aborts', async () => {
		const down = vi.fn(async () => {
			throw new TypeError('fetch failed');
		});
		await expect(
			createPublicationApi({ apiOrigin: 'https://api.test' }, down)!.getStatus('p')
		).rejects.toMatchObject({ code: 'network' });

		const controller = new AbortController();
		controller.abort();
		const aborted = vi.fn(async (_input: string, init?: RequestInit) => {
			if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
			throw new Error('must not fetch after abort');
		});
		await expect(
			createPublicationApi({ apiOrigin: 'https://api.test' }, aborted)!.getStatus('p', controller.signal)
		).rejects.toMatchObject({ name: 'AbortError' });
	});

	it('derives the same-origin public route from the publication ID, never an absolute URL', () => {
		expect(derivePublicPath(PUB_ID)).toBe(`/p/${PUB_ID}`);
		expect(derivePublicUrl(PUB_ID, 'https://editor.test')).toBe(`https://editor.test/p/${PUB_ID}`);
		expect(derivePublicPath(PUB_ID)).not.toContain('http');
	});
});

describe('P22.4 publish presentation', () => {
	const owned = {
		sessionStatus: 'authenticated' as const,
		isOwned: true,
		savedVersion: 2,
		isDirty: false,
		saveBlocker: null,
		apiConfigured: true,
		status: publishedStatus(),
		statusLoading: false,
		statusError: null,
		mutationBusy: false
	};

	it('gates guests without touching draft preview eligibility', () => {
		const model = publicationPresentation({ ...owned, sessionStatus: 'unauthenticated', status: null });
		expect(model.state).toBe('guest');
		expect(model.primaryAction).toBeNull();
		expect(model.detail).toMatch(/draft Preview keeps working/);
	});

	it('gates unsaved projects with an explicit save-first action', () => {
		const model = publicationPresentation({ ...owned, isOwned: false, savedVersion: null, status: null });
		expect(model.state).toBe('unsaved');
		expect(model.primaryDisabledReason).toMatch(/Save the project/);
		expect(model.detail).toMatch(/never.*automatically|nothing is published automatically/i);
	});

	it('blocks dirty drafts and surfaces the save blocker', () => {
		const dirty = publicationPresentation({ ...owned, isDirty: true, savedVersion: 3 });
		expect(dirty.state).toBe('dirty');
		expect(dirty.primaryDisabledReason).toBe('Unsaved draft changes');
		expect(dirty.detail).toMatch(/never saves for you/);

		const blocked = publicationPresentation({
			...owned,
			saveBlocker: 'Resolve texture asset references before saving'
		});
		expect(blocked.state).toBe('dirty');
		expect(blocked.primaryDisabledReason).toBe('Resolve texture asset references before saving');
	});

	it('blocks a stale baseline and never rewrites local work', () => {
		// Server moved past this session (another tab saved v3).
		const stale = publicationPresentation({
			...owned,
			savedVersion: 2,
			status: { ...publishedStatus(), currentVersion: 3 }
		});
		expect(stale.state).toBe('stale');
		expect(stale.primaryAction).toBeNull();
		expect(stale.canUnpublish).toBe(false);
		expect(stale.detail).toMatch(/left untouched/);
	});

	it('refreshes instead of crying stale after this session saved', () => {
		const refreshing = publicationPresentation({
			...owned,
			savedVersion: 3,
			status: { ...publishedStatus(), currentVersion: 2 }
		});
		expect(refreshing.state).toBe('status-loading');
		expect(refreshing.primaryDisabledReason).toMatch(/Refreshing/);
	});

	it('offers one clear publish action when never published', () => {
		const model = publicationPresentation({
			...owned,
			savedVersion: 1,
			status: statusResponse({ currentVersion: 1 })
		});
		expect(model.state).toBe('never-published');
		expect(model.primaryAction).toBe('publish');
		expect(model.primaryLabel).toBe('Publish saved version 1');
		expect(model.publicPath).toBeNull();
		expect(model.canUnpublish).toBe(false);
	});

	it('reports up-to-date output with copy/open/unpublish secondaries', () => {
		expect(owned.status.activeVersion).toBe(2);
		const model = publicationPresentation(owned);
		expect(model.state).toBe('current');
		expect(model.primaryAction).toBeNull();
		expect(model.canUnpublish).toBe(true);
		expect(model.publicPath).toBe(`/p/${PUB_ID}`);
		expect(model.showPublicLink).toBe(true);
		expect(model.detail).toMatch(/leave this published version unchanged/);
	});

	it('offers update when saved changes are unpublished', () => {
		const model = publicationPresentation({
			...owned,
			savedVersion: 3,
			status: { ...publishedStatus(), currentVersion: 3 }
		});
		expect(model.state).toBe('behind');
		expect(model.primaryAction).toBe('update');
		expect(model.primaryLabel).toBe('Update to version 3');
		expect(model.canUnpublish).toBe(true);
	});

	it('keeps the reserved link visible while unpublished', () => {
		const model = publicationPresentation({
			...owned,
			status: { ...publishedStatus(), activeVersion: null, revision: 3, currentVersion: 2 }
		});
		expect(model.state).toBe('unpublished');
		expect(model.primaryAction).toBe('publish');
		expect(model.publicPath).toBe(`/p/${PUB_ID}`);
		expect(model.showPublicLink).toBe(false);
		expect(model.canUnpublish).toBe(false);
	});

	it('disables everything while a mutation is in flight', () => {
		const model = publicationPresentation({ ...owned, mutationBusy: true });
		expect(model.primaryDisabledReason).toBe('Request in flight');
		expect(model.canUnpublish).toBe(false);
	});

	it('fails closed on status errors while preserving retry', () => {
		const model = publicationPresentation({
			...owned,
			status: null,
			statusError: 'Cloud service is unavailable'
		});
		expect(model.state).toBe('status-failed');
		expect(model.primaryAction).toBeNull();
		expect(model.detail).toMatch(/last working publication is unchanged/);
	});
});
