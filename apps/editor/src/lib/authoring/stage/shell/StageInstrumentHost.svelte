<script lang="ts">
	/**
	 * StageInstrumentHost — the **invoked task instrument** home.
	 *
	 * One instrument appears because work is invoked, never merely because a
	 * selected subject has advanced capabilities: with no task this component
	 * renders nothing at all. When a task is present it names the procedure and its
	 * technical target — which may differ from the canonical selection (an Opening
	 * stays selected while its host Wall is unrolled) — and hosts that task's own
	 * content through the `children` snippet.
	 *
	 * R217.S23 — the instrument is one row above the dock. It draws the dock's
	 * material (forest, hairline edge, no caption) rather than a titled panel: the
	 * procedure name, the target and Close share a single slim head, and the adapter's
	 * content sits beneath it. The adapter's summary and facts stay on the head's
	 * tooltip, so the row carries no text-heavy block of its own.
	 *
	 * It is deliberately bounded: the shell's one lower column anchors it above the
	 * dock, so opening, closing or resizing it never reflows or implicitly reframes
	 * the Stage. It is a home for one task, not a second shell owner: it renders no
	 * control layout of its own beyond naming, hosting and closing.
	 */
	import type { Snippet } from 'svelte';
	import type { StageInstrumentContent } from '../stage-facade';

	let {
		task,
		onClose,
		instrument = null,
		children
	}: {
		task: { kind: string; label: string; targetLabel: string | null } | null;
		onClose: () => void;
		/**
		 * Content an owning adapter contributes for this task. It is mounted in this one
		 * instrument home, so a domain adapter's task appears without a shell edit; the
		 * host's own snippet stays the default when no adapter contributed content.
		 */
		instrument?: StageInstrumentContent | null;
		children?: Snippet;
	} = $props();

	/** The adapter's own name for the task, when it contributed one. */
	const heading = $derived(instrument?.summary ?? task?.label ?? '');
	/** The adapter's facts, read on hover and in the accessible description. */
	const factsText = $derived(
		instrument?.facts?.map((fact) => `${fact.label}: ${fact.value}`).join('. ') ?? ''
	);
</script>

{#if task}
	<section class="instrument" aria-label={`${task.label} task`} data-stage-instrument={task.kind}>
		<header class="instrument-head">
			<h2 class="title" title={factsText === '' ? undefined : factsText}>{heading}</h2>
			{#if task.targetLabel}
				<p class="target" title={task.targetLabel}>
					<span class="target-key">Target</span>
					<span class="target-value">{task.targetLabel}</span>
				</p>
			{/if}
			<button type="button" class="close" aria-label={`Close ${task.label}`} onclick={onClose}>
				<span aria-hidden="true">✕</span>
			</button>
		</header>
		<div class="instrument-body">
			{#if instrument}
				{#if instrument.view}
					<instrument.view.component services={instrument.view.services} />
				{/if}
			{:else if children}
				{@render children()}
			{/if}
		</div>
	</section>
{/if}

<style>
	/*
		The lower column owns the anchoring (it is the one place the dock and this
		instrument meet), so the instrument is an ordinary flex child: it stacks above
		the dock without a second absolute position of its own. Its surface is the
		dock's forest material from the shell roles; no literal colour is drawn here.
	*/
	.instrument {
		display: flex;
		box-sizing: border-box;
		flex-direction: column;
		width: max-content;
		max-width: 100%;
		max-height: min(24rem, 60vh);
		border: 1px solid var(--shell-hairline, #2f4a3d);
		border-radius: 0.6rem;
		background: var(--shell-forest, #11291f);
		box-shadow: 0 0.5rem 1.5rem rgb(6 20 14 / 45%);
		color: var(--shell-ink-light, #f3f4ee);
		font-family: var(--shell-sans, Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif);
		font-size: var(--shell-text-utility, 12px);
	}

	.instrument-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		padding: 0.1rem 0.2rem 0.1rem 0.5rem;
		border-bottom: 1px solid var(--shell-hairline, #2f4a3d);
	}

	.title {
		margin: 0;
		min-width: 0;
		overflow: hidden;
		font-size: var(--shell-text-utility, 12px);
		font-weight: 600;
		line-height: 1.3;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.target {
		display: flex;
		min-width: 0;
		align-items: baseline;
		gap: 0.35rem;
		margin: 0;
	}

	.target-key {
		flex: none;
		color: var(--shell-ink-quiet, #9fb2a2);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.target-value {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.close {
		flex: none;
		min-width: 1.5rem;
		min-height: 1.5rem;
		margin-left: auto;
		padding: 0 0.35rem;
		border: 1px solid var(--shell-ink-quiet, #9fb2a2);
		border-radius: 0.35rem;
		background: var(--shell-forest-raised, #22503c);
		color: var(--shell-ink-light, #f3f4ee);
		font: inherit;
		line-height: 1;
		cursor: pointer;
	}

	.close:hover {
		border-color: var(--shell-ink-light, #f3f4ee);
	}

	.close:focus-visible {
		outline: 2px solid var(--shell-gold, #d4ad45);
		outline-offset: 1px;
	}

	.instrument-body {
		display: flex;
		min-height: 0;
		flex-direction: column;
		gap: 0.3rem;
		overflow: auto;
		padding: 0.3rem 0.45rem 0.4rem;
	}

	.instrument-body :global(:first-child) {
		margin-top: 0;
	}

	.instrument-body :global(:last-child) {
		margin-bottom: 0;
	}

	/* Coarse pointer: the close control reaches the 44 × 44 CSS px touch target. */
	@media (pointer: coarse) {
		.close {
			min-width: var(--shell-touch-target, 44px);
			min-height: var(--shell-touch-target, 44px);
		}
	}
</style>
