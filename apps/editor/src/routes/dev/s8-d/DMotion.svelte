<script lang="ts">
	import { onMount } from 'svelte';
	import { useThrelte } from '@threlte/core';

	let { onSample }: { onSample: (intervals: readonly number[]) => void } = $props();
	const { camera } = useThrelte();

	onMount(() => {
		const origin = camera.current.position.clone();
		const intervals: number[] = [];
		let last = performance.now();
		let frame = 0;
		// Two seconds of a slow orbit: enough frames for a p95 without leaving
		// the fixed comparison pose changed.
		const tick = (now: number): void => {
			intervals.push(now - last);
			last = now;
			frame += 1;
			const angle = (frame / 120) * 0.35;
			camera.current.position.set(Math.sin(angle) * 4.6, 1.1, Math.cos(angle) * 4.6);
			camera.current.lookAt(0, 0.9, 0);
			if (frame < 120) {
				requestAnimationFrame(tick);
				return;
			}
			camera.current.position.copy(origin);
			camera.current.lookAt(0, 0.9, 0);
			onSample(intervals);
		};
		requestAnimationFrame(tick);
	});
</script>
