import { type DatabasePool } from '../database.js';
import { SHA256_PATTERN, ModelNotFoundError, ModelInputError, type RevisionRow, REVISION_COLUMNS, readString, readSafeInteger } from './shared';
import { toBuffer, sha256 } from './storage';
import { type ObjectStore } from '../object-store.js';
import { queryRows } from '../project-persistence.js';
import { createHash } from 'node:crypto';
import { PassThrough, Readable } from 'node:stream';

/** The immutable revision bytes a hash-keyed read serves; owner-scoped. */
export async function readModelRevisionContent(
	db: Pick<DatabasePool, 'query'>,
	ownerId: string,
	projectId: string,
	derivativeHash: string
): Promise<{ readonly objectKey: string; readonly mime: string; readonly size: number; readonly contentHash: string }> {
	if (!SHA256_PATTERN.test(derivativeHash)) throw new ModelNotFoundError();
	const rows = await queryRows<RevisionRow>(
		db,
		`SELECT ${REVISION_COLUMNS}
FROM model_revisions r
JOIN projects p ON p.id = r.project_id
WHERE r.project_id = $1 AND r.derivative_hash = $2 AND p.owner_id = $3
ORDER BY r.created_at ASC
LIMIT 1`,
		[projectId, derivativeHash, ownerId]
	);
	const row = rows[0];
	if (!row) throw new ModelNotFoundError();
	return {
		objectKey: readString(row.derivativeKey),
		mime: readString(row.derivativeMime),
		size: readSafeInteger(row.derivativeBytes),
		contentHash: readString(row.contentHash)
	};
}

export async function streamModelFile(
	source: Readable,
	contentLength: number,
	objectStore: ObjectStore,
	key: string,
	signal: AbortSignal,
	assertActive: () => void
): Promise<{ byteSize: number; sha256: string }> {
	const output = new PassThrough();
	output.on('error', () => {});
	const hash = createHash('sha256');
	let byteSize = 0;
	let putPromise: Promise<void> | undefined;
	let storageError: unknown;
	const onAbort = () => {
		const error = signal.reason instanceof Error ? signal.reason : new Error('Model write aborted');
		source.destroy(error);
		output.destroy(error);
	};
	signal.addEventListener('abort', onAbort, { once: true });
	if (signal.aborted) onAbort();
	putPromise = objectStore
		.put(key, output, { contentType: 'application/octet-stream', contentLength, signal })
		.catch((error) => {
			storageError = error;
			output.destroy(error instanceof Error ? error : new Error('Model storage failed'));
			throw error;
		});
	try {
		for await (const value of source) {
			assertActive();
			const chunk = toBuffer(value);
			byteSize += chunk.length;
			if (byteSize > contentLength) {
				throw new ModelInputError('invalid_upload', 400, 'Upload length does not match Content-Length');
			}
			hash.update(chunk as unknown as Uint8Array<ArrayBuffer>);
			await writeChunk(output, chunk);
		}
		if (byteSize !== contentLength) {
			throw new ModelInputError('invalid_upload', 400, 'Upload length does not match Content-Length');
		}
		assertActive();
		output.end();
		await putPromise;
		signal.removeEventListener('abort', onAbort);
		return { byteSize, sha256: `sha256-${hash.digest('hex')}` };
	} catch (error) {
		const reported = signal.aborted
			? signal.reason instanceof Error
				? signal.reason
				: new Error('Model write aborted')
			: error instanceof ModelInputError || storageError
				? error
				: new ModelInputError('invalid_upload', 400, 'Upload stream failed');
		source.destroy(error instanceof Error ? error : new Error('Model upload failed'));
		output.destroy(error instanceof Error ? error : new Error('Model upload failed'));
		try {
			await putPromise;
		} catch {
			// The route reports the original bounded upload/storage error.
		}
		signal.removeEventListener('abort', onAbort);
		throw reported;
	}
}

export async function writeChunk(stream: PassThrough, chunk: Buffer): Promise<void> {
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
