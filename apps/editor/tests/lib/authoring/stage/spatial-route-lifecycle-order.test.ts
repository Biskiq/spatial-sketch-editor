// @vitest-environment jsdom
import { mount, tick, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	computeEnvelopeSourceContentId,
	createEmptyUnitSceneDocument,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import { experienceFocus } from '$lib/authoring/experience/focus.svelte';
import { interiorLift } from '$lib/authoring/layout/interior-lift-store.svelte';
import { wallFace } from '$lib/authoring/layout/wall-face-store';
import { nearWallCutaway } from '$lib/authoring/stage/cutaway/near-wall-cutaway.svelte';
import { sliceReading } from '$lib/authoring/stage/slice/slice-reading.svelte';
import type { FinishCard } from '$lib/authoring/look/finish-card.svelte';
import type { ReloadOffer } from '$lib/authoring/save/save-state';
import type { StageProjectEpoch } from '$lib/authoring/stage/route/stage-project-epoch.svelte';
import type { StageKeyboardInput } from '$lib/authoring/stage/route/stage-keyboard';
import type { StageFacade } from '$lib/authoring/stage/stage-facade';
import { buildStarterEnclosureLayout } from '$lib/authoring/stage/starter-gallery';
import { STUDIO_ENTRY_PARAM, STUDIO_ENTRY_VALUE } from '$lib/platform/studio-entry';
import { EXPERIENCE, VIEWS } from '../../experience/fixtures';
import { primitiveEntity } from '../__fixtures__/f4-current-source-fixtures';
import { createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
import { page } from '../fixtures/app-state';
import Page from '../../../../src/routes/project/[projectId]/spatial/+page.svelte';

const harness = vi.hoisted(() => ({
	epoch: null as StageProjectEpoch | null,
	events: [] as string[],
	card: null as FinishCard | null,
	applyReloadOffer: null as ((offer: ReloadOffer) => Promise<boolean>) | null,
	configureKeyboard: null as ((input: StageKeyboardInput) => StageKeyboardInput) | null,
	loadProject: vi.fn(),
	loadSession: vi.fn(),
	activate: vi.fn()
}));

function traceCalls<T extends object>(owner: string, controller: T, ...methods: (keyof T & string)[]): T {
	const callable = controller as Record<string, (...args: unknown[]) => unknown>;
	for (const name of methods) {
		const original = callable[name]!;
		vi.spyOn(callable, name).mockImplementation(function (this: T, ...args) {
			const suffix = owner === 'window' || name === 'interrupt' ? `:${String(args[0])}` : '';
			harness.events.push(`${owner}.${name}${suffix}`);
			return Reflect.apply(original, this, args);
		});
	}
	return controller;
}

vi.mock('$lib/platform/perf-marks', async (original) => {
	const actual = await original<typeof import('$lib/platform/perf-marks')>();
	return {
		...actual,
		perfMark(...args: Parameters<typeof actual.perfMark>) {
			if (args[0] === 'stage:route-mounted') harness.events.push(args[0]);
			actual.perfMark(...args);
		}
	};
});

vi.mock('$lib/authoring/stage/route/stage-keyboard', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/route/stage-keyboard')>();
	return {
		...actual,
		createStageKeyboard(input: StageKeyboardInput) {
			return actual.createStageKeyboard(harness.configureKeyboard?.(input) ?? input);
		}
	};
});

vi.mock('$lib/authoring/stage/stage-interruption', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/stage-interruption')>();
	return {
		...actual,
		installStageInterruptions(...args: Parameters<typeof actual.installStageInterruptions>) {
			harness.events.push('installInterruptions');
			const remove = actual.installStageInterruptions(...args);
			return () => {
				harness.events.push('removeInterruptions');
				remove();
			};
		}
	};
});

function traceFactory<Args extends unknown[], T extends object>(
	create: (...args: Args) => T,
	owner: string,
	methods: (keyof T & string)[]
) {
	return (...args: Args) => traceCalls(owner, create(...args), ...methods);
}

vi.mock('$lib/authoring/stage/route/stage-experience-binding.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/route/stage-experience-binding.svelte')>();
	return { ...actual, createStageExperienceBinding: traceFactory(actual.createStageExperienceBinding, 'experience', ['start', 'dispose', 'changeLens']) };
});

vi.mock('$lib/authoring/stage/route/stage-shell-state.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/route/stage-shell-state.svelte')>();
	return { ...actual, createStageShellState: traceFactory(actual.createStageShellState, 'shell', [
			'start', 'dispose', 'bindFacade', 'bumpContributions', 'setTask',
			'setExpandedPresentationId', 'setNotice', 'setPendingDelete', 'setArmedTool', 'setCardOpen',
			'suspendSnap'
		]) };
});

vi.mock('$lib/authoring/stage/route/stage-viewport.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/route/stage-viewport.svelte')>();
	return { ...actual, createStageViewport: traceFactory(actual.createStageViewport, 'viewport', ['start', 'dispose', 'reset', 'invalidatePlan', 'refresh']) };
});

vi.mock('$lib/authoring/stage/route/stage-shell-commands', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/route/stage-shell-commands')>();
	return { ...actual, createStageShellCommands: traceFactory(actual.createStageShellCommands, 'commands', ['syncPrimarySelection', 'syncContributedTask', 'armWorldTool']) };
});

vi.mock('$lib/authoring/stage/route/stage-input.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/route/stage-input.svelte')>();
	return { ...actual, createStageInputArbiter: traceFactory(actual.createStageInputArbiter, 'input', ['clearHover', 'interrupt', 'reset']) };
});

vi.mock('$lib/authoring/stage/route/stage-artwork-interaction.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/route/stage-artwork-interaction.svelte')>();
	return { ...actual, createStageArtworkInteraction: traceFactory(actual.createStageArtworkInteraction, 'artwork', ['cancel', 'cancelResize', 'dispose']) };
});

vi.mock('$lib/authoring/stage/route/stage-unfold-gestures.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/route/stage-unfold-gestures.svelte')>();
	return { ...actual, createStageUnfoldGestures: traceFactory(actual.createStageUnfoldGestures, 'unfold', ['dispose']) };
});

vi.mock('$lib/authoring/stage/route/light-look-through.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/route/light-look-through.svelte')>();
	return { ...actual, createLightLookThrough: traceFactory(actual.createLightLookThrough, 'light', ['cancel', 'reconcile', 'dispose']) };
});

vi.mock('$lib/authoring/stage/route/stage-asset-leases.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/route/stage-asset-leases.svelte')>();
	return { ...actual, createStageAssetLeases: traceFactory(actual.createStageAssetLeases, 'assets', ['disposeArtwork']) };
});

vi.mock('$lib/authoring/stage/slice/slice-draw.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/slice/slice-draw.svelte')>();
	return { ...actual, createSliceDraw: traceFactory(actual.createSliceDraw, 'sliceDraw', ['disarm']) };
});

vi.mock('$lib/authoring/studio/studio-controller.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/studio/studio-controller.svelte')>();
	return { ...actual, createStudioController: traceFactory(actual.createStudioController, 'studio', ['end', 'reconcile', 'leaveForLens']) };
});

vi.mock('$lib/authoring/look/appearance-issues.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/look/appearance-issues.svelte')>();
	return { ...actual, createAppearanceIssues: traceFactory(actual.createAppearanceIssues, 'issues', ['reset', 'cancelRepairs']) };
});

vi.mock('$lib/authoring/look/finish-editor.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/look/finish-editor.svelte')>();
	return { ...actual, createFinishEditor: traceFactory(actual.createFinishEditor, 'finishEditor', ['close']) };
});

vi.mock('$lib/authoring/look/finish-align.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/look/finish-align.svelte')>();
	return { ...actual, createFinishAlign: traceFactory(actual.createFinishAlign, 'align', ['clear', 'putBack']) };
});

vi.mock('$lib/authoring/library/material-import.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/library/material-import.svelte')>();
	return { ...actual, createMaterialImportSession: traceFactory(actual.createMaterialImportSession, 'materialImport', ['cancel']) };
});

vi.mock('$lib/authoring/look/finish-authoring.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/look/finish-authoring.svelte')>();
	return { ...actual, createFinishAuthoring: traceFactory(actual.createFinishAuthoring, 'finishes', ['cancelImage', 'cancelLibraryDraft']) };
});

vi.mock('$lib/authoring/project-session/project-session.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/project-session/project-session.svelte')>();
	return {
		...actual,
		createProjectSession(input: Parameters<typeof actual.createProjectSession>[0]) {
			const session = actual.createProjectSession(input);
			const { load } = session;
			harness.applyReloadOffer = session.applyReloadOffer;
			harness.loadSession.mockImplementation((...args: Parameters<typeof session.load>) => {
				harness.events.push('projectSession.load');
				return load(...args);
			});
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
			return traceCalls('epoch', epoch, 'markTornDown', 'dispose');
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
			return traceCalls('card', card, 'cancel');
		}
	};
});
vi.mock('$lib/authoring/stage/shell/StageCanvas.svelte', async () => ({
	default: (await import('../fixtures/StageCanvasProbe.svelte')).default
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
	traceCalls('experienceFocus', experienceFocus, 'reset');
	traceCalls('lift', interiorLift, 'clear');
	traceCalls('slice', sliceReading, 'clear');
	traceCalls('cutaway', nearWallCutaway, 'reset', 'setHeld');
	traceCalls('wallFace', wallFace, 'clear');
	traceCalls('window', window, 'addEventListener', 'removeEventListener');
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

function expectOrder(...expected: string[]) {
	let previous = -1;
	for (const event of expected) {
		const next = harness.events.indexOf(event, previous + 1);
		expect(next, `Expected ${event} after ${harness.events[previous]} in\n${harness.events.join(', ')}`)
			.toBeGreaterThan(previous);
		previous = next;
	}
}

afterEach(async () => {
	if (component !== null) await unmount(component);
	target?.remove();
	component = null;
	target = null;
	page.url.searchParams.delete(STUDIO_ENTRY_PARAM);
	harness.epoch = null;
	harness.events.length = 0;
	harness.applyReloadOffer = null;
	harness.configureKeyboard = null;
	harness.card = null;
	vi.clearAllMocks();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it('preserves every Escape rung and the prelude through the mounted window listener', async () => {
	const order = [
		'artwork', 'preview', 'capture', 'pending-delete', 'finish-gesture', 'adapter-gesture-cancel',
		'disclosure', 'adapter-keyboard-cancel', 'press', 'library', 'align', 'material-editor',
		'material-import', 'repair-drawer', 'measure', 'erase', 'paint-picker', 'paint-tool',
		'slice-draft', 'palette', 'task', 'world-tool', 'sky', 'furnish-strip', 'world-plate',
		'unwind-claim', 'leave', 'selection', 'lift', 'slice'
	] as const;
	type Rung = (typeof order)[number];
	let first: Rung = 'artwork';
	const result: Rung[] = [];
	const active = (id: Rung) => order.indexOf(id) >= order.indexOf(first);
	const handle = (id: Rung) => { result.push(id); };
	const claim = (id: Rung) => {
		if (!active(id)) return false;
		handle(id);
		return true;
	};
	const adapterClaim = (id: Rung) => ({ claimed: claim(id), adapterId: null });
	const tool = (id: 'measure' | 'erase' | 'paint-tool') => ({ clear: () => claim(id) });
	const stage = {
		gestureKeyIntent: () => adapterClaim('adapter-gesture-cancel'),
		closeDisclosure: () => claim('disclosure'),
		notifySurfaceChange() {},
		keyboardIntent: () => adapterClaim('adapter-keyboard-cancel')
	} as unknown as StageFacade;
	harness.configureKeyboard = (input) => ({
		...input,
		artworkEscape: () => claim('artwork'),
		previewActive: () => active('preview'),
		closePreview: () => handle('preview'),
		activeLayer: () => ({
			key: (_event: KeyboardEvent, phase: 'capture' | 'unwind') =>
				claim(phase === 'capture' ? 'capture' : 'unwind-claim') ? 'claimed' : 'pass'
		}) as ReturnType<StageKeyboardInput['activeLayer']>,
		facade: () => stage,
		pressing: () => active('press'),
		interrupt: () => { if (active('press')) handle('press'); },
		pendingDelete: () => active('pending-delete'),
		clearPendingDelete: () => handle('pending-delete'),
		cancelFinishGesture: () => claim('finish-gesture'),
		libraryOpen: () => active('library'),
		toggleLibrary: () => handle('library'),
		dismissAlign: () => claim('align'),
		dismissMaterialEditor: () => claim('material-editor'),
		dismissMaterialImport: () => claim('material-import'),
		dismissRepairDrawer: () => claim('repair-drawer'),
		armedHostTool: () => first === 'measure' || first === 'erase' ? first : 'paint',
		measureTool: () => tool('measure') as ReturnType<StageKeyboardInput['measureTool']>,
		eraserTool: () => tool('erase') as ReturnType<StageKeyboardInput['eraserTool']>,
		paintTool: () => tool('paint-tool') as ReturnType<NonNullable<StageKeyboardInput['paintTool']>>,
		dismissPaint: () => claim('paint-picker'),
		sliceDraftActive: () => active('slice-draft'),
		cancelSliceDraft: () => handle('slice-draft'),
		armedDockKey: () => ({ palette: true }),
		task: () => active('task') ? { kind: 'fixture', label: 'Fixture', targetRef: null } : null,
		paletteOpen: () => active('palette'),
		closePalette: () => handle('palette'),
		closeTask: () => handle('task'),
		activeWorldTool: () => active('world-tool') ? 'build' : 'select',
		clearWorldTool: () => handle('world-tool'),
		featureEscape: [{ id: 'sky', escapeRungs: { sky: () => claim('sky') ? 'handled' : 'pass' } }],
		lens: () => 'world',
		furnishStripOpen: () => active('furnish-strip'),
		closeFurnishStrip: () => handle('furnish-strip'),
		worldPlateOpen: () => active('world-plate'),
		closeWorldPlate: () => handle('world-plate'),
		leaveStudio: () => claim('leave'),
		selectionPresent: () => active('selection'),
		closeSelection: () => handle('selection'),
		liftActive: () => active('lift'),
		putBackLift: () => handle('lift'),
		sliceActive: () => active('slice'),
		putBackSlice: () => handle('slice')
	});
	await mountRoute(await createUnitProject({ id: 'project-1', name: 'Escape project' }));
	for (first of order) {
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
	}
	const afterAdapterCancel = order.indexOf('adapter-keyboard-cancel') + 1;
	expect(result).toEqual([...order.slice(0, afterAdapterCancel), 'press', ...order.slice(afterAdapterCancel)]);
});

it('starts the owners before loading, and releases them before disposing the epoch', async () => {
	await mountRoute(await createUnitProject({ id: 'project-1', name: 'Lifecycle project' }));
	expectOrder(
		'stage:route-mounted', 'experience.start', 'shell.start', 'viewport.start',
		'window.addEventListener:keydown', 'window.addEventListener:keyup', 'window.addEventListener:blur',
		'installInterruptions', 'projectSession.load'
	);
	harness.events.length = 0;
	if (component === null) throw new Error('Expected a mounted route');
	await unmount(component);
	component = null;
	expectOrder(
		'card.cancel', 'align.clear', 'finishEditor.close', 'finishes.cancelLibraryDraft',
		'finishes.cancelImage', 'issues.cancelRepairs', 'materialImport.cancel', 'issues.reset',
		'unfold.dispose', 'light.dispose', 'experience.dispose', 'epoch.markTornDown',
		'viewport.dispose', 'shell.dispose', 'input.clearHover',
		'window.removeEventListener:keydown', 'window.removeEventListener:keyup', 'window.removeEventListener:blur',
		'cutaway.setHeld', 'removeInterruptions', 'epoch.dispose'
	);
	expectOrder(
		'lift.clear', 'sliceDraw.disarm', 'slice.clear', 'cutaway.reset', 'finishes.cancelImage',
		'artwork.dispose', 'assets.disposeArtwork'
	);
});

it('interrupts the old input and presentation before installing and resetting an admitted replacement', async () => {
	const root = await mountRoute(await createUnitProject({ id: 'project-1', name: 'Mounted project' }));
	const replacement = await createUnitProject({ id: 'project-1', name: 'Replacement project' });
	harness.events.length = 0;
	if (harness.applyReloadOffer === null) throw new Error('Expected the mounted project session');
	await harness.applyReloadOffer({
		kind: 'reload',
		projectId: 'project-1',
		document: replacement,
		savedBaseToken: 'remote-base',
		savedRevision: replacement.acceptedRevision,
		savedSourceContentId: await computeEnvelopeSourceContentId(replacement)
	});
	await vi.waitFor(() => expect(root.querySelector('[data-head-project]')?.textContent).toContain('Replacement project'));
	expectOrder(
		'light.cancel', 'input.clearHover', 'input.interrupt:replacement',
		'card.cancel', 'align.clear', 'finishEditor.close', 'finishes.cancelLibraryDraft',
		'finishes.cancelImage', 'issues.cancelRepairs', 'materialImport.cancel', 'issues.reset',
		'experienceFocus.reset', 'shell.setExpandedPresentationId', 'shell.bindFacade',
		'light.cancel', 'studio.end', 'wallFace.clear', 'lift.clear', 'sliceDraw.disarm', 'slice.clear',
		'cutaway.reset', 'shell.setTask', 'shell.setNotice', 'shell.setPendingDelete',
		'shell.setArmedTool', 'shell.setCardOpen', 'artwork.cancel', 'artwork.cancelResize',
		'input.reset', 'viewport.reset'
	);
});

it('releases snap and the cutaway hold before cancelling the Finish Card on window blur', async () => {
	const project = await mountHistoryProject();
	project.card.previewRoughness({ kind: 'entity', entityId: project.object.id }, 0.72);
	expect(project.card.gestureActive).toBe(true);
	harness.events.length = 0;
	window.dispatchEvent(new Event('blur'));
	expectOrder('shell.suspendSnap', 'cutaway.setHeld', 'card.cancel');
	expect(project.card.gestureActive).toBe(false);
});

it('cancels the Finish Card before asking the one facade to change reading', async () => {
	const project = await mountHistoryProject();
	project.card.previewRoughness({ kind: 'entity', entityId: project.object.id }, 0.72);
	expect(project.card.gestureActive).toBe(true);
	traceCalls('stage', project.stage, 'requestViewingIntent');
	harness.events.length = 0;
	button(project.root, '[data-drafting-reading="plan"]').click();
	await tick();
	expectOrder('card.cancel', 'stage.requestViewingIntent');
	expect(project.card.gestureActive).toBe(false);
});

it('settles Studio input before the Head finishes departing World', async () => {
	page.url.searchParams.set(STUDIO_ENTRY_PARAM, STUDIO_ENTRY_VALUE);
	const project = await mountHistoryProject();
	await vi.waitFor(() => expect(project.root.querySelector('[data-studio-panel="no-objects"]')).not.toBeNull());
	project.card.previewRoughness({ kind: 'entity', entityId: project.object.id }, 0.72);
	expect(project.card.gestureActive).toBe(true);
	harness.events.length = 0;
	expect(await chooseLens(project.root, 'experience')).toBe(true);
	expectOrder(
		'studio.leaveForLens', 'card.cancel', 'artwork.cancel', 'commands.armWorldTool',
		'card.cancel', 'finishEditor.close', 'finishes.cancelLibraryDraft', 'finishes.cancelImage',
		'issues.cancelRepairs', 'materialImport.cancel', 'light.cancel', 'experience.changeLens'
	);
	expect(project.card.gestureActive).toBe(false);
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
	const writeLens = vi.spyOn(stage.session, 'changeLens');
	const gesture = stage.session.acquireGesture({
		owner: 'test:studio-live-gesture',
		evaluationId: 'test:evaluation',
		acceptedRevision: stage.snapshot().acceptedRevision,
		policy: 'cancel-on-reading-change'
	});
	expect(gesture.kind).toBe('granted');
	expect(await chooseLens(root, 'experience')).toBe(false);
	expect(stage.session.lens()).toBe('world');
	expect(writeLens).not.toHaveBeenCalled();
	expect(stage.session.gesture()).not.toBeNull();

	button(root, '[data-finding-code="travel-gap"] .source-problem-show').click();
	await tick();

	expect(stage.session.lens()).toBe('experience');
	expect(writeLens).toHaveBeenCalledExactlyOnceWith('experience');
	expect(stage.session.gesture()).toBeNull();
	writeLens.mockClear();
	expect(await chooseLens(root, 'world')).toBe(true);
	expect(writeLens).toHaveBeenCalledExactlyOnceWith('world');
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
	cancel.mockClear();
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
	harness.events.length = 0;
	await acceptSceneEdit(project, {
		kind: 'set-name',
		payload: { entityId: project.object.id, name: 'Renamed plinth' },
		targets: [sceneEntityReference(project.object.id, before.domain.unitRevisions.scene)],
		allocatedIds: []
	});
	expectOrder(
		'light.reconcile', 'shell.setTask', 'commands.syncPrimarySelection', 'commands.syncContributedTask',
		'viewport.invalidatePlan', 'studio.reconcile', 'viewport.refresh'
	);
	const edited = project.stage.snapshot().sourceContentId;
	expect(await chooseLens(project.root, 'experience')).toBe(true);
	expect(await chooseLens(project.root, 'world')).toBe(true);
	harness.events.length = 0;
	await pressHistory(project, button(project.root, '[data-head-undo]'), 'undo', before.sourceContentId);
	expectOrder('light.reconcile', 'viewport.invalidatePlan', 'studio.reconcile', 'viewport.refresh');
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
