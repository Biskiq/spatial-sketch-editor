<script lang="ts">
	import { tick } from 'svelte';
	import { Canvas } from '@threlte/core';
	import { buildPlanRenderModel } from '$lib/layout/plan-render-model';
	import { p2311Measure, serializeWallFirstLayoutDocument } from '@portfolio/layout-core';
	import { P2311_FIXTURES, p2311Fixture } from '$lib/bench/p2311-bend-fixtures';
	import {
		captureLayoutPreviewSnapshot,
		createEmptyLayoutPreviewState,
		importLayoutPreviewJson,
		restoreLayoutPreviewSnapshot,
		updateWallFirstWallBend,
		updateWallFirstWallMove
	} from '$lib/editor/layout/layout-preview-state.svelte';
	import { createLayoutInteractionState } from '$lib/editor/layout/layout-interaction';
	import LayoutPreviewScene from '$lib/editor/layout/LayoutPreviewScene.svelte';
	import PlanSvg from '$lib/editor/layout/PlanSvg.svelte';
	import type { PlanViewportState } from '$lib/editor/layout/layout-plan-transform';

	const preview = $state(createEmptyLayoutPreviewState());
	const interaction = $state(createLayoutInteractionState());
	const planView: PlanViewportState = {
		width: 640, height: 360, center: [6, 5], pixelsPerMeter: 20,
		initialized: true, gridEnabled: false, snapEnabled: false,
		angleSnapEnabled: false, showTourOverlay: false
	};
	const planModel = $derived(p2311Measure('plan-render-model', () => buildPlanRenderModel(preview.geometry)));
	let running = $state(false);
	let report = $state<Record<string, unknown> | null>(null);
	let issue = $state('');

	function stats(values: number[]) {
		if (values.length === 0) return null;
		const ordered = [...values].sort((a, b) => a - b);
		const at = (fraction: number) => ordered[Math.min(ordered.length - 1, Math.ceil(fraction * ordered.length) - 1)]!;
		return { count: values.length, p50: at(0.5), p95: at(0.95), max: ordered.at(-1)! };
	}

	async function nextFrame() {
		await tick();
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
	}

	async function runMatrix() {
		running = true;
		issue = '';
		report = null;
		(globalThis as { __P2311_PERF__?: boolean }).__P2311_PERF__ = true;
		const results: Record<string, unknown> = {};
		try {
			for (const spec of P2311_FIXTURES) {
				const document = p2311Fixture(spec);
				if (!importLayoutPreviewJson(preview, serializeWallFirstLayoutDocument(document))) {
					throw new Error(`${spec.id}: ${preview.importError ?? 'fixture import failed'}`);
				}
				await nextFrame();
				const snapshot = captureLayoutPreviewSnapshot(preview);
				performance.clearMeasures();
				performance.clearMarks();
				performance.mark(`p2311:scenario:${spec.id}:start`);
				let valid = 0;
				let invalid = 0;
				let lastRejection = '';
				const count = 28;
				for (let index = 0; index < count; index += 1) {
					await new Promise<void>((resolve) => setTimeout(resolve, 16));
					const start = performance.now();
					restoreLayoutPreviewSnapshot(preview, snapshot);
					const z = 0.28 + 0.045 * Math.sin(index * 0.3);
					const distance = spec.knots === 3 ? 4.5 : 3;
					const result = spec.kind === 'bend'
						? updateWallFirstWallBend(preview, 'w0', { distance, point: [distance, spec.knots === 3 ? z / 2 : z] })
						: updateWallFirstWallMove(preview, 'w0', [0, z / 6]);
					if (result.success) valid += 1;
					else { invalid += 1; lastRejection = result.message; }
					await nextFrame();
					performance.measure('p2311:gesture-frame', { start, end: performance.now() });
				}
				const measures = performance.getEntriesByType('measure').filter((entry) => entry.name.startsWith('p2311:'));
				const byName = new Map<string, number[]>();
				for (const entry of measures) {
					const key = entry.name.slice('p2311:'.length);
					const values = byName.get(key) ?? [];
					values.push(entry.duration);
					byName.set(key, values);
				}
				results[spec.id] = {
					fixture: { walls: spec.walls, rooms: spec.rooms, knots: spec.knots, openings: spec.openings },
					valid, invalid, lastRejection,
					stages: Object.fromEntries([...byName].map(([name, values]) => [name, stats(values)])),
					totalDurationByStage: Object.fromEntries([...byName].map(([name, values]) => [name, values.reduce((a, b) => a + b, 0)]))
				};
				performance.mark(`p2311:scenario:${spec.id}:end`);
			}
			report = { userAgent: navigator.userAgent, samplesPerScenario: 28, results };
			(globalThis as { __P2311_REPORT__?: unknown }).__P2311_REPORT__ = report;
		} catch (error) {
			issue = error instanceof Error ? error.message : String(error);
		} finally {
			running = false;
			(globalThis as { __P2311_PERF__?: boolean }).__P2311_PERF__ = false;
		}
	}
</script>

<svelte:head><title>P23.11 Bend diagnosis</title></svelte:head>
<main>
	<header>
		<h1>P23.11 Bend diagnostic harness</h1>
		<button disabled={running} onclick={runMatrix}>{running ? 'Measuring…' : 'Run fixture matrix'}</button>
		{#if issue}<p role="alert">{issue}</p>{/if}
	</header>
	<div class="views">
		<svg viewBox="0 0 640 360" aria-label="fixture Plan renderer"><PlanSvg model={planModel} {planView} /></svg>
		<div class="three" aria-label="fixture 3D renderer">
			<Canvas dpr={1}>
				<LayoutPreviewScene model={preview.model} geometry={preview.geometry}
					wallMeshesByRoom={preview.wallMeshesByRoom} wallMeshesByWall={preview.wallMeshesByWall}
					{interaction} />
			</Canvas>
		</div>
	</div>
	{#if report}<pre>{JSON.stringify(report, null, 2)}</pre>{/if}
</main>

<style>
	main { min-height: 100vh; padding: 1rem; background: #17171b; color: #eee; font-family: system-ui; }
	header { display: flex; align-items: center; gap: 1rem; }
	.views { display: grid; grid-template-columns: 1fr 1fr; height: 360px; gap: 1rem; }
	svg, .three { width: 100%; height: 100%; background: #29292d; }
	pre { font-size: 11px; overflow: auto; }
</style>
