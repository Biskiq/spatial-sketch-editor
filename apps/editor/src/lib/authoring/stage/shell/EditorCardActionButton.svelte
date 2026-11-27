<script lang="ts">
	import type { StageCardActionRecord } from '../stage-facade';

	let { action, actionBusy, onRunAction }: {
		action: StageCardActionRecord;
		actionBusy: boolean;
		onRunAction: (action: StageCardActionRecord, trigger?: HTMLButtonElement) => void;
	} = $props();

	const menuId = $props.id();
	let open = $state(false);
	let trigger = $state<HTMLButtonElement>();
	let menu = $state<HTMLDivElement>();
	const disabled = $derived(actionBusy || action.disabled === true);

	function close(restoreFocus = false): void {
		open = false;
		if (restoreFocus) trigger?.focus();
	}
</script>

<svelte:window onpointerdowncapture={(event) => {
	if (open && event.target instanceof Node && !menu?.contains(event.target) && !trigger?.contains(event.target)) close();
}} onkeydowncapture={(event) => {
	if (!open || event.key !== 'Escape') return;
	event.preventDefault();
	event.stopPropagation();
	close(true);
}} />

<span class="action">
	<button type="button" class:danger={action.destructive === true} data-card-footer-action={action.id}
		{disabled} title={action.detail} onclick={(event) => { close(); onRunAction(action, event.currentTarget); }}>
		{action.compactLabel ?? action.label}
	</button>
	{#if action.options?.length}
		<button type="button" class="chevron" aria-label={action.label + ' options'}
			{disabled} aria-expanded={open} aria-controls={open ? menuId : undefined}
			bind:this={trigger} onclick={() => (open = !open)}>⌄</button>
	{/if}
</span>
{#if open && action.options?.length}
	<div class="options" id={menuId} bind:this={menu} role="group" aria-label={action.label + ' options'}>
		{#each [action, ...action.options] as option (option.id)}
			<button type="button" data-card-recipe={option.id} disabled={actionBusy || option.disabled}
				onclick={() => { close(true); onRunAction({ ...option, adapterId: action.adapterId }); }}>
				<strong>{option.optionLabel ?? option.label}</strong>
				{#if option.detail}<span>{option.detail}</span>{/if}
			</button>
		{/each}
	</div>
{/if}

<style>
	.action { display: inline-flex; align-items: center; flex: none; }
	button {
		min-height: 26px;
		padding: 0 6px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--shell-ink);
		font: inherit;
		font-size: var(--shell-text-utility);
		cursor: pointer;
	}
	button:not(:disabled):hover { background: var(--shell-hover); }
	button:disabled { color: var(--shell-ink-3); cursor: default; }
	button.danger { color: var(--shell-refuse); }
	.chevron { padding-inline: 4px; }
	.options {
		flex: 1 0 100%;
		display: grid;
		padding: 3px;
		border: 1px solid var(--shell-hairline);
		border-radius: 8px;
		background: var(--shell-surface-raised);
	}
	.options button { padding: 5px 8px; text-align: left; }
	.options span { display: block; color: var(--shell-ink-2); font-size: var(--shell-text-label); }
	@media (pointer: coarse) {
		button { min-width: 44px; min-height: 44px; }
	}
</style>
