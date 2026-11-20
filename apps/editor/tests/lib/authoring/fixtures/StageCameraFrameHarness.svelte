<script lang="ts">
	import { untrack } from 'svelte';
	import { Canvas } from '@threlte/core';
	import type { ViewportEvaluation } from '@portfolio/camera-core';
	import StageCamera from '$lib/authoring/stage/shell/StageCamera.svelte';
	import { provideCanvasRendererState } from '$lib/render/renderer-context';
	import { countSurfaceFrames } from '$lib/render/renderer-backend';
	import { perfRenderer } from '$lib/platform/perf-marks';

	let {
		evaluation: initialEvaluation,
		paperVisible: initialPaperVisible = false,
		frameViewport: initialFrameViewport = null
	}: {
		evaluation: ViewportEvaluation;
		paperVisible?: boolean;
		frameViewport?: {
			readonly left: number;
			readonly top: number;
			readonly width: number;
			readonly height: number;
		} | null;
	} = $props();

	let evaluation = $state(untrack(() => initialEvaluation));
	let paperVisible = $state(untrack(() => initialPaperVisible));
	let frameViewport = $state(untrack(() => initialFrameViewport));

	// The Camera realization reads the observed backend from the Canvas host's
	// record. This harness supplies the record itself: it mounts no CanvasHost, so
	// there is no generation to observe, only the WebGL2 convention.
	const rendererState = provideCanvasRendererState();
	rendererState.backend = 'webgl2';
	rendererState.generation = 0;

	/**
	 * The only renderer surface StageCamera and Threlte's Canvas touch. The framing
	 * contract is the CSS box handed to `setViewport`/`setScissor`, not a GPU frame,
	 * so the stub records nothing and simply answers the size queries.
	 */
	let animation: ((time: number) => void) | null = null;
	const harnessRenderer = {
		domElement: null,
		shadowMap: { enabled: false, type: 0 },
		xr: { isPresenting: false },
		render: () => {},
		setAnimationLoop: (callback: ((time: number) => void) | null) => {
			animation = callback;
			if (callback === null) return;
			const loop = (time: number): void => {
				if (animation !== callback) return;
				callback(time);
				requestAnimationFrame(loop);
			};
			requestAnimationFrame(loop);
		},
		setPixelRatio: () => {},
		setSize: () => {},
		getSize: (target: { set(x: number, y: number): void }) => target.set(1280, 720),
		setScissorTest: () => {},
		setViewport: () => {},
		setScissor: () => {},
		setClearColor: () => {},
		clear: () => {},
		dispose: () => {}
	};
	const counted = countSurfaceFrames(perfRenderer(harnessRenderer as object, 'stage') as typeof harnessRenderer, 'stage');
	const createHarnessRenderer = () => counted as never;

	export function setEvaluation(next: ViewportEvaluation): void {
		evaluation = next;
	}

	export function setPaperVisible(next: boolean): void {
		paperVisible = next;
	}

	export function setFrameViewport(
		next: {
			readonly left: number;
			readonly top: number;
			readonly width: number;
			readonly height: number;
		} | null
	): void {
		frameViewport = next;
	}
</script>

<Canvas createRenderer={createHarnessRenderer} dpr={[1, 1]} shadows={false}>
	<StageCamera {evaluation} {paperVisible} {frameViewport} />
</Canvas>
