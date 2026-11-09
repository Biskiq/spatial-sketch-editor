<script module lang="ts">
	/** Each mounted host takes its own id, so the description references never collide. */
	let instances = 0;
</script>

<script lang="ts">
	/** One contributed home: a Dock-anchored palette or an invoked instrument. The adapter keeps its controller. */
	import type { Snippet } from 'svelte';
	import type { StageInstrumentContent } from '../stage-facade';

	let {
		task,
		onClose,
		instrument = null,
		children,
		onCollapse = onClose
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
		onCollapse?: () => void;
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
		class:palette={instrument?.presentation === 'palette'}
		aria-label={`${task.label} task`}
		aria-describedby={facts.length > 0 ? descriptionId : undefined}
		data-stage-instrument={task.kind}
	>
		{#if instrument?.presentation !== 'palette'}
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
		{#if instrument?.presentation === 'palette'}<button
				type="button"
				class="collapse"
				aria-label="Collapse palette"
				onclick={onCollapse}>⌄</button
			>{/if}
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
		width: min(480px, 100%);
		max-width: 100%;
		max-height: min(24rem, 60vh);
		border: 1px solid var(--shell-line-on-forest);
		border-radius: 12px;
		background: var(--shell-forest);
		box-shadow: 0 0.5rem 1.5rem rgb(6 20 14 / 45%);
		color: var(--shell-ink-light);
		font-family: var(--shell-sans);
		font-size: var(--shell-text-utility);
	}

	.instrument-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		padding: 0.1rem 0.2rem 0.1rem 0.5rem;
		border-bottom: 1px solid var(--shell-line-on-forest);
	}

	.title {
		margin: 0;
		min-width: 0;
		overflow: hidden;
		font-size: var(--shell-text-utility);
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
		color: var(--shell-ink-quiet);
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
		border: 1px solid var(--shell-ink-quiet);
		border-radius: 0.35rem;
		background: var(--shell-forest-raised);
		color: var(--shell-ink-light);
		font: inherit;
		line-height: 1;
		cursor: pointer;
	}

	.about {
		font-weight: 700;
	}

	.about[aria-expanded='true'] {
		border-color: var(--shell-ink-light);
	}

	.close {
		margin-left: auto;
	}

	.about:hover,
	.close:hover {
		border-color: var(--shell-ink-light);
	}

	.about:focus-visible,
	.close:focus-visible {
		outline: var(--shell-focus-ring);
		outline-offset: 1px;
	}

	/* The facts as a visible list, opened by the info control; the same words are the description. */
	.about-facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.2rem 0.6rem;
		margin: 0;
		padding: 0.35rem 0.6rem;
		border-bottom: 1px solid var(--shell-line-on-forest);
		font-size: var(--shell-text-utility);
	}

	.about-facts dt {
		color: var(--shell-ink-quiet);
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
			min-width: var(--shell-touch-target);
			min-height: var(--shell-touch-target);
		}
	}
	.palette {
		width: 42px;
		padding: 4px 4px 2px;
		overflow: visible;
		max-height: none;
		background: var(--shell-dock-surface);
		box-shadow: 0 10px 24px #0004;
	}
	.palette .instrument-body {
		overflow: visible;
		padding: 0;
	}
	.collapse {
		width: 32px;
		height: 16px;
		border: 0;
		margin-top: 1px;
		padding: 0;
		border-radius: 6px;
		color: var(--shell-ink-light);
		background: transparent;
		cursor: pointer;
	}
	@media (pointer: coarse) {
		.palette {
			width: 54px;
		}
		.collapse {
			width: 44px;
			min-height: 44px;
		}
	}
</style>
