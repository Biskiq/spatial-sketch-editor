import { expireAbandonedLibraryStaging } from './items.js';
import {
	readRequestDigest,
	readReceipt,
	insertReceipt,
	recordStaging,
	consumeStagingRows,
	deleteObjectQuietly,
	discardStaged,
	reclaimLosingStaged,
} from './shared.js';
import {
	FORM_LIBRARY_MAX_ITEMS,
	type MaterialLibraryImageBinding,
	type MaterialLibraryItemSummary,
	type MaterialLibraryPayload,
	MATERIAL_LIBRARY_MAX_CANONICAL_BYTES,
	MATERIAL_LIBRARY_MAX_IMAGES,
	canonicalMaterialLibraryBytes,
	materialLibraryImageBindings,
	readMaterialLibraryPayload,
} from '@portfolio/project-model/library';
import { recipeHash, shippedImage } from '@portfolio/project-model/materials';
import { sha256Bytes } from '@portfolio/project-model/package';
import { readAssetRow } from '../asset-persistence.js';
import { type DatabasePool } from '../database.js';
import {
	SHA256_IDENTITY,
	PROJECT_ID_PATTERN,
	OPERATION_ID_PATTERN,
	READY_IMAGE_MIMES,
	type ReadyImageMime,
	FormLibraryInputError,
	FormLibraryNotFoundError,
	type LibraryRow,
	MATERIAL_SUMMARY_COLUMNS,
	isRecord,
	readString,
	materialSummaryOf,
	replaySummary,
	libraryImageKey,
} from './shared';
import { type ObjectStore } from '../object-store.js';
import { queryRows, withTransaction } from '../project-persistence.js';
import { createHash, randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';

export type MaterialLibrarySaveBody = {
	readonly contentId: string;
	readonly operationId: string;
	readonly sourceProjectId: string;
	readonly payload: MaterialLibraryPayload;
	readonly images: readonly MaterialLibraryImageBinding[];
};

export function readLocalImageSource(
	value: unknown,
	path: string,
): MaterialLibraryImageBinding['source'] {
	if (!isRecord(value)) {
		throw new FormLibraryInputError(
			'invalid_library_item',
			400,
			`${path} must be a local image source`,
		);
	}
	const keys = Object.keys(value);
	const hasTexture = Object.hasOwn(value, 'textureId');
	const hasShipped = Object.hasOwn(value, 'shipped');
	if (keys.length !== 1 || hasTexture === hasShipped) {
		throw new FormLibraryInputError(
			'invalid_library_item',
			400,
			`${path} must name exactly one of textureId or shipped`,
		);
	}
	const source = hasTexture ? value.textureId : value.shipped;
	if (typeof source !== 'string' || source.length === 0 || /\s/.test(source)) {
		throw new FormLibraryInputError(
			'invalid_library_item',
			400,
			`${path} is not a stable image identity`,
		);
	}
	if (hasTexture) {
		if (
			!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(source)
		) {
			throw new FormLibraryInputError(
				'invalid_library_item',
				400,
				`${path}.textureId must be a project asset id`,
			);
		}
		return { textureId: source };
	}
	if (!source.startsWith('/textures/')) {
		throw new FormLibraryInputError(
			'invalid_library_item',
			400,
			`${path}.shipped must be a frozen shipped URI`,
		);
	}
	return { shipped: source };
}

/** Strict Save body: exactly the payload, operation, source project and pins. */
export function parseMaterialLibrarySaveBody(body: unknown): MaterialLibrarySaveBody {
	if (!isRecord(body)) {
		throw new FormLibraryInputError(
			'invalid_library_item',
			400,
			'Expected a material library request',
		);
	}
	const allowed = ['contentId', 'operationId', 'sourceProjectId', 'payload', 'images'];
	if (
		Object.keys(body).some((key) => !allowed.includes(key)) ||
		Object.keys(body).length !== allowed.length
	) {
		throw new FormLibraryInputError(
			'invalid_library_item',
			400,
			'Expected contentId, operationId, sourceProjectId, payload and images',
		);
	}
	if (typeof body.contentId !== 'string' || !SHA256_IDENTITY.test(body.contentId)) {
		throw new FormLibraryInputError('invalid_library_item', 400, 'Expected a canonical content id');
	}
	if (typeof body.operationId !== 'string' || !OPERATION_ID_PATTERN.test(body.operationId)) {
		throw new FormLibraryInputError('invalid_library_item', 400, 'Expected a bounded operation id');
	}
	if (typeof body.sourceProjectId !== 'string' || !PROJECT_ID_PATTERN.test(body.sourceProjectId)) {
		throw new FormLibraryInputError('invalid_library_item', 400, 'Expected a source project id');
	}
	const parsed = readMaterialLibraryPayload(body.payload);
	if (!parsed.success) {
		const first = parsed.issues[0];
		const tooLarge = first?.code === 'payload_too_large';
		throw new FormLibraryInputError(
			tooLarge ? 'payload_too_large' : 'invalid_library_item',
			tooLarge ? 413 : 400,
			first?.message ?? 'The material library item is not valid',
		);
	}
	if (!Array.isArray(body.images) || body.images.length > MATERIAL_LIBRARY_MAX_IMAGES) {
		throw new FormLibraryInputError(
			'invalid_library_item',
			400,
			`A material item names at most ${MATERIAL_LIBRARY_MAX_IMAGES} images`,
		);
	}
	const images: MaterialLibraryImageBinding[] = [];
	for (const [index, value] of body.images.entries()) {
		const path = `$.images[${index}]`;
		if (
			!isRecord(value) ||
			Object.keys(value).length !== 2 ||
			!Object.hasOwn(value, 'hash') ||
			!Object.hasOwn(value, 'source')
		) {
			throw new FormLibraryInputError(
				'invalid_library_item',
				400,
				`${path} must be a hash and source pair`,
			);
		}
		if (typeof value.hash !== 'string' || !SHA256_IDENTITY.test(value.hash)) {
			throw new FormLibraryInputError(
				'invalid_library_item',
				400,
				`${path}.hash must be a sha256 identity`,
			);
		}
		images.push({ hash: value.hash, source: readLocalImageSource(value.source, `${path}.source`) });
	}
	const bindings = materialLibraryImageBindings(parsed.payload.recipe, images);
	if ('issues' in bindings) {
		throw new FormLibraryInputError(
			'invalid_library_item',
			400,
			bindings.issues[0]?.message ?? 'The material image dependencies are incomplete',
		);
	}
	return {
		contentId: body.contentId,
		operationId: body.operationId,
		sourceProjectId: body.sourceProjectId,
		payload: parsed.payload,
		images: bindings.images,
	};
}

export function isReadyMime(value: unknown): value is ReadyImageMime {
	return typeof value === 'string' && (READY_IMAGE_MIMES as readonly string[]).includes(value);
}

export type PreparedImage =
	| {
			readonly hash: string;
			readonly mime: ReadyImageMime;
			readonly byteSize: number;
			readonly sourceKind: 'shipped';
			readonly sourceUri: string;
	  }
	| {
			readonly hash: string;
			readonly mime: ReadyImageMime;
			readonly byteSize: number;
			readonly sourceKind: 'object';
			readonly sourceObjectKey: string;
			readonly stagingKey: string;
	  };

export function sniffImageMime(prefix: readonly number[]): ReadyImageMime | null {
	if (
		prefix.length >= 8 &&
		prefix[0] === 0x89 &&
		prefix[1] === 0x50 &&
		prefix[2] === 0x4e &&
		prefix[3] === 0x47 &&
		prefix[4] === 0x0d &&
		prefix[5] === 0x0a &&
		prefix[6] === 0x1a &&
		prefix[7] === 0x0a
	)
		return 'image/png';
	if (
		prefix.length >= 12 &&
		prefix[0] === 0x52 &&
		prefix[1] === 0x49 &&
		prefix[2] === 0x46 &&
		prefix[3] === 0x46 &&
		prefix[8] === 0x57 &&
		prefix[9] === 0x45 &&
		prefix[10] === 0x42 &&
		prefix[11] === 0x50
	)
		return 'image/webp';
	if (prefix.length >= 3 && prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff)
		return 'image/jpeg';
	return null;
}

/**
 * Stream one verified private image copy.
 *
 * The source's declared size is the hard bound; every byte is hashed and the
 * container is sniffed. A mismatch deletes the staged key and refuses. The
 * destination metadata is only committed after this resolves.
 */
export async function copyVerifiedImage(input: {
	readonly store: ObjectStore;
	readonly sourceKey: string;
	readonly destinationKey: string;
	readonly expectedHash: string;
	readonly expectedMime: ReadyImageMime;
	readonly expectedSize: number;
	readonly signal?: AbortSignal;
}): Promise<void> {
	const source = await input.store.get(input.sourceKey);
	if (source === null || source.contentLength !== input.expectedSize) {
		if (source !== null) source.body.destroy();
		throw new FormLibraryInputError(
			'image_unavailable',
			422,
			'The source image bytes are missing or the wrong length',
		);
	}
	const output = new PassThrough();
	output.on('error', () => {});
	const hash = createHash('sha256');
	const prefix: number[] = [];
	let length = 0;
	const controller = new AbortController();
	const onAbort = () => {
		const error =
			input.signal?.reason instanceof Error
				? input.signal.reason
				: new Error('Library copy aborted');
		source.body.destroy(error);
		output.destroy(error);
	};
	input.signal?.addEventListener('abort', onAbort, { once: true });
	if (input.signal?.aborted) onAbort();
	let put: Promise<void> | undefined;
	const abortStaging = (error: unknown) => {
		const reason = error instanceof Error ? error : new Error('Library copy failed');
		source.body.destroy(reason);
		output.destroy(reason);
	};
	controller.signal.addEventListener('abort', () => abortStaging(controller.signal.reason), {
		once: true,
	});
	try {
		put = input.store
			.put(input.destinationKey, output, {
				contentType: input.expectedMime,
				contentLength: input.expectedSize,
				signal: controller.signal,
			})
			.catch((error: unknown) => {
				controller.abort(error);
				throw error;
			});
		for await (const chunk of source.body) {
			const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
			length += buffer.length;
			if (length > input.expectedSize) {
				throw new FormLibraryInputError(
					'image_unavailable',
					422,
					'The source image exceeds its pinned length',
				);
			}
			hash.update(buffer as unknown as Uint8Array<ArrayBuffer>);
			if (prefix.length < 12) prefix.push(...buffer.subarray(0, 12 - prefix.length));
			if (!output.write(buffer)) {
				await new Promise<void>((resolve, reject) => {
					const cleanup = () => {
						output.off('drain', onDrain);
						output.off('error', onError);
						output.off('close', onClose);
					};
					const onDrain = () => {
						cleanup();
						resolve();
					};
					const onError = (error: Error) => {
						cleanup();
						reject(error);
					};
					const onClose = () => {
						cleanup();
						reject(new Error('The library copy output closed before draining'));
					};
					output.once('drain', onDrain);
					output.once('error', onError);
					output.once('close', onClose);
				});
			}
		}
		output.end();
		await put;
		input.signal?.removeEventListener('abort', onAbort);
		const digest = `sha256-${hash.digest('hex')}`;
		const mime = sniffImageMime(prefix);
		if (
			length !== input.expectedSize ||
			digest !== input.expectedHash ||
			mime !== input.expectedMime
		) {
			await deleteObjectQuietly(input.store, input.destinationKey);
			throw new FormLibraryInputError(
				'image_unavailable',
				422,
				'The source image does not match its verified pin',
			);
		}
	} catch (error) {
		input.signal?.removeEventListener('abort', onAbort);
		controller.abort(error);
		if (put !== undefined) {
			try {
				await put;
			} catch {
				// The deterministic refusal below is the reported error.
			}
		}
		await deleteObjectQuietly(input.store, input.destinationKey);
		throw error;
	}
}

/** Prepare one Save image: verify shipped identity or copy a project asset. */
export async function prepareSaveImage(input: {
	readonly pool: DatabasePool;
	readonly store: ObjectStore;
	readonly ownerId: string;
	readonly sourceProjectId: string;
	readonly itemId: string;
	readonly namespace: string;
	readonly binding: MaterialLibraryImageBinding;
	readonly signal?: AbortSignal;
}): Promise<PreparedImage> {
	if ('shipped' in input.binding.source) {
		const shipped = shippedImage(input.binding.source.shipped);
		if (shipped === undefined || shipped.hash !== input.binding.hash) {
			throw new FormLibraryInputError(
				'unsupported_image',
				422,
				'A shipped material image is not in the frozen catalogue at that digest',
			);
		}
		return {
			hash: shipped.hash,
			mime: shipped.mime,
			byteSize: shipped.byteSize,
			sourceKind: 'shipped',
			sourceUri: shipped.uri,
		};
	}
	let asset;
	try {
		asset = await readAssetRow(
			input.pool,
			input.ownerId,
			input.sourceProjectId,
			input.binding.source.textureId,
		);
	} catch {
		throw new FormLibraryInputError(
			'image_unavailable',
			422,
			'The source project image is not available to this owner',
		);
	}
	if (
		asset.importState !== 'ready' ||
		asset.storageKind !== 'r2' ||
		asset.objectKey === null ||
		asset.sha256 !== input.binding.hash ||
		!isReadyMime(asset.mime) ||
		asset.byteSize === null
	) {
		throw new FormLibraryInputError(
			'image_unavailable',
			422,
			'The source project image is not ready at the pinned identity',
		);
	}
	const staging = libraryImageKey(input.ownerId, input.itemId, input.binding.hash, input.namespace);
	try {
		await recordStaging(input.pool, input.ownerId, staging);
		await copyVerifiedImage({
			store: input.store,
			sourceKey: asset.objectKey,
			destinationKey: staging,
			expectedHash: input.binding.hash,
			expectedMime: asset.mime,
			expectedSize: asset.byteSize,
			...(input.signal === undefined ? {} : { signal: input.signal }),
		});
	} catch (error) {
		await discardStaged(input.pool, input.store, input.ownerId, [staging]);
		throw error instanceof FormLibraryInputError
			? error
			: new FormLibraryInputError(
					'image_unavailable',
					422,
					'A source image could not be copied into the library',
				);
	}
	return {
		hash: input.binding.hash,
		mime: asset.mime,
		byteSize: asset.byteSize,
		sourceKind: 'object',
		sourceObjectKey: asset.objectKey,
		stagingKey: staging,
	};
}

/**
 * Save one material item.
 *
 * Staging happens before the metadata transaction. The transaction rechecks the
 * operation receipt, the owner quota and the item identity, then writes the
 * item, its image rows and the receipt together. A failure deletes only the
 * staged copies.
 */
export async function saveMaterialLibraryItem(
	pool: DatabasePool,
	ownerId: string,
	body: unknown,
	objectStore: ObjectStore | undefined,
	objectNamespace: string,
): Promise<MaterialLibraryItemSummary> {
	if (!objectStore) throw new Error('Object storage is unavailable');
	const parsed = parseMaterialLibrarySaveBody(body);
	const bytes = canonicalMaterialLibraryBytes(parsed.payload);
	if (bytes.byteLength > MATERIAL_LIBRARY_MAX_CANONICAL_BYTES) {
		throw new FormLibraryInputError('payload_too_large', 413, 'The material item is too large');
	}
	const contentId = await sha256Bytes(bytes);
	if (contentId !== parsed.contentId) {
		throw new FormLibraryInputError(
			'content_id_mismatch',
			400,
			'The item bytes do not match the content id they were sent as',
		);
	}
	const recipeRevision = await recipeHash(parsed.payload.recipe);
	const digest = await readRequestDigest({
		kind: 'material-save',
		contentId,
		operationId: parsed.operationId,
		sourceProjectId: parsed.sourceProjectId,
		images: parsed.images,
	});

	try {
		await expireAbandonedLibraryStaging(pool, objectStore, ownerId);
	} catch {
		// Cleanup never blocks a Save.
	}

	const replay = await readReceipt(pool, ownerId, 'material-save', parsed.operationId);
	if (replay !== null) {
		if (readString(replay.requestDigest) !== digest) {
			throw new FormLibraryInputError(
				'operation_conflict',
				409,
				'That operation id was already used for a different library save',
			);
		}
		const existing = await queryRows<LibraryRow>(
			pool,
			`SELECT ${MATERIAL_SUMMARY_COLUMNS} FROM form_library_items WHERE owner_id = $1 AND id = $2::uuid`,
			[ownerId, replaySummary(replay).id],
		);
		if (existing[0] === undefined) throw new FormLibraryNotFoundError();
		return materialSummaryOf(existing[0]);
	}

	const itemId = randomUUID();
	const prepared: PreparedImage[] = [];
	const stagedKeys: string[] = [];
	try {
		for (const binding of parsed.images) {
			const image = await prepareSaveImage({
				pool,
				store: objectStore,
				ownerId,
				sourceProjectId: parsed.sourceProjectId,
				itemId,
				namespace: objectNamespace,
				binding,
			});
			prepared.push(image);
			if (image.sourceKind === 'object') stagedKeys.push(image.stagingKey);
		}
	} catch (error) {
		await discardStaged(pool, objectStore, ownerId, stagedKeys);
		throw error;
	}

	let summary: MaterialLibraryItemSummary;
	let replayed = false;
	try {
		summary = await withTransaction(pool, async (client) => {
			await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
				`material-save:${ownerId}:${parsed.operationId}`,
			]);
			const committed = await readReceipt(client, ownerId, 'material-save', parsed.operationId);
			if (committed !== null) {
				if (readString(committed.requestDigest) !== digest) {
					throw new FormLibraryInputError(
						'operation_conflict',
						409,
						'That operation id was already used for a different library save',
					);
				}
				const existing = await queryRows<LibraryRow>(
					client,
					`SELECT ${MATERIAL_SUMMARY_COLUMNS} FROM form_library_items WHERE owner_id = $1 AND id = $2::uuid`,
					[ownerId, replaySummary(committed).id],
				);
				if (existing[0] === undefined) throw new FormLibraryNotFoundError();
				replayed = true;
				return materialSummaryOf(existing[0]);
			}
			await client.query('INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [
				ownerId,
			]);
			await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [ownerId]);
			const counted = await client.query<{ count: string }>(
				'SELECT count(*)::text AS count FROM form_library_items WHERE owner_id = $1',
				[ownerId],
			);
			if (Number(counted.rows[0]?.count ?? 0) >= FORM_LIBRARY_MAX_ITEMS) {
				throw new FormLibraryInputError(
					'library_full',
					409,
					`My Objects holds at most ${FORM_LIBRARY_MAX_ITEMS} items. Remove an item to save another.`,
				);
			}
			if (stagedKeys.length > 0) {
				const claimed = await consumeStagingRows(client, ownerId, stagedKeys);
				if (claimed.length !== stagedKeys.length) {
					throw new FormLibraryInputError(
						'stale_revision',
						409,
						'A staged library image expired before commit; retry saving the material.',
					);
				}
			}
			const inserted = await client.query<LibraryRow>(
				`INSERT INTO form_library_items
					(id, owner_id, kind, name, format_version, content_id, canonical_bytes, recipe_hash)
				 VALUES ($1::uuid, $2, 'material', $3, 1, $4, $5, $6)
				 RETURNING ${MATERIAL_SUMMARY_COLUMNS}`,
				[itemId, ownerId, parsed.payload.name, contentId, Buffer.from(bytes), recipeRevision],
			);
			const row = inserted.rows[0];
			if (row === undefined) throw new Error('The material library item was not stored');
			for (const image of prepared) {
				await client.query(
					`INSERT INTO material_library_images
						(item_id, hash, mime, byte_size, source_kind, object_key, source_uri)
					 VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)`,
					[
						itemId,
						image.hash,
						image.mime,
						image.byteSize,
						image.sourceKind,
						image.sourceKind === 'object' ? image.stagingKey : null,
						image.sourceKind === 'shipped' ? image.sourceUri : null,
					],
				);
			}
			const stored = { ...materialSummaryOf(row), imageCount: prepared.length };
			await insertReceipt(client, {
				ownerId,
				kind: 'material-save',
				operationId: parsed.operationId,
				digest,
				destinationSavedBase: null,
				response: stored,
			});
			return stored;
		});
	} catch (error) {
		await discardStaged(pool, objectStore, ownerId, stagedKeys);
		throw error;
	}
	if (replayed) {
		await reclaimLosingStaged(pool, objectStore, ownerId, stagedKeys);
	}
	return summary;
}
