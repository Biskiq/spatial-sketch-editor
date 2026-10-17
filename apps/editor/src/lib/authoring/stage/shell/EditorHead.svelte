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
	import { resolveRovingIndex, tablistTabIndex } from '$lib/authoring/a11y/roving-focus';
	import type { HeadSave } from '$lib/authoring/save/head-save';
	import type { ReloadOffer } from '$lib/authoring/save/save-state';

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
		previewUnavailableReason,
		reducedMotion,
		onToggleReducedMotion
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
		previewUnavailableReason: string;
		reducedMotion: boolean;
		onToggleReducedMotion: () => void;
	} = $props();

	const LENSES = [
		{ id: 'world', label: 'World' },
		{ id: 'experience', label: 'Experience' }
	] as const;

	let selectedLensIndex = $derived(LENSES.findIndex((entry) => entry.id === lens));
	const lensButtons: HTMLButtonElement[] = [];

	// The Save state notifies on every settled command; this counter is the
	// component's read signal, not a second copy of the state.
	let saveVersion = $state(0);
	$effect(() => {
		if (save === null) return;
		const unsubscribe = save.subscribe(() => (saveVersion += 1));
		saveVersion += 1;
		return unsubscribe;
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
		if (save === null || saveControl === null) return;
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

<header class="head" data-editor-head>
	<div class="identity">
		<p class="app">Museum Editor</p>
		<h1 class="project" title={projectName}>{projectName}</h1>
		<details class="technical">
			<summary>Technical details</summary>
			<code class="project-id" title={projectId}>{projectId}</code>
		</details>
	</div>

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
					disabled={saveControl.disabled}
					aria-disabled={saveControl.disabled}
					title={saveControl.reason ?? saveControl.label}
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

		<button
			type="button"
			class="action"
			disabled={!canDownloadSource}
			onclick={onDownloadSource}
		>
			Download source JSON
		</button>

		<button
			type="button"
			class="action motion"
			aria-pressed={reducedMotion}
			onclick={onToggleReducedMotion}
		>
			Reduced motion {reducedMotion ? 'on' : 'off'}
		</button>
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
		flex-wrap: wrap;
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
		flex-wrap: wrap;
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

	.motion[aria-pressed='true'] {
		background: var(--active-lens);
		border-color: var(--active-lens);
	}

	button:focus-visible,
	summary:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	@media (pointer: coarse) {
		button {
			min-height: 44px;
			min-width: 44px;
		}
	}
</style>
