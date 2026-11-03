<script lang="ts">
	import { createManagedWebGLRenderer } from '$lib/render/managed-webgl-renderer';
	import { perfMark, perfRenderer } from '$lib/platform/perf-marks';
	import { onMount } from 'svelte';
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
		onExit
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
		if (startMode === 'presentation' || surfaceMode === 'guided') visitorState.start(entryPresentationId);
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
			<T.Color attach="background" args={[0x050508]} />
			<T.Fog attach="fog" args={[0x050508, 22, 54]} />
			<T.AmbientLight intensity={0.2} />
			<T.DirectionalLight position={[2, 8, 5]} color="#c9d1df" intensity={0.7} />
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
	{#if surfaceMode === 'welcome' && mode === 'preview'}
		<section class="visitor-welcome" role="dialog" aria-modal="true" aria-label="Welcome">
			<p class="overline">Visitor preview</p>
			<h1>{experienceTitle ?? publicTitle}</h1>
			{#if visitorState?.program.welcome}<p class="welcome-body">{visitorState.program.welcome}</p>{/if}
			<div class="choices">
				<button
					type="button"
					class="choice"
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
			<span class="guided-caption">
				<span class="overline">Guided tour</span>
				<strong>{visitorState.currentPresentation?.label ?? 'The tour'}</strong>
				<span class="guided-position">Stop {currentStopNumber} of {visitorState.program.stops.length}</span>
			</span>
			<div class="guided-actions">
				<button type="button" class="primary" onclick={() => (paused = !paused)}>{paused ? 'Resume' : 'Pause'}</button>
				<button type="button" disabled={visitorState.state.phase === 'holding' || traveling}
					title={traveling ? 'The authored movement is still arriving' : visitorState.state.phase === 'holding' ? 'The authored hold is still playing' : 'Next stop'}
					onclick={() => visitorState?.continue()}>Next stop</button>
				<button type="button" onclick={() => visitorState?.finish()}>Finish tour</button>
				<button type="button" onclick={chooseFree}>Explore freely</button>
			</div>
		</nav>
	{/if}
	{#if surfaceMode !== 'welcome' && showEnd}
		<section class="visitor-end" role="dialog" aria-modal="true" aria-label="End of the tour">
			<p class="overline">End of the tour</p>
			<h1>{experienceTitle ?? publicTitle}</h1>
			<p class="welcome-body">Keep exploring — including views the tour skipped.</p>
			<div class="choices">
				<button type="button" class="choice" disabled={freePresentations.length === 0} onclick={chooseFree}>
					<strong>Keep exploring</strong>
					<span>{freePresentations.length} {freePresentations.length === 1 ? 'place' : 'places'}</span>
				</button>
				<button type="button" class="choice" onclick={startAgain}>
					<strong>Start the tour again</strong>
					<span>{guideStopCount} {guideStopCount === 1 ? 'stop' : 'stops'}</span>
				</button>
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
			{#if visitorState.program.entryStopId !== null && !visitorState.canResume}
				<button type="button" class="resume-tour" onclick={startGuidedFromFree}>
					Start the guided tour
				</button>
			{/if}
			{#if visitorState.canResume}
				<button type="button" class="resume-tour" onclick={backToTheTour}>
					Back to the tour{resumeStopNumber > 0 ? ` · Stop ${resumeStopNumber}` : ''}
				</button>
			{/if}
			<button type="button" onclick={() => (placesOpen = !placesOpen)} aria-expanded={placesOpen}>Places</button>
		</nav>
	{/if}
	{#if cameraGap}
		<p class="visitor-camera-gap" role="status">{cameraGap}</p>
	{/if}
	<div class="visitor-pill" role="status">
		{#if mode === 'public'}
			<span class="pill-label">PUBLISHED · {publicTitle}</span>
		{:else}
			<span class="pill-label">VISITOR PREVIEW · Viewing Current Draft</span>
			{#if onExit}
				<button type="button" class="pill-exit" onclick={onExit}>✕ Exit Preview (Esc)</button>
			{/if}
		{/if}
	</div>
	<p id="visitor-preview-help" class="visitor-help">{canvasDescription}</p>
</div>

<style>
	.visitor-preview {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		background: #050508;
		overflow: hidden;
	}
	.visitor-canvas {
		position: absolute;
		inset: 0;
		outline: none;
	}
	.visitor-canvas:focus-visible {
		box-shadow: inset 0 0 0 1px #2f8cff;
	}
	.visitor-canvas :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}
	.visitor-pill {
		position: absolute;
		top: 0.75rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.45rem 0.7rem;
		border: 1px solid rgb(47 140 255 / 45%);
		border-radius: 999px;
		background: rgb(5 5 8 / 82%);
		color: #f4f0e9;
		font: 600 0.72rem/1.2 Inter, ui-sans-serif, system-ui, sans-serif;
		white-space: nowrap;
		z-index: 5;
	}
	.pill-exit {
		padding: 0.3rem 0.55rem;
		border: 1px solid #635a6f;
		border-radius: 999px;
		background: #292632;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.pill-exit:hover {
		border-color: #c9a9ff;
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
		background: rgb(5 5 8 / 88%);
		color: #f4d7a8;
		font: 500 0.72rem/1.35 Inter, ui-sans-serif, system-ui, sans-serif;
		z-index: 5;
	}
	/* ---- S30 visitor surface: welcome, guided controls, Places, end ---- */
	.visitor-welcome,
	.visitor-end {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(520px, calc(100% - 2rem));
		padding: 28px 28px 24px;
		border-radius: 20px;
		background: var(--shell-glass-dark, rgba(14, 30, 25, 0.9));
		color: var(--shell-ink-light, #eef1ec);
		box-shadow: 0 24px 60px rgb(0 0 0 / 0.45);
		z-index: 8;
	}
	.overline {
		margin: 0 0 6px;
		color: var(--shell-gold, #d4ad45);
		font: 600 11px var(--shell-sans, system-ui, sans-serif);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.visitor-welcome h1,
	.visitor-end h1 {
		margin: 0 0 10px;
		font: 32px/1.1 var(--shell-serif, Georgia, serif);
	}
	.visitor-end h1 {
		font-size: 28px;
	}
	.welcome-body {
		margin: 0 0 16px;
		color: var(--shell-ink-quiet, #9fb2a5);
		font: 13px/1.5 var(--shell-sans, system-ui, sans-serif);
	}
	.choices {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.choice {
		display: grid;
		gap: 4px;
		padding: 14px;
		border: 1px solid rgb(255 255 255 / 0.16);
		border-radius: 14px;
		background: rgb(255 255 255 / 0.06);
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	.choice:hover:not(:disabled) {
		border-color: var(--shell-gold, #d4ad45);
	}
	.choice strong {
		font: 600 13px var(--shell-sans, system-ui, sans-serif);
	}
	.choice span {
		color: var(--shell-ink-quiet, #9fb2a5);
		font: 12px/1.45 var(--shell-sans, system-ui, sans-serif);
	}
	.visitor-guided {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 24px;
		background: linear-gradient(transparent, rgb(5 5 8 / 0.9));
		z-index: 6;
	}
	.guided-caption {
		display: grid;
		gap: 2px;
	}
	.guided-caption strong {
		font: 24px/1.15 var(--shell-serif, Georgia, serif);
	}
	.guided-position {
		color: var(--shell-ink-quiet, #9fb2a5);
		font: 13px var(--shell-sans, system-ui, sans-serif);
	}
	.guided-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: flex-end;
	}
	.guided-actions button,
	.visitor-free button,
	.place-name,
	.place-view {
		min-height: 44px;
		padding: 0 16px;
		border: 1px solid rgb(255 255 255 / 0.22);
		border-radius: 22px;
		background: rgb(5 5 8 / 72%);
		color: var(--shell-ink-light, #eef1ec);
		font: 600 13px var(--shell-sans, system-ui, sans-serif);
		cursor: pointer;
	}
	.guided-actions .primary {
		border-color: transparent;
		background: var(--shell-gold, #d4ad45);
		color: #2a2208;
	}
	.visitor-free {
		position: absolute;
		left: 24px;
		bottom: 24px;
		display: flex;
		gap: 8px;
		z-index: 6;
	}
	.visitor-places {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: 272px;
		overflow-y: auto;
		padding: 12px 12px 84px;
		border-radius: 0 16px 16px 0;
		background: var(--shell-glass-dark, rgba(14, 30, 25, 0.94));
		color: var(--shell-ink-light, #eef1ec);
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
		font: 16px var(--shell-serif, Georgia, serif);
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
		border: 0;
		background: transparent;
		text-align: left;
		color: var(--shell-gold, #d4ad45);
		font: 11px var(--shell-sans, system-ui, sans-serif);
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}
	.place-views {
		display: grid;
		gap: 6px;
		overflow-wrap: anywhere;
	}
	.place-view {
		border-radius: 8px;
		text-align: left;
		font-weight: 500;
		font-size: 12px;
	}
	.visitor-help {
		position: absolute;
		left: -9999px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
	@media (max-width: 760px) {
		.choices {
			grid-template-columns: 1fr;
		}
		.visitor-guided {
			padding: 16px;
			align-items: flex-start;
			flex-direction: column;
		}
		.visitor-places {
			width: 100%;
			border-radius: 0;
		}
	}
</style>
