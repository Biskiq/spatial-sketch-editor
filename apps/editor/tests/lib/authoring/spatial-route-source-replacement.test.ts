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
	version: 1,
	savedBaseToken: 'token-1',
	publicationReads: 0,
	publication: {
		publicationId: null as string | null,
		activeVersion: null as number | null,
		revision: 0,
		currentVersion: 1,
		createdAt: null as string | null,
		updatedAt: null as string | null
	},
	renameCalls: [] as { projectId: string; request: unknown; signal?: AbortSignal }[],
	deleteCalls: [] as { projectId: string; request: unknown }[],
	deferDelete: false,
	releaseDelete: null as (() => void) | null,
	services: null as unknown,
	deferRename: false,
	releaseRename: null as (() => void) | null,
	// TD-10's harness: hold one admission open so a newer replacement can land
	// while the older result is still unresolved.
	deferNextBootFromSource: false,
	releaseBootFromSource: null as (() => void) | null
}));

// `$app/state`, `$app/navigation` and `$env/dynamic/public` resolve through the
// test doubles aliased in `vitest.shared.ts`; SvelteKit's virtual modules do not
// exist in this Vite graph.

vi.mock('$lib/authoring/adapters/catalog', async () => {
	const { createDomainConsumer } = await import('./__fixtures__/stage-domain-consumer');
	return {
		stageAdapterFactories: [
			(port: import('$lib/authoring/stage/stage-adapter-host').StageAdapterServices) => {
				harness.services = port;
				return createDomainConsumer('unused-layout-object', [])(port);
			}
		]
	};
});

vi.mock('$lib/authoring/stage/shell/EditorHead.svelte', async () => ({
	default: (await import('./fixtures/HeadProbe.svelte')).default
}));

vi.mock('$lib/authoring/stage/shell/StageCanvas.svelte', async () => ({
	default: (await import('./fixtures/StageCanvasProbe.svelte')).default
}));

vi.mock('$lib/platform/project-persistence', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/platform/project-persistence')>();
	return {
		...actual,
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
			async loadProject(projectId: string) {
				harness.loadCalls += 1;
				const document = harness.document as ProjectEnvelope;
				const { computeEnvelopeSourceContentId } = await import('@portfolio/project-model/units');
				return {
					projectId,
					name: document.name,
					version: harness.version,
					updatedAt: '2026-10-19T00:00:00.000Z',
					document,
			savedBaseToken: harness.loadCalls === 1 ? 'token-1' : harness.savedBaseToken,
					savedRevision: document.acceptedRevision,
					savedSourceContentId: await computeEnvelopeSourceContentId(document)
				};
			},
			async getPublicationStatus() {
				harness.publicationReads += 1;
				return harness.publication;
			},
			async renameProject(projectId: string, request: { name: string }, signal?: AbortSignal) {
				harness.renameCalls.push({ projectId, request, signal });
				if (harness.deferRename) {
					harness.deferRename = false;
					await new Promise<void>((resolve) => { harness.releaseRename = resolve; });
				}
				const { computeEnvelopeSourceContentId } = await import('@portfolio/project-model/units');
				const savedRevision = { projectId, revisionId: 'revision-renamed' };
				const document = { ...(harness.document as ProjectEnvelope), name: request.name, acceptedRevision: savedRevision };
				harness.document = document;
			harness.savedBaseToken = 'saved-base:00000000-0000-4000-8000-000000000002';
				harness.version += 1;
				return {
					projectId,
					name: request.name,
					version: harness.version,
					updatedAt: '2026-10-20T00:00:00.000Z',
					savedBaseToken: harness.savedBaseToken,
					savedRevision,
					sourceContentId: await computeEnvelopeSourceContentId(document)
				};
			},
			async deleteProject(projectId: string, request: unknown) {
				harness.deleteCalls.push({ projectId, request });
				if (harness.deferDelete) {
					harness.deferDelete = false;
					await new Promise<void>((resolve) => { harness.releaseDelete = resolve; });
				}
				return { projectId, cleanup: 'pending' as const };
			},
			async saveAcceptedSource() {
				throw new actual.ProjectPersistenceError('network', 'the harness never saves');
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
import { LAYOUT_DIMENSION_LIMIT_MESSAGE, type LayoutDocumentWallFirst } from '@portfolio/layout-core';
import { createEmptyUnitSceneDocument, serializeProjectEnvelope, type ProjectEnvelope } from '@portfolio/project-model/units';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import type { ReloadOffer } from '$lib/authoring/save/save-state';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { consumerSceneEdit } from './__fixtures__/stage-domain-consumer';
import { primitiveEntity } from './__fixtures__/f4-current-source-fixtures';
import { resetReloadOffer, setReloadOffer } from './fixtures/reload-offer';
import { navigations, resetNavigations } from './fixtures/app-navigation';
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
	mountedProject = await createUnitProject({
		id: 'project-1',
		name: 'Mounted project',
		scene: {
			...createEmptyUnitSceneDocument(),
			entities: [primitiveEntity(0)]
		}
	});
	harness.document = mountedProject;
	harness.loadCalls = 0;
	harness.version = 1;
	harness.savedBaseToken = 'saved-base:00000000-0000-4000-8000-000000000001';
	harness.publicationReads = 0;
	harness.publication = {
		publicationId: null,
		activeVersion: null,
		revision: 0,
		currentVersion: 1,
		createdAt: null,
		updatedAt: null
	};
	harness.renameCalls = [];
	harness.deleteCalls = [];
	harness.deferDelete = false;
	harness.releaseDelete = null;
	harness.services = null;
	harness.deferRename = false;
	harness.releaseRename = null;
	harness.deferNextBootFromSource = false;
	harness.releaseBootFromSource = null;
	nextFile = null;
	resetReloadOffer();
	resetNavigations();

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
	harness.releaseRename?.();
	harness.releaseRename = null;
	harness.releaseDelete?.();
	harness.releaseDelete = null;
	resetNavigations();
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

/** R217.S20: source replacement is a project-menu procedure, reached here through Find. */
function openSourceFromFind(): void {
	const entry = target.querySelector<HTMLButtonElement>(
		'[data-head-find] [data-find-adapter="project-menu"][data-find-id="source"]'
	);
	if (entry === null) throw new Error('no Open source JSON Find entry');
	entry.click();
}

/** The route's explicit replacement guard, then the file dialog. */
async function requestOpen(): Promise<void> {
	openSourceFromFind();
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

	it('reports the canonical geometry refusal, not a format refusal, for oversized Open geometry', async () => {
		await mountReady();
		const originalCanvas = stageCanvas();
		const layout: LayoutDocumentWallFirst = {
			units: 'meters',
			formatVersion: 6,
			floor: { id: 'floor', name: 'Floor', elevation: 0 },
			junctions: [
				{ id: 'j-1', point: [0, 0] },
				{ id: 'j-2', point: [2000, 0] }
			],
			walls: [
				{
					id: 'w-1',
					startJunctionId: 'j-1',
					endJunctionId: 'j-2',
					thickness: 0.2,
					height: 3,
					centerline: { kind: 'line' }
				}
			],
			rooms: [],
			openings: [],
			objects: []
		};
		const project = await createUnitProject({ id: 'project-1', name: 'Oversized' });
		const imported = {
			...project,
			units: { ...project.units, layout: { ...project.units.layout, data: layout } }
		};
		// Serialization would refuse this envelope: the file is the source that a
		// creator imported, and admission is the door that must classify it.
		nextFile = new File([JSON.stringify(imported)], 'oversized.json', { type: 'application/json' });
		await requestOpen();
		await vi.waitFor(() => {
			expect(target.textContent).toContain(LAYOUT_DIMENSION_LIMIT_MESSAGE);
		});
		expect(target.textContent).not.toContain('it is not the current document format');
		// The refusal is local: the mounted source, history and saved base survive.
		expect(stageCanvas()).toBe(originalCanvas);
		expect(head().dataset.project).toBe('Mounted project');
		expect(head().dataset.saveBase).toBe('token-1');
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

	it('pre-reads a name-only Cloud change, adopts it, and renames with the refreshed saved-base token', async () => {
		await mountReady();
		const remoteRevision = { projectId: 'project-1', revisionId: 'revision-external-rename' };
		harness.document = { ...mountedProject, name: 'Remote name', acceptedRevision: remoteRevision };
		harness.savedBaseToken = 'saved-base:00000000-0000-4000-8000-000000000003';
		harness.version = 2;

		button('Rename').click();
		const dialog = target.querySelector('dialog')!;
		await vi.waitFor(() => expect(dialog.hasAttribute('open')).toBe(true));
		const input = dialog.querySelector('input')!;
		expect(input.value).toBe('Remote name');
		expect(head().dataset.project).toBe('Remote name');
		expect(head().dataset.saveBase).toBe('saved-base:00000000-0000-4000-8000-000000000003');
		expect(harness.loadCalls).toBe(2);

		input.value = 'Final name';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await settled();
		(dialog.querySelector('button[type="submit"]') as HTMLButtonElement).click();
		await vi.waitFor(() => expect(head().dataset.project).toBe('Final name'));

		expect(harness.renameCalls).toHaveLength(1);
		expect(harness.renameCalls[0]!.projectId).toBe('project-1');
		expect(harness.renameCalls[0]!.request).toMatchObject({
			name: 'Final name',
			precondition: { kind: 'expected-saved-base', token: 'saved-base:00000000-0000-4000-8000-000000000003' }
		});
		expect(head().dataset.saveBase).toBe('saved-base:00000000-0000-4000-8000-000000000002');
		expect(head().dataset.saveStatus).toBe('saved');
	});

	it('refuses active-publication deletion before opening confirmation and navigates after pending cleanup acknowledgement', async () => {
		await mountReady();
		harness.publication = {
			publicationId: 'publication-1',
			activeVersion: 1,
			revision: 4,
			currentVersion: 1,
			createdAt: '2026-10-18T00:00:00.000Z',
			updatedAt: '2026-10-19T00:00:00.000Z'
		};
		button('Delete').click();
		// Wait for the observable read rather than a fixed number of flushed turns: the
		// prepare path awaits the project load and then the publication status, and a
		// one-macrotask `settled()` is not a guarantee that both have resolved.
		await vi.waitFor(() => expect(harness.publicationReads).toBe(1));
		expect(target.querySelector('dialog')?.hasAttribute('open')).toBe(false);
		expect(target.textContent).toContain('Unpublish this project before deleting it.');
		expect(harness.deleteCalls).toHaveLength(0);

		harness.publication = { ...harness.publication, activeVersion: null };
		button('Delete').click();
		const dialog = target.querySelector('dialog')!;
		await vi.waitFor(() => expect(dialog.hasAttribute('open')).toBe(true));
		expect(dialog.textContent).toContain('inactive public link');
		(dialog.querySelector('[data-primary-action]') as HTMLButtonElement).click();
		await vi.waitFor(() => expect(navigations).toHaveLength(1));
		expect(harness.deleteCalls).toHaveLength(1);
		expect(navigations[0]).toContain('/projects?deleted=pending');
		expect(navigations[0]).toContain('name=Mounted+project');
	});

	it('uses the unsaved-work guard for current deletion and blocks edits until its acknowledgement', async () => {
		await mountReady();
		const services = harness.services as StageAdapterServices;
		expect((await consumerSceneEdit(services)).kind).toBe('installed');
		await vi.waitFor(() => expect(head().dataset.saveStatus).toBe('dirty'));
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
		harness.publication = {
			publicationId: null,
			activeVersion: null,
			revision: 0,
			currentVersion: 1,
			createdAt: null,
			updatedAt: null
		};

		button('Delete').click();
		const dialog = target.querySelector('dialog')!;
		await vi.waitFor(() => expect(dialog.hasAttribute('open')).toBe(true));
		(dialog.querySelector('[data-primary-action]') as HTMLButtonElement).click();
		await settled();
		expect(confirm).toHaveBeenCalledOnce();
		expect(harness.deleteCalls).toHaveLength(0);
		expect(head().dataset.saveStatus).toBe('dirty');

		confirm.mockReturnValue(true);
		harness.deferDelete = true;
		(dialog.querySelector('[data-primary-action]') as HTMLButtonElement).click();
		await vi.waitFor(() => expect(harness.releaseDelete).not.toBeNull());
		expect(confirm).toHaveBeenCalledTimes(2);
		expect(stageCanvas()).not.toBeNull();
		expect((await consumerSceneEdit(services)).kind).toBe('refused');
		expect(navigations).toEqual([]);

		harness.releaseDelete?.();
		await vi.waitFor(() => expect(navigations).toHaveLength(1));
		expect(harness.deleteCalls).toHaveLength(1);
		expect(navigations[0]).toContain('/projects?deleted=pending');
	});

	it('drops a delayed rename after another source replaces the open project', async () => {
		await mountReady();
		harness.deferRename = true;
		button('Rename').click();
		const dialog = target.querySelector('dialog')!;
		await vi.waitFor(() => expect(dialog.hasAttribute('open')).toBe(true));
		const input = dialog.querySelector('input')!;
		input.value = 'Late rename';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await settled();
		(dialog.querySelector('button[type="submit"]') as HTMLButtonElement).click();
		await vi.waitFor(() => expect(harness.releaseRename).not.toBeNull());
		const requestSignal = harness.renameCalls[0]!.signal;

		const remote = await createUnitProject({ id: 'project-1', name: 'Replacement project' });
		setReloadOffer({
			kind: 'reload',
			projectId: 'project-1',
			document: remote,
			savedBaseToken: 'remote-token',
			savedRevision: remote.acceptedRevision,
			savedSourceContentId: 'remote-content'
		});
		button('Reload remote').click();
		await vi.waitFor(() => expect(head().dataset.project).toBe('Replacement project'));
		expect(requestSignal?.aborted).toBe(true);

		harness.releaseRename?.();
		await settled();
		expect(head().dataset.project).toBe('Replacement project');
		expect(head().dataset.saveBase).toBe('remote-token');
		expect(navigations).toEqual([]);
	});
});
