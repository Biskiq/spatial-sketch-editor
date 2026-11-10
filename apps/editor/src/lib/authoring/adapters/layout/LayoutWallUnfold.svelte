<script lang="ts">
	/**
	 * The Wall Card's one Unroll row.
	 *
	 * The amount is the only value the Card owns while the Wall is unrolled;
	 * the reading name, face switch and Put back live in the Stage pill, which
	 * survives an Opening selection. Half and Flat are the range's stops, not
	 * extra controls. The native range is the whole keyboard path.
	 */
	import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
	import { snapWallUnfoldAmount } from '$lib/layout/wall-unfold';
	import type { CompiledPhysicalWall } from '@portfolio/layout-core';

	let { wall }: { wall: CompiledPhysicalWall } = $props();
	const state = $derived(wallUnfold.state?.wallId === wall.wallId ? wallUnfold.state : null);
	const percent = $derived(state === null ? 0 : Math.round(state.u * 100));
	const flat = $derived(percent === 100);

	function scrub(event: Event): void {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		wallUnfold.setU(wall, value / 100);
	}

	function release(): void {
		if (state === null) return;
		wallUnfold.setU(wall, snapWallUnfoldAmount(state.u));
	}
</script>

{#if state !== null}
	<div class="unroll" data-wall-unroll data-wall-unroll-u={percent}>
		<label class="row">
			<span class="name">Unroll</span>
			<input
				type="range"
				min="0"
				max="100"
				step="1"
				value={percent}
				aria-label="Unroll amount"
				aria-valuetext={flat ? 'Flat, 100 percent unrolled' : `${percent} percent unrolled`}
				data-wall-unroll-scrub
				oninput={scrub}
				onchange={release}
			/>
			<output data-wall-unroll-value>{flat ? 'Flat' : `${percent}%`}</output>
		</label>
		<div class="stops" aria-hidden="true">
			<span></span>
			<span>Half</span>
			<span>Flat</span>
		</div>
	</div>
{/if}

<style>
	.unroll {
		display: grid;
		gap: 3px;
		padding: 4px 12px 8px;
		border-top: 1px solid var(--shell-hairline);
	}
	.row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 9px;
		color: var(--shell-ink-2);
		font-size: 10.5px;
	}
	.name {
		color: var(--shell-ink);
	}
	input {
		width: 100%;
		accent-color: var(--shell-leaf);
	}
	output {
		min-width: 38px;
		text-align: right;
		color: var(--shell-ink);
		font: 12px var(--shell-mono);
		font-variant-numeric: tabular-nums;
	}
	.stops {
		display: grid;
		grid-template-columns: auto 1fr 1fr;
		gap: 9px;
		padding-left: 44px;
		padding-right: 47px;
		color: var(--shell-ink-3);
		font: 10px var(--shell-mono);
		letter-spacing: 0.03em;
	}
	.stops span:nth-child(2) {
		text-align: center;
	}
	.stops span:nth-child(3) {
		text-align: right;
	}
	@media (pointer: coarse) {
		input {
			min-height: 44px;
		}
	}
</style>
