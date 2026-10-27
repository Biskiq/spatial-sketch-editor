/**
 * F5/F6 — creator-model import, admission and placement (T2.P02.S02 flow).
 *
 * F5: choose → admission (worker ingest, texture encode, upload, approval) with
 * long tasks, sampled peak heap, frames and chosen→placed; F6: the floor click
 * that installs one placement, at S (12 triangles) and M (~9k triangles) sizes.
 * F13: repeated place-another/delete cycles on one approved model, with post-GC
 * heap growth — the shared-instance disposal path.
 *
 * Requires the local stack, exactly like F9:
 *
 *   PERF_API_ORIGIN       e.g. http://127.0.0.1:8791 (exported as PUBLIC_API_ORIGIN
 *                         for the preview build)
 *   E2E_TEST_AUTH_SECRET  the local-only seam secret
 *   EDITOR_ORIGIN         the preview origin the API accepts
 *
 * Without them the spec skips with its reason. A reduced pass (PERF_RUNS < 10)
 * is a pre-flight measurement, never acceptance evidence; hard rows belong to
 * the owner-run reference machine.
 *
 * Not measured here, and stated in every row: GPU memory (Chromium exposes no
 * per-page GPU allocation), the worker's own time inside the ingest thread
 * (the row reports the whole admission window, not a worker split), and the
 * real-R2 transfer cost (the local object store is used).
 */

import { expect, test } from '@playwright/test';
import { Document, NodeIO } from '@gltf-transform/core';
import zlib from 'node:zlib';

import { loginAs, TEST_AUTH_SESSION_COOKIE } from '../../tests/e2e/test-auth';
import { collectMeasuredRuns, heapUsedMiB, newMeasuredSession, type MeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, RUNS, VIEWPORT, WARMUP_RUNS, passLimitations } from '../lib/config';
import {
	acceptedResultCount,
	startStarterGallery,
	gotoCreateIntent,
	uniqueProjectId,
	waitForAcceptedResult
} from '../lib/flow';
import { readLedger } from '../lib/ledger';
import { fileReport, formatRow, startReport, type ResultRow } from '../lib/report';
import { summarize } from '../lib/stats';

const apiOrigin = process.env.PERF_API_ORIGIN;
const secret = process.env.E2E_TEST_AUTH_SECRET;

type ModelSize = 'S' | 'M';

function isLoopbackOrigin(origin: string | undefined): boolean {
	if (origin === undefined) return false;
	try {
		const hostname = new URL(origin).hostname;
		return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
	} catch {
		return false;
	}
}

/* --- fixtures, built in memory so no binary enters Git ------------------- */

function crc32(buf: Buffer): number {
	let c = 0xffffffff;
	for (const byte of buf) {
		c ^= byte;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	}
	return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, crc]);
}

function solidPng(size: number, rgb: readonly [number, number, number]): Buffer {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(size, 0);
	header.writeUInt32BE(size, 4);
	header[8] = 8;
	header[9] = 2;
	const row = Buffer.alloc(1 + size * 3);
	for (let x = 0; x < size; x++) {
		row[1 + x * 3] = rgb[0];
		row[2 + x * 3] = rgb[1];
		row[3 + x * 3] = rgb[2];
	}
	const raw = Buffer.concat(Array.from({ length: size }, () => row));
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		pngChunk('IHDR', header),
		pngChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
		pngChunk('IEND', Buffer.alloc(0))
	]);
}

function boxGeometry(): { positions: number[]; normals: number[]; uvs: number[]; indices: number[] } {
	const positions: number[] = [];
	const normals: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];
	const faces = [
		{ n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
		{ n: [0, 0, -1], c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
		{ n: [1, 0, 0], c: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
		{ n: [-1, 0, 0], c: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
		{ n: [0, 1, 0], c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
		{ n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] }
	];
	for (const face of faces) {
		const base = positions.length / 3;
		for (const corner of face.c) positions.push(...corner);
		for (let i = 0; i < 4; i++) normals.push(...face.n);
		uvs.push(0, 1, 1, 1, 1, 0, 0, 0);
		indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
	}
	return { positions, normals, uvs, indices };
}

function sphereGeometry(radius: number, segments: number, rings: number) {
	const positions: number[] = [];
	const normals: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];
	for (let ring = 0; ring <= rings; ring++) {
		const v = ring / rings;
		const phi = v * Math.PI;
		for (let segment = 0; segment <= segments; segment++) {
			const u = segment / segments;
			const theta = u * Math.PI * 2;
			const x = Math.sin(phi) * Math.cos(theta);
			const y = Math.cos(phi);
			const z = Math.sin(phi) * Math.sin(theta);
			positions.push(x * radius, y * radius, z * radius);
			normals.push(x, y, z);
			uvs.push(u, 1 - v);
		}
	}
	for (let ring = 0; ring < rings; ring++) {
		for (let segment = 0; segment < segments; segment++) {
			const a = ring * (segments + 1) + segment;
			const b = a + segments + 1;
			indices.push(a, b, a + 1, b, b + 1, a + 1);
		}
	}
	return { positions, normals, uvs, indices };
}

async function modelGlb(size: ModelSize): Promise<Buffer> {
	const geometry = size === 'S' ? boxGeometry() : sphereGeometry(1.5, 96, 48);
	const doc = new Document();
	const buffer = doc.createBuffer();
	const texture = doc
		.createTexture('paint')
		.setImage(solidPng(512, size === 'S' ? [200, 90, 60] : [70, 130, 180]))
		.setMimeType('image/png');
	const material = doc.createMaterial('paint').setBaseColorTexture(texture).setMetallicFactor(0);
	const primitive = doc
		.createPrimitive()
		.setMaterial(material)
		.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(geometry.positions)).setBuffer(buffer))
		.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(geometry.normals)).setBuffer(buffer))
		.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(geometry.uvs)).setBuffer(buffer))
		.setIndices(
			doc
				.createAccessor()
				.setType('SCALAR')
				.setArray(
					geometry.positions.length / 3 > 65535
						? new Uint32Array(geometry.indices)
						: new Uint16Array(geometry.indices)
				)
				.setBuffer(buffer)
		);
	const mesh = doc.createMesh(size).addPrimitive(primitive);
	doc.createScene('scene').addChild(doc.createNode(size).setMesh(mesh));
	return Buffer.from(await new NodeIO().writeBinary(doc));
}

/* --- product steps ------------------------------------------------------- */

function importButton(page: import('@playwright/test').Page) {
	return page.locator('.contributed-item button.item-row', { hasText: 'Import model…' }).first();
}

async function openImport(page: import('@playwright/test').Page): Promise<void> {
	await importButton(page).click();
	await expect(page.locator('#creator-model-file')).toBeVisible();
}

async function saveProject(page: import('@playwright/test').Page): Promise<void> {
	const save = page.locator('[data-head-save] button').first();
	await expect(save).toBeEnabled();
	await save.click();
	await expect
		.poll(() => page.locator('[data-head-save]').getAttribute('data-save-status'), { timeout: 60_000 })
		.toBe('saved');
}

async function floorPoint(page: import('@playwright/test').Page) {
	const box = await page.locator('canvas').first().boundingBox();
	if (box === null) throw new Error('the Stage has no canvas box');
	return { x: box.x + box.width * 0.62, y: box.y + box.height * 0.46 };
}

/** Choose, read, approve and place one model; returns the measured phases. */
async function importAndPlaceOnce(session: MeasuredSession, glb: Buffer, size: ModelSize) {
	const { page, cdp } = session;
	const projectId = uniqueProjectId(`f5${size}`);
	await gotoCreateIntent(page, projectId);
	await startStarterGallery(page);
	await saveProject(page);

	await openImport(page);
	const ledgerBefore = await readLedger(page);
	const heapBefore = await heapUsedMiB(cdp);
	const start = await page.evaluate(() => performance.now());
	let peakHeap = heapBefore;
	let polling = true;
	const sampler = (async () => {
		while (polling) {
			try {
				const { usedSize } = await cdp.send('Runtime.getHeapUsage');
				peakHeap = Math.max(peakHeap, usedSize / (1024 * 1024));
			} catch {
				// A closed session ends the sample; the row keeps what it has.
			}
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	})();
	try {
		await page.locator('#creator-model-file').setInputFiles({
			name: `perf-${size.toLowerCase()}.glb`,
			mimeType: 'model/gltf-binary',
			buffer: glb
		});
		await page.getByRole('button', { name: 'Read model' }).click();
		await expect(page.locator('section[aria-label="Import report"]')).toBeVisible({ timeout: 120_000 });
	} finally {
		polling = false;
		await sampler;
	}
	const admittedAt = await page.evaluate(() => performance.now());
	const heapAfter = await heapUsedMiB(cdp);
	const ledgerAfterAdmission = await readLedger(page);
	const longTasks = ledgerAfterAdmission.longTasks.filter(
		(entry) => entry.start >= start && entry.start <= admittedAt
	);
	const frames = ledgerAfterAdmission.ticks.filter((tick) => tick >= start && tick <= admittedAt).length;
	expect(ledgerAfterAdmission.records.length).toBeGreaterThanOrEqual(ledgerBefore.records.length);

	await page.getByRole('button', { name: 'Approve and place' }).click();
	// The import instrument closes and the Scene place instrument opens on the
	// accepted arm; the panel's own root is a stable signal, its hint text is not.
	await expect(page.locator('.scene-instrument')).toBeVisible({ timeout: 120_000 });
	const armedAt = await page.evaluate(() => performance.now());

	const point = await floorPoint(page);
	const before = await acceptedResultCount(page);
	await page.mouse.click(point.x, point.y);
	await waitForAcceptedResult(page, before);
	const placedAt = await page.evaluate(() => performance.now());

	return {
		admissionMs: admittedAt - start,
		approveMs: armedAt - admittedAt,
		floorToAcceptedMs: placedAt - armedAt,
		chosenToPlacedMs: placedAt - start,
		longTaskCount: longTasks.length,
		longTaskMs: longTasks.reduce((total, entry) => total + entry.duration, 0),
		longestTaskMs: longTasks.reduce((max, entry) => Math.max(max, entry.duration), 0),
		frames,
		heapBeforeMiB: heapBefore,
		heapPeakMiB: peakHeap,
		heapAfterMiB: heapAfter,
		heapDeltaMiB: heapAfter - heapBefore
	};
}

/* --- spec ---------------------------------------------------------------- */

test.describe('F5/F6 creator-model import and placement', () => {
	test.setTimeout(1_800_000);
	test.skip(apiOrigin === undefined || secret === undefined, 'requires PERF_API_ORIGIN + E2E_TEST_AUTH_SECRET (local stack only)');
	test.skip(apiOrigin !== undefined && !isLoopbackOrigin(apiOrigin), 'PERF_API_ORIGIN must be a loopback local API');
	test('admission and floor placement, S and M, cold/warm/repeat-use', async ({ browser, baseURL }, testInfo) => {
		test.skip(!isLoopbackOrigin(baseURL), 'PERF_BASE_URL must be a loopback local preview');
		const origin = apiOrigin!;
		const login = await loginAs({ user: 'agent-admin', apiOrigin: origin, secret: secret!, origin: baseURL });
		const pair = login.cookie;
		const equals = pair.indexOf('=');
		expect(pair.slice(0, equals)).toBe(TEST_AUTH_SESSION_COOKIE);
		const cookie = {
			name: pair.slice(0, equals),
			value: pair.slice(equals + 1),
			domain: new URL(baseURL!).hostname,
			path: '/',
			httpOnly: true,
			secure: false
		};
		const models: Record<ModelSize, Buffer> = { S: await modelGlb('S'), M: await modelGlb('M') };
		const report = startReport(`f5f6-import-${testInfo.project.name.replace(/\s+/g, '-')}`);

		for (const size of ['S', 'M'] as const) {
			for (const cacheState of ['cold', 'warm', 'repeat-use'] as const) {
				const { results: runs, facts } = await collectMeasuredRuns(
					browser,
					{ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR, network: NETWORK },
					{
						cacheState,
						warmup: WARMUP_RUNS,
						runs: RUNS,
						prepare: async (session) => session.context.addCookies([cookie])
					},
					(session) => importAndPlaceOnce(session, models[size], size)
				);
				expect(runs, `${cacheState} run count`).toHaveLength(RUNS);
				const row: ResultRow = {
					id: `F5F6-import-${size}-${cacheState}`,
					flow: 'F5/F6 import, admission and floor placement',
					workload: `${size} generated model (${size === 'S' ? '12' : '~9k'} triangles, 512 px map), one Save, one approved placement`,
					cacheState,
					network: NETWORK,
					browser: `${testInfo.project.name} ${facts.chromeVersion}`,
					cpuRate: 1,
					viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
					metrics: { runs: runs.length },
					stats: {
						admission: summarize(runs.map((run) => run.admissionMs)),
						approve: summarize(runs.map((run) => run.approveMs)),
						floorToAccepted: summarize(runs.map((run) => run.floorToAcceptedMs)),
						chosenToPlaced: summarize(runs.map((run) => run.chosenToPlacedMs)),
						longTaskMs: summarize(runs.map((run) => run.longTaskMs)),
						longestTaskMs: summarize(runs.map((run) => run.longestTaskMs)),
						frames: summarize(runs.map((run) => run.frames)),
						heapBeforeMiB: summarize(runs.map((run) => run.heapBeforeMiB)),
						heapPeakMiB: summarize(runs.map((run) => run.heapPeakMiB)),
						heapAfterMiB: summarize(runs.map((run) => run.heapAfterMiB)),
						heapDeltaMiB: summarize(runs.map((run) => run.heapDeltaMiB))
					},
					limitations: [
						...passLimitations(),
						'admission is one wall-clock window across the lazy worker, upload, approval and arming; the worker thread time is not split out',
						'peak heap is sampled every 100 ms without GC; before/after are post-GC and are the comparable numbers',
						'GPU memory is not exposed by Chromium; no GPU row is claimed',
						'local loopback API and object store; no production transfer baseline'
					]
				};
				report.rows.push(row);
				console.log(formatRow(row));
			}
		}
		const path = fileReport(report);
		console.log(`raw results: ${path}`);
		expect(report.rows).toHaveLength(6);
	});
});

test.describe('F13 repeated import place/undo', () => {
	test.setTimeout(1_800_000);
	test.skip(apiOrigin === undefined || secret === undefined, 'requires PERF_API_ORIGIN + E2E_TEST_AUTH_SECRET (local stack only)');
	test('ten place-another/undo cycles with post-GC heap growth', async ({ browser, baseURL }, testInfo) => {
		test.skip(!isLoopbackOrigin(baseURL), 'PERF_BASE_URL must be a loopback local preview');
		const origin = apiOrigin!;
		const login = await loginAs({ user: 'agent-admin', apiOrigin: origin, secret: secret!, origin: baseURL });
		const pair = login.cookie;
		const equals = pair.indexOf('=');
		expect(pair.slice(0, equals)).toBe(TEST_AUTH_SESSION_COOKIE);
		const session = await newMeasuredSession(browser, {
			viewport: VIEWPORT,
			deviceScaleFactor: DEVICE_SCALE_FACTOR,
			network: NETWORK,
			cacheState: 'warm'
		});
		try {
			await session.context.addCookies([
				{
					name: pair.slice(0, equals),
					value: pair.slice(equals + 1),
					domain: new URL(baseURL!).hostname,
					path: '/',
					httpOnly: true,
					secure: false
				}
			]);
			const { page, cdp } = session;
			const projectId = uniqueProjectId('f13');
			await gotoCreateIntent(page, projectId);
			await startStarterGallery(page);
			await saveProject(page);
			await openImport(page);
			await page.locator('#creator-model-file').setInputFiles({
				name: 'perf-s.glb',
				mimeType: 'model/gltf-binary',
				buffer: await modelGlb('S')
			});
			await page.getByRole('button', { name: 'Read model' }).click();
			await expect(page.locator('section[aria-label="Import report"]')).toBeVisible({ timeout: 120_000 });
			await page.getByRole('button', { name: 'Approve and place' }).click();
			await expect(page.locator('.scene-instrument')).toBeVisible({ timeout: 120_000 });
			const point = await floorPoint(page);
			const first = await acceptedResultCount(page);
			await page.mouse.click(point.x, point.y);
			await waitForAcceptedResult(page, first);
			await page.keyboard.press('Escape');

			const heaps: number[] = [await heapUsedMiB(cdp)];
			for (let cycle = 0; cycle < 10; cycle++) {
				await openImport(page);
				await page.getByRole('button', { name: 'Place another' }).first().click();
				await expect(page.locator('.scene-instrument')).toBeVisible();
				const beforePlace = await acceptedResultCount(page);
				await page.mouse.click(point.x, point.y);
				await waitForAcceptedResult(page, beforePlace);

				// The Compose Delete task needs a canonical Scene-entity selection,
				// and a placed creator model is not selected by any reachable path yet
				// (recorded as a gap in the slice acceptance). The Head's Undo reverses
				// exactly the accepted install this cycle made — entity removal through
				// the same accepted-history path — so the churn measured here is the
				// instance, its render objects and its resolution, not Delete's own UI.
				await page.keyboard.press('Escape');
				const beforeUndo = await acceptedResultCount(page);
				await page.getByRole('button', { name: 'Undo', exact: true }).click();
				await waitForAcceptedResult(page, beforeUndo);
				heaps.push(await heapUsedMiB(cdp));
			}
			const growth = heaps[heaps.length - 1]! - heaps[0]!;
			// The launched binary's version; the device descriptor's UA names Playwright's Chromium.
			const facts = { chromeVersion: browser.version() };
			const row: ResultRow = {
				id: 'F13-import-place-undo-repeat-use',
				flow: 'F13 repeated import place/undo',
				workload: 'S generated model, one import then 10 × (place another + Undo), post-GC heap each cycle',
				cacheState: 'repeat-use',
				network: NETWORK,
				browser: `${testInfo.project.name} ${facts.chromeVersion}`,
				cpuRate: 1,
				viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
				metrics: {
					cycles: 10,
					heapBaselineMiB: heaps[0],
					heapFinalMiB: heaps[heaps.length - 1],
					heapGrowthMiB: growth,
					heapPerCycle: heaps.map((value) => Number(value.toFixed(2))).join(',')
				},
				stats: { heapAfterGCDistribution: summarize(heaps) },
				limitations: [
					...passLimitations(),
					'one warm context; the first import and its approved model stay resident by design, so growth is instance churn, not first-load',
					'removal is the Head Undo of the accepted placement, not the Compose Delete task: a placed creator model is not canonically selectable through the shipped UI yet',
					'identical pixels are not asserted; the accepted-result count proves each cycle installed and reversed one result',
					'GPU memory is not exposed by Chromium'
				]
			};
			const report = startReport(`f13-import-${testInfo.project.name.replace(/\s+/g, '-')}`);
			report.rows.push(row);
			console.log(formatRow(row));
			const path = fileReport(report);
			console.log(`raw results: ${path}`);
			expect(heaps).toHaveLength(11);
		} finally {
			await session.close();
		}
	});
});
