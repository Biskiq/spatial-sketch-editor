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
	 * never moves the Camera. Its own state is local: whether the cards are compact,
	 * the open + Stop menu, and the drag in progress.
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
	const VIEW_MIME = 'application/x-biskiq-presentation-view';

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const current = $derived(controller?.current ?? null);
	const hasGuide = $derived((controller?.guides.length ?? 0) > 0);
	const guide = $derived(controller?.currentGuide ?? null);
	const stops = $derived(controller?.guideStops ?? []);
	/** The Guide's pacing (sheet §31): edited on the Guide Card, shown here. */
	const pacing = $derived((guide ?? controller?.contextGuide)?.pacing ?? 'automatic');
	const presentations = $derived(current?.presentations ?? []);
	const busy = $derived(controller?.busy ?? false);
	const subject = $derived(controller?.subject ?? null);
	const subjectStopId = $derived(
		subject !== null && (subject.kind === 'stop' || subject.kind === 'transition') ? subject.stopId : null
	);
	const selectedStopId = $derived(
		subjectStopId !== null && stops.some((stop) => stop.id === subjectStopId) ? subjectStopId : null
	);
	let compact = $state(false);
	let menuOpen = $state(false);
	let menuWrap = $state<HTMLElement | null>(null);
	let addButton = $state<HTMLButtonElement | null>(null);
	let scrollerEl = $state<HTMLElement | null>(null);
	let rowEl = $state<HTMLElement | null>(null);
	let barEl = $state<HTMLElement | null>(null);
	/** Cards the pointer has focused last, so the roving tab stop survives a cleared selection. */
	let focusedStopId = $state<string | null>(null);
	let renaming = $state(false);
	let renameValue = $state('');
	let renameInput = $state<HTMLInputElement | null>(null);
	let nameButton = $state<HTMLButtonElement | null>(null);
	let guideMenuOpen = $state(false);
	let guideMenuWrap = $state<HTMLElement | null>(null);
	let guideMenuButton = $state<HTMLButtonElement | null>(null);
	let pacingOpen = $state(false);
	let pacingWrap = $state<HTMLElement | null>(null);
	let pacingButton = $state<HTMLButtonElement | null>(null);

	// ---- R217.S30: the Stage owns the one ephemeral playback session ----

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
	/** Each hold is one View's span; its own label/time stays readable on the bar. */
	const timelineSegments = $derived.by(() => {
		const map = playback.map;
		if (map === null) return [];
		// Each drawn hold is one View's span. A Stop's first drawn hold carries its
		// number at the segment start; travel links carry none.
		const numbered = new Set<string>();
		return map.segments
			.filter((segment) => segment.durationSeconds > 0)
			.map((segment) => {
				const index = stops.findIndex((stop) => stop.id === segment.stopId);
				const first = segment.kind === 'hold' && index >= 0 && !numbered.has(segment.stopId);
				if (first) numbered.add(segment.stopId);
				return {
					id: segment.id,
					kind: segment.kind,
					viewId: segment.viewId,
					number: first ? index + 1 : null,
					label: segment.kind === 'hold' ? `View ${segment.viewId} · ${formatGuideTime(segment.durationSeconds)}` : `${segment.kind} · ${formatGuideTime(segment.durationSeconds)}`,
					left: map.totalSeconds <= 0 ? 0 : (segment.startSeconds / map.totalSeconds) * 100,
					width: map.totalSeconds <= 0 ? 100 : (segment.durationSeconds / map.totalSeconds) * 100,
					active:
						playback.activeStopId === segment.stopId &&
						(playback.status === 'playing' || playback.status === 'waiting')
				};
			});
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

	function playPause(): void {
		playback.playPause();
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

	/**
	 * The card or Travel gutter under the pointer, with the pointer's fraction
	 * across it. Between lanes (a Cut gutter) it snaps to the nearer edge.
	 */
	function laneAt(clientX: number): { id: string; localFraction: number } | null {
		if (rowEl === null) return null;
		let best: { id: string; localFraction: number; distance: number } | null = null;
		for (const element of rowEl.querySelectorAll<HTMLElement>('[data-track-id]')) {
			const id = element.dataset.trackId ?? '';
			const rect = element.getBoundingClientRect();
			if (id === '' || rect.width <= 0) continue;
			const localFraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
			const distance = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
			if (best === null || distance < best.distance) best = { id, localFraction, distance };
		}
		return best === null ? null : { id: best.id, localFraction: best.localFraction };
	}

	function scrubAt(clientX: number): void {
		const map = playback.map;
		if (barEl === null || map === null) return;
		const rect = (rowEl ?? barEl).getBoundingClientRect();
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
		// The single track is the card row: each card and Travel gutter maps its own
		// span under the pointer, so a 4 s card and a 12 s card scrub at their own rates.
		const located = laneAt(clientX);
		if (located !== null) {
			const [kind, stopId] = located.id.split(':');
			const span = stopId === undefined ? null : kind === 'travel' ? gutterTravel(stopId) : staySpan(stopId);
			if (span !== null) {
				playback.seek(span.start + located.localFraction * (span.end - span.start));
				return;
			}
		}
		playback.seek(fraction * map.totalSeconds);
	}

	let scrubbing = false;
	let scrubTip = $state<{ x: number; text: string } | null>(null);
	function tipAt(clientX: number): void {
		const map = playback.map;
		if (!scrubbing || barEl === null || map === null) return;
		const at = elapsedSeconds ?? 0;
		const index = stops.findIndex((stop) => {
			const span = staySpan(stop.id);
			const travel = gutterTravel(stop.id);
			return span !== null && at < (travel?.end ?? span.end);
		});
		const number = index < 0 ? stops.length : index + 1;
		const stop = stops[number - 1];
		const name = stop === undefined || controller === null ? '' : ` · ${controller.presentationLabel(stop.presentationId)}`;
		const rect = barEl.getBoundingClientRect();
		scrubTip = { x: Math.max(0, Math.min(rect.width, clientX - rect.left)), text: `${playback.elapsedLabel} · Stop ${number}${name}` };
	}
	function onTrackPointerDown(event: PointerEvent): void {
		if (!canPlay) return;
		scrubbing = true;
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
		scrubAt(event.clientX);
		void tick().then(() => tipAt(event.clientX));
	}
	function onTrackPointerMove(event: PointerEvent): void {
		if (!scrubbing) return;
		scrubAt(event.clientX);
		void tick().then(() => tipAt(event.clientX));
	}
	function onTrackPointerUp(event: PointerEvent): void {
		if (!scrubbing) return;
		scrubbing = false;
		scrubTip = null;
		(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
	}

	function onBarKeydown(event: KeyboardEvent): void {
		const map = playback.map;
		if (map === null) return;
		if (event.key === ' ' || event.key === 'Spacebar') {
			event.preventDefault();
			playPause();
			return;
		}
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
		const step = event.shiftKey ? 5 : 1;
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();
			playback.seek(elapsed + (event.key === 'ArrowLeft' ? -step : step));
		} else if (event.key === 'PageUp' || event.key === 'PageDown') {
			event.preventDefault();
			playback.seek(elapsed + (event.key === 'PageUp' ? -10 : 10));
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
		/** Views to explore beyond the entry (+N on the card). */
		readonly more: number;
		/** ✦: the Stop invites exploring. */
		readonly invites: boolean;
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
			const presentation = controller.current?.presentations.find((entry) => entry.id === stop.presentationId);
			const viewId = stop.entryViewId ?? presentation?.views[0]?.viewId ?? null;
			// Sheet §33 A: a Presentation visited more than once names its entry View on
			// every visit (Pleyel piano · From the window), so the visits stay distinct.
			const repeated = stops.filter((other) => other.presentationId === stop.presentationId).length > 1;
			const viewName = viewId === null ? null : (controller.viewsOf?.get(stop.presentationId)?.find((view) => view.id === viewId)?.label ?? null);
			const label = repeated && viewName !== null
				? `${controller.presentationLabel(stop.presentationId)} · ${viewName}`
				: controller.presentationLabel(stop.presentationId);
			const more = Math.max(0, (presentation?.views.length ?? 1) - 1);
			const invites = stop.invitation !== null;
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
				const seconds = path?.state === 'ready' ? formatPathSeconds(path.seconds) : null;
				const nameSeconds = seconds === null ? '' : ` · ${seconds}`;
				const attention = gap ? '. Travel has no Camera connection yet' : '';
				connector = {
					shape: resolved.kind,
					// The gutter is 38 px: an adjacent link is drawn as its glyph, a jump
					// names its Stop, and a Travel's seconds live in the accessible name.
					text:
						resolved.kind === 'adjacent'
							? resolved.transition === 'travel'
								? `↗ ${seconds ?? ''}`.trim()
								: resolved.transition
							: resolved.position === null
								? '→'
								: `→ ${resolved.position}`,
				name: `Stop ${number} continues to ${target} by ${transitionWord(resolved.transition)}${resolved.transition === 'travel' ? nameSeconds : ''}${attention}`,
					transition: resolved.transition,
					gap
				};
			}
			const spoken = [`Stop ${number}`, label];
			if (invites) spoken.push('invites exploring');
			if (more > 0) spoken.push(`${more} more ${more === 1 ? 'view' : 'views'} to explore`);
			if (pacing === 'manual') spoken.push('waits for Next');
			return { stopId: stop.id, viewId, number, label, more, invites, name: spoken.join(', '), connector };
		});
	});

	/** The roving tab stop: the selected card, else the last focused one, else the first. */
	const rovingStopId = $derived(
		selectedStopId ?? (stops.some((stop) => stop.id === focusedStopId) ? focusedStopId : (stops[0]?.id ?? null))
	);

	const addReason = $derived.by((): string | null => {
		if (busy) return 'Saving the last change';
		if (presentations.length === 0) return 'Add a Presentation first';
		return null;
	});

	function inGuide(presentationId: string): boolean {
		return stops.some((stop) => stop.presentationId === presentationId);
	}

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

	async function chooseFromMenu(presentationId: string): Promise<void> {
		closeMenu();
		await addStop(presentationId);
	}

	// ---- Slice 5: rename, Guide actions and the pacing popover ----

	async function startRename(): Promise<void> {
		if (guide === null) return;
		guideMenuOpen = false;
		renameValue = guide.label;
		renaming = true;
		await tick();
		renameInput?.focus();
		renameInput?.select();
	}

	async function commitRename(): Promise<void> {
		if (!renaming) return;
		renaming = false;
		if (guide === null || renameValue.trim() === '') {
			await tick();
			nameButton?.focus();
			return;
		}
		await controller?.renameGuide(guide.id, renameValue);
		await tick();
		nameButton?.focus();
	}

	function cancelRename(): void {
		renaming = false;
		renameValue = '';
		void tick().then(() => nameButton?.focus());
	}

	function onRenameKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			void commitRename();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			cancelRename();
		}
	}

	function toggleGuideMenu(): void {
		guideMenuOpen = !guideMenuOpen;
		if (!guideMenuOpen) return;
		void tick().then(() => guideMenuWrap?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
	}

	function closeGuideMenu(): void {
		guideMenuOpen = false;
		guideMenuButton?.focus();
	}

	async function removeCurrentGuide(): Promise<void> {
		if (guide === null) return;
		guideMenuOpen = false;
		await controller?.remove({ kind: 'guide', guideId: guide.id });
	}

	function onGuideMenuKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.stopPropagation();
			closeGuideMenu();
			return;
		}
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		const items = [...(guideMenuWrap?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
		const at = items.indexOf(document.activeElement as HTMLElement);
		items[event.key === 'ArrowDown' ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1)]?.focus();
	}

	async function choosePacing(next: 'automatic' | 'manual'): Promise<void> {
		if (guide === null) return;
		pacingOpen = false;
		await controller?.setGuidePacing(guide.id, next);
		pacingButton?.focus();
	}

	function onPacingKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.stopPropagation();
			pacingOpen = false;
			pacingButton?.focus();
			return;
		}
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		const items = [...(pacingWrap?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
		const at = items.indexOf(document.activeElement as HTMLElement);
		items[event.key === 'ArrowDown' ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1)]?.focus();
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
		if (guideMenuOpen && guideMenuWrap !== null && !guideMenuWrap.contains(event.target as Node)) guideMenuOpen = false;
		if (pacingOpen && pacingWrap !== null && !pacingWrap.contains(event.target as Node)) pacingOpen = false;
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
		const els = cardEls();
		if (scroller !== null) {
			const left = scroller.scrollLeft > 2;
			const right = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2;
			if (left !== more.left || right !== more.right) more = { left, right };
		}
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
					{#if renaming}
						<input
							class="name-input rename-input"
							type="text"
							aria-label="Guide name"
							bind:value={renameValue}
							bind:this={renameInput}
							onkeydown={onRenameKeydown}
							onblur={() => void commitRename()}
						/>
					{:else}
						<button
							type="button"
							class="guide-name"
							title="Rename this Guide"
							bind:this={nameButton}
							onclick={() => void startRename()}
						>
							{guide.label}
						</button>
					{/if}
				{:else}
					<span class="guide-name plain">Guide</span>
				{/if}
				<span class="count">{stops.length} {stops.length === 1 ? 'stop' : 'stops'}</span>
				{#if guide !== null}
					<span class="pacing-wrap" bind:this={pacingWrap}>
						<button
							type="button"
							class="pacing-label"
							data-pacing-label={pacing}
							bind:this={pacingButton}
							aria-haspopup="menu"
							aria-expanded={pacingOpen}
							title="Pacing"
							onclick={() => (pacingOpen = !pacingOpen)}
						>{pacing === 'manual' ? 'Manual · waits for Next' : 'Automatic'} ›</button
						>
						{#if pacingOpen}
							<div class="pacing-menu" role="menu" tabindex="-1" aria-label="Pacing" onkeydown={onPacingKeydown}>
								<button
									type="button"
									role="menuitemradio"
									aria-checked={pacing === 'automatic'}
									onclick={() => void choosePacing('automatic')}>Automatic</button
								>
								<button
									type="button"
									role="menuitemradio"
									aria-checked={pacing === 'manual'}
									onclick={() => void choosePacing('manual')}>Manual · waits for Next</button
								>
							</div>
						{/if}
					</span>
					<span class="guide-menu-wrap" bind:this={guideMenuWrap}>
						<button
							type="button"
							class="icon"
							bind:this={guideMenuButton}
							aria-label="Guide actions"
							aria-haspopup="menu"
							aria-expanded={guideMenuOpen}
							title="Guide actions"
							onclick={toggleGuideMenu}
						>⋯</button
						>
						{#if guideMenuOpen}
							<div class="menu guide-menu" role="menu" tabindex="-1" aria-label="Guide actions" onkeydown={onGuideMenuKeydown}>
								<button type="button" role="menuitem" class="menu-item danger" onclick={() => void removeCurrentGuide()}>Remove Guide</button>
							</div>
						{/if}
					</span>
				{/if}
			{/if}
			<span class="spacer"></span>
			{#if stops.length > 0}
				<span class="transport-cluster">
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
					<span class="total" data-playback-total>
						{playback.elapsedLabel} / {playback.totalLabel}{#if playback.map !== null && playback.map.waitCount > 0}<span class="waits">{playback.map.waitCount === 1 ? '+ 1 wait' : `+ ${playback.map.waitCount} waits`}</span>{/if}
					</span>
				</span>
			{/if}
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
								<span class="menu-label">{controller.presentationLabel(presentation.id)}</span>
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
				<p>Choose <b>+ Stop</b>, or drag a Presentation or View here from the Index.</p>
			</div>
		{:else}
			{#if !compact}
				<div class="cards-wrap">
				{#if more.left}
					<button type="button" class="more-arrow left" aria-label="Earlier Stops" title="Earlier Stops" onclick={() => pageCards(-1)}><span aria-hidden="true">‹</span></button>
				{/if}
				<div class="cards" bind:this={scrollerEl} onscroll={measureView} onwheel={onCardsWheel}>
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
								data-track-id={`hold:${card.stopId}`}
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
								<span class="stop-text">
									<span class="stop-name" title={card.label}>{card.label}</span>
									<span class="stop-meta">
										{#if card.invites}<span class="badge invite" title="Invites exploring" data-invite-badge>✦</span>{/if}
										{#if card.more > 0}<span class="badge more" title={`${card.more} more ${card.more === 1 ? 'View' : 'Views'} to explore`}>+{card.more}</span>{/if}
									</span>
								</span>
								<!-- Review round 3 (sheet §25): each Stop card carries its own part of the timeline. -->
								<span class="stop-progress" data-view-span={card.viewId ?? undefined} aria-hidden="true"
									><i style:width="{stopProgress(card.stopId)}%"></i>{#if playheadLane?.id === `hold:${card.stopId}`}<b class="knob" style:left="{playheadLane.pct}%"></b>{/if}</span
								>
							</button>
							<span
								class="slot"
								class:adjacent={card.connector?.shape === 'adjacent'}
								data-track-id={card.connector?.transition === 'travel' ? `travel:${card.stopId}` : undefined}
							>
								{#if card.connector !== null && card.connector.shape !== 'end'}
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
										{#if connector.shape !== 'adjacent'}
											{connector.text}
										{:else if connector.gap}
											<span aria-hidden="true">⚠</span>
										{:else if connector.transition === 'travel'}
											<span class="gutter-time">{connector.text}</span>
										{:else}
											<svg class="glyph" viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M1 4h10" stroke-dasharray="0.1 2.3" /></svg>
										{/if}
									</button>
									{#if connector.transition === 'travel'}
										<span class="slot-progress" aria-hidden="true"
											><i style:width="{travelProgress(card.stopId)}%"></i>{#if playheadLane?.id === `travel:${card.stopId}`}<b class="knob" style:left="{playheadLane.pct}%"></b>{/if}</span
										>
									{:else if connector.transition === 'cut'}
										<span class="slot-cut" aria-hidden="true"></span>
									{/if}
								{/if}
							</span>
						{/each}
						{#if caretPx !== null}
							<span class="caret" style:left="{caretPx}px" aria-hidden="true"></span>
						{/if}
					</div>
				</div>
				<div
					class="track-hit"
					bind:this={barEl}
					role="slider"
					data-playback-timeline
					tabindex={canPlay ? 0 : -1}
					aria-label="Guide timeline"
					aria-valuemin={0}
					aria-valuemax={Math.round(playback.map?.totalSeconds ?? 0)}
					aria-valuenow={Math.round((playback.map?.totalSeconds ?? 0) * (playheadPct / 100))}
					aria-valuetext={`${playback.elapsedLabel} of ${playback.totalLabel}${playback.map === null ? '' : playback.map.waitCount === 0 ? '' : ` ${playback.map.waitCount === 1 ? '+ 1 wait' : `+ ${playback.map.waitCount} waits`}`}`}
					aria-disabled={!canPlay}
					onpointerdown={onTrackPointerDown}
					onpointermove={onTrackPointerMove}
					onpointerup={onTrackPointerUp}
					onpointercancel={onTrackPointerUp}
					onkeydown={onBarKeydown}
				></div>
				{#if scrubTip !== null}
					<span class="scrub-tip" style:left="{scrubTip.x}px" role="status">{scrubTip.text}</span>
				{/if}
				{#if more.right}
					<button type="button" class="more-arrow right" aria-label="Later Stops" title="Later Stops" onclick={() => pageCards(1)}><span aria-hidden="true">›</span></button>
				{/if}
				</div>
			{/if}

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
	.pacing-label {
		min-height: 24px;
		padding: 0 8px;
		border: 1px solid rgb(255 255 255 / 28%);
		border-radius: 999px;
		background: none;
		color: inherit;
		font: 500 11px var(--shell-sans, system-ui);
		white-space: nowrap;
		cursor: pointer;
	}
	.pacing-label:hover {
		background: rgb(255 255 255 / 10%);
	}
	.badge {
		margin-left: 4px;
		color: var(--shell-ink-3, #6b736d);
		font-size: 10.5px;
		font-weight: 600;
	}
	.badge.invite {
		color: var(--shell-leaf-soft, #9fd3b6);
	}
	.status {
		margin: 0;
		color: var(--shell-ink-quiet, #9fb2a5);
		font-size: var(--shell-text-utility, 12px);
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
		font: var(--shell-text-identity, 15px) var(--shell-serif, Georgia, serif);
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
		font: var(--shell-text-identity, 15px) var(--shell-serif, Georgia, serif);
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
		font-size: var(--shell-text-utility, 12px);
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
		outline: 2px solid var(--shell-leaf-soft, #9fd3b6);
		outline-offset: 1px;
		box-shadow: none;
	}
	.guide ::selection {
		background: color-mix(in srgb, var(--shell-leaf-soft, #9fd3b6) 38%, transparent);
		color: inherit;
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

	/* ---- Stop cards and connectors ---- */
	/* Review round 3 (sheet §25): no visible scrollbar; trackpad, touch and wheel still
	   scroll, and arrows over a fade appear only on a side that has more Stops. */
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
		color: #fff;
		cursor: pointer;
	}
	.more-arrow.left {
		left: 0;
		justify-content: flex-start;
		background: linear-gradient(90deg, rgb(17 41 31) 35%, rgb(17 41 31 / 0));
	}
	.more-arrow.right {
		right: 0;
		justify-content: flex-end;
		background: linear-gradient(270deg, rgb(17 41 31) 35%, rgb(17 41 31 / 0));
	}
	.more-arrow span {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border: 1px solid #3c5e4f;
		border-radius: 50%;
		background: #1a3a2d;
		font-size: 15px;
		line-height: 1;
	}
	.more-arrow:hover span { background: #25483a; }
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
	/* Review round 3 (sheet §25): a wide row card, the picture beside the title and time. */
	.stop-card {
		position: relative;
		flex: none;
		display: grid;
		grid-template-columns: 62px minmax(0, 1fr);
		align-items: center;
		gap: 8px;
		width: 176px;
		min-height: 50px;
		padding: 5px 5px 7px;
		border: 2px solid transparent;
		border-radius: 8px;
		background: #16352a;
		color: var(--shell-ink-light, #eef1ec);
		font: inherit;
		text-align: left;
		cursor: pointer;
		user-select: none;
	}
	.stop-card:hover {
		background: #1d4033;
	}
	.stop-card.selected {
		border-color: var(--shell-gold, #d4ad45);
		background: #234b3a;
	}
	.stop-card.dragging {
		position: relative;
		z-index: 2;
		cursor: grabbing;
		opacity: 0.92;
		box-shadow: 0 8px 20px rgb(0 0 0 / 0.35);
	}
	.stop-card :global(.snapshot.stop) {
		width: 62px;
		height: 40px;
	}
	.stop-text {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.stop-name {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font: 12.5px/1.2 var(--shell-serif, Georgia, serif);
	}
	.stop-meta {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		line-height: 1.35;
		color: #b9cbbf;
		font-size: 10.5px;
		font-variant-numeric: tabular-nums;
	}
	/* One track (sheet §33 A): each card's rail is its stay, each Travel gutter its Travel. */
	.stop-progress,
	.slot-progress {
		position: absolute;
		bottom: 3px;
		height: 3px;
		border-radius: 2px;
		background: rgb(255 255 255 / 0.14);
		pointer-events: none;
	}
	.stop-progress {
		left: 6px;
		right: 6px;
	}
	.slot-progress {
		left: 0;
		right: 0;
		border-radius: 0;
	}
	.stop-progress i,
	.slot-progress i {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		border-radius: inherit;
		background: var(--shell-gold, #d4ad45);
	}
	/* A Cut takes no time: a dotted hairline the playhead jumps over. */
	.slot-cut {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 4px;
		border-top: 1px dotted rgb(255 255 255 / 0.3);
		pointer-events: none;
	}
	.knob {
		position: absolute;
		top: 50%;
		z-index: 1;
		width: 10px;
		height: 10px;
		margin: -5px 0 0 -5px;
		border: 2px solid var(--shell-forest, #11291f);
		border-radius: 50%;
		background: var(--shell-gold, #d4ad45);
	}
	.knob::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 6px;
		width: 2px;
		height: 12px;
		margin-left: -1px;
		border-radius: 1px;
		background: var(--shell-gold, #d4ad45);
	}
	.scrub-tip {
		position: absolute;
		bottom: 16px;
		z-index: 4;
		transform: translateX(-50%);
		padding: 3px 7px;
		border-radius: 6px;
		background: #fff;
		color: var(--shell-forest, #11291f);
		font: 500 11px var(--shell-sans, system-ui, sans-serif);
		white-space: nowrap;
		pointer-events: none;
		box-shadow: 0 4px 12px rgb(0 0 0 / 0.3);
	}
	.slot {
		position: relative;
		flex: 0 0 58px;
		width: 58px;
		display: grid;
		place-items: center;
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
	/* The link lives in the fixed gutter: a glyph pill, never wider than the 38 px slot. */
	.chip {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 18px;
		min-width: 24px;
		max-width: 56px;
		padding: 0 5px;
		border: 1px solid transparent;
		border-radius: 999px;
		background: color-mix(in srgb, #fff 10%, var(--shell-forest, #11291f));
		color: var(--shell-ink-light, #eef1ec);
		font: 600 10px/1 var(--shell-mono, ui-monospace, monospace);
		white-space: nowrap;
		overflow: hidden;
		cursor: pointer;
	}
	.chip .glyph {
		display: block;
		width: 12px;
		height: 8px;
	}
	/* Cut is a dotted line; Travel is a solid arrow on the leaf green. */
	.chip.cut {
		border: 1px dashed rgb(255 255 255 / 0.4);
		background: transparent;
	}
	.chip.travel {
		background: var(--shell-gold, #d4ad45);
		color: var(--shell-forest, #11291f);
	}
	.chip.jump,
	.chip.end {
		border: 1px solid rgb(255 255 255 / 0.22);
	}
	.chip.gap {
		border: 1px dashed var(--shell-caution, #c85a48);
		background: transparent;
		color: color-mix(in srgb, var(--shell-caution, #c85a48) 35%, #fff);
	}
	/* A selected transition: gold, ringed in ivory (owner review, 5 Nov). */
	.chip.selected {
		background: var(--shell-gold, #d4ad45);
		color: var(--shell-forest, #11291f);
		box-shadow: 0 0 0 2px var(--shell-ivory, #f3f0e4);
	}
	.caret {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 3px;
		margin-left: -1.5px;
		border-radius: 2px;
		background: var(--shell-leaf-soft, #9fd3b6);
		pointer-events: none;
	}

	/* ---- R217.S30: time timeline ---- */
	.transport-cluster {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex: none;
	}
	.tool.on {
		background: color-mix(in srgb, var(--shell-leaf-soft, #9fd3b6) 38%, transparent);
		color: #fff;
	}
	/* A travel is a solid link with a chevron. */
	/* The Stop number sits at the start of the Stop's first hold. */
	.total {
		flex: none;
		color: var(--shell-ink-light, #eef1ec);
		font: 500 11px/1.2 var(--shell-mono, ui-monospace, monospace);
		white-space: nowrap;
	}
	.total .waits {
		margin-left: 4px;
		color: var(--shell-leaf-soft, #9fd3b6);
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
		background: var(--shell-leaf-soft, #9fd3b6);
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
	.play {
		display: grid;
		place-items: center;
		flex: none;
		width: 26px;
		height: 26px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: var(--shell-ivory, #f3f0e4);
		color: var(--shell-forest, #11291f);
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
			min-height: 44px;
			min-height: var(--shell-touch-target, 44px);
		}
		.icon,
		.play {
			width: 44px;
			min-width: var(--shell-touch-target, 44px);
		}
		/* The coarse hit area is 44 px; the visual track stays 8 px. */
	}

	.gutter-time {
		font-size: 9px;
		letter-spacing: -0.01em;
	}
	.track-hit {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 14px;
		z-index: 2;
		cursor: pointer;
		touch-action: none;
	}
	.track-hit:focus-visible {
		outline: 2px solid var(--shell-leaf-soft, #9fd3b6);
		outline-offset: 2px;
		border-radius: 4px;
	}
	.pacing-wrap,
	.guide-menu-wrap {
		position: relative;
		display: inline-flex;
	}
	.pacing-menu,
	.guide-menu {
		position: absolute;
		right: 0;
		bottom: calc(100% + 8px);
		z-index: 6;
		display: flex;
		flex-direction: column;
		min-width: 190px;
		padding: 4px;
		border: 1px solid rgb(255 255 255 / 0.1);
		border-radius: 10px;
		background: var(--shell-popup-dark, rgba(17, 41, 31, 0.97));
		box-shadow: 0 10px 28px rgb(0 0 0 / 0.32);
	}
	.pacing-menu button {
		padding: 6px 8px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: var(--shell-text-utility, 12px);
		text-align: left;
		cursor: pointer;
	}
	.pacing-menu button:hover,
	.pacing-menu button:focus-visible {
		background: rgb(255 255 255 / 0.1);
	}
	.pacing-menu button[aria-checked='true'] {
		color: var(--shell-leaf-soft, #9fd3b6);
	}
	.menu-item.danger {
		color: #f0a99e;
	}
</style>
