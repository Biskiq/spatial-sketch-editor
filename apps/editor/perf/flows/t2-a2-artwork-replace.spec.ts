/**
 * T2.A2 focused saved-project browser check.
 *
 * The API is the compiled Fastify app with a task-private Postgres database and
 * the supervisor's process-local object store. The editor is the production
 * Vite preview. Only the Artwork image itself is replaced through the real Card,
 * file chooser and P20 asset routes; no application request is intercepted.
 */
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';
import {
	SCENE_UNIT_FORMAT_VERSION,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	computeEnvelopeSourceContentId,
	createEmptyCameraPayload,
	createEmptyExperiencePayload,
	createEmptyResourcePayload,
	createEmptyUnitSceneDocument,
	createProjectEnvelope,
	serializeProjectEnvelope,
	type CameraFreeSceneDocument,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import {
	SAVE_ACCEPTED_SOURCE_VERSION,
	SAVE_CONTENT_IDENTITY_SCHEME,
	type SaveAcceptedSource,
	type SaveAcknowledgement
} from '@portfolio/project-model/save';
import { TEST_AUTH_SESSION_COOKIE, loginAs } from '../../tests/e2e/test-auth';

const apiOrigin = process.env.PERF_API_ORIGIN;
const editorOrigin = process.env.PERF_BASE_URL;
const authSecret = process.env.E2E_TEST_AUTH_SECRET;

type Seed = { readonly projectId: string; readonly savedBaseToken: string };
type Png = Buffer;

function crc32(bytes: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Buffer): Buffer {
	const name = Buffer.from(type, 'ascii');
	const length = Buffer.alloc(4);
	length.writeUInt32BE(body.length);
	const checksum = Buffer.alloc(4);
	checksum.writeUInt32BE(crc32(Buffer.concat([name, body])));
	return Buffer.concat([length, name, body, checksum]);
}

/** A tiny opaque RGBA PNG; the browser decodes the same bytes it uploads. */
function png(width: number, height: number, [red, green, blue, alpha]: readonly number[]): Png {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	header[9] = 6;
	header[10] = 0;
	header[11] = 0;
	header[12] = 0;
	const rowBytes = width * 4 + 1;
	const raw = Buffer.alloc(rowBytes * height);
	for (let y = 0; y < height; y += 1) {
		const start = y * rowBytes;
		raw[start] = 0;
		for (let x = 0; x < width; x += 1) {
			const offset = start + 1 + x * 4;
			raw[offset] = red!;
			raw[offset + 1] = green!;
			raw[offset + 2] = blue!;
			raw[offset + 3] = alpha!;
		}
	}
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', Buffer.alloc(0))
	]);
}

async function apiJson<T>(
	method: 'GET' | 'POST' | 'PUT' | 'DELETE',
	path: string,
	body: unknown,
	cookie: string
): Promise<T> {
	const response = await fetch(`${apiOrigin}${path}`, {
		method,
		headers: {
			Accept: 'application/json',
			Cookie: cookie,
			Origin: editorOrigin!,
			...(body === undefined ? {} : { 'Content-Type': 'application/json' })
		},
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const text = await response.text();
	if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
	return JSON.parse(text) as T;
}

async function saveProject(
	projectId: string,
	project: ProjectEnvelope,
	precondition: SaveAcceptedSource['precondition'],
	cookie: string
): Promise<SaveAcknowledgement> {
	const capture: SaveAcceptedSource = {
		protocol: SAVE_ACCEPTED_SOURCE_VERSION,
		projectId,
		operationId: `t2a2-replace-${randomUUID()}`,
		precondition,
		sourceKind: UNIT_SOURCE_KIND,
		sourceVersion: UNIT_SOURCE_VERSION,
		acceptedRevision: project.acceptedRevision,
		sourceContentId: await computeEnvelopeSourceContentId(project),
		canonicalJson: serializeProjectEnvelope(project)
	};
	return apiJson<SaveAcknowledgement>('PUT', `/projects/${encodeURIComponent(projectId)}`, {
		contentIdentityScheme: SAVE_CONTENT_IDENTITY_SCHEME,
		capture
	}, cookie);
}

function projectEnvelope(input: {
	readonly projectId: string;
	readonly name: string;
	readonly scene: CameraFreeSceneDocument;
}): Promise<ProjectEnvelope> {
	return createProjectEnvelope({
		id: input.projectId,
		name: input.name,
		acceptedRevision: { projectId: input.projectId, revisionId: randomUUID() },
		dependencyLock: { formatVersion: 1, entries: [] },
		layout: { unitId: `${input.projectId}:layout`, data: createEmptyWallFirstLayoutDocument() },
		scene: { unitId: `${input.projectId}:scene`, data: input.scene },
		camera: { unitId: `${input.projectId}:camera`, data: createEmptyCameraPayload() },
		experience: { unitId: `${input.projectId}:experience`, data: createEmptyExperiencePayload() },
		resources: { unitId: `${input.projectId}:resources`, data: createEmptyResourcePayload() }
	});
}

async function seedSavedFramedArtwork(): Promise<Seed> {
	const projectId = randomUUID();
	const name = `T2.A2 Replace ${projectId.slice(0, 8)}`;
	const cookie = (await loginAs({
		user: 'agent-admin',
		apiOrigin: apiOrigin!,
		secret: authSecret!,
		origin: editorOrigin!
	})).cookie;
	const initial = await projectEnvelope({ projectId, name, scene: createEmptyUnitSceneDocument() });
	const created = await saveProject(projectId, initial, { kind: 'create-only' }, cookie);

	const oldPng = png(2, 1, [255, 0, 0, 255]);
	const registered = await apiJson<{ readonly id: string }>(
		'POST', `/projects/${encodeURIComponent(projectId)}/assets`, { name: 'Wide red.png' }, cookie
	);
	const upload = await fetch(
		`${apiOrigin}/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(registered.id)}/content`,
		{
			method: 'PUT',
			headers: {
				Accept: 'application/json',
				Cookie: cookie,
				Origin: editorOrigin!,
				'Content-Type': 'application/octet-stream',
				'Content-Length': String(oldPng.length)
			},
			body: oldPng
		}
	);
	const uploaded = await upload.text();
	if (!upload.ok) throw new Error(`Asset upload failed (${upload.status}): ${uploaded}`);
	const asset = JSON.parse(uploaded) as { importState: string; sha256: string };
	if (asset.importState !== 'ready' || !/^sha256-[0-9a-f]{64}$/.test(asset.sha256)) {
		throw new Error('The saved fixture asset did not become ready');
	}

	const scene: CameraFreeSceneDocument = {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [],
		materials: [],
		artworkLibrary: [{ assetId: registered.id, name: 'Wide red', pixelWidth: 2, pixelHeight: 1 }],
		entities: [{
			kind: 'artwork',
			id: 't2-a2-replace-artwork',
			name: 'Replace QA print',
			position: [0, 1, 0],
			rotation: [0, 0, 0],
			widthMeters: 1,
			source: { kind: 'image', assetId: registered.id, pixelWidth: 2, pixelHeight: 1 },
			frame: { style: 'gallery', mat: true, color: 'walnut' }
		}]
	};
	const project = await projectEnvelope({ projectId, name, scene });
	const saved = await saveProject(projectId, project, {
		kind: 'expected-saved-base',
		token: created.savedBaseToken
	}, cookie);
	return { projectId, savedBaseToken: saved.savedBaseToken };
}

function cookieValue(pair: string): string {
	const separator = pair.indexOf('=');
	if (separator < 1) throw new Error('The test-auth helper returned no cookie pair');
	return pair.slice(separator + 1);
}

async function selectArtwork(page: Page): Promise<void> {
	const row = page.getByRole('navigation', { name: 'Project locator' })
		.getByRole('button', { name: /Replace QA print/ }).first();
	await expect(row).toBeVisible({ timeout: 60_000 });
	await row.click();
	await expect(page.getByRole('group', { name: 'Frame style' })).toBeVisible();
}

async function expectFrameRetained(page: Page): Promise<void> {
	await expect(page.getByRole('group', { name: 'Frame style' })
		.getByRole('button', { name: 'Gallery' })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('button', { name: 'Mat', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('group', { name: 'Frame colour' })
		.getByRole('button', { name: 'Walnut' })).toHaveAttribute('aria-pressed', 'true');
}

type TextureCounts = { readonly red: number; readonly green: number };

/** Decode the captured Stage image in the page and count strongly red/green pixels. */
async function textureCounts(page: Page): Promise<TextureCounts> {
	const captured = await page.locator('[aria-label="Spatial stage"] canvas').first().screenshot();
	return page.evaluate(async (base64) => {
		const image = new Image();
		image.src = `data:image/png;base64,${base64}`;
		await image.decode();
		const canvas = document.createElement('canvas');
		canvas.width = image.width;
		canvas.height = image.height;
		const context = canvas.getContext('2d');
		if (context === null) throw new Error('No 2D context for the Stage capture');
		context.drawImage(image, 0, 0);
		const cropX = Math.floor(image.width * 0.3);
		const cropY = Math.floor(image.height * 0.3);
		const cropWidth = Math.max(1, Math.floor(image.width * 0.4));
		const cropHeight = Math.max(1, Math.floor(image.height * 0.4));
		const pixels = context.getImageData(cropX, cropY, cropWidth, cropHeight).data;
		let red = 0;
		let green = 0;
		for (let index = 0; index < pixels.length; index += 4) {
			const r = pixels[index]!;
			const g = pixels[index + 1]!;
			const b = pixels[index + 2]!;
			const a = pixels[index + 3]!;
			if (a < 200) continue;
			if (r > 150 && r > g + 80 && r > b + 80) red += 1;
			if (g > 150 && g > r + 80 && g > b + 80) green += 1;
		}
		return { red, green };
	}, captured.toString('base64'));
}

async function waitForTexture(page: Page, colour: 'red' | 'green'): Promise<void> {
	await expect.poll(async () => (await textureCounts(page))[colour], {
		timeout: 30_000,
		intervals: [500, 1_000, 2_000]
	}).toBeGreaterThan(80);
}

test('T2.A2 Replace image keeps the frame and survives undo, redo, save and reopen', async ({ browser }) => {
	test.skip(apiOrigin === undefined || editorOrigin === undefined || authSecret === undefined,
		'requires the local API/preview supervisor');
	test.setTimeout(240_000);
	const project = await seedSavedFramedArtwork();
	const greenPng = png(2, 2, [0, 255, 0, 255]);
	const context = await browser.newContext({
		viewport: { width: 1920, height: 1080 },
		deviceScaleFactor: 1,
		serviceWorkers: 'block'
	});
	let savedBaseToken = project.savedBaseToken;
	const errors: string[] = [];
	try {
		const session = await loginAs({
			user: 'agent-admin',
			apiOrigin: apiOrigin!,
			secret: authSecret!,
			origin: editorOrigin!
		});
		await context.addCookies([{
			name: TEST_AUTH_SESSION_COOKIE,
			value: cookieValue(session.cookie),
			domain: new URL(editorOrigin!).hostname,
			path: '/',
			httpOnly: true,
			secure: false
		}]);
		const page = await context.newPage();
		page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
		page.on('pageerror', (error) => errors.push(error.message));

		await page.goto(`/project/${encodeURIComponent(project.projectId)}/spatial`);
		await expect(page.locator('[aria-label="Spatial stage"] canvas').first()).toBeVisible({ timeout: 90_000 });
		await selectArtwork(page);
		await expect(page.getByLabel('Height (cm)')).toHaveValue('50');
		await expect(page.getByText(/overall 124\.0 × 74\.0 cm/)).toBeVisible();
		await expectFrameRetained(page);
		await waitForTexture(page, 'red');
		await page.screenshot({ path: '/tmp/t2-a2-replace-old.png' });

		const subjectActions = page.getByRole('button', { name: 'Subject actions' });
		await expect(subjectActions).toBeVisible();
		if ((await subjectActions.getAttribute('aria-expanded')) !== 'true') await subjectActions.click();
		const replace = page.locator('[data-card-action="artwork-replace"]');
		await expect(replace).toBeVisible();
		const chooserPromise = page.waitForEvent('filechooser');
		await replace.click();
		const chooser = await chooserPromise;
		await chooser.setFiles({ name: 'square-green.png', mimeType: 'image/png', buffer: greenPng });

		await expect(page.getByLabel('Height (cm)')).toHaveValue('100', { timeout: 60_000 });
		await expect(page.getByText(/overall 124\.0 × 124\.0 cm/)).toBeVisible();
		await expectFrameRetained(page);
		await waitForTexture(page, 'green');
		await page.screenshot({ path: '/tmp/t2-a2-replace-green.png' });

		const undo = page.getByRole('button', { name: 'Undo', exact: true });
		await expect(undo).toBeEnabled();
		await undo.click();
		await expect(page.getByLabel('Height (cm)')).toHaveValue('50');
		await expect(page.getByText(/overall 124\.0 × 74\.0 cm/)).toBeVisible();
		await waitForTexture(page, 'red');

		const redo = page.getByRole('button', { name: 'Redo', exact: true });
		await expect(redo).toBeEnabled();
		await redo.click();
		await expect(page.getByLabel('Height (cm)')).toHaveValue('100');
		await waitForTexture(page, 'green');

		const saveButton = page.locator('[data-head-save] button').first();
		await expect(saveButton).toBeEnabled({ timeout: 90_000 });
		const saveResponsePromise = page.waitForResponse(
			(response) => response.url() === `${apiOrigin}/projects/${encodeURIComponent(project.projectId)}` &&
				response.request().method() === 'PUT',
			{ timeout: 90_000 }
		);
		await saveButton.click();
		const saveResponse = await saveResponsePromise;
		if (!saveResponse.ok()) throw new Error(`Save failed (${saveResponse.status()}): ${await saveResponse.text()}`);
		savedBaseToken = (await saveResponse.json() as SaveAcknowledgement).savedBaseToken;
		await expect(page.locator('[data-head-save]')).toHaveAttribute('data-save-status', 'saved', { timeout: 90_000 });

		await page.reload();
		await expect(page.locator('[aria-label="Spatial stage"] canvas').first()).toBeVisible({ timeout: 90_000 });
		await selectArtwork(page);
		await expect(page.getByLabel('Height (cm)')).toHaveValue('100');
		await expect(page.getByText(/overall 124\.0 × 124\.0 cm/)).toBeVisible();
		await expectFrameRetained(page);
		await waitForTexture(page, 'green');
		await page.screenshot({ path: '/tmp/t2-a2-replace-saved.png' });
		expect(errors).toEqual([]);
	} finally {
		await context.close();
		try {
			await apiJson('DELETE', `/projects/${encodeURIComponent(project.projectId)}`, {
				precondition: { kind: 'expected-saved-base', token: savedBaseToken }
			}, await loginAs({
				user: 'agent-admin',
				apiOrigin: apiOrigin!,
				secret: authSecret!,
				origin: editorOrigin!
			}).then((session) => session.cookie));
		} catch (error) {
			console.warn('T2.A2 fixture cleanup failed:', error instanceof Error ? error.message : error);
		}
	}
});
