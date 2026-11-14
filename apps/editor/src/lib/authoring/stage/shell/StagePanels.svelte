<script lang="ts">
	/**
	 * X3 / decomposition contract S — the Stage panels region.
	 *
	 * The Index (and its constrained scrim), the one selection Card, the parked
	 * task notice and the Keys reference move here as one region. They remain
	 * their own owners:
	 *
	 * - `EditorIndex` reads the world-index model and the Experience Index groups;
	 * - `EditorCard` is the one selection Card, with its own writers and actions;
	 * - the parked-task notice runs the facade's existing resume/close commands;
	 * - Keys reads the dock's own shortcut map.
	 *
	 * The region owns only the keyboard focus it moves into the Keys panel and the
	 * scrim's close command. Every value is a typed read or named command.
	 */
	import type { ComponentProps } from 'svelte';
	import EditorCard from './EditorCard.svelte';
	import EditorIndex from './EditorIndex.svelte';
	import { STAGE_DOCK_SHORTCUTS } from '../stage-input';

	type IndexProps = ComponentProps<typeof EditorIndex>;
	type CardProps = ComponentProps<typeof EditorCard>;

	let {
		previewing,
		index,
		scrim = false,
		card,
		inactiveTask = null,
		keysOpen = false,
		onCloseScrim,
		onResumeTask,
		onCloseTask,
		onCloseKeys
	}: {
		readonly previewing: boolean;
		readonly index: IndexProps;
		readonly scrim?: boolean;
		readonly card: CardProps;
		readonly inactiveTask?: { readonly label: string } | null;
		readonly keysOpen?: boolean;
		readonly onCloseScrim?: () => void;
		readonly onResumeTask?: () => void;
		readonly onCloseTask?: () => void;
		readonly onCloseKeys?: () => void;
	} = $props();

	function focusOnOpen(node: HTMLElement) {
		node.focus();
	}
</script>

{#if !previewing}
	<EditorIndex {...index} />
{/if}
<!--
	R217.S23 — at a constrained width an open Index is a sheet over the Stage. Its
	scrim is an explicit, bounded close target: it covers the Stage above the lower
	column's measured span and sits beneath the dock, palette, drafting controls and
	Card, so every one of them stays usable behind the sheet.
-->
{#if !previewing && scrim}
	<button
		type="button"
		class="index-scrim"
		tabindex="-1"
		aria-label="Close the Index"
		data-index-scrim
		onclick={() => onCloseScrim?.()}
	></button>
{/if}

<EditorCard {...card} />

{#if !previewing && inactiveTask !== null}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<div
		class="inactive-task"
		role="region"
		aria-label="Inactive task"
		onpointerdown={(event) => event.stopPropagation()}
		onclick={(event) => event.stopPropagation()}
	>
		<p aria-live="polite">{inactiveTask.label} is inactive. Resume to continue, or close it.</p>
		<button type="button" onclick={() => onResumeTask?.()}>Resume {inactiveTask.label}</button>
		<button type="button" onclick={() => onCloseTask?.()}>Close inactive task</button>
	</div>
{/if}

{#if !previewing && keysOpen}
	<!--
		R217.S20: the Keys reference, opened from Find. Its rows read the dock's
		own shortcut map, so the list cannot drift from the keys that work.
	-->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<section
		class="keys-panel"
		aria-labelledby="keys-panel-title"
		data-keys-panel
		tabindex="-1"
		use:focusOnOpen
		onclick={(event) => event.stopPropagation()}
		onpointerdown={(event) => event.stopPropagation()}
		onkeydown={(event) => {
			if (event.key !== 'Escape') return;
			event.stopPropagation();
			onCloseKeys?.();
		}}
	>
		<h2 id="keys-panel-title">Keys</h2>
		<dl>
			<div><dt>⌘K · Ctrl+K</dt><dd>Find a subject, tool or operation</dd></div>
			<div><dt>3 · 2</dt><dd>3D and 2D readings</dd></div>
			<div><dt>F</dt><dd>Fit</dd></div>
			<div>
				<dt>
					{STAGE_DOCK_SHORTCUTS.select} · {STAGE_DOCK_SHORTCUTS.ink} · {STAGE_DOCK_SHORTCUTS.measure} ·
					{STAGE_DOCK_SHORTCUTS.erase} · {STAGE_DOCK_SHORTCUTS.library}
				</dt>
				<dd>Select · Ink · Measure · Eraser · Objects</dd>
			</div>
			<div><dt>Esc</dt><dd>Cancel the current step</dd></div>
		</dl>
		<button type="button" onclick={() => onCloseKeys?.()}>Close keys</button>
	</section>
{/if}

<style>
	/* The Index covers the Stage without participating in viewport layout. */
	:global(.editor-body) > :global(.plate-index) {
		position: absolute;
		z-index: 20;
		inset: 0 auto 0 0;
		box-shadow: 0 0.5rem 1.25rem rgb(6 20 14 / 35%);
	}
	/* The constrained Index ends above the lower column and has a close scrim. */
	@media (max-width: 1100px) {
		:global(.editor-body) > :global(.plate-index) {
			/* Keep the dock's measured span, but never trust a stale zero reading. */
			bottom: calc(0.75rem + var(--lower-column-height, 0px) + 0.5rem);
			bottom: calc(0.75rem + max(var(--lower-column-height, 0px), 166px) + 0.5rem);
			width: min(var(--shell-index-width), 80%);
		}
		/*
			The scrim covers the Stage above the lower column and beneath it: the dock, the
			palette, the drafting controls and the Card all stack above it (z-index 6 to 12).
			Its tint is the forest chassis role, so the Stage reads as dimmed, not as a second
			surface.
		*/
		.index-scrim {
			position: absolute;
			z-index: 5;
			top: 0;
			right: 0;
			bottom: calc(0.75rem + var(--lower-column-height, 0px));
			left: 0;
			margin: 0;
			padding: 0;
			border: 0;
			background: rgb(0 0 0 / 0.12);
			cursor: pointer;
		}
		.index-scrim:focus-visible {
			outline: none;
		}
	}
	/*
		R217.S20: the Keys reference Find opens. It sits where the stage's top-right
		action used to be, clear of the Height Sheet, and takes no pointer outside itself.
	*/
	.keys-panel {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		z-index: 9;
		display: grid;
		gap: 0.5rem;
		width: min(20rem, calc(100% - 1.5rem));
		padding: 0.75rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.4rem;
		background: var(--shell-forest);
		color: var(--shell-ink-light);
		box-shadow: 0 0.6rem 1.4rem rgb(6 20 14 / 40%);
		font-family: var(--shell-sans);
		font-size: var(--shell-text-body);
	}
	.keys-panel:focus-visible {
		outline: var(--shell-focus-ring);
		outline-offset: 2px;
	}
	.keys-panel h2 {
		margin: 0;
		font-size: var(--shell-text-body);
		font-weight: 600;
	}
	.keys-panel dl {
		display: grid;
		gap: 0.3rem;
		margin: 0;
	}
	.keys-panel dl > div {
		display: grid;
		grid-template-columns: 7.5rem 1fr;
		gap: 0.5rem;
	}
	.keys-panel dt {
		font-family: var(--shell-mono);
		font-size: var(--shell-text-utility);
		color: var(--shell-leaf-soft);
		font-variant-numeric: tabular-nums;
	}
	.keys-panel dd {
		margin: 0;
		font-size: var(--shell-text-utility);
		color: var(--shell-ink-quiet);
	}
	.keys-panel button {
		justify-self: start;
		min-height: var(--shell-control-height);
		padding: 0 0.6rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.35rem;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	/*
	 * Parked-task notice. It sits at the top-left because the lower edge already
	 * belongs to the instrument and the selection Card, and it must never be covered
	 * by another control: Resume is the only way back into a parked task.
	 */
	.inactive-task {
		position: absolute;
		/* Below the toolbar band: at a narrow width the two would overlap and this
		   panel would cover the only reading controls. */
		top: 3.5rem;
		left: 1rem;
		z-index: 9;
		max-width: min(22rem, calc(100% - 2rem));
		padding: 0.75rem;
		box-sizing: border-box;
		background: var(--shell-popup-dark);
		border: 1px solid var(--shell-line-on-forest);
	}
</style>
