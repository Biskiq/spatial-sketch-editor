import { expireStaleModelImports, readStagingImport } from './imports.js';
import { deleteObject, putBytes, readObjectBytes } from './storage.js';
import {
	canonicalUnitJson,
	MODEL_DERIVATIVE_MAX_BYTES,
	MODEL_RESOURCE_MIME,
	MODEL_SOURCE_SET_MAX_BYTES,
	type ModelPlacement,
	type ProjectEnvelope,
} from '@portfolio/project-model/units';
import { type DatabaseClient, type DatabasePool } from '../database.js';
import {
	SHA256_PATTERN,
	type ModelRevision,
	ModelNotFoundError,
	ModelInputError,
	ModelPinRefusalError,
	type RevisionRow,
	REVISION_COLUMNS,
	REVISION_RETURNING,
	revisionOf,
	modelRevisionLocator,
	readPlacement,
	readString,
	readNullableString,
	readSafeInteger,
	isRecord,
} from './shared';
import { bufferSha256, revisionObjectKeys, modelRevisionKey, sha256 } from './storage';
import { checkModelStructure } from '../model-structure.js';
import { type ObjectStore } from '../object-store.js';
import { queryRows, withTransactionOnClient } from '../project-persistence.js';
import {
	DEFAULT_PROJECT_LIFECYCLE_POLICY,
	withProjectAdvisoryLock,
	withProjectWriteLease,
	type ProjectLifecyclePolicy,
	type ProjectWriteContext,
} from '../project-write-lease.js';
import { randomUUID } from 'node:crypto';

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
	if (
		Object.keys(placement).some(
			(key) =>
				!['metresPerSourceUnit', 'pivot', 'footprint', 'contactMinY', 'placement'].includes(key),
		)
	) {
		throw new ModelInputError('invalid_model_import', 400, 'Unexpected placement field');
	}
	const metresPerSourceUnit = placement.metresPerSourceUnit;
	if (
		typeof metresPerSourceUnit !== 'number' ||
		!Number.isFinite(metresPerSourceUnit) ||
		metresPerSourceUnit <= 0
	) {
		throw new ModelInputError(
			'invalid_model_import',
			400,
			'Placement scale must be finite and greater than zero',
		);
	}
	const pivot = placement.pivot;
	if (
		!Array.isArray(pivot) ||
		pivot.length !== 3 ||
		pivot.some((value) => typeof value !== 'number' || !Number.isFinite(value))
	) {
		throw new ModelInputError(
			'invalid_model_import',
			400,
			'Placement pivot must be three finite metres',
		);
	}
	const footprint = placement.footprint;
	if (!isRecord(footprint))
		throw new ModelInputError('invalid_model_import', 400, 'Placement footprint is required');
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
		throw new ModelInputError(
			'invalid_model_import',
			400,
			'Placement footprint must be positive metres',
		);
	}
	const contactMinY = placement.contactMinY;
	if (typeof contactMinY !== 'number' || !Number.isFinite(contactMinY)) {
		throw new ModelInputError(
			'invalid_model_import',
			400,
			'Placement contact must be a finite metre value',
		);
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
			placement: 'floor',
		},
	};
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
	options: { parentSignal?: AbortSignal; policy?: ProjectLifecyclePolicy } = {},
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
	if (state !== 'staging')
		throw new ModelInputError('invalid_model_import', 409, 'This import is not staging');
	if (files.length === 0 || files.some((file) => readString(file.uploadState) !== 'uploaded')) {
		throw new ModelInputError(
			'model_not_ready',
			409,
			'Every declared file must be uploaded before approval',
		);
	}

	const bytes = new Map<string, Buffer>();
	for (const file of files) {
		const key = readNullableString(file.objectKey);
		if (key === null)
			throw new ModelInputError('model_not_ready', 409, 'A declared file has no staged bytes');
		const limit =
			readString(file.role) === 'derivative'
				? MODEL_DERIVATIVE_MAX_BYTES
				: MODEL_SOURCE_SET_MAX_BYTES;
		const buffer = await readObjectBytes(objectStore, key, limit);
		if (
			buffer.length !== readSafeInteger(file.byteSize) ||
			bufferSha256(buffer) !== readString(file.sha256)
		) {
			throw new ModelInputError(
				'model_not_ready',
				409,
				'A staged file no longer matches its declaration',
			);
		}
		bytes.set(key, buffer);
	}
	const sourceFiles = files
		.filter((file) => readString(file.role) === 'source')
		.map((file) => ({
			path: readString(file.path),
			bytes: bytes.get(readString(file.objectKey))!,
		}));
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
			fileCount: files.filter((file) => readString(file.role) === 'source').length,
		},
		recipe: { id: readString(record.recipeId), version: readSafeInteger(record.recipeVersion) },
		reportDigest: approval.reportDigest,
		placement: approval.placement,
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
			withProjectAdvisoryLock(pool, 'model-approval', `${projectId}:${contentHash}`, async (db) =>
				lease.withDatabaseClient(db, async () => {
					lease.assertActive();
					// The per-content lock is held through writes, finalization and any
					// compensation. A second identical approval therefore observes the
					// committed winner before considering deletion of shared keys.
					let row = (
						await queryRows<RevisionRow>(
							db,
							`SELECT ${REVISION_COLUMNS} FROM model_revisions r WHERE r.project_id = $1 AND r.content_hash = $2`,
							[projectId, contentHash],
						)
					)[0];
					if (row) {
						await markImportApproved(db, ownerId, projectId, importId, readString(row.id), lease);
						lease.assertActive();
						await deleteStagedObjects(db, objectStore, [importId]);
						return revisionOf(row);
					}

					const writtenKeys = [derivativeKey, ...sourceKeys];
					try {
						lease.assertActive();
						await putBytes(
							objectStore,
							derivativeKey,
							derivativeBytes,
							MODEL_RESOURCE_MIME,
							lease.signal,
							lease.assertActive,
						);
						for (let index = 0; index < sourceFiles.length; index += 1) {
							lease.assertActive();
							const file = sourceFiles[index]!;
							await putBytes(
								objectStore,
								sourceKeys[index]!,
								file.bytes,
								'application/octet-stream',
								lease.signal,
								lease.assertActive,
							);
						}
						lease.assertActive();

						row = await withTransactionOnClient(db, async (db) => {
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
									JSON.stringify(sourceKeys),
								],
							);
							const persisted =
								inserted[0] ??
								(
									await queryRows<RevisionRow>(
										db,
										`SELECT ${REVISION_COLUMNS} FROM model_revisions r WHERE r.project_id = $1 AND r.content_hash = $2 FOR UPDATE`,
										[projectId, contentHash],
									)
								)[0];
							if (!persisted) throw new Error('Model revision approval returned no row');
							lease.assertActive();
							const approved = await queryRows<{ id: unknown }>(
								db,
								`UPDATE model_imports
SET state = 'approved', revision_id = $4::uuid
WHERE id = $1::uuid AND project_id = $2 AND owner_id = $3
				AND (state = 'staging' OR (state = 'approved' AND revision_id = $4::uuid))
RETURNING id`,
								[importId, projectId, ownerId, readString(persisted.id)],
							);
							if (!approved[0]) throw new ModelNotFoundError();
							lease.assertActive();
							return persisted;
						});
						lease.assertActive();
					} catch (error) {
						// A commit error can be ambiguous. Preserve deterministic keys if a
						// revision row exists or the database cannot prove it does not.
						let referenced = true;
						try {
							referenced =
								(
									await queryRows<{ id: unknown }>(
										db,
										`SELECT id FROM model_revisions WHERE project_id = $1 AND content_hash = $2`,
										[projectId, contentHash],
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
					await deleteStagedObjects(db, objectStore, [importId]);
					return revisionOf(row);
				}),
			),
		{
			parentSignal: options.parentSignal,
			policy: options.policy ?? DEFAULT_PROJECT_LIFECYCLE_POLICY,
			deferHeartbeat: true,
		},
	);
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
	envelope: ProjectEnvelope,
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
			issues.push({
				path,
				code: 'unapproved_model_resource',
				message: 'a model resource must carry an approved derivative pin and its detail',
			});
			continue;
		}
		const rows = await queryRows<RevisionRow>(
			db,
			`SELECT ${REVISION_COLUMNS}
FROM model_revisions r
WHERE r.project_id = $1 AND r.derivative_hash = $2`,
			[projectId, pin.hash],
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
				message: `model resource "${resource.id}" does not name an approved revision of this project`,
			});
		}
	}
	if (issues.length > 0) {
		throw new ModelPinRefusalError(
			'The saved source names model bytes this project has not approved',
			issues,
		);
	}
}

export async function readApprovedRevisionId(
	db: Pick<DatabasePool, 'query'>,
	importId: string,
): Promise<string> {
	const rows = await queryRows<{ revisionId: unknown }>(
		db,
		`SELECT revision_id AS "revisionId" FROM model_imports WHERE id = $1::uuid`,
		[importId],
	);
	const revisionId = rows[0] ? readNullableString(rows[0].revisionId) : null;
	if (revisionId === null) throw new ModelNotFoundError();
	return revisionId;
}

export async function readRevisionById(
	db: Pick<DatabasePool, 'query'>,
	projectId: string,
	revisionId: string,
): Promise<RevisionRow | null> {
	const rows = await queryRows<RevisionRow>(
		db,
		`SELECT ${REVISION_COLUMNS} FROM model_revisions r WHERE r.project_id = $1 AND r.id = $2::uuid`,
		[projectId, revisionId],
	);
	return rows[0] ?? null;
}

export async function deleteStagedObjects(
	db: Pick<DatabasePool, 'query'>,
	objectStore: ObjectStore | undefined,
	importIds: readonly string[],
): Promise<void> {
	if (objectStore === undefined) return;
	const rows = await queryRows<{ objectKey: unknown }>(
		db,
		`SELECT f.object_key AS "objectKey"
FROM model_import_files f
WHERE f.import_id = ANY ($1::uuid[]) AND f.object_key IS NOT NULL`,
		[importIds],
	);
	for (const row of rows) {
		const key = readNullableString(row.objectKey);
		if (key !== null) await deleteObject(objectStore, key);
	}
}

export async function markImportApproved(
	db: DatabaseClient,
	ownerId: string,
	projectId: string,
	importId: string,
	revisionId: string,
	lease: ProjectWriteContext,
): Promise<void> {
	await withTransactionOnClient(db, async (db) => {
		lease.assertActive();
		const rows = await queryRows<{ id: unknown }>(
			db,
			`UPDATE model_imports
SET state = 'approved', revision_id = $4::uuid
WHERE id = $1::uuid AND project_id = $2 AND owner_id = $3
	AND (state = 'staging' OR (state = 'approved' AND revision_id = $4::uuid))
RETURNING id`,
			[importId, projectId, ownerId, revisionId],
		);
		if (!rows[0]) throw new ModelNotFoundError();
		lease.assertActive();
	});
}
