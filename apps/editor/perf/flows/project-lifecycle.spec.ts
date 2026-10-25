/**
 * T3.P04.S01 integrated browser verification.
 *
 * The editor is the shipped Vite preview, the API is the compiled Fastify app,
 * and all persistence is a task-private PostgreSQL database plus the
 * supervisor's process-local object store. No application source or production
 * service is intercepted; the two explicit route faults model an ambiguous
 * transport response and a held stale response after a committed API write.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test, type APIResponse, type Page, type Response } from '@playwright/test';
import { Pool } from 'pg';

import { loginAs, TEST_AUTH_SESSION_COOKIE } from '../../tests/e2e/test-auth';
import { newMeasuredSession, type MeasuredSession } from '../lib/browser';
import { fixtureProject, type FixtureProject } from '../lib/fixtures';
import {
	acceptedResultCount,
	commitPrecisionLength,
	openProjectFromHub,
	openSourceJson,
	selectFirstWallAndOpenDimensions,
	waitForAcceptedResult
} from '../lib/flow';
import { perfInitScript, readLedger } from '../lib/ledger';
import { SAVE_CONTENT_IDENTITY_SCHEME } from '@portfolio/project-model/save';
import {
	captureUnitSave,
	createProjectEnvelope,
	MODEL_RESOURCE_MIME,
	serializeProjectEnvelope,
	UNIT_ENVELOPE_SOURCE_VERSION
} from '@portfolio/project-model/units';

const apiOrigin = process.env.PERF_API_ORIGIN;
const authSecret = process.env.E2E_TEST_AUTH_SECRET;
const resultsDir = process.env.PERF_RESULTS_DIR;
const databaseUrl = process.env.DATABASE_URL;
const N1 = { latencyMs: 40, uploadBytesPerSecond: 625_000, downloadBytesPerSecond: 2_500_000 };
const REPORT_DIGEST = `sha256-${'9'.repeat(64)}`;
const PLACEMENT = {
	metresPerSourceUnit: 0.5,
	pivot: [0, 0, 0],
	footprint: { width: 1.2, depth: 0.8 },
	contactMinY: 0,
	placement: 'floor'
} as const;

if (!apiOrigin || !authSecret || !resultsDir || !databaseUrl) {
	throw new Error('PERF_API_ORIGIN, E2E_TEST_AUTH_SECRET, PERF_RESULTS_DIR and DATABASE_URL are required');
}

type Session = { cookie: string; userId: string };
type ApiJson = Record<string, unknown>;
type SaveSample = {
	cache: 'cold' | 'warm' | 'repeat-use';
	index: number;
	feedbackMs: number | null;
	feedbackApproximation: 'click to first rAF after saving status DOM mutation';
	eventTimingMs: number | null;
	eventTimingCensoredBelowMs: number;
	mainThreadRunTaskMs: number | null;
	mainThreadTaskCount: number | null;
	clickToReceiptMs: number;
	wireBytes: number;
	serverTimingMs: number | null;
	resourceTimingMs: number | null;
	predictedReceiptAllowanceMs: number;
	projectVersion: number;
};

function cookieForBrowser(pair: string, baseURL: string) {
	const equals = pair.indexOf('=');
	if (equals < 1) throw new Error('test-auth did not return a cookie pair');
	const name = pair.slice(0, equals);
	if (name !== TEST_AUTH_SESSION_COOKIE) throw new Error(`unexpected session cookie ${name}`);
	return {
		name,
		value: pair.slice(equals + 1),
		domain: new URL(baseURL).hostname,
		path: '/',
		httpOnly: true,
		secure: false
	};
}

async function authenticate(baseURL: string, user = 'agent-admin'): Promise<Session> {
	return loginAs({ user, apiOrigin: apiOrigin!, secret: authSecret!, origin: baseURL });
}

async function apiRequest(
	page: Page,
	method: string,
	path: string,
	options: { body?: string | Buffer | Uint8Array; contentType?: string; cookie?: string } = {}
): Promise<APIResponse> {
	const headers: Record<string, string> = { Origin: new URL(page.url()).origin };
	if (options.contentType) headers['content-type'] = options.contentType;
	if (options.cookie) headers.Cookie = options.cookie;
	return page.request.fetch(`${apiOrigin}${path}`, {
		method,
		headers,
		...(options.body === undefined ? {} : { data: options.body })
	});
}

async function jsonResponse(response: APIResponse | Response): Promise<ApiJson> {
	const body = await response.json();
	if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('API returned a non-object JSON body');
	return body as ApiJson;
}

async function createSavedFixture(page: Page, size: 'S' | 'M', name?: string): Promise<FixtureProject> {
	const projectId = await openProjectFromHub(page);
	const generated = await fixtureProject(size, projectId);
	const envelope = name === undefined ? generated.envelope : { ...generated.envelope, name };
	const project = envelope === generated.envelope
		? generated
		: { ...generated, envelope, canonicalJson: serializeProjectEnvelope(envelope) };
	await openSourceJson(page, project);
	await saveThroughHead(page, projectId);
	return project;
}

async function openFromHub(page: Page, projectId: string, expectedName?: string): Promise<void> {
	await page.goto('/projects');
	await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
	const load = await apiRequest(page, 'GET', `/projects/${encodeURIComponent(projectId)}`);
	if (!load.ok()) throw new Error(`Could not load project ${projectId} from API (${load.status()})`);
	const payload = await jsonResponse(load);
	const name = expectedName ?? (payload.name as string);
	const row = page.locator('li').filter({ has: page.getByText(name, { exact: true }) });
	await expect(row).toBeVisible();
	await row.getByRole('link', { name: 'Open', exact: true }).click();
	await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible({ timeout: 60_000 });
	await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60_000 });
}

async function saveThroughHead(page: Page, projectId: string): Promise<Response> {
	const endpoint = `${apiOrigin}/projects/${encodeURIComponent(projectId)}`;
	const response = page.waitForResponse(
		(candidate) => candidate.url() === endpoint && candidate.request().method() === 'PUT',
		{ timeout: 90_000 }
	);
	const button = page.locator('[data-head-save] button').first();
	await expect(button).toBeEnabled();
	await button.click();
	const saved = await response;
	if (!saved.ok()) throw new Error(`Cloud Save returned ${saved.status()}: ${await saved.text()}`);
	await expect(page.locator('[data-head-save]')).toHaveAttribute('data-save-status', 'saved', { timeout: 90_000 });
	return saved;
}

async function hubRow(page: Page, name: string) {
	const row = page.locator('li').filter({ has: page.getByText(name, { exact: true }) });
	await expect(row).toBeVisible();
	return row;
}

async function renameFromHub(page: Page, oldName: string, newName: string): Promise<void> {
	const row = await hubRow(page, oldName);
	await row.getByRole('button', { name: `Rename ${oldName}`, exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Rename project' });
	await expect(dialog).toBeVisible();
	const input = dialog.getByRole('textbox', { name: 'Project name' });
	await expect(input).toBeFocused();
	await input.fill(newName);
	await dialog.getByRole('button', { name: 'Rename project', exact: true }).click();
	await expect(dialog).toBeHidden({ timeout: 60_000 });
	await expect(page.locator('[role="status"]').filter({ hasText: `Renamed to ${newName}.` }).first()).toBeVisible();
}

async function currentProjectState(pool: Pool, projectId: string) {
	const result = await pool.query(
		`SELECT p.name, p.latest_version AS version, p.saved_base_token AS "savedBaseToken",
			v.document
		 FROM projects p JOIN project_versions v ON v.project_id = p.id AND v.version = p.latest_version
		 WHERE p.id = $1`,
		[projectId]
	);
	return result.rows[0] as { name: string; version: number; savedBaseToken: string; document: ApiJson } | undefined;
}

async function queuePendingCleanup(pool: Pool, projectId: string, siblingProjectIds: string[] = []): Promise<void> {
	const result = await pool.query(
		`SELECT status, fenced_at AS "fencedAt", cleanup_bound_ms AS "cleanupBoundMs", key_inventory AS "keyInventory"
		 FROM project_deletions WHERE project_id = $1`, [projectId]
	);
	const row = result.rows[0] as { status: string; fencedAt: Date; cleanupBoundMs: number; keyInventory: string[] } | undefined;
	if (!row || row.status === 'complete') return;
	const siblings = siblingProjectIds.length === 0
		? []
		: (await pool.query(
			'SELECT object_key AS key FROM assets WHERE project_id = ANY($1::text[]) AND object_key IS NOT NULL',
			[siblingProjectIds]
		)).rows.map((asset: { key: string }) => asset.key);
	const path = resolve(resultsDir!, 'project-lifecycle-cleanup-retry.json');
	let queue: { jobs: Array<Record<string, unknown>> } = { jobs: [] };
	try { queue = JSON.parse(await readFile(path, 'utf8')) as typeof queue; } catch { /* first queued cleanup */ }
	if (queue.jobs.some((job) => job.projectId === projectId)) return;
	queue.jobs.push({
		projectId,
		fencedAt: row.fencedAt.toISOString(),
		cleanupBoundMs: row.cleanupBoundMs,
		expectedKeys: row.keyInventory,
		siblingKeys: siblings
	});
	await writeFile(path, JSON.stringify(queue, null, 2));
}

async function versionCount(pool: Pool, projectId: string): Promise<number> {
	const result = await pool.query('SELECT count(*)::int AS count FROM project_versions WHERE project_id = $1', [projectId]);
	return result.rows[0]?.count ?? 0;
}

async function projectToken(page: Page, projectId: string): Promise<string> {
	const loaded = await apiRequest(page, 'GET', `/projects/${encodeURIComponent(projectId)}`);
	if (!loaded.ok()) throw new Error(`Project read returned ${loaded.status()}`);
	const body = await jsonResponse(loaded);
	if (typeof body.savedBaseToken !== 'string') throw new Error('Project did not provide a saved-base token');
	return body.savedBaseToken;
}

async function captureScreenshot(page: Page, name: string): Promise<void> {
	const path = resolve(resultsDir!, name);
	await mkdir(resultsDir!, { recursive: true });
	await page.screenshot({ path, fullPage: true, animations: 'disabled' });
}

function hash(bytes: Buffer): string {
	return `sha256-${createHash('sha256').update(new Uint8Array(bytes)).digest('hex')}`;
}

function makeGlb(binByte: number): Buffer {
	const doc = Buffer.from(JSON.stringify({
		asset: { version: '2.0' },
		buffers: [{ byteLength: 4 }],
		bufferViews: [{ buffer: 0, byteLength: 4 }],
		scenes: [{ nodes: [] }],
		scene: 0
	}));
	const jsonLength = doc.length + ((4 - doc.length % 4) % 4);
	const jsonChunk = Buffer.alloc(jsonLength);
	for (let index = 0; index < doc.length; index++) jsonChunk[index] = doc[index]!;
	jsonChunk.fill(0x20, doc.length);
	const bin = Buffer.alloc(4, binByte);
	const total = 12 + 8 + jsonChunk.length + 8 + bin.length;
	const header = Buffer.alloc(12);
	header.writeUInt32LE(0x46546c67, 0);
	header.writeUInt32LE(2, 4);
	header.writeUInt32LE(total, 8);
	const jsonHeader = Buffer.alloc(8);
	jsonHeader.writeUInt32LE(jsonChunk.length, 0);
	jsonHeader.writeUInt32LE(0x4e4f534a, 4);
	const binHeader = Buffer.alloc(8);
	binHeader.writeUInt32LE(bin.length, 0);
	binHeader.writeUInt32LE(0x004e4942, 4);
	const output = new Uint8Array(total);
	let offset = 0;
	for (const part of [header, jsonHeader, jsonChunk, binHeader, bin]) {
		output.set(Array.from(part), offset);
		offset += part.length;
	}
	return Buffer.from(output.buffer);
}

async function attachApprovedModel(page: Page, pool: Pool, project: FixtureProject): Promise<{ sourceKey: string; derivativeKey: string }> {
	const source = makeGlb(1);
	const derivative = makeGlb(2);
	const declarations = [
		{ role: 'source', path: 'model.glb', bytes: source },
		{ role: 'derivative', path: 'model.glb.derivative.glb', bytes: derivative }
	].map(({ role, path, bytes }) => ({ role, path, size: bytes.length, hash: hash(bytes) }));
	const stagedResponse = await apiRequest(page, 'POST', `/projects/${encodeURIComponent(project.projectId)}/models/imports`, {
		contentType: 'application/json',
		body: JSON.stringify({ files: declarations, recipe: { id: 'creator-import', version: 1 } })
	});
	if (stagedResponse.status() !== 201) throw new Error(`Model import staging returned ${stagedResponse.status()}: ${await stagedResponse.text()}`);
	const staged = await jsonResponse(stagedResponse);
	const importId = staged.importId as string;
	const stagedFiles = staged.files as Array<{ fileId: string; path: string }>;
	for (const file of stagedFiles) {
		const bytes = file.path === 'model.glb' ? source : derivative;
		const upload = await apiRequest(page, 'PUT', `/projects/${encodeURIComponent(project.projectId)}/models/imports/${importId}/files/${file.fileId}/content`, {
			contentType: 'application/octet-stream', body: bytes
		});
		if (!upload.ok()) throw new Error(`Model file upload returned ${upload.status()}: ${await upload.text()}`);
	}
	const approvedResponse = await apiRequest(page, 'POST', `/projects/${encodeURIComponent(project.projectId)}/models/imports/${importId}/approve`, {
		contentType: 'application/json', body: JSON.stringify({ reportDigest: REPORT_DIGEST, placement: PLACEMENT })
	});
	if (!approvedResponse.ok()) throw new Error(`Model approval returned ${approvedResponse.status()}: ${await approvedResponse.text()}`);
	const revision = await jsonResponse(approvedResponse);
	const derivativeInfo = revision.derivative as { hash: string; size: number };
	const resourceId = 'qa-retained-model';
	const pin = {
		hash: derivativeInfo.hash,
		mime: MODEL_RESOURCE_MIME,
		size: derivativeInfo.size,
		locator: `/projects/${encodeURIComponent(project.projectId)}/models/content/${derivativeInfo.hash}`
	};
	const resource: any = {
		kind: 'model' as const,
		id: resourceId,
		contentRevision: pin.hash,
		pin,
		unresolved: null,
		model: {
			source: revision.source,
			recipe: revision.recipe,
			reportDigest: REPORT_DIGEST,
			placement: PLACEMENT
		}
	};
	const lockEntry: any = {
		domain: 'resource:model' as const,
		subjectKind: 'resource' as const,
		subjectId: resourceId,
		instancePath: [],
		contentRevision: pin.hash,
		requiredCapabilities: [{ id: 'F2.unit-envelope', version: '1' }],
		pin
	};
	const sourceEnvelope = await createProjectEnvelope({
		id: project.projectId,
		name: project.envelope.name,
		acceptedRevision: { projectId: project.projectId, revisionId: `qa-model-${randomUUID()}` },
		dependencyLock: { formatVersion: 1, entries: [lockEntry] },
		layout: { unitId: project.envelope.units.layout.header.unitId, data: project.envelope.units.layout.data },
		scene: {
			unitId: project.envelope.units.scene.header.unitId,
			data: { ...project.envelope.units.scene.data, entities: [{
				kind: 'model', id: 'qa-model-entity', name: 'QA retained model', assetId: resourceId,
				fallback: 'generic', position: [0, 0, 0], rotation: [0, 0, 0]
			}] }
		},
		camera: { unitId: project.envelope.units.camera.header.unitId, data: project.envelope.units.camera.data },
		experience: { unitId: project.envelope.units.experience.header.unitId, data: project.envelope.units.experience.data },
		resources: { unitId: project.envelope.units.resources.header.unitId, data: { ...project.envelope.units.resources.data, resources: [resource] } }
	});
	const baseToken = await projectToken(page, project.projectId);
	const acceptedRevision = { projectId: sourceEnvelope.id, revisionId: `qa-model-save-${randomUUID()}` };
	const sourceContentId = `sha256-${'0'.repeat(64)}`;
	const capture = await captureUnitSave({
		snapshot: {
			acceptedRevision,
			sourceContentId,
			sourceKind: 'unit-envelope',
			sourceVersion: UNIT_ENVELOPE_SOURCE_VERSION,
			domain: { identity: { acceptedRevision, sourceContentId }, source: sourceEnvelope }
		},
		operationId: randomUUID(),
		precondition: { kind: 'expected-saved-base', token: baseToken }
	});
	if (capture.kind !== 'captured') throw new Error(`Model-bearing source did not capture: ${capture.message}`);
	const saveBody = { contentIdentityScheme: SAVE_CONTENT_IDENTITY_SCHEME, capture: capture.capture };
	const saved = await apiRequest(page, 'PUT', `/projects/${encodeURIComponent(project.projectId)}`, {
		contentType: 'application/json', body: JSON.stringify(saveBody)
	});
	if (!saved.ok()) throw new Error(`Model-bearing fixture Save returned ${saved.status()}: ${await saved.text()}`);
	const modelRows = await pool.query(
		' SELECT derivative_key AS "derivativeKey", source_keys AS "sourceKeys" FROM model_revisions WHERE project_id = $1',
		[project.projectId]
	);
	if (modelRows.rowCount !== 1) throw new Error('The M fixture did not retain exactly one model revision');
	const keys = modelRows.rows[0] as { derivativeKey: string; sourceKeys: string[] };
	if (keys.sourceKeys.length !== 1 || !keys.derivativeKey) throw new Error('The M fixture did not retain its source and derivative object keys');
	return { sourceKey: keys.sourceKeys[0]!, derivativeKey: keys.derivativeKey };
}

test.describe.configure({ mode: 'serial' });

test('project lifecycle works through the Hub, open Stage, and real API', async ({ browser, baseURL }, testInfo) => {
	test.setTimeout(600_000);
	if (!baseURL) throw new Error('PERF_BASE_URL is required');
	const pool = new Pool({ connectionString: databaseUrl, max: 4 });
	const admin = await authenticate(baseURL);
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
	await context.addInitScript(perfInitScript, {});
	await context.addCookies([cookieForBrowser(admin.cookie, baseURL)]);
	const page = await context.newPage();
	const evidence: ApiJson = {
		browserVersion: browser.version(),
		browserName: testInfo.project.name,
		buildRevision: process.env.GIT_HEAD ?? 'recorded by supervisor',
		viewport: { width: 1440, height: 900 },
		deviceScaleFactor: 1,
		reducedMotion: 'reduce',
		input: 'mouse/keyboard at desktop; separate coarse touch context',
		baseURL,
		apiOrigin,
		probeResults: []
	};
	const results = evidence.probeResults as string[];
	try {
		await page.goto('/projects');
		await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
		expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);

		const project = await createSavedFixture(page, 'S', 'S01 Main lifecycle');
		const projectId = project.projectId;
		const baseline = await currentProjectState(pool, projectId);
		if (!baseline) throw new Error('The UI-created project did not persist');
		const oneVersion = await versionCount(pool, projectId);
		expect(oneVersion).toBe(1);
		results.push('UI New Project → source JSON admission → conditional Save created version 1');

		await page.goto('/projects');
		const row = await hubRow(page, baseline.name);
		const renameButton = row.getByRole('button', { name: `Rename ${baseline.name}`, exact: true });
		await renameButton.click();
		const renameDialog = page.getByRole('dialog', { name: 'Rename project' });
		const nameInput = renameDialog.getByRole('textbox', { name: 'Project name' });
		await expect(nameInput).toBeFocused();
		await captureScreenshot(page, 'project-lifecycle-rename-dialog.png');
		await nameInput.press('Escape');
		await expect(renameDialog).toBeHidden();
		await expect(renameButton).toBeFocused();

		const invalidRow = await hubRow(page, baseline.name);
		await invalidRow.getByRole('button', { name: `Rename ${baseline.name}`, exact: true }).click();
		const invalidDialog = page.getByRole('dialog', { name: 'Rename project' });
		await invalidDialog.getByRole('textbox', { name: 'Project name' }).fill('   ');
		await invalidDialog.getByRole('button', { name: 'Rename project', exact: true }).click();
		await expect(invalidDialog.getByRole('alert')).toContainText('Enter a project name from 1 to 128 characters.');
		const beforeNoop = await versionCount(pool, projectId);
		await invalidDialog.getByRole('textbox', { name: 'Project name' }).fill(baseline.name);
		await invalidDialog.getByRole('button', { name: 'Rename project', exact: true }).click();
		await expect(invalidDialog).toBeHidden();
		await expect(page.locator('[role="status"]').filter({ hasText: 'Project name unchanged.' }).first()).toBeVisible();
		expect(await versionCount(pool, projectId)).toBe(beforeNoop);
		results.push('rename dialog keyboard focus/escape, invalid blank refusal, and no-op version preservation');

		await renameFromHub(page, baseline.name, 'S01 First rename');
		const firstRename = await currentProjectState(pool, projectId);
		if (!firstRename) throw new Error('Project disappeared after Hub rename');
		expect(firstRename.name).toBe('S01 First rename');
		expect(firstRename.version).toBe(2);
		const versionsAfterFirstRename = await pool.query(
			'SELECT version, document FROM project_versions WHERE project_id = $1 ORDER BY version', [projectId]
		);
		expect(versionsAfterFirstRename.rowCount).toBe(2);
		expect(versionsAfterFirstRename.rows[0].document.name).toBe(baseline.name);
		expect(versionsAfterFirstRename.rows[1].document.name).toBe('S01 First rename');
		results.push('rename appends one immutable authored-envelope version; previous version remains readable');

		const foreign = await authenticate(baseURL, 'agent-user-b');
		const foreignRead = await apiRequest(page, 'GET', `/projects/${encodeURIComponent(projectId)}`, { cookie: foreign.cookie });
		expect(foreignRead.status()).toBe(404);
		const unauthenticated = await fetch(`${apiOrigin}/projects/${encodeURIComponent(projectId)}`, {
			method: 'PATCH', headers: { Origin: baseURL, 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'Unauthorized', precondition: { kind: 'expected-saved-base', token: firstRename.savedBaseToken } })
		});
		expect(unauthenticated.status).toBe(401);
		results.push('foreign-owner and unauthenticated API requests refuse without disclosing project data');

		// A UI-prepared saved-base token goes stale while the dialog is open.
		await page.goto('/projects');
		const staleRow = await hubRow(page, 'S01 First rename');
		await staleRow.getByRole('button', { name: 'Rename S01 First rename', exact: true }).click();
		const staleDialog = page.getByRole('dialog', { name: 'Rename project' });
		await staleDialog.getByRole('textbox', { name: 'Project name' }).fill('S01 local retry');
		const staleBase = await projectToken(page, projectId);
		const external = await apiRequest(page, 'PATCH', `/projects/${encodeURIComponent(projectId)}`, {
			contentType: 'application/json', body: JSON.stringify({ name: 'S01 remote', precondition: { kind: 'expected-saved-base', token: staleBase } })
		});
		expect(external.ok()).toBe(true);
		await staleDialog.getByRole('button', { name: 'Rename project', exact: true }).click();
		await expect(staleDialog.getByRole('status')).toContainText('Cloud now names this project S01 remote');
		await expect(staleDialog.getByRole('button', { name: 'Refresh and retry rename', exact: true })).toBeVisible();
		const versionBeforeRefreshRetry = await versionCount(pool, projectId);
		await staleDialog.getByRole('button', { name: 'Refresh and retry rename', exact: true }).click();
		await expect(staleDialog).toBeHidden({ timeout: 60_000 });
		expect((await currentProjectState(pool, projectId))?.name).toBe('S01 local retry');
		expect(await versionCount(pool, projectId)).toBe(versionBeforeRefreshRetry + 1);
		results.push('stale base exposes remote name and requires explicit refresh/retry without losing entered name');

		// Server commits the rename, then the test-only browser route drops its response.
		await page.goto('/projects');
		const ambiguousRow = await hubRow(page, 'S01 local retry');
		await ambiguousRow.getByRole('button', { name: 'Rename S01 local retry', exact: true }).click();
		const ambiguousDialog = page.getByRole('dialog', { name: 'Rename project' });
		await ambiguousDialog.getByRole('textbox', { name: 'Project name' }).fill('S01 ambiguous commit');
		const beforeAmbiguous = await versionCount(pool, projectId);
		const patchUrl = `${apiOrigin}/projects/${encodeURIComponent(projectId)}`;
		let upstreamCommitted!: () => void;
		const committed = new Promise<void>((resolveCommitted) => (upstreamCommitted = resolveCommitted));
		await page.route(patchUrl, async (route) => {
			if (route.request().method() !== 'PATCH') return route.continue();
			const upstream = await route.fetch();
			upstreamCommitted();
			await route.abort('failed');
		});
		await ambiguousDialog.getByRole('button', { name: 'Rename project', exact: true }).click();
		await committed;
		await expect(ambiguousDialog.getByRole('button', { name: 'Retry rename', exact: true })).toBeVisible();
		expect((await currentProjectState(pool, projectId))?.name).toBe('S01 ambiguous commit');
		await page.unroute(patchUrl);
		await ambiguousDialog.getByRole('button', { name: 'Retry rename', exact: true }).click();
		await expect(ambiguousDialog.getByRole('button', { name: 'Refresh and retry rename', exact: true })).toBeVisible();
		const afterAmbiguousCommit = await versionCount(pool, projectId);
		expect(afterAmbiguousCommit).toBe(beforeAmbiguous + 1);
		await ambiguousDialog.getByRole('button', { name: 'Refresh and retry rename', exact: true }).click();
		await expect(ambiguousDialog).toBeHidden({ timeout: 60_000 });
		expect(await versionCount(pool, projectId)).toBe(afterAmbiguousCommit);
		results.push('ambiguous committed rename is safely retried through conflict refresh with no duplicate version');

		// The current Stage keeps its dirty model and Undo/Redo history across rename.
		await openFromHub(page, projectId, 'S01 ambiguous commit');
		const savedBeforeEdit = await currentProjectState(pool, projectId);
		if (!savedBeforeEdit) throw new Error('Project baseline is missing before Stage edit');
		await selectFirstWallAndOpenDimensions(page);
		const acceptedBefore = await acceptedResultCount(page);
		await commitPrecisionLength(page, 4.5);
		await waitForAcceptedResult(page, acceptedBefore);
		await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
		const headRename = page.getByRole('button', { name: 'Rename S01 ambiguous commit', exact: true });
		await headRename.click();
		const dirtyDialog = page.getByRole('dialog', { name: 'Rename project' });
		await expect(dirtyDialog.getByRole('textbox', { name: 'Project name' })).toBeFocused();
		await captureScreenshot(page, 'project-lifecycle-dirty-head.png');
		await dirtyDialog.getByRole('textbox', { name: 'Project name' }).fill('S01 dirty rename');
		await dirtyDialog.getByRole('button', { name: 'Rename project', exact: true }).click();
		await expect(dirtyDialog).toBeHidden({ timeout: 60_000 });
		await expect(page.getByRole('heading', { level: 1, name: 'S01 dirty rename', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
		const beforeUndo = await acceptedResultCount(page);
		await page.getByRole('button', { name: 'Undo', exact: true }).click();
		await waitForAcceptedResult(page, beforeUndo);
		const beforeRedo = await acceptedResultCount(page);
		await page.getByRole('button', { name: 'Redo', exact: true }).click();
		await waitForAcceptedResult(page, beforeRedo);
		const saveResponse = await saveThroughHead(page, projectId);
		expect(Number(saveResponse.request().postDataBuffer()?.byteLength ?? 0)).toBeGreaterThan(0);
		const persistedDirty = await currentProjectState(pool, projectId);
		if (!persistedDirty) throw new Error('Renamed dirty project disappeared');
		expect(persistedDirty.name).toBe('S01 dirty rename');
		expect(JSON.stringify((persistedDirty.document as any).units.layout.data)).not.toBe(JSON.stringify((savedBeforeEdit.document as any).units.layout.data));
		const downloaded = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Download source JSON', exact: true }).click();
		const sourceDownload = await downloaded;
		const downloadedJson = JSON.parse(await readFile((await sourceDownload.path())!, 'utf8')) as ApiJson;
		expect(downloadedJson.name).toBe('S01 dirty rename');
		await openFromHub(page, projectId, 'S01 dirty rename');
		const reopened = await currentProjectState(pool, projectId);
		if (!reopened) throw new Error('Reopened project is missing');
		expect(reopened.name).toBe('S01 dirty rename');
		results.push('current-project rename preserved dirty domain edit and history; next Save and Hub reopen retained the new name');

		// Create an Experience only through its authored lens, then verify Preview isolation.
		await page.getByRole('group', { name: 'Product lens' }).getByRole('button', { name: 'Experience', exact: true }).click();
		await page.getByRole('button', { name: 'Create Experience', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Preview', exact: true })).toBeEnabled({ timeout: 60_000 });
		await page.getByRole('button', { name: 'Preview', exact: true }).click();
		await expect(page.getByRole('button', { name: /Exit Preview/ })).toBeVisible({ timeout: 60_000 });
		await expect(page.locator('[data-head-save]')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Rename S01 dirty rename', exact: true })).toHaveCount(0);
		await captureScreenshot(page, 'project-lifecycle-preview-isolation.png');
		await page.getByRole('button', { name: /Exit Preview/ }).click();
		await expect(page.locator('[data-head-save]')).toBeVisible();
		await page.getByRole('group', { name: 'Product lens' }).getByRole('button', { name: 'World', exact: true }).click();
		results.push('Experience Preview uses the authored source and mounts no Save, Undo, or lifecycle authoring controls');

		// Dirty current delete cancellation preserves the session and source recovery.
		const beforeDeleteEdit = await acceptedResultCount(page);
		await commitPrecisionLength(page, 5.25);
		await waitForAcceptedResult(page, beforeDeleteEdit);
		const recoverableDownload = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Download source JSON', exact: true }).click();
		const recovered = JSON.parse(await readFile((await (await recoverableDownload).path())!, 'utf8')) as ApiJson;
		expect(recovered.id).toBe(projectId);
		const currentDelete = page.getByRole('button', { name: 'Delete S01 dirty rename', exact: true });
		await currentDelete.click();
		const deleteDialog = page.getByRole('dialog', { name: 'Delete S01 dirty rename?' });
		await expect(deleteDialog).toBeVisible();
		let dismissedDirtyConfirm = false;
		page.once('dialog', async (dialog) => {
			dismissedDirtyConfirm = dialog.type() === 'confirm';
			await dialog.dismiss();
		});
		await deleteDialog.getByRole('button', { name: 'Delete S01 dirty rename', exact: true }).click();
		await expect.poll(() => dismissedDirtyConfirm).toBe(true);
		await expect(deleteDialog.getByRole('alert')).toContainText('Delete canceled. Your local work is unchanged.');
		await expect(page.getByRole('heading', { level: 1, name: 'S01 dirty rename', exact: true })).toBeVisible();
		expect((await currentProjectState(pool, projectId))?.name).toBe('S01 dirty rename');
		results.push('dirty current delete cancellation preserved the live session, API project, and downloaded source recovery');

		// Publications are a fixture row because the product's publish route is intentionally unavailable.
		await page.goto('/projects');
		const stateForPublication = await currentProjectState(pool, projectId);
		if (!stateForPublication) throw new Error('Publication fixture project is missing');
		const publicId = randomUUID();
		await pool.query(
			'INSERT INTO publications(project_id, public_id, active_version, revision) VALUES ($1, $2, $3, 1)',
			[projectId, publicId, stateForPublication.version]
		);
		const publicationRow = await hubRow(page, 'S01 dirty rename');
		await publicationRow.getByRole('button', { name: 'Delete S01 dirty rename', exact: true }).click();
		await expect(page.getByRole('status').filter({ hasText: 'Unpublish this project before deleting it.' })).toBeVisible();
		await expect(page.getByRole('dialog')).toHaveCount(0);
		const unpublish = await apiRequest(page, 'DELETE', `/projects/${encodeURIComponent(projectId)}/publication`, {
			contentType: 'application/json', body: JSON.stringify({ expectedPublicationRevision: 1 })
		});
		expect(unpublish.ok()).toBe(true);
		const inactiveRow = await hubRow(page, 'S01 dirty rename');
		await inactiveRow.getByRole('button', { name: 'Delete S01 dirty rename', exact: true }).click();
		const inactiveDialog = page.getByRole('dialog', { name: 'Delete S01 dirty rename?' });
		await expect(inactiveDialog).toContainText('This project has an inactive public link. Deleting it retires that link.');
		await captureScreenshot(page, 'project-lifecycle-inactive-publication-delete.png');
		await inactiveDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(inactiveDialog).toBeHidden();
		results.push('active publication preflight refused; actual Unpublish allowed reviewed deletion with inactive-link warning');

		// Busy delete is retryable through the same confirmation.
		const busyBase = await currentProjectState(pool, projectId);
		if (!busyBase) throw new Error('Busy delete fixture project is missing');
		const leaseId = randomUUID();
		await pool.query(
			`INSERT INTO project_write_leases(id, project_id, owner_id, started_at, heartbeat_at, deadline_at)
			 VALUES($1, $2, $3, clock_timestamp(), clock_timestamp(), clock_timestamp() + interval '30 seconds')`,
			[leaseId, projectId, admin.userId]
		);
		const busyRow = await hubRow(page, 'S01 dirty rename');
		await busyRow.getByRole('button', { name: 'Delete S01 dirty rename', exact: true }).click();
		const busyDialog = page.getByRole('dialog', { name: 'Delete S01 dirty rename?' });
		await busyDialog.getByRole('button', { name: 'Delete S01 dirty rename', exact: true }).click();
		await expect(busyDialog.getByRole('alert')).toContainText('Project writes are still active');
		await expect(busyDialog.getByRole('button', { name: 'Retry delete S01 dirty rename', exact: true })).toBeVisible();
		await pool.query('UPDATE project_write_leases SET released_at = clock_timestamp() WHERE id = $1', [leaseId]);
		const busyDeleteResponse = page.waitForResponse((response) => response.url() === `${apiOrigin}/projects/${encodeURIComponent(projectId)}` && response.request().method() === 'DELETE');
		await busyDialog.getByRole('button', { name: 'Retry delete S01 dirty rename', exact: true }).click();
		const busyDeleted = await busyDeleteResponse;
		expect([200, 202]).toContain(busyDeleted.status());
		await expect(busyDialog).toBeHidden({ timeout: 60_000 });
		await expect(page.getByRole('status').filter({ hasText: /Project deleted\.|Project access ended; byte cleanup is pending\./ })).toBeVisible();
		await queuePendingCleanup(pool, projectId);
		const deletedProject = await pool.query('SELECT count(*)::int AS count FROM projects WHERE id = $1', [projectId]);
		expect(deletedProject.rows[0].count).toBe(0);
		results.push('project-busy remained a confirmed retryable refusal; retry after lease release deleted the project');

		// A separate current project injects a real byte cleanup failure. The supervisor retries it.
		await page.goto('/projects');
		const pendingFixture = await createSavedFixture(page, 'S', 'S01 Pending cleanup');
		const pendingId = pendingFixture.projectId;
		await page.goto('/projects');
		const siblingFixture = await createSavedFixture(page, 'S', 'S01 Same-byte sibling');
		const siblingId = siblingFixture.projectId;
		const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
		async function registerAndUpload(projectKey: string, assetName: string) {
			const registered = await apiRequest(page, 'POST', `/projects/${encodeURIComponent(projectKey)}/assets`, {
				contentType: 'application/json', body: JSON.stringify({ name: assetName })
			});
			if (registered.status() !== 201) throw new Error(`Asset registration returned ${registered.status()}: ${await registered.text()}`);
			const asset = await jsonResponse(registered);
			const upload = await apiRequest(page, 'PUT', `/projects/${encodeURIComponent(projectKey)}/assets/${asset.id}/content`, {
				contentType: 'application/octet-stream', body: png
			});
			if (!upload.ok()) throw new Error(`Asset upload returned ${upload.status()}: ${await upload.text()}`);
			return (await pool.query('SELECT object_key AS key FROM assets WHERE id = $1::uuid', [asset.id])).rows[0].key as string;
		}
		const ownedKey = await registerAndUpload(pendingId, 'pending.png');
		const siblingKey = await registerAndUpload(siblingId, 'sibling.png');
		expect(siblingKey).not.toBe(ownedKey);
		const hashes = await pool.query('SELECT project_id, sha256 FROM assets WHERE project_id = ANY($1::text[]) ORDER BY project_id', [[pendingId, siblingId]]);
		expect(hashes.rows).toHaveLength(2);
		expect(hashes.rows[0].sha256).toBe(hashes.rows[1].sha256);
		await openFromHub(page, pendingId, pendingFixture.envelope.name);
		const dirtyPending = await acceptedResultCount(page);
		await selectFirstWallAndOpenDimensions(page);
		await commitPrecisionLength(page, 4.75);
		await waitForAcceptedResult(page, dirtyPending);
		const pendingDownload = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Download source JSON', exact: true }).click();
		await readFile((await (await pendingDownload).path())!, 'utf8');
		await page.getByRole('button', { name: 'Delete ' + pendingFixture.envelope.name, exact: true }).click();
		const pendingDialog = page.getByRole('dialog', { name: `Delete ${pendingFixture.envelope.name}?` });
		await expect(pendingDialog).toBeVisible();
		page.once('dialog', (dialog) => void dialog.dismiss());
		await pendingDialog.getByRole('button', { name: `Delete ${pendingFixture.envelope.name}`, exact: true }).click();
		await expect(pendingDialog.getByRole('alert')).toContainText('Delete canceled. Your local work is unchanged.');
		await expect(page.getByRole('heading', { level: 1, name: pendingFixture.envelope.name, exact: true })).toBeVisible();
		await writeFile(resolve(resultsDir!, 'project-lifecycle-store-control.json'), JSON.stringify({ blockedProjectIds: [pendingId] }, null, 2));
		await captureScreenshot(page, 'project-lifecycle-delete-confirmation.png');
		const pendingFence = page.waitForResponse((candidate) => candidate.url() === `${apiOrigin}/projects/${encodeURIComponent(pendingId)}` && candidate.request().method() === 'DELETE');
		page.once('dialog', (dialog) => void dialog.accept());
		await pendingDialog.getByRole('button', { name: `Delete ${pendingFixture.envelope.name}`, exact: true }).click();
		const pendingResponse = await pendingFence;
		expect(pendingResponse.status()).toBe(202);
		await expect(page).toHaveURL(/\/projects\?deleted=pending/);
		await expect(page.getByRole('status').filter({ hasText: 'Project access ended; byte cleanup is pending.' })).toBeVisible();
		await writeFile(resolve(resultsDir!, 'project-lifecycle-store-control.json'), JSON.stringify({ blockedProjectIds: [] }, null, 2));
		const deletion = await pool.query('SELECT status, key_inventory FROM project_deletions WHERE project_id = $1', [pendingId]);
		if (deletion.rowCount !== 1) throw new Error('Pending delete did not leave its durable cleanup record');
		expect(deletion.rows[0].status).toBe('pending');
		expect(deletion.rows[0].key_inventory).toContain(ownedKey);
		await queuePendingCleanup(pool, pendingId, [siblingId]);
		results.push('current-project dirty delete cancelled once with recovery, then confirmed pending cleanup with durable owned-key inventory');

		// Owner-mediated unpublish-and-delete of an inactive link; active preflight was tested above.
		await page.goto('/projects');
		const unpublishFixture = await createSavedFixture(page, 'S', 'S01 Inactive publication');
		await page.goto('/projects');
		const unpublishState = await currentProjectState(pool, unpublishFixture.projectId);
		if (!unpublishState) throw new Error('Unpublish fixture project is missing');
		const inactivePublicId = randomUUID();
		await pool.query(
			'INSERT INTO publications(project_id, public_id, active_version, revision) VALUES ($1, $2, $3, 1)',
			[unpublishFixture.projectId, inactivePublicId, unpublishState.version]
		);
		const preflightRow = await hubRow(page, unpublishFixture.envelope.name);
		await preflightRow.getByRole('button', { name: `Delete ${unpublishFixture.envelope.name}`, exact: true }).click();
		await expect(page.getByRole('status').filter({ hasText: 'Unpublish this project before deleting it.' })).toBeVisible();
		const unpublishResponse = await apiRequest(page, 'DELETE', `/projects/${encodeURIComponent(unpublishFixture.projectId)}/publication`, {
			contentType: 'application/json', body: JSON.stringify({ expectedPublicationRevision: 1 })
		});
		expect(unpublishResponse.ok()).toBe(true);
		const inactiveProjectRow = await hubRow(page, unpublishFixture.envelope.name);
		await inactiveProjectRow.getByRole('button', { name: `Delete ${unpublishFixture.envelope.name}`, exact: true }).click();
		const inactiveConfirmation = page.getByRole('dialog', { name: `Delete ${unpublishFixture.envelope.name}?` });
		await expect(inactiveConfirmation).toContainText('This project has an inactive public link. Deleting it retires that link.');
		await inactiveConfirmation.getByRole('button', { name: `Delete ${unpublishFixture.envelope.name}`, exact: true }).click();
		await expect(inactiveConfirmation).toBeHidden({ timeout: 60_000 });
		await queuePendingCleanup(pool, unpublishFixture.projectId);
		expect((await pool.query('SELECT count(*)::int AS count FROM publications WHERE project_id = $1', [unpublishFixture.projectId])).rows[0].count).toBe(0);
		const publicGone = await page.request.get(`${apiOrigin}/publications/${inactivePublicId}`);
		expect(publicGone.status()).toBe(404);
		results.push('after actual Unpublish the inactive link warning was honored, deletion removed its publication row, and public reader returned not found');

		// A response arriving after route replacement cannot write into the next project session.
		await page.goto('/projects');
		const sourceForRace = await createSavedFixture(page, 'S', 'S01 Stale response source');
		await page.goto('/projects');
		const otherForRace = await createSavedFixture(page, 'S', 'S01 New session destination');
		await page.goto('/projects');
		await openFromHub(page, sourceForRace.projectId, sourceForRace.envelope.name);
		const raceButton = page.getByRole('button', { name: `Rename ${sourceForRace.envelope.name}`, exact: true });
		await raceButton.click();
		const raceDialog = page.getByRole('dialog', { name: 'Rename project' });
		await raceDialog.getByRole('textbox', { name: 'Project name' }).fill('S01 late response');
		const raceUrl = `${apiOrigin}/projects/${encodeURIComponent(sourceForRace.projectId)}`;
		let responseCommitted!: () => void;
		let releaseResponse!: () => void;
		const committedPromise = new Promise<void>((resolveCommitted) => (responseCommitted = resolveCommitted));
		const releasePromise = new Promise<void>((resolveRelease) => (releaseResponse = resolveRelease));
		await page.route(raceUrl, async (route) => {
			if (route.request().method() !== 'PATCH') return route.continue();
			const upstream = await route.fetch();
			responseCommitted();
			await releasePromise;
			try { await route.fulfill({ response: upstream }); } catch { /* navigation may cancel the old page's response */ }
		});
		void raceDialog.getByRole('button', { name: 'Rename project', exact: true }).click().catch(() => undefined);
		await committedPromise;
		await page.goto('/projects');
		await openFromHub(page, otherForRace.projectId, otherForRace.envelope.name);
		releaseResponse();
		await page.waitForTimeout(100);
		await expect(page.getByRole('heading', { level: 1, name: otherForRace.envelope.name, exact: true })).toBeVisible();
		expect((await currentProjectState(pool, otherForRace.projectId))?.name).toBe(otherForRace.envelope.name);
		expect((await currentProjectState(pool, sourceForRace.projectId))?.name).toBe('S01 late response');
		await page.unroute(raceUrl);
		results.push('committed stale rename response released only after a new project was open; newer session remained intact');

		// 320 CSS px touch viewport: dialog and actions remain reachable without horizontal overflow.
		const touchContext = await browser.newContext({
			viewport: { width: 320, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
			reducedMotion: 'reduce'
		});
		await touchContext.addCookies([cookieForBrowser(admin.cookie, baseURL)]);
		const touchPage = await touchContext.newPage();
		await touchPage.goto('/projects');
		const touchRow = await hubRow(touchPage, otherForRace.envelope.name);
		expect(await touchPage.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
		await touchRow.getByRole('button', { name: `Rename ${otherForRace.envelope.name}`, exact: true }).tap();
		const touchDialog = touchPage.getByRole('dialog', { name: 'Rename project' });
		await expect(touchDialog).toBeVisible();
		await expect.poll(() => touchPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		const dialogBounds = await touchDialog.boundingBox();
		expect(dialogBounds?.width).toBeLessThanOrEqual(320);
		await captureScreenshot(touchPage, 'project-lifecycle-narrow-coarse-touch.png');
		await touchDialog.getByRole('button', { name: 'Cancel', exact: true }).tap();
		await expect(touchDialog).toBeHidden();
		await touchContext.close();
		results.push('320×800 CSS, DPR 2, coarse-touch Hub dialog fit, tap targets and cancellation');

		const unauthResponse = await fetch(`${apiOrigin}/projects/${encodeURIComponent(projectId)}`);
		expect(unauthResponse.status).toBe(401);
		const finalFacts = {
			...evidence,
			ownerId: admin.userId,
			browserVersion: browser.version(),
			userAgent: await page.evaluate(() => navigator.userAgent),
			platform: await page.evaluate(() => navigator.platform),
			matchMediaReducedMotion: await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
			probeResults: results,
			apiChecks: { unauthenticatedFinalRead: unauthResponse.status, foreignOwnerRead: foreignRead.status() }
		};
		await writeFile(resolve(resultsDir!, 'project-lifecycle-browser-facts.json'), JSON.stringify(finalFacts, null, 2));
		await testInfo.attach('project-lifecycle-browser-facts.json', { body: Buffer.from(JSON.stringify(finalFacts, null, 2)), contentType: 'application/json' });
		for (const file of [
			'project-lifecycle-rename-dialog.png', 'project-lifecycle-dirty-head.png',
			'project-lifecycle-preview-isolation.png', 'project-lifecycle-inactive-publication-delete.png',
			'project-lifecycle-delete-confirmation.png', 'project-lifecycle-narrow-coarse-touch.png'
		]) {
			await testInfo.attach(file, { path: resolve(resultsDir!, file), contentType: 'image/png' });
		}
	} finally {
		await context.close().catch(() => undefined);
		await pool.end().catch(() => undefined);
	}
});

test('F9 M lifecycle workload retains approved model bytes across cold, warm, and repeat-use Saves', async ({ browser, baseURL }, testInfo) => {
	test.setTimeout(1_200_000);
	if (!baseURL) throw new Error('PERF_BASE_URL is required');
	const pool = new Pool({ connectionString: databaseUrl, max: 4 });
	const auth = await authenticate(baseURL);
	const setupContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
	await setupContext.addInitScript(perfInitScript, {});
	await setupContext.addCookies([cookieForBrowser(auth.cookie, baseURL)]);
	const setupPage = await setupContext.newPage();
	const samples: SaveSample[] = [];
	const facts = {
		flow: 'F9 Save',
		fixture: 'M grid-7 with retained approved model source and derivative',
		facts: { walls: 112, openings: 112, rooms: 49, modelSourceFiles: 1, approvedDerivatives: 1 },
		browserVersion: browser.version(),
		browserProject: testInfo.project.name,
		viewport: { width: 1920, height: 1080 },
		deviceScaleFactor: 1,
		input: 'mouse and keyboard',
		reducedMotion: 'no-preference',
		network: { profile: 'N1', ...N1 },
		cpuRate: 1,
		operatorDisposition: 'agent-operated M2; observed timings are pre-flight and do not satisfy owner-operated hard-row acceptance',
		measurements: samples
	};
	try {
		await setupPage.goto('/projects');
		await expect(setupPage.getByRole('button', { name: 'New Project' })).toBeVisible();
		const mProject = await createSavedFixture(setupPage, 'M');
		const modelKeys = await attachApprovedModel(setupPage, pool, mProject);
		await openFromHub(setupPage, mProject.projectId, mProject.envelope.name);
		await expect(setupPage.getByRole('button', { name: 'Rename ' + mProject.envelope.name, exact: true })).toBeVisible();
		await expect.poll(async () => {
			const rows = await pool.query('SELECT source_keys FROM model_revisions WHERE project_id = $1', [mProject.projectId]);
			return rows.rows[0]?.source_keys?.length ?? 0;
		}).toBe(1);
		const savedSource = await currentProjectState(pool, mProject.projectId);
		if (!savedSource) throw new Error('M model fixture disappeared before measurements');
		await setupContext.close();

		let currentName = savedSource.name;
		let cycleNumber = 0;
		async function lifecycleSaveRun(session: MeasuredSession, cache: SaveSample['cache'], index: number): Promise<SaveSample> {
			cycleNumber += 1;
			const { page, cdp } = session;
			await page.goto('/projects');
			await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
			await openFromHub(page, mProject.projectId, currentName);
			const nextName = `F9 ${cache} ${String(cycleNumber).padStart(2, '0')}`;
			await page.getByRole('button', { name: `Rename ${currentName}`, exact: true }).click();
			const renameDialog = page.getByRole('dialog', { name: 'Rename project' });
			await renameDialog.getByRole('textbox', { name: 'Project name' }).fill(nextName);
			await renameDialog.getByRole('button', { name: 'Rename project', exact: true }).click();
			await expect(renameDialog).toBeHidden({ timeout: 60_000 });
			currentName = nextName;

			await selectFirstWallAndOpenDimensions(page);
			const beforeEdit = await acceptedResultCount(page);
			await commitPrecisionLength(page, 4.5 + cycleNumber / 100);
			await waitForAcceptedResult(page, beforeEdit);

			await page.evaluate(() => {
				const target = document.querySelector('[data-head-save]');
				const root = window as Window & { __PROJECT_LIFECYCLE_SAVE_FEEDBACK__?: { click: number; mutation: number; frame: number } | null };
				root.__PROJECT_LIFECYCLE_SAVE_FEEDBACK__ = null;
				if (!target) return;
				const button = target.querySelector('button');
				button?.addEventListener('click', () => {
					root.__PROJECT_LIFECYCLE_SAVE_FEEDBACK__ = { click: performance.now(), mutation: 0, frame: 0 };
				}, { capture: true, once: true });
				new MutationObserver(() => {
					const feedback = root.__PROJECT_LIFECYCLE_SAVE_FEEDBACK__;
					if (target.getAttribute('data-save-status') !== 'saving' || feedback == null || feedback.frame !== 0) return;
					const mutation = performance.now();
					requestAnimationFrame(() => {
						const frame = performance.now();
						root.__PROJECT_LIFECYCLE_SAVE_FEEDBACK__ = { ...feedback, mutation, frame };
					});
				}).observe(target, { attributes: true, attributeFilter: ['data-save-status'] });
				performance.mark('f9:measurement-start');
			});
			const eventCountBefore = (await readLedger(page)).events.length;
			let traceComplete!: (value: { stream?: string }) => void;
			const complete = new Promise<{ stream?: string }>((resolveComplete) => (traceComplete = resolveComplete));
			const chunks: string[] = [];
			const onComplete = (value: { stream?: string }) => traceComplete(value);
			cdp.on('Tracing.tracingComplete', onComplete);
			await cdp.send('Tracing.start', {
				categories: 'devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing',
				transferMode: 'ReturnAsStream'
			});
			const endpoint = `${apiOrigin}/projects/${encodeURIComponent(mProject.projectId)}`;
			const receiptWait = page.waitForResponse(
				(response) => response.url() === endpoint && response.request().method() === 'PUT',
				{ timeout: 120_000 }
			);
			await page.locator('[data-head-save] button').first().click();
			const receipt = await receiptWait;
			if (!receipt.ok()) throw new Error(`M Save returned ${receipt.status()}: ${await receipt.text()}`);
			await expect(page.locator('[data-head-save]')).toHaveAttribute('data-save-status', 'saved', { timeout: 120_000 });
			await cdp.send('Tracing.end');
			const traceResult = await complete;
			cdp.off('Tracing.tracingComplete', onComplete);
			if (traceResult.stream) {
				let eof = false;
				while (!eof) {
					const chunk = await cdp.send('IO.read', { handle: traceResult.stream, size: 1_000_000 });
					chunks.push(chunk.data as string);
					eof = Boolean(chunk.eof);
				}
				await cdp.send('IO.close', { handle: traceResult.stream });
			}
			const traceText = chunks.join('');
			let mainThreadRunTaskMs: number | null = null;
			let mainThreadTaskCount: number | null = null;
			if (traceText) {
				const trace = JSON.parse(traceText) as { traceEvents?: Array<{ name?: string; ph?: string; dur?: number; pid?: number; tid?: number; args?: { name?: string } }> };
				const events = trace.traceEvents ?? [];
				const mainThread = new Set(events.filter((entry) => entry.name === 'thread_name' && entry.args?.name === 'CrRendererMain').map((entry) => `${entry.pid}:${entry.tid}`));
				const tasks = events.filter((entry) => entry.name === 'RunTask' && entry.ph === 'X' && typeof entry.dur === 'number' && mainThread.has(`${entry.pid}:${entry.tid}`));
				mainThreadRunTaskMs = tasks.reduce((total, entry) => total + (entry.dur ?? 0), 0) / 1000;
				mainThreadTaskCount = tasks.length;
			}
			const bytes = Number(receipt.request().postDataBuffer()?.byteLength ?? 0);
			const body = await jsonResponse(receipt);
			const acknowledgement = body as ApiJson;
			const ledger = await readLedger(page);
			const saveMarks = ledger.records.filter((record) => record.kind === 'mark' && ['save:submit', 'save:receipt'].includes(record.name));
			const submit = [...saveMarks].reverse().find((record) => record.name === 'save:submit');
			const savedMark = [...saveMarks].reverse().find((record) => record.name === 'save:receipt');
			if (!submit || !savedMark) throw new Error('Save ledger did not capture submit and durable receipt');
			const feedback = await page.evaluate(() => (window as Window & { __PROJECT_LIFECYCLE_SAVE_FEEDBACK__?: { click: number; mutation: number; frame: number } | null }).__PROJECT_LIFECYCLE_SAVE_FEEDBACK__ ?? null);
			const relevantEvent = ledger.events.slice(eventCountBefore).find((entry) => entry.name.toLowerCase().includes('save')) ?? ledger.events.slice(eventCountBefore)[0];
			const timing = await page.evaluate((url) => {
				const item = performance.getEntriesByType('resource').filter((entry) => entry.name === url).at(-1) as PerformanceResourceTiming | undefined;
				return item ? { duration: item.duration, serverTiming: item.serverTiming.map((value) => ({ name: value.name, duration: value.duration })) } : null;
			}, endpoint);
			const loaded = await currentProjectState(pool, mProject.projectId);
			if (!loaded) throw new Error('M project disappeared after Save');
			const sample: SaveSample = {
				cache,
				index,
				feedbackMs: feedback ? feedback.frame - feedback.click : null,
				feedbackApproximation: 'click to first rAF after saving status DOM mutation',
				eventTimingMs: relevantEvent?.duration ?? null,
				eventTimingCensoredBelowMs: relevantEvent ? 0 : 16,
				mainThreadRunTaskMs,
				mainThreadTaskCount,
				clickToReceiptMs: savedMark.time - submit.time,
				wireBytes: bytes,
				serverTimingMs: timing?.serverTiming.find((entry) => entry.name === 'lifecycle')?.duration ?? null,
				resourceTimingMs: timing?.duration ?? null,
				predictedReceiptAllowanceMs: (8 * bytes) / (5_000) + 2 * N1.latencyMs + 500,
				projectVersion: loaded.version
			};
			await page.goto('/projects');
			return sample;
		}

		async function measuredSession(cache: SaveSample['cache'], index: number): Promise<SaveSample> {
			const session = await newMeasuredSession(browser, {
				viewport: { width: 1920, height: 1080 },
				deviceScaleFactor: 1,
				network: 'N1',
				cacheState: cache
			});
			try {
				await session.context.addCookies([cookieForBrowser(auth.cookie, baseURL!)]);
				const result = await lifecycleSaveRun(session, cache, index);
				return result;
			} finally {
				await session.close();
			}
		}

		await measuredSession('cold', 0); // one discarded cold warm-up
		for (let index = 0; index < 10; index++) {
			const run = await measuredSession('cold', index + 1);
			samples.push(run);
		}

		for (const cache of ['warm', 'repeat-use'] as const) {
			const session = await newMeasuredSession(browser, {
				viewport: { width: 1920, height: 1080 },
				deviceScaleFactor: 1,
				network: 'N1',
				cacheState: cache
			});
			try {
				await session.context.addCookies([cookieForBrowser(auth.cookie, baseURL)]);
				await lifecycleSaveRun(session, cache, 0); // one discarded warm-up
				for (let index = 0; index < 10; index++) samples.push(await lifecycleSaveRun(session, cache, index + 1));
			} finally {
				await session.close();
			}
		}

		const summarize = (values: number[]) => {
			const sorted = [...values].sort((a, b) => a - b);
			const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
			return { n: sorted.length, p50: at(0.50), p75: at(0.75), p95: at(0.95), max: sorted.at(-1) };
		};
		const statistics = Object.fromEntries((['cold', 'warm', 'repeat-use'] as const).map((cache) => {
			const rows = samples.filter((sample) => sample.cache === cache);
			return [cache, {
				localFeedbackMs: summarize(rows.flatMap((row) => row.feedbackMs === null ? [] : [row.feedbackMs])),
				mainThreadRunTaskMs: summarize(rows.flatMap((row) => row.mainThreadRunTaskMs === null ? [] : [row.mainThreadRunTaskMs])),
				clickToDurableReceiptMs: summarize(rows.map((row) => row.clickToReceiptMs)),
				wireBytes: summarize(rows.map((row) => row.wireBytes)),
				serverTimingMs: summarize(rows.flatMap((row) => row.serverTimingMs === null ? [] : [row.serverTimingMs])),
				eventTimingObserved: rows.filter((row) => row.eventTimingMs !== null).length,
				eventTimingCensoredBelow16ms: rows.filter((row) => row.eventTimingMs === null).length,
				allSamples: rows
			}];
		}));
		const output = {
			...facts,
			buildRevision: process.env.GIT_HEAD,
			apiOrigin,
			database: 'task-private local PostgreSQL database; dropped by shell trap',
			objectStore: 'same Fastify process memory store; no R2 access',
			modelKeys,
			warmupRuns: 1,
			measuredRunsPerCacheState: 10,
			statistics,
			hardBudgetDisposition: 'pre-flight only: agent-operated run; reference-machine hard rows require owner operation',
			limitations: [
				'First rAF after the saving DOM state is a presentation opportunity approximation; no trace image proves visible pixels.',
				'Event Timing uses a 16 ms threshold; missing eligible click entries are right-censored below that threshold.',
				'RunTask aggregation covers Save click through API response and is a main-thread task sum, not one contiguous block.',
				'The model file is a minimal valid retained source/derivative fixture and does not represent the full expected 15 MiB M catalog.'
			]
		};
		await writeFile(resolve(resultsDir!, 'project-lifecycle-f9-m.json'), JSON.stringify(output, null, 2));
		await testInfo.attach('project-lifecycle-f9-m.json', { body: Buffer.from(JSON.stringify(output, null, 2)), contentType: 'application/json' });
		expect(samples.filter((sample) => sample.cache === 'cold')).toHaveLength(10);
		expect(samples.filter((sample) => sample.cache === 'warm')).toHaveLength(10);
		expect(samples.filter((sample) => sample.cache === 'repeat-use')).toHaveLength(10);
		expect(samples.every((sample) => sample.wireBytes > 0 && sample.projectVersion > 1)).toBe(true);
	} finally {
		await setupContext.close().catch(() => undefined);
		await pool.end().catch(() => undefined);
	}
});
