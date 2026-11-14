<script lang="ts">
	import { untrack } from 'svelte';
	import { Canvas } from '@threlte/core';
	import type { ViewportEvaluation } from '@portfolio/camera-core';
	import StageCamera from '$lib/authoring/stage/shell/StageCamera.svelte';
	import { stageCanvasRenderer } from '$lib/render/canvas-renderers';

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

<Canvas createRenderer={stageCanvasRenderer} dpr={[1, 1]} shadows={false}>
	<StageCamera {evaluation} {paperVisible} {frameViewport} />
</Canvas>
