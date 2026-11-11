import { defaultArtworkWidth, type ArtworkLibraryEntry, type SceneArtworkEntity } from '@portfolio/project-model';
import { ARTWORK_DUPLICATE, ARTWORK_IMPORT, ARTWORK_PLACE } from '@portfolio/project-model/scene-planning';
import type { ProjectApi } from '$lib/platform/project-persistence';
import { stageScene, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import type { LookCardStratum } from '../look/look-authoring.svelte';
import ArtworkCard from './ArtworkCard.svelte';
import { artworkCommand } from './artwork-command';
import type { ArtworkPose } from './artwork-placement';
import { importArtworkFile } from './project-artwork';

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
	let placing = false;
	let request: AbortController | null = null;

	function cancel() {
		armed = null;
		ghost = null;
		request?.abort();
		request = null;
		importing = false;
	}
	function arm(entry: ArtworkLibraryEntry) {
		if (!host.canEdit()) return;
		armed = entry;
		ghost = null;
		host.notice(`Place ${entry.name} on the Stage. Esc cancels.`);
	}
	async function importFiles(files: File[]) {
		const services = host.services();
		if (importing || !host.canEdit() || services === null || files.length === 0) return;
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
	function move(pose: ArtworkPose | null) {
		if (!armed || !pose) { ghost = null; return; }
		const { assetId, pixelWidth, pixelHeight, name } = armed;
		ghost = {
			kind: 'artwork', id: 'artwork-placement-ghost', name, ...pose,
			widthMeters: defaultArtworkWidth(armed), source: { kind: 'image', assetId, pixelWidth, pixelHeight }
		};
	}
	async function place(pose: ArtworkPose | null) {
		const services = host.services();
		if (placing || !armed || !services || !host.canEdit()) return;
		if (!pose) { host.notice('No placement is available at that point.'); return; }
		const entry = armed;
		placing = true;
		try {
			const id = crypto.randomUUID();
			const result = await artworkCommand(services, ARTWORK_PLACE, { assetId: entry.assetId, ...pose }, { create: id });
			if (host.services() !== services) return;
			if (result.kind === 'refused') { host.notice(result.message); return; }
			if (armed === entry) cancel();
			host.select(services, id);
			host.notice('');
		} finally { placing = false; }
	}
	function card(entity: SceneArtworkEntity | null): LookCardStratum | null {
		const services = host.services();
		if (!entity || !services) return null;
		return {
			facts: [{ label: 'Source', value: `${entity.source.pixelWidth} × ${entity.source.pixelHeight} px` }],
			writer: { adapterId: 'scene', summary: 'Artwork dimensions and pose', fieldIds: ['position', 'elevation', 'yaw'], view: { component: ArtworkCard, services } },
			actions: [
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

	return { get armed() { return armed; }, get ghost() { return ghost; }, get importing() { return importing; }, cancel, arm, importFiles, move, place, card };
}
