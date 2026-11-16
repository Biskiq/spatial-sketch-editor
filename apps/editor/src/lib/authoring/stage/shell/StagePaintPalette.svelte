<script lang="ts">
	/**
	 * The armed Paint tool's palette: the active Finish, the session recents, the
	 * semantic dropper and the door to Library › Finishes. It floats above the
	 * lower column and owns no Finish state of its own.
	 */
	import type { FinishPaintPalette } from '$lib/authoring/look/finish-authoring.svelte';

	let {
		palette,
		onPick,
		onDropper,
		onCancel,
		onLibrary
	}: {
		palette: FinishPaintPalette;
		onPick: (key: string) => void;
		onDropper: () => void;
		onCancel: () => void;
		onLibrary: () => void;
	} = $props();
</script>

<div class="paint-palette" data-paint-palette aria-label="Paint">
	<span class="word">Paint</span>
	{#if palette.active !== null}
		<span class="active" title={palette.active.label}>
			<span class="swatch" style={`--swatch: ${palette.active.color}`} aria-hidden="true"></span>
			<span class="active-label">{palette.active.label}</span>
		</span>
	{:else}
		<span class="empty">No Finish chosen</span>
	{/if}
	<button type="button" data-paint-library onclick={onLibrary}>Finishes…</button>
	<button
		type="button"
		data-paint-dropper
		aria-pressed={palette.dropper}
		class:on={palette.dropper}
		title="Copy a Finish colour from an object"
		onclick={onDropper}
	>
		Pick
	</button>
	{#if palette.recents.length > 0}
		<span class="recents" role="group" aria-label="Recent Finishes">
			{#each palette.recents as recent (recent.key)}
				<button
					type="button"
					class="recent"
					style={`--swatch: ${recent.color}`}
					aria-label={`Paint with ${recent.label}`}
					title={recent.label}
					data-paint-recent={recent.key}
					onclick={() => onPick(recent.key)}
				></button>
			{/each}
		</span>
	{/if}
	<button type="button" class="done" data-paint-done onclick={onCancel}>Done</button>
</div>

<style>
	.paint-palette {
		position: absolute;
		left: 50%;
		bottom: calc(var(--lower-column-height, 0px) + 0.75rem);
		z-index: 13;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		max-width: min(42rem, calc(100% - 2rem));
		padding: 0.4rem 0.5rem;
		transform: translateX(-50%);
		border: 1px solid var(--shell-hairline);
		border-radius: 0.4rem;
		background: var(--shell-forest);
		color: var(--shell-ink-light);
		box-shadow: 0 0.6rem 1.4rem rgb(6 20 14 / 30%);
		font-family: var(--shell-sans);
		font-size: var(--shell-text-utility);
	}
	.word {
		color: var(--shell-leaf-soft);
		font-family: var(--shell-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.active {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		min-width: 0;
	}
	.active-label {
		overflow: hidden;
		max-width: 10rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.swatch {
		width: 0.95rem;
		height: 0.95rem;
		flex: none;
		border: 1px solid rgb(255 255 255 / 35%);
		border-radius: 0.2rem;
		background: var(--swatch);
	}
	.empty {
		color: var(--shell-ink-quiet);
	}
	button {
		min-height: var(--shell-control-height);
		padding: 0 0.5rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.25rem;
		background: transparent;
		color: inherit;
		font-size: var(--shell-text-utility);
	}
	button.on {
		border-color: var(--stage-selection);
		background: var(--stage-selection);
		color: var(--shell-forest);
	}
	.recents {
		display: flex;
		gap: 0.25rem;
	}
	.recent {
		width: 1.3rem;
		height: 1.3rem;
		min-height: 1.3rem;
		padding: 0;
		border: 1px solid rgb(255 255 255 / 35%);
		border-radius: 0.2rem;
		background: var(--swatch);
	}
	.done {
		margin-left: 0.2rem;
	}
</style>
