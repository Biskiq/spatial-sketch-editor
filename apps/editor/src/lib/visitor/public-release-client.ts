/**
 * P22.3 — public release fetch + cold bundle loader.
 *
 * Visitor-safe: pure fetch plus the cold runtime only. No session, store,
 * history, gizmo, or mutable process-global loader installation. Imports
 * the release-scoped cold bundle composer directly and never touches live
 * draft state.
 *
 * Takes a publication ID + API origin, fetches the anonymous active release
 * (`GET /publications/:id`) and its version-qualified P20 bytes, verifies
 * each download (status, MIME, byte size, magic bytes, bounded body) before
 * installing the runtime, then composes a detached cold bundle. Throws
 * `PublicVisitorError` on every expected failure; aborts propagate as
 * `AbortError` so callers can distinguish cancellation from failure.
 */

import {
	composeColdReleaseBundle,
	type ColdReleaseBundle
} from './visitor-cold-runtime';

export type { ColdReleaseBundle } from './visitor-cold-runtime';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** P20-equivalent byte ceiling (matches the editor's 25 MiB project-asset cap). */
export const MAX_PUBLIC_ASSET_BYTES = 25 * 1024 * 1024;

const PUBLIC_ASSET_MIMES = new Set(['image/png', 'image/webp', 'image/jpeg']);

export type PublicVisitorErrorCode =
	| 'invalid-id'
	| 'not-found'
	| 'invalid-response'
	| 'asset-failed'
	| 'network'
	| 'invalid-release';

export class PublicVisitorError extends Error {
	constructor(
		readonly code: PublicVisitorErrorCode,
		message: string
	) {
		super(message);
		this.name = 'PublicVisitorError';
	}
}

export type PublicAssetDescriptor = {
	assetId: string;
	mime: string;
	byteSize: number;
};

export type PublicReleasePayload = {
	name: string;
	version: number;
	revision: number;
	document: unknown;
	assets: PublicAssetDescriptor[];
};

export type PublicFetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function requestFetch(fetchImpl?: PublicFetchLike): PublicFetchLike {
	const impl = fetchImpl ?? globalThis.fetch?.bind(globalThis);
	if (!impl) throw new PublicVisitorError('network', 'Network requests are unavailable');
	return impl;
}

function normalizeApiOrigin(origin: string): string {
	return origin.trim().replace(/\/+$/, '');
}

export function isValidPublicationId(value: unknown): value is string {
	return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Fetch and strictly validate the anonymous active release. Unknown,
 * unpublished, or revoked IDs surface as `not-found` with no ownership or
 * storage detail. Never allocates — a status GET has no creation side effect.
 */
export async function fetchPublicRelease(input: {
	publicationId: string;
	apiOrigin: string;
	fetchImpl?: PublicFetchLike;
	signal?: AbortSignal;
}): Promise<PublicReleasePayload> {
	const { publicationId, apiOrigin } = input;
	if (!isValidPublicationId(publicationId)) {
		throw new PublicVisitorError('not-found', 'This published link is unknown or no longer available');
	}
	const origin = normalizeApiOrigin(apiOrigin);
	if (!origin) throw new PublicVisitorError('network', 'The publish service is unavailable');
	const fetchImpl = requestFetch(input.fetchImpl);
	input.signal?.throwIfAborted();

	let response: Response;
	try {
		response = await fetchImpl(`${origin}/publications/${encodeURIComponent(publicationId)}`, {
			method: 'GET',
			signal: input.signal,
			headers: { Accept: 'application/json' }
		});
	} catch (error) {
		if (input.signal?.aborted) throw error;
		throw new PublicVisitorError('network', 'Could not reach the publish service');
	}
	if (response.status === 404) {
		throw new PublicVisitorError('not-found', 'This published link is unknown or no longer available');
	}
	if (!response.ok) {
		throw new PublicVisitorError('network', 'The publish service is unavailable');
	}
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		throw new PublicVisitorError('invalid-response', 'The published project could not be read');
	}
	return readReleasePayload(body);
}

function readReleasePayload(value: unknown): PublicReleasePayload {
	if (!isRecord(value)) throw new PublicVisitorError('invalid-response', 'The published project could not be read');
	const { name, version, revision, document, assets } = value;
	if (typeof name !== 'string' || name.trim().length === 0) {
		throw new PublicVisitorError('invalid-response', 'The published project could not be read');
	}
	if (!Number.isSafeInteger(version) || (version as number) < 1) {
		throw new PublicVisitorError('invalid-response', 'The published project could not be read');
	}
	if (!Number.isSafeInteger(revision) || (revision as number) < 0) {
		throw new PublicVisitorError('invalid-response', 'The published project could not be read');
	}
	if (!isRecord(document)) {
		throw new PublicVisitorError('invalid-response', 'The published project could not be read');
	}
	if (!Array.isArray(assets)) {
		throw new PublicVisitorError('invalid-response', 'The published project could not be read');
	}
	return {
		name,
		version: version as number,
		revision: revision as number,
		document,
		assets: assets.map(readAssetDescriptor)
	};
}

function readAssetDescriptor(value: unknown): PublicAssetDescriptor {
	if (!isRecord(value)) throw new PublicVisitorError('invalid-response', 'The published project could not be read');
	const { assetId, mime, byteSize } = value;
	if (typeof assetId !== 'string' || !UUID_PATTERN.test(assetId)) {
		throw new PublicVisitorError('invalid-response', 'The published project could not be read');
	}
	if (typeof mime !== 'string' || !PUBLIC_ASSET_MIMES.has(mime.toLowerCase())) {
		throw new PublicVisitorError('invalid-response', 'The published project could not be read');
	}
	if (
		typeof byteSize !== 'number' ||
		!Number.isSafeInteger(byteSize) ||
		byteSize < 1 ||
		byteSize > MAX_PUBLIC_ASSET_BYTES
	) {
		throw new PublicVisitorError('invalid-response', 'The published project could not be read');
	}
	return { assetId, mime: mime.toLowerCase(), byteSize };
}

/**
 * Download + verify every P20 asset in the release manifest. Each fetch is
 * version-qualified so an already-open visitor finishes its own release
 * after an update. Any mismatch surfaces a retryable `asset-failed` rather
 * than a partially textured project.
 */
export async function fetchPublicReleaseBytes(input: {
	publicationId: string;
	version: number;
	assets: readonly PublicAssetDescriptor[];
	apiOrigin: string;
	fetchImpl?: PublicFetchLike;
	signal?: AbortSignal;
}): Promise<Map<string, { bytes: Uint8Array; mime: string }>> {
	const { publicationId, version, assets, apiOrigin } = input;
	if (!isValidPublicationId(publicationId) || !Number.isSafeInteger(version) || version < 1) {
		throw new PublicVisitorError('invalid-response', 'The published project could not be read');
	}
	const origin = normalizeApiOrigin(apiOrigin);
	if (!origin) throw new PublicVisitorError('network', 'The publish service is unavailable');
	const fetchImpl = requestFetch(input.fetchImpl);
	input.signal?.throwIfAborted();

	const bytesByUri = new Map<string, { bytes: Uint8Array; mime: string }>();
	// Few textures per release; parallel fetch keeps cold boot fast. The
	// shared AbortSignal cancels the remainder on route switch/unmount.
	await Promise.all(
		assets.map(async (asset) => {
			const bytes = await fetchOneAssetBytes(fetchImpl, origin, publicationId, version, asset, input.signal);
			bytesByUri.set(`/project-assets/${asset.assetId}`, { bytes, mime: asset.mime });
		})
	);
	return bytesByUri;
}

async function fetchOneAssetBytes(
	fetchImpl: PublicFetchLike,
	origin: string,
	publicationId: string,
	version: number,
	asset: PublicAssetDescriptor,
	signal?: AbortSignal
): Promise<Uint8Array> {
	signal?.throwIfAborted();
	const url =
		`${origin}/publications/${encodeURIComponent(publicationId)}` +
		`/versions/${version}/assets/${encodeURIComponent(asset.assetId)}/content`;
	let response: Response;
	try {
		response = await fetchImpl(url, {
			method: 'GET',
			signal,
			headers: { Accept: asset.mime }
		});
	} catch (error) {
		if (signal?.aborted) throw error;
		throw new PublicVisitorError('asset-failed', 'A published texture could not be downloaded');
	}
	if (response.status === 404) {
		throw new PublicVisitorError('asset-failed', 'A published texture is no longer available');
	}
	if (!response.ok) {
		throw new PublicVisitorError('asset-failed', 'A published texture could not be downloaded');
	}
	const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
	if (contentType !== asset.mime) {
		throw new PublicVisitorError('asset-failed', 'A published texture failed validation');
	}
	const lengthHeader = response.headers.get('content-length');
	if (lengthHeader !== null && Number(lengthHeader) !== asset.byteSize) {
		throw new PublicVisitorError('asset-failed', 'A published texture failed validation');
	}
	const bytes = await readBoundedBytes(response, asset.byteSize, signal);
	if (bytes.byteLength !== asset.byteSize) {
		throw new PublicVisitorError('asset-failed', 'A published texture failed validation');
	}
	if (!matchesMimeMagic(bytes, asset.mime)) {
		throw new PublicVisitorError('asset-failed', 'A published texture failed validation');
	}
	return bytes;
}

async function readBoundedBytes(
	response: Response,
	expectedLength: number,
	signal?: AbortSignal
): Promise<Uint8Array> {
	if (!response.body) throw new PublicVisitorError('asset-failed', 'A published texture could not be downloaded');
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		while (true) {
			signal?.throwIfAborted();
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > expectedLength || total > MAX_PUBLIC_ASSET_BYTES) {
				try {
					await reader.cancel();
				} catch {
					// Preserve the validation result.
				}
				throw new PublicVisitorError('asset-failed', 'A published texture failed validation');
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

function matchesMimeMagic(bytes: Uint8Array, mime: string): boolean {
	if (bytes.byteLength < 12) return false;
	if (mime === 'image/png') {
		return (
			bytes[0] === 0x89 &&
			bytes[1] === 0x50 &&
			bytes[2] === 0x4e &&
			bytes[3] === 0x47 &&
			bytes[4] === 0x0d &&
			bytes[5] === 0x0a &&
			bytes[6] === 0x1a &&
			bytes[7] === 0x0a
		);
	}
	if (mime === 'image/jpeg') {
		return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
	}
	// WebP: RIFF....WEBP
	return (
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	);
}

/**
 * Full cold bootstrap: release metadata + verified P20 bytes + detached
 * validated bundle. The release ID keys the runtime (and its texture-scope
 * cache namespace) by public ID + version, so Back/Forward and repeat
 * visits never retain another project's state. Throws without leaking
 * object URLs — `composeColdReleaseBundle` revokes partial URLs on failure
 * and the caller owns `bundle.dispose()` afterwards.
 */
export async function loadPublicReleaseBundle(input: {
	publicationId: string;
	apiOrigin: string;
	fetchImpl?: PublicFetchLike;
	signal?: AbortSignal;
}): Promise<{ bundle: ColdReleaseBundle; version: number; revision: number }> {
	const release = await fetchPublicRelease(input);
	input.signal?.throwIfAborted();
	const bytesByUri = await fetchPublicReleaseBytes({
		publicationId: input.publicationId,
		version: release.version,
		assets: release.assets,
		apiOrigin: input.apiOrigin,
		fetchImpl: input.fetchImpl,
		signal: input.signal
	});
	input.signal?.throwIfAborted();

	let bundle: ColdReleaseBundle;
	try {
		bundle = composeColdReleaseBundle({
			document: release.document,
			manifest: { releaseId: `${input.publicationId}@v${release.version}`, bytesByUri },
			signal: input.signal
		});
	} catch (error) {
		if (input.signal?.aborted) throw input.signal.reason ?? error;
		throw new PublicVisitorError(
			'invalid-release',
			error instanceof Error ? error.message : 'The published project is invalid'
		);
	}
	// Every visitor-visible authored value comes from the release snapshot:
	// the bundle name is the released document name, never live-row metadata.
	if (bundle.projectName !== release.name) {
		bundle.dispose();
		throw new PublicVisitorError('invalid-release', 'The published project is invalid');
	}
	return { bundle, version: release.version, revision: release.revision };
}
