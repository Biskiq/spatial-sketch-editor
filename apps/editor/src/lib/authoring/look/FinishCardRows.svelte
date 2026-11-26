<script lang="ts">
	import type { FinishColourMode, SheenStepId } from '@portfolio/project-model/scene-planning';
	import type { MaterialId } from '$lib/types/materials';
	import type { FinishCardView } from './finish-card-contract';
	import FinishTile from './FinishTile.svelte';
	import FinishSwapPicker from './FinishSwapPicker.svelte';
	import StagePaintWheel from '$lib/authoring/stage/shell/StagePaintWheel.svelte';
	import PrivateLibrarySaveButton from '$lib/authoring/library/PrivateLibrarySaveButton.svelte';
	import type { PaintColour } from './paint-pick';

	type FinishView = Extract<FinishCardView, { kind: 'finish' }>;
	type SheenStep = { label: string; disabled: boolean; id: SheenStepId };

	const MODE_LABEL: Readonly<Record<FinishColourMode, string>> = {
		natural: 'Natural',
		stained: 'Stained',
		painted: 'Painted'
	};
	const MODE_TITLE: Readonly<Record<FinishColourMode, string>> = {
		natural: 'The material’s own colour',
		stained: 'Tints the image — grain and pattern stay',
		painted: 'A coat of colour — relief and sheen stay'
	};

	let {
		view,
		swapOpen = $bindable(),
		colourOpen = $bindable(),
		colourSwatch = $bindable(),
		alignRefusal = $bindable(),
		menuOpen = $bindable(),
		editMaterialButton = $bindable(),
		openSwap,
		swapTo,
		chooseMode,
		chooseSlot,
		closeColour,
		previewHex,
		useColour,
		chooseSheen,
		sheenTitle,
		triggerAlign,
		toggleFavourite,
		startRename,
		openEditor,
		onSelectAll,
		onGiveOwnCopy,
		onReset,
		onStepPattern,
		onTurnPattern
	}: {
		view: FinishView;
		swapOpen: boolean;
		colourOpen: boolean;
		colourSwatch: HTMLButtonElement | undefined;
		alignRefusal: string | null;
		menuOpen: boolean;
		editMaterialButton: HTMLButtonElement | undefined;
		openSwap: () => void;
		swapTo: (id: MaterialId) => void;
		chooseMode: (mode: FinishColourMode) => void;
		chooseSlot: (slotId: string) => void;
		closeColour: (discard?: boolean) => void;
		previewHex: (value: string) => void;
		useColour: (colour: PaintColour) => void;
		chooseSheen: (id: SheenStepId) => void;
		sheenTitle: (step: SheenStep, view: FinishView) => string;
		triggerAlign: () => void;
		toggleFavourite: () => void;
		startRename: () => void;
		openEditor: () => void;
		onSelectAll: () => void;
		onGiveOwnCopy: () => void;
		onReset: () => void;
		onStepPattern: (delta: -1 | 1) => void;
		onTurnPattern: () => void;
	} = $props();
</script>

				<div class="row">
					<span class="label">
						<svg class="row-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M2.5 8h11M8 2.5v11"/></svg>
						Material
					</span>
					<div class="value">
						<FinishTile source={view.tile.source} color={view.tile.color} size={22} />
						<span class="material"><span class="material-name">{view.material.label}</span><span class="material-sub">{view.material.sub}</span></span>
						<button
							type="button"
							class="link push"
							title="Choose another material in the Library — keeps this colour and sheen"
							aria-haspopup="dialog"
							aria-expanded={swapOpen}
							data-finish-swap
							onclick={openSwap}
						>Swap ›</button>
					</div>
				</div>
				{#if swapOpen}
					<FinishSwapPicker current={view.material.catalogueId} onChoose={swapTo} onClose={() => (swapOpen = false)} />
				{/if}

				<div class="row">
					<span class="label">
						<svg class="row-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><circle cx="6.2" cy="6.6" r="1" fill="currentColor"/><circle cx="9.8" cy="6.6" r="1" fill="currentColor"/><circle cx="8" cy="9.8" r="1" fill="currentColor"/></svg>
						Colour
					</span>
					<div class="value">
						<span class="seg" role="group" aria-label="Colour mode">
							{#each view.colour.modes as mode (mode)}
								<button
									type="button"
									aria-pressed={view.colour.mode === mode}
									title={MODE_TITLE[mode]}
									data-finish-colour-mode={mode}
									onclick={() => chooseMode(mode)}
								>{MODE_LABEL[mode]}</button>
							{/each}
						</span>
						<span class="caption">{view.colour.caption}</span>
					</div>
					<div class="chips">
						{#each view.colour.chips as chip (chip.id)}
							<button
								type="button"
								class="chip"
								style={`--chip: ${chip.color}`}
								aria-pressed={chip.active}
								aria-label={chip.name}
								title={`${chip.name} · follows the palette`}
								data-finish-chip={chip.id}
								onclick={() => chooseSlot(chip.id)}
							></button>
						{/each}
						<button
							type="button"
							class="chip add"
							class:lit={view.colour.custom}
							style={view.colour.custom ? `--chip: ${view.colour.hex}` : undefined}
							title={view.colour.custom ? `${view.colour.hex} · not linked to the palette` : 'Any colour'}
							aria-label="Any colour"
							aria-haspopup="dialog"
							aria-expanded={colourOpen}
							data-finish-colour-any
							bind:this={colourSwatch}
							onclick={() => (colourOpen ? closeColour() : (colourOpen = true))}
						>{#if !view.colour.custom}<span aria-hidden="true">+</span>{/if}</button>
					</div>
					{#if colourOpen}
						<div class="colour-picker" data-finish-colour-picker>
							<StagePaintWheel
								title="Finish colour"
								initial={view.colour.hex ?? '#9aa58c'}
								original={view.colour.hex ?? null}
								palette={view.colour.chips}
								onChange={previewHex}
								onUse={useColour}
								onClose={() => closeColour()}
							/>
						</div>
					{/if}
				</div>

				<div class="row">
					<span class="label">
						<svg class="row-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="5"/><path d="M5.5 6.5a2.5 2.5 0 0 1 2.5-2.5"/></svg>
						Sheen
					</span>
					<div class="value">
						<span class="seg" role="group" aria-label="Sheen">
							{#each view.sheen.steps as step (step.id)}
								<button
									type="button"
									aria-pressed={view.sheen.current === step.id && (view.sheen.changed || step.id === view.sheen.original)}
									disabled={step.disabled}
									title={sheenTitle(step, view)}
									data-finish-sheen={step.id}
									onclick={() => chooseSheen(step.id)}
								>{step.label}{#if step.id === view.sheen.original}<i class="dot" aria-label="Original"></i>{/if}</button>
							{/each}
						</span>
						<span class="caption">{view.sheen.caption}</span>
					</div>
				</div>

				{#if view.pattern !== null}
					<div class="row">
						<span class="label">
							<svg class="row-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 6h10M3 10h10M6 3v10M10 3v10"/></svg>
							Pattern
						</span>
						<div class="value">
							<span class="pattern-value">{view.pattern.caption}</span>
							<span class="push steps">
								<button type="button" class="step" aria-label="Smaller pattern" title="Smaller pattern (½×)" disabled={!view.pattern.canSmaller} data-finish-pattern-smaller onclick={() => onStepPattern(-1)}>−</button>
								<button type="button" class="step" aria-label="Larger pattern" title="Larger pattern (2×)" disabled={!view.pattern.canLarger} data-finish-pattern-larger onclick={() => onStepPattern(1)}>+</button>
								<button type="button" class="step wide" aria-label="Turn the pattern 90 degrees" title="Turn the pattern 90°" data-finish-pattern-turn onclick={onTurnPattern}>↻ 90°</button>
							</span>
						</div>
						{#if view.align !== null}
							<div class="value">
								<button
									type="button"
									class="link"
									title="Face this surface straight on: ruler, repeat grid, offset and rotation handles"
									data-finish-align
									onclick={triggerAlign}
								>{view.align.label}</button>
							</div>
						{/if}
						{#if alignRefusal !== null}
							<p class="refusal" role="status" data-finish-align-refusal>{alignRefusal}</p>
						{/if}
					</div>
				{/if}

				<div class="foot">
					<button
						type="button"
						class="star"
						class:on={view.favourite}
						aria-pressed={view.favourite}
						aria-label="Favourite"
						title={view.favourite ? 'In your tray favourites — click to remove' : 'Keep in your tray favourites'}
						data-finish-favourite
						onclick={toggleFavourite}
					>★</button>
					<PrivateLibrarySaveButton
						finishKey={view.finishKey}
						name={view.name}
						tileSource={view.tile.source}
					/>
					<button
						type="button"
						class="foot-text"
						title="Exact values, maps, mapping — the same Finish, widened"
						data-finish-edit-material
						bind:this={editMaterialButton}
						onclick={openEditor}
					>Edit material…</button>
					<span class="menu-wrap push">
						<button type="button" aria-label="More actions" aria-haspopup="menu" aria-expanded={menuOpen} data-finish-menu onclick={() => (menuOpen = !menuOpen)}>⋯</button>
						{#if menuOpen}
							<div class="menu" role="menu">
								<button
									type="button"
									role="menuitem"
									disabled={!view.canRename}
									title={view.canRename ? undefined : 'Curated names stay fixed'}
									onclick={() => {
										menuOpen = false;
										startRename();
									}}
								>Rename…</button>
								<button
									type="button"
									role="menuitem"
									disabled={view.reach.users < 2}
									title={view.reach.users < 2 ? 'Only one surface uses this Finish' : undefined}
									data-finish-select-all
									onclick={() => {
										menuOpen = false;
										onSelectAll();
									}}
								>{view.reach.users > 1 ? `Select all using this Finish (${view.reach.users})` : 'Select all using this Finish'}</button>
								<button
									type="button"
									role="menuitem"
									disabled={view.reach.users < 2 || view.curated}
									title={view.curated ? 'Curated Finishes make a copy on your first change' : view.reach.users < 2 ? 'Only this surface uses this Finish' : undefined}
									data-finish-own-copy
									onclick={() => {
										menuOpen = false;
										onGiveOwnCopy();
									}}
								>Give this surface its own copy</button>
								<button
									type="button"
									role="menuitem"
									disabled={view.resetCount === 0}
									title={view.resetCount === 0 ? 'Nothing changed from the material' : undefined}
									data-finish-reset
									onclick={() => {
										menuOpen = false;
										onReset();
									}}
								>{view.resetCount > 0 ? `Reset to original (${view.resetCount})` : 'Reset to original'}</button>
								<hr class="menu-sep" />
								<button
									type="button"
									role="menuitem"
									disabled
									title="Only unused Finishes can be removed — this one has users"
									data-finish-remove-unused
								>Remove unused</button>
							</div>
						{/if}
					</span>
				</div>

<style>

	.row {
		display: grid;
		grid-template-columns: 74px minmax(0, 1fr);
		gap: 4px 8px;
		align-items: center;
		padding: 8px 0;
		border-top: 1px solid var(--shell-hairline);
	}
	.row > :not(.label) {
		grid-column: 2;
	}
	/*
		The prototype Card is 288 wide; a host narrower than that (the shell Card
		is 252 at ≤ 860 px) cannot fit the three-step segments beside a 74 px label,
		so the value drops under its label instead of clipping (262 content px fits).
	*/
	@container finish-card (max-width: 259px) {
		.row {
			grid-template-columns: minmax(0, 1fr);
		}
		.row > :not(.label) {
			grid-column: 1;
		}
	}
	.label {
		display: flex;
		align-items: center;
		align-self: start;
		gap: 5px;
		padding-top: 2px;
		color: var(--shell-ink-2);
		font-size: 11.5px;
	}
	.row-icon {
		flex: 0 0 auto;
		color: var(--shell-ink-2);
	}
	.value {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.material {
		display: grid;
		min-width: 0;
		font-size: 12.5px;
		font-weight: 600;
		line-height: 1.25;
	}
	.material-sub {
		color: var(--shell-ink-2);
		font-size: 11px;
		font-weight: 400;
	}
	.pattern-value {
		font-size: 12.5px;
	}
	.push {
		margin-left: auto;
	}
	.caption {
		color: var(--shell-ink-2);
		font-size: 11.5px;
		white-space: nowrap;
	}
	/* The prototype's mseg: a pill on the panel tint, 12 px steps. */
	.seg {
		display: inline-flex;
		padding: 2px;
		border-radius: 999px;
		background: var(--shell-ivory);
		box-shadow: inset 0 0 0 1px var(--shell-hairline-strong);
	}
	.seg button {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 1px 9px;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--shell-ink-2);
		font-size: 12px;
		line-height: 18px;
		cursor: pointer;
	}
	.seg button:hover:not(:disabled):not([aria-pressed='true']) {
		background: var(--shell-hover);
		color: var(--shell-forest);
	}
	/* A light surface: the Paint tray's pressed segment, not the dark toolbar's. */
	.seg button[aria-pressed='true'] {
		background: var(--shell-forest);
		color: var(--shell-white);
	}
	.seg button:disabled {
		opacity: 0.38;
		cursor: default;
	}
	.dot {
		display: inline-block;
		width: 5px;
		height: 5px;
		margin-left: 1px;
		border-radius: 50%;
		background: var(--shell-gold);
	}
	.link {
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--shell-forest-3);
		font-size: 12px;
		line-height: 18px;
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip {
		position: relative;
		display: grid;
		place-items: center;
		flex: none;
		width: 22px;
		height: 22px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: var(--chip, transparent);
		box-shadow: inset 0 0 0 1px rgb(18 38 29 / 20%);
		color: var(--shell-ink-2);
		cursor: pointer;
	}
	.chip:hover {
		box-shadow: inset 0 0 0 1px rgb(18 38 29 / 20%), 0 0 0 2px var(--shell-white), 0 0 0 3px var(--shell-leaf);
	}
	.chip[aria-pressed='true'],
	.chip.lit {
		box-shadow: inset 0 0 0 1px rgb(18 38 29 / 20%), 0 0 0 2px var(--shell-white), 0 0 0 3.5px var(--shell-forest);
	}
	.chip.add {
		border: 1px dashed var(--shell-ink-2);
		background: var(--chip, var(--shell-white));
		box-shadow: none;
	}
	/*
		Finish colour floats beside the Card, on the Stage side, top-aligned with it.
		No ancestor between it and the Card is positioned, so the Card is its
		containing block and the Card's scrolling writer does not clip it.
	*/
	.colour-picker {
		position: absolute;
		z-index: 3;
		top: 0;
		right: calc(100% + 10px);
		max-height: calc(100% + 120px);
		display: flex;
	}
	.steps {
		display: inline-flex;
		gap: 4px;
	}
	/* The prototype's stepb. */
	.step {
		display: inline-grid;
		place-items: center;
		min-width: 26px;
		height: 24px;
		padding: 0 6px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 7px;
		background: var(--shell-white);
		color: var(--shell-forest);
		font-size: 13px;
		white-space: nowrap;
		cursor: pointer;
	}
	.step:hover:not(:disabled) {
		background: var(--shell-hover);
	}
	.step.wide {
		font-size: 12px;
	}
	.step:disabled {
		opacity: 0.45;
	}
	/* tokens.css.card.foot: edge to edge, 6 × 8 padding, plain text buttons. */
	.foot {
		display: flex;
		align-items: center;
		gap: 4px;
		margin: 0 -12px;
		padding: 6px 8px;
		border-top: 1px solid var(--shell-hairline-strong);
		color: var(--shell-ink-2);
		font-size: 12px;
	}
	.foot button {
		padding: 4px 8px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--shell-forest);
		font-size: 12px;
		line-height: 18px;
		white-space: nowrap;
		cursor: pointer;
	}
	/* A host narrower than the prototype's 288 shortens the words, never drops ⋯. */
	.foot .foot-text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.foot .menu-wrap {
		flex: none;
	}
	.foot button:hover:not(:disabled) {
		background: var(--shell-hover);
	}
	.foot button:focus-visible {
		outline: var(--shell-focus-ring-light);
	}
	.foot .star {
		display: grid;
		flex: none;
		place-items: center;
		width: 17px;
		height: 28px;
		padding: 0;
		color: var(--shell-ink-2);
		font-size: 16px;
	}
	.foot button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.menu-sep {
		margin: 0.2rem 0;
		border: 0;
		border-top: 1px solid var(--shell-hairline);
	}
	.star.on {
		color: var(--shell-gold);
	}
	.menu-wrap {
		position: relative;
	}
	.menu {
		position: absolute;
		right: 0;
		bottom: calc(100% + 0.25rem);
		z-index: 2;
		display: grid;
		min-width: 12rem;
		padding: 0.25rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.35rem;
		background: var(--shell-popover);
		box-shadow: 0 0.4rem 1rem rgb(6 20 14 / 12%);
	}
	.menu button {
		display: flex;
		align-items: center;
		justify-content: start;
		min-height: 28px;
		border: 0;
		text-align: left;
		padding: 0 0.5rem;
	}
	.menu button:disabled {
		opacity: 0.45;
	}	@media (pointer: coarse) {
		.foot button,
		.link {
			min-height: var(--shell-touch-target);
		}
		.step {
			min-width: 40px;
			height: 40px;
		}
		.chip {
			width: 32px;
			height: 32px;
		}
	}
</style>
