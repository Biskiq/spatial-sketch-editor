import { createHash, randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

import {
	compileWallFirstLayoutGeometry,
	getShippedMaterialById,
	getShippedModelByAssetId,
	hasBlockingLayoutIssues,
	isAllowedShippedTextureUri,
	validateProject,
	type ProjectDocument
} from '@portfolio/project-model';

import { MAX_ASSET_BYTES, type StoredAsset } from './asset-persistence.js';
import type { DatabaseClient, DatabasePool } from './database.js';
import { ProjectNotFoundError, queryRows } from './project-persistence.js';
import type { ObjectStore } from './object-store.js';
import { REGISTRY_SCENE_OPTIONS, isRootRelativeSafe } from './scene-registry.js';

export type PublicationStatus = {
	publicationId: string | null;
	activeVersion: number | null;
	revision: number;
	currentVersion: number;
	createdAt: string | null;
	updatedAt: string | null;
};

export type PublicAssetProjection = {
	assetId: string;
	mime: string;
	byteSize: number;
};

export type PublicRelease = {
	name: string;
	version: number;
	revision: number;
	document: ProjectDocument;
	assets: PublicAssetProjection[];
};

export type PinnedReleaseAsset = {
	assetId: string;
	objectKey: string;
	sha256: string;
	mime: string;
	byteSize: number;
};

export type ReleaseManifest = {
	version: 1;
	assets: PinnedReleaseAsset[];
};

export class PublicationNotFoundError extends Error {
	constructor() {
		super('Publication not found');
		this.name = 'PublicationNotFoundError';
	}
}

export class PublicationConflictError extends Error {
	readonly revision: number;
	constructor(revision: number) {
		super(`Publication changed (revision ${revision}); refetch status and retry`);
		this.name = 'PublicationConflictError';
		this.revision = revision;
	}
}

export class PublicationValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PublicationValidationError';
	}
}

const PROJECT_ASSET_PATTERN = /^\/project-assets\/([A-Za-z0-9_-]+)$/;
const PACKAGE_REWRITE_PATTERN = /^\/textures\/package-[0-9a-f]{12}\/[^?#]+$/;
const LOCAL_BINARY_PATTERN = /^\/local\/[0-9a-f]{12}\/[^?#]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidPublicationId(value: unknown): value is string {
	return typeof value === 'string' && UUID_PATTERN.test(value);
}

type PublicationRow = {
	projectId: unknown;
	publicId: unknown;
	activeVersion: unknown;
	revision: unknown;
	createdAt: unknown;
	updatedAt: unknown;
};

type VersionRow = {
	version: unknown;
	document: unknown;
};

type ReleaseRow = {
	manifest: unknown;
};

const PUBLICATION_COLUMNS = `
	p.project_id AS "projectId",
	p.public_id AS "publicId",
	p.active_version AS "activeVersion",
	p.revision,
	p.created_at AS "createdAt",
	p.updated_at AS "updatedAt"`;

const PUBLICATION_INSERT_RETURNING = `
	project_id AS "projectId",
	public_id AS "publicId",
	active_version AS "activeVersion",
	revision,
	created_at AS "createdAt",
	updated_at AS "updatedAt"`;

/**
 * Owner-only status. Never allocates a public ID: a project without a
 * publication row reads as never-published with revision 0.
 */
export async function getPublicationStatus(
	db: Pick<DatabasePool, 'query'>,
	ownerId: string,
	projectId: string
): Promise<PublicationStatus> {
	const owned = await queryRows<{ latestVersion: unknown }>(
		db,
		`SELECT latest_version AS "latestVersion"
FROM projects
WHERE id = $1 AND owner_id = $2`,
		[projectId, ownerId]
	);
	if (!owned[0]) throw new ProjectNotFoundError();
	const rows = await queryRows<PublicationRow>(
		db,
		`SELECT ${PUBLICATION_COLUMNS}
FROM publications p
WHERE p.project_id = $1`,
		[projectId]
	);
	return toStatus(rows[0] ?? null, readSafeInteger(owned[0].latestVersion));
}

/**
 * Publish exactly the requested saved version. Preparation (validation + R2
 * verification) runs outside any SQL transaction; the state switch is one
 * short row-locked transaction. Idempotent when the requested version is
 * already active: returns current status without another revision increment.
 */
export async function publishVersion(
	pool: DatabasePool,
	ownerId: string,
	projectId: string,
	version: number,
	expectedRevision: number,
	objectStore: ObjectStore | undefined
): Promise<PublicationStatus> {
	const prepared = await prepareRelease(pool, ownerId, projectId, version, objectStore);
	return withPublicationTransaction(pool, async (db) => {
		const locked = await queryRows<{ latestVersion: unknown }>(
			db,
			`SELECT latest_version AS "latestVersion"
FROM projects
WHERE id = $1 AND owner_id = $2
FOR UPDATE`,
			[projectId, ownerId]
		);
		if (!locked[0]) throw new ProjectNotFoundError();
		const currentVersion = readSafeInteger(locked[0].latestVersion);

		const existing = await queryRows<PublicationRow>(
			db,
			`SELECT ${PUBLICATION_COLUMNS}
FROM publications p
WHERE p.project_id = $1
FOR UPDATE`,
			[projectId]
		);
		const current = existing[0] ?? null;
		const currentRevision = current ? readSafeInteger(current.revision) : 0;
		if (expectedRevision !== currentRevision) throw new PublicationConflictError(currentRevision);
		if (current && readNullableVersion(current.activeVersion) === version) {
			return toStatus(current, currentVersion);
		}

		await db.query(
			`INSERT INTO releases (project_id, version, manifest)
VALUES ($1, $2, $3)
ON CONFLICT DO NOTHING`,
			[projectId, version, prepared.manifest]
		);
		const stored = await queryRows<ReleaseRow>(
			db,
			`SELECT manifest FROM releases WHERE project_id = $1 AND version = $2`,
			[projectId, version]
		);
		if (!stored[0]) throw new Error('Release insert returned no row');

		// Any changed preparation input invalidates the attempt: the pinned
		// asset rows must still be ready under the verified object keys.
		if (!(await recheckPinnedAssets(db, projectId, prepared.manifest))) {
			throw new PublicationConflictError(currentRevision);
		}

		if (!current) {
			const inserted = await queryRows<PublicationRow>(
				db,
				`INSERT INTO publications (project_id, public_id, active_version, revision)
VALUES ($1, $2, $3, 1)
ON CONFLICT DO NOTHING
RETURNING ${PUBLICATION_INSERT_RETURNING}`,
				[projectId, randomUUID(), version]
			);
			if (inserted[0]) return toStatus(inserted[0], currentVersion);
			// Lost the first-publish race: re-read the winner under lock and
			// reject — the winner's revision already moved past our expectation.
			const winner = await queryRows<PublicationRow>(
				db,
				`SELECT ${PUBLICATION_COLUMNS}
FROM publications p
WHERE p.project_id = $1
FOR UPDATE`,
				[projectId]
			);
			throw new PublicationConflictError(winner[0] ? readSafeInteger(winner[0].revision) : 1);
		}

		const updated = await queryRows<PublicationRow>(
			db,
			`UPDATE publications AS p
SET active_version = $2, revision = revision + 1, updated_at = now()
WHERE project_id = $1
RETURNING ${PUBLICATION_COLUMNS}`,
			[projectId, version]
		);
		if (!updated[0]) throw new Error('Publication update returned no row');
		return toStatus(updated[0], currentVersion);
	});
}

/**
 * Unpublish: disable all document/byte delivery for the stable public ID
 * while retaining releases and the ID itself. Idempotent when already
 * unpublished.
 */
export async function unpublishVersion(
	pool: DatabasePool,
	ownerId: string,
	projectId: string,
	expectedRevision: number
): Promise<PublicationStatus> {
	return withPublicationTransaction(pool, async (db) => {
		const locked = await queryRows<{ latestVersion: unknown }>(
			db,
			`SELECT latest_version AS "latestVersion"
FROM projects
WHERE id = $1 AND owner_id = $2
FOR UPDATE`,
			[projectId, ownerId]
		);
		if (!locked[0]) throw new ProjectNotFoundError();
		const currentVersion = readSafeInteger(locked[0].latestVersion);

		const existing = await queryRows<PublicationRow>(
			db,
			`SELECT ${PUBLICATION_COLUMNS}
FROM publications p
WHERE p.project_id = $1
FOR UPDATE`,
			[projectId]
		);
		const current = existing[0] ?? null;
		if (!current) throw new PublicationNotFoundError();
		const currentRevision = readSafeInteger(current.revision);
		if (expectedRevision !== currentRevision) throw new PublicationConflictError(currentRevision);
		if (readNullableVersion(current.activeVersion) === null) return toStatus(current, currentVersion);

		const updated = await queryRows<PublicationRow>(
			db,
			`UPDATE publications AS p
SET active_version = NULL, revision = revision + 1, updated_at = now()
WHERE project_id = $1
RETURNING ${PUBLICATION_COLUMNS}`,
			[projectId]
		);
		if (!updated[0]) throw new Error('Publication update returned no row');
		return toStatus(updated[0], currentVersion);
	});
}

/**
 * Anonymous active release: saved document + version + public asset
 * projection. Unpublished or unknown IDs read as not found with no
 * ownership or storage detail.
 */
export async function readPublicRelease(
	db: Pick<DatabasePool, 'query'>,
	publicId: string
): Promise<PublicRelease> {
	const rows = await queryRows<{
		name: unknown;
		version: unknown;
		revision: unknown;
		document: unknown;
		manifest: unknown;
	}>(
		db,
		`SELECT v.document, p.active_version AS version, p.revision,
	r.manifest
FROM publications p
JOIN project_versions v
	ON v.project_id = p.project_id AND v.version = p.active_version
JOIN releases r
	ON r.project_id = p.project_id AND r.version = p.active_version
WHERE p.public_id = $1::uuid AND p.active_version IS NOT NULL`,
		[publicId]
	);
	const row = rows[0];
	if (!row) throw new PublicationNotFoundError();
	const version = readSafeInteger(row.version);
	const document = parseJsonb(row.document);
	const validation = validateProject(document, { scene: REGISTRY_SCENE_OPTIONS });
	if (!validation.success || validation.project.id === undefined) {
		throw new Error('Stored release failed validation');
	}
	const manifest = readManifest(row.manifest);
	return {
		name: validation.project.name,
		version,
		revision: readSafeInteger(row.revision),
		document: validation.project,
		assets: manifest.assets.map((asset) => ({
			assetId: asset.assetId,
			mime: asset.mime,
			byteSize: asset.byteSize
		}))
	};
}

export type PublicReleaseAsset = {
	entry: PinnedReleaseAsset;
	revision: number;
};

/**
 * Anonymous version-qualified asset pin. Any released version of an active
 * publication serves, so an already-open visitor finishes its release after
 * an update. Unpublish disables every version.
 */
export async function readPublicReleaseAsset(
	db: Pick<DatabasePool, 'query'>,
	publicId: string,
	version: number,
	assetId: string
): Promise<PublicReleaseAsset> {
	const rows = await queryRows<{ manifest: unknown; revision: unknown }>(
		db,
		`SELECT r.manifest, p.revision
FROM publications p
JOIN releases r
	ON r.project_id = p.project_id AND r.version = $2
WHERE p.public_id = $1::uuid AND p.active_version IS NOT NULL`,
		[publicId, version]
	);
	const row = rows[0];
	if (!row) throw new PublicationNotFoundError();
	const manifest = readManifest(row.manifest);
	const entry = manifest.assets.find((asset) => asset.assetId === assetId);
	if (!entry) throw new PublicationNotFoundError();
	return { entry, revision: readSafeInteger(row.revision) };
}

type PreparedRelease = {
	manifest: ReleaseManifest;
	currentVersion: number;
};

async function prepareRelease(
	pool: DatabasePool,
	ownerId: string,
	projectId: string,
	version: number,
	objectStore: ObjectStore | undefined
): Promise<PreparedRelease> {
	const owned = await queryRows<{ latestVersion: unknown }>(
		pool,
		`SELECT latest_version AS "latestVersion"
FROM projects
WHERE id = $1 AND owner_id = $2`,
		[projectId, ownerId]
	);
	if (!owned[0]) throw new ProjectNotFoundError();
	const currentVersion = readSafeInteger(owned[0].latestVersion);

	const versions = await queryRows<VersionRow>(
		pool,
		`SELECT version, document FROM project_versions WHERE project_id = $1 AND version = $2`,
		[projectId, version]
	);
	if (!versions[0]) {
		throw new PublicationValidationError(`Unknown saved version ${version}`);
	}
	const validation = validateProject(parseJsonb(versions[0].document), { scene: REGISTRY_SCENE_OPTIONS });
	if (!validation.success) {
		throw new PublicationValidationError(
			validation.issues[0] ? `${validation.issues[0].path}: ${validation.issues[0].message}` : 'Invalid project document'
		);
	}
	const compiled = compileWallFirstLayoutGeometry(validation.project.layout);
	if (hasBlockingLayoutIssues(compiled.issues)) {
		throw new PublicationValidationError(compiled.issues[0]?.message ?? 'Layout geometry is invalid');
	}

	const assetIds = collectReleaseAssetIds(validation.project);
	const pins: PinnedReleaseAsset[] = [];
	for (const assetId of assetIds) {
		pins.push(await readReadyAssetPin(pool, ownerId, projectId, assetId));
	}

	const existing = await queryRows<ReleaseRow>(
		pool,
		`SELECT manifest FROM releases WHERE project_id = $1 AND version = $2`,
		[projectId, version]
	);
	if (existing[0]) {
		// Reuse the already validated immutable release instead of rehashing.
		return { manifest: readManifest(existing[0].manifest), currentVersion };
	}

	if (!objectStore && pins.length > 0) throw new Error('Object storage is unavailable');
	for (const pin of pins) {
		await verifyReleaseObject(objectStore!, pin);
	}
	return { manifest: { version: 1, assets: pins }, currentVersion };
}

async function readReadyAssetPin(
	db: Pick<DatabasePool, 'query'>,
	ownerId: string,
	projectId: string,
	assetId: string
): Promise<PinnedReleaseAsset> {
	const rows = await queryRows<StoredAsset>(
		db,
		`SELECT a.id, a.project_id AS "projectId", a.name, a.kind,
	a.storage_kind AS "storageKind", a.source_kind AS "sourceKind",
	a.source_ref AS "sourceRef", a.mime, a.byte_size AS "byteSize",
	a.sha256, a.object_key AS "objectKey",
	a.import_state AS "importState",
	a.created_at AS "createdAt", a.updated_at AS "updatedAt"
FROM assets a
JOIN projects p ON p.id = a.project_id
WHERE a.id = $1::uuid AND a.project_id = $2 AND p.owner_id = $3`,
		[assetId, projectId, ownerId]
	);
	const asset = rows[0];
	if (
		!asset ||
		asset.importState !== 'ready' ||
		asset.storageKind !== 'r2' ||
		typeof asset.objectKey !== 'string' ||
		typeof asset.mime !== 'string' ||
		typeof asset.sha256 !== 'string'
	) {
		throw new PublicationValidationError(`Texture is not a ready project asset: ${assetId}`);
	}
	const byteSize = readRowByteSize(asset.byteSize, assetId);
	return {
		assetId,
		objectKey: asset.objectKey,
		sha256: asset.sha256,
		mime: asset.mime,
		byteSize
	};
}

/**
 * Bounded R2 verification for a newly prepared release: availability, byte
 * size and SHA-256 over the stream. A missing object or mismatch leaves the
 * prior release active (the caller throws before any state switch).
 */
async function verifyReleaseObject(store: ObjectStore, pin: PinnedReleaseAsset): Promise<void> {
	let stored: { body: Readable; contentLength: number } | null;
	try {
		stored = await store.get(pin.objectKey);
	} catch {
		throw new Error('Object storage is unavailable');
	}
	if (!stored) {
		throw new PublicationValidationError(`Release asset bytes are missing: ${pin.assetId}`);
	}
	if (stored.contentLength !== pin.byteSize) {
		throw new PublicationValidationError(`Release asset size mismatch: ${pin.assetId}`);
	}
	const hash = createHash('sha256');
	let seen = 0;
	try {
		for await (const value of stored.body) {
			const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array);
			seen += chunk.length;
			if (seen > MAX_ASSET_BYTES) {
				throw new PublicationValidationError(`Release asset exceeds byte limit: ${pin.assetId}`);
			}
			hash.update(chunk as unknown as Uint8Array<ArrayBuffer>);
		}
	} catch (error) {
		if (error instanceof PublicationValidationError) throw error;
		throw new Error('Object storage is unavailable');
	}
	if (seen !== pin.byteSize || `sha256-${hash.digest('hex')}` !== pin.sha256) {
		throw new PublicationValidationError(`Release asset hash mismatch: ${pin.assetId}`);
	}
}

async function recheckPinnedAssets(db: DatabaseClient, projectId: string, manifest: ReleaseManifest): Promise<boolean> {
	for (const pin of manifest.assets) {
		const rows = await queryRows<StoredAsset>(
			db,
			`SELECT a.id, a.project_id AS "projectId", a.name, a.kind,
	a.storage_kind AS "storageKind", a.source_kind AS "sourceKind",
	a.source_ref AS "sourceRef", a.mime, a.byte_size AS "byteSize",
	a.sha256, a.object_key AS "objectKey",
	a.import_state AS "importState",
	a.created_at AS "createdAt", a.updated_at AS "updatedAt"
FROM assets a
WHERE a.id = $1::uuid AND a.project_id = $2`,
			[pin.assetId, projectId]
		);
		const asset = rows[0];
		if (
			!asset ||
			asset.importState !== 'ready' ||
			asset.objectKey !== pin.objectKey ||
			asset.mime !== pin.mime ||
			asset.sha256 !== pin.sha256
		) {
			return false;
		}
		let byteSize: number;
		try {
			byteSize = readRowByteSize(asset.byteSize, pin.assetId);
		} catch {
			return false;
		}
		if (byteSize !== pin.byteSize) return false;
	}
	return true;
}

function readRowByteSize(value: unknown, assetId: string): number {
	// node-pg returns bigint columns as strings; accept either form.
	const result = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	if (!Number.isSafeInteger(result) || result < 1 || result > MAX_ASSET_BYTES) {
		throw new PublicationValidationError(`Texture is not a ready project asset: ${assetId}`);
	}
	return result;
}

/**
 * Exhaustive delivery reference set from the saved document plus
 * catalogue-implied texture dependencies. Every texture source must be a
 * same-release P20 asset or an allowlisted shipped-static resource; nothing
 * is pruned.
 */
function collectReleaseAssetIds(project: ProjectDocument): string[] {
	const scene = project.scene as {
		textures?: Array<{ id?: unknown; name?: unknown; uri?: unknown }>;
		materials?: Array<{ id?: unknown; baseMaterialId?: unknown; baseTextureId?: unknown }>;
		entities?: Array<{ kind?: unknown; assetId?: unknown; materialInstanceId?: unknown; materialId?: unknown }>;
	};
	const ids: string[] = [];
	const seen = new Set<string>();
	const textureById = new Map<string, string>();
	for (const texture of scene.textures ?? []) {
		if (typeof texture.id !== 'string' || typeof texture.uri !== 'string') continue;
		textureById.set(texture.id, texture.uri);
		const match = PROJECT_ASSET_PATTERN.exec(texture.uri);
		if (match && !seen.has(match[1]!)) {
			seen.add(match[1]!);
			ids.push(match[1]!);
		}
	}
	const checkUri = (uri: string, what: string) => {
		if (PROJECT_ASSET_PATTERN.test(uri)) return;
		if (
			LOCAL_BINARY_PATTERN.test(uri) ||
			PACKAGE_REWRITE_PATTERN.test(uri) ||
			uri.startsWith('/local/') ||
			uri.startsWith('blob:') ||
			uri.startsWith('data:')
		) {
			throw new PublicationValidationError(`${what} uses an unsupported source`);
		}
		if (!isAllowedShippedTextureUri(uri) || !isRootRelativeSafe(uri)) {
			throw new PublicationValidationError(`${what} is not a release asset or shipped resource`);
		}
	};
	for (const texture of scene.textures ?? []) {
		if (typeof texture.uri !== 'string') continue;
		checkUri(texture.uri, `Texture "${typeof texture.name === 'string' ? texture.name : texture.id}"`);
	}
	const materialById = new Map<string, { baseMaterialId?: unknown; baseTextureId?: unknown }>();
	for (const material of scene.materials ?? []) {
		if (typeof material.id !== 'string') continue;
		materialById.set(material.id, material);
		if (typeof material.baseTextureId === 'string' && !textureById.has(material.baseTextureId)) {
			throw new PublicationValidationError(`Unknown base texture "${material.baseTextureId}"`);
		}
	}
	for (const entity of scene.entities ?? []) {
		if (entity.kind === 'model' && typeof entity.assetId === 'string') {
			if (!getShippedModelByAssetId(entity.assetId)) {
				throw new PublicationValidationError(`Unknown model asset "${entity.assetId}"`);
			}
		}
		const materialIds = new Set<string>();
		if (typeof entity.materialInstanceId === 'string') {
			const instance = materialById.get(entity.materialInstanceId);
			if (!instance) throw new PublicationValidationError(`Unknown material instance "${entity.materialInstanceId}"`);
			if (typeof instance.baseMaterialId === 'string') materialIds.add(instance.baseMaterialId);
		}
		if (entity.kind === 'primitive' && typeof entity.materialId === 'string') {
			materialIds.add(entity.materialId);
		}
		if (entity.kind === 'model' && materialIds.size === 0) materialIds.add('paper-aged');
		for (const materialId of materialIds) {
			const shipped = getShippedMaterialById(materialId);
			if (!shipped) throw new PublicationValidationError(`Unknown catalogue material "${materialId}"`);
			for (const textureUri of shipped.textureUris) {
				if (!isAllowedShippedTextureUri(textureUri)) {
					throw new PublicationValidationError(`Catalogue material "${materialId}" needs retained bytes`);
				}
			}
		}
	}
	return ids;
}

async function withPublicationTransaction<T>(
	pool: DatabasePool,
	work: (db: DatabaseClient) => Promise<T>
): Promise<T> {
	if (!pool.connect) throw new Error('Database transactions are unavailable');
	const db = await pool.connect();
	try {
		await db.query('BEGIN');
		const result = await work(db);
		await db.query('COMMIT');
		return result;
	} catch (error) {
		try {
			await db.query('ROLLBACK');
		} catch {
			// Preserve the original failure; the route returns one bounded error.
		}
		throw error;
	} finally {
		db.release();
	}
}

function toStatus(row: PublicationRow | null, currentVersion: number): PublicationStatus {
	if (!row) {
		return {
			publicationId: null,
			activeVersion: null,
			revision: 0,
			currentVersion,
			createdAt: null,
			updatedAt: null
		};
	}
	return {
		publicationId: readString(row.publicId),
		activeVersion: readNullableVersion(row.activeVersion),
		revision: readSafeInteger(row.revision),
		currentVersion,
		createdAt: readTimestamp(row.createdAt),
		updatedAt: readTimestamp(row.updatedAt)
	};
}

function readManifest(value: unknown): ReleaseManifest {
	const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new Error('Release row contained an invalid manifest');
	}
	const record = parsed as Record<string, unknown>;
	if (record.version !== 1 || !Array.isArray(record.assets)) {
		throw new Error('Release row contained an invalid manifest');
	}
	const assets = (record.assets as unknown[]).map((entry) => {
		if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
			throw new Error('Release row contained an invalid manifest');
		}
		const asset = entry as Record<string, unknown>;
		if (
			typeof asset.assetId !== 'string' ||
			typeof asset.objectKey !== 'string' ||
			typeof asset.sha256 !== 'string' ||
			typeof asset.mime !== 'string' ||
			typeof asset.byteSize !== 'number'
		) {
			throw new Error('Release row contained an invalid manifest');
		}
		return {
			assetId: asset.assetId,
			objectKey: asset.objectKey,
			sha256: asset.sha256,
			mime: asset.mime,
			byteSize: asset.byteSize
		};
	});
	return { version: 1, assets };
}

function readString(value: unknown): string {
	if (typeof value !== 'string' || value.length === 0) throw new Error('Database row contained an invalid string');
	return value;
}

function readSafeInteger(value: unknown): number {
	const result = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	if (!Number.isSafeInteger(result) || result < 0) throw new Error('Database row contained an invalid version');
	return result;
}

function readNullableVersion(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	const result = readSafeInteger(value);
	if (result < 1) throw new Error('Database row contained an invalid version');
	return result;
}

function readTimestamp(value: unknown): string {
	const date = value instanceof Date ? value : new Date(String(value));
	if (Number.isNaN(date.getTime())) throw new Error('Database row contained an invalid timestamp');
	return date.toISOString();
}

function parseJsonb(value: unknown): unknown {
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value) as unknown;
	} catch {
		throw new Error('Database row contained invalid JSON');
	}
}
