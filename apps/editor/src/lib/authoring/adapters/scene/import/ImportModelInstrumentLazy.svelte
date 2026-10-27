<script lang="ts">
	/**
	 * Import is a Library procedure, not part of Stage boot.
	 *
	 * Its session, API client and worker client are loaded on the first open, so
	 * an editor who never imports a model does not download the procedure. The
	 * wrapper is the only module the adapter imports statically.
	 */
	import type { StageAdapterServices } from '../../../stage/stage-adapter-host';

	let { services }: { services: StageAdapterServices } = $props();

	type Instrument = typeof import('./ImportModelInstrument.svelte')['default'];
	let Instrument = $state<Instrument | null>(null);

	$effect(() => {
		let cancelled = false;
		void import('./ImportModelInstrument.svelte').then((module) => {
			if (!cancelled) Instrument = module.default;
		});
		return () => {
			cancelled = true;
		};
	});
</script>

{#if Instrument}
	<Instrument {services} />
{:else}
	<p role="status">Opening Import…</p>
{/if}
