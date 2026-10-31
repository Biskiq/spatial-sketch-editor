import { chromium } from '@playwright/test';
import { seedS17BrowserProject } from './tests/e2e/s17-seed-mixed-project';

const editorOrigin = process.env.EDITOR_ORIGIN ?? process.env.PUBLIC_EDITOR_ORIGIN ?? 'http://127.0.0.1:5173';
const apiOrigin = process.env.PUBLIC_API_ORIGIN ?? 'http://127.0.0.1:8787';
const secret = process.env.E2E_TEST_AUTH_SECRET;
if (secret === undefined || secret.length === 0) throw new Error('E2E_TEST_AUTH_SECRET is missing');
const seed = await seedS17BrowserProject({ apiOrigin, editorOrigin, testAuthSecret: secret, user: 'agent-user-a' });
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
try {
  browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const separator = seed.session.cookie.indexOf('=');
  await context.addCookies([{ name: seed.session.cookie.slice(0, separator), value: seed.session.cookie.slice(separator + 1), url: editorOrigin, httpOnly: true, sameSite: 'Lax' }]);
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('pageerror', error.message));
  page.on('console', (message) => { if (message.type() === 'error') console.log('console-error', message.text()); });
  const response = await page.goto(`${editorOrigin}/project/${seed.projectId}/spatial`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('body').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(5000);
  const gotIt = page.getByRole('button', { name: 'Got it' });
  if (await gotIt.count()) await gotIt.click();
  await page.getByRole('button', { name: '2D' }).click();
  await page.getByRole('button', { name: 'Arm Library' }).click();
  const chooser = page.locator('select[aria-label="Place object"]');
  await chooser.waitFor({ state: 'visible', timeout: 15000 });
  await chooser.selectOption('native:box');
  await page.getByText(/box is ready: click its floor position/).waitFor({ state: 'visible', timeout: 10000 });
  const canvas = await page.locator('canvas').boundingBox();
  const overlay = await page.locator('svg.overlay').boundingBox();
  if (canvas === null || overlay === null) throw new Error('Stage surfaces have no browser bounds');
  const target = { x: canvas.x + canvas.width * 0.5, y: canvas.y + canvas.height * 0.55 };
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.move(target.x + 24, target.y + 8, { steps: 6 });
  await page.waitForTimeout(300);
  const live = await page.locator('[data-candidate-id]').evaluateAll((nodes) => nodes.map((node) => ({ id: node.getAttribute('data-candidate-id'), role: node.getAttribute('data-candidate-role') })));
  await page.screenshot({ path: '/tmp/s17-place-native-box-preview.png' });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const undoDisabled = await page.getByRole('button', { name: 'Undo' }).isDisabled();
  const task = await page.locator('[data-stage-instrument]').getAttribute('data-stage-instrument');
  const card = await page.locator('[aria-label="Selected subject"]').innerText().catch(() => 'no selection card');
  console.log(JSON.stringify({ status: response?.status(), canvas, overlay, target, live, undoDisabled, task, card, body: (await page.locator('body').innerText()).slice(-800) }));
  await context.close();
} finally {
  if (browser !== null) await browser.close();
  await seed.cleanup();
}
