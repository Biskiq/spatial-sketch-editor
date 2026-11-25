<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { StageCardFact } from '../stage-facade';

	let {
		ordinaryFacts,
		footer,
		more,
		secondary
	}: {
		ordinaryFacts: readonly StageCardFact[];
		footer: Snippet<[string?]>;
		more: Snippet<[Snippet?]>;
		secondary: Snippet<[Snippet?]>;
	} = $props();
</script>

{#if ordinaryFacts.length > 0}<dl class="facts">
		{#each ordinaryFacts.filter((fact) => fact.label
				.toLowerCase()
				.includes('area')) as fact (fact.label)}<dt>{fact.label}</dt>
			<dd>{fact.value}</dd>{/each}
	</dl>{/if}
{@render footer()}
{@render more()}
{@render secondary()}

<style>
	.facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 3px 8px;
		margin: 0;
		padding: 8px 12px;
		font-size: var(--shell-text-control);
	}
	dt {
		color: var(--shell-ink-2);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
</style>
