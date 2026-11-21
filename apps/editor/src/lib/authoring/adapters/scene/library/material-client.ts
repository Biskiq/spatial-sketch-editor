/**
 * The editor's owner-scoped material library client (T2.S8 G).
 *
 * It is transport only. Save recomputes the item's canonical content identity
 * from the shared codec before posting; read verifies the exact bytes against
 * the listed identity and re-parses them with the same strict reader; transfer
 * revalidates the destination mapping against the item's pinned recipe hash.
 * No project, history, catalogue or thumbnail cache is written here.
 */
import {
	MATERIAL_LIBRARY_PAYLOAD_FORMAT_VERSION,
	canonicalMaterialLibraryBytes,
	materialLibraryContentId,
	readMaterialLibraryBytes,
	type MaterialLibraryImageBinding,
	type MaterialLibraryItemSummary,
	type MaterialLibraryPayload,
	type MaterialLibraryTransfer
} from '@portfolio/project-model/library';
import { readRecipe, recipeHash, type Recipe } from '@portfolio/project-model/materials';

export type MaterialLibraryClientErrorCode =
	| 'network'
	| 'unauthorized'
	| 'not-found'
	| 'library-full'
	| 'conflict'
	| 'stale'
	| 'refused'
	| 'invalid-response';

export class MaterialLibraryClientError extends Error {
	readonly code: MaterialLibraryClientErrorCode;
	readonly status: number | null;
	readonly serverCode: string | null;

	constructor(
		code: MaterialLibraryClientErrorCode,
		message: string,
		status: number | null = null,
		serverCode: string | null = null
	) {
		super(message);
		this.name = 'MaterialLibraryClientError';
		this.code = code;
		this.status = status;
		this.serverCode = serverCode;
	}
}

export type MaterialLibrarySaveInput = {
	readonly payload: MaterialLibraryPayload;
	readonly operationId: string;
	readonly sourceProjectId: string;
	readonly images: readonly MaterialLibraryImageBinding[];
};

export type MaterialLibraryClient = {
	list(signal?: AbortSignal): Promise<MaterialLibraryItemSummary[]>;
	read(
		item: Pick<MaterialLibraryItemSummary, 'id' | 'contentId' | 'formatVersion'>,
		signal?: AbortSignal
	): Promise<{
		readonly payload: MaterialLibraryPayload;
		readonly contentId: string;
		readonly recipeHash: string;
	}>;
	save(input: MaterialLibrarySaveInput, signal?: AbortSignal): Promise<MaterialLibraryItemSummary>;
	remove(id: string): Promise<void>;
	thumbnail(id: string, signal?: AbortSignal): Promise<Uint8Array>;
	putThumbnail(
		item: Pick<MaterialLibraryItemSummary, 'id' | 'contentId' | 'recipeHash'>,
		bytes: Uint8Array,
		signal?: AbortSignal
	): Promise<void>;
	transfer(
		item: Pick<MaterialLibraryItemSummary, 'id' | 'contentId' | 'recipeHash'>,
		destinationProjectId: string,
		operationId: string,
		signal?: AbortSignal
	): Promise<MaterialLibraryTransfer>;
};

type FetchLike = typeof fetch;

function originOf(apiOrigin: string): string {
	return apiOrigin.trim().replace(/\/+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidResponse(): never {
	throw new MaterialLibraryClientError('invalid-response', 'My Materials returned an unexpected response.');
}

function readError(body: unknown, status: number): MaterialLibraryClientError {
	const serverCode =
		isRecord(body) && isRecord(body.error) && typeof body.error.code === 'string'
			? body.error.code
			: null;
	const message =
		isRecord(body) && isRecord(body.error) && typeof body.error.message === 'string'
			? body.error.message
			: `My Materials request failed (${status}).`;
	if (status === 401 || status === 403) return new MaterialLibraryClientError('unauthorized', message, status, serverCode);
	if (status === 404) return new MaterialLibraryClientError('not-found', message, status, serverCode);
	if (status === 409 && serverCode === 'library_full') {
		return new MaterialLibraryClientError('library-full', message, status, serverCode);
	}
	if (status === 409 && (serverCode === 'operation_conflict' || serverCode === 'content_id_mismatch')) {
		return new MaterialLibraryClientError('conflict', message, status, serverCode);
	}
	if (status === 409 && serverCode === 'stale_revision') {
		return new MaterialLibraryClientError('stale', message, status, serverCode);
	}
	if (status >= 400 && status < 500) return new MaterialLibraryClientError('refused', message, status, serverCode);
	return new MaterialLibraryClientError('network', message, status, serverCode);
}

function readSummary(value: unknown): MaterialLibraryItemSummary {
	if (
		!isRecord(value) ||
		typeof value.id !== 'string' ||
		typeof value.name !== 'string' ||
		value.kind !== 'material' ||
		typeof value.formatVersion !== 'number' ||
		typeof value.contentId !== 'string' ||
		typeof value.createdAt !== 'string' ||
		typeof value.recipeHash !== 'string' ||
		typeof value.imageCount !== 'number' ||
		typeof value.hasThumbnail !== 'boolean'
	) {
		invalidResponse();
	}
	return {
		id: value.id,
		name: value.name,
		kind: 'material',
		formatVersion: value.formatVersion,
		contentId: value.contentId,
		createdAt: value.createdAt,
		recipeHash: value.recipeHash,
		imageCount: value.imageCount,
		hasThumbnail: value.hasThumbnail
	};
}

function readTransferImage(value: unknown): MaterialLibraryTransfer['images'][number] {
	if (!isRecord(value) || typeof value.hash !== 'string' || !isRecord(value.source)) invalidResponse();
	const textureId = value.source.textureId;
	const shipped = value.source.shipped;
	if ((typeof textureId !== 'string') === (typeof shipped !== 'string')) invalidResponse();
	if (typeof value.mime !== 'string' || typeof value.byteSize !== 'number' || !Number.isSafeInteger(value.byteSize)) {
		invalidResponse();
	}
	if (value.name !== undefined && typeof value.name !== 'string') invalidResponse();
	return {
		hash: value.hash,
		source: typeof textureId === 'string' ? { textureId } : { shipped: shipped as string },
		mime: value.mime,
		byteSize: value.byteSize,
		...(typeof value.name === 'string' ? { name: value.name } : {})
	};
}

function readTransfer(value: unknown, item: Pick<MaterialLibraryItemSummary, 'id' | 'contentId' | 'recipeHash'>): MaterialLibraryTransfer {
	if (
		!isRecord(value) ||
		value.itemId !== item.id ||
		value.contentId !== item.contentId ||
		typeof value.finishId !== 'string' ||
		typeof value.name !== 'string' ||
		typeof value.recipeHash !== 'string' ||
		value.recipeHash !== item.recipeHash ||
		(value.savedBase !== null && typeof value.savedBase !== 'string') ||
		!Array.isArray(value.images)
	) {
		invalidResponse();
	}
	const recipe = readRecipe(value.recipe);
	if (!recipe.success) invalidResponse();
	return {
		itemId: value.itemId,
		contentId: value.contentId,
		finishId: value.finishId,
		name: value.name,
		recipe: recipe.recipe as Recipe,
		recipeHash: value.recipeHash,
		images: value.images.map(readTransferImage),
		savedBase: value.savedBase
	};
}

export function createMaterialLibraryClient(input: {
	readonly apiOrigin: string;
	readonly fetchImpl?: FetchLike;
}): MaterialLibraryClient {
	const base = originOf(input.apiOrigin);
	const request = input.fetchImpl ?? fetch;
	const url = (path: string) => `${base}${path}`;
	const itemUrl = (id: string) => url(`/library/items/${encodeURIComponent(id)}`);
	return {
		async list(signal) {
			const response = await request(url('/library/items?kind=material'), {
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
			if (etag !== null && etag !== item.contentId) {
				throw new MaterialLibraryClientError(
					'conflict',
					'The saved material does not match the identity it was listed under.',
					200,
					'content_id_mismatch'
				);
			}
			const kind = response.headers.get('x-library-kind');
			if (kind !== null && kind !== 'material') invalidResponse();
			const headerFormat = Number(response.headers.get('x-library-format-version'));
			const formatVersion = Number.isSafeInteger(headerFormat) && headerFormat > 0
				? headerFormat
				: item.formatVersion;
			if (formatVersion !== MATERIAL_LIBRARY_PAYLOAD_FORMAT_VERSION) {
				throw new MaterialLibraryClientError(
					'refused',
					`This material was made with an earlier development version (format ${formatVersion}) and cannot be inserted. Remove it, or keep it for reference.`,
					200,
					'unsupported_format_version'
				);
			}
			const bytes = new Uint8Array(await response.arrayBuffer());
			const parsed = await readMaterialLibraryBytes(bytes, { contentId: item.contentId });
			if (!parsed.success) {
				const first = parsed.issues[0];
				throw new MaterialLibraryClientError(
					'refused',
					first?.message ?? 'The saved material could not be read.',
					200,
					first?.code ?? 'invalid_library_item'
				);
			}
			return { payload: parsed.payload, contentId: parsed.contentId, recipeHash: parsed.recipeHash };
		},

		async save(inputBody, signal) {
			const contentId = await materialLibraryContentId(inputBody.payload);
			const canonical = new TextDecoder().decode(canonicalMaterialLibraryBytes(inputBody.payload));
			const response = await request(url('/library/items'), {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contentId,
					operationId: inputBody.operationId,
					sourceProjectId: inputBody.sourceProjectId,
					payload: JSON.parse(canonical),
					images: inputBody.images
				}),
				...(signal === undefined ? {} : { signal })
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
		},

		async thumbnail(id, signal) {
			const response = await request(`${itemUrl(id)}/thumbnail`, {
				method: 'GET',
				credentials: 'include',
				...(signal === undefined ? {} : { signal })
			});
			if (!response.ok) throw readError(await response.json().catch(() => null), response.status);
			const bytes = new Uint8Array(await response.arrayBuffer());
			if (bytes.byteLength > 256 * 1024) invalidResponse();
			return bytes;
		},

		async putThumbnail(item, bytes, signal) {
			if (bytes.byteLength > 256 * 1024) {
				throw new MaterialLibraryClientError('refused', 'A material thumbnail is at most 256 KiB.');
			}
			const query = new URLSearchParams({ expectedContentId: item.contentId, recipeKey: item.recipeHash });
			const response = await request(`${itemUrl(item.id)}/thumbnail?${query.toString()}`, {
				method: 'PUT',
				credentials: 'include',
				headers: { 'Content-Type': 'application/octet-stream' },
				body: bytes as unknown as BodyInit,
				...(signal === undefined ? {} : { signal })
			});
			if (!response.ok) throw readError(await response.json().catch(() => null), response.status);
		},

		async transfer(item, destinationProjectId, operationId, signal) {
			const response = await request(`${itemUrl(item.id)}/transfers`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ destinationProjectId, contentId: item.contentId, operationId }),
				...(signal === undefined ? {} : { signal })
			});
			if (!response.ok) throw readError(await response.json().catch(() => null), response.status);
			const transfer = readTransfer(await response.json().catch(() => invalidResponse()), item);
			const recomputed = await recipeHash(transfer.recipe);
			if (recomputed !== transfer.recipeHash) {
				throw new MaterialLibraryClientError(
					'conflict',
					'The inserted material recipe does not match the pinned recipe revision.',
					200,
					'content_id_mismatch'
				);
			}
			return transfer;
		}
	};
}
