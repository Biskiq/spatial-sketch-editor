<script lang="ts">
	import { tick } from 'svelte';
	import type { ExperiencePlayback } from './playback.svelte';
	import { resolveWaitScrub } from './timeline-scrub';

	let {
		playback,
		row,
		stops,
		staySpan,
		gutterTravel,
		elapsedSeconds,
		presentationLabel,
		barEl = $bindable()
	}: {
		playback: ExperiencePlayback;
		row: HTMLElement | null;
		stops: readonly { readonly id: string; readonly presentationId: string }[];
		staySpan: (stopId: string) => { start: number; end: number } | null;
		gutterTravel: (stopId: string) => { start: number; end: number } | null;
		elapsedSeconds: number | null;
		presentationLabel: (presentationId: string) => string;
		barEl: HTMLElement | null;
	} = $props();

	const canPlay = $derived(playback.map !== null);
	const playheadPct = $derived.by(() => {
		const map = playback.map;
		const cursor = playback.cursor;
		if (map === null || cursor === null) return 0;
		if (map.totalSeconds <= 0) {
			const index = map.segments.findIndex((entry) => entry.id === cursor.segmentId);
			return map.segments.length <= 1 ? 0 : (Math.max(0, index) / (map.segments.length - 1)) * 100;
		}
		const segment = map.segments.find((entry) => entry.id === cursor.segmentId);
		return segment === undefined ? 0 : ((segment.startSeconds + cursor.elapsedSeconds) / map.totalSeconds) * 100;
	});
	const followPosition = $derived(
		playback.activeStopId === null ? null : stops.findIndex((stop) => stop.id === playback.activeStopId) + 1
	);
	const timelineWaits = $derived.by(() => {
		const map = playback.map;
		if (map === null) return [];
		const waits = map.segments.filter((segment) => segment.kind === 'wait');
		if (map.totalSeconds <= 0) {
			return waits.map((segment, index) => ({ id: segment.id, left: waits.length <= 1 ? 0 : (index / (waits.length - 1)) * 100 }));
		}
		return waits.map((segment) => ({ id: segment.id, left: (segment.startSeconds / map.totalSeconds) * 100 }));
	});

	function laneAt(clientX: number): { id: string; localFraction: number } | null {
		if (row === null) return null;
		let best: { id: string; localFraction: number; distance: number } | null = null;
		for (const element of row.querySelectorAll<HTMLElement>('[data-track-id]')) {
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
		const rect = (row ?? barEl).getBoundingClientRect();
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
		const name = stop === undefined ? '' : ` · ${presentationLabel(stop.presentationId)}`;
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
			playback.playPause();
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
		if (!playback) return;
		if (event.defaultPrevented) return;
		if (event.key !== 'Escape' || !playback.following) return;
		event.preventDefault();
		playback.setFollow(false);
	}
</script>
<svelte:window onkeydown={onWindowKeydown} />

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

{#if playback.following}
	<div class="follow-pill" role="status">
		<span class="live-dot" aria-hidden="true"></span>
		<span>Following the camera{followPosition === null || followPosition <= 0 ? '' : ` · travelling to Stop ${followPosition}`}</span>
		<button type="button" class="pill-stop" onclick={() => playback.setFollow(false)}>Stop following <span class="kbd">Esc</span></button>
	</div>
{/if}

<style>
	.scrub-tip {
		position: absolute;
		bottom: 16px;
		z-index: 4;
		transform: translateX(-50%);
		padding: 3px 7px;
		border-radius: 6px;
		background: var(--shell-surface-raised);
		color: var(--shell-forest);
		font: 500 var(--shell-text-label) var(--shell-sans);
		white-space: nowrap;
		pointer-events: none;
		box-shadow: 0 4px 12px rgb(0 0 0 / 0.3);
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
		background: var(--shell-glass-dark);
		color: var(--shell-ink-light);
		font: var(--shell-text-control) var(--shell-sans);
		white-space: nowrap;
		z-index: 4;
	}
	.live-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--shell-leaf-soft);
	}
	.pill-stop {
		height: 28px;
		padding: 0 10px;
		border: 0;
		border-radius: 14px;
		background: var(--shell-on-forest-wash-strong);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.kbd {
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-label);
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
		outline: 2px solid var(--shell-leaf-soft);
		outline-offset: 2px;
		border-radius: 4px;
	}
	:global(.guide) button:focus-visible {
		outline: 2px solid var(--shell-leaf-soft);
		outline-offset: 1px;
		box-shadow: none;
	}
	@media (pointer: coarse) {
		.pill-stop { min-height: 44px; min-height: var(--shell-touch-target); }
	}
</style>