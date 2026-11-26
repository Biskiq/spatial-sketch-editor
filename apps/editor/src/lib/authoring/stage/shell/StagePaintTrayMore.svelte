<script lang="ts">
	/**
	 * The armed Paint tray's expansion: the Project palette (and its one edit
	 * mode), project Materials and the curated families, plus the route into the
	 * full Library. The palette's edit state and rename draft are local here;
	 * every write goes back through the palette port the tray was handed.
	 */
	import type { Snippet } from 'svelte';
	import type { PaintSwatch, PaintTrayView } from '$lib/authoring/look/finish-authoring.svelte';
	import { parseColourKey, type PaintColour } from '$lib/authoring/look/paint-pick';
	import { foldVariantCards, groupByMaterialFamily } from '$lib/content/material-presentation';
	import type { MaterialId } from '$lib/types/materials';
	import type { PaintTrayTab } from '$lib/authoring/look/paint-tray-state.svelte';
	import ShellIcon from './ShellIcon.svelte';

	let {
		tray,
		tab,
		palette,
		wheelStart,
		tile,
		onPick,
		onColour,
		onLibrary
	}: {
		tray: PaintTrayView;
		tab: PaintTrayTab;
		palette: {
			readonly slots: readonly { readonly id: string; readonly name: string; readonly color: string; readonly users: number }[];
			readonly room: boolean;
			readonly rename: (slotId: string, name: string) => void;
			readonly setColor: (slotId: string, color: string) => void;
			readonly remove: (slotId: string) => void;
			/** One Undo; resolves to the new slot id when the add is accepted. */
			readonly add: (color: string) => Promise<string | null> | void;
		} | null;
		wheelStart: string;
		tile: Snippet<[PaintSwatch, number]>;
		onPick: (swatch: PaintSwatch) => void;
		onColour: (colour: PaintColour) => void;
		onLibrary: () => void;
	} = $props();

	/**
	 * D1 in the tray: a variant family is one swatch, its primary (Concrete, not
	 * Polished concrete). Variants are chosen in the Library, never here; a picked
	 * variant leads the row as the pick.
	 */
	const curatedCards = $derived(
		foldVariantCards(tray.materials.curated.map((swatch) => ({ ...swatch, id: swatch.key.slice('curated:'.length) as MaterialId })))
	);
	const curatedGroups = $derived(groupByMaterialFamily(curatedCards));


	let paletteEditing = $state(false);
	let renamingSlot = $state<string | null>(null);
	let slotDraft = $state('');

	function commitSlotRename(): void {
		const slotId = renamingSlot;
		renamingSlot = null;
		if (slotId !== null && palette !== null) palette.rename(slotId, slotDraft);
	}
</script>

<div class="more" data-paint-more>
	{#if tab === 'colours'}
		{#if paletteEditing && palette !== null}
			<div class="group" role="group" aria-label="Edit project palette" data-paint-palette-edit>
				<span class="heading">
					Project palette
					<button type="button" class="linkb" aria-pressed="true" title="Done editing the palette" data-paint-palette-edit-toggle onclick={() => { paletteEditing = false; renamingSlot = null; }}>Done editing</button>
				</span>
				{#if palette.slots.length === 0}<p class="hint">No project colours yet.</p>{/if}
				<ul class="slots">
					{#each palette.slots as slot (slot.id)}
						<li>
							<input type="color" class="slot-colour" value={slot.color} aria-label={`${slot.name} colour`} title={`Change ${slot.name} everywhere it is followed`} data-paint-palette-colour={slot.id} onchange={(event) => palette.setColor(slot.id, event.currentTarget.value)} />
							{#if renamingSlot === slot.id}
								<!-- svelte-ignore a11y_autofocus -->
								<input
									type="text"
									class="slot-name-input"
									maxlength="40"
									aria-label="Palette colour name"
									autofocus
									bind:value={slotDraft}
									onkeydown={(event) => {
										if (event.key === 'Enter') commitSlotRename();
										if (event.key === 'Escape') { event.stopPropagation(); renamingSlot = null; }
									}}
									onblur={commitSlotRename}
								/>
							{:else}
								<button type="button" class="slot-name" title="Rename" data-paint-palette-rename={slot.id} onclick={() => { renamingSlot = slot.id; slotDraft = slot.name; }}>{slot.name}</button>
							{/if}
							<span class="followers" title={`${slot.users} follow${slot.users === 1 ? 's' : ''} it`}>{slot.users}</span>
							<button type="button" class="slot-remove" aria-label={`Remove ${slot.name}`} title="Remove — followers keep their colour" data-paint-palette-remove={slot.id} onclick={() => palette.remove(slot.id)}>×</button>
						</li>
					{/each}
				</ul>
				<label class="slot-add" class:disabled={!palette.room} title={palette.room ? 'Add a palette colour' : 'The palette already holds eight colours'}>
					<input type="color" value={wheelStart} disabled={!palette.room} aria-label="Add a palette colour" data-paint-palette-add onchange={(event) => palette.add(event.currentTarget.value)} />
					<span aria-hidden="true">+ Add colour</span>
				</label>
				<p class="hint">A palette change reaches every surface that follows it, as one undo.</p>
			</div>
		{:else if tray.colours.palette.length > 0 || palette !== null}
			<div class="group" role="group" aria-label="Project palette">
				<span class="heading">
					Project palette
					{#if palette !== null}<button type="button" class="linkb" aria-pressed="false" title="Change a palette colour everywhere it is followed, as one undo" data-paint-palette-edit-toggle onclick={() => (paletteEditing = true)}>Edit palette</button>{/if}
				</span>
				<span class="grid">
					{#each tray.colours.palette as slot (slot.id)}
						<button
							type="button"
							class="swatch-button colour small"
							style={`--swatch: ${slot.color}`}
							title={slot.name}
							aria-label={slot.name}
							data-paint-palette-slot={slot.id}
							onclick={() => {
								const colour = parseColourKey(`slot:${slot.id}`);
								if (colour !== null) onColour(colour);
							}}
						></button>
					{/each}
				</span>
			</div>
		{/if}
		<p class="hint">Circles colour a surface and keep its relief and sheen · rounded squares replace the Finish.</p>
	{:else}
		{#if tray.materials.project.length > 0}
			<div class="group" role="group" aria-label="This project">
				<span class="heading">This project</span>
				<span class="grid">
					{#each tray.materials.project as swatch (swatch.key)}
						<button type="button" class="swatch-button material" class:picked={tray.active?.key === swatch.key} style={`--swatch: ${swatch.color}`} title={swatch.label} aria-label={swatch.label} data-paint-swatch={swatch.key} onclick={() => onPick(swatch)}>
							{@render tile(swatch, 40)}
						</button>
					{/each}
				</span>
			</div>
		{/if}
		{#each curatedGroups as family (family.id)}
			<div class="group" role="group" aria-label={family.label} data-paint-family={family.id}>
				<span class="heading">{family.label}</span>
				<span class="grid">
					{#each family.entries as card (card.key)}
						<button type="button" class="swatch-button material" class:picked={tray.active?.key === card.key} style={`--swatch: ${card.color}`} title={card.cardLabel ?? card.label} aria-label={card.cardLabel ?? card.label} data-paint-swatch={card.key} onclick={() => onPick(card)}>
							{@render tile(card, 40)}
						</button>
					{/each}
				</span>
			</div>
		{/each}
		<button type="button" class="pill library" data-paint-library-open onclick={onLibrary}>
			<ShellIcon name="library" size={15} />
			Open the Library — search, filters, detail
		</button>
	{/if}
</div>

<style>
	.more {
		display: grid;
		gap: 10px;
		/* The prototype's expansion: as tall as the Stage allows above the dock. */
		max-height: max(12rem, calc(100dvh - 24rem));
		margin-top: 6px;
		padding-top: 8px;
		overflow: auto;
		border-top: 1px solid var(--shell-hairline);
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.heading {
		color: var(--shell-ink-3);
		font-family: var(--shell-mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.grid {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 4px;
	}
	.hint {
		margin: 0;
		color: var(--shell-ink-3);
		font-size: var(--shell-text-utility);
	}
	.swatch-button {
		position: relative;
		display: block;
		width: 40px;
		height: 40px;
		min-height: 0;
		flex: none;
		padding: 0;
		border: 0;
		background: var(--swatch);
		box-shadow: inset 0 0 0 1px rgb(18 38 29 / 16%);
		cursor: pointer;
		transition:
			box-shadow 0.12s,
			transform 0.12s;
	}
	/* The picture fills the swatch and takes its shape; the ring stays the button's. */
	.swatch-button :global(.finish-tile) {
		width: 100%;
		height: 100%;
		border-radius: inherit;
		box-shadow: inset 0 0 0 1px rgb(18 38 29 / 16%);
		pointer-events: none;
	}
	.swatch-button.colour {
		border-radius: 50%;
	}
	.swatch-button.material {
		border-radius: 22%;
	}
	.swatch-button.small {
		width: 34px;
		height: 34px;
	}
	.swatch-button:hover {
		box-shadow:
			inset 0 0 0 1px rgb(18 38 29 / 16%),
			0 0 0 2px var(--shell-white),
			0 0 0 3.5px var(--shell-leaf);
	}
	.swatch-button.picked {
		box-shadow:
			inset 0 0 0 1px rgb(18 38 29 / 16%),
			0 0 0 2px var(--shell-white),
			0 0 0 4px var(--shell-forest);
	}
	.swatch-button:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--shell-leaf);
		outline-offset: 4px;
	}
	.linkb {
		margin-left: 0.4rem;
		border: 0;
		padding: 0;
		background: transparent;
		color: inherit;
		text-decoration: underline;
		font-size: var(--shell-text-utility);
		cursor: pointer;
	}
	.slots {
		display: grid;
		gap: 0.2rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.slots li {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.slot-colour {
		width: var(--shell-control-height);
		height: var(--shell-control-height);
		padding: 0;
		border: 1px solid var(--shell-hairline);
		border-radius: 999px;
		background: transparent;
	}
	.slot-name,
	.slot-name-input {
		flex: 1;
		min-height: var(--shell-control-height);
		border: 1px solid transparent;
		background: transparent;
		color: inherit;
		text-align: left;
		font: inherit;
	}
	.slot-name-input {
		border-color: var(--shell-hairline);
	}
	.followers {
		color: var(--shell-ink-quiet);
		font-family: var(--shell-mono);
		font-size: var(--shell-text-utility);
	}
	.slot-remove {
		min-width: var(--shell-control-height);
		min-height: var(--shell-control-height);
		border: 0;
		background: transparent;
		color: var(--shell-ink-quiet);
	}
	.slot-add {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-height: var(--shell-control-height);
		cursor: pointer;
	}
	.slot-add.disabled {
		opacity: 0.5;
		cursor: default;
	}
	.slot-add input {
		width: 1.4rem;
		height: 1.4rem;
		padding: 0;
		border: 1px dashed var(--shell-hairline);
		border-radius: 999px;
		background: transparent;
	}
	.pill {
		display: inline-flex;
		min-height: 0;
		flex: none;
		align-items: center;
		gap: 6px;
		padding: 3px 9px;
		border: 1px solid var(--shell-hairline);
		border-radius: 999px;
		background: var(--shell-white);
		color: var(--shell-forest);
		font: inherit;
		font-size: var(--shell-text-utility);
		white-space: nowrap;
		cursor: pointer;
	}
	.pill:hover {
		border-color: var(--shell-leaf);
		background: var(--shell-leaf-tint);
	}
	/* D1, as on the Library shelf: the chip sits beside the picture, never over it. */
	.pill.library {
		justify-self: start;
		padding: 5px 12px;
	}
	@media (pointer: coarse) {
		.slot-colour,
		.slot-remove,
		.slot-name,
		.slot-add {
			min-height: var(--shell-touch-target);
		}
		.swatch-button {
			width: var(--shell-touch-target);
			height: var(--shell-touch-target);
		}
		.pill {
			min-height: 40px;
		}
	}
</style>
