import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { Readable } from 'node:stream';
import test, { after, before } from 'node:test';

import { createApp } from '../dist/app.js';
import { runMigrations } from '../dist/migrate.js';

const SESSION_KEY = Buffer.alloc(32, 11);
const SESSION_COOKIE = 'museum-editor-session';
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/biskiq';

const PNG_BYTES = Buffer.concat([
	Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
	Buffer.alloc(120, 3)
]);

function memoryObjectStore() {
	const objects = new Map();
	return {
		objects,
		async put(key, body) {
			const chunks = [];
			for await (const chunk of body) chunks.push(Buffer.from(chunk));
			objects.set(key, Buffer.concat(chunks));
		},
		async get(key) {
			const bytes = objects.get(key);
			return bytes ? { body: Readable.from([bytes]), contentLength: bytes.length } : null;
		}
	};
}

async function sessionCookie(app, userId) {
	await app.ready();
	const value = app.encodeSecureSession(app.createSecureSession({ userId }));
	return `${SESSION_COOKIE}=${encodeURIComponent(value)}`;
}

/**
 * PR #115 (WP3): publication accepts the current document format only — a
 * wall-first Layout (`formatVersion: 5`, carrying its `identity` record) plus a
 * world-local Scene (`formatVersion: 1`). The canonical empty project, with the
 * caller's textures staged in the Scene.
 */
function projectDocument(id, name, textures = []) {
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

let pool;
let app;
let store;
let HAS_DB = false;
const createdProjects = [];
let projectCounter = 0;

function nextProjectId() {
	projectCounter += 1;
	return `p22t${Date.now().toString(36)}${projectCounter}`;
}

async function saveDoc(projectId, cookie, document) {
	const response = await app.inject({
		method: 'PUT',
		url: `/projects/${projectId}`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: { document }
	});
	assert.equal(response.statusCode, 200);
	return response.json();
}

async function uploadTexture(projectId, cookie, name = 'pinned.png') {
	const registered = await app.inject({
		method: 'POST',
		url: `/projects/${projectId}/assets`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: { name }
	});
	assert.equal(registered.statusCode, 201);
	const assetId = registered.json().id;
	const uploaded = await app.inject({
		method: 'PUT',
		url: `/projects/${projectId}/assets/${assetId}/content`,
		headers: { cookie, 'content-type': 'application/octet-stream', 'content-length': String(PNG_BYTES.length) },
		payload: PNG_BYTES
	});
	assert.equal(uploaded.statusCode, 200);
	return assetId;
}

function track(projectId) {
	createdProjects.push(projectId);
	return projectId;
}

before(async () => {
	try {
		pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 3000 });
		await pool.query('SELECT 1');
		HAS_DB = true;
	} catch {
		HAS_DB = false;
		return;
	}
	await runMigrations(pool);
	await runMigrations(pool);
	store = memoryObjectStore();
	app = createApp({ pool, objectStore: store, sessionKey: SESSION_KEY, logger: false });
	await app.ready();
});

after(async () => {
	if (app) await app.close();
	else if (pool) await pool.end();
});

async function cleanupProject(projectId) {
	if (!HAS_DB) return;
	await pool.query('DELETE FROM releases WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM publications WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM assets WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM project_versions WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
}

test('migrations apply twice on real Postgres', async (t) => {
	if (!HAS_DB) return t.skip('Postgres unreachable');
	const check = await pool.query(
		`SELECT to_regclass('publications') AS publications, to_regclass('releases') AS releases`
	);
	assert.equal(check.rows[0].publications, 'publications');
	assert.equal(check.rows[0].releases, 'releases');
});

test('never-published status is normal and allocates nothing', async (t) => {
	if (!HAS_DB) return t.skip('Postgres unreachable');
	const owner = await sessionCookie(app, 'google:p22-owner-1');
	const projectId = track(nextProjectId());
	await saveDoc(projectId, owner, projectDocument(projectId, 'Never published'));
	try {
		const first = await app.inject({ method: 'GET', url: `/projects/${projectId}/publication`, headers: { cookie: owner } });
		assert.equal(first.statusCode, 200);
		assert.deepEqual(first.json(), {
			publicationId: null,
			activeVersion: null,
			revision: 0,
			currentVersion: 1,
			createdAt: null,
			updatedAt: null
		});
		const second = await app.inject({ method: 'GET', url: `/projects/${projectId}/publication`, headers: { cookie: owner } });
		assert.deepEqual(second.json(), first.json());
	} finally {
		await cleanupProject(projectId);
	}
});

test('full loop: publish, snapshot freeze, update, unpublish, republish', async (t) => {
	if (!HAS_DB) return t.skip('Postgres unreachable');
	const owner = await sessionCookie(app, 'google:p22-owner-1');
	const projectId = track(nextProjectId());
	try {
		await saveDoc(projectId, owner, projectDocument(projectId, 'Loop draft'));
		const tex = await uploadTexture(projectId, owner);
		await saveDoc(projectId, owner, projectDocument(projectId, 'Loop v1', [{ id: 'tex-1', name: 'Pinned', uri: `/project-assets/${tex}` }]));

		const published = await app.inject({
			method: 'PUT',
			url: `/projects/${projectId}/publication`,
			headers: { cookie: owner, 'content-type': 'application/json' },
			payload: { version: 2, expectedPublicationRevision: 0 }
		});
		assert.equal(published.statusCode, 200);
		const status = published.json();
		assert.match(status.publicationId, /^[0-9a-f-]{36}$/i);
		assert.equal(status.activeVersion, 2);
		assert.equal(status.revision, 1);
		const publicId = status.publicationId;

		const anonymous = await app.inject({ method: 'GET', url: `/publications/${publicId}` });
		assert.equal(anonymous.statusCode, 200);
		assert.equal(anonymous.headers['cache-control'], 'no-store');
		const release = anonymous.json();
		assert.equal(release.name, 'Loop v1');
		assert.equal(release.version, 2);
		assert.deepEqual(release.assets, [{ assetId: tex, mime: 'image/png', byteSize: PNG_BYTES.length }]);
		assert.ok(!JSON.stringify(release).includes('projects/'), 'public manifest leaks no storage keys');
		assert.deepEqual(release.document.scene.textures, [{ id: 'tex-1', name: 'Pinned', uri: `/project-assets/${tex}` }]);

		const bytes = await app.inject({ method: 'GET', url: `/publications/${publicId}/versions/2/assets/${tex}/content` });
		assert.equal(bytes.statusCode, 200);
		assert.equal(bytes.headers['content-type'], 'image/png');
		assert.equal(bytes.headers['content-length'], String(PNG_BYTES.length));
		assert.equal(bytes.headers['cache-control'], 'no-store');
		assert.equal(bytes.headers['x-content-type-options'], 'nosniff');
		assert.deepEqual(bytes.rawPayload, PNG_BYTES);

		await saveDoc(projectId, owner, projectDocument(projectId, 'Loop v2', [{ id: 'tex-1', name: 'Pinned', uri: `/project-assets/${tex}` }]));
		const frozen = await app.inject({ method: 'GET', url: `/publications/${publicId}` });
		assert.equal(frozen.json().name, 'Loop v1');
		const stale = await app.inject({ method: 'GET', url: `/projects/${projectId}/publication`, headers: { cookie: owner } });
		assert.equal(stale.json().currentVersion, 3);
		assert.equal(stale.json().activeVersion, 2);

		const updated = await app.inject({
			method: 'PUT',
			url: `/projects/${projectId}/publication`,
			headers: { cookie: owner, 'content-type': 'application/json' },
			payload: { version: 3, expectedPublicationRevision: 1 }
		});
		assert.equal(updated.statusCode, 200);
		assert.equal(updated.json().activeVersion, 3);
		assert.equal(updated.json().revision, 2);
		assert.equal((await app.inject({ method: 'GET', url: `/publications/${publicId}` })).json().name, 'Loop v2');
		// Old release stays readable through its version-qualified path.
		const oldBytes = await app.inject({ method: 'GET', url: `/publications/${publicId}/versions/2/assets/${tex}/content` });
		assert.equal(oldBytes.statusCode, 200);

		const unpublished = await app.inject({
			method: 'DELETE',
			url: `/projects/${projectId}/publication`,
			headers: { cookie: owner, 'content-type': 'application/json' },
			payload: { expectedPublicationRevision: 2 }
		});
		assert.equal(unpublished.statusCode, 200);
		assert.equal(unpublished.json().activeVersion, null);
		assert.equal(unpublished.json().revision, 3);
		assert.equal((await app.inject({ method: 'GET', url: `/publications/${publicId}` })).statusCode, 404);
		assert.equal((await app.inject({ method: 'GET', url: `/publications/${publicId}/versions/2/assets/${tex}/content` })).statusCode, 404);

		const republished = await app.inject({
			method: 'PUT',
			url: `/projects/${projectId}/publication`,
			headers: { cookie: owner, 'content-type': 'application/json' },
			payload: { version: 3, expectedPublicationRevision: 3 }
		});
		assert.equal(republished.statusCode, 200);
		assert.equal(republished.json().publicationId, publicId);
		assert.equal(republished.json().revision, 4);
		assert.equal((await app.inject({ method: 'GET', url: `/publications/${publicId}` })).json().name, 'Loop v2');
	} finally {
		await cleanupProject(projectId);
	}
});

test('ABA rejects stale writers; refetch-then-retry succeeds', async (t) => {
	if (!HAS_DB) return t.skip('Postgres unreachable');
	const owner = await sessionCookie(app, 'google:p22-owner-1');
	const projectId = track(nextProjectId());
	try {
		await saveDoc(projectId, owner, projectDocument(projectId, 'ABA'));
		const first = await app.inject({
			method: 'PUT',
			url: `/projects/${projectId}/publication`,
			headers: { cookie: owner, 'content-type': 'application/json' },
			payload: { version: 1, expectedPublicationRevision: 0 }
		});
		assert.equal(first.json().revision, 1);
		const unpub = await app.inject({
			method: 'DELETE',
			url: `/projects/${projectId}/publication`,
			headers: { cookie: owner, 'content-type': 'application/json' },
			payload: { expectedPublicationRevision: 1 }
		});
		assert.equal(unpub.json().revision, 2);

		const stale = await app.inject({
			method: 'PUT',
			url: `/projects/${projectId}/publication`,
			headers: { cookie: owner, 'content-type': 'application/json' },
			payload: { version: 1, expectedPublicationRevision: 1 }
		});
		assert.equal(stale.statusCode, 409);
		assert.equal(stale.json().error.code, 'revision_conflict');
		assert.equal(stale.json().revision, 2);

		const retry = await app.inject({
			method: 'PUT',
			url: `/projects/${projectId}/publication`,
			headers: { cookie: owner, 'content-type': 'application/json' },
			payload: { version: 1, expectedPublicationRevision: 2 }
		});
		assert.equal(retry.statusCode, 200);
		assert.equal(retry.json().publicationId, first.json().publicationId);
		assert.equal(retry.json().revision, 3);
	} finally {
		await cleanupProject(projectId);
	}
});

test('idempotent no-ops never bump the revision', async (t) => {
	if (!HAS_DB) return t.skip('Postgres unreachable');
	const owner = await sessionCookie(app, 'google:p22-owner-1');
	const projectId = track(nextProjectId());
	try {
		await saveDoc(projectId, owner, projectDocument(projectId, 'Noop'));
		const put = (body) =>
			app.inject({
				method: 'PUT',
				url: `/projects/${projectId}/publication`,
				headers: { cookie: owner, 'content-type': 'application/json' },
				payload: body
			});
		const first = await put({ version: 1, expectedPublicationRevision: 0 });
		assert.equal(first.json().revision, 1);
		const repeat = await put({ version: 1, expectedPublicationRevision: 1 });
		assert.equal(repeat.statusCode, 200);
		assert.equal(repeat.json().revision, 1);

		const del = (body) =>
			app.inject({
				method: 'DELETE',
				url: `/projects/${projectId}/publication`,
				headers: { cookie: owner, 'content-type': 'application/json' },
				payload: body
			});
		const unpub = await del({ expectedPublicationRevision: 1 });
		assert.equal(unpub.json().revision, 2);
		const repeatDel = await del({ expectedPublicationRevision: 2 });
		assert.equal(repeatDel.statusCode, 200);
		assert.equal(repeatDel.json().revision, 2);

		const neverDel = await app.inject({
			method: 'DELETE',
			url: `/projects/${nextProjectId()}/publication`,
			headers: { cookie: owner, 'content-type': 'application/json' },
			payload: { expectedPublicationRevision: 0 }
		});
		assert.equal(neverDel.statusCode, 404);
	} finally {
		await cleanupProject(projectId);
	}
});

test('request shape and version validation is bounded', async (t) => {
	if (!HAS_DB) return t.skip('Postgres unreachable');
	const owner = await sessionCookie(app, 'google:p22-owner-1');
	const projectId = track(nextProjectId());
	try {
		await saveDoc(projectId, owner, projectDocument(projectId, 'Shapes'));
		const put = (payload) =>
			app.inject({
				method: 'PUT',
				url: `/projects/${projectId}/publication`,
				headers: { cookie: owner, 'content-type': 'application/json' },
				payload
			});
		assert.equal((await put({ version: 99, expectedPublicationRevision: 0 })).statusCode, 400);
		assert.equal((await put({ version: 0, expectedPublicationRevision: 0 })).statusCode, 400);
		assert.equal((await put({ version: 1 })).statusCode, 400);
		assert.equal((await put({ version: 1, expectedPublicationRevision: -1 })).statusCode, 400);
		assert.equal((await put({ version: '1', expectedPublicationRevision: 0 })).statusCode, 400);
		assert.equal(
			(
				await app.inject({
					method: 'DELETE',
					url: `/projects/${projectId}/publication`,
					headers: { cookie: owner, 'content-type': 'application/json' },
					payload: {}
				})
			).statusCode,
			400
		);
	} finally {
		await cleanupProject(projectId);
	}
});

test('failed update leaves the old release active', async (t) => {
	if (!HAS_DB) return t.skip('Postgres unreachable');
	const owner = await sessionCookie(app, 'google:p22-owner-1');
	const projectId = track(nextProjectId());
	try {
		await saveDoc(projectId, owner, projectDocument(projectId, 'Good draft'));
		const tex = await uploadTexture(projectId, owner);
		await saveDoc(projectId, owner, projectDocument(projectId, 'Good', [{ id: 'tex-1', name: 'Pinned', uri: `/project-assets/${tex}` }]));
		const published = await app.inject({
			method: 'PUT',
			url: `/projects/${projectId}/publication`,
			headers: { cookie: owner, 'content-type': 'application/json' },
			payload: { version: 2, expectedPublicationRevision: 0 }
		});
		const publicId = published.json().publicationId;

		await saveDoc(
			projectId,
			owner,
			projectDocument(projectId, 'Broken', [{ id: 'tex-9', name: 'Ghost', uri: `/project-assets/${randomUUID()}` }])
		);
		const failed = await app.inject({
			method: 'PUT',
			url: `/projects/${projectId}/publication`,
			headers: { cookie: owner, 'content-type': 'application/json' },
			payload: { version: 3, expectedPublicationRevision: 1 }
		});
		assert.equal(failed.statusCode, 400);
		assert.equal(failed.json().error.code, 'invalid_publication');
		const current = await app.inject({ method: 'GET', url: `/publications/${publicId}` });
		assert.equal(current.statusCode, 200);
		assert.equal(current.json().name, 'Good');
		assert.equal(current.json().version, 2);
		const status = await app.inject({ method: 'GET', url: `/projects/${projectId}/publication`, headers: { cookie: owner } });
		assert.equal(status.json().revision, 1);
	} finally {
		await cleanupProject(projectId);
	}
});

test('pending assets and missing R2 bytes fail closed', async (t) => {
	if (!HAS_DB) return t.skip('Postgres unreachable');
	const owner = await sessionCookie(app, 'google:p22-owner-1');
	const projectId = track(nextProjectId());
	try {
		await saveDoc(projectId, owner, projectDocument(projectId, 'Pending seed'));
		const registered = await app.inject({
			method: 'POST',
			url: `/projects/${projectId}/assets`,
			headers: { cookie: owner, 'content-type': 'application/json' },
			payload: { name: 'pending.png' }
		});
		const pendingId = registered.json().id;
		await saveDoc(projectId, owner, projectDocument(projectId, 'Pending draft'));
		await saveDoc(projectId, owner, projectDocument(projectId, 'Pending', [{ id: 't1', name: 'P', uri: `/project-assets/${pendingId}` }]));
		const pending = await app.inject({
			method: 'PUT',
			url: `/projects/${projectId}/publication`,
			headers: { cookie: owner, 'content-type': 'application/json' },
			payload: { version: 3, expectedPublicationRevision: 0 }
		});
		assert.equal(pending.statusCode, 400);

		const tex = await uploadTexture(projectId, owner, 'vanishing.png');
		await saveDoc(projectId, owner, projectDocument(projectId, 'Vanishing', [{ id: 't1', name: 'V', uri: `/project-assets/${tex}` }]));
		const row = await pool.query('SELECT object_key FROM assets WHERE id = $1::uuid', [tex]);
		store.objects.delete(row.rows[0].object_key);
		const missing = await app.inject({
			method: 'PUT',
			url: `/projects/${projectId}/publication`,
			headers: { cookie: owner, 'content-type': 'application/json' },
			payload: { version: 4, expectedPublicationRevision: 0 }
		});
		assert.equal(missing.statusCode, 400);

		const corruptTex = await uploadTexture(projectId, owner, 'corrupt.png');
		await saveDoc(projectId, owner, projectDocument(projectId, 'Corrupt', [{ id: 't1', name: 'C', uri: `/project-assets/${corruptTex}` }]));
		const corruptRow = await pool.query('SELECT object_key FROM assets WHERE id = $1::uuid', [corruptTex]);
		const stored = store.objects.get(corruptRow.rows[0].object_key);
		stored[0] = stored[0] ^ 0xff;
		const corrupt = await app.inject({
			method: 'PUT',
			url: `/projects/${projectId}/publication`,
			headers: { cookie: owner, 'content-type': 'application/json' },
			payload: { version: 5, expectedPublicationRevision: 0 }
		});
		assert.equal(corrupt.statusCode, 400);
		assert.match(corrupt.json().error.message, /hash mismatch/);

		const sizeTex = await uploadTexture(projectId, owner, 'wrong-size.png');
		await saveDoc(projectId, owner, projectDocument(projectId, 'Wrong size', [{ id: 't1', name: 'W', uri: `/project-assets/${sizeTex}` }]));
		await pool.query('UPDATE assets SET byte_size = byte_size + 1 WHERE id = $1::uuid', [sizeTex]);
		const wrongSize = await app.inject({
			method: 'PUT',
			url: `/projects/${projectId}/publication`,
			headers: { cookie: owner, 'content-type': 'application/json' },
			payload: { version: 6, expectedPublicationRevision: 0 }
		});
		assert.equal(wrongSize.statusCode, 400);
		assert.match(wrongSize.json().error.message, /size mismatch/);
	} finally {
		await cleanupProject(projectId);
	}
});

test('owner, stranger, and guest matrix', async (t) => {
	if (!HAS_DB) return t.skip('Postgres unreachable');
	const owner = await sessionCookie(app, 'google:p22-owner-1');
	const stranger = await sessionCookie(app, 'google:p22-stranger-9');
	const projectId = track(nextProjectId());
	try {
		await saveDoc(projectId, owner, projectDocument(projectId, 'Matrix'));
		const status = await app.inject({ method: 'GET', url: `/projects/${projectId}/publication`, headers: { cookie: stranger } });
		assert.equal(status.statusCode, 404);
		const put = await app.inject({
			method: 'PUT',
			url: `/projects/${projectId}/publication`,
			headers: { cookie: stranger, 'content-type': 'application/json' },
			payload: { version: 1, expectedPublicationRevision: 0 }
		});
		assert.equal(put.statusCode, 404);
		const del = await app.inject({
			method: 'DELETE',
			url: `/projects/${projectId}/publication`,
			headers: { cookie: stranger, 'content-type': 'application/json' },
			payload: { expectedPublicationRevision: 0 }
		});
		assert.equal(del.statusCode, 404);

		const guestStatus = await app.inject({ method: 'GET', url: `/projects/${projectId}/publication` });
		assert.equal(guestStatus.statusCode, 401);
		const guestPut = await app.inject({
			method: 'PUT',
			url: `/projects/${projectId}/publication`,
			headers: { 'content-type': 'application/json' },
			payload: { version: 1, expectedPublicationRevision: 0 }
		});
		assert.equal(guestPut.statusCode, 401);
		const guestDel = await app.inject({
			method: 'DELETE',
			url: `/projects/${projectId}/publication`,
			headers: { 'content-type': 'application/json' },
			payload: { expectedPublicationRevision: 0 }
		});
		assert.equal(guestDel.statusCode, 401);

		assert.equal((await app.inject({ method: 'GET', url: '/publications/not-a-uuid' })).statusCode, 404);
		assert.equal((await app.inject({ method: 'GET', url: `/publications/${randomUUID()}` })).statusCode, 404);
		assert.equal(
			(await app.inject({ method: 'GET', url: `/publications/${randomUUID()}/versions/1/assets/${randomUUID()}/content` })).statusCode,
			404
		);
	} finally {
		await cleanupProject(projectId);
	}
});

test('concurrent publishers cannot silently overwrite', async (t) => {
	if (!HAS_DB) return t.skip('Postgres unreachable');
	const owner = await sessionCookie(app, 'google:p22-owner-1');
	const projectId = track(nextProjectId());
	try {
		await saveDoc(projectId, owner, projectDocument(projectId, 'Race'));
		await saveDoc(projectId, owner, projectDocument(projectId, 'Race'));
		const put = (version) =>
			app.inject({
				method: 'PUT',
				url: `/projects/${projectId}/publication`,
				headers: { cookie: owner, 'content-type': 'application/json' },
				payload: { version, expectedPublicationRevision: 0 }
			});
		const [a, b] = await Promise.all([put(1), put(2)]);
		assert.deepEqual([a.statusCode, b.statusCode].sort(), [200, 409]);
		const status = await app.inject({ method: 'GET', url: `/projects/${projectId}/publication`, headers: { cookie: owner } });
		assert.equal(status.json().revision, 1);
	} finally {
		await cleanupProject(projectId);
	}
});
