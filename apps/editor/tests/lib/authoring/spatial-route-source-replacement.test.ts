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
 *
 * TD-10 is the same two paths' *epoch* contract: their admission is asynchronous,
 * so a result that resolves after a newer replacement owns the Stage must be
 * abandoned — it installs no source, adopts no saved base and reports neither a
 * success nor a refusal over the project the creator now has.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
	document: null as unknown,
	loadCalls: 0,
	// TD-10's harness: hold one admission open so a newer replacement can land
	// while the older result is still unresolved.
	deferNextBootFromSource: false,
	releaseBootFromSource: null as (() => void) | null
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
		// The route constructs the auth port before deciding whether an API origin
		// exists; the harness never signs in.
		createProjectAuth: () => ({
			getSession: async () => ({
				kind: 'signed-out' as const,
				user: null,
				intent: null
			}),
			signIn: () => undefined,
			signOut: async () => undefined
		}),
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

vi.mock('$lib/authoring/stage/boot-state', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/authoring/stage/boot-state')>();
	return {
		...actual,
		async bootFromSourceJson(
			json: string,
			projectId: string,
			context: import('$lib/authoring/stage/source-admission').AdmissionContext
		) {
			if (harness.deferNextBootFromSource) {
				harness.deferNextBootFromSource = false;
				await new Promise<void>((resolve) => {
					harness.releaseBootFromSource = resolve;
				});
			}
			return actual.bootFromSourceJson(json, projectId, context);
		}
	};
});

import { mount, tick, unmount } from 'svelte';
import { serializeProjectEnvelope, type ProjectEnvelope } from '@portfolio/project-model/units';
import type { ReloadOffer } from '$lib/authoring/save/save-state';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { resetReloadOffer, setReloadOffer } from './fixtures/reload-offer';
import Page from '../../../src/routes/project/[projectId]/spatial/+page.svelte';

let component: ReturnType<typeof mount> | null = null;
let target: HTMLElement;
let nextFile: File | null = null;
let mountedProject: ProjectEnvelope;

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

beforeEach(async () => {
	mountedProject = await createUnitProject({ id: 'project-1', name: 'Mounted project' });
	harness.document = mountedProject;
	harness.loadCalls = 0;
	harness.deferNextBootFromSource = false;
	harness.releaseBootFromSource = null;
	nextFile = null;
	resetReloadOffer();

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
	harness.releaseBootFromSource?.();
	harness.releaseBootFromSource = null;
	resetReloadOffer();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

/** A current unit envelope for this project, as the Open dialog would hand one in. */
async function sourceFile(name: string): Promise<File> {
	return new File([serializeProjectEnvelope(await createUnitProject({ id: 'project-1', name }))], 'source.json', {
		type: 'application/json'
	});
}

/** The same envelope as a conflict's remote copy: a Reload that actually admits. */
async function admittedOffer(name: string): Promise<ReloadOffer> {
	return {
		kind: 'reload',
		projectId: 'project-1',
		document: await createUnitProject({ id: 'project-1', name }),
		savedBaseToken: 'remote-token',
		savedRevision: { projectId: 'project-1', revisionId: 'remote-revision' },
		savedSourceContentId: 'remote-content'
	};
}

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

	it('refuses a legacy project payload without replacing the mounted project', async () => {
		await mountReady();
		const originalCanvas = stageCanvas();

		nextFile = new File(
			[JSON.stringify({ id: 'project-1', name: 'Legacy', layout: {}, scene: {} })],
			'legacy.json',
			{ type: 'application/json' }
		);
		await requestOpen();
		await vi.waitFor(() => {
			expect(target.textContent).toContain('it is not the current document format');
		});

		expect(stageCanvas()).toBe(originalCanvas);
		expect(head().dataset.project).toBe('Mounted project');
		expect(head().dataset.saveBase).toBe('token-1');
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
			[serializeProjectEnvelope(await createUnitProject({ id: 'project-2', name: 'Another project' }))],
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
			[serializeProjectEnvelope(await createUnitProject({ id: 'project-1', name: 'Opened project' }))],
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

	it('drops a delayed admitted Open after a newer replacement owns the Stage', async () => {
		await mountReady();

		// Hold the Open's admission open, then replace the Stage through an admitted
		// reload while the older result is still unresolved.
		harness.deferNextBootFromSource = true;
		nextFile = await sourceFile('Opened project');
		await requestOpen();
		await vi.waitFor(() => expect(harness.releaseBootFromSource).not.toBeNull());

		setReloadOffer(await admittedOffer('Remote project'));
		button('Reload remote').click();
		await vi.waitFor(() => expect(head().dataset.project).toBe('Remote project'));
		const remoteCanvas = stageCanvas();
		expect(head().dataset.saveBase).toBe('remote-token');

		// The older Open completes now. Its epoch is gone: it installs nothing, clears
		// no newer saved base and reports no success over the newer project.
		harness.releaseBootFromSource?.();
		await settled();

		expect(head().dataset.project).toBe('Remote project');
		expect(stageCanvas()).toBe(remoteCanvas);
		expect(head().dataset.saveBase).toBe('remote-token');
		expect(head().dataset.saveStatus).toBe('saved');
		expect(target.textContent).not.toContain('The source was not opened');
	});

	it('reports nothing for a refused Open that a newer replacement superseded', async () => {
		await mountReady();

		harness.deferNextBootFromSource = true;
		nextFile = new File(['{ "id": '], 'broken.json', { type: 'application/json' });
		await requestOpen();
		await vi.waitFor(() => expect(harness.releaseBootFromSource).not.toBeNull());

		setReloadOffer(await admittedOffer('Remote project'));
		button('Reload remote').click();
		await vi.waitFor(() => expect(head().dataset.project).toBe('Remote project'));
		const remoteCanvas = stageCanvas();

		// The failed Open arrives after its epoch is gone: the newer project stands,
		// and the stale action reports nothing rather than a notice about a file the
		// creator no longer opened.
		harness.releaseBootFromSource?.();
		await settled();

		expect(head().dataset.project).toBe('Remote project');
		expect(stageCanvas()).toBe(remoteCanvas);
		expect(head().dataset.saveBase).toBe('remote-token');
		expect(target.textContent).not.toContain('The source was not opened');
	});

	it('drops a delayed admitted Reload after a newer replacement owns the Stage', async () => {
		await mountReady();

		setReloadOffer(await admittedOffer('Remote project'));
		harness.deferNextBootFromSource = true;
		button('Reload remote').click();
		await vi.waitFor(() => expect(harness.releaseBootFromSource).not.toBeNull());

		nextFile = await sourceFile('Opened project');
		await requestOpen();
		await vi.waitFor(() => expect(head().dataset.project).toBe('Opened project'));
		const openedCanvas = stageCanvas();

		// The remote copy that arrives now belongs to the replaced epoch: it must not
		// install itself or adopt its saved base over the newer open.
		harness.releaseBootFromSource?.();
		await settled();

		expect(head().dataset.project).toBe('Opened project');
		expect(stageCanvas()).toBe(openedCanvas);
		expect(head().dataset.saveBase).toBe('none');
		expect(head().dataset.saveStatus).toBe('never-saved');
	});

	it('reports nothing for a refused Reload that a newer replacement superseded', async () => {
		await mountReady();

		// The fixture's default offer cannot admit, so this is the refusal branch.
		harness.deferNextBootFromSource = true;
		button('Reload remote').click();
		await vi.waitFor(() => expect(harness.releaseBootFromSource).not.toBeNull());

		nextFile = await sourceFile('Opened project');
		await requestOpen();
		await vi.waitFor(() => expect(head().dataset.project).toBe('Opened project'));
		const openedCanvas = stageCanvas();

		harness.releaseBootFromSource?.();
		await settled();

		expect(head().dataset.project).toBe('Opened project');
		expect(stageCanvas()).toBe(openedCanvas);
		expect(target.textContent).not.toContain('The remote copy was not installed');
	});
});
