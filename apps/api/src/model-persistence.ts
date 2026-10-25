/**
 * Model resource storage (`T2.P02.S01`).
 *
 * A creator model is not an image asset: the image registry's mutable
 * `pending -> ready` row cannot carry a source file set, a provenance record or
 * an immutable revision. This module owns the separate lifecycle beside it:
 *
 * - **staging** — one import record per attempt, owned by the project and its
 *   owner, with the declared file set (paths, sizes, hashes) and the
 *   owner-accepted bounds. A declaration is not an upload: an upload whose
 *   stream disagrees with its declared hash or size is refused and not adopted.
 *   Unapproved staging expires after 24 hours and its bytes are deleted.
 * - **approval** — the server checks the structure of the source set and the
 *   derivative (never producing or transforming bytes), then creates or reuses
 *   one content-addressed immutable revision and returns its pins.
 * - **verification** — Save refuses a `model` resource whose pins do not name an
 *   approved revision of the same project.
 *
 * Approved bytes are read through this owner-only content route and are cacheable
 * because an approved revision never changes.
 */

import { createHash, randomUUID } from 'node:crypto';
import { PassThrough, Readable } from 'node:stream';

import {
	canonicalUnitJson,
	MODEL_DERIVATIVE_MAX_BYTES,
	MODEL_RESOURCE_MIME,
	MODEL_SOURCE_SET_MAX_BYTES,
	type ModelPlacement,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

import type { DatabasePool } from './database.js';
import { checkModelStructure } from './model-structure.js';
import type { ObjectStore } from './object-store.js';
import { queryRows, withTransaction } from './project-persistence.js';
import {
	DEFAULT_PROJECT_LIFECYCLE_POLICY,
	withProjectAdvisoryLock,
	withProjectWriteLease,
	type ProjectLifecyclePolicy,
	type ProjectWriteContext
} from './project-write-lease.js';

/** Unapproved staging is deleted after 24 hours, bytes included. */
const MODEL_STAGING_TTL_MS = 24 * 60 * 60 * 1000;

const SHA256_PATTERN = /^sha256-[0-9a-f]{64}$/;
const FILE_PATH_PATTERN = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

export type ModelFileRole = 'source' | 'derivative';

export type DeclaredModelFile = {
	readonly role: ModelFileRole;
	readonly path: string;
	readonly size: number;
	readonly hash: string;
};

export type ModelStagedFile = DeclaredModelFile & {
	readonly fileId: string;
	readonly uploadState: 'declared' | 'uploaded' | 'failed';
};

export type ModelImport = {
	readonly importId: string;
	readonly projectId: string;
	readonly state: 'staging' | 'approved' | 'cancelled' | 'expired';
	readonly expiresAt: string;
	readonly source: { readonly manifestHash: string; readonly size: number; readonly fileCount: number };
	readonly derivativeBytes: number;
	readonly recipe: { readonly id: string; readonly version: number };
	readonly files: readonly ModelStagedFile[];
};

export type ModelRevision = {
	readonly revisionId: string;
	readonly projectId: string;
	readonly contentHash: string;
	readonly derivative: { readonly hash: string; readonly mime: string; readonly size: number; readonly locator: string };
	readonly source: { readonly manifestHash: string; readonly size: number; readonly fileCount: number };
	readonly recipe: { readonly id: string; readonly version: number };
	readonly reportDigest: string;
	readonly placement: ModelPlacement;
};

export class ModelNotFoundError extends Error {
	constructor() {
		super('Model import or revision not found');
		this.name = 'ModelNotFoundError';
	}
}

export class ModelInputError extends Error {
	readonly statusCode: 400 | 409 | 411 | 413 | 415;
	readonly code:
		| 'invalid_model_import'
		| 'invalid_model_file'
		| 'invalid_upload'
		| 'length_required'
		| 'payload_too_large'
		| 'unsupported_media_type'
		| 'model_not_ready'
		| 'model_structure_refused';

	constructor(code: ModelInputError['code'], statusCode: ModelInputError['statusCode'], message: string) {
		super(message);
		this.name = 'ModelInputError';
		this.code = code;
		this.statusCode = statusCode;
	}
}

/**
 * Save refuses an envelope whose `model` resource names bytes this project has
 * not approved. A typed refusal, never a generic validation error: the caller
 * must be able to tell an unapproved pin from an invalid envelope.
 */
export class ModelPinRefusalError extends Error {
	readonly code = 'unapproved_model_resource' as const;
	readonly issues: readonly { path: string; code: string; message: string }[];

	constructor(message: string, issues: readonly { path: string; code: string; message: string }[] = []) {
		super(message);
		this.name = 'ModelPinRefusalError';
		this.issues = issues;
	}
}

type ImportRow = {
	importId: unknown;
	projectId: unknown;
	state: unknown;
	expiresAt: unknown;
	sourceManifestHash: unknown;
	sourceBytes: unknown;
	derivativeBytes: unknown;
	recipeId: unknown;
	recipeVersion: unknown;
};

type FileRow = {
	importId: unknown;
	fileId: unknown;
	role: unknown;
	path: unknown;
	byteSize: unknown;
	sha256: unknown;
	objectKey: unknown;
	uploadState: unknown;
};

type RevisionRow = {
	id: unknown;
	projectId: unknown;
	contentHash: unknown;
	derivativeHash: unknown;
	derivativeMime: unknown;
	derivativeBytes: unknown;
	derivativeKey: unknown;
	sourceManifestHash: unknown;
	sourceBytes: unknown;
	sourceFileCount: unknown;
	recipeId: unknown;
	recipeVersion: unknown;
	reportDigest: unknown;
	placement: unknown;
};

function importColumns(prefix: string): string {
	const c = (name: string) => `${prefix}${name}`;
	return `
	${c('id')} AS "importId",
	${c('project_id')} AS "projectId",
	${c('state')},
	${c('expires_at')} AS "expiresAt",
	${c('source_manifest_hash')} AS "sourceManifestHash",
	${c('source_bytes')} AS "sourceBytes",
	${c('derivative_bytes')} AS "derivativeBytes",
	${c('recipe_id')} AS "recipeId",
	${c('recipe_version')} AS "recipeVersion"`;
}

const IMPORT_COLUMNS = importColumns('i.');

function fileColumns(prefix: string): string {
	const c = (name: string) => `${prefix}${name}`;
	return `
	${c('import_id')} AS "importId",
	${c('file_id')} AS "fileId",
	${c('role')},
	${c('path')},
	${c('byte_size')} AS "byteSize",
	${c('sha256')},
	${c('object_key')} AS "objectKey",
	${c('upload_state')} AS "uploadState"`;
}

const FILE_COLUMNS = fileColumns('f.');

function revisionColumns(prefix: string): string {
	const c = (name: string) => `${prefix}${name}`;
	return `
	${c('id')},
	${c('project_id')} AS "projectId",
	${c('content_hash')} AS "contentHash",
	${c('derivative_hash')} AS "derivativeHash",
	${c('derivative_mime')} AS "derivativeMime",
	${c('derivative_bytes')} AS "derivativeBytes",
	${c('derivative_key')} AS "derivativeKey",
	${c('source_manifest_hash')} AS "sourceManifestHash",
	${c('source_bytes')} AS "sourceBytes",
	${c('source_file_count')} AS "sourceFileCount",
	${c('recipe_id')} AS "recipeId",
	${c('recipe_version')} AS "recipeVersion",
	${c('report_digest')} AS "reportDigest",
	${c('placement')}`;
}

const REVISION_COLUMNS = revisionColumns('r.');
const REVISION_RETURNING = revisionColumns('');

/** Strict declaration read: bounds, one derivative and unique safe paths. */
export function readModelImportBody(input: unknown): {
	readonly files: readonly DeclaredModelFile[];
	readonly recipe: { readonly id: string; readonly version: number };
} {
	if (!isRecord(input) || !Array.isArray(input.files) || !isRecord(input.recipe)) {
		throw new ModelInputError('invalid_model_import', 400, 'Expected files and recipe');
	}
	if (Object.keys(input).some((key) => key !== 'files' && key !== 'recipe')) {
		throw new ModelInputError('invalid_model_import', 400, 'Unexpected model import field');
	}
	const recipeId = input.recipe.id;
	const recipeVersion = input.recipe.version;
	if (
		typeof recipeId !== 'string' ||
		recipeId.length === 0 ||
		recipeId.length > 128 ||
		recipeId !== recipeId.trim() ||
		Object.keys(input.recipe).some((key) => key !== 'id' && key !== 'version')
	) {
		throw new ModelInputError('invalid_model_import', 400, 'Invalid model recipe');
	}
	if (typeof recipeVersion !== 'number' || !Number.isSafeInteger(recipeVersion) || recipeVersion < 1) {
		throw new ModelInputError('invalid_model_import', 400, 'Invalid model recipe version');
	}

	const files: DeclaredModelFile[] = [];
	const paths = new Set<string>();
	let derivativeCount = 0;
	for (const entry of input.files) {
		if (!isRecord(entry)) throw new ModelInputError('invalid_model_import', 400, 'Invalid declared model file');
		const role = entry.role;
		const path = entry.path;
		const size = entry.size;
		const hash = entry.hash;
		if (role !== 'source' && role !== 'derivative') {
			throw new ModelInputError('invalid_model_import', 400, 'A declared model file is a source or the derivative');
		}
		if (typeof path !== 'string' || !FILE_PATH_PATTERN.test(path) || path.includes('..') || path.length > 256) {
			throw new ModelInputError('invalid_model_import', 400, 'Invalid declared model file path');
		}
		if (paths.has(path)) throw new ModelInputError('invalid_model_import', 400, 'A declared model file path repeats');
		paths.add(path);
		if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 1) {
			throw new ModelInputError('invalid_model_import', 400, 'Invalid declared model file size');
		}
		if (typeof hash !== 'string' || !SHA256_PATTERN.test(hash)) {
			throw new ModelInputError('invalid_model_import', 400, 'Invalid declared model file hash');
		}
		if (role === 'derivative') {
			derivativeCount += 1;
			if (size > MODEL_DERIVATIVE_MAX_BYTES) {
				throw new ModelInputError('payload_too_large', 413, 'The derivative exceeds its 25 MiB bound');
			}
		}
		files.push({ role, path, size, hash });
	}
	if (derivativeCount !== 1) {
		throw new ModelInputError('invalid_model_import', 400, 'An import declares exactly one derivative');
	}
	const sourceFiles = files.filter((file) => file.role === 'source');
	if (sourceFiles.length === 0) {
		throw new ModelInputError('invalid_model_import', 400, 'An import declares at least one source file');
	}
	const sourceBytes = sourceFiles.reduce((total, file) => total + file.size, 0);
	if (sourceBytes > MODEL_SOURCE_SET_MAX_BYTES) {
		throw new ModelInputError('payload_too_large', 413, 'The source file set exceeds its 50 MiB bound');
	}
	return { files, recipe: { id: recipeId, version: recipeVersion } };
}

/** Strict approval body read: the confirmed report digest and placement. */
export function readModelApprovalBody(input: unknown): {
	readonly reportDigest: string;
	readonly placement: ModelPlacement;
} {
	if (!isRecord(input) || !isRecord(input.placement)) {
		throw new ModelInputError('invalid_model_import', 400, 'Expected reportDigest and placement');
	}
	if (Object.keys(input).some((key) => key !== 'reportDigest' && key !== 'placement')) {
		throw new ModelInputError('invalid_model_import', 400, 'Unexpected approval field');
	}
	const reportDigest = input.reportDigest;
	if (typeof reportDigest !== 'string' || !SHA256_PATTERN.test(reportDigest)) {
		throw new ModelInputError('invalid_model_import', 400, 'Invalid ingest report digest');
	}
	const placement = input.placement;
	if (Object.keys(placement).some((key) => !['metresPerSourceUnit', 'pivot', 'footprint', 'contactMinY', 'placement'].includes(key))) {
		throw new ModelInputError('invalid_model_import', 400, 'Unexpected placement field');
	}
	const metresPerSourceUnit = placement.metresPerSourceUnit;
	if (typeof metresPerSourceUnit !== 'number' || !Number.isFinite(metresPerSourceUnit) || metresPerSourceUnit <= 0) {
		throw new ModelInputError('invalid_model_import', 400, 'Placement scale must be finite and greater than zero');
	}
	const pivot = placement.pivot;
	if (
		!Array.isArray(pivot) ||
		pivot.length !== 3 ||
		pivot.some((value) => typeof value !== 'number' || !Number.isFinite(value))
	) {
		throw new ModelInputError('invalid_model_import', 400, 'Placement pivot must be three finite metres');
	}
	const footprint = placement.footprint;
	if (!isRecord(footprint)) throw new ModelInputError('invalid_model_import', 400, 'Placement footprint is required');
	if (Object.keys(footprint).some((key) => key !== 'width' && key !== 'depth')) {
		throw new ModelInputError('invalid_model_import', 400, 'Unexpected footprint field');
	}
	const width = footprint.width;
	const depth = footprint.depth;
	if (
		typeof width !== 'number' ||
		typeof depth !== 'number' ||
		!Number.isFinite(width) ||
		!Number.isFinite(depth) ||
		width <= 0 ||
		depth <= 0
	) {
		throw new ModelInputError('invalid_model_import', 400, 'Placement footprint must be positive metres');
	}
	const contactMinY = placement.contactMinY;
	if (typeof contactMinY !== 'number' || !Number.isFinite(contactMinY)) {
		throw new ModelInputError('invalid_model_import', 400, 'Placement contact must be a finite metre value');
	}
	if (placement.placement !== 'floor') {
		throw new ModelInputError('invalid_model_import', 400, 'Only floor placement is admitted');
	}
	return {
		reportDigest,
		placement: {
			metresPerSourceUnit,
			pivot: [pivot[0] as number, pivot[1] as number, pivot[2] as number],
			footprint: { width, depth },
			contactMinY,
			placement: 'floor'
		}
	};
}

/** The server-computed manifest hash: the retained source pin. */
export function modelSourceManifestHash(files: readonly DeclaredModelFile[]): string {
	const manifest = files
		.filter((file) => file.role === 'source')
		.map((file) => ({ path: file.path, size: file.size, hash: file.hash }))
		.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
	return sha256(`model-source-manifest:${canonicalUnitJson(manifest)}`);
}

/**
 * Delete one project's expired staging, bytes included.
 *
 * There is no background worker in this service: expiry is enforced whenever the
 * owner next touches the project's imports, which is bounded, idempotent and
 * observable. An approved revision is never touched.
 */
export async function expireStaleModelImports(
	db: Pick<DatabasePool, 'query'>,
	objectStore: ObjectStore | undefined,
	projectId: string,
	ownerId: string
): Promise<number> {
	const stale = await queryRows<{ importId: unknown }>(
		db,
		`SELECT i.id AS "importId"
FROM model_imports i
WHERE i.project_id = $1 AND i.owner_id = $2 AND i.state = 'staging' AND i.expires_at <= now()`,
		[projectId, ownerId]
	);
	if (stale.length === 0) return 0;
	const ids = stale.map((row) => readString(row.importId));
	await deleteStagedObjects(db, objectStore, ids);
	const removed = await queryRows<{ id: unknown }>(
		db,
		`DELETE FROM model_imports
WHERE project_id = $1 AND owner_id = $2 AND state = 'staging' AND id = ANY ($3::uuid[])
RETURNING id`,
		[projectId, ownerId, ids]
	);
	return removed.length;
}

/** Create one staging record. Nothing is approved and no revision exists yet. */
export async function createModelImport(
	pool: DatabasePool,
	ownerId: string,
	projectId: string,
	body: unknown,
	objectStore: ObjectStore | undefined
): Promise<ModelImport> {
	const declaration = readModelImportBody(body);
	await expireStaleModelImports(pool, objectStore, projectId, ownerId);
	const importId = randomUUID();
	const sourceFiles = declaration.files.filter((file) => file.role === 'source');
	const derivative = declaration.files.find((file) => file.role === 'derivative')!;
	const manifestHash = modelSourceManifestHash(declaration.files);
	const sourceBytes = sourceFiles.reduce((total, file) => total + file.size, 0);

	return withTransaction(pool, async (db) => {
		const inserted = await queryRows<ImportRow>(
			db,
			`INSERT INTO model_imports (
	id, project_id, owner_id, recipe_id, recipe_version,
	source_manifest_hash, source_bytes, derivative_bytes, state, expires_at
)
SELECT $1::uuid, p.id, $2, $4, $5, $6, $7, $8, 'staging', now() + $9::interval
FROM projects p
WHERE p.id = $3 AND p.owner_id = $2			RETURNING ${importColumns('')}`,
			[
				importId,
				ownerId,
				projectId,
				declaration.recipe.id,
				declaration.recipe.version,
				manifestHash,
				sourceBytes,
				derivative.size,
				`${MODEL_STAGING_TTL_MS} milliseconds`
			]
		);
		const row = inserted[0];
		if (!row) throw new ModelNotFoundError();
		for (const file of declaration.files) {
			await db.query(
				`INSERT INTO model_import_files (import_id, file_id, role, path, byte_size, sha256, upload_state)
VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, 'declared')`,
				[importId, randomUUID(), file.role, file.path, file.size, file.hash]
			);
		}
		return importOf(row, await readImportFiles(db, importId));
	});
}

/** Read one staging/approved import the owner owns; expired staging is deleted. */
export async function readStagingImport(
	db: Pick<DatabasePool, 'query'>,
	ownerId: string,
	projectId: string,
	importId: string
): Promise<{ readonly record: ImportRow; readonly files: readonly FileRow[] }> {
	const rows = await queryRows<ImportRow & { ownerId: unknown }>(
		db,
		`SELECT ${IMPORT_COLUMNS}
FROM model_imports i
JOIN projects p ON p.id = i.project_id
WHERE i.id = $1::uuid AND i.project_id = $2 AND i.owner_id = $3 AND p.owner_id = $3`,
		[importId, projectId, ownerId]
	);
	const row = rows[0];
	if (!row) throw new ModelNotFoundError();
	return { record: row, files: await readImportFiles(db, importId) };
}

async function readImportFiles(db: Pick<DatabasePool, 'query'>, importId: string): Promise<readonly FileRow[]> {
	return queryRows<FileRow>(
		db,
		`SELECT ${FILE_COLUMNS}
FROM model_import_files f
WHERE f.import_id = $1::uuid
ORDER BY f.role ASC, f.path ASC`,
		[importId]
	);
}

/** Stream one declared file, hashing and bounding it against its declaration. */
export async function uploadModelFile(
	pool: DatabasePool,
	ownerId: string,
	projectId: string,
	importId: string,
	fileId: string,
	contentLength: number,
	body: Readable,
	objectStore: ObjectStore | undefined,
	objectNamespace: string,
	options: { parentSignal?: AbortSignal; policy?: ProjectLifecyclePolicy } = {}
): Promise<ModelStagedFile> {
	if (!objectStore) throw new Error('Object storage is unavailable');
	// An upload is an owner touch: an overdue import is deleted with its bytes
	// before any byte is accepted, exactly as creation and approval sweep it.
	await expireStaleModelImports(pool, objectStore, projectId, ownerId);
	const { record, files } = await readStagingImport(pool, ownerId, projectId, importId);
	const file = files.find((candidate) => readString(candidate.fileId) === fileId);
	if (!file) throw new ModelNotFoundError();
	if (readString(record.state) !== 'staging') {
		throw new ModelInputError('invalid_model_import', 400, 'This import is no longer accepting files');
	}
	const declaredSize = readSafeInteger(file.byteSize);
	if (contentLength !== declaredSize) {
		throw new ModelInputError('invalid_upload', 400, 'Upload length does not match the declared file size');
	}
	const declaredRole = readString(file.role);
	const limit = declaredRole === 'derivative' ? MODEL_DERIVATIVE_MAX_BYTES : MODEL_SOURCE_SET_MAX_BYTES;
	if (contentLength > limit) throw new ModelInputError('payload_too_large', 413, 'Payload Too Large');

	const objectKey = modelFileKey(projectId, objectNamespace, importId, fileId);
	return withProjectWriteLease(
		pool,
		ownerId,
		projectId,
		async ({ signal, assertActive }) => {
			const claimed = await queryRows<FileRow>(
				pool,
				`UPDATE model_import_files f
SET object_key = $4, upload_state = 'uploading', uploaded_at = NULL
FROM model_imports i
WHERE f.import_id = $1::uuid AND f.file_id = $2::uuid AND i.id = f.import_id
	AND i.project_id = $3 AND i.owner_id = $5 AND i.state = 'staging'
	AND f.upload_state IN ('declared','failed')
RETURNING ${FILE_COLUMNS}`,
				[importId, fileId, projectId, objectKey, ownerId]
			);
			if (!claimed[0]) {
				throw new ModelInputError('invalid_model_import', 409, 'This file is already uploaded or uploading');
			}

			let uploaded: { byteSize: number; sha256: string };
			try {
				uploaded = await streamModelFile(body, contentLength, objectStore, objectKey, signal);
			} catch (error) {
				try {
					await pool.query(
						`UPDATE model_import_files f
SET upload_state = 'failed', object_key = NULL, uploaded_at = NULL
WHERE f.import_id = $1::uuid AND f.file_id = $2::uuid`,
						[importId, fileId]
					);
				} catch {
					// The inventory can still find the key if the staging-state update fails.
				}
				await deleteObject(objectStore, objectKey);
				throw error;
			}

			const declaredHash = readString(file.sha256);
			if (uploaded.byteSize !== declaredSize || uploaded.sha256 !== declaredHash) {
				try {
					await pool.query(
						`UPDATE model_import_files f
SET upload_state = 'failed', object_key = NULL, uploaded_at = NULL
WHERE f.import_id = $1::uuid AND f.file_id = $2::uuid`,
						[importId, fileId]
					);
				} catch {
					// Keep going with compensation; a failed row update is independently visible.
				}
				await deleteObject(objectStore, objectKey);
				throw new ModelInputError(
					'invalid_model_file',
					400,
					'The uploaded bytes disagree with the declared hash or size'
				);
			}

			try {
				assertActive();
			} catch (error) {
				await deleteObject(objectStore, objectKey);
				throw error;
			}
			let marked: FileRow[];
			try {
				marked = await queryRows<FileRow>(
					pool,
					`UPDATE model_import_files f
SET upload_state = 'uploaded', uploaded_at = now()
WHERE f.import_id = $1::uuid AND f.file_id = $2::uuid
	AND f.upload_state = 'uploading' AND f.object_key = $3
RETURNING ${FILE_COLUMNS}`,
					[importId, fileId, objectKey]
				);
			} catch (error) {
				// A connection can fail after the UPDATE committed. Keep the bytes only
				// when a read confirms that an uploaded row owns this exact key.
				let referenced = false;
				try {
					const current = await queryRows<{ objectKey: unknown; uploadState: unknown }>(
						pool,
						`SELECT object_key AS "objectKey", upload_state AS "uploadState"
FROM model_import_files WHERE import_id = $1::uuid AND file_id = $2::uuid`,
						[importId, fileId]
					);
					const row = current[0];
					referenced = row?.objectKey === objectKey && row.uploadState === 'uploaded';
					if (row?.objectKey === objectKey && row.uploadState === 'uploading') {
						try {
							await pool.query(
								`UPDATE model_import_files SET upload_state = 'failed', object_key = NULL, uploaded_at = NULL
WHERE import_id = $1::uuid AND file_id = $2::uuid AND object_key = $3 AND upload_state = 'uploading'`,
								[importId, fileId, objectKey]
							);
						} catch {
							// The selected row was still uploading, so its bytes are not adopted.
						}
					}
				} catch {
					referenced = true;
				}
				if (!referenced) await deleteObject(objectStore, objectKey);
				throw error;
			}
			if (!marked[0]) {
				await deleteObject(objectStore, objectKey);
				throw new ModelNotFoundError();
			}
			return {
				fileId,
				role: declaredRole as ModelFileRole,
				path: readString(file.path),
				size: declaredSize,
				hash: declaredHash,
				uploadState: 'uploaded'
			};
		},
		{ parentSignal: options.parentSignal, policy: options.policy ?? DEFAULT_PROJECT_LIFECYCLE_POLICY }
	);
}

/** Cancel one staging record and delete every staged byte. */
export async function cancelModelImport(
	pool: DatabasePool,
	ownerId: string,
	projectId: string,
	importId: string,
	objectStore: ObjectStore | undefined
): Promise<void> {
	const { record } = await readStagingImport(pool, ownerId, projectId, importId);
	if (readString(record.state) === 'approved') {
		throw new ModelInputError('invalid_model_import', 409, 'An approved revision cannot be cancelled');
	}
	await deleteStagedObjects(pool, objectStore, [importId]);
	await pool.query(
		`DELETE FROM model_imports i
WHERE i.id = $1::uuid AND i.project_id = $2 AND i.owner_id = $3 AND i.state <> 'approved'`,
		[importId, projectId, ownerId]
	);
}

/**
 * Approve one fully uploaded staging record.
 *
 * Structure is checked before anything is written; the revision row is created or
 * reused atomically by `(project_id, content_hash)`, and the staged bytes are
 * promoted to their immutable revision keys before the staging copy is deleted.
 */
export async function approveModelImport(
	pool: DatabasePool,
	ownerId: string,
	projectId: string,
	importId: string,
	body: unknown,
	objectStore: ObjectStore | undefined,
	objectNamespace: string,
	options: { parentSignal?: AbortSignal; policy?: ProjectLifecyclePolicy } = {}
): Promise<ModelRevision> {
	if (!objectStore) throw new Error('Object storage is unavailable');
	await expireStaleModelImports(pool, objectStore, projectId, ownerId);
	const approval = readModelApprovalBody(body);
	const { record, files } = await readStagingImport(pool, ownerId, projectId, importId);
	const state = readString(record.state);
	if (state === 'approved') {
		const revisionId = await readApprovedRevisionId(pool, importId);
		const existing = await readRevisionById(pool, projectId, revisionId);
		if (!existing) throw new ModelNotFoundError();
		return revisionOf(existing);
	}
	if (state !== 'staging') throw new ModelInputError('invalid_model_import', 409, 'This import is not staging');
	if (files.length === 0 || files.some((file) => readString(file.uploadState) !== 'uploaded')) {
		throw new ModelInputError('model_not_ready', 409, 'Every declared file must be uploaded before approval');
	}

	const bytes = new Map<string, Buffer>();
	for (const file of files) {
		const key = readNullableString(file.objectKey);
		if (key === null) throw new ModelInputError('model_not_ready', 409, 'A declared file has no staged bytes');
		const limit = readString(file.role) === 'derivative' ? MODEL_DERIVATIVE_MAX_BYTES : MODEL_SOURCE_SET_MAX_BYTES;
		const buffer = await readObjectBytes(objectStore, key, limit);
		if (buffer.length !== readSafeInteger(file.byteSize) || bufferSha256(buffer) !== readString(file.sha256)) {
			throw new ModelInputError('model_not_ready', 409, 'A staged file no longer matches its declaration');
		}
		bytes.set(key, buffer);
	}
	const sourceFiles = files
		.filter((file) => readString(file.role) === 'source')
		.map((file) => ({ path: readString(file.path), bytes: bytes.get(readString(file.objectKey))! }));
	const derivativeFile = files.find((file) => readString(file.role) === 'derivative')!;
	const derivativeBytes = bytes.get(readString(derivativeFile.objectKey))!;

	const structureIssues = checkModelStructure({ sourceFiles, derivative: derivativeBytes });
	if (structureIssues.length > 0) {
		const first = structureIssues[0]!;
		throw new ModelInputError('model_structure_refused', 400, `${first.code}: ${first.message}`);
	}

	const derivativeHash = readString(derivativeFile.sha256);
	const sourceManifestHash = readString(record.sourceManifestHash);
	const revisionContent = {
		derivative: { hash: derivativeHash, size: readSafeInteger(derivativeFile.byteSize) },
		source: {
			manifestHash: sourceManifestHash,
			size: readSafeInteger(record.sourceBytes),
			fileCount: files.filter((file) => readString(file.role) === 'source').length
		},
		recipe: { id: readString(record.recipeId), version: readSafeInteger(record.recipeVersion) },
		reportDigest: approval.reportDigest,
		placement: approval.placement
	};
	const contentHash = sha256(`model-revision:${canonicalUnitJson(revisionContent)}`);
	const derivativeKey = modelRevisionKey(projectId, objectNamespace, contentHash, 'derivative.glb');
	const sourcePaths = sourceFiles.map((file) => file.path);
	const sourceKeys = revisionObjectKeys(projectId, objectNamespace, contentHash, sourcePaths);

	return withProjectWriteLease(
		pool,
		ownerId,
		projectId,
		async (lease) =>
			withProjectAdvisoryLock(pool, 'model-approval', `${projectId}:${contentHash}`, async () => {
				lease.assertActive();
				// The per-content lock is held through writes, finalization and any
				// compensation. A second identical approval therefore observes the
				// committed winner before considering deletion of shared keys.
				let row = (
					await queryRows<RevisionRow>(
						pool,
						`SELECT ${REVISION_COLUMNS} FROM model_revisions r WHERE r.project_id = $1 AND r.content_hash = $2`,
						[projectId, contentHash]
					)
				)[0];
				if (row) {
					await markImportApproved(pool, ownerId, projectId, importId, readString(row.id), lease);
					await deleteStagedObjects(pool, objectStore, [importId]);
					return revisionOf(row);
				}

				const writtenKeys = [derivativeKey, ...sourceKeys];
				try {
					lease.assertActive();
					await putBytes(objectStore, derivativeKey, derivativeBytes, MODEL_RESOURCE_MIME, lease.signal);
					for (let index = 0; index < sourceFiles.length; index += 1) {
						lease.assertActive();
						const file = sourceFiles[index]!;
						await putBytes(
							objectStore,
							sourceKeys[index]!,
							file.bytes,
							'application/octet-stream',
							lease.signal
						);
					}
					lease.assertActive();

					row = await withTransaction(pool, async (db) => {
						lease.assertActive();
						const revisionId = randomUUID();
						const inserted = await queryRows<RevisionRow>(
							db,
							`INSERT INTO model_revisions (
	id, project_id, content_hash, derivative_hash, derivative_mime, derivative_bytes, derivative_key,
	source_manifest_hash, source_bytes, source_file_count, recipe_id, recipe_version, report_digest, placement, source_keys
)
VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
ON CONFLICT (project_id, content_hash) DO NOTHING
RETURNING ${REVISION_RETURNING}`,
							[
								revisionId,
								projectId,
								contentHash,
								derivativeHash,
								MODEL_RESOURCE_MIME,
								revisionContent.derivative.size,
								derivativeKey,
								sourceManifestHash,
								revisionContent.source.size,
								revisionContent.source.fileCount,
								revisionContent.recipe.id,
								revisionContent.recipe.version,
								approval.reportDigest,
								JSON.stringify(approval.placement),
								JSON.stringify(sourceKeys)
							]
						);
						const persisted = inserted[0] ??
							(await queryRows<RevisionRow>(
								db,
								`SELECT ${REVISION_COLUMNS} FROM model_revisions r WHERE r.project_id = $1 AND r.content_hash = $2 FOR UPDATE`,
								[projectId, contentHash]
							))[0];
						if (!persisted) throw new Error('Model revision approval returned no row');
						lease.assertActive();
						const approved = await queryRows<{ id: unknown }>(
							db,
							`UPDATE model_imports
SET state = 'approved', revision_id = $4::uuid
WHERE id = $1::uuid AND project_id = $2 AND owner_id = $3
				AND (state = 'staging' OR (state = 'approved' AND revision_id = $4::uuid))
RETURNING id`,
							[importId, projectId, ownerId, readString(persisted.id)]
						);
						if (!approved[0]) throw new ModelNotFoundError();
						return persisted;
					});
				} catch (error) {
					// A commit error can be ambiguous. Preserve deterministic keys if a
					// revision row exists or the database cannot prove it does not.
					let referenced = true;
					try {
						referenced =
							(
								await queryRows<{ id: unknown }>(
									pool,
									`SELECT id FROM model_revisions WHERE project_id = $1 AND content_hash = $2`,
									[projectId, contentHash]
								)
							).length > 0;
					} catch {
						referenced = true;
					}
					if (!referenced) {
						for (const key of writtenKeys) await deleteObject(objectStore, key);
					}
					throw error;
				}

				if (!row) throw new Error('Model revision approval returned no row');
				await deleteStagedObjects(pool, objectStore, [importId]);
				return revisionOf(row);
			}),
		{ parentSignal: options.parentSignal, policy: options.policy ?? DEFAULT_PROJECT_LIFECYCLE_POLICY }
	);
}

/** The immutable revision bytes a hash-keyed read serves; owner-scoped. */
export async function readModelRevisionContent(
	db: Pick<DatabasePool, 'query'>,
	ownerId: string,
	projectId: string,
	derivativeHash: string
): Promise<{ readonly objectKey: string; readonly mime: string; readonly size: number; readonly contentHash: string }> {
	if (!SHA256_PATTERN.test(derivativeHash)) throw new ModelNotFoundError();
	const rows = await queryRows<RevisionRow>(
		db,
		`SELECT ${REVISION_COLUMNS}
FROM model_revisions r
JOIN projects p ON p.id = r.project_id
WHERE r.project_id = $1 AND r.derivative_hash = $2 AND p.owner_id = $3
ORDER BY r.created_at ASC
LIMIT 1`,
		[projectId, derivativeHash, ownerId]
	);
	const row = rows[0];
	if (!row) throw new ModelNotFoundError();
	return {
		objectKey: readString(row.derivativeKey),
		mime: readString(row.derivativeMime),
		size: readSafeInteger(row.derivativeBytes),
		contentHash: readString(row.contentHash)
	};
}

/**
 * Save verification: every `model` resource must name an approved revision of
 * the same project whose retained content agrees with its pins.
 *
 * The check reads only the project's own revisions, so a foreign project's
 * revision can never satisfy a pin even when the bytes are identical.
 */
export async function verifyModelResourcePins(
	db: Pick<DatabasePool, 'query'>,
	projectId: string,
	envelope: ProjectEnvelope
): Promise<void> {
	const resources = envelope.units.resources.data.resources;
	if (!resources.some((resource) => resource.kind === 'model')) return;
	const issues: { path: string; code: string; message: string }[] = [];
	// The issue path names the registry index, so every resource is walked and
	// only models are checked.
	for (const [index, resource] of resources.entries()) {
		if (resource.kind !== 'model') continue;
		const path = `$.units.resources.data.resources[${index}]`;
		const pin = resource.pin;
		const model = resource.model;
		if (pin === null || model === undefined) {
			issues.push({ path, code: 'unapproved_model_resource', message: 'a model resource must carry an approved derivative pin and its detail' });
			continue;
		}
		const rows = await queryRows<RevisionRow>(
			db,
			`SELECT ${REVISION_COLUMNS}
FROM model_revisions r
WHERE r.project_id = $1 AND r.derivative_hash = $2`,
			[projectId, pin.hash]
		);
		const match = rows.find((row) => {
			const placement = readPlacement(row.placement);
			return (
				readString(row.derivativeMime) === pin.mime &&
				readSafeInteger(row.derivativeBytes) === pin.size &&
				readString(row.sourceManifestHash) === model.source.manifestHash &&
				readSafeInteger(row.sourceBytes) === model.source.size &&
				readSafeInteger(row.sourceFileCount) === model.source.fileCount &&
				readString(row.recipeId) === model.recipe.id &&
				readSafeInteger(row.recipeVersion) === model.recipe.version &&
				readString(row.reportDigest) === model.reportDigest &&
				canonicalUnitJson(placement) === canonicalUnitJson(model.placement)
			);
		});
		const locatorMatches = pin.locator === modelRevisionLocator(projectId, pin.hash);
		if (!match || !locatorMatches) {
			issues.push({
				path,
				code: 'unapproved_model_resource',
				message: `model resource "${resource.id}" does not name an approved revision of this project`
			});
		}
	}
	if (issues.length > 0) {
		throw new ModelPinRefusalError('The saved source names model bytes this project has not approved', issues);
	}
}

async function readApprovedRevisionId(db: Pick<DatabasePool, 'query'>, importId: string): Promise<string> {
	const rows = await queryRows<{ revisionId: unknown }>(
		db,
		`SELECT revision_id AS "revisionId" FROM model_imports WHERE id = $1::uuid`,
		[importId]
	);
	const revisionId = rows[0] ? readNullableString(rows[0].revisionId) : null;
	if (revisionId === null) throw new ModelNotFoundError();
	return revisionId;
}

async function readRevisionById(
	db: Pick<DatabasePool, 'query'>,
	projectId: string,
	revisionId: string
): Promise<RevisionRow | null> {
	const rows = await queryRows<RevisionRow>(
		db,
		`SELECT ${REVISION_COLUMNS} FROM model_revisions r WHERE r.project_id = $1 AND r.id = $2::uuid`,
		[projectId, revisionId]
	);
	return rows[0] ?? null;
}

async function deleteStagedObjects(
	db: Pick<DatabasePool, 'query'>,
	objectStore: ObjectStore | undefined,
	importIds: readonly string[]
): Promise<void> {
	if (objectStore === undefined) return;
	const rows = await queryRows<{ objectKey: unknown }>(
		db,
		`SELECT f.object_key AS "objectKey"
FROM model_import_files f
WHERE f.import_id = ANY ($1::uuid[]) AND f.object_key IS NOT NULL`,
		[importIds]
	);
	for (const row of rows) {
		const key = readNullableString(row.objectKey);
		if (key !== null) await deleteObject(objectStore, key);
	}
}

async function markImportApproved(
	pool: DatabasePool,
	ownerId: string,
	projectId: string,
	importId: string,
	revisionId: string,
	lease: ProjectWriteContext
): Promise<void> {
	await withTransaction(pool, async (db) => {
		lease.assertActive();
		const rows = await queryRows<{ id: unknown }>(
			db,
			`UPDATE model_imports
SET state = 'approved', revision_id = $4::uuid
WHERE id = $1::uuid AND project_id = $2 AND owner_id = $3
	AND (state = 'staging' OR (state = 'approved' AND revision_id = $4::uuid))
RETURNING id`,
			[importId, projectId, ownerId, revisionId]
		);
		if (!rows[0]) throw new ModelNotFoundError();
		lease.assertActive();
	});
}

async function deleteObject(objectStore: ObjectStore, key: string): Promise<void> {
	try {
		await objectStore.delete?.(key);
	} catch {
		// The staging row is what admits the bytes; a failed delete leaves an orphan
		// for the namespace purge rather than failing the owner's request.
	}
}

async function putBytes(
	objectStore: ObjectStore,
	key: string,
	bytes: Buffer,
	contentType: string,
	signal: AbortSignal
): Promise<void> {
	await objectStore.put(key, Readable.from(bytes), { contentType, contentLength: bytes.length, signal });
}

function bufferSha256(bytes: Buffer): string {
	return `sha256-${createHash('sha256').update(bytes as unknown as Uint8Array<ArrayBuffer>).digest('hex')}`;
}

async function readObjectBytes(objectStore: ObjectStore, key: string, limit: number): Promise<Buffer> {
	const stored = await objectStore.get(key);
	if (!stored) throw new ModelInputError('model_not_ready', 409, 'A staged byte stream is missing');
	if (stored.contentLength > limit) throw new ModelInputError('payload_too_large', 413, 'Staged bytes exceed their bound');
	const chunks: Buffer[] = [];
	let total = 0;
	for await (const chunk of stored.body) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
		total += buffer.length;
		if (total > limit) throw new ModelInputError('payload_too_large', 413, 'Staged bytes exceed their bound');
		chunks.push(buffer);
	}
	const bytes = Buffer.allocUnsafe(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	return bytes;
}

async function streamModelFile(
	source: Readable,
	contentLength: number,
	objectStore: ObjectStore,
	key: string,
	signal: AbortSignal
): Promise<{ byteSize: number; sha256: string }> {
	const output = new PassThrough();
	output.on('error', () => {});
	const hash = createHash('sha256');
	let byteSize = 0;
	let putPromise: Promise<void> | undefined;
	let storageError: unknown;
	const onAbort = () => {
		const error = signal.reason instanceof Error ? signal.reason : new Error('Model write aborted');
		source.destroy(error);
		output.destroy(error);
	};
	signal.addEventListener('abort', onAbort, { once: true });
	if (signal.aborted) onAbort();
	putPromise = objectStore
		.put(key, output, { contentType: 'application/octet-stream', contentLength, signal })
		.catch((error) => {
			storageError = error;
			output.destroy(error instanceof Error ? error : new Error('Model storage failed'));
			throw error;
		});
	try {
		for await (const value of source) {
			const chunk = toBuffer(value);
			byteSize += chunk.length;
			if (byteSize > contentLength) {
				throw new ModelInputError('invalid_upload', 400, 'Upload length does not match Content-Length');
			}
			hash.update(chunk as unknown as Uint8Array<ArrayBuffer>);
			await writeChunk(output, chunk);
		}
		if (byteSize !== contentLength) {
			throw new ModelInputError('invalid_upload', 400, 'Upload length does not match Content-Length');
		}
		output.end();
		await putPromise;
		signal.removeEventListener('abort', onAbort);
		return { byteSize, sha256: `sha256-${hash.digest('hex')}` };
	} catch (error) {
		const reported = signal.aborted
			? signal.reason instanceof Error
				? signal.reason
				: new Error('Model write aborted')
			: error instanceof ModelInputError || storageError
				? error
				: new ModelInputError('invalid_upload', 400, 'Upload stream failed');
		source.destroy(error instanceof Error ? error : new Error('Model upload failed'));
		output.destroy(error instanceof Error ? error : new Error('Model upload failed'));
		try {
			await putPromise;
		} catch {
			// The route reports the original bounded upload/storage error.
		}
		signal.removeEventListener('abort', onAbort);
		throw reported;
	}
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
	throw new ModelInputError('invalid_upload', 400, 'Upload stream yielded a non-byte chunk');
}

function modelFileKey(projectId: string, namespace: string, importId: string, fileId: string): string {
	return `projects/${namespace}/${projectId}/models/imports/${importId}/${fileId}`;
}

export function revisionObjectKeys(
	projectId: string,
	namespace: string,
	contentHash: string,
	sourcePaths: readonly string[]
): string[] {
	return sourcePaths.map((path) => {
		if (!FILE_PATH_PATTERN.test(path) || path.includes('..')) {
			throw new Error('Approved source path is malformed');
		}
		return modelRevisionKey(projectId, namespace, contentHash, `source/${path}`);
	});
}

function modelRevisionKey(projectId: string, namespace: string, contentHash: string, name: string): string {
	return `projects/${namespace}/${projectId}/models/revisions/${contentHash}/${name}`;
}

function sha256(value: string): string {
	return `sha256-${createHash('sha256').update(value).digest('hex')}`;
}

function importOf(row: ImportRow, files: readonly FileRow[]): ModelImport {
	return {
		importId: readString(row.importId),
		projectId: readString(row.projectId),
		state: readEnum(row.state, ['staging', 'approved', 'cancelled', 'expired']),
		expiresAt: readTimestamp(row.expiresAt),
		source: {
			manifestHash: readString(row.sourceManifestHash),
			size: readSafeInteger(row.sourceBytes),
			fileCount: files.filter((file) => readString(file.role) === 'source').length
		},
		derivativeBytes: readSafeInteger(row.derivativeBytes),
		recipe: { id: readString(row.recipeId), version: readSafeInteger(row.recipeVersion) },
		files: files.map((file) => ({
			fileId: readString(file.fileId),
			role: readString(file.role) === 'derivative' ? 'derivative' : 'source',
			path: readString(file.path),
			size: readSafeInteger(file.byteSize),
			hash: readString(file.sha256),
			uploadState: readEnum(file.uploadState, ['declared', 'uploaded', 'failed'])
		}))
	};
}

function revisionOf(row: RevisionRow): ModelRevision {
	const derivative = { hash: readString(row.derivativeHash), size: readSafeInteger(row.derivativeBytes) };
	const projectId = readString(row.projectId);
	return {
		revisionId: readString(row.id),
		projectId,
		contentHash: readString(row.contentHash),
		derivative: {
			hash: derivative.hash,
			mime: readString(row.derivativeMime),
			size: derivative.size,
			locator: modelRevisionLocator(projectId, derivative.hash)
		},
		source: {
			manifestHash: readString(row.sourceManifestHash),
			size: readSafeInteger(row.sourceBytes),
			fileCount: readSafeInteger(row.sourceFileCount)
		},
		recipe: { id: readString(row.recipeId), version: readSafeInteger(row.recipeVersion) },
		reportDigest: readString(row.reportDigest),
		placement: readPlacement(row.placement)
	};
}

/** The owner-only, immutable content route keyed by the derivative's hash. */
export function modelRevisionLocator(projectId: string, derivativeHash: string): string {
	return `/projects/${encodeURIComponent(projectId)}/models/content/${derivativeHash}`;
}

function readPlacement(value: unknown): ModelPlacement {
	const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
	if (!isRecord(parsed) || !isRecord(parsed.footprint)) throw new Error('Model revision contained an invalid placement');
	const pivot = parsed.pivot;
	if (!Array.isArray(pivot) || pivot.length !== 3 || pivot.some((entry) => typeof entry !== 'number')) {
		throw new Error('Model revision contained an invalid placement pivot');
	}
	if (parsed.placement !== 'floor') throw new Error('Model revision contained an invalid placement surface');
	return {
		metresPerSourceUnit: Number(parsed.metresPerSourceUnit),
		pivot: [pivot[0] as number, pivot[1] as number, pivot[2] as number],
		footprint: { width: Number(parsed.footprint.width), depth: Number(parsed.footprint.depth) },
		contactMinY: Number(parsed.contactMinY),
		placement: 'floor'
	};
}

function readString(value: unknown): string {
	if (typeof value !== 'string' || value.length === 0) throw new Error('Model row contained an invalid string');
	return value;
}

function readNullableString(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	return readString(value);
}

function readEnum<const Values extends readonly string[]>(value: unknown, values: Values): Values[number] {
	if (typeof value !== 'string' || !values.includes(value)) throw new Error('Model row contained an invalid enum');
	return value as Values[number];
}

function readSafeInteger(value: unknown): number {
	const result = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	if (!Number.isSafeInteger(result) || result < 0) throw new Error('Model row contained an invalid integer');
	return result;
}

function readTimestamp(value: unknown): string {
	const date = value instanceof Date ? value : new Date(String(value));
	if (Number.isNaN(date.getTime())) throw new Error('Model row contained an invalid timestamp');
	return date.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
