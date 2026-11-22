/**
 * T2.S8 G — the editor half of the material library.
 *
 * These tests exercise the real flattening codec and the real F4 intent shape
 * with an in-memory transport. They deliberately do not stub the recipe: a
 * palette follower must become a literal in the saved payload, and a second
 * insertion must allocate its own Finish id while naming the same vendored
 * bytes.
 */
import { describe, expect, test } from 'vitest';
import type { AuthoringIntent } from '@portfolio/project-model';
import {
	createEmptyCameraPayload,
	createEmptyExperiencePayload,
	createEmptyResourcePayload,
	createEmptyUnitSceneDocument,
	createProjectEnvelope,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';
import { serializeProjectEnvelope } from '@portfolio/project-model/units';
import {
	MaterialLibraryClientError,
	type MaterialLibraryClient,
	type MaterialLibrarySaveInput
} from '$lib/authoring/adapters/scene/library/material-client';
import {
	insertFinishFromLibrary,
	saveFinishToLibrary,
	uploadFinishThumbnail
} from '$lib/authoring/adapters/scene/library/material';
import { createMaterialProofRegistry } from '$lib/authoring/material-proof';
import { recipeHash } from '@portfolio/project-model/materials';

const PROJECT = 'project-g-unit';

function envelope(scene: ReturnType<typeof createEmptyUnitSceneDocument>): Promise<ProjectEnvelope> {
	return createProjectEnvelope({
		id: PROJECT,
		name: 'G unit',
		acceptedRevision: { projectId: PROJECT, revisionId: 'revision-1' },
		dependencyLock: { formatVersion: 1, entries: [] },
		layout: { unitId: 'layout', data: createEmptyWallFirstLayoutDocument() },
		scene: { unitId: 'scene', data: scene },
		camera: { unitId: 'camera', data: createEmptyCameraPayload() },
		experience: { unitId: 'experience', data: createEmptyExperiencePayload() },
		resources: { unitId: 'resources', data: createEmptyResourcePayload() }
	});
}

describe('saveFinishToLibrary', () => {
	test('flattens a palette follower to its current literal and keeps the name out of the recipe', async () => {
		const scene = createEmptyUnitSceneDocument();
		scene.palette = [{ id: 'accent', name: 'Accent', color: '#d08050' }];
		scene.materials = [
			{
				id: 'finish-oak',
				name: 'Oak',
				base: { catalogue: 'plaster-warm' },
				overrides: { color: { slot: 'accent' }, roughness: 0.42 }
			}
		];
		const source = await envelope(scene);
		let saved: MaterialLibrarySaveInput | null = null;
		const client = {
			async save(input: MaterialLibrarySaveInput) {
				saved = input;
				return {
					id: 'item-1',
					name: input.payload.name,
					kind: 'material' as const,
					formatVersion: 1,
					contentId: input.payload.name,
					createdAt: '2026-11-21T00:00:00.000Z',
					recipeHash: `sha256-${'a'.repeat(64)}`,
					imageCount: input.images.length,
					hasThumbnail: false
				};
			}
		} as unknown as MaterialLibraryClient;
		const result = await saveFinishToLibrary({
			source,
			finishId: 'finish-oak',
			operationId: 'save-oak',
			client
		});
		expect(result.ok).toBe(true);
		expect(saved).not.toBeNull();
		expect(saved!.payload.recipe.color).toBe('#d08050');
		expect(saved!.payload.recipe.roughness).toBe(0.42);
		expect(saved!.payload.recipe.maps.color?.image).toMatch(/^sha256-/);
		if (result.ok) expect(result.draft.capturedFollowers).toEqual(['accent']);
	});

	test('names every local image pin and sends the source project', async () => {
		const scene = createEmptyUnitSceneDocument();
		scene.materials = [
			{
				id: 'finish-plain',
				name: 'Plain',
				base: { catalogue: 'plaster-warm' }
			}
		];
		const source = await envelope(scene);
		let saved: MaterialLibrarySaveInput | null = null;
		const client = {
			async save(input: MaterialLibrarySaveInput) {
				saved = input;
				return {
					id: 'item-2',
					name: input.payload.name,
					kind: 'material' as const,
					formatVersion: 1,
					contentId: 'content',
					createdAt: '2026-11-21T00:00:00.000Z',
					recipeHash: `sha256-${'b'.repeat(64)}`,
					imageCount: input.images.length,
					hasThumbnail: false
				};
			}
		} as unknown as MaterialLibraryClient;
		const result = await saveFinishToLibrary({
			source,
			finishId: 'finish-plain',
			operationId: 'save-plain',
			client
		});
		expect(result.ok).toBe(true);
		expect(saved!.sourceProjectId).toBe(PROJECT);
		expect(saved!.images.length).toBeGreaterThan(0);
		for (const image of saved!.images) expect(image.source).toHaveProperty('shipped');
	});
});

describe('insertFinishFromLibrary', () => {
	test('installs the vendored texture records and allocates the server Finish id', async () => {
		const scene = createEmptyUnitSceneDocument();
		scene.entities.push({
			kind: 'primitive',
			id: 'g-plane',
			name: 'Plane',
			position: [0, 0, 0],
			rotation: [0, 0, 0],
			primitive: 'plane',
			dimensions: { width: 1, height: 1 },
			materialId: 'plaster-warm',
			castShadow: false,
			receiveShadow: false
		});
		const destination = await envelope(scene);
		const textureId = '00000000-0000-4000-8000-000000000001';
		const recipe = {
			profile: 'pbr-metallic-roughness/v1' as const,
			color: '#ffffff',
			roughness: 0.5,
			metalness: 0,
			occlusionStrength: 1,
			normalScale: 1,
			mapping: { kind: 'uv' as const, set: 0 as const, repeat: [1, 1] as const, rotation: 0, offset: [0, 0] as const },
			maps: { color: { image: `sha256-${'c'.repeat(64)}` } }
		};
		const pinned = await recipeHash(recipe);
		const client = {
			async transfer() {
				return {
					itemId: 'item-3',
					contentId: `sha256-${'d'.repeat(64)}`,
					finishId: 'finish-insert-1',
					name: 'Walnut',
					recipe,
					recipeHash: pinned,
					images: [
						{
							hash: `sha256-${'c'.repeat(64)}`,
							source: { textureId },
							mime: 'image/png',
							byteSize: 12,
							name: 'walnut.png'
						}
					],
					savedBase: null
				};
			}
		} as unknown as MaterialLibraryClient;
		let intent: AuthoringIntent | null = null;
		const result = await insertFinishFromLibrary({
			item: {
				id: 'item-3',
				contentId: `sha256-${'d'.repeat(64)}`,
				recipeHash: pinned
			},
			destinationProjectId: PROJECT,
			operationId: 'insert-1',
			targets: { entityIds: ['g-plane'], surfaces: [] },
			client,
			signal: new AbortController().signal,
			host: {
				current: () => ({ source: destination, revision: destination.acceptedRevision }),
				accept: async (next) => {
					intent = next;
					return { kind: 'accepted' };
				},
				entityReference: () => ({
					version: 1,
					domain: 'scene',
					revision: { kind: 'exact', contentRevision: destination.units.scene.header.contentRevision },
					subject: { kind: 'entity', id: 'g-plane' },
					instancePath: [],
					location: { kind: 'project-root' },
					componentId: null,
					capabilityId: null
				}),
				surfaceReference: () => {
					throw new Error('not used');
				},
				materialProofs: createMaterialProofRegistry()
			}
		});
		expect(result.ok).toBe(true);
		expect(intent).not.toBeNull();
		expect(intent!.allocatedIds).toEqual([{ kind: 'scene-finish', id: 'finish-insert-1' }]);
		const payload = intent!.payload as { images: { hash: string; source: { textureId?: string }; texture?: { name: string; pin: { hash: string; mime: string; size: number } } }[] };
		expect(payload.images[0]!.source.textureId).toBe(textureId);
		expect(payload.images[0]!.texture?.pin.hash).toBe(`sha256-${'c'.repeat(64)}`);
	});

	test('does not call F4 when the transfer is refused', async () => {
		const destination = await envelope(createEmptyUnitSceneDocument());
		const client = {
			async transfer() {
				throw new Error('The library item was removed during the transfer');
			}
		} as unknown as MaterialLibraryClient;
		let accepted = false;
		const result = await insertFinishFromLibrary({
			item: { id: 'item-4', contentId: `sha256-${'f'.repeat(64)}`, recipeHash: `sha256-${'0'.repeat(64)}` },
			destinationProjectId: PROJECT,
			operationId: 'insert-4',
			targets: { entityIds: [], surfaces: [] },
			client,
			signal: new AbortController().signal,
			host: {
				current: () => ({ source: destination, revision: destination.acceptedRevision }),
				accept: async () => {
					accepted = true;
					return { kind: 'accepted' };
				},
				entityReference: () => {
					throw new Error('not used');
				},
				surfaceReference: () => {
					throw new Error('not used');
				},
				materialProofs: createMaterialProofRegistry()
			}
		});
		expect(result.ok).toBe(false);
		expect(accepted).toBe(false);
	});

	test('refuses with stale-revision without calling accept when revision advances or project switches during transfer', async () => {
		const destination = await envelope(createEmptyUnitSceneDocument());
		const otherDestination = await createProjectEnvelope({
			id: 'project-other',
			name: 'Other',
			acceptedRevision: { projectId: 'project-other', revisionId: 'revision-1' },
			dependencyLock: { formatVersion: 1, entries: [] },
			layout: { unitId: 'layout', data: createEmptyWallFirstLayoutDocument() },
			scene: { unitId: 'scene', data: createEmptyUnitSceneDocument() },
			camera: { unitId: 'camera', data: createEmptyCameraPayload() },
			experience: { unitId: 'experience', data: createEmptyExperiencePayload() },
			resources: { unitId: 'resources', data: createEmptyResourcePayload() }
		});
		const recipe = {
			profile: 'pbr-metallic-roughness/v1' as const,
			color: '#ffffff',
			roughness: 0.5,
			metalness: 0,
			occlusionStrength: 1,
			normalScale: 1,
			mapping: { kind: 'uv' as const, set: 0 as const, repeat: [1, 1] as const, rotation: 0, offset: [0, 0] as const },
			maps: {}
		};
		const pinned = await recipeHash(recipe);
		let currentState = { source: destination, revision: destination.acceptedRevision };
		let accepted = false;

		const makeClient = (onTransfer: () => void) =>
			({
				async transfer() {
					onTransfer();
					return {
						itemId: 'item-stale',
						contentId: `sha256-${'e'.repeat(64)}`,
						finishId: 'finish-insert-stale',
						name: 'Walnut',
						recipe,
						recipeHash: pinned,
						images: [],
						savedBase: null
					};
				}
			}) as unknown as MaterialLibraryClient;

		const runInsert = (client: MaterialLibraryClient) =>
			insertFinishFromLibrary({
				item: { id: 'item-stale', contentId: `sha256-${'e'.repeat(64)}`, recipeHash: pinned },
				destinationProjectId: PROJECT,
				operationId: 'insert-stale',
				targets: { entityIds: [], surfaces: [] },
				client,
				signal: new AbortController().signal,
				host: {
					current: () => currentState,
					accept: async () => {
						accepted = true;
						return { kind: 'accepted' };
					},
					entityReference: () => {
						throw new Error('not used');
					},
					surfaceReference: () => {
						throw new Error('not used');
					},
					materialProofs: createMaterialProofRegistry()
				}
			});

		const advanced = await runInsert(
			makeClient(() => {
				currentState = {
					source: destination,
					revision: { projectId: PROJECT, revisionId: 'revision-2' }
				};
			})
		);
		expect(advanced.ok).toBe(false);
		if (!advanced.ok) expect(advanced.code).toBe('stale-revision');
		expect(accepted).toBe(false);

		currentState = { source: destination, revision: destination.acceptedRevision };
		const switched = await runInsert(
			makeClient(() => {
				currentState = {
					source: otherDestination,
					revision: otherDestination.acceptedRevision
				};
			})
		);
		expect(switched.ok).toBe(false);
		if (!switched.ok) expect(switched.code).toBe('stale-revision');
		expect(accepted).toBe(false);
	});

	test('forwards MaterialLibraryClientError stale and conflict codes', async () => {
		const destination = await envelope(createEmptyUnitSceneDocument());
		const runWithError = (error: MaterialLibraryClientError) =>
			insertFinishFromLibrary({
				item: { id: 'item-err', contentId: `sha256-${'f'.repeat(64)}`, recipeHash: `sha256-${'0'.repeat(64)}` },
				destinationProjectId: PROJECT,
				operationId: 'insert-err',
				targets: { entityIds: [], surfaces: [] },
				client: {
					async transfer() {
						throw error;
					}
				} as unknown as MaterialLibraryClient,
				signal: new AbortController().signal,
				host: {
					current: () => ({ source: destination, revision: destination.acceptedRevision }),
					accept: async () => ({ kind: 'accepted' }),
					entityReference: () => {
						throw new Error('not used');
					},
					surfaceReference: () => {
						throw new Error('not used');
					},
					materialProofs: createMaterialProofRegistry()
				}
			});

		const stale = await runWithError(new MaterialLibraryClientError('stale', 'Stale', 409, 'stale_revision'));
		expect(stale.ok).toBe(false);
		if (!stale.ok) expect(stale.code).toBe('stale-revision');

		const conflict = await runWithError(
			new MaterialLibraryClientError('conflict', 'Conflict', 409, 'content_id_mismatch')
		);
		expect(conflict.ok).toBe(false);
		if (!conflict.ok) expect(conflict.code).toBe('conflict');
	});

	test('refuses unknown or non-paintable light targets before calling client.transfer', async () => {
		const scene = createEmptyUnitSceneDocument();
		scene.entities.push({
			kind: 'light',
			light: 'point',
			id: 'g-light',
			name: 'Light',
			position: [0, 2, 0],
			rotation: [0, 0, 0],
			color: '#ffffff',
			intensity: 1,
			castShadow: false
		});
		const destination = await envelope(scene);
		let transferCalls = 0;
		const client = {
			async transfer() {
				transferCalls += 1;
				throw new Error('should not be called');
			}
		} as unknown as MaterialLibraryClient;

		const runTargets = (targets: { entityIds: string[]; surfaces: [] }) =>
			insertFinishFromLibrary({
				item: { id: 'item-t', contentId: `sha256-${'f'.repeat(64)}`, recipeHash: `sha256-${'0'.repeat(64)}` },
				destinationProjectId: PROJECT,
				operationId: 'insert-target',
				targets,
				client,
				signal: new AbortController().signal,
				host: {
					current: () => ({ source: destination, revision: destination.acceptedRevision }),
					accept: async () => ({ kind: 'accepted' }),
					entityReference: () => {
						throw new Error('not used');
					},
					surfaceReference: () => {
						throw new Error('not used');
					},
					materialProofs: createMaterialProofRegistry()
				}
			});

		const unknownTarget = await runTargets({ entityIds: ['missing-entity'], surfaces: [] });
		expect(unknownTarget.ok).toBe(false);
		if (!unknownTarget.ok) expect(unknownTarget.code).toBe('refused');

		const lightTarget = await runTargets({ entityIds: ['g-light'], surfaces: [] });
		expect(lightTarget.ok).toBe(false);
		if (!lightTarget.ok) expect(lightTarget.code).toBe('refused');

		expect(transferCalls).toBe(0);
	});
});

describe('uploadFinishThumbnail', () => {
	test('rejects wrong dimensions and returns false when OffscreenCanvas is absent in Node', async () => {
		const item = {
			id: 'item-thumb',
			contentId: `sha256-${'a'.repeat(64)}`,
			recipeHash: `sha256-${'b'.repeat(64)}`
		};
		const client = {
			async putThumbnail() {
				throw new Error('should not be called');
			}
		} as unknown as MaterialLibraryClient;

		await expect(
			uploadFinishThumbnail({
				item,
				frame: { width: 128, height: 128, pixels: new Uint8Array(128 * 128 * 4), backend: 'webgl2' },
				client
			})
		).rejects.toThrow(/256×256 master or a 192×192/);

		// The 256 px master and the pre-U1 192 px frame are both accepted.
		for (const edge of [256, 192]) {
			const uploaded = await uploadFinishThumbnail({
				item,
				frame: { width: edge, height: edge, pixels: new Uint8Array(edge * edge * 4), backend: 'webgl2' },
				client
			});
			expect(uploaded).toBe(false);
		}
	});
});

test('a serialized destination contains no library transport path', async () => {
	const destination = await envelope(createEmptyUnitSceneDocument());
	const json = serializeProjectEnvelope(destination);
	expect(json).not.toContain('/library/');
	expect(json).not.toContain('library/items');
});
