// R217.S25 parity journey and browser acceptance (task-owned, headed Chromium, closed in finally).
// Usage: node journey.cjs <before|after> <editorOrigin> <authFile> <outDir> <width> <height> <journeyName>
// The same journey runs on main (before) and on the shared homes (after). Each step records what the
// page shows (presentations, stop order, Guide, Card, feedback, Preview, Undo, overflow) and a PNG.
const fs = require('fs');
const path = require('path');
const { chromium } = require('/Users/tony/Documents/Biskiq/spatial-sketch-editor/node_modules/playwright');

const [TREE, ORIGIN, AUTH_FILE, OUT, W, H, NAME] = process.argv.slice(2);
const WIDTH = Number(W);
const HEIGHT = Number(H);
const cookieValue = fs
	.readFileSync(AUTH_FILE, 'utf8')
	.split('\n')
	.find((line) => line.toLowerCase().startsWith('set-cookie: museum-editor-session='))
	.split(';')[0]
	.split('=')
	.slice(1)
	.join('=');
const tag = `${TREE}-${WIDTH}x${HEIGHT}`;
fs.mkdirSync(OUT, { recursive: true });

/** Runs in the page. Reads one tree's controls; the selectors are the only tree-specific part. */
const READ_STATE = (tree) => {
	const qa = (sel) => [...document.querySelectorAll(sel)];
	const q = (sel) => document.querySelector(sel);
	const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
	const visible = (el) => {
		if (!el) return false;
		const r = el.getBoundingClientRect();
		return r.width > 0 && r.height > 0 && !el.closest('[hidden]');
	};
	const lensButton = (name) => qa('button').find((b) => text(b) === name && b.closest('.lens, [role="group"]'));
	const undo = qa('button').find((b) => (b.getAttribute('aria-label') || text(b)) === 'Undo');
	const presentationsSel = tree === 'after' ? '[data-presentation-id] .item-name' : 'section[aria-label="Presentations"] ul.rows li button.row .row-label';
	const stopsSel = tree === 'after' ? 'ol[aria-label="Stops"] li button.row .row-label' : 'ol.stop-list li button.row .row-label';
	const guideKey = tree === 'after' ? q('[data-experience-dock] [data-dock-tool="guide"]') : qa('[aria-label="Experience dock"] button').find((b) => text(b) === 'Guide');
	const card = q('aside.card') ?? q('section[aria-label="Presentations"] .card') ?? q('section[aria-label="Guides"] .card');
	// The World Card (aside.card) is read in both trees; the surface's own Presentation card only on main.
	const worldCard = q('aside.card');
	const surfaceCard = q('section[aria-label="Presentations"] .card');
	const cardKind = worldCard ? text(worldCard.querySelector('.kind')) : surfaceCard ? 'Presentation (surface)' : null;
	const feedback = tree === 'after' ? text(q('.experience-feedback')) : text(q('section[aria-label="Experience authoring"] .feedback'));
	const visitor = qa('[aria-label="Visitor preview"]').find((el) => !el.hidden && visible(el));
	const index = q('#plate-index');
	const docWidth = document.documentElement.scrollWidth;
	const viewport = document.documentElement.clientWidth;
	return {
		lens: { world: lensButton('World')?.getAttribute('aria-pressed') ?? null, experience: lensButton('Experience')?.getAttribute('aria-pressed') ?? null },
		indexOpen: !!index && !index.hidden && visible(index),
		crumb: tree === 'after' ? text(q('[aria-current="location"]')) : text(q('section[aria-label="Experience authoring"] h2')),
		createVisible: qa('button').some((b) => text(b) === 'Create Experience' && visible(b)),
		presentations: qa(presentationsSel).filter(visible).map(text),
		stops: qa(stopsSel).filter(visible).map(text),
		guideOpen: tree === 'after' ? !!q('[data-stage-instrument="experience-guide"]') : !!q('section[aria-label="Guides"]'),
		guideKeyPressed: guideKey ? guideKey.getAttribute('aria-pressed') : null,
		cardKind,
		cardTitle: worldCard ? text(worldCard.querySelector('h2.name')) : surfaceCard ? text(surfaceCard.querySelector('h4')) : null,
		cardText: card ? text(card).slice(0, 240) : null,
		feedback,
		visitorPreview: !!visitor,
		undoDisabled: undo ? undo.disabled : null,
		overflowPx: docWidth - viewport
	};
};

const journal = { tree: TREE, journey: NAME, width: WIDTH, height: HEIGHT, steps: [], pageErrors: [], consoleErrors: [], dialogs: [] };

(async () => {
	const browser = await chromium.launch({ headless: false });
	try {
		const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, colorScheme: 'light' });
		await context.addCookies([{ name: 'museum-editor-session', value: cookieValue, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
		const page = await context.newPage();
		page.on('pageerror', (e) => journal.pageErrors.push(e.message));
		page.on('console', (m) => {
			if (m.type() !== 'error') return;
			// TD-19: the favicon 404 is pre-existing and is the one console error every pass carries.
			if (/favicon|status of 404/.test(m.text())) return;
			journal.consoleErrors.push(m.text());
		});
		page.on('dialog', (d) => {
			journal.dialogs.push(d.message());
			void d.accept();
		});

		const shot = async (index, name) => {
			const file = path.join(OUT, `${tag}-${String(index).padStart(2, '0')}-${name}.png`);
			await page.screenshot({ path: file });
			return path.basename(file);
		};
		const record = async (index, name, extra = {}) => {
			await ensureIndexOpenForRead();
			await page.waitForTimeout(600);
			const state = await page.evaluate(READ_STATE, TREE);
			const png = await shot(index, name);
			journal.steps.push({ index, name, png, ...state, ...extra });
			return state;
		};
		const waitUntil = async (fn, timeoutMs = 15000) => {
			const started = Date.now();
			while (Date.now() - started < timeoutMs) {
				if (await fn().catch(() => false)) return true;
				await page.waitForTimeout(250);
			}
			return false;
		};
		/** Hides the Index sheet only when it is open at a constrained width; a closed sheet is a no-op. */
		const hideIndexIfOpen = async () => {
			const open = await page.evaluate(READ_STATE, TREE).then((state) => state.indexOpen);
			const hide = page.getByRole('button', { name: 'Hide Index' });
			if (open && (await hide.count()) > 0) await hide.first().click();
			await page.waitForTimeout(300);
		};
		/**
		 * A pointer click. At a constrained width the open Index sheet can cover a control (the 2D/3D
		 * toggle, a surface button); then the sheet is closed, the click is made again, and the step
		 * records that it did so. Nothing else about the step changes.
		 */
		const click = async (locator, label) => {
			journal.lastAction = label;
			await locator.first().waitFor({ state: 'visible', timeout: 20000 });
			try {
				await locator.first().click({ timeout: 4000 });
			} catch (error) {
				await hideIndexIfOpen();
				await locator.first().click({ timeout: 20000 });
				journal.sheetClosedFor = [...(journal.sheetClosedFor ?? []), label];
			}
			await page.waitForTimeout(400);
			return label;
		};
		const dockKey = (name) =>
			TREE === 'after'
				? page.locator('[data-experience-dock]').getByRole('button', { name, exact: true })
				: page.locator('[aria-label="Experience dock"]').getByRole('button', { name, exact: true });
		const presentationRows = () =>
			TREE === 'after'
				? page.locator('[data-presentation-id] button.item-row')
				: page.locator('section[aria-label="Presentations"] ul.rows li button.row');
		const stopRows = () => (TREE === 'after' ? page.locator('ol[aria-label="Stops"] li') : page.locator('ol.stop-list li'));
		const guideKeyLocator = () => dockKey('Guide');
		/** Opens the Guide only to read its Stops after an Undo; the Guide's open state is recorded as it stands. */
		const openGuideForRead = async () => {
			const state = await page.evaluate(READ_STATE, TREE);
			if (!state.guideOpen && TREE === 'after') await click(guideKeyLocator(), 'open Guide to read Stops');
			await page.waitForTimeout(400);
		};
		const ensureIndexOpenForRead = async () => {
			const state = await page.evaluate(READ_STATE, TREE);
			if (!state.indexOpen && (await page.getByRole('button', { name: 'Toggle Index' }).count()) > 0)
				await page.getByRole('button', { name: 'Toggle Index' }).first().click({ timeout: 20000 });
			await page.waitForTimeout(200);
		};
		const ensureIndexOpen = async () => {
			const open = await page.evaluate(READ_STATE, TREE).then((s) => s.indexOpen);
			if (!open && (await page.getByRole('button', { name: 'Toggle Index' }).count()) > 0)
				await click(page.getByRole('button', { name: 'Toggle Index' }), 'open Index');
		};

		// ---- 00 · project baseline: create, install the starter, select a World subject ----
		await page.goto(`${ORIGIN}/projects`, { waitUntil: 'load' });
		await page.waitForTimeout(1500);
		await click(page.getByRole('button', { name: 'New Project' }), 'new');
		await page.waitForURL(/\/project\//, { timeout: 30000 });
		await page.getByRole('application', { name: 'Spatial stage' }).waitFor({ timeout: 30000 });
		await page.waitForTimeout(2500);
		// The Index is opened after the starter: at a constrained width its open sheet would cover the replacement dialog.
		await page.locator('input[aria-label="Find a subject, tool or operation"]').fill('enclosed room');
		await page.waitForTimeout(500);
		await click(page.getByRole('button', { name: /Use enclosed room starter/ }), 'starter');
		// The Find entry asks before it replaces the scratch project's empty baseline; the creator confirms it here.
		await click(page.getByRole('button', { name: 'Replace', exact: true }), 'confirm the starter replacement');
		await page.waitForTimeout(3500);
		await ensureIndexOpen();
		await record(0, 'world-baseline');

		// The World selection the lens round trip must keep (lens parking): the starter's room row.
		await click(page.locator('#plate-index .item-row').filter({ hasText: /Room/ }), 'select a World room');
		await page.waitForTimeout(500);
		await record(1, 'world-subject-selected');

		// ---- 02 · enter the Experience lens ----
		await click(page.getByRole('button', { name: 'Experience', exact: true }), 'lens experience');
		await page.waitForTimeout(1200);
		await ensureIndexOpen();
		await record(2, 'enter-experience');

		// ---- 03 · create the Experience ----
		await click(page.getByRole('button', { name: 'Create Experience', exact: true }), 'create experience');
		await waitUntil(async () => (await page.evaluate(READ_STATE, TREE)).crumb !== null || (await page.evaluate(READ_STATE, TREE)).createVisible === false);
		await record(3, 'create-experience');

		// ---- 04 · the 3D reading, needed for Capture ----
		// At a constrained width the open Index sheet can cover the 2D/3D control; the Stage's own key (3) is the same intent.
		let threeDInput = 'pointer click on 3D';
		try {
			await click(page.getByRole('button', { name: '3D', exact: true }), '3D');
		} catch (error) {
			await page.evaluate(() => document.activeElement && document.activeElement.blur());
			await page.keyboard.press('3');
			threeDInput = 'keyboard 3: the 3D control was covered at this width';
		}
		await page.waitForTimeout(800);
		await record(4, 'three-d', { input: threeDInput });

		// ---- 05 · create Presentation 1 (Capture, no Guide yet) ----
		await click(dockKey('Capture'), 'capture 1');
		await waitUntil(async () => (await presentationRows().count()) >= 1, 15000);
		await record(5, 'create-presentation-1');

		// ---- 06 · the first Guide, named in its panel, from the selected Presentation ----
		if (TREE === 'after') {
			const state = await page.evaluate(READ_STATE, TREE);
			if (!state.guideOpen) await click(guideKeyLocator(), 'open Guide');
		}
		const firstGuideLabel = page.getByLabel('Guide label', { exact: true });
		await firstGuideLabel.first().waitFor({ state: 'visible', timeout: 15000 });
		await firstGuideLabel.first().fill('Tour');
		await click(page.getByRole('button', { name: 'Create first Guide', exact: true }), 'create first Guide');
		await waitUntil(async () => (await page.evaluate(READ_STATE, TREE)).stops.length >= 1);
		await record(6, 'create-first-guide');

		// ---- 07, 08 · capture 2 and 3 more Stops into the open Guide ----
		await click(dockKey('Capture'), 'capture 2');
		await waitUntil(async () => (await presentationRows().count()) >= 2);
		await record(7, 'capture-2');
		await click(dockKey('Capture'), 'capture 3');
		await waitUntil(async () => (await presentationRows().count()) >= 3);
		await record(8, 'capture-3');

		// ---- 09 · reorder: move the last Stop up ----
		const lastStop = stopRows().last();
		await click(lastStop.getByRole('button', { name: 'Move up' }), 'move up');
		await page.waitForTimeout(800);
		await record(9, 'reorder-move-up');

		// ---- 10 · View: select Presentation 1 and read its Views and Default View ----
		await click(presentationRows().first(), 'select Presentation 1');
		await page.waitForTimeout(500);
		await record(10, 'view-presentation-1');

		// ---- 11 · open the Guide ----
		{
			const state = await page.evaluate(READ_STATE, TREE);
			if (!state.guideOpen) await click(guideKeyLocator(), 'open Guide');
		}
		await record(11, 'open-guide');

		// ---- 12, 13 · Preview, then exit it ----
		await click(page.getByRole('button', { name: 'Preview', exact: true }), 'preview');
		await waitUntil(async () => (await page.evaluate(READ_STATE, TREE)).visitorPreview, 30000);
		await page.waitForTimeout(1500);
		await record(12, 'preview-enter');
		await click(page.locator('button:visible', { hasText: /Exit Preview/ }), 'exit preview');
		await waitUntil(async () => !(await page.evaluate(READ_STATE, TREE)).visitorPreview, 15000);
		await record(13, 'preview-exit');

		// ---- 14 · return to World: the lens and the World subject it parked ----
		await click(page.getByRole('button', { name: 'World', exact: true }), 'lens world');
		await page.waitForTimeout(1000);
		await record(14, 'return-world');

		// ---- 15, 16 · Undo twice, each result read in the Experience lens (a read, not an edit) ----
		await click(page.getByRole('button', { name: 'Undo', exact: true }), 'undo 1');
		await page.waitForTimeout(900);
		await record(15, 'undo-1-world');
		await click(page.getByRole('button', { name: 'Experience', exact: true }), 'read lens experience');
		await page.waitForTimeout(1000);
		await openGuideForRead();
		await record(16, 'undo-1-read');
		await click(page.getByRole('button', { name: 'World', exact: true }), 'lens world');
		await page.waitForTimeout(600);
		await click(page.getByRole('button', { name: 'Undo', exact: true }), 'undo 2');
		await page.waitForTimeout(900);
		await record(17, 'undo-2-world');
		await click(page.getByRole('button', { name: 'Experience', exact: true }), 'read lens experience');
		await page.waitForTimeout(1000);
		await openGuideForRead();
		await record(18, 'undo-2-read');
	} catch (error) {
		journal.failure = error.message.split('\n')[0];
		journal.failureUrl = page.url().replace(/[0-9a-f-]{36}/g, '<id>');
		await page.screenshot({ path: path.join(OUT, `${tag}-FAILURE-${NAME}.png`) }).catch(() => {});
		process.exitCode = 1;
	} finally {
		fs.writeFileSync(path.join(OUT, `journey-${NAME}-${tag}.json`), JSON.stringify(journal, null, 2) + '\n');
		await browser.close();
	}
})();
