/**
 * T2.S8 U7 — the private-library session's save and browse authority.
 *
 * Saving is one G post over the accepted source: no `authoring.accept`, no
 * project history. A failed list leaves the session offline and empty.
 */
import { describe, expect, it, vi } from 'vitest';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { attachUnitStageSource } from '$lib/authoring/stage/unit-stage-source';
import { createPrivateLibrarySession } from '$lib/authoring/library/private-library.svelte';
import {
	MaterialLibraryClientError,
	type MaterialLibraryClient,
} from '$lib/authoring/adapters/scene/library/material-client';
import type {
	MaterialLibraryItemSummary,
	MaterialLibraryPayload,
} from '@portfolio/project-model/library';
import { SCENE_UNIT_FORMAT_VERSION } from '@portfolio/project-model/units';
import {
	admitUnitProject,
	createUnitProject,
	unitRevision,
} from '../__fixtures__/unit-envelope-fixtures';

const summary: MaterialLibraryItemSummary = {
	id: 'item-1',
	name: 'Lobby oak',
	kind: 'material',
	formatVersion: 1,
	contentId: 'sha256-content',
	createdAt: '2026-11-24T10:20:30.000Z',
	recipeHash: 'sha256-recipe',
	imageCount: 0,
	hasThumbnail: false,
};

async function services(): Promise<StageAdapterServices> {
	const project = await createUnitProject({
		id: 'project-library',
		name: 'Library',
		scene: {
			formatVersion: SCENE_UNIT_FORMAT_VERSION,
			textures: [],
			materials: [
				{
					id: 'oak',
					name: 'Lobby oak',
					base: { catalogue: 'wood-oak-veneer' },
					overrides: { roughness: 0.9 },
				},
			],
			entities: [],
			palette: [],
		},
	});
	const admitted = await admitUnitProject(project, unitRevision(project.id));
	if (admitted.kind !== 'admitted') throw new Error('fixture not admitted');
	const snapshot = attachUnitStageSource(admitted.snapshot, project);
	return {
		stage: { snapshot: () => snapshot },
		authoring: { accept: vi.fn() },
	} as unknown as StageAdapterServices;
}

function fakeClient(overrides: Partial<MaterialLibraryClient> = {}): MaterialLibraryClient {
	return {
		list: vi.fn(async () => []),
		read: vi.fn(),
		save: vi.fn(async (input) => ({ ...summary, name: input.payload.name })),
		remove: vi.fn(async () => undefined),
		thumbnail: vi.fn(async () => new Uint8Array()),
		putThumbnail: vi.fn(async () => undefined),
		transfer: vi.fn(),
		...overrides,
	} as unknown as MaterialLibraryClient;
}

describe('T2.S8 U7 — private-library session', () => {
	it('saves a project Finish through G without a project write', async () => {
		const stage = await services();
		const client = fakeClient();
		const session = createPrivateLibrarySession({
			services: () => stage,
			onNotice: vi.fn(),
			onInserted: vi.fn(),
			armPaint: vi.fn(),
			client,
		});
		const outcome = await session.saveFinish({
			finishKey: 'project:oak',
			name: 'Lobby oak',
			tileSource: null,
		});
		expect(outcome.ok).toBe(true);
		expect((stage.authoring.accept as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
		expect(client.save).toHaveBeenCalledWith(
			expect.objectContaining({
				payload: expect.objectContaining({ name: 'Lobby oak', kind: 'material' }),
			}),
			undefined,
		);
		expect(session.entries()[0]).toMatchObject({
			key: 'mine:item-1',
			source: 'mine',
			name: 'Lobby oak',
		});
	});

	it('reports an offline list and keeps the shelf empty', async () => {
		const client = fakeClient({
			list: vi.fn(async () => {
				throw new MaterialLibraryClientError('network', 'offline');
			}),
		});
		const session = createPrivateLibrarySession({
			services: () => null,
			onNotice: vi.fn(),
			onInserted: vi.fn(),
			armPaint: vi.fn(),
			client,
		});
		await session.load();
		expect(session.status).toBe('offline');
		expect(session.error).toMatch(/offline/);
		expect(session.entries()).toEqual([]);
	});

	it('hydrates a cold list with the saved recipe and its facts', async () => {
		const payload: MaterialLibraryPayload = {
			formatVersion: 1,
			kind: 'material',
			name: 'Lobby oak',
			recipe: {
				profile: 'pbr-metallic-roughness/v1',
				color: '#8a6a4a',
				roughness: 0.42,
				metalness: 0.1,
				occlusionStrength: 1,
				normalScale: 1,
				mapping: { kind: 'target', metric: { tileMeters: [1, 1], rotation: 0, offset: [0, 0] } },
				maps: {}
			}
		};
		const client = fakeClient({
			list: vi.fn(async () => [summary]),
			read: vi.fn(async () => ({ payload, contentId: summary.contentId, recipeHash: summary.recipeHash }))
		});
		const session = createPrivateLibrarySession({
			services: () => null,
			onNotice: vi.fn(),
			onInserted: vi.fn(),
			armPaint: vi.fn(),
			client
		});
		await session.load();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(client.read).toHaveBeenCalledWith(summary);
		expect(session.entries()[0]).toMatchObject({
			name: 'Lobby oak',
			color: '#8a6a4a',
			sheen: 0.42,
			metalness: 0.1,
			libraryItem: { id: 'item-1', imageCount: 0 }
		});
	});
});
