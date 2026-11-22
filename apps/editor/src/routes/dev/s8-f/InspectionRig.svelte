<script lang="ts">
	/**
	 * Mounts one of B's versioned inspection rigs into the hosted scene: studio
	 * (prefiltered environment, no punctual lights) or grazing (one low key and
	 * a dim ambient, no reflection map). F's catalogue evidence reuses exactly
	 * these constants, so this page never builds a light of its own.
	 */
	import { onDestroy } from 'svelte';
	import { useThrelte } from '@threlte/core';
	import type { WebGPURenderer } from 'three/webgpu';
	import {
		createInspectionLighting,
		type InspectionRig
	} from '$lib/render/materials/inspection-lighting';

	let { rig, renderer }: { rig: InspectionRig; renderer: WebGPURenderer | null } = $props();
	const { scene } = useThrelte();
	// The rig is fixed for the page's lifetime: a different rig is a new URL.
	// svelte-ignore state_referenced_locally
	const lighting = createInspectionLighting(rig);
	scene.add(lighting.group);

	$effect(() => {
		if (renderer === null) return;
		scene.environment = lighting.environment(renderer);
	});

	onDestroy(() => {
		scene.remove(lighting.group);
		scene.environment = null;
		lighting.dispose();
	});
</script>
