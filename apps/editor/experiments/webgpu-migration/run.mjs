#!/usr/bin/env node
/**
 * Owner-run PR 1 WebGPU harness.
 *
 * Bundles `api/main.ts` with esbuild, serves it from a loopback HTTP origin
 * (WebGPU needs a secure context), runs the qualification scenarios and,
 * optionally, the matched A/B/C performance fixture in branded Chrome, then
 * writes the evidence JSON.
 *
 *   node experiments/webgpu-migration/run.mjs
 *   node experiments/webgpu-migration/run.mjs --qualification
 *   node experiments/webgpu-migration/run.mjs --performance
 *
 * This is not part of the test or build pipeline.
 */
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '../..');
const repoRoot = resolve(appRoot, '../..');
const mode = process.argv.includes('--qualification')
	? 'qualification'
	: process.argv.includes('--performance')
		? 'performance'
		: 'both';

const day = new Date().toISOString().slice(0, 10);
const evidenceDir = join(
	repoRoot,
	'docs/roadmap/t2-look-atmosphere/webgpu-renderer-migration/evidence',
	day
);
mkdirSync(evidenceDir, { recursive: true });

const STATIC_ROOT = join(appRoot, 'static');

function mimeFor(path) {
	if (path.endsWith('.png')) return 'image/png';
	if (path.endsWith('.webp')) return 'image/webp';
	if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
	if (path.endsWith('.glb')) return 'model/gltf-binary';
	if (path.endsWith('.json')) return 'application/json';
	return 'application/octet-stream';
}

function serveStatic(request, response) {
	const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
	const file = join(STATIC_ROOT, pathname);
	if (!file.startsWith(STATIC_ROOT)) {
		response.writeHead(403);
		response.end('forbidden');
		return true;
	}
	try {
		const bytes = readFileSync(file);
		response.writeHead(200, {
			'content-type': mimeFor(pathname),
			'content-length': String(bytes.byteLength),
			'cache-control': 'no-store'
		});
		response.end(bytes);
	} catch {
		response.writeHead(404);
		response.end('not found');
	}
	return true;
}

function serve() {
	const html = '<!doctype html><html><head><meta charset="utf-8"><title>WebGPU migration harness</title></head><body style="margin:0;background:#101820"><p style="font:12px monospace;color:#9aa">WebGPU qualification harness</p></body></html>';
	const server = createServer((request, response) => {
		if (request.url === '/favicon.ico') {
			response.writeHead(204);
			response.end();
			return;
		}
		if (request.url === '/' || request.url === '/index.html') {
			response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
			response.end(html);
			return;
		}
		if (request.url.startsWith('/textures/') || request.url.startsWith('/museum/')) {
			serveStatic(request, response);
			return;
		}
		response.writeHead(404);
		response.end('not found');
	});
	return new Promise((resolvePromise) => {
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			resolvePromise({ server, origin: `http://127.0.0.1:${address.port}` });
		});
	});
}

const compiled = await build({
	entryPoints: [join(here, 'api/main.ts')],
	bundle: true,
	write: false,
	minify: false,
	format: 'iife',
	platform: 'browser',
	target: 'chrome126',
	define: { 'process.env.NODE_ENV': '"production"' },
	logLevel: 'warning'
});
const script = compiled.outputFiles[0].text;

const { server, origin } = await serve();
const browser = await chromium.launch({
	channel: 'chrome',
	headless: true,
	args: ['--enable-unsafe-webgpu']
});
const context = await browser.newContext({
	viewport: { width: 1280, height: 720 },
	deviceScaleFactor: 1
});
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (message) => {
	if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

try {
	await page.goto(origin, { waitUntil: 'load' });
	const addScriptStart = Date.now();
	await page.addScriptTag({ content: script });
	await page.waitForFunction(() => typeof window.__BISKIQ_WEBGPU__ !== 'undefined', null, { timeout: 30_000 });
	const coldAddScriptMs = Date.now() - addScriptStart;
	const startup = await page.evaluate(() => ({
		moduleStart: window.__BISKIQ_WEBGPU__.moduleStart,
		timeOrigin: performance.timeOrigin,
		now: performance.now(),
		userAgent: navigator.userAgent,
		platform: navigator.platform,
		hardwareConcurrency: navigator.hardwareConcurrency,
		devicePixelRatio: window.devicePixelRatio,
		secureContext: isSecureContext
	}));

	const environment = {
		date: day,
		origin,
		browserChannel: 'chrome',
		headless: true,
		browserVersion: browser.version(),
		coldAddScriptMs,
		...startup
	};
	writeFileSync(join(evidenceDir, 'environment.json'), JSON.stringify(environment, null, 2));

	if (mode === 'qualification' || mode === 'both') {
		console.log('Running qualification scenarios…');
		page.setDefaultTimeout(240_000);
		const qualification = await page.evaluate(() => window.__BISKIQ_WEBGPU__.runQualification());
		writeFileSync(join(evidenceDir, 'qualification.json'), JSON.stringify(qualification, null, 2));
		const counts = qualification.scenarios.reduce(
			(accumulator, entry) => {
				accumulator[entry.status] = (accumulator[entry.status] ?? 0) + 1;
				return accumulator;
			},
			{}
		);
		console.log('Qualification:', counts);
		for (const entry of qualification.scenarios) {
			const failed = entry.assertions.filter((item) => !item.ok);
			console.log(`  ${entry.status.toUpperCase()} ${entry.id} (${entry.backend})`);
			for (const item of failed) console.log(`    FAIL ${item.name}: ${item.detail ?? ''}`);
		}
	}

	if (mode === 'performance' || mode === 'both') {
		console.log('Running A/B/C performance fixture (about three minutes)…');
		page.setDefaultTimeout(600_000);
		const performanceReport = await page.evaluate(() => window.__BISKIQ_WEBGPU__.runPerformance());
		writeFileSync(join(evidenceDir, 'performance.json'), JSON.stringify(performanceReport, null, 2));
		for (const row of performanceReport.rows) {
			console.log(
				`  ${row.mode}: init ${row.startup.initP50.toFixed(1)} ms, submitted draw ${row.startup.firstDrawSubmittedP50.toFixed(
					1
				)} ms, verified frame ${row.startup.firstVerifiedFrameP50.toFixed(
					1
				)} ms, steady p50 ${row.steady.map((window) => window.intervalP50.toFixed(1)).join('/')} ms`
			);
		}
		console.log(
			`  gallery texture ${performanceReport.fixture.galleryTexture.path}: ${performanceReport.fixture.galleryTexture.bytes} B, ${performanceReport.fixture.galleryTexture.digest}`
		);
	}

	if (consoleErrors.length > 0) {
		writeFileSync(join(evidenceDir, 'console-errors.json'), JSON.stringify(consoleErrors, null, 2));
		console.log(`${consoleErrors.length} console error(s) recorded.`);
	}
	console.log('Evidence written to', evidenceDir);
} finally {
	await browser.close();
	server.close();
}
