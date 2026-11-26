<script lang="ts">
	import type { VisitorRuntimeState } from './visitor-runtime-state.svelte';
	type FreePresentation = VisitorRuntimeState['freePresentations'][number];

	let {
		visitorState,
		placesOpen,
		freePresentations,
		lookingAround,
		viewLabels,
		backToTheTour,
		startGuidedFromFree,
		backToSavedView,
		choosePlace,
		chooseView,
		exploreStep,
		exploreTo,
		onPlacesOpen
	}: {
		visitorState: Readonly<Pick<VisitorRuntimeState, 'exploring' | 'canResume' | 'currentPresentation'>> & {
			readonly state: Pick<VisitorRuntimeState['state'], 'viewIndex' | 'viewId' | 'stopId' | 'resume'>;
			readonly program: Pick<VisitorRuntimeState['program'], 'entryStopId' | 'stops'>;
		};
		placesOpen: boolean;
		freePresentations: readonly FreePresentation[];
		lookingAround: boolean;
		viewLabels: ReadonlyMap<string, string> | null;
		backToTheTour: () => void;
		startGuidedFromFree: () => void;
		backToSavedView: () => void;
		choosePlace: (presentationId: string) => void;
		chooseView: (presentationId: string, viewId: string) => void;
		exploreStep: (direction: -1 | 1) => void;
		exploreTo: (viewId: string) => void;
		onPlacesOpen: (open: boolean) => void;
	} = $props();

	const exploringPresentation = $derived(
		visitorState.state.stopId === null ? visitorState.currentPresentation : null
	);
	const currentExploreViewId = $derived(visitorState.state.viewId);
	const resumeStopNumber = $derived.by(() => {
		const resume = visitorState.state.resume;
		return resume === null
			? 0
			: visitorState.program.stops.findIndex((stop) => stop.id === resume.stopId) + 1;
	});
	const resumeClock = $derived.by(() => {
		const resume = visitorState.state.resume;
		if (resume === null) return '';
		const stop = visitorState.program.stops.find((entry) => entry.id === resume.stopId);
		if (stop === undefined || stop.staySeconds === null || resume.holdRemainingMs === null) return '';
		return `, ${Math.max(0, Math.ceil(resume.holdRemainingMs / 1000))} s left`;
	});
</script>

{#if placesOpen}
	<aside class="visitor-places" aria-label="Places">
		<header class="places-head">
			<h2>Places</h2>
			<button type="button" class="places-close" aria-label="Close Places" onclick={() => onPlacesOpen(false)}>✕</button>
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
		<button type="button" class="vbtn" onclick={() => onPlacesOpen(!placesOpen)} aria-expanded={placesOpen}>☰ Places</button>
		<button type="button" class="vbtn" disabled title="Walking needs a Camera free-move controller: later">Walk</button>
		{#if exploringPresentation !== null}
			<span class="guided-remaining">
				{exploringPresentation.viewIds.length > 1 ? `View ${(visitorState.state.viewIndex ?? 0) + 1} of ${exploringPresentation.viewIds.length} · ` : ''}your pace, no timer
			</span>
		{/if}
	</div>
</nav>

<style>
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
	@media (max-width: 760px) {
		.visitor-places {
			width: 100%;
			border-radius: 0;
		}
	}
</style>
