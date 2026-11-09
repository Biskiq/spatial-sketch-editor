<script lang="ts">
	/** Shared Head: project lifecycle, lens, scoped Find, history and truthful Save/Preview states. */
	import { tick, untrack } from 'svelte';
	import ShellIcon from './ShellIcon.svelte';
	import WorldMark from './WorldMark.svelte';
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
		onPrepareRename = async () => ({
			kind: 'blocked' as const,
			message: 'Project actions are unavailable.'
		}),
		onRenameProject = async () => ({
			kind: 'refused' as const,
			message: 'Project actions are unavailable.'
		}),
		onPrepareDelete = async () => ({
			kind: 'blocked' as const,
			message: 'Project actions are unavailable.'
		}),
		onDeleteProject = async () => ({
			kind: 'refused' as const,
			message: 'Project actions are unavailable.'
		}),
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
		onRenameProject?: (
			prepared: PreparedProjectLifecycle,
			name: string
		) => Promise<ProjectLifecycleActionResult>;
		onPrepareDelete?: () => Promise<ProjectLifecyclePrepareResult>;
		onDeleteProject?: (prepared: PreparedProjectLifecycle) => Promise<ProjectLifecycleActionResult>;
		onProjectActionComplete?: (
			result: Extract<ProjectLifecycleActionResult, { kind: 'renamed' | 'deleted' | 'unchanged' }>
		) => void | Promise<void>;
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

	const findGroup = (entry: HeadFindEntry) =>
		entry.verb === 'Go to'
			? 'Places'
			: entry.verb === 'Select'
				? 'Subjects'
				: entry.verb === 'Arm'
					? 'Tools'
					: 'Commands';
	const findResults = $derived(
		(find?.entries ?? []).toSorted(
			(a, b) =>
				['Subjects', 'Places', 'Tools', 'Commands'].indexOf(findGroup(a)) -
				['Subjects', 'Places', 'Tools', 'Commands'].indexOf(findGroup(b))
		)
	);
	type ReasonKey = 'undo' | 'redo' | 'save' | 'save-unavailable' | 'preview';

	let selectedLensIndex = $derived(LENSES.findIndex((entry) => entry.id === lens));
	const lensButtons: HTMLButtonElement[] = [];
	let findOpen = $state(false);
	let findIndex = $state(0);
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
		if (
			find === null ||
			event.defaultPrevented ||
			!(event.metaKey || event.ctrlKey) ||
			event.key.toLowerCase() !== 'k'
		)
			return;
		event.preventDefault();
		if (findInput === undefined) return;
		findOpen = true;
		findInput.focus();
	}

	/** A press outside a disclosure closes it; the disclosure's own content keeps it open. */
	function onWindowPointerDown(event: PointerEvent): void {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (openReason !== null && target.closest('[data-reason-owner]') === null) openReason = null;
		if (projectMenuOpen && target.closest('[data-head-project-owner]') === null)
			projectMenuOpen = false;
		if (target.closest('[data-head-find]') === null) findOpen = false;
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
		findOpen = false;
		findInput?.focus();
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
		return untrack(() =>
			current.subscribe(() => perfMeasureSync('save.head-state-signal', () => (saveVersion += 1)))
		);
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
	const saveDisabled = $derived(
		saveControl !== null && (saveControl.disabled || projectActionBusy)
	);
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
		const refused =
			saveStatus === 'refused' ||
			saveStatus === 'error' ||
			saveStatus === 'auth-required' ||
			saveControl.conflict;
		return refused ? (saveControl.reason ?? '') : '';
	});

	async function runSave(): Promise<void> {
		if (projectActionBusy || save === null || saveControl === null || saveControl.disabled) return;
		const status = save.snapshot().status;
		if (status === 'refused' || status === 'error' || status === 'auth-required')
			await save.retry();
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
		aria-label="Toggle Index"
		aria-expanded={indexOpen}
		aria-controls="plate-index"
		onclick={onToggleIndex}
	>
		<ShellIcon name="menu" />
	</button>

	<span class="brand" aria-label="Biskiq">
		<WorldMark />
		<span class="brand-word">Biskiq</span>
	</span>

	<!--
		Escape closes the project menu from any control inside it. The group only
		carries that key route; its focus targets are the name and the menu's buttons.
	-->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="identity"
		role="group"
		aria-label="Project"
		data-head-project-owner
		onkeydown={onProjectKeydown}
	>
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
				{onPrepareRename}
				onRename={onRenameProject}
				{onPrepareDelete}
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
		<button
			type="button"
			class="location"
			data-head-location
			title={locationLabel}
			onclick={onOpenIndex}>{locationLabel}</button
		>
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
			<div class="find" class:open={findOpen} data-head-find>
				<ShellIcon name="search" size={15} />
				<input
					bind:this={findInput}
					type="search"
					role="combobox"
					aria-label="Find a subject, tool or operation"
					aria-expanded={findOpen}
					aria-controls={`${uid}-find-results`}
					aria-autocomplete="list"
					aria-activedescendant={findOpen && findResults[findIndex]
						? `${uid}-find-${findIndex}`
						: undefined}
					placeholder="Find tools, actions, places…"
					value={find.query}
					onfocus={() => {
						findOpen = true;
						findIndex = 0;
					}}
					oninput={(event) => {
						find?.onQuery(event.currentTarget.value);
						findIndex = 0;
						findOpen = true;
					}}
					onkeydown={(event) => {
						if (event.key === 'Escape') {
							event.preventDefault();
							event.stopPropagation();
							findOpen = false;
							findInput?.focus();
						} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
							event.preventDefault();
							findOpen = true;
							findIndex =
								(findIndex + (event.key === 'ArrowDown' ? 1 : -1) + findResults.length) %
								Math.max(1, findResults.length);
							document
								.getElementById(`${uid}-find-${findIndex}`)
								?.scrollIntoView({ block: 'nearest' });
						} else if (event.key === 'Enter' && findOpen && findResults[findIndex]) {
							event.preventDefault();
							void runFind(findResults[findIndex]!);
						}
					}}
				/>
				<kbd>⌘K</kbd>
				<div class="find-body" hidden={!findOpen}>
					<ul
						class="find-results"
						id={`${uid}-find-results`}
						role="listbox"
						aria-label="Find results"
					>
						{#each findResults as entry, index (`${entry.adapterId}:${entry.id}`)}
							{#if index === 0 || findGroup(findResults[index - 1]!) !== findGroup(entry)}<li
									role="presentation"
									class="find-group"
								>
									{findGroup(entry)}
								</li>{/if}
							<li role="option" id={`${uid}-find-${index}`} aria-selected={index === findIndex}>
								<button
									type="button"
									tabindex="-1"
									data-find-id={entry.id}
									data-find-adapter={entry.adapterId}
									onpointerdown={(event) => event.preventDefault()}
									onclick={() => void runFind(entry)}
								>
									<ShellIcon
										name={entry.verb === 'Select'
											? 'select'
											: entry.verb === 'Go to'
												? 'layers'
												: entry.verb === 'Arm'
													? 'ink'
													: 'find'}
										size={15}
									/>
									<span class="find-verb">{entry.verb}</span>{' '}<span>{entry.label}</span>
								</button>
							</li>
						{/each}
					</ul>
					{#if find.entries.length === 0}<p class="find-empty">No matching results</p>{/if}
				</div>
			</div>
		{/if}

		<div
			class="history"
			data-editor-history
			data-unavailable-capability={!canUndo && !canRedo ? '' : undefined}
		>
			<div class="cap" data-reason-owner data-reason-open={reasonOpen('undo')}>
				<button
					type="button"
					class="action"
					data-head-undo
					aria-label="Undo"
					aria-disabled={!canUndo}
					aria-describedby={canUndo ? undefined : reasonId('undo')}
					title={canUndo ? 'Undo the latest accepted change' : undefined}
					onclick={runUndo}
				>
					<ShellIcon name="undo" />
				</button>
				{#if !canUndo}<span class="reason" id={reasonId('undo')}>{historyUnavailableReason}</span
					>{/if}
			</div>
			<div class="cap" data-reason-owner data-reason-open={reasonOpen('redo')}>
				<button
					type="button"
					class="action"
					data-head-redo
					aria-label="Redo"
					aria-disabled={!canRedo}
					aria-describedby={canRedo ? undefined : reasonId('redo')}
					title={canRedo ? 'Redo the last undone change' : undefined}
					onclick={runRedo}
				>
					<ShellIcon name="redo" />
				</button>
				{#if !canRedo}<span class="reason" id={reasonId('redo')}>{redoUnavailableReason}</span>{/if}
			</div>
		</div>

		{#if saveControl === null}
			<div
				class="cap"
				data-reason-owner
				data-unavailable-capability=""
				data-reason-open={reasonOpen('save-unavailable')}
			>
				<button
					type="button"
					class="action"
					aria-disabled="true"
					aria-label="Save"
					aria-describedby={reasonId('save-unavailable')}
					onclick={onSaveClick}
				>
					<ShellIcon name="save2" />
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
					aria-label={saveControl.label}
					title={saveControl.label}
					aria-disabled={saveDisabled}
					aria-describedby={saveReasonText !== null || unsaved ? reasonId('save') : undefined}
					onclick={onSaveClick}
				>
					<ShellIcon name={unsaved || saveStatus !== 'saved' ? 'save2' : 'check'} />
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
		<p class="sr-only" role="status" aria-live="polite" data-head-announce>
			{refusalAnnouncement}
		</p>

		{#if canPreview}
			<div
				class="cap preview"
				data-reason-owner
				data-head-preview=""
				data-reason-open={reasonOpen('preview')}
			>
				<button
					type="button"
					class="action primary"
					data-head-preview-button
					aria-label="Preview"
					aria-disabled="false"
					title="Enter an isolated visitor Preview"
					onclick={runPreview}
				>
					<ShellIcon name="preview" size={15} /> <span class="preview-label">Preview</span>
				</button>
			</div>
		{:else}
			<div
				class="cap preview"
				data-reason-owner
				data-unavailable-capability=""
				data-reason-open={reasonOpen('preview')}
			>
				<button
					type="button"
					class="action primary"
					data-head-preview-button
					aria-label="Preview"
					aria-disabled="true"
					aria-describedby={reasonId('preview')}
					onclick={runPreview}
				>
					<ShellIcon name="preview" size={15} /> <span class="preview-label">Preview</span>
				</button>
				<span class="reason" id={reasonId('preview')}>{previewUnavailableReason}</span>
			</div>
		{/if}
	</div>
</header>

<style>
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.head {
		display: flex;
		align-items: center;
		gap: 6px;
		height: var(--shell-head-height);
		padding: 0 8px;
		background: var(--shell-forest);
		color: var(--shell-ink-light);
		min-width: 0;
		font: var(--shell-text-body)/1.35 var(--shell-sans);
	}
	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		height: var(--shell-control-height);
		padding: 0 8px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: inherit;
		font: inherit;
		white-space: nowrap;
		cursor: pointer;
	}
	button:hover {
		background: var(--shell-on-forest-wash);
	}
	.head-index,
	.action:not(.primary) {
		width: 32px;
		padding: 0;
		color: var(--shell-ink-light);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex: none;
		padding: 0 4px 0 1px;
		color: var(--shell-ink-light);
		font: 600 var(--shell-text-title)/1 var(--shell-display);
		letter-spacing: -0.015em;
	}
	.brand-word {
		white-space: nowrap;
	}
	.identity {
		position: relative;
		min-width: 0;
		flex: 0 1 auto;
	}
	.project-title {
		margin: 0;
		font: inherit;
	}
	.project-name {
		max-width: 180px;
		color: var(--shell-ink-light);
		padding: 0 4px;
		font: 500 var(--shell-text-identity) var(--shell-sans);
	}
	.project-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chevron {
		font: var(--shell-text-label) var(--shell-sans);
		color: var(--shell-ink-quiet);
	}
	.project-menu {
		position: absolute;
		z-index: 30;
		top: 35px;
		left: 0;
		display: grid;
		gap: 6px;
		width: 288px;
		padding: 10px;
		border: 1px solid var(--shell-line-on-forest);
		border-radius: 10px;
		background: var(--shell-popup-dark);
		box-shadow: var(--shell-shadow);
	}
	.project-menu[hidden] {
		display: none;
	}
	.menu-action {
		justify-content: flex-start;
	}
	.project-id {
		margin: 0;
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-label);
		overflow-wrap: anywhere;
	}
	.lens {
		display: flex;
		flex: none;
		gap: 0;
		padding: 2px;
		background: rgb(0 0 0 / 0.25);
		border-radius: 8px;
	}
	.lens-button {
		height: 26px;
		padding: 0 11px;
		border-radius: 6px;
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-control);
	}
	/* Weight never changes; the shared engaged fill carries the state. */
	.lens-button.active {
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
	}
	.location {
		order: 1;
		height: 28px;
		max-width: 320px;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: var(--shell-text-utility);
		background: var(--shell-on-forest-wash);
	}
	.actions {
		order: 2;
		display: flex;
		align-items: center;
		gap: 6px;
		margin-left: auto;
		min-width: 0;
	}
	.history {
		display: flex;
		gap: 0;
	}
	.cap {
		position: relative;
		display: inline-flex;
		flex: none;
	}
	.reason {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.cap:hover > .reason,
	.cap:focus-within > .reason,
	.cap[data-reason-open] > .reason {
		z-index: 40;
		top: 35px;
		right: 0;
		width: max-content;
		max-width: 288px;
		height: auto;
		padding: 7px 9px;
		border-radius: 8px;
		background: var(--shell-popup-dark);
		color: var(--shell-ink-light);
		box-shadow: var(--shell-shadow);
		clip-path: none;
		font-size: var(--shell-text-utility);
		white-space: normal;
	}
	.reason-line {
		display: block;
	}
	.find {
		position: relative;
		display: flex;
		align-items: center;
		gap: 6px;
		width: 250px;
		height: var(--shell-control-height);
		padding: 0 8px;
		border-radius: 8px;
		background: var(--shell-on-forest-wash-strong);
		color: var(--shell-ink-quiet);
	}
	.find.open {
		width: 330px;
		background: var(--shell-field-focus);
		color: var(--shell-ink-3);
	}
	.find input {
		width: 100%;
		min-width: 0;
		border: 0;
		outline: none;
		padding: 0;
		background: transparent;
		color: inherit;
		font: var(--shell-text-body) var(--shell-sans);
	}
	.find input::placeholder {
		color: var(--shell-ink-quiet);
	}
	.find.open input {
		color: var(--shell-ink);
	}
	kbd {
		color: var(--shell-ink-quiet);
		font: var(--shell-text-meta) var(--shell-mono);
		white-space: nowrap;
	}
	.find-body {
		position: absolute;
		z-index: 40;
		top: 36px;
		right: 0;
		width: 330px;
		padding: 4px;
		border: 1px solid var(--shell-hairline);
		border-radius: 10px;
		background: var(--shell-popover);
		color: var(--shell-ink);
		box-shadow: var(--shell-shadow);
	}
	.find-body[hidden] {
		display: none;
	}
	.find-results {
		margin: 0;
		padding: 0;
		list-style: none;
		max-height: 420px;
		overflow: auto;
	}
	.find-results button {
		justify-content: flex-start;
		width: 100%;
		height: auto;
		min-height: var(--shell-control-height);
		padding: 5px 8px;
		text-align: left;
		white-space: normal;
		border-radius: 6px;
	}
	.find-results [aria-selected='true'],
	.find-results button:hover {
		background: var(--shell-hover);
		border-radius: 6px;
	}
	.find-verb {
		flex: none;
		font-size: var(--shell-text-label);
		color: var(--shell-ink-3);
	}
	.find-group {
		padding: 6px 8px 2px;
		color: var(--shell-ink-3);
		font-size: var(--shell-text-meta);
		text-transform: uppercase;
		letter-spacing: 0.07em;
	}
	.find-empty {
		margin: 8px;
		font-size: var(--shell-text-utility);
	}
	/* The row's one filled action uses the same light key as an engaged mode. */
	.primary {
		padding: 0 11px;
		border-radius: 8px;
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
		font-weight: 600;
	}
	.primary:hover {
		background: var(--shell-mode-active-bg);
	}
	button[aria-disabled='true'] {
		opacity: var(--shell-control-disabled-opacity);
		cursor: default;
	}
	@media (max-width: 1100px) {
		.location {
			max-width: 180px;
		}
		.find,
		.find.open {
			width: 210px;
		}
	}
	@media (max-width: 560px) {
		/* Keep every Head action reachable without letting the row widen the page. */
		.actions {
			overflow-x: auto;
			overflow-y: hidden;
			scrollbar-width: none;
		}
		.actions::-webkit-scrollbar {
			display: none;
		}
	}
	@media (max-width: 860px) {
		.brand-word {
			display: none;
		}
		.brand {
			padding-right: 0;
		}
		.preview-label,
		kbd {
			display: none;
		}
		.primary {
			width: 30px;
			padding: 0;
		}
		.location {
			flex: 0 1 130px;
		}
		.actions {
			gap: 4px;
		}
		.project-name {
			max-width: 130px;
		}
		.find,
		.find.open {
			width: 150px;
		}
		.location {
			max-width: 130px;
		}
		.lens-button {
			padding: 0 8px;
		}
	}
	@media (pointer: coarse) {
		.head {
			height: 52px;
		}

		button,
		.head-index,
		.action:not(.primary),
		.lens-button {
			min-width: 44px;
			min-height: 44px;
		}
		.lens {
			padding: 0;
		}
		.find {
			min-height: 44px;
		}
	}
</style>
