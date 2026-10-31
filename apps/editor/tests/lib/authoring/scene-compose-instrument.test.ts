// @vitest-environment jsdom
/**
 * T2.P01.S04 — the Compose panel tells the truth about its subject.
 *
 * Resize and Duplicate need a verified floor contact, which only the admitted
 * analytic primitives have. A light or model must not be offered those commands
 * (or a Scale fact that cannot be written), and a Resize proposal must end when
 * the canonical selection moves to another entity rather than committing the
 * entity the panel no longer names.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import type { ViewportEvaluation } from '@portfolio/camera-core';
import {
	SCENE_UNIT_FORMAT_VERSION,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { creatorModelResourceEntry } from '@portfolio/project-model/scene-planning';

import SceneTransformInstrument from '$lib/authoring/adapters/scene/SceneTransformInstrument.svelte';
import {
	publishSceneSurface,
	sceneReadingKey,
	type ScenePlacementSession
} from '$lib/authoring/adapters/scene/placement';
import type { StageReadSnapshot } from '$lib/authoring/stage/accepted-read';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { attachUnitStageSource } from '$lib/authoring/stage/unit-stage-source';
import * as formLibrary from '$lib/authoring/adapters/scene/library/client';
import { canonicalFormLibraryPayload } from '@portfolio/project-model/library';
import * as objectDefinitions from '$lib/authoring/scene/object-definition-policy';
import { clearArmedModel, peekArmedModel } from '$lib/authoring/adapters/scene/import/definitions';

const BOX_ID = 'entity-compose-box';
const LIGHT_ID = 'entity-compose-light';
const MODEL_ID = 'entity-compose-model';
const MODEL_ASSET_ID = 'model-compose-approved';
const SOURCE_ID = `sha256-${'b'.repeat(64)}`;
const EVALUATION = {
	token: {
		outputId: 'output-compose',
		sessionEpoch: 'session-compose',
		sourceRevision: SOURCE_ID,
		evaluationGeneration: 1
	},
	settledReading: '3d'
} as unknown as ViewportEvaluation;
const EVALUATION_ID = 'output-compose::session-compose::1';

const BOX = {
	kind: 'primitive',
	primitive: 'box',
	id: BOX_ID,
	name: 'Block',
	dimensions: { width: 1, height: 1, depth: 1 },
	materialId: 'plaster-warm',
	castShadow: true,
	receiveShadow: true,
	position: [2, 0.5, 2],
	rotation: [0, 0, 0]
};
const LIGHT = {
	kind: 'light',
	light: 'point',
	id: LIGHT_ID,
	name: 'Fill light',
	color: '#ffffff',
	intensity: 1,
	castShadow: false,
	position: [3, 2.4, 3],
	rotation: [0, 0, 0]
};
const SNAPSHOT = {
	acceptedRevision: { projectId: 'project-compose', revisionId: 'revision-compose' },
	sourceContentId: SOURCE_ID,
	compileGeneration: 'generation-compose',
	domain: { scene: { entities: [BOX, LIGHT] } }
};
const MODEL = {
	kind: 'model',
	id: MODEL_ID,
	name: 'Approved model',
	assetId: MODEL_ASSET_ID,
	fallback: 'generic',
	position: [2, 1, 2],
	rotation: [0, 0, 0],
	scale: 1
};
const MODEL_RESOURCE = creatorModelResourceEntry(MODEL_ASSET_ID, {
	derivative: { hash: `sha256-${'a'.repeat(64)}`, mime: 'model/gltf-binary', size: 4096, locator: '/models/a.glb' },
	source: { manifestHash: `sha256-${'d'.repeat(64)}`, size: 8192, fileCount: 1 },
	recipe: { id: 'creator-import@1', version: 1 },
	reportDigest: `sha256-${'c'.repeat(64)}`,
	placement: {
		metresPerSourceUnit: 1,
		pivot: [0, 0, 0],
		footprint: { width: 2, depth: 2 },
		contactMinY: -0.25
	}
})!.resource;
const MODEL_SNAPSHOT = attachUnitStageSource(
	{
		...SNAPSHOT,
		sourceKind: UNIT_SOURCE_KIND,
		sourceVersion: UNIT_SOURCE_VERSION,
		domain: { scene: { entities: [BOX, LIGHT, MODEL] } }
	} as unknown as StageReadSnapshot,
	{
		units: {
			layout: {
				header: { formatVersion: 6, contentRevision: 'sha256-layout' },
				data: { rooms: [] }
			},
			scene: {
				header: { formatVersion: SCENE_UNIT_FORMAT_VERSION, contentRevision: 'sha256-scene' },
				data: { formatVersion: SCENE_UNIT_FORMAT_VERSION, textures: [], materials: [], entities: [MODEL] }
			},
			resources: {
				header: { formatVersion: 2, contentRevision: 'sha256-resources' },
				data: { formatVersion: 2, resources: [MODEL_RESOURCE] }
			}
		}
	} as unknown as ProjectEnvelope
);

type ComposeSpies = {
	readonly session: ScenePlacementSession;
	readonly beginResize: ReturnType<typeof vi.fn>;
	readonly cancel: ReturnType<typeof vi.fn>;
};

function composeSpies(): ComposeSpies {
	const beginResize = vi.fn(() => ({ kind: 'idle' as const }));
	const cancel = vi.fn();
	const session = {
		armed: () => 'select' as const,
		arm: vi.fn(),
		snapStep: () => null,
		setSnapStep: vi.fn(),
		begin: vi.fn(() => ({ kind: 'idle' as const })),
		beginPlace: vi.fn(() => ({ kind: 'idle' as const })),
		placePrimitive: () => 'box' as const,
		armedFormCopy: () => null,
		setPlacePrimitive: vi.fn(),
		previewMove: vi.fn(() => ({ kind: 'idle' as const })),
		previewYaw: vi.fn(() => ({ kind: 'idle' as const })),
		previewPlace: vi.fn(() => ({ kind: 'idle' as const })),
		invalidatePreview: vi.fn(),
		abortGesture: vi.fn(),
		setEntry: vi.fn(() => ({ kind: 'idle' as const })),
		commit: vi.fn(async () => ({ kind: 'committed' as const })),
		commitPlace: vi.fn(async () => ({ kind: 'committed' as const })),
		place: vi.fn(async () => ({ kind: 'committed' as const })),
		cancel,
		baseline: () => null,
		placedEntityId: () => null,
		subjectEntityId: () => null,
		candidate: () => null,
		proposalLive: () => true,
		beginResize,
		previewResize: vi.fn(() => ({ kind: 'idle' as const })),
		setResizeEntry: vi.fn(() => ({ kind: 'idle' as const })),
		commitResize: vi.fn(async () => ({ kind: 'committed' as const })),
		duplicate: vi.fn(async () => ({ kind: 'committed' as const })),
		remove: vi.fn(async () => ({ kind: 'committed' as const })),
		setPlacementCommittedListener: vi.fn(),
		placementCommittedListener: () => null,
		setPointerOutcomeListener: vi.fn()
	} as unknown as ScenePlacementSession;
	return { session, beginResize, cancel };
}

function servicesFor(
	session: ScenePlacementSession,
	selectedId: string,
	snapshot: unknown = SNAPSHOT,
	taskKind = 'scene-compose'
): {
	readonly services: StageAdapterServices;
	select(id: string): void;
	/** Simulate the host retiring this panel when an accepted install closes its task. */
	readonly notify: ReturnType<typeof vi.fn>;
} {
	let selected = selectedId;
	const notify = vi.fn();
	const services = {
		stage: {
			snapshot: () => snapshot,
			selectionState: () => ({ primary: { domain: 'scene', subject: { kind: 'entity', id: selected } } }),
			evaluation: () => EVALUATION,
			evaluationId: () => EVALUATION_ID,
			session: { task: () => ({ kind: taskKind }) },
			notifySurfaceChange: notify,
			setSelection: vi.fn()
		}
	} as unknown as StageAdapterServices;
	return { services, select: (id) => { selected = id; }, notify };
}

function buttonNamed(target: HTMLElement, name: string): HTMLButtonElement {
	const found = [...target.querySelectorAll('button')].find(
		(button) => button.textContent?.trim() === name
	);
	if (found === undefined) throw new Error(`No "${name}" button in the instrument`);
	return found;
}

let cleanup: (() => void) | null = null;
afterEach(() => {
	vi.restoreAllMocks();
	clearArmedModel('project-compose');
	cleanup?.();
	cleanup = null;
	document.body.replaceChildren();
});

async function mountCompose(selectedId: string, snapshot: unknown = SNAPSHOT): Promise<{
	readonly target: HTMLElement;
	readonly spies: ComposeSpies;
	readonly services: StageAdapterServices;
	select(id: string): void;
	readonly notify: ReturnType<typeof vi.fn>;
}> {
	const spies = composeSpies();
	// Publish the same snapshot the services expose; the surface registry is keyed
	// by accepted snapshot, so a mismatch would build a real session instead of
	// the mock this test drives.
	publishSceneSurface(snapshot as never, { reading: sceneReadingKey(EVALUATION), session: spies.session });
	const { services, select, notify } = servicesFor(spies.session, selectedId, snapshot);
	const target = document.createElement('div');
	document.body.appendChild(target);
	const component = mount(SceneTransformInstrument, { target, props: { services } });
	cleanup = () => unmount(component);
	await tick();
	return { target, spies, services, select, notify };
}

describe('Scene Compose — truthful capability and captured subject', () => {
	it('restores the catalogue choice when Place remounts with its remembered model armed', async () => {
		const first = composeSpies().session;
		let firstModel: ReturnType<ScenePlacementSession['armedModel']> = null;
		first.armedModel = () => firstModel;
		first.setArmedModel = (next) => { firstModel = next; };
		const { services: firstServices } = servicesFor(first, BOX_ID, MODEL_SNAPSHOT, 'place-object');
		publishSceneSurface(MODEL_SNAPSHOT, { reading: sceneReadingKey(EVALUATION), session: first });
		const firstTarget = document.createElement('div');
		document.body.appendChild(firstTarget);
		const firstComponent = mount(SceneTransformInstrument, { target: firstTarget, props: { services: firstServices } });
		cleanup = () => unmount(firstComponent);
		await tick();
		const firstChooser = firstTarget.querySelector<HTMLSelectElement>('[aria-label="Place object"]')!;
		firstChooser.value = 'catalogue:paris-salon-chair';
		firstChooser.dispatchEvent(new Event('change', { bubbles: true }));
		await vi.waitFor(() => expect(firstModel?.definition.creationDefaults.kind).toBe('model'));
		await unmount(firstComponent);
		cleanup = null;

		const second = composeSpies().session;
		let secondModel: ReturnType<ScenePlacementSession['armedModel']> = null;
		second.armedModel = () => secondModel;
		second.setArmedModel = (next) => { secondModel = next; };
		second.setPlacePrimitive = () => { secondModel = null; };
		const { services: secondServices } = servicesFor(second, BOX_ID, MODEL_SNAPSHOT, 'place-object');
		publishSceneSurface(MODEL_SNAPSHOT, { reading: sceneReadingKey(EVALUATION), session: second });
		const secondTarget = document.createElement('div');
		document.body.appendChild(secondTarget);
		const secondComponent = mount(SceneTransformInstrument, { target: secondTarget, props: { services: secondServices } });
		cleanup = () => unmount(secondComponent);
		await tick();
		await vi.waitFor(() => expect(secondModel?.definition).toEqual(firstModel?.definition));
		const secondChooser = secondTarget.querySelector<HTMLSelectElement>('[aria-label="Place object"]')!;
		expect(secondChooser.value).toBe('catalogue:paris-salon-chair');

		secondChooser.value = 'native:box';
		secondChooser.dispatchEvent(new Event('change', { bubbles: true }));
		await tick();
		expect(secondModel).toBeNull();
		expect(peekArmedModel('project-compose')).toBeNull();
	});

	it('keeps a catalogue arm across readings until a saved form explicitly replaces it', async () => {
		const payload = canonicalFormLibraryPayload({formatVersion: 1, kind: 'form', name: 'Saved plinth', form: {generator: {kind: 'extrude', plane: 'plan', extent: 0.4, outline: [{key:1,u:0,v:0,smooth:false},{key:2,u:1,v:0,smooth:false},{key:3,u:1,v:1,smooth:false},{key:4,u:0,v:1,smooth:false}]},scale:[1,1,1],nextKey:5},materialId:'plaster-warm',castShadow:true,receiveShadow:true});
		const item = {id:'11111111-1111-4111-8111-111111111111',name:payload.name,kind:'form' as const,formatVersion:1,contentId:`sha256-${'a'.repeat(64)}`,createdAt:'2026-10-31T12:00:00Z'};
		vi.spyOn(formLibrary, 'createFormLibraryClient').mockReturnValue({list:vi.fn(async()=>[item]),read:vi.fn(async()=>({payload,contentId:item.contentId})),save:vi.fn(),remove:vi.fn()});
		const first = composeSpies().session;
		const second = composeSpies().session;
		for (const session of [first, second]) {
			let model: ReturnType<ScenePlacementSession['armedModel']> = null;
			session.armedModel = () => model;
			let copy: ReturnType<ScenePlacementSession['armedFormCopy']> = null;
			session.setArmedModel = (next) => { model = next; copy = null; };
			session.armedFormCopy = () => copy;
			session.setArmedFormCopy = (next) => { copy = next; model = null; };
		}
		let evaluation = EVALUATION;
		const { services } = servicesFor(first, BOX_ID, SNAPSHOT, 'place-object');
		services.stage.evaluation = () => evaluation;
		publishSceneSurface(SNAPSHOT, { reading: sceneReadingKey(evaluation), session: first });
		const target = document.createElement('div');
		document.body.appendChild(target);
		const component = mount(SceneTransformInstrument, { target, props: { services } });
		cleanup = () => unmount(component);
		await tick();
		const chooser = target.querySelector<HTMLSelectElement>('[aria-label="Place object"]')!;
		chooser.value = 'catalogue:paris-salon-chair';
		chooser.dispatchEvent(new Event('change', { bubbles: true }));
		await vi.waitFor(() => expect(first.armedModel()?.definition.creationDefaults.kind).toBe('model'));
		expect(peekArmedModel('project-compose')?.definition).toEqual(first.armedModel()?.definition);
		evaluation = { ...EVALUATION, settledReading: 'plan' } as unknown as ViewportEvaluation;
		publishSceneSurface(SNAPSHOT, { reading: sceneReadingKey(evaluation), session: second });
		await vi.waitFor(() => expect(second.armedModel()?.definition).toEqual(first.armedModel()?.definition));
		expect(chooser.value).toBe('catalogue:paris-salon-chair');
		expect(target.textContent).toContain('is ready: click its floor position');
		buttonNamed(target, 'My Objects').click();
		await vi.waitFor(() => expect(target.querySelector('[data-my-objects-insert]')).not.toBeNull());
		target.querySelector<HTMLButtonElement>('[data-my-objects-insert]')!.click();
		await vi.waitFor(() => expect(second.armedFormCopy()?.item.name).toBe('Saved plinth'));
		expect(second.armedModel()).toBeNull();
		expect(peekArmedModel('project-compose')).toBeNull();
	});

	it.each(['unmount', 'primitive'] as const)('does not restore a catalogue arm after %s replaces an in-flight choice', async (replacement) => {
		const definition = await objectDefinitions.catalogueModelDefinition('paris-salon-chair');
		let resolveDefinition!: (value: typeof definition) => void;
		vi.spyOn(objectDefinitions, 'catalogueModelDefinition').mockImplementation(() => new Promise((resolve) => { resolveDefinition = resolve; }));
		const session = composeSpies().session;
		let armed: ReturnType<ScenePlacementSession['armedModel']> = null;
		session.armedModel = () => armed;
		session.setArmedModel = (next) => { armed = next; };
		const { services } = servicesFor(session, BOX_ID, MODEL_SNAPSHOT, 'place-object');
		publishSceneSurface(MODEL_SNAPSHOT, { reading: sceneReadingKey(EVALUATION), session });
		const target = document.createElement('div');
		document.body.appendChild(target);
		const component = mount(SceneTransformInstrument, { target, props: { services } });
		cleanup = () => unmount(component);
		await tick();
		const chooser = target.querySelector<HTMLSelectElement>('[aria-label="Place object"]')!;
		chooser.value = 'catalogue:paris-salon-chair';
		chooser.dispatchEvent(new Event('change', { bubbles: true }));
		if (replacement === 'unmount') {
			await unmount(component);
			cleanup = null;
		} else {
			chooser.value = 'native:box';
			chooser.dispatchEvent(new Event('change', { bubbles: true }));
		}
		resolveDefinition(definition);
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(armed).toBeNull();
		expect(peekArmedModel('project-compose')).toBeNull();
	});

	it('offers no Resize, Duplicate or Scale fact for a light with no verified contact', async () => {
		const { target } = await mountCompose(LIGHT_ID);
		expect(buttonNamed(target, 'Resize…').disabled).toBe(true);
		expect(buttonNamed(target, 'Duplicate').disabled).toBe(true);
		expect(buttonNamed(target, 'Delete').disabled).toBe(false);
		expect(target.textContent).toContain('lights have no object footprint');
	});

	it('offers Resize and Duplicate for a primitive with a known contact', async () => {
		const { target } = await mountCompose(BOX_ID);
		expect(buttonNamed(target, 'Resize…').disabled).toBe(false);
		expect(buttonNamed(target, 'Duplicate').disabled).toBe(false);
		expect(target.textContent).not.toContain('no verified floor contact');
	});

	it('offers Resize and Duplicate for an approved model with recorded contact', async () => {
		const { target } = await mountCompose(MODEL_ID, MODEL_SNAPSHOT);
		expect(buttonNamed(target, 'Resize…').disabled).toBe(false);
		expect(buttonNamed(target, 'Duplicate').disabled).toBe(false);
		expect(target.textContent).not.toContain('needs a verified contact');
	});

	it('keeps a model Resize proposal open while the opening control is removed', async () => {
		const { target } = await mountCompose(MODEL_ID, MODEL_SNAPSHOT);
		buttonNamed(target, 'Resize…').click();
		// Removing the focused Resize… control delivers a focusout with no related
		// target while the replacement field is being installed.
		target.querySelector('.editing')!.dispatchEvent(
			new FocusEvent('focusout', { bubbles: true, relatedTarget: null })
		);
		await tick();
		expect(target.textContent).toContain(`Compose ${MODEL_ID}`);
		const input = target.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
		if (input === null) throw new Error('the Resize entry did not open');
		expect(document.activeElement).toBe(input);
		expect(target.textContent).not.toContain('Cancelled; the accepted pose is unchanged.');
	});

	it('cancels an open Resize when the canonical selection moves to another entity', async () => {
		const { target, spies, select } = await mountCompose(BOX_ID);
		buttonNamed(target, 'Resize…').click();
		await tick();
		expect(spies.beginResize).toHaveBeenCalledWith(BOX_ID);
		expect(target.textContent).toContain(`Compose ${BOX_ID}`);

		// The canonical selection moves; the panel's frame observer is the path
		// that sees it even though this component is not re-rendered by it.
		select(LIGHT_ID);
		for (let attempt = 0; attempt < 60 && spies.cancel.mock.calls.length === 0; attempt += 1) {
			await new Promise((resolve) => setTimeout(resolve, 8));
		}
		expect(spies.cancel).toHaveBeenCalledTimes(1);
		await tick();
		expect(target.textContent).toContain('Resize cancelled; the selection changed.');
	});

	it('does not report through task services after an accepted Resize retires them', async () => {
		const { target, spies, notify } = await mountCompose(BOX_ID);
		buttonNamed(target, 'Resize…').click();
		await tick();
		const input = target.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
		if (input === null) throw new Error('the Resize entry did not open');
		input.value = '2';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		notify.mockClear();

		// The accepted install closes the open task before the commit continuation
		// runs, so the host has retired this panel's services. It must not be asked
		// to notify a surface that no longer has this instrument.
		spies.session.commitResize = vi.fn(async () => ({ kind: 'committed' as const }));
		buttonNamed(target, 'Resize').click();
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(notify).not.toHaveBeenCalled();
		// The accepted install owns the post-commit state; the retired panel does
		// not get to report a "Committed." result of its own.
		expect(target.textContent).not.toContain('Committed.');
	});

	it('does not report through task services after an accepted Duplicate retires them', async () => {
		const { target, spies, notify } = await mountCompose(BOX_ID);
		notify.mockClear();
		spies.session.duplicate = vi.fn(async () => ({ kind: 'committed' as const }));
		buttonNamed(target, 'Duplicate').click();
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(notify).not.toHaveBeenCalled();
	});

	it('does not report a committed pointer outcome through retired services', async () => {
		const { spies, notify } = await mountCompose(BOX_ID);
		const register = spies.session.setPointerOutcomeListener as unknown as ReturnType<typeof vi.fn>;
		const listener = register.mock.calls.at(-1)?.[0] as
			| ((outcome: unknown) => void)
			| undefined;
		if (listener === undefined) throw new Error('the session registered no pointer listener');
		notify.mockClear();

		// The adapter commits a pointer drag and only then reports the outcome; by
		// then the accepted install has closed the task and retired this panel.
		listener({ kind: 'committed' });
		expect(notify).not.toHaveBeenCalled();

		// A refusal is not an install: it still has something to say, and the task
		// is still open.
		listener({ kind: 'refused', code: 'no-contact', message: 'the light has no footprint' });
		expect(notify).toHaveBeenCalledTimes(1);
	});
});
