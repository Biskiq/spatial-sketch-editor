/**
 * Conditional Save (`SaveAcceptedSource@1`, AM-4) — the F.2 unit path.
 *
 * One write path, one transaction. The server does not trust the captured
 * digest: the unit source handler re-parses the captured canonical envelope,
 * re-canonicalizes it through the F.2 codec, recomputes the envelope identity,
 * verifies every unit content revision and dependency lock, and refuses any
 * capture that is not the canonical encoding of its own contents.
 *
 * `T3.P01.S04` activates this handler: it is now the only handler the route
 * constructs, and the schema fence (`project_versions.source_format`) makes a
 * pre-epoch writer fail structurally. The old current-source handler is gone.
 *
 * The saved base token is durable metadata beside the strict document. It is not
 * the local `AcceptedRevision`, the SQL `latest_version` ordinal publication
 * status reads, or the publication OCC revision.
 */

import type { AcceptedRevision, ProjectIssue } from '@portfolio/project-model';
import {
	createUnitSaveHandler,
	UNIT_ENVELOPE_SOURCE_FORMAT,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import {
	SAVE_CONTENT_IDENTITY_SCHEME,
	createSavedBaseToken,
	resolveSaveSourceHandler,
	sameAcceptedRevision,
	samePrecondition,
	type SaveAcknowledgement,
	type SavePrecondition,
	type SaveReceipt,
	type SaveRefusalCode,
	type SaveRequest,
	type SaveSourceDatabase,
	type SaveSourceHandler
} from '@portfolio/project-model/save';

import type { DatabaseClient, DatabasePool } from './database.js';
import { verifyModelResourcePins } from './model-persistence.js';
import { ProjectNotFoundError, queryRows, withTransaction } from './project-persistence.js';

/** The one Save source handler this build admits. */
const UNIT_SAVE_HANDLER = createUnitSaveHandler();

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

function saveDatabase(db: DatabaseClient): SaveSourceDatabase {
	return {
		query: (sql, params) => db.query(sql, params === undefined ? undefined : [...params])
	};
}

/** Save one captured F.2 envelope through the one admitted unit handler. */
export async function saveAcceptedSource(
	pool: DatabasePool,
	ownerId: string,
	request: SaveRequest
): Promise<SaveAcknowledgement> {
	return saveAcceptedSourceWithHandlers(pool, ownerId, request, [UNIT_SAVE_HANDLER]);
}

/**
 * Save one captured source through exactly one injected handler.
 *
 * This is the seam the F.2 unit Save contract uses. It is never called by a
 * route: the route imports `saveAcceptedSource` alone, whose handler list is the
 * one admitted unit source.
 */
export async function saveAcceptedSourceWithHandler(
	pool: DatabasePool,
	ownerId: string,
	request: SaveRequest,
	handler: SaveSourceHandler
): Promise<SaveAcknowledgement> {
	return saveAcceptedSourceWithHandlers(pool, ownerId, request, [handler]);
}

/** The one Save transaction, parameterized by the admitted source handlers. */
export async function saveAcceptedSourceWithHandlers(
	pool: DatabasePool,
	ownerId: string,
	request: SaveRequest,
	handlers: readonly SaveSourceHandler[]
): Promise<SaveAcknowledgement> {
	if (request.contentIdentityScheme !== SAVE_CONTENT_IDENTITY_SCHEME) {
		throw new SaveRefusalError('identity-scheme-mismatch', `This server saves ${SAVE_CONTENT_IDENTITY_SCHEME} sources`);
	}
	const capture = request.capture;
	const resolved = resolveSaveSourceHandler(handlers, capture);
	if (resolved.kind === 'refused') throw new SaveRefusalError(resolved.code, resolved.message);
	const handler = resolved.handler;

	// Canonicalization and identity happen once, outside the row lock. The server
	// still reruns the source's own admission inside the transaction against the
	// expected base; this pass only proves the captured bytes are the canonical
	// encoding of their contents before any write can happen.
	const preparedResult = await handler.prepare(capture);
	if (preparedResult.kind === 'refused') {
		throw new SaveRefusalError(preparedResult.code, preparedResult.message, preparedResult.issues ?? []);
	}
	const prepared = preparedResult.source;

	return withTransaction(pool, async (db) => {
		// TD-7: an expected-saved-base Save proves ownership **before** taking any
		// row lock. A foreign project is not-found without locking its row, while the
		// create-only collision path stays intentionally owner-blind below.
		if (capture.precondition.kind === 'expected-saved-base') {
			const owned = await queryRows<{ id: unknown }>(
				db,
				`SELECT p.id
FROM projects p
WHERE p.id = $1 AND p.owner_id = $2
	AND EXISTS (
		SELECT 1 FROM project_versions v
		WHERE v.project_id = p.id AND v.source_format = $3
	)`,
				[capture.projectId, ownerId, UNIT_ENVELOPE_SOURCE_FORMAT]
			);
			if (!owned[0]) throw new ProjectNotFoundError();
		}
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
			assertReceiptMatches(receipt, capture.precondition, capture.acceptedRevision, prepared.sourceContentId, prepared.fullSourceHash);
			return receiptAcknowledgement(receipt);
		}

		let latestVersion: number;
		if (capture.precondition.kind === 'create-only') {
			if (row) throw new SaveRefusalError('collision', 'A project with this ID already exists');
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
				[capture.projectId, ownerId, prepared.name, createSavedBaseToken()]
			);
			if (!inserted[0]) {
				// Lost a create-only race. A concurrent identical retry may already
				// have written its receipt; otherwise this is the one owner-blind
				// collision answer.
				const raced = await readReceipt(db, ownerId, capture.projectId, capture.operationId);
				if (!raced) throw new SaveRefusalError('collision', 'A project with this ID already exists');
				assertReceiptMatches(raced, capture.precondition, capture.acceptedRevision, prepared.sourceContentId, prepared.fullSourceHash);
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
				(readNullableString(row.savedSourceContentId) !== prepared.sourceContentId ||
					readNullableString(row.savedFullSourceHash) !== prepared.fullSourceHash)
			) {
				throw new SaveRefusalError('revision-reuse', 'A saved revision identity cannot be reused for different contents');
			}
			// The saved base is only the latest revision. Revision identity is durable,
			// so reuse against an older receipt must refuse too: A -> B -> A with new
			// contents would otherwise store revision A twice with different bytes.
			const reused = await queryRows<{ id: unknown }>(
				db,
				`SELECT 1 AS id
FROM save_receipts
WHERE project_id = $1
	AND accepted_revision ->> 'projectId' = $2
	AND accepted_revision ->> 'revisionId' = $3
	AND (source_content_id <> $4 OR full_source_hash <> $5)
LIMIT 1`,
				[
					capture.projectId,
					capture.acceptedRevision.projectId,
					capture.acceptedRevision.revisionId,
					prepared.sourceContentId,
					prepared.fullSourceHash
				]
			);
			if (reused[0]) {
				throw new SaveRefusalError('revision-reuse', 'A saved revision identity cannot be reused for different contents');
			}
		}

		// The baseline is the expected saved base's own blocking issues. The unit
		// handler validates every attempt from scratch and declares an empty
		// baseline; the seam stays for any handler that needs history.
		const baseline = row
			? handler.baseline
				? await handler.baseline(saveDatabase(db), readString(row.id), readSafeInteger(row.version))
				: []
			: [];
		const admitted = await handler.validate({ capture, prepared, baseline });
		if (admitted.kind === 'refused') {
			throw new SaveRefusalError(admitted.code, admitted.message, admitted.issues ?? []);
		}
		const finalSource = admitted.source;
		if (
			finalSource.sourceContentId !== prepared.sourceContentId ||
			finalSource.fullSourceHash !== prepared.fullSourceHash
		) {
			throw new SaveRefusalError('content-identity-mismatch', 'Admission produced a different source than the capture');
		}
		// T2.P02.S01: a `model` resource is host-asserted no longer. Every model in
		// the admitted source must name an approved revision of this project whose
		// retained bytes and provenance agree with the resource's pins; the refusal
		// rolls the transaction back, so no stored version changes.
		await verifyModelResourcePins(db, capture.projectId, finalSource.document as ProjectEnvelope);

		const nextVersion = latestVersion + 1;
		const savedBaseToken = createSavedBaseToken();
		await db.query(
			`INSERT INTO project_versions (project_id, version, document, source_format)
VALUES ($1, $2, $3, $4)`,
			[capture.projectId, nextVersion, finalSource.document, UNIT_ENVELOPE_SOURCE_FORMAT]
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
				finalSource.name,
				savedBaseToken,
				capture.acceptedRevision,
				finalSource.sourceContentId,
				finalSource.fullSourceHash
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
			sourceContentId: finalSource.sourceContentId
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
				finalSource.sourceContentId,
				finalSource.fullSourceHash,
				nextVersion,
				savedBaseToken,
				acknowledgement.name
			]
		);
		return acknowledgement;
	});
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
		throw new SaveRefusalError('retry-payload-mismatch', 'This operation ID already records a different payload or precondition');
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
