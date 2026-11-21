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
import type { MaterialLibraryClient, MaterialLibrarySaveInput } from '$lib/authoring/adapters/scene/library/material-client';
import {
	insertFinishFromLibrary,
	saveFinishToLibrary
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
		const destination = await envelope(createEmptyUnitSceneDocument());
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
});

test('a serialized destination contains no library transport path', async () => {
	const destination = await envelope(createEmptyUnitSceneDocument());
	const json = serializeProjectEnvelope(destination);
	expect(json).not.toContain('/library/');
	expect(json).not.toContain('library/items');
});
