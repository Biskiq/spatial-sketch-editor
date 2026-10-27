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
	 *
	 * Round 2 D9 makes it the one writer for the selected subject's **ordinary
	 * fields**, and the one home for the actions its owning adapter scopes to it. It
	 * renders published records: the adapter owns the controller and the intent, the
	 * Card owns placement, confirmation and the words the creator reads.
	 */
	import { untrack } from 'svelte';
	import type { StageCardActionRecord, StageCardWriterRecord } from '../stage-facade';

	let {
		identity,
		facts,
		nameWriter = null,
		writer = null,
		actions = [],
		collapsed = false,
		onToggleCollapsed = () => {},
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
		/** The selected subject's name writer, when its domain contributes one. */
		nameWriter?: {
			readonly value: string;
			commit(name: string): Promise<{ readonly kind: string; readonly message?: string }>;
		} | null;
		/**
		 * The subject's contributed **ordinary-field writer** (T1.P02.S02). The Card is
		 * the one writer for these facts — the Dimensions task and its route are
		 * retired — so the fields render here through the owning domain's own
		 * controller, never through a shell-built intent.
		 */
		writer?: StageCardWriterRecord | null;
		/** The subject's scoped contributed actions (a delete and its disclosure). */
		actions?: readonly StageCardActionRecord[];
		/**
		 * PLATE arbitration: at constrained width the Card collapses to identity with
		 * explicit expansion, so it never covers the task's lower column.
		 */
		collapsed?: boolean;
		onToggleCollapsed?: () => void;
		onClose: () => void;
		onFocusTask: () => void;
		onOpenTask: () => void;
		onBringIntoView: () => void;
	} = $props();

	/**
	 * The Card's one writable fact is the subject's name, and it is delegated: the
	 * input sends text to the adapter's canonical name planner, never to the source.
	 * Enter commits, Esc resets, blur never commits.
	 */
	let nameDraft = $state('');
	let nameError = $state<string | null>(null);
	let nameBusy = $state(false);
	/**
	 * What an open confirmation was disclosed **for**: one exact action of one
	 * subject — the subject, the owning adapter, the action and that adapter's own
	 * words. A different subject, a different action (including the same id
	 * contributed by another adapter) or the same action disclosed differently all
	 * invalidate it, so `Confirm` can only run the action whose disclosure the
	 * creator actually read. The Card holds no second opinion about any of it.
	 */
	function confirmationKeyOf(action: StageCardActionRecord): string {
		return `${identity?.sourceId ?? ''}\u0000${action.adapterId}\u0000${action.id}\u0000${action.detail ?? ''}`;
	}
	/** Every key a live confirmation may name; a key outside this set is stale. */
	const liveConfirmationKeys = $derived(actions.map(confirmationKeyOf));
	/** The key whose consequence is currently disclosed and awaiting confirmation. */
	let confirming = $state<string | null>(null);
	let actionMessage = $state<string | null>(null);
	let actionBusy = $state(false);

	$effect(() => {
		// The disclosure belongs to one action of one subject: switching subject,
		// losing that action (a rebuilt adapter registry) or changing what its adapter
		// discloses drops the pending confirmation and its words, so the next press
		// discloses the live consequences rather than offering to run the ones the
		// creator read a moment ago. Only the key set is tracked — a press must not
		// re-trigger this and clear what it just opened.
		const keys = liveConfirmationKeys;
		untrack(() => {
			if (confirming === null || keys.includes(confirming)) return;
			confirming = null;
			actionMessage = null;
		});
	});

	/**
	 * A destructive action runs only after **its own** disclosure has been read: the
	 * first press opens that action's consequence, the second confirms it. A second
	 * destructive action beside it is a different subject of confirmation, so it
	 * discloses rather than inheriting the confirmation its neighbour opened. A
	 * non-destructive action runs directly.
	 */
	async function runAction(action: (typeof actions)[number]): Promise<void> {
		if (actionBusy) return;
		const key = confirmationKeyOf(action);
		if (action.destructive === true && confirming !== key) {
			confirming = key;
			actionMessage = action.detail ?? null;
			return;
		}
		actionBusy = true;
		confirming = null;
		actionMessage = null;
		try {
			const outcome = await action.run();
			if (outcome.message !== undefined && outcome.kind !== 'accepted') actionMessage = outcome.message;
		} finally {
			actionBusy = false;
		}
	}

	$effect(() => {
		nameDraft = nameWriter?.value ?? '';
		nameError = null;
		nameBusy = false;
	});

	async function commitName(): Promise<void> {
		if (nameWriter === null || nameBusy) return;
		const name = nameDraft.trim();
		if (name.length === 0) {
			nameError = 'Enter a name; an empty name is not a rename.';
			return;
		}
		nameBusy = true;
		nameError = null;
		try {
			const outcome = await nameWriter.commit(name);
			if (outcome.kind !== 'accepted') {
				nameError = outcome.message ?? 'The name was not accepted.';
				return;
			}
			nameDraft = name;
		} finally {
			// A throwing writer ends the attempt too; leaving `nameBusy` true would
			// disable the rename affordance for the rest of the selection.
			nameBusy = false;
		}
	}
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
				{#if nameWriter}
					<form
						class="rename"
						onsubmit={(event) => {
							event.preventDefault();
							void commitName();
						}}
					>
						<input
							aria-label="Name"
							type="text"
							value={nameDraft}
							disabled={nameBusy}
							oninput={(event) => {
								nameDraft = event.currentTarget.value;
								nameError = null;
							}}
							onkeydown={(event) => {
								if (event.key === 'Escape') {
									event.preventDefault();
									nameDraft = nameWriter.value;
									nameError = null;
								}
							}}
						/>
						<button type="submit" class="action" disabled={nameBusy}>Rename</button>
					</form>
					{#if nameError !== null}
						<p class="error" role="alert">{nameError}</p>
					{/if}
				{/if}
			</div>
			<div class="head-actions">
				<button
					type="button"
					class="icon"
					aria-expanded={!collapsed}
					onclick={onToggleCollapsed}
				>{collapsed ? 'Expand' : 'Collapse'}</button>
				<button type="button" class="icon" onclick={onClose} aria-label="Close selection card">✕</button>
			</div>
		</header>

		{#if !collapsed && writer?.view}
			<div class="writer" data-card-writer={writer.summary}>
				<writer.view.component services={writer.view.services} />
			</div>
		{/if}

		{#if !collapsed}
			{#if actions.length > 0}
				<div class="card-actions" data-card-actions>
					<!-- The action id is unique per adapter, not across them. -->
					{#each actions as action (`${action.adapterId}:${action.id}`)}
						<button
							type="button"
							class="action destructive"
							data-card-action={action.id}
							disabled={actionBusy}
							onclick={() => void runAction(action)}
						>
							{confirming === confirmationKeyOf(action) ? `Confirm ${action.label}` : action.label}
						</button>
					{/each}
					{#if actionMessage !== null}
						<p class="error" role="alert">{actionMessage}</p>
					{/if}
					{#if confirming !== null}
						<button type="button" class="action" onclick={() => (confirming = null)}>Cancel</button>
					{/if}
				</div>
			{/if}

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
		{/if}
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

	.rename {
		display: flex;
		gap: 0.35rem;
		margin-top: 0.35rem;
	}

	.rename input {
		min-width: 0;
		flex: 1;
		min-height: 2.75rem;
		padding: 0 0.45rem;
		border: 1px solid var(--plate-control-edge, #cfd5cb);
		border-radius: 0.45rem;
		background: var(--plate-control-surface, #f5f6f4);
		color: inherit;
		font: inherit;
	}

	.error {
		margin: 0.3rem 0 0;
		color: #a33b24;
		font-size: 0.74rem;
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

	.head-actions {
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	.writer {
		margin-top: 0.2rem;
	}

	.card-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.7rem;
	}

	.action.destructive {
		border-color: #d8b7ab;
		color: #8f3a22;
	}

	.action.destructive[data-card-action] + .action {
		margin-left: 0;
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
