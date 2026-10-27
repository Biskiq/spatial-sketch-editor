import { randomUUID } from 'node:crypto';

import {
	captureUnitSave,
	computeEnvelopeSourceContentId,
	UNIT_ENVELOPE_SOURCE_KIND,
	UNIT_ENVELOPE_SOURCE_FORMAT,
	UNIT_ENVELOPE_SOURCE_VERSION,
	validateProjectEnvelope,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { SAVE_CONTENT_IDENTITY_SCHEME, type SaveAcknowledgement, type SavePrecondition } from '@portfolio/project-model/save';

import type { DatabasePool } from './database.js';
import type { ObjectStore } from './object-store.js';
import { ProjectNotFoundError, loadProject, queryRows, withTransaction } from './project-persistence.js';
import { SaveRefusalError, saveAcceptedSource } from './save-persistence.js';
import {
	DEFAULT_PROJECT_LIFECYCLE_POLICY,
	projectCleanupBoundMs,
	withProjectAdvisoryLock,
	type ProjectLifecyclePolicy
} from './project-write-lease.js';

const PROJECT_NAME_MAX_LENGTH = 128;
const PROJECT_CLEANUP_OBJECT_TIMEOUT_MS = 30_000;
const SAVED_BASE_PATTERN = /^saved-base:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CONTENT_ID_PATTERN = /^sha256-[0-9a-f]{64}$/;

export type ProjectLifecyclePrecondition = Extract<SavePrecondition, { kind: 'expected-saved-base' }>;
export type RenameProjectRequest = { name: string; precondition: ProjectLifecyclePrecondition };
export type DeleteProjectRequest = { precondition: ProjectLifecyclePrecondition };
export type DeleteProjectAcknowledgement = { projectId: string; cleanup: 'complete' | 'pending' };

export class ProjectLifecycleInputError extends Error {
	readonly statusCode = 400;
	readonly code: 'invalid_body' | 'invalid_project_name';

	constructor(code: ProjectLifecycleInputError['code'], message: string) {
		super(message);
		this.name = 'ProjectLifecycleInputError';
		this.code = code;
	}
}

export class ActivePublicationDeleteError extends Error {
	readonly code = 'unpublish-first';

	constructor() {
		super('Unpublish this project before deleting it');
		this.name = 'ActivePublicationDeleteError';
	}
}

export class ProjectDeletionBusyError extends Error {
	readonly code = 'project-busy';

	constructor() {
		super('Project writes are still active; retry deletion after they stop');
		this.name = 'ProjectDeletionBusyError';
	}
}

export class ProjectDeletionInventoryError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ProjectDeletionInventoryError';
	}
}

export type ParsedLifecycleRequest<T> =
	| { kind: 'valid'; request: T }
	| { kind: 'invalid'; code: 'invalid_body' | 'invalid_project_name'; message: string };

export function parseRenameProjectRequest(input: unknown): ParsedLifecycleRequest<RenameProjectRequest> {
	if (!isRecord(input) || !hasExactKeys(input, ['name', 'precondition'])) {
		return { kind: 'invalid', code: 'invalid_body', message: 'Expected a project name and saved-base precondition' };
	}
	const name = normalizeProjectName(input.name);
	if (name === null) {
		return { kind: 'invalid', code: 'invalid_project_name', message: 'Project name must contain 1 to 128 characters' };
	}
	const precondition = parseExpectedSavedBase(input.precondition);
	if (!precondition) {
		return { kind: 'invalid', code: 'invalid_body', message: 'Expected a valid saved-base precondition' };
	}
	return { kind: 'valid', request: { name, precondition } };
}

export function parseDeleteProjectRequest(input: unknown): ParsedLifecycleRequest<DeleteProjectRequest> {
	if (!isRecord(input) || !hasExactKeys(input, ['precondition'])) {
		return { kind: 'invalid', code: 'invalid_body', message: 'Expected a saved-base precondition' };
	}
	const precondition = parseExpectedSavedBase(input.precondition);
	if (!precondition) {
		return { kind: 'invalid', code: 'invalid_body', message: 'Expected a valid saved-base precondition' };
	}
	return { kind: 'valid', request: { precondition } };
}

/** Project names are authored strings: normalize whitespace and Unicode once, then bound them. */
export function normalizeProjectName(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const name = value.normalize('NFC').trim();
	const length = [...name].length;
	return length >= 1 && length <= PROJECT_NAME_MAX_LENGTH ? name : null;
}

/**
 * Rename derives a new envelope from the current saved envelope and submits it
 * through the ordinary conditional Save/admission/receipt transaction. The
 * initial read only prepares that request; Save rechecks the base under its
 * existing project-row lock. No-op names take their own locked precondition
 * check and append no version.
 */
export async function renameProject(
	pool: DatabasePool,
	ownerId: string,
	projectId: string,
	request: RenameProjectRequest
): Promise<SaveAcknowledgement> {
	const loaded = await loadProject(pool, ownerId, projectId);
	const validation = validateProjectEnvelope(loaded.document);
	if (!validation.success || validation.envelope.id !== projectId) {
		throw new Error('Stored project failed validation');
	}
	const envelope = validation.envelope;
	if (envelope.name === request.name) {
		return renameNoOp(pool, ownerId, projectId, request);
	}

	const acceptedRevision = { projectId, revisionId: randomUUID() };
	const nextEnvelope: ProjectEnvelope = { ...envelope, name: request.name, acceptedRevision };
	const sourceContentId = await computeEnvelopeSourceContentId(nextEnvelope);
	const captured = await captureUnitSave({
		snapshot: {
			acceptedRevision,
			sourceContentId,
			sourceKind: UNIT_ENVELOPE_SOURCE_KIND,
			sourceVersion: UNIT_ENVELOPE_SOURCE_VERSION,
			domain: { identity: { acceptedRevision, sourceContentId }, source: nextEnvelope }
		},
		operationId: randomUUID(),
		precondition: request.precondition
	});
	if (captured.kind !== 'captured') {
		throw new SaveRefusalError('invalid-project', captured.message, captured.issues ?? []);
	}
	return saveAcceptedSource(pool, ownerId, {
		contentIdentityScheme: SAVE_CONTENT_IDENTITY_SCHEME,
		capture: captured.capture
	});
}

async function renameNoOp(
	pool: DatabasePool,
	ownerId: string,
	projectId: string,
	request: RenameProjectRequest
): Promise<SaveAcknowledgement> {
	return withTransaction(pool, async (db) => {
		const rows = await queryRows<{
			projectId: unknown;
			name: unknown;
			version: unknown;
			updatedAt: unknown;
			savedBaseToken: unknown;
			savedRevision: unknown;
			savedSourceContentId: unknown;
			document: unknown;
		}>(
			db,
			"SELECT p.id AS \"projectId\", p.name, p.latest_version AS version, p.updated_at AS \"updatedAt\",\n" +
				"p.saved_base_token AS \"savedBaseToken\", p.saved_revision AS \"savedRevision\",\n" +
				"p.saved_source_content_id AS \"savedSourceContentId\", v.document\n" +
				"FROM projects p JOIN project_versions v ON v.project_id = p.id AND v.version = p.latest_version\n" +
				"WHERE p.id = $1 AND p.owner_id = $2 AND v.source_format = $3\n" +
				"FOR UPDATE OF p",
			[projectId, ownerId, UNIT_ENVELOPE_SOURCE_FORMAT]
		);
		const row = rows[0];
		if (!row) throw new ProjectNotFoundError();
		const token = readString(row.savedBaseToken);
		if (token !== request.precondition.token) {
			throw new SaveRefusalError('conflict', 'The saved base changed; reload before saving');
		}
		const current = validateProjectEnvelope(readJsonb(row.document));
		if (!current.success || current.envelope.id !== projectId || current.envelope.name !== request.name) {
			throw new SaveRefusalError('conflict', 'The saved base changed; reload before saving');
		}
		const revision = readAcceptedRevision(row.savedRevision) ?? current.envelope.acceptedRevision;
		const sourceContentId =
			typeof row.savedSourceContentId === 'string' && CONTENT_ID_PATTERN.test(row.savedSourceContentId)
				? row.savedSourceContentId
				: await computeEnvelopeSourceContentId(current.envelope);
		return {
			projectId: readString(row.projectId),
			name: current.envelope.name,
			version: readSafeInteger(row.version),
			updatedAt: readTimestamp(row.updatedAt),
			savedBaseToken: token,
			savedRevision: revision,
			sourceContentId
		};
	});
}

type DeleteTransactionResult =
	| { kind: 'busy' }
	| { kind: 'existing'; projectId: string }
	| { kind: 'deleted'; projectId: string };

export async function deleteProject(
	pool: DatabasePool,
	ownerId: string,
	projectId: string,
	request: DeleteProjectRequest,
	objectNamespace: string,
	objectStore: ObjectStore | undefined,
	policy: ProjectLifecyclePolicy = DEFAULT_PROJECT_LIFECYCLE_POLICY
): Promise<DeleteProjectAcknowledgement> {
	if (!objectStore?.list || !objectStore.delete) {
		throw new Error('Project deletion requires object-store list and delete support');
	}
	const result = await withTransaction(pool, async (db): Promise<DeleteTransactionResult> => {
		const projectRows = await queryRows<{
			id: unknown;
			ownerId: unknown;
			savedBaseToken: unknown;
		}>(
			db,
			"SELECT p.id, p.owner_id AS \"ownerId\", p.saved_base_token AS \"savedBaseToken\"\n" +
				"FROM projects p\n" +
				"WHERE p.id = $1 AND p.owner_id = $2\n" +
				"AND EXISTS (SELECT 1 FROM project_versions v WHERE v.project_id = p.id AND v.source_format = $3)\n" +
				"FOR UPDATE",
			[projectId, ownerId, UNIT_ENVELOPE_SOURCE_FORMAT]
		);
		const project = projectRows[0];
		if (!project) {
			const tombstone = await readDeletionRecord(db, projectId, ownerId);
			if (!tombstone) throw new ProjectNotFoundError();
			if (readString(tombstone.savedBaseToken) !== request.precondition.token) {
				throw new SaveRefusalError('conflict', 'The saved base changed; reload before saving');
			}
			return { kind: 'existing', projectId };
		}

		// Read the tombstone only after waiting for the project row lock, so a
		// create-only request that waited behind a completed delete sees its fence.
		const priorTombstone = await readDeletionRecord(db, projectId, ownerId);
		if (priorTombstone) {
			throw new ProjectDeletionInventoryError('A live project row conflicts with its deletion tombstone');
		}
		if (readString(project.savedBaseToken) !== request.precondition.token) {
			throw new SaveRefusalError('conflict', 'The saved base changed; reload before saving');
		}

		const publication = await queryRows<{ activeVersion: unknown }>(
			db,
			"SELECT active_version AS \"activeVersion\" FROM publications WHERE project_id = $1 FOR UPDATE",
			[projectId]
		);
		if (publication[0] && publication[0].activeVersion !== null) throw new ActivePublicationDeleteError();

		await db.query(
			"UPDATE project_write_leases SET revoked_at = COALESCE(revoked_at, clock_timestamp())\n" +
				"WHERE project_id = $1 AND released_at IS NULL AND deadline_at > clock_timestamp()",
			[projectId]
		);
		const live = await queryRows<{ count: unknown }>(
			db,
			"SELECT count(*)::int AS count FROM project_write_leases\n" +
				"WHERE project_id = $1 AND released_at IS NULL AND deadline_at > clock_timestamp()",
			[projectId]
		);
		if (readSafeInteger(live[0]?.count ?? 0) > 0) {
			// Return a value so withTransaction commits revocation before the route
			// turns it into a retryable project-busy refusal.
			return { kind: 'busy' };
		}

		const prefix = projectPrefix(objectNamespace, projectId);
		const inventory = await readOwnedProjectInventory(db, projectId, prefix);
		await db.query(
			"INSERT INTO project_deletions (\n" +
				"project_id, owner_id, namespace, saved_base_token, status, key_inventory,\n" +
				"sweep_dependent, fenced_at, handler_timeout_ms, lease_deadline_ms,\n" +
				"renewal_interval_ms, abort_margin_ms, cleanup_bound_ms\n" +
				") VALUES ($1, $2, $3, $4, 'pending', $5::jsonb, $6, clock_timestamp(), $7, $8, $9, $10, $11)",
			[
				projectId,
				ownerId,
				objectNamespace,
				readString(project.savedBaseToken),
				JSON.stringify(inventory.keys),
				inventory.sweepDependent,
				policy.handlerTimeoutMs,
				policy.leaseDeadlineMs,
				policy.renewalIntervalMs,
				policy.abortMarginMs,
				projectCleanupBoundMs(policy)
			]
		);

		// These records must be removed before their project/version parents. The
		// object keys are already durably inventoried in the independent tombstone.
		await db.query("DELETE FROM releases WHERE project_id = $1", [projectId]);
		await db.query("DELETE FROM publications WHERE project_id = $1", [projectId]);
		await db.query("DELETE FROM assets WHERE project_id = $1", [projectId]);
		await db.query("DELETE FROM model_imports WHERE project_id = $1", [projectId]);
		await db.query("DELETE FROM model_revisions WHERE project_id = $1", [projectId]);
		await db.query("DELETE FROM save_receipts WHERE project_id = $1", [projectId]);
		await db.query("DELETE FROM project_versions WHERE project_id = $1", [projectId]);
		const removed = await queryRows<{ id: unknown }>(
			db,
			"DELETE FROM projects WHERE id = $1 AND owner_id = $2 RETURNING id",
			[projectId, ownerId]
		);
		if (!removed[0]) throw new Error('Project deletion did not remove its locked project row');
		return { kind: 'deleted', projectId };
	});

	if (result.kind === 'busy') throw new ProjectDeletionBusyError();
	let cleanup: ProjectDeletionCleanupResult;
	try {
		cleanup = await runProjectDeletionCleanup(pool, objectStore, projectId, policy);
	} catch {
		// The tombstone already committed. A later owner-run CLI invocation can
		// retry; the HTTP answer must continue to say pending.
		return { projectId, cleanup: 'pending' };
	}
	return { projectId, cleanup: cleanup.status };
}

type InventoryResult = { keys: string[]; sweepDependent: boolean };

async function readOwnedProjectInventory(
	db: Pick<DatabasePool, 'query'>,
	projectId: string,
	prefix: string
): Promise<InventoryResult> {
	const keys = new Set<string>();
	const assets = await queryRows<{ key: unknown }>(
		db,
		"SELECT object_key AS key FROM assets WHERE project_id = $1 AND object_key IS NOT NULL",
		[projectId]
	);
	const staging = await queryRows<{ key: unknown }>(
		db,
		"SELECT f.object_key AS key FROM model_import_files f\n" +
			"JOIN model_imports i ON i.id = f.import_id\n" +
			"WHERE i.project_id = $1 AND f.object_key IS NOT NULL",
		[projectId]
	);
	const revisions = await queryRows<{ derivativeKey: unknown; sourceKeys: unknown; sourceFileCount: unknown }>(
		db,
		"SELECT derivative_key AS \"derivativeKey\", source_keys AS \"sourceKeys\",\n" +
			"source_file_count AS \"sourceFileCount\" FROM model_revisions WHERE project_id = $1",
		[projectId]
	);
	for (const row of assets) addOwnedKey(keys, row.key, prefix);
	for (const row of staging) addOwnedKey(keys, row.key, prefix);
	let sweepDependent = false;
	for (const revision of revisions) {
		addOwnedKey(keys, revision.derivativeKey, prefix);
		if (revision.sourceKeys === null || revision.sourceKeys === undefined) {
			sweepDependent = true;
			continue;
		}
		const sourceKeys = readJsonbArray(revision.sourceKeys);
		for (const key of sourceKeys) addOwnedKey(keys, key, prefix);
		if (sourceKeys.length !== readSafeInteger(revision.sourceFileCount)) sweepDependent = true;
	}
	return { keys: [...keys].sort(), sweepDependent };
}

export type ProjectDeletionCleanupResult = {
	projectId: string;
	status: 'complete' | 'pending';
	sweepDependent: boolean;
	deletedKeys: readonly string[];
	repairedLateKeys: readonly string[];
};

type DeletionRecordRow = {
	projectId: unknown;
	ownerId: unknown;
	namespace: unknown;
	savedBaseToken: unknown;
	status: unknown;
	keyInventory: unknown;
	sweepDependent: unknown;
	fencedAt: unknown;
	cleanupBoundMs: unknown;
	firstEmptyAt: unknown;
};

export async function runProjectDeletionCleanup(
	pool: DatabasePool,
	objectStore: ObjectStore | undefined,
	projectId: string,
	policy: ProjectLifecyclePolicy = DEFAULT_PROJECT_LIFECYCLE_POLICY
): Promise<ProjectDeletionCleanupResult> {
	if (!objectStore?.list || !objectStore.delete) {
		throw new Error('Project cleanup requires object-store list and delete support');
	}
	return withProjectAdvisoryLock(pool, 'project-deletion-cleanup', projectId, async (db) => {
		const row = await readDeletionRecord(db, projectId);
		if (!row) throw new ProjectNotFoundError();
		const prefix = projectPrefix(readString(row.namespace), readString(row.projectId));
		const inventory = readJsonbArray(row.keyInventory).map((key) => {
			if (typeof key !== 'string') throw new ProjectDeletionInventoryError('Deletion inventory contains a non-string key');
			assertOwnedKey(key, prefix);
			return key;
		});
		const deletedKeys = new Set<string>();
		const isCompleted = row.status === 'complete';
		const objectSignal = AbortSignal.timeout(PROJECT_CLEANUP_OBJECT_TIMEOUT_MS);
		const listScopedKeys = async (): Promise<string[]> => {
			const bucketKeys = await objectStore.list!(objectSignal);
			if (!Array.isArray(bucketKeys) || bucketKeys.some((key) => typeof key !== 'string')) {
				throw new Error('ObjectStore.list returned an invalid key set');
			}
			return [...new Set(bucketKeys.filter((key) => key.startsWith(prefix)))];
		};
		try {
			if (isCompleted) {
				// Observe completed-record bytes before deleting the durable inventory.
				// A remote PUT may have committed after the earlier completion proof
				// even when its key is already in that inventory. Deleting inventory
				// first would hide that late commit from the repair/re-proof path.
				const lateKeys = new Set<string>();
				for (const key of await listScopedKeys()) {
					assertOwnedKey(key, prefix);
					lateKeys.add(key);
					await objectStore.delete!(key, objectSignal);
					deletedKeys.add(key);
				}
				for (const key of await listScopedKeys()) {
					assertOwnedKey(key, prefix);
					lateKeys.add(key);
					await objectStore.delete!(key, objectSignal);
					deletedKeys.add(key);
				}
				const now = policy.clock();
				if (lateKeys.size > 0) {
					await db.query(
						"UPDATE project_deletions SET status = 'pending', first_empty_at = NULL,\n" +
							"completed_at = NULL, last_attempt_at = $2, attempt_count = attempt_count + 1,\n" +
							"last_error = $3 WHERE project_id = $1",
						[projectId, now, 'late-key-repaired']
					);
					return {
						projectId,
						status: 'pending',
						sweepDependent: readBoolean(row.sweepDependent),
						deletedKeys: [...deletedKeys],
						repairedLateKeys: [...lateKeys]
					};
				}
				await db.query(
					"UPDATE project_deletions SET last_attempt_at = $2, attempt_count = attempt_count + 1,\n" +
						"last_error = NULL WHERE project_id = $1 AND status = 'complete'",
					[projectId, now]
				);
				return {
					projectId,
					status: 'complete',
					sweepDependent: readBoolean(row.sweepDependent),
					deletedKeys: [...deletedKeys],
					repairedLateKeys: []
				};
			}
			for (const key of inventory) {
				await objectStore.delete!(key, objectSignal);
				deletedKeys.add(key);
			}
			const scopedKeys = await listScopedKeys();
			for (const key of scopedKeys) {
				assertOwnedKey(key, prefix);
				await objectStore.delete!(key, objectSignal);
				deletedKeys.add(key);
			}
			const now = policy.clock();
			const fencedAt = readTimestampMs(row.fencedAt);
			const cleanupBound = readSafeInteger(row.cleanupBoundMs);
			const firstEmptyAt = row.firstEmptyAt === null || row.firstEmptyAt === undefined
				? null
				: readTimestampMs(row.firstEmptyAt);
			if (scopedKeys.length > 0) {
				await db.query(
					"UPDATE project_deletions SET first_empty_at = NULL, last_attempt_at = $2,\n" +
						"attempt_count = attempt_count + 1, last_error = NULL\n" +
						"WHERE project_id = $1 AND status = 'pending'",
					[projectId, now]
				);
				return {
					projectId,
					status: 'pending',
					sweepDependent: readBoolean(row.sweepDependent),
					deletedKeys: [...deletedKeys],
					repairedLateKeys: []
				};
			}

			const earliestListingAt = fencedAt + cleanupBound;
			if (now.getTime() < earliestListingAt) {
				await recordPendingCleanupAttempt(db, projectId, now);
				return {
					projectId,
					status: 'pending',
					sweepDependent: readBoolean(row.sweepDependent),
					deletedKeys: [...deletedKeys],
					repairedLateKeys: []
				};
			}
			if (firstEmptyAt === null) {
				await db.query(
					"UPDATE project_deletions SET first_empty_at = $2, last_attempt_at = $2,\n" +
						"attempt_count = attempt_count + 1, last_error = NULL\n" +
						"WHERE project_id = $1 AND status = 'pending' AND first_empty_at IS NULL",
					[projectId, now]
				);
				return {
					projectId,
					status: 'pending',
					sweepDependent: readBoolean(row.sweepDependent),
					deletedKeys: [...deletedKeys],
					repairedLateKeys: []
				};
			}
			if (now.getTime() < firstEmptyAt + cleanupBound) {
				await recordPendingCleanupAttempt(db, projectId, now);
				return {
					projectId,
					status: 'pending',
					sweepDependent: readBoolean(row.sweepDependent),
					deletedKeys: [...deletedKeys],
					repairedLateKeys: []
				};
			}
			await db.query(
				"UPDATE project_deletions SET status = 'complete', completed_at = $2,\n" +
					"last_attempt_at = $2, attempt_count = attempt_count + 1, last_error = NULL\n" +
					"WHERE project_id = $1 AND status = 'pending' AND first_empty_at = $3",
				[projectId, now, new Date(firstEmptyAt)]
			);
			return {
				projectId,
				status: 'complete',
				sweepDependent: readBoolean(row.sweepDependent),
				deletedKeys: [...deletedKeys],
				repairedLateKeys: []
			};
		} catch (error) {
			await db.query(
				"UPDATE project_deletions SET last_attempt_at = $2,\n" +
					"attempt_count = attempt_count + 1, last_error = $3\n" +
					"WHERE project_id = $1",
				[projectId, policy.clock(), safeErrorName(error)]
			).catch(() => undefined);
			if (error instanceof ProjectDeletionInventoryError) throw error;
			return {
				projectId,
				status: 'pending',
				sweepDependent: readBoolean(row.sweepDependent),
				deletedKeys: [...deletedKeys],
				repairedLateKeys: []
			};
		}
	});
}

async function recordPendingCleanupAttempt(db: Pick<DatabasePool, 'query'>, projectId: string, now: Date): Promise<void> {
	await db.query(
		"UPDATE project_deletions SET last_attempt_at = $2, attempt_count = attempt_count + 1,\n" +
			"last_error = NULL WHERE project_id = $1 AND status = 'pending'",
		[projectId, now]
	);
}

export async function listProjectDeletionIds(
	pool: Pick<DatabasePool, 'query'>,
	includeCompleted = false
): Promise<string[]> {
	const rows = await queryRows<{ projectId: unknown }>(
		pool,
		"SELECT project_id AS \"projectId\" FROM project_deletions\n" +
			"WHERE status = 'pending' OR ($1::boolean AND status = 'complete')\n" +
			"ORDER BY fenced_at ASC, project_id ASC",
		[includeCompleted]
	);
	return rows.map((row) => readString(row.projectId));
}

async function readDeletionRecord(
	db: Pick<DatabasePool, 'query'>,
	projectId: string,
	ownerId?: string
): Promise<DeletionRecordRow | null> {
	const rows = await queryRows<DeletionRecordRow>(
		db,
		"SELECT project_id AS \"projectId\", owner_id AS \"ownerId\", namespace,\n" +
			"saved_base_token AS \"savedBaseToken\", status, key_inventory AS \"keyInventory\",\n" +
			"sweep_dependent AS \"sweepDependent\", fenced_at AS \"fencedAt\",\n" +
			"cleanup_bound_ms AS \"cleanupBoundMs\", first_empty_at AS \"firstEmptyAt\"\n" +
			"FROM project_deletions WHERE project_id = $1 AND ($2::text IS NULL OR owner_id = $2)",
		[projectId, ownerId ?? null]
	);
	return rows[0] ?? null;
}

function projectPrefix(namespace: string, projectId: string): string {
	if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(namespace) || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(projectId)) {
		throw new ProjectDeletionInventoryError('Project deletion namespace or ID is malformed');
	}
	return 'projects/' + namespace + '/' + projectId + '/';
}

function addOwnedKey(keys: Set<string>, value: unknown, prefix: string): void {
	if (typeof value !== 'string') throw new ProjectDeletionInventoryError('Project row contains a malformed object key');
	assertOwnedKey(value, prefix);
	keys.add(value);
}

function assertOwnedKey(key: string, prefix: string): void {
	if (!key.startsWith(prefix) || key.length <= prefix.length || key.includes('\0')) {
		throw new ProjectDeletionInventoryError('Project object inventory contains a foreign or malformed key');
	}
}

function parseExpectedSavedBase(value: unknown): ProjectLifecyclePrecondition | null {
	if (
		!isRecord(value) ||
		!hasExactKeys(value, ['kind', 'token']) ||
		value.kind !== 'expected-saved-base' ||
		typeof value.token !== 'string' ||
		!SAVED_BASE_PATTERN.test(value.token)
	) {
		return null;
	}
	return { kind: 'expected-saved-base', token: value.token };
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
	const actual = Object.keys(value).sort();
	const sortedExpected = [...expected].sort();
	return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJsonb(value: unknown): unknown {
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return value;
	}
}

function readJsonbArray(value: unknown): unknown[] {
	const parsed = readJsonb(value);
	if (!Array.isArray(parsed)) throw new ProjectDeletionInventoryError('Project deletion inventory is not an array');
	return parsed;
}

function readAcceptedRevision(value: unknown): { projectId: string; revisionId: string } | null {
	const parsed = readJsonb(value);
	if (
		!isRecord(parsed) ||
		typeof parsed.projectId !== 'string' ||
		typeof parsed.revisionId !== 'string'
	) {
		return null;
	}
	return { projectId: parsed.projectId, revisionId: parsed.revisionId };
}

function readString(value: unknown): string {
	if (typeof value !== 'string' || value.length === 0) throw new Error('Database row contained an invalid string');
	return value;
}

function readSafeInteger(value: unknown): number {
	const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
	if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('Database row contained an invalid integer');
	return parsed;
}

function readBoolean(value: unknown): boolean {
	if (typeof value === 'boolean') return value;
	if (value === 't' || value === 1) return true;
	if (value === 'f' || value === 0) return false;
	throw new Error('Database row contained an invalid boolean');
}

function readTimestamp(value: unknown): string {
	if (value instanceof Date) return value.toISOString();
	if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
		throw new Error('Database row contained an invalid timestamp');
	}
	return new Date(value).toISOString();
}

function readTimestampMs(value: unknown): number {
	if (value instanceof Date) return value.getTime();
	if (typeof value === 'string') {
		const parsed = Date.parse(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	throw new Error('Database row contained an invalid timestamp');
}

function safeErrorName(error: unknown): string {
	return error instanceof Error ? error.name.slice(0, 80) : 'Error';
}
