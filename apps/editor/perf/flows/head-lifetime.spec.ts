/**
 * Route head cleanup: real SSR/hydration and same-realm navigation.
 * Dynamic-title case requires PUBLIC_API_ORIGIN (or PERF_API_ORIGIN) both here
 * and as PUBLIC_API_ORIGIN on the preview. Public/auth responses are intercepted;
 * no API server, publication creation, session, or authoring import is needed.
 */
import { expect, test, type Page } from '@playwright/test';
import { createEmptyUnitEnvelope } from '@portfolio/project-model/units';
import { newMeasuredSession } from '../lib/browser';
import { closeProjectToHub, openProjectFromHub } from '../lib/flow';

const publicationId = '11111111-1111-4111-8111-111111111111';
const routes = [
	['/', 'Museum Editor'],
	['/editor', 'Museum editor'],
	['/projects', 'Projects — Museum Editor'],
	['/dev/assets', 'Asset Preview — Chopin Museum Dev'],
	['/dev/materials', 'Material Preview — Chopin Museum Dev'],
	['/p/invalid', 'Published project']
] as const;

async function anonymousSession(page: Page) {
	await page.route('**/projects/*', (route) => route.fulfill({
		status: 404, json: { error: 'not_found' },
		headers: { 'access-control-allow-origin': new URL(page.url()).origin, 'access-control-allow-credentials': 'true' }
	}));
	// Keep this metadata contract independent of the optional local API stack.
	await page.route('**/auth/me', (route) => route.fulfill({
		json: { authenticated: false },
		headers: { 'access-control-allow-origin': new URL(page.url()).origin, 'access-control-allow-credentials': 'true' }
	}));
}

async function navigate(page: Page, href: string) {
	// A regular link enters SvelteKit's public client navigation path, even for
	// routes that have no product link connecting them to the project hub.
	await page.evaluate((href) => {
		const link = document.createElement('a');
		link.href = href; link.id = 'head-navigation-proof'; link.textContent = 'Navigate';
		document.body.append(link);
	}, href);
	await page.locator('#head-navigation-proof').click();
	await expect(page).toHaveURL(href === '/editor' ? /\/project\/[^/]+\/spatial\?create=1$/ : new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
	await page.locator('#head-navigation-proof').evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
}

async function metadata(page: Page, title: string, published = false) {
	await expect(page).toHaveTitle(title);
	await expect(page.locator('head title')).toHaveCount(1);
	await expect(page.locator('head meta[name="robots"]')).toHaveCount(published ? 1 : 0);
	if (published) await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex');
}

test('each cold route SSR and hydration keeps its title and publication robots metadata', async ({ page, request }) => {
	await anonymousSession(page);
	const coldRoutes = [...routes, [`/p/${publicationId}`, 'Published project'] as const];
	// Concurrent independent requests also exercise request isolation.
	const responses = await Promise.all(coldRoutes.map(async ([href, title]) => {
		const response = await request.get(href);
		expect(response.ok()).toBe(true);
		const html = await response.text();
		const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
		expect(head).toContain(`<title>${title}</title>`);
		expect((head.match(/<title>/g) ?? []).length).toBe(1);
		expect(head.includes('name="robots"')).toBe(href.startsWith('/p/'));
		return href;
	}));
	expect(responses).toHaveLength(coldRoutes.length);
	for (const [href, title] of coldRoutes) {
		await page.goto(href);
		await metadata(page, title, href.startsWith('/p/'));
		await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
		await metadata(page, title, href.startsWith('/p/'));
	}
});

test('published bundle titles update and clear across client navigation without head growth', async ({ page }) => {
	test.skip(!process.env.PUBLIC_API_ORIGIN && !process.env.PERF_API_ORIGIN, 'requires preview PUBLIC_API_ORIGIN and the same PUBLIC_API_ORIGIN or PERF_API_ORIGIN in the test environment');
	await anonymousSession(page);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const publishedDocument = await createEmptyUnitEnvelope({ id: 'head-publication', name: 'Released <Title> & Name', acceptedRevision: { projectId: 'head-publication', revisionId: 'revision-1' } });
	await page.route(`**/publications/${publicationId}`, (route) => route.fulfill({
		json: { name: publishedDocument.name, version: 1, revision: 1, document: publishedDocument, assets: [] },
		headers: { 'access-control-allow-origin': '*' }
	}));
	await page.goto('/projects');
	const lifetime = await page.evaluate(() => performance.timeOrigin);
	// Warm every route/CSS load once before counting persistent resources.
	for (const [href, title] of routes) { await navigate(page, href); await metadata(page, title, href.startsWith('/p/')); }
	await navigate(page, '/projects');
	const count = () => page.evaluate(() => ({
		children: document.head.childNodes.length,
		text: [...document.head.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).length
	}));
	const baseline = await count();
	const samples = [baseline];
	for (let cycle = 0; cycle < 6; cycle++) {
		await navigate(page, `/p/${publicationId}`);
		await metadata(page, 'Released <Title> & Name — Published', true);
		await navigate(page, '/p/invalid');
		await metadata(page, 'Published project', true);
		await navigate(page, '/editor');
		await metadata(page, 'Museum editor');
		await navigate(page, '/projects');
		await metadata(page, 'Projects — Museum Editor');
		expect(await page.evaluate(() => performance.timeOrigin)).toBe(lifetime);
		samples.push(await count());
		expect(samples.at(-1)).toEqual(baseline);
	}
	console.log(`metadata navigation head samples: ${JSON.stringify(samples)}`);
	expect(errors).toEqual([]);
});

test('empty project navigation has exact connected counts and no native growth', async ({ browser }) => {
	const session = await newMeasuredSession(browser, { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, network: 'N0', cacheState: 'repeat-use' });
	try {
		const { page, cdp } = session;
		await anonymousSession(page);
		await page.goto('/projects');
		const lifetime = await page.evaluate(() => performance.timeOrigin);
		const cycle = async () => { await openProjectFromHub(page); await closeProjectToHub(page); };
		const measure = async () => {
			await cdp.send('HeapProfiler.collectGarbage');
			return {
				...await cdp.send('Memory.getDOMCounters'),
				connected: await page.evaluate(() => {
					const walker = document.createTreeWalker(document, NodeFilter.SHOW_ALL);
					let nodes = 1; while (walker.nextNode()) nodes++;
					return { nodes, headChildren: document.head.childNodes.length, headText: [...document.head.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).length };
				})
			};
		};
		await cycle();
		const baseline = await measure();
		const samples = [baseline];
		for (let index = 0; index < 6; index++) {
			await cycle();
			expect(await page.evaluate(() => performance.timeOrigin)).toBe(lifetime);
			const sample = await measure(); samples.push(sample);
			expect(sample.connected).toEqual(baseline.connected);
			expect(sample.documents).toBe(baseline.documents);
			expect(sample.jsEventListeners).toBe(baseline.jsEventListeners);
			// Detached browser bookkeeping may collect later; no native growth is allowed.
			expect(sample.nodes).toBeLessThanOrEqual(baseline.nodes);
		}
		console.log(`empty project native/head samples: ${JSON.stringify(samples)}`);
	} finally { await session.close(); }
});
