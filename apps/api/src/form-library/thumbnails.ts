import { reclaimIfUnreferenced, expireAbandonedLibraryStaging } from './items.js';
import { recordStaging, consumeStagingRows, discardStaged } from './shared.js';
import { probeArtworkImage } from '@portfolio/project-model/artwork';
import {
	MATERIAL_LIBRARY_MAX_THUMBNAIL_BYTES,
	MATERIAL_LIBRARY_MAX_THUMBNAIL_EDGE,
} from '@portfolio/project-model/library';
import { sha256Bytes } from '@portfolio/project-model/package';
import { type DatabasePool } from '../database.js';
import {
	FormLibraryInputError,
	FormLibraryNotFoundError,
	type ThumbnailRow,
	readString,
	readNullableString,
	readSafeInteger,
	thumbnailKey,
} from './shared';
import { type ObjectStore } from '../object-store.js';
import { queryRows, withTransaction } from '../project-persistence.js';
import { Readable } from 'node:stream';

export type LibraryThumbnail = {
	readonly body: Readable;
	readonly byteSize: number;
};

export async function readThumbnailItem(
	db: Pick<DatabasePool, 'query'>,
	ownerId: string,
	itemId: string,
	lock: boolean,
): Promise<ThumbnailRow> {
	const rows = await queryRows<ThumbnailRow>(
		db,
		`SELECT content_id AS "contentId", recipe_hash AS "recipeHash",
		 thumbnail_key AS "thumbnailKey", thumbnail_hash AS "thumbnailHash",
		 thumbnail_byte_size AS "thumbnailByteSize"
		 FROM form_library_items
		 WHERE owner_id = $1 AND id = $2::uuid AND kind = 'material'
		 ${lock ? 'FOR UPDATE' : ''}`,
		[ownerId, itemId],
	);
	const row = rows[0];
	if (row === undefined) throw new FormLibraryNotFoundError();
	return row;
}

/** Read one installed fixed thumbnail, or 404 when neither item nor derivative exists. */
export async function readMaterialLibraryThumbnail(
	pool: DatabasePool,
	ownerId: string,
	itemId: string,
	objectStore: ObjectStore | undefined,
): Promise<LibraryThumbnail> {
	if (!objectStore) throw new Error('Object storage is unavailable');
	const row = await readThumbnailItem(pool, ownerId, itemId, false);
	const key = readNullableString(row.thumbnailKey);
	if (key === null) throw new FormLibraryNotFoundError('Thumbnail not found');
	const stored = await objectStore.get(key);
	if (stored === null || stored.contentLength !== readSafeInteger(row.thumbnailByteSize)) {
		if (stored !== null) stored.body.destroy();
		throw new FormLibraryNotFoundError('Thumbnail not found');
	}
	return { body: stored.body, byteSize: stored.contentLength };
}

/**
 * Install one fixed thumbnail derivative.
 *
 * `expectedContentId` pins the item revision the thumbnail was generated for and
 * `recipeKey` pins the recipe identity. Either changing is a stale item (409).
 * The PNG is validated for MIME, dimensions and byte size before metadata.
 */
export async function saveMaterialLibraryThumbnail(
	pool: DatabasePool,
	ownerId: string,
	itemId: string,
	bytes: Uint8Array,
	options: {
		readonly expectedContentId: string;
		readonly recipeKey: string;
		readonly objectStore: ObjectStore | undefined;
		readonly objectNamespace: string;
		readonly signal?: AbortSignal;
	},
): Promise<{ readonly thumbnailHash: string }> {
	const store = options.objectStore;
	if (!store) throw new Error('Object storage is unavailable');
	if (bytes.byteLength < 1 || bytes.byteLength > MATERIAL_LIBRARY_MAX_THUMBNAIL_BYTES) {
		throw new FormLibraryInputError('payload_too_large', 413, 'A thumbnail is at most 256 KiB');
	}
	let probe;
	try {
		probe = probeArtworkImage(bytes);
	} catch {
		throw new FormLibraryInputError(
			'unsupported_image',
			415,
			'A thumbnail must be a static PNG image',
		);
	}
	if (
		probe.mime !== 'image/png' ||
		probe.pixelWidth > MATERIAL_LIBRARY_MAX_THUMBNAIL_EDGE ||
		probe.pixelHeight > MATERIAL_LIBRARY_MAX_THUMBNAIL_EDGE
	) {
		throw new FormLibraryInputError(
			'unsupported_image',
			415,
			`A thumbnail must be a PNG no larger than ${MATERIAL_LIBRARY_MAX_THUMBNAIL_EDGE}×${MATERIAL_LIBRARY_MAX_THUMBNAIL_EDGE}`,
		);
	}
	const current = await readThumbnailItem(pool, ownerId, itemId, false);
	if (readString(current.contentId) !== options.expectedContentId) {
		throw new FormLibraryInputError(
			'stale_thumbnail',
			409,
			'The library item changed since the thumbnail was generated',
		);
	}
	if (readString(current.recipeHash) !== options.recipeKey) {
		throw new FormLibraryInputError(
			'stale_thumbnail',
			409,
			'The thumbnail was generated for a different recipe',
		);
	}
	try {
		await expireAbandonedLibraryStaging(pool, store, ownerId);
	} catch {
		// Cleanup never blocks an upload.
	}
	const staging = thumbnailKey(ownerId, itemId, options.objectNamespace);
	const hash = await sha256Bytes(bytes);
	try {
		await recordStaging(pool, ownerId, staging);
		await store.put(staging, Readable.from([Buffer.from(bytes)]), {
			contentType: 'image/png',
			contentLength: bytes.byteLength,
			signal: options.signal ?? new AbortController().signal,
		});
	} catch (error) {
		await discardStaged(pool, store, ownerId, [staging]);
		throw error instanceof FormLibraryInputError
			? error
			: new FormLibraryInputError('image_unavailable', 422, 'The thumbnail could not be stored');
	}

	let previousKey: string | null = null;
	try {
		previousKey = await withTransaction(pool, async (client) => {
			const locked = await readThumbnailItem(client, ownerId, itemId, true);
			if (
				readString(locked.contentId) !== options.expectedContentId ||
				readString(locked.recipeHash) !== options.recipeKey
			) {
				throw new FormLibraryInputError(
					'stale_thumbnail',
					409,
					'The library item changed while the thumbnail was uploading',
				);
			}
			const claimed = await consumeStagingRows(client, ownerId, [staging]);
			if (claimed.length !== 1) {
				throw new FormLibraryInputError(
					'stale_thumbnail',
					409,
					'The thumbnail upload expired before commit; retry the upload.',
				);
			}
			const old = readNullableString(locked.thumbnailKey);
			await client.query(
				`UPDATE form_library_items
				 SET thumbnail_key = $3, thumbnail_hash = $4, thumbnail_recipe_key = $5, thumbnail_byte_size = $6
				 WHERE owner_id = $1 AND id = $2::uuid AND kind = 'material'`,
				[ownerId, itemId, staging, hash, options.recipeKey, bytes.byteLength],
			);
			return old;
		});
	} catch (error) {
		await discardStaged(pool, store, ownerId, [staging]);
		throw error;
	}
	if (previousKey !== null && previousKey !== staging) {
		await reclaimIfUnreferenced(pool, store, previousKey);
	}
	return { thumbnailHash: hash };
}
