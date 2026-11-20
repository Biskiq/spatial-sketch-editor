/**
 * Controllable renderers for the PR 1 Canvas lifecycle contract.
 *
 * Only the GPU implementation is doubled. Threlte's Canvas/context, the
 * candidate hosts, the generation owner, the facade and the lifecycle state
 * machine are the real experiment modules. Init, disposal and device loss are
 * deferred so a test can hold a generation in exactly the state it needs.
 */
import type { CanvasHostFactory, HostRenderer } from '../../../../experiments/webgpu-migration/lifecycle/host-types';
import type { RendererAttempt, RendererBackend } from '../../../../experiments/webgpu-migration/lifecycle/generation-owner';

export type FakeRenderer = HostRenderer & {
	readonly canvas: HTMLCanvasElement;
	readonly mode: RendererAttempt;
	backend: RendererBackend;
	renderCalls: number;
	disposeCalls: number;
	animation: ((time: number) => void) | null;
	pixelRatio: number;
	lastSize: { width: number; height: number } | null;
	shadowMap: { enabled: boolean; type: number; autoUpdate: boolean; needsUpdate: boolean };
	info: { calls: number; render: { calls: number; triangles: number }; memory: { textures: number } };
	xr: { isPresenting: boolean };
	outputColorSpace: string;
	toneMapping: number;
	toneMappingExposure: number;
	domElement: HTMLCanvasElement;
	lossListener: (() => void) | null;
	onDeviceLost: (info: unknown) => void;
	setAnimationLoop(callback: ((time: number) => void) | null): void;
	setPixelRatio(value: number): void;
	setSize(width: number, height: number): void;
	getSize(target: { x: number; y: number }): { x: number; y: number };
	render(): void;
	dispose(): Promise<void>;
	[key: string]: unknown;
};

export type Deferred = {
	readonly promise: Promise<unknown>;
	resolve(value?: unknown): void;
	reject(error: unknown): void;
};

export function deferred(): Deferred {
	let resolve: (value?: unknown) => void = () => {};
	let reject: (error: unknown) => void = () => {};
	const promise = new Promise<unknown>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

export type FakeHost = {
	readonly factory: CanvasHostFactory;
	readonly created: FakeRenderer[];
	/** Resolve/reject the nth creation's init. */
	resolveInit(index: number, backend?: RendererBackend): void;
	rejectInit(index: number, error?: unknown): void;
	/** Fire the nth creation's registered device-loss listener. */
	lose(index: number): void;
	/** Run one scheduler frame for every live renderer. */
	pump(): void;
	/** Every disposal, in order; used to prove pointer-cancel ordering. */
	readonly disposals: Array<{ index: number; mode: RendererAttempt }>;
	readonly disposeMode: { value: 'resolve' | 'reject' | 'hang' };
	/** Whether every creation got a distinct canvas. */
	canvasIdentities(): HTMLCanvasElement[];
};

/**
 * One fake host factory. `backendFor(attempt, index)` decides the backend the
 * observed renderer reports, so a test can prove a forced attempt really ran
 * WebGL2 and an automatic one ran WebGPU.
 */
export function fakeHost(
	options: { backendFor?: (attempt: RendererAttempt, index: number) => RendererBackend } = {}
): FakeHost {
	const created: FakeRenderer[] = [];
	const pending: Deferred[] = [];
	const disposals: Array<{ index: number; mode: RendererAttempt }> = [];
	const disposeMode: { value: 'resolve' | 'reject' | 'hang' } = { value: 'resolve' };
	let clock = 0;

	const factory: CanvasHostFactory = {
		create(canvas, mode) {
			const index = created.length;
			const init = deferred();
			pending.push(init);
			const renderer: FakeRenderer = {
				canvas,
				mode,
				backend: options.backendFor?.(mode, index) ?? (mode === 'webgl2' ? 'webgl2' : 'webgpu'),
				renderCalls: 0,
				disposeCalls: 0,
				animation: null,
				pixelRatio: 1,
				lastSize: null,
				shadowMap: { enabled: false, type: 0, autoUpdate: true, needsUpdate: false },
				info: { calls: 0, render: { calls: 0, triangles: 0 }, memory: { textures: 0 } },
				xr: { isPresenting: false },
				outputColorSpace: 'srgb',
				toneMapping: 0,
				toneMappingExposure: 1,
				domElement: canvas,
				lossListener: null,
				onDeviceLost: () => {},
				setAnimationLoop(callback) {
					renderer.animation = callback;
				},
				setPixelRatio(value) {
					renderer.pixelRatio = value;
				},
				setSize(width, height) {
					renderer.lastSize = { width, height };
				},
				getSize(target) {
					target.x = 1280;
					target.y = 720;
					return target;
				},
				render() {
					renderer.renderCalls += 1;
					renderer.info.calls += 1;
					renderer.info.render.calls += 1;
				},
				async dispose() {
					renderer.disposeCalls += 1;
					disposals.push({ index, mode: renderer.mode });
					if (disposeMode.value === 'hang') return new Promise<void>(() => {});
					if (disposeMode.value === 'reject') throw new Error('async disposal rejected');
				}
			};
			created.push(renderer);
			return renderer;
		},
		init(renderer) {
			const index = created.indexOf(renderer as FakeRenderer);
			return pending[index]!.promise.then(() => {
				const target = renderer as FakeRenderer;
				target.info.calls = 0;
			});
		},
		backend(renderer) {
			return (renderer as FakeRenderer).backend;
		},
		dispose(renderer) {
			return (renderer as FakeRenderer).dispose();
		},
		onDeviceLost(renderer, listener) {
			const target = renderer as FakeRenderer;
			target.lossListener = listener;
			return () => {
				if (target.lossListener === listener) target.lossListener = null;
			};
		}
	};

	return {
		factory,
		created,
		disposals,
		disposeMode,
		resolveInit(index, backend) {
			if (backend !== undefined) created[index]!.backend = backend;
			pending[index]!.resolve();
		},
		rejectInit(index, error = new Error('init rejected')) {
			pending[index]!.reject(error);
		},
		lose(index) {
			created[index]!.lossListener?.();
		},
		pump() {
			clock += 16;
			for (const renderer of created) renderer.animation?.(clock);
		},
		canvasIdentities() {
			return created.map((renderer) => renderer.canvas);
		}
	};
}

/** A settled macrotask boundary, so unhandled rejections have been reported. */
export function settle(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}
