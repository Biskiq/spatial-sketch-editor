<script lang="ts">
	/**
	 * The Card's writer for a selected Presentation (R217.S25, Round 2 density). Its body is a
	 * snapshot grid of the Presentation's Views: a tile selects that View (the one Card selection,
	 * D10), and the ◆ and the tour dot are informational only, since the Default changes on the
	 * View Card (D12). *Visitors reach it* names the Stops that show its Views. While the first
	 * Guide is awaiting its name (D8) the name is asked inline here. Add to Guide is the visible
	 * action under the Card name; the Information text is committed on blur. It edits through the Experience controller; its
	 * own state is the Views filter, the text draft and the first-Guide name.
	 */
	import { untrack, type Snippet } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import ShellIcon from '$lib/authoring/stage/shell/ShellIcon.svelte';
	import ExperienceSnapshot from './ExperienceSnapshot.svelte';
	import { experienceHomes } from './experience-homes';
	import type { ExperienceViewChoice } from './experience-controller.svelte';

	let {
		footer,
		secondary,
		more
	}: {
		services?: StageAdapterServices;
		detailOpen?: boolean;
		footer?: Snippet;
		secondary?: Snippet<[Snippet?]>;
		more?: Snippet<[Snippet?]>;
	} = $props();

	/** Past this many Views the grid offers a filter and the tour chips. */
	const FILTER_THRESHOLD = 12;
	/** Past this many Views the grid is three columns instead of two. */
	const THREE_COLUMN_THRESHOLD = 8;

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const presentation = $derived(controller?.selectedPresentation ?? null);
	const views = $derived<readonly ExperienceViewChoice[]>(
		presentation === null ? [] : (controller?.viewsOf.get(presentation.id) ?? [])
	);
	const selectedViewId = $derived(controller?.selectedView?.id ?? null);

	/** The Stops that enter at each View of this Presentation, in the active Guide. */
	const stopsByView = $derived(
		new Map(views.map((view) => [view.id, controller?.viewStops(view.id) ?? []] as const))
	);
	function onTour(viewId: string): boolean {
		return (stopsByView.get(viewId)?.length ?? 0) > 0;
	}
	/** Every Stop that shows one of this Presentation's Views, once each, in Guide order. */
	const tourStops = $derived.by(() => {
		const positions = new Map<string, number>();
		for (const stops of stopsByView.values()) {
			for (const stop of stops) positions.set(stop.stopId, stop.position);
		}
		return [...positions]
			.map(([stopId, position]) => ({ stopId, position }))
			.sort((left, right) => left.position - right.position);
	});

	/** Local filter for a long grid: a name search and the two tour chips (both on shows both). */
	let filterText = $state('');
	let onTourChip = $state(false);
	let freeChip = $state(false);
	const filterVisible = $derived(views.length > FILTER_THRESHOLD);
	const columns = $derived(views.length > THREE_COLUMN_THRESHOLD ? 3 : 2);
	const shownViews = $derived.by(() => {
		if (!filterVisible) return views;
		const needle = filterText.trim().toLowerCase();
		return views.filter((view) => {
			if (needle !== '' && !view.label.toLowerCase().includes(needle)) return false;
			if (!onTourChip && !freeChip) return true;
			return (onTourChip && onTour(view.id)) || (freeChip && !onTour(view.id));
		});
	});
	$effect(() => {
		void presentation?.id;
		untrack(() => {
			filterText = '';
			onTourChip = false;
			freeChip = false;
		});
	});

	/** The Information text draft; committed on blur only when it differs from the stored text. */
	let textDraft = $state('');
	$effect(() => {
		void presentation?.id;
		untrack(() => {
			textDraft = presentation?.text?.body ?? '';
		});
	});
	async function commitText(): Promise<void> {
		if (controller === null || presentation === null) return;
		if (textDraft === (presentation.text?.body ?? '')) return;
		await controller.updatePresentationText(presentation.id, textDraft);
	}

	/** D8: the first Guide's name, asked inline once the Presentation's Add to Guide asked for one. */
	const namingHere = $derived(presentation !== null && homes.guideNamePrompt() === presentation.id);
	let guideName = $state('');
	$effect(() => {
		if (!namingHere) return;
		untrack(() => {
			guideName = '';
		});
	});
	const guideNameTrimmed = $derived(guideName.trim());
	const createReason = $derived(
		controller?.busy ? 'Wait for the current change' : guideNameTrimmed === '' ? 'Enter a name for the Guide' : ''
	);
	async function createGuide(): Promise<void> {
		if (controller === null || presentation === null || createReason !== '') return;
		const accepted = await controller.addStop(presentation.id, { firstGuideLabel: guideNameTrimmed });
		if (accepted) homes.requestGuideName(null);
	}
	function cancelGuideName(): void {
		homes.requestGuideName(null);
	}
	function focusOnMount(node: HTMLInputElement): void {
		node.focus();
	}

	/** D8: the first Guide asks its name inline; otherwise the Presentation becomes a Stop. */
	const addReason = $derived(controller?.busy ? 'Wait for the current change' : '');
	function addToGuide(): void {
		if (controller === null || presentation === null || addReason !== '') return;
		if (controller.guides.length === 0) homes.requestGuideName(presentation.id);
		else void controller.addStop(presentation.id);
	}

	function selectView(viewId: string): void {
		if (presentation === null) return;
		homes.select({ kind: 'view', viewId, presentationId: presentation.id });
	}
	function selectStop(stopId: string): void {
		homes.select({ kind: 'stop', stopId });
	}
	function tileLabel(view: ExperienceViewChoice): string {
		const parts = [view.label];
		if (presentation?.defaultViewId === view.id) parts.push('Default View');
		parts.push(onTour(view.id) ? 'on the tour' : 'not on the tour');
		return parts.join(', ');
	}
</script>

{#if controller !== null && presentation !== null}
	<div class="writer" data-experience-writer="presentation">
		<div class="c-actions">
			<button
				type="button"
				class="btn"
				disabled={addReason !== ''}
				title={addReason || 'Add this Presentation to the Guide as a Stop'}
				aria-describedby={addReason !== '' ? 'add-guide-reason' : undefined}
				onclick={addToGuide}
			>
				<ShellIcon name="plus" size={13} />Add to Guide
			</button>
			{#if addReason !== ''}<span id="add-guide-reason" class="sr">{addReason}</span>{/if}
		</div>

		{#if namingHere}
			<section class="sec" aria-label="Name the new Guide">
				<h3 class="sec-title">Name the new Guide</h3>
				<input
					class="text-input"
					type="text"
					aria-label="Guide name"
					placeholder="Guide name"
					bind:value={guideName}
					use:focusOnMount
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							void createGuide();
						} else if (event.key === 'Escape') {
							event.preventDefault();
							event.stopPropagation();
							cancelGuideName();
						}
					}}
				/>
				<div class="row-actions">
					<button
						type="button"
						class="btn primary"
						disabled={createReason !== ''}
						title={createReason || 'Create the first Guide with this Presentation as its first Stop'}
						aria-describedby={createReason !== '' ? 'guide-name-reason' : undefined}
						onclick={() => void createGuide()}>Create Guide</button
					>
					<button type="button" class="btn ghost" onclick={cancelGuideName}>Cancel</button>
				</div>
				{#if createReason !== ''}<span id="guide-name-reason" class="sr">{createReason}</span>{/if}
				{#if controller.message}<p class="note" role="status">{controller.message}</p>{/if}
			</section>
		{/if}

		<section class="sec" aria-label="Views">
			<h3 class="sec-title">Views <span class="n">{views.length}</span></h3>
			{#if filterVisible}
				<div class="filter">
					<input
						class="text-input"
						type="search"
						aria-label="Filter Views"
						placeholder="Filter Views"
						bind:value={filterText}
						onkeydown={(event) => {
							if (event.key === 'Escape' && filterText !== '') {
								event.preventDefault();
								event.stopPropagation();
								filterText = '';
							}
						}}
					/>
					<div class="chips" role="group" aria-label="Show Views">
						<button
							type="button"
							class="chip"
							aria-pressed={onTourChip}
							onclick={() => (onTourChip = !onTourChip)}>On tour</button
						>
						<button type="button" class="chip" aria-pressed={freeChip} onclick={() => (freeChip = !freeChip)}
							>Free</button
						>
					</div>
				</div>
			{/if}
			{#if views.length === 0}
				<p class="empty">No Views yet. Capture in the dock adds the first.</p>
			{:else if shownViews.length === 0}
				<p class="empty">No View matches.</p>
			{:else}
				<div class="vgrid" class:three={columns === 3} data-view-grid>
					{#each shownViews as view (view.id)}
						<button
							type="button"
							class="vtile"
							class:selected={selectedViewId === view.id}
							aria-label={tileLabel(view)}
							aria-current={selectedViewId === view.id ? 'true' : undefined}
							data-view-tile={view.id}
							onclick={() => selectView(view.id)}
						>
							<span class="vt-img">
								<ExperienceSnapshot label={view.label} selected={selectedViewId === view.id} />
								{#if presentation.defaultViewId === view.id}
									<span class="badge-def" aria-hidden="true">◆ Default</span>
								{/if}
							</span>
							<span class="vt-name">
								<span class="vt-text">{view.label}</span>
								<span class="tour" class:on={onTour(view.id)} aria-hidden="true"></span>
							</span>
						</button>
					{/each}
				</div>
			{/if}
			<p class="foot-note">Capture in the dock records exactly what the Stage camera sees.</p>
		</section>

		<section class="sec" aria-label="Visitors reach it">
			<h3 class="sec-title">Visitors reach it</h3>
			<div class="reach-row">
				<span class="reach-ico"><ShellIcon name="guide" size={14} /></span>
				{#if tourStops.length > 0}
					<span class="reach-label">On the tour at</span>
					{#each tourStops.slice(0, 3) as stop (stop.stopId)}
						<button type="button" class="chip mono" onclick={() => selectStop(stop.stopId)}>Stop {stop.position}</button>
					{/each}
					{#if tourStops.length > 3}
						<span class="more-count">+{tourStops.length - 3}</span>
					{/if}
				{:else}
					<span class="reach-label">Not on the tour</span>
				{/if}
			</div>
			{#if tourStops.length > 3}
				<div class="chips">
					{#each tourStops.slice(3) as stop (stop.stopId)}
						<button type="button" class="chip mono" onclick={() => selectStop(stop.stopId)}>Stop {stop.position}</button>
					{/each}
				</div>
			{/if}
		</section>

		<section class="sec quiet-sec" aria-label="Information text">
			<label class="field">
				<span class="sec-title">Information text</span>
				<textarea
					rows="2"
					maxlength="4000"
					bind:value={textDraft}
					disabled={controller.busy}
					onblur={() => void commitText()}
				></textarea>
			</label>
		</section>

		{#if footer}{@render footer()}{/if}
		{#if more}{@render more()}{/if}
		{#if secondary}{@render secondary()}{/if}
	</div>
{/if}

<style>
	.writer {
		display: flex;
		flex-direction: column;
		font-size: 12px;
	}
	.c-actions {
		display: flex;
		gap: 6px;
		padding: 8px 12px;
	}
	.sec {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px 12px;
		border-top: 1px solid var(--shell-hairline, #e1e4de);
	}
	.sec-title {
		display: flex;
		align-items: baseline;
		gap: 5px;
		margin: 0;
		color: var(--shell-ink-3, #79817b);
		font: 600 11px/1.3 var(--shell-sans, system-ui);
	}
	.n {
		font: 400 10.5px var(--shell-mono, ui-monospace, monospace);
	}
	.empty,
	.note {
		margin: 0;
		color: var(--shell-ink-2, #4a524c);
		font-size: 12px;
	}
	.note {
		color: var(--shell-refuse, #7e2718);
	}
	.foot-note {
		margin: 0;
		color: var(--shell-ink-3, #79817b);
		font-size: 10.5px;
		line-height: 1.4;
	}
	.filter,
	.row-actions,
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.text-input,
	textarea {
		box-sizing: border-box;
		width: 100%;
		min-height: 26px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 6px;
		background: var(--shell-card, #fff);
		color: var(--shell-ink, #1b201c);
		font: inherit;
		font-size: 12px;
		padding: 3px 6px;
	}
	textarea {
		resize: vertical;
	}

	.vgrid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px 6px;
	}
	.vgrid.three {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.vtile {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.vt-img {
		position: relative;
		display: block;
	}
	.badge-def {
		position: absolute;
		left: 4px;
		top: 4px;
		padding: 1px 5px;
		border-radius: 999px;
		background: var(--shell-forest-raised, #22503c);
		color: #fff;
		font: 600 9.5px/1.4 var(--shell-sans, system-ui);
		pointer-events: none;
	}
	.vt-name {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		color: var(--shell-ink, #1b201c);
		font: 12px/1.3 var(--shell-serif, Georgia, serif);
	}
	.vt-text {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tour {
		flex: none;
		width: 7px;
		height: 7px;
		box-sizing: border-box;
		border: 1.5px solid var(--shell-ink-3, #79817b);
		border-radius: 50%;
	}
	.tour.on {
		border-color: var(--shell-forest-raised, #22503c);
		background: var(--shell-forest-raised, #22503c);
	}

	.reach-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
	}
	.reach-ico {
		display: inline-flex;
		color: var(--shell-ink-3, #79817b);
	}
	.reach-label {
		color: var(--shell-ink-2, #4a524c);
	}
	.more-count {
		color: var(--shell-ink-3, #79817b);
		font: 10.5px var(--shell-mono, ui-monospace, monospace);
	}
	.quiet-sec {
		padding-top: 6px;
	}

	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		min-height: 24px;
		padding: 0 8px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 6px;
		background: var(--shell-card, #fff);
		color: var(--shell-ink, #1b201c);
		font: inherit;
		font-size: 11.5px;
		cursor: pointer;
	}
	button:hover {
		background: var(--shell-hover, #eef0ed);
	}
	button.btn {
		min-height: 28px;
		padding: 0 11px;
		font-weight: 600;
	}
	button.btn.primary {
		border-color: var(--shell-forest-raised, #22503c);
		background: var(--shell-forest-raised, #22503c);
		color: #fff;
	}
	button.btn.ghost {
		border-color: transparent;
		background: transparent;
	}
	button.vtile {
		display: flex;
		align-items: stretch;
		justify-content: flex-start;
		min-height: 0;
		padding: 0;
		border: 0;
		background: none;
	}
	button.chip {
		min-height: 20px;
		padding: 0 7px;
		border-radius: 999px;
		font-size: 11px;
	}
	button.chip[aria-pressed='true'] {
		border-color: var(--shell-forest-raised, #22503c);
		background: var(--shell-forest-raised, #22503c);
		color: #fff;
	}
	button.mono {
		font-family: var(--shell-mono, ui-monospace, monospace);
	}
	button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	@media (pointer: coarse) {
		button,
		.text-input {
			min-height: 44px;
		}
		button.vtile {
			min-height: 0;
		}
		button.chip {
			min-height: 36px;
		}
	}
</style>
