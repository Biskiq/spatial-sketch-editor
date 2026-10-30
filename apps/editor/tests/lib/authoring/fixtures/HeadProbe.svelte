<script lang="ts">
	/**
	 * Route-harness double for `EditorHead`.
	 *
	 * The route tests own the host's *replacement*, *resume* and *Save* wiring,
	 * not the Head's rendering (that is T2's mounted Save journey). This double
	 * exposes the Save snapshot and control the route built, a Save/Resume button
	 * that runs the same command the real Head runs, and a Reload control that
	 * hands `applyReloadOffer` an invalid remote document, so the route's
	 * preservation branch is exercised without a real conflict round trip.
	 */
	import { untrack } from 'svelte';
	import type { HeadSave } from '$lib/authoring/save/head-save';
	import type { ReloadOffer } from '$lib/authoring/save/save-state';
	import ProjectLifecycleActions from '$lib/platform/ProjectLifecycleActions.svelte';
	import type {
		PreparedProjectLifecycle,
		ProjectLifecycleActionResult,
		ProjectLifecyclePrepareResult
	} from '$lib/platform/project-persistence';
	import { reloadOffer } from './reload-offer';

	let {
		projectName,
		projectId = 'project-1',
		canDownloadSource,
		canUndo = false,
		canRedo = false,
		historyUnavailableReason = '',
		save = null,
		onReloadRemote = () => {},
		projectActionsUnavailableReason = null,
		projectActionBusy = false,
		onPrepareRename = async () => ({ kind: 'blocked' as const, message: 'Unavailable' }),
		onRenameProject = async () => ({ kind: 'refused' as const, message: 'Unavailable' }),
		onPrepareDelete = async () => ({ kind: 'blocked' as const, message: 'Unavailable' }),
		onDeleteProject = async () => ({ kind: 'refused' as const, message: 'Unavailable' }),
		onProjectActionComplete = async () => {},
		onProjectActionBusyChange = () => {},
		onRefreshRemoteProject = null,
		find = null,
		indexOpen = true,
		onOpenIndex = () => {},
		reducedMotion = false,
		onToggleReducedMotion = () => {},
		lens = 'world',
		onLens = () => {}
	}: {
		projectName: string;
		projectId?: string;
		canDownloadSource: boolean;
		canUndo?: boolean;
		canRedo?: boolean;
		historyUnavailableReason?: string;
		save?: HeadSave | null;
		onReloadRemote?: (offer: ReloadOffer) => void;
		projectActionsUnavailableReason?: string | null;
		projectActionBusy?: boolean;
		onPrepareRename?: () => Promise<ProjectLifecyclePrepareResult>;
		onRenameProject?: (prepared: PreparedProjectLifecycle, name: string) => Promise<ProjectLifecycleActionResult>;
		onPrepareDelete?: () => Promise<ProjectLifecyclePrepareResult>;
		onDeleteProject?: (prepared: PreparedProjectLifecycle) => Promise<ProjectLifecycleActionResult>;
		onProjectActionComplete?: (result: Extract<ProjectLifecycleActionResult, { kind: 'renamed' | 'deleted' | 'unchanged' }>) => void | Promise<void>;
		onProjectActionBusyChange?: (busy: boolean) => void;
		onRefreshRemoteProject?: (() => void | Promise<void>) | null;
		find?: { entries: readonly { id: string; adapterId: string; label: string; verb: string }[]; onRun: (entry: { id: string; adapterId: string; label: string; verb: string }) => void } | null;
		indexOpen?: boolean;
		onOpenIndex?: () => void;
		reducedMotion?: boolean;
		onToggleReducedMotion?: () => void;
		lens?: 'world' | 'experience';
		onLens?: (lens: 'world' | 'experience') => void;
	} = $props();

	let version = $state(0);
	$effect(() => {
		const current = save;
		if (current === null) return;
		// `subscribe` notifies synchronously on subscription; untrack it so this
		// effect does not depend on the version counter it writes.
		return untrack(() =>
			current.subscribe(() => {
				version += 1;
			})
		);
	});
	const snapshot = $derived.by(() => {
		void version;
		return save?.snapshot() ?? null;
	});
	const control = $derived.by(() => {
		void version;
		return save?.control() ?? null;
	});

	async function runSave(): Promise<void> {
		if (save === null) return;
		const status = save.snapshot().status;
		if (status === 'refused' || status === 'error' || status === 'auth-required') await save.retry();
		else await save.save();
	}

	// The offer is the fixture's, not the probe's: a suite that needs an
	// *admitting* remote copy (TD-10's stale-reload regressions) sets one.
	function offerReload(): void {
		onReloadRemote(reloadOffer() as ReloadOffer);
	}
</script>

<div
	data-testid="head"
	data-project={projectName}
	data-can-download={String(canDownloadSource)}
	data-save-status={snapshot?.status ?? 'none'}
	data-save-base={snapshot?.savedBaseToken ?? 'none'}
	data-save-label={control?.label ?? 'none'}
	data-save-disabled={String(control?.disabled ?? true)}
	data-can-undo={String(canUndo)}
	data-can-redo={String(canRedo)}
	data-undo-reason={historyUnavailableReason}
	data-project-actions-reason={projectActionsUnavailableReason ?? 'available'}
	data-project-action-busy={String(projectActionBusy)}
>
	{#if !indexOpen}<button type="button" data-head-location onclick={onOpenIndex}>Open Index</button>{/if}
	<button type="button" data-head-motion aria-pressed={reducedMotion} onclick={onToggleReducedMotion}>Reduce motion</button>
	<button type="button" data-testid="lens-world" aria-pressed={lens === 'world'} onclick={() => onLens('world')}>World</button>
	<button type="button" data-testid="lens-experience" aria-pressed={lens === 'experience'} onclick={() => onLens('experience')}>Experience</button>
	{#if find}
		<div data-head-find><div class="find-results">
			{#each find.entries as entry (`${entry.adapterId}:${entry.id}`)}
				<button type="button" data-find-id={entry.id} data-find-adapter={entry.adapterId} onclick={() => find?.onRun(entry)}>{entry.verb} {entry.label}</button>
			{/each}
		</div></div>
	{/if}
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
	{#if save !== null}
		<button type="button" data-testid="head-save" disabled={control?.disabled ?? true} onclick={() => void runSave()}>
			{control?.label ?? 'Save'}
		</button>
		{#if control?.reason !== null && control?.reason !== undefined}
			<span data-testid="head-save-reason">{control.reason}</span>
		{/if}
	{/if}
	<button type="button" onclick={offerReload}>Reload remote</button>
</div>
