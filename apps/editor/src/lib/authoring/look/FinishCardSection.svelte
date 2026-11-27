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
	 * The Card's Finish section: the quick Finish.
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
	import FinishCardRows from './FinishCardRows.svelte';
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
		if (event.key !== 'Escape' || services.finishCard?.current?.align.active) return;
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
	 * Swap… opens the shared Library on Materials with this target and reach.
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

				<FinishCardRows
					{view}
					bind:swapOpen
					bind:colourOpen
					bind:colourSwatch
					bind:alignRefusal
					bind:menuOpen
					bind:editMaterialButton
					{openSwap}
					{swapTo}
					{chooseMode}
					{chooseSlot}
					{closeColour}
					{previewHex}
					{useColour}
					{chooseSheen}
					{sheenTitle}
					{triggerAlign}
					{toggleFavourite}
					{startRename}
					{openEditor}
					onSelectAll={() => void card.selectAllUsers(openPart.target)}
					onGiveOwnCopy={() => void card.giveOwnCopy(openPart.target)}
					onReset={() => void card.resetToOriginal(openPart.target)}
					onStepPattern={(delta) => void card.stepPattern(openPart.target, delta)}
					onTurnPattern={() => void card.turnPattern(openPart.target)}
				/>

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
	/* tokens.css.card.ch: ‹ back 24 × 32, 32 px tile, the name at 15 / 650. */
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
	.row-icon {
		flex: 0 0 auto;
		color: var(--shell-ink-2);
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
		.back {
			min-height: var(--shell-touch-target);
		}
	}
</style>
