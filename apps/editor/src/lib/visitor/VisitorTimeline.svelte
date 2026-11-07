<script lang="ts">
	import { guideTimeCursorAt, formatGuideTime, type GuideTimeMap, type GuideTimeCursor } from '@portfolio/camera-core';
	import type { VisitorRuntimeState } from './visitor-runtime-state.svelte';
	import type { VisitorProgress } from './visitor-progress';

	let { map, visitor, progress, interactive = false }: {
		map: GuideTimeMap;
		visitor: VisitorRuntimeState;
		progress: VisitorProgress;
		interactive?: boolean;
	} = $props();
	const segments = $derived(map.segments.filter((segment, index) => index > 0 || segment.kind !== 'cut'));
	function fillFor(segment: GuideTimeMap['segments'][number]): number {
		const stop = progress.segments.find((entry) => entry.stopId === segment.stopId);
		return segment.kind === 'travel' ? stop?.travelFill ?? 0 : stop?.fill ?? 0;
	}
	const current = $derived(segments.find((segment) => segment.stopId === visitor.state.stopId &&
		(visitor.traveling ? segment.kind === 'travel' : segment.kind === 'hold' || segment.kind === 'wait')));
	const seconds = $derived(current ? current.startSeconds + current.durationSeconds * fillFor(current) : 0);
	let pointer: number | null = null;
	let resumeAfterDrag = false;

	function seek(cursor: GuideTimeCursor): void {
		visitor.seek(map, cursor);
	}
	function seekAt(event: PointerEvent): void {
		const host = event.currentTarget as HTMLElement;
		const entries = [...host.querySelectorAll<HTMLElement>('[data-time-segment]')];
		let nearest: HTMLElement | null = null;
		let distance = Infinity;
		for (const entry of entries) {
			const box = entry.getBoundingClientRect();
			const d = Math.max(box.left - event.clientX, event.clientX - box.right, 0);
			if (d < distance) { nearest = entry; distance = d; }
		}
		const segment = segments.find((entry) => entry.id === nearest?.dataset.timeSegment);
		if (!nearest || !segment) return;
		const box = nearest.getBoundingClientRect();
		const fraction = Math.max(0, Math.min(1, (event.clientX - box.left) / (box.width || 1)));
		seek({ segmentId: segment.id, elapsedSeconds: segment.durationSeconds * fraction });
	}
	function down(event: PointerEvent): void {
		if (!interactive || event.button !== 0 || pointer !== null) return;
		event.preventDefault();
		const host = event.currentTarget as HTMLElement;
		host.focus();
		pointer = event.pointerId;
		resumeAfterDrag = !visitor.paused && (visitor.pacing === 'automatic' || visitor.traveling);
		host.setPointerCapture(event.pointerId);
		seekAt(event);
	}
	function move(event: PointerEvent): void {
		if (pointer === event.pointerId) seekAt(event);
	}
	function up(event: PointerEvent): void {
		if (pointer !== event.pointerId) return;
		pointer = null;
		if (resumeAfterDrag) visitor.play();
	}
	function keydown(event: KeyboardEvent): void {
		if (!interactive || event.altKey || event.ctrlKey || event.metaKey) return;
		const step = event.shiftKey ? 5 : 1;
		let target: GuideTimeCursor;
		if (event.key === 'Home') target = { segmentId: segments[0]!.id, elapsedSeconds: 0 };
		else if (event.key === 'End') target = { segmentId: segments.at(-1)!.id, elapsedSeconds: segments.at(-1)!.durationSeconds };
		else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			if (visitor.pacing === 'manual') {
				const at = segments.findIndex((segment) => segment.id === current?.id);
				const segment = segments[Math.max(0, Math.min(segments.length - 1, at + (event.key === 'ArrowRight' ? 1 : -1)))]!;
				target = { segmentId: segment.id, elapsedSeconds: 0 };
			} else target = guideTimeCursorAt(map, seconds + (event.key === 'ArrowRight' ? step : -step));
		} else if (event.key === ' ') {
			event.preventDefault();
			visitor.togglePause();
			return;
		} else return;
		event.preventDefault();
		event.stopPropagation();
		seek(target);
	}
</script>

{#snippet track()}

	{#each segments as segment (segment.id)}
		<span class="segment {segment.kind}" class:current={current?.id === segment.id}
			data-time-segment={segment.id} data-progress-stop={segment.kind === 'hold' || segment.kind === 'wait' ? segment.stopId : undefined}
			style={`--seconds:${segment.durationSeconds};--fill:${fillFor(segment)}`}
			title={`${progress.segments.find((entry) => entry.stopId === segment.stopId)?.label ?? ''} · ${segment.kind === 'travel' ? 'Travel' : segment.kind === 'wait' ? 'Until Next' : 'Stay'}${segment.durationSeconds ? ` · ${segment.durationSeconds} s` : ''}`}>
			<i></i>
		</span>
	{/each}
{/snippet}

{#if interactive}
	<div class="timeline interactive" class:frozen={visitor.paused} role="slider" tabindex="0"
		aria-label="Tour timeline" aria-valuemin={0} aria-valuemax={map.totalSeconds} aria-valuenow={seconds}
		aria-valuetext={`${formatGuideTime(seconds)} of ${formatGuideTime(map.totalSeconds)}${visitor.pacing === 'manual' ? ', waits for Next' : ''}`}
		onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onkeydown={keydown}>
		{@render track()}
	</div>
{:else}
	<div class="timeline" class:frozen={visitor.paused} role="progressbar" aria-label="Tour progress"
		aria-valuemin={0} aria-valuemax={map.totalSeconds} aria-valuenow={seconds}>
		{@render track()}
	</div>
{/if}

<style>
	.timeline { display: flex; align-items: center; height: 16px; gap: 2px; }
	.timeline.interactive { cursor: ew-resize; touch-action: none; }
	.timeline.frozen { opacity: .65; }
	.timeline:focus-visible { outline: 2px solid #9fd0b2; outline-offset: 3px; border-radius: 3px; }
	.segment { position: relative; flex: var(--seconds) 1 0; min-width: 2px; height: 4px; overflow: hidden; border-radius: 2px; background: rgb(243 240 228 / 20%); }
	.segment.travel { height: 2px; }
	.segment.cut { flex: 0 0 1px; background: transparent; }
	.segment.wait { flex: 0 0 14px; background: transparent; box-shadow: inset 0 0 0 1px rgb(243 240 228 / 75%); }
	.segment i { position: absolute; inset: 0 auto 0 0; width: calc(100% * var(--fill)); background: rgb(243 240 228 / 85%); }
	.segment.current i { background: #cfe9d8; }
</style>
