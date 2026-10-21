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
	import { reloadOffer } from './reload-offer';

	let {
		projectName,
		canDownloadSource,
		canUndo = false,
		canRedo = false,
		save = null,
		onReloadRemote = () => {}
	}: {
		projectName: string;
		canDownloadSource: boolean;
		canUndo?: boolean;
		canRedo?: boolean;
		save?: HeadSave | null;
		onReloadRemote?: (offer: ReloadOffer) => void;
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
>
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
