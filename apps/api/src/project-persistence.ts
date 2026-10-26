import type { AcceptedRevision } from '@portfolio/project-model';
import { UNIT_ENVELOPE_SOURCE_FORMAT } from '@portfolio/project-model/units';

import type { DatabaseClient, DatabasePool, DatabaseQueryResult } from './database.js';

export type ProjectSummary = {
	id: string;
	name: string;
	version: number;
	updatedAt: string;
};

export type SavedProject = Omit<ProjectSummary, 'id'> & {
	projectId: string;
};

export type LoadedProject = SavedProject & {
	document: unknown;
	/** The epoch fence value this row carries (`unit-envelope-v1`). */
	sourceFormat: string;
	/**
	 * Durable saved-base metadata, additive beside the document. Pre-migration
	 * rows have a token but no revision/digest; the token alone is then the
	 * precondition. The read-only boot works with or without these fields.
	 */
	savedBaseToken: string | null;
	savedRevision: AcceptedRevision | null;
	savedSourceContentId: string | null;
};

export class ProjectNotFoundError extends Error {
	constructor() {
		super('Project not found');
		this.name = 'ProjectNotFoundError';
	}
}

type ProjectRow = {
	id: unknown;
	name: unknown;
	version: unknown;
	updatedAt: unknown;
};

type LoadedProjectRow = ProjectRow & {
	projectId: unknown;
	document: unknown;
	sourceFormat: unknown;
	savedBaseToken: unknown;
	savedRevision: unknown;
	savedSourceContentId: unknown;
};

export async function listProjects(
	db: Pick<DatabasePool, 'query'>,
	ownerId: string
): Promise<ProjectSummary[]> {
	const result = await queryRows<ProjectRow>(
		db,
		`SELECT p.id, p.name, p.latest_version AS version, p.updated_at AS "updatedAt"
FROM projects p
WHERE p.owner_id = $1
	AND EXISTS (
		SELECT 1 FROM project_versions v
		WHERE v.project_id = p.id AND v.source_format = $2
	)
ORDER BY p.updated_at DESC, p.id ASC`,
		[ownerId, UNIT_ENVELOPE_SOURCE_FORMAT]
	);
	return result.map(readProjectSummary);
}

export async function loadProject(
	db: Pick<DatabasePool, 'query'>,
	ownerId: string,
	projectId: string
): Promise<LoadedProject> {
	const result = await queryRows<LoadedProjectRow>(
		db,
		`SELECT p.id AS "projectId", p.name, p.latest_version AS version,
	p.updated_at AS "updatedAt", p.saved_base_token AS "savedBaseToken",
	p.saved_revision AS "savedRevision", p.saved_source_content_id AS "savedSourceContentId",
	v.document, v.source_format AS "sourceFormat"
FROM projects p
JOIN project_versions v
	ON v.project_id = p.id AND v.version = p.latest_version
WHERE p.id = $1 AND p.owner_id = $2 AND v.source_format = $3`,
		[projectId, ownerId, UNIT_ENVELOPE_SOURCE_FORMAT]
	);
	const row = result[0];
	if (!row) throw new ProjectNotFoundError();
	const summary = readProjectSummary({
			id: row.projectId,
			name: row.name,
			version: row.version,
			updatedAt: row.updatedAt
		});
	return {
		projectId: readString(row.projectId),
		name: summary.name,
		version: summary.version,
		updatedAt: summary.updatedAt,
		document: parseJsonb(row.document),
		sourceFormat: readString(row.sourceFormat),
		savedBaseToken: readNullableString(row.savedBaseToken),
		savedRevision: readNullableRevision(row.savedRevision),
		savedSourceContentId: readNullableString(row.savedSourceContentId)
	};
}

export async function withTransaction<T>(
	pool: DatabasePool,
	work: (db: DatabaseClient) => Promise<T>
): Promise<T> {
	if (!pool.connect) throw new Error('Database transactions are unavailable');
	const db = await pool.connect();
	try {
		return await withTransactionOnClient(db, work);
	} finally {
		db.release();
	}
}

/**
 * Run a transaction on a connection already owned by a higher-level scope
 * such as an advisory lock. This helper never releases the caller's client.
 */
export async function withTransactionOnClient<T>(
	db: DatabaseClient,
	work: (db: DatabaseClient) => Promise<T>
): Promise<T> {
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
	}
}

export async function queryRows<Row>(
	db: Pick<DatabasePool, 'query'>,
	text: string,
	values: unknown[]
): Promise<Row[]> {
	const result = (await db.query(text, values)) as DatabaseQueryResult<Row>;
	if (!result || !Array.isArray(result.rows)) throw new Error('Database query returned no rows');
	return result.rows;
}

function readProjectSummary(row: ProjectRow): ProjectSummary {
	return {
		id: readString(row.id),
		name: readString(row.name),
		version: readSafeInteger(row.version),
		updatedAt: readTimestamp(row.updatedAt)
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

function readNullableRevision(value: unknown): AcceptedRevision | null {
	if (value === null || value === undefined) return null;
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

function parseJsonb(value: unknown): unknown {
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value) as unknown;
	} catch {
		throw new Error('Database row contained invalid JSON');
	}
}
