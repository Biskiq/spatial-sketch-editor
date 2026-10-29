/**
 * T5.P01.S04 — owner-scoped `form` library storage (My Objects).
 *
 * One item is one immutable saved revision: a server-allocated logical id and
 * canonical payload bytes whose SHA-256 is the item's content identity. The
 * server never edits an item: Save creates a new one, and Remove deletes it.
 *
 * Validation reuses the shared `@portfolio/project-model/library` codec, so the
 * editor and the API admit the same bytes. The server recomputes the canonical
 * bytes and the content id and refuses a mismatch; it never stores a caller's
 * unchecked JSON.
 *
 * Ownership is the only access rule. Every statement filters by owner, and an
 * id that belongs to someone else is indistinguishable from an unknown id.
 */
import { randomUUID } from 'node:crypto';

import {
	FORM_LIBRARY_MAX_ITEMS,
	readFormLibraryPayload,
	type FormLibraryItemSummary,
	type FormLibraryPayload
} from '@portfolio/project-model/library';
import { sha256Bytes } from '@portfolio/project-model';

import type { DatabasePool } from './database.js';
import { queryRows, withTransaction } from './project-persistence.js';

const SHA256_IDENTITY = /^sha256-[0-9a-f]{64}$/;

export class FormLibraryInputError extends Error {
	readonly statusCode: 400 | 409 | 413;
	readonly code:
		| 'invalid_library_item'
		| 'content_id_mismatch'
		| 'payload_too_large'
		| 'library_full';

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
	constructor() {
		super('Library item not found');
		this.name = 'FormLibraryNotFoundError';
	}
}

type LibraryRow = {
	id: unknown;
	name: unknown;
	kind: unknown;
	formatVersion: unknown;
	contentId: unknown;
	createdAt: unknown;
	canonicalBytes?: unknown;
};

function summaryOf(row: LibraryRow): FormLibraryItemSummary {
	return {
		id: String(row.id),
		name: String(row.name),
		kind: 'form',
		formatVersion: Number(row.formatVersion),
		contentId: String(row.contentId),
		createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)
	};
}

/**
 * Read one Save request: exactly `{ contentId, payload }`, validated through the
 * shared codec. The content id is recomputed from the canonical bytes, never
 * trusted, so an item cannot be stored under an identity its bytes do not have.
 */
export function parseFormLibrarySaveBody(
	body: unknown
): { readonly contentId: string; readonly payload: FormLibraryPayload } {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		throw new FormLibraryInputError('invalid_library_item', 400, 'Expected a library item request');
	}
	const record = body as Record<string, unknown>;
	const keys = Object.keys(record);
	if (keys.some((key) => key !== 'contentId' && key !== 'payload') || keys.length !== 2) {
		throw new FormLibraryInputError(
			'invalid_library_item',
			400,
			'Expected exactly a contentId and a payload'
		);
	}
	if (typeof record.contentId !== 'string' || !SHA256_IDENTITY.test(record.contentId)) {
		throw new FormLibraryInputError('invalid_library_item', 400, 'Expected a canonical content id');
	}
	const parsed = readFormLibraryPayload(record.payload);
	if (!parsed.success) {
		const first = parsed.issues[0];
		const tooLarge = first?.code === 'payload_too_large';
		throw new FormLibraryInputError(
			tooLarge ? 'payload_too_large' : 'invalid_library_item',
			tooLarge ? 413 : 400,
			first?.message ?? 'The library item is not valid'
		);
	}
	return { contentId: record.contentId, payload: parsed.payload };
}

/** Store one new item, or refuse with a reason the editor can show. */
export async function saveFormLibraryItem(
	pool: DatabasePool,
	ownerId: string,
	body: unknown
): Promise<FormLibraryItemSummary> {
	const parsed = parseFormLibrarySaveBody(body);
	const bytes = new TextEncoder().encode(JSON.stringify(parsed.payload));
	const contentId = await sha256Bytes(bytes);
	if (contentId !== parsed.contentId) {
		throw new FormLibraryInputError(
			'content_id_mismatch',
			400,
			'The item bytes do not match the content id they were sent as'
		);
	}
	const id = randomUUID();
	const summary = await withTransaction(pool, async (client) => {
		// A signed-in creator may never have saved a project, so no `users` row was
		// created yet. The library owns that identity check itself instead of
		// depending on the Save route having run first.
		await client.query('INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [ownerId]);
		// One owner's library count cannot race two saves onto the bound. The lock
		// is transaction-scoped, so a failed insert releases it with the rollback.
		await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [ownerId]);
		const counted = await client.query<{ count: string }>(
			'SELECT count(*)::text AS count FROM form_library_items WHERE owner_id = $1',
			[ownerId]
		);
		const count = Number(counted.rows[0]?.count ?? 0);
		if (count >= FORM_LIBRARY_MAX_ITEMS) {
			throw new FormLibraryInputError(
				'library_full',
				409,
				`My Objects holds at most ${FORM_LIBRARY_MAX_ITEMS} items. Remove an item to save another.`
			);
		}
		const inserted = await client.query<LibraryRow>(
			`INSERT INTO form_library_items
				(id, owner_id, kind, name, format_version, content_id, canonical_bytes)
			 VALUES ($1, $2, 'form', $3, $4, $5, $6)
			 RETURNING id, name, kind, format_version AS "formatVersion", content_id AS "contentId", created_at AS "createdAt"`,
			[id, ownerId, parsed.payload.name, parsed.payload.formatVersion, contentId, Buffer.from(bytes)]
		);
		const row = inserted.rows[0];
		if (row === undefined) throw new Error('The library item was not stored');
		return summaryOf(row);
	});
	return summary;
}

/** The owner's items, newest first. No bytes are listed. */
export async function listFormLibraryItems(
	pool: DatabasePool,
	ownerId: string
): Promise<FormLibraryItemSummary[]> {
	const rows = await queryRows<LibraryRow>(
		pool,
		`SELECT id, name, kind, format_version AS "formatVersion", content_id AS "contentId", created_at AS "createdAt"
		 FROM form_library_items
		 WHERE owner_id = $1
		 ORDER BY created_at DESC, id DESC`,
		[ownerId]
	);
	return rows.map(summaryOf);
}

/** One item's canonical bytes, for the owner only. */
export async function readFormLibraryItem(
	pool: DatabasePool,
	ownerId: string,
	id: string
): Promise<{ readonly summary: FormLibraryItemSummary; readonly bytes: Uint8Array }> {
	const rows = await queryRows<LibraryRow>(
		pool,
		`SELECT id, name, kind, format_version AS "formatVersion", content_id AS "contentId", created_at AS "createdAt", canonical_bytes AS "canonicalBytes"
		 FROM form_library_items
		 WHERE owner_id = $1 AND id = $2`,
		[ownerId, id]
	);
	const row = rows[0];
	if (row === undefined) throw new FormLibraryNotFoundError();
	return { summary: summaryOf(row), bytes: new Uint8Array(row.canonicalBytes as Buffer) };
}

/**
 * Remove one item. Copies already inserted are unaffected: they hold their own
 * source and no reference to the item. An id owned by someone else is not found.
 */
export async function removeFormLibraryItem(
	pool: DatabasePool,
	ownerId: string,
	id: string
): Promise<void> {
	const removed = await queryRows<{ id: string }>(
		pool,
		'DELETE FROM form_library_items WHERE owner_id = $1 AND id = $2 RETURNING id',
		[ownerId, id]
	);
	if (removed.length === 0) throw new FormLibraryNotFoundError();
}
