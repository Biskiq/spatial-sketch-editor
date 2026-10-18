<script lang="ts">
	/**
	 * T1.P01.S04 — Place → Layout plinth.
	 *
	 * Typed working-plane X/Z plus the selected floor datum. The controller
	 * captures the new object id before evaluation; the retained preset planner
	 * must agree with it, so a failed placement creates no object and no history.
	 *
	 * Typing X/Z takes the host gesture lease (a value about to be placed must not
	 * be moved out from under by Undo); Place and Esc end it, and unmount is the
	 * last release path.
	 */
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { createPlacementInstrument } from './adapter-support';

	let { services }: { services: StageAdapterServices } = $props();

	let x = $state('0');
	let z = $state('0');
	let error = $state<string | null>(null);
	let busy = $state(false);

	const instrument = $derived.by(() => createPlacementInstrument(services));

	// Unmount is the last cancel path: a typed placement's host gesture lease must
	// be released exactly once, and leaving never places anything.
	$effect(() => {
		const current = instrument;
		return () => current?.dispose();
	});

	function setX(value: string): void {
		x = value;
		instrument.setPlacement(x, z);
	}

	function setZ(value: string): void {
		z = value;
		instrument.setPlacement(x, z);
	}

	async function place(): Promise<void> {
		if (instrument === null || busy) return;
		busy = true;
		error = null;
		instrument.setPlacement(x, z);
		const outcome = await instrument.place();
		if (outcome.kind === 'invalid' || outcome.kind === 'refused') error = outcome.message;
		busy = false;
	}

	function onKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		error = null;
		instrument?.cancelPlacement();
	}
</script>

<div class="placement" data-layout-placement>
	<p class="hint">Place a plinth at working-plane X/Z on the current floor datum.</p>
	<div class="fields">
		<label>
			<span>X</span>
			<input
				type="text"
				inputmode="decimal"
				value={x}
				oninput={(event) => setX(event.currentTarget.value)}
				onkeydown={onKeydown}
			/>
		</label>
		<label>
			<span>Z</span>
			<input
				type="text"
				inputmode="decimal"
				value={z}
				oninput={(event) => setZ(event.currentTarget.value)}
				onkeydown={onKeydown}
			/>
		</label>
	</div>
	<button type="button" disabled={busy} onclick={() => void place()}>Place plinth</button>
	{#if error !== null}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
	.placement {
		display: grid;
		gap: 0.35rem;
		font-size: 0.8rem;
	}
	.hint {
		margin: 0;
		font-size: 0.7rem;
		color: var(--head-ink-quiet, #98a89c);
	}
	.fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
	}
	label {
		display: grid;
		grid-template-columns: 1.2rem 1fr;
		align-items: center;
		gap: 0.3rem;
	}
	input {
		min-height: 1.8rem;
		padding: 0.1rem 0.35rem;
		border: 1px solid var(--chassis-hairline, #2f4a3d);
		border-radius: 0.25rem;
		background: transparent;
		color: inherit;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
	button {
		justify-self: start;
		min-height: 1.8rem;
		padding: 0.15rem 0.6rem;
		border: 1px solid var(--chassis-hairline, #2f4a3d);
		border-radius: 0.25rem;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.error {
		margin: 0;
		font-size: 0.7rem;
		color: #c2694f;
	}
</style>
