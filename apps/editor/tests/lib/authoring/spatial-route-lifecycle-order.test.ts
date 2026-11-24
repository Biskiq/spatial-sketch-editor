// @vitest-environment jsdom
import { mount, tick, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	computeEnvelopeSourceContentId,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import type { StageProjectEpoch } from '$lib/authoring/stage/route/stage-project-epoch.svelte';
import { buildStarterEnclosureLayout } from '$lib/authoring/stage/starter-gallery';
import { STUDIO_ENTRY_PARAM, STUDIO_ENTRY_VALUE } from '$lib/platform/studio-entry';
import { EXPERIENCE, VIEWS } from '../experience/fixtures';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { page } from './fixtures/app-state';
import Page from '../../../src/routes/project/[projectId]/spatial/+page.svelte';

const harness = vi.hoisted(() => ({
	epoch: null as StageProjectEpoch | null,
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

vi.mock('$lib/authoring/stage/shell/EditorHead.svelte', async () => ({
	default: (await import('./fixtures/HeadProbe.svelte')).default
}));
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
	const control = button(root, `[data-testid="lens-${lens}"]`);
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
