/**
 * Project-image pin verification (P20, T2.S4b, T2.S8 · PR C).
 *
 * A project image is not host-asserted. The saved project names it through a
 * Scene texture record or an Artwork shelf entry, and the byte identity comes
 * from the `texture` resource or the P20 registry row. This module resolves every
 * such image, verifies the registry metadata **and the object bytes**, and
 * refuses with a source-specific diagnostic when any of them disagree.
 *
 * The closure itself is enumerated by `@portfolio/project-model` so Save, cold
 * Load and detached delivery cannot drift into three answers. This module owns
 * only the storage half: owner-scoped rows, bounded byte streams, MIME/dimension
 * probes and exact pin comparison under the existing lock order.
 */
import { createHash } from 'node:crypto';
import { ARTWORK_MAX_BYTES, probeArtworkImage } from '@portfolio/project-model';
import {
	collectEnvelopeImageRequirements,
	collectSceneImageRequirements,
	type ProjectImageArtwork,
	type ProjectImageClosureIssue,
	type ProjectImagePin,
	type ProjectImagePurpose,
	type ProjectImageRequirement
} from '@portfolio/project-model/project-images';
import type { CameraFreeSceneDocument, ProjectEnvelope } from '@portfolio/project-model/units';

import { AssetNotFoundError, readAsset, readAssetRow, type AssetMime, type StoredAsset } from './asset-persistence.js';
import type { DatabasePool } from './database.js';
import type { ObjectStore } from './object-store.js';

export type ArtworkAssetPin = Readonly<{
	assetId: string;
	mime: AssetMime;
	byteSize: number;
	sha256: string;
	objectKey: string;
	/** Every authored path that references this logical image. */
	paths: readonly string[];
	/** The authored texture pin, or null when the registry row is authoritative. */
	expectedPin: ProjectImagePin | null;
	/** Oriented Artwork dimensions when a shelf entry declares them. */
	artwork: ProjectImageArtwork | null;
}>;

export type ImageRefusalCode =
	| 'image-missing'
	| 'image-corrupt'
	| 'image-pin-changed'
	| 'image-requirement-invalid';

/**
 * One image refusal with the fields a repair action needs. `path` remains the
 * first authored path for existing Save issues; `paths` carries all of them.
 */
export class ArtworkAssetRefusal extends Error {
	readonly code: ImageRefusalCode;
	readonly assetId: string;
	readonly expectedPin: ProjectImagePin | null;
	readonly paths: readonly string[];
	readonly action: string;

	constructor(
		readonly path: string,
		reason: string,
		detail: {
			code?: ImageRefusalCode;
			assetId?: string;
			expectedPin?: ProjectImagePin | null;
			paths?: readonly string[];
			action?: string;
		} = {}
	) {
		super(reason);
		this.name = 'ArtworkAssetRefusal';
		this.code = detail.code ?? 'image-missing';
		this.assetId = detail.assetId ?? '';
		this.expectedPin = detail.expectedPin ?? null;
		this.paths = detail.paths ?? [path];
		this.action = detail.action ?? 'Repair the image with its exact original bytes and retry.';
	}
}

/** Storage or database failure; never folded into a wrong-bytes answer. */
export class ImageVerificationUnavailableError extends Error {
	constructor(message = 'Project image storage is unavailable', readonly cause?: unknown) {
		super(message);
		this.name = 'ImageVerificationUnavailableError';
	}
}

const DEFAULT_ACTION =
	'Repair this image with its original bytes in the Cloud project, then reopen the project.';

function refusalFor(
	requirement: ProjectImageRequirement | undefined,
	path: string,
	code: ImageRefusalCode,
	message: string
): ArtworkAssetRefusal {
	return new ArtworkAssetRefusal(path, message, {
		code,
		assetId: requirement?.assetId ?? '',
		expectedPin: requirement?.expectedPin ?? null,
		paths: requirement?.paths ?? [path],
		action: DEFAULT_ACTION
	});
}

function refusalForIssue(issue: ProjectImageClosureIssue): ArtworkAssetRefusal {
	return new ArtworkAssetRefusal(issue.path, issue.message, {
		code: 'image-requirement-invalid',
		paths: [issue.path],
		action: 'Reopen the saved project and correct the image reference before retrying.'
	});
}

/** Resolve one requirement's owner-scoped row and check it against the pin. */
export async function readProjectImagePin(
	db: Pick<DatabasePool, 'query'>,
	ownerId: string,
	projectId: string,
	requirement: ProjectImageRequirement,
	lock: 'none' | 'share' | 'update' = 'none'
): Promise<ArtworkAssetPin> {
	let asset: StoredAsset;
	try {
		asset = lock === 'none'
			? await readAsset(db, ownerId, projectId, requirement.assetId)
			: await readAssetRow(db, ownerId, projectId, requirement.assetId, lock);
	} catch (error) {
		if (error instanceof AssetNotFoundError) {
			throw refusalFor(
				requirement,
				requirement.paths[0] ?? requirement.locator,
				'image-missing',
				`Project image "${requirement.assetId}" has no ready registry record in this project.`
			);
		}
		throw new ImageVerificationUnavailableError(undefined, error);
	}
	if (
		asset.kind !== 'texture' ||
		asset.sourceKind !== 'upload' ||
		asset.storageKind !== 'r2' ||
		asset.importState !== 'ready' ||
		!asset.objectKey ||
		!asset.mime ||
		!asset.byteSize ||
		asset.byteSize > ARTWORK_MAX_BYTES ||
		!asset.sha256
	) {
		throw refusalFor(
			requirement,
			requirement.paths[0] ?? requirement.locator,
			'image-missing',
			`Project image "${requirement.assetId}" is not a ready uploaded image.`
		);
	}
	if (
		requirement.expectedPin !== null &&
		(asset.sha256 !== requirement.expectedPin.hash ||
			asset.mime !== requirement.expectedPin.mime ||
			asset.byteSize !== requirement.expectedPin.size)
	) {
		throw refusalFor(
			requirement,
			requirement.paths[0] ?? requirement.locator,
			'image-pin-changed',
			`Project image "${requirement.assetId}" no longer matches the bytes its saved revision pins.`
		);
	}
	return {
		assetId: requirement.assetId,
		mime: asset.mime,
		byteSize: asset.byteSize,
		sha256: asset.sha256,
		objectKey: asset.objectKey,
		paths: requirement.paths,
		expectedPin: requirement.expectedPin,
		artwork: requirement.artwork
	};
}

async function readObjectBytes(
	store: ObjectStore | undefined,
	pin: ArtworkAssetPin
): Promise<Uint8Array> {
	if (store === undefined) {
		throw new ImageVerificationUnavailableError(
			undefined,
			new Error('Object storage is not configured for project images')
		);
	}
	let stored: Awaited<ReturnType<ObjectStore['get']>>;
	try {
		stored = await store.get(pin.objectKey);
	} catch (error) {
		throw new ImageVerificationUnavailableError(undefined, error);
	}
	if (!stored) {
		throw new ArtworkAssetRefusal(
			pin.paths[0] ?? `/project-assets/${pin.assetId}`,
			`Project image "${pin.assetId}" bytes are missing from storage.`,
			{ code: 'image-missing', assetId: pin.assetId, expectedPin: pin.expectedPin, paths: pin.paths, action: DEFAULT_ACTION }
		);
	}
	try {
		if (stored.contentLength !== pin.byteSize) {
			throw new ArtworkAssetRefusal(
				pin.paths[0] ?? `/project-assets/${pin.assetId}`,
				`Project image "${pin.assetId}" length differs from its registry record.`,
				{ code: 'image-corrupt', assetId: pin.assetId, expectedPin: pin.expectedPin, paths: pin.paths, action: DEFAULT_ACTION }
			);
		}
		const bytes = new Uint8Array(pin.byteSize);
		let length = 0;
		for await (const chunk of stored.body) {
			const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			if (length + part.length > bytes.length) {
				throw new ArtworkAssetRefusal(
					pin.paths[0] ?? `/project-assets/${pin.assetId}`,
					`Project image "${pin.assetId}" exceeds its registered length.`,
					{ code: 'image-corrupt', assetId: pin.assetId, expectedPin: pin.expectedPin, paths: pin.paths, action: DEFAULT_ACTION }
				);
			}
			bytes.set(Uint8Array.from(part), length);
			length += part.length;
		}
		if (length !== pin.byteSize) {
			throw new ArtworkAssetRefusal(
				pin.paths[0] ?? `/project-assets/${pin.assetId}`,
				`Project image "${pin.assetId}" ended before its registered length.`,
				{ code: 'image-corrupt', assetId: pin.assetId, expectedPin: pin.expectedPin, paths: pin.paths, action: DEFAULT_ACTION }
			);
		}
		const digest = `sha256-${createHash('sha256').update(bytes).digest('hex')}`;
		if (digest !== pin.sha256) {
			throw new ArtworkAssetRefusal(
				pin.paths[0] ?? `/project-assets/${pin.assetId}`,
				`Project image "${pin.assetId}" bytes differ from their registry digest.`,
				{ code: 'image-corrupt', assetId: pin.assetId, expectedPin: pin.expectedPin, paths: pin.paths, action: DEFAULT_ACTION }
			);
		}
		let decoded: ReturnType<typeof probeArtworkImage>;
		try {
			decoded = probeArtworkImage(bytes);
		} catch {
			// Bytes that hash to the registry value but do not decode as a static
			// image are a corrupt image, not a storage outage.
			throw new ArtworkAssetRefusal(
				pin.paths[0] ?? `/project-assets/${pin.assetId}`,
				`Project image "${pin.assetId}" is not a supported static image.`,
				{ code: 'image-corrupt', assetId: pin.assetId, expectedPin: pin.expectedPin, paths: pin.paths, action: DEFAULT_ACTION }
			);
		}
		if (decoded.mime !== pin.mime) {
			throw new ArtworkAssetRefusal(
				pin.paths[0] ?? `/project-assets/${pin.assetId}`,
				`Project image "${pin.assetId}" MIME differs from its verified image.`,
				{ code: 'image-corrupt', assetId: pin.assetId, expectedPin: pin.expectedPin, paths: pin.paths, action: DEFAULT_ACTION }
			);
		}
		if (
			pin.artwork !== null &&
			(decoded.pixelWidth !== pin.artwork.pixelWidth ||
				decoded.pixelHeight !== pin.artwork.pixelHeight)
		) {
			throw new ArtworkAssetRefusal(
				pin.paths[0] ?? `/project-assets/${pin.assetId}`,
				`Project image "${pin.assetId}" dimensions differ from its shelf entry.`,
				{ code: 'image-corrupt', assetId: pin.assetId, expectedPin: pin.expectedPin, paths: pin.paths, action: DEFAULT_ACTION }
			);
		}
		return bytes;
	} catch (error) {
		if (error instanceof ArtworkAssetRefusal) throw error;
		throw new ImageVerificationUnavailableError(undefined, error);
	} finally {
		stored.body.destroy();
	}
}

async function prepareRequirements(
	db: Pick<DatabasePool, 'query'>,
	store: ObjectStore | undefined,
	ownerId: string,
	projectId: string,
	requirements: readonly ProjectImageRequirement[]
): Promise<readonly ArtworkAssetPin[]> {
	const pins: ArtworkAssetPin[] = [];
	for (const requirement of requirements) {
		const pin = await readProjectImagePin(db, ownerId, projectId, requirement);
		await readObjectBytes(store, pin);
		pins.push(pin);
	}
	return pins;
}

/**
 * Resolve and verify the complete image closure of one envelope.
 *
 * `private-save` and `private-load` require every project texture's authored
 * pin; `delivery` accepts the registry row as authoritative for a legacy texture
 * resource without one. Artwork is always registry-authoritative with declared
 * dimensions.
 */
export async function prepareProjectImagePins(
	db: Pick<DatabasePool, 'query'>,
	store: ObjectStore | undefined,
	ownerId: string,
	projectId: string,
	envelope: ProjectEnvelope,
	purpose: ProjectImagePurpose
): Promise<readonly ArtworkAssetPin[]> {
	const closure = collectEnvelopeImageRequirements(envelope, purpose);
	if (closure.issues[0] !== undefined) throw refusalForIssue(closure.issues[0]);
	return prepareRequirements(db, store, ownerId, projectId, closure.requirements);
}

/**
 * Legacy release/save entry over one Scene payload. The new Save and cold Load
 * use `prepareProjectImagePins` with the whole envelope; this wrapper keeps the
 * release fixture's shape while sharing the same storage verifier.
 */
export async function prepareArtworkPins(
	db: Pick<DatabasePool, 'query'>,
	store: ObjectStore | undefined,
	ownerId: string,
	projectId: string,
	scene: CameraFreeSceneDocument,
	mode: 'save' | 'release'
): Promise<readonly ArtworkAssetPin[]> {
	const closure = collectSceneImageRequirements(
		scene,
		mode === 'release' ? 'delivery' : 'private-save'
	);
	if (closure.issues[0] !== undefined) throw refusalForIssue(closure.issues[0]);
	return prepareRequirements(db, store, ownerId, projectId, closure.requirements);
}

/**
 * Compare the captured rows, including their object keys, to the live rows under
 * the caller's project row lock.
 *
 * A repair swaps only the object key; comparing keys is what makes a Save either
 * see the complete old capture or refuse, never mix one row with another's
 * bytes. The loop is sorted by asset id, matching the capture order and the
 * project-then-asset lock order repair uses.
 */
export async function verifyProjectImagePinRows(
	db: Pick<DatabasePool, 'query'>,
	ownerId: string,
	projectId: string,
	pins: readonly ArtworkAssetPin[]
): Promise<void> {
	if (pins.length === 0) return;
	for (const pin of [...pins].sort((left, right) =>
		left.assetId < right.assetId ? -1 : left.assetId > right.assetId ? 1 : 0)) {
		let current: ArtworkAssetPin;
		try {
			current = await readProjectImagePin(
				db,
				ownerId,
				projectId,
				{
					assetId: pin.assetId,
					locator: `/project-assets/${pin.assetId}`,
					expectedPin: pin.expectedPin,
					artwork: pin.artwork,
					paths: pin.paths
				},
				'share'
			);
		} catch (error) {
			if (error instanceof ArtworkAssetRefusal) {
				throw new ArtworkAssetRefusal(pin.paths[0] ?? error.path, 'Project image changed before Save. Retry the save.', {
					code: 'image-pin-changed',
					assetId: pin.assetId,
					expectedPin: pin.expectedPin,
					paths: pin.paths,
					action: 'Reload the project and retry the save.'
				});
			}
			throw error;
		}
		if (
			current.mime !== pin.mime ||
			current.byteSize !== pin.byteSize ||
			current.sha256 !== pin.sha256 ||
			current.objectKey !== pin.objectKey
		) {
			throw new ArtworkAssetRefusal(
				pin.paths[0] ?? `/project-assets/${pin.assetId}`,
				'Project image changed before Save. Retry the save.',
				{
					code: 'image-pin-changed',
					assetId: pin.assetId,
					expectedPin: pin.expectedPin,
					paths: pin.paths,
					action: 'Reload the project and retry the save.'
				}
			);
		}
	}
}

/** Compatibility wrapper for the existing Artwork-only callers. */
export async function verifyArtworkPinRows(
	db: Pick<DatabasePool, 'query'>,
	ownerId: string,
	projectId: string,
	pins: readonly ArtworkAssetPin[]
): Promise<void> {
	return verifyProjectImagePinRows(db, ownerId, projectId, pins);
}
