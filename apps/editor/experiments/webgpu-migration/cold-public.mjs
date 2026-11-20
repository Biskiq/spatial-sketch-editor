#!/usr/bin/env node
/**
 * PR 1 cold published-production baseline.
 *
 * The plan asks for a cleared-cache navigation to the fixed gallery payload on
 * the ordinary production build. This harness builds and serves the app with
 * `vite preview`, serves one synthetic P20 publication from a loopback API, and
 * loads `/p/<id>` in a fresh browser context ten times. Each context has the
 * HTTP cache disabled, so every sample is a cold navigation.
 *
 * The measured boundary is the product's `visitor:first-frame` mark:
 * `renderer.info.render.frame` advanced after the surface mounted. That is the
 * earliest observable scheduling point after a draw; it is not physical
 * presentation. The harness records the distinction rather than renaming it.
 *
 * Nothing here ships. Run from `apps/editor`:
 *   npm run webgpu:cold
 * Set WEBGPU_SKIP_BUILD=1 to reuse the existing production build.
 */
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '../..');
const repoRoot = resolve(appRoot, '../..');
const baseline = 'apps/editor/experiments/webgpu-migration/baseline';
const fixturePath = join(repoRoot, baseline, 'current-world.public.project.json');
const summaryPath = join(repoRoot, baseline, 'current-world.summary.json');
const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const project = JSON.parse(readFileSync(fixturePath, 'utf8'));
const artwork = summary.artwork.map((entry) => ({
	...entry,
	bytes: readFileSync(join(repoRoot, entry.path))
}));

const day = new Date().toISOString().slice(0, 10);
const evidenceDir = join(
	repoRoot,
	'docs/roadmap/t2-look-atmosphere/webgpu-renderer-migration/evidence',
	day
);
mkdirSync(evidenceDir, { recursive: true });

const PREVIEW_PORT = 4173;
const API_PORT = 4319;
const PUBLICATION_ID = '55555555-5555-4555-8555-555555555555';
const previewOrigin = `http://127.0.0.1:${PREVIEW_PORT}`;
const apiOrigin = `http://127.0.0.1:${API_PORT}`;

function sha256(bytes) {
	return `sha256-${createHash('sha256').update(bytes).digest('hex')}`;
}

function cors(response) {
	response.setHeader('access-control-allow-origin', '*');
	response.setHeader('access-control-allow-headers', '*');
	response.setHeader('access-control-allow-methods', 'GET, OPTIONS');
}

function startApi() {
	const server = createServer((request, response) => {
		cors(response);
		if (request.method === 'OPTIONS') {
			response.writeHead(204);
			response.end();
			return;
		}
		const url = new URL(request.url ?? '/', apiOrigin);
		if (url.pathname === `/publications/${PUBLICATION_ID}`) {
			response.writeHead(200, { 'content-type': 'application/json' });
			response.end(
				JSON.stringify({
					name: project.name,
					version: 1,
					revision: 1,
					document: project,
					assets: artwork.map((entry) => ({
						assetId: entry.assetId,
						mime: entry.mime,
						byteSize: entry.byteSize,
						sha256: entry.digest
					}))
				})
			);
			return;
		}
		const assetMatch = url.pathname.match(
			new RegExp(`^/publications/${PUBLICATION_ID}/versions/1/assets/([^/]+)/content$`)
		);
		if (assetMatch) {
			const entry = artwork.find((candidate) => candidate.assetId === assetMatch[1]);
			if (entry) {
				response.writeHead(200, {
					'content-type': entry.mime,
					'content-length': String(entry.bytes.byteLength)
				});
				response.end(entry.bytes);
				return;
			}
		}
		response.writeHead(404);
		response.end('not found');
	});
	return new Promise((resolvePromise, reject) => {
		server.once('error', reject);
		server.listen(API_PORT, '127.0.0.1', () => resolvePromise(server));
	});
}

async function waitForHttp(url, timeoutMs = 60_000) {
	const started = Date.now();
		for (;;) {
			try {
				const response = await fetch(url);
				if (response.ok) return;
			} catch {
				// Preview is still starting.
			}
			if (Date.now() - started > timeoutMs) {
				throw new Error(`${url} did not answer within ${timeoutMs} ms`);
			}
			await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
		}
}

function runBuild() {
	if (process.env.WEBGPU_SKIP_BUILD === '1') return;
	const result = spawnSync('npm', ['run', 'build'], {
		cwd: appRoot,
		stdio: 'inherit',
		env: { ...process.env, PUBLIC_API_ORIGIN: apiOrigin }
	});
	if (result.status !== 0) throw new Error(`Production build failed with ${result.status}`);
}

function summarize(input) {
	const values = input.filter((value) => value !== null).sort((a, b) => a - b);
	const percentile = (fraction) =>
		values.length === 0
			? null
			: values[Math.min(values.length - 1, Math.ceil(fraction * values.length) - 1)];
	return {
		count: values.length,
		p50: percentile(0.5),
		p90: percentile(0.9),
		max: values.at(-1) ?? null,
		all: values
	};
}

const api = await startApi();
let preview = null;
let browser = null;
try {
	runBuild();

	preview = spawn(
		'npx',
		['vite', 'preview', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT), '--strictPort'],
		{
			cwd: appRoot,
			stdio: 'inherit',
			env: { ...process.env, PUBLIC_API_ORIGIN: apiOrigin }
		}
	);
	await waitForHttp(`${previewOrigin}/`);

	const batches = [];
	const consoleErrors = [];
	// Two batches, each in a fresh browser process. The first batch includes
	// first-process shader/pipeline warm-up; the second is the repeat batch. Both
	// stay in the evidence instead of reporting only the friendlier one.
	for (let batchIndex = 0; batchIndex < 2; batchIndex += 1) {
		const activeBrowser = await chromium.launch({ channel: 'chrome', headless: true });
		browser = activeBrowser;
		const version = activeBrowser.version();
		const userAgent = await (async () => {
			const context = await activeBrowser.newContext();
			const page = await context.newPage();
			const agent = await page.evaluate(() => navigator.userAgent);
			await context.close();
			return agent;
		})();
		const samples = [];
		for (let run = 0; run < 10; run += 1) {
			const context = await activeBrowser.newContext({
				viewport: { width: 1280, height: 720 },
				deviceScaleFactor: 1
			});
			const page = await context.newPage();
			page.on('console', (message) => {
				if (message.type() === 'error') consoleErrors.push(message.text());
			});
			page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
			await page.addInitScript(() => {
			window.__BISKIQ_PERF__ = { enabled: true };
			window.__BISKIQ_COLD_START__ = performance.now();
			window.__BISKIQ_COLD_RENDERERS__ = [];
				window.__BISKIQ_PERF_ON_RENDERER__ = (renderer, surface) => {
					window.__BISKIQ_COLD_RENDERERS__.push({ surface, renderer });
				};
			});
			const cdp = await context.newCDPSession(page);
			await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
			const start = Date.now();
			await page.goto(`${previewOrigin}/p/${PUBLICATION_ID}`, { waitUntil: 'load' });
			try {
				await page.waitForFunction(
					() =>
						(window.__BISKIQ_PERF_RECORDS__ ?? []).some(
							(record) => record.name === 'visitor:first-frame'
						),
					null,
					{ timeout: 20_000 }
				);
			} catch (error) {
				const text = await page.locator('body').innerText().catch(() => '');
				throw new Error(
					`Cold public batch ${batchIndex} run ${run} never reached visitor:first-frame. Body: ${text.slice(0, 600)} Errors: ${consoleErrors.slice(-4).join(' | ')}`
				);
			}
			const metrics = await page.evaluate(() => {
			const records = window.__BISKIQ_PERF_RECORDS__ ?? [];
			const first = records.find((record) => record.name === 'visitor:first-frame');
			const mounted = records.find((record) => record.name === 'visitor:mounted');
			const navigation = performance.getEntriesByType('navigation')[0];
			const paint = performance.getEntriesByType('paint');
			const canvas = document.querySelector('canvas');
			return {
				coldStart: window.__BISKIQ_COLD_START__ ?? 0,
				firstFrame: first?.time ?? null,
				mounted: mounted?.time ?? null,
				navigation: navigation
					? {
							responseEnd: navigation.responseEnd,
							domContentLoadedEnd: navigation.domContentLoadedEventEnd,
							loadEventEnd: navigation.loadEventEnd
						}
					: null,
				fcp: paint.find((entry) => entry.name === 'first-contentful-paint')?.startTime ?? null,
				canvas:
					canvas === null
						? null
						: { width: canvas.width, height: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight },
				renderers: (window.__BISKIQ_COLD_RENDERERS__ ?? []).map((entry) => ({
					surface: entry.surface,
					frame: entry.renderer.info.render.frame,
					calls: entry.renderer.info.render.calls,
					triangles: entry.renderer.info.render.triangles,
					textures: entry.renderer.info.memory.textures
				})),
				resources: performance
					.getEntriesByType('resource')
					.map((entry) => ({
						name: entry.name.split('/').slice(-2).join('/'),
						transferSize: entry.transferSize,
						duration: entry.duration
					}))
					.filter((entry) => entry.transferSize > 0)
					.slice(0, 20)
			};
			});
			samples.push({
				batch: batchIndex,
				run,
				wallMs: Date.now() - start,
				firstFrameMs: metrics.firstFrame,
				mountedMs: metrics.mounted,
				...metrics
			});
			await context.close();
		}
		batches.push({
			batch: batchIndex,
			browser: { channel: 'chrome', headless: true, version, userAgent },
			samples,
			summary: summarize(samples.map((sample) => sample.firstFrameMs))
		});
		await activeBrowser.close();
		browser = null;
	}

	const samples = batches.flatMap((batch) => batch.samples);
	const values = samples.map((sample) => sample.firstFrameMs).filter((value) => value !== null);
	const report = {
		date: new Date().toISOString(),
		mode: 'A-native-webgl',
		route: '/p/:publicationId',
		previewOrigin,
		apiOrigin,
		cache: 'disabled per fresh browser context',
		browser: batches[0].browser,
		fixture: {
			sourcePath: baseline + '/current-world.project.json',
			publicPath: baseline + '/current-world.public.project.json',
			digest: summary.publicationProjection.digest,
			bytes: summary.publicationProjection.bytes,
			artwork: artwork.map((entry) => ({
				assetId: entry.assetId,
				path: entry.path,
				bytes: entry.byteSize,
				digest: entry.digest
			}))
		},
		measurement:
			'`visitor:first-frame`: renderer.info.render.frame advanced after the surface mounted; a scheduling proxy, not physical presentation.',
		batches: batches.map(({ batch, browser: batchBrowser, summary: batchSummary }) => ({
			batch,
			browser: batchBrowser,
			summary: batchSummary
		})),
		samples,
		summary: summarize(values),
		consoleErrors,
		limitations: [
			'One M2 host and branded headless Chrome only. The Intel Iris Xe-class laptop and Safari/Firefox rows remain unverified.',
			'The preview build is local and loopback, not a deployed production URL. The plan specifies the fixed local production-build connection.',
			'`visitor:first-frame` is a renderer-frame scheduling mark, not physical scanout or a screenshot-proven correct gallery image.',
			'P20 prepared publication refuses native forms, so this cold public baseline serves the explicit publication projection; the source comparator keeps the form.'
		]
	};
	writeFileSync(join(evidenceDir, 'cold-public.json'), JSON.stringify(report, null, 2));
	console.log(
		`Cold public: ${values.length} samples, p50 ${report.summary.p50?.toFixed(1)} ms, p90 ${report.summary.p90?.toFixed(1)} ms, max ${report.summary.max?.toFixed(1)} ms`
	);
	console.log('Evidence written to', join(evidenceDir, 'cold-public.json'));
} finally {
	await browser?.close();
	preview?.kill('SIGTERM');
	api.close();
}
