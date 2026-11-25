<script lang="ts">
	import { LAYOUT_DIMENSION_LIMIT_MESSAGE } from '@portfolio/layout-core';
	import { STARTER_TEMPLATES } from '../starter-gallery';
	import type { StageBootPanelView } from '../../workspace/protocol';
	import './stage-boot-panel.css';

	let { boot, repair, transferName, runReplacement, returnToObject }: StageBootPanelView = $props();
	let bootRepairInput: HTMLInputElement | undefined = $state(undefined);
</script>

{#if boot.status === 'new'}
	<div class="boot-panel" role="dialog" aria-label="Start a project">
		<h1>Start this project</h1>
		<p>Choose the canonical starter gallery, or begin genuinely empty.</p>
		{#each STARTER_TEMPLATES as template (template.id)}
			<button type="button" class="primary" onclick={() => void runReplacement('starter')}>{template.label}</button>
		{/each}
		<button type="button" onclick={() => void runReplacement('empty')}>Begin empty</button>
	</div>
{:else if boot.status !== 'ready' && boot.status !== 'empty'}
	<div class="boot-panel" role="status" aria-live="polite">
		{#if boot.status === 'loading'}
			<span class="boot-brand">Biskiq Editor</span>
			<p class="boot-loading">Loading project…</p>
		{:else if boot.status === 'missing'}
			<h1>Project not found</h1>
			<p>This project does not exist for your account.</p>
		{:else if boot.status === 'forbidden'}
			<h1>Sign-in required</h1>
			<p>This project belongs to another session.</p>
		{:else if boot.status === 'refused'}
			<h1>Unsupported project source</h1>
			<p>
				{boot.reason === 'dimension-limit'
					? LAYOUT_DIMENSION_LIMIT_MESSAGE
					: boot.reason === 'invalid-json'
						? 'The source JSON did not parse.'
						: boot.reason === 'project-mismatch'
							? 'That source belongs to another project.'
							: 'The source is not the current document format.'}
			</p>
			<ul>
				{#each boot.issues.slice(0, 5) as issue (issue.path + issue.code)}
					<li>{issue.path}: {issue.message}</li>
				{/each}
			</ul>
		{:else if boot.status === 'diagnostics'}
			<h1>Canonical compile blocked</h1>
			<p>The source validated, but its canonical compile has blocking issues.</p>
			<ul>
				{#each boot.issues.slice(0, 5) as issue (issue.path + issue.code)}
					<li>{issue.path}: {issue.message}</li>
				{/each}
			</ul>
		{:else if boot.status === 'error'}
			<h1>Project unavailable</h1>
			<p>{boot.message}</p>
			{#if boot.image !== undefined && boot.image.expectedPin !== null && boot.image.savedBase !== null}
				<input
					bind:this={bootRepairInput}
					type="file"
					accept="image/*"
					style="display:none"
					onchange={(event) => void repair.onFileChosen(event)}
				/>
				<button
					type="button"
					class="primary"
					disabled={repair.busy}
					data-boot-repair-image
					onclick={() => {
						if (bootRepairInput !== undefined) {
							bootRepairInput.value = '';
							bootRepairInput.click();
						}
					}}
				>
					{repair.busy ? 'Repairing…' : 'Repair with the original file…'}
				</button>
				{#if repair.error !== null}
					<p role="alert" data-boot-repair-error>{repair.error}</p>
				{/if}
			{/if}
		{/if}
		{#if transferName !== null && boot.status !== 'loading'}
			<!-- A destination that will not load never strands the saved object. -->
			<p>Your copy of <strong>{transferName}</strong> is saved in My Objects.</p>
			<button type="button" onclick={() => window.location.reload()}>Try again</button>
			<button type="button" class="primary" data-transfer-action="return" onclick={returnToObject}>Return to object</button>
			<a href="/projects">Back to Projects</a>
		{/if}
	</div>
{/if}
