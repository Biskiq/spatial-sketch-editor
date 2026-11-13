import { createHash } from 'node:crypto';
import { ARTWORK_MAX_BYTES, isArtworkAssetId, probeArtworkImage, type ArtworkImage } from '@portfolio/project-model';
import type { CameraFreeSceneDocument } from '@portfolio/project-model/units';
import { readAsset, type AssetMime } from './asset-persistence.js';
import type { DatabasePool } from './database.js';
import type { ObjectStore } from './object-store.js';

export type ArtworkAssetPin = Readonly<{
	assetId: string;
	mime: AssetMime;
	byteSize: number;
	sha256: string;
	objectKey: string;
}>;

export class ArtworkAssetRefusal extends Error {
	constructor(readonly path: string, reason: string) {
		super(reason);
	}
}

async function readPin(
	db: Pick<DatabasePool, 'query'>,
	ownerId: string,
	projectId: string,
	assetId: string
): Promise<ArtworkAssetPin> {
	const asset = await readAsset(db, ownerId, projectId, assetId);
	if (asset.kind !== 'texture' || asset.sourceKind !== 'upload' || asset.storageKind !== 'r2' ||
		asset.importState !== 'ready' || !asset.objectKey || !asset.mime ||
		!asset.byteSize || asset.byteSize > ARTWORK_MAX_BYTES || !asset.sha256) {
		throw new Error('Artwork requires a ready image in this project.');
	}
	return {
		assetId,
		mime: asset.mime,
		byteSize: asset.byteSize,
		sha256: asset.sha256,
		objectKey: asset.objectKey
	};
}

async function verifyImage(
	store: ObjectStore | undefined,
	pin: ArtworkAssetPin,
	image?: ArtworkImage
): Promise<void> {
	const stored = await store?.get(pin.objectKey);
	if (!stored) throw new Error('Artwork image bytes are unavailable.');
	try {
		if (stored.contentLength !== pin.byteSize) throw new Error('Artwork image length differs from its registry record.');
		const bytes = new Uint8Array(pin.byteSize);
		let length = 0;
		for await (const chunk of stored.body) {
			const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			if (length + part.length > bytes.length) throw new Error('Artwork image exceeds its registered length.');
			bytes.set(Uint8Array.from(part), length);
			length += part.length;
		}
		if (length !== pin.byteSize || `sha256-${createHash('sha256').update(bytes).digest('hex')}` !== pin.sha256) {
			throw new Error('Artwork image bytes differ from their registry digest.');
		}
		if (!image) return;
		const decoded = probeArtworkImage(bytes);
		if (decoded.mime !== pin.mime || decoded.pixelWidth !== image.pixelWidth || decoded.pixelHeight !== image.pixelHeight) {
			throw new Error('Artwork MIME or dimensions differ from the verified image.');
		}
	} finally {
		stored.body.destroy();
	}
}

/** T4 consumes the same verified pins, restricted to placed Artwork in release mode. */
export async function prepareArtworkPins(
	db: Pick<DatabasePool, 'query'>,
	store: ObjectStore | undefined,
	ownerId: string,
	projectId: string,
	scene: CameraFreeSceneDocument,
	mode: 'save' | 'release'
): Promise<readonly ArtworkAssetPin[]> {
	const placed = new Set(scene.entities.flatMap((entity) => entity.kind === 'artwork' ? [entity.source.assetId] : []));
	const references = new Map<string, { path: string; image?: ArtworkImage }>();
	for (const [index, image] of (scene.artworkLibrary ?? []).entries()) {
		if (mode === 'save' || placed.has(image.assetId)) {
			references.set(image.assetId, { image, path: `$.units.scene.data.artworkLibrary[${index}]` });
		}
	}
	if (mode === 'release') {
		const prefix = '/project-assets/';
		for (const [index, texture] of scene.textures.entries()) {
			if (!texture.uri.startsWith(prefix)) continue;
			const id = texture.uri.slice(prefix.length);
			const path = `$.units.scene.data.textures[${index}].uri`;
			if (!isArtworkAssetId(id)) throw new ArtworkAssetRefusal(path, 'Release texture needs a canonical project asset ID.');
			if (!references.has(id)) references.set(id, { path });
		}
	}
	const pins: ArtworkAssetPin[] = [];
	for (const [assetId, { image, path }] of [...references].sort(([a], [b]) => a.localeCompare(b))) {
		try {
			const pin = await readPin(db, ownerId, projectId, assetId);
			await verifyImage(store, pin, image);
			pins.push(pin);
		} catch (error) {
			throw new ArtworkAssetRefusal(
				path, error instanceof Error && error.message.startsWith('Artwork')
					? error.message : 'Artwork image is unavailable in this project.'
			);
		}
	}
	return pins;
}

export async function verifyArtworkPinRows(
	db: Pick<DatabasePool, 'query'>,
	ownerId: string,
	projectId: string,
	pins: readonly ArtworkAssetPin[]
): Promise<void> {
	for (const pin of pins) {
		try {
			const current = await readPin(db, ownerId, projectId, pin.assetId);
			if (JSON.stringify(current) === JSON.stringify(pin)) continue;
		} catch {
			// A removed or unready asset cannot satisfy the captured pin.
		}
		throw new ArtworkAssetRefusal('$.units.scene.data.artworkLibrary', 'Artwork image changed before Save. Retry the save.');
	}
}
