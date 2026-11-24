<script lang="ts">
	/**
	 * Appearance surfaces shared with every workspace: the issues drawer. Its
	 * own mount condition (`preview === null`) lives here, verbatim.
	 */
	import StageRepairDrawer from '../stage/shell/StageRepairDrawer.svelte';
	import type { RepairProps } from './appearance-view';

	let { previewing = false, repair = null }: {
		readonly previewing?: boolean;
		readonly repair?: RepairProps | null;
	} = $props();
</script>

{#if !previewing && repair !== null}
	<StageRepairDrawer {...repair} />
{/if}
