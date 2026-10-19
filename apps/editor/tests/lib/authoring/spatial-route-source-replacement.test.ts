// @vitest-environment jsdom
/**
 * Route-level source-replacement preservation (T1 host follow-up).
 *
 * The spatial route is mounted with the real boot/admission path, the real
 * session/facade/acceptance host and the real Save state. Only the Head's
 * rendering, the WebGL Stage and the adapter catalogue are doubled: this suite
 * owns the route's replacement decision, not those components' contracts.
 *
 * The defect this file protects: `openSourceJson` and `applyReloadOffer` used to
 * assign every boot result to `boot`. A refused parse therefore unmounted the
 * still-mounted project's Stage and left an error panel with no way back, and a
 * cancelled dialog cleared the saved base first. A local source action may only
 * replace the mounted project when its source actually admits.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
	document: null as unknown,
	loadCalls: 0
}));

// `$app/state`, `$app/navigation` and `$env/dynamic/public` resolve through the
// test doubles aliased in `vitest.shared.ts`; SvelteKit's virtual modules do not
// exist in this Vite graph.

// The route's replacement decision is independent of which domain adapters are
// registered; an empty catalogue keeps the harness off the instrument tree.
vi.mock('$lib/authoring/adapters/catalog', () => ({ stageAdapterFactories: [] }));

vi.mock('$lib/authoring/stage/shell/EditorHead.svelte', async () => ({
	default: (await import('./fixtures/HeadProbe.svelte')).default
}));

vi.mock('$lib/authoring/stage/shell/StageCanvas.svelte', async () => ({
	default: (await import('./fixtures/StageCanvasProbe.svelte')).default
}));

vi.mock('$lib/platform/project-persistence', () => {
	class ProjectPersistenceError extends Error {
		readonly code: string;
		constructor(code: string, message = code) {
			super(message);
			this.code = code;
		}
	}
	return {
		ProjectPersistenceError,
		createProjectApi: () => ({
			async loadProject() {
				harness.loadCalls += 1;
				return {
					document: harness.document,
					savedBaseToken: 'token-1',
					savedRevision: { projectId: 'project-1', revisionId: 'revision-1' },
					savedSourceContentId: 'content-1'
				};
			},
			async saveAcceptedSource() {
				throw new ProjectPersistenceError('network', 'the harness never saves');
			}
		})
	};
});

import { mount, tick, unmount } from 'svelte';
import { createEmptyWallFirstProject, serializeProject } from '$lib/project/project-codec';
import Page from '../../../src/routes/project/[projectId]/spatial/+page.svelte';

let component: ReturnType<typeof mount> | null = null;
let target: HTMLElement;
let nextFile: File | null = null;

function head(): HTMLElement {
	const element = target.querySelector<HTMLElement>('[data-testid="head"]');
	if (element === null) throw new Error('the Head double is not mounted');
	return element;
}

function stageCanvas(): HTMLElement {
	const element = target.querySelector<HTMLElement>('[data-testid="stage-canvas"]');
	if (element === null) throw new Error('the Stage is not mounted');
	return element;
}

function button(label: string): HTMLButtonElement {
	const found = [...target.querySelectorAll('button')].find(
		(candidate) => candidate.textContent?.trim() === label
	);
	if (found === undefined) throw new Error(`no "${label}" button`);
	return found;
}

/** Wait for the boot/admission promise chain and Svelte's effect flush. */
async function settled(): Promise<void> {
	await tick();
	await new Promise((resolve) => setTimeout(resolve, 0));
	await tick();
}

beforeEach(() => {
	harness.document = createEmptyWallFirstProject({ id: 'project-1', name: 'Mounted project' });
	harness.loadCalls = 0;
	nextFile = null;

	// jsdom has no layout/WebGL loop; the route's frame loop is unrelated to the
	// replacement decision this suite exercises.
	vi.stubGlobal('requestAnimationFrame', () => 1);
	vi.stubGlobal('cancelAnimationFrame', () => {});
	vi.stubGlobal('matchMedia', () => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {}
	}));

	const createElement = document.createElement.bind(document);
	vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
		const element = createElement(tagName, options);
		if (tagName === 'input') {
			Object.defineProperty(element, 'files', {
				configurable: true,
				get: () => (nextFile === null ? [] : [nextFile])
			});
			(element as HTMLInputElement).click = () => {
				queueMicrotask(() => element.dispatchEvent(new Event('change')));
			};
		}
		return element;
	}) as typeof document.createElement);

	target = document.createElement('div');
	document.body.appendChild(target);
});

afterEach(() => {
	if (component !== null) unmount(component);
	component = null;
	target.replaceChildren();
	nextFile = null;
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

/** The route's explicit replacement guard, then the file dialog. */
async function requestOpen(): Promise<void> {
	button('Open source JSON').click();
	await tick();
	// An active project always asks before replacement; the creator's confirm is
	// what opens the file dialog.
	button('Replace').click();
}

async function mountReady(): Promise<void> {
	component = mount(Page, { target });
	await vi.waitFor(() => {
		if (harness.loadCalls === 0) throw new Error('the cloud boot has not run');
		expect(stageCanvas()).not.toBeNull();
	});
	expect(head().dataset.project).toBe('Mounted project');
	expect(head().dataset.saveStatus).toBe('saved');
	expect(head().dataset.saveBase).toBe('token-1');
}

describe('spatial route source replacement', () => {
	it('keeps the mounted project and its saved base when the Open dialog is cancelled', async () => {
		await mountReady();
		const originalCanvas = stageCanvas();

		await requestOpen();
		await settled();

		expect(stageCanvas()).toBe(originalCanvas);
		expect(head().dataset.project).toBe('Mounted project');
		expect(head().dataset.saveBase).toBe('token-1');
		expect(head().dataset.saveStatus).toBe('saved');
	});

	it('reports a typed refusal and keeps the mounted project for invalid Open JSON', async () => {
		await mountReady();
		const originalCanvas = stageCanvas();

		nextFile = new File(['{ "id": '], 'broken.json', { type: 'application/json' });
		await requestOpen();
		await vi.waitFor(() => {
			expect(target.textContent).toContain('The source was not opened: the JSON did not parse.');
		});

		// Same mounted Stage node: no replacement epoch ran, so selection, history
		// and the acceptance coordinator were never reset.
		expect(stageCanvas()).toBe(originalCanvas);
		expect(head().dataset.project).toBe('Mounted project');
		expect(head().dataset.canDownload).toBe('true');
		expect(head().dataset.saveBase).toBe('token-1');
		expect(head().dataset.saveStatus).toBe('saved');
	});

	it('reports the typed project-mismatch refusal without replacing the mounted project', async () => {
		await mountReady();
		const originalCanvas = stageCanvas();

		nextFile = new File(
			[serializeProject(createEmptyWallFirstProject({ id: 'project-2', name: 'Another project' }))],
			'other.json',
			{ type: 'application/json' }
		);
		await requestOpen();
		await vi.waitFor(() => {
			expect(target.textContent).toContain('The source was not opened: it belongs to another project.');
		});

		expect(stageCanvas()).toBe(originalCanvas);
		expect(head().dataset.project).toBe('Mounted project');
		expect(head().dataset.saveBase).toBe('token-1');
		expect(head().dataset.saveStatus).toBe('saved');
	});

	it('keeps the mounted project when a conflict Reload cannot admit the remote copy', async () => {
		await mountReady();
		const originalCanvas = stageCanvas();

		button('Reload remote').click();
		await vi.waitFor(() => {
			expect(target.textContent).toContain('The remote copy was not installed');
		});

		expect(stageCanvas()).toBe(originalCanvas);
		expect(head().dataset.project).toBe('Mounted project');
		expect(head().dataset.canDownload).toBe('true');
		// The Head still saves against the cloud base it was constructed with; the
		// failed offer's `remote-token` was never adopted.
		expect(head().dataset.saveBase).toBe('token-1');
		expect(head().dataset.saveStatus).toBe('saved');
	});

	it('still replaces the mounted project when an Open actually admits', async () => {
		await mountReady();

		nextFile = new File(
			[serializeProject(createEmptyWallFirstProject({ id: 'project-1', name: 'Opened project' }))],
			'valid.json',
			{ type: 'application/json' }
		);
		await requestOpen();
		await vi.waitFor(() => {
			expect(head().dataset.project).toBe('Opened project');
		});

		// An opened file is a locally minted baseline: no cloud base survives into
		// the replacement epoch.
		expect(head().dataset.saveBase).toBe('none');
		expect(head().dataset.saveStatus).toBe('never-saved');
		expect(stageCanvas()).not.toBeNull();
	});
});
