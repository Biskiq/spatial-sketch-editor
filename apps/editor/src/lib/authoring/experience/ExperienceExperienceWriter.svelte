<script lang="ts">
	/**
	 * The Card's writer for the Experience itself (D-2, D-10, R33/R36).
	 *
	 * This is the Card when nothing is selected. It edits the welcome text and, only when the
	 * Experience has two or more Guides, which Guide visitors open with. With one Guide the choice
	 * is automatic and is not shown. The welcome has no other home.
	 */
	import type { Snippet } from 'svelte';
	import { EXPERIENCE_WELCOME_MAX_LENGTH } from '@portfolio/project-model/units';
	import { experienceHomes } from './experience-homes';

	let {
		footer,
		secondary,
		more
	}: {
		services?: unknown;
		detailOpen?: boolean;
		footer?: Snippet;
		secondary?: Snippet<[Snippet?]>;
		more?: Snippet<[Snippet?]>;
	} = $props();

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const current = $derived(controller?.current ?? null);
	const guides = $derived(controller?.guides ?? []);

	let welcomeDraft = $state('');
	$effect(() => {
		welcomeDraft = current?.welcome?.body ?? '';
	});

	async function commitWelcome(): Promise<void> {
		if (controller === null || controller.busy || welcomeDraft === (current?.welcome?.body ?? '')) return;
		if (!await controller.setWelcome(welcomeDraft)) {
			welcomeDraft = current?.welcome?.body ?? '';
		}
	}

	function plural(count: number, word: string): string {
		return `${count} ${word}${count === 1 ? '' : 's'}`;
	}
</script>

{#if controller !== null && current !== null}
	<div class="writer" data-experience-writer="experience">
		<section class="sec welcome" aria-labelledby="experience-welcome-title">
			<h3 class="sec-title" id="experience-welcome-title">Welcome text</h3>
			<textarea
				rows="3"
				maxlength={EXPERIENCE_WELCOME_MAX_LENGTH}
				aria-label="Welcome text"
				bind:value={welcomeDraft}
				disabled={controller.busy}
				onblur={() => void commitWelcome()}
			></textarea>
			<p class="foot-note">Visitors see this when the tour opens.</p>
		</section>

		{#if guides.length >= 2}
			<section class="sec" aria-labelledby="experience-opens-title" data-opens-with>
				<h3 class="sec-title" id="experience-opens-title">Opens with</h3>
				<div class="opens" role="radiogroup" aria-labelledby="experience-opens-title">
					{#each guides as guide (guide.id)}
						<button
							type="button"
							role="radio"
							aria-checked={current.entryGuideId === guide.id}
							disabled={controller.busy}
							data-opening-guide-option={guide.id}
							onclick={() => void controller.makeOpeningGuide(guide.id)}
						>
							<b>{guide.label}</b>
							<small>{plural(guide.stopIds.length, 'Stop')}</small>
						</button>
					{/each}
				</div>
				<p class="foot-note">One Guide opens the tour. The others are still reached from the Index and the strip.</p>
			</section>
		{/if}

		{#if footer}{@render footer()}{/if}
		{#if more}{@render more()}{/if}
		{#if secondary}{@render secondary()}{/if}
	</div>
{/if}

<style>
	.writer {
		display: flex;
		flex-direction: column;
		font-size: var(--shell-text-utility);
	}
	.sec {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px 12px;
		border-top: 1px solid var(--shell-hairline);
	}
	.sec:first-child {
		border-top: 0;
	}
	.sec-title {
		margin: 0;
		color: var(--shell-ink-3);
		font: 600 11px/1.3 var(--shell-sans);
	}
	.welcome textarea {
		box-sizing: border-box;
		width: 100%;
		min-height: 44px;
		resize: vertical;
		padding: 6px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 6px;
		background: var(--shell-card);
		color: var(--shell-ink);
		font: inherit;
	}
	.welcome textarea:focus-visible {
		outline: 2px solid var(--shell-forest-raised);
		outline-offset: 1px;
	}
	.opens {
		display: grid;
		gap: 6px;
	}
	.opens button {
		display: grid;
		gap: 2px;
		min-height: var(--shell-control-height);
		padding: 7px 9px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 8px;
		background: var(--shell-card);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.opens button[aria-checked='true'] {
		border-color: var(--shell-forest-raised);
		box-shadow: inset 0 0 0 1px var(--shell-forest-raised);
	}
	.opens button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.opens small {
		color: var(--shell-ink-3);
		font-size: 11px;
	}
	.foot-note {
		margin: 0;
		color: var(--shell-ink-3);
		font-size: 10.5px;
		line-height: 1.4;
	}
	@media (pointer: coarse) {
		.opens button {
			min-height: 44px;
		}
	}
</style>
