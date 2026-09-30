import { expect, test, type Page } from '@playwright/test';
const snapshot = (page: Page) => page.evaluate(() => window.__biskiq.snapshot());
const openEncounter = (page: Page, name: string) => page.getByRole('button', { name: `Open ${name}`, exact: true }).click();
test('authors and revises the complete flow through real controls', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Select Machine', exact: true }).click(); await page.getByRole('button', { name: 'Create Encounter', exact: true }).click();
  await page.getByLabel('Encounter name', { exact: true }).fill('Drive'); await page.getByLabel('Audience intention').fill('Understand power transfer');
  await page.getByRole('button', { name: 'Edit View 1', exact: true }).click(); await page.getByLabel('Contribution name').fill('Overview');
  await openEncounter(page, 'Drive'); await page.getByRole('button', { name: 'Add explanation', exact: true }).click(); await page.getByLabel('Narration text').fill('One continuous explanation across three viewpoints.');
  await openEncounter(page, 'Drive'); await page.getByRole('button', { name: 'Add automatic view', exact: true }).click(); await page.getByLabel('Contribution name').fill('Rotor detail');
  await openEncounter(page, 'Drive'); await page.getByRole('button', { name: 'Add automatic view', exact: true }).click(); await page.getByLabel('Contribution name').fill('Output');
  await page.getByRole('button', { name: 'Select Machine', exact: true }).click(); await page.getByLabel('Preview Casing opening', { exact: true }).press('End'); await page.getByRole('button', { name: 'Use Casing opening in Experience', exact: true }).click();
  await page.getByRole('button', { name: 'Select Machine', exact: true }).click(); await page.getByLabel('Preview Run rotor', { exact: true }).check(); await page.getByRole('button', { name: 'Use Run rotor in Experience', exact: true }).click();
  await page.getByLabel('Start relationship', { exact: true }).selectOption('after'); await page.getByLabel('Start after', { exact: true }).selectOption({ label: 'Casing opening · Machine · finished' }); await page.getByLabel('End relationship', { exact: true }).selectOption('experience');
  await openEncounter(page, 'Drive'); await page.getByRole('button', { name: 'Add encounter to Guide', exact: true }).click();
  await page.getByRole('button', { name: 'Select Machine', exact: true }).click(); await page.getByRole('button', { name: 'Select Imported mesh', exact: true }).click({ modifiers: ['Shift'] }); await page.getByRole('button', { name: 'Create Encounter', exact: true }).click(); await page.getByLabel('Encounter name', { exact: true }).fill('Comparison'); await page.getByRole('button', { name: 'Add encounter to Guide', exact: true }).click();
  await page.getByRole('button', { name: 'Edit View 1', exact: true }).click(); await page.locator('summary').filter({ hasText: 'Reuse and duplication' }).click(); await page.getByLabel('Link an existing definition', { exact: true }).selectOption({ label: 'Overview' }); await page.getByRole('button', { name: 'Use linked definition', exact: true }).click();
  await page.getByRole('button', { name: 'Select Piano', exact: true }).click(); await page.getByRole('button', { name: 'Preview Play', exact: true }).click(); await page.getByRole('button', { name: 'Let visitors activate Music', exact: true }).click(); await expect(page.getByLabel('Interaction availability')).toHaveValue('');
  await page.getByRole('button', { name: 'Select Wall', exact: true }).click(); await page.getByRole('button', { name: 'Create Encounter', exact: true }).click(); await page.getByLabel('Encounter name', { exact: true }).fill('Assembly'); await page.getByRole('button', { name: 'Select Wall', exact: true }).click(); await page.getByLabel('Preview Unfold', { exact: true }).check(); await page.getByRole('button', { name: 'Use Unfold in Experience', exact: true }).click();
  await page.getByRole('button', { name: 'Guide position 2: Comparison / Overview', exact: true }).click(); await page.getByLabel('Create detour from Encounter', { exact: true }).selectOption({ label: 'Assembly' }); await page.getByRole('button', { name: 'Create detour connection', exact: true }).click();
  const before = await snapshot(page); expect(before.document.experience.routes[0].ids).toHaveLength(2); expect(Object.values(before.document.experience.encounters)).toHaveLength(3);
  await page.getByRole('button', { name: 'Preview', exact: true }).click(); await expect(page.getByRole('button', { name: 'Next Stop', exact: true })).toBeEnabled();
  await expect.poll(async () => { const s = await snapshot(page); return Object.values(s.runtime!.activities).some(a => a.status === 'running' && s.document.experience.uses[a.useId]?.kind === 'behavior' && (s.document.experience.definitions[s.document.experience.uses[a.useId].definitionId] as { capabilityId?: string }).capabilityId === 'rotor'); }).toBe(true);
  await page.getByRole('button', { name: 'Next Stop', exact: true }).click();
  await page.getByRole('button', { name: 'Assembly ↗', exact: true }).click(); const detour = await snapshot(page); expect(detour.runtime!.bookmarks).toHaveLength(1); await page.getByRole('button', { name: 'Return from detour', exact: true }).click();
  await page.getByRole('button', { name: 'Free exploration', exact: true }).click(); const guideBeforeMusic = (await snapshot(page)).runtime!.positionId; await page.getByRole('button', { name: 'Activate Music · Piano', exact: true }).click(); expect((await snapshot(page)).runtime!.positionId).toBe(guideBeforeMusic);
  await page.getByRole('button', { name: 'Return to guide', exact: true }).click(); const visited = await snapshot(page); expect(visited.runtime!.overrides.machine.running.value).toBe(true); expect(visited.document).toEqual(before.document);
  await page.getByRole('button', { name: 'Exit Preview', exact: true }).click(); await page.getByRole('button', { name: 'Edit Overview', exact: true }).last().click(); await page.getByLabel('Distance adjustment', { exact: true }).press('End'); const revised = await snapshot(page); const views = Object.values(revised.document.experience.uses).filter(u => u.kind === 'view'); const overviews = views.filter(u => revised.document.experience.definitions[u.definitionId].name === 'Overview'); expect(overviews).toHaveLength(2); expect(overviews[0].definitionId).not.toBe(overviews[1].definitionId); expect(revised.document.experience.positions).toEqual(before.document.experience.positions);
  await page.getByRole('button', { name: 'Reviewer Presenter', exact: true }).click(); await expect(page.getByRole('complementary', { name: 'Reviewer Presenter' })).toBeVisible(); await page.getByRole('button', { name: 'Close Presenter', exact: true }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click(); expect(Object.keys((await snapshot(page)).document.experience.uses)).toHaveLength(0);
});
test('Presenter guides creation and never creates content on Skip or Back', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Reviewer Presenter', exact: true }).click(); await expect(page.getByRole('button', { name: 'Next step', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Select Machine', exact: true }).click(); await page.getByRole('button', { name: 'Create Encounter', exact: true }).click(); await page.getByRole('button', { name: 'Add explanation', exact: true }).click(); await page.getByLabel('Narration text').fill('Short explanation.'); await page.getByRole('button', { name: 'Preview', exact: true }).click(); await expect(page.getByRole('button', { name: 'Next step', exact: true })).toBeEnabled();
  const authored = (await snapshot(page)).document; await page.getByRole('button', { name: 'Next step', exact: true }).click(); await page.getByRole('button', { name: 'Skip', exact: true }).click(); await page.getByRole('button', { name: 'Back', exact: true }).click(); expect((await snapshot(page)).document).toEqual(authored); await page.getByRole('button', { name: 'Close Presenter', exact: true }).click(); expect((await snapshot(page)).document).toEqual(authored);
});
test('the first Encounter previews with multiple views before any Guide is authored', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Select Machine', exact: true }).click(); await page.getByRole('button', { name: 'Create Encounter', exact: true }).click(); await page.getByLabel('Encounter name', { exact: true }).fill('First explanation');
  await openEncounter(page, 'First explanation'); await page.getByRole('button', { name: 'Add explanation', exact: true }).click(); await page.getByLabel('Narration text').fill('A useful explanation without a guide.'); await openEncounter(page, 'First explanation'); await page.getByRole('button', { name: 'Add automatic view', exact: true }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).click(); const before = await snapshot(page); expect(before.runtime!.encounterId).not.toBeNull(); expect(before.runtime!.positionId).toBeNull(); expect(before.document.experience.routes[0].ids).toHaveLength(0);
  const narr = Object.values(before.document.experience.uses).find(u => u.kind === 'narration')!; await page.getByRole('button', { name: 'View 2', exact: true }).click(); const after = await snapshot(page); expect(after.runtime!.activities[narr.id].status).toBe('running'); expect(after.runtime!.activities[narr.id].elapsed).toBeGreaterThanOrEqual(before.runtime!.activities[narr.id].elapsed); expect(after.runtime!.positionId).toBeNull(); expect(after.document).toEqual(before.document);
});
test('piano interaction works with no Encounter and leaves source unchanged', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Select Piano', exact: true }).click(); await page.getByRole('button', { name: 'Preview Play', exact: true }).click(); await page.getByRole('button', { name: 'Let visitors activate Music', exact: true }).click(); const authored = (await snapshot(page)).document;
  await page.getByRole('button', { name: 'Preview', exact: true }).click(); await page.getByRole('button', { name: 'Select Piano', exact: true }).click(); const r = (await snapshot(page)).runtime!; expect(r.overrides.piano.playing.value).toBe(true); expect(r.encounterId).toBeNull(); expect(r.positionId).toBeNull(); expect(r.camera).toBeNull(); expect((await snapshot(page)).document).toEqual(authored);
});
test('world scope, capability loss, and provider controls use the same UI', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Load example', exact: true }).click(); await page.getByRole('button', { name: 'Select Wall', exact: true }).click(); await page.getByLabel('Preview Unfold', { exact: true }).check(); expect((await snapshot(page)).document.world.subjects.wall.properties.unfolded).toBe(false);
  await page.getByRole('button', { name: 'Edit World', exact: true }).click(); await expect(page.getByLabel('World Unfold', { exact: true })).not.toBeChecked(); await page.getByLabel('World Unfold', { exact: true }).check(); expect((await snapshot(page)).document.world.subjects.wall.properties.unfolded).toBe(true);
  await page.getByRole('button', { name: 'Select Machine', exact: true }).click(); await page.getByLabel('Asset capability profile', { exact: true }).selectOption('machine-replacement'); await expect(page.locator('.issues')).toContainText('capability unavailable');
  const usesBefore = Object.keys((await snapshot(page)).document.experience.uses).length; await page.locator('.issues').getByRole('button').filter({ hasText: 'capability unavailable' }).first().click(); await expect(page.getByTestId('editing-scope')).toContainText('EDITING EXPERIENCE'); await page.getByRole('button', { name: 'Remove this contribution', exact: true }).click(); expect(Object.keys((await snapshot(page)).document.experience.uses)).toHaveLength(usesBefore - 1);
  await page.getByRole('button', { name: 'Reviewer Presenter', exact: true }).click(); await page.locator('summary').filter({ hasText: 'Restart and optional trials' }).click(); await page.getByRole('button', { name: 'Capability loss', exact: true }).click(); await page.getByRole('button', { name: 'Expose new mesh capability', exact: true }).click(); await page.getByRole('button', { name: 'Close Presenter', exact: true }).click(); await page.getByRole('button', { name: 'Select Imported mesh', exact: true }).click(); await expect(page.getByLabel('Preview Provider flex', { exact: true })).toBeVisible(); await page.getByLabel('Preview Provider flex', { exact: true }).press('End'); await page.getByRole('button', { name: 'Use Provider flex in Experience', exact: true }).click(); await expect(page.getByLabel('Supported control', { exact: true })).toHaveValue('test-flex');
});
test('creates an environmental Encounter with no view and a region from the actual canvas', async ({ page }) => {
  await page.goto('/'); await page.getByLabel('Creation focus', { exact: true }).selectOption('environment'); await expect(page.getByLabel('Include a suggested view', { exact: true })).not.toBeChecked(); await page.getByRole('button', { name: 'Create Encounter', exact: true }).click(); let d = (await snapshot(page)).document; expect(Object.values(d.experience.encounters)[0].focus.kind).toBe('environment'); expect(Object.keys(d.experience.uses)).toHaveLength(0);
  await page.getByLabel('Creation focus', { exact: true }).selectOption('region'); await page.getByRole('button', { name: 'Pick region', exact: true }).click(); const canvas = page.getByTestId('spatial-canvas'); const b = (await canvas.boundingBox())!; await page.mouse.click(b.x + b.width * .35, b.y + b.height * .6); await page.mouse.click(b.x + b.width * .65, b.y + b.height * .75); await expect(page.getByRole('button', { name: 'Create Encounter', exact: true })).toBeEnabled(); await page.getByRole('button', { name: 'Create Encounter', exact: true }).click(); d = (await snapshot(page)).document; expect(Object.values(d.experience.encounters).some(e => e.focus.kind === 'region')).toBe(true);
});
test('A0: the simple loop adds one Guide position per Encounter with defaults only', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Select Machine', exact: true }).click(); await page.getByRole('button', { name: 'Create Encounter', exact: true }).click();
  await page.getByRole('button', { name: 'Add explanation', exact: true }).click(); await page.getByLabel('Narration text').fill('A short explanation.');
  await page.getByRole('button', { name: 'Select Machine', exact: true }).click(); await page.getByLabel('Preview Casing opening', { exact: true }).press('End'); await page.getByRole('button', { name: 'Use Casing opening in Experience', exact: true }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).click(); await expect(page.getByRole('button', { name: 'Next Stop', exact: true })).toBeDisabled(); await page.getByRole('button', { name: 'Exit Preview', exact: true }).click();
  await openEncounter(page, 'Introduce Machine'); await page.getByRole('button', { name: 'Add encounter to Guide', exact: true }).click();
  await page.getByRole('button', { name: 'Select Piano', exact: true }).click(); await page.getByRole('button', { name: 'Create Encounter', exact: true }).click(); await openEncounter(page, 'Introduce Piano'); await page.getByRole('button', { name: 'Add encounter to Guide', exact: true }).click();
  const s = await snapshot(page); const encounters = Object.keys(s.document.experience.encounters); const positions = Object.values(s.document.experience.positions);
  expect(positions).toHaveLength(2); expect(new Set(positions.map(p => p.encounterId))).toEqual(new Set(encounters)); expect(positions.every(p => p.next.kind === 'order')).toBe(true);
  await page.getByRole('button', { name: 'Preview', exact: true }).click(); await page.getByRole('button', { name: 'Next Stop', exact: true }).click(); expect((await snapshot(page)).runtime!.positionId).toBe(s.document.experience.routes[0].ids[1]);
});
test('the Auto estimate responds to Camera speed on the critical path', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Select Machine', exact: true }).click(); await page.getByRole('button', { name: 'Create Encounter', exact: true }).click(); await page.getByRole('button', { name: 'Add encounter to Guide', exact: true }).click();
  await expect(page.getByTestId('estimate')).toContainText('Auto');
  const auto = await page.getByTestId('estimate').textContent();
  await page.getByLabel('Connection travel', { exact: true }).selectOption('cut');
  const cut = await page.getByTestId('estimate').textContent();
  expect(cut).not.toBe(auto); expect(cut).toContain('Cut');
});
test('cue-driven Views change the Camera without changing the Guide position', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Load example', exact: true }).click(); await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.locator('[data-testid^="caption-"]')).toBeVisible();
  const before = await snapshot(page); await page.waitForTimeout(7000); const after = await snapshot(page);
  expect(after.runtime!.positionId).toBe(before.runtime!.positionId); expect(after.runtime!.camera!.token).toBeGreaterThan(before.runtime!.camera!.token);
});
test('A3: a Switch activation drives Light without moving the Camera or Guide', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Load example', exact: true }).click(); await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const before = await snapshot(page);
  await page.getByRole('button', { name: 'Activate Intensity · Light', exact: true }).click();
  const after = await snapshot(page);
  expect(after.runtime!.overrides.light.intensity.value).toBe(3);
  expect(after.runtime!.camera!.token).toBe(before.runtime!.camera!.token);
  expect(after.runtime!.positionId).toBe(before.runtime!.positionId);
});
test('A9: an authored Gate blocks and then permits the same connection', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Load example', exact: true }).click();
  await page.getByRole('button', { name: 'Guide position 1: Understand the drive / Machine overview', exact: true }).click();
  await page.locator('summary').filter({ hasText: 'Deliberate progression gate' }).click();
  await page.getByLabel('Require condition before Next', { exact: true }).check();
  await page.getByLabel('Required condition', { exact: true }).selectOption({ label: 'Casing opening · Machine · finished' });
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByTestId('gate-status')).toContainText('Waiting for the authored condition');
  await expect(page.getByRole('button', { name: 'Next Stop', exact: true })).toBeDisabled();
  await expect.poll(() => page.getByRole('button', { name: 'Next Stop', exact: true }).isEnabled().catch(() => false), { timeout: 6000 }).toBe(true);
});
test('A10: departing early disarms unstarted visit work', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Load example', exact: true }).click(); await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const rotorOf = (s: Awaited<ReturnType<typeof snapshot>>) => Object.values(s.document.experience.uses).find(u => u.kind === 'behavior' && (s.document.experience.definitions[u.definitionId] as { capabilityId?: string }).capabilityId === 'rotor')!;
  await page.getByRole('button', { name: 'Next Stop', exact: true }).click();
  const early = await snapshot(page); expect(early.runtime!.activities[rotorOf(early).id].status).toBe('stopped');
  await expect.poll(async () => { const s = await snapshot(page); return s.runtime!.overrides.machine?.running?.value ?? false; }).toBe(false);
});
test('A11: a visitor Stop is not undone by later view changes', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Load example', exact: true }).click(); await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect.poll(async () => { const s = await snapshot(page); return Object.values(s.runtime!.activities).some(a => a.status === 'running' && (s.document.experience.definitions[s.document.experience.uses[a.useId].definitionId] as { capabilityId?: string }).capabilityId === 'rotor'); }, { timeout: 6000 }).toBe(true);
  await page.getByRole('button', { name: 'Stop Run rotor · Machine', exact: true }).click();
  expect((await snapshot(page)).runtime!.overrides.machine?.running?.value ?? false).toBe(false);
  await page.getByRole('button', { name: 'Next Stop', exact: true }).click();
  expect((await snapshot(page)).runtime!.overrides.machine?.running?.value ?? false).toBe(false);
});
test('A15: only this checkpoint detaches its framing without retargeting the other appearance', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Load example', exact: true }).click();
  const before = await snapshot(page);
  await page.getByRole('button', { name: 'Guide position 2: Compare materials / Machine overview', exact: true }).click();
  await page.getByRole('button', { name: 'Edit this Stop’s entry framing', exact: true }).click();
  await page.getByLabel('Distance adjustment', { exact: true }).press('End');
  const revised = await snapshot(page);
  const overviews = Object.values(revised.document.experience.uses).filter(u => u.kind === 'view' && revised.document.experience.definitions[u.definitionId].name === 'Machine overview');
  const comparePosition = before.document.experience.positions[before.document.experience.routes[0].ids[1]];
  const sharedDef = Object.values(before.document.experience.uses).find(u => u.kind === 'view' && u.encounterId === comparePosition.encounterId)!.definitionId;
  expect(overviews).toHaveLength(3); expect(overviews.filter(u => u.definitionId === sharedDef)).toHaveLength(2); expect(overviews.some(u => u.definitionId !== sharedDef)).toBe(true);
  expect(revised.document.experience.positions[revised.document.experience.routes[0].ids[0]].next).toEqual(before.document.experience.positions[before.document.experience.routes[0].ids[0]].next);
});
test('A22: Reset and Load example restore their documented states', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Load example', exact: true }).click();
  let s = await snapshot(page); expect(Object.keys(s.document.experience.uses).length).toBeGreaterThan(0); expect(s.runtime).toBeNull();
  await page.getByRole('button', { name: 'Preview', exact: true }).click(); expect((await snapshot(page)).runtime).not.toBeNull();
  await page.getByRole('button', { name: 'Reset', exact: true }).click(); s = await snapshot(page); expect(Object.keys(s.document.experience.uses)).toHaveLength(0); expect(s.runtime).toBeNull(); expect(s.mode).toBe('experience');
  await page.getByRole('button', { name: 'Load example', exact: true }).click(); s = await snapshot(page); expect(s.runtime).toBeNull(); expect(s.mode).toBe('experience');
});
test('Keep current viewpoint suppresses automatic viewing', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Load example', exact: true }).click();
  await page.getByRole('button', { name: 'Guide position 1: Understand the drive / Machine overview', exact: true }).click();
  await page.getByLabel('Position presentation', { exact: true }).selectOption('hold');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const before = await snapshot(page); expect(before.runtime!.camera).toBeNull();
  await page.waitForTimeout(7000); const after = await snapshot(page);
  expect(after.runtime!.camera).toBeNull(); expect(after.runtime!.positionId).toBe(before.runtime!.positionId);
});

test('V1.1: a Presentation keeps its Views internal while Next Stop moves to the next Presentation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Select Machine', exact: true }).click(); await page.getByRole('button', { name: 'Create Encounter', exact: true }).click();
  await page.getByLabel('Encounter name', { exact: true }).fill('Presentation A');
  await page.getByRole('button', { name: 'Add explanation', exact: true }).click(); await page.getByLabel('Narration text').fill('One explanation across three views.');
  await openEncounter(page, 'Presentation A'); await page.getByRole('button', { name: 'Add automatic view', exact: true }).click();
  await openEncounter(page, 'Presentation A'); await page.getByRole('button', { name: 'Add automatic view', exact: true }).click();
  await openEncounter(page, 'Presentation A'); await page.getByLabel('Suggest a view progression', { exact: true }).check();
  await page.getByRole('button', { name: 'Add encounter to Guide', exact: true }).click();
  await page.getByRole('button', { name: 'Select Piano', exact: true }).click(); await page.getByRole('button', { name: 'Create Encounter', exact: true }).click();
  await page.getByLabel('Encounter name', { exact: true }).fill('Presentation B'); await openEncounter(page, 'Presentation B');
  await page.getByRole('button', { name: 'Add encounter to Guide', exact: true }).click();
  const authored = await snapshot(page); const positions = Object.values(authored.document.experience.positions);
  expect(positions).toHaveLength(2); expect(positions.every(p => p.presentation === 'encounter' && p.viewUseId === null)).toBe(true);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const stop1 = (await snapshot(page)).runtime!.positionId; const elapsed0 = Object.values((await snapshot(page)).runtime!.activities).find(a => a.status === 'running')?.elapsed ?? 0;
  await page.getByRole('button', { name: 'Next View', exact: true }).click();
  const afterView = await snapshot(page); expect(afterView.runtime!.positionId).toBe(stop1);
  expect(Object.values(afterView.runtime!.activities).some(a => a.status === 'running' && a.elapsed >= elapsed0)).toBe(true);
  await page.getByRole('button', { name: 'Next Stop', exact: true }).click();
  expect((await snapshot(page)).runtime!.positionId).not.toBe(stop1);
});

test('V1.1: Preview this Presentation stays standalone while a Guide exists', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Select Machine', exact: true }).click(); await page.getByRole('button', { name: 'Create Encounter', exact: true }).click();
  await page.getByLabel('Encounter name', { exact: true }).fill('Presentation A');
  await openEncounter(page, 'Presentation A'); await page.getByRole('button', { name: 'Add encounter to Guide', exact: true }).click();
  await openEncounter(page, 'Presentation A'); await page.getByRole('button', { name: 'Preview this Presentation', exact: true }).click();
  const r = (await snapshot(page)).runtime!; expect(r.positionId).toBeNull(); expect(r.bookmarks).toHaveLength(0); expect(r.encounterId).not.toBeNull();
});
