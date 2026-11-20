<script lang="ts">
	/**
	 * The product's one Canvas host: stock Threlte `<Canvas>` plus the generation
	 * adapter, selected by PR 1.
	 *
	 * Threlte keeps its DOM canvas, camera/task contexts, resize and scheduler.
	 * Biskiq owns readiness, recovery, error reporting and generation-scoped
	 * retirement:
	 *
	 * - `autoRender` stays false until the observed backend is ready, so the
	 *   scheduler cannot draw on a partially acquired canvas;
	 * - children mount only after readiness, so no task, camera copy or asset lease
	 *   runs against an uninitialized renderer;
	 * - every fresh generation is a **new DOM canvas** through the outer key;
	 * - an exhausted recovery episode shows an in-place unavailable state with
	 *   Retry, keeping the editor shell or visitor chrome around it;
	 * - a captured Stage gesture is cancelled through the existing pointer-cancel
	 *   seam before its canvas leaves the page.
	 *
	 * The host is used by the Stage, Visitor Preview and the published visit, so all
	 * three run the same lifecycle.
	 */
	import { Canvas } from '@threlte/core';
	import { onDestroy, type Snippet } from 'svelte';
	import { PCFShadowMap } from 'three';
	import type { WebGPURenderer } from 'three/webgpu';
	import { CANVAS_TONE_MAPPING, type RendererBackend, type RendererSurface } from './renderer-backend';
	import { CanvasLifecycle, type LifecycleSnapshot } from './canvas-lifecycle';
	import { createRendererGeneration, type GenerationSnapshot } from './renderer-generation';
	import { provideCanvasRendererState } from './renderer-context';

	const DPR: [number, number] = [1, 1.5];

	let {
		surface,
		children,
		renderMode = 'on-demand',
		onBackend = null,
		onReady = null,
		placeholder = null,
		capturedPointers = null
	}: {
		surface: RendererSurface;
		children: Snippet;
		renderMode?: 'always' | 'on-demand' | 'manual';
		/** Reports the observed backend and generation once a canvas is ready. */
		onBackend?: ((backend: RendererBackend, generation: number) => void) | null;
		onReady?: ((ready: boolean) => void) | null;
		/** The surface tone behind Starting/Recovering/Unavailable. */
		placeholder?: string | null;
		/**
		 * The pointer ids the surface currently holds, read immediately before a
		 * generation is replaced. A surface that has no captured gesture omits it.
		 */
		capturedPointers?: (() => readonly number[]) | null;
	} = $props();

	const rendererState = provideCanvasRendererState();
	let snapshot = $state<LifecycleSnapshot>({
		phase: 'starting',
		attempt: 'auto',
		generation: 0,
		backend: null,
		failure: null,
		episodeLosses: 0
	});
	let generation = $state(0);
	let ready = $state(false);
	let unavailable = $state(false);
	let attempt = $state<'auto' | 'webgl2'>('auto');
	let host = $state<HTMLDivElement | undefined>(undefined);
	/** The real renderer of the live generation; the facade is what Threlte holds. */
	let currentRenderer: WebGPURenderer | null = null;

	const lifecycle = new CanvasLifecycle({
		onChange(next) {
			if (next.generation !== generation) cancelPointerGesture();
			snapshot = next;
			generation = next.generation;
			const nextReady = next.phase === 'ready';
			if (nextReady !== ready) {
				rendererState.backend = nextReady ? next.backend : null;
				rendererState.renderer = nextReady ? currentRenderer : null;
				onReady?.(nextReady);
			}
			rendererState.generation = next.generation;
			ready = nextReady;
			unavailable = next.phase === 'unavailable';
			attempt = next.attempt;
			if (nextReady && next.backend !== null) onBackend?.(next.backend, next.generation);
		}
	});
	lifecycle.begin();
	// Teardown must clear the episode timer even when the Canvas subtree already
	// retired the generation.
	onDestroy(() => lifecycle.dispose());

	/**
	 * The existing pointer-cancel seam, not a second gesture authority: the Stage
	 * viewport already listens for `pointercancel`, so a captured drag ends through
	 * the same path a browser-cancelled pointer takes. The surface reports the ids
	 * it actually captured; the host never invents one, because a fabricated id
	 * would not match the live press and the edit would silently survive the
	 * canvas replacement. The host deliberately has no `pointercancel` listener of
	 * its own: this synthetic event bubbles through the viewport, and a forwarding
	 * handler on the host would receive its own dispatch and recurse.
	 */
	function cancelPointerGesture(): void {
		const element = host;
		if (element === undefined) return;
		for (const pointerId of capturedPointers?.() ?? []) {
			const pointer = typeof PointerEvent === 'function'
				? new PointerEvent('pointercancel', { bubbles: true, pointerId })
				: null;
			if (pointer !== null) element.dispatchEvent(pointer);
		}
	}

	function ownerChanged(next: GenerationSnapshot): void {
		if (next.state === 'ready') {
			lifecycle.ready(next.backend ?? 'webgl2');
			return;
		}
		if (next.state !== 'failed') return;
		lifecycle.attemptFailed(next.failure ?? 'init-rejected');
	}

	function createRenderer(canvas: HTMLCanvasElement): never {
		const generationOwner = createRendererGeneration({
			canvas,
			generation,
			attempt,
			surface,
			onChange: ownerChanged
		});
		currentRenderer = generationOwner.renderer;
		generationOwner.start();
		return generationOwner.facade as never;
	}
</script>

<div
	bind:this={host}
	class="canvas-host"
	data-canvas-host={surface}
	data-phase={snapshot.phase}
	data-backend={snapshot.backend ?? ''}
	style:--canvas-placeholder={placeholder ?? '#e9ebe6'}
>
	{#if unavailable}
		<div class="unavailable" role="alert" data-renderer-unavailable>
			<p>Rendering is unavailable on this device.</p>
			<!-- The Stage viewport captures every press inside it; without this the
			     Retry click is retargeted to the Stage and the button never fires. -->
			<button
				type="button"
				onpointerdown={(event) => event.stopPropagation()}
				onclick={(event) => { event.stopPropagation(); lifecycle.retry(); }}
			>Retry</button>
		</div>
	{:else}
		{#key generation}
			<Canvas
				createRenderer={createRenderer as never}
				dpr={DPR}
				renderMode={renderMode}
				autoRender={ready}
				shadows={PCFShadowMap}
				toneMapping={CANVAS_TONE_MAPPING}
			>
				{#if ready}
					{@render children()}
				{/if}
			</Canvas>
		{/key}
	{/if}
</div>

<style>
	.canvas-host {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		background: var(--canvas-placeholder);
	}
	.unavailable {
		display: grid;
		place-content: center;
		gap: 0.75rem;
		width: 100%;
		height: 100%;
		background: var(--canvas-placeholder);
		color: #11291f;
		font: 500 14px system-ui, sans-serif;
		text-align: center;
	}
	.unavailable button {
		justify-self: center;
		padding: 0.4rem 1rem;
		border: 1px solid rgb(17 41 31 / 25%);
		border-radius: 6px;
		background: transparent;
		font: inherit;
		cursor: pointer;
	}
</style>
