<script lang="ts">
	/**
	 * The one small child in the PR 1 Canvas comparison.
	 *
	 * It uses Threlte's own context, so mounting it is proof that the candidate
	 * supplied a working renderer/camera/task context. It mutates nothing: the
	 * probe's callbacks are observations and its `session` is the caller-owned
	 * object that must survive a renderer remount unchanged.
	 */
	import { useTask } from '@threlte/core';
	import { untrack } from 'svelte';
	import type { HostProbe } from './host-types';

	let { probe }: { probe: HostProbe | null } = $props();

	useTask(() => {
		probe?.onFrame?.();
	});

	$effect(() => {
		const current = probe;
		untrack(() => current?.onMount?.());
	});
</script>

<span hidden data-harness-probe></span>
