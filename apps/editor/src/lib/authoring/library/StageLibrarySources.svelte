<script lang="ts">
	import { LIBRARY_SOURCES, type LibrarySource } from './library-catalogue';

	let {
		source,
		allCount,
		curatedCount,
		projectCount,
		mineCount,
		onSelect
	}: {
		source: LibrarySource;
		allCount: number;
		curatedCount: number;
		projectCount: number;
		mineCount: number;
		onSelect: (source: LibrarySource) => void;
	} = $props();

	function countOf(id: LibrarySource): number {
		return id === 'all' ? allCount : id === 'curated' ? curatedCount : id === 'mine' ? mineCount : projectCount;
	}
</script>

<div class="sources" role="group" aria-label="Material sources">
	{#each LIBRARY_SOURCES as option (option.id)}
		<button
			type="button"
			class:on={source === option.id}
			aria-pressed={source === option.id}
			data-library-source={option.id}
			onclick={() => onSelect(option.id)}
		>
			{option.label}
			<span>{countOf(option.id)}</span>
		</button>
	{/each}
</div>
<label class="sources-menu">
	<span class="sr">Material source</span>
	<select
		value={source}
		data-library-source-menu
		onchange={(event) => onSelect(event.currentTarget.value as LibrarySource)}
	>
		{#each LIBRARY_SOURCES as option (option.id)}
			<option value={option.id}>{option.label} · {countOf(option.id)}</option>
		{/each}
	</select>
</label>

<style>
	.sources {
		display: inline-flex;
		flex: none;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 8px;
		overflow: hidden;
	}
	.sources button {
		border: 0;
		border-right: 1px solid var(--shell-hairline);
		background: transparent;
		color: var(--shell-ink-2);
		font: inherit;
		font-size: 12px;
		padding: 6px 10px;
		cursor: pointer;
		white-space: nowrap;
		min-height: 30px;
	}
	.sources button:last-child { border-right: 0; }
	.sources button span { margin-left: 5px; font-size: 10px; opacity: 0.65; }
	.sources button.on { background: var(--shell-forest); color: var(--shell-ivory); }
	.sources-menu { display: none; flex: none; }
	.sources-menu select {
		font: inherit;
		font-size: 12px;
		min-height: 30px;
		padding: 4px 8px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 8px;
		background: var(--shell-card);
		color: var(--shell-ink);
	}
	.sources-menu select:focus-visible { outline: 2px solid var(--shell-forest); }
	@container library (width < 780px) {
		.sources { display: none; }
		.sources-menu { display: block; }
	}
	@media (pointer: coarse) {
		.sources button, .sources-menu select { min-height: 44px; }
	}
</style>
