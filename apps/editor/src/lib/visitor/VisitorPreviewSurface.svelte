<script lang="ts">
	import CanvasHost from '$lib/render/CanvasHost.svelte';
	import { perfMark } from '$lib/platform/perf-marks';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { provideRenderResources } from '$lib/render/resources/render-resources';
import type { ArtworkScope } from '$lib/render/artwork/artwork-scope';
	import { T } from '@threlte/core';
	import type { RuntimeScene } from '@portfolio/project-model/scene';
	import type { NavigationGraph } from '@portfolio/project-model/scene';
	import type { CompiledLayoutGeometry } from '@portfolio/layout-core/geometry';
	import type { ExecutionProgram, ExperienceInterpreterOptions } from '@portfolio/project-model/units';
	import { createVisitorRuntimeState } from './visitor-runtime-state.svelte';
	import { visitorProgressFor } from './visitor-progress';
	import { guideRunFromProgram, guideTimeMapForProgram } from './guide-run-map';
	import VisitorOverlay from './VisitorOverlay.svelte';
	import { initialVisitorSurfaceMode } from './visitor-entry';
	import type { TextureLoadScope } from '$lib/render/resources/texture-store';
	import VisitorCameraDirector from './VisitorCameraDirector.svelte';
	import VisitorEntities from './VisitorEntities.svelte';
	import VisitorFirstFrame from './VisitorFirstFrame.svelte';
	import VisitorLayoutShell from './VisitorLayoutShell.svelte';
	import WorldEnvironment from '$lib/render/WorldEnvironment.svelte';
	import StoreMaterial from '$lib/render/resources/StoreMaterial.svelte';
	import type { LambertMaterialDescriptor } from '$lib/render/resources/material-descriptor';
	import type { SceneSky } from '@portfolio/project-model/units';

	let {
		scene,
		geometry,
		graph,
		program = null,
		experienceOptions = null,
		/** Enter this Presentation directly through the interpreter's Presentation entry. */
		entryPresentationId = null,
		/**
		 * The run identity of this entry. A mounted surface is reused across Preview
		 * sessions, so a new epoch — not a component mount — is what starts a fresh
		 * run. It is the same epoch the Camera handoff uses.
		 */
		runEpoch = 0,
		/** Whether this surface currently belongs to an open Preview session. */
		active = true,
		resolveTexture,
		textureScope = null,
		artworkScope = null,
		modelUrls = null,
		reducedMotion = false,
		mode = 'preview',
		title = null,
		/** The visitor-safe initial entry: welcome chooser, guided, free or one Presentation. */
		startMode = 'welcome',
		experienceTitle = null,
		guideStopCount = 0,
		guideSeconds = 0,
		viewLabels = null,
		onExit,
		sky = null
	}: {
		scene: RuntimeScene;
		geometry: CompiledLayoutGeometry;
		graph: NavigationGraph;
		/** The lowered Experience program. Absent means no guided Experience. */
		program?: ExecutionProgram | null;
		experienceOptions?: ExperienceInterpreterOptions | null;
		entryPresentationId?: string | null;
		runEpoch?: number;
		active?: boolean;
		resolveTexture: (uri: string) => string | null;
		textureScope?: TextureLoadScope | null;
		artworkScope?: ArtworkScope | null;
		/** Runtime-safe approved model bytes, resolved by the owning session. */
		modelUrls?: ReadonlyMap<string, string> | null;
		reducedMotion?: boolean;
		mode?: 'preview' | 'public';
		title?: string | null;
		/** Welcome | guided | free | presentation, chosen by the head Preview entry. */
		startMode?: 'welcome' | 'guided' | 'free' | 'presentation';
		experienceTitle?: string | null;
		guideStopCount?: number;
		guideSeconds?: number;
		viewLabels?: ReadonlyMap<string, string> | null;
		onExit?: () => void;
		/** The Scene's stored Sky; `null` is Paper, never black. */
		sky?: SceneSky | null;
	} = $props();

	/** One render-resource owner for the Preview Canvas; see `StageCanvas`. */
	const resources = provideRenderResources();
	/** The paper reading's ground disc, from the Canvas store. */
	const PAPER_GROUND: LambertMaterialDescriptor = { kind: 'lambert', color: '#e2e5de' };
	onDestroy(() => resources.dispose());

	const visitorState = $derived.by(() => {
		// The run identity, not the component lifetime, creates a fresh runtime: a
		// reused surface must not carry a previous entry's interpreter state.
		void runEpoch;
		return program === null || experienceOptions === null
			? null
			: createVisitorRuntimeState({ program, options: experienceOptions });
	});
	let cameraGap = $state<string | null>(null);
	/** The live Camera Travel's existing transition fraction, for the connector. */
	let travelProgress = $state(0);
	let surfaceMode = $state<'welcome' | 'guided' | 'free'>(initialVisitorSurfaceMode(mode, startMode));
	let placesOpen = $state(false);
	/** Invitations hidden with ✕, by occurrence: dismissing lasts one visit. Session only. */
	let dismissedInvitations = $state<ReadonlySet<string>>(new Set());
	/** The visitor has dragged away from the saved View while exploring. */
	let lookingAround = $state(false);
	let freeViewId = $state<string | null>(null);
	/** Bumped for every explicit destination boundary, even when the override is null. */
	let destinationEpoch = $state(0);
	/** The authored run is over and the end screen owns the surface. */
	let showEnd = $state(false);
	const freePresentations = $derived(visitorState?.freePresentations ?? []);
	const currentStopNumber = $derived.by(() => {
		const stopId = visitorState?.state.stopId ?? null;
		return stopId === null || visitorState === null
			? 0
			: visitorState.program.stops.findIndex((stop) => stop.id === stopId) + 1;
	});
	const resumeStopNumber = $derived.by(() => {
		const resume = visitorState?.state.resume ?? null;
		return resume === null || visitorState === null
			? 0
			: visitorState.program.stops.findIndex((stop) => stop.id === resume.stopId) + 1;
	});
	$effect(() => {
		// A new run starts at its own entry surface, never a previous run's mode.
		void runEpoch;
		void startMode;
		// A published route enters the tour; an editor Preview keeps its welcome
		// chooser. Neither inherits a previous run's mode.
		surfaceMode = initialVisitorSurfaceMode(mode, startMode);
		placesOpen = false;
		dismissedInvitations = new Set();
		lookingAround = false;
		freeViewId = null;
		showEnd = false;
	});
	$effect(() => {
		// The authored end is an edge, not the interpreter's terminal phase: free
		// exploration starts a fresh run, and changing Places must not re-show it.
		showEnd = visitorState?.ended === true;
	});
	function chooseGuided(): void {
		if (visitorState === null || visitorState.program.entryStopId === null) return;
		visitorState.start(null);
		if (mode === 'preview') visitorState.pause();
		surfaceMode = 'guided';
		showEnd = false;
	}
	function chooseFree(): void {
		// A completed interpreter ignores presentation entry. Continue after the
		// end on a fresh neutral run, not the terminal one.
		if (visitorState?.ended === true) visitorState.beginFreeExploration();
		surfaceMode = 'free';
		showEnd = false;
		placesOpen = true;
		freeViewId = null;
		destinationEpoch += 1;
	}
	/**
	 * Explore (sheet §31): always in the bar at an arrived Stop, and the
	 * invitation's own button. It freezes the Guide clock and keeps the Stop
	 * occurrence; during an arrival Travel it lands first.
	 */
	function explore(): void {
		if (visitorState?.explore() !== true) return;
		placesOpen = false;
		lookingAround = false;
		freeViewId = null;
		destinationEpoch += 1;
	}
	function dismissInvitation(): void {
		const occurrenceId = visitorState?.state.occurrenceId ?? null;
		if (occurrenceId === null) return;
		dismissedInvitations = new Set([...dismissedInvitations, occurrenceId]);
	}
	/** Back to the tour: a Cut to the Stop's View, with its playhead and play state. */
	function backToTheTour(): void {
		if (visitorState?.canResume === true) visitorState.resume();
		surfaceMode = 'guided';
		showEnd = false;
		placesOpen = false;
		lookingAround = false;
		freeViewId = null;
		destinationEpoch += 1;
	}
	function goPrevious(): void {
		// Prev is a Cut: the Experience moves to the previous Stop, and the destination
		// boundary settles the Camera on that Stop's entry View with no travel back.
		if (visitorState?.previousStop() !== true) return;
		showEnd = false;
		freeViewId = null;
		destinationEpoch += 1;
	}
	function toggleTourPlayback(): void {
		if (visitorState?.ended) {
			visitorState.restart();
			visitorState.play();
		} else visitorState?.togglePause();
	}

	function goNext(): void {
		visitorState?.continue();
	}
	function exploreStep(direction: -1 | 1): void {
		if (visitorState?.exploreStep(direction) === true) lookingAround = false;
	}
	function exploreTo(viewId: string): void {
		if (visitorState?.exploreView(viewId) === true) lookingAround = false;
	}
	/** ⟲ cuts back to the last saved View after looking around. */
	function backToSavedView(): void {
		lookingAround = false;
		destinationEpoch += 1;
	}
	function startAgain(): void {
		visitorState?.restart();
		if (mode === 'preview') visitorState?.pause();
		surfaceMode = 'guided';
		showEnd = false;
		freeViewId = null;
		dismissedInvitations = new Set();
		destinationEpoch += 1;
	}
	function startGuidedFromFree(): void {
		if (visitorState === null || visitorState.program.entryStopId === null) return;
		// A fresh free entry or a Presentation entry has no Stop and no suspended
		// Guide; simply calling enter() would be idempotent and leave a "guided"
		// shell with no Stop. Rewind through the landed fresh-run path instead.
		if (visitorState.ended || visitorState.state.stopId === null) {
			visitorState.beginFreeExploration();
			visitorState.start(null);
			if (mode === 'preview') visitorState.pause();
		}
		surfaceMode = 'guided';
		showEnd = false;
		freeViewId = null;
		destinationEpoch += 1;
	}
	/** Places: open a Presentation at View 1, keeping the one resume point. */
	function choosePlace(presentationId: string): void {
		freeViewId = null;
		showEnd = false;
		if (visitorState?.selectPresentation(presentationId) === true) {
			placesOpen = false;
			lookingAround = false;
			destinationEpoch += 1;
		}
	}
	function chooseView(presentationId: string, viewId: string): void {
		if (visitorState?.selectPresentation(presentationId, viewId) !== true) return;
		freeViewId = null;
		placesOpen = false;
		showEnd = false;
		lookingAround = false;
		destinationEpoch += 1;
	}
	/** Visitor keys (plan): ← Prev, Space Pause, E Explore; in Explore ← → step Views and B goes back. */
	function onVisitorCommand(command: 'previous' | 'pause' | 'explore' | 'back' | 'view-previous' | 'view-next'): void {
		if (visitorState === null) return;
		if (command === 'previous') goPrevious();
		else if (command === 'pause') toggleTourPlayback();
		else if (command === 'explore') explore();
		else if (command === 'back') backToTheTour();
		else if (command === 'view-previous') exploreStep(-1);
		else exploreStep(1);
	}
	const exploringPresentation = $derived(
		visitorState !== null && visitorState.state.stopId === null ? visitorState.currentPresentation : null
	);
	const currentExploreViewId = $derived(visitorState?.state.viewId ?? null);
	const atStop = $derived(
		visitorState !== null &&
			visitorState.state.stopId !== null &&
			(visitorState.state.phase === 'holding' || visitorState.state.phase === 'ready')
	);
	const invitationShown = $derived(
		visitorState !== null &&
			atStop &&
			visitorState.invitation !== null &&
			!dismissedInvitations.has(visitorState.state.occurrenceId ?? '')
	);
	const stopViewCount = $derived(
		visitorState?.currentStop === null || visitorState === null
			? 0
			: visitorState.program.presentations.find((entry) => entry.id === visitorState.currentStop?.presentationId)?.viewIds.length ?? 0
	);
	const invitationText = $derived.by(() => {
		const prompt = visitorState?.invitation?.prompt?.trim() ?? '';
		if (prompt !== '') return prompt;
		const more = stopViewCount - 1;
		return more > 0 ? `Take a closer look · ${more} more ${more === 1 ? 'view' : 'views'}` : 'Look around';
	});
	const remainingText = $derived.by(() => {
		if (visitorState === null || visitorState.state.stopId === null) return '';
		if (visitorState.traveling) return `Moving to Stop ${currentStopNumber}`;
		if (visitorState.pacing === 'manual') return "Press Next when you're ready";
		const left = Math.max(0, Math.ceil((visitorState.state.holdRemainingMs ?? 0) / 1000));
		return visitorState.paused ? `Paused · ${left} s left here` : `${left} s left here`;
	});
	const resumeClock = $derived.by(() => {
		const resume = visitorState?.state.resume ?? null;
		if (resume === null || visitorState === null) return '';
		const stop = visitorState.program.stops.find((entry) => entry.id === resume.stopId);
		if (stop === undefined || stop.staySeconds === null || resume.holdRemainingMs === null) return '';
		return `, ${Math.max(0, Math.ceil(resume.holdRemainingMs / 1000))} s left`;
	});
	const isLastStop = $derived(visitorState !== null && currentStopNumber === visitorState.program.stops.length);
	const guideOrder = $derived.by(() => {
		if (visitorState === null) return undefined;
		const run = guideRunFromProgram({
			program: visitorState.program,
			transitions: experienceOptions?.transitions ?? []
		});
		return run.kind === 'ready' ? run.occurrences.map((occurrence) => occurrence.stopId) : undefined;
	});
	const timelineMap = $derived.by(() => {
		if (visitorState === null) return null;
		const result = guideTimeMapForProgram({ program: visitorState.program, transitions: experienceOptions?.transitions ?? [], graph });
		return result.kind === 'ready' ? result.map : null;
	});
	const progress = $derived(
		visitorState === null
			? null
			: visitorProgressFor(visitorState.program, visitorState.state, {
					order: guideOrder,
					travelProgress,
					arrivesByTravel: new Set(
						(experienceOptions?.transitions ?? [])
							.filter((entry) => entry.invocation.kind === 'travel')
							.map((entry) => entry.toStopId)
					)
				})
	);
	$effect(() => {
		if (visitorState === null) return;
		visitorState.reducedMotion = reducedMotion;
	});
	// A program may arrive after the surface mounts, and a changed program creates
	// a fresh neutral runtime. Enter every instance, not only the first. A
	// Presentation entry starts the same run at its Default View with no Stop.
	// A hidden warm surface holds no run: it is started only by an active session,
	// so no Preview session exists until the host opens one.
	$effect(() => {
		if (visitorState === null || !active) return;
		// The welcome chooser holds no run: a guided tour starts only when the
		// visitor chooses it, and free exploration starts per Place.
		if (surfaceMode === 'welcome') return;
		if (startMode !== 'presentation' && surfaceMode !== 'guided') return;
		// start() reads the run state it replaces; untracked, so the new state never re-runs this.
		const runtime = visitorState;
		const entry = entryPresentationId;
		untrack(() => {
			const entering = !runtime.state.entered;
			runtime.start(entry);
			if (entering && mode === 'preview' && surfaceMode === 'guided') runtime.pause();
		});
	});
	/**
	 * This entry's first presented opportunity.
	 *
	 * The surface may already be mounted (a warm Preview), so a mount hook cannot
	 * measure an entry. Two rendering opportunities after an active run starts are
	 * used for both cases: the first may only upload the reused scene.
	 */
	$effect(() => {
		const live = active;
		const epoch = runEpoch;
		if (!live || visitorState === null) return;
		let inner = 0;
		const outer = requestAnimationFrame(() => {
			inner = requestAnimationFrame(() => perfMark('visitor:entry-frame', { runEpoch: epoch }));
		});
		return () => {
			cancelAnimationFrame(outer);
			cancelAnimationFrame(inner);
		};
	});

	const isZeroNode = $derived(visitorState === null || visitorState.program.stops.length === 0);
	const canvasDescription = $derived(
		mode === 'public'
			? isZeroNode
				? 'Published project. No guided Experience: drag to orbit, wheel to zoom, right-drag to pan.'
				: 'Published project. Right Arrow or Enter is Next, Left Arrow is Previous, Space pauses, E explores; in Explore, Left and Right step Views and B goes back to the tour. W A S D or drag to look around.'
			: isZeroNode
				? 'Visitor preview. No guided Experience: drag to orbit, wheel to zoom, right-drag to pan. Press Escape to exit preview.'
				: 'Visitor preview. Right Arrow or Enter is Next, Left Arrow is Previous, Space pauses, E explores; in Explore, Left and Right step Views and B goes back to the tour. W A S D or drag to look around. Press Escape to exit preview.'
	);
	const publicTitle = $derived((title ?? '').trim() || 'Published project');

	onMount(() => {
		perfMark('visitor:mounted');
		// Exercise the detached read-only resolver so preview-local URLs stay
		// alive through the surface lifetime. When a release `textureScope`
		// is supplied, 3D material loading uses that scoped resolver with
		// scoped cache keys; otherwise it falls back to the session loader.
		for (const texture of scene.textures) {
			try {
				void resolveTexture(texture.uri);
			} catch {
				// Resolver is total; ignore.
			}
		}
	});
</script>

<div class="visitor-preview" data-visitor-canvas-root>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (the WebGL viewport owns guarded preview keys) -->
	<div
		class="visitor-canvas"
		class:is-welcome={surfaceMode === 'welcome' && mode === 'preview'}
		tabindex="0"
		role="application"
		aria-label={mode === 'public' ? 'Published project canvas' : 'Visitor preview canvas'}
		aria-describedby="visitor-preview-help"
	>
		<CanvasHost surface="preview" renderMode={active ? 'always' : 'on-demand'} placeholder="#e9ebe6">
			{#snippet children()}
			{#if sky === null || sky.preset === 'studio'}
				<!-- Paper: the Stage's own tone and neutral light, without the grid. Never a black void. -->
				<T.Color attach="background" args={['#e9ebe6']} />
				<T.AmbientLight intensity={0.45} />
				<T.DirectionalLight position={[6, 12, 8]} intensity={1.1} />
				<T.DirectionalLight position={[-8, 6, -6]} intensity={0.35} />
				<T.Mesh rotation.x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
					<T.CircleGeometry args={[90, 48]} />
					<StoreMaterial descriptor={PAPER_GROUND} />
				</T.Mesh>
			{:else}
				<WorldEnvironment {sky} bounds={geometry.bounds ?? null} />
			{/if}
			{#if visitorState}
				<VisitorCameraDirector
					graph={graph}
					visitor={visitorState}
					bounds={geometry.bounds ?? null}
					{runEpoch}
					{active}
					guidedInputEnabled={surfaceMode === 'guided' && !visitorState.ended}
					viewOverride={freeViewId}
					{destinationEpoch}
					onCameraGap={(message) => (cameraGap = message)}
					onTravelProgress={(fraction) => (travelProgress = fraction)}
					onCommand={onVisitorCommand}
					onLook={(value) => (lookingAround = value)}
				/>
			{/if}
			<VisitorLayoutShell
				{geometry}
				{scene}
				textureScope={textureScope}
				treatment={scene.environment?.treatment}
			/>
			<VisitorEntities
				scene={scene}
				{textureScope}
				{artworkScope}
				{modelUrls}
				includeLights={sky !== null && sky.preset !== 'studio'}
			/>
			<!-- Renderer-observed first frame; inert unless the harness enables marks. -->
			<VisitorFirstFrame {runEpoch} {active} />
			{/snippet}
		</CanvasHost>
	</div>
	<div class="visitor-brand" class:published={mode === 'public'}>
		{#if mode === 'public'}<span class="brand-kicker">Published</span>{/if}
		<span class="brand-title">{experienceTitle ?? publicTitle}</span>
	</div>
	{#if mode === 'preview'}
		<div class="visitor-tab" role="status">Preview — what a visitor sees</div>
		{#if onExit}
			<button type="button" class="visitor-exit" onclick={onExit}>✕ Exit preview <kbd>Esc</kbd></button>
		{/if}
	{/if}
	<VisitorOverlay
		{mode}
		title={experienceTitle ?? publicTitle}
		{visitorState}
		{surfaceMode}
		{showEnd}
		bind:placesOpen
		{invitationShown}
		{invitationText}
		{remainingText}
		{resumeClock}
		{progress}
		{timelineMap}
		{freePresentations}
		{exploringPresentation}
		{currentExploreViewId}
		{lookingAround}
		{viewLabels}
		{cameraGap}
		{canvasDescription}
		{guideSeconds}
		{guideStopCount}
		{currentStopNumber}
		{stopViewCount}
		{resumeStopNumber}
		{isLastStop}
		{chooseGuided}
		{chooseFree}
		{startAgain}
		{explore}
		{dismissInvitation}
		{backToTheTour}
		{startGuidedFromFree}
		{backToSavedView}
		{choosePlace}
		{chooseView}
		{goPrevious}
		{goNext}
		{toggleTourPlayback}
		{exploreStep}
		{exploreTo}
	/>
</div>

<style>
	/*
	 * The published-visit presentation owns its roles. The values equal the
	 * approved PLATE defaults today, but they are deliberately not aliases of
	 * `--shell-*`: an editor skin must never change what a published Experience
	 * looks like. Change them only with a visitor-facing design decision.
	 */
	.visitor-preview {
		--visitor-forest: #11291f;
		--visitor-glass: rgba(14, 30, 25, 0.78);
		--visitor-gold: #d4ad45;
		--visitor-gold-ink: #74560c;
		--visitor-ivory: #f3f0e4;
		--visitor-quiet: #9fb2a5;
		--visitor-white: #ffffff;
		--visitor-serif: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
		--visitor-sans: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		background: var(--visitor-forest);
		overflow: hidden;
	}
	.visitor-canvas {
		position: absolute;
		inset: 0;
		outline: none;
		transition: filter 320ms ease;
	}
	/* The welcome sits over a softly blurred first View. */
	.visitor-canvas.is-welcome {
		filter: blur(3px) brightness(0.94);
	}
	.visitor-canvas:focus-visible {
		box-shadow: inset 0 0 0 1px rgb(212 173 69 / 55%);
	}
	.visitor-canvas :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}


	.visitor-brand {
		position: absolute;
		top: 14px;
		left: 14px;
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
		max-width: calc(100% - 240px);
		padding: 8px 16px;
		border: 1px solid rgb(243 240 228 / 14%);
		border-radius: 999px;
		background: var(--visitor-glass);
		-webkit-backdrop-filter: blur(12px);
		backdrop-filter: blur(12px);
		color: var(--visitor-ivory);
		z-index: 5;
	}
	.brand-kicker {
		color: var(--visitor-gold);
		font: 700 10px/1 var(--visitor-sans);
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.brand-title {
		min-width: 0;
		overflow: hidden;
		font: 600 15px/1.2 var(--visitor-serif);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.visitor-tab {
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		padding: 6px 12px 7px;
		border-radius: 0 0 10px 10px;
		background: var(--visitor-gold);
		color: var(--visitor-gold-ink);
		font: 700 11px/1 var(--visitor-sans);
		letter-spacing: 0.02em;
		white-space: nowrap;
		z-index: 5;
	}
	.visitor-exit {
		position: absolute;
		top: 14px;
		right: 14px;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 36px;
		padding: 0 8px 0 14px;
		border: 1px solid rgb(243 240 228 / 18%);
		border-radius: 999px;
		background: var(--visitor-glass);
		-webkit-backdrop-filter: blur(12px);
		backdrop-filter: blur(12px);
		color: var(--visitor-ivory);
		font: 600 12px var(--visitor-sans);
		cursor: pointer;
		z-index: 5;
	}
	.visitor-exit:hover {
		border-color: var(--visitor-gold);
	}
	.visitor-exit:focus-visible {
		outline: 2px solid var(--visitor-gold);
		outline-offset: 2px;
	}
	kbd {
		padding: 1px 6px;
		border: 1px solid rgb(243 240 228 / 35%);
		border-radius: 4px;
		color: var(--visitor-ivory);
		font: 600 10px var(--visitor-sans);
		opacity: 0.85;
	}
	@media (max-width: 760px) {
		.visitor-brand {
			max-width: calc(100% - 150px);
		}
		.visitor-tab {
			top: 58px;
			border-radius: 999px;
		}
		.visitor-exit {
			right: 12px;
		}
	}
</style>
