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

	/**
	 * R217.S26 — what a danger item discloses before it runs: the consequence block reads
	 * the effect lines (and, when the removal needs one, a choice such as the new Default)
	 * and runs only after the creator presses Remove. It is shown in place, never as a modal.
	 */
	type CardConsequence = {
		read(choice: string | null):
			| { readonly kind: 'refused'; readonly reason: string }
			| {
					readonly kind: 'ready';
					readonly lines: readonly string[];
					readonly choose: { readonly label: string; readonly options: readonly { readonly id: string; readonly label: string }[] } | null;
					readonly runnable: boolean;
			  };
		run(choice: string | null): unknown;
	};
	type CardMenuItem = {
		readonly id: string;
		readonly label: string;
		/** A quiet right-aligned hint, such as a shortcut or the kind of change. */
		readonly hint?: string;
		readonly disabled?: boolean;
		/** Why a disabled item cannot run; shown as its hint, its title and to assistive technology. */
		readonly reason?: string;
		/** R217.S26: a destructive item. It sits at the end after a rule, in red, and runs through `consequence`. */
		readonly danger?: boolean;
		readonly consequence?: CardConsequence;
		/** R217.S26: a submenu (such as Add to Guide ▸); the item opens it in place instead of running. */
		readonly children?: readonly CardMenuItem[];
		readonly run?: () => void;
	};

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
		back = null,
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
			/** R217.S26: blur commits too (the Experience rename fields); Esc still cancels. */
			readonly commitOnBlur?: boolean;
			/** The refusal an empty name shows; `Enter a name.` when absent. */
			readonly emptyMessage?: string;
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
		menu?: readonly CardMenuItem[] | null;
		/**
		 * R217.S26 (E17): the previous selection, when it is not the kind line's parent. The kind
		 * line shows it as *‹ Stop 2* before the kind; it changes what is looked at, never undoes.
		 */
		back?: { readonly label: string; readonly onBack: () => void } | null;
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
	/** The inline destructive action that opened its confirmation, for focus return. */
	let inlineActionTrigger = $state<HTMLButtonElement>();
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
		disclosing = null;
		openSubmenu = null;
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

	/** Cancel returns the creator to the action whose consequences they just read. */
	async function cancelInlineAction(): Promise<void> {
		confirming = null;
		actionMessage = null;
		await tick();
		if (inlineActionTrigger?.isConnected) inlineActionTrigger.focus();
	}

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
	async function runAction(action: (typeof actions)[number], trigger?: HTMLButtonElement): Promise<void> {
		if (actionBusy) return;
		const key = confirmationKeyOf(action);
		if (action.destructive === true && confirming !== key) {
			inlineActionTrigger = trigger;
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
			nameError = nameWriter.emptyMessage ?? 'Enter a name.';
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
		openSubmenu = null;
		confirming = null;
		actionMessage = null;
		actionTrigger?.focus();
	}

	/** The menu's ordinary items first; danger items after a rule, at the end (R217.S26). */
	const ordinaryItems = $derived((menu ?? []).filter((item) => item.danger !== true));
	const dangerItems = $derived((menu ?? []).filter((item) => item.danger === true));
	let openSubmenu = $state<string | null>(null);
	/** The danger item whose consequence block is open in the Card, and the creator's choice in it. */
	let disclosing = $state<{ readonly item: CardMenuItem; readonly choice: string | null } | null>(null);
	let consequenceBusy = $state(false);
	const disclosed = $derived(disclosing?.item.consequence?.read(disclosing.choice) ?? null);
	function runItem(item: CardMenuItem): void {
		if (item.children !== undefined) {
			openSubmenu = openSubmenu === item.id ? null : item.id;
			return;
		}
		if (item.danger === true && item.consequence !== undefined) {
			detailOpen = false;
			openSubmenu = null;
			disclosing = { item, choice: null };
			return;
		}
		item.run?.();
		closePanel();
	}
	function cancelConsequence(): void {
		disclosing = null;
		void tick().then(() => actionTrigger?.focus());
	}
	async function confirmConsequence(): Promise<void> {
		const open = disclosing;
		if (open === null || disclosed?.kind !== 'ready' || !disclosed.runnable || consequenceBusy) return;
		consequenceBusy = true;
		try {
			await open.item.consequence?.run(open.choice);
		} finally {
			consequenceBusy = false;
			disclosing = null;
			await tick();
			actionTrigger?.focus();
		}
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
	/** The consequence block takes focus on open, so the keyboard reaches its choices and Esc. */
	function focusFirst(button: HTMLButtonElement) {
		const block = button.closest('section');
		const target = block?.querySelector<HTMLElement>('input, button:not(:disabled)') ?? button;
		target.focus();
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
			onkeydown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (openSubmenu !== null) openSubmenu = null; else closePanel(); } }}>
			{#if menu !== null}
				{#snippet menuItem(item: CardMenuItem, nested: boolean)}
					{@const shownHint = item.disabled === true && item.reason ? item.reason : item.hint}
					<button type="button" class="menu-item" class:danger={item.danger === true} class:nested disabled={item.disabled === true} title={item.disabled === true ? item.reason : undefined}
						data-card-menu={item.id}
						aria-expanded={item.children !== undefined ? openSubmenu === item.id : undefined}
						onclick={() => runItem(item)}>{item.label}{#if item.children !== undefined}<span class="hint" aria-hidden="true">{openSubmenu === item.id ? '▾' : '▸'}</span>{:else if shownHint}<span class="hint" aria-hidden={item.disabled === true ? 'true' : undefined}>{shownHint}</span>{/if}{#if item.disabled === true && item.reason}<span class="sr-only">{item.reason}</span>{/if}</button>
					{#if item.children !== undefined && openSubmenu === item.id}
						<div class="submenu" role="group" aria-label={item.label} data-card-submenu={item.id}>
							{#each item.children as child (child.id)}{@render menuItem(child, true)}{/each}
						</div>
					{/if}
				{/snippet}
				{#each ordinaryItems as item (item.id)}{@render menuItem(item, false)}{/each}
				{#if dangerItems.length > 0}<hr />{/if}
				{#each dangerItems as item (item.id)}{@render menuItem(item, false)}{/each}
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
					disabled={actionBusy}
					onclick={(event) => void runAction(action, event.currentTarget)}>
					{confirming === confirmationKeyOf(action) ? 'Confirm erase' : 'Erase'}
				</button>
			{/each}
			{#if confirming !== null}<button type="button" onclick={cancelInlineAction}>Cancel</button>{/if}
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
			<span class="kind">{#if back}{@const previous = back}<button type="button" class="back-link" aria-label={`Back to ${previous.label}`} title="Back (Alt+←)" data-card-back onclick={() => previous.onBack()}>‹ {previous.label}</button> {/if}{identity.kind}{#if kindLink}{@const link = kindLink} <button type="button" class="kind-link" onclick={() => link.onOpen()}>{link.label}</button>{/if}</span>
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
					onblur={() => { if (nameBusy) return; if (nameWriter?.commitOnBlur === true && nameDraft.trim() !== '') void commitName(); else cancelRename(); }}
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
		{#if disclosing !== null && disclosed !== null}
			{@const open = disclosing}
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<section class="consequence" role="group" aria-label={`${open.item.label}?`} data-card-consequence={open.item.id}
				onkeydown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelConsequence(); } }}>
				{#if disclosed.kind === 'refused'}
					<p class="consequence-line" role="alert">{disclosed.reason}</p>
				{:else}
					{#each disclosed.lines as line, index (index)}<p class="consequence-line">{line}</p>{/each}
					{#if disclosed.choose !== null}
						<fieldset class="consequence-choice">
							<legend>{disclosed.choose.label}</legend>
							{#each disclosed.choose.options as option (option.id)}
								<label><input type="radio" name="card-consequence-choice" value={option.id} checked={open.choice === option.id}
									onchange={() => (disclosing = { item: open.item, choice: option.id })} />{option.label}</label>
							{/each}
						</fieldset>
					{/if}
				{/if}
				<div class="consequence-actions">
					<button type="button" class="remove" use:focusFirst disabled={disclosed.kind !== 'ready' || !disclosed.runnable || consequenceBusy}
						data-card-consequence-run onclick={() => void confirmConsequence()}>Remove</button>
					<button type="button" class="cancel" data-card-consequence-cancel onclick={cancelConsequence}>Cancel</button>
				</div>
			</section>
		{/if}
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
		right: var(--card-right, calc(var(--sheet-lane-right, 40px) + 18px));
		z-index: 12;
		width: var(--shell-card-width);
		max-width: calc(100% - 76px);
		max-height: calc(100% - var(--card-bottom-clearance, calc(var(--lower-column-height, 50px) + 30px)));
		overflow: visible;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--shell-hairline);
		border-radius: 12px;
		background: var(--shell-surface-raised);
		color: var(--shell-ink);
		box-shadow: var(--shell-shadow);
		font: var(--shell-text-body)/1.35 var(--shell-sans);
		transition: opacity 140ms;
	}

	.card-head,
	.name,
	.card > .error { flex: none; }
	/* Identity stays put; a long writer scrolls under it instead of spilling past the Card. */
	.writer {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		border-radius: 0 0 12px 12px;
		scrollbar-width: thin;
		scrollbar-color: var(--shell-hairline-strong) transparent;
	}
	.writer::-webkit-scrollbar { width: 8px; }
	.writer::-webkit-scrollbar-track { background: transparent; }
	.writer::-webkit-scrollbar-thumb {
		border: 2px solid transparent;
		border-radius: 8px;
		background: var(--shell-hairline-strong) padding-box;
	}
	.writer::-webkit-scrollbar-thumb:hover { background-color: var(--shell-ink-3); }
	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 7px 6px 0 12px;
	}
	.kind {
		color: var(--shell-ink-3);
		font-size: var(--shell-text-label);
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}
	.kind-link {
		min-height: 0;
		margin-left: 0.25em;
		padding: 0;
		border-radius: 0;
		background: none;
		color: var(--shell-ink-2);
		text-decoration: underline;
		text-decoration-color: var(--shell-hairline-strong);
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
		background: var(--shell-hover);
	}
	.head-actions button,
	.footer button:not(.more) {
		width: 24px;
		padding: 0;
	}

	.name {
		margin: 0 12px 6px;
		font: 600 var(--shell-text-title)/1.3 var(--shell-sans);
		letter-spacing: -0.01em;
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
		border-top: 1px solid var(--shell-hairline);
	}

	.facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 3px 8px;
		margin: 0;
		padding: 8px 12px;
		font-size: var(--shell-text-control);
	}

	dt {
		color: var(--shell-ink-2);
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
		background: var(--shell-surface-sunken);
	}
	.error {
		color: var(--shell-refuse);
		font-size: var(--shell-text-control);
		padding: 0 12px;
	}
	.destructive {
		color: var(--shell-refuse);
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
	/* Narrow Stages leave the Guide no room beside the Card, so the Card stops above the whole lower column. */
	@media (max-width: 1180px) {
		.card {
			max-height: calc(100% - var(--lower-column-height, 50px) - 30px);
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
		background: var(--shell-popover);
		box-shadow: var(--shell-shadow);
	}
	.subject-actions button { justify-content: flex-start; min-height: var(--shell-control-height); }
	.subject-actions hr { width: 100%; margin: 2px 0; border: 0; border-top: 1px solid var(--shell-hairline); }
	.soon { justify-content: space-between !important; color: var(--shell-ink-2); cursor: default; }
	.soon:hover { background: transparent; }
	.menu-item .hint { margin-left: auto; padding-left: 8px; color: var(--shell-ink-2); font-size: var(--shell-text-label); }
	.menu-item:disabled { color: var(--shell-ink-2); cursor: default; }
	.menu-item:disabled:hover { background: transparent; }
	.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
	.soon-cue { margin-left: auto; padding: 0 5px; border-radius: 4px; background: var(--shell-surface-sunken); font-size: var(--shell-text-meta); letter-spacing: .02em; }
	.footer .more { gap: 3px; font-size: var(--shell-text-utility); color: var(--shell-ink-2); }
	.chev { display: inline-block; transition: transform 120ms; }
	.chev.open { transform: rotate(180deg); }
	.more-section { padding: 6px 0 4px; border-top: 1px solid var(--shell-hairline); }
	.more-section h3 { margin: 4px 12px 0; font: 600 var(--shell-text-label)/1.2 var(--shell-sans); color: var(--shell-ink-2); letter-spacing: .06em; text-transform: uppercase; }
	.more-section .facts { padding-top: 4px; }
	.rename-input { box-sizing: border-box; width: 100%; min-width: 0; padding: 3px 5px; border: 1px solid var(--shell-field-line); border-radius: 5px; background: var(--shell-field); color: inherit; font: inherit; }
	.menu-item.danger { color: var(--shell-refuse); }
	.menu-item.danger:disabled { color: var(--shell-ink-2); }
	.menu-item.nested { padding-left: 18px; }
	.submenu { display: grid; gap: 2px; }
	.back-link { min-height: 0; margin-right: 0; padding: 0; color: var(--shell-ink-2); font-size: var(--shell-text-label); }
	/* Review round 3: a hairline divides the back link from the kind, never run together. */
	.back-link::after { content: ''; display: inline-block; width: 1px; height: 10px; margin: 0 0.55em; background: var(--shell-hairline-strong); vertical-align: -1px; }
	.back-link:hover { background: none; color: var(--shell-ink); }
	.consequence { display: grid; gap: 6px; margin: 0 12px 8px; padding: 8px 10px; border: 1px solid var(--shell-refuse); border-radius: 8px; background: var(--shell-surface-sunken); font-size: var(--shell-text-control); }
	.consequence-line { margin: 0; color: var(--shell-ink); line-height: 1.4; }
	.consequence-choice { display: grid; gap: 4px; margin: 0; padding: 0; border: 0; }
	.consequence-choice legend { padding: 0; color: var(--shell-ink-2); font-size: var(--shell-text-label); }
	.consequence-choice label { display: flex; align-items: center; gap: 6px; accent-color: var(--shell-action); }
	.consequence-actions { display: flex; gap: 6px; }
	.consequence-actions button { min-height: 28px; padding: 0 11px; border: 1px solid var(--shell-hairline-strong); font-weight: 600; }
	.consequence-actions .remove { border-color: var(--shell-refuse); background: var(--shell-refuse); color: var(--shell-on-action); }
	.consequence-actions .remove:hover { background: var(--shell-refuse); }
	.consequence-actions .remove:disabled { opacity: 0.45; cursor: not-allowed; }
	@media (pointer: coarse) { .subject-actions button, .rename-input, .consequence-actions button, .consequence-choice label, .back-link { min-height: 44px; } }
</style>
