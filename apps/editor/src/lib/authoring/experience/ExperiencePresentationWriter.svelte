<script lang="ts">
	/**
	 * The Card's writer for a selected Presentation (R217.S25, Round 2 density). Its body is a
	 * snapshot grid of the Presentation's Views: a tile selects that View (the one Card selection,
	 * D10), a double-click opens Look through, and the ◆ and the tour dot are informational only,
	 * since the Default changes on the View Card (D12). *Visitors reach it* names the Stops that show its Views. While the first
	 * Guide is awaiting its name (D8) the name is asked inline here. Add to Guide is the visible
	 * action under the Card name; the Information text is committed on blur. It edits through the Experience controller; its
	 * own state is the Views filter, the text draft and the first-Guide name.
	 *
	 * R217.S26: `•••` → Add to Guide ▸ New Guide… asks the new Guide's name here too (E5).
	 *
	 * Sheet §32: the View list is the rail (`ExperienceViewRail`) — the one place View
	 * order, the Default (View 1) and the Cut/Travel steps between neighbours are edited.
	 * *Listed in Places* is this Card's one switch for free exploration, and *Used by*
	 * shows which Stops enter elsewhere and which invite.
	 */
	import { untrack, type Snippet } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import ShellIcon from '$lib/authoring/stage/shell/ShellIcon.svelte';
	import ExperienceViewRail from './ExperienceViewRail.svelte';
	import { experienceHomes } from './experience-homes';
	import type { ExperienceViewChoice } from './experience-controller.svelte';

	let {
		secondary,
	}: {
		services?: StageAdapterServices;
		detailOpen?: boolean;
		footer?: Snippet;
		secondary?: Snippet<[Snippet?]>;
		more?: Snippet<[Snippet?]>;
	} = $props();

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const presentation = $derived(controller?.selectedPresentation ?? null);
	const views = $derived<readonly ExperienceViewChoice[]>(
		presentation === null ? [] : (controller?.viewsOf.get(presentation.id) ?? [])
	);
	const selectedViewId = $derived(controller?.selectedView?.id ?? null);

	/** Stops of this Presentation in Guide order. A shared View can appear elsewhere. */
	const tourStops = $derived((controller?.guideStops ?? []).flatMap((stop, index) =>
		stop.presentationId === presentation?.id
			? [{
					stopId: stop.id,
					position: index + 1,
					entersAt: stop.entryViewId === null ? null : (views.find((view) => view.id === stop.entryViewId)?.label ?? null),
					invites: stop.invitation !== null
				}]
			: []
	));

	/** The Information text draft; committed on blur only when it differs from the stored text. */
	let textDraft = $state('');
	$effect(() => {
		void presentation?.id;
		untrack(() => {
			textDraft = presentation?.text?.body ?? '';
		});
	});
	async function commitText(): Promise<void> {
		if (controller === null || presentation === null) return;
		if (textDraft === (presentation.text?.body ?? '')) return;
		await controller.updatePresentationText(presentation.id, textDraft);
	}

	/** D-9: Add to Guide makes a Stop; with no Guide the controller creates Tour, with no prompt. */
	const addReason = $derived(controller?.busy ? 'Wait for the current change' : '');
	function addToGuide(): void {
		if (controller === null || presentation === null || addReason !== '') return;
		void controller.addStop(presentation.id);
	}

	function selectView(viewId: string): void {
		if (presentation === null) return;
		homes.select({ kind: 'view', viewId, presentationId: presentation.id });
	}
	function lookThrough(viewId: string): void {
		homes.lookThrough(viewId);
	}
	function selectStop(stopId: string): void {
		homes.select({ kind: 'stop', stopId });
	}
</script>

{#if controller !== null && presentation !== null}
	<div class="writer" data-experience-writer="presentation">
		<div class="c-actions">
			<button
				type="button"
				class="btn"
				disabled={addReason !== ''}
				title={addReason || 'Add this Presentation to the Guide as a Stop'}
				aria-describedby={addReason !== '' ? 'add-guide-reason' : undefined}
				onclick={addToGuide}
			>
				<ShellIcon name="plus" size={13} />Add to Guide
			</button>
			{#if addReason !== ''}<span id="add-guide-reason" class="sr">{addReason}</span>{/if}
		</div>

		<section class="sec" aria-label="Views">
			<ExperienceViewRail
				{controller}
				{presentation}
				{views}
				{selectedViewId}
				onSelect={selectView}
				onLookThrough={lookThrough}
				onShapePath={(toViewId) => controller.selectPath({ kind: 'step', presentationId: presentation.id, toViewId })}
			/>
			<p class="foot-note">The order is a suggestion: visitors step it with ‹ › while exploring. Capture in the dock adds a View at the end.</p>
		</section>

		<section class="sec" aria-label="Places and use">
			<button type="button" class="explorable" role="switch" aria-checked={presentation.explorable}
				aria-describedby="explorable-description" disabled={controller.busy}
				onclick={() => void controller.setExplorable(presentation.id, !presentation.explorable)}>
				<span>Listed in Places</span>
				<span class="switch-track" aria-hidden="true"></span>
			</button>
			<p class="foot-note" id="explorable-description">
				Places opens it without a Guide, at View 1. Explore from a Stop opens it either way.
			</p>
			<div class="reach-row">
				<span class="reach-ico"><ShellIcon name="guide" size={14} /></span>
				{#if tourStops.length > 0}
					<span class="reach-label">Used by</span>
					{#each tourStops.slice(0, 3) as stop (stop.stopId)}
						<button type="button" class="chip mono" title={stop.entersAt === null ? 'Enters at View 1' : `Enters at ${stop.entersAt}`} onclick={() => selectStop(stop.stopId)}
							>Stop {stop.position}{stop.entersAt === null ? '' : ` · at ${stop.entersAt}`}{stop.invites ? ' ✦' : ''}</button
						>
					{/each}
					{#if tourStops.length > 3}
						<span class="more-count">+{tourStops.length - 3}</span>
					{/if}
				{:else}
					<span class="reach-label">Not on the tour</span>
				{/if}
			</div>
			{#if tourStops.length > 3}
				<div class="chips">
					{#each tourStops.slice(3) as stop (stop.stopId)}
						<button type="button" class="chip mono" onclick={() => selectStop(stop.stopId)}
							>Stop {stop.position}{stop.entersAt === null ? '' : ` · at ${stop.entersAt}`}{stop.invites ? ' ✦' : ''}</button
						>
					{/each}
				</div>
			{/if}
		</section>

		<section class="sec quiet-sec" aria-label="Information text">
			<label class="field">
				<span class="sec-title">Information text</span>
				<textarea
					rows="2"
					maxlength="4000"
					bind:value={textDraft}
					disabled={controller.busy}
					onblur={() => void commitText()}
				></textarea>
			</label>
		</section>

		{#if secondary}{@render secondary()}{/if}
	</div>
{/if}

<style>
	.writer {
		display: flex;
		flex-direction: column;
		font-size: 12px;
	}
	.c-actions {
		display: flex;
		gap: 6px;
		padding: 8px 12px;
	}
	.sec {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px 12px;
		border-top: 1px solid var(--shell-hairline, #e1e4de);
	}
	.sec-title {
		display: flex;
		align-items: baseline;
		gap: 5px;
		margin: 0;
		color: var(--shell-ink-3, #79817b);
		font: 600 11px/1.3 var(--shell-sans, system-ui);
	}
	.foot-note {
		margin: 0;
		color: var(--shell-ink-3, #79817b);
		font-size: 10.5px;
		line-height: 1.4;
	}
	.row-actions,
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.text-input,
	textarea {
		box-sizing: border-box;
		width: 100%;
		min-height: 26px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 6px;
		background: var(--shell-card, #fff);
		color: var(--shell-ink, #1b201c);
		font: inherit;
		font-size: 12px;
		padding: 3px 6px;
	}
	textarea {
		resize: vertical;
	}

	/* R217.S26: the reorder caret is the Stop cards' gold insertion caret, at the tile's edge. */

	.reach-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
	}
	.reach-ico {
		display: inline-flex;
		color: var(--shell-ink-3, #79817b);
	}
	.reach-label {
		color: var(--shell-ink-2, #4a524c);
	}
	.more-count {
		color: var(--shell-ink-3, #79817b);
		font: 10.5px var(--shell-mono, ui-monospace, monospace);
	}
	.quiet-sec {
		padding-top: 6px;
	}

	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		min-height: 24px;
		padding: 0 8px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 6px;
		background: var(--shell-card, #fff);
		color: var(--shell-ink, #1b201c);
		font: inherit;
		font-size: 11.5px;
		cursor: pointer;
	}
	button:hover {
		background: var(--shell-hover, #eef0ed);
	}
	button.btn {
		min-height: 28px;
		padding: 0 11px;
		font-weight: 600;
	}
	button.chip {
		min-height: 20px;
		padding: 0 7px;
		border-radius: 999px;
		font-size: 11px;
	}
	button.mono {
		font-family: var(--shell-mono, ui-monospace, monospace);
	}
	button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	.explorable {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		min-height: 28px;
		padding: 0;
		border: 0;
		background: none;
		text-align: left;
	}
	.switch-track {
		display: flex;
		align-items: center;
		width: 28px;
		height: 16px;
		padding: 2px;
		box-sizing: border-box;
		border-radius: 9px;
		background: var(--shell-hairline-strong, #cdd2ca);
	}
	.switch-track::before {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--shell-card, #fff);
		content: '';
	}
	.explorable[aria-checked='true'] .switch-track {
		justify-content: flex-end;
		background: var(--shell-forest-raised, #22503c);
	}
	.explorable[aria-checked='true'] .switch-track::before {
		background: var(--shell-leaf, #8baf94);
	}
	@media (pointer: coarse) {
		button,
		button.chip {
			min-height: 36px;
		}
	}
</style>
