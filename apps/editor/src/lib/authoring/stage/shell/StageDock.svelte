<script lang="ts">
	/**
	 * PLATE **bottom dock** (Production shell Round 2, D2/D8).
	 *
	 * The dock is the one home for armable tools: **Select** — the host's own tool,
	 * which keeps pointer presses for selection and navigation — plus every tool an
	 * adapter contributes with `home: 'dock'`. A tool is armed by pressing its key,
	 * and the armed key is the one ivory key on the dark forest surface; pressing it
	 * again collapses or re-opens its palette (the invoked Instrument above).
	 *
	 * It renders no domain tool of its own and no empty slot: a family this phase
	 * does not implement (Slice, Eraser, Brush, Measure, Shape) is simply absent,
	 * because an inert key would be a promise the domain cannot keep.
	 */
	import type { StageDockTool } from '../stage-contributions';

	let {
		armedTaskKind,
		tools,
		paletteOpen = false,
		onSelect,
		onArm,
		onTogglePalette
	}: {
		/** The contributed task currently armed, or `null` for the host's Select. */
		armedTaskKind: string | null;
		tools: readonly StageDockTool[];
		paletteOpen?: boolean;
		onSelect: () => void;
		onArm: (tool: StageDockTool) => void;
		onTogglePalette: () => void;
	} = $props();
</script>

<nav class="dock" data-stage-dock aria-label="Tools">
	<button
		type="button"
		class="key"
		class:armed={armedTaskKind === null}
		aria-pressed={armedTaskKind === null}
		data-dock-select
		title="Select: press the Stage to select a subject and drag to navigate"
		onclick={onSelect}
	>
		Select
	</button>
	{#each tools as tool (`${tool.adapterId}:${tool.id}`)}
		<button
			type="button"
			class="key"
			class:armed={armedTaskKind === tool.taskKind}
			aria-pressed={armedTaskKind === tool.taskKind}
			data-dock-tool={tool.id}
			title={`${tool.label} — arm this tool`}
			onclick={() => (armedTaskKind === tool.taskKind ? onTogglePalette() : onArm(tool))}
		>
			{tool.label}
		</button>
	{/each}
</nav>

<style>
	.dock {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.45rem;
		border: 1px solid #2c4437;
		border-radius: 0.6rem;
		background: rgb(17 41 31 / 96%);
		box-shadow: 0 0.5rem 1.5rem rgb(6 20 14 / 45%);
		color: #f4f0e9;
	}
	.key {
		min-height: 2.5rem;
		min-width: 4.5rem;
		padding: 0 0.7rem;
		border: 1px solid #405d4c;
		border-radius: 0.45rem;
		background: #1b2b23;
		color: inherit;
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
	}
	.key:hover {
		border-color: #6d8f7b;
	}
	.key[aria-pressed='true'] {
		border-color: #f4f0e9;
		background: #f4f0e9;
		color: #14231b;
		font-weight: 650;
	}
	.key:focus-visible {
		outline: 2px solid #9fd0b4;
		outline-offset: 2px;
	}
</style>
