import { ARTWORK_MAX_BYTES, probeArtworkImage, type ArtworkImage, type ArtworkLibraryEntry } from '@portfolio/project-model';
import type { CameraFreeSceneDocument } from '@portfolio/project-model/units';
import type { ProjectApi, ProjectAssetMetadata } from '$lib/platform/project-persistence';
import { verifyArtworkDecode } from '$lib/render/artwork/artwork-decode';
import { imageSha256 } from '$lib/render/artwork/image-digest';

function ready(asset: ProjectAssetMetadata | undefined): asset is ProjectAssetMetadata {
	return asset?.kind === 'texture' && asset.storageKind === 'r2' &&
		asset.sourceKind === 'upload' && asset.importState === 'ready';
}

export async function readVerifiedArtwork(
	api: ProjectApi, projectId: string, image: ArtworkImage, signal: AbortSignal,
	metadata?: ProjectAssetMetadata
) {
	const row = metadata ?? (await api.listAssets(projectId, signal)).find((entry) => entry.id === image.assetId);
	if (!ready(row) || row.id !== image.assetId || !row.byteSize || row.byteSize > ARTWORK_MAX_BYTES || !row.sha256) {
		throw new Error('Artwork image is unavailable in this project.');
	}
	const content = await api.loadAssetContent(projectId, image.assetId, signal);
	signal.throwIfAborted();
	const dimensions = probeArtworkImage(content.bytes);
	if (content.mime !== row.mime || dimensions.mime !== row.mime ||
		content.bytes.length !== row.byteSize || `sha256-${await imageSha256(content.bytes)}` !== row.sha256 ||
		dimensions.pixelWidth !== image.pixelWidth || dimensions.pixelHeight !== image.pixelHeight) {
		throw new Error('Artwork image bytes do not match the saved project.');
	}
	return content;
}

export async function verifyArtworkLibrary(
	api: ProjectApi, projectId: string, scene: CameraFreeSceneDocument, signal: AbortSignal
): Promise<void> {
	const shelf = scene.artworkLibrary ?? [];
	if (!shelf.length) return;
	const rows = new Map((await api.listAssets(projectId, signal)).map((row) => [row.id, row]));
	const placed = new Set(scene.entities.flatMap((entity) => entity.kind === 'artwork' ? [entity.source.assetId] : []));
	for (const image of shelf) {
		const row = rows.get(image.assetId);
		if (!ready(row)) throw new Error(`Artwork “${image.name}” is unavailable. Retry opening the project.`);
		const content = await readVerifiedArtwork(api, projectId, image, signal, row);
		if (placed.has(image.assetId)) await verifyArtworkDecode(content.bytes, content.mime, image);
		signal.throwIfAborted();
	}
}

export async function importArtworkFile(
	api: ProjectApi, projectId: string, file: File, signal: AbortSignal
): Promise<ArtworkLibraryEntry> {
	if (file.size > ARTWORK_MAX_BYTES) throw new Error('Artwork images must be 25 MiB or smaller.');
	const bytes = new Uint8Array(await file.arrayBuffer());
	const { mime, pixelWidth, pixelHeight } = probeArtworkImage(bytes);
	await verifyArtworkDecode(bytes, mime, { pixelWidth, pixelHeight });
	signal.throwIfAborted();
	const sha256 = `sha256-${await imageSha256(bytes)}`;
	const rows = await api.listAssets(projectId, signal);
	const matches = (row: ProjectAssetMetadata) =>
		ready(row) && row.mime === mime && row.byteSize === bytes.length && row.sha256 === sha256;
	const prior = rows.find(matches);
	let assetId: string;
	const name = file.name.trim().slice(0, 120) || 'Artwork';
	if (prior) {
		assetId = prior.id;
		await readVerifiedArtwork(api, projectId, { assetId, pixelWidth, pixelHeight }, signal, prior);
	} else {
		const reserved = await api.registerAsset(projectId, name, signal);
		assetId = reserved.id;
		try {
			const uploaded = await api.uploadAsset(projectId, assetId, bytes, signal);
			if (!matches(uploaded)) throw new Error('Artwork upload did not match the source.');
		} catch (error) {
			signal.throwIfAborted();
			const recovered = (await api.listAssets(projectId, signal)).find((row) => row.id === assetId && matches(row));
			if (!recovered) throw error;
			await readVerifiedArtwork(api, projectId, { assetId, pixelWidth, pixelHeight }, signal, recovered);
		}
	}
	return { assetId, name, pixelWidth, pixelHeight };
}
