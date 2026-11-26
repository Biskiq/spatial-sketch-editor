/**
 * My library: the creator's private, owner-scoped saved Finishes.
 *
 * This session is the one UI authority for the U7 journeys, and it owns no
 * material writer of its own:
 *
 * - **Save** flattens through G's `finishLibraryDraftFromScene` and posts the
 *   immutable payload; the project and its history are never touched.
 * - **Insert** calls G's transfer, then registers exactly one new Finish
 *   through the ordinary F4 `scene-finish-register` intent. Each insert is an
 *   independent copy with the destination's own vendored images.
 * - **Browse** reads the owner's list and verifies each payload with the same
 *   strict codec the API used; the cards show only saved facts.
 *
 * Images stay out of this module's identity: a thumbnail is best-effort and a
 * failed one falls back to the swatch.
 */
import { env } from '$env/dynamic/public';
import type { SemanticReference } from '@portfolio/project-model/references';
import type { Finish } from '@portfolio/project-model/materials';
import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import type { SceneMaterialInstance } from '@portfolio/project-model/scene';
import { finishRefOfKey } from '@portfolio/project-model/scene-planning';
import { stageEnvelope, type StageAdapterServices } from '../stage/stage-adapter-host';
import {
	createMaterialLibraryClient,
	MaterialLibraryClientError,
	type MaterialLibraryClient,
} from '../adapters/scene/library/material-client';
import {
	insertFinishFromLibrary,
	saveFinishToLibrary,
	uploadFinishThumbnailBytes,
} from '../adapters/scene/library/material';
import type { DraftTargets } from '../materials/material-set';
import type { LibraryTarget } from './library-target';
import type { LibraryFinishEntry } from './library-catalogue';
import { privateLibraryEntry, type PrivateLibraryItem } from './private-library-entries';

export type PrivateLibraryStatus = 'idle' | 'loading' | 'ready' | 'offline';

export type PrivateLibraryOutcome =
	| { readonly ok: true; readonly message: string; readonly finishKey?: string }
	| { readonly ok: false; readonly message: string };

export type PrivateLibrarySession = ReturnType<typeof createPrivateLibrarySession>;

function messageOf(error: unknown, fallback: string): string {
	if (error instanceof MaterialLibraryClientError) {
		if (error.code === 'unauthorized') return 'Sign in to use My library.';
		if (error.code === 'network') return 'My library is offline. Try again.';
		return error.message;
	}
	return error instanceof Error ? error.message : fallback;
}

function entityReferenceOf(source: ProjectEnvelope, entityId: string): SemanticReference {
	return {
		version: 1 as const,
		domain: 'scene' as const,
		revision: {
			kind: 'exact' as const,
			contentRevision: source.units.scene.header.contentRevision,
		},
		subject: { kind: 'entity' as const, id: entityId },
		instancePath: [],
		location: { kind: 'project-root' as const },
		componentId: null,
		capabilityId: null,
	};
}

function surfaceReferenceOf(
	source: ProjectEnvelope,
	surface: DraftTargets['surfaces'][number],
): SemanticReference {
	return {
		version: 1 as const,
		domain: 'layout' as const,
		revision: {
			kind: 'exact' as const,
			contentRevision: source.units.layout.header.contentRevision,
		},
		subject:
			surface.kind === 'wall-side'
				? { kind: 'wall' as const, id: surface.wallId }
				: surface.kind === 'region-face'
					? { kind: 'region' as const, id: surface.regionId }
					: { kind: 'room' as const, id: surface.roomId },
		instancePath: [],
		location: { kind: 'project-root' as const },
		componentId: null,
		capabilityId: null,
	};
}

export function createPrivateLibrarySession(input: {
	readonly services: () => StageAdapterServices | null;
	readonly onNotice: (message: string) => void;
	/** Make an inserted Finish the active Paint pick. */
	readonly onInserted: (finishKey: string) => void;
	/** Arm the Stage's Paint tool after an insert. */
	readonly armPaint: () => void;
	/** The Stage's 256 px sample-tile master, when it can draw one. */
	readonly thumbnailBytes?: (source: FinishTileSource) => Promise<Blob | null>;
	readonly apiOrigin?: string;
	readonly client?: MaterialLibraryClient;
}) {
	const client =
		input.client ??
		createMaterialLibraryClient({ apiOrigin: input.apiOrigin ?? env.PUBLIC_API_ORIGIN ?? '' });
	let status = $state<PrivateLibraryStatus>('idle');
	let error = $state<string | null>(null);
	let items = $state.raw<PrivateLibraryItem[]>([]);
	let loading = false;
	let listed = false;
	let sequencer = 0;
	let disposed = false;
	const lifecycle = new AbortController();
	const signal = lifecycle.signal;
	const thumbnails = $state<Record<string, string>>({});
	const thumbnailPending = new Set<string>();
	const removedIds = new Set<string>();
	const removedUrls = new Set<string>();

	function revoke(url: string | undefined): void {
		if (url === undefined) return;
		URL.revokeObjectURL(url);
		removedUrls.add(url);
	}

	function replaceItem(next: PrivateLibraryItem): void {
		items = items.map((item) => (item.summary.id === next.summary.id ? next : item));
	}

	function thumbnailsOf(list: readonly PrivateLibraryItem[]): void {
		for (const item of list) {
			if (!item.summary.hasThumbnail || thumbnailPending.has(item.summary.id)) continue;
			if (thumbnails[item.summary.id] !== undefined) continue;
			thumbnailPending.add(item.summary.id);
			void client
				.thumbnail(item.summary.id, signal)
				.then((bytes) => {
					if (disposed || removedIds.has(item.summary.id)) return;
					const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/png' }));
					thumbnails[item.summary.id] = url;
				})
				.catch(() => undefined)
				.finally(() => thumbnailPending.delete(item.summary.id));
		}
	}

	async function hydrate(list: readonly PrivateLibraryItem[], ticket: number): Promise<void> {
		const next = await Promise.all(
			list.map(async (item) => {
				if (item.payload !== undefined) return item;
				try {
					const read = await client.read(item.summary, signal);
					return { ...item, payload: read.payload };
				} catch {
					return item;
				}
			}),
		);
		if (disposed || signal.aborted || ticket !== sequencer) return;
		const listedIds = new Set(next.map((item) => item.summary.id));
		items = [
			...items.filter(
				(item) => !listedIds.has(item.summary.id) && !removedIds.has(item.summary.id),
			),
			...next.filter((item) => !removedIds.has(item.summary.id)),
		];
		thumbnailsOf(items);
	}

	async function load(force = false): Promise<void> {
		if (disposed || loading) return;
		if (!force && status === 'ready' && listed) return;
		const ticket = ++sequencer;
		loading = true;
		status = 'loading';
		error = null;
		try {
			const summaries = await client.list(signal);
			if (disposed || signal.aborted || ticket !== sequencer) return;
			items = summaries.map((summary) => ({ summary }));
			listed = true;
			status = 'ready';
			thumbnailsOf(items);
			void hydrate(items, ticket);
		} catch (cause) {
			if (disposed || signal.aborted || ticket !== sequencer) return;
			status = 'offline';
			error = messageOf(cause, 'My library could not be read.');
		} finally {
			loading = false;
		}
	}

	function ensureLoaded(): void {
		if (!disposed && (status === 'idle' || !listed)) void load();
	}

	function entries(): LibraryFinishEntry[] {
		return items.map((item) => privateLibraryEntry(item, thumbnails[item.summary.id] ?? null));
	}

	function finishOf(
		snapshot: ReturnType<StageAdapterServices['stage']['snapshot']>,
		id: string,
	): Finish | null {
		return snapshot.domain.scene.materials.find((finish) => finish.id === id) ?? null;
	}

	function finishForSave(finishKey: string, name: string): Finish | null {
		const services = input.services();
		if (services === null) return null;
		const snapshot = services.stage.snapshot();
		const ref = finishRefOfKey(finishKey);
		if (ref === null) return finishOf(snapshot, finishKey.replace(/^project:/, ''));
		if (ref === 'model-own') return null;
		if ('curated' in ref) {
			return { id: `curated:${ref.curated}`, name, base: { catalogue: ref.curated } };
		}
		return finishOf(snapshot, ref.project);
	}

	async function installThumbnail(
		summary: PrivateLibraryItem['summary'],
		source: FinishTileSource | null,
	): Promise<void> {
		if (source === null || input.thumbnailBytes === undefined || disposed) return;
		try {
			const master = await input.thumbnailBytes(source);
			if (master === null || disposed || signal.aborted) return;
			const bytes = new Uint8Array(await master.arrayBuffer());
			if (disposed || signal.aborted) return;
			const uploaded = await uploadFinishThumbnailBytes({
				item: summary,
				bytes,
				client,
				signal,
			});
			if (!uploaded || disposed || signal.aborted) return;
			const existing = items.find((item) => item.summary.id === summary.id);
			if (existing === undefined) return;
			replaceItem({
				...existing,
				summary: { ...summary, hasThumbnail: true },
			});
			thumbnailsOf(items);
		} catch {
			// The saved item stays usable with its swatch.
		}
	}

	async function saveRecord(inputRecord: {
		readonly finish: Finish;
		readonly source: ProjectEnvelope;
		readonly tileSource: FinishTileSource | null;
	}): Promise<PrivateLibraryOutcome> {
		if (disposed) return { ok: false, message: 'My library closed before the save finished.' };
		const operationId = crypto.randomUUID();
		try {
			const result = await saveFinishToLibrary({
				source: inputRecord.source,
				finish: inputRecord.finish,
				operationId,
				client,
				signal,
			});
			if (disposed || signal.aborted)
				return { ok: false, message: 'My library closed before the save finished.' };
			if (!result.ok) {
				return {
					ok: false,
					message: result.issues[0]?.message ?? 'That Finish could not be saved.',
				};
			}
			const palette = inputRecord.source.units.scene.data.palette ?? [];
			const flattened = result.draft.capturedFollowers.map(
				(slotId) => palette.find((slot) => slot.id === slotId)?.name ?? slotId,
			);
			const item: PrivateLibraryItem = {
				summary: result.summary,
				payload: result.draft.payload,
				...(flattened.length === 0 ? {} : { flattened }),
			};
			items = [item, ...items.filter((entry) => entry.summary.id !== item.summary.id)];
			status = 'ready';
			error = null;
			void installThumbnail(result.summary, inputRecord.tileSource);
			const message = `Saved “${result.summary.name}” to My library${
				flattened.length > 0 ? ` · ${flattened[0]} saved as its colour` : ''
			} · no project change`;
			input.onNotice(message);
			return { ok: true, message };
		} catch (cause) {
			if (disposed || signal.aborted)
				return { ok: false, message: 'My library closed before the save finished.' };
			const message = messageOf(cause, 'That Finish could not be saved.');
			if (cause instanceof MaterialLibraryClientError && cause.code === 'network')
				status = 'offline';
			return { ok: false, message };
		}
	}

	async function saveFinish(inputSave: {
		readonly finishKey: string;
		readonly name: string;
		readonly tileSource: FinishTileSource | null;
	}): Promise<PrivateLibraryOutcome> {
		const services = input.services();
		const finish = finishForSave(inputSave.finishKey, inputSave.name);
		if (services === null || finish === null) {
			return { ok: false, message: 'That Finish is no longer in the current revision.' };
		}
		return saveRecord({
			finish,
			source: stageEnvelope(services.stage.snapshot()),
			tileSource: inputSave.tileSource,
		});
	}

	async function saveDraft(inputSave: {
		readonly name: string;
		readonly instance: SceneMaterialInstance;
		readonly tileSource: FinishTileSource | null;
	}): Promise<PrivateLibraryOutcome> {
		const services = input.services();
		if (services === null) return { ok: false, message: 'The Stage is still opening.' };
		return saveRecord({
			finish: {
				id: 'library-draft',
				name: inputSave.name,
				base: inputSave.instance.base,
				...(inputSave.instance.overrides === undefined
					? {}
					: { overrides: inputSave.instance.overrides }),
			},
			source: stageEnvelope(services.stage.snapshot()),
			tileSource: inputSave.tileSource,
		});
	}

	async function insert(
		entryKey: string,
		target: LibraryTarget | null,
		mode: 'paint' | 'apply',
	): Promise<PrivateLibraryOutcome> {
		if (disposed) return { ok: false, message: 'My library closed before the insert finished.' };
		const id = entryKey.startsWith('mine:') ? entryKey.slice('mine:'.length) : entryKey;
		const item = items.find((candidate) => candidate.summary.id === id);
		const services = input.services();
		if (item === undefined)
			return { ok: false, message: 'That saved material is no longer listed.' };
		if (services === null) return { ok: false, message: 'The Stage is still opening.' };
		const snapshot = services.stage.snapshot();
		const source = stageEnvelope(snapshot);
		const targets: DraftTargets =
			target === null
				? { entityIds: [], surfaces: [] }
				: target.kind === 'entity'
					? { entityIds: [target.entityId], surfaces: [] }
					: { entityIds: [], surfaces: [target.surface] };
		const operationId = crypto.randomUUID();
		const outcome = await insertFinishFromLibrary({
			item: item.summary,
			destinationProjectId: source.id,
			operationId,
			expectedRevision: snapshot.acceptedRevision,
			targets,
			client,
			host: {
				current: () => ({
					source: stageEnvelope(services.stage.snapshot()),
					revision: services.stage.snapshot().acceptedRevision,
				}),
				accept: (intent) => services.authoring.accept(intent),
				entityReference: entityReferenceOf,
				surfaceReference: surfaceReferenceOf,
				materialProofs: services.materialProofs,
			},
			signal,
		});
		if (disposed || signal.aborted)
			return { ok: false, message: 'My library closed before the insert finished.' };
		if (!outcome.ok) return { ok: false, message: outcome.message };
		const finishKey = `project:${outcome.finishId}`;
		input.onInserted(finishKey);
		if (mode === 'paint') input.armPaint();
		const message =
			target === null
				? `Inserted “${item.summary.name}” · an independent Finish`
				: `Applied “${item.summary.name}” to ${target.label} · one undo`;
		input.onNotice(message);
		return { ok: true, message, finishKey };
	}

	async function remove(id: string): Promise<PrivateLibraryOutcome> {
		if (disposed) return { ok: false, message: 'My library closed before the item was removed.' };
		try {
			await client.remove(id);
			if (disposed) return { ok: false, message: 'My library closed before the item was removed.' };
			removedIds.add(id);
			const url = thumbnails[id];
			delete thumbnails[id];
			revoke(url);
			items = items.filter((item) => item.summary.id !== id);
			input.onNotice('Removed from My library · copies already in a project stay.');
			return { ok: true, message: 'Removed from My library' };
		} catch (cause) {
			return { ok: false, message: messageOf(cause, 'That saved material could not be removed.') };
		}
	}

	return {
		get status() {
			return status;
		},
		get error() {
			return error;
		},
		get items() {
			return items;
		},
		entries,
		ensureLoaded,
		load,
		saveFinish,
		saveDraft,
		insert,
		remove,
		thumbnail(id: string): string | null {
			return thumbnails[id] ?? null;
		},
		dispose(): void {
			disposed = true;
			lifecycle.abort();
			sequencer += 1;
			for (const url of Object.values(thumbnails)) revoke(url);
			items = [];
			listed = false;
			loading = false;
			status = 'idle';
			error = null;
		},
	};
}

export type { PrivateLibraryItem };
