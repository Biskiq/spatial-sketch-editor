import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmptyProject } from '@portfolio/project-model';
import {
	fetchPublicRelease,
	fetchPublicReleaseBytes,
	loadPublicReleaseBundle,
	isValidPublicationId,
	PublicVisitorError
} from '$lib/visitor/public-release-client';
import {
	isForbiddenPreviewSurfaceModule,
	validatePreviewSurfaceGraph
} from '$lib/visitor/preview-surface-boundary';
import {
	createVisitorRuntimeState,
	visitorMainFlowNodeIds,
	visitorStartNodeId
} from '$lib/visitor/visitor-runtime-state.svelte';

const PUB_A = '11111111-1111-4111-8111-111111111111';
const PUB_B = '22222222-2222-4222-8222-222222222222';
const ASSET_ID = '33333333-3333-4333-8333-333333333333';

const PNG_BYTES = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x01, 0x02, 0x03
]);

function releasePayload(document: unknown, assets: Array<{ assetId: string; mime: string; byteSize: number }> = []) {
	return {
		name: (document as { name: string }).name,
		version: 1,
		revision: 1,
		document,
		assets
	};
}

function jsonResponse(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

function bytesResponse(bytes: Uint8Array, mime: string): Response {
	return new Response(bytes as unknown as BodyInit, {
		status: 200,
		headers: { 'Content-Type': mime, 'Content-Length': String(bytes.byteLength) }
	});
}

describe('P22.3 public release client', () => {
	it('rejects malformed publication IDs without fetching', async () => {
		const fetchImpl = vi.fn(async () => jsonResponse({}));
		await expect(fetchPublicRelease({ publicationId: 'not-a-uuid', apiOrigin: 'https://api.test', fetchImpl })).rejects.toMatchObject({
			code: 'not-found'
		});
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(isValidPublicationId(PUB_A)).toBe(true);
		expect(isValidPublicationId('not-a-uuid')).toBe(false);
	});

	it('loads an empty project cold with zero camera nodes and no storage', async () => {
		const project = createEmptyProject({ id: 'project:public-empty', name: 'Empty Public' });
		const requested: string[] = [];
		const fetchImpl = vi.fn(async (input: string, _init?: RequestInit) => {
			requested.push(input);
			return jsonResponse(releasePayload(project));
		});
		const { bundle, version } = await loadPublicReleaseBundle({
			publicationId: PUB_A,
			apiOrigin: 'https://api.test/',
			fetchImpl
		});
		try {
			expect(version).toBe(1);
			expect(bundle.projectName).toBe('Empty Public');
			expect(bundle.graph.navigationNodes).toHaveLength(0);
			expect(bundle.releaseId).toBe(`${PUB_A}@v1`);
			expect(bundle.textureScope.resolveTexture('/textures/plaster-warm/map.png')).toBe(
				'/textures/plaster-warm/map.png'
			);
			// Anonymous cold boot: only the public endpoints are read, never
			// live draft/project rows, and no credentials are attached.
			expect(requested).toHaveLength(1);
			expect(requested[0]).toBe(`https://api.test/publications/${PUB_A}`);
			const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
			expect(init.credentials).toBeUndefined();
		} finally {
			bundle.dispose();
		}
		expect(bundle.textureScope.resolveTexture('/textures/plaster-warm/map.png')).toBeNull();
	});

	it('uses the released document name and verifies P20 bytes before install', async () => {
		const project = createEmptyProject({ id: 'project:public-tex', name: 'Released Title' });
		const uri = `/project-assets/${ASSET_ID}`;
		const document = {
			...project,
			scene: { ...project.scene, textures: [{ id: 'tex-1', name: 'Pinned', uri }] }
		};
		const assets = [{ assetId: ASSET_ID, mime: 'image/png', byteSize: PNG_BYTES.byteLength }];
		const requested: string[] = [];
		const fetchImpl = vi.fn(async (input: string) => {
			requested.push(input);
			if (input.endsWith(`/publications/${PUB_A}`)) return jsonResponse(releasePayload(document, assets));
			if (input.includes(`/versions/1/assets/${ASSET_ID}/content`)) return bytesResponse(PNG_BYTES, 'image/png');
			throw new Error(`Unexpected request: ${input}`);
		});
		const { bundle } = await loadPublicReleaseBundle({
			publicationId: PUB_A,
			apiOrigin: 'https://api.test',
			fetchImpl
		});
		try {
			// Later saved renames stay invisible: the bundle carries the
			// snapshot name, and the loader never reads the live project row.
			expect(bundle.projectName).toBe('Released Title');
			expect(bundle.textureScope.objectUrlByUri.has(uri)).toBe(true);
			expect(requested.every((url) => url.includes('/publications/'))).toBe(true);
			expect(requested.some((url) => url.includes('/projects/'))).toBe(false);
		} finally {
			bundle.dispose();
		}
	});

	it('maps unknown/unpublished/revoked URLs to not-found', async () => {
		const missing = vi.fn(async () => new Response('nope', { status: 404 }));
		await expect(
			loadPublicReleaseBundle({ publicationId: PUB_A, apiOrigin: 'https://api.test', fetchImpl: missing })
		).rejects.toMatchObject({ code: 'not-found' });
	});

	it('surfaces asset failures as retryable without a partial bundle', async () => {
		const project = createEmptyProject({ id: 'project:public-bad-asset', name: 'Bad Asset' });
		const uri = `/project-assets/${ASSET_ID}`;
		const document = {
			...project,
			scene: { ...project.scene, textures: [{ id: 'tex-1', name: 'Pinned', uri }] }
		};
		const assets = [{ assetId: ASSET_ID, mime: 'image/png', byteSize: PNG_BYTES.byteLength }];
		const gone = vi.fn(async (input: string) => {
			if (input.endsWith(`/publications/${PUB_A}`)) return jsonResponse(releasePayload(document, assets));
			return new Response('gone', { status: 404 });
		});
		await expect(
			loadPublicReleaseBundle({ publicationId: PUB_A, apiOrigin: 'https://api.test', fetchImpl: gone })
		).rejects.toMatchObject({ code: 'asset-failed' });

		const truncated = PNG_BYTES.slice(0, 8);
		const short = vi.fn(async (input: string) => {
			if (input.endsWith(`/publications/${PUB_A}`)) return jsonResponse(releasePayload(document, assets));
			return bytesResponse(truncated, 'image/png');
		});
		await expect(
			loadPublicReleaseBundle({ publicationId: PUB_A, apiOrigin: 'https://api.test', fetchImpl: short })
		).rejects.toMatchObject({ code: 'asset-failed' });

		const wrongMime = vi.fn(async (input: string) => {
			if (input.endsWith(`/publications/${PUB_A}`)) return jsonResponse(releasePayload(document, assets));
			return bytesResponse(PNG_BYTES, 'image/jpeg');
		});
		await expect(
			loadPublicReleaseBundle({ publicationId: PUB_A, apiOrigin: 'https://api.test', fetchImpl: wrongMime })
		).rejects.toMatchObject({ code: 'asset-failed' });
	});

	it('fails closed on invalid releases without leaking URLs', async () => {
		const badDocument = { id: 'project:bad', name: 'Bad', layout: { nope: true }, scene: {} };
		const fetchImpl = vi.fn(async () => jsonResponse(releasePayload(badDocument)));
		await expect(
			loadPublicReleaseBundle({ publicationId: PUB_A, apiOrigin: 'https://api.test', fetchImpl })
		).rejects.toMatchObject({ code: 'invalid-release' });
	});

	it('keys scopes by public ID + version so releases never share bytes', async () => {
		const project = createEmptyProject({ id: 'project:public-scope', name: 'Scoped' });
		const uri = `/project-assets/${ASSET_ID}`;
		const document = {
			...project,
			scene: { ...project.scene, textures: [{ id: 'tex-1', name: 'Pinned', uri }] }
		};
		const assets = [{ assetId: ASSET_ID, mime: 'image/png', byteSize: PNG_BYTES.byteLength }];
		const fetchFor = (pubId: string) =>
			vi.fn(async (input: string) => {
				if (input.endsWith(`/publications/${pubId}`)) return jsonResponse(releasePayload(document, assets));
				return bytesResponse(PNG_BYTES, 'image/png');
			});
		const first = await loadPublicReleaseBundle({
			publicationId: PUB_A,
			apiOrigin: 'https://api.test',
			fetchImpl: fetchFor(PUB_A)
		});
		const second = await loadPublicReleaseBundle({
			publicationId: PUB_B,
			apiOrigin: 'https://api.test',
			fetchImpl: fetchFor(PUB_B)
		});
		try {
			expect(first.bundle.textureScope.scopeId).toBe(`${PUB_A}@v1`);
			expect(second.bundle.textureScope.scopeId).toBe(`${PUB_B}@v1`);
			const urlA = first.bundle.textureScope.resolveTexture(uri);
			const urlB = second.bundle.textureScope.resolveTexture(uri);
			expect(urlA?.startsWith('blob:')).toBe(true);
			expect(urlB?.startsWith('blob:')).toBe(true);
			expect(urlA).not.toBe(urlB);
		} finally {
			first.bundle.dispose();
			second.bundle.dispose();
		}
	});

	it('propagates aborts so route switches never install stale releases', async () => {
		const project = createEmptyProject({ id: 'project:public-abort', name: 'Abort' });
		const controller = new AbortController();
		controller.abort();
		const fetchImpl = vi.fn(async () => jsonResponse(releasePayload(project)));
		await expect(
			loadPublicReleaseBundle({
				publicationId: PUB_A,
				apiOrigin: 'https://api.test',
				fetchImpl,
				signal: controller.signal
			})
		).rejects.toMatchObject({ name: 'AbortError' });
	});

	it('validates byte payloads directly (size, MIME, magic)', async () => {
		const assets = [{ assetId: ASSET_ID, mime: 'image/png', byteSize: PNG_BYTES.byteLength }];
		const ok = vi.fn(async () => bytesResponse(PNG_BYTES, 'image/png'));
		const bytes = await fetchPublicReleaseBytes({
			publicationId: PUB_A,
			version: 1,
			assets,
			apiOrigin: 'https://api.test',
			fetchImpl: ok
		});
		expect(bytes.get(`/project-assets/${ASSET_ID}`)?.bytes).toEqual(PNG_BYTES);

		const corrupt = PNG_BYTES.slice();
		corrupt[0] = 0x00;
		const badMagic = vi.fn(async () => bytesResponse(corrupt, 'image/png'));
		await expect(
			fetchPublicReleaseBytes({
				publicationId: PUB_A,
				version: 1,
				assets,
				apiOrigin: 'https://api.test',
				fetchImpl: badMagic
			})
		).rejects.toMatchObject({ code: 'asset-failed' });
		expect(PublicVisitorError).toBeDefined();
	});

	it('loads a connected two-node Sequence tour through the public loader (fixture 4)', async () => {
		const project = createEmptyProject({ id: 'project:public-tour', name: 'Tour Public' });
		const document = {
			...project,
			layout: {
				...project.layout,
				floors: [
					{
						id: 'floor-ground',
						name: 'Ground Floor',
						elevation: 0,
						height: 3,
						rooms: [
							{
								id: 'room-a',
								name: 'Room A',
								frame: { origin: [0, 0] as [number, number], yaw: 0 },
								boundary: {
									closed: true as const,
									segments: [
										{ id: 'room-a:wall:0', kind: 'line' as const, start: [0, 0] as [number, number], end: [6, 0] as [number, number] },
										{ id: 'room-a:wall:1', kind: 'line' as const, start: [6, 0] as [number, number], end: [6, 4] as [number, number] },
										{ id: 'room-a:wall:2', kind: 'line' as const, start: [6, 4] as [number, number], end: [0, 4] as [number, number] },
										{ id: 'room-a:wall:3', kind: 'line' as const, start: [0, 4] as [number, number], end: [0, 0] as [number, number] }
									]
								},
								wallThickness: 0.16,
								floorThickness: 0.1,
								ceilingThickness: 0.1,
								openings: []
							}
						]
					}
				]
			},
			scene: {
				...project.scene,
				navigationNodes: [
					{
						id: 'tour-a',
						roomId: 'room-a',
						label: 'Tour A',
						position: [1, 1.65, 1],
						cameraTarget: [1, 1.25, -2],
						fov: 54,
						connectedNodeIds: ['tour-b'],
						nextNodeId: 'tour-b'
					},
					{
						id: 'tour-b',
						roomId: 'room-a',
						label: 'Tour B',
						position: [4, 1.65, 3],
						cameraTarget: [4, 1.25, 0],
						fov: 54,
						connectedNodeIds: ['tour-a'],
						previousNodeId: 'tour-a',
						holdSeconds: 1.5
					}
				],
				connections: [
					{
						id: 'tour-a-b',
						fromNodeId: 'tour-a',
						toNodeId: 'tour-b',
						clearance: 0.35,
						positionPath: { kind: 'auto-bezier', anchors: [] }
					}
				]
			}
		};
		const fetchImpl = vi.fn(async () => jsonResponse(releasePayload(document)));
		const { bundle } = await loadPublicReleaseBundle({
			publicationId: PUB_A,
			apiOrigin: 'https://api.test',
			fetchImpl
		});
		try {
			expect(bundle.graph.navigationNodes.map((node) => node.id)).toEqual(['tour-a', 'tour-b']);
			expect(bundle.graph.connections.map((connection) => connection.id)).toEqual(['tour-a-b']);
			// Sequence order survives the public loader; entry is the tour head.
			expect(visitorMainFlowNodeIds(bundle.graph)).toEqual(['tour-a', 'tour-b']);
			expect(visitorStartNodeId(bundle.graph)).toBe('tour-a');
			// View key survives the public loader.
			expect(bundle.graph.nodeById.get('tour-b')?.holdSeconds).toBe(1.5);
		} finally {
			bundle.dispose();
		}
	});

	it('keeps reduced-motion behavior on the public runtime state', async () => {
		const project = createEmptyProject({ id: 'project:public-rm', name: 'Reduced Motion' });
		const fetchImpl = vi.fn(async () => jsonResponse(releasePayload(project)));
		const { bundle } = await loadPublicReleaseBundle({
			publicationId: PUB_A,
			apiOrigin: 'https://api.test',
			fetchImpl
		});
		try {
			const visitor = createVisitorRuntimeState(bundle.graph, visitorStartNodeId(bundle.graph));
			visitor.reducedMotion = true;
			expect(visitor.reducedMotion).toBe(true);
			expect(visitor.activeNodeId).toBe('');
		} finally {
			bundle.dispose();
		}
	});
});

describe('P22.3 public closure', () => {
	beforeEach(() => vi.unstubAllGlobals());
	afterEach(() => vi.unstubAllGlobals());

	it('public modules are self-contained: no editor/session/store imports', () => {
		const testDir = dirname(fileURLToPath(import.meta.url));
		const sources = [
			'public-release-client.ts',
			'visitor-cold-runtime.ts',
			'visitor-texture-scope.ts',
			'shipped-static-registry.ts'
		].map((file) => readFileSync(resolve(testDir, '../../../src/lib/visitor', file), 'utf8'));
		for (const source of sources) {
			for (const token of [
				'$lib/editor/',
				'content/materials',
				'content/assets',
				'content/scene',
				'content/rooms',
				'chopin-',
				'project-codec',
				'export-store',
				'texture-store'
			]) {
				expect(source, token).not.toContain(token);
			}
		}
		const route = readFileSync(
			resolve(testDir, '../../../src/routes/p/[publicationId]/+page.svelte'),
			'utf8'
		);
		for (const token of ['$lib/editor/', 'project-codec', 'export-store', 'binary-texture-store', 'chopin-project']) {
			expect(route, token).not.toContain(token);
		}
	});

	it('rejects an indirect editor import through the public loader (closure fixture)', () => {
		const root = '/src/routes/p/[publicationId]/+page.svelte';
		const loader = '/src/lib/visitor/public-release-client.ts';
		const forbidden = '/src/lib/editor/editor-store.svelte';
		expect(isForbiddenPreviewSurfaceModule(forbidden)).toContain('editor');
		const result = validatePreviewSurfaceGraph({
			rootId: root,
			modules: new Map([
				[root, { imports: [loader], dynamicImports: [] }],
				[loader, { imports: [forbidden], dynamicImports: [] }],
				[forbidden, { imports: [], dynamicImports: [] }]
			])
		});
		expect(result.ok).toBe(false);
		expect(result.forbidden).toHaveLength(1);
		expect(result.forbidden[0]!.id).toBe(forbidden);
	});

	it('wires reduced motion from matchMedia to the public surface (no component harness in node env)', () => {
		const testDir = dirname(fileURLToPath(import.meta.url));
		const route = readFileSync(
			resolve(testDir, '../../../src/routes/p/[publicationId]/+page.svelte'),
			'utf8'
		);
		// Route observes the OS setting, forwards it, and narrates it.
		expect(route).toContain('prefers-reduced-motion');
		expect(route).toContain('{reducedMotion}');
		expect(route).toContain('Reduced motion is on');
		const surface = readFileSync(
			resolve(testDir, '../../../src/lib/visitor/VisitorPreviewSurface.svelte'),
			'utf8'
		);
		// The shared surface installs the flag on the visitor runtime state
		// in both preview and public mode (public adds no separate path).
		expect(surface).toContain('visitorState.reducedMotion = reducedMotion');
	});

	it('does not track bundle disposal in the load effect', () => {
		const testDir = dirname(fileURLToPath(import.meta.url));
		const route = readFileSync(
			resolve(testDir, '../../../src/routes/p/[publicationId]/+page.svelte'),
			'utf8'
		);
		expect(route).toContain('untrack(disposeBundle)');
	});
});
