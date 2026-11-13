<script lang="ts">
	/**
	 * Mounts the real Stage Paper layer and exposes the one interaction the
	 * counting contract needs: a new drawing revision.
	 *
	 * A revision change is the same input the Stage gives Paper when Scene entity
	 * roots mount or unmount. It re-evaluates `buildPaperPlan` and rebuilds the
	 * Paper scene through their production callers, so a test asserts the counters
	 * at the component boundary rather than calling those builders itself.
	 */
	import type { CompiledLayoutGeometry, PlanEvaluation } from '@portfolio/layout-core';
	import type { PlanSceneProjection } from '$lib/authoring/scene/plan-scene-footprint';
	import type { PaperReveal } from '$lib/authoring/stage/paper-plan';
	import StagePaper from '$lib/authoring/stage/shell/StagePaper.svelte';

	let {
		plan,
		compiled,
		footprints
	}: {
		plan: PlanEvaluation;
		compiled: CompiledLayoutGeometry;
		footprints: PlanSceneProjection;
	} = $props();

	let revision = $state(0);
	const reveal: PaperReveal = { lines: 1, sheet: 1, poche: 1 };

	/** Test-only interaction: ask Paper for a fresh drawing of the same Plan. */
	export function bumpRevision(): void {
		revision += 1;
	}
</script>

<StagePaper
	{plan}
	{compiled}
	{footprints}
	width={1280}
	height={720}
	{reveal}
	datumMeters={0}
	{revision}
/>
