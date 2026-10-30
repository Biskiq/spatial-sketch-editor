<script lang="ts">
	/**
	 * PLATE **bottom dock** (Production shell Round 2, D2/D8; R217.S10, D3).
	 *
	 * The dock is the one home for armable tools, in the owner-ruled order
	 * **Select · Ink · Measure · Eraser | Library**. Select, Measure and Eraser are
	 * the host's own keys; Ink and Library are adapter contributions that fill their
	 * slot with `home: 'dock'`. A key is icon-first (20 px, white on the forest
	 * dock) with a tooltip naming it and its key; the armed key is ivory with a dark
	 * icon. Pressing the armed key again collapses or re-opens its palette, and a
	 * faint caret marks a collapsed one. Arming never changes the selection.
	 *
	 * It renders no empty slot: a family this phase does not implement (Slice,
	 * Brush) is absent, because an inert key would be a promise the domain cannot
	 * keep.
	 */
	import type { StageDockKey } from '../stage-contributions';

	let {
		keys,
		armedId,
		paletteOpen = false,
		onPress
	}: {
		keys: readonly StageDockKey[];
		/** The armed key's id; Select's id when no tool is armed. */
		armedId: string;
		paletteOpen?: boolean;
		/** One press: arm a key, or fold/unfold the armed key's palette. */
		onPress: (key: StageDockKey) => void;
	} = $props();

	const tooltip = (key: StageDockKey) => (key.shortcut === null ? key.label : `${key.label} (${key.shortcut})`);
</script>

<nav class="dock" data-stage-dock aria-label="Tools">
	{#each keys as key (`${key.adapterId}:${key.id}`)}
		{@const armed = key.id === armedId}
		{#if key.separated}<span class="separator" aria-hidden="true"></span>{/if}
		<button
			type="button"
			class="key"
			class:armed
			aria-pressed={armed}
			aria-label={key.label}
			aria-keyshortcuts={key.shortcut ?? undefined}
			title={tooltip(key)}
			data-dock-tool={key.id}
			data-dock-slot={key.slot ?? 'tool'}
			data-dock-select={key.slot === 'select' ? '' : undefined}
			onclick={() => onPress(key)}
		>
			<svg class="icon" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
				{#if key.slot === 'select'}
					<path d="M5 3 L5 16 L8.6 12.6 L11 17.5 L13 16.6 L10.7 11.8 L15.5 11.5 Z" />
				{:else if key.slot === 'ink'}
					<path d="M13.5 3.5 L16.5 6.5 L7.5 15.5 L3.5 16.5 L4.5 12.5 Z" />
					<path d="M11.8 5.2 L14.8 8.2" />
				{:else if key.slot === 'measure'}
					<path d="M3 7 L17 7 L17 13 L3 13 Z" />
					<path d="M6 7 V10 M9 7 V11 M12 7 V10 M15 7 V11" />
				{:else if key.slot === 'erase'}
					<path d="M8 16.5 L3.5 12 L11 4.5 L16.5 10 L10 16.5 Z" />
					<path d="M6.3 9.2 L11.8 14.7 M8 16.5 H16.5" />
				{:else if key.slot === 'library'}
					<path d="M3.5 4 H7 V16 H3.5 Z M8.5 4 H12 V16 H8.5 Z" />
					<path d="M13 5.2 L16 4.4 L18 15.4 L15 16.2 Z" />
				{:else}
					<text x="10" y="14" text-anchor="middle">{key.label.slice(0, 1)}</text>
				{/if}
			</svg>
			{#if armed && key.palette && !paletteOpen}
				<span class="caret" data-dock-caret aria-hidden="true"></span>
			{/if}
		</button>
	{/each}
</nav>

<style>
	.dock {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.4rem;
		border: 1px solid #2c4437;
		border-radius: 0.6rem;
		background: rgb(17 41 31 / 96%);
		box-shadow: 0 0.5rem 1.5rem rgb(6 20 14 / 45%);
		color: #f4f0e9;
	}
	.key {
		position: relative;
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		padding: 0;
		border: 1px solid transparent;
		border-radius: 0.45rem;
		background: transparent;
		color: #f4f0e9;
		cursor: pointer;
	}
	.key:hover {
		border-color: #6d8f7b;
	}
	.key[aria-pressed='true'] {
		border-color: #f3f0e4;
		background: #f3f0e4;
		color: #14231b;
	}
	/* Tool colour is only ever a 2 px mark, never a fill. */
	.key[aria-pressed='true']::after {
		content: '';
		position: absolute;
		left: 25%;
		right: 25%;
		bottom: 2px;
		height: 2px;
		border-radius: 1px;
		background: #2f6f4f;
	}
	.key[aria-pressed='true'][data-dock-slot='erase']::after {
		background: #d0412d;
	}
	.key:focus-visible {
		outline: 2px solid #9fd0b4;
		outline-offset: 2px;
	}
	.icon {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.icon text {
		fill: currentColor;
		stroke: none;
		font: 600 11px/1 ui-sans-serif, system-ui, sans-serif;
	}
	.caret {
		position: absolute;
		top: 2px;
		left: 50%;
		width: 0;
		height: 0;
		margin-left: -3px;
		border-left: 3px solid transparent;
		border-right: 3px solid transparent;
		border-bottom: 3px solid rgb(20 35 27 / 45%);
	}
	.separator {
		width: 1px;
		height: 1.5rem;
		margin: 0 0.15rem;
		background: #405d4c;
	}
	@media (pointer: coarse) {
		.key {
			width: 44px;
			height: 44px;
		}
	}
</style>
