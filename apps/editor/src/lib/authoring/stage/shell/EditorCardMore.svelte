<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { StageCardFact } from '../stage-facade';

	let {
		moreOpen,
		relationFacts,
		content
	}: {
		moreOpen: boolean;
		relationFacts: readonly StageCardFact[];
		content?: Snippet;
	} = $props();
</script>

{#if moreOpen}
	<section class="more-section" aria-label="Advanced details" data-card-more-section>
		{#if content}<div class="more-dims">{@render content()}</div>{/if}
		{#if relationFacts.length > 0}
			<h3>Relations</h3>
			<dl class="facts">
				{#each relationFacts as fact (fact.label)}<dt>{fact.label}</dt><dd>{#if fact.select}<button type="button" class="fact-select" onclick={fact.select.onSelect}>{fact.value}</button>{:else}{fact.value}{/if}</dd>{/each}
			</dl>
		{/if}
	</section>
{/if}

<style>
	.more-section {
		padding: 6px 0 4px;
		border-top: 1px solid var(--shell-hairline);
	}
	.more-section h3 {
		margin: 4px 12px 0;
		font: 600 var(--shell-text-label)/1.2 var(--shell-sans);
		color: var(--shell-ink-2);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 3px 8px;
		margin: 0;
		padding: 8px 12px;
		font-size: var(--shell-text-control);
	}
	.more-section .facts {
		padding-top: 4px;
	}
	dt {
		color: var(--shell-ink-2);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.fact-select {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		text-decoration: underline;
		text-decoration-color: var(--shell-hairline-strong);
		text-underline-offset: 2px;
		cursor: pointer;
	}
	.fact-select:hover {
		text-decoration-color: currentColor;
	}
</style>
