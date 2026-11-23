<script lang="ts" module>
	import type { FinishCardTarget } from './finish-card.svelte';

	/** One Finish user the Card lists: an object, a Wall side, a floor or a ceiling. */
	export type FinishCardPart = {
		readonly target: FinishCardTarget;
		/** The row's name ("Inside", "Floor"); an object's single part may leave it empty. */
		readonly label: string;
		/** The reach line's name ("North wall · Inside"). */
		readonly place: string;
	};
</script>

<script lang="ts">
	/**
	 * The Card's Finish section (T2.S8 U4): the quick Finish.
	 *
	 * A subject with several surfaces lists them first (Wall sides, floor and
	 * ceiling); a row opens that surface's Finish, with Back. One surface opens
	 * directly. The body follows the approved #399 Card: head, meta, reach (shown
	 * before the edit, D2), Material + Swap, Colour, Sheen, Pattern, More, and a
	 * foot with ★ and ⋯. Every control is one Finish patch through the one Card
	 * adapter; a gesture previews and writes once on release.
	 */
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import type { FinishColourMode, SheenStepId } from '@portfolio/project-model/scene-planning';
	import { untrack } from 'svelte';
	import { finishCardTargetKey, type FinishCardView } from './finish-card.svelte';
	import FinishTile from './FinishTile.svelte';
	import FinishSwapPicker from './FinishSwapPicker.svelte';

	let {
		services,
		parts,
		subjectLabel
	}: {
		services: StageAdapterServices;
		parts: readonly FinishCardPart[];
		/** The subject's name, for Back's title. */
		subjectLabel: string;
	} = $props();

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

	let revision = $state(0);
	let openKey = $state<string | null>(null);
	let swapOpen = $state(false);
	let renaming = $state(false);
	let renameDraft = $state('');
	let menuOpen = $state(false);
	let imageInput = $state<HTMLInputElement>();
	let lastPartsKey = '';

	$effect(() => services.stage.onAdaptersChanged(() => (revision += 1)));

	const card = $derived(services.finishes?.current?.card ?? null);
	// More stays open across the remount an install causes: the adapter keeps
	// which surface's More is open, so another subject starts closed.
	const moreOpen = $derived(card !== null && openKey !== null && card.moreOpenFor === openKey);
	const partsKey = $derived(parts.map((part) => finishCardTargetKey(part.target)).join('|'));

	// A new subject starts on its surface list (or its one surface).
	// A Paint click asks for the painted surface; it opens once this subject lists it.
	$effect(() => {
		const key = partsKey;
		const asked = card?.requested ?? null;
		const changed = key !== lastPartsKey;
		if (!changed && asked === null) return;
		lastPartsKey = key;
		let next = changed ? (parts.length === 1 ? finishCardTargetKey(parts[0]!.target) : null) : openKey;
		// A Paint request is consumed only by the Card that lists its target: an
		// outgoing Card, or one whose parts have not arrived yet, leaves it.
		if (asked !== null && parts.some((part) => finishCardTargetKey(part.target) === asked)) {
			untrack(() => card?.clearRequest());
			next = asked;
		}
		if (next === openKey && !changed) return;
		openKey = next;
		swapOpen = false;
		renaming = false;
		menuOpen = false;
	});

	const openPart = $derived(parts.find((part) => finishCardTargetKey(part.target) === openKey) ?? null);

	// The adapter's reach and gesture belong to the open surface only.
	// Teardown must not re-read `services`: the parent's prop getter can already
	// point at a retired writer, so the release uses the adapter it last focused.
	let focusedCard: typeof card = null;
	$effect(() => {
		focusedCard = card;
		card?.focus(openPart?.target ?? null);
	});
	$effect(() => () => focusedCard?.focus(null));

	const view = $derived.by((): FinishCardView | null => {
		void revision;
		if (card === null || openPart === null) return null;
		return card.view(openPart.target, openPart.place);
	});
	const refusal = $derived.by(() => {
		void revision;
		void view;
		return card === null || openPart === null ? null : card.refusalFor(openPart.target);
	});
	const rows = $derived.by(() => {
		void revision;
		if (card === null || parts.length <= 1) return [];
		return parts.map((part) => ({ part, view: card.view(part.target, part.place) }));
	});

	function open(part: FinishCardPart): void {
		openKey = finishCardTargetKey(part.target);
	}

	function back(): void {
		card?.cancel();
		openKey = null;
		swapOpen = false;
		renaming = false;
		card?.setMoreOpen(null);
	}

	/** Esc ladder: the innermost Card-local level closes first; deselect is the Card's. */
	function onKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;
		let consumed = true;
		if (menuOpen) menuOpen = false;
		else if (card?.cancel()) void 0;
		else if (swapOpen) swapOpen = false;
		else if (renaming) renaming = false;
		else if (openPart !== null && parts.length > 1) back();
		else consumed = false;
		if (consumed) {
			event.stopPropagation();
			event.preventDefault();
		}
	}

	/**
	 * A cancelled drag writes nothing, and the range input is uncontrolled while
	 * the Finish's value stays the same: put the thumb back on the written value.
	 */
	function cancelRoughness(input: HTMLInputElement): void {
		card?.cancel();
		restoreRoughness(input);
	}
	function restoreRoughness(input: HTMLInputElement): void {
		if (view?.kind === 'finish') input.value = String(view.more.roughness);
	}

	function startRename(): void {
		if (view?.kind !== 'finish' || !view.canRename) return;
		renameDraft = view.name;
		renaming = true;
	}

	async function commitRename(): Promise<void> {
		if (!renaming || openPart === null || card === null) return;
		renaming = false;
		await card.rename(openPart.target, renameDraft);
	}

	function chooseMode(mode: FinishColourMode): void {
		if (openPart !== null) void card?.setColourMode(openPart.target, mode);
	}

	function chooseSlot(slotId: string): void {
		if (openPart !== null) void card?.setColour(openPart.target, { slot: slotId });
	}

	function previewHex(value: string): void {
		if (openPart !== null) card?.previewColour(openPart.target, value.toLowerCase());
	}

	function commitHex(value: string): void {
		if (openPart !== null) void card?.setColour(openPart.target, value.toLowerCase());
	}

	function chooseSheen(id: SheenStepId): void {
		if (openPart !== null) void card?.setSheen(openPart.target, id);
	}

	function sheenTitle(step: { label: string; disabled: boolean; id: SheenStepId }, current: Extract<FinishCardView, { kind: 'finish' }>): string {
		if (step.disabled) {
			return `${current.material.label} is captured at r ${current.sheen.scan.mean.toFixed(2)} — it can’t be made rougher than captured`;
		}
		return step.id === current.sheen.original ? `${step.label} · nearest to the original` : step.label;
	}

	function swapTo(id: Parameters<NonNullable<typeof card>['swap']>[1]): void {
		swapOpen = false;
		if (openPart !== null) void card?.swap(openPart.target, id);
	}

	function toggleFavourite(): void {
		if (view?.kind === 'finish') card?.toggleFavourite(view.finishKey);
		revision += 1;
	}
</script>

{#if card !== null && parts.length > 0}
	<!-- The Esc ladder listens where the Card's controls are; it is not a control itself. -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<section class="finish-card" aria-label="Finish" data-finish-card onkeydown={onKeydown}>
		{#if openPart === null}
			<div class="parts" role="group" aria-label={`${subjectLabel} surfaces`}>
				{#each rows as row (finishCardTargetKey(row.part.target))}
					<button
						type="button"
						class="part"
						data-finish-part={finishCardTargetKey(row.part.target)}
						onclick={() => open(row.part)}
					>
						{#if row.view?.kind === 'finish'}
							<FinishTile source={row.view.tile.source} color={row.view.tile.color} size={28} />
						{:else}
							<span class="tile-empty" aria-hidden="true"></span>
						{/if}
						<span class="part-text">
							<span class="part-name">{row.part.label}</span>
							<span class="part-finish">
								{row.view?.kind === 'finish' ? row.view.name : row.view?.kind === 'model-own' ? "Model's own" : 'No Finish yet'}
							</span>
						</span>
						<span class="go" aria-hidden="true">›</span>
					</button>
				{/each}
			</div>
		{:else if view === null}
			<!-- The subject cannot carry a Finish (a light, Artwork). -->
		{:else}
			<div class="head">
				{#if parts.length > 1}
					<button type="button" class="back" aria-label={`Back to ${subjectLabel}`} title={`Back to ${subjectLabel}`} data-finish-back onclick={back}>‹</button>
				{/if}
				{#if view.kind === 'finish'}
					<FinishTile source={view.tile.source} color={view.tile.color} size={32} label={view.name} />
					{#if renaming}
						<!-- svelte-ignore a11y_autofocus -->
						<input
							class="rename"
							aria-label="Finish name"
							maxlength="120"
							autofocus
							bind:value={renameDraft}
							data-finish-rename
							onkeydown={(event) => {
								if (event.key === 'Enter') void commitRename();
								if (event.key === 'Escape') {
									event.stopPropagation();
									renaming = false;
								}
							}}
							onblur={() => void commitRename()}
						/>
					{:else}
						{#if view.canRename}
							<button type="button" class="name editable" title={view.renameTitle} data-finish-name onclick={startRename}>{view.name}</button>
						{:else}
							<span class="name" title={view.renameTitle} data-finish-name>{view.name}</span>
						{/if}
					{/if}
				{:else}
					<span class="tile-empty" aria-hidden="true"></span>
					<span class="name">{openPart.label || 'Finish'}</span>
				{/if}
			</div>

			{#if view.kind !== 'finish'}
				<p class="note" data-finish-card-note>{view.message}</p>
			{:else}
				<p class="meta">{view.meta}</p>
				<div class="reach" data-finish-reach={view.reach.choice}>
					<span class="reach-line">{view.reach.line}</span>
					{#if view.reach.options !== null}
						<span class="seg" role="group" aria-label="Reach">
							<button
								type="button"
								aria-pressed={view.reach.choice === 'this'}
								title="Only this one; it gets its own copy on the first change"
								data-finish-reach-this
								onclick={() => card.setReach(openPart.target, 'this')}
							>{view.reach.options.thisLabel}</button>
							<button
								type="button"
								aria-pressed={view.reach.choice === 'all'}
								title={view.reach.options.allTitle}
								data-finish-reach-all
								onclick={() => card.setReach(openPart.target, 'all')}
							>{view.reach.options.allLabel}</button>
						</span>
					{/if}
					{#if view.reach.keepNote !== null}<span class="note-sm">{view.reach.keepNote}</span>{/if}
				</div>
				{#if refusal !== null}<p class="refusal" role="alert" data-finish-refusal>{refusal}</p>{/if}

				<div class="row">
					<span class="label">Material</span>
					<div class="value">
						<span class="material">{view.material.label}</span>
						<button
							type="button"
							class="link push"
							title="Choose another material — keeps this colour and sheen"
							aria-expanded={swapOpen}
							data-finish-swap
							onclick={() => (swapOpen = !swapOpen)}
						>Swap ›</button>
					</div>
				</div>
				{#if swapOpen}
					<FinishSwapPicker current={view.material.catalogueId} onChoose={swapTo} onClose={() => (swapOpen = false)} />
				{/if}

				<div class="row">
					<span class="label">Colour</span>
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
						<label
							class="chip add"
							class:lit={view.colour.custom}
							style={view.colour.custom ? `--chip: ${view.colour.hex}` : undefined}
							title={view.colour.custom ? `${view.colour.hex} · not linked to the palette` : 'Any colour'}
						>
							{#if !view.colour.custom}<span aria-hidden="true">+</span>{/if}
							<input
								type="color"
								aria-label="Any colour"
								data-finish-colour-any
								value={view.colour.hex ?? '#9aa58c'}
								oninput={(event) => previewHex(event.currentTarget.value)}
								onchange={(event) => commitHex(event.currentTarget.value)}
								onblur={() => card.cancel()}
							/>
						</label>
					</div>
				</div>

				<div class="row">
					<span class="label">Sheen</span>
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
						<span class="label">Pattern</span>
						<div class="value">
							<span class="caption pattern">{view.pattern.caption}</span>
							<span class="push steps">
								<button type="button" class="step" aria-label="Smaller pattern" title="Smaller pattern (½×)" disabled={!view.pattern.canSmaller} data-finish-pattern-smaller onclick={() => void card.stepPattern(openPart.target, -1)}>−</button>
								<button type="button" class="step" aria-label="Larger pattern" title="Larger pattern (2×)" disabled={!view.pattern.canLarger} data-finish-pattern-larger onclick={() => void card.stepPattern(openPart.target, 1)}>+</button>
								<button type="button" class="step wide" aria-label="Turn the pattern 90 degrees" title="Turn the pattern 90°" data-finish-pattern-turn onclick={() => void card.turnPattern(openPart.target)}>↻ 90°</button>
							</span>
						</div>
					</div>
				{/if}

				<button type="button" class="disclosure" aria-expanded={moreOpen} data-finish-more onclick={() => card.setMoreOpen(moreOpen ? null : openKey)}>
					<span aria-hidden="true">{moreOpen ? '▾' : '▸'}</span> More
				</button>
				{#if moreOpen}
					<div class="more">
						<label class="field">
							<span>Roughness</span>
							<input
								type="range"
								min="0"
								max={view.more.roughnessMax}
								step="0.01"
								value={view.more.roughness}
								data-finish-roughness
								oninput={(event) => card.previewRoughness(openPart.target, Number(event.currentTarget.value))}
								onchange={(event) => void card.setRoughness(openPart.target, Number(event.currentTarget.value))}
								onpointercancel={(event) => cancelRoughness(event.currentTarget)}
								onblur={(event) => cancelRoughness(event.currentTarget)}
								onkeydown={(event) => {
									// The Card's Esc ladder cancels the gesture; this only resets the thumb.
									if (event.key === 'Escape') restoreRoughness(event.currentTarget);
								}}
							/>
							<span class="num">{view.more.roughness.toFixed(2)}</span>
						</label>
						<label class="field">
							<span>Metal</span>
							<input type="checkbox" checked={view.more.metal} data-finish-metal onchange={(event) => void card.setMetal(openPart.target, event.currentTarget.checked)} />
						</label>
						{#if view.more.tileMeters !== null}
							<label class="field">
								<span>Tile size</span>
								<input
									type="number"
									min="0.01"
									step="0.05"
									value={Number(view.more.tileMeters.toFixed(3))}
									data-finish-tile-size
									onchange={(event) => void card.setTileSize(openPart.target, Number(event.currentTarget.value))}
								/>
								<span class="num">m</span>
							</label>
						{/if}
						{#if view.more.degrees !== null}
							<label class="field">
								<span>Direction</span>
								<input
									type="number"
									step="1"
									value={view.more.degrees}
									data-finish-direction
									onchange={(event) => void card.setDirection(openPart.target, Number(event.currentTarget.value))}
								/>
								<span class="num">°</span>
							</label>
						{/if}
						{#if view.more.canReplaceImage}
							<div class="field">
								<span>Image</span>
								<button type="button" class="link" data-finish-image-replace onclick={() => imageInput?.click()}>Replace…</button>
								<input
									bind:this={imageInput}
									type="file"
									accept="image/png,image/jpeg,image/webp"
									hidden
									onchange={(event) => {
										const file = event.currentTarget.files?.[0] ?? null;
										event.currentTarget.value = '';
										if (file !== null) void card.replaceImage(openPart.target, file);
									}}
								/>
							</div>
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
									disabled={view.resetCount === 0}
									title={view.resetCount === 0 ? 'Nothing changed from the material' : undefined}
									data-finish-reset
									onclick={() => {
										menuOpen = false;
										void card.resetToOriginal(openPart.target);
									}}
								>{view.resetCount > 0 ? `Reset to original (${view.resetCount})` : 'Reset to original'}</button>
							</div>
						{/if}
					</span>
				</div>
			{/if}
		{/if}
	</section>
{/if}

<style>
	.finish-card {
		display: grid;
		gap: 0.4rem;
		padding: 0.35rem 0;
		border-top: 1px solid var(--shell-hairline);
	}
	.parts {
		display: grid;
		gap: 0.2rem;
	}
	.part {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.5rem;
		padding: 0.2rem 0.25rem;
		border: 1px solid transparent;
		border-radius: 0.3rem;
		background: transparent;
		color: inherit;
		text-align: left;
	}
	.part:hover,
	.part:focus-visible {
		border-color: var(--shell-hairline);
	}
	.part-text {
		display: grid;
		flex: 1;
	}
	.part-name {
		font-weight: 600;
	}
	.part-finish {
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-utility);
	}
	.go {
		color: var(--shell-ink-quiet);
	}
	.tile-empty {
		width: 28px;
		height: 28px;
		border: 1px dashed var(--shell-hairline);
		border-radius: 0.25rem;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
	.back {
		min-width: var(--shell-control-height);
		min-height: var(--shell-control-height);
		border: 0;
		background: transparent;
		color: inherit;
		font-size: 1.1rem;
	}
	.name {
		flex: 1;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.name.editable {
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-weight: 600;
		text-align: left;
		cursor: text;
	}
	.rename {
		flex: 1;
		min-height: var(--shell-control-height);
		padding: 0 0.35rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.25rem;
		background: transparent;
		color: inherit;
		font: inherit;
	}
	.meta,
	.note,
	.note-sm {
		margin: 0;
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-utility);
	}
	.reach {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
	}
	.reach .seg {
		margin-left: auto;
	}
	.reach .note-sm {
		flex-basis: 100%;
	}
	.refusal {
		margin: 0;
		color: var(--shell-refuse);
		font-size: var(--shell-text-utility);
	}
	.row {
		display: grid;
		gap: 0.25rem;
	}
	.label {
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-utility);
	}
	.value {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
	}
	.push {
		margin-left: auto;
	}
	.caption {
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-utility);
	}
	.seg {
		display: inline-flex;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.3rem;
		overflow: hidden;
	}
	.seg button {
		position: relative;
		min-height: var(--shell-control-height);
		padding: 0 0.5rem;
		border: 0;
		border-right: 1px solid var(--shell-hairline);
		background: transparent;
		color: inherit;
		font-size: var(--shell-text-utility);
	}
	.seg button:last-child {
		border-right: 0;
	}
	/* A light surface: the Paint tray's pressed segment, not the dark toolbar's. */
	.seg button[aria-pressed='true'] {
		background: var(--shell-forest);
		color: var(--shell-white);
	}
	.seg button:disabled {
		opacity: 0.45;
	}
	.dot {
		display: inline-block;
		width: 0.3rem;
		height: 0.3rem;
		margin-left: 0.25rem;
		border-radius: 50%;
		background: currentColor;
		vertical-align: middle;
	}
	.link {
		min-height: var(--shell-control-height);
		padding: 0 0.25rem;
		border: 0;
		background: transparent;
		color: inherit;
		font-size: var(--shell-text-utility);
		text-decoration: underline;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.chip {
		position: relative;
		display: inline-grid;
		place-items: center;
		width: 1.6rem;
		height: 1.6rem;
		padding: 0;
		border: 1px solid rgb(0 0 0 / 25%);
		border-radius: 50%;
		background: var(--chip, transparent);
		color: var(--shell-ink-quiet);
		cursor: pointer;
	}
	.chip[aria-pressed='true'],
	.chip.lit {
		outline: 2px solid var(--shell-ink);
		outline-offset: 1px;
	}
	.chip.add {
		border-style: dashed;
	}
	.chip input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
	}
	.steps {
		display: inline-flex;
		gap: 0.25rem;
	}
	.step {
		min-width: var(--shell-control-height);
		min-height: var(--shell-control-height);
		border: 1px solid var(--shell-hairline);
		border-radius: 0.25rem;
		background: transparent;
		color: inherit;
	}
	.step.wide {
		padding: 0 0.4rem;
		font-size: var(--shell-text-utility);
	}
	.step:disabled {
		opacity: 0.45;
	}
	.disclosure {
		justify-self: start;
		min-height: var(--shell-control-height);
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font-size: var(--shell-text-utility);
	}
	.more {
		display: grid;
		gap: 0.3rem;
	}
	.field {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: var(--shell-text-utility);
	}
	.field > span:first-child {
		width: 4.5rem;
		color: var(--shell-ink-quiet);
	}
	.field input[type='range'] {
		flex: 1;
	}
	.field input[type='number'] {
		width: 5rem;
		min-height: var(--shell-control-height);
		padding: 0 0.3rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.25rem;
		background: transparent;
		color: inherit;
	}
	.num {
		font-family: var(--shell-mono);
	}
	.foot {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding-top: 0.25rem;
		border-top: 1px solid var(--shell-hairline);
	}
	.foot button {
		min-width: var(--shell-control-height);
		min-height: var(--shell-control-height);
		border: 1px solid var(--shell-hairline);
		border-radius: 0.25rem;
		background: transparent;
		color: inherit;
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
		justify-content: start;
		border: 0;
		text-align: left;
		padding: 0 0.5rem;
	}
	.menu button:disabled {
		opacity: 0.45;
	}
	@media (pointer: coarse) {
		.seg button,
		.step,
		.foot button,
		.back,
		.link {
			min-height: var(--shell-touch-target);
		}
		.chip {
			width: var(--shell-touch-target);
			height: var(--shell-touch-target);
		}
	}
</style>
