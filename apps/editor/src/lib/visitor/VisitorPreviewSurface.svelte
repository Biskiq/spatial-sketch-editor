<script lang="ts">
	import { onMount } from 'svelte';
import { PCFShadowMap } from 'three';
	import { Canvas } from '@threlte/core';
	import { T } from '@threlte/core';
	import type { RuntimeScene } from '$lib/content/scene';
	import type { NavigationGraph } from '@portfolio/project-model';
	import type { CompiledLayoutGeometry } from '@portfolio/layout-core';
	import type { LayoutRoomRegistry } from '@portfolio/project-model';
	import type { ExecutionProgram, ExperienceInterpreterOptions } from '@portfolio/project-model/units';
	import { createVisitorRuntimeState } from './visitor-runtime-state.svelte';
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
		resolveTexture,
		textureScope = null,
		reducedMotion = false,
		mode = 'preview',
		title = null,
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
		resolveTexture: (uri: string) => string | null;
		textureScope?: TextureLoadScope | null;
		reducedMotion?: boolean;
		mode?: 'preview' | 'public';
		title?: string | null;
		onExit?: () => void;
	} = $props();

	const visitorState = $derived.by(() =>
		program === null || experienceOptions === null
			? null
			: createVisitorRuntimeState({ program, options: experienceOptions })
	);
	let cameraGap = $state<string | null>(null);
	const guideFreePresentations = $derived.by(() => {
		if (visitorState === null) return [];
		const stopPresentations = new Set(visitorState.program.stops.map((stop) => stop.presentationId));
		return visitorState.program.presentations.filter((entry) => !stopPresentations.has(entry.id));
	});
	$effect(() => {
		if (visitorState === null) return;
		visitorState.reducedMotion = reducedMotion;
	});
	// A program may arrive after the surface mounts, and a changed program creates
	// a fresh neutral runtime. Enter every instance, not only the first. A
	// Presentation entry starts the same run at its Default View with no Stop.
	$effect(() => {
		if (visitorState === null) return;
		if (entryPresentationId !== null) visitorState.selectPresentation(entryPresentationId);
		else visitorState.enter();
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
		<Canvas dpr={[1, 1.5]} shadows={PCFShadowMap}>
			<T.Color attach="background" args={[0x050508]} />
			<T.Fog attach="fog" args={[0x050508, 22, 54]} />
			<T.AmbientLight intensity={0.2} />
			<T.DirectionalLight position={[2, 8, 5]} color="#c9d1df" intensity={0.7} />
			{#if visitorState}
				<VisitorCameraDirector
					graph={graph}
					visitor={visitorState}
					bounds={geometry.bounds ?? null}
					onCameraGap={(message) => (cameraGap = message)}
				/>
			{/if}
			<VisitorLayoutShell {geometry} {presentation} textureScope={textureScope} />
			<VisitorEntities scene={scene} {rooms} textureScope={textureScope} />
		</Canvas>
	</div>
	{#if guideFreePresentations.length > 0}
		<nav class="visitor-presentations" aria-label="Presentations">
			{#each guideFreePresentations as entry (entry.id)}
				<button type="button" onclick={() => visitorState?.selectPresentation(entry.id)}>
					{entry.label}
				</button>
			{/each}
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
	.visitor-presentations {
		position: absolute;
		left: 0.75rem;
		bottom: 0.75rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		z-index: 5;
	}
	.visitor-presentations button {
		padding: 0.35rem 0.6rem;
		border: 1px solid #635a6f;
		border-radius: 999px;
		background: rgb(5 5 8 / 82%);
		color: #f4f0e9;
		font: 600 0.72rem/1.2 Inter, ui-sans-serif, system-ui, sans-serif;
		cursor: pointer;
	}
	.visitor-presentations button:hover {
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
	.visitor-help {
		position: absolute;
		left: -9999px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
</style>
