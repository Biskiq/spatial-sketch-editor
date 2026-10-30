<script lang="ts">
	/**
	 * PLATE **Head** (§0.8) — persistent project/application context, the lens
	 * switch, source-history/Save/Preview and the source download.
	 *
	 * Head owns application actions, not a second task toolbar: it stays compact
	 * and one row on a wide layout. Controls with no accepted capability
	 * (history, Save, Preview) are rendered **disabled with their reason visible**
	 * rather than as silent dead buttons, and this component reaches no
	 * persistence function — downloading source JSON is a pure serialization of
	 * the admitted source the caller already holds.
	 */
	import { untrack } from 'svelte';
	import { resolveRovingIndex, tablistTabIndex } from '$lib/authoring/a11y/roving-focus';
	import type { HeadSave } from '$lib/authoring/save/head-save';
	import type { ReloadOffer } from '$lib/authoring/save/save-state';
	import ProjectLifecycleActions from '$lib/platform/ProjectLifecycleActions.svelte';
	import { perfMeasureSync } from '$lib/platform/perf-marks';
import { GRID_MINOR_CHOICES, formatMeters } from '../stage-drafting';
	import type {
		PreparedProjectLifecycle,
		ProjectLifecycleActionResult,
		ProjectLifecyclePrepareResult
	} from '$lib/platform/project-persistence';

	/**
	 * One contributed tool or operation the Head's Find can reach.
	 *
	 * The host supplies the entry; the Head renders it and hands the **same**
	 * object back when it is run, so neither side has to reconstruct the other's
	 * vocabulary.
	 */
	export type HeadFindEntry = {
		readonly id: string;
		readonly adapterId: string;
		readonly label: string;
		readonly verb: string;
	};

	let {
		projectId,
		projectName,
		lens,
		onLens,
		canDownloadSource,
		onDownloadSource,
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
		reducedMotion,
		onToggleReducedMotion,
		indexOpen = true,
		locationLabel = null,
		onOpenIndex = () => {},
		planAppearance = 'paper',
		onPlanAppearance = () => {},
		/** R217.S05's drafting configuration, also reachable from the words. */
		gridIntervalMode = 'automatic',
		gridMinorMeters = 1,
		snapOnGrid = true,
		onGridMinorMeters = () => {},
		onSnapOnGrid = () => {},
		heightSheetSide = 'right',
		onHeightSheetSide = () => {},
		motionSpeed = 'normal',
		onMotionSpeed = () => {},
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
		/** Why Undo/Redo cannot run; visible whenever both are unavailable. */
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
		reducedMotion: boolean;
		onToggleReducedMotion: () => void;
		indexOpen?: boolean;
		locationLabel?: string | null;
		onOpenIndex?: () => void;
		planAppearance?: 'paper' | 'shaded';
		onPlanAppearance?: (value: 'paper' | 'shaded') => void;
		/** The one Grid/Snap view state, configured from Viewing. */
		gridIntervalMode?: 'automatic' | 'override';
		gridMinorMeters?: number;
		snapOnGrid?: boolean;
		onGridMinorMeters?: (mode: 'automatic' | 'override', meters?: number) => void;
		onSnapOnGrid?: (snap: boolean) => void;
		/** R217.S06's Height Sheet side; session preference, never source. */
		heightSheetSide?: 'left' | 'right';
		onHeightSheetSide?: (side: 'left' | 'right') => void;
		motionSpeed?: 'slow' | 'normal' | 'fast';
		onMotionSpeed?: (value: 'slow' | 'normal' | 'fast') => void;
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
		 * The bounded **Find** access (Round 2 D10): the contributed tools and
		 * operations by name, each behind the explicit verb that reaches it. The host
		 * supplies the list — the Head renders no domain tool and hard-codes no T1
		 * family. Absent keeps the previous Head exactly as it was.
		 *
		 * It is deliberately not the scope-model Index, a global subject search or
		 * every future Find command: it knows only what the mounted adapters declared.
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

	let selectedLensIndex = $derived(LENSES.findIndex((entry) => entry.id === lens));
	const lensButtons: HTMLButtonElement[] = [];
	let findDisclosure = $state<HTMLDetailsElement>();
	let findInput = $state<HTMLInputElement>();
	function findShortcut(event: KeyboardEvent): void {
		if (find === null || event.defaultPrevented || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
		event.preventDefault();
		if (findDisclosure === undefined || findInput === undefined) return;
		findDisclosure.open = true;
		findInput.focus();
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

	async function runSave(): Promise<void> {
		if (projectActionBusy || save === null || saveControl === null) return;
		const status = save.snapshot().status;
		if (status === 'refused' || status === 'error' || status === 'auth-required') await save.retry();
		else await save.save();
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

<svelte:window onkeydown={findShortcut} />
<header class="head" data-editor-head>
	<details class="app-menu">
		<summary aria-label="Application menu">☰</summary>
		<div class="menu-body">
			<strong>Viewing</strong>
			<label>2D appearance <select value={planAppearance} onchange={(event) => onPlanAppearance(event.currentTarget.value as 'paper' | 'shaded')}><option value="paper">Paper</option><option value="shaded">Shaded</option></select></label>
			<label>Grid interval <select value={gridIntervalMode === 'automatic' ? 'automatic' : String(gridMinorMeters)} onchange={(event) => { const value = event.currentTarget.value; if (value === 'automatic') onGridMinorMeters('automatic'); else onGridMinorMeters('override', Number(value)); }}><option value="automatic">Automatic</option>{#each GRID_MINOR_CHOICES as choice (choice)}<option value={choice}>{formatMeters(choice)} override</option>{/each}</select></label>
			<label><input type="checkbox" checked={snapOnGrid} onchange={(event) => onSnapOnGrid(event.currentTarget.checked)} /> Snap to the grid</label>
			<label>Height Sheet <select value={heightSheetSide} onchange={(event) => onHeightSheetSide(event.currentTarget.value as 'left' | 'right')}><option value="right">Right</option><option value="left">Left</option></select></label>
			<strong>Settings</strong>
			<label><input type="checkbox" checked={reducedMotion} onchange={onToggleReducedMotion} /> Reduce motion</label>
			<label>Editor motion speed <select value={motionSpeed} onchange={(event) => onMotionSpeed(event.currentTarget.value as 'slow' | 'normal' | 'fast')}><option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option></select></label>
			<strong>Project</strong>
		<ProjectLifecycleActions
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
			class="action"
			disabled={!canDownloadSource}
			onclick={onDownloadSource}
		>
			Download source JSON
		</button>
			<strong>Status</strong>
			{#if !canUndo && !canRedo}<p>{historyUnavailableReason}</p>{/if}
			{#if saveControl === null}<p>{saveUnavailableReason}</p>{:else if saveControl.reason}<p>{saveControl.reason}</p>{/if}
			{#if !canPreview}<p>{previewUnavailableReason}</p>{/if}
			<strong>Keys</strong>
			<p>⌘K / Ctrl+K Find · 3 3D · P Plan · F Fit · Esc Cancel</p>
		</div>
	</details>
	<div class="identity">
		<p class="app">Museum Editor</p>
		<h1 class="project" title={projectName}>{projectName}</h1>
		<details class="technical">
			<summary>Technical details</summary>
			<code class="project-id" title={projectId}>{projectId}</code>
		</details>
	</div>
	{#if !indexOpen}
		<button type="button" class="location" title={locationLabel ?? projectName} onclick={onOpenIndex}>{locationLabel ?? projectName}</button>
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
				<summary>Find</summary>
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
									<button type="button" onclick={() => find?.onRun(entry)}>
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

		<div class="capability" data-editor-history data-unavailable-capability={!canUndo && !canRedo ? '' : undefined}>
			<div class="history-actions">
				<button
					type="button"
					class="action"
					disabled={!canUndo}
					aria-disabled={!canUndo}
					title={canUndo ? 'Undo the latest accepted change' : historyUnavailableReason}
					onclick={onUndo}
				>
					Undo
				</button>
				<button
					type="button"
					class="action"
					disabled={!canRedo}
					aria-disabled={!canRedo}
					title={canRedo ? 'Redo the last undone change' : redoUnavailableReason}
					onclick={onRedo}
				>
					Redo
				</button>
			</div>
			{#if !canUndo && !canRedo}
				<span class="reason">{historyUnavailableReason}</span>
			{/if}
		</div>

		{#if saveControl === null}
			<div class="capability" data-unavailable-capability>
				<button
					type="button"
					class="action"
					disabled
					aria-disabled="true"
					title={saveUnavailableReason}
				>
					Save
				</button>
				<span class="reason">{saveUnavailableReason}</span>
			</div>
		{:else}
			<div
				class="capability"
				data-head-save
				data-save-status={saveStatus}
				data-unsaved={unsaved ? '' : undefined}
			>
				<button
					type="button"
					class="action"
					disabled={saveControl.disabled || projectActionBusy}
					aria-disabled={saveControl.disabled || projectActionBusy}
					title={projectActionBusy ? 'Project rename or deletion is in progress.' : saveControl.reason ?? saveControl.label}
					onclick={() => void runSave()}
				>
					{saveControl.label}
				</button>
				{#if saveControl.reason !== null}
					<span class="reason">{saveControl.reason}</span>
				{/if}
				{#if unsaved}
					<span class="reason" data-unsaved-work>Unsaved changes</span>
				{/if}
				{#if saveControl.conflict}
					<button type="button" class="action" onclick={reloadRemote}>Reload remote</button>
				{/if}
			</div>
		{/if}

		{#if canPreview}
			<div class="capability" data-head-preview>
				<button type="button" class="action" title="Enter an isolated visitor Preview" onclick={onPreview}>
					Preview
				</button>
			</div>
		{:else}
			<div class="capability" data-unavailable-capability>
				<button
					type="button"
					class="action"
					disabled
					aria-disabled="true"
					title={previewUnavailableReason}
				>
					Preview
				</button>
				<span class="reason">{previewUnavailableReason}</span>
			</div>
		{/if}


	</div>
</header>

<style>
	.head {
		--chassis-forest: #11291f;
		--chassis-forest-raised: #1c3a2c;
		--chassis-hairline: #2f4a3d;
		--head-ink: #f3f4ee;
		--head-ink-quiet: #aebbb0;
		--active-lens: #22503c;
		--focus-ring: #d4ad45;
		--control-height: 1.9rem;
		--radius: 0.35rem;

		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: 0.5rem 1rem;
		padding: 0.5rem 0.85rem;
		background: var(--chassis-forest);
		color: var(--head-ink);
		border-bottom: 1px solid var(--chassis-hairline);
		font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
	}

	.identity {
		display: flex;
		min-width: 0;
		align-items: baseline;
		gap: 0.6rem;
	}

	.app {
		margin: 0;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--head-ink-quiet);
		white-space: nowrap;
	}

	.project {
		margin: 0;
		max-width: 24rem;
		overflow: hidden;
		font-size: 1rem;
		font-weight: 600;
		line-height: 1.2;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.technical {
		font-size: 0.72rem;
		color: var(--head-ink-quiet);
	}

	.technical summary {
		cursor: pointer;
	}

	.project-id {
		display: inline-block;
		margin-top: 0.3rem;
		padding: 0.15rem 0.35rem;
		background: var(--chassis-forest-raised);
		border-radius: var(--radius);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
	}

	.lens {
		display: inline-flex;
		gap: 0.15rem;
		padding: 0.15rem;
		background: var(--chassis-forest-raised);
		border: 1px solid var(--chassis-hairline);
		border-radius: var(--radius);
	}

	.actions {
		display: flex;
		flex-wrap: nowrap;
		align-items: flex-start;
		gap: 0.35rem 0.7rem;
		margin-left: auto;
	}

	.capability {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		max-width: 11rem;
	}

	/*
		Find is a disclosure rather than a permanent panel: the Head stays one row,
		and the list it opens is the bounded set of contributed entries.
	*/
	.find {
		position: relative;
	}

	.find summary {
		min-height: var(--control-height);
		padding: 0 0.55rem;
		border: 1px solid var(--chassis-hairline);
		border-radius: var(--radius);
		background: var(--chassis-forest-raised);
		color: var(--head-ink);
		font-size: 0.78rem;
		line-height: calc(var(--control-height) - 2px);
		cursor: pointer;
		list-style: none;
	}

	.find summary::-webkit-details-marker {
		display: none;
	}

	.find summary:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
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
		border: 1px solid var(--chassis-hairline);
		border-radius: var(--radius);
		background: var(--chassis-forest);
		box-shadow: 0 0.6rem 1.4rem rgb(6 20 14 / 45%);
	}

	.find-field {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.68rem;
		color: var(--head-ink-quiet);
	}

	.find-field input {
		min-height: var(--control-height);
		padding: 0 0.4rem;
		border: 1px solid var(--chassis-hairline);
		border-radius: var(--radius);
		background: #0e211900;
		color: var(--head-ink);
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
		border: 1px solid transparent;
		border-radius: var(--radius);
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.78rem;
		text-align: left;
		cursor: pointer;
	}

	.find-results button:hover {
		border-color: var(--chassis-hairline);
		background: var(--chassis-forest-raised);
	}

	.find-results button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}

	.find-verb {
		color: var(--focus-ring);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.find-empty {
		margin: 0;
		font-size: 0.72rem;
		color: var(--head-ink-quiet);
	}

	.history-actions {
		display: flex;
		gap: 0.3rem;
	}

	.reason {
		font-size: 0.62rem;
		line-height: 1.25;
		color: var(--head-ink-quiet);
	}

	button {
		min-height: var(--control-height);
		padding: 0.2rem 0.6rem;
		border: 1px solid var(--chassis-hairline);
		border-radius: var(--radius);
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		border-color: var(--focus-ring);
	}

	button:disabled {
		cursor: default;
		color: var(--head-ink-quiet);
		border-style: dashed;
	}

	.lens-button.active {
		background: var(--active-lens);
		border-color: var(--active-lens);
		color: var(--head-ink);
	}


	button:focus-visible,
	summary:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.app-menu { position: relative; flex: none; }
	.app-menu summary { cursor: pointer; list-style: none; padding: 0.35rem; }
	.menu-body { position: absolute; z-index: 30; top: 100%; left: 0; width: 16rem; padding: 0.8rem; display: grid; gap: 0.6rem; background: var(--chassis-forest); border: 1px solid var(--chassis-hairline); }
	.menu-body label { display: flex; justify-content: space-between; gap: 0.6rem; align-items: center; }
	.menu-body p { margin: 0; font-size: 0.75rem; }
	.location { min-width: 0; max-width: 12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	@media (max-width: 1279px) { .app, .technical, .reason { display: none; } .head { gap: 0.35rem; } .actions { gap: 0.2rem; } }
</style>
