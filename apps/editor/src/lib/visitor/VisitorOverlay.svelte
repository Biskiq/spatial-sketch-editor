<script lang="ts">
	import type { VisitorRuntimeState } from './visitor-runtime-state.svelte';
	import type { VisitorProgress } from './visitor-progress';
	import type { guideTimeMapForProgram } from './guide-run-map';
	import { formatGuideTime } from '@portfolio/camera-core/navigation';
	import VisitorTimeline from './VisitorTimeline.svelte';

	type SurfaceMode = 'welcome' | 'guided' | 'free';
	type Presentation = NonNullable<VisitorRuntimeState['currentPresentation']>;
	type FreePresentation = VisitorRuntimeState['freePresentations'][number];
	type TimelineMap = Extract<ReturnType<typeof guideTimeMapForProgram>, { kind: 'ready' }>['map'];

	let {
		mode,
		title,
		visitorState,
		surfaceMode,
		showEnd,
		placesOpen = $bindable(),
		invitationShown,
		invitationText,
		remainingText,
		resumeClock,
		progress,
		timelineMap,
		freePresentations,
		exploringPresentation,
		currentExploreViewId,
		lookingAround,
		viewLabels,
		cameraGap,
		canvasDescription,
		guideSeconds,
		guideStopCount,
		currentStopNumber,
		stopViewCount,
		resumeStopNumber,
		isLastStop,
		chooseGuided,
		chooseFree,
		startAgain,
		explore,
		dismissInvitation,
		backToTheTour,
		startGuidedFromFree,
		backToSavedView,
		choosePlace,
		chooseView,
		goPrevious,
		goNext,
		toggleTourPlayback,
		exploreStep,
		exploreTo
	}: {
		mode: 'preview' | 'public';
		title: string;
		visitorState: VisitorRuntimeState | null;
		surfaceMode: SurfaceMode;
		showEnd: boolean;
		placesOpen: boolean;
		invitationShown: boolean;
		invitationText: string;
		remainingText: string;
		resumeClock: string;
		progress: VisitorProgress | null;
		timelineMap: TimelineMap | null;
		freePresentations: readonly FreePresentation[];
		exploringPresentation: Presentation | null;
		currentExploreViewId: string | null;
		lookingAround: boolean;
		viewLabels: ReadonlyMap<string, string> | null;
		cameraGap: string | null;
		canvasDescription: string;
		guideSeconds: number;
		guideStopCount: number;
		currentStopNumber: number;
		stopViewCount: number;
		resumeStopNumber: number;
		isLastStop: boolean;
		chooseGuided: () => void;
		chooseFree: () => void;
		startAgain: () => void;
		explore: () => void;
		dismissInvitation: () => void;
		backToTheTour: () => void;
		startGuidedFromFree: () => void;
		backToSavedView: () => void;
		choosePlace: (presentationId: string) => void;
		chooseView: (presentationId: string, viewId: string) => void;
		goPrevious: () => void;
		goNext: () => void;
		toggleTourPlayback: () => void;
		exploreStep: (direction: -1 | 1) => void;
		exploreTo: (viewId: string) => void;
	} = $props();
</script>

	{#if surfaceMode === 'welcome' && mode === 'preview'}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_element_to_interactive_role (a modal card owns its own keys) -->
	<section class="visitor-card visitor-welcome" role="dialog" aria-modal="true" aria-label="Welcome">
			<p class="overline">Welcome to</p>
			<h1>{title}</h1>
			{#if visitorState?.program.welcome}<p class="welcome-body">{visitorState.program.welcome}</p>{/if}
			<div class="choices">
				<button
					type="button"
					class="choice primary"
					disabled={visitorState === null || visitorState.program.entryStopId === null}
					onclick={chooseGuided}
				>
					<strong>Take the guided tour</strong>
					<span>{guideStopCount} {guideStopCount === 1 ? 'stop' : 'stops'} · {visitorState?.pacing === 'manual' ? 'at your own pace' : `about ${formatGuideTime(guideSeconds)}`}</span>
				</button>
				<button type="button" class="choice" disabled={freePresentations.length === 0} onclick={chooseFree}>
					<strong>Explore freely</strong>
					<span>{freePresentations.length} {freePresentations.length === 1 ? 'place' : 'places'}</span>
				</button>
			</div>
		</section>
	{/if}
	{#if surfaceMode === 'guided' && visitorState !== null && (mode === 'preview' || !visitorState.ended) && visitorState.state.stopId !== null}
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
				<VisitorTimeline map={timelineMap} visitor={visitorState} {progress} interactive={mode === 'preview'} />
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
	{/if}
	{#if surfaceMode !== 'welcome' && showEnd}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_element_to_interactive_role (a modal card owns its own keys) -->
	<section class="visitor-card visitor-end" role="dialog" aria-modal="true" aria-label="End of the tour">
			<p class="overline">End of the tour</p>
			<h1>Thank you for visiting</h1>
			<p class="welcome-body">Keep exploring — including views the tour skipped.</p>
			<div class="end-actions">
				<button type="button" class="vbtn gold" disabled={freePresentations.length === 0} onclick={chooseFree}>Keep exploring</button>
				<button type="button" class="vbtn" onclick={startAgain}>Start the tour again</button>
			</div>
		</section>
	{/if}
	{#if (surfaceMode === 'free' || (surfaceMode === 'guided' && visitorState !== null && visitorState.state.stopId === null)) && visitorState !== null}
		{#if placesOpen}
			<aside class="visitor-places" aria-label="Places">
				<header class="places-head">
					<h2>Places</h2>
					<button type="button" class="places-close" aria-label="Close Places" onclick={() => (placesOpen = false)}>✕</button>
				</header>
				{#each freePresentations as place (place.id)}
					<section class="place">
						<button type="button" class="place-name" onclick={() => choosePlace(place.id)}>{place.label}</button>
						<div class="place-views">
							{#each place.viewIds as viewId (viewId)}
								<button type="button" class="place-view" onclick={() => chooseView(place.id, viewId)}>
									{viewLabels?.get(viewId) ?? viewId}
								</button>
							{/each}
						</div>
					</section>
				{/each}
				{#if freePresentations.length === 0}<p class="places-empty">Nothing is listed in Places.</p>{/if}
			</aside>
		{/if}
		<nav class="visitor-free" aria-label={visitorState.exploring ? 'Exploring' : 'Free exploration'}>
			{#if exploringPresentation !== null}
				<div class="explore-caption">
					<p class="overline">{visitorState.exploring ? 'Exploring · the tour is paused' : 'Exploring'}</p>
					<strong class="guided-title">{exploringPresentation.label}</strong>
				</div>
				{#if exploringPresentation.viewIds.length > 1}
					<div class="explore-strip" role="group" aria-label={`${exploringPresentation.label}: Views`}>
						<button
							type="button"
							class="vbtn"
							aria-label="Previous View"
							disabled={visitorState.state.viewIndex === 0}
							onclick={() => exploreStep(-1)}>‹</button
						>
						{#each exploringPresentation.viewIds as viewId, index (viewId)}
							{#if index > 0}
								<em class="explore-step" title={exploringPresentation.steps[index - 1]?.kind === 'travel' ? 'Travel' : 'Cut'}
									>{exploringPresentation.steps[index - 1]?.kind === 'travel' ? '↗' : '✂'}</em
								>
							{/if}
							<button
								type="button"
								class="explore-view"
								aria-current={!lookingAround && viewId === currentExploreViewId}
								onclick={() => exploreTo(viewId)}>{index + 1} · {viewLabels?.get(viewId) ?? viewId}</button
							>
						{/each}
						<button
							type="button"
							class="vbtn"
							aria-label="Next View"
							disabled={visitorState.state.viewIndex === exploringPresentation.viewIds.length - 1}
							onclick={() => exploreStep(1)}>›</button
						>
					</div>
				{:else}
					<p class="explore-hint">One View: drag the picture to look around.</p>
				{/if}
			{:else}
				<p class="explore-hint">Choose a place · each opens at View 1</p>
			{/if}
			<div class="explore-actions">
				{#if visitorState.canResume}
					<button type="button" class="vbtn gold" onclick={backToTheTour}>
						↩ Back to the tour{resumeStopNumber > 0 ? ` · Stop ${resumeStopNumber}${resumeClock}` : ''}
					</button>
				{/if}
				{#if visitorState.program.entryStopId !== null && !visitorState.canResume}
					<button type="button" class="vbtn" onclick={startGuidedFromFree}>Start the guided tour</button>
				{/if}
				{#if lookingAround && currentExploreViewId !== null}
					<button type="button" class="vbtn" onclick={backToSavedView}>⟲ Back to {viewLabels?.get(currentExploreViewId) ?? 'the View'}</button>
				{/if}
				<button type="button" class="vbtn" onclick={() => (placesOpen = !placesOpen)} aria-expanded={placesOpen}>☰ Places</button>
				<button type="button" class="vbtn" disabled title="Walking needs a Camera free-move controller: later">Walk</button>
				{#if exploringPresentation !== null}
					<span class="guided-remaining">
						{exploringPresentation.viewIds.length > 1 ? `View ${(visitorState.state.viewIndex ?? 0) + 1} of ${exploringPresentation.viewIds.length} · ` : ''}your pace, no timer
					</span>
				{/if}
			</div>
		</nav>
	{/if}
	{#if cameraGap}
		<p class="visitor-camera-gap" role="status">{cameraGap}</p>
	{/if}
	<p id="visitor-preview-help" class="visitor-help">{canvasDescription}</p>

<style>

	.visitor-camera-gap {
		position: absolute;
		left: 0.75rem;
		bottom: 3rem;
		max-width: 32rem;
		margin: 0;
		padding: 0.4rem 0.6rem;
		border: 1px solid #a86b2a;
		border-radius: 6px;
		background: var(--visitor-glass);
		color: #f4d7a8;
		font: 500 0.72rem/1.35 var(--visitor-sans);
		z-index: 5;
	}
	/* ---- Welcome and end: a centred dark-glass card ---- */
	.visitor-card {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(520px, calc(100% - 2rem));
		padding: 30px 30px 26px;
		border: 1px solid rgb(243 240 228 / 12%);
		border-radius: 20px;
		background: var(--visitor-glass);
		-webkit-backdrop-filter: blur(14px);
		backdrop-filter: blur(14px);
		color: var(--visitor-ivory);
		box-shadow: 0 24px 60px rgb(0 0 0 / 0.45);
		text-align: center;
		z-index: 8;
	}
	.overline {
		margin: 0 0 8px;
		color: var(--visitor-gold);
		font: 700 11px/1.2 var(--visitor-sans);
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.visitor-welcome h1,
	.visitor-end h1 {
		margin: 0 0 10px;
		color: var(--visitor-ivory);
		font: 500 34px/1.1 var(--visitor-serif);
	}
	.visitor-end h1 {
		font-size: 30px;
	}
	.welcome-body {
		max-width: 40ch;
		margin: 0 auto 18px;
		color: rgb(243 240 228 / 72%);
		font: 14px/1.5 var(--visitor-sans);
	}
	.choices {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		text-align: left;
	}
	.choice {
		display: grid;
		gap: 4px;
		padding: 16px;
		border: 1px solid rgb(243 240 228 / 18%);
		border-radius: 14px;
		background: rgb(243 240 228 / 6%);
		color: var(--visitor-ivory);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.choice:hover:not(:disabled) {
		border-color: var(--visitor-gold);
	}
	.choice:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.choice strong {
		font: 600 14px var(--visitor-sans);
	}
	.choice span {
		color: rgb(243 240 228 / 66%);
		font: 12px/1.45 var(--visitor-sans);
	}
	.choice.primary {
		border-color: transparent;
		background: var(--visitor-gold);
		color: var(--visitor-forest);
	}
	.choice.primary span {
		color: rgb(17 41 31 / 78%);
	}
	.choice.primary:hover:not(:disabled) {
		border-color: transparent;
		filter: brightness(1.05);
	}
	.end-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		justify-content: center;
	}
	/* ---- Shared pill buttons over dark glass ---- */
	.vbtn {
		min-height: 40px;
		padding: 0 16px;
		border: 1px solid rgb(243 240 228 / 22%);
		border-radius: 999px;
		background: var(--visitor-glass);
		-webkit-backdrop-filter: blur(10px);
		backdrop-filter: blur(10px);
		color: var(--visitor-ivory);
		font: 600 13px var(--visitor-sans);
		white-space: nowrap;
		cursor: pointer;
	}
	.vbtn:hover:not(:disabled) {
		border-color: rgb(243 240 228 / 50%);
	}
	.vbtn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.vbtn.gold {
		border-color: transparent;
		background: var(--visitor-gold);
		color: var(--visitor-forest);
	}
	.vbtn.gold:hover:not(:disabled) {
		border-color: transparent;
		filter: brightness(1.05);
	}
	/* ---- Guided tour (sheet §33 F): a small caption and one glass HUD ---- */
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
	.visitor-hud,
	.visitor-free {
		position: absolute;
		left: 16px;
		right: 16px;
		bottom: 16px;
		display: grid;
		gap: 10px;
		padding: 12px 14px;
		border-radius: 14px;
		background: rgb(14 30 25 / 0.86);
		-webkit-backdrop-filter: blur(12px);
		backdrop-filter: blur(12px);
		color: var(--visitor-ivory);
		z-index: 6;
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
	/* Exploring shares the HUD panel and its compact buttons. */
	.guided-title {
		font: 500 17px var(--visitor-serif);
	}
	.guided-remaining {
		color: var(--visitor-quiet);
		font: 500 12px var(--visitor-sans);
		white-space: nowrap;
	}
	.visitor-free .overline {
		margin: 0;
		color: var(--visitor-quiet);
		font: 500 12px var(--visitor-sans);
		letter-spacing: 0;
		text-transform: none;
	}
	.visitor-free .vbtn {
		min-height: 32px;
		padding: 0 12px;
		border-radius: 9px;
		background: rgb(255 255 255 / 6%);
		font: 500 13px var(--visitor-sans);
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}
	.visitor-free .vbtn.gold {
		border-color: var(--visitor-ivory);
		background: var(--visitor-ivory);
		color: var(--visitor-forest);
		font-weight: 600;
	}
	/* ---- The invitation: a card beside Explore; a hint, never a stop ---- */
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
	/* ---- Exploring: the Presentation's Views, Back to the tour, Places ---- */
	.explore-caption {
		display: grid;
		gap: 4px;
	}
	.explore-caption .overline {
		margin: 0;
	}
	.explore-strip,
	.explore-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.explore-strip {
		flex-wrap: nowrap;
		overflow-x: auto;
	}
	.explore-view {
		flex: none;
		min-height: 40px;
		padding: 0 12px;
		border: 1px solid rgb(243 240 228 / 22%);
		border-radius: 8px;
		background: var(--visitor-glass);
		color: var(--visitor-ivory);
		font: 500 12px var(--visitor-sans);
		cursor: pointer;
	}
	.explore-view[aria-current='true'] {
		border-color: var(--visitor-gold);
		box-shadow: inset 0 0 0 1px var(--visitor-gold);
	}
	.explore-step {
		flex: none;
		color: rgb(243 240 228 / 60%);
		font-style: normal;
	}
	.places-empty {
		margin: 0;
		font: 500 12px var(--visitor-sans);
		opacity: 0.8;
	}
	.explore-hint {
		margin: 0;
		padding: 9px 14px;
		border-radius: 999px;
		background: rgb(17 41 31 / 0.75);
		color: var(--visitor-ivory);
		font: 500 12px var(--visitor-sans);
	}
	.visitor-places {
		position: absolute;
		top: 64px;
		bottom: 0;
		left: 0;
		width: 272px;
		overflow-y: auto;
		padding: 12px 12px 84px;
		border-radius: 0 16px 16px 0;
		background: var(--visitor-glass);
		-webkit-backdrop-filter: blur(14px);
		backdrop-filter: blur(14px);
		color: var(--visitor-ivory);
		z-index: 7;
	}
	.places-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 2px 10px 2px;
	}
	.places-head h2 {
		margin: 0;
		font: 16px var(--visitor-serif);
	}
	.places-close {
		width: 44px;
		height: 44px;
		border: 0;
		border-radius: 22px;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}
	.place {
		margin-bottom: 12px;
	}
	.place-name {
		width: 100%;
		min-height: 44px;
		border: 0;
		background: transparent;
		color: var(--visitor-gold);
		font: 700 11px var(--visitor-sans);
		letter-spacing: 0.07em;
		text-align: left;
		text-transform: uppercase;
		cursor: pointer;
	}
	.place-views {
		display: grid;
		gap: 6px;
		overflow-wrap: anywhere;
	}
	.place-view {
		min-height: 40px;
		padding: 0 14px;
		border: 1px solid rgb(243 240 228 / 22%);
		border-radius: 8px;
		background: var(--visitor-glass);
		color: var(--visitor-ivory);
		font: 500 12px var(--visitor-sans);
		text-align: left;
		cursor: pointer;
	}
	.visitor-help {
		position: absolute;
		left: -9999px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
	/* ---- Chrome: brand left, a gold Preview tab on the top edge, Exit right ---- */
	@media (max-width: 760px) {
		.choices {
			grid-template-columns: 1fr;
		}
		.visitor-hud,
		.visitor-free {
			left: 10px;
			right: 10px;
			bottom: 10px;
		}
		.hud-actions {
			margin-left: 0;
		}
		.visitor-invitation {
			right: 16px;
			bottom: 220px;
		}
		.visitor-places {
			width: 100%;
			border-radius: 0;
		}
	}
</style>
