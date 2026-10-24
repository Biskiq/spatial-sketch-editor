/**
 * T2.P02.S02 — the editor's client for S01's creator-model routes.
 *
 * S01 already owns staging, byte upload, cancel, approval and the immutable
 * hash-keyed read. This module is only the transport: it declares the file set,
 * pushes exactly the bytes whose hashes it declared, and returns the approved
 * revision exactly as the server pinned it. It never re-hashes locally and never
 * invents a pin; a server refusal is a typed error the procedure can show.
 */
import type {
	CreatorImportApproved,
	CreatorImportFile,
	CreatorImportStaging
} from '$lib/authoring/adapters/scene/import/types';

export type ModelImportClientErrorCode =
	| 'network'
	| 'unauthorized'
	| 'not-found'
	| 'conflict'
	| 'refused'
	| 'invalid-response';

export class ModelImportClientError extends Error {
	readonly code: ModelImportClientErrorCode;
	readonly status: number | null;
	readonly serverCode: string | null;

	constructor(
		code: ModelImportClientErrorCode,
		message: string,
		status: number | null = null,
		serverCode: string | null = null
	) {
		super(message);
		this.name = 'ModelImportClientError';
		this.code = code;
		this.status = status;
		this.serverCode = serverCode;
	}
}

export type ModelImportClient = {
	createImport(input: {
		projectId: string;
		/** The recipe identity the caller derived the bytes with. */
		recipe: { readonly id: string; readonly version: number };
		source: readonly { path: string; size: number; hash: string }[];
		derivative: { path: string; size: number; hash: string };
	}): Promise<CreatorImportStaging>;
	uploadFile(input: {
		projectId: string;
		importId: string;
		fileId: string;
		bytes: Uint8Array;
	}): Promise<void>;
	cancelImport(projectId: string, importId: string): Promise<void>;
	approveImport(input: {
		projectId: string;
		importId: string;
		reportDigest: string;
		placement: CreatorImportApproved['placement'];
	}): Promise<CreatorImportApproved>;
	/** The immutable bytes of one approved derivative, as a cacheable URL. */
	contentUrl(projectId: string, hash: string): string;
	/** Fetch approved derivative bytes for rendering; owner-only, cacheable. */
	loadContent(projectId: string, hash: string, signal?: AbortSignal): Promise<Uint8Array>;
};

type FetchLike = typeof fetch;

function originOf(apiOrigin: string): string {
	return apiOrigin.trim().replace(/\/+$/, '');
}

function errorFor(status: number, body: unknown): ModelImportClientError {
	const serverCode =
		typeof body === 'object' && body !== null && typeof (body as { code?: unknown }).code === 'string'
			? ((body as { code: string }).code)
			: null;
	const message =
		typeof body === 'object' && body !== null && typeof (body as { message?: unknown }).message === 'string'
			? (body as { message: string }).message
			: `Model request failed (${status}).`;
	if (status === 401 || status === 403) return new ModelImportClientError('unauthorized', message, status, serverCode);
	if (status === 404) return new ModelImportClientError('not-found', message, status, serverCode);
	if (status === 409) return new ModelImportClientError('conflict', message, status, serverCode);
	if (status >= 400 && status < 500) return new ModelImportClientError('refused', message, status, serverCode);
	return new ModelImportClientError('network', message, status, serverCode);
}

function paths(projectId: string) {
	const project = `/projects/${encodeURIComponent(projectId)}`;
	return {
		imports: `${project}/models/imports`,
		import: (importId: string) => `${project}/models/imports/${encodeURIComponent(importId)}`,
		file: (importId: string, fileId: string) =>
			`${project}/models/imports/${encodeURIComponent(importId)}/files/${encodeURIComponent(fileId)}/content`,
		approve: (importId: string) => `${project}/models/imports/${encodeURIComponent(importId)}/approve`,
		content: (hash: string) => `${project}/models/content/${encodeURIComponent(hash)}`
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidResponse(): never {
	throw new ModelImportClientError('invalid-response', 'The model route returned an unexpected response.');
}

function readStaging(value: unknown): CreatorImportStaging {
	if (!isRecord(value) || typeof value.importId !== 'string' || !Array.isArray(value.files)) invalidResponse();
	const files = value.files.map((entry) => {
		if (
			!isRecord(entry) ||
			typeof entry.fileId !== 'string' ||
			(entry.role !== 'source' && entry.role !== 'derivative') ||
			typeof entry.path !== 'string' ||
			typeof entry.size !== 'number'
		) {
			invalidResponse();
		}
		return {
			fileId: entry.fileId,
			role: entry.role,
			path: entry.path,
			size: entry.size,
			hash: typeof entry.hash === 'string' ? entry.hash : ''
		} as const;
	});
	return { importId: value.importId, files };
}

function readApproved(value: unknown): CreatorImportApproved {
	if (
		!isRecord(value) ||
		typeof value.revisionId !== 'string' ||
		typeof value.contentHash !== 'string' ||
		!isRecord(value.derivative) ||
		typeof value.derivative.hash !== 'string' ||
		typeof value.derivative.mime !== 'string' ||
		typeof value.derivative.size !== 'number' ||
		typeof value.derivative.locator !== 'string' ||
		!isRecord(value.source) ||
		typeof value.source.manifestHash !== 'string' ||
		typeof value.source.size !== 'number' ||
		typeof value.source.fileCount !== 'number' ||
		!isRecord(value.recipe) ||
		typeof value.recipe.id !== 'string' ||
		typeof value.recipe.version !== 'number' ||
		typeof value.reportDigest !== 'string' ||
		!isRecord(value.placement) ||
		typeof value.placement.metresPerSourceUnit !== 'number' ||
		!Array.isArray(value.placement.pivot) ||
		!isRecord(value.placement.footprint) ||
		typeof value.placement.footprint.width !== 'number' ||
		typeof value.placement.footprint.depth !== 'number' ||
		typeof value.placement.contactMinY !== 'number' ||
		value.placement.placement !== 'floor'
	) {
		invalidResponse();
	}
	return {
		revisionId: value.revisionId,
		contentHash: value.contentHash,
		derivative: {
			hash: value.derivative.hash,
			mime: value.derivative.mime,
			size: value.derivative.size,
			locator: value.derivative.locator
		},
		source: {
			manifestHash: value.source.manifestHash,
			size: value.source.size,
			fileCount: value.source.fileCount
		},
		recipe: { id: value.recipe.id, version: value.recipe.version },
		reportDigest: value.reportDigest,
		placement: {
			metresPerSourceUnit: value.placement.metresPerSourceUnit,
			pivot: value.placement.pivot as [number, number, number],
			footprint: { width: value.placement.footprint.width, depth: value.placement.footprint.depth },
			contactMinY: value.placement.contactMinY,
			placement: 'floor'
		}
	};
}

export function createModelImportClient(
	apiOrigin: string,
	fetchImpl: FetchLike = globalThis.fetch.bind(globalThis)
): ModelImportClient | null {
	const origin = originOf(apiOrigin);
	if (origin.length === 0) return null;

	async function json(path: string, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
		let response: Response;
		try {
			response = await fetchImpl(`${origin}${path}`, {
				...init,
				credentials: 'include',
				...(signal === undefined ? {} : { signal }),
				headers: {
					Accept: 'application/json',
					...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
					...(init.headers ?? {})
				}
			});
		} catch (error) {
			if (signal?.aborted === true) throw error;
			throw new ModelImportClientError('network', 'The model request could not reach the API.');
		}
		let body: unknown = null;
		if (response.status !== 204) {
			try {
				body = await response.json();
			} catch {
				// An empty error body is mapped by status.
			}
		}
		if (!response.ok) throw errorFor(response.status, body);
		return body;
	}

	return {
		async createImport(input) {
			const body = await json(paths(input.projectId).imports, {
				method: 'POST',
				body: JSON.stringify({
					// The server requires the recipe identity beside the declaration and
					// rejects an undeclared field, so it is sent from the caller's own
					// recipe rather than re-declared here.
					recipe: { id: input.recipe.id, version: input.recipe.version },
					files: [
						...input.source.map((file) => ({ role: 'source', ...file })),
						{ role: 'derivative', ...input.derivative }
					]
				})
			});
			return readStaging(body);
		},
		async uploadFile(input) {
			let response: Response;
			try {
				response = await fetchImpl(`${origin}${paths(input.projectId).file(input.importId, input.fileId)}`, {
					method: 'PUT',
					body: input.bytes.slice() as unknown as BodyInit,
					credentials: 'include',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/octet-stream'
					}
				});
			} catch {
				throw new ModelImportClientError('network', 'The model upload could not reach the API.');
			}
			if (!response.ok) {
				let body: unknown = null;
				try {
					body = await response.json();
				} catch {
					// Mapped by status.
				}
				throw errorFor(response.status, body);
			}
		},
		async cancelImport(projectId, importId) {
			await json(paths(projectId).import(importId), { method: 'DELETE' });
		},
		async approveImport(input) {
			const body = await json(paths(input.projectId).approve(input.importId), {
				method: 'POST',
				body: JSON.stringify({ reportDigest: input.reportDigest, placement: input.placement })
			});
			return readApproved(body);
		},
		contentUrl(projectId, hash) {
			return `${origin}${paths(projectId).content(hash)}`;
		},
		async loadContent(projectId, hash, signal) {
			let response: Response;
			try {
				response = await fetchImpl(`${origin}${paths(projectId).content(hash)}`, {
					credentials: 'include',
					...(signal === undefined ? {} : { signal }),
					headers: { Accept: 'model/gltf-binary' }
				});
			} catch (error) {
				if (signal?.aborted === true) throw error;
				throw new ModelImportClientError('network', 'The approved model could not be loaded.');
			}
			if (!response.ok) {
				let body: unknown = null;
				try {
					body = await response.json();
				} catch {
					// Mapped by status.
				}
				throw errorFor(response.status, body);
			}
			return new Uint8Array(await response.arrayBuffer());
		}
	};
}

/** Declare one source/derivative pair for the import body. */
export function declaredFile(role: 'source' | 'derivative', file: CreatorImportFile, hash: string) {
	return { role, path: file.path, size: file.bytes.byteLength, hash };
}
