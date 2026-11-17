<script lang="ts">
	/**
	 * The Slice plate: Build → Slice's Level | Drawn switch.
	 *
	 * It writes only the two session commands the route owns. Level keeps SL1's
	 * immediate Sheet-height cut; Drawn arms the finite segment gesture and stays
	 * open, so a second press can replace the segment.
	 */
	let {
		mode,
		drawing,
		onLevel,
		onDrawn
	}: {
		mode: 'level' | 'drawn' | null;
		drawing: boolean;
		onLevel: () => void;
		onDrawn: () => void;
	} = $props();
</script>

<div class="slice-plate" data-slice-plate data-slice-mode={mode ?? 'none'}>
	<div class="pg">
		<span class="gl" title="Slice reading">Reading</span>
		<div class="opts" role="group" aria-label="Slice reading">
			<button
				type="button"
				class="opt"
				aria-label="Level cut"
				aria-pressed={mode === 'level'}
				title="Cut horizontally at the Height Sheet"
				onclick={onLevel}>Level</button
			>
			<button
				type="button"
				class="opt"
				aria-label="Drawn cut"
				aria-pressed={mode === 'drawn' || drawing}
				title="Draw a finite line to cut through both sides"
				onclick={onDrawn}>Drawn</button
			>
		</div>
	</div>
	<div class="pg end">
		<span class="gl" data-slice-hint>{drawing ? 'Drag a line · Flip on the pill' : mode === 'drawn' ? 'Drag an end, the line or the depth grip' : 'Drag the Height Sheet to move the cut'}</span>
	</div>
</div>

<style>
	.slice-plate {
		display: flex;
		align-items: center;
		gap: 18px;
		width: 100%;
		min-width: max-content;
		height: 100%;
	}
	.pg {
		display: grid;
		flex: none;
		gap: 3px;
	}
	.pg.end {
		margin-left: auto;
	}
	.gl {
		color: var(--shell-ink-3);
		font: 400 9.5px/1 var(--shell-mono);
		letter-spacing: 0.02em;
		white-space: nowrap;
	}
	.opts {
		display: flex;
		align-items: center;
		gap: 2px;
		height: 31px;
	}
	.opt {
		flex: none;
		height: 30px;
		padding: 0 10px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--shell-ink-2);
		font: 500 var(--shell-text-utility)/1 var(--shell-sans);
		cursor: pointer;
	}
	.opt:hover:not([aria-pressed='true']) {
		background: var(--shell-hover);
		color: var(--shell-ink);
	}
	.opt[aria-pressed='true'] {
		background: var(--shell-forest);
		color: var(--shell-ink-light);
	}
	button:focus-visible {
		outline: var(--shell-focus-ring-light);
		outline-offset: -2px;
	}
</style>
