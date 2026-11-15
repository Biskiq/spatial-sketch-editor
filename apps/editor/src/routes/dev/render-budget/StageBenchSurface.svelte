<script lang="ts">
	/**
	 * E7's Stage surface: the shipped `StageCanvas`, not a reconstruction.
	 *
	 * The bench supplies the compiled geometry, resolved Scene, a settled Camera
	 * evaluation and the Stage's pick source. Paper is absent (`plan={null}`), so
	 * the Stage runs its shaded World appearance with the same environment, mat,
	 * shadow triggers and snapshot host a creator's Stage uses.
	 */
	import type { ViewportEvaluation } from '@portfolio/camera-core';
	import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
	import { STAGE_DRAFTING_DEFAULTS } from '$lib/authoring/stage/stage-drafting';
	import StageCanvas from '$lib/authoring/stage/shell/StageCanvas.svelte';
	import type { BenchWorld } from './worlds';

	let { world, evaluation }: { world: BenchWorld; evaluation: ViewportEvaluation } = $props();

	const scenePick = createScenePickSource();
</script>

<div class="surface">
	<StageCanvas
		geometry={world.geometry}
		sourceContentId={world.id}
		layoutRevision={`gate-c-${world.id}`}
		scene={world.scene}
		{evaluation}
		{scenePick}
		environment="daylight"
		plan={null}
		planAppearance="shaded"
		contentBounds={world.contentBounds}
		snapshotBounds={world.bounds}
		datumMeters={0}
		drafting={{ ...STAGE_DRAFTING_DEFAULTS, grid: false }}
	/>
</div>

<style>
	.surface {
		width: 1280px;
		height: 720px;
		background: #e9ebe6;
	}
</style>
