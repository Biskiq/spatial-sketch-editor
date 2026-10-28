<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { formCardController } from './form-card';
	let { services }: { services: StageAdapterServices } = $props();
	let version = $state(0);
	let message = $state('');
	let busy = $state(false);
	let alive = true;
	onDestroy(() => { alive = false; });
	const controller = $derived.by(() => {
		void version;
		const primary = services.stage.selectionState().primary;
		return primary?.domain === 'scene' && primary.subject.kind === 'entity'
			? formCardController(services, primary.subject.id) : null;
	});
	let x = $state('');
	let z = $state('');
	let yaw = $state('');
	let size = $state(['', '', '']);
	$effect(() => {
		const current = controller;
		if (current === null) return;
		x = String(current.entity.position[0]);
		z = String(current.entity.position[2]);
		yaw = String(current.entity.rotation[1]);
		size = current.dimensions.map(String);
	});
	$effect(() => services.stage.onAdaptersChanged(() => { version += 1; }));
	const finite = (text: string) => text.trim() !== '' && Number.isFinite(Number(text));
	async function run(kind: 'move' | 'turn' | 'place' | 'size' | 'duplicate') {
		const current = controller;
		if (current === null || busy) return;
		if ((kind === 'move' || kind === 'place') && (!finite(x) || !finite(z)) ||
			kind === 'turn' && !finite(yaw) || kind === 'size' && size.some((value) => !finite(value) || Number(value) <= 0)) {
			message = 'Enter finite values; dimensions must be positive.';
			return;
		}
		busy = true;
		try {
			const outcome = kind === 'move' ? await current.move(Number(x), Number(z))
				: kind === 'place' ? await current.place(Number(x), Number(z))
				: kind === 'turn' ? await current.turn(Number(yaw))
				: kind === 'size' ? await current.size(size.map(Number) as [number, number, number])
				: await current.duplicate();
			if (alive) message = outcome.kind === 'refused' ? outcome.message : outcome.kind === 'no-op' ? 'No change.' : '';
		} catch (error) {
			if (alive) message = error instanceof Error ? error.message : 'The edit failed.';
		} finally { if (alive) busy = false; }
	}
</script>

{#if controller !== null}
	<div class="form-fields" aria-label="Form fields">
		<fieldset disabled={busy}>
			<legend>Move and Place</legend>
			<label>X (m)<input aria-label="Form X (m)" type="text" inputmode="decimal" bind:value={x} /></label>
			<label>Z (m)<input aria-label="Form Z (m)" type="text" inputmode="decimal" bind:value={z} /></label>
			<button type="button" onclick={() => run('move')}>Move</button>
			<button type="button" onclick={() => run('place')}>Place on floor</button>
		</fieldset>
		<fieldset disabled={busy}>
			<legend>Turn</legend>
			<label>Yaw (rad)<input aria-label="Form yaw (rad)" type="text" inputmode="decimal" bind:value={yaw} /></label>
			<button type="button" onclick={() => run('turn')}>Turn</button>
		</fieldset>
		<fieldset disabled={busy}>
			<legend>Size</legend>
			{#each ['Width', 'Height', 'Depth'] as label, axis}
				<label>{label} (m)<input aria-label={`Form ${label.toLowerCase()} (m)`} type="text" inputmode="decimal" bind:value={size[axis]} /></label>
			{/each}
			<button type="button" onclick={() => run('size')}>Size</button>
		</fieldset>
		<button type="button" disabled={busy} onclick={() => run('duplicate')}>Duplicate</button>
		{#if message}<p role="status">{message}</p>{/if}
	</div>
{/if}

<style>
	.form-fields { display: grid; gap: 0.5rem; }
	fieldset { display: flex; flex-wrap: wrap; gap: 0.4rem; border: 0; padding: 0; margin: 0; }
	label { display: grid; gap: 0.2rem; }
	input { width: 6rem; min-height: 2rem; box-sizing: border-box; padding: 0.2rem 0.35rem;
		border: 1px solid var(--plate-control-edge, #cfd5cb); border-radius: 0.35rem;
		background: var(--plate-control-surface, #f5f6f4); color: inherit; font: inherit; }
	button { min-height: 2rem; padding: 0.25rem 0.6rem; border: 1px solid var(--plate-control-edge, #cfd5cb);
		border-radius: 0.4rem; background: var(--plate-control-surface, #f5f6f4); color: inherit; font: inherit; cursor: pointer; align-self: end; }
	button:disabled { opacity: 0.5; cursor: default; }
	input:focus-visible, button:focus-visible { outline: 2px solid var(--plate-focus, #c99a27); outline-offset: 2px; }
	@media (pointer: coarse) { input, button { min-height: 2.75rem; } button { min-width: 2.75rem; } }
</style>
