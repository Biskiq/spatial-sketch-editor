#!/usr/bin/env node
/**
 * Generate the catalogue's 192×192 engineering reference derivatives (E7).
 * They are regression references, not product thumbnails.
 *
 * Each entry is drawn by the inspection host on `/dev/materials`, twice,
 * in separate page loads on WebGPU; differing bytes fail the run. Files are
 * named by entry and key, and the manifest records each file's SHA-256.
 *
 * Usage (from `apps/editor`, with the dev server running):
 *   S8_GATE_BASE_URL=http://localhost:5199 node scripts/generate-material-thumbnails.mjs
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openMaterials } from './s8-e7-browser.mjs';

const BACKEND = 'webgpu';
const OUT = fileURLToPath(new URL('../static/material-thumbnails/', import.meta.url));
const MANIFEST = fileURLToPath(new URL('../src/lib/content/material-thumbnails.json', import.meta.url));

let versions;

async function capture(browser) {
	const { context, page } = await openMaterials(browser, BACKEND);
	try {
		const observed = await page.locator('main').getAttribute('data-e7-backend');
		if (observed !== BACKEND) throw new Error(`expected ${BACKEND}, observed ${observed}`);
		versions = await page.evaluate(() => window.materialInspection.versions);
		const ids = await page.evaluate(() => window.materialInspection.catalogue);
		const rows = [];
		for (const id of ids) {
			const result = await page.evaluate((entry) => window.materialInspection.thumbnail(entry), id);
			if (result.status !== 'ready') throw new Error(`${id}: ${JSON.stringify(result.issues)}`);
			rows.push({ id, key: result.key, png: Buffer.from(result.png) });
		}
		return rows;
	} finally {
		await context.close();
	}
}

const browser = await launch(BACKEND);
try {
	const first = await capture(browser);
	const second = await capture(browser);
	first.forEach((row, index) => {
		const again = second[index];
		if (again.key !== row.key || !again.png.equals(row.png)) throw new Error(`${row.id} is not deterministic`);
	});
	const previous = JSON.parse(readFileSync(MANIFEST, 'utf8')).thumbnails;
	mkdirSync(OUT, { recursive: true });
	const thumbnails = first.map(({ id, key, png }) => {
		const file = `${id}-${key}.png`;
		writeFileSync(`${OUT}${file}`, png);
		return {
			id,
			key,
			file,
			width: png.readUInt32BE(16),
			height: png.readUInt32BE(20),
			geometry: 'sphere',
			sha256: createHash('sha256').update(png).digest('hex')
		};
	});
	const current = new Set(thumbnails.map((row) => row.file));
	// Only a file this manifest itself listed is ever removed.
	for (const { file } of previous) {
		if (!current.has(file)) rmSync(`${OUT}${basename(file)}`, { force: true });
	}
	const manifest = {
		schemaVersion: 1,
		generatedBy: 'apps/editor/scripts/generate-material-thumbnails.mjs',
		purpose: 'engineering-reference',
		backend: BACKEND,
		versions,
		thumbnails
	};
	writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, '\t')}\n`);
	console.log(`${thumbnails.length} reference derivatives written`);
} finally {
	await browser.close();
}
