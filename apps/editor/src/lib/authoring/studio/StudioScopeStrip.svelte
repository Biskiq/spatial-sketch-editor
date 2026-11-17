<script lang="ts">
	/**
	 * The Object Studio strip: where you are, what surrounds it, and the way out.
	 *
	 * Presentation only. Every command is the controller's; the strip owns no source,
	 * selection, Camera or history. Words, not symbols, carry each state (the scoped
	 * name, "Object Studio", the context, the way back), and every control is a real
	 * button with a coarse-pointer target.
	 */
	import type { StudioContext, StudioOrigin, StudioPhase } from './studio-model';

	let {
		phase,
		origin,
		context,
		name,
		rootCount,
		onContext,
		onNewObject,
		onChoose,
		onBackToWorld,
		onBackToProjects,
		onOpenInWorld,
		onPlaceCopy,
		placingCopy = false
	}: {
		phase: StudioPhase;
		origin: StudioOrigin;
		context: StudioContext;
		name: string | null;
		rootCount: number;
		onContext: (next: StudioContext) => void;
		onNewObject: () => void;
		onChoose: () => void;
		onBackToWorld: () => void;
		onBackToProjects: () => void;
		onOpenInWorld: () => void;
		/** Standalone only: send a copy of this object to another project's World. */
		onPlaceCopy?: () => void;
		placingCopy?: boolean;
	} = $props();

	const title = $derived(
		phase.kind === 'active'
			? (name ?? 'Object')
			: phase.kind === 'empty'
				? 'New object'
				: phase.kind === 'unavailable'
					? 'Object unavailable'
					: phase.kind === 'choose'
						? 'Choose an object'
						: 'No editable objects'
	);
</script>

<div class="studio-strip" role="region" aria-label="Object Studio" data-studio-strip data-phase={phase.kind}>
	<div class="who">
		<span class="mode">Object Studio</span>
		<strong class="name" data-studio-name>{title}</strong>
	</div>
	<div class="segment" role="group" aria-label="Context">
		<button type="button" aria-pressed={context === 'world'} data-studio-context="world" onclick={() => onContext('world')}>
			World
		</button>
		<button type="button" aria-pressed={context === 'mat'} data-studio-context="mat" onclick={() => onContext('mat')}>
			Mat
		</button>
	</div>
	<div class="actions">
		<button type="button" data-studio-action="new-object" onclick={onNewObject}>New object here</button>
		{#if rootCount > 1 || (phase.kind === 'unavailable' && rootCount > 0)}
			<button type="button" data-studio-action="choose" onclick={onChoose}>Choose object</button>
		{/if}
		{#if origin === 'world'}
			<button type="button" class="primary" data-studio-action="back-to-world" onclick={onBackToWorld}>
				Back to World
			</button>
		{:else}
			<button type="button" data-studio-action="open-in-world" onclick={onOpenInWorld}>Open in World</button>
			{#if onPlaceCopy !== undefined && phase.kind === 'active'}
				<button type="button" data-studio-action="place-copy" disabled={placingCopy} onclick={onPlaceCopy}>
					{placingCopy ? 'Saving…' : 'Place copy in World'}
				</button>
			{/if}
			<button type="button" class="primary" data-studio-action="back-to-projects" onclick={onBackToProjects}>
				Back to Projects
			</button>
		{/if}
	</div>
</div>

<style>
	.studio-strip {
		position: absolute;
		top: calc(var(--shell-head-height) + 8px);
		left: 50%;
		z-index: 31;
		transform: translateX(-50%);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 14px;
		max-width: min(46rem, calc(100% - 1.5rem));
		padding: 6px 8px 6px 14px;
		border: 1px solid var(--shell-hairline);
		border-radius: 14px;
		background: var(--shell-popover);
		box-shadow: var(--shell-shadow);
		color: var(--shell-ink);
		font-size: 12.5px;
	}
	.who {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
	}
	.mode {
		color: var(--shell-ink-3);
		font-size: 11.5px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.name {
		max-width: 16rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.segment {
		display: inline-flex;
		border: 1px solid var(--shell-field-line);
		border-radius: 9px;
		overflow: hidden;
	}
	.segment button {
		border: 0;
		border-radius: 0;
	}
	.segment button[aria-pressed='true'] {
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
		font-weight: 650;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-left: auto;
	}
	button {
		min-height: 30px;
		padding: 4px 10px;
		border: 1px solid var(--shell-field-line);
		border-radius: 9px;
		background: var(--shell-field);
		color: inherit;
		font: inherit;
		cursor: pointer;
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
			padding: 6px 14px;
		}
	}
	@media (max-width: 640px) {
		/* A phone's Card owns the top: the strip rides above the dock instead of covering it. */
		.studio-strip {
			top: auto;
			bottom: calc(76px + env(safe-area-inset-bottom, 0px));
			width: calc(100% - 1rem);
		}
		.actions {
			margin-left: 0;
			width: 100%;
		}
	}
</style>
