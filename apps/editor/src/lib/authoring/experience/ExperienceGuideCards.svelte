<script lang="ts">
	import { tick, untrack } from 'svelte';
	import ExperienceStopCard from './ExperienceStopCard.svelte';
	import ExperienceStopConnector from './ExperienceStopConnector.svelte';
	import ExperienceGuideTrack from './ExperienceGuideTrack.svelte';
	import { experienceHomes } from './experience-homes';
	import type { ExperiencePlayback } from './playback.svelte';
	import { guideCards } from './experience-guide-card-model';

	let { playback, compact }: { playback: ExperiencePlayback; compact: boolean } = $props();

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const guide = $derived(controller?.currentGuide ?? null);
	const stops = $derived(controller?.guideStops ?? []);
	const busy = $derived(controller?.busy ?? false);
	const subject = $derived(controller?.subject ?? null);
	const subjectStopId = $derived(
		subject !== null && (subject.kind === 'stop' || subject.kind === 'transition') ? subject.stopId : null
	);
	const selectedStopId = $derived(
		subjectStopId !== null && stops.some((stop) => stop.id === subjectStopId) ? subjectStopId : null
	);
	const pacing = $derived((guide ?? controller?.contextGuide)?.pacing ?? 'automatic');

	let scrollerEl = $state<HTMLElement | null>(null);
	let rowEl = $state<HTMLElement | null>(null);
	let barEl = $state<HTMLElement | null>(null);
	let focusedStopId = $state<string | null>(null);

	/** What the Index's Presentation rows put on the drag (contract: agent B). */
	const PRESENTATION_MIME = 'application/x-biskiq-presentation';
	const VIEW_MIME = 'application/x-biskiq-presentation-view';


	// ---- Playback readings ----
	const stopTimes = $derived(
		new Map((playback.map?.stopEntries ?? []).map((entry) => [entry.stopId, entry]))
	);
	/** The playhead in seconds, for each Stop card's own progress (review round 3). */
	const elapsedSeconds = $derived.by(() => {
		const map = playback.map;
		const cursor = playback.cursor;
		if (map === null || cursor === null) return null;
		const segment = map.segments.find((entry) => entry.id === cursor.segmentId);
		return segment === undefined ? null : segment.startSeconds + cursor.elapsedSeconds;
	});
	/**
	 * The Travel into a Stop. Camera's time map files an arrival under the Stop it
	 * reaches, but on the strip it belongs to the gutter before that Stop, so the
	 * card's own rail is only its stay.
	 */
	function arrivalTravel(stopId: string | undefined): { startSeconds: number; durationSeconds: number } | null {
		if (stopId === undefined) return null;
		const segment = playback.map?.segments.find(
			(entry) => entry.kind === 'travel' && entry.stopId === stopId && entry.viewIndex === 0
		);
		return segment === undefined ? null : segment;
	}
	/** A Stop's stay on the clock: its occurrence without the Travel that brought it. */
	function staySpan(stopId: string): { start: number; end: number } | null {
		const entry = stopTimes.get(stopId);
		if (entry === undefined) return null;
		const arrival = arrivalTravel(stopId);
		return { start: entry.startSeconds + (arrival?.durationSeconds ?? 0), end: entry.endSeconds };
	}
	/** The Travel drawn in the gutter after `stopId`: the next Stop's arrival. */
	function gutterTravel(stopId: string): { start: number; end: number } | null {
		const index = stops.findIndex((stop) => stop.id === stopId);
		const travel = index < 0 ? null : arrivalTravel(stops[index + 1]?.id);
		return travel === null ? null : { start: travel.startSeconds, end: travel.startSeconds + travel.durationSeconds };
	}
	function spanProgress(span: { start: number; end: number } | null): number {
		const at = elapsedSeconds;
		if (span === null || at === null) return 0;
		if (at >= span.end) return 100;
		if (at < span.start) return 0;
		return span.end <= span.start ? 100 : ((at - span.start) / (span.end - span.start)) * 100;
	}
	function stopProgress(stopId: string): number {
		return spanProgress(staySpan(stopId));
	}
	/** The Travel gutter's own fill, so the card rails and gutters form one track. */
	function travelProgress(stopId: string): number {
		return spanProgress(gutterTravel(stopId));
	}
	/** Where the one playhead sits: the lane (card or gutter) holding the cursor. */
	const playheadLane = $derived.by((): { id: string; pct: number } | null => {
		const map = playback.map;
		const cursor = playback.cursor;
		if (map === null || cursor === null) return null;
		const segment = map.segments.find((entry) => entry.id === cursor.segmentId);
		if (segment === undefined) return null;
		if (segment.kind === 'travel' && segment.viewIndex === 0) {
			const index = stops.findIndex((stop) => stop.id === segment.stopId);
			const before = index > 0 ? stops[index - 1] : undefined;
			if (before !== undefined) return { id: `travel:${before.id}`, pct: travelProgress(before.id) };
		}
		return { id: `hold:${segment.stopId}`, pct: stopProgress(segment.stopId) };
	});

	// ---- Scrub ----
	// Plain play and scrub never write the Camera. The Stage applies a sample
	// only while Follow is on, and Space lives there with the same guards.
	$effect(() => {
		const activeStopId = playback.activeStopId;
		if (activeStopId === null || compact) return;
		void tick().then(() => {
			const cards = rowEl?.querySelectorAll<HTMLElement>('[data-stop-id]') ?? [];
			for (const card of cards) {
				if (card.dataset.stopId !== activeStopId) continue;
				// jsdom has no layout; the browser's scrollIntoView is optional here.
				if (typeof card.scrollIntoView === 'function') {
					card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
				}
			}
		});
	});

	// ---- Reading: cards, connectors, reasons ----
	const cards = $derived(guideCards(controller, stops, pacing));

	/** The roving tab stop: the selected card, else the last focused one, else the first. */
	const rovingStopId = $derived(
		selectedStopId ?? (stops.some((stop) => stop.id === focusedStopId) ? focusedStopId : (stops[0]?.id ?? null))
	);

	// ---- Writing: adding Stops ----

	async function addStop(presentationId: string, afterStopId?: string, entryViewId: string | null = null): Promise<boolean> {
		if (controller === null) return false;
		const options: { afterStopId?: string; entryViewId: string | null } = { entryViewId };
		if (afterStopId !== undefined) options.afterStopId = afterStopId;
		return controller.addStop(presentationId, options);
	}

	/** The first Stop of an empty Guide; the controller creates Tour (D-9). */
	async function addFirstStop(presentationId: string, entryViewId: string | null = null): Promise<void> {
		await addStop(presentationId, undefined, entryViewId);
	}

	// ---- Selection ----
	function selectStop(stopId: string): void {
		homes.select({ kind: 'stop', stopId });
	}

	function selectTransition(stopId: string): void {
		homes.select({ kind: 'transition', stopId });
		// Review round 3: the move after a Stop starts where that Stop ends.
		playback.seekStop(stopId, 'end');
	}

	// ---- The + Stop menu ----

	// ---- Cards: DOM measure, reveal, bracket ----
	function cardEls(): HTMLElement[] {
		return rowEl === null ? [] : [...rowEl.querySelectorAll<HTMLElement>(':scope > .stop-card')];
	}

	function cardEl(stopId: string): HTMLElement | null {
		return cardEls().find((el) => el.dataset.stopId === stopId) ?? null;
	}

	/** Scrolls a card just into view; instant, never smooth (a drag must not chase a moving target). */
	function revealStop(stopId: string): boolean {
		const scroller = scrollerEl;
		const el = cardEl(stopId);
		if (scroller === null || el === null) return false;
		const left = el.offsetLeft - 16;
		const right = el.offsetLeft + el.offsetWidth + 60;
		if (left < scroller.scrollLeft) scroller.scrollLeft = Math.max(0, left);
		else if (right > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = right - scroller.clientWidth;
		return true;
	}

	let lastRevealed: { key: string; scroller: HTMLElement } | null = null;
	$effect(() => {
		const key = selectedStopId;
		const scroller = scrollerEl;
		void stops; // retried when the new card arrives after its selection
		untrack(() => {
			if (key === null || scroller === null) {
				lastRevealed = null;
				return;
			}
			if (lastRevealed?.key === key && lastRevealed.scroller === scroller) return;
			if (dragging !== null) return;
			if (revealStop(key)) lastRevealed = { key, scroller };
		});
	});


	/** Review round 3: the strip has no visible scrollbar; arrows show only on a side with more. */
	let more = $state<{ left: boolean; right: boolean }>({ left: false, right: false });

	function pageCards(direction: -1 | 1): void {
		const scroller = scrollerEl;
		if (scroller === null) return;
		scroller.scrollBy({ left: direction * Math.max(120, scroller.clientWidth - 96), behavior: 'smooth' });
	}

	/** A mouse wheel over the strip scrolls it sideways; trackpads already send deltaX. */
	function onCardsWheel(event: WheelEvent): void {
		const scroller = scrollerEl;
		if (scroller === null || scroller.scrollWidth <= scroller.clientWidth) return;
		if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
		scroller.scrollLeft += event.deltaY;
		event.preventDefault();
	}

	function measureView(): void {
		const scroller = scrollerEl;
		if (scroller !== null) {
			const left = scroller.scrollLeft > 2;
			const right = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2;
			if (left !== more.left || right !== more.right) more = { left, right };
		}
	}

	$effect(() => {
		const scroller = scrollerEl;
		const row = rowEl;
		void stops;
		if (scroller === null || row === null) {
			return;
		}
		measureView();
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(() => measureView());
		observer.observe(scroller);
		observer.observe(row);
		return () => observer.disconnect();
	});

	// ---- Keyboard ----

	async function focusCard(stopId: string): Promise<void> {
		await tick();
		cardEl(stopId)?.focus();
	}

	function onCardKeydown(event: KeyboardEvent, stopId: string, index: number): void {
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();
			const direction = event.key === 'ArrowLeft' ? -1 : 1;
			if (event.altKey) {
				if (controller === null || busy) return;
				void controller.moveStop(stopId, direction).then(async () => {
					await tick();
					revealStop(stopId);
					cardEl(stopId)?.focus();
				});
				return;
			}
			const target = stops[index + direction];
			if (target === undefined) return;
			selectStop(target.id);
			void focusCard(target.id);
		} else if (event.key === 'Home' || event.key === 'End') {
			const target = event.key === 'Home' ? stops[0] : stops[stops.length - 1];
			if (target === undefined) return;
			event.preventDefault();
			selectStop(target.id);
			void focusCard(target.id);
		}
	}

	// ---- Insertion point (caret) ----

	/** The caret's place in the card row, and on the bar, as the gap it stands in. */
	let caretPx = $state<number | null>(null);
	/** An empty Guide's drop zone is hovered by a Presentation. */
	let emptyOver = $state(false);

	function gapX(at: number): number | null {
		const els = cardEls();
		if (els.length === 0) return null;
		if (at <= 0) return els[0]!.offsetLeft - 4;
		const previous = els[at - 1]!;
		const previousRight = previous.offsetLeft + previous.offsetWidth;
		if (at >= els.length) return previousRight + 4;
		return (previousRight + els[at]!.offsetLeft) / 2;
	}

	/** The gap, as an insertion index in the current order, the pointer is nearest. */
	function atFromX(clientX: number, skip: number | null): number {
		const els = cardEls();
		for (let index = 0; index < els.length; index += 1) {
			if (index === skip) continue;
			const rect = els[index]!.getBoundingClientRect();
			if (clientX < rect.left + rect.width / 2) return index;
		}
		return els.length;
	}

	/** The bar segment under the pointer (with a margin around the bar), or null off the bar. */
	function barSegment(clientX: number, clientY: number): { seg: number; rel: number } | null {
		if (barEl === null || stops.length === 0) return null;
		const rect = barEl.getBoundingClientRect();
		if (clientY < rect.top - 14 || clientY > rect.bottom + 14) return null;
		if (clientX < rect.left - 10 || clientX > rect.right + 10) return null;
		const rel = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * stops.length;
		return { seg: Math.min(stops.length - 1, Math.floor(rel)), rel };
	}

	function clearCaret(): void {
		caretPx = null;
		emptyOver = false;
	}

	// ---- Reorder by pointer ----

	type Press = { stopId: string; from: number; x: number; y: number; scroll: number };
	let press: Press | null = null;
	let dragging = $state<{ stopId: string; dx: number; dy: number; onBar: boolean } | null>(null);
	let suppressClick = false;

	function onCardPointerDown(event: PointerEvent, stopId: string, from: number): void {
		if (event.button !== 0 || busy || stops.length < 2) return;
		press = { stopId, from, x: event.clientX, y: event.clientY, scroll: scrollerEl?.scrollLeft ?? 0 };
		window.addEventListener('pointermove', onPressMove);
		window.addEventListener('pointerup', onPressUp);
		window.addEventListener('pointercancel', endPress);
		window.addEventListener('keydown', onPressKey, true);
	}

	/** Where a dragged card would land, as its final index, for the pointer's position. */
	function dropIndex(clientX: number, clientY: number, from: number): { to: number; onBar: boolean } {
		const bar = barSegment(clientX, clientY);
		if (bar !== null) return { to: bar.seg, onBar: true };
		const at = atFromX(clientX, from);
		return { to: at > from ? at - 1 : at, onBar: false };
	}

	function showReorderCaret(to: number, from: number, onBar: boolean): void {
		if (to === from) {
			clearCaret();
			return;
		}
		if (onBar) {
			caretPx = null;
		} else {
			caretPx = gapX(to > from ? to + 1 : to);
		}
	}

	function onPressMove(event: PointerEvent): void {
		if (press === null) return;
		const scroller = scrollerEl;
		const dx = event.clientX - press.x + ((scroller?.scrollLeft ?? 0) - press.scroll);
		const dy = event.clientY - press.y;
		if (dragging === null && Math.hypot(event.clientX - press.x, dy) < 6) return;
		if (scroller !== null) {
			const rect = scroller.getBoundingClientRect();
			if (event.clientY > rect.top - 20 && event.clientY < rect.bottom) {
				if (event.clientX < rect.left + 50) scroller.scrollLeft -= 14;
				else if (event.clientX > rect.right - 50) scroller.scrollLeft += 14;
			}
		}
		const { to, onBar } = dropIndex(event.clientX, event.clientY, press.from);
		dragging = { stopId: press.stopId, dx, dy: onBar ? dy : 0, onBar };
		showReorderCaret(to, press.from, onBar);
	}

	function onPressUp(event: PointerEvent): void {
		const finished = press;
		const wasDragging = dragging !== null;
		endPress();
		if (finished === null || !wasDragging) return;
		suppressClick = true;
		setTimeout(() => (suppressClick = false), 0);
		const { to } = dropIndex(event.clientX, event.clientY, finished.from);
		if (to !== finished.from && controller !== null) {
			void controller.moveStopTo(finished.stopId, to).then(() => focusCard(finished.stopId));
		}
	}

	/** Escape leaves the drag alone and keeps the selection and the Guide as they are. */
	function onPressKey(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;
		event.stopPropagation();
		event.preventDefault();
		endPress();
	}

	function endPress(): void {
		window.removeEventListener('pointermove', onPressMove);
		window.removeEventListener('pointerup', onPressUp);
		window.removeEventListener('pointercancel', endPress);
		window.removeEventListener('keydown', onPressKey, true);
		press = null;
		dragging = null;
		clearCaret();
	}

	$effect(() => endPress);

	function onCardClick(stopId: string): void {
		if (suppressClick) return;
		selectStop(stopId);
		// Review round 3: like a video timeline, pressing a Stop moves the playhead to it;
		// ▶ then plays from there, with no Play-from menu to choose from.
		playback.seekStop(stopId, 'start');
	}

	// ---- Insert by dropping a Presentation from the Index ----

	type DropTarget = { kind: 'first' } | { kind: 'after'; afterStopId: string; at: number; onBar: boolean };

	function dropTarget(event: DragEvent): DropTarget | null {
		if (controller === null || busy) return null;
		const target = event.target instanceof Element ? event.target : null;
		if (stops.length === 0) return target?.closest('.empty') ? { kind: 'first' } : null;
		let at: number;
		let onBar = false;
		const bar = barSegment(event.clientX, event.clientY);
		if (bar !== null) {
			at = Math.round(bar.rel);
			onBar = true;
		} else if (target?.closest('.cards')) {
			at = atFromX(event.clientX, null);
		} else {
			return null;
		}
		// The gap before the first card is not an insert target: no card stands to its left.
		const left = stops[at - 1];
		return left === undefined ? null : { kind: 'after', afterStopId: left.id, at, onBar };
	}

	function isPresentationDrag(event: DragEvent): boolean {
		return event.dataTransfer?.types.includes(PRESENTATION_MIME) ?? false;
	}

	function isViewDrag(event: DragEvent): boolean {
		return event.dataTransfer?.types.includes(VIEW_MIME) ?? false;
	}

	function onDragOver(event: DragEvent): void {
		if (!isPresentationDrag(event) && !isViewDrag(event)) return;
		const target = dropTarget(event);
		if (target === null) {
			clearCaret();
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
			return;
		}
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		if (target.kind === 'first') {
			caretPx = null;
			emptyOver = true;
		} else if (target.onBar) {
			caretPx = null;
			emptyOver = false;
		} else {
			emptyOver = false;
			caretPx = gapX(target.at);
		}
	}

	function onDragLeave(event: DragEvent): void {
		const next = event.relatedTarget;
		if (!(next instanceof Node) || !(event.currentTarget as HTMLElement).contains(next)) clearCaret();
	}

	function onDrop(event: DragEvent): void {
		const target = dropTarget(event);
		if (isPresentationDrag(event)) {
			const presentationId = event.dataTransfer?.getData(PRESENTATION_MIME) ?? '';
			clearCaret();
			if (presentationId === '' || target === null) return;
			event.preventDefault();
			if (target.kind === 'first') void addFirstStop(presentationId);
			else void addStop(presentationId, target.afterStopId);
			return;
		}
		if (!isViewDrag(event)) return;
		const raw = event.dataTransfer?.getData(VIEW_MIME) ?? '';
		clearCaret();
		if (raw === '' || target === null) return;
		let dropped: { readViewId?: unknown; viewId?: unknown; presentationId?: unknown };
		try {
			dropped = JSON.parse(raw) as typeof dropped;
		} catch {
			return;
		}
		const viewId = typeof dropped.viewId === 'string' ? dropped.viewId : null;
		const presentationId = typeof dropped.presentationId === 'string' ? dropped.presentationId : null;
		if (viewId === null || presentationId === null) return;
		event.preventDefault();
		if (target.kind === 'first') void addFirstStop(presentationId, viewId);
		else void addStop(presentationId, target.afterStopId, viewId);
	}
</script>
{#if stops.length === 0}
	<div
		class="empty"
		class:over={emptyOver}
		role="group"
		aria-label="Guide drop target"
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
	>
		<p>Choose <b>+ Stop</b>, or drag a Presentation or View here from the Index.</p>
	</div>
{:else}
	{#if !compact}
		<div
			class="cards-wrap"
			role="group"
			aria-label="Guide Stops"
			ondragover={onDragOver}
			ondragleave={onDragLeave}
			ondrop={onDrop}
		>
			{#if more.left}
				<button type="button" class="more-arrow left" aria-label="Earlier Stops" title="Earlier Stops" onclick={() => pageCards(-1)}><span aria-hidden="true">‹</span></button>
			{/if}
			<div class="cards" bind:this={scrollerEl} onscroll={measureView} onwheel={onCardsWheel}>
				<div class="row" role="group" aria-label={guide !== null ? `Stops in ${guide.label}` : 'Stops'} bind:this={rowEl}>
					{#each cards as card, index (card.stopId)}
						{@const selected = selectedStopId === card.stopId && subject?.kind === 'stop'}
						{@const isDragging = dragging?.stopId === card.stopId}
						<ExperienceStopCard
							{card}
							{selected}
							dragging={isDragging}
							tabindex={rovingStopId === card.stopId ? 0 : -1}
							transform={isDragging && dragging !== null
								? `translate(${dragging.dx}px, ${dragging.dy}px)${dragging.onBar ? ' scale(.9)' : ''}`
								: undefined}
							onpointerdown={(event) => onCardPointerDown(event, card.stopId, index)}
							onclick={() => onCardClick(card.stopId)}
							onkeydown={(event) => onCardKeydown(event, card.stopId, index)}
							onfocus={() => (focusedStopId = card.stopId)}
							progress={stopProgress(card.stopId)}
							playhead={playheadLane?.id === `hold:${card.stopId}` ? playheadLane.pct : null}
						/>
						<ExperienceStopConnector
							connector={card.connector}
							stopId={card.stopId}
							selected={subject?.kind === 'transition' && subject.stopId === card.stopId}
							tabindex={rovingStopId === card.stopId ? 0 : -1}
							progress={travelProgress(card.stopId)}
							playhead={playheadLane?.id === `travel:${card.stopId}` ? playheadLane.pct : null}
							onselect={() => selectTransition(card.stopId)}
						/>
					{/each}
					{#if caretPx !== null}
						<span class="caret" style:left="{caretPx}px" aria-hidden="true"></span>
					{/if}
				</div>
			</div>
			<ExperienceGuideTrack
				bind:barEl
				{playback}
				row={rowEl}
				{stops}
				{staySpan}
				{gutterTravel}
				elapsedSeconds={elapsedSeconds}
				presentationLabel={(id: string) => controller?.presentationLabel(id) ?? ''}
			/>
			{#if more.right}
				<button type="button" class="more-arrow right" aria-label="Later Stops" title="Later Stops" onclick={() => pageCards(1)}><span aria-hidden="true">›</span></button>
			{/if}
		</div>
	{/if}
{/if}

<style>
	.empty {
		display: grid;
		justify-items: center;
		gap: 6px;
		margin: 10px 12px 12px;
		padding: 14px 12px;
		border: 1.5px dashed color-mix(in srgb, var(--shell-ink-light) 30%, transparent);
		border-radius: 10px;
		color: var(--shell-ink-quiet);
		text-align: center;
	}
	.empty.over {
		border-color: var(--shell-ink-light);
		background: var(--shell-on-forest-wash);
	}
	.empty p {
		margin: 0;
		font-size: var(--shell-text-body);
	}
	.empty b {
		color: var(--shell-ink-light);
		font-weight: 600;
	}

	.cards-wrap {
		position: relative;
		min-width: 0;
	}
	.cards {
		overflow-x: auto;
		overflow-y: hidden;
		padding: 8px 0 6px;
		scrollbar-width: none;
		overscroll-behavior-x: contain;
	}
	.cards::-webkit-scrollbar { display: none; }
	.more-arrow {
		position: absolute;
		top: 0;
		bottom: 0;
		z-index: 3;
		display: flex;
		align-items: center;
		width: 56px;
		padding: 0 6px;
		border: 0;
		color: var(--shell-ink-light);
		cursor: pointer;
	}
	.more-arrow.left {
		left: 0;
		justify-content: flex-start;
		background: linear-gradient(90deg, var(--shell-forest) 35%, transparent);
	}
	.more-arrow.right {
		right: 0;
		justify-content: flex-end;
		background: linear-gradient(270deg, var(--shell-forest) 35%, transparent);
	}
	.more-arrow span {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border: 1px solid var(--guide-chip-line);
		border-radius: 50%;
		background: var(--guide-chip);
		font-size: var(--shell-text-title);
		line-height: 1;
	}
	.more-arrow:hover span { background: var(--guide-chip-hover); }
	.row {
		position: relative;
		display: flex;
		align-items: stretch;
		/* Border-box: the padding sits inside the 100 %, so one Stop never overflows the strip. */
		box-sizing: border-box;
		width: max-content;
		min-width: 100%;
		padding: 0 12px;
	}
	.caret {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 3px;
		margin-left: -1.5px;
		border-radius: 2px;
		background: var(--shell-leaf-soft);
		pointer-events: none;
	}
	:global(.guide) button:focus-visible {
		outline: 2px solid var(--shell-leaf-soft);
		outline-offset: 1px;
		box-shadow: none;
	}

</style>
