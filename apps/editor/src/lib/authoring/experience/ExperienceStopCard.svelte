<script lang="ts">
	import ExperienceSnapshot from './ExperienceSnapshot.svelte';
	import type { GuideCardFacts } from './experience-guide-card-model';

	let {
		card,
		selected,
		dragging,
		tabindex,
		transform,
		progress,
		playhead,
		onpointerdown,
		onclick,
		onkeydown,
		onfocus
	}: {
		card: GuideCardFacts;
		selected: boolean;
		dragging: boolean;
		tabindex: number;
		transform: string | undefined;
		progress: number;
		playhead: number | null;
		onpointerdown: (event: PointerEvent) => void;
		onclick: () => void;
		onkeydown: (event: KeyboardEvent) => void;
		onfocus: () => void;
	} = $props();
</script>
<button
	type="button"
	class="stop-card"
	class:selected
	class:dragging
	data-stop-id={card.stopId}
	data-track-id={`hold:${card.stopId}`}
	aria-pressed={selected}
	aria-label={card.name}
	{tabindex}
	style:transform={transform}
	{onpointerdown}
	{onclick}
	{onkeydown}
	{onfocus}
>
	<ExperienceSnapshot label={card.label} viewId={card.viewId} number={card.number} ratio="stop" />
	<span class="stop-text">
		<span class="stop-name" title={card.label}>{card.label}</span>
		<span class="stop-meta">
			{#if card.invites}<span class="badge invite" title="Invites exploring" data-invite-badge>✦</span>{/if}
			{#if card.more > 0}<span class="badge more" title={`${card.more} more ${card.more === 1 ? 'View' : 'Views'} to explore`}>+{card.more}</span>{/if}
		</span>
	</span>
	<!-- Review round 3 (sheet §25): each Stop card carries its own part of the timeline. -->
	<span class="stop-progress" data-view-span={card.viewId ?? undefined} aria-hidden="true"
		><i style:width={`${progress}%`}></i>{#if playhead !== null}<b class="knob" style:left={`${playhead}%`}></b>{/if}</span
	>
</button>
<style>
	.badge {
		margin-left: 4px;
		color: var(--shell-ink-3);
		font-size: var(--shell-text-meta);
		font-weight: 600;
	}
	.badge.invite {
		color: var(--shell-leaf-soft);
	}
	.stop-card {
		position: relative;
		flex: none;
		display: grid;
		grid-template-columns: 62px minmax(0, 1fr);
		align-items: center;
		gap: 8px;
		width: 176px;
		min-height: 50px;
		padding: 5px 5px 7px;
		border: 2px solid transparent;
		border-radius: 8px;
		background: var(--guide-tier-1);
		color: var(--shell-ink-light);
		font: inherit;
		text-align: left;
		cursor: pointer;
		user-select: none;
	}
	.stop-card:hover {
		background: var(--guide-tier-2);
	}
	.stop-card.selected {
		border-color: var(--shell-gold);
		background: var(--guide-tier-3);
	}
	.stop-card.dragging {
		position: relative;
		z-index: 2;
		cursor: grabbing;
		opacity: 0.92;
		box-shadow: 0 8px 20px rgb(0 0 0 / 0.35);
	}
	.stop-card :global(.snapshot.stop) {
		width: 62px;
		height: 40px;
	}
	.stop-text {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.stop-name {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font: var(--shell-text-body)/1.2 var(--shell-sans);
	}
	.stop-meta {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		line-height: 1.35;
		color: var(--shell-ink-quiet);
		font-size: 10.5px;
		font-variant-numeric: tabular-nums;
	}
	.stop-progress {
		position: absolute;
		left: 6px;
		right: 6px;
		bottom: 3px;
		height: 3px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--shell-ink-light) 14%, transparent);
		pointer-events: none;
	}
	.stop-progress i {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		border-radius: inherit;
		background: var(--shell-gold);
	}
	.knob {
		position: absolute;
		top: 50%;
		z-index: 1;
		width: 10px;
		height: 10px;
		margin: -5px 0 0 -5px;
		border: 2px solid var(--shell-forest);
		border-radius: 50%;
		background: var(--shell-gold);
	}
	.knob::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 6px;
		width: 2px;
		height: 12px;
		margin-left: -1px;
		border-radius: 1px;
		background: var(--shell-gold);
	}
</style>
