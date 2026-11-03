<script module lang="ts">
	/** Each mounted Guide takes its own id, so the hidden reason references never collide. */
	let instances = 0;
</script>

<script lang="ts">
	/**
	 * The Guide instrument (R217.S25): the Experience's Stops as 118 px cards with their
	 * connectors, the header (name, + Stop, compact, close) and the Stop-order bar. It sits
	 * in the lower column above the dock, in the shared forest material.
	 *
	 * It holds no Experience state. Every read goes through the controller and every write
	 * through a controller command; selecting goes through the homes' one `select`, which
	 * never moves the Camera. Its own state is local: whether the cards are compact, the
	 * typed first-Guide name, the open + Stop menu, and the drag in progress.
	 */
	import { tick, untrack } from 'svelte';
	import { formatGuideTime } from '@portfolio/camera-core';
	import ShellIcon from '../stage/shell/ShellIcon.svelte';
	import ExperienceSnapshot from './ExperienceSnapshot.svelte';
	import { experienceHomes } from './experience-homes';
	import { formatPathSeconds } from './experience-paths';
	import type { ExperiencePlayback } from './playback.svelte';
	import { resolveWaitScrub } from './timeline-scrub';

	let {
		onClose,
		playback
	}: {
		onClose: () => void;
		/** The Stage-owned ephemeral playback host: this panel only reads and commands it. */
		playback: ExperiencePlayback;
	} = $props();

	instances += 1;
	const instanceId = `experience-guide-${instances}`;
	const followReasonId = `${instanceId}-follow-reason`;
	const playReasonId = `${instanceId}-play-reason`;
	const addReasonId = `${instanceId}-add-reason`;

	/** What the Index's Presentation rows put on the drag (contract: agent B). */
	const PRESENTATION_MIME = 'application/x-biskiq-presentation';

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const current = $derived(controller?.current ?? null);
	const hasGuide = $derived((controller?.guides.length ?? 0) > 0);
	const guide = $derived(controller?.currentGuide ?? null);
	const stops = $derived(controller?.guideStops ?? []);
	const presentations = $derived(current?.presentations ?? []);
	const busy = $derived(controller?.busy ?? false);
	const subject = $derived(controller?.subject ?? null);
	const subjectStopId = $derived(
		subject !== null && (subject.kind === 'stop' || subject.kind === 'transition') ? subject.stopId : null
	);
	const selectedStopId = $derived(
		subjectStopId !== null && stops.some((stop) => stop.id === subjectStopId) ? subjectStopId : null
	);
	const selectedStopIndex = $derived(stops.findIndex((stop) => stop.id === selectedStopId));
	const guideSelected = $derived(subject?.kind === 'guide');
	/** The Presentation awaiting a first-Guide name (Presentation Add to Guide, or a drop without a name). */
	const pending = $derived(homes.guideNamePrompt());
	const pendingLabel = $derived(pending === null ? null : (controller?.presentationLabel(pending) ?? null));

	let compact = $state(false);
	let guideName = $state('');
	let nameInput = $state<HTMLInputElement | null>(null);
	let menuOpen = $state(false);
	let menuWrap = $state<HTMLElement | null>(null);
	let addButton = $state<HTMLButtonElement | null>(null);
	let scrollerEl = $state<HTMLElement | null>(null);
	let rowEl = $state<HTMLElement | null>(null);
	let barEl = $state<HTMLElement | null>(null);
	/** Cards the pointer has focused last, so the roving tab stop survives a cleared selection. */
	let focusedStopId = $state<string | null>(null);

	// ---- R217.S30: the Stage owns the one ephemeral playback session ----

	let transportOpen = $state(false);
	let transportWrap = $state<HTMLElement | null>(null);
	const canPlay = $derived(playback.map !== null || (controller?.playbackSource ?? null) !== null);
	const stopTimes = $derived(
		new Map((playback.map?.stopEntries ?? []).map((entry) => [entry.stopId, entry]))
	);
	const followPosition = $derived(
		playback.activeStopId === null
			? null
			: stops.findIndex((stop) => stop.id === playback.activeStopId) + 1
	);
	const playheadPct = $derived.by(() => {
		const map = playback.map;
		const cursor = playback.cursor;
		if (map === null || cursor === null) return 0;
		if (map.totalSeconds <= 0) {
			const index = map.segments.findIndex((entry) => entry.id === cursor.segmentId);
			return map.segments.length <= 1 ? 0 : (Math.max(0, index) / (map.segments.length - 1)) * 100;
		}
		const segment = map.segments.find((entry) => entry.id === cursor.segmentId);
		return segment === undefined
			? 0
			: ((segment.startSeconds + cursor.elapsedSeconds) / map.totalSeconds) * 100;
	});
	/** Each hold is one View's span; its own label/time stays readable on the bar. */
	const timelineSegments = $derived.by(() => {
		const map = playback.map;
		if (map === null) return [];
		return map.segments
			.filter((segment) => segment.durationSeconds > 0)
			.map((segment) => ({
				id: segment.id,
				kind: segment.kind,
				viewId: segment.viewId,
				label: segment.kind === 'hold' ? `View ${segment.viewId} · ${formatGuideTime(segment.durationSeconds)}` : `${segment.kind} · ${formatGuideTime(segment.durationSeconds)}`,
				left: map.totalSeconds <= 0 ? 0 : (segment.startSeconds / map.totalSeconds) * 100,
				width: map.totalSeconds <= 0 ? 100 : (segment.durationSeconds / map.totalSeconds) * 100,
				active:
					playback.activeStopId === segment.stopId &&
					(playback.status === 'playing' || playback.status === 'waiting')
			}));
	});
	const timelineWaits = $derived.by(() => {
		const map = playback.map;
		if (map === null) return [];
		const waits = map.segments.filter((segment) => segment.kind === 'wait');
		if (map.totalSeconds <= 0) {
			// Time cannot place zero-width waits. They still occupy one addressable
			// point each so an all-wait Guide remains scrub- and click-reachable.
			return waits.map((segment, index) => ({
				id: segment.id,
				left: waits.length <= 1 ? 0 : (index / (waits.length - 1)) * 100
			}));
		}
		return waits.map((segment) => ({ id: segment.id, left: (segment.startSeconds / map.totalSeconds) * 100 }));
	});

	function toggleTransport(): void {
		if (transportOpen) {
			transportOpen = false;
			return;
		}
		transportOpen = true;
		void tick().then(() => transportWrap?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
	}

	function playPause(): void {
		playback.playPause();
	}

	function playFromStart(): void {
		transportOpen = false;
		playback.playFromStart();
	}

	function playFromSelected(): void {
		transportOpen = false;
		if (selectedStopId !== null) playback.playFromStop(selectedStopId);
	}

	function previewSelectedMove(): void {
		transportOpen = false;
		if (subject?.kind === 'transition') playback.previewMove({ kind: 'transition', stopId: subject.stopId });
		else if (subject?.kind === 'stop') {
			const stop = stops.find((entry) => entry.id === subject.stopId);
			const last = stop?.views.at(-1);
			if (last !== undefined) playback.previewMove({ kind: 'step', stopId: subject.stopId, toViewId: last.viewId });
		}
	}

	/** The Stage captures the entry standpoint; this panel only asks Follow to end. */
	function restoreStandpoint(): void {
		playback.setFollow(false);
	}

	function toggleFollow(): void {
		if (playback.following) {
			restoreStandpoint();
			return;
		}
		if (!canPlay) return;
		if (playback.map === null) playback.playFromStart();
		if (playback.status === 'idle' || playback.status === 'ended') playback.playPause();
		if (playback.status === 'idle' || playback.status === 'ended' || playback.map === null) return;
		playback.setFollow(true);
	}

	function scrubAt(clientX: number): void {
		const map = playback.map;
		if (barEl === null || map === null) return;
		const rect = barEl.getBoundingClientRect();
		const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		// A wait is its own addressable occurrence even at zero width. Coincident
		// waits cycle on repeated presses, so each stacked occurrence is reachable.
		const waitId = resolveWaitScrub({
			waits: timelineWaits,
			fractionPercent: fraction * 100,
			currentSegmentId: playback.cursor?.segmentId ?? null
		});
		if (waitId !== null) {
			playback.seekSegment(waitId);
			return;
		}
		playback.seek(fraction * map.totalSeconds);
	}

	function onBarKeydown(event: KeyboardEvent): void {
		const map = playback.map;
		if (map === null) return;
		if (map.totalSeconds <= 0) {
			const queue = map.segments.filter((segment) => segment.kind === 'wait');
			if (queue.length === 0 || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
			event.preventDefault();
			const at = queue.findIndex((segment) => segment.id === playback.cursor?.segmentId);
			const delta = event.key === 'ArrowLeft' ? -1 : 1;
			const next = queue[(Math.max(0, at) + delta + queue.length) % queue.length];
			playback.seekSegment(next!.id);
			return;
		}
		const current = playback.cursor;
		const segment = current === null ? null : map.segments.find((entry) => entry.id === current.segmentId);
		const elapsed = segment === undefined || segment === null || current === null ? 0 : segment.startSeconds + current.elapsedSeconds;
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();
			playback.seek(elapsed + (event.key === 'ArrowLeft' ? -1 : 1));
		} else if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			playback.seek(event.key === 'Home' ? 0 : map.totalSeconds);
		}
	}

	function onWindowKeydown(event: KeyboardEvent): void {
		if (event.defaultPrevented) return;
		if (event.key !== 'Escape' || !playback.following) return;
		event.preventDefault();
		restoreStandpoint();
	}

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

	type Connector = {
		readonly shape: 'adjacent' | 'jump' | 'end';
		readonly text: string;
		readonly name: string;
		readonly transition: 'cut' | 'travel' | null;
		readonly gap: boolean;
	};
	type CardFacts = {
		readonly stopId: string;
		readonly viewId: string | null;
		readonly number: number;
		readonly label: string;
		readonly viewCount: number;
		readonly hold: string | null;
		readonly again: boolean;
		/** R217.S26 (E6): the Guide's start Stop carries the *Start* tag. */
		readonly start: boolean;
		readonly name: string;
		readonly connector: Connector | null;
	};

	function transitionWord(transition: 'cut' | 'travel'): string {
		return transition === 'travel' ? 'Travel' : 'Cut';
	}

	const cards = $derived.by((): readonly CardFacts[] => {
		if (controller === null) return [];
		return stops.map((stop, index) => {
			const number = index + 1;
			const label = controller.presentationLabel(stop.presentationId);
			const again = stops.slice(0, index).some((earlier) => earlier.presentationId === stop.presentationId);
			const viewId = stop.views[0]?.viewId ?? null;
			const viewCount = stop.views.length;
			const finalHold = stop.views.at(-1)?.holdSeconds;
			const hold = finalHold === undefined ? null : `${finalHold}s`;
			const resolved = controller.resolveContinuation(stop.id);
			const gaps = controller.travelGapsByStop.get(stop.id) ?? [];
			let connector: Connector | null = null;
			if (resolved !== null && resolved.kind === 'end') {
				connector = { shape: 'end', text: 'End', name: `Stop ${number} ends the Guide`, transition: null, gap: false };
			} else if (resolved !== null) {
				const gap = resolved.transition === 'travel' && gaps.length > 0;
				const target =
					resolved.kind === 'adjacent' || resolved.position !== null
						? `Stop ${resolved.position}`
						: 'a Stop outside this Guide';
				const path = resolved.transition === 'travel' ? controller.pathFor?.({ kind: 'transition', stopId: stop.id }) ?? null : null;
				const seconds = path?.state === 'ready' ? ` · ${formatPathSeconds(path.seconds)}` : '';
				const attention = gap ? '. Travel has no Camera connection yet' : '';
				connector = {
					shape: resolved.kind,
					text:
						(resolved.kind === 'adjacent'
							? resolved.transition
							: resolved.position === null
								? '→ elsewhere'
								: `→ ${resolved.position}`) + (resolved.transition === 'travel' ? seconds : ''),
					name: `Stop ${number} continues to ${target} by ${transitionWord(resolved.transition)}${attention}`,
					transition: resolved.transition,
					gap
				};
			}
			const start = controller.contextGuide?.entryStopId === stop.id;
			const spoken = [`Stop ${number}`, label];
			if (start) spoken.push('the tour starts here');
			if (again) spoken.push('again');
			spoken.push(`${viewCount} ${viewCount === 1 ? 'view' : 'views'}`);
			return { stopId: stop.id, viewId, number, label, viewCount, hold, again, start, name: spoken.join(', '), connector };
		});
	});

	/** The roving tab stop: the selected card, else the last focused one, else the first. */
	const rovingStopId = $derived(
		selectedStopId ?? (stops.some((stop) => stop.id === focusedStopId) ? focusedStopId : (stops[0]?.id ?? null))
	);

	const addReason = $derived.by((): string | null => {
		if (busy) return 'Saving the last change';
		if (!hasGuide && guideName.trim() === '') return 'Name the Guide first';
		if (presentations.length === 0) return 'Add a Presentation first';
		return null;
	});

	function inGuide(presentationId: string): boolean {
		return stops.some((stop) => stop.presentationId === presentationId);
	}

	// ---- Writing: adding Stops ----

	async function addStop(presentationId: string, afterStopId?: string): Promise<boolean> {
		if (controller === null) return false;
		const options: { afterStopId?: string; firstGuideLabel?: string } = {};
		if (afterStopId !== undefined) options.afterStopId = afterStopId;
		if (!hasGuide) options.firstGuideLabel = guideName.trim();
		const accepted = await controller.addStop(presentationId, Object.keys(options).length > 0 ? options : undefined);
		if (accepted && homes.guideNamePrompt() !== null) homes.requestGuideName(null);
		return accepted;
	}

	/** The first Stop of an empty Guide: needs the Guide's name when there is no Guide yet (D8). */
	async function addFirstStop(presentationId: string): Promise<void> {
		if (!hasGuide && guideName.trim() === '') {
			homes.requestGuideName(presentationId);
			nameInput?.focus();
			return;
		}
		await addStop(presentationId);
	}

	async function chooseFromMenu(presentationId: string): Promise<void> {
		closeMenu();
		await addStop(presentationId);
	}

	async function commitPending(): Promise<void> {
		if (pending === null || guideName.trim() === '' || busy) return;
		await addStop(pending);
	}

	function onNameKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			void commitPending();
		}
	}

	// Asked for a name: put the cursor where it is typed.
	$effect(() => {
		if (pending !== null && !hasGuide && nameInput !== null) nameInput.focus();
	});

	// ---- Selection ----

	function selectStop(stopId: string): void {
		homes.select({ kind: 'stop', stopId });
	}

	function selectTransition(stopId: string): void {
		homes.select({ kind: 'transition', stopId });
	}

	function selectGuide(): void {
		if (guide !== null) homes.select({ kind: 'guide', guideId: guide.id });
	}

	// ---- The + Stop menu ----

	function openMenu(): void {
		if (addReason !== null) return;
		menuOpen = true;
		void tick().then(() => menuWrap?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
	}

	function closeMenu(): void {
		menuOpen = false;
	}

	function onWindowPointerDown(event: PointerEvent): void {
		if (menuOpen && menuWrap !== null && !menuWrap.contains(event.target as Node)) closeMenu();
	}

	function onMenuKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.stopPropagation();
			closeMenu();
			addButton?.focus();
			return;
		}
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		const items = [...(menuWrap?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
		const at = items.indexOf(document.activeElement as HTMLElement);
		const next = event.key === 'ArrowDown' ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1);
		items[next]?.focus();
	}

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

	/** The cards scrolled into view, as first and last index; null when they all show. */
	let inView = $state<{ first: number; last: number } | null>(null);

	function measureView(): void {
		const scroller = scrollerEl;
		const els = cardEls();
		if (scroller === null || els.length === 0) {
			inView = null;
			return;
		}
		const from = scroller.scrollLeft;
		const to = from + scroller.clientWidth;
		let first = -1;
		let last = -1;
		els.forEach((el, index) => {
			const centre = el.offsetLeft + el.offsetWidth / 2;
			if (centre > from && centre < to) {
				if (first < 0) first = index;
				last = index;
			}
		});
		inView = first < 0 || (first === 0 && last === els.length - 1) ? null : { first, last };
	}

	$effect(() => {
		const scroller = scrollerEl;
		const row = rowEl;
		void stops;
		if (scroller === null || row === null) {
			inView = null;
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
	let barCaretPct = $state<number | null>(null);
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
		barCaretPct = null;
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
			barCaretPct = ((to > from ? to + 1 : to) / stops.length) * 100;
		} else {
			barCaretPct = null;
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

	function onDragOver(event: DragEvent): void {
		if (!isPresentationDrag(event)) return;
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
			barCaretPct = null;
			emptyOver = true;
		} else if (target.onBar) {
			caretPx = null;
			emptyOver = false;
			barCaretPct = (target.at / stops.length) * 100;
		} else {
			barCaretPct = null;
			emptyOver = false;
			caretPx = gapX(target.at);
		}
	}

	function onDragLeave(event: DragEvent): void {
		const next = event.relatedTarget;
		if (!(next instanceof Node) || !(event.currentTarget as HTMLElement).contains(next)) clearCaret();
	}

	function onDrop(event: DragEvent): void {
		if (!isPresentationDrag(event)) return;
		const presentationId = event.dataTransfer?.getData(PRESENTATION_MIME) ?? '';
		const target = dropTarget(event);
		clearCaret();
		if (presentationId === '' || target === null) return;
		event.preventDefault();
		if (target.kind === 'first') void addFirstStop(presentationId);
		else void addStop(presentationId, target.afterStopId);
	}
</script>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onWindowKeydown} />

{#if controller === null}
	<p class="status" role="status">The Experience lens mounts with the admitted project source.</p>
{:else if current === null}
	<p class="status">Create an Experience in the Index before composing its Guide.</p>
{:else}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="guide"
		role="group"
		aria-label="Guide"
		data-experience-guide
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
	>
		<header class="head">
			<span class="kicker">Guide</span>
			{#if hasGuide}
				{#if guide !== null}
					<button
						type="button"
						class="guide-name"
						class:selected={guideSelected}
						aria-pressed={guideSelected}
						title="Show this Guide's Card"
						onclick={selectGuide}
					>
						{guide.label}
					</button>
				{:else}
					<span class="guide-name plain">Guide</span>
				{/if}
				<span class="count">{stops.length} {stops.length === 1 ? 'stop' : 'stops'}</span>
			{:else}
				<input
					class="name-input"
					type="text"
					placeholder="Name this Guide"
					aria-label="Guide name"
					bind:value={guideName}
					bind:this={nameInput}
					onkeydown={onNameKeydown}
				/>
			{/if}
			<span class="spacer"></span>
			<button
				type="button"
				class="tool"
				class:on={playback.following}
				disabled={!canPlay}
				title={playback.following ? 'Stop following the camera' : 'Follow the camera'}
				aria-pressed={playback.following}
				aria-describedby={playback.following ? followReasonId : undefined}
				onclick={toggleFollow}
			>
				<ShellIcon name="camera" size={13} />
				<span class="word">Follow</span>
			</button>
			<span class="menu-wrap" bind:this={menuWrap}>
				<button
					type="button"
					class="tool"
					bind:this={addButton}
					disabled={addReason !== null}
					title={addReason ?? 'Add a Presentation as a Stop'}
					aria-describedby={addReason !== null ? addReasonId : undefined}
					aria-haspopup="menu"
					aria-expanded={menuOpen}
					onclick={() => (menuOpen ? closeMenu() : openMenu())}
				>
					<ShellIcon name="plus" size={13} />
					<span class="word">Stop</span>
				</button>
				{#if menuOpen}
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<div class="menu" role="menu" aria-label="Add a Presentation as a Stop" tabindex="-1" onkeydown={onMenuKeydown}>
						{#each presentations as presentation (presentation.id)}
							<button type="button" role="menuitem" class="menu-item" onclick={() => void chooseFromMenu(presentation.id)}>
								<span class="menu-label">{presentation.label}</span>
								{#if inGuide(presentation.id)}<span class="menu-hint">again</span>{/if}
							</button>
						{/each}
					</div>
				{/if}
			</span>
			{#if stops.length > 0}
				<button
					type="button"
					class="icon"
					class:flipped={compact}
					aria-expanded={!compact}
					aria-label={compact ? 'Show Stop cards' : 'Compact Guide'}
					title={compact ? 'Show Stop cards' : 'Compact: overview only'}
					onclick={() => (compact = !compact)}
				>
					<ShellIcon name="chevronDown" size={15} />
				</button>
			{/if}
			<button type="button" class="icon" aria-label="Close Guide" title="Close the Guide" onclick={onClose}>
				<ShellIcon name="close" size={15} />
			</button>
		</header>

		{#if stops.length === 0}
			<div class="empty" class:over={emptyOver}>
				<p>Choose <b>+ Stop</b>, or drag a Presentation here from the Index.</p>
				{#if pending !== null && !hasGuide}
					<p class="empty-note">
						{#if guideName.trim() === ''}
							Name the Guide, then press Enter to add {pendingLabel ?? 'it'}.
						{:else}
							Press Enter to add {pendingLabel ?? 'it'} as the first Stop.
						{/if}
					</p>
					<button
						type="button"
						class="tool"
						disabled={guideName.trim() === '' || busy}
						title={guideName.trim() === '' ? 'Name the Guide first' : undefined}
						onclick={() => void commitPending()}
					>
						Add {pendingLabel ?? 'it'}
					</button>
				{/if}
			</div>
		{:else}
			{#if !compact}
				<div class="cards" bind:this={scrollerEl} onscroll={measureView}>
					<div class="row" role="group" aria-label={guide !== null ? `Stops in ${guide.label}` : 'Stops'} bind:this={rowEl}>
						{#each cards as card, index (card.stopId)}
							{@const selected = selectedStopId === card.stopId && subject?.kind === 'stop'}
							{@const isDragging = dragging?.stopId === card.stopId}
							<button
								type="button"
								class="stop-card"
								class:selected
								class:dragging={isDragging}
								data-stop-id={card.stopId}
								aria-pressed={selected}
								aria-label={card.name}
								tabindex={rovingStopId === card.stopId ? 0 : -1}
								style:transform={isDragging && dragging !== null
									? `translate(${dragging.dx}px, ${dragging.dy}px)${dragging.onBar ? ' scale(.9)' : ''}`
									: undefined}
								onpointerdown={(event) => onCardPointerDown(event, card.stopId, index)}
								onclick={() => onCardClick(card.stopId)}
								onkeydown={(event) => onCardKeydown(event, card.stopId, index)}
								onfocus={() => (focusedStopId = card.stopId)}
							>
								<ExperienceSnapshot label={card.label} viewId={card.viewId} number={card.number} ratio="stop" />
								<span class="stop-name">{card.label}</span>
								<span class="stop-meta">
									{#if card.start}<span class="start-tag" data-start-tag>Start</span>{/if}
									{#if card.again}<em>again</em>{/if}
									{#if card.again}<span aria-hidden="true"> · </span>{/if}
									<span>{card.viewCount} {card.viewCount === 1 ? 'view' : 'views'}</span>
									{#if stopTimes.get(card.stopId) !== undefined}
										<span aria-hidden="true"> · </span>
										<span class="stop-time" data-stop-time>{formatGuideTime(stopTimes.get(card.stopId)!.endSeconds - stopTimes.get(card.stopId)!.startSeconds)}</span>
									{/if}
								</span>
							</button>
							<span class="slot" class:adjacent={card.connector?.shape === 'adjacent'}>
								{#if card.connector !== null}
									{@const connector = card.connector}
									<button
										type="button"
										class="chip {connector.shape}"
										data-connector={card.stopId}
										class:cut={connector.transition === 'cut'}
										class:travel={connector.transition === 'travel'}
										class:gap={connector.gap}
										class:selected={subject?.kind === 'transition' && subject.stopId === card.stopId}
										aria-pressed={subject?.kind === 'transition' && subject.stopId === card.stopId}
										aria-label={connector.name}
										title={connector.name}
										tabindex={rovingStopId === card.stopId ? 0 : -1}
										onclick={() => selectTransition(card.stopId)}
									>
										{connector.text}
									</button>
									{#if connector.gap && controller !== null}
										<button
											type="button"
											class="chip-add"
											aria-label={`Add a Camera path from Stop ${card.number} to the next`}
											title="Add a Camera path"
											onpointerdown={(event) => event.stopPropagation()}
											onclick={(event) => {
												event.stopPropagation();
												void controller?.createPath({ kind: 'transition', stopId: card.stopId });
											}}
										>
											+
										</button>
									{/if}
								{/if}
							</span>
						{/each}
						{#if caretPx !== null}
							<span class="caret" style:left="{caretPx}px" aria-hidden="true"></span>
						{/if}
					</div>
				</div>
			{/if}

			<div class="scrub" data-playback-timeline>
				<button
					type="button"
					class="play"
					disabled={!canPlay}
					aria-label={playback.status === 'playing' ? 'Pause' : 'Play'}
					title={canPlay ? (playback.status === 'playing' ? 'Pause (Space)' : 'Play (Space)') : 'There is no Guide to play'}
					aria-describedby={canPlay ? undefined : playReasonId}
					onclick={playPause}
				>
					{#if playback.status === 'playing'}
						<span class="pause-glyph" aria-hidden="true">❚❚</span>
					{:else}
						<ShellIcon name="play" size={13} />
					{/if}
				</button>
				<span class="transport-wrap" bind:this={transportWrap}>
					<button
						type="button"
						class="tool transport"
						disabled={!canPlay}
						aria-haspopup="menu"
						aria-expanded={transportOpen}
						title="Play from…"
						onclick={toggleTransport}
					>
						<span aria-hidden="true">▾</span>
					</button>
					{#if transportOpen}
						<div class="menu transport-menu" role="menu" aria-label="Play from" tabindex="-1">
							<button type="button" role="menuitem" class="menu-item" onclick={playFromStart}>
								<span class="menu-label">Play from the start</span>
							</button>
							<button type="button" role="menuitem" class="menu-item" disabled={selectedStopId === null} onclick={playFromSelected}>
								<span class="menu-label">Play from this Stop</span>
								<span class="menu-hint">{selectedStopId === null ? 'Select a Stop' : `Stop ${selectedStopIndex + 1}`}</span>
							</button>
							<button
								type="button"
								role="menuitem"
								class="menu-item"
								disabled={subject?.kind !== 'transition' && subject?.kind !== 'stop'}
								onclick={previewSelectedMove}
							>
								<span class="menu-label">Preview this move</span>
								<span class="menu-hint">{subject?.kind === 'transition' || subject?.kind === 'stop' ? '' : 'Select a Stop or transition'}</span>
							</button>
						</div>
					{/if}
				</span>
				<div
					class="bar-hit"
					role="slider"
					tabindex={canPlay ? 0 : -1}
					aria-label="Guide timeline"
					aria-valuemin={0}
					aria-valuemax={Math.round(playback.map?.totalSeconds ?? 0)}
					aria-valuenow={Math.round((playback.map?.totalSeconds ?? 0) * (playheadPct / 100))}
					aria-valuetext={`${playback.elapsedLabel} of ${playback.totalLabel}${playback.map === null ? '' : playback.map.waitCount === 0 ? '' : ` ${playback.map.waitCount === 1 ? '+ 1 wait' : `+ ${playback.map.waitCount} waits`}`}`}
					aria-disabled={!canPlay}
					onpointerdown={(event) => scrubAt(event.clientX)}
					onkeydown={onBarKeydown}
				>
					<div class="bar" bind:this={barEl} aria-hidden="true">
						{#each timelineSegments as segment (segment.id)}
							<span
								class="seg {segment.kind}"
								class:active={segment.active}
								data-view-span={segment.kind === 'hold' ? segment.viewId : undefined}
								title={segment.label}
								aria-label={segment.label}
								style:left="{segment.left}%"
								style:width="{segment.width}%"
							></span>
						{/each}
						{#each timelineWaits as wait (wait.id)}
							<span class="hatch" style:left="{wait.left}%"></span>
						{/each}
						{#if playback.cursor !== null && playback.map !== null}
							<span class="playhead" style:left="{playheadPct}%"></span>
						{/if}
						{#if inView !== null && !compact}
							<span
								class="bracket"
								style:left="{(inView.first / stops.length) * 100}%"
								style:width="{((inView.last - inView.first + 1) / stops.length) * 100}%"
							></span>
						{/if}
					</div>
				</div>
				<span class="total" data-playback-total>
					{playback.elapsedLabel} / {playback.totalLabel}{#if playback.map !== null && playback.map.waitCount > 0}<span class="waits">{playback.map.waitCount === 1 ? '+ 1 wait' : `+ ${playback.map.waitCount} waits`}</span>{/if}
				</span>
			</div>
			{#if playback.following}
				<div class="follow-pill" role="status">
					<span class="live-dot" aria-hidden="true"></span>
					<span>Following the camera{followPosition === null || followPosition <= 0 ? '' : ` · travelling to Stop ${followPosition}`}</span>
					<button type="button" class="pill-stop" onclick={restoreStandpoint}>Stop following <span class="kbd">Esc</span></button>
				</div>
			{/if}
		{/if}

		<span id={followReasonId} class="visually-hidden">Following the camera · Stop following Esc</span>
		<span id={playReasonId} class="visually-hidden">There is no Guide to play</span>
		{#if addReason !== null}<span id={addReasonId} class="visually-hidden">{addReason}</span>{/if}
	</div>
{/if}

<style>
	.status {
		margin: 0;
		color: var(--shell-ink-quiet, #9fb2a5);
		font-size: 12px;
	}
	.guide {
		position: relative;
		display: flex;
		flex-direction: column;
		/* Round 2: a fixed 820 px instrument, whatever the number of Stops; the Card stops above it. */
		width: min(820px, 100%);
		border-radius: 12px;
		background: var(--shell-forest, #11291f);
		color: var(--shell-ink-light, #eef1ec);
		box-shadow: 0 12px 30px rgb(0 0 0 / 0.28);
	}

	/* ---- Header ---- */
	.head {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 6px 6px 12px;
		border-bottom: 1px solid rgb(255 255 255 / 0.08);
	}
	.kicker {
		font: 600 10px var(--shell-sans, system-ui, sans-serif);
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: #9fbcaa;
	}
	.guide-name {
		min-width: 0;
		max-width: 22ch;
		padding: 0;
		border: 0;
		border-bottom: 2px solid transparent;
		background: transparent;
		color: #fff;
		font: 15px var(--shell-serif, Georgia, serif);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;
	}
	.guide-name.plain {
		cursor: default;
	}
	.guide-name:hover:not(.plain) {
		border-bottom-color: rgb(255 255 255 / 0.3);
	}
	.guide-name.selected {
		border-bottom-color: var(--shell-gold, #d4ad45);
	}
	.count {
		color: var(--shell-ink-quiet, #9fb2a5);
		font-size: 11.5px;
		white-space: nowrap;
	}
	.name-input {
		flex: 1;
		min-width: 8ch;
		max-width: 26ch;
		height: 26px;
		padding: 0 8px;
		border: 1px solid rgb(255 255 255 / 0.18);
		border-radius: 7px;
		background: rgb(255 255 255 / 0.07);
		color: #fff;
		font: 15px var(--shell-serif, Georgia, serif);
	}
	.name-input::placeholder {
		color: #9fbcaa;
	}
	.spacer {
		flex: 1;
	}
	.tool {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 26px;
		padding: 0 9px;
		border: 0;
		border-radius: 7px;
		background: rgb(255 255 255 / 0.09);
		color: inherit;
		font: inherit;
		font-size: 12px;
		white-space: nowrap;
		cursor: pointer;
	}
	.tool:hover:not(:disabled) {
		background: rgb(255 255 255 / 0.16);
	}
	.tool[aria-expanded='true'] {
		background: rgb(79 143 108 / 0.45);
	}
	.icon {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		padding: 0;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: #cfdcd2;
		cursor: pointer;
	}
	.icon:hover {
		background: rgb(255 255 255 / 0.1);
	}
	.icon.flipped :global(svg) {
		transform: rotate(180deg);
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.guide button:focus-visible,
	.guide input:focus-visible {
		outline: 2px solid var(--shell-ink-light, #eef1ec);
		outline-offset: 1px;
		box-shadow: none;
	}

	/* ---- + Stop menu: opens upward, over the Stage, since the Guide sits at the lower edge ---- */
	.menu-wrap {
		position: relative;
		display: inline-flex;
	}
	.menu {
		position: absolute;
		right: 0;
		bottom: calc(100% + 8px);
		z-index: 5;
		display: flex;
		flex-direction: column;
		min-width: 200px;
		max-width: 320px;
		max-height: min(16rem, 50vh);
		overflow-y: auto;
		padding: 4px;
		border: 1px solid rgb(255 255 255 / 0.1);
		border-radius: 10px;
		background: var(--shell-popup-dark, rgba(17, 41, 31, 0.97));
		box-shadow: 0 10px 28px rgb(0 0 0 / 0.32);
	}
	.menu-item {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		padding: 6px 8px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	.menu-item:hover,
	.menu-item:focus-visible {
		background: rgb(255 255 255 / 0.1);
	}
	.menu-label {
		font: 13px var(--shell-serif, Georgia, serif);
	}
	.menu-hint {
		color: var(--shell-ink-quiet, #9fb2a5);
		font: italic 11px var(--shell-sans, system-ui, sans-serif);
	}

	/* ---- Empty Guide ---- */
	.empty {
		display: grid;
		justify-items: center;
		gap: 6px;
		margin: 10px 12px 12px;
		padding: 14px 12px;
		border: 1.5px dashed rgb(255 255 255 / 0.3);
		border-radius: 10px;
		color: #c9d6cc;
		text-align: center;
	}
	.empty.over {
		border-color: var(--shell-ink-light, #eef1ec);
		background: rgb(255 255 255 / 0.06);
	}
	.empty p {
		margin: 0;
		font-size: 12.5px;
	}
	.empty b {
		color: #fff;
		font-weight: 600;
	}
	.empty .empty-note {
		color: var(--shell-ink-quiet, #9fb2a5);
		font-size: 11.5px;
	}

	/* ---- Stop cards and connectors ---- */
	.cards {
		overflow-x: auto;
		padding: 8px 0 4px;
		scrollbar-width: thin;
		scrollbar-color: rgb(255 255 255 / 0.22) transparent;
	}
	.cards::-webkit-scrollbar { height: 6px; }
	.cards::-webkit-scrollbar-track { background: transparent; }
	.cards::-webkit-scrollbar-thumb {
		border-radius: 6px;
		background: rgb(255 255 255 / 0.22);
	}
	.cards::-webkit-scrollbar-thumb:hover { background: rgb(255 255 255 / 0.38); }
	.row {
		position: relative;
		display: flex;
		align-items: stretch;
		width: max-content;
		min-width: 100%;
		padding: 0 12px;
	}
	.stop-card {
		flex: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 118px;
		padding: 5px;
		border: 2px solid transparent;
		border-radius: 8px;
		background: #f3f4ef;
		color: var(--shell-ink, #1b201c);
		font: inherit;
		text-align: left;
		cursor: pointer;
		user-select: none;
	}
	.stop-card.selected {
		border-color: var(--shell-gold, #d4ad45);
		background: var(--shell-card, #fff);
	}
	.stop-card.dragging {
		position: relative;
		z-index: 2;
		cursor: grabbing;
		opacity: 0.92;
		box-shadow: 0 8px 20px rgb(0 0 0 / 0.35);
	}
	.stop-name {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		font: 12.5px/1.15 var(--shell-serif, Georgia, serif);
	}
	.stop-meta {
		min-height: 1.35em;
		line-height: 1.35;
		color: var(--shell-ink-3, #79817b);
		font-size: 10.5px;
	}
	.stop-meta em {
		font-style: italic;
	}
	.slot {
		position: relative;
		flex: none;
		display: grid;
		place-items: center;
		width: 44px;
	}
	.chip-add {
		width: 22px;
		height: 22px;
		min-width: 22px;
		min-height: 22px;
		margin-left: 3px;
		border: 1px solid var(--caution, #b5682d);
		border-radius: 50%;
		background: transparent;
		color: var(--caution, #b5682d);
		font: inherit;
		font-size: 14px;
		line-height: 1;
		cursor: pointer;
	}
	@media (pointer: coarse) {
		.chip-add {
			width: 44px;
			height: 44px;
			min-width: 44px;
			min-height: 44px;
		}
	}
	/* Adjacency is drawn only for a connector whose destination is the neighbour (D11). */
	.slot.adjacent::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		border-top: 1px solid rgb(255 255 255 / 0.28);
	}
	.chip {
		position: relative;
		padding: 2px 6px;
		border: 1px solid transparent;
		border-radius: 10px;
		background: color-mix(in srgb, #fff 8%, var(--shell-forest, #11291f));
		color: var(--shell-ink-light, #eef1ec);
		font: 11px var(--shell-mono, ui-monospace, monospace);
		white-space: nowrap;
		cursor: pointer;
	}
	.chip.cut {
		border: 1px dashed rgb(255 255 255 / 0.35);
	}
	.chip.travel {
		background: color-mix(in srgb, var(--shell-leaf, #4f8f6c) 40%, var(--shell-forest, #11291f));
	}
	.chip.jump,
	.chip.end {
		border: 1px solid rgb(255 255 255 / 0.22);
	}
	.chip.gap {
		border: 1px dashed var(--shell-caution, #c85a48);
		background: color-mix(in srgb, var(--shell-caution, #c85a48) 28%, var(--shell-forest, #11291f));
		color: color-mix(in srgb, var(--shell-caution, #c85a48) 35%, #fff);
	}
	.chip.selected {
		box-shadow: 0 0 0 2px var(--shell-gold, #d4ad45);
	}
	/* R217.S26: the *Start* tag, a mono 10 px tag like the Index's *opens*. */
	.start-tag {
		margin-right: 4px;
		padding: 0 4px;
		border: 1px solid currentColor;
		border-radius: 3px;
		font: 500 10px/1.4 var(--shell-mono, ui-monospace, monospace);
		letter-spacing: 0.02em;
	}
	.caret {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 3px;
		margin-left: -1.5px;
		border-radius: 2px;
		background: var(--shell-gold, #d4ad45);
		pointer-events: none;
	}

	/* ---- R217.S30: time timeline ---- */
	.transport-wrap {
		position: relative;
		display: inline-flex;
	}
	.transport {
		min-width: 24px;
		padding: 0 4px;
	}
	.transport-menu {
		left: 0;
		bottom: calc(100% + 8px);
		right: auto;
	}
	.tool.on {
		background: color-mix(in srgb, var(--shell-gold, #d4ad45) 38%, transparent);
		color: #fff;
	}
	.bar-hit {
		display: flex;
		flex: 1;
		align-items: center;
		min-width: 0;
		min-height: 24px;
		cursor: pointer;
		touch-action: none;
	}
	.bar-hit:focus-visible {
		outline: 2px solid var(--shell-ink-light, #eef1ec);
		outline-offset: 2px;
		border-radius: 6px;
	}
	.bar-hit .bar {
		position: relative;
		display: block;
		width: 100%;
		height: 8px;
		border-radius: 4px;
		background: rgb(255 255 255 / 0.14);
		overflow: hidden;
	}
	.bar-hit .seg {
		position: absolute;
		top: 0;
		bottom: 0;
		background: rgb(255 255 255 / 0.28);
		border-right: 1px solid rgb(17 41 31 / 0.65);
	}
	.bar-hit .seg.travel {
		background: color-mix(in srgb, var(--shell-leaf, #4f8f6c) 62%, #fff);
	}
	.bar-hit .seg.cut {
		background: rgb(255 255 255 / 0.2);
	}
	.bar-hit .seg.active {
		background: var(--shell-gold, #d4ad45);
		box-shadow: 0 0 8px 1px color-mix(in srgb, var(--shell-gold, #d4ad45) 70%, transparent);
	}
	.bar-hit .hatch {
		position: absolute;
		top: -2px;
		bottom: -2px;
		width: 5px;
		margin-left: -2.5px;
		border-radius: 1px;
		background: repeating-linear-gradient(
			45deg,
			var(--shell-gold, #d4ad45) 0 1px,
			transparent 1px 2.5px
		);
		opacity: 0.95;
	}
	.bar-hit .playhead {
		position: absolute;
		top: -3px;
		bottom: -3px;
		width: 1px;
		margin-left: -0.5px;
		background: var(--shell-gold, #d4ad45);
		box-shadow: 0 0 4px color-mix(in srgb, var(--shell-gold, #d4ad45) 80%, transparent);
		pointer-events: none;
	}
	.total {
		flex: none;
		color: var(--shell-ink-light, #eef1ec);
		font: 500 11px/1.2 var(--shell-mono, ui-monospace, monospace);
		white-space: nowrap;
	}
	.total .waits {
		margin-left: 4px;
		color: var(--shell-gold, #d4ad45);
	}
	.stop-time {
		font: 500 10px var(--shell-mono, ui-monospace, monospace);
	}
	.follow-pill {
		position: absolute;
		left: 50%;
		bottom: calc(100% + 10px);
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 4px 4px 12px;
		border-radius: 20px;
		background: var(--shell-glass-dark, rgba(14, 30, 25, 0.8));
		color: var(--shell-ink-light, #eef1ec);
		font: 12px var(--shell-sans, system-ui, sans-serif);
		white-space: nowrap;
		z-index: 4;
	}
	.live-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--shell-gold, #d4ad45);
	}
	.pause-glyph {
		font: 600 9px/1 var(--shell-sans, system-ui, sans-serif);
		letter-spacing: 1px;
	}
	.pill-stop {
		height: 28px;
		padding: 0 10px;
		border: 0;
		border-radius: 14px;
		background: rgb(255 255 255 / 0.12);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.kbd {
		color: var(--shell-ink-quiet, #9fb2a5);
		font-size: 11px;
	}

	/* ---- Stop-order bar ---- */
	.scrub {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 4px 12px 10px;
	}
	.play {
		display: grid;
		place-items: center;
		flex: none;
		width: 31px;
		height: 26px;
		padding: 0;
		border: 0;
		border-radius: 7px;
		background: var(--shell-gold, #d4ad45);
		color: #2a2208;
	}
	.bar {
		position: relative;
		display: flex;
		flex: 1;
		gap: 0;
		height: 8px;
		min-width: 0;
		border-radius: 4px;
		background: rgb(255 255 255 / 0.12);
	}
	.seg {
		flex: 1 1 0;
		display: flex;
		align-items: center;
		justify-content: center;
		container-type: inline-size;
		min-width: 0;
		overflow: hidden;
		border-right: 1px solid rgb(17 41 31 / 0.6);
		background: rgb(255 255 255 / 0.22);
	}
	.seg.selected {
		background: var(--shell-gold, #d4ad45);
	}
	/* The hold is written on its segment only while the segment is wide enough for it. */
	/* Round 2's 8 px bar has no room for text: a Stop's hold reads on its card. */
	.seg-hold {
		display: none !important;
		font: 600 8px/1 var(--shell-mono, ui-monospace, monospace);
		color: #e3eee7;
		white-space: nowrap;
		pointer-events: none;
	}
	@container (min-width: 24px) {
		.seg-hold {
			display: block;
		}
	}
	.seg.selected .seg-hold {
		color: #2a2208;
	}
	.bracket {
		position: absolute;
		top: -3px;
		bottom: -3px;
		border: 1.5px solid rgb(255 255 255 / 0.7);
		border-radius: 5px;
		pointer-events: none;
	}
	.bar-caret {
		position: absolute;
		top: -4px;
		bottom: -4px;
		width: 3px;
		margin-left: -1.5px;
		border-radius: 2px;
		background: var(--shell-gold, #d4ad45);
		pointer-events: none;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}

	/* Below 620 px the header goes icon-only (harvest §2.2). */
	@media (max-width: 620px) {
		.tool .word,
		.kicker {
			display: none;
		}
	}
	@media (pointer: coarse) {
		.tool,
		.icon,
		.play,
		.name-input,
		.chip,
		.pill-stop {
			min-height: var(--shell-touch-target, 44px);
		}
		.icon,
		.play {
			min-width: var(--shell-touch-target, 44px);
		}
		/* The coarse hit area is 44 px; the visual track stays 8 px. */
		.bar-hit {
			min-height: var(--shell-touch-target, 44px);
		}
	}
</style>
