<script lang="ts">
	/**
	 * The Card's writer for a selected Presentation (R217.S25). Its primary fields are the
	 * Default View and the information text, with Save Presentation and the Guide control;
	 * More holds Capture and rebind. The label is the Card's inline name, not a field here.
	 * It edits through the Experience controller and holds no state of its own.
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
	const presentation = $derived(controller?.selectedPresentation ?? null);
	const views = $derived(presentation === null ? [] : controller?.viewsOf.get(presentation.id) ?? []);
	const defaultLabel = $derived(
		presentation === null ? '' : views.find((view) => view.id === presentation.defaultViewId)?.label ?? 'Unset: cannot be entered'
	);

	function setText(event: Event & { currentTarget: HTMLTextAreaElement }): void {
		if (controller !== null) controller.drafts.presentationText = event.currentTarget.value;
	}
</script>

{#if controller !== null && presentation !== null}
	<div class="writer" data-experience-writer="presentation">
		<div class="primary">
			{#if views.length > 1}
				<label class="field">
					<span>Default View</span>
					<select
						value={presentation.defaultViewId ?? ''}
						disabled={controller.busy}
						onchange={(event) => void controller.setDefaultView(presentation.id, event.currentTarget.value)}
					>
						{#each views as view (view.id)}<option value={view.id}>{view.label}</option>{/each}
					</select>
				</label>
			{:else}
				<p class="readout"><span>Default View:</span> {defaultLabel}</p>
			{/if}
			<label class="field grow">
				<span>Information text (plain, 4,000 code points)</span>
				<textarea rows="3" value={controller.drafts.presentationText} oninput={setText}></textarea>
			</label>
			<div class="actions">
				<button type="button" onclick={() => void controller.savePresentation()} disabled={controller.busy}>
					Save Presentation
				</button>
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
			<div class="precision">
				<button type="button" class="quiet" onclick={() => void controller.rebindToCapturedView()} disabled={controller.busy}>
					Capture and rebind
				</button>
			</div>
		{/snippet}
		{#if more}{@render more(details)}{/if}
		{#if secondary}{@render secondary()}{/if}
	</div>
{/if}

<style>
	.writer,
	.primary,
	.field,
	.actions,
	.precision {
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
	.field textarea {
		width: 100%;
		min-height: 30px;
		box-sizing: border-box;
		border: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 6px;
		background: #fff;
		color: var(--shell-ink, #1b201c);
		font: inherit;
	}
	.field textarea {
		resize: vertical;
		padding: 0.3rem 0.4rem;
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
		button {
			min-height: 44px;
		}
	}
</style>
