<script lang="ts">
	/**
	 * The Card's writer for a selected Stop (R217.S25): its entry View, hold, Continue to and
	 * Transition, with Save Stop and the Guide control. More holds the Stop's place in its
	 * Guide. The Stop's Travel gaps are reported in the Guide instrument, where its order
	 * is. It edits through the Experience controller and holds no state of its own.
	 */
	import type { Snippet } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { experienceHomes } from './experience-homes';

	let {
		footer,
		secondary,
		more
	}: {
		services?: StageAdapterServices;
		detailOpen?: boolean;
		footer?: Snippet;
		secondary?: Snippet<[Snippet?]>;
		more?: Snippet<[Snippet?]>;
	} = $props();

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const stop = $derived(controller?.selectedStop ?? null);
	const views = $derived(stop === null ? [] : controller?.viewsOf.get(stop.presentationId) ?? []);
	const drafts = $derived(controller?.drafts ?? null);
	const position = $derived(
		stop === null || controller === null ? 0 : controller.guideStops.findIndex((entry) => entry.id === stop.id) + 1
	);

	/** The Experience's Stops, labelled by their place, so a Continue-to target is named, not an identity. */
	const targets = $derived(
		(controller?.current?.stops ?? []).map((entry, index) => ({
			id: entry.id,
			label: `Stop ${index + 1}: ${controller?.presentationLabel(entry.presentationId) ?? ''}`
		}))
	);

	function setDraft<K extends 'stopEntryView' | 'stopHold' | 'stopTarget' | 'stopTransition'>(
		field: K,
		value: string
	): void {
		if (drafts === null) return;
		(drafts as Record<K, string>)[field] = value;
	}
</script>

{#if controller !== null && drafts !== null && stop !== null}
	<div class="writer" data-experience-writer="stop">
		<div class="primary">
			<label class="field">
				<span>Entry View</span>
				<select value={drafts.stopEntryView} onchange={(event) => setDraft('stopEntryView', event.currentTarget.value)}>
					<option value="">Presentation Default</option>
					{#each views as view (view.id)}<option value={view.id}>{view.label}</option>{/each}
				</select>
			</label>
			<label class="field">
				<span>Hold (seconds, blank for none)</span>
				<input inputmode="decimal" value={drafts.stopHold} oninput={(event) => setDraft('stopHold', event.currentTarget.value)} />
			</label>
			<label class="field">
				<span>Continue to</span>
				<select value={drafts.stopTarget} onchange={(event) => setDraft('stopTarget', event.currentTarget.value)}>
					<option value="sequence-next">Next in Guide</option>
					{#each targets as target (target.id)}
						{#if target.id !== stop.id}<option value={target.id}>{target.label}</option>{/if}
					{/each}
					<option value="end">End</option>
				</select>
			</label>
			<label class="field">
				<span>Transition</span>
				<select
					value={drafts.stopTransition}
					disabled={drafts.stopTarget === 'end'}
					onchange={(event) => setDraft('stopTransition', event.currentTarget.value)}
				>
					<option value="cut">Cut (no travel)</option>
					<option value="travel">Travel (supported connection only)</option>
				</select>
			</label>
			<div class="actions">
				<button type="button" onclick={() => void controller.saveStop()} disabled={controller.busy}>Save Stop</button>
				<button
					type="button"
					class="quiet"
					aria-expanded={homes.guideOpen()}
					onclick={() => homes.setGuideOpen(!homes.guideOpen())}
				>
					Guide
				</button>
			</div>
		</div>
		{#if footer}{@render footer()}{/if}
		{#snippet details()}
			<p class="readout"><span>Position:</span> {position} in the Guide</p>
		{/snippet}
		{#if more}{@render more(details)}{/if}
		{#if secondary}{@render secondary()}{/if}
	</div>
{/if}

<style>
	.writer,
	.primary,
	.field,
	.actions {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.actions {
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
	}
	.readout {
		margin: 0;
		font-size: 12px;
	}
	.readout span,
	.field span {
		color: var(--shell-ink-3, #79817b);
		font-size: 11px;
	}
	.field select,
	.field input {
		width: 100%;
		min-height: 30px;
		box-sizing: border-box;
		border: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 6px;
		background: #fff;
		color: var(--shell-ink, #1b201c);
		font: inherit;
	}
	.field input {
		padding: 0 0.4rem;
	}
	button {
		min-height: 30px;
		padding: 0 0.6rem;
		border: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 6px;
		background: #fff;
		color: var(--shell-ink, #1b201c);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	button:hover {
		background: var(--shell-hover, #eef0ed);
	}
	button.quiet {
		border-color: transparent;
		background: transparent;
	}
	button[aria-expanded='true'] {
		border-color: var(--shell-ink-3, #79817b);
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	@media (pointer: coarse) {
		button,
		.field input,
		.field select {
			min-height: 44px;
		}
	}
</style>
