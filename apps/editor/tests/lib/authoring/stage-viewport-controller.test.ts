// @vitest-environment jsdom
/**
 * E3 / decomposition contract V — the Stage viewport controller's lifetime.
 *
 * The mounted route suite proves the production caller. This focused suite
 * doubles only the facade reads so the scheduler contract is deterministic:
 * exactly one callback queued while mounted, no evaluation while Preview holds
 * the output, a thrown adapter contribution still reschedules, and disposal
 * cancels the loop.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ViewportEvaluation } from '@portfolio/camera-core';
import type { StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageViewport } from '$lib/authoring/stage/route/stage-viewport.svelte';

const RECT = {
	left: 10,
	top: 20,
	width: 800,
	height: 600,
	right: 810,
	bottom: 620,
	x: 10,
	y: 20,
	toJSON() {}
};

function fakeEvaluation(generation: number): ViewportEvaluation {
	return {
		token: {
			outputId: 'output',
			sessionEpoch: 'session',
			sourceRevision: 'source',
			evaluationGeneration: generation
		},
		rect: { left: RECT.left, top: RECT.top, width: RECT.width, height: RECT.height, devicePixelRatio: 1 },
		settledReading: '3d'
	} as unknown as ViewportEvaluation;
}

function harness() {
	let evaluation = fakeEvaluation(1);
	let evaluations = 0;
	let overlays: readonly { id: string; css: readonly [number, number]; label: string }[] = [];
	let planDependency = 'plan-1';
	let planCalls = 0;
	let throwOnce = false;
	const facade = {
		camera: {
			evaluate: vi.fn(() => {
				evaluations += 1;
				return { kind: 'evaluated' as const, evaluation };
			})
		},
		setPlanParameters: vi.fn(),
		planDependencyKey: () => planDependency,
		plan: () => {
			planCalls += 1;
			return { kind: 'unavailable' as const, reason: 'invalid-viewport', issues: [] };
		},
		overlays: () => {
			if (throwOnce) {
				throwOnce = false;
				throw new Error('adapter contribution failed once');
			}
			return overlays;
		},
		candidatePreviews: () => [],
		guides: () => [],
		ghosts: () => [],
		marks: () => [],
		snapshot: () => ({ domain: { geometry: {} } }),
		evaluationId: () => `evaluation-${evaluation.token.evaluationGeneration}`,
		projectWorld: () => ({ kind: 'failed', code: 'stale-evaluation', message: 'unused' })
	} as unknown as StageFacade;
	return {
		facade,
		get evaluations() {
			return evaluations;
		},
		get planCalls() {
			return planCalls;
		},
		setPlanDependency(key: string) {
			planDependency = key;
		},
		setOverlays(next: typeof overlays) {
			overlays = next;
		},
		throwNextOverlay() {
			throwOnce = true;
		}
	};
}

function controller(probe: ReturnType<typeof harness>, previewing: { value: boolean }) {
	const queue = new Map<number, FrameRequestCallback>();
	let nextHandle = 0;
	const viewport = createStageViewport({
		facade: () => probe.facade,
		stageElement: () =>
			({
				clientWidth: RECT.width,
				clientHeight: RECT.height,
				getBoundingClientRect: () => RECT
			}) as unknown as HTMLElement,
		throughFrameElement: () => null,
		lookThroughActive: () => false,
		previewing: () => previewing.value,
		lens: () => 'experience',
		revealed: () => [],
		roomLabels: () => ({ plan: false, threeD: false }),
		groundReachMeters: () => undefined,
		nowSeconds: () => 0,
		advanceLookThroughZoom: () => {},
		advancePlayback: () => {},
		onBeforeRefresh: () => {},
		onAfterRefresh: () => {},
		scheduler: {
			request(callback) {
				queue.set(++nextHandle, callback);
				return nextHandle;
			},
			cancel(handle) {
				queue.delete(handle);
			}
		}
	});
	return { viewport, queue };
}

async function runOne(queue: Map<number, FrameRequestCallback>): Promise<void> {
	const pending = [...queue.entries()];
	queue.clear();
	for (const [, callback] of pending) callback(performance.now());
}

/** Runs one frame and expects the contribution's error to escape the frame. */
function runOneThrowing(queue: Map<number, FrameRequestCallback>, message: string): void {
	const pending = [...queue.entries()];
	queue.clear();
	expect(() => {
		for (const [, callback] of pending) callback(performance.now());
	}).toThrow(message);
}

describe('Stage viewport controller', () => {
	it('queues exactly one frame and stops after disposal', async () => {
		const probe = harness();
		const { viewport, queue } = controller(probe, { value: false });
		viewport.start();
		expect(queue.size).toBe(1);
		await runOne(queue);
		expect(queue.size).toBe(1);
		const evaluations = probe.evaluations;
		await runOne(queue);
		expect(probe.evaluations).toBeGreaterThan(evaluations);
		viewport.dispose();
		expect(queue.size).toBe(0);
	});

	it('does not evaluate while Preview holds the Stage output', async () => {
		const probe = harness();
		const previewing = { value: false };
		const { viewport, queue } = controller(probe, previewing);
		viewport.start();
		await runOne(queue);
		const held = probe.evaluations;
		previewing.value = true;
		await runOne(queue);
		await runOne(queue);
		expect(probe.evaluations).toBe(held);
		expect(queue.size).toBe(1);
		previewing.value = false;
		await runOne(queue);
		expect(probe.evaluations).toBeGreaterThan(held);
		viewport.dispose();
	});

	it('reschedules after a thrown contribution and keeps the previous arrays', async () => {
		const probe = harness();
		const marker = [{ id: 'marker', css: [1, 2] as const, label: 'probe' }];
		probe.setOverlays(marker);
		const { viewport, queue } = controller(probe, { value: false });
		viewport.start();
		await runOne(queue);
		expect(viewport.markers).toBe(marker);
		probe.throwNextOverlay();
		runOneThrowing(queue, 'adapter contribution failed once');
		expect(queue.size).toBe(1);
		expect(viewport.markers).toBe(marker);
		await runOne(queue);
		expect(queue.size).toBe(1);
		viewport.dispose();
	});

	it('recomputes the Plan only when its dependency key changes', async () => {
		const probe = harness();
		const { viewport, queue } = controller(probe, { value: false });
		viewport.start();
		await runOne(queue);
		await runOne(queue);
		expect(probe.planCalls).toBe(1);
		probe.setPlanDependency('plan-2');
		await runOne(queue);
		expect(probe.planCalls).toBe(2);
		viewport.dispose();
	});
});

describe('Stage viewport controller — Look Through capture frame', () => {
	it('evaluates the absolute capture frame while the scissor stays Stage-local', async () => {
		const probe = harness();
		const evaluate = probe.facade.camera.evaluate as ReturnType<typeof vi.fn>;
		const queue = new Map<number, FrameRequestCallback>();
		let nextHandle = 0;
		const frameRect = {
			left: 202,
			top: 113,
			width: 420,
			height: 260,
			right: 622,
			bottom: 373,
			x: 202,
			y: 113,
			toJSON() {}
		};
		const viewport = createStageViewport({
			facade: () => probe.facade,
			stageElement: () =>
				({
					clientWidth: RECT.width,
					clientHeight: RECT.height,
					getBoundingClientRect: () => RECT
				}) as unknown as HTMLElement,
			throughFrameElement: () =>
				({
					clientLeft: 2,
					clientTop: 3,
					getBoundingClientRect: () => frameRect
				}) as unknown as HTMLElement,
			lookThroughActive: () => true,
			previewing: () => false,
			lens: () => 'experience',
			revealed: () => [],
			roomLabels: () => ({ plan: false, threeD: false }),
			groundReachMeters: () => undefined,
			nowSeconds: () => 0,
			advanceLookThroughZoom: () => {},
			advancePlayback: () => {},
			onBeforeRefresh: () => {},
			onAfterRefresh: () => {},
			scheduler: {
				request(callback) {
					queue.set(++nextHandle, callback);
					return nextHandle;
				},
				cancel(handle) {
					queue.delete(handle);
				}
			}
		});
		viewport.start();
		await runOne(queue);

		// The Stage is 800×600; the capture frame is 420×260 at another offset.
		// Evaluation receives the frame's absolute box, the scissor its Stage-local
		// box. If evaluation is fed the Stage rect, these cannot both align.
		expect(evaluate).toHaveBeenCalledWith(
			{
				left: 204,
				top: 116,
				width: 420,
				height: 260,
				devicePixelRatio: 1
			},
			0,
			undefined
		);
		expect(viewport.framedViewport).toEqual({
			left: 194,
			top: 96,
			width: 420,
			height: 260
		});
		expect(viewport.framedViewport).not.toEqual(viewport.rect);
		viewport.dispose();
	});
});
