<script lang="ts">
	/**
	 * PR 1 Canvas candidate 1 — **stock Threlte `<Canvas>` with a thin adapter**.
	 *
	 * The comparison keeps Threlte's DOM canvas, camera/task contexts, resize and
	 * scheduler. Biskiq owns readiness, recovery, error reporting and retirement
	 * through `createGenerationOwner`; the adapter is the facade the Canvas receives
	 * as `createRenderer`.
	 *
	 * Production-equivalent props are named here exactly as the shipped Canvases
	 * name them: `PCFShadowMap`, `NoToneMapping`, DPR 1–1.5 and the surface's render
	 * mode. `autoRender` is false until the generation is ready, so Threlte's
	 * scheduler cannot draw on an uninitialized renderer. The gated child is only
	 * mounted after readiness.
	 *
	 * A fresh generation remounts this `<Canvas>` through the outer key, which is
	 * what gives the recovery path a genuinely new DOM canvas.
	 */
	import { Canvas } from '@threlte/core';
	import { onDestroy } from 'svelte';
	import { NoToneMapping, PCFShadowMap } from 'three';
	import { CanvasLifecycle, type LifecycleSnapshot } from './canvas-lifecycle';
	import { createGenerationOwner, type GenerationSnapshot } from './generation-owner';
	import HarnessProbe from './harness-probe.svelte';
	import type { CanvasHostFactory, HostAttempt, HostProbe } from './host-types';

	const DPR: [number, number] = [1, 1.5];

	let {
		factory,
		probe = null,
		renderMode = 'on-demand',
		onPointerCancel,
		onSnapshot
	}: {
		factory: CanvasHostFactory;
		probe?: HostProbe | null;
		renderMode?: 'always' | 'on-demand' | 'manual';
		onPointerCancel?: (reason: string) => void;
		onSnapshot?: (snapshot: LifecycleSnapshot) => void;
	} = $props();

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
	let attempt: HostAttempt = 'auto';

	const lifecycle = new CanvasLifecycle({
		onChange(next) {
			snapshot = next;
			generation = next.generation;
			ready = next.phase === 'ready';
			unavailable = next.phase === 'unavailable';
			attempt = next.attempt;
			onSnapshot?.(next);
		}
	});
	lifecycle.begin();
	// The episode timer is real work after readiness; teardown must clear it even
	// when the Canvas subtree already retired the generation.
	onDestroy(() => lifecycle.dispose());

	function ownerChanged(next: GenerationSnapshot): void {
		if (next.state === 'ready') {
			lifecycle.ready(next.backend ?? 'webgl2');
			return;
		}
		if (next.state !== 'failed') return;
		// The existing Stage pointer-cancel seam runs before the retired canvas
		// leaves the page, so a captured gesture cannot survive into a new generation.
		onPointerCancel?.(next.failure ?? 'init-rejected');
		lifecycle.attemptFailed(next.failure ?? 'init-rejected');
	}

	function createRenderer(canvas: HTMLCanvasElement): never {
		const owner = createGenerationOwner(factory, {
			canvas,
			generation,
			mode: attempt,
			onChange: ownerChanged
		});
		owner.start();
		return owner.facade as never;
	}
</script>

<div class="host" role="application" data-canvas-host="stock" data-phase={snapshot.phase} data-backend={snapshot.backend ?? ''} onpointercancel={() => onPointerCancel?.('pointer-cancel')}>
	{#if unavailable}
		<div class="unavailable" role="alert" data-renderer-unavailable>
			<p>Rendering is unavailable on this device.</p>
			<button type="button" onclick={() => lifecycle.retry()}>Retry</button>
		</div>
	{:else}
		{#key generation}
			<Canvas
				createRenderer={createRenderer as never}
				dpr={DPR}
				renderMode={renderMode}
				autoRender={ready}
				shadows={PCFShadowMap}
				toneMapping={NoToneMapping}
			>
				{#if ready && probe !== null}
					<HarnessProbe {probe} />
				{/if}
			</Canvas>
		{/key}
	{/if}
</div>

<style>
	.host {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
	}
	.unavailable {
		display: grid;
		place-content: center;
		gap: 0.75rem;
		width: 100%;
		height: 100%;
		background: #e9ebe6;
		color: #11291f;
		font: 500 14px system-ui, sans-serif;
		text-align: center;
	}
</style>
