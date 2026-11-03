<script lang="ts">
	/**
	 * Compact identity and one contributed writer. More expands the Card in place
	 * (secondary dimensions and relations); `•••` holds the subject's functions.
	 */
	import { untrack, tick, type Snippet } from 'svelte';
	import ShellIcon from './ShellIcon.svelte';
	import type {
		StageCardActionRecord,
		StageCardFact,
		StageCardWriterRecord
	} from '../stage-facade';

	/** Fields the identity header itself shows; a fact for one of them is not repeated. */
	const HEADER_FIELD_IDS: ReadonlySet<string> = new Set(['name', 'kind']);

	/**
	 * Review pass 2 §4: `•••` holds the subject's *functions*. The ones not built
	 * yet are shown, disabled, with a quiet `Soon`, so the menu already reads as
	 * what it will become; Erase (the contributed destructive action) is last.
	 */
	const FUNCTIONS: Readonly<Record<'wall' | 'room' | 'opening' | 'object', readonly string[]>> = {
		wall: ['Face this wall', 'Unroll the room', 'Section through here', 'Paint…', 'Present this in Experience'],
		room: ['Unroll the room', 'Section through here', 'Paint floor…', 'Present this in Experience'],
		opening: ['Face this opening', 'Section through here', 'Present this in Experience'],
		object: ['Face this', 'Section through here', 'Paint…', 'Present this in Experience']
	};
	function functionKind(kind: string): keyof typeof FUNCTIONS {
		const word = kind.toLowerCase();
		return word === 'wall' || word === 'room' || word === 'opening' ? word : 'object';
	}
	/** More stays open per subject kind for the session, as the plan asks. */
	const moreByKind = new Map<string, boolean>();

	let {
		identity,
		facts,
		nameWriter = null,
		writer = null,
		actions = [],
		onClose,
		gesturing = false,
		renameRequest = 0,
		functions = null,
		kindLink = null,
		menu = null,
		onBringIntoView = null
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
		 * PLATE arbitration: at constrained width the Card collapses to identity with
		 * explicit expansion, so it never covers the task's lower column.
		 */
		onClose: () => void;
		/** Bring into view, or null for a subject with no spatial place (an Experience Presentation or Stop). */
		onBringIntoView: (() => void) | null;
		/**
		 * The `•••` functions for this subject, or null for the World table. An Experience
		 * subject passes an empty list: it has no functions yet, so the menu is not shown.
		 */
		functions?: readonly string[] | null;
		/**
		 * A link after the kind word, such as "View in" + "The Pleyel piano": the kind text
		 * already carries the connecting words, so the link is only the named target. Null
		 * for a subject with nothing to open from its header.
		 */
		kindLink?: { readonly label: string; readonly onOpen: () => void } | null;
		/**
		 * The `•••` menu for this subject, replacing the `functions` list when not null. Each
		 * item runs once and closes the panel; a disabled item states its `reason` as the
		 * title and to assistive technology. Null keeps the `functions` / `actions` behaviour.
		 */
		menu?: readonly {
			readonly id: string;
			readonly label: string;
			/** A quiet right-aligned hint, such as a shortcut or the kind of change. */
			readonly hint?: string;
			readonly disabled?: boolean;
			/** Why a disabled item cannot run; shown as the title and read as hidden text. */
			readonly reason?: string;
			readonly run: () => void;
		}[] | null;
		/**
		 * R217.S22 (D36): a live authored gesture on the Stage. The Card fades and takes no
		 * pointer events until it ends, so the subject being edited stays visible. Only the
		 * lease changes this; the Card's position, fold and facts do not.
		 */
		gesturing?: boolean;
		/** Each increment opens the inline name editor (an Index row double-click). */
		renameRequest?: number;
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
	let moreOpen = $state(false);
	let actionTrigger = $state<HTMLButtonElement>();
	let panel = $state<HTMLDivElement>();
	let titleButton = $state<HTMLButtonElement>();
	let nameInput = $state<HTMLInputElement>();
	const identityKey = $derived(identity?.sourceId ?? null);
	/** The `•••` functions: the route's own list when it states one, else the World table for this kind. */
	const subjectFunctions = $derived.by((): readonly string[] => {
		if (functions !== null) return functions;
		return identity === null ? [] : FUNCTIONS[functionKind(identity.kind)];
	});
	/** `•••` is shown only when the subject has a function or an action to hold. */
	const hasSubjectActions = $derived(
		(menu !== null ? menu.length > 0 : subjectFunctions.length > 0) || actions.length > 0
	);
	$effect(() => {
		void identityKey;
		renaming = false;
		detailOpen = false;
		nameError = null;
		moreOpen = untrack(() => (identity === null ? false : moreByKind.get(identity.kind) ?? false));
	});
	// Declared after the subject reset, so a request arriving with a new
	// selection is honoured after that reset rather than cleared by it.
	$effect(() => {
		if (renameRequest === 0) return;
		untrack(() => {
			if (nameWriter !== null) startRename();
		});
	});
	function toggleMore(): void {
		moreOpen = !moreOpen;
		if (identity !== null) moreByKind.set(identity.kind, moreOpen);
	}
	/**
	 * The Card's own read-only rows in More: what the writer does not already show.
	 * The level Datum is a level fact, not a relation of this subject.
	 */
	const relationFacts = $derived(
		ordinaryFacts.filter((fact) => !fact.label.toLowerCase().includes('area') && fact.label !== 'Datum')
	);
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
		} catch {
			actionMessage = 'The action could not be completed. Try again.';
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
			nameError = 'Enter a name.';
			return;
		}
		nameBusy = true;
		nameError = null;
		const target = identityKey;
		const currentWriter = nameWriter;
		try {
			const outcome = await currentWriter.commit(name);
			if (target !== identityKey) return;
			if (outcome.kind !== 'accepted') {
				nameError = outcome.message ?? 'The name was not accepted.';
				return;
			}
			nameDraft = name;
			renaming = false;
			await tick();
			titleButton?.focus();
		} catch {
			if (target === identityKey) nameError = 'The name could not be saved. Try again.';
		} finally {
			// A throwing writer ends the attempt too; leaving `nameBusy` true would
			// disable the rename affordance for the rest of the selection.
			nameBusy = false;
			await tick();
			if (target === identityKey && renaming) nameInput?.focus();
		}
	}

	function closePanel(): void {
		detailOpen = false;
		confirming = null;
		actionMessage = null;
		actionTrigger?.focus();
	}
	function onOutside(event: PointerEvent): void {
		if (!detailOpen || !(event.target instanceof Node)) return;
		if (panel?.contains(event.target) || actionTrigger?.contains(event.target)) return;
		closePanel();
	}
	function startRename(): void {
		if (!nameWriter || nameBusy) return;
		nameDraft = nameWriter.value;
		nameError = null;
		renaming = true;
	}
	function cancelRename(): void {
		renaming = false;
		nameDraft = nameWriter?.value ?? '';
		nameError = null;
	}
	function focusName(input: HTMLInputElement) {
		input.focus();
		input.select();
	}
</script>

<svelte:window onpointerdowncapture={onOutside} />

{#snippet footer()}
	<div class="footer">
		{#if onBringIntoView}<button type="button" aria-label="Bring into view" title="Bring into view" onclick={() => onBringIntoView?.()}><ShellIcon name="fit" size={15} /></button>{/if}
		<button type="button" class="more" aria-expanded={moreOpen} data-card-more onclick={toggleMore}
			>More <span class="chev" class:open={moreOpen} aria-hidden="true">⌄</span></button>
	</div>
{/snippet}

{#snippet more(content?: Snippet)}
	{#if moreOpen}
		<section class="more-section" aria-label="More details" data-card-more-section>
			{#if content}<div class="more-dims">{@render content()}</div>{/if}
			{#if relationFacts.length > 0}
				<h3>Relations</h3>
				<dl class="facts">
					{#each relationFacts as fact (fact.label)}<dt>{fact.label}</dt><dd>{fact.value}</dd>{/each}
				</dl>
			{/if}
		</section>
	{/if}
{/snippet}

{#snippet secondary(content?: Snippet)}
	{#if detailOpen}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="subject-actions" bind:this={panel} data-card-actions role="group" aria-label="Subject actions"
			onkeydown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePanel(); } }}>
			{#if menu !== null}
				{#each menu as item (item.id)}
					<button type="button" class="menu-item" disabled={item.disabled === true} title={item.disabled === true ? item.reason : undefined}
						data-card-menu={item.id}
						onclick={() => { item.run(); closePanel(); }}>{item.label}{#if item.hint}<span class="hint">{item.hint}</span>{/if}{#if item.disabled === true && item.reason}<span class="sr-only">{item.reason}</span>{/if}</button>
				{/each}
			{:else if identity}
				{#each subjectFunctions as name (name)}
					<button type="button" class="soon" disabled title="Coming soon" data-card-function={name}>{name}<span class="soon-cue">Soon</span></button>
				{/each}
			{/if}
			{#if content}{@render content()}{/if}
			{#each actions.filter((action) => action.destructive !== true) as action (`${action.adapterId}:${action.id}`)}
				<button type="button" data-card-action={action.id} disabled={actionBusy} onclick={() => void runAction(action)}>{action.label}</button>
			{/each}
			{#if actions.some((action) => action.destructive === true)}<hr />{/if}
			{#each actions.filter((action) => action.destructive === true) as action (`${action.adapterId}:${action.id}`)}
				<button type="button" class="destructive" data-card-action={action.id} aria-label={action.label}
					disabled={actionBusy} onclick={() => void runAction(action)}>
					{confirming === confirmationKeyOf(action) ? 'Confirm erase' : 'Erase'}
				</button>
			{/each}
			{#if confirming !== null}<button type="button" onclick={() => { confirming = null; actionMessage = null; }}>Cancel</button>{/if}
			{#if actionMessage}<p class="error" role="alert">{actionMessage}</p>{/if}
		</div>
	{/if}
{/snippet}
{#if identity}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
	<aside
		class="card"
		class:gesturing
		aria-label="Selected subject"
		onkeydown={event => {
			if (event.key !== 'Escape' || event.defaultPrevented) return;
			if (detailOpen) { event.preventDefault(); event.stopPropagation(); closePanel(); }
			// Escape collapses More before it is left to the shell to close the Card.
			else if (moreOpen) { event.preventDefault(); event.stopPropagation(); toggleMore(); }
		}}
		onpointerdown={event => event.stopPropagation()}
		onclick={event => event.stopPropagation()}
		data-source-id={identity.sourceId}
		data-card-gesturing={gesturing ? 'true' : 'false'}
	>
		<header class="card-head">
			<span class="kind">{identity.kind}{#if kindLink}{@const link = kindLink} <button type="button" class="kind-link" onclick={() => link.onOpen()}>{link.label}</button>{/if}</span>
			<div class="head-actions">
				{#if hasSubjectActions}<button
					type="button"
					aria-label="Subject actions"
					bind:this={actionTrigger}
					aria-expanded={detailOpen}
					onclick={() => { if (detailOpen) closePanel(); else detailOpen = true; }}><ShellIcon name="more" size={15} /></button
				>{/if}
				<button type="button" aria-label="Close selection card" onclick={onClose}
					><ShellIcon name="close" size={15} /></button
				>
			</div>
		</header>
		<h2 class="name" title={identity.label}>
			{#if renaming && nameWriter}
				<input class="rename-input" aria-label="Name" bind:this={nameInput} use:focusName value={nameDraft} disabled={nameBusy}
					oninput={event => nameDraft = event.currentTarget.value}
					onblur={() => { if (!nameBusy) cancelRename(); }}
					onkeydown={event => {
						if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); void commitName(); }
						if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelRename(); void tick().then(() => titleButton?.focus()); }
					}} />
			{:else}
				<button type="button" bind:this={titleButton} aria-label={nameWriter ? `Rename ${identity.label}` : identity.label}
					ondblclick={startRename}
					onpointerup={event => { if (event.pointerType === 'touch') startRename(); }}
					onkeydown={event => { if (event.key === 'Enter' || event.key === 'F2') { event.preventDefault(); startRename(); } }}>{identity.label}</button>
			{/if}
		</h2>
		{#if nameError}<p class="error" role="alert">{nameError}</p>{/if}
		{#if writer?.view}
			<div class="writer" data-card-writer={writer.summary}>
				<writer.view.component services={writer.view.services} detailOpen={moreOpen} {footer} {secondary} {more} />
			</div>
		{:else}
			{#if ordinaryFacts.length > 0}<dl class="facts">
					{#each ordinaryFacts.filter((fact) => fact.label
							.toLowerCase()
							.includes('area')) as fact (fact.label)}<dt>{fact.label}</dt>
						<dd>{fact.value}</dd>{/each}
				</dl>{/if}
			{@render footer()}
			{@render more()}
			{@render secondary()}
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
		overflow: visible;
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
	.kind-link {
		min-height: 0;
		padding: 0;
		border-radius: 0;
		background: none;
		color: var(--shell-ink-2, #4a524c);
		text-decoration: underline;
		text-decoration-color: var(--shell-hairline-strong, #b9bfb8);
		text-underline-offset: 2px;
	}
	.kind-link:hover {
		background: none;
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
		background: var(--shell-hover, #eef0ed);
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
	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 4px;
		padding: 4px 8px 8px 10px;
		border-top: 1px solid var(--shell-hairline, #e1e4de);
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
		.footer button,
		.rename-input {
			min-width: 44px;
			min-height: 44px;
		}
	}

	.subject-actions {
		position: absolute;
		top: 34px;
		right: 6px;
		z-index: 30;
		width: min(264px, calc(100vw - 100px));
		max-height: calc(100dvh - 160px);
		overflow: auto;
		display: grid;
		gap: 4px;
		padding: 8px;
		border: 1px solid var(--shell-hairline);
		border-radius: 10px;
		background: var(--shell-card, white);
		box-shadow: var(--shell-shadow);
	}
	.subject-actions button { justify-content: flex-start; min-height: 30px; }
	.subject-actions hr { width: 100%; margin: 2px 0; border: 0; border-top: 1px solid var(--shell-hairline, #e1e4de); }
	.soon { justify-content: space-between !important; color: var(--shell-ink-2, #4a524c); cursor: default; }
	.soon:hover { background: transparent; }
	.menu-item .hint { margin-left: auto; padding-left: 8px; color: var(--shell-ink-2, #4a524c); font-size: 11px; }
	.menu-item:disabled { color: var(--shell-ink-2, #4a524c); cursor: default; }
	.menu-item:disabled:hover { background: transparent; }
	.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
	.soon-cue { margin-left: auto; padding: 0 5px; border-radius: 4px; background: var(--shell-index, #f6f7f5); font-size: 10px; letter-spacing: .02em; }
	.footer .more { gap: 3px; font-size: 12px; color: var(--shell-ink-2, #4a524c); }
	.chev { display: inline-block; transition: transform 120ms; }
	.chev.open { transform: rotate(180deg); }
	.more-section { padding: 6px 0 4px; border-top: 1px solid var(--shell-hairline, #e1e4de); }
	.more-section h3 { margin: 4px 12px 0; font: 600 10.5px/1.2 var(--shell-sans, system-ui); color: var(--shell-ink-2, #4a524c); letter-spacing: .03em; text-transform: uppercase; }
	.more-section .facts { padding-top: 4px; }
	.rename-input { box-sizing: border-box; width: 100%; min-width: 0; font: inherit; color: inherit; border: 1px solid var(--shell-hairline-strong); border-radius: 5px; padding: 3px 5px; }
	@media (pointer: coarse) { .subject-actions button, .rename-input { min-height: 44px; } }
</style>
