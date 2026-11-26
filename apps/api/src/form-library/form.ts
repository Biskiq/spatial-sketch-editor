import { listLibraryItems, readLibraryItem } from './items.js';
import {
	FORM_LIBRARY_MAX_ITEMS,
	readFormLibraryPayload,
	type FormLibraryItemSummary,
	type FormLibraryPayload,
} from '@portfolio/project-model/library';
import { sha256Bytes } from '@portfolio/project-model/package';
import { type DatabasePool } from '../database.js';
import {
	SHA256_IDENTITY,
	FormLibraryInputError,
	FormLibraryNotFoundError,
	type LibraryRow,
	SUMMARY_COLUMNS,
	isRecord,
	summaryOf,
} from './shared';
import { withTransaction } from '../project-persistence.js';
import { randomUUID } from 'node:crypto';

/**
 * Read one form Save request: exactly `{ contentId, payload }`, validated
 * through the shared codec. The content id is recomputed from the canonical
 * bytes, never trusted.
 */
export function parseFormLibrarySaveBody(body: unknown): {
	readonly contentId: string;
	readonly payload: FormLibraryPayload;
} {
	if (!isRecord(body)) {
		throw new FormLibraryInputError('invalid_library_item', 400, 'Expected a library item request');
	}
	const keys = Object.keys(body);
	if (keys.some((key) => key !== 'contentId' && key !== 'payload') || keys.length !== 2) {
		throw new FormLibraryInputError(
			'invalid_library_item',
			400,
			'Expected exactly a contentId and a payload',
		);
	}
	if (typeof body.contentId !== 'string' || !SHA256_IDENTITY.test(body.contentId)) {
		throw new FormLibraryInputError('invalid_library_item', 400, 'Expected a canonical content id');
	}
	const parsed = readFormLibraryPayload(body.payload);
	if (!parsed.success) {
		const first = parsed.issues[0];
		const tooLarge = first?.code === 'payload_too_large';
		throw new FormLibraryInputError(
			tooLarge ? 'payload_too_large' : 'invalid_library_item',
			tooLarge ? 413 : 400,
			first?.message ?? 'The library item is not valid',
		);
	}
	return { contentId: body.contentId, payload: parsed.payload };
}

/** Store one new form item, or refuse with a reason the editor can show. */
export async function saveFormLibraryItem(
	pool: DatabasePool,
	ownerId: string,
	body: unknown,
): Promise<FormLibraryItemSummary> {
	const parsed = parseFormLibrarySaveBody(body);
	const bytes = new TextEncoder().encode(JSON.stringify(parsed.payload));
	const contentId = await sha256Bytes(bytes);
	if (contentId !== parsed.contentId) {
		throw new FormLibraryInputError(
			'content_id_mismatch',
			400,
			'The item bytes do not match the content id they were sent as',
		);
	}
	const id = randomUUID();
	const summary = await withTransaction(pool, async (client) => {
		await client.query('INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [ownerId]);
		await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [ownerId]);
		const counted = await client.query<{ count: string }>(
			'SELECT count(*)::text AS count FROM form_library_items WHERE owner_id = $1',
			[ownerId],
		);
		const count = Number(counted.rows[0]?.count ?? 0);
		if (count >= FORM_LIBRARY_MAX_ITEMS) {
			throw new FormLibraryInputError(
				'library_full',
				409,
				`My Objects holds at most ${FORM_LIBRARY_MAX_ITEMS} items. Remove an item to save another.`,
			);
		}
		const inserted = await client.query<LibraryRow>(
			`INSERT INTO form_library_items
				(id, owner_id, kind, name, format_version, content_id, canonical_bytes)
			 VALUES ($1, $2, 'form', $3, $4, $5, $6)
			 RETURNING ${SUMMARY_COLUMNS}`,
			[
				id,
				ownerId,
				parsed.payload.name,
				parsed.payload.formatVersion,
				contentId,
				Buffer.from(bytes),
			],
		);
		const row = inserted.rows[0];
		if (row === undefined) throw new Error('The library item was not stored');
		const summary = summaryOf(row);
		if (summary.kind !== 'form') throw new Error('The inserted form item had the wrong kind');
		return summary;
	});
	return summary;
}

/** The historical form-only list, preserved for existing callers. */
export async function listFormLibraryItems(
	pool: DatabasePool,
	ownerId: string,
): Promise<FormLibraryItemSummary[]> {
	return (await listLibraryItems(pool, ownerId, 'form')) as FormLibraryItemSummary[];
}

/** The historical form read, preserved for existing callers. */
export async function readFormLibraryItem(
	pool: DatabasePool,
	ownerId: string,
	id: string,
): Promise<{ readonly summary: FormLibraryItemSummary; readonly bytes: Uint8Array }> {
	const read = await readLibraryItem(pool, ownerId, id);
	if (read.summary.kind !== 'form') throw new FormLibraryNotFoundError();
	return { summary: read.summary, bytes: read.bytes };
}
