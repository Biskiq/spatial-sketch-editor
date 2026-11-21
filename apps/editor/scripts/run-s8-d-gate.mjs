#!/usr/bin/env node
/**
 * T2.S8 PR D visual gate runner.
 *
 * Runs `/dev/s8-d?case=d` and `?case=b` on the observed hardware backends. Case
 * `d` is the real three-image Finish: built, serialized, cold-admitted in a new
 * session and drawn from the cold release bundle. Case `b` is the accepted B
 * path carrying the same effective inputs through a catalogue base. Both frames
 * share geometry, camera and lights, so the pair is a controlled pixel compare.
 *
 * The gate is enforcing: every required backend must report that backend, every
 * frame must be captured without page errors, and every pair must meet the
 * declared threshold. Any miss exits nonzero and records why.
 *
 * Usage (from the repository root, with the editor dev server running):
 *   node apps/editor/scripts/run-s8-d-gate.mjs
 *   node apps/editor/scripts/run-s8-d-gate.mjs --out docs/.../s8-d-gate.json
 */
import { chromium } from '@playwright/test';
import { inflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const BASE_URL = process.env.S8_D_BASE_URL ?? 'http://localhost:5199';
const OUT_INDEX = process.argv.indexOf('--out');
const OUT_PATH = OUT_INDEX >= 0 ? process.argv[OUT_INDEX + 1] : null;
const SHOT_DIR = resolve(
	process.cwd(),
	'docs/roadmap/t2-look-atmosphere/s8-professional-material-foundation/evidence'
);

/** The declared acceptance threshold for the D/B pixel comparison. */
const THRESHOLD = {
	meanAbs: 0.5,
	maxAbs: 2,
	channelSamplesOver8: 0
};

const BACKENDS = [
	{ name: 'webgl2', args: ['--use-angle=metal'], hideWebGPU: true },
	{
		name: 'webgpu',
		args: ['--enable-unsafe-webgpu', '--enable-features=WebGPU', '--use-angle=metal']
	},
	...(process.env.S8_D_INCLUDE_SOFTWARE === '1'
		? [
				{
					name: 'webgl2-swiftshader',
					args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
					hideWebGPU: true
				}
			]
		: [])
];

/** Minimal 8-bit PNG reader for Playwright screenshots (RGBA or RGB). */
function decodePng(bytes) {
	let offset = 8;
	let width = 0;
	let height = 0;
	let colorType = 6;
	const idat = [];
	while (offset < bytes.length) {
		const length = bytes.readUInt32BE(offset);
		const type = bytes.toString('ascii', offset + 4, offset + 8);
		const data = bytes.subarray(offset + 8, offset + 8 + length);
		if (type === 'IHDR') {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			const depth = data[8];
			colorType = data[9];
			const interlace = data[12];
			if (depth !== 8 || interlace !== 0 || (colorType !== 6 && colorType !== 2)) {
				throw new Error(`unsupported PNG (depth ${depth}, colour ${colorType}, interlace ${interlace})`);
			}
		} else if (type === 'IDAT') {
			idat.push(data);
		} else if (type === 'IEND') {
			break;
		}
		offset += 12 + length;
	}
	const raw = inflateSync(Buffer.concat(idat));
	const channels = colorType === 6 ? 4 : 3;
	const stride = width * channels;
	const pixels = Buffer.alloc(width * height * 4);
	let previous = Buffer.alloc(stride);
	let cursor = 0;
	for (let y = 0; y < height; y += 1) {
		const filter = raw[cursor];
		cursor += 1;
		const line = raw.subarray(cursor, cursor + stride);
		cursor += stride;
		const out = Buffer.alloc(stride);
		for (let x = 0; x < stride; x += 1) {
			const left = x >= channels ? out[x - channels] : 0;
			const up = previous[x];
			const upLeft = x >= channels ? previous[x - channels] : 0;
			const value = line[x];
			let decoded;
			switch (filter) {
				case 0:
					decoded = value;
					break;
				case 1:
					decoded = value + left;
					break;
				case 2:
					decoded = value + up;
					break;
				case 3:
					decoded = value + Math.floor((left + up) / 2);
					break;
				case 4: {
					const p = left + up - upLeft;
					const pa = Math.abs(p - left);
					const pb = Math.abs(p - up);
					const pc = Math.abs(p - upLeft);
					decoded = value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
					break;
				}
				default:
					throw new Error(`unknown PNG filter ${filter}`);
			}
			out[x] = decoded & 0xff;
		}
		for (let x = 0; x < width; x += 1) {
			const source = x * channels;
			const target = (y * width + x) * 4;
			pixels[target] = out[source];
			pixels[target + 1] = out[source + 1];
			pixels[target + 2] = out[source + 2];
			pixels[target + 3] = channels === 4 ? out[source + 3] : 255;
		}
		previous = out;
	}
	return { width, height, pixels };
}

function compare(left, right) {
	if (left.width !== right.width || left.height !== right.height) {
		return {
			comparable: false,
			reason: 'size mismatch',
			passed: false,
			threshold: THRESHOLD
		};
	}
	let total = 0;
	let max = 0;
	let overTolerance = 0;
	let compared = 0;
	for (let index = 0; index < left.pixels.length; index += 4) {
		for (let channel = 0; channel < 3; channel += 1) {
			const diff = Math.abs(left.pixels[index + channel] - right.pixels[index + channel]);
			total += diff;
			max = Math.max(max, diff);
			compared += 1;
			if (diff > 8) overTolerance += 1;
		}
	}
	const meanAbs = Number((total / compared).toFixed(4));
	const passed =
		meanAbs <= THRESHOLD.meanAbs &&
		max <= THRESHOLD.maxAbs &&
		overTolerance <= THRESHOLD.channelSamplesOver8;
	return {
		comparable: true,
		width: left.width,
		height: left.height,
		meanAbs,
		maxAbs: max,
		channelSamplesOver8: overTolerance,
		threshold: THRESHOLD,
		passed
	};
}

async function capture(browser, backend, label) {
	const context = await browser.newContext({
		viewport: { width: 512, height: 512 },
		deviceScaleFactor: 1,
		colorScheme: 'dark'
	});
	if (backend.hideWebGPU) {
		await context.addInitScript(() => {
			Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true });
		});
	}
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', (error) => errors.push(String(error)));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	try {
		await page.goto(`${BASE_URL}/dev/s8-d?case=${label}`, { waitUntil: 'domcontentloaded' });
		await page.waitForSelector('html[data-s8-d-ready="true"]', { timeout: 120_000 });
		const raw = await page.locator('main[data-s8-d]').getAttribute('data-s8-d-result');
		const observed = await page.locator('[data-canvas-host]').getAttribute('data-backend');
		const device = await page.evaluate(async () => {
			const canvas = document.createElement('canvas');
			const gl = canvas.getContext('webgl2');
			let webglRenderer = null;
			if (gl !== null) {
				const info = gl.getExtension('WEBGL_debug_renderer_info');
				webglRenderer = String(
					info === null ? gl.getParameter(gl.RENDERER) : gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
				);
			}
			let gpu = null;
			if (navigator.gpu !== undefined) {
				try {
					const adapter = await navigator.gpu.requestAdapter();
					gpu =
						adapter === null
							? null
							: {
								vendor: adapter.info?.vendor ?? null,
								architecture: adapter.info?.architecture ?? null,
								device: adapter.info?.device ?? null,
								description: adapter.info?.description ?? null
							};
				} catch (error) {
					gpu = { error: String(error) };
				}
			}
			return {
				userAgent: navigator.userAgent,
				hardwareConcurrency: navigator.hardwareConcurrency,
				webglRenderer,
				gpu
			};
		});
		const canvas = page.locator('canvas').first();
		const png = await canvas.screenshot();
		const file = resolve(SHOT_DIR, `s8-d-${backend.name}-${label}.png`);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, png);
		const result = raw === null ? null : JSON.parse(raw);
		const observedBackend = observed ?? 'unavailable';
		const images = Array.isArray(result?.images) ? result.images : [];
		const problems = [];
		if (result === null) problems.push('the page published no gate result');
		if (observedBackend !== backend.name) {
			problems.push(`requested ${backend.name}, observed ${observedBackend}`);
		}
		if (images.length !== 3) {
			problems.push(`expected 3 Finish images, observed ${images.length}`);
		}
		if (result?.textures !== 3) {
			problems.push(`expected 3 drawn texture views, observed ${result?.textures ?? 'none'}`);
		}
		if (errors.length > 0) problems.push(`page errors: ${errors.join(' | ')}`);
		return {
			requestedBackend: backend.name,
			observedBackend,
			device,
			status: problems.length === 0 ? 'captured' : 'failed',
			problems,
			result,
			screenshot: file,
			image: decodePng(png),
			errors,
			passed: problems.length === 0
		};
	} catch (error) {
		return {
			requestedBackend: backend.name,
			observedBackend: 'unavailable',
			status: 'failed',
			problems: [error instanceof Error ? error.message : String(error)],
			errors,
			passed: false
		};
	} finally {
		await context.close();
	}
}

async function runBackend(backend) {
	const browser = await chromium.launch({
		headless: true,
		args: [...backend.args, '--disable-gpu-sandbox']
	});
	try {
		const d = await capture(browser, backend, 'd');
		const b = await capture(browser, backend, 'b');
		const cases = {};
		for (const entry of [d, b]) {
			const { image, ...rest } = entry;
			cases[`${backend.name}/${rest.result?.case ?? 'unknown'}`] = rest;
		}
		const comparison =
			d.image === undefined || b.image === undefined
				? {
					comparable: false,
					reason: 'one frame was not captured',
					passed: false,
					threshold: THRESHOLD
				}
				: compare(d.image, b.image);
		const problems = [];
		if (d.status !== 'captured') problems.push(`d ${d.status}: ${(d.problems ?? []).join('; ')}`);
		if (b.status !== 'captured') problems.push(`b ${b.status}: ${(b.problems ?? []).join('; ')}`);
		if (!comparison.passed) problems.push('pixel comparison did not meet the declared threshold');
		return {
			status: problems.length === 0 ? 'passed' : 'failed',
			problems,
			cases,
			comparison,
			passed: problems.length === 0
		};
	} finally {
		await browser.close();
	}
}

async function main() {
	mkdirSync(SHOT_DIR, { recursive: true });
	const report = {
		capturedAt: new Date().toISOString(),
		baseUrl: BASE_URL,
		threshold: THRESHOLD,
		requiredBackends: BACKENDS.map((backend) => backend.name),
		backends: {},
		failures: [],
		verdict: 'not-accepted'
	};
	for (const backend of BACKENDS) {
		try {
			const outcome = await runBackend(backend);
			report.backends[backend.name] = outcome;
			if (!outcome.passed) {
				for (const problem of outcome.problems) report.failures.push(`${backend.name}: ${problem}`);
			}
			console.log(
				`${backend.name}: ${outcome.status} ` +
					`d=${outcome.cases[`${backend.name}/d`]?.status ?? 'missing'} ` +
					`b=${outcome.cases[`${backend.name}/b`]?.status ?? 'missing'} ` +
					`observed=${outcome.cases[`${backend.name}/d`]?.observedBackend ?? 'unavailable'} ` +
					`meanAbs=${outcome.comparison.meanAbs ?? 'n/a'}`
			);
		} catch (error) {
			report.backends[backend.name] = {
				status: 'failed',
				passed: false,
				problems: [error instanceof Error ? error.message : String(error)],
				cases: {},
				comparison: { passed: false, reason: 'backend could not run', threshold: THRESHOLD }
			};
			report.failures.push(
				`${backend.name}: ${error instanceof Error ? error.message : String(error)}`
			);
			console.error(`${backend.name}: failed to run: ${String(error)}`);
		}
	}
	report.cases = Object.fromEntries(
		Object.entries(report.backends).flatMap(([, outcome]) => Object.entries(outcome.cases ?? {}))
	);
	for (const backend of BACKENDS) {
		const outcome = report.backends[backend.name];
		if (outcome === undefined) {
			report.failures.push(`${backend.name}: no result`);
			continue;
		}
		for (const label of ['d', 'b']) {
			const entry = outcome.cases?.[`${backend.name}/${label}`];
			if (entry === undefined) {
				report.failures.push(`${backend.name}/${label}: no captured frame`);
				continue;
			}
			if (entry.status !== 'captured') {
				report.failures.push(`${backend.name}/${label}: ${entry.status}`);
			}
		}
		if (outcome.comparison?.passed !== true) {
			report.failures.push(`${backend.name}: pixel comparison not accepted`);
		}
	}
	report.verdict = report.failures.length === 0 ? 'accepted' : 'not-accepted';
	if (OUT_PATH !== null) {
		writeFileSync(resolve(process.cwd(), OUT_PATH), `${JSON.stringify(report, null, 2)}\n`);
	}
	console.log(JSON.stringify(report, null, 2));
	if (report.verdict !== 'accepted') {
		console.error(`S8 D gate NOT ACCEPTED: ${report.failures.join(' | ')}`);
		process.exitCode = 1;
	}
}

await main();
