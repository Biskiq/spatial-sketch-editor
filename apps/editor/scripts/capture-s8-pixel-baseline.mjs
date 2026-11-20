#!/usr/bin/env node
/**
 * T2.S8 PR B — product-canvas pixel capture.
 *
 * Captures the deterministic `/dev/s8-oracle` cases through the real product
 * representation and Canvas store. `--write` records the baseline directory;
 * the default compares the current pixels with the recorded baseline.
 *
 * The observed backend is read from the Canvas host, never inferred from the
 * flags. A backend the host does not expose is recorded as `unavailable`; the
 * script never claims parity for a backend it did not render.
 *
 * Usage (from `apps/editor`):
 *   node scripts/capture-s8-pixel-baseline.mjs --write
 *   node scripts/capture-s8-pixel-baseline.mjs --compare
 */
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync, deflateSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../tests/lib/render/materials/__fixtures__/s8/pixels');
const BASE_URL = process.env.S8_ORACLE_BASE_URL ?? 'http://localhost:5199';
const CASES = [
	'catalogue',
	's4',
	'shared',
	'treatment-natural',
	'treatment-clay',
	'treatment-flat'
];
const BACKENDS = [
	{ name: 'webgl2', query: 'backend=webgl2', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
	{
		name: 'webgpu',
		query: 'backend=webgpu',
		args: ['--enable-unsafe-webgpu', '--enable-features=WebGPU', '--use-angle=metal']
	}
];
const WRITE = process.argv.includes('--write');
const TOLERANCE = Number(process.env.S8_PIXEL_TOLERANCE ?? 3);

/** Minimal PNG decode for an 8-bit RGBA/RGB image produced by Chromium. */
function decodePng(bytes) {
	let offset = 8;
	let width = 0;
	let height = 0;
	let colourType = 6;
	const idat = [];
	while (offset < bytes.length) {
		const length = bytes.readUInt32BE(offset);
		const type = bytes.toString('ascii', offset + 4, offset + 8);
		const data = bytes.subarray(offset + 8, offset + 8 + length);
		if (type === 'IHDR') {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			colourType = data[9];
		} else if (type === 'IDAT') {
			idat.push(data);
		}
		offset += length + 12;
	}
	const raw = inflateSync(Buffer.concat(idat));
	const channels = colourType === 6 ? 4 : colourType === 2 ? 3 : 0;
	if (channels === 0) throw new Error(`unsupported PNG colour type ${colourType}`);
	const stride = width * channels;
	const pixels = new Uint8Array(width * height * 4);
	let source = 0;
	let previous = new Uint8Array(stride);
	for (let y = 0; y < height; y += 1) {
		const filter = raw[source];
		source += 1;
		const row = Uint8Array.from(raw.subarray(source, source + stride));
		source += stride;
		for (let x = 0; x < stride; x += 1) {
			const left = x >= channels ? row[x - channels] : 0;
			const up = previous[x];
			const upLeft = x >= channels ? previous[x - channels] : 0;
			let value = row[x];
			if (filter === 1) value += left;
			else if (filter === 2) value += up;
			else if (filter === 3) value += (left + up) >> 1;
			else if (filter === 4) {
				const p = left + up - upLeft;
				const pa = Math.abs(p - left);
				const pb = Math.abs(p - up);
				const pc = Math.abs(p - upLeft);
				value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
			}
			row[x] = value & 0xff;
		}
		for (let x = 0; x < width; x += 1) {
			const target = (y * width + x) * 4;
			const input = x * channels;
			pixels[target] = row[input];
			pixels[target + 1] = row[input + 1];
			pixels[target + 2] = row[input + 2];
			pixels[target + 3] = channels === 4 ? row[input + 3] : 255;
		}
		previous = row;
	}
	return { width, height, pixels };
}

/** Minimal PNG encode (RGBA8, no filtering) for the diff artefacts. */
function encodePng(width, height, pixels) {
	const stride = width * 4;
	const raw = Buffer.alloc((stride + 1) * height);
	for (let y = 0; y < height; y += 1) {
		raw[y * (stride + 1)] = 0;
		Buffer.from(pixels.subarray(y * stride, (y + 1) * stride)).copy(raw, y * (stride + 1) + 1);
	}
	const chunks = [];
	const chunk = (type, data) => {
		const length = Buffer.alloc(4);
		length.writeUInt32BE(data.length);
		const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(crc32(body) >>> 0);
		chunks.push(length, body, crc);
	};
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	header[9] = 6;
	chunk('IHDR', header);
	chunk('IDAT', deflateSync(raw));
	chunk('IEND', Buffer.alloc(0));
	return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ...chunks]);
}

let crcTable;
function crc32(buffer) {
	if (crcTable === undefined) {
		crcTable = new Uint32Array(256);
		for (let n = 0; n < 256; n += 1) {
			let c = n;
			for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			crcTable[n] = c >>> 0;
		}
	}
	let crc = 0xffffffff;
	for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	return crc ^ 0xffffffff;
}

function meanAbsoluteDifference(a, b) {
	if (a.length !== b.length) return Number.POSITIVE_INFINITY;
	let total = 0;
	for (let index = 0; index < a.length; index += 1) total += Math.abs(a[index] - b[index]);
	return total / a.length;
}

async function capture(browser, backend, name) {
	const context = await browser.newContext({
		viewport: { width: 640, height: 640 },
		deviceScaleFactor: 1,
		colorScheme: 'dark'
	});
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', (error) => errors.push(String(error)));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	await page.goto(`${BASE_URL}/dev/s8-oracle?case=${name}&${backend.query}`, {
		waitUntil: 'domcontentloaded'
	});
	await page.waitForSelector('[data-s8-oracle-ready="true"]', { timeout: 45_000 });
	const backendName = await page
		.locator('[data-canvas-host="preview"]')
		.getAttribute('data-backend');
	const shot = await page.locator('.viewport').screenshot();
	await context.close();
	return { png: shot, backend: backendName ?? 'unavailable', errors };
}

async function main() {
	mkdirSync(OUT_DIR, { recursive: true });
	const results = { capturedAt: new Date().toISOString(), cases: {} };
	const currentPngs = new Map();
	for (const backend of BACKENDS) {
		const browser = await chromium.launch({
			headless: true,
			args: [...backend.args, '--disable-gpu-sandbox']
		});
		try {
			for (const name of CASES) {
				let captured;
				try {
					captured = await capture(browser, backend, name);
				} catch (error) {
					results.cases[`${backend.name}/${name}`] = {
						requestedBackend: backend.name,
						observedBackend: 'unavailable',
						error: error instanceof Error ? error.message : String(error),
						status: 'unmeasured'
					};
					continue;
				}
				const file = `${backend.name}-${name}.png`;
				const decoded = decodePng(captured.png);
				const entry = {
					requestedBackend: backend.name,
					observedBackend: captured.backend,
					width: decoded.width,
					height: decoded.height,
					sha256: createHash('sha256').update(captured.png).digest('hex'),
					status: captured.errors.length > 0 ? 'errors' : 'captured',
					errors: captured.errors
				};
				if (captured.backend === backend.name) {
					if (WRITE) writeFileSync(resolve(OUT_DIR, file), captured.png);
					entry.file = file;
					currentPngs.set(`${backend.name}/${name}`, captured.png);
				}
				results.cases[`${backend.name}/${name}`] = entry;
			}
		} finally {
			await browser.close();
		}
	}
	if (WRITE) writeFileSync(resolve(OUT_DIR, 'capture.json'), `${JSON.stringify(results, null, 2)}\n`);

	if (!WRITE) {
		let failures = 0;
		for (const [key, entry] of Object.entries(results.cases)) {
			if (entry.status === 'unmeasured' || entry.file === undefined) {
				console.log(`unmeasured ${key}: ${entry.observedBackend}`);
				continue;
			}
			const baselinePath = resolve(OUT_DIR, entry.file);
			const currentPath = resolve(OUT_DIR, `current-${entry.file}`);
			const png = currentPngs.get(key);
			if (png === undefined) {
				console.log(`unmeasured ${key}: no current capture`);
				continue;
			}
			writeFileSync(currentPath, png);
			const baseline = decodePng(readFileSync(baselinePath));
			const current = decodePng(png);
			const difference = meanAbsoluteDifference(baseline.pixels, current.pixels);
			console.log(`${key}: mean Δ ${difference.toFixed(3)} / ${TOLERANCE}`);
			if (difference > TOLERANCE) failures += 1;
		}
		if (failures > 0) {
			console.error(`${failures} pixel case(s) outside tolerance ${TOLERANCE}`);
			process.exitCode = 1;
		}
	}
}

await main();
