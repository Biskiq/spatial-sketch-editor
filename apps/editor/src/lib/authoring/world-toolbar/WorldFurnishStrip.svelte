<script lang="ts">
	import WorldIcon from './WorldIcon.svelte';

	let { plateId, onBrowse }: { plateId: string; onBrowse: () => void } = $props();
</script>

<div class="tier furnish-strip" id={plateId} data-world-strip="furnish" role="group" aria-label="Furnish">
	<div class="row furnish-row">
		<div class="strip">
			<span class="pn">
				<b>Furnish</b>
				<span>Quick picks will live here. Browse the Library for objects, artwork and lights.</span>
			</span>
			<button type="button" class="pill-browse" data-furnish-browse onclick={onBrowse}>
				<WorldIcon name="library" size={16} />
				Browse all
			</button>
		</div>
	</div>
</div>

<style>
	.tier {
		flex: none;
		background: var(--shell-mode-active-bg);
		color: var(--shell-ink);
	}
	.row,
	.strip {
		display: flex;
		align-items: center;
		gap: 2px;
		height: 100%;
	}
	.furnish-row {
		height: 48px;
	}
	.furnish-row .strip {
		gap: 10px;
	}
	.pn {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 1px;
		min-width: 0;
	}
	.furnish-row .pn {
		flex: 1;
	}
	.pn b {
		font: 600 var(--shell-text-label)/1.2 var(--shell-sans);
	}
	.pn > span {
		color: var(--shell-ink-2);
		font-size: var(--shell-text-utility);
	}
	.pill-browse {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 6px;
		height: 32px;
		padding: 0 12px;
		border: 1px solid var(--shell-hairline);
		border-radius: 999px;
		background: var(--shell-white);
		color: var(--shell-forest);
		font: 500 var(--shell-text-utility)/1 var(--shell-sans);
		white-space: nowrap;
		cursor: pointer;
	}
	.pill-browse:hover {
		border-color: var(--shell-leaf);
		background: var(--shell-leaf-tint);
	}
	@media (pointer: coarse) {
		.pill-browse {
			min-height: 44px;
		}
	}
</style>
