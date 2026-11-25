import { expireAbandonedImageRepairs } from './cleanup.js';
import { verifyHealthyRow, writeChunk, deleteStagedKey, forgetAttempt } from './shared.js';
import { ARTWORK_MAX_BYTES, probeArtworkImage } from '@portfolio/project-model/artwork';
import { type ProjectImagePin } from '@portfolio/project-model/project-images';
import { UNIT_ENVELOPE_SOURCE_FORMAT, validateProjectEnvelope, type ProjectEnvelope } from '@portfolio/project-model/units';
import { ArtworkAssetRefusal, ImageVerificationUnavailableError, readProjectImagePin, type ArtworkAssetPin } from '../artwork-persistence.js';
import { type DatabaseClient, type DatabasePool } from '../database.js';
import { IMAGE_REPAIR_TTL_MS, type ImageRepairRequest, type ImageRepairAcknowledgement, ImageRepairError, pinOf, type ImageRequirement, requirementFor, asImageRepairError, createRepairKey, toBuffer, readNullableString, readSafeInteger } from './shared';
import { type ObjectStore } from '../object-store.js';
import { ProjectNotFoundError, queryRows, withTransaction } from '../project-persistence.js';
import { withProjectWriteLease, type ProjectLifecyclePolicy } from '../project-write-lease.js';
import { createHash, randomUUID } from 'node:crypto';
import { PassThrough, Readable } from 'node:stream';

export type ProjectLockRow = {
	id: unknown;
	savedBaseToken: unknown;
	latestVersion: unknown;
};

export async function lockProject(
	db: Pick<DatabasePool, 'query'>,
	ownerId: string,
	projectId: string
): Promise<ProjectLockRow> {
	const rows = await queryRows<ProjectLockRow>(
		db,
		`SELECT id, saved_base_token AS "savedBaseToken", latest_version AS "latestVersion"
FROM projects
WHERE id = $1 AND owner_id = $2
FOR UPDATE`,
		[projectId, ownerId]
	);
	const row = rows[0];
	if (!row) throw new ProjectNotFoundError();
	return row;
}

export async function readSavedHead(
	db: Pick<DatabasePool, 'query'>,
	projectId: string,
	latestVersion: number
): Promise<ProjectEnvelope> {
	const rows = await queryRows<{ document: unknown; sourceFormat: unknown }>(
		db,
		`SELECT document, source_format AS "sourceFormat"
FROM project_versions
WHERE project_id = $1 AND version = $2 AND source_format = $3`,
		[projectId, latestVersion, UNIT_ENVELOPE_SOURCE_FORMAT]
	);
	const row = rows[0];
	if (!row) {
		throw new ImageRepairError(409, 'image_pin_changed', 'The saved head is unavailable; source recovery is required.');
	}
	const validation = validateProjectEnvelope(row.document);
	if (!validation.success) {
		throw new ImageRepairError(409, 'image_pin_changed', 'The saved head cannot be verified; source recovery is required.');
	}
	return validation.envelope;
}

/** How many times a winner that keeps moving is re-read before this attempt gives up. */
export const CONCURRENT_WINNER_ROUNDS = 3;

/** The phase-1 facts every later transaction re-proves. */
export type RepairPreparation = {
	readonly pin: ProjectImagePin;
	readonly oldObjectKey: string;
	readonly artwork: ArtworkAssetPin['artwork'];
};

/** One current row observed under a lock; its bytes are verified only after release. */
export type ObservedImage = {
	readonly pin: ProjectImagePin;
	readonly objectKey: string;
	readonly artwork: ArtworkAssetPin['artwork'];
};

export type RepairCommit =
	| { readonly kind: 'swapped'; readonly pin: ProjectImagePin; readonly oldObjectKey: string }
	| { readonly kind: 'winner'; readonly candidate: ObservedImage };

export function observe(pin: ArtworkAssetPin): ObservedImage {
	return { pin: pinOf(pin), objectKey: pin.objectKey, artwork: pin.artwork };
}

/**
 * Re-prove owner, saved base, saved-head membership and the pinned identity under
 * the project-then-asset update lock. No object-store read is allowed here: a row
 * that moved while this attempt streamed is only observed and verified later.
 */
export async function lockRepairState(
	db: DatabaseClient,
	ownerId: string,
	projectId: string,
	assetId: string,
	request: ImageRepairRequest,
	prepared: RepairPreparation
): Promise<{ readonly current: ArtworkAssetPin; readonly requirement: ImageRequirement }> {
	const locked = await lockProject(db, ownerId, projectId);
	if (readNullableString(locked.savedBaseToken) !== request.savedBaseToken) {
		throw new ImageRepairError(409, 'conflict', 'The saved base changed; reload the project before repairing.');
	}
	const latestVersion = readSafeInteger(locked.latestVersion);
	const envelope = await readSavedHead(db, projectId, latestVersion);
	const requirement = requirementFor(envelope, assetId);
	const current = await readProjectImagePin(db, ownerId, projectId, requirement, 'update');
	const authoritative = pinOf(current);
	if (
		authoritative.hash !== prepared.pin.hash ||
		authoritative.mime !== prepared.pin.mime ||
		authoritative.size !== prepared.pin.size
	) {
		throw new ImageRepairError(
			409,
			'image_pin_changed',
			'The saved revision pins different image bytes; source recovery is required.'
		);
	}
	return { current, requirement };
}

/**
 * Commit one streamed attempt. It either swaps its staging key in or observes a
 * concurrent winner for verification after the locks are released; it never
 * reads object bytes.
 */
export async function commitRepair(
	db: DatabaseClient,
	ownerId: string,
	projectId: string,
	assetId: string,
	request: ImageRepairRequest,
	prepared: RepairPreparation,
	attemptId: string,
	stagingKey: string
): Promise<RepairCommit> {
	const { current, requirement } = await lockRepairState(
		db,
		ownerId,
		projectId,
		assetId,
		request,
		prepared
	);
	if (current.objectKey !== prepared.oldObjectKey) {
		return { kind: 'winner', candidate: observe(current) };
	}
	// Consuming this attempt's row is the adoption right. An attempt whose row the
	// expiry sweep already claimed is fenced off and can never swap its key in.
	const claimed = await queryRows<{ id: unknown }>(
		db,
		`DELETE FROM image_repair_attempts
WHERE id = $1::uuid AND project_id = $2 AND owner_id = $3
RETURNING id`,
		[attemptId, projectId, ownerId]
	);
	if (!claimed[0]) {
		throw new ImageRepairError(
			409,
			'conflict',
			'The repair attempt expired before it could be committed; retry the repair.'
		);
	}
	const updated = await queryRows<{ id: unknown }>(
		db,
		`UPDATE assets
SET object_key = $3, updated_at = now()
WHERE id = $1::uuid AND project_id = $2 AND object_key = $4 AND import_state = 'ready'
RETURNING id`,
		[assetId, projectId, stagingKey, prepared.oldObjectKey]
	);
	if (!updated[0]) {
		// Defensive: the row moved despite the update lock. Verify the winner
		// outside this transaction like any other concurrent winner.
		const winner = await readProjectImagePin(db, ownerId, projectId, requirement, 'update');
		return { kind: 'winner', candidate: observe(winner) };
	}
	return { kind: 'swapped', pin: prepared.pin, oldObjectKey: prepared.oldObjectKey };
}

export async function verifyObservedBytes(
	store: ObjectStore,
	assetId: string,
	observed: ObservedImage
): Promise<void> {
	await verifyHealthyRow(store, {
		assetId,
		mime: observed.pin.mime,
		byteSize: observed.pin.size,
		sha256: observed.pin.hash,
		objectKey: observed.objectKey,
		paths: [],
		expectedPin: observed.pin,
		artwork: observed.artwork
	});
}

/**
 * Accept a concurrent winner. Its bytes are verified outside every transaction,
 * then its exact row identity, pin and object key are re-proved under a fresh
 * lock; a row that moved again is verified in the next round, so a success always
 * names bytes this attempt has read while holding nothing.
 */
export async function acceptObservedImage(
	pool: DatabasePool,
	store: ObjectStore,
	ownerId: string,
	projectId: string,
	assetId: string,
	request: ImageRepairRequest,
	prepared: RepairPreparation,
	attemptId: string,
	first: ObservedImage,
	signal: AbortSignal
): Promise<{ readonly pin: ProjectImagePin }> {
	let candidate = first;
	for (let round = 0; round < CONCURRENT_WINNER_ROUNDS; round += 1) {
		signal.throwIfAborted();
		try {
			await verifyObservedBytes(store, assetId, candidate);
		} catch (error) {
			if (error instanceof ArtworkAssetRefusal) {
				throw new ImageRepairError(
					409,
					'conflict',
					'The image changed while repairing but its bytes do not match the saved pin; reload and retry.'
				);
			}
			throw asImageRepairError(error);
		}
		const revalidated = await withTransaction(pool, async (db) => {
			const { current } = await lockRepairState(db, ownerId, projectId, assetId, request, prepared);
			if (
				current.objectKey !== candidate.objectKey ||
				current.sha256 !== candidate.pin.hash ||
				current.mime !== candidate.pin.mime ||
				current.byteSize !== candidate.pin.size
			) {
				return { kind: 'changed' as const, candidate: observe(current) };
			}
			await db.query(
				'DELETE FROM image_repair_attempts WHERE id = $1::uuid AND project_id = $2 AND owner_id = $3',
				[attemptId, projectId, ownerId]
			);
			return { kind: 'verified' as const, pin: candidate.pin };
		});
		if (revalidated.kind === 'verified') return { pin: revalidated.pin };
		candidate = revalidated.candidate;
	}
	throw new ImageRepairError(409, 'conflict', 'The image keeps changing while repairing; reload and retry.');
}

/**
 * Stream the supplied original to a fresh key and prove it is the pinned image.
 *
 * The declared length is the pin's size, so an over-long body is refused without
 * buffering past the 25 MiB image cap. A failure deletes the staging key; the
 * old key is never touched here.
 */
export async function streamRepairBytes(
	source: Readable,
	contentLength: number,
	store: ObjectStore,
	key: string,
	pin: ProjectImagePin,
	artwork: ArtworkAssetPin['artwork'],
	signal: AbortSignal
): Promise<void> {
	if (contentLength !== pin.size) {
		throw new ImageRepairError(422, 'image_mismatch', 'The supplied file length does not match the pinned image.');
	}
	const output = new PassThrough();
	output.on('error', () => {});
	const hash = createHash('sha256');
	const bytes = new Uint8Array(contentLength);
	let offset = 0;
	let put: Promise<void> | undefined;
	const onAbort = () => {
		const error = signal.reason instanceof Error ? signal.reason : new Error('Image repair aborted');
		source.destroy(error);
		output.destroy(error);
	};
	signal.addEventListener('abort', onAbort, { once: true });
	if (signal.aborted) onAbort();

	try {
		put = store.put(key, output, {
			contentType: pin.mime,
			contentLength,
			signal
		});
		// A rejected storage put must not become an unhandled rejection while the
		// request body is still being consumed; destroying the sink releases a
		// writer waiting on `drain`.
		put.catch((error: unknown) => {
			const reason = error instanceof Error ? error : new Error('Image staging failed');
			if (!output.destroyed) output.destroy(reason);
		});
		for await (const value of source) {
			const chunk = toBuffer(value);
			if (offset + chunk.length > contentLength) {
				throw new ImageRepairError(422, 'image_mismatch', 'The supplied file is longer than the pinned image.');
			}
			bytes.set(Uint8Array.from(chunk), offset);
			offset += chunk.length;
			hash.update(chunk as unknown as Uint8Array<ArrayBuffer>);
			await writeChunk(output, chunk);
			signal.throwIfAborted();
		}
		if (offset !== contentLength) {
			throw new ImageRepairError(422, 'image_mismatch', 'The supplied file ended before the pinned length.');
		}
		output.end();
		await put;
		const digest = `sha256-${hash.digest('hex')}`;
		if (digest !== pin.hash) {
			throw new ImageRepairError(422, 'image_mismatch', 'The supplied file is not the pinned image.');
		}
		let decoded: ReturnType<typeof probeArtworkImage>;
		try {
			decoded = probeArtworkImage(bytes);
		} catch {
			throw new ImageRepairError(422, 'image_mismatch', 'The supplied file is not a supported static image.');
		}
		if (decoded.mime !== pin.mime) {
			throw new ImageRepairError(422, 'image_mismatch', 'The supplied file has a different image format.');
		}
		if (
			artwork !== null &&
			(decoded.pixelWidth !== artwork.pixelWidth || decoded.pixelHeight !== artwork.pixelHeight)
		) {
			throw new ImageRepairError(422, 'image_mismatch', 'The supplied file dimensions differ from the saved Artwork.');
		}
	} catch (error) {
		const streamError = error instanceof Error ? error : new Error('Image repair failed');
		// Drain rather than destroy Fastify's request stream: the refusal is the
		// route's response, not a transport failure, and the response must complete.
		source.resume();
		output.destroy(streamError);
		if (put) {
			try {
				await put;
			} catch {
				// The original refusal is reported.
			}
		}
		signal.removeEventListener('abort', onAbort);
		if (error instanceof ImageRepairError) throw error;
		if (signal.aborted) {
			throw signal.reason instanceof Error ? signal.reason : new ImageRepairError(503, 'service_unavailable', 'Image repair was aborted');
		}
		throw new ImageRepairError(503, 'service_unavailable', 'Image storage is unavailable; retry the repair.');
	} finally {
		signal.removeEventListener('abort', onAbort);
	}
}

/**
 * Repair one owned project image from its exact original bytes.
 *
 * `savedBaseToken` is the token the editor loaded with, so a repair cannot be
 * applied to a head the creator has not seen. `expectedPin` is the digest the
 * editor displayed; a different saved pin is a conflict, not a request to
 * overwrite it.
 */
export async function repairProjectImage(
	pool: DatabasePool,
	ownerId: string,
	projectId: string,
	assetId: string,
	request: ImageRepairRequest,
	contentLength: number,
	body: Readable,
	store: ObjectStore | undefined,
	objectNamespace: string,
	options: { parentSignal?: AbortSignal; policy?: ProjectLifecyclePolicy } = {}
): Promise<ImageRepairAcknowledgement> {
	if (!store) throw new ImageRepairError(503, 'service_unavailable', 'Image storage is unavailable');
	if (!Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > ARTWORK_MAX_BYTES) {
		throw new ImageRepairError(422, 'image_mismatch', 'The supplied file is outside the image size bounds.');
	}
	try {
		await expireAbandonedImageRepairs(pool, store, projectId, ownerId);
	} catch {
		// Cleanup is best effort; the repair's own attempt is still recorded.
	}

	const attemptId = randomUUID();
	const stagingKey = createRepairKey(projectId, assetId, objectNamespace, attemptId);

	return withProjectWriteLease(
		pool,
		ownerId,
		projectId,
		async ({ signal }) => {
			let prepared: RepairPreparation;
			try {
				prepared = await withTransaction(pool, async (db) => {
					const locked = await lockProject(db, ownerId, projectId);
					if (readNullableString(locked.savedBaseToken) !== request.savedBaseToken) {
						throw new ImageRepairError(409, 'conflict', 'The saved base changed; reload the project before repairing.');
					}
					const latestVersion = readSafeInteger(locked.latestVersion);
					const envelope = await readSavedHead(db, projectId, latestVersion);
					const requirement = requirementFor(envelope, assetId);
					const pin = await readProjectImagePin(db, ownerId, projectId, requirement, 'update');
					const authoritative = pinOf(pin);
					if (authoritative.hash !== request.expectedPin) {
						throw new ImageRepairError(
							409,
							'image_pin_changed',
							'The saved revision pins different image bytes; source recovery is required.'
						);
					}
					await db.query(
						`INSERT INTO image_repair_attempts (
	id, project_id, owner_id, asset_id, expected_pin, saved_base_token, staging_key, expires_at
)
VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6, $7, now() + $8::interval)`,
						[
							attemptId,
							projectId,
							ownerId,
							assetId,
							authoritative.hash,
							request.savedBaseToken,
							stagingKey,
							`${IMAGE_REPAIR_TTL_MS} milliseconds`
						]
					);
					return { pin: authoritative, oldObjectKey: pin.objectKey, artwork: pin.artwork };
				});
			} catch (error) {
				throw asImageRepairError(error);
			}

			// An already healthy row is the lost-response / retry case: report success
			// without writing another object or moving the key. A transient read
			// failure falls through to a fresh staged attempt.
			try {
				await verifyHealthyRow(store, {
					assetId,
					mime: prepared.pin.mime,
					byteSize: prepared.pin.size,
					sha256: prepared.pin.hash,
					objectKey: prepared.oldObjectKey,
					paths: [],
					expectedPin: prepared.pin,
					artwork: prepared.artwork
				});
				await forgetAttempt(pool, attemptId);
				return { projectId, assetId, pin: prepared.pin, replaced: false };
			} catch (error) {
				if (error instanceof ImageVerificationUnavailableError) {
					// The supplied original is still the fallback for a transient read.
				} else if (!(error instanceof ArtworkAssetRefusal)) {
					throw error;
				}
			}

			try {
				await streamRepairBytes(body, contentLength, store, stagingKey, prepared.pin, prepared.artwork, signal);
			} catch (error) {
				if (await deleteStagedKey(store, stagingKey)) await forgetAttempt(pool, attemptId);
				throw asImageRepairError(error);
			}

			let commit: RepairCommit;
			try {
				commit = await withTransaction(pool, (db) =>
					commitRepair(db, ownerId, projectId, assetId, request, prepared, attemptId, stagingKey)
				);
			} catch (error) {
				if (await deleteStagedKey(store, stagingKey)) await forgetAttempt(pool, attemptId);
				throw asImageRepairError(error);
			}

			if (commit.kind === 'winner') {
				// Verification and revalidation run outside every transaction, so a slow
				// object store can never hold the project or asset locks.
				let accepted: { readonly pin: ProjectImagePin };
				try {
					accepted = await acceptObservedImage(
						pool,
						store,
						ownerId,
						projectId,
						assetId,
						request,
						prepared,
						attemptId,
						commit.candidate,
						signal
					);
				} catch (error) {
					if (await deleteStagedKey(store, stagingKey)) await forgetAttempt(pool, attemptId);
					throw asImageRepairError(error);
				}
				// The winner's key is live; this attempt's own staging key is not, so
				// release it instead of leaving an unreferenced object behind.
				await deleteStagedKey(store, stagingKey);
				return { projectId, assetId, pin: accepted.pin, replaced: false };
			}

			if (commit.oldObjectKey !== stagingKey) {
				// The superseded key is retired only after the new key is committed.
				try {
					await store.delete?.(commit.oldObjectKey);
				} catch {
					// An orphaned old key remains in deletion inventory; the ready row
					// already names the verified replacement.
				}
			}
			return { projectId, assetId, pin: commit.pin, replaced: true };
		},
		options
	);
}
