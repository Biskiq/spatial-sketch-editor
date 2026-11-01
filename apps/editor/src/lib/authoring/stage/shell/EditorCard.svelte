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
	 *
	 * R217.S21 — each fact appears once. The header carries the name and the kind, a
	 * contributed writer carries the fields it edits, and a fact whose field is held by
	 * one of those is not repeated. Only `destructive: true` is destructive; a
	 * `secondary` action moves into More.
	 */
	import { untrack } from 'svelte';
	import type { StageCardActionRecord, StageCardFact, StageCardWriterRecord } from '../stage-facade';

	/** Fields the identity header itself shows; a fact for one of them is not repeated. */
	const HEADER_FIELD_IDS: ReadonlySet<string> = new Set(['name', 'kind']);

	let {
		identity,
		facts,
		nameWriter = null,
		writer = null,
		actions = [],
		technicalFacts = [],
		collapsed = false,
		onToggleCollapsed = () => {},
		onClose,
		onFocusTask,
		onOpenTask,
		onBringIntoView,
		gesturing = false
	}: {
		identity: {
			sourceId: string;
			/** The subject's name: its authored name, or a generated `Kind n` when it has none. */
			label: string;
			/** The human kind word. */
			kind: string;
			/** What the Plan or the owning domain says about the selection. */
			status: string;
		} | null;
		facts: readonly StageCardFact[];
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
		 * Diagnostics about how the selection is drawn (Stream, Eligible, Revealed). They
		 * belong to Technical details, not to the ordinary Card.
		 */
		technicalFacts?: readonly StageCardFact[];
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
		/**
		 * R217.S22 (D36): a live authored gesture on the Stage. The Card fades and takes no
		 * pointer events until it ends, so the subject being edited stays visible. Only the
		 * lease changes this; the Card's position, fold and facts do not.
		 */
		gesturing?: boolean;
	} = $props();

	/** The facts the Card shows: never one the header or the writer already carries. */
	const ordinaryFacts = $derived.by(() => {
		const writerFieldIds = new Set(writer?.fieldIds ?? []);
		return facts.filter((fact) => {
			if (fact.fieldId === undefined) return true;
			return !HEADER_FIELD_IDS.has(fact.fieldId) && !writerFieldIds.has(fact.fieldId);
		});
	});

	/** Contributed actions in the row: everything that is not `secondary`. */
	const primaryActions = $derived(actions.filter((action) => action.group !== 'secondary'));
	/** Contributed actions in More. */
	const secondaryActions = $derived(actions.filter((action) => action.group === 'secondary'));

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
	<aside class="card" class:gesturing aria-label="Selected subject" data-source-id={identity.sourceId} data-card-gesturing={gesturing ? 'true' : 'false'}>
		<header class="card-head">
			<div class="identity">
				<div class="title-row">
					<p class="eyebrow">
						<span class="kind">{identity.kind}</span>
						<span class="dot" aria-hidden="true">·</span>
						<span class="status">{identity.status}</span>
					</p>
					<div class="head-actions">
						<button
							type="button"
							class="icon"
							aria-expanded={!collapsed}
							onclick={onToggleCollapsed}
						>{collapsed ? 'Expand' : 'Collapse'}</button>
						<button type="button" class="icon" onclick={onClose} aria-label="Close selection card">✕</button>
					</div>
				</div>
				<!-- The full name stays available even when the header ellipsizes. -->
				<h2 class="name" title={identity.label}>{identity.label}</h2>
				{#if nameWriter && !collapsed}
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
		</header>

		{#if !collapsed && writer?.view}
			<div class="writer" data-card-writer={writer.summary}>
				<writer.view.component services={writer.view.services} />
			</div>
		{/if}

		{#if !collapsed}
			{#if primaryActions.length > 0}
				<div class="card-actions" data-card-actions>
					<!-- The action id is unique per adapter, not across them. -->
					{#each primaryActions as action (`${action.adapterId}:${action.id}`)}
						<button
							type="button"
							class="action"
							class:destructive={action.destructive === true}
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

			{#if ordinaryFacts.length > 0}
				<dl class="facts">
					{#each ordinaryFacts as fact (fact.label)}
						<dt>{fact.label}</dt>
						<dd>{fact.value}</dd>
					{/each}
				</dl>
			{:else}
				<p class="quiet">No further facts.</p>
			{/if}

			<div class="actions">
				<!-- Bring into view is a Camera/navigation request: quieter than the task actions. -->
				<button type="button" class="action navigate" onclick={onBringIntoView}>Bring into view</button>
				<details class="more" data-card-more>
					<summary>More</summary>
					<div class="more-body">
						<!-- Three separate operations: Focus deepens task context, Open task invokes
						     specialist work; a contributed secondary action sits beside them. -->
						{#each secondaryActions as action (`${action.adapterId}:${action.id}`)}
							<button
								type="button"
								class="action"
								class:destructive={action.destructive === true}
								data-card-action={action.id}
								disabled={actionBusy}
								onclick={() => void runAction(action)}
							>
								{confirming === confirmationKeyOf(action) ? `Confirm ${action.label}` : action.label}
							</button>
						{/each}
						<button type="button" class="action" onclick={onFocusTask}>Focus</button>
						<button type="button" class="action" onclick={onOpenTask}>Open task</button>
					</div>
				</details>
			</div>

			<details class="technical">
				<summary>Technical details</summary>
				<dl class="facts mono">
					<dt>Canonical ID</dt>
					<dd>{identity.sourceId}</dd>
					{#each technicalFacts as fact (fact.label)}
						<dt>{fact.label}</dt>
						<dd>{fact.value}</dd>
					{/each}
				</dl>
			</details>
		{/if}
	</aside>
{/if}

<style>
	/*
	 * PLATE shell roles (shell-roles.css). The Card is a white working surface at the
	 * role's width, with forest ink. Destructive and refusal words keep their existing
	 * values: no shell role names them yet.
	 */
	/*
	 * R217.S22: the lanes are measured by the route and published on the Stage frame. The
	 * Card clears the Height Sheet lane (measured width plus 1.5 rem) and sits above the zoom
	 * cluster, which is itself above the lower column. It never overlaps those lanes, and a
	 * layout change never moves the Camera.
	 */
	.card {
		position: absolute;
		inset-inline-end: calc(var(--sheet-lane-right, 0px) + 1.5rem);
		bottom: calc(var(--lower-column-height, 0px) + var(--zoom-lane-height, 0px) + 1.5rem);
		z-index: 12;
		width: min(var(--shell-card-width, 288px), calc(100% - 2rem));
		max-height: calc(100% - var(--lower-column-height, 0px) - var(--zoom-lane-height, 0px) - 2.5rem);
		overflow: auto;
		transition: opacity 140ms ease;
		box-sizing: border-box;
		padding: 0.75rem 0.85rem 0.7rem;
		border: 1px solid var(--shell-paper, #e9ebe6);
		border-radius: 0.65rem;
		background: var(--shell-card, #ffffff);
		color: var(--shell-forest, #11291f);
		box-shadow: 0 0.9rem 2rem rgb(17 41 31 / 18%);
		font-family: var(--shell-sans, Inter, ui-sans-serif, system-ui, sans-serif);
		font-size: var(--shell-text-body, 13px);
		line-height: 1.4;
	}

	.card-head {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
	}

	.identity {
		flex: 1 1 auto;
		min-width: 0;
	}

	/* The eyebrow and the header controls share one line; the name and rename take the full width. */
	.title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
		min-width: 0;
	}

	.eyebrow {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		min-width: 0;
		margin: 0 0 0.2rem;
		white-space: nowrap;
		color: var(--shell-forest-raised, #22503c);
		font-size: var(--shell-text-utility, 12px);
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	.eyebrow .kind {
		flex: none;
	}

	.eyebrow .status {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.name {
		margin: 0;
		overflow: hidden;
		color: var(--shell-forest, #11291f);
		font-family: var(--shell-serif, 'Iowan Old Style', Palatino, Georgia, serif);
		font-size: var(--shell-text-identity, 15px);
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
		min-height: var(--shell-control-height, 32px);
		padding: 0 0.45rem;
		border: 1px solid var(--shell-hairline, #2f4a3d);
		border-radius: 0.45rem;
		background: var(--shell-index, #f5f6f4);
		color: inherit;
		font: inherit;
	}

	.error {
		margin: 0.3rem 0 0;
		color: #a33b24;
		font-size: var(--shell-text-utility, 12px);
	}

	/* The Collapse control is text and the close control is an icon: both keep the control height. */
	.icon {
		flex: none;
		min-width: var(--shell-control-height, 32px);
		height: var(--shell-control-height, 32px);
		padding: 0 0.4rem;
		border: 1px solid transparent;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--shell-forest-raised, #22503c);
		font: inherit;
		cursor: pointer;
	}

	.icon:hover {
		border-color: var(--shell-paper, #e9ebe6);
		color: var(--shell-forest, #11291f);
	}

	.head-actions {
		display: flex;
		flex: none;
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
		margin-top: 0.6rem;
	}

	/* Only a destructive action is styled destructively. */
	.action.destructive {
		border-color: #d8b7ab;
		color: #8f3a22;
	}

	.icon:focus-visible,
	.action:focus-visible,
	summary:focus-visible {
		outline: 2px solid var(--shell-forest-raised, #22503c);
		outline-offset: 2px;
	}

	.facts {
		display: grid;
		grid-template-columns: minmax(5.5rem, auto) 1fr;
		gap: 0.15rem 0.7rem;
		margin: 0.6rem 0 0;
	}

	dt {
		color: var(--shell-forest-raised, #22503c);
	}

	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: var(--shell-text-utility, 12px);
		word-break: break-all;
	}

	.quiet {
		margin: 0.6rem 0 0;
		color: var(--shell-forest-raised, #22503c);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 0.4rem;
		margin-top: 0.7rem;
	}

	.action {
		min-height: var(--shell-control-height, 32px);
		padding: 0 0.6rem;
		border: 1px solid var(--shell-hairline, #2f4a3d);
		border-radius: 0.45rem;
		background: var(--shell-index, #f5f6f4);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.action:hover {
		background: var(--shell-paper, #e9ebe6);
	}

	/* Bring into view is navigation, not an edit: quieter than the task actions. */
	.navigate {
		background: transparent;
	}

	.more {
		position: relative;
	}

	.more summary {
		min-height: var(--shell-control-height, 32px);
		display: inline-flex;
		align-items: center;
		padding: 0 0.6rem;
		border: 1px solid var(--shell-paper, #e9ebe6);
		border-radius: 0.45rem;
		color: var(--shell-forest-raised, #22503c);
		font-size: var(--shell-text-utility, 12px);
		cursor: pointer;
		list-style: none;
	}

	.more summary::-webkit-details-marker {
		display: none;
	}

	.more-body {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.4rem;
	}

	.technical {
		margin-top: 0.6rem;
		border-top: 1px solid var(--shell-paper, #e9ebe6);
		padding-top: 0.45rem;
	}

	summary {
		color: var(--shell-forest-raised, #22503c);
		cursor: pointer;
		font-size: var(--shell-text-utility, 12px);
	}

	/*
	 * A live authored gesture: the Card fades and takes no pointer events, so the subject
	 * under it can be edited. It returns on release, at the same place it was.
	 */
	.card.gesturing {
		opacity: 0.2;
		pointer-events: none;
	}

	/*
	 * Coarse pointer: every control the Card draws reaches the touch target (44 × 44 CSS
	 * px). The fine-pointer density above (32 px) is unchanged. The host also sets this
	 * floor on descendants; the Card states it for its own controls.
	 */
	@media (pointer: coarse) {
		.icon,
		.action,
		.rename input,
		summary {
			min-width: var(--shell-touch-target, 44px);
			min-height: var(--shell-touch-target, 44px);
		}
	}
</style>
