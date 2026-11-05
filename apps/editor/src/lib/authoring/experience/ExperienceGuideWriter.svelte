<script lang="ts">
	/**
	 * The Card's writer for a selected Guide (R217.S25, Round 2 density). Read-only: how many Stops
	 * the Guide has, whether it is the Experience's entry Guide, and what it reaches. The Guide
	 * instrument opens and edits it (D3); the Card carries no Guide buttons. Its name is the Card's
	 * own name. Its reach summary follows the selected Guide.
	 *
	 * R217.S26: the name renames from the Card title, and **Make this the opening Guide** sets the
	 * Experience's Opening Guide (E5); the Opening Guide shows the *opens* tag instead.
	 */
	import type { Snippet } from 'svelte';
	import { formatGuideTime } from '@portfolio/camera-core';
	import { EXPERIENCE_WELCOME_MAX_LENGTH } from '@portfolio/project-model/units';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import ShellIcon from '$lib/authoring/stage/shell/ShellIcon.svelte';
	import { experienceHomes } from './experience-homes';

	let {
		footer,
		secondary,
		more,
	}: {
		services?: StageAdapterServices;
		detailOpen?: boolean;
		footer?: Snippet;
		secondary?: Snippet<[Snippet?]>;
		more?: Snippet<[Snippet?]>;
	} = $props();

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const guideId = $derived(controller?.subject?.kind === 'guide' ? controller.subject.guideId : null);
	const guide = $derived(
		guideId === null || controller === null ? null : (controller.guides.find((entry) => entry.id === guideId) ?? null)
	);
	const isEntry = $derived(guide !== null && controller?.current?.entryGuideId === guide.id);
	const reach = $derived(guide === null ? null : controller?.reach(guide) ?? null);
	const guideSeconds = $derived(guideId === null ? null : homes.guideSeconds(guideId));

	const stopCount = $derived(guide?.stopIds.length ?? 0);
	const openingReason = $derived(controller?.busy ? 'Wait for the current change' : '');

	let welcomeDraft = $state('');
	$effect(() => {
		welcomeDraft = controller?.current?.welcome?.body ?? '';
	});
	async function commitWelcome(): Promise<void> {
		if (controller === null || controller.busy || welcomeDraft === (controller.current?.welcome?.body ?? '')) return;
		if (!await controller.setWelcome(welcomeDraft)) {
			welcomeDraft = controller.current?.welcome?.body ?? '';
		}
	}

	/** The Guide instrument is where Stops are added; open it on this Guide. */
	function addStop(): void {
		if (controller === null || guide === null) return;
		controller.openGuide(guide.id);
		homes.setGuideOpen(true);
	}

	function plural(count: number, word: string): string {
		return `${count} ${word}${count === 1 ? '' : 's'}`;
	}
</script>

{#if controller !== null && guide !== null}
	<div class="writer" data-experience-writer="guide">
		<div class="c-actions">
			{#if isEntry}
				<span class="opens-tag" data-opening-guide>opens</span>
			{:else}
				<button
					type="button"
					class="btn"
					disabled={openingReason !== ''}
					title={openingReason || 'Visitors who start the tour start in this Guide'}
					aria-describedby={openingReason !== '' ? 'guide-opening-reason' : undefined}
					data-make-opening
					onclick={() => guide !== null && void controller.makeOpeningGuide(guide.id)}>Make this the opening Guide</button
				>
				{#if openingReason !== ''}<span id="guide-opening-reason" class="sr">{openingReason}</span>{/if}
			{/if}
			<button type="button" class="btn" onclick={addStop}>
				<ShellIcon name="plus" size={13} />Add stop
			</button>
			<button
				type="button"
				class="btn ghost"
				disabled={controller === null || guideId === null || guideSeconds === null}
				title={guideSeconds === null ? 'There is no Guide to play' : `Play from the start · ${formatGuideTime(guideSeconds)}`}
				onclick={() => guideId !== null && homes.playGuide(guideId, { kind: 'start' })}
			>
				<ShellIcon name="play" size={12} />Play from the start
			</button>
		</div>

		<section class="sec" aria-labelledby="guide-pacing-title" data-guide-pacing>
			<h3 class="sec-title" id="guide-pacing-title">Pacing</h3>
			<div class="pacing" role="radiogroup" aria-labelledby="guide-pacing-title">
				<button
					type="button"
					role="radio"
					aria-checked={guide.pacing === 'automatic'}
					disabled={controller.busy}
					onclick={() => guide !== null && void controller.setGuidePacing(guide.id, 'automatic')}
				>
					<b>Automatic</b>
					<small>Each Stop stays for its time, then the tour plays on.</small>
				</button>
				<button
					type="button"
					role="radio"
					aria-checked={guide.pacing === 'manual'}
					disabled={controller.busy}
					onclick={() => guide !== null && void controller.setGuidePacing(guide.id, 'manual')}
				>
					<b>Manual</b>
					<small>Each Stop waits until the visitor presses Next.</small>
				</button>
			</div>
			<p class="foot-note">
				{#if guideSeconds !== null}Length {formatGuideTime(guideSeconds)}{guide.pacing === 'manual' ? ` + ${plural(stopCount, 'wait')}` : ''}. {/if}Transitions
				play in both. Stops keep their times while Manual is on, so switching back restores them.
			</p>
		</section>

		<section class="sec" aria-label="One museum, two ways in">
			<h3 class="sec-title">One museum, two ways in</h3>
			<div class="modes">
				<button type="button" class="mode-card" title="Preview the guided tour" onclick={() => homes.previewMode('guided', guide.id)}>
					<span class="mode-ico"><ShellIcon name="guide" size={15} /></span>
					<span class="mode-text">
						<span class="mode-name">Guided tour</span>
						<span class="mode-desc"
							>{plural(stopCount, 'Stop')} · {guide.pacing === 'manual' ? 'at the visitor’s pace' : 'plays on by itself'}. Explore is always in the bar.</span
						>
					</span>
				</button>
				<button type="button" class="mode-card" title="Preview free exploration" onclick={() => homes.previewMode('free', guide.id)}>
					<span class="mode-ico"><ShellIcon name="eye" size={15} /></span>
					<span class="mode-text">
						<span class="mode-name">Free exploration</span>
						{#if reach !== null}
							<span class="mode-desc"
								>{plural(reach.freePresentations, 'Presentation')} · {plural(reach.freeViews, 'View')}.
								{reach.viewsOnlyFree}
								{reach.viewsOnlyFree === 1 ? 'View' : 'Views'} only found this way.</span
							>
						{/if}
					</span>
				</button>
			</div>
			<p class="foot-note">Both use the same Presentations and Views. The Guide only decides an order through them.</p>
		</section>

		<section class="sec" aria-label="Build the tour">
			<h3 class="sec-title">Build the tour</h3>
			<p class="c-note">
				Drag a Presentation from the index onto the Guide, or use Add stop. Drag Stops to reorder. The order you see is
				the order visitors get.
			</p>
			{#if isEntry}<p class="foot-note">The Experience opens on this Guide.</p>{/if}
		</section>

		{#snippet content()}
			<label class="welcome">
				<span class="sec-title">Welcome text</span>
				<textarea rows="3" maxlength={EXPERIENCE_WELCOME_MAX_LENGTH} bind:value={welcomeDraft}
					disabled={controller.busy} onblur={() => void commitWelcome()}></textarea>
			</label>
		{/snippet}
		{#if footer}{@render footer()}{/if}
		{#if more}{@render more(content)}{/if}
		{#if secondary}{@render secondary()}{/if}
	</div>
{/if}

<style>
	.pacing {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}
	.pacing button {
		display: grid;
		gap: 2px;
		padding: 8px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 8px;
		background: var(--shell-card, #fff);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.pacing button[aria-checked='true'] {
		border-color: var(--shell-forest-raised, #22503c);
		box-shadow: inset 0 0 0 1px var(--shell-forest-raised, #22503c);
	}
	.pacing small {
		color: var(--shell-ink-3, #6b736d);
		font-size: 11px;
	}
	.welcome {
		display: grid;
		width: 100%;
		gap: 6px;
	}
	.welcome textarea {
		box-sizing: border-box;
		width: 100%;
		min-height: 44px;
		resize: vertical;
		padding: 6px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 6px;
		background: var(--shell-card, #fff);
		color: var(--shell-ink, #1b201c);
		font: inherit;
	}
	.welcome textarea:focus-visible {
		outline: 2px solid var(--shell-forest-raised, #22503c);
		outline-offset: 1px;
	}

	.writer {
		display: flex;
		flex-direction: column;
		font-size: 12px;
	}
	.c-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 8px 12px;
	}
	.opens-tag {
		align-self: center;
		padding: 0 5px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 3px;
		color: var(--shell-ink-2, #4a524c);
		font: 500 10px/1.6 var(--shell-mono, ui-monospace, monospace);
		letter-spacing: 0.02em;
	}
	.sec {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px 12px;
		border-top: 1px solid var(--shell-hairline, #e1e4de);
	}
	.sec-title {
		margin: 0;
		color: var(--shell-ink-3, #79817b);
		font: 600 11px/1.3 var(--shell-sans, system-ui);
	}
	.modes {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.mode-card {
		display: grid;
		grid-template-columns: 20px 1fr;
		column-gap: 8px;
		width: 100%;
		padding: 10px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 12px;
		background: var(--shell-card, #fff);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.mode-card:hover {
		border-color: var(--shell-forest-raised, #22503c);
	}
	.mode-ico {
		display: inline-flex;
		flex: none;
		padding-top: 1px;
		color: var(--shell-ink-3, #79817b);
	}
	.mode-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.mode-name {
		color: var(--shell-ink, #1b201c);
		font-size: 13px;
		font-weight: 600;
	}
	.mode-desc {
		color: var(--shell-ink-2, #4a524c);
		font-size: 12px;
		line-height: 1.45;
	}
	.c-note {
		margin: 0;
		color: var(--shell-ink-2, #4a524c);
		font-size: 11.5px;
		line-height: 1.45;
	}
	.foot-note {
		margin: 0;
		color: var(--shell-ink-3, #79817b);
		font-size: 10.5px;
		line-height: 1.4;
	}
	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		min-height: 28px;
		padding: 0 11px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 6px;
		background: var(--shell-card, #fff);
		color: var(--shell-ink, #1b201c);
		font: inherit;
		font-size: 11.5px;
		font-weight: 600;
		cursor: pointer;
	}
	button:hover {
		background: var(--shell-hover, #eef0ed);
	}
	button.ghost {
		border-color: transparent;
		background: transparent;
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
	@media (pointer: coarse) {
		button {
			min-height: 44px;
		}
	}
</style>
