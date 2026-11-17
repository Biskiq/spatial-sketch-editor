<script lang="ts">
	/**
	 * The states in which Studio has no scoped root: Choose object, an empty project,
	 * and an unavailable root. Each says what happened in a sentence and offers the
	 * next honest step; none is a silent blank Stage and none edits source.
	 */
	import type { StudioPhase, StudioRoot } from './studio-model';

	let {
		phase,
		roots,
		origin,
		canUndo,
		creating,
		onChoose,
		onOpenChooser,
		onNewObject,
		onUndo,
		onBackToWorld,
		onBackToProjects,
		onOpenInWorld,
		onCancelCreation
	}: {
		phase: StudioPhase;
		roots: readonly StudioRoot[];
		origin: 'world' | 'standalone';
		canUndo: boolean;
		creating: boolean;
		onChoose: (rootId: string) => void;
		onOpenChooser: () => void;
		onNewObject: () => void;
		onUndo: () => void;
		onBackToWorld: () => void;
		onBackToProjects: () => void;
		onOpenInWorld: () => void;
		onCancelCreation: () => void;
	} = $props();

	/** Same-named objects stay distinguishable: the creator sees which is which. */
	function labelOf(root: { readonly name: string }, index: number): string {
		const sameName = roots.filter((candidate) => candidate.name === root.name).length > 1;
		return sameName ? `${root.name} (${index + 1})` : root.name;
	}
</script>

{#if phase.kind === 'choose' || phase.kind === 'no-objects' || phase.kind === 'unavailable' || (phase.kind === 'empty' && creating)}
	<section class="panel" role="dialog" aria-modal="false" aria-label="Object Studio" data-studio-panel={phase.kind}>
		{#if phase.kind === 'choose'}
			<h2>Choose an object</h2>
			<p>This project has {phase.roots.length} editable objects. Pick the one to edit.</p>
			<ul>
				{#each phase.roots as root, index (root.id)}
					<li><button type="button" data-studio-root={root.id} onclick={() => onChoose(root.id)}>{labelOf(root, index)}</button></li>
				{/each}
			</ul>
			<div class="row">
				<button type="button" onclick={onNewObject}>New object here</button>
			</div>
		{:else if phase.kind === 'no-objects'}
			<h2>No editable objects</h2>
			<p>This project has no native forms yet. Create one here, or start a new object project.</p>
			<div class="row">
				<button type="button" class="primary" data-studio-action="create-here" onclick={onNewObject}>Create object here</button>
				{#if origin === 'world'}
					<button type="button" onclick={onBackToWorld}>Back to World</button>
				{:else}
					<button type="button" onclick={onOpenInWorld}>Open in World</button>
					<button type="button" onclick={onBackToProjects}>Back to Projects</button>
				{/if}
			</div>
		{:else if phase.kind === 'unavailable'}
			<h2>That object is not available</h2>
			<p>
				{#if phase.lost}
					The object was removed from the project.
				{:else if phase.reason === 'unsupported'}
					Only native forms can be edited in Object Studio.
				{:else}
					The object was not found in this project.
				{/if}
			</p>
			<div class="row">
				{#if roots.length > 0}
					<button type="button" class="primary" data-studio-action="choose-from-panel" onclick={onOpenChooser}>
						Choose object
					</button>
				{/if}
				{#if phase.lost && canUndo}
					<button type="button" data-studio-action="undo" onclick={onUndo}>Undo</button>
				{/if}
				<button type="button" onclick={onNewObject}>New object here</button>
				{#if origin === 'world'}
					<button type="button" onclick={onBackToWorld}>Back to World</button>
				{:else}
					<button type="button" onclick={onOpenInWorld}>Open in World</button>
				{/if}
			</div>
		{:else}
			<h2>New object</h2>
			<p>Pick a form from Objects and place it on the mat. Nothing is added until you place it.</p>
			<div class="row">
				<button type="button" data-studio-action="cancel-creation" onclick={onCancelCreation}>Cancel</button>
			</div>
		{/if}
	</section>
{/if}

<style>
	.panel {
		position: absolute;
		top: 50%;
		left: 50%;
		z-index: 31;
		transform: translate(-50%, -50%);
		width: min(26rem, calc(100% - 2rem));
		padding: 16px 18px;
		border: 1px solid var(--shell-hairline);
		border-radius: 14px;
		background: var(--shell-popover);
		box-shadow: var(--shell-shadow);
		color: var(--shell-ink);
		font-size: 13px;
	}
	h2 {
		margin: 0 0 4px;
		font-size: 15px;
	}
	p {
		margin: 0 0 10px;
		color: var(--shell-ink-2);
		line-height: 1.4;
	}
	ul {
		display: grid;
		gap: 6px;
		margin: 0 0 10px;
		padding: 0;
		list-style: none;
		max-height: 40vh;
		overflow: auto;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	button {
		min-height: 32px;
		padding: 4px 12px;
		border: 1px solid var(--shell-field-line);
		border-radius: 9px;
		background: var(--shell-field);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	li button {
		width: 100%;
	}
	button.primary {
		border-color: transparent;
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
	}
	button:focus-visible {
		outline: 2px solid var(--shell-focus, currentColor);
		outline-offset: 2px;
	}
	@media (pointer: coarse) {
		button {
			min-height: 44px;
		}
	}
</style>
