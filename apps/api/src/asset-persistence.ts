import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PassThrough, Readable } from 'node:stream';

import { UNIT_ENVELOPE_SOURCE_FORMAT } from '@portfolio/project-model/units';

import type { DatabasePool } from './database.js';
import type { ObjectStore } from './object-store.js';
import { queryRows } from './project-persistence.js';
import {
	DEFAULT_PROJECT_LIFECYCLE_POLICY,
	withProjectWriteLease,
	type ProjectLifecyclePolicy
} from './project-write-lease.js';

export const MAX_ASSET_BYTES = 25 * 1024 * 1024;

export type AssetMime = 'image/png' | 'image/webp' | 'image/jpeg';
export type AssetImportState = 'pending' | 'ready' | 'failed';

export type AssetMetadata = {
	id: string;
	projectId: string;
	name: string;
	kind: 'texture' | 'procedural';
	storageKind: 'r2' | 'none';
	sourceKind: 'upload' | 'builtin' | 'procedural';
	sourceRef: string | null;
	mime: AssetMime | null;
	byteSize: number | null;
	sha256: string | null;
	importState: AssetImportState;
	createdAt: string;
	updatedAt: string;
};

export class AssetNotFoundError extends Error {
	constructor() {
		super('Asset not found');
		this.name = 'AssetNotFoundError';
	}
}

export class AssetNotReadyError extends Error {
	constructor() {
		super('Asset is not ready');
		this.name = 'AssetNotReadyError';
	}
}

export class AssetInputError extends Error {
	readonly statusCode: 400 | 411 | 413 | 415;
	readonly code: 'invalid_asset' | 'length_required' | 'invalid_upload' | 'payload_too_large' | 'unsupported_media_type';

	constructor(
		code: AssetInputError['code'],
		statusCode: AssetInputError['statusCode'],
		message: string
	) {
		super(message);
		this.name = 'AssetInputError';
		this.code = code;
		this.statusCode = statusCode;
	}
}

type AssetRow = {
	id: unknown;
	projectId: unknown;
	name: unknown;
	kind: unknown;
	storageKind: unknown;
	sourceKind: unknown;
	sourceRef: unknown;
	mime: unknown;
	byteSize: unknown;
	sha256: unknown;
	objectKey: unknown;
	importState: unknown;
	createdAt: unknown;
	updatedAt: unknown;
};

export type StoredAsset = AssetMetadata & { objectKey: string | null };

const ASSET_COLUMNS = `
	a.id,
	a.project_id AS "projectId",
	a.name,
	a.kind,
	a.storage_kind AS "storageKind",
	a.source_kind AS "sourceKind",
	a.source_ref AS "sourceRef",
	a.mime,
	a.byte_size AS "byteSize",
	a.sha256,
	a.object_key AS "objectKey",
	a.import_state AS "importState",
	a.created_at AS "createdAt",
	a.updated_at AS "updatedAt"`;

const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidProjectId(value: unknown): value is string {
	return typeof value === 'string' && PROJECT_ID_PATTERN.test(value);
}

export function isValidAssetId(value: unknown): value is string {
	return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function readAssetNameBody(value: unknown): string {
	if (
		typeof value !== 'object' ||
		value === null ||
		Array.isArray(value) ||
		Object.keys(value).length !== 1 ||
		!Object.prototype.hasOwnProperty.call(value, 'name')
	) {
		throw new AssetInputError('invalid_asset', 400, 'Expected a name body');
	}
	return normalizeAssetName((value as { name?: unknown }).name);
}

export function normalizeAssetName(value: unknown): string {
	if (typeof value !== 'string') {
		throw new AssetInputError('invalid_asset', 400, 'Asset name must be a string');
	}
	const name = value.normalize('NFC');
	if (
		name.length < 1 ||
		name.length > 128 ||
		name !== name.trim() ||
		name.includes('/') ||
		name.includes('\\')
	) {
		throw new AssetInputError('invalid_asset', 400, 'Invalid asset name');
	}
	return name;
}

export async function registerAsset(
	db: Pick<DatabasePool, 'query'>,
	ownerId: string,
	projectId: string,
	name: string,
	objectNamespace: string
): Promise<AssetMetadata> {
	const assetId = randomUUID();
	const objectKey = createObjectKey(projectId, assetId, objectNamespace);
	const rows = await queryRows<AssetRow>(			db,
			`INSERT INTO assets (
	id, project_id, name, kind, storage_kind, source_kind, object_key, import_state
)
SELECT $1::uuid, p.id, $3, 'texture', 'r2', 'upload', $5, 'pending'
FROM projects p
WHERE p.id = $2 AND p.owner_id = $4
	AND EXISTS (
		SELECT 1 FROM project_versions v
		WHERE v.project_id = p.id AND v.source_format = $6
	)
RETURNING ${returningColumns()}`,
			[assetId, projectId, name, ownerId, objectKey, UNIT_ENVELOPE_SOURCE_FORMAT]
		);
	const row = rows[0];
	if (!row) throw new AssetNotFoundError();
	return readAssetMetadata(row);
}

export async function listAssets(
	db: Pick<DatabasePool, 'query'>,
	ownerId: string,
	projectId: string
): Promise<AssetMetadata[]> {
	const rows = await queryRows<AssetRow>(			db,
			`SELECT ${ASSET_COLUMNS}
FROM projects p
LEFT JOIN assets a ON a.project_id = p.id
WHERE p.id = $1 AND p.owner_id = $2
	AND EXISTS (
		SELECT 1 FROM project_versions v
		WHERE v.project_id = p.id AND v.source_format = $3
	)
ORDER BY a.created_at DESC NULLS LAST, a.id ASC`,
			[projectId, ownerId, UNIT_ENVELOPE_SOURCE_FORMAT]
		);
	if (rows.length === 0) throw new AssetNotFoundError();
	return rows.filter((row) => row.id !== null).map(readAssetMetadata);
}

export async function readAsset(
	db: Pick<DatabasePool, 'query'>,
	ownerId: string,
	projectId: string,
	assetId: string
): Promise<StoredAsset> {
	const rows = await queryRows<AssetRow>(			db,
			`SELECT ${ASSET_COLUMNS}
FROM assets a
JOIN projects p ON p.id = a.project_id
WHERE a.id = $1::uuid AND a.project_id = $2 AND p.owner_id = $3
	AND EXISTS (
		SELECT 1 FROM project_versions v
		WHERE v.project_id = p.id AND v.source_format = $4
	)`,
			[assetId, projectId, ownerId, UNIT_ENVELOPE_SOURCE_FORMAT]
		);
	const row = rows[0];
	if (!row) throw new AssetNotFoundError();
	return readStoredAsset(row);
}

export function assetMetadata(asset: StoredAsset): AssetMetadata {
	const { objectKey: _objectKey, ...metadata } = asset;
	return metadata;
}

export async function uploadAsset(
	pool: DatabasePool,
	ownerId: string,
	projectId: string,
	assetId: string,
	contentLength: number,
	body: Readable,
	objectStore: ObjectStore | undefined,
	objectNamespace: string,
	options: { parentSignal?: AbortSignal; policy?: ProjectLifecyclePolicy } = {}
): Promise<AssetMetadata> {
	if (!objectStore) throw new Error('Object storage is unavailable');
	return withProjectWriteLease(
		pool,
		ownerId,
		projectId,
		async ({ signal, assertActive }) => {
			const asset = await readAsset(pool, ownerId, projectId, assetId);
			if (asset.importState === 'ready') throw new AssetNotReadyError();

			const objectKey = createObjectKey(projectId, assetId, objectNamespace);
			const claimed = await queryRows<AssetRow>(
				pool,
				`UPDATE assets a
SET object_key = $4, import_state = 'pending', updated_at = now()
FROM projects p
WHERE a.id = $1::uuid AND a.project_id = $2 AND p.id = a.project_id
	AND p.owner_id = $3 AND a.import_state <> 'ready'
	AND EXISTS (
		SELECT 1 FROM project_versions v
		WHERE v.project_id = p.id AND v.source_format = $5
	)
RETURNING ${returningColumns('a.')}`,
				[assetId, projectId, ownerId, objectKey, UNIT_ENVELOPE_SOURCE_FORMAT]
			);
			if (!claimed[0]) throw new AssetNotReadyError();

			let uploaded: UploadedAsset;
			try {
				uploaded = await streamAsset(body, contentLength, objectStore, objectKey, signal, assertActive);
			} catch (error) {
				try {
					await pool.query(
						`UPDATE assets a
SET import_state = 'failed', updated_at = now()
FROM projects p
WHERE a.id = $1::uuid AND a.project_id = $2 AND p.id = a.project_id
	AND p.owner_id = $3 AND a.object_key = $4 AND a.import_state <> 'ready'
	AND EXISTS (
		SELECT 1 FROM project_versions v
		WHERE v.project_id = p.id AND v.source_format = $5
	)`,
						[assetId, projectId, ownerId, objectKey, UNIT_ENVELOPE_SOURCE_FORMAT]
					);
				} catch {
					// The claimed key remains available to deletion inventory.
				}
				await deleteObject(objectStore, objectKey);
				throw error;
			}

			try {
				assertActive();
			} catch (error) {
				await deleteObject(objectStore, objectKey);
				throw error;
			}
			let finalized: AssetRow[];
			try {
				finalized = await queryRows<AssetRow>(
					pool,
					`UPDATE assets a
SET mime = $4, byte_size = $5, sha256 = $6, import_state = 'ready', updated_at = now()
FROM projects p
WHERE a.id = $1::uuid AND a.project_id = $2 AND p.id = a.project_id
	AND p.owner_id = $3 AND a.object_key = $7 AND a.import_state = 'pending'
	AND EXISTS (
		SELECT 1 FROM project_versions v
		WHERE v.project_id = p.id AND v.source_format = $8
	)
RETURNING ${returningColumns('a.')}`,
					[assetId, projectId, ownerId, uploaded.mime, uploaded.byteSize, uploaded.sha256, objectKey, UNIT_ENVELOPE_SOURCE_FORMAT]
				);
				assertActive();
			} catch (error) {
				// A failed database response can follow a committed UPDATE. Preserve
				// the object only when a read proves the ready row owns this exact key;
				// if the database is unavailable, leave the key for durable cleanup.
				let ready = false;
				try {
					const current = await readAsset(pool, ownerId, projectId, assetId);
					ready = current.importState === 'ready' && current.objectKey === objectKey;
				} catch {
					ready = true;
				}
				if (!ready) await deleteObject(objectStore, objectKey);
				throw error;
			}
			const finalizedRow = finalized[0];
			if (!finalizedRow) {
				await deleteObject(objectStore, objectKey);
				throw new AssetNotReadyError();
			}
			return readAssetMetadata(finalizedRow);
		},
		{ parentSignal: options.parentSignal, policy: options.policy ?? DEFAULT_PROJECT_LIFECYCLE_POLICY }
	);
}

type UploadedAsset = {
	mime: AssetMime;
	byteSize: number;
	sha256: string;
};

async function streamAsset(
	source: Readable,
	contentLength: number,
	objectStore: ObjectStore,
	key: string,
	signal: AbortSignal,
	assertActive: () => void
): Promise<UploadedAsset> {
	const output = new PassThrough();
	output.on('error', () => {});
	const pending: Buffer[] = [];
	const hash = createHash('sha256');
	let prefix: number[] = [];
	let byteSize = 0;
	let mime: AssetMime | null = null;
	let putPromise: Promise<void> | undefined;
	let storageError: unknown;
	const onAbort = () => {
		const error = signal.reason instanceof Error ? signal.reason : new Error('Asset write aborted');
		source.destroy(error);
		output.destroy(error);
	};
	signal.addEventListener('abort', onAbort, { once: true });
	if (signal.aborted) onAbort();

	const begin = async (detectedMime: AssetMime) => {
		assertActive();
		mime = detectedMime;
		putPromise = objectStore.put(key, output, {
			contentType: detectedMime,
			contentLength,
			signal
		}).catch((error) => {
			storageError = error;
			output.destroy(error instanceof Error ? error : new Error('Asset storage failed'));
			throw error;
		});
		for (const chunk of pending) await writeChunk(output, chunk);
		pending.length = 0;
	};

	try {
		for await (const value of source) {
			assertActive();
			const chunk = toBuffer(value);
			byteSize += chunk.length;
			if (byteSize > MAX_ASSET_BYTES) {
				throw new AssetInputError('payload_too_large', 413, 'Payload Too Large');
			}
			if (byteSize > contentLength) {
				throw new AssetInputError('invalid_upload', 400, 'Upload length does not match Content-Length');
			}
			hash.update(chunk as unknown as Uint8Array<ArrayBuffer>);
			if (prefix.length < 12) {
				prefix.push(...chunk.subarray(0, 12 - prefix.length));
			}

			if (!putPromise) {
				const detected = sniffImageMime(prefix);
				if (detected) {
					await begin(detected);
					await writeChunk(output, chunk);
				} else if (prefix.length >= 12) {
					throw new AssetInputError('unsupported_media_type', 415, 'Unsupported image bytes');
				} else {
					pending.push(chunk);
				}
			} else {
				await writeChunk(output, chunk);
			}
		}

		if (!putPromise) {
			const detected = sniffImageMime(prefix);
			if (!detected) throw new AssetInputError('unsupported_media_type', 415, 'Unsupported image bytes');
			await begin(detected);
		}
		assertActive();
		if (byteSize !== contentLength) {
			throw new AssetInputError('invalid_upload', 400, 'Upload length does not match Content-Length');
		}
		output.end();
		await putPromise;
		signal.removeEventListener('abort', onAbort);
		return { mime: mime!, byteSize, sha256: `sha256-${hash.digest('hex')}` };
	} catch (error) {
			const reportedError = signal.aborted
				? signal.reason instanceof Error
					? signal.reason
					: new Error('Asset write aborted')
				: error instanceof AssetInputError || storageError
					? error
					: new AssetInputError('invalid_upload', 400, 'Upload stream failed');
		const streamError = error instanceof Error ? error : new Error('Asset upload failed');
			source.destroy(streamError);
		output.destroy(streamError);
		if (putPromise) {
			try {
				await putPromise;
			} catch {
				// The route reports the original bounded upload/storage error.
			}
		}
		signal.removeEventListener('abort', onAbort);
		throw reportedError;
	}
}

async function deleteObject(objectStore: ObjectStore, key: string): Promise<void> {
	try {
		await objectStore.delete?.(key);
	} catch {
		// The claimed key remains on the asset row for durable deletion retry.
	}
}

function sniffImageMime(bytes: readonly number[]): AssetMime | null {
	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	) {
		return 'image/png';
	}
	if (
		bytes.length >= 12 &&
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	) {
		return 'image/webp';
	}
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return 'image/jpeg';
	}
	return null;
}

async function writeChunk(stream: PassThrough, chunk: Buffer): Promise<void> {
	if (stream.write(chunk)) return;
	await new Promise<void>((resolve, reject) => {
		const onDrain = () => {
			cleanup();
			resolve();
		};
		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};
		const cleanup = () => {
			stream.off('drain', onDrain);
			stream.off('error', onError);
		};
		stream.once('drain', onDrain);
		stream.once('error', onError);
	});
}

function toBuffer(value: unknown): Buffer {
	if (Buffer.isBuffer(value)) return value;
	if (value instanceof Uint8Array) return Buffer.from(value);
	throw new Error('Asset request stream yielded a non-byte chunk');
}

function returningColumns(table = ''): string {
	const c = (name: string) => `${table}${name}`;
	return `
	${c('id')},
	${c('project_id')} AS "projectId",
	${c('name')},
	${c('kind')},
	${c('storage_kind')} AS "storageKind",
	${c('source_kind')} AS "sourceKind",
	${c('source_ref')} AS "sourceRef",
	${c('mime')},
	${c('byte_size')} AS "byteSize",
	${c('sha256')},
	${c('object_key')} AS "objectKey",
	${c('import_state')} AS "importState",
	${c('created_at')} AS "createdAt",
	${c('updated_at')} AS "updatedAt"`;
}

function readAssetMetadata(row: AssetRow): AssetMetadata {
	return {
		id: readString(row.id),
		projectId: readString(row.projectId),
		name: readString(row.name),
		kind: readEnum(row.kind, ['texture', 'procedural']),
		storageKind: readEnum(row.storageKind, ['r2', 'none']),
		sourceKind: readEnum(row.sourceKind, ['upload', 'builtin', 'procedural']),
		sourceRef: readNullableString(row.sourceRef),
		mime: readNullableEnum(row.mime, ['image/png', 'image/webp', 'image/jpeg']),
		byteSize: readNullableByteSize(row.byteSize),
		sha256: readNullableSha256(row.sha256),
		importState: readEnum(row.importState, ['pending', 'ready', 'failed']),
		createdAt: readTimestamp(row.createdAt),
		updatedAt: readTimestamp(row.updatedAt)
	};
}

function readStoredAsset(row: AssetRow): StoredAsset {
	return { ...readAssetMetadata(row), objectKey: readNullableString(row.objectKey) };
}

function createObjectKey(projectId: string, assetId: string, objectNamespace: string): string {
	return `projects/${objectNamespace}/${projectId}/assets/${assetId}/${randomBytes(16).toString('hex')}`;
}

function readString(value: unknown): string {
	if (typeof value !== 'string' || value.length === 0) throw new Error('Asset row contained an invalid string');
	return value;
}

function readNullableString(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	return readString(value);
}

function readEnum<const Values extends readonly string[]>(value: unknown, values: Values): Values[number] {
	if (typeof value !== 'string' || !values.includes(value)) throw new Error('Asset row contained an invalid enum');
	return value as Values[number];
}

function readNullableEnum<const Values extends readonly string[]>(
	value: unknown,
	values: Values
): Values[number] | null {
	if (value === null || value === undefined) return null;
	return readEnum(value, values);
}

function readNullableByteSize(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	const result = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	if (!Number.isSafeInteger(result) || result < 1 || result > MAX_ASSET_BYTES) {
		throw new Error('Asset row contained an invalid byte size');
	}
	return result;
}

function readNullableSha256(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'string' || !/^sha256-[0-9a-f]{64}$/.test(value)) {
		throw new Error('Asset row contained an invalid SHA-256');
	}
	return value;
}

function readTimestamp(value: unknown): string {
	const date = value instanceof Date ? value : new Date(String(value));
	if (Number.isNaN(date.getTime())) throw new Error('Asset row contained an invalid timestamp');
	return date.toISOString();
}
