<script lang="ts">
	/**
	 * R217.S04 — the Paper Plan layer.
	 *
	 * A drawing of the Plan evaluation and the Scene footprint projection the Stage
	 * already holds. It is mounted only while Paper is the visible reading (settled
	 * Plan, orthographic weight 1, Paper appearance), inside the one Stage Canvas,
	 * and it draws on the Stage overlay layer so the camera mask can hide the world
	 * meshes without touching their pick eligibility.
	 *
	 * It owns no geometry authority: every line, fill and outline comes from
	 * `buildPaperPlan`. S05 adds the grid on the same layer; S07 re-strokes the
	 * selected source's entries from the same drawing set.
	 */
	import { useThrelte } from '@threlte/core';
	import type { CompiledLayoutGeometry, PlanEvaluation } from '@portfolio/layout-core';
	import type { PlanSceneProjection } from '$lib/authoring/scene/plan-scene-footprint';
	import { buildPaperPlan } from '../paper-plan';
	import { createPaperScene, type PaperSceneResources } from '../paper-scene';

	let {
		plan,
		compiled,
		footprints,
		width,
		height,
		instant = false,
		isFootprintMounted = () => true,
		datumMeters = 0,
		revision = 0
	}: {
		plan: PlanEvaluation;
		compiled: CompiledLayoutGeometry;
		footprints: PlanSceneProjection;
		/** CSS pixels of the Stage viewport; fat-line widths are CSS pixels. */
		width: number;
		height: number;
		/** Reduce motion: the settle-in switch is instant. */
		instant?: boolean;
		/** A footprint is drawn only for a mounted, visible body; the pick path agrees. */
		isFootprintMounted?: (entityId: string) => boolean;
		/** The level datum the Plan is drawn on; footprints sit on the same plane. */
		datumMeters?: number;
		/** Changes when Scene entity roots mount or unmount, so the drawing follows. */
		revision?: number;
	} = $props();

	const { scene, invalidate } = useThrelte();
	let resources = $state.raw<PaperSceneResources | null>(null);
	let shown = false;

	// Rebuilt only when the evaluation or the footprint projection changes identity.
	// A Camera move retains the Plan, so a pan does not rebuild the drawing.
	const drawing = $derived.by(() => {
		// The revision is an input, not a value: a late Scene root must redraw Paper even
		// though the Plan and the footprint projection are unchanged.
		void revision;
		return buildPaperPlan(plan, compiled, footprints, { isFootprintMounted, datumMeters });
	});

	$effect(() => {
		const built = createPaperScene(drawing, [1, 1]);
		resources = built;
		scene.add(built.group);
		invalidate();
		return () => {
			scene.remove(built.group);
			built.dispose();
			resources = null;
			invalidate();
		};
	});

	$effect(() => {
		const current = resources;
		if (current === null) return;
		current.setResolution(width, height);
		invalidate();
	});

	$effect(() => {
		const current = resources;
		if (current === null) return;
		if (instant || shown) {
			current.setFade(1);
			shown = true;
			invalidate();
			return;
		}
		// PLATE's settle: the drawing fades in over the mat once the reading lands at
		// orthographic weight 1. Geometry is retained through the fade.
		const started = performance.now();
		let frame = 0;
		const step = (now: number): void => {
			const amount = Math.min(1, (now - started) / 150);
			current.setFade(amount);
			invalidate();
			if (amount < 1) frame = requestAnimationFrame(step);
			else shown = true;
		};
		current.setFade(0);
		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	});
</script>
