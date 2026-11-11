import { defaultArtworkWidth, type ArtworkLibraryEntry, type SceneArtworkEntity } from '@portfolio/project-model';
import { ARTWORK_DUPLICATE, ARTWORK_IMPORT, ARTWORK_PLACE, ARTWORK_REPLACE } from '@portfolio/project-model/scene-planning';
import type { ProjectApi } from '$lib/platform/project-persistence';
import { stageScene, type StageAdapterServices, type StageCardActionOutcome } from '$lib/authoring/stage/stage-adapter-host';
import type { LookCardStratum } from '../look/look-authoring.svelte';
import ArtworkCard from './ArtworkCard.svelte';
import { artworkCommand } from './artwork-command';
import { artworkHangingGuides, snapArtworkHeight } from './artwork-hanging';
import type { ArtworkPose } from './artwork-placement';
import { importArtworkFile } from './project-artwork';

function pickArtworkFile(): Promise<File | null> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/png,image/jpeg,image/webp';
		input.style.setProperty('position', 'fixed');
		input.style.setProperty('left', '-1000px');
		input.style.setProperty('opacity', '0');
		input.style.setProperty('pointer-events', 'none');
		document.body.append(input);
		let settled = false;
		let timer: number | undefined;
		const finish = (file: File | null) => {
			if (settled) return;
			settled = true;
			if (timer !== undefined) window.clearTimeout(timer);
			input.remove();
			resolve(file);
		};
		input.addEventListener('change', () => finish(input.files?.[0] ?? null), { once: true });
		input.addEventListener('cancel', () => finish(null), { once: true });
		timer = window.setTimeout(() => finish(null), 60_000);
		input.click();
	});
}

export function createArtworkAuthoring(host: {
	api: ProjectApi | null;
	services: () => StageAdapterServices | null;
	canEdit: () => boolean;
	isSaved: () => boolean;
	notice: (message: string) => void;
	select: (services: StageAdapterServices, id: string) => void;
}) {
	let armed = $state.raw<ArtworkLibraryEntry | null>(null);
	let ghost = $state.raw<SceneArtworkEntity | null>(null);
	let importing = $state(false);
	let replacing = $state(false);
	let placing = false;
	let request: AbortController | null = null;

	function cancel() {
		armed = null;
		ghost = null;
		request?.abort();
		request = null;
		importing = false;
		replacing = false;
	}
	function arm(entry: ArtworkLibraryEntry) {
		if (!host.canEdit()) return;
		armed = entry;
		ghost = null;
		host.notice(`Place ${entry.name} on the Stage. Esc cancels.`);
	}
	async function importFiles(files: File[]) {
		const services = host.services();
		if (importing || replacing || !host.canEdit() || services === null || files.length === 0) return;
		if (!host.api || !host.isSaved()) {
			host.notice('Save this project to the cloud before importing Artwork.');
			return;
		}
		const abort = new AbortController();
		request = abort;
		importing = true;
		const accepted = services.stage.snapshot().acceptedRevision;
		const entries = new Map<string, ArtworkLibraryEntry>();
		const errors: string[] = [];
		try {
			for (const file of files) {
				try {
					const entry = await importArtworkFile(host.api, accepted.projectId, file, abort.signal);
					if (!entries.has(entry.assetId)) entries.set(entry.assetId, entry);
				} catch (error) {
					if (abort.signal.aborted) return;
					errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Import failed.'}`);
				}
			}
			if (abort.signal.aborted || host.services() !== services || !host.canEdit()) return;
			const shelf = stageScene(services.stage.snapshot()).artworkLibrary ?? [];
			const newEntries = [...entries.values()].filter((entry) => !shelf.some((prior) => prior.assetId === entry.assetId));
			if (newEntries.length) {
				const result = await artworkCommand(services, ARTWORK_IMPORT, { entries: newEntries }, { expectedRevision: accepted });
				if (abort.signal.aborted || host.services() !== services) return;
				if (result.kind === 'refused') {
					host.notice(`${result.message} Retry the import to reuse completed uploads.`);
					return;
				}
			}
			const first = entries.values().next().value;
			if (first) arm(first);
			if (errors.length) host.notice(errors.join(' · ') + (first ? ' Click the Stage to place the first successful import.' : ''));
		} finally {
			if (request === abort) { request = null; importing = false; }
		}
	}
	function ghostFor(entry: ArtworkLibraryEntry, pose: ArtworkPose): SceneArtworkEntity {
		const { assetId, pixelWidth, pixelHeight, name } = entry;
		return {
			kind: 'artwork', id: 'artwork-placement-ghost', name, ...pose,
			widthMeters: defaultArtworkWidth(entry), source: { kind: 'image', assetId, pixelWidth, pixelHeight }
		};
	}
	function snapped(services: StageAdapterServices, candidate: SceneArtworkEntity): SceneArtworkEntity {
		const snapshot = services.stage.snapshot();
		const guides = artworkHangingGuides(stageScene(snapshot), candidate, snapshot.domain.datumMeters);
		const snap = snapArtworkHeight(candidate.position, guides);
		return snap.guideId === null ? candidate : { ...candidate, position: snap.position };
	}
	function move(pose: ArtworkPose | null) {
		const services = host.services();
		if (!armed || !pose || !services) { ghost = null; return; }
		ghost = snapped(services, ghostFor(armed, pose));
	}
	async function place(pose: ArtworkPose | null) {
		const services = host.services();
		if (placing || !armed || !services || !host.canEdit()) return;
		if (!pose) { host.notice('No placement is available at that point.'); return; }
		const entry = armed;
		placing = true;
		try {
			const id = crypto.randomUUID();
			const candidate = snapped(services, ghostFor(entry, pose));
			const result = await artworkCommand(services, ARTWORK_PLACE,
				{ assetId: entry.assetId, position: candidate.position, rotation: candidate.rotation }, { create: id });
			if (host.services() !== services) return;
			if (result.kind === 'refused') { host.notice(result.message); return; }
			if (armed === entry) cancel();
			host.select(services, id);
			host.notice('');
		} finally { placing = false; }
	}
	async function replaceFile(entity: SceneArtworkEntity, file: File): Promise<StageCardActionOutcome> {
		const services = host.services();
		const api = host.api;
		if (replacing || importing || !host.canEdit() || services === null) return { kind: 'no-op' };
		if (!api || !host.isSaved()) {
			return { kind: 'refused', message: 'Save this project to the cloud before replacing Artwork.' };
		}
		const abort = new AbortController();
		request = abort;
		replacing = true;
		const accepted = services.stage.snapshot().acceptedRevision;
		try {
			const entry = await importArtworkFile(api, accepted.projectId, file, abort.signal);
			if (abort.signal.aborted || host.services() !== services) return { kind: 'no-op' };
			const result = await artworkCommand(services, ARTWORK_REPLACE, { entry },
				{ target: entity.id, expectedRevision: accepted });
			if (abort.signal.aborted || host.services() !== services) return { kind: 'no-op' };
			if (result.kind === 'refused') return { kind: 'refused', message: result.message };
			const current = stageScene(services.stage.snapshot()).entities.find((item) => item.id === entity.id);
			if (current?.kind === 'artwork' && Math.abs(current.widthMeters - entity.widthMeters) > 1e-9) {
				host.notice('Image replaced. Width adjusted to keep the new aspect.');
			}
			return { kind: 'accepted' };
		} catch (error) {
			if (abort.signal.aborted) return { kind: 'no-op' };
			return { kind: 'refused', message: error instanceof Error ? error.message : 'Image replacement failed.' };
		} finally {
			if (request === abort) { request = null; replacing = false; }
		}
	}
	function card(entity: SceneArtworkEntity | null): LookCardStratum | null {
		const services = host.services();
		if (!entity || !services) return null;
		return {
			facts: [{ label: 'Source', value: `${entity.source.pixelWidth} × ${entity.source.pixelHeight} px` }],
			writer: { adapterId: 'scene', summary: 'Artwork dimensions, pose and frame', fieldIds: ['position', 'elevation', 'yaw', 'frame'], view: { component: ArtworkCard, services } },
			actions: [
				{ adapterId: 'scene', id: 'artwork-replace', label: 'Replace image', async run() {
					const file = await pickArtworkFile();
					if (file === null) return { kind: 'no-op' };
					return replaceFile(entity, file);
				} },
				{ adapterId: 'scene', id: 'artwork-duplicate', label: 'Duplicate', group: 'secondary', async run() {
					const id = crypto.randomUUID();
					const result = await artworkCommand(services, ARTWORK_DUPLICATE, {}, { target: entity.id, create: id });
					if (result.kind === 'refused') return { kind: 'refused', message: result.message };
					host.select(services, id);
					return { kind: 'accepted' };
				} },
				{ adapterId: 'scene', id: 'artwork-delete', label: 'Delete Artwork', destructive: true,
					detail: `Remove ${entity.name} from the Stage. The image stays in This project.`, async run() {
						const result = await artworkCommand(services, 'delete-one', { entityId: entity.id }, { target: entity.id });
						return result.kind === 'refused' ? { kind: 'refused', message: result.message } : { kind: 'accepted' };
					}
				}
			]
		};
	}

	return { get armed() { return armed; }, get ghost() { return ghost; }, get importing() { return importing; }, get replacing() { return replacing; }, cancel, arm, importFiles, move, place, replaceFile, card };
}
