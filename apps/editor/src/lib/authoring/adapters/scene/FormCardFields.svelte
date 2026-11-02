<script lang="ts">
	import type { Snippet } from 'svelte';
	import { compactMeasure } from '$lib/authoring/stage/shell/compact-measure';
	import { onDestroy } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { formCardController } from './form-card';
	let { services,
		detailOpen = false,
		footer, secondary
	}: { services: StageAdapterServices;
		detailOpen?: boolean;
		footer?: Snippet; secondary?: Snippet<[Snippet?]>;
	} = $props();
	let version = $state(0);
	let message = $state('');
	let busy = $state(false);
	let saveBusy = $state(false);
	let saveMessage = $state('');
	let saveRefused = $state(false);
	let alive = true;
	onDestroy(() => { alive = false; });
	const controller = $derived.by(() => {
		void version;
		const primary = services.stage.selectionState().primary;
		return primary?.domain === 'scene' && primary.subject.kind === 'entity'
			? formCardController(services, primary.subject.id) : null;
	});
	let size = $state(['', '', '']);
	$effect(() => {
		const current = controller;
		if (current === null) return;
		size = current.dimensions.map(String);
	});
	$effect(() => services.stage.onAdaptersChanged(() => { version += 1; }));
	$effect(() => {
		// Feedback belongs to the selected form and to the accepted source it was
		// written for; a later accepted edit or another selection clears it.
		void controller?.entity.id;
		void version;
		saveMessage = '';
		saveRefused = false;
	});
	const finite = (text: string) => text.trim() !== '' && Number.isFinite(Number(text));
	async function run(kind: 'size' | 'duplicate') {
		const current = controller;
		if (current === null || busy) return;
		if (kind === 'size' && size.some((value) => !finite(value) || Number(value) <= 0)) {
			message = 'Enter finite values; dimensions must be positive.';
			return;
		}
		busy = true;
		try {
			const outcome = kind === 'size' ? await current.size(size.map(Number) as [number, number, number]) : await current.duplicate();
			if (alive) {
				message = outcome.kind === 'refused' ? outcome.message : outcome.kind === 'no-op' ? 'No change.' : '';
				// Rebuild the controller from the accepted source after an install, so a
				// following Save cannot post the source this controller was built for.
				if (outcome.kind === 'installed') version += 1;
			}
		} catch (error) {
			if (alive) message = error instanceof Error ? error.message : 'The edit failed.';
		} finally { if (alive) busy = false; }
	}
	/**
	 * Save the **accepted** source this Card was built for. Save is not an edit:
	 * it adds no history entry and does not dirty the project. The library client
	 * is downloaded on first use, so a creator who never saves pays nothing.
	 */
	async function save(): Promise<void> {
		const current = controller;
		if (current === null || saveBusy) return;
		saveBusy = true;
		saveMessage = '';
		saveRefused = false;
		try {
			const outcome = await current.save();
			if (!alive) return;
			saveRefused = outcome.kind !== 'accepted';
			saveMessage = outcome.message ?? (outcome.kind === 'accepted' ? 'Saved to My Objects.' : 'The save was not accepted.');
		} catch {
			if (alive) {
				saveRefused = true;
				saveMessage = 'My Objects could not be loaded; nothing was saved.';
			}
		} finally {
			if (alive) saveBusy = false;
		}
	}
	let focusedAxis = $state<number | null>(null);
</script>

{#if controller !== null}
	<div class="form-fields" aria-label="Form fields">
		<fieldset disabled={busy}>
			{#each ['Width', 'Height', 'Depth'] as label, axis}
				<label
					>{label} (m)<input
						aria-label={`Form ${label.toLowerCase()} (m)`}
						type="text"
						inputmode="decimal"
						value={focusedAxis === axis ? size[axis]! : compactMeasure(size[axis]!)}
					onfocus={event=>{focusedAxis=axis;event.currentTarget.value=size[axis]!;}}
					oninput={event=>size[axis]=event.currentTarget.value}
					onblur={event=>{focusedAxis=null;size=controller!.dimensions.map(String);event.currentTarget.value=compactMeasure(size[axis]!);}}
						onkeydown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault();
								void run('size');
							} else if (event.key === 'Escape') {
								event.preventDefault();
								event.stopPropagation();
								size = controller!.dimensions.map(String);
							}
						}}
					/></label
				>
			{/each}

		</fieldset>
		{#if footer}{@render footer()}{/if}
		{#snippet details()}
			<button type="button" disabled={busy} onclick={() => run('duplicate')}>Duplicate</button>
			<button type="button" data-save-to-my-objects disabled={busy || saveBusy} onclick={() => void save()}>{saveBusy ? 'Saving…' : 'Save to My Objects'}</button>
		{/snippet}
		{#if secondary}{@render secondary(details)}{/if}
		{#if message}<p role="status">{message}</p>{/if}
		{#if saveMessage}
			<p role={saveRefused ? 'alert' : 'status'} class:refused={saveRefused}>{saveMessage}</p>
		{/if}
	</div>
{/if}

<style>
	.form-fields { display: grid; gap: 0; }
	fieldset {
		padding: 0 12px 8px !important;
		display: flex; flex-wrap: wrap; gap: 0.4rem; border: 0; padding: 0; margin: 0; }
	label { display: grid; gap: 2px;
		font-size: 10.5px;
		color: var(--shell-ink-2, #4a524c); }
	input { width: 78px;
		min-height: 26px;
		height: 26px; box-sizing: border-box; padding: 0.2rem 0.35rem;
		border: 1px solid var(--plate-control-edge, #cfd5cb); border-radius: 0.35rem;
		background: var(--plate-control-surface, #f5f6f4); color: inherit; font: 12px var(--shell-mono, monospace); }
	button { min-height: 2rem; padding: 0.25rem 0.6rem; border: 1px solid var(--plate-control-edge, #cfd5cb);
		border-radius: 0.4rem; background: var(--plate-control-surface, #f5f6f4); color: inherit; font: inherit; cursor: pointer; align-self: end; }
	button:disabled { opacity: 0.5; cursor: default; }
	input:focus-visible, button:focus-visible { outline: 2px solid var(--plate-focus, #c99a27); outline-offset: 2px; }
	.refused { color: #a33a24; }
	@media (pointer: coarse) { input, button { min-height: 2.75rem; } button { min-width: 2.75rem; } }
</style>
