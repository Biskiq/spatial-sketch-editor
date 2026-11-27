<script lang="ts">
	import ShellIcon from './ShellIcon.svelte';
	import EditorCardActionButton from './EditorCardActionButton.svelte';
	import type { StageCardActionRecord } from '../stage-facade';

	let {
		advanced,
		showAdvanced,
		moreOpen,
		onToggleMore,
		onBringIntoView,
		footerActions,
		actionBusy,
		onRunAction,
		footerConfirmingAction,
		actionMessage,
		onCancel
	}: {
		advanced?: string;
		showAdvanced: boolean;
		moreOpen: boolean;
		onToggleMore: () => void;
		onBringIntoView?: () => void;
		footerActions: readonly StageCardActionRecord[];
		actionBusy: boolean;
		onRunAction: (action: StageCardActionRecord, trigger?: HTMLButtonElement) => void;
		footerConfirmingAction: StageCardActionRecord | null;
		actionMessage: string | null;
		onCancel: () => void;
	} = $props();
</script>

<div class="footer">
	<div class="footer-lead">
		{#if onBringIntoView}<button type="button" aria-label="Bring into view" title="Bring into view" onclick={() => onBringIntoView?.()}><ShellIcon name="fit" size={15} /></button>{/if}
		{#if showAdvanced}<button type="button" class="more" aria-expanded={moreOpen} data-card-more onclick={onToggleMore}
			title={advanced === undefined ? 'Advanced' : `Advanced: ${advanced}`}
			><span>Advanced</span>{#if advanced}<span class="more-summary">{advanced}</span>{/if}<span class="chev" class:open={moreOpen} aria-hidden="true">⌄</span></button>{/if}
	</div>
	{#if footerActions.length > 0}
		<div class="footer-actions">
			{#each footerActions as action (`${action.adapterId}:${action.id}`)}
				<EditorCardActionButton {action} {actionBusy} {onRunAction} />
			{/each}
		</div>
	{/if}
</div>
{#if footerConfirmingAction !== null}
	<div class="footer-confirm" role="group" aria-label={`${footerConfirmingAction.compactLabel ?? footerConfirmingAction.label}?`}>
		<p>{actionMessage ?? footerConfirmingAction.detail ?? 'This action cannot be undone.'}</p>
		<div class="footer-confirm-actions">
			<button type="button" class="remove" disabled={actionBusy} data-card-footer-confirm onclick={() => onRunAction(footerConfirmingAction!)}>Remove</button>
			<button type="button" data-card-footer-cancel onclick={onCancel}>Cancel</button>
		</div>
	</div>
{/if}

<style>
	button {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		gap: 4px;
		min-height: 24px;
		padding: 0 7px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	button:hover {
		background: var(--shell-hover);
	}
	.footer button:not(.more) {
		width: 24px;
		padding: 0;
	}
	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 4px;
		padding: 4px 8px 8px 10px;
		border-top: 1px solid var(--shell-hairline);
	}
	.footer-lead {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		flex: 1;
	}
	.footer .more {
		min-width: 0;
		flex: 1;
		justify-content: flex-start;
		overflow: hidden;
		gap: 3px;
		font-size: var(--shell-text-utility);
		color: var(--shell-ink-2);
	}
	.more-summary {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--shell-ink-2);
		font-size: var(--shell-text-label);
	}
	.footer-actions {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}
	.chev {
		display: inline-block;
		transition: transform 120ms;
	}
	.chev.open {
		transform: rotate(180deg);
	}
	.footer-confirm {
		display: grid;
		gap: 4px;
		padding: 6px 10px 8px;
		border-top: 1px solid var(--shell-hairline);
		background: var(--shell-refuse-bg);
	}
	.footer-confirm p {
		margin: 0;
		font-size: var(--shell-text-label);
		color: var(--shell-ink-2);
	}
	.footer-confirm-actions {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
	}
	.footer-confirm-actions button {
		min-height: 26px;
		padding: 0 9px;
		border: 1px solid var(--shell-hairline-strong);
		font-size: var(--shell-text-utility);
	}
	.footer-confirm-actions .remove {
		border-color: var(--shell-refuse);
		background: var(--shell-refuse);
		color: var(--shell-on-action);
	}
	@media (pointer: coarse) {
		button {
			min-width: 44px;
			min-height: 44px;
		}
	}
</style>
