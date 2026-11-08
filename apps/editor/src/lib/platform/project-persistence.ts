import {
	isSavedBaseToken,
	type SaveAcknowledgement,
	type SaveRequest,
	type SavePrecondition
} from '@portfolio/project-model/save';
import { PROJECT_ASSET_MAX_BYTES } from '$lib/platform/mime-sniff';
import { perfMark, perfMeasureSync } from '$lib/platform/perf-marks';

import { ProjectPersistenceError, type FetchLike, type ProjectAuth } from './project-identity';
export { createProjectAuth, createProjectId, ProjectPersistenceError, type ProjectAuth, type ProjectLoginIntent, type ProjectPersistenceErrorCode } from './project-identity';


export { PROJECT_ASSET_MAX_BYTES } from '$lib/platform/mime-sniff';

export type ProjectAssetMime = 'image/png' | 'image/webp' | 'image/jpeg';
export type ProjectAssetImportState = 'pending' | 'ready' | 'failed';

export type ProjectAssetMetadata = {
	id: string;
	projectId: string;
	name: string;
	kind: 'texture' | 'procedural';
	storageKind: 'r2' | 'none';
	sourceKind: 'upload' | 'builtin' | 'procedural';
	sourceRef: string | null;
	mime: ProjectAssetMime | null;
	byteSize: number | null;
	sha256: string | null;
	importState: ProjectAssetImportState;
	createdAt: string;
	updatedAt: string;
};

export type ProjectAssetContent = {
	mime: ProjectAssetMime;
	bytes: Uint8Array;
};

export type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type ProjectSummary = {
	id: string;
	name: string;
	version: number;
	updatedAt: string;
};

export const PROJECT_NAME_MAX_LENGTH = 128;

export type ProjectPublicationStatus = {
	publicationId: string | null;
	activeVersion: number | null;
	revision: number;
	currentVersion: number;
	createdAt: string | null;
	updatedAt: string | null;
};

/** Metadata read immediately before a project lifecycle form is opened. */
export type PreparedProjectLifecycle = {
	projectId: string;
	name: string;
	version: number;
	precondition: ProjectLifecyclePrecondition;
	publication?: ProjectPublicationStatus;
	/** Set only for a conflict offer that requires an explicit refresh and retry. */
	requiresExplicitRefresh?: boolean;
};

export type ProjectLifecyclePrepareResult =
	| { kind: 'ready'; prepared: PreparedProjectLifecycle }
	| { kind: 'stale' }
	| { kind: 'blocked'; message: string }
	| { kind: 'error'; message: string };

export type ProjectLifecycleActionResult =
	| { kind: 'renamed'; name: string; version: number }
	| { kind: 'deleted'; cleanup: DeleteProjectAcknowledgement['cleanup'] }
	| { kind: 'unchanged' }
	| { kind: 'stale' }
	| {
			kind: 'conflict';
			message: string;
			remoteName: string | null;
			/** Fresh metadata only when the remote change is safe to retry against. */
			retryPrepared: PreparedProjectLifecycle | null;
	  }
	| { kind: 'refused'; message: string; retryable?: boolean }
	| { kind: 'error'; message: string; retryable: boolean };

export type SavedProject = Omit<ProjectSummary, 'id'> & { projectId: string };
export type ProjectLifecyclePrecondition = Extract<SavePrecondition, { kind: 'expected-saved-base' }>;
export type RenameProjectRequest = {
	name: string;
	precondition: ProjectLifecyclePrecondition;
};
export type DeleteProjectRequest = {
	precondition: ProjectLifecyclePrecondition;
};
export type DeleteProjectAcknowledgement = {
	projectId: string;
	cleanup: 'complete' | 'pending';
};
export type LoadedProject = SavedProject & {
	document: unknown;
	/** Additive saved-base metadata; absent on a pre-migration row. */
	savedBaseToken: string | null;
	savedRevision: { projectId: string; revisionId: string } | null;
	savedSourceContentId: string | null;
};

export type ProjectSession =
	| { authenticated: false }
	| { authenticated: true; user: { id: string } };

export type ProjectPersistenceConfig = {
	apiOrigin?: string;
	auth?: ProjectAuth | null;
	fetch?: FetchLike;
};


export type ProjectApi = {
	listProjects(signal?: AbortSignal): Promise<ProjectSummary[]>;
	/** The one write: conditional `SaveAcceptedSource@1`, never a bare document. */
	saveAcceptedSource(request: SaveRequest, signal?: AbortSignal): Promise<SaveAcknowledgement>;
	/** Rename through the expected-base lifecycle path; the server appends an immutable version. */
	renameProject(
		projectId: string,
		request: RenameProjectRequest,
		signal?: AbortSignal
	): Promise<SaveAcknowledgement>;
	/** Delete after caller confirmation; pending means owned-byte cleanup still needs retry. */
	deleteProject(
		projectId: string,
		request: DeleteProjectRequest,
		signal?: AbortSignal
	): Promise<DeleteProjectAcknowledgement>;
	/** Owner-scoped publication read used to prevent a doomed delete confirmation. */
	getPublicationStatus(projectId: string, signal?: AbortSignal): Promise<ProjectPublicationStatus>;
	loadProject(projectId: string, signal?: AbortSignal): Promise<LoadedProject>;
	listAssets(projectId: string, signal?: AbortSignal): Promise<ProjectAssetMetadata[]>;
	registerAsset(projectId: string, name: string, signal?: AbortSignal): Promise<ProjectAssetMetadata>;
	uploadAsset(
		projectId: string,
		assetId: string,
		bytes: Uint8Array,
		signal?: AbortSignal
	): Promise<ProjectAssetMetadata>;
	loadAssetContent(projectId: string, assetId: string, signal?: AbortSignal): Promise<ProjectAssetContent>;
};

export function createProjectApi(
	config: ProjectPersistenceConfig,
	fetchImpl?: FetchLike
): ProjectApi | null {
	const origin = normalizeApiOrigin(config.apiOrigin ?? '');
	if (!origin) return null;
	const requestFetch = fetchImpl ?? config.fetch ?? globalThis.fetch?.bind(globalThis);
	if (!requestFetch) throw new ProjectPersistenceError('configuration', 'Cloud requests are unavailable');

	return {
		listProjects: (signal) =>
			requestJson(requestFetch, origin, '/projects', { method: 'GET' }, signal).then(readProjectList),
		saveAcceptedSource: (request, signal) => {
			const body = perfMeasureSync('save.request-json', () => JSON.stringify(request));
			return requestJson(
				requestFetch,
				origin,
				`/projects/${encodeURIComponent(request.capture.projectId)}`,
				{ method: 'PUT', body },
				signal,
				() => perfMark('save:request', {
					projectId: request.capture.projectId,
					operationId: request.capture.operationId
				})
			).then((value) => perfMeasureSync('save.acknowledgement-decode', () => readSaveAcknowledgement(value)));
		},
		renameProject: (projectId, request, signal) =>
			requestJson(
				requestFetch,
				origin,
				`/projects/${encodeURIComponent(projectId)}`,
				{ method: 'PATCH', body: JSON.stringify(request) },
				signal
			)
				.then(readSaveAcknowledgement)
				.then((acknowledgement) => {
					if (
						acknowledgement.projectId !== projectId ||
						(acknowledgement.savedRevision && acknowledgement.savedRevision.projectId !== projectId)
					) {
						throw invalidResponse();
					}
					return acknowledgement;
				}),
		deleteProject: (projectId, request, signal) =>
			requestJson(
				requestFetch,
				origin,
				`/projects/${encodeURIComponent(projectId)}`,
				{ method: 'DELETE', body: JSON.stringify(request) },
				signal
			)
				.then(readDeleteAcknowledgement)
				.then((acknowledgement) => {
					if (acknowledgement.projectId !== projectId) throw invalidResponse();
					return acknowledgement;
				}),
		getPublicationStatus: (projectId, signal) =>
			requestJson(
				requestFetch,
				origin,
				`/projects/${encodeURIComponent(projectId)}/publication`,
				{ method: 'GET' },
				signal
			).then(readPublicationStatus),
		loadProject: (projectId, signal) =>
			requestJson(
				requestFetch,
				origin,
				`/projects/${encodeURIComponent(projectId)}`,
				{ method: 'GET' },
				signal
			).then(readLoadedProject),
		listAssets: (projectId, signal) =>
			requestJson(
				requestFetch,
				origin,
				`${assetPath(projectId)}`,
				{ method: 'GET' },
				signal
			).then(readAssetList),
		registerAsset: (projectId, name, signal) =>
			requestJson(
				requestFetch,
				origin,
				`${assetPath(projectId)}`,
				{ method: 'POST', body: JSON.stringify({ name }) },
				signal
			).then(readAssetMetadata),
		uploadAsset: (projectId, assetId, bytes, signal) =>
			requestAssetUpload(
				requestFetch,
				origin,
				`${assetPath(projectId)}/${encodeURIComponent(assetId)}/content`,
				bytes,
				signal
			).then(readAssetMetadata),
		loadAssetContent: (projectId, assetId, signal) =>
			requestAssetBytes(
				requestFetch,
				origin,
				`${assetPath(projectId)}/${encodeURIComponent(assetId)}/content`,
				{ method: 'GET' },
				signal
			)
	};
}

export type ProjectFingerprint = {
	sceneCanonicalJson: string;
	layoutCanonicalJson: string;
	projectName: string;
};

export function projectFingerprint(
	sceneCanonicalJson: string,
	layoutCanonicalJson: string,
	projectName: string
): ProjectFingerprint {
	return { sceneCanonicalJson, layoutCanonicalJson, projectName };
}

export function sameProjectFingerprint(a: ProjectFingerprint, b: ProjectFingerprint): boolean {
	return (
		a.sceneCanonicalJson === b.sceneCanonicalJson &&
		a.layoutCanonicalJson === b.layoutCanonicalJson &&
		a.projectName === b.projectName
	);
}

function normalizeApiOrigin(origin: string): string {
	return origin.trim().replace(/\/+$/, '');
}

function assetPath(projectId: string): string {
	return `/projects/${encodeURIComponent(projectId)}/assets`;
}

async function requestJson(
	fetchImpl: FetchLike,
	origin: string,
	path: string,
	init: RequestInit,
	signal?: AbortSignal,
	onBeforeFetch?: () => void
): Promise<unknown> {
	let response: Response;
	try {
		const dispatch = () => {
			const url = `${origin}${path}`;
			const request: RequestInit = {
				...init,
				credentials: 'include',
				signal,
				headers: {
					Accept: 'application/json',
					...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
					...(init.headers ?? {})
				}
			};
			onBeforeFetch?.();
			return fetchImpl(url, request);
		};
		const pendingResponse = onBeforeFetch ? perfMeasureSync('save.request-dispatch', dispatch) : dispatch();
		response = await pendingResponse;
	} catch (error) {
		if (isAbort(error, signal)) throw error;
		throw new ProjectPersistenceError('network', 'Cloud request failed');
	}

	let body: unknown = null;
	if (response.status !== 204) {
		try {
			body = await response.json();
		} catch {
			// Empty error bodies are mapped by status below.
		}
	}
	if (response.ok) return body;
	throw responseError(response.status, body);
}

async function requestAssetUpload(
	fetchImpl: FetchLike,
	origin: string,
	path: string,
	bytes: Uint8Array,
	signal?: AbortSignal
): Promise<unknown> {
	let response: Response;
	try {
		response = await fetchImpl(`${origin}${path}`, {
			method: 'PUT',
			body: bytes.slice(),
			credentials: 'include',
			signal,
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/octet-stream'
			}
		});
	} catch (error) {
		if (isAbort(error, signal)) throw error;
		throw new ProjectPersistenceError('network', 'Cloud request failed');
	}

	let body: unknown = null;
	if (response.status !== 204) {
		try {
			body = await response.json();
		} catch {
			// Empty error bodies are mapped by status below.
		}
	}
	if (response.ok) return body;
	throw responseError(response.status, body);
}

async function requestAssetBytes(
	fetchImpl: FetchLike,
	origin: string,
	path: string,
	init: RequestInit,
	signal?: AbortSignal
): Promise<ProjectAssetContent> {
	let response: Response;
	try {
		response = await fetchImpl(`${origin}${path}`, {
			...init,
			credentials: 'include',
			signal,
			headers: {
				Accept: 'image/png, image/webp, image/jpeg',
				...(init.headers ?? {})
			}
		});
	} catch (error) {
		if (isAbort(error, signal)) throw error;
		throw new ProjectPersistenceError('network', 'Cloud request failed');
	}

	if (!response.ok) {
		let body: unknown = null;
		try {
			body = await response.json();
		} catch {
			// Empty error bodies are mapped by status below.
		}
		throw responseError(response.status, body);
	}

	const contentLength = readAssetContentLength(response.headers.get('content-length'));
	try {
		const mime = readAssetMime(response.headers.get('content-type'));
		const bytes = await readBoundedAssetBody(response, contentLength);
		return { mime, bytes };
	} catch (error) {
		if (isAbort(error, signal)) throw error;
		if (error instanceof ProjectPersistenceError) throw error;
		throw new ProjectPersistenceError('network', 'Cloud response could not be read');
	}
}

function readAssetContentLength(value: string | null): number {
	if (value === null || !/^\d+$/.test(value.trim())) throw invalidResponse();
	const length = Number(value);
	if (!Number.isSafeInteger(length) || length < 1 || length > PROJECT_ASSET_MAX_BYTES) {
		throw invalidResponse();
	}
	return length;
}

async function readBoundedAssetBody(response: Response, expectedLength: number): Promise<Uint8Array> {
	if (!response.body) throw invalidResponse();
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > expectedLength || total > PROJECT_ASSET_MAX_BYTES) {
				try {
					await reader.cancel();
				} catch {
					// The response is already invalid; preserve that result.
				}
				throw invalidResponse();
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	if (total !== expectedLength) throw invalidResponse();

	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

function responseError(status: number, body: unknown): ProjectPersistenceError {
	const serverCode = readErrorCode(body);
	const issues = readErrorIssues(body);
	if (serverCode === 'project-busy' || serverCode === 'project_busy') {
		return new ProjectPersistenceError(
			'project-busy',
			readErrorMessage(body) ?? 'Project cleanup is blocked by an active write; retry after it stops',
			status,
			serverCode
		);
	}
	if (serverCode === 'unpublish-first') {
		return new ProjectPersistenceError(
			'unpublish-first',
			readErrorMessage(body) ?? 'Unpublish this project before deleting it',
			status,
			serverCode
		);
	}
	if (status === 401) return new ProjectPersistenceError('auth', 'Sign-in is required', status, serverCode);
	if (status === 404) return new ProjectPersistenceError('not-found', 'Project not found', status, serverCode);
	if (status === 413) return new ProjectPersistenceError('too-large', 'Project payload is too large', status, serverCode);
	// A gateway timeout is the ambiguous case the receipt protocol exists for: the
	// server may have committed the Save, so the caller must retry the *same*
	// captured operation and let its receipt decide instead of minting a fresh one
	// from a base that has already moved. A throttle is the unambiguous twin: the
	// write was not applied, and the same capture is still safe to resend.
	if (status === 408) return new ProjectPersistenceError('network', 'Cloud request timed out', status, serverCode);
	if (status === 429) return new ProjectPersistenceError('network', 'Cloud request was throttled', status, serverCode);
	if (status >= 500) return new ProjectPersistenceError('server', 'Cloud service is unavailable', status, serverCode);
	if (status === 409 && serverCode === 'conflict') {
		return new ProjectPersistenceError('conflict', 'The saved base changed; reload before saving', status, serverCode);
	}
	if (status === 409 && serverCode === 'save_collision') {
		return new ProjectPersistenceError('collision', 'A project with this ID already exists', status, serverCode);
	}
	return new ProjectPersistenceError(
		'invalid',
		readErrorMessage(body) ?? 'Cloud request was rejected',
		status,
		serverCode,
		issues
	);
}

function readSession(value: unknown): ProjectSession {
	if (!isRecord(value) || typeof value.authenticated !== 'boolean') throw invalidResponse();
	if (!value.authenticated) return { authenticated: false };
	if (!isRecord(value.user)) throw invalidResponse();
	return { authenticated: true, user: { id: readString(value.user.id) } };
}

function readProjectList(value: unknown): ProjectSummary[] {
	if (!isRecord(value) || !Array.isArray(value.projects)) throw invalidResponse();
	return value.projects.map(readSummary);
}

function readAssetList(value: unknown): ProjectAssetMetadata[] {
	if (
		!isRecord(value) ||
		Object.keys(value).length !== 1 ||
		!Array.isArray(value.assets)
	) {
		throw invalidResponse();
	}
	return value.assets.map(readAssetMetadata);
}

const PROJECT_ASSET_METADATA_KEYS = [
	'id',
	'projectId',
	'name',
	'kind',
	'storageKind',
	'sourceKind',
	'sourceRef',
	'mime',
	'byteSize',
	'sha256',
	'importState',
	'createdAt',
	'updatedAt'
] as const;

function readAssetMetadata(value: unknown): ProjectAssetMetadata {
	if (
		!isRecord(value) ||
		Object.keys(value).length !== PROJECT_ASSET_METADATA_KEYS.length ||
		PROJECT_ASSET_METADATA_KEYS.some((key) => !Object.prototype.hasOwnProperty.call(value, key))
	) {
		throw invalidResponse();
	}
	return {
		id: readAssetId(value.id),
		projectId: readString(value.projectId),
		name: readString(value.name),
		kind: readEnum(value.kind, ['texture', 'procedural']),
		storageKind: readEnum(value.storageKind, ['r2', 'none']),
		sourceKind: readEnum(value.sourceKind, ['upload', 'builtin', 'procedural']),
		sourceRef: readNullableString(value.sourceRef),
		mime: readNullableEnum(value.mime, ['image/png', 'image/webp', 'image/jpeg']),
		byteSize: readNullableAssetByteSize(value.byteSize),
		sha256: readNullableSha256(value.sha256),
		importState: readEnum(value.importState, ['pending', 'ready', 'failed']),
		createdAt: readString(value.createdAt),
		updatedAt: readString(value.updatedAt)
	};
}

function readSavedProject(value: unknown): SavedProject {
	if (!isRecord(value)) throw invalidResponse();
	return {
		projectId: readString(value.projectId),
		name: readString(value.name),
		version: readVersion(value.version),
		updatedAt: readString(value.updatedAt)
	};
}

function readSaveAcknowledgement(value: unknown): SaveAcknowledgement {
	const saved = readSavedProject(value);
	if (!isRecord(value)) throw invalidResponse();
	const savedBaseToken = value.savedBaseToken;
	if (!isSavedBaseToken(savedBaseToken)) throw invalidResponse();
	return {
		...saved,
		savedBaseToken,
		savedRevision: readRevision(value.savedRevision),
		sourceContentId: readContentId(value.sourceContentId)
	};
}

function readDeleteAcknowledgement(value: unknown): DeleteProjectAcknowledgement {
	if (!isRecord(value)) throw invalidResponse();
	return {
		projectId: readString(value.projectId),
		cleanup: readEnum(value.cleanup, ['complete', 'pending'])
	};
}

function readLoadedProject(value: unknown): LoadedProject {
	if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, 'document')) {
		throw invalidResponse();
	}
	return {
		...readSavedProject(value),
		document: value.document,
		savedBaseToken: readNullableSavedBaseToken(value.savedBaseToken),
		savedRevision: readNullableRevision(value.savedRevision),
		savedSourceContentId: readNullableContentId(value.savedSourceContentId)
	};
}

function readPublicationStatus(value: unknown): ProjectPublicationStatus {
	const keys = ['publicationId', 'activeVersion', 'revision', 'currentVersion', 'createdAt', 'updatedAt'] as const;
	if (!isRecord(value) || Object.keys(value).length !== keys.length || keys.some((key) => !(key in value))) {
		throw invalidResponse();
	}
	return {
		publicationId: readNullableString(value.publicationId),
		activeVersion: readNullableVersion(value.activeVersion),
		revision: readVersion(value.revision),
		currentVersion: readVersion(value.currentVersion),
		createdAt: readNullableString(value.createdAt),
		updatedAt: readNullableString(value.updatedAt)
	};
}

function readRevision(value: unknown): { projectId: string; revisionId: string } {
	if (!isRecord(value)) throw invalidResponse();
	return { projectId: readString(value.projectId), revisionId: readString(value.revisionId) };
}

function readNullableRevision(value: unknown): { projectId: string; revisionId: string } | null {
	if (value === null || value === undefined) return null;
	return readRevision(value);
}

function readNullableSavedBaseToken(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	if (!isSavedBaseToken(value)) throw invalidResponse();
	return value as string;
}

function readContentId(value: unknown): string {
	if (typeof value !== 'string' || !/^sha256-[0-9a-f]{64}$/.test(value)) throw invalidResponse();
	return value;
}

function readNullableContentId(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	return readContentId(value);
}

function readSummary(value: unknown): ProjectSummary {
	if (!isRecord(value)) throw invalidResponse();
	return {
		id: readString(value.id),
		name: readString(value.name),
		version: readVersion(value.version),
		updatedAt: readString(value.updatedAt)
	};
}

function readVersion(value: unknown): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalidResponse();
	return value;
}

function readNullableVersion(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	return readVersion(value);
}

function readAssetId(value: unknown): string {
	const id = readString(value);
	if (!/^[A-Za-z0-9_-]+$/.test(id)) throw invalidResponse();
	return id;
}

function readEnum<const Values extends readonly string[]>(value: unknown, values: Values): Values[number] {
	if (typeof value !== 'string' || !values.includes(value)) throw invalidResponse();
	return value as Values[number];
}

function readNullableString(value: unknown): string | null {
	if (value === null) return null;
	return readString(value);
}

function readNullableEnum<const Values extends readonly string[]>(
	value: unknown,
	values: Values
): Values[number] | null {
	if (value === null) return null;
	return readEnum(value, values);
}

function readAssetMime(value: string | null): ProjectAssetMime {
	const mime = value?.split(';', 1)[0]?.trim().toLowerCase();
	if (mime !== 'image/png' && mime !== 'image/webp' && mime !== 'image/jpeg') {
		throw invalidResponse();
	}
	return mime;
}

function readNullableAssetByteSize(value: unknown): number | null {
	if (value === null) return null;
	if (
		typeof value !== 'number' ||
		!Number.isSafeInteger(value) ||
		value < 1 ||
		value > PROJECT_ASSET_MAX_BYTES
	) {
		throw invalidResponse();
	}
	return value;
}

function readNullableSha256(value: unknown): string | null {
	if (value === null) return null;
	if (typeof value !== 'string' || !/^sha256-[0-9a-f]{64}$/.test(value)) {
		throw invalidResponse();
	}
	return value;
}

function readString(value: unknown): string {
	if (typeof value !== 'string' || value.length === 0) throw invalidResponse();
	return value;
}

function invalidResponse(): ProjectPersistenceError {
	return new ProjectPersistenceError('server', 'Cloud response was invalid');
}

function readErrorMessage(value: unknown): string | null {
	if (!isRecord(value) || !isRecord(value.error) || typeof value.error.message !== 'string') return null;
	return value.error.message;
}

function readErrorCode(value: unknown): string | undefined {
	if (!isRecord(value) || !isRecord(value.error) || typeof value.error.code !== 'string') return undefined;
	return value.error.code;
}

function readErrorIssues(value: unknown): { path: string; code: string; message: string }[] | undefined {
	if (!isRecord(value) || !Array.isArray(value.issues)) return undefined;
	const issues: { path: string; code: string; message: string }[] = [];
	for (const issue of value.issues) {
		if (!isRecord(issue) || typeof issue.path !== 'string' || typeof issue.code !== 'string' || typeof issue.message !== 'string') {
			return undefined;
		}
		issues.push({ path: issue.path, code: issue.code, message: issue.message });
	}
	return issues;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAbort(error: unknown, signal?: AbortSignal): boolean {
	return signal?.aborted === true || (error instanceof DOMException && error.name === 'AbortError');
}
