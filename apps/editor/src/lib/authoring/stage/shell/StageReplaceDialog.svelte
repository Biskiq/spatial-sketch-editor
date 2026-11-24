<script lang="ts">
	import type { StageReplaceDialogView } from '../../workspace/protocol';
	import './stage-boot-panel.css';

	let { pendingReplacement, runReplacement, cancelReplacement }: StageReplaceDialogView = $props();
</script>

{#if pendingReplacement !== null}
	<div class="boot-panel" role="alertdialog" aria-label="Replace project">
		<h1>Replace the current project?</h1>
		<p>This cancels pending work and clears selection and task before swapping to the new baseline.</p>
		<button type="button" class="primary" onclick={() => void runReplacement(pendingReplacement!)}>Replace</button>
		<button type="button" onclick={cancelReplacement}>Cancel</button>
	</div>
{/if}
