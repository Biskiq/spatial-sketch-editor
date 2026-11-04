<script lang="ts">
	import { createManagedWebGLRenderer } from '$lib/render/managed-webgl-renderer';
	import { perfMark, perfRenderer } from '$lib/platform/perf-marks';
	import { onMount, untrack } from 'svelte';
import { PCFShadowMap } from 'three';
	import { Canvas } from '@threlte/core';
	import { T } from '@threlte/core';
	import type { RuntimeScene } from '$lib/content/scene';
	import type { NavigationGraph } from '@portfolio/project-model';
	import type { CompiledLayoutGeometry } from '@portfolio/layout-core';
	import type { LayoutRoomRegistry } from '@portfolio/project-model';
	import type { ExecutionProgram, ExperienceInterpreterOptions } from '@portfolio/project-model/units';
	import { formatGuideTime } from '@portfolio/camera-core';
	import { createVisitorRuntimeState } from './visitor-runtime-state.svelte';
	import { initialVisitorSurfaceMode } from './visitor-entry';
	import type { TextureLoadScope } from '$lib/museum/materials/texture-cache';
	import { neutralVisitorRoomPresentation } from './room-presentation';
	import VisitorCameraDirector from './VisitorCameraDirector.svelte';
	import VisitorEntities from './VisitorEntities.svelte';
	import VisitorLayoutShell from './VisitorLayoutShell.svelte';
	import WorldEnvironment from '$lib/render/WorldEnvironment.svelte';
	import type { SceneEnvironmentPreset } from '@portfolio/project-model/units';

	let {
		scene,
		geometry,
		rooms,
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
		environment = 'paper'
	}: {
		scene: RuntimeScene;
		geometry: CompiledLayoutGeometry;
		rooms: LayoutRoomRegistry;
		graph: NavigationGraph;
		/** The lowered Experience program. Absent means no guided Experience. */
		program?: ExecutionProgram | null;
		experienceOptions?: ExperienceInterpreterOptions | null;
		entryPresentationId?: string | null;
		runEpoch?: number;
		active?: boolean;
		resolveTexture: (uri: string) => string | null;
		textureScope?: TextureLoadScope | null;
		/** Runtime-safe approved model bytes, resolved by the owning session. */
		modelUrls?: ReadonlyMap<string, string> | null;
		reducedMotion?: boolean;
		mode?: 'preview' | 'public';
		title?: string | null;
		/** S30: welcome | guided | free | presentation, chosen by the head Preview entry. */
		startMode?: 'welcome' | 'guided' | 'free' | 'presentation';
		experienceTitle?: string | null;
		guideStopCount?: number;
		guideSeconds?: number;
		viewLabels?: ReadonlyMap<string, string> | null;
		onExit?: () => void;
		/** Experience review 1 (R5) — the Scene's World environment; Paper by default, never black. */
		environment?: SceneEnvironmentPreset;
	} = $props();

	const visitorState = $derived.by(() => {
		// The run identity, not the component lifetime, creates a fresh runtime: a
		// reused surface must not carry a previous entry's interpreter state.
		void runEpoch;
		return program === null || experienceOptions === null
			? null
			: createVisitorRuntimeState({ program, options: experienceOptions });
	});
	let cameraGap = $state<string | null>(null);
	let surfaceMode = $state<'welcome' | 'guided' | 'free'>(initialVisitorSurfaceMode(mode, startMode));
	let paused = $state(false);
	let placesOpen = $state(false);
	let freeViewId = $state<string | null>(null);
	/** Bumped for every explicit destination boundary, even when the override is null. */
	let destinationEpoch = $state(0);
	/** The authored run is over and the end screen owns the surface. */
	let showEnd = $state(false);
	let traveling = $state(false);
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
		paused = false;
		placesOpen = false;
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
		surfaceMode = 'guided';
		showEnd = false;
		paused = false;
	}
	function chooseFree(): void {
		// A completed interpreter ignores presentation entry. Continue after the
		// end on a fresh neutral run, not the terminal one.
		if (visitorState?.ended === true) visitorState.beginFreeExploration();
		surfaceMode = 'free';
		showEnd = false;
		placesOpen = true;
		freeViewId = null;
		paused = false;
		destinationEpoch += 1;
	}
	function backToTheTour(): void {
		if (visitorState?.canResume === true) visitorState.resume();
		surfaceMode = 'guided';
		showEnd = false;
		freeViewId = null;
		paused = false;
		destinationEpoch += 1;
	}
	function goPrevious(): void {
		// Prev is a Cut: the Experience moves to the previous Stop, and the destination
		// boundary settles the Camera on that Stop's first View with no travel back.
		if (visitorState?.previousStop() !== true) return;
		showEnd = false;
		freeViewId = null;
		destinationEpoch += 1;
	}
	function startAgain(): void {
		visitorState?.restart();
		surfaceMode = 'guided';
		showEnd = false;
		paused = false;
		freeViewId = null;
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
		}
		surfaceMode = 'guided';
		showEnd = false;
		freeViewId = null;
		paused = false;
		destinationEpoch += 1;
	}
	function choosePlace(presentationId: string): void {
		freeViewId = null;
		showEnd = false;
		paused = false;
		if (visitorState?.selectPresentation(presentationId) === true) {
			placesOpen = false;
			destinationEpoch += 1;
		}
	}
	function chooseView(presentationId: string, viewId: string): void {
		if (visitorState?.selectPresentation(presentationId) !== true) return;
		freeViewId = viewId;
		placesOpen = false;
		showEnd = false;
		paused = false;
		destinationEpoch += 1;
	}
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
		untrack(() => runtime.start(entry));
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

	const presentation = $derived.by(() => {
		const record: Record<string, typeof neutralVisitorRoomPresentation> = {};
		for (const room of geometry.rooms) {
			record[room.roomId] = neutralVisitorRoomPresentation;
		}
		return record;
	});

	const isZeroNode = $derived(visitorState === null || visitorState.program.stops.length === 0);
	const canvasDescription = $derived(
		mode === 'public'
			? isZeroNode
				? 'Published project. No guided Experience: drag to orbit, wheel to zoom, right-drag to pan.'
				: 'Published project. Press Right Arrow or Enter to continue, W A S D or drag to look around.'
			: isZeroNode
				? 'Visitor preview. No guided Experience: drag to orbit, wheel to zoom, right-drag to pan. Press Escape to exit preview.'
				: 'Visitor preview. Press Right Arrow or Enter to continue, W A S D or drag to look around. Press Escape to exit preview.'
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
		<Canvas
		createRenderer={(canvas) => perfRenderer(createManagedWebGLRenderer(canvas), 'preview')}
		dpr={[1, 1.5]}
		shadows={PCFShadowMap}
		renderMode={active ? 'always' : 'on-demand'}
	>
			{#if environment === 'paper'}
				<!-- Paper: the Stage's own tone and neutral light, without the grid. Never a black void. -->
				<T.Color attach="background" args={['#e9ebe6']} />
				<T.AmbientLight intensity={0.45} />
				<T.DirectionalLight position={[6, 12, 8]} intensity={1.1} />
				<T.DirectionalLight position={[-8, 6, -6]} intensity={0.35} />
				<T.Mesh rotation.x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
					<T.CircleGeometry args={[90, 48]} />
					<T.MeshLambertMaterial color="#e2e5de" />
				</T.Mesh>
			{:else}
				<T.AmbientLight intensity={0.12} />
				<WorldEnvironment preset={environment} bounds={geometry.bounds ?? null} />
			{/if}
			{#if visitorState}
				<VisitorCameraDirector
					graph={graph}
					visitor={visitorState}
					bounds={geometry.bounds ?? null}
					{runEpoch}
					{active}
					paused={paused || surfaceMode === 'welcome'}
					timeAligned={mode === 'preview'}
					guidedInputEnabled={surfaceMode === 'guided' && !paused && !visitorState.ended}
					suspendGuidance={surfaceMode === 'free'}
					viewOverride={freeViewId}
					{destinationEpoch}
					onCameraGap={(message) => (cameraGap = message)}
					onTraveling={(value) => (traveling = value)}
				/>
			{/if}
			<VisitorLayoutShell {geometry} {presentation} textureScope={textureScope} />
			<VisitorEntities scene={scene} {rooms} textureScope={textureScope} {modelUrls} />
		</Canvas>
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
	{#if surfaceMode === 'welcome' && mode === 'preview'}
		<section class="visitor-card visitor-welcome" role="dialog" aria-modal="true" aria-label="Welcome">
			<p class="overline">Welcome to</p>
			<h1>{experienceTitle ?? publicTitle}</h1>
			{#if visitorState?.program.welcome}<p class="welcome-body">{visitorState.program.welcome}</p>{/if}
			<div class="choices">
				<button
					type="button"
					class="choice primary"
					disabled={visitorState === null || visitorState.program.entryStopId === null}
					onclick={chooseGuided}
				>
					<strong>Take the guided tour</strong>
					<span>{guideStopCount} {guideStopCount === 1 ? 'stop' : 'stops'} · about {formatGuideTime(guideSeconds)}</span>
				</button>
				<button type="button" class="choice" disabled={freePresentations.length === 0} onclick={chooseFree}>
					<strong>Explore freely</strong>
					<span>{freePresentations.length} {freePresentations.length === 1 ? 'place' : 'places'}</span>
				</button>
			</div>
		</section>
	{/if}
	{#if surfaceMode === 'guided' && visitorState !== null && !visitorState.ended && visitorState.state.stopId !== null}
		<nav class="visitor-guided" aria-label="Tour controls">
			<div class="guided-caption">
				<p class="overline">Guided tour · Stop {currentStopNumber} of {visitorState.program.stops.length}</p>
				<strong class="guided-title">{visitorState.currentPresentation?.label ?? 'The tour'}</strong>
				<div class="prog" aria-hidden="true">
					{#each visitorState.program.stops as stop, index (stop.id)}
						<i class:done={index + 1 < currentStopNumber} class:current={index + 1 === currentStopNumber}></i>
					{/each}
				</div>
			</div>
			<div class="guided-actions">
				<button
					type="button"
					class="vbtn"
					disabled={currentStopNumber <= 1}
					title={currentStopNumber <= 1 ? 'This is the first Stop' : 'Cut to the previous Stop'}
					onclick={goPrevious}>← Prev</button
				>
				<button type="button" class="vbtn gold" onclick={() => (paused = !paused)}>{paused ? 'Play' : 'Pause'}</button>
				<button type="button" class="vbtn" disabled={visitorState.state.phase === 'holding' || traveling}
					title={traveling ? 'The authored movement is still arriving' : visitorState.state.phase === 'holding' ? 'The authored hold is still playing' : 'Next stop'}
					onclick={() => visitorState?.continue()}>Next stop →</button>
				<button type="button" class="vbtn" onclick={() => visitorState?.finish()}>Finish tour</button>
				<button type="button" class="vbtn" onclick={chooseFree}>Explore freely</button>
			</div>
		</nav>
	{/if}
	{#if surfaceMode !== 'welcome' && showEnd}
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
			</aside>
		{/if}
		<nav class="visitor-free" aria-label="Free exploration">
			<p class="explore-hint">Drag to look around · click the floor to walk</p>
			{#if visitorState.canResume}
				<button type="button" class="vbtn gold" onclick={backToTheTour}>
					↩ Back to the tour{resumeStopNumber > 0 ? ` · Stop ${resumeStopNumber}` : ''}
				</button>
			{/if}
			{#if visitorState.program.entryStopId !== null && !visitorState.canResume}
				<button type="button" class="vbtn" onclick={startGuidedFromFree}>Start the guided tour</button>
			{/if}
			<button type="button" class="vbtn" onclick={() => (placesOpen = !placesOpen)} aria-expanded={placesOpen}>Places</button>
		</nav>
	{/if}
	{#if cameraGap}
		<p class="visitor-camera-gap" role="status">{cameraGap}</p>
	{/if}
	<p id="visitor-preview-help" class="visitor-help">{canvasDescription}</p>
</div>

<style>
	.visitor-preview {
		--visitor-forest: #11291f;
		--visitor-glass: rgba(14, 30, 25, 0.78);
		--visitor-gold: #d4ad45;
		--visitor-gold-ink: #74560c;
		--visitor-ivory: #f3f0e4;
		--visitor-serif: 'Iowan Old Style', Palatino, Georgia, serif;
		--visitor-sans: var(--shell-sans, system-ui, sans-serif);
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
	/* ---- Chrome: brand left, a gold Preview tab on the top edge, Exit right ---- */
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
	/* ---- Guided tour bar in a bottom gradient ---- */
	.visitor-guided {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 16px;
		padding: 56px 24px 22px;
		background: linear-gradient(to top, rgb(17 41 31 / 0.94) 35%, rgb(17 41 31 / 0));
		color: var(--visitor-ivory);
		z-index: 6;
	}
	.guided-caption {
		display: grid;
		gap: 4px;
		min-width: 0;
	}
	.guided-caption .overline {
		margin: 0;
	}
	.guided-title {
		font: 500 26px/1.15 var(--visitor-serif);
	}
	.prog {
		display: flex;
		gap: 4px;
		margin-top: 8px;
	}
	.prog i {
		display: block;
		width: 26px;
		height: 4px;
		border-radius: 2px;
		background: rgb(243 240 228 / 22%);
	}
	.prog i.done {
		background: rgb(243 240 228 / 70%);
	}
	.prog i.current {
		background: var(--visitor-gold);
	}
	.guided-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: flex-end;
	}
	/* ---- Exploring: hint, way back to the tour, Places ---- */
	.visitor-free {
		position: absolute;
		left: 24px;
		right: 24px;
		bottom: 24px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		z-index: 6;
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
		.choices {
			grid-template-columns: 1fr;
		}
		.visitor-guided {
			padding: 48px 16px 16px;
			align-items: stretch;
			flex-direction: column;
		}
		.guided-actions {
			justify-content: flex-start;
		}
		.visitor-free {
			left: 12px;
			right: 12px;
			bottom: 16px;
		}
		.visitor-places {
			width: 100%;
			border-radius: 0;
		}
	}
</style>
