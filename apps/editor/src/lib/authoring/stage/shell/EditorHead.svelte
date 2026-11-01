<script lang="ts">
	/**
	 * PLATE **Head** (§0.8): one compact row in the wireframe's order.
	 *
	 * Index toggle · Biskiq · project name (its disclosure holds the project actions)
	 * · World | Experience · context chip while the Index is away · Find · Undo ·
	 * Redo · Save · Preview.
	 *
	 * Head owns application actions, not a second task toolbar, and stays one row at
	 * every desktop and tablet width. Eligibility and refusal semantics are unchanged:
	 * a control that cannot act stays focusable with `aria-disabled` (a native
	 * `disabled` control could not take focus, so its reason could not be reached),
	 * and its reason is a focus, hover and tap disclosure with an accessible
	 * description. The row holds no viewing or drafting value: those live in the
	 * Stage's ⚙, and Keys live in Find. This component reaches no persistence
	 * function, and downloading source JSON is a pure serialization of the admitted
	 * source the caller already holds.
	 */
	import { tick, untrack } from 'svelte';
	import { resolveRovingIndex, tablistTabIndex } from '$lib/authoring/a11y/roving-focus';
	import type { HeadSave } from '$lib/authoring/save/head-save';
	import type { ReloadOffer } from '$lib/authoring/save/save-state';
	import ProjectLifecycleActions from '$lib/platform/ProjectLifecycleActions.svelte';
	import { perfMeasureSync } from '$lib/platform/perf-marks';
	import type {
		PreparedProjectLifecycle,
		ProjectLifecycleActionResult,
		ProjectLifecyclePrepareResult
	} from '$lib/platform/project-persistence';

	/**
	 * One contributed tool, operation or former menu capability the Head's Find can
	 * reach.
	 *
	 * The host supplies the entry; the Head renders it and hands the **same** object
	 * back when it is run, so neither side has to reconstruct the other's vocabulary.
	 * The one exception is the project procedures (`project-menu` rename and delete):
	 * they open the Head's own lifecycle dialog, so the Head runs them itself.
	 */
	export type HeadFindEntry = {
		readonly id: string;
		readonly adapterId: string;
		readonly label: string;
		readonly verb: string;
	};

	/** The adapter id of the project procedures the Head's own menu hosts. */
	const PROJECT_ADAPTER = 'project-menu';

	const uid = $props.id();

	let {
		projectId,
		projectName,
		lens,
		onLens,
		canDownloadSource,
		onDownloadSource,
		onOpenSource = () => {},
		historyUnavailableReason,
		redoUnavailableReason = historyUnavailableReason,
		canUndo = false,
		canRedo = false,
		onUndo = () => {},
		onRedo = () => {},
		saveUnavailableReason,
		/**
		 * T1.P01.S04's Head Save integration. Present only when the composition root
		 * mounts T3.P01.S02's state machine; absent keeps the previous read-only
		 * posture and its visible reason.
		 */
		save = null,
		onReloadRemote = () => {},
		canPreview = false,
		onPreview = () => {},
		previewUnavailableReason,
		indexOpen = true,
		onToggleIndex = () => {},
		locationLabel = null,
		onOpenIndex = () => {},
		projectActionsUnavailableReason = null,
		projectActionBusy = false,
		onPrepareRename = async () => ({ kind: 'blocked' as const, message: 'Project actions are unavailable.' }),
		onRenameProject = async () => ({ kind: 'refused' as const, message: 'Project actions are unavailable.' }),
		onPrepareDelete = async () => ({ kind: 'blocked' as const, message: 'Project actions are unavailable.' }),
		onDeleteProject = async () => ({ kind: 'refused' as const, message: 'Project actions are unavailable.' }),
		onProjectActionComplete = async () => {},
		onProjectActionBusyChange = () => {},
		onRefreshRemoteProject = null,
		find = null
	}: {
		projectId: string;
		projectName: string;
		lens: 'world' | 'experience';
		onLens: (lens: 'world' | 'experience') => void;
		canDownloadSource: boolean;
		onDownloadSource: () => void;
		/** The project menu's source replacement; the host runs its replacement guard. */
		onOpenSource?: () => void;
		/** Why Undo/Redo cannot run; shown as Undo's disclosure. */
		historyUnavailableReason: string;
		redoUnavailableReason?: string;
		/** Live host history commands (T1.P01.S07 wiring). */
		canUndo?: boolean;
		canRedo?: boolean;
		onUndo?: () => void;
		onRedo?: () => void;
		saveUnavailableReason: string;
		save?: HeadSave | null;
		/** The host's replacement guard receives a conflict reload; Head never installs it. */
		onReloadRemote?: (offer: ReloadOffer) => void;
		/** Whether an isolated visitor Preview can be entered from this source. */
		canPreview?: boolean;
		onPreview?: () => void;
		previewUnavailableReason: string;
		/** Whether the Index is open. The Head's toggle is its only control. */
		indexOpen?: boolean;
		onToggleIndex?: () => void;
		/** The canonical location of the selected subject, or `null` when there is none. */
		locationLabel?: string | null;
		onOpenIndex?: () => void;
		projectActionsUnavailableReason?: string | null;
		projectActionBusy?: boolean;
		onPrepareRename?: () => Promise<ProjectLifecyclePrepareResult>;
		onRenameProject?: (prepared: PreparedProjectLifecycle, name: string) => Promise<ProjectLifecycleActionResult>;
		onPrepareDelete?: () => Promise<ProjectLifecyclePrepareResult>;
		onDeleteProject?: (prepared: PreparedProjectLifecycle) => Promise<ProjectLifecycleActionResult>;
		onProjectActionComplete?: (result: Extract<ProjectLifecycleActionResult, { kind: 'renamed' | 'deleted' | 'unchanged' }>) => void | Promise<void>;
		onProjectActionBusyChange?: (busy: boolean) => void;
		onRefreshRemoteProject?: (() => void | boolean | Promise<void | boolean>) | null;
		/**
		 * The bounded **Find** access: the contributed tools and operations, the former
		 * menu capabilities and Keys, each behind the explicit verb that reaches it. The
		 * host supplies the list; the Head renders no domain tool. Absent keeps the Head
		 * without a Find control.
		 *
		 * It is deliberately not the scope-model Index, a global subject search or every
		 * future Find command: it knows only what the mounted adapters and the route
		 * declared.
		 */
		find?: {
			readonly query: string;
			readonly entries: readonly HeadFindEntry[];
			readonly onQuery: (value: string) => void;
			readonly onRun: (entry: HeadFindEntry) => void;
		} | null;
	} = $props();

	const LENSES = [
		{ id: 'world', label: 'World' },
		{ id: 'experience', label: 'Experience' }
	] as const;

	type ReasonKey = 'undo' | 'redo' | 'save' | 'save-unavailable' | 'preview';

	let selectedLensIndex = $derived(LENSES.findIndex((entry) => entry.id === lens));
	const lensButtons: HTMLButtonElement[] = [];
	let findDisclosure = $state<HTMLDetailsElement>();
	let findSummary = $state<HTMLElement>();
	let findInput = $state<HTMLInputElement>();
	let projectTrigger: HTMLButtonElement | undefined;
	/** The project procedures' own dialog, reached from the menu or from Find. */
	let lifecycle: { start(next: 'rename' | 'delete'): Promise<void> } | undefined;
	let projectMenuOpen = $state(false);
	/** The one open reason disclosure, opened by focus, hover or a tap. */
	let openReason = $state<ReasonKey | null>(null);

	const projectMenuId = $derived(`${uid}-project-menu`);
	function reasonId(key: ReasonKey): string {
		return `${uid}-reason-${key}`;
	}
	function reasonOpen(key: ReasonKey): '' | undefined {
		return openReason === key ? '' : undefined;
	}
	function toggleReason(key: ReasonKey): void {
		openReason = openReason === key ? null : key;
	}

	function findShortcut(event: KeyboardEvent): void {
		if (find === null || event.defaultPrevented || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
		event.preventDefault();
		if (findDisclosure === undefined || findInput === undefined) return;
		findDisclosure.open = true;
		findInput.focus();
	}

	/** A press outside a disclosure closes it; the disclosure's own content keeps it open. */
	function onWindowPointerDown(event: PointerEvent): void {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (openReason !== null && target.closest('[data-reason-owner]') === null) openReason = null;
		if (projectMenuOpen && target.closest('[data-head-project-owner]') === null) projectMenuOpen = false;
	}

	function onProjectKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape' || !projectMenuOpen) return;
		event.stopPropagation();
		projectMenuOpen = false;
		projectTrigger?.focus();
	}

	function toggleProjectMenu(): void {
		projectMenuOpen = !projectMenuOpen;
	}

	/**
	 * Find's project procedures. Rename and delete open this Head's own lifecycle
	 * dialog after the menu is shown, since the dialog lives inside it. Every other
	 * entry goes to the host.
	 */
	async function runFind(entry: HeadFindEntry): Promise<void> {
		// A run closes the list and returns focus to Find, so what it opens (a dialog,
		// a reference) can take focus without the list lying over it.
		if (findDisclosure !== undefined) findDisclosure.open = false;
		findSummary?.focus();
		if (entry.adapterId === PROJECT_ADAPTER && (entry.id === 'rename' || entry.id === 'delete')) {
			projectMenuOpen = true;
			await tick();
			await lifecycle?.start(entry.id);
			return;
		}
		find?.onRun(entry);
	}

	// The Save state notifies on every settled command; this counter is the
	// component's read signal, not a second copy of the state. `subscribe`
	// notifies synchronously on subscription, so the subscription is untracked:
	// otherwise the effect would depend on the counter it writes and Svelte would
	// abort it before the Head ever re-rendered.
	let saveVersion = $state(0);
	$effect(() => {
		const current = save;
		if (current === null) return;
		return untrack(() => current.subscribe(() =>
			perfMeasureSync('save.head-state-signal', () => (saveVersion += 1))
		));
	});
	const saveControl = $derived.by(() => {
		void saveVersion;
		return save?.control() ?? null;
	});
	const saveStatus = $derived.by(() => {
		void saveVersion;
		return save?.snapshot().status ?? null;
	});
	const unsaved = $derived.by(() => {
		void saveVersion;
		return save?.isDirty() ?? false;
	});
	const saveDisabled = $derived(saveControl !== null && (saveControl.disabled || projectActionBusy));
	/** The Save reason as the control words it; a project action in progress takes precedence. */
	const saveReasonText = $derived.by((): string | null => {
		if (saveControl === null) return null;
		return projectActionBusy ? 'Project rename or deletion is in progress.' : saveControl.reason;
	});
	/**
	 * A refusal (or a conflict, or a sign-in interruption) is announced once, in a
	 * polite live region, as well as being the Save control's accessible description.
	 */
	const refusalAnnouncement = $derived.by((): string => {
		if (saveControl === null) return '';
		const refused = saveStatus === 'refused' || saveStatus === 'error' || saveStatus === 'auth-required' || saveControl.conflict;
		return refused ? (saveControl.reason ?? '') : '';
	});

	async function runSave(): Promise<void> {
		if (projectActionBusy || save === null || saveControl === null || saveControl.disabled) return;
		const status = save.snapshot().status;
		if (status === 'refused' || status === 'error' || status === 'auth-required') await save.retry();
		else await save.save();
	}

	/** An operable Save runs; an unavailable one says why, which is the same disclosure. */
	function onSaveClick(): void {
		if (saveControl === null) toggleReason('save-unavailable');
		else if (saveDisabled) toggleReason('save');
		else void runSave();
	}

	function runUndo(): void {
		if (canUndo) onUndo();
		else toggleReason('undo');
	}

	function runRedo(): void {
		if (canRedo) onRedo();
		else toggleReason('redo');
	}

	function runPreview(): void {
		if (canPreview) onPreview();
		else toggleReason('preview');
	}

	function reloadRemote(): void {
		if (save === null) return;
		onReloadRemote(save.reloadRemote());
	}

	/** One tab stop plus arrow keys; DOM order is the roving order. */
	function lensButtonRef(node: HTMLButtonElement) {
		lensButtons.push(node);
		return {
			destroy() {
				const index = lensButtons.indexOf(node);
				if (index >= 0) lensButtons.splice(index, 1);
			}
		};
	}

	function onLensKeydown(event: KeyboardEvent, index: number): void {
		const next = resolveRovingIndex(LENSES.length, index, event.key, 'horizontal');
		if (next === null) return;
		event.preventDefault();
		// Roving selection: moving the strip activates the lens it lands on, so the
		// switch is one keyboard gesture rather than focus-then-act.
		onLens(LENSES[next]!.id);
		lensButtons[next]?.focus();
	}
</script>

<svelte:window onkeydown={findShortcut} onpointerdown={onWindowPointerDown} />
<header class="head" data-editor-head>
	<button
		type="button"
		class="head-index"
		data-head-index
		aria-expanded={indexOpen}
		aria-controls="plate-index"
		onclick={onToggleIndex}
	>
		Index <span class="chevron" aria-hidden="true">{indexOpen ? '▾' : '▸'}</span>
	</button>

	<!--
		Escape closes the project menu from any control inside it. The group only
		carries that key route; its focus targets are the name and the menu's buttons.
	-->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div class="identity" role="group" aria-label="Project" data-head-project-owner onkeydown={onProjectKeydown}>
		<span class="brand">Biskiq</span>
		<h1 class="project-title">
			<button
				type="button"
				class="project-name"
				data-head-project
				bind:this={projectTrigger}
				aria-expanded={projectMenuOpen}
				aria-controls={projectMenuId}
				title={projectName}
				onclick={toggleProjectMenu}
			>
				<span class="project-text">{projectName}</span>
				<span class="chevron" aria-hidden="true">{projectMenuOpen ? '▴' : '▾'}</span>
			</button>
		</h1>
		<div
			id={projectMenuId}
			class="project-menu"
			role="group"
			aria-label="Project actions"
			data-head-project-menu
			hidden={!projectMenuOpen}
		>
			<ProjectLifecycleActions
				bind:this={lifecycle}
				{projectId}
				{projectName}
				variant="head"
				disabledReason={projectActionsUnavailableReason}
				onPrepareRename={onPrepareRename}
				onRename={onRenameProject}
				onPrepareDelete={onPrepareDelete}
				onDelete={onDeleteProject}
				onComplete={onProjectActionComplete}
				onBusyChange={onProjectActionBusyChange}
				onRefreshRemote={onRefreshRemoteProject}
			/>
			<button
				type="button"
				class="menu-action"
				data-head-download
				disabled={!canDownloadSource}
				onclick={onDownloadSource}
			>
				Download source JSON
			</button>
			<button type="button" class="menu-action" data-head-source onclick={onOpenSource}>
				Open source JSON
			</button>
			<p class="project-id">Project id <code>{projectId}</code></p>
		</div>
	</div>

	{#if !indexOpen && locationLabel !== null}
		<button type="button" class="location" data-head-location title={locationLabel} onclick={onOpenIndex}>{locationLabel}</button>
	{/if}

	<div class="lens" role="group" aria-label="Product lens">
		{#each LENSES as entry, index (entry.id)}
			<button
				type="button"
				class="lens-button"
				class:active={lens === entry.id}
				aria-pressed={lens === entry.id}
				tabindex={tablistTabIndex(index, selectedLensIndex)}
				use:lensButtonRef
				onclick={() => onLens(entry.id)}
				onkeydown={(event) => onLensKeydown(event, index)}
			>
				{entry.label}
			</button>
		{/each}
	</div>

	<div class="actions">
		{#if find !== null}
			<details class="find" data-head-find bind:this={findDisclosure}>
				<summary bind:this={findSummary}>Find</summary>
				<div class="find-body">
					<label class="find-field">
						<span>Find a subject, tool or operation</span>
						<input
							bind:this={findInput}
							type="search"
							value={find.query}
							oninput={(event) => find?.onQuery(event.currentTarget.value)}
						/>
					</label>
					{#if find.entries.length === 0}
						<p class="find-empty">No subject, tool or operation matches that name.</p>
					{:else}
						<ul class="find-results">
							{#each find.entries as entry (`${entry.adapterId}:${entry.id}`)}
								<li>
									<button
										type="button"
										data-find-id={entry.id}
										data-find-adapter={entry.adapterId}
										onclick={() => void runFind(entry)}
									>
										<span class="find-verb">{entry.verb}</span>
										{entry.label}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</details>
		{/if}

		<div class="history" data-editor-history data-unavailable-capability={!canUndo && !canRedo ? '' : undefined}>
			<div class="cap" data-reason-owner data-reason-open={reasonOpen('undo')}>
				<button
					type="button"
					class="action"
					data-head-undo
					aria-disabled={!canUndo}
					aria-describedby={canUndo ? undefined : reasonId('undo')}
					title={canUndo ? 'Undo the latest accepted change' : undefined}
					onclick={runUndo}
				>
					Undo
				</button>
				{#if !canUndo}<span class="reason" id={reasonId('undo')}>{historyUnavailableReason}</span>{/if}
			</div>
			<div class="cap" data-reason-owner data-reason-open={reasonOpen('redo')}>
				<button
					type="button"
					class="action"
					data-head-redo
					aria-disabled={!canRedo}
					aria-describedby={canRedo ? undefined : reasonId('redo')}
					title={canRedo ? 'Redo the last undone change' : undefined}
					onclick={runRedo}
				>
					Redo
				</button>
				{#if !canRedo}<span class="reason" id={reasonId('redo')}>{redoUnavailableReason}</span>{/if}
			</div>
		</div>

		{#if saveControl === null}
			<div class="cap" data-reason-owner data-unavailable-capability="" data-reason-open={reasonOpen('save-unavailable')}>
				<button
					type="button"
					class="action"
					aria-disabled="true"
					aria-describedby={reasonId('save-unavailable')}
					onclick={onSaveClick}
				>
					Save
				</button>
				<span class="reason" id={reasonId('save-unavailable')}>{saveUnavailableReason}</span>
			</div>
		{:else}
			<div
				class="cap"
				data-reason-owner
				data-head-save=""
				data-save-status={saveStatus}
				data-unsaved={unsaved ? '' : undefined}
				data-reason-open={reasonOpen('save')}
			>
				<button
					type="button"
					class="action"
					data-head-save-button
					aria-disabled={saveDisabled}
					aria-describedby={saveReasonText !== null || unsaved ? reasonId('save') : undefined}
					onclick={onSaveClick}
				>
					{saveControl.label}
				</button>
				{#if saveReasonText !== null || unsaved}
					<span class="reason" id={reasonId('save')}>
						{#if saveReasonText !== null}<span>{saveReasonText}</span>{/if}
						{#if unsaved}<span class="reason-line" data-unsaved-work>Unsaved changes</span>{/if}
					</span>
				{/if}
				{#if saveControl.conflict}
					<button type="button" class="action" onclick={reloadRemote}>Reload remote</button>
				{/if}
			</div>
		{/if}
		<p class="sr-only" role="status" aria-live="polite" data-head-announce>{refusalAnnouncement}</p>

		{#if canPreview}
			<div class="cap preview" data-reason-owner data-head-preview="" data-reason-open={reasonOpen('preview')}>
				<button
					type="button"
					class="action primary"
					data-head-preview-button
					aria-disabled="false"
					title="Enter an isolated visitor Preview"
					onclick={runPreview}
				>
					Preview
				</button>
			</div>
		{:else}
			<div class="cap preview" data-reason-owner data-unavailable-capability="" data-reason-open={reasonOpen('preview')}>
				<button
					type="button"
					class="action primary"
					data-head-preview-button
					aria-disabled="true"
					aria-describedby={reasonId('preview')}
					onclick={runPreview}
				>
					Preview
				</button>
				<span class="reason" id={reasonId('preview')}>{previewUnavailableReason}</span>
			</div>
		{/if}
	</div>
</header>

<style>
	/*
		The row takes its roles from the scoped map on `.editor-host` (shell-roles.css).
		The literal fallbacks keep the component legible when mounted on its own.
	*/
	.head {
		box-sizing: border-box;
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: 0.5rem;
		height: var(--shell-head-height, 44px);
		padding: 0 0.6rem;
		background: var(--shell-forest, #11291f);
		color: var(--shell-ink-light, #f3f4ee);
		border-bottom: 1px solid var(--shell-hairline, #2f4a3d);
		font-family: var(--shell-sans, Inter, ui-sans-serif, system-ui, sans-serif);
		font-size: var(--shell-text-body, 13px);
		min-width: 0;
	}

	.head-index,
	.location {
		font-size: var(--shell-text-utility, 12px);
		letter-spacing: 0.02em;
	}

	.identity {
		position: relative;
		display: flex;
		min-width: 0;
		flex: 0 1 auto;
		align-items: center;
		gap: 0.5rem;
	}

	.brand {
		font-size: var(--shell-text-utility, 12px);
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--shell-ink-quiet, #9fb2a2);
		white-space: nowrap;
	}

	.project-title {
		min-width: 0;
		margin: 0;
		font: inherit;
	}

	.project-name {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		max-width: 14rem;
		min-height: var(--shell-control-height, 32px);
		padding: 0 0.3rem;
		border-color: transparent;
		color: #fff;
		font-family: var(--shell-serif, 'Iowan Old Style', Palatino, Georgia, serif);
		font-size: var(--shell-text-identity, 15px);
		font-weight: 400;
		line-height: 1.2;
	}

	.project-text {
		overflow: hidden;
		min-width: 0;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chevron {
		font-family: var(--shell-sans, Inter, sans-serif);
		font-size: var(--shell-text-utility, 12px);
		color: var(--shell-ink-quiet, #9fb2a2);
	}

	/* The project menu is a disclosure on the name, holding the procedures the old ☰ held. */
	.project-menu {
		position: absolute;
		z-index: 30;
		top: calc(100% + 0.3rem);
		left: 0;
		display: grid;
		gap: 0.45rem;
		width: min(18rem, 90vw);
		padding: 0.6rem;
		border: 1px solid var(--shell-hairline, #2f4a3d);
		border-radius: 0.35rem;
		background: var(--shell-forest, #11291f);
		box-shadow: 0 0.6rem 1.4rem rgb(6 20 14 / 45%);
		font-size: var(--shell-text-body, 13px);
	}

	.project-menu[hidden] {
		display: none;
	}

	.menu-action {
		justify-self: start;
	}

	.project-id {
		margin: 0;
		font-size: var(--shell-text-utility, 12px);
		color: var(--shell-ink-quiet, #9fb2a2);
	}

	.project-id code {
		padding: 0.1rem 0.3rem;
		background: var(--shell-forest-raised, #22503c);
		border-radius: 0.35rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: var(--shell-text-utility, 12px);
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}

	.location {
		min-width: 0;
		max-width: 11rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		border-color: var(--shell-hairline, #2f4a3d);
	}

	/* The lens is a pale selected segment with forest ink; the inactive segment stays quiet. */
	.lens {
		display: inline-flex;
		flex: none;
		gap: 0.15rem;
		padding: 0.15rem;
		border: 1px solid var(--shell-hairline, #2f4a3d);
		border-radius: 0.35rem;
	}

	.lens-button {
		border-color: transparent;
	}

	.lens-button.active {
		background: var(--shell-paper, #e9ebe6);
		border-color: var(--shell-paper, #e9ebe6);
		color: var(--shell-forest, #11291f);
		font-weight: 600;
	}

	.actions {
		display: flex;
		flex: none;
		flex-wrap: nowrap;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
		margin-left: auto;
	}

	/* One reason cell per control: its disclosure opens beside its own control only. */
	.cap {
		position: relative;
		display: inline-flex;
		flex: none;
		align-items: center;
	}

	.history {
		display: inline-flex;
		gap: 0.3rem;
	}

	/*
		A reason is a disclosure: it opens on focus, hover or a tap of its control and
		closes when focus, pointer or the tap moves away. At rest it is clipped to
		nothing but stays in the accessibility tree, so aria-describedby reads it.
	*/
	.reason {
		position: absolute;
		z-index: 14;
		top: calc(100% + 0.3rem);
		left: 0;
		width: 1px;
		height: 1px;
		padding: 0;
		border: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		font-size: var(--shell-text-utility, 12px);
		line-height: 1.3;
	}

	.cap:hover > .reason,
	.cap:focus-within > .reason,
	.cap[data-reason-open] > .reason {
		width: max-content;
		max-width: min(18rem, 80vw);
		height: auto;
		padding: 0.4rem 0.55rem;
		border: 1px solid var(--shell-hairline, #2f4a3d);
		border-radius: 0.35rem;
		background: var(--shell-forest, #11291f);
		color: var(--shell-ink-light, #f3f4ee);
		overflow: visible;
		clip-path: none;
		white-space: normal;
		box-shadow: 0 0.5rem 1.2rem rgb(6 20 14 / 45%);
	}

	.reason-line {
		display: block;
	}

	/*
		The action controls sit at the row's right edge, so each disclosure hangs from
		its control's right edge and stays inside the viewport at every width.
	*/
	.actions .cap > .reason {
		left: auto;
		right: 0;
	}

	.find {
		position: relative;
	}

	.find summary {
		display: inline-flex;
		align-items: center;
		min-height: var(--shell-control-height, 32px);
		padding: 0 0.6rem;
		border: 1px solid var(--shell-hairline, #2f4a3d);
		border-radius: 0.35rem;
		background: var(--shell-forest-raised, #22503c);
		color: var(--shell-ink-light, #f3f4ee);
		font-size: var(--shell-text-body, 13px);
		cursor: pointer;
		list-style: none;
	}

	.find summary::-webkit-details-marker {
		display: none;
	}

	.find-body {
		position: absolute;
		right: 0;
		top: calc(100% + 0.3rem);
		z-index: 12;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		width: min(20rem, 80vw);
		padding: 0.5rem;
		border: 1px solid var(--shell-hairline, #2f4a3d);
		border-radius: 0.35rem;
		background: var(--shell-forest, #11291f);
		box-shadow: 0 0.6rem 1.4rem rgb(6 20 14 / 45%);
	}

	.find-field {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: var(--shell-text-utility, 12px);
		color: var(--shell-ink-quiet, #9fb2a2);
	}

	.find-field input {
		min-height: var(--shell-control-height, 32px);
		padding: 0 0.4rem;
		border: 1px solid var(--shell-hairline, #2f4a3d);
		border-radius: 0.35rem;
		background: transparent;
		color: var(--shell-ink-light, #f3f4ee);
		font: inherit;
	}

	.find-results {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		max-height: 12rem;
		overflow: auto;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.find-results button {
		display: flex;
		width: 100%;
		align-items: baseline;
		gap: 0.4rem;
		padding: 0.25rem 0.3rem;
		border-color: transparent;
		font-size: var(--shell-text-body, 13px);
		text-align: left;
	}

	.find-verb {
		color: var(--shell-gold, #d4ad45);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.find-empty {
		margin: 0;
		font-size: var(--shell-text-utility, 12px);
		color: var(--shell-ink-quiet, #9fb2a2);
	}

	button {
		min-height: var(--shell-control-height, 32px);
		padding: 0 0.6rem;
		border: 1px solid var(--shell-hairline, #2f4a3d);
		border-radius: 0.35rem;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: var(--shell-text-body, 13px);
		white-space: nowrap;
		cursor: pointer;
	}

	/* Hover is neutral: a light overlay wash, never a second selection colour. */
	button:hover:not([aria-disabled='true']):not(:disabled) {
		background: rgb(243 244 238 / 8%);
	}

	/* An unavailable control keeps its focus and tap; only its look says it cannot act. */
	button[aria-disabled='true'],
	button:disabled {
		cursor: default;
		color: var(--shell-ink-quiet, #9fb2a2);
		border-style: dashed;
	}

	/* The row's primary action: the gold Preview, with forest ink. */
	button.primary {
		background: var(--shell-gold, #d4ad45);
		border-color: var(--shell-gold, #d4ad45);
		color: var(--shell-forest, #11291f);
		font-weight: 600;
	}

	button.primary[aria-disabled='true'] {
		background: transparent;
		border-color: var(--shell-hairline, #2f4a3d);
		color: var(--shell-ink-quiet, #9fb2a2);
		font-weight: 400;
	}

	button:focus-visible,
	summary:focus-visible {
		outline: 2px solid var(--shell-gold, #d4ad45);
		outline-offset: 2px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		border: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	/*
		Narrow desktop and tablet widths keep the one row by giving the name the room
		left over. The brand and the names shrink first; no control leaves the row.
	*/
	@media (max-width: 1279px) {
		.head {
			gap: 0.35rem;
		}

		.actions {
			gap: 0.25rem;
		}

		.project-name {
			max-width: 9rem;
		}
	}

	/* Coarse targets: at least 44 CSS px; the row grows to hold them without a second line. */
	@media (pointer: coarse) {
		.head {
			height: auto;
			min-height: var(--shell-head-height, 44px);
			padding-block: 0.25rem;
		}

		button,
		summary {
			min-height: 44px;
			min-width: 44px;
		}
	}
</style>
