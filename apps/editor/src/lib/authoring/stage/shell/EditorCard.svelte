<script lang="ts">
	/**
	 * PLATE contextual **Card** — canonical selection identity, and nothing else.
	 *
	 * The Card represents the selected subject, never the current tool, host,
	 * inspection or task focus. Its identity header is persistent (it survives the
	 * Card being compressed), owner/source/reach facts describe the same target, and
	 * raw canonical IDs stay behind Technical details.
	 *
	 * It is an **overlay** on the Stage's lower edge: absolutely positioned, so
	 * opening and closing it never reflows or implicitly reframes the Stage. At
	 * rest — no canonical selection — it renders nothing at all; there is no empty
	 * Card.
	 */
	let {
		identity,
		facts,
		onClose,
		onFocusTask,
		onOpenTask,
		onBringIntoView
	}: {
		identity: {
			sourceId: string;
			label: string;
			kind: string;
			status: string;
		} | null;
		facts: readonly { label: string; value: string }[];
		onClose: () => void;
		onFocusTask: () => void;
		onOpenTask: () => void;
		onBringIntoView: () => void;
	} = $props();
</script>

{#if identity}
	<aside class="card" aria-label="Selected subject">
		<header class="card-head">
			<div class="identity">
				<p class="eyebrow">
					<span class="kind">{identity.kind}</span>
					<span class="dot" aria-hidden="true">·</span>
					<span class="status">{identity.status}</span>
				</p>
				<!-- The full name stays available even when the header ellipsizes. -->
				<h2 class="name" title={identity.label}>{identity.label}</h2>
			</div>
			<button type="button" class="icon" onclick={onClose} aria-label="Close selection card">✕</button>
		</header>

		{#if facts.length > 0}
			<dl class="facts">
				{#each facts as fact (fact.label)}
					<dt>{fact.label}</dt>
					<dd>{fact.value}</dd>
				{/each}
			</dl>
		{:else}
			<p class="quiet">No further facts.</p>
		{/if}

		<div class="actions">
			<!-- Three separate operations: Focus deepens task context, Open task invokes
			     specialist work, Bring into view is a Camera/navigation request. -->
			<button type="button" class="action" onclick={onFocusTask}>Focus</button>
			<button type="button" class="action" onclick={onOpenTask}>Open task</button>
			<button type="button" class="action navigate" onclick={onBringIntoView}>Bring into view</button>
		</div>

		<details class="technical">
			<summary>Technical details</summary>
			<dl class="facts mono">
				<dt>Canonical ID</dt>
				<dd>{identity.sourceId}</dd>
			</dl>
		</details>
	</aside>
{/if}

<style>
	.card {
		position: absolute;
		inset-inline-start: 1rem;
		bottom: 1rem;
		z-index: 12;
		width: min(21rem, calc(100% - 2rem));
		max-height: calc(100% - 2rem);
		overflow: auto;
		box-sizing: border-box;
		padding: 0.85rem 0.95rem 0.75rem;
		border: 1px solid var(--plate-card-edge, #d9dcd4);
		border-radius: 0.65rem;
		background: var(--plate-card-surface, #ffffff);
		color: var(--plate-ink, #1b201c);
		box-shadow: 0 0.9rem 2rem rgb(17 41 31 / 18%);
		font-family: var(--plate-font, Inter, ui-sans-serif, system-ui, sans-serif);
		font-size: 0.82rem;
		line-height: 1.4;
	}

	.card-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.identity {
		min-width: 0;
	}

	.eyebrow {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin: 0 0 0.2rem;
		color: var(--plate-ink-quiet, #5c665e);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	.name {
		margin: 0;
		overflow: hidden;
		color: var(--plate-ink, #1b201c);
		font-size: 0.98rem;
		font-weight: 650;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.icon {
		flex: none;
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid transparent;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--plate-ink-quiet, #5c665e);
		font: inherit;
		cursor: pointer;
	}

	.icon:hover {
		border-color: var(--plate-card-edge, #d9dcd4);
		color: var(--plate-ink, #1b201c);
	}

	.icon:focus-visible,
	.action:focus-visible,
	summary:focus-visible {
		outline: 2px solid var(--plate-focus, #2f6f52);
		outline-offset: 2px;
	}

	.facts {
		display: grid;
		grid-template-columns: minmax(6rem, auto) 1fr;
		gap: 0.15rem 0.7rem;
		margin: 0.7rem 0 0;
	}

	dt {
		color: var(--plate-ink-quiet, #5c665e);
	}

	dd {
		margin: 0;
	}

	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.74rem;
		word-break: break-all;
	}

	.quiet {
		margin: 0.7rem 0 0;
		color: var(--plate-ink-quiet, #5c665e);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.8rem;
	}

	.action {
		min-height: 2.75rem;
		padding: 0 0.7rem;
		border: 1px solid var(--plate-control-edge, #cfd5cb);
		border-radius: 0.45rem;
		background: var(--plate-control-surface, #f5f6f4);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.action:hover {
		border-color: var(--plate-control-edge-strong, #a9b4a6);
	}

	/* Bring into view is navigation, not an edit: quieter than the task actions. */
	.navigate {
		background: transparent;
	}

	.technical {
		margin-top: 0.7rem;
		border-top: 1px solid var(--plate-card-edge, #e6e8e2);
		padding-top: 0.5rem;
	}

	summary {
		color: var(--plate-ink-quiet, #5c665e);
		cursor: pointer;
		font-size: 0.76rem;
	}
</style>
