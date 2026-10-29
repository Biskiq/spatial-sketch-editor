/**
 * T5.P01.S04 — the editor's client for the owner-scoped My Objects routes.
 *
 * The client is transport, not an authority: Save posts the shared codec's
 * canonical payload and content id; read verifies the received bytes against
 * the content id it asked for and re-parses them with the same strict codec.
 * Nothing leaves a generated mesh, a footprint or a cache here.
 *
 * It is editor-only and lazily imported by the Place instrument and the Save
 * Card action, so the visitor/public chunks cannot reach it.
 */
import {
	FORM_LIBRARY_PAYLOAD_FORMAT_VERSION,
	canonicalFormLibraryBytes,
	formLibraryContentId,
	readFormLibraryBytes,
	type FormLibraryItemSummary,
	type FormLibraryPayload
} from '@portfolio/project-model/library';

export type FormLibraryClientErrorCode =
	| 'network'
	| 'unauthorized'
	| 'not-found'
	| 'library-full'
	| 'refused'
	| 'invalid-response';

export class FormLibraryClientError extends Error {
	readonly code: FormLibraryClientErrorCode;
	readonly status: number | null;
	readonly serverCode: string | null;

	constructor(
		code: FormLibraryClientErrorCode,
		message: string,
		status: number | null = null,
		serverCode: string | null = null
	) {
		super(message);
		this.name = 'FormLibraryClientError';
		this.code = code;
		this.status = status;
		this.serverCode = serverCode;
	}
}

export type FormLibraryClient = {
	list(signal?: AbortSignal): Promise<FormLibraryItemSummary[]>;
	/**
	 * Read one item's bytes and verify them against the listed content id.
	 * Returns the strict payload or refuses; an older format number is reported
	 * as `unsupported_format_version`, never misread.
	 */
	read(
		item: Pick<FormLibraryItemSummary, 'id' | 'contentId' | 'formatVersion'>,
		signal?: AbortSignal
	): Promise<{ readonly payload: FormLibraryPayload; readonly contentId: string }>;
	save(payload: FormLibraryPayload): Promise<FormLibraryItemSummary>;
	remove(id: string): Promise<void>;
};

type FetchLike = typeof fetch;

function originOf(apiOrigin: string): string {
	return apiOrigin.trim().replace(/\/+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readError(body: unknown, status: number): FormLibraryClientError {
	const serverCode =
		isRecord(body) && isRecord(body.error) && typeof body.error.code === 'string'
			? body.error.code
			: null;
	const message =
		isRecord(body) && isRecord(body.error) && typeof body.error.message === 'string'
			? body.error.message
			: `My Objects request failed (${status}).`;
	if (status === 401 || status === 403) return new FormLibraryClientError('unauthorized', message, status, serverCode);
	if (status === 404) return new FormLibraryClientError('not-found', message, status, serverCode);
	if (status === 409 && serverCode === 'library_full') {
		return new FormLibraryClientError('library-full', message, status, serverCode);
	}
	if (status >= 400 && status < 500) return new FormLibraryClientError('refused', message, status, serverCode);
	return new FormLibraryClientError('network', message, status, serverCode);
}

function invalidResponse(): never {
	throw new FormLibraryClientError('invalid-response', 'My Objects returned an unexpected response.');
}

function readSummary(value: unknown): FormLibraryItemSummary {
	if (
		!isRecord(value) ||
		typeof value.id !== 'string' ||
		typeof value.name !== 'string' ||
		value.kind !== 'form' ||
		typeof value.formatVersion !== 'number' ||
		typeof value.contentId !== 'string' ||
		typeof value.createdAt !== 'string'
	) {
		invalidResponse();
	}
	return {
		id: value.id,
		name: value.name,
		kind: 'form',
		formatVersion: value.formatVersion,
		contentId: value.contentId,
		createdAt: value.createdAt
	};
}

export function createFormLibraryClient(input: {
	readonly apiOrigin: string;
	readonly fetchImpl?: FetchLike;
}): FormLibraryClient {
	const base = originOf(input.apiOrigin);
	const request = input.fetchImpl ?? fetch;
	const url = (path: string) => `${base}${path}`;
	const itemUrl = (id: string) => url(`/library/items/${encodeURIComponent(id)}`);

	return {
		async list(signal) {
			const response = await request(url('/library/items'), {
				method: 'GET',
				credentials: 'include',
				...(signal === undefined ? {} : { signal })
			});
			if (!response.ok) throw readError(await response.json().catch(() => null), response.status);
			const body: unknown = await response.json().catch(() => invalidResponse());
			if (!isRecord(body) || !Array.isArray(body.items)) invalidResponse();
			return body.items.map(readSummary);
		},

		async read(item, signal) {
			const response = await request(itemUrl(item.id), {
				method: 'GET',
				credentials: 'include',
				...(signal === undefined ? {} : { signal })
			});
			if (!response.ok) throw readError(await response.json().catch(() => null), response.status);
			const etag = response.headers.get('etag')?.replace(/^"|"$/g, '') ?? null;
			// The listed identity is the pin. A response that advertises a different
			// identity is not the item the creator chose, even if its bytes parse.
			if (etag !== null && etag !== item.contentId) {
				throw new FormLibraryClientError(
					'refused',
					'The saved item does not match the identity it was listed under.',
					200,
					'content_id_mismatch'
				);
			}
			const headerFormat = Number(response.headers.get('x-library-format-version'));
			const formatVersion = Number.isSafeInteger(headerFormat) && headerFormat > 0
				? headerFormat
				: item.formatVersion;
			if (formatVersion !== FORM_LIBRARY_PAYLOAD_FORMAT_VERSION) {
				throw new FormLibraryClientError(
					'refused',
					`This item was made with an earlier development version (format ${formatVersion}) and cannot be inserted. Remove it, or keep it for reference.`,
					200,
					'unsupported_format_version'
				);
			}
			const bytes = new Uint8Array(await response.arrayBuffer());
			const parsed = await readFormLibraryBytes(bytes, { contentId: item.contentId });
			if (!parsed.success) {
				const first = parsed.issues[0];
				throw new FormLibraryClientError(
					'refused',
					first?.message ?? 'The saved item could not be read.',
					200,
					first?.code ?? 'invalid_library_item'
				);
			}
			return { payload: parsed.payload, contentId: parsed.contentId };
		},

		async save(payload) {
			const contentId = await formLibraryContentId(payload);
			const canonical = new TextDecoder().decode(canonicalFormLibraryBytes(payload));
			const response = await request(url('/library/items'), {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contentId, payload: JSON.parse(canonical) })
			});
			if (!response.ok) throw readError(await response.json().catch(() => null), response.status);
			return readSummary(await response.json().catch(() => invalidResponse()));
		},

		async remove(id) {
			const response = await request(itemUrl(id), {
				method: 'DELETE',
				credentials: 'include'
			});
			if (!response.ok) throw readError(await response.json().catch(() => null), response.status);
		}
	};
}
