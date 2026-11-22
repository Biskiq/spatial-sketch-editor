/**
 * U1 acceptance sweep on the real E7 host. For one backend: render every
 * catalogue entry as a 256 px sample-tile master, then measure
 *   - clipping (<1%),
 *   - colour against the entry's unlit swatch mean (ΔE00),
 *   - all 210 pairs under F's distinctness rule (full tile and E7 central crop).
 * Usage: node scripts/u1-acceptance.mjs <webgpu|webgl2> <outDir>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { launch, openMaterials } from './s8-e7-browser.mjs';
import { E7_CENTRAL, FULL, ciede2000, comparePrepared, linToLab, linearMean, prepare, LIN } from './u1-measure.mjs';

const [backend, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const WATCH = [
	['concrete-smooth', 'concrete-polished'],
	['metal-stainless-satin', 'metal-stainless-brushed'],
	['plaster-painted', 'synthetic-plastic-matte'],
	['metal-brass-satin', 'metal-gold-satin'],
	['textile-linen', 'textile-carpet-loop']
];
const hex = (h) => [1, 3, 5].map((i) => LIN[parseInt(h.slice(i, i + 2), 16)]);

const browser = await launch(backend);
const { page, errors } = await openMaterials(browser, backend);
const catalogue = await page.evaluate(() => window.materialInspection.catalogue);
const swatches = await page.evaluate(async () => (await import('/src/lib/content/materials.ts')).materials.map((m) => [m.id, m.swatchColor ?? m.fallbackColor]));
const swatch = Object.fromEntries(swatches);
const ids = catalogue.filter((id) => id in swatch && !['plaster-warm', 'wood-walnut', 'brass-aged', 'marble-light', 'velvet-dark', 'paper-aged', 'pbr-neutral-v1'].includes(id));

const images = {};
const keys = {};
for (const id of ids) {
	const r = await page.evaluate((i) => window.materialInspection.sampleTile(i), id);
	if (r.status !== 'ready') throw new Error(`${id}: ${JSON.stringify(r)}`);
	const png = Buffer.from(r.png);
	writeFileSync(`${out}/${id}.png`, png);
	keys[id] = r.key;
	const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	images[id] = { px: data, n: info.width };
}
await browser.close();

// Responsive derivatives (XS 64 central crop, S 112, M 256), as the product derives them.
const DERIVATIVES = [
	{ id: 'xs', edge: 64, crop: 0.625 },
	{ id: 's', edge: 112, crop: 1 },
	{ id: 'm', edge: 256, crop: 1 }
];
async function derive(id, d) {
	const { px, n } = images[id];
	const size = Math.round(n * d.crop);
	const offset = Math.floor((n - size) / 2);
	const raw = sharp(px, { raw: { width: n, height: n, channels: 4 } });
	const out = await raw
		.extract({ left: offset, top: offset, width: size, height: size })
		.resize(d.edge, d.edge, { kernel: 'lanczos3' })
		.raw()
		.toBuffer();
	return { px: out, n: d.edge };
}
const bySize = {};
for (const d of DERIVATIVES) {
	const set = {};
	for (const id of ids) set[id] = prepare(...Object.values(await derive(id, d)), FULL);
	const list = [];
	for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
		const c = comparePrepared(set[ids[i]], set[ids[j]]);
		list.push({ a: ids[i], b: ids[j], ...c });
	}
	bySize[d.id] = {
		edge: d.edge,
		pairs: list.length,
		failures: list.filter((p) => p.fails).map((p) => [p.a, p.b, +p.meanPatchDeltaE00.toFixed(2), +p.luminanceSSIM.toFixed(3)]),
		minDeltaE00: Math.min(...list.map((p) => p.meanPatchDeltaE00)),
		maxClipped: Math.max(...ids.map((id) => set[id].clipped))
	};
}

const per = {};
for (const id of ids) {
	const { px, n } = images[id];
	const prep = prepare(px, n, FULL);
	const mean = linearMean(px, n);
	const lab = linToLab(mean), ref = linToLab(hex(swatch[id]));
	// Hue/chroma fidelity: the render's lightness is lighting, not colour, so
	// compare with the reference lightness substituted.
	const delta = ciede2000([ref[0], lab[1], lab[2]], ref);
	per[id] = {
		key: keys[id], clippedFull: prep.clipped, colourDeltaE00: delta,
		fullDeltaE00: ciede2000(lab, ref), lightnessRatio: lab[0] / ref[0], centreLuma: prep.centre
	};
}
const full = Object.fromEntries(ids.map((id) => [id, prepare(images[id].px, images[id].n, FULL)]));
const central = Object.fromEntries(ids.map((id) => [id, prepare(images[id].px, images[id].n, E7_CENTRAL)]));
const pairs = [];
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
	const a = ids[i], b = ids[j];
	pairs.push({ a, b, full: comparePrepared(full[a], full[b]), central: comparePrepared(central[a], central[b]) });
}
const fails = pairs.filter((p) => p.full.fails || p.central.fails);
const watch = WATCH.map(([a, b]) => pairs.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a)));
const summary = {
	backend, entries: ids.length, pairs: pairs.length,
	pairFailures: fails.map((p) => [p.a, p.b, p.full, p.central]),
	minFull: Math.min(...pairs.map((p) => p.full.meanPatchDeltaE00)),
	maxClipped: Math.max(...ids.map((id) => per[id].clippedFull)),
	maxHueChromaDE: Math.max(...ids.map((id) => per[id].colourDeltaE00)),
	watch: watch.map((p) => ({ a: p.a, b: p.b, dE: p.full.meanPatchDeltaE00, ssim: p.full.luminanceSSIM, dEcentral: p.central.meanPatchDeltaE00, ssimCentral: p.central.luminanceSSIM, fails: p.full.fails || p.central.fails })),
	derivatives: bySize,
	errors
};
writeFileSync(`${out}/acceptance.json`, JSON.stringify({ summary, per, pairs }, null, 1));
console.log(JSON.stringify(summary, null, 1));
console.table(Object.entries(per).map(([id, v]) => ({ id, clipped: +(v.clippedFull * 100).toFixed(2), hueChromaDE: +v.colourDeltaE00.toFixed(1), L: +v.lightnessRatio.toFixed(2), centre: +v.centreLuma.toFixed(0) })));
