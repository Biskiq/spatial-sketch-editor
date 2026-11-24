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
	import StagePaintWheel from '$lib/authoring/stage/shell/StagePaintWheel.svelte';
	import type { PaintColour } from './paint-pick';
	import type { AppearanceIssue, AppearanceIssueActionKind } from './appearance-issues.svelte';

	let {
		services,
		parts,
		subjectLabel,
		onAlign
	}: {
		services: StageAdapterServices;
		parts: readonly FinishCardPart[];
		/** The subject's name, for Back's title. */
		subjectLabel: string;
		/** Request Align on a wall side or room floor (Step 5). */
		onAlign?: (target: FinishCardTarget) => void;
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
	/** The Any colour picker: Paint's radial presentation, beside the Card. */
	let colourOpen = $state(false);
	let colourSwatch = $state<HTMLButtonElement>();
	let renaming = $state(false);
	let renameDraft = $state('');
	let menuOpen = $state(false);
	let editMaterialButton = $state<HTMLButtonElement>();
	let alignRefusal = $state<string | null>(null);
	let lastPartsKey = '';

	$effect(() => services.stage.onAdaptersChanged(() => (revision += 1)));

	const card = $derived(services.finishCard?.current?.card ?? null);
	const editor = $derived(services.finishCard?.current?.editor ?? null);
	const issues = $derived(services.finishCard?.current?.issues ?? null);
	const partsKey = $derived(parts.map((part) => finishCardTargetKey(part.target)).join('|'));

	let repairFileInput = $state<HTMLInputElement>();
	let pendingFileAction = $state<{
		readonly issue: AppearanceIssue;
		readonly kind: 'relink' | 'replace';
		readonly target: FinishCardTarget;
	} | null>(null);

	function triggerIssueAction(issue: AppearanceIssue, kind: AppearanceIssueActionKind, target: FinishCardTarget): void {
		if (kind === 'relink' || kind === 'replace') {
			pendingFileAction = { issue, kind, target };
			if (repairFileInput !== undefined) {
				repairFileInput.value = '';
				repairFileInput.click();
			}
			return;
		}
		void services.finishCard?.current?.runIssueAction(issue, kind, target);
	}

	async function onRepairFileChosen(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		const pending = pendingFileAction;
		pendingFileAction = null;
		if (file === undefined || pending === null) return;
		await services.finishCard?.current?.runIssueAction(pending.issue, pending.kind, pending.target, file);
		revision += 1;
	}

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
		colourOpen = false;
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
		alignRefusal = null;
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

	function openEditor(): void {
		if (openPart === null || editor === null) return;
		editor.openFor(openPart.target, openPart.place, editMaterialButton ?? null);
	}

	function triggerAlign(event?: MouseEvent): void {
		if (openPart === null) return;
		alignRefusal = null;
		if (onAlign) {
			onAlign(openPart.target);
			return;
		}
		const authoring = services.finishCard?.current ?? null;
		if (authoring === null) return;
		const res = authoring.requestAlign(openPart.target, openPart.place, (event?.currentTarget as HTMLElement | null) ?? null);
		if (!res.ok && res.message) {
			alignRefusal = res.message;
		}
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

	/** Done or a linked palette chip writes once (one Undo); Escape and × only drop the preview. */
	function useColour(colour: PaintColour): void {
		if (colour.kind === 'slot') chooseSlot(colour.slotId);
		else commitHex(colour.hex);
		closeColour(false);
	}

	function closeColour(discard = true): void {
		if (discard) card?.cancel();
		colourOpen = false;
		colourSwatch?.focus();
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

	/**
	 * Swap… opens the shared Library on Materials with this target and reach (U5).
	 * Without a route Library (a harness) the inline picker stays the fallback.
	 */
	function openSwap(): void {
		const authoring = services.finishCard?.current ?? null;
		if (authoring !== null && openPart !== null && authoring.requestLibrarySwap(openPart.target, openPart.place)) {
			swapOpen = false;
			return;
		}
		swapOpen = !swapOpen;
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
	<section class="finish-card" class:open={openPart !== null && view !== null} aria-label="Finish" data-finish-card onkeydown={onKeydown}>
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
							{#if issues?.hasIssuesForTarget(finishCardTargetKey(row.part.target))}
								<span class="part-repair" data-part-needs-repair>Needs repair</span>
							{/if}
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
					<span class="row-icon" aria-hidden="true">
						{#if view.reach.shared}
							<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="5.5" cy="8" r="3.5"/><circle cx="10.5" cy="8" r="3.5"/></svg>
						{:else}
							<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="4"/></svg>
						{/if}
					</span>
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

				{@const targetIssues = openPart === null || issues === null ? [] : issues.issuesForTarget(finishCardTargetKey(openPart.target))}
				{#each targetIssues as issue (issue.id)}
					<div class="diag" role="alert" data-finish-diag={issue.code}>
						<b class="diag-title">
							<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
								<path d="M8 2.2 14.2 13.4H1.8Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
								<path d="M8 6.4v3.3M8 11.4v.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
							</svg>
							{issue.title}
						</b>
						<div class="diag-text">{issue.text}</div>
						{#if issue.file}
							<div class="diag-file">{issue.file}</div>
						{/if}
						<div class="diag-acts">
							{#each issue.actions as action (action.kind)}
								<button
									type="button"
									class="diag-btn"
									class:pri={action.primary}
									data-diag-action={action.kind}
									onclick={() => triggerIssueAction(issue, action.kind, openPart.target)}
								>
									{action.label}
								</button>
							{/each}
						</div>
						{#if issues?.refusalFor(issue.id)}
							<div class="diag-refusal" data-diag-refusal>{issues.refusalFor(issue.id)}</div>
						{/if}
						<div class="diag-note">
							Surfaces keep an amber hatch until repaired. Every authored repair is one undo.
						</div>
					</div>
				{/each}
				<input
					bind:this={repairFileInput}
					type="file"
					accept="image/*"
					class="sr-only"
					tabindex="-1"
					onchange={(event) => void onRepairFileChosen(event)}
				/>

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
								<button type="button" class="step" aria-label="Smaller pattern" title="Smaller pattern (½×)" disabled={!view.pattern.canSmaller} data-finish-pattern-smaller onclick={() => void card.stepPattern(openPart.target, -1)}>−</button>
								<button type="button" class="step" aria-label="Larger pattern" title="Larger pattern (2×)" disabled={!view.pattern.canLarger} data-finish-pattern-larger onclick={() => void card.stepPattern(openPart.target, 1)}>+</button>
								<button type="button" class="step wide" aria-label="Turn the pattern 90 degrees" title="Turn the pattern 90°" data-finish-pattern-turn onclick={() => void card.turnPattern(openPart.target)}>↻ 90°</button>
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
					<button
						type="button"
						class="foot-text"
						disabled
						title="Saving a private copy arrives with My library (U7)."
						data-finish-save-library
					>Save to My library</button>
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
										void card.selectAllUsers(openPart.target);
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
										void card.giveOwnCopy(openPart.target);
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
										void card.resetToOriginal(openPart.target);
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
			{/if}
		{/if}
	</section>
{/if}

<style>
	.finish-card {
		container: finish-card / inline-size;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		min-width: 0;
		gap: 0.4rem;
		padding: 0.35rem 0;
		border-top: 1px solid var(--shell-hairline);
	}
	/*
		An open Finish reads as the prototype Card body (`ui-card.js`, tokens.css
		.card .body): 12 px inline inset in every host, rows ruled apart rather
		than gapped, and the foot spanning the Card edge to edge.
	*/
	.finish-card.open {
		gap: 0;
		padding: 0.35rem 12px 0;
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
	/* tokens.css .card .ch: ‹ back 24 × 32, 32 px tile, the name at 15 / 650. */
	.head {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 6px 0 10px;
	}
	.back {
		display: grid;
		place-items: center;
		flex: none;
		width: 24px;
		height: 32px;
		margin-right: -4px;
		padding: 0;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--shell-ink-2);
		font-size: 17px;
		cursor: pointer;
	}
	.back:hover {
		background: var(--shell-hover);
		color: var(--shell-forest);
	}
	.name {
		flex: 1;
		align-self: center;
		font-size: 15px;
		font-weight: 650;
		line-height: 1.25;
		overflow-wrap: anywhere;
	}
	.name.editable {
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 15px;
		font-weight: 650;
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
		font-size: 11.5px;
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-utility);
	}
	.meta {
		margin: 2px 0 6px;
		color: var(--shell-ink-2);
	}
	.reach {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		min-height: 28px;
		padding: 2px 0 6px;
		margin-bottom: 2px;
		font-size: 12px;
	}
	.reach .row-icon {
		display: inline-grid;
	}
	.reach .seg button {
		padding: 1px 8px;
		font-size: 11.5px;
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
	/* tokens.css .card .foot: edge to edge, 6 × 8 padding, plain text buttons. */
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
	}
	.part-repair {
		font-size: 11px;
		font-weight: 500;
		color: var(--shell-caution);
	}
	.diag {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 9px 10px;
		margin: 4px 0 6px;
		border-radius: 8px;
		border: 1px solid color-mix(in srgb, var(--shell-caution) 36%, transparent);
		background: var(--shell-caution-bg);
		color: var(--shell-ink);
		font-size: 12px;
		line-height: 1.4;
	}
	.diag-title {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
		font-weight: 600;
		color: var(--shell-caution);
	}
	.diag-file {
		font-family: var(--shell-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
		font-size: 11px;
		overflow-wrap: anywhere;
		color: var(--shell-ink-2);
	}
	.diag-acts {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-top: 2px;
	}
	.diag-btn {
		padding: 4px 9px;
		border: 1px solid var(--shell-hairline);
		border-radius: 6px;
		background: var(--shell-surface);
		color: var(--shell-ink);
		font: 500 11.5px/1.2 var(--shell-font);
		cursor: pointer;
	}
	.diag-btn.pri {
		border-color: var(--shell-caution);
		background: var(--shell-caution);
		color: #fff;
	}
	.diag-refusal {
		font-size: 11.5px;
		color: var(--shell-danger, #9e2a2b);
	}
	.diag-note {
		font-size: 11px;
		color: var(--shell-caution);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	@media (pointer: coarse) {
		.seg button,
		.foot button,
		.back,
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
