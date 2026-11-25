/**
 * Owner-scoped library storage: My Objects forms and material Finishes.
 *
 * The file keeps its historical name because the form library was the first
 * kind; it is now the one **library dispatcher**. A form item is the original
 * immutable saved form source. A material item is an accepted Finish's
 * flattened v1 recipe plus its display name, pinned private image dependencies
 * and an optional fixed thumbnail. Both are owner data, never project data.
 *
 * Invariants:
 *
 * - One item is one immutable saved revision: a server-allocated logical id and
 *   canonical payload bytes whose SHA-256 is the item's content identity.
 * - A material item's `recipe_hash` is the portable recipe revision, distinct
 *   from the content identity that includes the display name.
 * - Every read, list, thumbnail, transfer and remove statement filters by owner.
 *   Another owner's id is indistinguishable from an unknown id.
 * - Private image copies are streamed and verified before metadata commits.
 *   A destination project never references a source project's object key.
 * - Same operation id + same canonical body replays the committed response;
 *   a different body is a conflict. A removed item is not resurrected.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { PassThrough } from 'node:stream';

import {
  FORM_LIBRARY_MAX_ITEMS,
  readFormLibraryPayload,
  type FormLibraryItemSummary,
  type FormLibraryPayload,
  type MaterialLibraryImageBinding,
  type MaterialLibraryItemSummary,
  type MaterialLibraryPayload,
  type MaterialLibraryTransfer,
  type MaterialLibraryTransferImage,
  MATERIAL_LIBRARY_MAX_CANONICAL_BYTES,
  MATERIAL_LIBRARY_MAX_IMAGES,
  MATERIAL_LIBRARY_MAX_THUMBNAIL_BYTES,
  MATERIAL_LIBRARY_MAX_THUMBNAIL_EDGE,
  canonicalMaterialLibraryBytes,
  materialLibraryImageBindings,
  readMaterialLibraryPayload,
  readMaterialLibraryBytes
} from '@portfolio/project-model/library';
import { probeArtworkImage } from '@portfolio/project-model/artwork';
import { sha256Bytes } from '@portfolio/project-model/package';
import { recipeHash, shippedImage } from '@portfolio/project-model/materials';
import { canonicalUnitJson, UNIT_ENVELOPE_SOURCE_FORMAT } from '@portfolio/project-model/units';

import type { DatabasePool } from './database.js';
import { queryRows, withTransaction } from './project-persistence.js';
import {
  DEFAULT_PROJECT_LIFECYCLE_POLICY,
  withProjectWriteLease,
  type ProjectLifecyclePolicy
} from './project-write-lease.js';
import { readAssetRow } from './asset-persistence.js';
import type { ObjectStore } from './object-store.js';

const SHA256_IDENTITY = /^sha256-[0-9a-f]{64}$/;
const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const STAGING_TTL_MS = 24 * 60 * 60 * 1000;
const READY_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const;
type ReadyImageMime = (typeof READY_IMAGE_MIMES)[number];

export type LibraryKind = 'form' | 'material';
export type LibraryListKind = LibraryKind | 'all';

export type LibraryItemSummary = FormLibraryItemSummary | MaterialLibraryItemSummary;

export class FormLibraryInputError extends Error {
  readonly statusCode: 400 | 409 | 413 | 415 | 422;
  readonly code:
    | 'invalid_library_item'
    | 'content_id_mismatch'
    | 'payload_too_large'
    | 'library_full'
    | 'operation_conflict'
    | 'stale_thumbnail'
    | 'stale_revision'
    | 'unsupported_format_version'
    | 'unsupported_image'
    | 'image_unavailable'
    | 'invalid_transfer';

  constructor(
    code: FormLibraryInputError['code'],
    statusCode: FormLibraryInputError['statusCode'],
    message: string
  ) {
    super(message);
    this.name = 'FormLibraryInputError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class FormLibraryNotFoundError extends Error {
  constructor(message = 'Library item not found') {
    super(message);
    this.name = 'FormLibraryNotFoundError';
  }
}

type LibraryRow = {
  id: unknown;
  name: unknown;
  kind: unknown;
  formatVersion: unknown;
  contentId: unknown;
  createdAt: unknown;
  recipeHash?: unknown;
  imageCount?: unknown;
  hasThumbnail?: unknown;
  canonicalBytes?: unknown;
};

type MaterialImageRow = {
  hash: unknown;
  mime: unknown;
  byteSize: unknown;
  sourceKind: unknown;
  objectKey: unknown;
  sourceUri: unknown;
};

type ThumbnailRow = {
  contentId: unknown;
  recipeHash: unknown;
  thumbnailKey: unknown;
  thumbnailHash: unknown;
  thumbnailByteSize: unknown;
};

type ReceiptRow = {
  requestDigest: unknown;
  destinationSavedBase: unknown;
  response: unknown;
};

const SUMMARY_COLUMNS = `
	id,
	name,
	kind,
	format_version AS "formatVersion",
	content_id AS "contentId",
	created_at AS "createdAt"`;

const MATERIAL_SUMMARY_COLUMNS = `
	${SUMMARY_COLUMNS},
	recipe_hash AS "recipeHash",
	(SELECT count(*)::int FROM material_library_images i WHERE i.item_id = form_library_items.id) AS "imageCount",
	(thumbnail_key IS NOT NULL) AS "hasThumbnail"`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readKind(value: unknown): LibraryKind {
  if (value !== 'form' && value !== 'material') throw new Error('Library row contained an invalid kind');
  return value;
}

function readString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Library row contained an invalid string');
  }
  return value;
}

function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return readString(value);
}

function readSafeInteger(value: unknown): number {
  const result = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error('Library row contained an invalid number');
  }
  return result;
}

function summaryOf(row: LibraryRow): LibraryItemSummary {
  const kind = readKind(row.kind);
  const base = {
    id: readString(row.id),
    name: readString(row.name),
    kind,
    formatVersion: readSafeInteger(row.formatVersion),
    contentId: readString(row.contentId),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)
  } as const;
  if (kind === 'form') return { ...base, kind: 'form' };
  return {
    ...base,
    kind: 'material',
    recipeHash: readString(row.recipeHash),
    imageCount: readSafeInteger(row.imageCount),
    hasThumbnail: row.hasThumbnail === true
  } as MaterialLibraryItemSummary;
}

function materialSummaryOf(row: LibraryRow): MaterialLibraryItemSummary {
  const summary = summaryOf(row);
  if (summary.kind !== 'material') throw new Error('Library row was not a material item');
  return summary;
}

/* -------------------------------------------------------------------------- */
/* Form payload (unchanged behavior)                                          */
/* -------------------------------------------------------------------------- */

/**
 * Read one form Save request: exactly `{ contentId, payload }`, validated
 * through the shared codec. The content id is recomputed from the canonical
 * bytes, never trusted.
 */
export function parseFormLibrarySaveBody(
  body: unknown
): { readonly contentId: string; readonly payload: FormLibraryPayload } {
  if (!isRecord(body)) {
    throw new FormLibraryInputError('invalid_library_item', 400, 'Expected a library item request');
  }
  const keys = Object.keys(body);
  if (keys.some((key) => key !== 'contentId' && key !== 'payload') || keys.length !== 2) {
    throw new FormLibraryInputError(
      'invalid_library_item',
      400,
      'Expected exactly a contentId and a payload'
    );
  }
  if (typeof body.contentId !== 'string' || !SHA256_IDENTITY.test(body.contentId)) {
    throw new FormLibraryInputError('invalid_library_item', 400, 'Expected a canonical content id');
  }
  const parsed = readFormLibraryPayload(body.payload);
  if (!parsed.success) {
    const first = parsed.issues[0];
    const tooLarge = first?.code === 'payload_too_large';
    throw new FormLibraryInputError(
      tooLarge ? 'payload_too_large' : 'invalid_library_item',
      tooLarge ? 413 : 400,
      first?.message ?? 'The library item is not valid'
    );
  }
  return { contentId: body.contentId, payload: parsed.payload };
}

/** Store one new form item, or refuse with a reason the editor can show. */
export async function saveFormLibraryItem(
  pool: DatabasePool,
  ownerId: string,
  body: unknown
): Promise<FormLibraryItemSummary> {
  const parsed = parseFormLibrarySaveBody(body);
  const bytes = new TextEncoder().encode(JSON.stringify(parsed.payload));
  const contentId = await sha256Bytes(bytes);
  if (contentId !== parsed.contentId) {
    throw new FormLibraryInputError(
      'content_id_mismatch',
      400,
      'The item bytes do not match the content id they were sent as'
    );
  }
  const id = randomUUID();
  const summary = await withTransaction(pool, async (client) => {
    await client.query('INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [ownerId]);
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [ownerId]);
    const counted = await client.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM form_library_items WHERE owner_id = $1',
      [ownerId]
    );
    const count = Number(counted.rows[0]?.count ?? 0);
    if (count >= FORM_LIBRARY_MAX_ITEMS) {
      throw new FormLibraryInputError(
        'library_full',
        409,
        `My Objects holds at most ${FORM_LIBRARY_MAX_ITEMS} items. Remove an item to save another.`
      );
    }
    const inserted = await client.query<LibraryRow>(
      `INSERT INTO form_library_items
				(id, owner_id, kind, name, format_version, content_id, canonical_bytes)
			 VALUES ($1, $2, 'form', $3, $4, $5, $6)
			 RETURNING ${SUMMARY_COLUMNS}`,
      [id, ownerId, parsed.payload.name, parsed.payload.formatVersion, contentId, Buffer.from(bytes)]
    );
    const row = inserted.rows[0];
    if (row === undefined) throw new Error('The library item was not stored');
    const summary = summaryOf(row);
    if (summary.kind !== 'form') throw new Error('The inserted form item had the wrong kind');
    return summary;
  });
  return summary;
}

/* -------------------------------------------------------------------------- */
/* Material Save                                                             */
/* -------------------------------------------------------------------------- */

export type MaterialLibrarySaveBody = {
  readonly contentId: string;
  readonly operationId: string;
  readonly sourceProjectId: string;
  readonly payload: MaterialLibraryPayload;
  readonly images: readonly MaterialLibraryImageBinding[];
};

function readLocalImageSource(value: unknown, path: string): MaterialLibraryImageBinding['source'] {
  if (!isRecord(value)) {
    throw new FormLibraryInputError('invalid_library_item', 400, `${path} must be a local image source`);
  }
  const keys = Object.keys(value);
  const hasTexture = Object.hasOwn(value, 'textureId');
  const hasShipped = Object.hasOwn(value, 'shipped');
  if (keys.length !== 1 || hasTexture === hasShipped) {
    throw new FormLibraryInputError(
      'invalid_library_item',
      400,
      `${path} must name exactly one of textureId or shipped`
    );
  }
  const source = hasTexture ? value.textureId : value.shipped;
  if (typeof source !== 'string' || source.length === 0 || /\s/.test(source)) {
    throw new FormLibraryInputError('invalid_library_item', 400, `${path} is not a stable image identity`);
  }
  if (hasTexture) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(source)) {
      throw new FormLibraryInputError('invalid_library_item', 400, `${path}.textureId must be a project asset id`);
    }
    return { textureId: source };
  }
  if (!source.startsWith('/textures/')) {
    throw new FormLibraryInputError('invalid_library_item', 400, `${path}.shipped must be a frozen shipped URI`);
  }
  return { shipped: source };
}

/** Strict Save body: exactly the payload, operation, source project and pins. */
export function parseMaterialLibrarySaveBody(body: unknown): MaterialLibrarySaveBody {
  if (!isRecord(body)) {
    throw new FormLibraryInputError('invalid_library_item', 400, 'Expected a material library request');
  }
  const allowed = ['contentId', 'operationId', 'sourceProjectId', 'payload', 'images'];
  if (Object.keys(body).some((key) => !allowed.includes(key)) || Object.keys(body).length !== allowed.length) {
    throw new FormLibraryInputError(
      'invalid_library_item',
      400,
      'Expected contentId, operationId, sourceProjectId, payload and images'
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
      first?.message ?? 'The material library item is not valid'
    );
  }
  if (!Array.isArray(body.images) || body.images.length > MATERIAL_LIBRARY_MAX_IMAGES) {
    throw new FormLibraryInputError(
      'invalid_library_item',
      400,
      `A material item names at most ${MATERIAL_LIBRARY_MAX_IMAGES} images`
    );
  }
  const images: MaterialLibraryImageBinding[] = [];
  for (const [index, value] of body.images.entries()) {
    const path = `$.images[${index}]`;
    if (!isRecord(value) || Object.keys(value).length !== 2 || !Object.hasOwn(value, 'hash') || !Object.hasOwn(value, 'source')) {
      throw new FormLibraryInputError('invalid_library_item', 400, `${path} must be a hash and source pair`);
    }
    if (typeof value.hash !== 'string' || !SHA256_IDENTITY.test(value.hash)) {
      throw new FormLibraryInputError('invalid_library_item', 400, `${path}.hash must be a sha256 identity`);
    }
    images.push({ hash: value.hash, source: readLocalImageSource(value.source, `${path}.source`) });
  }
  const bindings = materialLibraryImageBindings(parsed.payload.recipe, images);
  if ('issues' in bindings) {
    throw new FormLibraryInputError(
      'invalid_library_item',
      400,
      bindings.issues[0]?.message ?? 'The material image dependencies are incomplete'
    );
  }
  return {
    contentId: body.contentId,
    operationId: body.operationId,
    sourceProjectId: body.sourceProjectId,
    payload: parsed.payload,
    images: bindings.images
  };
}

function isReadyMime(value: unknown): value is ReadyImageMime {
  return typeof value === 'string' && (READY_IMAGE_MIMES as readonly string[]).includes(value);
}

type PreparedImage =
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

async function readRequestDigest(value: unknown): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(canonicalUnitJson(value)));
}

async function readReceipt(
  db: Pick<DatabasePool, 'query'>,
  ownerId: string,
  kind: 'material-save' | 'material-transfer',
  operationId: string
): Promise<ReceiptRow | null> {
  const rows = await queryRows<ReceiptRow>(
    db,
    `SELECT request_digest AS "requestDigest", destination_saved_base AS "destinationSavedBase", response
		 FROM library_receipts
		 WHERE owner_id = $1 AND operation_kind = $2 AND operation_id = $3`,
    [ownerId, kind, operationId]
  );
  return rows[0] ?? null;
}

async function insertReceipt(
  db: Pick<DatabasePool, 'query'>,
  input: {
    readonly ownerId: string;
    readonly kind: 'material-save' | 'material-transfer';
    readonly operationId: string;
    readonly digest: string;
    readonly destinationSavedBase: string | null;
    readonly response: unknown;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO library_receipts
			(owner_id, operation_kind, operation_id, request_digest, destination_saved_base, response)
		 VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      input.ownerId,
      input.kind,
      input.operationId,
      input.digest,
      input.destinationSavedBase,
      JSON.stringify(input.response)
    ]
  );
}

function replaySummary(row: ReceiptRow): MaterialLibraryItemSummary {
  const response = row.response;
  if (!isRecord(response)) throw new Error('Library receipt contained an invalid response');
  if (response.kind !== 'material' || typeof response.id !== 'string') {
    throw new Error('Library receipt was not a material save');
  }
  return {
    id: response.id,
    name: readString(response.name),
    kind: 'material',
    formatVersion: readSafeInteger(response.formatVersion),
    contentId: readString(response.contentId),
    createdAt: readString(response.createdAt),
    recipeHash: readString(response.recipeHash),
    imageCount: readSafeInteger(response.imageCount),
    hasThumbnail: response.hasThumbnail === true
  };
}

function libraryImageKey(
  ownerId: string,
  itemId: string,
  hash: string,
  namespace: string
): string {
  const owner = encodeURIComponent(ownerId);
  return `library/${namespace}/${owner}/${itemId}/${randomUUID()}/image-${hash.slice('sha256-'.length, 'sha256-'.length + 24)}-${randomBytes(8).toString('hex')}`;
}

function thumbnailKey(ownerId: string, itemId: string, namespace: string): string {
  return `library/${namespace}/${encodeURIComponent(ownerId)}/${itemId}/thumbnail/${randomUUID()}`;
}

function destinationAssetKey(
  projectId: string,
  assetId: string,
  namespace: string
): string {
  return `projects/${namespace}/${projectId}/assets/${assetId}/${randomBytes(16).toString('hex')}`;
}

async function recordStaging(
  db: Pick<DatabasePool, 'query'>,
  ownerId: string,
  key: string
): Promise<void> {
  await db.query(
    `INSERT INTO library_staging (id, owner_id, object_key, expires_at)
		 VALUES ($1::uuid, $2, $3, now() + $4::interval)`,
    [randomUUID(), ownerId, key, `${STAGING_TTL_MS} milliseconds`]
  );
}

async function clearStagingRows(
  db: Pick<DatabasePool, 'query'>,
  ownerId: string,
  keys: readonly string[]
): Promise<void> {
  if (keys.length === 0) return;
  await db.query('DELETE FROM library_staging WHERE owner_id = $1 AND object_key = ANY ($2::text[])', [
    ownerId,
    [...keys]
  ]);
}

async function consumeStagingRows(
  db: Pick<DatabasePool, 'query'>,
  ownerId: string,
  keys: readonly string[]
): Promise<string[]> {
  if (keys.length === 0) return [];
  const rows = await queryRows<{ key: unknown }>(
    db,
    'DELETE FROM library_staging WHERE owner_id = $1 AND object_key = ANY ($2::text[]) RETURNING object_key AS key',
    [ownerId, [...keys]]
  );
  return rows.map((row) => readString(row.key));
}

async function deleteObjectQuietly(store: ObjectStore, key: string): Promise<boolean> {
  try {
    await store.delete?.(key);
    return true;
  } catch {
    // The staging row remains for bounded retry.
    return false;
  }
}

async function discardStaged(
  pool: DatabasePool,
  store: ObjectStore,
  ownerId: string,
  keys: readonly string[]
): Promise<void> {
  if (keys.length === 0) return;
  const deleted: string[] = [];
  for (const key of keys) {
    if (await deleteObjectQuietly(store, key)) deleted.push(key);
  }
  if (deleted.length === 0) return;
  try {
    await clearStagingRows(pool, ownerId, deleted);
  } catch {
    // Expiry collection will observe the missing objects.
  }
}

async function reclaimLosingStaged(
  pool: DatabasePool,
  store: ObjectStore,
  ownerId: string,
  keys: readonly string[]
): Promise<void> {
  if (keys.length === 0) return;
  const toClear: string[] = [];
  for (const key of keys) {
    try {
      if (await keyStillReferenced(pool, key)) {
        toClear.push(key);
      } else if (await deleteObjectQuietly(store, key)) {
        toClear.push(key);
      }
    } catch {
      // A later expiry pass will re-check and collect unreferenced keys.
    }
  }
  if (toClear.length === 0) return;
  try {
    await clearStagingRows(pool, ownerId, toClear);
  } catch {
    // Expiry collection will observe the missing objects.
  }
}

function sniffImageMime(prefix: readonly number[]): ReadyImageMime | null {
  if (
    prefix.length >= 8 &&
    prefix[0] === 0x89 && prefix[1] === 0x50 && prefix[2] === 0x4e && prefix[3] === 0x47 &&
    prefix[4] === 0x0d && prefix[5] === 0x0a && prefix[6] === 0x1a && prefix[7] === 0x0a
  ) return 'image/png';
  if (
    prefix.length >= 12 &&
    prefix[0] === 0x52 && prefix[1] === 0x49 && prefix[2] === 0x46 && prefix[3] === 0x46 &&
    prefix[8] === 0x57 && prefix[9] === 0x45 && prefix[10] === 0x42 && prefix[11] === 0x50
  ) return 'image/webp';
  if (prefix.length >= 3 && prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff) return 'image/jpeg';
  return null;
}

/**
 * Stream one verified private image copy.
 *
 * The source's declared size is the hard bound; every byte is hashed and the
 * container is sniffed. A mismatch deletes the staged key and refuses. The
 * destination metadata is only committed after this resolves.
 */
async function copyVerifiedImage(input: {
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
    throw new FormLibraryInputError('image_unavailable', 422, 'The source image bytes are missing or the wrong length');
  }
  const output = new PassThrough();
  output.on('error', () => {});
  const hash = createHash('sha256');
  const prefix: number[] = [];
  let length = 0;
  const controller = new AbortController();
  const onAbort = () => {
    const error = input.signal?.reason instanceof Error ? input.signal.reason : new Error('Library copy aborted');
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
  controller.signal.addEventListener('abort', () => abortStaging(controller.signal.reason), { once: true });
  try {
    put = input.store.put(input.destinationKey, output, {
      contentType: input.expectedMime,
      contentLength: input.expectedSize,
      signal: controller.signal
    }).catch((error: unknown) => {
      controller.abort(error);
      throw error;
    });
    for await (const chunk of source.body) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      length += buffer.length;
      if (length > input.expectedSize) {
        throw new FormLibraryInputError('image_unavailable', 422, 'The source image exceeds its pinned length');
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
    if (length !== input.expectedSize || digest !== input.expectedHash || mime !== input.expectedMime) {
      await deleteObjectQuietly(input.store, input.destinationKey);
      throw new FormLibraryInputError(
        'image_unavailable',
        422,
        'The source image does not match its verified pin'
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
async function prepareSaveImage(input: {
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
        'A shipped material image is not in the frozen catalogue at that digest'
      );
    }
    return {
      hash: shipped.hash,
      mime: shipped.mime,
      byteSize: shipped.byteSize,
      sourceKind: 'shipped',
      sourceUri: shipped.uri
    };
  }
  let asset;
  try {
    asset = await readAssetRow(input.pool, input.ownerId, input.sourceProjectId, input.binding.source.textureId);
  } catch {
    throw new FormLibraryInputError('image_unavailable', 422, 'The source project image is not available to this owner');
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
      'The source project image is not ready at the pinned identity'
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
      ...(input.signal === undefined ? {} : { signal: input.signal })
    });
  } catch (error) {
    await discardStaged(input.pool, input.store, input.ownerId, [staging]);
    throw error instanceof FormLibraryInputError
      ? error
      : new FormLibraryInputError('image_unavailable', 422, 'A source image could not be copied into the library');
  }
  return {
    hash: input.binding.hash,
    mime: asset.mime,
    byteSize: asset.byteSize,
    sourceKind: 'object',
    sourceObjectKey: asset.objectKey,
    stagingKey: staging
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
  objectNamespace: string
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
      'The item bytes do not match the content id they were sent as'
    );
  }
  const recipeRevision = await recipeHash(parsed.payload.recipe);
  const digest = await readRequestDigest({
    kind: 'material-save',
    contentId,
    operationId: parsed.operationId,
    sourceProjectId: parsed.sourceProjectId,
    images: parsed.images
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
        'That operation id was already used for a different library save'
      );
    }
    const existing = await queryRows<LibraryRow>(
      pool,
      `SELECT ${MATERIAL_SUMMARY_COLUMNS} FROM form_library_items WHERE owner_id = $1 AND id = $2::uuid`,
      [ownerId, replaySummary(replay).id]
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
        binding
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
        `material-save:${ownerId}:${parsed.operationId}`
      ]);
      const committed = await readReceipt(client, ownerId, 'material-save', parsed.operationId);
      if (committed !== null) {
        if (readString(committed.requestDigest) !== digest) {
          throw new FormLibraryInputError(
            'operation_conflict',
            409,
            'That operation id was already used for a different library save'
          );
        }
        const existing = await queryRows<LibraryRow>(
          client,
          `SELECT ${MATERIAL_SUMMARY_COLUMNS} FROM form_library_items WHERE owner_id = $1 AND id = $2::uuid`,
          [ownerId, replaySummary(committed).id]
        );
        if (existing[0] === undefined) throw new FormLibraryNotFoundError();
        replayed = true;
        return materialSummaryOf(existing[0]);
      }
      await client.query('INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [ownerId]);
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [ownerId]);
      const counted = await client.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM form_library_items WHERE owner_id = $1',
        [ownerId]
      );
      if (Number(counted.rows[0]?.count ?? 0) >= FORM_LIBRARY_MAX_ITEMS) {
        throw new FormLibraryInputError(
          'library_full',
          409,
          `My Objects holds at most ${FORM_LIBRARY_MAX_ITEMS} items. Remove an item to save another.`
        );
      }
      if (stagedKeys.length > 0) {
        const claimed = await consumeStagingRows(client, ownerId, stagedKeys);
        if (claimed.length !== stagedKeys.length) {
          throw new FormLibraryInputError(
            'stale_revision',
            409,
            'A staged library image expired before commit; retry saving the material.'
          );
        }
      }
      const inserted = await client.query<LibraryRow>(
        `INSERT INTO form_library_items
					(id, owner_id, kind, name, format_version, content_id, canonical_bytes, recipe_hash)
				 VALUES ($1::uuid, $2, 'material', $3, 1, $4, $5, $6)
				 RETURNING ${MATERIAL_SUMMARY_COLUMNS}`,
        [itemId, ownerId, parsed.payload.name, contentId, Buffer.from(bytes), recipeRevision]
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
            image.sourceKind === 'shipped' ? image.sourceUri : null
          ]
        );
      }
      const stored = { ...materialSummaryOf(row), imageCount: prepared.length };
      await insertReceipt(client, {
        ownerId,
        kind: 'material-save',
        operationId: parsed.operationId,
        digest,
        destinationSavedBase: null,
        response: stored
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

/* -------------------------------------------------------------------------- */
/* Material thumbnail                                                        */
/* -------------------------------------------------------------------------- */

export type LibraryThumbnail = {
  readonly body: Readable;
  readonly byteSize: number;
};

async function readThumbnailItem(
  db: Pick<DatabasePool, 'query'>,
  ownerId: string,
  itemId: string,
  lock: boolean
): Promise<ThumbnailRow> {
  const rows = await queryRows<ThumbnailRow>(
    db,
    `SELECT content_id AS "contentId", recipe_hash AS "recipeHash",
		 thumbnail_key AS "thumbnailKey", thumbnail_hash AS "thumbnailHash",
		 thumbnail_byte_size AS "thumbnailByteSize"
		 FROM form_library_items
		 WHERE owner_id = $1 AND id = $2::uuid AND kind = 'material'
		 ${lock ? 'FOR UPDATE' : ''}`,
    [ownerId, itemId]
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
  objectStore: ObjectStore | undefined
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
  }
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
    throw new FormLibraryInputError('unsupported_image', 415, 'A thumbnail must be a static PNG image');
  }
  if (
    probe.mime !== 'image/png' ||
    probe.pixelWidth > MATERIAL_LIBRARY_MAX_THUMBNAIL_EDGE ||
    probe.pixelHeight > MATERIAL_LIBRARY_MAX_THUMBNAIL_EDGE
  ) {
    throw new FormLibraryInputError(
      'unsupported_image',
      415,
      `A thumbnail must be a PNG no larger than ${MATERIAL_LIBRARY_MAX_THUMBNAIL_EDGE}×${MATERIAL_LIBRARY_MAX_THUMBNAIL_EDGE}`
    );
  }
  const current = await readThumbnailItem(pool, ownerId, itemId, false);
  if (readString(current.contentId) !== options.expectedContentId) {
    throw new FormLibraryInputError('stale_thumbnail', 409, 'The library item changed since the thumbnail was generated');
  }
  if (readString(current.recipeHash) !== options.recipeKey) {
    throw new FormLibraryInputError('stale_thumbnail', 409, 'The thumbnail was generated for a different recipe');
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
      signal: options.signal ?? new AbortController().signal
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
          'The library item changed while the thumbnail was uploading'
        );
      }
      const claimed = await consumeStagingRows(client, ownerId, [staging]);
      if (claimed.length !== 1) {
        throw new FormLibraryInputError(
          'stale_thumbnail',
          409,
          'The thumbnail upload expired before commit; retry the upload.'
        );
      }
      const old = readNullableString(locked.thumbnailKey);
      await client.query(
        `UPDATE form_library_items
				 SET thumbnail_key = $3, thumbnail_hash = $4, thumbnail_recipe_key = $5, thumbnail_byte_size = $6
				 WHERE owner_id = $1 AND id = $2::uuid AND kind = 'material'`,
        [ownerId, itemId, staging, hash, options.recipeKey, bytes.byteLength]
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

/* -------------------------------------------------------------------------- */
/* Transfer                                                                   */
/* -------------------------------------------------------------------------- */

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

async function readDestinationProject(
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

function readItemImageRow(row: MaterialImageRow): {
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

function transferResponseOf(value: unknown): MaterialLibraryTransfer {
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

type PendingDestinationAsset = {
  readonly assetId: string;
  readonly hash: string;
  readonly mime: ReadyImageMime;
  readonly byteSize: number;
  readonly name: string;
  readonly stagingKey: string;
  adopted: boolean;
};

async function findReadyDestinationRow(
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

function transferImageOf(input: {
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

/* -------------------------------------------------------------------------- */
/* List / read / remove                                                       */
/* -------------------------------------------------------------------------- */

/** The owner's items, newest first. No bytes are listed. */
export async function listLibraryItems(
  pool: DatabasePool,
  ownerId: string,
  kind: LibraryListKind = 'form'
): Promise<LibraryItemSummary[]> {
  const rows =
    kind === 'form'
      ? await queryRows<LibraryRow>(
          pool,
          `SELECT ${SUMMARY_COLUMNS}
					 FROM form_library_items
					 WHERE owner_id = $1 AND kind = 'form'
					 ORDER BY created_at DESC, id DESC`,
          [ownerId]
        )
      : kind === 'material'
        ? await queryRows<LibraryRow>(
            pool,
            `SELECT ${MATERIAL_SUMMARY_COLUMNS}
						 FROM form_library_items
						 WHERE owner_id = $1 AND kind = 'material'
						 ORDER BY created_at DESC, id DESC`,
            [ownerId]
          )
        : await queryRows<LibraryRow>(
            pool,
            `SELECT id, name, kind, format_version AS "formatVersion", content_id AS "contentId",
						 created_at AS "createdAt", recipe_hash AS "recipeHash",
						 (SELECT count(*)::int FROM material_library_images i WHERE i.item_id = form_library_items.id) AS "imageCount",
						 (thumbnail_key IS NOT NULL) AS "hasThumbnail"
						 FROM form_library_items
						 WHERE owner_id = $1
						 ORDER BY created_at DESC, id DESC`,
            [ownerId]
          );
  return rows.map(summaryOf);
}

/** The historical form-only list, preserved for existing callers. */
export async function listFormLibraryItems(
  pool: DatabasePool,
  ownerId: string
): Promise<FormLibraryItemSummary[]> {
  return (await listLibraryItems(pool, ownerId, 'form')) as FormLibraryItemSummary[];
}

/** One item's canonical bytes, for the owner only. */
export async function readLibraryItem(
  pool: DatabasePool,
  ownerId: string,
  id: string
): Promise<{ readonly summary: LibraryItemSummary; readonly bytes: Uint8Array }> {
  const rows = await queryRows<LibraryRow>(
    pool,
    `SELECT ${MATERIAL_SUMMARY_COLUMNS}, canonical_bytes AS "canonicalBytes"
		 FROM form_library_items
		 WHERE owner_id = $1 AND id = $2::uuid`,
    [ownerId, id]
  );
  const row = rows[0];
  if (row === undefined) throw new FormLibraryNotFoundError();
  return { summary: summaryOf(row), bytes: new Uint8Array(row.canonicalBytes as Buffer) };
}

/** The historical form read, preserved for existing callers. */
export async function readFormLibraryItem(
  pool: DatabasePool,
  ownerId: string,
  id: string
): Promise<{ readonly summary: FormLibraryItemSummary; readonly bytes: Uint8Array }> {
  const read = await readLibraryItem(pool, ownerId, id);
  if (read.summary.kind !== 'form') throw new FormLibraryNotFoundError();
  return { summary: read.summary, bytes: read.bytes };
}

async function keyStillReferenced(
  db: Pick<DatabasePool, 'query'>,
  key: string
): Promise<boolean> {
  const rows = await queryRows<{ referenced: unknown }>(
    db,
    `SELECT 1 AS referenced FROM material_library_images WHERE object_key = $1
		 UNION ALL
		 SELECT 1 FROM form_library_items WHERE thumbnail_key = $1
		 UNION ALL
		 SELECT 1 FROM assets WHERE object_key = $1
		 LIMIT 1`,
    [key]
  );
  return rows.length > 0;
}

async function reclaimIfUnreferenced(
  pool: DatabasePool,
  store: ObjectStore,
  key: string
): Promise<void> {
  try {
    if (await keyStillReferenced(pool, key)) return;
    await store.delete?.(key);
  } catch {
    // A later expiry pass or purge will collect the key.
  }
}

/**
 * Remove one item. Copies already inserted are unaffected: they hold their own
 * source and no reference to the item. Child image rows cascade; private keys
 * are reclaimed only when no committed row owns them.
 */
export async function removeFormLibraryItem(
  pool: DatabasePool,
  ownerId: string,
  id: string,
  objectStore?: ObjectStore
): Promise<void> {
  const removed = await withTransaction(pool, async (client) => {
    const row = await queryRows<{ id: unknown }>(
      client,
      `SELECT id FROM form_library_items WHERE owner_id = $1 AND id = $2::uuid FOR UPDATE`,
      [ownerId, id]
    );
    if (row[0] === undefined) throw new FormLibraryNotFoundError();
    const keys = await queryRows<{ key: unknown }>(
      client,
      `SELECT object_key AS key FROM material_library_images WHERE item_id = $1::uuid AND object_key IS NOT NULL
			 UNION ALL
			 SELECT thumbnail_key AS key FROM form_library_items WHERE id = $1::uuid AND thumbnail_key IS NOT NULL`,
      [id]
    );
    await client.query('DELETE FROM form_library_items WHERE owner_id = $1 AND id = $2::uuid', [ownerId, id]);
    return keys.map((entry) => readString(entry.key));
  });
  if (objectStore !== undefined) {
    for (const key of removed) await reclaimIfUnreferenced(pool, objectStore, key);
  }
}

/* -------------------------------------------------------------------------- */
/* Abandoned staging                                                          */
/* -------------------------------------------------------------------------- */

type AbandonedStagingRow = {
  id: unknown;
  key: unknown;
  referenced: unknown;
};

/**
 * Reclaim one owner's expired staging keys, bytes included.
 *
 * This is the model-staging pattern, not a background worker: a scoped library
 * or transfer access performs it first. One statement claims every expired
 * staging row before checking committed references, so a delayed commit can no
 * longer adopt a claimed key and a key that a committed item, thumbnail or
 * destination asset row names is never deleted.
 */
export async function expireAbandonedLibraryStaging(
  pool: DatabasePool,
  store: ObjectStore | undefined,
  ownerId: string
): Promise<void> {
  if (!store) return;
  const claimed = await queryRows<AbandonedStagingRow>(
    pool,
    `WITH candidate AS (
			SELECT id FROM library_staging
			WHERE owner_id = $1 AND expires_at <= now()
			ORDER BY expires_at ASC
			LIMIT 100
		),
		claimed AS (
			DELETE FROM library_staging s
			USING candidate c
			WHERE s.id = c.id AND s.owner_id = $1
			RETURNING s.id, s.object_key
		)
		SELECT c.id, c.object_key AS key, (
			EXISTS (SELECT 1 FROM material_library_images m WHERE m.object_key = c.object_key)
			OR EXISTS (SELECT 1 FROM form_library_items f WHERE f.thumbnail_key = c.object_key)
			OR EXISTS (SELECT 1 FROM assets a WHERE a.object_key = c.object_key)
		) AS referenced
		FROM claimed c`,
    [ownerId]
  );
  for (const entry of claimed) {
    if (entry.referenced === true) continue;
    const key = readString(entry.key);
    try {
      await store.delete?.(key);
    } catch {
      // Best effort: the staging row is already claimed; an orphan is collected by namespace purge.
    }
  }
}
