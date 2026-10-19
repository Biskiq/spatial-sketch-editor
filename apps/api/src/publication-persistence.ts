/**
 * Publication status under the AM-9 publication gap.
 *
 * Publishing is unavailable until `T4.P01.S05`: the route returns
 * `prepared-reader-required` and no authored release is prepared here. The
 * reset migration removes every publication and release row, so after
 * activation a project reads as never published (revision 0) and Unpublish is
 * an honest not-found. Status and Unpublish stay truthful about the rows that
 * remain, and the owner-only projections keep refusing a pre-epoch project.
 *
 * No public document or asset reader lives here any more. Prepared delivery is
 * T4's, and the public routes answer an honest not-found.
 */

import { UNIT_ENVELOPE_SOURCE_FORMAT } from '@portfolio/project-model/units';

import type { DatabaseClient, DatabasePool } from './database.js';
import { ProjectNotFoundError, queryRows } from './project-persistence.js';

export type PublicationStatus = {
	publicationId: string | null;
	activeVersion: number | null;
	revision: number;
	currentVersion: number;
	createdAt: string | null;
	updatedAt: string | null;
};

export class PublicationNotFoundError extends Error {
	constructor() {
		super('Publication not found');
		this.name = 'PublicationNotFoundError';
	}
}

export class PublicationConflictError extends Error {
	readonly revision: number;
	constructor(revision: number) {
		super(`Publication changed (revision ${revision}); refetch status and retry`);
		this.name = 'PublicationConflictError';
		this.revision = revision;
	}
}

type PublicationRow = {
	projectId: unknown;
	publicId: unknown;
	activeVersion: unknown;
	revision: unknown;
	createdAt: unknown;
	updatedAt: unknown;
};

const PUBLICATION_COLUMNS = `
	p.project_id AS "projectId",
	p.public_id AS "publicId",
	p.active_version AS "activeVersion",
	p.revision,
	p.created_at AS "createdAt",
	p.updated_at AS "updatedAt"`;

/**
 * Owner-only status. Never allocates a public ID: a project without a
 * publication row reads as never-published with revision 0. A project with no
 * F.2 version is not part of the epoch and reads as not found.
 */
export async function getPublicationStatus(
	db: Pick<DatabasePool, 'query'>,
	ownerId: string,
	projectId: string
): Promise<PublicationStatus> {
	const owned = await queryRows<{ latestVersion: unknown }>(
		db,
		`SELECT latest_version AS "latestVersion"
FROM projects p
WHERE p.id = $1 AND p.owner_id = $2
	AND EXISTS (
		SELECT 1 FROM project_versions v
		WHERE v.project_id = p.id AND v.source_format = $3
	)`,
		[projectId, ownerId, UNIT_ENVELOPE_SOURCE_FORMAT]
	);
	if (!owned[0]) throw new ProjectNotFoundError();
	const rows = await queryRows<PublicationRow>(
		db,
		`SELECT ${PUBLICATION_COLUMNS}
FROM publications p
WHERE p.project_id = $1`,
		[projectId]
	);
	return toStatus(rows[0] ?? null, readSafeInteger(owned[0].latestVersion));
}

/**
 * Unpublish: disable delivery for the stable public ID while retaining the row
 * and the ID. Idempotent when already unpublished. There is no publish
 * counterpart while the gap is open.
 */
export async function unpublishVersion(
	pool: DatabasePool,
	ownerId: string,
	projectId: string,
	expectedRevision: number
): Promise<PublicationStatus> {
	return withPublicationTransaction(pool, async (db) => {
		const locked = await queryRows<{ latestVersion: unknown }>(
			db,
			`SELECT latest_version AS "latestVersion"
FROM projects p
WHERE p.id = $1 AND p.owner_id = $2
	AND EXISTS (
		SELECT 1 FROM project_versions v
		WHERE v.project_id = p.id AND v.source_format = $3
	)
FOR UPDATE`,
			[projectId, ownerId, UNIT_ENVELOPE_SOURCE_FORMAT]
		);
		if (!locked[0]) throw new ProjectNotFoundError();
		const currentVersion = readSafeInteger(locked[0].latestVersion);

		const existing = await queryRows<PublicationRow>(
			db,
			`SELECT ${PUBLICATION_COLUMNS}
FROM publications p
WHERE p.project_id = $1
FOR UPDATE`,
			[projectId]
		);
		const current = existing[0] ?? null;
		if (!current) throw new PublicationNotFoundError();
		const currentRevision = readSafeInteger(current.revision);
		if (expectedRevision !== currentRevision) throw new PublicationConflictError(currentRevision);
		if (readNullableVersion(current.activeVersion) === null) return toStatus(current, currentVersion);

		const updated = await queryRows<PublicationRow>(
			db,
			`UPDATE publications AS p
SET active_version = NULL, revision = revision + 1, updated_at = now()
WHERE project_id = $1
RETURNING ${PUBLICATION_COLUMNS}`,
			[projectId]
		);
		if (!updated[0]) throw new Error('Publication update returned no row');
		return toStatus(updated[0], currentVersion);
	});
}

async function withPublicationTransaction<T>(
	pool: DatabasePool,
	work: (db: DatabaseClient) => Promise<T>
): Promise<T> {
	if (!pool.connect) throw new Error('Database transactions are unavailable');
	const db = await pool.connect();
	try {
		await db.query('BEGIN');
		const result = await work(db);
		await db.query('COMMIT');
		return result;
	} catch (error) {
		try {
			await db.query('ROLLBACK');
		} catch {
			// Preserve the original failure; the route returns one bounded error.
		}
		throw error;
	} finally {
		db.release();
	}
}

function toStatus(row: PublicationRow | null, currentVersion: number): PublicationStatus {
	if (!row) {
		return {
			publicationId: null,
			activeVersion: null,
			revision: 0,
			currentVersion,
			createdAt: null,
			updatedAt: null
		};
	}
	return {
		publicationId: readString(row.publicId),
		activeVersion: readNullableVersion(row.activeVersion),
		revision: readSafeInteger(row.revision),
		currentVersion,
		createdAt: readTimestamp(row.createdAt),
		updatedAt: readTimestamp(row.updatedAt)
	};
}

function readString(value: unknown): string {
	if (typeof value !== 'string' || value.length === 0) throw new Error('Database row contained an invalid string');
	return value;
}

function readSafeInteger(value: unknown): number {
	const result = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	if (!Number.isSafeInteger(result) || result < 0) throw new Error('Database row contained an invalid version');
	return result;
}

function readNullableVersion(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	const result = readSafeInteger(value);
	if (result < 1) throw new Error('Database row contained an invalid version');
	return result;
}

function readTimestamp(value: unknown): string {
	const date = value instanceof Date ? value : new Date(String(value));
	if (Number.isNaN(date.getTime())) throw new Error('Database row contained an invalid timestamp');
	return date.toISOString();
}
