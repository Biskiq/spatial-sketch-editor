// @vitest-environment jsdom
/**
 * Mounted spatial-route regressions for TD-9 and executable closure.
 *
 * These are route-level facts, not state-machine facts:
 *
 * 1. a create-only Save interrupted by sign-in remains explicitly resumable when
 *    the return visit still sees a 404, and the resumed Save replays the exact
 *    source, operation ID and precondition;
 * 2. resuming is a replacement, so cancelling the unsaved-work confirmation
 *    leaves the mounted source, history and saved base untouched;
 * 3. an admission that completes after a newer replacement is dropped;
 * 4. executable closure is disclosed and disables Save without suppressing the
 *    source or inventing the missing resource.
 *
 * Only the Head, the WebGL Stage and the adapter catalogue are doubled. Boot,
 * admission, session, facade, acceptance and Save are the real route graph.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
	loadKind: 'document' as 'document' | 'not-found' | 'auth',
	loadCalls: 0,
	document: null as unknown,
	savedBaseToken: null as string | null,
	savedRevision: { projectId: 'project-1', revisionId: 'revision-1' },
	saveBehavior: 'success' as 'auth' | 'success',
	saves: [] as unknown[],
	signInCalls: [] as (string | undefined)[],
	deferNextBootFromSource: false,
	releaseBootFromSource: null as (() => void) | null,
	services: null as unknown
}));

vi.mock('$lib/authoring/adapters/catalog', async () => {
	const { createDomainConsumer } = await import('./__fixtures__/stage-domain-consumer');
	return {
		stageAdapterFactories: [
			(port: import('$lib/authoring/stage/stage-adapter-host').StageAdapterServices) => {
				harness.services = port;
				return createDomainConsumer('unused', [])(port);
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
		createProjectAuth: () => ({
			getSession: async () => ({ authenticated: false as const }),
			signIn: (intent?: string) => {
				harness.signInCalls.push(intent);
			},
			signOut: async () => undefined
		}),
		createProjectApi: () => ({
			async loadProject() {
				harness.loadCalls += 1;
				if (harness.loadKind === 'auth') {
					throw new actual.ProjectPersistenceError('auth', 'sign in');
				}
				if (harness.loadKind === 'not-found') {
					throw new actual.ProjectPersistenceError('not-found', 'missing');
				}
				return {
					document: harness.document,
					savedBaseToken: harness.savedBaseToken,
					savedRevision: harness.savedRevision,
					savedSourceContentId: 'sha256-content'
				};
			},
			async saveAcceptedSource(request: import('@portfolio/project-model/save').SaveRequest) {
				harness.saves.push(request);
				if (harness.saveBehavior === 'auth') {
					throw new actual.ProjectPersistenceError('auth', 'sign in');
				}
				const socket = '00000000-0000-4000-8000-000000000002';
				harness.savedBaseToken = `saved-base:${socket}`;
				return {
					projectId: request.capture.projectId,
					name: 'Untitled project',
					version: 1,
					updatedAt: '2026-10-19T00:00:00.000Z',
					savedBaseToken: harness.savedBaseToken,
					savedRevision: request.capture.acceptedRevision,
					sourceContentId: request.capture.sourceContentId
				};
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
import type { AcceptedRevision } from '@portfolio/project-model';
import {
	SCENE_UNIT_FORMAT_VERSION,
	computeEnvelopeSourceContentId,
	serializeProjectEnvelope,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import {
	SAVE_CONTENT_IDENTITY_SCHEME,
	type SavePrecondition,
	type SaveRequest
} from '@portfolio/project-model/save';
import {
	readPendingCloudSave,
	writePendingCloudSave
} from '$lib/platform/project-persistence';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageScene } from '$lib/authoring/stage/unit-stage-source';
import { consumerSceneEdit } from './__fixtures__/stage-domain-consumer';
import { primitiveEntity } from './__fixtures__/f4-current-source-fixtures';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { page } from './fixtures/app-state';
import Page from '../../../src/routes/project/[projectId]/spatial/+page.svelte';

const PROJECT_ID = 'project-1';
const BASE_TOKEN = 'saved-base:00000000-0000-4000-8000-000000000001';
const REVISION: AcceptedRevision = { projectId: PROJECT_ID, revisionId: 'revision-1' };

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

function headSaveButton(): HTMLButtonElement {
	const found = target.querySelector<HTMLButtonElement>('[data-testid="head-save"]');
	if (found === null) throw new Error('the Head Save control is not mounted');
	return found;
}

function viewUrl(search = ''): string {
	return `http://localhost/project/${PROJECT_ID}/spatial${search}`;
}

async function settled(): Promise<void> {
	await tick();
	await new Promise((resolve) => setTimeout(resolve, 0));
	await tick();
}

async function sceneProject(name: string): Promise<ProjectEnvelope> {
	return createUnitProject({
		id: PROJECT_ID,
		name,
		acceptedRevision: REVISION,
		scene: {
			formatVersion: SCENE_UNIT_FORMAT_VERSION,
			textures: [],
			materials: [],
			entities: [primitiveEntity(0)]
		}
	});
}

async function captureOf(
	project: ProjectEnvelope,
	precondition: SavePrecondition,
	revision: AcceptedRevision = REVISION,
	operationId = 'operation-resume-1'
): Promise<SaveRequest> {
	return {
		contentIdentityScheme: SAVE_CONTENT_IDENTITY_SCHEME,
		capture: {
			protocol: 'SaveAcceptedSource@1',
			projectId: project.id,
			operationId,
			precondition,
			sourceKind: 'unit-envelope',
			sourceVersion: 1,
			acceptedRevision: revision,
			sourceContentId: await computeEnvelopeSourceContentId(project),
			canonicalJson: serializeProjectEnvelope(project)
		}
	};
}

async function mountPage(search = ''): Promise<void> {
	page.url = new URL(viewUrl(search));
	component = mount(Page, { target });
}

async function waitForReady(projectName?: string): Promise<void> {
	await vi.waitFor(() => {
		expect(stageCanvas()).not.toBeNull();
		if (projectName !== undefined) expect(head().dataset.project).toBe(projectName);
	});
}

beforeEach(() => {
	sessionStorage.clear();
	harness.loadKind = 'document';
	harness.loadCalls = 0;
	harness.document = null;
	harness.savedBaseToken = BASE_TOKEN;
	harness.savedRevision = { projectId: 'project-1', revisionId: 'revision-1' };
	harness.saveBehavior = 'success';
	harness.saves = [];
	harness.signInCalls = [];
	harness.deferNextBootFromSource = false;
	harness.releaseBootFromSource = null;
	harness.services = null;
	nextFile = null;

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
	sessionStorage.clear();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('spatial route resume Save', () => {
	it('boots minted projects directly into an admitted empty Stage without a cloud read and keeps the starter in Find', async () => {
		harness.loadKind = 'auth';
		await mountPage('?create=1');
		await waitForReady('Untitled project');

		expect(harness.loadCalls).toBe(0);
		expect(head().dataset.saveStatus).toBe('never-saved');
		expect(target.querySelector('[data-find-id="starter"][data-find-adapter="project-replacement"]')).not.toBeNull();

		target.querySelector<HTMLButtonElement>('[data-find-id="starter"][data-find-adapter="project-replacement"]')!.click();
		await vi.waitFor(() => expect(target.querySelector('[aria-label="Replace project"]')).not.toBeNull());
		button('Replace').click();
		await waitForReady('Enclosed room');
		expect(harness.loadCalls).toBe(0);
	});

	it('captures identical project source bytes with browser preferences unset and set', async () => {
		const stored = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => stored.get(key) ?? null,
			setItem: (key: string, value: string) => stored.set(key, value)
		});
		harness.loadKind = 'document';
		harness.document = await sceneProject('Preferences fixture');
		harness.savedBaseToken = null;
		harness.saveBehavior = 'auth';
		await mountPage();
		await waitForReady('Preferences fixture');
		expect(target.querySelector('[data-head-motion]')?.getAttribute('aria-pressed')).toBe('false');
		headSaveButton().click();
		await vi.waitFor(() => expect(harness.saves).toHaveLength(1));
		const first = harness.saves[0] as SaveRequest;
		target.querySelector<HTMLButtonElement>('[data-head-motion]')!.click();
		await settled();
		expect([...stored.values()].some((value) => value.includes('"reducedMotion":true'))).toBe(true);
		unmount(component!);
		component = null;
		target.replaceChildren();
		sessionStorage.clear();
		harness.loadKind = 'document';
		harness.document = JSON.parse(first.capture.canonicalJson);
		harness.savedBaseToken = null;
		harness.savedRevision = first.capture.acceptedRevision;
		await mountPage();
		await waitForReady('Preferences fixture');
		expect(target.querySelector('[data-head-motion]')?.getAttribute('aria-pressed')).toBe('true');
		headSaveButton().click();
		await vi.waitFor(() => expect(harness.saves).toHaveLength(2));
		const second = harness.saves[1] as SaveRequest;
		expect(second.capture.canonicalJson).toBe(first.capture.canonicalJson);
	});
	it('offers a create-only capture after the sign-in return 404 and replays it exactly', async () => {
		// First visit: a minted identity starts locally without a cloud read, then the
		// Save answers auth-required and the route captures it.
		harness.loadKind = 'auth';
		harness.saveBehavior = 'auth';
		await mountPage('?create=1');
		await waitForReady('Untitled project');
		expect(harness.loadCalls).toBe(0);
		expect(head().dataset.saveStatus).toBe('never-saved');

		headSaveButton().click();
		await vi.waitFor(() => {
			expect(harness.saves).toHaveLength(1);
			expect(harness.signInCalls).toContain('save');
			expect(readPendingCloudSave().status).toBe('ready');
		});
		const first = harness.saves[0] as SaveRequest;
		expect(first.capture.precondition).toEqual({ kind: 'create-only' });

		// The return visit still sees no row: a create-only capture is resumable
		// precisely because the Save never reached the server.
		unmount(component!);
		component = null;
		target.replaceChildren();
		harness.loadKind = 'not-found';
		harness.saveBehavior = 'success';
		await mountPage('?resume-save=1');
		expect(harness.loadCalls).toBe(1);
		await vi.waitFor(() => {
			expect(button('Resume pending Save')).not.toBeNull();
		});
		expect(harness.saves).toHaveLength(1);
		expect(target.textContent).toContain('A Save captured before sign-in is available.');

		// Resuming is the explicit creator action. It mounts the capture and replays
		// that exact operation: same source bytes, operation ID and precondition.
		button('Resume pending Save').click();
		await vi.waitFor(() => {
			expect(head().dataset.project).toBe('Untitled project');
			expect(harness.saves).toHaveLength(2);
		});
		await settled();
		const resumed = harness.saves[1] as SaveRequest;
		expect(resumed).toEqual(first);
		expect(head().dataset.saveStatus).toBe('saved');
		expect(stageCanvas()).not.toBeNull();
		expect(readPendingCloudSave().status).toBe('missing');
	});

	it('replays an expected-base capture exactly after the sign-in return', async () => {
		const project = await sceneProject('Mounted project');
		harness.document = project;
		const captured = await captureOf(project, {
			kind: 'expected-saved-base',
			token: BASE_TOKEN
		});
		writePendingCloudSave(captured);
		await mountPage('?resume-save=1');
		await waitForReady('Mounted project');
		await vi.waitFor(() => expect(button('Resume pending Save')).not.toBeNull());
		expect(harness.saves).toHaveLength(0);

		button('Resume pending Save').click();
		await vi.waitFor(() => {
			expect(harness.saves).toHaveLength(1);
			expect(head().dataset.saveStatus).toBe('saved');
		});
		await settled();
		const resumed = harness.saves[0] as SaveRequest;
		// Same operation ID, same expected saved base, same canonical bytes.
		expect(resumed).toEqual(captured);
		expect(resumed.capture.precondition).toEqual({ kind: 'expected-saved-base', token: BASE_TOKEN });
		expect(readPendingCloudSave().status).toBe('missing');
	});

	it('cancelling the unsaved-work confirmation preserves content, history and saved base', async () => {
		const project = await sceneProject('Mounted project');
		harness.document = project;
		writePendingCloudSave(
			await captureOf(project, { kind: 'expected-saved-base', token: BASE_TOKEN })
		);
		await mountPage('?resume-save=1');
		await waitForReady('Mounted project');
		await vi.waitFor(() => expect(button('Resume pending Save')).not.toBeNull());

		// One real accepted Scene edit makes the mounted project dirty. The Stage
		// node and history are what a cancelled resume must not disturb.
		const services = harness.services as StageAdapterServices;
		expect((await consumerSceneEdit(services)).kind).toBe('installed');
		const snapshot = services.stage.snapshot();
		const reference = {
			version: 1 as const, domain: 'scene' as const,
			revision: { kind: 'exact' as const, contentRevision: snapshot.domain.unitRevisions.scene },
			subject: { kind: 'entity', id: 'entity-plinth' }, instancePath: [],
			location: { kind: 'project-root' as const }, componentId: null, capabilityId: null
		};
		expect(services.stage.setSelection({ ordered: [{ reference }], primary: reference }).kind).toBe('selected');
		await vi.waitFor(() => {
			expect(head().dataset.saveStatus).toBe('dirty');
			expect(head().dataset.canUndo).toBe('true');
		});
		const canvas = stageCanvas();
		const before = services.stage.snapshot();
		const selection = services.stage.selectionState();
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

		button('Resume pending Save').click();
		await settled();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(stageCanvas()).toBe(canvas);
		expect(head().dataset.project).toBe('Mounted project');
		expect(head().dataset.saveStatus).toBe('dirty');
		expect(head().dataset.saveBase).toBe(BASE_TOKEN);
		expect(head().dataset.canUndo).toBe('true');
		expect(harness.saves).toHaveLength(0);
		expect(services.stage.snapshot()).toBe(before);
		expect(services.stage.selectionState()).toEqual(selection);

		// The same offer can still be explicitly confirmed. It replaces the edited
		// session and its history, then sends the captured source rather than the edit.
		confirm.mockReturnValue(true);
		button('Resume pending Save').click();
		await vi.waitFor(() => expect(head().dataset.saveStatus).toBe('saved'));
		expect(confirm).toHaveBeenCalledTimes(2);
		expect(head().dataset.canUndo).toBe('false');
		expect(stageScene((harness.services as StageAdapterServices).stage.snapshot()).entities[0]).toMatchObject({ receiveShadow: false });
		expect(harness.saves).toHaveLength(1);
		expect((harness.saves[0] as SaveRequest).capture.precondition).toEqual({ kind: 'expected-saved-base', token: BASE_TOKEN });
	});

	it('drops an older resume admission after a newer replacement owns the Stage', async () => {
		const project = await sceneProject('Mounted project');
		harness.document = project;
		writePendingCloudSave(
			await captureOf(project, { kind: 'expected-saved-base', token: BASE_TOKEN }, REVISION, 'operation-stale')
		);
		await mountPage('?resume-save=1');
		await waitForReady('Mounted project');
		await vi.waitFor(() => expect(button('Resume pending Save')).not.toBeNull());

		// Hold the resume admission open, then replace the Stage through the normal
		// Open path while that older admission is still in flight.
		harness.deferNextBootFromSource = true;
		button('Resume pending Save').click();
		await vi.waitFor(() => expect(harness.releaseBootFromSource).not.toBeNull());

		nextFile = new File(
			[serializeProjectEnvelope(await sceneProject('Opened project'))],
			'opened.json',
			{ type: 'application/json' }
		);
		button('Open source JSON').click();
		await tick();
		button('Replace').click();
		await vi.waitFor(() => expect(head().dataset.project).toBe('Opened project'));
		const openedCanvas = stageCanvas();

		// The older capture completes now. Its session token is stale, so it must
		// not overwrite the replacement; the offer stays available for a retry.
		harness.releaseBootFromSource?.();
		await settled();

		expect(head().dataset.project).toBe('Opened project');
		expect(stageCanvas()).toBe(openedCanvas);
		expect(head().dataset.saveBase).toBe('none');
		expect(head().dataset.saveStatus).toBe('never-saved');
		expect(button('Resume pending Save')).not.toBeNull();
		expect(harness.saves).toHaveLength(0);
	});

	it('discloses executable closure and disables Save without hiding the source', async () => {
		const base = await sceneProject('Closure project');
		const PIN = { hash: 'sha256-paper', mime: 'image/png', size: 512, locator: 'objects/paper' } as const;
		const closed: ProjectEnvelope = {
			...base,
			dependencyLock: {
				formatVersion: 1,
				entries: [
					{
						domain: 'resource:texture',
						subjectKind: 'resource',
						subjectId: 'paper',
						instancePath: [],
						contentRevision: PIN.hash,
						requiredCapabilities: [],
						pin: PIN
					}
				]
			}
		};
		harness.document = closed;
		await mountPage();
		await waitForReady('Closure project');

		expect(target.textContent).toContain('This source cannot execute.');
		expect(target.textContent).toContain('missing-resource');
		expect(head().dataset.saveDisabled).toBe('true');
		expect(head().dataset.saveLabel).toBe('Save unavailable');
		expect(target.querySelector('[data-testid="head-save-reason"]')?.textContent).toContain(
			'missing-resource'
		);
		// The source is still shown for inspection; nothing was fabricated.
		expect(stageCanvas()).not.toBeNull();
	});
});
