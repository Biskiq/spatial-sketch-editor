import { probeArtworkImage } from '@portfolio/project-model/artwork';
import {
	collectEnvelopeImageRequirements,
	type ProjectImagePin,
} from '@portfolio/project-model/project-images';
import { isSavedBaseToken } from '@portfolio/project-model/save';
import { type ProjectEnvelope } from '@portfolio/project-model/units';
import {
	ArtworkAssetRefusal,
	ImageVerificationUnavailableError,
	type ArtworkAssetPin,
} from '../artwork-persistence.js';
import { type DatabasePool } from '../database.js';
import { type ObjectStore } from '../object-store.js';
import { createHash, randomBytes } from 'node:crypto';
import { PassThrough } from 'node:stream';

/** An abandoned attempt is collected after 24 hours, bytes included. */
export const IMAGE_REPAIR_TTL_MS = 24 * 60 * 60 * 1000;
export const SHA256_PATTERN = /^sha256-[0-9a-f]{64}$/;

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
		message: string,
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
		return new ImageRepairError(
			400,
			'invalid_repair',
			'Repair requires exactly expectedPin and savedBase',
		);
	}
	const expectedPin = values.expectedPin;
	const savedBaseToken = values.savedBase;
	if (typeof expectedPin !== 'string' || !SHA256_PATTERN.test(expectedPin)) {
		return new ImageRepairError(
			400,
			'invalid_repair',
			'expectedPin must be a sha256 image identity',
		);
	}
	if (!isSavedBaseToken(savedBaseToken)) {
		return new ImageRepairError(
			400,
			'invalid_repair',
			'savedBase must be the loaded saved-base token',
		);
	}
	return { expectedPin, savedBaseToken };
}

export function pinOf(pin: ArtworkAssetPin): ProjectImagePin {
	return { hash: pin.sha256, mime: pin.mime, size: pin.byteSize };
}

export type ImageRequirement = ReturnType<
	typeof collectEnvelopeImageRequirements
>['requirements'][number];

export function requirementFor(envelope: ProjectEnvelope, assetId: string): ImageRequirement {
	const closure = collectEnvelopeImageRequirements(envelope, 'private-save');
	if (closure.issues.length > 0) {
		throw new ImageRepairError(
			409,
			'image_pin_changed',
			'The saved image closure cannot be verified; source recovery is required.',
		);
	}
	const requirement = closure.requirements.find((candidate) => candidate.assetId === assetId);
	if (requirement === undefined) {
		throw new ImageRepairError(404, 'not_found', 'This image is not part of the saved project.');
	}
	return requirement;
}

export function repairErrorFromRefusal(error: ArtworkAssetRefusal): ImageRepairError {
	if (error.code === 'image-missing') {
		return new ImageRepairError(
			404,
			'not_found',
			'The image has no ready registry record in this project; source recovery is required.',
		);
	}
	if (error.code === 'image-pin-changed') {
		return new ImageRepairError(
			409,
			'image_pin_changed',
			'The saved revision pins different image bytes; source recovery is required.',
		);
	}
	return new ImageRepairError(409, 'image_pin_changed', error.message);
}

export function asImageRepairError(error: unknown): unknown {
	if (error instanceof ArtworkAssetRefusal) return repairErrorFromRefusal(error);
	if (error instanceof ImageVerificationUnavailableError) {
		return new ImageRepairError(
			503,
			'service_unavailable',
			'Image storage is unavailable; retry the repair.',
		);
	}
	return error;
}

export function createRepairKey(
	projectId: string,
	assetId: string,
	objectNamespace: string,
	attemptId: string,
): string {
	return `projects/${objectNamespace}/${projectId}/assets/${assetId}/repair-${attemptId}-${randomBytes(8).toString('hex')}`;
}

export async function readObjectBytes(
	store: ObjectStore,
	key: string,
	byteSize: number,
): Promise<Uint8Array> {
	const stored = await store.get(key);
	if (!stored)
		throw new ArtworkAssetRefusal('', 'Image bytes are missing.', { code: 'image-missing' });
	try {
		if (stored.contentLength !== byteSize) {
			throw new ArtworkAssetRefusal('', 'The stored image length differs from its pin.', {
				code: 'image-corrupt',
			});
		}
		const bytes = new Uint8Array(byteSize);
		let length = 0;
		for await (const chunk of stored.body) {
			const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			if (length + part.length > bytes.length) {
				throw new ArtworkAssetRefusal('', 'The stored image exceeds its pin.', {
					code: 'image-corrupt',
				});
			}
			bytes.set(Uint8Array.from(part), length);
			length += part.length;
		}
		if (length !== byteSize) {
			throw new ArtworkAssetRefusal('', 'The stored image ended before its pin.', {
				code: 'image-corrupt',
			});
		}
		return bytes;
	} finally {
		stored.body.destroy();
	}
}

/** A bounded read retry for transient object-store failures. */
export async function readStoredBytesWithRetry(
	store: ObjectStore,
	key: string,
	byteSize: number,
): Promise<Uint8Array> {
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

export async function verifyHealthyRow(store: ObjectStore, pin: ArtworkAssetPin): Promise<void> {
	const bytes = await readStoredBytesWithRetry(store, pin.objectKey, pin.byteSize);
	const digest = `sha256-${createHash('sha256').update(bytes).digest('hex')}`;
	if (digest !== pin.sha256) {
		throw new ArtworkAssetRefusal('', 'The stored image differs from its pin.', {
			code: 'image-corrupt',
		});
	}
	let decoded: ReturnType<typeof probeArtworkImage>;
	try {
		decoded = probeArtworkImage(bytes);
	} catch {
		throw new ArtworkAssetRefusal('', 'The stored image is not a supported static image.', {
			code: 'image-corrupt',
		});
	}
	if (
		decoded.mime !== pin.mime ||
		(pin.artwork !== null &&
			(decoded.pixelWidth !== pin.artwork.pixelWidth ||
				decoded.pixelHeight !== pin.artwork.pixelHeight))
	) {
		throw new ArtworkAssetRefusal('', 'The stored image MIME or dimensions differ from its pin.', {
			code: 'image-corrupt',
		});
	}
}

export function toBuffer(value: unknown): Buffer {
	if (Buffer.isBuffer(value)) return value;
	if (value instanceof Uint8Array) return Buffer.from(value);
	throw new Error('Repair request stream yielded a non-byte chunk');
}

export async function writeChunk(stream: PassThrough, chunk: Buffer): Promise<void> {
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

export async function deleteStagedKey(store: ObjectStore, key: string): Promise<boolean> {
	if (store.delete === undefined) return false;
	try {
		await store.delete(key);
		return true;
	} catch {
		// The attempt row and the next expiry sweep remain the durable cleanup path.
		return false;
	}
}

export async function forgetAttempt(
	pool: Pick<DatabasePool, 'query'>,
	attemptId: string,
): Promise<void> {
	try {
		await pool.query('DELETE FROM image_repair_attempts WHERE id = $1::uuid', [attemptId]);
	} catch {
		// An expired attempt is collected by the next scoped asset access.
	}
}

export function readString(value: unknown): string {
	if (typeof value !== 'string' || value.length === 0)
		throw new Error('Image repair row contained an invalid string');
	return value;
}

export function readNullableString(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	return readString(value);
}

export function readSafeInteger(value: unknown): number {
	const result =
		typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	if (!Number.isSafeInteger(result) || result < 0)
		throw new Error('Image repair row contained an invalid version');
	return result;
}
