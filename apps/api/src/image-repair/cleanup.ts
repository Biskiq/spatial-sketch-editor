import { type DatabasePool } from '../database.js';
import { readString } from './shared';
import { type ObjectStore } from '../object-store.js';
import { queryRows } from '../project-persistence.js';

export type AbandonedAttemptRow = {
	id: unknown;
	stagingKey: unknown;
	referenced: unknown;
};

/**
 * Collect expired repair attempts for one owned project.
 *
 * One statement claims every expired attempt, so the removal of its adoption
 * right commits before any object is deleted. A delayed attempt can no longer
 * swap a claimed key into its asset row (`repairProjectImage` must consume its
 * own attempt to commit), and the reference check runs after the claim, so a key
 * that a ready row names is never deleted. An attempt whose delete fails leaves
 * an orphan for the namespace purge, exactly like model staging. Called by the
 * next scoped asset access and at the start of every repair: there is no
 * background worker.
 */
export async function expireAbandonedImageRepairs(
	db: Pick<DatabasePool, 'query'>,
	store: ObjectStore | undefined,
	projectId: string,
	ownerId: string
): Promise<number> {
	if (!store) return 0;
	const claimed = await queryRows<AbandonedAttemptRow>(
		db,
		`WITH claimed AS (
	DELETE FROM image_repair_attempts
	WHERE project_id = $1 AND owner_id = $2 AND expires_at <= now()
	RETURNING id, staging_key
)
SELECT c.id, c.staging_key AS "stagingKey",
	EXISTS (SELECT 1 FROM assets a WHERE a.object_key = c.staging_key) AS referenced
FROM claimed c`,
		[projectId, ownerId]
	);
	for (const row of claimed) {
		if (row.referenced === true) continue;
		const key = readString(row.stagingKey);
		// The claim already fenced this attempt off; a failed delete is collected by
		// the namespace purge rather than resurrecting an adoption right.
		try {
			await store.delete?.(key);
		} catch {
			// Best effort, as above.
		}
	}
	return claimed.length;
}
