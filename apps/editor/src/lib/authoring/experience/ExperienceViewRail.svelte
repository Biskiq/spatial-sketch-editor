<script lang="ts">
	/**
	 * The Presentation Card's View list is the rail (sheet §32 B, accepted 2026-11-04).
	 *
	 * One 38 px row per View, numbered: View 1 is the Default and opens here. The
	 * connection between neighbours — Cut or Travel with the Camera path's time —
	 * sits on the spine between two rows and is edited right there: one press on
	 * ✂/↗ switches the kind (a new Travel adds a straight path, one Undo); pressing
	 * the time opens a small editor between the rows, and ↑↓ on a focused time
	 * steps it by 0.5 s. A Travel with no path shows ⚠ with its fix. Reorder by
	 * dragging ⠿ or with Alt+↑↓; a View moved to the top becomes the Default.
	 *
	 * Past 10 Views the list folds to the first 8 behind *Show all N Views*, which
	 * names what is hidden; opened, it scrolls in its own box of about 12 rows.
	 * Selecting, editing or moving a View past row 8 opens it. The fold and the
	 * open editor are session state, never saved.
	 */
	import { tick } from 'svelte';
	import type { ExperiencePresentation } from '@portfolio/project-model/units';
	import ExperienceSnapshot from './ExperienceSnapshot.svelte';
	import type { ExperienceController, ExperienceViewChoice } from './experience-controller.svelte';
	import { formatPathSeconds, type ExperiencePathRead } from './experience-paths';

	let {
		controller,
		presentation,
		views,
		selectedViewId,
		onSelect,
		onShapePath
	}: {
		controller: ExperienceController;
		presentation: ExperiencePresentation;
		views: readonly ExperienceViewChoice[];
		selectedViewId: string | null;
		onSelect: (viewId: string) => void;
		onShapePath: (toViewId: string) => void;
	} = $props();

	/** Fold past this many Views … */
	const FOLD_AFTER = 10;
	/** … to the first this many. */
	const FOLD_TO = 8;
	const VIEW_MIME = 'application/x-biskiq-presentation-view';

	let open = $state(false);
	let edit = $state<number | null>(null);
	let draggingViewId = $state<string | null>(null);
	let dropAt = $state<{ readonly index: number; readonly after: boolean } | null>(null);
	let listEl = $state<HTMLOListElement | null>(null);

	$effect(() => {
		void presentation.id;
		open = false;
		edit = null;
	});

	const n = $derived(presentation.views.length);
	const canFold = $derived(n > FOLD_AFTER);
	const selectedIndex = $derived(selectedViewId === null ? -1 : presentation.views.findIndex((view) => view.viewId === selectedViewId));
	// Selecting, editing or moving a View past row 8 opens the list.
	$effect(() => {
		if (!canFold || open) return;
		const deepest = Math.max(selectedIndex, edit ?? -1);
		if (deepest >= FOLD_TO) open = true;
	});
	const shown = $derived(canFold && !open ? FOLD_TO : n);
	const label = (viewId: string) => views.find((view) => view.id === viewId)?.label ?? 'Missing View';

	function pathAt(index: number): ExperiencePathRead | null {
		const view = presentation.views[index];
		if (view === undefined || index === 0) return null;
		return controller.pathFor({ kind: 'step', presentationId: presentation.id, toViewId: view.viewId });
	}
	function kindAt(index: number): 'none' | 'cut' | 'travel' | 'gap' {
		if (index <= 0 || index >= n) return 'none';
		// A-1: the step from View index - 1 to index belongs to the View it leaves.
		const view = presentation.views[index - 1]!;
		if ((view.transition ?? 'cut') === 'cut') return 'cut';
		const path = pathAt(index);
		return path === null || path.state === 'gap' || path.state === 'ambiguous' ? 'gap' : 'travel';
	}
	function secondsAt(index: number): string {
		const path = pathAt(index);
		return path?.state === 'ready' ? formatPathSeconds(path.seconds) : '—';
	}
	function usesAt(index: number): number {
		const path = pathAt(index);
		return path === null ? 1 : path.sharedUses.length + 1;
	}

	/** Stops of the context Guide that enter at this View, marked on its row. */
	const stopMarks = $derived.by(() => {
		const marks = new Map<string, number[]>();
		const guideStops = controller.guideStops;
		guideStops.forEach((stop, index) => {
			if (stop.presentationId !== presentation.id) return;
			const entry = stop.entryViewId ?? presentation.views[0]?.viewId ?? null;
			if (entry === null) return;
			marks.set(entry, [...(marks.get(entry) ?? []), index + 1]);
		});
		return marks;
	});
	function marksOf(viewId: string): string {
		const stops = stopMarks.get(viewId) ?? [];
		return stops.length === 0 ? '' : `Stop ${stops.join(', ')} enters here`;
	}

	const counts = $derived.by(() => {
		let travel = 0;
		let cut = 0;
		let gap = 0;
		for (let index = 1; index < n; index += 1) {
			const kind = kindAt(index);
			if (kind === 'gap') gap += 1;
			else if (kind === 'travel') travel += 1;
			else if (kind === 'cut') cut += 1;
		}
		return { travel, cut, gap };
	});
	const hidden = $derived.by(() => {
		if (!canFold || open) return null;
		let travel = 0;
		let cut = 0;
		let gap = 0;
		const marks: string[] = [];
		for (let index = FOLD_TO; index < n; index += 1) {
			const kind = kindAt(index);
			if (kind === 'gap') gap += 1;
			else if (kind === 'travel') travel += 1;
			else cut += 1;
			const stops = stopMarks.get(presentation.views[index]!.viewId) ?? [];
			for (const stop of stops) marks.push(`Stop ${stop} enters at ${index + 1}`);
		}
		return { more: n - FOLD_TO, travel, cut, gap, marks };
	});

	const busy = $derived(controller.busy);

	function toggleKind(index: number): void {
		if (busy) return;
		const kind = kindAt(index);
		if (kind === 'gap') {
			edit = index;
			return;
		}
		void controller.setPresentationStep(presentation.id, index, kind === 'travel' ? 'cut' : 'travel');
	}
	function setKind(index: number, kind: 'cut' | 'travel'): void {
		if (busy) return;
		void controller.setPresentationStep(presentation.id, index, kind);
	}

	function fixGap(index: number): void {
		// Writing Travel again adds the missing straight path in the same change.
		const view = presentation.views[index];
		if (view === undefined || busy) return;
		void controller.createPath({ kind: 'step', presentationId: presentation.id, toViewId: view.viewId });
	}
	function selectStepPath(index: number): boolean {
		const view = presentation.views[index];
		if (view === undefined) return false;
		controller.selectPath({ kind: 'step', presentationId: presentation.id, toViewId: view.viewId });
		return controller.selectedPath?.state === 'ready';
	}
	function stepTime(index: number, direction: -1 | 1): void {
		if (busy || !selectStepPath(index)) return;
		const path = controller.selectedPath;
		if (path === null || path.seconds === null) return;
		const next = Math.max(0.5, Math.round((path.seconds + direction * 0.5) * 2) / 2);
		void controller.setPathDuration(next);
	}
	function onTimeKey(event: KeyboardEvent, index: number): void {
		if (event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
		event.preventDefault();
		event.stopPropagation();
		stepTime(index, event.key === 'ArrowUp' ? 1 : -1);
	}

	async function refocus(viewId: string): Promise<void> {
		await tick();
		listEl?.querySelector<HTMLElement>(`[data-rail-view="${CSS.escape(viewId)}"]`)?.focus();
	}
	function onRowKey(event: KeyboardEvent, index: number): void {
		if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
		event.preventDefault();
		event.stopPropagation();
		if (busy) return;
		const to = index + (event.key === 'ArrowUp' ? -1 : 1);
		if (to < 0 || to >= n) return;
		const viewId = presentation.views[index]!.viewId;
		edit = null;
		if (to >= FOLD_TO) open = true;
		void controller.movePresentationView(presentation.id, viewId, to).then(() => refocus(viewId));
	}
	function onDragStart(event: DragEvent, viewId: string): void {
		if (busy || event.dataTransfer === null || n < 1) {
			event.preventDefault();
			return;
		}
		draggingViewId = viewId;
		// G23: the Guide reads the View's own Presentation, so a View can become a Stop.
		event.dataTransfer.setData(VIEW_MIME, JSON.stringify({ viewId, presentationId: presentation.id }));
		event.dataTransfer.effectAllowed = 'copyMove';
	}
	function onDragOver(event: DragEvent, index: number): void {
		if (draggingViewId === null) return;
		event.preventDefault();
		const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
		dropAt = { index, after: event.clientY > box.top + box.height / 2 };
	}
	function endDrag(): void {
		draggingViewId = null;
		dropAt = null;
	}
	function onDrop(event: DragEvent): void {
		event.preventDefault();
		const dragged = draggingViewId;
		const at = dropAt;
		endDrag();
		if (dragged === null || at === null || busy) return;
		const from = presentation.views.findIndex((view) => view.viewId === dragged);
		let to = at.index + (at.after ? 1 : 0);
		if (from < to) to -= 1;
		if (from === -1 || from === to) return;
		edit = null;
		void controller.movePresentationView(presentation.id, dragged, to);
	}
	function toggleFold(): void {
		open = !open;
		if (!open) {
			if (edit !== null && edit >= FOLD_TO) edit = null;
		}
	}
</script>

{#snippet chip(index: number)}
	{@const kind = kindAt(index)}
	{@const uses = usesAt(index)}
	<span class="chip {kind}" class:on={edit === index}>
		{#if kind === 'gap'}
			<button type="button" class="kind" aria-label="Travel with no path" title="Travel with no path" disabled={busy} onclick={() => toggleKind(index)}>↗</button>
			<button type="button" class="time warn" aria-label="Fix: no path" title="Travel needs a path: press to fix" onclick={() => (edit = edit === index ? null : index)}>⚠</button>
		{:else if kind === 'travel'}
			<button type="button" class="kind" aria-label="Travel: switch to Cut" title="Travel · press for Cut" disabled={busy} onclick={() => toggleKind(index)}>↗</button>
			<button
				type="button"
				class="time"
				aria-label={`Path time ${secondsAt(index)}: press to edit, or ↑ ↓`}
				title="Press to edit · ↑ ↓ steps 0.5 s"
				data-rail-time={index}
				onclick={() => (edit = edit === index ? null : index)}
				onkeydown={(event) => onTimeKey(event, index)}
			>{secondsAt(index)}{#if uses > 1}<small>×{uses}</small>{/if}</button>
		{:else}
			<button type="button" class="kind" aria-label="Cut: switch to Travel" title="Cut · press for Travel" disabled={busy} onclick={() => toggleKind(index)}>✂</button>
		{/if}
	</span>
{/snippet}

{#snippet editor(index: number)}
	{@const kind = kindAt(index)}
	<li class="editor" role="group" aria-label={`${label(presentation.views[index - 1]!.viewId)} to ${label(presentation.views[index]!.viewId)}`}>
		<div class="ed-card">
		<div class="ed-head">
			<b>{index} → {index + 1} · {label(presentation.views[index - 1]!.viewId)} → {label(presentation.views[index]!.viewId)}</b>
			<button type="button" class="x" aria-label="Close" onclick={() => (edit = null)}>✕</button>
		</div>
		<div class="ed-row">
			<span class="seg" role="group" aria-label="Cut or Travel">
				<button type="button" aria-pressed={kind === 'cut'} disabled={busy} onclick={() => setKind(index, 'cut')}>✂ Cut</button>
				<button type="button" aria-pressed={kind !== 'cut'} disabled={busy} onclick={() => setKind(index, 'travel')}>↗ Travel</button>
			</span>
			{#if kind === 'travel'}
				<!-- A new path keeps its automatic time until the creator steps it; no Auto control (owner review, 6 Nov). -->
				<span class="stepper" role="group" aria-label="Path time">
					<button type="button" aria-label="Shorter" disabled={busy} onclick={() => stepTime(index, -1)}>−</button>
					<b>{secondsAt(index)}</b>
					<button type="button" aria-label="Longer" disabled={busy} onclick={() => stepTime(index, 1)}>+</button>
				</span>
			{/if}
		</div>
		{#if kind === 'gap'}
			<p class="warn-text">
				No path joins these Views.
				<button type="button" class="link" disabled={busy} onclick={() => fixGap(index)}>Add a straight path</button>
				<button type="button" class="link" disabled={busy} onclick={() => setKind(index, 'cut')}>Use Cut</button>
			</p>
		{:else if kind === 'travel'}
			<p class="note">
				{#if usesAt(index) > 1}<b>Same path in {usesAt(index)} places</b>: a change reaches each.{:else}Used only here.{/if}
				<button type="button" class="link" onclick={() => onShapePath(presentation.views[index]!.viewId)}>Shape on the Stage ›</button>
			</p>
		{:else}
			<p class="note">A Cut needs no path and creates none.</p>
		{/if}
		</div>
	</li>
{/snippet}

<div class="rail-host" data-view-rail data-fold={canFold ? (open ? 'open' : 'folded') : 'none'}>
	<div class="head">
		<span>Views</span><span class="n" aria-label={`${n} Views`}>{n}</span>
		<span class="sum">{counts.travel} Travel · {counts.cut} Cut{#if counts.gap > 0} · <b class="gapn">⚠ {counts.gap}</b>{/if}</span>
	</div>
	{#if n === 0}
		<p class="empty">No Views yet. Capture in the dock adds the first.</p>
	{:else}
		<ol class="rail" class:scroll={canFold && open} bind:this={listEl}>
			{#each presentation.views.slice(0, shown) as view, index (view.viewId)}
				{#if edit === index && index > 0}{@render editor(index)}{/if}
				<li
					class="row"
					class:sel={selectedViewId === view.viewId}
					class:dragging={draggingViewId === view.viewId}
					class:drop-before={dropAt?.index === index && !dropAt.after}
					class:drop-after={dropAt?.index === index && dropAt.after}
					ondragover={(event) => onDragOver(event, index)}
					ondrop={onDrop}
				>
					<span class="spine up-{kindAt(index)} dn-{kindAt(index + 1)}">
						{#if index > 0}{@render chip(index)}{/if}
						<i class="node" class:def={index === 0}></i>
					</span>
					<button
						type="button"
						class="main"
						data-rail-view={view.viewId}
						aria-label={`View ${index + 1}: ${label(view.viewId)}${index === 0 ? ', the Default' : ''}`}
						aria-pressed={selectedViewId === view.viewId}
						aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
						onclick={() => onSelect(view.viewId)}
						onkeydown={(event) => onRowKey(event, index)}
					>
						<span class="th"><ExperienceSnapshot label={label(view.viewId)} viewId={view.viewId} ratio="row" /><i>{index + 1}</i></span>
						<span class="nm">
							<b>{label(view.viewId)}</b>
							{#if index === 0 || marksOf(view.viewId) !== ''}
								<small>{#if index === 0}<span class="def">Default · opens here</span>{/if}{index === 0 && marksOf(view.viewId) !== '' ? ' · ' : ''}<span class="mk">{marksOf(view.viewId)}</span></small>
							{/if}
						</span>
					</button>
					<span
						class="grip"
						draggable={!busy && n > 1}
						role="presentation"
						title="Drag to reorder · Alt+↑↓"
						ondragstart={(event) => onDragStart(event, view.viewId)}
						ondragend={endDrag}
					aria-hidden="true">⠿</span>
				</li>
			{/each}
		</ol>
		{#if hidden !== null}
			<button type="button" class="more" aria-expanded="false" onclick={toggleFold}>
				<b>Show all {n} Views ▾</b>
				<small>
					{hidden.more} more · {hidden.travel} Travel · {hidden.cut} Cut{#if hidden.gap > 0} · <span class="gapn">⚠ {hidden.gap}</span>{/if}{hidden.marks.length > 0 ? ` · ${hidden.marks.join(' · ')}` : ''}
				</small>
			</button>
		{:else if canFold}
			<button type="button" class="more" aria-expanded="true" onclick={toggleFold}><b>Show the first {FOLD_TO} ▴</b></button>
		{/if}
	{/if}
</div>

<style>
	/* Sheet §32 B: the Presentation Card's View rail, value for value. */
	.rail-host {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		min-width: 0;
		font: 12px var(--shell-sans, system-ui, sans-serif);
		color: var(--shell-ink, #1b201c);
	}
	button {
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	button:focus-visible {
		outline: 2px solid var(--shell-leaf, #4f8f6c);
		outline-offset: 1px;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		font: 600 14px var(--shell-sans, system-ui, sans-serif);
	}
	.n {
		padding: 1px 7px;
		border-radius: 999px;
		background: var(--shell-hover, #eef0ed);
		color: var(--shell-ink-2, #4a524c);
		font: 600 11px var(--shell-sans, system-ui, sans-serif);
	}
	.sum {
		min-width: 0;
		margin-left: auto;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--shell-ink-3, #79817b);
		font-size: 11px;
		font-weight: 400;
	}
	.gapn {
		color: var(--shell-caution, #c85a48);
	}
	.rail {
		margin: 8px 0 0;
		padding: 0;
		list-style: none;
	}
	.rail.scroll {
		max-height: 456px;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-top: 2px;
		border-top: 1px solid var(--shell-hairline, #e1e4de);
		border-bottom: 1px solid var(--shell-hairline, #e1e4de);
	}
	.row {
		position: relative;
		display: grid;
		grid-template-columns: 56px minmax(0, 1fr) 16px;
		align-items: center;
		height: 38px;
		border-radius: 8px;
	}
	.row:hover {
		background: var(--shell-hover, #eef0ed);
	}
	.row.sel {
		background: var(--shell-gold-tint, #f8efd6);
	}
	.row.dragging {
		opacity: 0.4;
	}
	.row.drop-before {
		box-shadow: inset 0 2px 0 var(--shell-gold, #d4ad45);
	}
	.row.drop-after {
		box-shadow: inset 0 -2px 0 var(--shell-gold, #d4ad45);
	}
	/* The spine: dotted for a Cut, solid leaf for a Travel, dashed for a Travel with no path. */
	.spine {
		position: relative;
		align-self: stretch;
	}
	.spine::before,
	.spine::after {
		content: '';
		position: absolute;
		left: 50%;
		margin-left: -1px;
		border-left: 2px solid transparent;
	}
	.spine::before {
		top: 0;
		bottom: 50%;
	}
	.spine::after {
		top: 50%;
		bottom: 0;
	}
	.spine.up-travel::before,
	.spine.dn-travel::after {
		border-left: 2px solid var(--shell-leaf, #4f8f6c);
	}
	.spine.up-cut::before,
	.spine.dn-cut::after {
		border-left: 2px dotted #b9c0b8;
	}
	.spine.up-gap::before,
	.spine.dn-gap::after {
		border-left: 2px dashed var(--shell-caution, #c85a48);
	}
	.node {
		position: absolute;
		left: 50%;
		top: 50%;
		z-index: 1;
		width: 7px;
		height: 7px;
		margin: -4px 0 0 -4px;
		border: 1.5px solid var(--shell-ink-3, #79817b);
		border-radius: 50%;
		background: #fff;
	}
	.node.def {
		border-color: var(--shell-forest, #11291f);
		background: var(--shell-forest, #11291f);
	}
	/* The connection sits on the spine between two rows, never on a row of its own. */
	.chip {
		position: absolute;
		left: 50%;
		top: 0;
		z-index: 2;
		display: inline-flex;
		align-items: center;
		height: 20px;
		transform: translate(-50%, -50%);
		border: 1px dashed #b9c0b8;
		border-radius: 999px;
		background: #fff;
		box-shadow: 0 1px 2px rgb(0 0 0 / 6%);
		font-size: 11px;
		white-space: nowrap;
	}
	.chip button {
		height: 18px;
		padding: 0 6px;
		border: 0;
		border-radius: 999px;
		background: none;
		color: var(--shell-ink-2, #4a524c);
		line-height: 18px;
	}
	.chip button:hover:not(:disabled) {
		background: var(--shell-hover, #eef0ed);
	}
	.chip.travel {
		border: 1px solid #bcd8c6;
		background: var(--shell-leaf-tint, #e7f1ea);
	}
	.chip.travel button {
		color: var(--shell-forest-raised, #22503c);
		font-weight: 600;
	}
	.chip.travel .time {
		padding-left: 1px;
		font: 600 10.5px var(--shell-mono, ui-monospace, monospace);
	}
	.chip .time small {
		margin-left: 2px;
		color: var(--shell-gold-ink, #74560c);
		font: 600 9px var(--shell-sans, system-ui, sans-serif);
		vertical-align: 1px;
	}
	.chip.gap {
		border: 1.5px dashed var(--shell-caution, #c85a48);
		background: #fff;
	}
	.chip.gap button {
		color: var(--shell-caution, #c85a48);
		font-weight: 700;
	}
	.chip.on {
		box-shadow: 0 0 0 2px var(--shell-gold, #d4ad45);
	}
	.main {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		height: 100%;
		padding: 0 4px 0 0;
		border: 0;
		background: none;
		text-align: left;
	}
	.main:focus-visible {
		outline-offset: -2px;
		border-radius: 6px;
	}
	.th {
		position: relative;
		flex: none;
		width: 44px;
		height: 28px;
		overflow: hidden;
		border-radius: 5px;
		background: var(--shell-paper, #e9ebe6);
	}
	.th i {
		position: absolute;
		left: 2px;
		top: 2px;
		padding: 0 3px;
		border-radius: 4px;
		background: rgb(17 41 31 / 78%);
		color: #fff;
		font: 600 9.5px/13px var(--shell-sans, system-ui, sans-serif);
		font-style: normal;
	}
	.nm {
		display: flex;
		flex-direction: column;
		min-width: 0;
		line-height: 1.25;
	}
	.nm b,
	.nm small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.nm b {
		font-size: 12.5px;
		font-weight: 600;
	}
	.nm small {
		color: var(--shell-ink-3, #79817b);
		font-size: 10.5px;
	}
	.nm .def {
		color: var(--shell-forest-raised, #22503c);
		font-weight: 600;
	}
	.nm .mk {
		color: var(--shell-gold-ink, #74560c);
	}
	.grip {
		color: var(--shell-ink-3, #79817b);
		font-size: 12px;
		text-align: center;
		cursor: grab;
		opacity: 0;
		user-select: none;
		touch-action: none;
	}
	.row:hover .grip,
	.row.sel .grip {
		opacity: 1;
	}
	/* The editor opens between the two rows it joins. */
	.editor {
		min-width: 0;
		padding: 4px 0 14px;
		list-style: none;
	}
	.ed-card {
		display: grid;
		min-width: 0;
		padding: 8px 10px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 10px;
		background: #fff;
		box-shadow: 0 4px 14px rgb(20 24 20 / 10%);
	}
	.ed-head {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		margin-bottom: 6px;
		font-size: 12px;
	}
	.ed-head b {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ed-head .x {
		padding: 0 4px;
		border: 0;
		background: none;
		color: var(--shell-ink-3, #79817b);
		font-size: 13px;
	}
	.ed-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.seg {
		display: inline-flex;
		gap: 3px;
	}
	.seg button {
		padding: 1px 7px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 6px;
		background: #fff;
		color: var(--shell-ink-2, #4a524c);
		font-size: 11.5px;
		white-space: nowrap;
	}
	.seg button[aria-pressed='true'] {
		border-color: #cfe1d5;
		background: var(--shell-leaf-tint, #e7f1ea);
		color: var(--shell-forest-raised, #22503c);
		font-weight: 600;
	}
	.stepper {
		display: inline-flex;
		align-items: center;
		height: 22px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 999px;
		background: #fff;
	}
	.stepper button {
		width: 22px;
		height: 20px;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: none;
		color: var(--shell-ink-2, #4a524c);
		line-height: 1;
	}
	.stepper button:hover:not(:disabled) {
		background: var(--shell-hover, #eef0ed);
	}
	.stepper b {
		min-width: 34px;
		color: var(--shell-ink, #1b201c);
		font: 600 11.5px var(--shell-mono, ui-monospace, monospace);
		text-align: center;
		white-space: nowrap;
	}
	.note,
	.warn-text {
		margin: 6px 0 0;
		color: var(--shell-ink-3, #79817b);
		font-size: 11.5px;
		line-height: 1.4;
	}
	.note b {
		color: var(--shell-ink-2, #4a524c);
	}
	.warn-text {
		color: var(--shell-caution, #c85a48);
	}
	.warn-text .link {
		margin-top: 4px;
		padding: 1px 7px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 6px;
		background: #fff;
		color: var(--shell-ink, #1b201c);
		font-size: 11px;
		text-decoration: none;
	}
	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--shell-forest-raised, #22503c);
		text-decoration: underline;
	}
	.more {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1px;
		width: 100%;
		margin-top: 6px;
		padding: 6px 10px;
		border: 1px dashed var(--shell-hairline-strong, #cdd2ca);
		border-radius: 8px;
		background: var(--shell-index, #f6f7f5);
		text-align: left;
	}
	.more:hover {
		background: var(--shell-hover, #eef0ed);
	}
	.more b {
		color: var(--shell-forest-raised, #22503c);
		font-size: 12px;
		font-weight: 600;
	}
	.more small {
		color: var(--shell-ink-3, #79817b);
		font-size: 10.5px;
	}
	.empty {
		margin: 8px 0 0;
		color: var(--shell-ink-3, #79817b);
	}
	@media (pointer: coarse) {
		.seg button,
		.stepper button,
		.bulk button,
		.more {
			min-height: 44px;
		}
		.grip {
			opacity: 1;
		}
	}
</style>
