<script lang="ts">
	/**
	 * X3 / decomposition contract S — the project notices region.
	 *
	 * A pending Save and the admitted source's findings are chrome over the
	 * project, not the Stage: they used to be route markup. The region reads the
	 * records its composition root passes and runs only its named commands
	 * (`Resume`, `Discard`, `Show`, `Copy details`). It owns no source, Save or
	 * selection state and never repairs a finding.
	 */
	import type { ExperienceProblem } from '$lib/authoring/experience/experience-problems';

	export type StageSourceFindings = {
		readonly diagnostics: readonly unknown[];
		readonly closure: readonly { readonly path: string; readonly code: string; readonly message: string }[];
	};

	let {
		resumeOffer = false,
		onResume,
		onDiscard,
		sourceFindings = null,
		sourceProblems = [],
		previewProblem = null,
		onShowProblem
	}: {
		readonly resumeOffer?: boolean;
		readonly onResume?: () => void;
		readonly onDiscard?: () => void;
		readonly sourceFindings?: StageSourceFindings | null;
		readonly sourceProblems?: readonly ExperienceProblem[];
		readonly previewProblem?: ExperienceProblem | null;
		readonly onShowProblem?: (problem: ExperienceProblem) => void;
	} = $props();

	const shownProblems = $derived(
		previewProblem === null ? sourceProblems : [previewProblem, ...sourceProblems]
	);
</script>

{#if resumeOffer}
	<div class="resume-offer" role="region" aria-label="Pending cloud save">
		<p>
			A cloud Save was captured before sign-in. Resuming mounts your captured work and
			replays that exact Save — it is never applied automatically.
		</p>
		<button type="button" class="primary" onclick={onResume}>Resume pending Save</button>
		<button type="button" onclick={onDiscard}>Discard captured Save</button>
	</div>
{/if}

{#if sourceFindings !== null || sourceProblems.length > 0 || previewProblem !== null}
	<!--
		Experience review 1: source problems are a quiet chip, not a page banner.
		The creator reads a plain sentence and uses *Show* to open the Stop's
		Transition Card; ids, paths and codes stay in *Copy details*.
	-->
	<details
		class="source-findings"
		class:blocking={(sourceFindings?.closure.length ?? 0) > 0}
		aria-label="Source findings"
	>
		<summary>
			{#if (sourceFindings?.closure.length ?? 0) > 0}
				<strong>This project can't be saved yet.</strong> Something it needs is missing.
			{:else}
				<strong>{sourceProblems.length + (previewProblem === null ? 0 : 1)} to review</strong>
				{previewProblem === null
					? 'This file needs attention before every move plays.'
					: 'Preview cannot start from this file.'}
			{/if}
			<span class="source-findings-more">Details</span>
		</summary>
		<ul>
			{#each shownProblems.slice(0, 8) as problem (problem.code + problem.detail)}
				<li data-finding-code={problem.code}>
					<span
						>{problem.sentence}{#if problem.fix}<span class="source-problem-fix">{problem.fix}</span>{/if}</span
					>
					{#if problem.subject !== null}
						<button type="button" class="source-problem-show" onclick={() => onShowProblem?.(problem)}
							>Show</button
						>
					{/if}
				</li>
			{/each}
			{#each (sourceFindings?.closure ?? []).slice(0, 8) as finding (finding.path + finding.code)}
				<li data-finding-code={finding.code}>{finding.message}</li>
			{/each}
		</ul>
		<button
			type="button"
			onclick={() =>
				void navigator.clipboard?.writeText(
					shownProblems
						.map((problem) => problem.detail)
						.concat(
							(sourceFindings?.closure ?? []).map(
								(finding) => `${finding.path}: ${finding.message} (${finding.code})`
							)
						)
						.join('\n')
				)}>Copy details</button
		>
	</details>
{/if}

<style>
	.resume-offer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 1rem;
		border-bottom: 1px solid var(--shell-hairline-dark);
		background: var(--shell-forest-raised);
		color: var(--shell-ink-light);
	}
	.resume-offer p {
		flex: 1 1 22rem;
		margin: 0;
		line-height: 1.4;
	}
	.resume-offer button {
		padding: 0.45rem 0.7rem;
		border: 1px solid var(--shell-line-on-forest);
		border-radius: 0.35rem;
		background: var(--shell-forest-raised);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.resume-offer button.primary {
		border-color: transparent;
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
	}
	.source-findings {
		position: absolute;
		top: calc(var(--shell-head-height) + 8px);
		left: 50%;
		z-index: 30;
		transform: translateX(-50%);
		max-width: min(32rem, calc(100% - 2rem));
		padding: 6px 12px;
		border: 1px solid var(--shell-hairline);
		border-radius: 12px;
		background: var(--shell-popover);
		box-shadow: var(--shell-shadow);
		color: var(--shell-ink);
		font-size: 12.5px;
	}
	.source-findings summary {
		display: flex;
		gap: 6px;
		align-items: baseline;
		cursor: pointer;
		list-style: none;
	}
	.source-findings strong {
		color: var(--shell-ink);
	}
	.source-findings.blocking strong {
		color: var(--shell-caution);
	}
	.source-findings-more {
		margin-left: auto;
		color: var(--shell-ink-3);
		text-decoration: underline;
	}
	.source-findings ul {
		margin: 6px 0 4px 1rem;
		padding: 0;
		color: var(--shell-ink-2);
	}
	.source-findings button {
		border: 1px solid var(--shell-field-line);
		border-radius: 8px;
		background: var(--shell-field);
		padding: 3px 9px;
		font: inherit;
		cursor: pointer;
	}
</style>
