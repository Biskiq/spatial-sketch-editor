import {
	ARTWORK_MAX_BYTES,
	ARTWORK_MAX_IMAGE_EDGE,
	probeArtworkImage,
	type ArtworkImage,
	type ArtworkLibraryEntry
} from '@portfolio/project-model';
import type { CameraFreeSceneDocument } from '@portfolio/project-model/units';
import type { ProjectApi, ProjectAssetMetadata } from '$lib/platform/project-persistence';
import { verifyArtworkDecode } from '$lib/render/artwork/artwork-decode';
import { imageSha256 } from '$lib/render/artwork/image-digest';

/**
 * One project image import, shared by Artwork (P20) and Finish images (T2.S4b).
 *
 * The steps are P20's, unchanged: size cap, magic-byte probe, decode check,
 * sha256 dedupe against the project's assets, register then upload, and a
 * re-list recovery when a response is lost. The caller supplies only the
 * **size policy**, which is the one thing the two features decide differently:
 * a Finish image is bounded by the same byte cap and the same 4096 px edge, and
 * no import ever downscales.
 *
 * The import is deliberately outside the Scene: it produces an immutable P20
 * asset id and the facts that become a resource pin. Committing those bytes to a
 * Scene (a texture record, a resource and a Finish) is one separate intent.
 */
export type ProjectImagePolicy = {
	/** The hard byte cap; over it the import refuses. */
	readonly maxBytes: number;
	/** The hard long-edge cap; over it the probe refuses. */
	readonly maxLongEdge: number;
	/** How a refusal names the thing, e.g. `Artwork` or `Finish image`. */
	readonly label: string;
};

export const ARTWORK_IMAGE_POLICY: ProjectImagePolicy = {
	maxBytes: ARTWORK_MAX_BYTES,
	maxLongEdge: ARTWORK_MAX_IMAGE_EDGE,
	label: 'Artwork'
};

/** D3: the same bounded limits as Artwork; small images are accepted. */
export const FINISH_IMAGE_POLICY: ProjectImagePolicy = {
	maxBytes: ARTWORK_MAX_BYTES,
	maxLongEdge: ARTWORK_MAX_IMAGE_EDGE,
	label: 'Finish'
};

export type ImportedProjectImage = {
	readonly assetId: string;
	readonly name: string;
	readonly pixelWidth: number;
	readonly pixelHeight: number;
	readonly mime: 'image/png' | 'image/jpeg' | 'image/webp';
	readonly byteSize: number;
	/** `sha256-<hex>`, the same identity the asset registry and pins carry. */
	readonly sha256: string;
};

export type ProjectImageImportHooks = {
	/** `checking` covers the probe and decode; `uploading` covers the P20 write. */
	readonly onPhase?: (phase: 'checking' | 'uploading') => void;
};

function ready(asset: ProjectAssetMetadata | undefined): asset is ProjectAssetMetadata {
	return asset?.kind === 'texture' && asset.storageKind === 'r2' &&
		asset.sourceKind === 'upload' && asset.importState === 'ready';
}

function tooLarge(policy: ProjectImagePolicy): string {
	const mib = Math.round(policy.maxBytes / (1024 * 1024));
	return `${policy.label} images must be ${mib} MiB or smaller.`;
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

/**
 * Import one image into the project's P20 assets, verifying and deduplicating.
 *
 * `name` is display-only. Artwork keeps the file's name (bounded to 120
 * characters); a Finish uses the file stem. The same bytes always return the
 * same asset id, so a second import reuses the existing asset instead of
 * uploading another copy.
 */
export async function importProjectImage(
	api: ProjectApi,
	projectId: string,
	file: File,
	signal: AbortSignal,
	policy: ProjectImagePolicy,
	hooks: ProjectImageImportHooks = {}
): Promise<ImportedProjectImage> {
	if (file.size > policy.maxBytes) throw new Error(tooLarge(policy));
	hooks.onPhase?.('checking');
	const bytes = new Uint8Array(await file.arrayBuffer());
	const { mime, pixelWidth, pixelHeight } = (() => {
		try {
			return probeArtworkImage(bytes);
		} catch (error) {
			// The probe's words are written for Artwork; a Finish image names itself.
			const message = error instanceof Error ? error.message : 'Unsupported image.';
			throw new Error(message.replace(/\bArtwork\b/g, policy.label));
		}
	})();
	if (Math.max(pixelWidth, pixelHeight) > policy.maxLongEdge) {
		throw new Error(
			`${policy.label} images support up to ${policy.maxLongEdge} px per edge. Resize the image and try again.`
		);
	}
	await verifyArtworkDecode(bytes, mime, { pixelWidth, pixelHeight });
	signal.throwIfAborted();
	const sha256 = `sha256-${await imageSha256(bytes)}`;
	const rows = await api.listAssets(projectId, signal);
	const matches = (row: ProjectAssetMetadata) =>
		ready(row) && row.mime === mime && row.byteSize === bytes.length && row.sha256 === sha256;
	const prior = rows.find(matches);
	let assetId: string;
	const name = file.name.trim().slice(0, 120) || policy.label;
	hooks.onPhase?.('uploading');
	if (prior) {
		assetId = prior.id;
		await readVerifiedArtwork(api, projectId, { assetId, pixelWidth, pixelHeight }, signal, prior);
	} else {
		const reserved = await api.registerAsset(projectId, name, signal);
		assetId = reserved.id;
		try {
			const uploaded = await api.uploadAsset(projectId, assetId, bytes, signal);
			if (!matches(uploaded)) throw new Error(`${policy.label} upload did not match the source.`);
		} catch (error) {
			signal.throwIfAborted();
			const recovered = (await api.listAssets(projectId, signal)).find((row) => row.id === assetId && matches(row));
			if (!recovered) throw error;
			await readVerifiedArtwork(api, projectId, { assetId, pixelWidth, pixelHeight }, signal, recovered);
		}
	}
	return { assetId, name, pixelWidth, pixelHeight, mime, byteSize: bytes.length, sha256 };
}

/** Artwork's unchanged import: the P20 image plus its shelf entry. */
export async function importArtworkFile(
	api: ProjectApi, projectId: string, file: File, signal: AbortSignal
): Promise<ArtworkLibraryEntry> {
	const imported = await importProjectImage(api, projectId, file, signal, ARTWORK_IMAGE_POLICY);
	return {
		assetId: imported.assetId,
		name: imported.name,
		pixelWidth: imported.pixelWidth,
		pixelHeight: imported.pixelHeight
	};
}
