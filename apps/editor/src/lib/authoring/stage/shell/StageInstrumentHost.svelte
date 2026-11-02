<script module lang="ts">
	/** Each mounted host takes its own id, so the description references never collide. */
	let instances = 0;
</script>

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
	 * content sits beneath it. The adapter's facts are not hover-only. They are the
	 * instrument's accessible description (`aria-describedby` on the section and on the
	 * info control), and an info control reveals them as a visible list for keyboard,
	 * touch and sighted users alike.
	 *
	 * It is deliberately bounded: the shell's one lower column anchors it above the
	 * dock, so opening, closing or resizing it never reflows or implicitly reframes
	 * the Stage. It is a home for one task, not a second shell owner: it renders no
	 * control layout of its own beyond naming, describing, hosting and closing.
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

	instances += 1;
	const instanceId = `stage-instrument-${instances}`;
	const descriptionId = `${instanceId}-description`;
	const aboutId = `${instanceId}-about`;
	let aboutOpen = $state(false);

	/** The adapter's own name for the task, when it contributed one. */
	const heading = $derived(instrument?.summary ?? task?.label ?? '');
	/** The adapter's facts, as the instrument's accessible description and its info list. */
	const facts = $derived(instrument?.facts ?? []);
	const factsText = $derived(facts.map((fact) => `${fact.label}: ${fact.value}`).join('. '));
</script>

{#if task}
	<section
		class="instrument"
		aria-label={`${task.label} task`}
		aria-describedby={facts.length > 0 ? descriptionId : undefined}
		data-stage-instrument={task.kind}
	>
		<header class="instrument-head">
			<h2 class="title">{heading}</h2>
			{#if task.targetLabel}
				<p class="target" title={task.targetLabel}>
					<span class="target-key">Target</span>
					<span class="target-value">{task.targetLabel}</span>
				</p>
			{/if}
			{#if facts.length > 0}
				<button
					type="button"
					class="about"
					aria-label={`About ${heading}`}
					aria-expanded={aboutOpen}
					aria-controls={aboutId}
					aria-describedby={descriptionId}
					onclick={() => (aboutOpen = !aboutOpen)}
				>
					<span aria-hidden="true">i</span>
				</button>
			{/if}
			<button type="button" class="close" aria-label={`Close ${task.label}`} onclick={onClose}>
				<span aria-hidden="true">✕</span>
			</button>
		</header>
		{#if facts.length > 0}
			<p id={descriptionId} class="sr-only">{factsText}</p>
			{#if aboutOpen}
				<dl id={aboutId} class="about-facts">
					{#each facts as fact (fact.label)}
						<dt>{fact.label}</dt>
						<dd>{fact.value}</dd>
					{/each}
				</dl>
			{/if}
		{/if}
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

	.about,
	.close {
		flex: none;
		min-width: 1.5rem;
		min-height: 1.5rem;
		padding: 0 0.35rem;
		border: 1px solid var(--shell-ink-quiet, #9fb2a2);
		border-radius: 0.35rem;
		background: var(--shell-forest-raised, #22503c);
		color: var(--shell-ink-light, #f3f4ee);
		font: inherit;
		line-height: 1;
		cursor: pointer;
	}

	.about {
		font-weight: 700;
	}

	.about[aria-expanded='true'] {
		border-color: var(--shell-ink-light, #f3f4ee);
	}

	.close {
		margin-left: auto;
	}

	.about:hover,
	.close:hover {
		border-color: var(--shell-ink-light, #f3f4ee);
	}

	.about:focus-visible,
	.close:focus-visible {
		outline: 2px solid var(--shell-gold, #d4ad45);
		outline-offset: 1px;
	}

	/* The facts as a visible list, opened by the info control; the same words are the description. */
	.about-facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.2rem 0.6rem;
		margin: 0;
		padding: 0.35rem 0.6rem;
		border-bottom: 1px solid var(--shell-hairline, #2f4a3d);
		font-size: var(--shell-text-utility, 12px);
	}

	.about-facts dt {
		color: var(--shell-ink-quiet, #9fb2a2);
	}

	.about-facts dd {
		margin: 0;
	}

	/* Read by assistive technology through aria-describedby; not drawn. */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
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

	/* Coarse pointer: the info and close controls reach the 44 × 44 CSS px touch target. */
	@media (pointer: coarse) {
		.about,
		.close {
			min-width: var(--shell-touch-target, 44px);
			min-height: var(--shell-touch-target, 44px);
		}
	}
</style>
