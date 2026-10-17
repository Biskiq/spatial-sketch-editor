/**
 * Conditional Save (`SaveAcceptedSource@1`, AM-4 `conditional-save-current-v1`).
 *
 * One write path, one transaction. The server does not trust the captured
 * digest: it re-parses the captured canonical bytes, re-canonicalizes through
 * the single project export, recomputes the identity and runs the **same**
 * current-source admission the visitor runtime uses, against the shipped Scene
 * catalogue. A legacy row that itself fails registry admission contributes an
 * empty blocking baseline, so a valid candidate repairs it and a dirty row never
 * blocks Save permanently.
 *
 * The saved base token is durable metadata beside the strict document. It is not
 * the local `AcceptedRevision`, the SQL `latest_version` ordinal publication
 * reads, or the publication OCC revision.
 */

import {
	CURRENT_SOURCE_KIND,
	CURRENT_SOURCE_VERSION,
	admitCurrentSourceContent,
	canonicalSourceJson,
	sourceContentIdForCanonicalJson
} from '@portfolio/project-model';
import type { AcceptedRevision, AdmissionIssue, ProjectIssue } from '@portfolio/project-model';
import {
	SAVE_CONTENT_IDENTITY_SCHEME,
	createSavedBaseToken,
	fullSourceHash,
	sameAcceptedRevision,
	samePrecondition,
	type SaveAcknowledgement,
	type SavePrecondition,
	type SaveReceipt,
	type SaveRefusalCode,
	type SaveRequest
} from '@portfolio/project-model/save';

import type { DatabaseClient, DatabasePool } from './database.js';
import {
	ProjectNotFoundError,
	queryRows,
	withTransaction
} from './project-persistence.js';
import { REGISTRY_SCENE_OPTIONS } from './scene-registry.js';

/** One typed refusal. The route maps the code to its HTTP result and status. */
export class SaveRefusalError extends Error {
	readonly code: SaveRefusalCode;
	readonly issues: readonly ProjectIssue[];

	constructor(code: SaveRefusalCode, message: string, issues: readonly ProjectIssue[] = []) {
		super(message);
		this.name = 'SaveRefusalError';
		this.code = code;
		this.issues = issues;
	}
}

type ProjectRow = {
	id: unknown;
	ownerId: unknown;
	name: unknown;
	version: unknown;
	updatedAt: unknown;
	savedBaseToken: unknown;
	savedRevision: unknown;
	savedSourceContentId: unknown;
	savedFullSourceHash: unknown;
};

type ReceiptRow = {
	projectId: unknown;
	operationId: unknown;
	preconditionKind: unknown;
	preconditionToken: unknown;
	acceptedRevision: unknown;
	sourceContentId: unknown;
	fullSourceHash: unknown;
	version: unknown;
	savedBaseToken: unknown;
	savedName: unknown;
	createdAt: unknown;
};

export async function saveAcceptedSource(
	pool: DatabasePool,
	ownerId: string,
	request: SaveRequest
): Promise<SaveAcknowledgement> {
	if (request.contentIdentityScheme !== SAVE_CONTENT_IDENTITY_SCHEME) {
		throw new SaveRefusalError(
			'identity-scheme-mismatch',
			`This server saves ${SAVE_CONTENT_IDENTITY_SCHEME} sources`
		);
	}
	const capture = request.capture;
	if (capture.sourceKind !== CURRENT_SOURCE_KIND || capture.sourceVersion !== CURRENT_SOURCE_VERSION) {
		throw new SaveRefusalError(
			'source-version-mismatch',
			`Save admits ${CURRENT_SOURCE_KIND}@${CURRENT_SOURCE_VERSION} only`
		);
	}

	// Canonicalization and digest happen once, outside the row lock. The server
	// still reruns full admission inside the transaction against the expected
	// base; this pass only proves the captured bytes are the canonical encoding
	// of their contents before any write can happen.
	let parsed: unknown;
	try {
		parsed = JSON.parse(capture.canonicalJson);
	} catch {
		throw new SaveRefusalError('invalid-project', 'The captured source is not valid JSON');
	}
	const canonical = canonicalSourceJson(parsed, { scene: REGISTRY_SCENE_OPTIONS });
	if (canonical.kind === 'rejected') {
		throw new SaveRefusalError('invalid-project', canonical.issues[0]?.message ?? 'Invalid project', canonical.issues);
	}
	if (canonical.canonicalJson !== capture.canonicalJson) {
		throw new SaveRefusalError(
			'content-identity-mismatch',
			'The captured source is not the canonical encoding of its contents'
		);
	}
	if (canonical.project.id !== capture.projectId) {
		throw new SaveRefusalError('invalid-save-request', 'The captured source belongs to a different project');
	}
	const digest = await sourceContentIdForCanonicalJson(canonical.canonicalJson);
	if (digest !== capture.sourceContentId) {
		throw new SaveRefusalError('content-identity-mismatch', 'The recomputed content identity does not match the capture');
	}
	const capturedFullSourceHash = await fullSourceHash(canonical.canonicalJson);

	return withTransaction(pool, async (db) => {
		const locked = await queryRows<ProjectRow>(
			db,
			`SELECT id, owner_id AS "ownerId", name, latest_version AS version,
	updated_at AS "updatedAt", saved_base_token AS "savedBaseToken",
	saved_revision AS "savedRevision", saved_source_content_id AS "savedSourceContentId",
	saved_full_source_hash AS "savedFullSourceHash"
FROM projects
WHERE id = $1
FOR UPDATE`,
			[capture.projectId]
		);
		const row = locked[0] ?? null;

		// Receipt lookup happens after the row lock (where a row exists), so a
		// concurrent identical retry that waited on that lock replays the receipt
		// the winner committed instead of misreading the moved token as a
		// conflict. The query is owner-scoped and reveals nothing about another
		// owner's operation.
		const receipt = await readReceipt(db, ownerId, capture.projectId, capture.operationId);
		if (receipt) {
			assertReceiptMatches(receipt, capture.precondition, capture.acceptedRevision, digest, capturedFullSourceHash);
			return receiptAcknowledgement(receipt);
		}

		let latestVersion: number;
		if (capture.precondition.kind === 'create-only') {
			if (row) {
				throw new SaveRefusalError('collision', 'A project with this ID already exists');
			}
			// The user row is created only when this Save actually creates a
			// project; a refused Save writes nothing, not even an owner record.
			await db.query(
				`INSERT INTO users (id)
VALUES ($1)
ON CONFLICT (id) DO NOTHING`,
				[ownerId]
			);
			const inserted = await queryRows<{ id: unknown }>(
				db,
				`INSERT INTO projects (id, owner_id, name, saved_base_token)
VALUES ($1, $2, $3, $4)
ON CONFLICT (id) DO NOTHING
RETURNING id`,
				[capture.projectId, ownerId, canonical.project.name, createSavedBaseToken()]
			);
			if (!inserted[0]) {
				// Lost a create-only race. A concurrent identical retry may already
				// have written its receipt; otherwise this is the one owner-blind
				// collision answer.
				const raced = await readReceipt(db, ownerId, capture.projectId, capture.operationId);
				if (!raced) throw new SaveRefusalError('collision', 'A project with this ID already exists');
				assertReceiptMatches(raced, capture.precondition, capture.acceptedRevision, digest, capturedFullSourceHash);
				return receiptAcknowledgement(raced);
			}
			latestVersion = 0;
		} else {
			if (!row || row.ownerId !== ownerId) throw new ProjectNotFoundError();
			const persistedToken = readString(row.savedBaseToken);
			if (persistedToken !== capture.precondition.token) {
				// No remote contents in a conflict: the client reloads explicitly.
				throw new SaveRefusalError('conflict', 'The saved base changed; reload before saving');
			}
			latestVersion = readSafeInteger(row.version);
			if (
				row.savedRevision !== null &&
				row.savedRevision !== undefined &&
				sameAcceptedRevision(readRevision(row.savedRevision), capture.acceptedRevision) &&
				(readNullableString(row.savedSourceContentId) !== digest ||
					readNullableString(row.savedFullSourceHash) !== capturedFullSourceHash)
			) {
				throw new SaveRefusalError(
					'revision-reuse',
					'A saved revision identity cannot be reused for different contents'
				);
			}
		}

		// The baseline is the expected saved base's own blocking compile issues.
		// A stored base that fails registry admission contributes an empty
		// baseline: the candidate is judged on its own merits, never permanently
		// blocked by a legacy permissive `PUT` row.
		const baseline = row ? await readBaseline(db, readString(row.id), readSafeInteger(row.version)) : [];
		const admitted = await admitCurrentSourceContent(parsed, {
			scene: REGISTRY_SCENE_OPTIONS,
			baselineBlockingIssues: baseline
		});
		if (admitted.kind === 'rejected') {
			throw new SaveRefusalError('invalid-project', admitted.message, admitted.issues);
		}
		if (admitted.canonicalJson !== canonical.canonicalJson || admitted.sourceContentId !== digest) {
			throw new SaveRefusalError(
				'content-identity-mismatch',
				'Admission produced a different canonical source than the capture'
			);
		}

		const nextVersion = latestVersion + 1;
		const savedBaseToken = createSavedBaseToken();
		await db.query(
			`INSERT INTO project_versions (project_id, version, document)
VALUES ($1, $2, $3)`,
			[capture.projectId, nextVersion, JSON.parse(admitted.canonicalJson)]
		);
		const updated = await queryRows<ProjectRow>(
			db,
			`UPDATE projects
SET name = $3, latest_version = $2, saved_base_token = $4,
	saved_revision = $5, saved_source_content_id = $6, saved_full_source_hash = $7,
	updated_at = now()
WHERE id = $1
RETURNING id, name, latest_version AS version, updated_at AS "updatedAt"`,
			[
				capture.projectId,
				nextVersion,
				canonical.project.name,
				savedBaseToken,
				capture.acceptedRevision,
				digest,
				capturedFullSourceHash
			]
		);
		const saved = updated[0];
		if (!saved) throw new Error('Project save returned no row');
		const acknowledgement: SaveAcknowledgement = {
			projectId: readString(saved.id),
			name: readString(saved.name),
			version: readSafeInteger(saved.version),
			updatedAt: readTimestamp(saved.updatedAt),
			savedBaseToken,
			savedRevision: capture.acceptedRevision,
			sourceContentId: digest
		};

		await db.query(
			`INSERT INTO save_receipts (
	project_id, operation_id, precondition_kind, precondition_token,
	accepted_revision, source_content_id, full_source_hash, version, saved_base_token, saved_name
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			[
				capture.projectId,
				capture.operationId,
				capture.precondition.kind,
				capture.precondition.kind === 'expected-saved-base' ? capture.precondition.token : null,
				capture.acceptedRevision,
				digest,
				capturedFullSourceHash,
				nextVersion,
				savedBaseToken,
				acknowledgement.name
			]
		);
		return acknowledgement;
	});
}

/**
 * Read the base document that the expected precondition names and admit it
 * through the registry. Only an admitted base contributes a blocking baseline;
 * an unadmitted one contributes `[]` so the candidate is judged on its merits.
 */
async function readBaseline(
	db: DatabaseClient,
	projectId: string,
	version: number
): Promise<readonly AdmissionIssue[]> {
	const rows = await queryRows<{ document: unknown }>(
		db,
		`SELECT document FROM project_versions WHERE project_id = $1 AND version = $2`,
		[projectId, version]
	);
	if (!rows[0]) return [];
	const base = await admitCurrentSourceContent(parseJsonb(rows[0].document), { scene: REGISTRY_SCENE_OPTIONS });
	return base.kind === 'admitted' ? base.blockingIssues : [];
}

async function readReceipt(
	db: DatabaseClient,
	ownerId: string,
	projectId: string,
	operationId: string
): Promise<SaveReceipt | null> {
	const rows = await queryRows<ReceiptRow>(
		db,
		`SELECT r.project_id AS "projectId", r.operation_id AS "operationId",
	r.precondition_kind AS "preconditionKind", r.precondition_token AS "preconditionToken",
	r.accepted_revision AS "acceptedRevision", r.source_content_id AS "sourceContentId",
	r.full_source_hash AS "fullSourceHash", r.version,
	r.saved_base_token AS "savedBaseToken", r.saved_name AS "savedName",
	r.created_at AS "createdAt"
FROM save_receipts r
JOIN projects p ON p.id = r.project_id
WHERE r.project_id = $1 AND r.operation_id = $2 AND p.owner_id = $3`,
		[projectId, operationId, ownerId]
	);
	const row = rows[0];
	if (!row) return null;
	const kind = row.preconditionKind;
	if (kind !== 'create-only' && kind !== 'expected-saved-base') {
		throw new Error('Save receipt contained an invalid precondition');
	}
	const precondition: SavePrecondition =
		kind === 'create-only'
			? { kind: 'create-only' }
			: { kind: 'expected-saved-base', token: readString(row.preconditionToken) };
	return {
		projectId: readString(row.projectId),
		operationId: readString(row.operationId),
		precondition,
		acceptedRevision: readRevision(row.acceptedRevision),
		sourceContentId: readString(row.sourceContentId),
		fullSourceHash: readString(row.fullSourceHash),
		version: readSafeInteger(row.version),
		savedBaseToken: readString(row.savedBaseToken),
		name: readString(row.savedName),
		savedAt: readTimestamp(row.createdAt)
	};
}

function assertReceiptMatches(
	receipt: SaveReceipt,
	precondition: SavePrecondition,
	revision: AcceptedRevision,
	digest: string,
	hashedSource: string
): void {
	if (
		!samePrecondition(receipt.precondition, precondition) ||
		!sameAcceptedRevision(receipt.acceptedRevision, revision) ||
		receipt.sourceContentId !== digest ||
		receipt.fullSourceHash !== hashedSource
	) {
		throw new SaveRefusalError(
			'retry-payload-mismatch',
			'This operation ID already records a different payload or precondition'
		);
	}
}

function receiptAcknowledgement(receipt: SaveReceipt): SaveAcknowledgement {
	return {
		projectId: receipt.projectId,
		name: receipt.name,
		version: receipt.version,
		updatedAt: receipt.savedAt,
		savedBaseToken: receipt.savedBaseToken,
		savedRevision: receipt.acceptedRevision,
		sourceContentId: receipt.sourceContentId
	};
}

function readString(value: unknown): string {
	if (typeof value !== 'string' || value.length === 0) throw new Error('Database row contained an invalid string');
	return value;
}

function readNullableString(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	return readString(value);
}

function readSafeInteger(value: unknown): number {
	const result = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	if (!Number.isSafeInteger(result) || result < 0) throw new Error('Database row contained an invalid version');
	return result;
}

function readTimestamp(value: unknown): string {
	const date = value instanceof Date ? value : new Date(String(value));
	if (Number.isNaN(date.getTime())) throw new Error('Database row contained an invalid timestamp');
	return date.toISOString();
}

function readRevision(value: unknown): AcceptedRevision {
	const parsed = parseJsonb(value);
	if (
		typeof parsed !== 'object' ||
		parsed === null ||
		Array.isArray(parsed) ||
		typeof (parsed as Record<string, unknown>).projectId !== 'string' ||
		typeof (parsed as Record<string, unknown>).revisionId !== 'string'
	) {
		throw new Error('Database row contained an invalid accepted revision');
	}
	return {
		projectId: (parsed as Record<string, string>).projectId,
		revisionId: (parsed as Record<string, string>).revisionId
	};
}

function parseJsonb(value: unknown): unknown {
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value) as unknown;
	} catch {
		throw new Error('Database row contained invalid JSON');
	}
}
