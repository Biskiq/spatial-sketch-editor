import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const base = process.env.D8C_PROBE_BASE ?? 'http://127.0.0.1:5321';
const dir = new URL('./evidence/', import.meta.url);
const report = JSON.parse(await readFile(new URL('capture-report.json', dir), 'utf8'));
const names = report
	.map((entry) => entry.name)
	.filter((name) => name.includes('-close-'))
	.concat([
		'hanging-industrial-salon-webgpu-close-stripped-off-bulb-point',
		'hanging-industrial-salon-webgl2-close-stripped-off-bulb-point'
	]);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${base}/tests/e2e/d8c-probe/evidence/hanging-industrial-salon-webgpu-close-stripped-on.jpg`);

const metrics = [];
for (const name of [...new Set(names)]) {
	const url = `${base}/tests/e2e/d8c-probe/evidence/${name}.jpg`;
	const stat = await page.evaluate(async (source) => {
		const image = new Image();
		image.src = source;
		await image.decode();
		const canvas = document.createElement('canvas');
		canvas.width = image.naturalWidth;
		canvas.height = image.naturalHeight;
		const context = canvas.getContext('2d');
		context.drawImage(image, 0, 0);
		const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
		const measure = (x0, y0, x1, y1) => {
			let clipped = 0;
			let bright = 0;
			let sum = 0;
			let count = 0;
			for (let y = y0; y < y1; y += 1) {
				for (let x = x0; x < x1; x += 1) {
					const index = (y * width + x) * 4;
					const r = data[index];
					const g = data[index + 1];
					const b = data[index + 2];
					const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
					if (r > 250 && g > 250 && b > 250) clipped += 1;
					if (luma > 240) bright += 1;
					sum += luma;
					count += 1;
				}
			}
			return {
				clippedFraction: Number((clipped / count).toFixed(4)),
				brightFraction: Number((bright / count).toFixed(4)),
				meanLuma: Number((sum / count).toFixed(1))
			};
		};
		const insetX = Math.round(width * 0.25);
		const insetY = Math.round(height * 0.25);
		return {
			width,
			height,
			full: measure(0, 0, width, height),
			centre: measure(insetX, insetY, width - insetX, height - insetY)
		};
	}, url);
	metrics.push({ name, ...stat });
	console.log(name, stat.centre.clippedFraction, stat.centre.meanLuma);
}

await writeFile(new URL('exposure-metrics.json', dir), JSON.stringify(metrics, null, 2));
await browser.close();
