import { deleteStagedObjects } from './approval.js';
import { streamModelFile } from './content.js';
import { deleteObject } from './storage.js';
import { canonicalUnitJson, MODEL_DERIVATIVE_MAX_BYTES, MODEL_SOURCE_SET_MAX_BYTES } from '@portfolio/project-model/units';
import { type DatabasePool } from '../database.js';
import { MODEL_STAGING_TTL_MS, SHA256_PATTERN, FILE_PATH_PATTERN, type ModelFileRole, type DeclaredModelFile, type ModelStagedFile, type ModelImport, ModelNotFoundError, ModelInputError, type ImportRow, type FileRow, importColumns, IMPORT_COLUMNS, FILE_COLUMNS, importOf, readString, readSafeInteger, isRecord } from './shared';
import { modelFileKey, sha256 } from './storage';
import { type ObjectStore } from '../object-store.js';
import { queryRows, withTransaction } from '../project-persistence.js';
import { DEFAULT_PROJECT_LIFECYCLE_POLICY, withProjectWriteLease, type ProjectLifecyclePolicy } from '../project-write-lease.js';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

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

export async function readImportFiles(db: Pick<DatabasePool, 'query'>, importId: string): Promise<readonly FileRow[]> {
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
				assertActive();
				uploaded = await streamModelFile(body, contentLength, objectStore, objectKey, signal, assertActive);
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
				assertActive();
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
