<script lang="ts">
	/**
	 * E9/R2c — attach one store-owned material to the parent mesh.
	 *
	 * The environment ground, the Preview's paper ground and the ground plinth are
	 * single world surfaces with fixed looks. They acquire from the Canvas
	 * `MaterialStore` by descriptor like every other world surface; this component
	 * is the lease holder, not a factory.
	 *
	 * The lease lives in a plain variable and the template reads a published copy,
	 * so publishing never re-runs the acquiring effect. `dispose={false}` keeps the
	 * shared instance out of Threlte's disposal: the store is the only disposal
	 * authority.
	 */
	import { onDestroy, untrack } from 'svelte';
	import { T } from '@threlte/core';
	import { useRenderResources } from './render-resources';
	import { materialKey, type MaterialDescriptor } from './material-descriptor';

	let { descriptor }: { descriptor: MaterialDescriptor } = $props();

	const resources = useRenderResources();
	const key = $derived(materialKey(descriptor));
	// Acquired at initialisation, so the mesh never draws a frame without its look.
	let lease = $state.raw(resources.materials.acquire(untrack(() => descriptor)));
	$effect(() => {
		const wanted = key;
		const held = untrack(() => lease);
		if (held.key === wanted) return;
		// Take the new claim before giving the old one back.
		lease = resources.materials.acquire(untrack(() => descriptor));
		held.release();
	});
	onDestroy(() => untrack(() => lease).release());
</script>

<T is={lease.material} dispose={false} />
