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

import SceneTransformInstrument from '$lib/authoring/adapters/scene/SceneTransformInstrument.svelte';
import {
	publishSceneSurface,
	sceneReadingKey,
	type ScenePlacementSession
} from '$lib/authoring/adapters/scene/placement';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';

const BOX_ID = 'entity-compose-box';
const LIGHT_ID = 'entity-compose-light';
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
	selectedId: string
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
			snapshot: () => SNAPSHOT,
			selectionState: () => ({ primary: { domain: 'scene', subject: { kind: 'entity', id: selected } } }),
			evaluation: () => EVALUATION,
			evaluationId: () => EVALUATION_ID,
			session: { task: () => ({ kind: 'scene-compose' }) },
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
	cleanup?.();
	cleanup = null;
	document.body.replaceChildren();
});

async function mountCompose(selectedId: string): Promise<{
	readonly target: HTMLElement;
	readonly spies: ComposeSpies;
	readonly services: StageAdapterServices;
	select(id: string): void;
	readonly notify: ReturnType<typeof vi.fn>;
}> {
	const spies = composeSpies();
	publishSceneSurface(SNAPSHOT, { reading: sceneReadingKey(EVALUATION), session: spies.session });
	const { services, select, notify } = servicesFor(spies.session, selectedId);
	const target = document.createElement('div');
	document.body.appendChild(target);
	const component = mount(SceneTransformInstrument, { target, props: { services } });
	cleanup = () => unmount(component);
	await tick();
	return { target, spies, services, select, notify };
}

describe('Scene Compose — truthful capability and captured subject', () => {
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
