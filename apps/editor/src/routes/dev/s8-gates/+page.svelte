<script lang="ts">
	/**
	 * Dev-only PR B gate runner. It is not a product route and is never imported
	 * by the editor or visitor surfaces.
	 *
	 * `?gate=highlight` draws the frozen 192 px studio sphere at roughness 0.2 and
	 * 0.8 through the production inspection readback. `?gate=fidelity` runs the
	 * linear-target sampling chart (`./fidelity.ts`). `?gate=residency` steps the
	 * real Finish-view cache through the plan's 128/192/256/384 MiB targets and
	 * adds one 4096² RGBA8 transient **with its complete mip chain** at each step.
	 * On WebGPU the transient runs inside out-of-memory and validation error
	 * scopes; on WebGL2 the context and `getError` are checked. A step whose
	 * allocation reports an error, loses the device or exceeds the time budget is
	 * a failure, not a recovery.
	 *
	 * The highlight gate reads peak and connected half-peak area from a linear
	 * half-float readback of the same scene, and clipping from the production
	 * 8-bit sRGB thumbnail, as the plan's "linear metal-sphere highlight" with
	 * "<1% clipped in final sRGB" requires.
	 *
	 * The page reports what it observed. It does not label a software WebGL2
	 * adapter as the M2 GPU, and it does not turn a completed allocation into a
	 * qualified ceiling.
	 */
	import { onDestroy } from 'svelte';
	import { T } from '@threlte/core';
	import {
		Color,
		DataTexture,
		HalfFloatType,
		LinearFilter,
		LinearMipmapLinearFilter,
		LinearSRGBColorSpace,
		NoColorSpace,
		PerspectiveCamera,
		RenderTarget,
		RGBAFormat,
		Scene,
		UnsignedByteType,
		type Texture
	} from 'three';
	import type { WebGPURenderer } from 'three/webgpu';
	import { page } from '$app/state';
	import { renderLinearFrame } from './linear-readback';
	import { runFidelity, type FidelityResult } from './fidelity';
	import CanvasHost from '$lib/render/CanvasHost.svelte';
	import type { CanvasRendererState } from '$lib/render/renderer-context';
	import {
		createInspectionScene,
		renderInspectionFrame
	} from '$lib/render/materials/inspection';
	import {
		DEFAULT_FINISH_VIEW_BUDGET_BYTES,
		acquireFinishViews,
		finishViewStats,
		releaseFinishViewsForScope,
		setFinishViewBudget,
		type FinishViewGeneration
	} from '$lib/render/resources/finish-views';
	import {
		releaseTextureScope,
		type TextureLoadScope
	} from '$lib/render/resources/texture-store';
	import { createMaterialStore, type MaterialStore } from '$lib/render/resources/material-store';
	import {
		S8_RESIDENCY_TARGETS_MIB,
		S8_TRANSIENT_BYTES,
		S8_TRANSIENT_LEVELS,
		analyzeHighlightFrame,
		analyzeLinearHighlight,
		createResidencyTransient,
		highlightVerdict,
		residencyViewsForTarget,
		type HighlightMetric,
		type LinearHighlightMetric
	} from '$lib/dev/s8-gate-metrics';

	type GateName = 'highlight' | 'residency' | 'fidelity';
	type HighlightVariant = {
		radianceScale: number;
		/** Outside the plan's nominal → half sequence; recorded, never adopted. */
		exploratory?: boolean;
		metrics: HighlightMetric[];
		linear: LinearHighlightMetric[];
		peakRatio: number;
		pass: boolean;
		reasons: string[];
	};
	type HighlightResult = {
		gate: 'highlight';
		backend: string;
		adapter: string;
		softwareAdapter: boolean;
		dpr: number;
		variants: HighlightVariant[];
		exploratory: HighlightVariant[];
		adoptedRadianceScale: number | null;
		pass: boolean;
		reasons: string[];
	};
	type ResidencyStep = {
		targetMiB: number;
		estimatedBytes: number;
		views: number;
		uploadMs: number;
		transientMs: number;
		transientBytes: number;
		transientLevelsExpected: number;
		transientLevelsObserved: number | null;
		transientErrors: string[];
		recovered: boolean;
	};
	type ResidencyResult = {
		gate: 'residency';
		backend: string;
		adapter: string;
		softwareAdapter: boolean;
		dpr: number;
		steps: ResidencyStep[];
		firstFailure: string | null;
		maxPassedMiB: number;
		note: string;
	};
	type GateResult = HighlightResult | ResidencyResult | FidelityResult;

	const MIB = 1024 * 1024;
	const VIEW_SIZE = 1024;
	const STEP_BUDGET_MS = 20_000;
	const gate = (page.url.searchParams.get('gate') ?? 'highlight') as GateName;
	const requestedDpr = Number(page.url.searchParams.get('dpr') ?? '1');
	/**
	 * Optional exploratory scales for an owner decision (e.g. `?explore=0.25`).
	 * The plan permits exactly nominal and one half-radiance retry; anything here
	 * is evidence for a recipe change, never an adopted rig or a gate pass.
	 */
	const exploreScales = (page.url.searchParams.get('explore') ?? '')
		.split(',')
		.map(Number)
		.filter((value) => Number.isFinite(value) && value > 0 && value !== 1 && value !== 0.5);

	let rendererState = $state<CanvasRendererState | null>(null);
	let status = $state('waiting for a renderer');
	let result = $state<GateResult | null>(null);
	let started = false;

	async function describeAdapter(
		renderer: WebGPURenderer
	): Promise<{ adapter: string; software: boolean }> {
		if (rendererState?.backend === 'webgl2') {
			try {
				const gl = (
					renderer as unknown as {
						backend?: { gl?: WebGL2RenderingContext };
					}
				).backend?.gl;
				if (gl === undefined) return { adapter: 'unknown', software: false };
				const extension = gl.getExtension('WEBGL_debug_renderer_info');
				const adapter = extension === null
					? 'unknown'
					: String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL));
				return { adapter, software: /swiftshader|llvmpipe|software/i.test(adapter) };
			} catch {
				return { adapter: 'unknown', software: false };
			}
		}
		try {
			const gpu = (navigator as unknown as {
				gpu?: { requestAdapter(): Promise<{ info?: Record<string, unknown> } | null> };
			}).gpu;
			const info = (await gpu?.requestAdapter())?.info;
			const adapter = info === undefined
				? 'unknown'
				: [info.vendor, info.architecture, info.device, info.description]
						.filter((value) => typeof value === 'string' && value.length > 0)
						.join(' ');
			return { adapter: adapter || 'unknown', software: /swiftshader|llvmpipe|software/i.test(adapter) };
		} catch {
			return { adapter: 'unknown', software: false };
		}
	}

	async function renderHighlightVariant(
		renderer: WebGPURenderer,
		radianceScale: number,
		store: MaterialStore
	): Promise<HighlightVariant> {
		const metrics: HighlightMetric[] = [];
		const linear: LinearHighlightMetric[] = [];
		for (const roughness of [0.2, 0.8]) {
			const lease = store.acquire({
				kind: 'standard',
				color: 0xffffff,
				roughness,
				metalness: 1
			});
			const inspection = createInspectionScene({
				renderer,
				material: lease.material,
				kind: 'sphere',
				rig: 'studio',
				radianceScale
			});
			try {
				const frame = await renderInspectionFrame({
					renderer,
					scene: inspection.scene,
					camera: inspection.camera,
					size: 192
				});
				if (frame === null) throw new Error(`The ${roughness} inspection readback was refused.`);
				metrics.push(analyzeHighlightFrame(frame, roughness));
				linear.push(
					analyzeLinearHighlight(
						await renderLinearFrame(
							renderer,
							inspection.scene,
							inspection.camera,
							192,
							rendererState?.backend ?? 'webgpu'
						),
						roughness
					)
				);
			} finally {
				inspection.dispose();
				lease.release();
			}
		}
		const [low, high] = metrics;
		const verdict = highlightVerdict(low!, high!, { low: linear[0]!, high: linear[1]! });
		return { radianceScale, metrics, linear, ...verdict };
	}

	async function runHighlight(renderer: WebGPURenderer): Promise<HighlightResult> {
		const store = createMaterialStore();
		let nominal: HighlightVariant;
		const variants: HighlightVariant[] = [];
		const exploratory: HighlightVariant[] = [];
		try {
			nominal = await renderHighlightVariant(renderer, 1, store);
			variants.push(nominal);
			if (!nominal.pass) variants.push(await renderHighlightVariant(renderer, 0.5, store));
			for (const scale of exploreScales) {
				exploratory.push({ ...(await renderHighlightVariant(renderer, scale, store)), exploratory: true });
			}
		} finally {
			store.dispose();
		}
		const adopted = variants.find((variant) => variant.pass) ?? null;
		const adapter = await describeAdapter(renderer);
		return {
			gate: 'highlight',
			backend: rendererState?.backend ?? 'unknown',
			adapter: adapter.adapter,
			softwareAdapter: adapter.software,
			dpr: requestedDpr,
			variants,
			exploratory,
			adoptedRadianceScale: adopted?.radianceScale ?? null,
			pass: adopted !== null,
			reasons: adopted === null
				? variants.flatMap((variant) => variant.reasons.map((reason) => `${variant.radianceScale}: ${reason}`))
				: []
		};
	}

	function makeViewTexture(): Texture {
		const texture = new DataTexture(
			new Uint8Array(VIEW_SIZE * VIEW_SIZE * 4),
			VIEW_SIZE,
			VIEW_SIZE,
			RGBAFormat,
			UnsignedByteType
		);
		texture.colorSpace = NoColorSpace;
		texture.generateMipmaps = true;
		texture.minFilter = LinearMipmapLinearFilter;
		texture.magFilter = LinearFilter;
		texture.needsUpdate = true;
		return texture;
	}

	async function upload(renderer: WebGPURenderer, texture: Texture): Promise<void> {
		const initTexture = (renderer as unknown as { initTexture?: (value: Texture) => unknown })
			.initTexture;
		if (typeof initTexture !== 'function') {
			throw new Error('This renderer has no initTexture upload hook.');
		}
		await initTexture.call(renderer, texture);
	}

	type GpuDevice = {
		pushErrorScope(filter: 'out-of-memory' | 'validation'): void;
		popErrorScope(): Promise<{ message: string } | null>;
		lost: Promise<{ message: string }>;
	};
	let deviceLost: string | null = null;

	function backendOf(renderer: WebGPURenderer): {
		device?: GpuDevice;
		gl?: WebGL2RenderingContext;
		get(texture: Texture): Record<string, unknown> | undefined;
	} {
		return (renderer as unknown as { backend: ReturnType<typeof backendOf> }).backend;
	}

	/**
	 * Observe allocation failure the backend would otherwise report
	 * asynchronously: WebGPU error scopes and device loss, or a lost WebGL2
	 * context / GL_OUT_OF_MEMORY.
	 */
	function beginAllocationProbe(renderer: WebGPURenderer): { end(): Promise<string[]> } {
		const backend = backendOf(renderer);
		const device = backend.device;
		if (device !== undefined) {
			void device.lost.then((info) => (deviceLost = info.message || 'device lost'));
			device.pushErrorScope('out-of-memory');
			device.pushErrorScope('validation');
			return {
				async end() {
					const validation = await device.popErrorScope();
					const memory = await device.popErrorScope();
					const errors: string[] = [];
					if (memory !== null) errors.push(`out-of-memory: ${memory.message}`);
					if (validation !== null) errors.push(`validation: ${validation.message}`);
					if (deviceLost !== null) errors.push(`device lost: ${deviceLost}`);
					return errors;
				}
			};
		}
		const gl = backend.gl;
		// Drain stale flags so the reading belongs to this allocation. Bounded: a
		// lost context reports CONTEXT_LOST_WEBGL on every call.
		for (let drain = 0; gl !== undefined && drain < 16; drain += 1) {
			if (gl.getError() === gl.NO_ERROR) break;
		}
		return {
			async end() {
				if (gl === undefined) return ['no backend error channel'];
				const errors: string[] = [];
				if (gl.isContextLost()) errors.push('context lost');
				const code = gl.getError();
				if (code === gl.OUT_OF_MEMORY) errors.push('GL_OUT_OF_MEMORY');
				else if (code !== gl.NO_ERROR) errors.push(`GL error 0x${code.toString(16)}`);
				return errors;
			}
		};
	}

	/** The mip levels the backend actually allocated for `texture`, when readable. */
	function observedMipLevels(renderer: WebGPURenderer, texture: Texture): number | null {
		const backend = backendOf(renderer);
		const data = backend.get(texture);
		if (backend.device !== undefined) {
			const gpu = data?.texture as { mipLevelCount?: number } | undefined;
			return typeof gpu?.mipLevelCount === 'number' ? gpu.mipLevelCount : null;
		}
		const gl = backend.gl;
		const handle = data?.textureGPU as WebGLTexture | undefined;
		if (gl === undefined || handle === undefined) return null;
		const previous = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null;
		gl.bindTexture(gl.TEXTURE_2D, handle);
		const levels = gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_IMMUTABLE_LEVELS) as number | null;
		gl.bindTexture(gl.TEXTURE_2D, previous);
		return typeof levels === 'number' && levels > 0 ? levels : null;
	}

	async function runResidency(renderer: WebGPURenderer): Promise<ResidencyResult> {
		const scopeId = `gate-residency-${Date.now().toString(36)}`;
		const owner = `gate-residency-${Math.random().toString(36).slice(2)}`;
		const generation: FinishViewGeneration = { owner, generation: 0 };
		const scope: TextureLoadScope = { scopeId, loader: async () => makeViewTexture() };
		const leases: Awaited<ReturnType<typeof acquireFinishViews>>[] = [];
		const steps: ResidencyStep[] = [];
		let firstFailure: string | null = null;
		let maxPassedMiB = 0;
		let previousViews = 0;
		setFinishViewBudget(384 * MIB);
		try {
			for (const targetMiB of S8_RESIDENCY_TARGETS_MIB) {
				const desired = residencyViewsForTarget(targetMiB);
				const batch = Array.from({ length: Math.max(0, desired - previousViews) }, (_, index) => {
					const number = previousViews + index;
					return {
						view: `gate-${number}`,
						uri: `/s8-gates/view-${number}.png`,
						role: 'color' as const
					};
				});
				previousViews += batch.length;
				const startedAt = performance.now();
				const lease = await acquireFinishViews(batch, scope, undefined, generation);
				leases.push(lease);
				if (lease.issues.length > 0) {
					firstFailure = `${targetMiB} MiB: ${lease.issues[0]!.code}`;
					break;
				}
				const steadyProbe = beginAllocationProbe(renderer);
				for (const texture of Object.values(lease.views)) await upload(renderer, texture);
				const steadyErrors = await steadyProbe.end();
				const uploadMs = performance.now() - startedAt;
				if (steadyErrors.length > 0) {
					firstFailure = `${targetMiB} MiB steady upload: ${steadyErrors[0]}`;
					break;
				}
				if (uploadMs > STEP_BUDGET_MS) {
					firstFailure = `${targetMiB} MiB: upload took ${Math.round(uploadMs)} ms`;
					break;
				}
				// A transient upload beyond the proposed steady ceiling, with its full
				// mip chain. It is released immediately, so the next step starts from
				// the steady working set.
				const transientStarted = performance.now();
				const transient = createResidencyTransient();
				let recovered = true;
				let transientErrors: string[] = [];
				let transientLevelsObserved: number | null = null;
				try {
					const probe = beginAllocationProbe(renderer);
					await upload(renderer, transient);
					renderer.render(new Scene(), new PerspectiveCamera());
					transientLevelsObserved = observedMipLevels(renderer, transient);
					transientErrors = await probe.end();
					if (transientErrors.length > 0) {
						recovered = false;
						firstFailure = `${targetMiB} MiB transient: ${transientErrors[0]}`;
					} else if (transientLevelsObserved !== null && transientLevelsObserved < S8_TRANSIENT_LEVELS) {
						recovered = false;
						firstFailure = `${targetMiB} MiB transient allocated ${transientLevelsObserved}/${S8_TRANSIENT_LEVELS} mip levels`;
					}
				} catch (error) {
					recovered = false;
					firstFailure = `${targetMiB} MiB transient: ${error instanceof Error ? error.message : String(error)}`;
				} finally {
					transient.dispose();
				}
				const transientMs = performance.now() - transientStarted;
				if (recovered && transientMs > STEP_BUDGET_MS) {
					recovered = false;
					firstFailure = `${targetMiB} MiB transient took ${Math.round(transientMs)} ms`;
				}
				steps.push({
					targetMiB,
					estimatedBytes: finishViewStats().bytes,
					views: previousViews,
					uploadMs,
					transientMs,
					transientBytes: S8_TRANSIENT_BYTES,
					transientLevelsExpected: S8_TRANSIENT_LEVELS,
					transientLevelsObserved,
					transientErrors,
					recovered
				});
				if (!recovered) break;
				maxPassedMiB = targetMiB;
			}
		} catch (error) {
			firstFailure = error instanceof Error ? error.message : String(error);
		} finally {
			for (const lease of leases) lease.release();
			releaseFinishViewsForScope(scopeId);
			releaseTextureScope(scopeId);
			setFinishViewBudget(DEFAULT_FINISH_VIEW_BUDGET_BYTES);
		}
		const adapter = await describeAdapter(renderer);
		return {
			gate: 'residency',
			backend: rendererState?.backend ?? 'unknown',
			adapter: adapter.adapter,
			softwareAdapter: adapter.software,
			dpr: requestedDpr,
			steps,
			firstFailure,
			maxPassedMiB,
			note: 'Estimated Finish-view RGBA8 mip bytes plus a full-chain 4096² transient; allocation errors are observed through WebGPU error scopes or WebGL2 getError/context loss. There is no device GPU-memory reading.'
		};
	}

	async function run(state: CanvasRendererState): Promise<void> {
		if (started || state.renderer === null) return;
		started = true;
		status = `running ${gate} on ${state.backend ?? 'unknown'}`;
		try {
			result =
				gate === 'residency'
					? await runResidency(state.renderer)
					: gate === 'fidelity'
						? await runFidelity(
								state.renderer,
								state.backend ?? 'unknown',
								await describeAdapter(state.renderer)
							)
						: await runHighlight(state.renderer);
			status = 'complete';
		} catch (error) {
			status = `failed: ${error instanceof Error ? error.message : String(error)}`;
		} finally {
			document.documentElement.dataset.s8GateReady = 'true';
		}
	}

	onDestroy(() => {
		started = true;
	});
</script>

<svelte:head>
	<title>S8 gates — {gate}</title>
</svelte:head>

<main
	data-s8-gate={gate}
	data-s8-gate-ready="false"
	data-s8-gate-result={result === null ? '' : JSON.stringify(result)}
>
	<header>
		<p class="eyebrow">/dev/s8-gates</p>
		<h1>{gate}</h1>
		<p data-s8-gate-status>{status}</p>
	</header>
	{#if result !== null}
		<pre data-s8-gate-json>{JSON.stringify(result, null, 2)}</pre>
	{/if}
	<div class="viewport" aria-hidden="true">
		<CanvasHost
			surface="preview"
			renderMode="on-demand"
			placeholder="#121218"
			onRendererState={(state) => {
				rendererState = state;
				if (state !== null) void run(state);
			}}
		>
			<T.PerspectiveCamera makeDefault position={[0, 0, 3]} />
			<T.Color attach="background" args={['#121218']} />
		</CanvasHost>
	</div>
</main>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		background: #121218;
		color: #e8e2d8;
		font-family: ui-monospace, monospace;
	}
	main {
		padding: 1rem;
	}
	.eyebrow {
		margin: 0;
		color: #a99f90;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		font-size: 0.7rem;
	}
	h1 {
		margin: 0.25rem 0;
		font-size: 1.1rem;
	}
	pre {
		max-width: 100%;
		overflow: auto;
		padding: 0.75rem;
		background: #1c1c24;
		border: 1px solid #3a3a44;
		font-size: 0.75rem;
	}
	.viewport {
		position: fixed;
		width: 320px;
		height: 320px;
		left: -10000px;
		top: 0;
	}
</style>