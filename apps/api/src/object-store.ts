import {
	DeleteObjectCommand,
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';

export type ObjectStore = {
	put(
		key: string,
		body: Readable,
		options: { contentType: string; contentLength: number; signal: AbortSignal }
	): Promise<void>;
	get(key: string): Promise<{ body: Readable; contentLength: number } | null>;
	/** List every key this application can see. Callers must scope their own prefix. */
	list?(signal?: AbortSignal): Promise<string[]>;
	delete?(key: string, signal?: AbortSignal): Promise<void>;
	close?(): void | Promise<void>;
};

export type R2ObjectStoreConfig = {
	r2Endpoint: string;
	r2Bucket: string;
	r2AccessKeyId: string;
	r2SecretAccessKey: string;
};

export function createR2ObjectStore(config: R2ObjectStoreConfig): ObjectStore {
	const client = new S3Client({
		endpoint: config.r2Endpoint,
		region: 'auto',
		credentials: {
			accessKeyId: config.r2AccessKeyId,
			secretAccessKey: config.r2SecretAccessKey
		}
	});

	return {
		async put(key, body, options) {
			await client.send(
				new PutObjectCommand({
					Bucket: config.r2Bucket,
					Key: key,
					Body: body,
					ContentType: options.contentType,
					ContentLength: options.contentLength
				}),
				{ abortSignal: options.signal }
			);
		},
		async get(key) {
			try {
				const result = await client.send(
					new GetObjectCommand({ Bucket: config.r2Bucket, Key: key })
				);
				if (!result.Body) return null;
				if (typeof result.ContentLength !== 'number' || !Number.isSafeInteger(result.ContentLength)) {
					throw new Error('R2 object response had no safe content length');
				}
				return { body: result.Body as Readable, contentLength: result.ContentLength };
			} catch (error) {
				if (isMissingObjectError(error)) return null;
				throw error;
			}
		},
		async list(signal) {
			const keys: string[] = [];
			let continuationToken: string | undefined;
			do {
				const page = await client.send(
					new ListObjectsV2Command({
						Bucket: config.r2Bucket,
						ContinuationToken: continuationToken
					}),
					{ abortSignal: signal }
				);
				for (const object of page.Contents ?? []) {
					if (typeof object.Key === 'string') keys.push(object.Key);
				}
				continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
			} while (continuationToken !== undefined);
			return keys;
		},
		async delete(key, signal) {
			await client.send(
				new DeleteObjectCommand({ Bucket: config.r2Bucket, Key: key }),
				{ abortSignal: signal }
			);
		},
		close() {
			client.destroy();
		}
	};
}

function isMissingObjectError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;
	const value = error as {
		name?: unknown;
		Code?: unknown;
		$metadata?: { httpStatusCode?: unknown };
	};
	return (
		value.name === 'NoSuchKey' ||
		value.name === 'NotFound' ||
		value.Code === 'NoSuchKey' ||
		value.$metadata?.httpStatusCode === 404
	);
}
