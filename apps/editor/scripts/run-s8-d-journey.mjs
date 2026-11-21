/**
 * T2.S8 D product journey: resource-backed Finish -> product Save -> cold
 * Load -> detached Preview -> teardown -> reopen.
 *
 * This script uses only the seeded project, the shipped editor routes and the
 * real API. It changes no application behavior.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';

const seed = JSON.parse(readFileSync('/tmp/s8-d-journey-project.json', 'utf8'));
const evidenceDir = 'docs/roadmap/t2-look-atmosphere/s8-professional-material-foundation/evidence';
const evidence = `${evidenceDir}/s8-d-product-preview.png`;

const [cookieName, ...cookieParts] = seed.cookie.split('=');
const cookieValue = cookieParts.join('=');

const browser = await chromium.launch({
	headless: true,
	args: ['--use-angle=metal', '--disable-gpu-sandbox']
});
const report = {
	projectId: seed.projectId,
	projectName: seed.projectName,
	editorOrigin: seed.editorOrigin,
	apiOrigin: seed.apiOrigin,
	assetIds: seed.assetIds,
	imageHashes: seed.imageHashes,
	save: null,
	coldLoad: null,
	preview: null,
	imageResponses: [],
	problems: []
};

function watch(page, phase) {
	page.on('pageerror', (error) => report.problems.push(`${phase} pageerror: ${error.message}`));
	page.on('console', (message) => {
		if (message.type() === 'error') report.problems.push(`${phase} console: ${message.text()}`);
	});
	page.on('response', (response) => {
		const url = response.url();
		for (const id of seed.assetIds) {
			if (url.includes(`/assets/${id}/content`)) {
				report.imageResponses.push({ phase, assetId: id, status: response.status() });
			}
		}
	});
}

async function addSession(context) {
	await context.addCookies([
		{
			name: cookieName,
			value: cookieValue,
			domain: 'localhost',
			path: '/',
			httpOnly: true,
			secure: false,
			sameSite: 'Lax'
		}
	]);
}

async function openSpatial(page) {
	await page.goto(`${seed.editorOrigin}/project/${encodeURIComponent(seed.projectId)}/spatial`, {
		waitUntil: 'domcontentloaded'
	});
	await page.locator('[data-head-preview]').waitFor({ state: 'visible', timeout: 60_000 });
	await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 60_000 });
	await page.waitForTimeout(1500);
}

// --- 1. Open the saved project and make one accepted Finish edit through the
// product's own Scene card: open Roughness & Metal and nudge the slider.
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await addSession(context);
const page = await context.newPage();
watch(page, 'edit');
await openSpatial(page);

await page.getByRole('button', { name: /D Plinth/ }).first().click();
const more = page.locator('[data-finish-more]').first();
await more.waitFor({ state: 'visible', timeout: 30_000 });
await more.click();
const roughness = page.locator('input[aria-label="Roughness"]').first();
await roughness.waitFor({ state: 'visible', timeout: 30_000 });
await roughness.focus();
const roughnessBefore = await roughness.inputValue();
await roughness.press('ArrowRight');
await page.waitForFunction(() => {
	const cap = document.querySelector('[data-head-save]');
	return cap !== null && cap.getAttribute('data-save-status') === 'dirty';
}, { timeout: 60_000 });
const roughnessAfter = await roughness.inputValue();
if (roughnessBefore === roughnessAfter) report.problems.push('Roughness edit did not change the value');

// --- 2. Product Save through the Head. Capture and inspect the exact request.
const saveRequest = page.waitForRequest(
	(request) =>
		request.method() === 'PUT' &&
		request.url().startsWith(`${seed.apiOrigin}/projects/`) &&
		!request.url().includes('/publication'),
	{ timeout: 90_000 }
);
const saveResponse = page.waitForResponse(
	(response) =>
		response.request().method() === 'PUT' &&
		response.url().startsWith(`${seed.apiOrigin}/projects/`) &&
		!response.url().includes('/publication'),
	{ timeout: 90_000 }
);
const saveButton = page.locator('[data-head-save-button]');
await saveButton.waitFor({ state: 'visible', timeout: 30_000 });
if ((await saveButton.getAttribute('aria-disabled')) === 'true') {
	report.problems.push('Save button is disabled after source replacement');
}
await saveButton.click();
const [request, response] = await Promise.all([saveRequest, saveResponse]);
const body = request.postDataJSON();
const captured = JSON.parse(body.capture.canonicalJson);
const resources = captured.units.resources.data.resources;
const textures = resources.filter((resource) => resource.kind === 'texture');
const material = resources.find((resource) => resource.kind === 'material');
if (response.status() !== 200) {
	report.problems.push(`product Save returned ${response.status()}: ${await response.text()}`);
}
if (textures.length !== 3) report.problems.push(`Save captured ${textures.length} texture resources, expected 3`);
if ((material?.material?.images ?? []).length !== 3) {
		report.problems.push('Save captured a material without three image bindings');
	}
	const sceneMaterial = captured.units.scene.data.materials.find((candidate) => candidate.id === 'finish-d');
	const savedRoughness = sceneMaterial?.overrides?.roughness ?? null;
	if (Number(savedRoughness) !== Number(roughnessAfter)) {
		report.problems.push(`Save captured roughness ${savedRoughness}, expected ${roughnessAfter}`);
	}
	if (captured.name !== seed.projectName) {
		report.problems.push(`Save captured name "${captured.name}", expected "${seed.projectName}"`);
	}
await page.waitForFunction(() => {
	const cap = document.querySelector('[data-head-save]');
	return cap !== null && cap.getAttribute('data-save-status') === 'saved';
}, { timeout: 90_000 });
report.save = {
	status: response.status(),
	name: captured.name,
	version: (await response.json()).version,
	textureResources: textures.length,
	imageBindings: (material?.material?.images ?? []).length,
	recipeHash: material?.material?.recipe === undefined ? null : material.id,
	roughnessBefore,
	roughnessAfter
};

// --- 3. Cold Load in a fresh browser context (no HTTP or renderer cache).
await context.close();
const coldContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await addSession(coldContext);
const coldPage = await coldContext.newPage();
watch(coldPage, 'cold');
const loadResponse = coldPage.waitForResponse(
	(response) =>
		response.request().method() === 'GET' &&
		response.url() === `${seed.apiOrigin}/projects/${encodeURIComponent(seed.projectId)}`,
	{ timeout: 90_000 }
);
await openSpatial(coldPage);
const loaded = await loadResponse;
if (!loaded.ok()) report.problems.push(`cold Load returned ${loaded.status()}`);
const coldImageResponses = report.imageResponses.filter(
	(entry) => entry.phase === 'cold' && entry.status === 200
);
const coldTextures = new Set(coldImageResponses.map((entry) => entry.assetId));
if (coldTextures.size !== 3) {
	report.problems.push(`cold Load fetched ${coldTextures.size} distinct images, expected 3`);
}
report.coldLoad = {
	status: loaded.status(),
	imageBytesFetched: coldImageResponses.length,
	distinctImagesFetched: [...coldTextures],
	canvasVisible: await coldPage.locator('canvas').first().isVisible()
};

// --- 4. Detached Preview: enter, render, leave, reopen, leave.
const previewButton = coldPage.locator('[data-head-preview-button]');
if ((await previewButton.getAttribute('aria-disabled')) === 'true') {
	report.problems.push('Preview button is disabled for the resource-backed project');
}
await previewButton.click();
const takeover = coldPage.locator('.preview-takeover');
await takeover.waitFor({ state: 'visible', timeout: 60_000 });
const exitButton = coldPage.locator('button.visitor-exit');
await exitButton.waitFor({ state: 'visible', timeout: 60_000 });
const guided = coldPage.getByRole('button', { name: /Take the guided tour/ });
const guidedOffered = await guided.isVisible().catch(() => false);
if (guidedOffered) await guided.click();
await coldPage.locator('.visitor-caption').waitFor({ state: 'visible', timeout: 60_000 });
const previewCanvas = takeover.locator('canvas').first();
await previewCanvas.waitFor({ state: 'visible', timeout: 60_000 });
await coldPage.waitForTimeout(1200);
await previewCanvas.screenshot({ path: evidence });
const stats = await sharp(evidence).stats();
const stdev = stats.channels.map((channel) => channel.stdev);
const maxChannelStdev = Math.max(...stdev);
if (!(maxChannelStdev > 5)) {
	report.problems.push(`preview canvas looks blank: channel stdev max ${maxChannelStdev}`);
}
report.preview = {
	firstEntry: 'visible',
	guidedTourOffered: guidedOffered,
	canvasChannelStdev: stdev.map((value) => Number(value.toFixed(2))),
	screenshot: evidence
};

await exitButton.click();
await takeover.waitFor({ state: 'hidden', timeout: 30_000 });
const stageVisibleAfterExit = await coldPage.locator('.stage canvas').first().isVisible().catch(() => false);
if (!stageVisibleAfterExit) report.problems.push('Stage canvas did not return after Preview exit');

await previewButton.click();
await takeover.waitFor({ state: 'visible', timeout: 60_000 });
const exitAgain = coldPage.locator('button.visitor-exit');
await exitAgain.waitFor({ state: 'visible', timeout: 60_000 });
const guidedAgain = coldPage.getByRole('button', { name: /Take the guided tour/ });
if (await guidedAgain.isVisible().catch(() => false)) await guidedAgain.click();
await coldPage.locator('.visitor-caption').waitFor({ state: 'visible', timeout: 60_000 });
await coldPage.keyboard.press('Escape');
await takeover.waitFor({ state: 'hidden', timeout: 30_000 });
const stageVisibleAfterEscape = await coldPage.locator('.stage canvas').first().isVisible().catch(() => false);
if (!stageVisibleAfterEscape) report.problems.push('Stage canvas did not return after Escape from reopened Preview');
report.preview.reopen = 'visible';
report.preview.teardown = {
	exitButtonReturnsStage: stageVisibleAfterExit,
	escapeAfterReopenReturnsStage: stageVisibleAfterEscape
};

// Preview reuses the warm texture scope; report any bytes it did fetch.
report.preview.imageBytesFetched = report.imageResponses.filter(
	(entry) => entry.phase === 'preview' && entry.status === 200
).length;
report.imageResponses = report.imageResponses.filter((entry) => entry.phase !== 'edit');
report.verdict = report.problems.length === 0 ? 'passed' : 'failed';

await coldContext.close();
await browser.close();
writeFileSync(`${evidenceDir}/s8-d-product-journey.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.verdict !== 'passed') process.exitCode = 1;
