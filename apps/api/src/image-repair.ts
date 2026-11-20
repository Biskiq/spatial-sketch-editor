/**
 * Exact-byte project image repair (T2.S8 · PR C).
 *
 * A repair restores the physical object behind an existing ready P20 row. It is
 * not a new asset, not a source revision and not a receipt: the Scene record,
 * the resource pin, the asset id, the saved head and its history all stay exactly
 * as they were. Only `assets.object_key` moves, and only after the supplied bytes
 * have proved themselves against the pin the saved revision already carries.
 *
 * The protocol is two phases around the stream:
 *
 * 1. Under the project row then asset row lock, prove ownership, the loaded saved
 *    base, the asset's membership in the saved image closure and the exact pin.
 *    Record one attempt with its fresh private staging key and 24-hour expiry,
 *    then commit — no object write happens while a database lock is held.
 * 2. Stream the supplied original to the staging key, verifying length, digest,
 *    MIME and any declared dimensions. Then take the same locks again, re-prove
 *    the base and pin, and conditionally swap the key only if it is still the one
 *    phase 1 observed. A concurrent winner is accepted only after its bytes are
 *    verified; a changed pin or base is a conflict.
 *
 * A lost response is safe to retry: the healthy-row check returns success without
 * a write. A wrong file, a stale base or a lost race leaves the old key and the
 * open editor session untouched. Failed or crashed attempts remain discoverable
 * by the next scoped asset access, which removes their staging key once no asset
 * row references it (the existing model-staging pattern).
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PassThrough, Readable } from 'node:stream';

import { ARTWORK_MAX_BYTES, probeArtworkImage } from '@portfolio/project-model';
import {
	collectEnvelopeImageRequirements,
	type ProjectImagePin
} from '@portfolio/project-model/project-images';
import { isSavedBaseToken } from '@portfolio/project-model/save';
import {
	UNIT_ENVELOPE_SOURCE_FORMAT,
	validateProjectEnvelope,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

import {
	ArtworkAssetRefusal,
	ImageVerificationUnavailableError,
	readProjectImagePin,
	type ArtworkAssetPin
} from './artwork-persistence.js';
import type { DatabasePool } from './database.js';
import type { ObjectStore } from './object-store.js';
import { ProjectNotFoundError, queryRows, withTransaction } from './project-persistence.js';
import { withProjectWriteLease, type ProjectLifecyclePolicy } from './project-write-lease.js';

/** An abandoned attempt is collected after 24 hours, bytes included. */
const IMAGE_REPAIR_TTL_MS = 24 * 60 * 60 * 1000;
const SHA256_PATTERN = /^sha256-[0-9a-f]{64}$/;

export type ImageRepairRequest = {
	readonly expectedPin: string;
	readonly savedBaseToken: string;
};

export type ImageRepairAcknowledgement = {
	readonly projectId: string;
	readonly assetId: string;
	readonly pin: ProjectImagePin;
	readonly replaced: boolean;
};

export class ImageRepairError extends Error {
	constructor(
		readonly statusCode: 400 | 404 | 409 | 422 | 503,
		readonly code:
			| 'invalid_repair'
			| 'not_found'
			| 'image_pin_changed'
			| 'image_mismatch'
			| 'conflict'
			| 'service_unavailable',
		message: string
	) {
		super(message);
		this.name = 'ImageRepairError';
	}
}

/** Strict read of the repair's two query parameters. */
export function readImageRepairRequest(query: unknown): ImageRepairRequest | ImageRepairError {
	if (typeof query !== 'object' || query === null || Array.isArray(query)) {
		return new ImageRepairError(400, 'invalid_repair', 'Repair requires expectedPin and savedBase');
	}
	const values = query as Record<string, unknown>;
	if (Object.keys(values).length !== 2) {
		return new ImageRepairError(400, 'invalid_repair', 'Repair requires exactly expectedPin and savedBase');
	}
	const expectedPin = values.expectedPin;
	const savedBaseToken = values.savedBase;
	if (typeof expectedPin !== 'string' || !SHA256_PATTERN.test(expectedPin)) {
		return new ImageRepairError(400, 'invalid_repair', 'expectedPin must be a sha256 image identity');
	}
	if (!isSavedBaseToken(savedBaseToken)) {
		return new ImageRepairError(400, 'invalid_repair', 'savedBase must be the loaded saved-base token');
	}
	return { expectedPin, savedBaseToken };
}

type ProjectLockRow = {
	id: unknown;
	savedBaseToken: unknown;
	latestVersion: unknown;
};

type SavedHeadSnapshot = {
	readonly envelope: ProjectEnvelope;
	readonly savedBaseToken: string;
	readonly latestVersion: number;
};

async function lockProject(
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

async function readSavedHead(
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

function pinOf(pin: ArtworkAssetPin): ProjectImagePin {
	return { hash: pin.sha256, mime: pin.mime, size: pin.byteSize };
}

function requirementFor(
	envelope: ProjectEnvelope,
	assetId: string
): ReturnType<typeof collectEnvelopeImageRequirements>['requirements'][number] {
	const closure = collectEnvelopeImageRequirements(envelope, 'private-save');
	if (closure.issues.length > 0) {
		throw new ImageRepairError(409, 'image_pin_changed', 'The saved image closure cannot be verified; source recovery is required.');
	}
	const requirement = closure.requirements.find((candidate) => candidate.assetId === assetId);
	if (requirement === undefined) {
		throw new ImageRepairError(404, 'not_found', 'This image is not part of the saved project.');
	}
	return requirement;
}

function repairErrorFromRefusal(error: ArtworkAssetRefusal): ImageRepairError {
	if (error.code === 'image-missing') {
		return new ImageRepairError(
			404,
			'not_found',
			'The image has no ready registry record in this project; source recovery is required.'
		);
	}
	if (error.code === 'image-pin-changed') {
		return new ImageRepairError(
			409,
			'image_pin_changed',
			'The saved revision pins different image bytes; source recovery is required.'
		);
	}
	return new ImageRepairError(409, 'image_pin_changed', error.message);
}

function asImageRepairError(error: unknown): unknown {
	if (error instanceof ArtworkAssetRefusal) return repairErrorFromRefusal(error);
	if (error instanceof ImageVerificationUnavailableError) {
		return new ImageRepairError(503, 'service_unavailable', 'Image storage is unavailable; retry the repair.');
	}
	return error;
}

function createRepairKey(projectId: string, assetId: string, objectNamespace: string, attemptId: string): string {
	return `projects/${objectNamespace}/${projectId}/assets/${assetId}/repair-${attemptId}-${randomBytes(8).toString('hex')}`;
}

async function readObjectBytes(store: ObjectStore, key: string, byteSize: number): Promise<Uint8Array> {
	const stored = await store.get(key);
	if (!stored) throw new ArtworkAssetRefusal('', 'Image bytes are missing.', { code: 'image-missing' });
	try {
		if (stored.contentLength !== byteSize) {
			throw new ArtworkAssetRefusal('', 'The stored image length differs from its pin.', { code: 'image-corrupt' });
		}
		const bytes = new Uint8Array(byteSize);
		let length = 0;
		for await (const chunk of stored.body) {
			const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			if (length + part.length > bytes.length) {
				throw new ArtworkAssetRefusal('', 'The stored image exceeds its pin.', { code: 'image-corrupt' });
			}
			bytes.set(Uint8Array.from(part), length);
			length += part.length;
		}
		if (length !== byteSize) {
			throw new ArtworkAssetRefusal('', 'The stored image ended before its pin.', { code: 'image-corrupt' });
		}
		return bytes;
	} finally {
		stored.body.destroy();
	}
}

/** A bounded read retry for transient object-store failures. */
async function readStoredBytesWithRetry(store: ObjectStore, key: string, byteSize: number): Promise<Uint8Array> {
	let last: unknown;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			return await readObjectBytes(store, key, byteSize);
		} catch (error) {
			if (error instanceof ArtworkAssetRefusal) throw error;
			last = error;
		}
	}
	throw new ImageVerificationUnavailableError(undefined, last);
}

async function verifyHealthyRow(store: ObjectStore, pin: ArtworkAssetPin): Promise<void> {
	const bytes = await readStoredBytesWithRetry(store, pin.objectKey, pin.byteSize);
	const digest = `sha256-${createHash('sha256').update(bytes).digest('hex')}`;
	if (digest !== pin.sha256) {
		throw new ArtworkAssetRefusal('', 'The stored image differs from its pin.', { code: 'image-corrupt' });
	}
	let decoded: ReturnType<typeof probeArtworkImage>;
	try {
		decoded = probeArtworkImage(bytes);
	} catch {
		throw new ArtworkAssetRefusal('', 'The stored image is not a supported static image.', { code: 'image-corrupt' });
	}
	if (
		decoded.mime !== pin.mime ||
		(pin.artwork !== null &&
			(decoded.pixelWidth !== pin.artwork.pixelWidth || decoded.pixelHeight !== pin.artwork.pixelHeight))
	) {
		throw new ArtworkAssetRefusal('', 'The stored image MIME or dimensions differ from its pin.', { code: 'image-corrupt' });
	}
}

function toBuffer(value: unknown): Buffer {
	if (Buffer.isBuffer(value)) return value;
	if (value instanceof Uint8Array) return Buffer.from(value);
	throw new Error('Repair request stream yielded a non-byte chunk');
}

async function writeChunk(stream: PassThrough, chunk: Buffer): Promise<void> {
	if (stream.destroyed) throw new Error('Image staging failed');
	if (stream.write(chunk)) return;
	await new Promise<void>((resolve, reject) => {
		const onDrain = () => {
			cleanup();
			resolve();
		};
		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};
		const cleanup = () => {
			stream.off('drain', onDrain);
			stream.off('error', onError);
		};
		stream.once('drain', onDrain);
		stream.once('error', onError);
	});
}

async function deleteStagedKey(store: ObjectStore, key: string): Promise<boolean> {
	if (store.delete === undefined) return false;
	try {
		await store.delete(key);
		return true;
	} catch {
		// The attempt row and the next expiry sweep remain the durable cleanup path.
		return false;
	}
}

async function forgetAttempt(pool: Pick<DatabasePool, 'query'>, attemptId: string): Promise<void> {
	try {
		await pool.query('DELETE FROM image_repair_attempts WHERE id = $1::uuid', [attemptId]);
	} catch {
		// An expired attempt is collected by the next scoped asset access.
	}
}

/**
 * Stream the supplied original to a fresh key and prove it is the pinned image.
 *
 * The declared length is the pin's size, so an over-long body is refused without
 * buffering past the 25 MiB image cap. A failure deletes the staging key; the
 * old key is never touched here.
 */
async function streamRepairBytes(
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
			type Prepared = {
				readonly pin: ProjectImagePin;
				readonly oldObjectKey: string;
				readonly artwork: ArtworkAssetPin['artwork'];
			};
			let prepared: Prepared;
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

			type Committed = {
				readonly pin: ProjectImagePin;
				readonly replaced: boolean;
				readonly oldObjectKey: string | null;
			};
			let committed: Committed;
			try {
				committed = await withTransaction(pool, async (db) => {
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
					if (current.objectKey !== prepared.oldObjectKey) {
						// Another repair (or a concurrent write) moved the key while this
						// attempt streamed. Its bytes must prove themselves before this
						// attempt reports success.
						try {
							await verifyHealthyRow(store, current);
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
						await db.query('DELETE FROM image_repair_attempts WHERE id = $1::uuid', [attemptId]);
						return { pin: authoritative, replaced: false, oldObjectKey: null };
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
						// Lost a conditional swap. Re-read under the lock; a healthy winner
						// is success, anything else is a conflict for this attempt.
						const winner = await readProjectImagePin(db, ownerId, projectId, requirement, 'update');
						try {
							await verifyHealthyRow(store, winner);
						} catch (error) {
							if (error instanceof ArtworkAssetRefusal) {
								throw new ImageRepairError(409, 'conflict', 'The image changed while repairing; reload and retry.');
							}
							throw asImageRepairError(error);
						}
						await db.query('DELETE FROM image_repair_attempts WHERE id = $1::uuid', [attemptId]);
						return { pin: pinOf(winner), replaced: false, oldObjectKey: null };
					}
					await db.query('DELETE FROM image_repair_attempts WHERE id = $1::uuid', [attemptId]);
					return { pin: authoritative, replaced: true, oldObjectKey: prepared.oldObjectKey };
				});
			} catch (error) {
				if (await deleteStagedKey(store, stagingKey)) await forgetAttempt(pool, attemptId);
				throw asImageRepairError(error);
			}

			if (committed.replaced && committed.oldObjectKey !== null && committed.oldObjectKey !== stagingKey) {
				// The superseded key is retired only after the new key is committed.
				try {
					await store.delete?.(committed.oldObjectKey);
				} catch {
					// An orphaned old key remains in deletion inventory; the ready row
					// already names the verified replacement.
				}
			} else if (!committed.replaced) {
				// A concurrent winner's key is live; this attempt's own staging key is
				// not, so release it instead of leaving an unreferenced object behind.
				await deleteStagedKey(store, stagingKey);
			}
			return {
				projectId,
				assetId,
				pin: committed.pin,
				replaced: committed.replaced
			};
		},
		options
	);
}

type AbandonedAttemptRow = {
	id: unknown;
	stagingKey: unknown;
	referenced: unknown;
};

/**
 * Collect expired repair attempts for one owned project.
 *
 * A staging key may be referenced by a ready asset row if a commit preceded a
 * lost response; that key is never deleted. Every expired attempt row is removed,
 * and an unreferenced staging object is deleted first. Called by the next scoped
 * asset access and at the start of every repair, matching the model-staging
 * pattern: there is no background worker.
 */
export async function expireAbandonedImageRepairs(
	db: Pick<DatabasePool, 'query'>,
	store: ObjectStore | undefined,
	projectId: string,
	ownerId: string
): Promise<number> {
	if (!store) return 0;
	const rows = await queryRows<AbandonedAttemptRow>(
		db,
		`SELECT r.id, r.staging_key AS "stagingKey",
	EXISTS (SELECT 1 FROM assets a WHERE a.object_key = r.staging_key) AS referenced
FROM image_repair_attempts r
WHERE r.project_id = $1 AND r.owner_id = $2 AND r.expires_at <= now()`,
		[projectId, ownerId]
	);
	if (rows.length === 0) return 0;
	const removed: string[] = [];
	for (const row of rows) {
		const id = readString(row.id);
		const key = readString(row.stagingKey);
		if (row.referenced !== true) {
			try {
				await store.delete?.(key);
			} catch {
				continue;
			}
		}
		removed.push(id);
	}
	if (removed.length === 0) return 0;
	await db.query('DELETE FROM image_repair_attempts WHERE id = ANY ($1::uuid[])', [removed]);
	return removed.length;
}

function readString(value: unknown): string {
	if (typeof value !== 'string' || value.length === 0) throw new Error('Image repair row contained an invalid string');
	return value;
}

function readNullableString(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	return readString(value);
}

function readSafeInteger(value: unknown): number {
	const result = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	if (!Number.isSafeInteger(result) || result < 0) throw new Error('Image repair row contained an invalid version');
	return result;
}
