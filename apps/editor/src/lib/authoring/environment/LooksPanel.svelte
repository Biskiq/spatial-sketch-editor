<script lang="ts">
	import type { LookAuthoring } from '../look/look-authoring.svelte';

	let { look }: { look: LookAuthoring } = $props();

	const treatment = $derived(look.treatment);
	const plan = $derived(look.adoptionPlan);
	const preview = $derived(look.adoptionPreview);
	const palette = $derived(look.palette);
	const busied = $derived(look.busy);

	const reading = $derived(
		treatment === undefined
			? 'Natural keeps every Finish exactly as authored.'
			: treatment === 'clay'
				? 'Clay draws one matte clay surface over the whole World.'
				: 'Flat colour keeps each Finish’s own colour and removes its maps.'
	);

	const lookPaletteHint = $derived(
		palette.length === 0 && look.activeLook !== null && look.activeLook.palette.length > 0
			? `This Look brings ${look.activeLook.palette.map((entry) => entry.name).join(', ')}.`
			: null
	);

	const skipped = $derived.by(() => {
		const counts = preview?.skipped;
		if (counts === undefined) return null;
		const parts: string[] = [];
		if (counts.imageTints > 0) parts.push(`${counts.imageTints} image-tinted`);
		if (counts.inherited > 0) parts.push(`${counts.inherited} already following`);
		return parts.length === 0 ? null : `${parts.join(' · ')} left as they are`;
	});

	function chooseTreatment(next: 'natural' | 'flat-colour' | 'clay'): void {
		void look.setTreatment(next);
	}
</script>

<div class="looks">
	<div class="tiles" role="group" aria-label="Looks">
		{#each look.looks as entry, index (entry.id)}
			<button type="button" class="look" aria-pressed={look.activeLook?.id === entry.id}
				data-sky-initial-focus={index === 0 ? '' : undefined}
				disabled={busied} onclick={() => void look.applyLook(entry.id)}>
				<i aria-hidden="true" style:background={entry.id === 'riso'
					? 'linear-gradient(#f4d35e, #3d5a80)'
					: 'linear-gradient(#e6e2da, #d4cec2)'}></i>
				<strong>{entry.label}</strong>
				<small>{entry.summary}</small>
			</button>
		{/each}
	</div>

	<p class="hint">A Look sets the Sky and Treatment. Finishes keep their colours until you adopt the palette.</p>

	<div class="row">
		<span>Treatment</span>
		<div class="segmented" role="group" aria-label="Treatment">
			<button type="button" aria-pressed={treatment === undefined} disabled={busied}
				onclick={() => chooseTreatment('natural')}>Natural</button>
			<button type="button" aria-pressed={treatment === 'flat-colour'} disabled={busied}
				onclick={() => chooseTreatment('flat-colour')}>Flat colour</button>
			<button type="button" aria-pressed={treatment === 'clay'} disabled={busied}
				onclick={() => chooseTreatment('clay')}>Clay</button>
		</div>
	</div>
	<p class="reading">{reading}</p>

	{#if look.previousEnvironment !== null}
		<button type="button" class="previous" disabled={busied} onclick={() => void look.restorePrevious()}>
			Previous
		</button>
	{/if}

	<section class="palette" aria-label="Palette">
		{#if palette.length === 0}
			<strong>No palette yet</strong>
			<p class="hint">A Look can seed a World palette. Every Finish keeps its literal colour until you adopt it.</p>
			{#if lookPaletteHint !== null}<p class="hint">{lookPaletteHint}</p>{/if}
		{:else}
			<strong>Palette · {palette.map((slot) => slot.name).join(', ')}</strong>
			{#if preview !== null}
				<div class="adoption" aria-label="Palette adoption preview">
					{#each preview.rows as row (row.color)}
						<div class="adopt-row">
							<i aria-hidden="true" style:background={row.color}></i>
							<span>{row.color} → {row.slotName}</span>
							<small>{row.finishes} {row.finishes === 1 ? 'Finish' : 'Finishes'} · {row.objects} {row.objects === 1 ? 'object' : 'objects'}</small>
						</div>
					{/each}
					{#if skipped !== null}<p class="hint">{skipped}</p>{/if}
					<div class="actions">
						<button type="button" class="primary" disabled={busied} onclick={() => void look.adoptPalette()}>Adopt</button>
						<button type="button" disabled={busied} onclick={look.cancelAdoption}>Cancel</button>
					</div>
				</div>
			{:else if plan !== null && plan.rows.length > 0}
				<p class="hint">{plan.rows.length} literal {plan.rows.length === 1 ? 'colour' : 'colours'} can follow this palette.</p>
				<button type="button" disabled={busied} onclick={look.beginAdoption}>Adopt palette…</button>
			{:else}
				<p class="hint">Every Finish already follows the palette.</p>
			{/if}
		{/if}
	</section>
</div>

<style>
	.looks { display: grid; gap: 8px; }
	.tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
	.look { display: grid; grid-template-columns: 34px 1fr; gap: 2px 8px; align-items: center; text-align: left; padding: 5px; background: transparent; border: 1px solid var(--shell-hairline); border-radius: 6px; color: inherit; }
	.look[aria-pressed=true] { border-color: var(--shell-forest); box-shadow: inset 0 0 0 1px var(--shell-forest); }
	.look i { grid-row: span 2; width: 34px; height: 34px; border-radius: 4px; }
	.look strong { font-size: 12px; }
	.look small { font-size: 10px; color: var(--shell-ink-2); line-height: 1.25; }
	.hint, .reading { margin: 0; color: var(--shell-ink-2); font-size: 11px; line-height: 1.4; }
	.row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
	.row > span { font-size: 12px; }
	.segmented { display: flex; border: 1px solid var(--shell-hairline); border-radius: 5px; overflow: hidden; }
	.segmented button { padding: 3px 6px; border: 0; background: transparent; color: inherit; font: 11px var(--shell-sans); }
	.segmented button + button { border-left: 1px solid var(--shell-hairline); }
	.segmented button[aria-pressed=true] { background: var(--shell-forest); color: var(--shell-surface-raised); }
	.previous { justify-self: start; padding: 3px 8px; border: 1px solid var(--shell-hairline); border-radius: 5px; background: transparent; color: var(--shell-forest); font: 11px var(--shell-sans); }
	.palette { display: grid; gap: 6px; border-top: 1px solid var(--shell-hairline); padding-top: 8px; }
	.palette strong { font-size: 12px; }
	.adoption { display: grid; gap: 4px; }
	.adopt-row { display: grid; grid-template-columns: 14px 1fr; gap: 0 6px; align-items: center; font-size: 11px; }
	.adopt-row i { width: 14px; height: 14px; border-radius: 3px; grid-row: span 2; }
	.adopt-row small { color: var(--shell-ink-2); font: 10px var(--shell-mono); }
	.actions { display: flex; gap: 6px; }
	button:disabled { opacity: .5; }
	.primary { border-color: var(--shell-forest); }
</style>
