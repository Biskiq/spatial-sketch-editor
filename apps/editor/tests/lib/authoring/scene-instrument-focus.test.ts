// @vitest-environment jsdom
/**
 * T2.P01.S03 — the Scene instrument's focusout scope.
 *
 * Opening a proposal removes the focused `Begin` control. The browser delivers
 * that removal's `focusout` at the instrument root, and the instrument must not
 * read it as the creator leaving the editing subtree: the proposal it just
 * opened would cancel itself.
 *
 * These mount the real instrument over one published surface and assert the
 * cancel path, not a copied predicate. A genuine blur out of the editing scope
 * still cancels, and focus moving inside it does not.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';

import SceneTransformInstrument from '$lib/authoring/adapters/scene/SceneTransformInstrument.svelte';
import {
	publishSceneSurface,
	type ScenePlacementSession,
	type SceneSurface
} from '$lib/authoring/adapters/scene/placement';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';

const ENTITY_ID = 'entity-focus-fixture';
const EVALUATION_ID = 'evaluation-focus';
const SNAPSHOT = {
	acceptedRevision: { projectId: 'project-focus', revisionId: 'revision-focus' },
	sourceContentId: `sha256-${'a'.repeat(64)}`,
	compileGeneration: 'generation-focus',
	domain: {
		scene: {
			entities: [
				{
					kind: 'primitive',
					primitive: 'box',
					id: ENTITY_ID,
					name: 'Focus block',
					dimensions: { width: 1, height: 1, depth: 1 },
					materialId: 'plaster-warm',
					castShadow: true,
					receiveShadow: true,
					position: [2, 0.5, 2],
					rotation: [0, 0.7, 0]
				}
			]
		}
	}
};

type SessionSpies = {
	readonly session: ScenePlacementSession;
	readonly begin: ReturnType<typeof vi.fn>;
	readonly cancel: ReturnType<typeof vi.fn>;
};

function sessionSpies(): SessionSpies {
	const begin = vi.fn(() => ({ kind: 'idle' as const }));
	const cancel = vi.fn();
	const session = {
		armed: () => 'select' as const,
		arm: vi.fn(),
		snapStep: () => null,
		setSnapStep: vi.fn(),
		begin,
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
		setPlacementCommittedListener: vi.fn(),
		placementCommittedListener: () => null
	} as unknown as ScenePlacementSession;
	return { session, begin, cancel };
}

function servicesFor(session: ScenePlacementSession): StageAdapterServices {
	return {
		stage: {
			snapshot: () => SNAPSHOT,
			selectionState: () => ({
				primary: { domain: 'scene', subject: { kind: 'entity', id: ENTITY_ID } }
			}),
			evaluationId: () => EVALUATION_ID,
			notifySurfaceChange: vi.fn()
		}
	} as unknown as StageAdapterServices;
}

function buttonNamed(target: HTMLElement, name: string): HTMLButtonElement {
	const found = [...target.querySelectorAll('button')].find(
		(button) => button.textContent?.trim() === name
	);
	if (found === undefined) throw new Error(`No "${name}" button in the instrument`);
	return found;
}

function instrumentRoot(target: HTMLElement): HTMLElement {
	const root = target.querySelector('section');
	if (root === null) throw new Error('the instrument root is missing');
	return root;
}

let cleanup: (() => void) | null = null;

afterEach(() => {
	cleanup?.();
	cleanup = null;
	document.body.replaceChildren();
});

/** Mount the real instrument over one published surface. */
async function mountInstrument(): Promise<{
	readonly target: HTMLElement;
	readonly spies: SessionSpies;
}> {
	const spies = sessionSpies();
	const surface: SceneSurface = { evaluationId: EVALUATION_ID, session: spies.session };
	publishSceneSurface(SNAPSHOT, surface);
	const target = document.createElement('div');
	document.body.appendChild(target);
	const component = mount(SceneTransformInstrument, {
		target,
		props: { services: servicesFor(spies.session) }
	});
	cleanup = () => unmount(component);
	await tick();
	return { target, spies };
}

/** Mount, choose the selected entity and open its editing proposal. */
async function beganInstrument(): Promise<{
	readonly target: HTMLElement;
	readonly spies: SessionSpies;
}> {
	const mounted = await mountInstrument();
	buttonNamed(mounted.target, 'Use selection').click();
	buttonNamed(mounted.target, 'Begin').click();
	return mounted;
}

describe('Scene instrument focusout scope', () => {
	it('does not cancel the proposal opened by removing the focused Begin control', async () => {
		const { target, spies } = await mountInstrument();
		buttonNamed(target, 'Use selection').click();
		const begin = buttonNamed(target, 'Begin');
		begin.focus();
		begin.click();

		// The browser blurs the control as the Svelte branch transition removes it
		// and delivers that `focusout` at the instrument root. Reproduce the same
		// delivery while the transition is still being committed: the removed
		// control's event does not originate in the editing subtree.
		instrumentRoot(target).dispatchEvent(
			new FocusEvent('focusout', { bubbles: true, relatedTarget: null })
		);
		await tick();

		expect(spies.begin).toHaveBeenCalledWith(ENTITY_ID);
		expect(spies.cancel).not.toHaveBeenCalled();
		expect(target.textContent).toContain(`Editing ${ENTITY_ID}`);
		expect(target.textContent).not.toContain('Cancelled');
	});

	it('cancels on a genuine blur out of the editing scope', async () => {
		const { target, spies } = await beganInstrument();
		const x = target.querySelector('input');
		if (x === null) throw new Error('the X field is missing');
		x.focus();
		x.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
		await tick();

		expect(spies.cancel).toHaveBeenCalledTimes(1);
		expect(target.textContent).toContain('Cancelled; the accepted pose is unchanged.');
	});

	it('keeps the proposal when focus moves inside the editing scope, including Snap', async () => {
		const { target, spies } = await beganInstrument();
		const inputs = [...target.querySelectorAll('input')];
		const x = inputs[0];
		const z = inputs[1];
		const snap = inputs[3];
		if (x === undefined || z === undefined || snap === undefined) {
			throw new Error('the editing fields are missing');
		}
		x.focus();
		x.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: z }));
		z.focus();
		z.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: snap }));
		await tick();

		expect(spies.cancel).not.toHaveBeenCalled();
		expect(target.textContent).toContain(`Editing ${ENTITY_ID}`);
	});
});
