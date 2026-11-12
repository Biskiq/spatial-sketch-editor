#!/usr/bin/env node
/**
 * Initialize and verify the local S3-compatible bucket.
 *
 * Runs against the same `R2_*` environment the API receives, using the same
 * AWS SDK version. It creates the bucket if missing, then proves signed
 * put/get/delete for a key shaped like an application object under the
 * deployment namespace. The probe key is removed; a leftover key from a failed
 * run is still accepted by the namespace purge shape.
 *
 * This is a development utility only. Production uses Cloudflare R2 and never
 * runs it.
 */
import { randomBytes, randomUUID } from 'node:crypto';

import {
	CreateBucketCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadBucketCommand,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';

const RETRY_COUNT = 120;
const RETRY_DELAY_MS = 500;

function required(name) {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required`);
	return value;
}

function isMissingBucket(error) {
	return (
		error &&
		typeof error === 'object' &&
		(error.name === 'NotFound' ||
			error.name === 'NoSuchBucket' ||
			error.Code === 'NoSuchBucket' ||
			error.$metadata?.httpStatusCode === 404)
	);
}

const endpoint = required('R2_ENDPOINT');
const bucket = required('R2_BUCKET');
const namespace = required('R2_OBJECT_NAMESPACE');
const client = new S3Client({
	endpoint,
	region: 'auto',
	forcePathStyle: true,
	maxAttempts: 1,
	credentials: {
		accessKeyId: required('R2_ACCESS_KEY_ID'),
		secretAccessKey: required('R2_SECRET_ACCESS_KEY')
	}
});

const probeKey = `projects/${namespace}/project:local-dev/assets/${randomUUID()}/${randomBytes(16).toString('hex')}`;
const probeBody = Buffer.from(`biskiq-local-storage-probe:${Date.now()}\n`);

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readBody(stream) {
	const chunks = [];
	for await (const chunk of stream) chunks.push(Buffer.from(chunk));
	return Buffer.concat(chunks);
}

async function ensureBucket() {
	let lastError;
	for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
		try {
			await client.send(new HeadBucketCommand({ Bucket: bucket }));
			return;
		} catch (error) {
			lastError = error;
			if (isMissingBucket(error)) {
				try {
					await client.send(new CreateBucketCommand({ Bucket: bucket }));
					return;
				} catch (createError) {
					lastError = createError;
					if (createError?.$metadata?.httpStatusCode === 409) return;
				}
			}
		}
		await sleep(RETRY_DELAY_MS);
	}
	throw lastError ?? new Error('S3 bucket did not become available');
}

async function verifyBytes() {
	let lastError;
	for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
		try {
			await client.send(
				new PutObjectCommand({
					Bucket: bucket,
					Key: probeKey,
					Body: probeBody,
					ContentType: 'application/octet-stream',
					ContentLength: probeBody.length
				})
			);
			const stored = await client.send(new GetObjectCommand({ Bucket: bucket, Key: probeKey }));
			if (!stored.Body) throw new Error('S3 read returned no body');
			const bytes = await readBody(stored.Body);
			if (!bytes.equals(probeBody)) throw new Error('S3 read bytes did not match the write');
			if (stored.ContentLength !== probeBody.length) {
				throw new Error('S3 read content length did not match the write');
			}
			await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: probeKey }));
			return;
		} catch (error) {
			lastError = error;
			await sleep(RETRY_DELAY_MS);
		}
	}
	throw lastError ?? new Error('S3 put/get/delete probe did not become available');
}

try {
	await ensureBucket();
	await verifyBytes();
	console.log(`[local] object storage ready: ${endpoint} bucket=${bucket} namespace=${namespace}`);
} catch (error) {
	const name = error instanceof Error ? error.name : 'Error';
	const status = error?.$metadata?.httpStatusCode;
	console.error(
		`[local] object storage initialization failed (${name}${status ? `, HTTP ${status}` : ''})`
	);
	process.exitCode = 1;
} finally {
	client.destroy();
}
