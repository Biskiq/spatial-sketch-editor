<script lang="ts">
	import type { Object3D } from 'three';

	let { is }: { is: Object3D } = $props();

	// Mounted Stage tests need the real Three graph without WebGL. Threlte's T
	// normally attaches this object to its scene; the probe only hands it back.
	$effect(() => {
		(globalThis as { __stageDevelopmentRoot?: Object3D }).__stageDevelopmentRoot = is;
	});
</script>
