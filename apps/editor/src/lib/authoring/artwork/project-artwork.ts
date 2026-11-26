import {
	ARTWORK_MAX_BYTES,
	ARTWORK_MAX_IMAGE_EDGE,
	probeArtworkImage,
	type ArtworkImage,
	type ArtworkLibraryEntry,
} from '@portfolio/project-model/artwork';
import {
	collectEnvelopeImageRequirements,
	type ProjectImagePin,
	type ProjectImageRequirement,
} from '@portfolio/project-model/project-images';
import type { CameraFreeSceneDocument, ProjectEnvelope } from '@portfolio/project-model/units';
import type {
	ProjectApi,
	ProjectAssetContent,
	ProjectAssetMetadata,
} from '$lib/platform/project-persistence';
import { ProjectPersistenceError } from '$lib/platform/project-identity';
import { verifyArtworkDecode } from '$lib/render/artwork/artwork-decode';
import { imageSha256 } from '$lib/render/artwork/image-digest';
import type { VerifiedProjectImageCache } from './project-image-cache';

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
	label: 'Artwork',
};

/** D3: the same bounded limits as Artwork; small images are accepted. */
export const FINISH_IMAGE_POLICY: ProjectImagePolicy = {
	maxBytes: ARTWORK_MAX_BYTES,
	maxLongEdge: ARTWORK_MAX_IMAGE_EDGE,
	label: 'Finish',
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
	/**
	 * Asset ids the caller's project already references. When several ready rows
	 * hold identical bytes, a referenced one is reused before any other.
	 */
	readonly preferAssetIds?: ReadonlySet<string>;
};

/**
 * One reservation/upload per project and digest at a time. A second import of
 * the same bytes while the first is in flight waits for that asset id instead of
 * reserving another row; if the first fails or is cancelled, it runs its own.
 */
const inflightImageUploads = new Map<string, Promise<string>>();

/**
 * The deterministic reuse choice among identical ready rows: a referenced id
 * first, else the lexically first id. Listing order never decides.
 */
export function preferredProjectImageRow<T extends { readonly id: string }>(
	rows: readonly T[],
	prefer: ReadonlySet<string> | undefined,
): T | undefined {
	const sorted = [...rows].sort((left, right) =>
		left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
	);
	return sorted.find((row) => prefer?.has(row.id) === true) ?? sorted[0];
}

function ready(asset: ProjectAssetMetadata | undefined): asset is ProjectAssetMetadata {
	return (
		asset?.kind === 'texture' &&
		asset.storageKind === 'r2' &&
		asset.sourceKind === 'upload' &&
		asset.importState === 'ready'
	);
}

function tooLarge(policy: ProjectImagePolicy): string {
	const mib = Math.round(policy.maxBytes / (1024 * 1024));
	return `${policy.label} images must be ${mib} MiB or smaller.`;
}

export async function readVerifiedArtwork(
	api: ProjectApi,
	projectId: string,
	image: ArtworkImage,
	signal: AbortSignal,
	metadata?: ProjectAssetMetadata,
) {
	const row =
		metadata ??
		(await api.listAssets(projectId, signal)).find((entry) => entry.id === image.assetId);
	if (
		!ready(row) ||
		row.id !== image.assetId ||
		!row.byteSize ||
		row.byteSize > ARTWORK_MAX_BYTES ||
		!row.sha256
	) {
		throw new Error('Artwork image is unavailable in this project.');
	}
	const content = await api.loadAssetContent(projectId, image.assetId, signal);
	signal.throwIfAborted();
	const dimensions = probeArtworkImage(content.bytes);
	if (
		content.mime !== row.mime ||
		dimensions.mime !== row.mime ||
		content.bytes.length !== row.byteSize ||
		`sha256-${await imageSha256(content.bytes)}` !== row.sha256 ||
		dimensions.pixelWidth !== image.pixelWidth ||
		dimensions.pixelHeight !== image.pixelHeight
	) {
		throw new Error('Artwork image bytes do not match the saved project.');
	}
	return content;
}

export async function verifyArtworkLibrary(
	api: ProjectApi,
	projectId: string,
	scene: CameraFreeSceneDocument,
	signal: AbortSignal,
): Promise<void> {
	const shelf = scene.artworkLibrary ?? [];
	if (!shelf.length) return;
	const rows = new Map((await api.listAssets(projectId, signal)).map((row) => [row.id, row]));
	const placed = new Set(
		scene.entities.flatMap((entity) => (entity.kind === 'artwork' ? [entity.source.assetId] : [])),
	);
	for (const image of shelf) {
		const row = rows.get(image.assetId);
		if (!ready(row))
			throw new Error(`Artwork “${image.name}” is unavailable. Retry opening the project.`);
		const content = await readVerifiedArtwork(api, projectId, image, signal, row);
		if (placed.has(image.assetId)) await verifyArtworkDecode(content.bytes, content.mime, image);
		signal.throwIfAborted();
	}
}

/**
 * A cold-load image refusal with every fact the repaired-session UI needs.
 *
 * The old session stays mounted because verification happens before the
 * candidate is installed; this diagnostic names the image, the saved base it
 * belongs to and every authored path that references it, so the repair can be
 * offered without discarding the project the creator still has open.
 */
export type ProjectImageDiagnostic = {
	readonly code:
		| 'image-missing'
		| 'image-corrupt'
		| 'image-pin-changed'
		| 'image-unavailable'
		| 'image-forbidden'
		| 'image-incompatible'
		| 'image-requirement-invalid';
	readonly projectId: string;
	readonly savedBase: string | null;
	readonly assetId: string;
	readonly expectedPin: ProjectImagePin | null;
	readonly paths: readonly string[];
	readonly action: string;
};

export class ProjectImageLoadError extends Error {
	constructor(readonly diagnostic: ProjectImageDiagnostic) {
		super(projectImageMessage(diagnostic));
		this.name = 'ProjectImageLoadError';
	}
}

function projectImageMessage(diagnostic: ProjectImageDiagnostic): string {
	const subject =
		diagnostic.assetId === ''
			? 'The saved project images'
			: `Project image “${diagnostic.assetId}”`;
	switch (diagnostic.code) {
		case 'image-missing':
			return `${subject} has no stored bytes in this project. ${diagnostic.action}`;
		case 'image-corrupt':
			return `${subject} does not match the saved image. ${diagnostic.action}`;
		case 'image-pin-changed':
			return `${subject} changed since the saved revision pinned it. ${diagnostic.action}`;
		case 'image-unavailable':
			return `${subject} could not be read from storage. Retry opening the project.`;
		case 'image-forbidden':
			return `This account may not read ${subject.toLowerCase()}. Sign in with the project owner and retry.`;
		case 'image-incompatible':
			return `${subject} is not a supported static image. ${diagnostic.action}`;
		default:
			return `${subject} cannot be verified from the saved project. ${diagnostic.action}`;
	}
}

function diagnostic(
	requirement: ProjectImageRequirement | null,
	projectId: string,
	savedBase: string | null,
	code: ProjectImageDiagnostic['code'],
	action: string,
	paths?: readonly string[],
): ProjectImageDiagnostic {
	return {
		code,
		projectId,
		savedBase,
		assetId: requirement?.assetId ?? '',
		expectedPin: requirement?.expectedPin ?? null,
		paths: paths ?? requirement?.paths ?? [],
		action,
	};
}

const REPAIR_ACTION =
	'Repair it from the Finish or Artwork image with its exact original file, then reopen the project.';
const REIMPORT_ACTION =
	'Re-export it as a static PNG, JPEG or WebP and import it again, then reopen the project.';

function persistenceDiagnostic(
	error: unknown,
	requirement: ProjectImageRequirement,
	projectId: string,
	savedBase: string | null,
): ProjectImageDiagnostic {
	if (error instanceof ProjectPersistenceError) {
		if (error.code === 'auth')
			return diagnostic(
				requirement,
				projectId,
				savedBase,
				'image-forbidden',
				'Sign in again and retry.',
			);
		if (error.code === 'not-found')
			return diagnostic(requirement, projectId, savedBase, 'image-missing', REPAIR_ACTION);
		if (error.code === 'network' || error.code === 'server') {
			return diagnostic(
				requirement,
				projectId,
				savedBase,
				'image-unavailable',
				'Retry opening the project.',
			);
		}
	}
	return diagnostic(
		requirement,
		projectId,
		savedBase,
		'image-unavailable',
		'Retry opening the project.',
	);
}

/**
 * Verify the complete image closure of a project before it is installed.
 *
 * Every project texture (including an orphan record) and every Artwork shelf
 * image is resolved against its ready registry row and its stored bytes. A
 * placed Artwork image is decoded as well; Finish images and unplaced shelf
 * entries are verified but decoded only when a visible consumer asks for them.
 * Verified bytes are handed to the route's short-lived cache.
 */
export async function verifyProjectImageClosure(
	api: ProjectApi,
	projectId: string,
	envelope: ProjectEnvelope,
	signal: AbortSignal,
	options: {
		readonly savedBaseToken?: string | null;
		readonly cache?: VerifiedProjectImageCache;
	} = {},
): Promise<readonly ProjectImageRequirement[]> {
	const savedBase = options.savedBaseToken ?? null;
	const closure = collectEnvelopeImageRequirements(envelope, 'private-load');
	if (closure.issues[0] !== undefined) {
		throw new ProjectImageLoadError(
			diagnostic(
				null,
				projectId,
				savedBase,
				'image-requirement-invalid',
				'Reopen the saved project and correct the image reference.',
				[closure.issues[0].path],
			),
		);
	}
	if (closure.requirements.length === 0) return closure.requirements;

	let rows: ProjectAssetMetadata[];
	try {
		rows = await api.listAssets(projectId, signal);
	} catch (error) {
		if (signal.aborted) throw error;
		const forbidden = error instanceof ProjectPersistenceError && error.code === 'auth';
		throw new ProjectImageLoadError(
			diagnostic(
				null,
				projectId,
				savedBase,
				forbidden ? 'image-forbidden' : 'image-unavailable',
				forbidden ? 'Sign in with the project owner and retry.' : 'Retry opening the project.',
			),
		);
	}
	const byId = new Map(rows.map((row) => [row.id, row]));
	const placed = new Set(
		envelope.units.scene.data.entities.flatMap((entity) =>
			entity.kind === 'artwork' ? [entity.source.assetId] : [],
		),
	);

	for (const requirement of closure.requirements) {
		signal.throwIfAborted();
		const row = byId.get(requirement.assetId);
		if (!ready(row)) {
			throw new ProjectImageLoadError(
				diagnostic(requirement, projectId, savedBase, 'image-missing', REPAIR_ACTION),
			);
		}
		if (
			requirement.expectedPin !== null &&
			(row.sha256 !== requirement.expectedPin.hash ||
				row.mime !== requirement.expectedPin.mime ||
				row.byteSize !== requirement.expectedPin.size)
		) {
			throw new ProjectImageLoadError(
				diagnostic(requirement, projectId, savedBase, 'image-pin-changed', REPAIR_ACTION),
			);
		}

		let content: ProjectAssetContent;
		try {
			content = await api.loadAssetContent(projectId, requirement.assetId, signal);
		} catch (error) {
			if (signal.aborted) throw error;
			throw new ProjectImageLoadError(
				persistenceDiagnostic(error, requirement, projectId, savedBase),
			);
		}
		signal.throwIfAborted();

		if (
			content.bytes.length !== row.byteSize ||
			content.mime !== row.mime ||
			`sha256-${await imageSha256(content.bytes)}` !== row.sha256
		) {
			throw new ProjectImageLoadError(
				diagnostic(requirement, projectId, savedBase, 'image-corrupt', REPAIR_ACTION),
			);
		}
		let probe: ReturnType<typeof probeArtworkImage>;
		try {
			probe = probeArtworkImage(content.bytes);
		} catch {
			throw new ProjectImageLoadError(
				diagnostic(requirement, projectId, savedBase, 'image-incompatible', REIMPORT_ACTION),
			);
		}
		if (probe.mime !== content.mime) {
			throw new ProjectImageLoadError(
				diagnostic(requirement, projectId, savedBase, 'image-corrupt', REPAIR_ACTION),
			);
		}
		if (
			requirement.artwork !== null &&
			(probe.pixelWidth !== requirement.artwork.pixelWidth ||
				probe.pixelHeight !== requirement.artwork.pixelHeight)
		) {
			throw new ProjectImageLoadError(
				diagnostic(requirement, projectId, savedBase, 'image-corrupt', REPAIR_ACTION),
			);
		}
		if (requirement.artwork !== null && placed.has(requirement.assetId)) {
			try {
				await verifyArtworkDecode(content.bytes, content.mime, {
					pixelWidth: requirement.artwork.pixelWidth,
					pixelHeight: requirement.artwork.pixelHeight,
				});
			} catch {
				throw new ProjectImageLoadError(
					diagnostic(requirement, projectId, savedBase, 'image-incompatible', REIMPORT_ACTION),
				);
			}
			signal.throwIfAborted();
		}
		options.cache?.put(projectId, requirement.assetId, content);
	}
	return closure.requirements;
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
	hooks: ProjectImageImportHooks = {},
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
			`${policy.label} images support up to ${policy.maxLongEdge} px per edge. Resize the image and try again.`,
		);
	}
	await verifyArtworkDecode(bytes, mime, { pixelWidth, pixelHeight });
	signal.throwIfAborted();
	const sha256 = `sha256-${await imageSha256(bytes)}`;
	const matches = (row: ProjectAssetMetadata) =>
		ready(row) && row.mime === mime && row.byteSize === bytes.length && row.sha256 === sha256;
	const name = file.name.trim().slice(0, 120) || policy.label;
	const inflightKey = `${projectId}\u0000${sha256}`;
	const pending = inflightImageUploads.get(inflightKey);
	if (pending !== undefined) {
		try {
			const assetId = await pending;
			signal.throwIfAborted();
			await readVerifiedArtwork(api, projectId, { assetId, pixelWidth, pixelHeight }, signal);
			return { assetId, name, pixelWidth, pixelHeight, mime, byteSize: bytes.length, sha256 };
		} catch (error) {
			signal.throwIfAborted();
			void error;
		}
	}
	const stage = async (): Promise<string> => {
		const rows = await api.listAssets(projectId, signal);
		const prior = preferredProjectImageRow(rows.filter(matches), hooks.preferAssetIds);
		hooks.onPhase?.('uploading');
		if (prior) {
			await readVerifiedArtwork(
				api,
				projectId,
				{ assetId: prior.id, pixelWidth, pixelHeight },
				signal,
				prior,
			);
			return prior.id;
		}
		const reserved = await api.registerAsset(projectId, name, signal);
		const assetId = reserved.id;
		try {
			const uploaded = await api.uploadAsset(projectId, assetId, bytes, signal);
			if (!matches(uploaded)) throw new Error(`${policy.label} upload did not match the source.`);
		} catch (error) {
			signal.throwIfAborted();
			const recovered = (await api.listAssets(projectId, signal)).find(
				(row) => row.id === assetId && matches(row),
			);
			if (!recovered) throw error;
			await readVerifiedArtwork(
				api,
				projectId,
				{ assetId, pixelWidth, pixelHeight },
				signal,
				recovered,
			);
		}
		return assetId;
	};
	const staging = stage();
	inflightImageUploads.set(inflightKey, staging);
	let assetId: string;
	try {
		assetId = await staging;
	} finally {
		if (inflightImageUploads.get(inflightKey) === staging) inflightImageUploads.delete(inflightKey);
	}
	return { assetId, name, pixelWidth, pixelHeight, mime, byteSize: bytes.length, sha256 };
}

/** Artwork's unchanged import: the P20 image plus its shelf entry. */
export async function importArtworkFile(
	api: ProjectApi,
	projectId: string,
	file: File,
	signal: AbortSignal,
): Promise<ArtworkLibraryEntry> {
	const imported = await importProjectImage(api, projectId, file, signal, ARTWORK_IMAGE_POLICY);
	return {
		assetId: imported.assetId,
		name: imported.name,
		pixelWidth: imported.pixelWidth,
		pixelHeight: imported.pixelHeight,
	};
}
