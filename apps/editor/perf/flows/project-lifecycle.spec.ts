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
import { attributeSaveOwnedWork, attributeSaveTrace, findSaveFeedbackPresentation } from '../lib/save-trace';
import { clockAnchor, startChromeTrace, type TraceEvent } from '../lib/trace-proof';
import { resolveTracePresentation } from '../lib/trace-presentation';
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
type FixtureSize = 'S' | 'M';
type SaveSample = {
	size: FixtureSize;
	cache: 'cold' | 'warm' | 'repeat-use';
	index: number;
	clickMs: number;
	commandMs: number;
	requestMs: number;
	receiptMs: number;
	clickToCommandMs: number;
	commandToRequestMs: number;
	requestToReceiptMs: number;
	savingDomMutationMs: number;
	savingPaintBoundaryMs: number;
	savingPaintLabel: string;
	feedbackMs: number;
	feedbackEvidence: {
		kind: 'trace-screenshot-exact-frame-reported-presented';
		screenshotEventPageMs: number;
		presentedPageMs: number;
		sourceId: number;
		frameSequence: number;
		clockSpreadMs: number;
	};
	feedbackOpportunityMs: number | null;
	eventTimingMs: number | null;
	eventTimingCensoredBelowMs: number;
	saveAttributedMainThreadWorkMs: number;
	saveSyncScopeUnionMs: number;
	saveFeedbackTaskWorkMs: number;
	saveWorkOverlapMs: number;
	saveFeedbackTaskCount: number;
	saveWorkPhases: Array<{ phase: string; elapsedMs: number }>;
	saveAsyncWallPhases: Array<{ phase: string; elapsedMs: number }>;
	mainThreadRunTaskWindowWorkMs: number;
	mainThreadRunTaskWindowTaskCount: number;
	mainThreadRunTaskWindowClickToCommandWorkMs: number;
	mainThreadRunTaskWindowCommandToRequestWorkMs: number;
	mainThreadRunTaskWindowRequestToReceiptWorkMs: number;
	mainThreadRunTaskWindowBlockingWorkMs: number;
	mainThreadRunTaskWindowBlockingTaskCount: number;
	mainThreadRunTaskWindowMaxTaskMs: number;
	backgroundRendererWorkMs: number;
	backgroundRendererTaskCount: number;
	clickToReceiptMs: number;
	wireBytes: number;
	serverTimingMs: number | null;
	resourceTimingMs: number | null;
	predictedReceiptAllowanceMs: number;
	projectVersion: number;
	projectId: string;
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
		await expect(renameDialog).toHaveAttribute('aria-modal', 'true');
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
		await expect(deleteDialog).toHaveAttribute('aria-modal', 'true');
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

test('F9 S/M Save workload records presented feedback, renderer work, and durable receipts in branded Chrome', async ({ browser, baseURL }, testInfo) => {
	test.setTimeout(2_400_000);
	if (!baseURL) throw new Error('PERF_BASE_URL is required');
	expect(testInfo.project.name).toBe('chrome');
	const pool = new Pool({ connectionString: databaseUrl, max: 4 });
	const auth = await authenticate(baseURL);
	const setupContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
	await setupContext.addInitScript(perfInitScript, {});
	await setupContext.addCookies([cookieForBrowser(auth.cookie, baseURL)]);
	const setupPage = await setupContext.newPage();
	const samples: SaveSample[] = [];
	const screenshots: string[] = [];
	let browserVersionFacts: Record<string, unknown> = {};
	let machineFacts: Record<string, unknown> = {};
	try { machineFacts = JSON.parse(process.env.PERF_MACHINE_FACTS ?? '{}') as Record<string, unknown>; } catch { machineFacts = {}; }
	const uaFacts = await setupPage.evaluate(() => ({
		userAgent: navigator.userAgent,
		platform: navigator.platform,
		userAgentDataPlatform: (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? null
	}));
	expect(uaFacts.userAgent).toMatch(/Chrome\//);
	expect(uaFacts.userAgent).not.toMatch(/Edg\//);
	expect(uaFacts.platform).toMatch(/Mac/);
	if (uaFacts.userAgentDataPlatform !== null) expect(uaFacts.userAgentDataPlatform).toBe('macOS');
	const facts = {
		flow: 'F9 Save',
		fixtures: {
			S: { grid: 3, walls: 24, openings: 24, rooms: 9, modelSourceFiles: 0, approvedDerivatives: 0 },
			M: { grid: 7, walls: 112, openings: 112, rooms: 49, modelSourceFiles: 1, approvedDerivatives: 1,
				modelSource: 'minimal valid GLB retained source', derivative: 'minimal valid GLB approved derivative' }
		},
		browser: {
			project: testInfo.project.name,
			playwrightVersion: browser.version(),
			...uaFacts,
			chromeCliVersion: machineFacts.chromeCliVersion ?? null,
			cdpVersion: browserVersionFacts
		},
		machine: machineFacts,
		viewport: { width: 1920, height: 1080 },
		deviceScaleFactor: 1,
		input: 'mouse',
		reducedMotion: 'no-preference',
		network: { profile: 'N1', latencyMs: N1.latencyMs, uploadBytesPerSecond: N1.uploadBytesPerSecond, downloadBytesPerSecond: N1.downloadBytesPerSecond },
		cpuRate: 1,
		powerQualification: {
			observedPowerSource: machineFacts.powerSource ?? 'unavailable',
			lowPowerMode: machineFacts.lowPowerMode ?? 'unavailable',
			matchesBatteryReferenceCondition: machineFacts.powerSource === 'Battery Power' && machineFacts.lowPowerMode === false
		},
		operatorDisposition: 'automated AC-powered observation accepted for this slice under the owner ruling dated 2026-10-25',
		measurements: samples
	};
	const cdp = await setupContext.newCDPSession(setupPage);
	try {
		browserVersionFacts = await cdp.send('Browser.getVersion');
	} finally {
		await cdp.detach();
	}
	const cliChromeVersion = /Google Chrome ([\d.]+)/.exec(String(machineFacts.chromeCliVersion ?? ''))?.[1];
	const cdpChromeVersion = /Chrome\/([\d.]+)/.exec(String(browserVersionFacts.product ?? ''))?.[1];
	expect(cdpChromeVersion).toBe(cliChromeVersion);
	facts.browser.cdpVersion = browserVersionFacts;
	await setupPage.bringToFront();
	try {
		await setupPage.goto('/projects');
		await expect(setupPage.getByRole('button', { name: 'New Project' })).toBeVisible();

		async function createWorkload(size: FixtureSize) {
			await setupPage.goto('/projects');
			await expect(setupPage.getByRole('button', { name: 'New Project' })).toBeVisible();
			const generated = await fixtureProject(size, await openProjectFromHub(setupPage));
			await openSourceJson(setupPage, generated);
			await saveThroughHead(setupPage, generated.projectId);
			let modelKeys: { sourceKey: string; derivativeKey: string } | null = null;
			if (size === 'M') modelKeys = await attachApprovedModel(setupPage, pool, generated);
			await openFromHub(setupPage, generated.projectId, generated.envelope.name);
			if (size === 'M') {
				await expect.poll(async () => {
					const rows = await pool.query('SELECT source_keys FROM model_revisions WHERE project_id = $1', [generated.projectId]);
					return rows.rows[0]?.source_keys?.length ?? 0;
				}).toBe(1);
			}
			return { fixture: generated, modelKeys };
		}

		const workloads = {
			S: await createWorkload('S'),
			M: await createWorkload('M')
		};
		await setupContext.close();

		const summarize = (values: number[]) => {
			if (!values.length) return { n: 0, p50: null, p75: null, p95: null, p99: null, max: null, spread: null };
			const sorted = [...values].sort((left, right) => left - right);
			const at = (percentile: number) => sorted[Math.min(sorted.length - 1, Math.ceil(percentile * sorted.length) - 1)]!;
			return { n: sorted.length, p50: at(0.50), p75: at(0.75), p95: at(0.95), p99: at(0.99), max: sorted.at(-1)!, spread: sorted.at(-1)! - sorted[0]! };
		};

		for (const size of ['S', 'M'] as const) {
			const { fixture, modelKeys } = workloads[size];
			let currentName = fixture.envelope.name;
			let cycleNumber = 0;
			async function lifecycleSaveRun(session: MeasuredSession, cache: SaveSample['cache'], index: number): Promise<SaveSample> {
				cycleNumber++;
				const { page, cdp } = session;
				await page.bringToFront();
				await page.goto('/projects');
				await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
				await openFromHub(page, fixture.projectId, currentName);
				const nextName = `F9 ${size} ${cache} ${String(cycleNumber).padStart(2, '0')}`;
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
				const saveButton = page.locator('[data-head-save] button').first();
				await expect(saveButton).toBeEnabled();
				const savingMarker = `save:ui:saving:${size}:${cache}:${index}:${cycleNumber}`;
				const savedMarker = `save:ui:saved:${size}:${cache}:${index}:${cycleNumber}`;
				await page.evaluate(({ savingMarker, savedMarker }) => {
					const root = window as Window & { __PROJECT_LIFECYCLE_SAVE_FEEDBACK__?: {
						click: number; mutation: number; savedMutation: number; frame: number; paintLabel: string | null;
						statuses: string[]; savingMarker: string; savedMarker: string;
					} | null };
					root.__PROJECT_LIFECYCLE_SAVE_FEEDBACK__ = null;
					document.addEventListener('click', (event) => {
						if (!(event.target instanceof Element) || !event.target.closest('[data-head-save] button')) return;
						root.__PROJECT_LIFECYCLE_SAVE_FEEDBACK__ = {
							click: performance.now(), mutation: 0, savedMutation: 0, frame: 0, paintLabel: null,
							statuses: [], savingMarker, savedMarker
						};
					}, { capture: true, once: true });
					const observer = new MutationObserver((records) => {
						const feedback = root.__PROJECT_LIFECYCLE_SAVE_FEEDBACK__;
						if (feedback == null) return;
						const saveControl = document.querySelector('[data-head-save]');
						const currentStatus = saveControl?.getAttribute('data-save-status') ?? 'missing';
						const currentLabel = saveControl?.querySelector('button')?.textContent?.trim() ?? 'missing';
						feedback.statuses.push(`${currentStatus}:${currentLabel}`);
						if (!records.some((record) => record.attributeName === 'data-save-status')) return;
						if (currentStatus === 'saving' && currentLabel === 'Saving…' && feedback.mutation === 0) {
							feedback.mutation = performance.now();
							performance.mark(feedback.savingMarker);
							// The second rAF runs after one complete render opportunity.
							// Verify the visible control still says Saving at that boundary.
							requestAnimationFrame(() => requestAnimationFrame(() => {
								const current = root.__PROJECT_LIFECYCLE_SAVE_FEEDBACK__;
								if (current == null) return;
								const paintedControl = document.querySelector('[data-head-save]');
								const paintedStatus = paintedControl?.getAttribute('data-save-status') ?? 'missing';
								const paintedLabel = paintedControl?.querySelector('button')?.textContent?.trim() ?? 'missing';
								current.statuses.push(`paint-boundary:${paintedStatus}:${paintedLabel}`);
								if (paintedStatus === 'saving' && paintedLabel === 'Saving…') {
									root.__PROJECT_LIFECYCLE_SAVE_FEEDBACK__ = { ...current, frame: performance.now(), paintLabel: paintedLabel };
								}
							}));
						}
						if (currentStatus === 'saved' && feedback.savedMutation === 0) {
							feedback.savedMutation = performance.now();
							performance.mark(feedback.savedMarker);
							observer.disconnect();
						}
					});
					observer.observe(document.documentElement, { attributes: true, attributeOldValue: true, subtree: true, attributeFilter: ['data-save-status'] });
				}, { savingMarker, savedMarker });

				const beforeLedger = await readLedger(page);
				const eventCountBefore = beforeLedger.events.length;
				const recordCountBefore = beforeLedger.records.length;
				const startTrace = await startChromeTrace(cdp, { screenshotMaxSize: 1920, screenshotMaxCount: 24 });
				let traceEvents: TraceEvent[] | null = null;
				let startAnchor;
				let endAnchor;
				let receipt: Response;
				try {
					startAnchor = await clockAnchor(page, `f9:${size}:${cache}:${index}:before`);
					const endpoint = `${apiOrigin}/projects/${encodeURIComponent(fixture.projectId)}`;
					const receiptWait = page.waitForResponse((response) => response.url() === endpoint && response.request().method() === 'PUT', { timeout: 120_000 });
					await page.locator('[data-head-save] button').first().click();
					const saveButton = page.locator('[data-head-save] button').first();
					await expect(saveButton).toHaveText('Saving…', { timeout: 2_000 });
					receipt = await receiptWait;
					if (!receipt.ok()) throw new Error(`${size} Save returned ${receipt.status()}: ${await receipt.text()}`);
					await expect(page.locator('[data-head-save]')).toHaveAttribute('data-save-status', 'saved', { timeout: 120_000 });
					await expect.poll(async () => page.evaluate(() => (window as Window & { __PROJECT_LIFECYCLE_SAVE_FEEDBACK__?: { frame: number } | null }).__PROJECT_LIFECYCLE_SAVE_FEEDBACK__?.frame ?? 0), { timeout: 2_000 }).toBeGreaterThan(0);
					endAnchor = await clockAnchor(page, `f9:${size}:${cache}:${index}:after`);
					traceEvents = await startTrace();
				} finally {
					if (traceEvents === null) await startTrace().catch(() => undefined);
				}

				const bytes = Number(receipt!.request().postDataBuffer()?.byteLength ?? 0);
				const acknowledgement = await jsonResponse(receipt!);
				const ledger = await readLedger(page);
				const operationRecords = ledger.records.slice(recordCountBefore);
				const saveMarks = operationRecords.filter((record) => record.kind === 'mark' && ['save:command', 'save:request', 'save:receipt'].includes(record.name));
				const command = [...saveMarks].reverse().find((record) => record.name === 'save:command');
				const request = [...saveMarks].reverse().find((record) => record.name === 'save:request');
				const savedMark = [...saveMarks].reverse().find((record) => record.name === 'save:receipt');
				if (!command || !request || !savedMark) throw new Error('Save ledger did not capture command, HTTP dispatch, and durable receipt');
				const feedback = await page.evaluate(() => (window as Window & { __PROJECT_LIFECYCLE_SAVE_FEEDBACK__?: {
					click: number; mutation: number; savedMutation: number; frame: number; paintLabel: string | null;
					statuses: string[]; savingMarker: string; savedMarker: string;
				} | null }).__PROJECT_LIFECYCLE_SAVE_FEEDBACK__ ?? null);
				if (!feedback || feedback.click <= 0 || feedback.mutation <= 0 || feedback.savedMutation <= 0 || feedback.frame <= 0 || feedback.paintLabel !== 'Saving…') {
					throw new Error(`Save feedback probe was incomplete: ${JSON.stringify({ feedback, status: await page.locator('[data-head-save]').getAttribute('data-save-status'), label: await page.locator('[data-head-save] button').first().textContent() })}`);
				}
				const boundaries = { clickMs: feedback.click, commandMs: command.time, requestMs: request.time, receiptMs: savedMark.time };
				const attribution = attributeSaveTrace(traceEvents!, [startAnchor!, endAnchor!], boundaries);
				const saveOwnedWork = attributeSaveOwnedWork(traceEvents!, attribution.clockOffsetMs, operationRecords, [feedback.savingMarker, feedback.savedMarker]);
				const presentation = findSaveFeedbackPresentation(traceEvents!, attribution.clockOffsetMs, feedback.click, feedback.mutation, feedback.frame, savedMark.time);
				if (!presentation) {
					const screenshots = traceEvents!.filter((event) => event.name === 'Screenshot' && typeof event.args?.snapshot === 'string');
					const reporters = traceEvents!.filter((event) => event.name === 'PipelineReporter');
					const diagnostic = {
						boundaries,
						clock: { offsetMs: attribution.clockOffsetMs, spreadMs: attribution.clockSpreadMs },
						feedback,
						screenshotCount: screenshots.length,
						screenshots: screenshots.map((event) => {
							const resolved = resolveTracePresentation(event, traceEvents!);
							return {
								screenshotEventPageMs: event.ts / 1000 - attribution.clockOffsetMs,
								sourceId: event.args?.source_id ?? null,
								frameSequence: event.args?.frame_sequence ?? null,
								presentationStatus: resolved.status,
								presentationPageMs: resolved.traceTimeUs === null ? null : resolved.traceTimeUs / 1000 - attribution.clockOffsetMs
							};
						}),
						pipelineReporterCount: reporters.length,
						pipelineReporterStates: [...new Set(reporters.map((event) => {
							const report = event.args?.frame_reporter as Record<string, unknown> | undefined;
							return String(report?.state ?? 'missing-state');
						}))],
						pipelineReporterSamples: reporters.slice(0, 40).map((event) => {
							const report = event.args?.frame_reporter as Record<string, unknown> | undefined;
							return { ph: event.ph, ts: event.ts, dur: event.dur, sourceId: report?.frame_source, frameSequence: report?.frame_sequence, state: report?.state, frameType: report?.frame_type, host: report?.layer_tree_host_id };
						})
					};
					await writeFile(resolve(resultsDir!, `project-lifecycle-f9-presentation-debug-${size.toLowerCase()}-${cache}-${index}.json`), JSON.stringify(diagnostic, null, 2));
					throw new Error(`No trace screenshot joined STATE_PRESENTED_ALL before receipt: ${JSON.stringify({ screenshotCount: screenshots.length, pipelineReporterCount: reporters.length, states: diagnostic.pipelineReporterStates })}`);
				}
				const endpoint = `${apiOrigin}/projects/${encodeURIComponent(fixture.projectId)}`;
				const timing = await page.evaluate((url) => {
					const item = performance.getEntriesByType('resource').filter((entry) => entry.name === url).at(-1) as PerformanceResourceTiming | undefined;
					return item ? { duration: item.duration, serverTiming: item.serverTiming.map((value) => ({ name: value.name, duration: value.duration })) } : null;
				}, endpoint);
				const relevantEvent = ledger.events.slice(eventCountBefore).find((entry) => entry.name.toLowerCase().includes('save')) ?? ledger.events.slice(eventCountBefore)[0];
				const loaded = await currentProjectState(pool, fixture.projectId);
				if (!loaded) throw new Error(`${size} fixture disappeared after Save`);
				const sample: SaveSample = {
					size, cache, index,
					clickMs: boundaries.clickMs,
					commandMs: boundaries.commandMs,
					requestMs: boundaries.requestMs,
					receiptMs: boundaries.receiptMs,
					clickToCommandMs: attribution.clickToCommandMs,
					commandToRequestMs: attribution.commandToRequestMs,
					requestToReceiptMs: attribution.requestToReceiptMs,
					feedbackMs: presentation.feedbackMs,
					savingDomMutationMs: feedback.mutation,
					savingPaintBoundaryMs: feedback.frame,
					savingPaintLabel: feedback.paintLabel,
					feedbackEvidence: {
						kind: 'trace-screenshot-exact-frame-reported-presented',
						screenshotEventPageMs: presentation.screenshotEventPageMs,
						presentedPageMs: presentation.presentedPageMs,
						sourceId: presentation.sourceId,
						frameSequence: presentation.frameSequence,
						clockSpreadMs: attribution.clockSpreadMs
					},
					feedbackOpportunityMs: feedback.frame - feedback.click,
					eventTimingMs: relevantEvent?.duration ?? null,
					eventTimingCensoredBelowMs: relevantEvent ? 0 : 16,
					saveAttributedMainThreadWorkMs: saveOwnedWork.workMs,
					saveSyncScopeUnionMs: saveOwnedWork.syncScopeUnionMs,
					saveFeedbackTaskWorkMs: saveOwnedWork.feedbackTaskWorkMs,
					saveWorkOverlapMs: saveOwnedWork.overlapMs,
					saveFeedbackTaskCount: saveOwnedWork.feedbackTaskCount,
					saveWorkPhases: saveOwnedWork.syncPhases,
					saveAsyncWallPhases: saveOwnedWork.asyncWallPhases,
					mainThreadRunTaskWindowWorkMs: attribution.mainThread.workMs,
					mainThreadRunTaskWindowTaskCount: attribution.mainThread.taskCount,
					mainThreadRunTaskWindowClickToCommandWorkMs: attribution.mainThread.clickToCommandWorkMs,
					mainThreadRunTaskWindowCommandToRequestWorkMs: attribution.mainThread.commandToRequestWorkMs,
					mainThreadRunTaskWindowRequestToReceiptWorkMs: attribution.mainThread.requestToReceiptWorkMs,
					mainThreadRunTaskWindowBlockingWorkMs: attribution.mainThread.blockingWorkMs,
					mainThreadRunTaskWindowBlockingTaskCount: attribution.mainThread.blockingTaskCount,
					mainThreadRunTaskWindowMaxTaskMs: attribution.mainThread.maxTaskMs,
					backgroundRendererWorkMs: attribution.backgroundRenderer.workMs,
					backgroundRendererTaskCount: attribution.backgroundRenderer.taskCount,
					clickToReceiptMs: attribution.operationMs,
					wireBytes: bytes,
					serverTimingMs: timing?.serverTiming.find((entry) => entry.name === 'lifecycle')?.duration ?? null,
					resourceTimingMs: timing?.duration ?? null,
					predictedReceiptAllowanceMs: (8 * bytes) / 5_000 + 2 * N1.latencyMs + 500,
					projectVersion: loaded.version,
					projectId: fixture.projectId
				};
				// Save representative trace snapshots only for the visible S/warm
				// and M cells; the S/cold snapshot can retain a prior dirty frame.
				if (index === 1 && ((size === 'S' && cache === 'warm') || size === 'M')) {
					const path = resolve(resultsDir!, `project-lifecycle-f9-feedback-${size.toLowerCase()}-${cache}.jpg`);
					await writeFile(path, new Uint8Array(Buffer.from(presentation.screenshot.args!.snapshot as string, 'base64')));
					screenshots.push(path);
				}
				await page.goto('/projects');
				return sample;
			}

			async function measuredSession(cache: SaveSample['cache'], index: number): Promise<SaveSample> {
				const session = await newMeasuredSession(browser, {
					viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, network: 'N1', cacheState: cache
				});
				try {
					await session.context.addCookies([cookieForBrowser(auth.cookie, baseURL!)]);
					return await lifecycleSaveRun(session, cache, index);
				} finally { await session.close(); }
			}

			await measuredSession('cold', 0); // one discarded cold warm-up
			for (let index = 1; index <= 10; index++) samples.push(await measuredSession('cold', index));
			for (const cache of ['warm', 'repeat-use'] as const) {
				const session = await newMeasuredSession(browser, {
					viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, network: 'N1', cacheState: cache
				});
				try {
					await session.context.addCookies([cookieForBrowser(auth.cookie, baseURL!)]);
					await lifecycleSaveRun(session, cache, 0); // one discarded warm-up
					for (let index = 1; index <= 10; index++) samples.push(await lifecycleSaveRun(session, cache, index));
				} finally { await session.close(); }
			}
		}

		const distributions = Object.fromEntries((['S', 'M'] as const).map((size) => [size,
			Object.fromEntries((['cold', 'warm', 'repeat-use'] as const).map((cache) => {
				const rows = samples.filter((sample) => sample.size === size && sample.cache === cache);
				return [cache, {
					localFeedbackPresentedMs: summarize(rows.map((row) => row.feedbackMs)),
					saveAttributedMainThreadWorkMs: summarize(rows.map((row) => row.saveAttributedMainThreadWorkMs)),
					saveSyncScopeUnionMs: summarize(rows.map((row) => row.saveSyncScopeUnionMs)),
					saveFeedbackTaskWorkMs: summarize(rows.map((row) => row.saveFeedbackTaskWorkMs)),
					mainThreadRunTaskWindowWorkMs: summarize(rows.map((row) => row.mainThreadRunTaskWindowWorkMs)),
					mainThreadRunTaskWindowBlockingWorkMs: summarize(rows.map((row) => row.mainThreadRunTaskWindowBlockingWorkMs)),
					mainThreadRunTaskWindowMaxTaskMs: summarize(rows.map((row) => row.mainThreadRunTaskWindowMaxTaskMs)),
					clickToCommandMs: summarize(rows.map((row) => row.clickToCommandMs)),
					commandToHttpRequestMs: summarize(rows.map((row) => row.commandToRequestMs)),
					httpRequestToDurableReceiptMs: summarize(rows.map((row) => row.requestToReceiptMs)),
					clickToDurableReceiptMs: summarize(rows.map((row) => row.clickToReceiptMs)),
					wireBytes: summarize(rows.map((row) => row.wireBytes)),
					serverTimingMs: summarize(rows.flatMap((row) => row.serverTimingMs === null ? [] : [row.serverTimingMs])),
					feedbackOpportunityProxyMs: summarize(rows.map((row) => row.feedbackOpportunityMs ?? 0)),
					eventTimingObserved: rows.filter((row) => row.eventTimingMs !== null).length,
					eventTimingCensoredBelow16ms: rows.filter((row) => row.eventTimingMs === null).length,
					allSamples: rows
				}];
			}))
		]));
		const output = {
			...facts,
			buildRevision: process.env.GIT_HEAD,
			apiOrigin,
			database: 'task-private local PostgreSQL database; dropped by shell trap',
			objectStore: 'same Fastify process memory store; no R2 access',
			modelKeys: workloads.M.modelKeys,
			warmupRunsPerSizeAndCacheState: 1,
			measuredRunsPerSizeAndCacheState: 10,
			trace: {
				method: 'CDP devtools.timeline + screenshot + compositor presentation reports',
				mainThreadWork: 'union of Save-owned synchronous scope timestamps plus the CrRendererMain RunTask containing the Saving and Saved DOM mutations; ambient renderer tasks during WebCrypto/network waits are excluded; overlap is unioned once',
				mainThreadRunTaskWindowWork: 'separate diagnostic union of all CrRendererMain RunTask intervals from Save click through durable receipt; includes unrelated Stage/rendering work during waits and is not a Save-work metric',
				requestBoundary: 'save:request is marked immediately before fetch after JSON request-body construction',
				backgroundRendererWork: 'same renderer process non-main-thread RunTask interval union',
				feedback: 'first screenshot after the Saving label survives one render opportunity, joined by exact source/frame identity to one STATE_PRESENTED_ALL reporter before durable receipt',
				visualEvidence: 'representative CDP trace screenshots for S/warm and M cache cells; all six cells retain exact frame-identity presentation data for every measured sample',
				physicalDisplayPresentationMs: null
			},
			statistics: distributions,
			hardBudgetDisposition: 'per-slice owner ruling dated 2026-10-25 accepts this automated run on the Mac14,2 reference machine while on AC power; numeric F9 hard budgets remain binding and are evaluated from Save-attributed work and presented-feedback p95',
			limitations: [
				'Chrome compositor presentation feedback is browser-reported and does not prove physical panel scanout.',
				'Event Timing entries have a 16 ms threshold; missing eligible click entries are right-censored below that threshold.',
				'The lifecycle M fixture is grid-7 with one scene model entity and one retained source/derivative pair. The source bytes are not posted by Save; this meets the slice plan retained-model requirement but does not reproduce the typical M fixture of 60 objects and 15 distinct GLBs.'
			]
		};
		await writeFile(resolve(resultsDir!, 'project-lifecycle-f9-s-m-branded-chrome.json'), JSON.stringify(output, null, 2));
		await testInfo.attach('project-lifecycle-f9-s-m-branded-chrome.json', { body: Buffer.from(JSON.stringify(output, null, 2)), contentType: 'application/json' });
		for (const path of screenshots) await testInfo.attach(path.split('/').at(-1)!, { path, contentType: 'image/jpeg' });
		expect(samples.filter((sample) => sample.size === 'S' && sample.cache === 'cold')).toHaveLength(10);
		expect(samples.filter((sample) => sample.size === 'S' && sample.cache === 'warm')).toHaveLength(10);
		expect(samples.filter((sample) => sample.size === 'S' && sample.cache === 'repeat-use')).toHaveLength(10);
		expect(samples.filter((sample) => sample.size === 'M' && sample.cache === 'cold')).toHaveLength(10);
		expect(samples.filter((sample) => sample.size === 'M' && sample.cache === 'warm')).toHaveLength(10);
		expect(samples.filter((sample) => sample.size === 'M' && sample.cache === 'repeat-use')).toHaveLength(10);
		expect(samples.every((sample) => sample.wireBytes > 0 && sample.projectVersion > 1 && sample.feedbackMs >= 0)).toBe(true);
	} finally {
		await setupContext.close().catch(() => undefined);
		await pool.end().catch(() => undefined);
	}
});
