<script lang="ts">
	/**
	 * PR 1 Canvas candidate 2 — **ready-gated Canvas**.
	 *
	 * The host binds one DOM canvas per generation, awaits the renderer's actual
	 * `init()`, and only then mounts the exported `createThrelteContext` plus the
	 * gated child. Threlte still owns resize, tasks and the scheduler.
	 *
	 * The renderer is supplied through a synchronous factory for the exact canvas
	 * that was initialized. The lifecycle, recovery and retirement rules are the
	 * same `CanvasLifecycle` and `createGenerationOwner` the stock candidate uses;
	 * only the DOM and the mount ordering differ.
	 */
	import { CanvasLifecycle, type LifecycleSnapshot } from './canvas-lifecycle';
	import { createGenerationOwner } from './generation-owner';
	import HarnessProbe from './harness-probe.svelte';
	import ReadyContext from './ready-context.svelte';
	import type { CanvasHostFactory, HostAttempt, HostProbe, HostRenderer } from './host-types';

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
	let canvas = $state.raw<HTMLCanvasElement | null>(null);
	let dom = $state.raw<HTMLDivElement | null>(null);
	let renderer = $state.raw<HostRenderer | null>(null);

	const lifecycle = new CanvasLifecycle({
		onChange(next) {
			snapshot = next;
			generation = next.generation;
			ready = next.phase === 'ready';
			unavailable = next.phase === 'unavailable';
			attempt = next.attempt;
			if (!ready) renderer = null;
			onSnapshot?.(next);
		}
	});
	lifecycle.begin();

	$effect(() => {
		const element = canvas;
		// `generation` is a dependency so a remount retires the previous owner even
		// when the DOM binding itself does not change identity in a test double.
		void generation;
		if (element === null) return;
		let retired = false;
		const owner = createGenerationOwner(factory, {
			canvas: element,
			generation,
			mode: attempt,
			onChange(next) {
				if (retired) return;
				if (next.state === 'ready') {
					renderer = owner.facade;
					lifecycle.ready(next.backend ?? 'webgl2');
					return;
				}
				if (next.state !== 'failed') return;
				onPointerCancel?.(next.failure ?? 'init-rejected');
				lifecycle.attemptFailed(next.failure ?? 'init-rejected');
			}
		});
		owner.start();
		return () => {
			retired = true;
			void owner.retire();
		};
	});
</script>

<div class="host" role="application" data-canvas-host="ready-gated" data-phase={snapshot.phase} data-backend={snapshot.backend ?? ''} onpointercancel={() => onPointerCancel?.('pointer-cancel')}>
	{#if unavailable}
		<div class="unavailable" role="alert" data-renderer-unavailable>
			<p>Rendering is unavailable on this device.</p>
			<button type="button" onclick={() => lifecycle.retry()}>Retry</button>
		</div>
	{:else}
		<div class="frame" bind:this={dom}>
			{#key generation}
				<canvas bind:this={canvas} class="canvas" tabindex="-1" aria-hidden="true"></canvas>
			{/key}
		</div>
		{#if ready && renderer !== null && canvas !== null && dom !== null}
			<ReadyContext {canvas} {dom} {renderer} {renderMode}>
				{#if probe !== null}
					<HarnessProbe {probe} />
				{/if}
			</ReadyContext>
		{/if}
	{/if}
</div>

<style>
	.host {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
	}
	.frame {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}
	.canvas {
		display: block;
		width: 100%;
		height: 100%;
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
