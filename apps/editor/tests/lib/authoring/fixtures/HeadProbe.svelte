<script lang="ts">
	/**
	 * Route-harness double for `EditorHead`.
	 *
	 * The route test owns the host's *replacement* behaviour, not the Head's
	 * rendering (that is T2's mounted Save journey). This double exposes the Save
	 * snapshot the route built — status and saved-base token — and a Reload
	 * control that hands `applyReloadOffer` an invalid remote document, so the
	 * route's preservation branch is exercised without a real conflict round trip.
	 */
	import { untrack } from 'svelte';
	import type { HeadSave } from '$lib/authoring/save/head-save';
	import type { ReloadOffer } from '$lib/authoring/save/save-state';

	let {
		projectName,
		canDownloadSource,
		save = null,
		onReloadRemote = () => {}
	}: {
		projectName: string;
		canDownloadSource: boolean;
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

	// A remote row that cannot be admitted: the route must report it and keep the
	// mounted project, not install the offer.
	const invalidOffer: ReloadOffer = {
		kind: 'reload',
		projectId: 'project-1',
		document: { nope: true },
		savedBaseToken: 'remote-token',
		savedRevision: { projectId: 'project-1', revisionId: 'remote-revision' },
		savedSourceContentId: 'remote-content'
	};
</script>

<div
	data-testid="head"
	data-project={projectName}
	data-can-download={String(canDownloadSource)}
	data-save-status={snapshot?.status ?? 'none'}
	data-save-base={snapshot?.savedBaseToken ?? 'none'}
>
	<button type="button" onclick={() => onReloadRemote(invalidOffer)}>Reload remote</button>
</div>
