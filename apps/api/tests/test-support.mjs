/**
 * Shared API test support (WP3T).
 *
 * The `api.test.mjs` bundle was split by responsibility into five contract
 * files; this module holds only the transparent, explicit factories and
 * constants they share. Nothing here holds mutable state across files: every
 * test builds its own pool/store and gets fresh data.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

import { canonicalSourceJson, sourceContentIdForCanonicalJson } from '@portfolio/project-model';
import { SAVE_CONTENT_IDENTITY_SCHEME } from '@portfolio/project-model/save';

export const SESSION_KEY = Buffer.alloc(32, 7);
export const SESSION_COOKIE = 'museum-editor-session';
export const R2_ENV = {
	R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
	R2_BUCKET: 'museum-assets',
	R2_ACCESS_KEY_ID: 'access-key',
	R2_SECRET_ACCESS_KEY: 'secret-key'
};

export function stubPool({ query = async () => undefined, end = async () => undefined } = {}) {
	return { query, end };
}

/**
 * PR #115 (WP3): the API accepts the current document format only — a
 * wall-first Layout (`formatVersion: 5`, carrying its `identity` record) plus a
 * world-local Scene (`formatVersion: 1`). This is the canonical empty project,
 * so a saved-then-loaded document deep-equals the fixture it was built from.
 *
 * Every API contract file that constructs a project document builds it here, so
 * there is exactly one place that pins the current format. The common case is a
 * stable id (`project:test`) and no textures; a contract that needs its own id
 * or staged textures passes them in the second argument, so the scenario input
 * stays visible at the call site rather than implied by a second builder.
 */
export function projectDocument(name = 'Cloud project', { id = 'project:test', textures = [] } = {}) {
	return {
		id,
		name,
		layout: {
			units: 'meters',
			formatVersion: 5,
			floor: { id: 'floor', name: 'Floor', elevation: 0 },
			junctions: [],
			walls: [],
			rooms: [],
			openings: [],
			objects: [],
			identity: { cursor: 0, rooms: {}, junctions: {}, walls: {}, openings: {} }
		},
		scene: {
			formatVersion: 1,
			textures,
			materials: [],
			entities: [],
			navigationNodes: [],
			connections: []
		}
	};
}

/**
 * Build one `SaveAcceptedSource@1` wire request from a current-format document.
 * The capture carries the canonical bytes and their digest, exactly as the
 * editor client does; the server recomputes both and refuses a mismatch.
 */
export async function saveRequestBody(
	document,
	{ precondition = { kind: 'create-only' }, revisionId = `revision-${randomUUID()}`, operationId = randomUUID() } = {}
) {
	const canonical = canonicalSourceJson(document);
	if (canonical.kind === 'rejected') throw new Error(`fixture was not canonical: ${canonical.issues[0]?.message}`);
	const sourceContentId = await sourceContentIdForCanonicalJson(canonical.canonicalJson);
	return {
		contentIdentityScheme: SAVE_CONTENT_IDENTITY_SCHEME,
		capture: {
			protocol: 'SaveAcceptedSource@1',
			projectId: canonical.project.id,
			operationId,
			precondition,
			sourceKind: 'current-source',
			sourceVersion: 5,
			acceptedRevision: { projectId: canonical.project.id, revisionId },
			sourceContentId,
			canonicalJson: canonical.canonicalJson
		}
	};
}

export function memoryPool() {
	const projects = new Map();
	const versions = new Map();
	const calls = [];
	const pool = {
		calls,
		versions,
		async query(text, values = []) {
			calls.push({ text, values });
			if (text.includes('FROM projects\nWHERE owner_id')) {
				return {
					rows: [...projects.values()]
						.filter((project) => project.ownerId === values[0])
						.map((project) => ({
							id: project.id,
							name: project.name,
							version: project.version,
							updatedAt: project.updatedAt
						}))
				};
			}
			if (text.includes('FROM projects p')) {
				const project = projects.get(values[0]);
				if (!project || project.ownerId !== values[1]) return { rows: [] };
				return {
					rows: [{
						projectId: project.id,
						name: project.name,
						version: project.version,
						updatedAt: project.updatedAt,
						document: versions.get(project.id).get(project.version)
					}]
				};
			}
			throw new Error(`Unexpected pool query: ${text}`);
		},
		async connect() {
			return {
				async query(text, values = []) {
					calls.push({ text, values });
					if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
					if (text.includes('INSERT INTO users')) return { rows: [] };
					if (text.includes('INSERT INTO projects')) {
						const [id, ownerId, name] = values;
						if (!projects.has(id)) projects.set(id, { id, ownerId, name, version: 0, updatedAt: '2026-08-31T00:00:00.000Z' });
						return { rows: [] };
					}
					if (text.includes('owner_id AS "ownerId"')) {
						const project = projects.get(values[0]);
						return {
							rows: project ? [{ ...project, ownerId: project.ownerId }] : []
						};
					}
					if (text.includes('INSERT INTO project_versions')) {
						const [id, version, document] = values;
						if (!versions.has(id)) versions.set(id, new Map());
						versions.get(id).set(version, document);
						return { rows: [] };
					}
					if (text.includes('RETURNING id, name')) {
						const [id, version, name] = values;
						const project = projects.get(id);
						project.name = name;
						project.version = version;
						return { rows: [{ id, name, version, updatedAt: project.updatedAt }] };
					}
					throw new Error(`Unexpected client query: ${text}`);
				},
				release() {}
			};
		},
		async end() {}
	};
	return pool;
}

export function assetMemoryPool(options = {}) {
	const projects = new Map([
		['project:test', { id: 'project:test', ownerId: 'google:user-1', name: 'Cloud project' }]
	]);
	const assets = new Map();
	const calls = [];
	const now = '2026-09-03T00:00:00.000Z';

	function assetRow(asset) {
		return {
			id: asset.id,
			projectId: asset.projectId,
			name: asset.name,
			kind: asset.kind,
			storageKind: asset.storageKind,
			sourceKind: asset.sourceKind,
			sourceRef: asset.sourceRef,
			mime: asset.mime,
			byteSize: asset.byteSize,
			sha256: asset.sha256,
			objectKey: asset.objectKey,
			importState: asset.importState,
			createdAt: asset.createdAt,
			updatedAt: asset.updatedAt
		};
	}

	function projectFor(projectId, ownerId) {
		const project = projects.get(projectId);
		return project?.ownerId === ownerId ? project : null;
	}

	function selectAsset(values) {
		const [assetId, projectId, ownerId] = values;
		const asset = assets.get(assetId);
		return asset && asset.projectId === projectId && projectFor(projectId, ownerId)
			? [assetRow(asset)]
			: [];
	}

	function query(text, values = []) {
		calls.push({ text, values });
		if (text.includes('INSERT INTO assets')) {
			const [id, projectId, name, ownerId, objectKey] = values;
			if (!projectFor(projectId, ownerId)) return Promise.resolve({ rows: [] });
			const asset = {
				id,
				projectId,
				name,
				kind: 'texture',
				storageKind: 'r2',
				sourceKind: 'upload',
				sourceRef: null,
				mime: null,
				byteSize: null,
				sha256: null,
				objectKey,
				importState: 'pending',
				createdAt: now,
				updatedAt: now
			};
			assets.set(id, asset);
			return Promise.resolve({ rows: [assetRow(asset)] });
		}
		if (text.includes('LEFT JOIN assets')) {
			const [projectId, ownerId] = values;
			if (!projectFor(projectId, ownerId)) return Promise.resolve({ rows: [] });
			const rows = [...assets.values()]
				.filter((asset) => asset.projectId === projectId)
				.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
				.map(assetRow);
			return Promise.resolve({ rows: rows.length > 0 ? rows : [{ id: null }] });
		}
		if (text.includes('SET object_key =')) {
			const [id, projectId, ownerId, objectKey] = values;
			const asset = assets.get(id);
			if (!asset || asset.projectId !== projectId || !projectFor(projectId, ownerId) || asset.importState === 'ready') {
				return Promise.resolve({ rows: [] });
			}
			Object.assign(asset, { objectKey, importState: 'pending', updatedAt: now });
			return Promise.resolve({ rows: [assetRow(asset)] });
		}
		if (text.includes("SET import_state = 'failed'")) {
			const [id, projectId, ownerId, objectKey] = values;
			const asset = assets.get(id);
			if (
				!asset ||
				asset.projectId !== projectId ||
				!projectFor(projectId, ownerId) ||
				asset.objectKey !== objectKey ||
				asset.importState === 'ready'
			) {
				return Promise.resolve({ rows: [] });
			}
			asset.importState = 'failed';
			return Promise.resolve({ rows: [] });
		}
		if (text.includes('SET mime =')) {
			if (options.failFinalize) return Promise.reject(new Error('injected finalize failure'));
			const [id, projectId, ownerId, mime, byteSize, sha256, objectKey] = values;
			const asset = assets.get(id);
			if (
				!asset ||
				asset.projectId !== projectId ||
				!projectFor(projectId, ownerId) ||
				asset.objectKey !== objectKey ||
				asset.importState !== 'pending'
			) {
				return Promise.resolve({ rows: [] });
			}
			Object.assign(asset, { mime, byteSize, sha256, importState: 'ready', updatedAt: now });
			return Promise.resolve({ rows: [assetRow(asset)] });
		}
		if (text.includes('FROM assets a')) return Promise.resolve({ rows: selectAsset(values) });
		return Promise.reject(new Error(`Unexpected asset pool query: ${text}`));
	}

	return {
		assets,
		calls,
		query,
		async end() {}
	};
}

export function memoryObjectStore(options = {}) {
	const objects = new Map();
	const puts = [];
	const gets = [];
	let closes = 0;
	return {
		objects,
		puts,
		gets,
		get closes() {
			return closes;
		},
		async put(key, body, metadata) {
			const chunks = [];
			for await (const chunk of body) chunks.push(Buffer.from(chunk));
			puts.push({ key, options: metadata, bytes: Buffer.concat(chunks) });
			if (options.failPut) throw new Error('injected R2 failure');
			objects.set(key, { bytes: Buffer.concat(chunks), options: metadata });
		},
		async get(key) {
			gets.push(key);
			const object = objects.get(key);
			return object ? { body: Readable.from([object.bytes]), contentLength: object.bytes.length } : null;
		},
		close() {
			closes += 1;
		}
	};
}

export function cookieFrom(response) {
	const header = response.headers['set-cookie'];
	const value = Array.isArray(header) ? header[0] : header;
	assert.ok(value, 'response should set a session cookie');
	return value.split(';', 1)[0];
}

export async function sessionCookie(app, userId) {
	await app.ready();
	const value = app.encodeSecureSession(app.createSecureSession({ userId }));
	return `${SESSION_COOKIE}=${encodeURIComponent(value)}`;
}
