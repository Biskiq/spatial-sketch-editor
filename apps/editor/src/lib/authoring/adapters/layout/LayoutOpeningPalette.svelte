<script lang="ts">
	/**
	 * T1.P02.S03 — the Opening reading's palette.
	 *
	 * Loaded on demand when the creator switches Ink from Wall to Opening, so the
	 * Stage's first load does not carry a family it is not using. It is a reader
	 * and caller of the adapter's published surface: the ghost, fit and refusal
	 * come from the canonical planner, and every command goes through the one
	 * controller. It never owns document state.
	 */
	import { onMount, untrack } from 'svelte';
	import { WALL_OPENING_DEFAULTS } from '@portfolio/layout-core';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { parseMeasureInput } from './precision';
	import { inkSurface, type InkOpeningSnapshot } from './ink';

	let {
		services: _services,
		opening
	}: { services: StageAdapterServices; opening: InkOpeningSnapshot | null } = $props();

	// A rebuilt palette (Wall reading and back) must show the adapter's remembered
	// options, not its own door defaults: pointer placement uses those options.
	function rememberedOptions(source: InkOpeningSnapshot | null) {
		const fallback = WALL_OPENING_DEFAULTS.door;
		return {
			kind: source?.kind ?? 'door',
			profile: source?.profile ?? 'rectangular',
			width: String(source?.width ?? fallback.width),
			height: String(source?.height ?? fallback.height),
			sill: String(source?.sillHeight ?? fallback.sillHeight)
		};
	}
	const initial = untrack(() => rememberedOptions(opening));
	let kind = $state<'door' | 'window'>(initial.kind);
	let profile = $state<'rectangular' | 'rounded' | 'pointed'>(initial.profile);
	let widthText = $state(initial.width);
	let heightText = $state(initial.height);
	let sillText = $state(initial.sill);
	let offsetText = $state('');
	let error = $state<string | null>(null);

	function reject(message: string): false {
		error = message;
		// Pointer placement must not fall back to the last valid measures while the
		// fields show invalid ones.
		inkSurface()?.controller.setOpeningOptions(null);
		return false;
	}

	/** Validate and remember the next Opening's kind and exact metrics. */
	function commitOptions(): boolean {
		const width = parseMeasureInput(widthText);
		if (!width.ok || !(width.value > 0)) {
			return reject(`Width: ${width.ok ? 'must be greater than zero.' : width.reason}`);
		}
		const height = parseMeasureInput(heightText);
		if (!height.ok || !(height.value > 0)) {
			return reject(`Height: ${height.ok ? 'must be greater than zero.' : height.reason}`);
		}
		const sill = parseMeasureInput(sillText);
		if (!sill.ok || sill.value < 0) {
			return reject(`Sill: ${sill.ok ? 'must be zero or greater.' : sill.reason}`);
		}
		error = null;
		inkSurface()?.controller.setOpeningOptions({
			kind,
			profile,
			width: width.value,
			height: height.value,
			sillHeight: sill.value
		});
		return true;
	}

	/** A new kind starts from its canonical defaults, not the previous kind's size. */
	function applyKind(): void {
		const defaults = WALL_OPENING_DEFAULTS[kind];
		widthText = String(defaults.width);
		heightText = String(defaults.height);
		sillText = String(defaults.sillHeight);
		commitOptions();
	}

	function placeByOffset(): void {
		if (!commitOptions()) return;
		inkSurface()?.controller.placeOpening(offsetText);
	}

	function chooseProfile(next: 'rectangular' | 'rounded' | 'pointed'): void {
		profile = next;
		commitOptions();
	}

	// A remount can follow an invalid draft being discarded; the displayed
	// (remembered) values are valid, so the adapter must agree before a pointer
	// press is refused against a stale invalid flag.
	onMount(() => {
		commitOptions();
	});
</script>

<div class="opening-palette" data-layout-opening-palette>
	<div class="options">
		<label>
			<span>Kind</span>
			<select data-opening-kind bind:value={kind} onchange={applyKind}>
				<option value="door">Door</option>
				<option value="window">Window</option>
			</select>
		</label>
		<div class="profiles" role="group" aria-label="Opening profile">
			<span class="profile-label">Profile</span>
			{#each ['rectangular', 'rounded', 'pointed'] as const as option}
				<button type="button" data-opening-profile={option} aria-pressed={profile === option} onclick={() => chooseProfile(option)}>
					{option === 'rectangular' ? 'Rectangular' : option === 'rounded' ? 'Rounded' : 'Pointed'}
				</button>
			{/each}
		</div>
		<label>
			<span>Width</span>
			<input type="text" inputmode="decimal" data-opening-width bind:value={widthText} onchange={commitOptions} />
			<span class="unit">m</span>
		</label>
		<label>
			<span>Height</span>
			<input type="text" inputmode="decimal" data-opening-height bind:value={heightText} onchange={commitOptions} />
			<span class="unit">m</span>
		</label>
		<label>
			<span>Sill</span>
			<input type="text" inputmode="decimal" data-opening-sill bind:value={sillText} onchange={commitOptions} />
			<span class="unit">m</span>
		</label>
	</div>
	{#if error !== null}<p class="error" role="alert">{error}</p>{/if}

	{#if opening?.refusal !== null && opening?.refusal !== undefined}
		<p class="refusal" role="alert" data-opening-refusal>{opening.refusal}</p>
	{/if}

	<p class="quiet">
		{opening?.selectedHostId ? 'Offset on selected Wall'
			: 'Select a Wall for exact offset'}</p>
	<form
		class="typed-offset"
		onsubmit={(event) => {
			event.preventDefault();
			placeByOffset();
		}}
	>
		<label>
			<span>Offset</span>
			<input
				type="text"
				inputmode="decimal"
				data-opening-offset
				placeholder="center"
				bind:value={offsetText}
				aria-label="Opening offset from the host Wall start"
			/>
		</label>
		<button type="submit" data-opening-place disabled={opening?.selectedHostId === null || opening?.selectedHostId === undefined}>
			Place by offset
		</button>
	</form>
	<p class="quiet">
		Click a Wall face to place at the pointer; a selected Wall (or an Opening’s host) wins a tie. Select a host to place by exact offset; leave Offset empty to center.
	</p>
</div>

<style>
	.opening-palette {
		display: grid;
		gap: 0.45rem;
	}
	.options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
	.profiles {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
	}
	.profile-label {
		margin-right: 0.2rem;
		color: var(--shell-ink-quiet, #9fb2a2);
		font-size: 0.68rem;
	}
	.profiles button {
		min-height: 1.7rem;
		padding: 0.1rem 0.4rem;
		border: 1px solid var(--shell-ink-quiet, #9fb2a2);
		border-radius: 0.3rem;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.67rem;
		cursor: pointer;
	}
	.profiles button[aria-pressed='true'] {
		background: rgb(243 240 228 / 0.14);
		box-shadow: inset 0 0 0 1px rgb(243 240 228 / 0.55);
	}
	.options label {
		display: grid;
		grid-template-columns: auto 4.5rem auto;
		align-items: center;
		gap: 0.35rem;
	}
	input,
	select {
		min-height: 1.9rem;
		padding: 0.1rem 0.35rem;
		border: 1px solid var(--shell-ink-quiet, #9fb2a2);
		border-radius: 0.3rem;
		background: var(--shell-forest, #11291f);
		color: inherit;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
	.unit,
	.quiet {
		color: var(--shell-ink-quiet, #9fb2a2);
		font-size: 0.68rem;
	}
	.refusal {
		margin: 0;
		padding: 0.3rem 0.4rem;
		border: 1px solid #a4583c;
		border-radius: 0.3rem;
		background: #3a2018;
		color: #f3d9cd;
	}
	.error {
		margin: 0;
		color: #f0a98c;
	}
	.typed-offset {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}
	.typed-offset label {
		display: grid;
		grid-template-columns: auto 4rem;
		align-items: center;
		gap: 0.3rem;
	}
	button {
		min-height: 2.25rem;
		padding: 0.15rem 0.55rem;
		border: 1px solid var(--shell-ink-quiet, #9fb2a2);
		border-radius: 0.35rem;
		background: var(--shell-forest-raised, #22503c);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}
	button:focus-visible,
	input:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--shell-gold, #d4ad45);
		outline-offset: 1px;
	}
</style>
