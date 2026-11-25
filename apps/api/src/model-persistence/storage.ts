import { FILE_PATH_PATTERN, ModelInputError } from './shared';
import { type ObjectStore } from '../object-store.js';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';

export async function deleteObject(objectStore: ObjectStore, key: string): Promise<void> {
	try {
		await objectStore.delete?.(key);
	} catch {
		// The staging row is what admits the bytes; a failed delete leaves an orphan
		// for the namespace purge rather than failing the owner's request.
	}
}

export async function putBytes(
	objectStore: ObjectStore,
	key: string,
	bytes: Buffer,
	contentType: string,
	signal: AbortSignal,
	assertActive: () => void
): Promise<void> {
	assertActive();
	await objectStore.put(key, Readable.from(bytes), { contentType, contentLength: bytes.length, signal });
}

export function bufferSha256(bytes: Buffer): string {
	return `sha256-${createHash('sha256').update(bytes as unknown as Uint8Array<ArrayBuffer>).digest('hex')}`;
}

export async function readObjectBytes(objectStore: ObjectStore, key: string, limit: number): Promise<Buffer> {
	const stored = await objectStore.get(key);
	if (!stored) throw new ModelInputError('model_not_ready', 409, 'A staged byte stream is missing');
	if (stored.contentLength > limit) throw new ModelInputError('payload_too_large', 413, 'Staged bytes exceed their bound');
	const chunks: Buffer[] = [];
	let total = 0;
	for await (const chunk of stored.body) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
		total += buffer.length;
		if (total > limit) throw new ModelInputError('payload_too_large', 413, 'Staged bytes exceed their bound');
		chunks.push(buffer);
	}
	const bytes = Buffer.allocUnsafe(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	return bytes;
}

export function toBuffer(value: unknown): Buffer {
	if (Buffer.isBuffer(value)) return value;
	if (value instanceof Uint8Array) return Buffer.from(value);
	throw new ModelInputError('invalid_upload', 400, 'Upload stream yielded a non-byte chunk');
}

export function modelFileKey(projectId: string, namespace: string, importId: string, fileId: string): string {
	return `projects/${namespace}/${projectId}/models/imports/${importId}/${fileId}`;
}

export function revisionObjectKeys(
	projectId: string,
	namespace: string,
	contentHash: string,
	sourcePaths: readonly string[]
): string[] {
	return sourcePaths.map((path) => {
		if (!FILE_PATH_PATTERN.test(path) || path.includes('..')) {
			throw new Error('Approved source path is malformed');
		}
		return modelRevisionKey(projectId, namespace, contentHash, `source/${path}`);
	});
}

export function modelRevisionKey(projectId: string, namespace: string, contentHash: string, name: string): string {
	return `projects/${namespace}/${projectId}/models/revisions/${contentHash}/${name}`;
}

export function sha256(value: string): string {
	return `sha256-${createHash('sha256').update(value).digest('hex')}`;
}
