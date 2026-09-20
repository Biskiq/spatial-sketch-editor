import { describe, expect, it, vi } from 'vitest';

import { createEmptyProject, createEmptyWallFirstProject } from '$lib/project/project-codec';
import {
	clearPendingCloudSave,
	createProjectApi,
	createProjectAuth,
	createProjectId,
	PENDING_CLOUD_SAVE_KEY,
	PENDING_CLOUD_SAVE_MAX_AGE_MS,
	ProjectPersistenceError,
	projectFingerprint,
	readPendingCloudSave,
	sameProjectFingerprint,
	writePendingCloudSave
} from '$lib/editor/project-persistence';
import { readLibSource } from '../../helpers/lib-source';
import { serializeProject } from '$lib/project/project-codec';

const project = createEmptyProject({ id: 'project:one', name: 'One' });
const assetId = '123e4567-e89b-12d3-a456-426614174000';
const assetBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const assetMetadata = (importState: 'pending' | 'ready' | 'failed') => ({
	id: assetId,
	projectId: project.id,
	name: 'Warm Stone',
	kind: 'texture',
	storageKind: 'r2',
	sourceKind: 'upload',
	sourceRef: null,
	mime: importState === 'pending' ? null : 'image/png',
	byteSize: importState === 'pending' ? null : assetBytes.byteLength,
	sha256: importState === 'pending' ? null : `sha256-${'a'.repeat(64)}`,
	importState,
	createdAt: '2026-09-03T00:00:00.000Z',
	updatedAt: '2026-09-03T00:00:00.000Z'
});

describe('project persistence client', () => {
	it('uses secure cookie credentials and exact semantic request routes', async () => {
		const fetchImpl = vi.fn(async (_input: string, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body));
			expect(body.document).toEqual(project);
			expect(init?.credentials).toBe('include');
			expect(init?.headers).toMatchObject({ Accept: 'application/json', 'Content-Type': 'application/json' });
			expect(init?.headers).not.toHaveProperty('Authorization');
			return new Response(JSON.stringify({
				projectId: project.id,
				version: 1,
				name: project.name,
				updatedAt: '2026-08-31T00:00:00.000Z'
			}), { status: 200 });
		});
		const api = createProjectApi({ apiOrigin: 'https://api.example.test/' }, fetchImpl)!;

		await expect(api.saveProject(project)).resolves.toMatchObject({ projectId: project.id, version: 1 });
		expect(fetchImpl).toHaveBeenCalledWith(
			'https://api.example.test/projects/project%3Aone',
			expect.objectContaining({ method: 'PUT', credentials: 'include' })
		);
	});

	it('uses the session client for /auth/me and logout without exposing tokens', async () => {
		const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
			if (input.endsWith('/auth/me')) {
				return new Response(JSON.stringify({ authenticated: true, user: { id: 'google:123' } }), { status: 200 });
			}
			expect(input).toBe('https://api.example.test/auth/logout');
			expect(init?.method).toBe('POST');
			expect(init?.credentials).toBe('include');
			return new Response(null, { status: 204 });
		});
		const auth = createProjectAuth('https://api.example.test/', fetchImpl);

		await expect(auth.getSession()).resolves.toEqual({ authenticated: true, user: { id: 'google:123' } });
		await expect(auth.signOut()).resolves.toBeUndefined();
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('maps a rejected session and bounded project errors', async () => {
		const fetchImpl = vi.fn(async (input: string) => {
			if (input.endsWith('/auth/me')) return new Response(JSON.stringify({ authenticated: false }), { status: 200 });
			return new Response(JSON.stringify({ error: { message: 'Not Found' } }), { status: 404 });
		});
		const auth = createProjectAuth('https://api.example.test', fetchImpl);
		await expect(auth.getSession()).resolves.toEqual({ authenticated: false });

		const api = createProjectApi({ apiOrigin: 'https://api.example.test' }, fetchImpl)!;
		await expect(api.loadProject(project.id)).rejects.toEqual(
			expect.objectContaining({ code: 'not-found', status: 404 })
		);
	});

	it('uses the configured fetch implementation when no call-site override is supplied', async () => {
		const fetch = vi.fn(async () => new Response(JSON.stringify({ projects: [] }), { status: 200 }));
		const api = createProjectApi({ apiOrigin: 'https://api.example.test', fetch })!;

		await expect(api.listProjects()).resolves.toEqual([]);
		expect(fetch).toHaveBeenCalledWith(
			'https://api.example.test/projects',
			expect.objectContaining({ method: 'GET', credentials: 'include' })
		);
	});

	it('uses credentialed project-asset routes and keeps upload bytes raw', async () => {
		const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
			if (input.endsWith('/projects/project%3Aone/assets') && init?.method === 'GET') {
				return new Response(JSON.stringify({ assets: [assetMetadata('ready')] }), { status: 200 });
			}
			if (input.endsWith('/projects/project%3Aone/assets') && init?.method === 'POST') {
				expect(JSON.parse(String(init.body))).toEqual({ name: 'Warm Stone' });
				return new Response(JSON.stringify(assetMetadata('pending')), { status: 201 });
			}
			if (input.endsWith(`/assets/${assetId}/content`) && init?.method === 'PUT') {
				expect(Array.from(init.body as Uint8Array)).toEqual(Array.from(assetBytes));
				expect(init.credentials).toBe('include');
				expect(init.signal).toBe(signal);
				expect(init.headers).toEqual({
					Accept: 'application/json',
					'Content-Type': 'application/octet-stream'
				});
				expect(init.headers).not.toHaveProperty('Content-Length');
				return new Response(JSON.stringify(assetMetadata('ready')), { status: 200 });
			}
			if (input.endsWith(`/assets/${assetId}/content`) && init?.method === 'GET') {
				expect(init.credentials).toBe('include');
				expect(init.signal).toBe(signal);
				return new Response(assetBytes, {
					status: 200,
					headers: {
						'Content-Length': String(assetBytes.byteLength),
						'Content-Type': 'image/png'
					}
				});
			}
			throw new Error(`Unexpected request: ${input}`);
		});
		const api = createProjectApi({ apiOrigin: 'https://api.example.test/' }, fetchImpl)!;
		const signalController = new AbortController();
		const signal = signalController.signal;

		await expect(api.listAssets(project.id, signal)).resolves.toHaveLength(1);
		await expect(api.registerAsset(project.id, 'Warm Stone', signal)).resolves.toMatchObject({
			id: assetId,
			importState: 'pending'
		});
		await expect(api.uploadAsset(project.id, assetId, assetBytes, signal)).resolves.toMatchObject({
			id: assetId,
			importState: 'ready'
		});
		await expect(api.loadAssetContent(project.id, assetId, signal)).resolves.toEqual({
			mime: 'image/png',
			bytes: assetBytes
		});
		expect(fetchImpl).toHaveBeenCalledTimes(4);
	});

	it('rejects extra or wrongly typed project-asset metadata', async () => {
		const extra = vi.fn(async () =>
			new Response(JSON.stringify({ ...assetMetadata('ready'), objectKey: 'private/key' }), { status: 200 })
		);
		const wrongType = vi.fn(async () =>
			new Response(JSON.stringify({ ...assetMetadata('ready'), byteSize: String(assetBytes.byteLength) }), { status: 200 })
		);

		await expect(createProjectApi({ apiOrigin: 'https://api.example.test' }, extra)!.listAssets(project.id)).rejects.toMatchObject({
			code: 'server'
		});
		await expect(createProjectApi({ apiOrigin: 'https://api.example.test' }, wrongType)!.registerAsset(project.id, 'Warm Stone')).rejects.toMatchObject({
			code: 'server'
		});
	});

	it('maps asset status errors and preserves aborts', async () => {
		const rejected = vi.fn(async () =>
			new Response(JSON.stringify({ error: { message: 'Asset Not Ready' } }), { status: 409 })
		);
		const api = createProjectApi({ apiOrigin: 'https://api.example.test' }, rejected)!;
		await expect(api.loadAssetContent(project.id, assetId)).rejects.toMatchObject({ code: 'invalid', status: 409 });

		const controller = new AbortController();
		const aborted = vi.fn(async (_input: string, init?: RequestInit) => {
			throw new DOMException('aborted', 'AbortError');
		});
		const abortApi = createProjectApi({ apiOrigin: 'https://api.example.test' }, aborted)!;
		await expect(abortApi.listAssets(project.id, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
	});

	it('requires a bounded content length and matches the final byte count', async () => {
		const missingLength = vi.fn(async () => ({
			ok: true,
			headers: new Headers({ 'Content-Type': 'image/png' }),
			get body() {
				throw new Error('body must not be read without Content-Length');
			}
		} as unknown as Response));
		await expect(
			createProjectApi({ apiOrigin: 'https://api.example.test' }, missingLength)!.loadAssetContent(
				project.id,
				assetId
			)
		).rejects.toMatchObject({ code: 'server' });

		const oversized = vi.fn(async () => ({
			ok: true,
			headers: new Headers({
				'Content-Length': String(25 * 1024 * 1024 + 1),
				'Content-Type': 'image/png'
			}),
			get body() {
				throw new Error('body must not be read after the size check');
			}
		} as unknown as Response));
		await expect(
			createProjectApi({ apiOrigin: 'https://api.example.test' }, oversized)!.loadAssetContent(
				project.id,
				assetId
			)
		).rejects.toMatchObject({ code: 'server' });

		const shortBody = vi.fn(async () =>
			new Response(assetBytes, {
				status: 200,
				headers: {
					'Content-Length': String(assetBytes.byteLength + 1),
					'Content-Type': 'image/png'
				}
			})
		);
		await expect(
			createProjectApi({ apiOrigin: 'https://api.example.test' }, shortBody)!.loadAssetContent(
				project.id,
				assetId
			)
		).rejects.toMatchObject({ code: 'server' });

		const longBody = vi.fn(async () =>
			new Response(new Uint8Array([1, 2]), {
				status: 200,
				headers: { 'Content-Length': '1', 'Content-Type': 'image/png' }
			})
		);
		await expect(
			createProjectApi({ apiOrigin: 'https://api.example.test' }, longBody)!.loadAssetContent(
				project.id,
				assetId
			)
		).rejects.toMatchObject({ code: 'server' });
	});

	it('keeps project ids native and fingerprints all three live fields', () => {
		expect(createProjectId(() => 'uuid')).toBe('project:uuid');
		const first = projectFingerprint('scene-a', 'layout-a', 'One');
		expect(sameProjectFingerprint(first, projectFingerprint('scene-a', 'layout-a', 'One'))).toBe(true);
		expect(sameProjectFingerprint(first, projectFingerprint('scene-b', 'layout-a', 'One'))).toBe(false);
		expect(sameProjectFingerprint(first, projectFingerprint('scene-a', 'layout-b', 'One'))).toBe(false);
		expect(sameProjectFingerprint(first, projectFingerprint('scene-a', 'layout-a', 'Two'))).toBe(false);
		expect(new ProjectPersistenceError('auth', 'Sign-in is required')).toBeInstanceOf(Error);
	});

	it('validates, bounds, and clears the session-only Save handoff', () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
			removeItem: (key: string) => values.delete(key)
		};
		const now = 1_000_000;

		expect(writePendingCloudSave(project, storage, now)).toBe(true);
		expect(JSON.parse(values.get(PENDING_CLOUD_SAVE_KEY)!)).toEqual({ createdAt: now, project });
		expect(readPendingCloudSave(storage, now)).toEqual({ status: 'ready', project });

		values.set(PENDING_CLOUD_SAVE_KEY, JSON.stringify({ createdAt: now - PENDING_CLOUD_SAVE_MAX_AGE_MS - 1, project }));
		expect(readPendingCloudSave(storage, now)).toEqual({ status: 'expired' });
		expect(values.has(PENDING_CLOUD_SAVE_KEY)).toBe(false);

		values.set(PENDING_CLOUD_SAVE_KEY, JSON.stringify({ createdAt: now, project, token: 'never' }));
		expect(readPendingCloudSave(storage, now)).toEqual({ status: 'invalid' });
		expect(values.has(PENDING_CLOUD_SAVE_KEY)).toBe(false);

		writePendingCloudSave(project, storage, now);
		clearPendingCloudSave(storage);
		expect(values.has(PENDING_CLOUD_SAVE_KEY)).toBe(false);
	});

	it('refuses a superseded layout version instead of persisting it', () => {
		// The session handoff is a writer, so it carries the same current-format
		// gate as `serializeProject()`: a payload declaring any other version fails
		// closed rather than freezing superseded meaning into the handoff. P23.6I
		// recognizes one wall-first version, so `4` is unsupported, not migrated.
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
			removeItem: (key: string) => values.delete(key)
		};
		const project = createEmptyWallFirstProject({ id: 'project:superseded', name: 'Superseded' });
		const superseded = {
			...project,
			layout: { ...project.layout, formatVersion: 4 }
		};

		expect(writePendingCloudSave(superseded, storage, 1_000_000)).toBe(false);
		expect(values.has(PENDING_CLOUD_SAVE_KEY)).toBe(false);
		// The current-format document still writes normally.
		expect(writePendingCloudSave(project, storage, 1_000_000)).toBe(true);
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('P19 project persistence coordinator contracts', () => {
	it('rechecks cloud durability at the final submit boundary for resumed drafts', () => {
		const app = readLibSource('editor/app/EditorApp.svelte');
		const submitStart = app.indexOf('async function submitSaveSnapshot');
		const submit = app.slice(submitStart, app.indexOf('async function signOutFromProjects', submitStart));

		expect(submit).toContain('computeCloudSaveBlocker(snapshot.project.scene,');
		expect(submit).toContain('isReadyProjectAssetForSave(uri, snapshot.project.id)');
		expect(submit.indexOf('computeCloudSaveBlocker(snapshot.project.scene,')).toBeLessThan(
			submit.indexOf('await projectApi!.saveProject')
		);
	});
	it('keeps one first-save identity and settles trimmed-name baselines', () => {
		const app = readLibSource('editor/app/EditorApp.svelte');
		const saveStart = app.indexOf('function captureValidatedSaveSnapshot');
		const save = app.slice(saveStart, app.indexOf('async function loadProject', saveStart));

		expect(save).toContain('const saveProjectId = projectId ?? createProjectId();');
		expect(save).toContain('id: saveProjectId');
		expect(save).toContain('if (projectId === null) projectId = snapshot.project.id;');
		expect(save.indexOf('if (projectId === null) projectId = snapshot.project.id;')).toBeLessThan(
			save.indexOf('await projectApi!.saveProject')
		);
		expect(save).toContain('if (projectName.trim() === snapshot.project.name) projectName = snapshot.project.name;');
		expect(save).toContain('store.markSaved(snapshot.sceneCanonicalJson)');
		// P23.12 — the baseline is the authored layout form (the reference cursor is
		// bookkeeping), and promotion ran before the payload was built.
		expect(save).toContain('promoteLayoutPreviewIdentity(layoutPreview);');
		// P23.12 review fix — and it is the authored form of the **snapshot that was
		// sent**, never the live document: an edit made while the request is in
		// flight is not in the persisted payload, so it must stay dirty.
		expect(save).toContain(
			'layoutAuthoredJsonOf(snapshot.project.layout as unknown as EditorLayoutDocument)'
		);
		const baselineCall = save.indexOf('markLayoutPreviewSaved(');
		expect(baselineCall).toBeGreaterThan(-1);
		expect(save.slice(baselineCall, baselineCall + 200)).not.toContain('layoutPreviewAuthoredJson');
		expect(save).toContain(
			'{ id: saved.projectId, name: saved.name, version: saved.version, updatedAt: saved.updatedAt },'
		);
	});
	it('normalizes a wholesale replacement before install and re-derives the resumed payload', () => {
		const app = readLibSource('editor/app/EditorApp.svelte');
		// P23.12 review fix — a pre-P23.12 project must install with references
		// instead of staying ledger-less until the next mutation or Save, so both
		// Load and the resumed draft normalize the incoming document and derive the
		// bundle from its own repaired cursor.
		const loadStart = app.indexOf('async function loadProject');
		const load = app.slice(loadStart, app.indexOf('async function signOutFromProjects', loadStart));
		expect(load).toContain('normalizeIncomingLayout(');
		expect(load).toContain('replacementIdentityBase(incomingLayout)');
		// Normalization happens on the loaded payload, after the request resolves
		// and before the install bundle is derived.
		expect(load.indexOf('await projectApi!.loadProject')).toBeLessThan(
			load.indexOf('normalizeIncomingLayout(')
		);
		expect(load.indexOf('normalizeIncomingLayout(')).toBeLessThan(
			load.indexOf('const bundle = derivePreviewBundle(')
		);
		expect(load).toContain('markLayoutPreviewSaved(layoutPreview, layoutPreviewAuthoredJson(layoutPreview))');

		const resumeStart = app.indexOf('async function resumePendingCloudSave');
		const resume = app.slice(resumeStart, app.indexOf('async function loadProject', resumeStart));
		expect(resume).toContain('normalizeIncomingLayout(');
		expect(resume).toContain('replacementIdentityBase(incomingLayout)');
		// The submitted payload is the installed, promoted snapshot — never the raw
		// pending payload, which would let `layout` and `layoutCanonicalJson`
		// disagree once promotion wrote the identity block.
		expect(resume).toContain('const resumed = captureValidatedSaveSnapshot();');
		expect(resume).toContain('await submitSaveSnapshot(resumed);');
		expect(resume).not.toContain('await submitSaveSnapshot({');
	});
	it('drops stale project lists around mutations and keeps project replacement guarded', () => {
		const app = readLibSource('editor/app/EditorApp.svelte');
		const refresh = app.slice(
			app.indexOf('async function refreshOwnedProjects'),
			app.indexOf('async function signInToProjects')
		);
		const gate = app.slice(
			app.indexOf('function canStartProjectMutation'),
			app.indexOf('function confirmProjectReplacement')
		);
		const load = app.slice(app.indexOf('async function loadProject'));

		expect(refresh).toContain('const requestToken = ++projectListRequestToken;');
		expect(refresh).toContain('const mutationEpoch = projectMutationEpoch;');
		expect(refresh).toContain('requestToken !== projectListRequestToken');
		expect(refresh).toContain('mutationEpoch !== projectMutationEpoch');
		expect(gate).toContain('store.isEditorInteractionActive || store.isDocumentTransactionActive');
		expect(load).toContain('sameProjectFingerprint(fingerprint, currentProjectFingerprint())');
		expect(load).toContain('store.isEditorInteractionActive || store.isDocumentTransactionActive');
	});
	it('does not expose disabled cloud chrome and keeps the relic controller-free', () => {
		const menu = readLibSource('editor/EditorProjectMenu.svelte');
		const relic = readLibSource('editor/MuseumEditorApp.svelte');

		expect(menu).toContain('{#if !relic && cloudConfigured}');
		expect(menu).toContain("const cloudConfigured = $derived(cloudStatus !== 'disabled' && onSaveProject !== undefined);");
		expect(menu).toContain('Save your project');
		expect(menu).toContain('Sign in with Google to save this project and access it later.');
		expect(menu).toContain('Discard draft');
		expect(relic).toContain('<EditorAppBar {store} {layoutPreview} {confirmSceneReplacement} {confirmLayoutReplacement} {relic} />');
	});
});
