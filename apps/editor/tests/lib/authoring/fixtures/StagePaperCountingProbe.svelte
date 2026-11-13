<script lang="ts">
	/**
	 * Mounts the real Stage Paper layer and exposes the interactions the counting
	 * contract needs: a new drawing revision (the input the Stage gives Paper when
	 * Scene roots mount or unmount), a selection and hover change, a viewport
	 * change (zoom) and a new accepted Plan.
	 *
	 * Every setter changes a prop of the production component, so a test asserts
	 * the counters at the component boundary rather than calling a builder itself.
	 */
	import type { CompiledLayoutGeometry, PlanEvaluation } from '@portfolio/layout-core';
	import type { PlanSceneProjection } from '$lib/authoring/scene/plan-scene-footprint';
	import type { PaperReveal } from '$lib/authoring/stage/paper-plan';
	import type { StageSelectionEntry } from '$lib/authoring/stage/semantic-selection';
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
	// The probe owns the Plan it hands Paper; `applyPlan` is the only writer after
	// mount, so the initial prop is deliberately the seed, not a live binding.
	// svelte-ignore state_referenced_locally
	let currentPlan = $state.raw(plan);
	let selection = $state.raw<StageSelectionEntry | null>(null);
	let hover = $state.raw<StageSelectionEntry | null>(null);
	let width = $state(1280);
	let height = $state(720);
	const reveal: PaperReveal = { lines: 1, sheet: 1, poche: 1 };

	/** Test-only interaction: ask Paper for a fresh drawing of the same Plan. */
	export function bumpRevision(): void {
		revision += 1;
	}

	/** Test-only interaction: a new accepted Plan, as an accepted edit hands it over. */
	export function applyPlan(next: PlanEvaluation): void {
		currentPlan = next;
	}

	/** Test-only interaction: select or clear the primary selection. */
	export function select(next: StageSelectionEntry | null): void {
		selection = next;
	}

	/** Test-only interaction: hover a subject or clear the hover. */
	export function hoverOn(next: StageSelectionEntry | null): void {
		hover = next;
	}

	/** Test-only interaction: a zoom changes only the viewport resolution. */
	export function resize(nextWidth: number, nextHeight = 720): void {
		width = nextWidth;
		height = nextHeight;
	}
</script>

<StagePaper
	plan={currentPlan}
	{compiled}
	{footprints}
	{width}
	{height}
	{reveal}
	datumMeters={0}
	{selection}
	{hover}
	{revision}
/>
