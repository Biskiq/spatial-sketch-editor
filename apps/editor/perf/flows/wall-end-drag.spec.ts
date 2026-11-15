/**
 * A selected Wall's end knob drags and commits even where the Size chip sits
 * beside it. One Room; no workload tier, feel label or benchmark quota.
 *
 * On a Wall that is short on screen the chip (82 % along, 22 px above) used to
 * hit-test its own 44 px square in the DOM and stop the press there, ahead of
 * the Stage resolver that names the end knob. perf:spot's Wall drag then
 * recorded no input and waited 300 s for an acceptance that could not come.
 * This flow presses the visible knob inside that square, follows the product's
 * own ledger from input to accepted result, and checks the chip still toggles
 * through the Stage by pointer and by keyboard.
 */
import { expect, test, type Page } from '@playwright/test';
import { createEmptyWallFirstLayoutDocument, mintLayoutIdCapture, planWallChain } from '@portfolio/layout-core';
import { createEmptyUnitEnvelope, serializeProjectEnvelope } from '@portfolio/project-model/units';
import { newMeasuredSession } from '../lib/browser';
import { acceptedResultCount, chooseCreateStarter, fitStage, gotoCreateIntent, handlePoint, openSourceJson, selectWallById, setStageReading, waitForAcceptedResult, waitForStageSettled } from '../lib/flow';
import { correlateInputs, readLedger } from '../lib/ledger';
import { describeHitTarget, requireDragCommit } from '../lib/spot-browser';

/** The chip's former DOM hit square was ±22 px around its glyph centre. */
const FORMER_CHIP_HIT_HALF = 22;
/** The Stage resolver's fine-pointer mark radius (`stageMarkHitRadiusCss(false)`). */
const FINE_MARK_RADIUS = 11;

/** One Room, 0.5 m by 6 m: at Fit its short Walls run across the screen, short enough that the Size chip sits beside their end knob. */
function narrowRoom() {
	const baseline = createEmptyWallFirstLayoutDocument();
	const plan = planWallChain({ baseline, points: [[0, 0], [0.5, 0], [0.5, 6], [0, 6]], close: true, capture: mintLayoutIdCapture(), levelId: baseline.floor.id });
	if (plan.kind !== 'success') throw new Error(`narrow Room refused: ${plan.rejection.code} ${plan.rejection.message}`);
	return plan.document;
}

async function clearSelection(page: Page) {
	const cardClose = page.getByRole('button', { name: 'Close selection card', exact: true });
	if (await cardClose.isVisible()) await cardClose.click();
	await page.keyboard.press('Escape');
	await expect(page.locator('svg.overlay g.mark', { has: page.locator('title', { hasText: 'Wall end' }) })).toHaveCount(0);
}

async function chipState(page: Page) {
	const chip = page.locator('svg.overlay g.mark[data-mark-id="layout-wall-size-chip"]');
	await expect(chip).toBeVisible();
	const box = (await chip.locator('.glyph').boundingBox())!;
	return { chip, center: { x: box.x + box.width / 2, y: box.y + box.height / 2 }, pressed: await chip.getAttribute('aria-pressed') };
}

test('a Wall end knob beside the Size chip drags to an accepted result; the chip still toggles', async ({ browser }) => {
	const session = await newMeasuredSession(browser, { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, network: 'N0' });
	const page = session.page;
	try {
		const projectId = `wall-end-drag-${Date.now()}`;
		const layout = narrowRoom();
		const envelope = await createEmptyUnitEnvelope({ id: projectId, name: 'Wall end drag room', acceptedRevision: { projectId, revisionId: 'wall-end-drag' }, layout });
		await gotoCreateIntent(page, projectId);
		await chooseCreateStarter(page, 'Begin empty');
		await openSourceJson(page, { size: 'correctness-room', projectId, envelope, canonicalJson: serializeProjectEnvelope(envelope), facts: { walls: 4, openings: 0, rooms: 1 } }, 60_000);
		await setStageReading(page, 'Plan');
		await fitStage(page);
		await waitForStageSettled(page, 30_000);

		// Choose the Wall whose end knob falls inside the chip's former square.
		let chosen: { wallId: string; press: { x: number; y: number }; end: { x: number; y: number }; start: { x: number; y: number } } | null = null;
		for (const wall of layout.walls) {
			// The previous Wall's handles stay up until the new selection lands; clear
			// first so these reads describe this Wall.
			await clearSelection(page);
			await selectWallById(page, wall.id);
			const start = await handlePoint(page, 'Wall start');
			const end = await handlePoint(page, 'Wall end');
			const { center } = await chipState(page);
			// A point on the drawn knob, nudged towards the chip.
			const toward = Math.hypot(center.x - end.x, center.y - end.y) || 1;
			const press = { x: end.x + ((center.x - end.x) / toward) * 3, y: end.y + ((center.y - end.y) / toward) * 3 };
			const inFormerSquare = Math.abs(press.x - center.x) <= FORMER_CHIP_HIT_HALF && Math.abs(press.y - center.y) <= FORMER_CHIP_HIT_HALF;
			const resolverNamesKnob = Math.hypot(press.x - end.x, press.y - end.y) <= FINE_MARK_RADIUS && Math.hypot(press.x - center.x, press.y - center.y) > FINE_MARK_RADIUS;
			if (inFormerSquare && resolverNamesKnob) { chosen = { wallId: wall.id, press, end, start }; break; }
		}
		expect(chosen, 'the fixture must place a Wall end knob inside the chip\'s former hit square').not.toBeNull();
		const { wallId, press, end, start } = chosen!;
		await clearSelection(page);
		await selectWallById(page, wallId);
		const lengthField = page.locator('label.field', { hasText: 'Length' }).locator('input').first();
		const lengthBefore = Number(await lengthField.inputValue());

		// The browser must hand this press to the Stage, not to an overlay element.
		const pressTarget = await page.evaluate(describeHitTarget, press);
		expect(pressTarget).toMatch(/^canvas/);

		const along = Math.hypot(end.x - start.x, end.y - start.y) || 1;
		const direction = { x: (end.x - start.x) / along, y: (end.y - start.y) / along };
		const acceptedBefore = await acceptedResultCount(page);
		await page.mouse.move(press.x, press.y);
		const pressedAt = await page.evaluate(() => performance.now());
		await page.mouse.down();
		for (let index = 1; index <= 4; index += 1) {
			await page.mouse.move(press.x + direction.x * 6 * index, press.y + direction.y * 6 * index);
			await page.waitForTimeout(32);
		}
		await page.mouse.up();

		// Every boundary from claimed press to commit, then the accepted result, bounded.
		await requireDragCommit(page, { pressedAt, pressTarget }, wallId);
		const accepted = await waitForAcceptedResult(page, acceptedBefore);
		const records = (await readLedger(page)).records.filter((record) => record.time >= pressedAt);
		const commit = records.find((record) => record.name === 'command:commit' && record.detail?.wallId === wallId)!;
		expect(accepted.time).toBeGreaterThanOrEqual(commit.time);
		expect(records.filter((record) => record.name === 'command:commit')).toHaveLength(1);

		// Each move correlates input → preview install → overlay presentation by sequence.
		const ledger = await readLedger(page);
		const samples = correlateInputs(records, ledger.ticks);
		expect(samples.length).toBeGreaterThanOrEqual(1);
		const presented = samples.filter((sample) => sample.installTime !== null && sample.presentedTime !== null);
		expect(presented.length).toBeGreaterThanOrEqual(1);
		for (const sample of presented) {
			expect(sample.installTime!).toBeGreaterThanOrEqual(sample.inputTime);
			expect(sample.presentedTime!).toBeGreaterThanOrEqual(sample.installTime!);
		}

		// The accepted Wall is longer: the end moved outward along the Wall.
		await selectWallById(page, wallId);
		await expect.poll(async () => Number(await lengthField.inputValue())).toBeGreaterThan(lengthBefore);

		// The chip itself still toggles through the Stage resolver, once per press.
		const before = await chipState(page);
		await page.mouse.click(before.center.x, before.center.y);
		await expect(before.chip).toHaveAttribute('aria-pressed', before.pressed === 'true' ? 'false' : 'true');
		// And by keyboard, from its own focus.
		await before.chip.focus();
		await page.keyboard.press('Enter');
		await expect(before.chip).toHaveAttribute('aria-pressed', before.pressed ?? 'false');
	} finally {
		await session.close();
	}
});
