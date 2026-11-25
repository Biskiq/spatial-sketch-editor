import { type ModelPlacement } from '@portfolio/project-model/units';
import { sha256 } from './storage';

/** Unapproved staging is deleted after 24 hours, bytes included. */
export const MODEL_STAGING_TTL_MS = 24 * 60 * 60 * 1000;

export const SHA256_PATTERN = /^sha256-[0-9a-f]{64}$/;
export const FILE_PATH_PATTERN = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

export type ModelFileRole = 'source' | 'derivative';

export type DeclaredModelFile = {
	readonly role: ModelFileRole;
	readonly path: string;
	readonly size: number;
	readonly hash: string;
};

export type ModelStagedFile = DeclaredModelFile & {
	readonly fileId: string;
	readonly uploadState: 'declared' | 'uploaded' | 'failed';
};

export type ModelImport = {
	readonly importId: string;
	readonly projectId: string;
	readonly state: 'staging' | 'approved' | 'cancelled' | 'expired';
	readonly expiresAt: string;
	readonly source: { readonly manifestHash: string; readonly size: number; readonly fileCount: number };
	readonly derivativeBytes: number;
	readonly recipe: { readonly id: string; readonly version: number };
	readonly files: readonly ModelStagedFile[];
};

export type ModelRevision = {
	readonly revisionId: string;
	readonly projectId: string;
	readonly contentHash: string;
	readonly derivative: { readonly hash: string; readonly mime: string; readonly size: number; readonly locator: string };
	readonly source: { readonly manifestHash: string; readonly size: number; readonly fileCount: number };
	readonly recipe: { readonly id: string; readonly version: number };
	readonly reportDigest: string;
	readonly placement: ModelPlacement;
};

export class ModelNotFoundError extends Error {
	constructor() {
		super('Model import or revision not found');
		this.name = 'ModelNotFoundError';
	}
}

export class ModelInputError extends Error {
	readonly statusCode: 400 | 409 | 411 | 413 | 415;
	readonly code:
		| 'invalid_model_import'
		| 'invalid_model_file'
		| 'invalid_upload'
		| 'length_required'
		| 'payload_too_large'
		| 'unsupported_media_type'
		| 'model_not_ready'
		| 'model_structure_refused';

	constructor(code: ModelInputError['code'], statusCode: ModelInputError['statusCode'], message: string) {
		super(message);
		this.name = 'ModelInputError';
		this.code = code;
		this.statusCode = statusCode;
	}
}

/**
 * Save refuses an envelope whose `model` resource names bytes this project has
 * not approved. A typed refusal, never a generic validation error: the caller
 * must be able to tell an unapproved pin from an invalid envelope.
 */
export class ModelPinRefusalError extends Error {
	readonly code = 'unapproved_model_resource' as const;
	readonly issues: readonly { path: string; code: string; message: string }[];

	constructor(message: string, issues: readonly { path: string; code: string; message: string }[] = []) {
		super(message);
		this.name = 'ModelPinRefusalError';
		this.issues = issues;
	}
}

export type ImportRow = {
	importId: unknown;
	projectId: unknown;
	state: unknown;
	expiresAt: unknown;
	sourceManifestHash: unknown;
	sourceBytes: unknown;
	derivativeBytes: unknown;
	recipeId: unknown;
	recipeVersion: unknown;
};

export type FileRow = {
	importId: unknown;
	fileId: unknown;
	role: unknown;
	path: unknown;
	byteSize: unknown;
	sha256: unknown;
	objectKey: unknown;
	uploadState: unknown;
};

export type RevisionRow = {
	id: unknown;
	projectId: unknown;
	contentHash: unknown;
	derivativeHash: unknown;
	derivativeMime: unknown;
	derivativeBytes: unknown;
	derivativeKey: unknown;
	sourceManifestHash: unknown;
	sourceBytes: unknown;
	sourceFileCount: unknown;
	recipeId: unknown;
	recipeVersion: unknown;
	reportDigest: unknown;
	placement: unknown;
};

export function importColumns(prefix: string): string {
	const c = (name: string) => `${prefix}${name}`;
	return `
	${c('id')} AS "importId",
	${c('project_id')} AS "projectId",
	${c('state')},
	${c('expires_at')} AS "expiresAt",
	${c('source_manifest_hash')} AS "sourceManifestHash",
	${c('source_bytes')} AS "sourceBytes",
	${c('derivative_bytes')} AS "derivativeBytes",
	${c('recipe_id')} AS "recipeId",
	${c('recipe_version')} AS "recipeVersion"`;
}

export const IMPORT_COLUMNS = importColumns('i.');

export function fileColumns(prefix: string): string {
	const c = (name: string) => `${prefix}${name}`;
	return `
	${c('import_id')} AS "importId",
	${c('file_id')} AS "fileId",
	${c('role')},
	${c('path')},
	${c('byte_size')} AS "byteSize",
	${c('sha256')},
	${c('object_key')} AS "objectKey",
	${c('upload_state')} AS "uploadState"`;
}

export const FILE_COLUMNS = fileColumns('f.');

export function revisionColumns(prefix: string): string {
	const c = (name: string) => `${prefix}${name}`;
	return `
	${c('id')},
	${c('project_id')} AS "projectId",
	${c('content_hash')} AS "contentHash",
	${c('derivative_hash')} AS "derivativeHash",
	${c('derivative_mime')} AS "derivativeMime",
	${c('derivative_bytes')} AS "derivativeBytes",
	${c('derivative_key')} AS "derivativeKey",
	${c('source_manifest_hash')} AS "sourceManifestHash",
	${c('source_bytes')} AS "sourceBytes",
	${c('source_file_count')} AS "sourceFileCount",
	${c('recipe_id')} AS "recipeId",
	${c('recipe_version')} AS "recipeVersion",
	${c('report_digest')} AS "reportDigest",
	${c('placement')}`;
}

export const REVISION_COLUMNS = revisionColumns('r.');
export const REVISION_RETURNING = revisionColumns('');

export function importOf(row: ImportRow, files: readonly FileRow[]): ModelImport {
	return {
		importId: readString(row.importId),
		projectId: readString(row.projectId),
		state: readEnum(row.state, ['staging', 'approved', 'cancelled', 'expired']),
		expiresAt: readTimestamp(row.expiresAt),
		source: {
			manifestHash: readString(row.sourceManifestHash),
			size: readSafeInteger(row.sourceBytes),
			fileCount: files.filter((file) => readString(file.role) === 'source').length
		},
		derivativeBytes: readSafeInteger(row.derivativeBytes),
		recipe: { id: readString(row.recipeId), version: readSafeInteger(row.recipeVersion) },
		files: files.map((file) => ({
			fileId: readString(file.fileId),
			role: readString(file.role) === 'derivative' ? 'derivative' : 'source',
			path: readString(file.path),
			size: readSafeInteger(file.byteSize),
			hash: readString(file.sha256),
			uploadState: readEnum(file.uploadState, ['declared', 'uploaded', 'failed'])
		}))
	};
}

export function revisionOf(row: RevisionRow): ModelRevision {
	const derivative = { hash: readString(row.derivativeHash), size: readSafeInteger(row.derivativeBytes) };
	const projectId = readString(row.projectId);
	return {
		revisionId: readString(row.id),
		projectId,
		contentHash: readString(row.contentHash),
		derivative: {
			hash: derivative.hash,
			mime: readString(row.derivativeMime),
			size: derivative.size,
			locator: modelRevisionLocator(projectId, derivative.hash)
		},
		source: {
			manifestHash: readString(row.sourceManifestHash),
			size: readSafeInteger(row.sourceBytes),
			fileCount: readSafeInteger(row.sourceFileCount)
		},
		recipe: { id: readString(row.recipeId), version: readSafeInteger(row.recipeVersion) },
		reportDigest: readString(row.reportDigest),
		placement: readPlacement(row.placement)
	};
}

/** The owner-only, immutable content route keyed by the derivative's hash. */
export function modelRevisionLocator(projectId: string, derivativeHash: string): string {
	return `/projects/${encodeURIComponent(projectId)}/models/content/${derivativeHash}`;
}

export function readPlacement(value: unknown): ModelPlacement {
	const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
	if (!isRecord(parsed) || !isRecord(parsed.footprint)) throw new Error('Model revision contained an invalid placement');
	const pivot = parsed.pivot;
	if (!Array.isArray(pivot) || pivot.length !== 3 || pivot.some((entry) => typeof entry !== 'number')) {
		throw new Error('Model revision contained an invalid placement pivot');
	}
	if (parsed.placement !== 'floor') throw new Error('Model revision contained an invalid placement surface');
	return {
		metresPerSourceUnit: Number(parsed.metresPerSourceUnit),
		pivot: [pivot[0] as number, pivot[1] as number, pivot[2] as number],
		footprint: { width: Number(parsed.footprint.width), depth: Number(parsed.footprint.depth) },
		contactMinY: Number(parsed.contactMinY),
		placement: 'floor'
	};
}

export function readString(value: unknown): string {
	if (typeof value !== 'string' || value.length === 0) throw new Error('Model row contained an invalid string');
	return value;
}

export function readNullableString(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	return readString(value);
}

export function readEnum<const Values extends readonly string[]>(value: unknown, values: Values): Values[number] {
	if (typeof value !== 'string' || !values.includes(value)) throw new Error('Model row contained an invalid enum');
	return value as Values[number];
}

export function readSafeInteger(value: unknown): number {
	const result = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	if (!Number.isSafeInteger(result) || result < 0) throw new Error('Model row contained an invalid integer');
	return result;
}

export function readTimestamp(value: unknown): string {
	const date = value instanceof Date ? value : new Date(String(value));
	if (Number.isNaN(date.getTime())) throw new Error('Model row contained an invalid timestamp');
	return date.toISOString();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
