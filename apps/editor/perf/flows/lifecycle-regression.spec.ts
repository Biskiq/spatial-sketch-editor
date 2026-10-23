/** Functional sensitivity proof, separate from F13's uninjected measurement. */
import { expect, test } from '@playwright/test';
import { heapUsedMiB, newMeasuredSession } from '../lib/browser';
import { acceptedResultCount, closeProjectToHub, commitPrecisionLength, openProjectFromHub, openSourceJson, waitForAcceptedResult } from '../lib/flow';
import { clearObservations } from '../lib/ledger';
import { fixtureProject } from '../lib/fixtures';

test('persistent app cycles retain an intentional leak and expose heap growth', async ({ browser }) => {
	const session = await newMeasuredSession(browser, {
		viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, network: 'N0', cacheState: 'repeat-use'
	});
	try {
		const { page } = session;
		await page.goto('/projects');
		await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
		// Warm the application before the sensitivity baseline.
		await openSourceJson(page, await fixtureProject('S', await openProjectFromHub(page)));
		await closeProjectToHub(page);
		const lifetime = await page.evaluate(() => {
			Object.assign(window, { __F13_RETAINED__: [] });
			return performance.timeOrigin;
		});
		await clearObservations(page);
		const baseline = await heapUsedMiB(session.cdp);
		for (let cycle = 1; cycle <= 3; cycle++) {
			await openSourceJson(page, await fixtureProject('S', await openProjectFromHub(page)));
			const before = await acceptedResultCount(page);
			await commitPrecisionLength(page, 4.5);
			await waitForAcceptedResult(page, before);
			await page.evaluate(() => {
				// JS arrays count in JSHeapUsedSize; ArrayBuffer backing stores may not.
				(window as Window & { __F13_RETAINED__?: number[][] }).__F13_RETAINED__!.push(
					new Array<number>(1024 * 1024).fill(42)
				);
			});
			await closeProjectToHub(page);
			expect(await page.evaluate(() => performance.timeOrigin)).toBe(lifetime);
			expect(await page.evaluate(() =>
				(window as Window & { __F13_RETAINED__?: number[][] }).__F13_RETAINED__?.length
			)).toBe(cycle);
		}
		await clearObservations(page);
		const growth = (await heapUsedMiB(session.cdp)) - baseline;
		expect(growth).toBeGreaterThan(10);
		console.log(`intentional retained-state growth: ${growth.toFixed(2)} MiB`);
		// Negative control: the old full-document close erases the retained state.
		await page.goto('/projects');
		expect(await page.evaluate(() => '__F13_RETAINED__' in window)).toBe(false);
		expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(lifetime);
	} finally {
		await session.close();
	}
});

/**
 * Collection is the oracle: the old chooser path pins the entire retired Stage,
 * even when its public element handle is disposed. Heap thresholds alone can
 * miss that owner. WeakRefs observe actual product nodes without retaining them.
 */
test('retired project nodes collect and DOM resources settle after accepted edits', async ({ browser }, testInfo) => {
	test.setTimeout(300_000);
	const session = await newMeasuredSession(browser, {
		viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, network: 'N0', cacheState: 'repeat-use'
	});
	const warnings: string[] = [];
	const errors: string[] = [];
	session.page.on('console', (message) => {
		if (message.text().includes('derived_inert')) warnings.push(message.text());
		if (/THREE\.WebGLProgram|Shader Error/.test(message.text())) errors.push(message.text());
	});
	session.page.on('pageerror', (error) => errors.push(error.message));
	try {
		const { page, cdp } = session;
		await page.goto('/projects');
		const lifetime = await page.evaluate(() => performance.timeOrigin);
		let cycleNumber = 0;
		const cycle = async () => {
			await openSourceJson(page, await fixtureProject('S', await openProjectFromHub(page)));
			await page.evaluate(() => {
				const stage = document.querySelector('[aria-label="Spatial stage"]');
				const canvas = stage?.querySelector('canvas');
				if (!stage || !canvas) throw new Error('Stage nodes were not mounted');
				const state = window as Window & { __RETIRED_PROJECT_NODES__?: WeakRef<Element>[] };
				(state.__RETIRED_PROJECT_NODES__ ??= []).push(new WeakRef(stage), new WeakRef(canvas));
			});
			for (let edit = 0; edit < 10; edit++) {
				const before = await acceptedResultCount(page);
				await commitPrecisionLength(page, edit % 2 === 0 ? 4.5 : 5);
				await waitForAcceptedResult(page, before);
			}
			if (cycleNumber === 0 || cycleNumber === 6) {
				await page.locator('canvas').screenshot({ path: testInfo.outputPath(`canvas-cycle-${cycleNumber}.png`) });
			}
			cycleNumber++;
			await closeProjectToHub(page);
			await clearObservations(page);
			expect(await page.evaluate(() => performance.timeOrigin)).toBe(lifetime);
		};
		const collected = async () => {
			await expect.poll(async () => {
				await cdp.send('HeapProfiler.collectGarbage');
				return page.evaluate(() =>
					(window as Window & { __RETIRED_PROJECT_NODES__?: WeakRef<Element>[] })
						.__RETIRED_PROJECT_NODES__?.every((ref) => ref.deref() === undefined)
				);
			}, { message: 'closed project Stage/canvas must become collectible' }).toBe(true);
		};
		await cdp.send('HeapProfiler.enable');
		await cycle();
		await collected();
		const headCounts = () => page.evaluate(() => ({
			children: document.head.childNodes.length,
			text: [...document.head.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).length
		}));
		const baseline = { heapMiB: await heapUsedMiB(cdp), ...await cdp.send('Memory.getDOMCounters'), head: await headCounts() };
		const samples = [baseline];
		for (let index = 0; index < 6; index++) {
			await cycle();
			await collected();
			const sample = { heapMiB: await heapUsedMiB(cdp), ...await cdp.send('Memory.getDOMCounters'), head: await headCounts() };
			samples.push(sample);
			// Exact head counts catch even one abandoned Svelte head anchor per return.
			expect(sample.head).toEqual(baseline.head);
			expect(sample.documents).toBe(baseline.documents);
			expect(sample.jsEventListeners).toBeLessThanOrEqual(baseline.jsEventListeners);
			// Browser bookkeeping may keep a few nodes; whole project trees may not
			// accumulate. Collection above is the exact per-project ownership proof.
			expect(sample.nodes).toBeLessThan(baseline.nodes + 100);
		}
		console.log(`collected project resource samples: ${JSON.stringify(samples)}`);
		expect(warnings).toEqual([]);
		expect(errors).toEqual([]);
	} finally {
		await session.close();
	}
});
