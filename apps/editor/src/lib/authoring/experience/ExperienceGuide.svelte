<script module lang="ts">
	/** Each mounted Guide takes its own id, so the hidden reason references never collide. */
	let instances = 0;
</script>

<script lang="ts">
	/**
	 * The Guide instrument: the Experience's Stops as cards with their connectors,
	 * the header (name, + Stop, compact, close) and the Stop-order bar. It sits in
	 * the lower column above the dock, in the shared forest material.
	 *
	 * It holds no Experience state. Every read goes through the controller and every
	 * write through a controller command; selecting goes through the homes' one
	 * `select`, which never moves the Camera. Only the compact choice is local here.
	 */
	import ExperienceGuideHeader from './ExperienceGuideHeader.svelte';
	import ExperienceGuideCards from './ExperienceGuideCards.svelte';
	import { experienceHomes } from './experience-homes';
	import type { ExperiencePlayback } from './playback.svelte';

	let {
		onClose,
		playback
	}: {
		onClose: () => void;
		/** The Stage-owned ephemeral playback host: this panel only reads and commands it. */
		playback: ExperiencePlayback;
	} = $props();

	instances += 1;
	const instanceId = `experience-guide-${instances}`;
	const followReasonId = `${instanceId}-follow-reason`;
	const playReasonId = `${instanceId}-play-reason`;
	const addReasonId = `${instanceId}-add-reason`;

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const current = $derived(controller?.current ?? null);
	const presentations = $derived(current?.presentations ?? []);
	const busy = $derived(controller?.busy ?? false);
	const addReason = $derived.by((): string | null => {
		if (busy) return 'Saving the last change';
		if (presentations.length === 0) return 'Add a Presentation first';
		return null;
	});
	let compact = $state(false);
</script>

{#if controller === null}
	<p class="status" role="status">The Experience lens mounts with the admitted project source.</p>
{:else if current === null}
	<p class="status">Create an Experience in the Index before composing its Guide.</p>
{:else}
	<div class="guide" role="group" aria-label="Guide" data-experience-guide>
		<ExperienceGuideHeader
			{playback}
			{onClose}
			bind:compact
			{addReason}
			{addReasonId}
			{followReasonId}
			{playReasonId}
		/>
		<ExperienceGuideCards {playback} {compact} />
	</div>
{/if}

<style>
	.status {
		margin: 0;
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-utility);
	}
	.guide {
		position: relative;
		display: flex;
		flex-direction: column;
		/* Round 2: a fixed 820 px instrument, whatever the number of Stops; the Card stops above it. */
		width: min(820px, 100%);
		border-radius: 12px;
		/* The Guide's own forest tiers: an authored instrument look, not a skin surface. */
		--guide-tier-1: #16352a;
		--guide-tier-2: #1d4033;
		--guide-tier-3: #234b3a;
		--guide-chip: #1a3a2d;
		--guide-chip-line: #3c5e4f;
		--guide-chip-hover: #25483a;
		background: var(--shell-forest);
		color: var(--shell-ink-light);
		box-shadow: 0 12px 30px rgb(0 0 0 / 0.28);
	}
</style>
