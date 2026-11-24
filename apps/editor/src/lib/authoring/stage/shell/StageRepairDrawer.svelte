<script lang="ts">
	/**
	 * Appearance issues drawer (T2.S8 · U6).
	 *
	 * 400 px wide right-docked drawer below the Head. Lists open appearance
	 * issues grouped by Finish (with affected targets and *Open its Card*)
	 * plus session-repaired entries (*Repaired (…)*).
	 */
	import type { AppearanceIssue, RepairedIssueEntry } from '$lib/authoring/look/appearance-issues.svelte';

	let {
		open = false,
		issues = [],
		repaired = [],
		targetLabel = (key: string) => key,
		onOpenCard,
		onClose
	}: {
		readonly open?: boolean;
		readonly issues?: readonly AppearanceIssue[];
		readonly repaired?: readonly RepairedIssueEntry[];
		readonly targetLabel?: (targetKey: string) => string;
		readonly onOpenCard?: (issue: AppearanceIssue) => void;
		readonly onClose?: () => void;
	} = $props();
</script>

{#if open}
	<aside
		class="repair-drawer"
		aria-label="Appearance issues"
		data-repair-drawer
	>
		<header class="drawer-head">
			<h2>Appearance issues</h2>
			<button
				type="button"
				class="drawer-close"
				aria-label="Close"
				onclick={() => onClose?.()}
			>
				×
			</button>
		</header>

		<div class="drawer-body">
			{#if issues.length === 0 && repaired.length === 0}
				<p class="drawer-empty">No appearance issues in this session.</p>
			{/if}

			{#each issues as issue (issue.id)}
				<div class="diag" data-repair-issue={issue.code} data-repair-finish={issue.finishKey}>
					<b class="diag-title">
						<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
							<path d="M8 2.2 14.2 13.4H1.8Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
							<path d="M8 6.4v3.3M8 11.4v.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
						</svg>
						{issue.finishName}
					</b>
					<div class="diag-text">{issue.text}</div>
					<div class="diag-users">
						{issue.affected.map(targetLabel).join(', ') || 'No users'}
					</div>
					{#if issue.affected.length > 0}
						<div class="diag-acts">
							<button
								type="button"
								class="diag-btn"
								data-repair-open-card={issue.id}
								onclick={() => onOpenCard?.(issue)}
							>
								Open its Card
							</button>
						</div>
					{/if}
				</div>
			{/each}

			{#each repaired as entry (entry.id)}
				<div class="diag fixed" data-repair-fixed={entry.code}>
					<b class="diag-title">
						<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
							<path d="M3 8.4 6.4 11.8 13 4.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
						{entry.finishName}
					</b>
					<div class="diag-text">Repaired ({entry.action})</div>
				</div>
			{/each}
		</div>
	</aside>
{/if}

<style>
	.repair-drawer {
		position: fixed;
		top: 44px;
		right: 0;
		bottom: 0;
		width: min(400px, 100vw);
		z-index: 36;
		display: flex;
		flex-direction: column;
		background: var(--shell-surface);
		color: var(--shell-ink);
		border-left: 1px solid var(--shell-hairline);
		box-shadow: -8px 0 28px rgba(17, 24, 21, 0.14);
	}
	.drawer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px 10px;
		border-bottom: 1px solid var(--shell-hairline);
	}
	.drawer-head h2 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.drawer-close {
		width: 28px;
		height: 28px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--shell-ink-2);
		font-size: 18px;
		line-height: 1;
		cursor: pointer;
	}
	.drawer-close:hover {
		background: var(--shell-surface-raised);
		color: var(--shell-ink);
	}
	.drawer-body {
		flex: 1 1 auto;
		overflow-y: auto;
		padding: 12px 16px 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.drawer-empty {
		margin: 12px 0;
		font-size: 12.5px;
		color: var(--shell-ink-2);
	}
	.diag {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		border-radius: 9px;
		border: 1px solid color-mix(in srgb, var(--shell-caution) 36%, transparent);
		background: var(--shell-caution-bg);
		color: var(--shell-ink);
		font-size: 12.5px;
		line-height: 1.4;
	}
	.diag.fixed {
		border-color: color-mix(in srgb, var(--shell-positive) 36%, transparent);
		background: var(--shell-positive-bg);
	}
	.diag-title {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--shell-caution);
	}
	.diag.fixed .diag-title {
		color: var(--shell-positive);
	}
	.diag-users {
		font-size: 11.5px;
		color: var(--shell-ink-2);
	}
	.diag-acts {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 2px;
	}
	.diag-btn {
		padding: 5px 10px;
		border: 1px solid var(--shell-hairline);
		border-radius: 7px;
		background: var(--shell-surface);
		color: var(--shell-ink);
		font: 500 12px/1.2 inherit;
		cursor: pointer;
	}
	.diag-btn:hover {
		background: var(--shell-surface-raised);
	}
	@media (pointer: coarse) {
		.repair-drawer {
			top: 52px;
		}
		.diag-btn,
		.drawer-close {
			min-height: 40px;
		}
	}
</style>
