/**
 * T2.S8 U7 — the private-library session's save and browse authority.
 *
 * Saving is one G post over the accepted source: no `authoring.accept`, no
 * project history. Browse work is ticket-scoped, and disposal aborts every
 * in-flight read, save and transfer before a callback can reach the Stage.
 */
import { describe, expect, it, vi } from 'vitest';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { attachUnitStageSource } from '$lib/authoring/stage/unit-stage-source';
import { createPrivateLibrarySession } from '$lib/authoring/library/private-library.svelte';
import {
	MaterialLibraryClientError,
	type MaterialLibraryClient,
} from '$lib/authoring/adapters/scene/library/material-client';
import { draftFinishId } from '$lib/authoring/materials/material-set';
import type {
	MaterialLibraryItemSummary,
	MaterialLibraryPayload,
	MaterialLibraryTransfer,
} from '@portfolio/project-model/library';
import { SCENE_UNIT_FORMAT_VERSION } from '@portfolio/project-model/units';
import {
	admitUnitProject,
	createUnitProject,
	unitRevision,
} from '../__fixtures__/unit-envelope-fixtures';

const recipe: MaterialLibraryPayload['recipe'] = {
	profile: 'pbr-metallic-roughness/v1',
	color: '#8a6a4a',
	roughness: 0.42,
	metalness: 0.1,
	occlusionStrength: 1,
	normalScale: 1,
	mapping: { kind: 'target', metric: { tileMeters: [1, 1], rotation: 0, offset: [0, 0] } },
	maps: {},
};

function summaryOf(id: string, name: string): MaterialLibraryItemSummary {
	return {
		id,
		name,
		kind: 'material',
		formatVersion: 1,
		contentId: `sha256-content-${id}`,
		createdAt: '2026-11-24T10:20:30.000Z',
		recipeHash: `sha256-${'a'.repeat(64)}`,
		imageCount: 0,
		hasThumbnail: false,
	};
}

function payloadOf(name: string, color: string): MaterialLibraryPayload {
	return { formatVersion: 1, kind: 'material', name, recipe: { ...recipe, color } };
}

const summary = summaryOf('item-1', 'Lobby oak');

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
		authoring: { accept: vi.fn(async () => ({ kind: 'installed' })) },
		materialProofs: {
			prepareFinishRegistration: vi.fn(async () => ({ ok: true, hash: 'sha256-transfer' })),
		},
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

function deferred<T>(): {
	readonly promise: Promise<T>;
	resolve(value: T): void;
} {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
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
			expect.any(AbortSignal),
		);
		expect(session.entries()[0]).toMatchObject({
			key: 'mine:item-1',
			source: 'mine',
			name: 'Lobby oak',
		});
	});

	it('keeps an offline list idle until the creator retries', async () => {
		const list = vi.fn()
			.mockRejectedValueOnce(new MaterialLibraryClientError('network', 'offline'))
			.mockResolvedValueOnce([]);
		const client = fakeClient({ list });
		const session = createPrivateLibrarySession({
			services: () => null,
			onNotice: vi.fn(),
			onInserted: vi.fn(),
			armPaint: vi.fn(),
			client,
		});
		session.ensureLoaded();
		await Promise.resolve();
		expect(session.status).toBe('offline');
		expect(session.error).toMatch(/offline/);
		expect(session.entries()).toEqual([]);

		session.ensureLoaded();
		expect(list).toHaveBeenCalledTimes(1);
		await session.load(true);
		expect(list).toHaveBeenCalledTimes(2);
		expect(session.status).toBe('ready');
	});

	it('hydrates a cold list with the saved recipe and its facts', async () => {
		const client = fakeClient({
			list: vi.fn(async () => [summary]),
			read: vi.fn(async () => ({
				payload: payloadOf('Lobby oak', '#8a6a4a'),
				contentId: summary.contentId,
				recipeHash: summary.recipeHash,
			})),
		});
		const session = createPrivateLibrarySession({
			services: () => null,
			onNotice: vi.fn(),
			onInserted: vi.fn(),
			armPaint: vi.fn(),
			client,
		});
		await session.load();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(client.read).toHaveBeenCalledWith(summary, expect.any(AbortSignal));
		expect(session.entries()[0]).toMatchObject({
			name: 'Lobby oak',
			color: '#8a6a4a',
			sheen: 0.42,
			metalness: 0.1,
			libraryItem: { id: 'item-1', imageCount: 0 },
		});
	});

	it('does not let an older hydration overwrite a newer list', async () => {
		const oldSummary = summaryOf('old', 'Old oak');
		const newSummary = summaryOf('new', 'New oak');
		const oldRead = deferred<Awaited<ReturnType<MaterialLibraryClient['read']>>>();
		const list = vi
			.fn<MaterialLibraryClient['list']>()
			.mockResolvedValueOnce([oldSummary])
			.mockResolvedValueOnce([newSummary]);
		const read = vi.fn<MaterialLibraryClient['read']>((item) =>
			item.id === 'old'
				? oldRead.promise
				: Promise.resolve({
						payload: payloadOf('New oak', '#111111'),
						contentId: newSummary.contentId,
						recipeHash: newSummary.recipeHash,
					}),
		);
		const session = createPrivateLibrarySession({
			services: () => null,
			onNotice: vi.fn(),
			onInserted: vi.fn(),
			armPaint: vi.fn(),
			client: fakeClient({ list, read }),
		});
		await session.load();
		await session.load(true);
		await new Promise((resolve) => setTimeout(resolve, 0));
		oldRead.resolve({
			payload: payloadOf('Old oak', '#222222'),
			contentId: oldSummary.contentId,
			recipeHash: oldSummary.recipeHash,
		});
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(session.entries().map((entry) => entry.name)).toEqual(['New oak']);
		expect(session.entries()[0]?.color).toBe('#111111');
	});

	it('aborts a pending list on disposal and leaves no live state', async () => {
		const listing = deferred<MaterialLibraryItemSummary[]>();
		const seenSignals: AbortSignal[] = [];
		const list = vi.fn<MaterialLibraryClient['list']>((signal) => {
			if (signal !== undefined) seenSignals.push(signal);
			return listing.promise;
		});
		const session = createPrivateLibrarySession({
			services: () => null,
			onNotice: vi.fn(),
			onInserted: vi.fn(),
			armPaint: vi.fn(),
			client: fakeClient({ list }),
		});
		const pending = session.load();
		session.dispose();
		expect(seenSignals[0]?.aborted).toBe(true);
		listing.resolve([summary]);
		await pending;
		expect(session.status).toBe('idle');
		expect(session.entries()).toEqual([]);
	});

	it('ignores an obsolete transfer completion after disposal', async () => {
		const stage = await services();
		const transfer = deferred<MaterialLibraryTransfer>();
		let operationId = '';
		const client = fakeClient({
			list: vi.fn(async () => [summary]),
			transfer: vi.fn((_item, _destination, id) => {
				operationId = id;
				return transfer.promise;
			}),
		});
		const onInserted = vi.fn();
		const armPaint = vi.fn();
		const session = createPrivateLibrarySession({
			services: () => stage,
			onNotice: vi.fn(),
			onInserted,
			armPaint,
			client,
		});
		await session.load();
		await new Promise((resolve) => setTimeout(resolve, 0));
		const pending = session.insert('mine:item-1', null, 'paint');
		await vi.waitFor(() => expect(client.transfer).toHaveBeenCalled());
		session.dispose();
		transfer.resolve({
			itemId: summary.id,
			contentId: summary.contentId,
			finishId: draftFinishId(operationId),
			name: summary.name,
			recipe,
			recipeHash: 'sha256-transfer',
			images: [],
			savedBase: null,
		});
		const outcome = await pending;
		expect(outcome.ok).toBe(false);
		expect(outcome.message).toMatch(/closed before the insert finished/);
		expect(onInserted).not.toHaveBeenCalled();
		expect(armPaint).not.toHaveBeenCalled();
	});
});
