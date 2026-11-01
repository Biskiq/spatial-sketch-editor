<script lang="ts">
	/**
	 * R217.S13 — the fixed-value world-anchored grid, in the one Stage Canvas.
	 *
	 * The drawing is rebuilt only when its own key changes: the visible levels or
	 * the quantised rectangle. A pan inside the same rectangle retains the
	 * geometry, and the lines stay anchored to world zero. Paper is a bounded sheet
	 * around the work; the mat is the datum footprint the Camera sees. It is
	 * display-only — never a pick root, never `Object3D.visible` appearance — and it
	 * reads the evaluation's target-plane scale rather than a Camera of its own.
	 */
	import { untrack } from 'svelte';
	import { T, useThrelte } from '@threlte/core';
	import { Group } from 'three';
	import type { ViewportEvaluation } from '@portfolio/camera-core';
	import { stageGridPlanFor, type GridRect, type GridSurface } from '../stage-grid';
	import { createGridScene, type GridSceneResources } from './stage-grid-scene';

	let {
		evaluation,
		datumMeters = 0,
		contentBounds = null,
		candidateBounds = null,
		surface
	}: {
		evaluation: ViewportEvaluation | null;
		/** The level datum the grid is drawn on. */
		datumMeters?: number;
		/** Layout ∪ Scene datum bounds; Paper draws a bounded sheet around them. */
		contentBounds?: GridRect | null;
		/** R217.S14 — the live candidate's extent; the sheet grows to include it. */
		candidateBounds?: GridRect | null;
		surface: GridSurface;
	} = $props();

	const { invalidate } = useThrelte();
	const root = new Group();
	root.name = 'StageGridRoot';
	let builtKey = '';
	let resources: GridSceneResources | null = null;

	const plan = $derived(
		evaluation === null
			? null
			: stageGridPlanFor(evaluation, { surface, datumMeters, contentBounds, candidateBounds })
	);

	/** Only the drawing key is a dependency; the plan object is read untracked. */
	const planKey = $derived(plan?.key ?? '');

	$effect(() => {
		const key = planKey;
		// A plan is recomputed on every settled evaluation, including a pan inside
		// the same quantised rectangle. Keying the effect on the drawing itself is
		// what keeps that pan from rebuilding the same geometry.
		const current = untrack(() => plan);
		if (current === null || key === '' || key === builtKey) return;
		const created = createGridScene(current);
		builtKey = key;
		resources = created;
		root.add(created.group);
		invalidate();
		return () => {
			root.remove(created.group);
			created.dispose();
			if (resources === created) resources = null;
			if (builtKey === key) builtKey = '';
			invalidate();
		};
	});

	$effect(() => {
		// The plan is read so a fade-only change reaches this effect; the lattice
		// itself is untouched because its key does not contain opacity.
		const current = plan;
		if (current === null) return;
		resources?.update(current);
		invalidate();
	});
</script>

<T is={root} />
