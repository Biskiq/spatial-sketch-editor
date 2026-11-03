<script lang="ts">
	/**
	 * A View snapshot slot (R217.S25). Real snapshots render through the Camera in S26;
	 * until then the slot keeps its place and size with a neutral frame, so the Index,
	 * the Card and the Guide keep their composition and never show a false image.
	 */
	import ShellIcon from '../stage/shell/ShellIcon.svelte';

	let {
		label,
		number = null,
		ratio = '16/10',
		selected = false
	}: {
		/** The View (or Presentation) the slot stands for; read by assistive technology. */
		label: string;
		/** A Stop's place in its Guide, shown as the corner badge. */
		number?: number | null;
		ratio?: '16/10' | 'stop' | 'row';
		selected?: boolean;
	} = $props();
</script>

<span class="snapshot {ratio === 'stop' ? 'stop' : ratio === 'row' ? 'row' : ''}" class:selected role="img" aria-label={`${label}, snapshot not rendered yet`}>
	<ShellIcon name="camera" size={ratio === 'row' ? 12 : 16} />
	{#if number !== null}<span class="number">{number}</span>{/if}
</span>

<style>
	.snapshot {
		position: relative;
		display: grid;
		place-items: center;
		width: 100%;
		aspect-ratio: 16 / 10;
		border: 2px solid transparent;
		border-radius: 6px;
		background: var(--shell-mat, #e1e4dc);
		color: var(--shell-ink-3, #79817b);
		overflow: hidden;
	}
	.snapshot.stop {
		aspect-ratio: auto;
		height: 50px;
		border-width: 0;
		border-radius: 5px;
	}
	.snapshot.row {
		width: 48px;
		height: 30px;
		aspect-ratio: auto;
		flex: none;
		border-width: 0;
		border-radius: 4px;
	}
	.snapshot.selected {
		border-color: var(--shell-gold, #d4ad45);
	}
	.number {
		position: absolute;
		top: 3px;
		left: 3px;
		padding: 0 4px;
		border-radius: 4px;
		background: var(--shell-forest, #1d3b2f);
		color: #fff;
		font: 600 10px/1.4 var(--shell-mono, ui-monospace, monospace);
	}
</style>
