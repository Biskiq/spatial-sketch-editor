// @vitest-environment jsdom
/**
 * E3 — actual Stage render frames, not just Camera evaluations.
 *
 * This mounts the real Threlte Canvas and the real `StageCamera` with the
 * production `stageCanvasRenderer`; only the GPU implementation is doubled.
 * The counted `render:stage-frame` is the production managed-renderer wrapper,
 * so a frame here is an actual `renderer.render` call from Threlte's on-demand
 * loop. A settled Stage must call it zero times; each relevant input change
 * must ask for exactly one frame.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import { createViewportCameraState, evaluateViewport, type ViewportEvaluation } from '@portfolio/camera-core';
import { startStageCounting, type StageCounting } from '../../helpers/stage-counts';
import StageCameraFrameHarness from './fixtures/StageCameraFrameHarness.svelte';

const RECT = { left: 0, top: 0, width: 800, height: 600, devicePixelRatio: 1 };

// Svelte's devicePixelRatio rune and Threlte's renderer context touch
// matchMedia at module evaluation, before a test hook could install it.
vi.hoisted(() => {
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
	});
});

vi.mock('three', async (importOriginal) => {
	const actual = await importOriginal<typeof import('three')>();
	class StubWebGLRenderer {
		readonly info = { render: { calls: 1, triangles: 1 }, memory: { geometries: 0, textures: 0 } };
		readonly shadowMap = { enabled: false, type: 0, autoUpdate: true, needsUpdate: false };
		readonly xr = { isPresenting: false };
		readonly domElement: HTMLCanvasElement | null;
		outputColorSpace = '';
		toneMapping = 0;
		private animation: ((time: number) => void) | null = null;

		constructor(options: { canvas?: HTMLCanvasElement } = {}) {
			this.domElement = options.canvas ?? null;
		}

		setAnimationLoop(callback: ((time: number) => void) | null): void {
			this.animation = callback;
			if (callback === null) return;
			const loop = (time: number): void => {
				if (this.animation !== callback) return;
				callback(time);
				requestAnimationFrame(loop);
			};
			requestAnimationFrame(loop);
		}

		setPixelRatio(): void {}
		setSize(): void {}
		getSize(target: { x: number; y: number }): { x: number; y: number } {
			target.x = RECT.width;
			target.y = RECT.height;
			return target;
		}
		setViewport(): void {}
		setScissor(): void {}
		setScissorTest(): void {}
		clear(): void {}
		setClearColor(): void {}
		render(): void {}
		dispose(): void {}
	}
	return { ...actual, WebGLRenderer: StubWebGLRenderer };
});

function evaluation(generation: number): ViewportEvaluation {
	const state = createViewportCameraState({
		outputId: 'stage',
		sessionEpoch: 'session',
		sourceRevision: 'source',
		reading: '3d',
		sceneRadiusMeters: 10,
		pose: { target: [0, 1.5, 0], azimuthRadians: 0.4, elevationRadians: 0.3, targetPlaneHeightMeters: 2 }
	});
	const result = evaluateViewport(state, RECT, 0, generation);
	if (result.kind !== 'evaluated') throw new Error(`the Stage viewport did not evaluate: ${result.reason}`);
	return result.evaluation;
}

let component: ReturnType<typeof mount> & {
	setEvaluation(next: ViewportEvaluation): void;
	setPaperVisible(next: boolean): void;
	setFrameViewport(next: { left: number; top: number; width: number; height: number } | null): void;
};
let target: HTMLElement;
let frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
let counting: StageCounting;

async function frame(count = 1): Promise<void> {
	for (let index = 0; index < count; index += 1) {
		await tick();
		const pending = [...frames.values()];
		frames.clear();
		for (const callback of pending) callback(performance.now());
	}
	await tick();
}

async function settle(): Promise<void> {
	for (let index = 0; index < 8; index += 1) await frame();
}

beforeEach(async () => {
	frames = new Map();
	frameId = 0;
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		frames.set(++frameId, callback);
		return frameId;
	});
	vi.stubGlobal('cancelAnimationFrame', (id: number) => {
		frames.delete(id);
	});
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe(): void {}
			unobserve(): void {}
			disconnect(): void {}
		}
	);
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(RECT as unknown as DOMRect);
	counting = startStageCounting();
	target = document.createElement('div');
	document.body.append(target);
	component = mount(StageCameraFrameHarness, {
		target,
		props: { evaluation: evaluation(1) }
	}) as typeof component;
	flushSync();
	await settle();
});

afterEach(() => {
	unmount(component);
	target.remove();
	counting.stop();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('Stage render frames', () => {
	it('renders zero Stage frames over 120 settled frames', async () => {
		counting.reset();
		await frame(120);
		expect(counting.count('render:stage-frame')).toBe(0);
	});

	it('renders one frame for a new evaluation, then settles', async () => {
		counting.reset();
		component.setEvaluation(evaluation(2));
		await frame();
		expect(counting.count('render:stage-frame')).toBe(1);
		counting.reset();
		await frame(120);
		expect(counting.count('render:stage-frame')).toBe(0);
	});

	it('renders one frame for an appearance change, then settles', async () => {
		counting.reset();
		component.setPaperVisible(true);
		// The appearance effect requests its surface frame after the update has
		// applied, so the change settles over two display opportunities.
		await frame(2);
		expect(counting.count('render:stage-frame')).toBe(2);
		counting.reset();
		await frame(120);
		expect(counting.count('render:stage-frame')).toBe(0);
	});

	it('renders one frame for a capture-frame change, then settles', async () => {
		counting.reset();
		component.setFrameViewport({ left: 40, top: 30, width: 400, height: 250 });
		await frame();
		expect(counting.count('render:stage-frame')).toBe(1);
		counting.reset();
		await frame(120);
		expect(counting.count('render:stage-frame')).toBe(0);
	});
});
