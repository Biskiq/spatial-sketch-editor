<script lang="ts">
	/**
	 * The Presentation Card's View list is the rail (sheet §32 B, accepted 2026-11-04).
	 *
	 * One 38 px row per View, numbered: View 1 is the Default and opens here. The
	 * connection between neighbours — Cut or Travel with the Camera path's time —
	 * sits on the spine between two rows and is edited right there: one press on
	 * ✂/↗ switches the kind (a new Travel adds a straight path, one Undo); pressing
	 * the time opens a small editor between the rows, and ↑↓ on a focused time
	 * steps it by 0.5 s. A Travel with no path shows ⚠ with its fix. Shift-press a
	 * second View selects a range for All Cut or All Travel (one Undo). Reorder by
	 * dragging ⠿ or with Alt+↑↓; a View moved to the top becomes the Default.
	 *
	 * Past 10 Views the list folds to the first 8 behind *Show all N Views*, which
	 * names what is hidden; opened, it scrolls in its own box of about 12 rows.
	 * Selecting, editing or moving a View past row 8 opens it. The fold, the
	 * range and the open editor are session state, never saved.
	 */
	import { tick } from 'svelte';
	import type { ExperiencePresentation } from '@portfolio/project-model/units';
	import ShellIcon from '$lib/authoring/stage/shell/ShellIcon.svelte';
	import ExperienceSnapshot from './ExperienceSnapshot.svelte';
	import type { ExperienceController, ExperienceViewChoice } from './experience-controller.svelte';
	import { formatPathSeconds, type ExperiencePathRead } from './experience-paths';

	let {
		controller,
		presentation,
		views,
		selectedViewId,
		onSelect,
		onLookThrough,
		onShapePath
	}: {
		controller: ExperienceController;
		presentation: ExperiencePresentation;
		views: readonly ExperienceViewChoice[];
		selectedViewId: string | null;
		onSelect: (viewId: string) => void;
		onLookThrough: (viewId: string) => void;
		onShapePath: (toViewId: string) => void;
	} = $props();

	/** Fold past this many Views … */
	const FOLD_AFTER = 10;
	/** … to the first this many. */
	const FOLD_TO = 8;
	const VIEW_MIME = 'application/x-biskiq-presentation-view';

	let open = $state(false);
	let edit = $state<number | null>(null);
	let anchor = $state<number | null>(null);
	let range = $state<readonly [number, number] | null>(null);
	let draggingViewId = $state<string | null>(null);
	let dropAt = $state<{ readonly index: number; readonly after: boolean } | null>(null);
	let listEl = $state<HTMLOListElement | null>(null);

	$effect(() => {
		void presentation.id;
		open = false;
		edit = null;
		anchor = null;
		range = null;
	});

	const n = $derived(presentation.views.length);
	const canFold = $derived(n > FOLD_AFTER);
	const selectedIndex = $derived(selectedViewId === null ? -1 : presentation.views.findIndex((view) => view.viewId === selectedViewId));
	// Selecting, editing or moving a View past row 8 opens the list.
	$effect(() => {
		if (!canFold || open) return;
		const deepest = Math.max(selectedIndex, edit ?? -1, range === null ? -1 : Math.max(...range));
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
		const view = presentation.views[index]!;
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

	function selectRow(index: number, event: MouseEvent): void {
		const viewId = presentation.views[index]!.viewId;
		if (event.shiftKey && anchor !== null && anchor !== index) {
			range = [Math.min(anchor, index), Math.max(anchor, index)];
			return;
		}
		anchor = index;
		range = null;
		onSelect(viewId);
	}

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
	function setRange(kind: 'cut' | 'travel'): void {
		if (busy || range === null) return;
		void controller.setPresentationStep(presentation.id, range[0] + 1, kind, range[1]);
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
	function autoTime(index: number): void {
		if (busy || !selectStepPath(index)) return;
		void controller.setPathDuration(null);
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
		range = null;
		if (to >= FOLD_TO) open = true;
		void controller.movePresentationView(presentation.id, viewId, to).then(() => refocus(viewId));
	}
	function onDragStart(event: DragEvent, viewId: string): void {
		if (busy || event.dataTransfer === null || n < 2) {
			event.preventDefault();
			return;
		}
		draggingViewId = viewId;
		event.dataTransfer.setData(VIEW_MIME, viewId);
		event.dataTransfer.effectAllowed = 'move';
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
		range = null;
		void controller.movePresentationView(presentation.id, dragged, to);
	}
	function toggleFold(): void {
		open = !open;
		if (!open) {
			if (edit !== null && edit >= FOLD_TO) edit = null;
			range = null;
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
	{@const path = pathAt(index)}
	<li class="editor" role="group" aria-label={`${label(presentation.views[index - 1]!.viewId)} to ${label(presentation.views[index]!.viewId)}`}>
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
				<span class="stepper" role="group" aria-label="Path time">
					<button type="button" aria-label="Shorter" disabled={busy} onclick={() => stepTime(index, -1)}>−</button>
					<b>{secondsAt(index)}</b>
					<button type="button" aria-label="Longer" disabled={busy} onclick={() => stepTime(index, 1)}>+</button>
				</span>
				<button type="button" class="auto" aria-pressed={path?.authoredSeconds === null} disabled={busy} onclick={() => autoTime(index)}>Auto</button>
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
	</li>
{/snippet}

<div class="rail-host" data-view-rail data-fold={canFold ? (open ? 'open' : 'folded') : 'none'}>
	<div class="head">
		<span>Views</span><span class="n">{n}</span>
		<span class="sum">{counts.travel} Travel · {counts.cut} Cut{#if counts.gap > 0} · <b class="gapn">⚠ {counts.gap}</b>{/if}</span>
	</div>
	{#if range !== null}
		<div class="bulk" role="group" aria-label="Range">
			<span>Views {range[0] + 1}–{range[1] + 1} · {range[1] - range[0]} {range[1] - range[0] === 1 ? 'connection' : 'connections'}</span>
			<button type="button" disabled={busy} onclick={() => setRange('cut')}>All Cut</button>
			<button type="button" disabled={busy} onclick={() => setRange('travel')}>All Travel</button>
			<button type="button" class="x" aria-label="Clear the range" onclick={() => (range = null)}>✕</button>
		</div>
	{/if}
	{#if n === 0}
		<p class="empty">No Views yet. Capture in the dock adds the first.</p>
	{:else}
		<ol class="rail" class:scroll={canFold && open} bind:this={listEl}>
			{#each presentation.views.slice(0, shown) as view, index (view.viewId)}
				{#if edit === index && index > 0}{@render editor(index)}{/if}
				{@const inRange = range !== null && index >= range[0] && index <= range[1]}
				<li
					class="row"
					class:sel={selectedViewId === view.viewId}
					class:rg={inRange}
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
						onclick={(event) => selectRow(index, event)}
						ondblclick={(event) => {
							event.preventDefault();
							onLookThrough(view.viewId);
						}}
						onkeydown={(event) => onRowKey(event, index)}
					>
						<span class="th"><ExperienceSnapshot label={label(view.viewId)} viewId={view.viewId} ratio="row" /><i>{index + 1}</i></span>
						<span class="nm">
							<b>{label(view.viewId)}</b>
							{#if index === 0 || marksOf(view.viewId) !== ''}
								<small>{index === 0 ? 'Default · opens here' : ''}{index === 0 && marksOf(view.viewId) !== '' ? ' · ' : ''}{marksOf(view.viewId)}</small>
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
					><ShellIcon name="menu" size={12} /></span>
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
	.rail-host {
		display: grid;
		gap: 4px;
		font-size: 12px;
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
		outline: 2px solid var(--shell-forest-raised, #22503c);
		outline-offset: 1px;
	}
	.head {
		display: flex;
		align-items: baseline;
		gap: 6px;
		font-weight: 600;
	}
	.n {
		color: var(--shell-ink-3, #6b736d);
		font-weight: 500;
	}
	.sum {
		margin-left: auto;
		color: var(--shell-ink-3, #6b736d);
		font-size: 11px;
		font-weight: 500;
	}
	.gapn {
		color: #a3650a;
	}
	.bulk {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 6px;
		border-radius: 7px;
		background: var(--shell-selected, #e8efe9);
		font-size: 11px;
	}
	.bulk button {
		min-height: 24px;
		padding: 0 8px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 6px;
		background: var(--shell-card, #fff);
	}
	.bulk span {
		flex: 1;
	}
	.x {
		border: 0 !important;
		background: none !important;
	}
	.rail {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rail.scroll {
		max-height: calc(38px * 12);
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.row {
		position: relative;
		display: flex;
		align-items: center;
		height: 38px;
		border-radius: 7px;
	}
	.row.sel {
		background: var(--shell-selected, #e8efe9);
	}
	.row.rg {
		background: rgb(212 173 69 / 14%);
	}
	.row.dragging {
		opacity: 0.45;
	}
	.row.drop-before {
		box-shadow: inset 0 2px 0 var(--shell-gold, #d4ad45);
	}
	.row.drop-after {
		box-shadow: inset 0 -2px 0 var(--shell-gold, #d4ad45);
	}
	.spine {
		position: relative;
		flex: none;
		align-self: stretch;
		width: 56px;
	}
	/* The spine: a dotted line for a Cut, solid for a Travel, dashed for a Travel with no path. */
	.spine::before,
	.spine::after {
		content: '';
		position: absolute;
		left: 41px;
		width: 0;
		border-left: 2px solid transparent;
	}
	.spine::before {
		top: 0;
		height: 50%;
	}
	.spine::after {
		bottom: 0;
		height: 50%;
	}
	.spine.up-cut::before,
	.spine.dn-cut::after {
		border-left: 2px dotted var(--shell-ink-3, #6b736d);
	}
	.spine.up-travel::before,
	.spine.dn-travel::after {
		border-left-color: var(--shell-forest-raised, #22503c);
	}
	.spine.up-gap::before,
	.spine.dn-gap::after {
		border-left: 2px dashed #a3650a;
	}
	.node {
		position: absolute;
		top: 50%;
		left: 38px;
		width: 8px;
		height: 8px;
		margin-top: -4px;
		border: 2px solid var(--shell-forest-raised, #22503c);
		border-radius: 50%;
		background: var(--shell-card, #fff);
	}
	.node.def {
		background: var(--shell-forest-raised, #22503c);
	}
	/* The connection sits on the spine between two rows, never on a row of its own. */
	.chip {
		position: absolute;
		top: 0;
		right: 22px;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		gap: 1px;
		transform: translateY(-50%);
		padding: 1px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 999px;
		background: var(--shell-card, #fff);
	}
	.chip.on {
		border-color: var(--shell-forest-raised, #22503c);
	}
	.chip button {
		min-width: 18px;
		height: 18px;
		padding: 0 3px;
		border: 0;
		border-radius: 999px;
		background: none;
		font-size: 11px;
		line-height: 18px;
	}
	.chip .time {
		font-size: 10.5px;
		font-weight: 600;
		white-space: nowrap;
	}
	.chip .time small {
		margin-left: 2px;
		color: var(--shell-ink-3, #6b736d);
		font-size: 9.5px;
	}
	.chip.gap {
		border-style: dashed;
		border-color: #a3650a;
	}
	.chip .warn {
		color: #a3650a;
	}
	.main {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 8px;
		min-width: 0;
		height: 38px;
		padding: 0 4px;
		border: 0;
		border-radius: 7px;
		background: none;
		text-align: left;
	}
	.main:hover {
		background: var(--shell-hover, #eef0ed);
	}
	.th {
		position: relative;
		flex: none;
		width: 46px;
		height: 30px;
		overflow: hidden;
		border-radius: 5px;
	}
	.th i {
		position: absolute;
		left: 2px;
		bottom: 2px;
		min-width: 14px;
		padding: 0 3px;
		border-radius: 4px;
		background: rgb(17 41 31 / 82%);
		color: #fff;
		font-size: 10px;
		font-style: normal;
		font-weight: 600;
		line-height: 14px;
		text-align: center;
	}
	.nm {
		display: grid;
		min-width: 0;
	}
	.nm b,
	.nm small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.nm b {
		font-weight: 500;
	}
	.nm small {
		color: var(--shell-ink-3, #6b736d);
		font-size: 10.5px;
	}
	.grip {
		flex: none;
		display: grid;
		place-items: center;
		width: 22px;
		height: 30px;
		color: var(--shell-ink-3, #6b736d);
		cursor: grab;
	}
	.editor {
		display: grid;
		gap: 6px;
		margin: 2px 0 2px 30px;
		padding: 8px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 8px;
		background: var(--shell-card, #fff);
		list-style: none;
	}
	.ed-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		font-size: 11px;
	}
	.ed-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.seg,
	.stepper {
		display: inline-flex;
		overflow: hidden;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 7px;
	}
	.seg button,
	.stepper button {
		min-height: 26px;
		padding: 0 8px;
		border: 0;
		background: none;
	}
	.seg button[aria-pressed='true'] {
		background: var(--shell-forest-raised, #22503c);
		color: #fff;
	}
	.stepper b {
		min-width: 40px;
		align-self: center;
		text-align: center;
	}
	.auto {
		min-height: 26px;
		padding: 0 8px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 7px;
		background: none;
	}
	.auto[aria-pressed='true'] {
		border-color: var(--shell-forest-raised, #22503c);
	}
	.note,
	.warn-text {
		margin: 0;
		color: var(--shell-ink-3, #6b736d);
		font-size: 11px;
	}
	.warn-text {
		color: #8a5a00;
	}
	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--shell-forest-raised, #22503c);
		text-decoration: underline;
	}
	.more {
		display: grid;
		gap: 2px;
		width: 100%;
		padding: 6px 8px;
		border: 1px dashed var(--shell-hairline-strong, #cdd2ca);
		border-radius: 7px;
		background: none;
		text-align: left;
	}
	.more small {
		color: var(--shell-ink-3, #6b736d);
		font-size: 10.5px;
	}
	.empty {
		margin: 0;
		color: var(--shell-ink-3, #6b736d);
	}
	@media (pointer: coarse) {
		.seg button,
		.stepper button,
		.auto,
		.bulk button,
		.more {
			min-height: 44px;
		}
		.grip {
			width: 44px;
		}
	}
</style>
