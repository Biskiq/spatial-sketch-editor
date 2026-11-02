<script lang="ts">
	/** Compact identity and one contributed writer. Precision and relations are invoked without remounting the writer. */
	import { untrack } from 'svelte';
	import ShellIcon from './ShellIcon.svelte';
	import type {
		StageCardActionRecord,
		StageCardFact,
		StageCardWriterRecord
	} from '../stage-facade';

	/** Fields the identity header itself shows; a fact for one of them is not repeated. */
	const HEADER_FIELD_IDS: ReadonlySet<string> = new Set(['name', 'kind']);

	let {
		identity,
		facts,
		nameWriter = null,
		writer = null,
		actions = [],
		technicalFacts = [],
		relations = [],
		onClose,
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
		relations?: readonly { label: string; onNavigate: () => void }[];
		/**
		 * PLATE arbitration: at constrained width the Card collapses to identity with
		 * explicit expansion, so it never covers the task's lower column.
		 */
		onClose: () => void;
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

	/**
	 * The Card's one writable fact is the subject's name, and it is delegated: the
	 * input sends text to the adapter's canonical name planner, never to the source.
	 * Enter commits, Esc resets, blur never commits.
	 */
	let renaming = $state(false);
	let detailOpen = $state(false);
	let actionsOpen = $state(false);
	let technicalOpen = $state(false);
	const identityKey = $derived(identity?.sourceId ?? null);
	$effect(() => {
		void identityKey;
		renaming = false;
		detailOpen = false;
		actionsOpen = false;
		technicalOpen = false;
	});
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
			if (outcome.message !== undefined && outcome.kind !== 'accepted')
				actionMessage = outcome.message;
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
			renaming = false;
		} finally {
			// A throwing writer ends the attempt too; leaving `nameBusy` true would
			// disable the rename affordance for the rest of the selection.
			nameBusy = false;
		}
	}
</script>

{#snippet footer()}
	<div class="footer">
		<span class="look">Look</span>
		<button
			type="button"
			aria-label="Bring into view"
			title="Bring into view"
			onclick={onBringIntoView}><ShellIcon name="fit" size={15} /></button
		>
		<button
			type="button"
			aria-label="Look from here unavailable"
			title="Look from here is not available yet"
			aria-disabled="true"><ShellIcon name="eye" size={15} /></button
		>
		<button
			type="button"
			class="more"
			data-card-more
			aria-expanded={detailOpen}
			onclick={() => (detailOpen = !detailOpen)}
			>More <ShellIcon name="chevronDown" size={12} /></button
		>
	</div>
{/snippet}
{#if identity}
	<aside
		class="card"
		class:gesturing
		aria-label="Selected subject"
		data-source-id={identity.sourceId}
		data-card-gesturing={gesturing ? 'true' : 'false'}
	>
		<header class="card-head">
			<span class="kind">{identity.kind}</span>
			<div class="head-actions">
				<button
					type="button"
					aria-label="Subject actions"
					aria-expanded={actionsOpen}
					onclick={() => (actionsOpen = !actionsOpen)}><ShellIcon name="more" size={15} /></button
				>
				<button type="button" aria-label="Close selection card" onclick={onClose}
					><ShellIcon name="close" size={15} /></button
				>
			</div>
		</header>
		<h2 class="name" title={identity.label}>
			<button
				type="button"
				aria-label={`Rename ${identity.label}`}
				onclick={() => {
					if (nameWriter) renaming = !renaming;
				}}>{identity.label}</button
			>
		</h2>
		{#if renaming && nameWriter}
			<form
				class="rename"
				onsubmit={(event) => {
					event.preventDefault();
					void commitName();
				}}
			>
				<input
					aria-label="Name"
					value={nameDraft}
					disabled={nameBusy}
					oninput={(event) => (nameDraft = event.currentTarget.value)}
					onkeydown={(event) => {
						if (event.key === 'Escape') {
							event.preventDefault();
							event.stopPropagation();
							renaming = false;
							nameDraft = nameWriter!.value;
							nameError = null;
						}
					}}
				/>
				<button type="submit" disabled={nameBusy}>Rename</button>
			</form>
			{#if nameError}
				<p class="error" role="alert">{nameError}</p>
			{/if}
		{/if}
		{#if actionsOpen}
			<div class="subject-actions" data-card-actions>
				{#if nameWriter}<button type="button" onclick={() => (renaming = true)}>Rename</button>
				{/if}

				{#each actions as action (`${action.adapterId}:${action.id}`)}
					<button
						type="button"
						class:destructive={action.destructive === true}
						data-card-action={action.id}
						disabled={actionBusy}
						onclick={() => void runAction(action)}
					>
						{confirming === confirmationKeyOf(action) ? `Confirm ${action.label}` : action.label}
					</button>
				{/each}
				{#if confirming !== null}<button
						type="button"
						onclick={() => {
							confirming = null;
							actionMessage = null;
						}}>Cancel</button
					>{/if}
				{#if actionMessage}
					<p class="error" role="alert">{actionMessage}</p>
				{/if}
				<button
					type="button"
					onclick={() => (technicalOpen = !technicalOpen)}
					aria-expanded={technicalOpen}>Technical identity</button
				>
				{#if technicalOpen}
					<dl class="facts">
						<dt>Canonical ID</dt>
						<dd>{identity.sourceId}</dd>
						{#each technicalFacts as fact (fact.label)}
							<dt>{fact.label}</dt>
							<dd>{fact.value}</dd>
						{/each}
					</dl>{/if}
			</div>
		{/if}
		{#if writer?.view}
			<div class="writer" data-card-writer={writer.summary}>
				<writer.view.component services={writer.view.services} {detailOpen} {footer} />
			</div>
		{:else}
			{#if ordinaryFacts.length > 0}<dl class="facts">
					{#each ordinaryFacts.filter((fact) => fact.label
							.toLowerCase()
							.includes('area')) as fact (fact.label)}<dt>{fact.label}</dt>
						<dd>{fact.value}</dd>{/each}
				</dl>{/if}
			{@render footer()}
		{/if}
		{#if detailOpen}
			{#if relations.length}<div class="relation-links">
					{#each relations as relation}<button type="button" onclick={relation.onNavigate}
							>{relation.label}<ShellIcon name="chevronRight" size={12} /></button
						>{/each}
				</div>{/if}
			<dl class="facts relations">
				{#each ordinaryFacts.filter((fact) => !fact.label
							.toLowerCase()
							.includes('area')) as fact (fact.label)}<dt>{fact.label}</dt>
					<dd>{fact.value}</dd>{/each}
			</dl>
		{/if}
	</aside>
{/if}

<style>
	.card {
		position: absolute;
		top: 10px;
		right: calc(var(--sheet-lane-right, 40px) + 18px);
		z-index: 12;
		width: var(--shell-card-width, 288px);
		max-width: calc(100% - 76px);
		max-height: calc(100% - var(--lower-column-height, 50px) - 30px);
		overflow: auto;
		border: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 12px;
		background: #fff;
		color: var(--shell-ink, #1b201c);
		box-shadow: var(--shell-shadow);
		font: 13px/1.35 var(--shell-sans, system-ui);
		transition: opacity 140ms;
	}

	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 7px 6px 0 12px;
	}
	.kind {
		color: var(--shell-ink-2, #4a524c);
		font-size: 11px;
	}
	.head-actions {
		display: flex;
	}
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
		background: var(--shell-leaf-tint, #e7f1ea);
	}
	.head-actions button,
	.footer button:not(.more) {
		width: 24px;
		padding: 0;
	}

	.name {
		margin: 0 12px 6px;
		font: 400 19px/1.2 var(--shell-serif, Georgia);
	}
	.name button {
		display: block;
		max-width: 100%;
		padding: 0;
		font: inherit;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: left;
	}
	.rename {
		display: flex;
		gap: 4px;
		margin: 0 12px 8px;
	}
	.rename input {
		min-width: 0;
		width: 100%;
		height: 26px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 6px;
		padding: 0 6px;
		font: 12px var(--shell-mono, monospace);
	}
	.footer {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px 8px 10px;
		border-top: 1px solid var(--shell-hairline, #e1e4de);
	}
	.look {
		color: var(--shell-ink-2, #4a524c);
		font-size: 11px;
	}
	.more {
		margin-left: auto;
		font-size: 11.5px;
	}

	.facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 3px 8px;
		margin: 0;
		padding: 8px 12px;
		font-size: 12px;
	}

	dt {
		color: var(--shell-ink-2, #4a524c);
	}

	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.relation-links {
		display: grid;
		padding: 8px 12px;
		border-top: 1px solid var(--shell-hairline);
		font-size: 12px;
	}
	.relation-links button {
		justify-content: space-between;
	}
	.relations {
		border-top: 1px solid var(--shell-hairline, #e1e4de);
	}
	.subject-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 8px 12px;
		background: var(--shell-index, #f6f7f5);
	}
	.error {
		color: var(--shell-refuse, #7e2718);
		font-size: 12px;
		padding: 0 12px;
	}
	.destructive {
		color: var(--shell-refuse, #7e2718);
	}
	button[aria-disabled='true'] {
		opacity: 0.4;
	}
	.card.gesturing {
		opacity: 0.2;
		pointer-events: none;
	}
	@media (max-width: 860px) {
		.card {
			width: 252px;
		}
	}
	@media (pointer: coarse) {
		button,
		.head-actions button,
		.footer button:not(.more),
		.rename input {
			min-width: 44px;
			min-height: 44px;
		}
	}
</style>
