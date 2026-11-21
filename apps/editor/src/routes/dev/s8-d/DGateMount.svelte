<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { useThrelte } from '@threlte/core';
	import type { Object3D } from 'three';

	let { object }: { object: Object3D } = $props();
	const { scene } = useThrelte();

	onMount(() => {
		scene.add(object);
	});
	onDestroy(() => {
		scene.remove(object);
	});
</script>
