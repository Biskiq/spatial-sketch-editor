import { expireAbandonedLibraryStaging } from './items.js';
import { copyVerifiedImage } from './material.js';
import { readRequestDigest, readReceipt, insertReceipt, recordStaging, consumeStagingRows, discardStaged, reclaimLosingStaged } from './shared.js';
import { type MaterialLibraryTransfer, type MaterialLibraryTransferImage, MATERIAL_LIBRARY_MAX_IMAGES, readMaterialLibraryBytes } from '@portfolio/project-model/library';
import { recipeHash, shippedImage } from '@portfolio/project-model/materials';
import { UNIT_ENVELOPE_SOURCE_FORMAT } from '@portfolio/project-model/units';
import { type DatabasePool } from '../database.js';
import { isReadyMime } from './material';
import { SHA256_IDENTITY, PROJECT_ID_PATTERN, OPERATION_ID_PATTERN, type ReadyImageMime, FormLibraryInputError, FormLibraryNotFoundError, type LibraryRow, type MaterialImageRow, MATERIAL_SUMMARY_COLUMNS, isRecord, readString, readNullableString, readSafeInteger, destinationAssetKey } from './shared';
import { type ObjectStore } from '../object-store.js';
import { queryRows, withTransaction } from '../project-persistence.js';
import { DEFAULT_PROJECT_LIFECYCLE_POLICY, withProjectWriteLease, type ProjectLifecyclePolicy } from '../project-write-lease.js';
import { randomUUID } from 'node:crypto';

export type MaterialLibraryTransferBody = {
  readonly destinationProjectId: string;
  readonly contentId: string;
  readonly operationId: string;
};

export function parseMaterialLibraryTransferBody(body: unknown): MaterialLibraryTransferBody {
  if (!isRecord(body)) {
    throw new FormLibraryInputError('invalid_transfer', 400, 'Expected a transfer request');
  }
  const allowed = ['destinationProjectId', 'contentId', 'operationId'];
  if (Object.keys(body).some((key) => !allowed.includes(key)) || Object.keys(body).length !== 3) {
    throw new FormLibraryInputError(
      'invalid_transfer',
      400,
      'Expected destinationProjectId, contentId and operationId'
    );
  }
  if (typeof body.destinationProjectId !== 'string' || !PROJECT_ID_PATTERN.test(body.destinationProjectId)) {
    throw new FormLibraryInputError('invalid_transfer', 400, 'Expected a destination project id');
  }
  if (typeof body.contentId !== 'string' || !SHA256_IDENTITY.test(body.contentId)) {
    throw new FormLibraryInputError('invalid_transfer', 400, 'Expected a canonical content id');
  }
  if (typeof body.operationId !== 'string' || !OPERATION_ID_PATTERN.test(body.operationId)) {
    throw new FormLibraryInputError('invalid_transfer', 400, 'Expected a bounded operation id');
  }
  return {
    destinationProjectId: body.destinationProjectId,
    contentId: body.contentId,
    operationId: body.operationId
  };
}

export async function readDestinationProject(
  db: Pick<DatabasePool, 'query'>,
  ownerId: string,
  projectId: string,
  lock: boolean
): Promise<{ readonly savedBase: string | null }> {
  const rows = await queryRows<{ savedBase: unknown }>(
    db,
    `SELECT saved_base_token AS "savedBase"
		 FROM projects p
		 WHERE p.id = $1 AND p.owner_id = $2
		   AND EXISTS (
		     SELECT 1 FROM project_versions v
		     WHERE v.project_id = p.id AND v.source_format = $3
		   )
		 ${lock ? 'FOR UPDATE OF p' : ''}`,
    [projectId, ownerId, UNIT_ENVELOPE_SOURCE_FORMAT]
  );
  const row = rows[0];
  if (row === undefined) throw new FormLibraryNotFoundError('Destination project not found');
  return { savedBase: readNullableString(row.savedBase) };
}

export function readItemImageRow(row: MaterialImageRow): {
  readonly hash: string;
  readonly mime: ReadyImageMime;
  readonly byteSize: number;
  readonly sourceKind: 'object' | 'shipped';
  readonly objectKey: string | null;
  readonly sourceUri: string | null;
} {
  const sourceKind = row.sourceKind === 'object' || row.sourceKind === 'shipped' ? row.sourceKind : null;
  if (sourceKind === null || !isReadyMime(row.mime)) {
    throw new Error('Library image row contained an invalid source');
  }
  const byteSize = readSafeInteger(row.byteSize);
  if (byteSize < 1 || byteSize > 25 * 1024 * 1024) {
    throw new Error('Library image row contained an invalid size');
  }
  const objectKey = readNullableString(row.objectKey);
  const sourceUri = readNullableString(row.sourceUri);
  if (
    (sourceKind === 'object' && (objectKey === null || sourceUri !== null)) ||
    (sourceKind === 'shipped' && (objectKey !== null || sourceUri === null))
  ) {
    throw new Error('Library image row contained an inconsistent source');
  }
  return {
    hash: readString(row.hash),
    mime: row.mime,
    byteSize,
    sourceKind,
    objectKey,
    sourceUri
  };
}

export function transferResponseOf(value: unknown): MaterialLibraryTransfer {
  if (!isRecord(value)) throw new Error('Library receipt contained an invalid transfer');
  const images = value.images;
  if (typeof value.itemId !== 'string' || typeof value.contentId !== 'string' ||
      typeof value.finishId !== 'string' || typeof value.name !== 'string' ||
      typeof value.recipeHash !== 'string' || !isRecord(value.recipe) || !Array.isArray(images)) {
    throw new Error('Library receipt contained an invalid transfer');
  }
  const parsed: MaterialLibraryTransferImage[] = images.map((image) => {
    if (!isRecord(image) || typeof image.hash !== 'string' || typeof image.mime !== 'string' ||
        typeof image.byteSize !== 'number' || !isRecord(image.source)) {
      throw new Error('Library receipt contained an invalid transfer image');
    }
    const source = 'textureId' in image.source && typeof image.source.textureId === 'string'
      ? { textureId: image.source.textureId }
      : 'shipped' in image.source && typeof image.source.shipped === 'string'
        ? { shipped: image.source.shipped }
        : null;
    if (source === null) throw new Error('Library receipt contained an invalid transfer image');
    return {
      hash: image.hash,
      source,
      mime: image.mime,
      byteSize: image.byteSize,
      ...(typeof image.name === 'string' ? { name: image.name } : {})
    };
  });
  return {
    itemId: value.itemId,
    contentId: value.contentId,
    finishId: value.finishId,
    name: value.name,
    recipe: value.recipe as MaterialLibraryTransfer['recipe'],
    recipeHash: value.recipeHash,
    images: parsed,
    savedBase: typeof value.savedBase === 'string' ? value.savedBase : null
  };
}

export type PendingDestinationAsset = {
  readonly assetId: string;
  readonly hash: string;
  readonly mime: ReadyImageMime;
  readonly byteSize: number;
  readonly name: string;
  readonly stagingKey: string;
  adopted: boolean;
};

export async function findReadyDestinationRow(
  db: Pick<DatabasePool, 'query'>,
  projectId: string,
  image: { readonly hash: string; readonly mime: string; readonly byteSize: number }
): Promise<{ readonly id: string; readonly name: string } | null> {
  const rows = await queryRows<{ id: unknown; name: unknown }>(
    db,
    `SELECT id, name FROM assets
		 WHERE project_id = $1 AND import_state = 'ready' AND sha256 = $2 AND mime = $3 AND byte_size = $4
		 ORDER BY id ASC LIMIT 1`,
    [projectId, image.hash, image.mime, image.byteSize]
  );
  const row = rows[0];
  return row === undefined ? null : { id: readString(row.id), name: readString(row.name) };
}

export function transferImageOf(input: {
  readonly hash: string;
  readonly mime: string;
  readonly byteSize: number;
  readonly assetId: string;
  readonly name: string;
}): MaterialLibraryTransferImage {
  return {
    hash: input.hash,
    source: { textureId: input.assetId },
    mime: input.mime,
    byteSize: input.byteSize,
    name: input.name
  };
}

/**
 * Insert one material item into a destination project.
 *
 * The destination gets its own Finish id, its own ready P20 rows (or reuses an
 * identical ready row) and its own private bytes. The item, the source project
 * and the library object keys are never referenced by the destination.
 */
export async function transferMaterialLibraryItem(
  pool: DatabasePool,
  ownerId: string,
  itemId: string,
  body: unknown,
  objectStore: ObjectStore | undefined,
  objectNamespace: string,
  options: { readonly signal?: AbortSignal; readonly policy?: ProjectLifecyclePolicy } = {}
): Promise<MaterialLibraryTransfer> {
  if (!objectStore) throw new Error('Object storage is unavailable');
  const parsed = parseMaterialLibraryTransferBody(body);
  const digest = await readRequestDigest({
    kind: 'material-transfer',
    itemId,
    contentId: parsed.contentId,
    destinationProjectId: parsed.destinationProjectId,
    operationId: parsed.operationId
  });

  try {
    await expireAbandonedLibraryStaging(pool, objectStore, ownerId);
  } catch {
    // Cleanup never blocks a transfer.
  }

  const itemRows = await queryRows<LibraryRow>(
    pool,
    `SELECT ${MATERIAL_SUMMARY_COLUMNS}, canonical_bytes AS "canonicalBytes"
		 FROM form_library_items
		 WHERE owner_id = $1 AND id = $2::uuid`,
    [ownerId, itemId]
  );
  const item = itemRows[0];
  if (item === undefined) throw new FormLibraryNotFoundError();
  if (item.kind !== 'material') {
    throw new FormLibraryInputError('unsupported_format_version', 409, 'Only a material item can be inserted as a Finish');
  }
  if (readSafeInteger(item.formatVersion) !== 1) {
    throw new FormLibraryInputError(
      'unsupported_format_version',
      409,
      `This material item was made with an earlier development version (format ${String(item.formatVersion)}) and cannot be inserted.`
    );
  }
  const parsedPayload = await readMaterialLibraryBytes(
    new Uint8Array(item.canonicalBytes as Buffer),
    { contentId: parsed.contentId }
  );
  if (!parsedPayload.success) {
    throw new FormLibraryInputError(
      'content_id_mismatch',
      400,
      parsedPayload.issues[0]?.message ?? 'The material item bytes are invalid'
    );
  }
  const recipeRevision = await recipeHash(parsedPayload.payload.recipe);
  if (recipeRevision !== readString(item.recipeHash)) {
    throw new FormLibraryInputError(
      'content_id_mismatch',
      400,
      'The material recipe does not match the stored recipe identity'
    );
  }
  const recipeDigests = new Set<string>();
  // Read the exact dependency rows. The count and coverage are checked before
  // any byte is staged.
  const imageRows = await queryRows<MaterialImageRow>(
    pool,
    `SELECT hash, mime, byte_size AS "byteSize", source_kind AS "sourceKind",
		 object_key AS "objectKey", source_uri AS "sourceUri"
		 FROM material_library_images WHERE item_id = $1::uuid ORDER BY hash ASC`,
    [itemId]
  );
  const images = imageRows.map(readItemImageRow);
  if (images.length > MATERIAL_LIBRARY_MAX_IMAGES) {
    throw new FormLibraryInputError('unsupported_format_version', 409, 'The material item has too many images');
  }
  for (const role of ['color', 'normal', 'roughness', 'metalness', 'occlusion'] as const) {
    const binding = parsedPayload.payload.recipe.maps[role];
    if (binding !== undefined) recipeDigests.add(binding.image);
  }
  if (recipeDigests.size !== images.length || [...recipeDigests].some((hash) => !images.some((image) => image.hash === hash))) {
    throw new FormLibraryInputError('content_id_mismatch', 400, 'The material image dependencies do not cover its recipe');
  }

  return withProjectWriteLease(
    pool,
    ownerId,
    parsed.destinationProjectId,
    async ({ signal: leaseSignal, assertActive }) => {
      assertActive();
      const destination = await readDestinationProject(pool, ownerId, parsed.destinationProjectId, false);
      const replay = await readReceipt(pool, ownerId, 'material-transfer', parsed.operationId);
      if (replay !== null) {
        if (readString(replay.requestDigest) !== digest) {
          throw new FormLibraryInputError(
            'operation_conflict',
            409,
            'That operation id was already used for a different library transfer'
          );
        }
        if (readNullableString(replay.destinationSavedBase) !== destination.savedBase) {
          throw new FormLibraryInputError(
            'stale_revision',
            409,
            'The destination project changed since this insertion. Choose the material again.'
          );
        }
        return transferResponseOf(replay.response);
      }

      const staged: PendingDestinationAsset[] = [];
      const stagedKeys: string[] = [];
      try {
        for (const image of images) {
          if (image.sourceKind === 'shipped') {
            const shipped = shippedImage(image.sourceUri ?? '');
            if (shipped === undefined || shipped.hash !== image.hash || shipped.mime !== image.mime || shipped.byteSize !== image.byteSize) {
              throw new FormLibraryInputError('unsupported_image', 422, 'A shipped dependency is outside the frozen manifest');
            }
            continue;
          }
          if (image.objectKey === null) {
            throw new FormLibraryInputError('image_unavailable', 422, 'A private library image has no stored object');
          }
          assertActive();
          const ready = await findReadyDestinationRow(pool, parsed.destinationProjectId, image);
          if (ready !== null) continue;
          const assetId = randomUUID();
          const stagingKey = destinationAssetKey(parsed.destinationProjectId, assetId, objectNamespace);
          try {
            assertActive();
            await recordStaging(pool, ownerId, stagingKey);
            await copyVerifiedImage({
              store: objectStore,
              sourceKey: image.objectKey,
              destinationKey: stagingKey,
              expectedHash: image.hash,
              expectedMime: image.mime,
              expectedSize: image.byteSize,
              signal: leaseSignal
            });
            assertActive();
          } catch (error) {
            await discardStaged(pool, objectStore, ownerId, [stagingKey]);
            if (error instanceof FormLibraryInputError) throw error;
            if (leaseSignal.aborted) assertActive();
            throw new FormLibraryInputError('image_unavailable', 422, 'A library image could not be copied into the project');
          }
          staged.push({
            assetId,
            hash: image.hash,
            mime: image.mime,
            byteSize: image.byteSize,
            name: `library-${image.hash.slice('sha256-'.length, 'sha256-'.length + 12)}`,
            stagingKey,
            adopted: false
          });
          stagedKeys.push(stagingKey);
        }
      } catch (error) {
        await discardStaged(pool, objectStore, ownerId, stagedKeys);
        throw error;
      }

      const finishId = `finish-${parsed.operationId}`;
      let response: MaterialLibraryTransfer;
      let committed = false;
      try {
        assertActive();
        response = await withTransaction(pool, async (client) => {
          await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
            `material-transfer:${ownerId}:${parsed.operationId}`
          ]);
          const lockedDestination = await readDestinationProject(client, ownerId, parsed.destinationProjectId, true);
          const committedReceipt = await readReceipt(client, ownerId, 'material-transfer', parsed.operationId);
          if (committedReceipt !== null) {
            if (readString(committedReceipt.requestDigest) !== digest) {
              throw new FormLibraryInputError(
                'operation_conflict',
                409,
                'That operation id was already used for a different library transfer'
              );
            }
            if (readNullableString(committedReceipt.destinationSavedBase) !== lockedDestination.savedBase) {
              throw new FormLibraryInputError(
                'stale_revision',
                409,
                'The destination project changed since this insertion. Choose the material again.'
              );
            }
            return transferResponseOf(committedReceipt.response);
          }
          // The item must still exist at its exact revision at metadata commit.
          const itemStillThere = await queryRows<{ contentId: unknown; formatVersion: unknown }>(
            client,
            `SELECT content_id AS "contentId", format_version AS "formatVersion" FROM form_library_items
						 WHERE owner_id = $1 AND id = $2::uuid AND kind = 'material' FOR SHARE`,
            [ownerId, itemId]
          );
          if (itemStillThere[0] === undefined || readString(itemStillThere[0].contentId) !== parsed.contentId) {
            throw new FormLibraryNotFoundError('The library item was removed during the transfer');
          }
          if (readSafeInteger(itemStillThere[0].formatVersion) !== 1) {
            throw new FormLibraryInputError(
              'unsupported_format_version',
              409,
              'This material was made with an earlier development version and cannot be inserted'
            );
          }
          const resolvedImages: MaterialLibraryTransferImage[] = [];
          for (const image of images) {
            if (image.sourceKind === 'shipped') {
              resolvedImages.push({
                hash: image.hash,
                source: { shipped: image.sourceUri! },
                mime: image.mime,
                byteSize: image.byteSize
              });
              continue;
            }
            const pending = staged.find((entry) => entry.hash === image.hash && !entry.adopted);
            const ready = await findReadyDestinationRow(client, parsed.destinationProjectId, image);
            if (ready !== null) {
              resolvedImages.push(
                transferImageOf({ ...image, assetId: ready.id, name: ready.name })
              );
              if (pending !== undefined) pending.adopted = false;
              continue;
            }
            if (pending === undefined) {
              throw new FormLibraryInputError('image_unavailable', 422, 'A staged destination image is missing');
            }
            const claimed = await consumeStagingRows(client, ownerId, [pending.stagingKey]);
            if (claimed.length !== 1) {
              throw new FormLibraryInputError(
                'stale_revision',
                409,
                'A staged destination image expired before commit; retry the transfer.'
              );
            }
            await client.query(
              `INSERT INTO assets
								(id, project_id, name, kind, storage_kind, source_kind, source_ref, mime, byte_size, sha256, object_key, import_state)
							 VALUES ($1::uuid, $2, $3, 'texture', 'r2', 'upload', null, $4, $5, $6, $7, 'ready')`,
              [pending.assetId, parsed.destinationProjectId, pending.name, pending.mime, pending.byteSize, pending.hash, pending.stagingKey]
            );
            pending.adopted = true;
            resolvedImages.push(
              transferImageOf({
                hash: pending.hash,
                mime: pending.mime,
                byteSize: pending.byteSize,
                assetId: pending.assetId,
                name: pending.name
              })
            );
          }
          const committedResponse: MaterialLibraryTransfer = {
            itemId,
            contentId: parsed.contentId,
            finishId,
            name: parsedPayload.payload.name,
            recipe: parsedPayload.payload.recipe,
            recipeHash: recipeRevision,
            images: resolvedImages,
            savedBase: lockedDestination.savedBase
          };
          await insertReceipt(client, {
            ownerId,
            kind: 'material-transfer',
            operationId: parsed.operationId,
            digest,
            destinationSavedBase: lockedDestination.savedBase,
            response: committedResponse
          });
          return committedResponse;
        });
        committed = true;
        assertActive();
      } catch (error) {
        if (!committed) {
          await discardStaged(pool, objectStore, ownerId, stagedKeys);
        }
        throw error;
      }
      // Adopted keys stay; a losing staged copy is removed only after the committed
      // rows no longer depend on it.
      const losing = staged.filter((entry) => !entry.adopted).map((entry) => entry.stagingKey);
      await reclaimLosingStaged(pool, objectStore, ownerId, losing);
      return response;
    },
    {
      ...(options.signal === undefined ? {} : { parentSignal: options.signal }),
      policy: options.policy ?? DEFAULT_PROJECT_LIFECYCLE_POLICY
    }
  );
}
