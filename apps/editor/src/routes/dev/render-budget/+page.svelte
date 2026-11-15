<script lang="ts">
	/**
	 * E7's bounded bench: three reference Worlds, Stage and visit, rest / orbit /
	 * short drag. The page owns the mount lifecycle and exposes one synchronous
	 * run API on `window.__RENDER_BUDGET__` so the harness can drive it without a
	 * second browser automation dependency. Every number is also visible in the
	 * table, and `Run full matrix` reproduces the evidence by hand.
	 */
	import { onMount, tick } from 'svelte';
	import type { PerspectiveCamera, WebGLRenderer } from 'three';
	import {
		createViewportCameraState,
		evaluateViewport,
		type ViewportEvaluation
	} from '@portfolio/camera-core';
	import { perfMark } from '$lib/platform/perf-marks';
	import VisitorPreviewSurface from '$lib/visitor/VisitorPreviewSurface.svelte';
	import StageBenchSurface from './StageBenchSurface.svelte';
	import VisitBenchSurface from './VisitBenchSurface.svelte';
	import { benchWorld, BENCH_WORLDS, coldStartNavigation, coldStartProgram, type BenchWorld, type BenchWorldId } from './worlds';
	import { pinDevicePixelRatio, probeDebug, readProbe, registerProbeRenderer, releaseProbe, resetProbe, type ProbeSurface } from './probe';
	import { budgetVerdict, PROPOSED_D9_BUDGET, summarize, type RunSummary } from './stats';

	type Surface = 'stage' | 'preview';
	type Pattern = 'rest' | 'orbit' | 'drag';

	type ColdStartResult = {
		readonly world: BenchWorldId;
		readonly mountRequestAtMs: number;
		readonly mountedAtMs: number | null;
		readonly firstFrameAtMs: number | null;
		readonly entryFrameAtMs: number | null;
		readonly mountLatencyMs: number | null;
		readonly firstFrameLatencyMs: number | null;
		readonly entryFrameLatencyMs: number | null;
	};

	type BenchWindow = Window & {
		__BISKIQ_PERF__?: { enabled?: boolean; traceProof?: boolean };
		__BISKIQ_PERF_RECORDS__?: { kind: string; name: string; time: number; detail?: Record<string, unknown> }[];
		__BISKIQ_PERF_ON_RENDERER__?: (renderer: object, surface: string) => void;
		__RENDER_BUDGET__?: {
			worlds: { id: BenchWorldId; label: string }[];
			run: (
				world: BenchWorldId,
				surface: Surface,
				pattern: Pattern,
				seconds?: number,
				options?: { shadows?: boolean }
			) => Promise<RunSummary>;
			coldStart: (world: BenchWorldId) => Promise<ColdStartResult>;
			results: () => RunSummary[];
			budget: typeof PROPOSED_D9_BUDGET;
			debug: () => { surface: ProbeSurface | null; registrations: number; samples: number };
		};
	};

	let mounted = $state<{ world: BenchWorld; surface: Surface } | null>(null);
	let coldWorld = $state<BenchWorld | null>(null);
	let stageEvaluation = $state<ViewportEvaluation | null>(null);
	let visitCamera: PerspectiveCamera | undefined = $state(undefined);
	let shadowsEnabled = $state(true);
	let results = $state<RunSummary[]>([]);
	let status = $state('Ready.');
	let running = $state(false);

	const coldSurface = $derived.by(() => {
		const world = coldWorld;
		if (world === null) return null;
		return {
			world,
			graph: coldStartNavigation(world),
			program: coldStartProgram(world),
			options: { runId: 'gate-c-cold-start', runEpoch: 1 }
		};
	});

	function evaluationFor(world: BenchWorld, azimuthRadians: number, generation: number): ViewportEvaluation {
		const state = createViewportCameraState({
			outputId: 'gate-c-stage',
			sessionEpoch: 'gate-c',
			sourceRevision: world.id,
			pose: {
				target: [...world.camera.target] as [number, number, number],
				azimuthRadians,
				elevationRadians: world.camera.elevationRadians,
				targetPlaneHeightMeters: world.camera.targetPlaneHeightMeters,
				fovYDegrees: world.camera.fovYDegrees
			},
			sceneRadiusMeters: 12,
			reading: '3d'
		});
		const result = evaluateViewport(
			state,
			{ left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 },
			0,
			generation
		);
		if (result.kind !== 'evaluated') throw new Error(`the bench Camera refused: ${result.reason}`);
		return result.evaluation;
	}

	function applyMotion(world: BenchWorld, surface: Surface, pattern: Pattern, elapsedSeconds: number, generation: number): void {
		if (pattern === 'rest') return;
		if (pattern === 'drag' && elapsedSeconds > 2) return;
		const azimuth = pattern === 'orbit' ? elapsedSeconds * 0.35 : Math.min(1, elapsedSeconds / 2) * 1.0;
		if (surface === 'stage') {
			stageEvaluation = evaluationFor(world, azimuth, generation);
			return;
		}
		const camera = visitCamera;
		if (camera === undefined) return;
		const distance = world.camera.targetPlaneHeightMeters / (2 * Math.tan((world.camera.fovYDegrees * Math.PI) / 360));
		const horizontal = Math.cos(world.camera.elevationRadians) * distance;
		camera.position.set(
			world.camera.target[0] + Math.sin(azimuth) * horizontal,
			world.camera.target[1] + Math.sin(world.camera.elevationRadians) * distance,
			world.camera.target[2] + Math.cos(azimuth) * horizontal
		);
		camera.lookAt(world.camera.target[0], world.camera.target[1], world.camera.target[2]);
	}

	function nextFrame(): Promise<number> {
		return new Promise((resolve) => requestAnimationFrame(resolve));
	}

	async function nextFrames(count: number): Promise<void> {
		for (let index = 0; index < count; index += 1) await nextFrame();
	}

	async function mountSurface(world: BenchWorld, surface: Surface, shadows: boolean): Promise<void> {
		shadowsEnabled = shadows;
		stageEvaluation = evaluationFor(world, 0, 1);
		mounted = { world, surface };
		await tick();
		await nextFrames(10);
		pinDevicePixelRatio(1);
	}

	async function run(
		worldId: BenchWorldId,
		surface: Surface,
		pattern: Pattern,
		seconds = 10,
		options: { shadows?: boolean } = {}
	): Promise<RunSummary> {
		if (running) throw new Error('a Gate C run is already in progress');
		running = true;
		const world = benchWorld(worldId);
		const shadows = options.shadows ?? true;
		status = `${world.label} · ${surface} · ${pattern}${shadows ? '' : ' · shadows off'}`;
		try {
			await mountSurface(world, surface, shadows);
			resetProbe();
			const startedAt = performance.now();
			const rafTimes: number[] = [];
			let generation = 1;
			await new Promise<void>((resolve) => {
				const step = (now: number): void => {
					rafTimes.push(now);
					const elapsedSeconds = (now - startedAt) / 1000;
					applyMotion(world, surface, pattern, elapsedSeconds, generation);
					generation += 1;
					if (elapsedSeconds * 1000 >= seconds * 1000) resolve();
					else requestAnimationFrame(step);
				};
				requestAnimationFrame(step);
			});
			const read = readProbe();
			const summary = summarize({
				surface,
				world: world.id,
				pattern,
				windowMs: seconds * 1000,
				samples: read.samples,
				rafTimes,
				shadows
			});
			results = [...results, summary];
			return summary;
		} finally {
			releaseProbe();
			mounted = null;
			await tick();
			await nextFrames(2);
			running = false;
		}
	}

	async function coldStart(worldId: BenchWorldId): Promise<ColdStartResult> {
		if (running) throw new Error('a Gate C run is already in progress');
		running = true;
		const world = benchWorld(worldId);
		status = `${world.label} · cold start`;
		const target = window as BenchWindow;
		target.__BISKIQ_PERF_RECORDS__ = [];
		perfMark('bench:cold-start-request', { world: world.id });
		coldWorld = world;
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 1800));
		const records = target.__BISKIQ_PERF_RECORDS__ ?? [];
		const request = records.find((record) => record.name === 'bench:cold-start-request');
		const mountedMark = records.find((record) => record.name === 'visitor:mounted');
		const firstFrame = records.find((record) => record.name === 'visitor:first-frame');
		const entryFrame = records.find((record) => record.name === 'visitor:entry-frame');
		const result: ColdStartResult = {
			world: world.id,
			mountRequestAtMs: request?.time ?? 0,
			mountedAtMs: mountedMark?.time ?? null,
			firstFrameAtMs: firstFrame?.time ?? null,
			entryFrameAtMs: entryFrame?.time ?? null,
			mountLatencyMs: request !== undefined && mountedMark !== undefined ? mountedMark.time - request.time : null,
			firstFrameLatencyMs: request !== undefined && firstFrame !== undefined ? firstFrame.time - request.time : null,
			entryFrameLatencyMs: request !== undefined && entryFrame !== undefined ? entryFrame.time - request.time : null
		};
		coldWorld = null;
		await tick();
		await nextFrames(2);
		running = false;
		return result;
	}

	async function runMatrix(): Promise<void> {
		const patterns: Pattern[] = ['rest', 'orbit', 'drag'];
		for (const world of BENCH_WORLDS) {
			for (const surface of ['stage', 'preview'] as Surface[]) {
				for (const pattern of patterns) await run(world.id, surface, pattern);
			}
		}
		// One bounded shadow-cost control: the worst World without a shadow pass.
		await run('gallery-wall', 'preview', 'orbit', 10, { shadows: false });
		status = 'Matrix complete.';
	}

	onMount(() => {
		const target = window as BenchWindow;
		target.__BISKIQ_PERF__ = { enabled: true };
		target.__BISKIQ_PERF_ON_RENDERER__ = (renderer, surface) =>
			registerProbeRenderer(renderer as WebGLRenderer, surface as ProbeSurface);
		target.__RENDER_BUDGET__ = {
			worlds: BENCH_WORLDS.map(({ id, label }) => ({ id, label })),
			run,
			coldStart,
			results: () => [...results],
			budget: PROPOSED_D9_BUDGET,
			debug: probeDebug
		};
		return () => {
			delete target.__RENDER_BUDGET__;
			releaseProbe();
		};
	});
</script>

<svelte:head>
	<title>Gate C rendering budget — dev bench</title>
</svelte:head>

<main>
	<aside>
		<p class="eyebrow">/dev/render-budget</p>
		<h1>T2 S0 Gate C — E7</h1>
		<p class="lede">
			Three reference Worlds through the shipped Stage and visitor rendering paths. Fixed 1280 × 720,
			DPR 1, bounded runs. Timing is evidence, not a gate.
		</p>
		<button type="button" onclick={runMatrix} disabled={running}>Run full matrix</button>
		<p class="status">{status}</p>
		<table>
			<thead>
				<tr><th>Surface / World</th><th>Pattern</th><th>Frames</th><th>p50 ms</th><th>p95 ms</th><th>Shadow maps/frame</th><th>D9</th></tr>
			</thead>
			<tbody>
				{#each results as result (result.surface + result.world + result.pattern + String(result.shadows))}
					{@const verdict = budgetVerdict(result)}
					<tr>
						<td>{result.surface} / {result.world}</td>
						<td>{result.pattern}</td>
						<td>{result.renderedFrames}</td>
						<td>{result.frameIntervalsMs?.p50.toFixed(2) ?? '—'}</td>
						<td>{result.frameIntervalsMs?.p95.toFixed(2) ?? '—'}</td>
						<td>{result.shadowMapsPerFrame.toFixed(2)}</td>
						<td class:over={!verdict.within}>{verdict.label}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</aside>
	<section class="stage">
		{#if mounted?.surface === 'stage' && stageEvaluation !== null}
			<StageBenchSurface world={mounted.world} evaluation={stageEvaluation} />
		{:else if mounted?.surface === 'preview'}
			<VisitBenchSurface world={mounted.world} shadows={shadowsEnabled} bind:camera={visitCamera} />
		{:else if coldSurface !== null}
			<VisitorPreviewSurface
				scene={coldSurface.world.scene}
				geometry={coldSurface.world.geometry}
				graph={coldSurface.graph}
				program={coldSurface.program}
				experienceOptions={coldSurface.options}
				entryPresentationId="gate-c-presentation"
				active={true}
				mode="preview"
				startMode="presentation"
				environment="daylight"
				resolveTexture={() => null}
				title="Gate C bench"
				experienceTitle="Gate C bench"
			/>
		{:else}
			<p class="idle">No surface mounted.</p>
		{/if}
	</section>
</main>

<style>
	main {
		display: grid;
		grid-template-columns: minmax(22rem, 30rem) 1fr;
		min-height: 100vh;
		background: #0b0b10;
		color: #f4efe4;
		font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, sans-serif;
	}
	aside {
		padding: 1.25rem 1.35rem;
		border-right: 1px solid rgb(255 255 255 / 0.1);
		background: rgb(10 10 14 / 0.94);
		overflow: auto;
	}
	.eyebrow {
		margin: 0;
		color: #d6b35f;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		font-size: 0.72rem;
	}
	h1 {
		margin: 0.35rem 0 0.6rem;
		font-size: 1.5rem;
	}
	.lede,
	.status,
	.idle {
		color: rgb(244 239 228 / 0.7);
	}
	button {
		min-height: 36px;
		padding: 0 14px;
		border: 1px solid rgb(255 255 255 / 0.18);
		border-radius: 8px;
		background: rgb(255 255 255 / 0.06);
		color: inherit;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	table {
		width: 100%;
		margin-top: 0.75rem;
		border-collapse: collapse;
		font-size: 11px;
	}
	th,
	td {
		padding: 4px 5px;
		border-bottom: 1px solid rgb(255 255 255 / 0.08);
		text-align: left;
		vertical-align: top;
	}
	th {
		color: #d6b35f;
		font-weight: 600;
	}
	.over {
		color: #e38b6a;
	}
	.stage {
		position: relative;
		display: grid;
		place-items: center;
		min-width: 0;
		overflow: auto;
		padding: 1rem;
	}
	.idle {
		margin: 0;
	}
</style>
