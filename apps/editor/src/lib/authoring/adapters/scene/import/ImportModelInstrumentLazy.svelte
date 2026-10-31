<script lang="ts">
	/**
	 * Import is an Objects procedure, not part of Stage boot.
	 *
	 * Its session, API client and worker client are loaded on the first open, so
	 * an editor who never imports a model does not download the procedure. The
	 * wrapper is the only module the adapter imports statically.
	 *
	 * The focus that invoked Import is captured here, before the chunk fetch,
	 * because the procedure restores it on close and the host may have moved
	 * focus by the time the chunk arrives.
	 */
	import type { StageAdapterServices } from '../../../stage/stage-adapter-host';

	let { services }: { services: StageAdapterServices } = $props();

	type Instrument = typeof import('./ImportModelInstrument.svelte')['default'];
	let Instrument = $state<Instrument | null>(null);
	let failed = $state(false);
	const invokingFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

	$effect(() => {
		let cancelled = false;
		void import('./ImportModelInstrument.svelte')
			.then((module) => {
				if (!cancelled) Instrument = module.default;
			})
			.catch(() => {
				if (!cancelled) failed = true;
			});
		return () => {
			cancelled = true;
		};
	});
</script>

{#if Instrument}
	<Instrument {services} {invokingFocus} />
{:else if failed}
	<p class="hint refusal" role="alert">
		The Import procedure could not load. Close this task and reopen Import to try again.
	</p>
{:else}
	<p role="status">Opening Import…</p>
{/if}

<style>
	.hint {
		font-size: 0.78rem;
	}
	.refusal {
		color: #d8a27e;
	}
</style>
