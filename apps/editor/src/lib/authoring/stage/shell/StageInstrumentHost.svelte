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
	 * It is deliberately bounded and pinned to the Stage's lower edge, so opening,
	 * closing or resizing it never reflows or implicitly reframes the Stage. It is a
	 * home for one task, not a second shell owner: it renders no control layout of
	 * its own beyond naming, hosting and closing.
	 */
	import type { Snippet } from 'svelte';

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
		instrument?: { summary: string; facts?: readonly { label: string; value: string }[] } | null;
		children?: Snippet;
	} = $props();
</script>

{#if task}
	<section class="instrument" aria-label={`${task.label} task`} data-stage-instrument={task.kind}>
		<header class="instrument-head">
			<div class="identity">
				<span class="eyebrow">World Instrument</span>
				<h2 class="title">{task.label}</h2>
			</div>
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
				<p class="contributed-summary">{instrument.summary}</p>
				{#if instrument.facts && instrument.facts.length > 0}
					<dl class="contributed-facts">
						{#each instrument.facts as fact (fact.label)}
							<dt>{fact.label}</dt>
							<dd>{fact.value}</dd>
						{/each}
					</dl>
				{/if}
			{:else if children}
				{@render children()}
			{/if}
		</div>
	</section>
{/if}

<style>
	.instrument {
		position: absolute;
		left: 50%;
		bottom: 0.75rem;
		transform: translateX(-50%);
		z-index: 6;
		display: flex;
		flex-direction: column;
		width: max-content;
		max-width: calc(100% - 1.5rem);
		max-height: min(16rem, 45%);
		border: 1px solid #4d4655;
		border-radius: 0.5rem 0.5rem 0 0;
		background: rgb(25 24 31 / 96%);
		box-shadow: 0 -0.5rem 1.5rem rgb(0 0 0 / 35%);
		color: #f4f0e9;
		font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	.instrument-head {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid #383340;
	}

	.identity {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.1rem;
	}

	.eyebrow {
		color: #c9a9ff;
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.title {
		margin: 0;
		font-size: 0.92rem;
		font-weight: 600;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.target {
		display: flex;
		min-width: 0;
		align-items: baseline;
		gap: 0.4rem;
		margin: 0;
		font-size: 0.78rem;
	}

	.target-key {
		color: #8f8a99;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.62rem;
		font-weight: 700;
	}

	.target-value {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: #e7e4dd;
	}

	.close {
		margin-left: auto;
		padding: 0.2rem 0.45rem;
		border: 1px solid #635a6f;
		border-radius: 0.35rem;
		background: #292632;
		color: inherit;
		font: inherit;
		line-height: 1;
		cursor: pointer;
	}

	.close:hover {
		border-color: #c9a9ff;
	}

	.close:focus-visible {
		outline: 2px solid #2f8cff;
		outline-offset: 1px;
	}

	.instrument-body {
		min-height: 0;
		overflow: auto;
		padding: 0.75rem;
	}

	.contributed-summary {
		margin: 0;
		font-size: 0.8rem;
	}

	.contributed-facts {
		display: grid;
		grid-template-columns: minmax(6rem, auto) 1fr;
		gap: 0.15rem 0.7rem;
		margin: 0.55rem 0 0;
		font-size: 0.78rem;
	}

	.contributed-facts dt {
		color: #8f8a99;
	}

	.contributed-facts dd {
		margin: 0;
	}

	.instrument-body :global(:first-child) {
		margin-top: 0;
	}

	.instrument-body :global(:last-child) {
		margin-bottom: 0;
	}
</style>
