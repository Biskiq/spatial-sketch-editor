<script lang="ts">
	/**
	 * Objects is the landed Furnish row. The Library and the selected object's
	 * identity stay on the panels that already own them; this plate only opens the
	 * real Objects instrument, so a tile never becomes a second placement writer.
	 */
	import ShellIcon from '../stage/shell/ShellIcon.svelte';
	import { assets } from '$lib/content/assets';

	let { onOpen }: { onOpen: (assetId: string) => void } = $props();
	const approved = assets.filter((asset) => asset.status === 'approved').slice(0, 5);
</script>

<div class="objects-plate" data-objects-plate>
	{#each approved as asset (asset.id)}
		<button type="button" class="object" title={`Open ${asset.name} in Objects`} onclick={() => onOpen(asset.id)}>
			<ShellIcon name="object" size={18} />
			<span>{asset.name}</span>
		</button>
	{/each}
	<button type="button" class="panel" onclick={() => onOpen('')}>
		<ShellIcon name="layers" size={18} />
		<span>Objects panel</span>
	</button>
</div>

<style>
	.objects-plate {
		display: flex;
		align-items: center;
		gap: 5px;
		width: 100%;
		overflow-x: auto;
		scrollbar-width: none;
	}
	button {
		display: grid;
		grid-template-columns: auto auto;
		align-items: center;
		gap: 6px;
		flex: none;
		height: 34px;
		max-width: 150px;
		padding: 0 9px;
		border: 1px solid rgb(240 244 236 / 0.14);
		border-radius: 7px;
		background: rgb(242 240 230 / 0.04);
		color: var(--ld-light, #f2f0e6);
		font: 10.5px/1 var(--ld-sans, 'Instrument Sans', system-ui, sans-serif);
		cursor: pointer;
	}
	button:hover {
		background: rgb(242 240 230 / 0.09);
	}
	button span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	button.panel {
		margin-left: auto;
		border-color: rgb(200 166 83 / 0.5);
		color: var(--ld-gold, #c8a653);
	}
	button:focus-visible {
		outline: 2px solid var(--ld-gold, #c8a653);
		outline-offset: 1px;
	}
</style>
