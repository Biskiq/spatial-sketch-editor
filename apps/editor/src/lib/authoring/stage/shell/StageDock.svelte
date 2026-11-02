<script lang="ts">
	/** Icon-first Dock with a palette mounted once above its own armed key. Unsupported keys disclose their reason. */
	import type { Snippet } from 'svelte';
	import ShellIcon from './ShellIcon.svelte';
	import type { StageDockKey } from '../stage-contributions';

	let {
		keys,
		armedId,
		paletteOpen = false,
		onPress,
		palette
	}: {
		keys: readonly StageDockKey[];
		/** The armed key's id; Select's id when no tool is armed. */
		armedId: string;
		paletteOpen?: boolean;
		/** One press: arm a key, or fold/unfold the armed key's palette. */
		onPress: (key: StageDockKey) => void;
		palette?: Snippet;
	} = $props();

	let unavailableKey = $state<string | null>(null);
	const tooltip = (key: StageDockKey) =>
		key.shortcut === null ? key.label : `${key.label} (${key.shortcut})`;
</script>

<nav class="dock" data-stage-dock aria-label="Tools">
	{#each keys as key (`${key.adapterId}:${key.id}`)}
		{@const armed = key.id === armedId}
		{#if key.separated}<span class="separator" aria-hidden="true"></span>{/if}
		<span class="key-slot">
			{#if armed && paletteOpen && key.slot === 'ink' && palette}<div class="palette-anchor">
					{@render palette()}
				</div>{/if}
			<button
				type="button"
				class="key"
				class:armed
				aria-pressed={armed}
				aria-disabled={!!key.unavailableReason}
				onfocus={() => {
					if (key.unavailableReason) unavailableKey = key.id;
				}}
				onblur={() => (unavailableKey = null)}
				aria-describedby={key.unavailableReason ? `dock-reason-${key.id}` : undefined}
				aria-label={key.label}
				aria-keyshortcuts={key.shortcut ?? undefined}
				title={key.unavailableReason ?? tooltip(key)}
				data-dock-tool={key.id}
				data-dock-slot={key.slot ?? 'tool'}
				data-dock-select={key.slot === 'select' ? '' : undefined}
				onclick={() => {
					if (!key.unavailableReason) onPress(key);
					else unavailableKey = unavailableKey === key.id ? null : key.id;
				}}
			>
				<ShellIcon
					name={key.icon ??
						(key.slot === 'library'
							? 'assets'
							: key.slot === 'erase'
								? 'eraser'
								: (key.slot ?? 'dot'))}
					size={key.slot === 'library' ? 19 : 18}
				/>
				{#if armed && key.palette && !paletteOpen}
					<span class="caret" data-dock-caret aria-hidden="true"></span>
				{/if}
			</button>
			{#if key.unavailableReason}<span
					class="unavailable-reason"
					hidden={unavailableKey !== key.id}
					id={`dock-reason-${key.id}`}>{key.unavailableReason}</span
				>{/if}
		</span>
	{/each}
</nav>

<style>
	.unavailable-reason {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 50%;
		transform: translateX(-50%);
		width: 180px;
		padding: 8px;
		border-radius: 8px;
		background: var(--shell-forest);
		color: var(--shell-ink-light);
		font-size: 12px;
		box-shadow: var(--shell-shadow);
	}
	.unavailable-reason[hidden] {
		display: none;
	}

	.dock {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 4px;
		border: 1px solid rgb(255 255 255 / 0.09);
		border-radius: 14px;
		background: rgba(17, 41, 31, 0.95);
		color: #e6ece6;
		box-shadow:
			inset 0 1px 0 rgb(255 255 255 / 0.05),
			0 10px 28px rgb(0 0 0 / 0.28);
		backdrop-filter: blur(8px);
	}
	.key-slot {
		position: relative;
		display: flex;
	}
	.key {
		position: relative;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
		border-radius: 10px;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}
	.key:hover {
		background: rgb(255 255 255 / 0.08);
	}
	.key.armed {
		background: var(--shell-ivory, #f3f0e4);
		color: var(--shell-forest, #11291f);
		box-shadow: 0 1px 3px #0004;
	}
	.key[aria-disabled='true'] {
		opacity: 0.35;
		cursor: default;
	}
	.key[data-dock-slot='ink']::after,
	.key[data-dock-slot='erase']::after,
	.key[data-dock-tool='unavailable-slice']::after,
	.key[data-dock-tool='unavailable-brush']::after {
		content: '';
		position: absolute;
		width: 14px;
		height: 2px;
		left: 13px;
		bottom: 3px;
		opacity: 0.9;
		background: var(--shell-ink, #1b201c);
	}
	.key[data-dock-slot='erase']::after {
		background: #d0412d;
	}
	.key[data-dock-tool='unavailable-slice']::after {
		background: #f2d000;
	}
	.key[data-dock-tool='unavailable-brush']::after {
		background: #c98b6b;
	}
	.caret {
		position: absolute;
		top: -12px;
		left: 50%;
		transform: translateX(-50%);
		width: 0;
		height: 0;
		border-left: 5px solid transparent;
		border-right: 5px solid transparent;
		border-bottom: 5px solid var(--shell-ivory, #f3f0e4);
		opacity: 0.55;
		pointer-events: none;
	}
	.key:hover .caret {
		opacity: 1;
	}
	.separator {
		width: 1px;
		height: 22px;
		margin: 0 4px;
		background: rgb(255 255 255 / 0.12);
	}
	.palette-anchor {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 50%;
		transform: translateX(-50%);
	}
	@media (pointer: coarse) {
		.key {
			width: 44px;
			height: 44px;
		}
		.key::after {
			left: 15px !important;
		}
	}
</style>
