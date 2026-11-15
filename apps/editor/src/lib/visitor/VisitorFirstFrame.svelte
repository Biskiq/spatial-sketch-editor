<script lang="ts">
	/**
	 * The Visitor surface's first rendered frame mark.
	 *
	 * Inert unless the measurement harness enables performance marks, so the
	 * ordinary build pays one branch and no rAF. See `observeFirstRenderedFrame`
	 * for what the mark does and does not prove.
	 */
	import { useThrelte } from '@threlte/core';
	import { onDestroy } from 'svelte';
	import { perfMark, perfMarksEnabled } from '$lib/platform/perf-marks';
	import { observeFirstRenderedFrame, type FirstRenderedFrameObserver } from './first-frame';

	let { runEpoch = 0, active = true }: { runEpoch?: number; active?: boolean } = $props();

	const { renderer } = useThrelte();
	let observer: FirstRenderedFrameObserver | null = null;

	$effect(() => {
		void runEpoch;
		if (!active || !perfMarksEnabled()) {
			observer?.cancel();
			observer = null;
			return;
		}
		observer = observeFirstRenderedFrame({
			source: renderer,
			onFrame: (renderFrame) => perfMark('visitor:first-frame', { runEpoch, renderFrame }),
			requestFrame: (callback) => requestAnimationFrame(callback),
			cancelFrame: (handle) => cancelAnimationFrame(handle)
		});
		return () => {
			observer?.cancel();
			observer = null;
		};
	});

	onDestroy(() => observer?.cancel());
</script>
