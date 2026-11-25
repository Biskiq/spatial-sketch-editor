import { keyStillReferenced } from './shared.js';
import { type FormLibraryItemSummary } from '@portfolio/project-model/library';

import { type DatabasePool } from '../database.js';
import { type LibraryListKind, type LibraryItemSummary, FormLibraryNotFoundError, type LibraryRow, SUMMARY_COLUMNS, MATERIAL_SUMMARY_COLUMNS, readString, summaryOf } from './shared';
import { type ObjectStore } from '../object-store.js';
import { queryRows, withTransaction } from '../project-persistence.js';

/** The owner's items, newest first. No bytes are listed. */
export async function listLibraryItems(
  pool: DatabasePool,
  ownerId: string,
  kind: LibraryListKind = 'form'
): Promise<LibraryItemSummary[]> {
  const rows =
    kind === 'form'
      ? await queryRows<LibraryRow>(
          pool,
          `SELECT ${SUMMARY_COLUMNS}
					 FROM form_library_items
					 WHERE owner_id = $1 AND kind = 'form'
					 ORDER BY created_at DESC, id DESC`,
          [ownerId]
        )
      : kind === 'material'
        ? await queryRows<LibraryRow>(
            pool,
            `SELECT ${MATERIAL_SUMMARY_COLUMNS}
						 FROM form_library_items
						 WHERE owner_id = $1 AND kind = 'material'
						 ORDER BY created_at DESC, id DESC`,
            [ownerId]
          )
        : await queryRows<LibraryRow>(
            pool,
            `SELECT id, name, kind, format_version AS "formatVersion", content_id AS "contentId",
						 created_at AS "createdAt", recipe_hash AS "recipeHash",
						 (SELECT count(*)::int FROM material_library_images i WHERE i.item_id = form_library_items.id) AS "imageCount",
						 (thumbnail_key IS NOT NULL) AS "hasThumbnail"
						 FROM form_library_items
						 WHERE owner_id = $1
						 ORDER BY created_at DESC, id DESC`,
            [ownerId]
          );
  return rows.map(summaryOf);
}

/** The historical form-only list, preserved for existing callers. */
export async function listFormLibraryItems(
  pool: DatabasePool,
  ownerId: string
): Promise<FormLibraryItemSummary[]> {
  return (await listLibraryItems(pool, ownerId, 'form')) as FormLibraryItemSummary[];
}

/** One item's canonical bytes, for the owner only. */
export async function readLibraryItem(
  pool: DatabasePool,
  ownerId: string,
  id: string
): Promise<{ readonly summary: LibraryItemSummary; readonly bytes: Uint8Array }> {
  const rows = await queryRows<LibraryRow>(
    pool,
    `SELECT ${MATERIAL_SUMMARY_COLUMNS}, canonical_bytes AS "canonicalBytes"
		 FROM form_library_items
		 WHERE owner_id = $1 AND id = $2::uuid`,
    [ownerId, id]
  );
  const row = rows[0];
  if (row === undefined) throw new FormLibraryNotFoundError();
  return { summary: summaryOf(row), bytes: new Uint8Array(row.canonicalBytes as Buffer) };
}

export async function reclaimIfUnreferenced(
  pool: DatabasePool,
  store: ObjectStore,
  key: string
): Promise<void> {
  try {
    if (await keyStillReferenced(pool, key)) return;
    await store.delete?.(key);
  } catch {
    // A later expiry pass or purge will collect the key.
  }
}

/**
 * Remove one item. Copies already inserted are unaffected: they hold their own
 * source and no reference to the item. Child image rows cascade; private keys
 * are reclaimed only when no committed row owns them.
 */
export async function removeFormLibraryItem(
  pool: DatabasePool,
  ownerId: string,
  id: string,
  objectStore?: ObjectStore
): Promise<void> {
  const removed = await withTransaction(pool, async (client) => {
    const row = await queryRows<{ id: unknown }>(
      client,
      `SELECT id FROM form_library_items WHERE owner_id = $1 AND id = $2::uuid FOR UPDATE`,
      [ownerId, id]
    );
    if (row[0] === undefined) throw new FormLibraryNotFoundError();
    const keys = await queryRows<{ key: unknown }>(
      client,
      `SELECT object_key AS key FROM material_library_images WHERE item_id = $1::uuid AND object_key IS NOT NULL
			 UNION ALL
			 SELECT thumbnail_key AS key FROM form_library_items WHERE id = $1::uuid AND thumbnail_key IS NOT NULL`,
      [id]
    );
    await client.query('DELETE FROM form_library_items WHERE owner_id = $1 AND id = $2::uuid', [ownerId, id]);
    return keys.map((entry) => readString(entry.key));
  });
  if (objectStore !== undefined) {
    for (const key of removed) await reclaimIfUnreferenced(pool, objectStore, key);
  }
}

export type AbandonedStagingRow = {
  id: unknown;
  key: unknown;
  referenced: unknown;
};

/**
 * Reclaim one owner's expired staging keys, bytes included.
 *
 * This is the model-staging pattern, not a background worker: a scoped library
 * or transfer access performs it first. One statement claims every expired
 * staging row before checking committed references, so a delayed commit can no
 * longer adopt a claimed key and a key that a committed item, thumbnail or
 * destination asset row names is never deleted.
 */
export async function expireAbandonedLibraryStaging(
  pool: DatabasePool,
  store: ObjectStore | undefined,
  ownerId: string
): Promise<void> {
  if (!store) return;
  const claimed = await queryRows<AbandonedStagingRow>(
    pool,
    `WITH candidate AS (
			SELECT id FROM library_staging
			WHERE owner_id = $1 AND expires_at <= now()
			ORDER BY expires_at ASC
			LIMIT 100
		),
		claimed AS (
			DELETE FROM library_staging s
			USING candidate c
			WHERE s.id = c.id AND s.owner_id = $1
			RETURNING s.id, s.object_key
		)
		SELECT c.id, c.object_key AS key, (
			EXISTS (SELECT 1 FROM material_library_images m WHERE m.object_key = c.object_key)
			OR EXISTS (SELECT 1 FROM form_library_items f WHERE f.thumbnail_key = c.object_key)
			OR EXISTS (SELECT 1 FROM assets a WHERE a.object_key = c.object_key)
		) AS referenced
		FROM claimed c`,
    [ownerId]
  );
  for (const entry of claimed) {
    if (entry.referenced === true) continue;
    const key = readString(entry.key);
    try {
      await store.delete?.(key);
    } catch {
      // Best effort: the staging row is already claimed; an orphan is collected by namespace purge.
    }
  }
}
