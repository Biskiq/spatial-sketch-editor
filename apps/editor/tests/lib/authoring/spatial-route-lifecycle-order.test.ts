// @vitest-environment jsdom
import { mount, tick, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	computeEnvelopeSourceContentId,
	createEmptyUnitSceneDocument,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import type { AuthoringIntent } from '@portfolio/project-model';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import type { FinishCard } from '$lib/authoring/look/finish-card.svelte';
import type { StageProjectEpoch } from '$lib/authoring/stage/route/stage-project-epoch.svelte';
import { buildStarterEnclosureLayout } from '$lib/authoring/stage/starter-gallery';
import { STUDIO_ENTRY_PARAM, STUDIO_ENTRY_VALUE } from '$lib/platform/studio-entry';
import { EXPERIENCE, VIEWS } from '../experience/fixtures';
import { primitiveEntity } from './__fixtures__/f4-current-source-fixtures';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { page } from './fixtures/app-state';
import Page from '../../../src/routes/project/[projectId]/spatial/+page.svelte';

const harness = vi.hoisted(() => ({
	epoch: null as StageProjectEpoch | null,
	card: null as FinishCard | null,
	loadProject: vi.fn(),
	loadSession: vi.fn(),
	activate: vi.fn()
}));

vi.mock('$lib/authoring/project-session/project-session.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/project-session/project-session.svelte')>();
	return {
		...actual,
		createProjectSession(input: Parameters<typeof actual.createProjectSession>[0]) {
			const session = actual.createProjectSession(input);
			harness.loadSession.mockImplementation(session.load);
			session.load = harness.loadSession;
			return session;
		}
	};
});

vi.mock('$lib/authoring/stage/route/stage-project-epoch.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/route/stage-project-epoch.svelte')>();
	return {
		...actual,
		createStageProjectEpoch(input: Parameters<typeof actual.createStageProjectEpoch>[0]) {
			const epoch = actual.createStageProjectEpoch(input);
			const activate = epoch.activate;
			harness.activate.mockImplementation(activate);
			epoch.activate = harness.activate;
			harness.epoch = epoch;
			return epoch;
		}
	};
});

vi.mock('$lib/authoring/look/finish-card.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/look/finish-card.svelte')>();
	return {
		...actual,
		createFinishCard(input: Parameters<typeof actual.createFinishCard>[0]) {
			const card = actual.createFinishCard(input);
			harness.card = card;
			return card;
		}
	};
});
vi.mock('$lib/authoring/stage/shell/StageCanvas.svelte', async () => ({
	default: (await import('./fixtures/StageCanvasProbe.svelte')).default
}));
vi.mock('$lib/platform/project-persistence', async (original) => {
	const actual = await original<typeof import('$lib/platform/project-persistence')>();
	return {
		...actual,
		createProjectAuth: () => ({
			getSession: async () => ({ authenticated: false }),
			signIn() {},
			async signOut() {}
		}),
		createProjectApi: () => ({ loadProject: harness.loadProject })
	};
});

let target: HTMLElement | null = null;
let component: ReturnType<typeof mount> | null = null;

async function mountRoute(source: ProjectEnvelope) {
	vi.stubGlobal('requestAnimationFrame', () => 1);
	vi.stubGlobal('cancelAnimationFrame', () => {});
	vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 960, 720));
	harness.loadProject.mockImplementation(async () => ({
		document: source,
		savedBaseToken: 'base',
		savedRevision: source.acceptedRevision,
		savedSourceContentId: await computeEnvelopeSourceContentId(source)
	}));
	const root = document.createElement('div');
	target = root;
	document.body.append(root);
	component = mount(Page, { target: root });
	await vi.waitFor(() => expect(root.querySelector('[data-testid="stage-canvas"]')).not.toBeNull());
	return root;
}

function button(root: HTMLElement, selector: string): HTMLButtonElement {
	const element = root.querySelector<HTMLButtonElement>(selector);
	if (element === null) throw new Error(`Missing button ${selector}`);
	return element;
}

async function chooseLens(root: HTMLElement, lens: 'world' | 'experience') {
	const label = lens === 'world' ? 'World' : 'Experience';
	const control = Array.from(root.querySelectorAll<HTMLButtonElement>('[aria-label="Product lens"] button'))
		.find((candidate) => candidate.textContent?.trim() === label);
	if (control === undefined) throw new Error(`Missing lens control ${label}`);
	control.click();
	await tick();
	return control.getAttribute('aria-pressed') === 'true';
}

afterEach(async () => {
	if (component !== null) await unmount(component);
	target?.remove();
	component = null;
	target = null;
	page.url.searchParams.delete(STUDIO_ENTRY_PARAM);
	harness.epoch = null;
	harness.card = null;
	vi.clearAllMocks();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it('keeps one mounted Canvas and the same facade and history across five lens round trips', async () => {
	const source = await createUnitProject({ id: 'project-1', name: 'Mounted project', layout: buildStarterEnclosureLayout() });
	const root = await mountRoute(source);
	const epoch = harness.epoch;
	if (epoch === null || epoch.facade === null || epoch.acceptance === null) throw new Error('Expected an admitted epoch');
	const { facade, acceptance, history } = epoch;
	const canvas = root.querySelector('[data-testid="stage-canvas"]');
	for (let round = 0; round < 5; round += 1) {
		for (const lens of ['experience', 'world'] as const) {
			expect(await chooseLens(root, lens)).toBe(true);
			expect(root.querySelector('[data-testid="stage-canvas"]')).toBe(canvas);
			expect(epoch.facade).toBe(facade);
			expect(epoch.acceptance).toBe(acceptance);
			expect(epoch.history).toBe(history);
		}
	}
	expect(harness.loadSession).toHaveBeenCalledTimes(1);
	expect(harness.loadProject).toHaveBeenCalledTimes(1);
	expect(harness.activate).toHaveBeenCalledTimes(1);
});

it('lets Show open a source finding in Experience while the Head refuses a switch during a live Studio gesture', async () => {
	page.url.searchParams.set(STUDIO_ENTRY_PARAM, STUDIO_ENTRY_VALUE);
	const source = await createUnitProject({
		id: 'project-1',
		name: 'Project with a missing Camera path',
		layout: buildStarterEnclosureLayout(),
		camera: {
			formatVersion: CAMERA_UNIT_FORMAT_VERSION,
			views: VIEWS.map((view) => ({ ...view, connectedViewIds: [] })),
			connections: []
		},
		experience: EXPERIENCE
	});
	const root = await mountRoute(source);
	await vi.waitFor(() => expect(root.querySelector('[data-studio-panel="no-objects"]')).not.toBeNull());
	const stage = harness.epoch?.facade;
	if (stage == null) throw new Error('Expected an admitted Stage');
	const gesture = stage.session.acquireGesture({
		owner: 'test:studio-live-gesture',
		evaluationId: 'test:evaluation',
		acceptedRevision: stage.snapshot().acceptedRevision,
		policy: 'cancel-on-reading-change'
	});
	expect(gesture.kind).toBe('granted');
	expect(await chooseLens(root, 'experience')).toBe(false);
	expect(stage.session.lens()).toBe('world');
	expect(stage.session.gesture()).not.toBeNull();

	button(root, '[data-finding-code="travel-gap"] .source-problem-show').click();
	await tick();

	expect(stage.session.lens()).toBe('experience');
	expect(stage.session.gesture()).toBeNull();
});

async function mountHistoryProject() {
	const object = primitiveEntity(0);
	const root = await mountRoute(await createUnitProject({
		id: 'project-1',
		name: 'History project',
		layout: buildStarterEnclosureLayout(),
		scene: { ...createEmptyUnitSceneDocument(), entities: [object] }
	}));
	const epoch = harness.epoch;
	const card = harness.card;
	if (epoch?.facade == null || epoch.acceptance === null || card === null) {
		throw new Error('Expected the admitted editing owners');
	}
	return { root, epoch, stage: epoch.facade, acceptance: epoch.acceptance, card, object };
}

type HistoryProject = Awaited<ReturnType<typeof mountHistoryProject>>;

async function acceptSceneEdit(project: HistoryProject, input: Pick<AuthoringIntent, 'kind' | 'payload' | 'targets' | 'allocatedIds'>) {
	const outcome = await project.acceptance.accept({
		...input,
		version: 1,
		operationId: crypto.randomUUID(),
		expectedRevision: project.stage.snapshot().acceptedRevision,
		capturedInputs: []
	});
	expect(outcome.kind).toBe('installed');
	await tick();
}

async function pressHistory(
	project: HistoryProject,
	control: HTMLButtonElement,
	direction: 'undo' | 'redo',
	expectedSource: string
) {
	const cancel = vi.spyOn(project.card, 'cancel');
	const step = vi.spyOn(project.epoch, direction);
	const accept = vi.spyOn(project.acceptance, 'accept');
	project.card.previewRoughness({ kind: 'entity', entityId: project.object.id }, 0.72);
	expect(project.card.gestureActive).toBe(true);
	const previousPosition = project.epoch.history.position;
	control.click();
	await vi.waitFor(() => expect(project.stage.snapshot().sourceContentId).toBe(expectedSource));
	expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(step.mock.invocationCallOrder[0]!);
	expect(step).toHaveBeenCalledOnce();
	expect(accept).not.toHaveBeenCalled();
	expect(project.card.gestureActive).toBe(false);
	expect(project.epoch.history.position).toBe(previousPosition + (direction === 'undo' ? -1 : 1));
	cancel.mockRestore();
	step.mockRestore();
	accept.mockRestore();
}

it('cancels a live Finish Card gesture before Head Undo and Redo after a lens round trip', async () => {
	const project = await mountHistoryProject();
	const before = project.stage.snapshot();
	await acceptSceneEdit(project, {
		kind: 'set-name',
		payload: { entityId: project.object.id, name: 'Renamed plinth' },
		targets: [sceneEntityReference(project.object.id, before.domain.unitRevisions.scene)],
		allocatedIds: []
	});
	const edited = project.stage.snapshot().sourceContentId;
	expect(await chooseLens(project.root, 'experience')).toBe(true);
	expect(await chooseLens(project.root, 'world')).toBe(true);
	await pressHistory(project, button(project.root, '[data-head-undo]'), 'undo', before.sourceContentId);
	await pressHistory(project, button(project.root, '[data-head-redo]'), 'redo', edited);
});

it('cancels a live Finish Card gesture before Undo from the Studio Root panel', async () => {
	const project = await mountHistoryProject();
	const entityId = 'test-studio-root';
	await acceptSceneEdit(project, {
		kind: 'create-form',
		payload: {
			plane: 'plan',
			outline: [
				{ u: 0, v: 0, smooth: false },
				{ u: 2, v: 0, smooth: false },
				{ u: 2, v: 1, smooth: false },
				{ u: 0, v: 1, smooth: false }
			],
			extent: 0.8, position: [3, 0, 2], yaw: 0, materialId: 'plaster-warm', name: 'Studio root'
		},
		targets: [],
		allocatedIds: [{ kind: 'scene-entity', id: entityId }]
	});
	expect(project.epoch.services?.objectStudio?.edit(entityId).kind).toBe('entered');
	const before = project.stage.snapshot();
	await acceptSceneEdit(project, {
		kind: 'delete-one',
		payload: { entityId },
		targets: [sceneEntityReference(entityId, before.domain.unitRevisions.scene)],
		allocatedIds: []
	});
	await pressHistory(
		project,
		button(project.root, '[data-studio-action="undo"]'),
		'undo',
		before.sourceContentId
	);
});
