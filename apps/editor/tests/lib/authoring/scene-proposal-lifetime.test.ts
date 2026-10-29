// @vitest-environment jsdom
/**
 * T2.P01.S03 — a Scene proposal's lifetime across a re-evaluation.
 *
 * The Stage redraws on every frame and its evaluation token advances with each
 * draw, so the instrument sees a new evaluation id after any redraw — including
 * the redraw a typed candidate asks for itself. A live proposal must survive
 * that; only a genuine reading change, an ended lease, a task close, a source
 * replacement or unmount may cancel it.
 *
 * These mount the real instrument and re-provide its services the way the host
 * does, so the decision under test is the instrument's own.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import type { ViewportEvaluation } from '@portfolio/camera-core';

import SceneTransformInstrument from '$lib/authoring/adapters/scene/SceneTransformInstrument.svelte';
import {
	publishSceneSurface,
	sceneReadingKey,
	sceneSurfaceFor,
	type ScenePlacementSession
} from '$lib/authoring/adapters/scene/placement';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';

import { reactiveCell } from './__fixtures__/reactive-cell.svelte';

const ENTITY_ID = 'entity-lifetime-fixture';
const SOURCE_ID = `sha256-${'b'.repeat(64)}`;
const SNAPSHOT = {
	acceptedRevision: { projectId: 'project-lifetime', revisionId: 'revision-lifetime' },
	sourceContentId: SOURCE_ID,
	compileGeneration: 'generation-lifetime',
	domain: {
		scene: {
			entities: [
				{
					kind: 'primitive',
					primitive: 'box',
					id: ENTITY_ID,
					name: 'Lifetime block',
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

/** One evaluation token; the generation is the frame, so a redraw raises it. */
function evaluation(reading: '3d' | 'plan', generation: number): ViewportEvaluation {
	return {
		token: {
			outputId: 'output-lifetime',
			sessionEpoch: 'session-lifetime',
			sourceRevision: SOURCE_ID,
			evaluationGeneration: generation
		},
		settledReading: reading
	} as unknown as ViewportEvaluation;
}

type SessionSpies = {
	readonly session: ScenePlacementSession;
	readonly begin: ReturnType<typeof vi.fn>;
	readonly commit: ReturnType<typeof vi.fn>;
	readonly cancel: ReturnType<typeof vi.fn>;
	readonly setEntry: ReturnType<typeof vi.fn>;
	/** End the grant without moving the reading, as the host's policy can. */
	readonly endLease: () => void;
};

function sessionSpies(): SessionSpies {
	const begin = vi.fn(() => ({ kind: 'idle' as const }));
	const commit = vi.fn(async () => ({ kind: 'committed' as const }));
	const cancel = vi.fn();
	let leaseLive = true;
	const session = {
		armed: () => 'select' as const,
		arm: vi.fn(),
		snapStep: () => null,
		setSnapStep: vi.fn(),
		begin,
		beginPlace: vi.fn(() => ({ kind: 'idle' as const })),
		placePrimitive: () => 'box' as const,
		armedFormCopy: () => null,
		setPlacePrimitive: vi.fn(),
		previewMove: vi.fn(() => ({ kind: 'idle' as const })),
		previewYaw: vi.fn(() => ({ kind: 'idle' as const })),
		previewPlace: vi.fn(() => ({ kind: 'idle' as const })),
		invalidatePreview: vi.fn(),
		abortGesture: vi.fn(),
		setEntry: vi.fn((kind: string, text: string) => {
			const value = Number(text);
			return {
				kind: 'candidate' as const,
				candidate:
					kind === 'yaw'
						? {
								kind: 'yaw' as const,
								entityId: ENTITY_ID,
								position: [2, 0.5, 2] as const,
								rotation: [0, value, 0] as const,
								worldXZ: [2, 2] as const,
								yaw: value,
								snappedStep: null,
								primitive: null
							}
						: {
								kind: 'move' as const,
								entityId: ENTITY_ID,
								position: [value, 0.5, 2] as const,
								rotation: [0, 0.7, 0] as const,
								worldXZ: [value, 2] as const,
								yaw: 0.7,
								snappedStep: null,
								primitive: null
							}
			};
		}),
		commit,
		commitPlace: vi.fn(async () => ({ kind: 'committed' as const })),
		place: vi.fn(async () => ({ kind: 'committed' as const })),
		cancel,
		baseline: () => null,
		placedEntityId: () => null,
		subjectEntityId: () => ENTITY_ID,
		candidate: () => null,
		proposalLive: () => leaseLive,
		setPlacementCommittedListener: vi.fn(),
		placementCommittedListener: () => null
	} as unknown as ScenePlacementSession;
	return {
		session,
		begin,
		commit,
		cancel,
		setEntry: session.setEntry as unknown as ReturnType<typeof vi.fn>,
		endLease: () => {
			leaseLive = false;
		}
	};
}

function servicesFor(evaluationNow: ViewportEvaluation): StageAdapterServices {
	return {
		stage: {
			snapshot: () => SNAPSHOT,
			selectionState: () => ({
				primary: { domain: 'scene', subject: { kind: 'entity', id: ENTITY_ID } }
			}),
			evaluation: () => evaluationNow,
			evaluationId: () =>
				`${evaluationNow.token.outputId}::${evaluationNow.token.sessionEpoch}::${evaluationNow.token.sourceRevision}::${evaluationNow.token.evaluationGeneration}`,
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

function fieldNamed(target: HTMLElement, index: number): HTMLInputElement {
	const found = target.querySelectorAll('.fields input')[index];
	if (found === undefined) throw new Error(`No field ${index} in the instrument`);
	return found as HTMLInputElement;
}

/** Let the instrument's frame loop run the given number of frames. */
async function frames(count: number): Promise<void> {
	for (let index = 0; index < count; index += 1) {
		await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
		await tick();
	}
}

let cleanup: (() => void) | null = null;

afterEach(() => {
	cleanup?.();
	cleanup = null;
	document.body.replaceChildren();
});

/**
 * Mount the instrument over a published surface, with props the host can
 * re-provide — a new evaluation of the same reading, or a new reading.
 */
async function mountedInstrument(initial: ViewportEvaluation): Promise<{
	readonly target: HTMLElement;
	readonly spies: SessionSpies;
	readonly reprovide: (evaluationNow: ViewportEvaluation) => Promise<void>;
	readonly destroy: () => void;
}> {
	const spies = sessionSpies();
	publishSceneSurface(SNAPSHOT, {
		reading: sceneReadingKey(initial),
		session: spies.session
	});
	const services = reactiveCell(servicesFor(initial));
	const target = document.createElement('div');
	document.body.appendChild(target);
	const component = mount(SceneTransformInstrument, {
		target,
		props: {
			get services() {
				return services.value;
			}
		}
	});
	const destroy = () => {
		cleanup = null;
		unmount(component);
	};
	cleanup = destroy;
	await tick();
	return {
		target,
		spies,
		destroy,
		async reprovide(evaluationNow) {
			// The host's side of a redraw: re-provide services whose evaluation has
			// advanced. A reading that has no surface yet is published the way the
			// adapter publishes one when its task opens on that reading.
			if (sceneSurfaceFor(SNAPSHOT, evaluationNow) === null) {
				publishSceneSurface(SNAPSHOT, {
					reading: sceneReadingKey(evaluationNow),
					session: sessionSpies().session
				});
			}
			services.value = servicesFor(evaluationNow);
			await tick();
		}
	};
}

/** Mount, select the entity, open the proposal and type one exact value. */
async function beganWithEntry(initial: ViewportEvaluation) {
	const mounted = await mountedInstrument(initial);
	buttonNamed(mounted.target, 'Use selection').click();
	buttonNamed(mounted.target, 'Begin').click();
	await tick();
	const x = fieldNamed(mounted.target, 0);
	x.focus();
	x.value = '3.5';
	x.dispatchEvent(new Event('input', { bubbles: true }));
	await tick();
	return mounted;
}

describe('Scene proposal lifetime', () => {
	it('keeps a live proposal and its exact entry across an ordinary re-evaluation', async () => {
		const { target, spies, reprovide } = await beganWithEntry(evaluation('3d', 1));
		expect(spies.begin).toHaveBeenCalledWith(ENTITY_ID);
		expect(target.textContent).toContain('Candidate 3.500, 2.000 m');

		// Every frame raises the evaluation generation. The candidate's own redraw
		// request is what makes this happen in the same keystroke.
		await reprovide(evaluation('3d', 2));
		await reprovide(evaluation('3d', 3));

		expect(spies.cancel).not.toHaveBeenCalled();
		expect(target.querySelectorAll('.fields input')).toHaveLength(3);
		expect(target.textContent).toContain('Candidate 3.500, 2.000 m');
		expect(target.textContent).not.toContain('Cancelled');

		// The proposal the creator can still see is the one Commit installs.
		buttonNamed(target, 'Commit').click();
		await tick();
		await tick();
		expect(spies.commit).toHaveBeenCalledTimes(1);
		// An accepted install closes the open task, so this panel's services are
		// retired; it must not report a result of its own through them.
		expect(target.textContent).not.toContain('Committed.');
		expect(target.textContent).toContain('Begin');
	});

	it('shows the captured candidate in the fields the entry did not come from', async () => {
		const { target } = await beganWithEntry(evaluation('3d', 1));

		// A yaw proposal is the accepted X/Z with the new angle, so the X/Z fields
		// must show that pose rather than text that will not commit.
		const yaw = fieldNamed(target, 2);
		yaw.value = '1.25';
		yaw.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		expect(target.textContent).toContain('Candidate 2.000, 2.000 m · 1.250 rad');
		expect(fieldNamed(target, 0).value).toBe('2');
		expect(fieldNamed(target, 1).value).toBe('2');
		expect(fieldNamed(target, 2).value).toBe('1.25');

		// The next exact entry replaces the proposal with a move one, which keeps the
		// accepted yaw: the yaw field goes back to the angle the ghost now shows.
		const x = fieldNamed(target, 0);
		x.value = '4';
		x.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		expect(target.textContent).toContain('Candidate 4.000, 2.000 m · 0.700 rad');
		expect(fieldNamed(target, 0).value).toBe('4');
		expect(fieldNamed(target, 2).value).toBe('0.7');
	});

	it('keeps the form open when an exact entry is refused and the lease survives', async () => {
		const { target, spies } = await beganWithEntry(evaluation('3d', 1));
		spies.setEntry.mockReturnValueOnce({
			kind: 'refused',
			code: 'no-support',
			message: 'No compiled Room floor supports this point.'
		});

		const z = fieldNamed(target, 1);
		z.value = '9';
		z.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();

		// A refused entry releases nothing, so the creator can correct it in place.
		expect(target.querySelectorAll('.fields input')).toHaveLength(3);
		expect(target.textContent).toContain('no-support: No compiled Room floor supports this point.');
		expect(spies.cancel).not.toHaveBeenCalled();
	});

	it('closes the form and keeps the reason when a refusal ends the proposal', async () => {
		const { target, spies, reprovide } = await beganWithEntry(evaluation('3d', 1));
		const refusal = 'missing-contact-metadata: The entity has no verified contact.';
		spies.commit.mockImplementationOnce(async () => {
			// Commitment withdraws the lease with the pose, as the session does.
			spies.endLease();
			return {
				kind: 'refused' as const,
				code: 'missing-contact-metadata',
				message: 'The entity has no verified contact.'
			};
		});

		buttonNamed(target, 'Commit').click();
		await tick();
		await tick();
		expect(spies.commit).toHaveBeenCalledTimes(1);
		expect(target.textContent).toContain(refusal);

		// The ended lease closes the form, and the reason survives the close rather
		// than being replaced by a cancel the creator never asked for.
		await reprovide(evaluation('3d', 2));
		expect(target.querySelector('.fields')).toBeNull();
		expect(target.textContent).toContain(refusal);
		expect(target.textContent).not.toContain('Cancelled');
	});

	it('cancels the proposal when the 3D reading changes to Plan mid-entry', async () => {
		const { target, spies, reprovide } = await beganWithEntry(evaluation('3d', 1));
		expect(spies.cancel).not.toHaveBeenCalled();

		await reprovide(evaluation('plan', 2));

		// One release, and it is the registry's: publishing the replacing reading
		// cancels the session that prepared the proposal, and the instrument must
		// not release the dead lease a second time. The assertions below are the
		// instrument's own: it drops the form and says so.
		expect(spies.cancel).toHaveBeenCalledTimes(1);
		expect(target.querySelector('.fields')).toBeNull();
		expect(target.textContent).toContain('Cancelled; the accepted pose is unchanged.');
	});

	it('cancels a displayed proposal whose lease the host ended under the same reading', async () => {
		const { target, spies, reprovide } = await beganWithEntry(evaluation('3d', 1));
		expect(target.textContent).toContain('Candidate 3.500, 2.000 m');

		// The reading does not move, so no surface replaces this session: the form
		// still holds the registry's session and only the lease is gone. Commit
		// would refuse it, so the form must not keep offering it.
		spies.endLease();
		await reprovide(evaluation('3d', 2));

		expect(target.querySelector('.fields')).toBeNull();
		expect(target.textContent).toContain('Cancelled; the accepted pose is unchanged.');
		expect(spies.commit).not.toHaveBeenCalled();
	});

	it('cancels through the frame watcher when the host ends the lease without a re-render', async () => {
		const { target, spies } = await beganWithEntry(evaluation('3d', 1));

		expect(target.textContent).toContain('Candidate 3.500, 2.000 m');
		// The loop's first pass adopts the published reading and settles; what follows
		// is its steady state, which is where a lease ends without a re-render.
		await frames(2);

		// No prop is re-provided here: the only observer left is that loop.
		spies.endLease();
		await frames(3);

		expect(target.querySelector('.fields')).toBeNull();
		expect(target.textContent).toContain('Cancelled; the accepted pose is unchanged.');
	});

	it('adopts the registry surface that replaces the same reading', async () => {
		const { target, spies, reprovide } = await beganWithEntry(evaluation('3d', 1));
		const replacement = sessionSpies();
		// A re-armed task or a rebuilt binding publishes another session for the same
		// reading; the registry is the authority for what the overlay draws.
		publishSceneSurface(SNAPSHOT, {
			reading: sceneReadingKey(evaluation('3d', 1)),
			session: replacement.session
		});
		await reprovide(evaluation('3d', 2));

		// The proposal belonged to the surface that was replaced.
		expect(target.querySelector('.fields')).toBeNull();
		expect(target.textContent).toContain('Cancelled; the accepted pose is unchanged.');

		// The form now edits through the session the registry names.
		buttonNamed(target, 'Begin').click();
		await tick();
		expect(replacement.begin).toHaveBeenCalledWith(ENTITY_ID);
		expect(spies.begin).toHaveBeenCalledTimes(1);
	});

	it('releases the proposal it shows when the instrument is destroyed', async () => {
		const { spies, destroy } = await beganWithEntry(evaluation('3d', 1));
		expect(spies.cancel).not.toHaveBeenCalled();

		// The release used to live in the effect cleanup, which also ran on every
		// keystroke; destroy is the only teardown that may keep it.
		destroy();
		expect(spies.cancel).toHaveBeenCalledTimes(1);
	});
});
