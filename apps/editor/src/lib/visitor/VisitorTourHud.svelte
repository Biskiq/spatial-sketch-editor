<script lang="ts">
	import type { VisitorRuntimeState } from './visitor-runtime-state.svelte';
	import type { VisitorProgress } from './visitor-progress';
		import VisitorTimeline from './VisitorTimeline.svelte';
	import type { GuideTimeCursor, GuideTimeMap } from '@portfolio/camera-core/navigation';

	let {
		mode,
		visitorState,
		invitationShown,
		progress,
		timelineMap,
		explore,
		dismissInvitation,
		goPrevious,
		goNext,
		toggleTourPlayback,
		seekTimeline,
		playTimeline,
		toggleTimeline
	}: {
		mode: 'preview' | 'public';
		visitorState: Readonly<Pick<VisitorRuntimeState, 'currentPresentation' | 'pacing' | 'program' | 'paused' | 'ended' | 'traveling' | 'currentStop' | 'invitation'>> & {
			readonly state: Pick<VisitorRuntimeState['state'], 'stopId' | 'holdRemainingMs'>;
		};
		invitationShown: boolean;
		progress: VisitorProgress | null;
		timelineMap: GuideTimeMap | null;
		explore: () => void;
		dismissInvitation: () => void;
		goPrevious: () => void;
		goNext: () => void;
		toggleTourPlayback: () => void;
		seekTimeline: (map: GuideTimeMap, cursor: GuideTimeCursor) => void;
		playTimeline: () => void;
		toggleTimeline: () => void;
	} = $props();

	const currentStopNumber = $derived.by(() => {
		const stopId = visitorState.state.stopId;
		return stopId === null
			? 0
			: visitorState.program.stops.findIndex((stop) => stop.id === stopId) + 1;
	});
	const stopViewCount = $derived(
		visitorState.currentStop === null
			? 0
			: visitorState.program.presentations.find((entry) => entry.id === visitorState.currentStop?.presentationId)?.viewIds.length ?? 0
	);
	const invitationText = $derived.by(() => {
		const prompt = visitorState.invitation?.prompt?.trim() ?? '';
		if (prompt !== '') return prompt;
		const more = stopViewCount - 1;
		return more > 0 ? `Take a closer look · ${more} more ${more === 1 ? 'view' : 'views'}` : 'Look around';
	});
	const remainingText = $derived.by(() => {
		if (visitorState.state.stopId === null) return '';
		if (visitorState.traveling) return `Moving to Stop ${currentStopNumber}`;
		if (visitorState.pacing === 'manual') return "Press Next when you're ready";
		const left = Math.max(0, Math.ceil((visitorState.state.holdRemainingMs ?? 0) / 1000));
		return visitorState.paused ? `Paused · ${left} s left here` : `${left} s left here`;
	});
	const isLastStop = $derived(currentStopNumber === visitorState.program.stops.length);
</script>

{#if invitationShown}
	<!-- The invitation is a hint: polite, never takes focus, never pauses the tour. -->
	<aside class="visitor-invitation" role="status" aria-live="polite" aria-label="Invitation to explore">
		<button type="button" class="invitation-close" aria-label="Hide for this visit" onclick={dismissInvitation}>✕</button>
		<strong>{invitationText}</strong>
		<small>
			{visitorState.currentPresentation?.label ?? ''} · {visitorState.pacing === 'manual'
				? "then press Next when you're ready"
				: "the tour carries on if you don't"}
		</small>
		<button type="button" class="vbtn gold" onclick={explore}>Explore</button>
	</aside>
{/if}
<!-- Sheet §33 F: a small caption, and one glass HUD with the segmented bar. -->
<p class="visitor-caption">
	Stop {currentStopNumber} of {visitorState.program.stops.length}<b>{visitorState.currentPresentation?.label ?? 'The tour'}</b>
</p>
<nav class="visitor-hud" aria-label="Tour controls">
	{#if progress !== null && timelineMap !== null && timelineMap.segments.length > 0}
		<VisitorTimeline
			map={timelineMap}
			stopId={visitorState.state.stopId}
			traveling={visitorState.traveling}
			paused={visitorState.paused}
			pacing={visitorState.pacing}
			{progress}
			interactive={mode === 'preview'}
			onSeek={seekTimeline}
			onPlay={playTimeline}
			onTogglePause={toggleTimeline}
		/>
	{/if}
	<div class="hud-row">
		<span class="hud-title">
			<b>{visitorState.currentPresentation?.label ?? 'The tour'}</b>
			<span class="hud-status" aria-live="off">· {remainingText}</span>
		</span>
		<span class="hud-actions">
			<button
				type="button"
				class="hbtn"
				disabled={currentStopNumber <= 1}
				title={currentStopNumber <= 1 ? 'This is the first Stop' : 'Cut to the previous Stop'}
				onclick={goPrevious}>← Prev</button
			>
			{#if visitorState.pacing === 'automatic'}
				<button type="button" class="hbtn" aria-pressed={visitorState.paused || visitorState.ended} onclick={toggleTourPlayback}
					>{visitorState.paused || visitorState.ended ? '▶ Play' : '❚❚ Pause'}</button
				>
			{/if}
			<button
				type="button"
				class="hbtn"
				class:pri={visitorState.pacing === 'manual'}
				disabled={visitorState.ended}
				title={visitorState.traveling ? 'Arrive now' : isLastStop ? 'Finish the tour' : 'Go to the next Stop'}
				onclick={goNext}>{isLastStop && !visitorState.traveling ? 'Finish' : 'Next →'}</button
			>
			<button
				type="button"
				class="hbtn"
				disabled={visitorState.ended}
				title={visitorState.traveling ? 'Arrive first, then explore' : 'Pause the tour and explore'}
				onclick={explore}>◎ Explore{stopViewCount > 1 ? ` · ${stopViewCount} views` : ''}</button
			>
		</span>
	</div>
</nav>

<style>
	.visitor-caption {
		position: absolute;
		left: 20px;
		top: 68px;
		margin: 0;
		color: var(--visitor-white);
		font: 500 12px var(--visitor-sans);
		text-shadow: 0 1px 3px rgb(0 0 0 / 55%);
		pointer-events: none;
		z-index: 6;
	}
	.visitor-caption b {
		display: block;
		font: 500 20px/1.2 var(--visitor-serif);
	}
	.hud-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		font: 500 13px var(--visitor-sans);
	}
	.hud-title {
		min-width: 0;
	}
	.hud-title b {
		font: 500 17px var(--visitor-serif);
	}
	.hud-status {
		color: var(--visitor-quiet);
		white-space: nowrap;
	}
	.hud-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-left: auto;
	}
	.hbtn {
		min-height: 32px;
		padding: 0 12px;
		border: 1px solid rgb(243 240 228 / 25%);
		border-radius: 9px;
		background: rgb(255 255 255 / 6%);
		color: var(--visitor-ivory);
		font: 500 13px var(--visitor-sans);
		white-space: nowrap;
		cursor: pointer;
	}
	.hbtn:hover:not(:disabled) {
		background: rgb(255 255 255 / 14%);
	}
	.hbtn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.hbtn.pri {
		border-color: var(--visitor-ivory);
		background: var(--visitor-ivory);
		color: var(--visitor-forest);
		font-weight: 600;
	}
	.hbtn:focus-visible {
		outline: 2px solid #9fd0b2;
		outline-offset: 1px;
	}
	.visitor-invitation {
		position: absolute;
		right: 24px;
		bottom: 112px;
		display: grid;
		gap: 6px;
		width: min(260px, calc(100% - 48px));
		padding: 10px 12px 12px;
		border: 1px solid rgb(212 173 69 / 55%);
		border-radius: 12px;
		background: rgb(10 24 18 / 0.88);
		box-shadow: 0 8px 24px rgb(0 0 0 / 30%);
		color: var(--visitor-white);
		z-index: 7;
		animation: visitor-invite 0.35s ease-out;
	}
	.visitor-invitation strong {
		padding-right: 22px;
		font: 500 15px/1.2 var(--visitor-serif);
	}
	.visitor-invitation small {
		color: #cfd8d2;
		font: 500 12px var(--visitor-sans);
	}
	.visitor-invitation .vbtn {
		justify-self: start;
	}
	.invitation-close {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 28px;
		height: 28px;
		border: 0;
		border-radius: 6px;
		background: none;
		color: #cfd8d2;
		cursor: pointer;
	}
	.invitation-close:hover {
		background: rgb(255 255 255 / 10%);
	}
	@keyframes visitor-invite {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.visitor-invitation {
			animation: none;
		}
	}
	@media (max-width: 760px) {
		.hud-actions {
			margin-left: 0;
		}
		.visitor-invitation {
			right: 16px;
			bottom: 220px;
		}
	}
</style>
