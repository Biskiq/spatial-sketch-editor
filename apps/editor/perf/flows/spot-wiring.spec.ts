/** Measurement correctness on one Room; no workload tier, feel label or benchmark quota. */
import { expect, test } from '@playwright/test';
import { createEmptyUnitEnvelope, serializeProjectEnvelope } from '@portfolio/project-model/units';
import { newMeasuredSession } from '../lib/browser';
import { acceptedResultCount, commitPrecisionLength, fitStage, openSourceJson, selectWallById, setStageReading, waitForAcceptedResult, waitForStageSettled } from '../lib/flow';
import { readLedger } from '../lib/ledger';
import { clickPick, installPanObserver } from '../lib/spot-browser';
import { openTiming, typedLengthTiming } from '../lib/spot-measurement';
import { buildGrid } from '../lib/workloads/grid';

test('real chooser, typed Length, rendered source, known-wall hits and pan clock are wired', async ({ browser, baseURL }) => {
	const session = await newMeasuredSession(browser, { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, network: 'N0' });
	try {
		const projectId = `spot-wiring-${Date.now()}`;
		const layout = buildGrid(1);
		const wallId = layout.walls[0]!.id;
		const envelope = await createEmptyUnitEnvelope({ id: projectId, name: 'Measurement correctness room', acceptedRevision: { projectId, revisionId: 'wiring-baseline' }, layout });
		const page = session.page;
		await page.goto(`${baseURL}/project/${projectId}/spatial?create=1`);
		await page.getByRole('dialog', { name: 'Start a project' }).waitFor();
		await openSourceJson(page, { size: 'correctness-room', projectId, envelope, canonicalJson: serializeProjectEnvelope(envelope), facts: { walls: 4, openings: 0, rooms: 1 } });
		await setStageReading(page, 'Plan');
		await fitStage(page);
		await waitForStageSettled(page);
		expect(openTiming(await readLedger(page), 0).renderedMs).not.toBeNull();
		expect(await clickPick(page, wallId)).toMatchObject({ resolved: true, selected: 1 });
		await selectWallById(page, wallId);
		const before = await acceptedResultCount(page);
		const dispatched = await page.evaluate(() => performance.now());
		await commitPrecisionLength(page, 6.05);
		await waitForAcceptedResult(page, before);
		await expect.poll(async () => typedLengthTiming(await readLedger(page), dispatched, wallId).presentedMs).not.toBeNull();
		const timing = typedLengthTiming(await readLedger(page), dispatched, wallId);
		expect(timing.operationId).not.toBeNull();
		expect(timing.sourceContentId).not.toBeNull();
		expect(timing.presentedMs!).toBeGreaterThanOrEqual(timing.renderedMs!);
		expect(await clickPick(page, wallId)).toMatchObject({ resolved: true, selected: 1 });
		await page.evaluate(installPanObserver);
		const canvas = (await page.locator('canvas').first().boundingBox())!;
		await page.mouse.move(canvas.x + 12, canvas.y + 30);
		await page.mouse.down();
		await page.mouse.move(canvas.x + 24, canvas.y + 30);
		await page.mouse.up();
		await page.waitForFunction(() => ((window as Window & { __spotPan?: unknown[] }).__spotPan?.length ?? 0) > 0);
		const pan = await page.evaluate(() => (window as Window & { __spotPan?: { received: number; presented: number }[] }).__spotPan![0]!);
		expect(pan.presented).toBeGreaterThanOrEqual(pan.received);
	} finally { await session.close(); }
});
