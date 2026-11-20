/**
 * Records the E0 environment evidence for the S8 characterization baseline.
 *
 * E0 freezes descriptors, fixture bytes and evaluation inputs. This script
 * records the machine, browser, display cadence, GPU/WebGL capabilities, cache
 * state and the browser's canonical-hash check so a later appearance change can
 * be separated from a different environment. It does not capture pixels.
 *
 * Run from `apps/editor`:
 *   node scripts/record-s8-baseline-environment.mjs [--out <path>]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { cpus, arch, platform, release, totalmem } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const NEUTRAL_JSON =
	'{"color":"#ffffff","mapping":{"kind":"target","metric":{"offset":[0,0],"rotation":0,"tileMeters":[1,1]}},"maps":{},"metalness":0,"normalScale":1,"occlusionStrength":1,"profile":"pbr-metallic-roughness/v1","roughness":0.5}';
const NEUTRAL_HASH = 'sha256-ce95db1ce6fb2381d7ff4542e05f83b857599e8dc673ca01d082cfc129c973bc';

const HERE = dirname(fileURLToPath(import.meta.url));
const defaultOut = resolve(
	HERE,
	'../../../docs/roadmap/t2-look-atmosphere/s8-professional-material-foundation/evidence/e0-environment.json'
);
const outIndex = process.argv.indexOf('--out');
const out = outIndex > 0 ? resolve(process.argv[outIndex + 1]) : defaultOut;

const revision = (() => {
	try {
		return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
	} catch {
		return null;
	}
})();

const server = createServer((_request, response) => {
	response.setHeader('content-type', 'text/html; charset=utf-8');
	response.end('<!doctype html><html><body></body></html>');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
	viewport: { width: 1280, height: 720 },
	deviceScaleFactor: 1,
	colorScheme: 'light',
	reducedMotion: 'no-preference'
});
const page = await context.newPage();
await page.goto(origin);

const probe = await page.evaluate(async (neutralJson) => {
	const raf = await new Promise((resolve) => {
		const intervals = [];
		let previous = performance.now();
		const tick = (now) => {
			intervals.push(now - previous);
			previous = now;
			if (intervals.length >= 120) resolve(intervals);
			else requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
	const sorted = [...raf].sort((a, b) => a - b);
	const median = sorted[Math.floor(sorted.length / 2)];

	const canvas = document.createElement('canvas');
	const gl = canvas.getContext('webgl2');
	let webgl2 = null;
	if (gl) {
		const ext = gl.getExtension('WEBGL_debug_renderer_info');
		webgl2 = {
			vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
			renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
			version: gl.getParameter(gl.VERSION),
			shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
			maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE)
		};
	}
	let webgpu = null;
	if (navigator.gpu) {
		try {
			const adapter = await navigator.gpu.requestAdapter();
			if (adapter) {
				const info = adapter.info ?? (await adapter.requestAdapterInfo?.()) ?? {};
				webgpu = {
					vendor: info.vendor ?? null,
					architecture: info.architecture ?? null,
					device: info.device ?? null,
					description: info.description ?? null,
					features: [...adapter.features].sort()
				};
			}
		} catch (error) {
			webgpu = { error: String(error) };
		}
	}
	const bytes = new TextEncoder().encode(neutralJson);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

	return {
		userAgent: navigator.userAgent,
		platform: navigator.platform,
		hardwareConcurrency: navigator.hardwareConcurrency ?? null,
		deviceMemoryGb: navigator.deviceMemory ?? null,
		dpr: window.devicePixelRatio,
		viewport: { width: window.innerWidth, height: window.innerHeight },
		display: {
			samples: raf.length,
			medianFrameMs: median,
			estimatedHz: median > 0 ? 1000 / median : null,
			minFrameMs: sorted[0],
			maxFrameMs: sorted[sorted.length - 1]
		},
		webgl2,
		webgpu,
		hashOracle: { canonicalJson: neutralJson, browserDigest: `sha256-${hex}` }
	};
}, NEUTRAL_JSON);

const browserVersion = browser.version();
await browser.close();
await new Promise((resolve) => server.close(resolve));

const evidence = {
	schemaVersion: 1,
	recordedAt: new Date().toISOString(),
	repositoryRevision: revision,
	host: {
		platform: platform(),
		arch: arch(),
		release: release(),
		cpu: cpus()[0]?.model ?? null,
		logicalCores: cpus().length,
		totalMemoryBytes: totalmem(),
		node: process.version
	},
	browser: {
		name: 'Chromium (Playwright)',
		version: browserVersion,
		headless: true,
		launchArgs: ['default'],
		profile: 'fresh ephemeral context; no extensions, no service worker, no persisted cache',
		cacheState: 'cold at page load; the probe requests no network resources',
		viewport: { width: 1280, height: 720 },
		deviceScaleFactor: 1,
		colorScheme: 'light',
		reducedMotion: 'no-preference'
	},
	probe: {
		...probe,
		hashOracle: {
			...probe.hashOracle,
			expected: NEUTRAL_HASH,
			matches: probe.hashOracle.browserDigest === NEUTRAL_HASH
		}
	},
	backend: {
		actual: 'not exercised: E0 records descriptors and evaluation inputs; PR B measures the unified renderer on both backends',
		available: {
			webgl2: probe.webgl2 !== null,
			webgpu: probe.webgpu !== null && probe.webgpu.error === undefined
		}
	},
	limitations: [
		'Headless Chromium frame cadence is not a physical display measurement.',
		'Headless WebGL2 uses the SwiftShader software rasterizer on this host; it is not the Apple M2 GPU.',
		'No WebGPU adapter was exposed by default headless Chromium on this host.',
		'The product canvas was not rendered in E0; pixel-level appearance remains PR B evidence.'
	]
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(out);
console.log(JSON.stringify({ hashMatches: evidence.probe.hashOracle.matches, webgl2: evidence.backend.available.webgl2, webgpu: evidence.backend.available.webgpu }));
