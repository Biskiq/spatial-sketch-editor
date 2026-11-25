import { type FormLibraryItemSummary, type MaterialLibraryItemSummary } from '@portfolio/project-model/library';
import { sha256Bytes } from '@portfolio/project-model/package';
import { canonicalUnitJson } from '@portfolio/project-model/units';
import { type DatabasePool } from '../database.js';
import { type ObjectStore } from '../object-store.js';
import { queryRows } from '../project-persistence.js';
import { randomBytes, randomUUID } from 'node:crypto';

export const SHA256_IDENTITY = /^sha256-[0-9a-f]{64}$/;
export const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
export const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
export const STAGING_TTL_MS = 24 * 60 * 60 * 1000;
export const READY_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type ReadyImageMime = (typeof READY_IMAGE_MIMES)[number];

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

export type LibraryRow = {
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

export type MaterialImageRow = {
  hash: unknown;
  mime: unknown;
  byteSize: unknown;
  sourceKind: unknown;
  objectKey: unknown;
  sourceUri: unknown;
};

export type ThumbnailRow = {
  contentId: unknown;
  recipeHash: unknown;
  thumbnailKey: unknown;
  thumbnailHash: unknown;
  thumbnailByteSize: unknown;
};

export type ReceiptRow = {
  requestDigest: unknown;
  destinationSavedBase: unknown;
  response: unknown;
};

export const SUMMARY_COLUMNS = `
	id,
	name,
	kind,
	format_version AS "formatVersion",
	content_id AS "contentId",
	created_at AS "createdAt"`;

export const MATERIAL_SUMMARY_COLUMNS = `
	${SUMMARY_COLUMNS},
	recipe_hash AS "recipeHash",
	(SELECT count(*)::int FROM material_library_images i WHERE i.item_id = form_library_items.id) AS "imageCount",
	(thumbnail_key IS NOT NULL) AS "hasThumbnail"`;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readKind(value: unknown): LibraryKind {
  if (value !== 'form' && value !== 'material') throw new Error('Library row contained an invalid kind');
  return value;
}

export function readString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Library row contained an invalid string');
  }
  return value;
}

export function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return readString(value);
}

export function readSafeInteger(value: unknown): number {
  const result = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error('Library row contained an invalid number');
  }
  return result;
}

export function summaryOf(row: LibraryRow): LibraryItemSummary {
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

export function materialSummaryOf(row: LibraryRow): MaterialLibraryItemSummary {
  const summary = summaryOf(row);
  if (summary.kind !== 'material') throw new Error('Library row was not a material item');
  return summary;
}

export async function readRequestDigest(value: unknown): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(canonicalUnitJson(value)));
}

export async function readReceipt(
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

export async function insertReceipt(
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

export function replaySummary(row: ReceiptRow): MaterialLibraryItemSummary {
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

export function libraryImageKey(
  ownerId: string,
  itemId: string,
  hash: string,
  namespace: string
): string {
  const owner = encodeURIComponent(ownerId);
  return `library/${namespace}/${owner}/${itemId}/${randomUUID()}/image-${hash.slice('sha256-'.length, 'sha256-'.length + 24)}-${randomBytes(8).toString('hex')}`;
}

export function thumbnailKey(ownerId: string, itemId: string, namespace: string): string {
  return `library/${namespace}/${encodeURIComponent(ownerId)}/${itemId}/thumbnail/${randomUUID()}`;
}

export function destinationAssetKey(
  projectId: string,
  assetId: string,
  namespace: string
): string {
  return `projects/${namespace}/${projectId}/assets/${assetId}/${randomBytes(16).toString('hex')}`;
}

export async function recordStaging(
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

export async function clearStagingRows(
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

export async function consumeStagingRows(
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

export async function deleteObjectQuietly(store: ObjectStore, key: string): Promise<boolean> {
  try {
    await store.delete?.(key);
    return true;
  } catch {
    // The staging row remains for bounded retry.
    return false;
  }
}

export async function discardStaged(
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

export async function reclaimLosingStaged(
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

export async function keyStillReferenced(
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
