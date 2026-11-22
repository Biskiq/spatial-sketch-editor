#!/usr/bin/env node
/**
 * Generate the catalogue's 256×256 sample-tile masters (U1).
 *
 * Each entry is drawn by the inspection host on `/dev/materials` with the
 * `sample-tile/1` recipe and its catalogue framing hint, twice, in separate
 * page loads on WebGPU; differing bytes fail the run. Files are named by entry
 * and key, and the manifest records each file's SHA-256. E7's 192 px references
 * (`generate-material-thumbnails.mjs`) are a different set and stay untouched.
 *
 * Usage (from `apps/editor`, with the dev server running):
 *   S8_GATE_BASE_URL=http://localhost:5199 node scripts/generate-material-tiles.mjs
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openMaterials } from './s8-e7-browser.mjs';

const BACKEND = 'webgpu';
const OUT = fileURLToPath(new URL('../static/material-tiles/', import.meta.url));
const MANIFEST = fileURLToPath(new URL('../src/lib/content/material-tiles.json', import.meta.url));

let versions;
let recipe;

async function capture(browser) {
	const { context, page } = await openMaterials(browser, BACKEND);
	try {
		const observed = await page.locator('main').getAttribute('data-e7-backend');
		if (observed !== BACKEND) throw new Error(`expected ${BACKEND}, observed ${observed}`);
		versions = await page.evaluate(() => window.materialInspection.versions);
		recipe = await page.evaluate(() => window.materialInspection.sampleTileRecipe);
		const ids = await page.evaluate(() => window.materialInspection.catalogue);
		const rows = [];
		for (const id of ids) {
			const result = await page.evaluate((entry) => window.materialInspection.sampleTile(entry), id);
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
	const previous = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')).tiles : [];
	mkdirSync(OUT, { recursive: true });
	const tiles = first.map(({ id, key, png }) => {
		const file = `${id}-${key}.png`;
		writeFileSync(`${OUT}${file}`, png);
		return {
			id,
			key,
			file,
			width: png.readUInt32BE(16),
			height: png.readUInt32BE(20),
			sha256: createHash('sha256').update(png).digest('hex')
		};
	});
	const current = new Set(tiles.map((row) => row.file));
	// Only a file this manifest itself listed is ever removed.
	for (const { file } of previous) {
		if (!current.has(file)) rmSync(`${OUT}${basename(file)}`, { force: true });
	}
	const manifest = {
		schemaVersion: 1,
		generatedBy: 'apps/editor/scripts/generate-material-tiles.mjs',
		purpose: 'product-sample-tile-master',
		recipe,
		backend: BACKEND,
		versions,
		tiles
	};
	writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, '\t')}\n`);
	console.log(`${tiles.length} sample-tile masters written`);
} finally {
	await browser.close();
}
