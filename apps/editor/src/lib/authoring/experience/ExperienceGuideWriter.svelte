<script lang="ts">
	/**
	 * The Card's writer for a selected Guide (R217.S25, Round 2 density). Read-only: how many Stops
	 * the Guide has, whether it is the Experience's entry Guide, and what it reaches. The Guide
	 * instrument opens and edits it (D3); the Card carries no Guide buttons. Its name is the Card's
	 * own name. The reach summary is the active Guide's, so it is read only while this Guide is the
	 * active one.
	 */
	import type { Snippet } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import ShellIcon from '$lib/authoring/stage/shell/ShellIcon.svelte';
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
	const guideId = $derived(controller?.subject?.kind === 'guide' ? controller.subject.guideId : null);
	const guide = $derived(
		guideId === null || controller === null ? null : (controller.guides.find((entry) => entry.id === guideId) ?? null)
	);
	const isEntry = $derived(guide !== null && controller?.current?.entryGuideId === guide.id);
	const isActive = $derived(guide !== null && controller?.currentGuide?.id === guide.id);
	const reach = $derived(isActive && controller !== null ? controller.reach() : null);

	const stopCount = $derived(guide?.stopIds.length ?? 0);

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
			<button type="button" class="btn" onclick={addStop}>
				<ShellIcon name="plus" size={13} />Add stop
			</button>
			<button
				type="button"
				class="btn ghost"
				disabled
				title="Comes with Camera playback"
				aria-describedby="guide-play-reason"
			>
				<ShellIcon name="play" size={12} />Play from the start
			</button>
			<span id="guide-play-reason" class="sr">Comes with Camera playback</span>
		</div>

		<section class="sec" aria-label="One museum, two ways in">
			<h3 class="sec-title">One museum, two ways in</h3>
			<div class="modes">
				<div class="mode-card">
					<span class="mode-ico"><ShellIcon name="guide" size={15} /></span>
					<span class="mode-text">
						<span class="mode-name">Guided tour</span>
						<span class="mode-desc"
							>{plural(stopCount, 'Stop')}. Visitors press Next between Stops.</span
						>
					</span>
				</div>
				<div class="mode-card">
					<span class="mode-ico"><ShellIcon name="eye" size={15} /></span>
					<span class="mode-text">
						<span class="mode-name">Free exploration</span>
						{#if reach !== null}
							<span class="mode-desc"
								>{plural(reach.presentations, 'Presentation')} · {plural(reach.views, 'View')}.
								{reach.viewsOnlyFree}
								{reach.viewsOnlyFree === 1 ? 'View is' : 'Views are'} only found this way.</span
							>
						{:else}
							<span class="mode-desc">Open this Guide to see what it reaches.</span>
						{/if}
					</span>
				</div>
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

		{#if footer}{@render footer()}{/if}
		{#if more}{@render more()}{/if}
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
		flex-wrap: wrap;
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
		display: flex;
		gap: 8px;
		padding: 8px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 8px;
		background: var(--shell-card, #fff);
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
		font: 13px/1.3 var(--shell-serif, Georgia, serif);
	}
	.mode-desc {
		color: var(--shell-ink-2, #4a524c);
		font-size: 11.5px;
		line-height: 1.4;
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
