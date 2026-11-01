<script lang="ts">
	/**
	 * R217.S04 — the Paper Plan layer.
	 *
	 * A drawing of the Plan evaluation and the Scene footprint projection the Stage
	 * already holds. It is mounted through a flip and while Paper is the settled
	 * reading (`paperRevealFor`), inside the one Stage Canvas, and it draws on the
	 * Stage overlay layer so the camera mask can hide the world meshes at weight 1
	 * without touching their pick eligibility.
	 *
	 * It owns no geometry authority: every line, fill and outline comes from
	 * `buildPaperPlan`. S05 adds the grid on the same layer; S07 re-strokes the
	 * selected source's entries from the same drawing set through `paper-marks`,
	 * as a filter over this drawing rather than a second Plan.
	 */
	import { useThrelte } from '@threlte/core';
	import type { CompiledLayoutGeometry, PlanEvaluation } from '@portfolio/layout-core';
	import type { PlanSceneProjection } from '$lib/authoring/scene/plan-scene-footprint';
	import type { StageSelectionEntry } from '../semantic-selection';
	import { buildPaperPlan, type PaperReveal } from '../paper-plan';
	import { createPaperMarkScene, paperMarkSet, type PaperMarkSceneResources } from '../paper-marks';
	import { createPaperScene, type PaperSceneResources } from '../paper-scene';

	let {
		plan,
		compiled,
		footprints,
		width,
		height,
		reveal,
		isFootprintMounted = () => true,
		datumMeters = 0,
		selection = null,
		hover = null,
		hoverTone = 'hover',
		revision = 0
	}: {
		plan: PlanEvaluation;
		compiled: CompiledLayoutGeometry;
		footprints: PlanSceneProjection;
		/** CSS pixels of the Stage viewport; fat-line widths are CSS pixels. */
		width: number;
		height: number;
		/** How far Paper has arrived over the shaded frame; see `paperRevealFor`. */
		reveal: PaperReveal;
		/** A footprint is drawn only for a mounted, visible body; the pick path agrees. */
		isFootprintMounted?: (entityId: string) => boolean;
		/** The level datum the Plan is drawn on; footprints sit on the same plane. */
		datumMeters?: number;
		/** The canonical primary selection; its Paper ink is a re-stroke, never a pick root. */
		selection?: StageSelectionEntry | null;
		/** The hovered subject; quiet neutral contour, suppressed for the selection itself. */
		hover?: StageSelectionEntry | null;
		/** R217.S10: `erase` re-strokes the hovered subject in the Eraser's red dashes. */
		hoverTone?: 'hover' | 'erase';
		/** Changes when Scene entity roots mount or unmount, so the drawing follows. */
		revision?: number;
	} = $props();

	const { scene, invalidate } = useThrelte();
	let resources = $state.raw<PaperSceneResources | null>(null);
	let markResources = $state.raw<PaperMarkSceneResources | null>(null);

	// Rebuilt only when the evaluation or the footprint projection changes identity.
	// A Camera move retains the Plan, so a pan does not rebuild the drawing.
	const drawing = $derived.by(() => {
		// The revision is an input, not a value: a late Scene root must redraw Paper even
		// though the Plan and the footprint projection are unchanged.
		void revision;
		return buildPaperPlan(plan, compiled, footprints, { isFootprintMounted, datumMeters });
	});

	// The selection is a filter over the drawing Paper already owns; a pan does not
	// rebuild it, and the entries can never disagree with what is drawn underneath.
	const marks = $derived.by(() => paperMarkSet(drawing, selection, hover, hoverTone));

	$effect(() => {
		const built = createPaperScene(drawing, [1, 1], datumMeters);
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
		const built = createPaperMarkScene(marks, [1, 1]);
		markResources = built;
		scene.add(built.group);
		invalidate();
		return () => {
			scene.remove(built.group);
			built.dispose();
			markResources = null;
			invalidate();
		};
	});

	$effect(() => {
		const current = resources;
		const currentMarks = markResources;
		if (current === null && currentMarks === null) return;
		current?.setResolution(width, height);
		currentMarks?.setResolution(width, height);
		invalidate();
	});

	$effect(() => {
		// The Camera's weight drives this, so a rebuild or selection mid-flip simply
		// takes the current amounts and there is no clock to restart.
		const amounts = reveal;
		resources?.setReveal(amounts);
		markResources?.setFade(amounts.sheet);
		invalidate();
	});
</script>
