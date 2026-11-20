#!/usr/bin/env node
/**
 * PR 2 integrated product measurement.
 *
 * Drives the shipped published-visit route (`/p/:publicationId`) from the
 * ordinary production build, on the pinned PR 1 current-world publication.
 * It records, per backend and DPR:
 *
 * - concrete cold startup (`visitor:first-frame`) across fresh contexts;
 * - the observed renderer backend and backing-store size;
 * - a warm re-entry in the same context, kept separate from cold;
 * - an input-driven orbit sampled as animation-frame intervals;
 * - one forced device loss through the documented `onDeviceLost` hook, then a
 *   fresh generation's resumed draw (real canvas identity is compared).
 *
 * No product module imports this file; the page is the shipped route. Run from
 * `apps/editor`:
 *
 *   node experiments/webgpu-migration/pr2-product.mjs --backend=webgpu --dpr=1
 *   node experiments/webgpu-migration/pr2-product.mjs --backend=webgl2 --dpr=1
 *   node experiments/webgpu-migration/pr2-product.mjs --backend=webgpu --dpr=1.5
 *
 * `PR2_SKIP_BUILD=1` reuses `.svelte-kit/output`.
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
const project = JSON.parse(
	readFileSync(join(repoRoot, baseline, 'current-world.public.project.json'), 'utf8')
);
const summary = JSON.parse(readFileSync(join(repoRoot, baseline, 'current-world.summary.json'), 'utf8'));
const artwork = summary.artwork.map((entry) => ({
	...entry,
	bytes: readFileSync(join(repoRoot, entry.path))
}));

const arg = (name, fallback) => {
	const match = process.argv.find((value) => value.startsWith(`--${name}=`));
	return match === undefined ? fallback : match.slice(name.length + 3);
};
const backend = arg('backend', 'webgpu');
const dpr = Number(arg('dpr', '1'));
const samples = Number(arg('samples', '5'));
const batches = Number(arg('batches', '2'));
if (!['webgpu', 'webgl2'].includes(backend)) throw new Error(`unknown backend ${backend}`);
if (![1, 1.5].includes(dpr)) throw new Error(`unsupported dpr ${dpr}`);

const day = new Date().toISOString().slice(0, 10);
const evidenceDir = join(
	repoRoot,
	'docs/roadmap/t2-look-atmosphere/webgpu-renderer-migration/evidence',
	day
);
mkdirSync(evidenceDir, { recursive: true });
const evidenceName = `pr2-product-${backend}-dpr${String(dpr).replace('.', '_')}.json`;

const PREVIEW_PORT = 4173;
const API_PORT = 4319;
const PUBLICATION_ID = '55555555-5555-4555-8555-555555555555';
const previewOrigin = `http://127.0.0.1:${PREVIEW_PORT}`;
const apiOrigin = `http://127.0.0.1:${API_PORT}`;

function sha256(bytes) {
	return `sha256-${createHash('sha256').update(bytes).digest('hex')}`;
}

function startApi() {
	const server = createServer((request, response) => {
		response.setHeader('access-control-allow-origin', '*');
		response.setHeader('access-control-allow-headers', '*');
		response.setHeader('access-control-allow-methods', 'GET, OPTIONS');
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
	if (process.env.PR2_SKIP_BUILD === '1') return;
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
		p95: percentile(0.95),
		max: values.at(-1) ?? null,
		all: values
	};
}

/** Reads the newest captured renderer and its backend identity. */
const readRenderer = () => {
	const entries = window.__BISKIQ_COLD_RENDERERS__ ?? [];
	const entry = entries.at(-1);
	if (!entry) return null;
	const renderer = entry.renderer;
	const canvas = renderer.domElement;
	return {
		surface: entry.surface,
		generations: entries.length,
		isWebGPUBackend: renderer.backend?.isWebGPUBackend === true,
		isWebGLBackend: renderer.backend?.isWebGLBackend === true,
		// r187's common Info keeps a monotonic render-call counter here; the
		// legacy `info.render.frame` slot does not advance under `autoRender: false`.
		frame: renderer.info.calls,
		calls: renderer.info.render.calls,
		triangles: renderer.info.render.triangles,
		textures: renderer.info.memory.textures,
		canvas: {
			width: canvas.width,
			height: canvas.height,
			cssWidth: canvas.clientWidth,
			cssHeight: canvas.clientHeight,
			connected: canvas.isConnected
		}
	};
};

async function load(page) {
	const start = Date.now();
	await page.goto(`${previewOrigin}/p/${PUBLICATION_ID}`, { waitUntil: 'load' });
	try {
		await page.waitForFunction(
			() =>
				(window.__BISKIQ_PERF_RECORDS__ ?? []).some(
					(record) => record.name === 'visitor:first-frame'
				),
			null,
			{ timeout: 25_000 }
		);
	} catch (error) {
		const state = await page.evaluate(() => ({
			body: document.body.innerText.slice(0, 800),
			canvases: document.querySelectorAll('canvas').length,
			renderers: (window.__BISKIQ_COLD_RENDERERS__ ?? []).map((entry) => ({
				surface: entry.surface,
				size: [entry.renderer.domElement.width, entry.renderer.domElement.height],
				backend: {
					webgpu: entry.renderer.backend?.isWebGPUBackend === true,
					webgl: entry.renderer.backend?.isWebGLBackend === true
				},
				frame: entry.renderer.info.calls,
				calls: entry.renderer.info.render.calls
			})),
			records: (window.__BISKIQ_PERF_RECORDS__ ?? []).map((record) => record.name)
		}));
		await page.screenshot({ path: join(evidenceDir, 'pr2-debug.png') });
		throw new Error(`never reached visitor:first-frame: ${JSON.stringify(state)}`, { cause: error });
	}
	const metrics = await page.evaluate((readRendererSource) => {
		const read = new Function(`return (${readRendererSource})()`);
		const records = window.__BISKIQ_PERF_RECORDS__ ?? [];
		const first = records.find((record) => record.name === 'visitor:first-frame');
		const mounted = records.find((record) => record.name === 'visitor:mounted');
		const navigation = performance.getEntriesByType('navigation')[0];
		return {
			firstFrame: first?.time ?? null,
			mounted: mounted?.time ?? null,
			navigation: navigation
				? {
						responseEnd: navigation.responseEnd,
						domContentLoadedEnd: navigation.domContentLoadedEventEnd,
						loadEventEnd: navigation.loadEventEnd
					}
				: null,
			renderer: read(),
			gpu: typeof navigator.gpu !== 'undefined'
		};
	}, readRenderer.toString());
	return { wallMs: Date.now() - start, ...metrics };
}

async function orbit(page) {
	const box = await page.locator('canvas').first().boundingBox();
	if (box === null) throw new Error('no canvas to orbit');
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;
	await page.evaluate(() => {
		window.__PR2_FRAMES__ = [];
		window.__PR2_STATE__ = { active: true, last: performance.now() };
		const tick = (time) => {
			if (window.__PR2_STATE__.active !== true) return;
			window.__PR2_FRAMES__.push(time - window.__PR2_STATE__.last);
			window.__PR2_STATE__.last = time;
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
	// Idle baseline first: the display period, on the same page and backend.
	await page.waitForTimeout(1000);
	const idle = await page.evaluate(() => window.__PR2_FRAMES__.splice(0));
	const framesBefore = await page.evaluate((readRendererSource) => {
		const read = new Function(`return (${readRendererSource})()`);
		return read()?.frame ?? 0;
	}, readRenderer.toString());
	await page.mouse.move(cx, cy);
	await page.mouse.down();
	for (let step = 0; step < 50; step += 1) {
		await page.mouse.move(
			cx + Math.sin(step / 6) * Math.min(180, box.width / 4),
			cy + Math.cos(step / 8) * Math.min(70, box.height / 6)
		);
		await page.waitForTimeout(50);
	}
	await page.mouse.up();
	await page.waitForTimeout(500);
	const frames = await page.evaluate(() => {
		window.__PR2_STATE__.active = false;
		return window.__PR2_FRAMES__;
	});
	const after = await page.evaluate((readRendererSource) => {
		const read = new Function(`return (${readRendererSource})()`);
		return read();
	}, readRenderer.toString());
	return {
		idle: summarize(idle),
		orbit: summarize(frames),
		drawsDuringOrbit: (after?.frame ?? 0) - framesBefore,
		rendererAfter: after
	};
}

async function forceRecovery(page) {
	const before = await page.evaluate((readRendererSource) => {
		const read = new Function(`return (${readRendererSource})()`);
		const entry = window.__BISKIQ_COLD_RENDERERS__.at(-1);
		const canvas = entry.renderer.domElement;
		canvas.dataset.pr2Before = '1';
		return {
			generations: window.__BISKIQ_COLD_RENDERERS__.length,
			frame: entry.renderer.info.calls,
			mode: entry.renderer.backend?.isWebGLBackend === true ? 'webglcontextlost' : 'onDeviceLost',
			canvas: read()?.canvas ?? null
		};
	}, readRenderer.toString());
	await page.evaluate(() => {
		const entry = window.__BISKIQ_COLD_RENDERERS__.at(-1);
		if (entry.renderer.backend?.isWebGLBackend === true) {
			// The browser's own loss event; cancelable so the host can replace the
			// canvas instead of letting the browser restore this context.
			entry.renderer.domElement.dispatchEvent(
				new Event('webglcontextlost', { cancelable: true })
			);
			return;
		}
		entry.renderer.onDeviceLost({ message: 'pr2-forced-loss' });
	});
	let recovered = false;
	let presentedUnavailable = false;
	if (before.mode === 'webglcontextlost') {
		// The approved episode keeps a WebGL2 surface for the episode: one loss
		// presents Retry instead of looping, so assert that state and then retry.
		try {
			await page.waitForSelector('[data-renderer-unavailable]', { timeout: 25_000 });
			presentedUnavailable = true;
		} catch {
			presentedUnavailable = false;
		}
		if (presentedUnavailable) {
			await page.getByRole('button', { name: 'Retry' }).click();
		}
	}
	if (before.mode !== 'webglcontextlost' || presentedUnavailable) {
		try {
			await page.waitForFunction(
				(beforeState) => {
					const entries = window.__BISKIQ_COLD_RENDERERS__ ?? [];
					if (entries.length <= beforeState.generations) return false;
					const latest = entries.at(-1);
					return latest.renderer.info.calls > 1 && latest.renderer.domElement.dataset.pr2Before !== '1';
				},
				before,
				{ timeout: 25_000 }
			);
			recovered = true;
		} catch {
			recovered = false;
		}
	}
	await page.waitForTimeout(2_000);
	const after = await page.evaluate((readRendererSource) => {
		const read = new Function(`return (${readRendererSource})()`);
		const body = document.body.innerText;
		return {
			renderer: read(),
			unavailable: /unavailable|Retry/i.test(body),
			canvases: [...document.querySelectorAll('canvas')].map((canvas) => ({
				marked: canvas.dataset.pr2Before ?? null,
				width: canvas.width,
				height: canvas.height,
				connected: canvas.isConnected
			}))
		};
	}, readRenderer.toString());
	return { before, recovered, presentedUnavailable, after };
}

const api = await startApi();
let preview = null;
let browser = null;
try {
	runBuild();
	preview = spawn(
		'npx',
		['vite', 'preview', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT), '--strictPort'],
		{ cwd: appRoot, stdio: 'inherit', env: { ...process.env, PUBLIC_API_ORIGIN: apiOrigin } }
	);
	await waitForHttp(`${previewOrigin}/`);

	const launchArgs =
		backend === 'webgl2'
			? ['--disable-webgpu', '--disable-features=WebGPU']
			: [];
	const rows = [];
	const consoleErrors = [];
	let version = null;
	let userAgent = null;
	for (let batch = 0; batch < batches; batch += 1) {
		// One process per batch: the first page of a fresh process keeps its
		// shader/pipeline warm-up instead of hiding it in a later sample.
		browser = await chromium.launch({ channel: 'chrome', headless: true, args: launchArgs });
		if (version === null) {
			version = browser.version();
			userAgent = await (async () => {
				const context = await browser.newContext();
				const page = await context.newPage();
				const agent = await page.evaluate(() => navigator.userAgent);
				await context.close();
				return agent;
			})();
		}
		for (let run = 0; run < samples; run += 1) {
			const context = await browser.newContext({
				viewport: { width: 1280, height: 720 },
				deviceScaleFactor: dpr
			});
			const page = await context.newPage();
			page.on('console', (message) => {
				if (message.type() === 'error') consoleErrors.push(message.text());
			});
			page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.stack ?? error.message}`));
			await page.addInitScript((hideWebGpu) => {
				if (hideWebGpu) {
					// The automatic-selection path: the page is a browser without WebGPU,
					// so Three must take its WebGL2 backend with no product toggle.
					try {
						Object.defineProperty(Navigator.prototype, 'gpu', {
							value: undefined,
							configurable: true
						});
					} catch {
						// A browser without the property needs nothing.
					}
				}
				window.__BISKIQ_PERF__ = { enabled: true };
				window.__BISKIQ_COLD_START__ = performance.now();
				window.__BISKIQ_COLD_RENDERERS__ = [];
				window.__BISKIQ_PERF_ON_RENDERER__ = (renderer, surface) => {
					window.__BISKIQ_COLD_RENDERERS__.push({ surface, renderer });
				};
			}, backend === 'webgl2');
			const cdp = await context.newCDPSession(page);
			await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
			const cold = await load(page);
			const warm = await load(page);
			const motion = await orbit(page);
			if (batch === 0 && run === 0) {
				await page.screenshot({
					path: join(evidenceDir, `pr2-product-${backend}-dpr${String(dpr).replace('.', '_')}.png`)
				});
			}
			const row = { batch, run, cold, warm, motion };
			if (batch === 0 && run === 0) row.recovery = await forceRecovery(page);
			rows.push(row);
			await context.close();
		}
		await browser.close();
		browser = null;
	}

	const report = {
		date: new Date().toISOString(),
		mode: backend === 'webgl2' ? 'C-auto-fallback-webgl2' : 'B-native-webgpu',
		backend,
		dpr,
		route: '/p/:publicationId',
		previewOrigin,
		apiOrigin,
		browser: { channel: 'chrome', headless: true, version, userAgent },
		fixture: {
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
			'`visitor:first-frame` advances from `renderer.info.calls` (render invocations) and is a scheduling mark; orbit numbers are animation-frame intervals during a real pointer drag, not GPU timings or physical presentation.',
		rows,
		summary: {
			cold: summarize(rows.map((row) => row.cold.firstFrame)),
			warm: summarize(rows.map((row) => row.warm.firstFrame)),
			orbitP95: rows.map((row) => row.motion.orbit.p95),
			orbitMax: summarize(rows.map((row) => row.motion.orbit.max)),
			observedBackends: rows.map((row) => ({
				cold: {
					webgpu: row.cold.renderer?.isWebGPUBackend ?? null,
					webgl: row.cold.renderer?.isWebGLBackend ?? null,
					gpuApi: row.cold.gpu
				},
				warm: {
					webgpu: row.warm.renderer?.isWebGPUBackend ?? null,
					webgl: row.warm.renderer?.isWebGLBackend ?? null
				}
			}))
		},
		consoleErrors,
		limitations: [
			`${batches} browser processes × ${samples} cleared-cache contexts; every sample is retained, including the first page of each process.`,
			'One Apple M2 host in headless branded Chrome. The Intel Iris Xe-class laptop and Safari/Firefox rows remain unverified.',
			backend === 'webgl2'
				? 'WebGL2 is the automatic fallback: the page runs with navigator.gpu hidden (browser without WebGPU), not a product toggle. The observed backend is asserted from the initialized renderer.'
				: 'Native WebGPU was observed on every row.',
			'Stage and detached-Preview journeys need an authenticated project; they were not exercised here.',
			'Device loss uses the backend\'s own event: WebGL2 receives a cancelable webglcontextlost on its canvas; native WebGPU uses the documented onDeviceLost hook. Neither is a hardware event, but both enter the product\'s real recovery path, and the fresh-canvas and resumed-draw checks are real.'
		]
	};
	const path = join(evidenceDir, evidenceName);
	writeFileSync(path, JSON.stringify(report, null, 2));
	console.log(
		`${report.mode} DPR ${dpr}: cold p50 ${report.summary.cold.p50?.toFixed(1)} ms, p90 ${report.summary.cold.p90?.toFixed(1)} ms; warm p50 ${report.summary.warm.p50?.toFixed(1)} ms; orbit p95 ${report.summary.orbitP95.map((value) => value?.toFixed(1)).join(', ')} ms`
	);
	console.log('Evidence written to', path);
} finally {
	await browser?.close();
	preview?.kill('SIGTERM');
	api.close();
}
