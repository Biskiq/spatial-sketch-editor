// @vitest-environment jsdom
import { mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CAMERA_UNIT_FORMAT_VERSION, computeEnvelopeSourceContentId, createEmptyUnitSceneDocument, type ProjectEnvelope } from '@portfolio/project-model/units';
import { createClosedWallCircleDocument } from '@portfolio/layout-core';
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import { layoutSubjectReference } from '$lib/authoring/adapters/layout/drawing-planners';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
import { nearWallCutaway } from '$lib/authoring/stage/cutaway/near-wall-cutaway.svelte';
import { CONNECTIONS, EXPERIENCE, VIEWS } from '../experience/fixtures';
import { primitiveEntity } from './__fixtures__/f4-current-source-fixtures';
import { interiorLift } from '$lib/authoring/layout/interior-lift-store.svelte';
import { resolvedCutawayNow } from '$lib/authoring/stage/cutaway/cutaway-resolved';
import { buildStarterEnclosureLayout } from '$lib/authoring/stage/starter-gallery';
import { sliceReading } from '$lib/authoring/stage/slice/slice-reading.svelte';
import { resolvedSliceNow } from '$lib/authoring/stage/slice/slice-resolved';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { resetReloadOffer, setReloadOffer } from './fixtures/reload-offer';
import Page from '../../../src/routes/project/[projectId]/spatial/+page.svelte';

const harness = vi.hoisted(() => {
	const document = null as ProjectEnvelope | null;
	const stage = undefined as ReturnType<typeof import('$lib/authoring/stage/stage-facade').createStageFacade> | undefined;
	const shell = undefined as ReturnType<typeof import('$lib/authoring/stage/route/stage-shell-state.svelte').createStageShellState> | undefined;
	const finishes = undefined as ReturnType<typeof import('$lib/authoring/look/finish-authoring.svelte').createFinishAuthoring> | undefined;
	const light = undefined as ReturnType<typeof import('$lib/authoring/stage/route/light-look-through.svelte').createLightLookThrough> | undefined;
	const artwork = undefined as ReturnType<typeof import('$lib/authoring/stage/route/stage-artwork-interaction.svelte').createStageArtworkInteraction> | undefined;
	const preview = undefined as ReturnType<typeof import('$lib/authoring/experience/experience-preview.svelte').createExperiencePreview> | undefined;
	const paintTray = undefined as ReturnType<typeof import('$lib/authoring/look/paint-tray-state.svelte').createPaintTrayState> | undefined;
	const sliceDraw = undefined as ReturnType<typeof import('$lib/authoring/stage/slice/slice-draw.svelte').createSliceDraw> | undefined;
	const commands = undefined as ReturnType<typeof import('$lib/authoring/stage/route/stage-shell-commands').createStageShellCommands> | undefined;
	const scenePick = undefined as ReturnType<typeof import('$lib/authoring/scene/scene-pick-source').createScenePickSource> | undefined;
	const studio = undefined as ReturnType<typeof import('$lib/authoring/studio/studio-controller.svelte').createStudioController> | undefined;
	return { document, stage, shell, finishes, light, artwork, preview, paintTray, sliceDraw, commands, scenePick, studio };
});
function capture<Args extends unknown[], K extends Exclude<keyof typeof harness, 'document'>>(
	factory: (...args: Args) => (typeof harness)[K],
	key: K
) {
	return (...args: Args) => {
		const value = factory(...args);
		harness[key] = value;
		return value;
	};
}

function owner<K extends Exclude<keyof typeof harness, 'document'>>(key: K): NonNullable<(typeof harness)[K]> {
	const value = harness[key];
	if (value === undefined) throw new Error(`Expected mounted ${key}`);
	return value as NonNullable<(typeof harness)[K]>;
}

vi.mock('$lib/authoring/stage/stage-facade', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/stage-facade')>();
	return { ...actual, createStageFacade: capture(actual.createStageFacade, 'stage') };
});

vi.mock('$lib/authoring/stage/route/stage-shell-state.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/route/stage-shell-state.svelte')>();
	return { ...actual, createStageShellState: capture(actual.createStageShellState, 'shell') };
});

vi.mock('$lib/authoring/look/finish-authoring.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/look/finish-authoring.svelte')>();
	return { ...actual, createFinishAuthoring: capture(actual.createFinishAuthoring, 'finishes') };
});

vi.mock('$lib/authoring/stage/route/light-look-through.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/route/light-look-through.svelte')>();
	return { ...actual, createLightLookThrough: capture(actual.createLightLookThrough, 'light') };
});

vi.mock('$lib/authoring/stage/route/stage-artwork-interaction.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/route/stage-artwork-interaction.svelte')>();
	return { ...actual, createStageArtworkInteraction: capture(actual.createStageArtworkInteraction, 'artwork') };
});

vi.mock('$lib/authoring/experience/experience-preview.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/experience/experience-preview.svelte')>();
	return { ...actual, createExperiencePreview: capture(actual.createExperiencePreview, 'preview') };
});

vi.mock('$lib/authoring/look/paint-tray-state.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/look/paint-tray-state.svelte')>();
	return { ...actual, createPaintTrayState: capture(actual.createPaintTrayState, 'paintTray') };
});

vi.mock('$lib/authoring/stage/slice/slice-draw.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/slice/slice-draw.svelte')>();
	return { ...actual, createSliceDraw: capture(actual.createSliceDraw, 'sliceDraw') };
});

vi.mock('$lib/authoring/stage/route/stage-shell-commands', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/route/stage-shell-commands')>();
	return { ...actual, createStageShellCommands: capture(actual.createStageShellCommands, 'commands') };
});

vi.mock('$lib/authoring/scene/scene-pick-source', async (original) => {
	const actual = await original<typeof import('$lib/authoring/scene/scene-pick-source')>();
	return { ...actual, createScenePickSource: capture(actual.createScenePickSource, 'scenePick') };
});

vi.mock('$lib/authoring/studio/studio-controller.svelte', async (original) => {
	const actual = await original<typeof import('$lib/authoring/studio/studio-controller.svelte')>();
	return { ...actual, createStudioController: capture(actual.createStudioController, 'studio') };
});

vi.mock('$lib/authoring/stage/shell/EditorHead.svelte', async () => ({
	default: (await import('./fixtures/HeadProbe.svelte')).default
}));
vi.mock('$lib/authoring/stage/shell/StageCanvas.svelte', async () => ({
	default: (await import('./fixtures/StageCanvasProbe.svelte')).default
}));
vi.mock('$lib/visitor/VisitorPreviewSurface.svelte', async () => ({
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
		createProjectApi: () => ({
			async loadProject() {
				const source = harness.document;
				if (source === null) throw new Error('Expected a project fixture');
				return {
					document: source,
					savedBaseToken: 'base',
					savedRevision: source.acceptedRevision,
					savedSourceContentId: await computeEnvelopeSourceContentId(source)
				};
			}
		})
	};
});

let component: ReturnType<typeof mount> | null;
let target: HTMLElement;

async function click(selector: string) {
	const button = target.querySelector<HTMLButtonElement>(selector);
	if (button === null) throw new Error(`Missing button ${selector}`);
	button.click();
	await tick();
	return button;
}

beforeEach(async () => {
	vi.stubGlobal('requestAnimationFrame', () => 1);
	vi.stubGlobal('cancelAnimationFrame', () => {});
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: query.includes('prefers-reduced-motion'),
		addEventListener() {},
		removeEventListener() {}
	}));
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
		new DOMRect(0, 0, 960, 720)
	);
	target = document.createElement('div');
	document.body.append(target);
	await mountSource(await createUnitProject({
		id: 'project-1', name: 'Mounted project', layout: buildStarterEnclosureLayout()
	}));
});

async function mountSource(source: ProjectEnvelope) {
	if (component != null) await unmount(component);
	harness.document = source;
	component = mount(Page, { target });
	await vi.waitFor(() => expect(target.querySelector('[data-testid="stage-canvas"]')).not.toBeNull());
}

afterEach(async () => {
	if (component !== null) await unmount(component);
	component = null;
	target.remove();
	resetReloadOffer();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it('clears Slice and nulls its mirror when leaving World', async () => {
	sliceReading.level();
	await tick();
	expect(sliceReading.isActive()).toBe(true);
	expect(resolvedSliceNow()).not.toBeNull();
	const experience = await click('[data-testid="lens-experience"]');
	expect(experience.getAttribute('aria-pressed')).toBe('true');
	expect(sliceReading.isActive()).toBe(false);
	expect(resolvedSliceNow()).toBeNull();
});

async function activateReadings() {
	await click('[data-reading-more]');
	await click('[data-reading-lift]');
	sliceReading.level();
	await tick();
	expect(interiorLift.reading).not.toBeNull();
	expect(sliceReading.reading).not.toBeNull();
	expect(resolvedSliceNow()).not.toBeNull();
}

it('keeps the active Lift and its scope through a lens round trip', async () => {
	await click('[data-reading-more]');
	await click('[data-reading-lift]');
	const reading = interiorLift.reading;
	expect(reading).not.toBeNull();
	const experience = await click('[data-testid="lens-experience"]');
	expect(experience.getAttribute('aria-pressed')).toBe('true');
	expect(interiorLift.reading).toBe(reading);
	expect(target.querySelector('[data-lift-pill]')).not.toBeNull();
	const world = await click('[data-testid="lens-world"]');
	expect(world.getAttribute('aria-pressed')).toBe('true');
	expect(interiorLift.reading).toBe(reading);
});

it('clears Lift, Slice and the resolved reading mirrors on an admitted replacement', async () => {
	await activateReadings();
	const replacement = await createUnitProject({ id: 'project-1', name: 'Replacement project' });
	setReloadOffer({
		kind: 'reload',
		projectId: 'project-1',
		document: replacement,
		savedRevision: replacement.acceptedRevision,
		savedBaseToken: 'replacement-base',
		savedSourceContentId: await computeEnvelopeSourceContentId(replacement)
	});
	const reload = [...target.querySelectorAll('button')].find((button) => button.textContent === 'Reload remote');
	if (reload === undefined) throw new Error('Expected the Head reload control');
	reload.click();
	await vi.waitFor(() => expect(target.querySelector('[data-testid="head"]')?.getAttribute('data-project')).toBe('Replacement project'));
	expect(interiorLift.reading).toBeNull();
	expect(sliceReading.reading).toBeNull();
	expect(resolvedSliceNow()).toBeNull();
	expect(resolvedCutawayNow()).toBeNull();
});

it('clears Lift, Slice and the resolved reading mirrors on project teardown', async () => {
	await activateReadings();
	if (component === null) throw new Error('Expected a mounted route');
	await unmount(component);
	component = null;
	expect(interiorLift.reading).toBeNull();
	expect(sliceReading.reading).toBeNull();
	expect(resolvedSliceNow()).toBeNull();
	expect(resolvedCutawayNow()).toBeNull();
});

it('drops the previous Card gesture and rename, then publishes the curved Wall selection', async () => {
	const object = primitiveEntity(0);
	const circle = createClosedWallCircleDocument({
		center: [0, 0], rim: [5, 0], junctionId: 'test-circle-junction',
		wallId: 'test-circle-wall', thickness: 0.2, height: 3
	});
	if (circle.kind !== 'success') throw new Error('Expected the test circle to compile');
	await mountSource(await createUnitProject({
		id: 'project-1', name: 'Selection project', layout: circle.document,
		scene: { ...createEmptyUnitSceneDocument(), entities: [object] }
	}));
	const stage = owner('stage');
	const { card } = owner('finishes');
	const shell = owner('shell');
	const sceneRef = sceneEntityReference(object.id, stage.snapshot().domain.unitRevisions.scene);
	const wallRef = layoutSubjectReference({
		kind: 'wall',
		id: circle.wall.id,
		levelId: circle.document.floor.id,
		contentRevision: stage.snapshot().domain.unitRevisions.layout
	});
	stage.setSelection({ ordered: [{ reference: sceneRef }], primary: sceneRef });
	await tick();
	card.previewRoughness({ kind: 'entity', entityId: object.id }, 0.72);
	expect(card.gestureActive).toBe(true);
	const cancel = vi.spyOn(card, 'cancel');
	const rename = vi.spyOn(shell, 'consumeCardRename');
	const anchor = vi.spyOn(wallUnfold, 'ensureAnchor');
	const hosts = vi.spyOn(nearWallCutaway, 'setSelectionHosts');
	shell.requestCardRename(sceneRef);
	stage.setSelection({ ordered: [{ reference: wallRef }], primary: wallRef });
	await tick();
	expect(card.gestureActive).toBe(false);
	expect(shell.cardRenameTarget).toBeNull();
	expect(anchor).toHaveBeenCalledWith(expect.objectContaining({ wallId: 'test-circle-wall' }), expect.any(Number));
	expect(hosts).toHaveBeenCalledWith(new Set(['test-circle-wall']));
	expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(rename.mock.invocationCallOrder[0]!);
	expect(rename.mock.invocationCallOrder[0]).toBeLessThan(anchor.mock.invocationCallOrder[0]!);
	expect(anchor.mock.invocationCallOrder[0]).toBeLessThan(hosts.mock.invocationCallOrder[0]!);
});

it('publishes live Finish proposals on the existing Canvas', async () => {
	const object = { ...primitiveEntity(0), materialInstanceId: 'oak' };
	await mountSource(await createUnitProject({
		id: 'project-1', name: 'Finish project',
		scene: {
			...createEmptyUnitSceneDocument(),
			materials: [{ id: 'oak', name: 'Shared oak', base: { catalogue: 'wood-oak-veneer' } }],
			entities: [object, { ...primitiveEntity(1), materialInstanceId: 'oak' }]
		}
	}));
	const stage = owner('stage');
	const reference = sceneEntityReference(object.id, stage.snapshot().domain.unitRevisions.scene);
	stage.setSelection({ ordered: [{ reference }], primary: reference });
	await tick();
	const canvas = target.querySelector('[data-testid="stage-canvas"]');
	expect(canvas?.getAttribute('data-proposals')).toBe('0');
	const { card } = owner('finishes');
	const subject = { kind: 'entity' as const, entityId: object.id };
	card.requestOpen(subject);
	card.setReach(subject, 'all');
	await tick();
	expect(canvas?.getAttribute('data-proposals')).toBe('1');
	card.setReach(subject, 'this');
	await tick();
	expect(canvas?.getAttribute('data-proposals')).toBe('0');
	expect(target.querySelector('[data-testid="stage-canvas"]')).toBe(canvas);
});

it('remounts the Material Editor when switching between Finish and Library Draft', async () => {
	const object = { ...primitiveEntity(0), materialInstanceId: 'oak' };
	await mountSource(await createUnitProject({
		id: 'project-1', name: 'Finish project',
		scene: {
			...createEmptyUnitSceneDocument(),
			materials: [{ id: 'oak', name: 'Custom oak', base: { catalogue: 'wood-oak-veneer' } }],
			entities: [object]
		}
	}));
	const stage = owner('stage');
	const reference = sceneEntityReference(object.id, stage.snapshot().domain.unitRevisions.scene);
	stage.setSelection({ ordered: [{ reference }], primary: reference });
	await tick();
	const finishes = owner('finishes');
	finishes.editor.openFor({ kind: 'entity', entityId: object.id }, object.name);
	await tick();
	const first = target.querySelector('[data-material-editor-mode="finish"]');
	expect(first).not.toBeNull();
	expect(document.activeElement).toBe(first?.querySelector('[data-material-editor-close]'));

	owner('commands').armWorldTool('paint');
	const entry = finishes.libraryBrowse().find(({ source }) => source === 'curated');
	if (entry === undefined) throw new Error('Expected a curated Finish');
	expect(finishes.openLibraryDraft(entry.ref)).toBe(true);
	await tick();
	const draft = target.querySelector('[data-material-editor-mode="draft"]');
	expect(draft).not.toBeNull();
	expect(first?.isConnected).toBe(false);
	expect(document.activeElement).toBe(draft?.querySelector('[data-material-editor-close]'));

	finishes.cancelLibraryDraft();
	await tick();
	const returned = target.querySelector('[data-material-editor-mode="finish"]');
	expect(returned).not.toBeNull();
	expect(returned).not.toBe(first);
	expect(draft?.isConnected).toBe(false);
	expect(document.activeElement).toBe(returned?.querySelector('[data-material-editor-close]'));
});

it('releases the inspection and held cutaway when Preview takes the Stage', async () => {
	await mountSource(await createUnitProject({
		id: 'project-1', name: 'Preview project', layout: buildStarterEnclosureLayout(),
		camera: { formatVersion: CAMERA_UNIT_FORMAT_VERSION, views: VIEWS, connections: CONNECTIONS },
		experience: EXPERIENCE
	}));
	const cancelLight = vi.spyOn(owner('light'), 'cancel');
	const cancelResize = vi.spyOn(owner('artwork'), 'cancelResize');
	window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', cancelable: true }));
	expect(nearWallCutaway.held).toBe(true);
	const releaseHold = vi.spyOn(nearWallCutaway, 'setHeld');
	await owner('preview').open('guided', 'guide-1');
	await tick();
	expect(owner('preview').openState).toBe(true);
	expect(nearWallCutaway.held).toBe(false);
	expect(cancelLight.mock.calls.length).toBeGreaterThanOrEqual(2);
	expect(releaseHold).toHaveBeenCalledWith(false);
	expect(cancelResize).toHaveBeenCalled();
	expect(cancelLight.mock.invocationCallOrder[1]).toBeLessThan(releaseHold.mock.invocationCallOrder[0]!);
	expect(releaseHold.mock.invocationCallOrder[0]).toBeLessThan(cancelResize.mock.invocationCallOrder[0]!);
});

it('drops the Paint tray expansion and the draft when Paint is put down', async () => {
	const { armWorldTool } = owner('commands');
	const paintTray = owner('paintTray');
	const finishes = owner('finishes');
	armWorldTool('paint');
	await tick();
	expect(owner('shell').armedHostTool).toBe('paint');
	paintTray.toggleExpanded();
	paintTray.setWheelOpen(true);
	const entry = finishes.libraryBrowse().find(({ source }) => source === 'curated');
	if (entry === undefined) throw new Error('Expected the Finish Library to list a curated Finish');
	expect(finishes.openLibraryDraft(entry.ref)).toBe(true);
	await tick();
	expect(finishes.libraryDraft).not.toBeNull();
	const reset = vi.spyOn(paintTray, 'reset');
	const cancel = vi.spyOn(finishes, 'cancelLibraryDraft');
	armWorldTool('select');
	await tick();
	expect(paintTray.expanded).toBe(false);
	expect(paintTray.wheelOpen).toBe(false);
	expect(finishes.libraryDraft).toBeNull();
	expect(reset.mock.invocationCallOrder[0]).toBeLessThan(cancel.mock.invocationCallOrder[0]!);
});

it('disarms the drawn Slice when leaving its tool and keeps the resolved cut', async () => {
	const { armWorldTool } = owner('commands');
	armWorldTool('slice');
	await tick();
	owner('sliceDraw').arm();
	await tick();
	expect(owner('sliceDraw').armed).toBe(true);
	expect(resolvedSliceNow()).not.toBeNull();
	armWorldTool('select');
	await tick();
	expect(owner('sliceDraw').armed).toBe(false);
	expect(sliceReading.isActive()).toBe(true);
	expect(resolvedSliceNow()).not.toBeNull();
});

it('retries Studio framing before publishing Camera bounds after a render root changes', async () => {
	const object = primitiveEntity(0);
	await mountSource(await createUnitProject({
		id: 'project-1', name: 'Bounds project',
		scene: { ...createEmptyUnitSceneDocument(), entities: [object] }
	}));
	const stage = owner('stage');
	const pick = owner('scenePick');
	pick.setSource(stage.snapshot().domain.scene);
	const mesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
	mesh.position.set(30, 0, 0);
	mesh.updateMatrixWorld();
	const retry = vi.spyOn(owner('studio'), 'retryFrame');
	const bounds = vi.spyOn(stage.camera, 'setContentBounds');
	const release = pick.register(object.id, mesh);
	try {
		await vi.waitFor(() => expect(bounds).toHaveBeenCalled());
		expect(retry.mock.invocationCallOrder[0]).toBeLessThan(bounds.mock.invocationCallOrder[0]!);
		expect(bounds).toHaveBeenLastCalledWith({
			min: expect.arrayContaining([29]), max: expect.arrayContaining([31])
		});
	} finally {
		release();
		mesh.geometry.dispose();
		mesh.material.dispose();
	}
});
