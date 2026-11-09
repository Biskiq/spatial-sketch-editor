<script lang="ts">
	/**
	 * C3/D12 — the Card's unfold controls, in the Card's existing vocabulary.
	 *
	 * One 0–100 % scrubber drives the single partial-unfold parameter. It moves
	 * only the sheet: no camera request, no history entry. Flat/Half are the
	 * declared magnetic stops; Done refolds and returns the entry camera. Every
	 * control is a native button or range input, so the whole context is
	 * keyboard reachable without a toolbar or a global mode.
	 */
	import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
	import { snapWallUnfoldAmount, WALL_UNFOLD_DRAG_CSS } from '$lib/layout/wall-unfold';
	import type { CompiledPhysicalWall } from '@portfolio/layout-core';

	let { wall }: { wall: CompiledPhysicalWall } = $props();
	const state = $derived(wallUnfold.state?.wallId === wall.wallId ? wallUnfold.state : null);
	const percent = $derived(state === null ? 0 : Math.round(state.u * 100));
	const flat = $derived(percent === 100);
	const flipLabel = $derived(state?.side === 1 ? 'Flip to Outside' : 'Flip to Inside');

	function scrub(event: Event): void {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		wallUnfold.setU(wall, value / 100);
	}

	// S6 — a camera-free peel affordance. The Card's range remains the accessible
	// path; this drag uses the same 260 px full-open mapping and magnetic stops.
	let peelStartY = 0;
	let peelStartU = 0;
	let peeling = false;
	function peelDown(event: PointerEvent): void {
		if (state === null) return;
		peeling = true;
		peelStartY = event.clientY;
		peelStartU = state.u;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		event.preventDefault();
	}
	function peelMove(event: PointerEvent): void {
		if (!peeling || state === null) return;
		const amount = peelStartU + (peelStartY - event.clientY) / WALL_UNFOLD_DRAG_CSS;
		wallUnfold.setU(wall, Math.min(1, Math.max(0, amount)));
	}
	function peelUp(event: PointerEvent): void {
		if (!peeling || state === null) return;
		peeling = false;
		wallUnfold.setU(wall, snapWallUnfoldAmount(state.u));
		(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
	}
</script>

{#if state !== null}
	<div class="unfold" data-wall-unfold data-wall-unfold-u={percent}>
		<label class="scrub">
			<span>Unfold</span>
			<input
				type="range"
				min="0"
				max="100"
				step="1"
				value={percent}
				aria-label="Unfold amount"
				aria-valuetext={flat ? 'Flat, 100 percent unfolded' : `${percent} percent unfolded`}
				data-wall-unfold-scrub
				oninput={scrub}
			/>
			<output>{flat ? 'Flat' : `${percent}%`}</output>
		</label>
		<p class="hint">Entry keeps orientation; the sheet may pan, fit or zoom. Openings edit in place.</p>
		<button
			type="button"
			class="peel"
			data-wall-unfold-peel
			aria-label="Peel the unfolded Wall; drag up to open, down to fold"
			onpointerdown={peelDown}
			onpointermove={peelMove}
			onpointerup={peelUp}
			onpointercancel={peelUp}
		>
			<span aria-hidden="true">⌃</span> Peel
		</button>
		<div class="stops">
			<button type="button" data-wall-unfold-flat onclick={() => wallUnfold.setU(wall, 1)}>Flat</button>
			<button type="button" data-wall-unfold-half onclick={() => wallUnfold.setU(wall, 0.5)}>Half</button>
			<button type="button" data-wall-unfold-flip onclick={() => wallUnfold.flip(wall)}>{flipLabel}</button>
			<button type="button" data-wall-unfold-done onclick={() => wallUnfold.exit(wall)}>Done</button>
		</div>
	</div>
{/if}

<style>
	.unfold {
		display: grid;
		gap: 4px;
		padding: 6px 12px 8px;
		border-top: 1px solid var(--shell-hairline);
	}
	.scrub {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 8px;
		color: var(--shell-ink-2);
		font-size: 10.5px;
	}
	.scrub input {
		width: 100%;
		accent-color: var(--shell-leaf);
	}
	.scrub output {
		min-width: 30px;
		text-align: right;
		color: var(--shell-ink);
		font: 12px var(--shell-mono);
		font-variant-numeric: tabular-nums;
	}
	.hint {
		margin: 0;
		color: var(--shell-ink-2);
		font-size: 10px;
		line-height: 1.35;
	}
	.peel {
		height: 28px;
		border: 1px dashed var(--shell-field-line-strong);
		border-radius: 6px;
		background: var(--shell-field);
		color: inherit;
		font: inherit;
		font-size: 11px;
		cursor: ns-resize;
		touch-action: none;
	}
	.peel:active {
		border-color: var(--shell-leaf);
	}
	@media (pointer: coarse) {
		.peel {
			min-height: 44px;
		}
	}
	.stops {
		display: flex;
		gap: 4px;
	}
	.stops button {
		min-height: 24px;
		padding: 0 7px;
		border: 1px solid var(--shell-field-line);
		border-radius: 6px;
		background: var(--shell-field);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.stops button:hover {
		border-color: var(--shell-field-line-strong);
	}
	@media (pointer: coarse) {
		.stops button {
			min-height: 44px;
		}
	}
</style>
