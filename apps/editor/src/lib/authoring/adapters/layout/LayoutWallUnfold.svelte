<script lang="ts">
	/**
	 * The Wall Card's Unroll session block.
	 *
	 * The Stage sheet stays directly draggable; this is the fine adjustment and
	 * the session control. The reading name, face switch, amount, exact entry and
	 * Put back live here so no floating pill competes with the Stage. Half and
	 * Flat remain the range's stops, not extra controls.
	 */
	import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
	import { snapWallUnfoldAmount } from '$lib/layout/wall-unfold';
	import type { CompiledPhysicalWall } from '@portfolio/layout-core';

	let {
		wall,
		wallName = null,
		roomName = null,
		contextual = false
	}: {
		wall: CompiledPhysicalWall;
		wallName?: string | null;
		roomName?: string | null;
		contextual?: boolean;
	} = $props();
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

	/** The exact field commits on change/Enter, so typing does not fight the range. */
	function setExact(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const value = Number(input.value);
		if (!Number.isFinite(value)) {
			input.value = String(percent);
			return;
		}
		const clamped = Math.max(0, Math.min(100, value));
		wallUnfold.setU(wall, clamped / 100);
		input.value = String(Math.round(clamped));
	}

	function face(next: 1 | -1): void {
		if (state === null || state.side === next) return;
		wallUnfold.flip(wall);
	}
</script>

{#if state !== null}
	<div
		class="unroll"
		class:contextual
		data-wall-unroll
		data-wall-unroll-u={percent}
	>
		<div class="session">
			<div class="reading" title={roomName === null ? undefined : `${wallName ?? 'Wall'} · ${roomName}`}>
				<span class="state">Unrolled</span>
				<span class="wall-name">{wallName ?? 'Wall'}</span>
				{#if roomName}<span class="room">{roomName}</span>{/if}
			</div>
			<button type="button" class="put" data-wall-unroll-put-back onclick={() => wallUnfold.exit(wall)}>
				Put back
			</button>
		</div>
		<div class="face-row">
			<span class="face-label">Face</span>
			<div class="faces" role="group" aria-label="Sheet face">
				<button
					type="button"
					aria-pressed={state.side === 1}
					data-wall-unroll-face="inside"
					onclick={() => face(1)}
				>Inside</button>
				<button
					type="button"
					aria-pressed={state.side === -1}
					data-wall-unroll-face="outside"
					onclick={() => face(-1)}
				>Outside</button>
			</div>
			<label class="amount">
				<span class="sr-only">Exact unroll amount</span>
				<input
					type="number"
					min="0"
					max="100"
					step="1"
					value={percent}
					data-wall-unroll-number
					onchange={setExact}
				/>
				<span class="unit">%</span>
			</label>
		</div>
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
		gap: 5px;
		padding: 6px 12px 9px;
		border-top: 1px solid var(--shell-hairline);
	}
	.unroll.contextual {
		padding-top: 7px;
	}
	.session {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.reading {
		display: flex;
		align-items: baseline;
		gap: 5px;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
	}
	.state {
		color: var(--shell-gold);
		font: 500 9.5px var(--shell-mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.wall-name {
		overflow: hidden;
		color: var(--shell-ink);
		font-size: 11.5px;
		text-overflow: ellipsis;
	}
	.room {
		overflow: hidden;
		color: var(--shell-ink-3);
		font-size: 10.5px;
		text-overflow: ellipsis;
	}
	.put {
		margin-left: auto;
		min-height: 24px;
		padding: 2px 9px;
		border: 1px solid var(--shell-gold);
		border-radius: 6px;
		background: transparent;
		color: var(--shell-gold);
		font: 600 10.5px var(--shell-sans);
		cursor: pointer;
	}
	.put:hover {
		background: var(--shell-gold);
		color: #241d0b;
	}
	.face-row {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.face-label {
		color: var(--shell-ink-3);
		font-size: 10px;
	}
	.faces {
		display: flex;
		padding: 2px;
		border-radius: 99px;
		background: var(--shell-field);
	}
	.faces button {
		min-height: 22px;
		padding: 1px 8px;
		border: 0;
		border-radius: 99px;
		background: transparent;
		color: var(--shell-ink-2);
		font: 10.5px var(--shell-sans);
		cursor: pointer;
	}
	.faces button[aria-pressed='true'] {
		background: var(--shell-ink);
		color: var(--shell-field);
	}
	.amount {
		display: flex;
		align-items: center;
		gap: 2px;
		margin-left: auto;
		color: var(--shell-ink-2);
	}
	.amount input {
		box-sizing: border-box;
		width: 46px;
		height: 24px;
		padding: 0 2px 0 6px;
		border: 1px solid var(--shell-field-line);
		border-radius: 6px;
		background: var(--shell-field);
		color: var(--shell-ink);
		font: 11px var(--shell-mono);
		font-variant-numeric: tabular-nums;
	}
	.amount input:focus {
		border-color: var(--shell-leaf);
		outline: none;
	}
	.unit {
		font: 10px var(--shell-mono);
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
	.row input {
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
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	@media (pointer: coarse) {
		.put,
		.faces button,
		.amount input,
		.row input {
			min-height: 44px;
		}
	}
</style>
